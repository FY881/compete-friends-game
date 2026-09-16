import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Target } from "lucide-react";

/**
 * 🧬 بطاقة تخصصات العقل المتطور — إتقان حقيقي لكل حقل معرفي.
 *  تُحسب من أدائك الفعلي بعد كل جولة (دقة × حجم)، وتظهر في ملفك
 *  لتعرف نقاط قوتك وحقول التدريب — بلا أرقام وهمية.
 */

const LEVEL_TONE: Record<string, { bar: string; text: string }> = {
  novice: { bar: "bg-slate-400", text: "text-slate-500" },
  apprentice: { bar: "bg-sky-500", text: "text-sky-600" },
  scholar: { bar: "bg-emerald-500", text: "text-emerald-600" },
  expert: { bar: "bg-amber-500", text: "text-amber-600" },
  grandmaster: { bar: "bg-yellow-400", text: "text-yellow-600" },
};

export function MindSpecializationsCard() {
  const specs = useQuery(api.mindSpecializations.getMySpecializations);
  const primary = useQuery(api.mindSpecializations.getMyPrimarySpecialization);
  const weakest = useQuery(api.mindSpecializations.getWeakestFields);

  if (specs === undefined || primary === undefined || weakest === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (specs === null) return null;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Brain className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">تخصصات عقلك</h2>
          <p className="text-xs text-muted-foreground">
            إتقان حقيقي يُحسب من أدائك بعد كل جولة — دقة × حجم الإجابات
          </p>
        </div>
        {primary && (
          <Badge className="ms-auto rounded-full bg-primary/10 text-primary">
            لقبك: {primary.title}
          </Badge>
        )}
      </div>

      {specs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            لا تخصصات بعد — العب 5 إجابات في أي حقل ليبدأ احتساب إتقانك فيه
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map((s) => {
            const tone = LEVEL_TONE[s.level] ?? LEVEL_TONE.novice;
            return (
              <div key={s.category} className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold">{s.category}</p>
                  <span className={cn("shrink-0 text-[10px] font-bold", tone.text)}>
                    {s.levelEmoji} {s.levelLabel}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>الإتقان</span>
                    <span className="tabular-nums font-bold">{s.mastery}/100</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", tone.bar)}
                      style={{ width: `${s.mastery}%` }}
                    />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {s.correct}/{s.total} إجابة صحيحة
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* حقول التدريب — توصية مبنية على أضعف الحقول فعلاً */}
      {weakest && weakest.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
            <Target className="size-3.5" /> حقول تستحق تدريبك
          </p>
          <div className="space-y-1">
            {weakest.map((w) => (
              <p key={w.category} className="text-[11px] text-muted-foreground">
                • <span className="font-bold">{w.category}</span> ({w.levelLabel} · إتقان {w.mastery}) — {w.hint}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
