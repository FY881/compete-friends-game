import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🕊️ جداول الأداة 30 — الفهم الحقيقي لعقول اللعبة
 *
 *   agentIntel    — بصمة عقل يستخلصها وكيل حرّ واحد عن لاعب حقيقي من
 *                   ناقل القرارات (aiDecisionLog). لا تدخل من المالك.
 *   agentBonds    — علاقات تنشأ تلقائياً بين الوكلاء: وفاق إن اتفقوا
 *                   على فهم عقل، ونزاع إن اختلفوا عليه.
 *   agentDossiers — الفهم المشترك: ملف مُجمَّع لكل عقل من كل الوكلاء
 *                   يتحدّث وحده كل نبضة عبر الزمن.
 *
 * تُدمَج في مخطط اللعبة عبر `...agentMindTables` في schemaExtra.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const agentMindTables = {
  agentIntel: defineTable({
    agentId: v.optional(v.id("freeAgents")),
    agentName: v.string(),
    post: v.string(), // الركن الذي رصد منه
    subjectName: v.string(), // العقل الذي فُهم
    kind: v.string(), // pattern | fingerprint | warning | contact
    trait: v.string(), // البصمة المستخلصة (وسم قصير)
    insight: v.string(), // الاستنتاج المكتوب
    strength: v.number(), // 0-1 قوة الاستنتاج
    engine: v.string(), // llm | local
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_subject", ["subjectName"])
    .index("by_created", ["createdAt"]),

  agentBonds: defineTable({
    aName: v.string(),
    bName: v.string(),
    kind: v.string(), // alliance | rivalry | exchange
    note: v.string(),
    strength: v.number(), // 0-1
    createdAt: v.number(),
  })
    .index("by_a", ["aName"])
    .index("by_created", ["createdAt"]),

  agentDossiers: defineTable({
    subjectName: v.string(),
    traits: v.array(v.string()), // البصمات المتفق عليها
    verdict: v.string(), // خلاصة الفهم
    confidence: v.number(), // 0-1
    contributors: v.number(), // كم وكيلًا شارك في الفهم
    notesCount: v.number(), // كم بصمة تراكمت
    engine: v.string(),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_subject", ["subjectName"])
    .index("by_confidence", ["confidence"]),
};
