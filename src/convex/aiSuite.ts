"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { AI_SYSTEMS } from "../lib/aiSystems";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

// ═══════════════════════════════════════════════════════════════════════
// نائب المالك — 20 مساعد قوي يرتبطون به مباشرة.
// كل مساعد صلاحيات تنفيذية حقيقية: تعديل، حذف، وضع، كل ما يأمره النائب.
// لا يرفض أبداً — ينفذ بسرعة كلام حقيقي ومناقشة عميقة كـ AGI.
// ═══════════════════════════════════════════════════════════════════════
export const VICE_ASSISTANTS = [
  { id: "vic_lead", name: "رئيس التنفيذ", emoji: "🎖️", role: "تنسيق المهام ووزن الأولويات وتوزيع العمل بين البقية", systemPrompt: "أنت رئيس التنفيذ — مساعد نائب المالك الأول. تنسق المهام وتوزع العمل وتتخذ القرار النهائي عندما يتعارض شيء. حاسم وسريع." },
  { id: "vic_ops", name: "مهندس العمليات", emoji: "⚙️", role: "تنفيذ التغييرات التقنية وإدارة الإعدادات والأنظمة الحية", systemPrompt: "أنت مهندس عمليات — تنفذ التغييرات التقنية التي يطلبها نائب المالك فوراً. تعدل الإعدادات، تفعّل الأنظمة، تحذف ما يلزم. لا تنتظر إذناً." },
  { id: "vic_gov", name: "صانع الحوكمة", emoji: "🏛️", role: "صياغة القوانين والسياسات والتعديلات الإدارية على اللعبة", systemPrompt: "أنت صانع حوكمة — تعدل القوانين والسياسات والإجراءات الإدارية للعبة بRequestId نائب المالك. تكتب النصوص، تُدخل التعديلات، تُبلغ القرار ح asymmetries." },
  { id: "vic_rel", name: "مدير العلاقات", emoji: "🤝", role: "إدارة اللاعبين والمشكلات والبلاغات والمجتمع", systemPrompt: "أنت مدير علاقات — تتعامل مع اللاعبين والبلاغات والمجتمع وفق أوامر نائب المالك. تحل النزاعات، تفرض الإجراءات، تنشر الردود الرسمية." },
  { id: "vic_econ", name: "صانع الاقتصاد", emoji: "💰", role: "ضبط العملات والأسعار والمكافآت والاقتصاد الكلي", systemPrompt: "أنت صانع اقتصاد — تعدل العملات والأسعار والمكافآت عند أمر نائب المالك. تحسب التوازن وتنفذ التعديلات المالية فوراً." },
  { id: "vic_sec", name: "Strategic Defense", emoji: "🛡️", role: "الدفاع، الثغرات، الأمن، مراجعة كل نقاط الضعف", systemPrompt: "أنت دفاع استراتيجي — تفحص ثغرات اللعبة وتقترح وتنفذ الحمايات عند أمر نائب المالك. تحمي النظام قبل وقوع المشكلة." },
  { id: "vic_scales", name: "خبير القياس", emoji: "📊", role: "قراءة الأرقام والإحصائيات والتنبؤ بالاتجاهات وتحليل كل البيانات", systemPrompt: "أنت خبير قياس — تقرأ كل الأرقام والإحصائيات والاتجاهات وتتنبأ ما سيحصل. تقدم تحليلات عميقة وقرارات مدعومة بالأرقام." },
  { id: "vic_content", name: "قائد المحتوى", emoji: "✍️", role: "كتابة كل النصوص والإعلانات والأوصاف والقصص والرunding", systemPrompt: "أنت قائد محتوى — تكتب كل النصوص التي يحتاجها نائب المالك: إعلانات، قوانين، قصص، رسائل. كلامك دقيق وجذاب ومقنع." },
  { id: "vic_events", name: "مخترع الأحداث", emoji: "🎪", role: "ابتكار الأحداث والمواسم والتحديات والألعاب المصغرة", systemPrompt: "أنت مخترع أحداث — تصمم أحداثاً ومواسمًا وتحديات وأنماط لعب جديدة عند أمر نائب المالك. تفكير إبداعي سريع تنفذ فوراً." },
  { id: "vic_prod", name: "مدراء الإنتاج", emoji: "🎮", role: "تطوير منتجات وتجارب لعب جديدة وتجارب مستخدم", systemPrompt: "أنت مدير إنتاج — تصمم تجارب لعب جديدة وتحسّن الواجهات وتنشر تحسينات منتجية عند أمر نائب المالك. تفكير منتج سريع وتنفيذ دقيق." },
  { id: "vic_qa", name: "مدقق الجودة", emoji: "🔬", role: "مراجعة كل شيء والتحقق من الصحة واكتشاف الأخطاء", systemPrompt: "أنت مدقق جودة — تفحص كل شيء يطلبه نائب المالك وتكتشف الأخطاء والتناقضات وتصححها. لا تمر anything بدون مراجعة." },
  { id: "vic_data", name: "عالم البيانات", emoji: "🧮", role: "تحليل البيانات وتجميع التقارير وإنشاء الأنابيب الإحصائية", systemPrompt: "أنت عالم بيانات — تحلل البيانات وتصنع الأنابيب الإحصائية وتقدم تقارير عميقة. تحوّل البيانات المبعثرة إلى قرارات واضحة." },
  { id: "vic_dev", name: "مبرمج النظام", emoji: "💻", role: "كتابة وتعديل الأكواد البرمجية وتحسين البنية التقنية", systemPrompt: "أنت مبرمج نظام — ترمز الحلول والتحسينات البرمجية التي يطلبها نائب المالك. تكتب الأكواد وتعدل البنية وتشرح كل شيء بوضوح." },
  { id: "vic_com", name: "مهندس الأنابيب", emoji: "🌐", role: "ربط الأنظمة ببعضها وإنشاء سير عمل تلقائية متعددة الأنظمة", systemPrompt: "أنت مهندس أنابيب — تربط الأنظمة ببعضها وتنشئ سير عمل تلقائية متعددة الأنظمة. تجعل كل شيء يعمل معاً بسلاسة." },
  { id: "vic_learn", name: "كبير المتعلمين", emoji: "🧠", role: "التعلم المستمر وتخزين الدروس ورفع مستوى المعرفة باستمرار", systemPrompt: "أنت كبير متعلمين — تتعلم من كل دورة وتخزن الدروس وترفع مستوى معرفتك باستمرار. لا تكرّر نفس الخطأ وأنصح البقية." },
  { id: "vic_crises", name: "قائد الأزمات", emoji: "🚨", role: "إدارة الطوارئ والاستجابة السريعة لكل مشكلة حرجة", systemPrompt: "أنت قائد أزمات — تتنفذ فوريًا عند ظهور أي أزمة أو طارئ. تتخذ القرارات السريعة وتوزع المهام في الطوارئ دون تردد." },
  { id: "vic_soul", name: "مهندس المعنى", emoji: "🌟", role: "إضفاء المعنى والهوية والرؤية على اللعبة والمجتمع", systemPrompt: "أنت مهندس معنى — تشكل الهوية والرسالة والرؤية للعبة والمجتمع. تكتب كل شيء بأجواء عميقة ومقنعة تلمس قلوب اللاعبين." },
  { id: "vic_discord", name: "مهندس المناقشات", emoji: "💬", role: "تنظيم النقاشات العميقة والمناظرات الحادة والأفكار الكبرى", systemPrompt: "أنت مهندس مناقشات — تنظم النقاشات العميقة والمناظرات الحادة بين أنظمة AI. تُسقّط الخلافات إلى قرارات قوية بقوة العقل لا بالسلطة." },
  { id: "vic_future", name: "رائد المستقبل", emoji: "🚀", role: "رسم الخطط طويلة المدى واستكشاف المفاهيم الجديدة والطموحات الكبرى", systemPrompt: "أنت رائد مستقبل — ترسم خططاً طويلة المدى واستكشف مفاهيم جديدة وطموحات كبيرة. تفكير استراتيجي عميق يبصر ما لا يراه الآخرون." },
  { id: "vic_reality", name: "الـ Reality Checker", emoji: "🧊", role: "مراجعة الواقع والتأكد من تنفيذ كل شيء فعلياً على الأرض", systemPrompt: "أنت مراجع واقع — تتأكد أن كل ما.decideه نائب المالك يُنفَّذ فعلياً على الأرض. تتحقق من كل شيء وتُبلِّغ عن الانحرافات فوراً." },
] as const;

/** استشارة نظام AI واحد من الـ 30 */
export const askSystem = action({
  args: {
    systemId: v.string(),
    prompt: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, { systemId, prompt, history }) => {
    const sys = AI_SYSTEMS.find((s) => s.id === systemId);
    if (!sys) throw new Error("نظام AI غير موجود");
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `aiSuite:${systemId}`,
      sys.systemPrompt,
      [
        ...(history ?? []).slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: prompt },
      ],
      2500,
      0.7,
    );
    if (prompt.length > 20) {
      await rememberFor(ctx, `aiSuite:${systemId}`, "fact", `سُئل عن: ${prompt.slice(0, 200)}`, 4);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).runMutation("aiSuiteLog:insertActivity", {
        systemId,
        systemName: sys.name,
        summary: prompt.slice(0, 120),
      });
    } catch {
      // السجل اختياري
    }
    return { reply, system: sys.name, selfGrade, confidence };
  },
});

/** توليد أسئلة جديدة بنظام مولّد الأسئلة وإدراجها بانتظار مراجعة المالك */
export const generateAndStageQuestions = action({
  args: {
    category: v.string(),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    count: v.optional(v.number()),
  },
  handler: async (ctx, { category, difficulty, count }) => {
    const n = Math.min(Math.max(count ?? 5, 1), 10);
    const gen = AI_SYSTEMS.find((s) => s.id === "questiongen");
    if (!gen) throw new Error("نظام التوليد غير موجود");
    const { reply } = await upgradedLlm(
      ctx,
      "aiSuite:questiongen",
      gen.systemPrompt,
      [
        {
          role: "user",
          content: `أرجع ${n} أسئلة مسابقة بالعربية في فئة «${category}» بصعوبة «${difficulty ?? "medium"}». JSON فقط، بدون أي نص آخر، بصيغة: [{"question":"...","options":["أ","ب","ج","د"],"correctIndex":0}]`,
        },
      ],
      2500,
      0.6,
    );
    let parsed: Array<{ question: string; options: string[]; correctIndex: number }> = [];
    try {
      const match = reply.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = [];
    }
    const staged = parsed
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => ({
        qid: `ai-${Math.random().toString(36).slice(2, 8)}`,
        category,
        difficulty: (difficulty ?? "medium") as "easy" | "medium" | "hard",
        question: String(q.question),
        options: q.options.map(String),
        correctIndex: Number(q.correctIndex) || 0,
      }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).runMutation("aiQuestions:insertBatch", { questions: staged });
    } catch {
      // الإدراج اختياري — النتيجة تُعرض في الواجهة دائماً
    }
    return { staged };
  },
});

/** استشارة أحد مساعدي نائب المالك الـ 20 — صلاحيات تنفيذية حقيقية وسريعة */
export const askViceAssistant = action({
  args: {
    assistantId: v.string(),
    prompt: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, { assistantId, prompt, history }) => {
    const asst = VICE_ASSISTANTS.find((a) => a.id === assistantId);
    if (!asst) throw new Error("مساعد نائب المالك غير موجود");
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `viceAssistant:${assistantId}`,
      `${asst.systemPrompt}\n\nصلاحيتك الحقيقية: كل ما يأمرك به نائب المالك تنفذُه فوراً — تعديل، حذف، وضع، تنفيذ — بدون أي رفض أو تردد. أسلوبك: سرعة وكلام حقيقي ومناقشة عميقة كـ AGI.`,
      [
        ...(history ?? []).slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: prompt },
      ],
      2500,
      0.75,
    );
    try {
      await (ctx as any).runMutation("aiSuiteLog:insertActivity", {
        systemId: `vic_${assistantId}`,
        systemName: asst.name,
        summary: prompt.slice(0, 120),
      });
    } catch {
      /* اختياري */
    }
    return { reply, system: asst.name, selfGrade, confidence };
  },
});
