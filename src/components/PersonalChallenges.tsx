import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, RefreshCw, Target, Trophy } from "lucide-react";

/**
 * 🎯 التحديات الشخصية — المرحلة 15
 * بطاقة تُظهر للاعب تحدياته الحية المولّدة من بياناته الحقيقية:
 * «أنت على بعد فوزين من 🏆» أو «تدرّب على أضعف فئاتك».
 */
export function PersonalChallenges() {
  const challenges = useQuery(api.personalChallenges.getMyChallenges, {});
  const refresh = useMutation(api.personalChallenges.refreshMyChallenges);
  const claim = useMutation(api.personalChallenges.claimChallenge);
  const [busy, setBusy] = useState(false);

  if (!challenges || challenges.length === 0) return null;

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const res = await refresh({});
      toast.success(res.created > 0 ? `وُلِّدت ${res.created} تحديات جديدة!` : `لديك ${res.active} تحديات نشطة`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التحديث");
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async (id: any) => {
    try {
      const res = await claim({ id });
      toast.success(`🎉 حصلت على ${res.reward} نقطة حرب!`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر المطالبة");
    }
  };

  const active = challenges.filter((c: any) => c.status === "active");
  const completed = challenges.filter((c: any) => c.status === "completed");

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4 text-primary" />
            تحدياتك الشخصية
            <Badge variant="secondary" className="text-xs">{active.length} نشطة</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            تحديث
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...active, ...completed].slice(0, 3).map((c: any) => (
          <div key={c._id} className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
            <span className="text-2xl">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">{c.desc}</p>
            </div>
            {c.status === "completed" ? (
              <Button size="sm" onClick={() => handleClaim(c._id)} className="shrink-0">
                <Trophy className="size-3.5" />
                مطالبة {c.reward}
              </Button>
            ) : (
              <Badge variant="outline" className="shrink-0 text-xs">+{c.reward} نقطة</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
