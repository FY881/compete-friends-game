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
    // آخر ملجأ: السلسلة الأساسية (OpenRouter → OneHop) — عبر عدة الترقية الكاملة
    try {
      const sysMsg = [...messages].reverse().find((m) => m.role === "system");
      const { reply, selfGrade, confidence } = await upgradedLlm(
        ctx,
        "apiHub:general",
        sysMsg?.content ?? "أنت مساعد ذكي ضمن مركز API في لعبة حرب العقول — أجب بدقة واختصار.",
        messages,
        maxTokens ?? 900,
        temperature ?? 0.8,
      );
      const grade = selfGrade ? ` · تقييم ذاتي ${selfGrade}/10${confidence ? ` · ثقة ${confidence}` : ""}` : "";
      return { reply, provider: `السلسلة الأساسية (OpenRouter/OneHop)${grade}` };
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
