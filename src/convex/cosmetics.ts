/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛍️ المتجر 2.0 — التجميلات الحقيقية (الإصدار 3.0)
 *
 *  - أفاتارات حصرية + إطارات ملف + ألقاب قابلة للشراء بنقاط الولاء
 *  - الملكية دائمة أو مؤقتة (expiresAt) — تُخزَّن في جدول cosmetics
 *  - التجهيز (equip) يضع التجميلة على الملف فعلياً (أفاتار/إطار/لقب)
 *  - الإهداء بين اللاعبين (يُسجَّل في سجل الولاء)
 *  - الإسقاطات المحدودة الوقت: ترتبط بالحزمة الموسمية النشطة
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

type CosmeticKind = "avatar" | "frame" | "title";

type CosmeticItem = {
  key: string;
  kind: CosmeticKind;
  name: string;
  emoji: string;
  cost: number;
  days: number | null; // null = دائم
  desc: string;
  limited?: string; // slug حزمة موسمية مرتبطة
};

/** كتالوج التجميلات الكامل */
export const COSMETIC_CATALOG: CosmeticItem[] = [
  // ── أفاتارات حصرية ──
  { key: "av_phoenix", kind: "avatar", name: "أفاتار العنقاء", emoji: "🦅", cost: 400, days: null, desc: "أفاتار دائم فريد" },
  { key: "av_dragon", kind: "avatar", name: "أفاتار التنين", emoji: "🐲", cost: 600, days: null, desc: "أفاتار دائم أسطوري" },
  { key: "av_alien", kind: "avatar", name: "أفاتار الفضاء", emoji: "👽", cost: 350, days: null, desc: "أفاتار دائم غامض" },
  // ── إطارات ──
  { key: "fr_royal", kind: "frame", name: "الإطار الملكي", emoji: "⚜️", cost: 700, days: 30, desc: "إطار ذهبي ملكي لشهر" },
  { key: "fr_ice", kind: "frame", name: "إطار الجليد", emoji: "❄️", cost: 500, days: 30, desc: "إطار متلألئ لشهر" },
  { key: "fr_flame", kind: "frame", name: "إطار اللهيب", emoji: "🔥", cost: 550, days: 14, desc: "إطار متوهج لأسبوعين" },
  // ── ألقاب ──
  { key: "ti_legend", kind: "title", name: "لقب «الأسطورة»", emoji: "🌟", cost: 900, days: 30, desc: "لقب حصري لشهر" },
  { key: "ti_mastermind", kind: "title", name: "لقب «سيّد العقول»", emoji: "🧠", cost: 750, days: 30, desc: "لقب حصري لشهر" },
  { key: "ti_shadow", kind: "title", name: "لقب «الظل»", emoji: "🌑", cost: 650, days: 14, desc: "لقب غامض لأسبوعين" },
];

/** الإسقاطات المحدودة — ترتبط بالحزم الموسمية النشطة */
const LIMITED_DROPS: CosmeticItem[] = [
  { key: "drop_sports", kind: "frame", name: "إطار البطولة الرياضية", emoji: "🏅", cost: 450, days: 7, desc: "حصري لأسبوع الرياضة", limited: "sports-week" },
  { key: "drop_ramadan", kind: "avatar", name: "أفاتار رمضان", emoji: "🌙", cost: 500, days: 30, desc: "حصري لباقة رمضان", limited: "ramadan" },
  { key: "drop_movies", kind: "title", name: "لقب «نجم السينما»", emoji: "🎬", cost: 600, days: 14, desc: "حصري لمهرجان الأفلام", limited: "movies" },
];

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات
// ─────────────────────────────────────────────────────────────────────────

/** المتجر الكامل: الكتالوج + ملكيتي + أسعار قابلة للشراء */
export const getCosmeticShop = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const now = Date.now();
    const owned = await ctx.db
      .query("cosmetics")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ownedKeys = new Map(
      owned
        .filter((c) => !c.expiresAt || c.expiresAt > now)
        .map((c) => [c.key, c]),
    );

    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const pack = await ctx.db
      .query("questionPacks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    const all = [...COSMETIC_CATALOG, ...LIMITED_DROPS];
    return {
      points: wallet?.points ?? 0,
      activePack: pack?.slug ?? null,
      items: all.map((item) => {
        const mine = ownedKeys.get(item.key);
        const limitedAvailable = !item.limited || item.limited === pack?.slug;
        return {
          ...item,
          owned: !!mine,
          equipped: !!mine?.equipped,
          affordable: (wallet?.points ?? 0) >= item.cost,
          limitedAvailable,
        };
      }),
    };
  },
});

/** بحث لاعب بالبريد — للإهداء */
export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clean = email.trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    const found = users.find((u) => (u.email ?? "").toLowerCase() === clean);
    if (!found || found._id === userId) return null;
    return { userId: found._id, name: found.name ?? "لاعب" };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الإجراءات
// ─────────────────────────────────────────────────────────────────────────

/** شراء تجميلة — يخصم النقاط ويمنح الملكية */
export const buyCosmetic = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const item = [...COSMETIC_CATALOG, ...LIMITED_DROPS].find((i) => i.key === key);
    if (!item) throw new Error("العنصر غير موجود");

    const now = Date.now();
    const owned = await ctx.db
      .query("cosmetics")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();
    if (owned && (!owned.expiresAt || owned.expiresAt > now)) {
      throw new Error("تملك هذا العنصر بالفعل");
    }

    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!wallet || wallet.points < item.cost) {
      throw new Error(`تحتاج ${item.cost} نقطة — العب جولات لتجمعها!`);
    }
    await ctx.db.patch(wallet._id, { points: wallet.points - item.cost, updatedAt: now });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -item.cost,
      reason: `شراء ${item.name}`,
      at: now,
    });

    const expiresAt = item.days ? now + item.days * 24 * 3600_000 : undefined;
    if (owned) {
      await ctx.db.patch(owned._id, { expiresAt, equipped: false });
    } else {
      await ctx.db.insert("cosmetics", {
        userId,
        key,
        kind: item.kind,
        equipped: false,
        expiresAt,
        acquiredAt: now,
      });
    }
    return { ok: true as const, name: item.name, emoji: item.emoji };
  },
});

/** تجهيز / إزالة تجهيز تجميلة — يطبقها على الملف فعلياً */
export const equipCosmetic = mutation({
  args: { key: v.string(), equip: v.boolean() },
  handler: async (ctx, { key, equip }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const now = Date.now();
    const mine = await ctx.db
      .query("cosmetics")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .first();
    if (!mine || (mine.expiresAt && mine.expiresAt <= now)) {
      throw new Error("لا تملك هذا العنصر");
    }
    const item = [...COSMETIC_CATALOG, ...LIMITED_DROPS].find((i) => i.key === key);
    if (!item) throw new Error("العنصر غير موجود");

    await ctx.db.patch(mine._id, { equipped: equip });

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("الحساب غير موجود");

    if (item.kind === "avatar") {
      await ctx.db.patch(userId, {
        avatarEmoji: equip ? item.emoji : user.avatarEmoji === item.emoji ? undefined : user.avatarEmoji,
      });
    } else if (item.kind === "title") {
      await ctx.db.patch(userId, {
        equippedTitle: equip ? `${item.emoji} ${item.name.replace("لقب ", "").replace(/[«»]/g, "")}` : undefined,
      });
    } else if (item.kind === "frame") {
      await ctx.db.patch(userId, { equippedFrame: equip ? item.key : undefined });
    }
    return { ok: true as const };
  },
});

/** إهداء تجميلة للاعب آخر — تدفع أنت، يملك هو */
export const giftCosmetic = mutation({
  args: { key: v.string(), toUserId: v.id("users") },
  handler: async (ctx, { key, toUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (toUserId === userId) throw new Error("لا يمكنك إهداء نفسك");
    const item = COSMETIC_CATALOG.find((i) => i.key === key);
    if (!item) throw new Error("الهدايا متاحة على العناصر الدائمة فقط");

    const now = Date.now();
    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!wallet || wallet.points < item.cost) {
      throw new Error(`تحتاج ${item.cost} نقطة للإهداء`);
    }
    await ctx.db.patch(wallet._id, { points: wallet.points - item.cost, updatedAt: now });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -item.cost,
      reason: `إهداء ${item.name} لصديق`,
      at: now,
    });

    const existing = await ctx.db
      .query("cosmetics")
      .withIndex("by_user_key", (q) => q.eq("userId", toUserId).eq("key", key))
      .first();
    if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
      throw new Error("صديقك يملك هذا العنصر بالفعل");
    }
    const expiresAt = item.days ? now + item.days * 24 * 3600_000 : undefined;
    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      await ctx.db.insert("cosmetics", {
        userId: toUserId,
        key,
        kind: item.kind,
        equipped: false,
        expiresAt,
        acquiredAt: now,
        giftedBy: userId,
      });
    }
    return { ok: true as const, name: item.name };
  },
});
