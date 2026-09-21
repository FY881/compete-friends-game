import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Loader2, Zap } from "lucide-react";

/**
 * 🎮 نبضة الألعاب المصغّرة — سيطرة المالك.
 *
 * كل رقم هنا **ما دُفع فعلاً من الخادم** لا ما وعدت به الواجهة:
 * كم لعبة تحرّكها لاعبون، وكم لاعباً، وكم خبرة خرجت، ومن أكثر لعبة تُلعب.
 * غرضها كشف لعبة معطوبة (تُلعب كثيراً ولا تعطي نتائج) أو استهلاك شاذ.
 */
export function MiniGamesNexusPanel() {
  const pulse = useQuery(api.miniGames.miniGamePulse, {});

  if (pulse === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center gap-2 p-5 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> نقرأ نبضة الألعاب المصغّرة…
        </CardContent>
      </Card>
    );
  }
  if (pulse === null) {
    return (
      <Card className="border-border/70">
        <CardContent className="p-5 text-xs text-muted-foreground">هذه اللوحة للمالك فقط.</CardContent>
      </Card>
    );
  }

  const stats: { label: string; value: number | string; tone?: string }[] = [
    { label: "ألعاب مُشتغَلة", value: pulse.distinctGamesTouched },
    { label: "لاعبون سجّلوا", value: pulse.playersTouched },
    { label: "إجمالي الجولات", value: pulse.totalPlays },
    { label: "خبرة مدفوعة فعلاً", value: pulse.xpGranted, tone: "text-primary" },
    { label: "نشطون اليوم", value: pulse.activeToday },
    { label: "خبرة اليوم", value: pulse.xpToday, tone: "text-emerald-600" },
    { label: "جولات اليوم", value: pulse.playsToday },
    { label: "سقف الفرد/اليوم", value: pulse.cap },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Gamepad2 className="size-4 text-primary" /> نبضة الألعاب المصغّرة
            <Badge variant="outline" className="rounded-full text-[10px]">
              أرقام مدفوعة حقيقية
            </Badge>
            <span className="ms-auto flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
              <Zap className="size-3" /> الخبرة تُشتقّ في الخادم من النتيجة والصعوبة
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-black tabular-nums ${s.tone ?? ""}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            لو ظهرت «ألعاب مُشتغَلة» مرتفعة مع «خبرة مدفوعة» قريبة من الصفر، فهذا يعني أن اللاعبين يلعبون
            ونتائجهم لا تُحتسب — وهي إشارة تشخيصية مباشرة لخلل في مسار الحفظ، لا رقم تجميلي.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">أكثر الألعاب نشاطاً</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {pulse.hottest.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا نشاط بعد.</p>
          ) : (
            pulse.hottest.map((g, i) => (
              <div key={g.gameId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                <span className="w-5 text-center font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                  {g.gameId}
                </Badge>
                <span className="text-muted-foreground tabular-nums">{g.plays} جولة</span>
                <span className="text-muted-foreground tabular-nums">· {g.xp} XP</span>
                <span className="ms-auto font-bold tabular-nums text-primary">أعلى نتيجة {g.best}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
