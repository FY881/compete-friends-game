import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  UserRound,
  Loader2,
  Swords,
  TrendingUp,
  Minus,
  TrendingDown,
  Clock,
} from "lucide-react";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/question-difficulty";

/**
 * 👤 صدى الذات — مواجهة عقل الحاضر ضد عقل الماضي.
 * نسخة رقمية منك مبنية من إحصاءاتك الحقيقية: ترد بنفس دقتك وتجيب بسرعتك.
 * الفوز الوحيد الممكن: أن تكون اليوم أفضل مما كنت.
 */

type ActiveMatch = {
  _id: string;
  questions: { id: string; category: string; difficulty: string; question: string; options: string[] }[];
};

const VERDICT_META: Record<string, { label: string; cls: string; icon: typeof TrendingUp }> = {
  surpassed: { label: "تجاوزت ذاتك", cls: "text-emerald-700", icon: TrendingUp },
  matched: { label: "تعادل مع ذاتك", cls: "text-amber-700", icon: Minus },
  lost: { label: "ظلّك أسرع منك", cls: "text-rose-700", icon: TrendingDown },
};

export function EchoCard() {
  const data = useQuery(api.aiEcho.getMyEchoMatch, {});
  const stats = useQuery(api.aiEcho.getEchoStats, {});
  const startEchoMatch = useMutation(api.aiEcho.startEchoMatch);
  const finishEchoMatch = useMutation(api.aiEcho.finishEchoMatch);

  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<{ myCorrect: number; echoCorrect: number; verdict: string; narration: string } | null>(null);

  const begin = async () => {
    setBusy(true);
    setPicked({});
    setResult(null);
    try {
      const r = await startEchoMatch();
      if (r.created) {
        setStartTime(Date.now());
        toast.success("👤 صُنع صداؤك من بصمة عقلك — المواجهة بدأت!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بناء الصدى.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!data || !data.active || !startTime) return;
    const answered = Object.keys(picked).length;
    if (answered < data.active.questions.length) {
      toast.error("أجب على كل الأسئلة أولاً.");
      return;
    }
    setBusy(true);
    try {
      const answers = data.active.questions.map((q) => ({
        questionId: q.id,
        selected: picked[q.id] ?? -1,
        elapsedMs: Date.now() - startTime,
      }));
      const res = await finishEchoMatch({ runId: data.active._id as never, answers });
      setResult(res);
      const meta = VERDICT_META[res.verdict];
      if (res.verdict === "surpassed") toast.success(`👤 ${meta.label}!`);
      else if (res.verdict === "matched") toast.info(meta.label);
      else toast.error(meta.label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حسم المواجهة.");
    } finally {
      setBusy(false);
    }
  };

  if (data === undefined || data === null) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> الصدى يتشكل…
        </CardContent>
      </Card>
    );
  }

  const active = data.active as ActiveMatch | null;

  return (
    <Card dir="rtl" className="overflow-hidden border-sky-500/25 bg-gradient-to-b from-sky-500/[0.05] to-transparent">
      <CardContent className="p-0">
        <div className="flex items-center gap-2.5 border-b border-sky-500/20 bg-sky-500/[0.07] px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15">
            <UserRound className="size-4.5 text-sky-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">صدى الذات</p>
            <p className="text-[10px] text-muted-foreground">
              نسخة رقمية من عقلك الماضي — تُجيب بدقته وسرعته الحقيقية
            </p>
          </div>
          {stats && stats.total > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full font-mono text-[10px]",
                (stats.winRate ?? 0) >= 60
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700",
              )}
            >
              تجاوزت ذاتك {stats.winRate}% ({stats.total} مواجهة)
            </Badge>
          )}
        </div>

        <div className="p-4">
          {!active && !result && (
            <div className="text-center">
              {data.last && (
                <div className="mx-auto mb-3 max-w-sm rounded-xl border border-border/60 bg-card p-3">
                  <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold">
                    {(() => {
                      const meta = VERDICT_META[data.last.verdict ?? "matched"];
                      const Icon = meta.icon;
                      return <Icon className={cn("size-3.5", meta.cls)} />;
                    })()}
                    آخر مواجهة: أنت {data.last.myCorrect} × {data.last.echoCorrect} الصدى
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {data.last.verdict === "surpassed"
                      ? "هذه المرة الصدى أعرف لك من نفسه — هل تتجاوزه ثانية؟"
                      : "الانتقام من نفسك متاح دائماً."}
                  </p>
                </div>
              )}
              <Button
                onClick={begin}
                disabled={busy}
                className="gap-2 rounded-xl bg-sky-600 px-6 text-white hover:bg-sky-700"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}
                واجه صدى ذاتك
              </Button>
              <p className="mt-2 text-[10px] text-muted-foreground">
                7 أسئلة مرسومة على خريطة قدراتك — قوتك وضغفك في مواجهة واحدة
              </p>
            </div>
          )}

          {active && !result && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700">
                <Clock className="size-3.5" />
                الصدى يُجيب بنفس سرعتك التاريخية — لا تتأخر…
              </p>
              {active.questions.map((q, qi) => (
                <div key={q.id} className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-xs font-bold">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full text-[9px]">{q.category}</Badge>
                    <Badge variant="outline" className="rounded-full text-[9px]">
                      {DIFFICULTY_LABELS[q.difficulty as Difficulty]}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-start text-[11px] transition-all",
                          picked[q.id] === oi
                            ? "border-sky-500/60 bg-sky-500/10 font-bold"
                            : "border-border/60 bg-background hover:border-sky-500/40",
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                onClick={finish}
                disabled={busy || Object.keys(picked).length < active.questions.length}
                className="w-full gap-1.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}
                احسم المواجهة
              </Button>
            </div>
          )}

          {result && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-2xl border-2 border-sky-500/30 bg-sky-500/[0.06] p-5 text-center"
            >
              {(() => {
                const meta = VERDICT_META[result.verdict];
                const Icon = meta.icon;
                return <Icon className={cn("mx-auto size-10", meta.cls)} />;
              })()}
              <p className="mt-2 text-lg font-black text-foreground">
                أنت {result.myCorrect} — {result.echoCorrect} الصدى
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.narration}</p>
              <Button size="sm" variant="outline" onClick={begin} disabled={busy} className="mt-3 h-8 rounded-xl text-xs">
                مواجهة جديدة
              </Button>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
