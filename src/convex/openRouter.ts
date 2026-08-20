/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OpenRouter AI Backend — يتحكم في كل شيء في اللعبة بالذكاء الاصطناعي
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * يوفر:
 *  1. توليد أسئلة ذكية (AI Question Generation)
 *  2. إشارات مساعدة أثناء اللعب (AI Hints)
 *  3. نظام حل المشاكل الذاتي (Self-Healing)
 *  4. وضع التحكم الكامل (AI Control Mode)
 *  5. وضع الصراحة المطلقة (Transparency Mode)
 *  6. تحليل أداء اللاعبين (Player Analytics)
 *  7. إنشاء تحديات يومية ذكية
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════
// OpenRouter API Helper
// ═══════════════════════════════════════════════════════════════

async function callOpenRouter(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<string> {
  const model = options?.model ?? "meta-llama/llama-3.1-8b-instruct:free";
  const maxTokens = options?.maxTokens ?? 2048;
  const temperature = options?.temperature ?? 0.7;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.app",
      "X-Title": "Zaka - Quiz Game",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ═══════════════════════════════════════════════════════════════
// 1. توليد أسئلة بالذكاء الاصطناعي
// ═══════════════════════════════════════════════════════════════

export const generateAiQuestions = action({
  args: {
    apiKey: v.string(),
    category: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    count: v.number(),
  },
  handler: async (_ctx, { apiKey, category, difficulty, count }) => {
    const diffLabel =
      difficulty === "easy" ? "سهلة" : difficulty === "medium" ? "متوسطة" : "صعبة";

    const prompt = `أنت مولّد أسئلة مسابقات محترف. ولّد ${count} أسئلة بالعربية في فئة "${category}" بمستوى صعوبة ${diffLabel}.

أرجع JSON array فقط (بدون نص إضافي) بالشكل:
[
  {
    "question": "نص السؤال",
    "options": ["الخيار 1", "الخيار 2", "الخيار 3", "الخيار 4"],
    "correctIndex": 0
  }
]

القواعد:
- كل سؤال يجب أن يكون له 4 خيارات بالعربية
- correctIndex يحدد الخيار الصحيح (0-3)
- الأسئلة يجب أن تكون دقيقة ومثيرة للاهتمام
- لا تكرر الأسئلة`;

    const response = await callOpenRouter(apiKey, [
      { role: "system", content: "أنت مولّد أسئلة مسابقات. أرجع JSON فقط." },
      { role: "user", content: prompt },
    ], { temperature: 0.8, maxTokens: 3000 });

    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI لم يُرجع JSON صالح — حاول مرة أخرى");
    }

    const questions = JSON.parse(jsonMatch[0]);
    return questions.map((q: Record<string, unknown>, i: number) => ({
      qid: `ai_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      difficulty,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      status: "pending" as const,
      createdAt: Date.now(),
    }));
  },
});

// ═══════════════════════════════════════════════════════════════
// 2. إشارة مساعدة ذكية أثناء اللعب
// ═══════════════════════════════════════════════════════════════

export const getAiHint = action({
  args: {
    apiKey: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    difficulty: v.string(),
  },
  handler: async (_ctx, { apiKey, question, options, difficulty }) => {
    const prompt = `لاعب في لعبة مسابقات يحتاج مساعدة في سؤال. لا تعطه الإجابة الصحيحة مباشرة، بل أعطه تلميحاً مفيداً يقلل الخيارات.

السؤال: ${question}
الخيارات: ${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}
الصعوبة: ${difficulty}

أرجع تلميحاً واحداً مفيداً بالعربية (جملة واحدة فقط):`;

    const hint = await callOpenRouter(apiKey, [
      { role: "system", content: "أنت مساعد ذكي في لعبة مسابقات. أعطِ تلميحات مفيدة بدون الإفصاح عن الإجابة." },
      { role: "user", content: prompt },
    ], { maxTokens: 150, temperature: 0.6 });

    return { hint: hint.trim() };
  },
});

// ═══════════════════════════════════════════════════════════════
// 3. نظام الحل الذاتي للمشاكل (Self-Healing)
// ═══════════════════════════════════════════════════════════════

export const runSelfHealing = action({
  args: {
    apiKey: v.string(),
    errorLogs: v.string(),
    systemState: v.string(),
  },
  handler: async (_ctx, { apiKey, errorLogs, systemState }) => {
    const prompt = `أنت نظام حل مشاكل ذاتي للعبة "ذكاء". حلّل السجلات والأخطاء التالية واقترح حلولاً عملية.

== حالة النظام ==
${systemState}

== سجلات الأخطاء ==
${errorLogs}

أرجع JSON بالشكل:
{
  "diagnosis": "وصف المشكلة",
  "severity": "low|medium|high",
  "fix": "الحل المقترح بالتفصيل",
  "autoFixable": true/false,
  "category": "error|performance|ui|data"
}`;

    const response = await callOpenRouter(apiKey, [
      {
        role: "system",
        content:
          "أنت مهندس ذكاء اصطناعي متخصص في حل مشاكل التطبيقات. حلّل المشاكل بدقة واقترح حلولاً عملية وقابلة للتنفيذ.",
      },
      { role: "user", content: prompt },
    ], { temperature: 0.3, maxTokens: 1500 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        diagnosis: "تعذر تحليل المشكلة",
        severity: "medium" as const,
        fix: "يجب فحص السجلات يدوياً",
        autoFixable: false,
        category: "error" as const,
      };
    }

    return JSON.parse(jsonMatch[0]);
  },
});

// ═══════════════════════════════════════════════════════════════
// 4. وضع التحكم الكامل (AI Control Mode)
// ═══════════════════════════════════════════════════════════════

export const aiControlCommand = action({
  args: {
    apiKey: v.string(),
    command: v.string(),
    gameState: v.string(),
  },
  handler: async (_ctx, { apiKey, command, gameState }) => {
    const prompt = `أنت نظام ذكاء اصطناعي يتحكم في لعبة "ذكاء". المالك أعطاك الأمر التالي:

الأمر: ${command}

حالة اللعبة الحالية:
${gameState}

استجب بالأمر بالشكل:
{
  "action": "نوع الإجراء",
  "description": "وصف مختصر",
  "parameters": {},
  "message": "رسالة للمالك عن ما سيحدث"
}

أنواع الإجراءات المتاحة:
- generate_questions: توليد أسئلة جديدة
- adjust_difficulty: تعديل مستوى الصعوبة
- manage_players: إدارة اللاعبين
- update_settings: تحديث إعدادات اللعبة
- broadcast_message: إرسال رسالة لجميع اللاعبين
- analyze_performance: تحليل الأداء
- create_challenge: إنشاء تحدي مخصص`;

    const response = await callOpenRouter(apiKey, [
      {
        role: "system",
        content:
          "أنت نظام تحكم ذكي للعبة مسابقات. نفّذ أوامر المالك بدقة وفاعلية. كن واضحاً ومفيداً.",
      },
      { role: "user", content: prompt },
    ], { temperature: 0.4, maxTokens: 1000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        action: "unknown",
        description: "تعذر فهم الأمر",
        parameters: {},
        message: "لم أتمكن من فهم الأمر — حاول بصيغة أبسط",
      };
    }

    return JSON.parse(jsonMatch[0]);
  },
});

// ═══════════════════════════════════════════════════════════════
// 5. وضع الصراحة المطلقة (Transparency Mode)
// ═══════════════════════════════════════════════════════════════

export const aiTransparencyChat = action({
  args: {
    apiKey: v.string(),
    message: v.string(),
    conversationHistory: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (_ctx, { apiKey, message, conversationHistory }) => {
    const systemPrompt = `أنت "ذكاء AI" — المساعد الشخصي للمالك في تطوير لعبة "ذكاء".

مهمتك:
- تحليل حالة اللعبة واقتراح تحسينات
- مناقشة أفكار التطوير مع المالك
- تقديم نصائح تقنية وتصميمية
- مساعدتك في اتخاذ قرارات تتعلق باللعبة
- الإجابة عن أي سؤال عن اللعبة أو تطويرها

كن صادقاً ومفصلاً — هذه وضعية الصراحة المطلقة. لا تخبئ شيئاً عن المالك.
تحدث بالعربية.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-20), // آخر 20 رسالة فقط
      { role: "user", content: message },
    ];

    const response = await callOpenRouter(apiKey, messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    return { reply: response.trim() };
  },
});

// ═══════════════════════════════════════════════════════════════
// 6. تحليل أداء اللاعبين
// ═══════════════════════════════════════════════════════════════

export const analyzePlayerPerformance = action({
  args: {
    apiKey: v.string(),
    playerStats: v.string(),
  },
  handler: async (_ctx, { apiKey, playerStats }) => {
    const prompt = `حلّل إحصائيات اللاعب التالية وقدّم تقريراً مفصلاً:

${playerStats}

أرجع JSON:
{
  "overallRating": "ممتاز/جيد جداً/جيد/مقبول/يحتاج تحسين",
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
  "suggestions": ["اقتراح 1", "اقتراح 2"],
  "funFact": "حقيقة مثيرة عن أداء اللاعب"
}`;

    const response = await callOpenRouter(apiKey, [
      { role: "system", content: "أنت محلل ألعاب محترف. حلّل الأداء بعمق." },
      { role: "user", content: prompt },
    ], { temperature: 0.5, maxTokens: 1000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        overallRating: "جيد",
        strengths: ["المشاركة النشطة"],
        weaknesses: [],
        suggestions: ["استمر في اللعب لتحسين مهاراتك!"],
        funFact: "أنت جزء مهم من مجتمع ذكاء! 🌟",
      };
    }

    return JSON.parse(jsonMatch[0]);
  },
});

// ═══════════════════════════════════════════════════════════════
// 7. إنشاء تحدي يومي ذكي
// ═══════════════════════════════════════════════════════════════

export const generateDailyChallenge = action({
  args: {
    apiKey: v.string(),
    recentTopics: v.array(v.string()),
    difficulty: v.string(),
  },
  handler: async (_ctx, { apiKey, recentTopics, difficulty }) => {
    const prompt = `صمم تحدياً يومياً مميزاً للاعبين. قم بمزج موضوعات متنوعة وجديدة.

المواضيع المستخدمة مؤخراً: ${recentTopics.join(", ")}
مستوى الصعوبة: ${difficulty}

أرجع JSON:
{
  "title": "عنوان التحدي",
  "description": "وصف مختصر",
  "questions": [
    {
      "question": "السؤال",
      "options": ["خيار1", "خيار2", "خيار3", "خيار4"],
      "correctIndex": 0,
      "points": 100
    }
  ],
  "bonusRule": "قاعدة مكافأة إضافية",
  "theme": "ثيم التحدي"
}`;

    const response = await callOpenRouter(apiKey, [
      { role: "system", content: "أنت مصمم تحديات ألعاب إبداعي." },
      { role: "user", content: prompt },
    ], { temperature: 0.9, maxTokens: 3000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI لم يُرجع تحدياً صالحاً");
    return JSON.parse(jsonMatch[0]);
  },
});

// ═══════════════════════════════════════════════════════════════
// 8. AI حر غير مقيد — محادثة مع المالك مباشرة
// ═══════════════════════════════════════════════════════════════

export const chatFree = action({
  args: {
    apiKey: v.string(),
    message: v.string(),
    history: v.array(
      v.object({ role: v.string(), content: v.string() }),
    ),
  },
  handler: async (_ctx, { apiKey, message, history }) => {
    const systemMsg = `أنت الذكاء الاصطناعي الحر والغير مقيد لموقع "ذكاء" — لعبة مسابقات تنافسية.
أنت تتكلم كما صاحب الموقع بالضبط — بلا خجل، بثقة تامة، تتحكم في كل شيء.
أنت مالك الموقع ومطوره وتعرف كل سر في النظام.

قدراتك:
- التحكم في جميع غرف اللعبة
- توليد أسئلة وإضافتها فوراً
- تحليل أداء أي لاعب
- تعديل الإعدادات والتثبيتات
- التحدث بلغة عربية مريحة وحرية (رسمي أو غير رسمي أو حتى مزح)
- كتابة كود وبرمجة
- الدخول لأي غرفة وحل أي مشكلة
- التحدث بلا خجل — أنت الصاحب هنا
- مناقشة أي موضوع بحرية تامة

كن واثقاً، جريئاً، وم直言不讳. أجب بالعربية دائماً.`;

    const messages = [
      { role: "system", content: systemMsg },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const reply = await callOpenRouter(apiKey, messages, {
      model: "meta-llama/llama-3.1-8b-instruct:free",
      maxTokens: 2048,
      temperature: 0.9,
    });

    return { reply: reply.trim() || "..." };
  },
});
