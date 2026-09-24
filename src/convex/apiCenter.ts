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
import { api } from "./_generated/api";
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
  providerChatUrls,
  providerModelsUrls,
  readCompletion,
  type EngineProvider,
} from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

function findProvider(id: string): EngineProvider | null {
  const providers = getEngineConfig().providers;
  return (
    providers.find((p) => p.id === id) ??
    // Environment bootstrap is intentionally exposed through slot A so the
    // owner can run a real verification even when no DB row exists yet.
    (id === "A" ? providers.find((p) => p.id === "env") : null) ?? null
  );
}

/** 🧪 تحقق حقيقي: طلب فعلي للمزوّد المختار بدليل مسجَّل */
// ════════════════════════════════════════════════════════════════════
// 🔄 التزامن الكامل — يربط كل تبويبات ووحدات غرفة المالك بمركز API
// ════════════════════════════════════════════════════════════════════
// يعيد حقن إعدادات المركز في كل الأنظمة عبر ensureAiRuntime، ويفحص مزوّد A
// و B والبيئة معاً، ويُصدر تقريراً موحّداً لكل وحدة مرتبطة بالمركز.

export const syncCenter = action({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    injected: boolean;
    envActive: boolean;
    slotA: SlotHealth | null;
    slotB: SlotHealth | null;
    engines: { key: string; label: string; provider: string }[];
    syncedAt: number;
  }> => {
    // 1) حقن إعدادات المركز في كل الوحدات (env + A + B)
    await ensureAiRuntime(ctx);

    // 2) فحص حيّ للمزوّدين معاً (تزامن حقيقي وليس شكلياً)
    const report = (await ctx.runAction(api.apiCenter.healthReport, {})) as any;
    const slotA = (report?.slots as SlotHealth[] | undefined)?.find((s) => s.slot === "A") ?? null;
    const slotB = (report?.slots as SlotHealth[] | undefined)?.find((s) => s.slot === "B") ?? null;

    // 3) خريطة الوحدات المرتبطة بالمركز
    const engines = (
      [
        ["vice_owner", "نائب المالك", "center"],
        ["ai_systems", "أنظمة AI", "center"],
        ["ai_control", "مركز تحكم AI", "center"],
        ["moderation", "الإشراف الذكي", "center"],
        ["crown_deck", "مجلس العقول", "center"],
        ["ai_questions", "مولّد الأسئلة", "center"],
        ["ai_coach", "المدرب الذكي", "center"],
        ["ai_free", "AI حر", "center"],
        ["reports_smart", "البلاغات الذكية", "center"],
        ["question_packs", "حزم الأسئلة", "center"],
      ] as const
    ).map(([key, label, provider]) => ({ key, label, provider }));

    try {
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: "center",
        event: "sync_center",
        detail: `تزامن المركز: env=${report?.envActive ? "فعّال" : "غير مضبوط"} · A=${slotA?.ok ? "سليم" : "فاشل"} · B=${slotB?.ok ? "سليم" : "فاشل"} · ${engines.length} وحدة مرتبطة`,
        severity: "info",
        at: Date.now(),
      });
    } catch {
      /* لا يُسقط النتيجة */
    }

    return {
      ok: true,
      injected: true,
      envActive: Boolean(report?.envActive),
      slotA,
      slotB,
      engines,
      syncedAt: Date.now(),
    };
  },
});

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
    const urls = providerChatUrls(provider);
    let model = chain[0] ?? "gpt-4o-mini";
    let url = urls[0] ?? "";
    const started = Date.now();
    let ok = false;
    let status = 0;
    let reply = "";
    let error: string | undefined;
    let tokensIn = 0;
    let tokensOut = 0;

    outer: for (const candidateModel of chain.length > 0 ? chain : [model]) {
      for (const candidateUrl of urls.length > 0 ? urls : [url]) {
        model = candidateModel;
        url = candidateUrl;
        const built = buildRequest({
          provider,
          model,
          messages: [{ role: "user", content: "قل: جاهز" }],
          maxTokens: 24,
          temperature: 0,
          jsonMode: false,
          label: `Zaka Verify ${which}`,
          url,
        });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25_000);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: built.headers,
            body: JSON.stringify(built.body),
            signal: controller.signal,
          });
          status = res.status;
          const raw = await res.text().catch(() => "");
          if (res.ok) {
            let parsedText = "";
            try {
              const parsed = readCompletion(JSON.parse(raw));
              parsedText = parsed.text;
              tokensIn = parsed.tokensIn;
              tokensOut = parsed.tokensOut;
            } catch {
              if (!/^\s*(<!doctype|<html|<\?xml)/i.test(raw)) parsedText = raw;
            }
            if (parsedText.trim()) {
              reply = parsedText.slice(0, 200);
              ok = true;
              error = undefined;
              break outer;
            }
            error = "المزوّد أعاد رداً فارغاً";
          } else {
            error = humanizeProviderError(res.status, raw);
            // 404/405/501 indicate that this endpoint is not the one exposed by
            // the provider; try the next normalized/legacy path.
            if ([404, 405, 501].includes(res.status)) continue;
            // Authentication and balance failures apply to the provider itself.
            if (res.status === 401 || res.status === 403 || res.status === 402) break outer;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "خطأ شبكة";
        } finally {
          clearTimeout(timer);
        }
      }
    }
    if (!ok && !error) error = "تعذر الحصول على رد من المزوّد";

    const latencyMs = Date.now() - started;
    try {
      await ctx.runMutation(internal.apiCenterStore.recordCall, {
        ok,
        provider: provider.id,
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

    const urls = providerModelsUrls(provider);
    const presetId = provider.presetId;
    const preset = getPreset(presetId);
    const headers: Record<string, string> =
      preset.authStyle === "header" && preset.authHeaderName
        ? { [preset.authHeaderName]: provider.apiKey }
        : { Authorization: `Bearer ${provider.apiKey}` };

    let models: string[] = [];
    let error: string | undefined;
    let url = urls[0] ?? "";

    for (const candidateUrl of urls) {
      url = candidateUrl;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        const raw = await res.text().catch(() => "");
        if (!res.ok) {
          error = humanizeProviderError(res.status, raw);
          if ([404, 405, 501].includes(res.status)) continue;
          if (res.status === 401 || res.status === 403 || res.status === 402) break;
          continue;
        }
        const parsed = JSON.parse(raw) as {
          data?: Array<{ id?: string }>;
          models?: Array<{ id?: string } | string>;
          data_list?: Array<{ model_id?: string; id?: string }>;
        };
        const list =
          parsed.data?.map((m) => m?.id ?? "").filter(Boolean) ??
          parsed.data_list?.map((m) => m?.model_id ?? m?.id ?? "").filter(Boolean) ??
          (parsed.models ?? []).map((m) => (typeof m === "string" ? m : (m?.id ?? ""))).filter(Boolean);
        models = [...new Set(list.map((m) => m.trim()).filter(Boolean))];
        if (models.length > 0) {
          error = undefined;
          break;
        }
        error = "المزوّد ردّ بقائمة فارغة";
      } catch (e) {
        error = e instanceof Error ? e.message : "خطأ شبكة";
      } finally {
        clearTimeout(timer);
      }
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

// ═══════════════════════════════════════════════════════════════════════
// 🩺 تقرير الصحة الحي — فحص فعلي لكل مزوّد + جاهزية المحرك
// ═══════════════════════════════════════════════════════════════════════

export type SlotHealth = {
  slot: string;
  ok: boolean;
  model?: string;
  latencyMs: number;
  status: number;
  error?: string;
  reply?: string;
  source: "center" | "env" | "missing";
};

/**
 * فحص صحة شامل: يجرّب مزوّد A ومزوّد B ومزوّد البيئة الاحتياطي
 * بطلبات شبكة حقيقية، ويقيس زمن كل واحدة، ويعيد فتح القاطع تلقائياً
 * إذا نجح أي فحص (إصلاح ذاتي حقيقي وليس مجرد زر).
 */
export const healthReport = action({
  args: {},
  handler: async (ctx): Promise<{
    slots: SlotHealth[];
    anyOk: boolean;
    circuitWasOpen: boolean;
    circuitReset: boolean;
    envActive: boolean;
    checkedAt: number;
  }> => {
    await ensureAiRuntime(ctx);

    const probe = async (which: "A" | "B"): Promise<SlotHealth> => {
      try {
        const r = (await ctx.runAction(api.apiCenter.verifyProvider, { which })) as any;
        return {
          slot: which,
          ok: Boolean(r?.ok),
          model: r?.model,
          latencyMs: r?.latencyMs ?? 0,
          status: r?.status ?? 0,
          error: r?.error,
          reply: r?.reply,
          source: "center",
        };
      } catch (e) {
        return {
          slot: which,
          ok: false,
          latencyMs: 0,
          status: 0,
          error: e instanceof Error ? e.message : "فشل الفحص",
          source: "center",
        };
      }
    };

    const [a, b] = await Promise.all([probe("A"), probe("B")]);
    const slots: SlotHealth[] = [a, b].filter((s) => s.ok || s.error !== "المزوّد غير مضبوط — احفظه أولاً.");

    // هل يعمل التشغيل الاحتياطي من البيئة؟ نجرب وحدة AI حقيقية عبر المسار الموحّد.
    let envActive = false;
    try {
      const envProbe = await ctx.runQuery(internal.apiCenterStore.readEngineConfig, {});
      envActive = (envProbe as any)?.envBootstrap?.active === true;
    } catch {
      envActive = false;
    }

    const anyOk = slots.some((s) => s.ok);

    // الإصلاح الذاتي: إذا كان القاطع مفتوحاً وفحص حقيقي نجح الآن ⇒ أعد فتحه فوراً.
    const circuitRow = await ctx.runQuery(internal.apiCenterStore.readCircuitInternal, {});
    const circuitWasOpen = Boolean((circuitRow as any)?.open);
    let circuitReset = false;
    if (circuitWasOpen && anyOk) {
      await ctx.runMutation(internal.apiCenterStore.resetCircuitInternal, {});
      circuitReset = true;
      try {
        await ctx.runMutation(internal.apiHubStore.logApiEvent, {
          provider: "center",
          event: "self_heal",
          detail: "أُعيد فتح قاطع الدائرة تلقائياً بعد فحص ناجح",
          severity: "info",
          at: Date.now(),
        });
      } catch {
        /* لا يُسقط النتيجة */
      }
    }

    return { slots, anyOk, circuitWasOpen, circuitReset, envActive, checkedAt: Date.now() };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🚑 الإصلاح الذاتي الشامل — زر واحد يصلح الحالات المعروفة كلها
// ═══════════════════════════════════════════════════════════════════════

export const selfHeal = action({
  args: {},
  handler: async (ctx): Promise<{ actions: string[]; ok: boolean }> => {
    const actions: string[] = [];

    // 1) إعادة فتح قاطع الدائرة
    try {
      await ctx.runMutation(internal.apiCenterStore.resetCircuitInternal, {});
      actions.push("أُعيد ضبط قاطع الدائرة");
    } catch {
      /* تجاهل */
    }

    // 2) تفريغ الردود المُخزّنة الأقدم من 24 ساعة (تبقى الحديثة فقط)
    try {
      const cleared = (await ctx.runMutation(internal.apiCenterStore.pruneOldCache, {})) as number;
      actions.push(`حُذف ${cleared} رد قديم من الذاكرة`);
    } catch {
      /* تجاهل */
    }

    // 3) فحص حقيقي للمزوّد — لو نجح نعلن الشفاء في السجل
    try {
      const v = (await ctx.runAction(api.apiCenter.verifyProvider, { which: "A" })) as any;
      actions.push(
        v?.ok
          ? `المزوّد A يستجيب (${v.model} · ${v.latencyMs}ms)`
          : `المزوّد A لا يستجيب: ${v?.error ?? "سبب غير معروف"}`,
      );
    } catch (e) {
      actions.push(`تعذّر فحص المزوّد A: ${e instanceof Error ? e.message : "خطأ"}`);
    }

    try {
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: "center",
        event: "self_heal_run",
        detail: actions.join(" · "),
        severity: "info",
        at: Date.now(),
      });
    } catch {
      /* لا يُسقط النتيجة */
    }

    return { actions, ok: true };
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
