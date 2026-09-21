/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 v15.0 — خادم الغرفة الحيّة: تحليل حيّ · توقّع · ضبط صعوبة يُنفَّذ فعلاً
 *
 * كل ما يخرج من هنا مشتقّ من إجابات مسجّلة في `gamePlayers.answers`، ولا شيء
 * يُخترع. والفعل الوحيد الذي يغيّر شيئاً (`retuneDifficulty`) يمسّ **الأسئلة
 * التي لم يصلها أحد بعد** فقط — لأن الإجابات محفوظة بفهرس السؤال، فتغيير
 * سؤال مُجاب عنه سيُفسد سجل اللاعب.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { pickQuestions } from "./games";
import {
  ADAPTIVE_MIN_SAMPLE,
  buildLiveRows,
  planTail,
  predictNext,
  recommendDifficulty,
  worthRetuning,
  type LiveDifficulty,
  type LivePlayerInput,
} from "./gameLiveCore";

const MAX_ROOM_PLAYERS = 16;

interface GameRow {
  _id: Id<"games">;
  code: string;
  hostId: Id<"users">;
  status: string;
  questionIds: string[];
  currentQuestionIndex: number;
  settings: { categories?: string[]; categoryMode?: string };
}

function categoriesOf(game: GameRow): string[] {
  const cats = game.settings?.categories;
  return Array.isArray(cats) ? cats.filter((c): c is string => typeof c === "string") : [];
}

async function readRoom(ctx: QueryCtx | MutationCtx, code: string) {
  const game = (await ctx.db
    .query("games")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first()) as unknown as GameRow | null;
  if (!game) return null;
  const players = await ctx.db
    .query("gamePlayers")
    .withIndex("by_game", (q) => q.eq("gameId", game._id))
    .take(MAX_ROOM_PLAYERS);
  const inputs: LivePlayerInput[] = players.map((p) => ({
    userId: p.userId as unknown as string,
    name: p.name,
    score: p.score,
    streak: p.streak,
    answers: (p.answers ?? []).map((a) =>
      a ? { correct: Boolean(a.correct), elapsedMs: Math.max(0, Number(a.elapsedMs) || 0) } : null,
    ),
  }));
  return { game, players, inputs };
}

/**
 * 🔴 التحليل الحيّ للغرفة — للاعبين جميعاً (لا يحتاج صلاحية خاصة).
 * يعيد: أرقام كل لاعب الحقيقية · توقّع كل لاعب · قرار الصعوبة الحالي ·
 * وخطة الذيل (كم سؤالاً يمكن تعديله ولمن).
 */
export const liveRoom = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await readRoom(ctx, args.code.trim().toUpperCase());
    if (!room) return null;
    const { game, inputs } = room;

    const rows = buildLiveRows(inputs);
    const call = recommendDifficulty(rows);
    const plan = planTail(game.questionIds.length, game.currentQuestionIndex);

    const meId = await getAuthUserId(ctx);
    const isHost = meId !== null && (meId as unknown as string) === (game.hostId as unknown as string);

    // آخر تعديل حقيقي على هذه الغرفة (للشفافية: لماذا تغيّرت الصعوبة)
    const lastAdapt = await ctx.db
      .query("gameAdaptations")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .order("desc")
      .first();

    const adaptationsCount = (
      await ctx.db
        .query("gameAdaptations")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .take(50)
    ).length;

    return {
      code: game.code,
      status: game.status,
      currentQuestionIndex: game.currentQuestionIndex,
      totalQuestions: game.questionIds.length,
      isHost,
      minSample: ADAPTIVE_MIN_SAMPLE,
      laneCategories: categoriesOf(game),
      players: rows.map((r) => ({ ...r, next: predictNext(r) })),
      call,
      plan,
      adaptationsCount,
      lastAdaptation: lastAdapt
        ? {
            atQuestionIndex: lastAdapt.atQuestionIndex,
            fromDifficulty: lastAdapt.fromDifficulty,
            toDifficulty: lastAdapt.toDifficulty,
            roomAccuracy: lastAdapt.roomAccuracy,
            swappedCount: lastAdapt.swappedCount,
            actorName: lastAdapt.actorName,
            reason: lastAdapt.reason,
            createdAt: lastAdapt.createdAt,
          }
        : null,
    };
  },
});

/**
 * 🎚️ الضبط التكيّفي — تنفيذ حقيقي:
 *   ١) يقيس دقّة الغرفة من الإجابات المسجّلة.
 *   ٢) يشتقّ نسبة الأسئلة الصعبة الجديدة.
 *   ٣) يعيد اختيار **الأسئلة المتبقية فقط** من نفس فئات الغرفة.
 *   ٤) يحفظ سجلّ التعديل ليُعرض للاعبين ويُراجَع من المالك.
 *
 * للهوست فقط (صاحب الغرفة)، وفي مرحلة اللعب فقط — فلا يحوّلها أحد بعد انتهائها.
 */
export const retuneDifficulty = mutation({
  args: { code: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول.");

    const room = await readRoom(ctx, args.code.trim().toUpperCase());
    if (!room) throw new Error("الغرفة غير موجودة.");
    const { game, inputs } = room;

    if ((game.hostId as unknown as string) !== (meId as unknown as string)) {
      throw new Error("صاحب الغرفة فقط يضبط الصعوبة.");
    }
    if (game.status !== "playing") {
      throw new Error("الضبط التكيّفي يعمل داخل الجولة الجارية فقط.");
    }

    const rows = buildLiveRows(inputs);
    const call = recommendDifficulty(rows);
    const plan = planTail(game.questionIds.length, game.currentQuestionIndex);
    if (!plan.shouldRetune) throw new Error(plan.why);

    const last = await ctx.db
      .query("gameAdaptations")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .order("desc")
      .first();

    if (!args.force) {
      const prev = last
        ? { difficulty: last.toDifficulty as LiveDifficulty, hardRatio: last.toHardRatio }
        : null;
      if (!worthRetuning(prev, call)) {
        return {
          changed: false,
          swappedCount: 0,
          difficulty: call.difficulty,
          reason: `لا تغيير يستحق التنفيذ — ${call.reason}`,
        };
      }
    }

    // الأسئلة الجديدة للمتبقي فقط، بنفس فئات الغرفة ونفس العدد
    const tailCount = plan.tailCount;
    const fresh = await pickQuestions(ctx, categoriesOf(game), tailCount, call.hardRatio);
    if (fresh.length === 0) throw new Error("لا توجد أسئلة متاحة لإعادة الاختيار.");

    // ممنوع تكرار سؤال وُجد في الجزء المُجاب عنه (جارٍ فعلاً أو انتهى)
    const head = game.questionIds.slice(0, plan.tailStart);
    const headSet = new Set(head);
    const picked = fresh.filter((id) => !headSet.has(id)).slice(0, tailCount);
    if (picked.length === 0) throw new Error("لم يتوفر بديل جديد للأسئلة المتبقية.");

    const nextIds = [...head, ...picked, ...game.questionIds.slice(plan.tailStart + picked.length)];
    const swappedCount = picked.length;

    await ctx.db.patch(game._id, { questionIds: nextIds });

    await ctx.db.insert("gameAdaptations", {
      gameId: game._id,
      code: game.code,
      actorId: meId,
      actorName: (await ctx.db.get(meId))?.name ?? "صاحب الغرفة",
      atQuestionIndex: game.currentQuestionIndex,
      fromDifficulty: last?.toDifficulty ?? "medium",
      toDifficulty: call.difficulty,
      fromHardRatio: last?.toHardRatio ?? 0.2,
      toHardRatio: call.hardRatio,
      roomAccuracy: call.roomAccuracy,
      sample: call.sample,
      swappedCount,
      reason: call.reason,
      createdAt: Date.now(),
    });

    return {
      changed: true,
      swappedCount,
      difficulty: call.difficulty,
      hardRatio: call.hardRatio,
      roomAccuracy: call.roomAccuracy,
      reason: call.reason,
    };
  },
});

/**
 * 👑 سيطرة المالك — كل غرفة جارية الآن بأرقامها الحقيقية + سجل الضبط التكيّفي.
 *
 * الغرض التشخيصي: غرفة تُعدَّل باستمرار = أسئلتها لا تناسب فئتها، أو لاعبون
 * بمستوى متباعد جداً. وغرفة بدقّة قريبة من الصفر = أسئلة أصعب من اللاعبين.
 * وهذا ما لا يُرى من أي لوحة أخرى.
 */
export const ownerLiveRooms = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const me = meId ? await ctx.db.get(meId) : null;
    const isOwner =
      Boolean(me) &&
      ((me as unknown as { role?: string }).role === "admin" ||
        (me as unknown as { email?: string }).email === "omw70op@gmail.com");
    if (!isOwner) return null;

    const limit = Math.max(3, Math.min(30, Math.floor(args.limit ?? 15)));
    const live = await ctx.db
      .query("games")
      .withIndex("by_status_created", (q) => q.eq("status", "playing"))
      .order("desc")
      .take(limit);

    const rooms: {
      code: string;
      questionIndex: number;
      totalQuestions: number;
      players: number;
      answered: number;
      roomAccuracy: number;
      difficulty: string;
      hardRatio: number;
      canRetune: boolean;
      adaptations: number;
      reason: string;
    }[] = [];

    for (const g of live) {
      const room = await readRoom(ctx, g.code);
      if (!room) continue;
      const rows = buildLiveRows(room.inputs);
      const call = recommendDifficulty(rows);
      const plan = planTail(room.game.questionIds.length, room.game.currentQuestionIndex);
      const log = await ctx.db
        .query("gameAdaptations")
        .withIndex("by_game", (q) => q.eq("gameId", room.game._id))
        .take(50);
      rooms.push({
        code: room.game.code,
        questionIndex: room.game.currentQuestionIndex,
        totalQuestions: room.game.questionIds.length,
        players: rows.length,
        answered: call.sample,
        roomAccuracy: call.roomAccuracy,
        difficulty: call.difficulty,
        hardRatio: call.hardRatio,
        canRetune: plan.shouldRetune,
        adaptations: log.length,
        reason: call.reason,
      });
    }

    const adaptations = await ctx.db.query("gameAdaptations").withIndex("by_created").order("desc").take(30);

    return {
      live: rooms,
      totals: {
        liveRooms: rooms.length,
        playersLive: rooms.reduce((s, r) => s + r.players, 0),
        answeredLive: rooms.reduce((s, r) => s + r.answered, 0),
        roomsAdapted: rooms.filter((r) => r.adaptations > 0).length,
      },
      adaptations: adaptations.map((r) => ({
        id: r._id as unknown as string,
        code: r.code,
        actorName: r.actorName,
        atQuestionIndex: r.atQuestionIndex,
        fromDifficulty: r.fromDifficulty,
        toDifficulty: r.toDifficulty,
        roomAccuracy: r.roomAccuracy,
        sample: r.sample,
        swappedCount: r.swappedCount,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  },
});

/**
 * 👑 سيطرة المالك — سجل تعديلات الصعوبة الحيّة في كل الغرف.
 * يُستخدم لكشف غرفة تُعدَّل باستمرار (قد يعني أسئلة غير مناسبة للفئة).
 */
export const ownerAdaptationLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const me = meId ? await ctx.db.get(meId) : null;
    const isOwner =
      Boolean(me) &&
      ((me as unknown as { role?: string }).role === "admin" ||
        (me as unknown as { email?: string }).email === "omw70op@gmail.com");
    if (!isOwner) return null;

    const limit = Math.max(5, Math.min(80, Math.floor(args.limit ?? 30)));
    const rows = await ctx.db.query("gameAdaptations").withIndex("by_created").order("desc").take(limit);

    const byRoom = new Map<string, number>();
    for (const r of rows) byRoom.set(r.code, (byRoom.get(r.code) ?? 0) + 1);

    return {
      total: rows.length,
      roomsTouched: byRoom.size,
      busiest: [...byRoom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, count]) => ({ code, count })),
      rows: rows.map((r) => ({
        id: r._id as unknown as string,
        code: r.code,
        actorName: r.actorName,
        atQuestionIndex: r.atQuestionIndex,
        fromDifficulty: r.fromDifficulty,
        toDifficulty: r.toDifficulty,
        roomAccuracy: r.roomAccuracy,
        sample: r.sample,
        swappedCount: r.swappedCount,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  },
});
