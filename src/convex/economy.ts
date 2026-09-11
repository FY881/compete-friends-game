/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎁 الصندوق الغامض اليومي + اقتصاد المعززات
 *
 *  - صندوق غامض واحد يومياً: نقاط ولاء / خبرة / — بنسب ثابتة عادلة
 *  - جدول dailyBoxes يضمن فتحاً واحداً فقط لكل لاعب في اليوم
 *  - درع السلسلة: يُستخدم تلقائياً عند فوات يوم اللعب ليحفظ السلسلة
 *  - معزز خبرة ×2: يُفعّل لأربع جولات قادمة (تُستهلك تلقائياً)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const BOX_COST = 50; // نقاط ولاء
const MAX_DAILY_BOXES = 1; // صندوق مجاني يومي... نقاطه من الولاء لكن نسمح بواحد يومياً

type Reward =
  | { kind: "loyalty"; amount: number }
  | { kind: "xp"; amount: number }
  | { kind: "xpBoost"; amount: number }
  | { kind: "streakShield" };

/** المكافآت الممكنة بأوزانها — مجموع الأوزان 100 */
const REWARD_TABLE: { weight: number; reward: Reward; label: string; emoji: string }[] = [
  { weight: 30, reward: { kind: "loyalty", amount: 25 }, label: "+25 نقطة ولاء", emoji: "💎" },
  { weight: 22, reward: { kind: "loyalty", amount: 60 }, label: "+60 نقطة ولاء", emoji: "💰" },
  { weight: 20, reward: { kind: "xp", amount: 40 }, label: "+40 خبرة", emoji: "✨" },
  { weight: 12, reward: { kind: "xp", amount: 100 }, label: "+100 خبرة", emoji: "🌟" },
  { weight: 10, reward: { kind: "xpBoost", amount: 4 }, label: "معزز خبرة ×2 لأربع جولات", emoji: "🚀" },
  { weight: 6, reward: { kind: "streakShield" }, label: "درع سلسلة", emoji: "🛡️" },
];

function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rollReward(): (typeof REWARD_TABLE)[number] {
  const total = REWARD_TABLE.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const entry of REWARD_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return REWARD_TABLE[0];
}

// ─────────────────────────────────────────────────────────────────────────
// الحالة اليومية + الفتح
// ─────────────────────────────────────────────────────────────────────────

/** حالة صندوق اليوم: كم صندوقاً فتحته اليوم + جاهزية الفتح. */
export const getDailyBoxStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const today = dayKey();
    const opened = await ctx.db
      .query("dailyBoxes")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .collect();
    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      openedToday: opened.length,
      maxPerDay: MAX_DAILY_BOXES,
      canOpen: opened.length < MAX_DAILY_BOXES,
      points: wallet?.points ?? 0,
      cost: BOX_COST,
    };
  },
});

/** افتح الصندوق اليومي — مرة واحدة كل 24 ساعة، التكلفة نقاط ولاء رمزية. */
export const openDailyBox = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const now = Date.now();
    const today = dayKey(now);

    const opened = await ctx.db
      .query("dailyBoxes")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .collect();
    if (opened.length >= MAX_DAILY_BOXES) {
      throw new Error("فتحت صندوق اليوم بالفعل — عد غداً! 🎁");
    }

    // خصم التكلفة من محفظة الولاء
    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!wallet || wallet.points < BOX_COST) {
      throw new Error(`تحتاج ${BOX_COST} نقطة ولاء لفتح الصندوق — العب جولات لتجمعها!`);
    }
    await ctx.db.patch(wallet._id, { points: wallet.points - BOX_COST, updatedAt: now });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -BOX_COST,
      reason: "فتح الصندوق الغامض اليومي",
      at: now,
    });

    // اسحب المكافأة
    const entry = rollReward();
    const reward = entry.reward;

    let applied: string = entry.label;
    if (reward.kind === "loyalty") {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: reward.amount,
        reason: "🎁 مكافأة الصندوق الغامض",
      });
    } else if (reward.kind === "xp") {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, { xp: profile.xp + reward.amount });
      }
      applied = `+${reward.amount} خبرة أُضيفت لملفك`;
    } else if (reward.kind === "xpBoost") {
      await ctx.db.insert("boosts", {
        userId,
        kind: "xp_x2",
        remainingRounds: reward.amount,
        createdAt: now,
      });
    } else if (reward.kind === "streakShield") {
      await ctx.db.insert("boosts", {
        userId,
        kind: "streak_shield",
        remainingRounds: 1, // درع واحد = يحمي انقطاع يوم واحد
        createdAt: now,
      });
    }

    await ctx.db.insert("dailyBoxes", {
      userId,
      day: today,
      rewardKind: reward.kind,
      rewardLabel: entry.label,
      openedAt: now,
    });

    return {
      emoji: entry.emoji,
      label: applied,
      kind: reward.kind,
      amount: "amount" in reward ? reward.amount : null,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// المعززات — استهلاك تلقائي من games.finishGame
// ─────────────────────────────────────────────────────────────────────────

/** هل لدى اللاعب معزز خبرة نشط؟ (يستهلك واحداً عند النجاح) */
export const consumeXpBoost = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const boost = await ctx.db
      .query("boosts")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", "xp_x2"))
      .order("desc")
      .first();
    if (!boost || boost.remainingRounds <= 0) return false;
    if (boost.remainingRounds <= 1) {
      await ctx.db.delete(boost._id);
    } else {
      await ctx.db.patch(boost._id, { remainingRounds: boost.remainingRounds - 1 });
    }
    return true;
  },
});

/** استخدم درع سلسلة — يُستدعى آلياً عند فوات يوم (من دورة الصيانة). */
export const consumeStreakShield = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const shield = await ctx.db
      .query("boosts")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", "streak_shield"))
      .order("desc")
      .first();
    if (!shield || shield.remainingRounds <= 0) return false;
    await ctx.db.delete(shield._id);
    return true;
  },
});

/** معززاتي النشطة — تظهر في لوحة الولاء. */
export const getMyBoosts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("boosts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((b) => ({
      kind: b.kind,
      remainingRounds: b.remainingRounds,
      createdAt: b.createdAt,
    }));
  },
});
