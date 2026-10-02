import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ جولة التوسيع 9 — «مجالس الأحرار»: الديمقراطية الصامتة
 *
 *   agentAssemblies — كل د Martinجلة: اقتراح مبني على بيانات حقيقية،
 *                     وكلاء أحرار يصوّتون بمقاعد حقيقية (وزن ملاحظاتهم)،
 *                     وقرار نهائي بالأغلبية يُسجَّل للتاريخ.
 *
 * تُدمَج في المخطط عبر `...assemblyTables` في schemaExtra.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const assemblyTables = {
  agentAssemblies: defineTable({
    topic: v.string(), // موضوع الجلسة
    proposal: v.string(), // الاقتراح المبني على بيانات حقيقية
    basis: v.string(), // مصدر الاقتراح (بيانات خام مختصرة)
    yes: v.number(), // أصوات المؤيدين (موزونة بالملاحظات)
    no: v.number(), // أصوات المعارضين
    abstain: v.number(),
    votersCount: v.number(),
    quorum: v.number(), // النصاب المطلوب (عدد الأصوات)
    reached: v.boolean(), // هل تحقق النصاب؟
    resolution: v.string(), // القرار النهائي بالعربية
    passed: v.optional(v.boolean()),
    seatName: v.string(), // المجلس (مجلس الأُفق / مجلس الصيانة / ...)
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_seat", ["seatName"]),
};
