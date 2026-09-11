import { ZakaLogo } from "@/components/ZakaLogo";
import { OWNER_ROOM_ENABLED } from "@/lib/buildFlags";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { downloadApk } from "@/lib/app-version";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { TournamentPanel } from "@/components/TournamentPanel";
import { ArenaPanel } from "@/components/ArenaPanel";
import { RivalryPanel } from "@/components/RivalryPanel";
import { LeaguePanel } from "@/components/LeaguePanel";
import { ActivePackBanner } from "@/components/ActivePackBanner";
import { HighlightsCard } from "@/components/HighlightsCard";
import { ClanPanel } from "@/components/ClanPanel";
import { SeasonPassPanel } from "@/components/SeasonPassPanel";
import { LoyaltyPanel } from "@/components/LoyaltyPanel";
import { CosmeticShop } from "@/components/CosmeticShop";
import { ClanWarPanel } from "@/components/ClanWarPanel";
import { QuestsPanel } from "@/components/QuestsPanel";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MembershipPanel, GiftsPanel, ReportButton } from "@/components/PlayerSocialFeatures";
import MembershipShowcase from "@/components/MembershipShowcase";
import { Sound } from "@/lib/sounds";
import { FeaturesShowcase } from "@/components/FeaturesShowcase";
import { GameModes } from "@/components/game/GameModes";
import { Volume2, VolumeX } from "lucide-react";
import { OwnerLoginDialog } from "@/components/OwnerLoginDialog";
import StorePage from "@/components/StorePage";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Crown,
  Download,
  Flame,
  Gamepad2,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Medal,
  MessageSquare,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Award,
  Zap, Timer, Coffee, Moon, Star,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  ANSWER_MS,
  DURATION_MODE_OFF,
  DURATION_OPTIONS,
  formatDurationLabel,
} from "@/lib/game-config";

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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Play() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const createGame = useMutation(api.games.createGame);
  const getAiHint = useAction(api.openRouter.getAiHint);
  const analyzePerformance = useAction(api.openRouter.analyzePlayerPerformance);
  const [dailyChallengeLoading, setDailyChallengeLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const joinGame = useMutation(api.games.joinGame);
  const setDisplayName = useMutation(api.profile.setDisplayName);
  const joinRef = useRef<HTMLInputElement>(null);

  const profile = useQuery(api.stats.getMyProfile);
  const discipline = useQuery(api.owner.getMyDiscipline);
  const topPlayers = useQuery(api.stats.getTopPlayers, { limit: 5 });
  const appInfo = useQuery(api.appInfo.getAppInfo);

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
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  // «مدة الجولة» at room creation: classic (by question count) or a timed
  // match (5/10/15 دقائق — the round runs on the clock until time runs out).
  const [roundDuration, setRoundDuration] = useState<number>(DURATION_MODE_OFF);

  const persistNickname = (value: string) => {
    setNickname(value);
    try {
      localStorage.setItem(NICKNAME_KEY, value);
    } catch {
      // ignore storage failures
    }
  };

  /** احفظ الاسم على الحساب نفسه (ملف اللاعب + ترتيب النخبة). */
  const syncAccountName = (value: string) => {
    const clean = value.trim();
    if (clean.length < 2 || clean === displayName) return;
    setDisplayName({ name: clean }).catch(() => {
      // الاسم محفوظ محلياً على أي حال — يُزامَن لاحقاً عند الدخول.
    });
  };

  const handleDailyChallenge = async () => {
    if (dailyChallengeLoading) return;
    setDailyChallengeLoading(true);
    try {
      // التحدي اليومي يتولّد عبر نظامي مركز API (خادمياً) — لا حاجة لمفتاح من المتصفح
      toast.success("🎯 جاري تحميل التحدي اليومي بالذكاء الاصطناعي...");
      navigate("/games");
    } catch (e) {
      toast.error("خطأ في تحميل التحدي");
    } finally {
      setDailyChallengeLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!profile) return;
    try {
      // التحليل يجري عبر نظامي مركز API على الخادم — لا مفتاح من المتصفح
      const stats = JSON.stringify({
        gamesPlayed: profile.gamesPlayed,
        gamesWon: profile.gamesWon,
        bestScore: profile.bestScore,
        level: profile.level,
      });
      const res = await analyzePerformance({ apiKey: "", playerStats: stats });
      setAiAnalysis(res.overallRating + ": " + (res.suggestions?.join(", ") ?? ""));
      toast.success("🤖 تم تحليل أدائك بالحرب العقول الاصطناعي!");
    } catch (e) {
      toast.error("خطأ في التحليل");
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      syncAccountName(nickname);
      const settings =
        roundDuration > 0
          ? {
              questionCount: 5,
              timePerQuestionMs: ANSWER_MS,
              categories: [],
              durationMinutes: roundDuration,
            }
          : undefined;
      const { code: roomCode } = await createGame({
        name: nickname.trim(),
        settings,
      });
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
      syncAccountName(nickname);
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

  /** تنزيل APK عبر JavaScript (fetch + Blob) — لا يفتح أي صفحة ولا مسار قد يفشل. */
  const handleDownloadApk = async () => {
    if (downloadingApk) return;
    setDownloadingApk(true);
    try {
      await downloadApk(appInfo?.apkFileName, appInfo?.siteUrl);
      toast.success("بدأ تنزيل ملف APK — افحص شريط التنزيل في متصفحك.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر التنزيل، حاول مرة أخرى.",
      );
    } finally {
      setDownloadingApk(false);
    }
  };

  const headerInitial = (nickname || displayName || "أنت").slice(0, 1);
  const banned =
    discipline?.bannedPermanent ||
    ((discipline?.bannedUntil ?? 0) > Date.now());
  const muted = (discipline?.mutedUntil ?? 0) > Date.now();

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <AnnouncementBanner />

      {/* ── Update notice (server-driven version check) ────────── */}
      <div className="mx-auto max-w-6xl space-y-4 px-5 pt-5">
        <UpdateBanner />
        <ActivePackBanner />
        <HighlightsCard />
        <TournamentPanel />
        <ArenaPanel />
        <RivalryPanel />
        <LeaguePanel />
        <ClanWarPanel />
        <ClanPanel />
        <SeasonPassPanel />
        <QuestsPanel />
        <LoyaltyPanel />
        <CosmeticShop />
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ZakaLogo className="size-5 text-primary-foreground" size={20} />
            </span>
            <span className="text-lg font-bold tracking-tight">حرب العقول</span>
          </button>

          <div className="flex items-center gap-2.5">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-primary">
              <Link to="/hub">
                <Award className="size-3.5" />
                <span className="hidden lg:inline">مركز التقدم</span>
              </Link>
            </Button>
            <NotificationsBell />
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/download">
                <Smartphone className="size-3.5" />
                <span className="hidden md:inline">تحميل التطبيق</span>
              </Link>
            </Button>
            {OWNER_ROOM_ENABLED && (discipline?.isOwner ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-primary"
                onClick={() => navigate("/owner")}
              >
                <ShieldCheck className="size-3.5" />
                <span className="hidden sm:inline">غرفة المالك</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => navigate("/owner-login")}
                title="دخول المالك بكلمة المرور"
              >
                <ShieldCheck className="size-3.5" />
              </Button>
            ))}
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
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => Sound.toggleMuted()}
              title={Sound.isMuted() ? "تشغيل الصوت" : "كتم الصوت"}
            >
              {Sound.isMuted() ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>
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

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-12">
        {/* ── Discipline banners ───────────────────────────────── */}
        {discipline && banned && (
          <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <ShieldCheck className="size-4" />
              حسابك محظور{" "}
              {discipline.bannedPermanent
                ? "نهائياً"
                : `حتى ${new Date(discipline.bannedUntil ?? 0).toLocaleString("ar-EG")}`}
            </p>
            {discipline.banReason && (
              <p className="mt-1 text-xs text-rose-700/80">السبب: {discipline.banReason}</p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              لا يمكنك إنشاء أو الانضمام إلى الجولات حتى انتهاء الحظر. إذا كنت تعتقد أن
              العقوبة خاطئة، راسل الإدارة عبر البريد الإلكتروني.
            </p>
          </div>
        )}
        {discipline && muted && (
          <div className="mb-8 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-orange-700">
              <ShieldCheck className="size-4" />
              أنت مكتوم حتى{" "}
              {new Date(discipline.mutedUntil ?? 0).toLocaleString("ar-EG")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              تم تقييد تواصلك بسبب مخالفة قوانين اللعب. يمكنك اللعب بشكل طبيعي.
            </p>
          </div>
        )}
        {discipline && discipline.warnings > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-700">
              <ShieldCheck className="size-4" />
              لديك {discipline.warnings} تحذير رسمي
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              الالتزام بقوانين اللعب يمنع تصاعد العقوبات. اطّلع على{" "}
              <a href="/rules" className="font-bold text-primary underline underline-offset-2">
                قوانين اللعب
              </a>
              .
            </p>
          </div>
        )}

        {/* ── Hero + player card ───────────────────────────────── */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-5 gap-1.5 rounded-full px-3.5 py-1.5 text-primary">
                <Sparkles className="size-3.5" />
                ساحة الانطلاق
              </Badge>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-4xl font-bold leading-[1.2] tracking-tight sm:text-5xl"
            >
              أين يذهب لقب
              <br />
              <span className="text-primary">الحرب العقول الليلة؟</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              أنشئ غرفة في ثانية، شارك الرمز مع أصدقائك، ودع الأسئلة السريعة
              تحسم من هو الأسرع والأذكى في المجموعة.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-xl px-7 text-base"
                onClick={handleCreate}
                disabled={creating || banned}
              >
                {creating ? (
                  <Loader2 className="size-4.5 animate-spin" />
                ) : (
                  <Gamepad2 className="size-4.5" />
                )}
                أنشئ غرفة فورية
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 rounded-xl px-7 text-base"
                onClick={() => joinRef.current?.focus()}
              >
                <Link2 className="size-4.5" />
                انضم برمز
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 rounded-xl px-7 text-base bg-gradient-to-l from-primary/10 to-amber-500/10"
                onClick={async () => {
                  try {
                    const smartMatch = (await import("@/convex/_generated/api")).api.games.smartMatch;
                    // Will use smart match mutation
                    toast.info("🔍 جاري البحث عن منافس مناسب...");
                  } catch {
                    toast.error("خطأ في المطابقة الذكية");
                  }
                }}
              >
                <Swords className="size-4.5" />
                مطابقة ذكية
              </Button>
            </motion.div>

            {/* مدة الجولة — حددها قبل إنشاء الغرفة */}
            <motion.div
              variants={fadeUp}
              className="mt-6 rounded-2xl border border-primary/15 bg-card/70 p-4 shadow-sm backdrop-blur-sm"
            >
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Timer className="size-3.5 text-primary" />
                مدة الجولة
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={creating || banned}
                  onClick={() => setRoundDuration(DURATION_MODE_OFF)}
                  className={cn(
                    "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all",
                    roundDuration === DURATION_MODE_OFF
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  كلاسيك (عدد الأسئلة)
                </button>
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    disabled={creating || banned}
                    onClick={() => setRoundDuration(minutes)}
                    className={cn(
                      "flex items-center gap-1 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all",
                      roundDuration === minutes
                        ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                        : "border-amber-500/40 bg-amber-500/5 text-amber-700 hover:border-amber-500/70 hover:text-amber-600",
                    )}
                    title="مباراة بالوقت — تنتهي بانتهاء المدة مهما كان عدد الأسئلة"
                  >
                    <span className="text-[11px] leading-none">⏱</span>
                    {formatDurationLabel(minutes)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {roundDuration === DURATION_MODE_OFF
                  ? "«كلاسيك»: تنتهي الجولة بعد عدد الأسئلة المحدد (5 افتراضياً)."
                  : `مباراة بالوقت — ${formatDurationLabel(
                      roundDuration,
                    )}: تنساب الأسئلة تلقائياً وتنتهي المباراة بانتهاء المدة، وكلما كانت إجاباتك أسرع زاد عدد الأسئلة.`}
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                1 – 12 لاعباً
              </span>
              <span className="flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                حتى 380 نقطة للسؤال
              </span>
              <span className="flex items-center gap-2">
                <Flame className="size-4 text-primary" />
                سلاسل ومكافآت
              </span>
            </motion.div>
          </motion.div>

          {/* Player card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-primary/10 via-transparent to-amber-400/10 blur-2xl"
            />
            <div className="relative rounded-3xl border border-border/80 bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">بطاقة اللاعب</p>
                <Badge variant="outline" className="gap-1.5 rounded-full text-primary">
                  <Sparkles className="size-3" />
                  {profile && profile.gamesPlayed > 0 ? "منافس جاهز" : "جاهز للانطلاق"}
                </Badge>
              </div>

              {profile ? (
                <div className="mt-5 flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-2xl font-bold text-primary">
                    {profile.level}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{displayName || "ضيف"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      المستوى {profile.level} — {profile.levelTitle}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <Progress
                        value={(profile.xpIntoLevel / Math.max(1, profile.xpForNextLevel)) * 100}
                        className="h-1.5 flex-1"
                      />
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {profile.xp.toLocaleString("ar")} XP
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-2xl font-bold text-primary">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{displayName || "ضيف"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">مستوى 1 — مبتدئ</p>
                  </div>
                </div>
              )}

              {/* Daily Challenge Card - AI Powered */}
              <div className="mt-4 rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <p className="text-sm font-bold">تحدي اليوم</p>
                  <Badge className="ml-auto gap-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px]">
                    <Flame className="size-2.5" />
                    +50 XP
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  سؤال واحد فقط — أسرع إجابة صحيحة تكسب مكافأة إضافية!
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2.5 gap-1.5 rounded-xl"
                  onClick={handleDailyChallenge}
                  disabled={dailyChallengeLoading}
                >
                  {dailyChallengeLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Zap className="size-3" />
                  )}
                  العب بالـ AI
                </Button>
              </div>

              {/* Mini-Games Quick Access */}
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎮</span>
                  <p className="text-sm font-bold">80 لعبة مصغرة</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  حرب العقول + سرعة + استراتيجية — اختر لعبتك المفضلة
                </p>
                <Button asChild size="sm" variant="ghost" className="mt-2 gap-1.5 rounded-xl text-primary">
                  <Link to="/games">
                    <Gamepad2 className="size-3" />
                    افتح مركز الألعاب
                  </Link>
                </Button>
              </div>

              {/* Chat Rooms Quick Access */}
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <p className="text-sm font-bold">غرف الدردشة</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  تفاعل مع المجتمع — دردشة مباشرة مع اللاعبين
                </p>
                <Button asChild size="sm" variant="ghost" className="mt-2 gap-1.5 rounded-xl text-emerald-600">
                  <Link to="/rooms">
                    <MessageSquare className="size-3" />
                    افتح الغرف
                  </Link>
                </Button>
              </div>



              {/* AI Analysis Display */}
              {aiAnalysis && (
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-bold text-primary">🤖 تحليل AI:</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{aiAnalysis}</p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="group rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Trophy className="mx-auto size-4 text-amber-600" />
                  <p className="mt-1 text-sm font-bold tabular-nums">{profile?.gamesWon ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">فوز</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="group rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Flame className="mx-auto size-4 text-orange-500" />
                  <p className="mt-1 text-sm font-bold tabular-nums">{profile?.bestStreak ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">أفضل سلسلة</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="group rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Medal className="mx-auto size-4 text-primary" />
                  <p className="mt-1 text-sm font-bold tabular-nums">{profile?.badges.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">شارات</p>
                </button>
              </div>

              {profile && profile.gamesPlayed > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-primary/5 px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  عرض الملف الكامل وسجل الجولات
                  <ArrowLeft className="size-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </section>

        {/* ── Launch deck (nickname + create/join) ─────────────── */}
        <section className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">ساحة الانطلاق</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                جهّز اسمك وادخل الحلبة
              </h2>
            </div>
            <Badge variant="outline" className="hidden rounded-full sm:inline-flex">
              نفس الأسئلة · نفس الوقت · أسرع عقل يفوز
            </Badge>
          </div>

          <div className="mt-8 grid items-start gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Nickname */}
            <div className="rounded-3xl border border-border/80 bg-card p-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Crown className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">اسمك في التحدي</p>
                  <p className="text-xs text-muted-foreground">
                    سيظهر لأصدقائك في الترتيب المباشر
                  </p>
                </div>
              </div>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => persistNickname(e.target.value)}
                onBlur={(e) => syncAccountName(e.target.value)}
                maxLength={24}
                placeholder="مثال: الصقر الجريء"
                className="mt-4 h-11 rounded-xl bg-background text-base"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                اسم لائق إلزامي — الأسماء المسيئة تُعاقَب تلقائياً حسب قوانين اللعب.
              </p>
            </div>

            {/* Create / Join */}
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Create */}
              <div className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card p-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-16 -start-16 size-44 rounded-full bg-primary/10 blur-2xl"
                />
                <div className="relative">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Gamepad2 className="size-5.5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">أنشئ تحدياً جديداً</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    رمز خاص لغرفتك خلال ثانية. شاركه مع أصدقائك وابدأ أول سؤال
                    فور أن يكون الجميع جاهزاً.
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-4 text-primary" />
                    1 – 12 لاعباً في الغرفة
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="mt-4 w-full gap-2 rounded-xl"
                    onClick={handleCreate}
                    disabled={creating || banned}
                  >
                    {creating ? (
                      <Loader2 className="size-4.5 animate-spin" />
                    ) : (
                      <Gamepad2 className="size-4.5" />
                    )}
                    إنشاء الغرفة
                  </Button>
                </div>
              </div>

              {/* Join */}
              <form
                onSubmit={handleJoin}
                className="flex flex-col rounded-3xl border border-border/80 bg-card p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <KeyRound className="size-5.5" />
                </span>
                <h3 className="mt-4 text-lg font-bold">انضم برمز</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  وصلك رمز من صديق؟ أدخله هنا وادخل الغرفة فوراً قبل أن يبدأ
                  التحدي.
                </p>
                <Input
                  ref={joinRef}
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
                    )
                  }
                  placeholder="K7P2MX"
                  maxLength={6}
                  className="mt-4 h-12 rounded-xl bg-background text-center text-lg font-bold tracking-[0.3em]"
                  aria-label="رمز التحدي"
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="secondary"
                  className="mt-4 w-full gap-2 rounded-xl"
                  disabled={joining || banned}
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
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Gamepad2,
              title: "أنشئ الغرفة",
              text: "اختر اسمك واضغط «إنشاء» — يصلك رمز من 6 أحرف فوراً.",
            },
            {
              icon: Link2,
              title: "شارك الرمز",
              text: "أرسله لأصدقائك أو انسخ رابط الدعوة المباشر في مجموعة الواتساب.",
            },
            {
              icon: Swords,
              title: "تنافسوا على القمة",
              text: "الترتيب يتحدث لحظياً — والسلاسل والمنقّي يقلبان الطاولة في اللحظات الأخيرة.",
            },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border border-border/80 bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </span>
                <span className="text-4xl font-bold text-border/70">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </section>

        {/* ── Elite leaderboard ────────────────────────────────── */}
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">نخبة العقول</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                متصدرو التحدي على المنصة
              </h2>
            </div>
            <Badge variant="outline" className="hidden rounded-full sm:inline-flex">
              تُحدَّث فور انتهاء كل جولة
            </Badge>
          </div>

          {topPlayers === undefined ? (
            <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              جارٍ جمع أرقام النخبة…
            </div>
          ) : topPlayers.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border/80 bg-card/60 p-10 text-center">
              <Trophy className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                لا متصدرين بعد — أول جولة ستكتب الاسم الأول هنا!
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {topPlayers.map((player, i) => (
                <motion.div
                  key={`${player.name}-${i}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm",
                    i === 0 ? "border-amber-400/40 bg-amber-400/5" : "border-border/80",
                  )}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-bold text-foreground">
                      {player.name}
                      {i === 0 && <Crown className="size-4 shrink-0 text-amber-500" />}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      المستوى {player.level} — {player.levelTitle}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-base font-bold tabular-nums text-foreground">
                      {player.xp.toLocaleString("ar")} XP
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {player.gamesWon} فوز · {player.badgeCount} شارة
                    </p>
                  </div>
                  <ReportButton targetUserId={player.userId} targetName={player.name} />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Membership & Gifts ──────────────────────────────── */}
        <section className="mt-12 space-y-8">
          <div className="rounded-3xl border border-border/50 bg-card p-6">
            <MembershipShowcase />
          </div>
          <div className="rounded-3xl border border-border/50 bg-card p-6">
            <GiftsPanel />
          </div>
        </section>

        {/* ── 5 Game Modes ────────────────────────────────────── */}          <section className="mt-14">
          <GameModes />
        </section>

        {/* ── Hub / Mini-Games ─────────────────────────────────── */}
        <section className="mt-14">
          <div className="rounded-3xl border border-primary/25 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">مركز الألعاب</p>
                <h2 className="text-2xl font-bold tracking-tight">
                  80 لعبة مصغرة — حدة ذكاء بكل فئة
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  الذاكرة · السرعة · الكلمات · المنطق · الأرقام · الإدراك · التحدي · الخبير
                </p>
              </div>
              <Button asChild size="lg" className="rounded-xl bg-gradient-to-l from-primary to-primary/90 shadow-sm">
                <Link to="/games">
                  <Gamepad2 className="size-4.5" />
                  افتح المركز كل_async
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Time-based Challenges ── */}
        <TimeChallenges />

        {/* ── 1v1 Duels ── */}
        <DuelsSection />

        {/* ── AI Coach Analysis ── */}
        <AiCoachSection />

        {/* ── Daily Streak ── */}
        <DailyStreakSection />

        {/* ── Leaderboard ── */}
        <LeaderboardSection />

        {/* ── Achievements ── */}
        <AchievementsSection />

        {/* ── Laws reminder ────────────────────────────────────── */}
        <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/80 bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Scale className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">اللعب النزيه إلزامي</p>
              <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
                مغادرة نافذة اللعب أثناء الأسئلة تُعتبر غشاً وتُعاقَب تلقائياً
                (تحذير ← خصم نقاط ← حظر). الإساءة والأسماء غير اللائقة تُعاقب
                أيضاً بواسطة الرقيب الآلي.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-1.5 rounded-xl">
            <a href="/rules">
              <Scale className="size-4" />
              القوانين كاملة
            </a>
          </Button>
        </section>

        {/* ── 50 Features Showcase ────────────────────────────── */}
        <section className="mt-12">
          <div className="rounded-3xl border border-border/50 bg-card p-6">
            <FeaturesShowcase />
          </div>
        </section>

        {/* ── Store ────────────────────────────────────────────── */}
        <section className="mt-12">
          <div className="rounded-3xl border border-border/50 bg-card p-6">
            <StorePage />
          </div>
        </section>

        {/* ── In-game app download ────────────────────────────── */}
        <section className="mt-12">
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card p-6 sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -end-16 size-44 rounded-full bg-primary/10 blur-2xl"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Smartphone className="size-6" />
                </span>
                <div className="max-w-md">
                  <p className="text-lg font-bold">نزّل حرب العقول على هاتفك</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    نسخة أندرويد أصلية (APK) بنفس حسابك وأصدقائك، مع تحديثات
                    تلقائية تصلك داخل التطبيق. أو ثبّت نسخة الويب من المتصفح
                    بلا ملفات.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    الإصدار الحالي: {appInfo?.version ?? "1.0.0"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  className="gap-2 rounded-xl"
                  onClick={handleDownloadApk}
                  disabled={downloadingApk}
                >
                  {downloadingApk ? (
                    <Loader2 className="size-4.5 animate-spin" />
                  ) : (
                    <Download className="size-4.5" />
                  )}
                  {downloadingApk ? "جارٍ تجهيز الملف…" : "تنزيل APK الآن"}
                </Button>
                <Button size="lg" variant="outline" className="gap-2 rounded-xl" asChild>
                  <Link to="/download">
                    <Smartphone className="size-4.5" />
                    صفحة التحميل
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer note ──────────────────────────────────────── */}
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Copy className="size-3.5 text-primary" />
          كل جولة تمنح خبرة (XP) تُضاف إلى مستواك وشاراتك — جولة كاملة في دقيقتين.
        </div>
      </main>

      {/* ── Owner Login Dialog ─────────────────────────────── */}
      <OwnerLoginDialog open={showOwnerLogin} onOpenChange={setShowOwnerLogin} />
    </div>
  );
}

// ── Time-based Challenges Component ───────────────────────────
function TimeChallenges() {
  const timeChallenges = useQuery(api.premiumFeatures.getTimeChallenges);

  if (!timeChallenges || timeChallenges.length === 0) return null;

  const activeChallenges = timeChallenges.filter((c: any) => c.active);
  if (activeChallenges.length === 0) return null;

  const TIME_ICONS: Record<string, React.ReactNode> = {
    morning_rush: <Coffee className="size-5 text-amber-500" />,
    afternoon_blitz: <Zap className="size-5 text-orange-500" />,
    night_master: <Moon className="size-5 text-indigo-500" />,
    weekend_warrior: <Star className="size-5 text-purple-500" />,
  };

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="size-5 text-amber-500" />
          <h2 className="text-lg font-bold">⚡ تحديات حسب الوقت</h2>
          <Badge variant="outline" className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 border-amber-500/30">
            نشطة الآن
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {activeChallenges.map((c: any) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-card/80 p-4 hover:shadow-md transition-all"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                {TIME_ICONS[c.id] || <Timer className="size-5 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold">{c.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[9px] rounded-full">
                    {c.questionCount} أسئلة
                  </Badge>
                  <Badge variant="outline" className="text-[9px] rounded-full bg-green-500/10 text-green-600 border-green-500/30">
                    ×{c.bonusMultiplier} مكافأة
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">{c.timeWindow}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── AI Coach Section ──────────────────────────────────────────
function AiCoachSection() {
  const analysis = useQuery(api.aiCoach.analyzePerformance);
  if (!analysis || analysis.totalGames === 0) return null;

  const trendIcon = analysis.weeklyTrend === "improving" ? "📈" : analysis.weeklyTrend === "declining" ? "📉" : "➡️";
  const trendText = analysis.weeklyTrend === "improving" ? "متحسن" : analysis.weeklyTrend === "declining" ? "متراجع" : "مستقر";
  const trendColor = analysis.weeklyTrend === "improving" ? "text-green-600" : analysis.weeklyTrend === "declining" ? "text-red-500" : "text-muted-foreground";

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🤖</span>
          <h2 className="text-lg font-bold">تحليل AI الشخصي</h2>
          <Badge variant="outline" className={`text-[10px] rounded-full ${trendColor} border-current/30`}>
            {trendIcon} {trendText}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "نسبة الفوز", value: `${analysis.winRate}%`, color: analysis.winRate >= 60 ? "text-green-600" : "text-amber-600" },
            { label: "متوسط النقاط", value: analysis.avgScore, color: "text-primary" },
            { label: "أفضل سلسلة", value: analysis.bestStreak, color: "text-orange-500" },
            { label: "إجمالي الألعاب", value: analysis.totalGames, color: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-card/80 p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid gap-3 sm:grid-cols-2">
          {analysis.strengths.length > 0 && (
            <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3">
              <p className="text-xs font-bold text-green-600 mb-1.5">💪 نقاط القوة</p>
              <div className="space-y-1">
                {analysis.strengths.map((s, i) => (
                  <p key={i} className="text-[11px] text-green-700">• {s}</p>
                ))}
              </div>
            </div>
          )}
          {analysis.weaknesses.length > 0 && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs font-bold text-amber-600 mb-1.5">🎯 نقاط التحسين</p>
              <div className="space-y-1">
                {analysis.weaknesses.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700">• {w}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Suggestions + Goal */}
        <div className="mt-3 rounded-xl bg-card/80 p-3">
          <p className="text-xs font-bold text-primary mb-1.5">💡 اقتراحات ذكية</p>
          <div className="space-y-1">
            {analysis.suggestions.map((s, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">• {s}</p>
            ))}
          </div>
          {analysis.nextGoal && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
              <span>🎯</span> {analysis.nextGoal}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Notifications Bell ──────────────────────────────────────
/** Color-coded notification bell — colors indicate severity/type */
function NotificationsBell() {
  const notifications = useQuery(api.playerControl.getMyNotifications);
  const markRead = useMutation(api.playerControl.markNotificationRead);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications?.filter((n: any) => !n.read).length ?? 0;

  // 🔔 جسر إشعارات المتصفح: أظهر إشعاراً أصلياً لكل إشعار جديد غير مقروء
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  useEffect(() => {
    if (!notifications) return;
    if (!primedRef.current) {
      // أول تحميل: علّم الموجود كـ«مُشاهد» دون إزعاج
      for (const n of notifications) seenRef.current.add(String(n._id));
      primedRef.current = true;
      return;
    }
    for (const n of notifications) {
      const id = String(n._id);
      if (seenRef.current.has(id) || n.read) continue;
      seenRef.current.add(id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const notif = new Notification(n.title, { body: n.body, tag: id });
          notif.onclick = () => {
            window.focus();
            if (n.actionUrl) navigate(n.actionUrl);
            notif.close();
          };
        } catch {
          /* بعض المتصفحات تمنع ذلك خارج SW */
        }
      }
    }
  }, [notifications, navigate]);

  // اطلب الإذن مرة واحدة عند التركيز الأول
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const handler = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("pointerdown", handler);
      };
      window.addEventListener("pointerdown", handler, { once: true });
    }
  }, []);

  // Color mapping: green=info, blue=system/update, orange=warning, red=ban, purple=needs review
  const TYPE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; border: string }> = {
    info:    { icon: "ℹ️", color: "text-emerald-600", bgColor: "bg-emerald-500", border: "border-l-emerald-400" },
    warning: { icon: "⚠️", color: "text-orange-600", bgColor: "bg-orange-500", border: "border-l-orange-400" },
    ban:     { icon: "🚫", color: "text-red-600", bgColor: "bg-red-500", border: "border-l-red-500" },
    update:  { icon: "📢", color: "text-blue-600", bgColor: "bg-blue-500", border: "border-l-blue-400" },
    system:  { icon: "⚙️", color: "text-violet-600", bgColor: "bg-violet-500", border: "border-l-violet-400" },
  };

  // Determine dominant badge color based on highest-severity unread
  const getBadgeColor = () => {
    const unread = notifications?.filter((n: any) => !n.read) ?? [];
    if (unread.some((n: any) => n.type === "ban")) return "bg-red-500";
    if (unread.some((n: any) => n.type === "warning")) return "bg-orange-500";
    if (unread.some((n: any) => n.type === "update")) return "bg-blue-500";
    if (unread.some((n: any) => n.type === "system")) return "bg-violet-500";
    return "bg-emerald-500";
  };

  const handleMarkAllRead = async () => {
    const unread = notifications?.filter((n: any) => !n.read) ?? [];
    for (const n of unread) {
      await markRead({ notificationId: n._id });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex size-9 items-center justify-center rounded-xl hover:bg-muted transition-all active:scale-95"
      >
        <span className={`text-sm ${unreadCount > 0 ? getBadgeColor().replace('bg-', 'text-') : ''}`}>🔔</span>
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -left-0.5 flex min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-lg ${getBadgeColor()}`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border bg-card shadow-2xl" dir="rtl">
            {/* Header */}
            <div className="sticky top-0 border-b bg-card px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">🔔 الإشعارات</span>
                {unreadCount > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${getBadgeColor()}`}>{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    ✅ قراءة الكل
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">✕</button>
              </div>
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-3 border-b px-4 py-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={`size-1.5 rounded-full ${cfg.bgColor}`} />
                  <span className="text-[9px] text-muted-foreground">{cfg.icon}</span>
                </div>
              ))}
            </div>

            {/* Notifications list */}
            <div className="overflow-y-auto max-h-72">
              {!notifications || notifications.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">لا توجد إشعارات</p>
              ) : (
                notifications.slice(0, 20).map((n: any) => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => { if (!n.read) markRead({ notificationId: n._id }); }}
                      className={`w-full text-right flex items-start gap-2.5 border-b border-border/20 border-r-2 ${cfg.border} px-4 py-2.5 transition-colors ${n.read ? "opacity-50" : "bg-muted/10 hover:bg-muted/30"}`}
                    >
                      <span className="text-sm mt-0.5 shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{n.title}</p>
                          {!n.read && <span className={`size-1.5 rounded-full shrink-0 ${cfg.bgColor}`} />}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{new Date(n.createdAt).toLocaleDateString("ar", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 1v1 Duels Section ──────────────────────────────────────
function DuelsSection() {
  const availableDuels = useQuery(api.playerControl.getAvailableDuels);
  const navigate = useNavigate();

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-pink-500/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="size-5 text-rose-500" />
          <h2 className="text-lg font-bold">⚔️ تحديات 1v1</h2>
          <Badge variant="outline" className="text-[10px] rounded-full bg-rose-500/10 text-rose-600 border-rose-500/30">
            تحدي مباشر
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">تحدي لاعب آخر في معركة ذكاء مباشرة — 5 أسئلة، الأعلى نقاطاً يفوز!</p>
        {!availableDuels ? (
          <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">جارٍ التحميل...</div>
        ) : availableDuels.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground mb-3">لا توجد تحديات مفتوحة حالياً</p>
            <Button asChild variant="outline" className="rounded-xl gap-1.5">
              <Link to="/games">
                <Swords className="size-3.5" />
                ابدأ تحدياً جديداً
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {availableDuels.slice(0, 3).map((duel: any) => (
              <div key={duel._id} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-card/80 p-3 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/10 text-sm">
                    🎮
                  </div>
                  <div>
                    <p className="text-xs font-bold">{duel.challengerName}</p>
                    <p className="text-[10px] text-muted-foreground"> challenged you!</p>
                  </div>
                </div>
                <Button size="sm" className="rounded-xl gap-1 bg-rose-500 hover:bg-rose-600 text-white">
                  <Swords className="size-3" /> قبول
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Daily Streak & Rewards ─────────────────────────────────
function DailyStreakSection() {
  const profile = useQuery(api.stats.getMyProfile);
  const claimDaily = useMutation(api.profile.claimDailyReward);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  if (!profile) return null;

  const streak = profile.dailyStreak ?? 0;
  const alreadyClaimed = !profile.canClaimDaily;

  const handleClaim = async () => {
    if (alreadyClaimed || claiming) return;
    setClaiming(true);
    try {
      await claimDaily();
      setClaimed(true);
      Sound.victory();
      toast.success("تم استلام المكافأة اليومية!");
    } catch (err: any) {
      toast.error(err.message || "فشل الاستلام");
    } finally {
      setClaiming(false);
    }
  };

  const streakDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayOfWeek = new Date().getDay();

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <h2 className="text-lg font-bold">السلسلة اليومية</h2>
            {streak > 0 && (
              <Badge variant="outline" className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 border-amber-500/30">
                {streak} يوم متتالي
              </Badge>
            )}
          </div>
        </div>
        {/* Week view */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {streakDays.map((day, i) => {
            const isActive = i <= dayOfWeek;
            const isToday = i === dayOfWeek;
            return (
              <div key={i} className={`text-center rounded-xl p-2 transition-all ${isToday ? "bg-primary text-primary-foreground shadow-md" : isActive ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
                <p className="text-[9px] font-medium">{day}</p>
                <p className="text-lg mt-0.5">{isActive ? "✅" : "⬜"}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {alreadyClaimed ? "✅ تم استلام مكافأة اليوم" : "ادة مكافأتك اليومية"}
          </p>
          <Button
            onClick={handleClaim}
            disabled={alreadyClaimed || claiming || claimed}
            className={`rounded-xl gap-1.5 ${alreadyClaimed || claimed ? "bg-green-500/20 text-green-600" : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"}`}
          >
            {alreadyClaimed || claimed ? "✅ تم" : claiming ? "جارٍ..." : "🎁 استلام المكافأة"}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Leaderboard / Hall of Fame ──────────────────────────────
function LeaderboardSection() {
  const topPlayers = useQuery(api.stats.getTopPlayers, { limit: 10 });
  const [showAll, setShowAll] = useState(false);

  if (!topPlayers || topPlayers.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];
  const displayPlayers = showAll ? topPlayers : topPlayers.slice(0, 5);

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-amber-500/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h2 className="text-lg font-bold">لوحة الشرف</h2>
          </div>
          {topPlayers.length > 5 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAll(!showAll)}>
              {showAll ? "عرض أقل" : "عرض الكل"}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {displayPlayers.map((player: any, i: number) => (
            <div
              key={player.userId}
              className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                i < 3
                  ? player.frame === "frame_gold"
                    ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-2 border-amber-400/70"
                    : player.frame === "frame_neon"
                      ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/10 border-2 border-violet-400/70"
                      : "bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/20"
                  : "bg-muted/30"
              }`}
            >
              <span className="text-xl w-8 text-center">{medals[i] || `#${i + 1}`}</span>
              <div className="flex-1 min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                  <span className="truncate">{player.name}</span>
                  {player.title && (
                    <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-600">
                      {player.title.emoji} {player.title.name}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">{player.gamesPlayed} لعبة • {player.gamesWon} فوز</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary tabular-nums">{player.xp.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">XP</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACHIEVEMENTS SECTION
// ═══════════════════════════════════════════════════════════════

function AchievementsSection() {
  const achievements = useQuery(api.seasons.getPlayerAchievements);
  // Defensive: return null if loading, empty, or not an array
  if (!achievements || !Array.isArray(achievements) || achievements.length === 0) return null;

  try {
    const earnedCount = achievements.filter((a: any) => a?.earned).length;
    const totalCount = achievements.length;
    const progress = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  return (
    <section className="mt-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏅</span>
          <h3 className="text-lg font-bold">الإنجازات</h3>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {earnedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-yellow-400 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {achievements.map((a: any) => (
          <div
            key={a.id}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
              a.earned
                ? "border-yellow-400/40 bg-yellow-500/5 shadow-md shadow-yellow-500/10"
                : "border-border/50 bg-card/50 opacity-50 grayscale"
            }`}
          >
            <span className="text-3xl">{a.icon}</span>
            <p className="text-xs font-bold leading-tight">{a.name}</p>
            <p className="text-[10px] leading-snug text-muted-foreground">{a.desc}</p>
            {a.earned && (
              <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] text-black">
                ✓
              </span>
            )}
            <span className="text-[10px] font-bold text-primary">+{a.xpReward} XP</span>
          </div>
        ))}
      </div>
    </section>
  );
  } catch {
    return null;
  }
}
