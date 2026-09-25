import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DIFFICULTY_BASE_POINTS,
  DIFFICULTY_SPEED_BONUS,
  MAX_STREAK_BONUS,
  STREAK_BONUS_PER_STEP,
} from "@/convex/gameConfig";
import type { GameData, PlayerInfo } from "@/convex/games";
import { sounds } from "@/lib/sounds";
import { ANSWER_MS, COUNTDOWN_MS, LIFELINES_PER_GAME } from "@/lib/game-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain,
  Check,
  Eraser,
  Flame,
  Hourglass,
  Loader2,
  RefreshCw,
  Sparkles,
  Lightbulb,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Leaderboard } from "./Leaderboard";
import { useNow } from "./ui";

const OPTION_LETTERS = ["أ", "ب", "ج", "د"];

/** mm:ss — used by the round clock in timed matches. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  extreme: {
    label: "شبه مستحيل",
    badge: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700",
    dot: "bg-fuchsia-500",
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
  const submitRef = useRef<(idx: number) => void>(() => {});
  const now = useNow(200);
  const prevPhase = useRef(game.game.phase);

  const g = game.game;
  const index = g.currentQuestionIndex;
  const question = game.questions[index];
  const phase = g.phase;
  // Timed rounds («مدة الجولة»): the round clock counts down from the chosen
  // minutes while questions keep flowing — the server stops the match at 0.
  const durationMinutes = g.settings?.durationMinutes ?? 0;
  const roundEndsAt = g.roundEndsAt ?? 0;
  const isTimedRound = durationMinutes > 0 && roundEndsAt > 0;
  const roundLeftMs = roundEndsAt - now;
  // Fallbacks for legacy rooms: settings/questionStartedAt may be missing on
  // very old game rows — never let that crash the game screen.
  const startedAt = g.questionStartedAt || now;
  const timePerQuestion = g.settings?.timePerQuestionMs ?? ANSWER_MS;
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
  const countdownLeft = isCountdown ? startedAt - now : 0;
  const countdownNumber = Math.max(0, Math.ceil(countdownLeft / 1000));

  // Golden question: the last question of the round doubles all points.
  const isGolden = question?.golden ?? false;
  const firstCorrectId = g.firstCorrect[index];
  const firstCorrectName = firstCorrectId
    ? game.players.find((p) => p.id === firstCorrectId)?.name ?? null
    : null;

  // AI Hint hooks — MUST be before any early returns (React Rules of Hooks)
  const getAiHint = useAction(api.openRouter.getAiHint);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  // Fresh lifeline + cheat notice state for every question.
  useEffect(() => {
    setHiddenOptions([]);
    setCheatNotice(null);
  }, [index]);

  // Anti-cheat: leaving the game window during a question is treated as using
  // the internet to look up the answer. The server applies an automatic,
  // escalating punishment (warn → score penalty → ban).
  //
  // FIX: Much more tolerant to prevent false positives:
  // - 5 second delay (was 1.5s) — allows accidental tab switches
  // - Max 3 detections per game — after that, the player is flagged once
  // - Only fires during "answering" phase when player hasn't answered yet
  // - Resets on focus (cancels pending detection)
  const cheatDetections = useRef(0);
  useEffect(() => {
    if (phase !== "answering" || myAnswer) return;
    if (reportedFor.current === index) return;
    // Max 3 cheat detections per game — after that, stop checking
    if (cheatDetections.current >= 3) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const detect = () => {
      const away = document.hidden || !document.hasFocus();
      if (!away || reportedFor.current === index) return;
      // 5 second delay — only flag sustained absence (not momentary flickers)
      timer = setTimeout(() => {
        if (reportedFor.current === index) return;
        // Double-check: if user came back during the 5s, cancel
        if (!document.hidden && document.hasFocus()) return;
        reportedFor.current = index;
        cheatDetections.current++;
        recordCheat({ code: g.code })
          .then((result) => {
            if (result) setCheatNotice(result.message);
          })
          .catch(() => undefined);
      }, 5000);
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

  // Keyboard shortcuts: 1–4 pick an option.
  useEffect(() => {
    if (isRevealing || timeUp) return;
    if (myAnswer && !canRetry) return;
    const handler = (event: KeyboardEvent) => {
      const num = parseInt(event.key, 10);
      if (num >= 1 && num <= 4 && !hiddenOptions.includes(num - 1)) {
        void submitRef.current(num - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealing, myAnswer, timeUp, hiddenOptions, submitting, question]);

  if (!question) {
    return null;
  }

  // ── 3-2-1 countdown before the first question — شاشة بدء حديثة كاملة ──
  if (isCountdown) {
    return (
      <div className="relative flex w-full flex-col items-center justify-center gap-10 overflow-hidden rounded-3xl border border-border/80 bg-card py-20 text-center shadow-xl shadow-primary/5 sm:py-28">
        {/* توهجات خلفية حية */}
        <div aria-hidden className="pointer-events-none absolute -top-32 start-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 end-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <Badge variant="outline" className="relative gap-1.5 rounded-full border-primary/40 bg-primary/5 text-primary">
          <Brain className="size-3.5" />
          استعدوا لمعركة العقول
        </Badge>

        <div className="relative flex size-52 items-center justify-center">
          {/* حلقة نابضة مزدوجة */}
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/10" style={{ animationDuration: "1.6s" }} />
          <CountdownRing remainingMs={countdownLeft} totalMs={COUNTDOWN_MS} />
          <span
            key={countdownNumber}
            className="absolute bg-gradient-to-b from-primary to-primary/60 bg-clip-text text-8xl font-black tabular-nums tracking-tight text-transparent"
            style={{ animation: "countdown-pop 0.5s cubic-bezier(0.22,1,0.36,1)" }}
          >
            {countdownNumber}
          </span>
        </div>

        <div className="relative">
          <p className="text-xl font-black tracking-tight">تحميل الأسئلة اكتمل — جاهز؟</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            نفس السؤال · نفس الوقت · أسرع عقل يفوز
          </p>
        </div>

        {/* شريط تجهيز المشاركين */}
        <div className="relative flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-2">
          <Users className="size-3.5 text-primary" />
          <span className="text-xs font-semibold tabular-nums">
            {totalPlayers} عقل في الحلبة
          </span>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full bg-primary"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        </div>

        <style>{`
          @keyframes countdown-pop {
            0% { transform: scale(1.6); opacity: 0; }
            60% { transform: scale(0.95); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
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
  submitRef.current = submit;

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

  const handleAiHint = async () => {
    if (hintLoading || hintUsed || myAnswer || isRevealing) return;
    setHintLoading(true);
    try {
      // التلميح يجري عبر نظامي مركز API على الخادم — لا مفتاح من المتصفح
      const res = await getAiHint({
        apiKey: "",
        question: question.question,
        options: question.options,
        difficulty: question.difficulty,
      });
      setAiHint(res.hint);
      setHintUsed(true);
      sounds.lifeline();
    } catch (e) {
      console.error(e);
      toast.error("تعذر الحصول على تلميح AI");
    } finally {
      setHintLoading(false);
    }
  };

  const difficultyStyle =
    DIFFICULTY_STYLES[question.difficulty] ?? DIFFICULTY_STYLES.medium;
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
  const timeFraction = Math.max(0, Math.min(1, remaining / timePerQuestion));

  return (
    <div className="grid w-full items-start gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Question card — تصميم حديث: خلفية حية + شريط زمن علوي عريض */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-lg shadow-primary/5 sm:shadow-xl">
        {/* شريط الوقت الحي أعلى البطاقة — يشحب مع اقتراب النهاية */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-muted/60">
          <div
            className={cn(
              "h-full transition-[width] duration-200 ease-linear",
              timeFraction > 0.5 && "bg-gradient-to-r from-emerald-400 to-emerald-500",
              timeFraction <= 0.5 && timeFraction > 0.25 && "bg-gradient-to-r from-amber-400 to-amber-500",
              timeFraction <= 0.25 && "bg-gradient-to-r from-rose-400 to-rose-500",
            )}
            style={{ width: `${isRevealing ? 100 : timeFraction * 100}%` }}
          />
        </div>
        {/* توهج خلفي حي يشتد مع الوقت الحرِج */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-24 start-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-500",
            timeFraction <= 0.25 && !isRevealing ? "bg-rose-500/20 opacity-100" : "bg-primary/10 opacity-70",
          )}
          style={{ animation: timeFraction <= 0.25 && !isRevealing ? "pulse 1.2s ease-in-out infinite" : undefined }}
        />
        <div className="p-7 pt-9 sm:p-9 sm:pt-11">

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
            {isTimedRound ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700",
                  roundLeftMs <= 60_000 && roundLeftMs > 0 &&
                    "border-rose-500/40 bg-rose-500/10 text-rose-700",
                )}
              >
                <Hourglass className="size-3" />
                {roundLeftMs > 0
                  ? `متبقي ${formatClock(roundLeftMs)}`
                  : "انتهى الوقت — جارٍ الإنهاء"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5">
                السؤال {index + 1} من {g.questionCount}
              </Badge>
            )}
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

        {/* AI Hint display */}
        {aiHint && (
          <div className="relative mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-amber-700">تلميح AI 🤖</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-700/80">{aiHint}</p>
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
                  "group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4 text-start text-base font-medium transition-all duration-200",
                  "hover:shadow-md active:scale-[0.995]",
                  state === "selectable" &&
                    "border-border/80 bg-background text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10",
                  state === "picked" &&
                    "border-primary/60 bg-primary/10 text-primary shadow-md shadow-primary/15 ring-1 ring-primary/30",
                  state === "correct" &&
                    "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 shadow-md shadow-emerald-500/10",
                  state === "wrong" &&
                    "border-rose-500/60 bg-rose-500/10 text-rose-700",
                  state === "idle" && "border-border/60 bg-muted/40 text-muted-foreground",
                  state === "hidden" &&
                    "border-dashed border-border/60 bg-muted/30 text-muted-foreground/40",
                )}
              >
                {/* شريط حرف سفلي للخيار الصحيح عند الكشف */}
                {state === "correct" && (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
                )}
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

          <button
            type="button"
            onClick={handleAiHint}
            disabled={hintLoading || hintUsed || !!myAnswer || isRevealing}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all",
              hintUsed
                ? "border-border/60 bg-muted/40 text-muted-foreground/50"
                : "border-amber-500/30 bg-amber-500/5 text-amber-600 hover:border-amber-500/60 hover:bg-amber-500/10",
            )}
          >
            {hintLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            تلميح AI
            <span className="rounded-full bg-muted px-1.5 text-[10px]">
              {hintUsed ? 0 : 1} / 1
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
      </div>

      {/* Live leaderboard */}
      <div className="lg:sticky lg:top-6">
        <Leaderboard players={game.players} compact />
        {isRevealing && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/8 to-transparent p-5 text-center shadow-sm">
            <div aria-hidden className="pointer-events-none absolute -top-10 start-1/2 h-20 w-48 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl" />
            <p className="relative text-sm font-bold">
              {index + 1 >= g.questionCount ? "جارٍ احتساب النتائج النهائية…" : `السؤال ${index + 2} من ${g.questionCount} قادم…`}
            </p>
            <div className="relative mt-2 flex justify-center gap-1.5">
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
