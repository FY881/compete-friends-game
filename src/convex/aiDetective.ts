import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { DIFFICULTY_LABELS } from "../lib/question-difficulty";
import { QUESTION_BANK } from "./questions";

/**
 * 🕵️ محقّق العقول (Minds Detective)
 *
 * المحقق الجنائي الرقمي للعبة — يفتح ملف تحقيق كامل للاعب المشتبه به:
 *  1) يجمع الأدلة الرقمية من قاعدة البيانات: زمن كل إجابة عبر تاريخ الجولات،
 *     الدقة حسب درجة الصعوبة، الانتظام الإحصائي، سجل الإشارات السابقة.
 *  2) يحسب مؤشرات جنائية محلية (بدون تكلفة): نسبة الإجابات الخاطفة،
 *     تطابق التوقيتات (بصمة البوت)، الدقة المستحيلة على الأسئلة الصعبة.
 *  3) يُحلل بالذكاء الاصطناعي: تقرير سردي كامل — هل هذا محتال أم لاعب
 *     موهوب أم خطأ في القياس؟ مع درجة ثقة وأدلة مفرَّغة وتوصيات.
 *  4) لا عقوبة آلية أبداً: الحكم يخرج توصية والقرار النهائي بيد المالك.
 */

// ── أنواع ────────────────────────────────────────────────────────────────

type AnswerShape = {
  questionId: string;
  selected: number;
  correct: boolean;
  points: number;
  elapsedMs: number;
} | null;

export type EvidenceReport = {
  gamesAnalyzed: number;
  totalAnswers: number;
  answeredCount: number;
  instantRate: number; // نسبة الإجابات الخاطفة (<1s) من المُجابة
  medianMs: number;
  fastestMs: number;
  timingClones: number; // أزواج توقيتات متطابقة تقريباً (بصمة بوت)
  accuracyByDifficulty: { difficulty: string; correct: number; total: number; rate: number }[];
  hardAccuracy: number; // دقة الصعب+شبه المستحيل
  perfectGames: number; // جولات بلا خطأ واحد
  suspiciousEvents: { kind: string; detail: string; at: number }[];
  priorStrikes: number;
  flags: string[]; // مؤشرات جنائية بالعربية
};

const INSTANT_MS = 1000; // أقل من ثانية = إجابة خاطفة مشبوهة
const CLONE_TOLERANCE_MS = 40; // تطابق توقيتين ضمن 40ms = بصمة آلية

/** خريطة البنك الثابت للصعوبات — تُبنى مرة لكل عملية. */
const QUESTION_MAP = new Map(QUESTION_BANK.map((q) => [q.id, q]));

// ── 1) جمع الأدلة الرقمية (internalQuery) ───────────────────────────────

export const collectEvidenceInternal = internalQuery({
  args: { suspectId: v.id("users") },
  handler: async (ctx, { suspectId }): Promise<EvidenceReport> => {
    const now = Date.now();

    // سجل الإشارات السابقة + العقوبات الحالية
    const events = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .take(200);
    const mine = events.filter((e) => e.userId === suspectId);
    const suspect = await ctx.db.get(suspectId);
    const priorStrikes = suspect?.cheatStrikes ?? 0;

    // آخر 25 جولة للاعب (تحليل معقول الحجم)
    const playerRows = await ctx.db
      .query("gamePlayers")
      .withIndex("by_user_game", (q) => q.eq("userId", suspectId))
      .collect();
    const recent = playerRows.sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 25);

    const timings: number[] = [];
    const byDiff = new Map<string, { correct: number; total: number }>();
    let answeredCount = 0;
    let instant = 0;
    let perfectGames = 0;
    let gamesAnalyzed = 0;

    for (const row of recent) {
      const answered = (row.answers ?? []).filter((a): a is NonNullable<AnswerShape> => a !== null);
      if (answered.length === 0) continue;
      gamesAnalyzed++;
      let allCorrect = true;

      for (const a of answered) {
        answeredCount++;
        timings.push(a.elapsedMs);
        if (a.elapsedMs < INSTANT_MS) instant++;
        if (!a.correct) allCorrect = false;

        const q = QUESTION_MAP.get(a.questionId);
        const diff = q ? q.difficulty : "medium";
        const bucket = byDiff.get(diff) ?? { correct: 0, total: 0 };
        bucket.total++;
        if (a.correct) bucket.correct++;
        byDiff.set(diff, bucket);
      }
      if (answered.length >= 5 && allCorrect) perfectGames++;
    }

    // بصمة البوت: توقيتات متطابقة ضمن هامش ضيق عبر إجابات كثيرة
    const sorted = [...timings].sort((a, b) => a - b);
    let clones = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= CLONE_TOLERANCE_MS) clones++;
    }

    const medianMs = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const fastestMs = sorted.length > 0 ? sorted[0] : 0;
    const instantRate = answeredCount > 0 ? Math.round((instant / answeredCount) * 100) : 0;

    const accuracyByDifficulty = [...byDiff.entries()].map(([difficulty, b]) => ({
      difficulty,
      correct: b.correct,
      total: b.total,
      rate: b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0,
    }));
    const hard = accuracyByDifficulty
      .filter((d) => d.difficulty === "hard" || d.difficulty === "extreme")
      .reduce((acc, d) => ({ correct: acc.correct + d.correct, total: acc.total + d.total }), { correct: 0, total: 0 });
    const hardAccuracy = hard.total > 0 ? Math.round((hard.correct / hard.total) * 100) : -1;

    // المؤشرات الجنائية
    const flags: string[] = [];
    if (answeredCount >= 15 && instantRate >= 30) {
      flags.push(`نسبة إجابات خاطفة مرتفعة: ${instantRate}% أقل من ثانية (${answeredCount} إجابة)`);
    }
    if (answeredCount >= 20 && clones >= Math.max(6, Math.floor(answeredCount * 0.25))) {
      flags.push(`تطابق توقيتات مقلق: ${clones} إجابة متطابقة ضمن ${CLONE_TOLERANCE_MS}ms — بصمة آلية محتملة`);
    }
    if (hardAccuracy >= 85 && hard.total >= 10) {
      flags.push(`دقة مستحيلة على الأسئلة الصعبة: ${hardAccuracy}% في ${hard.total} سؤالاً`);
    }
    if (perfectGames >= 4) {
      flags.push(`${perfectGames} جولات كاملة بلا خطأ واحد — انتظام إحصائي نادر`);
    }
    if (medianMs > 0 && medianMs < 2500 && answeredCount >= 15) {
      flags.push(`وسيط سرعة الإجابة سريع جداً: ${medianMs}ms فقط`);
    }
    if (mine.filter((e) => !e.resolved).length >= 3) {
      flags.push(`${mine.filter((e) => !e.resolved).length} أحداث لعب نظيف غير محسومة في السجل`);
    }

    return {
      gamesAnalyzed,
      totalAnswers: answeredCount,
      answeredCount,
      instantRate,
      medianMs,
      fastestMs,
      timingClones: clones,
      accuracyByDifficulty,
      hardAccuracy,
      perfectGames,
      suspiciousEvents: mine.slice(0, 10).map((e) => ({ kind: e.kind, detail: e.detail, at: e.at })),
      priorStrikes,
      flags,
    };
  },
});

// ── 2) فتح تحقيق وتحليله بالذكاء الاصطناعي (action) ─────────────────────

export const openInvestigation = action({
  args: {
    suspectId: v.id("users"),
    suspectName: v.string(),
    eventIds: v.optional(v.array(v.id("fairPlayLog"))),
  },
  handler: async (ctx, { suspectId, suspectName, eventIds }) => {
    const actor = (await ctx.runQuery("aiDetective:getDetectiveActor" as any, {})) as {
      name: string;
    } | null;
    if (!actor) throw new Error("يجب تسجيل الدخول أولاً");

    await ensureAiRuntime(ctx);
    if (!getOpenRouterKey()) {
      throw new Error("لا يوجد مزوّد AI مفعّل — اضبطه من مركز API في غرفة المالك");
    }

    const evidence = (await ctx.runQuery(
      "aiDetective:collectEvidenceInternal" as any,
      { suspectId },
    )) as EvidenceReport;

    if (evidence.answeredCount < 5) {
      throw new Error("أدلة غير كافية — اللاعب لم يجمع إجابات كافية للتحليل (أقل من 5)");
    }

    // إن لم تُحدد أحداث: اربط آخر 5 أحداث غير محسومة للاعب
    let linkedEvents = eventIds ?? [];
    if (linkedEvents.length === 0) {
      linkedEvents = (await ctx.runQuery(
        "aiDetective:getUnresolvedEventIds" as any,
        { suspectId },
      )) as Id<"fairPlayLog">[];
    }

    // فتح الملف (open) ثم التحليل ثم إغلاقه بالحكم
    const caseId = (await ctx.runMutation("aiDetective:createCase" as any, {
      suspectId,
      suspectName,
      eventIds: linkedEvents,
    })) as Id<"detectiveCases">;

    // ═══ التحليل الذكي ═══
    const diffLines = evidence.accuracyByDifficulty
      .map(
        (d) =>
          `- ${DIFFICULTY_LABELS[d.difficulty as keyof typeof DIFFICULTY_LABELS] ?? d.difficulty}: ${d.correct}/${d.total} (${d.rate}%)`,
      )
      .join("\n");
    const evLines = evidence.suspiciousEvents
      .map((e) => `- [${e.kind}] ${e.detail}`)
      .join("\n");
    const flagLines = evidence.flags.length > 0 ? evidence.flags.map((f) => `- ${f}`).join("\n") : "- لا مؤشرات جنائية";

    const prompt = `أنت محقق جنائي رقمي في لعبة أسئلة عربية. حلّل أدلة اللاعب «${suspectName}» واحكم: هل هو محتال يستخدم أدوات/سكربتات، أم لاعب موهوب سريع، أم خطأ قياس؟

الأدلة الرقمية:
- عدد الجولات المحللة: ${evidence.gamesAnalyzed}
- إجابات محللة: ${evidence.answeredCount}
- نسبة الإجابات الخاطفة (<1 ثانية): ${evidence.instantRate}%
- وسرط زمن الإجابة: ${evidence.medianMs}ms | أسرع إجابة: ${evidence.fastestMs}ms
- توقيتات متطابقة ضمن ${CLONE_TOLERANCE_MS}ms: ${evidence.timingClones}
- جولات كاملة بلا خطأ: ${evidence.perfectGames}
- إشارات سابقة مسجلة: ${evidence.priorStrikes}

الدقة حسب الصعوبة:
${diffLines || "- لا بيانات"}

مؤشرات الفحص المحلي:
${flagLines}

أحداث اللعب النظيف المسجلة:
${evLines || "- لا أحداث"}

أجب بصيغة JSON حصرية:
{"verdict":"innocent|suspicious|guilty|inconclusive","confidence":0-100,"summary":"تقرير سردي بالعربية من 3-5 أسطر يشرح المنطق","evidenceBullets":["أهم 3-5 أدلة حاسمة"],"recommendedActions":["توصيات عملية: مراقبة/لا شيء/متابعة/عقوبة يدوية"]}`;

    let aiResult: {
      verdict: string;
      confidence: number;
      summary: string;
      evidenceBullets: string[];
      recommendedActions: string[];
    } | null = null;

    try {
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت محقق جنائي رقمي محايد وصارم في لعبة أسئلة. تحكم بالأدلة الإحصائية فقط، لا بالانطباعات. إن كانت الأدلة متضاربة أو ناقصة اختر inconclusive. لا تتهم بلا قناعة عالية. أجب JSON حصراً.",
          },
          { role: "user", content: prompt },
        ],
        900,
        0.2,
        "MindClash Minds Detective",
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const obj = JSON.parse(match[0]) as Record<string, unknown>;
        const validVerdicts = ["innocent", "suspicious", "guilty", "inconclusive"];
        const v = String(obj.verdict ?? "");
        aiResult = {
          verdict: validVerdicts.includes(v) ? v : "inconclusive",
          confidence: Math.min(100, Math.max(0, Math.round(Number(obj.confidence ?? 50)))),
          summary: String(obj.summary ?? "بدون تقرير").slice(0, 1200),
          evidenceBullets: Array.isArray(obj.evidenceBullets)
            ? (obj.evidenceBullets as unknown[]).map(String).slice(0, 6)
            : [],
          recommendedActions: Array.isArray(obj.recommendedActions)
            ? (obj.recommendedActions as unknown[]).map(String).slice(0, 6)
            : [],
        };
      }
    } catch {
      // فشل التحليل الذكي: نكمل بالحكم المحلي فقط
    }

    // الحكم الاحتياطي المحلي عند غياب الذكاء أو فشله
    const localVerdict =
      evidence.flags.length >= 3
        ? "suspicious"
        : evidence.flags.length >= 1
          ? "inconclusive"
          : "innocent";

    const verdict = aiResult?.verdict ?? localVerdict;
    const confidence = aiResult?.confidence ?? (verdict === "innocent" ? 70 : 40);

    await ctx.runMutation("aiDetective:closeCase" as any, {
      caseId,
      verdict,
      confidence,
      summary:
        aiResult?.summary ??
        `حكم محلي بلا تحليل ذكي: ${evidence.flags.length} مؤشر جنسي مكتشف. أعد التحليل بعد إصلاح مزوّد AI.`,
      evidenceBullets: aiResult?.evidenceBullets ?? evidence.flags,
      recommendedActions:
        aiResult?.recommendedActions ??
        (verdict === "suspicious"
          ? ["راقب الجولات القادمة", "فعّل عقوبات الحكم الآلي التدريجية"]
          : ["لا إجراء مطلوب"]),
      model: aiResult ? "minds-detective-v1" : "local-fallback",
    });

    return {
      caseId,
      verdict,
      confidence,
      evidence: evidence.flags,
      usedAi: aiResult !== null,
    };
  },
});

// ── 3) عمليات داخلية: إنشاء/إغلاق الملف + أدوات مساندة ──────────────────

export const getDetectiveActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المحقق" };
  },
});

export const getUnresolvedEventIds = internalQuery({
  args: { suspectId: v.id("users") },
  handler: async (ctx, { suspectId }) => {
    const events = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .take(100);
    return events
      .filter((e) => e.userId === suspectId && !e.resolved)
      .slice(0, 5)
      .map((e) => e._id);
  },
});

export const createCase = internalMutation({
  args: {
    suspectId: v.id("users"),
    suspectName: v.string(),
    eventIds: v.array(v.id("fairPlayLog")),
  },
  handler: async (ctx, { suspectId, suspectName, eventIds }) => {
    return await ctx.db.insert("detectiveCases", {
      suspectId,
      suspectName,
      eventIds,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const closeCase = internalMutation({
  args: {
    caseId: v.id("detectiveCases"),
    verdict: v.union(
      v.literal("innocent"),
      v.literal("suspicious"),
      v.literal("guilty"),
      v.literal("inconclusive"),
    ),
    confidence: v.number(),
    summary: v.string(),
    evidenceBullets: v.array(v.string()),
    recommendedActions: v.array(v.string()),
    model: v.string(),
  },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.caseId, {
      status: "closed",
      verdict: a.verdict,
      confidence: a.confidence,
      summary: a.summary,
      evidenceBullets: a.evidenceBullets,
      recommendedActions: a.recommendedActions,
      model: a.model,
      closedAt: Date.now(),
    });
  },
});

// ── 4) واجهة غرفة المالك ────────────────────────────────────────────────

/** آخر ملفات التحقيق — تُعرض في تبويب اللعب النظيف. */
export const getCases = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const rows = await ctx.db
      .query("detectiveCases")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 10, 30));
    return rows.map((r) => ({
      _id: r._id,
      suspectId: r.suspectId,
      suspectName: r.suspectName,
      eventCount: r.eventIds.length,
      status: r.status,
      verdict: r.verdict ?? null,
      confidence: r.confidence ?? null,
      summary: r.summary ?? null,
      evidenceBullets: r.evidenceBullets ?? [],
      recommendedActions: r.recommendedActions ?? [],
      model: r.model ?? null,
      createdAt: r.createdAt,
      closedAt: r.closedAt ?? null,
    }));
  },
});

/** فتح تحقيق يدوي من سجل الأحداث (يستدعيه زر الواجهة). */
export const markEventsResolved = mutation({
  args: { eventIds: v.array(v.id("fairPlayLog")) },
  handler: async (ctx, { eventIds }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    for (const id of eventIds) {
      await ctx.db.patch(id, { resolved: true });
    }
  },
});
