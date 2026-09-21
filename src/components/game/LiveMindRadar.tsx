import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, BrainCircuit, ChevronDown, Gauge, Loader2, Radio, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";

/**
 * 🎯 الرادار الذهني الحيّ — داخل غرفة اللعب.
 *
 * كانت أعلى `Game.tsx` تعليقاً يعلن «تحليل أداء حيّ · ضبط صعوبة بالذكاء ·
 * توقّع سلوك اللاعب» ولا شيء منها موجود. هذه اللوحة تجعل الثلاثة **مرئية
 * وحيّة من إجابات مسجّلة فعلاً**، وزرّ الضبط يغيّر الأسئلة المتبقية فعلاً.
 *
 * ولا رقم هنا تجميلي: كل سطر يقرأه من `gameLive.liveRoom`.
 */
export function LiveMindRadar({ code }: { code: string }) {
  const room = useQuery(api.gameLive.liveRoom, { code });
  const retune = useMutation(api.gameLive.retuneDifficulty);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

  if (room === undefined) {
    return (
      <Card className="mb-4 border-border/70">
        <CardContent className="flex items-center gap-2 p-3 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> الرادار الحيّ يقرأ الغرفة…
        </CardContent>
      </Card>
    );
  }
  if (room === null) return null;

  const answeredAnyone = room.players.some((p) => p.answered > 0);

  const doRetune = async () => {
    setBusy(true);
    try {
      const res = await retune({ code });
      if (res.changed) {
        toast.success(`ضُبطت الصعوبة: ${DIFF_LABEL[res.difficulty] ?? res.difficulty}`, {
          description: `${res.reason} · استُبدل ${res.swappedCount} سؤالاً من المتبقّي`,
        });
      } else {
        toast.message("لا تغيير مطلوب الآن", { description: res.reason });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر ضبط الصعوبة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4 border-primary/25 bg-primary/[0.03]">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-start"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <Radio className="size-3.5 text-primary" /> الرادار الذهني الحيّ
          </span>
          <Badge variant="outline" className="rounded-full text-[10px]">
            سؤال {Math.min(room.currentQuestionIndex + 1, room.totalQuestions)} / {room.totalQuestions}
          </Badge>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Gauge className="size-3" /> دقّة الغرفة {room.call.roomAccuracy}٪ من {room.call.sample} إجابة
          </span>
          <span className="text-[10px] text-muted-foreground">
            التوزيع الحالي: {DIFF_LABEL[room.call.difficulty] ?? room.call.difficulty} · صعب {Math.round(room.call.hardRatio * 100)}٪
          </span>
          {room.adaptationsCount > 0 && (
            <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">
              ضُبطت {room.adaptationsCount} مرة
            </Badge>
          )}
          <ChevronDown className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            {/* قرار الصعوبة — بصدق وسبب */}
            <div className="rounded-xl border border-border/60 bg-background/60 p-2.5">
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <b>قرار الصعوبة:</b> {room.call.reason}
                </span>
              </p>
              {room.plan.shouldRetune ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {room.plan.why} · الأسئلة المُجابة محفوظة ولا تُلمس.
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-muted-foreground">{room.plan.why}</p>
              )}
              {room.isHost && room.status === "playing" && room.plan.shouldRetune && (
                <Button size="sm" className="mt-2 h-7 rounded-lg text-[11px]" disabled={busy} onClick={() => void doRetune()}>
                  {busy ? <Loader2 className="size-3 animate-spin" /> : <BrainCircuit className="size-3" />}
                  اضبط الصعوبة على الأداء الحيّ
                </Button>
              )}
              {!room.isHost && room.status === "playing" && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  صاحب الغرفة وحده يملك زر الضبط — لكن القرار والأرقام أمامك.
                </p>
              )}
            </div>

            {/* آخر ضبط فعلي — شفافية */}
            {room.lastAdaptation && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-2.5 text-[10px] leading-relaxed">
                <b>آخر ضبط حقيقي:</b> عند السؤال {room.lastAdaptation.atQuestionIndex + 1} انتقلت الصعوبة من{" "}
                {DIFF_LABEL[room.lastAdaptation.fromDifficulty] ?? room.lastAdaptation.fromDifficulty} إلى{" "}
                {DIFF_LABEL[room.lastAdaptation.toDifficulty] ?? room.lastAdaptation.toDifficulty} — استُبدل{" "}
                {room.lastAdaptation.swappedCount} سؤالاً (دقّة الغرفة كانت {room.lastAdaptation.roomAccuracy}٪). القرار: {room.lastAdaptation.actorName}.
              </div>
            )}

            {/* تحليل وتوقّع لكل لاعب */}
            {!answeredAnyone ? (
              <p className="py-2 text-center text-[11px] text-muted-foreground">
                لا إجابات بعد — الرادار يعمل بمجرد أول إجابة حقيقية. لا نعرض أرقاماً مُختلقة.
              </p>
            ) : (
              <div className="space-y-1.5">
                {room.players.map((p) => (
                  <div key={p.userId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                    <span className="w-5 shrink-0 text-center font-bold tabular-nums text-muted-foreground">{p.rank}</span>
                    <span className="min-w-0 max-w-[9rem] truncate font-bold">{p.name}</span>

                    <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                      <Activity className="size-3" /> {p.accuracy}٪ ({p.correct}/{p.answered})
                    </span>
                    <span className="tabular-nums text-muted-foreground">· {p.avgMs > 0 ? `${(p.avgMs / 1000).toFixed(1)}ث` : "—"}</span>
                    {p.streak > 1 && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-amber-600">
                        سلسلة {p.streak}
                      </Badge>
                    )}
                    {p.momentum !== 0 && (
                      <span className={cn("flex items-center gap-0.5 text-[10px] font-bold", p.momentum > 0 ? "text-emerald-600" : "text-rose-600")}>
                        {p.momentum > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {p.momentum > 0 ? "+" : ""}
                        {p.momentum}
                      </span>
                    )}

                    <span className="ms-auto flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-0.5">
                      <Zap className="size-3 text-primary" />
                      <span className="text-[10px] text-muted-foreground">توقّع القادم:</span>
                      <b className="tabular-nums">{p.next.probability}٪</b>
                      <span className="text-[10px] text-muted-foreground">· {p.next.label}</span>
                      {p.next.expectedMs > 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          · ~{(p.next.expectedMs / 1000).toFixed(1)}ث
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">(ثقة {p.next.confidence}٪)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              التوقّع مبنيّ على تنعيم إجاباتك الحقيقية (يبدأ من ٥٠٪ ويتحرك مع كل سؤال) — و«ثقة» تعني حجم عيّنتك،
              لا مدى صحة الرقم. ونقاط اللعب نفسها محسوبة أصلاً بالسرعة والسلسلة وأول إصابة والسؤال الذهبي.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
