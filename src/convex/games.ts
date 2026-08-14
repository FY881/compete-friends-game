import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  ANSWER_MS,
  CODE_ALPHABET,
  CODE_LENGTH,
  DIFFICULTY_BASE_POINTS,
  DIFFICULTY_SPEED_BONUS,
  FAST_ANSWER_MS,
  LIFELINES_PER_GAME,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_STREAK_BONUS,
  QUESTION_COUNT,
  QUESTION_COUNT_OPTIONS,
  REVEAL_MS,
  STREAK_BONUS_PER_STEP,
  TIME_OPTIONS,
  XP_FOR_STREAK_3,
  XP_FOR_STREAK_5,
  XP_FOR_WIN,
  XP_PER_CORRECT_ANSWER,
  XP_PER_GAME,
  XP_PERFECT_GAME,
  levelFromXp,
} from "./gameConfig";
import { CATEGORIES, QUESTION_BANK, type Question } from "./questions";
import { BADGE_MAP, type Badge } from "./stats";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AnswerInfo = {
  questionId: string;
  selected: number;
  correct: boolean;
  points: number;
  elapsedMs: number;
};

export type GameQuestion = {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correctIndex: number | null; // hidden until the question is revealed
};

export type GameSettings = {
  questionCount: number;
  timePerQuestionMs: number;
  categories: string[];
};

export type MyResult = {
  xpEarned: number;
  rank: number;
  playerCount: number;
  won: boolean;
  badgesEarned: Badge[];
};

export type PlayerInfo = {
  id: string;
  name: string;
  score: number;
  answers: (AnswerInfo | null)[];
  streak: number;
  bestStreak: number;
  fiftyFiftyUsed: boolean; // the player has used their one 50/50 lifeline
  isHost: boolean;
  isMe: boolean;
};

export type GameData = {
  game: {
    id: string;
    code: string;
    status: "waiting" | "playing" | "finished";
    phase: "answering" | "revealing";
    currentQuestionIndex: number;
    questionStartedAt: number;
    questionCount: number;
    settings: GameSettings;
    rematchCode: string | null;
  };
  me: string;
  players: PlayerInfo[];
  questions: GameQuestion[];
  myResult: MyResult | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUESTION_MAP: Record<string, Question> = Object.fromEntries(
  QUESTION_BANK.map((q) => [q.id, q]),
);

const NICKNAMES = [
  "الذئب السريع",
  "الثعلب الماكر",
  "النسر الحاد",
  "النمر المراوغ",
  "البومة الحكيمة",
  "الصقر الجريء",
  "القط الشقي",
  "الدب القوي",
  "الغزال الرشيق",
  "البطل المجهول",
  "العقل المدبّر",
  "سيد البديهة",
  "البرق الخاطف",
  "المحقق الشرس",
  "عقل نيّر",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Pick a question set that mixes difficulties and respects category filters. */
function pickQuestions(categories: string[], count: number): string[] {
  const pool = QUESTION_BANK.filter(
    (q) => categories.length === 0 || categories.includes(q.category),
  );
  if (pool.length === 0) {
    throw new Error("لا توجد أسئلة في الفئات المختارة");
  }

  const easy = shuffle(pool.filter((q) => q.difficulty === "easy"));
  const medium = shuffle(pool.filter((q) => q.difficulty === "medium"));
  const hard = shuffle(pool.filter((q) => q.difficulty === "hard"));

  const nHard = Math.min(hard.length, Math.max(1, Math.floor(count * 0.2)));
  const nMedium = Math.min(medium.length, count - nHard);
  const nEasy = Math.min(easy.length, count - nHard - nMedium);

  const picked: Question[] = shuffle([
    ...easy.slice(0, nEasy),
    ...medium.slice(0, nMedium),
    ...hard.slice(0, nHard),
  ]);

  // Top-up from the remaining pool if a filter left us short.
  const rest = shuffle(pool);
  let i = 0;
  while (picked.length < count && i < rest.length) {
    if (!picked.includes(rest[i])) {
      picked.push(rest[i]);
    }
    i += 1;
  }
  return picked.map((q) => q.id);
}

async function makeUniqueCode(ctx: DbCtx): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = makeCode();
    const existing = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .first();
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("تعذّر إنشاء التحدي، حاول مجدداً");
}

function sanitizeName(raw: string | undefined): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  if (name.length >= 2) {
    return name;
  }
  return pickRandom(NICKNAMES);
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Structural db accessor so the helper works from both queries and mutations. */
type DbCtx = { db: QueryCtx["db"] | MutationCtx["db"] };

async function getGameByCode(ctx: DbCtx, code: string) {
  return await ctx.db
    .query("games")
    .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
    .first();
}

async function getPlayer(ctx: DbCtx, gameId: Id<"games">, userId: Id<"users">) {
  return await ctx.db
    .query("gamePlayers")
    .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", gameId))
    .first();
}

function validateSettings(settings: {
  questionCount: number;
  timePerQuestionMs: number;
  categories: string[];
}) {
  if (
    !(QUESTION_COUNT_OPTIONS as readonly number[]).includes(
      settings.questionCount,
    )
  ) {
    throw new Error("عدد أسئلة غير صالح");
  }
  if (
    !(TIME_OPTIONS as readonly number[]).includes(settings.timePerQuestionMs)
  ) {
    throw new Error("وقت الإجابة غير صالح");
  }
  const unique = [...new Set(settings.categories)];
  if (
    unique.some((c) => !(CATEGORIES as readonly string[]).includes(c))
  ) {
    throw new Error("فئة أسئلة غير صالحة");
  }
  return { ...settings, categories: unique };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a challenge room and join it as the host. Returns the join code. */
export const createGame = mutation({
  args: {
    name: v.optional(v.string()),
    settings: v.optional(
      v.object({
        questionCount: v.number(),
        timePerQuestionMs: v.number(),
        categories: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, { name, settings }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const safeSettings = validateSettings(
      settings ?? {
        questionCount: QUESTION_COUNT,
        timePerQuestionMs: ANSWER_MS,
        categories: [],
      },
    );

    const code = await makeUniqueCode(ctx);
    const questionIds = pickQuestions(
      safeSettings.categories,
      safeSettings.questionCount,
    );

    const gameId = await ctx.db.insert("games", {
      code,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      createdAt: Date.now(),
      settings: safeSettings,
    });

    await ctx.db.insert("gamePlayers", {
      gameId,
      userId,
      name: sanitizeName(name),
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      joinedAt: Date.now(),
    });

    return { code };
  },
});

/** Join a waiting room with a code. */
export const joinGame = mutation({
  args: { code: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { code, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("لا يوجد تحدٍّ بهذا الرمز");
    }
    if (game.status !== "waiting") {
      throw new Error("هذا التحدي بدأ بالفعل");
    }

    const existing = await getPlayer(ctx, game._id, userId);
    if (!existing) {
      const players = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      if (players.length >= MAX_PLAYERS) {
        throw new Error("الغرفة ممتلئة — جرب إنشاء غرفة جديدة");
      }
      await ctx.db.insert("gamePlayers", {
        gameId: game._id,
        userId,
        name: sanitizeName(name),
        score: 0,
        streak: 0,
        bestStreak: 0,
        answers: [],
        joinedAt: Date.now(),
      });
    }

    return { code: game.code };
  },
});

/** Leave a room. If the host leaves, leadership passes to the next player. */
export const leaveGame = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return;
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      return;
    }

    // During a live game a player keeps their row so the scoreboard stays intact.
    const player = await getPlayer(ctx, game._id, userId);
    if (player && game.status === "waiting") {
      await ctx.db.delete(player._id);
    }

    if (game.hostId === userId) {
      const players = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      if (players.length === 0) {
        await ctx.db.delete(game._id);
      } else {
        const nextHost = [...players].sort(
          (a, b) => a.joinedAt - b.joinedAt,
        )[0];
        await ctx.db.patch(game._id, { hostId: nextHost.userId });
      }
    }
  },
});

/** Host adjusts the room rules while everyone is still in the lobby. */
export const updateSettings = mutation({
  args: {
    code: v.string(),
    settings: v.object({
      questionCount: v.number(),
      timePerQuestionMs: v.number(),
      categories: v.array(v.string()),
    }),
  },
  handler: async (ctx, { code, settings }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.hostId !== userId) {
      throw new Error("أنت لست منشئ هذا التحدي");
    }
    if (game.status !== "waiting") {
      throw new Error("لا يمكن تعديل الإعدادات بعد بدء التحدي");
    }

    const safe = validateSettings(settings);
    await ctx.db.patch(game._id, { settings: safe });
  },
});

/** Host starts the challenge: question one begins and the clock starts. */
export const startGame = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.hostId !== userId) {
      throw new Error("أنت لست منشئ هذا التحدي");
    }
    if (game.status !== "waiting") {
      throw new Error("التحدي بدأ بالفعل");
    }

    const now = Date.now();
    await ctx.db.patch(game._id, {
      status: "playing",
      phase: "answering",
      currentQuestionIndex: 0,
      questionStartedAt: now,
    });

    await ctx.scheduler.runAfter(
      game.settings.timePerQuestionMs,
      internal.games.revealQuestion,
      { gameId: game._id, index: 0 },
    );
  },
});

/**
 * Submit an answer for the current question.
 * Scoring: correct answers earn difficulty-scaled base points plus a speed
 * bonus, plus a stacking bonus for consecutive correct answers.
 */
export const submitAnswer = mutation({
  args: {
    code: v.string(),
    questionIndex: v.number(),
    optionIndex: v.number(),
  },
  handler: async (ctx, { code, questionIndex, optionIndex }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.status !== "playing" || game.phase !== "answering") {
      throw new Error("الإجابة غير متاحة الآن");
    }
    if (questionIndex !== game.currentQuestionIndex) {
      throw new Error("هذا السؤال انتهى");
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      throw new Error("إجابة غير صالحة");
    }

    const questionId = game.questionIds[questionIndex];
    const question = QUESTION_MAP[questionId];
    if (!question) {
      throw new Error("سؤال غير موجود");
    }

    const player = await getPlayer(ctx, game._id, userId);
    if (!player) {
      throw new Error("أنت لست ضمن لاعبي هذا التحدي");
    }
    if (player.answers[questionIndex]) {
      return; // already answered — keep the first pick
    }

    const timePerQuestion = game.settings.timePerQuestionMs;
    const elapsed = Date.now() - game.questionStartedAt;
    if (elapsed > timePerQuestion) {
      throw new Error("انتهى وقت السؤال");
    }

    const correct = optionIndex === question.correctIndex;
    const remainingRatio = Math.max(0, 1 - elapsed / timePerQuestion);

    let points = 0;
    let streak = 0;
    let bestStreak = player.bestStreak;
    if (correct) {
      points += DIFFICULTY_BASE_POINTS[question.difficulty];
      points += Math.round(DIFFICULTY_SPEED_BONUS[question.difficulty] * remainingRatio);
      streak = player.streak + 1;
      bestStreak = Math.max(bestStreak, streak);
      points += Math.min(
        MAX_STREAK_BONUS,
        Math.max(0, (streak - 1) * STREAK_BONUS_PER_STEP),
      );
    }

    const answers = Array.from(
      { length: questionIndex + 1 },
      (_, i) => player.answers[i] ?? null,
    );
    answers[questionIndex] = {
      questionId,
      selected: optionIndex,
      correct,
      points,
      elapsedMs: elapsed,
    };

    await ctx.db.patch(player._id, {
      answers,
      score: player.score + points,
      streak,
      bestStreak,
    });

    // If everyone has answered, reveal the correct answer early instead of
    // making the last player wait out the full timer.
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const allAnswered = players.every((p) => p.answers[questionIndex] != null);
    if (allAnswered && players.length > 0) {
      await ctx.scheduler.runAfter(REVEAL_MS, internal.games.revealQuestion, {
        gameId: game._id,
        index: questionIndex,
      });
    }
  },
});

/**
 * Use the 50/50 lifeline: the server picks two *wrong* options to remove,
 * so the client never learns the correct answer ahead of time.
 */
export const useFiftyFifty = mutation({
  args: { code: v.string(), questionIndex: v.number() },
  handler: async (ctx, { code, questionIndex }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.status !== "playing" || game.phase !== "answering") {
      throw new Error("لا يمكن استخدام منقّي الإجابات الآن");
    }
    if (questionIndex !== game.currentQuestionIndex) {
      throw new Error("انتهى السؤال");
    }

    const player = await getPlayer(ctx, game._id, userId);
    if (!player) {
      throw new Error("أنت لست ضمن لاعبي هذا التحدي");
    }
    if (player.fiftyFiftyUsedFor != null) {
      throw new Error("استخدمت منقّي الإجابات مسبقاً في هذه الجولة");
    }
    if (player.answers[questionIndex]) {
      throw new Error("لا يمكن استخدام المنقّي بعد الإجابة");
    }

    const question = QUESTION_MAP[game.questionIds[questionIndex]];
    const wrong = [0, 1, 2, 3].filter((i) => i !== question.correctIndex);
    const hidden = shuffle(wrong).slice(0, 2);

    await ctx.db.patch(player._id, { fiftyFiftyUsedFor: questionIndex });
    return { hidden };
  },
});

/** Host starts a fresh round with the same players and the same settings. */
export const rematch = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.hostId !== userId) {
      throw new Error("أنت لست منشئ هذا التحدي");
    }
    if (game.status !== "finished") {
      throw new Error("الجولة لم تنتهِ بعد");
    }

    // Idempotent: reuse the rematch room if one already exists.
    const existing = await ctx.db
      .query("games")
      .withIndex("by_rematch", (q) => q.eq("rematchOf", game._id))
      .first();
    if (existing) {
      return { code: existing.code };
    }

    const newCode = await makeUniqueCode(ctx);
    const questionIds = pickQuestions(
      game.settings.categories,
      game.settings.questionCount,
    );

    const gameId = await ctx.db.insert("games", {
      code: newCode,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      createdAt: Date.now(),
      settings: game.settings,
      rematchOf: game._id,
    });

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    for (const p of players) {
      await ctx.db.insert("gamePlayers", {
        gameId,
        userId: p.userId,
        name: p.name,
        score: 0,
        streak: 0,
        bestStreak: 0,
        answers: [],
        joinedAt: Date.now(),
      });
    }

    return { code: newCode };
  },
});

// ---------------------------------------------------------------------------
// Internal phase transitions (driven by the server scheduler)
// ---------------------------------------------------------------------------

/** Answer window over → show the correct answer for a few seconds. */
export const revealQuestion = internalMutation({
  args: { gameId: v.id("games"), index: v.number() },
  handler: async (ctx, { gameId, index }) => {
    const game = await ctx.db.get(gameId);
    if (
      !game ||
      game.status !== "playing" ||
      game.currentQuestionIndex !== index ||
      game.phase !== "answering"
    ) {
      return; // stale job — the phase already moved on
    }

    await ctx.db.patch(gameId, { phase: "revealing" });
    await ctx.scheduler.runAfter(REVEAL_MS, internal.games.advanceQuestion, {
      gameId,
      index,
    });
  },
});

/** Reveal over → next question, or finish the game. */
export const advanceQuestion = internalMutation({
  args: { gameId: v.id("games"), index: v.number() },
  handler: async (ctx, { gameId, index }) => {
    const game = await ctx.db.get(gameId);
    if (
      !game ||
      game.status !== "playing" ||
      game.currentQuestionIndex !== index ||
      game.phase !== "revealing"
    ) {
      return; // stale job — the phase already moved on
    }

    if (index >= game.questionIds.length - 1) {
      await ctx.db.patch(gameId, { status: "finished" });
      await ctx.scheduler.runAfter(0, internal.games.finishGame, { gameId });
      return;
    }

    const nextIndex = index + 1;
    const now = Date.now();
    await ctx.db.patch(gameId, {
      currentQuestionIndex: nextIndex,
      phase: "answering",
      questionStartedAt: now,
    });
    await ctx.scheduler.runAfter(
      game.settings.timePerQuestionMs,
      internal.games.revealQuestion,
      { gameId, index: nextIndex },
    );
  },
});

/**
 * The game is over: award XP, update lifetime profiles, record history and
 * unlock badges for every player. Runs once per game.
 */
export const finishGame = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "finished") {
      return;
    }

    const existing = await ctx.db
      .query("gameHistory")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .first();
    if (existing) {
      return; // already finalized
    }

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    const sorted = [...players].sort(
      (a, b) => b.score - a.score || a.joinedAt - b.joinedAt,
    );
    const questionCount = game.questionIds.length;
    const now = Date.now();

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const rank = i + 1;
      const answered = p.answers.filter(
        (a): a is AnswerInfo => a !== null,
      );
      const correctCount = answered.filter((a) => a.correct).length;
      const won = rank === 1;

      let xp = XP_PER_GAME + correctCount * XP_PER_CORRECT_ANSWER;
      if (won) xp += XP_FOR_WIN;
      if (p.bestStreak >= 3) xp += XP_FOR_STREAK_3;
      if (p.bestStreak >= 5) xp += XP_FOR_STREAK_5;
      if (correctCount === questionCount && questionCount >= 3) {
        xp += XP_PERFECT_GAME;
      }

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", p.userId))
        .first();
      const had = new Set(profile?.badges ?? []);
      const next = new Set(had);

      if (won) next.add("first_win");
      if (p.bestStreak >= 3) next.add("streak_3");
      if (p.bestStreak >= 5) next.add("streak_5");
      if (correctCount === questionCount && questionCount >= 3) {
        next.add("perfect");
      }
      if (answered.some((a) => a.correct && a.elapsedMs <= FAST_ANSWER_MS)) {
        next.add("fast");
      }
      const gamesAfter = (profile?.gamesPlayed ?? 0) + 1;
      if (gamesAfter >= 10) next.add("games_10");
      if (gamesAfter >= 50) next.add("games_50");
      if ((profile?.correctAnswers ?? 0) + correctCount >= 100) {
        next.add("answers_100");
      }
      const winsAfter = (profile?.gamesWon ?? 0) + (won ? 1 : 0);
      if (winsAfter >= 5) next.add("wins_5");
      if (levelFromXp((profile?.xp ?? 0) + xp) >= 10) {
        next.add("level_10");
      }
      if (
        correctCount === questionCount &&
        questionCount >= 3 &&
        answered.every((a) => a.elapsedMs <= game.settings.timePerQuestionMs / 2)
      ) {
        next.add("speed_demon");
      }

      const badgesEarned = [...next].filter((id) => !had.has(id));
      const fastTimes = answered.filter((a) => a.correct).map((a) => a.elapsedMs);
      const fastest =
        fastTimes.length > 0 ? Math.min(...fastTimes) : undefined;

      const patch = {
        userId: p.userId,
        xp: (profile?.xp ?? 0) + xp,
        gamesPlayed: gamesAfter,
        gamesWon: (profile?.gamesWon ?? 0) + (won ? 1 : 0),
        bestScore: Math.max(profile?.bestScore ?? 0, p.score),
        bestStreak: Math.max(profile?.bestStreak ?? 0, p.bestStreak),
        correctAnswers: (profile?.correctAnswers ?? 0) + correctCount,
        totalAnswers: (profile?.totalAnswers ?? 0) + answered.length,
        fastestAnswerMs:
          fastest !== undefined
            ? Math.min(profile?.fastestAnswerMs ?? Number.POSITIVE_INFINITY, fastest)
            : profile?.fastestAnswerMs,
        badges: [...next],
        updatedAt: now,
      };

      if (profile) {
        await ctx.db.patch(profile._id, patch);
      } else {
        await ctx.db.insert("profiles", patch);
      }

      await ctx.db.insert("gameHistory", {
        gameId,
        userId: p.userId,
        gameCode: game.code,
        rank,
        playerCount: sorted.length,
        score: p.score,
        correctCount,
        questionCount,
        xpEarned: xp,
        won,
        badgesEarned,
        playedAt: now,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Live state of a game room, subscribed by every player in the room. */
export const getGame = query({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<GameData | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      return null;
    }

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();

    const currentRevealed =
      game.status === "finished" || game.phase === "revealing";
    const visibleCount = game.status === "waiting" ? 0 : game.currentQuestionIndex + 1;
    const questions: GameQuestion[] = game.questionIds
      .slice(0, visibleCount)
      .map((qid, i) => {
        const q = QUESTION_MAP[qid];
        const revealed = i < game.currentQuestionIndex || currentRevealed;
        return {
          id: q.id,
          category: q.category,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options,
          correctIndex: revealed ? q.correctIndex : null,
        };
      });

    const playerInfos: PlayerInfo[] = players
      .map((p) => ({
        id: p._id,
        name: p.name,
        score: p.score,
        answers: p.answers,
        streak: p.streak,
        bestStreak: p.bestStreak,
        fiftyFiftyUsed: p.fiftyFiftyUsedFor != null,
        isHost: p.userId === game.hostId,
        isMe: p.userId === userId,
      }))
      .sort((a, b) => b.score - a.score);

    let rematchCode: string | null = null;
    let myResult: MyResult | null = null;
    if (game.status === "finished") {
      const rematch = await ctx.db
        .query("games")
        .withIndex("by_rematch", (q) => q.eq("rematchOf", game._id))
        .first();
      if (rematch) {
        rematchCode = rematch.code;
      }

      const row = await ctx.db
        .query("gameHistory")
        .withIndex("by_user_game", (q) =>
          q.eq("userId", userId).eq("gameId", game._id),
        )
        .first();
      if (row) {
        myResult = {
          xpEarned: row.xpEarned,
          rank: row.rank,
          playerCount: row.playerCount,
          won: row.won,
          badgesEarned: row.badgesEarned
            .map((id) => BADGE_MAP[id])
            .filter(Boolean),
        };
      }
    }

    return {
      game: {
        id: game._id,
        code: game.code,
        status: game.status,
        phase: game.phase,
        currentQuestionIndex: game.currentQuestionIndex,
        questionStartedAt: game.questionStartedAt,
        questionCount: game.questionIds.length,
        settings: game.settings,
        rematchCode,
      },
      me: userId,
      players: playerInfos,
      questions,
      myResult,
    };
  },
});

export { LIFELINES_PER_GAME };
