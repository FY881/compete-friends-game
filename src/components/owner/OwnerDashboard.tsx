import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Users,
  Gamepad2,
  AlertTriangle,
  Ban,
  Shield,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Brain,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
  Bot,
  ChevronLeft,
} from "lucide-react";
import { HealthPanel } from "./HealthPanel";
import { AnnouncementCenter } from "./AnnouncementCenter";
import { SiteLockPanel } from "./SiteLockPanel";
import { CouncilHealthBoard } from "./CouncilHealthBoard";
import { TransparencyBoard } from "./TransparencyBoard";
import { ToxicityMonitor } from "./ToxicityMonitor";
import { TournamentAdmin } from "./TournamentAdmin";
import { WhatIfSimulator } from "./WhatIfSimulator";
import { ModeratorsBoard } from "./ModeratorsBoard";

// ─── Mini Sparkline (pure CSS) ────────────────────────────────
function MiniSparkline({
  data,
  color = "primary",
}: {
  data: number[];
  color?: string;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-[2px] h-8">
      {data.map((v, i) => {
        const h = Math.max(12, ((v - min) / range) * 100);
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-500",
              color === "primary" && "bg-primary/60",
              color === "emerald" && "bg-emerald-500/60",
              color === "rose" && "bg-rose-500/60",
              color === "amber" && "bg-amber-500/60",
              color === "blue" && "bg-blue-500/60",
            )}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  sparkData,
  color,
  pulse,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  sparkData?: number[];
  color: string;
  pulse?: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-primary/5">
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          color === "primary" && "bg-gradient-to-br from-primary/5 to-transparent",
          color === "emerald" && "bg-gradient-to-br from-emerald-500/5 to-transparent",
          color === "rose" && "bg-gradient-to-br from-rose-500/5 to-transparent",
          color === "amber" && "bg-gradient-to-br from-amber-500/5 to-transparent",
          color === "blue" && "bg-gradient-to-br from-blue-500/5 to-transparent",
        )}
      />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-semibold",
                    trend.positive ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {trend.positive ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
              color === "primary" && "bg-primary/10 text-primary",
              color === "emerald" && "bg-emerald-500/10 text-emerald-600",
              color === "rose" && "bg-rose-500/10 text-rose-600",
              color === "amber" && "bg-amber-500/10 text-amber-600",
              color === "blue" && "bg-blue-500/10 text-blue-600",
            )}
          >
            {pulse ? (
              <span className="relative flex size-5 items-center justify-center">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-30" />
                <Icon className="size-5 relative" />
              </span>
            ) : (
              <Icon className="size-5" />
            )}
          </div>
        </div>
        {sparkData && sparkData.length > 0 && (
          <div className="mt-3">
            <MiniSparkline data={sparkData} color={color} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Activity Timeline ────────────────────────────────────────
function ActivityItem({
  item,
}: {
  item: {
    id: string;
    actorType: string;
    actorName: string;
    action: string;
    targetName: string | null;
    reason: string | null;
    severity: string;
    createdAt: number;
  };
}) {
  const timeAgo = useMemo(() => {
    const diff = Date.now() - item.createdAt;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  }, [item.createdAt]);

  const severityColor = {
    low: "bg-blue-500/10 text-blue-600",
    medium: "bg-amber-500/10 text-amber-600",
    high: "bg-rose-500/10 text-rose-600",
    critical: "bg-rose-600/10 text-rose-700",
  }[item.severity] ?? "bg-muted text-muted-foreground";

  return (
    <div className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/40">
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          severityColor,
        )}
      >
        <Shield className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">{item.actorName}</span>
          {" — "}
          <span className="text-muted-foreground">{item.action}</span>
          {item.targetName && (
            <>
              {" → "}
              <span className="font-semibold">{item.targetName}</span>
            </>
          )}
        </p>
        {item.reason && (
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {item.reason}
          </p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {timeAgo}
      </span>
    </div>
  );
}

// ─── AI Status Indicator ──────────────────────────────────────
function AiStatusBadge({
  enabled,
  autoApply,
}: {
  enabled: boolean;
  autoApply: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={cn(
          "gap-1.5 rounded-full text-[11px]",
          enabled
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            : "border-border bg-muted text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground",
          )}
        />
        {enabled ? "الرقابة الذكية تعمل" : "الرقابة الذكية متوقفة"}
      </Badge>
      {enabled && (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 rounded-full text-[10px]",
            autoApply
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <Bot className="size-2.5" />
          {autoApply ? "تطبيق تلقائي" : "مراجعة يدوية"}
        </Badge>
      )}
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────
function QuickAction({
  icon: Icon,
  label,
  count,
  onClick,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border/50 bg-card/80 p-3 transition-all duration-200 hover:border-border hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
          color === "primary" && "bg-primary/10 text-primary",
          color === "rose" && "bg-rose-500/10 text-rose-600",
          color === "amber" && "bg-amber-500/10 text-amber-600",
          color === "emerald" && "bg-emerald-500/10 text-emerald-600",
          color === "blue" && "bg-blue-500/10 text-blue-600",
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="flex-1 text-start">
        <p className="text-xs font-semibold">{label}</p>
        {count !== undefined && (
          <p className="text-[11px] text-muted-foreground">{count} عنصر</p>
        )}
      </div>
      <ChevronLeft className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────
export function OwnerDashboard({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const dashboard = useQuery(api.owner.getDashboard);
  const [refreshKey, setRefreshKey] = useState(0);

  // سلاسل حقيقية من الخادم — بلا أي توليد عشوائي
  const series = useMemo(() => {
    if (!dashboard) return null;
    return {
      rounds: dashboard.roundsSeries,
      players: dashboard.newPlayersSeries,
    };
  }, [dashboard, refreshKey]);

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل لوحة القيادة…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Welcome + AI Status ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AiStatusBadge enabled={dashboard.aiEnabled} autoApply={dashboard.aiAutoApply} />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="size-3.5" />
            تحديث
          </Button>
        </div>
      </div>

      {/* ── رأس الصحة الحديث — درجة كبيرة حية + شريط مركّب ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-bl from-card via-card to-primary/5 p-6 shadow-lg shadow-primary/5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-20 end-8 h-40 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          {/* دائرة الدرجة */}
          <div className="relative flex size-28 shrink-0 items-center justify-center sm:size-32">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
              <circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                stroke={dashboard.healthScore >= 80 ? "#10b981" : dashboard.healthScore >= 60 ? "#f59e0b" : "#f43f5e"}
                strokeDasharray={`${(dashboard.healthScore / 100) * 264} 264`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="text-center">
              <div className="text-3xl font-black tabular-nums tracking-tight">{dashboard.healthScore}</div>
              <div className="text-[10px] font-bold text-muted-foreground">من 100</div>
            </div>
          </div>
          {/* الحالة والتنبيهات */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black tracking-tight">صحة اللعبة</h2>
              <Badge
                className={cn(
                  "rounded-full",
                  dashboard.healthScore >= 80 && "bg-emerald-500/15 text-emerald-600",
                  dashboard.healthScore >= 60 && dashboard.healthScore < 80 && "bg-amber-500/15 text-amber-600",
                  dashboard.healthScore < 60 && "bg-rose-500/15 text-rose-600",
                )}
              >
                {dashboard.healthLabel}
              </Badge>
            </div>
            {dashboard.healthAlerts.length > 0 ? (
              <ul className="mt-2.5 space-y-1">
                {dashboard.healthAlerts.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 text-xs text-emerald-600">كل المؤشرات ضمن النطاق الصحي ✓</p>
            )}
          </div>
          {/* نبضات سريعة */}
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <div className="text-center">
              <div className="text-lg font-black tabular-nums text-primary">{dashboard.aiDecisionsToday}</div>
              <div className="text-[10px] text-muted-foreground">قرارات AI اليوم</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black tabular-nums text-emerald-600">{dashboard.gamesToday}</div>
              <div className="text-[10px] text-muted-foreground">جولات اليوم</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black tabular-nums">{dashboard.roundsLast7d}</div>
              <div className="text-[10px] text-muted-foreground">جولات 7 أيام</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Health score + Advisors (موجة 1.1) ── */}
      <HealthPanel onNavigate={onNavigate} />

      {/* ── وضع الحماية (موجة 2.2) ── */}
      <SiteLockPanel locked={dashboard.siteLocked} />

      {/* ── مجلس العقول + شفافية القرارات (موجة 3) ── */}
      <CouncilHealthBoard />
      <TransparencyBoard />

      {/* ── مراقب السمومية (موجة 4) ── */}
      <ToxicityMonitor />

      {/* ── البطولات الأسبوعية (موجة 5) ── */}
      <TournamentAdmin />
      <div className="mt-6">
        <WhatIfSimulator />
      </div>

      {/* ── العُرفاء (موجة 6) ── */}
      <ModeratorsBoard />

      {/* ── مركز الإعلانات المركزي (موجة 1.3) — واجهة سريعة من القيادة ── */}
      <AnnouncementCenter />

      {/* ── بطاقات حية على سلاسل زمنية حقيقية من الخادم ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إجمالي اللاعبين"
          value={dashboard.userCount}
          subtitle={`${dashboard.bannedUsers} محظور`}
          icon={Users}
          color="primary"
          sparkData={series?.players ?? []}
          trend={undefined}
        />
        <StatCard
          label="جولات اليوم"
          value={dashboard.gamesToday}
          subtitle={`${dashboard.roundsLast7d} جولة آخر 7 أيام`}
          icon={Gamepad2}
          color="emerald"
          sparkData={series?.rounds ?? []}
        />
        <StatCard
          label="بلاغات مفتوحة"
          value={dashboard.openReports}
          subtitle={
            dashboard.openReports > 5
              ? "⚠️ يتطلب مراجعة عاجلة"
              : "تحت السيطرة"
          }
          icon={AlertTriangle}
          color={dashboard.openReports > 5 ? "rose" : "amber"}
          pulse={dashboard.openReports > 5}
        />
        <StatCard
          label="العقوبات المطبّقة"
          value={dashboard.totalPunishments}
          subtitle={`${dashboard.bannedUsers} حظر نشط`}
          icon={Ban}
          color="rose"
        />
      </div>

      {/* ── مخطط نشاط الجولات 14 يوماً — حقيقي 100% ── */}
      {series && series.rounds.some((n) => n > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="size-4 text-primary" />
              نشاط الجولات — آخر 14 يوماً
            </h3>
            <span className="text-[11px] text-muted-foreground">من أرشيف الجولات الحقيقي</span>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {series.rounds.map((n, i) => {
              const max = Math.max(...series.rounds, 1);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary transition-all"
                    style={{ height: `${Math.max(4, (n / max) * 80)}px` }}
                    title={`${n} جولة`}
                  />
                  <span className="text-[9px] tabular-nums text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Actions Grid ── */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Zap className="size-4 text-primary" />
          إجراءات سريعة
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Users}
            label="إدارة اللاعبين"
            count={dashboard.userCount}
            onClick={() => onNavigate("users")}
            color="primary"
          />
          <QuickAction
            icon={AlertTriangle}
            label="البلاغات المفتوحة"
            count={dashboard.openReports}
            onClick={() => onNavigate("reports")}
            color={dashboard.openReports > 0 ? "rose" : "emerald"}
          />
          <QuickAction
            icon={Brain}
            label="مركز الذكاء"
            onClick={() => onNavigate("aicontrol")}
            color="blue"
          />
          <QuickAction
            icon={Eye}
            label="الرقابة الذكية"
            onClick={() => onNavigate("aiadmin")}
            color="amber"
          />
        </div>
      </div>

      {/* ── Two Column: Activity + System Status ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-border/50 bg-card/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Activity className="size-4 text-primary" />
                آخر النشاطات
              </h3>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {dashboard.recentActivity.length} سجل
              </Badge>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
              {dashboard.recentActivity.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  لا توجد نشاطات حديثة
                </p>
              ) : (
                dashboard.recentActivity.map((item) => (
                  <ActivityItem key={item.id} item={item} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="lg:col-span-2 border-border/50 bg-card/80">
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <Sparkles className="size-4 text-primary" />
              حالة النظام
            </h3>
            <div className="space-y-3">
              {[
                {
                  label: "الرقابة الذكية",
                  status: dashboard.aiEnabled,
                  icon: Eye,
                },
                {
                  label: "التطبيق التلقائي",
                  status: dashboard.aiAutoApply,
                  icon: Bot,
                },
                {
                  label: "مكافحة الغش",
                  status: dashboard.antiCheatEnabled,
                  icon: Shield,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="size-4 text-muted-foreground" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                      item.status
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        item.status ? "bg-emerald-500" : "bg-muted-foreground/50",
                      )}
                    />
                    {item.status ? "مفعّل" : "متوقف"}
                  </span>
                </div>
              ))}

              {/* Quick Stats */}
              <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                  ملخص سريع
                </p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">
                      {dashboard.userCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">لاعب</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">
                      {dashboard.gameCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">لعبة</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-600">
                      {dashboard.openReports}
                    </p>
                    <p className="text-[10px] text-muted-foreground">بلاغ</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-rose-600">
                      {dashboard.bannedUsers}
                    </p>
                    <p className="text-[10px] text-muted-foreground">محظور</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
