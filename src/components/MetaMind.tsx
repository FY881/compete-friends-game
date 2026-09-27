import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "@/components/ui/button";

/**
 * 🜂 العقل الأعظم (MetaMind) — الأداة 27
 * وعي فوق المنظومة كلها: يقرأ ناقل القرارات الحقيقي ويشخّص صحة
 * كل أداة بالنشاط والعدالة والصمت، ويصدر نبضات وتشريحاً يومياً.
 *
 * ثيم «وعي كوني»: أسود عميق + عنبر/ذهبي مهيب.
 */

type Health = "alive" | "weak" | "silent" | "suspicious";

type ToolHealth = {
  system: string;
  label: string;
  events7d: number;
  events24h: number;
  silenceHours: number;
  unjustCount: number;
  health: Health;
};

type Pulse = {
  lifeScore: number;
  activeTools: number;
  totalTools: number;
  totalEvents: number;
  unjustTotal: number;
  narration: string;
  engine: string;
  healthJson: string;
  createdAt: number;
};

const HEALTH_META: Record<Health, { label: string; dot: string; chip: string }> = {
  alive: { label: "نبض", dot: "bg-emerald-400", chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  weak: { label: "ضعيف", dot: "bg-yellow-400", chip: "bg-yellow-400/10 text-yellow-300 border-yellow-400/30" },
  silent: { label: "صامت", dot: "bg-zinc-500", chip: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  suspicious: { label: "مشتبه", dot: "bg-red-400", chip: "bg-red-400/10 text-red-300 border-red-400/30" },
};

function fmtAgo(ts: number): string {
  if (!ts) return "—";
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60_000));
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return `قبل ${Math.round(hours / 24)} ي`;
}

export function MetaMind({ isAdmin }: { isAdmin: boolean }) {
  const data = useQuery(api.aiMeta.getMetaPulse, {});
  const history = useQuery(api.aiMeta.getMetaHistory, {});
  const forceDiagnosis = useMutation(api.aiMeta.forceDiagnosis);
  const [forcing, setForcing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const tools: ToolHealth[] = useMemo(() => {
    const raw = data?.pulse?.healthJson;
    if (!raw) return data?.snapshot?.healthByTool ?? [];
    try {
      return JSON.parse(raw) as ToolHealth[];
    } catch {
      return [];
    }
  }, [data]);

  const score = data?.pulse?.lifeScore ?? data?.snapshot?.lifeScore ?? 0;
  const active = data?.pulse?.activeTools ?? data?.snapshot?.activeTools ?? 0;
  const total = data?.pulse?.totalTools ?? data?.snapshot?.totalTools ?? 0;
  const events = data?.pulse?.totalEvents ?? data?.snapshot?.totalEvents ?? 0;
  const unjust = data?.pulse?.unjustTotal ?? data?.snapshot?.unjustTotal ?? 0;

  async function runDiagnosis() {
    setForcing(true);
    setError(null);
    setFlash(null);
    try {
      const res = await forceDiagnosis({});
      setFlash(`🜂 تشريح فوري: صحة ${res.lifeScore}% — ${res.narration.slice(0, 140)}…`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التشريح");
    } finally {
      setForcing(false);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4">
      {/* الرأس */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-5 shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)]">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-amber-200">🜂 العقل الأعظم</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              وعي فوق الأدوات كلها — يقرأ ناقل القرارات ويشخّص صحة المنظومة كما يفحص الطبيب مريضاً.
            </p>
          </div>
          <div className="shrink-0 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/50 bg-black/60">
              <span className="text-xl font-black text-amber-300">{score}%</span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">حياة المنظومة</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-amber-400/15 bg-black/40 p-2">
            <p className="text-sm font-bold text-amber-200">{active}/{total}</p>
            <p className="text-[10px] text-zinc-500">أدوات تنبض</p>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-black/40 p-2">
            <p className="text-sm font-bold text-amber-200">{events}</p>
            <p className="text-[10px] text-zinc-500">أحداث الأسبوع</p>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-black/40 p-2">
            <p className="text-sm font-bold text-amber-200">{unjust}</p>
            <p className="text-[10px] text-zinc-500">نقض المحكمة</p>
          </div>
        </div>
      </div>

      {/* النبضة الأخيرة */}
      {data?.pulse ? (
        <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">آخر نبضة</span>
            <span className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                {data.pulse.engine === "llm" ? "ذكاء" : "محلي"}
              </span>
              <span className="text-[10px] text-zinc-500">{fmtAgo(data.pulse.createdAt)}</span>
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-zinc-300">{data.pulse.narration}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-center text-xs text-zinc-500">
          لم تُصدر النبضة الأولى بعد — ستصل تلقائياً كل 6 ساعات.
        </div>
      )}

      {/* شبكة صحة الأدوات */}
      <div className="rounded-2xl border border-amber-400/20 bg-black/50 p-4">
        <p className="mb-3 text-xs font-bold text-amber-300">تشخيص الأدوات</p>
        <div className="space-y-2">
          {tools.map((t) => {
            const m = HEALTH_META[t.health];
            return (
              <div key={t.system} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                  <span className="text-[13px] font-medium text-zinc-200">{t.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">
                    {t.events7d} حدث · صمت {t.silenceHours === 999 ? "أبداً" : `${t.silenceHours}س`}
                    {t.unjustCount > 0 ? ` · ظلم ${t.unjustCount}` : ""}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${m.chip}`}>{m.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* التشريح الفوري — للمالك فقط */}
      {isAdmin && (
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-950/30 to-black/60 p-4">
          <p className="mb-2 text-xs font-bold text-amber-200">غرفة المالك</p>
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-400">
            أمر العقل الأعظم بتشريح فوري الآن — يتجاهل انتظار النبضة الدورية.
          </p>
          <Button
            onClick={runDiagnosis}
            disabled={forcing}
            className="w-full bg-gradient-to-l from-amber-500 to-yellow-600 font-bold text-black hover:from-amber-400 hover:to-yellow-500"
          >
            {forcing ? "جارٍ التشريح…" : "🜂 تشريح فوري"}
          </Button>
          {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
          {flash && <p className="mt-2 text-[11px] leading-relaxed text-amber-200">{flash}</p>}
        </div>
      )}

      {/* سجل النبضات */}
      {history && history.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="mb-2 text-xs font-bold text-zinc-300">سجل النبضات (آخر 10)</p>
          <div className="space-y-1.5">
            {history.map((h: Pulse) => (
              <div key={h.createdAt} className="flex items-center justify-between gap-2 border-b border-zinc-900 pb-1.5 text-[11px] last:border-0">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="font-bold text-amber-300">{h.lifeScore}%</span>
                  <span>· {h.activeTools}/{h.totalTools} نبض</span>
                </span>
                <span className="text-zinc-600">{fmtAgo(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
