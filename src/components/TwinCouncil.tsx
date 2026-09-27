import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Shield, Swords, ScrollText, Megaphone, Sparkles, Handshake } from "lucide-react";

/**
 * ⚜️ مجلس التوأم الحربي — تحالف تكتيكي مع توأم روحك:
 * قطاع دفاع مشترك تحرسه معاً، قطاع قيادة تقودهما، ونداء حرب حين يتراجع أحدكما.
 */

type AllyFacts = {
  hasTwin: true;
  twinId: string;
  twinName: string;
  twinAffinity: number;
  nemesisName: string;
  defenseSector: { category: string; baselineAcc: number };
  offenseSector: { category: string; baselineAcc: number };
  teamWeakAcc: number;
  teamStrongAcc: number;
};
type FactsState = AllyFacts | { hasTwin: false; reason: string } | null | undefined;

type Alliance = {
  _id: string;
  aName: string;
  bName: string;
  twinAffinity: number;
  defenseSector: string;
  defenseBase: number;
  offenseSector: string;
  offenseBase: number;
  doctrine: string;
  crest?: string;
  coverScoreA: number;
  coverScoreB: number;
  verdict?: string;
  status: "active" | "settled";
  formedAt: number;
  judgeAt: number;
};

function daysLeft(judgeAt: number): string {
  const ms = judgeAt - Date.now();
  if (ms <= 0) return "حان وقت القياس";
  const d = Math.floor(ms / 86_400_000);
  return `${d} يوم و${Math.floor((ms % 86_400_000) / 3_600_000)} ساعة`;
}

export function TwinCouncil() {
  const facts = useQuery(api.aiAlliance.getMyAlliance) as FactsState;
  const council = useQuery(api.aiAlliance.getMyCouncil) as Alliance | null | undefined;

  const form = useMutation(api.aiAlliance.formAlliance);
  const rally = useMutation(api.aiAlliance.rallyCry);
  const crestM = useMutation(api.aiAlliance.forgeCrest);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [prophecy, setProphecy] = useState<string | null>(null);

  const doForm = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await form({});
      setProphecy(r.doctrine);
      setMsg({ text: `تأسس التحالف — دفاع «${r.defense}» وقيادة «${r.offense}». القياس بعد أسبوع.`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل التأسيس", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doRally = async (id: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await rally({ allianceId: id as never });
      setMsg({ text: r.slumped ? "أُرسل نداء الحرب إلى شريكك 📯" : "أُرسل نداء التمركز الوقائي", good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل النداء", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doCrest = async (id: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await crestM({ allianceId: id as never });
      setProphecy(r.crest);
      setMsg({ text: r.cached ? "العقيدة مكتوبة سابقاً" : "كُتبت العقيدة التحالفية", good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  const ally = facts && facts.hasTwin ? facts : null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-950/40 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-bold text-violet-100">مجلس التوأم الحربي</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-violet-200/70">
          توأم روحك يتعثر حيث تتعثر ويتألق حيث تتألق — فليكن تحالفاً: قطاع ضعف مشترك تحرسه معاً، وقطاع قوة تقودهما
          معاً، ونداء حرب حين يتهاون أحدكما.
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

      {/* لا توأم / بصمة ناقصة */}
      {facts && !facts.hasTwin && (
        <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-300">
          {facts.reason}
        </p>
      )}

      {/* بطاقة التشكيل */}
      {ally && !council && (
        <div className="rounded-2xl border border-violet-500/25 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-violet-200/80">شريك التحالف المقترح</span>
            <span className="text-sm font-bold text-violet-100">{ally.twinName}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">تقارب العقلين</span>
            <span className="font-mono text-emerald-300">{ally.twinAffinity}%</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-rose-950/25 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-rose-300">
                <Shield className="h-3.5 w-3.5" /> قطاع الدفاع المشترك
              </div>
              <div className="mt-1 text-xs font-bold text-rose-200">{ally.defenseSector.category}</div>
              <div className="text-[10px] text-slate-400">دقة الفريق {ally.teamWeakAcc}% — هنا نقضف ثغرتكما</div>
            </div>
            <div className="rounded-xl bg-emerald-950/25 p-3">
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                <Swords className="h-3.5 w-3.5" /> قطاع القيادة المشترك
              </div>
              <div className="mt-1 text-xs font-bold text-emerald-200">{ally.offenseSector.category}</div>
              <div className="text-[10px] text-slate-400">دقة الفريق {ally.teamStrongAcc}% — من هنا نغزو</div>
            </div>
          </div>

          <button
            onClick={doForm}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-gradient-to-l from-violet-600 to-purple-700 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-40"
          >
            <Handshake className="ml-1 inline h-4 w-4" /> أسّس التحالف الحربي
          </button>
        </div>
      )}

      {/* العقيدة (نص التأسيس أو المولَّد) */}
      {prophecy && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-4">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-300">
            <ScrollText className="h-3.5 w-3.5" /> العقيدة التحالفية
          </div>
          <p className="text-xs leading-relaxed text-amber-100/90">{prophecy}</p>
        </div>
      )}

      {/* التحالف القائم */}
      {council && (
        <div
          className={`rounded-2xl border p-4 ${
            council.status === "active"
              ? "border-violet-500/30 bg-slate-950/70"
              : council.verdict?.includes("مكتملة")
                ? "border-emerald-500/40 bg-emerald-950/25"
                : "border-rose-500/40 bg-rose-950/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-violet-100">
              {council.aName} ⚜️ {council.bName}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
              {council.status === "active" ? `⏳ القياس بعد ${daysLeft(council.judgeAt)}` : "حُكم"}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">تقارب العقلين {council.twinAffinity}%</div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-rose-950/20 p-2">
              <div className="font-bold text-rose-300">🛡️ الدفاع</div>
              <div className="text-rose-200">{council.defenseSector}</div>
              <div className="text-[10px] text-slate-400">خط الأساس {council.defenseBase}%</div>
            </div>
            <div className="rounded-lg bg-emerald-950/20 p-2">
              <div className="font-bold text-emerald-300">⚔️ القيادة</div>
              <div className="text-emerald-200">{council.offenseSector}</div>
              <div className="text-[10px] text-slate-400">خط الأساس {council.offenseBase}%</div>
            </div>
          </div>

          {council.status === "active" ? (
            <div className="mt-3 space-y-2">
              <button
                onClick={() => doRally(council._id)}
                disabled={busy}
                className="w-full rounded-lg bg-violet-600/80 py-2 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                <Megaphone className="ml-1 inline h-3.5 w-3.5" /> أطلق نداء الحرب على شريكك
              </button>
              <button
                onClick={() => doCrest(council._id)}
                disabled={busy}
                className="w-full rounded-lg border border-amber-500/30 py-1.5 text-[11px] text-amber-300 transition hover:bg-amber-950/30 disabled:opacity-40"
              >
                <Sparkles className="ml-1 inline h-3.5 w-3.5" /> اكتب العقيدة بالذكاء
              </button>
              {council.crest && (
                <p className="rounded-lg bg-amber-950/15 p-2 text-[11px] leading-relaxed text-amber-100/85">
                  {council.crest}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-slate-900/60 p-3">
              <p className="text-[11px] leading-relaxed text-slate-300">⚖️ {council.verdict}</p>
              <div className="mt-2 flex gap-2 text-[10px]">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                  تغطية {council.aName}: {Math.round((council.coverScoreA ?? 0) * 100)}%
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                  تغطية {council.bName}: {Math.round((council.coverScoreB ?? 0) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {ally && council && council.status === "active" && council.defenseSector !== ally.defenseSector.category && (
        <p className="text-center text-[10px] text-slate-500">
          شُكّل التحالف في تشكيل سابق — قطاع القياس الحالي «{council.defenseSector}» وقد تحرك بصمتكما قليلاً منذ ذلك.
        </p>
      )}
    </div>
  );
}
