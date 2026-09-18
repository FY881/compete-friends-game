import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Coins,
  Crown,
  Gift,
  Handshake,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Ticket,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

/** شكل بيانات النظرة العامة — مشتق من دالة الخادم حتى لا يتباعد النوعان. */
type OverviewData = FunctionReturnType<typeof api.entitlements.getEntitlements>;

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏅 صفحة العضويات 3.0
 * ═══════════════════════════════════════════════════════════════════════
 * ستة أقسام حقيقية: نظرة عامة · المقارنة · المتجر · العروض · المشاركة ·
 * المهام — وكلها مربوطة بمحرك الاستحقاقات الموحّد في الخادم.
 */

type TabId = "overview" | "matrix" | "store" | "offers" | "share" | "quests";

const TABS: { id: TabId; label: string; icon: typeof Crown }[] = [
  { id: "overview", label: "نظرتي", icon: Crown },
  { id: "matrix", label: "المقارنة", icon: TrendingUp },
  { id: "store", label: "المتجر", icon: Coins },
  { id: "offers", label: "العروض", icon: Ticket },
  { id: "share", label: "المشاركة", icon: Handshake },
  { id: "quests", label: "المهام", icon: Target },
];

// ═══════════════════════════════════════════════════════════════════════
// 📋 تعريف صفوف المميزات — تُعرض في «نظرتي» وفي «المقارنة» معاً
// ═══════════════════════════════════════════════════════════════════════

const LIMIT = (v: unknown) => (v === -1 ? "بلا حد" : typeof v === "number" ? String(v) : "—");
const MULT = (v: unknown) => (typeof v === "number" ? `${v}×` : "—");
const PCT = (v: unknown) => (typeof v === "number" ? (v > 0 ? `+${v}%` : `${v}%`) : "—");
const YES = (v: unknown) => (v === true ? "✓" : "✗");
const TXT = (v: unknown) => (v == null ? "—" : String(v));

const FEATURE_ROWS: {
  key: string;
  label: string;
  fmt: (v: unknown) => string;
  group: string;
}[] = [
  { key: "xpMultiplier", label: "مضاعف الخبرة", fmt: MULT, group: "المكافآت" },
  { key: "loyaltyMultiplier", label: "مضاعف نقاط الولاء", fmt: MULT, group: "المكافآت" },
  { key: "coinBonusPct", label: "مكافأة العملات", fmt: PCT, group: "المكافآت" },
  { key: "offlineArenaBonusPct", label: "مكافأة ساحة الأوفلاين", fmt: PCT, group: "المكافآت" },
  { key: "seasonPassXpBoostPct", label: "تسريع جواز الموسم", fmt: PCT, group: "المكافآت" },

  { key: "dailyChallenges", label: "تحديات يومية", fmt: LIMIT, group: "الحصص اليومية" },
  { key: "hintQuotaDaily", label: "تلميحات يومية", fmt: LIMIT, group: "الحصص اليومية" },
  { key: "dailyGiftQuota", label: "هدايا يومية", fmt: LIMIT, group: "الحصص اليومية" },
  { key: "monthlyGiftQuota", label: "هدايا شهرياً", fmt: LIMIT, group: "الحصص اليومية" },
  { key: "exclusiveChallengeCount", label: "تحديات حصرية", fmt: LIMIT, group: "الحصص اليومية" },

  { key: "privateRooms", label: "غرف خاصة", fmt: LIMIT, group: "المساحات" },
  { key: "chatRoomLimit", label: "غرف دردشة", fmt: LIMIT, group: "المساحات" },
  { key: "squadCreate", label: "إنشاء فرقة فكرية", fmt: YES, group: "المساحات" },
  { key: "squadSlots", label: "مقاعد الفرقة", fmt: LIMIT, group: "المساحات" },
  { key: "squadManage", label: "إدارة الفرقة كاملة", fmt: YES, group: "المساحات" },
  { key: "perkShareSlots", label: "مقاعد مشاركة الامتياز", fmt: LIMIT, group: "المساحات" },
  { key: "maxActiveDevices", label: "أجهزة متزامنة", fmt: LIMIT, group: "المساحات" },

  { key: "questionTierAccess", label: "فئة الأسئلة", fmt: TXT, group: "المحتوى" },
  { key: "aiDepth", label: "عمق الذكاء المساعد", fmt: LIMIT, group: "المحتوى" },
  { key: "earlyEventAccess", label: "وصول مبكر للأحداث", fmt: YES, group: "المحتوى" },
  { key: "tournamentPriority", label: "أولوية البطولات", fmt: LIMIT, group: "المحتوى" },
  { key: "analyticsDepth", label: "عمق تحليلات الأداء", fmt: TXT, group: "المحتوى" },

  { key: "profileCustomization", label: "تخصيص الملف", fmt: TXT, group: "الهوية" },
  { key: "visualEffects", label: "المؤثرات البصرية", fmt: TXT, group: "الهوية" },
  { key: "badgeStyle", label: "نمط الشارة", fmt: TXT, group: "الهوية" },
  { key: "frameStyle", label: "نمط الإطار", fmt: TXT, group: "الهوية" },
  { key: "soundPack", label: "حزمة صوتية", fmt: TXT, group: "الهوية" },
  { key: "customTitle", label: "لقب مخصّص", fmt: YES, group: "الهوية" },

  { key: "support", label: "مستوى الدعم", fmt: TXT, group: "الخدمة" },
  { key: "trialDays", label: "أيام تجربة متاحة", fmt: LIMIT, group: "الخدمة" },
  { key: "storeDiscountPct", label: "خصم المتجر", fmt: PCT, group: "الخدمة" },
  { key: "questSlotsBonus", label: "مهام إضافية", fmt: LIMIT, group: "الخدمة" },
  { key: "boostExtendPct", label: "تمديد مجاني للترقيات", fmt: PCT, group: "الخدمة" },
];

const GROUPS = [...new Set(FEATURE_ROWS.map((r) => r.group))];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function relative(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return "منتهية";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} ساعة`;
  return `${Math.floor(hours / 24)} يوم`;
}

// ═══════════════════════════════════════════════════════════════════════

export default function Membership() {
  const [tab, setTab] = useState<TabId>("overview");
  const entitlements = useQuery(api.entitlements.getEntitlements);

  if (entitlements === undefined) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {!entitlements.isSignedIn && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Lock className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            أنت تستعرض كمستوى <span className="font-bold text-foreground">برونزي</span>. سجّل الدخول
            لشراء العضويات، واستبدال القسائم، والمشاركة مع أصدقائك.
          </p>
          <Button size="sm" className="gap-1.5 rounded-xl" asChild>
            <Link to="/auth?returnTo=%2Fmembership">
              تسجيل الدخول
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* ── شريط التبويبات ── */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview data={entitlements} />}
      {tab === "matrix" && <Matrix currentTier={entitlements.tier} />}
      {tab === "store" && <Store />}
      {tab === "offers" && <Offers />}
      {tab === "share" && <Share />}
      {tab === "quests" && <Quests />}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" className="size-9" asChild>
            <Link to="/play" aria-label="رجوع">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">مركز العضويات</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              ٥ مستويات · ٣٢ امتيازاً حقيقياً · اقتصاد بنقاط الولاء بلا مال حقيقي
            </p>
          </div>
          <Badge variant="outline" className="gap-1 rounded-full text-[10px]">
            <Sparkles className="size-3" />
            نسخة 3.0
          </Badge>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 1) نظرة عامة
// ═══════════════════════════════════════════════════════════════════════

function Overview({ data }: { data: OverviewData }) {
  const grouped = useMemo(
    () => GROUPS.map((g) => ({ group: g, rows: FEATURE_ROWS.filter((r) => r.group === g) })),
    [],
  );

  return (
    <div className="space-y-5">
      {/* بطاقة المستوى */}
      <Card className={cn("overflow-hidden border-2 shadow-sm")}>
        <div className={cn("bg-gradient-to-br p-6", tierGradient(data.tierMeta.emoji))}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-3xl shadow-sm">
              {data.tierMeta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black">عضوية {data.tierMeta.name}</h2>
                {data.fromBoost && (
                  <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-400">
                    من ترقية مؤقتة
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.tierMeta.tagline}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {data.tierMeta.description}
              </p>
            </div>
            <div className="text-end">
              {data.daysRemaining !== null ? (
                <>
                  <p className="text-[11px] text-muted-foreground">تنتهي بعد</p>
                  <p className="text-2xl font-black tabular-nums">{data.daysRemaining}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.expiresAt ? fmtDate(data.expiresAt) : ""}
                  </p>
                </>
              ) : (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {data.tier === "bronze" ? "المستوى الأساسي" : "دائمة"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {data.fromBoost && (
          <CardContent className="border-t border-border/60 p-4">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              مستواك المدفوع هو {data.paidTierMeta.emoji} {data.paidTierMeta.name} — والترقيات
              المؤقتة أدناه ترفعك فوقه مؤقتاً. بعد انتهائها تعود تلقائياً لمستواك المدفوع.
            </p>
          </CardContent>
        )}
      </Card>

      {/* الترقيات المؤقتة النشطة */}
      {data.boosts.length > 0 && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="size-4 text-amber-500" />
              ترقيات مؤقتة نشطة ({data.boosts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {data.boosts.map((b) => (
              <div
                key={b._id}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <Zap className="size-3.5 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{b.label}</span>
                <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                  {relative(b.expiresAt)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* المسار للمستوى التالي */}
      {data.nextTier && data.progress && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="size-4 text-primary" />
              الطريق إلى {data.nextTierMeta?.emoji} {data.nextTierMeta?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              اطلب من المالك، أو اربح نقاط ولاء واشترِ الترقية، أو استبدل قسيمة، أو أكمل مهام
              العضوية لتحصل على دفعة مؤقتة. كل الطرق مفتوحة.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="جولات لعبتها" value={data.progress.gamesPlayed} />
              <MiniStat label="جولات ربحتها" value={data.progress.gamesWon} />
              <MiniStat label="إجابات صحيحة" value={data.progress.correctAnswers} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* امتيازاتك الحالية */}
      <div className="space-y-4">
        {grouped.map(({ group, rows }) => (
          <Card key={group} className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{group}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => {
                const raw = (data.entitlements as unknown as Record<string, unknown>)[r.key];
                const next = (
                  data.nextTierEntitlements as unknown as Record<string, unknown> | null
                )?.[r.key];
                const improved = next !== undefined && String(next) !== String(raw);
                return (
                  <div
                    key={r.key}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {r.label}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-xs font-bold tabular-nums">{r.fmt(raw)}</span>
                      {improved && (
                        <BadgeCheck className="size-3.5 text-primary" aria-label="يتحسّن في المستوى التالي" />
                      )}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-black tabular-nums">{value.toLocaleString("ar-EG")}</p>
    </div>
  );
}

/** تدرّج لوني حسب المستوى (يُقرأ من الرمز التعبيري لتجنّب تمرير ألوان خام). */
function tierGradient(emoji: string): string {
  switch (emoji) {
    case "🥈":
      return "from-slate-500/15 to-slate-700/5";
    case "🥇":
      return "from-amber-500/15 to-yellow-600/5";
    case "💎":
      return "from-blue-500/15 to-cyan-500/5";
    case "👑":
      return "from-violet-500/15 to-fuchsia-500/5";
    default:
      return "from-amber-700/10 to-amber-900/5";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 2) مصفوفة المقارنة
// ═══════════════════════════════════════════════════════════════════════

function Matrix({ currentTier }: { currentTier: string }) {
  const matrix = useQuery(api.entitlements.getTierMatrix);

  if (matrix === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">مقارنة المستويات — ٣٢ امتيازاً</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          «بلا حد» تعني لا سقف على الإطلاق. عمودك الحالي مُظلَّل.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="sticky start-0 z-10 bg-muted/40 px-3 py-2.5 text-start font-bold">
                الامتياز
              </th>
              {matrix.tiers.map((t) => (
                <th
                  key={t.tier}
                  className={cn(
                    "px-3 py-2.5 text-center font-bold",
                    t.tier === currentTier && "bg-primary/10 text-primary",
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-base">{t.meta.emoji}</span>
                    <span>{t.meta.name}</span>
                    {t.tier === currentTier && (
                      <span className="text-[9px] font-semibold">مستواك</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group}>
                <tr className="bg-muted/20">
                  <td
                    colSpan={matrix.tiers.length + 1}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {group}
                  </td>
                </tr>
                {FEATURE_ROWS.filter((r) => r.group === group).map((r) => (
                  <tr key={r.key} className="border-b border-border/40 last:border-0">
                    <td className="sticky start-0 z-10 bg-card px-3 py-2 text-start text-muted-foreground">
                      {r.label}
                    </td>
                    {matrix.tiers.map((t) => {
                      const value = r.fmt(
                        (t.entitlements as unknown as Record<string, unknown>)[r.key],
                      );
                      const isYes = value === "✓";
                      const isNo = value === "✗";
                      return (
                        <td
                          key={t.tier}
                          className={cn(
                            "px-3 py-2 text-center font-semibold tabular-nums",
                            t.tier === currentTier && "bg-primary/5",
                            isYes && "text-emerald-600 dark:text-emerald-400",
                            isNo && "text-muted-foreground/50",
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3) المتجر
// ═══════════════════════════════════════════════════════════════════════

type BuyTier = "silver" | "gold" | "diamond" | "exclusive";
type BuyDays = 7 | 30 | 90;

function Store() {
  const listing = useQuery(api.membershipStore.getStoreListing);
  const buy = useMutation(api.membershipStore.buyTierDays);
  const [busy, setBusy] = useState<string | null>(null);

  if (listing === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const purchase = async (tier: BuyTier, days: BuyDays) => {
    setBusy(`${tier}-${days}`);
    try {
      const res = await buy({ tier, days });
      toast.success(res.detail, {
        description: `بقيت ${res.balanceAfter.toLocaleString("ar-EG")} نقطة ولاء`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إتمام الشراء");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <Coins className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">رصيدك من نقاط الولاء</p>
            <p className="text-2xl font-black tabular-nums">
              {listing.points.toLocaleString("ar-EG")}
            </p>
          </div>
          {listing.discountPct > 0 && (
            <Badge className="gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3" />
              خصم {listing.discountPct}% لمستواك
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {listing.offers.map((offer) => (
          <Card key={offer.tier} className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="text-lg">{offer.meta.emoji}</span>
                {offer.meta.name}
                {offer.owned && (
                  <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
                    مملوكة
                  </Badge>
                )}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">{offer.meta.description}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {offer.prices.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  disabled={offer.belowOwned || !p.affordable || busy !== null}
                  onClick={() => void purchase(offer.tier as BuyTier, p.days as BuyDays)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition-all",
                    offer.belowOwned
                      ? "cursor-not-allowed border-dashed border-border/60 bg-muted/20 opacity-50"
                      : p.affordable
                        ? "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40"
                        : "cursor-not-allowed border-border/50 bg-muted/20 opacity-60",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                    {p.days}ي
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">{p.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {p.perDay} نقطة / يوم
                      {p.discount > 0 && ` · وفّرت ${p.discount}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block text-sm font-black tabular-nums">
                      {p.final.toLocaleString("ar-EG")}
                    </span>
                    {p.discount > 0 && (
                      <span className="block text-[10px] text-muted-foreground line-through">
                        {p.base.toLocaleString("ar-EG")}
                      </span>
                    )}
                  </span>
                  {busy === `${offer.tier}-${p.days}` && (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  )}
                </button>
              ))}
              {offer.belowOwned && (
                <p className="text-[10px] text-muted-foreground">
                  مستواك الحالي أعلى — لن تدفع مقابل ميزات أقل.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <Coins className="mt-0.5 size-3.5 shrink-0 text-primary" />
        كل الأسعار بنقاط الولاء التي تكسبها من اللعب — لا مال حقيقي ولا بطاقات. الشراء يُرقّي
        عضويتك فوراً، والتمديد يُضاف إلى ما تبقّى لك.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4) العروض (قسائم + تجارب)
// ═══════════════════════════════════════════════════════════════════════

function Offers() {
  const trials = useQuery(api.membershipOffers.getTrialStatus);
  const redeem = useMutation(api.membershipOffers.redeemPromo);
  const startTrial = useMutation(api.membershipOffers.startTrial);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCode = async () => {
    if (!code.trim()) {
      toast.error("أدخل كود القسيمة");
      return;
    }
    setBusy(true);
    try {
      const res = await redeem({ code: code.trim() });
      toast.success(res.message, {
        description: `تنتهي في ${fmtDate(res.expiresAt)} · بقي ${res.remainingUses} استخدام للجميع`,
      });
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر استبدال القسيمة");
    } finally {
      setBusy(false);
    }
  };

  const begin = async (tier: "silver" | "gold" | "diamond" | "exclusive") => {
    setBusy(true);
    try {
      const res = await startTrial({ tier });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر بدء التجربة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Ticket className="size-4 text-primary" />
            استبدال قسيمة ترويجية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="مثال: MIND-GOLD-2026"
              dir="ltr"
              className="h-11 flex-1 rounded-xl text-center font-mono tracking-widest"
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCode();
              }}
            />
            <Button className="h-11 gap-1.5 rounded-xl" disabled={busy} onClick={() => void submitCode()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}
              استبدال
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            كل قسيمة لها سقف استخدام عام، وسقف لكل لاعب، وقد يكون لها حدّ زمني ونطاق مستويات.
            إن كنت في مستوى أعلى من مكافأة القسيمة، تُمدَّد عضويتك الحالية بدلاً من إهدارها.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gift className="size-4 text-primary" />
            التجربة المجانية
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            كل مستوى يُجرَّب مرة واحدة في عمر الحساب — بعد نشاط حقيقي.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {trials === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !trials.isSignedIn ? (
            <p className="text-xs text-muted-foreground">سجّل الدخول لعرض التجارب المتاحة.</p>
          ) : (
            <>
              {!trials.eligible && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <Target className="size-3.5 shrink-0 text-amber-600" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    العب {Math.max(0, (trials.minGames ?? 5) - (trials.gamesPlayed ?? 0))} جولات
                    إضافية لفتح التجارب (لديك {trials.gamesPlayed} من {trials.minGames}).
                  </p>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {(trials.available ?? []).map((t) => (
                  <div
                    key={t.tier}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3.5 py-3",
                      t.usable ? "border-border/70 bg-card" : "border-dashed border-border/60 bg-muted/20 opacity-70",
                    )}
                  >
                    <span className="text-xl">{t.meta.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold">{t.meta.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {t.usable ? `${t.days} أيام مجاناً` : (t.blockedReason ?? "غير متاحة")}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={t.usable ? "default" : "outline"}
                      className="shrink-0 rounded-lg text-[11px]"
                      disabled={!t.usable || busy}
                      onClick={() => void begin(t.tier as "gold")}
                    >
                      ابدأ
                    </Button>
                  </div>
                ))}
                {(trials.available ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    لا توجد تجارب متاحة — إما استخدمتها، أو مستواك الحالي يساويها أو يفوقها.
                  </p>
                )}
              </div>
              {(trials.used ?? []).length > 0 && (
                <div className="space-y-1.5 border-t border-border/60 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    تجارب سابقة
                  </p>
                  {(trials.used ?? []).map((u) => (
                    <div key={`${u.tier}-${u.startedAt}`} className="flex items-center gap-2 text-[11px]">
                      <Check className="size-3 text-muted-foreground" />
                      <span className="flex-1 text-muted-foreground">
                        تجربة {u.tier} — {fmtDate(u.startedAt)}
                      </span>
                      <Badge variant="outline" className="rounded-full text-[9px]">
                        {u.expired ? "انتهت" : "نشطة"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 5) المشاركة
// ═══════════════════════════════════════════════════════════════════════

function Share() {
  const mine = useQuery(api.membershipSocial.getMyShares);
  const incoming = useQuery(api.membershipSocial.getSharedWithMe);
  const share = useMutation(api.membershipSocial.shareWithName);
  const revoke = useMutation(api.membershipSocial.revokeShare);

  const [name, setName] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("أدخل اسم اللاعب");
      return;
    }
    setBusy(true);
    try {
      const res = await share({ beneficiaryName: name.trim(), days });
      toast.success(res.message, { description: `بقي ${res.remainingSlots} مقعد` });
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّرت المشاركة");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (shareId: string) => {
    setBusy(true);
    try {
      const res = await revoke({ shareId: shareId as never });
      toast.success(`سُحبت المشاركة من ${res.beneficiaryName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر السحب");
    } finally {
      setBusy(false);
    }
  };

  if (mine === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600">
            <Users className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">مقاعد المشاركة</p>
            <p className="text-2xl font-black tabular-nums">
              {mine.used} / {mine.slots === -1 ? "∞" : mine.slots}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px]">
            الذهبي 1 · الماسي 2 · الأسطوري 5
          </Badge>
        </CardContent>
        {mine.slots > 0 && (
          <Progress
            value={mine.slots === -1 ? 0 : Math.min(100, (mine.used / mine.slots) * 100)}
            className="mx-5 mb-5 h-1.5"
          />
        )}
      </Card>

      {mine.canShare ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Handshake className="size-4 text-primary" />
              ارفع صديقاً إلى مستوى {mine.shareTier}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              يمنح صديقك كل امتيازات مستواك مؤقتاً — وتُسحب فوراً إن ألغيت المقعد.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم اللاعب بالضبط"
                className="h-11 min-w-48 flex-1 rounded-xl"
              />
              <div className="flex gap-1.5">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={cn(
                      "rounded-xl border px-3 text-[11px] font-bold transition-colors",
                      days === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d} يوم
                  </button>
                ))}
              </div>
              <Button className="h-11 gap-1.5 rounded-xl" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
                امنح المقعد
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            مشاركة الامتيازات تبدأ من المستوى الفضي. الفضي لا يمنح مقاعد، الذهبي يمنح مقعداً واحداً،
            الماسي مقعدين، والأسطوري خمسة.
          </p>
        </div>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">من يستفيد من مقاعدك</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mine.shares.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              لم تشارك امتيازك مع أحد بعد.
            </p>
          ) : (
            mine.shares.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                  {s.beneficiaryName.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{s.beneficiaryName}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {s.tier} · تبقى {relative(s.expiresAt)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-lg text-[11px]"
                  disabled={busy}
                  onClick={() => void drop(s.id)}
                >
                  سحب
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {(incoming ?? []).length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-emerald-600" />
              متلقّى إليك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(incoming ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="font-bold">{s.ownerName}</span>
                <span className="text-muted-foreground">رفعك إلى {s.tier}</span>
                <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
                  تبقى {relative(s.expiresAt)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 6) المهام
// ═══════════════════════════════════════════════════════════════════════

function Quests() {
  const data = useQuery(api.membershipSocial.getMembershipQuests);
  const claim = useMutation(api.membershipSocial.claimMembershipQuest);
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data.isSignedIn) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          سجّل الدخول لعرض مهام العضوية.
        </CardContent>
      </Card>
    );
  }

  const take = async (questId: string) => {
    setBusy(questId);
    try {
      const res = await claim({ questId });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الاستلام");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">المهام المفتوحة لمستواك</p>
            <p className="text-2xl font-black tabular-nums">
              {data.unlocked} / {data.total}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px]">
            ارفع عضويتك لفتح المزيد
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.quests.map((q) => (
          <Card
            key={q.id}
            className={cn(
              "shadow-sm",
              q.claimed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : q.claimable
                  ? "border-primary/40 bg-primary/5"
                  : !q.unlocked
                    ? "border-dashed border-border/60 bg-muted/20 opacity-70"
                    : "border-border/70",
            )}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm",
                    q.claimed
                      ? "bg-emerald-500/15 text-emerald-600"
                      : !q.unlocked
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary",
                  )}
                >
                  {q.claimed ? <Check className="size-4" /> : !q.unlocked ? <Lock className="size-4" /> : <Target className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{q.title}</p>
                  <p className="text-[11px] text-muted-foreground">{q.description}</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                  {q.rewardHours}س {q.rewardTier}
                </Badge>
              </div>

              <div className="space-y-1">
                <Progress value={q.percent} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="tabular-nums">
                    {q.value.toLocaleString("ar-EG")} / {q.target.toLocaleString("ar-EG")}
                  </span>
                  <span>{q.percent}%</span>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full gap-1.5 rounded-xl text-[11px]"
                variant={q.claimable ? "default" : "outline"}
                disabled={!q.claimable || busy === q.id}
                onClick={() => void take(q.id)}
              >
                {busy === q.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : q.claimed ? (
                  <Check className="size-3.5" />
                ) : (
                  <Gift className="size-3.5" />
                )}
                {q.claimed ? "تم الاستلام" : q.claimable ? "استلم المكافأة" : q.unlocked ? "لم تكتمل" : "مقفلة"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
        مكافآت المهام ترقيات مؤقتة حقيقية تُضاف لترقياتك النشطة وتُدمج تلقائياً بأعلى مستوى. عدد
        المهام المفتوحة ينمو مع عضويتك.
      </p>
    </div>
  );
}

function Check(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...props}>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
