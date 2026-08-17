import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DIFFICULTY_BASE_POINTS,
  DIFFICULTY_SPEED_BONUS,
  MAX_STREAK_BONUS,
  STREAK_BONUS_PER_STEP,
} from "@/convex/gameConfig";
import type { GameData, PlayerInfo } from "@/convex/games";
import { sounds } from "@/lib/sounds";
import { COUNTDOWN_MS, LIFELINES_PER_GAME } from "@/lib/game-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Eraser,
  Flame,
  Hourglass,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Leaderboard } from "./Leaderboard";
import { useNow } from "./ui";

const OPTION_LETTERS = ["أ", "ب", "ج", "د"];

const DIFFICULTY_STYLES = {
  easy: {
    label: "سهل",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "متوسط",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
  hard: {
    label: "صعب",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700",
    dot: "bg-rose-500",
  },
} as const;

function CountdownRing({
  remainingMs,
  totalMs,
}: {
  remainingMs: number;
  totalMs: number;
}) {
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
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
  const useFiftyFifty = useMutation(api.games.useFiftyFifty);
  const recordCheat = useMutation(api.owner.recordCheat);
  const [submitting, setSubmitting] = useState(false);
  const [fiftyLoading, setFiftyLoading] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [cheatNotice, setCheatNotice] = useState<string | null>(null);
  const reportedFor = useRef<number | null>(null);
  const now = useNow(200);
  const prevPhase = useRef(game.game.phase);

  const g = game.game;
  const index = g.currentQuestionIndex;
  const question = game.questions[index];
  const phase = g.phase;
  const startedAt = g.questionStartedAt;
  const timePerQuestion = g.settings.timePerQuestionMs;
  const remaining = startedAt + timePerQuestion - now;
  const timeUp = phase === "answering" && remaining <= 0;

  const myAnswer = me.answers[index] ?? null;
  // Second chance («فرصة ثانية»): after a wrong answer the player may retry
  // once while the answer window is still open — half points on a correct retry.
  const canRetry =
    phase === "answering" &&
    !timeUp &&
    myAnswer != null &&
    !myAnswer.correct &&
    !me.secondChanceUsed;
  const answeredCount = game.players.filter((p) => p.answers[index] != null).length;
  const totalPlayers = game.players.length;
  const isRevealing = phase === "revealing";
  const isCountdown = phase === "countdown";
  const countdownLeft = isCountdown ? g.questionStartedAt - now : 0;
  const countdownNumber = Math.max(0, Math.ceil(countdownLeft / 1000));

  // Golden question: the last question of the round doubles all points.
  const isGolden = question?.golden ?? false;
  const firstCorrectId = g.firstCorrect[index];
  const firstCorrectName = firstCorrectId
    ? game.players.find((p) => p.id === firstCorrectId)?.name ?? null
    : null;

  // Fresh lifeline + cheat notice state for every question.
  useEffect(() => {
    setHiddenOptions([]);
    setCheatNotice(null);
  }, [index]);

  // Anti-cheat: leaving the game window during a question is treated as using
  // the internet to look up the answer. The server applies an automatic,
  // escalating punishment (warn → score penalty → ban).
  useEffect(() => {
    if (phase !== "answering" || myAnswer) return;
    if (reportedFor.current === index) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const detect = () => {
      const away = document.hidden || !document.hasFocus();
      if (!away || reportedFor.current === index) return;
      // Only flag after the player stays away for a moment, to avoid
      // punishing accidental focus loss (notifications, window drag, …).
      timer = setTimeout(() => {
        if (reportedFor.current === index) return;
        reportedFor.current = index;
        recordCheat({ code: g.code })
          .then((result) => {
            if (result) setCheatNotice(result.message);
          })
          .catch(() => undefined);
      }, 1500);
    };
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", detect);
    window.addEventListener("blur", detect);
    window.addEventListener("focus", cancel);
    return () => {
      document.removeEventListener("visibilitychange", detect);
      window.removeEventListener("blur", detect);
      window.removeEventListener("focus", cancel);
      if (timer) clearTimeout(timer);
    };
  }, [phase, myAnswer, index, g.code, recordCheat]);

  // Countdown beeps (3-2-1) before the first question.
  useEffect(() => {
    if (!isCountdown || countdownNumber === 0) return;
    sounds.countdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownNumber, isCountdown]);

  // Tick sound during the final five seconds.
  const tickSecond = Math.floor(remaining / 1000);
  useEffect(() => {
    if (phase !== "answering" || myAnswer) return;
    if (remaining > 0 && remaining <= 5000) {
      sounds.tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickSecond, phase, myAnswer]);

  // Feedback sounds + haptics when the correct answer is revealed.
  useEffect(() => {
    if (prevPhase.current === "answering" && phase === "revealing") {
      if (myAnswer?.correct) {
        sounds.correct();
      } else if (myAnswer) {
        sounds.wrong();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(90);
        }
      }
      sounds.reveal();
    }
    prevPhase.current = phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!question) {
    return null;
  }

  // ── 3-2-1 countdown before the first question ────────────────────────
  if (isCountdown) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-8 py-16 text-center sm:py-24">
        <Badge variant="outline" className="gap-1.5 rounded-full text-primary">
          <Sparkles className="size-3.5" />
          استعدوا للمعركة…
        </Badge>
        <div className="relative flex size-44 items-center justify-center">
          <CountdownRing remainingMs={countdownLeft} totalMs={COUNTDOWN_MS} />
          <span className="absolute text-7xl font-bold tabular-nums tracking-tight">
            {countdownNumber}
          </span>
        </div>
        <div>
          <p className="text-lg font-bold">السؤال الأول بعد {countdownNumber} ثانية</p>
          <p className="mt-1 text-sm text-muted-foreground">
            نفس السؤال · نفس الوقت · أسرع عقل يفوز
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const submit = async (optionIndex: number) => {
    if (submitting || isRevealing) return;
    if (myAnswer && !canRetry) return;
    setSubmitting(true);
    try {
      await submitAnswer({
        code: g.code,
        questionIndex: index,
        optionIndex,
      });
      sounds.select();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر تسجيل الإجابة.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcuts: 1–4 pick an option.
  useEffect(() => {
    if (isRevealing || timeUp) return;
    if (myAnswer && !canRetry) return;
    const handler = (event: KeyboardEvent) => {
      const num = parseInt(event.key, 10);
      if (num >= 1 && num <= 4 && !hiddenOptions.includes(num - 1)) {
        void submit(num - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealing, myAnswer, timeUp, hiddenOptions, submitting, question]);

  const fiftyUsed = me.fiftyFiftyUsed;
  const handleFifty = async () => {
    if (fiftyLoading || fiftyUsed || myAnswer || isRevealing) return;
    setFiftyLoading(true);
    try {
      const { hidden } = await useFiftyFifty({
        code: g.code,
        questionIndex: index,
      });
      setHiddenOptions(hidden);
      sounds.lifeline();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر استخدام المنقّي.",
      );
    } finally {
      setFiftyLoading(false);
    }
  };

  const difficultyStyle = DIFFICULTY_STYLES[question.difficulty];
  const nextStreakBonus = Math.min(
    MAX_STREAK_BONUS,
    Math.max(0, me.streak * STREAK_BONUS_PER_STEP),
  );
  const baseMax =
    DIFFICULTY_BASE_POINTS[question.difficulty] +
    DIFFICULTY_SPEED_BONUS[question.difficulty] +
    nextStreakBonus;
  const maxPoints = baseMax * (isGolden ? 2 : 1);

  const optionState = (optionIndex: number) => {
    if (hiddenOptions.includes(optionIndex)) return "hidden";
    if (isRevealing) {
      const correct = question.correctIndex;
      if (optionIndex === correct) return "correct";
      if (myAnswer && optionIndex === myAnswer.selected && !myAnswer.correct) {
        return "wrong";
      }
      return "idle";
    }
    if (myAnswer && !canRetry) {
      return optionIndex === myAnswer.selected ? "picked" : "idle";
    }
    return "selectable";
  };

  const progress = Math.round((answeredCount / Math.max(1, totalPlayers)) * 100);

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
            <Badge variant="outline" className={cn("gap-1.5", difficultyStyle.badge)}>
              <span className={cn("size-1.5 rounded-full", difficultyStyle.dot)} />
              {difficultyStyle.label}
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              السؤال {index + 1} من {g.questionCount}
            </Badge>
            {isGolden && (
              <Badge className="gap-1.5 border-amber-500/40 bg-amber-400/15 text-amber-700 hover:bg-amber-400/15">
                <Trophy className="size-3" />
                السؤال الذهبي · نقاط ×2
              </Badge>
            )}
          </div>
          {!isRevealing ? (
            <CountdownRing remainingMs={remaining} totalMs={timePerQuestion} />
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

        {/* Second-chance banner: one retry after a wrong answer */}
        {canRetry && (
          <div className="relative mt-4 flex items-start gap-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-bold text-orange-700">
                إجابة خاطئة — لكن لديك فرصة ثانية! 🎯
              </p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-orange-700/80">
                جرّب إجابة أخرى خلال الوقت المتبقي — النقاط تُحتسب بنصف قيمتها.
              </p>
            </div>
          </div>
        )}

        {/* Automatic anti-cheat notice */}
        {cheatNotice && (
          <div className="relative mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
            <Eraser className="mt-0.5 size-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-bold text-rose-700">
                🚨 تم رصد مغادرة نافذة اللعب أثناء السؤال
              </p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-rose-700/80">
                {cheatNotice}
              </p>
            </div>
          </div>
        )}

        {/* Question */}
        <h2 className="relative mt-8 text-2xl font-bold leading-relaxed tracking-tight sm:text-[1.7rem]">
          {question.question}
        </h2>

        {/* Points + streak hint */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Zap className="size-3.5" />
            صحيحة = حتى {maxPoints} نقطة{isGolden ? " (مضاعفة!)" : ""}
          </span>
          {me.streak >= 1 && !isRevealing && (
            <span className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-600">
              <Flame className="size-3.5" />
              سلسلة {me.streak}
              {me.streak >= 2 && ` — مكافأة +${nextStreakBonus}`}
            </span>
          )}
        </div>

        {/* Options */}
        <div className="relative mt-6 grid gap-3">
          {question.options.map((option, i) => {
            const state = optionState(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => submit(i)}
                disabled={state !== "selectable" || submitting || timeUp}
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
                  state === "hidden" &&
                    "border-dashed border-border/60 bg-muted/30 text-muted-foreground/40",
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
                    state === "hidden" && "border-border/60 bg-muted text-muted-foreground/40",
                  )}
                >
                  {state === "hidden" ? (
                    <Eraser className="size-4" />
                  ) : (
                    OPTION_LETTERS[i]
                  )}
                </span>
                <span className={cn("flex-1", state === "hidden" && "line-through")}>
                  {state === "hidden" ? "إجابة مستبعدة" : option}
                </span>
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
            <div className="flex flex-wrap items-center gap-2">
              {myAnswer ? (
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
              )}
              {firstCorrectName && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-700">
                  <Zap className="size-3.5" />
                  أول إجابة صحيحة: {firstCorrectName} +50
                </span>
              )}
            </div>
          ) : timeUp ? (
            <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-bold text-muted-foreground">
              <Hourglass className="size-4" />
              انتهى الوقت!
            </span>
          ) : canRetry ? (
            <span className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-700">
              <RefreshCw className="size-4" />
              جرّب مرة أخرى — فرصتك الثانية متاحة الآن
            </span>
          ) : myAnswer ? (
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Check className="size-4 text-emerald-600" />
              تم تسجيل إجابتك — في انتظار البقية…
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              اختر إحدى الإجابات قبل انتهاء الوقت (أو استخدم المفاتيح 1–4)
            </span>
          )}
        </div>

        {/* Lifeline + progress */}
        <div className="relative mt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleFifty}
            disabled={fiftyLoading || fiftyUsed || !!myAnswer || isRevealing}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all",
              fiftyUsed
                ? "border-border/60 bg-muted/40 text-muted-foreground/50"
                : "border-primary/30 bg-primary/5 text-primary hover:border-primary/60 hover:bg-primary/10",
            )}
          >
            {fiftyLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eraser className="size-4" />
            )}
            منقّي 50/50
            <span className="rounded-full bg-muted px-1.5 text-[10px]">
              {fiftyUsed ? 0 : 1} / {LIFELINES_PER_GAME}
            </span>
          </button>

          <div className="flex flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {answeredCount}/{totalPlayers}
            </span>
          </div>
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
