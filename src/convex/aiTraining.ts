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
import { CATEGORIES, QUESTION_BANK } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { DIFFICULTY_LABELS, type Difficulty } from "../lib/question-difficulty";

/**
 * 🎓 مدرسة العقول (Minds Academy)
 *
 * مسار تدريب شخصي مدعوم بالذكاء الاصطناعي — الأداة التي تحوّل بيانات اللعب
 * إلى تحسّن حقيقي:
 *  1) التشخيص: يقرأ إتقان اللاعب الحقيقي (mindSpecializations + categoryHistory)
 *     ويكتشف نقطة الضعف الأهم — الفئة الأضعف ذات العيّنة الكافية.
 *  2) بناء الجلسة: يجمع أسئلة تدريب من البنك أولاً (مجاناً وفورياً)،
 *     وإن نقصت يولّد الباقي بالذكاء الاصطناعي على مستوى الصعوبة المناسب —
 *     وهو «درس متدرج»: يبدأ أسهل من مستوى فشله وينتهي عنده.
 *  3) التقدم: كل إجابة تُحسب داخل الجلسة، وعند الإكمال تُحدَّث مقارنة
 *     «الإتقان قبل/بعد» فيُرى أثر التدريب فعلياً.
 *  4) لا تكلفة زائدة: التوليد الذكي فقط عند نقص أسئلة البنك، ومحدود بالحد الأقصى.
 */

const BANK_TRAINING_TARGET = 6; // أسئلة الجلسة المستهدفة
const MAX_GENERATED = 4; // أقصى أسئلة مولّدة ذكياً في جلسة واحدة
const MIN_SAMPLE = 3; // أقل عيّنة لاعتبار الفئة مقيسة
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // الجلسة تنتهي بعد يوم

// ── 1) التشخيص: أين نقطة الضعف الحقيقية؟ ────────────────────────────────

export const getTrainingPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const specs = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const cats = specs
      .map((s) => ({
        category: s.category,
        mastery: Math.round(s.mastery),
        total: s.total,
        correct: s.correct,
        level: s.level,
      }))
      .sort((a, b) => a.mastery - b.mastery);

    // جلسة نشطة قائمة؟
    const active = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();

    // جلسات مكتملة حديثاً — لإظهار أثر التدريب
    const recentDone = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const completed = recentDone
      .filter((s) => s.status === "completed")
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3)
      .map((s) => ({
        category: s.category,
        correct: s.correct ?? 0,
        total: s.total ?? 0,
        masteryBefore: s.masteryBefore ?? 0,
        masteryAfter: s.masteryAfter ?? 0,
        completedAt: s.completedAt ?? 0,
      }));

    // نقاط الضعف: مقيسة وذات أولوية (أدنى إتقان)
    const measured = cats.filter((c) => c.total >= MIN_SAMPLE);
    const weakest = measured[0] ?? null;
    const strongest = measured.length > 0 ? measured[measured.length - 1] : null;

    return {
      categories: cats,
      weakest,
      strongest,
      measuredCount: measured.length,
      activeSession: active
        ? {
            _id: active._id,
            category: active.category,
            difficulty: active.difficulty,
            questionIds: active.questionIds,
            source: active.source ?? "bank",
            createdAt: active.createdAt,
          }
        : null,
      completed,
    };
  },
});

// ── 2) بدء جلسة تدريب (بناء الأسئلة + توليد ذكي عند الحاجة) ─────────────

export const startSession = action({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    const actor = (await ctx.runQuery("aiTraining:getActor" as any, {})) as {
      userId: Id<"users">;
    } | null;
    if (!actor) throw new Error("يجب تسجيل الدخول أولاً");
    const userId = actor.userId;

    // جلسة نشطة؟ لا نضاعف
    const existing = (await ctx.runQuery(
      "aiTraining:getActiveSessionInternal" as any,
      { userId },
    )) as { _id: Id<"trainingSessions">; category: string } | null;
    if (existing) {
      return { sessionId: existing._id, category: existing.category, created: false as const };
    }

    await ensureAiRuntime(ctx);

    // الفئة المستهدفة: المطلوبة أو أضعف فئة مقيسة
    const diag = (await ctx.runQuery("aiTraining:getWeakestInternal" as any, {
      userId,
      category,
    })) as {
      category: string;
      mastery: number;
      total: number;
      bankAvailable: number;
      byDiff: Record<string, number>;
    } | null;
    if (!diag) {
      throw new Error("العب جولات أولاً — نحتاج بيانات حقيقية لتشخيص نقطة ضعفك");
    }

    // درس متدرج: نصف الأسئلة أسهل من مستوى فشله، والباقي عنده
    const mastery = diag.mastery;
    const targetDifficulty: Difficulty =
      mastery >= 75 ? "hard" : mastery >= 50 ? "medium" : "easy";

    // أسئلة البنك أولاً — مجانية وفورية
    const picked = (await ctx.runQuery("aiTraining:pickBankQuestions" as any, {
      category: diag.category,
      targetDifficulty,
      need: BANK_TRAINING_TARGET,
    })) as { ids: string[]; usedDifficulties: string[] };

    let questionIds = picked.ids;
    const usedDifficulties = [...picked.usedDifficulties];
    let source = "bank";
    let generated = 0;

    // نقص؟ ولّد الذكاء الباقي (محدود)
    const missing = BANK_TRAINING_TARGET - questionIds.length;
    if (missing > 0 && missing <= MAX_GENERATED) {
      const hasKey = getOpenRouterKey();
      if (hasKey) {
        try {
          const raw = await callLlm(
            [
              {
                role: "system",
                content: `أنت مدرّب أسئلة للعبة "حرب العقول". أنشئ أسئلة تدريب في فئة "${diag.category}" بالعربية الفصحى لمستوى "${DIFFICULTY_LABELS[targetDifficulty]}" (صعوبة تقنية: ${targetDifficulty}). لكل سؤال: نص واضح + 4 خيارات + مؤشر الإجابة (0-3). لا تكرر أسئلة معروفة جداً. أجب JSON حصراً: [{"question":"...","options":["...","...","...","..."],"correctIndex":0,"difficulty":"${targetDifficulty}"}]`,
              },
              {
                role: "user",
                content: `أنشئ ${missing} أسئلة تدريب عن "${diag.category}" — ركّز على المفاهيم التي يتدرب عليها لاعب إتقانه ${mastery}%.`,
              },
            ],
            1000,
            0.7,
            "MindClash Minds Academy",
          );
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const arr = JSON.parse(match[0]) as Record<string, unknown>[];
            const clean = arr
              .map((q) => {
                const question = String(q.question ?? "").trim();
                const options = Array.isArray(q.options)
                  ? (q.options as unknown[]).map(String).filter((o) => o.trim())
                  : [];
                const correctIndex =
                  typeof q.correctIndex === "number" ? q.correctIndex : 0;
                if (!question || options.length !== 4 || correctIndex < 0 || correctIndex > 3) {
                  return null;
                }
                return {
                  qid: `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  category: diag.category,
                  difficulty: targetDifficulty,
                  question,
                  options: options.slice(0, 4),
                  correctIndex,
                };
              })
              .filter((q): q is NonNullable<typeof q> => q !== null)
              .slice(0, missing);
            if (clean.length > 0) {
              // أسئلة التدريب تُولد معتمدة مباشرة (جلسة خاصة باللاعب، ليست بنكاً عاماً)
              await ctx.runMutation("aiQuestions:insertBatch" as any, {
                questions: clean.map((q) => ({ ...q, difficulty: targetDifficulty })),
                actor: "مدرسة العقول",
              });
              // اعتمادها فوراً كي لا تنتظر مراجعة (جلسة تدريب خاصة لا تدخل بنك الآخرين عبر هذه الجلسة)
              const approved = clean.map((q) => q.qid);
              await ctx.runMutation("aiTraining:approveGeneratedInternal" as any, { qids: approved });
              questionIds = [...questionIds, ...approved];
              for (const _q of clean) usedDifficulties.push(targetDifficulty);
              generated = clean.length;
              source = generated >= BANK_TRAINING_TARGET ? "generated" : "mixed";
            }
          }
        } catch {
          // فشل التوليد؟ أكمل بما تيسر من البنك — الجلسة لا تنكسر
        }
      }
    }

    if (questionIds.length === 0) {
      throw new Error("لا توجد أسئلة تدريب متاحة لهذه الفئة حالياً");
    }

    const sessionId = (await ctx.runMutation("aiTraining:createSession" as any, {
      userId,
      category: diag.category,
      difficulty: targetDifficulty,
      questionIds,
      masteryBefore: mastery,
      source,
    })) as Id<"trainingSessions">;

    return {
      sessionId,
      category: diag.category,
      created: true as const,
      questions: questionIds.length,
      generated,
      targetDifficulty,
    };
  },
});

// ── 3) عمليات داخلية ────────────────────────────────────────────────────

export const getActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return { userId };
  },
});

export const getActiveSessionInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("trainingSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
  },
});

export const getWeakestInternal = internalQuery({
  args: { userId: v.id("users"), category: v.optional(v.string()) },
  handler: async (ctx, { userId, category }) => {
    const specs = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const measured = specs
      .filter((s) => s.total >= MIN_SAMPLE)
      .sort((a, b) => a.mastery - b.mastery);
    const target =
      (category ? specs.find((s) => s.category === category) : null) ?? measured[0];
    if (!target) return null;

    // توفر أسئلة البنك لكل درجة في هذه الفئة
    const byDiff: Record<string, number> = { easy: 0, medium: 0, hard: 0, extreme: 0 };
    for (const q of QUESTION_BANK) {
      if (q.category === target.category) {
        byDiff[q.difficulty] = (byDiff[q.difficulty] ?? 0) + 1;
      }
    }
    // درجة التدريب المستهدفة تُحدد لاحقاً في startSession من مستوى الإتقان
    return {
      category: target.category,
      mastery: target.mastery,
      total: target.total,
      bankAvailable: Math.max(byDiff.easy, byDiff.medium, byDiff.hard),
      byDiff,
    };
  },
});

export const pickBankQuestions = internalQuery({
  args: {
    category: v.string(),
    targetDifficulty: v.string(),
    need: v.number(),
  },
  handler: async (_ctx, { category, targetDifficulty, need }) => {
    // درس متدرج: نصف أسهل (أو نفس المستوى إن كان easy)، والنصف عنده
    const ladder: Record<string, string[]> = {
      easy: ["easy", "easy", "easy"],
      medium: ["easy", "medium", "medium"],
      hard: ["medium", "hard", "hard"],
      extreme: ["hard", "extreme", "extreme"],
    };
    const mix = ladder[targetDifficulty] ?? ["medium", "medium", "medium"];

    const ids: string[] = [];
    const usedDifficulties: string[] = [];
    const used = new Set<string>();
    for (const diff of mix) {
      const pool = QUESTION_BANK.filter(
        (q) => q.category === category && q.difficulty === diff && !used.has(q.id),
      );
      // خذ ما يلزم من هذا الدرج
      const take = Math.max(1, Math.floor(need / mix.length));
      for (const q of pool.sort(() => Math.random() - 0.5).slice(0, take)) {
        if (ids.length < need) {
          ids.push(q.id);
          used.add(q.id);
          usedDifficulties.push(q.difficulty);
        }
      }
    }
    // املأ العجز من أي درجة متاحة في الفئة
    if (ids.length < need) {
      const pool = QUESTION_BANK.filter(
        (q) => q.category === category && !used.has(q.id),
      );
      for (const q of pool.sort(() => Math.random() - 0.5)) {
        if (ids.length >= need) break;
        ids.push(q.id);
        used.add(q.id);
        usedDifficulties.push(q.difficulty);
      }
    }
    return { ids, usedDifficulties };
  },
});

export const approveGeneratedInternal = internalMutation({
  args: { qids: v.array(v.string()) },
  handler: async (ctx, { qids }) => {
    const now = Date.now();
    for await (const row of ctx.db.query("aiQuestions")) {
      if (qids.includes(row.qid) && row.status === "pending") {
        await ctx.db.patch(row._id, { status: "approved" });
      }
    }
  },
});

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    category: v.string(),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard"),
      v.literal("extreme"),
    ),
    questionIds: v.array(v.string()),
    masteryBefore: v.number(),
    source: v.string(),
  },
  handler: async (ctx, a) => {
    // أرشف الجلسات المنتهية
    const stale = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", a.userId).eq("status", "active"))
      .collect();
    const now = Date.now();
    for (const s of stale) {
      if (now - s.createdAt > SESSION_TTL_MS) {
        await ctx.db.patch(s._id, { status: "expired" });
      }
    }
    return await ctx.db.insert("trainingSessions", {
      userId: a.userId,
      category: a.category,
      difficulty: a.difficulty,
      questionIds: a.questionIds,
      status: "active",
      masteryBefore: a.masteryBefore,
      source: a.source,
      createdAt: now,
    });
  },
});

// ── 4) إكمال الجلسة وتحديث الإتقان ──────────────────────────────────────

export const completeSession = mutation({
  args: {
    sessionId: v.id("trainingSessions"),
    correct: v.number(),
    total: v.number(),
  },
  handler: async (ctx, { sessionId, correct, total }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("الجلسة غير موجودة");
    if (session.userId !== userId) throw new Error("غير مصرح");
    if (session.status !== "active") throw new Error("الجلسة منتهية بالفعل");

    // إتقان الفئة الآن (بعد التدريب)
    const spec = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user_cat", (q) =>
        q.eq("userId", userId).eq("category", session.category),
      )
      .first();

    await ctx.db.patch(sessionId, {
      status: "completed",
      correct,
      total,
      masteryAfter: spec ? Math.round(spec.mastery) : undefined,
      completedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** جلب أسئلة الجلسة للعرض — يقرؤه مكوّن التدريب. */
export const getSessionQuestions = query({
  args: { sessionId: v.id("trainingSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return null;
    if (session.status !== "active") return null;

    // اجمع الأسئلة: من البنك الثابت ومن aiQuestions المعتمدة
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const questions: {
      id: string;
      question: string;
      options: string[];
      correctIndex: number;
      difficulty: string;
    }[] = [];
    const missing: string[] = [];
    for (const qid of session.questionIds) {
      const fromBank = bankMap.get(qid);
      if (fromBank) {
        questions.push({
          id: fromBank.id,
          question: fromBank.question,
          options: [...fromBank.options],
          correctIndex: fromBank.correctIndex,
          difficulty: fromBank.difficulty,
        });
      } else {
        missing.push(qid);
      }
    }
    if (missing.length > 0) {
      for await (const row of ctx.db.query("aiQuestions")) {
        if (missing.includes(row.qid) && row.status === "approved") {
          questions.push({
            id: row.qid,
            question: row.question,
            options: row.options,
            correctIndex: row.correctIndex,
            difficulty: row.difficulty,
          });
        }
      }
    }
    return {
      session: {
        _id: session._id,
        category: session.category,
        difficulty: session.difficulty,
        masteryBefore: session.masteryBefore ?? 0,
        source: session.source ?? "bank",
        createdAt: session.createdAt,
      },
      questions,
    };
  },
});
