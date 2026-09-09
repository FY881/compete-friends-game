import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users,
  Bot,
  Flag,
  FileQuestion,
  Gem,
  UserCheck,
  Activity,
  RefreshCw,
} from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  moderation: Users,
  autoadmin: Bot,
  reports: Flag,
  questions: FileQuestion,
  gem: Gem,
  viceowner: UserCheck,
};

function timeAgo(ts: number | null): string {
  if (!ts) return "أبداً";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

const HEALTH_TONE = {
  healthy: { cls: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500", label: "نشط" },
  idle: { cls: "bg-sky-500/10 text-sky-700", dot: "bg-sky-400", label: "خامل" },
  off: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40", label: "متوقف" },
} as const;

export function CouncilHealthBoard() {
  const board = useQuery(api.council.getHealthBoard);

  if (!board) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="size-4 text-primary" />
            مجلس العقول — صحة الأنظمة
          </h3>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {board.totalDecisions7d} قرار / 7 أيام
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {board.systems.map((s) => {
            const Icon = ICONS[s.id] ?? Bot;
            const tone = HEALTH_TONE[s.health];
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    s.health === "healthy"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : s.health === "idle"
                        ? "bg-sky-500/10 text-sky-600"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-bold">{s.name}</p>
                    <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{s.role}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-xs font-bold text-foreground/80">{s.decisions7d}</p>
                  <p className="text-[9px] text-muted-foreground">{timeAgo(s.lastDecisionAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}