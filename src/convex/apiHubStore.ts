// مركز API — سجل الواجهات (mutations/queries خارج runtime الـ Node)
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const registerApi = mutation({
  args: {
    name: v.string(),
    provider: v.string(),
    baseUrl: v.string(),
    apiKey: v.optional(v.string()),
    authStyle: v.union(v.literal("bearer"), v.literal("header"), v.literal("query"), v.literal("none")),
    authHeaderName: v.optional(v.string()),
    model: v.optional(v.string()),
    capabilities: v.array(v.string()),
    notes: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("auto-discovered")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiRegistry", {
      ...args,
      apiKey: args.apiKey && args.apiKey.length > 10 ? args.apiKey : undefined,
      status: "untested",
      successCount: 0,
      failCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const markTest = internalMutation({
  args: {
    apiId: v.id("apiRegistry"),
    ok: v.boolean(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const api = await ctx.db.get(args.apiId);
    if (!api) return;
    await ctx.db.patch(args.apiId, {
      status: args.ok ? "active" : "failed",
      lastTestedAt: Date.now(),
      lastLatencyMs: args.latencyMs,
      successCount: api.successCount + (args.ok ? 1 : 0),
      failCount: api.failCount + (args.ok ? 0 : 1),
    });
  },
});

export const setStatus = internalMutation({
  args: { apiId: v.id("apiRegistry"), status: v.union(v.literal("active"), v.literal("untested"), v.literal("failed"), v.literal("disabled")) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.apiId, { status: args.status });
  },
});

export const removeApi = mutation({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.apiId);
  },
});

// ── قراءات ──────────────────────────────────────────
export const listApis = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiRegistry").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").collect();
  },
});

/** نسخة آمنة للواجهة — المفتاح مخفي جزئياً */
export const listApisSafe = query({
  args: {},
  handler: async (ctx) => {
    const apis = await ctx.db.query("apiRegistry").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").collect();
    return apis.map((a) => ({
      ...a,
      apiKey: a.apiKey ? `${a.apiKey.slice(0, 6)}••••${a.apiKey.slice(-4)}` : undefined,
    }));
  },
});

export const getApiInternal = internalQuery({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, args) => await ctx.db.get(args.apiId),
});
