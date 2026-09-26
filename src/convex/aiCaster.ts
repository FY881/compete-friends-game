import { v } from "convex/values";
import {
  action,
  internalAction,
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
import { internal } from "./_generated/api";
import { DIFFICULTY_LABELS } from "../lib/question-difficulty";

/**
 * 🎙️ المعلّق الأسطوري (Minds Caster)
 *
 * طبقة بث درامية حيّة فوق محرك اللعب — يحوّل كل مبارزة إلى حكاية:
 *  1) يلتقط اللحظات الكبرى: افتتاح المباراة، إطلاق سؤال قاسٍ، كشف الإجابة
 *     مع سلاسل نارية وعودة من العدم، وخاتمة المباراة.
 *  2) يقرأ الأرقام الحقيقية لحظة اللحظة (الدقة، السلاسل، الفجوة، سرعة الإجابة،
 *     من أطلق أولاً، من على وشك العودة) ويحوّلها لسرد درامي بالذكاء الاصطناعي.
 *  3) عقل احتياطي محلي مجاني: يولّد سرداً عربياً جميلاً بلا شبكة أبداً —
 *     فلا تنكسر طبقة البث مهما حدث.
 *  4) التوقيت مقيد: سرديّة واحدة لكل لحظة، مقطوعة عند تجاوز العدّاد —
 *     فالنص يصل وضوحاً وسرعةً كأنه بث حيّ حقيقي.
 *
 * الاستدعاء مبنيّ داخل مسارات games الحقيقية (بدء الجولة، كشف السؤال،
 * إنهاء المباراة) عبر جدولة داخليّة لا تلمس منطق اللعب.
 */

const MOMENT_LABELS = {
  match_intro: "افتتاحية",
  question_start: "إطلاق السؤال",
  reveal: "الكشف",
  streak_alert: "سلسلة نارية",
  comeback_alert: "عودة من العدم",
  finale: "الخاتمة",
} as const;

type MomentKind = keyof typeof MOMENT_LABELS;

type MomentInput = {
  kind: MomentKind;
  code: string;
  questionIndex: number;
  questionText?: string;
  questionCategory?: string;
  questionDifficulty?: string;
  players: {
    name: string;
    score: number;
    streak: number;
    correctSoFar: number;
    answeredSoFar: number;
    lastCorrect: boolean | null;
    lastElapsedMs: number | null;
  }[];
  extra?: {
    firstCorrectName?: string | null;
    gapBeforeLast?: number; // فجوة النقاط قبل السؤال الأخير
    winnerName?: string | null;
    loserName?: string | null;
    winningMargin?: number | null;
    timedRound?: boolean;
  };
};

// ── 1) العقل المحلي المجاني — سرد عربي جميل بلا شبكة ────────────────────

function localNarrative(m: MomentInput): string {
  const sorted = [...m.players].sort((a, b) => b.score - a.score);
  const leader = sorted[0];
  const second = sorted[1];
  const gap = leader && second ? leader.score - second.score : 0;
  const gapWord =
    gap <= 0 ? "بتعادل محتقن" : gap <= 100 ? "بفارق شعر" : gap <= 300 ? "بفارق مريح" : "بفارق مدوي";

  switch (m.kind) {
    case "match_intro": {
      const names = m.players.map((p) => p.name).join(" × ");
      return m.extra?.timedRound
        ? `🚨 انطلقت المباراة الزمنية: ${names}! الساعة هي الخصم الثالث — من يزرع أكبر حصاد قبل انتهاء الوقت؟`
        : `🎭 أهلاً بكم في الساحة! ${names} — ${m.players.length} عقول، سؤال واحد يحسم، ولا مكان للرجال الخائفين!`;
    }
    case "question_start": {
      const d = m.questionDifficulty
        ? DIFFICULTY_LABELS[m.questionDifficulty as keyof typeof DIFFICULTY_LABELS] ?? ""
        : "";
      if (m.questionDifficulty === "extreme") {
        return `⚠️ تحذير عاجل: سؤال «شبه مستحيل» قادم في ${m.questionCategory}! من سيصمد وحده؟`;
      }
      if (m.questionDifficulty === "hard") {
        return `🔥 سؤال قاسٍ يضرب أرض الساحة: ${m.questionCategory} (${d}) — التسرّع هنا دفنٌ مؤكد!`;
      }
      return `⚔️ سؤال جديد في ${m.questionCategory} — الأسرع يقطف المجد، والمتردد يذوب في الرمل!`;
    }
    case "reveal": {
      const firsts = m.players.filter((p) => p.lastCorrect === true);
      const misses = m.players.filter((p) => p.lastCorrect === false);
      const fastest = firsts.filter((p) => (p.lastElapsedMs ?? 99e9) < 2500);
      if (firsts.length === 1) {
        const hero = firsts[0];
        const speed = fastest.length > 0 ? " — ضربة برق قبل أن يرمش المشجعون!" : "";
        return `🎯 ${hero.name} يخترق السؤال منفرداً${speed} ويرفع صوته ${gapWord} فوق الساحة!`;
      }
      if (firsts.length > 1) {
        const names = firsts.map((p) => p.name).join(" و");
        return `🤝 إجابة مزدوجة! ${names} ينقضّان معاً على الحل — والصراع يشتعل ${gapWord}!`;
      }
      if (misses.length === m.players.length && misses.length > 0) {
        return `💥 كارثة جماعية! سقوط الجميع أمام سؤال ${m.questionCategory} — الأرض تحترق ولا أحد ينهض!`;
      }
      const fallen = misses.map((p) => p.name).join(" و");
      return `🌪️ انقلاب! ${fallen} يتعثر، و${leader?.name ?? "المتصدر"} يستفيد ${gapWord}!`;
    }
    case "streak_alert": {
      const onFire = sorted.find((p) => p.streak >= 3) ?? leader;
      return `🚀 ${onFire?.name ?? "لاعب"} يشعل الساحة: ${onFire?.streak ?? 0} إجابات متتالية — من يجرؤ على إطفاء هذا اللهب؟`;
    }
    case "comeback_alert": {
      const chaser = sorted[1] ?? leader;
      return `⚡ لا تتوقف عن الملاحقة! ${chaser?.name ?? "المنافس"} يقترب خطوة خطوة — ${gap <= 150 ? "الفارق الآن على حافة نصل السكين!" : "الفجوة تتآكل بثبات مبهر!"}`;
    }
    case "finale": {
      const w = m.extra?.winnerName ?? leader?.name ?? "لاعب";
      const l = m.extra?.loserName ?? second?.name ?? "منافسه";
      const margin = m.extra?.winningMargin ?? 0;
      if (margin <= 0) {
        return `🏆 نهاية ملحمية! ${w} ينتزع التاج في لحظات الحسم النهائية — مباراة ستُروى طويلاً!`;
      }
      if (margin <= 100) {
        return `🏆 ${w} يهزم ${l} بفارق رمزي (${margin} نقطة) — النفَس الأخير كتب الفارق كله!`;
      }
      return `👑 ${w} يختم بثبات على العرش بفارق ${margin} نقطة عن ${l} — ساحة اليوم لا تعرف سوى سيد واحد!`;
    }
  }
}

// ── 2) تجميع سياق اللحظة من قاعدة البيانات ──────────────────────────────

export const buildMomentInternal = internalQuery({
  args: {
    gameId: v.id("games"),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
    questionIndex: v.number(),
  },
  handler: async (ctx, { gameId, kind, questionIndex }): Promise<MomentInput | null> => {
    const game = await ctx.db.get(gameId);
    if (!game) return null;
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    // السؤال الحالي (إن لزم)
    let questionText: string | undefined;
    let questionCategory: string | undefined;
    let questionDifficulty: string | undefined;
    if (kind === "question_start" || kind === "reveal") {
      const qid = game.questionIds[questionIndex];
      if (qid) {
        const fromBank = QUESTION_BANK_MAP.get(qid);
        if (fromBank) {
          questionText = fromBank.question;
          questionCategory = fromBank.category;
          questionDifficulty = fromBank.difficulty;
        } else {
          const row = await ctx.db
            .query("aiQuestions")
            .withIndex("by_qid", (q) => q.eq("qid", qid))
            .first();
          if (row) {
            questionCategory = row.category;
            questionDifficulty = row.difficulty;
            questionText = row.question;
          }
        }
      }
    }

    const firstCorrect = game.firstCorrect ?? [];
    const firstCorrectId = firstCorrect[questionIndex];
    let firstCorrectName: string | null = null;
    if (firstCorrectId) {
      const fp = players.find((p) => p.userId === firstCorrectId);
      firstCorrectName = fp?.name ?? null;
    }

    const sorted = [...players].sort((a, b) => b.score - a.score);

    return {
      kind,
      code: game.code,
      questionIndex,
      questionText: questionText?.slice(0, 120),
      questionCategory,
      questionDifficulty,
      players: players.map((p) => {
        const answered = p.answers.filter((a): a is NonNullable<typeof a> => a !== null);
        const last = answered[questionIndex] ?? null;
        return {
          name: p.name,
          score: p.score,
          streak: p.streak,
          correctSoFar: answered.filter((a) => a.correct).length,
          answeredSoFar: answered.length,
          lastCorrect: last ? last.correct : null,
          lastElapsedMs: last ? last.elapsedMs : null,
        };
      }),
      extra: {
        firstCorrectName,
        winnerName: kind === "finale" ? sorted[0]?.name ?? null : undefined,
        loserName: kind === "finale" ? sorted[1]?.name ?? null : undefined,
        winningMargin:
          kind === "finale" && sorted.length >= 2
            ? sorted[0].score - sorted[1].score
            : undefined,
        timedRound: (game.roundEndsAt ?? 0) > 0,
      },
    };
  },
});

// خريطة بنك الأسئلة المحلية (بدون استيراد دائري: من questions مباشرة)
import { QUESTION_BANK } from "./questions";
const QUESTION_BANK_MAP = new Map(QUESTION_BANK.map((q) => [q.id, q]));

// ── 3) توليد السرد وحفظه (internalAction — يُجدول من games) ─────────────

export const narrateMomentInternal = internalAction({
  args: {
    gameId: v.id("games"),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
    questionIndex: v.number(),
  },
  handler: async (ctx, { gameId, kind, questionIndex }) => {
    const moment = (await ctx.runQuery("aiCaster:buildMomentInternal" as any, {
      gameId,
      kind,
      questionIndex,
    })) as MomentInput | null;
    if (!moment || moment.players.length === 0) return;

    // منع التكرار: لحظة واحدة لكل (نوع، سؤال)
    const dupe = (await ctx.runQuery("aiCaster:hasNarrativeInternal" as any, {
      gameId,
      kind,
      questionIndex,
    })) as boolean;
    if (dupe) return;

    let text = localNarrative(moment);
    let engine = "local";

    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx);
        const playersDesc = moment.players
          .map(
            (p) =>
              `${p.name}: ${p.score} نقطة، سلسلة ${p.streak}، ${p.correctSoFar}/${p.answeredSoFar} صحيحة، آخر إجابة ${p.lastCorrect === true ? `صحيحة في ${p.lastElapsedMs}ms` : p.lastCorrect === false ? "خاطئة" : "لم يجب"}`,
          )
          .join("؛ ");
        const qDesc = moment.questionText
          ? `السؤال (${moment.questionCategory}/${moment.questionDifficulty}): «${moment.questionText}»`
          : "";
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت معلق رياضي عربي أسطوري في لعبة أسئلة حربية اسمها «حرب العقول». أسلوبك: حماسي، درامي، مختصر جداً (سطران كحد أقصى)، عربي فصيح بهيجان مباريات، بلا مبالغة ميلودرامية مملة. لا تُخترع أرقاماً غير موجودة في السياق. أجب بالنص المعلّق فقط دون أي مقدمات.",
            },
            {
              role: "user",
              content: `لحظة: ${MOMENT_LABELS[kind]}\nاللاعبون: ${playersDesc}\n${qDesc}${moment.extra?.firstCorrectName ? `\nأول إجابة صحيحة: ${moment.extra.firstCorrectName}` : ""}${kind === "finale" ? `\nالفائز: ${moment.extra?.winnerName} بفارق ${moment.extra?.winningMargin ?? 0} عن ${moment.extra?.loserName}` : ""}\n\nاكتب سطر التعليق.`,
            },
          ],
          220,
          0.85,
          "MindClash Minds Caster",
        );
        const clean = raw.trim().replace(/^["«]|["»]$/g, "").slice(0, 280);
        if (clean.length >= 10) {
          text = clean;
          engine = "llm";
        }
      } catch {
        // الشبكة فشلت — السرد المحلي جاهز أصلاً
      }
    }

    await ctx.runMutation("aiCaster:saveNarrative" as any, {
      gameId,
      code: moment.code,
      kind,
      questionIndex,
      text,
      stats: moment.players.map((p) => `${p.name}:${p.score}`).join(" | "),
      engine,
    });
  },
});

// ── 4) حفظ وقراءة السرد ─────────────────────────────────────────────────

export const hasNarrativeInternal = internalQuery({
  args: {
    gameId: v.id("games"),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
    questionIndex: v.number(),
  },
  handler: async (ctx, { gameId, kind, questionIndex }) => {
    const rows = await ctx.db
      .query("casterNarrative")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .order("desc")
      .take(30);
    return rows.some((r) => r.momentKind === kind && r.atQuestionIndex === questionIndex);
  },
});

export const saveNarrative = internalMutation({
  args: {
    gameId: v.id("games"),
    code: v.string(),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
    questionIndex: v.number(),
    text: v.string(),
    stats: v.optional(v.string()),
    engine: v.string(),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("casterNarrative", {
      gameId: a.gameId,
      code: a.code,
      momentKind: a.kind,
      atQuestionIndex: a.questionIndex,
      text: a.text,
      stats: a.stats,
      engine: a.engine,
      createdAt: Date.now(),
    });
  },
});

/** السرد الحي للغرفة — يقرؤه شريط البث في واجهة اللعب (اشتراك حي). */
export const getRoomNarrative = query({
  args: { code: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { code, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("casterNarrative")
      .withIndex("by_code", (q) => q.eq("code", code))
      .order("desc")
      .take(Math.min(limit ?? 4, 10));
    return rows.reverse().map((r) => ({
      id: r._id,
      kind: r.momentKind,
      label: MOMENT_LABELS[r.momentKind as MomentKind],
      atQuestionIndex: r.atQuestionIndex,
      text: r.text,
      engine: r.engine ?? "local",
      createdAt: r.createdAt,
    }));
  },
});

/** تشغيل يدوي: المالك يجرب السرد على أي غرفة (من غرفة المالك). */
export const narrateNow = action({
  args: {
    code: v.string(),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
  },
  handler: async (ctx, { code, kind }) => {
    const me = (await ctx.runQuery("aiCaster:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");

    const gameId = (await ctx.runQuery("aiCaster:findGameIdByCode" as any, {
      code,
    })) as Id<"games"> | null;
    if (!gameId) throw new Error("المباراة غير موجودة");

    const idx = (await ctx.runQuery("aiCaster:currentIndexInternal" as any, {
      gameId,
    })) as number;

    await ctx.runAction("aiCaster:narrateMomentInternal" as any, {
      gameId,
      kind,
      questionIndex: idx,
    });
    return { ok: true };
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المعلق" };
  },
});

export const findGameIdByCode = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    return game?._id ?? null;
  },
});

export const currentIndexInternal = internalQuery({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    return game?.currentQuestionIndex ?? 0;
  },
});

/** نقطة الالتقاط المركزية: تُجدول من games.ts بلا انتظار. */
export const scheduleNarration = internalMutation({
  args: {
    gameId: v.id("games"),
    kind: v.union(
      v.literal("match_intro"),
      v.literal("question_start"),
      v.literal("reveal"),
      v.literal("streak_alert"),
      v.literal("comeback_alert"),
      v.literal("finale"),
    ),
    questionIndex: v.number(),
  },
  handler: async (ctx, { gameId, kind, questionIndex }) => {
    await ctx.scheduler.runAfter(0, "aiCaster:narrateMomentInternal" as any, {
      gameId,
      kind,
      questionIndex,
    });
  },
});
