import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { CATEGORIES, QUESTION_BANK, type Difficulty, type Question } from "./questions";
import {
  getSettingsData,
  isStaffUser,
  setSetting,
  type ModSettings,
} from "./owner";

// ---------------------------------------------------------------------------
// «مولّد الأسئلة الذكي» — ذكاء اصطناعي يملأ بنك الأسئلة تلقائياً.
//
// الفكرة: بنك الأسئلة الثابت في الكود قد يضعف في بعض الفئات مع تكرار اللعب.
// هذا النظام يستخدم مفتاح OpenRouter نفسه (OPENROUTER_API_KEY) ليولّد أسئلة
// جديدة من أي فئة، يتحقق منها بصرامة (4 خيارات، إجابة واحدة صحيحة، بلا تكرار)،
// ويضعها في طابور مراجعة بغرفة المالك. ما يوافق عليه المالك يدخل الجولات فوراً.
//
// المدير الآلي (كل 15 دقيقة) يراقب صحة البنك: إن وجد فئة ضعيفة (أقل من حد معين)
// يولّد دفعة جديدة تلقائياً — بلا أي تدخل بشري.
// ---------------------------------------------------------------------------

/** الحد الأدنى من الأسئلة النشطة لكل فئة قبل أن يطلب المدير الآلي توليد دفعة. */
export const MIN_QUESTIONS_PER_CATEGORY = 12;
/** كم سؤالاً يولّد المدير الآلي في الدفعة الواحدة تلقائياً. */
export const AUTO_REFILL_COUNT = 6;
/** مهلة بين عمليات التوليد التلقائي (لا نريد حرق الرصيد كل 15 دقيقة). */
export const REFILL_COOLDOWN_MS = 6 * 60 * 60 * 1000; // مرة كل 6 ساعات
/** السقف الأقصى للتوليد اليدوي من غرفة المالك. */
export const MAX_MANUAL_COUNT = 15;

export type GeneratedQuestion = {
  id: Id<"aiQuestions">;
  category: string;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correctIndex: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQid(): string {
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .padStart(4, "0");
  return `ai-${Date.now().toString(36)}${rand}`;
}

function normalize(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[«»"“”'‘’]/g, "")
    .toLowerCase();
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Validate one AI-produced question against the strict game contract. */
function parseGeneratedQuestion(
  raw: unknown,
  category: string,
): Question | null {
  if (typeof raw !== "object" || raw === null) return null;
  const q = raw as Record<string, unknown>;
  const question = typeof q.question === "string" ? q.question.trim() : "";
  if (question.length < 5 || question.length > 200) return null;

  const optionsRaw = q.options;
  if (!Array.isArray(optionsRaw) || optionsRaw.length !== 4) return null;
  const options = optionsRaw.map((o) => (typeof o === "string" ? o.trim() : ""));
  if (options.some((o) => o.length < 1 || o.length > 60)) return null;
  if (new Set(options.map(normalize)).size !== 4) return null;

  const correctIndex = q.correctIndex;
  if (
    typeof correctIndex !== "number" ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex > 3
  ) {
    return null;
  }

  const difficulty = q.difficulty;
  if (
    typeof difficulty !== "string" ||
    !(DIFFICULTIES as string[]).includes(difficulty)
  ) {
    return null;
  }

  return {
    id: makeQid(),
    category,
    difficulty: difficulty as Difficulty,
    question,
    options: options as [string, string, string, string],
    correctIndex: correctIndex as 0 | 1 | 2 | 3,
  };
}

/** Robust JSON extraction + parsing of the LLM's question batch. */
export function parseGeneratedQuestions(
  raw: string,
  category: string,
): Question[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("الرد لم يحتوِ على JSON");
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    questions?: unknown[];
  };
  if (!Array.isArray(parsed.questions)) {
    throw new Error("الرد لا يحتوي على مصفوفة أسئلة");
  }
  const valid = parsed.questions
    .map((q) => parseGeneratedQuestion(q, category))
    .filter((q): q is Question => q !== null);
  if (valid.length === 0) {
    throw new Error("لم يُنتج الذكاء الاصطناعي أي سؤال صالح");
  }
  return valid;
}

/** Shared generation call — used by the manual action and the auto-admin. */
async function generateQuestionsWithAi(
  ctx: {
    runQuery: (query: any, args: any) => Promise<any>;
    runMutation: (mutation: any, args: any) => Promise<any>;
  },
  apiKey: string,
  model: string,
  category: string,
  count: number,
): Promise<Question[]> {
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error("فئة غير معروفة");
  }
  const boundedCount = Math.max(1, Math.min(count, MAX_MANUAL_COUNT));

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://nabaha.freebuff.app",
      "X-Title": "نباهة",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `أنت مولّد أسئلة لعبة «نباهة» — لعبة تحديات تنافسية بين الأصدقاء بالعربية.
اكتب ${boundedCount} أسئلة معلومات عامة جديدة تماماً وممتعة من فئة «${category}».
الشروط:
- كل سؤال له 4 خيارات (options) إجابة واحدة منها صحيحة فقط، والباقي مقنع وقريب.
- الصعوبة (difficulty) واحدة من: easy أو medium أو hard — نزّعها بين السهلة والمتوسطة مع سؤال صعب.
- يجب ألا تتكرر الأسئلة مع أي سؤال معروف شائع.
- أجب بترجيع JSON فقط بالشكل:
{"questions":[{"question":"...","options":["أ","ب","ج","د"],"correctIndex":0,"difficulty":"easy"}]}
لا تكتب أي نص خارج JSON.`,
        },
        { role: "user", content: `ولّد ${boundedCount} أسئلة من فئة «${category}».` },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter فشل: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter لم يُرجع رداً");

  const questions = parseGeneratedQuestions(text, category);

  // منع التكرار مع البنك الحالي ومع الأسئلة المولّدة سابقاً.
  const texts = (await ctx.runQuery(
    internal.aiQuestions.getExistingQuestionTexts,
    {},
  )) as string[];
  const seen = new Set(texts);
  const fresh = questions.filter((q) => !seen.has(normalize(q.question)));
  return fresh.slice(0, boundedCount);
}

async function requireStaffId(ctx: MutationCtx): Promise<string | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const me = await ctx.db.get(userId);
  if (!isStaffUser(me)) return null;
  return userId;
}

// ---------------------------------------------------------------------------
// Owner-facing API
// ---------------------------------------------------------------------------

/** توليد دفعة أسئلة جديدة من فئة معينة (غرفة المالك — زر يدوي). */
export const generateQuestions = action({
  args: { category: v.string(), count: v.number() },
  handler: async (ctx, { category, count }) => {
    const staff = await ctx.runQuery(internal.aiQuestions.getStaffForGen, {});
    if (!staff) throw new Error("غير مصرح — صلاحية المشرفين مطلوبة");

    const settings = (await ctx.runQuery(
      internal.aiQuestions.getSettingsForRefill,
      {},
    )) as ModSettings;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "مفتاح OpenRouter غير مضبوط — أضِفه في تبويب المفاتيح (OPENROUTER_API_KEY)",
      );
    }

    const generated = await generateQuestionsWithAi(
      ctx,
      apiKey,
      settings.aiModel,
      category,
      count,
    );
    if (generated.length === 0) {
      throw new Error("كل الأسئلة المولّدة مكررة أو غير صالحة — جرّب فئة أخرى");
    }

    const now = Date.now();
    await ctx.runMutation(internal.aiQuestions.insertBatch, {
      questions: generated.map((q) => ({
        qid: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        status: "pending" as const,
        createdAt: now,
      })),
    });

    await ctx.runMutation(internal.aiQuestions.logGeneration, {
      category,
      count: generated.length,
      actor: staff.name,
      auto: false,
    });

    return { created: generated.length };
  },
});

/** الموافقة على سؤال مولّد → يدخل الجولات فوراً. */
export const approveQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await requireStaffId(ctx);
    if (!userId) throw new Error("غير مصرح — صلاحية المشرفين مطلوبة");
    const row = await ctx.db.get(id);
    if (!row) throw new Error("السؤال غير موجود");
    await ctx.db.patch(id, { status: "approved" });
  },
});

/** رفض سؤال مولّد — لا يدخل الجولات الجديدة. */
export const rejectQuestion = mutation({
  args: { id: v.id("aiQuestions") },
  handler: async (ctx, { id }) => {
    const userId = await requireStaffId(ctx);
    if (!userId) throw new Error("غير مصرح — صلاحية المشرفين مطلوبة");
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

    const perCategory: Record<string, number> = {};
    // النشط لكل فئة = البنك الثابت + الأسئلة المولّدة المعتمدة.
    for (const c of CATEGORIES) {
      perCategory[c] = QUESTION_BANK.filter((q) => q.category === c).length;
    }
    for (const r of rows) {
      if (r.status === "approved") {
        perCategory[r.category] = (perCategory[r.category] ?? 0) + 1;
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
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { questions }) => {
    for (const q of questions) {
      await ctx.db.insert("aiQuestions", q);
    }
  },
});

export const logGeneration = internalMutation({
  args: {
    category: v.string(),
    count: v.number(),
    actor: v.string(),
    auto: v.boolean(),
  },
  handler: async (ctx, { category, count, actor, auto }) => {
    await ctx.db.insert("moderationLogs", {
      actorType: auto ? "ai" : "owner",
      actorName: auto ? "مولّد الأسئلة الذكي" : actor,
      action: auto ? "ai_generate_questions" : "generate_questions",
      targetName: `فئة ${category}`,
      reason: `توليد ${count} سؤالاً جديداً في فئة «${category}» ${
        auto ? "تلقائياً (فئة ضعيفة)" : "يدوياً من غرفة المالك"
      } — بانتظار المراجعة.`,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

/** Approved AI questions in a shape games can merge into the question pool. */
export const getApprovedAiQuestions = internalQuery({
  args: {},
  handler: async (ctx): Promise<Question[]> => {
    const rows = await ctx.db
      .query("aiQuestions")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    return rows.map((r) => ({
      id: r.qid,
      category: r.category,
      difficulty: r.difficulty,
      question: r.question,
      options: r.options as [string, string, string, string],
      correctIndex: r.correctIndex as 0 | 1 | 2 | 3,
    }));
  },
});

/** كل نصوص الأسئلة الموجودة (الثابتة + المولّدة) — لمنع التكرار عند التوليد. */
export const getExistingQuestionTexts = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const texts = QUESTION_BANK.map((q) => normalize(q.question));
    const rows = await ctx.db.query("aiQuestions").collect();
    for (const r of rows) texts.push(normalize(r.question));
    return texts;
  },
});

/** آخر عملية توليد تلقائي (للحد من تكرارها). */
export const getLastAutoRefillAt = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "aiQuestionRefillAt"))
      .first();
    if (!row) return null;
    try {
      return Number(JSON.parse(row.value));
    } catch {
      return null;
    }
  },
});

export const recordAutoRefillAt = internalMutation({
  args: { at: v.number() },
  handler: async (ctx, { at }) => {
    await setSetting(ctx, "aiQuestionRefillAt", at);
  },
});

/**
 * دورة التوليد التلقائي — يدعوها المدير الآلي كل 15 دقيقة.
 * إن وُجدت فئة تحت الحد الأدنى وجرت آخر عملية منذ أكثر من المهلة،
 * يولّد دفعة جديدة ويسجلها في طابور المراجعة. لا تكلف شيئاً إن كان
 * البنك سليماً أو لم يمضِ وقت كافٍ.
 */
export const autoRefillWeakCategory = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    ok: boolean;
    reason?: string;
    category?: string;
    count?: number;
  }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { ok: false, reason: "no_key" };

    const settings = (await ctx.runQuery(
      internal.aiQuestions.getSettingsForRefill,
      {},
    )) as ModSettings;
    if (!settings.aiAdminEnabled) return { ok: false, reason: "admin_off" };

    const lastAt = (await ctx.runQuery(
      internal.aiQuestions.getLastAutoRefillAt,
      {},
    )) as number | null;
    if (lastAt && Date.now() - lastAt < REFILL_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown" };
    }

    // عدّ النشط لكل فئة (ثابت + معتمد) واختر الأضعف.
    const counts = (await ctx.runQuery(
      internal.aiQuestions.getActiveCounts,
      {},
    )) as Record<string, number>;
    const weak = CATEGORIES.filter(
      (c) => (counts[c] ?? 0) < MIN_QUESTIONS_PER_CATEGORY,
    ).sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0));
    if (weak.length === 0) {
      return { ok: false, reason: "healthy" };
    }

    const category = weak[0];
    const generated = await generateQuestionsWithAi(
      ctx,
      apiKey,
      settings.aiModel,
      category,
      AUTO_REFILL_COUNT,
    );
    if (generated.length === 0) {
      return { ok: false, reason: "all_duplicates" };
    }

    const now = Date.now();
    await ctx.runMutation(internal.aiQuestions.insertBatch, {
      questions: generated.map((q) => ({
        qid: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        status: "pending" as const,
        createdAt: now,
      })),
    });
    await ctx.runMutation(internal.aiQuestions.logGeneration, {
      category,
      count: generated.length,
      actor: "المدير الآلي",
      auto: true,
    });
    await ctx.runMutation(internal.aiQuestions.recordAutoRefillAt, { at: now });

    return { ok: true, category, count: generated.length };
  },
});

export const getSettingsForRefill = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getSettingsData(ctx);
  },
});

/** النشط لكل فئة = البنك الثابت + الأسئلة المولّدة المعتمدة. */
export const getActiveCounts = internalQuery({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const c of CATEGORIES) {
      counts[c] = QUESTION_BANK.filter((q) => q.category === c).length;
    }
    const rows = await ctx.db
      .query("aiQuestions")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    for (const r of rows) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return counts;
  },
});
