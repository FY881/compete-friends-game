import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌌 جولة التوسيع 8 — «الأُفق»: استكشاف الأحرار لما وراء الأركان
 *
 *   agentFrontiers — كل مستكشف حرّ يختار مجالاً كاملاً من اللعبة
 *                    (الاقتصاد، المحتوى، الأسئلة، الأمان، النمو...)
 *                    ويُصدر حكماً مقيّساً عن حيويته من بيانات حقيقية.
 *   agentFrontierLinks — روابط الارتباط بين المجالات: متى يتحرك مجال
 *                        يتحرك آخر بعده (جاذبية بينية).
 *
 * تُدمَج في المخطط عبر `...frontierTables` في schemaExtra.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const frontierTables = {
  agentFrontiers: defineTable({
    domain: v.string(), // مجال الاستكشاف (اقتصاد/محتوى/أسئلة/أمان...)
    domainLabel: v.string(), // الاسم العربي
    scoutName: v.string(), // اسم المستكشف الحرّ
    verdict: v.string(), // حيوي | نشط | هادئ | خامل
    insight: v.string(), // الاستنتاج المكتوب بالعربية
    signals: v.number(), // عدد الأحداث الحقيقية المقيسة
    strength: v.number(), // 0-1 قوة الحكم
    engine: v.string(), // llm | local
    createdAt: v.number(),
  })
    .index("by_domain", ["domain"])
    .index("by_created", ["createdAt"]),

  agentFrontierLinks: defineTable({
    domainA: v.string(),
    domainB: v.string(),
    weight: v.number(), // 0-1 قوة الارتباط
    note: v.string(), // تفسير الارتباط بالعربية
    createdAt: v.number(),
  })
    .index("by_a", ["domainA"])
    .index("by_created", ["createdAt"]),
};
