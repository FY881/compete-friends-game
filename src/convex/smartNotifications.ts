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
import {
  NOTIF_CATEGORIES as CATEGORIES,
  NOTIF_CATEGORY_LABELS as CATEGORY_LABELS,
  NOTIF_LIMITS,
  TIER_DEFAULTS,
  decideDelivery,
  inRange,
  isNotifPriority,
  normalizeCategory,
  priorityOf,
  quietEndsAt,
  survivesQueue,
  type NotifCategory,
} from "./notifyCore";

export type { NotifCategory };
export { TIER_DEFAULTS };

// ─────────────────────────── التفضيلات ───────────────────────────

// ═══════════════ طبقات الإشعارات الذكية — الأساس ═══════════════
// ⚠️ كل السياسة (الكتم · الهدوء · العتبة · السقف) تعيش في `notifyCore.ts`
//    وحده. لا تُكرَّر هنا، ولا في أي ملف آخر، حتى لا تنحرف مسارات الإرسال.

/** إدراج إشعار في طابور التأجيل — لم يُلغَ، بل ينتظر اللحظة المناسبة */
async function deferNotification(
  ctx: any,
  args: { userId: any; title: string; body: string; type: string; actionUrl?: string; priority?: string },
  category: string,
  reason: string,
  deliverAfter: number,
) {
  return await ctx.db.insert("deferredNotifications", {
    userId: args.userId,
    title: args.title,
    body: args.body,
    type: args.type,
    category: category !== "system" ? category : undefined,
    priority: args.priority ?? "normal",
    actionUrl: args.actionUrl,
    reason,
    createdAt: Date.now(),
    deliverAfter,
  });
}

/** تسجيل حقيقي في مركز الذكاء الموحد (وحدة وسيط الإشعارات) */
async function logNotifier(ctx: any, summary: string) {
  await ctx.runMutation(internal.aiHub.logEvent, {
    unit: "notifier",
    kind: "decision",
    severity: "info",
    summary,
  });
}

/** طبقاتي — إعدادات الإشعارات الذكية المتقدمة */
export const getMyTiers = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rec = await ctx.db
      .query("notificationTiers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const waiting = await ctx.db
      .query("deferredNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      minPriority: rec?.minPriority ?? TIER_DEFAULTS.minPriority,
      quietDefer: rec?.quietDefer ?? TIER_DEFAULTS.quietDefer,
      maxPerHour: rec?.maxPerHour ?? TIER_DEFAULTS.maxPerHour,
      digestHour: rec?.digestHour ?? TIER_DEFAULTS.digestHour,
      waitingCount: waiting.length,
      waiting: waiting
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20)
        .map((d) => ({
          id: String(d._id),
          title: d.title,
          body: d.body,
          category: d.category ?? "system",
          priority: d.priority,
          reason: d.reason,
          deliverAfter: d.deliverAfter,
          createdAt: d.createdAt,
        })),
    };
  },
});

/** تحديث طبقات الإشعارات بتحقق حقيقي من كل قيمة */
export const updateTiers = mutation({
  args: {
    minPriority: v.optional(v.string()),
    quietDefer: v.optional(v.boolean()),
    maxPerHour: v.optional(v.number()),
    digestHour: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    if (args.minPriority !== undefined && !isNotifPriority(args.minPriority)) {
      throw new Error("أدنى أولوية غير معروفة");
    }
    if (args.maxPerHour !== undefined && !inRange(args.maxPerHour, NOTIF_LIMITS.maxPerHour)) {
      throw new Error(`السقف الساعي بين ${NOTIF_LIMITS.maxPerHour.min} و ${NOTIF_LIMITS.maxPerHour.max}`);
    }
    if (args.digestHour !== undefined && !inRange(args.digestHour, NOTIF_LIMITS.digestHour)) {
      throw new Error(`ساعة الملخص بين ${NOTIF_LIMITS.digestHour.min} و ${NOTIF_LIMITS.digestHour.max}`);
    }
    const existing = await ctx.db
      .query("notificationTiers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const now = Date.now();
    // نبني الرقعة صريحة: لا نمرّر undefined حتى لا نكتب حقولاً فارغة
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.minPriority !== undefined) patch.minPriority = args.minPriority;
    if (args.quietDefer !== undefined) patch.quietDefer = args.quietDefer;
    if (args.maxPerHour !== undefined) patch.maxPerHour = args.maxPerHour;
    if (args.digestHour !== undefined) patch.digestHour = args.digestHour;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("notificationTiers", {
        userId,
        minPriority: args.minPriority ?? TIER_DEFAULTS.minPriority,
        quietDefer: args.quietDefer ?? TIER_DEFAULTS.quietDefer,
        maxPerHour: args.maxPerHour ?? TIER_DEFAULTS.maxPerHour,
        digestHour: args.digestHour ?? TIER_DEFAULTS.digestHour,
        updatedAt: now,
      });
    }
    return { ok: true as const };
  },
});

/** سلّم ما لديّ من إشعارات مؤجلة الآن — بطلب اللاعب نفسه */
export const flushMyDeferred = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const waiting = await ctx.db
      .query("deferredNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const d of waiting) {
      await ctx.db.insert("notifications", {
        userId,
        title: d.title,
        body: d.body,
        type: d.type as any,
        read: false,
        actionUrl: d.actionUrl,
        createdAt: Date.now(),
        ...(d.category ? { category: d.category } : {}),
      } as any);
      await ctx.db.delete(d._id);
    }
    if (waiting.length > 0) await logNotifier(ctx, `${waiting.length} إشعاراً مؤجلاً سُلّمت بطلب اللاعب`);
    return { ok: true as const, delivered: waiting.length };
  },
});

/**
 * ⏰ تسليم الملخص — cron: يُخرج الإشعارات المؤجلة من الطابور في الوقت المناسب:
 *  • انتهت ساعات الهدوء
 *  • أو بلغت ساعة الملخص اليومي التي اختارها اللاعب
 *  • أو انتظرت أكثر من 12 ساعة (منعاً للتجويع)
 * لا يُفقد أي إشعار أبداً.
 */
export const deliverDigests = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const now = Date.now();
    const due = await ctx.db
      .query("deferredNotifications")
      .withIndex("by_deliver", (q) => q.lte("deliverAfter", now))
      .take(limit ?? 200);
    if (due.length === 0) return { delivered: 0, players: 0 };

    const byUser = new Map<string, typeof due>();
    for (const d of due) {
      const key = String(d.userId);
      if (!byUser.has(key)) byUser.set(key, [] as any);
      byUser.get(key)!.push(d);
    }

    const hour = new Date().getHours();
    let delivered = 0;
    let players = 0;

    let droppedMuted = 0;

    for (const [, items] of byUser) {
      const userId = items[0].userId;
      const tiers = await ctx.db
        .query("notificationTiers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      const pref = await ctx.db
        .query("notificationPrefs")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      const enabledMap = (pref?.enabled as Record<string, boolean> | undefined) ?? {};
      const digestHour = tiers?.digestHour ?? TIER_DEFAULTS.digestHour;
      const forced = items.some((i) => now - i.deliverAfter > NOTIF_LIMITS.maxDeferMs);
      if (!forced && hour < digestHour) continue; // ما زال مبكراً على الملخص

      // 🔇 الكتم يسري حتى على الطابور: من كتم فئةً وهو ينتظر لا تصله عند التسليم
      const alive: typeof items = [];
      for (const d of items) {
        const cat = normalizeCategory(d.category);
        const stillWanted = survivesQueue({
          type: d.type,
          category: cat,
          muted: enabledMap[cat] === false,
        });
        if (stillWanted) alive.push(d);
        else droppedMuted += 1;
        await ctx.db.delete(d._id);
      }
      if (alive.length === 0) continue;

      for (const d of alive) {
        await ctx.db.insert("notifications", {
          userId,
          title: d.title,
          body: d.body,
          type: d.type as any,
          read: false,
          actionUrl: d.actionUrl,
          createdAt: Date.now(),
          ...(d.category ? { category: d.category } : {}),
        } as any);
        await ctx.db.delete(d._id);
        delivered += 1;
      }
      players += 1;
      if (alive.length > 1) {
        await ctx.db.insert("notifications", {
          userId,
          title: `🧾 ملخص ما فاتك (${alive.length})`,
          body: `جمعنا لك ${alive.length} إشعاراً انتظرت ساعات الهدوء بدل أن تضيع — راجعها الآن.`,
          type: "info",
          read: false,
          actionUrl: "/play",
          createdAt: Date.now(),
          category: "system",
        } as any);
      }
      if (tiers) await ctx.db.patch(tiers._id, { lastDigestAt: now });
    }

    await logNotifier(
      ctx,
      `سلّم ${delivered} إشعاراً مؤجلاً لـ ${players} لاعباً في الملخص` +
        (droppedMuted > 0 ? ` — وأُسقط ${droppedMuted} لأن فئتها كُتمت بعد التأجيل` : ""),
    );
    return { delivered, players, droppedMuted };
  },
});

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

// الأولوية تُحسب في النواة (`priorityOf`) — مصدر واحد للعرض وللقرار معاً.

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
        const pa =        priorityOf(a as any);
        const pb =        priorityOf(b as any);
        if (pa !== pb) return pb - pa; // الأعلى أولوية أولاً
        return b.createdAt - a.createdAt;
      })
      .slice(0, 60)
      .map((n) => ({
        ...n,
        category: ((n as any).category ?? "system") as NotifCategory,
        categoryLabel: CATEGORY_LABELS[((n as any).category ?? "system") as NotifCategory],
        priority:        priorityOf(n as any),
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
    const category = normalizeCategory(args.category);

    // احترام تفضيلات اللاعب المحدد (لا تُطبَّق على إشعارات الكل)
    if (args.userId !== "__all__") {
      const pref = await ctx.db
        .query("notificationPrefs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
        .first();
      const tiers = await ctx.db
        .query("notificationTiers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
        .first();

      const enabledMap = (pref?.enabled as Record<string, boolean> | undefined) ?? {};
      const muted = enabledMap[category] === false;
      const maxPerHour = tiers?.maxPerHour ?? TIER_DEFAULTS.maxPerHour;

      // 🚦 نعدّ ما وُجّه لهذا اللاعب خلال الساعة المنقضية — فقط عند الحاجة إليه
      let recentCount = 0;
      if (!muted && args.type !== "ban" && maxPerHour > 0) {
        const hourAgo = Date.now() - 3600_000;
        const recent = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
          .order("desc")
          .take(60);
        recentCount = recent.filter((n) => n.createdAt >= hourAgo).length;
      }

      // ⚖️ القرار كله يُحسب في النواة النقية المختبرة — لا سياسة مبعثرة هنا
      const decision = decideDelivery({
        type: args.type,
        category,
        priority: args.priority,
        muted,
        quietHours: pref?.quietHours,
        quietDefer: tiers?.quietDefer ?? TIER_DEFAULTS.quietDefer,
        minPriority: tiers?.minPriority ?? TIER_DEFAULTS.minPriority,
        maxPerHour,
        nowHour: new Date().getHours(),
        recentCount,
      });

      if (decision.action === "drop") {
        await logNotifier(ctx, `أسقط إشعاراً (${category}): ${decision.explain}`);
        return { skipped: true as const, reason: decision.reason };
      }

      if (decision.action === "defer") {
        const deliverAfter =
          decision.reason === "quiet_hours"
            ? quietEndsAt(Date.now(), pref?.quietHours)
            : Date.now() + 3600_000;
        const id = await deferNotification(ctx, args, category, decision.reason, deliverAfter);
        await logNotifier(ctx, `أجّل إشعاراً (${category}): ${decision.explain}`);
        return { deferred: true as const, id, reason: decision.reason };
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
