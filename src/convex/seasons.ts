import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════════
// SEASONS & ACHIEVEMENTS SYSTEM
// Uses existing "seasons" table (startAt, endAt, name, number, active, rewards)
// Uses "users" table for XP/level/achievements data
// ═══════════════════════════════════════════════════════════════════════

/** Get active season */
export const getActiveSeason = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const seasons = await ctx.db.query("seasons").collect();
    const active = seasons.find(
      (s) => s.active && s.startAt <= now && s.endAt >= now
    );
    return active ?? null;
  },
});

/** Get all seasons */
export const getAllSeasons = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("seasons").order("desc").take(10);
  },
});

/** Get season leaderboard - uses users table with xp fields */
export const getSeasonLeaderboard = query({
  args: { seasonNumber: v.number() },
  handler: async (ctx, args) => {
    const season = await ctx.db
      .query("seasons")
      .filter((q) => q.eq(q.field("number"), args.seasonNumber))
      .first();
    if (!season) return [];

    const users = await ctx.db.query("users").collect();
    const players = users
      .filter((u) => (u as Record<string, unknown>).totalXp !== undefined)
      .map((u) => ({
        userId: u._id,
        name: u.name ?? "مجهول",
        avatar: u.avatarEmoji ?? "🧠",
        totalXp: ((u as Record<string, unknown>).totalXp as number) ?? 0,
        level: ((u as Record<string, unknown>).level as number) ?? 1,
      }))
      .sort((a, b) => b.totalXp - a.totalXp)
      .slice(0, 20);
    return players;
  },
});

/** Create season (owner only) */
export const createSeason = mutation({
  args: {
    name: v.string(),
    number: v.number(),
    startAt: v.number(),
    endAt: v.number(),
    rewards: v.array(
      v.object({
        xp: v.number(),
        rank: v.number(),
        badge: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("غير مصرح");

    const user = await ctx.db.get(identity.subject as any);
    if (!user || (user as Record<string, unknown>).role !== "admin") {
      throw new Error("غير مصرح");
    }

    const seasonId = await ctx.db.insert("seasons", {
      name: args.name,
      number: args.number,
      startAt: args.startAt,
      endAt: args.endAt,
      rewards: args.rewards,
      active: true,
    });

    return { success: true, seasonId };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ACHIEVEMENTS - defined as constants, checked against users table
// ═══════════════════════════════════════════════════════════════════════

const ALL_ACHIEVEMENTS = [
  { id: "first_win", name: "أول نصر", icon: "🏆", desc: "أكمل أول تحدي بنجاح", xpReward: 50 },
  { id: "streak_3", name: "سلسلة نارية", icon: "🔥", desc: "حصّل 3 سلاسل يومية", xpReward: 100 },
  { id: "streak_7", name: "سلسلة أسبوعية", icon: "⚡", desc: "حصّل 7 سلاسل يومية", xpReward: 300 },
  { id: "streak_30", name: "إمبراطور الإصرار", icon: "👑", desc: "حصّل 30 سلسلة يومية", xpReward: 1000 },
  { id: "games_10", name: "لاعب نشط", icon: "🎮", desc: "العب 10 ألعاب", xpReward: 75 },
  { id: "games_50", name: "محترف الألعاب", icon: "🎯", desc: "العب 50 لعبة", xpReward: 250 },
  { id: "games_100", name: "أسطورة اللعب", icon: "🌟", desc: "العب 100 لعبة", xpReward: 500 },
  { id: "perfect_5", name: "ذكاء خارق", icon: "🧠", desc: "5 أسئلة صحيحة متتالية", xpReward: 200 },
  { id: "perfect_10", name: "عبقري", icon: "💎", desc: "10 أسئلة صحيحة متتالية", xpReward: 500 },
  { id: "speed_demon", name: "شيطان السرعة", icon: "⚡", desc: "إجابة في أقل من 3 ثوانٍ", xpReward: 150 },
  { id: "social_butterfly", name: "فراشة اجتماعية", icon: "🦋", desc: "أرسل 50 رسالة", xpReward: 100 },
  { id: "gift_giver", name: "كريم", icon: "🎁", desc: "أرسل 10 هدايا", xpReward: 150 },
  { id: "gift_receiver", name: "محبوب", icon: "❤️", desc: "تلقّى 10 هدايا", xpReward: 150 },
  { id: "night_owl", name: "بومة الليل", icon: "🦉", desc: "العب بين 12-5 صباحاً", xpReward: 100 },
  { id: "early_bird", name: "طائر الفجر", icon: "🐦", desc: "العب بين 5-7 صباحاً", xpReward: 100 },
  { id: "first_duel", name: "محارب", icon: "⚔️", desc: "أكمل أول تحدي 1v1", xpReward: 100 },
  { id: "duel_streak_5", name: "سلسلة المبارزات", icon: "🗡️", desc: "اربح 5 مبارزات متتالية", xpReward: 300 },
  { id: "top_10", name: "قمة الشرف", icon: "🏅", desc: "ادخل أعلى 10 في لوحة الشرف", xpReward: 400 },
];

/** Get all achievements for current user */
export const getPlayerAchievements = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db.get(identity.subject as any);
    if (!user) return [];

    const earned = ((user as Record<string, unknown>).achievements as string[]) ?? [];

    return ALL_ACHIEVEMENTS.map((a) => ({
      ...a,
      earned: earned.includes(a.id),
    }));
  },
});

/** Record game completion for achievements tracking */
export const recordGameCompletion = mutation({
  args: {
    gameType: v.string(),
    score: v.number(),
    correct: v.number(),
    total: v.number(),
    timeSpent: v.number(),
    isPerfect: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject as any;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const userData = user as Record<string, unknown>;
    const achievements = [...((userData.achievements as string[]) ?? [])];
    const stats = ((userData.gameStats as Record<string, number>) ?? {}) as Record<string, number>;
    let newAchievement: string | null = null;

    const totalGames = (stats.totalGames ?? 0) + 1;
    const totalCorrect = (stats.totalCorrect ?? 0) + args.correct;
    const perfectStreak = args.isPerfect ? (stats.perfectStreak ?? 0) + 1 : 0;

    const newStats: Record<string, number> = { ...stats, totalGames, totalCorrect, perfectStreak };

    if (totalGames === 1 && !achievements.includes("first_win")) {
      achievements.push("first_win");
      newAchievement = "first_win";
    }
    if (totalGames >= 10 && !achievements.includes("games_10")) {
      achievements.push("games_10");
      newAchievement = "games_10";
    }
    if (totalGames >= 50 && !achievements.includes("games_50")) {
      achievements.push("games_50");
      newAchievement = "games_50";
    }
    if (totalGames >= 100 && !achievements.includes("games_100")) {
      achievements.push("games_100");
      newAchievement = "games_100";
    }
    if (perfectStreak >= 5 && !achievements.includes("perfect_5")) {
      achievements.push("perfect_5");
      newAchievement = "perfect_5";
    }
    if (perfectStreak >= 10 && !achievements.includes("perfect_10")) {
      achievements.push("perfect_10");
      newAchievement = "perfect_10";
    }
    if (args.timeSpent < 3 && args.correct > 0 && !achievements.includes("speed_demon")) {
      achievements.push("speed_demon");
      newAchievement = "speed_demon";
    }

    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5 && !achievements.includes("night_owl")) {
      achievements.push("night_owl");
      newAchievement = "night_owl";
    }
    if (hour >= 5 && hour < 7 && !achievements.includes("early_bird")) {
      achievements.push("early_bird");
      newAchievement = "early_bird";
    }

    if (achievements.length >= 10 && !achievements.includes("collector")) {
      achievements.push("collector");
      newAchievement = "collector";
    }

    await ctx.db.patch(userId, {
      achievements,
      gameStats: newStats,
    } as any);

    return { newAchievement, totalAchievements: achievements.length };
  },
});
