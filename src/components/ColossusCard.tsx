import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Swords,
  Loader2,
  Skull,
  Flame,
  Shield,
  Target,
  Check,
  X,
  Crown,
} from "lucide-react";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/question-difficulty";

/**
 * 👹 الطاغوت — العدو الجماعي الحي الذي يتعلم من دقة المجتمع.
 * كل أسبوع: ترسانة تكيفية، فخاخ في فئات القوة، ومكافآت مضاعفة على نقاط ضعفه.
 */

type StrikeQuestion = {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
};

type StrikeResult = {
  correct: number;
  total: number;
  damage: number;
  hpLeft: number;
  defeated: boolean;
  details: { questionId: string; correct: boolean; correctIndex: number; damage: number }[];
};

const QUESTIONS_N = 5;

export function ColossusCard() {
  const state = useQuery(api.aiColossus.getCurrent, {});
  const getStrikeQuestions = useQuery(
    api.aiColossus.getStrikeQuestions,
    state?.season !== undefined ? { season: state.season } : "skip",
  );
  const submitStrikeMutation = useMutation(api.aiColossus.submitStrike);
  const [fighting, setFighting] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<StrikeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const beginFight = () => {
    setPicked({});
    setResult(null);
    setStartTime(Date.now());
    setFighting(true);
  };

  const strike = async () => {
    if (!state || !startTime) return;
    const answered = Object.keys(picked).length;
    if (answered < QUESTIONS_N) {
      toast.error(`أجب على كل ${QUESTIONS_N} أسئلة الضربة أولاً.`);
      return;
    }
    setSubmitting(true);
    try {
      const questions = getStrikeQuestions?.questions ?? [];
      const answers = questions.map((q) => ({
        questionId: q.id,
        selected: picked[q.id] ?? -1,
        elapsedMs: Date.now() - startTime,
      }));
      const res = await submitStrikeMutation({
        season: state.season,
        answers,
      });
      setResult(res);
      if (res.defeated) {
        toast.success(`⚔️ سقط ${state.name}! شاركت في الإسقاط — 100 نقطة ولاء مكافأة!`);
      } else {
        toast.success(`ضربة مؤلمة: ${res.damage} ضرر — متبقي ${res.hpLeft} من صحته`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تسجيل الضربة.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> الطاغوت يستيقظ…
        </CardContent>
      </Card>
    );
  }

  if (state === null || state.hpLeft <= 0) {
    return (
      <Card dir="rtl" className="border-border/60">
        <CardContent className="p-6 text-center">
          <Crown className="mx-auto size-8 text-amber-500" />
          <p className="mt-2 text-sm font-bold">
            {state?.name ?? "الطاغوت"} {state ? "سقط هذا الموسم" : "قادم قريباً"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {state
              ? `أطاح به المجتمع بـ ${state.damageTaken} نقطة ضرر من ${state.fightersCount} مقاتل — موسم جديد يتشكل بذكاء أكبر…`
              : "سيقرأ دقة مجتمعكم ويبني ترسانته القادمة تكيفياً."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const hpPercent = Math.round((state.hpLeft / state.hp) * 100);
  const questions: StrikeQuestion[] = getStrikeQuestions?.questions ?? [];
  const canFight = state.myStrikesLeft > 0 && !result;

  return (
    <Card dir="rtl" className="overflow-hidden border-rose-500/30 bg-gradient-to-b from-rose-500/[0.05] to-transparent">
      <CardContent className="p-0">
        {/* ترويسة الطاغوت */}
        <div className="border-b border-rose-500/20 bg-rose-500/[0.07] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
              <Skull className="size-5 text-rose-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-black">
                {state.name}
                <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                  موسم {state.season % 1000}
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] italic leading-relaxed text-rose-700">
                «{state.taunt}»
              </p>
            </div>
          </div>

          {/* شريط الصحة */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-rose-700">صحة الطاغوت</span>
              <span className="tabular-nums text-muted-foreground">
                {state.hpLeft} / {state.hp}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-rose-950/20">
              <div
                className="h-full rounded-full bg-gradient-to-l from-rose-600 to-orange-500 transition-all duration-500"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            {state.weaknesses.map((w) => (
              <Badge key={w} variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                <Target className="me-0.5 size-2.5" /> ضعفه: {w} (ضرر ×2)
              </Badge>
            ))}
            <Badge variant="outline" className="rounded-full">
              {state.fightersCount} مقاتل
            </Badge>
          </div>
        </div>

        {/* الشجعان */}
        {state.topSlayers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2">
            <Flame className="size-3.5 text-orange-600" />
            {state.topSlayers.map((s, i) => (
              <span key={i} className="text-[10px] font-bold">
                {i === 0 && "🥇 "}
                {s.name} ({s.damage})
              </span>
            ))}
          </div>
        )}

        <div className="p-4">
          {/* زر الضربة */}
          {!fighting && canFight && (
            <Button
              onClick={beginFight}
              className="w-full gap-2 rounded-xl bg-rose-600 py-5 text-sm font-black text-white hover:bg-rose-700"
            >
              <Swords className="size-5" />
              اضرب الطاغوت ({state.myStrikesLeft} ضربات متبقية)
            </Button>
          )}
          {!canFight && !result && (
            <p className="text-center text-[11px] text-muted-foreground">
              استنفدت ضرباتك اليوم — عد غداً بذكاء أكبر ⚔️
            </p>
          )}

          {/* أسئلة الضربة */}
          {fighting && !result && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-rose-700">
                ⚔️ ضربة جارية — {QUESTIONS_N} أسئلة من ترسانته التكيفية
              </p>
              {questions.map((q, qi) => {
                const chosen = picked[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-border/60 bg-card p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="text-rose-600">{qi + 1}.</span> {q.question}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="outline" className="rounded-full text-[9px]">
                        {q.category}
                      </Badge>
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
                            chosen === oi
                              ? "border-rose-500/60 bg-rose-500/10 font-bold"
                              : "border-border/60 bg-background hover:border-rose-500/40",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <Button
                onClick={strike}
                disabled={submitting || Object.keys(picked).length < QUESTIONS_N}
                className="w-full gap-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                أطلق الضربة!
              </Button>
            </div>
          )}

          {/* النتيجة */}
          {result && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-4 text-center">
              {result.defeated ? (
                <>
                  <Crown className="mx-auto size-8 text-amber-500" />
                  <p className="mt-1.5 text-sm font-black text-amber-700">
                    ⚔️ سقط الطاغوت! كنت جزءاً من الأسطورة
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-rose-700">نتيجة ضربتك</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {result.correct}/{result.total} صحيحة · ضرر {result.damage} · متبقي {result.hpLeft}
                  </p>
                </>
              )}
              <div className="mt-3 grid gap-1.5 text-start sm:grid-cols-2">
                {result.details.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px]",
                      d.correct
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-700",
                    )}
                  >
                    {d.correct ? <Check className="size-3" /> : <X className="size-3" />}
                    ضرر: {d.damage}
                  </div>
                ))}
              </div>
              {state.myStrikesLeft > 0 && (
                <Button size="sm" variant="outline" onClick={beginFight} className="mt-3 h-8 rounded-xl text-xs">
                  ضربة أخرى ({state.myStrikesLeft})
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
