import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Microscope, Zap, TrendingDown, Anchor, Compass, Flame, Target } from "lucide-react";

/**
 * 🔍 مرصد العادات — ما لا تعرفه عن نفسك، مُقاساً بالأرقام
 * 5 عادات خفية تُشخَّص من إجاباتك، وتحدٍّ أسبوعي واحد لكسر الأسوأ منها.
 */

type HabitProfile = {
  name: string;
  sample: number;
  hasteIndex: number;
  collapseIndex: number;
  stubbornnessIndex: number;
  avoidanceIndex: number;
  lateIgnitionIndex: number;
  weakestCategory: string | null;
  strengths: string[];
};

type Challenge = {
  _id: string;
  habit: string;
  title: string;
  goal: string;
  beforeIndex: number;
  afterIndex?: number;
  reward?: number;
  status: "active" | "broken" | "relapsed";
  judgeAt: number;
};

const HABITS: {
  key: string;
  label: string;
  icon: typeof Zap;
  color: string;
  hint: string;
}[] = [
  { key: "haste", label: "التسرّع", icon: Zap, color: "text-yellow-300", hint: "إجابات أسرع من 3 ثوانٍ خاطئة" },
  { key: "collapse", label: "الانهيار", icon: TrendingDown, color: "text-red-300", hint: "تراجع الدقة في آخر الجولة" },
  { key: "stubbornness", label: "العناد", icon: Anchor, color: "text-orange-300", hint: "تكرار فئة ضعيفة رغم الفشل" },
  { key: "avoidance", label: "الوحشة", icon: Compass, color: "text-sky-300", hint: "تجنّب فئات لم تجرّبها" },
  { key: "lateIgnition", label: "الحماس المتأخر", icon: Flame, color: "text-fuchsia-300", hint: "تشتعل فقط في النهايات" },
];

function indexColor(v: number): string {
  if (v >= 60) return "bg-red-500/25 text-red-200";
  if (v >= 30) return "bg-amber-500/25 text-amber-200";
  return "bg-emerald-500/20 text-emerald-200";
}

export function HabitObservatory() {
  const habits = useQuery(api.aiHabit.getMyHabits) as HabitProfile | null | undefined;
  const challenges = useQuery(api.aiHabit.getMyChallenges) as Challenge[] | undefined;
  const startBreak = useMutation(api.aiHabit.startBreakChallenge);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const active = challenges?.find((c) => c.status === "active");

  async function onStart(habit: string) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await startBreak({ habit });
      setMsg(`🎯 بدأ ${r.title} — الحكم بعد أسبوع من أدائك الفعلي`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذر بدء التحدي"}`);
    } finally {
      setBusy(false);
    }
  }

  function indexOf(p: HabitProfile, key: string): number {
    return key === "haste" ? p.hasteIndex
      : key === "collapse" ? p.collapseIndex
      : key === "stubbornness" ? p.stubbornnessIndex
      : key === "avoidance" ? p.avoidanceIndex
      : p.lateIgnitionIndex;
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-l from-cyan-500/12 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Microscope className="h-5 w-5 text-cyan-300" />
          <h2 className="text-base font-extrabold text-cyan-100">مرصد العادات</h2>
          {habits && <span className="mr-auto text-[10px] text-white/40">بصمة {habits.sample} إجابة</span>}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          عقلcardك يكرر أنماطاً لا تشعر بها — المرصد يقيسها من إجاباتك الحقيقية، ويحدّيك أن تكسر أسوأها.
        </p>
      </div>

      {/* التشخيص */}
      {habits ? (
        <div className="space-y-2">
          {HABITS.map((h) => {
            const v = indexOf(habits, h.key);
            const Icon = h.icon;
            const isWorst = v === Math.max(habits.hasteIndex, habits.collapseIndex, habits.stubbornnessIndex, habits.avoidanceIndex, habits.lateIgnitionIndex) && v >= 30;
            return (
              <button
                key={h.key}
                onClick={() => setSelected(selected === h.key ? null : h.key)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-right transition hover:border-white/25"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${h.color}`} />
                  <span className="text-xs font-bold text-white/85">{h.label}</span>
                  {isWorst && <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[9px] font-bold text-red-200">أسوأ عادة عندك</span>}
                  <span className={`mr-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${indexColor(v)}`}>{v}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className={`h-full rounded-full ${v >= 60 ? "bg-red-400" : v >= 30 ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${Math.min(100, v)}%` }}
                  />
                </div>
                {selected === h.key && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-white/55">{h.hint}</p>
                    {!active && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          void onStart(h.key);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        <Target className="h-3 w-3" />
                        ابدأ تحدي كسر هذه العادة
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-xs text-white/45">
          العب جولة أو اثنتين — المرصد يحتاج 20 إجابة على الأقل ليقرأ عاداتك
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-white/15 bg-black/30 p-3 text-center text-xs text-white/85">{msg}</div>
      )}

      {/* تحدي نشط */}
      {active && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="text-[11px] font-bold text-amber-200">🎯 {active.title} — جارٍ</div>
          <p className="mt-1 text-xs leading-relaxed text-white/75">{active.goal}</p>
          <div className="mt-2 text-[10px] text-white/45">
            مؤشر البداية: {active.beforeIndex}% · الحكم خلال{" "}
            {Math.max(0, Math.ceil((active.judgeAt - Date.now()) / DAY_MS))} يوم
          </div>
        </div>
      )}

      {/* مذكرة التحديات */}
      {challenges && challenges.filter((c) => c.status !== "active").length > 0 && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
          <div className="text-[11px] font-bold text-white/70">📓 مذكرة المرصد</div>
          <div className="mt-2 space-y-1.5">
            {challenges
              .filter((c) => c.status !== "active")
              .slice(0, 5)
              .map((c) => (
                <div key={c._id} className="flex items-center justify-between rounded-xl bg-black/25 p-2.5 text-xs">
                  <span className="text-white/80">{c.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.status === "broken" ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"
                    }`}
                  >
                    {c.status === "broken" ? `كسرتها! +${c.reward}` : `انتكاس (${c.beforeIndex}→${c.afterIndex ?? "?"})`}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DAY_MS = 24 * 3600_000;
