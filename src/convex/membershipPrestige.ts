import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎖 الرتب الشرفية — مسار العضوية طويل الأمد
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل نظام عضوية آخر يقيس «الآن»: مستواك اليوم، أيامك المتبقية. هذا النظام
 * يقيس **ما بنيته عبر الزمن**: أيام العضوية الفعلية ومستواها تتراكم في
 * «نقاط شرف» لا تُصفَّر أبداً — لا بانتهاء العضوية ولا بتغيّر المستوى.
 *
 * والمكافآت **دائمة**، لا تنتهي مع العضوية:
 *   • نقاط ولاء تصرفها كما تشاء.
 *   • ترقيات مؤقتة طويلة (حتى 30 يوماً).
 *   • امتيازات تجميلية من كتالوج اللعبة (إطار/لقب) تُقيَّد في محفظتك.
 *   • شارات تُضاف لملفك الشخصي بشكل دائم.
 *
 * الاحتساب يحدث عند فتح اللاعب للصفحة (مرة كل يوم) — **بلا أي cron**،
 * فلا استهلاك حصة على لاعب غير نشط.
 */

export interface PrestigeReward {
  loyalty: number;
  boostHours: number;
  boostTier: Tier | null;
  perkKey: string | null;
  badge: string | null;
  summary: string;
}

export interface PrestigeLevelDef {
  level: number;
  name: string;
  emoji: string;
  points: number;
  reward: PrestigeReward;
}

/** سلم الرتب — تصاعدي، وكل رتبة تشرح مكافأتها بالعربية. */
export const PRESTIGE_LEVELS: readonly PrestigeLevelDef[] = [
  {
    level: 1,
    name: "وفيّ مبتدئ",
    emoji: "🌱",
    points: 0,
    reward: { loyalty: 0, boostHours: 0, boostTier: null, perkKey: null, badge: null, summary: "بداية المسار" },
  },
  {
    level: 2,
    name: "وفيّ منتظم",
    emoji: "🌿",
    points: 150,
    reward: { loyalty: 200, boostHours: 0, boostTier: null, perkKey: null, badge: null, summary: "‎200 نقطة ولاء" },
  },
  {
    level: 3,
    name: "حامل اللواء",
    emoji: "🚩",
    points: 400,
    reward: { loyalty: 0, boostHours: 24, boostTier: "silver", perkKey: null, badge: null, summary: "‎24 ساعة مستوى فضي" },
  },
  {
    level: 4,
    name: "درع الوفاء",
    emoji: "🛡️",
    points: 800,
    reward: { loyalty: 0, boostHours: 0, boostTier: null, perkKey: "frame_neon", badge: null, summary: "إطار «نيون» في محفظتك (دائم)" },
  },
  {
    level: 5,
    name: "صاحب المقام",
    emoji: "🏅",
    points: 1400,
    reward: { loyalty: 500, boostHours: 0, boostTier: null, perkKey: null, badge: null, summary: "‎500 نقطة ولاء" },
  },
  {
    level: 6,
    name: "ركن الحكمة",
    emoji: "🧭",
    points: 2200,
    reward: { loyalty: 0, boostHours: 72, boostTier: "gold", perkKey: null, badge: null, summary: "‎72 ساعة مستوى ذهبي" },
  },
  {
    level: 7,
    name: "شيخ العقول",
    emoji: "🎖️",
    points: 3200,
    reward: { loyalty: 0, boostHours: 0, boostTier: null, perkKey: null, badge: "prestige_veteran", summary: "شارة «شيخ العقول» الدائمة على ملفك" },
  },
  {
    level: 8,
    name: "عمود اللعبة",
    emoji: "🏛️",
    points: 4500,
    reward: { loyalty: 800, boostHours: 120, boostTier: "diamond", perkKey: null, badge: null, summary: "‎800 نقطة ولاء + 5 أيام مستوى ماسي" },
  },
  {
    level: 9,
    name: "سيد السيوف",
    emoji: "⚔️",
    points: 6200,
    reward: { loyalty: 0, boostHours: 0, boostTier: null, perkKey: "title_genius", badge: null, summary: "لقب «العقل المدبّر» (دائم)" },
  },
  {
    level: 10,
    name: "تاج الوفاء",
    emoji: "👑",
    points: 8500,
    reward: { loyalty: 2000, boostHours: 168, boostTier: "exclusive", perkKey: null, badge: "prestige_crown", summary: "‎2000 نقطة ولاء + 7 أيام مستوى أسطوري + تاج الوفاء" },
  },
  {
    level: 11,
    name: "أسطورة حيّة",
    emoji: "🌠",
    points: 12000,
    reward: { loyalty: 3000, boostHours: 336, boostTier: "exclusive", perkKey: null, badge: "prestige_legend", summary: "‎3000 نقطة ولاء + 14 يوماً أسطورة + شارة أسطورية" },
  },
  {
    level: 12,
    name: "خالد في الذاكرة",
    emoji: "♾️",
    points: 16000,
    reward: { loyalty: 5000, boostHours: 720, boostTier: "exclusive", perkKey: null, badge: "prestige_eternal", summary: "‎5000 نقطة ولاء + 30 يوماً أسطورياً + شارة الخلود" },
  },
] as const;

/** وزن النقاط اليومي لكل مستوى مدفوع — الأسطوري يبني رصيده أسرع. */
const DAILY_WEIGHT: Record<Tier, number> = {
  bronze: 0,
  silver: 1,
  gold: 3,
  diamond: 6,
  exclusive: 12,
};

/** حدّ أقصى للاحتساب الواحد — يمنع قفزة هائلة بعد انقطاع طويل. */
const MAX_ACCRUAL_DAYS = 90;

export function levelFor(points: number): PrestigeLevelDef {
  let found = PRESTIGE_LEVELS[0];
  for (const lvl of PRESTIGE_LEVELS) {
    if (points >= lvl.points) found = lvl;
    else break;
  }
  return found;
}

export function nextLevelAfter(points: number): PrestigeLevelDef | null {
  for (const lvl of PRESTIGE_LEVELS) {
    if (points < lvl.points) return lvl;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// 🧮 الاحتساب (كتابة)
// ═══════════════════════════════════════════════════════════════════════

async function ensurePrestigeRow(ctx: any, userId: any, paidTier: Tier) {
  const row = await ctx.db
    .query("membershipPrestige")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (row) return row;
  const id = await ctx.db.insert("membershipPrestige", {
    userId,
    points: 0,
    level: 1,
    membershipDays: 0,
    highestTier: paidTier,
    streak: 0,
    claimedLevels: [],
    lastAccrualAt: Date.now(),
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

/**
 * يحوّل أيام عضويتك الفعلية إلى نقاط شرف — يُستدعى مرة كل يوم من الواجهة.
 * آمن للتكرار: لا يحتسب إلا الفارق الزمني الحقيقي منذ آخر احتساب.
 */
export const syncMyPrestige = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false, reason: "not_signed_in" as const };

    const resolved = await resolveMembership(ctx, userId);
    const row = await ensurePrestigeRow(ctx, userId, resolved.paidTier);
    const now = Date.now();

    // العضوية المؤقتة (ترقية/قسيمة) لا تبني شرفاً — الشرف لأيام العضوية الحقيقية.
    const elapsedMs = Math.max(0, now - (row.lastAccrualAt ?? now));
    const elapsedDays = Math.min(MAX_ACCRUAL_DAYS, Math.floor(elapsedMs / DAY));
    const weight = DAILY_WEIGHT[resolved.paidTier as Tier] ?? 0;

    if (elapsedDays === 0) {
      // لا وقت كافٍ بعد — نحدّث فقط مستوى القمة المسجّل.
      if (tierIndex(resolved.paidTier) > tierIndex(row.highestTier as Tier)) {
        await ctx.db.patch(row._id, { highestTier: resolved.paidTier, updatedAt: now });
      }
      return { ok: true, gained: 0, points: row.points, level: row.level };
    }

    const gained = elapsedDays * weight;
    const streak = weight > 0 ? Math.min(520, (row.streak ?? 0) + Math.floor(elapsedDays / 7) + 1) : row.streak ?? 0;
    const streakBonus = weight > 0 ? Math.floor(streak / 4) : 0;
    const totalGain = gained + streakBonus;
    const points = row.points + totalGain;
    const level = levelFor(points).level;

    await ctx.db.patch(row._id, {
      points,
      level,
      membershipDays: (row.membershipDays ?? 0) + elapsedDays,
      highestTier: tierIndex(resolved.paidTier) > tierIndex(row.highestTier as Tier)
        ? resolved.paidTier
        : row.highestTier,
      streak,
      lastAccrualAt: now,
      updatedAt: now,
    });

    if (totalGain > 0) {
      await ctx.db.insert("membershipEvents", {
        userId,
        actorName: "نظام الرتب الشرفية",
        kind: "prestige",
        tier: resolved.paidTier,
        detail: `احتساب ${totalGain} نقطة شرف (${elapsedDays} يوماً من العضوية الفعلية)`,
        points: totalGain,
        at: now,
      });
    }

    return { ok: true, gained: totalGain, points, level, streak };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 📊 القراءة
// ═══════════════════════════════════════════════════════════════════════

export interface PrestigeLevelRow extends PrestigeLevelDef {
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
}

export const getMyPrestige = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const row = await ctx.db
      .query("membershipPrestige")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const points = row?.points ?? 0;
    const claimed: number[] = row?.claimedLevels ?? [];
    const current = levelFor(points);
    const next = nextLevelAfter(points);

    const levels: PrestigeLevelRow[] = PRESTIGE_LEVELS.map((lvl) => ({
      ...lvl,
      unlocked: points >= lvl.points,
      claimed: claimed.includes(lvl.level),
      claimable: points >= lvl.points && !claimed.includes(lvl.level) && lvl.points > 0,
    }));

    const resolved = await resolveMembership(ctx, userId);
    const ent = entitlementsOf(resolved.tier);
    const dailyWeight = DAILY_WEIGHT[resolved.paidTier as Tier] ?? 0;

    return {
      points,
      level: current.level,
      levelMeta: current,
      nextLevel: next,
      progress: next
        ? {
            current: points,
            target: next.points,
            remaining: Math.max(0, next.points - points),
            percent: Math.min(100, Math.round((points / next.points) * 100)),
          }
        : null,
      membershipDays: row?.membershipDays ?? 0,
      streak: row?.streak ?? 0,
      highestTier: (row?.highestTier as Tier) ?? resolved.paidTier,
      highestTierMeta: TIER_META[(row?.highestTier as Tier) ?? resolved.paidTier],
      dailyWeight,
      /** مضاعف الوفاء: كل رتبتين تمنحان +1% مكافآت دائمة. */
      permanentBonusPct: Math.max(0, (current.level - 1) * 1),
      claimable: levels.filter((l) => l.claimable).length,
      claimedCount: claimed.filter((c) => c > 0).length,
      levels,
      unclaimedNotes: levels.filter((l) => l.claimable).map((l) => `${l.emoji} ${l.name}: ${l.reward.summary}`),
      tierName: TIER_META[resolved.tier].name,
      loyaltyMultiplierInfo: ent.loyaltyMultiplier,
      lastAccrualAt: row?.lastAccrualAt ?? null,
    };
  },
});

/** لوحة شرف الرتب — أعلى 10 (قراءة محدودة). */
export const getPrestigeLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const top = await ctx.db.query("membershipPrestige").withIndex("by_points").order("desc").take(10);
    const rows = [];
    for (const row of top) {
      const user = (await ctx.db.get(row.userId)) as { name?: string; avatarEmoji?: string } | null;
      const def = levelFor(row.points);
      rows.push({
        userId: String(row.userId),
        name: user?.name ?? "لاعب",
        avatarEmoji: user?.avatarEmoji ?? "🙂",
        points: row.points,
        level: def.level,
        levelName: def.name,
        levelEmoji: def.emoji,
        days: row.membershipDays,
      });
    }
    return { rows };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🎁 استلام مكافآت الرتب (مكتوبة بالفعل في كل نظام حقيقي)
// ═══════════════════════════════════════════════════════════════════════

export const claimPrestigeReward = mutation({
  args: { level: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");

    const def = PRESTIGE_LEVELS.find((l) => l.level === Math.round(args.level));
    if (!def) throw new Error("رتبة غير معروفة.");
    if (def.points <= 0) throw new Error("لا مكافأة لهذه الرتبة.");

    const resolved = await resolveMembership(ctx, userId);
    const row = await ensurePrestigeRow(ctx, userId, resolved.paidTier);
    if (row.points < def.points) throw new Error("لم تبلغ هذه الرتبة بعد.");
    const claimed: number[] = row.claimedLevels ?? [];
    if (claimed.includes(def.level)) throw new Error("استلمت مكافأة هذه الرتبة بالفعل.");

    const now = Date.now();
    const granted: string[] = [];
    const r = def.reward;

    // (١) نقاط ولاء — تُضاف للمحفظة الحقيقية مع قيد في دفتر الحركات
    if (r.loyalty > 0) {
      const wallet = await ctx.db
        .query("loyaltyWallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (wallet) {
        await ctx.db.patch(wallet._id, {
          points: wallet.points + r.loyalty,
          lifetimeEarned: wallet.lifetimeEarned + r.loyalty,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("loyaltyWallets", {
          userId,
          points: r.loyalty,
          lifetimeEarned: r.loyalty,
          perks: [],
          updatedAt: now,
        });
      }
      await ctx.db.insert("loyaltyLedger", {
        userId,
        delta: r.loyalty,
        reason: `مكافأة رتبة «${def.name}»`,
        at: now,
      });
      granted.push(`${r.loyalty} نقطة ولاء`);
    }

    // (٢) ترقية مؤقتة حقيقية
    if (r.boostHours > 0 && r.boostTier) {
      await ctx.db.insert("membershipBoosts", {
        userId,
        tier: r.boostTier,
        source: "prestige",
        label: `مكافأة رتبة «${def.name}»`,
        startedAt: now,
        expiresAt: now + r.boostHours * 60 * 60 * 1000,
        note: `${Math.round(r.boostHours / 24)} يوماً من ${TIER_META[r.boostTier].name}`,
      });
      granted.push(`${r.boostHours} ساعة مستوى ${TIER_META[r.boostTier].name}`);
    }

    // (٣) امتياز تجميلي دائم في محفظة اللاعب
    if (r.perkKey) {
      const wallet = await ctx.db
        .query("loyaltyWallets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      const perks: { key: string; expiresAt?: number }[] = wallet?.perks ?? [];
      const owned = perks.some((p) => p.key === r.perkKey && (p.expiresAt ?? null) === null);
      if (wallet && !owned) {
        await ctx.db.patch(wallet._id, {
          perks: [...perks, { key: r.perkKey }],
          updatedAt: now,
        });
        granted.push(`امتياز ${r.perkKey} بشكل دائم`);
      }
    }

    // (٤) شارة دائمة على الملف الشخصي
    if (r.badge) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (profile && !(profile.badges ?? []).includes(r.badge)) {
        await ctx.db.patch(profile._id, {
          badges: [...(profile.badges ?? []), r.badge],
          updatedAt: now,
        });
        granted.push(`شارة ${r.badge}`);
      }
    }

    await ctx.db.patch(row._id, {
      claimedLevels: [...claimed, def.level],
      level: Math.max(row.level, def.level),
      updatedAt: now,
    });

    await ctx.db.insert("membershipEvents", {
      userId,
      actorName: "نظام الرتب الشرفية",
      kind: "prestige",
      tier: resolved.paidTier,
      detail: `استلام مكافأة رتبة «${def.name}»: ${granted.join(" · ") || "لا شيء"}`,
      at: now,
    });

    return { ok: true, level: def.level, granted };
  },
});
