import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ═══════════════════════════════════════════════════════════════════════
// ║ 3 ألعاب رئيسية مقسمة بالعضويات
// ║ اللعبة 1: سباق الذكاء (للجميع)
// ║ اللعبة 2: عصر الألغاز (فضي+)
// ║ اللعبة 3: تحدي الأبطال (ذهبي+)
// ═══════════════════════════════════════════════════════════════════════

export interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  minTier: string; // bronze = free, silver, gold, diamond, exclusive
  questionCount: number;
  timePerQuestion: number; // seconds
  features: string[];
  rewards: { xpPerCorrect: number; xpBonusWin: number; badgeOnWin: string };
}

export const GAME_MODES: GameMode[] = [
  {
    id: "quiz_rush",
    name: "سباق الذكاء",
    description: "تحدي سريع — أجب على أكبر عدد من الأسئلة في دقيقتين",
    icon: "⚡",
    minTier: "bronze",
    questionCount: 10,
    timePerQuestion: 12,
    features: ["10 أسئلة سريعة", "نقاط السرعة مهمة", "50/50 متاح", "مناسب للجميع"],
    rewards: { xpPerCorrect: 10, xpBonusWin: 50, badgeOnWin: "speed_master" },
  },
  {
    id: "puzzle_masters",
    name: "عصر الألغاز",
    description: "ألغاز وتحليل منطقي — يحتاج تفكير أعمق",
    icon: "🧩",
    minTier: "silver",
    questionCount: 12,
    timePerQuestion: 20,
    features: ["12 سؤال منطقي", "وقت أطول للتفكير", "50/50 + فرصة ثانية", "أسئلة أصعب"],
    rewards: { xpPerCorrect: 20, xpBonusWin: 100, badgeOnWin: "puzzle_master" },
  },
  {
    id: "champion_battle",
    name: "تحدي الأبطال",
    description: "للمحترفين فقط — أسئلة صعبة ومكافآت ضخمة",
    icon: "👑",
    minTier: "gold",
    questionCount: 15,
    timePerQuestion: 15,
    features: ["15 سؤال صعب+", "السؤال الذهبي ×3", "مكافآت ضخمة", "حصري للنخبة"],
    rewards: { xpPerCorrect: 30, xpBonusWin: 200, badgeOnWin: "champion" },
  },
];

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

function canAccessTier(userTier: string, requiredTier: string): boolean {
  const userIndex = TIER_ORDER.indexOf(userTier);
  const requiredIndex = TIER_ORDER.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

// ─── جلب أوضاع اللعب المتاحة ────────────────────────────────────
export const getAvailableGameModes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return GAME_MODES.map((m) => ({ ...m, unlocked: m.minTier === "bronze" }));

    // Get user membership
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const userTier = membership?.tier ?? "bronze";

    return GAME_MODES.map((mode) => ({
      ...mode,
      unlocked: canAccessTier(userTier, mode.minTier),
      userTier,
    }));
  },
});

// ─── إنشاء جولة في وضع محدد ──────────────────────────────────────
export const createGameModeRound = mutation({
  args: {
    gameModeId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { gameModeId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const mode = GAME_MODES.find((m) => m.id === gameModeId);
    if (!mode) throw new Error("وضع اللعب غير موجود");

    // Check access
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const userTier = membership?.tier ?? "bronze";
    if (!canAccessTier(userTier, mode.minTier)) {
      throw new Error(`يتطلب عضوية ${mode.minTier} أو أعلى`);
    }

    // Check daily limit
    const today = new Date().toISOString().slice(0, 10);
    const todayGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const todayCount = todayGames.filter((g) => {
      const d = new Date(g.playedAt).toISOString().slice(0, 10);
      return d === today;
    }).length;

    const DAILY_LIMITS: Record<string, number> = {
      quiz_rush: 5,
      puzzle_masters: 3,
      champion_battle: 2,
    };
    const limit = DAILY_LIMITS[gameModeId] ?? 5;
    if (todayCount >= limit) {
      throw new Error(`وصلت الحد اليومي (${limit} جولات) — حاول غداً!`);
    }

    // Create the game (reuse the existing games table)
    const code = `GM-${mode.id.slice(0, 2).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Pick questions based on mode
    const allQuestions = (await import("./questions")).QUESTION_BANK;
    const filtered = mode.questionCount <= 10
      ? allQuestions.filter((q) => q.difficulty === "easy" || q.difficulty === "medium")
      : mode.questionCount <= 12
        ? allQuestions.filter((q) => q.difficulty === "medium" || q.difficulty === "hard")
        : allQuestions.filter((q) => q.difficulty === "hard");

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, mode.questionCount);

    const gameId = await ctx.db.insert("games", {
      code,
      hostId: userId,
      status: "waiting",
      phase: "answering",
      questionIds: picked.map((q) => q.id),
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      firstCorrect: [],
      createdAt: Date.now(),
      settings: {
        questionCount: mode.questionCount,
        timePerQuestionMs: mode.timePerQuestion * 1000,
        categories: [],
      },
    });

    // Auto-join
    const user = await ctx.db.get(userId);
    await ctx.db.insert("gamePlayers", {
      gameId,
      userId,
      name: name ?? user?.name ?? "لاعب",
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      joinedAt: Date.now(),
    });

    return { code, mode: mode.name };
  },
});
