// نائب المالك — سجل الجلسات (mutations/queries خارج runtime الـ Node)
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const insertSession = internalMutation({
  args: {
    mission: v.string(),
    focus: v.union(v.literal("ai_ops"), v.literal("audit"), v.literal("optimization"), v.literal("exploration")),
    maxTurns: v.number(),
    intervalSec: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("viceOwnerSessions", {
      mission: args.mission,
      focus: args.focus,
      status: "active",
      turnCount: 0,
      maxTurns: args.maxTurns,
      intervalSec: args.intervalSec,
      activity: [],
      lastError: null,
      model: args.model,
      createdAt: Date.now(),
      finishedAt: null,
    });
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const logActivity = internalMutation({
  args: {
    sessionId: v.id("viceOwnerSessions"),
    type: v.string(),
    title: v.string(),
    detail: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    turnCount: v.number(),
    done: v.boolean(),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get(args.sessionId);
    if (!s) return;
    const turnCount = s.turnCount + 1;
    const done = args.done || turnCount >= s.maxTurns;
    await ctx.db.patch(args.sessionId, {
      turnCount,
      activity: [
        ...s.activity,
        { type: args.type, title: args.title, detail: args.detail, severity: args.severity, at: Date.now() },
      ],
      status: done ? "ended" : s.status,
      finishedAt: done ? Date.now() : s.finishedAt,
    });
  },
});

export const appendError = internalMutation({
  args: { sessionId: v.id("viceOwnerSessions"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastError: args.error });
  },
});

export const relabelMission = internalMutation({
  args: { sessionId: v.id("viceOwnerSessions"), mission: v.string(), focus: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      mission: args.mission,
      ...(args.focus === "ai_ops" || args.focus === "audit" || args.focus === "optimization" || args.focus === "exploration"
        ? { focus: args.focus }
        : {}),
    });
  },
});

export const setStatus = internalMutation({
  args: {
    sessionId: v.id("viceOwnerSessions"),
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
      .query("viceOwnerSessions")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 15);
  },
});

export const getSessionForUi = query({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, args) => await ctx.db.get(args.sessionId),
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("viceOwnerSessions").collect();
    const activity = all.reduce((s, x) => s + x.activity.length, 0);
    return {
      total: all.length,
      active: all.filter((x) => x.status === "active").length,
      activity,
      critical: all.reduce(
        (s, x) => s + x.activity.filter((a) => a.severity === "critical").length,
        0,
      ),
    };
  },
});
