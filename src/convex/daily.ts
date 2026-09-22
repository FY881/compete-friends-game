import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { QUESTION_BANK } from "./questions";
import {
  DAILY_MAX_XP,
  DAILY_QUESTION_COUNT,
  badgesForDaily,
  compareDailyBoards,
  dailyStreak,
  dailyXp,
  dayKeyUtc,
  nextDailyResetAt,
  questionsForDay,
  validateDailyAttempt,
} from "./dailyCore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗓️ «تحدي اليوم» — محرّك العودة اليومية
 *
 * كان هذا النظام كاملاً في الخادم لكنه غير موصول بأي واجهة إطلاقاً، وزرُّ
 * «التحدي اليومي» في صفحة اللعب كان يَعِد بتحميله ثم ينقل اللاعب إلى /games.
 * الآن: نفس العشرة أسئلة لكل اللاعبين (بذرة ثابتة من التاريخ ⇒ صدارة عادلة
 * حقاً)، محاولة واحدة يومياً، حساب وترتيب على الخادم بالكامل، سلسلة أيام
 * حقيقية، وسجل شخصي — وكل الحساب من `dailyCore` النقي المختبر.
 *
 * قواعد ملزمة:
 *  • الخادم لا يثق بأي رقم من المتصفح: النقاط والسلسلة تُحسب هنا.
 *  • الإجابة الصحيحة لا تُرسل للعميل أبداً.
 *  • كل قراءة مقيّدة بـ take() — لا استعلام ثقيل مهما كثر اللاعبون.
 *  • «اليوم» بتوقيت UTC موحّداً بين التحدي والصدارة والسجل (لا اختلاف أبداً).
 * ═══════════════════════════════════════════════════════════════════════
 */

export { DAILY_MAX_XP, DAILY_QUESTION_COUNT };

const HISTORY_DAYS = 14;

/** يوم اليوم + كل ما يحتاجه اللاعب والقائمة */
function today() {
  const now = Date.now();
  return { day: dayKeyUtc(now), now, resetAt: nextDailyResetAt(now) };
}

/** كل أيام إنجاز اللاعب — مصدر واحد للسلسلة والسجل والشارات */
async function myDays(ctx: { db: any }, userId: { toString(): string }): Promise<string[]> {
  const rows = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_user_day", (q: any) => q.eq("userId", userId))
    .take(400);
  return rows.map((r: { day: string }) => r.day);
}

/** أسئلة اليوم بلا الإجابة الصحيحة — ما يُرسل للعميل */
function publicQuestions(day: string) {
  return questionsForDay(QUESTION_BANK, day).map(({ correctIndex: _c, ...rest }) => rest);
}

// ═══════════════════════════ التحدي ═══════════════════════════

/** Current day's challenge + the player's status (وسلسلته وعدّاد التصفير). */
export const getDailyChallenge = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const { day, resetAt } = today();
    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    const days = await myDays(ctx, userId);
    const streak = dailyStreak(days, day);

    const questions = publicQuestions(day);
    const mine = existing
      ? await myRankToday(ctx, userId, day, existing.score, existing.correctCount, existing.playedAt)
      : null;

    return {
      day,
      // يُرسل السؤال بدون الإجابة الصحيحة للعميل — التحقق يتم على الخادم.
      questions,
      questionCount: questions.length,
      maxXp: DAILY_MAX_XP,
      completed: existing
        ? {
            score: existing.score,
            correctCount: existing.correctCount,
            bestStreak: existing.bestStreak,
            xpEarned: existing.xpEarned,
          }
        : null,
      completedDays: days.length,
      bestScoreEver: await bestEver(ctx, userId),
      // ── توسيع حقيقي ──
      streak,
      nextResetAt: resetAt,
      myRank: mine?.rank ?? null,
      boardSize: mine?.size ?? 0,
    };
  },
});

/** أفضل نتيجة على الإطلاق — بقراءة مرتّبة لا بجمع كل الصفوف */
async function bestEver(ctx: { db: any }, userId: unknown): Promise<number> {
  const rows = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_user_day", (q: any) => q.eq("userId", userId))
    .take(400);
  return rows.reduce((max: number, r: { score: number }) => Math.max(max, r.score), 0);
}

/** رتبة اللاعب في صدارة اليوم — تُحسب بمقارنة مع صفوف اليوم فقط */
async function myRankToday(
  ctx: { db: any },
  userId: unknown,
  day: string,
  score: number,
  correctCount: number,
  playedAt: number,
) {
  const entries = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_day", (q: any) => q.eq("day", day))
    .take(400);
  const me = { score, correctCount, playedAt, userId: String(userId) };
  const better = entries.filter(
    (e: { score: number; correctCount: number; playedAt: number; userId: unknown }) =>
      String(e.userId) !== me.userId && compareDailyBoards(e, me) < 0,
  ).length;
  return { rank: better + 1, size: entries.length };
}

// ═══════════════════════════ الصدارة ═══════════════════════════

/**
 * صدارة اليوم — أعدل صدارة في اللعبة: كل لاعب حلّ الأسئلة نفسها بالحرف،
 * فلا مزية لمستوى ولا لمحتوى أسهل. مع رتبة اللاعب نفسه داخل القائمة.
 */
export const getDailyBoard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const { day, resetAt } = today();
    const entries = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_day", (q) => q.eq("day", day))
      .take(400);

    const sorted = [...entries].sort(compareDailyBoards);
    const top = sorted.slice(0, 20);
    const names = new Map<string, string>();
    for (const e of top) {
      const u = await ctx.db.get(e.userId);
      if (u) names.set(String(e.userId), (u as { name?: string }).name ?? "لاعب");
    }

    const myIndex = userId ? sorted.findIndex((e) => String(e.userId) === String(userId)) : -1;
    const mine = myIndex >= 0 ? sorted[myIndex] : null;
    const myName = userId ? (await ctx.db.get(userId)) as { name?: string } | null : null;

    return {
      day,
      nextResetAt: resetAt,
      total: entries.length,
      perfectCount: entries.filter((e) => e.correctCount === DAILY_QUESTION_COUNT).length,
      averageScore: entries.length
        ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length)
        : 0,
      top: top.map((e, i) => ({
        rank: i + 1,
        name: names.get(String(e.userId)) ?? "لاعب",
        score: e.score,
        correctCount: e.correctCount,
        bestStreak: e.bestStreak,
        playedAt: e.playedAt,
        isMe: userId ? String(e.userId) === String(userId) : false,
      })),
      me: mine
        ? {
            rank: myIndex + 1,
            name: myName?.name ?? "أنت",
            score: mine.score,
            correctCount: mine.correctCount,
            bestStreak: mine.bestStreak,
          }
        : null,
    };
  },
});

// ═══════════════════════════ السجل الشخصي ═══════════════════════════

/** آخر ١٤ يوماً من إنجازي — يُظهر السلسلة والكمال بصدق */
export const getMyDailyHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .take(HISTORY_DAYS + 60);

    const byDay = new Map(rows.map((r) => [r.day, r]));
    const { day } = today();
    const out: {
      day: string;
      score: number;
      correctCount: number;
      bestStreak: number;
      perfect: boolean;
    }[] = [];
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const key = dayKeyUtc(Date.parse(`${day}T00:00:00Z`) - i * 86_400_000);
      const r = byDay.get(key);
      if (!r) continue;
      out.push({
        day: key,
        score: r.score,
        correctCount: r.correctCount,
        bestStreak: r.bestStreak,
        perfect: r.correctCount === DAILY_QUESTION_COUNT,
      });
    }

    return {
      days: out,
      streak: dailyStreak(rows.map((r) => r.day), day),
      best: out.reduce((m, d) => Math.max(m, d.score), 0),
      perfectDays: out.filter((d) => d.perfect).length,
    };
  },
});

// ═══════════════════════════ الإرسال ═══════════════════════════

/**
 * إرسال محاولة اليوم — واحدة فقط في اليوم، حساب وتحقق على الخادم بالكامل.
 * كل قواعد الرفض والحساب تأتي من `validateDailyAttempt` النقي المختبر.
 */
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

    const { day: todayDay } = today();

    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", todayDay))
      .first();
    if (existing) throw new Error("أنجزت تحدي اليوم بالفعل — عد غداً لتحدٍ جديد ✨");

    const questions = questionsForDay(QUESTION_BANK, todayDay);
    const verdict = validateDailyAttempt({ day, today: todayDay, questions, answers });
    if (!verdict.ok) throw new Error(verdict.error);

    const total = questions.length;
    const xp = dailyXp(verdict.correctCount, total, verdict.bestStreak);
    const now = Date.now();

    // ── السجل والشارات ──
    const priorDays = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .take(400);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const badges = badgesForDaily({
      had: profile?.badges ?? [],
      perfect: verdict.perfect,
      totalDays: priorDays.length + 1,
    });

    await ctx.db.insert("dailyChallenges", {
      userId,
      day: todayDay,
      score: verdict.score,
      correctCount: verdict.correctCount,
      bestStreak: verdict.bestStreak,
      xpEarned: xp,
      playedAt: now,
    });

    if (profile) {
      await ctx.db.patch(profile._id, {
        xp: (profile.xp ?? 0) + xp,
        correctAnswers: (profile.correctAnswers ?? 0) + verdict.correctCount,
        totalAnswers: (profile.totalAnswers ?? 0) + total,
        badges: badges.next,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        xp,
        gamesPlayed: 0,
        gamesWon: 0,
        bestScore: verdict.score,
        bestStreak: verdict.bestStreak,
        correctAnswers: verdict.correctCount,
        totalAnswers: total,
        badges: badges.next,
        updatedAt: now,
      });
    }

    // ── السلسلة الحقيقية + رتبة اليوم (محسوبة بعد الحفظ) ──
    const streak = dailyStreak([...priorDays.map((r) => r.day), todayDay], todayDay);
    const rank = await myRankToday(
      ctx,
      userId,
      todayDay,
      verdict.score,
      verdict.correctCount,
      now,
    );

    // ── ربط حقيقي بمسار الإشعارات الموحّد: تنبيه عند محطة سلسلة ──
    if (streak.current === 7 || streak.current === 30) {
      await ctx.runMutation(internal.notify.push, {
        userId,
        title: `🔥 سلسلة ${streak.current} يوم في تحدي اليوم`,
        body:
          streak.current === 30
            ? "شهر كامل بلا انقطاع — شارة «شهر التحديات» صارت لك. واصل!"
            : "أسبوع كامل بلا انقطاع — شارة «أسبوع التحديات» صارت لك. واصل!",
        type: "info",
        category: "streaks",
        priority: "important",
        actionUrl: "/play",
      });
    }

    return {
      score: verdict.score,
      correctCount: verdict.correctCount,
      total,
      bestStreak: verdict.bestStreak,
      xpEarned: xp,
      badgesEarned: badges.earned,
      perfect: verdict.perfect,
      // ── توسيع حقيقي ──
      streak,
      rank: rank.rank,
      boardSize: rank.size,
      timingsTrustworthy: verdict.timingsTrustworthy,
    };
  },
});
