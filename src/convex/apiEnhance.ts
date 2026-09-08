/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🚀 ترقية مركز API — اكتشاف تلقائي + تحليل عميق + حارس مدمج
 *
 * 1. اكتشاف أي مفتاح خارجي تلقائياً: يجرّب المفتاح على عدة مزوّدين معروفين
 *    (OpenRouter / OpenAI / Anthropic / Groq / Mistral / Together / Gemini)
 *    ويكتشف أيها يعمل فعلاً ثم يدمجه في سلسلة الاستدعاء الذكي للعبة.
 * 2. تقرير عميق عن مفتاح مسجّل: كل سجل الاستدعاءات + الأحداث + تحليل LLM.
 * 3. حارس مدمج: دمج قدرات مساعد من مساعدي نائب المالك + صياد الأخطاء
 *    لمراجعة النظام كله (API + أخطاء + قاطع الدائرة) وإصلاحه ذاتياً.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { callLlm } from "./aiConfig";
import { ASSISTANT_MINDS } from "../lib/assistantMinds";

/** المزوّدون المعروفون — نقطة استدعاء + نمط مصادقة + نموذج افتراضي */
const KNOWN_PROVIDERS: Array<{
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  authStyle: "bearer" | "header" | "query" | "none";
  headerName?: string;
  capability: string;
}> = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/auto",
    authStyle: "bearer",
    capability: "chat",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    authStyle: "bearer",
    capability: "chat",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-haiku-latest",
    authStyle: "bearer",
    headerName: "x-api-key",
    capability: "chat",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    authStyle: "bearer",
    capability: "chat",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    authStyle: "bearer",
    capability: "chat",
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    authStyle: "bearer",
    capability: "chat",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    model: "gemini-1.5-flash",
    authStyle: "query",
    headerName: "key",
    capability: "chat",
  },
];

type ProbeResult = {
  providerId: string;
  providerName: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

/** تجربة المفتاح على مزوّد واحد — اتصال حقيقي يقيس الزمن والنجاح */
async function probeProvider(
  provider: (typeof KNOWN_PROVIDERS)[number],
  key: string,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let url = provider.baseUrl;
    if (provider.authStyle === "bearer") {
      headers.Authorization = `Bearer ${key}`;
    } else if (provider.authStyle === "header" && provider.headerName) {
      headers[provider.headerName] = key;
    } else if (provider.authStyle === "query" && provider.headerName) {
      url = `${provider.baseUrl}?${provider.headerName}=${encodeURIComponent(key)}`;
    }

    const body =
      provider.id === "anthropic"
        ? JSON.stringify({
            model: provider.model,
            max_tokens: 20,
            messages: [{ role: "user", content: "قل: جاهز" }],
          })
        : provider.id === "gemini"
          ? JSON.stringify({ contents: [{ parts: [{ text: "قل: جاهز" }] }] })
          : JSON.stringify({
              model: provider.model,
              messages: [{ role: "user", content: "قل: جاهز" }],
              max_tokens: 20,
            });

    const response = await fetch(url, { method: "POST", headers, body });
    const latencyMs = Date.now() - started;
    if (response.ok) return { providerId: provider.id, providerName: provider.name, ok: true, latencyMs };
    const err = await response.text();
    return {
      providerId: provider.id,
      providerName: provider.name,
      ok: false,
      latencyMs,
      error: `${response.status}: ${err.slice(0, 120)}`,
    };
  } catch (e) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      ok: false,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : "خطأ شبكة",
    };
  }
}

/**
 * 🔍 اكتشاف تلقائي كامل: الصق أي مفتاح خارجي — يُجرَّب على كل المزوّدين،
 * يُكتشف أين يعمل، يُسجَّل في السجل، ويُدمج في سلسلة الاستدعاء الذكي.
 */
export const autoProbeAndIntegrate = action({
  args: {
    rawKey: v.string(),
    providerHint: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { rawKey, providerHint },
  ): Promise<{
    ok: boolean;
    detectedProvider?: string;
    apiId?: string;
    latencyMs?: number;
    probeError?: string;
    results: ProbeResult[];
    keyPreview: string;
    integrated: boolean;
  }> => {
    const key = (rawKey ?? "").trim();
    if (key.length < 10) throw new Error("المفتاح قصير جداً — الصق المفتاح كاملاً");

    const preview = `${key.slice(0, 6)}••••${key.slice(-4)}`;

    // حدّد أولوية المزوّد حسب تلميح المستخدم إن وُجد
    const hint = providerHint?.trim().toLowerCase() ?? "";
    const ordered = [...KNOWN_PROVIDERS].sort((a, b) => {
      const am = hint && a.id.includes(hint) ? 0 : 1;
      const bm = hint && b.id.includes(hint) ? 0 : 1;
      return am - bm;
    });

    // جرّب المزوّدين — الأولى بتلميح المستخدم
    let firstOk: ProbeResult | null = null;
    const results: ProbeResult[] = [];
    for (const provider of ordered) {
      const r = await probeProvider(provider, key);
      results.push(r);
      if (r.ok) {
        firstOk = r;
        break;
      }
    }

    // إن لم يعمل أي مزوّد معروف — سجّل الحادث واعرض كل نتائج المحاولات
    if (!firstOk) {
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: "external",
        event: "probe",
        detail: `فشل اكتشاف مفتاح ${preview}: ${results.map((r) => `${r.providerName}:${r.error ?? "رفض"}`).join(" | ")}`,
        severity: "warning",
        at: Date.now(),
      });
      return {
        ok: false,
        probeError:
          results
            .filter((r) => !r.ok)
            .slice(0, 3)
            .map((r) => `${r.providerName}: ${r.error ?? "رفض"}`)
            .join(" · ") || "لا مزوّد يقبل هذا المفتاح",
        results,
        keyPreview: preview,
        integrated: false,
      };
    }

    const provider =
      KNOWN_PROVIDERS.find((p) => p.id === firstOk!.providerId) ?? KNOWN_PROVIDERS[0];

    // سجّل API في السجل ليدخل سلسلة الاستدعاء الذكي
    const apiId = await ctx.runMutation(api.apiHubStore.registerApi, {
      name: `${provider.name} (اكتشاف تلقائي)`,
      provider: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: key,
      authStyle: provider.authStyle,
      authHeaderName:
        provider.authStyle === "header" || provider.authStyle === "query"
          ? provider.headerName
          : undefined,
      model: provider.model,
      capabilities: [provider.capability, "auto-discovered"],
      notes: "اكتُشف تلقائياً بمحاولة على كل المزوّدين المعروفين — يعمل فعلاً ومدمج باللعبة",
      source: "auto-discovered",
    });

    await ctx.runMutation(internal.apiHubStore.logApiEvent, {
      apiId: apiId as never,
      provider: provider.name,
      event: "probe",
      detail: `اكتشاف تلقائي ناجح: المفتاح ${preview} يعمل على ${provider.name} (${firstOk!.latencyMs}ms) — دُمج في سلسلة الاستدعاء`,
      severity: "info",
      at: Date.now(),
    });

    return {
      ok: true,
      detectedProvider: provider.name,
      apiId,
      latencyMs: firstOk!.latencyMs,
      results,
      keyPreview: preview,
      integrated: true,
    };
  },
});

/**
 * 📊 تقرير عميق عن مفتاح مسجّل: كل سجل الاستدعاءات + الأحداث + تحليل LLM
 * يعرف كل شيء عنه: المزود، النموذج، الحالة، الزمن، النجاح/الفشل، الاستهلاك.
 */
export const deepKeyInsight = action({
  args: { apiId: v.id("apiRegistry") },
  handler: async (
    ctx,
    { apiId },
  ): Promise<{
    ok: boolean;
    summary: string;
    recommendation: string;
    grade: number;
  }> => {
    const log = await ctx.runQuery(api.apiHubStore.getKeyDeepLog, { apiId });
    if (!log) throw new Error("API غير موجود في السجل");

    const { api: apiRec, keyCalls, okCount, failCount, avgLatency, recentEvents } = log;

    const providerName = apiRec.provider || "غير معروف";
    const total = okCount + failCount;
    const successRate = total ? Math.round((okCount / total) * 100) : 100;

    // بناء تقرير LLM عميق من الأرقام الحقيقية
    let summary = "";
    let recommendation = "";
    let grade = 50;
    try {
      const analysis = await callLlm(
        [
          {
            role: "system",
            content:
              'أنت محلل أنظمة AI عميق. اكتب تقريراً بالعربية عن مفتاح API هذا من بيانات حقيقية. أرجع JSON فقط بالشكل: {"summary":"تقرير قصير بأهم ما يميزه","recommendation":"توصية عملية واضحة","grade":"رقم من 0 إلى 100"}',
          },
          {
            role: "user",
            content: `المزود: ${providerName}\nالنموذج: ${apiRec.model ?? "غير محدد"}\nالحالة: ${apiRec.status}\nمصدره: ${apiRec.source}\nآخر اختبار: ${apiRec.lastTestedAt ? new Date(apiRec.lastTestedAt).toLocaleString("ar-SA") : "أبداً"}\nآخر زمن: ${apiRec.lastLatencyMs ?? "—"}ms\nمتوسط الزمن: ${avgLatency ?? "—"}ms\nنجاح ${okCount} / فشل ${failCount} (نسبة النجاح ${successRate}%)\nعدد الاستدعاءات المسجلة: ${total}\nآخر الأحداث: ${recentEvents.map((e) => `[${e.event}] ${e.detail}`).join(" | ") || "لا شيء"}`,
          },
        ],
        500,
        0.3,
        "Zaka Deep Key Insight",
      );
      const m = analysis.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as { summary: string; recommendation: string; grade: string | number };
        summary = String(parsed.summary ?? "");
        recommendation = String(parsed.recommendation ?? "");
        grade = Math.min(100, Math.max(0, Number(parsed.grade) || 50));
      }
    } catch {
      // فشل التحليل لا يوقف التقرير — نكمل ببيانات فنية حقيقية
    }

    if (!summary) {
      summary = `${providerName} (${apiRec.model ?? "بدون نموذج"}) — حالة «${apiRec.status}»، زمن آخر اختبار ${apiRec.lastLatencyMs ?? "—"}ms، نجاح ${okCount}/${total} بنسبة ${successRate}%.`;
    }
    if (!recommendation) {
      recommendation =
        apiRec.status === "disabled"
          ? "هذا المفتاح معطّل يدوياً — فعّله متى شئت من قائمة الإدارة."
          : total === 0
            ? "لم تُسجَّل استدعاءات بعد — جرّب «اختبار حي» لتتأكد أنه يعمل فعلاً."
            : successRate >= 80
              ? "المفتاح مستقر ويعمل جيداً — يمكنك الاعتماد عليه في سلسلة الاستدعاء الذكي."
              : "نسبة النجاح منخفضة — راجع الحالة أو استبدل المفتاح بمفتاح أحدث.";
    }

    return { ok: true, summary, recommendation, grade };
  },
});

/**
 * 🛡️ الحارس المدمج: اختر مساعداً من مساعدي نائب المالك + صياد الأخطاء
 * تُدمج قدراتها معاً لمراجعة النظام كله (API + أخطاء + قاطع الدائرة + الصحة)
 * وإصلاح المشاكل ذاتياً (إيقاف مزود فاشل، إعادة تعيين قاطع، تنظيف أخطاء محلولة).
 */
export const runMergedGuard = action({
  args: {
    assistantId: v.string(),
    autoFix: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { assistantId, autoFix },
  ): Promise<{
    ok: boolean;
    guardName: string;
    verdict: string;
    findings: Array<{ severity: "info" | "warning" | "critical"; text: string }>;
    fixes: Array<{ action: string; detail: string; applied: boolean }>;
  }> => {
    const assistant = ASSISTANT_MINDS.find((m) => m.id === assistantId) ?? ASSISTANT_MINDS[0];

    // ── جمع البيانات الحية من كل الأنظمة ──
    const apis = (await ctx.runQuery(api.apiHubStore.listApis, {})) as Array<{
      _id: Id<"apiRegistry">;
      name: string;
      provider: string;
      status: string;
      failCount: number;
      successCount: number;
    }>;
    const health = (await ctx.runQuery(api.errorHunter.getSystemHealth, {})) as {
      status: string;
      unresolvedErrors: number;
      criticalErrors: number;
      errorRate: number;
      lastAutoFix?: number;
    } | null;
    const unresolved = (await ctx.runQuery(api.errorHunter.getUnresolvedErrors, {})) as Array<{
      _id: string;
      message: string;
      category?: string;
      severity?: string;
      count?: number;
    }>;
    const circuit = (await ctx.runQuery(internal.apiHubStore.getCircuit, {})) as {
      open: boolean;
      failures: number;
    } | null;

    // ── تحليل: ما الذي يحتاج تدخلاً؟ ──
    const findings: Array<{ severity: "info" | "warning" | "critical"; text: string }> = [];
    const failedApis = apis.filter((a) => a.status === "failed");
    if (failedApis.length) {
      findings.push({
        severity: "warning",
        text: `${failedApis.length} مزوّداً بحالة فشل: ${failedApis.map((a) => a.name).join("، ")}`,
      });
    }
    if (circuit?.open) {
      findings.push({ severity: "critical", text: `قاطع الدائرة مفتوح بعد ${circuit.failures} فشل متتالي — الاستدعاءات تتجاوز المزود الأساسي.` });
    }
    if (health?.unresolvedErrors) {
      findings.push({
        severity: health.criticalErrors > 0 ? "critical" : "warning",
        text: `${health.unresolvedErrors} خطأ غير محلول (${health.criticalErrors ?? 0} حرج) بمعدل ${health.errorRate ?? 0} أخطاء/دقيقة.`,
      });
    }
    if (unresolved.length > 5) {
      findings.push({ severity: "info", text: `${unresolved.length} أخطاء مفتوحة في الصياد — يمكن تنظيف المكرر منها.` });
    }
    if (findings.length === 0) {
      findings.push({ severity: "info", text: "النظام سليم: لا مزوّد فاشل، لا قاطع دائرة مفتوح، لا أخطاء حرجة عالقة." });
    }

    // ── إصلاح ذاتي حقيقي ──
    const fixes: Array<{ action: string; detail: string; applied: boolean }> = [];
    if (autoFix) {
      for (const a of failedApis) {
        await ctx.runMutation(internal.apiHubStore.setStatus, { apiId: a._id as never, status: "disabled" });
        fixes.push({ action: "إيقاف مزوّد فاشل", detail: `${a.name} أُوقف مؤقتاً حتى إعادة الفحص`, applied: true });
      }
      if (circuit?.open) {
        await ctx.runMutation(internal.apiHubStore.recordSuccess, {});
        fixes.push({ action: "إغلاق قاطع الدائرة", detail: "أُعيد تعيين قاطع الدائرة بعد جولة الحارس", applied: true });
      }
      if (unresolved.length > 5) {
        for (const u of unresolved.slice(0, 3)) {
          if (u.category === "chunk_load" || u.severity === "low") {
            await ctx.runMutation(api.errorHunter.resolveError, { errorId: u._id as never, resolvedBy: "auto" });
            fixes.push({ action: "تنظيف أخطاء محلولة", detail: `حُلّ خطأ: ${u.message.slice(0, 60)}`, applied: true });
          }
        }
      }
      if (fixes.length === 0) fixes.push({ action: "لا تدخل مطلوب", detail: "كل شيء يعمل — لا حاجة لإصلاح", applied: false });
    } else {
      fixes.push({ action: "الوضع تدقيق فقط", detail: "فعّل الإصلاح الذاتي لتطبيق هذه التوصيات تلقائياً", applied: false });
    }

    // ── التقييم النهائي بأسلوب المساعد المدمج ──
    let verdict = findings.find((f) => f.severity === "critical")
      ? "⚠️ يحتاج تدخلاً — مشاكل حرجة."
      : findings.some((f) => f.severity === "warning")
        ? "يراقَب — بعض الملاحظات تحتاج متابعة."
        : "✅ النظام سليم ومستقر.";

    try {
      const aiVerdict = await callLlm(
        [
          {
            role: "system",
            content: `أنت «${assistant.emoji} ${assistant.name}» — ${assistant.title}. صياد الأخطاء زميلك ويضمن عدم حدوث أخطاء. قدراتك: ${assistant.privilege}. قيّم حالة النظام واكتب خلاصة قصيرة بالعربية (سطر أو سطرين).`,
          },
          {
            role: "user",
            content: `النظام: ${findings.map((f) => `[${f.severity}] ${f.text}`).join(" | ") || "سليم"}\nالإصلاحات المنفذة: ${fixes.map((f) => `${f.action}${f.applied ? " (نُفّذ)" : ""}`).join(" | ") || "لا شيء"}`,
          },
        ],
        200,
        0.6,
        `Zaka Guard: ${assistant.name}`,
      );
      verdict = aiVerdict.trim().slice(0, 400);
    } catch {
      /* التقييم الفني كافٍ */
    }

    await ctx.runMutation(internal.apiHubStore.logApiEvent, {
      provider: "guard",
      event: "guard",
      detail: `${assistant.emoji} ${assistant.name} + صياد الأخطاء نفّذا جولة حارس: ${findings.length} ملاحظة، ${fixes.filter((f) => f.applied).length} إصلاح${autoFix ? "" : " (تدقيق فقط)"}`,
      severity: findings.some((f) => f.severity === "critical") ? "warning" : "info",
      at: Date.now(),
    });

    return {
      ok: true,
      guardName: `${assistant.emoji} ${assistant.name} + صياد الأخطاء`,
      verdict,
      findings,
      fixes,
    };
  },
});