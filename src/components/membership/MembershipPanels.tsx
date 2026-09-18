import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Check,
  Clock,
  Copy,
  Crown,
  Flame,
  Gem,
  Gift,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏅 العضويات 4.0 — لوحات الأنظمة الأربعة الجديدة
 * ═══════════════════════════════════════════════════════════════════════
 *  • فرقتي        — مقاعد حقيقية تمنح أعضاءها مستوى مشتقاً من القائد
 *  • الرتب الشرفية — مسار طويل الأمد بمكافآت **دائمة**
 *  • التجديد      — رصيد أيام + تجديد تلقائي + فترة سماح + عروض استرجاع
 *  • الخزنة       — فتح بنِسَب معلنة + نظام رحمة + تصنيع بالفُتات
 *
 * كل لوحة تعتمد على محرك الاستحقاقات نفسه، وكل زر هنا ينفّذ كتابة حقيقية.
 */

type BuyTier = "silver" | "gold" | "diamond" | "exclusive";
const asBuyTier = (t: string) => t as BuyTier;

// ── أدوات مشتركة ───────────────────────────────────────────────────────

/** يشغّل عملية خادم مرة واحدة كل 20 ساعة على الأكثر (بلا أي cron). */
function useDailySync(key: string, action: () => Promise<unknown>) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    try {
      const stamp = Number(window.localStorage.getItem(key) ?? 0);
      if (Date.now() - stamp < 20 * 60 * 60 * 1000) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      /* تخزين غير متاح — نُشغّل على أي حال */
    }
    void action().catch(() => {
      /* الخادم قد يكون معطلاً — الحارس الخلفي يتولى الحالة */
    });
  }, [key, action]);
}

function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Lock className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Crown; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold">{title}</h3>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}

const RARITY_STYLE: Record<string, string> = {
  common: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  rare: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  epic: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  legendary: "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

const RARITY_LABEL: Record<string, string> = {
  common: "عادي",
  rare: "نادر",
  epic: "ملحمي",
  legendary: "أسطوري",
};

// ═══════════════════════════════════════════════════════════════════════
// 🛡 1) فرقتي — المقاعد الجماعية
// ═══════════════════════════════════════════════════════════════════════

export function SquadPanel() {
  const data = useQuery(api.membershipSquad.getMySquad);
  const board = useQuery(api.membershipSquad.getSquadLeaderboard);
  const create = useMutation(api.membershipSquad.createSquad);
  const joinByCode = useMutation(api.membershipSquad.joinByCode);
  const requestJoin = useMutation(api.membershipSquad.requestJoin);
  const respond = useMutation(api.membershipSquad.respondRequest);
  const kick = useMutation(api.membershipSquad.kickMember);
  const leave = useMutation(api.membershipSquad.leaveSquad);
  const update = useMutation(api.membershipSquad.updateSquad);
  const disband = useMutation(api.membershipSquad.disbandSquad);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) return <Loading />;
  if (!data.isSignedIn) {
    return (
      <Gate>
        سجّل الدخول لإنشاء فرقة أو الانضمام إلى فرقة صديق — المقاعد تمنح مستوى <b>حقيقياً</b> مشتقاً
        من مستوى قائد الفرقة.
      </Gate>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("تم نسخ الكود");
    } catch {
      toast.error("تعذّر النسخ — انسخه يدوياً");
    }
  };

  const squad = data.squad;

  return (
    <div className="space-y-5">
      {squad ? (
        <Card className="overflow-hidden border-2">
          <CardHeader className="gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-2xl">{squad.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{squad.name}</span>
              <Badge variant="outline" className="rounded-full text-[10px]">
                قائد
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copy(squad.code)}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 font-mono text-sm font-bold tracking-widest transition-colors hover:bg-muted"
              >
                {squad.code}
                <Copy className="size-3.5 text-muted-foreground" />
              </button>
              <Badge variant="outline" className="rounded-full text-[10px]">
                مقاعد الأعضاء: مستوى {squad.seatTier === "diamond" ? "ماسي" : squad.seatTier === "gold" ? "ذهبي" : "فضي"}
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {squad.activeSeats} / {squad.seatsTotal} مشغول
              </Badge>
            </div>

            <div className="space-y-1">
              <Progress
                value={squad.seatsTotal > 0 ? (squad.activeSeats / squad.seatsTotal) * 100 : 0}
                className="h-1.5"
              />
              <p className="text-[11px] text-muted-foreground">
                {squad.seatsTotal - squad.activeSeats} مقعداً شاغراً · تُمنح الترقية تلقائياً حتى انتهاء
                عضويتك أو 30 يوماً
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={squad.open ? "default" : "outline"}
                className="gap-1.5 rounded-xl text-[11px]"
                disabled={busy !== null}
                onClick={() => void run("open", () => update({ open: !squad.open }), squad.open ? "الفرقة أُغلقت" : "الفرقة مفتوحة الآن")}
              >
                <Users className="size-3.5" />
                {squad.open ? "مفتوحة للانضمام" : "مغلقة"}
              </Button>
              <Button
                size="sm"
                variant={squad.autoAccept ? "default" : "outline"}
                className="gap-1.5 rounded-xl text-[11px]"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    "auto",
                    () => update({ autoAccept: !squad.autoAccept }),
                    squad.autoAccept ? "القبول صار يدوياً" : "القبول صار تلقائياً",
                  )
                }
              >
                <Zap className="size-3.5" />
                {squad.autoAccept ? "قبول تلقائي" : "قبول يدوي"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-xl text-[11px] text-destructive"
                disabled={busy !== null}
                onClick={() => void run("disband", () => disband({ confirm: "disband" }), "حُلّت الفرقة")}
              >
                حلّ الفرقة
              </Button>
            </div>

            {squad.pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground">
                  طلبات بالانتظار ({squad.pending.length})
                </p>
                {squad.pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl border border-border/70 bg-amber-500/5 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.userName}</span>
                    <Button
                      size="sm"
                      className="h-7 gap-1 rounded-lg px-2 text-[10px]"
                      disabled={busy !== null}
                      onClick={() => void run(`a-${p.id}`, () => respond({ seatId: p.id, accept: true }), "قُبل العضو ومنحناه المستوى")}
                    >
                      <Check className="size-3" />
                      قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg px-2 text-[10px]"
                      disabled={busy !== null}
                      onClick={() => void run(`r-${p.id}`, () => respond({ seatId: p.id, accept: false }), "رُفض الطلب")}
                    >
                      رفض
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                الأعضاء ({squad.seats.length})
              </p>
              {squad.seats.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{s.userName}</span>
                  {s.role === "leader" ? (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      القائد
                    </Badge>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" />
                        {s.remainingHours ? `${s.remainingHours}س` : "—"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-lg px-2 text-[10px] text-destructive"
                        disabled={busy !== null}
                        onClick={() => void run(`k-${s.id}`, () => kick({ seatId: s.id }), "أُزيل العضو وانتهت منحته")}
                      >
                        إزالة
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <Note>
              عند طرد أي عضو أو حلّ الفرقة أو انتهاء عضويتك، <b>تُلغى ترقيته فوراً</b> — المنح مرتبط
              مباشرة بمصدره لا يبقى معلّقاً.
            </Note>
          </CardContent>
        </Card>
      ) : data.mySeat ? (
        <Card className="border-2">
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Shield} title="أنت عضو في فرقة" hint={data.mySeat.squadName} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">القائد</p>
                <p className="truncate text-sm font-bold">{data.mySeat.leaderName}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">مستواك من المقعد</p>
                <p className="text-sm font-bold">
                  {data.mySeat.tier === "diamond" ? "💎 ماسي" : data.mySeat.tier === "gold" ? "🥇 ذهبي" : "🥈 فضي"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">متبقٍ</p>
                <p className="text-sm font-bold">{data.mySeat.remainingHours ?? "—"} ساعة</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl text-[11px] text-destructive"
              disabled={busy !== null}
              onClick={() => void run("leave", () => leave(), "خرجت من الفرقة")}
            >
              الخروج من الفرقة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardContent className="space-y-3 p-5">
            <SectionTitle
              icon={Shield}
              title="أنشئ فرقتك"
              hint={
                data.canCreate
                  ? `سقف مقاعدك: ${data.seatCap} — أعضاؤك يحصلون على مستوى درجة واحدة دون مستواك`
                  : "إنشاء الفرق متاح من المستوى الذهبي فأعلى"
              }
            />
            {data.canCreate ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم الفرقة (مثال: عقول بلا حدود)"
                  className="h-10 min-w-0 flex-1 rounded-xl"
                  maxLength={32}
                />
                <Button
                  className="h-10 gap-1.5 rounded-xl"
                  disabled={busy !== null || name.trim().length < 2}
                  onClick={() => void run("create", () => create({ name }), "أُنشئت الفرقة — شارك الكود مع أصدقائك")}
                >
                  {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  إنشاء
                </Button>
              </div>
            ) : (
              <Gate>
                فرق العضوية تمنح أصدقاءك مستوى حقيقياً. ارتفع إلى <b>الذهبي</b> لفتحها.
              </Gate>
            )}
          </CardContent>
        </Card>
      )}

      {/* انضمام بكود */}
      {!squad && !data.mySeat && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Users} title="انضم بكود" hint="اطلب الكود من صاحب الفرقة" />
            <div className="flex flex-wrap gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="مثال: K7M2QX"
                className="h-10 min-w-0 flex-1 rounded-xl font-mono tracking-widest"
                maxLength={8}
              />
              <Button
                variant="outline"
                className="h-10 gap-1.5 rounded-xl"
                disabled={busy !== null || code.trim().length < 4}
                onClick={() => void run("join", () => joinByCode({ code }), "أُرسل طلبك/انضممت بنجاح")}
              >
                انضمام
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* الفرق المفتوحة */}
      {data.openSquads.length > 0 && !squad && !data.mySeat && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Gem} title="فرق مفتوحة الآن" hint="اختر فرقة بقائد أعلى مستوى لتحصل على مقعد أقوى" />
            <div className="grid gap-2 sm:grid-cols-2">
              {data.openSquads.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2"
                >
                  <span className="text-xl">{s.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{s.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      القائد {s.leaderName} · مقعد {s.seatTierName} · {s.seatsTaken}/{s.seatsTotal}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[10px]"
                    disabled={busy !== null}
                    onClick={() => void run(`j-${s.id}`, () => requestJoin({ squadId: s.id }), "تم")}
                  >
                    انضم
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* الترتيب */}
      {board && board.squads.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Trophy} title="أقوى الفرق" hint="مرتبة بعدد المقاعد المشغولة فعلياً" />
            <div className="space-y-2">
              {board.squads.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="w-5 text-center text-xs font-black text-muted-foreground">{i + 1}</span>
                  <span className="text-lg">{s.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{s.name}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {s.seats} عضو
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🎖 2) الرتب الشرفية
// ═══════════════════════════════════════════════════════════════════════

export function PrestigePanel() {
  const data = useQuery(api.membershipPrestige.getMyPrestige);
  const board = useQuery(api.membershipPrestige.getPrestigeLeaderboard);
  const sync = useMutation(api.membershipPrestige.syncMyPrestige);
  const claim = useMutation(api.membershipPrestige.claimPrestigeReward);
  const [busy, setBusy] = useState<number | null>(null);

  useDailySync("fb:prestige-sync", sync);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return <Gate>سجّل الدخول لتبدأ مسار الرتب الشرفية — أيام عضويتك تتحول إلى مكافآت دائمة.</Gate>;
  }

  const take = async (level: number) => {
    setBusy(level);
    try {
      const res = await claim({ level });
      toast.success(res.granted.length > 0 ? `استلمت: ${res.granted.join(" · ")}` : "تم الاستلام");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الاستلام");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-2">
        <div className="bg-gradient-to-br from-amber-500/15 via-transparent to-violet-500/10 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-3xl shadow-sm">
              {data.levelMeta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black">رتبة {data.levelMeta.name}</h2>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  المستوى {data.level} من {data.levels.length}
                </Badge>
                {data.claimable > 0 && (
                  <Badge className="rounded-full bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-400">
                    {data.claimable} مكافأة بانتظارك
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.points.toLocaleString("ar-EG")} نقطة شرف ·{" "}
                {data.membershipDays.toLocaleString("ar-EG")} يوماً من العضوية الفعلية · سلسلة{" "}
                {data.streak} · مكافأة دائمة +{data.permanentBonusPct}%
              </p>
            </div>
          </div>

          {data.progress && (
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  التالي: {data.progress.target.toLocaleString("ar-EG")} نقطة
                  {data.nextLevel ? ` (${data.nextLevel.emoji} ${data.nextLevel.name})` : ""}
                </span>
                <span className="tabular-nums">{data.progress.percent}%</span>
              </div>
              <Progress value={data.progress.percent} className="h-2" />
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">نقاطك يومياً الآن</p>
              <p className="text-sm font-bold">
                {data.dailyWeight > 0 ? `${data.dailyWeight} نقطة / يوم` : "صفر (بدون عضوية مدفوعة)"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">أعلى مستوى سجّلته</p>
              <p className="text-sm font-bold">
                {data.highestTierMeta.emoji} {data.highestTierMeta.name}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">مكافآت مستلمة</p>
              <p className="text-sm font-bold">{data.claimedCount.toLocaleString("ar-EG")}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <SectionTitle icon={Flame} title="سلم الرتب" hint="كل رتبة تفتح مكافأة دائمة — لا تنتهي بانتهاء عضويتك" />
          <div className="grid gap-2 sm:grid-cols-2">
            {data.levels.map((l) => (
              <div
                key={l.level}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  l.unlocked ? "border-border/70 bg-muted/30" : "border-dashed border-border/60 bg-transparent opacity-70",
                  l.claimable && "border-emerald-500/50 bg-emerald-500/5",
                )}
              >
                <span className="mt-0.5 text-xl">{l.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-bold">{l.name}</p>
                    <Badge variant="outline" className="rounded-full text-[9px]">
                      {l.points.toLocaleString("ar-EG")}
                    </Badge>
                    {l.claimed && <Check className="size-3.5 text-emerald-600" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{l.reward.summary}</p>
                </div>
                {l.points > 0 && (
                  <Button
                    size="sm"
                    variant={l.claimable ? "default" : "outline"}
                    className="h-7 shrink-0 rounded-lg px-2 text-[10px]"
                    disabled={!l.claimable || busy !== null}
                    onClick={() => void take(l.level)}
                  >
                    {busy === l.level ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : l.claimed ? (
                      "مستلمة"
                    ) : l.unlocked ? (
                      "استلم"
                    ) : (
                      <Lock className="size-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Note>
            نقاط الشرف تُحتسب من <b>أيام العضوية المدفوعة فعلياً</b> فقط — الترقيات المؤقتة لا تبني
            شرفاً. تُحدَّث مرة كل يوم عند فتحك للصفحة، بلا أي استهلاك أثناء غيابك.
          </Note>
        </CardContent>
      </Card>

      {board && board.rows.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Trophy} title="لوحة شرف الوفاء" hint="أعلى ١٠ في نقاط الشرف" />
            <div className="space-y-2">
              {board.rows.map((r, i) => (
                <div key={r.userId} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="w-5 text-center text-xs font-black text-muted-foreground">{i + 1}</span>
                  <span className="text-base">{r.levelEmoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">
                    {r.avatarEmoji} {r.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{r.levelName}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {r.points.toLocaleString("ar-EG")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🔄 3) مركز التجديد
// ═══════════════════════════════════════════════════════════════════════

export function RenewalPanel() {
  const data = useQuery(api.membershipRenewal.getRenewalCenter);
  const sync = useMutation(api.membershipRenewal.syncRenewal);
  const setPrefs = useMutation(api.membershipRenewal.setRenewalPrefs);
  const bank = useMutation(api.membershipRenewal.bankUnusedDays);
  const redeem = useMutation(api.membershipRenewal.redeemWithCredits);
  const [busy, setBusy] = useState<string | null>(null);

  useDailySync("fb:renewal-sync", sync);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return <Gate>سجّل الدخول لإدارة التجديد والاسترداد — رصيد أيام محفوظ لا يضيع.</Gate>;
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      const res = await fn();
      const detail =
        ok ??
        (res && typeof res === "object" && "totalDays" in res
          ? `تم التجديد ${(res as { totalDays: number }).totalDays} يوماً`
          : "تم");
      toast.success(detail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تنفيذ العملية");
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: "autoRenew" | "payWithLoyalty" | "keepTierOnExpiry" | "remindersOn", value: boolean) =>
    void run(key, () => setPrefs({ [key]: value } as Record<string, boolean>));

  return (
    <div className="space-y-5">
      <Card className="border-2">
        <CardContent className="space-y-4 p-5">
          <SectionTitle
            icon={RefreshCw}
            title="حالة عضويتك"
            hint="فترة السماح تحفظ مستواك بعد الانتهاء حتى تُجدّد بهدوء"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">المستوى الحالي</p>
              <p className="text-sm font-bold">{data.tierName}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">المتبقي</p>
              <p className="text-sm font-bold">
                {data.daysRemaining === null ? "دائم / غير محدود" : `${data.daysRemaining} يوم`}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">نقاط ولائك</p>
              <p className="text-sm font-bold">{data.points.toLocaleString("ar-EG")}</p>
            </div>
          </div>

          {data.expired && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
              <Clock className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                انتهت عضويتك المسجّلة
                {data.graceEndsAt
                  ? ` — مستوى ${data.tierName} محفوظ بفترة السماح حتى ${new Date(data.graceEndsAt).toLocaleDateString("ar-EG")}`
                  : ""}
                .
              </span>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { key: "autoRenew", label: "التجديد التلقائي", desc: "يستهلك الرصيد المدّخر ثم نقاط الولاء عند الانتهاء" },
                { key: "payWithLoyalty", label: "الدفع بنقاط الولاء", desc: "السماح باستخدام نقاطك في التجديد التلقائي" },
                { key: "keepTierOnExpiry", label: "فترة السماح", desc: "تحفظ مستواك مؤقتاً بعد الانتهاء" },
                { key: "remindersOn", label: "عروض الاسترجاع", desc: "عروض خصم حقيقية إن توقفت عن اللعب" },
              ] as const
            ).map((row) => {
              const on = data.prefs[row.key];
              return (
                <button
                  key={row.key}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => toggle(row.key, !on)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-right transition-colors",
                    on ? "border-primary/40 bg-primary/5" : "border-border/70 bg-muted/20",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-md border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold">{row.label}</span>
                    <span className="block text-[10px] leading-relaxed text-muted-foreground">{row.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <SectionTitle
            icon={Gem}
            title="رصيد الأيام المدّخرة"
            hint="حوّل أيام عضويتك غير المستخدمة إلى رصيد دائم (استرداد ٥٠٪)"
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-black tabular-nums">{data.credits.bankedDays}</span>
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
              يوماً مدّخراً · ادّخرت تاريخياً {data.credits.lifetimeBanked} واستهلكت{" "}
              {data.credits.lifetimeUsed}
              <br />
              كل يوم مدّخر = يوم عضوية كامل عند أي تجديد قادم، بلا نقاط ولا دفع.
            </div>
            <Button
              variant="outline"
              className="gap-1.5 rounded-xl"
              disabled={busy !== null || data.daysRemaining === null || data.daysRemaining < 1}
              onClick={() => void run("bank", () => bank({ confirm: "bank" }), "ادّخرت أيامك المتبقية")}
            >
              {busy === "bank" ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
              ادّخر أيامي المتبقية
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.offers.length > 0 && (
        <Card className="border-2 border-emerald-500/40">
          <CardContent className="space-y-3 p-5">
            <SectionTitle icon={Gift} title="عروض استرجاع خاصة لك" hint="خصم + أيام هدية — تُستهلك مرة واحدة" />
            {data.offers.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5"
              >
                <span className="text-lg">{o.tierName === "ذهبي" ? "🥇" : o.tierName === "ماسي" ? "💎" : "👑"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold">
                    {o.tierName} · خصم {o.discountPct}%
                    {o.extraDays > 0 ? ` + ${o.extraDays} يوم هدية` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">ينتهي خلال {o.hoursLeft} ساعة</p>
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-lg text-[11px]"
                  disabled={busy !== null}
                  onClick={() => void run(`o-${o.id}`, () => redeem({ tier: asBuyTier(o.tier), days: 30, offerId: o.id }))}
                >
                  استخدم العرض
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-5">
          <SectionTitle
            icon={Zap}
            title="خطة التجديد"
            hint={`أفضل خصم متاح لك الآن: ${data.readiness.bestDiscountPct}% — الرصيد المدّخر يُستهلك أولاً`}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {data.plan.map((p) => (
              <div key={p.tier} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.tierName}</span>
                  {p.isCurrent && (
                    <Badge variant="outline" className="rounded-full text-[9px]">
                      مستواك
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {p.price30.toLocaleString("ar-EG")} نقطة لـ٣٠ يوماً ({p.perDay}/يوم)
                  {p.discountPct > 0 ? ` · خصم ${p.discountPct}%` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  يكفي رصيدك لـ <b className="text-foreground">{p.totalDaysAffordable}</b> يوماً
                  {p.bankedDaysCover > 0 ? ` (منها ${p.bankedDaysCover} من الرصيد المدّخر)` : ""}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full gap-1.5 rounded-xl text-[11px]"
                  disabled={busy !== null || p.totalDaysAffordable < 7}
                  onClick={() =>
                    void run(`p-${p.tier}`, () => redeem({ tier: asBuyTier(p.tier), days: 30 }))
                  }
                >
                  <RefreshCw className="size-3.5" />
                  جدّد ٣٠ يوماً
                </Button>
              </div>
            ))}
          </div>
          <Note>
            التجديد هنا يستهلك <b>الرصيد المدّخر أولاً</b> ثم نقاط الولاء، ويُطبَّق أفضل خصم متاح
            (خصم مستواك أو عرض الاسترجاع). وربما يعمل التجديد التلقائي عنك عند انتهاء العضوية.
          </Note>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 🎰 4) خزنة المميزات
// ═══════════════════════════════════════════════════════════════════════

export function VaultPanel() {
  const data = useQuery(api.membershipVault.getVault);
  const open = useMutation(api.membershipVault.openVault);
  const craft = useMutation(api.membershipVault.craftPerk);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<{ rarity: string; label: string; forced: boolean } | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return <Gate>سجّل الدخول لفتح خزنة المميزات — نِسَب معلنة ونظام رحمة يضمن مكافأة نادرة.</Gate>;
  }
  if (!data.unlocked) {
    return <Gate>خزنة المميزات تُفتح من المستوى <b>الذهبي</b> فأعلى. كلما ارتفع مستواك، تقلّ المدة بين الفتحات المجانية.</Gate>;
  }

  const doOpen = async (useFragments: boolean) => {
    setBusy(useFragments ? "frag" : "free");
    try {
      const res = await open(useFragments ? { useFragments: true } : {});
      setLast({ rarity: res.rarity, label: res.reward.label, forced: res.forced });
      toast.success(`${RARITY_LABEL[res.rarity]} — ${res.reward.label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الفتح");
    } finally {
      setBusy(null);
    }
  };

  const doCraft = async (key: string) => {
    setBusy(key);
    try {
      const res = await craft({ key });
      toast.success(`صُنع ${res.name} — الرصيد الآن ${res.fragments} فُتاتاً`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التصنيع");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-2">
        <div className="bg-gradient-to-br from-violet-500/15 via-transparent to-sky-500/10 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-3xl shadow-sm">
              🎰
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black">خزنة المميزات</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.freeOpenHours > 0
                  ? `فتحة مجانية كل ${data.freeOpenHours} ساعة · ${data.opens} فتحة سابقة`
                  : `${data.opens} فتحة سابقة`}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full text-[10px]">
              💠 {data.fragments.toLocaleString("ar-EG")} فُتات
            </Badge>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              className="h-11 gap-2 rounded-xl px-5"
              disabled={busy !== null || !data.freeReady}
              onClick={() => void doOpen(false)}
            >
              {busy === "free" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {data.freeReady ? "افتح مجاناً" : `الفتحة بعد ${data.minutesToNextOpen} دقيقة`}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-xl"
              disabled={busy !== null || data.fragments < 150}
              onClick={() => void doOpen(true)}
            >
              {busy === "frag" ? <Loader2 className="size-4 animate-spin" /> : <Gem className="size-4" />}
              افتح بـ١٥٠ فُتات
            </Button>
            {data.guaranteedNext && (
              <Badge className="rounded-full bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-400">
                الفتحة القادمة {RARITY_LABEL[data.guaranteedNext]} مضمونة (نظام الرحمة)
              </Badge>
            )}
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                عدّاد الرحمة: {data.pity} / {data.epicPity} حتى مكافأة ملحمية مضمونة
              </span>
              <span className="tabular-nums">{data.pityProgress}%</span>
            </div>
            <Progress value={data.pityProgress} className="h-2" />
          </div>
        </div>
      </Card>

      {last && (
        <Card className={cn("border-2", RARITY_STYLE[last.rarity])}>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Trophy className="size-5" />
            <p className="min-w-0 flex-1 text-sm font-bold">
              {RARITY_LABEL[last.rarity]}: {last.label}
              {last.forced ? " (بفضل نظام الرحمة)" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-5">
          <SectionTitle icon={Target} title="النِسَب معلنة" hint="لا مفاجآت — هذه الاحتمالات الحقيقية المطبّقة على الخادم" />
          <div className="grid gap-2 sm:grid-cols-2">
            {data.odds.map((o) => (
              <div key={o.rarity} className={cn("rounded-xl border px-3 py-2.5", RARITY_STYLE[o.rarity])}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{RARITY_LABEL[o.rarity]}</span>
                  <span className="text-xs font-black tabular-nums">{o.percent}%</span>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed opacity-80">{o.pool.join(" · ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <SectionTitle icon={Gem} title="التصنيع بالفُتات" hint="اطلب ما تريده بالضبط بدل الاعتماد على الحظ" />
          <div className="grid gap-2 sm:grid-cols-2">
            {data.craft.map((c) => (
              <div key={c.key} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{c.name}</span>
                  {c.owned && (
                    <Badge variant="outline" className="rounded-full text-[9px]">
                      مملوك
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{c.description}</p>
                <Button
                  size="sm"
                  variant={c.affordable ? "default" : "outline"}
                  className="mt-2 w-full gap-1.5 rounded-xl text-[11px]"
                  disabled={busy !== null || !c.affordable}
                  onClick={() => void doCraft(c.key)}
                >
                  {busy === c.key ? <Loader2 className="size-3.5 animate-spin" /> : <Gem className="size-3.5" />}
                  {c.fragments} فُتات
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.history.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-5">
            <SectionTitle icon={Clock} title="آخر فتحاتك" />
            {data.history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                <Badge variant="outline" className={cn("rounded-full text-[9px]", RARITY_STYLE[h.rarity])}>
                  {RARITY_LABEL[h.rarity]}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs">{h.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(h.at).toLocaleDateString("ar-EG")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Note>
        كل مكافأة هنا تُطبَّق فعلياً: نقاط الولاء تدخل محفظتك، والترقيات تُسجَّل في نظام الترقيات
        الموحّد، والامتيازات تُقيَّد في محفظتك (وبعضها دائم). تريد شيئاً محدداً؟ صنّعه بالفُتات.
      </Note>
    </div>
  );
}
