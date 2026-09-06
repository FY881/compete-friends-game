// سجل مجالس العقول — mutations/queries (خارج runtime الـ Node)
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const insertCouncil = internalMutation({
  args: {
    topic: v.string(),
    participantIds: v.array(v.string()),
    maxTurns: v.number(),
    intervalSec: v.number(),
    freeMode: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("councilSessions", {
      topic: args.topic,
      participantIds: args.participantIds,
      maxTurns: args.maxTurns,
      intervalSec: args.intervalSec,
      freeMode: args.freeMode,
      status: "active",
      turnCount: 0,
      messages: [],
      ownerMessage: null,
      lastError: null,
      createdAt: Date.now(),
      finishedAt: null,
    });
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const appendMessage = internalMutation({
  args: {
    sessionId: v.id("councilSessions"),
    systemId: v.string(),
    systemName: v.string(),
    emoji: v.string(),
    content: v.string(),
    turnCount: v.number(), // غير مستخدم — يُحسب هنا لضمان دقة الأدوار المتزامنة
    done: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    const newCount = session.turnCount + 1;
    const done = args.done || newCount >= session.maxTurns;
    await ctx.db.patch(args.sessionId, {
      turnCount: newCount,
      ownerMessage: null,
      messages: [
        ...session.messages,
        {
          systemId: args.systemId,
          systemName: args.systemName,
          emoji: args.emoji,
          content: args.content,
          at: Date.now(),
        },
      ],
      status: done ? "ended" : session.status,
      finishedAt: done ? Date.now() : session.finishedAt,
    });
  },
});

export const appendOwnerMessage = internalMutation({
  args: { sessionId: v.id("councilSessions"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { ownerMessage: args.message });
  },
});

export const appendError = internalMutation({
  args: { sessionId: v.id("councilSessions"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastError: args.error });
  },
});

export const setCouncilStatus = internalMutation({
  args: { sessionId: v.id("councilSessions"), status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")) },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "ended") patch.finishedAt = Date.now();
    await ctx.db.patch(args.sessionId, patch);
  },
});

// ── قراءات للواجهة ───────────────────────────────────────────
export const listSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("councilSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getSessionForUi = query({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("councilSessions").collect();
    const messages = all.reduce((s, x) => s + x.messages.length, 0);
    return {
      total: all.length,
      active: all.filter((x) => x.status === "active").length,
      ended: all.filter((x) => x.status === "ended").length,
      messages,
    };
  },
});
