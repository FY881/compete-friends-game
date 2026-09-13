import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useState } from "react";
import {
  BrainCircuit,
  Loader2,
  Radio,
  Minus,
  Plus,
  ScrollText,
} from "lucide-react";

/**
 * 🧠 مركز الذكاء الموحد — لوحة سيطرة المالك على كل وحدات AI:
 * حالة كل وحدة + تفعيل/تعطيل + حساسية + سجل موحد لكل قرارات الذكاء.
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
};

const SEV_STYLE: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600",
};

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

export function AiHubTab() {
  const hub = useQuery(api.aiHub.getHubOverview, {});
  const configure = useMutation(api.aiHub.configureUnit);
  const [busy, setBusy] = useState<string | null>(null);

  const toggleUnit = async (unit: string, enabled: boolean) => {
    setBusy(unit);
    try {
      await configure({ unit, enabled });
      toast.success(enabled ? "تم تفعيل الوحدة." : "تم تعطيل الوحدة — تتوقف عن العمل فوراً.");
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

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <BrainCircuit className="size-5" />
            <span className="owner-status-live absolute -end-1 -top-1 size-3 rounded-full border-2 border-card bg-emerald-500" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">مركز الذكاء الموحد</h2>
            <p className="text-xs text-muted-foreground">
              كل وحدات الذكاء تحت سقف واحد — سياق مشترك، ضبط مركزي، سجل موحد
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="rounded-full">{hub?.totals.events24h ?? 0} حدث/24س</Badge>
          {(hub?.totals.critical24h ?? 0) > 0 && (
            <Badge className="rounded-full bg-rose-500/15 text-rose-600">{hub!.totals.critical24h} حرج</Badge>
          )}
        </div>
      </div>

      {/* ═══ الوحدات ═══ */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {hub === undefined || hub === null ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">جارٍ تحميل المركز…</p>
        ) : (
          hub.units.map((u) => (
            <div
              key={u.unit}
              className={cn(
                "rounded-2xl border p-3.5 transition-all hover:shadow-md",
                u.enabled ? "border-border/70 bg-card" : "border-dashed border-border/50 bg-muted/20 opacity-70",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{UNIT_EMOJI[u.unit] ?? "🧩"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">{u.dept}</p>
                </div>
                {u.activeNow && u.enabled && (
                  <Radio className="owner-status-live size-3.5 text-emerald-500" />
                )}
                {busy === u.unit ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch checked={u.enabled} onCheckedChange={(v) => toggleUnit(u.unit, v)} />
                )}
              </div>
              <p className="mt-2 min-h-8 text-[10px] leading-relaxed text-muted-foreground">{u.desc}</p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="size-6 rounded-lg p-0" onClick={() => bumpSensitivity(u.unit, u.sensitivity, -1)} disabled={busy === u.unit || u.sensitivity <= 1}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-16 text-center text-[10px] text-muted-foreground">حساسية {u.sensitivity}/10</span>
                  <Button size="sm" variant="ghost" className="size-6 rounded-lg p-0" onClick={() => bumpSensitivity(u.unit, u.sensitivity, 1)} disabled={busy === u.unit || u.sensitivity >= 10}>
                    <Plus className="size-3" />
                  </Button>
                </div>
                <span className="text-[10px] text-muted-foreground">{u.eventCount} حدث</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══ السجل الموحد ═══ */}
      <div className="rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <ScrollText className="size-4 text-primary" />
          <h3 className="text-sm font-bold">السجل الموحد — كل قرارات وملاحظات الذكاء</h3>
        </div>
        <div className="max-h-96 space-y-1.5 overflow-y-auto p-3">
          {hub === undefined || hub === null || hub.events.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              لا أحداث بعد — الجسر يجمع الإشارات كل 15 دقيقة.
            </p>
          ) : (
            hub.events.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                <Badge variant="outline" className={cn("rounded-full px-1.5 text-[9px]", SEV_STYLE[e.severity])}>
                  {e.severity === "critical" ? "حرج" : e.severity === "warn" ? "تحذير" : "معلومة"}
                </Badge>
                <span className="shrink-0">{UNIT_EMOJI[e.unit] ?? "🧩"}</span>
                <span className="shrink-0 font-bold">{hub.units.find((u) => u.unit === e.unit)?.name ?? e.unit}</span>
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
