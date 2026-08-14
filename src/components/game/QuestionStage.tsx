import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ANSWER_MS } from "@/lib/game-config";
import type { GameData, PlayerInfo } from "@/convex/games";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Hourglass,
  Loader2,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Leaderboard } from "./Leaderboard";
import { useNow } from "./ui";

const OPTION_LETTERS = ["أ", "ب", "ج", "د"];

function CountdownRing({ remainingMs }: { remainingMs: number }) {
  const fraction = Math.max(0, Math.min(1, remainingMs / ANSWER_MS));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const urgent = fraction < 0.25;

  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 72 72" className="size-20 -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-border"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={urgent ? "stroke-destructive" : "stroke-primary"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 250ms linear, stroke 300ms" }}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums",
          urgent && "text-destructive",
        )}
      >
        {Math.max(0, Math.ceil(remainingMs / 1000))}
      </span>
    </div>
  );
}

export function QuestionStage({
  game,
  me,
}: {
  game: GameData;
  me: PlayerInfo;
}) {
  const submitAnswer = useMutation(api.games.submitAnswer);
  const [submitting, setSubmitting] = useState(false);
  const now = useNow(250);

  const g = game.game;
  const index = g.currentQuestionIndex;
  const question = game.questions[index];
  const phase = g.phase;
  const startedAt = g.questionStartedAt;
  const remaining = startedAt + ANSWER_MS - now;
  const timeUp = phase === "answering" && remaining <= 0;

  const myAnswer = me.answers[index] ?? null;
  const answeredCount = game.players.filter((p) => p.answers[index] != null).length;
  const totalPlayers = game.players.length;
  const isRevealing = phase === "revealing";

  if (!question) {
    return null;
  }

  const submit = async (optionIndex: number) => {
    if (submitting || myAnswer) return;
    setSubmitting(true);
    try {
      await submitAnswer({
        code: g.code,
        questionIndex: index,
        optionIndex,
      });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر تسجيل الإجابة.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const optionState = (optionIndex: number) => {
    if (isRevealing) {
      const correct = question.correctIndex;
      if (optionIndex === correct) return "correct";
      if (myAnswer && optionIndex === myAnswer.selected && !myAnswer.correct) {
        return "wrong";
      }
      return "idle";
    }
    if (myAnswer) {
      return optionIndex === myAnswer.selected ? "picked" : "idle";
    }
    return "selectable";
  };

  return (
    <div className="grid w-full items-start gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Question card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-7 shadow-sm sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 start-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />

        {/* Top bar */}
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="size-3" />
              {question.category}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              السؤال {index + 1} من {g.questionCount}
            </Badge>
          </div>
          {!isRevealing ? (
            <CountdownRing remainingMs={remaining} />
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            >
              <Check className="size-3" />
              الإجابة الصحيحة
            </Badge>
          )}
        </div>

        {/* Question */}
        <h2 className="relative mt-8 text-2xl font-bold leading-relaxed tracking-tight sm:text-[1.7rem]">
          {question.question}
        </h2>

        {/* Options */}
        <div className="relative mt-7 grid gap-3">
          {question.options.map((option, i) => {
            const state = optionState(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => submit(i)}
                disabled={
                  state === "selectable" ? submitting || !!myAnswer || timeUp : true
                }
                className={cn(
                  "group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-start text-base font-medium transition-all",
                  state === "selectable" &&
                    "border-border/80 bg-background text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                  state === "picked" &&
                    "border-primary/60 bg-primary/10 text-primary shadow-sm",
                  state === "correct" &&
                    "border-emerald-500/60 bg-emerald-500/10 text-emerald-700",
                  state === "wrong" &&
                    "border-rose-500/60 bg-rose-500/10 text-rose-700",
                  state === "idle" && "border-border/60 bg-muted/40 text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-colors",
                    state === "selectable" &&
                      "border-border bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-primary",
                    state === "picked" && "border-primary bg-primary text-primary-foreground",
                    state === "correct" && "border-emerald-600 bg-emerald-600 text-white",
                    state === "wrong" && "border-rose-600 bg-rose-600 text-white",
                    state === "idle" && "border-border/60 bg-card text-muted-foreground/60",
                  )}
                >
                  {OPTION_LETTERS[i]}
                </span>
                <span className="flex-1">{option}</span>
                {state === "correct" && <Check className="size-5 shrink-0" />}
                {state === "wrong" && <X className="size-5 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Feedback bar */}
        <div className="relative mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 text-primary" />
            أجاب {answeredCount} من {totalPlayers}
          </div>

          {isRevealing ? (
            myAnswer ? (
              myAnswer.correct ? (
                <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700">
                  <Zap className="size-4" />
                  إجابة صحيحة! +{myAnswer.points} نقطة
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-700">
                  <X className="size-4" />
                  إجابة خاطئة — 0 نقطة
                </span>
              )
            ) : (
              <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-bold text-muted-foreground">
                <Hourglass className="size-4" />
                لم تجب على هذا السؤال
              </span>
            )
          ) : timeUp ? (
            <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-bold text-muted-foreground">
              <Hourglass className="size-4" />
              انتهى الوقت!
            </span>
          ) : myAnswer ? (
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Check className="size-4 text-emerald-600" />
              تم تسجيل إجابتك — في انتظار البقية…
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              اختر إحدى الإجابات قبل انتهاء الوقت
            </span>
          )}
        </div>
      </div>

      {/* Live leaderboard */}
      <div className="lg:sticky lg:top-6">
        <Leaderboard players={game.players} compact />
        {isRevealing && (
          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-5 text-center shadow-sm">
            <p className="text-sm font-bold">استعد للسؤال التالي…</p>
            <div className="mt-2 flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
