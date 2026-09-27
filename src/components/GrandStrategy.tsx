import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

/**
 * ♟️ الخطة الكبرى — الأداة 28
 * دماغ استراتيجي يقرأ نضارة السبورة ويصدر 3 قرارات كبرى تُحكم زمنياً.
 * ثيم «خيمة القيادة»: أخضر زيتوني داكن + ذهبي عسكري.
 */

type PlanMove = {
  kind: string;
  title: string;
  body: string;
  targetLeaders: string[];
  riskNote: string;
  rewardPool: number;
};

type Plan = {
  _id: string;
  summary: string;
  moves: PlanMove[];
  engine: string;
  rewardPool: number;
  participants: number;
  endorsed: boolean;
  judgeAt: number;
  createdAt: number;
};

const KIND_META: Record<string, { label: string; emoji: string }> = {
  announce_season: { label: "إعلان موسم", emoji: "📣" },
  shift_balance: { label: "نقل التوازن", emoji: "⚖️" },
  mass_challenge: { label: "تحدٍّ جماعي", emoji: "🔥" },
};

function daysLeft(ts: number): string {
  const h = Math.max(0, Math.round((ts - Date.now()) / 3600_000));
  if (h < 24) return `${h} ساعة`;
  return `${Math.round(h / 24)} يوم`;
}

export function GrandStrategy() {
  const plan = useQuery(api.aiGrandStrategy.getMyGrandPlan) as Plan | null | undefined;
  const history = useQuery(api.aiGrandStrategy.getGrandHistory) as
    | ({ _id: string; summary: string; engine: string; verdict?: string; status: string; createdAt: number }[])
    | undefined;
  const endorse = useMutation(api.aiGrandStrategy.endorsePlan);
  const [msg, setMsg] = useState<string | null>(null);

  const totalPool = useMemo(() => plan?.rewardPool ?? 0, [plan]);

  async function onEndorse() {
    try {
      const r = await endorse({});
      setMsg(
        r.already
          ? `⚓ تأييدك مسجّل مسبقاً — ${r.count} عقل يؤيدون الخطة`
          : `⚓ تأييدك انضم — ${r.count} عقل يؤيدون الخطة الآن`,
      );
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذّر التأييد"}`);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4">
      {/* الرأس */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a2416] via-[#12180e] to-black p-5">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-200">♟️ الخطة الكبرى</h2>
          {plan && (
            <span className="rounded-full border border-amber-500/30 bg-black/40 px-2 py-0.5 text-[10px] text-amber-300">
              {plan.engine === "llm" ? "استراتيجي ذكي" : "استراتيجي محلي"}
            </span>
          )}
        </div>
        <p className="relative mt-1 text-xs leading-relaxed text-zinc-400">
          الدماغ الذي يرى السبورة كلها — يقرأ صنّاد النشاط وجبهة الحرب، ويصدر 3 قرارات كبرى بكنز ولاء.
          خطة جديدة كلما حُكمت السابقة (بعد 3 أيام).
        </p>
      </div>

      {/* الخطة النشطة */}
      {plan === undefined ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-center text-xs text-zinc-500">
          … تُحمّل خطة السبورة
        </div>
      ) : plan === null ? (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-center text-xs text-zinc-500">
          لا خطة نشطة الآن — ستصدر مع أول دورة (كل يوم).
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-amber-500/25 bg-[#141a10]/80 p-4">
            <p className="text-[13px] leading-relaxed text-amber-100/90">{plan.summary}</p>
            <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
              <span>كنز الخطة: <b className="text-amber-300">{totalPool}</b> ولاء</span>
              <span>⏳ الحكم بعد {daysLeft(plan.judgeAt)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {plan.moves.map((m, i) => {
              const km = KIND_META[m.kind] ?? { label: "قرار", emoji: "♟️" };
              return (
                <div key={i} className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{km.emoji}</span>
                      <span className="text-sm font-bold text-zinc-100">{m.title}</span>
                    </div>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                      {km.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{m.body}</p>
                  {m.targetLeaders.length > 0 && (
                    <p className="mt-1 text-[10px] text-amber-300/70">
                      مستهدف: {m.targetLeaders.join("، ")}
                    </p>
                  )}
                  <p className="mt-2 rounded-lg bg-red-950/25 px-2.5 py-1.5 text-[10px] leading-relaxed text-red-300/80">
                    ⚠️ {m.riskNote}
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-400/70">
                    💰 حصة {m.rewardPool} ولاء عند تحقق الهدف
                  </p>
                </div>
              );
            })}
          </div>

          <button
            onClick={onEndorse}
            disabled={plan.endorsed}
            className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
              plan.endorsed
                ? "border border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                : "bg-gradient-to-l from-amber-600 to-yellow-700 text-black hover:from-amber-500 hover:to-yellow-600"
            }`}
          >
            {plan.endorsed ? "⚓ تأييدك مسجّل" : "⚓ أؤيد الخطة الكبرى"}
          </button>
          {msg && (
            <p className="rounded-xl border border-zinc-800 bg-black/40 p-2.5 text-center text-xs text-zinc-300">{msg}</p>
          )}
          <p className="text-center text-[10px] text-zinc-600">
            {plan.participants} عقل يؤيدون الخطة — التأييد الكافي (3+) يفعّل توزيع الكنز عند الحكم.
          </p>
        </>
      )}

      {/* سجل الخطط */}
      {history && history.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <p className="mb-2 text-xs font-bold text-zinc-300">أرشيف الخطط</p>
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h._id} className="border-b border-zinc-900 pb-1.5 text-[11px] last:border-0">
                <div className="flex items-center justify-between">
                  <span className={h.status === "active" ? "text-amber-300" : "text-zinc-500"}>
                    {h.status === "active" ? "♟️ نشطة" : "✅ حُكمت"}
                  </span>
                  <span className="text-zinc-600">{h.engine === "llm" ? "ذكاء" : "محلي"}</span>
                </div>
                {h.verdict && <p className="mt-0.5 leading-relaxed text-zinc-500">{h.verdict}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
