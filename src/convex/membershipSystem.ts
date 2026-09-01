/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام العضويات المتكامل — يتوافق مع Schema الحالي
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Membership Tier Definitions ──────────────────────────────
// تتوافق مع Schema: bronze | silver | gold | diamond | exclusive
export const MEMBERSHIP_TIERS = [
  {
    id: "bronze",
    name: "برونزي",
    nameEn: "Bronze",
    emoji: "🥉",
    color: "gray",
    gradient: "from-gray-400 to-gray-500",
    monthlyPrice: "مجاني",
    dailyChallenges: 5,
    rewardMultiplier: 1.0,
    matchPriority: 0,
    features: {
      games: ["game1"],
      chatRooms: "public_only",
      gifts: { send: 0, receive: true },
      aiLevel: "basic",
      privateRooms: false,
      exclusiveChallenges: false,
      customSounds: false,
      badge: false,
      frame: false,
      support: "standard",
      visualEffects: false,
      squadCreate: false,
    },
    description: "الوصول الكامل للعبة الرئيسية والتحديات الأساسية",
  },
  {
    id: "silver",
    name: "فضي",
    nameEn: "Silver",
    emoji: "🥈",
    color: "slate",
    gradient: "from-slate-400 to-slate-500",
    monthlyPrice: "رموز سرية",
    dailyChallenges: 8,
    rewardMultiplier: 1.25,
    matchPriority: 1,
    features: {
      games: ["game1", "game2"],
      chatRooms: "public + 1 private",
      gifts: { send: 3, receive: true },
      aiLevel: "standard",
      privateRooms: false,
      exclusiveChallenges: false,
      customSounds: false,
      badge: true,
      badgeStyle: "silver",
      frame: true,
      frameStyle: "silver",
      support: "standard",
      visualEffects: false,
      squadCreate: false,
    },
    description: "زيادة التحديات + لعبة الثانية + مضاعف مكافآت خفيف",
  },
  {
    id: "gold",
    name: "ذهبي",
    nameEn: "Gold",
    emoji: "🥇",
    color: "yellow",
    gradient: "from-yellow-500 to-amber-500",
    monthlyPrice: "رموز سرية",
    dailyChallenges: 12,
    rewardMultiplier: 1.5,
    matchPriority: 2,
    features: {
      games: ["game1", "game2", "game3_limited"],
      chatRooms: "all + 3 private",
      gifts: { send: 8, receive: true, dailyGift: true },
      aiLevel: "advanced",
      privateRooms: true,
      privateRoomSlots: 1,
      exclusiveChallenges: true,
      customSounds: true,
      soundPack: "gold",
      badge: true,
      badgeStyle: "gold",
      frame: true,
      frameStyle: "gold",
      frameEffect: "subtle_glow",
      support: "priority",
      visualEffects: true,
      squadCreate: true,
      squadSlots: 10,
    },
    description: "فتح كامل للعبة الثانية + غرفة خاصة + شارة ذهبية + AI متقدم",
  },
  {
    id: "diamond",
    name: "ماسي",
    nameEn: "Diamond",
    emoji: "💎",
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
    monthlyPrice: "رموز سرية",
    dailyChallenges: 20,
    rewardMultiplier: 1.75,
    matchPriority: 3,
    features: {
      games: ["game1", "game2", "game3"],
      chatRooms: "all + unlimited private",
      gifts: { send: 15, receive: true, dailyGift: true, rareGifts: true },
      aiLevel: "expert",
      privateRooms: true,
      privateRoomSlots: 5,
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
    },
    description: "جميع الألعاب + غرف خاصة متقدمة + AI خبير + تأثيرات بصرية متحركة",
  },
  {
    id: "exclusive",
    name: "أسطوري",
    nameEn: "Exclusive",
    emoji: "👑",
    color: "purple",
    gradient: "from-purple-500 to-violet-600",
    monthlyPrice: "رموز سرية",
    dailyChallenges: 30,
    rewardMultiplier: 2.0,
    matchPriority: 5,
    features: {
      games: ["game1", "game2", "game3", "exclusive_legend"],
      chatRooms: "all + unlimited + custom theme",
      gifts: { send: 50, receive: true, dailyGift: true, rareGifts: true, legendaryGifts: true },
      aiLevel: "ultimate",
      privateRooms: true,
      privateRoomSlots: -1,
      privateRoomCustomTheme: true,
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
    },
    description: "أقصى صلاحيات + تحديات حصرية + AI احترافي + تأثيرات استثنائية",
  },
] as const;

// ─── Get All Tiers ────────────────────────────────────────────
export const getMembershipTiers = query({
  args: {},
  handler: async () => {
    return MEMBERSHIP_TIERS;
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
      };
    }

    const tierData = MEMBERSHIP_TIERS.find((t) => t.id === membership.tier);
    const isActive = !membership.expiresAt || membership.expiresAt > Date.now();

    return {
      tier: membership.tier,
      tierData: tierData ?? MEMBERSHIP_TIERS[0],
      activatedAt: membership.activatedAt,
      expiresAt: membership.expiresAt,
      isActive,
      source: membership.codeUsed ?? "default",
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
      bronze: 0,
      silver: 0,
      gold: 0,
      diamond: 0,
      exclusive: 0,
    };

    const now = Date.now();
    for (const m of allMemberships) {
      if (!m.expiresAt || m.expiresAt > now) {
        tierCounts[m.tier] = (tierCounts[m.tier] ?? 0) + 1;
      }
    }

    const paidCount = Object.values(tierCounts).reduce((a, b) => a + b, 0);
    tierCounts.bronze = Math.max(0, allUsers.length - paidCount);

    const activeCodes = await ctx.db.query("membershipCodes").collect();
    const validCodes = activeCodes.filter((c) => c.active);

    return {
      tierCounts,
      totalUsers: allUsers.length,
      totalMemberships: allMemberships.length,
      activeCodes: validCodes.length,
      totalCodes: activeCodes.length,
    };
  },
});

// ─── Get Exclusive Challenges ─────────────────────────────────
export const getExclusiveChallenges = query({
  args: { tier: v.string() },
  handler: async (_ctx, { tier }) => {
    const tierOrder = ["bronze", "silver", "gold", "diamond", "exclusive"];
    const tierIndex = tierOrder.indexOf(tier);
    if (tierIndex < 2) return []; // Only gold+ get exclusive challenges

    const challenges = [
      { id: "ec1", name: "تحدي السرعة الذهنية", tier: "gold", difficulty: "hard", reward: 200, description: "أجب على 10 أسئلة في دقيقة واحدة" },
      { id: "ec2", name: "تحدي الذاكرة الخارقة", tier: "gold", difficulty: "medium", reward: 150, description: "تذكر 15 صورة متتالية" },
      { id: "ec3", name: "معركة المنطق", tier: "diamond", difficulty: "expert", reward: 500, description: "حل 5 ألغاز منطقية متقدمة" },
      { id: "ec4", name: "تحدي الاستنتاج السريع", tier: "diamond", difficulty: "hard", reward: 350, description: "استنتج النمط من 8 أمثلة" },
      { id: "ec5", name: "турنمنت الأبطال", tier: "exclusive", difficulty: "legendary", reward: 1000, description: "تحدي شامل يختبر كل مهاراتك" },
      { id: "ec6", name: "تحدي العبقري", tier: "exclusive", difficulty: "legendary", reward: 1500, description: "15 سؤالاً من الصعوبة القصوى" },
    ];

    return challenges.filter((c) => {
      const challengeTierIndex = tierOrder.indexOf(c.tier);
      return challengeTierIndex <= tierIndex;
    });
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
    for (const m of memberships) {
      if (!m.expiresAt || m.expiresAt > now) {
        tierDistribution[m.tier] = (tierDistribution[m.tier] ?? 0) + 1;
      }
    }

    const activeCodes = codes.filter((c) => c.active);

    return {
      totalCodes: codes.length,
      activeCodesCount: activeCodes.length,
      totalMembers: memberships.length,
      tierDistribution,
      totalUsers: users.length,
      conversionRate:
        users.length > 0
          ? Math.round((memberships.length / users.length) * 100)
          : 0,
    };
  },
});
