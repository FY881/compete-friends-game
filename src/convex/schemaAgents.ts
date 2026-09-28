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
    axes: v.optional(
      v.object({
        aggression: v.number(), // 0-1: الميول القتالية
        curiosity: v.number(), // التعلّم والاستكشاف
        commerce: v.number(), // التبادل والمتجر
        loyalty: v.number(), // الانتماء والوفاء
        sociability: v.number(), // المجالس والتحديات
        caution: v.number(), // الحذر والقانون
      }),
    ),
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

  // شجرة سلالات الأحرار — من أنجب من، جيلاً بعد جيل
  agentLineage: defineTable({
    childName: v.string(),
    parentName: v.string(),
    generation: v.number(),
    post: v.string(),
    createdAt: v.number(),
  })
    .index("by_child", ["childName"])
    .index("by_parent", ["parentName"])
    .index("by_created", ["createdAt"]),

  // 🔮 التنبؤ والتحقق — أعلى درجات فهم العقل الحقيقي:
  //    الوكيل لا يكتفي بالوصف، بل يتوقّع أين سيكون العقل بعد ساعات، ثم
  //    تُقارن نبوءته بما فعله العقل فعلاً: إصابة أم خطأ. الدقة تتراكم
  //    على الوكيل نفسه، فتصير معرفة مقيسة لا انطباعاً.
  agentPredictions: defineTable({
    agentId: v.optional(v.id("freeAgents")),
    agentName: v.string(),
    post: v.string(), // الركن الذي أطلق منه النبوءة
    subjectName: v.string(), // العقل المتنبَّأ به
    predictedSystem: v.string(), // النظام الذي توقّع أن يقصده
    predictedLabel: v.string(), // اسمه بالعربية للواجهة
    basis: v.string(), // لماذا توقّع ذلك (شفافية كاملة)
    horizonMs: v.number(), // أفق النبوءة بالمللي ثانية
    status: v.string(), // open | hit | miss
    actualSystem: v.optional(v.string()), // ما حدث فعلاً في النافذة
    createdAt: v.number(),
    windowEndsAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status", "windowEndsAt"])
    .index("by_subject", ["subjectName"])
    .index("by_created", ["createdAt"]),
};
