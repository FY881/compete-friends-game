/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌍 البطولة العالمية — الإصدار 4.0، المرحلة 1
 *
 *  1. **التأهيل**: من يفوز بأي بطولة أسبوعية آلية يتأهل تلقائياً
 *     إلى بطولة الشهر العالمية (يُجمَع المؤهلون من سجل winnerIds).
 *  2. **أقواس إقصائية**: عند انطلاق البطولة يُبنى قوس knockout
 *     (حتى 16 مؤهلاً). كل مواجهة تُحسم من أفضل جولة للمؤهلَين
 *     خلال نافذة الدور (من gameHistory).
 *  3. **الإقليمية**: لوحات صدارة حسب المنطقة الزمنية للاعب.
 *  4. **المكافآت**: البطل يحصل على 1000 نقطة ولاء + تمثال في قاعة المشاهدة.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const DAY = 24 * 3600_000;

const WC_NAMES = [
  "كأس العقول العالمي",
  "ملحمة الحكماء",
  "دورة الأبطال الكبرى",
  "تحدي السيّد الأول",
];

type Match = {
  aId: Id<"users">;
  bId?: Id<"users">;
  aScore?: number;
  bScore?: number;
  winnerId?: Id<"users">;
};

/** أفضل نتيجة للاعب داخل نافذة زمنية */
async function bestScoreInWindow(ctx: any, userId: Id<"users">, from: number, to: number): Promise<number> {
  const rounds = await ctx.db
    .query("gameHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  return rounds
    .filter((r: { playedAt: number }) => r.playedAt >= from && r.playedAt <= to)
    .reduce((m: number, r: { score: number }) => Math.max(m, r.score), 0);
}

// ─────────────────────────────────────────────────────────────────────────
// المحرك الداخلي — يُستدعى من cron كل ساعة
// ─────────────────────────────────────────────────────────────────────────

export const manage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const monthKey = new Date(now).toISOString().slice(0, 7); // YYYY-MM

    const wc = (
      await ctx.db.query("worldChampionships")
        .withIndex("by_month", (q) => q.eq("monthKey", monthKey))
        .collect()
    )[0];

    if (!wc) {
      // اجمع مؤهلي هذا الشهر: فائزو البطولات الأسبوعية المنتهية هذا الشهر
      const monthStart = new Date(`${monthKey}-01T00:00:00Z`).getTime();
      const monthEnd = new Date(
        new Date(monthStart).setUTCMonth(new Date(monthStart).getUTCMonth() + 1),
      ).getTime();

      const ended = await ctx.db
        .query("tournaments")
        .withIndex("by_status", (q) => q.eq("status", "ended"))
        .collect();
      const qualifierIds = new Set<Id<"users">>();
      for (const t of ended) {
        if (t.endsAt >= monthStart && t.endsAt < monthEnd) {
          const winner = t.winnerIds?.[0];
          if (winner) qualifierIds.add(winner);
        }
      }
      // احتياط: فائزو آخر 4 بطولات إذا كان الشهر جديداً
      if (qualifierIds.size < 4) {
        const recent = [...ended].sort((a, b) => b.endsAt - a.endsAt).slice(0, 4);
        for (const t of recent) {
          const w = t.winnerIds?.[0];
          if (w) qualifierIds.add(w);
        }
      }

      const qualifiers = [...qualifierIds].slice(0, 16);
      const name = WC_NAMES[new Date(now).getUTCMonth() % WC_NAMES.length];

      if (qualifiers.length < 4) {
        await ctx.db.insert("worldChampionships", {
          monthKey,
          name,
          status: "waiting",
          qualifiers: [],
          bracket: [],
          round: 0,
          createdAt: now,
        });
        return { action: "waiting", qualifiers: qualifiers.length };
      }

      // بناء الأقواس: خلط عشوائي ثم أزواج
      const seeded = [...qualifiers].sort(() => Math.random() - 0.5);
      const bracket: Match[] = [];
      for (let i = 0; i < seeded.length; i += 2) {
        bracket.push({
          aId: seeded[i],
          bId: seeded[i + 1],
          aScore: undefined,
          bScore: undefined,
          winnerId: undefined,
        });
      }

      await ctx.db.insert("worldChampionships", {
        monthKey,
        name,
        status: "active",
        qualifiers: seeded,
        bracket,
        round: 1,
        roundEndsAt: now + 3 * DAY,
        createdAt: now,
      });
      return { action: "launched", qualifiers: seeded.length };
    }

    if (wc.status !== "active") return { action: "none" };
    const roundEndsAt = wc.roundEndsAt ?? now;
    if (now < roundEndsAt) return { action: "round_running", round: wc.round };

    // احسم كل مواجهات الدور الحالي
    const windowFrom = roundEndsAt - 3 * DAY;
    const decided: Match[] = [];
    const nextRoundPlayers: Id<"users">[] = [];

    for (const m of wc.bracket) {
      const bId = m.bId;
      if (m.winnerId || !bId) {
        // مواجهة محسومة سابقاً أو بلا خصم (فردي) — يمر aId
        decided.push(m.winnerId ? m : { ...m, winnerId: m.aId });
        nextRoundPlayers.push(m.winnerId ?? m.aId);
        continue;
      }
      const aBest = await bestScoreInWindow(ctx, m.aId, windowFrom, roundEndsAt);
      const bBest = await bestScoreInWindow(ctx, bId, windowFrom, roundEndsAt);
      let winnerId: Id<"users">;
      if (aBest > bBest) winnerId = m.aId;
      else if (bBest > aBest) winnerId = bId;
      else winnerId = m.aId; // تعادل أو لم يلعب أحد — الأفضلية للترتيب
      decided.push({ ...m, aScore: aBest, bScore: bBest, winnerId });
      nextRoundPlayers.push(winnerId);
    }

    if (nextRoundPlayers.length <= 1) {
      // انتهت البطولة — البطل!
      const champion = nextRoundPlayers[0] ?? wc.qualifiers[0];
      await ctx.db.patch(wc._id, { bracket: decided, status: "ended", championId: champion });
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId: champion,
        amount: 1000,
        reason: `🏆 بطل «${wc.name}» العالمية (+1000)`,
      });
      const champUser = await ctx.db.get(champion);
      await ctx.db.insert("hallOfFame", {
        seasonKey: `wc-${wc.monthKey}`,
        userId: champion,
        userName: champUser?.name ?? "البطل",
        userEmoji: "🌍",
        score: 0,
        crownedAt: now,
      });
      return { action: "champion_crowned", champion };
    }

    // بناء دور جديد من الفائزين
    const nextBracket: Match[] = [];
    for (let i = 0; i < nextRoundPlayers.length; i += 2) {
      nextBracket.push({
        aId: nextRoundPlayers[i],
        bId: nextRoundPlayers[i + 1],
        aScore: undefined,
        bScore: undefined,
        winnerId: undefined,
      });
    }
    await ctx.db.patch(wc._id, {
      bracket: nextBracket,
      round: wc.round + 1,
      roundEndsAt: now + 3 * DAY,
    });
    return { action: "next_round", round: wc.round + 1, players: nextRoundPlayers.length };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Queries — للواجهة
// ─────────────────────────────────────────────────────────────────────────

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const monthKey = new Date().toISOString().slice(0, 7);
    const wc = (
      await ctx.db.query("worldChampionships")
        .withIndex("by_month", (q) => q.eq("monthKey", monthKey))
        .collect()
    )[0];
    if (!wc) return null;

    const names: Record<string, string> = {};
    for (const uid of wc.qualifiers) {
      const u = await ctx.db.get(uid);
      if (u) names[uid] = u.name ?? "لاعب";
    }
    const champName = wc.championId ? (names[wc.championId] ?? (await ctx.db.get(wc.championId))?.name) : undefined;

    return {
      name: wc.name,
      status: wc.status,
      round: wc.round,
      roundEndsAt: wc.roundEndsAt,
      qualifierCount: wc.qualifiers.length,
      bracket: wc.bracket.map((m) => ({
        aId: m.aId,
        aName: names[m.aId] ?? "لاعب",
        bId: m.bId,
        bName: m.bId ? (names[m.bId] ?? "لاعب") : null,
        aScore: m.aScore,
        bScore: m.bScore,
        winnerId: m.winnerId,
      })),
      championId: wc.championId,
      championName: champName,
      amQualified: wc.qualifiers.some((q) => q === userId),
    };
  },
});

/** لوحة صدارة إقليمية حسب المنطقة الزمنية (UTC offset بالساعات) */
export const getRegionalLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    const myOffset = (me as unknown as { tzOffset?: number })?.tzOffset ?? 3;

    const ratings = await ctx.db
      .query("arenaRatings")
      .withIndex("by_rating", (q) => q.gt("rating", 0))
      .order("desc")
      .take(300);

    const out: { userId: string; name: string; rating: number; wins: number }[] = [];
    for (const r of ratings) {
      const u = await ctx.db.get(r.userId);
      if (!u) continue;
      const offset = (u as unknown as { tzOffset?: number })?.tzOffset ?? 3;
      if (offset === myOffset) {
        out.push({ userId: r.userId, name: u.name ?? "لاعب", rating: r.rating, wins: r.wins });
        if (out.length >= 20) break;
      }
    }
    return { myOffset, players: out };
  },
});

/** تسجيل المنطقة الزمنية للاعب (يُرسَل تلقائياً من المتصفح) */
export const setTimezone = mutation({
  args: { offsetHours: v.number() },
  handler: async (ctx, { offsetHours }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    await ctx.db.patch(userId, { tzOffset: offsetHours } as never);
  },
});
