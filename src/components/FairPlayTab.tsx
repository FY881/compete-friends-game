import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Scale, ShieldAlert, Check, Clock, UserX } from "lucide-react";

/**
 * ⚖️ لوحة الحكم الآلي واللعب النظيف — سجل الأحداث المشبوهة في الموقع.
 */
export function FairPlayTab() {
  const events = useQuery(api.fairPlay.getFairPlayLog, { limit: 60 });
  const resolve = useMutation(api.fairPlay.resolveFairPlayEvent);

  const KIND_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
    impossible_speed: { label: "إجابة مستحيلة السرعة", emoji: "⚡", color: "text-rose-600" },
    perfect_repeat: { label: "دقة كاملة متكررة", emoji: "🎯", color: "text-amber-600" },
    pattern_anomaly: { label: "شذوذ في الأنماط", emoji: "📈", color: "text-violet-600" },
  };

  const unresolved = (events ?? []).filter((e) => !e.resolved);

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-l from-rose-500/10 via-card to-rose-500/10 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
          <Scale className="size-5 text-rose-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">الحكم الآلي واللعب النظيف</p>
          <p className="text-[11px] text-muted-foreground">
            كشف تلقائي للغش: إجابات مستحيلة السرعة، دقة متكررة إحصائياً مستحيلة، وشذوذ الأنماط
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-black text-rose-600">{unresolved.length}</p>
          <p className="text-[10px] text-muted-foreground">حدث قيد المراجعة</p>
        </div>
      </div>

      <div className="space-y-2">
        {events === undefined ? (
          <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-emerald-600" />
            <p className="mt-3 text-sm font-bold">لا أحداث مشبوهة — اللعب نظيف ✨</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              يظهر هنا تلقائياً أي نمط غش محتمل يكتشفه الحكم الآلي
            </p>
          </div>
        ) : (
          events.map((e) => {
            const meta = KIND_LABEL[e.kind] ?? { label: e.kind, emoji: "❓", color: "" };
            return (
              <div
                key={e._id}
                className={cn(
                  "rounded-xl border p-3",
                  e.resolved ? "border-border/40 bg-muted/10 opacity-60" : "border-rose-500/30 bg-rose-500/5",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-black", meta.color)}>{meta.label}</p>
                    <p className="mt-0.5 text-[11px] text-foreground">{e.detail}</p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <UserX className="size-3" /> {e.userName}
                      {e.gameCode && <span>· غرفة {e.gameCode}</span>}
                      <Clock className="size-3" />
                      {new Date(e.at).toLocaleString("ar", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "numeric",
                      })}
                    </p>
                  </div>
                  {!e.resolved && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await resolve({ eventId: e._id });
                          toast.success("حُسم الحدث — سلوك مقبول");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "فشل الحسم");
                        }
                      }}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                    >
                      <Check className="inline size-3" /> حسم
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        3 أحداث غير محسومة خلال 24 ساعة تسجّل مخالفة غش تلقائياً على اللاعب — وتظهر في لوحة إدارة اللاعبين.
      </p>
    </div>
  );
}
