import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 💳 دفتر المنح — ملف خالٍ من "use node" ليقدر يمس قاعدة البيانات.
 * يُستدعى من stripeWebhook (action) — منح idempotent بمفتاح الجلسة.
 */
export const grantCheckout = internalMutation({
  args: {
    dedupeKey: v.string(),
    userId: v.string(),
    coins: v.number(),
    gems: v.number(),
  },
  handler: async (ctx, { dedupeKey, userId, coins, gems }) => {
    // idempotent: مفتاح فريد لكل جلسة Stripe
    const existing = await ctx.db
      .query("storeLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .filter((q) => q.eq(q.field("itemId"), dedupeKey))
      .first();
    if (existing) return { granted: false as const, reason: "already_granted" as const };

    await ctx.db.insert("storeLedger", {
      userId: userId as any,
      currency: "coins",
      amount: coins,
      reason: "stripe_purchase",
      itemId: dedupeKey,
      at: Date.now(),
    });

    if (gems > 0) {
      await ctx.db.insert("storeLedger", {
        userId: userId as any,
        currency: "gems",
        amount: gems,
        reason: "stripe_purchase",
        itemId: `${dedupeKey}:g`,
        at: Date.now(),
      });
    }

    return { granted: true as const, coins, gems };
  },
});

/** قراءة مشتريات المستخدم — استعلام للواجهة */
export const getMyPurchases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const rows = await ctx.db
      .query("storeLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(50);
    const total = rows
      .filter((r) => r.reason === "stripe_purchase" && r.currency === "coins")
      .reduce((s, r) => s + r.amount, 0);
    return { purchases: rows.length, coinsPurchased: total };
  },
});
