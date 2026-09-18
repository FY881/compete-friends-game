import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, tierIndex, tierLabel, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎁 عروض العضوية — قسائم ترويجية وتجارب مجانية (بقيود مُنفَّذة فعلاً)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الرسالة الترويجية بلا قيود = ثغرة استغلال. لذلك كل قسيمة هنا تحمل:
 *   • سقف استخدام عام (maxUses) + عدّاد حقيقي.
 *   • سقف لكل لاعب على حدة (perUserLimit) يُفحص من جدول الاستبدالات.
 *   • حدّاً زمنياً للانتهاء.
 *   • نطاقاً للمستويات المؤهّلة (minTier/maxTier) يمنع أخذ قسيمة
 *     مبتدئين لمستوى أسطوري.
 *
 * والتجربة المجانية تُمنح **مرة واحدة لكل مستوى** على مدى عمر الحساب،
 * وتتطلب نشاطاً حقيقياً — فلا تُصبح باباً خلفياً مجانياً دائماً.
 */

const OWNER_EMAIL = "omw70op@gmail.com";

async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(userId)) as { role?: string; email?: string; name?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) {
    throw new Error("غرفة المالك فقط.");
  }
  return me;
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

/** يمنح/يمدّد العضوية فعلياً — نفس منطق المتجر بلا خصم نقاط. */
async function applyTierGrant(
  ctx: any,
  userId: string,
  tier: Tier,
  days: number,
): Promise<{ expiresAt: number; upgraded: boolean; note: string }> {
  const now = Date.now();
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();

  const ownedTier: Tier = membership && (!membership.expiresAt || membership.expiresAt > now)
    ? (membership.tier as Tier)
    : "bronze";

  // إن كان يملك مستوى أعلى: نمدّد عضويته الحالية بدل إهدار القسيمة
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
      codeUsed: membership.codeUsed ?? "promo",
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

  const upgraded = tierIndex(target) > tierIndex(ownedTier);
  const note =
    target !== tier
      ? `لديك مستوى أعلى (${TIER_META[target].name}) — مُدّدت عضويتك الحالية ${days} يوماً`
      : upgraded
        ? `ترقية إلى ${TIER_META[target].name} لمدة ${days} يوم`
        : `تمديد ${TIER_META[target].name} ${days} يوماً`;

  return { expiresAt, upgraded, note };
}

// ═══════════════════════════════════════════════════════════════════════
// 🎟 القسائم الترويجية
// ═══════════════════════════════════════════════════════════════════════

/** إنشاء قسيمة — المالك فقط. الكود يُطبَّع ويُمنع التكرار. */
export const createPromo = mutation({
  args: {
    code: v.string(),
    tier: v.union(
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    days: v.number(),
    maxUses: v.number(),
    perUserLimit: v.optional(v.number()),
    minTier: v.optional(
      v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("diamond"),
        v.literal("exclusive"),
      ),
    ),
    maxTier: v.optional(
      v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("diamond"),
        v.literal("exclusive"),
      ),
    ),
    validDays: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const code = normalizeCode(args.code);
    if (code.length < 4) throw new Error("كود القسيمة قصير جداً — ٤ أحرف على الأقل.");
    if (args.days <= 0) throw new Error("عدد الأيام يجب أن يكون أكبر من صفر.");
    if (args.maxUses <= 0) throw new Error("سقف الاستخدام يجب أن يكون أكبر من صفر.");

    const existing = await ctx.db
      .query("promoCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) throw new Error(`الكود «${code}» مستخدم بالفعل — اختر كوداً آخر.`);

    const id = await ctx.db.insert("promoCodes", {
      code,
      tier: args.tier,
      days: args.days,
      maxUses: Math.min(args.maxUses, 10_000),
      usedCount: 0,
      perUserLimit: Math.max(1, args.perUserLimit ?? 1),
      minTier: args.minTier,
      maxTier: args.maxTier,
      expiresAt: args.validDays && args.validDays > 0 ? Date.now() + args.validDays * DAY : undefined,
      active: true,
      note: args.note,
      createdBy: owner.name ?? "المالك",
      createdAt: Date.now(),
    });

    await logEvent(ctx, {
      userId: undefined,
      actorName: owner.name ?? "المالك",
      kind: "promo",
      tier: args.tier,
      detail: `إصدار قسيمة ${code}: ${tierLabel(args.tier)} لمدة ${args.days} يوم (سقف ${args.maxUses})`,
      days: args.days,
    });

    return { ok: true, id, code };
  },
});

/** قائمة القسائم — المالك فقط، بأحدث ١٠٠ قسيمة. */
export const listPromos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = (await ctx.db.get(userId)) as { role?: string; email?: string } | null;
    if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) return null;

    const rows = await ctx.db.query("promoCodes").order("desc").take(100);
    const now = Date.now();
    return rows.map((r) => ({
      id: String(r._id),
      code: r.code,
      tier: r.tier,
      days: r.days,
      usedCount: r.usedCount,
      maxUses: r.maxUses,
      perUserLimit: r.perUserLimit,
      remaining: Math.max(0, r.maxUses - r.usedCount),
      expired: r.expiresAt != null && r.expiresAt <= now,
      expiresAt: r.expiresAt ?? null,
      active: r.active && !(r.expiresAt != null && r.expiresAt <= now),
      note: r.note ?? null,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));
  },
});

/** إيقاف/تفعيل قسيمة فوراً — المالك فقط. */
export const setPromoActive = mutation({
  args: { code: v.string(), active: v.boolean() },
  handler: async (ctx, { code, active }) => {
    const owner = await requireOwner(ctx);
    const promo = await ctx.db
      .query("promoCodes")
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
      .first();
    if (!promo) throw new Error("القسيمة غير موجودة.");
    await ctx.db.patch(promo._id, { active });
    await logEvent(ctx, {
      actorName: owner.name ?? "المالك",
      kind: "promo",
      tier: promo.tier,
      detail: `${active ? "تفعيل" : "إيقاف"} القسيمة ${promo.code}`,
    });
    return { ok: true, active };
  },
});

/**
 * استبدال قسيمة — كل القيود مُنفَّذة قبل المنح.
 * لا صدفة ولا ثقة بالواجهة: القرار كله على الخادم.
 */
export const redeemPromo = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً لاستبدال القسيمة.");

    const user = (await ctx.db.get(userId)) as { name?: string } | null;
    const displayName = user?.name ?? "لاعب";
    const normalized = normalizeCode(code);
    const now = Date.now();

    const promo = await ctx.db
      .query("promoCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!promo) throw new Error("هذا الكود غير صحيح.");
    if (!promo.active) throw new Error("هذه القسيمة موقوفة.");
    if (promo.expiresAt != null && promo.expiresAt <= now) throw new Error("انتهت صلاحية هذه القسيمة.");
    if (promo.usedCount >= promo.maxUses) throw new Error("استُنفدت هذه القسيمة بالكامل.");

    // سقف لكل لاعب — يُحسب من جدول الاستبدالات الحقيقي
    const mine = await ctx.db
      .query("promoRedemptions")
      .withIndex("by_promo_user", (q) => q.eq("promoId", promo._id).eq("userId", userId))
      .collect();
    if (mine.length >= promo.perUserLimit) {
      throw new Error(
        promo.perUserLimit === 1
          ? "لقد استبدلت هذه القسيمة من قبل — كل لاعب مرة واحدة."
          : `وصلت الحد المسموح لهذه القسيمة (${promo.perUserLimit} مرات).`,
      );
    }

    // نطاق المستويات المؤهّلة
    const resolved = await resolveMembership(ctx, userId);
    if (promo.minTier && tierIndex(resolved.tier) < tierIndex(promo.minTier as Tier)) {
      throw new Error(
        `هذه القسيمة لمستوى ${TIER_META[promo.minTier as Tier].name} أو أعلى — ومستواك الحالي ${TIER_META[resolved.tier].name}.`,
      );
    }
    if (promo.maxTier && tierIndex(resolved.tier) > tierIndex(promo.maxTier as Tier)) {
      throw new Error(
        `هذه القسيمة مخصّصة لمستوى ${TIER_META[promo.maxTier as Tier].name} أو أدنى — وأنت أعلى منها. ` +
          `اتركها لمن يحتاجها 🙂`,
      );
    }

    // المنح الفعلي
    const grant = await applyTierGrant(ctx, userId, promo.tier as Tier, promo.days);

    await ctx.db.patch(promo._id, { usedCount: promo.usedCount + 1 });
    await ctx.db.insert("promoRedemptions", {
      promoId: promo._id,
      userId,
      tier: promo.tier,
      days: promo.days,
      at: now,
    });
    await logEvent(ctx, {
      userId,
      actorName: displayName,
      kind: "promo",
      tier: promo.tier,
      detail: `استبدال القسيمة ${promo.code} — ${grant.note}`,
      days: promo.days,
      expiresAt: grant.expiresAt,
    });

    return {
      ok: true,
      tier: promo.tier,
      days: promo.days,
      expiresAt: grant.expiresAt,
      upgraded: grant.upgraded,
      message: grant.note,
      remainingUses: Math.max(0, promo.maxUses - promo.usedCount - 1),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🧪 التجارب المجانية
// ═══════════════════════════════════════════════════════════════════════

interface TrialOption {
  tier: Tier;
  meta: typeof TIER_META[Tier];
  days: number;
  usable: boolean;
  blockedReason: string | null;
}
interface TrialUsed {
  tier: Tier;
  startedAt: number;
  expiresAt: number;
  expired: boolean;
}
interface TrialStatusResult {
  isSignedIn: boolean;
  gamesPlayed: number;
  minGames: number;
  eligible: boolean;
  available: TrialOption[];
  used: TrialUsed[];
  currentTier: Tier;
}

/** حالة التجارب: ما هو متاح لك الآن، وما استُهلك سابقاً. */
export const getTrialStatus = query({
  args: {},
  handler: async (ctx): Promise<TrialStatusResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        isSignedIn: false,
        gamesPlayed: 0,
        minGames: 5,
        eligible: false,
        available: [],
        used: [],
        currentTier: "bronze",
      };
    }

    const resolved = await resolveMembership(ctx, userId);
    const used = await ctx.db
      .query("membershipTrials")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const usedTiers = new Set(used.map((t) => t.tier));

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const gamesPlayed = profile?.gamesPlayed ?? 0;

    // نشاط حقيقي مطلوب: ٥ جولات على الأقل — التجربة ليست باباً خلفياً
    const MIN_GAMES = 5;
    const eligible = gamesPlayed >= MIN_GAMES;

    const candidates: Tier[] = ["silver", "gold", "diamond", "exclusive"];
    const available = candidates
      .filter((t) => !usedTiers.has(t))
      .filter((t) => tierIndex(resolved.tier) < tierIndex(t))
      .map((t) => {
        const days = entitlementsOf(t).trialDays;
        return {
          tier: t,
          meta: TIER_META[t],
          days,
          usable: days > 0 && eligible,
          blockedReason: days <= 0 ? "هذا المستوى لا يوفّر تجربة مجانية" : !eligible ? `العب ${MIN_GAMES - gamesPlayed} جولات إضافية لفتح التجربة` : null,
        };
      });

    return {
      isSignedIn: true,
      gamesPlayed,
      minGames: MIN_GAMES,
      eligible,
      available,
      used: used.map((t) => ({
        tier: t.tier as Tier,
        startedAt: t.startedAt,
        expiresAt: t.expiresAt,
        expired: t.expiresAt <= Date.now(),
      })),
      currentTier: resolved.tier,
    };
  },
});

/** بدء تجربة — مرة واحدة لكل مستوى، وبحد نشاط حقيقي. */
export const startTrial = mutation({
  args: {
    tier: v.union(v.literal("silver"), v.literal("gold"), v.literal("diamond"), v.literal("exclusive")),
  },
  handler: async (ctx, { tier }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");

    const user = (await ctx.db.get(userId)) as { name?: string } | null;
    const displayName = user?.name ?? "لاعب";
    const now = Date.now();

    const days = entitlementsOf(tier as Tier).trialDays;
    if (days <= 0) throw new Error("هذا المستوى لا يوفّر تجربة مجانية.");

    const previously = await ctx.db
      .query("membershipTrials")
      .withIndex("by_user_tier", (q) => q.eq("userId", userId).eq("tier", tier))
      .first();
    if (previously) throw new Error("استخدمت تجربة هذا المستوى من قبل — كل مستوى مرة واحدة.");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const gamesPlayed = profile?.gamesPlayed ?? 0;
    if (gamesPlayed < 5) {
      throw new Error(`التجربة تُفتح بعد ٥ جولات — لعبت ${gamesPlayed} حتى الآن. العب جولات وعد!`);
    }

    const resolved = await resolveMembership(ctx, userId);
    if (tierIndex(resolved.tier) >= tierIndex(tier as Tier)) {
      throw new Error(
        `مستواك الحالي (${TIER_META[resolved.tier].name}) بالفعل يساوي أو يفوق ${TIER_META[tier as Tier].name}.`,
      );
    }

    const expiresAt = now + days * DAY;
    await ctx.db.insert("membershipTrials", {
      userId,
      tier,
      startedAt: now,
      expiresAt,
      source: "self_service",
    });
    await ctx.db.insert("membershipBoosts", {
      userId,
      tier,
      source: "trial",
      label: `تجربة مجانية ${TIER_META[tier as Tier].name}`,
      startedAt: now,
      expiresAt,
      note: `${days} أيام`,
    });
    await logEvent(ctx, {
      userId,
      actorName: displayName,
      kind: "trial",
      tier,
      detail: `بدء تجربة ${TIER_META[tier as Tier].name} لمدة ${days} يوم`,
      days,
      expiresAt,
    });

    return {
      ok: true,
      tier,
      days,
      expiresAt,
      message: `بدأت تجربتك! امتلكت ${TIER_META[tier as Tier].name} حتى ${new Date(expiresAt).toLocaleDateString("ar-SA")}`,
    };
  },
});
