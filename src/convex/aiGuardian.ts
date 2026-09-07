/**
 * ═══════════════════════════════════════════════════════════════
 * 🛡️ حارس AI — نظام جديد يعالج مشاكل الذكاء الاصطناعي تلقائياً
 * ═══════════════════════════════════════════════════════════════
 * يعمل كل 10 دقائق عبر المجدول بلا أي تدخل بشري:
 *  1. يفحص المفتاح الرسمي (OpenRouter) بنداء حي حقيقي.
 *  2. إن فشل النداء: يعيد التفعيل — يعيد تفعيل المزودين الفاشلين
 *     بعد مهلة التهدئة، ويسجل الحالة في سجل نشاط الذكاء.
 *  3. إن نجح: يوثّق الصحة ويصفّر قاطع الدائرة.
 */
"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { callLlm, getAdminKeyPreview, DEFAULT_MODEL } from "./aiConfig";

const HEALTH_KEY = "ai_guardian";

export const patrol = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; latencyMs: number; detail: string }> => {
    const started = Date.now();
    let ok = false;
    let sample = "";
    let detail = "";

    try {
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
      // إصلاح ذاتي: أعد تفعيل المزودين الفاشلين بعد مهلة التهدئة
      try {
        const res = (await ctx.runAction(api.apiHubPro.autoHealProviders, {})) as {
          healed: number;
        };
        autoFixes += res.healed ?? 0;
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
          ? `حارس AI: المفتاح الرسمي سليم (${latencyMs}ms)${autoFixes ? ` — صفّر ${autoFixes} إصلاحاً` : ""}`
          : `حارس AI: فشل فحص المفتاح الرسمي — ${detail.slice(0, 200)}`,
        severity: ok ? "info" : "critical",
      });
    } catch {
      /* السجل اختياري — لا يُفشل الدورية */
    }

    return { ok, latencyMs, detail };
  },
});
