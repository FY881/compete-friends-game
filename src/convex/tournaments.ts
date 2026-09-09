/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 5 — البطولات الأسبوعية
 *
 * بطولة تجميعية: يلعب اللاعبون جولاتهم العادية خلال نافذة البطولة،
 * ويُحتسب لكل لاعب مجموع أفضل N جولات تلقائياً من gameHistory.
 * - join: تسجيل يدوي (أو تلقائي عند أول جولة)
 * - recordRound: يستدعى داخلياً عند انتهاء أي جولة أثناء بطولة نشطة
 * - getLeaderboard: لوحة الصدارة الحية
 * - create/end: للمالك من غرفة المالك (مع سجلّ القرارات)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";

const TROPHY_EMOJIS = ["🥇", "🥈", "🥉"];

/** البطولة النشطة الآن (خلال نافذتها الزمنية). */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return rows.find((t) => t.startsAt <= now && t.endsAt > now) ?? null;
  },
});

/** لوحة الصدارة الحية لبطولة (عام — تُعرض للجميع). */
export const getLeaderboard = query({
  args: { tournamentId: v.id("tournaments"), limit: v.optional(v.number()) },
  handler: async (ctx, { tournamentId, limit }) => {
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const entries = await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const sorted = entries.sort((a, b) => b.totalScore - a.totalScore).slice(0, take);
    return sorted.map((e, i) => ({
      rank: i + 1,
      trophy: TROPHY_EMOJIS[i] ?? null,
      userId: e.userId,
      userName: e.userName,
      totalScore: e.totalScore,
      roundsCounted: e.roundsCounted,
    }));
  },
});

/** بطولات سابقة مع الفائزين (عام). */
export const getPast = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 5, 1), 20);
    const rows = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "ended"))
      .collect();
    const sorted = rows.sort((a, b) => b.endsAt - a.endsAt).slice(0, take);
    return Promise.all(
      sorted.map(async (t) => {
        const winners = t.winnerIds
          ? (await Promise.all(t.winnerIds.map((id) => ctx.db.get(id)))).map(
              (u, i) => ({ name: u?.name ?? "مجهول", trophy: TROPHY_EMOJIS[i] ?? "🏅" }),
            )
          : [];
        return {
          id: t._id,
          name: t.name,
          endsAt: t.endsAt,
          winners,
        };
      }),
    );
  },
});

/** هل أنا مشترك في البطولة؟ وما ترتيبي؟ (عام). */
export const getMyEntry = query({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const entry = await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (!entry) return { joined: false, totalScore: 0, rank: null };
    const entries = await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const rank = entries.filter((e) => e.totalScore > entry.totalScore).length + 1;
    return { joined: true, totalScore: entry.totalScore, rank };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// التسجيل اليدوي
// ─────────────────────────────────────────────────────────────────────────

export const join = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const t = await ctx.db.get(tournamentId);
    if (!t || t.status !== "active" || t.endsAt <= Date.now()) {
      throw new Error("البطولة غير نشطة");
    }
    const existing = await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (existing) return { already: true };
    const me = await ctx.db.get(userId);
    await ctx.db.insert("tournamentEntries", {
      tournamentId,
      userId,
      userName: me?.name ?? "مجهول",
      totalScore: 0,
      roundsCounted: 0,
      joinedAt: Date.now(),
    });
    return { already: false };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// احتساب جولة منتهية — يُستدعى داخلياً من انتهاء الجولات
// ─────────────────────────────────────────────────────────────────────────

/** بيانات جولة منتهية (internal). */
export const getRoundForTournament = internalQuery({
  args: { historyId: v.id("gameHistory") },
  handler: async (ctx, { historyId }) => {
    const h = await ctx.db.get(historyId);
    if (!h) return null;
    const active = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const tournament = active.find((t) => t.startsAt <= h.playedAt && h.playedAt < t.endsAt);
    if (!tournament) return null;
    return {
      tournamentId: tournament._id,
      bestRounds: tournament.bestRoundsCount,
      userId: h.userId,
      score: h.score,
    };
  },
});

export const getUserEntry = internalQuery({
  args: { tournamentId: v.id("tournaments"), userId: v.id("users") },
  handler: async (ctx, { tournamentId, userId }) => {
    return await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
  },
});

export const getBestRounds = internalQuery({
  args: { tournamentId: v.id("tournaments"), userId: v.id("users"), from: v.number() },
  handler: async (ctx, { tournamentId, userId, from }) => {
    void tournamentId;
    const rounds = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rounds
      .filter((r) => r.playedAt >= from)
      .map((r) => r.score)
      .sort((a, b) => b - a);
  },
});

/**
 * تُستدعى بعد تسجيل أي جولة في gameHistory — تُسجّل اللاعب تلقائياً
 * وتعيد حساب مجموع أفضل N جولات خلال البطولة.
 */
export const recordRound = internalMutation({
  args: { historyId: v.id("gameHistory") },
  handler: async (ctx, { historyId }) => {
    const data = await ctx.runQuery(internal.tournaments.getRoundForTournament, { historyId });
    if (!data) return; // لا بطولة نشطة تغطي وقت الجولة

    const tournamentId = data.tournamentId;
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) return;

    // تسجيل تلقائي عند أول جولة
    let entry = await ctx.runQuery(internal.tournaments.getUserEntry, {
      tournamentId,
      userId: data.userId,
    });
    if (!entry) {
      const me = await ctx.db.get(data.userId);
      const entryId = await ctx.db.insert("tournamentEntries", {
        tournamentId,
        userId: data.userId,
        userName: me?.name ?? "مجهول",
        totalScore: 0,
        roundsCounted: 0,
        joinedAt: Date.now(),
      });
      entry = await ctx.db.get(entryId);
      if (!entry) return;
    }

    // أعد حساب مجموع أفضل N جولات منذ بداية البطولة
    const scores = await ctx.runQuery(internal.tournaments.getBestRounds, {
      tournamentId,
      userId: data.userId,
      from: tournament.startsAt,
    });
    const best = scores.slice(0, tournament.bestRoundsCount);
    const total = best.reduce((a: number, b: number) => a + b, 0);
    await ctx.db.patch(entry._id, {
      totalScore: total,
      roundsCounted: best.length,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إدارة المالك
// ─────────────────────────────────────────────────────────────────────────

async function requireStaff(ctx: Parameters<typeof mutation>[0] extends never ? never : import("./_generated/server").MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
  const me = await ctx.db.get(userId);
  if (!isStaffUser(me)) throw new Error("غير مصرح");
  return me;
}

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    durationDays: v.number(), // 1 = يوم واحد، 7 = أسبوع
    bestRoundsCount: v.number(),
  },
  handler: async (ctx, { name, description, durationDays, bestRoundsCount }) => {
    await requireStaff(ctx);
    // لا توجد بطولتان نشطتان معاً
    const activeRows = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const stillActive = activeRows.find((t) => t.endsAt > Date.now());
    if (stillActive) throw new Error(`توجد بطولة نشطة بالفعل: «${stillActive.name}»`);

    const now = Date.now();
    const id = await ctx.db.insert("tournaments", {
      name: name.trim(),
      description: description?.trim(),
      status: "active",
      startsAt: now,
      endsAt: now + Math.max(durationDays, 1) * 24 * 60 * 60 * 1000,
      bestRoundsCount: Math.max(bestRoundsCount, 1),
      createdAt: now,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "المالك",
      action: "tournament_created",
      targetName: name.trim(),
      detail: `إطلاق بطولة «${name.trim()}» لمدة ${Math.max(durationDays, 1)} يوم — تحتسب أفضل ${Math.max(bestRoundsCount, 1)} جولات`,
      severity: "medium",
      createdAt: now,
    });
    return { id };
  },
});

export const end = mutation({
  args: { tournamentId: v.id("tournaments") },
  handler: async (ctx, { tournamentId }) => {
    await requireStaff(ctx);
    const t = await ctx.db.get(tournamentId);
    if (!t || t.status !== "active") throw new Error("البطولة غير نشطة");

    // الفائزون الثلاثة الأوائل
    const entries = await ctx.db
      .query("tournamentEntries")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const top = entries.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

    await ctx.db.patch(tournamentId, {
      status: "ended",
      endsAt: Date.now(),
      winnerIds: top.map((e) => e.userId),
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "المالك",
      action: "tournament_ended",
      targetName: t.name,
      detail: `إنهاء بطولة «${t.name}» — الفائز: ${top[0]?.userName ?? "لا مشاركين"}`,
      severity: "medium",
      createdAt: Date.now(),
    });
    return { winners: top.map((e) => e.userName) };
  },
});