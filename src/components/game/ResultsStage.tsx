import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameData, PlayerInfo } from "@/convex/games";
import { FIRST_GAME_OF_DAY_XP } from "@/convex/gameConfig";
import { burstConfetti } from "@/lib/confetti";
import { sounds } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Crown,
  Home,
  Loader2,
  Medal,
  PartyPopper,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  UserRound,
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
        <GameAvatar
          name={player.name}
          className={cn("size-14 text-lg", place === 1 && "size-16")}
        />
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
  const rematch = useMutation(api.games.rematch);
  const navigate = useNavigate();
  const [rematching, setRematching] = useState(false);
  const me = game.players.find((p) => p.isMe);
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const myResult = game.myResult;
  const isHost = me?.isHost ?? false;
  const won = winner?.isMe ?? false;

  // Celebration / consolation feedback once.
  useEffect(() => {
    if (won) {
      sounds.win();
      burstConfetti();
    } else {
      sounds.lose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everyone follows the host into a rematch automatically.
  useEffect(() => {
    if (game.game.rematchCode) {
      navigate(`/game/${game.game.rematchCode}`);
    }
  }, [game.game.rematchCode, navigate]);

  const handleRematch = async () => {
    setRematching(true);
    try {
      const { code } = await rematch({ code: game.game.code });
      navigate(`/game/${code}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر إنشاء جولة جديدة.",
      );
      setRematching(false);
    }
  };

  const handleShare = async () => {
    const lines = sorted
      .map((p, i) => `${i + 1}. ${p.name}: ${p.score} نقطة`)
      .join("\n");
    const text = `🏆 نباهة — النتيجة النهائية!\n\n${lines}\n\n${
      won ? "أنا البطل! 🎉" : `الفائز: ${winner?.name ?? ""}`
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "نباهة", text });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ النتيجة");
    } catch {
      toast.error("تعذّر نسخ النتيجة");
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
          {won ? "أنت البطل! 🏆" : `${winner?.name ?? ""} يتصدّر!`}
        </h2>
        <p className="mt-2 text-muted-foreground">
          انتهت الجولة — {sorted.length} لاعب، {game.game.questionCount} أسئلة،
          ومنافسة لا تُنسى.
        </p>

        {/* My rewards */}
        {myResult && (
          <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-start">
              <p className="text-xs font-semibold text-muted-foreground">
                المركز {myResult.rank} من {myResult.playerCount}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xl font-bold text-amber-600">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "size-5",
                      star <= myResult.stars
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30",
                    )}
                  />
                ))}
                <span className="ms-1 text-xs font-semibold text-muted-foreground">
                  {myResult.stars}/3 نجوم
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                فوز + دقة 60% فأعلى = 3 نجوم
              </p>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-start">
              <p className="text-xs font-semibold text-muted-foreground">خبرة الجولة</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-primary">
                <Sparkles className="size-5" />
                +{myResult.xpEarned}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                تُضاف إلى مستواك في الملف الشخصي
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 text-start">
              <p className="text-xs font-semibold text-muted-foreground">
                شارات جديدة
              </p>
              {myResult.badgesEarned.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {myResult.badgesEarned.map((badge) => (
                    <span
                      key={badge.id}
                      title={badge.description}
                      className="flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-700"
                    >
                      {badge.emoji} {badge.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  لا شارات جديدة — استمر!
                </p>
              )}
            </div>
          </div>
        )}

        {/* First game of the day bonus */}
        {myResult?.firstOfDay && (
          <div className="mx-auto mt-4 flex max-w-2xl items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-start">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              هذه أول جولة لك اليوم — حصلت على <b className="text-primary">+{FIRST_GAME_OF_DAY_XP} نقطة</b> مكافأة
              «أول جولة في اليوم». عد غداً لاستلام المكافأة اليومية من ملفك الشخصي. ✨
            </p>
          </div>
        )}
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

      {/* Per-question review */}
      {me && game.questions.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/70 px-6 py-4">
            <p className="text-sm font-bold">مراجعة الأسئلة</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              إجاباتك بالتفصيل — ماذا أجبتم وكيف كانت الصحيحة؟
            </p>
          </div>
          <ul className="divide-y divide-border/50">
            {game.questions.map((question, i) => {
              const answer = me.answers[i] ?? null;
              return (
                <li key={question.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-relaxed">
                      <span className="ms-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      {question.question}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                        answer?.correct
                          ? "bg-emerald-500/10 text-emerald-700"
                          : answer
                            ? "bg-rose-500/10 text-rose-700"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {answer ? (answer.correct ? `+${answer.points}` : "0") : "—"}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground">إجابتك:</span>
                      {answer ? (
                        question.options[answer.selected]
                      ) : (
                        <span className="italic">لم تجب</span>
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-emerald-700">
                      <Check className="size-3.5" />
                      <span className="font-semibold">الصحيحة:</span>
                      {question.options[question.correctIndex ?? 0]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {isHost ? (
          <Button
            size="lg"
            className="gap-2 rounded-xl text-base"
            onClick={handleRematch}
            disabled={rematching}
          >
            {rematching ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <RefreshCw className="size-4.5" />
            )}
            جولة جديدة بنفس اللاعبين
          </Button>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
            <RefreshCw className="size-4" />
            بانتظار المضيف لبدء جولة جديدة…
          </div>
        )}
        <Button
          size="lg"
          variant="outline"
          className="gap-2 rounded-xl text-base"
          onClick={handleShare}
        >
          <Share2 className="size-4.5" />
          مشاركة النتيجة
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2 rounded-xl text-base"
          onClick={() => navigate("/profile")}
        >
          <UserRound className="size-4.5" />
          ملفي الشخصي
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="gap-2 rounded-xl text-base"
          onClick={() => navigate("/play")}
        >
          <Home className="size-4.5" />
          الرئيسية
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Copy className="ms-1 inline size-3" />
        كل جولة تمنح خبرة تُضاف إلى مستواك وشاراتك في الملف الشخصي.
      </p>
    </div>
  );
}
