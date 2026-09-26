import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { CATEGORIES, QUESTION_BANK, normalizeDifficulty } from "./questions";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

/**
 * 🧠 مدقّق العقول (Minds Verifier)
 *
 * حكَم ذكي يقف بين توليد الأسئلة بالذكاء الاصطناعي والاعتماد اليدوي:
 *  1) فحوص محلية فورية (بدون تكلفة): البنية، الخيارات المكررة،
 *     تطابق مؤشر الإجابة، التشابه النصي مع البنك (كشف التكرار).
 *  2) حكم LLM واقعي: هل الإجابة المعلّمة صحيحة فعلاً؟ هل اللغة سليمة؟
 *     هل الصعوبة معايَرة؟ مع اقتراح تصحيح للإجابة/الصعوبة عند الحاجة.
 *  3) تطبيق الحكم آلياً: اعتماد السليم، تصحيح القابل للإصلاح، رفض الخطأ —
 *     وكل قرار يُسجّل في aiDecisionLog لمراجعته من غرفة المالك.
 *
 * القرار النهائي دائماً بيد المالك: لا يُعتمد أي سؤال آلياً إلا إذا فعّل
 * المالك «الاعتماد التلقائي» صراحةً من الواجهة.
 */

// ── أنواع مشتركة ─────────────────────────────────────────────────────────

export type LocalCheckResult = {
  fatal: boolean; // خلل بنيوي يجعل الفحص الذكي بلا معنى
  issues: string[];
  duplicateOf: string | null; // qid سؤال مشابه في البنك
  similarityScore: number; // 0..100 أعلى تشابه مع البنك
};

function isDifficultyValue(value: unknown): value is string {
  return ["easy", "medium", "hard", "extreme"].includes(String(value));
}

// ── 1) الفحوص المحلية الفورية (تكلفة صفر) ────────────────────────────────

/** إزالة التشكيل والتطبيع البسيط للنص العربي لمقارنة عادلة. */
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670]/g, "") // تشكيل
    .replace(/[\u0622\u0623\u0625]/g, "\u0627") // أ/إ/آ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/[^\u0600-\u06FF0-9a-zA-Z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** تشابه ثنائيات الحروف (Dice) — كافٍ لكشف التكرار شبه الحرفي. */
function similarity(a: string, b: string): number {
  const na = normalizeArabic(a);
  const nb = normalizeArabic(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      set.set(g, (set.get(g) ?? 0) + 1);
    }
    return set;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  let overlap = 0;
  for (const [g, count] of A) {
    const other = B.get(g);
    if (other) overlap += Math.min(count, other);
  }
  const totalA = [...A.values()].reduce((s, n) => s + n, 0);
  const totalB = [...B.values()].reduce((s, n) => s + n, 0);
  const total = totalA + totalB;
  return total === 0 ? 0 : Math.round((2 * overlap * 100) / total);
}

export const localCheckInternal = internalQuery({
  args: {
    category: v.string(),
    difficulty: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
  },
  handler: async (_ctx, q): Promise<LocalCheckResult> => {
    const issues: string[] = [];
    let fatal = false;

    const text = q.question.trim();
    if (text.length < 8) {
      issues.push("نص السؤال قصير جداً أو فارغ");
      fatal = true;
    }
    if (q.options.length !== 4 || q.options.some((o) => !o.trim())) {
      issues.push("الخيارات يجب أن تكون أربعة نصوص غير فارغة");
      fatal = true;
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      issues.push(`مؤشر الإجابة الصحيحة خارج النطاق (${q.correctIndex})`);
      fatal = true;
    }
    const lower = q.options.map((o) => normalizeArabic(o).toLowerCase());
    if (new Set(lower).size < 4) {
      issues.push("يوجد خياران متطابقان أو شبه متطابقين");
    }
    if (!(CATEGORIES as readonly string[]).includes(q.category)) {
      issues.push(`فئة غير معتمدة: ${q.category}`);
      fatal = true;
    }
    if (!isDifficultyValue(q.difficulty)) {
      const d = normalizeDifficulty(q.difficulty);
      issues.push(`صعوبة غير معروفة (${q.difficulty}) — اعتُبرت ${d}`);
    }

    // هل الخيار الصحيح هو الأطول بوضوح؟ نمط تسرّب شائع في مولدات الأسئلة.
    const correctLen = (q.options[q.correctIndex] ?? "").length;
    const others = q.options
      .filter((_, i) => i !== q.correctIndex)
      .map((o) => o.length);
    if (
      others.length === 3 &&
      correctLen > 0 &&
      others.every((l) => correctLen > l * 1.8)
    ) {
      issues.push("الإجابة الصحيحة أطول بوضوح من البدائل — قد يسرّب الجواب");
    }

    // كشف التكرار مقابل البنك الدائم (تنبيه لا رفض: AI قد يعيد صياغة معروفة)
    let duplicateOf: string | null = null;
    let similarityScore = 0;
    for (const bankQ of QUESTION_BANK) {
      const score = similarity(text, bankQ.question);
      if (score > similarityScore) {
        similarityScore = score;
        if (score >= 82) duplicateOf = bankQ.id;
      }
    }
    if (duplicateOf) {
      issues.push(`شبه مكرر لسؤال البنك ${duplicateOf} (تشابه ${similarityScore}%)`);
    }

    return { fatal, issues, duplicateOf, similarityScore };
  },
});

// ── 2) الحكم الذكي (LLM) ────────────────────────────────────────────────

type DifficultyFit =
  | "fit"
  | "should_be_easy"
  | "should_be_medium"
  | "should_be_hard"
  | "should_be_extreme";

type AiVerdict = {
  answerCorrect: boolean;
  languageOk: boolean;
  difficultyFit: DifficultyFit;
  verdict: "pass" | "fixable" | "reject";
  score: number;
  issues: string[];
  correctedQuestion?: string;
  correctedOptions?: string[];
  correctedCorrectIndex?: number;
  correctedDifficulty?: "easy" | "medium" | "hard" | "extreme";
};

function parseAiVerdict(raw: string): AiVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    const verdict = obj.verdict;
    if (verdict !== "pass" && verdict !== "fixable" && verdict !== "reject") {
      return null;
    }
    const fitMap: Record<string, DifficultyFit> = {
      fit: "fit",
      should_be_easy: "should_be_easy",
      should_be_medium: "should_be_medium",
      should_be_hard: "should_be_hard",
      should_be_extreme: "should_be_extreme",
    };
    const difficultyFit = fitMap[String(obj.difficultyFit ?? "fit")] ?? "fit";
    const scoreRaw = typeof obj.score === "number" ? obj.score : 50;
    const score = Math.min(100, Math.max(0, Math.round(scoreRaw)));
    const issues = Array.isArray(obj.issues)
      ? (obj.issues as unknown[]).map(String).slice(0, 6)
      : [];
    const out: AiVerdict = {
      answerCorrect: obj.answerCorrect === true,
      languageOk: obj.languageOk !== false,
      difficultyFit,
      verdict,
      score,
      issues,
    };
    if (typeof obj.correctedQuestion === "string" && obj.correctedQuestion.trim()) {
      out.correctedQuestion = obj.correctedQuestion.trim();
    }
    if (Array.isArray(obj.correctedOptions)) {
      const opts = (obj.correctedOptions as unknown[])
        .map(String)
        .filter((o) => o.trim());
      if (opts.length === 4) out.correctedOptions = opts;
    }
    if (typeof obj.correctedCorrectIndex === "number") {
      const i = Math.round(obj.correctedCorrectIndex);
      if (i >= 0 && i <= 3) out.correctedCorrectIndex = i;
    }
    if (isDifficultyValue(obj.correctedDifficulty)) {
      out.correctedDifficulty = normalizeDifficulty(obj.correctedDifficulty);
    }
    return out;
  } catch {
    return null;
  }
}

const VERIFY_SYSTEM_PROMPT = `أنت مدقق أسئلة صارم للعبة أسئلة عربية تسمى "حرب العقول". تُعطى سؤالاً بأربعة خيارات ومؤشر الإجابة الصحيحة. مهمتك:
1) التحقق واقعياً من صحة الإجابة المعلّمة بمعرفتك العامة (هذا أهم فحص).
2) فحص سلامة اللغة ووضوح السؤال (بدون غموض أو ازدواجية).
3) معايرة الصعوبة: easy=عام يعرفه الجميع، medium=ثقافة متوسطة، hard=معلومات متخصصة، extreme=معلومات نادرة جداً.
4) كشف الخيارات المتداخلة أو السؤال المضلل.
أجب بصيغة JSON حصرية دون أي نص آخر:
{"answerCorrect":true,"languageOk":true,"difficultyFit":"fit","verdict":"pass","score":85,"issues":["سبب بالعربية عند وجوده"]}
الحقول الاختيارية عند الحاجة فقط: "correctedQuestion":"..."، "correctedOptions":["أربعة"]، "correctedCorrectIndex":0، "correctedDifficulty":"easy|medium|hard|extreme".
القواعد: إن كانت الإجابة المعلّمة خاطئة والخيار الصحيح موجود بين البدائل ⇒ fixable مع correctedCorrectIndex. إن كان السؤال مضللاً أو بلا إجابة صحيحة أو رديئاً بنيوياً ⇒ reject. لا تختلق تصحيحات إلا عند اليقين.`;

// ── 3) الدخول الرئيسي: تدقيق دفعة الأسئلة المعلّقة ───────────────────────

export type VerifyResultRow = {
  qid: string;
  verdict: "pass" | "fixable" | "reject";
  score: number;
  issues: string[];
  duplicateOf: string | null;
};

type PendingRow = {
  _id: string;
  qid: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  verification: unknown;
};

export const verifyPendingQuestions = action({
  args: {
    limit: v.optional(v.number()), // 1..15 — الافتراضي 6
    autoApply: v.optional(v.boolean()), // اعتماد/رفض/تصحيح آلي بعد الحكم
  },
  handler: async (ctx, args) => {
    await ensureAiRuntime(ctx);
    if (!getOpenRouterKey()) {
      throw new Error("لا يوجد مزوّد AI مفعّل — اضبطه من مركز API في غرفة المالك");
    }

    const actor = (await ctx.runQuery("aiVerifier:getVerifierActor" as any, {})) as {
      name: string;
    } | null;
    if (!actor) throw new Error("يجب تسجيل الدخول أولاً");

    const limit = Math.min(Math.max(args.limit ?? 6, 1), 15);
    const autoApply = args.autoApply === true;

    const pending = (await ctx.runQuery(
      "aiVerifier:getPendingForVerification" as any,
      { limit: 100 },
    )) as PendingRow[];

    const queue = pending
      .filter((r) => r.verification === null || r.verification === undefined)
      .slice(0, limit);

    if (queue.length === 0) {
      return {
        checked: 0,
        passed: 0,
        fixedCount: 0,
        rejected: 0,
        results: [] as VerifyResultRow[],
      };
    }

    const results: VerifyResultRow[] = [];
    let passed = 0;
    let fixedCount = 0;
    let rejected = 0;

    for (const row of queue) {
      // 1) الفحص المحلي
      const local = (await ctx.runQuery(
        "aiVerifier:localCheckInternal" as any,
        {
          category: row.category,
          difficulty: row.difficulty,
          question: row.question,
          options: row.options,
          correctIndex: row.correctIndex,
        },
      )) as LocalCheckResult;

      let verdict: "pass" | "fixable" | "reject";
      let score: number;
      let issues: string[];
      const fixPatch: {
        question?: string;
        options?: string[];
        correctIndex?: number;
        difficulty?: "easy" | "medium" | "hard" | "extreme";
      } = {};

      if (local.fatal) {
        verdict = "reject";
        score = 0;
        issues = local.issues;
      } else {
        // 2) الحكم الذكي
        const prompt = `فئة السؤال: ${row.category}\nالصعوبة المعلنة: ${row.difficulty}\nالسؤال: ${row.question}\nالخيارات:\n0) ${row.options[0] ?? ""}\n1) ${row.options[1] ?? ""}\n2) ${row.options[2] ?? ""}\n3) ${row.options[3] ?? ""}\nمؤشر الإجابة المعلّم: ${row.correctIndex}\n${local.duplicateOf ? `تنبيه: يشابه سؤال البنك ${local.duplicateOf} بنسبة ${local.similarityScore}%\n` : ""}دقّق الآن وأجب بصيغة JSON حصرية.`;
        try {
          const raw = await callLlm(
            [
              { role: "system", content: VERIFY_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            700,
            0.15,
            "MindClash Minds Verifier",
          );
          const ai = parseAiVerdict(raw);
          if (!ai) {
            verdict = "fixable";
            score = 55;
            issues = [...local.issues, "تعذّر تحليل حكم المدقق — يحتاج مراجعة يدوية"];
          } else {
            issues = [...local.issues, ...ai.issues].slice(0, 8);
            // دمج الحكم: تكرار شبه حرفي محلي يغلب ذكاءً متساهلاً،
            // وإجابة خاطئة بلا تصحيح مقترح تعني رفضاً مباشراً.
            const nearDuplicate = local.duplicateOf !== null && local.similarityScore >= 92;
            if (nearDuplicate || ai.verdict === "reject" || (!ai.answerCorrect && ai.correctedCorrectIndex === undefined)) {
              verdict = "reject";
            } else if (
              ai.verdict === "fixable" ||
              ai.correctedCorrectIndex !== undefined ||
              ai.correctedDifficulty !== undefined ||
              ai.correctedQuestion !== undefined ||
              ai.correctedOptions !== undefined
            ) {
              verdict = "fixable";
            } else {
              verdict = "pass";
            }
            score = Math.min(
              ai.score,
              local.duplicateOf ? Math.max(20, ai.score - 25) : ai.score,
            );
            if (verdict === "fixable") {
              fixPatch.question = ai.correctedQuestion;
              fixPatch.options = ai.correctedOptions;
              fixPatch.correctIndex = ai.correctedCorrectIndex;
              const fitToDifficulty: Record<
                DifficultyFit,
                "easy" | "medium" | "hard" | "extreme" | undefined
              > = {
                fit: undefined,
                should_be_easy: "easy",
                should_be_medium: "medium",
                should_be_hard: "hard",
                should_be_extreme: "extreme",
              };
              fixPatch.difficulty = ai.correctedDifficulty ?? fitToDifficulty[ai.difficultyFit];
            }
          }
        } catch (err) {
          verdict = "fixable";
          score = 50;
          issues = [
            ...local.issues,
            `فشل استدعاء المدقق: ${err instanceof Error ? err.message.slice(0, 80) : "خطأ"}`,
          ];
        }
      }

      // 3) تطبيق الحكم
      const applyApprove = autoApply && verdict === "pass";
      const applyReject = autoApply && verdict === "reject";
      const applyFix =
        autoApply &&
        verdict === "fixable" &&
        (fixPatch.correctIndex !== undefined ||
          fixPatch.difficulty !== undefined ||
          fixPatch.question !== undefined ||
          fixPatch.options !== undefined);

      await ctx.runMutation("aiVerifier:applyVerdict" as any, {
        id: row._id,
        verdict,
        score,
        issues,
        fixedQuestion: fixPatch.question,
        fixedOptions: fixPatch.options,
        fixedCorrectIndex: fixPatch.correctIndex,
        fixedDifficulty: fixPatch.difficulty,
        approve: applyApprove,
        reject: applyReject,
        fixInline: applyFix,
        actor: actor.name,
      });

      if (verdict === "pass") passed++;
      else if (verdict === "reject") rejected++;
      else fixedCount++;
      results.push({
        qid: row.qid,
        verdict,
        score,
        issues,
        duplicateOf: local.duplicateOf,
      });
    }

    return { checked: queue.length, passed, fixedCount, rejected, results };
  },
});

// ── 4) تطبيق الحكم (internalMutation) ───────────────────────────────────

/** هوية المُشغّل — تُجلب داخل الـ action عبر runQuery (الـ action بلا db). */
export const getVerifierActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المدقق" };
  },
});

export const applyVerdict = internalMutation({
  args: {
    id: v.id("aiQuestions"),
    verdict: v.union(v.literal("pass"), v.literal("fixable"), v.literal("reject")),
    score: v.number(),
    issues: v.array(v.string()),
    fixedQuestion: v.optional(v.string()),
    fixedOptions: v.optional(v.array(v.string())),
    fixedCorrectIndex: v.optional(v.number()),
    fixedDifficulty: v.optional(
      v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard"),
        v.literal("extreme"),
      ),
    ),
    approve: v.boolean(),
    reject: v.boolean(),
    fixInline: v.boolean(),
    actor: v.string(),
  },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return;

    const shouldFixIndex =
      a.fixInline &&
      a.fixedCorrectIndex !== undefined &&
      a.fixedCorrectIndex !== row.correctIndex;
    const shouldFixDifficulty =
      a.fixInline && a.fixedDifficulty !== undefined && a.fixedDifficulty !== row.difficulty;
    const shouldFixQuestion = a.fixInline && a.fixedQuestion !== undefined;
    const shouldFixOptions = a.fixInline && a.fixedOptions !== undefined && a.fixedOptions.length === 4;

    await ctx.db.patch(a.id, {
      verification: {
        verdict: a.verdict,
        score: a.score,
        issues: a.issues,
        fixedQuestion: a.fixedQuestion,
        fixedOptions: a.fixedOptions,
        fixedCorrectIndex: a.fixedCorrectIndex,
        fixedDifficulty: a.fixedDifficulty,
        verifiedAt: Date.now(),
        model: "minds-verifier-v1",
      },
      ...(shouldFixIndex ? { correctIndex: a.fixedCorrectIndex as number } : {}),
      ...(shouldFixDifficulty ? { difficulty: a.fixedDifficulty } : {}),
      ...(shouldFixQuestion ? { question: a.fixedQuestion as string } : {}),
      ...(shouldFixOptions ? { options: a.fixedOptions as string[] } : {}),
      ...(a.approve ? { status: "approved" as const } : {}),
      ...(a.reject ? { status: "rejected" as const } : {}),
    });

    const actionMap = {
      pass: "verify_pass",
      fixable: "verify_fixable",
      reject: "verify_reject",
    } as const;
    const detailHead =
      a.verdict === "pass"
        ? `حكم المدقق: سليم (${a.score}%)`
        : a.verdict === "fixable"
          ? `حكم المدقق: قابل للإصلاح — ${a.issues[0] ?? ""}`
          : `حكم المدقق: مرفوض — ${a.issues[0] ?? ""}`;
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: a.actor,
      action: actionMap[a.verdict],
      targetId: row.qid,
      targetName: row.question.slice(0, 40),
      detail: detailHead + (a.fixInline ? " + إصلاح آلي" : ""),
      severity: a.verdict === "reject" ? "medium" : "low",
      createdAt: Date.now(),
    });
  },
});

// ── 5) استعلامات الواجهة ────────────────────────────────────────────────

/** الطابور المعلّق مع حالة التحقق — يقرؤه زر التدقيق. */
export const getPendingForVerification = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const rows = await ctx.db
      .query("aiQuestions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.min(Math.max(limit ?? 30, 1), 100))
      .map((r) => ({
        _id: r._id,
        qid: r.qid,
        category: r.category,
        difficulty: r.difficulty,
        question: r.question,
        options: r.options,
        correctIndex: r.correctIndex,
        verification: r.verification ?? null,
      }));
  },
});

/** إحصاءات المدقق لبطاقة الحالة في الواجهة. */
export const getVerifierStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const rows = await ctx.db.query("aiQuestions").collect();
    let pending = 0;
    let verified = 0;
    let passed = 0;
    let fixable = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.status === "pending") pending++;
      const v = r.verification;
      if (v) {
        verified++;
        if (v.verdict === "pass") passed++;
        else if (v.verdict === "fixable") fixable++;
        else rejected++;
      }
    }
    return { pending, verified, passed, fixable, rejected, total: rows.length };
  },
});
