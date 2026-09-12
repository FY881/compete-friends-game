import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Zap, Shield, Dices, Skull, Play, Loader2, Clock, Check, X, Trophy, Flame, Crown } from "lucide-react";

/**
 * 🎮 الأوضاع السريعة — برق، بقاء، رهان، ومعركة الزعيم اليومية.
 * كل النتائج تُحسب على الخادم: لا تزوير للأسئلة ولا للدرجة ولا للمكافأة.
 */

type ModeKind = "blitz" | "survival" | "bet";

type Question = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
};

type Finished = {
  score: number;
  correctCount: number;
  survived: number;
  payout?: number;
  won?: boolean;
};

type RunState = {
  runId: Id<"modeRuns">;
  kind: ModeKind;
  stake?: number | null;
  winTarget: number | null;
  perQuestionMs: number;
  endsAt: number;
  questions: Question[];
  index: number;
  questionStartedAt: number;
  score: number;
  correctCount: number;
  survived: number;
  finished: Finished | null;
};

type Feedback = {
  index: number;
  correct: boolean;
  correctIndex: number;
  score: number;
  correctCount: number;
  survived: number;
  finish: Finished | null;
};

const MODE_META: Record<ModeKind, { title: string; sub: string; icon: typeof Zap; tint: string }> = {
  blitz: {
    title: "تحدي البرق ⚡",
    sub: "60 ثانية · 5 ثوانٍ للسؤال · أقصى درجة ممكنة",
    icon: Zap,
    tint: "text-amber-600 bg-amber-500/15 border-amber-500/30",
  },
  survival: {
    title: "البقاء 🛡️",
    sub: "الصعوبة تتصاعد · خطأ واحد يُنهي جولتك",
    icon: Shield,
    tint: "text-emerald-600 bg-emerald-500/15 border-emerald-500/30",
  },
  bet: {
    title: "جولة الرهان 🎲",
    sub: "راهن بنقاط ولاء حقيقية · 7/10 صحيحة تُضاعف رهانك",
    icon: Dices,
    tint: "text-fuchsia-600 bg-fuchsia-500/15 border-fuchsia-500/30",
  },
};

function ModeLeaderboard({ kind }: { kind: ModeKind }) {
  const rows = useQuery(api.gameModes.getModeLeaderboard, { kind });
  if (rows === undefined) return null;
  if (rows.length === 0) {
    return <p className="py-3 text-center text-xs text-muted-foreground">لا نتائج بعد — كن أول الأبطال!</p>;
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={r.userId} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              i === 0 ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className="shrink-0 text-base">{r.emoji}</span>
          <span className="flex-1 truncate font-semibold">{r.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {r.score} · {r.correctCount} صحيحة
          </span>
        </div>
      ))}
    </div>
  );
}

export function GameModesPanel() {
  const state = useQuery(api.gameModes.getModeState, {});
  const boss = useQuery(api.gameModes.getBoss, {});
  const startRun = useMutation(api.gameModes.startRun);
  const submitModeAnswer = useMutation(api.gameModes.submitModeAnswer);
  const fightBoss = useMutation(api.gameModes.fightBoss);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ModeKind>("blitz");
  const [stake, setStake] = useState(100);
  const [run, setRun] = useState<RunState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bossBusy, setBossBusy] = useState(false);
  const [bossPick, setBossPick] = useState<number | null>(null);
  const [bossResult, setBossResult] = useState<{
    correct: boolean;
    correctIndex: number;
    first: boolean;
    reward: number;
  } | null>(null);

  const busyRef = useRef(false);
  const settlingRef = useRef(false);

  // ساعة حيّة لدقّات الوقت
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(t);
  }, []);

  const sendAnswer = async (selected: number) => {
    if (!run || run.finished || busyRef.current) return;
    const question = run.questions[run.index];
    if (!question) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await submitModeAnswer({
        runId: run.runId,
        questionId: question.id,
        selected,
        elapsedMs: Date.now() - run.questionStartedAt,
      });
      setFeedback({
        index: run.index,
        correct: res.correct,
        correctIndex: res.correctIndex,
        score: res.score,
        correctCount: res.correctCount,
        survived: res.survived,
        finish: res.done
          ? {
              score: res.score,
              correctCount: res.correctCount,
              survived: res.survived,
              payout: res.payout,
              won: res.won,
            }
          : null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الإجابة");
      settlingRef.current = false;
      setRun(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // عرض النتيجة لحظة، ثم الانتقال للسؤال التالي (أو إعلان النهاية)
  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => {
      setRun((prev) => {
        if (!prev) return prev;
        if (feedback.finish) {
          return {
            ...prev,
            score: feedback.score,
            correctCount: feedback.correctCount,
            finished: feedback.finish,
          };
        }
        return {
          ...prev,
          index: prev.index + 1,
          score: feedback.score,
          correctCount: feedback.correctCount,
          survived: feedback.survived,
          questionStartedAt: Date.now(),
        };
      });
      setFeedback(null);
    }, 900);
    return () => window.clearTimeout(t);
  }, [feedback]);

  // انتهاء وقت السؤال تلقائياً
  useEffect(() => {
    if (!run || run.finished || feedback || busy) return;
    if (now - run.questionStartedAt >= run.perQuestionMs) {
      void sendAnswer(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, run, feedback, busy]);

  // انتهاء الزمن الكلي للجولة (نافذة الـ60 ثانية في البرق)
  useEffect(() => {
    if (!run || run.finished || busy || settlingRef.current) return;
    if (now >= run.endsAt) {
      settlingRef.current = true;
      void sendAnswer(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, run, busy]);

  const launch = async (kind: ModeKind) => {
    setBusy(true);
    try {
      const res = await startRun({ kind, stake: kind === "bet" ? Math.floor(stake) : undefined });
      settlingRef.current = false;
      setFeedback(null);
      setRun({
        runId: res.runId,
        kind,
        stake: res.stake ?? null,
        winTarget: res.winTarget ?? null,
        perQuestionMs: res.perQuestionMs,
        endsAt: res.endsAt,
        questions: res.questions as Question[],
        index: 0,
        questionStartedAt: Date.now(),
        score: 0,
        correctCount: 0,
        survived: 0,
        finished: null,
      });
      setNow(Date.now());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر بدء الجولة");
    } finally {
      setBusy(false);
    }
  };

  const submitBoss = async () => {
    if (bossPick === null || bossBusy) return;
    setBossBusy(true);
    try {
      const res = await fightBoss({ selected: bossPick, elapsedMs: 0 });
      setBossResult({
        correct: res.correct,
        correctIndex: res.correctIndex,
        first: res.first,
        reward: res.reward,
      });
      if (res.correct) {
        toast.success(
          res.first
            ? `👑 أول من أسقط زعيم اليوم! +${res.reward} نقطة ولاء`
            : `👹 أسقطت الزعيم! +${res.reward} نقطة ولاء`,
        );
      } else {
        toast.error("الزعيم صمد… عد غداً 👹");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّرت المحاولة");
    } finally {
      setBossBusy(false);
    }
  };

  if (!state || !boss) return null;

  const current = run && !run.finished ? run.questions[run.index] : null;
  const remaining = run ? Math.max(0, run.endsAt - now) : 0;
  const qRemaining = run ? Math.max(0, run.perQuestionMs - (now - run.questionStartedAt)) : 0;
  const meta = MODE_META[tab];

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-5 text-start transition-colors hover:bg-muted/40"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-fuchsia-500/20 text-amber-600">
          <Flame className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">الأوضاع السريعة</p>
          <p className="text-[11px] text-muted-foreground">
            ⚡ برق · 🛡️ بقاء · 🎲 رهان · 👹 زعيم اليوم — نتائج موثّقة على الخادم
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
          {open ? "إغلاق" : "العب"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/60 p-5">
          {!run && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(MODE_META) as ModeKind[]).map((kind) => {
                  const m = MODE_META[kind];
                  const Icon = m.icon;
                  const active = tab === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setTab(kind)}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border p-3 text-start transition-all",
                        active ? m.tint : "border-border/60 bg-card hover:bg-muted/40",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{m.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          الأفضل: {state[kind].bestScore}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-bold">{meta.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{meta.sub}</p>

                {tab === "bet" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={state.betMin}
                        max={state.betMax}
                        value={stake}
                        onChange={(e) => setStake(Number(e.target.value))}
                        className="h-9 w-28"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        من {state.betMin} إلى {state.betMax} · رصيدك {state.points} نقطة
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {[50, 100, 250, 500].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setStake(v)}
                          className="rounded-full border border-border/60 px-3 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => void launch(tab)}
                    disabled={busy || (tab === "bet" && state.points < state.betMin)}
                    className="gap-2"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    ابدأ {meta.title}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    جولات سابقة: {state[tab].plays}
                    {tab === "bet" ? ` · انتصارات الرهان: ${state.betWins}` : ""}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold">
                  <Trophy className="size-3.5 text-amber-500" /> صدارة {meta.title}
                </div>
                <ModeLeaderboard kind={tab} />
              </div>
            </>
          )}

          {/* ── منطقة اللعب ── */}
          {run && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-muted px-3 py-1">{MODE_META[run.kind].title}</span>
                <span className="rounded-full bg-muted px-3 py-1">
                  السؤال {Math.min(run.index + 1, run.questions.length)} / {run.questions.length}
                </span>
                <span className="rounded-full bg-muted px-3 py-1">النقاط: {run.score}</span>
                {run.kind !== "survival" && (
                  <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-sky-600">
                    <Clock className="size-3" /> {Math.ceil(remaining / 1000)}ث
                  </span>
                )}
                {run.kind === "bet" && run.stake ? (
                  <span className="rounded-full bg-fuchsia-500/10 px-3 py-1 text-fuchsia-600">
                    رهانك: {run.stake} · الهدف {run.winTarget}/10
                  </span>
                ) : null}
              </div>

              {!run.finished && (
                <div className="space-y-1">
                  <Progress value={(qRemaining / run.perQuestionMs) * 100} className="h-1.5" />
                  <p className="text-end text-[10px] text-muted-foreground">
                    {Math.ceil(qRemaining / 1000)} ثانية للسؤال
                  </p>
                </div>
              )}

              {run.finished ? (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "rounded-2xl border p-5 text-center",
                      run.kind === "bet"
                        ? run.finished.won
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-rose-500/30 bg-rose-500/10"
                        : "border-amber-500/30 bg-amber-500/10",
                    )}
                  >
                    <p className="text-lg font-black">
                      {run.kind === "bet"
                        ? run.finished.won
                          ? "🎲 ربحت الرهان!"
                          : "😖 خسرت الرهان"
                        : run.kind === "survival"
                          ? `🛡️ صمدت مع ${run.finished.survived} إجابة`
                          : `⚡ ${run.finished.score} نقطة`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      إجابات صحيحة: {run.finished.correctCount}
                      {run.kind === "bet"
                        ? run.finished.won
                          ? ` · عائد ${run.finished.payout} نقطة`
                          : ` · خسرت ${run.stake} نقطة`
                        : " · أُضيفت مكافأة الولاء تلقائياً"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setRun(null);
                      settlingRef.current = false;
                    }}
                  >
                    العودة إلى الأوضاع
                  </Button>
                </div>
              ) : current ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {current.category} ·{" "}
                      {current.difficulty === "hard"
                        ? "صعب"
                        : current.difficulty === "medium"
                          ? "متوسط"
                          : "سهل"}
                    </p>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{current.question}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {current.options.map((opt, i) => {
                      const revealed = feedback !== null && feedback.index === run.index;
                      const isRight = revealed && feedback.correctIndex === i;
                      const isWrongPick = revealed && feedback.correctIndex !== i && !feedback.correct;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={busy || feedback !== null}
                          onClick={() => void sendAnswer(i)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-3 text-start text-sm font-semibold transition-all disabled:cursor-not-allowed",
                            isRight
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700"
                              : isWrongPick
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
                                : "border-border/60 bg-card hover:border-amber-500/40 hover:bg-muted/40",
                          )}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                          {isRight && <Check className="size-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {feedback && (
                    <p className="text-center text-xs font-bold">
                      {feedback.correct ? (
                        <span className="text-emerald-600">✅ إجابة صحيحة!</span>
                      ) : (
                        <span className="text-rose-600">❌ إجابة خاطئة</span>
                      )}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRun(null);
                      settlingRef.current = false;
                    }}
                    className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    انسحاب من الجولة
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* ── معركة الزعيم ── */}
          {!run && (
            <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-card p-4">
              <div className="flex items-center gap-2">
                <Skull className="size-4 shrink-0 text-rose-600" />
                <p className="text-sm font-bold">معركة الزعيم اليومية</p>
                {boss.firstSolverName && (
                  <span className="ms-auto flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
                    <Crown className="size-3" /> أول من حلّه: {boss.firstSolverName}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                محاولة واحدة فقط في اليوم · {boss.solversCount} أسقطوه · {boss.attemptsCount} حاولوا
              </p>

              {boss.myAttempt ? (
                <div
                  className={cn(
                    "mt-3 rounded-xl border p-4 text-center text-sm font-bold",
                    boss.myAttempt.correct
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-600",
                  )}
                >
                  {boss.myAttempt.correct ? "✅ أسقطت زعيم اليوم" : "❌ حاولت وخسرت — عُد غداً"}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {boss.question.category} · عنيد جداً
                    </p>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{boss.question.question}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {boss.question.options.map((opt, i) => {
                      const revealed = bossResult !== null;
                      const isRight = revealed && bossResult.correctIndex === i;
                      const isWrong =
                        revealed && bossResult.correctIndex !== i && bossPick === i && !bossResult.correct;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={bossBusy || revealed}
                          onClick={() => setBossPick(i)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-3 text-start text-sm font-semibold transition-all disabled:cursor-not-allowed",
                            isRight
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700"
                              : isWrong
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
                                : bossPick === i && !revealed
                                  ? "border-rose-500/50 bg-rose-500/10"
                                  : "border-border/60 bg-card hover:bg-muted/40",
                          )}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!bossResult && (
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      disabled={bossPick === null || bossBusy}
                      onClick={() => void submitBoss()}
                    >
                      {bossBusy ? <Loader2 className="size-4 animate-spin" /> : <Skull className="size-4" />}
                      هاجم الزعيم
                    </Button>
                  )}
                  {bossResult && !bossResult.correct && (
                    <p className="flex items-center justify-center gap-1 text-center text-xs font-bold text-rose-600">
                      <X className="size-3.5" /> الزعيم صمد — غداً زعيم جديد
                    </p>
                  )}
                  {bossResult?.correct && (
                    <p className="text-center text-xs font-bold text-emerald-600">
                      {bossResult.first ? "👑 أنت أول من أسقطه اليوم! " : "🏅 "}+{bossResult.reward} نقطة ولاء
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
