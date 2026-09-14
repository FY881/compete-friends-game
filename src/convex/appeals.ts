import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 🛡️ نظام الاعتراضات — المرحلة 5 من غرفة المالك 5.0
 * اللاعب المعاقب يقدّم اعتراضاً واحداً لكل عقوبة → يصل للصندوق الذكي للمالك
 * → قرار المالك يحدّث سمعة الاعتراضات تلقائياً.
 */

const COOLDOWN_MS = 24 * 3600_000; // اعتراض واحد كل 24 ساعة لكل لاعب

/** هل يمكن للاعب الحالي تقديم اعتراض؟ */
export const getMyAppealStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const mine = await ctx.db
      .query("appeals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    mine.sort((a, b) => b.createdAt - a.createdAt);

    const bannedNow = !!user.bannedPermanent || (user.bannedUntil ?? 0) > Date.now();
    const mutedNow = (user.mutedUntil ?? 0) > Date.now();
    const lastPending = mine.find((a) => a.status === "pending");
    const lastAny = mine[0];
    const cooldownLeft = lastAny ? Math.max(0, lastAny.createdAt + COOLDOWN_MS - Date.now()) : 0;

    return {
      canPunished: bannedNow || mutedNow,
      punishmentType: bannedNow ? "ban" : mutedNow ? "mute" : null,
      punishmentReason: user.banReason ?? null,
      pending: !!lastPending,
      cooldownHours: Math.ceil(cooldownLeft / 3600_000),
      canSubmit: !lastPending && cooldownLeft === 0,
      history: mine.slice(0, 5).map((a) => ({
        id: a._id,
        message: a.message,
        status: a.status,
        decisionNote: a.decisionNote ?? null,
        createdAt: a.createdAt,
      })),
    };
  },
});

/** اللاعب يقدّم اعتراضاً */
export const submitAppeal = mutation({
  args: {
    punishmentType: v.union(v.literal("warn"), v.literal("mute"), v.literal("ban")),
    message: v.string(),
  },
  handler: async (ctx, { punishmentType, message }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("المستخدم غير موجود");

    const text = message.trim();
    if (text.length < 10) throw new Error("اكتب سبباً واضحاً للاعتراض (10 أحرف على الأقل)");
    if (text.length > 600) throw new Error("الاعتراض طويل جداً (600 حرف كحد أقصى)");

    const recent = await ctx.db
      .query("appeals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (recent.some((a) => a.status === "pending")) {
      throw new Error("لديك اعتراض قيد المراجعة بالفعل");
    }
    const last = recent.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (last && Date.now() - last.createdAt < COOLDOWN_MS) {
      throw new Error("يمكنك تقديم اعتراض واحد كل 24 ساعة");
    }

    await ctx.db.insert("appeals", {
      userId,
      userName: user.name ?? "لاعب مجهول",
      punishmentType,
      punishmentReason: user.banReason ?? "غير محدد",
      message: text,
      status: "pending",
      createdAt: Date.now(),
    });
    return true;
  },
});

/** قائمة الاعتراضات المعلّقة — للمالك */
export const getPendingAppeals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") return null;

    const pending = await ctx.db
      .query("appeals")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    pending.sort((a, b) => a.createdAt - b.createdAt);
    return pending.map((a) => ({
      id: a._id,
      userId: a.userId,
      userName: a.userName,
      punishmentType: a.punishmentType,
      punishmentReason: a.punishmentReason,
      message: a.message,
      createdAt: a.createdAt,
    }));
  },
});

/** قرار المالك: رفض العقوبة (overturned = عقوبة تُرفع + سمعة تُحترم) أو تأكيدها */
export const decideAppeal = mutation({
  args: {
    appealId: v.id("appeals"),
    decision: v.union(v.literal("upheld"), v.literal("overturned")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { appealId, decision, note }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") {
      throw new Error("للمالك فقط");
    }

    const appeal = await ctx.db.get(appealId);
    if (!appeal || appeal.status !== "pending") throw new Error("الاعتراض غير موجود أو حُسم مسبقاً");

    await ctx.db.patch(appealId, {
      status: decision,
      decidedBy: userId,
      decisionNote: note ?? undefined,
      decidedAt: Date.now(),
    });

    if (decision === "overturned") {
      // رفع العقوبة حسب نوعها
      const target = await ctx.db.get(appeal.userId);
      if (target) {
        if (appeal.punishmentType === "ban") {
          await ctx.db.patch(appeal.userId, { bannedUntil: 0, bannedPermanent: false, banReason: undefined });
        } else if (appeal.punishmentType === "mute") {
          await ctx.db.patch(appeal.userId, { mutedUntil: 0 });
        }
      }
    }

    // 🔔 بلّغ اللاعب بنتيجة اعتراضه
    try {
      await ctx.runMutation(internal.smartNotifications.appealResolved, {
        userId: appeal.userId,
        approved: decision === "overturned",
        note,
      });
    } catch { /* الإشعارات اختيارية */ }

    return { decision };
  },
});
