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
import { upgradedLlm } from "./aiUpgradeKit";
import { registerViceSystem } from "./apiHubInternal";

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
      return { reply, provider: `السلسلة الأساسية (نائب الرئيس / DeepSeek)${grade}` };
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
              'أنت خبير بوابة ذكاء اصطناعي. حلّل مفتاح API هذا بذكاء وأرجع JSON فقط بالشكل: {"provider":"المزود الأرجح (openrouter|deepseek|openai|anthropic|mistral|groq|together|other)","model":"نموذج مقترح يعمل غالباً","authStyle":"bearer|header|query|none","authHeaderName":"اسم الترويسة إن لزم","capabilities":["chat","json"],"likelyService":"الخدمة التي يُرجح أن المفتاح منها وعلامات تدل على ذلك من شكل البادئة","usageHint":"نصيحة استخدام عملية قصيرة بالعربية","notes":"ملاحظة تقنية قصيرة بالعربية","quality":"رقم من 0 إلى 100"}',
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
