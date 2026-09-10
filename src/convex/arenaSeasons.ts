/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 12 — مواسم الحلبة (Arena Seasons)
 *
 * كل موسم يستمر 30 يوماً وله تصنيف منفصل يبدأ من 1000. عند انتهاء الموسم
 * يُغلق تلقائياً عند أول طلب، ويُحتسب ترتيب اللاعبين ويُسجَّل للهم حتى
 * يستلم مكافأته من لوحة الحلبة. الموسم الجديد يبدأ فوراً برقم أعلى.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { TIERS, tierOf } from "./arena";

const SEASON_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوماً
const START_RATING = 1000;

const SEASON_NAMES = [
  "موسم السيوف",
  "موسم العقول",
  "موسم الأبطال",
  "موسم الظلال",
  "موسم النخبة",
  "موسم التاج",
];

type SeasonDoc = {
  _id: any;
  number: number;
  name: string;
  startAt: number;
  endAt: number;
  status: "active" | "closed";
};

/** احضر الموسم النشط — أنشئه إذا لم يوجد، وأغلق الموسم منتهي الصلاحية تلقائياً. */
async function ensureActiveSeason(ctx: { db: any }): Promise<SeasonDoc> {
  const now = Date.now();

  // أغلق الموسم النشط المنتهي
  const active = await ctx.db
    .query("arenaSeasons")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .collect();

  for (const s of active as SeasonDoc[]) {
    if (now >= s.endAt) {
      await ctx.db.patch(s._id, { status: "closed" });
      await ctx.db.insert("aiDecisionLog", {
        system: "owner",
        actorName: "مواسم الحلبة",
        action: "arena_season_closed",
        detail: `انتهى «${s.name}» (#${s.number}) — صار ترتيب النهائي متاحاً للاستلام`,
        severity: "low",
        createdAt: now,
      });
    } else {
      return s;
    }
  }

  // لا موسم نشط → أنشئ موسماً جديداً
  const highest = await ctx.db
    .query("arenaSeasons")
    .order("desc")
    .take(1);
  const nextNumber = highest[0] ? highest[0].number + 1 : 1;
  const name = `${SEASON_NAMES[(nextNumber - 1) % SEASON_NAMES.length]} #${nextNumber}`;

  const seasonId = await ctx.db.insert("arenaSeasons", {
    number: nextNumber,
    name,
    startAt: now,
    endAt: now + SEASON_MS,
    status: "active",
  });
  const created = await ctx.db.get(seasonId);
  return created as SeasonDoc;
}

/** صف لاعب الموسم — أنشئه إن لم يوجد (مسار كتابي فقط). */
async function ensureSeasonPlayer(
  ctx: { db: any },
  seasonId: any,
  userId: any,
) {
  const existing = await ctx.db
    .query("arenaSeasonPlayers")
    .withIndex("by_season_user", (q: any) =>
      q.eq("seasonId", seasonId).eq("userId", userId),
    )
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("arenaSeasonPlayers", {
    seasonId,
    userId,
    rating: START_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
    bestRating: START_RATING,
  });
  return await ctx.db.get(id);
}

// ── استعلامات ──

/** الموسم الحالي + ترتيبي فيه (استعلام قراءة فقط — بلا كتابة). */
export const getCurrentSeason = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // آخر موسم غير مغلق (أو المنتهي الذي لم يُغلق بعد — يُغلق عند أول طفرة)
    const seasons = await ctx.db
      .query("arenaSeasons")
      .order("desc")
      .take(2);
    let season: SeasonDoc | undefined;
    for (const s of seasons as SeasonDoc[]) {
      if (s.status === "active") {
        season = s;
        break;
      }
    }
    if (!season) {
      // لا موسم بعد — احسب مجدول افتراضي للعرض فقط
      return {
        season: null as null | {
          number: number;
          name: string;
          startAt: number;
          endAt: number;
        },
        me: null as null | {
          rating: number;
          wins: number;
          losses: number;
          draws: number;
          rank: number | null;
          tier: { name: string; emoji: string };
        },
      };
    }

    let me: {
      rating: number;
      wins: number;
      losses: number;
      draws: number;
      rank: number | null;
      tier: { name: string; emoji: string };
    } | null = null;

    if (userId !== null) {
      const row = await ctx.db
        .query("arenaSeasonPlayers")
        .withIndex("by_season_user", (q: any) =>
          q.eq("seasonId", season!._id).eq("userId", userId),
        )
        .first();
      if (row) {
        const higher = await ctx.db
          .query("arenaSeasonPlayers")
          .withIndex("by_season_rating", (q: any) =>
            q
              .eq("seasonId", season!._id)
              .gt("rating", row.rating),
          )
          .collect();
        me = {
          rating: row.rating,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          rank: higher.length + 1,
          tier: tierOf(row.rating),
        };
      }
    }

    return {
      season: {
        number: season.number,
        name: season.name,
        startAt: season.startAt,
        endAt: season.endAt,
      },
      me,
    };
  },
});

/** لوحة ترتيب الموسم النشط. */
export const getSeasonLadder = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 25);
    const seasons = await ctx.db
      .query("arenaSeasons")
      .order("desc")
      .take(3);
    const season = (seasons as SeasonDoc[]).find((s) => s.status === "active");
    if (!season) return [];

    const rows = await ctx.db
      .query("arenaSeasonPlayers")
      .withIndex("by_season_rating", (q: any) =>
        q.eq("seasonId", season._id).gte("rating", 0),
      )
      .order("desc")
      .take(take * 3);

    const out: Array<{
      userId: string;
      name: string;
      rating: number;
      wins: number;
      rank: number;
      tier: { name: string; emoji: string };
    }> = [];

    for (const r of rows) {
      if (r.wins + r.losses + r.draws === 0) continue;
      const user = await ctx.db.get(r.userId);
      if (!user) continue;
      out.push({
        userId: r.userId,
        name: user.name ?? "لاعب مجهول",
        rating: r.rating,
        wins: r.wins,
        rank: out.length + 1,
        tier: tierOf(r.rating),
      });
      if (out.length >= take) break;
    }
    return out;
  },
});

/** مكافآت الموسم المنتهي — قائمة انتظار الاستلام الخاصة بي. */
export const getMySeasonRewards = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const closed = await ctx.db
      .query("arenaSeasons")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .collect();
    const out: Array<{
      seasonNumber: number;
      seasonName: string;
      rank: number;
      rating: number;
      tier: { name: string; emoji: string };
      rewardTier: string;
      claimed: boolean;
    }> = [];
    for (const s of closed) {
      const row = await ctx.db
        .query("arenaSeasonPlayers")
        .withIndex("by_season_user", (q) =>
          q.eq("seasonId", s._id).eq("userId", userId),
        )
        .first();
      if (!row || row.wins + row.losses + row.draws === 0) continue;
      out.push({
        seasonNumber: s.number,
        seasonName: s.name,
        rank: row.rewardRank ?? 0,
        rating: row.rating,
        tier: tierOf(row.rating),
        rewardTier: row.rewardTier ?? "مشاركة",
        claimed: row.rewardClaimed ?? false,
      });
    }
    return out.sort((a, b) => b.seasonNumber - a.seasonNumber);
  },
});

// ── طفرات ──

/**
 * طفرة داخلية: تسجيل نتيجة مبارزة في الموسم النشط.
 * تُستدعى من arena.recordDuelResult بعد تحديث التصنيف الدائم.
 */
export const applySeasonDuel = internalMutation({
  args: {
    hostUserId: v.id("users"),
    hostScore: v.number(), // 1 | 0 | 0.5
    guestUserId: v.id("users"),
    guestScore: v.number(),
  },
  handler: async (ctx, { hostUserId, hostScore, guestUserId, guestScore }) => {
    const season = await ensureActiveSeason(ctx);
    for (const [uid, score] of [
      [hostUserId, hostScore],
      [guestUserId, guestScore],
    ] as const) {
      const p = await ensureSeasonPlayer(ctx, season._id, uid);
      const won = score === 1;
      const lost = score === 0;
      const delta = won ? 25 : lost ? -20 : 5; // تقدّم موسمي أبسط وأسرع من الدائم
      const newRating = Math.max(100, p.rating + delta);
      await ctx.db.patch(p._id, {
        rating: newRating,
        wins: p.wins + (won ? 1 : 0),
        losses: p.losses + (lost ? 1 : 0),
        draws: p.draws + (won || lost ? 0 : 1),
        bestRating: Math.max(p.bestRating, newRating),
      });
    }
  },
});

/** استلم مكافأة موسم منتهي — يحتسب الترتيب النهائي ويمنح المكافأة. */
export const claimSeasonReward = mutation({
  args: { seasonNumber: v.number() },
  handler: async (ctx, { seasonNumber }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const seasons = await ctx.db
      .query("arenaSeasons")
      .withIndex("by_status", (q) => q.eq("status", "closed"))
      .collect();
    const season = seasons.find((s) => s.number === seasonNumber);
    if (!season) throw new Error("الموسم غير موجود أو لم ينتهِ بعد");

    const row = await ctx.db
      .query("arenaSeasonPlayers")
      .withIndex("by_season_user", (q) =>
        q.eq("seasonId", season._id).eq("userId", userId),
      )
      .first();
    if (!row) throw new Error("لم تشارك في هذا الموسم");
    if (row.rewardClaimed) throw new Error("استلمت مكافأة هذا الموسم سابقاً");
    if (row.wins + row.losses + row.draws === 0)
      throw new Error("لا مكافأة للاعبين لم يخاضوا مبارزة");

    // احسب الترتيب النهائي
    const all = await ctx.db
      .query("arenaSeasonPlayers")
      .withIndex("by_season_rating", (q) =>
        q.eq("seasonId", season._id).gte("rating", 0),
      )
      .order("desc")
      .collect();
    const ranked = all.filter((p) => p.wins + p.losses + p.draws > 0);
    const rank = ranked.findIndex((p) => p.userId === userId) + 1;
    if (rank === 0) throw new Error("تعذّر تحديد الترتيب");

    const rewardTier =
      rank === 1
        ? "بطل الموسم 👑"
        : rank <= 3
          ? "منصة التتويج 🏆"
          : rank <= 10
            ? "نخبة العشرة ⭐"
            : "مشاركة شرفية 🎗️";

    await ctx.db.patch(row._id, {
      rewardClaimed: true,
      rewardRank: rank,
      rewardTier,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "مواسم الحلبة",
      action: "arena_season_reward_claimed",
      detail: `استلم اللاعب مكافأة الموسم «${season.name}» — المرتبة #${rank} (${rewardTier})`,
      targetId: String(userId),
      severity: "low",
      createdAt: Date.now(),
    });

    return { rank, rewardTier };
  },
});
