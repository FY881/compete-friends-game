/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 13 — تذكرة الموسم 2.0 (Season Pass)
 *
 * مسار تقدّم من 30 مستوى. اللاعب يكسب نقاط التذكرة تلقائياً من الجولات
 * الحقيقية (XP الجولة ÷ 10)، وكل مستوى يفتح جائزة يُستلمها يدوياً:
 * نقاط ولاء و/أو خبرة. المستويات 10/20/30 تمنح إطارات موسم حصرية
 * (frame_season_1/2/3) تظهر في لوحات الصدارة والملف الشخصي عبر
 * محلّل الزخارف الموحّد.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const MAX_TIER = 30;
const POINTS_PER_TIER = 100; // نقاط التذكرة لكل مستوى

// كتالوج الجوائز — مستويات بعينها تمنح إطارات موسمية حصرية
const SEASON_FRAMES: Record<number, string> = {
  10: "frame_season_1", // 🥉 إطار الموسم البرونزي
  20: "frame_season_2", // 🥈 إطار الموسم الفضي
  30: "frame_season_3", // 👑 إطار الموسم الذهبي
};

export function tierReward(tier: number): { loyalty: number; xp: number; frame: string | null } {
  const frame = SEASON_FRAMES[tier] ?? null;
  // جوائز متصاعدة: 20 نقطة ولاء + 50 خبرة للبداية، حتى 100 ولاء + 300 خبرة للقمة
  const loyalty = 20 + Math.floor((tier - 1) * (80 / (MAX_TIER - 1)));
  const xp = 50 + Math.floor((tier - 1) * (250 / (MAX_TIER - 1)));
  return { loyalty, xp, frame };
}

export function tierForPoints(points: number): number {
  return Math.min(MAX_TIER, Math.floor(points / POINTS_PER_TIER));
}

type DbCtx = { db: any };

/** جِب/أنشئ تذكرة الموسم لللاعب في الموسم النشط (أو موسم افتراضي رقم 1). */
async function getOrCreatePass(ctx: DbCtx, userId: Id<"users">, seasonNumber: number) {
  const existing = await ctx.db
    .query("seasonPasses")
    .withIndex("by_user_season", (q: any) =>
      q.eq("userId", userId).eq("seasonNumber", seasonNumber),
    )
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("seasonPasses", {
    userId,
    seasonNumber,
    passPoints: 0,
    claimedTiers: [],
    seasonFrames: [],
  });
  const doc = await ctx.db.get(id);
  if (!doc) throw new Error("تعذّر إنشاء تذكرة الموسم");
  return doc;
}

/** رقم الموسم الحالي (أسبوعان لكل موسم — يستمر حتى مع غياب صف موسم). */
function currentSeasonNumber(): number {
  return Math.floor(Date.now() / (14 * 24 * 60 * 60 * 1000)) + 1;
}

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات
// ─────────────────────────────────────────────────────────────────────────

/** حالتي في تذكرة الموسم: التقدم، المستوى، الجوائز القابلة للاستلام. */
export const getMyPass = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const seasonNumber = currentSeasonNumber();
    const pass = await getOrCreatePass(ctx, userId, seasonNumber);

    const currentTier = tierForPoints(pass.passPoints);
    const intoTier = pass.passPoints - currentTier * POINTS_PER_TIER;

    const tiers = Array.from({ length: MAX_TIER }, (_, i) => {
      const tier = i + 1;
      const reward = tierReward(tier);
      return {
        tier,
        reward,
        unlocked: tier <= currentTier,
        claimed: pass.claimedTiers.includes(tier),
      };
    });

    const claimable = tiers.filter((t) => t.unlocked && !t.claimed).length;

    return {
      seasonNumber,
      passPoints: pass.passPoints,
      currentTier,
      intoTier,
      pointsForTier: POINTS_PER_TIER,
      tiers,
      claimable,
      frames: pass.seasonFrames,
    };
  },
});

/** لوحة صدارة تذكرة الموسم — أسرع تقدماً هذا الموسم. */
export const getPassLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 25);
    const seasonNumber = currentSeasonNumber();
    const rows = await ctx.db
      .query("seasonPasses")
      .withIndex("by_season", (q) => q.eq("seasonNumber", seasonNumber))
      .order("desc")
      .collect();
    rows.sort((a: any, b: any) => b.passPoints - a.passPoints);

    const out: Array<{ userId: string; name: string; tier: number; passPoints: number }> = [];
    for (const r of rows.slice(0, take * 2)) {
      if (r.passPoints <= 0) continue;
      const user = await ctx.db.get(r.userId);
      if (!user) continue;
      out.push({
        userId: r.userId,
        name: user.name ?? "لاعب مجهول",
        tier: tierForPoints(r.passPoints),
        passPoints: r.passPoints,
      });
      if (out.length >= take) break;
    }
    return out;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الطفرات
// ─────────────────────────────────────────────────────────────────────────

/** استلم جائزة مستوى مفتوح — نقاط ولاء + خبرة + إطار موسمي إن كان مستوى إطار. */
export const claimTier = mutation({
  args: { tier: v.number() },
  handler: async (ctx, { tier }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (tier < 1 || tier > MAX_TIER) throw new Error("مستوى غير صالح");

    const seasonNumber = currentSeasonNumber();
    const pass = await getOrCreatePass(ctx, userId, seasonNumber);
    const currentTier = tierForPoints(pass.passPoints);
    if (tier > currentTier) throw new Error("المستوى غير مفتوح بعد — واصل اللعب!");
    if (pass.claimedTiers.includes(tier)) throw new Error("استلمت جائزة هذا المستوى سابقاً");

    const reward = tierReward(tier);

    await ctx.db.patch(pass._id, {
      claimedTiers: [...pass.claimedTiers, tier],
      seasonFrames:
        reward.frame && !pass.seasonFrames.includes(reward.frame)
          ? [...pass.seasonFrames, reward.frame]
          : pass.seasonFrames,
    });

    // نقاط الولاء — عبر internal.loyalty.awardPoints
    if (reward.loyalty > 0) {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: reward.loyalty,
        reason: `تذكرة الموسم — المستوى ${tier}`,
      });
    }

    // الخبرة — تحديث الملف الشخصي مباشرة
    if (reward.xp > 0) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, { xp: profile.xp + reward.xp });
      } else {
        const now = Date.now();
        await ctx.db.insert("profiles", {
          userId,
          xp: reward.xp,
          gamesPlayed: 0,
          gamesWon: 0,
          bestScore: 0,
          bestStreak: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          fastestAnswerMs: undefined,
          dailyStreak: 0,
          lastClaimDay: undefined,
          lastPlayedDay: undefined,
          badges: [],
          updatedAt: now,
        });
      }
    }

    return { loyalty: reward.loyalty, xp: reward.xp, frame: reward.frame };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// احتساب نقاط التذكرة — يُستدعى من games.finishGame بعد كل جولة
// ─────────────────────────────────────────────────────────────────────────

export const recordPassRound = internalMutation({
  args: { userId: v.id("users"), xpEarned: v.number() },
  handler: async (ctx, { userId, xpEarned }) => {
    const seasonNumber = currentSeasonNumber();
    const pass = await getOrCreatePass(ctx, userId, seasonNumber);
    // نقاط التذكرة = 10% من خبرة الجولة (بحد أدنى 5)
    const gained = Math.max(5, Math.round(xpEarned / 10));
    await ctx.db.patch(pass._id, { passPoints: pass.passPoints + gained });
  },
});
