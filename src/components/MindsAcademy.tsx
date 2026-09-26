import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Loader2,
  Target,
  TrendingUp,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/question-difficulty";

/**
 * 🎓 مدرسة العقول — تدريب شخصي بالذكاء الاصطناعي من نقاط ضعفك الحقيقية.
 * يقرأ إتقانك الفعلي فئةً فئة، ويبني لك درساً متدرجاً (أسهل من فشلك → مستواك)،
 * ثم يقيس أثر التدريب: إتقانك قبل الجلسة وبعدها.
 */

type SessionQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: string;
};

export function MindsAcademy() {
  const plan = useQuery(api.aiTraining.getTrainingPlan, {});
  const startSession = useAction(api.aiTraining.startSession);
  const complete = useMutation(api.aiTraining.completeSession);

  const [starting, setStarting] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [answersRevealed, setAnswersRevealed] = useState(false);

  // أسئلة الجلسة النشطة
  const sessionData = useQuery(
    api.aiTraining.getSessionQuestions,
    plan?.activeSession ? { sessionId: plan.activeSession._id } : "skip",
  );

  const begin = async (category?: string) => {
    setStarting(true);
    setPicked({});
    setAnswersRevealed(false);
    try {
      const result = await startSession({ category });
      toast.success(
        result.created
          ? `🎓 فُتحت جلسة تدريب في «${result.category}» — ${result.questions} أسئلة${result.generated > 0 ? ` (${result.generated} مولّدة ذكياً)` : ""}`
          : "عندك جلسة نشطة بالفعل — أكملها أولاً",
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر بدء الجلسة.");
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    if (!plan?.activeSession || !sessionData) return;
    const answered = Object.keys(picked).length;
    if (answered < sessionData.questions.length) {
      toast.error("أجب على كل الأسئلة أولاً.");
      return;
    }
    const correct = sessionData.questions.filter(
      (q) => picked[q.id] === q.correctIndex,
    ).length;
    try {
      await complete({
        sessionId: plan.activeSession._id,
        correct,
        total: sessionData.questions.length,
      });
      setAnswersRevealed(true);
      toast.success(
        `📊 النتيجة: ${correct}/${sessionData.questions.length} — سجّلنا أثر التدريب!`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إكمال الجلسة.");
    }
  };

  if (plan === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plan === null) {
    return (
      <div dir="rtl" className="rounded-2xl border border-border/60 bg-card p-6 text-center">
        <GraduationCap className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-bold">سجّل الدخول لفتح مدرسة العقول</p>
      </div>
    );
  }

  const measured = plan.weakest === null && plan.categories.length === 0;

  return (
    <div dir="rtl" className="space-y-4">
      {/* الترويسة */}
      <div className="flex items-center gap-3 rounded-2xl border border-teal-500/30 bg-gradient-to-l from-teal-500/10 via-card to-teal-500/10 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15">
          <GraduationCap className="size-5 text-teal-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">مدرسة العقول</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            تدريب ذكي من نقاط ضعفك الحقيقية — درس متدرج يقيس أثره على إتقانك
          </p>
        </div>
      </div>

      {/* التشخيص */}
      {measured ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center">
          <Target className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-bold">لا بيانات كافية للتشخيص بعد</p>
          <p className="mt-1 text-xs text-muted-foreground">
            العب جولات قليلة وسنشخص نقاط ضعفك تلقائياً من أدائك الحقيقي
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.weakest && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-3.5">
              <p className="text-[11px] font-bold text-rose-700">🔻 نقطة ضعفك</p>
              <p className="mt-1 text-sm font-black">{plan.weakest.category}</p>
              <p className="text-[11px] text-muted-foreground">
                إتقان {plan.weakest.mastery}% · {plan.weakest.correct}/{plan.weakest.total} إجابة صحيحة
              </p>
              <Button
                size="sm"
                onClick={() => begin(plan.weakest!.category)}
                disabled={starting || plan.activeSession !== null}
                className="mt-2 h-8 gap-1.5 rounded-xl bg-teal-600 text-xs text-white hover:bg-teal-700"
              >
                {starting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                درّبني على هذه الفئة
              </Button>
            </div>
          )}
          {plan.strongest && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5">
              <p className="text-[11px] font-bold text-emerald-700">🔺 أقوى فئاتك</p>
              <p className="mt-1 text-sm font-black">{plan.strongest.category}</p>
              <p className="text-[11px] text-muted-foreground">
                إتقان {plan.strongest.mastery}% · {plan.strongest.level === "master" ? "معلّم" : plan.strongest.level === "grandmaster" ? "أستاذ أعظم" : plan.strongest.level === "scholar" ? "عالم" : "متدرّب"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* الجلسة النشطة */}
      {plan.activeSession && sessionData === undefined && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {plan.activeSession && sessionData && (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/[0.03] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black">
              📚 جلسة تدريب: {sessionData.session.category}
            </p>
            <Badge variant="outline" className="rounded-full border-teal-500/40 bg-teal-500/10 text-[10px] text-teal-700">
              {DIFFICULTY_LABELS[sessionData.session.difficulty as Difficulty]}
            </Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {sessionData.session.source === "generated" || sessionData.session.source === "mixed"
                ? "بأسئلة مولّدة ذكياً"
                : "من بنك الأسئلة"}
            </Badge>
            <span className="ms-auto text-[10px] text-muted-foreground">
              إتقانك قبل الجلسة: {sessionData.session.masteryBefore}%
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {sessionData.questions.map((q, qi) => {
              const chosen = picked[q.id];
              const isCorrect = chosen === q.correctIndex;
              return (
                <div key={q.id} className="rounded-xl border border-border/60 bg-card p-3.5">
                  <p className="text-xs font-bold leading-relaxed">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, oi) => {
                      const chosenHere = chosen === oi;
                      const showCorrect = answersRevealed && oi === q.correctIndex;
                      const showWrong = answersRevealed && chosenHere && !isCorrect;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={answersRevealed}
                          onClick={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-start text-[11px] transition-all",
                            showCorrect
                              ? "border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-700"
                              : showWrong
                                ? "border-rose-500/50 bg-rose-500/10 text-rose-700"
                                : chosenHere
                                  ? "border-teal-500/60 bg-teal-500/10 font-bold"
                                  : "border-border/60 bg-background hover:border-teal-500/40",
                          )}
                        >
                          {showCorrect && <Check className="size-3 shrink-0" />}
                          {showWrong && <X className="size-3 shrink-0" />}
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {!answersRevealed ? (
            <Button
              onClick={finish}
              disabled={Object.keys(picked).length < sessionData.questions.length}
              className="mt-3 w-full gap-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
            >
              <TrendingUp className="size-4" />
              أنهِ الجلسة وسجّل النتيجة
            </Button>
          ) : (
            <div className="mt-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-center">
              <p className="text-xs font-black text-teal-700">
                ✓ سُجّلت الجلسة — عد بعد جولتك التالية لترى أثر التدريب على إتقانك
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => begin()}
                className="mt-2 h-8 rounded-xl text-xs"
              >
                جلسة تدريب جديدة
              </Button>
            </div>
          )}
        </div>
      )}

      {/* آخر جلسات مكتملة — أثر التدريب */}
      {plan.completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">آخر جلساتك المكتملة</p>
          {plan.completed.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
              <span className="text-xs font-bold">{s.category}</span>
              <span className="text-[10px] text-muted-foreground">
                {s.correct}/{s.total} صحيحة
              </span>
              <span
                className={cn(
                  "ms-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  (s.masteryAfter ?? 0) >= s.masteryBefore
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700",
                )}
              >
                <TrendingUp className="size-3" />
                {s.masteryBefore}% → {s.masteryAfter ?? "—"}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
