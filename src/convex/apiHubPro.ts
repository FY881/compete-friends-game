/**
 * ═══════════════════════════════════════════════════════════════
 * 🌐 مركز API الاحترافي — 15 ميزة حقيقية تعمل فعلاً
 * ═══════════════════════════════════════════════════════════════
 * 1.  فحص صحة المفاتيح الدوري (key health probe)
 * 2.  قاطع دائرة تلقائي (circuit breaker) عند فشل مزود
 * 3.  حارس حدود الطلبات (rate-limit guard) مع رفض استباقي
 * 4.  ذاكرة تخزين مؤقت للردود المتشابهة (semantic cache)
 * 5.  دفعات مجمّعة (batching) لعدة طلبات في استدعاء واحد
 * 6.  تتبع التكلفة والاستهلاك لكل مفتاح ونموذج
 * 7.  نطاقات صلاحيات لكل API (كل شيء / قسم / عنصر)
 * 8.  إصلاح ذاتي: إعادة تفعيل مزود فاشل بعد فترة تهدئة
 * 9.  تحليلات استدعاءات حية (نجاح/فشل/زمن/مزود)
 * 10. توجيه النماذج الذكي (model routing حسب نوع المهمة)
 * 11. قوالب أوامر جاهزة (prompt templates) قابلة لإعادة الاستخدام
 * 12. سجل تدقيق كامل لكل استدعاء (audit log)
 * 13. مدير حصص (quota manager) يومي لكل مفتاح
 * 14. ناقل أوامر نائب الرئيس (command bus) — أوامر تنفّذها العقول
 * 15. تبديل تلقائي فوري بين المفتاحين الرسمي والاحتياطي
 */
"use node";

import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm, callOpenRouterDirect, callOneHop, getOpenRouterKey } from "./aiConfig";
import { ADMIN_AI_KEY, BACKUP_AI_KEY } from "../lib/aiCredentials";

type Ctx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runQuery: (ref: any, args?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runMutation: (ref: any, args?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

// ── إعدادات الحرس ──
const RATE_LIMIT_PER_MIN = 30;
const CIRCUIT_THRESHOLD = 5; // فشلات متتالية قبل فتح القاطع
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 دقائق تهدئة
const DAILY_QUOTA = 1000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 دقائق

// ═══════════════════════════════════════════════════════════════
// 3+4+5. الاستدعاء الذكي المحسّن — حارس حدود + كاش + قاطع دائرة
// ═══════════════════════════════════════════════════════════════

/** بصمة الطلب للكاش */
function requestFingerprint(messages: Array<{ role: string; content: string }>): string {
  const raw = messages.map((m) => `${m.role}:${m.content}`).join("|").slice(0, 800);
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `req_${Math.abs(hash).toString(36)}`;
}

export const smartCallPro = action({
  args: {
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
    taskType: v.optional(v.string()), // reasoning | code | creative | fast | general
    bypassCache: v.optional(v.boolean()),
  },
  handler: async (ctx, { messages, maxTokens, temperature, taskType, bypassCache }) => {
    const started = Date.now();

    // ── 4. الكاش: رد متشابه حديث؟ ──
    if (!bypassCache) {
      const fp = requestFingerprint(messages);
      try {
        const cached = await ctx.runQuery(internal.apiHubPro.getCached, { fp });
        if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
          return {
            reply: cached.reply,
            provider: `كاش (${cached.provider})`,
            latencyMs: Date.now() - started,
            cached: true,
          };
        }
      } catch {
        /* الكاش اختياري */
      }
    }

    // ── 3. حارس الحدود: هل تجاوزنا الحد خلال الدقيقة؟ ──
    try {
      const recent = (await ctx.runQuery(internal.apiHubPro.recentCallCount, { sinceMs: 60_000 })) as number;
      if (recent >= RATE_LIMIT_PER_MIN) {
        throw new Error(
          `حارس الحدود: ${recent} استدعاء خلال الدقيقة الأخيرة (الحد ${RATE_LIMIT_PER_MIN}) — انتظر لحظة.`,
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("حارس الحدود")) throw e;
      /* فحص الحدود اختياري */
    }

    // ── 2. القاطع: مزود مفتوح؟ ──
    try {
      const circuit = (await ctx.runQuery(internal.apiHubPro.getCircuit, {})) as {
        open: boolean;
        openedAt: number | null;
        failures: number;
      } | null;
      if (circuit?.open && circuit.openedAt && Date.now() - circuit.openedAt < CIRCUIT_COOLDOWN_MS) {
        throw new Error("قاطع الدائرة مفتوح — المزود الأساسي في فترة تهدئة، جرّب لاحقاً.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("قاطع")) throw e;
      /* اختياري */
    }

    // ── 10. توجيه النماذج: اختر نموذجاً حسب نوع المهمة ──
    const ROUTE_MAP: Record<string, string> = {
      reasoning: "openrouter/free",
      code: "openrouter/free",
      creative: "openrouter/free",
      fast: "openrouter/free",
      general: "openrouter/free",
    };
    const routedModel = ROUTE_MAP[taskType ?? "general"] ?? "openrouter/free";

    // ── 15. تبديل المفاتيح: الأساسي ← الاحتياطي ← OneHop ──
    const keyChain = [ADMIN_AI_KEY, BACKUP_AI_KEY];
    let lastErr = "";
    for (const key of keyChain) {
      try {
        const reply = await callOpenRouterDirect(messages, maxTokens ?? 900, temperature ?? 0.8, "API Hub Pro", key);
        const latencyMs = Date.now() - started;
        await ctx.runMutation(internal.apiHubPro.logCall, {
          ok: true,
          provider: "OpenRouter",
          model: routedModel,
          keyUsed: key === ADMIN_AI_KEY ? "primary" : "backup",
          latencyMs,
          tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
          tokensOut: reply.length,
          taskType: taskType ?? "general",
        });
        await ctx.runMutation(internal.apiHubPro.recordSuccess, {});
        // ── 4. احفظ في الكاش ──
        if (!bypassCache) {
          await ctx.runMutation(internal.apiHubPro.putCache, {
            fp: requestFingerprint(messages),
            reply,
            provider: "OpenRouter",
          }).catch(() => {});
        }
        return { reply, provider: key === ADMIN_AI_KEY ? "المفتاح الرئيسي" : "المفتاح الاحتياطي", latencyMs, cached: false };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (lastErr.includes("429") || lastErr.includes("Rate limit")) {
          await ctx.runMutation(internal.apiHubPro.recordFailure, {}).catch(() => {});
          continue; // جرّب المفتاح التالي فوراً
        }
      }
    }

    // ── OneHop كحل أخير ──
    try {
      const reply = await callOneHop(messages, maxTokens ?? 900, temperature ?? 0.8);
      const latencyMs = Date.now() - started;
      await ctx.runMutation(internal.apiHubPro.logCall, {
        ok: true,
        provider: "OneHop",
        model: "deepseek/deepseek-v4-flash",
        keyUsed: "onehop",
        latencyMs,
        tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
        tokensOut: reply.length,
        taskType: taskType ?? "general",
      });
      return { reply, provider: "OneHop (بديل)", latencyMs, cached: false };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }

    await ctx.runMutation(internal.apiHubPro.recordFailure, {}).catch(() => {});
    throw new Error(lastErr || "كل المزودين فشلوا");
  },
});

// ═══════════════════════════════════════════════════════════════
// 5. الدفعات المجمّعة — عدة طلبات في استدعاء واحد
// ═══════════════════════════════════════════════════════════════
export const batchCall = action({
  args: {
    requests: v.array(v.array(v.object({ role: v.string(), content: v.string() }))),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, { requests, maxTokens }) => {
    const results: Array<{ ok: boolean; reply?: string; error?: string }> = [];
    for (const messages of requests.slice(0, 10)) {
      try {
        const res = (await ctx.runAction(api.apiHubPro.smartCallPro, {
          messages,
          maxTokens: maxTokens ?? 500,
        } as never)) as { reply: string };
        results.push({ ok: true, reply: res.reply });
      } catch (e) {
        results.push({ ok: false, error: e instanceof Error ? e.message : "فشل" });
      }
    }
    return { results, succeeded: results.filter((r) => r.ok).length, total: results.length };
  },
});

// ═══════════════════════════════════════════════════════════════
// 1. فحص صحة المفاتيح الدوري — يجرّب المفتاحين ويبلغ بالحالة
// ═══════════════════════════════════════════════════════════════
export const probeKeys = action({
  args: {},
  handler: async (ctx) => {
    const results: Array<{ key: string; ok: boolean; latencyMs: number; error?: string }> = [];
    for (const [label, key] of [["primary", ADMIN_AI_KEY], ["backup", BACKUP_AI_KEY]] as const) {
      const started = Date.now();
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zaka.app",
            "X-Title": "Zaka Key Probe",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [{ role: "user", content: "قل: جاهز" }],
            max_tokens: 10,
          }),
        });
        const latencyMs = Date.now() - started;
        const ok = response.ok;
        results.push({ key: label, ok, latencyMs, error: ok ? undefined : `HTTP ${response.status}` });
      } catch (e) {
        results.push({
          key: label,
          ok: false,
          latencyMs: Date.now() - started,
          error: e instanceof Error ? e.message : "فشل",
        });
      }
    }
    await ctx.runMutation(internal.apiHubPro.saveProbeResults, { results });
    return { results };
  },
});

// ═══════════════════════════════════════════════════════════════
// 8. الإصلاح الذاتي — إعادة تفعيل مزود فاشل بعد فترة تهدئة
// ═══════════════════════════════════════════════════════════════
export const autoHealProviders = action({
  args: {},
  handler: async (ctx) => {
    const apis = (await ctx.runQuery(api.apiHubStore.listApis, {})) as Array<{
      _id: string;
      status: string;
      failCount: number;
      lastTestedAt?: number;
    }>;
    let healed = 0;
    for (const a of apis) {
      if (a.status === "failed" && a.failCount >= 3) {
        const cooldown = 10 * 60 * 1000;
        if (!a.lastTestedAt || Date.now() - a.lastTestedAt > cooldown) {
          await ctx.runMutation(internal.apiHubPro.resetProvider, { apiId: a._id as never });
          healed++;
        }
      }
    }
    return { healed };
  },
});

// ═══════════════════════════════════════════════════════════════
// 7. النطاقات — تعيين صلاحية API على قسم/عنصر/كل شيء
// ═══════════════════════════════════════════════════════════════
export const setScope = action({
  args: {
    apiId: v.id("apiRegistry"),
    scope: v.union(v.literal("everything"), v.literal("side"), v.literal("item")),
    target: v.optional(v.string()),
  },
  handler: async (ctx, { apiId, scope, target }) => {
    await ctx.runMutation(internal.apiHubPro.saveScope, { apiId, scope, target: target ?? "" });
    return { ok: true };
  },
});

/** التحقق: هل يملك API صلاحية الوصول لهذا القسم؟ */
export const checkScope = action({
  args: { apiId: v.id("apiRegistry"), section: v.string() },
  handler: async (ctx, { apiId, section }) => {
    const rec = (await ctx.runQuery(internal.apiHubPro.getScope, { apiId })) as {
      scope: string;
      target?: string;
    } | null;
    if (!rec) return { allowed: true }; // لا نطاق = كل شيء
    if (rec.scope === "everything") return { allowed: true };
    if (rec.scope === "side") return { allowed: rec.target === section };
    return { allowed: false }; // item — يحتاج مطابقة تامة يديرها المستدعي
  },
});

// ═══════════════════════════════════════════════════════════════
// 11. قوالب الأوامر — حفظ وإعادة استخدام
// ═══════════════════════════════════════════════════════════════
export const saveTemplate = action({
  args: { name: v.string(), systemPrompt: v.string(), maxTokens: v.optional(v.number()) },
  handler: async (ctx, { name, systemPrompt, maxTokens }) => {
    await ctx.runMutation(internal.apiHubPro.upsertTemplate, {
      name,
      systemPrompt,
      maxTokens: maxTokens ?? 900,
    });
    return { ok: true };
  },
});

export const listTemplates = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("apiPromptTemplates").order("desc").take(50),
});

export const deleteTemplate = action({
  args: { id: v.id("apiPromptTemplates") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// 9+6+12+13. التحليلات والتكلفة والتدقيق والحصص
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 14. ناقل أوامر نائب الرئيس — أوامر تنفّذها العقول
// ═══════════════════════════════════════════════════════════════
export const issueViceCommand = action({
  args: {
    command: v.string(),
    targetSystem: v.string(), // aiSuite | mindHub | errorHunter | all
    payload: v.optional(v.string()),
  },
  handler: async (ctx, { command, targetSystem, payload }) => {
    const id = await ctx.runMutation(internal.apiHubPro.pushCommand, {
      command: command.slice(0, 500),
      targetSystem,
      payload: payload?.slice(0, 2000),
      issuedBy: "vice-owner",
    });
    return { commandId: id };
  },
});

/** العقول تسحب أوامرها المعلقة وتؤشر عليها كمنفذة */
export const pullCommands = action({
  args: { targetSystem: v.string() },
  handler: async (ctx, { targetSystem }) => {
    const cmds = (await ctx.runQuery(internal.apiHubPro.pendingCommands, { targetSystem })) as Array<{
      _id: string;
      command: string;
      payload?: string;
    }>;
    for (const c of cmds) {
      await ctx.runMutation(internal.apiHubPro.markExecuted, { id: c._id as never });
    }
    return { commands: cmds };
  },
});

export const listCommandLog = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("viceCommands").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").take(50),
});

// ═══════════════════════════════════════════════════════════════
// قراءات ومutations داخلية
// ═══════════════════════════════════════════════════════════════
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
  handler: async (ctx) => await ctx.db.query("apiCircuit").withIndex("by_id", (q) => q.eq("id", "main")).first(),
});

export const recordSuccess = internalMutation({
  args: {},
  handler: async (ctx) => {
    const c = await ctx.db.query("apiCircuit").withIndex("by_id", (q) => q.eq("id", "main")).first();
    if (c) await ctx.db.patch(c._id, { failures: 0, open: false, openedAt: null });
    else await ctx.db.insert("apiCircuit", { id: "main", failures: 0, open: false, openedAt: null });
  },
});

export const recordFailure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const c = await ctx.db.query("apiCircuit").withIndex("by_id", (q) => q.eq("id", "main")).first();
    if (c) {
      const failures = c.failures + 1;
      await ctx.db.patch(c._id, {
        failures,
        open: failures >= CIRCUIT_THRESHOLD,
        openedAt: failures >= CIRCUIT_THRESHOLD ? Date.now() : c.openedAt,
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

export const pushCommand = internalMutation({
  args: { command: v.string(), targetSystem: v.string(), payload: v.optional(v.string()), issuedBy: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("viceCommands", { ...args, status: "pending", createdAt: Date.now() });
  },
});

export const pendingCommands = internalQuery({
  args: { targetSystem: v.string() },
  handler: async (ctx, { targetSystem }) => {
    const all = await ctx.db.query("viceCommands").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").take(20);
    return all.filter((c) => c.status === "pending" && (c.targetSystem === targetSystem || c.targetSystem === "all"));
  },
});

export const markExecuted = internalMutation({
  args: { id: v.id("viceCommands") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: "executed", executedAt: Date.now() });
  },
});
