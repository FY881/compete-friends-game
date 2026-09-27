import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Ghost, Swords, Hourglass, Sparkles, Check, X, Timer } from "lucide-react";

/**
 * 👻 مبارزة الشبح — نقيضك كشبح فوري: 7 أسئلة، الشبح يجيب من بصمته
 * الحقيقية (يخطئ حيث يخطئ)، والحسم لحظي بغنيمة ولاء.
 */

type Item = {
  index: number;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
  correctIndex?: number;
  ghostCorrect?: boolean;
  ghostElapsedMs?: number;
};

type DuelView = {
  _id: string;
  ghostName: string;
  ghostContrast: number;
  ghostSample: number;
  taunt: string;
  myCorrect: number;
  ghostCorrect: number;
  myAnswered: number;
  total: number;
  result?: "win" | "loss" | "draw";
  reward: number;
  verdict?: string;
  expiresAt: number;
  items: Item[];
};

type DuelData = {
  duel: DuelView | null;
  last: DuelView | null;
  nemesisName: string | null;
  cooldownMs: number;
  canStart: boolean;
};

const DIFF_LABEL: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export function GhostDuel() {
  const data = useQuery(api.aiGhost.getMyDuel) as DuelData | undefined;
  const startM = useMutation(api.aiGhost.startDuel);
  const answerM = useMutation(api.aiGhost.answerQuestion);
  const verdictM = useMutation(api.aiGhost.ghostVerdict);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [flash, setFlash] = useState<{ index: number; correct: boolean; ghostCorrect?: boolean; ghostMs?: number } | null>(null);

  const duel = data?.duel ?? null;

  const doStart = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await startM({});
      setMsg({ text: `استُدعي شبح «${r.ghostName}» (تباعد ${r.contrast}%) — 7 أسئلة تحسم فوراً!`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل الاستدعاء", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doAnswer = async (index: number, selected: number) => {
    if (!duel || busy) return;
    setBusy(true);
    try {
      const r = await answerM({ duelId: duel._id as never, index, selected });
      setFlash({ index, correct: r.correct, ghostCorrect: r.ghostCorrect, ghostMs: r.ghostElapsedMs });
      if (r.finished) {
        setMsg({
          text:
            r.result === "win"
              ? `🏆 هزمت الشبح ${r.myCorrect}:${r.ghostCorrectTotal} — غنيمة ${r.reward} ولاء!`
              : r.result === "draw"
                ? `⚖️ تعادل مشرّف ${r.myCorrect}:${r.ghostCorrectTotal} — ${r.reward} ولاء`
                : `👻 الشبح تفوق ${r.ghostCorrectTotal}:${r.myCorrect} — تدرّب وعُد`,
          good: r.result !== "loss",
        });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doVerdict = async () => {
    if (!data?.last) return;
    setBusy(true);
    try {
      const r = await verdictM({ duelId: data.last._id as never });
      if (r.ok) setMsg({ text: `👻 ${r.verdict}`, good: true });
      else setMsg({ text: r.note ?? "لا صوت للأشباح الآن", good: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  const current = duel ? duel.items[duel.myAnswered] : null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-950/50 via-slate-950/80 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Ghost className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-bold text-violet-100">مبارزة الشبح</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-violet-200/70">
          نقيضك لا ينتظر 3 أيام — شبحه المبني من بصمته الحقيقية يجيب معك الآن سؤالاً بسؤال: يخطئ حيث يخطئ دائماً،
          ويتألق حيث يتألق دائماً. 7 أسئلة تحسم فوراً.
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

      {/* زر البدء */}
      {data && !duel && (
        <div className="rounded-2xl border border-violet-500/25 bg-slate-950/60 p-5 text-center">
          <Ghost className="mx-auto h-9 w-9 text-violet-400/70" />
          {data.canStart ? (
            <>
              <p className="mt-2 text-sm text-slate-300">
                استدعِ شبح «{data.nemesisName}» لمبارزة فورية — تدريب يومي على عقل خصمك بالضبط.
              </p>
              <button
                onClick={doStart}
                disabled={busy}
                className="mt-4 w-full rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-700 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
              >
                <Swords className="ml-1 inline h-4 w-4" /> استدعِ الشبح
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              <Hourglass className="ml-1 inline h-4 w-4" /> الشبح يرتاح — المبارزة القادمة بعد{" "}
              {Math.ceil((data.cooldownMs ?? 0) / 60000)} دقيقة
            </p>
          )}
        </div>
      )}

      {/* المبارزة الحية */}
      {duel && current && (
        <div className="rounded-2xl border border-violet-500/35 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-violet-100">👻 شبح {duel.ghostName}</span>
            <span className="font-mono text-xs text-violet-300">
              أنت {duel.myCorrect} · {duel.ghostCorrect} الشبح
            </span>
          </div>
          <p className="mt-1 rounded-lg bg-violet-950/30 p-2 text-[11px] italic text-violet-300/90">{duel.taunt}</p>

          {/* شريط التقدم */}
          <div className="mt-3 flex gap-1">
            {duel.items.map((it) => (
              <div
                key={it.index}
                className={`h-1.5 flex-1 rounded-full ${
                  it.index < duel.myAnswered
                    ? (it.correctIndex !== undefined && it.ghostCorrect !== undefined
                        ? it.correctIndex >= 0
                          ? "bg-emerald-500"
                          : "bg-slate-500"
                        : "bg-slate-500")
                    : it.index === duel.myAnswered
                      ? "bg-violet-400"
                      : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* السؤال الحالي */}
          <div className="mt-4 rounded-xl border border-violet-500/25 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-violet-300">
                سؤال {duel.myAnswered + 1}/{duel.total} · {current.category}
              </span>
              <span>{DIFF_LABEL[current.difficulty] ?? current.difficulty}</span>
            </div>
            <p className="mt-2 text-sm font-bold leading-relaxed text-slate-100">{current.question}</p>
            <div className="mt-3 space-y-2">
              {current.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => doAnswer(current.index, i)}
                  disabled={busy}
                  className="w-full rounded-lg border border-violet-500/20 bg-slate-800/60 px-3 py-2 text-right text-xs text-slate-100 transition hover:border-violet-400/50 hover:bg-violet-950/40 disabled:opacity-40"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* النتيجة الأخيرة */}
      {!duel && data?.last && (
        <div
          className={`rounded-2xl border p-4 ${
            data.last.result === "win"
              ? "border-emerald-500/40 bg-emerald-950/20"
              : data.last.result === "draw"
                ? "border-amber-500/40 bg-amber-950/20"
                : "border-rose-500/40 bg-rose-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-100">
              👻 مبارزة آخر شبح — {data.last.myCorrect}:{data.last.ghostCorrect}
            </span>
            {data.last.reward > 0 && (
              <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] text-emerald-300">
                +{data.last.reward} ولاء
              </span>
            )}
          </div>
          {data.last.verdict && <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{data.last.verdict}</p>}
          <div className="mt-2 space-y-1">
            {data.last.items.map((it) => (
              <div key={it.index} className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate">{it.question}</span>
                <span className="flex items-center gap-1">
                  {it.correctIndex !== undefined && it.ghostCorrect !== undefined ? (
                    <>
                      <span className={it.ghostCorrect ? "text-rose-300" : "text-slate-500"}>
                        {it.ghostCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </span>
                      {it.ghostElapsedMs !== undefined && (
                        <Timer className="h-3 w-3 text-slate-500" />
                      )}
                      {it.ghostElapsedMs !== undefined && <span>{(it.ghostElapsedMs / 1000).toFixed(1)}ث</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={doVerdict}
            disabled={busy}
            className="mt-3 w-full rounded-lg border border-violet-500/30 py-1.5 text-[11px] text-violet-300 transition hover:bg-violet-950/30 disabled:opacity-40"
          >
            <Sparkles className="ml-1 inline h-3.5 w-3.5" /> كلمة الشبح الأخيرة (بالذكاء)
          </button>
        </div>
      )}

      {/* كيف يُبنى الشبح */}
      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        الشبح يجيب باحتمال دقة نقيضك الفعلي في فئة السؤال — الأسئلة من أقوى فئاته (تدرّب حيث هو خطير) وأضعف فئاتك
        (استعد حيث تنزف)، ومبارزة كل 3 ساعات.
      </p>
    </div>
  );
}
