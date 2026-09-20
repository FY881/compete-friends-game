import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { type OfflineQuestion } from "@/lib/offline-bank";
import {
  BOSS_ROUNDS,
  BOSS_TIMER,
  TOTAL_ROUNDS,
  forfeitTournament,
  markQuestionsUsed,
  prestigeLabel,
  questionsForRound,
  rivalAccuracyForRound,
  roundPrize,
  settleRound,
  startTournament,
  useTournament,
} from "@/lib/tournament";
import {
  ACHIEVEMENTS,
  AVATARS,
  BANK_SIZE,
  CATEGORIES,
  RANKS,
  buildChallengeQuestions,
  buildQuestions,
  categoryAccuracy,
  finishSession,
  isDailyDone,
  leaderboard,
  levelInfo,
  mindPower,
  myRank,
  resetAll,
  unlockedTitles,
  updateProfile,
  useLocalGame,
  withShuffledOptions,
  type AchievementDef,
  type ModeId,
} from "@/lib/localEngine";
import {
  describeEffect,
  mindEffect,
  mindIdentity,
  mindTierScore,
  readMind,
  useEvolvedMind,
  type MindSessionReport,
} from "@/lib/evolvedMind";
import { MindLabPanel } from "@/components/MindLabPanel";
import { MindCloudPanel } from "@/components/MindCloudPanel";
import { useMindSync } from "@/lib/mindSync";
import { useChallenge, type ChallengeInfo, type ChallengeSubmitOutcome } from "@/lib/challengeSync";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChallengeGateway } from "@/components/ChallengeGateway";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  CloudOff,
  Crown,
  Flame,
  Heart,
  Home,
  Play,
  RotateCcw,
  Swords,
  Target,
  Timer,
  Trophy,
  User,
  X,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ ساحة حرب العقول — الوضع المحلي الكامل (Local Arena)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * هذه الصفحة **لا تلمس الخادم إطلاقاً**: لا Convex، لا شبكة، لا حصة،
 * لا حساب. كل شيء (المحرك، بنك الأسئلة، التخزين) يعمل داخل المتصفح،
 * فتبقى اللعبة حيّة مهما تعطّل الخادم.
 *
 * الأنماط المتاحة:
 *   • تحدي سريع — ١٠ أسئلة متدرّجة تُختار تكيّفياً مع أدائك.
 *   • ماراثون الذكاء — ٢٥ سؤالاً بثلاث قلوب فقط.
 *   • التحدي اليومي — نفس الأسئلة للجميع في اليوم، ومكافأة مضاعفة.
 *   • اختيار الفئة — تمرين مركّز على ذكاء واحد بعينه.
 *   • مواجهة العقول — نزال مباشر ضد خصم ذكاء اصطناعي.
 */

type TabId = "arena" | "mind" | "board" | "profile";

const TIMER_BY_MODE: Record<ModeId, number> = {
  quick: 20,
  marathon: 16,
  daily: 22,
  category: 20,
  duel: 18,
};

const MODE_META: Record<ModeId, { title: string; desc: string; icon: ReactNode; accent: string }> = {
  quick: {
    title: "تحدي سريع",
    desc: "١٠ أسئلة تُنتقى من أضعف فئاتك — الأسرع للتقدّم",
    icon: <Zap className="size-5" />,
    accent: "bg-primary/10 text-primary",
  },
  marathon: {
    title: "ماراثون الذكاء",
    desc: "٢٥ سؤالاً وثلاث قلوب — أقصى نقاط ممكنة",
    icon: <Flame className="size-5" />,
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  daily: {
    title: "التحدي اليومي",
    desc: "نفس الأسئلة لكل اللاعبين اليوم + مكافأة ٤٠٠ نقطة",
    icon: <CalendarDays className="size-5" />,
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  category: {
    title: "اختيار الفئة",
    desc: "١٠ أسئلة مركّزة على ذكاء واحد تختاره",
    icon: <Target className="size-5" />,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  duel: {
    title: "مواجهة العقول",
    desc: "نزال مباشر ضد خصم ذكاء اصطناعي — من يعرف أكثر؟",
    icon: <Swords className="size-5" />,
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
};

const DIFFICULTY_LABEL: Record<OfflineQuestion["difficulty"], string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const DIFFICULTY_CLASS: Record<OfflineQuestion["difficulty"], string> = {
  easy: "text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400",
  medium: "text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-400",
  hard: "text-rose-700 border-rose-500/30 bg-rose-500/10 dark:text-rose-400",
};

// ═══════════════════════════════════════════════════════════════════════
// الصفحة
// ═══════════════════════════════════════════════════════════════════════

type RunRequest = {
  mode: ModeId;
  label: string;
  questions: OfflineQuestion[];
  rival?: { name: string; avatar: string; accuracy: number };
  tournament?: { round: number };
  /** ⚔️ تحدٍّ حقيقي: ثواني العدّاد من صعوبة التحدّي + كود يُحتسب بعده */
  timerOverride?: number;
  challengeCode?: string;
};

export default function Offline() {
  const save = useLocalGame();
  const tournament = useTournament();
  // 🧬 جسر العقول: كل جولة تنتهي تبني عقلك محلياً، وهذا الخطاف يرفعه
  // إلى عالم اللعبة (لوحة الصدارة + نبضة المالك) ويسحب قرارات العرش.
  useMindSync("arena");
  // ⚔️ جسر التحدّيات: /arena?challenge=CODE قادم من غرفة خاصة أو من الملتقى
  const [searchParams] = useSearchParams();
  const challengeSync = useChallenge(searchParams.get("challenge"));
  const [tab, setTab] = useState<TabId>("arena");
  const [run, setRun] = useState<RunRequest | null>(null);

  const level = levelInfo(save.stats.xp);
  const rank = myRank(save);
  const dailyDone = isDailyDone(save);

  const startMode = (mode: ModeId, category?: string) => {
    const questions = buildQuestions(mode, save, { category });
    if (questions.length === 0) {
      toast.error("لا توجد أسئلة متاحة لهذا النمط حالياً");
      return;
    }
    const label =
      mode === "category" && category ? `فئة: ${category}` : MODE_META[mode].title;

    let rival: RunRequest["rival"];
    if (mode === "duel") {
      const rivals = leaderboard(save).filter((r) => !r.isYou);
      // نختار من صفوة الخصوم فقط، وقوّة إجابته مشتقة من مكانته في اللوحة
      const idx = Math.floor(Math.random() * Math.max(1, Math.min(5, rivals.length)));
      const pick = rivals[idx];
      rival = {
        name: pick.name,
        avatar: pick.avatar,
        accuracy: Math.min(0.88, 0.55 + (rivals.length - idx) * 0.03),
      };
    }

    setRun({ mode, label, questions, rival });
  };

  /** ⚔️ يبدأ تحدّياً حقيقياً بعدد أسئلته وصعوبته المُعلنة — الأسئلة تُبنى على الصعوبة لا على العشوائية. */
  const startChallengeRun = (challenge: ChallengeInfo) => {
    const questions = buildChallengeQuestions(
      { questionCount: challenge.questionCount, difficulty: challenge.difficulty },
      save,
    );
    if (questions.length === 0) {
      toast.error("لا توجد أسئلة متاحة لهذا التحدّي حالياً");
      return;
    }
    setRun({
      mode: "quick",
      label: `⚔️ ${challenge.title} · ${challenge.code}`,
      questions: questions.slice(0, challenge.questionCount),
      timerOverride: challenge.seconds,
      challengeCode: challenge.code,
    });
  };

  /** يبدأ جولة البطولة القادمة: أسئلة جديدة + خصم القوس + خريطة الإعدادات. */
  const startTournamentRound = () => {
    let t = tournament.currentRound > 0 ? tournament : startTournament();
    if (t.currentRound === 0) t = startTournament();
    const round = t.currentRound || 1;
    const questions = questionsForRound(round, t.usedQuestionIds);
    if (questions.length === 0) {
      toast.error("لا توجد أسئلة متاحة لهذه الجولة");
      return;
    }
    markQuestionsUsed(questions);
    const rival = t.bracket[round - 1];
    setRun({
      mode: "duel",
      label: `بطولة السلطان · الجولة ${round}${rival?.isBoss ? " · ⚔️ معركة زعيم" : ""}`,
      questions,
      rival: {
        name: rival?.name ?? "خصم",
        avatar: rival?.avatar ?? "🎭",
        accuracy: rival?.accuracy ?? rivalAccuracyForRound(round),
      },
      tournament: { round },
    });
  };

  if (run) {
    return (
      <RunScreen
        key={`${run.mode}-${run.label}-${run.questions.length}`}
        request={run}
        onExit={() => setRun(null)}
        onChallengeResult={challengeSync.submitRun}
      />
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="size-9" asChild>
            <Link to="/" aria-label="العودة للصفحة الرئيسية">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">ساحة حرب العقول</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {BANK_SIZE} سؤالاً · {CATEGORIES.length} ذكاء · تعمل بلا إنترنت
            </p>
          </div>
          <Badge
            variant="outline"
            className="hidden gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 sm:flex dark:text-emerald-400"
          >
            <CloudOff className="size-3" />
            بلا خادم
          </Badge>
          <Badge variant="outline" className="gap-1 rounded-full text-[10px] tabular-nums">
            <Zap className="size-3" />
            {save.stats.coins}
          </Badge>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 px-4 pb-3 sm:px-6">
          <TabButton active={tab === "arena"} onClick={() => setTab("arena")} icon={<Play className="size-3.5" />}>
            العب
          </TabButton>
          <TabButton
            active={tab === "mind"}
            onClick={() => setTab("mind")}
            icon={<Brain className="size-3.5" />}
          >
            العقل
          </TabButton>
          <TabButton active={tab === "board"} onClick={() => setTab("board")} icon={<Trophy className="size-3.5" />}>
            التصنيف
          </TabButton>
          <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<User className="size-3.5" />}>
            الملف
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {tab === "arena" && (
          <div className="space-y-4">
            {challengeSync.code && (
              <ChallengeGateway
                challenge={challengeSync.challenge}
                loading={challengeSync.loading}
                busy={challengeSync.busy}
                outcome={challengeSync.outcome}
                onStart={startChallengeRun}
              />
            )}
          <ArenaTab
            save={save}
            level={level}
            rank={rank}
            dailyDone={dailyDone}
            onStart={startMode}
            onOpenMind={() => setTab("mind")}
            tournament={tournament}
            onTournamentRound={startTournamentRound}
            onTournamentForfeit={() => {
              forfeitTournament();                toast.info("استُلمت مكافآت الجولات المجزوزة واعتُرف بعمق وصولك");
            }}
          />
          </div>
        )}
        {tab === "mind" && (
          <div className="space-y-4">
            <MindCloudPanel />
            <MindLabPanel />
          </div>
        )}
        {tab === "board" && <BoardTab save={save} />}
        {tab === "profile" && <ProfileTab save={save} level={level} />}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// تبويب الساحة
// ═══════════════════════════════════════════════════════════════════════

function ArenaTab({
  save,
  level,
  rank,
  dailyDone,
  onStart,
  onOpenMind,
  tournament,
  onTournamentRound,
  onTournamentForfeit,
}: {
  save: ReturnType<typeof useLocalGame>;
  level: ReturnType<typeof levelInfo>;
  rank: ReturnType<typeof myRank>;
  dailyDone: boolean;
  onStart: (mode: ModeId, category?: string) => void;
  onOpenMind: () => void;
  tournament: ReturnType<typeof useTournament>;
  onTournamentRound: () => void;
  onTournamentForfeit: () => void;
}) {
  const [showCategories, setShowCategories] = useState(false);
  const mind = useEvolvedMind();
  const identity = mindIdentity(mind);
  const mindEffects = describeEffect(mindEffect(mind));
  const accuracy =
    save.stats.answered > 0 ? Math.round((save.stats.correct / save.stats.answered) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* بطاقة العقل */}
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-l from-primary/70 via-primary/30 to-transparent" />
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
              {save.profile.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-black">{save.profile.name}</p>
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-[10px] text-primary">
                  <Crown className="size-3" />
                  {save.profile.title}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                المستوى {level.level} · قوة العقل {mindPower(save.stats).toLocaleString("ar-EG")} · الترتيب #
                {rank.rank}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>التقدّم للمستوى {level.level + 1}</span>
              <span className="tabular-nums">
                {level.inLevel} / {level.needed} XP
              </span>
            </div>
            <Progress value={level.progress * 100} className="h-2" />
          </div>

          {/* 🧬 العقل المتطور — مدخل مباشر لقلب التقدّم الشخصي */}
          <button
            type="button"
            onClick={onOpenMind}
            className="mt-4 flex w-full items-center gap-2.5 rounded-2xl border border-violet-500/25 bg-violet-500/5 px-3 py-2.5 text-start transition-colors hover:bg-violet-500/10"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-lg">
              {identity.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{identity.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                مستوى العقل {mindTierScore(mind)}/72 ·{" "}
                {mindEffects.length > 0 ? mindEffects.slice(0, 2).join(" · ") : "العب لتكسب قواك الأولى"}
              </p>
            </div>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat icon={<Zap className="size-3.5" />} label="نقاط الخبرة" value={save.stats.xp.toLocaleString("ar-EG")} />
            <MiniStat icon={<Flame className="size-3.5" />} label="أفضل سلسلة" value={String(save.stats.bestStreak)} />
            <MiniStat icon={<Target className="size-3.5" />} label="الدقة" value={`${accuracy}%`} />
            <MiniStat icon={<Swords className="size-3.5" />} label="جولات" value={String(save.stats.matches)} />
          </div>
        </CardContent>
      </Card>

      {/* 👑 بطولة السلطان */}
      <Card className="overflow-hidden border-amber-500/30 shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-l from-amber-500/80 via-amber-400/40 to-transparent" />
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crown className="size-4 text-amber-500" />
            بطولة السلطان
            {tournament.crowns > 0 && (
              <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-[9px] text-amber-600">
                {tournament.crowns} تتويج
              </Badge>
            )}
          </CardTitle>
          {tournament.currentRound > 0 && (
            <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" onClick={onTournamentForfeit}>
              استسلام
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {tournament.currentRound > 0 ? (
            <>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                الجولة {tournament.currentRound} من {TOTAL_ROUNDS}
                {BOSS_ROUNDS.includes(tournament.currentRound) && (
                  <span className="ms-1 font-bold text-rose-500"> · ⚔️ معركة زعيم (١٤ ثانية للسؤال)</span>
                )}
                {tournament.bankedCoins > 0 && ` · مجمّز حتى الآن: ${tournament.bankedCoins} عملة`}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5">
                {Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1).map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "flex h-7 flex-1 items-center justify-center rounded-lg text-[10px] font-black tabular-nums",
                      r < tournament.currentRound
                        ? "bg-emerald-500/15 text-emerald-600"
                        : r === tournament.currentRound
                          ? BOSS_ROUNDS.includes(r)
                            ? "bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/40"
                            : "bg-primary/15 text-primary ring-1 ring-primary/40"
                          : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {BOSS_ROUNDS.includes(r) ? "👑" : r}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-xl">
                  {tournament.bracket[tournament.currentRound - 1]?.avatar ?? "🎭"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{tournament.bracket[tournament.currentRound - 1]?.name ?? "خصم"}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    دقة خصمك: {Math.round((tournament.bracket[tournament.currentRound - 1]?.accuracy ?? 0) * 100)}% · مكافأة الجولة: {roundPrize(tournament.currentRound)} عملة
                  </p>
                </div>
                <Button size="sm" className="shrink-0" onClick={onTournamentRound}>
                  <Swords className="size-3.5" />
                  خُض الجولة
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  قوس إقصائي من {TOTAL_ROUNDS} جولات · خسارة واحدة تُنهي الحلم ·
                  {tournament.bestRun > 0
                    ? ` أفضل وصول لك: ${prestigeLabel(tournament.bestRun)} (الجولة ${tournament.bestRun})`
                    : " لم تخض البطولة بعد"}
                </p>
              </div>
              <Button size="sm" onClick={onTournamentRound}>
                <Crown className="size-3.5" />
                ابدأ البطولة
              </Button>
            </div>
          )}
          {tournament.log.length > 0 && (
            <p className="mt-2.5 text-[10px] text-muted-foreground">
              آخر البطولات:{" "}
              {tournament.log.slice(0, 3).map((l, i) => (
                <span key={l.at} className="ms-1 tabular-nums">
                  {i > 0 && "· "}وصلت للجولة {l.reached}{l.crowned ? " 👑" : ""}
                </span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* الأنماط */}
      <div>
        <h2 className="mb-2.5 text-sm font-bold text-muted-foreground">اختر نمط المعركة</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["quick", "marathon", "daily", "duel"] as ModeId[]).map((mode) => {
            const meta = MODE_META[mode];
            const isDaily = mode === "daily";
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onStart(mode)}
                className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-start shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", meta.accent)}>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{meta.title}</p>
                    {isDaily && dailyDone && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">
                        أُنجز اليوم
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{meta.desc}</p>
                </div>
                <ChevronLeft className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* الفئات */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="size-4 text-primary" />
            تمرين مركّز على ذكاء واحد
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => setShowCategories((v) => !v)}>
            {showCategories ? "إخفاء" : "اعرض الفئات"}
          </Button>
        </CardHeader>
        {showCategories && (
          <CardContent className="grid grid-cols-2 gap-2 pt-0 sm:grid-cols-3">
            {CATEGORIES.map((c) => {
              const acc = categoryAccuracy(save, c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => onStart("category", c.name)}
                  className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-start transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <p className="truncate text-xs font-bold">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {c.count} سؤالاً
                    {acc !== null ? ` · دقتك ${Math.round(acc * 100)}%` : " · لم تُجرَّب"}
                  </p>
                </button>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* آخر الجولات */}
      {save.stats.history.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">آخر الجولات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {save.stats.history.slice(0, 6).map((h, i) => {
              const pct = h.total > 0 ? Math.round((h.correct / h.total) * 100) : 0;
              return (
                <div
                  key={`${h.at}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums",
                      pct >= 80
                        ? "bg-emerald-500/15 text-emerald-600"
                        : pct >= 50
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-rose-500/10 text-rose-600",
                    )}
                  >
                    {pct}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{h.label}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {h.correct}/{h.total} صحيحة · {h.score} نقطة
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        كل ما تراه هنا يعمل داخل متصفحك: لا حساب، لا شبكة، لا حصة. تقدّمك وإنجازاتك محفوظة
        تلقائياً وتُرحَّل لملفك الرسمي بمجرد عودة الخادم.
      </p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-black tabular-nums">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// تبويب التصنيف
// ═══════════════════════════════════════════════════════════════════════

function BoardTab({ save }: { save: ReturnType<typeof useLocalGame> }) {
  const rows = useMemo(() => leaderboard(save), [save]);
  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-amber-500" />
            لوحة شرف العقول
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            خصومك يتقدّمون كل يوم — ارتقِ بقوّة عقلك لتجاوزهم
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-0">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                r.isYou
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-muted/20",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums",
                  i === 0
                    ? "bg-amber-500/15 text-amber-600"
                    : i === 1
                      ? "bg-slate-400/20 text-slate-600 dark:text-slate-300"
                      : i === 2
                        ? "bg-orange-500/15 text-orange-600"
                        : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-lg">
                {r.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">
                  {r.name}
                  {r.isYou && <span className="ms-1.5 text-[10px] font-semibold text-primary">(أنت)</span>}
                </p>
                {r.isYou && r.gapToNext !== undefined && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    تحتاج {r.gapToNext.toLocaleString("ar-EG")} نقطة لتجاوز من فوقك
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs font-black tabular-nums">{r.score.toLocaleString("ar-EG")}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// تبويب الملف
// ═══════════════════════════════════════════════════════════════════════

/** ⚔️ سجلّ تحدّياتك الحقيقي — يُقرأ من الخادم لا من الذاكرة المحلية. */
function MyChallengesCard() {
  const runs = useQuery(api.challenges.getMyChallengeRuns, {});
  if (runs === undefined || runs.length === 0) return null;
  const totalXp = runs.reduce((sum, r) => sum + r.xpAwarded, 0);
  return (
    <Card className="border-rose-500/25 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Swords className="size-4 text-rose-600" /> تحدّياتي
          <span className="ms-auto text-[10px] font-normal tabular-nums text-muted-foreground">
            {runs.length} محاولة · {totalXp} خبرة
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {runs.slice(0, 6).map((r) => (
          <div key={`${r.code}-${r.createdAt}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-1.5">
            <Badge variant="outline" className="rounded-full font-mono text-[9px]">{r.code}</Badge>
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{r.title}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {r.correct}/{r.total} · {r.score} نقطة · {r.gradeLabel}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold tabular-nums",
                r.xpAwarded > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {r.xpAwarded > 0 ? `+${r.xpAwarded} خبرة` : "بلا مكافأة"}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProfileTab({
  save,
  level,
}: {
  save: ReturnType<typeof useLocalGame>;
  level: ReturnType<typeof levelInfo>;
}) {
  const [name, setName] = useState(save.profile.name);
  const titles = unlockedTitles(save.stats.xp);
  const accuracy =
    save.stats.answered > 0 ? Math.round((save.stats.correct / save.stats.answered) * 100) : 0;
  const unlocked = new Set(save.stats.achievements);

  const catRows = useMemo(
    () =>
      Object.entries(save.stats.categories)
        .map(([name, c]) => ({ name, ...c, acc: c.answered > 0 ? c.correct / c.answered : 0 }))
        .sort((a, b) => b.answered - a.answered)
        .slice(0, 8),
    [save.stats.categories],
  );

  return (
    <div className="space-y-4">
      {/* ⚔️ تحدّياتي: نتائج حقيقية سجّلها الخادم من جولاتك في تحدّيات الغرف والملتقى */}
      <MyChallengesCard />

      {/* التخصيص */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">تخصيص العقل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => updateProfile({ avatar: a })}
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl border text-xl transition-all",
                  save.profile.avatar === a
                    ? "border-primary bg-primary/10"
                    : "border-border/70 bg-muted/20 hover:border-primary/40",
                )}
                aria-label={`رمز ${a}`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground" htmlFor="mind-name">
              اسمك في الساحة
            </label>
            <div className="flex gap-2">
              <Input
                id="mind-name"
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                placeholder="اكتب اسمك"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const trimmed = name.trim();
                  if (!trimmed) {
                    toast.error("اكتب اسماً صالحاً");
                    return;
                  }
                  updateProfile({ name: trimmed });
                  toast.success("حُفظ اسمك");
                }}
              >
                حفظ
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-muted-foreground">رتبتك (تفتحها بالمستوى)</p>
            <div className="flex flex-wrap gap-2">
              {RANKS.map((r) => {
                const open = titles.includes(r.title);
                const active = save.profile.title === r.title;
                return (
                  <button
                    key={r.title}
                    type="button"
                    disabled={!open}
                    onClick={() => {
                      updateProfile({ title: r.title });
                      toast.success(`رتبتك الآن: ${r.title}`);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : open
                          ? "border-border/70 bg-muted/20 hover:border-primary/40"
                          : "cursor-not-allowed border-dashed border-border/60 text-muted-foreground/60",
                    )}
                  >
                    {r.title}
                    {!open && ` · م${r.level}`}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأرقام */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-primary" />
            أرقامك الحقيقية
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pt-0 sm:grid-cols-3">
          <MiniStat icon={<Zap className="size-3.5" />} label="نقاط الخبرة" value={save.stats.xp.toLocaleString("ar-EG")} />
          <MiniStat icon={<Trophy className="size-3.5" />} label="المستوى" value={String(level.level)} />
          <MiniStat icon={<Target className="size-3.5" />} label="الدقة" value={`${accuracy}%`} />
          <MiniStat icon={<Check className="size-3.5" />} label="إجابات صحيحة" value={save.stats.correct.toLocaleString("ar-EG")} />
          <MiniStat icon={<Brain className="size-3.5" />} label="أسئلة واجهتها" value={save.stats.answered.toLocaleString("ar-EG")} />
          <MiniStat icon={<Flame className="size-3.5" />} label="أفضل سلسلة" value={String(save.stats.bestStreak)} />
          <MiniStat icon={<Award className="size-3.5" />} label="جولات مثالية" value={String(save.stats.perfectRuns)} />
          <MiniStat icon={<Swords className="size-3.5" />} label="انتصارات المواجهة" value={String(save.stats.duelWins)} />
          <MiniStat icon={<CalendarDays className="size-3.5" />} label="سلسلة الأيام" value={String(save.stats.dailyStreak)} />
        </CardContent>
      </Card>

      {/* الفئات */}
      {catRows.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">أداؤك بحسب الذكاء</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {catRows.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {c.correct}/{c.answered} · {Math.round(c.acc * 100)}%
                  </span>
                </div>
                <Progress
                  value={c.acc * 100}
                  className={cn(
                    "h-1.5",
                    c.acc >= 0.8 ? "[&>*]:bg-emerald-500" : c.acc < 0.5 ? "[&>*]:bg-rose-500" : "[&>*]:bg-amber-500",
                  )}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* الإنجازات */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Award className="size-4 text-primary" />
            الإنجازات · {unlocked.size}/{ACHIEVEMENTS.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-0 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  got ? "border-amber-500/40 bg-amber-500/5" : "border-border/60 bg-muted/20 opacity-70",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-lg", got ? "bg-amber-500/15" : "bg-muted grayscale")}>
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{a.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{a.desc}</p>
                </div>
                {got ? (
                  <Check className="size-4 shrink-0 text-amber-600" />
                ) : (
                  <Badge variant="outline" className="shrink-0 rounded-full text-[9px] tabular-nums">
                    +{a.reward}
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-rose-500/30 bg-rose-500/5 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-bold">تصفير كل شيء</p>
            <p className="text-[10px] text-muted-foreground">يمسح تقدمك المحلي بالكامل — لا يمكن التراجع</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
            onClick={() => {
              if (window.confirm("هل أنت متأكد؟ سيُمحى كل تقدّمك المحلي نهائياً.")) {
                resetAll();
                toast.success("تم التصفير");
              }
            }}
          >
            <RotateCcw className="size-3.5" />
            تصفير
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// شاشة الجولة — كل الحساب محلي
// ═══════════════════════════════════════════════════════════════════════

type RunQuestion = {
  q: OfflineQuestion;
  options: string[];
  correctIndex: number;
};

function RunScreen({
  request,
  onExit,
  onChallengeResult,
}: {
  request: RunRequest;
  onExit: () => void;
  /** ⚔️ يُرسل نتيجة التحدّي للخادم — وهو من يقرّر المكافأة */
  onChallengeResult?: (run: { correct: number; total: number; score: number; durationMs: number }) => Promise<ChallengeSubmitOutcome>;
}) {
  const total = request.questions.length;
  // 🧬 تأثيرات «العقل المتطور» تُثبَّت لحظة بدء الجولة — كل رقم هنا مقيس فعلاً
  const [perks] = useState(() => mindEffect(readMind()));
  // جولة البطولة الزعيم تُلعب بعدّاد أقصر (١٤ ثانية) — البقية على قياسها المعتاد
  // ⚔️ وفي التحدّي: العدّاد يأتي من صعوبة التحدّي المُعلنة
  const baseTimer =
    request.timerOverride ??
    (request.tournament && BOSS_ROUNDS.includes(request.tournament.round) ? BOSS_TIMER : TIMER_BY_MODE[request.mode]);
  // ثواني العقل تُضاف على العدّاد فعلياً (قوة السرعة + التخصصات)
  const timerSeconds = baseTimer + perks.timeSec;
  const isMarathon = request.mode === "marathon";
  const isDuel = request.mode === "duel";
  const isTournament = request.tournament !== undefined;
  // دقة الخصم بعد إضعاف العقل (حضورك يربكه فعلاً)
  const rivalAccuracy = Math.max(0.25, (request.rival?.accuracy ?? 0.6) + perks.rivalAccuracy);

  const [run] = useState<RunQuestion[]>(() =>
    request.questions.map((q) => {
      const { options, correctIndex } = withShuffledOptions(q);
      return { q, options, correctIndex };
    }),
  );

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  // 🛡 دروع السلسلة الممنوحة من العقل — خطأ واحد لا ينهي سلسلتك
  const [shields, setShields] = useState(perks.streakShields);
  const [shieldsUsed, setShieldsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [rivalScore, setRivalScore] = useState(0);
  const [rivalPick, setRivalPick] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeSubmitOutcome | null>(null);
  const [summary, setSummary] = useState<{
    xpGained: number;
    unlocked: AchievementDef[];
    mind: MindSessionReport;
    tournament?: { won: boolean; prize: number; crowned: boolean; rivalScore: number };
  } | null>(null);

  const current = run[index];
  const answersRef = useRef<number[]>([]);
  const timesRef = useRef<number[]>([]);
  const questionStartRef = useRef<number>(0);
  const finishedRef = useRef(false);

  // ⏱ بداية زمن السؤال — يُقاس داخل مؤثر لا أثناء الرسم (نقاء المكوّن)
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [index]);

  const submit = (choice: number) => {
    if (revealed || finishedRef.current || !current) return;
    const startedAt = questionStartRef.current || Date.now();
    const elapsed = Math.min(timerSeconds * 1000, Math.max(0, Date.now() - startedAt));
    const isCorrect = choice === current.correctIndex;
    let nextStreak = streak;
    let gained = 0;

    if (isCorrect) {
      nextStreak = streak + 1;
      gained = current.q.reward + nextStreak * 20 + Math.max(0, timeLeft) * 3;
      setCorrectCount((c) => c + 1);
      setScore((s) => s + gained);
      setBestStreak((b) => Math.max(b, nextStreak));
    } else if (shields > 0) {
      // 🛡 درع السلسلة: الخطأ يُستَلك الدرع ولا تكسر سلسلتك
      setShields((v) => Math.max(0, v - 1));
      setShieldsUsed((v) => v + 1);
      if (isMarathon) setLives((l) => Math.max(0, l - 1));
    } else {
      nextStreak = 0;
      if (isMarathon) setLives((l) => Math.max(0, l - 1));
    }
    setStreak(nextStreak);

    // خصم المواجهة: يجيب بنسبة دقته بعد إضعاف العقل
    if (isDuel && request.rival) {
      const rivalRight = Math.random() < rivalAccuracy;
      setRivalPick(rivalRight ? current.correctIndex : (current.correctIndex + 1) % current.options.length);
      if (rivalRight) setRivalScore((s) => s + current.q.reward);
    }

    answersRef.current = [...answersRef.current, choice];
    timesRef.current = [...timesRef.current, elapsed];
    setPicked(choice === -1 ? null : choice);
    setRevealed(true);
  };

  // ⏱ العدّاد التنازلي — يتوقف عند الكشف أو الإنهاء، ويُسلّم الإجابة عند الصفر
  // (التسليم يقع داخل مؤقت لا داخل جسم المؤثر، فلا يحدث رندر تتابعي)
  useEffect(() => {
    if (revealed || finished) return;
    const t = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        submit(-1);
      } else {
        setTimeLeft((v) => v - 1);
      }
    }, 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, revealed, finished]);

  const finish = (finalAnswers: number[]) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const outcome = finishSession({
      mode: request.mode,
      label: request.label,
      questions: request.questions,
      answers: finalAnswers,
      score,
      bestStreak,
      timesMs: timesRef.current,
      timerSeconds,
    });
    // تسوية مصير جولة البطولة: فوز = تقدّم + مكافأة، خسارة = إقصاء
    let tResult: ReturnType<typeof settleRound> | null = null;
    if (isTournament) {
      tResult = settleRound(score > rivalScore);
    }
    setSummary({
      xpGained: outcome.xpGained,
      unlocked: outcome.unlocked,
      mind: outcome.mind,
      tournament: tResult
        ? { won: tResult.won, prize: tResult.prize, crowned: tResult.crowned, rivalScore }
        : undefined,
    });
    // ⚔️ نتيجة التحدّي تُرسل للخادم بالنتيجة الحقيقية محسوبة من إجابات اللاعب
    if (request.challengeCode && onChallengeResult) {
      const correctFinal = finalAnswers.filter((a, i) => a === run[i]?.correctIndex).length;
      const durationMs = timesRef.current.reduce((sum, ms) => sum + ms, 0);
      void onChallengeResult({ correct: correctFinal, total, score, durationMs })
        .then((res) => setChallengeResult(res))
        .catch(() => setChallengeResult({ status: "failed", message: "تعذّر إرسال نتيجة التحدّي", result: null, coinsGranted: 0 }));
    }
    setFinished(true);
  };

  const next = () => {
    const dead = isMarathon && lives <= 0;
    if (index + 1 >= total || dead) {
      finish(answersRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
    setRivalPick(null);
    setTimeLeft(timerSeconds);
  };

  const restart = () => {
    finishedRef.current = false;
    answersRef.current = [];
    timesRef.current = [];
    questionStartRef.current = Date.now();
    setIndex(0);
    setPicked(null);
    setRevealed(false);
    setStreak(0);
    setBestStreak(0);
    setCorrectCount(0);
    setScore(0);
    setLives(3);
    setShields(perks.streakShields);
    setShieldsUsed(0);
    setTimeLeft(timerSeconds);
    setRivalScore(0);
    setRivalPick(null);
    setFinished(false);
    setSummary(null);
    setChallengeResult(null);
  };

  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const duelWon = isDuel && score > rivalScore;

  // ── شاشة النتيجة ──
  if (finished) {
    return (
      <div dir="rtl" className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
          <Card
            className={cn(
              "border-2 shadow-sm",
              percent >= 80 ? "border-emerald-500/40" : percent >= 50 ? "border-amber-500/40" : "border-rose-500/30",
            )}
          >
            <CardHeader className="items-center text-center">
              <span
                className={cn(
                  "flex size-16 items-center justify-center rounded-2xl text-3xl",
                  percent >= 80 ? "bg-emerald-500/15" : percent >= 50 ? "bg-amber-500/15" : "bg-rose-500/10",
                )}
              >
                {percent === 100 ? "🏆" : percent >= 80 ? "🎯" : percent >= 50 ? "💪" : "🌱"}
              </span>
              <CardTitle className="mt-3 text-xl">
                {percent === 100 ? "إتقان تام!" : percent >= 80 ? "أداء بطل" : percent >= 50 ? "أحسنت" : "واصل المحاولة"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{request.label}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">النتيجة</p>
                  <p className="text-xl font-black tabular-nums">{percent}%</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">النقاط</p>
                  <p className="text-xl font-black tabular-nums text-primary">{score}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">أفضل سلسلة</p>
                  <p className="text-xl font-black tabular-nums">{bestStreak}</p>
                </div>
              </div>

              {isDuel && request.rival && (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3",
                    duelWon ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10",
                  )}
                >
                  <p className="text-sm font-bold">{duelWon ? "🥊 فزت في المواجهة!" : "خسرت المواجهة هذه المرة"}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {score} — {rivalScore}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted-foreground">نقاط الخبرة المكتسبة</p>
                  {perks.xpPct > 0 && (
                    <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                      🧬 مكافأة العقل المتطور +{Math.round(perks.xpPct)}%
                    </p>
                  )}
                </div>
                <p className="text-lg font-black tabular-nums text-primary">+{summary?.xpGained ?? 0} XP</p>
              </div>

              {request.challengeCode && (
                <div
                  className={cn(
                    "space-y-1 rounded-2xl border p-3",
                    challengeResult?.status === "paid"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : challengeResult?.status === "queued" || challengeResult?.status === "unauthenticated"
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border/70 bg-muted/20",
                  )}
                >
                  <p className="text-xs font-black">
                    {challengeResult === null
                      ? "⚔️ نُرسل نتيجتك للتحدّي…"
                      : challengeResult.status === "paid"
                        ? `⚔️ مكافأة التحدّي وصلت ${challengeResult.result?.grade.emoji ?? ""}`
                        : challengeResult.status === "already"
                          ? "♻️ نلت مكافأة هذا التحدّي سابقاً"
                          : `⚔️ ${challengeResult.status === "queued" ? "بانتظار الاتصال" : challengeResult.status === "unauthenticated" ? "يلزم تسجيل الدخول للمكافأة" : "لا مكافأة هذه المرة"}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {challengeResult?.message ?? `كود التحدّي ${request.challengeCode}`}
                  </p>
                  {challengeResult?.status === "paid" && (
                    <p className="text-[11px] font-bold tabular-nums text-foreground/80">
                      +{challengeResult.result?.xpAwarded ?? 0} خبرة
                      {challengeResult.coinsGranted > 0 ? ` · +${challengeResult.coinsGranted} عملة` : ""}
                      {challengeResult.result?.bestScore !== undefined ? ` · أفضل نتيجة ${challengeResult.result.bestScore}` : ""}
                    </p>
                  )}
                </div>
              )}

              {summary?.mind && summary.mind.totalGained > 0 && (
                <div className="space-y-2 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-400">
                      <Brain className="size-3.5" /> تطوّر عقلك في هذه الجولة
                    </p>
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                      +{summary.mind.totalGained} نقطة عقل
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.mind.gains.map((g) => (
                      <span
                        key={g.id}
                        className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[10px] font-bold tabular-nums"
                      >
                        {g.icon} {g.name} +{g.gained}
                        {g.leveledUp && (
                          <span className="ms-1 text-emerald-600 dark:text-emerald-400">→ م{g.level}</span>
                        )}
                      </span>
                    ))}
                  </div>
                  {shieldsUsed > 0 && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      🛡 أنقذت دروع العقل سلسلتك {shieldsUsed} مرة في هذه الجولة
                    </p>
                  )}
                  {summary.mind.unlockedSpecs.length > 0 && (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2">
                      <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        🔓 تخصص جديد: {summary.mind.unlockedSpecs.map((s) => `${s.icon} ${s.name}`).join(" · ")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        جهّزه من تبويب «العقل» ليؤثر في جولاتك فعلماً
                      </p>
                    </div>
                  )}
                  {summary.mind.masteryUps.length > 0 && (
                    <div className="space-y-0.5">
                      {summary.mind.masteryUps.map((m, i) => (
                        <p key={`${m.category}-${i}`} className="text-[11px] text-muted-foreground">
                          {m.tierIcon} وصلت إلى <span className="font-bold">{m.tierName}</span> في {m.category} · +
                          {m.reward} عملة
                        </p>
                      ))}
                    </div>
                  )}
                  {summary.mind.identity.top && (
                    <p className="text-[10px] text-muted-foreground">
                      هوية عقلك:{" "}
                      <span className="font-bold text-foreground">
                        {summary.mind.identity.icon} {summary.mind.identity.title}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {summary?.tournament && (
                <div
                  className={cn(
                    "space-y-1 rounded-2xl border p-3",
                    summary.tournament.crowned
                      ? "border-amber-500/50 bg-amber-500/10"
                      : summary.tournament.won
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-rose-500/40 bg-rose-500/10",
                  )}
                >
                  {summary.tournament.crowned ? (
                    <>
                      <p className="text-sm font-black text-amber-600 dark:text-amber-400">👑 أصبحت سلطان العقول!</p>
                      <p className="text-[11px] text-muted-foreground">
                        هزمت مقام السلطان وتوّجت باللقب · مكافأة التتويج: {summary.tournament.prize} عملة
                      </p>
                    </>
                  ) : summary.tournament.won ? (
                    <>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">✅ جولة البطولة محسومة لصالحك</p>
                      <p className="text-[11px] text-muted-foreground">
                        +{summary.tournament.prize} عملة · تتقدّم للجولة التالية في القوس
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-rose-600 dark:text-rose-400">⚔️ أُقصيت من البطولة</p>
                      <p className="text-[11px] text-muted-foreground">
                        نقاط خصمك: {summary.tournament.rivalScore} — تبدأ قوساً جديداً من الجولة الأولى
                      </p>
                    </>
                  )}
                </div>
              )}

              {summary && summary.unlocked.length > 0 && (
                <div className="space-y-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    🎉 إنجازات جديدة · +{summary.unlocked.reduce((sum, a) => sum + a.reward, 0)} عملة
                  </p>
                  {summary.unlocked.map((a) => (
                    <p key={a.id} className="text-xs font-semibold">
                      {a.icon} {a.title} — <span className="text-muted-foreground">{a.desc}</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1 gap-2" onClick={restart}>
                  <RotateCcw className="size-4" />
                  أعد المحاولة
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={onExit}>
                  <Home className="size-4" />
                  الساحة
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ── شاشة اللعب ──
  const timeRatio = timerSeconds > 0 ? timeLeft / timerSeconds : 0;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="size-9" onClick={onExit} aria-label="خروج">
            <X className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{request.label}</p>
            <p className="truncate text-[11px] text-muted-foreground tabular-nums">
              السؤال {Math.min(index + 1, total)} من {total} · صحيحة {correctCount}
              {isMarathon && ` · القلوب ${lives}`}
            </p>
          </div>
          {isMarathon ? (
            <span className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={cn("size-3.5", i < lives ? "fill-rose-500 text-rose-500" : "text-muted-foreground/40")}
                />
              ))}
            </span>
          ) : (
            <Badge variant="outline" className="gap-1 rounded-full text-[10px] tabular-nums">
              <Zap className="size-3" />
              {score}
            </Badge>
          )}
        </div>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3 sm:px-6">
          <Progress value={total > 0 ? ((index + (revealed ? 1 : 0)) / total) * 100 : 0} className="h-1.5 flex-1" />
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
            <Timer className="size-3.5" />
            {timeLeft}s
          </span>
          {perks.timeSec > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold tabular-nums text-violet-600 dark:text-violet-400">
              <Brain className="size-3.5" />
              +{perks.timeSec}s
            </span>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2 sm:px-6">
          <Progress
            value={timeRatio * 100}
            className={cn(
              "h-1",
              timeRatio > 0.5 ? "[&>*]:bg-emerald-500" : timeRatio > 0.25 ? "[&>*]:bg-amber-500" : "[&>*]:bg-rose-500",
            )}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {(perks.xpPct > 0 || shields > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/5 px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-400">
              <Brain className="size-3.5" /> العقل المتطور يعمل
            </span>
            {perks.xpPct > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px]">
                +{Math.round(perks.xpPct)}% خبرة
              </Badge>
            )}
            {perks.coinsPct > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px]">
                +{Math.round(perks.coinsPct)}% عملات
              </Badge>
            )}
            {shields > 0 && (
              <Badge variant="outline" className="rounded-full border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-400">
                🛡 {shields} درع سلسلة
              </Badge>
            )}
          </div>
        )}
        {isDuel && request.rival && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-card text-lg">{request.rival.avatar}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{request.rival.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {rivalPick !== null
                  ? rivalPick === current?.correctIndex
                    ? "أجاب صحيحاً ⚡"
                    : "أخطأ هذه المرة"
                  : "يفكّر…"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-black tabular-nums">{rivalScore}</p>
          </div>
        )}

        {current ? (
          <div className="space-y-4">
            <Card className="border-border/70 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {current.q.category}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full text-[10px]", DIFFICULTY_CLASS[current.q.difficulty])}>
                    {DIFFICULTY_LABEL[current.q.difficulty]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[10px] tabular-nums">
                    +{current.q.reward} XP
                  </Badge>
                  {streak >= 2 && (
                    <Badge variant="outline" className="gap-1 rounded-full border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                      <Flame className="size-3" />
                      سلسلة {streak}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-base font-bold leading-relaxed">{current.q.question}</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 sm:grid-cols-2">
              {current.options.map((option, i) => {
                const isCorrect = revealed && current.correctIndex === i;
                const isWrongPick = revealed && picked === i && current.correctIndex !== i;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revealed}
                    onClick={() => submit(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-start text-sm font-semibold transition-all disabled:cursor-not-allowed",
                      isCorrect
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : isWrongPick
                          ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                      {["أ", "ب", "ج", "د"][i] ?? i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{option}</span>
                    {isCorrect && <Check className="size-4 shrink-0" />}
                    {isWrongPick && <X className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                  picked === current.correctIndex
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-rose-500/40 bg-rose-500/10",
                )}
              >
                <p className="text-sm font-bold">
                  {picked === current.correctIndex
                    ? "✅ إجابة صحيحة"
                    : picked === null
                      ? "⏱ انتهى الوقت"
                      : "❌ إجابة خاطئة"}
                </p>
                <Button size="sm" className="gap-1.5" onClick={next}>
                  {index + 1 >= total || (isMarathon && lives <= 0) ? "عرض النتيجة" : "التالي"}
                  <ChevronLeft className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <p className="text-sm text-muted-foreground">جارٍ تجهيز الأسئلة…</p>
          </div>
        )}
      </main>
    </div>
  );
}
