// غرفة الحريّة — سجل الجلسات (كل شيء ما عدا اللعبة)
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const insertSession = internalMutation({
  args: { topic: v.string(), maxTurns: v.number(), intervalSec: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("freeRoomSessions", {
      topic: args.topic,
      status: "active",
      turnCount: 0,
      maxTurns: args.maxTurns,
      intervalSec: args.intervalSec,
      messages: [],
      lastError: null,
      createdAt: Date.now(),
      finishedAt: null,
    });
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const appendMessage = internalMutation({
  args: {
    sessionId: v.id("freeRoomSessions"),
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

export const appendError = internalMutation({
  args: { sessionId: v.id("freeRoomSessions"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastError: args.error });
  },
});

export const relabelTopic = internalMutation({
  args: { sessionId: v.id("freeRoomSessions"), topic: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { topic: args.topic });
  },
});

export const setStatus = internalMutation({
  args: {
    sessionId: v.id("freeRoomSessions"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "ended") patch.finishedAt = Date.now();
    await ctx.db.patch(args.sessionId, patch);
  },
});

export const listSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("freeRoomSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getSessionForUi = query({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("freeRoomSessions").collect();
    return {
      total: all.length,
      active: all.filter((x) => x.status === "active").length,
      messages: all.reduce((s, x) => s + x.messages.length, 0),
    };
  },
});
