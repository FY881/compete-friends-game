import { Crown, Trophy } from "lucide-react";
import type { PlayerInfo } from "@/convex/games";
import { cn } from "@/lib/utils";
import { GameAvatar } from "./ui";

export function Leaderboard({
  players,
  compact = false,
}: {
  players: PlayerInfo[];
  compact?: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Trophy className="size-4 text-primary" />
          الترتيب المباشر
        </p>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {players.length} لاعب
        </span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {sorted.map((player, i) => {
          const me = player.isMe;
          return (
            <li
              key={player.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                me
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "w-6 text-center text-sm font-bold tabular-nums",
                  i === 0 ? "text-amber-500" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <GameAvatar name={player.name} index={i} />
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {player.name}
                {me && (
                  <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    أنت
                  </span>
                )}
              </span>
              {i === 0 && <Crown className="size-4 text-amber-500" />}
              <span className="text-sm font-bold tabular-nums text-foreground">
                {player.score}
              </span>
            </li>
          );
        })}
      </ul>

      {compact && (
        <p className="mt-4 border-t border-border/70 pt-3 text-center text-xs text-muted-foreground">
          الإجابات الصحيحة السريعة تصعد بك
        </p>
      )}
    </div>
  );
}
