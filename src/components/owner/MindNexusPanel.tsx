import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { FACULTY_META, MAX_TIER_SCORE, type FacultyKey } from "@/convex/mindCore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Activity,
  Brain,
  Gavel,
  Link2,
  Loader2,
  RefreshCcw,
  Snowflake,
  Sparkles,
  Sun,
  Trophy,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 نكسس العقول — قمرة العرش لقيادة التقدّم الذهني في اللعبة
 * ═══════════════════════════════════════════════════════════════════════
 * هنا يرى المالك الصحة الذهنية للمجتمع كاملة، ويغيّرها فعلاً:
 *   • نبضة حيّة: كم عقلاً، كم نشطاً، أي القوى تهيمن على المجتمع
 *   • منح خبرة لأي قوة عند أي لاعب — تُطبَّق على جهازه عند أول دخول
 *   • تجميد عقل (عقوبة حقيقية توقف التقدّم) ورفع التجميد
 *   • قرار تصفير يُنفَّذ على عقل اللاعب نفسه — لا محاكاة
 * وكل قرار يُسجَّل في سجل التدقيق وسجل قرارات العرش.
 * ═══════════════════════════════════════════════════════════════════════
 */

const AMOUNTS = [100, 250, 500, 1000];
const FACULTY_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "all", label: "كل القوى الست", icon: "🌐" },
  ...(Object.keys(FACULTY_META) as FacultyKey[]).map((k) => ({
    value: k,
    label: FACULTY_META[k].name,
    icon: FACULTY_META[k].icon,
  })),
];

const TONE_BAR: Record<string, string> = {
  slate: "bg-slate-400",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-400",
  rose: "bg-rose-500",
};

export function MindNexusPanel() {
  const pulse = useQuery(api.minds.getMindPulse);
  const grant = useMutation(api.minds.ownerGrantMind);
  const freeze = useMutation(api.minds.ownerFreezeMind);
  const reset = useMutation(api.minds.ownerResetMind);

  const [faculty, setFaculty] = useState<string>("all");
  const [amount, setAmount] = useState<number>(250);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (pulse === undefined) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // غير مصرح — لا نُظهر شيئاً (الخادم لا يعيد البيانات أصلاً لهذا المستخدم)
  if (pulse === null) return null;

  const { pulse: p, topMinds, recentGrants, facultyTotals } = pulse;
  const maxRankCount = Math.max(1, ...p.rankBuckets.map((b) => b.count));

  const runGrant = async (userId: Id<"users">) => {
    setBusy(`grant:${userId}`);
    try {
      const res = await grant({ userId, faculty, amount });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch {
      toast.error("تعذّر تنفيذ المنحة — تحقّق من صلاحيتك");
    } finally {
      setBusy(null);
    }
  };

  const runFreeze = async (userId: Id<"users">, frozen: boolean) => {
    setBusy(`freeze:${userId}`);
    try {
      const res = await freeze({ userId, frozen });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch {
      toast.error("تعذّر تغيير حالة التجميد");
    } finally {
      setBusy(null);
    }
  };

  const runReset = async (userId: Id<"users">) => {
    setBusy(`reset:${userId}`);
    try {
      const res = await reset({ userId, reason: "قرار العرش — إعادة بناء العقل من الصفر" });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch {
      toast.error("تعذّر إصدار قرار التصفير");
    } finally {
      setBusy(null);
      setConfirmReset(null);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-primary/5 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Brain className="size-4 text-primary" />
          نكسس العقول
          <span className="text-[10px] font-normal text-muted-foreground">
            قيادة التقدّم الذهني · منح · عقوبات · نبضة حيّة
          </span>
        </CardTitle>
        <Badge variant="secondary" className="text-[10px] font-bold">
          {p.total} عقل مسجَّل
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* ═══ النبضة الحيّة ═══ */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Activity, label: "نشط خلال 24س", value: `${p.active24h} / ${p.total}` },
            { icon: Trophy, label: "متوسط مجموع القوى", value: `${p.avgTier} من ${MAX_TIER_SCORE}` },
            { icon: Zap, label: "أقوى عقل", value: `${p.topTier}` },
            { icon: Snowflake, label: "عقول مُجمَّدة", value: `${p.frozen}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="mt-1.5 text-base font-black tabular-nums leading-none">{s.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {p.empty ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
            لا عقول مسجَّلة بعد — أول لاعب يسجّل الدخول ويلعب جولة سيظهر هنا فوراً.
          </p>
        ) : (
          <>
            {/* ═══ توزيع الرتب ═══ */}
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2.5 text-xs font-bold">توزيع عقول المجتمع على سلّم الرتب</p>
              <div className="space-y-1.5">
                {p.rankBuckets
                  .slice()
                  .reverse()
                  .map((b) => (
                    <div key={b.level} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[10px] font-bold">
                        {b.icon} {b.name}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", TONE_BAR[b.tone] ?? "bg-primary")}
                          style={{ width: `${Math.round((b.count / maxRankCount) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-left text-[10px] font-black tabular-nums">
                        {b.count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* ═══ هوية المجتمع الذهنية ═══ */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Sparkles className="size-3.5 text-primary" />
                  القوة المهيمنة على المجتمع
                </p>
                {p.dominantFaculty ? (
                  <>
                    <p className="mt-1.5 text-sm font-black">
                      {p.dominantFaculty.icon} {p.dominantFaculty.name}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {FACULTY_META[p.dominantFaculty.key as FacultyKey]?.feeds ?? "تغذّي اللعب مباشرة"}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">لا بيانات كافية بعد</p>
                )}
              </div>

              <div className="rounded-2xl border border-border/70 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <BarChart3Icon />
                  أي قوة يتصدّرها أكبر عدد من اللاعبين
                </p>
                <ul className="mt-1.5 space-y-1">
                  {p.facultyLeaders
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3)
                    .map((l) => (
                      <li key={l.key} className="flex items-center justify-between text-[11px]">
                        <span className="font-bold">
                          {l.icon} {l.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{l.count} لاعب</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {/* ═══ الرصيد الكلي للقوى ═══ */}
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 text-xs font-bold">رصيد خبرة المجتمع في كل قوة</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {facultyTotals.map((f) => (
                  <div key={f.key} className="rounded-xl bg-muted/30 p-2">
                    <p className="text-[10px] text-muted-foreground">
                      {f.icon} {f.name}
                    </p>
                    <p className="text-sm font-black tabular-nums">{f.xp.toLocaleString("ar-EG")}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ أقوى العقول + أدوات التحكم الحقيقية ═══ */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold">أقوى العقول — وأدوات التحكم</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select value={faculty} onValueChange={setFaculty}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FACULTY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.icon} {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(amount)} onValueChange={(v) => setAmount(Number(v))}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AMOUNTS.map((a) => (
                        <SelectItem key={a} value={String(a)} className="text-xs">
                          +{a} خبرة
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ul className="space-y-1.5">
                {topMinds.map((m) => (
                  <li
                    key={m.userId}
                    className={cn(
                      "rounded-2xl border p-2.5",
                      m.frozen ? "border-rose-500/40 bg-rose-500/5" : "border-border/70 bg-card/60",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-sm">
                        {m.avatar ?? m.rankIcon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">
                          {m.name}
                          {m.frozen && (
                            <Badge variant="destructive" className="ms-1.5 text-[9px]">
                              مُجمَّد
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {m.rankIcon} {m.rankName} · {m.identityTitle} · {m.sessions} جولة · مجموع {m.tierScore}
                        </p>
                      </div>
                      <Progress
                        value={Math.round((m.tierScore / MAX_TIER_SCORE) * 100)}
                        className="hidden h-1.5 w-20 sm:block"
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={busy === `grant:${m.userId}`}
                        onClick={() => runGrant(m.userId as Id<"users">)}
                      >
                        {busy === `grant:${m.userId}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        منح
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[11px]"
                        disabled={busy === `freeze:${m.userId}`}
                        onClick={() => runFreeze(m.userId as Id<"users">, !m.frozen)}
                      >
                        {m.frozen ? <Sun className="size-3" /> : <Snowflake className="size-3" />}
                        {m.frozen ? "رفع التجميد" : "تجميد"}
                      </Button>
                      {confirmReset === m.userId ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1 text-[11px]"
                          disabled={busy === `reset:${m.userId}`}
                          onClick={() => runReset(m.userId as Id<"users">)}
                        >
                          {busy === `reset:${m.userId}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RefreshCcw className="size-3" />
                          )}
                          تأكيد التصفير
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-[11px] text-muted-foreground"
                          onClick={() => {
                            setConfirmReset(m.userId);
                            setTimeout(() => setConfirmReset((c) => (c === m.userId ? null : c)), 5000);
                          }}
                        >
                          <RefreshCcw className="size-3" />
                          تصفير العقل
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-muted-foreground">
                المنح وقرارات التصفير تُنفَّذ فعلياً على عقل اللاعب عند أول مزامنة (فتح اللعبة)، وتُسجَّل في سجل التدقيق.
              </p>
            </div>

            {/* ═══ سجل قرارات العرش ═══ */}
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                <Gavel className="size-3.5 text-primary" />
                سجل قرارات العرش
              </p>
              {recentGrants.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">لا قرارات بعد — أدوات التحكم أعلاه تُسجّل هنا فوراً</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentGrants.map((g) => (
                    <li key={g.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="min-w-0">
                        <span className="font-bold">{g.targetName}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {g.kind === "reset"
                            ? "قرار تصفير"
                            : `${g.amount > 0 ? "+" : ""}${g.amount} إلى ${
                                g.faculty === "all"
                                  ? "كل القوى"
                                  : (FACULTY_META[g.faculty as FacultyKey]?.name ?? g.faculty)
                              }`}
                          {" — "}
                          {g.reason}
                        </span>
                      </span>
                      <Badge
                        variant={g.applied ? "secondary" : "outline"}
                        className="shrink-0 text-[9px] font-bold"
                      >
                        {g.applied ? "طُبِّقت" : "بالانتظار"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* ═══ خريطة الترابط — كيف يغذّي العقل بقية اللعبة ═══ */}
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
            <Link2 className="size-3.5 text-primary" />
            خريطة الترابط الحقيقية
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {[
              { icon: "🧩", text: "كل قوة (٦) تُبنى من إجابات حقيقية وتفتح تخصصات (١٠) بتأثير مقيس في الجولة" },
              { icon: "🏆", text: "مجموع القوى يحدّد رتبتك في سلّم العقول ولوحة الصدارة بين اللاعبين" },
              { icon: "🛒", text: "القوى ترفع الخبرة والعملات المكتسبة ⇒ تؤثر مباشرة في الاقتصاد والمتجر" },
              { icon: "⚖️", text: "قرارات العرش (منح · تجميد · تصفير) تُنفَّذ على العقل نفسه وتُسجَّل في التدقيق" },
              { icon: "📚", text: "إتقان المجالات يُقرأ من بنك الأسئلة فيوجّه صعوبة الجولات القادمة" },
              { icon: "🤖", text: "النبضة تغذّي وحدات الذكاء الموحّد بقراءة حقيقية لحالة المجتمع الذهنية" },
            ].map((row) => (
              <li key={row.text} className="flex items-start gap-2 rounded-xl bg-background/60 p-2">
                <span className="text-sm">{row.icon}</span>
                <span className="text-[10px] leading-relaxed text-muted-foreground">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/** أيقونة صغيرة لتفادي استيراد إضافي من lucide. */
function BarChart3Icon() {
  return <Activity className="size-3.5 text-primary" />;
}
