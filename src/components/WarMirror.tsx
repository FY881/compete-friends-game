import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Scan, Swords, ScrollText, Target, TrendingUp, Sparkles, ShieldAlert } from "lucide-react";

/**
 * 🪞 المرآة الحربية — محاكاة رياضية لنزالك ضد نقيضك، وخطة حرب أسبوعية
 * تُحكم بتحسّن حقيقي في فئات الفجوة. التنبؤ من بياناتك، والحكم من أدائك.
 */

type MirrorSim = {
  winProbability: number;
  myWinRate: number;
  foeWinRate: number;
  draws: number;
  projectedScore: number;
  foeProjectedScore: number;
  gapCategories: string[];
  breakTargets: string[];
  shockLevers: string[];
  nemesisStrengthCat: string;
  twinName: string;
  twinAffinity: number;
};

type MirrorResult =
  | { hasNemesis: false; reason: string }
  | { hasNemesis: true; nemesisId: string; nemesisName: string; contrast: number; sim: MirrorSim };

type WarOrder = { num: number; title: string; body: string; category: string };

type WarPlan = {
  _id: string;
  periodKey: string;
  nemesisName: string;
  winProbability: number;
  projectedScore: number;
  foeProjectedScore: number;
  gapCategories: string[];
  breakTargets: string[];
  orders: string;
  improvedCats?: string[];
  reward?: number;
  verdict?: string;
  status: "active" | "won" | "lost";
  judgeAt: number;
};

function probColor(p: number): string {
  if (p >= 60) return "text-emerald-300";
  if (p >= 45) return "text-amber-300";
  return "text-rose-300";
}

function daysLeft(judgeAt: number): string {
  const ms = judgeAt - Date.now();
  if (ms <= 0) return "حان وقت الحكم";
  const d = Math.floor(ms / 86_400_000);
  return `${d} يوم و${Math.floor((ms % 86_400_000) / 3_600_000)} ساعة`;
}

export function WarMirror() {
  const mirror = useQuery(api.aiMirror.getMyMirror) as MirrorResult | undefined;
  const plan = useQuery(api.aiMirror.getMyPlan) as WarPlan | null | undefined;
  const deploy = useMutation(api.aiMirror.deployPlan);
  const counsel = useMutation(api.aiMirror.warCounsel);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);

  const doDeploy = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await deploy({});
      setMsg({ text: `نُشرت خطة الحرب (${r.winProbability}% احتمال نصر) — الحكم بعد أسبوع.`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل النشر", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doCounsel = async (planId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await counsel({ planId: planId as never });
      if (r.ok) setAdvice(r.counsel);
      else setMsg({ text: r.note ?? "تعذّر استدعاء المستشار", good: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  const sim = mirror?.hasNemesis ? mirror.sim : null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-950/40 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Scan className="h-5 w-5 text-teal-300" />
          <h2 className="text-lg font-bold text-teal-100">المرآة الحربية</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-teal-200/70">
          محاكاة رياضية لـ300 أدوار نزال وهمي بين بصمتك وبصمة نقيضك — لا شعور، بل احتمالات. ثم خطة حرب أسبوعية تُحكم
          بتحسّنك الفعلي.
        </p>
      </div>

      {/* رسالة */}
      {msg && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            msg.good
              ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
              : "border-amber-500/40 bg-amber-950/40 text-amber-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* لا نقيض */}
      {mirror && !mirror.hasNemesis && (
        <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-300">
          {mirror.reason}
        </p>
      )}

      {/* المحاكاة */}
      {mirror && mirror.hasNemesis && sim && (
        <div className="rounded-2xl border border-teal-500/25 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-teal-200/80">نزالك المتوقع ضد</span>
            <span className="text-sm font-bold text-teal-100">{mirror.nemesisName}</span>
          </div>

          {/* مقياس الاحتمال */}
          <div className="mt-4">
            <div className="mb-1 flex items-end justify-between">
              <span className="text-xs text-slate-400">احتمال نصرتك في مواجهة مباشرة</span>
              <span className={`text-2xl font-black ${probColor(sim.winProbability)}`}>{sim.winProbability}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-400 via-amber-400 to-rose-500"
                style={{ width: `${sim.winProbability}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
              <span>نصرته {sim.foeWinRate}%</span>
              <span>تعادل {sim.draws}%</span>
              <span>نصرتك الصريح {sim.myWinRate}%</span>
            </div>
          </div>

          {/* التوقع الرقمي */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-800/60 p-3 text-center">
              <div className="text-[10px] text-slate-400">توقع أدائك</div>
              <div className="text-xl font-bold text-teal-200">{sim.projectedScore}/12</div>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-3 text-center">
              <div className="text-[10px] text-slate-400">توقع النقيض</div>
              <div className="text-xl font-bold text-rose-200">{sim.foeProjectedScore}/12</div>
            </div>
          </div>

          {/* روافع الصدمة */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5" /> روافع الصدمة
            </div>
            {sim.shockLevers.map((l, i) => (
              <p key={i} className="rounded-lg bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-100/80">
                {l}
              </p>
            ))}
          </div>

          {/* الفجوات والاختراق */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-rose-950/25 p-2">
              <div className="mb-1 font-bold text-rose-300">أرض العدو (فجوتك)</div>
              {sim.gapCategories.map((c) => (
                <span key={c} className="mr-1 rounded bg-rose-900/40 px-1.5 py-0.5 text-rose-200">
                  {c}
                </span>
              ))}
            </div>
            <div className="rounded-lg bg-emerald-950/25 p-2">
              <div className="mb-1 font-bold text-emerald-300">سلاح الاختراق</div>
              {sim.breakTargets.length > 0 ? (
                sim.breakTargets.map((c) => (
                  <span key={c} className="mr-1 rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-200">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-slate-400">لا سلاح كاسح — اعتمد الثبات</span>
              )}
            </div>
          </div>

          {/* توأم الروح للمقارنة */}
          <p className="mt-3 text-center text-[10px] text-emerald-200/60">
            توأم روحك «{sim.twinName}» قرب {sim.twinAffinity}% — قارن نزالك به لتفهم قيمة الفجوة.
          </p>
        </div>
      )}

      {/* خطة الحرب */}
      {plan && (
        <div
          className={`rounded-2xl border p-4 ${
            plan.status === "active"
              ? "border-teal-500/30 bg-slate-950/70"
              : plan.status === "won"
                ? "border-emerald-500/40 bg-emerald-950/25"
                : "border-rose-500/40 bg-rose-950/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ScrollText className="h-4 w-4 text-teal-300" />
              <h3 className="text-sm font-bold text-teal-100">خطة الحرب — {plan.periodKey}</h3>
            </div>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              {plan.status === "active" ? `⏳ حكم بعد ${daysLeft(plan.judgeAt)}` : plan.status === "won" ? "نصر ✅" : "خسارة ❌"}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {(JSON.parse(plan.orders) as WarOrder[]).map((o) => (
              <div key={o.num} className="rounded-xl border border-teal-500/15 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-200">
                    {o.num}. {o.title}
                  </span>
                  <span className="rounded bg-teal-900/40 px-1.5 py-0.5 text-[10px] text-teal-300">{o.category}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{o.body}</p>
              </div>
            ))}
          </div>

          {/* الحكم */}
          {plan.status !== "active" && plan.verdict && (
            <div className="mt-3 rounded-xl bg-slate-900/60 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Target className="h-3.5 w-3.5" /> حكم الأسبوع
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{plan.verdict}</p>
              {plan.status === "won" && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" /> +{plan.reward} ولاء — بصمتك تطورت فعلاً.
                </p>
              )}
            </div>
          )}

          {/* المستشار */}
          {plan.status === "active" && (
            <button
              onClick={() => doCounsel(plan._id)}
              disabled={busy}
              className="mt-3 w-full rounded-lg border border-teal-500/30 py-2 text-[11px] text-teal-300 transition hover:bg-teal-950/30 disabled:opacity-40"
            >
              <Sparkles className="ml-1 inline h-3.5 w-3.5" /> استشر المستشار الحربي (بالذكاء)
            </button>
          )}
        </div>
      )}

      {/* زر النشر */}
      {mirror?.hasNemesis && !plan && (
        <button
          onClick={doDeploy}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-l from-teal-600 to-cyan-700 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/40 transition hover:brightness-110 disabled:opacity-40"
        >
          <Swords className="ml-1 inline h-4 w-4" /> انشر خطة الحرب الأسبوعية
        </button>
      )}

      {plan && (
        <p className="text-center text-[10px] text-slate-500">
          خطة جديدة كل أسبوع زمني — حُكم على خطتك الحالية أولاً.
        </p>
      )}
    </div>
  );
}
