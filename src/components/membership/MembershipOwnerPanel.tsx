import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  Coins,
  Crown,
  Gem,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  UserX,
  Users,
  Wand2,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 لوحة العضوية للمالك — مراقبة حقيقية وتحكم فعلي
 * ═══════════════════════════════════════════════════════════════════════
 * كل رقم مقروء فعلاً من قاعدة البيانات (بقراءات محدودة)، وكل زر هنا ينفّذ
 * تغييراً حقيقياً في عضوية لاعب أو رصيده أو فرقته أو خزنته — بلا محاكاة.
 */

const TIERS: { key: string; label: string }[] = [
  { key: "bronze", label: "برونزي" },
  { key: "silver", label: "فضي" },
  { key: "gold", label: "ذهبي" },
  { key: "diamond", label: "ماسي" },
  { key: "exclusive", label: "أسطوري" },
];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ icon: Icon, title, hint, children }: {
  icon: typeof Crown;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </CardTitle>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function MembershipOpsPanel() {
  const data = useQuery(api.membershipAnalytics.getMembershipAnalytics);
  const squads = useQuery(api.membershipSquad.getSquadLeaderboard);

  const revoke = useMutation(api.membershipAnalytics.ownerRevokeMembership);
  const adjustCredits = useMutation(api.membershipAnalytics.ownerAdjustCredits);
  const grantTier = useMutation(api.membershipAnalytics.ownerGrantTierDays);
  const grantOffer = useMutation(api.membershipRenewal.ownerGrantOffer);
  const grantFragments = useMutation(api.membershipVault.ownerGrantFragments);
  const blessVault = useMutation(api.membershipVault.ownerBlessVault);
  const grantSeats = useMutation(api.membershipSquad.ownerGrantSeats);
  const disbandSquad = useMutation(api.membershipSquad.ownerDisbandSquad);

  const [target, setTarget] = useState("");
  const [days, setDays] = useState("30");
  const [tier, setTier] = useState("gold");
  const [discount, setDiscount] = useState("20");
  const [fragments, setFragments] = useState("500");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    if (!target.trim()) {
      toast.error("اكتب اسم اللاعب أولاً");
      return;
    }
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  const num = (v: string, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  if (data === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (data === null) {
    return (
      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          لوحة العضوية متاحة للمالك فقط.
        </CardContent>
      </Card>
    );
  }

  const maxTier = Math.max(1, ...data.tiers.map((t) => t.count));

  return (
    <div className="space-y-4">
      {/* ── توزيع المستويات ── */}
      <Block
        icon={Crown}
        title="توزيع العضويات"
        hint={`مقروء من ${data.memberships.sampleSize} سجلاً · نشط ${data.memberships.active} · منتهٍ ${data.memberships.expired}`}
      >
        <div className="space-y-2">
          {data.tiers.map((t) => (
            <div key={t.tier} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold">
                  {t.emoji} {t.name}
                </span>
                <span className="tabular-nums text-muted-foreground">{t.count}</span>
              </div>
              <Progress value={(t.count / maxTier) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="دائمة" value={data.memberships.permanent} />
          <Stat label="تنتهي خلال أسبوع" value={data.memberships.expiringSoon} />
          <Stat label="تجديد تلقائي مُفعّل" value={data.renewal.autoRenewOn} />
          <Stat label="أيام مدّخرة" value={data.renewal.bankedDays} hint="رصيد اللاعبين الكلي" />
        </div>
      </Block>

      {/* ── الأنظمة الجديدة ── */}
      <Block icon={Users} title="الأنظمة الجديدة (٤.٠)" hint="فرق · رتب شرفية · تجديد · خزنة">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="فرق قائمة"
            value={data.squads.live}
            hint={`${data.squads.seatsActive}/${data.squads.seatsTotal} مقعداً (${data.squads.fillPercent}%)`}
          />
          <Stat label="طلبات مقاعد" value={data.squads.seatsPending} />
          <Stat
            label="رتب شرفية"
            value={data.prestige.tracked}
            hint={`متوسط ${data.prestige.avgPoints} نقطة · أعلى رتبة ${data.prestige.topLevel}`}
          />
          <Stat
            label="فتحات الخزنة"
            value={data.vault.opens}
            hint={`${data.vault.fragmentsOutstanding} فُتاتاً متبقياً`}
          />
          <Stat label="عروض تجديد مفتوحة" value={data.renewal.offersOpen} />
          <Stat label="عروض مستخدمة" value={data.renewal.offersUsed} />
          <Stat label="مشاركات امتياز نشطة" value={data.shares.active} />
          <Stat
            label="ترقيات مؤقتة نشطة"
            value={data.boosts.active}
            hint={Object.entries(data.boosts.bySource)
              .map(([k, v]) => `${k}:${v}`)
              .join(" · ") || "لا شيء"}
          />
        </div>
      </Block>

      {/* ── التجارب والقسائم والمهام ── */}
      <Block icon={BarChart3} title="التجارب والقسائم والمهام">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="تجارب جارية" value={data.trials.active} hint={`${data.trials.total} إجمالاً`} />
          <Stat label="قسائم" value={data.promos.total} hint={`${data.promos.redemptions} استبدالاً`} />
          <Stat label="مهام مستلمة" value={data.quests.totalClaims} />
        </div>
        {data.promos.top.length > 0 && (
          <div className="space-y-1.5">
            {data.promos.top.map((p) => (
              <div key={p.code} className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5">
                <span className="font-mono text-xs font-bold">{p.code}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {TIERS.find((t) => t.key === p.tier)?.label ?? p.tier}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                  {p.usedCount}/{p.maxUses} ({p.usedPercent}%)
                </span>
                {!p.active && (
                  <Badge variant="outline" className="rounded-full text-[10px] text-destructive">
                    موقوفة
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Block>

      {/* ── تحكم فعلي ── */}
      <Block
        icon={Wand2}
        title="تحكم عضوية لاعب"
        hint="كل زر هنا يغيّر حالة اللاعب فعلياً ويُسجَّل في سجل الأحداث"
      >
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="اسم اللاعب بالضبط كما يظهر"
          className="h-10 rounded-xl"
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">أيام</span>
            <Input value={days} onChange={(e) => setDays(e.target.value)} className="h-9 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">خصم%</span>
            <Input value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">فُتات</span>
            <Input value={fragments} onChange={(e) => setFragments(e.target.value)} className="h-9 rounded-xl" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TIERS.slice(1).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTier(t.key)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors",
                tier === t.key ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-muted/30",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() =>
              run(
                "grant",
                () => grantTier({ userName: target, tier: tier as "gold", days: num(days, 30) }),
                "مُنحت العضوية وسُجّلت",
              )
            }
          >
            {busy === "grant" ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
            امنح {days} يوماً
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() =>
              run(
                "offer",
                () =>
                  grantOffer({
                    userName: target,
                    tier: tier as "gold",
                    days: num(days, 30),
                    discountPct: num(discount, 20),
                  }),
                "أُرسل العرض للاعب",
              )
            }
          >
            {busy === "offer" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            أرسل عرض خصم {discount}%
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() =>
              run("credits", () => adjustCredits({ userName: target, days: num(days, 30) }), "عُدّل الرصيد المدّخر")
            }
          >
            {busy === "credits" ? <Loader2 className="size-3.5 animate-spin" /> : <Coins className="size-3.5" />}
            امنح {days} يوماً مدّخراً
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() =>
              run("credits-", () => adjustCredits({ userName: target, days: -num(days, 30) }), "سُحب الرصيد المدّخر")
            }
          >
            {busy === "credits-" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            اسحب {days} يوماً مدّخراً
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() =>
              run("frag", () => grantFragments({ userName: target, amount: num(fragments, 500) }), "مُنحت الفُتات")
            }
          >
            {busy === "frag" ? <Loader2 className="size-3.5 animate-spin" /> : <Gem className="size-3.5" />}
            امنح {fragments} فُتاتاً
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px]"
            disabled={busy !== null}
            onClick={() => run("bless", () => blessVault({ userName: target }), "الفتحة القادمة أسطورية مضمونة")}
          >
            {busy === "bless" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
            بارك الخزنة (أسطوري مضمون)
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-xl text-[11px] text-destructive"
            disabled={busy !== null}
            onClick={() => run("revoke", () => revoke({ userName: target, reason: "قرار المالك" }), "أُنهيت العضوية")}
          >
            {busy === "revoke" ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
            أنهِ العضوية فوراً
          </Button>
        </div>
      </Block>

      {/* ── إدارة الفرق ── */}
      <Block icon={Shield} title="إدارة فرق الأعضاء" hint="رفع المقاعد أو حلّ الفرقة إدارياً">
        {squads && squads.squads.length > 0 ? (
          <div className="space-y-2">
            {squads.squads.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <span className="text-lg">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{s.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    القائد {s.leaderName} · {s.seats}/{s.seatsTotal}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg px-2 text-[10px]"
                  disabled={busy !== null}
                  onClick={() =>
                    void (async () => {
                      setBusy(`seats-${s.id}`);
                      try {
                        await grantSeats({ squadId: s.id, seatsTotal: s.seatsTotal + 10 });
                        toast.success(`رُفع سقف «${s.name}» عشرة مقاعد`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذّر التنفيذ");
                      } finally {
                        setBusy(null);
                      }
                    })()
                  }
                >
                  +10 مقاعد
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-lg px-2 text-[10px] text-destructive"
                  disabled={busy !== null}
                  onClick={() =>
                    void (async () => {
                      setBusy(`dis-${s.id}`);
                      try {
                        await disbandSquad({ squadId: s.id });
                        toast.success(`حُلّت «${s.name}» وأُلغيت منح أعضائها`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "تعذّر التنفيذ");
                      } finally {
                        setBusy(null);
                      }
                    })()
                  }
                >
                  حلّ
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">لا توجد فرق قائمة بعد.</p>
        )}
      </Block>

      {/* ── آخر الأحداث ── */}
      <Block icon={TrendingUp} title="آخر أحداث العضوية" hint="سجل حقيقي لكل عملية على العضويات">
        <div className="space-y-1.5">
          {data.recentEvents.map((e) => (
            <div key={e.id} className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <Badge variant="outline" className="shrink-0 rounded-full text-[9px]">
                {e.kind}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold">{e.actor}</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{e.detail}</p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(e.at).toLocaleDateString("ar-EG")}
              </span>
            </div>
          ))}
          {data.recentEvents.length === 0 && (
            <p className="text-[11px] text-muted-foreground">لا أحداث بعد.</p>
          )}
        </div>
      </Block>
    </div>
  );
}
