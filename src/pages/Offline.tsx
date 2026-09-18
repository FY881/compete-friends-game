import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  OFFLINE_BANK,
  QUESTIONS_PER_STAGE,
  type OfflineQuestion,
} from "@/lib/offline-bank";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CloudOff,
  Home,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";

/**
 * 🛡 بلا إنترنت — وضع اللعب المُحصَّن (Offline Arena)
 *
 * الغاية: ألا تتوقف اللعبة **أبداً**. كل الأسئلة (360 سؤالاً على 50 مرحلة)
 * مضمّنة داخل التطبيق نفسه، والتقدّم يُحفظ في المتصفح. لا يمر أي شيء عبر
 * الشبكة ولا خادم Convex — صفر استدعاءات، صفر كلفة حصة، صفر انقطاع.
 *
 * هذا هو المسار الذي يستعمله اللاعب تلقائياً حين يكون الخادم غير متاح.
 */

const STORAGE_KEY = "mindclash.offline.v1";
const PASS_RATIO = 0.6; // ٦٠٪ لفتح المرحلة التالية

type SavedProgress = {
  /** أفضل نسبة لكل مرحلة (0-100) */
  best: Record<string, number>;
  /** أعلى مرحلة مفتوحة */
  unlocked: number;
};

const DEFAULT_PROGRESS: SavedProgress = { best: {}, unlocked: 1 };

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return {
      best: parsed.best && typeof parsed.best === "object" ? parsed.best : {},
      unlocked: typeof parsed.unlocked === "number" && parsed.unlocked >= 1 ? parsed.unlocked : 1,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function saveProgress(p: SavedProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* التخزين ممتلئ/محجوب — الجولة نفسها تعمل */
  }
}

const DIFFICULTY_LABEL: Record<OfflineQuestion["difficulty"], string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const DIFFICULTY_CLASS: Record<OfflineQuestion["difficulty"], string> = {
  easy: "text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400",
  medium: "text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-400",
  hard: "text-rose-700 border-rose-500/30 bg-rose-500/10 dark:text-rose-400",
};

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** يعيد ترتيب الخيارات مع تصحيح موضع الإجابة الصحيحة. */
function withShuffledOptions(q: OfflineQuestion): { options: string[]; correctIndex: number } {
  const pairs = q.options.map((text, i) => ({ text, correct: i === q.correctIndex }));
  const mixed = shuffle(pairs);
  return {
    options: mixed.map((p) => p.text),
    correctIndex: mixed.findIndex((p) => p.correct),
  };
}

export default function Offline() {
  const [progress, setProgress] = useState<SavedProgress>(DEFAULT_PROGRESS);
  const [openStage, setOpenStage] = useState<number | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // تجميع الأسئلة حسب المرحلة مرة واحدة
  const stages = useMemo(() => {
    const map = new Map<number, OfflineQuestion[]>();
    for (const q of OFFLINE_BANK) {
      const list = map.get(q.stage);
      if (list) list.push(q);
      else map.set(q.stage, [q]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([stage, questions]) => ({ stage, questions }));
  }, []);

  const bestOf = useCallback(
    (stage: number) => progress.best[String(stage)] ?? 0,
    [progress.best],
  );

  const handleFinish = useCallback(
    (stage: number, percent: number) => {
      setProgress((prev) => {
        const key = String(stage);
        const improved = percent > (prev.best[key] ?? 0);
        const next = {
          best: improved ? { ...prev.best, [key]: percent } : prev.best,
          unlocked:
            percent >= PASS_RATIO * 100 ? Math.max(prev.unlocked, stage + 1) : prev.unlocked,
        };
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  if (openStage !== null) {
    const entry = stages.find((s) => s.stage === openStage);
    if (entry) {
      return (
        <StageRun
          key={openStage}
          stage={entry.stage}
          questions={entry.questions}
          onExit={() => setOpenStage(null)}
          onFinish={handleFinish}
        />
      );
    }
  }

  const clearedCount = stages.filter((s) => bestOf(s.stage) >= PASS_RATIO * 100).length;
  const totalStars = stages.filter((s) => bestOf(s.stage) === 100).length;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* ── الترويسة ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="size-9" asChild>
            <Link to="/" aria-label="العودة للصفحة الرئيسية">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">ساحة الأوفلاين</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {OFFLINE_BANK.length} سؤالاً · {stages.length} مرحلة · تعمل بلا إنترنت
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
          >
            <CloudOff className="size-3" />
            بلا خادم
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* ── ملخص التقدّم ── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Zap className="size-4" />}
            label="مراحل مكتملة"
            value={`${clearedCount} / ${stages.length}`}
          />
          <StatCard
            icon={<Trophy className="size-4" />}
            label="إتقان تام (100%)"
            value={String(totalStars)}
          />
          <StatCard
            icon={<Sparkles className="size-4" />}
            label="مفتوحة الآن"
            value={String(Math.min(progress.unlocked, stages.length))}
          />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <CloudOff className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            هذا الوضع لا يلمس الخادم إطلاقاً — لا حساب ولا شبكة ولا حصة. تقدّمك محفوظ
            في متصفحك، وإنجازاتك الرسمية تُحفظ تلقائياً عند عودة الخادم.
            {" "}
            حقّق <span className="font-bold text-foreground">60%</span> لفتح المرحلة التالية.
          </p>
        </div>

        {/* ── خريطة المراحل ── */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map(({ stage, questions }) => {
            const best = bestOf(stage);
            const locked = stage > progress.unlocked;
            const cleared = best >= PASS_RATIO * 100;
            const perfect = best === 100;
            return (
              <button
                key={stage}
                type="button"
                disabled={locked}
                onClick={() => {
                  if (locked) {
                    toast.info(`أكمل المرحلة ${stage - 1} بنسبة 60% لفتح هذه المرحلة`);
                    return;
                  }
                  setOpenStage(stage);
                }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-4 text-start transition-all",
                  locked
                    ? "cursor-not-allowed border-dashed border-border/70 bg-muted/30 opacity-60"
                    : "border-border/70 bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                      perfect
                        ? "bg-amber-500/15 text-amber-600"
                        : cleared
                          ? "bg-emerald-500/15 text-emerald-600"
                          : locked
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary",
                    )}
                  >
                    {locked ? <Lock className="size-4" /> : perfect ? <Trophy className="size-4" /> : stage}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">المرحلة {stage}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {questions.length === QUESTIONS_PER_STAGE
                        ? `${questions.length} أسئلة`
                        : `${questions.length} أسئلة متاحة`}
                      {cleared && ` · أفضل نتيجة ${best}%`}
                      {locked && " · مقفلة"}
                    </p>
                  </div>
                  {!locked && (
                    <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                  )}
                </div>
                {!locked && best > 0 && (
                  <Progress value={best} className="mt-3 h-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-black tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🎯 جولة مرحلة واحدة — كل الحساب محلي، بلا أي استدعاء شبكة
// ═══════════════════════════════════════════════════════════════════════

type RunQuestion = {
  q: OfflineQuestion;
  options: string[];
  correctIndex: number;
};

function StageRun({
  stage,
  questions,
  onExit,
  onFinish,
}: {
  stage: number;
  questions: OfflineQuestion[];
  onExit: () => void;
  onFinish: (stage: number, percent: number) => void;
}) {
  const [run, setRun] = useState<RunQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [done, setDone] = useState(false);

  // تجهيز الجولة — ترتيب عشوائي للأسئلة والخيارات في كل محاولة
  useEffect(() => {
    setRun(
      shuffle(questions).map((q) => {
        const { options, correctIndex } = withShuffledOptions(q);
        return { q, options, correctIndex };
      }),
    );
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setXp(0);
    setDone(false);
  }, [questions]);

  const current = run[index];
  const total = run.length;

  const answer = (choice: number) => {
    if (picked !== null || !current) return;
    setPicked(choice);
    if (choice === current.correctIndex) {
      setCorrectCount((c) => c + 1);
      setXp((v) => v + current.q.reward);
    }
  };

  const next = () => {
    if (picked === null || !current) return;
    const isLast = index + 1 >= total;
    if (isLast) {
      setDone(true);
      const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      onFinish(stage, percent);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  const restart = () => {
    setRun(
      shuffle(questions).map((q) => {
        const { options, correctIndex } = withShuffledOptions(q);
        return { q, options, correctIndex };
      }),
    );
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setXp(0);
    setDone(false);
  };

  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = percent >= PASS_RATIO * 100;

  // ── شاشة النتيجة ──
  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
          <Card
            className={cn(
              "border-2 shadow-sm",
              passed ? "border-emerald-500/40" : "border-amber-500/40",
            )}
          >
            <CardHeader className="items-center text-center">
              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-2xl text-3xl",
                  passed ? "bg-emerald-500/15" : "bg-amber-500/15",
                )}
              >
                {percent === 100 ? "🏆" : passed ? "✅" : "💪"}
              </span>
              <CardTitle className="mt-3 text-xl">
                {percent === 100 ? "إتقان تام!" : passed ? "أحسنت — المرحلة مكتملة" : "محاولة جيدة"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                المرحلة {stage} · {passed ? "فتحت المرحلة التالية" : "تحتاج 60% لفتح التالية"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">النتيجة</p>
                  <p className="text-xl font-black tabular-nums">{percent}%</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">صحيحة</p>
                  <p className="text-xl font-black tabular-nums">
                    {correctCount}/{total}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">نقاط خبرة</p>
                  <p className="text-xl font-black tabular-nums text-primary">{xp}</p>
                </div>
              </div>

              <Progress value={percent} className="h-2" />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1 gap-2" onClick={restart}>
                  <RotateCcw className="size-4" />
                  أعد المحاولة
                </Button>
                {passed && (
                  <Button
                    variant="secondary"
                    className="flex-1 gap-2"
                    onClick={() => {
                      onExit();
                    }}
                  >
                    <ChevronLeft className="size-4" />
                    اختر المرحلة التالية
                  </Button>
                )}
                <Button variant="outline" className="flex-1 gap-2" onClick={onExit}>
                  <Home className="size-4" />
                  خريطة المراحل
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ── شاشة اللعب ──
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="size-9" onClick={onExit} aria-label="خروج">
            <X className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">المرحلة {stage}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              السؤال {Math.min(index + 1, total)} من {total} · صحيحة {correctCount}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px] tabular-nums">
            {xp} XP
          </Badge>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-3 sm:px-6">
          <Progress value={total > 0 ? ((index + (picked !== null ? 1 : 0)) / total) * 100 : 0} className="h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {current ? (
          <div className="space-y-4">
            <Card className="border-border/70 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {current.q.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("rounded-full text-[10px]", DIFFICULTY_CLASS[current.q.difficulty])}
                  >
                    {DIFFICULTY_LABEL[current.q.difficulty]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[10px] tabular-nums">
                    +{current.q.reward} XP
                  </Badge>
                </div>
                <p className="mt-3 text-base font-bold leading-relaxed">{current.q.question}</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 sm:grid-cols-2">
              {current.options.map((option, i) => {
                const revealed = picked !== null;
                const isCorrect = revealed && current.correctIndex === i;
                const isWrongPick = revealed && picked === i && current.correctIndex !== i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revealed}
                    onClick={() => answer(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-start text-sm font-semibold transition-all disabled:cursor-not-allowed",
                      isCorrect
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : isWrongPick
                          ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                      {["أ", "ب", "ج", "د"][i] ?? i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{option}</span>
                    {isCorrect && <Check className="size-4 shrink-0" />}
                    {isWrongPick && <X className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                  picked === current.correctIndex
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-rose-500/40 bg-rose-500/10",
                )}
              >
                <p className="text-sm font-bold">
                  {picked === current.correctIndex ? "✅ إجابة صحيحة" : "❌ إجابة خاطئة"}
                </p>
                <Button size="sm" className="gap-1.5" onClick={next}>
                  {index + 1 >= total ? "إنهاء المرحلة" : "السؤال التالي"}
                  <ChevronLeft className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <p className="text-sm text-muted-foreground">جارٍ تجهيز الأسئلة…</p>
          </div>
        )}
      </main>
    </div>
  );
}
