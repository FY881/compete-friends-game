/**
 * ═══════════════════════════════════════════════════════════════
 * صياد الأخطاء — لوحة تحكم المالك المتقدمة
 * ═══════════════════════════════════════════════════════════════
 *
 * مراقبة حية شاملة:
 * 1. حالة النظام اللحظية (صحي / م degraded / حرج)
 * 2. إحصائيات الأخطاء بالتفصيل
 * 3. قائمة الأخطاء غير المحلولة مع إجراءات
 * 4. مقاييس الأداء (FPS + ذاكرة + شبكة)
 * 5. أنماط الأخطاء المُتعلّمة
 * 6. تحليل AI للأخطاء المتكررة
 */
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bug,
  Shield,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Brain,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
  Loader2,
  ShieldCheck,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// مكونات مساعدة
// ═══════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            color === "green" && "bg-emerald-500/10 text-emerald-600",
            color === "red" && "bg-rose-500/10 text-rose-600",
            color === "amber" && "bg-amber-500/10 text-amber-600",
            color === "blue" && "bg-blue-500/10 text-blue-600",
            color === "primary" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold",
              trend.positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {trend.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.value}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════

export function ErrorHunterTab() {
  const [showResolved, setShowResolved] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  // ── الاستعلامات ──
  const errorStats = useQuery(api.errorHunter.getErrorStats);
  const errors = useQuery(api.errorHunter.getErrors, {
    limit: 30,
    unresolvedOnly: !showResolved,
  });
  const health = useQuery(api.errorHunter.getSystemHealth);
  const perfSummary = useQuery(api.errorHunter.getPerformanceSummary);
  const patterns = useQuery(api.errorHunter.getErrorPatterns);

  // ── الإجراءات ──
  const resolveError = useMutation(api.errorHunter.resolveError);
  const cleanupOld = useMutation(api.errorHunter.cleanupOldErrors);
  const analyzeWithAI = useAction(api.errorHunter.analyzeErrorsWithAI as any);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  async function handleAnalyzeAI() {
    setAiAnalyzing(true);
    try {
      await analyzeWithAI();
    } catch {}
    setAiAnalyzing(false);
  }

  async function handleResolve(errorId: string) {
    await resolveError({ errorId: errorId as any, resolvedBy: "owner" });
  }

  async function handleCleanup() {
    await cleanupOld();
  }

  const statusColor = health?.status === "healthy" ? "green" : health?.status === "degraded" ? "amber" : "red";
  const statusLabel = health?.status === "healthy" ? "صحي ✅" : health?.status === "degraded" ? "مُضعف ⚠️" : "حرج 🚨";

  return (
    <div dir="rtl" className="space-y-6">
      {/* ── العنوان الرئيسي ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bug className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">صياد الأخطاء</h2>
            <p className="text-xs text-muted-foreground">مراقبة وتشخيص وإصلاح شامل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold",
              statusColor === "green" && "bg-emerald-500/10 text-emerald-600",
              statusColor === "amber" && "bg-amber-500/10 text-amber-600",
              statusColor === "red" && "bg-rose-500/10 text-rose-600",
            )}
          >
            <span className={cn("size-1.5 rounded-full", statusColor === "green" ? "bg-emerald-500" : statusColor === "amber" ? "bg-amber-500" : "bg-rose-500")} />
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي الأخطاء"
          value={errorStats?.totalUniqueErrors ?? 0}
          subtitle={`${errorStats?.totalInstances ?? 0} تكرار`}
          icon={Bug}
          color="primary"
        />
        <StatCard
          label="غير محلولة"
          value={errorStats?.unresolvedCount ?? 0}
          subtitle={errorStats?.criticalCount ? `${errorStats.criticalCount} حرج` : "لا حرجة"}
          icon={AlertTriangle}
          color={errorStats?.criticalCount ? "red" : "amber"}
        />
        <StatCard
          label="آخر ساعة"
          value={errorStats?.recent1hCount ?? 0}
          subtitle={`${errorStats?.recent24hCount ?? 0} آخر 24 ساعة`}
          icon={Clock}
          color="blue"
        />
        <StatCard
          label="نسبة الإصلاح"
          value={`${Math.round((errorStats?.healRate ?? 0) * 100)}%`}
          subtitle={`${errorStats?.autoHealedCount ?? 0} إصلاح تلقائي`}
          icon={ShieldCheck}
          color="green"
        />
      </div>

      {/* ── مقاييس الأداء ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Activity className="size-4 text-primary" />
          مقاييس الأداء (آخر ساعة)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {perfSummary?.avgFps ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">FPS متوسط</p>
            {(perfSummary?.avgFps ?? 60) < 30 && (
              <p className="text-[10px] text-rose-600 mt-0.5">⚠ منخفض</p>
            )}
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {perfSummary?.avgLatency ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">زمن استجابة (ms)</p>
            {(perfSummary?.avgLatency ?? 0) > 500 && (
              <p className="text-[10px] text-rose-600 mt-0.5">⚠ بطيء</p>
            )}
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {perfSummary?.avgMemory ?? 0} MB
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">ذاكرة مستخدمة</p>
          </div>
        </div>
      </div>

      {/* ── توزيع الأخطاء حسب الفئة ── */}
      {errorStats?.byCategory && Object.keys(errorStats.byCategory).length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
            <BarChart3 className="size-4 text-primary" />
            توزيع الأخطاء حسب الفئة
          </h3>
          <div className="space-y-2">
            {Object.entries(errorStats.byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const total = errorStats.totalInstances || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-24 text-xs font-medium text-muted-foreground text-start">{cat}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-primary/60"
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-12 text-end">{count}</span>
                    <span className="text-[10px] text-muted-foreground w-10 text-end">({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── أزرار الإجراءات ── */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAnalyzeAI}
          disabled={aiAnalyzing}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {aiAnalyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}
          {aiAnalyzing ? "جارٍ التحليل..." : "تحليل AI"}
        </button>
        <button
          type="button"
          onClick={handleCleanup}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold transition-colors hover:bg-muted"
        >
          <Trash2 className="size-3.5" />
          تنظيف القديم
        </button>
        <button
          type="button"
          onClick={() => setShowResolved(!showResolved)}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold transition-colors hover:bg-muted"
        >
          {showResolved ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showResolved ? "إخفاء المحلولة" : "إظهار المحلولة"}
        </button>
      </div>

      {/* ── قائمة الأخطاء ── */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Bug className="size-4 text-primary" />
          الأخطاء ({errors?.length ?? 0})
        </h3>

        {!errors ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : errors.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <ShieldCheck className="size-8 text-emerald-500/50" />
            <p className="mt-2 text-sm">لا أخطاء مسجّلة — كل شيء يعمل بسلاسة!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error) => (
              <div
                key={error._id}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  error.resolved
                    ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                    : error.severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : error.severity === "high"
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/60 bg-muted/20",
                )}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedError(expandedError === error._id ? null : error._id)}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg",
                      error.severity === "critical" && "bg-rose-500/10 text-rose-600",
                      error.severity === "high" && "bg-amber-500/10 text-amber-600",
                      error.severity === "medium" && "bg-blue-500/10 text-blue-600",
                      error.severity === "low" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {error.resolved ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <Bug className="size-3.5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate">{error.message.slice(0, 60)}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">×{error.count}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{error.category}</span>
                      {error.autoHealed && (
                        <span className="text-[10px] text-emerald-600">✅ تم الإصلاح</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ms-auto">
                        {new Date(error.createdAt).toLocaleDateString("ar")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {expandedError === error._id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedError === error._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 border-t border-border/40 pt-3"
                    >
                      {error.stack && (
                        <pre className="max-h-32 overflow-auto rounded-lg bg-muted/40 p-2 text-[9px] leading-3 text-muted-foreground/90 text-start mb-2">
                          {error.stack.slice(0, 500)}
                        </pre>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">المسار: {error.route || "—"}</span>
                        <span className="text-[10px] text-muted-foreground">أول ظهور: {new Date(error.firstSeen).toLocaleString("ar")}</span>
                        <span className="text-[10px] text-muted-foreground">آخر ظهور: {new Date(error.lastSeen).toLocaleString("ar")}</span>
                      </div>
                      {!error.resolved && (
                        <button
                          type="button"
                          onClick={() => handleResolve(error._id)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20"
                        >
                          <CheckCircle2 className="size-3" />
                          تحديد كمحلول
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── أنماط الأخطاء المُتعلّمة ── */}
      {patterns && patterns.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
            <Brain className="size-4 text-primary" />
            أنماط الأخطاء المُتعلّمة
          </h3>
          <div className="space-y-2">
            {patterns.map((p) => (
              <div key={p._id} className="flex items-center gap-3 rounded-xl bg-muted/20 p-3">
                <Zap className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{p.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{p.category}</span>
                    <span className="text-[10px] text-muted-foreground">×{p.occurrences}</span>
                    <span className="text-[10px] text-muted-foreground">
                      نسبة النجاح: {Math.round(p.successRate * 100)}%
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    p.active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
                  )}
                >
                  {p.autoFixAction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
