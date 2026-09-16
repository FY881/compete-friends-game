import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  BrainCircuit,
  Loader2,
  Radio,
  Minus,
  Plus,
  ScrollText,
  Search,
  Power,
  GitBranch,
  HeartPulse,
  Activity,
} from "lucide-react";

/**
 * 🧠 مركز الذكاء الموحد — سقف واحد لكل وحدات الذكاء في «حرب العقول».
 *
 *  كل ما يظهر هنا حقيقي ومربوط بالخادم مباشرة:
 *   • مفتاح رئيسي واحد يُشغّل أو يوقف كل الوحدات فعلياً
 *   • حالة كل وحدة + حساسيتها + صحتها المحسوبة من أحداثها الحقيقية (24س)
 *   • خريطة الترابط: من رصد ماذا، ومن بنى على ملاحظة من (أحداث فعلية)
 *   • السجل الموحد القابل للبحث والفلترة من الخادم (وحدة/خطورة/نص/نافذة زمنية)
 */

const UNIT_EMOJI: Record<string, string> = {
  coach: "🎯",
  referee: "⚖️",
  guardian: "🛡️",
  reports: "📨",
  governor: "🤖",
  questions: "📚",
  health: "❤️",
  recommender: "✨",
  personalizer: "🧬",
  notifier: "🔔",
  doctor: "🩺",
};

const SEV_LABEL: Record<string, string> = { info: "معلومة", warn: "تحذير", critical: "حرج" };
const SEV_STYLE: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600",
};

const KIND_LABEL: Record<string, string> = {
  observation: "رصد",
  alert: "تنبيه",
  decision: "قرار",
  config: "ضبط",
  cross_reference: "ترابط",
  sync: "مزامنة",
};

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

function healthTone(health: number) {
  if (health >= 85) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (health >= 60) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-rose-500", text: "text-rose-600" };
}

export function AiHubTab() {
  const hub = useQuery(api.aiHub.getHubOverview, {});
  const configure = useMutation(api.aiHub.configureUnit);
  const setMaster = useMutation(api.aiHub.setMasterSwitch);

  const [busy, setBusy] = useState<string | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);

  // مرشّحات السجل الموحد — تُنفَّذ على الخادم
  const [text, setText] = useState("");
  const [sev, setSev] = useState<string>("");
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [hours, setHours] = useState<number>(72);

  const log = useQuery(api.aiHub.getHubLog, {
    unit: unitFilter || undefined,
    severity: sev || undefined,
    text: text.trim() || undefined,
    hours,
    limit: 80,
  });
  const map = useQuery(api.aiHub.getLinkageMap, { days: 7 });

  const unitName = useMemo(() => {
    const m = new Map<string, string>();
    (hub?.units ?? []).forEach((u) => m.set(u.unit, u.name));
    return m;
  }, [hub]);

  const toggleUnit = async (unit: string, enabled: boolean) => {
    setBusy(unit);
    try {
      await configure({ unit, enabled });
      toast.success(enabled ? "تم تفعيل الوحدة — تعمل الآن." : "تم تعطيل الوحدة — توقفت عن التسجيل والتصرف.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الضبط.");
    } finally {
      setBusy(null);
    }
  };

  const bumpSensitivity = async (unit: string, current: number, delta: number) => {
    const next = Math.max(1, Math.min(10, current + delta));
    if (next === current) return;
    setBusy(unit);
    try {
      await configure({ unit, sensitivity: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الضبط.");
    } finally {
      setBusy(null);
    }
  };

  const toggleMaster = async (enabled: boolean) => {
    setMasterBusy(true);
    try {
      await setMaster({ enabled });
      toast.success(
        enabled
          ? "✅ المفتاح الرئيسي مفعّل — كل الوحدات تعمل تحت سقف واحد."
          : "⏸️ المفتاح الرئيسي موقوف — توقف كل الذكاء والجسر فعلياً.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الضبط.");
    } finally {
      setMasterBusy(false);
    }
  };

  const masterEnabled = hub?.masterEnabled ?? true;
  const totals = hub?.totals;

  return (
    <div dir="rtl" className="space-y-5">
      {/* ═══ الترويسة + المفتاح الرئيسي ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <BrainCircuit className="size-5" />
            <span
              className={cn(
                "absolute -end-1 -top-1 size-3 rounded-full border-2 border-card",
                masterEnabled ? "owner-status-live bg-emerald-500" : "bg-slate-400",
              )}
            />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">مركز الذكاء الموحد</h2>
            <p className="text-xs text-muted-foreground">
              كل وحدات الذكاء تحت سقف واحد — سياق مشترك، ترابط حقيقي، ضبط مركزي، سجل موحد
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-3 py-2",
            masterEnabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/60 bg-muted/30",
          )}
        >
          <Power className={cn("size-4", masterEnabled ? "text-emerald-600" : "text-muted-foreground")} />
          <div className="leading-tight">
            <p className="text-xs font-bold">المفتاح الرئيسي</p>
            <p className="text-[10px] text-muted-foreground">
              {masterEnabled ? "كل الوحدات مسموح لها بالعمل" : "كل الذكاء موقوف مؤقتاً"}
            </p>
          </div>
          {masterBusy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch checked={masterEnabled} onCheckedChange={toggleMaster} />
          )}
        </div>
      </div>

      {/* ═══ مؤشرات المركز ═══ */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Activity, label: "أحداث 24 ساعة", value: totals?.events24h ?? 0, tone: "text-sky-600" },
          { icon: HeartPulse, label: "متوسط صحة الوحدات", value: `${totals?.avgHealth ?? 100}%`, tone: "text-emerald-600" },
          { icon: Radio, label: "وحدات نشطة الآن", value: totals?.activeUnits ?? 0, tone: "text-primary" },
          { icon: GitBranch, label: "روابط ترابط (7 أيام)", value: map?.totalLinks ?? 0, tone: "text-violet-600" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
            <s.icon className={cn("size-4 shrink-0", s.tone)} />
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-base font-black tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {(totals?.critical24h ?? 0) > 0 && masterEnabled && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600">
          ⚠️ {totals!.critical24h} حدثاً حرجاً خلال 24 ساعة — راجع السجل الموحد بالأسفل
        </div>
      )}

      {/* ═══ الوحدات ═══ */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {hub === undefined || hub === null ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">جارٍ تحميل المركز…</p>
        ) : (
          hub.units.map((u) => {
            const tone = healthTone(u.health);
            const off = !u.enabled || !masterEnabled;
            return (
              <div
                key={u.unit}
                className={cn(
                  "rounded-2xl border p-3.5 transition-all hover:shadow-md",
                  off ? "border-dashed border-border/50 bg-muted/20 opacity-70" : "border-border/70 bg-card",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{UNIT_EMOJI[u.unit] ?? "🧩"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">{u.dept}</p>
                  </div>
                  {u.activeNow && u.enabled && masterEnabled && (
                    <Radio className="owner-status-live size-3.5 text-emerald-500" />
                  )}
                  {busy === u.unit ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch checked={u.enabled} onCheckedChange={(v) => toggleUnit(u.unit, v)} />
                  )}
                </div>

                <p className="mt-2 min-h-8 text-[10px] leading-relaxed text-muted-foreground">{u.desc}</p>

                {/* صحة الوحدة — محسوبة من أحداثها الحقيقية */}
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">الصحة</span>
                    <span className={cn("font-bold tabular-nums", tone.text)}>{u.health}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${u.health}%` }} />
                  </div>
                  {(u.critical24h > 0 || u.warn24h > 0) && (
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {u.critical24h} حرج · {u.warn24h} تحذير خلال 24س
                    </p>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-6 rounded-lg p-0"
                      onClick={() => bumpSensitivity(u.unit, u.sensitivity, -1)}
                      disabled={busy === u.unit || u.sensitivity <= 1}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-16 text-center text-[10px] text-muted-foreground">حساسية {u.sensitivity}/10</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-6 rounded-lg p-0"
                      onClick={() => bumpSensitivity(u.unit, u.sensitivity, 1)}
                      disabled={busy === u.unit || u.sensitivity >= 10}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{u.eventCount} حدث</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══ خريطة الترابط الحقيقية ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-violet-600" />
            <h3 className="text-sm font-bold">خريطة الترابط — من بنى على ملاحظة من</h3>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px]">
            نافذة {map?.windowDays ?? 7} أيام · {map?.totalLinks ?? 0} رابط
          </Badge>
        </div>
        <div className="grid gap-3 p-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            {map === undefined ? (
              <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
            ) : !map || map.edges.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                لا روابط بعد — الجسر يبنيها كل 15 دقيقة عند وجود إشارة حقيقية.
              </p>
            ) : (
              map.edges.map((e, i) => (
                <div
                  key={`${e.from}-${e.to}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                >
                  <span className="shrink-0">{UNIT_EMOJI[e.from] ?? "🧩"}</span>
                  <span className="shrink-0 font-bold">{e.fromName}</span>
                  <span className="shrink-0 text-violet-600">⟶</span>
                  <span className="shrink-0">{UNIT_EMOJI[e.to] ?? "🧩"}</span>
                  <span className="shrink-0 font-bold">{e.toName}</span>
                  <Badge variant="outline" className="ms-auto shrink-0 rounded-full text-[9px] tabular-nums">
                    ×{e.count}
                  </Badge>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">
              الأكثر استقبالاً للإشارات (من تحرّك بناءً على بياناته)
            </p>
            <div className="space-y-1">
              {(map?.listened ?? []).map((l) => {
                const max = Math.max(1, ...(map?.listened ?? []).map((x) => x.listened));
                return (
                  <div key={l.unit} className="flex items-center gap-2 text-[11px]">
                    <span className="w-24 shrink-0 truncate">{l.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-violet-500/70"
                        style={{ width: `${(l.listened / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-end tabular-nums text-muted-foreground">{l.listened}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ السجل الموحد — بحث وفلترة من الخادم ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3">
          <ScrollText className="size-4 text-primary" />
          <h3 className="text-sm font-bold">السجل الموحد — كل قرارات وملاحظات الذكاء</h3>
          <Badge variant="outline" className="ms-auto rounded-full text-[10px] tabular-nums">
            {log?.total ?? 0} نتيجة من {log?.scanned ?? 0} حدث
          </Badge>
        </div>

        {/* أدوات الفلترة */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-muted/10 px-3 py-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ابحث في نص الملخصات…"
              className="h-8 ps-7 text-xs"
            />
          </div>

          <div className="flex items-center gap-1">
            {[
              { k: "", l: "الكل" },
              { k: "info", l: "معلومة" },
              { k: "warn", l: "تحذير" },
              { k: "critical", l: "حرج" },
            ].map((s) => (
              <Button
                key={s.k || "all"}
                size="sm"
                variant={sev === s.k ? "default" : "outline"}
                className="h-8 rounded-lg px-2.5 text-[11px]"
                onClick={() => setSev(s.k)}
              >
                {s.l}
              </Button>
            ))}
          </div>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px]"
            aria-label="فلترة حسب الوحدة"
          >
            <option value="">كل الوحدات</option>
            {(hub?.units ?? []).map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={String(hours)}
            onChange={(e) => setHours(Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px]"
            aria-label="النافذة الزمنية"
          >
            {[6, 24, 72, 168].map((h) => (
              <option key={h} value={h}>
                {h >= 168 ? "آخر 7 أيام" : `آخر ${h} ساعة`}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-96 space-y-1.5 overflow-y-auto p-3">
          {log === undefined ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : !log || log.rows.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              لا نتائج مطابقة — عدّل الفلاتر أو انتظر نبضة الجسر القادمة.
            </p>
          ) : (
            log.rows.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs"
              >
                <Badge variant="outline" className={cn("rounded-full px-1.5 text-[9px]", SEV_STYLE[e.severity])}>
                  {SEV_LABEL[e.severity] ?? e.severity}
                </Badge>
                <span className="shrink-0">{UNIT_EMOJI[e.unit] ?? "🧩"}</span>
                <span className="shrink-0 font-bold">{unitName.get(e.unit) ?? e.unit}</span>
                <Badge variant="outline" className="shrink-0 rounded-full text-[9px]">
                  {KIND_LABEL[e.kind] ?? e.kind}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{e.summary}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ar(e.at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
