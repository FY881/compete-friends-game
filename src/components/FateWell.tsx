import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Dices, Hourglass, Flame, Sparkles, Scale } from "lucide-react";

/**
 * 🎲 بئر القدر — واجهة اللاعب
 * راهن على عقلك المستقبلي بنقاط ولاء حقيقية — والحكم آلي بلا رحمة.
 */

type Bet = {
  _id: string;
  kind: string;
  stake: number;
  multiplier: number;
  target: number;
  status: "open" | "fulfilled" | "forfeited";
  verdictDetail?: string;
  judgeAt: number;
};

type Flip = {
  _id: unknown;
  title: string;
  desc: string;
  reward: number;
};

type CatalogEntry = {
  kind: string;
  label: string;
  stakes: number[];
  windows: number[];
  minMultiplier: number;
  maxMultiplier: number;
};

const KIND_LABELS: Record<string, string> = {
  correct_answers: "إجابات صحيحة في جولة",
  win_match: "فوز بمباراة",
  streak_reach: "سلسلة أيام لعب",
  category_sweep: "جولة بدقة 90%+",
  flip: "إحالة القدر",
};

const STATUS_STYLE: Record<Bet["status"], string> = {
  open: "bg-amber-500/15 text-amber-200",
  fulfilled: "bg-emerald-500/15 text-emerald-200",
  forfeited: "bg-red-500/15 text-red-200",
};

const STATUS_LABEL: Record<Bet["status"], string> = {
  open: "⏳ بانتظار الحكم",
  fulfilled: "✅ وفيت — دُفع المضاعف",
  forfeited: "💀 ابتلعها البئر",
};

export function FateWell() {
  const wallet = useQuery(api.aiFate.getMyWallet) as number | undefined;
  const bets = useQuery(api.aiFate.getMyBets) as Bet[] | null | undefined;
  const flip = useQuery(api.aiFate.getActiveFlip) as Flip | null | undefined;
  const catalog = useQuery(api.aiFate.getBetCatalog) as CatalogEntry[] | undefined;

  const placeBet = useMutation(api.aiFate.placeBet);
  const acceptFlip = useMutation(api.aiFate.acceptFlip);

  const [kind, setKind] = useState<string>("correct_answers");
  const [stake, setStake] = useState<number>(20);
  const [target, setTarget] = useState<number>(8);
  const [windowHours, setWindowHours] = useState<number>(24);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const selected = catalog?.find((c) => c.kind === kind);

  async function onPlace() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await placeBet({ kind, stake, target, windowHours });
      setMsg(`🎲 وُضع الرهان — الوفاء يقبض ${r.payout} نقطة ولاء`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "فشل الرهان"}`);
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptFlip() {
    if (!flip || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await acceptFlip({ flipId: flip._id as never });
      setMsg("🌪️ قبلت إحالة القدر — البئر يراقبك الآن");
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذر القبول"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-l from-fuchsia-500/15 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Dices className="h-5 w-5 text-fuchsia-300" />
          <h2 className="text-base font-extrabold text-fuchsia-100">بئر القدر</h2>
          <span className="mr-auto rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
            💎 رصيدك: {wallet ?? "…"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          الرهان هنا ليس على حظ — بل على عقلك المستقبلي. خصم فوري، وحكم آلي من أدائك الحقيقي.
        </p>
      </div>

      {/* إحالة القدر النشطة */}
      {flip && (
        <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-200">
            <Sparkles className="h-4 w-4" />
            إحالة القدر الظرفية
          </div>
          <div className="mt-1.5 text-sm font-bold text-white">{flip.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-white/60">{flip.desc}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-200">المكافأة: {flip.reward} ولاء</span>
            <button
              onClick={onAcceptFlip}
              disabled={busy}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              أقبل الإحالة
            </button>
          </div>
        </div>
      )}

      {/* فتح رهان جديد */}
      <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="text-[11px] font-bold text-white/70">راهن على نفسك</div>
        {catalog ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {catalog.map((c) => (
                <button
                  key={c.kind}
                  onClick={() => {
                    setKind(c.kind);
                    setStake(c.stakes[0]);
                    setWindowHours(c.windows[0]);
                  }}
                  className={`rounded-xl border p-2.5 text-right text-[11px] transition ${
                    kind === c.kind
                      ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-white"
                      : "border-white/10 bg-black/20 text-white/60 hover:border-white/25"
                  }`}
                >
                  <div className="font-bold">{c.label}</div>
                  <div className="text-[10px] text-white/45">
                    ×{c.minMultiplier} – ×{c.maxMultiplier}
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <>
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <span>الرهان:</span>
                  {selected.stakes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStake(s)}
                      className={`rounded-lg px-2.5 py-1 font-bold transition ${
                        stake === s ? "bg-amber-500/30 text-amber-100" : "bg-black/25 text-white/55"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <span className="mr-auto">المضاعف: ×{selected.minMultiplier}–×{selected.maxMultiplier}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <Hourglass className="h-3.5 w-3.5" />
                  <span>مدة الحكم:</span>
                  {selected.windows.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWindowHours(w)}
                      className={`rounded-lg px-2.5 py-1 font-bold transition ${
                        windowHours === w ? "bg-sky-500/30 text-sky-100" : "bg-black/25 text-white/55"
                      }`}
                    >
                      {w >= 168 ? `${Math.round(w / 24)} يوم` : `${w} ساعة`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <Flame className="h-3.5 w-3.5" />
                  <span>الهدف:</span>
                  <input
                    type="number"
                    min={1}
                    value={target}
                    onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-center text-white focus:border-fuchsia-400/60 focus:outline-none"
                  />
                </div>

                <button
                  onClick={onPlace}
                  disabled={busy || (wallet ?? 0) < stake}
                  className="w-full rounded-xl bg-fuchsia-600 py-2.5 text-sm font-extrabold text-white transition hover:bg-fuchsia-500 disabled:opacity-40"
                >
                  🎲 ضع الرهان — {stake} ولاء على المحك
                </button>
                {(wallet ?? 0) < stake && (
                  <div className="text-center text-[10px] text-red-300">نقاط الولاء لا تكفي لهذا الرهان</div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/40">يحمّل كتالوج الرهانات…</div>
        )}
      </div>

      {msg && (
        <div className="rounded-xl border border-white/15 bg-black/30 p-3 text-center text-xs text-white/85">{msg}</div>
      )}

      {/* رهاناتي */}
      <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
          <Scale className="h-4 w-4" />
          رهاناتي مع القدر
        </div>
        {bets && bets.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {bets.map((b) => (
              <div key={b._id} className="rounded-xl bg-black/25 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/85">
                    {KIND_LABELS[b.kind] ?? b.kind} — هدف {b.target}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[b.status]}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-white/45">
                  رهان {b.stake} × {b.multiplier}
                  {b.status === "open" && ` — الحكم خلال ${Math.max(0, Math.ceil((b.judgeAt - Date.now()) / 3600_000))} ساعة`}
                  {b.verdictDetail && ` — ${b.verdictDetail}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/45">لا رهانات بعد — البئر صامت… حتى الآن</div>
        )}
      </div>
    </div>
  );
}
