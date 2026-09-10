/**
 * لوحة التنافس المباشر — «أنت ضد صديق»
 * تعرض أهم خصومك مع سجل المواجهات وزر مبارزة ثأرية ينشئ غرفة فوراً.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Swords, Trophy, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Rivalry = {
  opponentId: string;
  opponentName: string;
  myWins: number;
  theirWins: number;
  draws: number;
  totalGames: number;
  lastWonByMe: boolean;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

export function RivalryPanel() {
  const rivalries = useQuery(api.rivalries.getMyRivalries);
  const startRematch = useMutation(api.rivalries.startRematch);
  const navigate = useNavigate();
  const [challenging, setChallenging] = useState<string | null>(null);

  // لا تعرض اللوحة إطلاقاً إن لم توجد أي مواجهة بعد — بلا ضجيج
  if (rivalries === undefined) return null;
  if (rivalries.length === 0) return null;

  async function handleRematch(r: Rivalry) {
    setChallenging(r.opponentId);
    try {
      const res = await startRematch({
        opponentId: r.opponentId as any,
      });
      toast.success(`غرفة الثأر جاهزة ضد ${r.opponentName}!`);
      navigate(`/game/${res.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء المبارزة");
    } finally {
      setChallenging(null);
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
            <Swords className="size-4" />
          </span>
          التنافس المباشر — أنت ضد الأصدقاء
          <Badge variant="outline" className="rounded-full text-[10px]">
            {rivalries.length} خصم
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rivalries.slice(0, 6).map((r) => {
          const leading = r.myWins > r.theirWins;
          const behind = r.myWins < r.theirWins;
          return (
            <div
              key={r.opponentId}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  leading
                    ? "bg-emerald-500/15 text-emerald-600"
                    : behind
                      ? "bg-rose-500/15 text-rose-600"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {r.opponentName.slice(0, 1)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.opponentName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.totalGames} مواجهة ·{" "}
                  {r.draws > 0 ? `${r.draws} تعادل · ` : ""}
                  {leading ? "أنت متقدم" : behind ? "هو متقدم" : "توازن تام"}
                  {r.lastWonByMe !== undefined && " "}
                </p>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums">
                <span className="text-emerald-600">{r.myWins}</span>
                <span className="text-muted-foreground">:</span>
                <span className="text-rose-600">{r.theirWins}</span>
              </div>

              <Button
                size="sm"
                variant={behind ? "default" : "outline"}
                className="gap-1.5 rounded-xl text-xs"
                disabled={challenging === r.opponentId}
                onClick={() => handleRematch(r)}
              >
                {challenging === r.opponentId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : behind ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <Trophy className="size-3.5" />
                )}
                مبارزة
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
