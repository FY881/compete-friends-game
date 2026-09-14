import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trophy, Sparkles, Crown, Gem } from "lucide-react";

/**
 * 🏆 خزانة الإنجازات — شبكة كاملة مع تقدّم جزئي حقيقي
 */

const RARITY_STYLE: Record<string, { cls: string; label: string }> = {
  common: { cls: "border-border bg-card", label: "عادي" },
  uncommon: { cls: "border-emerald-500/40 bg-emerald-500/5", label: "غير شائع" },
  rare: { cls: "border-sky-500/40 bg-sky-500/5", label: "نادر" },
  epic: { cls: "border-purple-500/40 bg-purple-500/5", label: "ملحمي" },
  legendary: { cls: "border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent", label: "أسطوري" },
};

const RARITY_ICON: Record<string, any> = {
  common: null,
  uncommon: <Sparkles className="h-3 w-3" />,
  rare: <Gem className="h-3 w-3" />,
  epic: <Gem className="h-3 w-3" />,
  legendary: <Crown className="h-3 w-3" />,
};

export function TrophyCase() {
  const data = useQuery(api.achievementsEngine.getMyTrophyCase);
  const near = useQuery(api.achievementsEngine.getNearCompletions);
  const check = useMutation(api.achievementsEngine.checkMyAchievements);

  if (data === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const { achievements, total, earnedCount } = data;
  const completionPct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-2xl border bg-card/60 p-4">
      {/* الرأس */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-amber-400" /> خزانة الإنجازات
        </h3>
        <Badge variant="outline" className="text-[11px]">
          {earnedCount}/{total}
        </Badge>
        <Badge className={cn("text-[11px]", completionPct >= 50 ? "bg-amber-500/20 text-amber-300" : "bg-muted text-muted-foreground")}>
          {completionPct}% إكمال
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          onClick={async () => {
            const r = await check();
            if (r.earned.length > 0) {
              toast.success(`🎉 ${r.earned.length} إنجاز جديد! ${r.earned.map((e: any) => e.icon + e.name).join(" · ")}`);
            } else {
              toast("لا إنجازات جديدة بعد — واصل اللعب!");
            }
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> فحص الآن
        </Button>
      </div>

      {/* إنجازات شبه منتهية — توصية ذكية */}
      {near && near.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 text-[11px] font-semibold text-primary">⏳ على وشك الإنجاز — أقرب ثلاثة:</p>
          <div className="space-y-1.5">
            {near.map((n: any) => (
              <div key={n.name} className="flex items-center gap-2 text-xs">
                <span>{n.icon}</span>
                <span className="font-medium">{n.name}</span>
                <Progress value={n.pct} className="h-1.5 flex-1" />
                <span className="text-muted-foreground">{n.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الشبكة */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {achievements.map((a: any) => {
          const style = RARITY_STYLE[a.rarity] ?? RARITY_STYLE.common;
          return (
            <div
              key={a.type}
              className={cn(
                "rounded-xl border p-3 transition",
                a.earned ? style.cls : "border-dashed border-border/60 bg-card/30 opacity-70",
                a.rarity === "legendary" && a.earned && "shadow-[0_0_18px_rgba(245,158,11,0.15)]",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn("text-2xl", !a.earned && "grayscale opacity-50")}>{a.icon}</span>
                <Badge variant="outline" className="text-[9px]">
                  {RARITY_ICON[a.rarity]}
                  {style.label}
                </Badge>
              </div>
              <p className={cn("mt-1.5 text-xs font-semibold", !a.earned && "text-muted-foreground")}>
                {a.name}
              </p>
              <p className="text-[10px] leading-snug text-muted-foreground">{a.desc}</p>
              {a.earned ? (
                <p className="mt-1 text-[10px] font-medium text-emerald-500">
                  ✓ منجز · +{a.xp} خبرة · +{a.coins} 🪙
                </p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  <Progress value={a.progress.pct} className="h-1.5" />
                  <p className="text-[9px] text-muted-foreground">
                    {a.progress.current}/{a.progress.target} · {a.progress.pct}%
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
