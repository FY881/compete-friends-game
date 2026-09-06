// ملتقى العقول — سجل الجلسات (mutations/queries خارج runtime الـ Node)
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { decipher } from "./aiCipher";

export const insertSession = internalMutation({
  args: {
    room: v.union(v.literal("war"), v.literal("free")),
    agenda: v.string(),
    maxTurns: v.number(),
    intervalSec: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mindHubSessions", {
      room: args.room,
      agenda: args.agenda,
      status: "active",
      turnCount: 0,
      maxTurns: args.maxTurns,
      intervalSec: args.intervalSec,
      messages: [],
      executedActions: [],
      lastError: null,
      createdAt: Date.now(),
      finishedAt: null,
    });
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const appendMessage = internalMutation({
  args: {
    sessionId: v.id("mindHubSessions"),
    mindId: v.string(),
    mindName: v.string(),
    emoji: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return;
    const turnCount = s.turnCount + 1;
    const done = turnCount >= s.maxTurns;
    await ctx.db.patch(args.sessionId, {
      turnCount,
      messages: [
        ...s.messages,
        { mindId: args.mindId, mindName: args.mindName, emoji: args.emoji, content: args.content, at: Date.now() },
      ],
      status: done ? "ended" : s.status,
      finishedAt: done ? Date.now() : s.finishedAt,
    });
  },
});

export const logAction = internalMutation({
  args: {
    sessionId: v.id("mindHubSessions"),
    mindId: v.string(),
    mindName: v.string(),
    type: v.string(),
    description: v.string(),
    result: v.string(), // executed | pending-owner | rejected
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return;
    await ctx.db.patch(args.sessionId, {
      executedActions: [
        ...s.executedActions,
        {
          mindId: args.mindId,
          mindName: args.mindName,
          type: args.type,
          description: args.description,
          result: args.result,
          at: Date.now(),
        },
      ],
    });
  },
});

/** تعلّم ذاتي: خلاصة الجلسة تُحفظ كدرس مستفاد */
export const saveLessons = internalMutation({
  args: { sessionId: v.id("mindHubSessions"), lessons: v.array(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lessons: args.lessons });
  },
});

export const appendError = internalMutation({
  args: { sessionId: v.id("mindHubSessions"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastError: args.error });
  },
});

export const relabelAgenda = internalMutation({
  args: { sessionId: v.id("mindHubSessions"), agenda: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { agenda: args.agenda });
  },
});

export const setStatus = internalMutation({
  args: {
    sessionId: v.id("mindHubSessions"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "ended") patch.finishedAt = Date.now();
    await ctx.db.patch(args.sessionId, patch);
  },
});

// ── قراءات للواجهة ──────────────────────────────────────────
export const listSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mindHubSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const getSessionForUi = query({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

/** نسخة مفكوكة الشفرة — للمالك فقط: الرسائل المشفرة تُقرأ بلغتها الأصلية */
export const getDecipheredSession = query({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return null;
    return {
      ...s,
      messages: s.messages.map((m) => ({
        ...m,
        content: decipher(m.content),
        wasCiphered: m.content.includes("⟦"),
      })),
    };
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("mindHubSessions").collect();
    const pending = all.reduce(
      (acc, s) => acc + s.executedActions.filter((a) => a.result === "pending-owner").length,
      0,
    );
    return {
      total: all.length,
      active: all.filter((x) => x.status === "active").length,
      ended: all.filter((x) => x.status === "ended").length,
      messages: all.reduce((s, x) => s + x.messages.length, 0),
      executed: all.reduce((s, x) => s + x.executedActions.filter((a) => a.result === "executed").length, 0),
      pendingOwner: pending,
    };
  },
});

/** قرارات مهمة بانتظار رأي المالك — من كل الجلسات */
export const getPendingOwnerDecisions = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("mindHubSessions").order("desc").take(30);
    const out: Array<{
      sessionId: string;
      room: string;
      mindId: string;
      mindName: string;
      type: string;
      description: string;
      at: number;
    }> = [];
    for (const s of all) {
      for (const a of s.executedActions) {
        if (a.result === "pending-owner") {
          out.push({
            sessionId: s._id,
            room: s.room,
            mindId: a.mindId,
            mindName: a.mindName,
            type: a.type,
            description: a.description,
            at: a.at,
          });
        }
      }
    }
    return out;
  },
});
