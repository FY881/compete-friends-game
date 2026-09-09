import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Wallet,
  Gift,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

/**
 * موجّة 7 — محفظة الولاء للاعب: نقاط + متجر امتيازات + كود إحالة.
 * تُعرض في صفحة اللعب بجانب لوحة البطولة.
 */
export function LoyaltyPanel() {
  const wallet = useQuery(api.loyalty.getMyWallet);
  const shop = useQuery(api.loyalty.getShop) ?? [];
  const referral = useQuery(api.loyalty.getMyReferral);
  const ledger = useQuery(api.loyalty.getMyLedger, { limit: 8 });
  const buyPerk = useMutation(api.loyalty.buyPerk);
  const applyReferral = useMutation(api.loyalty.applyReferral);
  const persistCode = useMutation(api.loyalty.persistMyReferralCode);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"shop" | "referral" | "history">("shop");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState("");
  const [copied, setCopied] = useState(false);

  if (!wallet) return null;

  const handleBuy = async (key: string) => {
    setBusyKey(key);
    try {
      const r = await buyPerk({ perkKey: key });
      toast.success(`مبارك! حصلت على ${r.name} ✨`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الشراء");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCopyCode = async () => {
    if (!referral) return;
    try {
      await persistCode({});
    } catch {
      /* قد يكون محفوظاً */
    }
    try {
      await navigator.clipboard.writeText(referral.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: اعرضه للنسخ اليدوي */
    }
  };

  const handleApplyReferral = async () => {
    if (!friendCode.trim()) return;
    try {
      await applyReferral({ code: friendCode.trim() });
      toast.success("تم! حصلت أنت وصديقك على نقاط ترحيبية 🎉");
      setFriendCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تطبيق الكود");
    }
  };

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-l from-violet-500/10 via-card to-violet-500/10 shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-violet-500/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">محفظة الولاء</p>
          <p className="text-[11px] text-muted-foreground">اجمع النقاط من اللعب واستبدلها بامتيازات</p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-black text-violet-600">{wallet.points}</p>
          <p className="text-[10px] text-muted-foreground">نقطة</p>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-violet-500/20 p-4 pt-3">
          {/* Tabs */}
          <div className="mb-3 flex gap-1">
            {(
              [
                ["shop", "المتجر", Gift],
                ["referral", "أدعُ أصدقاءك", Users],
                ["history", "سجلي", Sparkles],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors",
                  tab === key ? "bg-violet-500/15 text-violet-700" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Shop */}
          {tab === "shop" && (
            <div className="space-y-2">
              {shop === undefined ? (
                <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : (
                shop.map((p) => (
                  <div
                    key={p.key}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      p.owned ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-muted/20",
                    )}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{p.desc}</p>
                    </div>
                    {p.owned ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        مملوك ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBuy(p.key)}
                        disabled={busyKey === p.key || !p.affordable}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors",
                          p.affordable
                            ? "bg-violet-500 text-white hover:bg-violet-600"
                            : "cursor-not-allowed bg-muted text-muted-foreground",
                        )}
                      >
                        {busyKey === p.key ? <Loader2 className="size-3 animate-spin" /> : null}
                        {p.cost} نقطة
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Referral */}
          {tab === "referral" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
                <p className="text-[11px] font-bold text-violet-700">كودك الخاص — شاركه مع أصدقائك</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-background px-3 py-2 text-center font-mono text-sm font-black tracking-widest">
                    {referral?.code ?? "…"}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-violet-600"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "نُسخ" : "نسخ"}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  كل صديق يسجّل بكودك: تحصل أنت على 150 نقطة وهو على 75 نقطة ترحيبية.
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">عندك كود صديق؟</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={friendCode}
                    onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                    placeholder="ZAK-XXXXXX"
                    className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 font-mono text-xs tracking-widest outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={handleApplyReferral}
                    className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {tab === "history" && (
            <div className="space-y-1">
              {(ledger ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">لا حركات بعد — العب جولة لتبدأ الجمع!</p>
              ) : (
                (ledger ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                    <p className="truncate text-[11px]">{l.reason}</p>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-black",
                        l.delta > 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {l.delta > 0 ? "+" : ""}
                      {l.delta}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
