import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { dailyRewardXp, dayKey, levelFromXp, levelTitle, xpToReachLevel } from "./gameConfig";

// ---------------------------------------------------------------------------
// Badge catalog — shared by the server (awards) and the client (rendering).
// ---------------------------------------------------------------------------

export type Badge = {
  id: string;
  name: string;
  description: string;
  emoji: string;
};

export const BADGES: Badge[] = [
  { id: "first_win", name: "أول فوز", description: "ارتقِ إلى قمة الترتيب في أي جولة", emoji: "🏆" },
  { id: "streak_3", name: "سلسلة ذهبية", description: "3 إجابات صحيحة متتالية في جولة واحدة", emoji: "🔥" },
  { id: "streak_5", name: "سلسلة أسطورية", description: "5 إجابات صحيحة متتالية في جولة واحدة", emoji: "⚡" },
  { id: "perfect", name: "الكمال", description: "أجب عن كل الأسئلة في جولة واحدة بشكل صحيح", emoji: "🎯" },
  { id: "fast", name: "يد سريعة", description: "أجب بشكل صحيح خلال 3 ثوانٍ أو أقل", emoji: "🚀" },
  { id: "games_10", name: "منافس نشط", description: "شارك في 10 جولات", emoji: "🎮" },
  { id: "games_50", name: "مخضرم", description: "شارك في 50 جولة", emoji: "👑" },
  { id: "answers_100", name: "موسوعة", description: "أجب صحيحاً عن 100 سؤال", emoji: "📚" },
  { id: "wins_5", name: "بطل متوّج", description: "اربح 5 جولات في المجمل", emoji: "🥇" },
  { id: "level_10", name: "الذكاء", description: "صل إلى المستوى 10", emoji: "💎" },
  { id: "speed_demon", name: "سهم خاطف", description: "أجب عن كل الأسئلة صحيحاً في نصف الوقت", emoji: "🏹" },
  { id: "first_blood", name: "الضربة الأولى", description: "كن أول من يجيب صحيحاً في أي سؤال", emoji: "⚔️" },
  { id: "golden_answer", name: "الإجابة الذهبية", description: "أجب صحيحاً عن السؤال الذهبي الأخير (نقاط مضاعفة)", emoji: "🌟" },
  { id: "blowout", name: "الحسم الساحق", description: "اربح بفارق 200+ نقطة عن صاحب المركز الثاني", emoji: "💥" },
  { id: "daily_3", name: "مواظب", description: "استلم المكافأة اليومية 3 أيام متتالية", emoji: "📅" },
  { id: "daily_7", name: "أسبوع العباقرة", description: "استلم المكافأة اليومية 7 أيام متتالية", emoji: "🗓️" },
  { id: "daily_30", name: "شهر النخبة", description: "استلم المكافأة اليومية 30 يوماً متتالياً", emoji: "👑" },
  { id: "daily_first", name: "فتّاحة التحدي", description: "أنجز تحدي اليوم لأول مرة", emoji: "🌅" },
  { id: "daily_perfect", name: "الكمال اليومي", description: "أجب عن جميع أسئلة تحدي اليوم بشكل صحيح", emoji: "💯" },
  { id: "daily_7_days", name: "أسبوع التحديات", description: "أنجز تحدي اليوم في 7 أيام مختلفة", emoji: "📆" },
  { id: "games_25", name: "محارب الحلبة", description: "شارك في 25 جولة", emoji: "⚔️" },
  { id: "wins_10", name: "العقل المدبّر", description: "اربح 10 جولات في المجمل", emoji: "🧠" },
  { id: "level_20", name: "الذكاء الخارق", description: "صل إلى المستوى 20", emoji: "🔮" },
  { id: "level_50", name: "عبقري مطلق", description: "صل إلى المستوى 50", emoji: "👑" },
  { id: "sniper", name: "قنّاص", description: "أجب صحيحاً خلال ثانية واحدة أو أقل", emoji: "🎯" },
  { id: "night_owl", name: "بومة الليل", description: "أنهِ جولة بين منتصف الليل والفجر", emoji: "🦉" },
  { id: "comeback_win", name: "العودة الأسطورية", description: "اربح بعد أن كنت متأخراً في منتصف الجولة", emoji: "🐉" },
];

export const BADGE_MAP: Record<string, Badge> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type ProfileStats = {
  xp: number;
  level: number;
  levelTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  bestScore: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number;
  avgRank: number | null; // متوسط المركز عبر كل الجولات
  fastestAnswerMs: number | null;
  badges: Badge[];
  // Daily rewards
  dailyStreak: number; // consecutive claimed days
  canClaimDaily: boolean; // reward is waiting for today
  nextDailyRewardXp: number; // XP the next claim grants
  firstGameOfDayDone: boolean; // played the first round of today already
};

/** The signed-in user's profile, with derived stats for the profile page. */
export const getMyProfile = query({
  args: {},
  handler: async (ctx): Promise<ProfileStats | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const today = dayKey(Date.now());

    if (!profile) {
      return {
        xp: 0,
        level: 1,
        levelTitle: levelTitle(1),
        xpIntoLevel: 0,
        xpForNextLevel: 100,
        gamesPlayed: 0,
        gamesWon: 0,
        winRate: 0,
        bestScore: 0,
        bestStreak: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        accuracy: 0,
        avgRank: null,
        fastestAnswerMs: null,
        badges: [],
        dailyStreak: 0,
        canClaimDaily: true,
        nextDailyRewardXp: dailyRewardXp(1),
        firstGameOfDayDone: false,
      };
    }

    const level = levelFromXp(profile.xp);
    const levelStart = xpToReachLevel(level); // xp needed to enter this level
    const levelEnd = xpToReachLevel(level + 1); // xp needed for the next level

    // متوسط المركز عبر كل الجولات (أقل = أفضل).
    const historyRows = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const avgRank =
      historyRows.length > 0
        ? Math.round(
            (historyRows.reduce((sum, r) => sum + r.rank, 0) / historyRows.length) * 10,
          ) / 10
        : null;

    return {
      xp: profile.xp,
      level,
      levelTitle: levelTitle(level),
      xpIntoLevel: profile.xp - levelStart,
      xpForNextLevel: Math.max(1, levelEnd - levelStart),
      gamesPlayed: profile.gamesPlayed,
      gamesWon: profile.gamesWon,
      winRate:
        profile.gamesPlayed > 0
          ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
          : 0,
      bestScore: profile.bestScore,
      bestStreak: profile.bestStreak,
      correctAnswers: profile.correctAnswers,
      totalAnswers: profile.totalAnswers,
      accuracy:
        profile.totalAnswers > 0
          ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
          : 0,
      avgRank,
      fastestAnswerMs: profile.fastestAnswerMs ?? null,
      badges: profile.badges.map((id) => BADGE_MAP[id]).filter(Boolean),
      dailyStreak: profile.dailyStreak ?? 0,
      canClaimDaily: profile.lastClaimDay !== today,
      nextDailyRewardXp: dailyRewardXp((profile.dailyStreak ?? 0) + 1),
      firstGameOfDayDone: profile.lastPlayedDay === today,
    };
  },
});

export type HistoryEntry = {
  gameCode: string;
  rank: number;
  playerCount: number;
  score: number;
  correctCount: number;
  questionCount: number;
  xpEarned: number;
  won: boolean;
  stars: number;
  badgesEarned: Badge[];
  playedAt: number;
};

/** The signed-in user's recent games, newest first. */
export const getMyHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<HistoryEntry[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const rows = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(limit ?? 20, 50));

    return rows.map((row) => ({
      gameCode: row.gameCode,
      rank: row.rank,
      playerCount: row.playerCount,
      score: row.score,
      correctCount: row.correctCount,
      questionCount: row.questionCount,
      xpEarned: row.xpEarned,
      won: row.won,
      stars: row.stars ?? 1,
      badgesEarned: row.badgesEarned.map((id) => BADGE_MAP[id]).filter(Boolean),
      playedAt: row.playedAt,
    }));
  },
});

export type TopPlayer = {
  name: string;
  xp: number;
  level: number;
  levelTitle: string;
  gamesWon: number;
  badgeCount: number;
};

/** Global leaderboard: the strongest minds on the platform. */
export const getTopPlayers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<TopPlayer[]> => {
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_xp", (q) => q.gte("xp", 0))
      .order("desc")
      .take(Math.min(limit ?? 10, 20));

    const rows: TopPlayer[] = [];
    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (!user) continue;
      const level = levelFromXp(profile.xp);
      rows.push({
        name: user.name ?? "لاعب مجهول",
        xp: profile.xp,
        level,
        levelTitle: levelTitle(level),
        gamesWon: profile.gamesWon,
        badgeCount: profile.badges.length,
      });
    }
    return rows;
  },
});
