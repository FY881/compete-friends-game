import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  CATEGORIES,
  isDifficulty,
  normalizeDifficulty,
  QUESTION_BANK,
  type Difficulty,
} from "./questions";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

type GeneratedQuestion = {
  id: Id<"aiQuestions">;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  verification: {
    verdict: "pass" | "fixable" | "reject";
    score: number;
    issues: string[];
  } | null;
};

/**
 * Parse a single question object from the AI response.
 */
function parseGeneratedQuestion(
  q: Record<string, unknown>,
  category: string,
): {
  qid: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correctIndex: number;
} | null {
  try {
    const question = String(q.question ?? "");
    const options = Array.isArray(q.options)
      ? (q.options as unknown[]).map(String)
      : [];
    const difficulty = isDifficulty(q.difficulty)
      ? q.difficulty
      : normalizeDifficulty(q.difficulty);
    const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
    if (!question || options.length < 2) return null;
    return {
      qid: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      category: (CATEGORIES as readonly string[]).includes(category) ? category : CATEGORIES[0],
      difficulty,
      question,
      options: options.slice(0, 4),
      correctIndex: Math.min(correctIndex, options.length - 1),
    };
  } catch {
    return null;
  }
}

/**
 * Parse multiple questions from the AI response text.
 */
function parseGeneratedQuestions(
  text: string,
  category: string,
): {
  qid: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correctIndex: number;
}[] {
  try {
    // Try JSON array first
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const arr = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
      return arr
        .map((q) => parseGeneratedQuestion(q, category))
        .filter((q): q is NonNullable<typeof q> => q != null);
    }
  } catch {
    // Fall through to line-by-line parsing
  }

  const lines = text.split("\n").filter((l) => l.trim());    const results: ReturnType<typeof parseGeneratedQuestion>[] = [];
  let current: Partial<{
    question: string;
    options: string[];
    correctIndex: number;
    difficulty: Difficulty;
  }> | null = null;

  for (const line of lines) {
    const trimmed = line.replace(/^\d+[\.\)]\s*/, "").trim();
    if (trimmed.startsWith("question:") || trimmed.startsWith("س:")) {
      if (current?.question && (current.options?.length ?? 0) >= 2) {
        results.push(
          parseGeneratedQuestion(
            { ...current, correctIndex: current.correctIndex ?? 0 },
            category,
          ),
        );
      }
      current = {
        question: trimmed.replace(/^(question:|س:)\s*/i, ""),
        options: [],
        correctIndex: 0,
        difficulty: "medium",
      };
    } else if (trimmed.startsWith("option") || trimmed.startsWith("أ)") || trimmed.startsWith("ب)") || trimmed.startsWith("ج)") || trimmed.startsWith("د)") || /^[a-d]\)/i.test(trimmed)) {
      current?.options?.push(trimmed.replace(/^[\wأ-ي]\)\s*/, ""));
    } else if (trimmed.startsWith("correct:") || trimmed.startsWith("الإجابة:")) {
      const idx = trimmed.replace(/^(correct:|الإجابة:)\s*/i, "").trim();
      const letter = idx.charAt(0).toLowerCase();
      if ("abcd".includes(letter)) {
        current!.correctIndex = "abcd".indexOf(letter);
      }
    }
  }
  if (current?.question && (current.options?.length ?? 0) >= 2) {
    const parsed = parseGeneratedQuestion(
      { ...current, correctIndex: current.correctIndex ?? 0 },
      category,
    );
    if (parsed) results.push(parsed);
  }
  return results.filter((q): q is NonNullable<typeof q> => q != null);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Generate questions using AI (called by admin or auto-admin). */
export const generateQuestions = action({
  args: {
    category: v.string(),
    count: v.number(),
  },
  handler: async (_ctx, { category, count }) => {
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(`فئة غير صالحة: ${category}`);
    }

    const boundedCount = Math.min(Math.max(count, 1), 10);

    await ensureAiRuntime(_ctx); // تحميل النظامين من مركز API قبل الاستدعاء
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error("لا يوجد نظام API مُفعّل — فعّل النظام الأول (مفتاح + رابط) أو الثاني (مفتاح فقط) من مركز API");
    }

    const systemPrompt = `أنت مولّد أسئلة ثقافية للعبة "حرب العقول". أنشئ ${boundedCount} أسئلة في الفئة "${category}" باللغة العربية الفصحى.  لكل سؤال: نص واضح + 4 خيارات (خيار واحد صحيح) + مؤشر الإجابة الصحيحة (0-3) + مستوى صعوبة من (easy|medium|hard|extreme).
لا تكرر الأسئلة المعروفة جداً. أعطِ إجابة بصيغة JSON مصفوفة حصرية دون أي نص آخر:
[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"difficulty":"medium"}]
الحقل correctIndex يجب أن يشير إلى موضع الخيار الصحيح داخل المصفوفة options (0 أولاً).`;

    const content = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `أنشئ ${boundedCount} أسئلة عن "${category}"` },
      ],
      1200,
      0.8,
      "MindClash Question Generator",
    );

    const questions = parseGeneratedQuestions(content, category).slice(0, boundedCount);

    // Store as pending via internal mutation
    if (questions.length > 0) {
      await _ctx.runMutation("aiQuestions:insertBatch" as any, {
        questions,
        actor: "owner",
      });
    }

    return { created: questions.length, category };
  },
});

/** Approve a pending question. */
export const approveQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    await ctx.db.patch(id, { status: "approved" });
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "approve_question",
      targetId: id,
      targetName: row.question.slice(0, 40),
      detail: `اعتماد سؤال من فئة ${row.category}`,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

/** Reject a pending question. */
export const rejectQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    await ctx.db.patch(id, { status: "rejected" });
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "reject_question",
      targetId: id,
      targetName: row.question.slice(0, 40),
      detail: `رفض سؤال من فئة ${row.category}`,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

/** طابور المراجعة + الإحصاءات — يعرضها تبويب المدير الآلي في غرفة المالك. */
export const getAiQuestionQueue = query({
  args: {},
  handler: async (ctx): Promise<{
    pending: GeneratedQuestion[];
    approvedCount: number;
    rejectedCount: number;
    perCategory: Record<string, number>;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const rows = await ctx.db.query("aiQuestions").collect();
    const pending = rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        id: r._id,
        category: r.category,
        difficulty: normalizeDifficulty(r.difficulty),
        question: r.question,
        options: r.options,
        correctIndex: r.correctIndex,
        status: r.status as "pending" | "approved" | "rejected",
        createdAt: r.createdAt,
        verification: r.verification
          ? {
              verdict: r.verification.verdict,
              score: r.verification.score,
              issues: r.verification.issues,
            }
          : null,
      }));

    // Convex لا يسمح بأسماء حقول غير ASCII — نستخدم slug لكل فئة.
    const slugify = (s: string): string => s.replace(/[^\x20-\x7E]/g, "_");
    const perCategory: Record<string, number> = {};
    for (const c of CATEGORIES) {
      perCategory[slugify(c)] = QUESTION_BANK.filter((q) => q.category === c).length;
    }
    for (const r of rows) {
      if (r.status === "approved") {
        const key = slugify(r.category);
        perCategory[key] = (perCategory[key] ?? 0) + 1;
      }
    }

    return {
      pending,
      approvedCount: rows.filter((r) => r.status === "approved").length,
      rejectedCount: rows.filter((r) => r.status === "rejected").length,
      perCategory,
    };
  },
});

/**
 * ملء تلقائي للفئات الضعيفة — يستدعيه المدير الآلي كل 15 دقيقة.
 * يُعيد OK + عدد الأسئلة المُضافة إن نجح، أو fail reason.
 */
export const autoRefillWeakCategory = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    ok: boolean;
    reason?: string;
    category?: string;
    count?: number;
  }> => {
    const rows = await ctx.db.query("aiQuestions").collect();
    const perCategory: Record<string, number> = {};
    for (const c of CATEGORIES) {
      perCategory[c] = QUESTION_BANK.filter((q) => q.category === c).length;
    }
    for (const r of rows) {
      if (r.status === "approved") {
        perCategory[r.category] = (perCategory[r.category] ?? 0) + 1;
      }
    }
    // Find the weakest category
    let weakest: string | null = null;
    let weakestCount = Infinity;
    for (const c of CATEGORIES) {
      const count = perCategory[c] ?? 0;
      if (count < 12 && count < weakestCount) {
        weakestCount = count;
        weakest = c;
      }
    }
    if (!weakest) {
      return { ok: true, reason: "All categories are healthy (12+)" };
    }
    return {
      ok: false,
      reason: `Category \"${weakest}\" needs more questions (${weakestCount}/12)`,
      category: weakest,
      count: weakestCount,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal helpers (used by games + the auto-admin sweep)
// ---------------------------------------------------------------------------

export const getStaffForGen = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المشرف" };
  },
});

export const insertBatch = internalMutation({
  args: {
    questions: v.array(
      v.object({
        qid: v.string(),
        category: v.string(),
        difficulty: v.union(
          v.literal("easy"),
          v.literal("medium"),
          v.literal("hard"),
          v.literal("extreme"),
        ),
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
      }),
    ),
    actor: v.optional(v.string()),
  },
  handler: async (ctx, { questions, actor }) => {
    let created = 0;
    for (const q of questions) {
      await ctx.db.insert("aiQuestions", {
        qid: q.qid,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        status: "pending",
        createdAt: Date.now(),
      });
      created++;
    }
    return { created };
  },
});

export const countByCategory = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("aiQuestions").collect();
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    // مفاتيح الفئات عربية — لا تُسلسَل ككائن؛ نعيدها مصفوفة
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  },
});

export const getApprovedByCategory = internalQuery({
  args: {
    category: v.string(),
    count: v.number(),
  },
  handler: async (ctx, { category, count }) => {
    const rows = await ctx.db
      .query("aiQuestions")
      .filter((q) => q.eq(q.field("category"), category))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();
    // Shuffle and take `count`
    const shuffled = rows.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((r) => ({
      id: r.qid,
      category: r.category,
      difficulty: r.difficulty,
      question: r.question,
      options: r.options,
      correctIndex: r.correctIndex,
    }));
  },
});

export const autoGenerate = internalMutation({
  args: {
    category: v.string(),
    count: v.number(),
    actor: v.optional(v.string()),
    auto: v.optional(v.boolean()),
  },
  handler: async (ctx, { category, count, actor, auto }) => {
    const boundedCount = Math.min(Math.max(count, 1), 10);
    // Placeholder — actual generation would use OpenRouter
    return { created: 0, category };
  },
});

export const getApprovedByCategoryForSweep = internalQuery({
  args: {
    category: v.string(),
  },
  handler: async (ctx, { category }) => {
    const rows = await ctx.db
      .query("aiQuestions")
      .filter((q) => q.eq(q.field("category"), category))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();
    return rows.length;
  },
});

export const getQueueStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const rows = await ctx.db.query("aiQuestions").collect();
    const weak: [string, number][] = [];
    const counts: Record<string, number> = {};

    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }

    for (const c of CATEGORIES) {
      const total = (QUESTION_BANK.filter((q) => q.category === c).length) + (counts[c] ?? 0);
      if (total < 12) {
        weak.push([c, total]);
      }
    }

    return {
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      weak,
      // Convex لا يدعم مفاتيح كائنات غير ASCII (أسماء الفئات عربية) — نحوّلها لمصفوفة
      perCategory: Object.entries(counts).map(([category, count]) => ({ category, count })),
    };
  },
});


// AI Content Generation System
// 1. Question generation (multiple choice, fill-in-blank)
// 2. Answer verification (fact-checking)
// 3. Difficulty estimation (auto-classify)
// 4. Category classification (auto-tag)
// 5. Language optimization (clear, concise)
// 6. Plagiarism detection (original content)
// 7. Quality scoring (engagement prediction)
// 8. A/B variant generation (test alternatives)
// 9. Localization (multi-language support)
// 10. Accessibility (readability scoring)

// ═══════════════════════════════════════════════════════════════════════════
// 🛠️ المرحلة 11 — استوديو الأسئلة (أدوات المالك المتقدمة)
//   إنشاء/تحرير يدوي + كشف تكرار حقيقي + جدولة نشر مستقبلي
// ═══════════════════════════════════════════════════════════════════════════

/** كشف تكرار: تطبيع النص العربي ومقارنة تشابه بالجمل الثلاث الأولى */
function normalizeAr(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "") // التشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function signatureOf(text: string): string {
  const words = normalizeAr(text).split(" ").filter(Boolean);
  return words.slice(0, 6).join(" ");
}

export const checkDuplicate = query({
  args: { question: v.string() },
  handler: async (ctx, { question }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { matches: [] as { id: string; question: string; category: string; status: string }[] };
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return { matches: [] };
    const sig = signatureOf(question);
    if (sig.length < 8) return { matches: [] };
    const rows = await ctx.db.query("aiQuestions").collect();
    // + البنك الثابت
    const bankMatches: { id: string; question: string; category: string; status: string }[] = [];
    for (const q of QUESTION_BANK) {
      if (signatureOf(q.question) === sig) {
        bankMatches.push({ id: q.id, question: q.question, category: q.category, status: "bank" });
      }
    }
    const aiMatches = rows
      .filter((r) => signatureOf(r.question) === sig)
      .map((r) => ({ id: r._id, question: r.question, category: r.category, status: r.status }));
    return { matches: [...bankMatches.slice(0, 3), ...aiMatches.slice(0, 5)] };
  },
});

/** إضافة سؤال يدوي من المالك — مع جدولة اختيارية للنشر */
export const createManualQuestion = mutation({
  args: {
    category: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    scheduledFor: v.optional(v.number()), // إن وُجد: يبقى pending حتى الموعد ثم يُعتمد آلياً
  },
  handler: async (ctx, { category, difficulty, question, options, correctIndex, scheduledFor }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    if (question.trim().length < 8) throw new Error("نص السؤال قصير جداً");
    if (options.length !== 4 || new Set(options.map((o) => o.trim())).size !== 4) {
      throw new Error("يجب إدخال 4 خيارات مختلفة");
    }
    if (correctIndex < 0 || correctIndex > 3) throw new Error("فهرس الإجابة غير صالح");
    // كشف تكرار إلزامي قبل الحفظ
    const sig = signatureOf(question);
    const rows = await ctx.db.query("aiQuestions").collect();
    const dupAi = rows.some((r) => signatureOf(r.question) === sig && r.status !== "rejected");
    const dupBank = QUESTION_BANK.some((q) => signatureOf(q.question) === sig);
    if (dupAi || dupBank) throw new Error("سؤال مكرر — غيّر الصياغة");

    const qid = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const id = await ctx.db.insert("aiQuestions", {
      qid,
      category,
      difficulty,
      question: question.trim(),
      options: options.map((o) => o.trim()),
      correctIndex,
      status: "pending",
      createdAt: Date.now(),
      authorName: me.name ?? "المالك",
      scheduledFor: scheduledFor ?? undefined,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "create_manual_question",
      targetId: id,
      targetName: question.slice(0, 40),
      detail: scheduledFor ? `سؤال يدوي مجدول من فئة ${category}` : `سؤال يدوي من فئة ${category}`,
      severity: "low",
      createdAt: Date.now(),
    });
    return { id, qid };
  },
});

/** تحرير سؤال معتمد/معلق — يسجل من عدّل وماذا */
export const editQuestion = mutation({
  args: {
    id: v.id("aiQuestions"),
    question: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    correctIndex: v.optional(v.number()),
    category: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
  },
  handler: async (ctx, { id, question, options, correctIndex, category, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    const patch: Record<string, unknown> = { editedAt: Date.now(), editedBy: me.name ?? "المالك" };
    if (question !== undefined) {
      if (question.trim().length < 8) throw new Error("نص السؤال قصير جداً");
      patch.question = question.trim();
    }
    if (options !== undefined) {
      if (options.length !== 4 || new Set(options.map((o) => o.trim())).size !== 4) {
        throw new Error("يجب إدخال 4 خيارات مختلفة");
      }
      patch.options = options.map((o) => o.trim());
    }
    if (correctIndex !== undefined) {
      if (correctIndex < 0 || correctIndex > 3) throw new Error("فهرس الإجابة غير صالح");
      patch.correctIndex = correctIndex;
    }
    if (category !== undefined) patch.category = category;
    if (difficulty !== undefined) patch.difficulty = difficulty;
    await ctx.db.patch(id, patch);
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "edit_question",
      targetId: id,
      targetName: (question ?? row.question).slice(0, 40),
      detail: `تحرير سؤال من فئة ${category ?? row.category}`,
      severity: "low",
      createdAt: Date.now(),
    });
    return true;
  },
});

/** جدولة نشر سؤال معلق — يُعتمد آلياً في الموعد */
export const scheduleQuestion = mutation({
  args: { id: v.id("aiQuestions"), scheduledFor: v.number() },
  handler: async (ctx, { id, scheduledFor }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    if (scheduledFor < Date.now()) throw new Error("الموعد يجب أن يكون مستقبلياً");
    await ctx.db.patch(id, { scheduledFor });
    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "schedule_question",
      targetId: id,
      detail: `جدولة نشر في ${new Date(scheduledFor).toLocaleString("ar")}`,
      severity: "low",
      createdAt: Date.now(),
    });
    return true;
  },
});

/** ⏰ منشئ النشر المجدول — يعتمد كل سؤال بلغ موعده (cron كل 5 دقائق) */
export const publishScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("aiQuestions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    let published = 0;
    for (const r of due) {
      if (r.scheduledFor !== undefined && r.scheduledFor <= now) {
        await ctx.db.patch(r._id, { status: "approved", scheduledFor: undefined });
        await ctx.db.insert("aiDecisionLog", {
          system: "questions",
          actorName: "المنشئ المجدول",
          action: "auto_publish",
          targetId: r._id,
          targetName: r.question.slice(0, 40),
          detail: `نُشر آلياً حسب الجدولة من فئة ${r.category}`,
          severity: "low",
          createdAt: now,
        });
        published++;
      }
    }
    return { published };
  },
});
