// مركز API — دوال داخلية وقراءات (خارج runtime الـ Node)
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/** نائب المالك يسجل نظاماً ابتكره بنفسه */
export const registerViceSystem = internalMutation({
  args: {
    name: v.string(),
    purpose: v.string(),
    spec: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("viceOwnerSystems", {
      ...args,
      status: "proposed",
      createdAt: Date.now(),
    });
  },
});

export const listViceSystems = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("viceOwnerSystems")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(50);
  },
});
