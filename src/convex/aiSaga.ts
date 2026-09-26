import { v } from "convex/values";
import {
  action,
  type ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK, CATEGORIES } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";
import { DIFFICULTY_LABELS, type Difficulty } from "../lib/question-difficulty";

/**
 * 📖 ملحمة العقول (Minds Saga)
 *
 * الأداة الأخيرة والأجرأ: تحويل «لعبة أسئلة» إلى **مغامرة سردية حية**.
 *
 * الفكرة: بدل جولة أسئلة عادية، يعيش اللاعب قصة يولّدها الذكاء الاصطناعي
 * خصيصاً له — عالمها مستوحى من أقوى فئاته، وتحدياتها من نقاط ضعفه. في كل
 * فصل: مشهد درامي + 3 أبواب اختيار، وكل باب **محكوم بسؤال حقيقي**:
 *  - باب المجد: سؤال في فئتك القوية → نجاح يمنح مجداً كبيراً
 *  - باب الغموض: سؤال في فئة ضعفك → مكافأة أكبر لكن أخطر
 *  - باب الرهان: سؤال «شبه مستحيل» → مجد أسطوري أو جرح عميق
 *
 * إذا فشل سؤال البوابة، يتحقق ما حذّرت منه الحكاية — بلا رحمة ميلودرامية.
 * الملحمة من 5 فصول، ولقب نهايتك يتغير بحسب مجدك النهائي.
 *
 * هنا تلتقي كل الأدوات: البنك هو سلاحك، صعوبته معايَرة، وسرد المعلق يكتب
 * مشاهد الملحمة، وحكمته درس من المدرسة — لكن التجربة واحدة متصلة.
 */

const TOTAL_CHAPTERS = 5;
const GLORY_MAX = 100;

// ── 1) بدء ملحمة جديدة (شخصية تُبنى من بيانات اللاعب) ───────────────────

export const startSaga = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiSaga:getPlayerContext" as any, {})) as {
      userId: Id<"users">;
      name: string;
      strongCategory: string;
      weakCategory: string;
    } | null;
    if (!me) throw new Error("يجب تسجيل الدخول أولاً");

    // ملحمة نشطة؟ لا مضاعفة
    const active = (await ctx.runQuery("aiSaga:getActiveRunInternal" as any, {
      userId: me.userId,
    })) as { _id: Id<"sagaRuns"> } | null;
    if (active) return { created: false as const, runId: active._id };

    await ensureAiRuntime(ctx);

    // توليد المشهد الأول + الأبواب
    const chapter1 = await generateChapter(ctx, {
      heroName: me.name,
      strongCategory: me.strongCategory,
      weakCategory: me.weakCategory,
      chapterIndex: 0,
      glory: 50,
      pathSummary: "بداية الرحلة",
    });

    const runId = (await ctx.runMutation("aiSaga:createRun" as any, {
      userId: me.userId,
      heroName: me.name,
      theme: `عالم ${me.strongCategory} و${me.weakCategory}`,
      totalChapters: TOTAL_CHAPTERS,
      firstChapter: chapter1,
    })) as Id<"sagaRuns">;

    return { created: true as const, runId, chapter: chapter1 };
  },
});

// ── 2) محرك توليد الفصول ───────────────────────────────────────────────

type ChapterDraft = {
  scene: string;
  choices: {
    key: string;
    text: string;
    gateDifficulty: Difficulty;
    gateCategory: string;
    gloryReward: number;
    riskNote: string;
  }[];
};

async function generateChapter(
  ctx: ActionCtx,
  args: {
    heroName: string;
    strongCategory: string;
    weakCategory: string;
    chapterIndex: number;
    glory: number;
    pathSummary: string;
  },
): Promise<ChapterDraft> {
  const { heroName, strongCategory, weakCategory, chapterIndex, glory } = args;
  const isFinal = chapterIndex === TOTAL_CHAPTERS - 1;

  // أبواب الفصل: ثلاث صعوبات دائماً — المجد/الغموض/الرهان
  const gloryReward = (d: Difficulty) => (d === "easy" ? 8 : d === "medium" ? 15 : d === "hard" ? 22 : 35);

  const fallback: ChapterDraft = {
    scene: isFinal
      ? `يقف ${heroName} أمام بوابة المصير النهائية. كل خطوة سابقة قادته إلى هنا — والملحمة تُحسم الآن.`
      : `يتقدم ${heroName} في عالم ${strongCategory} الغريب. في أمامه ثلاثة دروب، وكل درب يشترط إثبات العقل قبل العبور.`,
    choices: [
      { key: "a", text: `درب ${strongCategory} المألوف — أرضك التي تثق بها`, gateDifficulty: "easy", gateCategory: strongCategory, gloryReward: gloryReward("easy"), riskNote: "خسارة مجد بسيطة إن أخفقت" },
      { key: "b", text: `درب ${weakCategory} الغامض — حيث مكافأة الأبطال`, gateDifficulty: "hard", gateCategory: weakCategory, gloryReward: gloryReward("hard"), riskNote: "جرح مؤكد إن أخفقت" },
      { key: "c", text: `درب الأسطورة — سؤال لا يعبره إلا العقل النادر`, gateDifficulty: "extreme", gateCategory: strongCategory, gloryReward: gloryReward("extreme"), riskNote: "مجد أسطوري أو سقوط من الهاوية" },
    ],
  };

  if (!getOpenRouterKey()) return fallback;

  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content: `أنت راوي ملحمة تفاعلية عربية ملحمي الأسلوب (بأسلوب سيد الزنزانة لكن فصيحاً مشوّقاً). البطل "${heroName}" يملك قوة في "${strongCategory}" وضعفاً في "${weakCategory}". هذه الفقرة فصل ${chapterIndex + 1} من ${TOTAL_CHAPTERS}${isFinal ? " — الفصل الأخير، الحسم النهائي" : ""}. مجد البطل الحالي: ${glory}/${GLORY_MAX}. خلاصة رحلته: ${args.pathSummary}. اكتب مشهد قصير مشوّق (3-4 أسطر) + ثلاثة أبواب اختيار بثلاث صعوبات (easy/medium أو hard/extreme). الأبواب يجب أن تكون متنوعة الدراما: أمان، مخاطرة، جنون. أجب JSON حصراً: {"scene":"...","choices":[{"key":"a","text":"...","gateDifficulty":"easy","gateCategory":"${strongCategory}","riskNote":"..."},{"key":"b","text":"...","gateDifficulty":"hard","gateCategory":"${weakCategory}","riskNote":"..."},{"key":"c","text":"...","gateDifficulty":"extreme","gateCategory":"...","riskNote":"..."}]} gateCategory يجب أن تكون إحدى: ${CATEGORIES.slice(0, 8).join("، ")}...`,
        },
      ],
      900,
      0.9,
      "MindClash Minds Saga",
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as Record<string, unknown>;
      if (typeof obj.scene === "string" && obj.scene.trim().length > 30 && Array.isArray(obj.choices)) {
        const valid = (obj.choices as Record<string, unknown>[])
          .filter(
            (c) =>
              typeof c.key === "string" &&
              typeof c.text === "string" &&
              ["easy", "medium", "hard", "extreme"].includes(String(c.gateDifficulty)),
          )
          .slice(0, 3)
          .map((c) => {
            const d = String(c.gateDifficulty) as Difficulty;
            const cat = CATEGORIES.includes(String(c.gateCategory) as never)
              ? String(c.gateCategory)
              : strongCategory;
            return {
              key: String(c.key),
              text: String(c.text).slice(0, 160),
              gateDifficulty: d,
              gateCategory: cat,
              gloryReward: gloryReward(d),
              riskNote: String(c.riskNote ?? "الخطر هو الثمن").slice(0, 100),
            };
          });
        if (valid.length === 3) {
          return { scene: obj.scene.trim().slice(0, 800), choices: valid };
        }
      }
    }
  } catch {
    // الشبكة فشلت — الراوي المحلي يكمل الملحمة
  }
  return fallback;
}

// ── 3) اختيار باب: إخراج سؤال البوابة ──────────────────────────────────

export const chooseGate = mutation({
  args: { runId: v.id("sagaRuns"), choiceKey: v.string() },
  handler: async (ctx, { runId, choiceKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== userId) throw new Error("الملحمة غير موجودة");
    if (run.status !== "active") throw new Error("الملحمة انتهت");

    const chapter = await ctx.db
      .query("sagaChapters")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();
    const current = chapter.find((c) => c.index === run.chapterIndex);
    if (!current) throw new Error("الفصل غير موجود");
    if (current.chosenKey) throw new Error("اخترت بالفعل في هذا الفصل");

    const choice = current.choices.find((c) => c.key === choiceKey);
    if (!choice) throw new Error("الباب غير موجود");

    // سؤال البوابة: من البنك بالفئة والصعوبة المطلوبة
    const pool = QUESTION_BANK.filter(
      (q) => q.category === choice.gateCategory && q.difficulty === choice.gateDifficulty,
    );
    const poolSafe = pool.length > 0 ? pool : QUESTION_BANK.filter((q) => q.difficulty === choice.gateDifficulty);
    const gateQ = poolSafe[Math.floor(Math.random() * poolSafe.length)];

    await ctx.db.patch(current._id, {
      chosenKey: choiceKey,
      gateQuestionId: gateQ.id,
    });

    return {
      gateQuestion: {
        id: gateQ.id,
        question: gateQ.question,
        options: [...gateQ.options],
        difficulty: gateQ.difficulty,
        category: gateQ.category,
      },
      gloryReward: choice.gloryReward,
      riskNote: choice.riskNote,
    };
  },
});

// ── 4) حسم البوابة: الإجابة تحدد المصير ────────────────────────────────

export const answerGate = mutation({
  args: {
    runId: v.id("sagaRuns"),
    questionId: v.string(),
    selected: v.number(),
  },
  handler: async (ctx, { runId, questionId, selected }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== userId || run.status !== "active") {
      throw new Error("الملحمة غير متاحة");
    }

    const chapters = await ctx.db
      .query("sagaChapters")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();
    const current = chapters.find((c) => c.index === run.chapterIndex);
    if (!current || !current.chosenKey || current.gateQuestionId !== questionId) {
      throw new Error("البوابة غير متطابقة");
    }
    const choice = current.choices.find((c) => c.key === current.chosenKey);
    if (!choice) throw new Error("الاختيار مفقود");

    const gateQ = QUESTION_BANK.find((q) => q.id === questionId);
    if (!gateQ) throw new Error("سؤال البوابة مفقود");
    const passed = selected === gateQ.correctIndex;

    // المجد يتغير
    const newGlory = Math.max(
      0,
      Math.min(GLORY_MAX, run.glory + (passed ? choice.gloryReward : -Math.ceil(choice.gloryReward / 2))),
    );
    const narration = passed
      ? `اخترتَ باب «${choice.text.slice(0, 40)}…» وأجبت بثقة — البوابة تُفتح، والمجد يزداد +${choice.gloryReward}. ${choice.gateDifficulty === "extreme" ? "أسطورة تولد الآن!" : ""}`
      : `الباب أُغلق في وجهك. ${choice.riskNote} — المجد يتراجع ${Math.ceil(choice.gloryReward / 2)}.`;

    await ctx.db.patch(current._id, { gatePassed: passed, narration });

    // هل انتهت الملحمة؟
    const isLast = run.chapterIndex >= run.totalChapters - 1;
    if (isLast) {
      const endingTitle =
        newGlory >= 85
          ? "الأسطورة الخالدة"
          : newGlory >= 65
            ? "بطل العقول"
            : newGlory >= 45
              ? "المغامر الشجاع"
              : newGlory >= 25
                ? "الناجي المحظوظ"
                : "الحكاية المنسية";
      await ctx.db.patch(runId, {
        glory: newGlory,
        pathTaken: [...run.pathTaken, current.chosenKey],
        status: "completed",
        endingTitle,
        endedAt: Date.now(),
      });
      return { passed, narration, glory: newGlory, sagaEnded: true as const, endingTitle };
    }

    await ctx.db.patch(runId, {
      glory: newGlory,
      chapterIndex: run.chapterIndex + 1,
      pathTaken: [...run.pathTaken, current.chosenKey],
    });

    return { passed, narration, glory: newGlory, sagaEnded: false as const };
  },
});

// ── 5) الفصل التالي: يُولَّد عند الحاجة (action) ────────────────────────

export const advanceChapter = action({
  args: { runId: v.id("sagaRuns") },
  handler: async (ctx, { runId }) => {
    const ctxRun = (await ctx.runQuery("aiSaga:getRunForChapter" as any, { runId })) as {
      userId: Id<"users">;
      heroName: string;
      glory: number;
      chapterIndex: number;
      pathTaken: string[];
      theme: string;
      strongCategory: string;
      weakCategory: string;
    } | null;
    if (!ctxRun) throw new Error("الملحمة غير موجودة");

    const chapter = await generateChapter(ctx, {
      heroName: ctxRun.heroName,
      strongCategory: ctxRun.strongCategory,
      weakCategory: ctxRun.weakCategory,
      chapterIndex: ctxRun.chapterIndex,
      glory: ctxRun.glory,
      pathSummary: `عبر ${ctxRun.pathTaken.length} باباً — مجده الآن ${ctxRun.glory}/${GLORY_MAX}`,
    });

    await ctx.runMutation("aiSaga:saveChapter" as any, { runId, chapter });
    return chapter;
  },
});

export const getRunForChapter = internalQuery({
  args: { runId: v.id("sagaRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;
    // فئات القوة/الضعف من سياق الملحمة نفسها
    const strong = run.theme.split(" و")[0]?.replace("عالم ", "") ?? "عام";
    const weak = run.theme.split(" و")[1] ?? "منوعات";
    return {
      userId: run.userId,
      heroName: run.heroName,
      glory: run.glory,
      chapterIndex: run.chapterIndex,
      pathTaken: run.pathTaken,
      theme: run.theme,
      strongCategory: strong,
      weakCategory: weak,
    };
  },
});

export const saveChapter = internalMutation({
  args: {
    runId: v.id("sagaRuns"),
    chapter: v.object({
      scene: v.string(),
      choices: v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          gateDifficulty: v.union(
            v.literal("easy"),
            v.literal("medium"),
            v.literal("hard"),
            v.literal("extreme"),
          ),
          gateCategory: v.string(),
          gloryReward: v.number(),
          riskNote: v.string(),
        }),
      ),
    }),
  },
  handler: async (ctx, { runId, chapter }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("الملحمة غير موجودة");
    await ctx.db.insert("sagaChapters", {
      runId,
      index: run.chapterIndex,
      scene: chapter.scene,
      choices: chapter.choices,
      createdAt: Date.now(),
    });
  },
});

// ── 6) القراءة ─────────────────────────────────────────────────────────

export const getMySaga = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    // نشطة أولاً ثم آخر مكتملة
    const active = await ctx.db
      .query("sagaRuns")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
    const run = active ?? (
      await ctx.db
        .query("sagaRuns")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0] ?? null;
    if (!run) return null;

    const chapters = await ctx.db
      .query("sagaChapters")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .collect();
    const current = chapters.find((c) => c.index === run.chapterIndex) ?? null;

    // سؤال البوابة المفتوح (إن اختار باباً ولم يجب)
    let gateQuestion: { id: string; question: string; options: string[]; difficulty: string; category: string } | null = null;
    if (current?.gateQuestionId && current.gatePassed === undefined) {
      const gq = QUESTION_BANK.find((q) => q.id === current.gateQuestionId);
      if (gq) {
        gateQuestion = {
          id: gq.id,
          question: gq.question,
          options: [...gq.options],
          difficulty: gq.difficulty,
          category: gq.category,
        };
      }
    }

    const strong = run.theme.split(" و")[0]?.replace("عالم ", "") ?? "عام";
    const weak = run.theme.split(" و")[1] ?? "منوعات";

    return {
      _id: run._id,
      status: run.status,
      heroName: run.heroName,
      theme: run.theme,
      chapterIndex: run.chapterIndex,
      totalChapters: run.totalChapters,
      glory: run.glory,
      endingTitle: run.endingTitle ?? null,
      currentChapter: current
        ? {
            index: current.index,
            scene: current.scene,
            choices: current.choices,
            chosenKey: current.chosenKey ?? null,
            gatePassed: current.gatePassed ?? null,
            narration: current.narration ?? null,
          }
        : null,
      gateQuestion,
      strongCategory: strong,
      weakCategory: weak,
    };
  },
});

// ── 7) أدوات داخلية ────────────────────────────────────────────────────

export const getPlayerContext = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;

    // أقوى/أضعف فئة من الإتقان الحقيقي
    const specs = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const measured = specs.filter((s) => s.total >= 3).sort((a, b) => b.mastery - a.mastery);
    const strongCategory = measured[0]?.category ?? "عام";
    const weakCategory = measured[measured.length - 1]?.category ?? "منوعات";

    return { userId, name: me.name ?? "البطل", strongCategory, weakCategory };
  },
});

export const getActiveRunInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("sagaRuns")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
  },
});

export const createRun = internalMutation({
  args: {
    userId: v.id("users"),
    heroName: v.string(),
    theme: v.string(),
    totalChapters: v.number(),
    firstChapter: v.object({
      scene: v.string(),
      choices: v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          gateDifficulty: v.union(
            v.literal("easy"),
            v.literal("medium"),
            v.literal("hard"),
            v.literal("extreme"),
          ),
          gateCategory: v.string(),
          gloryReward: v.number(),
          riskNote: v.string(),
        }),
      ),
    }),
  },
  handler: async (ctx, a) => {
    const runId = await ctx.db.insert("sagaRuns", {
      userId: a.userId,
      heroName: a.heroName,
      theme: a.theme,
      status: "active",
      chapterIndex: 0,
      totalChapters: a.totalChapters,
      glory: 50,
      pathTaken: [],
      createdAt: Date.now(),
    });
    await ctx.db.insert("sagaChapters", {
      runId,
      index: 0,
      scene: a.firstChapter.scene,
      choices: a.firstChapter.choices,
      createdAt: Date.now(),
    });
    return runId;
  },
});
