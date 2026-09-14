/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔔 مركز الإشعارات الذكي — المرحلة 12 من التحول الشامل
 *
 * 1. تفضيلات لكل لاعب: أي فئات يستقبل، هل يريد التفاصيل الحساسة، ساعات الهدوء.
 * 2. فئات إشعار حقيقية: مبارزات، سلاسل، أعضية، أحداث، اجتماعي، نظام، اقتصاد.
 * 3. أولوية محسوبة: حرج/مهم/عادي — الأهم يظهر أولاً في الصندوق.
 * 4. تفضيلات تُحترم على الخادم: push الذكي يتجاهل الفئات المكتومة تلقائياً.
 * 5. تسجيل الإرسال الحرج في مركز الذكاء الموحد (وحدة الإشعارات).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const CATEGORIES = [
  "duels",
  "streaks",
  "membership",
  "events",
  "social",
  "economy",
  "system",
] as const;
export type NotifCategory = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<NotifCategory, string> = {
  duels: "⚔️ المبارزات والتحديات",
  streaks: "🔥 السلاسل والإنجازات",
  membership: "💎 العضوية والمميزات",
  events: "🎪 الأحداث والمواسم",
  social: "👥 المجتمع والعشيرة",
  economy: "💰 الاقتصاد والمتجر",
  system: "🛠️ النظام والحساب",
};

// ─────────────────────────── التفضيلات ───────────────────────────

export const getMyPreferences = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (pref) return pref;
    // افتراضيات: كل شيء مفعّل
    return {
      _id: null as any,
      userId,
      enabled: CATEGORIES.reduce(
        (acc, c) => ({ ...acc, [c]: true }),
        {} as Record<string, boolean>,
      ),
      quietHours: undefined as { from: number; to: number } | undefined,
      browserPush: true,
    };
  },
});

export const setCategoryEnabled = mutation({
  args: { category: v.string(), enabled: v.boolean() },
  handler: async (ctx, { category, enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    if (!CATEGORIES.includes(category as NotifCategory)) {
      throw new Error("فئة غير معروفة");
    }
    let pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!pref) {
      const enabledMap = CATEGORIES.reduce(
        (acc, c) => ({ ...acc, [c]: true }),
        {} as Record<string, boolean>,
      );
      const id = await ctx.db.insert("notificationPrefs", {
        userId,
        enabled: { ...enabledMap, [category]: enabled },
        browserPush: true,
      });
      return { ok: true, id };
    }
    const enabledMap = { ...(pref.enabled as Record<string, boolean>), [category]: enabled };
    await ctx.db.patch(pref._id, { enabled: enabledMap });
    return { ok: true };
  },
});

export const setQuietHours = mutation({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    let pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const quietHours = from !== undefined && to !== undefined ? { from, to } : undefined;
    if (pref) {
      await ctx.db.patch(pref._id, { quietHours });
    } else {
      await ctx.db.insert("notificationPrefs", {
        userId,
        enabled: CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: true }), {}),
        quietHours,
        browserPush: true,
      });
    }
    return { ok: true };
  },
});

export const setBrowserPush = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    let pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (pref) {
      await ctx.db.patch(pref._id, { browserPush: enabled });
    } else {
      await ctx.db.insert("notificationPrefs", {
        userId,
        enabled: CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: true }), {}),
        browserPush: enabled,
      });
    }
    return { ok: true };
  },
});

// ─────────────────────────── الصندوق الذكي ───────────────────────────

/** أولوية محسوبة: حرج (2) / مهم (1) / عادي (0) */
function computePriority(n: { type: string; category?: string }): number {
  if (n.type === "ban" || n.type === "warning") return 2;
  if (n.category === "duels" || n.category === "streaks") return 1;
  if (n.type === "update") return 1;
  return 0;
}

export const getMyInbox = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const enabledMap = (pref?.enabled as Record<string, boolean> | undefined) ?? {};

    const specific = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(80);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", "__all__" as const))
      .order("desc")
      .take(50);

    const merged = [...specific, ...all]
      .filter((n) => {
        const cat = (n as any).category as NotifCategory | undefined;
        // فئة غير معروفة تُعامل كـ system
        if (!cat || cat === "system") return enabledMap.system !== false;
        return enabledMap[cat] !== false;
      })
      .sort((a, b) => {
        const pa = computePriority(a as any);
        const pb = computePriority(b as any);
        if (pa !== pb) return pb - pa; // الأعلى أولوية أولاً
        return b.createdAt - a.createdAt;
      })
      .slice(0, 60)
      .map((n) => ({
        ...n,
        category: ((n as any).category ?? "system") as NotifCategory,
        categoryLabel: CATEGORY_LABELS[((n as any).category ?? "system") as NotifCategory],
        priority: computePriority(n as any),
      }));

    return merged;
  },
});

export const markAllRead = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const mine = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    let count = 0;
    for (const n of mine) {
      if (!n.read) {
        await ctx.db.patch(n._id, { read: true });
        count++;
      }
    }
    return { marked: count };
  },
});

export const deleteNotification = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const n = await ctx.db.get(id);
    if (!n) return { ok: false };
    if (n.userId !== userId) throw new Error("غير مصرح");
    await ctx.db.delete(id);
    return { ok: true };
  },
});

export const CATEGORY_LIST = CATEGORIES;
export { CATEGORY_LABELS };

// ─────────────────────────── الإرسال الذكي ───────────────────────────

/**
 * push ذكي يحترم التفضيلات وساعات الهدوء — تُستدعى داخلياً من كل الأنظمة.
 * الفئات المكتومة لا تُخزَّن أصلاً (لا بريد مزعج)، والحرجة تتجاوز الهدوء.
 */
export const smartPush = internalMutation({
  args: {
    userId: v.union(v.literal("__all__"), v.id("users")),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("ban"),
      v.literal("update"),
      v.literal("system"),
    ),
    category: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("critical"), v.literal("important"), v.literal("normal"))),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = (args.category ?? "system") as NotifCategory;

    // احترام تفضيلات اللاعب المحدد (لا تُطبَّق على إشعارات الكل)
    if (args.userId !== "__all__") {
      const pref = await ctx.db
        .query("notificationPrefs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
        .first();
      if (pref) {
        const enabledMap = (pref.enabled as Record<string, boolean>) ?? {};
        if (enabledMap[category] === false) return { skipped: true as const, reason: "category muted" };
        // ساعات الهدوء: تُتجاوز فقط للإشعارات الحرجة
        if (pref.quietHours && args.priority !== "critical" && args.type !== "ban") {
          const hour = new Date().getHours();
          const { from, to } = pref.quietHours;
          const inQuiet = from <= to ? hour >= from && hour < to : hour >= from || hour < to;
          if (inQuiet) return { skipped: true as const, reason: "quiet hours" };
        }
      }
    }

    const id = await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      read: false,
      actionUrl: args.actionUrl,
      createdAt: Date.now(),
      ...(category !== "system" ? { category } : {}),
    } as any);
    return { ok: true as const, id };
  },
});

/** إشعار حدث حي — يُستدعى من liveEvents عند انطلاق حدث */
export const liveEventStarted = internalMutation({
  args: { eventName: v.string(), multiplier: v.number(), endsAt: v.number() },
  handler: async (ctx, { eventName, multiplier, endsAt }) => {
    const hours = Math.max(1, Math.round((endsAt - Date.now()) / 3600_000));
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId: "__all__",
      title: `🎪 حدث حي: ${eventName}`,
      body: `مضاعف ×${multiplier} نشط الآن لمدة ${hours} ساعة — لا تفوّته!`,
      type: "update",
      category: "events",
      priority: "important",
      actionUrl: "/play",
    });
    return { ok: true };
  },
});

/** إشعار قبول/رفض اعتراض — يُستدعى من appeals */
export const appealResolved = internalMutation({
  args: {
    userId: v.id("users"),
    approved: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { userId, approved, note }) => {
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId,
      title: approved ? "⚖️ تم قبول اعتراضك" : "⚖️ نتيجة اعتراضك",
      body: approved
        ? `اعتُمد اعتراضك وجرى التخفيف. ${note ?? ""}`
        : `بعد المراجعة، أُبقي القرار كما هو. ${note ?? ""}`,
      type: approved ? "info" : "warning",
      category: "system",
      priority: "important",
      actionUrl: "/play",
    });
    return { ok: true };
  },
});

/** إشعار ترقية عضوية — يُستدعى من membership */
export const membershipChanged = internalMutation({
  args: { userId: v.id("users"), tier: v.string() },
  handler: async (ctx, { userId, tier }) => {
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId,
      title: "💎 تحديث عضويتك",
      body: `مستوى عضويتك الآن: ${tier} — استمتع بمميزاتك الجديدة!`,
      type: "info",
      category: "membership",
      priority: "important",
      actionUrl: "/play",
    });
    return { ok: true };
  },
});

/** إشعار مكافأة كبيرة — يُستدعى من adaptiveRewards عند مكافأة استثنائية */
export const bigReward = internalMutation({
  args: { userId: v.id("users"), coins: v.number(), reason: v.string() },
  handler: async (ctx, { userId, coins, reason }) => {
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId,
      title: "💰 مكافأة استثنائية!",
      body: `حصلت على ${coins} عملة حرب — ${reason}`,
      type: "info",
      category: "economy",
      priority: "important",
      actionUrl: "/play",
    });
    return { ok: true };
  },
});
