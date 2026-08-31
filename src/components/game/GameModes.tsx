import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Lock, Play, Zap, Puzzle, Crown, Timer, BookOpen, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sound } from "@/lib/sounds";

const MODE_ICONS: Record<string, React.ReactNode> = {
  quiz_rush: <Zap className="w-8 h-8" />,
  puzzle_masters: <Puzzle className="w-8 h-8" />,
  champion_battle: <Crown className="w-8 h-8" />,
};

const MODE_COLORS: Record<string, string> = {
  quiz_rush: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  puzzle_masters: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
  champion_battle: "from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
};

const MODE_TEXT_COLORS: Record<string, string> = {
  quiz_rush: "text-blue-400",
  puzzle_masters: "text-purple-400",
  champion_battle: "text-yellow-400",
};

const TIER_LABELS: Record<string, string> = {
  bronze: "مجاني",
  silver: "فضي",
  gold: "ذهبي",
  diamond: "ماسي",
  exclusive: "حصري",
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
      alert(e instanceof Error ? e.message : "خطأ");
    }
  };

  if (!modes) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse bg-muted/30 border-border/30">
            <CardContent className="p-6 h-64" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">🎮 الألعاب الرئيسية الثلاث</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          كل لعبة لها مميزاتها ومكافآتها — اختر ما يناسبك!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {modes.map((mode, i) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className={`relative overflow-hidden bg-gradient-to-br ${MODE_COLORS[mode.id]} ${
                !mode.unlocked ? "opacity-70" : "hover:shadow-lg hover:scale-[1.02] transition-all"
              }`}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className={MODE_TEXT_COLORS[mode.id]}>
                    {MODE_ICONS[mode.id]}
                  </div>
                  {!mode.unlocked ? (
                    <div className="flex items-center gap-1 bg-background/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {TIER_LABELS[mode.minTier]}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] ${MODE_TEXT_COLORS[mode.id]}`}>
                      مفتوح
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold">{mode.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <span>{mode.questionCount} سؤال</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Timer className="w-3 h-3 text-muted-foreground" />
                    <span>{mode.timePerQuestion}s</span>
                  </div>
                </div>

                <div className="space-y-1">
                  {mode.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-background/30 text-xs">
                  <Gift className="w-3.5 h-3.5 text-yellow-400" />
                  <span>
                    +{mode.rewards.xpPerCorrect} XP/سؤال • +{mode.rewards.xpBonusWin} XP للفوز
                  </span>
                </div>

                <Button
                  className="w-full"
                  disabled={!mode.unlocked}
                  onClick={() => handlePlay(mode.id)}
                  variant={mode.unlocked ? "default" : "outline"}
                >
                  {mode.unlocked ? (
                    <>
                      <Play className="w-4 h-4 ml-1.5" />
                      ابدأ اللعب
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 ml-1.5" />
                      يتطلب {TIER_LABELS[mode.minTier]}
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
