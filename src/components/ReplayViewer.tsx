/**
 * موجّة 14 — عارض إعادة الجولة + بطاقة النتيجة القابلة للمشاركة
 * سؤالاً بسؤال: من أجاب، ماذا اختار، كم استغرق، وكم جلب.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, Share2, Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { snapdom } from "@zumer/snapdom";

function fmtMs(ms: number) {
  if (ms <= 0) return "—";
  return `${(ms / 1000).toFixed(1)} ث`;
}

const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export function ReplayViewer({ gameCode }: { gameCode: string }) {
  const replay = useQuery(api.stats.getRoundReplay, { gameCode });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  if (replay === undefined) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border/80 bg-card p-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  if (replay === null) return null;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const card = document.getElementById("share-result-card");
      if (!card) throw new Error("البطاقة غير موجودة");
      const canvas = await snapdom.toCanvas(card as HTMLElement, { fast: false });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("تعذّر توليد الصورة");
      const file = new File([blob], `mindclash-${replay.gameCode}.png`, { type: "image/png" });
      // مشاركة أصلية إن دعمها الجهاز (الهاتف)، وإلا تنزيل مباشر
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "نتيجتي في حرب العقول 🧠" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("تم تجهيز بطاقة النتيجة ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت المشاركة");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mt-4">
      {/* بطاقة المشاركة (مخفية بصرياً — تُلتقط كصورة) */}
      <div
        id="share-result-card"
        style={{ position: "absolute", left: -9999, top: 0, width: 420 }}
        className="rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-indigo-950 to-slate-900 p-6 text-white"
      >
        <p className="text-center text-xs font-bold tracking-wide text-amber-300">حرب العقول 🧠</p>
        <p className="mt-2 text-center text-2xl font-black">نتيجة الجولة</p>
        <p className="mt-1 text-center text-sm text-slate-300">الرمز: {replay.gameCode}</p>
        <div className="mt-4 flex justify-center gap-6">
          {replay.answers[0]?.byPlayer
            .slice()
            .sort((a, b) => {
              const sum = (r: typeof a) =>
                replay.answers.reduce((s, q) => s + (q.byPlayer.find((p) => p.userId === r.userId)?.points ?? 0), 0);
              return sum(b) - sum(a);
            })
            .slice(0, 3)
            .map((p, i) => (
              <div key={p.userId} className="text-center">
                <p className="text-2xl">{["🥇", "🥈", "🥉"][i]}</p>
                <p className="mt-1 max-w-24 truncate text-sm font-bold">{p.name}</p>
                <p className="text-xs font-black text-amber-300">
                  {replay.answers.reduce((s, q) => s + (q.byPlayer.find((x) => x.userId === p.userId)?.points ?? 0), 0)}
                </p>
              </div>
            ))}
        </div>
        <p className="mt-5 text-center text-[10px] text-slate-400">
          {replay.answers.length} أسئلة · {replay.playerCount} لاعبين
        </p>
      </div>

      {/* زر المشاركة */}
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <PlayCircle className="size-4 text-primary" />
          إعادة الجولة — سؤالاً بسؤال
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs"
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
          شارك النتيجة
        </Button>
      </div>

      {/* التسلسل الزمني */}
      <div className="mt-3 space-y-2">
        {replay.answers.map((q) => {
          const open = openIndex === q.questionIndex;
          const correctCount = q.byPlayer.filter((p) => p.correct).length;
          return (
            <div key={q.questionIndex} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-start"
                onClick={() => setOpenIndex(open ? null : q.questionIndex)}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    correctCount > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {q.questionIndex + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{q.question}</span>
                <Badge variant="outline" className="shrink-0 rounded-full text-[9px]">
                  {DIFF_LABEL[q.difficulty] ?? q.difficulty}
                </Badge>
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="border-t border-border/60 px-4 py-3">
                  <p className="text-[11px] font-bold text-emerald-700">
                    ✅ الإجابة الصحيحة: {q.options[q.correctIndex]}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {q.byPlayer.map((p) => (
                      <li key={p.userId} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5 text-[11px]">
                        {p.answered ? (
                          p.correct ? (
                            <Check className="size-3.5 shrink-0 text-emerald-600" />
                          ) : (
                            <X className="size-3.5 shrink-0 text-rose-500" />
                          )
                        ) : (
                          <span className="size-3.5 shrink-0 text-center text-muted-foreground">–</span>
                        )}
                        <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                        {p.answered ? (
                          <>
                            <span className="text-muted-foreground">
                              {p.correct ? q.options[p.selected] : `اختار: ${q.options[p.selected] ?? "؟"}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{fmtMs(p.elapsedMs)}</span>
                            <span className={`font-black ${p.correct ? "text-emerald-600" : "text-muted-foreground"}`}>
                              +{p.points}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">لم يجب</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
