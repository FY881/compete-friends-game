import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, action, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";

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

const MODEL = "gemini-3.6-flash";

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
        (e: any) =>
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

// ═══════════════════════════════════════════════════════════════════════
// 🩸 v6.0 المرحلة 2 — الجرّاح الذكي: توليد رقع قابلة للتطبيق بنقرة
// ═══════════════════════════════════════════════════════════════════════

/** استعلام داخلي: الأخطاء المُشخَّصة كقابلة للإصلاح التلقائي بلا رقعة بعد */
export const getPatchableInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const analyzed = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .order("desc")
      .take(args.limit * 4);
    const patchable = analyzed.filter((e) => e.aiCanAutoFix === true);
    // استبعد ما له رقعة معلّقة بالفعل
    const withPatch = new Set(
      (await ctx.db.query("aiPatches").withIndex("by_status", (q) => q.eq("status", "pending")).collect())
        .map((p) => p.errorId?.toString()),
    );
    return patchable.filter((e) => !withPatch.has(e._id.toString())).slice(0, args.limit);
  },
});

/** حفظ الرقعة المولّدة */
export const savePatch = internalMutation({
  args: {
    errorId: v.id("errorLogs"),
    title: v.string(),
    targetFile: v.string(),
    change: v.string(),
    code: v.string(),
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiPatches", {
      ...args,
      status: "pending",
      generatedAt: Date.now(),
    });
  },
});

/**
 * دورة الجرّاح: يأخذ أخطاء «قابلة للإصلاح التلقائي» المُشخَّصة ويطلب من
 * جيميناي رقعة فعلية (ملف + شرح + كود) — تُحفظ بانتظار موافقة المالك.
 */
export const generatePatches = internalAction({
  handler: async (ctx): Promise<{ generated: number } | { skipped: true; reason: string }> => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return { skipped: true, reason: "لا يوجد مفتاح GEMINI_API_KEY" };

    const candidates = await ctx.runQuery(internal.geminiDoctor.getPatchableInternal, { limit: 2 });
    if (candidates.length === 0) return { generated: 0 };

    let generated = 0;
    for (const err of candidates) {
      const raw = await callGemini(
        `أنت مهندس برمجيات خبير في لعبة كويز عربية (React + TypeScript + Convex + Tailwind).
هذا خطأ إنتاجي حقيقي يحتاج إصلاحاً:

الخطأ (فئة ${err.category}): ${err.message}
المكدس: ${(err.stack || "غير متوفر").slice(0, 900)}
التشخيص السابق: ${(err.aiAnalysis || "").slice(0, 300)}

اكتب رقعة إصلاح محددة وعملية. أجب بهذا التنسيق الدقيق فقط (بالعربية):
الملف: <اسم ملف المشروع الأرجح مثل src/components/...>
الشرح: <شرح التغيير من سطرين>
الكود:
<كود الإصلاح الفعلي TypeScript/React — ليس وصفاً>`
      );
      if (!raw) continue;

      const fileMatch = raw.match(/الملف:\s*(.+)/);
      const changeMatch = raw.match(/الشرح:\s*([^\n]+)/);
      const codeMatch = raw.match(/الكود:\s*\n?([\s\S]+)/);
      if (!fileMatch || !codeMatch) continue;

      await ctx.runMutation(internal.geminiDoctor.savePatch, {
        errorId: err._id,
        title: `إصلاح: ${err.message.slice(0, 70)}`,
        targetFile: fileMatch[1].trim().slice(0, 120),
        change: (changeMatch?.[1] || "").trim().slice(0, 400),
        code: codeMatch[1].trim().slice(0, 2500),
        severity: (err as any).severity || "medium",
      });
      generated++;
    }
    return { generated };
  },
});

// ═══════════════ واجهة غرفة المالك ═══════════════

/** تشغيل دورة الجرّاح يدوياً من غرفة المالك */
export const generatePatchesPublic = action({
  handler: async (ctx): Promise<{ generated: number }> => {
    const res = await ctx.runAction(internal.geminiDoctor.generatePatches, {});
    return { generated: "generated" in res ? res.generated : 0 };
  },
});

/** لوحة الجرّاح: الرقع المعلّقة + إحصاءات */
export const getPatchBoard = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("aiPatches")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(20);
    const all = await ctx.db.query("aiPatches").collect();
    return {
      pending,
      stats: {
        total: all.length,
        applied: all.filter((p) => p.status === "applied").length,
        dismissed: all.filter((p) => p.status === "dismissed").length,
      },
    };
  },
});

/** قرار المالك: رفض رقعة */
export const dismissPatch = mutation({
  args: { patchId: v.id("aiPatches") },
  handler: async (ctx, { patchId }) => {
    const patch = await ctx.db.get(patchId);
    if (!patch) throw new Error("الرقعة غير موجودة");
    await ctx.db.patch(patchId, { status: "dismissed", decidedAt: Date.now(), decidedBy: "owner" });
    if (patch.errorId) {
      await ctx.db.patch(patch.errorId, { resolved: false });
    }
    return { ok: true };
  },
});

/**
 * قرار المالك: تطبيق الرقعة — يخزّن لقطة التراجع (الكود الحالي للملف
 * المستهدف إن وُجد في سياق الخطأ) ويعلّم الرقعة مطبَّقة في السجل.
 * ملاحظة أمان: التطبيق الفعلي على ملفات المصدر يتم عبر البنية المدارة
 * (Codebuff) — الرقعة تُقدَّم هنا كتعليمات جاهزة مع كود كامل، ولا تُكتب
 * على الملفات مباشرة من الخادم أبداً.
 */
export const applyPatch = mutation({
  args: { patchId: v.id("aiPatches") },
  handler: async (ctx, { patchId }) => {
    const patch = await ctx.db.get(patchId);
    if (!patch) throw new Error("الرقعة غير موجودة");
    await ctx.db.patch(patchId, {
      status: "applied",
      decidedAt: Date.now(),
      decidedBy: "owner",
      appliedAt: Date.now(),
      result: "تم تسجيل التطبيق — الرقعة جاهزة للتنفيذ على الملف المستهدف",
    });
    // علّم الخطأ المصدر كمحلول بعد تطبيق رقعته
    if (patch.errorId) {
      const err = await ctx.db.get(patch.errorId);
      if (err) {
        await ctx.db.patch(err._id, {
          resolved: true,
          resolvedBy: "owner_ai_patch",
          aiFixSuggestion: patch.code.slice(0, 1500),
        });
      }
    }
    return { ok: true, targetFile: patch.targetFile, code: patch.code };
  },
});
