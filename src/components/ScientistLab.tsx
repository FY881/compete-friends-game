import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FlaskConical,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Minus,
  Scale,
} from "lucide-react";

/**
 * 🧪 مخبر عالِم العقول — دفتر التجارب السببية.
 * أول أداة AI في اللعبة تُنتج معرفة: فرضية → تجربة مقسّمة → قياس → استنتاج.
 */

const STATUS_META: Record<string, { label: string; cls: string }> = {
  running: { label: "تجربة جارية", cls: "border-sky-500/40 bg-sky-500/10 text-sky-700" },
  concluded: { label: "استُنتجت", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
  aborted: { label: "أُلغيت", cls: "border-border bg-muted/40 text-muted-foreground" },
};

export function ScientistLab() {
  const lab = useQuery(api.aiScientist.getLab, {});
  const designNow = useAction(api.aiScientist.designNow);
  const runNow = useAction(api.aiScientist.runNow);
  const [busy, setBusy] = useState<"design" | "conclude" | null>(null);

  const design = async () => {
    setBusy("design");
    try {
      const r = await designNow({});
      if (r.started) toast.success("🧪 صُممت تجربة جديدة وبدأت تجمع البيانات.");
      else toast.info(r.reason === "experiment_running" ? "تجربة جارية بالفعل — المنهجية تمنع التداخل." : "تعذّر البدء.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تصميم التجربة.");
    } finally {
      setBusy(null);
    }
  };

  const conclude = async () => {
    setBusy("conclude");
    try {
      const r = await runNow({});
      if (!r.concluded) {
        toast.info(
          r.reason === "too_early" ? "التجربة لم تكمل مدتها الأدنى (3 أيام)." : "لا تجارب جارية.",
        );
      } else {
        toast.success("🔬 حُسمت التجربة — اقرأ الاستنتاج في الدفتر.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الخاتمة.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card dir="rtl" className="border-teal-500/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
            <FlaskConical className="size-4" />
          </span>
          <span>مخبر عالِم العقول — علم سببي حقيقي</span>
          <div className="ms-auto flex gap-1.5">
            <Button size="sm" onClick={design} disabled={busy !== null} className="h-8 gap-1.5 rounded-xl bg-teal-600 text-xs text-white hover:bg-teal-700">
              {busy === "design" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              صمّم تجربة
            </Button>
            <Button size="sm" variant="outline" onClick={conclude} disabled={busy !== null} className="h-8 gap-1.5 rounded-xl text-xs">
              {busy === "conclude" ? <Loader2 className="size-3.5 animate-spin" /> : <Scale className="size-3.5" />}
              قِس واستنتج
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          الغرف الجديدة تُقسَم بالحظ بين مجموعة تجريبية ومجموعة ضبط — ثم تُقارن
          المؤشرات. الفرق بين المجموعتين هو الأثر السببي الصافي، بدرجة ثقة
          إحصائية معلنة. «لا أثر مكتشف» نتيجة صادقة تُعلن كما هي.
        </p>

        {lab === undefined ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : lab === null ? (
          <p className="text-center text-xs text-muted-foreground">غير مصرح.</p>
        ) : lab.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-center">
            <FlaskConical className="mx-auto size-6 text-muted-foreground/50" />
            <p className="mt-2 text-xs font-bold">المخبر فارغ</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              صمّم أول تجربة ليبدأ العلم في هذا الموقع
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lab.map((e) => {
              const meta = STATUS_META[e.status] ?? STATUS_META.running;
              return (
                <div key={e._id} className="rounded-xl border border-border/60 bg-card p-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={cn("rounded-full text-[9px] font-bold", meta.cls)}>
                      {meta.label}
                    </Badge>
                    <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                      رافعة: {e.lever}
                    </Badge>
                    {e.causalConfidence !== null && (
                      <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                        ثقة {e.causalConfidence}%
                      </Badge>
                    )}
                    {e.appliedGlobally !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[9px]",
                          e.appliedGlobally
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-700",
                        )}
                      >
                        {e.appliedGlobally ? <CheckCircle2 className="me-0.5 inline size-2.5" /> : <XCircle className="me-0.5 inline size-2.5" />}
                        {e.appliedGlobally ? "يُوصى بالتعميم" : "لا يُعمَّم"}
                      </Badge>
                    )}
                    <span className="ms-auto text-[9px] text-muted-foreground">
                      {e.daysRunning} يوم
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-relaxed">{e.hypothesis}</p>
                  <p className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    <span>🧪 تجربة: {e.treatmentRooms} غرف</span>
                    <span>⚖️ ضبط: {e.controlRooms} غرف</span>
                  </p>
                  {e.conclusion && (
                    <p
                      className={cn(
                        "mt-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed",
                        e.appliedGlobally
                          ? "bg-emerald-500/[0.08] text-emerald-800"
                          : e.status === "aborted"
                            ? "bg-muted/40 text-muted-foreground"
                            : "bg-amber-500/[0.08] text-amber-800",
                      )}
                    >
                      🔬 {e.conclusion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
