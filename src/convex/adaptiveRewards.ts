import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { MEMBERSHIP_TIERS } from "./membershipSystem";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔗 المكافآت التكيفية — المرحلة 4: الربط العميق بين الأنظمة
 *
 * مكافأة كل لاعب تُحسب من عوامل حقيقية مترابطة (لا جزر منعزلة):
 *  - التقدم الشخصي: المستوى ونسبة الفوز
 *  - العضوية: كل مستوى يضاعف مضاعِفاً
 *  - النشاط الاجتماعي: عشيرة نشطة / غرف دردشة فعّالة
 *  - الولاء اليومي: سلسلة الأيام
 *  - الإنجاز: الهيبة
 * النتيجة: مضاعف واحد عادل يرفع مكافأة نهاية الجولة، مع شرح واضح للاعب.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ⚠️ مصدر واحد للحقيقة: مضاعفات العضوية تُشتق من كتالوج العضويات الرسمي
// (MEMBERSHIP_TIERS.rewardMultiplier) بدل جدولين متضاربين — كانت الفضية
// ×1.1 هنا و×1.25 في كتالوج العضويات، وهو تضارب حقيقي أُصلح الآن.
const TIER_MULTIPLIER: Record<string, number> = Object.fromEntries(
  MEMBERSHIP_TIERS.map((t) => [t.id, t.rewardMultiplier]),
) as Record<string, number>;

export type AdaptiveBreakdown = {
  base: number; // المكافأة الأساسية (نقاط ولاء)
  multiplier: number; // المضاعف الكلي
  factors: { key: string; label: string; effect: string; value: number }[];
  total: number; // المكافأة النهائية
};

/** حساب المضاعف التكيفي للاعب — دالة مشتركة يستدعيها finishGame */
async function computeMultiplier(
  ctx: any,
  userId: any,
): Promise<AdaptiveBreakdown> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  const user = await ctx.db.get(userId);
  const now = Date.now();

  const factors: AdaptiveBreakdown["factors"] = [];
  let multiplier = 1.0;

  // 1) التقدم: مستوى عالٍ = مكافأة أكبر (حتى +25%)
  const level = Math.floor(Math.sqrt((profile?.xp ?? 0) / 100)) + 1;
  const levelBonus = Math.min(0.25, level * 0.01);
  if (levelBonus > 0) {
    multiplier += levelBonus;
    factors.push({ key: "level", label: "مستواك", effect: `+${Math.round(levelBonus * 100)}%`, value: levelBonus });
  }

  // 2) نسبة الفوز: ثبات التميز يُكافأ (حتى +15%)
  const winRate = profile && profile.gamesPlayed >= 5 ? profile.gamesWon / profile.gamesPlayed : 0;
  const winBonus = Math.min(0.15, winRate * 0.2);
  if (winBonus > 0.05) {
    multiplier += winBonus;
    factors.push({ key: "winrate", label: "نسبة فوزك", effect: `+${Math.round(winBonus * 100)}%`, value: winBonus });
  }

  // 3) العضوية
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
  const tier = membership && (!membership.expiresAt || membership.expiresAt > now) ? membership.tier : "bronze";
  const tierMult = TIER_MULTIPLIER[tier] ?? 1.0;
  if (tierMult > 1.0) {
    multiplier += tierMult - 1.0;
    factors.push({ key: "tier", label: `عضوية ${tier === "exclusive" ? "حصرية" : tier}`, effect: `+${Math.round((tierMult - 1) * 100)}%`, value: tierMult - 1 });
  }

  // 4) النشاط الاجتماعي: عضوية عشيرة نشطة (+10%)
  try {
    const clans = await ctx.db.query("clans").collect();
    const inClan = clans.some((c: any) => (c.members ?? []).some((m: any) => String(m) === String(userId)));
    if (inClan) {
      multiplier += 0.1;
      factors.push({ key: "clan", label: "عضو عشيرة", effect: "+10%", value: 0.1 });
    }
  } catch { /* العشائر اختيارية */ }

  // 5) سلسلة الأيام (حتى +20%)
  const streak = profile?.dailyStreak ?? 0;
  const streakBonus = Math.min(0.2, streak * 0.02);
  if (streakBonus > 0.02) {
    multiplier += streakBonus;
    factors.push({ key: "streak", label: `سلسلة ${streak} يوم`, effect: `+${Math.round(streakBonus * 100)}%`, value: streakBonus });
  }

  // 6) الهيبة (حتى +15%)
  const prestige = (user as any)?.prestigePoints ?? 0;
  const prestigeBonus = Math.min(0.15, prestige * 0.015);
  if (prestigeBonus > 0.01) {
    multiplier += prestigeBonus;
    factors.push({ key: "prestige", label: "نقاط الهيبة", effect: `+${Math.round(prestigeBonus * 100)}%`, value: prestigeBonus });
  }

  // 7) 🎛️ مرسوم الحاكم السيادي التنفيذي — سلطة حقيقية تغيّر المكافآت فعلياً
  // هذا ليس سجلاً للقراءة: مرسوم reward_override النافذ يعدّل مضاعف كل
  // مكافأة تكيفية في كل جولة لحظياً، بصوت السلطة العليا.
  try {
    const levers = (await ctx.runQuery(internal.sovereignGovernor.getControlLeversInternal, {})) as {
      rewardAdjust: number;
      activeEdict: { title: string } | null;
    };
    if (levers.rewardAdjust !== 0) {
      multiplier += levers.rewardAdjust;
      factors.push({
        key: "sovereign",
        label: "⚖️ مرسوم الحاكم السيادي",
        effect: `${levers.rewardAdjust > 0 ? "+" : ""}${Math.round(levers.rewardAdjust * 100)}%`,
        value: levers.rewardAdjust,
      });
    }
  } catch { /* الأذرع اختيارية — لا تُعطل المكافأة */ }

  return {
    base: 0,
    multiplier: Math.round(multiplier * 100) / 100,
    factors,
    total: 0,
  };
}

/** ما هي مكافأتي التكيفية المتوقعة؟ — للاعب (شفافية كاملة) */
export const getMyAdaptiveReward = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const breakdown = await computeMultiplier(ctx, userId);
    return breakdown;
  },
});

/** تطبيق المكافأة التكيفية بعد جولة — يستدعيه finishGame */
export const grantAdaptiveReward = internalMutation({
  args: {
    userId: v.id("users"),
    won: v.boolean(),
    score: v.number(),
  },
  handler: async (ctx, { userId, won, score }) => {
    const breakdown = await computeMultiplier(ctx, userId);

    // القاعدة: 10 نقاط للمشاركة + 15 للفوز + دقة النتيجة
    const base = 10 + (won ? 15 : 0) + Math.min(25, Math.floor(score / 40));
    const total = Math.round(base * breakdown.multiplier);
    if (total <= 0) return { granted: 0 };

    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: total,
      reason: `مكافأة تكيفية (مضاعف ×${breakdown.multiplier})`,
      at: Date.now(),
    });

    // رصيد المحفظة — عبر نظام الولاء الموجود
    try {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: total,
        reason: `مكافأة تكيفية (×${breakdown.multiplier})`,
      });
    } catch { /* المحفظة اختيارية */ }

    return { granted: total, multiplier: breakdown.multiplier };
  },
});
