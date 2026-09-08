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

/** إعادة تعيين عدّادات النجاح/الفشل وتصنيف API كغير مُختبر — لإعادة محاولة نظيفة */
export const resetApi = mutation({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, { apiId }) => {
    await ctx.db.patch(apiId, { status: "untested", successCount: 0, failCount: 0, lastTestedAt: undefined });
    return { ok: true };
  },
});

/** سجل أحداث API — جولة مراقبة، إصلاح ذاتي، حماية */
export const logApiEvent = internalMutation({
  args: {
    apiId: v.optional(v.id("apiRegistry")),
    provider: v.string(),
    event: v.string(),
    detail: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    at: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiEvents", {
      ...args,
      apiId: args.apiId ?? null,
    });
  },
});

/** آخر أحداث API للوحة المراقبة */
export const listApiEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("apiEvents").withIndex("by_created", (q) => q.gte("at", 0)).order("desc").take(args.limit ?? 30);
  },
});

/** تفاصيل عميقة لمفتاح واحد: كُل ما نعرفه عنه من السجل */
export const getKeyDeepLog = query({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, { apiId }) => {
    const api = await ctx.db.get(apiId);
    if (!api) return null;
    const calls = await ctx.db.query("apiCallLogs").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").take(200);
    const keyCalls = calls.filter((c) => c.keyUsed === api.apiKey || c.provider === api.provider).slice(0, 25);
    const okCalls = keyCalls.filter((c) => c.ok);
    const recentEvents = await ctx.db.query("apiEvents").withIndex("by_created", (q) => q.gte("at", 0)).order("desc").take(50);
    const keyEvents = recentEvents.filter((e) => e.provider === api.provider || e.apiId === apiId).slice(0, 10);
    return {
      api,
      keyCalls,
      okCount: okCalls.length,
      failCount: keyCalls.length - okCalls.length,
      avgLatency: okCalls.length ? Math.round(okCalls.reduce((s, c) => s + c.latencyMs, 0) / okCalls.length) : null,
      recentEvents: keyEvents,
    };
  },
});

// ── إدارة حقيقية من الواجهة: تشغيل/إيقاف/تعديل/استبدال/حذف ──

/** تشغيل أو إيقاف API فعلياً (يُحترم في كل الاستدعاءات) */
export const setApiEnabled = mutation({
  args: {
    apiId: v.id("apiRegistry"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { apiId, enabled }) => {
    const api = await ctx.db.get(apiId);
    if (!api) throw new Error("API غير موجود");
    const status = enabled
      ? api.status === "failed"
        ? "untested"
        : "active"
      : "disabled";
    await ctx.db.patch(apiId, { status });
    return { ok: true, status };
  },
});

/** استبدال مفتاح API لمفتاح موجود (يُعاد فحصه) */
export const replaceApiKey = mutation({
  args: {
    apiId: v.id("apiRegistry"),
    apiKey: v.string(),
  },
  handler: async (ctx, { apiId, apiKey }) => {
    const api = await ctx.db.get(apiId);
    if (!api) throw new Error("API غير موجود");
    const clean = apiKey.trim();
    if (clean.length < 10) throw new Error("المفتاح الجديد قصير جداً");
    await ctx.db.patch(apiId, { apiKey: clean, status: "untested", failCount: 0 });
    return { ok: true, keyPreview: `${clean.slice(0, 6)}••••${clean.slice(-4)}` };
  },
});

/** حذف API نهائياً من السجل */
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

// ── جداول مركز API الاحترافي (نُقلت من apiHubPro لأن Query/Mutation لا تعمل في Node) ──

export const getCached = internalQuery({
  args: { fp: v.string() },
  handler: async (ctx, { fp }) =>
    await ctx.db.query("apiCache").withIndex("by_fp", (q) => q.eq("fp", fp)).first(),
});

export const recentCallCount = internalQuery({
  args: { sinceMs: v.number() },
  handler: async (ctx, { sinceMs }) => {
    const since = Date.now() - sinceMs;
    const rows = await ctx.db.query("apiCallLogs").withIndex("by_created", (q) => q.gte("createdAt", since)).collect();
    return rows.length;
  },
});

export const getCircuit = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first(),
});

export const recordSuccess = internalMutation({
  args: {},
  handler: async (ctx) => {
    const c = await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first();
    if (c) await ctx.db.patch(c._id, { failures: 0, open: false, openedAt: null });
    else await ctx.db.insert("apiCircuit", { id: "main", failures: 0, open: false, openedAt: null });
  },
});

export const recordFailure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const c = await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first();
    if (c) {
      const failures = c.failures + 1;
      await ctx.db.patch(c._id, {
        failures,
        open: failures >= 5,
        openedAt: failures >= 5 ? Date.now() : c.openedAt,
      });
    } else {
      await ctx.db.insert("apiCircuit", { id: "main", failures: 1, open: false, openedAt: null });
    }
  },
});

export const logCall = internalMutation({
  args: {
    ok: v.boolean(),
    provider: v.string(),
    model: v.string(),
    keyUsed: v.string(),
    latencyMs: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    taskType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiCallLogs", { ...args, createdAt: Date.now() });
  },
});

export const putCache = internalMutation({
  args: { fp: v.string(), reply: v.string(), provider: v.string() },
  handler: async (ctx, { fp, reply, provider }) => {
    const existing = await ctx.db.query("apiCache").withIndex("by_fp", (q) => q.eq("fp", fp)).first();
    if (existing) await ctx.db.patch(existing._id, { reply, provider, createdAt: Date.now() });
    else await ctx.db.insert("apiCache", { fp, reply, provider, createdAt: Date.now() });
  },
});

export const saveProbeResults = internalMutation({
  args: {
    results: v.array(v.object({ key: v.string(), ok: v.boolean(), latencyMs: v.number(), error: v.optional(v.string()) })),
  },
  handler: async (ctx, { results }) => {
    await ctx.db.insert("apiKeyProbes", { results, probedAt: Date.now() });
  },
});

export const resetProvider = internalMutation({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, { apiId }) => {
    await ctx.db.patch(apiId, { status: "untested", failCount: 0 });
  },
});

export const saveScope = internalMutation({
  args: {
    apiId: v.id("apiRegistry"),
    scope: v.union(v.literal("everything"), v.literal("side"), v.literal("item")),
    target: v.string(),
  },
  handler: async (ctx, { apiId, scope, target }) => {
    await ctx.db.patch(apiId, { notes: `scope:${scope}|target:${target}` });
  },
});

export const getScope = internalQuery({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, { apiId }) => {
    const api = await ctx.db.get(apiId);
    if (!api?.notes?.startsWith("scope:")) return null;
    const [scopePart, targetPart] = api.notes.split("|");
    return { scope: scopePart.replace("scope:", ""), target: targetPart?.replace("target:", "") ?? "" };
  },
});

export const upsertTemplate = internalMutation({
  args: { name: v.string(), systemPrompt: v.string(), maxTokens: v.number() },
  handler: async (ctx, { name, systemPrompt, maxTokens }) => {
    const existing = await ctx.db.query("apiPromptTemplates").withIndex("by_name", (q) => q.eq("name", name)).first();
    if (existing) await ctx.db.patch(existing._id, { systemPrompt, maxTokens });
    else await ctx.db.insert("apiPromptTemplates", { name, systemPrompt, maxTokens, createdAt: Date.now() });
  },
});

export const listTemplates = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("apiPromptTemplates").order("desc").take(50),
});

export const deleteTemplate = mutation({
  args: { id: v.id("apiPromptTemplates") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { ok: true };
  },
});

export const pushCommand = internalMutation({
  args: { command: v.string(), targetSystem: v.string(), payload: v.optional(v.string()), issuedBy: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("viceCommands", { ...args, status: "pending" as const, createdAt: Date.now() });
  },
});

export const pendingCommands = internalQuery({
  args: { targetSystem: v.string() },
  handler: async (ctx, { targetSystem }) => {
    const all = await ctx.db
      .query("viceCommands")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(20);
    return all.filter((c) => c.status === "pending" && (c.targetSystem === targetSystem || c.targetSystem === "all"));
  },
});

export const markExecuted = internalMutation({
  args: { id: v.id("viceCommands") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "executed", executedAt: Date.now() });
  },
});

export const listCommandLog = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("viceCommands").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").take(50),
});

const DAILY_QUOTA = 1000;

export const getHubAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const calls = await ctx.db.query("apiCallLogs").withIndex("by_created", (q) => q.gte("createdAt", dayAgo)).take(500);
    const ok = calls.filter((c) => c.ok);
    const avgLatency = ok.length ? Math.round(ok.reduce((s, c) => s + c.latencyMs, 0) / ok.length) : 0;
    const byProvider: Record<string, number> = {};
    const byKey: Record<string, number> = {};
    for (const c of calls) {
      byProvider[c.provider] = (byProvider[c.provider] || 0) + 1;
      byKey[c.keyUsed] = (byKey[c.keyUsed] || 0) + 1;
    }
    const minuteAgo = Date.now() - 60_000;
    const callsLastMinute = calls.filter((c) => c.createdAt > minuteAgo).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCalls = calls.filter((c) => c.createdAt >= todayStart.getTime()).length;
    return {
      totalCalls: calls.length,
      successRate: calls.length ? Math.round((ok.length / calls.length) * 100) : 100,
      avgLatency,
      byProvider,
      byKey,
      callsLastMinute,
      todayCalls,
      dailyQuota: DAILY_QUOTA,
      quotaRemaining: Math.max(0, DAILY_QUOTA - todayCalls),
      quotaExceeded: todayCalls >= DAILY_QUOTA,
      recent: calls.slice(0, 20),
    };
  },
});
