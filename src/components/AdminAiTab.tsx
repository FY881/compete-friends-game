import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SettingsData } from "@/convex/owner";
import { DIFFICULTY_LABELS } from "@/lib/question-difficulty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/convex/questions";
import { APP_VERSION } from "@/lib/app-version";
import {
  Activity,
  AlertTriangle,
  Archive,
  Ban,
  BarChart3,
  Bot,
  BrainCircuit,
  Bug,
  Check,
  Copy,
  Database,
  Eraser,
  FileDown,
  Flag,
  Gamepad2,
  Gavel,
  Globe,
  Link2,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ScanSearch,
  Timer,
  Smartphone,
  UserCog,
  X,
  Zap,
} from "lucide-react";

type AdminReportRow = {
  id: string;
  summary: string;
  stats: {
    reportsReviewed: number;
    punishmentsApplied: number;
    roomsCleaned: number;
    usersEscalated: number;
    bannedUsers: number;
    activeRooms: number;
    openReportsLeft: number;
    autoFixes: number;
    downloadFailures: number;
  };
  issues: {
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
    fix: string;
  }[];
  createdAt: number;
};

const SEVERITY_TONES: Record<string, string> = {
  low: "border-emerald-500/30 bg-emerald-500/5",
  medium: "border-amber-500/30 bg-amber-500/5",
  high: "border-rose-500/30 bg-rose-500/5",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "بسيطة",
  medium: "متوسطة",
  high: "خطيرة",
};

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildReportText(report: AdminReportRow): string {
  const lines = [
    `🤖 تقرير المدير الآلي — ${fmtDate(report.createdAt)}`,
    "",
    report.summary,
    "",
    "الإحصاءات:",
    `• بلاغات رُوجعت: ${report.stats.reportsReviewed}`,
    `• عقوبات طُبقت: ${report.stats.punishmentsApplied}`,
    `• غرف نُظفت: ${report.stats.roomsCleaned}`,
    `• مخالفون رُفعت عقوبتهم: ${report.stats.usersEscalated}`,
    `• إصلاحات ذاتية: ${report.stats.autoFixes}`,
    `• محاولات تنزيل فاشلة (24 ساعة): ${report.stats.downloadFailures ?? 0}`,
    `• حسابات محظورة: ${report.stats.bannedUsers}`,
    `• غرف نشطة: ${report.stats.activeRooms}`,
    `• بلاغات متبقية: ${report.stats.openReportsLeft}`,
    "",
    "المشاكل والحلول المقترحة:",
    ...report.issues.map((issue, i) => {
      const sev = SEVERITY_LABELS[issue.severity] ?? issue.severity;
      return `\n${i + 1}) [${sev}] ${issue.title}\n   التفاصيل: ${issue.detail}\n   الحل المقترح: ${issue.fix}`;
    }),
    "",
    "أرسل هذا التقرير إلى المطوّر لتطبيق الإصلاحات المقترحة فوراً.",
  ];
  return lines.join("\n");
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {hint}
          </Badge>
        </div>
        <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

/**
 * «المدير الآلي» — ذكاء اصطناعي يدير شؤون الموقع تلقائياً كل 15 دقيقة.
 * يراجع البلاغات ويطبّق العقوبات وينظّف الغرف ويرفع العقوبات على المتكررين،
 * ثم يكتب تقريراً جاهزاً بالإصلاحات يُرسل للمطوّر فيُطبَّق فوراً.
 */
// Convex rejects non-ASCII field names, so perCategory keys are slugified on the server.
const slugify = (s: string): string => s.replace(/[^\x20-\x7E]/g, "_");

export function AdminAiTab({ settings }: { settings: SettingsData }) {
  const updateSettings = useMutation(api.owner.updateSettings);
  const reports = useQuery(api.owner.getAdminReports, {});
  const rules = useQuery(api.owner.getRules);
  const questionBank = useQuery(api.owner.getQuestionBank);
  const aiQueue = useQuery(api.aiQuestions.getAiQuestionQueue);
  const clientErrors = useQuery(api.owner.listClientErrors);
  const runSweepNow = useAction(api.autoAdmin.runSweepNow);
  const generateQuestions = useAction(api.aiQuestions.generateQuestions);
  const runVerifier = useAction(api.aiVerifier.verifyPendingQuestions);
  const approveQuestion = useMutation(api.aiQuestions.approveQuestion);
  const rejectQuestion = useMutation(api.aiQuestions.rejectQuestion);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState(settings.siteUrl);
  const [genCategory, setGenCategory] = useState<string>(CATEGORIES[0]);
  const [genCount, setGenCount] = useState(6);
  const [genBusy, setGenBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [verifierBusy, setVerifierBusy] = useState(false);
  const [verifierAutoApply, setVerifierAutoApply] = useState(false);
  const [verifierResult, setVerifierResult] = useState<{
    checked: number;
    passed: number;
    fixedCount: number;
    rejected: number;
  } | null>(null);

  const latest = reports?.[0];

  const saveSiteUrl = async () => {
    setBusy(true);
    try {
      await updateSettings({ siteUrl: siteUrl.trim() });
      toast.success("تم حفظ رابط الموقع الرسمي — روابط تحميل APK تعمل الآن من التطبيق.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async (v: boolean) => {
    setBusy(true);
    try {
      await updateSettings({ aiAdminEnabled: v });
      toast.success(
        v ? "المدير الآلي يعمل الآن كل 15 دقيقة تلقائياً." : "تم إيقاف المدير الآلي.",
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await runSweepNow();
      toast.success("اكتمل الفحص الآلي — التقرير يظهر فوراً أدناه.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر تشغيل الفحص.");
    } finally {
      setRunning(false);
    }
  };

  const handleCopyReport = async () => {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(buildReportText(latest));
      setCopied(true);
      toast.success("نُسخ التقرير — الصقه هنا في المحادثة لحل المشاكل فوراً.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ.");
    }
  };

  /** Feature 23: تصدير نسخة احتياطية كاملة (الإعدادات + القوانين + حالة بنك الأسئلة). */
  const handleExportBackup = async () => {
    if (rules == null || questionBank == null) {
      toast.error("البيانات لم تُحمَّل بعد — انتظر لحظة وأعد المحاولة.");
      return;
    }
    const payload = {
      app: "حرب العقول",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: {
        announcement: settings.announcement,
        announcementActive: settings.announcementActive,
        siteUrl: settings.siteUrl,
        aiEnabled: settings.aiEnabled,
        aiAutoApply: settings.aiAutoApply,
        aiAdminEnabled: settings.aiAdminEnabled,
        antiCheatEnabled: settings.antiCheatEnabled,
        aiModel: settings.aiModel,
      },
      rules: rules.map((r) => ({
        title: r.title,
        category: r.category,
        description: r.description,
        severity: r.severity,
        order: r.order,
      })),
      questionBank: questionBank.map((q) => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        disabled: q.disabled,
      })),
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `zaka-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("نُسِّخت النسخة الاحتياطية — احفظ الملف في مكان آمن.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر التصدير.");
    }
  };

  /** Feature 24: توليد دفعة أسئلة جديدة بالذكاء الاصطناعي (زر يدوي). */
  const handleGenerate = async () => {
    setGenBusy(true);
    try {
      const result = await generateQuestions({
        category: genCategory,
        count: genCount,
      });
      toast.success(
        `وُلّد ${result.created} سؤالاً جديداً في فئة «${genCategory}» — راجعها واعتمدها بالأسفل.`,
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر التوليد.");
    } finally {
      setGenBusy(false);
    }
  };

  /** 🧠 مدقق العقول — يفحص الطابور المعلّق ويصحح/يرفض آلياً حسب اختيار المالك. */
  const handleRunVerifier = async () => {
    setVerifierBusy(true);
    setVerifierResult(null);
    try {
      const result = await runVerifier({
        limit: 10,
        autoApply: verifierAutoApply,
      });
      setVerifierResult(result);
      if (result.checked === 0) {
        toast.info("لا أسئلة جديدة بانتظار التدقيق.");
      } else if (verifierAutoApply) {
        toast.success(
          `اكتمل التدقيق: ${result.passed} سليم اعتُمد، ${result.fixedCount} صُحح واعتُمد، ${result.rejected} رُفض.`,
        );
      } else {
        toast.success(
          `اكتمل التدقيق: ${result.passed} سليم، ${result.fixedCount} يحتاج تصحيحاً، ${result.rejected} مرفوض — راجع الأحكام في الطابور.`,
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر تشغيل المدقق.",
      );
    } finally {
      setVerifierBusy(false);
    }
  };

  const handleApprove = async (id: Id<"aiQuestions">) => {
    setActingId(id);
    try {
      await approveQuestion({ id });
      toast.success("اعتُمد السؤال — يدخل الجولات فوراً ✨");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الاعتماد.");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: Id<"aiQuestions">) => {
    setActingId(id);
    try {
      await rejectQuestion({ id });
      toast.success("رُفض السؤال — لن يدخل الجولات.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الرفض.");
    } finally {
      setActingId(null);
    }
  };

  const pendingCount = aiQueue?.pending.length ?? 0;
  const bankTotal = questionBank?.length ?? 0;
  const bankDisabled = (questionBank ?? []).filter((q) => q.disabled).length;

  return (
    <div className="space-y-5">
      {/* Site URL — needed by the Android APK so in-app downloads work */}
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
              AI-02
            </span>
            <div>
              <h3 className="font-bold text-foreground">رابط الموقع الرسمي (لتطبيق أندرويد)</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                رابط الموقع العام حيث يُخدَّم ملف APK — يلزم فقط لتطبيق أندرويد
                ليحمّل التحديثات من داخل التطبيق. المتصفح يعرف نطاقه تلقائياً،
                فاركه فارغاً إن لم تصدر تحديثات للتطبيق.
              </p>
            </div>
          </div>
          <div className="relative">
            <Globe className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              dir="ltr"
              placeholder="https://zaka.example.com"
              className="rounded-xl ps-9 text-end font-mono text-sm"
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="size-3.5 text-primary" />
              مثال: https://zaka.example.com — بدون شرطة مائلة في النهاية.
            </p>
            <Button onClick={saveSiteUrl} disabled={busy} variant="outline" className="gap-1.5 rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              حفظ الرابط
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Master switch + schedule */}
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
              AI-01
            </span>
            <div>
              <h3 className="font-bold text-foreground">المدير الآلي — إدارة ذاتية كاملة</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                ذكاء اصطناعي يدير شؤون الموقع بنفسه: يراجع البلاغات، يطبّق العقوبات،
                ينظّف الغرف القديمة، ويرفع العقوبات على المخالفين المتكررين — كل 15
                دقيقة دون أي تدخل بشري. كل قرار مسجّل، وكل جولة فحص تُكتب كتقرير جاهز
                بالإصلاحات.
              </p>
            </div>
          </div>

          {!settings.aiKeyConfigured && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-700">لا يوجد نظام AI مُفعّل</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  المدير الآلي يعمل على التنظيف والتصعيد، لكنه لا يستطيع مراجعة البلاغات
                  بالذكاء الاصطناعي حتى تُفعّل النظام الأول (مفتاح + رابط) أو الثاني
                  (مفتاح فقط) من تبويب «مركز API» في غرفة المالك.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Bot className="size-4 text-primary" />
                تفعيل المدير الآلي
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                يعمل تلقائياً كل 15 دقيقة عبر مجدول Convex — لا حاجة لفتح الموقع أو لأي مستخدم.
              </p>
            </div>
            <Switch checked={settings.aiAdminEnabled} onCheckedChange={toggleAdmin} disabled={busy} />
          </div>
          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Timer className="size-4 text-primary" />
              آخر فحص:{" "}
              <span className="font-bold text-foreground">
                {latest ? fmtDate(latest.createdAt) : "لم يجرِ بعد — سيعمل خلال 15 دقيقة"}
              </span>
              {settings.aiAdminEnabled && latest && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  <Activity className="size-3" />
                  التالي تلقائياً
                </Badge>
              )}
            </div>
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={handleRunNow} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              تشغيل الفحص الآن
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Latest report */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </span>
            <span>آخر تقرير للمدير الآلي</span>
            {latest && (
              <span className="ms-auto flex items-center gap-2">
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {fmtDate(latest.createdAt)}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopyReport}>
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "نُسخ ✓" : "نسخ التقرير للمطوّر"}
                </Button>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports === undefined ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !latest ? (
            <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center">
              <Bot className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                لا تقارير بعد — أول فحص تلقائي خلال 15 دقيقة، أو اضغط «تشغيل الفحص الآن».
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm font-semibold leading-relaxed">
                {latest.summary}
              </p>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard icon={Bot} label="بلاغات رُوجعت" value={latest.stats.reportsReviewed} hint="AI" />
                <StatCard icon={Gavel} label="عقوبات طُبقت" value={latest.stats.punishmentsApplied} hint="تلقائي" />
                <StatCard icon={Eraser} label="غرف نُظفت" value={latest.stats.roomsCleaned} hint="تلقائي" />
                <StatCard icon={Ban} label="محظورون الآن" value={latest.stats.bannedUsers} hint="حالياً" />
                <StatCard icon={Gamepad2} label="غرف نشطة" value={latest.stats.activeRooms} hint="الآن" />
                <StatCard icon={Flag} label="بلاغات متبقية" value={latest.stats.openReportsLeft} hint="مفتوحة" />
                <StatCard icon={UserCog} label="مخالفون أُديروا" value={latest.stats.usersEscalated} hint="كتم تلقائي" />
                <StatCard icon={Zap} label="إصلاحات ذاتية" value={latest.stats.autoFixes} hint="بدون تدخل" />
                <StatCard
                  icon={Smartphone}
                  label="فشل تنزيل APK"
                  value={latest.stats.downloadFailures ?? 0}
                  hint="آخر 24 ساعة"
                />
                <StatCard icon={ShieldCheck} label="الوضع" value={1} hint="المدير يعمل" />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-muted-foreground">المشاكل المكتشفة والحلول الجاهزة:</p>
                {latest.issues.map((issue, i) => (
                  <div
                    key={`${issue.title}-${i}`}
                    className={cn(
                      "rounded-2xl border p-4",
                      SEVERITY_TONES[issue.severity] ?? SEVERITY_TONES.low,
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {SEVERITY_LABELS[issue.severity] ?? issue.severity}
                      </Badge>
                      <p className="text-sm font-bold">{issue.title}</p>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{issue.detail}</p>
                    <div className="mt-3 rounded-xl border border-border/60 bg-background/70 p-3">
                      <p className="text-[11px] font-bold text-primary">الحل المقترح:</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                        {issue.fix}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                لا تطبّق الإصلاحات البرمجية نفسها تلقائياً (الموقع لا يستطيع تعديل كوده بنفسه)،
                لكن التقرير الجاهز أعلاه — بزر «نسخ التقرير للمطوّر» — يُرسل هنا في المحادثة
                ويُطبَّق فوراً. العقوبات والتنظيف والتشغيل كلها تلقائية بالكامل.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </span>
            <span>سجل تقارير المدير الآلي</span>
            <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {(reports?.length ?? 0) - (latest ? 1 : 0)} فحص سابق
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(reports ?? []).slice(1).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              لا فحوصات سابقة — أول فحص خلال 15 دقيقة.
            </p>
          ) : (
            (reports ?? []).slice(1).map((report) => (
              <div key={report.id} className="rounded-xl border border-border/60 bg-muted/30">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-start"
                  onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{report.summary}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge
                      className={cn(
                        "rounded-full",
                        report.issues.some((i) => i.severity === "high")
                          ? "bg-rose-500/10 text-rose-700"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {report.issues.length} مشكلة
                    </Badge>
                    {fmtDate(report.createdAt)}
                  </span>
                </button>
                {expanded === report.id && (
                  <div className="border-t border-border/60 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2 pb-3 text-[11px] text-muted-foreground sm:grid-cols-4">
                      <span>بلاغات: {report.stats.reportsReviewed}</span>
                      <span>عقوبات: {report.stats.punishmentsApplied}</span>
                      <span>غرف: {report.stats.roomsCleaned}</span>
                      <span>مخالفون: {report.stats.usersEscalated}</span>
                    </div>
                    <div className="space-y-2">
                      {report.issues.map((issue, i) => (
                        <div key={`${issue.title}-${i}`} className="rounded-lg border border-border/60 bg-card p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full text-[10px]">
                              {SEVERITY_LABELS[issue.severity] ?? issue.severity}
                            </Badge>
                            <p className="text-xs font-bold">{issue.title}</p>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{issue.detail}</p>
                          <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">
                            <span className="font-bold text-primary">الحل: </span>
                            {issue.fix}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Feature 22: question-bank health — per-category coverage at a glance */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </span>
            <span>صحة بنك الأسئلة (ميزة 22)</span>
            <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {bankTotal} سؤال
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums">{bankTotal}</p>
              <p className="text-[11px] font-medium text-muted-foreground">إجمالي الأسئلة</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums">{bankTotal - bankDisabled}</p>
              <p className="text-[11px] font-medium text-muted-foreground">نشطة في الجولات</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums text-amber-600">{bankDisabled}</p>
              <p className="text-[11px] font-medium text-muted-foreground">معطّلة مؤقتاً</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums text-primary">{CATEGORIES.length}</p>
              <p className="text-[11px] font-medium text-muted-foreground">فئة معرفية</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const count = (questionBank ?? []).filter(
                (q) => q.category === c && !q.disabled,
              ).length;
              return (
                <span
                  key={c}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    count === 0
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-600"
                      : count < 5
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        : "border-border/70 bg-card text-foreground",
                  )}
                >
                  {c} · {count}
                </span>
              );
            })}
          </div>
          {(CATEGORIES.some((c) => !(questionBank ?? []).some((q) => q.category === c && !q.disabled)) ||
            bankTotal - bankDisabled < 20) && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              بعض الفئات بلا أسئلة نشطة، أو البنك صغير — قد تصدر جولات بدون أسئلة
              من فئة معينة عند اختيارها. أعد تفعيل أسئلة من تلك الفئة، أو أبلغ
              المطوّر ليضيف أسئلة جديدة.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Feature 24: AI question generator — auto-refills weak categories + owner review */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BrainCircuit className="size-4" />
            </span>
            <span>مولّد الأسئلة الذكي (ميزة 24)</span>
            <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
              OpenRouter
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            ذكاء اصطناعي يملأ بنك الأسئلة بنفسه: يراقب المدير الآلي صحة كل فئة
            كل 15 دقيقة، وإن وجد فئة ضعيفة (أقل من 12 سؤالاً نشطاً) يولّد دفعة
            جديدة تلقائياً هنا. اعتمد الأسئلة المناسبة بزر واحد فتدخل الجولات
            فوراً.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums text-primary">
                {pendingCount}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">بانتظار المراجعة</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums text-emerald-600">
                {aiQueue?.approvedCount ?? 0}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">معتمدة في الجولات</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums text-rose-600">
                {aiQueue?.rejectedCount ?? 0}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">مرفوضة</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-lg font-bold tabular-nums">
                {Object.keys(aiQueue?.perCategory ?? {}).filter(
                  (c) => (aiQueue?.perCategory[c] ?? 0) < 12,
                ).length}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">فئات ضعيفة (أقل من 12)</p>
            </div>
          </div>

          {/* Manual generation controls */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <RefreshCw className="size-3.5 text-primary" />
              توليد يدوي الآن
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-44">
                <ListChecks className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  disabled={genBusy}
                  className="h-9 w-full rounded-xl border border-border/70 bg-background ps-9 pe-3 text-sm font-medium outline-none transition-colors focus:border-primary disabled:opacity-50"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c} ({(aiQueue?.perCategory[slugify(c)] ?? 0)} نشط)
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                disabled={genBusy}
                className="h-9 w-24 rounded-xl border border-border/70 bg-background px-3 text-sm font-medium outline-none transition-colors focus:border-primary disabled:opacity-50"
              >
                {[3, 6, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} أسئلة
                  </option>
                ))}
              </select>
              <Button
                onClick={handleGenerate}
                disabled={genBusy || !settings.aiKeyConfigured}
                className="gap-1.5 rounded-xl"
              >
                {genBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BrainCircuit className="size-4" />
                )}
                {genBusy ? "جارٍ التوليد…" : "توليد الآن"}
              </Button>
            </div>
            {!settings.aiKeyConfigured && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-rose-600">
                <AlertTriangle className="size-3.5 shrink-0" />
فعّل أحد نظامي مركز API (مفتاح + رابط / مفتاح فقط) في غرفة المالك لتفعيل التوليد.
              </p>
            )}
          </div>

          {/* 🧠 مدقق العقول — التدقيق الآلي قبل الاعتماد */}
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold">
                <ScanSearch className="size-3.5 text-violet-600" />
                مدقّق العقول — فحص ذكي قبل الاعتماد
              </p>
              <label className="ms-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={verifierAutoApply}
                  onChange={(e) => setVerifierAutoApply(e.target.checked)}
                  className="size-3.5 accent-violet-600"
                />
                اعتماد/تصحيح/رفض آلي
              </label>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              يفحص كل سؤال معلّق: صحة الإجابة واقعياً، وضوح اللغة، معايرة الصعوبة،
              والتكرار مع البنك. بدون «آلي» يعطي أحكاماً فقط وقرار الاعتماد بيدك.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                onClick={handleRunVerifier}
                disabled={verifierBusy || !settings.aiKeyConfigured}
                className="gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              >
                {verifierBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ScanSearch className="size-4" />
                )}
                {verifierBusy ? "جارٍ التدقيق…" : "دقّق الأسئلة المعلّقة"}
              </Button>
              {verifierResult && verifierResult.checked > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700">
                    ✓ {verifierResult.passed} سليم
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-700">
                    ✎ {verifierResult.fixedCount} قابل للإصلاح
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-rose-500/40 bg-rose-500/10 text-rose-700">
                    ✕ {verifierResult.rejected} مرفوض
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Review queue */}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <ListChecks className="size-3.5 text-primary" />
              طابور المراجعة — اعتمد أو ارفض
            </p>
            {aiQueue === undefined ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingCount === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-border/70 py-8 text-center">
                <Sparkles className="mx-auto size-6 text-muted-foreground/50" />
                <p className="mt-2 text-xs text-muted-foreground">
                  لا أسئلة بانتظار المراجعة — كل شيء معتمد أو مرفوض.
                </p>
              </div>
            ) : aiQueue === null ? (
              <div className="mt-3 rounded-2xl border border-dashed border-border/70 py-8 text-center">
                <ShieldCheck className="mx-auto size-6 text-muted-foreground/50" />
                <p className="mt-2 text-xs text-muted-foreground">غير متاح.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {aiQueue.pending.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full bg-primary/10 text-[10px] text-primary"
                      >
                        {q.category}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {DIFFICULTY_LABELS[q.difficulty as keyof typeof DIFFICULTY_LABELS] ?? q.difficulty}
                      </Badge>
                      <span className="ms-auto text-[10px] text-muted-foreground">
                        {fmtDate(q.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{q.question}</p>
                    {q.verification && (
                      <div
                        className={cn(
                          "mt-2 rounded-xl border px-3 py-2",
                          q.verification.verdict === "pass"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : q.verification.verdict === "fixable"
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-rose-500/30 bg-rose-500/5",
                        )}
                      >
                        <p className="flex items-center gap-1.5 text-[11px] font-bold">
                          {q.verification.verdict === "pass" ? (
                            <span className="text-emerald-700">✓ حكم المدقق: سليم ({q.verification.score}%)</span>
                          ) : q.verification.verdict === "fixable" ? (
                            <span className="text-amber-700">✎ حكم المدقق: قابل للإصلاح ({q.verification.score}%)</span>
                          ) : (
                            <span className="text-rose-700">✕ حكم المدقق: مرفوض ({q.verification.score}%)</span>
                          )}
                        </p>
                        {q.verification.issues.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
                            {q.verification.issues.map((issue, i) => (
                              <li key={i}>• {issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {q.options.map((opt, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs",
                            i === q.correctIndex
                              ? "border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-700"
                              : "border-border/60 bg-background text-muted-foreground",
                          )}
                        >
                          {i === q.correctIndex && <Check className="size-3 shrink-0" />}
                          <span className="truncate">{opt}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 gap-1 rounded-lg text-xs"
                        onClick={() => handleApprove(q.id)}
                        disabled={actingId === q.id}
                      >
                        {actingId === q.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 rounded-lg text-xs text-rose-600 hover:text-rose-700"
                        onClick={() => handleReject(q.id)}
                        disabled={actingId === q.id}
                      >
                        <X className="size-3.5" />
                        رفض
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client error inbox: auto-captured runtime errors from devices */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Bug className="size-4" />
            </span>
            <span>صندوق أخطاء الأجهزة</span>
            <Badge
              variant="outline"
              className="ms-auto gap-1 rounded-full text-[10px]"
            >
              {(clientErrors ?? []).length} خطأ مسجّل
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            أي خطأ يحدث في متصفح أو تطبيق أي لاعب يُرسل هنا تلقائياً (مجمّع
            ومكرّره محسوب) — فتعرف فوراً بأي مشكلة تقنية قبل أن يشكو أحد.
          </p>
          {clientErrors === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (clientErrors ?? []).length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600" />
              لا أخطاء مسجّلة — كل شيء يعمل بسلاسة.
            </div>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-auto">
              {(clientErrors ?? []).map((err) => (
                <li
                  key={err._id}
                  className="rounded-xl border border-border/60 bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-foreground" dir="ltr">
                      {err.message}
                    </p>
                    <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                      ×{err.count}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{fmtDate(err.lastSeen)}</span>
                    {err.route && <span className="font-mono" dir="ltr">{err.route}</span>}
                    {err.stack && (
                      <details className="flex-1">
                        <summary className="cursor-pointer font-semibold text-primary">
                          التفاصيل
                        </summary>
                        <pre
                          dir="ltr"
                          className="mt-1.5 max-h-28 overflow-auto rounded-lg border border-border/60 bg-background/60 p-2 text-[9px] leading-4"
                        >
                          {err.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Feature 23: backup & export center */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="size-4" />
            </span>
            <span>النسخ الاحتياطي (ميزة 23)</span>
            <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
              الإصدار {APP_VERSION}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            صدِّر كل إعدادات الموقع (الإعلان، الرابط الرسمي، إعدادات الرقابة
            والذكاء الاصطناعي) مع القوانين النشطة وحالة بنك الأسئلة في ملف JSON
            واحد — لنسخه احتياطياً أو نقله إلى نسخة أخرى من الموقع.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={handleExportBackup}>
              <FileDown className="size-4" />
              تصدير نسخة احتياطية
            </Button>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Database className="size-3.5 text-primary" />
              {rules?.length ?? 0} قانون · {bankTotal} سؤال · إعدادات كاملة
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
