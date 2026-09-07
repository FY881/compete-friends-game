// حارس AI — قراءات وكتابات الصحة (خارج runtime الـ Node)
import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getHealth = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) =>
    await ctx.db.query("systemHealth").withIndex("by_key", (q) => q.eq("key", key)).first(),
});

export const upsertHealth = internalMutation({
  args: {
    key: v.string(),
    status: v.union(v.literal("healthy"), v.literal("degraded"), v.literal("critical")),
    latencyMs: v.number(),
    detail: v.string(),
    autoFixes: v.number(),
  },
  handler: async (ctx, { key, status, latencyMs, detail, autoFixes }) => {
    const row = await ctx.db
      .query("systemHealth")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const patch = {
      status,
      avgLatency: latencyMs,
      diagnostics: detail,
      lastAutoFix: autoFixes > 0 ? Date.now() : (row?.lastAutoFix ?? undefined),
      lastSweepAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, patch);
    else
      await ctx.db.insert("systemHealth", {
        key,
        status,
        errorRate: 0,
        activeUsers: 0,
        avgFps: 0,
        avgLatency: latencyMs,
        unresolvedErrors: 0,
        criticalErrors: status === "critical" ? 1 : 0,
        lastAutoFix: autoFixes > 0 ? Date.now() : undefined,
        lastSweepAt: Date.now(),
        uptime: 0,
        diagnostics: detail,
        updatedAt: Date.now(),
      });
  },
});

/** سجل تدقيق لكل دورية حارس AI — يظهر في سجل نشاط الذكاء */
export const logGuardianEvent = internalMutation({
  args: {
    ok: v.boolean(),
    message: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
  },
  handler: async (ctx, { ok, message, severity }) => {
    await ctx.db.insert("aiLogs", {
      action: "auto_fix",
      subsystem: "security",
      message,
      severity,
      auto: true,
      executedBy: "ai_guardian",
      timestamp: Date.now(),
    });
    return ok;
  },
});
