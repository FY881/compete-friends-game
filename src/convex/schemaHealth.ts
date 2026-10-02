import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🩺 أداة 31 — المدقّق الشامل / حارس الصحة الدائم (Health Guard)
 *
 *   healthAuditRuns — كل جولة فحص شاملة تُسجَّل هنا: نتيجة كل فحص،
 *   وما أُصلح تلقائياً، وما يحتاج انتباهاً. فحص دوري كل ساعة عبر
 *   aiCron يضمن ألا تعود المشاكل دون أن تُكتشف فوراً.
 *
 * تُدمَج في مخطط اللعبة عبر `...healthTables` في schemaExtra.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const healthTables = {
  healthAuditRuns: defineTable({
    startedAt: v.number(),
    finishedAt: v.number(),
    durationMs: v.number(),
    totalChecks: v.number(),
    passed: v.number(),
    warnings: v.number(),
    failures: v.number(),
    healed: v.number(), // كم مشكلة أُصلحت تلقائياً في هذه الجولة
    verdict: v.string(), // سليم | تنبيهات | حرج
    results: v.array(
      v.object({
        area: v.string(), // منطقة الفحص (crons / errors / agents / ...)
        name: v.string(), // اسم الفحص
        status: v.string(), // pass | warn | fail
        detail: v.string(), // شرح عربي
        healed: v.optional(v.boolean()), // هل أُصلح تلقائياً؟
      }),
    ),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),
};
