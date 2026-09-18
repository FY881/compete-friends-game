import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";
import { PRICE_TABLE, priceFor, type PackageDays } from "./membershipStore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔄 مركز التجديد والاسترداد — لا تفقد ما دفعت ثمنه
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ثلاث خسائر حقيقية كانت تصيب العضو بلا أي تعويض، وكل واحدة لها علاج هنا:
 *
 *   1) **انتهاء العضوية فجأة**: الآن فترة سماح تحفظ مستواك (graceDays)
 *      كترقية مؤقتة حقيقية، فلا يتوقف امتيازك في منتصف نشاط.
 *   2) **ترقية وهو ما زال يملك أياماً**: يمكنه ادّخار أيامه المتبقية
 *      (بنسبة 50%) في رصيد دائم يُستعمل في أي تجديد قادم.
 *   3) **التوقف عن اللعب**: عروض استرجاع حقيقية (خصم + أيام إضافية)
 *      تُمنح تلقائياً بعد الانتهاء، وحجمها يكبر بوفائك في الرتب الشرفية.
 *
 * والتجديد التلقائي ينفّذ فعلاً: يستهلك الأيام المدّخرة أولاً ثم نقاط
 * الولاء — بلا أي cron، يشتغل عند فتح اللاعب لصفحته.
 */

const CREDIT_RATE = 0.5; // نسبة الأيام المستردة عند الادّخار
const MAX_BANK_DAYS = 120;
const DEFAULT_GRACE_DAYS = 3;
const TARGETS: readonly Tier[] = ["silver", "gold", "diamond", "exclusive"];

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

async function ensurePrefs(ctx: any, userId: any) {
  const row = await ctx.db
    .query("renewalPrefs")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (row) return row;
  const id = await ctx.db.insert("renewalPrefs", {
    userId,
    autoRenew: false,
    payWithLoyalty: true,
    keepTierOnExpiry: true,
    graceDays: DEFAULT_GRACE_DAYS,
    remindersOn: true,
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

async function ensureCredits(ctx: any, userId: any) {
  const row = await ctx.db
    .query("membershipCredits")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (row) return row;
  const id = await ctx.db.insert("membershipCredits", {
    userId,
    bankedDays: 0,
    lifetimeBanked: 0,
    lifetimeUsed: 0,
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

async function getWallet(ctx: any, userId: any) {
  return await ctx.db
    .query("loyaltyWallets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

/** يطبّق عضوية فعلياً (ترقية أو تمديد) — نفس قاعدة المتجر الموحّدة. */
async function applyMembership(ctx: any, userId: any, tier: Tier, days: number, source: string) {
  const now = Date.now();
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();

  const ownedTier: Tier =
    membership && (!membership.expiresAt || membership.expiresAt > now)
      ? (membership.tier as Tier)
      : "bronze";
  const target: Tier = tierIndex(ownedTier) > tierIndex(tier) ? ownedTier : tier;
  const sameTier = membership && membership.tier === target;
  const stillActive = membership?.expiresAt && membership.expiresAt > now;
  const baseTime = sameTier && stillActive ? (membership!.expiresAt as number) : now;
  const expiresAt = baseTime + days * DAY;

  if (membership) {
    await ctx.db.patch(membership._id, {
      tier: target,
      activatedAt: sameTier && stillActive ? membership.activatedAt : now,
      expiresAt,
      codeUsed: membership.codeUsed ?? source,
    });
  } else {
    await ctx.db.insert("memberships", {
      userId,
      tier: target,
      activatedAt: now,
      expiresAt,
      features: [],
    });
  }
  return { expiresAt, target, upgraded: tierIndex(target) > tierIndex(ownedTier) };
}

/** نسبة خصم الاسترجاع من تاريخك: تبدأ 10% وتكبر برتبك الشرفية حتى 50%. */
async function winbackRate(ctx: any, userId: any, base = 10) {
  const prestige = await ctx.db
    .query("membershipPrestige")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  const level = prestige?.level ?? 1;
  return Math.min(50, base + (level - 1) * 5);
}

// ═══════════════════════════════════════════════════════════════════════
// 📊 مركز التجديد (قراءة)
// ═══════════════════════════════════════════════════════════════════════

export const getRenewalCenter = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const now = Date.now();
    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);

    const prefsRow = await ctx.db
      .query("renewalPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const prefs = {
      autoRenew: prefsRow?.autoRenew ?? false,
      payWithLoyalty: prefsRow?.payWithLoyalty ?? true,
      keepTierOnExpiry: prefsRow?.keepTierOnExpiry ?? true,
      graceDays: prefsRow?.graceDays ?? DEFAULT_GRACE_DAYS,
      remindersOn: prefsRow?.remindersOn ?? true,
      updatedAt: prefsRow?.updatedAt ?? null,
    };

    const creditsRow = await ctx.db
      .query("membershipCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const credits = {
      bankedDays: creditsRow?.bankedDays ?? 0,
      lifetimeBanked: creditsRow?.lifetimeBanked ?? 0,
      lifetimeUsed: creditsRow?.lifetimeUsed ?? 0,
    };

    const wallet = await getWallet(ctx, userId);
    const points = wallet?.points ?? 0;

    const offersRaw = await ctx.db
      .query("renewalOffers")
      .withIndex("by_user", (q) => q.eq("userId", userId).eq("used", false))
      .take(6);
    const offers = offersRaw
      .filter((o) => o.expiresAt > now)
      .map((o) => ({
        id: String(o._id),
        tier: o.tier as Tier,
        tierName: TIER_META[o.tier as Tier].name,
        days: o.days,
        discountPct: o.discountPct,
        extraDays: o.extraDays,
        reason: o.reason,
        expiresAt: o.expiresAt,
        hoursLeft: Math.max(0, Math.ceil((o.expiresAt - now) / (60 * 60 * 1000))),
      }));

    // خطة التجديد: الأيام المدّخرة ثم نقاط الولاء (بعد خصم مستواك وأعلى عرض)
    const bestDiscount = Math.max(
      ents.storeDiscountPct,
      ...offers.map((o) => o.discountPct),
      0,
    );
    const currentTier: Tier = resolved.paidTier !== "bronze" ? resolved.paidTier : "silver";
    const plan = TARGETS.map((tier) => {
      const key = tier as Exclude<Tier, "bronze">;
      const priced = priceFor(key, 30 as PackageDays, bestDiscount);
      const creditValue = credits.bankedDays; // كل يوم مدّخر = يوم عضوية
      const loyaltyDays = Math.floor(Math.max(0, points - 0) / Math.max(1, priced.final / 30));
      return {
        tier,
        tierName: TIER_META[tier].name,
        emoji: TIER_META[tier].emoji,
        price30: priced.final,
        base30: priced.base,
        discountPct: bestDiscount,
        perDay: Math.max(1, Math.round(priced.final / 30)),
        bankedDaysCover: creditValue,
        loyaltyDaysAffordable: Math.min(90, loyaltyDays),
        totalDaysAffordable: Math.min(90, creditValue + loyaltyDays),
        isCurrent: tierIndex(resolved.paidTier) === tierIndex(tier),
      };
    });

    const expired = resolved.expiresAt !== null && resolved.expiresAt <= now;

    return {
      tier: resolved.tier,
      paidTier: resolved.paidTier,
      tierName: TIER_META[resolved.tier].name,
      expiresAt: resolved.expiresAt,
      daysRemaining: resolved.daysRemaining,
      expired,
      inGrace: resolved.fromBoost && resolved.expiresAt !== null && resolved.expiresAt <= now,
      graceEndsAt:
        resolved.expiresAt !== null ? resolved.expiresAt + prefs.graceDays * DAY : null,
      prefs,
      credits,
      points,
      offers,
      plan,
      currentTierTarget: currentTier,
      readiness: {
        hasMembership: resolved.paidTier !== "bronze",
        hasPoints: points > 0,
        hasCredits: credits.bankedDays > 0,
        canAutoRenew: prefs.autoRenew && (points > 0 || credits.bankedDays > 0),
        bestDiscountPct: bestDiscount,
      },
      activeBoosts: resolved.boosts.length,
      isSignedIn: true,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ تفضيلات التجديد
// ═══════════════════════════════════════════════════════════════════════

export const setRenewalPrefs = mutation({
  args: {
    autoRenew: v.optional(v.boolean()),
    payWithLoyalty: v.optional(v.boolean()),
    keepTierOnExpiry: v.optional(v.boolean()),
    graceDays: v.optional(v.number()),
    remindersOn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const prefs = await ensurePrefs(ctx, userId);

    const graceDays =
      args.graceDays === undefined
        ? prefs.graceDays
        : Math.max(0, Math.min(14, Math.round(args.graceDays)));

    await ctx.db.patch(prefs._id, {
      autoRenew: args.autoRenew ?? prefs.autoRenew,
      payWithLoyalty: args.payWithLoyalty ?? prefs.payWithLoyalty,
      keepTierOnExpiry: args.keepTierOnExpiry ?? prefs.keepTierOnExpiry,
      graceDays,
      remindersOn: args.remindersOn ?? prefs.remindersOn,
      updatedAt: Date.now(),
    });

    return { ok: true, prefs: { ...prefs, graceDays } };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 💾 ادّخار الأيام المتبقية (استرداد حقيقي 50%)
// ═══════════════════════════════════════════════════════════════════════

export const bankUnusedDays = mutation({
  args: { confirm: v.literal("bank") },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");

    const now = Date.now();
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (!membership) throw new Error("لا توجد عضوية نشطة لادّخار أيامها.");
    if (!membership.expiresAt || membership.expiresAt <= now) {
      throw new Error("عضويتك منتهية بالفعل — لا أيام لادّخارها.");
    }

    const remaining = Math.max(0, Math.ceil((membership.expiresAt - now) / DAY));
    if (remaining < 1) throw new Error("لا توجد أيام كافية للادّخار.");

    const credits = await ensureCredits(ctx, userId);
    const gained = Math.max(1, Math.floor(remaining * CREDIT_RATE));
    const banked = Math.min(MAX_BANK_DAYS, credits.bankedDays + gained);

    await ctx.db.patch(credits._id, {
      bankedDays: banked,
      lifetimeBanked: credits.lifetimeBanked + gained,
      updatedAt: now,
    });
    // العضوية الحالية تُغلق لأن أيامها تحوّلت إلى رصيد
    await ctx.db.patch(membership._id, { expiresAt: now });

    await logEvent(ctx, {
      userId,
      actorName: "مركز التجديد",
      kind: "bank",
      tier: membership.tier,
      detail: `ادّخر ${gained} يوماً من ${remaining} (بنسبة ${CREDIT_RATE * 100}%) — الرصيد الآن ${banked} يوماً`,
      days: gained,
    });

    return { ok: true, remaining, gained, bankedDays: banked };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🔄 التنفيذ: تجديد تلقائي + فترة سماح + عرض استرجاع
// ═══════════════════════════════════════════════════════════════════════

/**
 * يشغّل آلة التجديد — يُستدعى عند فتح اللاعب لصفحة العضوية (مرة كل 20 ساعة).
 * كل فعل هنا **حقيقي** وينتهي بأثر في قاعدة البيانات، ولا يعتمد على أي cron.
 */
export const syncRenewal = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false, ran: [] as string[] };

    const now = Date.now();
    const ran: string[] = [];
    const prefs = await ensurePrefs(ctx, userId);
    const credits = await ensureCredits(ctx, userId);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const expired = membership?.expiresAt !== undefined && membership?.expiresAt !== null
      ? (membership!.expiresAt as number) <= now
      : false;

    // (١) فترة السماح: تحفظ المستوى بعد الانتهاء كترقية مؤقتة حقيقية
    if (membership && expired && prefs.keepTierOnExpiry && prefs.graceDays > 0) {
      const graceEndsAt = (membership.expiresAt as number) + prefs.graceDays * DAY;
      if (graceEndsAt > now && membership.tier !== "bronze") {
        const existing = await ctx.db
          .query("membershipBoosts")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
        const hasGrace = existing.some(
          (b) => b.source === "grace" && b.expiresAt > now && b.tier === membership.tier,
        );
        if (!hasGrace) {
          await ctx.db.insert("membershipBoosts", {
            userId,
            tier: membership.tier,
            source: "grace",
            label: "فترة سماح بعد انتهاء العضوية",
            startedAt: now,
            expiresAt: graceEndsAt,
            note: `تحفظ مستوى ${TIER_META[membership.tier as Tier].name} حتى التجديد`,
          });
          ran.push("grace");
          await logEvent(ctx, {
            userId,
            actorName: "مركز التجديد",
            kind: "grace",
            tier: membership.tier,
            detail: `بدأت فترة سماح ${prefs.graceDays} أيام — مستواك محفوظ حتى التجديد`,
            expiresAt: graceEndsAt,
          });
        }
      }
    }

    // (٢) التجديد التلقائي الفعلي
    if (membership && expired && prefs.autoRenew && membership.tier !== "bronze") {
      const tier = membership.tier as Exclude<Tier, "bronze">;
      const perDay = Math.max(1, Math.round(PRICE_TABLE[tier][30] / 30));
      let days = Math.min(30, Math.floor(credits.bankedDays));
      let usedCredits = days;
      let spentPoints = 0;

      if (days < 30 && prefs.payWithLoyalty) {
        const wallet = await getWallet(ctx, userId);
        const balance = wallet?.points ?? 0;
        const affordable = Math.floor(balance / perDay);
        const extra = Math.min(30 - days, affordable);
        if (extra > 0 && wallet) {
          spentPoints = extra * perDay;
          await ctx.db.patch(wallet._id, {
            points: balance - spentPoints,
            updatedAt: now,
          });
          await ctx.db.insert("loyaltyLedger", {
            userId,
            delta: -spentPoints,
            reason: `تجديد تلقائي لعضوية ${TIER_META[tier].name} لمدة ${extra} يوم`,
            at: now,
          });
          days += extra;
        }
      }

      if (days > 0) {
        const applied = await applyMembership(ctx, userId, tier, days, "renewal:auto");
        if (usedCredits > 0) {
          await ctx.db.patch(credits._id, {
            bankedDays: credits.bankedDays - usedCredits,
            lifetimeUsed: credits.lifetimeUsed + usedCredits,
            updatedAt: now,
          });
        }
        ran.push("auto_renew");
        await logEvent(ctx, {
          userId,
          actorName: "مركز التجديد",
          kind: "renew",
          tier,
          detail: `تجديد تلقائي: ${days} يوماً (${usedCredits} من الرصيد المدّخر${spentPoints > 0 ? ` + ${spentPoints} نقطة ولاء` : ""})`,
          points: -spentPoints,
          days,
          expiresAt: applied.expiresAt,
        });
      }
    }

    // (٣) عرض استرجاع حقيقي بعد الانتهاء (مرة كل 20 ساعة كحد أقصى)
    if (membership && expired && prefs.remindersOn) {
      const last = prefs.lastReminderAt ?? 0;
      if (now - last > 20 * 60 * 60 * 1000) {
        const openOffers = await ctx.db
          .query("renewalOffers")
          .withIndex("by_user", (q) => q.eq("userId", userId).eq("used", false))
          .take(3);
        const stillValid = openOffers.some((o) => o.expiresAt > now);
        if (!stillValid && membership.tier !== "bronze") {
          const rate = await winbackRate(ctx, userId);
          const days = 30;
          await ctx.db.insert("renewalOffers", {
            userId,
            tier: membership.tier,
            days,
            discountPct: rate,
            extraDays: rate >= 30 ? 7 : rate >= 20 ? 3 : 0,
            reason: "winback",
            expiresAt: now + 7 * DAY,
            used: false,
            createdAt: now,
          });
          ran.push("winback_offer");
          await logEvent(ctx, {
            userId,
            actorName: "مركز التجديد",
            kind: "offer",
            tier: membership.tier,
            detail: `عرض استرجاع: خصم ${rate}% على تجديد ${TIER_META[membership.tier as Tier].name} لمدة ${days} يوماً`,
          });
        }
        await ctx.db.patch(prefs._id, { lastReminderAt: now, updatedAt: now });
      }
    }

    return { ok: true, ran };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 💳 الشراء عبر الرصيد (المدّخر + نقاط الولاء)
// ═══════════════════════════════════════════════════════════════════════

/**
 * تجديد/شراء يستهلك **الرصيد المدّخر أولاً ثم نقاط الولاء** مع خصم العرض.
 * هذا هو المسار الوحيد الذي يستفيد من الأيام المدّخرة.
 */
export const redeemWithCredits = mutation({
  args: {
    tier: v.union(
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    days: v.union(v.literal(7), v.literal(30), v.literal(90)),
    offerId: v.optional(v.id("renewalOffers")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const now = Date.now();

    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);
    if (tierIndex(resolved.paidTier) > tierIndex(args.tier)) {
      throw new Error(
        `أنت تملك ${TIER_META[resolved.paidTier].name} — أعلى من ${TIER_META[args.tier].name}.`,
      );
    }

    let offerDiscount = 0;
    let extraDays = 0;
    if (args.offerId) {
      const offer = await ctx.db.get(args.offerId);
      if (!offer || offer.userId !== userId) throw new Error("العرض غير موجود.");
      if (offer.used || offer.expiresAt <= now) throw new Error("انتهى هذا العرض.");
      if (offer.tier !== args.tier) throw new Error("العرض مخصص لمستوى آخر.");
      offerDiscount = offer.discountPct;
      extraDays = offer.extraDays;
      await ctx.db.patch(offer._id, { used: true });
    }

    const totalDiscount = Math.min(
      70,
      Math.max(ents.storeDiscountPct, offerDiscount) +
        (offerDiscount > 0 && ents.storeDiscountPct > 0 ? 5 : 0),
    );
    const price = priceFor(args.tier as Exclude<Tier, "bronze">, args.days as PackageDays, totalDiscount);
    const credits = await ensureCredits(ctx, userId);
    const wallet = await getWallet(ctx, userId);
    const balance = wallet?.points ?? 0;
    const perDay = Math.max(1, Math.round(price.final / args.days));

    const creditDays = Math.min(credits.bankedDays, args.days);
    const remainingDays = args.days - creditDays;
    const pointCost = remainingDays * perDay;

    if (creditDays === 0 && pointCost > balance) {
      throw new Error(
        `الرصيد غير كافٍ — تحتاج ${pointCost} نقطة ولديك ${balance}. العب جولات لترفع رصيدك.`,
      );
    }
    if (pointCost > balance) {
      throw new Error(`تكفي الأيام المدّخرة جزئياً — تحتاج ${pointCost} نقطة إضافية ولديك ${balance}.`);
    }

    if (pointCost > 0 && wallet) {
      await ctx.db.patch(wallet._id, { points: balance - pointCost, updatedAt: now });
      await ctx.db.insert("loyaltyLedger", {
        userId,
        delta: -pointCost,
        reason: `عضوية ${TIER_META[args.tier].name} ${args.days} يوماً عبر مركز التجديد`,
        at: now,
      });
    }
    if (creditDays > 0) {
      await ctx.db.patch(credits._id, {
        bankedDays: credits.bankedDays - creditDays,
        lifetimeUsed: credits.lifetimeUsed + creditDays,
        updatedAt: now,
      });
    }

    const totalDays = args.days + extraDays;
    const applied = await applyMembership(ctx, userId, args.tier, totalDays, "renewal:credits");

    await logEvent(ctx, {
      userId,
      actorName: "مركز التجديد",
      kind: "renew",
      tier: args.tier,
      detail: `تجديد ${TIER_META[args.tier].name} ${totalDays} يوماً (${creditDays} من الرصيد المدّخر${pointCost > 0 ? ` + ${pointCost} نقطة` : ""}${extraDays > 0 ? ` + ${extraDays} يوم هدية` : ""})`,
      points: -pointCost,
      days: totalDays,
      expiresAt: applied.expiresAt,
    });

    return {
      ok: true,
      tier: applied.target,
      expiresAt: applied.expiresAt,
      usedCredits: creditDays,
      spentPoints: pointCost,
      extraDays,
      totalDays,
      discountPct: totalDiscount,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 👑 منح عرض من المالك
// ═══════════════════════════════════════════════════════════════════════

const OWNER_EMAIL = "omw70op@gmail.com";

export const ownerGrantOffer = mutation({
  args: {
    userName: v.string(),
    tier: v.union(
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    days: v.number(),
    discountPct: v.number(),
    extraDays: v.optional(v.number()),
    validDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) throw new Error("يجب تسجيل الدخول.");
    const owner = (await ctx.db.get(ownerId)) as { role?: string; email?: string; name?: string } | null;
    if (!owner || (owner.role !== "admin" && owner.email !== OWNER_EMAIL)) {
      throw new Error("غرفة المالك فقط.");
    }

    const target = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), args.userName.trim()))
      .first();
    if (!target) throw new Error("لا يوجد لاعب بهذا الاسم.");

    const now = Date.now();
    await ctx.db.insert("renewalOffers", {
      userId: target._id,
      tier: args.tier,
      days: Math.max(1, Math.min(365, Math.round(args.days))),
      discountPct: Math.max(0, Math.min(70, Math.round(args.discountPct))),
      extraDays: Math.max(0, Math.min(60, Math.round(args.extraDays ?? 0))),
      reason: "owner",
      expiresAt: now + Math.max(1, args.validDays ?? 14) * DAY,
      used: false,
      createdAt: now,
    });

    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "offer",
      tier: args.tier,
      detail: `منح عرض تجديد: ${TIER_META[args.tier].name} بخصم ${args.discountPct}% لمدة ${Math.max(1, Math.round(args.days))} يوماً`,
    });

    return { ok: true, target: target.name ?? "لاعب" };
  },
});
