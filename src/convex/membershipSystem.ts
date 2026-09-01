/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام العضويات المتكامل الموسّع — الإصدار الحديث
 * 5 مستويات + ألعاب حصرية + حزم صوتية + AI حسب الرتبة
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Full Tier Definitions (enhanced) ─────────────────────────
export const MEMBERSHIP_TIERS = [
  {
    id: "bronze",
    name: "برونزي",
    nameEn: "Bronze",
    emoji: "🥉",
    color: "gray",
    gradient: "from-gray-400 to-gray-500",
    cardBg: "bg-gradient-to-br from-gray-800 to-gray-900",
    border: "border-gray-500/30",
    text: "text-gray-300",
    dailyChallenges: 5,
    rewardMultiplier: 1.0,
    matchPriority: 0,
    dailyCoins: 50,
    maxGiftsPerDay: 0,
    features: {
      games: ["mind-race"],
      chatRooms: "public_only",
      aiLevel: "basic",
      privateRooms: 0,
      exclusiveChallenges: false,
      customSounds: false,
      soundPack: null as string | null,
      badge: false,
      frame: false,
      frameEffect: null as string | null,
      support: "standard",
      visualEffects: false,
      effectLevel: "none",
      squadCreate: false,
      squadSlots: 0,
      giftTypes: [] as string[],
      earlyEventAccess: false,
      profileCustomization: "basic",
      leaderboardDisplay: true,
    },
    exclusiveGames: [
      { id: "mind-race", name: "سباق الذكاء", description: "تحدي سريع لسرعة البديهة", icon: "⚡", unlocked: true },
    ],
    soundPack: { entry: null, victory: null, levelUp: null },
    aiCapabilities: ["basic_analysis", "simple_tips"],
    description: "الوصول الكامل للعبة الأساسية والتحديات اليومية",
    premiumColor: "#6b7280",
  },
  {
    id: "silver",
    name: "فضي",
    nameEn: "Silver",
    emoji: "🥈",
    color: "slate",
    gradient: "from-slate-400 to-slate-500",
    cardBg: "bg-gradient-to-br from-slate-700 to-slate-800",
    border: "border-slate-400/30",
    text: "text-slate-300",
    dailyChallenges: 8,
    rewardMultiplier: 1.25,
    matchPriority: 1,
    dailyCoins: 100,
    maxGiftsPerDay: 3,
    features: {
      games: ["mind-race", "puzzle-clash"],
      chatRooms: "public + 1 private",
      aiLevel: "standard",
      privateRooms: 1,
      exclusiveChallenges: false,
      customSounds: false,
      soundPack: null,
      badge: true,
      badgeStyle: "silver",
      frame: true,
      frameStyle: "silver",
      frameEffect: "subtle_shimmer",
      support: "standard",
      visualEffects: false,
      effectLevel: "none",
      squadCreate: false,
      squadSlots: 0,
      giftTypes: ["basic"],
      earlyEventAccess: false,
      profileCustomization: "moderate",
      leaderboardDisplay: true,
    },
    exclusiveGames: [
      { id: "mind-race", name: "سباق الذكاء", description: "تحدي سريع لسرعة البديهة", icon: "⚡", unlocked: true },
      { id: "puzzle-clash", name: "عصر الألغاز", description: "ألغاز متعددة الصعوبة", icon: "🧩", unlocked: true },
    ],
    soundPack: { entry: "silver_entry", victory: "silver_victory", levelUp: "silver_levelup" },
    aiCapabilities: ["basic_analysis", "simple_tips", "performance_tracking"],
    description: "فتح اللعبة الثانية + مضاعف مكافآت + شارة فضية",
    premiumColor: "#94a3b8",
  },
  {
    id: "gold",
    name: "ذهبي",
    nameEn: "Gold",
    emoji: "🥇",
    color: "yellow",
    gradient: "from-yellow-500 to-amber-500",
    cardBg: "bg-gradient-to-br from-yellow-900/40 to-amber-900/40",
    border: "border-yellow-500/40",
    text: "text-yellow-300",
    dailyChallenges: 12,
    rewardMultiplier: 1.5,
    matchPriority: 2,
    dailyCoins: 200,
    maxGiftsPerDay: 8,
    features: {
      games: ["mind-race", "puzzle-clash", "hero-challenge"],
      chatRooms: "all + 3 private",
      aiLevel: "advanced",
      privateRooms: 3,
      exclusiveChallenges: true,
      customSounds: true,
      soundPack: "gold",
      badge: true,
      badgeStyle: "gold",
      frame: true,
      frameStyle: "gold",
      frameEffect: "golden_glow",
      support: "priority",
      visualEffects: true,
      effectLevel: "subtle",
      squadCreate: true,
      squadSlots: 10,
      giftTypes: ["basic", "rare"],
      earlyEventAccess: true,
      profileCustomization: "advanced",
      leaderboardDisplay: true,
    },
    exclusiveGames: [
      { id: "mind-race", name: "سباق الذكاء", description: "تحدي سريع لسرعة البديهة", icon: "⚡", unlocked: true },
      { id: "puzzle-clash", name: "عصر الألغاز", description: "ألغاز متعددة الصعوبة", icon: "🧩", unlocked: true },
      { id: "hero-challenge", name: "تحدي الأبطال", description: "تحديات عميقة للمحترفين", icon: "⚔️", unlocked: true },
    ],
    soundPack: { entry: "gold_entry", victory: "gold_victory", levelUp: "gold_levelup" },
    aiCapabilities: ["basic_analysis", "simple_tips", "performance_tracking", "deep_analysis", "custom_challenges"],
    description: "فتح اللعبة الثالثة + غرفة خاصة + AI متقدم + مؤثرات صوتية",
    premiumColor: "#eab308",
  },
  {
    id: "diamond",
    name: "ماسي",
    nameEn: "Diamond",
    emoji: "💎",
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
    cardBg: "bg-gradient-to-br from-blue-900/40 to-cyan-900/40",
    border: "border-blue-500/40",
    text: "text-blue-300",
    dailyChallenges: 20,
    rewardMultiplier: 1.75,
    matchPriority: 3,
    dailyCoins: 350,
    maxGiftsPerDay: 15,
    features: {
      games: ["mind-race", "puzzle-clash", "hero-challenge", "diamond-rush"],
      chatRooms: "all + unlimited private",
      aiLevel: "expert",
      privateRooms: 5,
      exclusiveChallenges: true,
      exclusiveChallengeCount: 5,
      customSounds: true,
      soundPack: "diamond",
      badge: true,
      badgeStyle: "diamond",
      frame: true,
      frameStyle: "diamond",
      frameEffect: "animated_sparkle",
      support: "priority",
      visualEffects: true,
      effectLevel: "advanced",
      squadCreate: true,
      squadSlots: 20,
      squadManage: true,
      giftTypes: ["basic", "rare", "epic"],
      earlyEventAccess: true,
      profileCustomization: "premium",
      leaderboardDisplay: true,
    },
    exclusiveGames: [
      { id: "mind-race", name: "سباق الذكاء", description: "تحدي سريع لسرعة البديهة", icon: "⚡", unlocked: true },
      { id: "puzzle-clash", name: "عصر الألغاز", description: "ألغاز متعددة الصعوبة", icon: "🧩", unlocked: true },
      { id: "hero-challenge", name: "تحدي الأبطال", description: "تحديات عميقة للمحترفين", icon: "⚔️", unlocked: true },
      { id: "diamond-rush", name: "اندفاع الماس", description: "تحدي خاص بأصحاب الماس", icon: "💎", unlocked: true },
    ],
    soundPack: { entry: "diamond_entry", victory: "diamond_victory", levelUp: "diamond_levelup" },
    aiCapabilities: ["basic_analysis", "simple_tips", "performance_tracking", "deep_analysis", "custom_challenges", "predictive_analysis", "pattern_detection"],
    description: "كل الألعاب + غرف متقدمة + AI خبير + تأثيرات متحركة",
    premiumColor: "#3b82f6",
  },
  {
    id: "exclusive",
    name: "أسطوري",
    nameEn: "Exclusive",
    emoji: "👑",
    color: "purple",
    gradient: "from-purple-500 to-violet-600",
    cardBg: "bg-gradient-to-br from-purple-900/40 to-violet-900/40",
    border: "border-purple-500/40",
    text: "text-purple-300",
    dailyChallenges: 30,
    rewardMultiplier: 2.0,
    matchPriority: 5,
    dailyCoins: 500,
    maxGiftsPerDay: 50,
    features: {
      games: ["mind-race", "puzzle-clash", "hero-challenge", "diamond-rush", "legend-arena"],
      chatRooms: "all + unlimited + custom theme",
      aiLevel: "ultimate",
      privateRooms: -1,
      exclusiveChallenges: true,
      exclusiveChallengeCount: -1,
      customSounds: true,
      soundPack: "legendary",
      badge: true,
      badgeStyle: "legendary",
      frame: true,
      frameStyle: "legendary",
      frameEffect: "animated_premium",
      support: "vip",
      visualEffects: true,
      effectLevel: "ultimate",
      squadCreate: true,
      squadSlots: -1,
      squadManage: true,
      squadPerks: true,
      giftTypes: ["basic", "rare", "epic", "legendary"],
      earlyEventAccess: true,
      profileCustomization: "ultimate",
      leaderboardDisplay: true,
    },
    exclusiveGames: [
      { id: "mind-race", name: "سباق الذكاء", description: "تحدي سريع لسرعة البديهة", icon: "⚡", unlocked: true },
      { id: "puzzle-clash", name: "عصر الألغاز", description: "ألغاز متعددة الصعوبة", icon: "🧩", unlocked: true },
      { id: "hero-challenge", name: "تحدي الأبطال", description: "تحديات عميقة للمحترفين", icon: "⚔️", unlocked: true },
      { id: "diamond-rush", name: "اندفاع الماس", description: "تحدي خاص بأصحاب الماس", icon: "💎", unlocked: true },
      { id: "legend-arena", name: "ساحة الأساطير", description: "التحدي الأقصى لمحترفي الأساطير", icon: "👑", unlocked: true },
    ],
    soundPack: { entry: "legendary_entry", victory: "legendary_victory", levelUp: "legendary_levelup" },
    aiCapabilities: ["basic_analysis", "simple_tips", "performance_tracking", "deep_analysis", "custom_challenges", "predictive_analysis", "pattern_detection", "pro_coaching", "personalized_goals"],
    description: "أقصى صلاحيات + ساحة الأساطير + AI احترافي + كل المميزات",
    premiumColor: "#8b5cf6",
  },
] as const;

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

// ─── Exclusive Games Definitions ──────────────────────────────
export const EXCLUSIVE_GAMES = [
  {
    id: "mind-race",
    name: "سباق الذكاء",
    description: "تحدي سريع لسرعة البديهة والتفكير المنطقي",
    icon: "⚡",
    requiredTier: "bronze",
    minTierIndex: 0,
    dailyLimit: { bronze: 5, silver: 8, gold: 12, diamond: 20, exclusive: 30 },
    rewards: { base: 25, perCorrect: 10 },
    timePerQuestion: 15,
    questionsPerRound: 5,
    categories: ["منطق", "بديهة", "سرعة"],
    theme: { bg: "from-gray-800 to-gray-900", accent: "gray" },
  },
  {
    id: "puzzle-clash",
    name: "عصر الألغاز",
    description: "ألغاز متعددة الصعوبة تحتاج تفكير عميق",
    icon: "🧩",
    requiredTier: "silver",
    minTierIndex: 1,
    dailyLimit: { silver: 5, gold: 8, diamond: 12, exclusive: 20 },
    rewards: { base: 40, perCorrect: 15 },
    timePerQuestion: 25,
    questionsPerRound: 4,
    categories: ["أحجية", "أنماط", "علاقات"],
    theme: { bg: "from-slate-800 to-slate-900", accent: "slate" },
  },
  {
    id: "hero-challenge",
    name: "تحدي الأبطال",
    description: "تحديات عميقة تتطلب مهارات تحليلية متقدمة",
    icon: "⚔️",
    requiredTier: "gold",
    minTierIndex: 2,
    dailyLimit: { gold: 5, diamond: 10, exclusive: 15 },
    rewards: { base: 60, perCorrect: 25 },
    timePerQuestion: 30,
    questionsPerRound: 5,
    categories: ["استنتاج", "تفكير نقدي", "تحليل"],
    theme: { bg: "from-yellow-900/40 to-amber-900/40", accent: "yellow" },
  },
  {
    id: "diamond-rush",
    name: "اندفاع الماس",
    description: "تحدي خاص بأصحاب الماس — تحديات نادرة ومكافآت ضخمة",
    icon: "💎",
    requiredTier: "diamond",
    minTierIndex: 3,
    dailyLimit: { diamond: 5, exclusive: 10 },
    rewards: { base: 100, perCorrect: 50 },
    timePerQuestion: 35,
    questionsPerRound: 6,
    categories: ["ذكاء نقدي", "ملاحظة", "تسلسل"],
    theme: { bg: "from-blue-900/40 to-cyan-900/40", accent: "blue" },
  },
  {
    id: "legend-arena",
    name: "ساحة الأساطير",
    description: "التحدي الأقصى — اختبار شامل لكل مهاراتك الذهنية",
    icon: "👑",
    requiredTier: "exclusive",
    minTierIndex: 4,
    dailyLimit: { exclusive: 10 },
    rewards: { base: 200, perCorrect: 100 },
    timePerQuestion: 40,
    questionsPerRound: 8,
    categories: ["كل المهارات", "تحدي شامل", "تصنيف أسطوري"],
    theme: { bg: "from-purple-900/40 to-violet-900/40", accent: "purple" },
  },
] as const;

// ─── Premium Sound Packs ──────────────────────────────────────
export const SOUND_PACKS = {
  silver: {
    name: "حزمة الفضي",
    entry: "صوت دخول أنيق بسيط",
    victory: "صوت نجاح مميز",
    levelUp: "صوت ترقية فضي",
    dailyReward: "صوت مكافأة يومية",
  },
  gold: {
    name: "حزمة الذهب",
    entry: "صوت دخول فخم مع صدى",
    victory: "صوت نجاح ذهبي مبهر",
    levelUp: "صوت ترقية ذهبية مع توهج",
    dailyReward: "صوت مكافأة ذهبية",
    giftReceive: "صوت استلام هدية ذهبية",
  },
  diamond: {
    name: "حزمة الماس",
    entry: "صوت دخول كريستالي متحرك",
    victory: "صوت نجاح ماسي متلألئ",
    levelUp: "صوت ترقية ماسية استثنائي",
    dailyReward: "صوت مكافأة ماسية",
    giftReceive: "صوت استلام هدية ماسية",
    achievement: "صوت إنجاز ماسي",
  },
  legendary: {
    name: "حزمة الأساطير",
    entry: "صوت دخول أسطوري ملحمي",
    victory: "صوت نجouth ملحمي احتفالي",
    levelUp: "صوت ترقية أسطورية ساحرة",
    dailyReward: "صوت مكافأة أسطورية",
    giftReceive: "صوت استلام هدية أسطورية نادرة",
    achievement: "صوت إنجاز أسطوري",
    exclusiveWin: "صوت فوز حصري فريد",
  },
} as const;

// ─── AI Capability Levels ─────────────────────────────────────
export const AI_LEVELS = {
  basic: {
    name: "أساسي",
    description: "تحليل بسيط + نصائح عامة",
    capabilities: ["تحليل أساسي", "نصائح عامة"],
    depth: 1,
  },
  standard: {
    name: "قياسي",
    description: "تتبع أداء + نصائح أفضل",
    capabilities: ["تحليل أساسي", "نصائح عامة", "تتبع أداء", "توصيات محسنة"],
    depth: 2,
  },
  advanced: {
    name: "متقدم",
    description: "تحليل أعمق + تحديات مخصصة",
    capabilities: ["تحليل أعمق", "تحديات مخصصة", "نقاط ضعف", "تتبع تقدم"],
    depth: 3,
  },
  expert: {
    name: "خبير",
    description: "تحليل احترافي + تنبؤات + أنماط",
    capabilities: ["تحليل عميق", "تنبؤات", "اكتشاف أنماط", "تحديات متقدمة", "إرسال هدايا"],
    depth: 4,
  },
  ultimate: {
    name: "احترافي",
    description: "أقصى قدرات + تحليل احترافي + أهداف شخصية",
    capabilities: ["تحليل احترافي", "تحديات مولدة", "أهداف شخصية", "متابعة يومية", "تنازلات متقدمة", "إرسال هدايا نادرة"],
    depth: 5,
  },
} as const;

// ─── Get All Tiers ────────────────────────────────────────────
export const getMembershipTiers = query({
  args: {},
  handler: async () => {
    return MEMBERSHIP_TIERS;
  },
});

// ─── Get Exclusive Games ──────────────────────────────────────
export const getExclusiveGames = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const tier = "bronze";

    if (userId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
      if (membership) {
        const tierIndex = TIER_ORDER.indexOf(membership.tier);
        const isActive = !membership.expiresAt || membership.expiresAt > Date.now();
        if (isActive) {
          return EXCLUSIVE_GAMES.filter((g) => g.minTierIndex <= tierIndex).map((g) => ({
            ...g,
            available: true,
            dailyLimit: g.dailyLimit[membership.tier as keyof typeof g.dailyLimit] ?? 5,
          }));
        }
      }
    }

    return EXCLUSIVE_GAMES.filter((g) => g.minTierIndex === 0).map((g) => ({
      ...g,
      available: true,
      dailyLimit: 5,
    }));
  },
});

// ─── Get My Membership ────────────────────────────────────────
export const getMyMembership = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!membership) {
      return {
        tier: "bronze",
        tierData: MEMBERSHIP_TIERS[0],
        activatedAt: null,
        expiresAt: null,
        isActive: true,
        source: "default",
        gamesPlayed: 0,
        daysSinceActivation: 0,
      };
    }

    const tierData = MEMBERSHIP_TIERS.find((t) => t.id === membership.tier);
    const isActive = !membership.expiresAt || membership.expiresAt > Date.now();
    const daysSinceActivation = membership.activatedAt
      ? Math.floor((Date.now() - membership.activatedAt) / (24 * 60 * 60 * 1000))
      : 0;

    return {
      tier: membership.tier,
      tierData: tierData ?? MEMBERSHIP_TIERS[0],
      activatedAt: membership.activatedAt,
      expiresAt: membership.expiresAt,
      isActive,
      source: membership.codeUsed ?? "default",
      gamesPlayed: 0,
      daysSinceActivation,
    };
  },
});

// ─── Get Membership Stats (for owner) ─────────────────────────
export const getMembershipStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const allMemberships = await ctx.db.query("memberships").collect();
    const allUsers = await ctx.db.query("users").collect();

    const tierCounts: Record<string, number> = {
      bronze: 0, silver: 0, gold: 0, diamond: 0, exclusive: 0,
    };

    const now = Date.now();
    const activeMemberships: typeof allMemberships = [];
    for (const m of allMemberships) {
      if (!m.expiresAt || m.expiresAt > now) {
        tierCounts[m.tier] = (tierCounts[m.tier] ?? 0) + 1;
        activeMemberships.push(m);
      }
    }

    const paidCount = Object.values(tierCounts).reduce((a, b) => a + b, 0);
    tierCounts.bronze = Math.max(0, allUsers.length - paidCount);

    const activeCodes = await ctx.db.query("membershipCodes").collect();
    const validCodes = activeCodes.filter((c) => c.active);

    // Calculate average days for active paid members
    const avgDays = activeMemberships.length > 0
      ? Math.round(activeMemberships.reduce((sum, m) => {
          return sum + Math.floor((now - m.activatedAt) / (24 * 60 * 60 * 1000));
        }, 0) / activeMemberships.length)
      : 0;

    return {
      tierCounts,
      totalUsers: allUsers.length,
      totalMemberships: allMemberships.length,
      activeMemberships: activeMemberships.length,
      activeCodes: validCodes.length,
      totalCodes: activeCodes.length,
      conversionRate: allUsers.length > 0
        ? Math.round((activeMemberships.length / allUsers.length) * 100)
        : 0,
      avgDaysSinceActivation: avgDays,
    };
  },
});

// ─── Get Exclusive Challenges ─────────────────────────────────
export const getExclusiveChallenges = query({
  args: { tier: v.string() },
  handler: async (_ctx, { tier }) => {
    const tierIndex = TIER_ORDER.indexOf(tier);
    if (tierIndex < 2) return [];

    const challenges = [
      { id: "ec1", name: "تحدي السرعة الذهنية", tier: "gold", difficulty: "hard", reward: 200, description: "أجب على 10 أسئلة في دقيقة واحدة", timeLimit: 60 },
      { id: "ec2", name: "تحدي الذاكرة الخارقة", tier: "gold", difficulty: "medium", reward: 150, description: "تذكر 15 صورة متتالية", timeLimit: 120 },
      { id: "ec3", name: "معركة المنطق", tier: "diamond", difficulty: "expert", reward: 500, description: "حل 5 ألغاز منطقية متقدمة", timeLimit: 180 },
      { id: "ec4", name: "تحدي الاستنتاج السريع", tier: "diamond", difficulty: "hard", reward: 350, description: "استنتج النمط من 8 أمثلة", timeLimit: 120 },
      { id: "ec5", name: "турنمنت الأبطال", tier: "diamond", difficulty: "expert", reward: 600, description: "تحدي شامل لمهاراتك التحليلية", timeLimit: 240 },
      { id: "ec6", name: "ساحة الأساطير", tier: "exclusive", difficulty: "legendary", reward: 1000, description: "التحدي الأقصى — اختبار شامل", timeLimit: 300 },
      { id: "ec7", name: "تحدي العبقري", tier: "exclusive", difficulty: "legendary", reward: 1500, description: "15 سؤالاً من الصعوبة القصوى", timeLimit: 360 },
      { id: "ec8", name: "معركة الأساطير الجماعية", tier: "exclusive", difficulty: "legendary", reward: 2000, description: "تحدي جماعي لأساطير فقط", timeLimit: 420 },
    ];

    return challenges.filter((c) => {
      const challengeTierIndex = TIER_ORDER.indexOf(c.tier);
      return challengeTierIndex <= tierIndex;
    });
  },
});

// ─── Get Sound Pack Info ──────────────────────────────────────
export const getSoundPack = query({
  args: { tier: v.string() },
  handler: async (_ctx, { tier }) => {
    const tierIndex = TIER_ORDER.indexOf(tier);
    if (tierIndex < 1) return null;
    const packKey = tier as keyof typeof SOUND_PACKS;
    return SOUND_PACKS[packKey] ?? null;
  },
});

// ─── Get AI Level Info ────────────────────────────────────────
export const getAiLevel = query({
  args: { tier: v.string() },
  handler: async (_ctx, { tier }) => {
    const tierIndex = TIER_ORDER.indexOf(tier);
    if (tierIndex < 0) return AI_LEVELS.basic;

    const aiLevels: Array<"basic" | "standard" | "advanced" | "expert" | "ultimate"> = [
      "basic", "standard", "advanced", "expert", "ultimate",
    ];
    return AI_LEVELS[aiLevels[tierIndex]];
  },
});

// ─── Get Owner Membership Data ────────────────────────────────
export const getOwnerMembershipData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const codes = await ctx.db.query("membershipCodes").collect();
    const memberships = await ctx.db.query("memberships").collect();
    const users = await ctx.db.query("users").collect();

    const now = Date.now();
    const tierDistribution: Record<string, number> = {};
    let activePaid = 0;
    for (const m of memberships) {
      if (!m.expiresAt || m.expiresAt > now) {
        tierDistribution[m.tier] = (tierDistribution[m.tier] ?? 0) + 1;
        if (m.tier !== "bronze") activePaid++;
      }
    }

    const activeCodes = codes.filter((c) => c.active);

    // Top legendary members
    const exclusiveMembers: { name: string; level: number; days: number }[] = [];
    for (const m of memberships) {
      if (m.tier === "exclusive" && (!m.expiresAt || m.expiresAt > now)) {
        const user = await ctx.db.get(m.userId);
        if (user) {
          exclusiveMembers.push({
            name: user.name ?? "مجهول",
            level: 1,
            days: Math.floor((now - m.activatedAt) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    }

    return {
      totalCodes: codes.length,
      activeCodesCount: activeCodes.length,
      totalMembers: memberships.length,
      activePaidMembers: activePaid,
      tierDistribution,
      totalUsers: users.length,
      conversionRate: users.length > 0 ? Math.round((activePaid / users.length) * 100) : 0,
      exclusiveMembers: exclusiveMembers.sort((a, b) => b.days - a.days).slice(0, 10),
      tierStats: TIER_ORDER.map((tier) => ({
        tier,
        name: MEMBERSHIP_TIERS.find((t) => t.id === tier)?.name ?? tier,
        emoji: MEMBERSHIP_TIERS.find((t) => t.id === tier)?.emoji ?? "❓",
        count: tierDistribution[tier] ?? 0,
      })),
    };
  },
});

// ─── Use Daily Challenge ──────────────────────────────────────
export const useDailyChallenge = mutation({
  args: { gameMode: v.string() },
  handler: async (ctx, { gameMode }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const tier = membership?.tier ?? "bronze";
    const game = EXCLUSIVE_GAMES.find((g) => g.id === gameMode);
    if (!game) throw new Error("وضع لعب غير موجود");

    const tierIndex = TIER_ORDER.indexOf(tier);
    if (tierIndex < game.minTierIndex) {
      throw new Error(`يتطلب عضوية ${game.requiredTier} أو أعلى`);
    }

    // Check daily limit
    const limit = game.dailyLimit[tier as keyof typeof game.dailyLimit] ?? 5;

    return { success: true, tier, dailyLimit: limit, game: game.name };
  },
});

// ─── Calculate Rewards ────────────────────────────────────────
export const calculateRewards = query({
  args: {
    baseReward: v.number(),
    correctAnswers: v.number(),
  },
  handler: async (ctx, { baseReward, correctAnswers }) => {
    const userId = await getAuthUserId(ctx);
    const tier = "bronze";

    let multiplier = 1.0;
    if (userId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
      if (membership) {
        const tierData = MEMBERSHIP_TIERS.find((t) => t.id === membership.tier);
        multiplier = tierData?.rewardMultiplier ?? 1.0;
      }
    }

    const baseTotal = baseReward + correctAnswers * 10;
    const finalReward = Math.round(baseTotal * multiplier);

    return {
      baseTotal,
      multiplier,
      finalReward,
      bonus: finalReward - baseTotal,
    };
  },
});
