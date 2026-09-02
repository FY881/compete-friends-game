/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚖️ LAW ENFORCEMENT TAB — لوحة تحكم إنفاذ القوانين
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Gavel,
  Loader2,
  Scale,
  Shield,
  ShieldCheck,
  ShieldX,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

const SEVERITY_COLORS = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-400" },
  medium: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-400" },
  high: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-400" },
};

const ACTION_LABELS: Record<string, string> = {
  none: "لا إجراء",
  warn: "تحذير",
  mute: "كتم",
  ban: "حظر",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500",
  reviewed: "bg-emerald-500",
  dismissed: "bg-gray-400",
};

export function LawEnforcementTab() {
  const [seeding, setSeeding] = useState(false);
  const seedRules = useMutation(api.lawEnforcement.seedRules);
  const processReport = useMutation(api.lawEnforcement.processReport);

  const rules = useQuery(api.lawEnforcement.getRules);
  const pendingReports = useQuery(api.lawEnforcement.getPendingReports, { limit: 20 });
  const stats = useQuery(api.lawEnforcement.getReportStats);

  const handleSeedRules = async () => {
    setSeeding(true);
    try {
      const res = await seedRules();
      toast.success(res.message);
    } catch (e) {
      toast.error("خطأ في إدخال القوانين");
    } finally {
      setSeeding(false);
    }
  };

  const handleProcessReport = async (reportId: string) => {
    try {
      const result = await processReport({ reportId: reportId as any });
      if (result?.analysis) {
        const a = result.analysis;
        toast.success(
          `تحليل AI: ${a.valid ? "صالح" : "غير صالح"} (${a.confidence}% ثقة) — ${ACTION_LABELS[a.suggestedAction] || a.suggestedAction}`,
        );
      }
    } catch (e) {
      toast.error("خطأ في معالجة البلاغ");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-400/30">
            <Scale className="size-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">⚖️ إنفاذ القوانين الذكي</h2>
            <p className="text-xs text-muted-foreground">نظام AI يراقب ويطبق 20 قانوناً تلقائياً</p>
          </div>
        </div>
        <Button onClick={handleSeedRules} disabled={seeding} size="sm" className="gap-1.5">
          {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          إدخال القوانين
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">إجمالي البلاغات</p>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              </div>
              <Shield className="size-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">بانتظار المراجعة</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.open ?? 0}</p>
              </div>
              <AlertTriangle className="size-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">معالجة بالـ AI</p>
                <p className="text-2xl font-bold text-emerald-600">{stats?.aiProcessed ?? 0}</p>
              </div>
              <Sparkles className="size-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">دقة الـ AI</p>
                <p className="text-2xl font-bold text-violet-600">{stats?.aiAccuracy ?? 0}%</p>
              </div>
              <Scale className="size-8 text-violet-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Reports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-orange-500" />
            البلاغات المعلقة
            {pendingReports && pendingReports.length > 0 && (
              <Badge className="bg-orange-500 text-white text-[10px]">{pendingReports.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingReports || pendingReports.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا توجد بلاغات معلقة 🎉</p>
          ) : (
            <div className="space-y-3">
              {pendingReports.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{r.reporterName}</span>
                        <span className="text-[10px] text-muted-foreground">أبلغ عن</span>
                        <span className="text-xs font-bold text-primary">{r.targetName}</span>
                        <Badge
                          className={`text-[9px] text-white ${STATUS_COLORS[r.status]}`}
                        >
                          {r.status === "open" ? "مفتوح" : r.status === "reviewed" ? "تمت المراجعة" : "مرفوض"}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        السبب: {r.reason}
                      </p>
                      {r.details && (
                        <p className="mt-1 text-xs text-muted-foreground/70">{r.details}</p>
                      )}

                      {/* AI Verdict */}
                      {r.aiVerdictParsed && (
                        <div className={`mt-3 rounded-lg border p-3 ${
                          r.aiVerdictParsed.severity === "high"
                            ? "border-red-400/30 bg-red-500/5"
                            : r.aiVerdictParsed.severity === "medium"
                            ? "border-orange-400/30 bg-orange-500/5"
                            : "border-emerald-400/30 bg-emerald-500/5"
                        }`}>
                          <div className="flex items-center gap-2 text-xs">
                            <Sparkles className="size-3 text-violet-500" />
                            <span className="font-bold">تحليل AI:</span>
                            <span className={r.aiVerdictParsed.compliant ? "text-emerald-600" : "text-red-600"}>
                              {r.aiVerdictParsed.compliant ? "غير مخالف" : "مخالف"}
                            </span>
                            <span className="text-muted-foreground">—</span>
                            <span className={`font-bold ${
                              SEVERITY_COLORS[r.aiVerdictParsed.severity]?.text || "text-muted-foreground"
                            }`}>
                              خطورة: {r.aiVerdictParsed.severity === "high" ? "عالية" : r.aiVerdictParsed.severity === "medium" ? "متوسطة" : "منخفضة"}
                            </span>
                            <span className="text-muted-foreground">—</span>
                            <span className="font-bold">
                              الإجراء: {ACTION_LABELS[r.aiVerdictParsed.suggestedAction] || r.aiVerdictParsed.suggestedAction}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            {r.aiVerdictParsed.reasoning}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Process button */}
                    {r.status === "open" && (
                      <Button
                        size="sm"
                        onClick={() => handleProcessReport(r._id)}
                        className="gap-1.5 shrink-0"
                      >
                        <Scale className="size-3" />
                        معالجة
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground/50">
                    {new Date(r.createdAt).toLocaleDateString("ar-SA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gavel className="size-4 text-amber-500" />
            القوانين النشطة
            {rules && (
              <Badge variant="outline" className="text-[10px]">{rules.length} قانون</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!rules || rules.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">القوانين غير مدخلة بعد</p>
              <Button onClick={handleSeedRules} disabled={seeding} size="sm" className="mt-2 gap-1.5">
                <Sparkles className="size-3" />
                إدخال الآن
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rules.slice(0, 20).map((rule) => (
                <div
                  key={rule._id}
                  className={`rounded-lg border p-3 ${
                    SEVERITY_COLORS[rule.severity]?.border || "border-border"
                  } ${SEVERITY_COLORS[rule.severity]?.bg || "bg-muted/20"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{rule.title}</span>
                    <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[rule.severity]?.text}`}>
                      {rule.severity === "high" ? "خطيرة" : rule.severity === "medium" ? "متوسطة" : "بسيطة"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
