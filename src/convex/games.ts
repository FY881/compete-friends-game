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
  BASE_POINTS,
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_NAME_LENGTH,
  QUESTION_COUNT,
  REVEAL_MS,
  SPEED_BONUS,
} from "./gameConfig";
import { QUESTION_BANK, type Question } from "./questions";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type AnswerInfo = {
  questionId: string;
  selected: number;
  correct: boolean;
  points: number;
};

export type GameQuestion = {
  id: string;
  category: string;
  question: string;
  options: string[];
  correctIndex: number | null; // hidden until the question is revealed
};

export type PlayerInfo = {
  id: string;
  name: string;
  score: number;
  answers: (AnswerInfo | null)[];
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
  };
  me: string;
  players: PlayerInfo[];
  questions: GameQuestion[];
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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a challenge room and join it as the host. Returns the join code. */
export const createGame = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    let code = "";
    for (let attempt = 0; attempt < 20 && !code; attempt++) {
      const candidate = makeCode();
      const existing = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .first();
      if (!existing) {
        code = candidate;
      }
    }
    if (!code) {
      throw new Error("تعذّر إنشاء التحدي، حاول مجدداً");
    }

    const questionIds = shuffle(QUESTION_BANK.map((q) => q.id)).slice(0, QUESTION_COUNT);

    const gameId = await ctx.db.insert("games", {
      code,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      createdAt: Date.now(),
    });

    await ctx.db.insert("gamePlayers", {
      gameId,
      userId,
      name: sanitizeName(name),
      score: 0,
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
      await ctx.db.insert("gamePlayers", {
        gameId: game._id,
        userId,
        name: sanitizeName(name),
        score: 0,
        answers: [],
        joinedAt: Date.now(),
      });
    }

    return { code: game.code };
  },
});

/** Leave a room. If the host leaves before the game starts, the room is removed. */
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

    const player = await getPlayer(ctx, game._id, userId);
    if (player) {
      await ctx.db.delete(player._id);
    }

    if (game.hostId === userId) {
      const players = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      for (const p of players) {
        await ctx.db.delete(p._id);
      }
      await ctx.db.delete(game._id);
    }
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

    await ctx.scheduler.runAfter(ANSWER_MS, internal.games.revealQuestion, {
      gameId: game._id,
      index: 0,
    });
  },
});

/**
 * Submit an answer for the current question.
 * Scoring: correct answers earn base points plus a speed bonus that shrinks
 * as the answer window runs out. Wrong answers earn nothing.
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

    const elapsed = Date.now() - game.questionStartedAt;
    if (elapsed > ANSWER_MS) {
      throw new Error("انتهى وقت السؤال");
    }

    const correct = optionIndex === question.correctIndex;
    const remainingRatio = Math.max(0, 1 - elapsed / ANSWER_MS);
    const points = correct
      ? BASE_POINTS + Math.round(SPEED_BONUS * remainingRatio)
      : 0;

    const answers = Array.from(
      { length: questionIndex + 1 },
      (_, i) => player.answers[i] ?? null,
    );
    answers[questionIndex] = {
      questionId,
      selected: optionIndex,
      correct,
      points,
    };

    await ctx.db.patch(player._id, {
      answers,
      score: player.score + points,
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
      return;
    }

    const nextIndex = index + 1;
    const now = Date.now();
    await ctx.db.patch(gameId, {
      currentQuestionIndex: nextIndex,
      phase: "answering",
      questionStartedAt: now,
    });
    await ctx.scheduler.runAfter(ANSWER_MS, internal.games.revealQuestion, {
      gameId,
      index: nextIndex,
    });
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
        isHost: p.userId === game.hostId,
        isMe: p.userId === userId,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      game: {
        id: game._id,
        code: game.code,
        status: game.status,
        phase: game.phase,
        currentQuestionIndex: game.currentQuestionIndex,
        questionStartedAt: game.questionStartedAt,
        questionCount: game.questionIds.length,
      },
      me: userId,
      players: playerInfos,
      questions,
    };
  },
});
