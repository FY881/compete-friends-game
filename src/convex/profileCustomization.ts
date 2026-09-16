import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎨 التخصيص العميق للملف الشخصي — طبقات بريميوم حقيقية
 *
 *  • كتالوج ثيمات حقيقي (لون تمييز + خلفية) بتدرّج حسب العضوية
 *  • أنماط بطاقة استثنائية لكل ثيم
 *  • نبذة شخصية (حتى 160 حرفاً)
 *  • تثبيت حتى 3 شارات — يُتحقّق أنها شارات يملكها اللاعب فعلاً
 *  • تحكّم خصوصية حقيقي: إظهار الإحصاءات، والسماح بالتحدّي
 *  • كل تغيير يُسجَّل في مركز الذكاء الموحد (وحدة «مخصص التجربة»)
 * ═══════════════════════════════════════════════════════════════════════
 */

const TIER_RANK: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 4,
  exclusive: 5,
};

/** كتالوج الثيمات — ألوان حقيقية قابلة للتطبيق مباشرة على الواجهة */
export const THEME_CATALOG = [
  { key: "royal", name: "الملكي", emoji: "⚜️", accent: "#d4af37", accentSoft: "rgba(212,175,55,0.16)", gradient: "linear-gradient(135deg,#0b1121 0%,#1e293b 100%)", minTier: null as string | null, desc: "ذهبي ملكي كلاسيكي بهوية حرب العقول" },
  { key: "midnight", name: "منتصف الليل", emoji: "🌙", accent: "#60a5fa", accentSoft: "rgba(96,165,250,0.16)", gradient: "linear-gradient(135deg,#050a18 0%,#111827 100%)", minTier: null, desc: "أزرق كحلي هادئ مريح للعين" },
  { key: "minimal", name: "الزمرد", emoji: "💚", accent: "#34d399", accentSoft: "rgba(52,211,153,0.16)", gradient: "linear-gradient(135deg,#04140f 0%,#0f2a22 100%)", minTier: null, desc: "أخضر زمردي نظيف وحيوي" },
  { key: "crimson", name: "القرمزي", emoji: "🔥", accent: "#fb7185", accentSoft: "rgba(251,113,133,0.16)", gradient: "linear-gradient(135deg,#1a0509 0%,#2d1016 100%)", minTier: "silver", desc: "أحمر قرمزي حاد يناسب المحاربين" },
  { key: "violet", name: "البنفسجي", emoji: "🔮", accent: "#a78bfa", accentSoft: "rgba(167,139,250,0.16)", gradient: "linear-gradient(135deg,#0d0518 0%,#1f1233 100%)", minTier: "gold", desc: "بنفسجي غامض لعقول الصدارة" },
  { key: "aurora", name: "الشفق", emoji: "🌌", accent: "#22d3ee", accentSoft: "rgba(34,211,238,0.16)", gradient: "linear-gradient(135deg,#04141a 0%,#0b2b36 100%)", minTier: "diamond", desc: "تدرّج قطبي متلألئ نادر" },
  { key: "obsidian", name: "الأوبسيديان", emoji: "🖤", accent: "#f59e0b", accentSoft: "rgba(245,158,11,0.16)", gradient: "linear-gradient(135deg,#0a0a0a 0%,#20201c 100%)", minTier: "exclusive", desc: "أسود حجري بلمسة ذهبية — للنخبة" },
] as const;

/** أنماط البطاقة — شكل عرض الملف */
export const CARD_STYLES = [
  { key: "classic", name: "كلاسيك", minTier: null as string | null, desc: "بطاقة مستديرة هادئة بحدود ناعمة" },
  { key: "royal", name: "ملكي", minTier: null, desc: "حدود ذهبية وتاج أعلى البطاقة" },
  { key: "neon", name: "نيون", minTier: "silver", desc: "توهّج ملوّن حول البطاقة" },
  { key: "midnight", name: "ليلي", minTier: "gold", desc: "طبقة زجاجية داكنة أنيقة" },
  { key: "aurora", name: "شفقي", minTier: "diamond", desc: "تدرّج متحرك نادر" },
] as const;

const DEFAULT_THEME = "royal";
const DEFAULT_CARD = "classic";
const MAX_BIO = 160;
const MAX_PINNED = 3;

/** رتبة عضوية اللاعب الحقيقية (0 = بلا عضوية، أو منتهية) */
async function tierRankOf(ctx: any, userId: any): Promise<number> {
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!m) return 0;
  if (m.expiresAt && m.expiresAt <= Date.now()) return 0;
  return TIER_RANK[m.tier] ?? 0;
}

const themeByKey = (key: string) => THEME_CATALOG.find((t) => t.key === key);
const cardByKey = (key: string) => CARD_STYLES.find((c) => c.key === key);

/**
 * كتالوج الثيمات وأنماط البطاقة + ما هو مفتوح لي فعلاً حسب عضويتي.
 * هذا ما يجعل التخصيص طبقة بريميوم حقيقية: القفل مربوط بعضوية فعلية غير منتهية.
 */
export const getCustomizationCatalog = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const rank = userId ? await tierRankOf(ctx, userId) : 0;
    const mine = userId
      ? await ctx.db
          .query("profileCustomization")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first()
      : null;

    const themes = THEME_CATALOG.map((t) => ({
      key: t.key,
      name: t.name,
      emoji: t.emoji,
      accent: t.accent,
      accentSoft: t.accentSoft,
      gradient: t.gradient,
      desc: t.desc,
      minTier: t.minTier,
      unlocked: t.minTier === null || rank >= (TIER_RANK[t.minTier] ?? 0),
    }));
    const cards = CARD_STYLES.map((c) => ({
      key: c.key,
      name: c.name,
      desc: c.desc,
      minTier: c.minTier,
      unlocked: c.minTier === null || rank >= (TIER_RANK[c.minTier] ?? 0),
    }));

    return {
      signedIn: userId !== null,
      tierRank: rank,
      themes,
      cards,
      maxBio: MAX_BIO,
      maxPinned: MAX_PINNED,
      selected: {
        themeKey: mine?.themeKey ?? DEFAULT_THEME,
        cardStyle: mine?.cardStyle ?? DEFAULT_CARD,
        bio: mine?.bio ?? "",
        pinnedBadges: mine?.pinnedBadges ?? [],
        showStats: mine?.showStats ?? true,
        allowChallenges: mine?.allowChallenges ?? true,
      },
    };
  },
});

/** تخصيصي الكامل + الشارات التي أملكها فعلاً (لتثبيتها) */
export const getMyCustomization = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [rec, profile, rank] = await Promise.all([
      ctx.db.query("profileCustomization").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      tierRankOf(ctx, userId),
    ]);
    const owned = profile?.badges ?? [];
    return {
      themeKey: rec?.themeKey ?? DEFAULT_THEME,
      cardStyle: rec?.cardStyle ?? DEFAULT_CARD,
      bio: rec?.bio ?? "",
      pinnedBadges: (rec?.pinnedBadges ?? []).filter((b) => owned.includes(b)),
      showStats: rec?.showStats ?? true,
      allowChallenges: rec?.allowChallenges ?? true,
      ownedBadges: owned,
      tierRank: rank,
      updatedAt: rec?.updatedAt ?? null,
    };
  },
});

/**
 * تحديث التخصيص — بتحقق حقيقي من كل شيء:
 *  • طول النبذة
 *  • وجود الثيم/النمط وفتحه فعلاً بعضويتي
 *  • أن الشارات المثبتة (بحد أقصى 3) شارات يملكها اللاعب
 */
export const updateCustomization = mutation({
  args: {
    bio: v.optional(v.string()),
    themeKey: v.optional(v.string()),
    cardStyle: v.optional(v.string()),
    pinnedBadges: v.optional(v.array(v.string())),
    showStats: v.optional(v.boolean()),
    allowChallenges: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const rank = await tierRankOf(ctx, userId);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const owned = profile?.badges ?? [];

    let bio = args.bio;
    if (bio !== undefined) {
      bio = bio.trim().slice(0, MAX_BIO);
    }

    if (args.themeKey !== undefined) {
      const t = themeByKey(args.themeKey);
      if (!t) throw new Error("ثيم غير معروف");
      if (t.minTier !== null && rank < (TIER_RANK[t.minTier] ?? 0)) {
        throw new Error(`ثيم «${t.name}» يتطلب عضوية ${t.minTier} أو أعلى`);
      }
    }
    if (args.cardStyle !== undefined) {
      const c = cardByKey(args.cardStyle);
      if (!c) throw new Error("نمط بطاقة غير معروف");
      if (c.minTier !== null && rank < (TIER_RANK[c.minTier] ?? 0)) {
        throw new Error(`نمط «${c.name}» يتطلب عضوية ${c.minTier} أو أعلى`);
      }
    }

    let pinned = args.pinnedBadges;
    if (pinned !== undefined) {
      pinned = Array.from(new Set(pinned)).slice(0, MAX_PINNED);
      const notOwned = pinned.filter((b) => !owned.includes(b));
      if (notOwned.length > 0) throw new Error("لا يمكن تثبيت شارات لا تملكها");
    }

    const existing = await ctx.db
      .query("profileCustomization")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    const payload = {
      ...(bio !== undefined ? { bio } : {}),
      ...(args.themeKey !== undefined ? { themeKey: args.themeKey } : {}),
      ...(args.cardStyle !== undefined ? { cardStyle: args.cardStyle } : {}),
      ...(pinned !== undefined ? { pinnedBadges: pinned } : {}),
      ...(args.showStats !== undefined ? { showStats: args.showStats } : {}),
      ...(args.allowChallenges !== undefined ? { allowChallenges: args.allowChallenges } : {}),
      updatedAt: now,
    };

    if (existing) await ctx.db.patch(existing._id, payload);
    else
      await ctx.db.insert("profileCustomization", {
        userId,
        themeKey: args.themeKey ?? DEFAULT_THEME,
        cardStyle: args.cardStyle ?? DEFAULT_CARD,
        bio,
        pinnedBadges: pinned ?? [],
        showStats: args.showStats ?? true,
        allowChallenges: args.allowChallenges ?? true,
        updatedAt: now,
      });

    // 🔗 تسجيل حقيقي في مركز الذكاء الموحد (وحدة مخصص التجربة)
    const bits: string[] = [];
    if (args.themeKey) bits.push(`ثيم ${themeByKey(args.themeKey)?.name}`);
    if (args.cardStyle) bits.push(`نمط ${cardByKey(args.cardStyle)?.name}`);
    if (pinned !== undefined) bits.push(`${pinned.length} شارة مثبتة`);
    if (args.showStats !== undefined) bits.push(args.showStats ? "إظهار الإحصاءات" : "إخفاء الإحصاءات");
    if (args.allowChallenges !== undefined) bits.push(args.allowChallenges ? "قبول التحديات" : "إيقاف التحديات");
    await ctx.runMutation(internal.aiHub.logEvent, {
      unit: "personalizer",
      kind: "decision",
      severity: "info",
      summary: `اللاعب خصّص ملفه: ${bits.join(" · ") || "نبذة شخصية"}`,
    });

    return { ok: true as const, applied: bits };
  },
});

/**
 * الملف العام لأي لاعب — يحترم خصوصيته فعلياً:
 * الإحصاءات لا تُعاد إذا أوقف اللاعب إظهارها.
 */
export const getPublicCustomization = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rec = await ctx.db
      .query("profileCustomization")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const theme = themeByKey(rec?.themeKey ?? DEFAULT_THEME) ?? THEME_CATALOG[0];
    const card = cardByKey(rec?.cardStyle ?? DEFAULT_CARD) ?? CARD_STYLES[0];

    const base = {
      themeKey: theme.key,
      themeName: theme.name,
      accent: theme.accent,
      accentSoft: theme.accentSoft,
      gradient: theme.gradient,
      cardStyle: card.key,
      bio: rec?.bio ?? "",
      pinnedBadges: rec?.pinnedBadges ?? [],
      showStats: rec?.showStats ?? true,
      allowChallenges: rec?.allowChallenges ?? true,
    };

    if (!base.showStats) return { ...base, stats: null };

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      ...base,
      stats: profile
        ? {
            xp: profile.xp,
            gamesPlayed: profile.gamesPlayed,
            gamesWon: profile.gamesWon,
            bestStreak: profile.bestStreak,
            badges: profile.badges,
          }
        : null,
    };
  },
});
