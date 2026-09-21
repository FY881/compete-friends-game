/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎮 v14.0 — خادم الألعاب المصغّرة: حوّل «وعد الخبرة» إلى دفع حقيقي
 *
 * قبل هذا الملف: ٩٦ لعبة تعلن مكافأة خبرة، والنتيجة تُخزَّن في حالة React
 * المحلية — تُفقد بالتحديث ولا تصل للخادم أبداً. أي وعد بلا دافع.
 *
 * بعده: كل نتيجة تمرّ من `submitMiniGameResult`، والخبرة تُشتقّ في الخادم من
 * النتيجة والصعوبة (لا من ادّعاء الواجهة)، وتُدفع فعلاً في `profiles.xp`،
 * ويُسجّل أعلى نتيجة، ويُنشأ ترتيب حقيقي بين اللاعبين — مع سقف يومي وعوائد
 * متناقصة تمنع مزرعة الخبرة.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isOwnerUser } from "./owner";
import {
  MINI_GAME_DAILY_XP_CAP,
  MINI_GAME_MAX_SCORE,
  isKnownMiniGameId,
  isMiniGameDifficulty,
  remainingDailyXp,
  rewardForMiniGame,
} from "./miniGameCore";

function safe(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/** مفتاح اليوم (UTC) — نفس اليوم لكل اللاعبين في نفس اللحظة */
export function dayKeyUtc(at = Date.now()): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function awardXp(ctx: MutationCtx, userId: Id<"users">, amount: number): Promise<void> {
  if (amount <= 0) return;
  const now = Date.now();
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (profile) {
    await ctx.db.patch(profile._id, { xp: (profile.xp ?? 0) + amount, updatedAt: now });
    return;
  }
  await ctx.db.insert("profiles", {
    userId,
    xp: amount,
    gamesPlayed: 0,
    gamesWon: 0,
    bestScore: 0,
    bestStreak: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    badges: [],
    updatedAt: now,
  });
}

// ───────────────────────────────────────────────────────────────────────
// ① تسجيل نتيجة حقيقية ودفع الخبرة
// ───────────────────────────────────────────────────────────────────────

export const submitMiniGameResult = mutation({
  args: {
    gameId: v.string(),
    category: v.string(),
    difficulty: v.string(),
    score: v.number(),
    timeMs: v.number(),
    timeLimitSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول لحفظ نتيجتك.");

    const gameId = safe(args.gameId, 24);
    if (!isKnownMiniGameId(gameId)) throw new Error("لعبة غير معروفة.");
    if (!isMiniGameDifficulty(args.difficulty)) throw new Error("صعوبة غير معروفة.");
    if (!Number.isFinite(args.score) || args.score < 0 || args.score > MINI_GAME_MAX_SCORE) {
      throw new Error("نتيجة غير منطقية.");
    }
    if (!Number.isFinite(args.timeMs) || args.timeMs < 0) throw new Error("زمن غير منطقي.");

    const now = Date.now();
    const day = dayKeyUtc(now);

    const daily = await ctx.db
      .query("miniGameDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", meId).eq("day", day))
      .first();
    const perGame = await ctx.db
      .query("miniGameDailyPerGame")
      .withIndex("by_user_day_game", (q) => q.eq("userId", meId).eq("day", day).eq("gameId", gameId))
      .first();

    const reward = rewardForMiniGame({
      score: args.score,
      difficulty: args.difficulty,
      playsTodayForGame: perGame?.plays ?? 0,
      xpEarnedToday: daily?.xpEarned ?? 0,
      timeMs: args.timeMs,
      timeLimitSeconds: Number.isFinite(args.timeLimitSeconds) ? args.timeLimitSeconds : 0,
    });

    // (١) عدّاد تكرار اللعب اليوم — حتى المحاولة بلا خبرة تُحسب (فتصبح العوائد أصدق)
    if (perGame) {
      await ctx.db.patch(perGame._id, { plays: perGame.plays + 1, updatedAt: now });
    } else {
      await ctx.db.insert("miniGameDailyPerGame", { userId: meId, day, gameId, plays: 1, updatedAt: now });
    }

    // (٢) السقف اليومي
    const xpBefore = daily?.xpEarned ?? 0;
    if (daily) {
      await ctx.db.patch(daily._id, {
        xpEarned: xpBefore + reward.xp,
        plays: daily.plays + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("miniGameDaily", {
        userId: meId,
        day,
        xpEarned: reward.xp,
        plays: 1,
        updatedAt: now,
      });
    }

    // (٣) السجل الدائم: أعلى نتيجة + عدد اللعب + مجموع الخبرة
    const prev = await ctx.db
      .query("miniGameResults")
      .withIndex("by_user_game", (q) => q.eq("userId", meId).eq("gameId", gameId))
      .first();
    const score = Math.floor(args.score);
    const isNewBest = !prev || score > prev.bestScore;
    if (prev) {
      await ctx.db.patch(prev._id, {
        bestScore: Math.max(prev.bestScore, score),
        lastScore: score,
        plays: prev.plays + 1,
        xpEarned: prev.xpEarned + reward.xp,
        category: safe(args.category, 32) || prev.category,
        difficulty: args.difficulty,
        lastPlayedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("miniGameResults", {
        userId: meId,
        gameId,
        category: safe(args.category, 32) || "غير مصنّف",
        difficulty: args.difficulty,
        bestScore: score,
        lastScore: score,
        plays: 1,
        xpEarned: reward.xp,
        lastPlayedAt: now,
        updatedAt: now,
      });
    }

    // (٤) الدفع الفعلي — الرقم الذي يعود هو ما دُفع بالحرف
    await awardXp(ctx, meId, reward.xp);

    const bestScore = prev ? Math.max(prev.bestScore, score) : score;
    const rank = await rankForScore(ctx, gameId, bestScore);

    return {
      xp: reward.xp,
      reason: reward.reason,
      cappedByDaily: reward.cappedByDaily,
      fatigued: reward.fatigued,
      bestScore,
      isNewBest,
      rank,
      xpEarnedToday: xpBefore + reward.xp,
      remainingToday: remainingDailyXp(xpBefore + reward.xp),
    };
  },
});

/** ترتيب حقيقي: كم لاعباً تجاوزك في هذه اللعبة (مقيّد بسقف قراءة واضح) */
async function rankForScore(ctx: QueryCtx | MutationCtx, gameId: string, score: number): Promise<number> {
  const above = await ctx.db
    .query("miniGameResults")
    .withIndex("by_game_score", (q) => q.eq("gameId", gameId).gt("bestScore", score))
    .take(200);
  return above.length + 1;
}

// ───────────────────────────────────────────────────────────────────────
// ② لوحة اللاعب — كل رقم من الخادم لا من الذاكرة
// ───────────────────────────────────────────────────────────────────────

export const getMyMiniGameBoard = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    const day = dayKeyUtc();
    if (!meId) {
      return { signedIn: false as const, day, daily: { xpEarned: 0, plays: 0, remaining: MINI_GAME_DAILY_XP_CAP }, cap: MINI_GAME_DAILY_XP_CAP, games: {} as Record<string, { bestScore: number; plays: number; xpEarned: number }>, perGameToday: {} as Record<string, number> };
    }

    const rows = await ctx.db
      .query("miniGameResults")
      .withIndex("by_user", (q) => q.eq("userId", meId))
      .take(150);
    const daily = await ctx.db
      .query("miniGameDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", meId).eq("day", day))
      .first();
    const perGameTodayRows = await ctx.db
      .query("miniGameDailyPerGame")
      .withIndex("by_user_day_game", (q) => q.eq("userId", meId).eq("day", day))
      .take(150);

    const games: Record<string, { bestScore: number; plays: number; xpEarned: number }> = {};
    for (const r of rows) {
      games[r.gameId] = { bestScore: r.bestScore, plays: r.plays, xpEarned: r.xpEarned };
    }
    const perGameToday: Record<string, number> = {};
    for (const r of perGameTodayRows) perGameToday[r.gameId] = r.plays;

    const xpEarned = daily?.xpEarned ?? 0;
    return {
      signedIn: true as const,
      day,
      cap: MINI_GAME_DAILY_XP_CAP,
      daily: { xpEarned, plays: daily?.plays ?? 0, remaining: remainingDailyXp(xpEarned) },
      games,
      perGameToday,
    };
  },
});

/** صدارة لعبة واحدة — أعلى النتائج الحقيقية مع أسماء أصحابها */
export const miniGameTop = query({
  args: { gameId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const gameId = safe(args.gameId, 24);
    if (!isKnownMiniGameId(gameId)) return [];
    const limit = Math.max(3, Math.min(25, Math.floor(args.limit ?? 10)));
    const rows = await ctx.db
      .query("miniGameResults")
      .withIndex("by_game_score", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(limit);
    const out: { userId: string; name: string; avatar: string; score: number; plays: number }[] = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.userId);
      out.push({
        userId: r.userId as unknown as string,
        name: u?.name ?? "لاعب",
        avatar: (u as unknown as { avatar?: string } | null)?.avatar ?? "🧠",
        score: r.bestScore,
        plays: r.plays,
      });
    }
    return out;
  },
});

/** أفضل لاعبي الألعاب المصغّرة عمومًا — مجموع أعلى النتائج */
export const miniGameHallOfFame = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("miniGameResults").order("desc").take(400);
    const per = new Map<string, { score: number; xp: number; plays: number; games: number }>();
    for (const r of rows) {
      const key = r.userId as unknown as string;
      const cur = per.get(key) ?? { score: 0, xp: 0, plays: 0, games: 0 };
      cur.score += r.bestScore;
      cur.xp += r.xpEarned;
      cur.plays += r.plays;
      cur.games += 1;
      per.set(key, cur);
    }
    const top = [...per.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 10);
    const out: { userId: string; name: string; avatar: string; score: number; xp: number; games: number }[] = [];
    for (const [userId, agg] of top) {
      const u = await ctx.db.get(userId as unknown as Id<"users">);
      out.push({
        userId,
        name: u?.name ?? "لاعب",
        avatar: (u as unknown as { avatar?: string } | null)?.avatar ?? "🧠",
        score: agg.score,
        xp: agg.xp,
        games: agg.games,
      });
    }
    return out;
  },
});

// ───────────────────────────────────────────────────────────────────────
// ③ نبضة المالك — ما دُفع فعلاً من خبرة الألعاب المصغّرة
// ───────────────────────────────────────────────────────────────────────

export const miniGamePulse = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    const me = meId ? await ctx.db.get(meId) : null;
    if (!isOwnerUser(me)) return null;

    const results = await ctx.db.query("miniGameResults").take(500);
    const daily = await ctx.db.query("miniGameDaily").order("desc").take(300);

    const byGame = new Map<string, { plays: number; xp: number; best: number }>();
    const players = new Set<string>();
    let xpGranted = 0;
    let plays = 0;
    for (const r of results) {
      players.add(r.userId as unknown as string);
      xpGranted += r.xpEarned;
      plays += r.plays;
      const cur = byGame.get(r.gameId) ?? { plays: 0, xp: 0, best: 0 };
      cur.plays += r.plays;
      cur.xp += r.xpEarned;
      cur.best = Math.max(cur.best, r.bestScore);
      byGame.set(r.gameId, cur);
    }

    const today = dayKeyUtc();
    const todayRows = daily.filter((d) => d.day === today);
    const activeToday = new Set(todayRows.map((d) => d.userId as unknown as string)).size;

    return {
      distinctGamesTouched: byGame.size,
      playersTouched: players.size,
      totalPlays: plays,
      xpGranted,
      activeToday,
      xpToday: todayRows.reduce((s, d) => s + d.xpEarned, 0),
      playsToday: todayRows.reduce((s, d) => s + d.plays, 0),
      cap: MINI_GAME_DAILY_XP_CAP,
      hottest: [...byGame.entries()]
        .sort((a, b) => b[1].plays - a[1].plays)
        .slice(0, 10)
        .map(([gameId, v2]) => ({ gameId, plays: v2.plays, xp: v2.xp, best: v2.best })),
    };
  },
});
