import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, Stethoscope, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 🩺 أداة 31 — المدقّق الشامل: فحص دقيق جداً لكل شيء في اللعبة،
 * مع إصلاح تلقائي فوري لكل ما يمكن إصلاحه، وفحص دوري كل ساعة
 * حتى لا تعود المشاكل دون أن تُكتشف.
 */
export function HealthGuard() {
  const audit = useQuery(api.aiHealthGuard.getLatestAudit, {});
  const history = useQuery(api.aiHealthGuard.getAuditHistory, {});
  const runNow = useMutation(api.aiHealthGuard.runAuditNow);

  const run = async () => {
    toast.info("🔍 جاري الفحص الشامل لكل شيء في اللعبة...");
    try {
      const res = await runNow({});
      toast.success(
        res.verdict === "سليم"
          ? "✅ الفحص اكتمل: كل شيء سليم!"
          : `🩺 الفحص اكتمل: ${res.verdict} — التفاصيل أدناه`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الفحص، حاول مجدداً.");
    }
  };

  const verdictStyle =
    audit?.verdict === "سليم"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
      : audit?.verdict === "حرج"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
        : "border-amber-500/40 bg-amber-500/10 text-amber-600";

  const statusIcon = (s: string) =>
    s === "pass" ? "✅" : s === "fail" ? "⛔" : "⚠️";

  return (
    <div className="space-y-4">
      {/* الرأس */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
          <Stethoscope className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">🩺 المدقّق الشامل</p>
          <p className="text-xs text-muted-foreground">
            فحص دقيق جداً لكل شيء — المهام الخلفية، الأخطاء، العناقيد، الرقع، الأحرار،
            ونبض القرارات — ويصلح ما يمكن إصلاحه فوراً. يعمل دورياً كل ساعة.
          </p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={run} disabled={audit === undefined}>
          <ShieldCheck className="size-3.5" />
          افحص الآن
        </Button>
      </div>

      {audit === undefined ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جاري تحميل آخر جولة فحص...
        </div>
      ) : !audit ? (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          لم تجري أي جولة فحص بعد — اضغط «افحص الآن» لبدء أول تدقيق شامل.
        </div>
      ) : (
        <>
          {/* الخلاصة */}
          <div className={cn("rounded-2xl border p-4", verdictStyle)}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold">
                آخر فحص: {audit.verdict} —{" "}
                {new Date(audit.createdAt).toLocaleString("ar-EG")}
              </p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="outline" className="rounded-full">
                  ✅ {audit.passed} سليم
                </Badge>
                {audit.warnings > 0 && (
                  <Badge variant="outline" className="rounded-full">
                    ⚠️ {audit.warnings} تنبيه
                  </Badge>
                )}
                {audit.failures > 0 && (
                  <Badge variant="outline" className="rounded-full">
                    ⛔ {audit.failures} حرج
                  </Badge>
                )}
                {audit.healed > 0 && (
                  <Badge variant="outline" className="gap-1 rounded-full">
                    <Wrench className="size-3" /> {audit.healed} أُصلح تلقائياً
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* نتائج الفحص */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70">
            {audit.results.map((r, i) => (
              <div
                key={`${r.area}-${i}`}
                className="flex items-start gap-3 border-b border-border/40 px-4 py-3 last:border-b-0"
              >
                <span className="mt-0.5 shrink-0">{statusIcon(r.status)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">{r.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{r.detail}</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                  {r.area}
                </Badge>
              </div>
            ))}
          </div>

          {/* التاريخ */}
          {history && history.length > 1 && (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <p className="text-xs font-bold text-muted-foreground">سجل جولات الفحص</p>
              <div className="mt-2 space-y-1.5">
                {history.slice(1).map((h) => (
                  <div key={h._id} className="flex items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        h.verdict === "سليم"
                          ? "bg-emerald-500"
                          : h.verdict === "حرج"
                            ? "bg-rose-500"
                            : "bg-amber-500",
                      )}
                    />
                    <span className="text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString("ar-EG")}
                    </span>
                    <span className="ms-auto tabular-nums text-muted-foreground">
                      {h.passed}✅ {h.warnings}⚠️ {h.failures}⛔
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
