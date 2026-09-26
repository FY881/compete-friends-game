import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Loader2,
  Feather,
  Swords,
  Trophy,
  Skull,
  Check,
  X,
  DoorOpen,
} from "lucide-react";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/question-difficulty";

/**
 * 📖 ملحمة العقول — مغامرتك الشخصية التي يكتبها الذكاء الاصطناعي.
 * كل باب اختيار محكوم بسؤال حقيقي: عقلك يكتب مصير بطلك.
 */

export function SagaReader() {
  const saga = useQuery(api.aiSaga.getMySaga, {});
  const startSaga = useAction(api.aiSaga.startSaga);
  const advanceChapter = useAction(api.aiSaga.advanceChapter);
  const chooseGate = useMutation(api.aiSaga.chooseGate);
  const answerGate = useMutation(api.aiSaga.answerGate);

  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const begin = async () => {
    setBusy(true);
    try {
      const result = await startSaga({});
      if (result.created) toast.success("📖 بدأت ملحمتك! اقرأ المشهد الأول.");
      else toast.info("عندك ملحمة جارية بالفعل.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء الملحمة.");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (choiceKey: string) => {
    if (!saga) return;
    setBusy(true);
    try {
      await chooseGate({ runId: saga._id, choiceKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر اختيار الباب.");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (questionId: string, selectedIdx: number) => {
    if (!saga) return;
    setBusy(true);
    setSelected(selectedIdx);
    try {
      const result = await answerGate({ runId: saga._id, questionId, selected: selectedIdx });
      if (result.sagaEnded) {
        toast.success(`🏆 انتهت الملحمة — لقبك: «${result.endingTitle}» بمجد ${result.glory}!`);
      } else if (result.passed) {
        toast.success(`✅ عبرت البوابة! +مجد`);
      } else {
        toast.error(`❌ الباب أُغلق... ${result.narration.slice(0, 60)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إجابة البوابة.");
    } finally {
      setBusy(false);
    }
  };

  const nextChapter = async () => {
    if (!saga) return;
    setBusy(true);
    try {
      await advanceChapter({ runId: saga._id });
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر توليد الفصل التالي.");
    } finally {
      setBusy(false);
    }
  };

  if (saga === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> الراوي يستحضر الحكاية…
        </CardContent>
      </Card>
    );
  }

  if (saga === null) {
    return (
      <Card dir="rtl" className="border-violet-500/25 bg-gradient-to-b from-violet-500/[0.05] to-transparent">
        <CardContent className="p-8 text-center">
          <BookOpen className="mx-auto size-10 text-violet-500/60" />
          <h3 className="mt-3 text-lg font-black">ملحمة العقول</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
            مغامرة من 5 فصول يكتبها الذكاء الاصطناعي خصيصاً لك: عالمها من أقوى
            فئاتك، وتحدياتها من نقاط ضعفك. كل باب تختاره محكوم بسؤال حقيقي —
            <span className="font-bold text-foreground"> عقلك هو بطل الحكاية.</span>
          </p>
          <Button
            onClick={begin}
            disabled={busy}
            className="mt-4 gap-2 rounded-xl bg-violet-600 px-6 text-white hover:bg-violet-700"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Feather className="size-4" />}
            افتتح ملحمتك
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ch = saga.currentChapter;

  return (
    <Card dir="rtl" className="overflow-hidden border-violet-500/25">
      <CardContent className="p-0">
        {/* الترويسة: المجد والتقدم */}
        <div className="border-b border-violet-500/20 bg-violet-500/[0.07] px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-violet-600" />
            <p className="text-sm font-black">ملحمة {saga.heroName}</p>
            <Badge variant="outline" className="rounded-full text-[9px]">
              فصل {Math.min(saga.chapterIndex + 1, saga.totalChapters)} / {saga.totalChapters}
            </Badge>
            {saga.status === "completed" && (
              <Badge className="rounded-full bg-amber-500/15 text-[9px] text-amber-700">
                <Trophy className="me-1 size-2.5" /> {saga.endingTitle}
              </Badge>
            )}
            <span className="ms-auto text-[10px] font-bold text-violet-700">
              المجد {saga.glory} / 100
            </span>
          </div>
          {/* شريط المجد */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-950/15">
            <motion.div
              animate={{ width: `${saga.glory}%` }}
              className="h-full rounded-full bg-gradient-to-l from-violet-600 to-fuchsia-500"
            />
          </div>
        </div>

        <div className="p-4">
          {saga.status === "completed" ? (
            <div className="py-6 text-center">
              {saga.glory >= 65 ? (
                <Trophy className="mx-auto size-10 text-amber-500" />
              ) : (
                <Skull className="mx-auto size-10 text-rose-400" />
              )}
              <h3 className="mt-3 text-xl font-black text-foreground">{saga.endingTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                أنهيت ملحمتك بمجد {saga.glory} — ملحمتك القادمة تنتظرك بعالمٍ آخر.
              </p>
              <Button
                size="sm"
                onClick={begin}
                disabled={busy}
                className="mt-4 gap-1.5 rounded-xl bg-violet-600 text-xs text-white hover:bg-violet-700"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Feather className="size-3.5" />}
                ملحمة جديدة
              </Button>
            </div>
          ) : !ch ? (
            <div className="py-6 text-center">
              <Button onClick={nextChapter} disabled={busy} className="gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Feather className="size-4" />}
                اكتب الفصل التالي
              </Button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${saga._id}-${ch.index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* المشهد */}
                <p className="whitespace-pre-line text-sm leading-loose text-foreground">
                  {ch.scene}
                </p>

                {/* وصف نتيجة الاختيار */}
                {ch.narration && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-bold leading-relaxed",
                      ch.gatePassed
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-700",
                    )}
                  >
                    {ch.narration}
                  </motion.div>
                )}

                {/* الأبواب أو سؤال البوابة */}
                {!ch.chosenKey ? (
                  <div className="mt-4 space-y-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700">
                      <DoorOpen className="size-3.5" /> ثلاثة أبواب — كل باب يطالب بسؤال:
                    </p>
                    {ch.choices.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        disabled={busy}
                        onClick={() => choose(c.key)}
                        className="group w-full rounded-xl border border-violet-500/25 bg-card p-3 text-start transition-all hover:border-violet-500/60 hover:bg-violet-500/[0.06] disabled:opacity-50"
                      >
                        <p className="flex items-center gap-2 text-xs font-bold">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-700">
                            {c.key.toUpperCase()}
                          </span>
                          {c.text}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
                          <Badge variant="outline" className="rounded-full text-[8px]">
                            بوابة: {DIFFICULTY_LABELS[c.gateDifficulty as Difficulty]}
                          </Badge>
                          <Badge variant="outline" className="rounded-full text-[8px]">
                            مجد +{c.gloryReward}
                          </Badge>
                          <span className="text-rose-600">⚠ {c.riskNote}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                ) : saga.gateQuestion && ch.gatePassed === undefined ? (
                  <div className="mt-4 rounded-xl border-2 border-violet-500/40 bg-violet-500/[0.06] p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-black text-violet-700">
                      <Swords className="size-3.5" /> بوابة الحكم — أجب ليعبر بطلك:
                    </p>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{saga.gateQuestion.question}</p>
                    <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                      {saga.gateQuestion.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          disabled={busy || selected !== null}
                          onClick={() => answer(saga.gateQuestion!.id, oi)}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-start text-[11px] transition-all",
                            selected === oi
                              ? "border-violet-500/60 bg-violet-500/10 font-bold"
                              : "border-border/60 bg-background hover:border-violet-500/50",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : ch.gatePassed !== undefined ? (
                  <Button
                    onClick={nextChapter}
                    disabled={busy || saga.status !== "active"}
                    className="mt-4 w-full gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Feather className="size-4" />}
                    {saga.chapterIndex >= saga.totalChapters ? "الخاتمة" : "الفصل التالي…"}
                  </Button>
                ) : null}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
