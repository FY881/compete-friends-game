import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// 💳 ويبهوك Stripe — يستقبل الحدث الخام ويمرره لـ mutation موقّع
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";
    try {
      await ctx.runAction(api.payments.stripeWebhook as any, { payload, signature } as any);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "خطأ" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }),
});

export default http;
