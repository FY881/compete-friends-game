import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  BrainCircuit,
  Copy,
  Gamepad2,
  KeyRound,
  Loader2,
  LogOut,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router";

const NICKNAME_KEY = "mindclash.nickname";

function avatarColor(name: string) {
  const colors = [
    "bg-teal-600",
    "bg-amber-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-emerald-600",
    "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return colors[hash % colors.length];
}

export default function Play() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const displayName = user?.name ?? "";
  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem(NICKNAME_KEY) ?? displayName;
    } catch {
      return displayName;
    }
  });
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const persistNickname = (value: string) => {
    setNickname(value);
    try {
      localStorage.setItem(NICKNAME_KEY, value);
    } catch {
      // ignore storage failures
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { code: roomCode } = await createGame({ name: nickname.trim() });
      navigate(`/game/${roomCode}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر إنشاء التحدي، حاول مجدداً.",
      );
      setCreating(false);
    }
  };

  const handleJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim().length < 4) {
      toast.error("أدخل رمز التحدي أولاً.");
      return;
    }
    setJoining(true);
    try {
      const { code: roomCode } = await joinGame({
        code: code.trim(),
        name: nickname.trim(),
      });
      navigate(`/game/${roomCode}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر الانضمام، تحقق من الرمز.",
      );
      setJoining(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const headerInitial = (nickname || displayName || "أنت").slice(0, 1);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Header */}
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
            <span className="text-lg font-bold tracking-tight">تحدّي العقول</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar className="size-8">
                {user?.image && <AvatarImage src={user.image} alt={displayName} />}
                <AvatarFallback
                  className={`text-xs font-semibold text-white ${avatarColor(headerInitial)}`}
                >
                  {headerInitial}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-36 truncate text-sm font-medium">
                {displayName || "ضيف"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-14">
        {/* Intro */}
        <div className="text-center">
          <Badge variant="outline" className="mb-5 gap-1.5 rounded-full text-primary">
            <Zap className="size-3.5" />
            جاهز للمنافسة؟
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            أنشئ غرفة، أو انضم لأصدقائك
          </h1>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            كل غرفة تُلعب فيها خمسة أسئلة سريعة، والفوز لمن يجيب أسرع وبأكبر
            قدر من الصحة. أرسل الرمز لأصدقائك ودع المنافسة تبدأ.
          </p>
        </div>

        {/* Nickname */}
        <div className="mx-auto mt-10 max-w-xl">
          <label
            htmlFor="nickname"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            اسمك في التحدي
          </label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => persistNickname(e.target.value)}
            maxLength={24}
            placeholder="مثال: الصقر الجريء"
            className="h-11 rounded-xl bg-card text-base"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            سيظهر هذا الاسم لأصدقائك في الترتيب، ويمكنك تغييره في أي وقت.
          </p>
        </div>

        {/* Action cards */}
        <div className="mx-auto mt-8 grid max-w-3xl gap-5 md:grid-cols-2">
          {/* Create */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl border border-primary/25 bg-card p-7 shadow-sm transition-all hover:shadow-md hover:shadow-primary/5">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -start-16 size-48 rounded-full bg-primary/10 blur-2xl"
            />
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Gamepad2 className="size-6" />
            </span>
            <h2 className="mt-5 text-xl font-bold">أنشئ تحدياً جديداً</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              توليد رمز خاص لغرفتك خلال ثانية. شاركه مع أصدقائك وابدأ أول
              سؤال فور أن يكون الجميع جاهزاً.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-4 text-primary" />
              1 – 10 لاعبين في الغرفة الواحدة
            </div>
            <Button
              type="button"
              size="lg"
              className="mt-4 gap-2 rounded-xl"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="size-4.5 animate-spin" />
              ) : (
                <Gamepad2 className="size-4.5" />
              )}
              إنشاء الغرفة
            </Button>
          </div>

          {/* Join */}
          <form
            onSubmit={handleJoin}
            className="flex flex-col rounded-2xl border border-border/80 bg-card p-7 shadow-sm transition-all hover:shadow-md"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <KeyRound className="size-6" />
            </span>
            <h2 className="mt-5 text-xl font-bold">انضم برمز</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              وصلك رمز من صديق؟ أدخله هنا وادخل الغرفة فوراً قبل أن يبدأ
              التحدي.
            </p>
            <Input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
                )
              }
              placeholder="K7P2MX"
              maxLength={6}
              className="mt-6 h-12 rounded-xl bg-background text-center text-lg font-bold tracking-[0.3em]"
              aria-label="رمز التحدي"
            />
            <Button
              type="submit"
              size="lg"
              variant="secondary"
              className="mt-4 gap-2 rounded-xl"
              disabled={joining}
            >
              {joining ? (
                <Loader2 className="size-4.5 animate-spin" />
              ) : (
                <ArrowLeft className="size-4.5" />
              )}
              انضمام
            </Button>
          </form>
        </div>

        {/* Reminder strip */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/70 bg-card/60 p-6">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Swords, title: "5 أسئلة سريعة", text: "فئات متنوعة في كل جولة" },
              { icon: Zap, title: "السرعة تكسب", text: "حتى 200 نقطة للإجابة الصحيحة" },
              { icon: Trophy, title: "منصة الفائزين", text: "ترتيب مباشر ومنصة في النهاية" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <Copy className="size-3.5 text-primary" />
            داخل الغرفة يمكنك نسخ رمز الدعوة أو رابط الانضمام بنقرة واحدة.
          </p>
        </div>
      </main>
    </div>
  );
}
