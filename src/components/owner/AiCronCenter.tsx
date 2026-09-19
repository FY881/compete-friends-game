import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  Clock,
  HardDrive,
  Loader2,
  Play,
  Power,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⏱️ مركز التحكم الكامل بمهام AI المجدولة
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل مهمة AI/نظام تستهلك من جدولة الخادم تظهر هنا بحالتها الحقيقية:
 * مفعّلة أم لا، كل كم تعمل، آخر مرة عملت، كم مرة عملت، وهل فشلت.
 *
 * وكل زر هنا **ينفّذ فعلاً** بلا إعادة نشر:
 *   • تبديل التفعيل        → يُحفظ في قاعدة البيانات ويُحترم فوراً.
 *   • تغيير الدورية        → من قائمة قيم معلومة (تمنع إغراق الخادم).
 *   • «شغّل الآن»          → تنفيذ حقيقي فوري للمهمة نفسها.
 *   • المفتاح الشامل       → إيقاف/تشغيل كل مهام AI بضغطة واحدة.
 *
 * ولهذا لن تحتاج أبداً إلى الاختيار بين «كل شيء يعمل ويستهلك» و«لا شيء
 * يعمل» — التحكم صار لكل مهمة على حدة، لحظياً.
 */

const INTERVAL_LABELS: Record<number, string> = {
  15: "١٥ دقيقة",
  60: "ساعة",
  360: "٦ ساعات",
  1440: "٢٤ ساعة",
  10080: "أسبوع",
};

/** صياغة «منذ متى» بالعربية. */
function timeAgo(ts: number): string {
  if (!ts) return "لم تعمل بعد";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "قبل لحظات";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

function Stat({ icon: Icon, label, value, tone }: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} />
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

export function AiCronCenter() {
  const data = useQuery(api.aiCron.listJobs);
  const setJobEnabled = useMutation(api.aiCron.setJobEnabled);
  const setJobInterval = useMutation(api.aiCron.setJobInterval);
  const runJobNow = useMutation(api.aiCron.runJobNow);
  const setGlobalPause = useMutation(api.aiCron.setGlobalPause);
  const setAllEnabled = useMutation(api.aiCron.setAllEnabled);
  const resetJob = useMutation(api.aiCron.resetJob);
  const runAllEnabledNow = useMutation(api.aiCron.runAllEnabledNow);
  const purgeAiData = useMutation(api.aiCron.purgeAiData);
  const dataLeft = useQuery(api.aiCron.aiDataLeft);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{
    total: number;
    deleted: Record<string, number>;
    more: boolean;
  } | null>(null);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, typeof data.jobs>();
    for (const job of data.jobs) {
      const list = map.get(job.group) ?? [];
      list.push(job);
      map.set(job.group, list);
    }
    return [...map.entries()];
  }, [data]);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">جارٍ قراءة سجل المهام…</p>
        </div>
      </div>
    );
  }

  const { stats, paused, allowedIntervals } = data;

  const guard = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusyKey(key);
    try {
      await fn();
      toast.success(okMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBusyKey(null);
    }
  };

  const bulk = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBulkBusy(true);
    try {
      await fn();
      toast.success(okMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── الملخص + المفتاح الشامل ─────────────────────────── */}
      <Card>
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Timer className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">مركز التحكم بمهام AI المجدولة</span>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-[10px]",
                paused
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
              )}
            >
              {paused ? "متوقف كلياً" : "يعمل"}
            </Badge>
          </CardTitle>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            كل مهمة تستهلك من جدولة الخادم تظهر أدناه بحالتها الحقيقية. التحكم هنا
            فوري ومحفوظ — لا يحتاج إعادة نشر ولا تعديل كود.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat icon={Bot} label="إجمالي المهام" value={stats.total} />
            <Stat
              icon={Check}
              label="المفعّلة"
              value={stats.enabled}
              tone="text-emerald-600"
            />
            <Stat
              icon={Power}
              label="المتوقفة"
              value={stats.disabled}
              tone="text-muted-foreground"
            />
            <Stat icon={Zap} label="تنفيذ/يوم (تقديري)" value={stats.runsPerDay} />
            <Stat icon={TrendingUp} label="إجمالي التشغيلات" value={stats.totalRuns} />
            <Stat
              icon={AlertTriangle}
              label="مرات الفشل"
              value={stats.totalErrors}
              tone={stats.totalErrors > 0 ? "text-rose-600" : undefined}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
            <Switch
              checked={!paused}
              disabled={bulkBusy}
              onCheckedChange={(v) =>
                bulk(
                  () => setGlobalPause({ paused: !v }),
                  v ? "شُغّلت مهام AI" : "أُوقفت كل مهام AI",
                )
              }
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">المفتاح الشامل لمهام AI</p>
              <p className="text-[10px] text-muted-foreground">
                {paused
                  ? "كل المهام موقوفة الآن — لا يُنفَّذ أي عمل مجدول مهما كانت حالته."
                  : "المهام تعمل حسب حالتها الفردية أدناه."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={bulkBusy || paused}
              onClick={() =>
                bulk(async () => {
                  const res = (await runAllEnabledNow()) as { ran: number };
                  toast.success(`نُفِّذت ${res.ran} مهمة الآن`);
                }, "تم التنفيذ")
              }
            >
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              شغّل المفعّلات الآن
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={bulkBusy}
              onClick={() => bulk(() => setAllEnabled({ enabled: true }), "فُعّلت كل المهام")}
            >
              <Check className="size-3.5" />
              تفعيل الكل
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
              disabled={bulkBusy}
              onClick={() => bulk(() => setAllEnabled({ enabled: false }), "أُوقفت كل المهام فردياً")}
            >
              <X className="size-3.5" />
              إيقاف الكل
            </Button>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            آخر نشاط مسجَّل: {timeAgo(stats.lastActivity)} · الفواصل المسموح بها فقط تُقبل
            (١٥ دقيقة إلى أسبوع) — هذا يمنع تعيين دورية تُغرق الخادم.
          </p>
        </CardContent>
      </Card>

      {/* ── المهام حسب المجموعة ─────────────────────────── */}
      {grouped.map(([group, jobs]) => (
        <Card key={group}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-primary" />
              {group}
              <Badge variant="outline" className="rounded-full text-[10px] tabular-nums">
                {jobs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {jobs.map((job) => {
              const busy = busyKey === job.key;
              const failed = job.lastStatus === "error";
              return (
                <div
                  key={job.key}
                  className={cn(
                    "rounded-2xl border px-3 py-3 transition-colors",
                    failed
                      ? "border-rose-500/40 bg-rose-500/5"
                      : job.enabled
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border/70 bg-muted/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        job.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold">{job.name}</p>
                        <Badge variant="outline" className="rounded-full text-[9px] text-muted-foreground">
                          <Clock className="size-2.5" />
                          {INTERVAL_LABELS[job.intervalMinutes] ?? `${job.intervalMinutes} دقيقة`}
                        </Badge>
                        {failed && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-rose-500/40 text-[9px] text-rose-600"
                          >
                            فشل آخر مرة
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                        {job.description}
                      </p>
                      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                        {timeAgo(job.lastRunAt)} · تشغيلات {job.runCount}
                        {job.errorCount > 0 && ` · أخطاء ${job.errorCount}`}
                        {job.lastDurationMs > 0 && ` · آخر مدة ${job.lastDurationMs}ms`}
                      </p>
                      {failed && job.lastResult && (
                        <p className="mt-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[10px] leading-relaxed text-rose-700 dark:text-rose-400">
                          {job.lastResult}
                        </p>
                      )}
                    </div>

                    <Switch
                      checked={job.enabled}
                      disabled={busy || bulkBusy}
                      onCheckedChange={(v) =>
                        guard(
                          job.key,
                          () => setJobEnabled({ key: job.key, enabled: v }),
                          v ? `فُعّلت: ${job.name}` : `أُوقفت: ${job.name}`,
                        )
                      }
                    />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">الدورية:</span>
                    {allowedIntervals.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        disabled={busy || bulkBusy}
                        onClick={() =>
                          guard(
                            job.key,
                            () => setJobInterval({ key: job.key, intervalMinutes: mins }),
                            `دورية «${job.name}» الآن: ${INTERVAL_LABELS[mins] ?? mins}`,
                          )
                        }
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50",
                          job.intervalMinutes === mins
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/70 text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {INTERVAL_LABELS[mins] ?? mins}
                      </button>
                    ))}

                    <span className="mx-1 h-4 w-px bg-border" />

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[10px]"
                      disabled={busy || bulkBusy || paused}
                      onClick={() =>
                        guard(
                          job.key,
                          async () => {
                            const res = (await runJobNow({ key: job.key })) as {
                              ok: boolean;
                              message: string;
                            };
                            if (!res.ok) throw new Error(res.message);
                          },
                          `نُفِّذت: ${job.name}`,
                        )
                      }
                    >
                      <Play className="size-3" />
                      شغّل الآن
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                      disabled={busy || bulkBusy}
                      onClick={() =>
                        guard(job.key, () => resetJob({ key: job.key }), `أُعيدت لإعدادها: ${job.name}`)
                      }
                    >
                      <RotateCcw className="size-3" />
                      إعادة ضبط
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* ── 🗑 تنظيف بيانات AI نهائياً ─────────────────────────── */}
      <Card className="border-rose-500/30">
        <CardHeader className="gap-1 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <Trash2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">تنظيف بيانات AI والسجلات</span>
            {dataLeft && dataLeft.nonEmpty.length === 0 && (
              <Badge
                variant="outline"
                className="rounded-full border-emerald-500/40 text-[10px] text-emerald-600"
              >
                نظيفة تماماً
              </Badge>
            )}
          </CardTitle>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            يحذف نهائياً مخلّفات AI: قراراتها وسجلاتها وتغذياتها وذاكرتها وأفكار
            العقول، مع سجلات الأخطاء والأداء. لا يمسّ حسابات اللاعبين ولا تقدّمهم
            ولا مقتنياتهم ولا الأسئلة.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
            <HardDrive className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">
                الجداول المراقَبة: {dataLeft ? dataLeft.tables : "…"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {dataLeft === undefined
                  ? "جارٍ الفحص…"
                  : dataLeft.nonEmpty.length === 0
                    ? "لا يوجد أي صف متبقٍّ — كل جداول المخلفات فارغة."
                    : `جداول فيها بيانات: ${dataLeft.nonEmpty.length} — ${dataLeft.nonEmpty.slice(0, 6).join(" · ")}${dataLeft.nonEmpty.length > 6 ? " …" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
              disabled={purging}
              onClick={async () => {
                setPurging(true);
                try {
                  const res = (await purgeAiData({ limitPerTable: 150 })) as {
                    total: number;
                    deleted: Record<string, number>;
                    more: boolean;
                  };
                  setPurgeResult(res);
                  toast.success(
                    res.total > 0
                      ? `حُذف ${res.total} صفاً من ${Object.keys(res.deleted).length} جدولاً`
                      : "لا شيء للحذف — كل الجداول فارغة",
                  );
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذّر التنظيف");
                } finally {
                  setPurging(false);
                }
              }}
            >
              {purging ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              نظّف دفعة واحدة
            </Button>
          </div>

          {purgeResult && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-bold tabular-nums">
                نتيجة آخر تنظيف: {purgeResult.total} صفاً محذوفاً
                {purgeResult.more && " · بقي المزيد — اضغط مرة أخرى"}
              </p>
              {Object.keys(purgeResult.deleted).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(purgeResult.deleted).map(([table, count]) => (
                    <Badge
                      key={table}
                      variant="outline"
                      className="rounded-full text-[9px] tabular-nums"
                    >
                      {table} · {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        ملاحظة تشغيلية: جدولة الخادم نفسها ثابتة وقت النشر (مهمة تفتيش واحدة كل ساعة)،
        لكن <span className="font-bold">كل مهمة هنا تُنفَّذ فقط إن كانت مفعّلة ومستحقة</span> —
        فإيقاف مهمة يوقفها فعلاً من اللحظة التالية بلا إعادة نشر. والمهام الافتراضية
        محافظة (الصيانة وحدها مفعّلة) حتى لا يرتفع الاستهلاك بغير قرارك.
      </p>
    </div>
  );
}
