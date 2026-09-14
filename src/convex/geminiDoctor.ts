import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🩺 AI DOCTOR — تشخيص الأخطاء الحقيقي بالذكاء الاصطناعي (Gemini)
 *
 * المفتاح: من تبويب المفاتيح → GEMINI_API_KEY (مجاني: 1500 طلب/يوم)
 *
 * كيف يعمل فعلياً:
 *  - يقرأ الأخطاء غير المشخّصة من جدول errorLogs (فئة errorHunter)
 *  - يرسل الرسالة + المكدس + آخر أفعال اللاعب إلى Gemini
 *  - يحفظ التشخيص العربي (سبب جذري + حل + خطورة + قابلية إصلاح تلقائي)
 *    على سجل الخطأ نفسه → يظهر في لوحة صياد الأخطاء للمالك
 *  - تقرير صحة يومي تنفيذي + اختبار صحة المفتاح
 * ═══════════════════════════════════════════════════════════════════════
 */

const MODEL = "gemini-2.0-flash";

function buildDiagnosisPrompt(message: string, stack?: string, playerAction?: string, category?: string): string {
  return `أنت طبيب أخطاء خبير في تطبيق لعبة كويز عربية (React + Convex). حلّل هذا الخطأ وأجب بالعربية فقط، بهذا التنسيق الدقيق:

السبب الجذري: <شرح من سطر إلى سطرين لماذا حدث الخطأ>
الحل: <الإصلاح المقترح بوضوح>
قابلية الإصلاح التلقائي: <نعم أو لا> — <سطر واحد يشرح لماذا>
الخطورة: <منخفضة أو متوسطة أو حرجة>

خطأ (فئة: ${category ?? "غير معروفة"}): ${message}

${stack ? `المكدس (مختصر):\n${stack.slice(0, 1200)}` : "لا يوجد مكدس"}

${playerAction ? `آخر أفعال اللاعب قبل الخطأ: ${playerAction.slice(0, 400)}` : ""}`;
}

/** يشغّل Gemini ويُعيد النص الخام أو null عند الفشل/غياب المفتاح */
async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

// ═══════════════ استعلامات داخلكل جدول errorLogs مباشرة ═══════════════

/** آخر أخطاء غير مشخّصة (aiVerdict != analyzed) */
export const getUnanalyzedInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .order("desc")
      .take(args.limit * 3)
      .then((rows) => rows.filter((r) => r.aiVerdict !== "analyzed").slice(0, args.limit));
  },
});

/** أخطاء آخر 24 ساعة (للتقرير اليومي) */
export const getRecentInternal = internalQuery({
  args: { since: v.number(), limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", args.since))
      .order("desc")
      .take(args.limit);
    return rows;
  },
});

/** تحديث سجل الخطأ بالتشخيص */
export const applyDiagnosis = internalMutation({
  args: {
    id: v.id("errorLogs"),
    rootCause: v.string(),
    fix: v.string(),
    autoFixable: v.boolean(),
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.db.patch(args.id, {
      aiAnalysis: `السبب الجذري: ${args.rootCause}\nالحل: ${args.fix}\nالخطورة: ${args.severity}`,
      aiFixSuggestion: args.fix,
      aiCanAutoFix: args.autoFixable,
      aiVerdict: "analyzed",
      aiAnalyzedAt: Date.now(),
    });
  },
});

// ═══════════════ المحرك ═══════════════

/** الدورة: تشخيص حتى 5 أخطاء غير مشخّصة لكل استدعاء (cron كل 5 دقائق) */
export const diagnoseUnanalyzed = internalAction({
  handler: async (ctx): Promise<{ diagnosed: number } | { skipped: true; reason: string }> => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return { skipped: true, reason: "لا يوجد مفتاح GEMINI_API_KEY" };

    const unanalyzed = await ctx.runQuery(internal.geminiDoctor.getUnanalyzedInternal, { limit: 5 });
    if (unanalyzed.length === 0) return { diagnosed: 0 };

    let diagnosed = 0;
    for (const err of unanalyzed) {
      const raw = await callGemini(
        buildDiagnosisPrompt(err.message, err.stack, err.playerAction, err.category),
      );
      if (!raw) continue;

      const get = (label: string) => {
        const m = raw.match(new RegExp(`${label}:\\s*([^\\n]+)`));
        return m ? m[1].trim() : "";
      };
      const rootCause = get("السبب الجذري") || raw.slice(0, 200);
      const fix = get("الحل") || "راجع السجل يدوياً";
      const autoFixTxt = get("قابلية الإصلاح التلقائي");
      const autoFixable = autoFixTxt.startsWith("نعم");
      const sevTxt = get("الخطورة");
      const severity = sevTxt.includes("حرجة") ? "حرجة" : sevTxt.includes("متوسطة") ? "متوسطة" : "منخفضة";

      await ctx.runMutation(internal.geminiDoctor.applyDiagnosis, {
        id: err._id,
        rootCause,
        fix,
        autoFixable,
        severity,
      });
      diagnosed++;
    }
    return { diagnosed };
  },
});

/** تقرير الصحة اليومي — يقرأ أخطاء 24 ساعة ويكتب تقريراً تنفيذياً بالعربية */
export const dailyHealthReport = action({
  handler: async (ctx): Promise<string> => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return "⚠️ لا يوجد مفتاح GEMINI_API_KEY — أضِفه من تبويب المفاتيح باسم GEMINI_API_KEY.";

    const since = Date.now() - 24 * 60 * 60 * 1000;
    const errors = await ctx.runQuery(internal.geminiDoctor.getRecentInternal, { since, limit: 40 });
    if (errors.length === 0) {
      return "✅ تقرير 24 ساعة: صفر أخطاء مسجلة — المنظومة سليمة تماماً.";
    }

    const summary = errors
      .map(
        (e) =>
          `[${e.severity}] (${e.category}) ${e.message} — تكرار ${e.count}x — ${e.resolved ? "محلول" : "غير محلول"}`,
      )
      .join("\n")
      .slice(0, 3000);

    const report = await callGemini(
      `أنت طبيب صحة لعبة خبير. اكتب تقريراً تنفيذياً موجزاً بالعربية (5-8 أسطر) عن صحة لعبة كويز عربية خلال آخر 24 ساعة، بناءً على هذه الأخطاء الحقيقية. رتّب الأولويات، اذكر النمط المشترك إن وُجد، واختم بأهم إجراء واحد ينبغي فعله:\n\n${summary}`,
    );

    return (
      report ||
      "⚠️ تعذّر توليد التقرير الآن (قد يكون المفتاح غير صالح أو الحد اليومي مستهلك). حاول مجدداً."
    );
  },
});

/** اختبار سريع: هل المفتاح يعمل؟ */
export const testKey = action({
  handler: async (): Promise<{ ok: boolean; reply: string }> => {
    const reply = await callGemini("أجب بكلمة واحدة فقط: نعم");
    return reply
      ? { ok: true, reply }
      : { ok: false, reply: "فشل الاتصال — تحقق من صحة المفتاح أو الحد اليومي." };
  },
});
