/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎮 أوضاع اللعب الجديدة — الإصدار 4.0، المرحلة 2
 *
 *  ⚡ تحدي البرق (blitz): 60 ثانية، 5 ثوانٍ للسؤال — أقصى عدد إجابات صحيحة.
 *  🛡️ البقاء (survival): أسئلة تتصاعد صعوبتها، وخطأ واحد يُنهي الجولة.
 *  🎲 جولة الرهان (bet): تراهن بنقاط ولاء حقيقية — 7/10 صحيحة تضاعف الرهان.
 *  👹 معركة الزعيم (boss): سؤال عنيد واحد يومياً، محاولة واحدة،
 *     وأول من يحله عالمياً ينال شارة أسطورية.
 *
 * كل النتائج تُحتسب على الخادم من مجموعة أسئلة أُصدرت عند بدء الجولة —
 * لا يمكن للعميل تزوير الأسئلة ولا الدرجة ولا المكافأة.
 *
 * ‏(القسم الثاني في هذا الملف: «الألعاب الرئيسية الخمس» المحصورة
 * بالعضويات — getAvailableGameModes و createGameModeRound.)
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { QUESTION_BANK } from "./questions";
import { dayKey, MAX_ACTIVE_ROOMS, DURATION_MODE_OFF } from "./gameConfig";
import { makeUniqueCode, pickQuestions, sanitizeName } from "./games";

// ── إعدادات الأوضاع ─────────────────────────────────────────────────────
type RunKind = "blitz" | "survival" | "bet";

const MODE_CONFIG: Record<
  RunKind,
  { count: number; perQuestionMs: number; totalMs: number; grace: number; title: string }
> = {
  blitz: { count: 20, perQuestionMs: 5_000, totalMs: 60_000, grace: 5_000, title: "تحدي البرق" },
  survival: { count: 30, perQuestionMs: 20_000, totalMs: 20 * 60_000, grace: 10_000, title: "البقاء" },
  bet: { count: 10, perQuestionMs: 8_000, totalMs: 90_000, grace: 5_000, title: "جولة الرهان" },
};

const BET_MIN_STAKE = 50;
const BET_MAX_STAKE = 1_000;
const BET_WIN_CORRECT = 7; // من 10

const BOSS_REWARD = 250; // مكافأة من يحل سؤال الزعيم
const BOSS_FIRST_REWARD = 1_000; // مكافأة أول من يحله عالمياً

// ── أدوات مساعدة ────────────────────────────────────────────────────────

function seededRandom(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type BankQuestion = (typeof QUESTION_BANK)[number];

const BANK_BY_ID = new Map<string, BankQuestion>(QUESTION_BANK.map((q) => [q.id, q]));

/** اختيار أسئلة الجولة — البقاء يتصاعد من السهل إلى الصعب. */
function pickRunQuestions(kind: RunKind, seed: string): string[] {
  const rand = seededRandom(seed);
  const { count } = MODE_CONFIG[kind];

  if (kind === "survival") {
    const escalator = [
      ...shuffle(QUESTION_BANK.filter((q) => q.difficulty === "easy"), rand),
      ...shuffle(QUESTION_BANK.filter((q) => q.difficulty === "medium"), rand),
      ...shuffle(QUESTION_BANK.filter((q) => q.difficulty === "hard"), rand),
    ];
    return escalator.slice(0, count).map((q) => q.id);
  }

  return shuffle(QUESTION_BANK, rand)
    .slice(0, count)
    .map((q) => q.id);
}

/** سؤال الزعيم اليومي — سؤال صعب ثابت للجميع خلال اليوم. */
function bossQuestionFor(day: string): BankQuestion {
  const hard = QUESTION_BANK.filter((q) => q.difficulty === "hard");
  const pool = hard.length > 0 ? hard : QUESTION_BANK;
  const rand = seededRandom(`zaka-boss-${day}`);
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

function pointsFor(elapsedMs: number, perQuestionMs: number, base: number): number {
  const speed = Math.max(0, Math.min(50, Math.round((perQuestionMs - elapsedMs) / 100)));
  return base + speed;
}

/** يمنح شارات جديدة للاعب (ينشئ الملف إن لم يكن موجوداً). */
async function grantBadges(ctx: any, userId: Id<"users">, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    await ctx.db.insert("profiles", {
      userId,
      xp: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      bestScore: 0,
      bestStreak: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      badges: ids,
      updatedAt: Date.now(),
    });
    return ids;
  }

  const had = new Set<string>(profile.badges ?? []);
  const fresh = ids.filter((id) => !had.has(id));
  if (fresh.length > 0) {
    await ctx.db.patch(profile._id, {
      badges: [...(profile.badges ?? []), ...fresh],
      updatedAt: Date.now(),
    });
  }
  return fresh;
}

/** يزيد عدادات الدقة في الملف الشخصي من جولات الأوضاع الفردية. */
async function addProfileCounters(ctx: any, userId: Id<"users">, correct: number, total: number) {
  if (total <= 0) return;
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (profile) {
    await ctx.db.patch(profile._id, {
      correctAnswers: (profile.correctAnswers ?? 0) + correct,
      totalAnswers: (profile.totalAnswers ?? 0) + total,
      updatedAt: Date.now(),
    });
  }
}

/** يُنهي الجولات النشطة المنتهية زمنياً حتى لا تحجب بدء جولة جديدة. */
async function expireStaleRuns(ctx: any, userId: Id<"users">, kind: RunKind, now: number) {
  const active = await ctx.db
    .query("modeRuns")
    .withIndex("by_user_kind", (q: any) => q.eq("userId", userId).eq("kind", kind))
    .collect();
  for (const run of active) {
    if (run.status === "active" && now > run.endsAt + MODE_CONFIG[kind].grace) {
      await ctx.db.patch(run._id, { status: "done", finishedAt: now, payout: run.payout ?? 0 });
    }
  }
}

// ── بدء جولة ────────────────────────────────────────────────────────────

export const startRun = mutation({
  args: {
    kind: v.union(v.literal("blitz"), v.literal("survival"), v.literal("bet")),
    stake: v.optional(v.number()),
  },
  handler: async (ctx, { kind, stake }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const user = await ctx.db.get(userId);
    if (user?.bannedPermanent) throw new Error("حسابك محظور نهائياً.");

    const now = Date.now();
    await expireStaleRuns(ctx, userId, kind, now);

    const stillActive = await ctx.db
      .query("modeRuns")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .collect();
    const running = stillActive.find((r) => r.status === "active" && now <= r.endsAt + MODE_CONFIG[kind].grace);
    if (running) {
      throw new Error(`لديك جولة ${MODE_CONFIG[kind].title} جارية — أنهاها أولاً.`);
    }

    const cfg = MODE_CONFIG[kind];
    let betStake: number | undefined;

    if (kind === "bet") {
      const amount = Math.floor(stake ?? 0);
      if (!Number.isFinite(amount) || amount < BET_MIN_STAKE || amount > BET_MAX_STAKE) {
        throw new Error(`الرهان يجب أن يكون بين ${BET_MIN_STAKE} و${BET_MAX_STAKE} نقطة ولاء.`);
      }
      // يُخصم الرهان فوراً — الانسحاب أو انتهاء الوقت يعني خسارته (شفافية كاملة).
      await ctx.runMutation(internal.loyalty.spendPoints, {
        userId,
        amount,
        reason: `🎲 رهان في جولة الرهان (${amount})`,
      });
      betStake = amount;
    }

    const questionIds = pickRunQuestions(kind, `${kind}-${userId}-${now}`);
    const runId = await ctx.db.insert("modeRuns", {
      userId,
      kind,
      questionIds,
      stake: betStake,
      status: "active",
      answers: [],
      score: 0,
      correctCount: 0,
      survived: 0,
      startedAt: now,
      endsAt: now + cfg.totalMs,
    });

    return {
      runId,
      kind,
      stake: betStake,
      perQuestionMs: cfg.perQuestionMs,
      totalMs: cfg.totalMs,
      endsAt: now + cfg.totalMs,
      winTarget: kind === "bet" ? BET_WIN_CORRECT : null,
      questions: questionIds.map((id) => {
        const q = BANK_BY_ID.get(id);
        return {
          id,
          category: q?.category ?? "عام",
          difficulty: q?.difficulty ?? "medium",
          question: q?.question ?? "",
          options: q?.options ?? [],
        };
      }),
    };
  },
});

// ── إرسال إجابة (يُستدعى لكل سؤال على حدة) ──────────────────────────────

export const submitModeAnswer = mutation({
  args: {
    runId: v.id("modeRuns"),
    questionId: v.string(),
    selected: v.number(),
    elapsedMs: v.number(),
  },
  handler: async (
    ctx,
    { runId, questionId, selected, elapsedMs },
  ): Promise<{
    correct: boolean;
    correctIndex: number;
    score: number;
    correctCount: number;
    survived: number;
    done: boolean;
    payout?: number;
    won?: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const run = await ctx.db.get(runId);
    if (!run || run.userId !== userId) throw new Error("جولة غير معروفة.");
    if (run.status !== "active") throw new Error("هذه الجولة انتهت بالفعل.");

    const cfg = MODE_CONFIG[run.kind];
    const now = Date.now();
    const timedOut = now > run.endsAt + cfg.grace;

    const expected = run.questionIds[run.answers.length];
    if (questionId !== expected) throw new Error("ترتيب الأسئلة غير صحيح.");

    const bank = BANK_BY_ID.get(questionId);
    const correctAnswerIndex = bank?.correctIndex ?? -1;
    const cleanElapsed = Math.max(0, Math.min(cfg.perQuestionMs, Math.round(elapsedMs)));
    const correct = !timedOut && selected === correctAnswerIndex;

    const answers = [
      ...run.answers,
      { questionId, selected, elapsedMs: cleanElapsed },
    ];

    let score = run.score;
    let correctCount = run.correctCount;
    let survived = run.survived;
    let done = false;

    if (correct) {
      correctCount += 1;
      survived += 1;
      score += run.kind === "survival"
        ? 150 + Math.max(0, Math.min(60, Math.round((cfg.perQuestionMs - cleanElapsed) / 200)))
        : pointsFor(cleanElapsed, cfg.perQuestionMs, 100);
    } else if (run.kind === "survival") {
      // خطأ واحد يُنهي جولة البقاء
      done = true;
    }

    if (answers.length >= run.questionIds.length || timedOut) done = true;

    const patch: Record<string, unknown> = { answers, score, correctCount, survived };

    if (!done) {
      await ctx.db.patch(runId, patch);
      return { correct, correctIndex: correctAnswerIndex, score, correctCount, survived, done };
    }

    // ── تسوية الجولة ──
    let payout: number | undefined;
    let won: boolean | undefined;

    if (run.kind === "blitz") {
      const reward = Math.round(score / 20); // ~5% من النقاط كمكافأة ولاء
      if (reward > 0) {
        await ctx.runMutation(internal.loyalty.awardPoints, {
          userId,
          amount: reward,
          reason: `⚡ تحدي البرق — ${score} نقطة (+${reward})`,
        });
      }
    } else if (run.kind === "survival") {
      const reward = Math.round(score / 20);
      if (reward > 0) {
        await ctx.runMutation(internal.loyalty.awardPoints, {
          userId,
          amount: reward,
          reason: `🛡️ وضع البقاء — صمدت مع ${correctCount} إجابة (+${reward})`,
        });
      }
    } else if (run.kind === "bet") {
      won = correctCount >= BET_WIN_CORRECT;
      if (won) {
        payout = (run.stake ?? 0) * 2;
        await ctx.runMutation(internal.loyalty.awardPoints, {
          userId,
          amount: payout,
          reason: `🎲 فوز في جولة الرهان (${correctCount}/10) — عائد ${payout}`,
        });
      } else {
        payout = 0;
      }
    }

    await ctx.db.patch(runId, {
      ...patch,
      status: "done",
      finishedAt: now,
      payout,
    });
    await addProfileCounters(ctx, userId, correctCount, answers.length);

    return {
      correct,
      correctIndex: correctAnswerIndex,
      score,
      correctCount,
      survived,
      done: true,
      payout,
      won,
    };
  },
});

// ── قراءة حالة الأوضاع ──────────────────────────────────────────────────

export const getModeState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const runs = await ctx.db
      .query("modeRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const summary = (kind: RunKind) => {
      const mine = runs.filter((r) => r.kind === kind && r.status === "done");
      return {
        plays: mine.length,
        bestScore: mine.reduce((m, r) => Math.max(m, r.score), 0),
        bestCorrect: mine.reduce((m, r) => Math.max(m, r.correctCount), 0),
        lastPlayedAt: mine.reduce((m, r) => Math.max(m, r.finishedAt ?? r.startedAt), 0) || null,
      };
    };

    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      blitz: summary("blitz"),
      survival: summary("survival"),
      bet: summary("bet"),
      betWins: runs.filter((r) => r.kind === "bet" && (r.payout ?? 0) > 0).length,
      points: wallet?.points ?? 0,
      betMin: BET_MIN_STAKE,
      betMax: BET_MAX_STAKE,
      betTarget: BET_WIN_CORRECT,
    };
  },
});

export const getModeLeaderboard = query({
  args: { kind: v.union(v.literal("blitz"), v.literal("survival"), v.literal("bet")) },
  handler: async (ctx, { kind }) => {
    const top = await ctx.db
      .query("modeRuns")
      .withIndex("by_kind_score", (q) => q.eq("kind", kind))
      .order("desc")
      .take(40);

    const best = new Map<string, { userId: Id<"users">; score: number; correctCount: number }>();
    for (const run of top) {
      if (run.status !== "done" || run.score <= 0) continue;
      const key = run.userId as string;
      const existing = best.get(key);
      if (!existing || run.score > existing.score) {
        best.set(key, { userId: run.userId, score: run.score, correctCount: run.correctCount });
      }
    }

    const rows = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
    const out = [];
    for (const row of rows) {
      const user = await ctx.db.get(row.userId);
      out.push({
        userId: row.userId as string,
        name: user?.name ?? "لاعب",
        emoji: user?.avatarEmoji ?? "🎯",
        score: row.score,
        correctCount: row.correctCount,
      });
    }
    return out;
  },
});

// ── معركة الزعيم اليومية ────────────────────────────────────────────────

export const getBoss = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = dayKey(Date.now());
    const q = bossQuestionFor(today);

    const fights = await ctx.db
      .query("bossFights")
      .withIndex("by_day", (q2) => q2.eq("day", today))
      .collect();

    const correctFights = fights.filter((f) => f.correct).sort((a, b) => a.at - b.at);
    const firstSolver = correctFights[0];
    const firstSolverUser = firstSolver ? await ctx.db.get(firstSolver.userId) : null;

    const mine = userId
      ? fights.find((f) => f.userId === userId) ?? null
      : null;

    return {
      day: today,
      question: {
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      },
      myAttempt: mine ? { correct: mine.correct, elapsedMs: mine.elapsedMs } : null,
      solversCount: correctFights.length,
      attemptsCount: fights.length,
      firstSolverName: firstSolverUser?.name ?? null,
    };
  },
});

export const fightBoss = mutation({
  args: { selected: v.number(), elapsedMs: v.number() },
  handler: async (ctx, { selected, elapsedMs }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const today = dayKey(Date.now());
    const existing = await ctx.db
      .query("bossFights")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .first();
    if (existing) throw new Error("محاولة واحدة فقط في اليوم — عد غداً لزعيم جديد 👹");

    const q = bossQuestionFor(today);
    const correct = selected === q.correctIndex;
    const now = Date.now();
    const user = await ctx.db.get(userId);

    await ctx.db.insert("bossFights", {
      day: today,
      userId,
      userName: user?.name ?? "لاعب",
      correct,
      elapsedMs: Math.max(0, Math.round(elapsedMs)),
      at: now,
    });

    if (!correct) {
      await addProfileCounters(ctx, userId, 0, 1);
      return { correct: false, correctIndex: q.correctIndex, first: false, reward: 0 };
    }

    // هل هو أول من يحله اليوم عالمياً؟
    const before = await ctx.db
      .query("bossFights")
      .withIndex("by_day", (q2) => q2.eq("day", today))
      .collect();
    const isFirst = before.filter((f) => f.correct && f.at < now).length === 0;

    const reward = isFirst ? BOSS_FIRST_REWARD : BOSS_REWARD;
    const badges = isFirst ? ["boss_first"] : ["boss_slayer"];

    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId,
      amount: reward,
      reason: isFirst
        ? `👹👑 أول من أسقط زعيم اليوم! (+${reward})`
        : `👹 أسقطت زعيم اليوم (+${reward})`,
    });
    await addProfileCounters(ctx, userId, 1, 1);
    const earned = await grantBadges(ctx, userId, badges);

    return { correct: true, correctIndex: q.correctIndex, first: isFirst, reward, badges: earned };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🎮 الألعاب الرئيسية الخمس — محصورة بدرجات العضوية
//
//  كل لعبة لها عتبة عضوية دنيا وحد يومي يتوسّع كلما ارتفعت الدرجة،
//  وعند بدء الجولة تُنشأ غرفة لعب حقيقية بإعدادات اللعبة وتُبدأ فوراً.
// ═══════════════════════════════════════════════════════════════════════

type Tier = "bronze" | "silver" | "gold" | "diamond" | "exclusive";

const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "diamond", "exclusive"];

const TIER_LABELS: Record<Tier, string> = {
  bronze: "مجانية",
  silver: "فضية",
  gold: "ذهبية",
  diamond: "ماسية",
  exclusive: "حصريّة",
};

type MainMode = {
  id: string;
  name: string;
  description: string;
  minTier: Tier;
  questions: number;
  timePerQuestion: number;
  dailyLimit: Partial<Record<Tier, number>>;
  rewards: { xpPerCorrect: number; xpBonusWin: number };
  features: string[];
};

const MAIN_MODES: MainMode[] = [
  {
    id: "quiz_rush",
    name: "سباق الذكاء",
    description: "تحدٍّ سريع لسرعة البديهة والتفكير المنطقي — من يستطيع اللحاق بك؟",
    minTier: "bronze",
    questions: 5,
    timePerQuestion: 15,
    dailyLimit: { bronze: 5, silver: 8, gold: 12, diamond: 20, exclusive: 30 },
    rewards: { xpPerCorrect: 10, xpBonusWin: 25 },
    features: ["خمسة أسئلة خاطفة", "مكافأة سرعة مضاعفة", "مفتوحة للجميع"],
  },
  {
    id: "puzzle_masters",
    name: "عصر الألغاز",
    description: "ألغاز متعددة الصعوبات تحتاج تفكيراً عميقاً وصبراً طويلاً",
    minTier: "silver",
    questions: 5,
    timePerQuestion: 20,
    dailyLimit: { silver: 5, gold: 8, diamond: 12, exclusive: 20 },
    rewards: { xpPerCorrect: 15, xpBonusWin: 40 },
    features: ["ألغاز متعددة الأنماط", "وقت أطول للتفكير", "خبرة أعلى لكل إجابة"],
  },
  {
    id: "champion_battle",
    name: "تحدي الأبطال",
    description: "تحديات عميقة تتطلب مهارات تحليلية متقدمة — للأبطال فقط",
    minTier: "gold",
    questions: 7,
    timePerQuestion: 20,
    dailyLimit: { gold: 5, diamond: 10, exclusive: 15 },
    rewards: { xpPerCorrect: 25, xpBonusWin: 60 },
    features: ["سبعة أسئلة متتالية", "مكافآت خبرة مضاعفة", "إطار المبارز الذهبي"],
  },
  {
    id: "diamond_rush",
    name: "اندفاع الماس",
    description: "تحديات نادرة ومكافآت ضخمة — حصريّ لأصحاب العضوية الماسية",
    minTier: "diamond",
    questions: 7,
    timePerQuestion: 20,
    dailyLimit: { diamond: 5, exclusive: 10 },
    rewards: { xpPerCorrect: 50, xpBonusWin: 100 },
    features: ["مكافآت خبرة ضخمة", "أسئلة نادرة مختارة", "أولوية في الصدارة"],
  },
  {
    id: "legend_arena",
    name: "ساحة الأساطير",
    description: "التحدي الأقصى — اختبار شامل لكل مهاراتك الذهنية",
    minTier: "exclusive",
    questions: 10,
    timePerQuestion: 30,
    dailyLimit: { exclusive: 10 },
    rewards: { xpPerCorrect: 100, xpBonusWin: 200 },
    features: ["عشر أسئلة شاملة", "أعلى مكافآت في اللعبة", "لقب أسطوري دائم"],
  },
];

/** درجة عضوية اللاعب الفعلية (منتهية الصلاحية = مجانية). */
async function currentTier(ctx: any): Promise<Tier> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return "bronze";
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (!membership) return "bronze";
  if (membership.expiresAt && membership.expiresAt <= Date.now()) return "bronze";
  return membership.tier as Tier;
}

/** الألعاب الرئيسية الخمس مع حالة الفتح والحد اليومي المتبقي. */
export const getAvailableGameModes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const tier = await currentTier(ctx);
    const tierIndex = TIER_ORDER.indexOf(tier);
    const today = dayKey(Date.now());

    const usedByMode = new Map<string, number>();
    if (userId !== null) {
      const plays = await ctx.db
        .query("gameModePlays")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
        .collect();
      for (const p of plays) {
        usedByMode.set(p.modeId, (usedByMode.get(p.modeId) ?? 0) + 1);
      }
    }

    return MAIN_MODES.map((mode) => {
      const unlocked = tierIndex >= TIER_ORDER.indexOf(mode.minTier);
      const dailyLimit = mode.dailyLimit[tier] ?? 3;
      const usedToday = unlocked ? (usedByMode.get(mode.id) ?? 0) : 0;
      return {
        id: mode.id,
        name: mode.name,
        description: mode.description,
        questionCount: mode.questions,
        timePerQuestion: mode.timePerQuestion,
        minTier: mode.minTier,
        unlocked,
        usedToday,
        dailyLimit,
        remaining: Math.max(0, dailyLimit - usedToday),
        features: [...mode.features],
        rewards: { ...mode.rewards },
      };
    });
  },
});

/** يبدأ جولة في لعبة رئيسية: ينشئ غرفة بإعداداتها ويطلقها فوراً. */
export const createGameModeRound = mutation({
  args: { gameModeId: v.string() },
  handler: async (ctx, { gameModeId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const mode = MAIN_MODES.find((m) => m.id === gameModeId);
    if (!mode) throw new Error("لعبة غير معروفة");

    const tier = await currentTier(ctx);
    if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(mode.minTier)) {
      throw new Error(`«${mode.name}» تتطلب عضوية ${TIER_LABELS[mode.minTier]}`);
    }

    const today = dayKey(Date.now());
    const plays = await ctx.db
      .query("gameModePlays")
      .withIndex("by_user_mode_day", (q) =>
        q.eq("userId", userId).eq("modeId", mode.id).eq("day", today),
      )
      .collect();
    const limit = mode.dailyLimit[tier] ?? 3;
    if (plays.length >= limit) {
      throw new Error(
        `استنفدت جولاتك اليومية في «${mode.name}» (${limit}) — عد غداً أو ارتقِ بعضويتك.`,
      );
    }

    const user = await ctx.db.get(userId);
    if (user?.bannedPermanent) throw new Error("حسابك محظور نهائياً.");

    // حدّ الغرف النشطة — نفس حد الغرف العادي حتى لا تُستنزف الموارد
    const now = Date.now();
    const mine = await ctx.db
      .query("games")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .collect();
    const active = mine.filter((g) => g.status !== "finished");
    if (active.length >= MAX_ACTIVE_ROOMS) {
      throw new Error(
        `لديك ${MAX_ACTIVE_ROOMS} غرف نشطة — أنهِ إحداها قبل بدء جولة جديدة`,
      );
    }

    const settings = {
      questionCount: mode.questions,
      timePerQuestionMs: mode.timePerQuestion * 1000,
      categories: [],
      durationMinutes: DURATION_MODE_OFF,
    };

    // ⚖️ تخصيص الصعوبة: نسبة الأسئلة الصعبة تتكيف مع مهارة اللاعب
    let hardHint: number | undefined;
    try {
      const skill = await ctx.runQuery(internal.fairPlay.getSkillLevel, { userId });
      hardHint = Math.min(0.4, Math.max(0.1, skill * 0.5));
    } catch {
      /* الافتراضي 20% */
    }

    const code = await makeUniqueCode(ctx);
    const questionIds = await pickQuestions(ctx, [], mode.questions, hardHint);

    const gameId = await ctx.db.insert("games", {
      code,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      firstCorrect: [],
      createdAt: now,
      settings,
    });
    await ctx.db.insert("gamePlayers", {
      gameId,
      userId,
      name: sanitizeName(user?.name),
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      joinedAt: now,
    });

    await ctx.db.insert("gameModePlays", {
      userId,
      modeId: mode.id,
      day: today,
      at: now,
    });

    return { code };
  },
});
