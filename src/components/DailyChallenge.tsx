import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  Medal,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";

type DailyQuestion = {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
};

type DailyResult = {
  score: number;
  correctCount: number;
  total: number;
  bestStreak: number;
  xpEarned: number;
  badgesEarned: string[];
  perfect: boolean;
};

const DIFF_TONE: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-600",
  medium: "bg-amber-500/15 text-amber-600",
  hard: "bg-rose-500/15 text-rose-600",
};

const DIFF_LABEL: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export function DailyChallengeCard() {
  const challenge = useQuery(api.daily.getDailyChallenge);
  const [open, setOpen] = useState(false);

  if (challenge === undefined) {
    return (
      <div className="flex h-44 items-center justify-center rounded-3xl border border-border/80 bg-card">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  if (challenge === null) return null;

  const { questions, completed, completedDays, bestScoreEver, streak, myRank, boardSize, maxXp } = challenge;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -end-16 size-40 rounded-full bg-primary/10 blur-2xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <CalendarDays className="size-6" />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              تحدي اليوم
              {completed && (
                <Badge className="gap-1 rounded-full bg-emerald-500/15 text-emerald-600">
                  <Check className="size-3" />
                  أُنجز
                </Badge>
              )}
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              {completed
                ? `نتيجتك: ${completed.score} نقطة · ${completed.correctCount}/${questions.length} صحيحة · سلسلة ${completed.bestStreak}`
                : "نفس 10 أسئلة لكل اللاعبين اليوم — محاولة واحدة، والنقاط والشارات لك."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3 text-primary" />
                {completedDays} يوم تحدٍّ
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="size-3 text-amber-500" />
                أفضل نتيجة: {bestScoreEver} نقطة
              </span>
              {/* 🔥 سلسلة الأيام الحقيقية — من الخادم */}
              {streak.current > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 font-bold text-orange-600">
                  <Flame className="size-3" />
                  سلسلة {streak.current} {streak.current === 1 ? "يوم" : "أيام"}
                </span>
              )}
              {/* 🏅 رتبتك اليومية الحية */}
              {myRank != null && boardSize > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 font-bold text-violet-600">
                  <Medal className="size-3" />
                  ترتيبك اليوم: #{myRank} من {boardSize}
                </span>
              )}
              {/* المكافأة القصوى */}
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600">
                <Zap className="size-3" />
                حتى {maxXp} XP
              </span>
            </div>
          </div>
        </div>
        <Button
          size="lg"
          className="gap-2 rounded-xl"
          onClick={() => setOpen(true)}
          disabled={Boolean(completed)}
        >
          {completed ? (
            <>
              <Check className="size-4" />
              عد غداً لتحدٍّ جديد
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              ابدأ تحدي اليوم
            </>
          )}
        </Button>
      </div>

      <DailyQuizDialog open={open} onOpenChange={setOpen} />
    </motion.div>
  );
}

function DailyQuizDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const challenge = useQuery(api.daily.getDailyChallenge);
  const submit = useMutation(api.daily.submitDailyChallenge);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<
    { questionId: string; selected: number; elapsedMs: number }[]
  >([]);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (open) {
      setIndex(0);
      setAnswers([]);
      setResult(null);
      startRef.current = Date.now();
    }
  }, [open]);

  if (!open) return null;
  if (challenge === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  if (challenge === null) return null;

  const questions = challenge.questions;
  const current = questions[index];
  const selected = answers[index];
  const answered = answers.length;

  const pickOption = (optionIndex: number) => {
    if (submitting) return;
    const elapsedMs = Date.now() - startRef.current;
    const next = [...answers];
    next[index] = { questionId: current.id, selected: optionIndex, elapsedMs };
    setAnswers(next);
  };

  const finish = async () => {
    if (submitting || answers.length !== questions.length) return;
    setSubmitting(true);
    try {
      const res = await submit({ day: challenge.day, answers });
      setResult({
        score: res.score,
        correctCount: res.correctCount,
        total: res.total,
        bestStreak: res.bestStreak,
        xpEarned: res.xpEarned,
        badgesEarned: res.badgesEarned,
        perfect: res.perfect,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              تحدي اليوم — {answered}/{questions.length}
            </span>
            {!result && (
              <button
                type="button"
                onClick={close}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="إغلاق"
              >
                <X className="size-4" />
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-400/15 text-3xl">
              {result.perfect ? "💯" : result.correctCount >= 7 ? "🎉" : "🏁"}
            </div>
            <p className="mt-4 text-2xl font-bold">
              {result.correctCount}/{result.total} إجابة صحيحة
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.score} نقطة · أطول سلسلة {result.bestStreak}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
              <Sparkles className="size-4" />
              +{result.xpEarned} XP
            </p>
            {result.badgesEarned.length > 0 && (
              <p className="mt-3 text-sm font-semibold text-amber-700">
                🏅 شارة جديدة: {result.badgesEarned.join("، ")}
              </p>
            )}
            <Button className="mt-6 gap-2 rounded-xl" onClick={close}>
              <Trophy className="size-4" />
              رائع — عد غداً
            </Button>
          </div>
        ) : (
          <div className="py-2">
            <Progress
              value={((index + (selected ? 1 : 0)) / questions.length) * 100}
              className="h-1.5"
            />
            <div className="mt-5 flex items-center justify-between gap-3">
              <Badge className={cn("rounded-full", DIFF_TONE[current.difficulty])}>
                {DIFF_LABEL[current.difficulty]}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {current.category}
              </Badge>
            </div>
            <p className="mt-4 min-h-16 text-lg font-bold leading-relaxed">
              {current.question}
            </p>
            <div className="mt-4 grid gap-2.5">
              {current.options.map((option, optionIndex) => {
                const isChosen = selected?.selected === optionIndex;
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    onClick={() => pickOption(optionIndex)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-start text-sm font-semibold transition-all",
                      isChosen
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        isChosen
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {optionIndex + 1}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 rounded-xl"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                <ChevronRight className="size-4" />
                السابق
              </Button>
              {index < questions.length - 1 ? (
                <Button
                  type="button"
                  className="gap-1.5 rounded-xl"
                  onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                  disabled={!selected}
                >
                  التالي
                  <ChevronLeft className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="gap-1.5 rounded-xl"
                  onClick={finish}
                  disabled={answers.length !== questions.length || submitting}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Star className="size-4" />
                  )}
                  إنهاء التحدي
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
