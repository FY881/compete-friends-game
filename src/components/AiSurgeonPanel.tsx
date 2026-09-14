import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Stethoscope,
  Loader2,
  Check,
  X,
  FileCode2,
  Sparkles,
  Wrench,
  BrainCircuit,
  Activity,
  ShieldCheck,
  TrendingUp,
  FileText,
} from "lucide-react";

const sevLabel: Record<string, string> = {
  critical: "حرج",
  high: "عالٍ",
  medium: "متوسط",
  low: "منخفض",
};

const sevColor: Record<string, string> = {
  critical: "text-rose-600",
  high: "text-orange-600",
  medium: "text-amber-600",
  low: "text-muted-foreground",
};

function timeAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} سا`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

/**
 * 🩸 غرفة الجراحة — الجرّاح الذكي (v6.0، المرحلة 2)
 * رقع جيميناي المولّدة تلقائياً للأخطاء القابلة للإصلاح —
 * يراجعها المالك ويطبّقها بنقرة واحدة، مع رفض كامل الحق.
 */
export function AiSurgeonPanel() {
  const board = useQuery(api.geminiDoctor.getPatchBoard);
  const generate = useAction(api.geminiDoctor.generatePatchesPublic);
  const apply = useMutation(api.geminiDoctor.applyPatch);
  const dismiss = useMutation(api.geminiDoctor.dismissPatch);
  const healthReport = useAction(api.geminiDoctor.dailyHealthReport);
  const dashboard = useQuery(api.errorHunter.getSentinelDashboard);
  const impactRanked = useQuery(api.errorHunter.getImpactRankedErrors);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const runHealthReport = async () => {
    setBusy("report");
    try {
      const res = await healthReport({});
      setReport(res);
      toast.success("📋 تقرير الصحة اليومي جاهز");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر توليد التقرير");
    } finally {
      setBusy(null);
    }
  };

  const runGenerate = async () => {
    setBusy("generate");
    try {
      const res = await generate({});
      if (res.generated > 0) {
        toast.success(`🩺 الجرّاح ولّد ${res.generated} رقعة جديدة — جاهزة للمراجعة`);
      } else {
        toast.info("لا توجد أخطاء قابلة للترقيع حالياً — كل شيء سليم");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر توليد الرقع");
    } finally {
      setBusy(null);
    }
  };

  const runApply = async (id: string) => {
    setBusy(id);
    try {
      await apply({ patchId: id as any });
      toast.success("✅ تم تسجيل الرقعة واعتبار الخطأ محلولاً — انسخ الكود ونفّذه على الملف المستهدف");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التطبيق");
    } finally {
      setBusy(null);
    }
  };

  const runDismiss = async (id: string) => {
    setBusy(id);
    try {
      await dismiss({ patchId: id as any });
      toast.info("تم رفض الرقعة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الرفض");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <Stethoscope className="size-5" />
            </span>
            غرفة الجراحة — الجرّاح الذكي
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            طبيب Gemini يحوّل الأخطاء القابلة للإصلاح إلى رقع فعلية — راجعها وطبّقها بنقرة واحدة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {board && (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="rounded-full text-[10px]">
                {board.stats.total} إجمالي
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">
                {board.stats.applied} مطبَّقة
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
                {board.stats.dismissed} مرفوضة
              </Badge>
            </div>
          )}
          <Button onClick={runGenerate} disabled={busy === "generate"} className="gap-1.5 rounded-xl" size="sm">
            {busy === "generate" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            ولّد رقعاً الآن
          </Button>
        </div>
      </div>

      {/* ── غرفة القيادة الحية: صحة النظام + مؤشرات الأداء ── */}
      {dashboard && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <span className={
                "flex size-10 items-center justify-center rounded-xl " +
                (dashboard.status === "healthy"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : dashboard.status === "degraded"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-rose-500/10 text-rose-600")
              }>
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none">
                  {dashboard.healthScore}
                  <span className="text-xs font-normal text-muted-foreground"> /100</span>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">درجة الصحة — {dashboard.status}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <Check className="size-5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none">{dashboard.stats.healRate}%</p>
                <p className="mt-1 text-[11px] text-muted-foreground">نسبة الشفاء الذاتي ({dashboard.stats.autoHealed})</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                <Activity className="size-5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none">{Math.round(dashboard.performance.avgFps)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">متوسط FPS ({dashboard.performance.samples} عينة)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-3 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <BrainCircuit className="size-5" />
              </span>
              <div>
                <p className="text-lg font-bold leading-none">{dashboard.stats.aiAnalyzed}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">أخطاء شخّصها جيميناي</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={runHealthReport} disabled={busy === "report"} variant="outline" className="gap-1.5 rounded-xl" size="sm">
          {busy === "report" ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          تقرير الصحة اليومي (جيميناي)
        </Button>
      </div>
      {report && (
        <Card className="border-primary/30 bg-primary/[0.03] shadow-sm">
          <CardContent className="py-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
              <FileText className="size-3.5" /> تقرير آخر 24 ساعة
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed">{report}</p>
          </CardContent>
        </Card>
      )}

      {/* ── الأخطاء مرتّبة حسب تأثير اللاعب الحقيقي ── */}
      {impactRanked && impactRanked.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-primary" />
              الأعلى تأثيراً على اللاعبين (آخر 200 خطأ غير محلول)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {impactRanked.slice(0, 8).map((e) => (
              <div key={e._id} className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                <Badge variant="outline" className={"rounded-full text-[10px] " + (sevColor[e.severity] ?? "")}>
                  {sevLabel[e.severity] ?? e.severity}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs" dir="auto">{e.message}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.lastSeen)}</span>
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {e.impact}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!board ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : board.pending.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <BrainCircuit className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-semibold">لا رقع معلّقة</p>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              عندما يشخّص طبيب Gemini خطأً كقابل للإصلاح التلقائي، ستظهر رقعته هنا تلقائياً —
              مع الملف المستهدف والشرح والكود الكامل جاهزاً للتطبيق بنقرة.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {board.pending.map((p) => (
            <Card key={p._id} className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                  <Wrench className="size-4 text-primary" />
                  <span className="flex-1 truncate">{p.title}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {p.severity}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" dir="ltr">
                  <FileCode2 className="size-3.5" />
                  {p.targetFile}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">{p.change}</p>

                <button
                  type="button"
                  onClick={() => setExpanded(expanded === p._id ? null : p._id)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
                >
                  {expanded === p._id ? "إخفاء الكود" : "عرض الكود المقترح"}
                </button>
                {expanded === p._id && (
                  <pre
                    dir="ltr"
                    className="max-h-56 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-left text-[10px] leading-4"
                  >
                    {p.code}
                  </pre>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => runApply(p._id)}
                    disabled={busy === p._id}
                    className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    {busy === p._id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    تطبيق الرقعة
                  </Button>
                  <Button
                    onClick={() => runDismiss(p._id)}
                    disabled={busy === p._id}
                    variant="outline"
                    className="gap-1.5 rounded-xl text-rose-600"
                    size="sm"
                  >
                    <X className="size-3.5" />
                    رفض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
