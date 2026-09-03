import { useState } from "react";
import type { ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award,
  Bell,
  Check,
  ChevronLeft,
  Copy,
  Flag,
  Flame,
  Gamepad2,
  Gift,
  Heart,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  Medal,
  Moon,
  Music,
  Rocket,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { TITLE_RARITY_LABEL } from "@/lib/progression";
import type { PlayerSettings } from "@/lib/progression";
import type { QuestKind } from "@/lib/progression";
import { DIFFICULTY_LABELS } from "@/lib/analytics";

/* ── حساب مستوى محلي (نفس منحنى الخادم: 100 ثم ×1.15) ─────────────── */

function xpFloorForLevel(level: number): number {
  let total = 0;
  let need = 100;
  let lvl = 1;
  while (lvl < level) {
    total += need;
    need = Math.floor(need * 1.15);
    lvl++;
  }
  return total;
}

function levelInfo(xp: number) {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (acc + need <= xp) {
    acc += need;
    level++;
    need = Math.floor(need * 1.15);
  }
  const floor = xpFloorForLevel(level);
  const next = xpFloorForLevel(level + 1);
  const pct =
    next > floor
      ? Math.min(100, Math.max(0, Math.round(((xp - floor) / (next - floor)) * 100)))
      : 100;
  return { level, pct, needNext: next - floor, intoLevel: xp - floor };
}

const LEVEL_ICONS: Record<number, string> = {
  1: "🌱", 2: "🌿", 3: "🍀", 4: "🔥", 5: "⚡",
};

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "analytics", label: "التحليلات", icon: TrendingUp },
  { id: "quests", label: "المهام", icon: ListChecks },
  { id: "milestones", label: "المعالم", icon: Flag },
  { id: "titles", label: "الألقاب", icon: Medal },
  { id: "favorites", label: "المفضلة", icon: Heart },
  { id: "referral", label: "الدعوات", icon: Users },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

type TabId = "overview" | "analytics" | "quests" | "milestones" | "titles" | "favorites" | "referral" | "settings";

/* ═══════════════════════════════════════════════════════════════════
   عناصر مشتركة
   ═══════════════════════════════════════════════════════════════════ */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 text-teal-600 dark:text-teal-300">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="text-base font-black tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  desc,
  action,
  onClick,
  highlight,
  primary,
  ready,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
  highlight?: boolean;
  primary?: boolean;
  ready?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer rounded-2xl border-border/60 transition-all hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/5",
        highlight && "border-amber-500/40 bg-amber-500/5",
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            primary
              ? "bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 group-hover:from-teal-600 group-hover:to-cyan-700"
              : "bg-teal-500/10 text-teal-600 dark:text-teal-300",
            highlight && "bg-amber-500/15 text-amber-600 dark:text-amber-300",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{desc}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
            primary
              ? "bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm group-hover:from-teal-600 group-hover:to-cyan-700"
              : "bg-teal-500/10 text-teal-600 dark:text-teal-300",
            highlight && "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            ready === false && "bg-muted text-muted-foreground",
          )}
        >
          {ready === false ? <Check className="ml-1 inline size-3.5" /> : null}
          {action}
        </span>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   نظرة عامة
   ═══════════════════════════════════════════════════════════════════ */
function OverviewTab({ onGoTo }: { onGoTo: (tab: TabId) => void }) {
  const hub = useQuery(api.progression.getHub);
  const navigate = useNavigate();

  if (!hub) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const { profile } = hub;
  const info = levelInfo(profile.xp);
  const stats = [
    { label: "جولات", value: profile.gamesPlayed, icon: Gamepad2, tint: "text-sky-500 bg-sky-500/10" },
    { label: "انتصارات", value: profile.gamesWon, icon: Trophy, tint: "text-amber-500 bg-amber-500/10" },
    { label: "نسبة الفوز", value: profile.winRate, suffix: "%", icon: Target, tint: "text-emerald-500 bg-emerald-500/10" },
    { label: "أفضل نتيجة", value: profile.bestScore, icon: Award, tint: "text-violet-500 bg-violet-500/10" },
    { label: "أفضل سلسلة", value: profile.bestStreak, icon: Flame, tint: "text-orange-500 bg-orange-500/10" },
    { label: "الدقة", value: profile.accuracy, suffix: "%", icon: Zap, tint: "text-cyan-500 bg-cyan-500/10" },
  ];

  return (
    <div className="space-y-5">
      {/* بطاقة اللاعب */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-card to-indigo-500/10 p-6">
        <div className="pointer-events-none absolute -left-10 -top-10 size-44 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-6 size-52 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-3xl text-white shadow-lg shadow-teal-500/20">
              {LEVEL_ICONS[profile.level] ?? "🧠"}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">مرحباً بعودتك 👋</p>
              <h2 className="text-xl font-black tracking-tight">{profile.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300">
                  المستوى {info.level}
                </Badge>
                {profile.dailyStreak > 0 && (
                  <Badge variant="secondary" className="rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-300">
                    <Flame className="size-3" /> سلسلة {profile.dailyStreak} يوم
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-1.5 flex items-end justify-between gap-2 text-sm">
              <span className="font-semibold text-foreground">{profile.xp.toLocaleString("en")} XP</span>
              <span className="text-muted-foreground">
                {info.intoLevel.toLocaleString("en")} / {info.needNext.toLocaleString("en")} للمستوى {info.level + 1}
              </span>
            </div>
            <Progress value={info.pct} className="h-3 rounded-full bg-card" />
          </div>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("flex size-10 items-center justify-center rounded-xl", s.tint)}>
                <s.icon className="size-5" />
              </span>
              <div>
                <p className="text-lg font-black leading-tight">
                  {s.value.toLocaleString("en")}
                  {s.suffix ?? ""}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* اختصارات سريعة */}
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickCard
          icon={ListChecks}
          title="مكافآت بانتظارك"
          desc={hub.claimableCount > 0 ? `لديك ${hub.claimableCount} مكافأة جاهزة للاستلام` : "أكمل المهام لتربح XP إضافياً"}
          action="استلام"
          highlight={hub.claimableCount > 0}
          onClick={() => onGoTo("quests")}
        />
        <QuickCard
          icon={Gift}
          title="المكافأة اليومية"
          desc={profile.canClaimDaily ? "مكافأتك اليومية متاحة الآن — الدخول المتتالي يزيدها" : "استلمتها اليوم — عد غداً لمواصلة السلسلة"}
          action={profile.canClaimDaily ? "استلام" : "تم"}
          highlight={profile.canClaimDaily}
          ready={profile.canClaimDaily}
          onClick={() => onGoTo("referral")}
        />
        <QuickCard
          icon={Medal}
          title="الألقاب"
          desc="جهّز لقباً يظهر بجانب اسمك في كل اللعبة"
          action="عرض"
          onClick={() => onGoTo("titles")}
        />
        <QuickCard
          icon={Gamepad2}
          title="العب الآن"
          desc="ارفع أرقامك اليوم وحقق أهداف المهام"
          action="ابدأ"
          primary
          onClick={() => navigate("/play")}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   المهام اليومية والأسبوعية
   ═══════════════════════════════════════════════════════════════════ */
function QuestRow({
  kind,
  quest,
  progress,
  completed,
  claimed,
}: {
  kind: QuestKind;
  quest: { id: string; title: string; description: string; icon: string; target: number; rewardXp: number };
  progress: number;
  completed: boolean;
  claimed: boolean;
}) {
  const claim = useMutation(api.progression.claimQuest);
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, Math.round((Math.min(progress, quest.target) / quest.target) * 100));

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-teal-500/30">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl text-xl",
          completed ? "bg-emerald-500/15" : "bg-muted",
        )}
      >
        {quest.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{quest.title}</p>
          {claimed && (
            <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <Check className="size-3" /> مستلمة
            </Badge>
          )}
          {completed && !claimed && (
            <Badge variant="secondary" className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
              <Sparkles className="size-3" /> جاهزة للاستلام
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{quest.description}</p>
        {!completed && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={pct} className="h-1.5 rounded-full bg-muted" />
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {Math.min(progress, quest.target)}/{quest.target}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Badge variant="outline" className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 px-2.5 text-amber-600 dark:text-amber-300">
          <Zap className="size-3" /> +{quest.rewardXp} XP
        </Badge>
        {completed && !claimed && (
          <Button
            size="sm"
            className="rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-xs shadow-sm hover:from-teal-600 hover:to-cyan-700"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await claim({ kind, questId: quest.id });
                toast.success(`+${res.rewardXp} XP 🎉`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر الاستلام");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            استلام
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestsTab() {
  const hub = useQuery(api.progression.getHub);

  if (!hub) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <SectionHeader
          icon={Zap}
          title="مهام اليوم"
          subtitle="تتجدد يومياً — XP إضافية مقابل نشاطك المعتاد"
        />
        <div className="space-y-2.5">
          {hub.daily.map((d) => (
            <QuestRow key={d.quest.id} kind="daily" quest={d.quest} progress={d.progress} completed={d.completed} claimed={d.claimed} />
          ))}
        </div>
      </div>
      <div>
        <SectionHeader
          icon={Trophy}
          title="مهام الأسبوع"
          subtitle="تتجدد كل أسبوع — مكافآت أكبر لإنجازات أكبر"
        />
        <div className="space-y-2.5">
          {hub.weekly.map((w) => (
            <QuestRow key={w.quest.id} kind="weekly" quest={w.quest} progress={w.progress} completed={w.completed} claimed={w.claimed} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   المعالم
   ═══════════════════════════════════════════════════════════════════ */
function MilestonesTab() {
  const hub = useQuery(api.progression.getHub);
  const claim = useMutation(api.progression.claimQuest);

  if (!hub) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        icon={Flag}
        title="معالم الخبرة"
        subtitle="كلما جمعت XP ترتفع إلى معالم جديدة — اضغط «استلام» عند بلوغ كل معلم"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hub.milestones.map((m) => (
          <Card
            key={m.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border-border/60 transition-all",
              m.reached && !m.claimed && "border-teal-500/40 bg-teal-500/5",
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl text-xl",
                    m.reached ? "bg-teal-500/15" : "bg-muted",
                  )}
                >
                  {m.icon}
                </span>
                <Badge variant="outline" className="gap-1 rounded-full border-violet-500/30 bg-violet-500/10 px-2.5 text-violet-600 dark:text-violet-300">
                  {m.xp.toLocaleString("en")} XP
                </Badge>
              </div>
              <p className="mt-3 text-sm font-bold">{m.title}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">مكافأة +{m.rewardXp} XP</span>
                {m.claimed ? (
                  <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <Check className="size-3" /> مستلمة
                  </Badge>
                ) : m.reached ? (
                  <Button
                    size="sm"
                    className="h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-xs shadow-sm hover:from-teal-600 hover:to-cyan-700"
                    onClick={async () => {
                      try {
                        const res = await claim({ kind: "milestone", questId: m.id });
                        toast.success(`معلم «${m.title}» — +${res.rewardXp} XP 👑`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر الاستلام");
                      }
                    }}
                  >
                    <Sparkles className="size-3" /> استلام
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" /> غير مفتوح
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   الألقاب
   ═══════════════════════════════════════════════════════════════════ */
const RARITY_STYLE: Record<string, string> = {
  common: "text-muted-foreground",
  rare: "text-sky-500",
  epic: "text-violet-500",
  legendary: "text-amber-500",
};

function TitlesTab() {
  const hub = useQuery(api.progression.getHub);
  const equip = useMutation(api.progression.equipTitle);

  if (!hub) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        icon={Medal}
        title="ألقابك"
        subtitle="افتح ألقاباً بإنجازاتك الحقيقية واعرضها بجانب اسمك في اللعبة"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hub.titles.map((t) => (
          <Card
            key={t.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border-border/60 transition-all",
              t.equipped && "border-amber-400/50 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-lg shadow-amber-500/5",
              !t.unlocked && "opacity-70",
            )}
          >
            {t.equipped && <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />}
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                    t.unlocked ? "bg-gradient-to-br from-teal-500/20 to-cyan-500/10" : "bg-muted",
                  )}
                >
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {t.unlocked ? t.name : "؟؟؟"}
                    {t.equipped && (
                      <Badge className="h-4 rounded-full bg-amber-500 px-1.5 text-[9px] text-white">معروض</Badge>
                    )}
                  </p>
                  <p className={cn("text-[11px] font-semibold", RARITY_STYLE[t.rarity])}>
                    {t.unlocked ? TITLE_RARITY_LABEL[t.rarity] : "لقب مقفل"}
                  </p>
                </div>
              </div>
              <p className="mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground">
                {t.unlocked ? t.description : "أكمل الإنجازات المطلوبة لكشف هذا اللقب"}
              </p>
              {t.unlocked ? (
                <Button
                  size="sm"
                  variant={t.equipped ? "secondary" : "outline"}
                  className="mt-2 w-full rounded-full text-xs"
                  disabled={t.equipped}
                  onClick={async () => {
                    try {
                      await equip({ titleId: t.id });
                      toast.success(`تم تجهيز لقب «${t.name}» ✨`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "تعذّر التجهيز");
                    }
                  }}
                >
                  {t.equipped ? (
                    <>
                      <Check className="size-3" /> معروض
                    </>
                  ) : (
                    "تجهيز"
                  )}
                </Button>
              ) : (
                <div className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-border/60 py-1.5 text-[11px] text-muted-foreground">
                  <Lock className="size-3" /> مقفل
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   المفضلة
   ═══════════════════════════════════════════════════════════════════ */
function FavoritesTab() {
  const favorites = useQuery(api.progression.getFavorites);
  const toggle = useMutation(api.progression.toggleFavorite);
  const navigate = useNavigate();

  if (!favorites) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        icon={Heart}
        title="الأسئلة المفضلة"
        subtitle="الأسئلة التي حفظتها أثناء اللعب تظهر هنا لمراجعتها — أزل ما حفظته أو عُد للعب"
      />
      {favorites.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <Heart className="size-7" />
            </span>
            <p className="font-bold">لا توجد أسئلة مفضلة بعد</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              أثناء اللعب اضغط على زر القلب بجانب أي سؤال لحفظه هنا والتدرب عليه لاحقاً.
            </p>
            <Button
              className="mt-1 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              onClick={() => navigate("/play")}
            >
              <Gamepad2 className="size-4" /> ابدأ جولة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {favorites.map((f) => (
            <div key={f.questionId} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300">
                    {f.category}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {f.difficulty}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold leading-relaxed">{f.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  الإجابة الصحيحة: {f.options[f.correctIndex]}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 rounded-full text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                title="إزالة من المفضلة"
                onClick={async () => {
                  try {
                    await toggle({ questionId: f.questionId });
                    toast.success("أُزيلت من المفضلة");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "تعذّرت الإزالة");
                  }
                }}
              >
                <Heart className="size-4 fill-current" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   الدعوات + المكافأة اليومية
   ═══════════════════════════════════════════════════════════════════ */
function ReferralTab() {
  const hub = useQuery(api.progression.getHub);
  const claimDaily = useMutation(api.profile.claimDailyReward);
  const ensureReferral = useMutation(api.progression.ensureReferral);
  const applyReferral = useMutation(api.progression.applyReferral);
  const [codeInput, setCodeInput] = useState("");
  const [busyClaim, setBusyClaim] = useState(false);
  const [busyApply, setBusyApply] = useState(false);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("تم نسخ كود الدعوة 📋");
    } catch {
      toast.error("تعذّر النسخ — انسخ الكود يدوياً");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* المكافأة اليومية */}
      <Card className="overflow-hidden rounded-3xl border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-xl">🎁</span>
            المكافأة اليومية
          </CardTitle>
          <CardDescription>
            ادخل يومياً لبناء سلسلة تزيد من XP — كل 3 / 7 / 30 يوماً تفتح شارات خاصة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hub && hub.profile.dailyStreak > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-orange-500/10 p-3 text-sm">
              <Flame className="size-5 shrink-0 text-orange-500" />
              <span>
                سلسلتك الحالية: <b>{hub.profile.dailyStreak} يوم</b> — واصل الدخول يومياً لرفع المكافأة
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
              ابدأ سلسلتك اليومية الآن — جولة واحدة يومياً تكفي.
            </div>
          )}
          <Button
            className="w-full rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700"
            disabled={!hub?.profile.canClaimDaily || busyClaim}
            onClick={async () => {
              setBusyClaim(true);
              try {
                const res = await claimDaily();
                toast.success(`+${res.xpEarned} XP — سلسلة ${res.streak} يوم 🎁`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر الاستلام");
              } finally {
                setBusyClaim(false);
              }
            }}
          >
            {busyClaim ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hub?.profile.canClaimDaily ? (
              <Gift className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
            {hub?.profile.canClaimDaily ? "استلام مكافأة اليوم" : "استلمتها اليوم — عد غداً"}
          </Button>
        </CardContent>
      </Card>

      {/* الدعوات */}
      <Card className="rounded-3xl border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-card to-cyan-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-xl">🤝</span>
            ادعُ أصدقاءك
          </CardTitle>
          <CardDescription>
            شارك كودك: كل صديق يستخدمه يربح 25 XP وأنت تربح 40 XP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hub?.referral.code ? (
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 rounded-2xl border border-teal-500/30 bg-card px-4 py-3 text-center text-lg font-black tracking-[0.2em] text-teal-600 dark:text-teal-300"
              >
                {hub.referral.code}
              </code>
              <Button
                size="icon"
                variant="outline"
                className="size-11 shrink-0 rounded-2xl"
                onClick={() => hub && hub.referral.code && copyCode(hub.referral.code)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              className="w-full rounded-full"
              onClick={async () => {
                try {
                  const res = await ensureReferral();
                  toast.success(`تم إنشاء كودك: ${res.code}`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
                }
              }}
            >
              <Rocket className="size-4" /> إنشاء كود الدعوة
            </Button>
          )}
          {hub?.referral.code && (
            <p className="text-center text-xs text-muted-foreground">
              استُخدم بواسطة {hub.referral.redeemedCount}{" "}
              {hub.referral.redeemedCount === 1 ? "صديق" : hub.referral.redeemedCount === 2 ? "صديقين" : "أصدقاء"}
            </p>
          )}
          <div className="border-t border-border/60 pt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">أو أدخل كود صديق:</p>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="ABCD-XXXX"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="rounded-2xl text-center font-bold tracking-[0.15em]"
                maxLength={10}
              />
              <Button
                className="shrink-0 rounded-2xl"
                disabled={busyApply || codeInput.replace(/[^A-Z0-9]/g, "").length < 6}
                onClick={async () => {
                  setBusyApply(true);
                  try {
                    const res = await applyReferral({ code: codeInput });
                    toast.success(`تم! أنت +${res.myXp} XP وصديقك +${res.inviterXp} XP 🎉`);
                    setCodeInput("");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "الكود غير صالح");
                  } finally {
                    setBusyApply(false);
                  }
                }}
              >
                {busyApply ? <Loader2 className="size-4 animate-spin" /> : "تفعيل"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   الإعدادات
   ═══════════════════════════════════════════════════════════════════ */
function SettingsTab() {
  const hub = useQuery(api.progression.getHub);
  const update = useMutation(api.progression.updateSettings);
  const { isDark, toggle } = useDarkMode();
  const [busy, setBusy] = useState(false);

  if (!hub) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  const save = async (next: PlayerSettings) => {
    setBusy(true);
    try {
      await update(next);
      toast.success("تم حفظ إعداداتك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsRow
        icon={Volume2}
        title="المؤثرات الصوتية"
        desc="أصوات النقر والإجابات داخل اللعبة"
        checked={hub.settings.soundEnabled}
        onChecked={(v) => save({ ...hub.settings, soundEnabled: v })}
      />
      <SettingsRow
        icon={Music}
        title="الموسيقى"
        desc="الموسيقى الخلفية في اللوبي والنتائج"
        checked={hub.settings.musicEnabled}
        onChecked={(v) => save({ ...hub.settings, musicEnabled: v })}
      />
      <SettingsRow
        icon={Bell}
        title="الإشعارات"
        desc="التنبيهات داخل التطبيق للمهام والإنجازات"
        checked={hub.settings.notificationsEnabled}
        onChecked={(v) => save({ ...hub.settings, notificationsEnabled: v })}
      />
      <Card className="rounded-2xl border-border/60">
        <CardContent className="flex items-center gap-4 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">مستوى الحركة</p>
            <p className="text-xs text-muted-foreground">قلل الأنيمشن لتجربة أهدأ أو أداء أفضل على الأجهزة الضعيفة</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-border/60">
            {(["full", "reduced", "off"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => save({ ...hub.settings, motionLevel: m })}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  hub.settings.motionLevel === m ? "bg-teal-500 text-white" : "bg-transparent hover:bg-muted",
                )}
              >
                {m === "full" ? "كامل" : m === "reduced" ? "مخفف" : "إيقاف"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/60">
        <CardContent className="flex items-center gap-4 p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">المظهر</p>
            <p className="text-xs text-muted-foreground">{isDark ? "الوضع الداكن مفعّل" : "الوضع الفاتح مفعّل"}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={() => {
              const next = !isDark;
              toggle();
              void save({ ...hub.settings, theme: next ? "dark" : "light" });
            }}
          >
            تبديل
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  desc,
  checked,
  onChecked,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
}) {
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="flex items-center gap-4 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onChecked} />
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   التحليلات الشخصية
   ═══════════════════════════════════════════════════════════════════ */
function AnalyticsTab() {
  const data = useQuery(api.progression.getAnalytics);
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  const { trend, categories, difficulties, totals, insights, player } = data;
  const maxXp = Math.max(1, ...trend.map((d) => d.xp));

  const barTint = (acc: number) =>
    acc >= 75
      ? "[&>div]:bg-emerald-500"
      : acc >= 50
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-rose-500";
  const accuracyText = (acc: number) =>
    acc >= 75
      ? "text-emerald-600 dark:text-emerald-300"
      : acc >= 50
        ? "text-amber-600 dark:text-amber-300"
        : "text-rose-600 dark:text-rose-300";

  const shareSummary = async () => {
    const text = [
      `🧠 بطاقة أدائي في حرب العقول — ${player.name}`,
      `المستوى ${player.level} • ${player.xp.toLocaleString("en")} XP`,
      `الجولات ${totals.games} • الانتصارات ${totals.wins} • الدقة ${totals.accuracy}%`,
      `خلال آخر 7 أيام: ${totals.trendGames} جولة • ${totals.trendCorrect} إجابة صحيحة • ${totals.trendXp} XP`,
      data.insights[0] ? `💡 ${data.insights[0]}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("نُسخت بطاقة أدائك — ألصقها في أي محادثة 🎉");
    } catch {
      toast.error("تعذّر النسخ — حاول مرة أخرى");
    }
  };

  return (
    <div className="space-y-6">
      {/* مؤشرات سريعة */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="جولات آخر 7 أيام" value={totals.trendGames} icon={Gamepad2} tint="bg-sky-500/10 text-sky-500" />
        <MiniStat label="إجابات صحيحة" value={totals.trendCorrect} icon={Target} tint="bg-emerald-500/10 text-emerald-500" />
        <MiniStat label="XP مكتسبة أسبوعياً" value={totals.trendXp} icon={Zap} tint="bg-amber-500/10 text-amber-500" />
        <MiniStat label="الدقة الإجمالية" value={`${totals.accuracy}%`} icon={TrendingUp} tint="bg-violet-500/10 text-violet-500" />
      </div>

      {/* منحنى الأسبوع */}
      <Card className="rounded-3xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300">
              <TrendingUp className="size-4" />
            </span>
            نشاطك خلال آخر 7 أيام
          </CardTitle>
          <CardDescription>عدد الجولات و XP المكتسبة لكل يوم — الأعمدة تمتد حسب يومك الأقوى</CardDescription>
        </CardHeader>
        <CardContent>
          {totals.trendGames === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Gamepad2 className="size-7 opacity-40" />
              لا توجد جولات هذا الأسبوع بعد — العب الآن ليمتلئ مخططك 🎮
            </div>
          ) : (
            <div className="grid grid-cols-7 items-end gap-2">
              {trend.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {d.games > 0 ? `${d.xp.toLocaleString("en")}xp` : "—"}
                  </span>
                  <div className="flex h-24 w-full items-end justify-center rounded-lg bg-muted/50">
                    <div
                      className={cn(
                        "w-3/5 rounded-t-md bg-gradient-to-t from-teal-500 to-cyan-400 transition-all",
                        d.games === 0 && "h-1 rounded-full from-muted to-muted opacity-30",
                      )}
                      style={{ height: d.games === 0 ? undefined : `${Math.max(6, (d.xp / maxXp) * 88)}%` }}
                      title={`${d.xp} XP`}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-foreground">{Number(d.day.slice(8))}</span>
                  <span className="text-[10px] text-muted-foreground">{d.games} جولة</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* إتقان التصنيفات */}
        <Card className="rounded-3xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                <Target className="size-4" />
              </span>
              إتقانك حسب التصنيف
            </CardTitle>
            <CardDescription>دقة إجاباتك في كل فئة — كلما أجبت أكثر أصبح التقييم أدق</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                أجب عن أسئلة من فئات مختلفة لتظهر خريطة إتقانك هنا 🗺️
              </p>
            ) : (
              categories.slice(0, 8).map((c) => (
                <div key={c.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                      <span className="truncate">{c.key}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">({c.correct}/{c.total})</span>
                    </span>
                    <span className={cn("shrink-0 font-black", accuracyText(c.accuracy))}>{c.accuracy}%</span>
                  </div>
                  <Progress value={c.accuracy} className={cn("h-2 rounded-full bg-muted", barTint(c.accuracy))} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* الصعوبة + الرؤى */}
        <div className="space-y-5">
          <Card className="rounded-3xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                  <TrendingUp className="size-4" />
                </span>
                الأداء حسب الصعوبة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {difficulties.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">لا توجد بيانات بعد</p>
              ) : (
                difficulties.map((d) => (
                  <div key={d.key} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs font-semibold">{DIFFICULTY_LABELS[d.key] ?? d.key}</span>
                    <Progress value={d.accuracy} className={cn("h-2.5 flex-1 rounded-full bg-muted", barTint(d.accuracy))} />
                    <span className={cn("w-12 shrink-0 text-left text-xs font-black", accuracyText(d.accuracy))}>
                      {d.accuracy}%
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-teal-500/20 bg-gradient-to-br from-teal-500/5 via-card to-cyan-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300">
                  <Sparkles className="size-4" />
                </span>
                رؤى ذكية لك
              </CardTitle>
              <CardDescription>ملاحظات مولّدة من أدائك الفعلي لمساعدتك على التطور</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {insights.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  العب بضع جولات أولاً ثم عد لرؤية توصياتك 🧠
                </p>
              ) : (
                insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-card p-3 text-[13px] leading-relaxed">
                    <span className="mt-0.5 shrink-0">💡</span>
                    {ins}
                  </div>
                ))
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-1 w-full rounded-full"
                onClick={shareSummary}
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
                {copied ? "تم النسخ ✓" : "نسخ بطاقة الأداء ومشاركتها"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", tint)}>
            <Icon className="size-4" />
          </span>
          <span className="text-lg font-black leading-none">{typeof value === "number" ? value.toLocaleString("en") : value}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   الصفحة
   ═══════════════════════════════════════════════════════════════════ */
export default function Hub() {
  const [active, setActive] = useState<TabId>("overview");
  const hub = useQuery(api.progression.getHub);
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate("/play")}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-bold transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
            اللعبة
          </button>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20">
              <Award className="size-5" />
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-black leading-tight">مركز التقدم</p>
              <p className="text-[10px] text-muted-foreground">مهام · معالم · ألقاب · دعوات</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActive("settings")}
              className="flex size-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
              title="الإعدادات"
            >
              <Settings className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="flex size-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
              title="تبديل المظهر"
            >
              {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </div>

        {/* التبويبات */}
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors",
                  active === tab.id
                    ? "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
                {tab.id === "quests" && hub && hub.claimableCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">
                    {hub.claimableCount}
                  </span>
                )}
                {active === tab.id && (
                  <motion.span
                    layoutId="hub-tab-pill"
                    className="absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {active === "overview" && <OverviewTab onGoTo={setActive} />}
            {active === "analytics" && <AnalyticsTab />}
            {active === "quests" && <QuestsTab />}
            {active === "milestones" && <MilestonesTab />}
            {active === "titles" && <TitlesTab />}
            {active === "favorites" && <FavoritesTab />}
            {active === "referral" && <ReferralTab />}
            {active === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
