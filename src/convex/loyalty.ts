/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 7 — نقاط الولاء + الإحالات
 *
 * اللاعب يكسب نقاطاً من: إنهاء الجولات، سلاسل الأيام، الفوز، المشاركة
 * في البطولات — وينفقها على امتيازات تجميلية (إطار/لقب/شارة).
 * وكل لاعب له كود إحالة: من يسجّل به يحصل الطرفان على نقاط.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── متجر الامتيازات (ثابت — قابل للتوسعة لاحقاً من غرفة المالك) ──
export const PERK_CATALOG = [
  { key: "frame_gold", name: "إطار ذهبي", emoji: "🖼️", cost: 300, days: 30, desc: "إطار مميز حول صورتك لمدة شهر" },
  { key: "title_genius", name: "لقب «العقل المدبّر»", emoji: "🧠", cost: 500, days: 30, desc: "لقب يظهر بجانب اسمك لمدة شهر" },
  { key: "badge_veteran", name: "شارة المخضرم", emoji: "🎖️", cost: 800, days: null, desc: "شارة دائمة تُظهر انتماءك" },
  { key: "frame_neon", name: "إطار نيون", emoji: "⚡", cost: 450, days: 14, desc: "إطار ملون متوهج لأسبوعين" },
  { key: "title_champion", name: "لقب «البطل»", emoji: "🏆", cost: 650, days: 14, desc: "لقب بطولة يظهر لمدة أسبوعين" },
] as const;

export type PerkKey = (typeof PERK_CATALOG)[number]["key"];

// ── قواعد الكسب ──
export const EARN_RULES = {
  roundFinished: 10, // كل جولة تُنهى
  roundWon: 25, // فوز في جولة
  dailyStreakDay: 5, // كل يوم في سلسلة الأيام
  tournamentParticipation: 40, // المشاركة في بطولة (تُمنح عند الاحتساب الأول)
  referral: 150, // كل صديق يسجّل بكودك
  refereeWelcome: 75, // ترحيب لمن سجّل بكود إحالة
} as const;

// ─────────────────────────────────────────────────────────────────────────
// المحفظة — استعلامات
// ─────────────────────────────────────────────────────────────────────────

async function getOrCreateWallet(ctx: any, userId: any) {
  let w = await ctx.db
    .query("loyaltyWallets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!w) {
    const id = await ctx.db.insert("loyaltyWallets", {
      userId,
      points: 0,
      lifetimeEarned: 0,
      perks: [],
      updatedAt: Date.now(),
    });
    w = await ctx.db.get(id);
  }
  return w;
}

/** محفظتي: الرصيد + الامتيازات المملوكة (عام لأي مسجّل). */
export const getMyWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const w = await getOrCreateWallet(ctx, userId);
    const now = Date.now();
    return {
      points: w.points,
      lifetimeEarned: w.lifetimeEarned,
      perks: w.perks.filter((p: { expiresAt?: number }) => !p.expiresAt || p.expiresAt > now),
    };
  },
});

/** كتالوج المتجر + ما أملكه منه. */
export const getShop = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const w = await getOrCreateWallet(ctx, userId);
    const now = Date.now();
    return PERK_CATALOG.map((p) => ({
      ...p,
      owned: w.perks.some(
        (o: { key: string; expiresAt?: number }) => o.key === p.key && (!o.expiresAt || o.expiresAt > now),
      ),
      affordable: w.points >= p.cost,
    }));
  },
});

/** كود إحالة ثابت مشتق من معرف المستخدم (بلا كتابة في الاستعلام). */
function referralCodeFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `ZAK-${h.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

/** كود الإحالة الخاص بي (مشتق ثابتاً — لا يحتاج إنشاء مسبق). */
export const getMyReferral = query({
  args: {},
  handler: async (ctx): Promise<{ code: string; invites: number } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return { code: existing.code, invites: existing.invites };
    return { code: referralCodeFor(String(userId)), invites: 0 };
  },
});

/** يحفظ كود الإحالة المشتق في الجدول (تستدعيه الواجهة عند فتح المحفظة). */
export const persistMyReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const existing = await ctx.db
      .query("referralCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.code;
    const code = referralCodeFor(String(userId));
    // تفادي تعارض الكود (نادر جداً)
    const clash = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (clash) return clash.code;
    await ctx.db.insert("referralCodes", { userId, code, invites: 0, createdAt: Date.now() });
    return code;
  },
});

/** آخر حركات محفظتي (شفافية). */
export const getMyLedger = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const take = Math.min(Math.max(limit ?? 15, 1), 50);
    const rows = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b.at - a.at)
      .slice(0, take)
      .map((r) => ({ id: r._id, delta: r.delta, reason: r.reason, at: r.at }));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الكسب — internal (تستدعيه الأنظمة: الجولات، السلاسل، البطولات)
// ─────────────────────────────────────────────────────────────────────────

export const awardPoints = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { userId, amount, reason }) => {
    if (amount === 0) return;
    const w = await getOrCreateWallet(ctx, userId);
    await ctx.db.patch(w._id, {
      points: Math.max(w.points + amount, 0),
      lifetimeEarned: amount > 0 ? w.lifetimeEarned + amount : w.lifetimeEarned,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("loyaltyLedger", { userId, delta: amount, reason, at: Date.now() });
  },
});

/** تُستدعى من انتهاء الجولة في games.ts (مع نتيجة الجولة). */
export const recordRoundLoyalty = internalMutation({
  args: { userId: v.id("users"), won: v.boolean(), dailyStreak: v.optional(v.number()) },
  handler: async (ctx, { userId, won, dailyStreak }) => {
    let total = EARN_RULES.roundFinished;
    let reasons = `إنهاء جولة (+${EARN_RULES.roundFinished})`;
    if (won) {
      total += EARN_RULES.roundWon;
      reasons += ` · فوز (+${EARN_RULES.roundWon})`;
    }
    if ((dailyStreak ?? 0) > 1) {
      total += EARN_RULES.dailyStreakDay;
      reasons += ` · سلسلة ${dailyStreak} أيام (+${EARN_RULES.dailyStreakDay})`;
    }
    await ctx.runMutation(internal.loyalty.awardPoints, { userId, amount: total, reason: reasons });
  },
});

/** زخارف لاعب (إطار/لقب) — عامة، تُعرض بجانب اسمه في الصدارة والبطاقات. */
export const getDecorations = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    const now = Date.now();
    const out: Record<
      string,
      { frame: string | null; title: { emoji: string; name: string } | null }
    > = {};
    for (const uid of userIds) {
      const w = await ctx.db
        .query("loyaltyWallets")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .first();
      if (!w) {
        out[String(uid)] = { frame: null, title: null };
        continue;
      }
      const alive = w.perks.filter((p) => !p.expiresAt || p.expiresAt > now);
      // موجّة 13 — الإطارات الموسمية من تذكرة الموسم لها الأولوية
      let frameKey = alive.find((p) => p.key.startsWith("frame_"))?.key ?? null;
      const seasonPass = await ctx.db
        .query("seasonPasses")
        .withIndex("by_user_season", (q: any) =>
          q.eq("userId", uid).eq("seasonNumber", Math.floor(Date.now() / (14 * 24 * 60 * 60 * 1000)) + 1),
        )
        .first();
      if (seasonPass?.seasonFrames?.length) {
        // أحدث إطار موسمي مملوك يتقدم على الإطارات المشتراة
        const seasonOrder: Record<string, number> = {
          frame_season_1: 1,
          frame_season_2: 2,
          frame_season_3: 3,
        };
        const best = [...seasonPass.seasonFrames].sort(
          (a, b) => (seasonOrder[b] ?? 0) - (seasonOrder[a] ?? 0),
        )[0];
        if (best && (seasonOrder[best] ?? 0) >= (seasonOrder[frameKey ?? ""] ?? 0)) {
          frameKey = best;
        }
      }
      const titleKey = alive.find((p) => p.key.startsWith("title_"))?.key ?? null;
      const titlePerk = titleKey ? PERK_CATALOG.find((c) => c.key === titleKey) : undefined;
      out[String(uid)] = {
        frame: frameKey, // "frame_gold" | "frame_neon" | null
        title: titlePerk ? { emoji: titlePerk.emoji, name: titlePerk.name.replace("لقب ", "").replace(/[«»]/g, "") } : null,
      };
    }
    return out;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الإنفاق — شراء امتياز
// ─────────────────────────────────────────────────────────────────────────

export const buyPerk = mutation({
  args: { perkKey: v.string() },
  handler: async (ctx, { perkKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const perk = PERK_CATALOG.find((p) => p.key === perkKey);
    if (!perk) throw new Error("الامتياز غير موجود");

    const w = await getOrCreateWallet(ctx, userId);
    const now = Date.now();
    const active = w.perks.find(
      (o: { key: string; expiresAt?: number }) => o.key === perkKey && (!o.expiresAt || o.expiresAt > now),
    );
    if (active) throw new Error("تملك هذا الامتياز فعلاً");
    if (w.points < perk.cost) throw new Error(`نقاطك غير كافية — تحتاج ${perk.cost - w.points} نقطة إضافية`);

    const expiresAt = perk.days ? now + perk.days * 24 * 60 * 60 * 1000 : undefined;
    await ctx.db.patch(w._id, {
      points: w.points - perk.cost,
      perks: [...w.perks, { key: perkKey, expiresAt }],
      updatedAt: now,
    });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -perk.cost,
      reason: `شراء: ${perk.name}`,
      at: now,
    });
    return { success: true, name: perk.name };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الإحالة — تسجيل بكود صديق
// ─────────────────────────────────────────────────────────────────────────

export const applyReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const normalized = code.trim().toUpperCase();
    const ref = await ctx.db
      .query("referralCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!ref) throw new Error("كود الإحالة غير صحيح — تأكد أن صديقك فتح صفحة المحفظة مرة واحدة على الأقل");
    if (ref.userId === userId) throw new Error("لا يمكنك استخدام كودك الخاص");

    // منع الاستعمال المزدوج: من استعمل كوداً من قبل؟ (ابحث في السجل)
    const alreadyUsed = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
      .then((rows) => rows.some((r) => r.reason.includes("إحالة")));
    if (alreadyUsed) throw new Error("استخدمت كود إحالة من قبل");

    const now = Date.now();
    // مكافأة الداعي
    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId: ref.userId,
      amount: EARN_RULES.referral,
      reason: `صديق سجّل بكودك (+${EARN_RULES.referral})`,
    });
    // مكافأة المسجّل الجديد
    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId,
      amount: EARN_RULES.refereeWelcome,
      reason: `ترحيب عبر كود إحالة (+${EARN_RULES.refereeWelcome})`,
    });
    await ctx.db.patch(ref._id, { invites: ref.invites + 1 });
    return { success: true };
  },
});