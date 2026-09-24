/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧪 أفعال مركز API — كل فعل هنا طلب شبكة حقيقي مُسجَّل بالدليل
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  • verifyProvider  — طلب فعلي لمزوّد بعينه، يُقاس زمنه ويُسجَّل ردّه.
 *  • discoverModels  — قراءة /models الحقيقية لتعرف النماذج المتاحة فعلاً.
 *  • testTask        — تشغيل وحدة AI من المركز حيّة ورؤية ردّها الحقيقي
 *                      بالنموذج الذي ستستخدمه فعلاً في اللعبة.
 *
 * لا محاكاة: كل رقم هنا مقيس من الشبكة، وكل فشل يظهر بنصّه كما ردّه المزوّد.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  getTaskDef,
  humanizeProviderError,
  modelCandidates,
  getPreset,
  probeVerdict,
} from "./apiCenterCore";
import {
  buildRequest,
  callLlmDetailed,
  getEngineConfig,
  providerChatUrl,
  providerModelsUrl,
  readCompletion,
  type EngineProvider,
} from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

function findProvider(id: string): EngineProvider | null {
  const providers = getEngineConfig().providers;
  return providers.find((p) => p.id === id) ?? null;
}

/** 🧪 تحقق حقيقي: طلب فعلي للمزوّد المختار بدليل مسجَّل */
export const verifyProvider = action({
  args: { which: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { which }): Promise<{
    ok: boolean;
    url: string;
    model: string;
    latencyMs: number;
    status: number;
    kind: string;
    reply?: string;
    error?: string;
  }> => {
    await ensureAiRuntime(ctx);
    const provider = findProvider(which);
    if (!provider) throw new Error("المزوّد غير مضبوط — احفظه أولاً.");

    const chain = modelCandidates(
      provider.presetId,
      getEngineConfig().discovered[provider.id] ?? [],
      provider.model ?? null,
    );
    const model = chain[0] ?? "gpt-4o-mini";
    const url = providerChatUrl(provider);
    const built = buildRequest({
      provider,
      model,
      messages: [{ role: "user", content: "قل: جاهز" }],
      maxTokens: 24,
      temperature: 0,
      jsonMode: false,
      label: `Zaka Verify ${which}`,
    });

    const started = Date.now();
    let ok = false;
    let status = 0;
    let reply = "";
    let error: string | undefined;
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch(url, {
        method: "POST",
        headers: built.headers,
        body: JSON.stringify(built.body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      status = res.status;
      const raw = await res.text().catch(() => "");
      if (res.ok) {
        try {
          const parsed = readCompletion(JSON.parse(raw));
          reply = parsed.text.slice(0, 200);
          tokensIn = parsed.tokensIn;
          tokensOut = parsed.tokensOut;
        } catch {
          reply = raw.slice(0, 200);
        }
        ok = true;
      } else {
        // تشخيص مفهوم: رصيد / مفتاح / مسار / حد استخدام — لا JSON خام في الواجهة
        error = humanizeProviderError(res.status, raw);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "خطأ شبكة";
    }

    const latencyMs = Date.now() - started;
    try {
      await ctx.runMutation(internal.apiCenterStore.recordCall, {
        ok,
        provider: which,
        providerKind: provider.kind,
        task: "verify",
        label: `Zaka Verify ${which}`,
        model,
        latencyMs,
        tokensIn,
        tokensOut,
        cached: false,
        attempt: 1,
        error,
        promptChars: 9,
        cacheTtlMs: 0,
        at: Date.now(),
        failureThreshold: getEngineConfig().guard.failureThreshold,
        guardOn: false,
      });
    } catch {
      // الدليل لا يُسقط النتيجة
    }

    return {
      ok,
      url,
      model,
      latencyMs,
      status,
      kind: ok ? "ok" : probeVerdict(status, error ?? "").kind,
      reply,
      error,
    };
  },
});

/** 🔍 اكتشاف النماذج الحقيقي — يجعل أي مزوّد جديد يعمل بلا تعديل كود */
export const discoverModels = action({
  args: { which: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { which }): Promise<{
    ok: boolean;
    url: string;
    models: string[];
    error?: string;
    presetId: string;
  }> => {
    await ensureAiRuntime(ctx);
    const provider = findProvider(which);
    if (!provider) throw new Error("المزوّد غير مضبوط — احفظه أولاً.");

    const url = providerModelsUrl(provider);
    const presetId = provider.presetId;
    const preset = getPreset(presetId);

    const headers: Record<string, string> =
      provider.kind === "key_only"
        ? { Authorization: `Bearer ${provider.apiKey}` }
        : preset.authStyle === "header" && preset.authHeaderName
          ? { [preset.authHeaderName]: provider.apiKey }
          : { Authorization: `Bearer ${provider.apiKey}` };

    let models: string[] = [];
    let error: string | undefined;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(timer));
      const raw = await res.text().catch(() => "");
      if (!res.ok) {
        error = humanizeProviderError(res.status, raw);
      } else {
        const parsed = JSON.parse(raw) as {
          data?: Array<{ id?: string }>;
          models?: Array<{ id?: string } | string>;
        };
        const list =
          parsed.data?.map((m) => m?.id ?? "").filter(Boolean) ??
          (parsed.models ?? []).map((m) => (typeof m === "string" ? m : (m?.id ?? ""))).filter(Boolean);
        models = [...new Set(list.map((m) => m.trim()).filter(Boolean))];
        if (models.length === 0) error = "المزوّد ردّ بقائمة فارغة";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "خطأ شبكة";
    }

    // إن فشل الاكتشاف نُبقي نماذج قالب المزوّد — يعمل بلا اكتشاف
    const effective = models.length > 0 ? models : preset.models;

    if (models.length > 0) {
      try {
        await ctx.runMutation(internal.apiCenterStore.saveDiscovered, { which, models });
      } catch {
        // الحفظ لا يُسقط النتيجة
      }
    }

    try {
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: which,
        event: models.length > 0 ? "models_discovered" : "discover_failed",
        detail:
          models.length > 0
            ? `اكتُشف ${models.length} نموذجاً حقيقياً من ${url}`
            : `تعذّر الاكتشاف من ${url}: ${error ?? "سبب غير معروف"} — نُستخدم نماذج القالب`,
        severity: models.length > 0 ? "info" : "warning",
        at: Date.now(),
      });
    } catch {
      // نفس المبدأ
    }

    return { ok: models.length > 0, url, models: effective, error, presetId };
  },
});

/** 🧪 الاختبار الحي: تشغيل وحدة AI فعلية ورؤية ردّها بنفس مسار اللعبة */
export const testTask = action({
  args: { task: v.string(), prompt: v.string() },
  handler: async (ctx, { task, prompt }): Promise<{
    ok: boolean;
    text?: string;
    model?: string;
    provider?: string;
    taskKey: string;
    taskLabel: string;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    cached: boolean;
    attempts: number;
    error?: string;
  }> => {
    await ensureAiRuntime(ctx);
    const def = getTaskDef(task);
    const clean = prompt.trim().slice(0, 2000) || "اختبار سريع: قل جاهز بكلمة واحدة.";

    try {
      const res = await callLlmDetailed({
        messages: [{ role: "user", content: clean }],
        maxTokens: def.maxTokens || 400,
        temperature: def.temperature,
        label: `Zaka Live Test — ${def.key}`,
        jsonMode: def.needsJson,
        task: def.key,
      });
      return {
        ok: true,
        text: res.text.slice(0, 1200),
        model: res.model,
        provider: res.provider,
        taskKey: def.key,
        taskLabel: def.label,
        latencyMs: res.latencyMs,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        cached: res.cached,
        attempts: res.attempts,
      };
    } catch (e) {
      return {
        ok: false,
        taskKey: def.key,
        taskLabel: def.label,
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        cached: false,
        attempts: 0,
        error: e instanceof Error ? e.message : "فشل غير معروف",
      };
    }
  },
});
