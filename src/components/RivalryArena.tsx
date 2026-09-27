import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Swords, Flame, Skull, ScrollText, Sparkles } from "lucide-react";

/**
 * 🗡️ صراع النقيض — نزالات سحابية بين المتناقضين عقلياً.
 * نقيضك ليس عشوائياً: هو الأبعد عن بصمتك الإحصائية. والنزال يُحكم من أدائك الحقيقي.
 */

type Declared = { score: number; correct: number; questions: number; fastest: number; won: boolean };

type Duel = {
  _id: string;
  challengerId: string;
  challengerName: string;
  foeId: string;
  foeName: string;
  contrast: number;
  tier: number;
  status: "open" | "settled";
  salt: string;
  winner?: "challenger" | "foe" | "draw";
  narrative?: string;
  verdictDetail?: string;
  reward: number;
  createdAt: number;
  judgeAt: number;
  resolvedAt?: number;
  challengerDeclared?: Declared;
  foeDeclared?: Declared;
};

type Nemesis = {
  nemesisId: string;
  nemesisName: string;
  nemesisContrast: number;
  twinName: string;
  twinAffinity: number;
} | null;

const TIER_LABEL: Record<number, string> = { 1: "نزال الظل 🌑", 2: "نزال العقول 🧠", 3: "نزال الدم 🩸" };

function timeLeft(judgeAt: number): string {
  const ms = judgeAt - Date.now();
  if (ms <= 0) return "حان وقت الحكم";
  const h = Math.floor(ms / 3600_000);
  if (h >= 24) return `${Math.floor(h / 24)} يوم و${h % 24} ساعة`;
  return `${h} ساعة و${Math.floor((ms % 3600_000) / 60_000)} دقيقة`;
}

export function RivalryArena() {
  const duels = useQuery(api.aiRivalry.getMyDuels) as Duel[] | undefined;
  const nemesis = useQuery(api.aiRivalry.getMyNemesis) as Nemesis;
  const board = useQuery(api.aiRivalry.getBoard) as
    | { open: Duel[]; settled: Duel[]; openCount: number }
    | undefined;

  const challenge = useMutation(api.aiRivalry.challengeNemesis);
  const declare = useMutation(api.aiRivalry.declare);
  const enhance = useMutation(api.aiRivalry.enhanceNarrative);
  const duelIdOf = (s: string) => s as never as Parameters<typeof declare>[0]["duelId"];

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [form, setForm] = useState({ score: "", correct: "", questions: "", players: "1", fastest: "", won: "true" });
  const [openFormFor, setOpenFormFor] = useState<string | null>(null);

  const doChallenge = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await challenge({});
      setMsg({ text: `أُشعل النزال ضد «${r.foeName}» — لديك 3 أيام لإعلان أدائك.`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل الإشعال", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doDeclare = async (duelId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const score = Number(form.score);
      const correct = Number(form.correct);
      const questions = Number(form.questions);
      const fastest = Number(form.fastest || "0");
      if (!score || !correct || !questions) throw new Error("املأ النتيجة والدقة وعدد الأسئلة");
      await declare({
        duelId: duelIdOf(duelId),
        score,
        correctCount: correct,
        questionCount: questions,
        playerCount: Number(form.players || "1"),
        fastestAnswerSec: fastest,
        won: form.won === "true",
      });
      setMsg({ text: "استُلم إعلانك ووُلّد السرد — راقب الحكم.", good: true });
      setOpenFormFor(null);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل الإعلان", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doEnhance = async (duelId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enhance({ duelId: duelIdOf(duelId) });
      if (r.ok) setMsg({ text: "أُعيد توليد السرد بالذكاء ✨", good: true });
      else setMsg({ text: r.note ?? "تعذّر السرد الذكي", good: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950/40 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-rose-300" />
          <h2 className="text-lg font-bold text-rose-100">صراع النقيض</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-rose-200/70">
          نقيضك هو الأبعد عن بصمتك العقلية — لا عداوة شخصية، بل صدام بين عقلين متعاكسين. والنزال يُحكم من أدائك الحقيقي
          المُعلن خلال 3 أيام.
        </p>
        {nemesis && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-900/20 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-rose-200/80">نقيضك المعلن</span>
              <span className="font-bold text-rose-100">{nemesis.nemesisName}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-rose-200/60">تباعد البصمتين</span>
              <span className="font-mono text-rose-300">{nemesis.nemesisContrast}%</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-emerald-200/60">توأم روحك (للمقارنة)</span>
              <span className="text-emerald-300">
                {nemesis.twinName} — قرب {nemesis.twinAffinity}%
              </span>
            </div>
          </div>
        )}
        {!nemesis && (
          <p className="mt-2 rounded-lg bg-slate-800/60 p-2 text-xs text-slate-300">
            لا نقيض معلن لك بعد — العب 8+ إجابات ليُبنى نقيضك، ثم عُد لتُشعل الحرب.
          </p>
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

      {/* أزرار الإشعال */}
      <div className="flex gap-2">
        <button
          onClick={doChallenge}
          disabled={busy || !nemesis}
          className="flex-1 rounded-xl bg-gradient-to-l from-rose-600 to-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-900/40 transition hover:brightness-110 disabled:opacity-40"
        >
          <Flame className="ml-1 inline h-4 w-4" /> أشعل نزالاً بنفسك
        </button>
        <button
          onClick={() =>
            setMsg({
              text: board?.openCount ? `${board.openCount} نزالاً مفتوحاً في الساحة الآن` : "لا نزالات مفتوحة في الساحة",
              good: true,
            })
          }
          className="rounded-xl border border-rose-500/30 bg-slate-900/60 px-4 py-2.5 text-sm text-rose-200 transition hover:bg-slate-800"
        >
          <Skull className="ml-1 inline h-4 w-4" /> الساحة
        </button>
      </div>

      {/* نزالاتي */}
      <div className="space-y-3">
        {duels && duels.length === 0 && (
          <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
            لا نزالات بعد — أشعل واحداً، أو انتظر دورة الإشعال الآلي (كل ساعة للاعبين النشطين).
          </p>
        )}
        {(duels ?? []).map((d) => {
          const myDeclared = d.challengerDeclared ?? d.foeDeclared;
          const bothDeclared = Boolean(d.challengerDeclared && d.foeDeclared);
          return (
            <div
              key={d._id}
              className={`rounded-2xl border p-4 ${
                d.status === "open" ? "border-rose-500/30 bg-slate-950/70" : "border-slate-600/30 bg-slate-900/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-rose-200">{TIER_LABEL[d.tier] ?? "نزال"}</span>
                {d.status === "open" ? (
                  <span className="rounded-full bg-rose-950/60 px-2 py-0.5 text-[10px] text-rose-300">
                    ⏳ {timeLeft(d.judgeAt)}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                    {d.winner === "draw" ? "تعادل" : "حُسم"}
                  </span>
                )}
              </div>

              {/* وجهاً لوجه */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex-1 rounded-xl bg-slate-800/50 p-2 text-center">
                  <div className="truncate text-xs font-bold text-amber-200">{d.challengerName}</div>
                  <div className="text-[10px] text-slate-400">المتحدّي</div>
                  {d.challengerDeclared && (
                    <div className="mt-1 font-mono text-[10px] text-emerald-300">
                      {d.challengerDeclared.score} نقطة · {d.challengerDeclared.correct}/{d.challengerDeclared.questions}
                    </div>
                  )}
                </div>
                <Swords className="h-4 w-4 shrink-0 text-rose-400" />
                <div className="flex-1 rounded-xl bg-slate-800/50 p-2 text-center">
                  <div className="truncate text-xs font-bold text-sky-200">{d.foeName}</div>
                  <div className="text-[10px] text-slate-400">النقيض</div>
                  {d.foeDeclared && (
                    <div className="mt-1 font-mono text-[10px] text-emerald-300">
                      {d.foeDeclared.score} نقطة · {d.foeDeclared.correct}/{d.foeDeclared.questions}
                    </div>
                  )}
                </div>
              </div>

              {/* النكتة */}
              {d.status === "open" && !myDeclared && (
                <p className="mt-2 rounded-lg bg-rose-950/30 p-2 text-[11px] italic leading-relaxed text-rose-300/90">
                  «{d.salt}»
                </p>
              )}

              {/* السرد */}
              {d.narrative && (
                <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-950/20 p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-purple-300">
                    <ScrollText className="h-3 w-3" /> رواية النزال
                  </div>
                  <p className="text-[11px] leading-relaxed text-purple-100/90">{d.narrative}</p>
                </div>
              )}

              {/* الحكم */}
              {d.status === "settled" && d.verdictDetail && (
                <p className={`mt-2 text-[11px] ${d.winner === "draw" ? "text-slate-400" : "text-amber-300"}`}>
                  ⚖️ {d.verdictDetail}
                </p>
              )}

              {/* أزرار الطرف */}
              {d.status === "open" && (
                <div className="mt-3 space-y-2">
                  {openFormFor !== d._id && (
                    <button
                      onClick={() => setOpenFormFor(d._id)}
                      disabled={busy || bothDeclared}
                      className="w-full rounded-lg bg-rose-600/80 py-2 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-40"
                    >
                      {myDeclared ? "أعلنت — بانتظار خصمك" : "أعلن أدائي الحقيقي"}
                    </button>
                  )}
                  {openFormFor === d._id && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-rose-500/20 bg-slate-900/60 p-3">
                      <input
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="النتيجة"
                        inputMode="numeric"
                        value={form.score}
                        onChange={(e) => setForm({ ...form, score: e.target.value })}
                      />
                      <input
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="إجابات صحيحة"
                        inputMode="numeric"
                        value={form.correct}
                        onChange={(e) => setForm({ ...form, correct: e.target.value })}
                      />
                      <input
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="عدد الأسئلة"
                        inputMode="numeric"
                        value={form.questions}
                        onChange={(e) => setForm({ ...form, questions: e.target.value })}
                      />
                      <input
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="عدد اللاعبين"
                        inputMode="numeric"
                        value={form.players}
                        onChange={(e) => setForm({ ...form, players: e.target.value })}
                      />
                      <input
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="أسرع إجابة (ثوانٍ)"
                        inputMode="decimal"
                        value={form.fastest}
                        onChange={(e) => setForm({ ...form, fastest: e.target.value })}
                      />
                      <select
                        className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none"
                        value={form.won}
                        onChange={(e) => setForm({ ...form, won: e.target.value })}
                      >
                        <option value="true">فزت بالجولة</option>
                        <option value="false">خسرت الجولة</option>
                      </select>
                      <button
                        onClick={() => doDeclare(d._id)}
                        disabled={busy}
                        className="col-span-2 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                      >
                        قدّم البصمة للنزال
                      </button>
                    </div>
                  )}
                  {openFormFor !== d._id && (
                    <button
                      onClick={() => doEnhance(d._id)}
                      disabled={busy}
                      className="w-full rounded-lg border border-purple-500/30 py-1.5 text-[11px] text-purple-300 transition hover:bg-purple-950/40 disabled:opacity-40"
                    >
                      <Sparkles className="ml-1 inline h-3 w-3" /> أعد السرد بالذكاء
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* لوحة الرعب العامة */}
      {board && (board.open.length > 0 || board.settled.length > 0) && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-slate-200">🔥 لوحة الرعب — أشرس النزالات</h3>
          <div className="space-y-1.5">
            {board.open.slice(0, 4).map((d) => (
              <div key={d._id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-1.5 text-[11px]">
                <span className="text-slate-300">
                  {d.challengerName} <span className="text-rose-400">⚡</span> {d.foeName}
                </span>
                <span className="font-mono text-rose-300">تباعد {d.contrast}%</span>
              </div>
            ))}
            {board.settled.slice(0, 3).map((d) => (
              <div key={d._id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-1.5 text-[11px]">
                <span className="text-slate-400">
                  {d.winner === "challenger" ? d.challengerName : d.winner === "foe" ? d.foeName : "تعادل"}
                </span>
                <span className="text-emerald-400/80">+{d.reward} ولاء</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
