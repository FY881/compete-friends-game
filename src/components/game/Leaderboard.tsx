import { motion } from "framer-motion";
import type { GameData } from "@/convex/games";
import { cn } from "@/lib/utils";
import { Crown, Flame } from "lucide-react";

type Player = GameData["players"][number];

export function Leaderboard({
  players,
  compact = false,
}: {
  players: Player[];
  compact?: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        الترتيب المباشر
      </p>
      <ul className="space-y-1.5">
        {sorted.map((p, i) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
              i === 0 && "bg-amber-400/10",
              p.isMe && "border border-primary/30 bg-primary/5",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                i === 0
                  ? "bg-amber-400 text-white"
                  : i === 1
                    ? "bg-gray-300 text-gray-700"
                    : i === 2
                      ? "bg-orange-300 text-orange-800"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name}
              {p.isMe && (
                <span className="ms-1 text-[10px] text-primary">(أنت)</span>
              )}
            </span>
            {i === 0 && <Crown className="size-3.5 shrink-0 text-amber-500" />}
            {p.streak >= 2 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500">
                <Flame className="size-3" />
                {p.streak}
              </span>
            )}
            {!compact && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {p.score.toLocaleString("ar")}
              </span>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
