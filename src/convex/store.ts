/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام المتجر الضخم — بنية تحتية أساسية
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Store Categories ─────────────────────────────────────────
export const STORE_CATEGORIES = [
  { id: "avatars", name: "الصور الرمزية", icon: "👤", description: "صور شخصيات مميزة" },
  { id: "frames", name: "إطارات الاسم", icon: "🖼️", description: "إطارات متحركة وجميلة" },
  { id: "effects", name: "تأثيرات بصرية", icon: "✨", description: "تأثيرات خاصة للرسائل والملفات" },
  { id: "badges", name: "الشارات النادرة", icon: "🏅", description: "شارات حصرية تعكس أسلوبك" },
  { id: "sounds", name: "حزم صوتية", icon: "🎵", description: "مؤثرات صوتية خاصة" },
  { id: "themes", name: "سمات المظهر", icon: "🎨", description: "ألوان وتصاميم للواجهة" },
  { id: "powerups", name: "القوى الخارقة", icon: "⚡", description: "مزايا تساعدك في التحديات" },
  { id: "gifts", name: "هدايا خاصة", icon: "🎁", description: "هدايا يمكنك إرسالها لأصدقائك" },
] as const;

// ─── Store Items ──────────────────────────────────────────────
export const STORE_ITEMS = [
  // ── Avatars ──
  { id: "avatar_falcon", category: "avatars", name: "صقر الظل", icon: "🦅", price: 100, rarity: "common", description: "صورة صقر أنيق" },
  { id: "avatar_phoenix", category: "avatars", name: "طائر الفينيق", icon: "🔥", price: 250, rarity: "rare", description: "صورة فينيق ملحمي" },
  { id: "avatar_dragon", category: "avatars", name: "تنين القدم", icon: "🐉", price: 500, rarity: "epic", description: "صورة تنين مرعب" },
  { id: "avatar_crown", category: "avatars", name: "تاج الملوك", icon: "👑", price: 750, rarity: "legendary", description: "تاج ملكي ذهبي" },
  { id: "avatar_mystic", category: "avatars", name: "الغامض", icon: "🔮", price: 350, rarity: "rare", description: "كرة كريستال سحرية" },

  // ── Frames ──
  { id: "frame_fire", category: "frames", name: "إطار النار", icon: "🔥", price: 150, rarity: "common", description: "إطار ذي ألوان نارية" },
  { id: "frame_ice", category: "frames", name: "إطار الجليد", icon: "❄️", price: 200, rarity: "rare", description: "إطار متجمد أنيق" },
  { id: "frame_galaxy", category: "frames", name: "إطار المجرة", icon: "🌌", price: 400, rarity: "epic", description: "إطار كوني متحرك" },
  { id: "frame_rainbow", category: "frames", name: "إطار قوس قزح", icon: "🌈", price: 300, rarity: "rare", description: "إطار ملون متحرك" },

  // ── Effects ──
  { id: "effect_sparkle", category: "effects", name: "جسيمات متلألئة", icon: "✨", price: 120, rarity: "common", description: "تأثير جسيمات على رسائلك" },
  { id: "effect_rain", category: "effects", name: "مطر نجوم", icon: "🌠", price: 280, rarity: "rare", description: "نجوم تسقط على شاشتك" },
  { id: "effect_firework", category: "effects", name: "ألعاب نارية", icon: "🎆", price: 450, rarity: "epic", description: "ألعاب نارية عند الفوز" },
  { id: "effect_aurora", category: "effects", name: "شفق قطبي", icon: "🌊", price: 600, rarity: "legendary", description: "تأثير شفق قطبي ساحر" },

  // ── Badges ──
  { id: "badge_spartan", category: "badges", name: "شارة الاسبرطي", icon: "⚔️", price: 350, rarity: "rare", description: "شارة المحارب" },
  { id: "badge_ninja", category: "badges", name: "شارة النينجا", icon: "🥷", price: 400, rarity: "rare", description: "شارة المقاتل الخفي" },
  { id: "badge_genius", category: "badges", name: "شارة العبقري", icon: "🧠", price: 800, rarity: "legendary", description: "شارة الذكاء الخارق" },
  { id: "badge_legend", category: "badges", name: "شارة الأسطورة", icon: "🏆", price: 1000, rarity: "legendary", description: "نادرة جداً — للأساطير فقط" },

  // ── Sounds ──
  { id: "sound_epic_win", category: "sounds", name: "صوت النصر الملحمي", icon: "🎶", price: 180, rarity: "common", description: "مؤثر صوتي عند الفوز" },
  { id: "sound_laser", category: "sounds", name: "صوت الليزر", icon: "🔫", price: 220, rarity: "rare", description: "صوت ليزر حديث" },
  { id: "sound_thunder", category: "sounds", name: "صوت الرعد", icon: "⛈️", price: 300, rarity: "rare", description: "صوت رعد مهيب" },
  { id: "sound_cosmic", category: "sounds", name: "أصوات كونية", icon: "🪐", price: 550, rarity: "epic", description: "حزمة أصوات فضائية" },

  // ── Themes ──
  { id: "theme_neon", category: "themes", name: "سمة النيون", icon: "💚", price: 200, rarity: "common", description: "ألوان نيون حيوية" },
  { id: "theme_sunset", category: "themes", name: "سمة الغروب", icon: "🌅", price: 250, rarity: "rare", description: "ألوان الغروب الدافئة" },
  { id: "theme_ocean", category: "themes", name: "سمة المحيط", icon: "🌊", price: 300, rarity: "rare", description: "ألوان المحيط الهادئة" },
  { id: "theme_void", category: "themes", name: "سمة الفراغ", icon: "🕳️", price: 500, rarity: "epic", description: "تصميم غامق وعصري" },

  // ── Power-ups ──
  { id: "powerup_extra_time", category: "powerups", name: "وقت إضافي", icon: "⏰", price: 50, rarity: "common", description: "+5 ثوانٍ على كل سؤال" },
  { id: "powerup_double_xp", category: "powerups", name: "مضاعف XP مزدوج", icon: "📈", price: 100, rarity: "common", description: "مضاعف XP لجولة واحدة" },
  { id: "powerup_fifty_fifty", category: "powerups", name: "50/50 إضافي", icon: "🎯", price: 80, rarity: "common", description: "منقي 50/50 إضافي" },
  { id: "powerup_shield", category: "powerups", name: "درع الحماية", icon: "🛡️", price: 200, rarity: "rare", description: "يحماك من فقدان النقاط" },

  // ── Gifts ──
  { id: "gift_heart", category: "gifts", name: "قلب ذهبي", icon: "💝", price: 30, rarity: "common", description: "هدية بسيطة للأصدقاء" },
  { id: "gift_trophy", category: "gifts", name: "كأس مصغر", icon: "🏆", price: 150, rarity: "rare", description: "هدية تهنئة بالفوز" },
  { id: "gift_crystal", category: "gifts", name: "كريستال نادر", icon: "💎", price: 350, rarity: "epic", description: "هدية نادرة وثمينة" },
  { id: "gift_star", category: "gifts", name: "نجمة متوهجة", icon: "⭐", price: 500, rarity: "legendary", description: "هدية أسطورية لا تُنسى" },
] as const;

export type StoreItem = (typeof STORE_ITEMS)[number];
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

// ─── Get Store Items ──────────────────────────────────────────
export const getStoreItems = query({
  args: { category: v.optional(v.string()) },
  handler: async (_ctx, { category }) => {
    if (category) {
      return STORE_ITEMS.filter((item) => item.category === category);
    }
    return STORE_ITEMS;
  },
});

// ─── Get Store Categories ─────────────────────────────────────
export const getStoreCategories = query({
  args: {},
  handler: async () => {
    return STORE_CATEGORIES;
  },
});

// ─── Get User Coins ───────────────────────────────────────────
export const getUserCoins = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const profile = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate total coins from XP (1 coin per 10 XP earned)
    const totalXp = profile.reduce((sum, g) => sum + (g.score ?? 0), 0);
    return Math.floor(totalXp / 10);
  },
});

// ─── Get User Purchases ───────────────────────────────────────
export const getUserPurchases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Use ownerActions table to track purchases
    const purchases = await ctx.db
      .query("ownerActions")
      .filter((q) => q.eq(q.field("action"), "store_purchase"))
      .collect();

    return purchases
      .filter((p) => p.targetUserId === userId)
      .map((p) => ({
        itemId: p.details,
        purchasedAt: p.createdAt,
      }));
  },
});

// ─── Purchase Item ────────────────────────────────────────────
export const purchaseItem = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const item = STORE_ITEMS.find((i) => i.id === itemId);
    if (!item) throw new Error("العنصر غير موجود");

    // Check if already owned
    const existing = await ctx.db
      .query("ownerActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "store_purchase"),
          q.eq(q.field("targetUserId"), userId),
          q.eq(q.field("details"), itemId),
        ),
      )
      .first();

    if (existing) throw new Error("أنت تملك هذا العنصر بالفعل");

    // Record purchase
    await ctx.db.insert("ownerActions", {
      action: "store_purchase",
      targetUserId: userId,
      details: itemId,
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });

    return { success: true, item: item.name };
  },
});

// ─── Get Store Stats (for owner) ──────────────────────────────
export const getStoreStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const purchases = await ctx.db
      .query("ownerActions")
      .filter((q) => q.eq(q.field("action"), "store_purchase"))
      .collect();

    // Count purchases per item
    const itemCounts: Record<string, number> = {};
    for (const p of purchases) {
      itemCounts[p.details] = (itemCounts[p.details] ?? 0) + 1;
    }

    // Category stats
    const categoryStats: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(itemCounts)) {
      const item = STORE_ITEMS.find((i) => i.id === itemId);
      if (item) {
        categoryStats[item.category] = (categoryStats[item.category] ?? 0) + count;
      }
    }

    return {
      totalPurchases: purchases.length,
      itemCounts,
      categoryStats,
      topItems: Object.entries(itemCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count]) => {
          const item = STORE_ITEMS.find((i) => i.id === id);
          return { id, name: item?.name ?? id, count };
        }),
    };
  },
});
