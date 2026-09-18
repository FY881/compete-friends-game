import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { DAY, TIER_META, TIER_ORDER, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛒 متجر العضويات — شراء أيام ترقية بنقاط الولاء (اقتصاد حقيقي مغلق)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل عملية هنا **حقيقية بالكامل**:
 *   1. تُخصم نقاط الولاء فعلاً من محفظة اللاعب (عبر loyalty.spendPoints).
 *   2. تُرقّى العضوية أو تُمَدَّد فعلاً في جدول memberships.
 *   3. يُكتب أثر دائم في membershipEvents.
 *
 * ولا تُقبل القفزة فوق المستوى المملوك (لا دفع مزدوج لنفس الميزة).
 */

/** المستويات القابلة للشراء — البرونزي هو الأساس المجاني دائماً. */
export const PURCHASABLE_TIERS: readonly Tier[] = ["silver", "gold", "diamond", "exclusive"];

export const PACKAGE_DAYS = [7, 30, 90] as const;
export type PackageDays = (typeof PACKAGE_DAYS)[number];

/**
 * جدول الأسعار بنقاط الولاء — الاقتصاد مغلق: لا مال حقيقي، فقط نشاطك.
 * كل سعر مصمّم ليكون قابلاً للوصول باللعب المنتظم، لا بالدفع.
 */
export const PRICE_TABLE: Record<Exclude<Tier, "bronze">, Record<PackageDays, number>> = {
  silver: { 7: 120, 30: 450, 90: 1150 },
  gold: { 7: 280, 30: 1000, 90: 2600 },
  diamond: { 7: 480, 30: 1750, 90: 4500 },
  exclusive: { 7: 800, 30: 2900, 90: 7500 },
};

/** يحسب السعر بعد خصم العضوية الحالية (storeDiscountPct). */
export function priceFor(tier: Exclude<Tier, "bronze">, days: PackageDays, discountPct: number) {
  const base = PRICE_TABLE[tier][days];
  const discount = Math.round((base * Math.max(0, Math.min(90, discountPct))) / 100);
  return { base, discount, final: Math.max(0, base - discount) };
}

/** أثر دائم في سجل أحداث العضوية. */
async function logEvent(
  ctx: any,
  args: {
    userId?: string;
    actorName: string;
    kind: string;
    tier?: Tier;
    detail: string;
    points?: number;
    days?: number;
    expiresAt?: number;
  },
) {
  await ctx.db.insert("membershipEvents", {
    userId: args.userId as never,
    actorName: args.actorName,
    kind: args.kind,
    tier: args.tier,
    detail: args.detail,
    points: args.points,
    days: args.days,
    expiresAt: args.expiresAt,
    at: Date.now(),
  });
}

/** عرض المتجر: كل المستويات، أسعارها، خصمك، وميزانيتك الحقيقية. */
export const getStoreListing = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const resolved = userId
      ? await resolveMembership(ctx, userId)
      : { tier: "bronze" as Tier, paidTier: "bronze" as Tier, expiresAt: null };

    const ents = entitlementsOf(resolved.tier);

    let points = 0;
    if (userId) {
      const wallet = await ctx.db
        .query("loyaltyWallets")
        .withIndex("by_user", (q) => q.eq("userId", userId as never))
        .first();
      points = wallet?.points ?? 0;
    }

    const packages = PACKAGE_DAYS.map((days) => ({
      days,
      label: days === 7 ? "أسبوع" : days === 30 ? "شهر" : "٣ أشهر",
    }));

    const offers = PURCHASABLE_TIERS.map((tier) => {
      const key = tier as Exclude<Tier, "bronze">;
      const prices = packages.map((p) => {
        const { base, discount, final } = priceFor(key, p.days, ents.storeDiscountPct);
        return {
          days: p.days,
          label: p.label,
          base,
          discount,
          final,
          affordable: points >= final,
          perDay: Math.round(final / p.days),
        };
      });
      return {
        tier,
        meta: TIER_META[tier],
        entitlements: entitlementsOf(tier),
        prices,
        owned: tierIndex(resolved.paidTier) >= tierIndex(tier) && resolved.paidTier === tier,
        belowOwned: tierIndex(resolved.paidTier) > tierIndex(tier),
      };
    });

    return {
      points,
      discountPct: ents.storeDiscountPct,
      currentTier: resolved.tier,
      paidTier: resolved.paidTier,
      offers,
      packages,
      isSignedIn: userId !== null,
    };
  },
});

/**
 * شراء أيام ترقية — ذرّي بالكامل: الخصم والترقية في عملية واحدة.
 * يرفض إن كانت النقاط غير كافية أو كان اللاعب يملك مستوى أعلى بالفعل.
 */
export const buyTierDays = mutation({
  args: {
    tier: v.union(
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    days: v.union(v.literal(7), v.literal(30), v.literal(90)),
  },
  handler: async (ctx, { tier, days }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً لشراء عضوية.");

    const user = (await ctx.db.get(userId)) as { name?: string } | null;
    const displayName = user?.name ?? "لاعب";

    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);

    if (tierIndex(resolved.paidTier) > tierIndex(tier)) {
      throw new Error(
        `أنت تملك ${TIER_META[resolved.paidTier].name} بالفعل — وهذا أعلى من ${TIER_META[tier].name}. ` +
          `لا داعي للدفع مقابل ميزات أقل.`,
      );
    }

    const key = tier as Exclude<Tier, "bronze">;
    const { base, discount, final } = priceFor(key, days as PackageDays, ents.storeDiscountPct);

    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const balance = wallet?.points ?? 0;
    if (balance < final) {
      throw new Error(
        `نقاط الولاء غير كافية — تحتاج ${final} نقطة ولديك ${balance}. ` +
          `العب جولات وارفع ولاءك ثم عد.`,
      );
    }

    // 1) الخصم الحقيقي (يُسجَّل في دفتر الولاء)
    const reason = `شراء عضوية ${TIER_META[tier].name} لمدة ${days} يوم${
      discount > 0 ? ` (خصم ${ents.storeDiscountPct}% = ${discount} نقطة)` : ""
    }`;
    await ctx.runMutation(internal.loyalty.spendPoints, { userId, amount: final, reason });

    // 2) ترقية/تمديد حقيقي
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const now = Date.now();
    const sameTier = membership && membership.tier === tier;
    const stillActive = membership?.expiresAt && membership.expiresAt > now;
    const baseTime = sameTier && stillActive ? (membership!.expiresAt as number) : now;
    const expiresAt = baseTime + days * DAY;

    if (membership) {
      await ctx.db.patch(membership._id, {
        tier,
        activatedAt: sameTier && stillActive ? membership.activatedAt : now,
        expiresAt,
        codeUsed: membership.codeUsed ?? "store:loyalty",
      });
    } else {
      await ctx.db.insert("memberships", {
        userId,
        tier,
        activatedAt: now,
        expiresAt,
        features: [],
      });
    }

    const action = sameTier && stillActive ? "renew" : "purchase";
    const detail = sameTier && stillActive
      ? `تمديد عضوية ${TIER_META[tier].name} ${days} يوماً — تنتهي ${new Date(expiresAt).toLocaleDateString("ar-SA")}`
      : `ترقية إلى ${TIER_META[tier].name} لمدة ${days} يوم — تنتهي ${new Date(expiresAt).toLocaleDateString("ar-SA")}`;

    await logEvent(ctx, {
      userId,
      actorName: displayName,
      kind: action,
      tier,
      detail,
      points: -final,
      days,
      expiresAt,
    });

    return {
      ok: true,
      tier,
      expiresAt,
      spent: final,
      basePrice: base,
      discount,
      balanceAfter: balance - final,
      detail,
    };
  },
});

/** سجل أحداث العضوية للاعب نفسه — شفافية كاملة بلا جمع جداول كبيرة. */
export const getMyMembershipHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const take = Math.min(Math.max(limit ?? 25, 1), 60);
    const rows = await ctx.db
      .query("membershipEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(take);
    return rows.map((r) => ({
      id: String(r._id),
      kind: r.kind,
      tier: r.tier ?? null,
      detail: r.detail,
      points: r.points ?? null,
      days: r.days ?? null,
      at: r.at,
    }));
  },
});

/** ترقية إدارية من المالك/النائب — تمنح المستوى مباشرة بأثر دائم. */
export const ownerSetTier = internalMutation({
  args: {
    targetUserId: v.id("users"),
    tier: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    days: v.number(),
    actorName: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { targetUserId, tier, days, actorName, note }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .first();
    const expiresAt = days > 0 ? now + days * DAY : undefined;

    if (existing) {
      await ctx.db.patch(existing._id, { tier, activatedAt: now, expiresAt });
    } else {
      await ctx.db.insert("memberships", {
        userId: targetUserId,
        tier,
        activatedAt: now,
        expiresAt,
        features: [],
      });
    }

    const detail = `تعيين مستوى ${TIER_META[tier].name}${
      days > 0 ? ` لمدة ${days} يوم` : " بشكل دائم"
    }${note ? ` — ${note}` : ""}`;
    await logEvent(ctx, { userId: targetUserId, actorName, kind: "upgrade", tier, detail, days, expiresAt });
    return { ok: true, tier, expiresAt };
  },
});

/** قائمة كل مستويات اللعبة — تُستخدم في لوحات الإدارة. */
export const getPurchasableTiers = query({
  args: {},
  handler: async () =>
    TIER_ORDER.filter((t) => t !== "bronze").map((tier) => ({
      tier,
      meta: TIER_META[tier],
      entitlements: entitlementsOf(tier),
      prices: PACKAGE_DAYS.map((d) => ({
        days: d,
        points: PRICE_TABLE[tier as Exclude<Tier, "bronze">][d],
      })),
    })),
});
