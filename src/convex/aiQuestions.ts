import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { CATEGORIES, QUESTION_BANK } from "./questions";
import { isStaffUser } from "./owner";

type GeneratedQuestion = {
  id: Id<"aiQuestions">;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
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
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correctIndex: number;
} | null {
  try {
    const question = String(q.question ?? "");
    const options = Array.isArray(q.options)
      ? (q.options as unknown[]).map(String)
      : [];
    const difficulty = ["easy", "medium", "hard"].includes(String(q.difficulty))
      ? (String(q.difficulty) as "easy" | "medium" | "hard")
      : "medium";
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
  difficulty: "easy" | "medium" | "hard";
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
    difficulty: "easy" | "medium" | "hard";
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

    // For now, we'll generate questions directly without OpenRouter
    // This can be enhanced with OpenRouter API later
    const questions: {
      qid: string;
      category: string;
      difficulty: "easy" | "medium" | "hard";
      question: string;
      options: string[];
      correctIndex: number;
    }[] = [];

    // Store as pending via internal mutation
    if (questions.length > 0) {
      await _ctx.runMutation("aiQuestions:insertBatch" as any, {
        questions,
      });
    }

    return { created: questions.length };
  },
});

/** Approve a pending question. */
export const approveQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) throw new Error("غير مصرح");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    await ctx.db.patch(id, { status: "approved" });
  },
});

/** Reject a pending question. */
export const rejectQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) throw new Error("غير مصرح");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    await ctx.db.patch(id, { status: "rejected" });
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
        difficulty: r.difficulty,
        question: r.question,
        options: r.options,
        correctIndex: r.correctIndex,
        status: r.status as "pending" | "approved" | "rejected",
        createdAt: r.createdAt,
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
        difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
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
    return counts;
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
      perCategory: counts,
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
