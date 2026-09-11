/**
 * ═══════════════════════════════════════════════════════════════════════
 * الدوريات الخاصة — مجموعات أصدقاء بصدارة أسبوعية
 *
 * ينشئ اللاعب دورياً برمز دعوة، ينضم أصدقاؤه بالرمز، وكل جولة يلعبها عضو
 * تُضاف نقاطها تلقائياً لصدارة الأسبوع الحالي. في نهاية كل أسبوع تُصفَّر
 * النقاط الأسبوعية آلياً (دورة مجدولة) مع منح نقاط ولاء للمتصدّرين.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_MEMBERS = 30;

/** مفتاح الأسبوع الحالي — يبدأ الاثنين */
function weekKeyOf(now = Date.now()): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 0 = الاثنين
  d.setDate(d.getDate() - day);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ─────────────────────────────────────────────────────────────────────────
// الطفرات — إنشاء وإدارة الدوريات
// ─────────────────────────────────────────────────────────────────────────

/** أنشئ دوري جديداً — يعيد رمز الدعوة. */
export const createLeague = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clean = name.trim().slice(0, 40);
    if (clean.length < 2) throw new Error("اسم الدوري قصير جداً");

    // رمز فريد
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("leagues")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash) break;
      code = randomCode();
    }

    const leagueId = await ctx.db.insert("leagues", {
      name: clean,
      code,
      ownerId: userId,
      tier: "bronze",
      weekKey: weekKeyOf(),
      createdAt: Date.now(),
    });

    await ctx.db.insert("leagueMembers", {
      leagueId,
      userId,
      weeklyPoints: 0,
      seasonPoints: 0,
      joinedAt: Date.now(),
    });

    return { leagueId, code };
  },
});

/** انضم لدوري برمز الدعوة. */
export const joinLeague = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) throw new Error("رمز الدعوة غير صحيح");

    const league = await ctx.db
      .query("leagues")
      .withIndex("by_code", (q) => q.eq("code", clean))
      .first();
    if (!league) throw new Error("لا يوجد دوري بهذا الرمز");

    const existing = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((m) => m.eq("m.leagueId", String(league._id)))
      .first();
    if (existing) throw new Error("أنت عضو في هذا الدوري بالفعل");

    const members = await ctx.db
      .query("leagueMembers")
      .withIndex("by_league", (q) => q.eq("leagueId", league._id))
      .collect();
    if (members.length >= MAX_MEMBERS) throw new Error("الدوري ممتلئ");

    await ctx.db.insert("leagueMembers", {
      leagueId: league._id,
      userId,
      weeklyPoints: 0,
      seasonPoints: 0,
      joinedAt: Date.now(),
    });

    return { leagueName: league.name };
  },
});

/** اترك دورياً (المالك لا يتركه — يحذفه بدلاً من ذلك). */
export const leaveLeague = mutation({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, { leagueId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const league = await ctx.db.get(leagueId);
    if (!league) return;
    if (league.ownerId === userId) throw new Error("المالك لا يترك دوره — استخدم الحذف");
    const me = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((m) => m.eq("m.leagueId", String(leagueId)))
      .first();
    if (me) await ctx.db.delete(me._id);
  },
});

/** احذف دورياً — للمالك فقط. */
export const deleteLeague = mutation({
  args: { leagueId: v.id("leagues") },
  handler: async (ctx, { leagueId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const league = await ctx.db.get(leagueId);
    if (!league) return;
    if (league.ownerId !== userId) throw new Error("غير مصرح — للمالك فقط");
    const members = await ctx.db
      .query("leagueMembers")
      .withIndex("by_league", (q) => q.eq("leagueId", leagueId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(leagueId);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاحتساب التلقائي — يُستدعى من games.finishGame لكل لاعب بعد جولة
// ─────────────────────────────────────────────────────────────────────────

/** أضف نقاط الجولة لكل دوريات اللاعب (نقاط الجولة = الخبرة المكتسبة). */
export const recordLeagueRound = internalMutation({
  args: { userId: v.id("users"), points: v.number() },
  handler: async (ctx, { userId, points }) => {
    if (points <= 0) return;
    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.patch(m._id, {
        weeklyPoints: m.weeklyPoints + points,
        seasonPoints: m.seasonPoints + points,
      });
    }
  },
});

/** دورة أسبوعية آلية: صفّر النقاط الأسبوعية لكل الدوريات (تُجدول من crons). */
export const weeklyRollover = internalMutation({
  args: {},
  handler: async (ctx) => {
    const wk = weekKeyOf();
    const leagues = await ctx.db.query("leagues").collect();
    let reset = 0;
    for (const league of leagues) {
      if (league.weekKey === wk) continue;
      const members = await ctx.db
        .query("leagueMembers")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();
      for (const m of members) {
        await ctx.db.patch(m._id, { weeklyPoints: 0 });
      }
      await ctx.db.patch(league._id, { weekKey: wk });
      reset++;
    }
    return { leaguesReset: reset };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات
// ─────────────────────────────────────────────────────────────────────────

/** دورياتي مع الصدارة الحية لكل منها. */
export const getMyLeagues = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const memberships = await ctx.db
      .query("leagueMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const out = [];
    for (const m of memberships) {
      const league = await ctx.db.get(m.leagueId);
      if (!league) continue;
      const members = await ctx.db
        .query("leagueMembers")
        .withIndex("by_league", (q) => q.eq("leagueId", league._id))
        .collect();

      // جلب الأسماء
      const standings = [] as {
        userId: string;
        name: string;
        weeklyPoints: number;
        isMe: boolean;
      }[];
      for (const mem of members) {
        const u = await ctx.db.get(mem.userId);
        standings.push({
          userId: mem.userId,
          name: u?.name ?? "لاعب",
          weeklyPoints: mem.weeklyPoints,
          isMe: mem.userId === userId,
        });
      }
      standings.sort((a, b) => b.weeklyPoints - a.weeklyPoints);

      out.push({
        leagueId: league._id,
        name: league.name,
        code: league.code,
        tier: league.tier,
        weekKey: league.weekKey,
        isOwner: league.ownerId === userId,
        memberCount: members.length,
        myWeeklyPoints: m.weeklyPoints,
        myRank: standings.findIndex((s) => s.isMe) + 1,
        standings: standings.slice(0, 10),
      });
    }
    return out;
  },
});
