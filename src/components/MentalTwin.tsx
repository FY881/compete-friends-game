import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  BrainCircuit,
  Copy,
  Dumbbell,
  Gauge,
  Loader2,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

/**
 * 🧬 التوأم الذهني — واجهة اللاعب.
 *
 * كل رقم هنا يقرأ من بيانات لعب حقيقية على الخادم (`mindTwin.getMyTwin`):
 * إتقانك لكل فئة، وحجم عيّنتك، وترتيبك بين العقول. لا شيء مُختلق.
 * والزر الوحيد الذي «يفعل» يحوّل نقطة ضعفك إلى تحدٍّ حقيقي بكود، والفئة
 * تُحسب في الخادم لا في هذه الشاشة — فلا مجال للتلاعب.
 */

const DIFF_LABEL: Record<string, { label: string; tone: string }> = {
  easy: { label: "سهل", tone: "text-emerald-600" },
  medium: { label: "متوسط", tone: "text-sky-600" },
  hard: { label: "صعب", tone: "text-amber-600" },
  expert: { label: "خبير", tone: "text-rose-600" },
};

export function MentalTwin() {
  const twin = useQuery(api.mindTwin.getMyTwin);
  const mint = useMutation(api.mindTwin.createTwinChallenge);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState<{ code: string; category: string; rewardXp: number; sharePath: string } | null>(null);

  const bars = useMemo(() => {
    if (!twin) return [];
    return [...twin.all].sort((a, b) => b.mastery - a.mastery);
  }, [twin]);

  if (twin === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center gap-2 p-5 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> التوأم يقرأ عقلك…
        </CardContent>
      </Card>
    );
  }

  if (twin === null) {
    return (
      <Card className="border-border/70">
        <CardContent className="p-5 text-xs text-muted-foreground">
          سجّل الدخول ليكتشف توأمك الذهني أين قوّتك وأين نقطة ضعفك.
        </CardContent>
      </Card>
    );
  }

  const mintTwin = async () => {
    setBusy(true);
    try {
      const res = await mint({ questionCount: 10, ttlHours: 168 });
      setMinted({ code: res.code, category: res.category, rewardXp: res.rewardXp, sharePath: res.sharePath });
      toast.success(`صُنع تحدّي التوأم: ${res.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء التحدّي");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base tracking-tight">
          <BrainCircuit className="size-4 text-primary" />
          التوأم الذهني
          <Badge variant="outline" className="rounded-full text-[10px]">
            يقرأ بياناتك الحقيقية فقط
          </Badge>
          <span className="ms-auto flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
            <Gauge className="size-3.5" /> ثقة القراءة {twin.confidence}٪ · {twin.answeredTotal} إجابة · {twin.sampleMinds} عقل
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── القراءة الصادقة ── */}
        <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3">
          {twin.reading.map((line, i) => (
            <p key={`${i}-${line.slice(0, 12)}`} className="text-[11px] leading-relaxed">
              {line}
            </p>
          ))}
          {twin.percentile > 0 && (
            <p className="text-[11px] font-bold text-primary">
              ترتيبك بين العقول: أعل من {twin.percentile}٪ من اللاعبين المقيسين.
            </p>
          )}
        </div>

        {/* ── القوة والضعف ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="size-3.5" /> أقوى ما في عقلك
            </p>
            {twin.strengths.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">لم تُقَس فئة بعد — العب جولات حقيقية.</p>
            ) : (
              <ul className="space-y-1.5">
                {twin.strengths.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold">{c.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.mastery}٪ · {c.correct}/{c.total} · {c.levelLabel}
                      </span>
                    </div>
                    <Progress value={c.mastery} className="mt-1 h-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <TrendingDown className="size-3.5" /> نقطة ضعفك المقيسة
            </p>
            {twin.weaknesses.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">لا ضعف مقيساً بعد — كل فئاتك متقاربة أو غير مقيسة.</p>
            ) : (
              <ul className="space-y-1.5">
                {twin.weaknesses.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold">{c.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.mastery}٪ · {c.correct}/{c.total}
                      </span>
                    </div>
                    <Progress value={c.mastery} className="mt-1 h-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── خطة التدريب ── */}
        {twin.drills.length > 0 && (
          <div className="rounded-xl border border-border/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
              <Dumbbell className="size-3.5 text-primary" /> خطة التدريب — مشتقّة من أدائك لا من رأي
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {twin.drills.map((d) => (
                <div key={d.category} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                  <Target className="size-3.5 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{d.category}</span>
                  <span className={cn("text-[10px] font-bold", DIFF_LABEL[d.difficulty]?.tone)}>
                    {DIFF_LABEL[d.difficulty]?.label ?? d.difficulty}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-lg px-2 text-[10px]"
                    onClick={() => navigate(`/arena?drill=${encodeURIComponent(d.category)}`)}
                  >
                    ابدأ الآن
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              «ابدأ الآن» ينقلك إلى الساحة بفلتر الفئة نفسه — جولة تدريب حقيقية على نقطة ضعفك.
            </p>
          </div>
        )}

        {twin.unmeasured.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            بلا حكم على: {twin.unmeasured.map((c) => c.category).join(" · ")} (أقل من {twin.minSample} إجابات).
          </p>
        )}

        {/* ── الفعل: نقطة الضعف تصير تحدّياً ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.03] p-3">
          <Swords className="size-4 text-primary" />
          <span className="min-w-0 flex-1 text-[11px]">
            {twin.focus ? (
              <>
                حوّل نقطة ضعفك <b>«{twin.focus.category}»</b> إلى تحدٍّ حقيقي يدخل عليه أصدقاؤك — والأسئلة تُبنى من هذه الفئة فعلاً.
              </>
            ) : (
              <>لا توجد فئة مقيسة بعد لبناء تحدٍّ منها.</>
            )}
          </span>
          <Button
            size="sm"
            className="rounded-xl"
            disabled={busy || !twin.focus}
            onClick={() => void mintTwin()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            أنشئ تحدّي التوأم
          </Button>
        </div>

        {minted && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.05] p-3">
            <Badge variant="outline" className="rounded-full font-mono text-[11px]">
              {minted.code}
            </Badge>
            <span className="text-[11px]">
              مكافأته <b>{minted.rewardXp}</b> خبرة · الفئة: <b>{minted.category}</b> · صالح ٧ أيام
            </span>
            <div className="flex gap-1.5">
              <Button asChild size="sm" className="rounded-xl">
                <Link to={minted.sharePath}>العب الآن</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={async () => {
                  const url = `${window.location.origin}${minted.sharePath}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success("نُسخ رابط التحدّي — شاركه مع أصدقائك");
                  } catch {
                    toast.error("تعذّر النسخ — انسخ الكود يدوياً");
                  }
                }}
              >
                <Copy className="size-3.5" /> نسخ الرابط
              </Button>
            </div>
          </div>
        )}

        {bars.length > 0 && (
          <details className="rounded-xl border border-border/60 p-3">
            <summary className="cursor-pointer text-[11px] font-bold">كل فئاتك المقيسة ({bars.length})</summary>
            <div className="mt-2 space-y-1.5">
              {bars.map((c) => (
                <div key={c.category} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-[10px]">{c.category}</span>
                  <Progress value={c.mastery} className="h-1.5 flex-1" />
                  <span className="w-10 shrink-0 text-end text-[10px] tabular-nums text-muted-foreground">{c.mastery}٪</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
