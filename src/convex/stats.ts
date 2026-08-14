import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { levelFromXp, levelTitle, xpToReachLevel } from "./gameConfig";

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
  fastestAnswerMs: number | null;
  badges: Badge[];
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
        fastestAnswerMs: null,
        badges: [],
      };
    }

    const level = levelFromXp(profile.xp);
    const levelStart = xpToReachLevel(level); // xp needed to enter this level
    const levelEnd = xpToReachLevel(level + 1); // xp needed for the next level

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
      fastestAnswerMs: profile.fastestAnswerMs ?? null,
      badges: profile.badges.map((id) => BADGE_MAP[id]).filter(Boolean),
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
      badgesEarned: row.badgesEarned.map((id) => BADGE_MAP[id]).filter(Boolean),
      playedAt: row.playedAt,
    }));
  },
});
