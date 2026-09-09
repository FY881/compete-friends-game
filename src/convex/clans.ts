/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 12 — العشائر وحروبها الأسبوعية (Clans & Clan Wars)
 *
 * اللاعب ينشئ عشيرة (حتى 20 عضواً) باسم وشعار، ينضم بأعضاء، وتجمع
 * العشيرة نقاط حرب أسبوعية تلقائياً من جولات أعضائها الحقيقية
 * (فوز/مشاركة/دقة). كل أسبوع تُصفَّر النقاط ويُتوَّج صاحب الصدارة.
 * كل عشيرة لها دردشة داخلية خاصة بأعضائها.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { isUserBanned } from "./owner";

export const MAX_CLAN_MEMBERS = 20;
const MAX_NAME = 24;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// نقاط الحرب لكل جولة عضو (تُحتسب من gameHistory الحقيقية)
const WAR_POINTS = {
  participation: 5,
  win: 15,
  perfect: 10, // دقة كاملة
  highScore: 1, // لكل 100 نقطة في الجولة (تقريب)
};

type DbCtx = { db: any };

function weekKey(t: number): number {
  return Math.floor(t / WEEK_MS) * WEEK_MS;
}

/** عشيرتي + هل أنا مالك + نقاط الأسبوع. */
export const getMyClan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const all = await ctx.db.query("clans").collect();
    const mine = all.find((c: any) => c.members.includes(userId));
    if (!mine) return null;
    const now = Date.now();
    const resetDue = now - mine.weeklyResetAt >= WEEK_MS;
    return {
      id: mine._id,
      name: mine.name,
      emoji: mine.emoji,
      isOwner: mine.ownerId === userId,
      memberCount: mine.members.length,
      pointsThisWeek: mine.pointsThisWeek,
      totalPoints: mine.totalPoints,
      resetDue,
      weekEndsAt: mine.weeklyResetAt + WEEK_MS,
    };
  },
});

/** لوحة صدارة العشائر — مرتبة بنقاط الأسبوع. */
export const getClanLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 25);
    const rows = await ctx.db
      .query("clans")
      .withIndex("by_points", (q) => q.gte("pointsThisWeek", 0))
      .order("desc")
      .take(take);
    const now = Date.now();
    return rows.map((c: any, i: number) => ({
      rank: i + 1,
      id: c._id,
      name: c.name,
      emoji: c.emoji,
      pointsThisWeek: c.pointsThisWeek,
      totalPoints: c.totalPoints,
      memberCount: c.members.length,
      weekEndsAt: c.weeklyResetAt + WEEK_MS,
      resetDue: now - c.weeklyResetAt >= WEEK_MS,
    }));
  },
});

/** ابحث عن عشائر للانضمام (تعرض أيضاً من يملكها). */
export const browseClans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("clans")
      .withIndex("by_points", (q) => q.gte("pointsThisWeek", 0))
      .order("desc")
      .take(30);
    return rows
      .filter((c: any) => !c.members.includes(userId))
      .map((c: any) => ({
        id: c._id,
        name: c.name,
        emoji: c.emoji,
        memberCount: c.members.length,
        pointsThisWeek: c.pointsThisWeek,
        full: c.members.length >= MAX_CLAN_MEMBERS,
      }));
  },
});

/** دردشة العشيرة — لأعضائها فقط. */
export const getClanChat = query({
  args: { clanId: v.id("clans"), limit: v.optional(v.number()) },
  handler: async (ctx, { clanId, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) return null;
    const msgs = await ctx.db
      .query("clanMessages")
      .withIndex("by_clan", (q) => q.eq("clanId", clanId))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 40, 1), 100));
    return msgs.reverse().map((m: any) => ({
      id: m._id,
      senderId: m.senderId,
      senderName: m.senderName,
      content: m.content,
      createdAt: m.createdAt,
      mine: m.senderId === userId,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الطفرات — إنشاء/انضمام/خروج/دردشة
// ─────────────────────────────────────────────────────────────────────────

export const createClan = mutation({
  args: { name: v.string(), emoji: v.string() },
  handler: async (ctx, { name, emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if (!user || isUserBanned(user).banned) throw new Error("غير مصرح");

    const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
    if (clean.length < 3) throw new Error("اسم العشيرة قصير جداً (3 أحرف على الأقل)");

    const all = await ctx.db.query("clans").collect();
    if (all.some((c: any) => c.name === clean)) {
      throw new Error("اسم العشيرة مستخدم — اختر اسماً آخر");
    }
    if (all.some((c: any) => c.members.includes(userId))) {
      throw new Error("أنت في عشيرة بالفعل — اتركها أولاً");
    }

    const id = await ctx.db.insert("clans", {
      name: clean,
      emoji: [...emoji][0] ?? "🛡️",
      ownerId: userId,
      members: [userId],
      pointsThisWeek: 0,
      totalPoints: 0,
      weeklyResetAt: weekKey(Date.now()),
      createdAt: Date.now(),
    });
    return { id, name: clean };
  },
});

export const joinClan = mutation({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan) throw new Error("العشيرة غير موجودة");
    if (clan.members.includes(userId)) return { ok: true };
    if (clan.members.length >= MAX_CLAN_MEMBERS) {
      throw new Error("العشيرة ممتلئة (20 عضواً)");
    }
    const all = await ctx.db.query("clans").collect();
    if (all.some((c: any) => c.members.includes(userId))) {
      throw new Error("أنت في عشيرة بالفعل — اتركها أولاً");
    }
    await ctx.db.patch(clanId, { members: [...clan.members, userId] });
    await ctx.db.insert("clanMessages", {
      clanId,
      senderId: userId,
      senderName: "نظام العشيرة",
      content: `⚔️ انضم عضو جديد إلى العشيرة!`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const leaveClan = mutation({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) throw new Error("لست في هذه العشيرة");

    const remaining = clan.members.filter((m) => m !== userId);
    if (remaining.length === 0) {
      // آخر عضو — حُلّت العشيرة
      await ctx.db.delete(clanId);
      return { dissolved: true };
    }
    // إن غادر المالك، تنتقل القيادة لأقدم عضو
    const patch: Record<string, unknown> = { members: remaining };
    if (clan.ownerId === userId) patch.ownerId = remaining[0];
    await ctx.db.patch(clanId, patch);
    await ctx.db.insert("clanMessages", {
      clanId,
      senderId: userId,
      senderName: "نظام العشيرة",
      content: `📤 غادر أحد الأعضاء العشيرة.`,
      createdAt: Date.now(),
    });
    return { dissolved: false };
  },
});

/** طرد عضو — لقائد العشيرة فقط. */
export const kickMember = mutation({
  args: { clanId: v.id("clans"), targetUserId: v.id("users") },
  handler: async (ctx, { clanId, targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan) throw new Error("العشيرة غير موجودة");
    if (clan.ownerId !== userId) throw new Error("قائد العشيرة فقط يمكنه الطرد");
    if (targetUserId === userId) throw new Error("لا يمكنك طرد نفسك — اترك العشيرة");
    if (!clan.members.includes(targetUserId)) throw new Error("العضو ليس في العشيرة");
    await ctx.db.patch(clanId, {
      members: clan.members.filter((m) => m !== targetUserId),
    });
    await ctx.db.insert("clanMessages", {
      clanId,
      senderId: userId,
      senderName: "نظام العشيرة",
      content: `🚫 تم طرد أحد الأعضاء من العشيرة.`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const sendClanMessage = mutation({
  args: { clanId: v.id("clans"), content: v.string() },
  handler: async (ctx, { clanId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) throw new Error("غير مصرح");
    const clean = content.trim().slice(0, 300);
    if (!clean) throw new Error("الرسالة فارغة");
    const me = await ctx.db.get(userId);
    await ctx.db.insert("clanMessages", {
      clanId,
      senderId: userId,
      senderName: me?.name ?? "مجهول",
      content: clean,
      createdAt: Date.now(),
    });
  },
});

/** أعضاء العشيرة مع نقاطهم الشخصية (لأعضاء العشيرة فقط). */
export const getClanMembers = query({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) return null;
    const out = [];
    for (const mid of clan.members) {
      const u = await ctx.db.get(mid);
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", mid))
        .first();
      out.push({
        id: mid,
        name: u?.name ?? "مجهول",
        isOwner: clan.ownerId === mid,
        xp: profile?.xp ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
      });
    }
    return out.sort((a, b) => b.xp - a.xp);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// احتساب الحرب — يُستدعى من games.finishGame بعد كل جولة
// ─────────────────────────────────────────────────────────────────────────

export const recordWarRound = internalMutation({
  args: {
    userId: v.id("users"),
    won: v.boolean(),
    correctRatio: v.number(), // 0..1
    score: v.number(),
  },
  handler: async (ctx, { userId, won, correctRatio, score }) => {
    const clans = await ctx.db.query("clans").collect();
    const clan = clans.find((c: any) => c.members.includes(userId));
    if (!clan) return;

    const now = Date.now();
    // لو تغيّر الأسبوع والنقاط لم تُصفَّر بعد، صفّرها الآن (احتساب ذاتي)
    let weekly = clan.pointsThisWeek;
    if (now - clan.weeklyResetAt >= WEEK_MS) {
      weekly = 0;
    }

    let gained = WAR_POINTS.participation;
    if (won) gained += WAR_POINTS.win;
    if (correctRatio >= 1) gained += WAR_POINTS.perfect;
    gained += Math.floor(score / 100) * WAR_POINTS.highScore;

    await ctx.db.patch(clan._id, {
      pointsThisWeek: weekly + gained,
      totalPoints: clan.totalPoints + gained,
      weeklyResetAt: now - clan.weeklyResetAt >= WEEK_MS ? weekKey(now) : clan.weeklyResetAt,
    });
  },
});

/** التاج الأسبوعي — يُستدعى من cron كل ساعة: يصفّر من تجاوز أسبوعه ويسجل التاج. */
export const weeklyCrown = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const clans = await ctx.db.query("clans").collect();
    const due = clans.filter((c: any) => now - c.weeklyResetAt >= WEEK_MS);
    if (due.length === 0) return;

    // صفّر كل عشيرة مستحيلة، وسجّل من كان الأعلى قبل التصفير
    const sorted = [...due].sort((a: any, b: any) => b.pointsThisWeek - a.pointsThisWeek);
    for (const c of sorted) {
      await ctx.db.patch(c._id, {
        pointsThisWeek: 0,
        weeklyResetAt: weekKey(now),
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "owner",
        actorName: "حروب العشائر",
        action: "clan_week_reset",
        detail: `بدء أسبوع حرب جديد للعشيرة «${c.name}» — نقاط الأسبوع السابق: ${c.pointsThisWeek}`,
        severity: "low",
        createdAt: now,
      });
    }
  },
});
