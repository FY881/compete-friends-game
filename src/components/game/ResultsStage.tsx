import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameData } from "@/convex/games";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Flame,
  Zap,
  Medal,
  RotateCcw,
  Loader2,
  Crown,
  Star,
  Target,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function ResultsStage({ game }: { game: GameData }) {
  const rematch = useMutation(api.games.rematch);
  const [rematching, setRematching] = useState(false);
  const [rematchCode, setRematchCode] = useState<string | null>(null);

  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const totalQuestions = game.game.questionCount;

  const handleRematch = async () => {
    if (rematching) return;
    setRematching(true);
    try {
      const result = await rematch({ code: game.game.code });
      setRematchCode(result.code);
      toast.success("تم إنشاء جولة جديدة!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر إنشاء جولة جديدة.");
    } finally {
      setRematching(false);
    }
  };

  if (rematchCode) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl border border-primary/25 bg-card p-8 shadow-sm"
        >
          <Trophy className="mx-auto size-12 text-primary" />
          <h2 className="mt-4 text-2xl font-bold">جولة جديدة جاهزة!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            شارك الرمز مع أصدقائك
          </p>
          <div className="mt-4 flex justify-center gap-1.5">
            {rematchCode.split("").map((char, i) => (
              <span
                key={i}
                className="flex size-10 items-center justify-center rounded-xl border border-border/80 bg-background text-xl font-bold tracking-wider"
              >
                {char}
              </span>
            ))}
          </div>
          <Button
            className="mt-6 gap-2 rounded-xl"
            onClick={() => window.location.href = `/game/${rematchCode}`}
          >
            <ArrowLeft className="size-4" />
            اذهب للغرفة الجديدة
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Winner banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-amber-400/40 bg-amber-400/5 p-8 text-center"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 start-1/2 h-52 w-96 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl"
        />
        <div className="relative">
          <Badge className="gap-1.5 rounded-full bg-amber-500/20 text-amber-700 hover:bg-amber-500/20">
            <Trophy className="size-3.5" />
            انتهى التحدي
          </Badge>
          {sorted.length > 0 && (
            <>
              <div className="mx-auto mt-4 flex size-20 items-center justify-center rounded-3xl bg-amber-400/20 text-4xl">
                🏆
              </div>
              <h1 className="mt-4 text-3xl font-bold">
                {sorted[0].name}
              </h1>
              <p className="mt-1 text-lg text-muted-foreground">
                بطل الجولة بـ{" "}
                <span className="font-bold text-primary">
                  {sorted[0].score.toLocaleString("ar")}
                </span>{" "}
                نقطة
              </p>
            </>
          )}
        </div>
      </motion.div>

      {/* Full rankings */}
      <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold">الترتيب النهائي</p>
        <ul className="space-y-2">
          {sorted.map((player, i) => {
            const correctCount = player.answers.filter(
              (a) => a && a.correct,
            ).length;
            const bestStreak = player.bestStreak;
            return (
              <motion.li
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  i === 0 ? "border-amber-400/40 bg-amber-400/5" : "border-border/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    i === 0
                      ? "bg-amber-400 text-white"
                      : i === 1
                        ? "bg-gray-300 text-gray-700"
                        : i === 2
                          ? "bg-orange-300 text-orange-800"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {player.name}
                    {i === 0 && <Crown className="size-3.5 text-amber-500" />}
                    {player.isMe && (
                      <Badge variant="outline" className="ms-1 px-1.5 py-0 text-[10px]">
                        أنت
                      </Badge>
                    )}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="size-3" />
                      {correctCount}/{totalQuestions}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="size-3 text-orange-500" />
                      أفضل سلسلة: {bestStreak}
                    </span>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-lg font-bold tabular-nums">
                    {player.score.toLocaleString("ar")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">نقطة</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 gap-2 rounded-xl"
          onClick={handleRematch}
          disabled={rematching}
        >
          {rematching ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RotateCcw className="size-4.5" />
          )}
          جولة جديدة (Rematch)
        </Button>
      </div>
    </div>
  );
}
