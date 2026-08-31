/**
 * نظام الهدايا — إرسال واستلام وحذف
 * يعمل بدون حقول إضافية في جدول users
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ═══════════════════════════════════════════════════════════════
// ║ إرسال هدية ║
// ═══════════════════════════════════════════════════════════════
export const sendGift = mutation({
  args: {
    receiverId: v.id("users"),
    giftType: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { receiverId, giftType, message }) => {
    const senderId = await getAuthUserId(ctx);
    if (!senderId) throw new Error("يجب تسجيل الدخول أولاً");
    if (senderId === receiverId) throw new Error("لا يمكنك إرسال هدية لنفسك");

    const sender = await ctx.db.get(senderId);
    const receiver = await ctx.db.get(receiverId);
    if (!sender || !receiver) throw new Error("المستخدم غير موجود");

    const giftId = await ctx.db.insert("gifts", {
      senderId,
      senderName: sender.name ?? "مستخدم",
      receiverId,
      receiverName: receiver.name ?? "مستخدم",
      giftType,
      message: message?.slice(0, 200),
      claimed: false,
      createdAt: Date.now(),
    });

    return giftId;
  },
});

// ═══════════════════════════════════════════════════════════════
// ║ استلام هدية ║
// ═══════════════════════════════════════════════════════════════
export const claimGift = mutation({
  args: { giftId: v.id("gifts") },
  handler: async (ctx, { giftId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const gift = await ctx.db.get(giftId);
    if (!gift) throw new Error("الهدية غير موجودة");
    if (gift.receiverId !== userId) throw new Error("هذه الهدية ليست لك");
    if (gift.claimed) throw new Error("تم استلام هذه الهدية بالفعل");

    await ctx.db.patch(giftId, { claimed: true });
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// ║ الهدايا المستلمة ║
// ═══════════════════════════════════════════════════════════════
export const getReceivedGifts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const gifts = await ctx.db
      .query("gifts")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .order("desc")
      .take(50);
    return gifts;
  },
});

// ═══════════════════════════════════════════════════════════════
// ║ الهدايا المرسلة ║
// ═══════════════════════════════════════════════════════════════
export const getSentGifts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const gifts = await ctx.db
      .query("gifts")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .take(50);
    return gifts;
  },
});

// ═══════════════════════════════════════════════════════════════
// ║ حذف هدية ║
// ═══════════════════════════════════════════════════════════════
export const deleteGift = mutation({
  args: { giftId: v.id("gifts") },
  handler: async (ctx, { giftId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const gift = await ctx.db.get(giftId);
    if (!gift) throw new Error("الهدية غير موجودة");

    if (gift.senderId !== userId) {
      const me = await ctx.db.get(userId);
      if (me?.role !== "admin") throw new Error("غير مصرح لك بحذف هذه الهدية");
    }

    await ctx.db.delete(giftId);
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// ║ عدد الهدايا غير المستلمة ║
// ═══════════════════════════════════════════════════════════════
export const getUnclaimedCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const gifts = await ctx.db
      .query("gifts")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .collect();
    return gifts.filter((g) => !g.claimed).length;
  },
});
