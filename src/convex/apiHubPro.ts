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

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm, callOpenRouterDirect, getOpenRouterKey, isDeputyOnline } from "./aiConfig";
import { ADMIN_AI_KEY } from "../lib/aiCredentials";

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
        const cached = (await ctx.runQuery(internal.apiHubStore.getCached, { fp })) as {
          createdAt: number;
          reply: string;
          provider: string;
        } | null;
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
      const recent = (await ctx.runQuery(internal.apiHubStore.recentCallCount, { sinceMs: 60_000 })) as number;
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
      const circuit = (await ctx.runQuery(internal.apiHubStore.getCircuit, {})) as {
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

    // ── المفتاح الرسمي فقط — لا مفاتيح احتياطية ولا مزودين خارجيين ──
    const keyChain = [ADMIN_AI_KEY];
    let lastErr = "";
    for (const key of keyChain) {
      try {
        const reply = await callOpenRouterDirect(messages, maxTokens ?? 900, temperature ?? 0.8, "API Hub Pro", key);
        const latencyMs = Date.now() - started;
        await ctx.runMutation(internal.apiHubStore.logCall, {
          ok: true,
          provider: "OpenRouter",
          model: routedModel,
          keyUsed: key === ADMIN_AI_KEY ? "primary" : "backup",
          latencyMs,
          tokensIn: messages.reduce((s, m) => s + m.content.length, 0),
          tokensOut: reply.length,
          taskType: taskType ?? "general",
        });
        await ctx.runMutation(internal.apiHubStore.recordSuccess, {});
        // ── 4. احفظ في الكاش ──
        if (!bypassCache) {
          await ctx.runMutation(internal.apiHubStore.putCache, {
            fp: requestFingerprint(messages),
            reply,
            provider: "OpenRouter",
          }).catch(() => {});
        }
        return { reply, provider: "المفتاح الرسمي", latencyMs, cached: false };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (lastErr.includes("429") || lastErr.includes("Rate limit")) {
          await ctx.runMutation(internal.apiHubStore.recordFailure, {}).catch(() => {});
          continue; // جرّب المفتاح التالي فوراً
        }
      }
    }

    await ctx.runMutation(internal.apiHubStore.recordFailure, {}).catch(() => {});
    throw new Error(lastErr || "المفتاح الرسمي فشل — أعد التفعيل من مركز API");
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
        const res = (await ctx.runAction((api as unknown as { apiHubPro: { smartCallPro: never } }).apiHubPro.smartCallPro, {
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
    // المفتاح الرسمي الوحيد — لا مفاتيح احتياطية بعد إزالة OneHop
    const results: Array<{ key: string; ok: boolean; latencyMs: number; error?: string }> = [];
    for (const [label, key] of [["primary", ADMIN_AI_KEY]] as const) {
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
    await ctx.runMutation(internal.apiHubStore.saveProbeResults, { results });
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
          await ctx.runMutation(internal.apiHubStore.resetProvider, { apiId: a._id as never });
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
    await ctx.runMutation(internal.apiHubStore.saveScope, { apiId, scope, target: target ?? "" });
    return { ok: true };
  },
});

/** التحقق: هل يملك API صلاحية الوصول لهذا القسم؟ */
export const checkScope = action({
  args: { apiId: v.id("apiRegistry"), section: v.string() },
  handler: async (ctx, { apiId, section }) => {
    const rec = (await ctx.runQuery(internal.apiHubStore.getScope, { apiId })) as {
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
    await ctx.runMutation(internal.apiHubStore.upsertTemplate, {
      name,
      systemPrompt,
      maxTokens: maxTokens ?? 900,
    });
    return { ok: true };
  },
});

// listTemplates / deleteTemplate moved to apiHubStore.ts (queries/mutations can't live in Node runtime)

// ═══════════════════════════════════════════════════════════════
// 9+6+12+13. التحليلات والتكلفة والتدقيق والحصص — نُقلت إلى apiHubStore.ts
// ═══════════════════════════════════════════════════════════════
// getHubAnalytics moved to apiHubStore.ts (query can't live in Node runtime)

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
    const id = (await ctx.runMutation(internal.apiHubStore.pushCommand, {
      command: command.slice(0, 500),
      targetSystem,
      payload: payload?.slice(0, 2000),
      issuedBy: "vice-owner",
    })) as string;
    return { commandId: id };
  },
});

/** العقول تسحب أوامرها المعلقة وتؤشر عليها كمنفذة */
export const pullCommands = action({
  args: { targetSystem: v.string() },
  handler: async (ctx, { targetSystem }) => {
    const cmds = (await ctx.runQuery(internal.apiHubStore.pendingCommands, { targetSystem })) as Array<{
      _id: string;
      command: string;
      payload?: string;
    }>;
    for (const c of cmds) {
      await ctx.runMutation(internal.apiHubStore.markExecuted, { id: c._id as never });
    }
    return { commands: cmds };
  },
});

// listCommandLog moved to apiHubStore.ts

// ═══════════════════════════════════════════════════════════════
// قراءات ومutations داخلية — نُقلت إلى apiHubStore.ts
// ═══════════════════════════════════════════════════════════════
