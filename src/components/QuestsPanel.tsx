import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Target, Gift, Check, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * 🎯 لوحة المهام اليومية — 3 مهام دوارة تُحتسب من اللعب الحقيقي + مكافأة العودة.
 */
export function QuestsPanel() {
  const data = useQuery(api.quests.getMyQuests);
  const claim = useMutation(api.quests.claimQuest);
  const claimComeback = useMutation(api.quests.claimComeback);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return null;

  const doClaim = async (kind: string) => {
    setBusy(kind);
    try {
      const r = await claim({ kind });
      toast.success(`حصلت على ${r.reward} نقطة 🎉`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل المطالبة");
    } finally {
      setBusy(null);
    }
  };

  const doComeback = async () => {
    setBusy("comeback");
    try {
      const r = await claimComeback({});
      toast.success(`مكافأة العودة: ${r.reward} نقطة 🎁`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل المطالبة");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-l from-emerald-500/10 via-card to-teal-500/10 shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
          <Target className="size-5 text-emerald-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">مهام اليوم</p>
          <p className="text-[11px] text-muted-foreground">ثلاث مهام تتجدّد كل يوم — أكملها واجمع النقاط</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-emerald-500/20 p-4 pt-3">
        {/* Comeback reward */}
        {data.comebackAvailable && (
          <button
            type="button"
            onClick={doComeback}
            disabled={busy === "comeback"}
            className="flex w-full items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-start transition hover:bg-amber-500/15"
          >
            <Gift className="size-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-amber-700">🎁 مكافأة العودة — اشتقناك!</p>
              <p className="text-[10px] text-muted-foreground">غبت {data.daysAway} أيام — خذ 100 نقطة ترحيبية</p>
            </div>
            {busy === "comeback" && <Loader2 className="size-4 animate-spin" />}
          </button>
        )}

        {data.quests.map((q) => {
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div
              key={q.kind}
              className={cn(
                "rounded-xl border p-3",
                q.claimed
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : q.done
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border/50 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{q.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{q.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {Math.min(q.progress, q.target)} / {q.target} · مكافأة {q.reward} نقطة
                  </p>
                </div>
                {q.claimed ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                    <Check className="size-3" /> تم
                  </span>
                ) : q.done ? (
                  <button
                    type="button"
                    onClick={() => doClaim(q.kind)}
                    disabled={busy === q.kind}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                  >
                    {busy === q.kind ? <Loader2 className="size-3 animate-spin" /> : "اطلب 🎉"}
                  </button>
                ) : null}
              </div>
              {!q.claimed && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", q.done ? "bg-emerald-500" : "bg-teal-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
