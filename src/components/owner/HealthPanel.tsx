import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HeartPulse,
  ShieldCheck,
  Bot,
  Gem,
  BrainCircuit,
  Sparkles,
  Lightbulb,
  ChevronLeft,
  Activity,
  UserCheck,
  FileQuestion,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  moderation: ShieldCheck,
  autoadmin: Bot,
  gem: Gem,
  questions: FileQuestion,
  viceowner: UserCheck,
  mindhub: BrainCircuit,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

const SEVERITY_TONE: Record<string, string> = {
  low: "text-sky-600 bg-sky-500/10",
  medium: "text-amber-600 bg-amber-500/10",
  high: "text-rose-600 bg-rose-500/10",
};

export function HealthPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const dashboard = useQuery(api.owner.getDashboard);
  const decisions = useQuery(api.decisionLog.getRecent, { limit: 8 });

  if (!dashboard) return null;
  const { healthScore, healthLabel, healthAlerts, advisors, suggestions } = dashboard;

  const gaugeColor =
    healthScore >= 80 ? "text-emerald-500" : healthScore >= 60 ? "text-primary" : healthScore >= 40 ? "text-amber-500" : "text-rose-500";
  const stroke = healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "var(--primary)" : healthScore >= 40 ? "#f59e0b" : "#f43f5e";
  const R = 42;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Health score gauge ── */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="flex flex-col items-center p-5 text-center">
          <div className="flex items-center gap-2 text-sm font-bold">
            <HeartPulse className="size-4 text-primary" />
            صحة اللعبة
          </div>
          <div className="relative mt-3">
            <svg viewBox="0 0 100 100" className="size-36 -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={stroke}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC - (CIRC * healthScore) / 100}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-black", gaugeColor)}>{healthScore}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("mt-3 rounded-full text-[11px]", healthScore >= 60 ? "border-emerald-500/30 text-emerald-700" : healthScore >= 40 ? "border-amber-500/30 text-amber-700" : "border-rose-500/30 text-rose-700")}
          >
            {healthLabel}
          </Badge>
          {healthAlerts.length > 0 && (
            <div className="mt-3 w-full space-y-1.5">
              {healthAlerts.map((a) => (
                <p key={a} className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700">
                  <Activity className="size-3 shrink-0" />
                  {a}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Advisors panel ── */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-4 text-primary" />
            لوحة المستشارين
          </h3>
          <div className="space-y-2">
            {advisors.map((a) => {
              const Icon = ICONS[a.id] ?? Bot;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onNavigate(a.tab)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-2.5 text-start transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      a.status === "active" ? "bg-emerald-500/10 text-emerald-600" : a.status === "idle" ? "bg-sky-500/10 text-sky-600" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold">{a.name}</p>
                      <span className={cn("size-1.5 rounded-full", a.status === "active" ? "bg-emerald-500" : a.status === "idle" ? "bg-sky-400" : "bg-muted-foreground/40")} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{a.summary}</p>
                  </div>
                  <ChevronLeft className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Suggestions + unified decision log ── */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="size-4 text-amber-500" />
            توصيات القيادة
          </h3>
          <div className="mb-4 space-y-1.5">
            {suggestions.map((s, i) => (
              <p key={i} className="flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span className="mt-0.5 text-amber-500">›</span>
                {s}
              </p>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-muted-foreground">سجلّ القرارات الموحّد</p>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {dashboard.aiDecisionsToday} اليوم
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            {(decisions ?? []).length === 0 ? (
              <p className="py-3 text-center text-[11px] text-muted-foreground">لا قرارات بعد — سجّل نشاطاً لرؤيتها هنا.</p>
            ) : (
              (decisions ?? []).map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg bg-muted/20 px-2.5 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", SEVERITY_TONE[d.severity])}>{d.severity === "high" ? "عاجل" : d.severity === "medium" ? "متوسط" : "بسيط"}</span>
                  <span className="flex-1 truncate text-[10px] text-foreground/80" title={d.detail}>{d.detail}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}