import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameData, PlayerInfo } from "@/convex/games";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Crown,
  Home,
  Loader2,
  Medal,
  PartyPopper,
  RefreshCw,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { GameAvatar } from "./ui";

function correctCount(player: PlayerInfo): number {
  return player.answers.filter((a) => a?.correct).length;
}

function PodiumCard({
  player,
  place,
  winner,
}: {
  player: PlayerInfo;
  place: 1 | 2 | 3;
  winner: boolean;
}) {
  const medalStyles = {
    1: "bg-amber-400 text-amber-950",
    2: "bg-slate-300 text-slate-700",
    3: "bg-orange-300 text-orange-900",
  } as const;

  const heightClasses = {
    1: "pt-8",
    2: "pt-5",
    3: "pt-5",
  } as const;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border bg-card px-5 pb-0 shadow-sm",
        heightClasses[place],
        winner ? "border-primary/40" : "border-border/80",
      )}
    >
      <div className="relative">
        <GameAvatar name={player.name} className={cn("size-14 text-lg", place === 1 && "size-16")} />
        {place === 1 && (
          <Crown className="absolute -top-4 start-1/2 size-6 -translate-x-1/2 text-amber-500" />
        )}
      </div>
      <p className="mt-3 max-w-32 truncate text-sm font-bold text-foreground">
        {player.name}
        {player.isMe && (
          <span className="ms-1 text-[10px] font-bold text-primary">(أنت)</span>
        )}
      </p>
      <span
        className={cn(
          "mt-2 flex size-9 items-center justify-center rounded-full",
          medalStyles[place],
        )}
      >
        <Medal className="size-5" />
      </span>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {player.score}
      </p>
      <p className="pb-6 text-xs text-muted-foreground">
        {correctCount(player)} إجابة صحيحة
      </p>
    </div>
  );
}

export function ResultsStage({ game }: { game: GameData }) {
  const createGame = useMutation(api.games.createGame);
  const navigate = useNavigate();
  const [rematching, setRematching] = useState(false);
  const me = game.players.find((p) => p.isMe);
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const handleRematch = async () => {
    setRematching(true);
    try {
      const { code } = await createGame({ name: me?.name });
      navigate(`/game/${code}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر إنشاء تحدٍّ جديد.",
      );
      setRematching(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Winner banner */}
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-500">
          <PartyPopper className="size-7" />
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight">
          {winner?.isMe ? "أنت البطل! 🏆" : `${winner?.name ?? ""} يتصدّر!`}
        </h2>
        <p className="mt-2 text-muted-foreground">
          انتهت الجولة — {sorted.length} لاعب، {game.game.questionCount} أسئلة،
          ومنافسة لا تُنسى.
        </p>
      </div>

      {/* Podium */}
      <div className="mt-10 flex items-end justify-center gap-4">
        {sorted.length > 1 && sorted[1] && (
          <PodiumCard player={sorted[1]} place={2} winner={false} />
        )}
        {sorted[0] && <PodiumCard player={sorted[0]} place={1} winner />}
        {sorted.length > 2 && sorted[2] && (
          <PodiumCard player={sorted[2]} place={3} winner={false} />
        )}
      </div>

      {/* Full standings */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-6 py-4">
          <p className="text-sm font-bold">النتيجة الكاملة</p>
        </div>
        <ul>
          {sorted.map((player, i) => (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-4 border-b border-border/50 px-6 py-3.5 last:border-b-0",
                player.isMe && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "w-7 text-center text-base font-bold tabular-nums",
                  i === 0 ? "text-amber-500" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <GameAvatar name={player.name} index={i} />
              <div className="flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {player.name}
                  {i === 0 && <Crown className="size-4 text-amber-500" />}
                  {player.isMe && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      أنت
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {player.answers.map((answer, ai) =>
                    answer ? (
                      answer.correct ? (
                        <span
                          key={ai}
                          className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white"
                        >
                          <Check className="size-2.5" />
                        </span>
                      ) : (
                        <span
                          key={ai}
                          className="flex size-4 items-center justify-center rounded-full bg-rose-400 text-white"
                        >
                          <X className="size-2.5" />
                        </span>
                      )
                    ) : (
                      <span
                        key={ai}
                        className="size-4 rounded-full border border-dashed border-border bg-muted"
                      />
                    ),
                  )}
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {player.score}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" className="gap-2 rounded-xl text-base" onClick={handleRematch} disabled={rematching}>
          {rematching ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
          جولة جديدة بنفس اللاعبين
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2 rounded-xl text-base"
          onClick={() => navigate("/play")}
        >
          <Home className="size-4.5" />
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
}
