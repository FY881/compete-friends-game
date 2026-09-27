import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Compass, Flame, CloudSun, Sparkles, ArrowLeft, Clock } from "lucide-react";

/**
 * 🧭 بوصلة العقول — تمسح كل الأنظمة الحية وتقول لك: أهم 3 حركات الآن،
 * بمبرر وموعد أقصى، وزر «توجّه الآن» يفتح الأداة الصحيحة مباشرة.
 */

type Move = {
  rank: number;
  title: string;
  detail: string;
  reason: string;
  target: string;
  emoji: string;
  urgency: "high" | "medium" | "low";
  deadline?: number;
};

type CompassData = {
  moves: Move[];
  scannedAt: number | null;
  source: "cache" | "live" | "anon";
};

const URGENCY_META: Record<Move["urgency"], { label: string; icon: typeof Flame; color: string; ring: string }> = {
  high: { label: "عاجل", icon: Flame, color: "text-rose-300", ring: "border-rose-500/40 bg-rose-950/20" },
  medium: { label: "مهم", icon: CloudSun, color: "text-amber-300", ring: "border-amber-500/35 bg-amber-950/15" },
  low: { label: "فرصة", icon: Sparkles, color: "text-emerald-300", ring: "border-emerald-500/30 bg-emerald-950/15" },
};

function deadlineText(d?: number): string | null {
  if (!d) return null;
  const ms = d - Date.now();
  if (ms <= 0) return "انتهى";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)} يوم`;
  if (h >= 1) return `${h} ساعة`;
  return `${Math.max(1, Math.floor(ms / 60_000))} دقيقة`;
}

export function MindsCompass() {
  const data = useQuery(api.aiCompass.getMyCompass) as CompassData | undefined;
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  // 📡 إرسال حدث التوجّه — يستقبله مستمع عالمي في Play.tsx يفتح التبويب
  const navigate = (target: string) => {
    setBusyTarget(target);
    window.dispatchEvent(new CustomEvent<string>("minds-compass-go", { detail: target }));
    setTimeout(() => setBusyTarget(null), 900);
  };

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const moves = data?.moves ?? [];
  const source = data?.source ?? "anon";

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-b from-sky-950/40 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-sky-300" />
          <h2 className="text-lg font-bold text-sky-100">بوصلة العقول</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-sky-200/70">
          25 نظاماً حربياً وحيدة المشكلة: ماذا أفعل الآن؟ البوصلة تمسح نزالاتك وخططك وتحالفك وحربك ورهاناتك ودعاواك
          وتقول لك أهم 3 حركات — بمبرر وموعد أقصى.
        </p>
        {data?.scannedAt && (
          <p className="mt-1 text-[10px] text-sky-200/50">
            آخر مسح شامل: {Math.round((now - data.scannedAt) / 60000)} دقيقة ({source === "live" ? "مسح حي" : "لقطة محدثة"})
          </p>
        )}
      </div>

      {/* الحركات */}
      {moves.length === 0 && source !== "anon" ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5 text-center">
          <Compass className="mx-auto h-8 w-8 text-emerald-400/70" />
          <p className="mt-2 text-sm text-emerald-200">كل الساحات هادئة — لا حركات ملحّة الآن.</p>
          <p className="mt-1 text-[11px] text-slate-400">
            العب جولة، أو استدعِ شبحاً، أو سجّل تحالفك — والبوصلة ستقودك حين يحين الأمر.
          </p>
        </div>
      ) : (
        moves.map((m) => {
          const meta = URGENCY_META[m.urgency];
          const Icon = meta.icon;
          const dl = deadlineText(m.deadline);
          return (
            <div key={m.rank} className={`rounded-2xl border p-4 ${meta.ring}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.emoji}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      <span className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                      <span className="text-[9px] text-slate-500">#{m.rank}</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-100">{m.title}</h3>
                  </div>
                </div>
                {dl && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300">
                    <Clock className="h-3 w-3" /> {dl}
                  </span>
                )}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-200">{m.detail}</p>
              <p className="mt-1 text-[11px] italic leading-relaxed text-slate-400">{m.reason}</p>

              <button
                onClick={() => navigate(m.target)}
                disabled={busyTarget === m.target}
                className="mt-3 w-full rounded-lg bg-sky-600/85 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
              >
                <ArrowLeft className="ml-1 inline h-3.5 w-3.5" />
                {busyTarget === m.target ? "جارٍ التوجيه…" : "توجّه الآن"}
              </button>
            </div>
          );
        })
      )}

      {/* كيف تعمل */}
      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        المسح الحي عند فتح البوصلة، ولقطات محدثة كل ساعة للاعبين النشطين، وكاش 10 دقائق يحمي خادم اللعبة — الأهمية
        تُرتّب: عاجل (خسارة وشيك) ثم مهم (مجد يُبنى) ثم فرصة.
      </p>
    </div>
  );
}
