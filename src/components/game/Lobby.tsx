import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameData } from "@/convex/games";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Check,
  Crown,
  Copy,
  Link2,
  Loader2,
  Play,
  Share2,
  Users,
  UserRoundPlus,
} from "lucide-react";
import { GameAvatar, copyText } from "./ui";

export function Lobby({
  game,
  me,
  onLeave,
}: {
  game: GameData;
  me: GameData["players"][number] | undefined;
  onLeave: () => void;
}) {
  const startGame = useMutation(api.games.startGame);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const host = game.players.find((p) => p.isHost);
  const isHost = me?.isHost ?? false;
  const code = game.game.code;
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${code}`
      : "";

  const handleCopy = async (kind: "code" | "link") => {
    await copyText(kind === "code" ? code : inviteLink, kind === "code" ? "الرمز" : "رابط الدعوة");
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await startGame({ code });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر بدء التحدي، حاول مجدداً.",
      );
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Invite card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 start-1/2 h-52 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <Badge variant="outline" className="gap-1.5 rounded-full text-primary">
          <UserRoundPlus className="size-3.5" />
          شارك الرمز وابدأ التحدي
        </Badge>

        <h2 className="mt-6 text-sm font-semibold text-muted-foreground">
          رمز الغرفة
        </h2>
        <div className="mt-2 flex justify-center gap-2">
          {code.split("").map((char, i) => (
            <span
              key={i}
              className="flex size-12 items-center justify-center rounded-xl border border-border/80 bg-background text-2xl font-bold tracking-wider text-foreground shadow-sm"
            >
              {char}
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => handleCopy("code")}>
            {copied === "code" ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4" />
            )}
            نسخ الرمز
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => handleCopy("link")}>
            {copied === "link" ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Link2 className="size-4" />
            )}
            نسخ رابط الدعوة
          </Button>
          {navigator.share && (
            <Button
              variant="ghost"
              className="gap-2 rounded-xl"
              onClick={() => {
                navigator
                  .share({
                    title: "تحدّي العقول",
                    text: `انضم إليّ في تحدي العقول! رمز الغرفة: ${code}`,
                    url: inviteLink,
                  })
                  .catch(() => undefined);
              }}
            >
              <Share2 className="size-4" />
              مشاركة
            </Button>
          )}
        </div>
      </div>

      {/* Players */}
      <div className="mt-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4 text-primary" />
            اللاعبون ({game.players.length})
          </p>
          <span className="text-xs text-muted-foreground">
            سيبدأ التحدي تلقائياً بعد ضغط «ابدأ»
          </span>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {game.players.map((player, i) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3"
            >
              <GameAvatar name={player.name} index={i} />
              <span className="flex-1 truncate text-sm font-semibold text-foreground">
                {player.name}
                {player.isMe && (
                  <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    أنت
                  </span>
                )}
              </span>
              {player.isHost && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Crown className="size-3.5" />
                  المضيف
                </span>
              )}
            </li>
          ))}
        </ul>

        {host && !isHost && (
          <p className="mt-5 rounded-xl bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
            بانتظار <span className="font-bold text-foreground">{host.name}</span>{" "}
            لبدء التحدي…
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {isHost ? (
          <Button
            size="lg"
            className="flex-1 gap-2 rounded-xl text-base"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <Play className="size-4.5" />
            )}
            {game.players.length < 2 ? "ابدأ التحدي وحدك" : "ابدأ التحدي"}
          </Button>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm font-medium text-primary">
            مستعد؟ انتظر المضيف لبدء الجولة
          </div>
        )}
        <Button variant="outline" size="lg" className="gap-2 rounded-xl" onClick={onLeave}>
          مغادرة الغرفة
        </Button>
      </div>

      {isHost && game.players.length < 2 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          يمكنك البدء وحدك للتدريب، لكن التحدي يكون أجمل مع صديق واحد على الأقل.
        </p>
      )}
    </div>
  );
}
