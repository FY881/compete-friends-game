import { useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  BrainCircuit,
  Crown,
  Target,
  Flame,
  Gamepad2,
  Loader2,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { GAME_CATEGORIES, type MiniGameDef } from "@/components/game/MiniGames";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "text-emerald-600 bg-emerald-500/10",
  medium: "text-amber-600 bg-amber-500/10",
  hard: "text-rose-600 bg-rose-500/10",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

export default function MiniGames() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<MiniGameDef | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const myMembership = useQuery(api.memberships.getMyMembership);

  // ترتيب العضويات من الأقل إلى الأعلى
  const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"] as const;
  const myTierIndex = myMembership ? TIER_ORDER.indexOf(myMembership.tier as any) : -1;

  const category = GAME_CATEGORIES.find(c => c.id === selectedCategory);

  const handleGameComplete = (gameId: string, score: number, _timeTaken: number) => {
    setScores(prev => ({
      ...prev,
      [gameId]: Math.max(prev[gameId] ?? 0, score),
    }));
    toast.success(`أحسنت! حصلت على ${score} نقطة 🎉`);
    setActiveGame(null);
  };

  // Active game view
  if (activeGame) {
    const GameComponent = activeGame.component;
    return (
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
            <button
              type="button"
              onClick={() => setActiveGame(null)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              <span className="text-sm font-bold">{activeGame.name}</span>
            </button>
            <Badge className={cn("rounded-full", DIFFICULTY_STYLES[activeGame.difficulty])}>
              {DIFFICULTY_LABELS[activeGame.difficulty]}
            </Badge>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-10">
          <GameComponent
            onComplete={(score, timeTaken) => handleGameComplete(activeGame.id, score, timeTaken)}
            onExit={() => setActiveGame(null)}
          />
        </main>
      </div>
    );
  }

  // Category view
  if (category) {
    return (
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-4" />
              <span className="text-sm font-bold">{category.name}</span>
            </button>
            <Badge variant="outline">{category.games.length} ألعاب</Badge>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              اختر لعبة واثبت مهاراتك — 80 لعبة في انتظارك!
        
        {/* AI Difficulty Info */}
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
          <p className="text-xs font-bold text-primary">🤖 الذكاء الاصطناعي يضبط مستوى الصعوبة تلقائياً بناءً على أدائك</p>
        </div>
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.games.map((game) => {
              const gameTierIndex = game.tier ? TIER_ORDER.indexOf(game.tier) : 0;
              const isLocked = gameTierIndex > myTierIndex + 1;
              const TIER_EMOJI: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎", exclusive: "👑" };
              return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  className={cn("border-border/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5", isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
                  onClick={() => !isLocked && setActiveGame(game)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{game.name}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {game.description}
                        </p>
                      </div>
                      {scores[game.id] != null && (
                        <Badge variant="outline" className="shrink-0 gap-1 text-primary">
                          <Star className="size-3" />
                          {scores[game.id]}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge className={cn("rounded-full text-[10px]", DIFFICULTY_STYLES[game.difficulty])}>
                        {DIFFICULTY_LABELS[game.difficulty]}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        <Zap className="size-3" />
                        {game.xpReward} XP
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        ⏱ {game.timeLimit}ث
                      </Badge>
                      {game.tier && (
                        <Badge variant="outline" className="rounded-full text-[10px] gap-1">
                          {TIER_EMOJI[game.tier]} {isLocked ? "قفل" : ""}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Categories overview
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/play" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BrainCircuit className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">ذكاء</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 rounded-full">
              <Gamepad2 className="size-3.5" />
              80 لعبة ذكية
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card p-8 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 start-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
              <Gamepad2 className="size-8" />
            </motion.div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">
              مركز الألعاب المصغرة — 80 لعبة ذكية
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              أكثر من {GAME_CATEGORIES.reduce((sum, c) => sum + c.games.length, 0)} لعبة مصغرة متنوعة
              في 8 فئات مختلفة — اختبر مهاراتك في الذاكرة والسرعة والاستراتيجية والمزيد!
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Badge className="gap-1.5 bg-primary/10 text-primary">
                <BrainCircuit className="size-3.5" />
                ذكاء وتركيز
              </Badge>
              <Badge className="gap-1.5 bg-amber-500/10 text-amber-600">
                <Zap className="size-3.5" />
                سرعة وردود
              </Badge>
              <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-600">
                <Sparkles className="size-3.5" />
                كلمات ولغة
              </Badge>
              <Badge className="gap-1.5 bg-rose-500/10 text-rose-600">
                <Target className="size-3.5" />
                استراتيجية ومنطق
              </Badge>
            </div>
          </div>
        </section>

        {/* Categories Grid */}
        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GAME_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            const bestScore = cat.games.reduce((sum, g) => sum + (scores[g.id] ?? 0), 0);
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card
                  className="cursor-pointer border-border/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className={cn("flex size-11 items-center justify-center rounded-xl", cat.color)}>
                        <Icon className="size-5.5" />
                      </span>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {cat.games.length} ألعاب
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-bold">{cat.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cat.games[0].description}
                    </p>
                    {bestScore > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                        <Trophy className="size-3.5" />
                        <span className="font-bold">{bestScore}</span>
                        <span className="text-muted-foreground">نقطة</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </section>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-3 gap-4">
          <Card className="border-border/80 text-center shadow-sm">
            <CardContent className="p-5">
              <Trophy className="mx-auto size-6 text-amber-500" />
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {Object.values(scores).reduce((a, b) => a + b, 0).toLocaleString("ar")}
              </p>
              <p className="text-xs text-muted-foreground">إجمالي النقاط</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 text-center shadow-sm">
            <CardContent className="p-5">
              <Star className="mx-auto size-6 text-primary" />
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {Object.keys(scores).length}
              </p>
              <p className="text-xs text-muted-foreground">ألعاب مكتملة</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 text-center shadow-sm">
            <CardContent className="p-5">
              <Flame className="mx-auto size-6 text-orange-500" />
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {Object.values(scores).filter(s => s >= 100).length}
              </p>
              <p className="text-xs text-muted-foreground">نقاط عالية</p>
            </CardContent>
          </Card>
        </section>

        {/* Back */}
        <div className="mt-8 text-center">
          <Button asChild variant="outline" className="gap-2 rounded-xl">
            <Link to="/play">
              <ArrowLeft className="size-4" />
              العودة للعبة الرئيسية
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}


