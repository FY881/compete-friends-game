import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { SettingsData } from "@/convex/owner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Ban,
  Bot,
  Check,
  Copy,
  Eraser,
  Flag,
  Gamepad2,
  Gavel,
  Globe,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  Timer,
  Smartphone,
  UserCog,
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
export function AdminAiTab({ settings }: { settings: SettingsData }) {
  const updateSettings = useMutation(api.owner.updateSettings);
  const reports = useQuery(api.owner.getAdminReports, {});
  const runSweepNow = useAction(api.autoAdmin.runSweepNow);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState(settings.siteUrl);

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
              placeholder="https://alabqari.example.com"
              className="rounded-xl ps-9 text-end font-mono text-sm"
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="size-3.5 text-primary" />
              مثال: https://alabqari.example.com — بدون شرطة مائلة في النهاية.
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
                <p className="text-sm font-bold text-rose-700">مفتاح OpenRouter غير مضبوط</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  المدير الآلي يعمل على التنظيف والتصعيد، لكنه لا يستطيع مراجعة البلاغات
                  بالذكاء الاصطناعي حتى تضيف{" "}
                  <span className="font-mono font-bold text-foreground">OPENROUTER_API_KEY</span>{" "}
                  في تبويب «المفاتيح / API Keys».
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
    </div>
  );
}
