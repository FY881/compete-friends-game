import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Trophy, Sparkles, Swords, ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * 🏆 بطاقة الهيبة والإرث — نقاط الهيبة + إحصاءات العمر + اللقطات + قاعة المشاهدة.
 */
export function LegacyCard() {
  const legacy = useQuery(api.legacy.getMyLegacy);
  const hall = useQuery(api.legacy.getHallOfFame, { limit: 10 });
  const [open, setOpen] = useState(false);

  if (!legacy) return null;
  const p = legacy.prestige;

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-l from-amber-400/10 via-card to-yellow-500/10 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-amber-400/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-2xl">
          {p.tierEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">
            {p.tierName} <span className="text-[10px] font-bold text-muted-foreground">— الهيبة</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {legacy.name} {legacy.equippedTitle ? `· ${legacy.equippedTitle}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className={cn("text-lg font-black", p.tierColor)}>{p.points}</p>
          <p className="text-[10px] text-muted-foreground">نقطة هيبة</p>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-amber-400/20 p-4 pt-3">
          {/* Lifetime stats */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["جولات", legacy.lifetime.gamesPlayed],
                ["انتصارات", legacy.lifetime.gamesWon],
                ["نسبة الفوز", `${legacy.lifetime.winRate}%`],
                ["أفضل نتيجة", legacy.lifetime.bestScore],
                ["أطول سلسلة", legacy.lifetime.bestStreak],
                ["الدقة", `${legacy.lifetime.accuracy}%`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/30 p-2.5 text-center">
                <p className="text-sm font-black">{value}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Top rivals */}
          {legacy.topRivals.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
                <Swords className="size-3.5" /> أعظم خصومك
              </p>
              <div className="space-y-1">
                {legacy.topRivals.map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-1.5">
                    <p className="truncate text-[11px] font-bold">{r.name}</p>
                    <p className="text-[11px] font-black">
                      <span className="text-emerald-600">{r.myWins}</span>
                      <span className="text-muted-foreground"> : </span>
                      <span className="text-rose-600">{r.theirWins}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Moments */}
          {legacy.moments.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
                <Sparkles className="size-3.5" /> لحظاتك المميزة
              </p>
              <div className="space-y-1">
                {legacy.moments.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-amber-400/10 px-3 py-1.5">
                    <p className="text-[11px] font-bold">
                      {m.perfect ? "🎯 دقة كاملة" : "⭐"} · {m.score} نقطة
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(m.playedAt).toLocaleDateString("ar", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hall of fame */}
          {(hall ?? []).length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
                <Trophy className="size-3.5 text-amber-500" /> قاعة المشاهدة — أبطال المواسم
              </p>
              <div className="space-y-1">
                {(hall ?? []).map((h) => (
                  <div key={h._id} className="flex items-center justify-between rounded-lg bg-gradient-to-l from-amber-400/10 to-transparent px-3 py-1.5">
                    <p className="truncate text-[11px] font-bold">
                      {h.userEmoji} {h.userName}
                    </p>
                    <p className="text-[10px] font-black text-amber-600">{h.score} نقطة</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
