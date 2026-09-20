/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ حروب العشائر — الموسم الرسمي (الإصدار 3.0، المرحلة 3)
 *
 *  - كل أسبوع تُقابل كل عشيرة نشطة بعشيرة متقاربة في النقاط (سحب عشوائي مرجّح)
 *  - نقاط الحرب تأتي فعلياً من جولات الأعضاء (يُربط في games.finishGame)
 *  - لوحة الحرب الحية: عشيرتك ضد خصمك بالوقت الحقيقي
 *  - خزينة العشيرة: مكافأة نهاية الأسبوع تُودَع فيها + ترقيات تشتريها
 *  - أقسام الحرب: برونز → فضي → ذهبي → ماسي مع ترقية وهبوط أسبوعي
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { clanPerks } from "./clanCore";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** سقف مسح العشائر/الحروب — يمنع أي قراءة غير محدودة. */
const CLAN_SCAN = 200;
const WAR_SCAN = 50;

export const WAR_DIVISIONS = ["برونز", "فضي", "ذهبي", "ماسي"] as const;
export type WarDivision = (typeof WAR_DIVISIONS)[number];

/** ترقيات العشيرة — تُشترى من الخزينة بمكاسب الحرب */
export const CLAN_UPGRADES = [
  { key: "banner", name: "راية العشيرة المذهّبة", emoji: "🚩", cost: 200, desc: "راية ذهبية تظهر على ملف العشيرة" },
  { key: "hall", name: "قاعة الحرب الكبرى", emoji: "🏛️", cost: 400, desc: "زخرفة فخمة لدردشة العشيرة" },
  { key: "morale", name: "طبل المعنويات", emoji: "🥁", desc: "+10% نقاط حرب لكل الأعضاء أسبوعاً كاملاً", cost: 350 },
] as const;

function weekKey(t: number): number {
  return Math.floor(t / WEEK_MS) * WEEK_MS;
}

// ─────────────────────────────────────────────────────────────────────────
// المطابقة الأسبوعية — cron
// ─────────────────────────────────────────────────────────────────────────

/**
 * دورة المطابقة: كل ساعة، لكل عشيرة بلا حرب نشطة في الأسبوع الحالي،
 * اختر خصماً متقارباً في النقاط (بنفس القسم أولاً) وأنشئ الحرب.
 */
export const matchmakeWars = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const week = weekKey(now);
    const clans = await ctx.db.query("clans").collect();
    if (clans.length < 2) return { matched: 0 };

    const wars = await ctx.db.query("clanWars").collect();
    const activeByClan = new Map<Id<"clans">, true>();
    for (const w of wars) {
      if (w.week === week && w.status === "active") {
        activeByClan.set(w.clanAId, true);
        activeByClan.set(w.clanBId, true);
      }
    }

    // العشائر التي لا تملك حرباً هذا الأسبوع — مرتبة بالنقاط لتقارب الخصوم
    const free = clans
      .filter((c) => !activeByClan.has(c._id) && c.members.length >= 1)
      .sort((a, b) => b.pointsThisWeek - a.pointsThisWeek);

    let matched = 0;
    const used = new Set<Id<"clans">>();
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      if (used.has(a._id)) continue;
      // أقرب خصم في النقاط لم يُستخدم بعد
      let best: (typeof free)[number] | null = null;
      let bestGap = Infinity;
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        if (used.has(b._id)) continue;
        const gap = Math.abs(a.pointsThisWeek - b.pointsThisWeek);
        if (gap < bestGap) {
          bestGap = gap;
          best = b;
        }
      }
      if (!best) break;
      used.add(a._id);
      used.add(best._id);
      await ctx.db.insert("clanWars", {
        week,
        clanAId: a._id,
        clanBId: best._id,
        clanAName: a.name,
        clanBName: best.name,
        pointsA: 0,
        pointsB: 0,
        division: divisionOf(a, best),
        status: "active",
        rewardPaid: false,
        createdAt: now,
      });
      matched++;
    }
    return { matched };
  },
});

/** قسم الحرب: أعلى قسم من وسط العشيرتين بالنقاط التاريخية */
function divisionOf(a: { totalPoints: number }, b: { totalPoints: number }): string {
  const avg = (a.totalPoints + b.totalPoints) / 2;
  if (avg >= 5000) return "ماسي";
  if (avg >= 2500) return "ذهبي";
  if (avg >= 1000) return "فضي";
  return "برونز";
}

// ─────────────────────────────────────────────────────────────────────────
// احتساب نقاط الحرب في المواجهة — يُربط من games.finishGame
// ─────────────────────────────────────────────────────────────────────────

/** سجّل نقاط حرب جولة عضو في مواجهة العشيرة النشطة */
export const recordWarFaceoff = internalMutation({
  args: {
    userId: v.id("users"),
    won: v.boolean(),
    correctRatio: v.number(),
    score: v.number(),
  },
  handler: async (ctx, { userId, won, correctRatio, score }) => {
    const now = Date.now();
    const week = weekKey(now);
    const clans = await ctx.db.query("clans").take(CLAN_SCAN);
    const clan = clans.find((c) => c.members.includes(userId));
    if (!clan) return;

    const war = await ctx.db
      .query("clanWars")
      .withIndex("by_week", (q) => q.eq("week", week))
      .take(WAR_SCAN)
      .then((rows) =>
        rows.find(
          (w) => w.status === "active" && (w.clanAId === clan._id || w.clanBId === clan._id),
        ),
      );
    if (!war) return;

    let gained = 5; // مشاركة
    if (won) gained += 15;
    if (correctRatio >= 1) gained += 10;
    gained += Math.floor(score / 100);

    // طبل المعنويات: +10% إن كانت مملوكة
    const morale = await ctx.db
      .query("clanUpgrades")
      .withIndex("by_clan_key", (q) =>
        q.eq("clanId", clan._id).eq("key", "morale"),
      )
      .first();
    if (morale && (!morale.expiresAt || morale.expiresAt > now)) {
      gained = Math.floor(gained * 1.1);
    }

    const isA = war.clanAId === clan._id;
    await ctx.db.patch(war._id, isA ? { pointsA: war.pointsA + gained } : { pointsB: war.pointsB + gained });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// التسوية الأسبوعية: مكافأة الخزينة + ترقية/هبوط + إنهاء الحروب
// ─────────────────────────────────────────────────────────────────────────

export const settleWars = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const week = weekKey(now - WEEK_MS); // الأسبوع الماضي
    const wars = await ctx.db
      .query("clanWars")
      .withIndex("by_week", (q) => q.eq("week", week))
      .collect();
    let settled = 0;

    for (const war of wars) {
      if (war.status !== "active") continue;
      const aWon = war.pointsA >= war.pointsB;
      const winnerId = aWon ? war.clanAId : war.clanBId;
      const loserId = aWon ? war.clanBId : war.clanAId;
      const reward = 150 + Math.min(war.pointsA, war.pointsB); // مكافأة أساسية + حدّة المعاركة

      // إيداع المكافأة في خزينة الفائز
      const treasury = await ctx.db
        .query("clanTreasury")
        .withIndex("by_clan", (q) => q.eq("clanId", winnerId))
        .first();
      if (treasury) {
        await ctx.db.patch(treasury._id, { coins: treasury.coins + reward, updatedAt: now });
      } else {
        await ctx.db.insert("clanTreasury", { clanId: winnerId, coins: reward, upgrades: [], updatedAt: now });
      }

      // ترقية الفائز وهبوط الخاسر (نقاط القسم في سجل الحرب)
      await bumpDivision(ctx, winnerId, +1);
      await bumpDivision(ctx, loserId, -1);

      await ctx.db.patch(war._id, { status: "settled", rewardPaid: true, settledAt: now });
      settled++;
    }
    return { settled };
  },
});

async function bumpDivision(ctx: MutationCtx, clanId: Id<"clans">, delta: number) {
  const clan = await ctx.db.get(clanId);
  if (!clan) return;
  const idx = Math.min(
    Math.max((clan.warDivision ?? 0) + delta, 0),
    WAR_DIVISIONS.length - 1,
  );
  await ctx.db.patch(clanId, { warDivision: idx });
}

// ─────────────────────────────────────────────────────────────────────────
// الخزينة والترقيات (طفرات لاعب — قائد العشيرة)
// ─────────────────────────────────────────────────────────────────────────

/** خزينة عشيرتي + ترقياتي */
export const getMyTreasury = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const all = await ctx.db.query("clans").take(200);
    const mine = all.find((c) => c.members.includes(userId));
    if (!mine) return null;
    // ⚔️ ميزة رتبة العشيرة: خصم على ترقيات الخزينة
    const discountPct = clanPerks(mine.clanLevel ?? 1).treasuryDiscountPct;
    const treasury = await ctx.db
      .query("clanTreasury")
      .withIndex("by_clan", (q) => q.eq("clanId", mine._id))
      .first();
    const upgrades = await ctx.db
      .query("clanUpgrades")
      .withIndex("by_clan", (q) => q.eq("clanId", mine._id))
      .collect();
    const now = Date.now();
    return {
      clanId: mine._id,
      isOwner: mine.ownerId === userId,
      discountPct,
      power: mine.power ?? 0,
      clanLevel: mine.clanLevel ?? 1,
      coins: treasury?.coins ?? 0,
      upgrades: upgrades
      .filter((u) => !u.expiresAt || u.expiresAt > now)
      .map((u) => ({ key: u.key, expiresAt: u.expiresAt ?? null })),
    };
  },
});

/** شراء ترقية عشيرة — قائد العشيرة فقط، من الخزينة */
export const buyClanUpgrade = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const item = CLAN_UPGRADES.find((u) => u.key === key);
    if (!item) throw new Error("الترقية غير موجودة");
    const now = Date.now();

    const all = await ctx.db.query("clans").take(200);
    const mine = all.find((c) => c.members.includes(userId));
    if (!mine) throw new Error("لست في عشيرة");
    if (mine.ownerId !== userId) throw new Error("قائد العشيرة فقط يشتري الترقيات");
    if (mine.frozen) throw new Error("العشيرة مُجمَّدة بقرار الإدارة — الشراء موقوف مؤقتاً");

    // ⚔️ خصم رتبة العشيرة يُطبَّق فعلاً على السعر
    const discountPct = clanPerks(mine.clanLevel ?? 1).treasuryDiscountPct;
    const cost = Math.max(0, Math.round(item.cost * (1 - discountPct / 100)));

    const treasury = await ctx.db
      .query("clanTreasury")
      .withIndex("by_clan", (q) => q.eq("clanId", mine._id))
      .first();
    if (!treasury || treasury.coins < cost) {
      throw new Error(
        `الخزينة تحتاج ${cost} عملة حرب — اربحوا الحروب!${discountPct ? ` (سعركم بعد خصم الرتبة ${discountPct}%)` : ""}`,
      );
    }

    const owned = await ctx.db
      .query("clanUpgrades")
      .withIndex("by_clan_key", (q) => q.eq("clanId", mine._id).eq("key", key))
      .first();
    if (owned && (!owned.expiresAt || owned.expiresAt > now)) {
      throw new Error("العشيرة تملك هذه الترقية بالفعل");
    }

    await ctx.db.patch(treasury._id, { coins: treasury.coins - cost, updatedAt: now });
    const expiresAt = key === "morale" ? now + WEEK_MS : undefined;
    if (owned) {
      await ctx.db.patch(owned._id, { expiresAt });
    } else {
      await ctx.db.insert("clanUpgrades", { clanId: mine._id, key, expiresAt, boughtAt: now });
    }
    return { ok: true as const, name: item.name };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات — لوحة الحرب الحية
// ─────────────────────────────────────────────────────────────────────────

/** حرب هذا الأسبوع لعشيرتي — لوحة حية */
export const getMyWar = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const all = await ctx.db.query("clans").take(CLAN_SCAN);
    const mine = all.find((c) => c.members.includes(userId));
    if (!mine) return null;
    const week = weekKey(Date.now());
    const wars = await ctx.db
      .query("clanWars")
      .withIndex("by_week", (q) => q.eq("week", week))
      .take(WAR_SCAN);
    const war = wars.find(
      (w) => w.status === "active" && (w.clanAId === mine._id || w.clanBId === mine._id),
    );
    if (!war) return { hasWar: false as const, division: WAR_DIVISIONS[(mine.warDivision ?? 0) as number] ?? "برونز" };
    const isA = war.clanAId === mine._id;
    return {
      hasWar: true as const,
      division: WAR_DIVISIONS[(mine.warDivision ?? 0) as number] ?? "برونز",
      myName: isA ? war.clanAName : war.clanBName,
      rivalName: isA ? war.clanBName : war.clanAName,
      myPoints: isA ? war.pointsA : war.pointsB,
      rivalPoints: isA ? war.pointsB : war.pointsA,
      weekEndsAt: week + WEEK_MS,
    };
  },
});
