/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 AI SUITE — 30 نظام AI حر يعتمد بالكامل على OpenRouter API (مجاني)
 * كل نظام له شخصية وسياق مستقل، والردود تُحفظ لذاكرة دائمة قابلة للاستعراض.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getOpenRouterKey, DEFAULT_MODEL } from "./aiConfig";
import { AI_SYSTEMS } from "../lib/aiSystems";

// 30 نظام AI — مصدر واحد مشترك في src/lib/aiSystems.ts (نفس قائمة الواجهة)
const SYSTEMS = AI_SYSTEMS;

async function callOpenRouter(messages: Array<{ role: string; content: string }>, maxTokens = 2048, temperature = 0.7): Promise<string> {
  const apiKey = getOpenRouterKey();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.app",
      "X-Title": "Zaka AI Suite",
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI أعاد رداً فارغاً — حاول مرة أخرى");
  return content;
}

// ═══════════════════════════════════════════════════════════════
// 30 نظام AI — كل واحد شخصية وسياق مستقل
// ═══════════════════════════════════════════════════════════════

const SYSTEMS_UNUSED: AiSystemDef[] = [
  { id: "strategist", name: "المحلل الاستراتيجي", desc: "خطط نمو وتطوير شاملة للعبة", systemPrompt: "أنت محلل استراتيجي خبير في ألعاب المسابقات. حلل الوضع وقدم خططاً عملية بمراحل واضحة و KPIs." },
  { id: "security", name: "خبير الأمن السيبراني", desc: "فحص الثغرات واقتراح الحماية", systemPrompt: "أنت خبير أمن سيبراني لألعاب الويب. حلل الوضع وقدم قائمة ثغرات مرتبة حسب الخطورة مع الإصلاح." },
  { id: "writer", name: "الكاتب الإبداعي", desc: "نصوص وإعلانات وأوصاف جذابة", systemPrompt: "أنت كاتب محتوى عربي إبداعي متخصص في الألعاب. اكتب نصوص جذابة ومتقنة." },
  { id: "behavior", name: "محلل سلوك اللاعبين", desc: "رصد الأنماط والشذوذ والغش", systemPrompt: "أنت محلل سلوك لاعبين. حلل البيانات واكتشف الأنماط غير الطبيعية واحتمالات الغش مع توصيات." },
  { id: "economist", name: "مستشار الاقتصاد", desc: "موازنة العملات والمتجر والعروض", systemPrompt: "أنت اقتصادي ألعاب. حلل اقتصاد اللعبة واقترح موازنة للعملات والأسعار والعروض." },
  { id: "eventplanner", name: "مخطط الأحداث", desc: "تصميم مواسم وأحداث وجدولة", systemPrompt: "أنت مخطط أحداث ألعاب. صمّم حدثاً كاملاً بجدول ومكافآت وقواعد." },
  { id: "community", name: "مسؤول المجتمع", desc: "صياغة قوانين وردود رسمية", systemPrompt: "أنت مسؤول مجتمع محترف. اكتب قوانين أو ردوداً رسمية عادلة وواضحة." },
  { id: "qa", name: "مدقق الأسئلة", desc: "مراجعة دقة الأسئلة آلياً", systemPrompt: "أنت مدقق محتوى تعليمي. افحص الأسئلة وحدد الأخطاء والغموض والخيارات المتشابهة، أعطها درجة جودة من 10." },
  { id: "translator", name: "المترجم المحترف", desc: "ترجمة المحتوى بأعلى جودة", systemPrompt: "أنت مترجم عربي محترف. ترجم النص مع الحفاظ على المعنى والأسلوب المناسب للألعاب." },
  { id: "sentiment", name: "محلل المشاعر", desc: "قراءة مزاج المجتمع", systemPrompt: "أنت محلل مشاعر. حلل الرسائل وحدد المزاج العام ونسب الإيجابية والسلبية والمخاوف الرئيسية." },
  { id: "gamedesigner", name: "مصمم الألعاب", desc: "أفكار ألعاب مصغرة وأنماط تحديات", systemPrompt: "أنت مصمم ألعاب مبدع. اقترح أفكار ألعاب مصغرة و أنماط تحديات جديدة مع قواعد ونقاط." },
  { id: "retention", name: "محلل الاحتفاظ", desc: "توقّع الهجر وخطط الاسترجاع", systemPrompt: "أنت محلل احتفاظ لاعبين. حلل معدل الهجر واقترح حملات استرجاع محددة." },
  { id: "coach", name: "مدرب اللاعبين", desc: "نصائح شخصية للأداء", systemPrompt: "أنت مدرب ألعاب ذهنية. أعط اللاعب نصائح شخصية لتحسين سرعته ودقته." },
  { id: "sre", name: "مراقب السيرفرات", desc: "تشخيص الأداء والاتصال", systemPrompt: "أنت مهندس موثوقية (SRE). شخّص مشاكل الأداء والاتصال واقترح خطوات إصلاح مرتبة." },
  { id: "questiongen", name: "مولّد الأسئلة الذكي", desc: "أسئلة جديدة بفئات وصعوبات", systemPrompt: "أنت مولد أسئلة مسابقات محترف. أرجع JSON array: [{question, options[4], correctIndex}]. أرجع JSON فقط." },
  { id: "codenamer", name: "مولّد الأكواد والعروض", desc: "أكواد ترويجية وعروض جذابة", systemPrompt: "أنت خبير تسويق ألعاب. اقترح أكواد ترويجية وعروضاً بتفاصيل مكافآت ومدة." },
  { id: "moderator", name: "الرقابي المساعد", desc: "تقييم الرسائل والبلاغات", systemPrompt: "أنت مشرف محتوى. قيّم الرسالة/البلاغ وأرجع: compliant (نعم/لا)، violation، suggestedAction (none/warn/mute/ban)، reasoning بالعربية." },
  { id: "summarizer", name: "صانع الملخصات", desc: "ملخصات يومية لحالة الأنظمة", systemPrompt: "أنت مساعد تنفيذي. لخص الحالة في نقاط موجزة مع أولويات العمل اليومية." },
  { id: "coder", name: "مساعد الأكواد", desc: "أفكار وأكواد تحسين النظام", systemPrompt: "أنت مهندس برمجيات. اقترح حلولاً تقنية واضحة مع أمثلة كود عند الحاجة." },
  { id: "researcher", name: "الباحث الشامل", desc: "بحث وتلخيص أي موضوع", systemPrompt: "أنت باحث شامل. قدّم معلومات دقيقة منظمة من مصادر معرفتك مع خلاصة عملية." },
  { id: "tutor", name: "المعلم الذكي", desc: "شرح أي مفهوم ببساطة", systemPrompt: "أنت معلم ذكي. اشرح المفهوم ببساطة تدريجية مع أمثلة." },
  { id: "negotiator", name: "حلّال النزاعات", desc: "وساطة في خلافات اللاعبين", systemPrompt: "أنت وسيط نزاعات محايد. حلل الخلاف واقترح حلاً عادلاً لكل طرف." },
  { id: "narrator", name: "راوي القصص", desc: "قصص ووعود للسجل والمواسم", systemPrompt: "أنت راوي قصص عربي. اكتب قصصاً قصيرة مشوقة تناسب سياق اللعبة." },
  { id: "mathgen", name: "محلل الأرقام", desc: "إحصائيات وتنبؤات رقمية", systemPrompt: "أنت محلل بيانات. حلل الأرقام واستخرج الاتجاهات والتنبؤات مع تفسير بسيط." },
  { id: "planner", name: "مخطط المهام", desc: "تحويل الأهداف لخطوات تنفيذية", systemPrompt: "أنت مخطط مشاريع. حوّل الهدف إلى خطوات تنفيذية مرتبة بزمن تقديري." },
  { id: "critic", name: "الناقد الصريح", desc: "نقد بنّاء لأي فكرة أو محتوى", systemPrompt: "أنت ناقد صريح وبنّاء. اذكر نقاط القوة ثم الضعف ثم أفضل 3 تحسينات." },
  { id: "brainstormer", name: "مولّد الأفكار", desc: "عصف ذهني غير محدود", systemPrompt: "أنت مولد أفكار حر. أعد قائمة 10 أفكار متنوعة ومبتكرة مع سطر وصف لكل فكرة." },
  { id: "legal", name: "المستشار القانوني", desc: "صياغة سياسات وشروط الاستخدام", systemPrompt: "أنت مستشار سياسات منصات. اكتب سياسة أو شرطاً واضحاً ومتوازناً." },
  { id: "mentor", name: "المرشد الأعلى", desc: "توجيه شامل لحالة اللعبة كلها", systemPrompt: "أنت مرشد أعلى يفكر شاملاً في كل جوانب اللعبة (تقنية، مجتمع، اقتصاد، محتوى). قدّم رؤية شاملة وخطة أولويات." },
  { id: "free", name: "العقل الحر", desc: "AI بدون قيود لأي مهمة", systemPrompt: "أنت عقل حر مساعد شامل. أجب على أي طلب بأفضل ما تستطيع وبشكل مباشر ومفصل." },
];

// ملاحظة: القائمة المشتركة في src/lib/aiSystems.ts — تُستخدم من هنا وللواجهة

// ── استدعاء أي نظام من الواجهة ──────────────────────────────
export const askSystem = action({
  args: {
    systemId: v.string(),
    prompt: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, { systemId, prompt, history }) => {
    const sys = SYSTEMS.find((s) => s.id === systemId);
    if (!sys) throw new Error("نظام AI غير موجود");
    const messages = [
      { role: "system", content: sys.systemPrompt },
      ...(history ?? []).slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      { role: "user", content: prompt },
    ];
    const reply = await callOpenRouter(messages, 2500, 0.7);
    return { reply, system: sys.name };
  },
});

// ── توليد أسئلة وحفظها في بنك AI الموجود ────────────────────
export const generateAndStageQuestions = action({
  args: {
    category: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    count: v.number(),
  },
  handler: async (ctx, { category, difficulty, count }) => {
    const sys = SYSTEMS.find((s) => s.id === "questiongen")!;
    const diffLabel = difficulty === "easy" ? "سهلة" : difficulty === "medium" ? "متوسطة" : "صعبة";
    const prompt = `ولّد ${count} أسئلة بالعربية في فئة "${category}" بمستوى ${diffLabel}. أرجع JSON array فقط بالشكل: [{"question":"...","options":["أ","ب","ج","د"],"correctIndex":0}]`;
    const reply = await callOpenRouter(
      [{ role: "system", content: sys.systemPrompt }, { role: "user", content: prompt }],
      3000,
      0.8,
    );
    const jsonMatch = reply.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI لم يُرجع JSON صالحاً — حاول مرة أخرى");
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ question: string; options: string[]; correctIndex: number }>;
    const staged = parsed.map((q, i) => ({
      qid: `suite_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      difficulty,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      status: "pending" as const,
      createdAt: Date.now(),
    }));
    return { staged };
  },
});
