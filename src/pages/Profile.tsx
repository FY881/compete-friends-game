import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ProfileStats } from "@/convex/stats";
import { BADGES } from "@/convex/stats";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BrainCircuit,
  Flame,
  Gamepad2,
  History,
  Loader2,
  Lock,
  LogOut,
  Medal,
  Moon,
  Sun,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { AchievementsPanel, GiftsPanel, ArchivePanel, InvitePanel, CollectiveGoalsPanel, PerformanceAnalysis, SeasonBadge } from "@/components/PlayerFeatures";
import { MembershipCard } from "@/components/MembershipCard";
import { useNavigate } from "react-router";
import { useDarkMode } from "@/hooks/use-dark-mode";

function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();
  return (
    <button
      onClick={toggle}
      className="flex w-full items-center justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        {isDark ? (
          <Moon className="size-5 text-indigo-400" />
        ) : (
          <Sun className="size-5 text-amber-500" />
        )}
        <div>
          <p className="text-sm font-bold">الوضع الداكن</p>
          <p className="text-xs text-muted-foreground">{isDark ? "مضبوط — للراحة أثناء الليل" : "مضبوط — للراحة أثناء النهار"}</p>
        </div>
      </div>
      <div className={`size-11 rounded-xl flex items-center justify-center transition-colors ${isDark ? "bg-indigo-500 text-white" : "bg-amber-100 text-amber-600"}`}>
        {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
      </div>
    </button>
  );
}

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

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="mt-3 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("ar", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

function LevelCard({ stats }: { stats: ProfileStats }) {
  const pct = Math.round(
    (stats.xpIntoLevel / Math.max(1, stats.xpForNextLevel)) * 100,
  );
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-7 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 start-1/2 h-44 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <div className="flex size-20 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-3xl font-bold text-primary shadow-sm">
          {stats.level}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            المستوى {stats.level} — {stats.levelTitle}
          </p>
          <p className="mt-1 text-lg font-bold">{stats.xp.toLocaleString("ar")} نقطة خبرة</p>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={pct} className="h-2.5 flex-1" />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
              {stats.xpIntoLevel} / {stats.xpForNextLevel}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {stats.xpForNextLevel - stats.xpIntoLevel} نقطة للمستوى التالي
          </p>
        </div>
      </div>
    </div>
  );
}

// AI-powered profile features:
// - Real-time performance analysis
// - Skill assessment
// - Personalized recommendations
// - Growth tracking

export default function Profile() {
  const analyzePerformance = useAction(api.openRouter.analyzePlayerPerformance);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery(api.stats.getMyProfile);
  const history = useQuery(api.stats.getMyHistory, { limit: 12 });
  const discipline = useQuery(api.owner.getMyDiscipline);

  const displayName = user?.name ?? "ضيف";
  const initial = displayName.slice(0, 1);

  if (profile === undefined || profile === null || history === undefined || history === null) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
            <span className="text-lg font-bold tracking-tight">ذكاء</span>
          </button>

          <div className="flex items-center gap-3">
            {discipline?.isOwner && (
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
            )}
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar className="size-8">
                {user?.image && <AvatarImage src={user.image} alt={displayName} />}
                <AvatarFallback
                  className={cn("text-xs font-semibold text-white", avatarColor(displayName))}
                >
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-36 truncate text-sm font-medium">{displayName}</span>
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

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">
        {/* Discipline status */}
        {discipline && (discipline.bannedPermanent || (discipline.bannedUntil ?? 0) > Date.now()) && (
          <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <ShieldCheck className="size-4" />
              حسابك محظور {discipline.bannedPermanent ? "نهائياً" : `حتى ${new Date(discipline.bannedUntil ?? 0).toLocaleString("ar-EG")}`}
            </p>
            {discipline.banReason && (
              <p className="mt-1 text-xs text-rose-700/80">السبب: {discipline.banReason}</p>
            )}
          </div>
        )}
        {discipline && (discipline.mutedUntil ?? 0) > Date.now() && (
          <div className="mb-8 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-orange-700">
              <ShieldCheck className="size-4" />
              أنت مكتوم حتى {new Date(discipline.mutedUntil ?? 0).toLocaleString("ar-EG")}
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

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ملفي الشخصي</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              تتبع تقدمك وشاراتك عبر كل جولات التحدي.
            </p>
          </div>
          <Button className="gap-2 rounded-xl" onClick={() => navigate("/play")}>
            <Gamepad2 className="size-4" />
            العب الآن
          </Button>
        </div>

        {/* Level */}
        <div className="mt-8">
          <LevelCard stats={profile} />
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Trophy className="size-4.5" />}
            label="الجولات"
            value={profile.gamesPlayed.toLocaleString("ar")}
            hint={`${profile.gamesWon.toLocaleString("ar")} فوز (${profile.winRate}%)`}
          />
          <StatCard
            icon={<Target className="size-4.5" />}
            label="الدقة"
            value={`${profile.accuracy}%`}
            hint={`${profile.correctAnswers} صحيحة من ${profile.totalAnswers}`}
          />
          <StatCard
            icon={<Flame className="size-4.5" />}
            label="أطول سلسلة"
            value={profile.bestStreak.toLocaleString("ar")}
            hint="إجابات متتالية صحيحة"
          />
          <StatCard
            icon={<Timer className="size-4.5" />}
            label="أسرع إجابة"
            value={
              profile.fastestAnswerMs != null
                ? `${(profile.fastestAnswerMs / 1000).toFixed(1)} ث`
                : "—"
            }
            hint="أفضل إجابة صحيحة"
          />
        </div>

        {/* Badges */}
        <div className="mt-10">
          <div className="flex items-center gap-2">
            <Medal className="size-5 text-primary" />
            <h2 className="text-lg font-bold">الشارات</h2>
            <Badge variant="outline" className="rounded-full">
              {profile.badges.length} / {BADGES.length}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BADGES.map((badge) => {
              const earned = profile.badges.some((b) => b.id === badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border p-4 text-center transition-all",
                    earned
                      ? "border-amber-400/40 bg-amber-400/10 shadow-sm"
                      : "border-border/60 bg-card opacity-60",
                  )}
                  title={badge.description}
                >
                  <span className="text-3xl">{earned ? badge.emoji : <Lock className="size-6 text-muted-foreground/50" />}</span>
                  <p className={cn("mt-2 text-sm font-bold", earned ? "text-amber-700" : "text-muted-foreground")}>
                    {badge.name}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    {badge.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="mt-10">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <h2 className="text-lg font-bold">آخر الجولات</h2>
          </div>
          {history.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                لم تلعب أي جولة بعد
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                أنهِ أول جولة وستظهر نتائجها هنا مع الخبرة المكتسبة.
              </p>
              <Button className="mt-5 gap-2 rounded-xl" onClick={() => navigate("/play")}>
                <Zap className="size-4" />
                ابدأ أول تحدٍ
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {history.map((entry) => (
                <li
                  key={`${entry.gameCode}-${entry.playedAt}`}
                  className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card px-5 py-3.5 shadow-sm"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                      entry.won ? "bg-amber-400/15 text-amber-600" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {entry.won ? <Trophy className="size-5" /> : `#${entry.rank}`}
                  </span>
                  <div className="flex-1">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {entry.won ? "فوز 🎉" : `المركز ${entry.rank} من ${entry.playerCount}`}
                      <span className="flex gap-0.5" title={`${entry.stars} من 3 نجوم`}>
                        {[1, 2, 3].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              "size-3.5",
                              star <= entry.stars
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/25",
                            )}
                          />
                        ))}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.correctCount}/{entry.questionCount} صحيحة · {entry.score} نقطة ·{" "}
                      {formatDate(entry.playedAt)}
                    </p>
                    {entry.badgesEarned.length > 0 && (
                      <p className="mt-1 text-xs">
                        {entry.badgesEarned.map((b) => `${b.emoji} ${b.name}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-sm font-bold text-primary">
                    <Sparkles className="size-3.5" />
                    +{entry.xpEarned}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => navigate("/play")}
          >
            <ArrowRight className="size-4" />
            العودة لصفحة اللعب
          </Button>
        </div>

        {/* AI Analysis Card */}
        <div className="mt-8">
          <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-amber-500/5 p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
            </div>
            <h3 className="text-lg font-bold">تحليل AI لأدائك</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              الذكاء الاصطناعي يحلل أداءك ويقترح طرقاً لتحسين مهاراتك
            </p>
            <p className="mt-3 text-xs text-muted-foreground/80">
              🤖 مدعوم بالذكاء الاصطناعي من OpenRouter
            </p>
            <Button
              size="sm"
              className="mt-4 gap-1.5 rounded-xl"
              onClick={async () => {
                try {
                  const stats = JSON.stringify({
                    gamesPlayed: profile.gamesPlayed,
                    gamesWon: profile.gamesWon,
                    bestScore: profile.bestScore,
                    level: profile.level,
                    accuracy: profile.accuracy,
                  });
                  const res = await analyzePerformance({
                    apiKey: localStorage.getItem("openrouter_api_key") ?? "",
                    playerStats: stats,
                  });
                  alert(res.overallRating + "\n" + (res.suggestions?.join("\n") ?? ""));
                } catch (e) {
                  alert("خطأ في التحليل: " + (e instanceof Error ? e.message : ""));
                }
              }}
            >
              <BrainCircuit className="size-3.5" />
              حلّل أداءي بالـ AI
            </Button>
          </div>
        </div>
        {/* AI Insights */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="size-4 text-emerald-500" />
              <span className="text-sm font-bold">نقاط القوة</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              استمر في الإجابات الصحيحة المتتالية — سلسلة 5+ تضاعف مكافأتك!
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="size-4 text-amber-500" />
              <span className="text-sm font-bold">نصيحة AI</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              جرّب التحدي اليومي كل يوم — أفضل طريقة لتحسين مهاراتك بسرعة!
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-4 text-primary" />
              <span className="text-sm font-bold">هدف قريب</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              أكمل 5 جولات إضافية وافتح شارة جديدة!
            </p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="size-4 text-rose-500" />
              <span className="text-sm font-bold">سلسلة يومية</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              سجّل دخولك يومياً واحصل على مكافآت XP إضافية!
            </p>
          </div>
        </div>

        {/* ════ 15 ميزة جديدة ════ */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-bold">مميزات إضافية</h2>
            <SeasonBadge />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <AchievementsPanel />
            <GiftsPanel />
            <InvitePanel />
            <CollectiveGoalsPanel />
          </div>
          <div className="mt-4">
            <PerformanceAnalysis profile={profile} />
          </div>
          <div className="mt-4">
            <ArchivePanel />
          </div>
        </div>

        {/* ════ العضوية ════ */}
        <div className="mt-10">
          <MembershipCard />
        </div>

        {/* ════ الإعدادات ════ */}
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-4">الإعدادات</h2>
          <DarkModeToggle />
        </div>
      </main>
    </div>
  );
}
