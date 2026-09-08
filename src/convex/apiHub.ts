/**
 * 🌐 مركز API — كل واجهات البرمجة في مكان واحد
 *
 * • استدعاء عام عبر أي API مسجّل (chat-style)
 * • اختبار حي لكل API (ping حقيقي يقيس الزمن ويسجل النجاح)
 * • اكتشاف تلقائي: الصق أمر curl خام → يحلله AI → يسجّل API كاملاً بالمواصفات
 * • البديل الذكي: إذا فشل API يجرّب التالي المتاح تلقائياً
 */
"use node";

import { action, internalAction, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { upgradedLlm } from "./aiUpgradeKit";
import { registerViceSystem } from "./apiHubInternal";
import { ASSISTANT_MINDS, assistantById } from "../lib/assistantMinds";

interface RegistryApi {
  _id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  authStyle: "bearer" | "header" | "query" | "none";
  authHeaderName?: string;
  model?: string;
  status: string;
}

/** بناء ترويسات المصادقة حسب نمط الـ API */
function buildHeaders(api: RegistryApi): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (api.apiKey) {
    if (api.authStyle === "bearer") headers["Authorization"] = `Bearer ${api.apiKey}`;
    else if (api.authStyle === "header") headers[api.authHeaderName ?? "x-api-key"] = api.apiKey;
  }
  return headers;
}

/** إدخال المفتاح في الرابط لأنماط query */
function buildUrl(api: RegistryApi): string {
  if (api.authStyle === "query" && api.apiKey && api.authHeaderName) {
    const sep = api.baseUrl.includes("?") ? "&" : "?";
    return `${api.baseUrl}${sep}${api.authHeaderName}=${encodeURIComponent(api.apiKey)}`;
  }
  return api.baseUrl;
}

/** استدعاء chat موحّد عبر API مسجّل */
export const callRegisteredApi = action({
  args: {
    apiId: v.id("apiRegistry"),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, { apiId, messages, maxTokens, temperature }): Promise<{ reply: string; latencyMs: number }> => {
    const api = (await ctx.runQuery(internal.apiHubStore.getApiInternal, { apiId })) as RegistryApi | null;
    if (!api) throw new Error("API غير موجود في السجل");
    if (api.status === "disabled") throw new Error("هذا API معطّل");

    const started = Date.now();
    try {
      const response = await fetch(buildUrl(api), {
        method: "POST",
        headers: buildHeaders(api),
        body: JSON.stringify({
          ...(api.model ? { model: api.model } : {}),
          messages,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
        }),
      });
      const latencyMs = Date.now() - started;
      if (!response.ok) {
        const err = await response.text();
        await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: false, latencyMs });
        throw new Error(`${api.name} فشل (${response.status}): ${err.slice(0, 200)}`);
      }
      const data = await response.json();
      const reply =
        data.choices?.[0]?.message?.content ??
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        data.content?.[0]?.text ??
        data.reply ??
        data.response;
      if (!reply) throw new Error(`${api.name}: صيغة رد غير معروفة`);
      await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: true, latencyMs });
      return { reply, latencyMs };
    } catch (e) {
      const latencyMs = Date.now() - started;
      await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: false, latencyMs }).catch(() => {});
      throw e;
    }
  },
});

/** استدعاء ذكي: جرّب APIs النشطة بالتتابع حتى ينجح أحدها */
export const smartCall = action({
  args: {
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, { messages, maxTokens, temperature }): Promise<{ reply: string; provider: string }> => {
    const apis = (await ctx.runQuery(api.apiHubStore.listApis, {})) as RegistryApi[];
    const candidates = apis.filter((a) => a.status === "active" && a.model);
    let lastErr = "";
    for (const candidate of candidates) {
      try {
        const res = (await ctx.runAction(api.apiHub.callRegisteredApi, {
          apiId: candidate._id as never,
          messages,
          maxTokens,
          temperature,
        } as never)) as { reply: string };
        return { reply: res.reply, provider: candidate.name };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "خطأ";
      }
    }
    // آخر ملجأ: السلسلة الأساسية المُتحكّمة — نائب الرئيس يستخدم هذا المفتاح الرسمي
    try {
      const sysMsg = [...messages].reverse().find((m) => m.role === "system");
      const { reply, selfGrade, confidence } = await upgradedLlm(
        ctx,
        "apiHub:official",
        sysMsg?.content ?? "أنت مساعد مركز API في اللعبة — أجب بدقة والمرفقات بالعربية.",
        messages,
        maxTokens ?? 900,
        temperature ?? 0.8,
      );
      const grade = selfGrade ? ` · تقييم ذاتي ${selfGrade}/10${confidence ? ` · ثقة ${confidence}` : ""}` : "";
      return { reply, provider: `السلسلة الأساسية (نائب الرئيس / OpenRouter)${grade}` };
    } catch {
      throw new Error(lastErr || "كل المزودين فشلوا");
    }
  },
});

/** اختبار حي: ping حقيقي لأي API مسجّل */
export const testApi = action({
  args: { apiId: v.id("apiRegistry") },
  handler: async (ctx, { apiId }): Promise<{ ok: boolean; latencyMs: number; sample?: string }> => {
    const api = (await ctx.runQuery(internal.apiHubStore.getApiInternal, { apiId })) as RegistryApi | null;
    if (!api) throw new Error("API غير موجود");
    const started = Date.now();
    try {
      const response = await fetch(buildUrl(api), {
        method: "POST",
        headers: buildHeaders(api),
        body: JSON.stringify({
          ...(api.model ? { model: api.model } : {}),
          messages: [{ role: "user", content: "قل: جاهز" }],
          max_tokens: 20,
        }),
      });
      const latencyMs = Date.now() - started;
      if (!response.ok) {
        await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: false, latencyMs });
        return { ok: false, latencyMs };
      }
      const data = await response.json();
      const sample =
        data.choices?.[0]?.message?.content ??
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        "";
      await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: true, latencyMs });
      return { ok: true, latencyMs, sample: String(sample).slice(0, 80) };
    } catch {
      const latencyMs = Date.now() - started;
      await ctx.runMutation(internal.apiHubStore.markTest, { apiId, ok: false, latencyMs }).catch(() => {});
      return { ok: false, latencyMs };
    }
  },
});

/**
 * 🔍 الاكتشاف التلقائي: الصق أمر curl خام — يحلله AI ويستخرج المواصفات
 * ويسجّل API كاملاً في السجل جاهزاً للاستخدام.
 */
export const discoverFromCurl = action({
  args: { curlCommand: v.string() },
  handler: async (ctx, { curlCommand }): Promise<{ apiId: string; name: string; spec: string }> => {
    await ensureAiRuntime(ctx); // حقن النظامين قبل الاستدعاء
    const analysis = await callLlm(
      [
        {
          role: "system",
          content:
            'أنت محلل واجهات برمجة خبير. استخرج من أمر curl الماعطى مواصفات API كاملة. أرجع JSON فقط بالشكل: {"name":"اسم قصير","provider":"الشركة/المزود","baseUrl":"الرابط الكامل لنقطة النهاية","apiKey":"المفتاح إن وجد وإلا فارغ","authStyle":"bearer|header|query|none","authHeaderName":"اسم ترويسة المصادقة إن وجد","model":"اسم النموذج إن وجد وإلا فارغ","capabilities":["chat","json",...],"notes":"ملاحظة قصيرة بالعربية"}',
        },
        { role: "user", content: curlCommand.slice(0, 4000) },
      ],
      600,
      0.2,
      "Zaka API Discovery",
    );
    const m = analysis.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("تعذّر تحليل الأمر — تأكد أنه أمر curl صالح");
    const spec = JSON.parse(m[0]) as {
      name: string; provider: string; baseUrl: string; apiKey?: string;
      authStyle: string; authHeaderName?: string; model?: string;
      capabilities?: string[]; notes?: string;
    };
    const authStyle = (["bearer", "header", "query", "none"].includes(spec.authStyle)
      ? spec.authStyle
      : "bearer") as "bearer" | "header" | "query" | "none";
    const apiId = await ctx.runMutation(api.apiHubStore.registerApi, {
      name: spec.name || "API مكتشف",
      provider: spec.provider || "غير معروف",
      baseUrl: spec.baseUrl,
      apiKey: spec.apiKey || undefined,
      authStyle,
      authHeaderName: spec.authHeaderName || (authStyle === "query" ? "key" : undefined),
      model: spec.model || undefined,
      capabilities: spec.capabilities?.length ? spec.capabilities : ["chat"],
      notes: spec.notes || "اكتُشف تلقائياً من أمر curl",
      source: "auto-discovered",
    });
    return { apiId, name: spec.name, spec: JSON.stringify(spec, null, 2) };
  },
});

// ═══════════════════════════════════════════════════════════════
// 🔑 المحلل الذكي للمفاتيح — الصق أي مفتاح AI، يتعرّف عليه AI،
// يفحصه باختبار حي، يربطه باللعبة كلها، ويعطيك تقريراً عميقاً عنه.
// ═══════════════════════════════════════════════════════════════

interface KeyAnalysis {
  provider: string;
  model: string;
  authStyle: "bearer" | "header" | "query" | "none";
  authHeaderName?: string;
  capabilities: string[];
  notes: string;
  likelyService: string;
  usageHint: string;
  quality: number;
}

const DEFAULT_KEY_ANALYSIS: KeyAnalysis = {
  provider: "openrouter",
  model: "openrouter/auto",
  authStyle: "bearer",
  capabilities: ["chat"],
  notes: "أُضيف تلقائياً عبر المحلل الذكي للمفاتيح",
  likelyService: "غير محدد",
  usageHint: 'جرّب "openrouter/auto" أولاً؛ وإن لم يعمل اختر نموذجاً متاحاً من مركز الموديلز.',
  quality: 50,
};

export const analyzeAndAddKey = action({
  args: {
    rawKey: v.string(),
    providerHint: v.optional(v.string()),
    modelHint: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { rawKey, providerHint, modelHint },
  ): Promise<{
    apiId: string;
    ok: boolean;
    latencyMs: number;
    sample: string;
    probeError: string;
    analysis: KeyAnalysis;
    keyPreview: string;
    connected: boolean;
  }> => {
    await ensureAiRuntime(ctx); // حقن النظامين قبل الاستدعاء
    const key = (rawKey ?? "").trim();
    if (key.length < 10)
      throw new Error("المفتاح قصير جداً — تأكد أنك لصقت المفتاح كاملاً.");

    // 1) تحليل عميق بالمحلل الذكي: يخمّن المزود والنموذج ونمط المصادقة والمزايا
    let analysis: KeyAnalysis = {
      ...DEFAULT_KEY_ANALYSIS,
      provider: providerHint || DEFAULT_KEY_ANALYSIS.provider,
      model: modelHint || DEFAULT_KEY_ANALYSIS.model,
    };
    const keyPreview = `${key.slice(0, 6)}••••${key.slice(-4)}`;
    try {
      const analysisText = await callLlm(
        [
          {
            role: "system",
            content:
              'أنت خبير بوابة ذكاء اصطناعي. حلّل مفتاح API هذا بذكاء وأرجع JSON فقط بالشكل: {"provider":"المزود الأرجح (openrouter|openai|anthropic|mistral|groq|together|other)","model":"نموذج مقترح يعمل غالباً","authStyle":"bearer|header|query|none","authHeaderName":"اسم الترويسة إن لزم","capabilities":["chat","json"],"likelyService":"الخدمة التي يُرجح أن المفتاح منها وعلامات تدل على ذلك من شكل البادئة","usageHint":"نصيحة استخدام عملية قصيرة بالعربية","notes":"ملاحظة تقنية قصيرة بالعربية","quality":"رقم من 0 إلى 100"}',
          },
          {
            role: "user",
            content: `المفتاح: ${keyPreview}\nالطول: ${key.length} حرف\nالبداية: ${key.slice(0, 12)}\n${providerHint ? `تلميح المزود من المستخدم: ${providerHint}\n` : ""}${modelHint ? `تلميح النموذج: ${modelHint}` : ""}`,
          },
        ],
        500,
        0.2,
        "Zaka Key Analyzer",
      );
      const m = analysisText.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as Partial<KeyAnalysis>;
        const authStyle = ["bearer", "header", "query", "none"].includes(
          parsed.authStyle ?? "",
        )
          ? (parsed.authStyle as "bearer" | "header" | "query" | "none")
          : "bearer";
        analysis = {
          ...DEFAULT_KEY_ANALYSIS,
          provider: String(parsed.provider ?? "openrouter"),
          model: String(parsed.model ?? analysis.model),
          authStyle,
          authHeaderName: parsed.authHeaderName
            ? String(parsed.authHeaderName)
            : undefined,
          capabilities: Array.isArray(parsed.capabilities) && parsed.capabilities.length
            ? parsed.capabilities.map(String)
            : ["chat"],
          notes: String(parsed.notes ?? DEFAULT_KEY_ANALYSIS.notes),
          likelyService: String(parsed.likelyService ?? "غير محدد"),
          usageHint: String(parsed.usageHint ?? DEFAULT_KEY_ANALYSIS.usageHint),
          quality: Number(parsed.quality) || 50,
        };
      }
    } catch {
      // فشل التحليل لا يوقف المحاولة — نكمل بالافتراضات
    }

    // 2) اختبار حي للمفتاح: اتصال حقيقي يقيس الزمن ويتحقق من الصلاحية
    const baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    const started = Date.now();
    let ok = false;
    let sample = "";
    let probeError = "";
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://zaka.app",
          "X-Title": "Zaka Key Probe",
        },
        body: JSON.stringify({
          model: analysis.model || "openrouter/auto",
          messages: [{ role: "user", content: "قل: جاهز" }],
          max_tokens: 20,
        }),
      });
      const latencyMs = Date.now() - started;
      if (response.ok) {
        ok = true;
        const data = await response.json();
        sample = String(
          data.choices?.[0]?.message?.content ?? data.reply ?? "",
        ).slice(0, 80);
      } else {
        const err = await response.text();
        probeError =
          response.status === 429
            ? "المفتاح تجاوز حد الاستخدام (429) — أضف رصيداً أو جرّب نموذجاً آخر."
            : `المزود رفض المفتاح (${response.status}): ${err.slice(0, 160)}`;
      }
    } catch (e) {
      probeError = e instanceof Error ? e.message : "خطأ شبكة أثناء الفحص";
    }

    // 3) الربط باللعبة كلها: نسجّل الـ API في السجل ليدخل سلسلة الاستدعاء الذكي
    const apiId = await ctx.runMutation(api.apiHubStore.registerApi, {
      name: `${analysis.provider} (محلّل ذكي)`,
      provider: analysis.provider,
      baseUrl,
      apiKey: ok ? key : undefined,
      authStyle: analysis.authStyle,
      authHeaderName:
        analysis.authStyle === "header" || analysis.authStyle === "query"
          ? analysis.authHeaderName
          : undefined,
      model: analysis.model,
      capabilities: analysis.capabilities?.length
        ? analysis.capabilities
        : ["chat"],
      notes: analysis.notes || "أُضيف تلقائياً عبر المحلل الذكي للمفاتيح",
      source: "auto-discovered",
    });

    return {
      apiId,
      ok,
      latencyMs: Date.now() - started,
      sample,
      probeError,
      analysis,
      keyPreview,
      connected: ok,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// 🔬 الفحص العميق للمفتاح — يعطيك تقريراً كاملاً وعملياً عن أي مفتاح
// (يحاول فعلياً أكثر من مزود معروف ليكشف أي بوابة ينتمي لها المفتاح
//  ويقيس الزمن ويجرّب استخراج قائمة النماذج المتاحة).
// ═══════════════════════════════════════════════════════════════

interface DeepProbe {
  provider: string;
  baseUrl: string;
  probePath?: string;
}

const DEEP_PROBES: DeepProbe[] = [
  { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1/chat/completions" },
  { provider: "openai", baseUrl: "https://api.openai.com/v1/chat/completions" },
  { provider: "anthropic", baseUrl: "https://api.anthropic.com/v1/messages" },
  { provider: "mistral", baseUrl: "https://api.mistral.ai/v1/chat/completions" },
  { provider: "groq", baseUrl: "https://api.groq.com/openai/v1/chat/completions" },
  { provider: "together", baseUrl: "https://api.together.xyz/v1/chat/completions" },
  { provider: "deepseek", baseUrl: "https://api.deepseek.com/chat/completions" },
];

export const deepInspectKey = action({
  args: { rawKey: v.string() },
  handler: async (
    ctx,
    { rawKey },
  ): Promise<{
    keyPreview: string;
    length: number;
    recognizedProvider: string;
    matched: Array<{ provider: string; ok: boolean; latencyMs: number; status?: number; hint?: string; modelsSample?: string[] }>;
    verified: boolean;
    bestLatencyMs: number;
    recommendations: string[];
  }> => {
    const key = (rawKey ?? "").trim();
    if (key.length < 10) throw new Error("المفتاح قصير جداً.");
    const keyPreview = `${key.slice(0, 6)}••••${key.slice(-4)}`;

    const matched: Array<{ provider: string; ok: boolean; latencyMs: number; status?: number; hint?: string; modelsSample?: string[] }> = [];
    let bestLatencyMs = 0;
    const recommendations: string[] = [];

    // 1) استنتاج البادئة (علامة واضحة على المزود)
    const lower = key.toLowerCase();
    let recognizedProvider = "غير محدد";
    if (lower.startsWith("sk-or-")) recognizedProvider = "openrouter";
    else if (lower.startsWith("sk-proj-") || lower.startsWith("sk-ant-")) recognizedProvider = "openai/anthropic (احتمال)";
    else if (lower.startsWith("sk-ant-")) recognizedProvider = "anthropic";
    else if (lower.startsWith("gsk_")) recognizedProvider = "groq";
    else if (lower.startsWith("AIza")) recognizedProvider = "google gemini";
    else if (lower.startsWith("sk-")) recognizedProvider = "sk- عام (يحتمل openai أو غيرها)";

    // 2) محاولة فعلية على عدة مزودين لكشف الانتماء الحقيقي
    const startedAll = Date.now();
    for (const probe of DEEP_PROBES) {
      const t0 = Date.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const response = await fetch(probe.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            ...(probe.provider === "anthropic" ? { "anthropic-version": "2023-06-01", "x-api-key": key } : {}),
            "HTTP-Referer": "https://zaka.app",
            "X-Title": "Zaka Deep Probe",
          },
          body: JSON.stringify({
            ...(probe.provider === "anthropic"
              ? { model: "claude-3-haiku-20240307", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }
              : { model: "openrouter/auto", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const latencyMs = Date.now() - t0;
        if (response.ok) {
          matched.push({ provider: probe.provider, ok: true, latencyMs });
          if (!bestLatencyMs || latencyMs < bestLatencyMs) bestLatencyMs = latencyMs;
        } else {
          let hint = "";
          const text = (await response.text().catch(() => "")).slice(0, 120);
          if (response.status === 401) hint = "مفتاح مرفوض";
          else if (response.status === 404) hint = "رابط/نموذج غير صالح";
          else if (response.status === 429) hint = "حد الاستخدام — يعمل لكنه مشبع";
          else hint = text;
          matched.push({ provider: probe.provider, ok: false, latencyMs, status: response.status, hint });
        }
      } catch {
        matched.push({ provider: probe.provider, ok: false, latencyMs: Date.now() - t0, status: 0, hint: "مهلة/شبكة" });
      }
    }

    const verified = matched.some((m) => m.ok);
    const verifiedProvider = matched.find((m) => m.ok)?.provider;
    const elapsed = Date.now() - startedAll;

    // 3) إن نجح فجرّب جلب قائمة النماذج المتاحة فعلياً
    let modelsSample: string[] = [];
    if (verifiedProvider === "openrouter") {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: ctrl.signal });
        clearTimeout(timer);
        if (r.ok) {
          const data: any = await r.json();
          modelsSample = (data.data ?? []).slice(0, 8).map((m: any) => String(m.id ?? m.name ?? ""));
        }
      } catch {
        /* اختياري */
      }
    }

    // 4) توصيات عملية مبنية على نتائج الفحص
    if (verifiedProvider) {
      recommendations.push(`المفتاح يعمل فعلياً مع ${verifiedProvider} — أفضل زمن ${bestLatencyMs}ms`);
      if (modelsSample.length) recommendations.push(`يتوفر لهذه النماذج: ${modelsSample.slice(0, 4).join(", ")}`);
      else recommendations.push("لا يمكن سحب قائمة النماذج حالياً (قد تكون مقيدة بالمزود)");
    } else {
      recommendations.push("لم يُقبل المفتاح من أي مزود معروف — تحقق من صحته أو اشترِ مفتاحاً جديداً");
      const http401 = matched.filter((m) => m.status === 401);
      if (http401.length) recommendations.push(`${http401.length} مزوداً رفضوه بتفويض 401 — المفتاح ملغي أو خاطئ`);
    }
    recommendations.push(`فحص ${DEEP_PROBES.length} مزودين في ${elapsed}ms`);

    // 5) تسجيل الحدث
    try {
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: verifiedProvider ?? "unknown",
        event: "deep_inspect",
        detail: `فحص عميق: ${keyPreview} → ${verified ? "✓ " + verifiedProvider : "✗ لا مزود"} (${elapsed}ms)`,
        severity: verified ? "info" : "warning",
        at: Date.now(),
      });
    } catch {
      /* سجل اختياري */
    }

    return {
      keyPreview,
      length: key.length,
      recognizedProvider,
      matched,
      verified,
      bestLatencyMs,
      recommendations,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// 🛡️ دمج قدرات مساعد نائب المالك + صياد الأخطاء — حارس موحّد
// يختار المالك مساعداً ويهبه قدرات صياد الأخطاء (الرصد/الشفاء/الفحص)
// ليضمن سلاسة النظام وأمنه العام — ويُنشأ حارس فعلي يراقب ويسجّل.
// ═══════════════════════════════════════════════════════════════

export const mergeSafeguard = action({
  args: {
    assistantId: v.string(),
    includeErrorHunter: v.optional(v.boolean()),
    includeSecurity: v.optional(v.boolean()),
    includeEconomyWatch: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { assistantId, includeErrorHunter, includeSecurity, includeEconomyWatch },
  ): Promise<{
    ok: boolean;
    guardName: string;
    guardianName: string;
    mergedCapabilities: string[];
    report: {
      unresolvedErrors: number;
      criticalErrors: number;
      errorCategories: Record<string, number>;
      activeApis: number;
      failedApis: number;
      disabledApis: number;
      securityWarnings: number;
      healthStatus: string;
    };
    findings: string[];
  }> => {
    const assistant = assistantById(assistantId) ?? ASSISTANT_MINDS[0];
    const mergedCapabilities: string[] = [assistant.privilege];
    if (includeErrorHunter) mergedCapabilities.push("رصد الأخطاء وتجميعها وشفاؤها تلقائياً (صياد الأخطاء)");
    if (includeSecurity) mergedCapabilities.push("مراقبة أمنية: رفض المفاتيح الملوّثة، كشف الشذوذ، تنفيذ الحظر (ليْرا/أمن)");
    if (includeEconomyWatch) mergedCapabilities.push("رقابة اقتصادية: تتبّع نجاح/فشل المزودين ومنع استنزاف النقاط (ميريديان/اقتصاد)");

    // قراءة حية لحالة النظام
    const report = {
      unresolvedErrors: 0,
      criticalErrors: 0,
      errorCategories: {} as Record<string, number>,
      activeApis: 0,
      failedApis: 0,
      disabledApis: 0,
      securityWarnings: 0,
      healthStatus: "غير محدد",
    };
    const findings: string[] = [];

    try {
      const errors = (await ctx.runQuery(api.errorHunter.getUnresolvedErrors, {})) as Array<{
        severity?: string;
        category?: string;
        count?: number;
        message?: string;
      }>;
      report.unresolvedErrors = errors.length;
      report.criticalErrors = errors.filter((e) => e.severity === "critical").length;
      for (const e of errors) {
        const cat = e.category || "unknown";
        report.errorCategories[cat] = (report.errorCategories[cat] ?? 0) + (e.count ?? 1);
      }
      if (report.unresolvedErrors === 0) findings.push("✅ لا أخطاء معلّقة حالياً");
      else findings.push(`⚠️ ${report.unresolvedErrors} خطأ غير محلول (${report.criticalErrors} حرج) — الحارس راقبها`);
    } catch {
      findings.push("تعذّر قراءة سجل الأخطاء");
    }

    try {
      const apis = (await ctx.runQuery(api.apiHubStore.listApis, {})) as Array<{ status?: string }>;
      report.activeApis = apis.filter((a) => a.status === "active").length;
      report.failedApis = apis.filter((a) => a.status === "failed").length;
      report.disabledApis = apis.filter((a) => a.status === "disabled").length;
      if (report.failedApis) findings.push(`⚠️ ${report.failedApis} API فاشل — الحارس سيعطّله تلقائياً لحماية السلسلة`);
      if (report.disabledApis) findings.push(`ℹ️ ${report.disabledApis} API معطّل بيدك`);
    } catch {
      findings.push("تعذّر قراءة سجل APIs");
    }

    try {
      const health = (await ctx.runQuery(api.errorHunter.getSystemHealth, {})) as { status?: string } | null;
      report.healthStatus = health?.status ?? "غير محدد";
      findings.push(`الحالة الصحية للنظام: ${report.healthStatus}`);
    } catch {
      /* اختياري */
    }

    // تسجيل الحارس ككيان فعلي في سجل أنظمة النائب
    const guardName = `${assistant.emoji} ${assistant.name} — حارس موحّد (${mergedCapabilities.length} قدرات مدمجة)`;
    try {
      await ctx.runMutation(internal.apiHubInternal.registerViceSystem, {
        name: guardName,
        purpose: `حارس مدمج يجمع قدرات ${assistant.name} مع ${mergedCapabilities.slice(1).join(" و") || "المراقبة الأساسية"} لضمان سلامة النظام وسلاسة الأداء والأمن العام`,
        spec: JSON.stringify({ assistantId, mergedCapabilities, report, findings, createdAt: Date.now() }, null, 2),
      });
    } catch {
      /* اختياري */
    }

    return { ok: true, guardName, guardianName: assistant.name, mergedCapabilities, report, findings };
  },
});
