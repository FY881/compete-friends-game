import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Gavel, Scale, FileText, Sparkles, ShieldX, Landmark } from "lucide-react";

/**
 * 🧑‍⚖️ محكمة الشرف العقلية — طعن في الأحكام الآلية: خسارة غياب ظالمة،
 * خطة قيست على فئة لم تُختبر، تغطية قيست دون ذنب. الأدلة من سجل اللعب الحقيقي.
 */

type Fileable = {
  key: string;
  domain: "rivalry" | "mirror" | "council";
  label: string;
  detail: string;
  fresh: boolean;
};

type Ruling = { at: number; text: string; engine: string };

type CourtCase = {
  _id: string;
  domain: string;
  respondentName: string;
  reasons: string;
  overturned?: boolean;
  compensation?: number;
  verdict?: string;
  rulings: Ruling[];
  status: "filed" | "judged";
  createdAt: number;
  judgedAt?: number;
};

type Stats = { total: number; open: number; judged: number; overturned: number; rejected: number; totalCompensation: number };

const DOMAIN_EMOJI: Record<string, string> = { rivalry: "🗡️", mirror: "🪞", council: "⚜️" };

export function HonorCourt() {
  const fileable = useQuery(api.aiCourt.getFileableRulings) as Fileable[] | undefined;
  const myCases = useQuery(api.aiCourt.getMyCases) as CourtCase[] | undefined;
  const stats = useQuery(api.aiCourt.getCourtStats) as Stats | undefined;

  const fileM = useMutation(api.aiCourt.fileCase);
  const judgeM = useMutation(api.aiCourt.judgeCase);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [reasons, setReasons] = useState("");

  const doFile = async () => {
    if (!selected) {
      setMsg({ text: "اختر الحكم الذي تريد طعنه أولاً", good: false });
      return;
    }
    const [domain, recordId] = selected.split(":");
    setBusy(true);
    setMsg(null);
    try {
      await fileM({ domain, recordId, reasons });
      setMsg({ text: "رُفعت الدعوى — تحكم المحكمة بمعايير الأدلة خلال 24 ساعة، أو استعجل بضغطة.", good: true });
      setReasons("");
      setSelected("");
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل رفع الدعوى", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doJudge = async (caseId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await judgeM({ caseId: caseId as never });
      setMsg({
        text: r.overturned
          ? `⚖️ نُقض الحكم وتعويض ${r.compensation} ولاء (${r.engine === "llm" ? "حكم القاضي الذكي" : "معايير الأدلة"})`
          : `⚖️ رُفض الطعن (${r.engine === "llm" ? "حكم القاضي الذكي" : "معايير الأدلة"})`,
        good: r.overturned,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-800/60 via-slate-950/80 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-bold text-amber-100">محكمة الشرف العقلية</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-300/80">
          الأنظمة القتالية تحكم آلياً بالوقت — والمحكمة تفحص الأحكام الظالمة بالأدلة الحقيقية من سجل لعبك: خسارة غياب
          وأنت لعبت، خطة قيست على فئة لم تُختبر، تغطية قيست دون ذنبك. النقض يأتي بتعويض.
        </p>
        {stats && stats.judged > 0 && (
          <div className="mt-2 flex gap-2 text-[10px]">
            <span className="rounded bg-slate-800/70 px-2 py-0.5 text-slate-300">{stats.judged} دعوى محكومة</span>
            <span className="rounded bg-emerald-950/50 px-2 py-0.5 text-emerald-300">{stats.overturned} نقضاً</span>
            <span className="rounded bg-rose-950/50 px-2 py-0.5 text-rose-300">{stats.rejected} رفضاً</span>
            {stats.totalCompensation > 0 && (
              <span className="rounded bg-amber-950/40 px-2 py-0.5 text-amber-300">{stats.totalCompensation} ولاء تعويضات</span>
            )}
          </div>
        )}
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

      {/* الأحكام القابلة للطعن */}
      {fileable && fileable.length > 0 && (
        <div className="rounded-2xl border border-slate-600/40 bg-slate-950/60 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-100">
            <Scale className="h-4 w-4 text-amber-300" /> أحكام يمكنك طعنها
          </div>
          <div className="space-y-1.5">
            {fileable.map((f) => (
              <label
                key={f.key}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition ${
                  selected === f.key ? "border-amber-400/50 bg-amber-950/20" : "border-slate-700/50 bg-slate-900/40 hover:bg-slate-900/60"
                } ${f.fresh ? "" : "opacity-50"}`}
              >
                <input
                  type="radio"
                  name="fileable"
                  className="mt-1 accent-amber-500"
                  checked={selected === f.key}
                  onChange={() => setSelected(f.key)}
                  disabled={!f.fresh || busy}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100">
                    {DOMAIN_EMOJI[f.domain]} {f.label}
                  </div>
                  <div className="truncate text-[10px] text-slate-400">{f.detail}</div>
                  {!f.fresh && <div className="text-[9px] text-rose-400">انتهت مهلة الطعن (7 أيام)</div>}
                </div>
              </label>
            ))}
          </div>

          <textarea
            className="mt-3 w-full rounded-xl border border-slate-600/50 bg-slate-900/70 p-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-500/50"
            placeholder="مبرر طعنك: متى لعبت؟ ما الذي حدث؟ (15 حرفاً على الأقل — المحكمة تتحقق من كل كلمة بالأدلة)"
            rows={3}
            value={reasons}
            onChange={(e) => setReasons(e.target.value)}
          />
          <button
            onClick={doFile}
            disabled={busy || !selected || reasons.trim().length < 15}
            className="mt-2 w-full rounded-xl bg-gradient-to-l from-amber-500 to-yellow-600 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/30 transition hover:brightness-110 disabled:opacity-40"
          >
            <FileText className="ml-1 inline h-4 w-4" /> ارفع الدعوى إلى المحكمة
          </button>
        </div>
      )}

      {fileable && fileable.length === 0 && (
        <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
          لا أحكام قابلة للطعن في مهلتها — سجل قتالك نظيف أو فوات الطعن مضت.
        </p>
      )}

      {/* قضاياي */}
      {myCases && myCases.length > 0 && (
        <div className="space-y-2">
          {myCases.map((c) => (
            <div
              key={c._id}
              className={`rounded-2xl border p-4 ${
                c.status === "filed"
                  ? "border-amber-500/30 bg-slate-950/70"
                  : c.overturned
                    ? "border-emerald-500/40 bg-emerald-950/20"
                    : "border-rose-500/30 bg-rose-950/15"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100">
                  {DOMAIN_EMOJI[c.domain]} ضد {c.respondentName}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    c.status === "filed" ? "bg-amber-950/60 text-amber-300" : c.overturned ? "bg-emerald-950/60 text-emerald-300" : "bg-rose-950/60 text-rose-300"
                  }`}
                >
                  {c.status === "filed" ? "⏳ قيد المحاكمة" : c.overturned ? "نُقض الحكم ✅" : "رُفض الطعن ❌"}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">«{c.reasons}»</p>

              {c.status === "judged" && c.verdict && (
                <div className="mt-2 rounded-lg bg-slate-900/60 p-2.5">
                  <p className="text-[11px] leading-relaxed text-slate-200">{c.verdict}</p>
                  {c.rulings.length > 0 && (
                    <p className="mt-1 text-[9px] text-slate-500">
                      مصدر الحكم: {c.rulings[c.rulings.length - 1].engine === "llm" ? "القاضي الذكي + معايير الأدلة" : "معايير الأدلة الصارمة"}
                    </p>
                  )}
                </div>
              )}

              {c.status === "filed" && (
                <button
                  onClick={() => doJudge(c._id)}
                  disabled={busy}
                  className="mt-2 w-full rounded-lg border border-amber-500/40 py-1.5 text-[11px] text-amber-300 transition hover:bg-amber-950/30 disabled:opacity-40"
                >
                  <Sparkles className="ml-1 inline h-3.5 w-3.5" /> استعجل الحكم — اعرض الدعوى على القاضي الذكي
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ميثاق المحكمة */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-200">
          <Gavel className="h-4 w-4 text-amber-300" /> ميثاق المحكمة
        </div>
        <ul className="space-y-1 text-[11px] leading-relaxed text-slate-400">
          <li>• مهلة الطعن 7 أيام من صدور الحكم — العدل لا يُحاكم بعد سنة.</li>
          <li>• دعوى واحدة معلقة لكل لاعب، والحكم المُثبت لا يُعاد فتحه.</li>
          <li>• القاضي الذكي يستمع، لكن <b className="text-slate-300">معايير الأدلة من سجل اللعب هي الغالبة</b> — الانطباع لا ينقض أرقاماً.</li>
          <li>
            • النقض يعني تعويض 40 ولاء ولا يغيّر نتيجة السجل الأصلي — المحكمة تعالج الظلم ولا تعيد كتابة التاريخ.
          </li>
          <li className="flex items-center gap-1">
            <ShieldX className="h-3 w-3 text-rose-400" /> الطعن الكاذب المتكرر يظهر في سجل العقل للجميع.
          </li>
        </ul>
      </div>
    </div>
  );
}
