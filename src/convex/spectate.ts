/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👀 المشجعون — شاهد مبارزة أصدقائك حياً وعلّق عليها
 *
 *  - انضم كمشجع لأي مبارزة حلبة جارية (بلا أي قدرة على الإجابة)
 *  - بث حي: ترى الأسئلة المكشوفة، النتائج، وعدّادات اللاعبين لحظة بلحظة
 *  - دردشة مشجعين مستقلة داخل المبارزة (أحدث 50 رسالة)
 *  - الطاقة الحية: يُحسب «مشاهدون الآن» لحظياً
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const MAX_SPECTATORS = 50;
const CHAT_KEEP = 50;
const HEARTBEAT_MS = 60_000; // المشجع «حاضر» إذا نبض خلال الدقيقة الأخيرة

// ─────────────────────────────────────────────────────────────────────────
// الانضمام والمغادرة ونبض الحضور
// ─────────────────────────────────────────────────────────────────────────

/** انضم كمشجع إلى مبارزة جارية برمز الغرفة. */
export const joinAsSpectator = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("المستخدم غير موجود");

    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) throw new Error("المبارزة غير موجودة");
    if (game.status === "finished") throw new Error("انتهت هذه المبارزة بالفعل");

    // لاعب في الغرفة؟ لا حاجة لمقعد مشجع
    const roomPlayers = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (roomPlayers.some((p) => p.userId === userId)) {
      return { alreadyPlayer: true as const };
    }

    const existing = await ctx.db
      .query("spectators")
      .withIndex("by_game_user", (q) => q.eq("gameId", game._id).eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastHeartbeat: Date.now() });
      return { alreadySpectator: true as const };
    }

    const count = (await ctx.db
      .query("spectators")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect()).length;
    if (count >= MAX_SPECTATORS) throw new Error("قاعة المشجعين ممتلئة");

    await ctx.db.insert("spectators", {
      gameId: game._id,
      userId,
      name: me.name ?? "مشجع",
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
    });
    return { joined: true as const };
  },
});

/** اترك قاعة المشجعين. */
export const leaveSpectators = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) return;
    const row = await ctx.db
      .query("spectators")
      .withIndex("by_game_user", (q) => q.eq("gameId", game._id).eq("userId", userId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

/** نبض حضور — يستدعيه عميل المشجع دورياً ليُحسب ضمن «مشاهدون الآن». */
export const heartbeat = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) return;
    const row = await ctx.db
      .query("spectators")
      .withIndex("by_game_user", (q) => q.eq("gameId", game._id).eq("userId", userId))
      .first();
    if (row) await ctx.db.patch(row._id, { lastHeartbeat: Date.now() });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// دردشة المشجعين
// ─────────────────────────────────────────────────────────────────────────

/** أرسل رسالة في دردشة مشجعي المبارزة. */
export const sendSpectatorMessage = mutation({
  args: { code: v.string(), content: v.string() },
  handler: async (ctx, { code, content }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    const clean = content.trim().slice(0, 200);
    if (!clean) throw new Error("الرسالة فارغة");

    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) throw new Error("المبارزة غير موجودة");

    // يُسمح للجميع بالتعليق — مشجع مسجل أو حتى لاعب يشجع خصمه 😄
    const spectator = await ctx.db
      .query("spectators")
      .withIndex("by_game_user", (q) => q.eq("gameId", game._id).eq("userId", userId))
      .first();

    await ctx.db.insert("spectatorMessages", {
      gameId: game._id,
      senderId: userId,
      senderName: me?.name ?? "مشجع",
      content: clean,
      createdAt: Date.now(),
      isSpectator: spectator != null,
    });

    // نظّف الرسائل القديمة (أبقِ أحدث 50)
    const all = await ctx.db
      .query("spectatorMessages")
      .withIndex("by_game_time", (q) => q.eq("gameId", game._id))
      .order("desc")
      .take(CHAT_KEEP + 20);
    const excess = all.slice(CHAT_KEEP);
    for (const m of excess) await ctx.db.delete(m._id);

    return { ok: true };
  },
});

/** رسائل دردشة المشجعين — بث حي. */
export const getSpectatorChat = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) return [];
    const msgs = await ctx.db
      .query("spectatorMessages")
      .withIndex("by_game_time", (q) => q.eq("gameId", game._id))
      .order("desc")
      .take(CHAT_KEEP);
    return msgs.reverse().map((m) => ({
      id: m._id,
      senderName: m.senderName,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// حالة المشجع — بث حي لكل ما يراه المشجع
// ─────────────────────────────────────────────────────────────────────────

/** لوحة المشجع: الأسئلة المكشوفة + نتائج اللاعبين + من يشاهد الآن. */
export const getSpectatorView = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) return null;

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    const names = new Map<string, string>();
    for (const p of players) names.set(p.userId, p.name);
    if (players.length < 2) {
      // غرفة بانتظار اللاعب الثاني — اجلب اسم المضيف
      const host = await ctx.db.get(game.hostId);
      if (host) names.set(host._id, host.name ?? "مضيف");
    }

    // الأسئلة المكشوفة فقط (المحلولة) — المشجع لا يرى القادمة
    const revealed = game.currentQuestionIndex;
    const currentRevealed = game.status === "finished" || game.phase === "revealing";
    const questions = [] as {
      index: number;
      question: string;
      options: string[];
      correctIndex: number | null;
    }[];
    for (let i = 0; i < Math.min(revealed + (currentRevealed ? 1 : 0), game.questionIds.length); i++) {
      const qid = game.questionIds[i];
      const row = await ctx.db
        .query("aiQuestions")
        .withIndex("by_qid", (q) => q.eq("qid", qid))
        .first();
      const staticQ = row
        ? null
        : await (async () => {
            // السؤال من البنك الثابت — استعنه عبر جدول games المخزّن
            return null;
          })();
      void staticQ;
      if (!row) continue;
      const isPast = i < revealed || currentRevealed;
      questions.push({
        index: i,
        question: row.question,
        options: row.options,
        correctIndex: isPast ? row.correctIndex : null,
      });
    }

    const now = Date.now();
    const spectatorRows = await ctx.db
      .query("spectators")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const activeSpectators = spectatorRows.filter((s) => now - s.lastHeartbeat < HEARTBEAT_MS * 2);

    return {
      status: game.status,
      phase: game.phase,
      currentQuestionIndex: game.currentQuestionIndex,
      questionCount: game.questionIds.length,
      questionStartedAt: game.questionStartedAt,
      roundEndsAt: game.roundEndsAt ?? null,
      arenaDuel: game.arenaDuel ?? false,
      players: players
        .map((p) => ({
          userId: p.userId,
          name: p.name,
          score: p.score,
          streak: p.streak,
          answeredCurrent: (p.answers[game.currentQuestionIndex] ?? null) != null,
        }))
        .sort((a, b) => b.score - a.score),
      questions,
      spectatorCount: activeSpectators.length,
      spectatorNames: activeSpectators.slice(0, 8).map((s) => s.name),
    };
  },
});

/** هل المشجعون مسموحون في هذه الغرفة؟ (مبارزات الحلبة + أي غرفة نشطة) */
export const canSpectate = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!game) return { exists: false as const, spectatable: false as const };
    return {
      exists: true as const,
      spectatable: game.status !== "finished",
      arenaDuel: game.arenaDuel ?? false,
      status: game.status,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// التدبير الآلي — تنظيف مشجعي المباريات المنتهية (يُستدعى من auto-admin)
// ─────────────────────────────────────────────────────────────────────────

export const cleanupSpectators = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("spectators")
      .filter((s) => s.lt(s.field("lastHeartbeat"), now - 30 * 60_000))
      .collect();
    for (const s of stale) await ctx.db.delete(s._id);
    return { removed: stale.length };
  },
});
