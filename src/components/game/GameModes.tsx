import React from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Lock, Play, Zap, Puzzle, Crown, Timer, BookOpen, Gift, Sparkles, Swords, Gem } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sound } from "@/lib/sounds";

const MODE_ICONS: Record<string, React.ReactNode> = {
  quiz_rush: <Zap className="w-8 h-8" />,
  puzzle_masters: <Puzzle className="w-8 h-8" />,
  champion_battle: <Swords className="w-8 h-8" />,
  diamond_rush: <Gem className="w-8 h-8" />,
  legend_arena: <Crown className="w-8 h-8" />,
};

const MODE_GRADIENTS: Record<string, string> = {
  quiz_rush: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  puzzle_masters: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
  champion_battle: "from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
  diamond_rush: "from-cyan-400/20 to-blue-500/20 border-cyan-400/30",
  legend_arena: "from-purple-500/20 to-violet-600/20 border-purple-500/30",
};

const MODE_TEXT: Record<string, string> = {
  quiz_rush: "text-blue-400",
  puzzle_masters: "text-purple-400",
  champion_battle: "text-yellow-400",
  diamond_rush: "text-cyan-400",
  legend_arena: "text-purple-400",
};

const MODE_BG: Record<string, string> = {
  quiz_rush: "bg-blue-500/10",
  puzzle_masters: "bg-purple-500/10",
  champion_battle: "bg-yellow-500/10",
  diamond_rush: "bg-cyan-500/10",
  legend_arena: "bg-purple-500/10",
};

const TIER_LABELS: Record<string, string> = {
  bronze: "مجاني",
  silver: "فضي",
  gold: "ذهبي",
  diamond: "ماسي",
  exclusive: "حصري",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-gray-500/20 text-gray-400",
  silver: "bg-slate-400/20 text-slate-300",
  gold: "bg-yellow-500/20 text-yellow-300",
  diamond: "bg-cyan-400/20 text-cyan-300",
  exclusive: "bg-purple-500/20 text-purple-300",
};

export function GameModes() {
  const navigate = useNavigate();
  const modes = useQuery(api.gameModes.getAvailableGameModes);
  const createRound = useMutation(api.gameModes.createGameModeRound);

  const handlePlay = async (modeId: string) => {
    try {
      Sound.click();
      const result = await createRound({ gameModeId: modeId });
      Sound.gameStart();
      navigate(`/game/${result.code}`);
    } catch (e: unknown) {
      Sound.error();
      alert(e instanceof Error ? e.message : "خطأ");
    }
  };

  if (!modes) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse bg-muted/30 border-border/30">
            <CardContent className="p-6 h-56" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <span className="text-3xl">🎮</span>
          الألعاب الرئيسية الخمس
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          كل لعبة لها مميزاتها ومكافآتها — اختر ما يناسبك!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modes.map((mode, i) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card
              className={`relative overflow-hidden bg-gradient-to-br ${MODE_GRADIENTS[mode.id]} ${
                !mode.unlocked
                  ? "opacity-60"
                  : "hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              }`}
            >
              <CardContent className="p-5 space-y-3">
                {/* Header: icon + lock/unlock badge */}
                <div className="flex items-start justify-between">
                  <div className={`${MODE_TEXT[mode.id]}`}>
                    {MODE_ICONS[mode.id]}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_COLORS[mode.minTier]}`}>
                      {TIER_LABELS[mode.minTier]}
                    </span>
                    {!mode.unlocked ? (
                      <div className="flex items-center gap-1 bg-background/60 backdrop-blur-sm rounded-full px-2 py-1">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] ${MODE_TEXT[mode.id]}`}>
                        مفتوح
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Title + description */}
                <div>
                  <h3 className="text-lg font-bold">{mode.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{mode.description}</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <span>{mode.questionCount} سؤال</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Timer className="w-3 h-3 text-muted-foreground" />
                    <span>{mode.timePerQuestion}s لكل سؤال</span>
                  </div>
                </div>

                {/* Daily limit indicator */}
                {mode.unlocked && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">اليوم: {mode.usedToday}/{mode.dailyLimit}</span>
                      <span className={`font-bold ${mode.remaining === 0 ? "text-red-400" : "text-green-400"}`}>
                        {mode.remaining === 0 ? "انتهى" : `متبقي ${mode.remaining}`}
                      </span>
                    </div>
                    <Progress
                      value={mode.dailyLimit > 0 ? (mode.usedToday / mode.dailyLimit) * 100 : 0}
                      className="h-1"
                    />
                  </div>
                )}

                {/* Features */}
                <div className="space-y-1">
                  {mode.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                {/* Rewards */}
                <div className={`flex items-center gap-1.5 p-2 rounded-lg ${MODE_BG[mode.id]} text-xs`}>
                  <Gift className="w-3.5 h-3.5 text-yellow-400" />
                  <span>
                    +{mode.rewards.xpPerCorrect} XP/سؤال • +{mode.rewards.xpBonusWin} XP للفوز
                  </span>
                </div>

                {/* Play button */}
                <Button
                  className="w-full"
                  disabled={!mode.unlocked || (mode.unlocked && mode.remaining === 0)}
                  onClick={() => handlePlay(mode.id)}
                  variant={mode.unlocked ? "default" : "outline"}
                >
                  {mode.unlocked ? (
                    mode.remaining === 0 ? (
                      <>
                        <Lock className="w-4 h-4 ml-1.5" />
                        انتهت الجولات اليومية
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 ml-1.5" />
                        ابدأ اللعب
                      </>
                    )
                  ) : (
                    <>
                      <Lock className="w-4 h-4 ml-1.5" />
                      يتطلب عضوية {TIER_LABELS[mode.minTier]}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default GameModes;
