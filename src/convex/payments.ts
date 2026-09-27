"use node";
import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 💳 تكامل Stripe — متجر حرب العقول
 * 1) createCheckout: ينشئ جلسة Checkout لشراء حزمة عملات (coins/gems).
 * 2) stripeWebhook: mutation تُستدعى من http.ts — تتحقق من التوقيع وتمنح المكافأة.
 */

// ═══ كتالوج الحزم — الأسعار بالسنت (أقل وحدة) ═══
export const PACKS = [
  { id: "coins_500", label: "٥٠٠ عملة ذهبية", emoji: "🪙", currency: "usd", unitAmount: 199, coins: 500, gems: 0 },
  { id: "coins_1500", label: "١٥٠٠ عملة ذهبية + ٥ جواهر", emoji: "💰", currency: "usd", unitAmount: 499, coins: 1500, gems: 5 },
  { id: "coins_5000", label: "٥٠٠٠ عملة ذهبية + ٢٥ جوهرة", emoji: "💎", currency: "usd", unitAmount: 999, coins: 5000, gems: 25 },
] as const;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY غير مضبوط — أضف المفتاح من تبويب المفاتيح");
  return new Stripe(key);
}

// ═══ 1) إنشاء جلسة دفع — من الواجهة ═══
export const createCheckout = action({
  args: { packId: v.string() },
  handler: async (ctx, { packId }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = (await ctx.runQuery(api.users.currentUser as any)) as { name?: string } | null;
    void me;

    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) throw new Error("حزمة غير معروفة");

    const stripe = getStripe();
    const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: pack.currency,
            unit_amount: pack.unitAmount,
            product_data: {
              name: `${pack.emoji} ${pack.label} — حرب العقول`,
              metadata: { packId: pack.id, userId },
            },
          },
          quantity: 1,
        },
      ],
      metadata: { packId: pack.id, userId },
      success_url: `${origin}/play?payment=success&pack=${pack.id}`,
      cancel_url: `${origin}/play?payment=cancelled`,
    });

    if (!session.url) throw new Error("تعذّر إنشاء جلسة الدفع");
    return { url: session.url };
  },
});

// ═══ 2) ويبهوك — تحقق من التوقيع ثم منح المكافأة ═══
export const stripeWebhook = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, { payload, signature }): Promise<Record<string, unknown>> => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET غير مضبوط");

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
    } catch (e) {
      throw new Error(`توقيع الويبهوك غير صالح: ${e instanceof Error ? e.message : "خطأ"}`);
    }

    if (event.type !== "checkout.session.completed") {
      return { ignored: true as const, type: event.type };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return { ignored: true as const, reason: "not_paid" as const };
    }

    const packId = session.metadata?.packId;
    const userId = session.metadata?.userId;
    if (!packId || !userId) return { ignored: true as const, reason: "no_metadata" as const };

    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) return { ignored: true as const, reason: "unknown_pack" as const };

    // المنح في mutation آمن (ملف خالٍ من node) — idempotent بمفتاح الجلسة
    return (await ctx.runMutation(internal.paymentsLedger.grantCheckout as any, {
      dedupeKey: `stripe:${session.id}`,
      userId,
      coins: pack.coins,
      gems: pack.gems,
    })) as unknown as Record<string, unknown>;
  },
});
