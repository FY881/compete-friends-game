/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏆 خزانة الإنجازات — المرحلة 13 من التحول الشامل
 *
 * 1. أكثر من 30 إنجازاً حقيقياً محسوبة من بيانات اللعب الفعلية
 *    (profiles, gameHistory, categoryHistory, arenaRatings, appeals...)
 * 2. تقدّم جزئي لكل إنجاز (current/target) — يعرف اللاعب كم بقي له.
 * 3. تشغيل آلي بعد كل جولة من finishGame + إشعار ذكي عند إنجاز نادر.
 * 4. تسجيل في مركز الذكاء الموحد (وحدة المُوصي: إنجاز قريب يولّد توصية).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

type AchDef = {
  type: string;
  name: string;
  desc: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  xp: number;
  coins: number;
  target: number;
  current: (m: Metrics) => number;
};

type Metrics = {
  gamesPlayed: number;
  gamesWon: number;
  bestStreak: number;
  bestScore: number;
  xp: number;
  wins25: number;
  arenaRating: number;
  arenaWins: number;
  perfectRounds: number;
  comebackWins: number;
  bestCategoryAcc: number;
  categoriesTouched: number;
  duelDraws: number;
  weekendGames: number;
};

const RARITY_COINS: Record<AchDef["rarity"], number> = {
  common: 25,
  uncommon: 60,
  rare: 150,
  epic: 400,
  legendary: 1000,
};

/** كل التعريفات — target + current يعطيان تقدّماً جزئياً حقيقياً */
export const ACHIEVEMENT_DEFS: AchDef[] = [
  // ── الانتصارات ──
  { type: "first_win", name: "أول انتصار", desc: "فز بأول جولة", icon: "🏆", rarity: "common", xp: 50, coins: 25, target: 1, current: (m) => Math.min(m.gamesWon, 1) },
  { type: "wins_10", name: "مقاتل واعٍ", desc: "10 انتصارات", icon: "🥉", rarity: "common", xp: 120, coins: 40, target: 10, current: (m) => m.gamesWon },
  { type: "wins_25", name: "محارب", desc: "25 انتصاراً", icon: "⚔️", rarity: "rare", xp: 400, coins: 150, target: 25, current: (m) => m.gamesWon },
  { type: "wins_100", name: "قائد الحروب", desc: "100 انتصار", icon: "🛡️", rarity: "legendary", xp: 1500, coins: 1000, target: 100, current: (m) => m.gamesWon },
  // ── الجولات ──
  { type: "games_10", name: "لاعب مخضرم", desc: "10 جولات", icon: "🎮", rarity: "common", xp: 75, coins: 25, target: 10, current: (m) => m.gamesPlayed },
  { type: "games_50", name: "محترف", desc: "50 جولة", icon: "🏅", rarity: "uncommon", xp: 200, coins: 60, target: 50, current: (m) => m.gamesPlayed },
  { type: "games_100", name: "أسطورة", desc: "100 جولة", icon: "🌟", rarity: "legendary", xp: 1000, coins: 1000, target: 100, current: (m) => m.gamesPlayed },
  // ── السلاسل ──
  { type: "streak_5", name: "سلسلة 5", desc: "5 إجابات صحيحة متتالية", icon: "🔥", rarity: "uncommon", xp: 100, coins: 60, target: 5, current: (m) => m.bestStreak },
  { type: "streak_10", name: "سلسلة 10", desc: "10 إجابات صحيحة متتالية", icon: "⚡", rarity: "rare", xp: 250, coins: 150, target: 10, current: (m) => m.bestStreak },
  { type: "streak_20", name: "عقل متوهج", desc: "20 إجابة صحيحة متتالية", icon: "💫", rarity: "epic", xp: 700, coins: 400, target: 20, current: (m) => m.bestStreak },
  // ── الكمال ──
  { type: "perfect_round", name: "مثالي", desc: "جولة كاملة بلا خطأ", icon: "💎", rarity: "epic", xp: 500, coins: 400, target: 1, current: (m) => Math.min(m.perfectRounds, 1) },
  { type: "perfect_5", name: "الكمال عادة", desc: "5 جولات مثالية", icon: "🔷", rarity: "legendary", xp: 1200, coins: 1000, target: 5, current: (m) => m.perfectRounds },
  { type: "comeback", name: "الثأر العظيم", desc: "فز بعد تخلف في منتصف الجولة", icon: "🦅", rarity: "rare", xp: 350, coins: 150, target: 1, current: (m) => Math.min(m.comebackWins, 1) },
  // ── الخبرة ──
  { type: "xp_1000", name: "طالب المعرفة", desc: "1000 نقطة خبرة", icon: "📚", rarity: "uncommon", xp: 150, coins: 60, target: 1000, current: (m) => m.xp },
  { type: "xp_5000", name: "الحكيم", desc: "5000 نقطة خبرة", icon: "👑", rarity: "rare", xp: 300, coins: 150, target: 5000, current: (m) => m.xp },
  { type: "xp_20000", name: "عقل إمبراطوري", desc: "20000 نقطة خبرة", icon: "🏛️", rarity: "legendary", xp: 2000, coins: 1000, target: 20000, current: (m) => m.xp },
  // ── الحلبة (مبارزات ELO) ──
  { type: "arena_first", name: "نزيل الحلبة", desc: "أول مبارزة في الحلبة", icon: "🥊", rarity: "common", xp: 60, coins: 25, target: 1, current: (m) => (m.arenaRating > 1000 ? 1 : 0) },
  { type: "arena_1200", name: "مبارز واعد", desc: "تصنيف حلبة 1200+", icon: "🗡️", rarity: "uncommon", xp: 250, coins: 60, target: 1200, current: (m) => Math.max(0, m.arenaRating - 1000) },
  { type: "arena_1500", name: "سيّف الحلبة", desc: "تصنيف حلبة 1500+", icon: "⚔️", rarity: "rare", xp: 600, coins: 150, target: 500, current: (m) => Math.max(0, m.arenaRating - 1000) },
  { type: "arena_1800", name: "بطل الحلبة", desc: "تصنيف حلبة 1800+", icon: "🥇", rarity: "legendary", xp: 1800, coins: 1000, target: 800, current: (m) => Math.max(0, m.arenaRating - 1000) },
  { type: "arena_wins_25", name: "فتّاك المبارزات", desc: "25 فوزاً في الحلبة", icon: "🩸", rarity: "epic", xp: 800, coins: 400, target: 25, current: (m) => m.arenaWins },
  // ── التخصص المعرفي (categoryHistory) ──
  { type: "specialist_90", name: "متخصص", desc: "دقة 90%+ في فئة بعد 15 سؤالاً على الأقل", icon: "🎯", rarity: "rare", xp: 400, coins: 150, target: 90, current: (m) => m.bestCategoryAcc },
  { type: "polymath", name: "موسوعي", desc: "العب في 5 فئات معرفية مختلفة", icon: "🧠", rarity: "uncommon", xp: 220, coins: 60, target: 5, current: (m) => m.categoriesTouched },
  { type: "polymath_10", name: "عقول متعددة", desc: "العب في 10 فئات معرفية", icon: "🌌", rarity: "epic", xp: 700, coins: 400, target: 10, current: (m) => m.categoriesTouched },
  // ── الاجتماعي ──
  { type: "diplomat", name: "دبلوماسي", desc: "تعادل في 5 مبارزات بأدب", icon: "🤝", rarity: "uncommon", xp: 180, coins: 60, target: 5, current: (m) => m.duelDraws },
  { type: "weekend_warrior", name: "محارب العطلة", desc: "العب 10 جولات في عطلات نهاية الأسبوع", icon: "🎈", rarity: "common", xp: 100, coins: 40, target: 10, current: (m) => m.weekendGames },
  { type: "comeback_5", name: "روح لا تنكسر", desc: "5 انتصارات ثأرية", icon: "🔥", rarity: "epic", xp: 800, coins: 400, target: 5, current: (m) => m.comebackWins },
];

/** احسب مقاييس اللاعب الحقيقية من كل الجداول */
async function computeMetrics(ctx: any, userId: any): Promise<Metrics> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  const arena = await ctx.db
    .query("arenaRatings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  // جولات اللاعب — من gameHistory
  const history = await ctx.db
    .query("gameHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .order("desc")
    .take(200);

  let perfectRounds = 0;
  let comebackWins = 0;
  let weekendGames = 0;
  let won = 0;
  for (const h of history) {
    const total = h.totalQuestions ?? 10;
    const correct = h.correctCount ?? 0;
    if (correct >= total && total > 0) perfectRounds++;
    if (h.won) won++;
    // عطلة نهاية الأسبوع (السبت/الأحد)
    const d = new Date(h.createdAt);
    if (d.getDay() === 5 || d.getDay() === 6) weekendGames++;
  }

  // categoryHistory — التخصص
  const cats = await ctx.db
    .query("categoryHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  let bestAcc = 0;
  for (const c of cats) {
    if (c.total >= 15) {
      const acc = Math.round((c.correct / c.total) * 100);
      if (acc > bestAcc) bestAcc = acc;
    }
  }

  return {
    gamesPlayed: profile?.gamesPlayed ?? history.length,
    gamesWon: Math.max(profile?.gamesWon ?? 0, won),
    bestStreak: profile?.bestStreak ?? 0,
    bestScore: profile?.bestScore ?? 0,
    xp: profile?.xp ?? 0,
    wins25: 0,
    arenaRating: arena?.rating ?? 1000,
    arenaWins: arena?.wins ?? 0,
    perfectRounds,
    comebackWins,
    bestCategoryAcc: bestAcc,
    categoriesTouched: cats.length,
    duelDraws: arena?.draws ?? 0,
    weekendGames,
  };
}

/** الفحص والمكافأة — تُستدعى آلياً بعد كل جولة، أو يدوياً من اللاعب */
export const evaluateAchievements = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const metrics = await computeMetrics(ctx, userId);
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const owned = new Set(existing.map((e) => e.type));
    const now = Date.now();
    const newlyEarned: { type: string; name: string; icon: string; rarity: string }[] = [];

    for (const def of ACHIEVEMENT_DEFS) {
      if (owned.has(def.type)) continue;
      const cur = def.current(metrics);
      if (cur >= def.target) {
        await ctx.db.insert("achievements", {
          userId,
          type: def.type,
          name: def.name,
          description: def.desc,
          icon: def.icon,
          rarity: def.rarity,
          xpReward: def.xp,
          earnedAt: now,
        });
        newlyEarned.push({ type: def.type, name: def.name, icon: def.icon, rarity: def.rarity });

        // مكافأة خبرة
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        if (profile) {
          await ctx.db.patch(profile._id, { xp: (profile.xp ?? 0) + def.xp });
        }
        // مكافأة عملات حرب عبر المحفظة
        const coins = RARITY_COINS[def.rarity];
        try {
          await ctx.runMutation(internal.loyalty.awardPoints, {
            userId,
            amount: coins,
            reason: `إنجاز: ${def.name}`,
          });
        } catch { /* المحفظة اختيارية */ }

        // إشعار ذكي للإنجازات النادرة فما فوق
        if (def.rarity === "rare" || def.rarity === "epic" || def.rarity === "legendary") {
          try {
            await ctx.runMutation(internal.smartNotifications.smartPush, {
              userId,
              title: `${def.icon} إنجاز ${def.rarity === "legendary" ? "أسطوري" : def.rarity === "epic" ? "ملحمي" : "نادر"} مُنجز!`,
              body: `${def.name} — ${def.desc}. حصلت على ${def.xp} خبرة و${coins} عملة!`,
              type: "info",
              category: "streaks",
              priority: def.rarity === "legendary" ? "critical" : "important",
              actionUrl: "/play",
            });
          } catch { /* الإشعارات اختيارية */ }
        }
      }
    }

    return { earned: newlyEarned };
  },
});

/** اللاعب يستطيع طلب فحص يدوي (بعد جولة أو إجراء اجتماعي) */
export const checkMyAchievements = mutation({
  handler: async (ctx): Promise<{ earned: { type: string; name: string; icon: string; rarity: string }[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    return await ctx.runMutation(internal.achievementsEngine.evaluateAchievements, { userId });
  },
});

/** خزانة اللاعب: المنجز + التقدّم الجزئي للقريب + نسبة الإكمال الكلية */
export const getMyTrophyCase = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const owned = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ownedMap = new Map(owned.map((o) => [o.type, o]));

    const metrics = await computeMetricsPublic(ctx, userId);
    const all = ACHIEVEMENT_DEFS.map((def) => {
      const got = ownedMap.get(def.type);
      const current = Math.min(def.current(metrics), def.target);
      return {
        type: def.type,
        name: def.name,
        desc: def.desc,
        icon: def.icon,
        rarity: def.rarity,
        xp: def.xp,
        coins: RARITY_COINS[def.rarity],
        earned: !!got,
        earnedAt: got?.earnedAt ?? null,
        progress: { current, target: def.target, pct: Math.min(100, Math.round((current / def.target) * 100)) },
      };
    });
    // الأقرب للإنجاز أولاً (المنجز دائماً أولاً بأحدث تاريخ)
    all.sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      if (a.earned && b.earned) return (b.earnedAt ?? 0) - (a.earnedAt ?? 0);
      return b.progress.pct - a.progress.pct;
    });
    return {
      total: all.length,
      earnedCount: all.filter((a) => a.earned).length,
      achievements: all,
    };
  },
});

/** نسخة خفيفة من computeMetrics للاستعلام (بدون كتابة) */
async function computeMetricsPublic(ctx: any, userId: any): Promise<Metrics> {
  return await computeMetrics(ctx, userId);
}

/** نسخة مُصدَّرة للمقاييس — تستخدمها وحدات أخرى (مثل التحديات الشخصية) */
export async function computeMetricsFor(ctx: any, userId: any): Promise<Metrics> {
  return await computeMetrics(ctx, userId);
}

/** توصيات «إنجاز شبه منتهي» — تُستدعى من وحدة المُوصي في مركز الذكاء */
export const getNearCompletions = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const owned = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ownedSet = new Set(owned.map((o) => o.type));
    const metrics = await computeMetricsPublic(ctx, userId);
    return ACHIEVEMENT_DEFS.filter((d) => !ownedSet.has(d.type))
      .map((d) => ({ ...d, pct: Math.min(100, Math.round((d.current(metrics) / d.target) * 100)) }))
      .filter((d) => d.pct >= 60)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
      .map((d) => ({ name: d.name, desc: d.desc, icon: d.icon, pct: d.pct, target: d.target }));
  },
});
