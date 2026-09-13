import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Brain, Loader2 } from "lucide-react";

/**
 * 🎯 بطاقة «العقل يعرفك» — تعرض للاعب كيف تصبح اللعبة ذكية معه:
 *  - ملف فئاته الحقيقي (قوة/ضعف) من سجل إجابات الفئات الفعلي
 *  - الأسئلة الديناميكية تستهدف نقاط ضعفه تلقائياً
 *  - المطابقة الذكية في الحلبة تجمعه بأقرب خصم تقييماً
 */
export function SmartMatchCard() {
  const profile = useQuery(api.games.getMyCategoryProfile, {});

  if (profile === undefined) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> يجري تحليل ملف عقل…
        </CardContent>
      </Card>
    );
  }

  const played = profile.filter((c) => c.total >= 5);
  const weakest = played.slice(0, 3);
  const strongest = [...played].reverse().slice(0, 2);

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Brain className="size-4 text-primary" />
          العقل يعرفك — تجربة مخصصة
          <Badge variant="outline" className="ms-auto rounded-full border-primary/40 text-[10px] text-primary">
            الأسئلة الديناميكية نشطة
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          أسئلة جولاتك تُختار الآن حسب أدائك الفعلي: تركيز أكبر على نقاط ضعفك، وصعوبة تناسب مستواك —
          والمطابقة في الحلبة تجمعك بأقرب خصم تقييماً لمعارك عادلة ومثيرة.
        </p>

        {played.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
            العقلابن ملفك بعد أول جولة — العب جولتين وسيبدأ الذكاء في تكييف الأسئلة معك.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {weakest.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                  <Target className="size-3.5" /> ستتدرب عليها أكثر
                </p>
                <div className="space-y-1.5">
                  {weakest.map((c) => (
                    <div key={c.category} className="flex items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate">{c.category}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${c.accuracy}%` }} />
                      </div>
                      <span className="w-9 text-end font-mono text-[10px] text-muted-foreground">{c.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {strongest.length > 0 && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <p className="mb-2 text-[11px] font-bold text-emerald-600">💪 نقاط قوتك</p>
                <div className="space-y-1.5">
                  {strongest.map((c) => (
                    <div key={c.category} className="flex items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate">{c.category}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full bg-emerald-500")} style={{ width: `${c.accuracy}%` }} />
                      </div>
                      <span className="w-9 text-end font-mono text-[10px] text-muted-foreground">{c.accuracy}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
