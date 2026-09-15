import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BrainCircuit,
  Layers,
  Loader2,
  MessageCircleQuestion,
  Radar,
  Swords,
  TrendingUp,
  HeartPulse,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 مركز APEX — صياد الأخطاء v7.0
 *
 *  - العناقيد الدلالية: عائلات الأخطاء المجمّعة بذكاء جيميناي + الانتكاسات
 *  - تقرير الحرب اليومي: تقرير صباحي صارم بالعربية من بيانات حقيقية
 *  - محكمة الأسئلة: اسأل عن أي حادثة واحصل على إجابة من الأدلة
 *  - طبيب الجلسة: اللاعبون الأكثر معاناة بدرجة صحة حية
 *  - ارتباط الشذوذ: الأداء الذي سبق موجة الأخطاء
 *  - اتجاهات الصحة: هل اللعبة تتحسن أم تسوء؟
 * ═══════════════════════════════════════════════════════════════════════
 */

export function ApexPanel() {
  const clusters = useQuery(api.geminiApex.getClusterBoard);
  const trends = useQuery(api.errorHunterApex.getHealthTrends);
  const correlations = useQuery(api.errorHunterApex.correlateAnomalies);
  const sessionHealth = useQuery(api.errorHunterApex.getSessionHealth);
  const apexQueue = useQuery(api.errorHunterApex.getApexRankedQueue);
  const warReport = useAction(api.errorHunterApex.aiDailyWarReport);
  const ask = useAction(api.errorHunterApex.askAboutErrors);

  const [busy, setBusy] = useState<string | null>(null);
  const [warText, setWarText] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const runWarReport = async () => {
    setBusy("war");
    try {
      const res = await warReport({});
      setWarText(res);
      toast.success("⚔️ تقرير الحرب جاهز");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر توليد التقرير");
    } finally {
      setBusy(null);
    }
  };

  const runAsk = async () => {
    if (!question.trim()) return;
    setBusy("ask");
    try {
      const res = await ask({ question });
      setAnswer(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحصول على إجابة");
    } finally {
      setBusy(null);
    }
  };

  const trendColor =
    trends?.trend === "improving" ? "text-emerald-600" : trends?.trend === "worsening" ? "text-rose-600" : "text-amber-600";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
            <BrainCircuit className="size-5" />
          </span>
          مركز APEX — صياد الأخطاء v7.0
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ذكاء يجمع الأخطاء دلالياً، يكشف الانتكاسات، يجيب على أسئلتك من الأدلة، ويرتب الأولويات بالتأثير الحقيقي.
        </p>
      </div>

      {/* ── عناقيد الأخطاء الدلالية ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Layers className="size-4 text-primary" />
            العناقيد الدلالية — عائلات الأخطاء
            {clusters && (
              <div className="flex gap-1.5">
                <Badge variant="outline" className="rounded-full text-[10px]">{clusters.totals.clusters} عنقود</Badge>
                <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">{clusters.totals.untriaged} غير مفروز</Badge>
                {clusters.totals.regressions > 0 && (
                  <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                    ⚖️ {clusters.totals.regressions} انتكاسات
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {clusters === undefined ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : !clusters || (clusters.clusters ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا عناقيد بعد — دورة التجميع تعمل كل 15 دقيقة.</p>
          ) : (
            (clusters?.clusters ?? []).slice(0, 10).map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                {c.isRegression && (
                  <Badge variant="outline" className="rounded-full border-rose-500/40 text-[9px] text-rose-600">
                    ⚖️ انتكاسة ×{c.regressionCount}
                  </Badge>
                )}
                <Badge variant="outline" className={"rounded-full text-[10px] " + (c.severity === "critical" ? "text-rose-600" : c.severity === "medium" ? "text-amber-600" : "text-muted-foreground")}>
                  {c.severity}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.title}</span>
                <span className="truncate text-[10px] text-muted-foreground" dir="auto">{c.sampleMessage}</span>
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {c.memberCount} خطأ
                </span>
                <span className="shrink-0 text-[9px] text-muted-foreground">قبل {c.lastSeenAgeMin} د</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── تقرير الحرب + محكمة الأسئلة ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Swords className="size-4 text-rose-600" /> تقرير الحرب اليومي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={runWarReport} disabled={busy === "war"} size="sm" className="gap-1.5 rounded-xl">
              {busy === "war" ? <Loader2 className="size-3.5 animate-spin" /> : <Swords className="size-3.5" />}
              توليد تقرير الحرب الصباحي
            </Button>
            {warText && (
              <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">{warText}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircleQuestion className="size-4 text-sky-600" /> محكمة الأسئلة — اسأل عن أي حادثة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="مثال: لماذا انكسرت الساحة أمس؟"
                className="h-9 rounded-xl text-xs"
                onKeyDown={(e) => e.key === "Enter" && runAsk()}
              />
              <Button onClick={runAsk} disabled={busy === "ask"} size="sm" className="gap-1.5 rounded-xl">
                {busy === "ask" ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircleQuestion className="size-3.5" />}
                اسأل
              </Button>
            </div>
            {answer && (
              <p className="whitespace-pre-wrap rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs leading-relaxed">{answer}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── اتجاهات الصحة الأسبوعية ── */}
      {trends && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-primary" />
              اتجاهات الصحة — 7 أيام
              <span className={"text-xs font-bold " + trendColor}>{trends.verdict}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-28 items-end gap-1.5">
              {trends.days.map((d, i) => {
                const max = Math.max(1, ...trends.days.map((x) => x.errors));
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[9px] tabular-nums text-muted-foreground">{d.errors}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-primary/30 to-primary"
                      style={{ height: `${Math.max(4, (d.errors / max) * 70)}px` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{d.day}</span>
                  </div>
                );
              })}
            </div>
            {trends.topFamilies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {trends.topFamilies.map((f) => (
                  <Badge key={f.title} variant="outline" className="rounded-full text-[10px]">
                    {f.title}: {f.members} خطأ {f.isRegression ? "⚖️" : ""}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── ارتباط الشذوذ ── */}
      {correlations && correlations.correlations.length > 0 && (
        <Card className="border-amber-500/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
              <Radar className="size-4" /> ارتباط الشذوذ — الأداء الذي سبب أعطالاً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {correlations.correlations.map((c, i) => (
              <p key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700">
                {c}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── طبيب الجلسة: اللاعبون الأكثر معاناة ── */}
      {sessionHealth && sessionHealth.players.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <HeartPulse className="size-4 text-rose-600" />
              طبيب الجلسة — اللاعبون الأكثر معاناة
              {sessionHealth.suffering > 0 && (
                <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                  {sessionHealth.suffering} لاعباً بصحة حرجة
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {sessionHealth.players.slice(0, 8).map((p) => (
              <div key={p.userId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                <span
                  className={
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black " +
                    (p.healthScore >= 70
                      ? "bg-emerald-500/15 text-emerald-600"
                      : p.healthScore >= 50
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-rose-500/15 text-rose-600")
                  }
                >
                  {p.healthScore}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">{p.errors24h} خطأ</span>
                {p.critical24h > 0 && <span className="text-[10px] text-rose-600">{p.critical24h} حرجة</span>}
                {p.autoHealed > 0 && <span className="text-[10px] text-emerald-600">{p.autoHealed} شُفيت</span>}
                {p.avgFps > 0 && <span className="text-[10px] text-muted-foreground">{p.avgFps} FPS</span>}
                {p.lastRoute && <span className="font-mono text-[9px] text-muted-foreground">{p.lastRoute}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── قائمة APEX المرتّبة (تأثير × انتكاس × ثقة) ── */}
      {apexQueue && apexQueue.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BrainCircuit className="size-4 text-primary" />
              قائمة APEX — الأولويات المُحتسبة (تأثير × انتكاس × ثقة)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {apexQueue.slice(0, 10).map((e) => (
              <div key={e._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                {e.isRegression && (
                  <Badge variant="outline" className="rounded-full border-rose-500/40 text-[9px] text-rose-600">⚖️</Badge>
                )}
                <Badge variant="outline" className={"rounded-full text-[10px] " + (e.severity === "critical" ? "text-rose-600" : e.severity === "high" ? "text-orange-600" : "text-muted-foreground")}>
                  {e.severity}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs" dir="auto">{e.message}</span>
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {e.impact}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
