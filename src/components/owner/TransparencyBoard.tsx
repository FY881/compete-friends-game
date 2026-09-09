import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  EyeOff,
  Search,
  ShieldCheck,
  Gavel,
  Bot,
  User,
} from "lucide-react";

const SYSTEM_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  moderation: { label: "الرقابة", icon: EyeOff },
  autoadmin: { label: "المدير الآلي", icon: Bot },
  reports: { label: "البلاغات", icon: Gavel },
  questions: { label: "الأسئلة", icon: Bot },
  gem: { label: "جيم", icon: User },
  viceowner: { label: "نائب المالك", icon: User },
  owner: { label: "المالك", icon: User },
};

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-sky-500/10 text-sky-700",
  medium: "bg-amber-500/10 text-amber-700",
  high: "bg-rose-500/10 text-rose-700",
};

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

type Row = {
  id: string;
  system: string;
  actorName: string;
  action: string;
  targetName: string | null;
  detail: string;
  severity: "low" | "medium" | "high";
  createdAt: number;
};

export function TransparencyBoard() {
  const decisions = useQuery(api.council.getDecisionsFiltered, { limit: 120 });
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let r: Row[] = decisions ?? [];
    if (systemFilter) r = r.filter((d) => d.system === systemFilter);
    if (severityFilter) r = r.filter((d) => d.severity === severityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (d) =>
          d.detail.toLowerCase().includes(q) ||
          (d.targetName ?? "").toLowerCase().includes(q) ||
          d.action.toLowerCase().includes(q),
      );
    }
    return r;
  }, [decisions, systemFilter, severityFilter, search]);

  const stats = useMemo(() => {
    const all: Row[] = decisions ?? [];
    const high = all.filter((d) => d.severity === "high").length;
    const medium = all.filter((d) => d.severity === "medium").length;
    const systems = new Set(all.map((d) => d.system)).size;
    return { total: all.length, high, medium, systems };
  }, [decisions]);

  const systemsPresent = useMemo(() => {
    const s = new Set((decisions ?? []).map((d) => d.system));
    return [...s];
  }, [decisions]);

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-primary" />
            شفافية القرارات الموحّدة
          </h3>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="rounded-full text-[10px]">{stats.total} قرار</Badge>
            {stats.high > 0 && (
              <Badge variant="outline" className="rounded-full border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700">
                {stats.high} عاجل
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full text-[10px]">{stats.systems} نظام</Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في القرارات…"
              className="h-8 rounded-lg ps-8 text-xs"
            />
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSystemFilter(null)}
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors",
                systemFilter === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              الكل
            </button>
            {systemsPresent.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSystemFilter(systemFilter === s ? null : s)}
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors",
                  systemFilter === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {SYSTEM_LABELS[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["high", "medium", "low"] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors",
                  severityFilter === sev ? SEVERITY_TONE[sev] : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {sev === "high" ? "عاجل" : sev === "medium" ? "متوسط" : "بسيط"}
              </button>
            ))}
          </div>
        </div>

        {/* Log */}
        <div className="max-h-96 space-y-1 overflow-y-auto scrollbar-thin">
          {decisions === undefined ? null : rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">لا توجد قرارات مطابقة.</p>
          ) : (
            rows.map((d) => {
              const SysIcon = SYSTEM_LABELS[d.system]?.icon ?? Bot;
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/10 px-2.5 py-2"
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", SEVERITY_TONE[d.severity])}>
                    <SysIcon className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-foreground/85" title={d.detail}>{d.detail}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {SYSTEM_LABELS[d.system]?.label ?? d.system} · {d.actorName}
                      {d.targetName ? ` → ${d.targetName}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}