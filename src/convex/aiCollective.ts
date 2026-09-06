// ذاكرة العقول الجماعية + التصعيد للمالك — mutations/queries
import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** حفظ معرفة جديدة في الذاكرة الجماعية */
export const remember = internalMutation({
  args: {
    room: v.union(v.literal("private"), v.literal("free")),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    sourceMind: v.string(),
    importance: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiCollectiveMemories", {
      room: args.room,
      kind: args.kind,
      title: args.title.slice(0, 200),
      content: args.content.slice(0, 4000),
      sourceMind: args.sourceMind,
      importance: Math.min(Math.max(Math.round(args.importance), 1), 10),
      createdAt: Date.now(),
    });
  },
});

/** أبرز الذكريات كسياق للنقاش (تعلم مستمر) */
export const topMemories = internalQuery({
  args: { room: v.union(v.literal("private"), v.literal("free")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCollectiveMemories")
      .withIndex("by_room_importance", (q) =>
        q.eq("room", args.room).gte("importance", 1),
      )
      .order("desc")
      .take(args.limit ?? 12);
  },
});

/** تصعيد قرار مهم للمالك */
export const escalate = internalMutation({
  args: {
    room: v.union(v.literal("private"), v.literal("free")),
    mindName: v.string(),
    decision: v.string(),
    rationale: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiOwnerEscalations", {
      room: args.room,
      mindName: args.mindName,
      decision: args.decision.slice(0, 400),
      rationale: args.rationale.slice(0, 1000),
      status: "pending",
      ownerResponse: null,
      createdAt: Date.now(),
      respondedAt: null,
    });
  },
});

export const listEscalations = query({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))) },
  handler: async (ctx, args) => {
    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("aiOwnerEscalations")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(50);
    }
    return await ctx.db.query("aiOwnerEscalations").order("desc").take(80);
  },
});

export const respondEscalation = internalMutation({
  args: {
    id: v.id("aiOwnerEscalations"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    ownerResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      ownerResponse: args.ownerResponse ?? null,
      respondedAt: Date.now(),
    });
  },
});

export const getMemoryStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("aiCollectiveMemories").collect();
    const escalations = await ctx.db.query("aiOwnerEscalations").collect();
    return {
      memories: all.length,
      privateMemories: all.filter((m) => m.room === "private").length,
      freeMemories: all.filter((m) => m.room === "free").length,
      pendingEscalations: escalations.filter((e) => e.status === "pending").length,
      totalEscalations: escalations.length,
    };
  },
});
