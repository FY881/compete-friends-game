import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp } from "lucide-react";

/**
 * 🔗 بطاقة المكافأة التكيفية — شفافية كاملة للاعب:
 * يرى مضاعفه الحالي وكل عامل يساهم فيه ولماذا.
 */
export function AdaptiveRewardCard() {
  const reward = useQuery(api.adaptiveRewards.getMyAdaptiveReward, {});

  if (reward === undefined || reward === null || reward.factors.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <h4 className="text-sm font-bold">مكافأتك التكيفية</h4>
          <Badge className="ms-auto rounded-full bg-primary/10 text-primary">
            <TrendingUp className="size-3" /> مضاعف ×{reward.multiplier}
          </Badge>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {reward.factors.map((f) => (
            <Badge key={f.key} variant="outline" className="rounded-full border-emerald-500/40 text-[10px] text-emerald-600">
              {f.label}: {f.effect}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          كل عامل حقيقي من بياناتك: مستواك، فوزك، عضويتك، عشيرتك، سلسلتك، هيبتك — كلها ترفع نقاط الولاء من كل جولة.
        </p>
      </CardContent>
    </Card>
  );
}
