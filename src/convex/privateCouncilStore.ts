// الغرفة الخاصة — سجل الجلسات (mutations/queries خارج runtime الـ Node)
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const insertSession = internalMutation({
  args: {
    agenda: v.string(),
    maxTurns: v.number(),
    intervalSec: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("privateCouncilSessions", {
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
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const appendMessage = internalMutation({
  args: {
    sessionId: v.id("privateCouncilSessions"),
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

/** تسجيل إجراء نفّذه عقل بصفة رسمية (صلاحيات كاملة) */
export const logAction = internalMutation({
  args: {
    sessionId: v.id("privateCouncilSessions"),
    mindId: v.string(),
    mindName: v.string(),
    type: v.string(),
    description: v.string(),
    result: v.string(),
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

export const appendError = internalMutation({
  args: { sessionId: v.id("privateCouncilSessions"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastError: args.error });
  },
});

export const relabelAgenda = internalMutation({
  args: { sessionId: v.id("privateCouncilSessions"), agenda: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { agenda: args.agenda });
  },
});

export const setStatus = internalMutation({
  args: {
    sessionId: v.id("privateCouncilSessions"),
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
      .query("privateCouncilSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getSessionForUi = query({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("privateCouncilSessions").collect();
    const messages = all.reduce((s, x) => s + x.messages.length, 0);
    const actions = all.reduce((s, x) => s + x.executedActions.length, 0);
    return {
      total: all.length,
      active: all.filter((x) => x.status === "active").length,
      ended: all.filter((x) => x.status === "ended").length,
      messages,
      actions,
    };
  },
});
