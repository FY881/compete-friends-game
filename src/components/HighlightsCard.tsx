/**
 * ⭐ أفضل لحظات الأسبوع — بطاقة الملخص الأسبوعي الآلي.
 * تظهر أعلى صفحة اللعب عندما يوجد ملخص مكتمل، وتُخفى خلاف ذلك.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function HighlightsCard() {
  const highlights = useQuery(api.highlights.getLatestHighlights);
  if (highlights === undefined) return null;
  if (!highlights || highlights.moments.length === 0) return null;

  return (
    <Card className="border-amber-500/25 bg-gradient-to-l from-amber-500/8 to-transparent shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
            <Sparkles className="size-4" />
          </span>
          أفضل لحظات الأسبوع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {highlights.moments.map((m) => (
          <div key={m.rank} className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-3 py-2">
            <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-amber-500">
              {m.rank}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold">{m.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{m.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
