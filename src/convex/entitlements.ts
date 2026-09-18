import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, TIER_ORDER, higherTier, nextTier, tierIndex, tierLabel, type Tier } from "./tiers";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎖 محرك الاستحقاقات — مصدر الحقيقة الواحد لكل امتيازات العضوية
 * ═══════════════════════════════════════════════════════════════════════
 *
 * قبل هذا الملف كانت المميزات موزّعة بين مصفوفتين متعارضتين وعدة ملفات،
 * وبعضها مكتوب في الواجهة فقط ولا يُطبَّق فعلاً. الآن:
 *
 *   • كل امتياز مُعرَّف **مرة واحدة** لكل مستوى هنا.
 *   • كل الأنظمة الأخرى (المتجر، الهدايا، الفرق، الأوضاع، الإشعارات،
 *     المشاركة، المهام…) تقرأ من هنا — فلا تعارض ولا ازدواج.
 *   • «المستوى الفعّال» = أعلى مستوى بين العضوية المدفوعة والترقيات
 *     المؤقتة النشطة (تجربة/قسيمة/مهمة/مشاركة).
 *
 * ⚠️ كل امتياز هنا **قابل للتطبيق**: رقم أو حد أو علم واضح، لا نصوص وصفية.
 */

// ═══════════════════════════════════════════════════════════════════════
// 📐 تعريف الامتيازات
// ═══════════════════════════════════════════════════════════════════════

export interface Entitlements {
  // ── المكافآت والاقتصاد ──
  xpMultiplier: number;
  loyaltyMultiplier: number;
  coinBonusPct: number;
  offlineArenaBonusPct: number; // ⭐ جديد: مكافأة إضافية في ساحة الأوفلاين
  seasonPassXpBoostPct: number; // ⭐ جديد: تسريع جواز الموسم

  // ── الحصص اليومية ──
  dailyChallenges: number;
  hintQuotaDaily: number;
  dailyGiftQuota: number;
  monthlyGiftQuota: number;
  exclusiveChallengeCount: number; // -1 = بلا حد

  // ── المساحات الاجتماعية ──
  privateRooms: number; // -1 = بلا حد
  chatRoomLimit: number;
  squadCreate: boolean;
  squadManage: boolean; // إدارة الفرقة بالكامل (طرد/ترقية/تخصيص)
  squadSlots: number;
  perkShareSlots: number; // ⭐ جديد: مشاركة امتيازاتك مع أصدقاء
  maxActiveDevices: number; // ⭐ جديد: عدد الأجهزة المتزامنة

  // ── المحتوى والذكاء ──
  questionTierAccess: "core" | "advanced" | "expert" | "legendary";
  exclusiveModes: string[];
  aiDepth: number;
  aiCapabilities: string[];
  earlyEventAccess: boolean;
  tournamentPriority: number; // ⭐ جديد: أولوية في البطولات

  // ── الهوية والمظهر ──
  profileCustomization: "basic" | "moderate" | "advanced" | "premium" | "ultimate";
  visualEffects: "none" | "subtle" | "advanced" | "ultimate";
  badgeStyle: string | null;
  frameStyle: string | null;
  soundPack: string | null;
  customTitle: boolean; // ⭐ جديد: لقب مخصّص يظهر بجانب الاسم

  // ── الخدمة والدعم ──
  support: "standard" | "priority" | "vip";
  analyticsDepth: "basic" | "full" | "pro"; // ⭐ جديد: عمق تحليلات أدائك

  // ── محرّكات 3.0 ──
  trialDays: number; // أيام تجربة متاحة لهذا المستوى
  storeDiscountPct: number; // خصم على شراء أيام الترقية
  questSlotsBonus: number; // مهام عضوية إضافية مفتوحة
  boostExtendPct: number; // نسبة تمديد مجانية عند كسب ترقية مؤقتة
}

/** الأساس المشترك لكل المستويات — ثم يُشتق منه كل مستوى بلا تكرار. */
const BASE: Entitlements = {
  xpMultiplier: 1,
  loyaltyMultiplier: 1,
  coinBonusPct: 0,
  offlineArenaBonusPct: 0,
  seasonPassXpBoostPct: 0,
  dailyChallenges: 5,
  hintQuotaDaily: 2,
  dailyGiftQuota: 0,
  monthlyGiftQuota: 0,
  exclusiveChallengeCount: 0,
  privateRooms: 0,
  chatRoomLimit: 3,
  squadCreate: false,
  squadManage: false,
  squadSlots: 0,
  perkShareSlots: 0,
  maxActiveDevices: 1,
  questionTierAccess: "core",
  exclusiveModes: ["mind-race"],
  aiDepth: 1,
  aiCapabilities: ["تحليل أساسي", "نصائح عامة"],
  earlyEventAccess: false,
  tournamentPriority: 0,
  profileCustomization: "basic",
  visualEffects: "none",
  badgeStyle: null,
  frameStyle: null,
  soundPack: null,
  customTitle: false,
  support: "standard",
  analyticsDepth: "basic",
  trialDays: 0,
  storeDiscountPct: 0,
  questSlotsBonus: 0,
  boostExtendPct: 0,
};

/**
 * مصفوفة الامتيازات لكل مستوى — تراكمية تصاعدياً.
 * كل مستوى يبني على الذي قبله عبر `...` فيصبح الفرق واضحاً ومقصوداً.
 */
const SILVER: Entitlements = {
  ...BASE,
  xpMultiplier: 1.25,
  loyaltyMultiplier: 1.2,
  coinBonusPct: 10,
  offlineArenaBonusPct: 10,
  dailyChallenges: 8,
  hintQuotaDaily: 5,
  dailyGiftQuota: 3,
  monthlyGiftQuota: 40,
  exclusiveChallengeCount: 2,
  privateRooms: 1,
  chatRoomLimit: 8,
  squadSlots: 0,
  maxActiveDevices: 2,
  questionTierAccess: "advanced",
  exclusiveModes: ["mind-race", "puzzle-clash"],
  aiDepth: 2,
  aiCapabilities: ["تحليل أساسي", "نصائح عامة", "تتبع أداء", "توصيات محسّنة"],
  badgeStyle: "silver",
  frameStyle: "silver",
  soundPack: "silver",
  profileCustomization: "moderate",
  support: "standard",
  analyticsDepth: "basic",
  trialDays: 3,
  storeDiscountPct: 5,
  boostExtendPct: 10,
};

const GOLD: Entitlements = {
  ...SILVER,
  xpMultiplier: 1.5,
  loyaltyMultiplier: 1.4,
  coinBonusPct: 20,
  offlineArenaBonusPct: 20,
  seasonPassXpBoostPct: 15,
  dailyChallenges: 12,
  hintQuotaDaily: 10,
  dailyGiftQuota: 8,
  monthlyGiftQuota: 120,
  exclusiveChallengeCount: 5,
  privateRooms: 3,
  chatRoomLimit: 15,
  squadCreate: true,
  squadSlots: 10,
  perkShareSlots: 1,
  maxActiveDevices: 3,
  questionTierAccess: "expert",
  exclusiveModes: ["mind-race", "puzzle-clash", "hero-challenge"],
  aiDepth: 3,
  aiCapabilities: [
    "تحليل أعمق", "تحديات مخصصة", "نقاط ضعف", "تتبع تقدم", "أهداف أسبوعية",
  ],
  earlyEventAccess: true,
  tournamentPriority: 1,
  profileCustomization: "advanced",
  visualEffects: "subtle",
  badgeStyle: "gold",
  frameStyle: "gold",
  soundPack: "gold",
  customTitle: true,
  support: "priority",
  analyticsDepth: "full",
  trialDays: 3,
  storeDiscountPct: 12,
  questSlotsBonus: 1,
  boostExtendPct: 20,
};

const DIAMOND: Entitlements = {
  ...GOLD,
  xpMultiplier: 1.75,
  loyaltyMultiplier: 1.6,
  coinBonusPct: 30,
  offlineArenaBonusPct: 35,
  seasonPassXpBoostPct: 30,
  dailyChallenges: 20,
  hintQuotaDaily: 20,
  dailyGiftQuota: 15,
  monthlyGiftQuota: 300,
  exclusiveChallengeCount: -1,
  privateRooms: 5,
  chatRoomLimit: 30,
  squadSlots: 20,
  perkShareSlots: 2,
  maxActiveDevices: 4,
  questionTierAccess: "legendary",
  exclusiveModes: ["mind-race", "puzzle-clash", "hero-challenge", "diamond-rush"],
  aiDepth: 4,
  aiCapabilities: [
    "تحليل عميق", "تنبؤات", "اكتشاف أنماط", "تحديات متقدمة", "إرسال هدايا",
    "خطة تحسّن أسبوعية",
  ],
  tournamentPriority: 2,
  profileCustomization: "premium",
  visualEffects: "advanced",
  badgeStyle: "diamond",
  frameStyle: "diamond",
  soundPack: "diamond",
  support: "priority",
  analyticsDepth: "pro",
  storeDiscountPct: 20,
  questSlotsBonus: 2,
  boostExtendPct: 35,
};

const EXCLUSIVE: Entitlements = {
  ...DIAMOND,
  xpMultiplier: 2,
  loyaltyMultiplier: 2,
  coinBonusPct: 50,
  offlineArenaBonusPct: 60,
  seasonPassXpBoostPct: 50,
  dailyChallenges: 30,
  hintQuotaDaily: -1,
  dailyGiftQuota: 50,
  monthlyGiftQuota: -1,
  exclusiveChallengeCount: -1,
  privateRooms: -1,
  chatRoomLimit: -1,
  squadSlots: -1,
  squadManage: true,
  perkShareSlots: 5,
  maxActiveDevices: 6,
  exclusiveModes: [
    "mind-race", "puzzle-clash", "hero-challenge", "diamond-rush", "legend-arena",
  ],
  aiDepth: 5,
  aiCapabilities: [
    "تحليل احترافي", "تحديات مولّدة", "أهداف شخصية", "متابعة يومية",
    "تنازلات متقدمة", "إرسال هدايا نادرة", "مدرّب خاص دائم",
  ],
  tournamentPriority: 3,
  profileCustomization: "ultimate",
  visualEffects: "ultimate",
  badgeStyle: "legendary",
  frameStyle: "legendary",
  soundPack: "legendary",
  customTitle: true,
  support: "vip",
  analyticsDepth: "pro",
  storeDiscountPct: 30,
  questSlotsBonus: 3,
  boostExtendPct: 50,
};

export const TIER_ENTITLEMENTS: Record<Tier, Entitlements> = {
  bronze: BASE,
  silver: SILVER,
  gold: GOLD,
  diamond: DIAMOND,
  exclusive: EXCLUSIVE,
};

// ═══════════════════════════════════════════════════════════════════════
// 🧮 حلّ المستوى الفعّال (عضوية + ترقيات مؤقتة)
// ═══════════════════════════════════════════════════════════════════════

export interface ActiveBoost {
  _id: string;
  tier: Tier;
  source: string;
  label: string;
  expiresAt: number;
}

export interface ResolvedMembership {
  /** المستوى الفعّال النهائي بعد دمج كل المصادر */
  tier: Tier;
  /** المستوى المدفوع المسجّل في جدول memberships (قد يكون أقل) */
  paidTier: Tier;
  membershipId: string | null;
  activatedAt: number | null;
  expiresAt: number | null;
  daysRemaining: number | null;
  /** هل المستوى الفعّال جاء من ترقية مؤقتة فقط؟ */
  fromBoost: boolean;
  boosts: ActiveBoost[];
}

/**
 * يحلّ المستوى الفعّال للاعب من كل المصادر الحيّة.
 * ⚠️ للقراءة فقط — لا يكتب شيئاً (آمن تماماً داخل الاستعلامات).
 */
export async function resolveMembership(
  ctx: { db: any },
  userId: string,
): Promise<ResolvedMembership> {
  const now = Date.now();

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .first();

  const paidActive =
    membership && (!membership.expiresAt || membership.expiresAt > now) ? membership : null;
  const paidTier: Tier = paidActive ? (paidActive.tier as Tier) : "bronze";

  const boostsRaw = await ctx.db
    .query("membershipBoosts")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const boosts: ActiveBoost[] = boostsRaw
    .filter((b: any) => b.expiresAt > now)
    .map((b: any) => ({
      _id: String(b._id),
      tier: b.tier as Tier,
      source: b.source,
      label: b.label,
      expiresAt: b.expiresAt,
    }));

  let tier = paidTier;
  for (const b of boosts) tier = higherTier(tier, b.tier);

  return {
    tier,
    paidTier,
    membershipId: membership ? String(membership._id) : null,
    activatedAt: paidActive ? paidActive.activatedAt : null,
    expiresAt: paidActive ? (paidActive.expiresAt ?? null) : null,
    daysRemaining:
      paidActive && paidActive.expiresAt
        ? Math.max(0, Math.ceil((paidActive.expiresAt - now) / DAY))
        : paidActive
          ? null
          : null,
    fromBoost: tierIndex(tier) > tierIndex(paidTier),
    boosts,
  };
}

/** امتيازات مستوى معيّن — الوصول الموحّد الوحيد من بقية الأنظمة. */
export function entitlementsOf(tier: Tier): Entitlements {
  return TIER_ENTITLEMENTS[tier] ?? BASE;
}

/** هل يملك هذا المستخدم امتيازاً رقمياً محدداً؟ */
export function hasEntitlement(tier: Tier, key: keyof Entitlements): boolean {
  const value = entitlementsOf(tier)[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return value !== null;
}

// ═══════════════════════════════════════════════════════════════════════
// 🌐 الاستعلامات العامة
// ═══════════════════════════════════════════════════════════════════════

/** كل ما يحتاجه اللاعب: مستواه، امتيازاته، ترقياته، ومسيرته للمستوى التالي. */
export const getEntitlements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const resolved: ResolvedMembership = userId
      ? await resolveMembership(ctx, userId)
      : {
          tier: "bronze",
          paidTier: "bronze",
          membershipId: null,
          activatedAt: null,
          expiresAt: null,
          daysRemaining: null,
          fromBoost: false,
          boosts: [],
        };

    // مسار الترقية: يُبنى من الإحصاءات الحقيقية للملف الشخصي
    const upcoming = nextTier(resolved.tier);
    let progress: {
      gamesPlayed: number;
      gamesWon: number;
      correctAnswers: number;
      bestStreak: number;
      dailyStreak: number;
      xp: number;
    } | null = null;

    if (userId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId as never))
        .first();
      if (profile) {
        progress = {
          gamesPlayed: profile.gamesPlayed ?? 0,
          gamesWon: profile.gamesWon ?? 0,
          correctAnswers: profile.correctAnswers ?? 0,
          bestStreak: profile.bestStreak ?? 0,
          dailyStreak: profile.dailyStreak ?? 0,
          xp: profile.xp ?? 0,
        };
      }
    }

    return {
      tier: resolved.tier,
      tierMeta: TIER_META[resolved.tier],
      entitlements: entitlementsOf(resolved.tier),
      paidTier: resolved.paidTier,
      paidTierMeta: TIER_META[resolved.paidTier],
      fromBoost: resolved.fromBoost,
      boosts: resolved.boosts,
      activatedAt: resolved.activatedAt,
      expiresAt: resolved.expiresAt,
      daysRemaining: resolved.daysRemaining,
      nextTier: upcoming,
      nextTierMeta: upcoming ? TIER_META[upcoming] : null,
      nextTierEntitlements: upcoming ? entitlementsOf(upcoming) : null,
      questionTier: resolved.tier,
      progress,
      isSignedIn: userId !== null,
    };
  },
});

/** مصفوفة المقارنة الكاملة (ثابتة — بلا أي قراءة قاعدة بيانات). */
export const getTierMatrix = query({
  args: {},
  handler: async () => ({
    tiers: TIER_ORDER.map((tier) => ({
      tier,
      meta: TIER_META[tier],
      index: tierIndex(tier),
      label: tierLabel(tier),
      entitlements: entitlementsOf(tier),
    })),
  }),
});
