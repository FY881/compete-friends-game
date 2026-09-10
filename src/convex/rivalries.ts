/**
 * ═══════════════════════════════════════════════════════════════════════
 * التنافس المباشر — «أنت ضد صديق» (Rivalries)
 *
 * بعد كل جولة مشتركة (غرفة بها لاعبان أو أكثر) تُحدَّث إحصائيات كل زوج
 * تلقائياً: انتصارات، هزائم، تعادلات، وآخر نتيجة. اللوحة تعرض «أنت ضد
 * فلان — X فوز مقابل Y» مع زر مبارزة ثأرية ينشئ غرفة جديدة بالطرفين.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, internalMutation, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

type DbCtx = { db: any };

/**
 * سجّل نتيجة جولة لكل زوج لاعبين في الغرفة — تُستدعى من games.finishGame.
 * تحدّث/تنشئ صف التنافس لكل تركيبة (a,b) بترتيب معجمي ثابت.
 */
export const recordRivalryRound = internalMutation({
  args: {
    gameCode: v.string(),
    /** مرتّبة من الأول إلى الأخير بعد الفرز النهائي: [{userId, score, won}] */
    results: v.array(
      v.object({
        userId: v.id("users"),
        score: v.number(),
        won: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { results, gameCode }) => {
    if (results.length < 2) return;

    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q: any) => q.eq("code", gameCode))
      .first();
    const gameId: Id<"games"> | undefined = game?._id;

    const now = Date.now();

    // كل تركيبة زوج فريدة
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const p = results[i];
        const q = results[j];
        const [aId, bId] =
          String(p.userId) < String(q.userId)
            ? [p.userId, q.userId]
            : [q.userId, p.userId];
        const aScore = String(p.userId) < String(q.userId) ? p.score : q.score;
        const bScore = String(p.userId) < String(q.userId) ? q.score : p.score;

        const existing = await ctx.db
          .query("rivalries")
          .withIndex("by_pair", (x: any) => x.eq("aId", aId).eq("bId", bId))
          .first();

        if (existing) {
          const aWins = existing.aWins + (aScore > bScore ? 1 : 0);
          const bWins = existing.bWins + (bScore > aScore ? 1 : 0);
          const draws = existing.draws + (aScore === bScore ? 1 : 0);
          await ctx.db.patch(existing._id, {
            aWins,
            bWins,
            draws,
            totalGames: existing.totalGames + 1,
            lastGameId: gameId ?? existing.lastGameId,
            lastWinnerId:
              aScore === bScore ? undefined : aScore > bScore ? aId : bId,
            lastPlayedAt: now,
          });
        } else {
          await ctx.db.insert("rivalries", {
            aId,
            bId,
            aWins: aScore > bScore ? 1 : 0,
            bWins: bScore > aScore ? 1 : 0,
            draws: aScore === bScore ? 1 : 0,
            totalGames: 1,
            lastGameId: gameId,
            lastWinnerId:
              aScore === bScore ? undefined : aScore > bScore ? aId : bId,
            lastPlayedAt: now,
          });
        }
      }
    }
  },
});

/** لوحة تنافسي: كل خصومي مرتّبين حسب حدّة التنافس (عدد المواجهات). */
export const getMyRivalries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const asA = await ctx.db
      .query("rivalries")
      .withIndex("by_a", (q: any) => q.eq("aId", userId))
      .collect();
    const asB = await ctx.db
      .query("rivalries")
      .withIndex("by_b", (q: any) => q.eq("bId", userId))
      .collect();

    const rows = [...asA, ...asB].sort(
      (x, y) => y.totalGames - x.totalGames || y.lastPlayedAt - x.lastPlayedAt,
    );

    const out = [];
    for (const r of rows.slice(0, 12)) {
      const opponentId = r.aId === userId ? r.bId : r.aId;
      const opponent = await ctx.db.get(opponentId);
      const myWins = r.aId === userId ? r.aWins : r.bWins;
      const theirWins = r.aId === userId ? r.bWins : r.aWins;
      out.push({
        opponentId,
        opponentName: opponent?.name ?? "لاعب",
        myWins,
        theirWins,
        draws: r.draws,
        totalGames: r.totalGames,
        lastWinnerId: r.lastWinnerId ?? null,
        lastWonByMe: r.lastWinnerId != null && r.lastWinnerId === userId,
        lastPlayedAt: r.lastPlayedAt,
      });
    }
    return out;
  },
});

/** مبارزة ثأرية — أنشئ غرفة جديدة بنفس الزوج فوراً. */
export const startRematch = mutation({
  args: { opponentId: v.id("users") },
  handler: async (ctx, { opponentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (userId === opponentId) throw new Error("لا يمكنك تحدي نفسك");

    const [me, opponent] = await Promise.all([
      ctx.db.get(userId),
      ctx.db.get(opponentId),
    ]);
    if (!opponent) throw new Error("الخصم غير موجود");

    // أنشئ غرفة حلبة حقيقية بين اللاعبين — ترث آليات المبارزة كاملة
    const code: string = await ctx.runMutation(internal.arena.createDuelRoom, {
      hostId: userId,
      guestId: opponentId,
    });
    return { code, opponentName: me?.name ?? "" };
  },
});
