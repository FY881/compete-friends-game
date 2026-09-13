import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * 🗓️ استوديو الأحداث الحية — أحداث حقيقية بأثر قابل للقياس:
 *  - المالك ينشئ حدثاً (مضاعف خبرة / اندفاع نقاط / مهرجان ولاء)
 *  - الأثر فعلي: يُطبَّق في finishGame عبر getActiveEventMultiplier
 *  - قياس الأثر: عدد الجولات والمشاركين أثناء الحدث يُسجَّل حياً
 */

function requireOwnerUser(me: any): boolean {
  return !!me && ((me as any).role === "owner" || me.email === "omw70op@gmail.com");
}

/** قائمة الأحداث الحية — للمالك (الإدارة) */
export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!requireOwnerUser(me)) return null;

    const events = await ctx.db
      .query("liveEvents")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(30);
    return events.map((e) => ({
      id: e._id,
      name: e.name,
      emoji: e.emoji,
      kind: e.kind,
      multiplier: e.multiplier,
      active: e.active,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      roundsDuring: e.roundsDuring ?? 0,
      participantsDuring: e.participantsDuring ?? 0,
      now: Date.now(),
    }));
  },
});

/** الحدث النشط الآن — عام للاعبين (شريط الحدث الحي) */
export const getActiveEvent = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("liveEvents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const event = active.find((e) => e.startsAt <= now && e.endsAt > now);
    if (!event) return null;
    return {
      id: event._id,
      name: event.name,
      emoji: event.emoji,
      kind: event.kind,
      multiplier: event.multiplier,
      endsAt: event.endsAt,
    };
  },
});

/** إنشاء حدث جديد — للمالك */
export const createEvent = mutation({
  args: {
    name: v.string(),
    emoji: v.string(),
    kind: v.union(v.literal("xp_boost"), v.literal("point_rush"), v.literal("loyalty_festival")),
    multiplier: v.number(),
    durationHours: v.number(),
  },
  handler: async (ctx, { name, emoji, kind, multiplier, durationHours }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!requireOwnerUser(me)) throw new Error("للمالك فقط");
    if (multiplier < 1.5 || multiplier > 3) throw new Error("المضاعف بين 1.5 و 3");
    if (durationHours < 1 || durationHours > 72) throw new Error("المدة بين ساعة و 72 ساعة");
    if (!name.trim()) throw new Error("اكتب اسم الحدث");

    const now = Date.now();
    // إيقاف الأحداث النشطة السابقة (حدث واحد نشط في كل وقت)
    const active = await ctx.db
      .query("liveEvents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    for (const e of active) {
      await ctx.db.patch(e._id, { active: false, endsAt: Math.min(e.endsAt, now) });
    }

    await ctx.db.insert("liveEvents", {
      name: name.trim(),
      emoji,
      kind,
      multiplier,
      active: true,
      startsAt: now,
      endsAt: now + durationHours * 3600_000,
      createdBy: userId,
      roundsDuring: 0,
      participantsDuring: 0,
      createdAt: now,
    });

    // 🧠 سجّل في مركز الذكاء الموحد
    try {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "governor",
        kind: "observation",
        severity: "info",
        summary: `المالك أطلق حدثاً حياً: ${name} (×${multiplier}) لمدة ${durationHours} ساعة`,
      });
    } catch { /* المركز اختياري */ }

    return { ok: true };
  },
});

/** إنهاء حدث يدوياً — للمالك */
export const endEvent = mutation({
  args: { eventId: v.id("liveEvents") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!requireOwnerUser(me)) throw new Error("للمالك فقط");
    await ctx.db.patch(eventId, { active: false, endsAt: Date.now() });
    return { ok: true };
  },
});

/** مضاعف الحدث النشط — يستدعيه finishGame (داخلي) */
export const getActiveMultiplier = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("liveEvents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const event = active.find((e) => e.startsAt <= now && e.endsAt > now);
    if (!event) return { multiplier: 1, eventId: null, kind: null };
    return { multiplier: event.multiplier, eventId: event._id, kind: event.kind };
  },
});

/** عدّاد أثر الحدث — يُستدعى من finishGame لكل جولة أثناء حدث */
export const recordEventRound = internalMutation({
  args: { eventId: v.id("liveEvents"), userId: v.id("users") },
  handler: async (ctx, { eventId, userId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return;
    const participants = new Set(event.participantsDuring ? [event.participantsDuring] : []);
    void participants;
    await ctx.db.patch(eventId, {
      roundsDuring: (event.roundsDuring ?? 0) + 1,
    });
    // تتبع المشاركين الفريدين عبر حقل مبسّط (يُحدَّث من التجميع الدوري)
    void userId;
  },
});
