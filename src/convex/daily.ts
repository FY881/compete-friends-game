import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { dayKey } from "./gameConfig";
import { QUESTION_BANK } from "./questions";

/**
 * «تحدي اليوم» — جولة فردية ثابتة لكل يوم تقويمي.
 *
 * - نفس 10 أسئلة لكل اللاعبين في نفس اليوم (تُختار ببذرة ثابتة من التاريخ).
 * - محاولة واحدة في اليوم؛ أفضل نتيجة تُحفظ وتُظهر في الملف الشخصي.
 * - تمنح خبرة (XP) وشارات: «أول تحدي»، «الكمال اليومي»، «أسبوع التحديات».
 */

export const DAILY_QUESTION_COUNT = 10;
export const DAILY_MAX_XP = 60;

/** Pseudo-random generator seeded by a string — deterministic per day. */
function seededRandom(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The 10 questions of the day for a given day key (full, server-side). */
export function questionsForDay(day: string) {
  const rand = seededRandom(`alabqari-daily-${day}`);
  const shuffled = shuffle(QUESTION_BANK, rand);
  return shuffled.slice(0, DAILY_QUESTION_COUNT);
}

function answerScore(elapsedMs: number): number {
  // كل إجابة صحيحة: 100 نقطة + مكافأة سرعة (كلما أسرع كلما زادت، حتى 50).
  return 100 + Math.max(0, Math.min(50, Math.round((15_000 - elapsedMs) / 150)));
}

/** Current day's challenge + the player's status. */
export const getDailyChallenge = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const today = dayKey(Date.now());
    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .first();

    const all = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();

    return {
      day: today,
      // يُرسل السؤال بدون الإجابة الصحيحة للعميل — التحقق يتم على الخادم.
      questions: questionsForDay(today).map(({ correctIndex: _c, ...rest }) => rest),
      completed: existing
        ? {
            score: existing.score,
            correctCount: existing.correctCount,
            bestStreak: existing.bestStreak,
            xpEarned: existing.xpEarned,
          }
        : null,
      completedDays: all.length,
      bestScoreEver: all.reduce((max, r) => Math.max(max, r.score), 0),
    };
  },
});

/** Submit today's attempt — one per day, server-side scored & verified. */
export const submitDailyChallenge = mutation({
  args: {
    day: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        selected: v.number(),
        elapsedMs: v.number(),
      }),
    ),
  },
  handler: async (ctx, { day, answers }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const today = dayKey(Date.now());
    if (day !== today) throw new Error("هذا التحدي ليس تحدياً لليوم — تظهر أسئلة جديدة كل يوم.");

    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .first();
    if (existing) throw new Error("أنجزت تحدي اليوم بالفعل — عد غداً لتحدٍ جديد ✨");

    const questions = questionsForDay(today);
    const byId = new Map(questions.map((q) => [q.id, q]));
    if (answers.length !== questions.length) {
      throw new Error("أجب عن جميع الأسئلة قبل الإرسال.");
    }

    let correctCount = 0;
    let bestStreak = 0;
    let streak = 0;
    let score = 0;
    for (const answer of answers) {
      const q = byId.get(answer.questionId);
      if (!q) throw new Error("سؤال غير معروف في هذا التحدي.");
      const correct = answer.selected === q.correctIndex;
      if (correct) {
        correctCount += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        score += answerScore(Math.max(0, Math.min(15_000, answer.elapsedMs)));
      } else {
        streak = 0;
      }
    }

    const perfect = correctCount === questions.length;
    const xp = Math.min(
      DAILY_MAX_XP,
      correctCount * 10 + (perfect ? 20 : 0) + (bestStreak >= 5 ? 15 : 0),
    );

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const had = new Set(profile?.badges ?? []);
    const next = new Set(had);
    next.add("daily_first");
    if (perfect) next.add("daily_perfect");
    const allDays = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    if (allDays.length + 1 >= 7) next.add("daily_7_days");
    const badgesEarned = [...next].filter((id) => !had.has(id));

    const now = Date.now();
    await ctx.db.insert("dailyChallenges", {
      userId,
      day: today,
      score,
      correctCount,
      bestStreak,
      xpEarned: xp,
      playedAt: now,
    });

    if (profile) {
      await ctx.db.patch(profile._id, {
        xp: (profile.xp ?? 0) + xp,
        correctAnswers: (profile.correctAnswers ?? 0) + correctCount,
        totalAnswers: (profile.totalAnswers ?? 0) + answers.length,
        badges: [...next],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        xp,
        gamesPlayed: 0,
        gamesWon: 0,
        bestScore: 0,
        bestStreak: 0,
        correctAnswers: correctCount,
        totalAnswers: answers.length,
        badges: [...next],
        updatedAt: now,
      });
    }

    return {
      score,
      correctCount,
      total: questions.length,
      bestStreak,
      xpEarned: xp,
      badgesEarned,
      perfect,
    };
  },
});
