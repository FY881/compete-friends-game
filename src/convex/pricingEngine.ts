import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 💰 محرّك التسعير الحقيقي — يربط المتجر بالاقتصاد والعضوية والنشاط
 *
 *  المشكلتان اللتان يحلّهما:
 *   1. أرصدة coins/gems كانت **مشتقة للعرض فقط**: لا يوجد أي خصم عند الشراء،
 *      فالأسعار كانت زخرفية. الآن كل شراء يُخصم من رصيد حقيقي ومسجَّل.
 *   2. المتجر كان **جزيرة معزولة**: لا يعرف العضوية ولا نشاط اللاعب. الآن
 *      السعر الفعلي = الأساس − خصم العضوية − خصم النشاط، بتفصيل شفّاف للاعب.
 *
 *  كل الأرقام محسوبة من بيانات حقيقية: memberships، gameHistory، storeLedger.
 * ═══════════════════════════════════════════════════════════════════════
 */

const TIER_DISCOUNT: Record<string, number> = {
  bronze: 5,
  silver: 10,
  gold: 15,
  diamond: 20,
  exclusive: 25,
};

const TIER_LABEL: Record<string, string> = {
  bronze: "برونزية",
  silver: "فضية",
  gold: "ذهبية",
  diamond: "ماسية",
  exclusive: "حصرية",
};

const TIER_RANK: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 4,
  exclusive: 5,
};

/** خصم النشاط — مبني على عدد الجولات الحقيقية في آخر 7 أيام */
const ACTIVITY_TIERS = [
  { minRounds: 20, pct: 8, label: "لاعب يومي مخلص" },
  { minRounds: 10, pct: 5, label: "نشاط مرتفع" },
  { minRounds: 3, pct: 2, label: "نشاط منتظم" },
];

const MAX_TOTAL_DISCOUNT = 40;

export type Currency = "coins" | "gems";

/** عضوية اللاعب الفعلية (غير منتهية) */
async function membership(ctx: any, userId: any) {
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!m) return null;
  if (m.expiresAt && m.expiresAt <= Date.now()) return null;
  return m as { tier: string };
}

/**
 * الأرصدة الحقيقية = المُكتسب (من اللعب والإنجازات) − المنفَق (من سجل المتجر).
 * هذا هو المصدر الوحيد للحقيقة: الاستعلام والدفع يستخدمان نفس الدالة.
 */
export async function getBalancesFor(ctx: any, userId: any) {
  const [games, achievements, spendRows] = await Promise.all([
    ctx.db.query("gameHistory").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(),
    ctx.db.query("achievements").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(),
    ctx.db.query("storeLedger").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(),
  ]);

  const totalXp = games.reduce((sum: number, g: any) => sum + (g.score ?? 0), 0);
  const coinsEarned = Math.floor(totalXp / 10);

  const gemsEarned =
    achievements.filter((a: any) => a.rarity === "legendary").length * 50 +
    achievements.filter((a: any) => a.rarity === "epic").length * 20;

  const spentOf = (cur: Currency) =>
    spendRows.filter((r: any) => r.currency === cur).reduce((s: number, r: any) => s + r.amount, 0);

  const coinsSpent = spentOf("coins");
  const gemsSpent = spentOf("gems");

  return {
    coinsEarned,
    coinsSpent,
    coinsAvailable: Math.max(0, coinsEarned - coinsSpent),
    gemsEarned,
    gemsSpent,
    gemsAvailable: Math.max(0, gemsEarned - gemsSpent),
  };
}

/** خصم النشاط الحقيقي من سجل الجولات */
async function activityDiscount(ctx: any, userId: any): Promise<{ pct: number; label: string; rounds: number }> {
  const since = Date.now() - 7 * 86400_000;
  const games = await ctx.db
    .query("gameHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const rounds = games.filter((g: any) => (g.playedAt ?? g._creationTime ?? 0) >= since).length;
  const tier = ACTIVITY_TIERS.find((t) => rounds >= t.minRounds);
  return tier
    ? { pct: tier.pct, label: tier.label, rounds }
    : { pct: 0, label: "نشاط منخفض هذا الأسبوع", rounds };
}

/**
 * السعر الفعلي بتفصيل كامل — نفس الدالة تُستخدم في العرض وفي الخصم،
 * فلا يمكن أن يرى اللاعب سعراً ويُخصم منه سعر آخر.
 */
export async function computePricing(ctx: any, userId: any, basePrice: number) {
  const [mem, act] = await Promise.all([membership(ctx, userId), activityDiscount(ctx, userId)]);
  const memberPct = mem ? (TIER_DISCOUNT[mem.tier] ?? 0) : 0;
  const totalPct = Math.min(MAX_TOTAL_DISCOUNT, memberPct + act.pct);
  const discount = Math.round((basePrice * totalPct) / 100);
  const final = Math.max(1, basePrice - discount);

  const reasons: string[] = [];
  if (memberPct > 0) reasons.push(`عضوية ${TIER_LABEL[mem!.tier]} −${memberPct}%`);
  if (act.pct > 0) reasons.push(`${act.label} (${act.rounds} جولة/أسبوع) −${act.pct}%`);
  if (reasons.length === 0) reasons.push("لا خصومات — فعّل عضويتك أو العب أكثر لتوفّر");

  return {
    basePrice,
    memberPct,
    memberTier: mem?.tier ?? null,
    activityPct: act.pct,
    activityRounds: act.rounds,
    totalPct,
    discount,
    finalPrice: final,
    reasons,
  };
}

/** يخصم مبلغاً من رصيد حقيقي — يفشل بوضوح إذا كان الرصيد لا يكفي */
export async function chargeCurrency(
  ctx: any,
  userId: any,
  currency: Currency,
  amount: number,
  reason: string,
  itemId?: string,
) {
  const b = await getBalancesFor(ctx, userId);
  const available = currency === "coins" ? b.coinsAvailable : b.gemsAvailable;
  if (amount > available) {
    const missing = amount - available;
    const unit = currency === "coins" ? "عملة" : "جوهرة";
    throw new Error(
      `رصيدك لا يكفي: تحتاج ${amount} ${unit} ولديك ${available} — ينقصك ${missing}. العب جولات وأكمل إنجازاتك لتزيد رصيدك.`,
    );
  }
  await ctx.db.insert("storeLedger", {
    userId,
    currency,
    amount,
    reason,
    itemId,
    at: Date.now(),
  });
  return { ok: true as const, charged: amount, remaining: available - amount };
}

/** بوابة المستوى — تُنفَّذ فعلاً على العناصر التي تشترط مستوى */
export function assertLevel(requiredLevel: number | undefined, currentLevel: number, itemName: string) {
  if (requiredLevel && currentLevel < requiredLevel) {
    throw new Error(`«${itemName}» يتطلب المستوى ${requiredLevel} — مستواك الحالي ${currentLevel}.`);
  }
}

/** بوابة العضوية — تُنفَّذ فعلاً على الحزم التي تشترط رتبة */
export function assertTier(requiredTier: string | undefined, tier: string | null, name: string) {
  if (!requiredTier) return;
  const have = tier ? (TIER_RANK[tier] ?? 0) : 0;
  const need = TIER_RANK[requiredTier] ?? 0;
  if (have < need) {
    throw new Error(`«${name}» يتطلب عضوية ${TIER_LABEL[requiredTier] ?? requiredTier} أو أعلى — لا تملك عضوية نشطة.`);
  }
}

/** لوحة الأسعار والرصيد للاعب — شفافية كاملة لما يدفعه ولماذا */
export const getMyPricing = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [mem, balances, sample] = await Promise.all([
      membership(ctx, userId),
      getBalancesFor(ctx, userId),
      computePricing(ctx, userId, 1000),
    ]);
    return {
      tier: mem?.tier ?? null,
      tierLabel: mem ? (TIER_LABEL[mem.tier] ?? mem.tier) : null,
      memberPct: sample.memberPct,
      activityPct: sample.activityPct,
      activityRounds: sample.activityRounds,
      totalPct: sample.totalPct,
      reasons: sample.reasons,
      balances,
    };
  },
});

/** رتبة عضوية اللاعب الحالية (أو null) — للاستخدام في بوابات المتجر */
export async function memberTier(ctx: any, userId: any): Promise<string | null> {
  const m = await membership(ctx, userId);
  return m?.tier ?? null;
}

export const CURRENCY_VALIDATOR = v.union(v.literal("coins"), v.literal("gems"));
export { TIER_DISCOUNT, TIER_LABEL, MAX_TOTAL_DISCOUNT };
