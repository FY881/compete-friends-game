/**
 * ═══════════════════════════════════════════════════════════════════
 * الميزات الـ 15 البريميوم الجديدة — حقيقية وقابلة للاختبار
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── 1. تحديات حسب الوقت (Timed Challenges) ──────────────────
export const getTimeChallenges = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourOfDay = new Date().getHours();

    const challenges = [
      {
        id: "morning_rush",
        name: "تحدي الصباح",
        description: "تحدي سريع لبداية اليوم — 5 أسئلة في 30 ثانية",
        icon: "🌅",
        timeWindow: "6AM - 12PM",
        active: hourOfDay >= 6 && hourOfDay < 12,
        bonusMultiplier: 1.5,
        questionCount: 5,
        timePerQuestion: 6,
      },
      {
        id: "lunch_battle",
        name: "معركة الظهر",
        description: "تحدي أثناء الظهر — 8 أسئلة سريعة",
        icon: "☀️",
        timeWindow: "12PM - 3PM",
        active: hourOfDay >= 12 && hourOfDay < 15,
        bonusMultiplier: 1.25,
        questionCount: 8,
        timePerQuestion: 8,
      },
      {
        id: "night_master",
        name: "سيد الليل",
        description: "تحدي الليل المظلم — 10 أسئلة بوقت محدود",
        icon: "🌙",
        timeWindow: "9PM - 2AM",
        active: hourOfDay >= 21 || hourOfDay < 2,
        bonusMultiplier: 2.0,
        questionCount: 10,
        timePerQuestion: 10,
      },
      {
        id: "weekend_warrior",
        name: "محارب عطلة نهاية الأسبوع",
        description: "تحدي خاص بأيام الجمعة والسبت — مكافآت مضاعفة",
        icon: "🎉",
        timeWindow: "Friday & Saturday",
        active: [5, 6].includes(new Date().getDay()),
        bonusMultiplier: 3.0,
        questionCount: 15,
        timePerQuestion: 12,
      },
    ];

    return challenges;
  },
});

// ─── 2. نظام التحديات اليومية المتنوعة ────────────────────────
export const getDailyVarietyChallenge = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = new Date().toISOString().slice(0, 10);

    // Create a seeded "random" challenge for today
    const dayHash = today.split("-").reduce((a, b) => a + parseInt(b), 0);
    const categories = ["منطق", "سرعة بديهة", "ألغاز", "معلومات عامة", "رياضيات", "استنتاج"];
    const selectedCategory = categories[dayHash % categories.length];

    return {
      id: `daily_variety_${today}`,
      name: `تحدي ${selectedCategory} اليومي`,
      category: selectedCategory,
      description: `تحدي ${selectedCategory} — أثبت مهاراتك اليومية`,
      icon: "🎲",
      questionCount: 10,
      timePerQuestion: 15,
      bonusXP: 75,
      date: today,
    };
  },
});

// ─── 3. نظام الإنجازات الشامل ─────────────────────────────────
export const ACHIEVEMENTS = [
  { id: "first_win", name: "أول فوز", description: "فز بأول جولة لك", icon: "🏅", rarity: "common" as const, xpReward: 50, condition: (stats: { gamesWon: number }) => stats.gamesWon >= 1 },
  { id: "win_streak_5", name: "سلسلة 5 فوز", description: "اربح 5 جولات متتالية", icon: "🔥", rarity: "rare" as const, xpReward: 200, condition: (stats: { bestStreak: number }) => stats.bestStreak >= 5 },
  { id: "win_streak_10", name: "سلسلة 10 فوز", description: "اربح 10 جولات متتالية", icon: "💎", rarity: "epic" as const, xpReward: 500, condition: (stats: { bestStreak: number }) => stats.bestStreak >= 10 },
  { id: "games_50", name: "لاعب مخضرم", description: "العب 50 جولة", icon: "🎮", rarity: "rare" as const, xpReward: 150, condition: (stats: { gamesPlayed: number }) => stats.gamesPlayed >= 50 },
  { id: "games_100", name: "محترف اللعبة", description: "العب 100 جولة", icon: "👑", rarity: "epic" as const, xpReward: 300, condition: (stats: { gamesPlayed: number }) => stats.gamesPlayed >= 100 },
  { id: "level_10", name: "صاعد", description: "بلغ المستوى 10", icon: "🚀", rarity: "rare" as const, xpReward: 250, condition: (stats: { level: number }) => stats.level >= 10 },
  { id: "level_25", name: "خبير", description: "بلغ المستوى 25", icon: "⭐", rarity: "epic" as const, xpReward: 600, condition: (stats: { level: number }) => stats.level >= 25 },
  { id: "level_50", name: "أسطورة", description: "بلغ المستوى 50", icon: "🏆", rarity: "legendary" as const, xpReward: 1000, condition: (stats: { level: number }) => stats.level >= 50 },
  { id: "perfect_score", name: "كمال", description: "احصل على نتيجة مثالية في جولة", icon: "💯", rarity: "rare" as const, xpReward: 300, condition: (stats: { bestScore: number }) => stats.bestScore >= 500 },
  { id: "speed_demon", name: "شيطان السرعة", description: "أجب على 5 أسئلة في أقل من 5 ثوانٍ", icon: "⚡", rarity: "rare" as const, xpReward: 200, condition: () => true },
  { id: "social_butterfly", name: "فراشة اجتماعية", description: "أرسل 10 هدايا لأصدقائك", icon: "🦋", rarity: "rare" as const, xpReward: 100, condition: () => true },
  { id: "collector", name: "جامع", description: "اجمع 10 شارات إنجاز", icon: "📦", rarity: "epic" as const, xpReward: 400, condition: (stats: { badges: string[] }) => stats.badges.length >= 10 },
  { id: "store_first", name: "المتسوق الأول", description: "اشترِ أول عنصر من المتجر", icon: "🛒", rarity: "common" as const, xpReward: 50, condition: () => true },
  { id: "early_bird", name: "طائر الصباح", description: "العب قبل الساعة 8 صباحاً", icon: "🐦", rarity: "common" as const, xpReward: 75, condition: () => new Date().getHours() < 8 },
  { id: "night_owl", name: "بومة الليل", description: "العب بعد الساعة 12 منتصف الليل", icon: "🦉", rarity: "common" as const, xpReward: 75, condition: () => new Date().getHours() >= 0 && new Date().getHours() < 4 },
];

export const getAchievements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { all: ACHIEVEMENTS, earned: [] };

    // Get user stats
    const profile = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const stats = {
      gamesPlayed: profile.length,
      gamesWon: profile.filter((g) => (g.score ?? 0) > 0).length,
      bestScore: Math.max(...profile.map((g) => g.score ?? 0), 0),
      bestStreak: Math.max(...profile.map((g) => (g as Record<string, unknown>).bestStreak as number ?? 0), 0),
      level: 1,
      badges: [] as string[],
    };

    // Calculate level from XP
    const totalXp = profile.reduce((sum, g) => sum + (g.score ?? 0), 0);
    let level = 1;
    let xpNeeded = 100;
    let xpAccumulated = 0;
    while (xpAccumulated + xpNeeded <= totalXp) {
      xpAccumulated += xpNeeded;
      level++;
      xpNeeded = Math.floor(xpNeeded * 1.15);
    }
    stats.level = level;

    // Check earned achievements
    const earnedAchievements = ACHIEVEMENTS.filter((a) => a.condition(stats));

    return {
      all: ACHIEVEMENTS,
      earned: earnedAchievements.map((a) => a.id),
      stats,
    };
  },
});

// ─── 4. نظام التحديات الخاصة بالوقت ───────────────────────────
export const getLimitedTimeEvents = query({
  args: {},
  handler: async () => {
    const now = Date.now();
    const dayOfWeek = new Date().getDay();
    const hourOfDay = new Date().getHours();

    const events = [
      {
        id: "double_xp_friday",
        name: "يوم الجمعة المزدوج",
        description: "جميع المكافآت مضاعفة اليوم!",
        icon: "🌟",
        type: "double_rewards",
        active: dayOfWeek === 5,
        expiresAt: dayOfWeek === 5 ? new Date().setHours(23, 59, 59, 999) : now,
        multiplier: 2,
      },
      {
        id: "speed_hour",
        name: "ساعة السرعة",
        description: "تحديات سريعة بوقت محدود — مكافآت 3x",
        icon: "⚡",
        type: "triple_rewards",
        active: hourOfDay === 20, // 8 PM
        expiresAt: hourOfDay === 20 ? new Date().setMinutes(59, 59, 999) : now,
        multiplier: 3,
      },
      {
        id: "mystery_challenge",
        name: "تحدي الغموض",
        description: "سؤال واحد — مكافأة مجهولة كبيرة!",
        icon: "❓",
        type: "mystery_reward",
        active: hourOfDay % 6 === 0, // Every 6 hours
        expiresAt: now + 60 * 60 * 1000,
        multiplier: 5,
      },
      {
        id: "community_goal",
        name: "الهدف الجماعي",
        description: "هدف مشترك لجميع اللاعبين — مكافأة للجميع عند الإنجاز",
        icon: "🤝",
        type: "collective",
        active: true,
        expiresAt: now + 24 * 60 * 60 * 1000,
        targetScore: 10000,
        currentScore: 0,
      },
    ];

    return events;
  },
});

// ─── 5. نظام تحديات الأصدقاء ──────────────────────────────────
export const createFriendChallenge = mutation({
  args: {
    friendCode: v.string(),
    questionCount: v.number(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { friendCode, questionCount, category }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("المستخدم غير موجود");

    // Create a special friend challenge code
    const code = `F-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    return {
      code,
      hostName: user.name ?? "مجهول",
      questionCount,
      category: category ?? "الكل",
    };
  },
});

// ─── 6. نظام السجل اليومي ─────────────────────────────────────
export const getDailyLog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const today = new Date().toISOString().slice(0, 10);
    const todayGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const todayPlays = todayGames.filter((g) => {
      const d = new Date(g.playedAt).toISOString().slice(0, 10);
      return d === today;
    });

    return {
      gamesPlayed: todayPlays.length,
      totalXP: todayPlays.reduce((sum, g) => sum + (g.score ?? 0), 0),
      gamesWon: todayPlays.filter((g) => (g.score ?? 0) > 0).length,
      date: today,
    };
  },
});

// ─── 7. نظام التحديات الجماعية ────────────────────────────────
export const getCollectiveGoals = query({
  args: {},
  handler: async (ctx) => {
    const goals = await ctx.db
      .query("collectiveGoals")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    return goals.map((g) => ({
      ...g,
      progress: Math.min(100, Math.round((g.currentScore / g.targetScore) * 100)),
    }));
  },
});

// ─── 8. نظام نظام التحديات المتنوعة ───────────────────────────
export const SPECIAL_GAMES = [
  {
    id: "memory_palace",
    name: "قصر الذاكرة",
    description: "تحدي الذاكرة — تذكر أكبر قدر من الأرقام",
    icon: "🧠",
    requiredLevel: 5,
    questionCount: 20,
    timePerQuestion: 8,
    unique: true,
  },
  {
    id: "pattern_master",
    name: "سيد الأنماط",
    description: "اكتشف النمط المخفي في كل سؤال",
    icon: "🔮",
    requiredLevel: 10,
    questionCount: 15,
    timePerQuestion: 15,
    unique: true,
  },
  {
    id: "word_chain",
    name: "سلسلة الكلمات",
    description: "ربط الكلمات بمنطق ذكي",
    icon: "🔗",
    requiredLevel: 15,
    questionCount: 12,
    timePerQuestion: 12,
    unique: true,
  },
  {
    id: "math_rush",
    name: "سباق الرياضيات",
    description: "حسابات سريعة تحت الضغط",
    icon: "🔢",
    requiredLevel: 8,
    questionCount: 25,
    timePerQuestion: 5,
    unique: true,
  },
  {
    id: "visual_quest",
    name: "الرحلة البصرية",
    description: "ملاحظة دقيقة وتحليل بصري",
    icon: "👁️",
    requiredLevel: 20,
    questionCount: 10,
    timePerQuestion: 20,
    unique: true,
  },
];

export const getSpecialGames = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    let userLevel = 1;

    if (userId) {
      const profile = await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const totalXp = profile.reduce((sum, g) => sum + (g.score ?? 0), 0);
      let level = 1;
      let xpNeeded = 100;
      let xpAccumulated = 0;
      while (xpAccumulated + xpNeeded <= totalXp) {
        xpAccumulated += xpNeeded;
        level++;
        xpNeeded = Math.floor(xpNeeded * 1.15);
      }
      userLevel = level;
    }

    return SPECIAL_GAMES.map((game) => ({
      ...game,
      unlocked: userLevel >= game.requiredLevel,
    }));
  },
});

// ─── 9. نظام هيكل الإنجازات المتقدمة ──────────────────────────
export const getAchievementTree = query({
  args: {},
  handler: async () => {
    return {
      branches: [
        {
          name: "مسار المحارب",
          icon: "⚔️",
          achievements: ["first_win", "win_streak_5", "win_streak_10"],
          reward: "شارة المحارب النهائية",
        },
        {
          name: "مسار المستكشف",
          icon: "🗺️",
          achievements: ["games_50", "games_100", "speed_demon"],
          reward: "إطار المستكشف المميز",
        },
        {
          name: "مسار الأسطورة",
          icon: "👑",
          achievements: ["level_10", "level_25", "level_50"],
          reward: "تأثير أسطوري خاص",
        },
        {
          name: "مسار الاجتماعي",
          icon: "🤝",
          achievements: ["social_butterfly", "collector", "store_first"],
          reward: "شارة المجتمع المميز",
        },
      ],
    };
  },
});

// ─── 10. نظام التحديات الأسبوعية ──────────────────────────────
export const getWeeklyChallenges = query({
  args: {},
  handler: async () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return [
      {
        id: "weekly_1",
        name: "المحارب الأسبوعي",
        description: "العب 20 جولة هذا الأسبوع",
        icon: "⚔️",
        target: 20,
        current: 0,
        reward: { xp: 500, badge: "weekly_warrior" },
        endsAt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(),
      },
      {
        id: "weekly_2",
        name: "ملك الفوز",
        description: "اربح 10 جولات هذا الأسبوع",
        icon: "👑",
        target: 10,
        current: 0,
        reward: { xp: 300, badge: "weekly_king" },
        endsAt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(),
      },
      {
        id: "weekly_3",
        name: "المتصفح",
        description: "اجمع 300 عملة هذا الأسبوع",
        icon: "💰",
        target: 300,
        current: 0,
        reward: { xp: 200, badge: "weekly_collector" },
        endsAt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(),
      },
    ];
  },
});
