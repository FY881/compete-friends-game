import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { dailyRewardXp, dayKey } from "./gameConfig";

const DAILY_BADGE_STEPS = [
  { at: 30, id: "daily_30" },
  { at: 7, id: "daily_7" },
  { at: 3, id: "daily_3" },
] as const;

// ---------------------------------------------------------------------------
// Account display name — «العب فوراً باسمك فقط» + «الحساب الذكي».
//
// Both quick-play and the smart account flow let a player pick a nickname
// without touching email. This mutation persists that name on the account so
// the profile page and the global leaderboard show the real name instead of
// «لاعب مجهول», on every device.
// ---------------------------------------------------------------------------

export const setDisplayName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (clean.length < 2) throw new Error("الاسم قصير جداً — 2 أحرف على الأقل");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("الحساب غير موجود");
    if (user.name === clean) return { ok: true };

    await ctx.db.patch(userId, { name: clean });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Avatar emoji — «صورتك الرمزية»: يختار اللاعب رمزاً تعبيرياً يظهر في ملفه.
// ---------------------------------------------------------------------------

export const AVATAR_EMOJIS = [
  "🦅", "🦁", "🐺", "🦊", "🐯", "🦈", "🐉", "🦄", "🐎", "🐪",
  "🤖", "👑", "⚡", "🔥", "🌙", "⭐", "🎯", "🚀", "💎", "🧠",
] as const;

export const setAvatarEmoji = mutation({
  args: { emoji: v.string() },
  handler: async (ctx, { emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clean = emoji.trim().slice(0, 8);
    if (!(AVATAR_EMOJIS as readonly string[]).includes(clean)) {
      throw new Error("اختر رمزاً من قائمة الصور الرمزية.");
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("الحساب غير موجود");
    await ctx.db.patch(userId, { avatarEmoji: clean });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Daily rewards — «المكافأة اليومية»: login streak that grants XP + badges.
// ---------------------------------------------------------------------------

/**
 * Claim today's daily reward. Building a streak (claiming on consecutive
 * days) increases the XP granted, capped, and unlocks streak badges at
 * 3 / 7 / 30 days.
 */
export const claimDailyReward = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    const today = dayKey(now);
    const yesterday = dayKey(now - 24 * 60 * 60 * 1000);

    if (profile?.lastClaimDay === today) {
      throw new Error("حصلت على مكافأة اليوم بالفعل — عد غداً ✨");
    }

    const streak =
      profile?.lastClaimDay === yesterday ? (profile.dailyStreak ?? 0) + 1 : 1;
    const xpEarned = dailyRewardXp(streak);

    const had = new Set(profile?.badges ?? []);
    const next = new Set(had);
    for (const step of DAILY_BADGE_STEPS) {
      if (streak >= step.at) next.add(step.id);
    }
    const badgesEarned = [...next].filter((id) => !had.has(id));

    if (profile) {
      await ctx.db.patch(profile._id, {
        xp: profile.xp + xpEarned,
        dailyStreak: streak,
        lastClaimDay: today,
        badges: [...next],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        xp: xpEarned,
        gamesPlayed: 0,
        gamesWon: 0,
        bestScore: 0,
        bestStreak: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        badges: [...next],
        dailyStreak: streak,
        lastClaimDay: today,
        updatedAt: now,
      });
    }

    return { xpEarned, streak, badgesEarned };
  },
});
