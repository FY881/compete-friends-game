import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AiVerdict } from "@/convex/moderation";
import type { ReportRow } from "@/convex/owner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Flag,
  AlertTriangle,
  Bot,
  Ban,
  MicOff,
  Gavel,
  Check,
  Loader2,
  Search,
  Shield,
  ChevronDown,
  ChevronUp,
  Trash2,
  User,
  Sparkles,
} from "lucide-react";

function PriorityBadge({ high }: { high: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 rounded-full text-[10px] border",
        high
          ? "border-rose-500/30 bg-rose-500/10 text-rose-700"
          : "border-blue-500/30 bg-blue-500/10 text-blue-700",
      )}
    >
      {high ? <AlertTriangle className="size-2.5" /> : <Shield className="size-2.5" />}
      {high ? "عاجل" : "عادي"}
    </Badge>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export function ReportsInbox() {
  const reports = useQuery(api.owner.getReports);
  const resolveReport = useMutation(api.owner.resolveReport);
  const applyPunishment = useMutation(api.owner.applyPunishment);
  const aiModerateContent = useAction(
    api.moderation.aiModerateContent,
  ) as unknown as (
    args: { content: string; context?: string },
  ) => Promise<AiVerdict>;

  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "high" | "analyzed">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [punishDialog, setPunishDialog] = useState<{ report: ReportRow; action: "warn" | "mute" | "ban" } | null>(null);
  const [punishReason, setPunishReason] = useState("");
  const [punishDuration, setPunishDuration] = useState("60");

  const isHigh = (r: ReportRow) => (r.aiVerdict?.severity === "high");

  const filteredReports = (reports ?? [])
    .filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          r.targetName?.toLowerCase().includes(q) ||
          r.reporterName?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .filter((r) => {
      if (filterStatus === "high") return isHigh(r);
      if (filterStatus === "analyzed") return !!r.aiVerdict;
      return true;
    })
    .sort((a, b) => {
      if (isHigh(a) && !isHigh(b)) return -1;
      if (!isHigh(a) && isHigh(b)) return 1;
      return b.createdAt - a.createdAt;
    });

  const analyze = async (report: ReportRow) => {
    setAnalyzing(report.id);
    try {
      const verdict = await aiModerateContent({
        content: `اللاعب المُبلَّغ عنه: ${report.targetName}\nسبب البلاغ: ${report.reason}${report.details ? `\nالتفاصيل: ${report.details}` : ""}`,
        context: `مُقدِّم البلاغ: ${report.reporterName}`,
      });
      setVerdicts((v) => ({ ...v, [report.id]: verdict }));
      toast.success("تم تحليل البلاغ بالذكاء الاصطناعي.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الفحص.");
    } finally {
      setAnalyzing(null);
    }
  };

  const applyAi = async (report: ReportRow) => {
    const verdict = verdicts[report.id] ?? report.aiVerdict;
    if (!verdict || verdict.compliant || verdict.suggestedAction === "none") return;
    setApplying(report.id);
    try {
      await applyPunishment({
        userId: report.targetId as never,
        type: verdict.suggestedAction,
        durationMs: verdict.suggestedDurationMs ?? undefined,
        reason: `عقوبة AI: ${verdict.violation ?? verdict.reasoning}`,
      });
      await resolveReport({ reportId: report.id as never, status: "reviewed" });
      toast.success("تم تطبيق العقوبة.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ.");
    } finally {
      setApplying(null);
    }
  };

  const dismiss = async (report: ReportRow) => {
    try {
      await resolveReport({ reportId: report.id as never, status: "dismissed" });
      toast.success("تم تجاهل البلاغ.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ.");
    }
  };

  const applyManual = async () => {
    if (!punishDialog) return;
    setApplying(punishDialog.report.id);
    try {
      await applyPunishment({
        userId: punishDialog.report.targetId as never,
        type: punishDialog.action,
        durationMs: punishDialog.action !== "warn" ? parseInt(punishDuration) * 60 * 1000 : undefined,
        reason: punishReason || "عقوبة يدوية",
      });
      await resolveReport({ reportId: punishDialog.report.id as never, status: "reviewed" });
      toast.success("تم تطبيق العقوبة.");
      setPunishDialog(null);
      setPunishReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ.");
    } finally {
      setApplying(null);
    }
  };

  const openCount = reports?.filter((r) => r.status === "open").length ?? 0;
  const highCount = reports?.filter((r) => r.status === "open" && isHigh(r)).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">صندوق البلاغات الذكي</h3>
          <p className="text-[11px] text-muted-foreground">تحليل AI + فلاتر + إجراءات سريعة</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 rounded-full text-[10px]">
            <Flag className="size-2.5 text-rose-500" /> {openCount} مفتوح
          </Badge>
          {highCount > 0 && (
            <Badge variant="outline" className="gap-1 rounded-full border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700">
              <AlertTriangle className="size-2.5" /> {highCount} عاجل
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في البلاغات…" className="h-9 rounded-xl ps-8 text-xs" />
        </div>
        <div className="flex gap-1">
          {([["all", "الكل"], ["high", "عاجل"], ["analyzed", "محلل"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilterStatus(key)}
              className={cn("rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                filterStatus === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {reports == null ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 py-12 text-center">
          <Shield className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">{search ? "لا توجد بلاغات مطابقة" : "لا توجد بلاغات 🕊️"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReports.map((report) => {
            const verdict = verdicts[report.id] ?? report.aiVerdict;
            const reportIsHigh = isHigh(report);
            return (
              <Card key={report.id} className={cn("transition-all duration-200", reportIsHigh ? "border-rose-500/30 bg-rose-500/5" : "border-border/60")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                      reportIsHigh ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600")}>
                      <Flag className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{report.targetName}</p>
                        <PriorityBadge high={reportIsHigh} />
                        {verdict && !verdict.compliant && (
                          <Badge variant="outline" className="gap-1 rounded-full border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-700">
                            <Bot className="size-2.5" /> محلل
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <User className="inline size-3" /> {report.reporterName} — {report.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{timeAgo(report.createdAt)}</span>
                      <button type="button" onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                        {expanded === report.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expanded === report.id && (
                    <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
                      {report.details && (
                        <p className="text-xs text-muted-foreground"><span className="font-semibold">التفاصيل:</span> {report.details}</p>
                      )}
                      {verdict && (
                        <div className={cn("rounded-xl border p-3 text-xs",
                          verdict.compliant ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5")}>
                          <div className="flex items-center gap-2">
                            <Bot className="size-3.5" />
                            <span className="font-bold">{verdict.compliant ? "لا مخالفة" : "مخالفة مكتشفة"}</span>
                          </div>
                          <p className="mt-1 text-muted-foreground">{verdict.reasoning}</p>
                          {!verdict.compliant && verdict.suggestedAction !== "none" && (
                            <p className="mt-1 font-semibold text-rose-700">الإجراء: {verdict.suggestedAction}</p>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {!verdict && (
                          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-[11px]"
                            onClick={() => analyze(report)} disabled={analyzing === report.id}>
                            {analyzing === report.id ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                            تحليل بالـ AI
                          </Button>
                        )}
                        {verdict && !verdict.compliant && verdict.suggestedAction !== "none" && (
                          <Button size="sm" className="gap-1.5 rounded-xl bg-rose-600 text-[11px] hover:bg-rose-700"
                            onClick={() => applyAi(report)} disabled={applying === report.id}>
                            {applying === report.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                            تطبيق العقوبة
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-[11px]"
                          onClick={() => setPunishDialog({ report, action: "warn" })}>
                          <Gavel className="size-3" /> عقوبة يدوية
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 rounded-xl text-[11px] text-muted-foreground"
                          onClick={() => dismiss(report)}>
                          <Trash2 className="size-3" /> تجاهل
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!punishDialog} onOpenChange={(o) => { if (!o) setPunishDialog(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">عقوبة على {punishDialog?.report.targetName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["warn", "mute", "ban"] as const).map((action) => (
                <Button key={action} size="sm" variant={punishDialog?.action === action ? "default" : "outline"}
                  className="flex-1 gap-1.5 rounded-xl text-xs"
                  onClick={() => setPunishDialog((p) => p ? { ...p, action } : null)}>
                  {action === "warn" && <AlertTriangle className="size-3" />}
                  {action === "mute" && <MicOff className="size-3" />}
                  {action === "ban" && <Ban className="size-3" />}
                  {action === "warn" ? "تحذير" : action === "mute" ? "كتم" : "حظر"}
                </Button>
              ))}
            </div>
            {punishDialog?.action !== "warn" && (
              <div>
                <label className="mb-1 block text-xs font-medium">المدة (بالدقائق)</label>
                <Input type="number" value={punishDuration} onChange={(e) => setPunishDuration(e.target.value)}
                  className="h-9 rounded-xl text-xs" min="1" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium">السبب</label>
              <Textarea value={punishReason} onChange={(e) => setPunishReason(e.target.value)}
                placeholder="سبب العقوبة…" rows={2} className="rounded-xl text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPunishDialog(null)}>إلغاء</Button>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={applyManual}
              disabled={applying === punishDialog?.report.id}>
              {applying === punishDialog?.report.id ? <Loader2 className="size-3 animate-spin" /> : <Gavel className="size-3" />}
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
