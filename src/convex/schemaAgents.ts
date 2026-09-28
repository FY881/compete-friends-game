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

  // ⚙️ محرّكات العقل — نماذج سلوكية تُستخرج من تسلسل الأفعال الحقيقي:
  //    «بعد كل مرة في X يقصد Y في N من M مرة خلال ست ساعات». لا تخمين ولا
  //    استبيان: انتقالات مقيسة من ناقل القرارات، تصير أساساً لنبوءات أدقّ.
  mindTriggers: defineTable({
    subjectName: v.string(), // العقل صاحب المحرّك
    fromSystem: v.string(), // النظام الذي يبدأ منه
    fromLabel: v.string(),
    toSystem: v.string(), // النظام الذي يقصده بعده عادةً
    toLabel: v.string(),
    hits: v.number(), // كم مرة وقع الانتقال فعلاً
    total: v.number(), // إجمالي الانتقالات من نفس المبدأ
    confidence: v.number(), // hits ÷ total
    avgLagMs: v.number(), // متوسط الزمن بين الفعلين
    prevConfidence: v.optional(v.number()), // قيمتها قبل آخر مراجعة
    revisions: v.optional(v.number()), // كم مرة راجع الوكلاء تقديرهم
    trend: v.optional(v.string()), // rising | falling | steady
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_subject", ["subjectName"])
    .index("by_confidence", ["confidence"])
    .index("by_pair", ["subjectName", "fromSystem", "toSystem"]),

  // 🧭 خريطة جاذبية الأنظمة — أي منطقة في اللعبة تجذب العقول إليها،
  //    مقيسة من مسارات اللاعبين الحقيقية لا من رأي أحد.
  mindFlow: defineTable({
    fromSystem: v.string(),
    fromLabel: v.string(),
    toSystem: v.string(),
    toLabel: v.string(),
    moves: v.number(), // كم انتقالاً وقع على هذا الطريق
    minds: v.number(), // كم عقلًا سلكه
    weight: v.number(), // نسبة هذا الطريق من كل خروج من fromSystem
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_pair", ["fromSystem", "toSystem"])
    .index("by_weight", ["weight"])
    .index("by_created", ["createdAt"]),
};
