/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎛️ v12.0 — غرفة الوكلاء (The Kennel) — غرفة المالك
 *
 * كل ذكاء في اللعبة يدخل هذه الغرفة: باسمه، وبماذا يعمل، وبأي ملف يقيم،
 * وبحالته الحيّة الآن، وسبب توقفه إن كان متوقفاً. ومن هنا فقط يُشغَّل،
 * ويُطفأ، ويُوقف لمدة يكتبها المالك، وتُقيَّد حصته، وتُمنح قدراته،
 * وتُحقن أوامره — وكل ذلك مفروض على التنفيذ الفعلي لا على الواجهة.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Check,
  Gauge,
  Link2,
  Loader2,
  Play,
  Power,
  RefreshCw,
  Search,
  ShieldOff,
  Terminal,
  Timer,
  Zap,
} from "lucide-react";

const LEVEL_TONE: Record<string, string> = {
  working: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  idle: "border-sky-500/40 text-sky-700 dark:text-sky-400",
  blocked: "border-rose-500/40 text-rose-700 dark:text-rose-400",
  dormant: "border-border/70 text-muted-foreground",
  error: "border-amber-500/40 text-amber-700 dark:text-amber-400",
};

const LEVEL_LABEL: Record<string, string> = {
  working: "✅ يعمل فعلاً",
  idle: "🕓 ينتظر دورة",
  blocked: "⛔ موقوف",
  dormant: "💤 نائم",
  error: "⚠️ يفشل",
};

type Row = {
  key: string;
  name: string;
  emoji: string;
  dept: string;
  kind: string;
  wiring: string;
  state: string;
  headline: string;
  hourUsed: number;
  dayUsed: number;
  capPerHour: number;
  capPerDay: number;
  enabled: boolean;
  disabledUntil: number;
  totalRuns: number;
  totalErrors: number;
  lastRunAt: number;
  capabilities: string[];
  stopped: string[];
  orders: number;
  orderList: { id: string; text: string; at: number }[];
  granted: string[];
  revoked: string[];
  note: string;
  lastResult: string;
  remainingMinutes: number;
  entry: {
    key: string;
    name: string;
    purpose: string;
    module: string;
    consumes: string;
    wiring: string;
    defaultOn: boolean;
    stoppables: string[];
    capabilities: string[];
    dormantReason?: string;
    jobKey?: string;
    unitKey?: string;
  };
  diagnosis: { level: string; headline: string; reasons: string[] };
  job: { enabled: boolean; intervalMinutes: number; lastRunAt: number; lastStatus: string; lastResult: string; errorCount: number } | null;
  unit: { enabled: boolean; sensitivity: number; lastEventAt: number; eventCount: number } | null;
};

export function AiControlRoom() {
  const room = useQuery(api.aiControl.getAgentRoom, {});
  const runNow = useAction(api.aiControl.runAiNow);
  const runMany = useAction(api.aiControl.runManyNow);
  const setEnabled = useMutation(api.aiControl.setAiEnabled);
  const setCaps = useMutation(api.aiControl.setAiCaps);
  const addOrder = useMutation(api.aiControl.addAiOrder);
  const clearOrders = useMutation(api.aiControl.clearAiOrders);
  const setCapability = useMutation(api.aiControl.setAiCapability);
  const setStop = useMutation(api.aiControl.setAiStop);
  const emergencyStop = useMutation(api.aiControl.emergencyStopAll);
  const revive = useMutation(api.aiControl.reviveDefaults);
  const seed = useMutation(api.aiControl.seedControlsPublic);

  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [stopHours, setStopHours] = useState(6);
  const [orderDraft, setOrderDraft] = useState<Record<string, string>>({});
  const [capDraft, setCapDraft] = useState<Record<string, { h: string; d: string }>>({});
  const [lastRun, setLastRun] = useState<{ ok: boolean; message: string } | null>(null);

  const rows = (room?.rows ?? []) as unknown as Row[];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.key, r.name, r.dept, r.entry.purpose, r.entry.module, r.kind, r.headline]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const list = map.get(r.dept) ?? [];
      list.push(r);
      map.set(r.dept, list);
    }
    return [...map.entries()];
  }, [filtered]);

  if (room === undefined) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">نفتح سجل الوكلاء…</div>;
  }
  if (room === null) {
    return <div className="p-6 text-center text-sm text-muted-foreground">غرفة الوكلاء للمالك فقط.</div>;
  }

  const summary = room.summary;

  const doRun = async (row: Row, force: boolean) => {
    setBusy(row.key);
    try {
      const res = await runNow({ key: row.key, force });
      setLastRun({ ok: res.ok, message: res.message });
      if (res.ok) toast.success(res.message.slice(0, 140));
      else toast.error(res.message.slice(0, 180));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر التشغيل";
      setLastRun({ ok: false, message: msg });
      toast.error(msg.slice(0, 180));
    } finally {
      setBusy(null);
    }
  };

  const doRunMany = async (scope: string) => {
    setBulkBusy(true);
    try {
      const res = await runMany({ scope, force: true });
      setLastRun({ ok: res.ok, message: res.message });
      toast.success(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التشغيل الجماعي");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* ── نبضة الغرفة ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "إجمالي الوكلاء", value: summary.total, tone: "" },
          { label: "يعمل فعلاً", value: summary.working, tone: "text-emerald-600" },
          { label: "موقوف", value: summary.paused + summary.off, tone: "text-rose-600" },
          { label: "استهلك حصته", value: summary.quota, tone: "text-amber-600" },
          { label: "إجمالي التنفيذات", value: summary.totalRuns, tone: "" },
          { label: "أخطاء", value: summary.totalErrors, tone: summary.totalErrors > 0 ? "text-rose-600" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={cn("text-lg font-black tabular-nums", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── 🪢 حبل الرقبة: لا ذكاء خارج الغرفة ── */}
      <Card
        className={cn(
          "border-2",
          room.coverage.covered && !room.coverage.hasDeadLinks
            ? "border-emerald-500/40 bg-emerald-500/[0.04]"
            : "border-rose-500/40 bg-rose-500/[0.04]",
        )}
      >
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="flex items-center gap-1.5 font-bold">
              <Link2 className={cn("size-3.5", room.coverage.covered && !room.coverage.hasDeadLinks ? "text-emerald-600" : "text-rose-600")} />
              حبل الرقبة
            </span>
            <span className="text-muted-foreground">
              السجل يحوي <span className="font-bold tabular-nums text-foreground">{room.coverage.total}</span> ذكاءً
            </span>
            <span className="text-muted-foreground">
              مهام حقيقية: <span className="font-bold tabular-nums text-foreground">{room.coverage.realJobs}</span> · وحدات حقيقية:{" "}
              <span className="font-bold tabular-nums text-foreground">{room.coverage.realUnits}</span>
            </span>
            {room.coverage.covered && !room.coverage.hasDeadLinks ? (
              <span className="font-bold text-emerald-600">✅ لا ذكاء واحد خارج الغرفة — وكل رابط حي</span>
            ) : (
              <span className="font-bold text-rose-600">⚠️ يوجد كشف يحتاج قرارك (أسفله)</span>
            )}
          </div>

          {room.coverage.unregisteredJobs.length > 0 && (
            <p className="text-[10px] leading-relaxed text-rose-700">
              ⛔ <b>تعمل بلا رقابة</b> — مهام مجدولة ليست في السجل:{" "}
              <span className="font-mono">{room.coverage.unregisteredJobs.join(" · ")}</span>
            </p>
          )}
          {room.coverage.unregisteredUnits.length > 0 && (
            <p className="text-[10px] leading-relaxed text-rose-700">
              ⛔ <b>وحدات ذكاء خارج الغرفة</b>: <span className="font-mono">{room.coverage.unregisteredUnits.join(" · ")}</span>
            </p>
          )}
          {room.coverage.deadJobLinks.length > 0 && (
            <p className="text-[10px] leading-relaxed text-amber-700">
              🪦 رابط ميت (مهمة غير مُسجّلة فعلاً في المُوزِّع):{" "}
              <span className="font-mono">{room.coverage.deadJobLinks.join(" · ")}</span>{" "}
              — اضغط «تحقق من السجل» أدناه لإنشاء صفوف المهام، فيُصلَح الرابط.
            </p>
          )}
          {room.coverage.deadUnitLinks.length > 0 && (
            <p className="text-[10px] leading-relaxed text-amber-700">
              🪦 رابط وحدة ميت: <span className="font-mono">{room.coverage.deadUnitLinks.join(" · ")}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── المحرك + الاستهلاك ── */}
      <Card className={cn("border-2", room.engine.agentsCount === 0 ? "border-amber-500/40 bg-amber-500/5" : "border-primary/25 bg-primary/[0.03]")}>
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className={cn("font-bold", room.engine.hasKey ? "text-emerald-600" : "text-rose-600")}>
              {room.engine.hasKey ? "✅ مفتاح ذكاء مضبوط في مركز API" : "⛔ لا يوجد مفتاح ذكاء — كل نداء خارجي سيفشل"}
            </span>
            <span className="text-muted-foreground">
              الوكلاء الأحياء: <span className="font-bold tabular-nums text-foreground">{room.engine.agentsCount}</span>
              {room.engine.agentsCount === 0 && " — شغّل «نبضة حياة الوكلاء» لتولد العائلة الأولى"}
            </span>
            <span className="text-muted-foreground">
              استهلاك اليوم: <span className="font-bold tabular-nums text-foreground">{summary.usedToday}</span> من {summary.capToday || "∞"} ({summary.usagePercent}٪)
            </span>
            <span className="text-muted-foreground">أشياء موقوفة بالاسم: <span className="tabular-nums">{summary.stoppedFeatures}</span></span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", summary.usagePercent > 85 ? "bg-rose-500" : summary.usagePercent > 60 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${Math.max(2, summary.usagePercent)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="rounded-xl" disabled={bulkBusy} onClick={() => void doRunMany("runnable")}>
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} شغّل كل الوكلاء الآن
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" disabled={bulkBusy} onClick={() => void doRunMany("jobs")}>
              شغّل المهام المجدولة
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" disabled={bulkBusy} onClick={() => void doRunMany("colonies")}>
              شغّل الكيانات الحيّة
            </Button>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={8760}
                value={stopHours}
                onChange={(e) => setStopHours(Number(e.target.value))}
                className="h-8 w-20 rounded-xl text-[11px]"
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                onClick={async () => {
                  if (!window.confirm(`إيقاف كل الوكلاء لمدة ${stopHours} ساعة؟`)) return;
                  try {
                    const res = await emergencyStop({ hours: stopHours, reason: "قرار من غرفة الوكلاء" });
                    toast.success(`أُوقف ${res.touched} ذكاءً لمدة ${stopHours} ساعة`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "تعذّر الإيقاف");
                  }
                }}
              >
                <ShieldOff className="size-3.5" /> إيقاف طارئ شامل
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await revive({ enableAll: false });
                  toast.success("عودة للحالة الافتراضية الآمنة");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر الإحياء");
                }
              }}
            >
              <RefreshCw className="size-3.5" /> عودة للافتراضي
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={async () => {
                try {
                  const res = await seed({});
                  toast.success(`السجل جاهز: ${res.total} ذكاءً (أُضيف ${res.created})`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر البذر");
                }
              }}
            >
              بذر السجل
            </Button>
          </div>
          {lastRun && (
            <p className={cn("rounded-lg border p-2 text-[11px]", lastRun.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5")}>
              {lastRun.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── بحث عميق ── */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث عميق: اكتب اسم ذكاء، أو «دردشة»، أو «أسئلة»، أو اسم الملف…"
          className="rounded-xl ps-9"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        السجل الكامل: <span className="tabular-nums">{room.census.total}</span> ذكاءً · مرتبط بمسار تنفيذ:{" "}
        <span className="tabular-nums">{room.census.byWiring.wired}</span> · طبقة تُستدعى:{" "}
        <span className="tabular-nums">{room.census.byWiring.passive}</span> · نائم:{" "}
        <span className="tabular-nums">{room.census.byWiring.dormant}</span>
      </p>

      {/* ── بطاقات الوكلاء ── */}
      {grouped.map(([dept, list]) => (
        <div key={dept} className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">
            {dept} · {list.length}
          </p>
          {list.map((row) => {
            const open = openKey === row.key;
            const caps = capDraft[row.key] ?? { h: String(row.capPerHour), d: String(row.capPerDay) };
            return (
              <Card key={row.key} className={cn("border", LEVEL_TONE[row.diagnosis.level] ?? "border-border/70")}>
                <CardHeader className="cursor-pointer pb-2" onClick={() => setOpenKey(open ? null : row.key)}>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-lg">{row.emoji}</span>
                    <span className="font-bold">{row.name}</span>
                    <Badge variant="outline" className="rounded-full font-mono text-[9px]">{row.key}</Badge>
                    <Badge variant="outline" className={cn("rounded-full text-[9px]", LEVEL_TONE[row.diagnosis.level])}>
                      {LEVEL_LABEL[row.diagnosis.level] ?? row.diagnosis.level} · {row.headline}
                    </Badge>
                    {row.job && (
                      <Badge variant="outline" className="rounded-full text-[9px]">
                        <Timer className="me-0.5 size-2.5" /> كل {row.job.intervalMinutes >= 1440 ? `${Math.round(row.job.intervalMinutes / 1440)} يوم` : `${row.job.intervalMinutes} د`}
                      </Badge>
                    )}
                    {row.unit && row.unit.eventCount > 0 && (
                      <Badge variant="outline" className="rounded-full text-[9px] tabular-nums">{row.unit.eventCount} حدث</Badge>
                    )}
                    <span className="ms-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {row.hourUsed}/{row.capPerHour || "∞"} س · {row.dayUsed}/{row.capPerDay || "∞"} ي
                      </span>
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={async (v) => {
                          try {
                            await setEnabled({ key: row.key, enabled: v });
                            toast.success(v ? `${row.name}: يعمل` : `${row.name}: أُوقف`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر التبديل");
                          }
                        }}
                      />
                    </span>
                  </CardTitle>
                </CardHeader>

                {open && (
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-[11px] leading-relaxed text-foreground/80">{row.entry.purpose}</p>
                    <div className="grid gap-1.5 text-[10px] text-muted-foreground sm:grid-cols-2">
                      <span>📁 الملف: <span className="font-mono text-foreground/70">{row.entry.module}</span></span>
                      <span>👥 النوع: {row.kind} · الربط: {row.wiring}</span>
                      <span>⚡ يستهلك: {row.entry.consumes}</span>
                      <span>📊 تنفيذات: <span className="tabular-nums text-foreground/80">{row.totalRuns}</span> · أخطاء: <span className="tabular-nums">{row.totalErrors}</span></span>
                      {row.lastResult && <span className="sm:col-span-2">🧾 آخر نتيجة: {row.lastResult}</span>}
                      {row.note && <span className="sm:col-span-2">📝 ملاحظتك: {row.note}</span>}
                    </div>

                    {row.diagnosis.reasons.length > 0 && (
                      <ul className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-2 text-[11px]">
                        <li className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="size-3.5 text-amber-500" /> التشخيص الصادق
                        </li>
                        {row.diagnosis.reasons.map((r, i) => (
                          <li key={i} className="text-muted-foreground">• {r}</li>
                        ))}
                      </ul>
                    )}

                    {/* قدرات */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold">القدرات (منح/سحب فوري)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {row.entry.capabilities.map((cap) => {
                          const active = row.capabilities.includes(cap);
                          const revoked = row.revoked.includes(cap);
                          return (
                            <button
                              key={cap}
                              type="button"
                              onClick={async () => {
                                try {
                                  await setCapability({ key: row.key, capability: cap, granted: revoked });
                                  toast.success(revoked ? `أُعيدت قدرة ${cap}` : `سُحبت قدرة ${cap}`);
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "تعذّر التغيير");
                                }
                              }}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors",
                                revoked
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-600 line-through"
                                  : active
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "border-border/60 text-muted-foreground",
                              )}
                            >
                              {revoked ? <Ban className="me-1 inline size-2.5" /> : <Check className="me-1 inline size-2.5" />}
                              {cap}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* أشياء يمكن إيقافها بالاسم */}
                    {row.entry.stoppables.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold">إيقاف بالاسم</p>
                        <div className="flex flex-wrap gap-1.5">
                          {row.entry.stoppables.map((s) => {
                            const off = row.stopped.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await setStop({ key: row.key, feature: s, stopped: !off });
                                    toast.success(off ? `أُعيد «${s}»` : `أُوقف «${s}»`);
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
                                  }
                                }}
                                className={cn(
                                  "rounded-lg border px-2 py-1 text-[10px] transition-colors",
                                  off ? "border-rose-500/40 bg-rose-500/10 text-rose-600" : "border-border/60 hover:bg-muted",
                                )}
                              >
                                {off ? "⛔" : "▶️"} {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* الحصص */}
                    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/60 bg-muted/20 p-2">
                      <span className="flex items-center gap-1 text-[11px] font-bold"><Gauge className="size-3.5" /> الحصص (٠ = بلا حد)</span>
                      <label className="text-[10px] text-muted-foreground">
                        في الساعة
                        <Input
                          type="number"
                          min={0}
                          value={caps.h}
                          onChange={(e) => setCapDraft({ ...capDraft, [row.key]: { ...caps, h: e.target.value } })}
                          className="h-7 w-20 rounded-lg text-[11px]"
                        />
                      </label>
                      <label className="text-[10px] text-muted-foreground">
                        في اليوم
                        <Input
                          type="number"
                          min={0}
                          value={caps.d}
                          onChange={(e) => setCapDraft({ ...capDraft, [row.key]: { ...caps, d: e.target.value } })}
                          className="h-7 w-20 rounded-lg text-[11px]"
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={async () => {
                          try {
                            await setCaps({ key: row.key, perHour: Number(caps.h), perDay: Number(caps.d) });
                            toast.success("حُدّثت الحصة");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر التحديث");
                          }
                        }}
                      >
                        احفظ الحدّ
                      </Button>
                    </div>

                    {/* أوامر العرش */}
                    <div className="space-y-1.5 rounded-xl border border-primary/25 bg-primary/[0.03] p-2">
                      <p className="flex items-center gap-1 text-[11px] font-bold">
                        <Terminal className="size-3.5 text-primary" /> أوامر العرش لهذا الذكاء ({row.orders}/12)
                      </p>
                      <div className="flex gap-1.5">
                        <Input
                          value={orderDraft[row.key] ?? ""}
                          onChange={(e) => setOrderDraft({ ...orderDraft, [row.key]: e.target.value })}
                          placeholder="اكتب أمرك بالحرف — يُقرأ في سياق الوحدة عند دورتها"
                          maxLength={200}
                          className="h-8 rounded-lg text-[11px]"
                        />
                        <Button
                          size="sm"
                          className="rounded-lg"
                          onClick={async () => {
                            const text = orderDraft[row.key] ?? "";
                            try {
                              await addOrder({ key: row.key, text });
                              setOrderDraft({ ...orderDraft, [row.key]: "" });
                              toast.success("حُفظ الأمر وسيُنفَّذ في الدورة القادمة");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
                            }
                          }}
                        >
                          أضف
                        </Button>
                      </div>
                      {row.orderList.length > 0 && (
                        <div className="space-y-1">
                          {row.orderList.map((o) => (
                            <div key={o.id} className="flex items-center gap-2 text-[11px]">
                              <span className="flex-1 truncate">• {o.text}</span>
                              <button
                                type="button"
                                className="text-[10px] text-rose-600 hover:underline"
                                onClick={async () => {
                                  try {
                                    await clearOrders({ key: row.key, orderId: o.id });
                                    toast.success("حُذف الأمر");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "تعذّر الحذف");
                                  }
                                }}
                              >
                                حذف
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* التنفيذ */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="rounded-xl" disabled={busy === row.key} onClick={() => void doRun(row, false)}>
                        {busy === row.key ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} شغّل الآن
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl" disabled={busy === row.key} onClick={() => void doRun(row, true)}>
                        <Zap className="size-3.5" /> تشغيل قسري
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                        onClick={async () => {
                          const hours = window.prompt(`إيقاف ${row.name} لمدة كم ساعة؟ (٠ = بلا انتهاء)`, "6");
                          if (hours === null) return;
                          try {
                            const res = await setEnabled({ key: row.key, enabled: false, hours: Number(hours) });
                            toast.success(
                              res.hours > 0
                                ? `أُوقف ${row.name} حتى ${new Date(res.disabledUntil).toLocaleString("ar")}`
                                : `أُوقف ${row.name} بلا انتهاء`,
                            );
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر الإيقاف");
                          }
                        }}
                      >
                        <Power className="size-3.5" /> إيقاف لمدة أكتبها
                      </Button>
                      {Boolean(row.entry?.jobKey) && (
                        <span className="text-[10px] text-muted-foreground">مرتبط بالمهمة: <span className="font-mono">{row.entry.jobKey}</span></span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ms-auto rounded-xl text-[10px]"
                        onClick={async () => {
                          try {
                            const res = await seed({});
                            toast.success(`تحقق من السجل: ${res.total} ذكاءً`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر التحقق");
                          }
                        }}
                      >
                        تحقق من التسجيل
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">لا ذكاء يطابق «{q}» — جرّب كلمة أخرى.</p>
      )}

      {/* ── الحبل: السجل الموحّد ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            🔗 السجل الموحّد — كل ما فعله الوكلاء وكل قرار عليهم
            <span className="ms-auto text-[10px] font-normal text-muted-foreground">{room.ledger.length} سطراً</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {room.ledger.length === 0 && <p className="py-3 text-center text-[11px] text-muted-foreground">لا سجلات بعد — شغّل وكيلاً لتظهر آثاره هنا.</p>}
          {room.ledger.map((l, i) => (
            <div key={`${l.at}-${i}`} className="flex flex-wrap items-center gap-2 text-[11px]">
              <span>{l.emoji}</span>
              <span className="font-bold">{l.name}</span>
              <Badge variant="outline" className={cn("rounded-full text-[9px]", l.kind === "error" ? "border-rose-500/40 text-rose-600" : l.kind === "run" ? "border-emerald-500/40" : "")}>
                {l.kind}
              </Badge>
              <span className="text-muted-foreground">{l.actor}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.detail}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{new Date(l.at).toLocaleTimeString("ar")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
