import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Trophy, Timer, Users, Loader2, ChevronDown, ChevronUp } from "lucide-react";

function timeLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "انتهت";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} يوم متبقٍ`;
  return `${Math.floor(ms / 3600000)} ساعة متبقية`;
}

/** موجّة 5 — لوحة البطولة الأسبوعية للاعبين (ظاهرة للجميع في صفحة اللعب). */
export function TournamentPanel() {
  const active = useQuery(api.tournaments.getActive);
  const leaderboard = useQuery(
    api.tournaments.getLeaderboard,
    active ? { tournamentId: active._id, limit: 15 } : "skip",
  );
  const myEntry = useQuery(
    api.tournaments.getMyEntry,
    active ? { tournamentId: active._id } : "skip",
  );
  const join = useMutation(api.tournaments.join);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!active) return null;

  const handleJoin = async () => {
    setBusy(true);
    try {
      const r = await join({ tournamentId: active._id });
      toast.success(r.already ? "أنت مشترك بالفعل — العب جولاتك!" : "تم تسجيلك في البطولة! 🏆");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التسجيل");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-l from-amber-500/10 via-card to-amber-500/10 shadow-sm"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-amber-500/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-2xl">
          🏆
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
            {active.name}
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <Timer className="size-3" /> {timeLeft(active.endsAt)}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {active.description || `تحتسب مجموع أفضل ${active.bestRoundsCount} جولات تلقائياً`}
          </p>
        </div>
        <div className="shrink-0 text-end">
          {myEntry?.joined ? (
            <>
              <p className="text-sm font-black text-amber-600">#{myEntry.rank ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">{myEntry.totalScore} نقطة</p>
            </>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">{leaderboard?.length ?? 0} مشترك</span>
          )}
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-amber-500/20 p-4 pt-3">
          {!myEntry?.joined && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={busy}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
              اشترك الآن — مجاناً
            </button>
          )}

          {leaderboard === undefined ? (
            <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : leaderboard.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              لا مشتركين بعد — كن أول المتنافسين!
            </p>
          ) : (
            <div className="space-y-1">
              {leaderboard.map((row) => {
                // موجّة 8 — الإطار واللقب المملوكان من متجر الولاء
                const frameCls =
                  row.frame === "frame_gold"
                    ? "ring-2 ring-amber-400"
                    : row.frame === "frame_neon"
                      ? "ring-2 ring-violet-400"
                      : "";
                return (
                  <div
                    key={row.userId}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2",
                      row.rank <= 3 ? "bg-amber-500/10" : "bg-muted/30",
                      frameCls,
                    )}
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-black">
                      {row.trophy ?? row.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 truncate text-xs font-bold">
                        {row.userName}
                        {row.title && (
                          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                            {row.title.emoji} {row.title.name}
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{row.roundsCounted} جولة محتسبة</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-amber-600">{row.totalScore}</span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Users className="size-3" />
            كل جولة تلعبها أثناء البطولة تُحتسب تلقائياً — أفضل {active.bestRoundsCount} جولات تدخل في مجموعك.
          </p>
        </div>
      )}
    </div>
  );
}
