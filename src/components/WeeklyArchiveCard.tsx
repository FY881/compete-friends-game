import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const trendMeta = {
  up: { icon: TrendingUp, label: "صاعد", cls: "text-emerald-600 bg-emerald-500/10" },
  down: { icon: TrendingDown, label: "هابط", cls: "text-rose-600 bg-rose-500/10" },
  flat: { icon: Minus, label: "ثابت", cls: "text-amber-600 bg-amber-500/10" },
  new: { icon: Sparkles, label: "بداية جديدة", cls: "text-primary bg-primary/10" },
} as const;

export function WeeklyArchiveCard() {
  const archive = useQuery(api.mindSpecializations.getWeeklyArchive);

  if (archive === null) return null;
  if (archive === undefined) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex justify-center py-10">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const Trend = trendMeta[archive.trend].icon;

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-lg">🗓️</span>
          الأرشيف الأسبوعي
          <Badge
            className={cn(
              "ms-auto gap-1 rounded-full border-0",
              trendMeta[archive.trend].cls,
            )}
          >
            <Trend className="size-3" />
            {trendMeta[archive.trend].label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-2xl font-black tabular-nums">{archive.roundsThisWeek}</p>
            <p className="text-[10px] text-muted-foreground">جولة هذا الأسبوع</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-2xl font-black tabular-nums text-emerald-600">
              {archive.accuracyThisWeek ?? "—"}
              {archive.accuracyThisWeek !== null && "%"}
            </p>
            <p className="text-[10px] text-muted-foreground">دقة الأسبوع</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-2xl font-black tabular-nums text-primary">
              {archive.accuracyAllTime ?? "—"}
              {archive.accuracyAllTime !== null && "%"}
            </p>
            <p className="text-[10px] text-muted-foreground">دقتك الكلية</p>
          </div>
        </div>

        {(archive.strongest.length > 0 || archive.weakest.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-emerald-700">💪 أقوى حقولك</p>
              {archive.strongest.map((f) => (
                <div
                  key={f.category}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {f.category}
                  </span>
                  <span className="text-xs font-black tabular-nums text-emerald-600">
                    {f.accuracy}%
                  </span>
                </div>
              ))}
            </div>
            {archive.weakest.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-amber-700">🎯 تستحق تدريبك</p>
                {archive.weakest.map((f) => (
                  <div
                    key={f.category}
                    className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                      {f.category}
                    </span>
                    <span className="text-xs font-black tabular-nums text-amber-600">
                      {f.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-primary/5 px-4 py-3 text-xs leading-relaxed">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p>{archive.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
