import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { TrendingUp, TrendingDown, CandlestickChart, LineChart, Brain } from "lucide-react";

/**
 * 📈 صرف القدرات — تداول على حركة المؤشر
 * رصيدك يتحول إلى رأس مال: اقرأ السوق، راهن على صعوده أو هبوطه، واحكم السوق آلياً.
 */

type Tick = { midx: number; createdAt: number };

type Trade = {
  _id: string;
  direction: "up" | "down";
  stake: number;
  entryMidx: number;
  windowHours: number;
  status: "open" | "won" | "lost";
  exitMidx?: number;
  payout?: number;
  settleAt: number;
};

type Forecast = { trend: string; changePct: number; comment: string };

export function ExchangeBoard() {
  const idx = useQuery(api.aiExchange.getIndex) as { current: number; history: Tick[] } | undefined;
  const trades = useQuery(api.aiExchange.getMyTrades) as Trade[] | undefined;
  const forecast = useQuery(api.aiExchange.getLatestForecast) as Forecast | null | undefined;
  const wallet = useQuery(api.aiExchange.getWalletPoints) as number | undefined;

  const openTrade = useMutation(api.aiExchange.openTrade);

  const [direction, setDirection] = useState<"up" | "down">("up");
  const [stake, setStake] = useState(50);
  const [windowHours, setWindowHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const history = idx?.history ?? [];
  const first = history[0]?.midx ?? idx?.current ?? 100;
  const current = idx?.current ?? 100;
  const changePct = Math.round(((current - first) / Math.max(1, first)) * 100);
  const spark = history.length > 1 ? history : [{ midx: current, createdAt: 0 }, { midx: current, createdAt: 1 }];
  const min = Math.min(...spark.map((t) => t.midx));
  const max = Math.max(...spark.map((t) => t.midx));

  async function onTrade() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await openTrade({ direction, stake, windowHours });
      setMsg(`💹 فُتحت الصفقة عند MIDX ${r.entryMidx} — السوق يحكم بعد ${windowHours} ساعة`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "فشل فتح الصفقة"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس + المؤشر */}
      <div className="rounded-2xl border border-teal-400/30 bg-gradient-to-l from-teal-500/12 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CandlestickChart className="h-5 w-5 text-teal-300" />
            <h2 className="text-base font-extrabold text-teal-100">صرف القدرات</h2>
          </div>
          <span className="rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
            💎 {wallet ?? "…"} ولاء
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-white/45">مؤشر MIDX الحي</div>
            <div className="text-3xl font-extrabold text-white">{current}</div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-bold ${changePct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {changePct >= 0 ? "+" : ""}{changePct}%
          </div>
        </div>
        {/* رسم شرارة */}
        <svg viewBox="0 0 100 24" className="mt-2 h-8 w-full" preserveAspectRatio="none">
          <polyline
            points={spark
              .map((t, i) => {
                const x = (i / Math.max(1, spark.length - 1)) * 100;
                const y = 22 - ((t.midx - min) / Math.max(0.01, max - min)) * 20;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke={changePct >= 0 ? "#34d399" : "#f87171"}
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* توقع المحلل */}
      {forecast && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-200">
            <Brain className="h-4 w-4" />
            المحلل الصادق — يتوقع {forecast.trend === "up" ? "صعوداً" : forecast.trend === "down" ? "هبوطاً" : "استقراراً"} ({forecast.changePct > 0 ? "+" : ""}{forecast.changePct}%)
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-sky-50/85">{forecast.comment}</p>
        </div>
      )}

      {/* فتح صفقة */}
      <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
        <div className="text-[11px] font-bold text-white/70">تداول على حركة السوق</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection("up")}
            className={`rounded-xl border p-3 text-center transition ${
              direction === "up" ? "border-emerald-400/60 bg-emerald-500/20" : "border-white/10 bg-black/20"
            }`}
          >
            <TrendingUp className="mx-auto h-5 w-5 text-emerald-300" />
            <div className="mt-1 text-xs font-bold text-emerald-200">أراهن على الصعود</div>
          </button>
          <button
            onClick={() => setDirection("down")}
            className={`rounded-xl border p-3 text-center transition ${
              direction === "down" ? "border-red-400/60 bg-red-500/20" : "border-white/10 bg-black/20"
            }`}
          >
            <TrendingDown className="mx-auto h-5 w-5 text-red-300" />
            <div className="mt-1 text-xs font-bold text-red-200">أراهن على الهبوط</div>
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
          <span>الرهان:</span>
          {[30, 50, 120].map((s) => (
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
          <span className="mr-auto">المدة:</span>
          {[
            { h: 24, l: "يوم" },
            { h: 48, l: "يومين" },
            { h: 168, l: "أسبوع" },
          ].map((w) => (
            <button
              key={w.h}
              onClick={() => setWindowHours(w.h)}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                windowHours === w.h ? "bg-sky-500/30 text-sky-100" : "bg-black/25 text-white/55"
              }`}
            >
              {w.l}
            </button>
          ))}
        </div>

        <button
          onClick={onTrade}
          disabled={busy || (wallet ?? 0) < stake}
          className="mt-3 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-extrabold text-white transition hover:bg-teal-500 disabled:opacity-40"
        >
          💹 افتح الصفقة — {stake} ولاء × {windowHours >= 168 ? "2.6" : windowHours >= 48 ? "2.1" : "1.8"}
        </button>
      </div>

      {msg && (
        <div className="rounded-xl border border-white/15 bg-black/30 p-3 text-center text-xs text-white/85">{msg}</div>
      )}

      {/* صفقاتي */}
      {trades && trades.length > 0 && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
            <LineChart className="h-4 w-4" />
            صفقاتي
          </div>
          <div className="mt-2 space-y-1.5">
            {trades.slice(0, 5).map((t) => (
              <div key={t._id} className="flex items-center justify-between rounded-xl bg-black/25 p-2.5 text-xs">
                <span className="text-white/80">
                  {t.direction === "up" ? "📈 صعود" : "📉 هبوط"} من {t.entryMidx}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    t.status === "open"
                      ? "bg-amber-500/20 text-amber-200"
                      : t.status === "won"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-red-500/20 text-red-200"
                  }`}
                >
                  {t.status === "open"
                    ? `⏳ ${Math.max(0, Math.ceil((t.settleAt - Date.now()) / 3600_000))} ساعة`
                    : t.status === "won"
                      ? `+${t.payout}`
                      : "خسارة"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
