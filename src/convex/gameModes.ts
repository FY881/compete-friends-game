import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ═══════════════════════════════════════════════════════════════════════
// ║ 5 ألعاب رئيسية مقسمة بالعضويات
// ║ اللعبة 1: سباق الذكاء (للجميع)
// ║ اللعبة 2: عصر الألغاز (فضي+)
// ║ اللعبة 3: تحدي الأبطال (ذهبي+)
// ║ اللعبة 4: اندفاع الماس (ماسي+)
// ║ اللعبة 5: ساحة الأساطير (أسطوري فقط)
// ═══════════════════════════════════════════════════════════════════════

export interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  minTier: string;
  questionCount: number;
  timePerQuestion: number;
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
    icon: "⚔️",
    minTier: "gold",
    questionCount: 15,
    timePerQuestion: 15,
    features: ["15 سؤال صعب+", "السؤال الذهبي ×3", "مكافآت ضخمة", "حصري للنخبة"],
    rewards: { xpPerCorrect: 30, xpBonusWin: 200, badgeOnWin: "champion" },
  },
  {
    id: "diamond_rush",
    name: "اندفاع الماس",
    description: "تحدي خاص بأصحاب الماس — أسئلة نادرة ومكافآت هائلة",
    icon: "💎",
    minTier: "diamond",
    questionCount: 18,
    timePerQuestion: 18,
    features: ["18 سؤال نادر", "مكافآت ×1.75", "تنبؤات AI", "تحديات متغيرة", "جوائز ماسية"],
    rewards: { xpPerCorrect: 50, xpBonusWin: 350, badgeOnWin: "diamond_master" },
  },
  {
    id: "legend_arena",
    name: "ساحة الأساطير",
    description: "التحدي الأقصى — اختبار شامل لكل مهاراتك الذهنية",
    icon: "👑",
    minTier: "exclusive",
    questionCount: 25,
    timePerQuestion: 20,
    features: ["25 سؤال شامل", "كل الفئات", "مكافآت ×2", "تحدي أسطوري", "Rank خاص", "شارة حصرية"],
    rewards: { xpPerCorrect: 100, xpBonusWin: 1000, badgeOnWin: "legend" },
  },
];

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

// Daily limits per game mode per tier
const DAILY_LIMITS: Record<string, Record<string, number>> = {
  quiz_rush: { bronze: 5, silver: 8, gold: 12, diamond: 20, exclusive: 30 },
  puzzle_masters: { bronze: 0, silver: 5, gold: 8, diamond: 12, exclusive: 20 },
  champion_battle: { bronze: 0, silver: 0, gold: 5, diamond: 10, exclusive: 15 },
  diamond_rush: { bronze: 0, silver: 0, gold: 0, diamond: 5, exclusive: 10 },
  legend_arena: { bronze: 0, silver: 0, gold: 0, diamond: 0, exclusive: 10 },
};

function canAccessTier(userTier: string, requiredTier: string): boolean {
  const userIndex = TIER_ORDER.indexOf(userTier);
  const requiredIndex = TIER_ORDER.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

function getUserTierIndex(userTier: string): number {
  return TIER_ORDER.indexOf(userTier);
}

// ─── جلب أوضاع اللعب المتاحة ────────────────────────────────────
export const getAvailableGameModes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    let userTier = "bronze";

    if (userId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      userTier = membership?.tier ?? "bronze";
    }

    // Get today's game count per mode
    let todayCounts: Record<string, number> = {};
    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      const todayGames = await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const g of todayGames) {
        const d = new Date(g.playedAt).toISOString().slice(0, 10);
        if (d === today) {
          const mode = (g as Record<string, unknown>).gameModeId as string | undefined;
          if (mode) {
            todayCounts[mode] = (todayCounts[mode] ?? 0) + 1;
          }
        }
      }
    }

    return GAME_MODES.map((mode) => {
      const unlocked = canAccessTier(userTier, mode.minTier);
      const tierLimit = DAILY_LIMITS[mode.id]?.[userTier] ?? 0;
      const usedToday = todayCounts[mode.id] ?? 0;
      const remaining = Math.max(0, tierLimit - usedToday);

      return {
        ...mode,
        unlocked,
        userTier,
        dailyLimit: tierLimit,
        usedToday,
        remaining,
      };
    });
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
      throw new Error(`يتطلب عضوية ${mode.minTier} أو أعلى — الألعاب الأعلى مكافآت وتحديات!`);
    }

    // Check daily limit
    const tierLimit = DAILY_LIMITS[gameModeId]?.[userTier] ?? 0;
    if (tierLimit > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const todayGames = await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const todayCount = todayGames.filter((g) => {
        const d = new Date(g.playedAt).toISOString().slice(0, 10);
        return d === today;
      }).length;

      if (todayCount >= tierLimit) {
        throw new Error(`وصلت الحد اليومي (${tierLimit} جولات) — حاول غداً!`);
      }
    }

    // Create code
    const code = `GM-${mode.id.slice(0, 3).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Pick questions based on mode difficulty
    const allQuestions = (await import("./questions")).QUESTION_BANK;
    let filtered;
    const idx = TIER_ORDER.indexOf(userTier);
    if (idx <= 0) {
      filtered = allQuestions.filter((q) => q.difficulty === "easy" || q.difficulty === "medium");
    } else if (idx === 1) {
      filtered = allQuestions.filter((q) => q.difficulty === "medium");
    } else if (idx <= 3) {
      filtered = allQuestions.filter((q) => q.difficulty === "medium" || q.difficulty === "hard");
    } else {
      filtered = allQuestions.filter((q) => q.difficulty === "hard");
    }

    // Fallback if not enough questions
    if (filtered.length < mode.questionCount) {
      filtered = allQuestions;
    }

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

    // Auto-join the host
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

    return { code, mode: mode.name, dailyLimit: tierLimit };
  },
});

// ─── Get reward multiplier for a user ──────────────────────────────
export const getRewardMultiplier = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 1.0;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return 1.0;

    const multipliers: Record<string, number> = {
      bronze: 1.0,
      silver: 1.25,
      gold: 1.5,
      diamond: 1.75,
      exclusive: 2.0,
    };
    return multipliers[membership.tier] ?? 1.0;
  },
});
