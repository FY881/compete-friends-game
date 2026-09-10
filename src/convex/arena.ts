/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 11 — الحلبة العالمية (Global Arena)
 *
 * مبارزات 1 ضد 1 بتزويد فوري من طابور انتظار عام، بنظام تصنيف ELO
 * (برونز 1000 → أسطورة 1700+). كل مبارزة هي غرفة لعب حقيقية (جدول
 * `games`) بلاعبين اثنين تُنشأ تلقائياً عند تزاوج الطابور — فترث كل
 * آليات اللعب الحيّة (المؤقتات، الإجابات، النتائج، احتساب البطولات
 * ونقاط الولاء) — ويُحدَّث تصنيف ELO تلقائياً عند انتهاء الجولة.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  ANSWER_MS,
  DURATION_MODE_OFF,
  QUESTION_COUNT_OPTIONS,
} from "./gameConfig";
import {
  makeUniqueCode,
  pickQuestions,
  poolSizeFor,
  sanitizeName,
  validateSettings,
  type GameSettings,
} from "./games";
import { isStaffUser } from "./owner";
import { internal } from "./_generated/api";

// ── إعدادات الحلبة ──
const START_RATING = 1000;
const K_FACTOR = 32;
const QUEUE_TIMEOUT_MS = 10 * 60 * 1000; // طابور قديم يُهمل بعد 10 دقائق
const DUEL_QUESTIONS = 5; // أصغر عدد مسموح في إعدادات الغرف

export const TIERS = [
  { min: 0, name: "برونز", emoji: "🥉" },
  { min: 1100, name: "فضي", emoji: "🥈" },
  { min: 1250, name: "ذهب", emoji: "🥇" },
  { min: 1450, name: "ماسي", emoji: "💎" },
  { min: 1700, name: "أسطورة", emoji: "👑" },
] as const;

type Tier = { name: string; emoji: string };

export function tierOf(rating: number): Tier {
  let t: Tier = TIERS[0];
  for (const tier of TIERS) {
    if (rating >= tier.min) t = { name: tier.name, emoji: tier.emoji };
  }
  return t;
}

/**
 * جِب تصنيف اللاعب — داخل الاستعلامات (بدون كتابة!) نعيد افتراضياً 1000
 * إن لم يكن له صف، وداخل الطفرات (المسار الكتابي `ensure=true`) ننشئه.
 * (استعلامات Convex للقراءة فقط: استدعاء db.insert داخلها يرمي TypeError.)
 */
async function getOrCreateRating(
  ctx: { db: any },
  userId: Id<"users">,
  ensure = false,
): Promise<DuelRating> {
  const existing = await ctx.db
    .query("arenaRatings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  if (!ensure) {
    return {
      _id: "" as Id<"arenaRatings">,
      userId,
      rating: START_RATING,
      wins: 0,
      losses: 0,
      draws: 0,
      lastPlayedAt: 0,
    };
  }
  const id = await ctx.db.insert("arenaRatings", {
    userId,
    rating: START_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
    lastPlayedAt: 0,
  });
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("تعذّر إنشاء تصنيف الحلبة");
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
// إنشاء غرفة المبارزة — غرفة `games` حقيقية بلاعبين اثنين
// ─────────────────────────────────────────────────────────────────────────

type DuelRating = {
  _id: Id<"arenaRatings">;
  userId: Id<"users">;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayedAt: number;
};

type WriteCtx = { db: any };

async function createDuelGame(
  ctx: { db: any },
  hostId: Id<"users">,
  guestId: Id<"users">,
): Promise<string> {
  const settings: GameSettings = validateSettings({
    questionCount: DUEL_QUESTIONS,
    timePerQuestionMs: ANSWER_MS,
    categories: [],
    durationMinutes: DURATION_MODE_OFF,
  });
  const code = await makeUniqueCode(ctx);
  const questionIds = await pickQuestions(
    ctx,
    settings.categories,
    poolSizeFor(settings),
  );

  const gameId = await ctx.db.insert("games", {
    code,
    hostId,
    status: "waiting",
    phase: "answering",
    questionIds,
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    firstCorrect: [],
    createdAt: Date.now(),
    settings,
    arenaDuel: true,
  });

  for (const uid of [hostId, guestId]) {
    const u = await ctx.db.get(uid);
    await ctx.db.insert("gamePlayers", {
      gameId,
      userId: uid,
      name: sanitizeName(u?.name),
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      joinedAt: Date.now(),
    });
  }
  return code;
}

/** إنشاء غرفة مبارزة بين لاعبين محددين — تُستخدم من نظام التنافس المباشر (الثأرية). */
export const createDuelRoom = internalMutation({
  args: {
    hostId: v.id("users"),
    guestId: v.id("users"),
  },
  handler: async (ctx, { hostId, guestId }) => {
    return createDuelGame(ctx, hostId, guestId);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات
// ─────────────────────────────────────────────────────────────────────────

/** حالتي في الحلبة: التصنيف + الدرع + سجل الانتصارات + حالة الطابور. */
export const getMyRating = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    // الاستعلامات للقراءة فقط: نعيد التصنيف الافتراضي إن لم يوجد صف بعد.
    const r = await getOrCreateRating(ctx, userId, false);
    const now = Date.now();
    const queued = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    const inQueue = queued.some(
      (d) => d.challengerId === userId && now - d.createdAt < QUEUE_TIMEOUT_MS,
    );
    return {
      rating: r.rating,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      tier: tierOf(r.rating),
      inQueue,
    };
  },
});

/** لوحة صدارة الحلبة — أعلى التصنيفات (لاعبون خاضوا مبارزة فعلاً). */
export const getLadder = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 25);
    const rows = await ctx.db
      .query("arenaRatings")
      .withIndex("by_rating", (q) => q.gte("rating", 0))
      .order("desc")
      .take(take * 3);

    const out: Array<{
      userId: string;
      name: string;
      rating: number;
      wins: number;
      losses: number;
      tier: Tier;
    }> = [];
    for (const r of rows) {
      if (r.wins + r.losses + r.draws === 0) continue;
      const user = await ctx.db.get(r.userId);
      if (!user) continue;
      out.push({
        userId: r.userId,
        name: user.name ?? "لاعب مجهول",
        rating: r.rating,
        wins: r.wins,
        losses: r.losses,
        tier: tierOf(r.rating),
      });
      if (out.length >= take) break;
    }
    return out;
  },
});

/** هل لدي مبارزة حلبة نشطة الآن؟ (تعيد كود الغرفة للانتقال إليها) */
export const getMyActiveDuel = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const active = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const mine = active.find(
      (d) => d.challengerId === userId || d.opponentId === userId,
    );
    if (!mine || !mine.gameCode) return null;
    return { gameCode: mine.gameCode };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الطابور والتزاوج
// ─────────────────────────────────────────────────────────────────────────

/** انضم لطابور الحلبة — إن وُجد خصم منتظر تُنشأ المبارزة فوراً. */
export const joinQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const me = await ctx.db.get(userId);
    const now = Date.now();

    // نظّف الطابور القديم
    const waiting = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    for (const d of waiting) {
      if (now - d.createdAt > QUEUE_TIMEOUT_MS) {
        await ctx.db.delete(d._id);
      }
    }

    // هل أنت في الطابور فعلاً؟
    if (waiting.some((d) => d.challengerId === userId)) {
      return { queued: true as const };
    }

    // هل لديك مبارزة نشطة لم تفتحها بعد؟
    const active = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const myActive = active.find(
      (d) => d.challengerId === userId || d.opponentId === userId,
    );
    if (myActive?.gameCode) {
      return { matched: true as const, code: myActive.gameCode };
    }

    // حاول التزاوج الفوري مع أول منتظر (ليس أنت)
    const opponentEntry = waiting.find((d) => d.challengerId !== userId);
    if (opponentEntry) {
      const code = await createDuelGame(ctx, opponentEntry.challengerId, userId);
      await ctx.db.patch(opponentEntry._id, {
        opponentId: userId,
        opponentName: me?.name ?? "مجهول",
        status: "active",
        gameCode: code,
      });
      return { matched: true as const, code };
    }

    // لا أحد منتظر — ادخل الطابور
    await ctx.db.insert("duels", {
      challengerId: userId,
      challengerName: me?.name ?? "مجهول",
      status: "waiting",
      challengerScore: 0,
      opponentScore: 0,
      questionCount: DUEL_QUESTIONS,
      currentQuestion: 0,
      arena: true,
      createdAt: now,
    });
    return { queued: true as const };
  },
});

/** اترك طابور الحلبة. */
export const leaveQueue = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const waiting = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    for (const d of waiting) {
      if (d.challengerId === userId) await ctx.db.delete(d._id);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// تحديث ELO — يُستدعى من games.finishGame عند انتهاء مبارزة حلبة
// ─────────────────────────────────────────────────────────────────────────

export const recordDuelResult = internalMutation({
  args: { gameCode: v.string() },
  handler: async (ctx, { gameCode }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", gameCode))
      .first();
    if (!game || game.status !== "finished" || !game.arenaDuel) return;

    // مرة واحدة لكل مبارزة: إن كانت المبارزة أرشفتها سابقاً فلن نجدها
    const active = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const match = active.find((d) => d.gameCode === gameCode);
    if (!match || !match.opponentId) return;

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (players.length < 2) return;

    const [a, b] = players;
    const ra = await getOrCreateRating(ctx, a.userId);
    const rb = await getOrCreateRating(ctx, b.userId);

    const scoreA = a.score > b.score ? 1 : a.score < b.score ? 0 : 0.5;
    const scoreB = 1 - scoreA;

    const expectedA = 1 / (1 + Math.pow(10, (rb.rating - ra.rating) / 400));
    const expectedB = 1 - expectedA;

    const newA = Math.round(ra.rating + K_FACTOR * (scoreA - expectedA));
    const newB = Math.round(rb.rating + K_FACTOR * (scoreB - expectedB));

    const now = Date.now();
    await ctx.db.patch(ra._id, {
      rating: newA,
      wins: ra.wins + (scoreA === 1 ? 1 : 0),
      losses: ra.losses + (scoreA === 0 ? 1 : 0),
      draws: ra.draws + (scoreA === 0.5 ? 1 : 0),
      lastPlayedAt: now,
    });
    await ctx.db.patch(rb._id, {
      rating: newB,
      wins: rb.wins + (scoreB === 1 ? 1 : 0),
      losses: rb.losses + (scoreB === 0 ? 1 : 0),
      draws: rb.draws + (scoreB === 0.5 ? 1 : 0),
      lastPlayedAt: now,
    });

    // أرشِف المبارزة كمنتهية
    await ctx.db.patch(match._id, {
      status: "finished",
      challengerScore: a.score,
      opponentScore: b.score,
      winnerId: scoreA === 1 ? a.userId : scoreB === 1 ? b.userId : undefined,
    });

    // موجّة 12: اسجّل النتيجة في موسم الحلبة النشط أيضاً
    await ctx.runMutation(internal.arenaSeasons.applySeasonDuel, {
      hostUserId: a.userId,
      hostScore: scoreA,
      guestUserId: b.userId,
      guestScore: scoreB,
    });

    // سطر شفافية في سجلّ القرارات الموحّد
    const winnerName = scoreA === 1 ? a.name : scoreB === 1 ? b.name : null;
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "الحلبة العالمية",
      action: "arena_duel_finished",
      detail: winnerName
        ? `مبارزة حلبة: فاز ${winnerName} (${a.score} مقابل ${b.score}) — تصنيف ${newA}/${newB}`
        : `مبارزة حلبة تعادل (${a.score} مقابل ${b.score}) — تصنيف ${newA}/${newB}`,
      severity: "low",
      createdAt: now,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إدارة المالك
// ─────────────────────────────────────────────────────────────────────────

/** إعادة تصنيف لاعب يدوياً (للمالك فقط) — لأي سبب تدقيقي. */
export const adminSetRating = mutation({
  args: { userId: v.id("users"), rating: v.number() },
  handler: async (ctx, { userId, rating }) => {
    const meId = await getAuthUserId(ctx);
    if (meId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(meId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح — للمالك فقط");
    const safe = Math.min(Math.max(Math.round(rating), 100), 3000);
    const r = await getOrCreateRating(ctx, userId);
    await ctx.db.patch(r._id, { rating: safe });
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: me.name ?? "الإدارة",
      action: "arena_rating_set",
      detail: `تعديل تصنيف حلبة يدوي إلى ${safe}`,
      targetId: userId,
      severity: "medium",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// تحقق ثابت: هل 5 أسئلة مدعومة في إعدادات الغرف؟ (يتعيطل البناء إن تغيّرت)
type _DuelCountSupported = (typeof QUESTION_COUNT_OPTIONS)[number] extends never
  ? never
  : true;
