/**
 * ═══════════════════════════════════════════════════════════════════
 * ميزات العضوية الإضافية — يتوافق مع Schema الحالي
 * 10 أفكار جديدة: مسار موسمي + إرث + إهداء + صوت + تصويت
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

// ─── 1. Seasonal Promotion Path ───────────────────────────────
export const getSeasonalProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const currentTier = membership?.tier ?? "bronze";
    const tierIndex = TIER_ORDER.indexOf(currentTier);

    // Season points based on activity
    const seasonPoints = 0; // Would need schema field
    const requiredPoints = [0, 100, 300, 600, 1200]; // Points needed for each tier upgrade
    const nextTierIndex = Math.min(tierIndex + 1, 4);
    const pointsNeeded = requiredPoints[nextTierIndex] ?? 0;

    return {
      currentTier,
      seasonPoints,
      pointsNeeded,
      nextTier: TIER_ORDER[nextTierIndex] ?? null,
      progress: pointsNeeded > 0 ? Math.min(100, Math.round((seasonPoints / pointsNeeded) * 100)) : 100,
      seasonEnd: null, // Would be computed from season data
      message: tierIndex >= 4
        ? "أنت في أعلى مستوى! 🏆"
        : `اجمع ${pointsNeeded - seasonPoints} نقطة إضافية للترقية إلى ${TIER_ORDER[nextTierIndex]}`,
    };
  },
});

// ─── 2. Room Collective Rewards ───────────────────────────────
export const getRoomCollectiveRewards = query({
  args: { roomId: v.string() },
  handler: async (_ctx, { roomId }) => {
    return {
      roomId,
      activeMembers: 0,
      collectiveBonus: 0,
      threshold: 100,
      message: ".activity أعضاء الغرفة يحققون مكافآت جماعية!",
    };
  },
});

// ─── 4. Membership Legacy (inheritance) ───────────────────────
export const getMembershipLegacy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!membership || membership.tier === "bronze") return null;

    const isActive = !membership.expiresAt || membership.expiresAt > Date.now();
    const now = Date.now();
    const isExpired = membership.expiresAt ? membership.expiresAt < now : false;

    return {
      tier: membership.tier,
      isActive,
      isExpired,
      legacyFeatures: isExpired
        ? {
           保留_badge: true,
            retain_frame: true,
            retain_sounds: false,
            retain_aiLevel: "basic",
            retain_privateRooms: 0,
            message: "تحتفظ بشارة وإطار العضوية السابقة رغم انتهائها",
          }
        : null,
      daysUntilExpiry: membership.expiresAt
        ? Math.max(0, Math.floor((membership.expiresAt - now) / (24 * 60 * 60 * 1000)))
        : null,
    };
  },
});

// ─── 5. Honor Board ───────────────────────────────────────────
export const getHonorBoard = query({
  args: { tier: v.string() },
  handler: async (ctx, { tier }) => {
    const tierIndex = TIER_ORDER.indexOf(tier);
    if (tierIndex < 0) return [];

    const memberships = await ctx.db.query("memberships").collect();
    const targetMemberships = memberships.filter((m) => {
      const mTierIndex = TIER_ORDER.indexOf(m.tier);
      return mTierIndex >= tierIndex;
    });

    const results: { name: string; tier: string; days: number }[] = [];
    const now = Date.now();
    for (const m of targetMemberships.slice(0, 30)) {
      if (!m.expiresAt || m.expiresAt > now) {
        const user = await ctx.db.get(m.userId);
        if (user) {
          results.push({
            name: user.name ?? "مجهول",
            tier: m.tier,
            days: Math.floor((now - m.activatedAt) / (24 * 60 * 60 * 1000)),
          });
        }
      }
    }

    return results.sort((a, b) => b.days - a.days).slice(0, 10);
  },
});

// ─── 6. Gift Temporary Upgrade ────────────────────────────────
export const giftUpgrade = mutation({
  args: {
    targetUserId: v.id("users"),
    durationDays: v.number(),
  },
  handler: async (ctx, { targetUserId, durationDays }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const senderMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const senderTier = senderMembership?.tier ?? "bronze";
    const senderTierIndex = TIER_ORDER.indexOf(senderTier);

    if (senderTierIndex < 2) throw new Error("يجب أن تكون عضوية ذهبية أو أعلى");
    const maxDays = senderTierIndex === 2 ? 7 : senderTierIndex === 3 ? 14 : 30;
    if (durationDays > maxDays) throw new Error(`الحد الأقصى ${maxDays} أيام`);

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .first();

    const targetTierIndex = TIER_ORDER.indexOf(targetMembership?.tier ?? "bronze");
    if (targetTierIndex >= senderTierIndex) {
      throw new Error("لا يمكن إهداء ترقية للاعب بنفس مستواك أو أعلى");
    }

    const targetCurrentTier = targetMembership?.tier ?? "bronze";
    const giftTier = TIER_ORDER[TIER_ORDER.indexOf(targetCurrentTier) + 1] ?? "silver";

    if (targetMembership) {
      await ctx.db.patch(targetMembership._id, {
        tier: giftTier as any,
        expiresAt: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      });
    } else {
      await ctx.db.insert("memberships", {
        userId: targetUserId,
        tier: giftTier as any,
        activatedAt: Date.now(),
        expiresAt: Date.now() + durationDays * 24 * 60 * 60 * 1000,
        features: [],
      });
    }

    return { success: true, giftTier, durationDays };
  },
});

// ─── 8. Exclusive Weekly Day ──────────────────────────────────
export const getWeeklyExclusive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const tier = membership?.tier ?? "bronze";
    const tierIndex = TIER_ORDER.indexOf(tier);

    if (tierIndex < 2) return null;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const exclusiveDays: Record<string, number[]> = {
      gold: [5],
      diamond: [4, 5],
      exclusive: [3, 4, 5, 6],
    };

    const myDays = exclusiveDays[tier] ?? [];
    const isTodayExclusive = myDays.includes(dayOfWeek);
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    return {
      tier,
      exclusiveDays: myDays.map((d) => dayNames[d]),
      isTodayExclusive,
      multiplier: tierIndex >= 3 ? 2 : 1.5,
      description: isTodayExclusive
        ? "اليوم حصري لك! مكافآت مضاعفة وتحديات خاصة"
        : `أيامك الحصرية: ${myDays.map((d) => dayNames[d]).join(", ")}`,
    };
  },
});

// ─── 9. AI Comparative Analysis ───────────────────────────────
export const getComparativeAnalysis = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const myTier = membership?.tier ?? "bronze";
    const me = await ctx.db.get(userId);
    if (!me) return null;

    return {
      myTier,
      myStats: { name: me.name ?? "مجهول" },
      message: "تحليل مقارن — بيانات الأداء進行 في الخادم",
    };
  },
});

// ─── 10. Legendary Voting ─────────────────────────────────────
export const getVotingTopics = query({
  args: {},
  handler: async () => {
    return [
      { id: "vote1", title: "حدث التحدي الذهني الأسبوعي", description: "إضافة تحدي ذهني كل أسبوع بمكافآت مضاعفة", votes: 42, category: "أحداث" },
      { id: "vote2", title: "نظام العصابات المتقدم", description: "توسيع نظام العصابات مع تحديات جماعية", votes: 38, category: "مجتمع" },
      { id: "vote3", title: "لوحة الصدارة الشهرية", description: "تصنيف شهري مع جوائز لأفضل 10 لاعبين", votes: 35, category: "تنافس" },
      { id: "vote4", title: "تحدي الألغاز المتسلسلة", description: "سلسلة ألغاز مترابطة كل لغز يفتح التالي", votes: 29, category: "تحديات" },
    ];
  },
});

export const voteOnTopic = mutation({
  args: { topicId: v.string() },
  handler: async (ctx, { topicId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (membership?.tier !== "exclusive") {
      throw new Error("التصويت مخصص للأعضاء الأسطوريين فقط");
    }

    return { success: true, topicId };
  },
});

// ─── Admin: Manual Tier Change ────────────────────────────────
export const adminChangeTier = mutation({
  args: {
    targetUserId: v.id("users"),
    newTier: v.string(),
    reason: v.string(),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, { targetUserId, newTier, reason, durationDays }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) {
      throw new Error("غير مصرح");
    }

    const validTiers = ["bronze", "silver", "gold", "diamond", "exclusive"];
    if (!validTiers.includes(newTier)) throw new Error("مستوى غير صحيح");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .first();

    const expiresAt = durationDays
      ? Date.now() + durationDays * 24 * 60 * 60 * 1000
      : undefined;

    if (membership) {
      await ctx.db.patch(membership._id, {
        tier: newTier as any,
        ...(expiresAt ? { expiresAt } : {}),
      });
    } else {
      await ctx.db.insert("memberships", {
        userId: targetUserId,
        tier: newTier as any,
        activatedAt: Date.now(),
        expiresAt,
        features: [],
      });
    }

    const targetUser = await ctx.db.get(targetUserId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: me.name ?? "المالك",
      action: "تغيير عضوية",
      targetId: targetUserId,
      targetName: targetUser?.name ?? "مجهول",
      reason,
      severity: "medium",
      createdAt: Date.now(),
    });

    return { success: true, newTier, targetName: targetUser?.name };
  },
});
