import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { sounds } from "@/lib/sounds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lobby } from "@/components/game/Lobby";
import { QuestionStage } from "@/components/game/QuestionStage";
import { ResultsStage } from "@/components/game/ResultsStage";
import { copyText } from "@/components/game/ui";
import {
  BrainCircuit,
  Copy,
  Home,
  Loader2,
  LogOut,
  SearchX,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";

function RoomShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10">{children}</div>
    </div>
  );
}

export default function Game() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const data = useQuery(api.games.getGame, { code });
  const leaveGame = useMutation(api.games.leaveGame);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(sounds.isMuted());

  const toggleMuted = () => {
    setMuted(sounds.toggleMuted());
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveGame({ code });
    } catch (error) {
      console.error(error);
    }
    navigate("/play");
  };

  // Loading
  if (data === undefined) {
    return (
      <RoomShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جارٍ الدخول إلى الغرفة…</p>
        </div>
      </RoomShell>
    );
  }

  // Not found
  if (data === null) {
    return (
      <RoomShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <SearchX className="size-8" />
          </span>
          <h1 className="mt-6 text-2xl font-bold">لم نعثر على هذه الغرفة</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            ربما انتهى التحدي أو أُغلقت الغرفة من قبل منشئها. تحقق من الرمز
            وحاول مجدداً.
          </p>
          <Button className="mt-8 gap-2 rounded-xl" onClick={() => navigate("/play")}>
            <Home className="size-4" />
            العودة للرئيسية
          </Button>
        </div>
      </RoomShell>
    );
  }

  const me = data.players.find((p) => p.isMe);
  const progress =
    data.game.status === "playing"
      ? `سؤال ${data.game.currentQuestionIndex + 1} من ${data.game.questionCount}`
      : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BrainCircuit className="size-5" />
            </span>
            <span className="hidden text-lg font-bold tracking-tight sm:block">
              تحدّي العقول
            </span>
          </button>

          <div className="flex items-center gap-2">
            {progress && (
              <Badge
                variant="secondary"
                className="hidden rounded-full px-3 py-1.5 text-xs sm:inline-flex"
              >
                {progress}
              </Badge>
            )}
            <button
              type="button"
              onClick={toggleMuted}
              className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground"
              title={muted ? "تشغيل الصوت" : "كتم الصوت"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/profile")}
            >
              <UserRound className="size-3.5" />
              <span className="hidden sm:inline">ملفي</span>
            </Button>
            <Badge
              variant="outline"
              className="cursor-pointer gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-bold tracking-[0.2em] text-foreground"
              onClick={() => copyText(data.game.code, "الرمز")}
              title="نسخ رمز الغرفة"
            >
              {data.game.code}
              <Copy className="size-3.5 text-muted-foreground" />
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogOut className="size-3.5" />
              )}
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">
        {data.game.status === "waiting" && <Lobby game={data} me={me} onLeave={handleLeave} />}
        {data.game.status === "playing" && me && <QuestionStage game={data} me={me} />}
        {data.game.status === "finished" && <ResultsStage game={data} />}
      </main>
    </div>
  );
}
