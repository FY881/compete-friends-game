import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Gavel,
  HeartPulse,
  Loader2,
  Radio,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 سقف الذكاء الموحّد — كل وحدات الـ AI تحت إدارة واحدة
 * ═══════════════════════════════════════════════════════════════════════
 * هنا يرى المالك السقف كاملاً ويمسك مفاصله فعلاً:
 *   • حساسية كل وحدة تُغيّر سلوكها الحقيقي (حدود الحجب والتنبيه ومعدّل الرسائل)
 *   • ملفات جاهزة بضغطة: متشدّد · متوازن · متسامح
 *   • السياق المشترك الحيّ من الأنظمة الحقيقية (عقول · عشائر · بلاغات · أخطاء)
 *   • صحة كل وحدة (تعمل/صامتة/متقادمة) ودرجة صحة السقف
 *   • الخلافات بين الوحدات: يُحسم أيّها أوثق — فيتعلّم النظام من قراره
 * ═══════════════════════════════════════════════════════════════════════
 */

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

const STATUS_TONE: Record<string, string> = {
  healthy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  idle: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  stale: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  silent: "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  noisy: "border-violet-500/40 bg-violet-500/10 text-violet-700",
  disabled: "border-rose-500/40 bg-rose-500/10 text-rose-700",
};

const SEV_TONE: Record<string, string> = {
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-700",
};

export function AiRoofPanel() {
  const data = useQuery(api.aiRoof.getUnifiedRoof);
  const setSensitivity = useMutation(api.aiRoof.setUnitSensitivity);
  const applyProfile = useMutation(api.aiRoof.applyRoofProfile);
  const scanNow = useMutation(api.aiRoof.scanNow);
  const resolve = useMutation(api.aiRoof.resolveConflict);

  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (data === null) return null;

  const { pulse, units, contextLines, contextAlerts, events, conflicts, profiles } = data;

  const run = async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ الأمر");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden border-violet-500/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-violet-500/5 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <BrainCircuit className="size-4 text-violet-500" />
          سقف الذكاء الموحّد
          <span className="text-[10px] font-normal text-muted-foreground">
            حساسية حقيقية · سياق مشترك · خلافات تُحسم بقرارك
          </span>
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={busy === "scan"}
          onClick={() => run("scan", () => scanNow({}))}
        >
          {busy === "scan" ? <Loader2 className="size-3 animate-spin" /> : <ScanSearch className="size-3.5" />}
          افحص الخلافات
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* ═══ نبضة السقف ═══ */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { icon: HeartPulse, label: "صحة السقف", value: `${pulse.score}/100` },
            { icon: Zap, label: "وحدات تعمل", value: `${pulse.healthy} / ${pulse.totalUnits}` },
            { icon: ShieldAlert, label: "معطّلة / صامتة", value: `${pulse.disabled} / ${pulse.silent}` },
            { icon: Sparkles, label: "متوسط الحساسية", value: `${pulse.avgSensitivity}/10` },
            { icon: Gavel, label: "خلافات بانتظارك", value: `${conflicts.length}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="mt-1.5 text-base font-black tabular-nums leading-none">{s.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ═══ ملفات جاهزة ═══ */}
        <div className="rounded-2xl border border-border/70 p-3">
          <p className="mb-2 text-xs font-bold">ملف واحد لكل الوحدات — بضغطة</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {profiles.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="h-auto justify-start gap-2 py-2 text-start text-[11px]"
                disabled={busy === `profile:${p.id}`}
                onClick={() => run(`profile:${p.id}`, () => applyProfile({ profile: p.id }))}
              >
                {busy === `profile:${p.id}` ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <span className="text-base leading-none">{p.icon}</span>
                )}
                <span>
                  <span className="block font-bold">{p.name}</span>
                  <span className="block text-[10px] font-normal text-muted-foreground">{p.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* ═══ السياق المشترك الحيّ ═══ */}
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
            <Radio className="size-3.5 text-violet-500" />
            السياق المشترك الحيّ — ما تقرأه كل وحدة قبل قرارها
          </p>
          <ul className="space-y-1">
            {contextLines.map((line) => (
              <li key={line} className="text-[11px] leading-relaxed text-muted-foreground">
                • {line}
              </li>
            ))}
          </ul>
          {contextAlerts.length > 0 && (
            <div className="mt-2 space-y-1">
              {contextAlerts.map((a) => (
                <p
                  key={a.text}
                  className={cn(
                    "rounded-xl border px-2.5 py-1.5 text-[11px] font-bold",
                    SEV_TONE[a.severity] ?? SEV_TONE.info,
                  )}
                >
                  {a.text}
                </p>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            الأرقام أعلاه محسوبة مباشرة من: العقول · العشائر وخزائنها · البلاغات · أخطاء النظام.
          </p>
        </div>

        {/* ═══ الخلافات بين الوحدات ═══ */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <AlertTriangle className="size-3.5" />
            خلافات الوحدات — تحتاج قرارك
          </p>
          {conflicts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              لا خلافات معلّقة — كل الوحدات متفقة، أو لم يقع حدث يستحق الاختلاف ✅
            </p>
          ) : (
            <ul className="space-y-2">
              {conflicts.map((c) => (
                <li key={c.id} className="rounded-xl border border-border/60 bg-card/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold">
                      هدف: {c.target}
                      <Badge variant="outline" className={cn("ms-2 rounded-full text-[9px]", SEV_TONE[c.severity] ?? SEV_TONE.warn)}>
                        {c.severity === "critical" ? "حرج" : "يحتاج مراجعة"}
                      </Badge>
                    </p>
                    <span className="text-[10px] text-muted-foreground">{ar(c.at)}</span>
                  </div>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    <div className="rounded-lg bg-rose-500/5 p-2">
                      <p className="text-[10px] font-bold text-rose-600">{c.unitA} — يشدّد</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{c.summaryA}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/5 p-2">
                      <p className="text-[10px] font-bold text-emerald-600">{c.unitB} — يُخفّف</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{c.summaryB}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={busy === `resolve:${c.id}`}
                      onClick={() =>
                        run(`resolve:${c.id}`, () =>
                          resolve({ conflictId: c.id as Id<"aiConflicts">, winner: c.unitA }),
                        )
                      }
                    >
                      الراجح: {c.unitA}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={busy === `resolve:${c.id}`}
                      onClick={() =>
                        run(`resolve:${c.id}`, () =>
                          resolve({ conflictId: c.id as Id<"aiConflicts">, winner: c.unitB }),
                        )
                      }
                    >
                      الراجح: {c.unitB}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-muted-foreground"
                      disabled={busy === `resolve:${c.id}`}
                      onClick={() =>
                        run(`resolve:${c.id}`, () =>
                          resolve({ conflictId: c.id as Id<"aiConflicts">, winner: "", dismiss: true }),
                        )
                      }
                    >
                      لا خلاف فعلي
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ═══ الوحدات: الحساسية الحقيقية ═══ */}
        <div>
          <p className="mb-2 text-xs font-bold">الوحدات — حساسية تُغيّر السلوك فعلاً</p>
          <ul className="space-y-2">
            {units.map((u) => (
              <li key={u.unit} className="rounded-2xl border border-border/70 bg-card/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold">
                      {u.name}
                      <Badge variant="outline" className={cn("rounded-full text-[9px]", STATUS_TONE[u.status] ?? "")}>
                        {u.statusLabel}
                      </Badge>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {u.policyLabel} · {u.eventCount} حدث
                        {u.lastEventAt ? ` · آخرها ${ar(u.lastEventAt)}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{u.effect}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">مفعّلة</span>
                    <Switch
                      checked={u.enabled}
                      disabled={busy === `unit:${u.unit}`}
                      onCheckedChange={(v) =>
                        run(`unit:${u.unit}`, () => setSensitivity({ unit: u.unit, enabled: v }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <Slider
                    value={[u.sensitivity]}
                    min={1}
                    max={10}
                    step={1}
                    disabled={busy === `unit:${u.unit}`}
                    onValueCommit={(v) =>
                      run(`unit:${u.unit}`, () => setSensitivity({ unit: u.unit, sensitivity: v[0] }))
                    }
                    className="flex-1"
                  />
                  <span className="w-10 shrink-0 text-center text-[11px] font-black tabular-nums">
                    {u.sensitivity}/10
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded-full bg-muted/50 px-2 py-0.5">حجب عند {u.blockAt}/10</span>
                  <span className="rounded-full bg-muted/50 px-2 py-0.5">تنبيه عند {u.warnAt}/10</span>
                  <span className="rounded-full bg-muted/50 px-2 py-0.5">{u.rateLimitPerMinute} رسالة/دقيقة</span>
                  <span className="rounded-full bg-muted/50 px-2 py-0.5">تحمّل {u.strikeTolerance} مخالفة</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ═══ آخر أحداث السقف ═══ */}
        <div className="rounded-2xl border border-border/70 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
            <CheckCircle2 className="size-3.5 text-violet-500" />
            آخر قرارات وإشارات السقف (كل الوحدات في مجرى واحد)
          </p>
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              لا أحداث خلال ٢٤ ساعة — السقف جاهز وبانتظار نشاط اللاعبين.
            </p>
          ) : (
            <ul className="space-y-1">
              {events.slice(0, 12).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Badge variant="outline" className={cn("rounded-full text-[9px]", SEV_TONE[e.severity] ?? "")}>
                    {e.severity === "critical" ? "حرج" : e.severity === "warn" ? "تنبيه" : "معلومة"}
                  </Badge>
                  <span className="font-bold">{e.unit}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.summary}</span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{ar(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ═══ خريطة الترابط ═══ */}
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
          <p className="mb-2 text-xs font-bold">كيف تعمل الوحدات تحت سقف واحد؟</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {[
              { icon: "🧠", text: "كل وحدة تقرأ سياستها المشتقّة من حساسيتها قبل قرارها — فالحساسية قرار لا رقم مخزَّن" },
              { icon: "🛡️", text: "حارس الرقابة يطبّق سياسته على دردشة العشائر فوراً: حجب أبكر ومعدّل أقل عند التشديد" },
              { icon: "📡", text: "السياق المشترك يُبنى من العقول والعشائر والبلاغات والأخطاء — قراءة واحدة تفهمها كل الوحدات" },
              { icon: "⚖️", text: "عند اختلاف وحدتين على نفس الهدف يُعرض الخلاف عليك، وقرارك يُسجَّل في السجل الموحّد للتعلم" },
              { icon: "⏱️", text: "مهمة «كشف الخلافات» مسجّلة في مركز المهام (معطّلة افتراضياً) — تشغّلها متى شئت بلا نشر" },
              { icon: "🎖️", text: "كل ضبط يُكتب في سجل التدقيق: من ضبط ماذا ومتى وبأي أثر" },
            ].map((r) => (
              <li key={r.text} className="flex items-start gap-2 rounded-xl bg-background/60 p-2">
                <span className="text-sm">{r.icon}</span>
                <span className="text-[10px] leading-relaxed text-muted-foreground">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
