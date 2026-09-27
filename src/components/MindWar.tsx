import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Radio, Swords, Users, Flame } from "lucide-react";

/**
 * ⚔️ الحرب الكبرى — جيشان كونيان من عقول المجتمع: البرق ضد العزائم.
 * كل إجابة حقيقية أثناء الحرب طلقة، والجبهة تتحرك بأرقام لا آراء.
 */

type WarReport = { at: number; text: string; engine: string };

type War = {
  _id: string;
  armyAName: string;
  armyAEmoji: string;
  armyBName: string;
  armyBEmoji: string;
  soldierCount: number;
  front: number;
  totalRoundsA: number;
  totalRoundsB: number;
  reports: WarReport[];
  winner?: "A" | "B" | "draw";
  status: "active" | "settled";
  startedAt: number;
  endsAt: number;
  settledAt?: number;
};

type Soldier = {
  _id: string;
  name: string;
  army: string;
  medianMs: number;
  rounds: number;
  bonusRounds: number;
  mvp?: boolean;
};

type WarView = {
  war: War | null;
  mySoldier: Soldier | null;
  top: Array<{ _id: string; name: string; army: string; rounds: number; bonusRounds: number; mvp?: boolean }>;
  past: War[];
};

function daysLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "الحسم وشيك";
  const d = Math.floor(ms / 86_400_000);
  return `${d} يوم و${Math.floor((ms % 86_400_000) / 3_600_000)} ساعة`;
}

export function MindWar() {
  const view = useQuery(api.aiWar.getWar) as WarView | undefined;
  const enlistM = useMutation(api.aiWar.enlistWar);
  const refreshM = useMutation(api.aiWar.refreshNow);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);

  const doEnlist = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enlistM({});
      setMsg({
        text:
          r.myArmy === "A"
            ? `أُعلنت الحرب! أنت مجنّد في عقول البرق ⚡ (${r.armyA} مقابل ${r.armyB})`
            : r.myArmy === "B"
              ? `أُعلنت الحرب! أنت مجنّد في عقول العزائم 🛡️ (${r.armyA} مقابل ${r.armyB})`
              : `أُعلنت الحرب (${r.armyA} ⚡ مقابل ${r.armyB} 🛡️) — بصمتك تحت 8 إجابات فلم تُجنَّد بعد`,
        good: true,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل الإعلان", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doRefresh = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await refreshM({});
      setMsg({
        text: `مُسحت الذخيرة الحية: ${r.swept} جولة — ${r.reported ? "ووصل بث المراسل" : "المراسل يُبث كل 20 ساعة"}`,
        good: true,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  const war = view?.war ?? null;
  const soldier = view?.mySoldier ?? null;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-orange-500/35 bg-gradient-to-b from-orange-950/40 via-slate-950/70 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-bold text-orange-100">الحرب الكبرى</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-orange-200/70">
          عقول المجتمع تنقسم جيشين وفق طبيعة تفكيرها: ⚡ البرق (وسط سرعة أقل من 6 ثوانٍ) ضد 🛡️ العزائم (المتقنون
          المتروّون). كل إجابة صحيحة أثناء الحرب طلقة — والجبهة تتحرك بأرقامكم لا بأصواتكم.
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

      {/* لا حرب */}
      {!war && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-5 text-center">
          <Swords className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-2 text-sm text-slate-300">لا حرب مستعرة الآن — الجيوش تنتظر من يوقظها.</p>
          {view && view.past.length > 0 && (
            <div className="mt-3 space-y-1.5 text-right">
              {view.past.slice(0, 3).map((p) => (
                <div key={p._id} className="rounded-lg bg-slate-900/50 px-3 py-2 text-[11px] text-slate-300">
                  {p.winner === "A" ? p.armyAEmoji : p.winner === "B" ? p.armyBEmoji : "🌫️"}{" "}
                  {p.winner === "A" ? p.armyAName : p.winner === "B" ? p.armyBName : "تعادل كوني"} — ذخيرة{" "}
                  {p.totalRoundsA}:{p.totalRoundsB}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={doEnlist}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-gradient-to-l from-orange-600 to-red-700 py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/40 transition hover:brightness-110 disabled:opacity-40"
          >
            <Swords className="ml-1 inline h-4 w-4" /> أعلن الحرب الكبرى وجنّد العقول
          </button>
        </div>
      )}

      {/* الجبهة الحية */}
      {war && (
        <div className="rounded-2xl border border-orange-500/30 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-orange-100">🔥 الجبهة الحية</span>
            <span className="rounded-full bg-orange-950/60 px-2 py-0.5 text-[10px] text-orange-300">
              ⏳ {daysLeft(war.endsAt)}
            </span>
          </div>

          {/* الجيشان */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div
              className={`rounded-xl p-3 text-center ${
                war.front > 10 ? "bg-amber-950/40 ring-1 ring-amber-500/40" : "bg-slate-800/40"
              }`}
            >
              <div className="text-lg">{war.armyAEmoji}</div>
              <div className="text-xs font-bold text-amber-200">{war.armyAName}</div>
              <div className="mt-1 text-xl font-black text-amber-300">{war.totalRoundsA}</div>
              <div className="text-[10px] text-slate-400">ذخيرة</div>
            </div>
            <div
              className={`rounded-xl p-3 text-center ${
                war.front < -10 ? "bg-sky-950/40 ring-1 ring-sky-500/40" : "bg-slate-800/40"
              }`}
            >
              <div className="text-lg">{war.armyBEmoji}</div>
              <div className="text-xs font-bold text-sky-200">{war.armyBName}</div>
              <div className="mt-1 text-xl font-black text-sky-300">{war.totalRoundsB}</div>
              <div className="text-[10px] text-slate-400">ذخيرة</div>
            </div>
          </div>

          {/* شريط الجبهة */}
          <div className="mt-3">
            <div className="relative h-4 overflow-hidden rounded-full bg-gradient-to-l from-amber-900/60 via-slate-800 to-sky-900/60">
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-400 to-orange-500 transition-all duration-700"
                style={{ width: `${Math.round(((war.front + 100) / 200) * 100)}%` }}
              />
              <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/40" />
            </div>
            <div className="mt-1 flex justify-between text-[10px]">
              <span className="text-sky-300/70">تقدم {war.armyBName}</span>
              <span className="text-slate-400">
                الجبهة: {war.front > 0 ? "+" : ""}
                {war.front}
              </span>
              <span className="text-amber-300/70">تقدم {war.armyAName}</span>
            </div>
          </div>

          {/* مجندي */}
          {soldier ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800/50 p-3">
              <span className="text-xs text-slate-300">
                تمركزك: {soldier.army === "A" ? war.armyAEmoji : war.armyBEmoji}{" "}
                <b>{soldier.army === "A" ? war.armyAName : war.armyBName}</b> — وسيط سرعتك{" "}
                {(soldier.medianMs / 1000).toFixed(1)}ث{soldier.mvp ? " 🌟" : ""}
              </span>
              <span className="font-mono text-xs text-emerald-300">{soldier.rounds + soldier.bonusRounds} ذخيرة لك</span>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-800/40 p-2 text-[11px] text-slate-400">
              لم تُجنَّد في هذه الحرب (بصمة السرعة تحت 8 إجابات) — العب جولات لتحمل سلاحك في القادمة.
            </p>
          )}

          {/* أفضل العقول */}
          {view && view.top.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Users className="h-3.5 w-3.5" /> أشرس عقول الجبهة
              </div>
              <div className="space-y-1">
                {view.top.slice(0, 5).map((s) => (
                  <div
                    key={s._id}
                    className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2.5 py-1 text-[11px]"
                  >
                    <span className="text-slate-200">
                      {s.mvp ? "🌟 " : ""}
                      {s.army === "A" ? war.armyAEmoji : war.armyBEmoji} {s.name}
                    </span>
                    <span className="font-mono text-orange-300">{s.rounds + s.bonusRounds}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تقارير المراسل */}
          {war.reports.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                <Radio className="h-3.5 w-3.5" /> بث المراسل الحربي
              </div>
              {[...war.reports]
                .reverse()
                .slice(0, 3)
                .map((r, i) => (
                  <p
                    key={`${r.at}-${i}`}
                    className="rounded-lg border border-orange-500/15 bg-orange-950/15 p-2 text-[11px] leading-relaxed text-orange-100/85"
                  >
                    {r.text}
                    <span className="mr-1 text-[9px] text-slate-500">({r.engine === "llm" ? "مباشر" : "محلي"})</span>
                  </p>
                ))}
            </div>
          )}

          <button
            onClick={doRefresh}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-orange-600/80 py-2 text-xs font-bold text-white transition hover:bg-orange-500 disabled:opacity-40"
          >
            امسح الذخيرة الحية الآن
          </button>
        </div>
      )}

      {/* كيف تُحسب الذخيرة */}
      {war && (
        <p className="text-center text-[10px] leading-relaxed text-slate-500">
          الذخيرة = كل إجابة صحيحة (1 نقطة) + كل جولة مكسورة (قذيفة مزدوجة) — تُكتشف آلياً من سجل اللعب الحقيقي، والمهمة
          الدورية تمسحها كل ساعة.
        </p>
      )}
    </div>
  );
}
