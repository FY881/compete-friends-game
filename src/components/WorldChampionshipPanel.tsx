import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Globe2, Trophy, Clock, Medal } from "lucide-react";

/**
 * 🌍 البطولة العالمية — قوس إقصائي حي شهري
 * الفائزون بالبطولات الأسبوعية يتأهلون تلقائياً — كل دور 3 أيام.
 */

const ROUND_NAMES: Record<number, string> = {
  1: "دور الـ 16",
  2: "ربع النهائي",
  3: "نصف النهائي",
  4: "النهائي الكبير",
};

export function WorldChampionshipPanel() {
  const wc = useQuery(api.worldChampionship.getCurrent, {});
  const regional = useQuery(api.worldChampionship.getRegionalLeaderboard, {});
  const setTimezone = useMutation(api.worldChampionship.setTimezone);
  const [showRegional, setShowRegional] = useState(false);

  // سجّل المنطقة الزمنية من المتصفح مرة واحدة
  useEffect(() => {
    const offset = -new Date().getTimezoneOffset() / 60;
    setTimezone({ offsetHours: offset }).catch(() => {});
    // مرة واحدة فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (wc === undefined) return null;
  if (!wc) return null;

  const hoursLeft = wc.roundEndsAt
    ? Math.max(0, Math.ceil((wc.roundEndsAt - Date.now()) / 3600_000))
    : null;

  return (
    <div className="overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-card to-indigo-500/10 shadow-sm">
      <div className="border-b border-sky-500/20 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
            <Globe2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{wc.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {wc.status === "waiting"
                ? "تنتظر تأهل 4 فائزين على الأقل من البطولات الأسبوعية…"
                : wc.status === "ended"
                  ? `البطل: ${wc.championName ?? "—"} 🏆`
                  : `${ROUND_NAMES[wc.round] ?? `الدور ${wc.round}`} — جارية الآن`}
            </p>
          </div>
          {wc.status === "active" && hoursLeft !== null && (
            <span className="flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-600">
              <Clock className="size-3.5" />
              {hoursLeft} ساعة للدور
            </span>
          )}
          {wc.amQualified && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-600">
              <Medal className="size-3.5" />
              أنت مؤهل!
            </span>
          )}
        </div>
      </div>

      {/* القوس الإقصائي */}
      {wc.status === "active" && (
        <div className="space-y-2 p-5">
          {wc.bracket.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm"
            >
              <span
                className={cn(
                  "flex-1 truncate font-semibold",
                  m.winnerId && m.winnerId !== m.aId && "text-muted-foreground line-through",
                )}
              >
                {m.aName}
                {m.aScore !== undefined && (
                  <span className="ms-2 font-mono text-xs text-muted-foreground">{m.aScore}</span>
                )}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">ضد</span>
              <span
                className={cn(
                  "flex-1 truncate text-end font-semibold",
                  m.winnerId && m.bId && m.winnerId !== m.bId && "text-muted-foreground line-through",
                )}
              >
                {m.bName ?? "—"}
                {m.bScore !== undefined && (
                  <span className="ms-2 font-mono text-xs text-muted-foreground">{m.bScore}</span>
                )}
              </span>
              {m.winnerId && (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                  تأهل
                </span>
              )}
            </div>
          ))}
          <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
            يُحسم كل مواجهة بأفضل جولة خلال نافذة الدور — العب جولاتك لتمرّ!
          </p>
        </div>
      )}

      {/* البطل */}
      {wc.status === "ended" && wc.championName && (
        <div className="flex items-center justify-center gap-3 bg-amber-500/10 p-6">
          <Trophy className="size-8 text-amber-500" />
          <div className="text-center">
            <p className="text-lg font-black">{wc.championName}</p>
            <p className="text-xs text-amber-600">بطل العالم هذا الشهر — مثبَّت في قاعة المشاهدة</p>
          </div>
        </div>
      )}

      {/* اللوحة الإقليمية */}
      <button
        type="button"
        onClick={() => setShowRegional((v) => !v)}
        className="w-full border-t border-border/60 bg-card/50 py-3 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        {showRegional ? "إخفاء" : "عرض"} لوحة منطقتك الزمنية
        {regional ? ` (${regional.players.length} لاعباً)` : ""}
      </button>
      {showRegional && regional && (
        <div className="space-y-1.5 border-t border-border/60 p-4">
          {regional.players.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">لا يوجد لاعبون في منطقتك بعد.</p>
          )}
          {regional.players.map((p, i) => (
            <div key={p.userId} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  i === 0 ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{p.rating}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
