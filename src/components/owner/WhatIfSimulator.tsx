/**
 * موجّة 10 — محاكي «ماذا لو» (أداة المالك)
 * السؤال → تحليل AI مبني على أرقام حقيقية من قاعدة البيانات.
 */

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, FlaskConical, Sparkles, History } from "lucide-react";
import { toast } from "sonner";

const EXAMPLES = [
  "ماذا لو ضاعفت مكافآت نقاط الولاء؟",
  "ماذا لو جعلت مدة الكتم الافتراضية يوم كامل؟",
  "ماذا لو أضفت بطولة يومية بدل الأسبوعية؟",
  "ماذا لو فتحت المستوى الماسي للاعبين الفضيين؟",
];

function fmt(n: number): string {
  return n.toLocaleString("ar-EG");
}

function timeAgo(t: number): string {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

export function WhatIfSimulator() {
  const run = useAction(api.simulator.runSimulation);
  const stats = useQuery(api.simulator.getStatsSnapshot);
  const history = useQuery(api.simulator.getHistory, { limit: 5 });

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [usedStats, setUsedStats] = useState<Record<string, number> | null>(null);

  const handleRun = async () => {
    if (loading) return;
    if (question.trim().length < 5) {
      toast.error("اكتب سؤالك الاستراتيجي أولاً");
      return;
    }
    setLoading(true);
    setAnswer(null);
    try {
      const res = await run({ question: question.trim() });
      setAnswer(res.answer);
      setUsedStats(res.stats as unknown as Record<string, number>);
      toast.success("تم التحليل ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحليل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-violet-500/25 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
              <FlaskConical className="size-5" />
            </span>
            <div>
              <h3 className="font-bold">محاكي «ماذا لو» 🔮</h3>
              <p className="text-xs text-muted-foreground">
                اسأل خبير القياس — تحليل مبني على أرقامك الحقيقية، لا تخمين
              </p>
            </div>
          </div>
          {stats && (
            <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
              {fmt(stats.activePlayersLast7d)} لاعب نشط · 7 أيام
            </Badge>
          )}
        </div>

        {/* أمثلة جاهزة */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-violet-700"
            >
              {ex}
            </button>
          ))}
        </div>

        <Textarea
          dir="rtl"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="اكتب سيناريوك هنا… مثال: ماذا لو ضاعفت مكافآت البطولة؟"
          className="mt-3 min-h-20 resize-none rounded-xl"
          maxLength={400}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{question.length}/400</span>
          <Button
            onClick={handleRun}
            disabled={loading}
            className="gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? "يحلل الأرقام…" : "شغّل المحاكاة"}
          </Button>
        </div>

        {/* النتيجة */}
        {answer && (
          <div className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-violet-700">
              <Sparkles className="size-3.5" /> خلاصة خبير القياس
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {answer}
            </div>
          </div>
        )}

        {/* الأرقام المستخدمة */}
        {usedStats && (
          <details className="mt-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">
              📊 الأرقام الحقيقية المستخدمة في التحليل
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-3">
              <span>جولات 7 أيام: <b className="text-foreground">{fmt(usedStats.roundsLast7d ?? 0)}</b></span>
              <span>نشطون: <b className="text-foreground">{fmt(usedStats.activePlayersLast7d ?? 0)}</b></span>
              <span>دقة: <b className="text-foreground">{fmt(usedStats.accuracyPct ?? 0)}%</b></span>
              <span>متوسط الجولة: <b className="text-foreground">{fmt(usedStats.avgScorePerRound ?? 0)}</b></span>
              <span>فارق القمة: <b className="text-foreground">{fmt(usedStats.avgFirstSecondGap ?? 0)}</b></span>
              <span>بطولات: <b className="text-foreground">{fmt(usedStats.tournamentsTotal ?? 0)}</b></span>
            </div>
          </details>
        )}

        {/* سجل التحليلات */}
        {history && history.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <History className="size-3" /> تحليلات سابقة
            </p>
            <ul className="space-y-1.5">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-lg bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground"
                >
                  <b className="text-foreground/80">{h.question}</b> · {timeAgo(h.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
