import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";

/**
 * 💳 متجر حرب العقول — شراء العملات عبر Stripe Checkout
 * حزم ثابتة، دفع آمن في صفحة Stripe، منح تلقائي موثّق عند نجاح الدفع.
 */

type Pack = {
  id: string;
  label: string;
  emoji: string;
  unitAmount: number;
};

const PACKS: Pack[] = [
  { id: "coins_500", label: "٥٠٠ عملة ذهبية", emoji: "🪙", unitAmount: 199 },
  { id: "coins_1500", label: "١٥٠٠ عملة + ٥ جواهر", emoji: "💰", unitAmount: 499 },
  { id: "coins_5000", label: "٥٠٠٠ عملة + ٢٥ جوهرة", emoji: "💎", unitAmount: 999 },
];

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StripeStore() {
  const checkout = useAction(api.payments.createCheckout);
  const stats = useQuery(api.paymentsLedger.getMyPurchases) as
    | { coinsPurchased: number }
    | null
    | undefined;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packId: string) {
    setBusy(packId);
    setError(null);
    try {
      const { url } = await checkout({ packId });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بدء الدفع");
      setBusy(null);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4">
      <div className="rounded-2xl border border-indigo-400/30 bg-gradient-to-b from-indigo-950/60 to-black/60 p-5">
        <h2 className="text-lg font-bold text-indigo-200">💳 متجر حرب العقول</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          دفع آمن عبر Stripe — تُمنح العملات تلقائياً بعد إتمام الدفع، وسجل كل عملية موثّق في خزنتك.
        </p>
        {stats && stats.coinsPurchased > 0 && (
          <p className="mt-2 text-[11px] text-indigo-300">
            مشترياتك المكتملة: {stats.coinsPurchased.toLocaleString("ar-EG")} عملة ذهبية
          </p>
        )}
      </div>

      <div className="space-y-3">
        {PACKS.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-black/50 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.emoji}</span>
              <div>
                <p className="text-sm font-bold text-zinc-100">{p.label}</p>
                <p className="text-[11px] text-zinc-500">{fmtPrice(p.unitAmount)} · تسليم فوري</p>
              </div>
            </div>
            <Button
              onClick={() => buy(p.id)}
              disabled={busy !== null}
              className="bg-gradient-to-l from-indigo-500 to-violet-600 font-bold text-white hover:from-indigo-400 hover:to-violet-500"
            >
              {busy === p.id ? "…" : "اشترِ"}
            </Button>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">{error}</p>
      )}

      <p className="text-center text-[10px] text-zinc-600">
        الدفع يُعالَج بالكامل عبر Stripe — لا نلمس بيانات بطاقتك إطلاقاً.
      </p>
    </div>
  );
}
