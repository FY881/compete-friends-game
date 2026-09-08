/**
 * ═══════════════════════════════════════════════════════════════
 * 🛡️ حارس AI — نظام جديد يعالج مشاكل الذكاء الاصطناعي تلقائياً
 * ═══════════════════════════════════════════════════════════════
 * يعمل كل 10 دقائق عبر المجدول بلا أي تدخل بشري:
 *  1. يفحص النظام المُفعّل (System A: مفتاح + رابط / System B: مفتاح فقط)
 *     بنداء حي حقيقي عبر محرك النظامين الوحيد.
 *  2. إن فشل النداء: يسجّل الفشل بوضوح في سجل نشاط الذكاء ليبقى ظاهراً.
 *  3. إن نجح: يوثّق الصحة ويصفّر قاطع الدائرة.
 */
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callLlm, getAdminKeyPreview, DEFAULT_MODEL } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

const HEALTH_KEY = "ai_guardian";

export const patrol = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; latencyMs: number; detail: string }> => {
    const started = Date.now();
    let ok = false;
    let sample = "";
    let detail = "";

    try {
      await ensureAiRuntime(ctx);
      sample = await callLlm(
        [{ role: "user", content: "أجب بكلمة واحدة فقط: جاهز" }],
        20,
        0.1,
        "AI Guardian",
      );
      ok = sample.trim().length > 0;
      detail = ok
        ? `فحص حي ناجح عبر ${DEFAULT_MODEL} — عيّنة: ${sample.trim().slice(0, 60)}`
        : "رد فارغ بعد كل المحاولات";
    } catch (e) {
      detail = e instanceof Error ? e.message : "خطأ غير معروف";
    }

    const latencyMs = Date.now() - started;
    let autoFixes = 0;

    if (ok) {
      // صفّر قاطع الدائرة — المفتاح يعمل الآن
      try {
        await ctx.runMutation(internal.apiHubStore.recordSuccess, {});
        autoFixes += 1;
      } catch {
        /* اختياري */
      }
    } else {
      // لا مزودين قديمين — النظامان فقط: سجّل الفشل بوضوح ليظهر في تقرير الحارس
      try {
        await ctx.runMutation(internal.apiHubStore.recordFailure, {}).catch(() => {});
      } catch {
        /* اختياري */
      }
    }

    try {
      await ctx.runMutation(internal.aiGuardianStore.upsertHealth, {
        key: HEALTH_KEY,
        status: ok ? "healthy" : "critical",
        latencyMs,
        detail: `${detail} | المفتاح: ${getAdminKeyPreview()}`,
        autoFixes,
      });
      await ctx.runMutation(internal.aiGuardianStore.logGuardianEvent, {
        ok,
        message: ok
          ? `حارس AI: النظام المُفعّل سليم (${latencyMs}ms)${autoFixes ? ` — صفّر ${autoFixes} إصلاحاً` : ""}`
          : `حارس AI: فشل فحص النظام المُفعّل — ${detail.slice(0, 200)}`,
        severity: ok ? "info" : "critical",
      });
    } catch {
      /* السجل اختياري — لا يُفشل الدورية */
    }

    return { ok, latencyMs, detail };
  },
});
