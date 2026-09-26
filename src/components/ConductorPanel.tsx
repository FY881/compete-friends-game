import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Loader2, TrendingUp, TrendingDown, Minus, Check, Pause } from "lucide-react";

/**
 * 🧠 العقل المُنسّق — قمة هرم أدوات العقول.
 * يقرأ نبض كل الأدوات، يختار فعل واحد موزون مبرراً، ويتعلم من نتائج قراراته.
 */

const DECISION_LABEL: Record<string, string> = {
  sharpen_colossus: "اشدد فخاخ الطاغوت",
  ease_questions: "خفف صعوبة الترسانة",
  generate_questions: "املأ فئة نازفة",
  boost_training: "موجة تدريب جماعية",
  investigate: "افتح تحقيقاً",
  narrate_hype: "أطلق المعلق على الذروة",
  prophecy: "أجبر العرّاف على نبوءة",
  hold: "انتظار حكيم",
};

const OUTCOME_STYLE: Record<string, { label: string; cls: string; icon: typeof TrendingUp }> = {
  good: { label: "حسّن المؤشرات", cls: "text-emerald-700", icon: TrendingUp },
  bad: { label: "تدهورت المؤشرات", cls: "text-rose-700", icon: TrendingDown },
  neutral: { label: "بلا أثر واضح", cls: "text-muted-foreground", icon: Minus },
  pending: { label: "قيد التقييم", cls: "text-amber-700", icon: Pause },
};

export function ConductorPanel() {
  const history = useQuery(api.aiConductor.getHistory, { limit: 12 });
  const conductNow = useAction(api.aiConductor.conductNow);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await conductNow({});
      toast.success(
        `🧠 قرار الدورة: ${DECISION_LABEL[result.decision]} — ${result.executed ? "نُفّذ" : "سُجّل كتوصية"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تشغيل الدورة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card dir="rtl" className="border-violet-500/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
            <BrainCircuit className="size-4" />
          </span>
          <span>العقل المُنسّق — قمة هرم العقول</span>
          <Button
            size="sm"
            onClick={run}
            disabled={busy}
            className="ms-auto h-8 gap-1.5 rounded-xl bg-violet-600 text-xs text-white hover:bg-violet-700"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BrainCircuit className="size-3.5" />}
            دورة الآن
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          يقرأ نبض الأدوات السبع دفعة واحدة (الطاغوت، العرّاف، المدقق، المحقق،
          المدرسة، الجريدة، والبنك)، يوازن الموقف ككل، ويختار فعل واحد مبرَّراً —
          ثم يُقيَّم قراره في الدورة التالية: القرار الصائب يُكرر بوزن أعلى،
          والخاطئ يخسر وزنه. حكم حقيقي بمساءلة.
        </p>

        {history === undefined ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : history === null ? (
          <p className="text-center text-xs text-muted-foreground">غير مصرح.</p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-5 text-center">
            <p className="text-xs font-bold">لم تنطلق أي دورة بعد</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              الدورة الأولى ستقرأ نبض الساحة كله وتصدر أول قرار
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((d) => {
              const outcome = OUTCOME_STYLE[d.outcome] ?? OUTCOME_STYLE.pending;
              const OutcomeIcon = outcome.icon;
              return (
                <div key={d._id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full border-violet-500/40 bg-violet-500/10 text-[9px] font-bold text-violet-700">
                      دورة #{d.cycle}
                    </Badge>
                    <span className="text-xs font-black">{DECISION_LABEL[d.decision] ?? d.decision}</span>
                    <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                      ثقة {d.confidence}
                    </Badge>
                    {d.status === "skipped" && (
                      <Badge variant="outline" className="rounded-full text-[9px]">
                        توصية
                      </Badge>
                    )}
                    <span className={cn("ms-auto flex items-center gap-1 text-[10px] font-bold", outcome.cls)}>
                      <OutcomeIcon className="size-3" />
                      {outcome.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{d.reason}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground/70">
                    {new Date(d.createdAt).toLocaleString("ar", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "numeric",
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
