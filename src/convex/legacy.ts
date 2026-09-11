/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏆 الهيبة والإرث (الإصدار 3.0، المرحلة 6 — الأخيرة)
 *
 *  1. نظام الهيبة: بعد المستوى 100 يتحوّل كل 5000 خبرة إلى نقطة هيبة،
 *     مع ألقاب وإطارات هيبة حصرية
 *  2. الإرث: إحصاءات العمر كله + أفضل التنافسات + آخر اللقطات في ملف مهني
 *  3. قاعة المشاهدة: أبطال المواسم يُسجَّلون تلقائياً عند كل دورة موسم
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const PRESTIGE_XP_PER_POINT = 5000; // كل 5000 خبرة بعد المستوى 100 = نقطة هيبة

export const PRESTIGE_TIERS = [
  { min: 1, name: "نجم صاعد", emoji: "✨", color: "text-sky-500" },
  { min: 3, name: "مخضرم الهيبة", emoji: "🌟", color: "text-violet-500" },
  { min: 6, name: "أسطورة الهيبة", emoji: "💫", color: "text-fuchsia-500" },
  { min: 10, name: "إله العقول", emoji: "🌌", color: "text-amber-500" },
] as const;

export function prestigeTierOf(points: number): (typeof PRESTIGE_TIERS)[number] {
  let tier: (typeof PRESTIGE_TIERS)[number] = PRESTIGE_TIERS[0];
  for (const t of PRESTIGE_TIERS) {
    if (points >= t.min) tier = t;
  }
  return tier;
}

// ─────────────────────────────────────────────────────────────────────────
// احتساب الهيبة — يُستدعى من games.finishGame
// ─────────────────────────────────────────────────────────────────────────

/** تحويل فائض الخبرة (بعد المستوى 100) إلى نقاط هيبة */
export const accruePrestige = internalMutation({
  args: { userId: v.id("users"), xpEarned: v.number() },
  handler: async (ctx, { userId, xpEarned }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return { gained: 0 };

    // فائض الخبرة فوق عتبة المستوى 100 (495000)
    const LEVEL_100_XP = 50 * 100 * 99;
    const surplus = Math.max(0, profile.xp + xpEarned - LEVEL_100_XP);
    const current = (profile as any).prestigePoints ?? 0;
    const alreadyBanked = current * PRESTIGE_XP_PER_POINT;
    const available = surplus - alreadyBanked;
    const gained = Math.floor(available / PRESTIGE_XP_PER_POINT);
    if (gained <= 0) return { gained: 0 };

    await ctx.db.patch(profile._id, { prestigePoints: current + gained } as any);
    return { gained };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الملف المهني — الإرث
// ─────────────────────────────────────────────────────────────────────────

/** ملفي المهني: إحصاءات العمر كله + أفضل التنافسات + آخر اللقطات */
export const getMyLegacy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const user = await ctx.db.get(userId);

    const prestigePoints = (profile as any)?.prestigePoints ?? 0;
    const tier = prestigeTierOf(prestigePoints);

    // أفضل التنافسات — من جدول rivalries
    const rivalries = await ctx.db
      .query("rivalries")
      .withIndex("by_a", (q) => q.eq("aId", userId as any))
      .collect();
    const rivalriesB = await ctx.db
      .query("rivalries")
      .withIndex("by_b", (q) => q.eq("bId", userId as any))
      .collect();
    const allRivalries = [...rivalries, ...rivalriesB].slice(0, 50);

    const rivals: {
      name: string;
      myWins: number;
      theirWins: number;
      encounters: number;
    }[] = [];
    for (const r of allRivalries.slice(0, 15)) {
      const otherId = r.aId === userId ? r.bId : r.aId;
      const other = await ctx.db.get(otherId as any);
      const myWins = r.aId === userId ? r.aWins : r.bWins;
      const theirWins = r.aId === userId ? r.bWins : r.aWins;
      rivals.push({
        name: (other as any)?.name ?? "لاعب",
        myWins,
        theirWins,
        encounters: myWins + theirWins + (r.draws ?? 0),
      });
    }
    rivals.sort((a, b) => b.encounters - a.encounters);

    // آخر اللقطات — أعلى الجولات تمييزاً
    const highlights = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const moments = highlights
      .filter((g) => g.stars === 3 || (g.questionCount >= 3 && g.correctCount === g.questionCount) || g.score >= 800)
      .slice(0, 5)
      .map((g) => ({
        gameCode: g.gameCode,
        score: g.score,
        stars: g.stars ?? 0,
        perfect: g.questionCount > 0 && g.correctCount === g.questionCount,
        playedAt: g.playedAt,
      }));

    return {
      name: user?.name ?? "لاعب",
      avatarEmoji: (user as any)?.avatarEmoji ?? "🧠",
      equippedTitle: (user as any)?.equippedTitle ?? null,
      prestige: {
        points: prestigePoints,
        tierName: tier.name,
        tierEmoji: tier.emoji,
        tierColor: tier.color,
        nextTierAt: PRESTIGE_TIERS.find((t) => t.min > prestigePoints)?.min ?? null,
      },
      lifetime: {
        gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
        winRate:
          profile && profile.gamesPlayed > 0
            ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
            : 0,
        bestScore: profile?.bestScore ?? 0,
        bestStreak: profile?.bestStreak ?? 0,
        accuracy:
          profile && profile.totalAnswers > 0
            ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
            : 0,
        badges: profile?.badges.length ?? 0,
      },
      topRivals: rivals.slice(0, 5),
      moments,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// قاعة المشاهدة — أبطال المواسم
// ─────────────────────────────────────────────────────────────────────────

/** تسجيل أبطال الموسم تلقائياً — يُستدعى من دورة الموسم */
export const crownSeasonChampion = internalMutation({
  args: {
    seasonKey: v.string(),
    userId: v.id("users"),
    score: v.number(),
  },
  handler: async (ctx, { seasonKey, userId, score }) => {
    const existing = await ctx.db
      .query("hallOfFame")
      .withIndex("by_season", (q) => q.eq("seasonKey", seasonKey))
      .first();
    if (existing) return { ok: false as const };

    const user = await ctx.db.get(userId);
    await ctx.db.insert("hallOfFame", {
      seasonKey,
      userId,
      userName: user?.name ?? "لاعب",
      userEmoji: (user as any)?.avatarEmoji ?? "🧠",
      score,
      crownedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/** قاعة المشاهدة — أبطال كل المواسم */
export const getHallOfFame = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("hallOfFame")
      .withIndex("by_season", (q) => q.gt("seasonKey", ""))
      .collect();
    const sorted = [...rows].sort((a: any, b: any) => b.crownedAt - a.crownedAt);
    return sorted.slice(0, Math.min(limit ?? 20, 50)).map((r: any) => ({
      _id: r._id,
      seasonKey: r.seasonKey,
      userName: r.userName,
      userEmoji: r.userEmoji,
      score: r.score,
      crownedAt: r.crownedAt,
    }));
  },
});
