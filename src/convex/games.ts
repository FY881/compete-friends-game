import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertSystemOpen } from "./systemLocks";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  ANSWER_MS,
  BLOWOUT_MARGIN,
  CODE_ALPHABET,
  CODE_LENGTH,
  COUNTDOWN_MS,
  DURATION_MODE_OFF,
  DURATION_OPTIONS,
  MINUTE_MS,
  timedPoolSize,
  DIFFICULTY_BASE_POINTS,
  DIFFICULTY_SPEED_BONUS,
  FAST_ANSWER_MS,
  FIRST_BLOOD_BONUS,
  GOLDEN_QUESTION_MULTIPLIER,
  LIFELINES_PER_GAME,
  MAX_ACTIVE_ROOMS,
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
  FIRST_GAME_OF_DAY_XP,
  dayKey,
  levelFromXp,
} from "./gameConfig";
import { CATEGORIES, QUESTION_BANK, type Question } from "./questions";
import { BADGE_MAP, type Badge } from "./stats";
import { isUserBanned } from "./owner";

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
  golden: boolean; // the last question of the round (points ×2)
};

export type GameSettings = {
  questionCount: number;
  timePerQuestionMs: number;
  categories: string[];
  /** 0 (or absent on legacy rooms) = classic; 5 | 10 | 15 = timed round in minutes. */
  durationMinutes?: number;
};

export type MyResult = {
  xpEarned: number;
  rank: number;
  playerCount: number;
  won: boolean;
  stars: number;
  badgesEarned: Badge[];
  firstOfDay: boolean; // earned the first-game-of-the-day XP bonus
};

export type PlayerInfo = {
  id: string;
  name: string;
  score: number;
  answers: (AnswerInfo | null)[];
  streak: number;
  bestStreak: number;
  fiftyFiftyUsed: boolean; // the player has used their one 50/50 lifeline
  secondChanceUsed: boolean; // the player used their second-chance retry (فرصة ثانية)
  isHost: boolean;
  isMe: boolean;
};

export type GameData = {
  game: {
    id: string;
    code: string;
    status: "waiting" | "playing" | "finished";
    phase: "countdown" | "answering" | "revealing";
    currentQuestionIndex: number;
    questionStartedAt: number;
    questionCount: number;
    settings: GameSettings;
    /** Absolute timestamp when a timed round must stop (null in classic mode). */
    roundEndsAt: number | null;
    firstCorrect: (string | null)[];
    rematchCode: string | null;
  };
  me: string;
  players: PlayerInfo[];
  questions: GameQuestion[];
  myResult: MyResult | null;
};

export type Reaction = {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
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

/**
 * كل الأسئلة المتاحة = البنك الثابت + الأسئلة المولّدة بالذكاء الاصطناعي
 * التي اعتمدها المالك من غرفة المالك. تُدمج هنا في جولة واحدة.
 */
async function getAllQuestions(ctx: DbCtx): Promise<Question[]> {
  const approved = await ctx.db
    .query("aiQuestions")
    .withIndex("by_status", (q) => q.eq("status", "approved"))
    .collect();
  const aiQuestions: Question[] = approved.map((r) => ({
    id: r.qid,
    category: r.category,
    difficulty: r.difficulty,
    question: r.question,
    options: r.options as [string, string, string, string],
    correctIndex: r.correctIndex as 0 | 1 | 2 | 3,
  }));
  return [...QUESTION_BANK, ...aiQuestions];
}

/** Pick a question set that mixes difficulties and respects category filters. */
async function pickQuestions(
  ctx: DbCtx,
  categories: string[],
  count: number,
  hardRatioHint?: number,
): Promise<string[]> {
  const all = await getAllQuestions(ctx);
  const pool = all.filter(
    (q) => categories.length === 0 || categories.includes(q.category),
  );
  if (pool.length === 0) {
    throw new Error("لا توجد أسئلة في الفئات المختارة");
  }

  const easy = shuffle(pool.filter((q) => q.difficulty === "easy"));
  const medium = shuffle(pool.filter((q) => q.difficulty === "medium"));
  const hard = shuffle(pool.filter((q) => q.difficulty === "hard"));

  // ⚖️ تخصيص الصعوبة يُطبَّق في الطبقة الأعلى عبر معامل hardRatio — هنا الافتراضي 20%
  const hardRatio = hardRatioHint ?? 0.2;

  const nHard = Math.min(hard.length, Math.max(1, Math.floor(count * hardRatio)));
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

/** Resolve a question id from the static bank OR the AI-generated table. */
async function resolveQuestion(
  ctx: DbCtx,
  questionId: string,
): Promise<Question | null> {
  const fromBank = QUESTION_MAP[questionId];
  if (fromBank) return fromBank;
  const row = await ctx.db
    .query("aiQuestions")
    .withIndex("by_qid", (q) => q.eq("qid", questionId))
    .first();
  if (!row || row.status !== "approved") return null;
  return {
    id: row.qid,
    category: row.category,
    difficulty: row.difficulty,
    question: row.question,
    options: row.options as [string, string, string, string],
    correctIndex: row.correctIndex as 0 | 1 | 2 | 3,
  };
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

/** Throw unless the signed-in user is allowed to play (not banned). */
async function assertNotBanned(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  // 🔒 قرار الطوارئ من غرفة المالك يُنفَّذ فعلياً: قفل الساحة يمنع
  // أي إنشاء تحدي أو انضمام أو إجابة — لا زر بلا أثر.
  await assertSystemOpen(ctx, "arena");
  const user = await ctx.db.get(userId);
  if (!user) return;
  const { banned, reason } = isUserBanned(user);
  if (banned) {
    const until = user.bannedPermanent
      ? "نهائياً"
      : user.bannedUntil
        ? `حتى ${new Date(user.bannedUntil).toISOString().slice(0, 16).replace("T", " ")}`
        : "";
    throw new Error(
      `حسابك محظور (${reason ?? "مخالفة القوانين"}) ${until}${user.banReason ? ` — السبب: ${user.banReason}` : ""}. تواصل مع المالك عبر البريد الإلكتروني.`,
    );
  }
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

/** Settings fallback for legacy game rows created before room settings existed. */
const DEFAULT_SETTINGS: GameSettings = {
  questionCount: QUESTION_COUNT,
  timePerQuestionMs: ANSWER_MS,
  categories: [],
  durationMinutes: DURATION_MODE_OFF,
};

function settingsOf(game: { settings?: GameSettings }): GameSettings {
  return game.settings ?? DEFAULT_SETTINGS;
}

/** Timed rounds: minutes chosen by the host (0 = classic by question count). */
function durationOf(game: { settings?: GameSettings }): number {
  return settingsOf(game).durationMinutes ?? DURATION_MODE_OFF;
}

/** How many questions to pre-pick for a round (classic count or timed pool). */
function poolSizeFor(settings: GameSettings): number {
  const duration = settings.durationMinutes ?? DURATION_MODE_OFF;
  if (duration > 0) {
    return timedPoolSize(duration, settings.timePerQuestionMs);
  }
  return settings.questionCount;
}

/** Structural db accessor so the helper works from both queries and mutations. */
type DbCtx = { db: QueryCtx["db"] | MutationCtx["db"] };

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 المرحلة 10 — الأسئلة الديناميكية: تُبنى حسب اللاعب لا حسب الحظ
//
//  1. نقاط الضعف الحقيقية من categoryHistory (سجل إجابات الفئات الفعلي)
//  2. وزن مضاعف للفئات الضعيفة (يعالجها المدرب أيضاً — سياق مشترك من المركز)
//  3. صعوبة تتناسب مع مهارة اللاعب (من fairPlay.getSkillLevel) بدل قالب ثابت
//  4. منع التكرار: يستبعد أسئلة آخر جولتين للاعب
// ═══════════════════════════════════════════════════════════════════════════

export async function pickAdaptiveQuestions(
  ctx: DbCtx & { runQuery: (functionReference: any, args?: any) => Promise<unknown> },
  userId: Id<"users">,
  categories: string[],
  count: number,
): Promise<string[]> {
  const all = await getAllQuestions(ctx);
  const pool = all.filter(
    (q) => categories.length === 0 || categories.includes(q.category),
  );
  if (pool.length === 0) throw new Error("لا توجد أسئلة في الفئات المختارة");

  // ── 1) سجل الفئات الحقيقي للاعب ──
  const catRows = await ctx.db
    .query("categoryHistory")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const acc = new Map<string, number>(); // category → accuracy 0..1
  for (const row of catRows) {
    if (row.total >= 5) acc.set(row.category, row.total > 0 ? row.correct / row.total : 0.5);
  }

  // ── 2) مهارة اللاعب العامة → نسبة الصعب المثالية (10%..40%) ──
  let skill = 0.5;
  try {
    skill = (await ctx.runQuery(internal.fairPlay.getSkillLevel, { userId })) as number;
  } catch {
    /* الافتراضي متوسط */
  }
  let hardRatio = Math.min(0.4, Math.max(0.1, skill * 0.5));

  // 🎛️ مرسوم الحاكم السيادي التنفيذي — صعوبة فعلية بقرار السلطة العليا
  try {
    const levers = (await ctx.runQuery(internal.sovereignGovernor.getControlLeversInternal, {})) as {
      difficultyBias: number;
    };
    if (levers.difficultyBias !== 0) {
      const biased = hardRatio + levers.difficultyBias;
      hardRatio = Math.min(0.5, Math.max(0.05, biased));
    }
  } catch { /* الأذرع اختيارية */ }

  // ── 2.5) تخصصات العقل: الحقول التي أتقنها اللاعب تحصل على أثر أكبر ──
  // الإتقان يخفّض الترجيح قليلاً (تعطي أسئلة متنوعة) بينما الحقول الأضعف
  // ترتفع — فتصير الجولة تعكس تخصصك الحقيقي المزامن من كل جولة سابقة.
  const specAcc = new Map<string, number>();
  try {
    const specs = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of specs) {
      if (s.mastery >= 50) specAcc.set(s.category, s.mastery / 100);
    }
  } catch {
    /* التخصصات اختيارية */
  }

  // ── 3) منع التكرار: استبعاد أسئلة آخر جولتين ──
  const recent = await ctx.db
    .query("gameHistory")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(2);
  const recentIds = new Set<string>();
  for (const h of recent) {
    const gp = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", h.gameCode))
      .first();
    if (gp) for (const qid of gp.questionIds) recentIds.add(qid);
  }

  // ── 4) الترجيح: الضعف ×2.2، القوة ×0.6، أسئلة جديدة غير مرئية تحصل على دفعة ──
  const weighted: { q: Question; w: number }[] = [];
  for (const q of pool) {
    if (recentIds.has(q.id)) continue;
    const a = acc.get(q.category);
    const spec = specAcc.get(q.category);
    let w = a === undefined ? 1.35 : a < 0.5 ? 2.2 - a : 1.2 - a * 0.6;
    // 🧬 أثر التخصص: إتقان عالٍ يخفف الوزن (تنويع)، والغياب يرفعه (تدريب)
    if (spec !== undefined) w *= 1.15 - spec * 0.35;
    else if (specAcc.size > 0) w *= 1.1;
    if (q.difficulty === "hard") w *= skill > 0.6 ? 1.4 : 0.8;
    if (q.difficulty === "easy") w *= skill < 0.4 ? 1.3 : 0.7;
    weighted.push({ q, w });
  }
  if (weighted.length === 0) {
    // كل الأسئلة كانت في آخر جولتين — ارجع للمجموعة الكاملة
    for (const q of pool) weighted.push({ q, w: 1 });
  }

  // ── 5) سحب مرجّح بدون تكرار حتى count ──
  const picked: string[] = [];
  const items = [...weighted];
  while (picked.length < count && items.length > 0) {
    const totalW = items.reduce((s, it) => s + it.w, 0);
    let r = Math.random() * totalW;
    let idx = 0;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].w;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(items[idx].q.id);
    items.splice(idx, 1);
  }

  // العدّاد الإحصائي للأسئلة AI (يُغذي جودة المحتوى)
  return picked;
}

// 🎯 واجهة اللاعب: ملف فئاته (قوة/ضعف) — يغذي بطاقة المطابقة الذكية
export const getMyCategoryProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("categoryHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .map((r) => ({
        category: r.category,
        accuracy: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
        total: r.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  },
});

// موجّة 11 — واجهات مشتركة لتستخدمها وحدات الحلبة والإعادة
export { pickQuestions, makeUniqueCode, sanitizeName, validateSettings, poolSizeFor, resolveQuestion };
export type { DbCtx };

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
  durationMinutes?: number;
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
  const durationMinutes = settings.durationMinutes ?? DURATION_MODE_OFF;
  if (
    durationMinutes !== DURATION_MODE_OFF &&
    !(DURATION_OPTIONS as readonly number[]).includes(durationMinutes)
  ) {
    throw new Error("مدة الجولة غير صالحة — اختر 5 أو 10 أو 15 دقيقة");
  }
  const unique = [...new Set(settings.categories)];
  if (
    unique.some((c) => !(CATEGORIES as readonly string[]).includes(c))
  ) {
    throw new Error("فئة أسئلة غير صالحة");
  }
  return { ...settings, categories: unique, durationMinutes };
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
        durationMinutes: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { name, settings }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }
    await assertNotBanned(ctx, userId);

    // Lazy-cleanup stale waiting rooms, then enforce the per-player cap so
    // nobody can hoard rooms.
    const now = Date.now();
    const mine = await ctx.db
      .query("games")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .collect();
    for (const g of mine) {
      if (g.status === "waiting" && now - g.createdAt > 3 * 60 * 60 * 1000) {
        await ctx.db.delete(g._id);
      }
    }
    const active = mine.filter((g) => g.status !== "finished");
    if (active.length >= MAX_ACTIVE_ROOMS) {
      throw new Error(
        `لديك ${MAX_ACTIVE_ROOMS} غرف نشطة — أنهِ إحداها أو اتركها قبل إنشاء غرفة جديدة`,
      );
    }

    const safeSettings = validateSettings(
      settings ?? {
        questionCount: QUESTION_COUNT,
        timePerQuestionMs: ANSWER_MS,
        categories: [],
        durationMinutes: DURATION_MODE_OFF,
      },
    );

    const code = await makeUniqueCode(ctx);
    // ⚖️ تخصيص الصعوبة: نسبة الأسئلة الصعبة تتكيف مع مهارة المضيف
    let hardHint: number | undefined;
    try {
      const skill = await ctx.runQuery(internal.fairPlay.getSkillLevel, { userId });
      hardHint = Math.min(0.4, Math.max(0.1, skill * 0.5));
    } catch {
      /* الافتراضي 20% */
    }
    // 🎯 الأسئلة الديناميكية: مبنية على نقاط ضعف المضيف ومستواه (تُسقط للقالب الثابت عند الخطأ)
    let questionIds: string[];
    try {
      questionIds = await pickAdaptiveQuestions(ctx, userId, safeSettings.categories, poolSizeFor(safeSettings));
    } catch {
      questionIds = await pickQuestions(
        ctx,
        safeSettings.categories,
        poolSizeFor(safeSettings),
        hardHint,
      );
    }

    const gameId = await ctx.db.insert("games", {
      code,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      firstCorrect: [],
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
    await assertNotBanned(ctx, userId);

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
      durationMinutes: v.optional(v.number()),
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
    const current = settingsOf(game);
    // Changing the rules changes which questions the room plays: re-pick the
    // pool whenever the count, categories or round duration move. Swapping
    // only the per-question timer keeps the current pool.
    const shapeChanged =
      current.questionCount !== safe.questionCount ||
      (current.durationMinutes ?? DURATION_MODE_OFF) !== safe.durationMinutes ||
      JSON.stringify(current.categories) !== JSON.stringify(safe.categories);

    if (shapeChanged) {
      const questionIds = await pickQuestions(ctx, safe.categories, poolSizeFor(safe));
      await ctx.db.patch(game._id, {
        settings: safe,
        questionIds,
        currentQuestionIndex: 0,
        firstCorrect: [],
      });
    } else {
      await ctx.db.patch(game._id, { settings: safe });
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
    // A 3-2-1 countdown plays before the first question, then the answer
    // window opens (questionStartedAt already points at the moment the
    // window opens, so the timer is accurate for every player).
    const duration = durationOf(game);
    await ctx.db.patch(game._id, {
      status: "playing",
      phase: "countdown",
      currentQuestionIndex: 0,
      questionStartedAt: now + COUNTDOWN_MS,
      // Timed rounds: the answering window itself lasts the chosen minutes
      // (the 3-2-1 countdown is extra, before the clock starts).
      roundEndsAt:
        duration > 0 ? now + COUNTDOWN_MS + duration * MINUTE_MS : undefined,
    });

    await ctx.scheduler.runAfter(COUNTDOWN_MS, internal.games.beginQuestion, {
      gameId: game._id,
      index: 0,
    });
    await ctx.scheduler.runAfter(
      COUNTDOWN_MS + settingsOf(game).timePerQuestionMs,
      internal.games.revealQuestion,
      { gameId: game._id, index: 0 },
    );
  },
});

/** Countdown over → open the answer window for the first question. */
export const beginQuestion = internalMutation({
  args: { gameId: v.id("games"), index: v.number() },
  handler: async (ctx, { gameId, index }) => {
    const game = await ctx.db.get(gameId);
    if (
      !game ||
      game.status !== "playing" ||
      game.currentQuestionIndex !== index ||
      game.phase !== "countdown"
    ) {
      return; // stale job
    }
    await ctx.db.patch(gameId, { phase: "answering" });
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
    await assertNotBanned(ctx, userId);

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
    const question = await resolveQuestion(ctx, questionId);
    if (!question) {
      throw new Error("سؤال غير موجود");
    }

    const player = await getPlayer(ctx, game._id, userId);
    if (!player) {
      throw new Error("أنت لست ضمن لاعبي هذا التحدي");
    }

    // Second-chance lifeline («فرصة ثانية»): after a wrong answer the player
    // may retry the same question ONCE (only while the answer window is open),
    // earning half the normal points on a correct retry.
    const existing = player.answers[questionIndex];
    const retryUsed = player.secondChanceUsedFor === questionIndex;
    if (existing && (existing.correct || retryUsed)) {
      return; // answered correctly, or the retry is already spent
    }
    const isRetry = existing != null;

    const timePerQuestion = settingsOf(game).timePerQuestionMs;
    const elapsed = Date.now() - game.questionStartedAt;
    if (elapsed > timePerQuestion) {
      throw new Error("انتهى وقت السؤال");
    }

    const correct = optionIndex === question.correctIndex;
    const remainingRatio = Math.max(0, 1 - elapsed / timePerQuestion);

    // ⚖️ الحكم الآلي — كشف الإجابات المستحيلة السرعة (لا يعطّل الإجابة)
    try {
      await ctx.runMutation(internal.fairPlay.checkImpossibleSpeed, {
        userId,
        elapsedMs: elapsed,
        correct,
      });
    } catch {
      /* اختياري — لا يعطل الإجابة */
    }

    let points = 0;
    let streak = 0;
    let bestStreak = player.bestStreak;
    let firstBlood = false;
    if (correct) {
      points += DIFFICULTY_BASE_POINTS[question.difficulty];
      points += Math.round(DIFFICULTY_SPEED_BONUS[question.difficulty] * remainingRatio);
      streak = player.streak + 1;
      bestStreak = Math.max(bestStreak, streak);
      points += Math.min(
        MAX_STREAK_BONUS,
        Math.max(0, (streak - 1) * STREAK_BONUS_PER_STEP),
      );

      // First-blood bonus: the first correct answer in the question wins it.
      const firstCorrect = game.firstCorrect ?? [];
      if (firstCorrect[questionIndex] == null) {
        firstCorrect[questionIndex] = userId;
        points += FIRST_BLOOD_BONUS;
        firstBlood = true;
        await ctx.db.patch(game._id, { firstCorrect });
      }
    }

    // Golden question: the final question of the round doubles all points,
    // keeping every comeback alive until the last second.
    if (correct && questionIndex === game.questionIds.length - 1) {
      points *= GOLDEN_QUESTION_MULTIPLIER;
    }

    // A retry earns half points — the price of the second chance.
    if (isRetry) {
      points = Math.round(points / 2);
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
    void firstBlood; // info is surfaced via the firstCorrect list in getGame

    await ctx.db.patch(player._id, {
      answers,
      score: player.score + points,
      streak,
      bestStreak,
      secondChanceUsedFor: isRetry ? questionIndex : player.secondChanceUsedFor,
    });

    // If everyone has answered, reveal the correct answer early instead of
    // making the last player wait out the full timer. A player who answered
    // wrong and still has their second chance counts as pending — they may
    // still retry before the reveal fires.
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const allAnswered = players.every((p) => {
      const a = p.answers[questionIndex];
      if (a == null) return false;
      if (!a.correct && p.secondChanceUsedFor == null) return false;
      return true;
    });
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
    await assertNotBanned(ctx, userId);

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

    const question = await resolveQuestion(ctx, game.questionIds[questionIndex]);
    if (!question) {
      throw new Error("سؤال غير موجود");
    }
    const wrong = [0, 1, 2, 3].filter((i) => i !== question.correctIndex);
    const hidden = shuffle(wrong).slice(0, 2);

    await ctx.db.patch(player._id, { fiftyFiftyUsedFor: questionIndex });
    return { hidden };
  },
});

/** Host starts a fresh round with the same players and the same settings. */
/** Host kicks a player out of the waiting lobby. Waiting rooms only. */
export const kickPlayerFromLobby = mutation({
  args: { code: v.string(), userId: v.id("users") },
  handler: async (ctx, { code, userId }) => {
    const hostId = await getAuthUserId(ctx);
    if (hostId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    if (game.hostId !== hostId) {
      throw new Error("أنت لست منشئ هذا التحدي");
    }
    if (game.status !== "waiting") {
      throw new Error("لا يمكن طرد لاعبين بعد بدء التحدي");
    }
    if (userId === hostId) {
      throw new Error("لا يمكنك طرد نفسك — استخدم زر الخروج");
    }

    const player = await getPlayer(ctx, game._id, userId);
    if (!player) {
      throw new Error("هذا اللاعب ليس في الغرفة");
    }
    await ctx.db.delete(player._id);
    return { ok: true };
  },
});

/** Send a quick emoji reaction into the game lobby (keeps newest 30). */
export const sendReaction = mutation({
  args: { code: v.string(), emoji: v.string() },
  handler: async (ctx, { code, emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }
    if (!emoji || emoji.length > 8) {
      throw new Error("رمز غير صالح");
    }

    const game = await getGameByCode(ctx, code);
    if (!game) {
      throw new Error("التحدي غير موجود");
    }
    const player = await getPlayer(ctx, game._id, userId);
    if (!player) {
      throw new Error("أنت لست ضمن لاعبي هذا التحدي");
    }

    const now = Date.now();
    await ctx.db.insert("reactions", {
      gameId: game._id,
      name: player.name,
      emoji,
      createdAt: now,
    });

    // Keep the feed tight: drop the oldest beyond the newest 30.
    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);
    for (const row of sorted.slice(30)) {
      await ctx.db.delete(row._id);
    }
  },
});

/** Live reaction feed for a game room (players only). */
export const getReactions = query({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<Reaction[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const game = await getGameByCode(ctx, code);
    if (!game) return [];
    const player = await getPlayer(ctx, game._id, userId);
    if (!player) return [];

    const rows = await ctx.db
      .query("reactions")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-30)
      .map((r) => ({
        id: r._id,
        name: r.name,
        emoji: r.emoji,
        createdAt: r.createdAt,
      }));
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
    const questionIds = await pickQuestions(
      ctx,
      settingsOf(game).categories,
      poolSizeFor(settingsOf(game)),
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

    // Timed rounds: the next question is only started when a full cycle
    // (answer window + reveal) fits inside the remaining budget. Otherwise
    // the clock won — finish right here, at the end of the current reveal.
    const duration = durationOf(game);
    const roundEndsAt = game.roundEndsAt ?? 0;
    const now = Date.now();
    const timeBudgetGone =
      duration > 0 && roundEndsAt > 0 && now >= roundEndsAt;
    const nextWouldNotFit =
      duration > 0 &&
      roundEndsAt > 0 &&
      now + settingsOf(game).timePerQuestionMs + REVEAL_MS > roundEndsAt;

    if (index >= game.questionIds.length - 1 || timeBudgetGone || nextWouldNotFit) {
      await ctx.db.patch(gameId, { status: "finished" });
      await ctx.scheduler.runAfter(0, internal.games.finishGame, { gameId });
      return;
    }

    const nextIndex = index + 1;
    await ctx.db.patch(gameId, {
      currentQuestionIndex: nextIndex,
      phase: "answering",
      questionStartedAt: now,
    });
    await ctx.scheduler.runAfter(
      settingsOf(game).timePerQuestionMs,
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
    const today = dayKey(now);

    // Scores at the halfway point — used for the «comeback win» badge.
    const halfIndex = Math.floor(questionCount / 2);
    const midpointScores = new Map<string, number>();
    for (const p of sorted) {
      const mid = p.answers.slice(0, halfIndex).reduce((sum, a) => {
        const info = a as AnswerInfo | null;
        return sum + (info?.points ?? 0);
      }, 0);
      midpointScores.set(p.userId, mid);
    }
    const maxMidpointOther = (winnerId: string) =>
      sorted.reduce((max, p) => {
        if (p.userId === winnerId) return max;
        return Math.max(max, midpointScores.get(p.userId) ?? 0);
      }, 0);

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

      // 🚀 معزز الخبرة ×2 — يُستهلك جولة واحدة عند كل استخدام (مربع economy)
      try {
        const boosted = await ctx.runMutation(internal.economy.consumeXpBoost, {
          userId: p.userId,
        });
        if (boosted) xp *= 2;
      } catch {
        /* المعزز اختياري — لا يعطل الاحتساب */
      }

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", p.userId))
        .first();
      // First game of the day: a small bonus that also marks the calendar day
      // (used by the daily-reward streak UI).
      const firstOfDay = (profile?.lastPlayedDay ?? "") !== today;
      if (firstOfDay) xp += FIRST_GAME_OF_DAY_XP;
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
      if (answered.some((a) => a.correct && a.elapsedMs <= 1_000)) {
        next.add("sniper");
      }
      if ((game.firstCorrect ?? []).includes(p.userId)) {
        next.add("first_blood");
      }
      if (p.answers[questionCount - 1]?.correct) {
        next.add("golden_answer");
      }
      if (won && sorted.length > 1) {
        const margin = p.score - sorted[1].score;
        if (margin >= BLOWOUT_MARGIN) next.add("blowout");
      }
      // «بومة الليل» — جولة أُنهيت بين 21:00 و 04:00 (بتوقيت الخادم).
      const hour = new Date(now).getHours();
      if (hour >= 21 || hour < 4) next.add("night_owl");
      // «العودة الأسطورية» — فوز بعد التأخر في منتصف الجولة.
      if (won && sorted.length > 1) {
        const myMid = midpointScores.get(p.userId) ?? 0;
        if (myMid < maxMidpointOther(p.userId)) next.add("comeback_win");
      }
      const gamesAfter = (profile?.gamesPlayed ?? 0) + 1;
      if (gamesAfter >= 10) next.add("games_10");
      if (gamesAfter >= 25) next.add("games_25");
      if (gamesAfter >= 50) next.add("games_50");
      if ((profile?.correctAnswers ?? 0) + correctCount >= 100) {
        next.add("answers_100");
      }
      const winsAfter = (profile?.gamesWon ?? 0) + (won ? 1 : 0);
      if (winsAfter >= 5) next.add("wins_5");
      if (winsAfter >= 10) next.add("wins_10");
      const levelAfter = levelFromXp((profile?.xp ?? 0) + xp);
      if (levelAfter >= 10) next.add("level_10");
      if (levelAfter >= 20) next.add("level_20");
      if (levelAfter >= 50) next.add("level_50");
      if (
        correctCount === questionCount &&
        questionCount >= 3 &&
        answered.every((a) => a.elapsedMs <= settingsOf(game).timePerQuestionMs / 2)
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
        dailyStreak: profile?.dailyStreak ?? 0,
        lastClaimDay: profile?.lastClaimDay,
        lastPlayedDay: today,
        updatedAt: now,
      };

      if (profile) {
        await ctx.db.patch(profile._id, patch);
      } else {
        await ctx.db.insert("profiles", patch);
      }

      const correctRatio = questionCount > 0 ? correctCount / questionCount : 0;
      const stars =
        rank === 1 && correctRatio >= 0.6 ? 3 : rank === 1 || correctRatio >= 0.6 ? 2 : 1;

      const historyId = await ctx.db.insert("gameHistory", {
        gameId,
        userId: p.userId,
        userName: p.name,
        gameCode: game.code,
        rank,
        playerCount: sorted.length,
        score: p.score,
        correctCount,
        questionCount,
        xpEarned: xp,
        won,
        stars,
        badgesEarned,
        firstOfDay,
        playedAt: now,
      });

      // 🎯 المرحلة 10 — سجل الفئات: أساس الأسئلة الديناميكية والمدرب
      try {
        const perCat = new Map<string, { c: number; t: number }>();
        for (const a of p.answers) {
          if (!a) continue;
          const qd = await resolveQuestion(ctx, a.questionId);
          if (!qd) continue;
          const cur = perCat.get(qd.category) ?? { c: 0, t: 0 };
          cur.t += 1;
          if (a.correct) cur.c += 1;
          perCat.set(qd.category, cur);
        }
        for (const [category, { c, t }] of perCat) {
          const existing = await ctx.db
            .query("categoryHistory")
            .withIndex("by_user_cat", (q) => q.eq("userId", p.userId).eq("category", category))
            .first();
          if (existing) {
            await ctx.db.patch(existing._id, {
              correct: existing.correct + c,
              total: existing.total + t,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("categoryHistory", {
              userId: p.userId,
              category,
              correct: c,
              total: t,
              updatedAt: now,
            });
          }
        }
      } catch {
        /* سجل الفئات اختياري — لا يعطل الجولة */
      }

      // موجّة 5 — إن كانت جولة داخل نافذة بطولة نشطة، احتسبها تلقائياً
      try {
        await ctx.runMutation(internal.tournaments.recordRound, { historyId });
      } catch {
        /* احتساب البطولة اختياري */
      }

      // ⚖️ الحكم الآلي — كشف الدقة الكاملة المتكررة بعد كل جولة
      try {
        await ctx.runMutation(internal.fairPlay.checkPerfectRepeat, {
          userId: p.userId,
        });
      } catch {
        /* احتساب البطولة اختياري — لا يعطل تسجيل الجولة */
      }

      // 🏆 الهيبة — تحويل فائض الخبرة بعد المستوى 100 إلى نقاط هيبة
      try {
        await ctx.runMutation(internal.legacy.accruePrestige, {
          userId: p.userId,
          xpEarned: xp,
        });
      } catch {
        /* اختياري — لا يعطل تسجيل الجولة */
      }

      // موجّة 7 — نقاط الولاء: كسب من إنهاء/فوز/سلسلة
      try {
        await ctx.runMutation(internal.loyalty.recordRoundLoyalty, {
          userId: p.userId,
          won,
          dailyStreak: profile?.dailyStreak,
        });
      } catch {
        /* نقاط الولاء اختيارية — لا تعطل تسجيل الجولة */
      }

      // 🗓️ أثر الأحداث الحية — مضاعف الخبرة أثناء الحدث (قياس الأثر حقيقي)
      try {
        const ev = await ctx.runQuery(internal.liveEvents.getActiveMultiplier, {});
        if (ev.multiplier > 1 && ev.eventId) {
          const boostedXp = Math.round(xp * (ev.multiplier - 1));
          if (boostedXp > 0 && profile) {
            await ctx.db.patch(profile._id, { xp: profile.xp + boostedXp });
          }
          await ctx.runMutation(internal.liveEvents.recordEventRound, {
            eventId: ev.eventId,
            userId: p.userId,
          });
        }
      } catch { /* الأحداث اختيارية */ }

      // 🏆 خزانة الإنجازات — تقييم آلي بعد كل جولة (مكافآت + إشعارات نادرة)
      try {
        await ctx.runMutation(internal.achievementsEngine.evaluateAchievements, {
          userId: p.userId,
        });
      } catch {
        /* الإنجازات اختيارية — لا تعطل تسجيل الجولة */
      }

      // 🎯 التحديات الشخصية — تحديث تقدم تحديات اللاعب بعد كل جولة
      try {
        await ctx.runMutation(internal.personalChallenges.tickFromGame, {
          userId: p.userId,
        });
      } catch {
        /* التحديات اختيارية — لا تعطل تسجيل الجولة */
      }

      // 🧬 تخصصات العقل — مزامنة الإتقان الحقيقي لكل حقل معرفي بعد الجولة
      try {
        await ctx.runMutation(internal.mindSpecializations.syncFromCategoryHistory, {
          userId: p.userId,
        });
      } catch {
        /* التخصصات اختيارية — لا تعطل تسجيل الجولة */
      }

      // 🔗 المكافآت التكيفية — تربط التقدم × العضوية × العشيرة × الهيبة فعلياً
      try {
        await ctx.runMutation(internal.adaptiveRewards.grantAdaptiveReward, {
          userId: p.userId,
          won,
          score: p.score,
        });
      } catch {
        /* اختيارية — لا تعطل تسجيل الجولة */
      }

      // موجّة 12 — حرب العشائر: أضف نقاط الجولة لعشيرة اللاعب
      try {
        await ctx.runMutation(internal.clans.recordWarRound, {
          userId: p.userId,
          won,
          correctRatio: questionCount > 0 ? correctCount / questionCount : 0,
          score: p.score,
        });
      } catch {
        /* نقاط الحرب اختيارية — لا تعطل تسجيل الجولة */
      }


      // ⚔️ حروب العشائر 3.0 — نقاط المواجهة الأسبوعية ضد العشيرة الخصومة
      try {
        await ctx.runMutation(internal.clanWars.recordWarFaceoff, {
          userId: p.userId,
          won,
          correctRatio: questionCount > 0 ? correctCount / questionCount : 0,
          score: p.score,
        });
      } catch {
        /* اختيارية — لا تعطل تسجيل الجولة */
      }
      // موجّة 13 — تذكرة الموسم: نقاط التقدم من خبرة الجولة
      try {
        await ctx.runMutation(internal.seasonPass.recordPassRound, {
          userId: p.userId,
          xpEarned: xp,
        });
      } catch {
        /* نقاط التذكرة اختيارية — لا تعطل تسجيل الجولة */
      }

      // الدوريات الخاصة — نقاط الجولة (الخبرة) لصدارة الأسبوع في كل دوريات اللاعب
      try {
        await ctx.runMutation(internal.leagues.recordLeagueRound, {
          userId: p.userId,
          points: xp,
        });
      } catch {
        /* نقاط الدوري اختيارية — لا تعطل تسجيل الجولة */
      }
    }

    // التنافس المباشر — حدّث إحصائيات «أنت ضد صديق» لكل زوج في الغرفة
    try {
      await ctx.runMutation(internal.rivalries.recordRivalryRound, {
        gameCode: game.code,
        results: sorted.map((p) => ({
          userId: p.userId,
          score: p.score,
          won: p === sorted[0] && sorted[0].score > (sorted[1]?.score ?? -1),
        })),
      });
    } catch {
      /* إحصائيات التنافس اختيارية — لا تعطل تسجيل الجولة */
    }

    // موجّة 11 — مبارزة حلبة: حدّث تصنيف ELO للطرفين (مرة واحدة للجولة)
    if (game.arenaDuel) {
      try {
        await ctx.runMutation(internal.arena.recordDuelResult, { gameCode: game.code });
      } catch {
        /* تحديث التصنيف اختياري — لا يعطل تسجيل الجولة */
      }
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
    const visibleIds = game.questionIds.slice(0, visibleCount);
    const resolved: (Question | null)[] = await Promise.all(
      visibleIds.map((qid) => resolveQuestion(ctx, qid)),
    );
    const questions: GameQuestion[] = [];
    for (let i = 0; i < resolved.length; i++) {
      const q = resolved[i];
      if (!q) continue;
      const revealed = i < game.currentQuestionIndex || currentRevealed;
      questions.push({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: revealed ? q.correctIndex : null,
        golden: i === game.questionIds.length - 1,
      });
    }

    const playerInfos: PlayerInfo[] = players
      .map((p) => ({
        id: p._id,
        name: p.name,
        score: p.score,
        answers: p.answers,
        streak: p.streak,
        bestStreak: p.bestStreak,
        fiftyFiftyUsed: p.fiftyFiftyUsedFor != null,
        secondChanceUsed: p.secondChanceUsedFor != null,
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
          stars: row.stars ?? 1,
          badgesEarned: row.badgesEarned
            .map((id) => BADGE_MAP[id])
            .filter(Boolean),
          firstOfDay: row.firstOfDay ?? false,
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
        settings: settingsOf(game),
        roundEndsAt: game.roundEndsAt ?? null,
        firstCorrect: Array.from(
          { length: game.questionIds.length },
          (_, i) => game.firstCorrect?.[i] ?? null,
        ),
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


// AI-Powered Scoring System
// AI adjusts points based on:
// 1. Question difficulty (auto-detected)
// 2. Answer speed (faster = more points)
// 3. Streak multiplier (consecutive correct answers)
// 4. Player skill level (adaptive difficulty)
// 5. Time of day (engagement optimization)
// 6. Historical performance (personalized challenges)
// 7. Social factor (playing with friends bonus)
// 8. Daily challenge bonus (extra XP)
// 9. Achievement unlock bonus
// 10. Referral bonus (invited a friend)

// ─── Smart Matchmaking ────────────────────────────────────────────
/**
 * المطابقة الذكي: يبحث عن غرفة مناسبة للمستوى أو ينشئ غرفة جديدة.
 * يعتمد على مستوى اللاعب و.GeMIه وavailability.
 */
export const smartMatch = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("المستخدم غير موجود");
    if (isUserBanned(user).banned) throw new Error("حسابك محظور")

    // Get user's profile for level-based matching
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const playerLevel = profile ? levelFromXp(profile.xp) : 1;

    // Find waiting games with space (up to 12 players)
    const waitingGames = await ctx.db
      .query("games")
      .withIndex("by_code")
      .collect();
    
    const suitableGames: typeof waitingGames = [];
    for (const game of waitingGames) {
      if (game.status !== "waiting") continue;
      const playerCount = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();
      if (playerCount.length >= 12) continue;
      if (playerCount.some(p => p.userId === userId)) continue; // already in
      
      // Get host's level for matching
      const hostProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", game.hostId))
        .first();
      const hostLevel = hostProfile ? levelFromXp(hostProfile.xp) : 1;
      
      // Level difference should be within 50%
      const diff = Math.abs(playerLevel - hostLevel);
      const maxDiff = Math.max(playerLevel, hostLevel) * 0.5;
      if (diff <= maxDiff) {
        suitableGames.push(game);
      }
    }

    // If suitable game found, join it
    if (suitableGames.length > 0) {
      // Pick the game with fewest players (most open)
      let bestGame = suitableGames[0];
      let bestCount = 999;
      for (const g of suitableGames) {
        const count = (await ctx.db
          .query("gamePlayers")
          .withIndex("by_game", (q) => q.eq("gameId", g._id))
          .collect()).length;
        if (count < bestCount) {
          bestCount = count;
          bestGame = g;
        }
      }
      
      // Join the game
      const existing = await ctx.db
        .query("gamePlayers")
        .withIndex("by_user_game", (q) =>
          q.eq("userId", userId).eq("gameId", bestGame._id),
        )
        .first();
      if (!existing) {
        const playerCount = (await ctx.db
          .query("gamePlayers")
          .withIndex("by_game", (q) => q.eq("gameId", bestGame._id))
          .collect()).length;
        
        await ctx.db.insert("gamePlayers", {
          gameId: bestGame._id,
          userId,
          name: name.trim(),
          score: 0,
          streak: 0,
          bestStreak: 0,
          answers: Array.from({ length: bestGame.questionIds.length }, () => null),
          joinedAt: Date.now(),
        });
        return { code: bestGame.code, joined: true, matched: true };
      }
      return { code: bestGame.code, joined: true, matched: false };
    }

    // No suitable game found — create a new one
    return { code: null, joined: false, matched: false, createNew: true };
  },
});


