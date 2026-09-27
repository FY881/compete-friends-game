import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Trophy, Medal, ScrollText, Sparkles, Swords, ShieldCheck } from "lucide-react";

/**
 * 🏆 كأس التحالفات — نقاط شرف من أفعال حقيقية: نزالات نصرت، خطط فزت،
 * تغطيات أنجزت. أربعة أقسام (ظل → فولاذ → ذهب → أسطورة) وتتويج موسمي.
 */

type Honor = {
  season: number;
  seasonEndsAt: number;
  twinName: string | null;
  hasTwin: boolean;
  pts: { duels: number; plans: number; covers: number; halfCovers: number; total: number };
  registered: { name: string; division: string; crest: string; honorPoints: number } | null;
};

type CupRow = {
  _id: string;
  name: string;
  crest: string;
  division: string;
  honorPoints: number;
  duelsWon: number;
  plansWon: number;
  coversFull: number;
  coversHalf: number;
  status: "open" | "crowned" | "closed";
};

type Standings = {
  season: number;
  endsAt: number;
  divisions: Record<string, CupRow[]>;
  myRow: CupRow | null;
};

type Season = {
  _id: string;
  season: number;
  championName: string;
  championCrest: string;
  championPoints: number;
  runnerName?: string;
  runnerPoints: number;
  teamsCount: number;
  chronicle?: string;
};

const DIV_STYLE: Record<string, string> = {
  "أسطورة": "border-amber-400/40 bg-amber-950/20",
  "ذهب": "border-yellow-500/30 bg-yellow-950/15",
  "فولاذ": "border-slate-400/30 bg-slate-800/30",
  "ظل": "border-slate-600/25 bg-slate-900/40",
};

function daysLeft(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "التتويج وشيك";
  const d = Math.floor(ms / 86_400_000);
  return `${d} يوم و${Math.floor((ms % 86_400_000) / 3_600_000)} ساعة`;
}

export function AllianceCup() {
  const honor = useQuery(api.aiCup.getMyHonor) as Honor | undefined;
  const standings = useQuery(api.aiCup.getStandings) as Standings | undefined;
  const history = useQuery(api.aiCup.getSeasonHistory) as Season[] | undefined;

  const registerM = useMutation(api.aiCup.registerCup);
  const refreshM = useMutation(api.aiCup.refreshMyHonor);
  const herald = useMutation(api.aiCup.crownHerald);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [chronicle, setChronicle] = useState<string | null>(null);

  const doRegister = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await registerM({});
      setMsg({ text: `انضم «${r.name}» ${r.crest} إلى قسم «${r.division}» بـ${r.points} نقطة شرف.`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل التسجيل", good: false });
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
        text: r.promoted
          ? `ارتفع تحالفك إلى قسم «${r.division}» 🎖️ (${r.points} نقطة)`
          : `أُعيد حساب الشرف: ${r.points} نقطة في قسم «${r.division}»`,
        good: true,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل التحديث", good: false });
    } finally {
      setBusy(false);
    }
  };

  const doHerald = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await herald({});
      if (r.ok) setChronicle(r.chronicle);
      else setMsg({ text: r.note ?? "تعذّر استدعاء المُعلن", good: false });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "فشل", good: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4 p-4">
      {/* الرأس */}
      <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-b from-amber-950/35 to-slate-950/60 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-bold text-amber-100">كأس التحالفات</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
          نزال نقيض نصرت (+25) · خطة حرب فزت (+20) · تغطية تحالف مكتملة (+30) — نقاط شرف حقيقية تنقل تحالفك بين أربعة
          أقسام، والبطل يُتوَّج كل 14 يوماً.
        </p>
        {standings && (
          <p className="mt-1 text-[10px] text-amber-200/50">
            الموسم {standings.season} — يُقفل بعد {daysLeft(standings.endsAt)}
          </p>
        )}
      </div>

      {/* رسالة */}
      {msg && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            msg.good ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200" : "border-amber-500/40 bg-amber-950/40 text-amber-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* شرفي */}
      {honor && (
        <div className="rounded-2xl border border-amber-400/25 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-200/80">نقاط شرفك هذا الموسم</span>
            <span className="text-xl font-black text-amber-300">{honor.pts.total}</span>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px]">
            <div className="rounded-lg bg-slate-800/60 p-1.5">
              <Swords className="mx-auto h-3.5 w-3.5 text-rose-300" />
              <div className="mt-0.5 font-bold text-slate-200">{honor.pts.duels}</div>
              <div className="text-slate-500">نزالات</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-1.5">
              <ScrollText className="mx-auto h-3.5 w-3.5 text-teal-300" />
              <div className="mt-0.5 font-bold text-slate-200">{honor.pts.plans}</div>
              <div className="text-slate-500">خطط</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-1.5">
              <ShieldCheck className="mx-auto h-3.5 w-3.5 text-emerald-300" />
              <div className="mt-0.5 font-bold text-slate-200">{honor.pts.covers}</div>
              <div className="text-slate-500">تغطيات</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-1.5">
              <Medal className="mx-auto h-3.5 w-3.5 text-slate-300" />
              <div className="mt-0.5 font-bold text-slate-200">{honor.pts.halfCovers}</div>
              <div className="text-slate-500">أنصاف</div>
            </div>
          </div>

          {honor.registered ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-950/20 p-3">
              <span className="text-xs text-amber-100">
                {honor.registered.crest} {honor.registered.name}
              </span>
              <span className="rounded bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-300">
                {honor.registered.division} · {honor.registered.honorPoints}
              </span>
            </div>
          ) : honor.hasTwin ? (
            <button
              onClick={doRegister}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-gradient-to-l from-amber-500 to-yellow-600 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-900/40 transition hover:brightness-110 disabled:opacity-40"
            >
              <Trophy className="ml-1 inline h-4 w-4" /> سجّل تحالفك في الكأس
            </button>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-800/50 p-2 text-[11px] text-slate-400">
              التسجيل يحتاج توأماً معلناً — افتح بازار العقول أولاً.
            </p>
          )}

          {honor.registered && (
            <button
              onClick={doRefresh}
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-amber-500/30 py-1.5 text-[11px] text-amber-300 transition hover:bg-amber-950/30 disabled:opacity-40"
            >
              حدّث نقاط شرفك بعد إنجازات جديدة
            </button>
          )}
        </div>
      )}

      {/* أقسام الكأس */}
      {standings && (
        <div className="space-y-2">
          {(["أسطورة", "ذهب", "فولاذ", "ظل"] as const).map((div) => {
            const rows = standings.divisions[div] ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={div} className={`rounded-2xl border p-3 ${DIV_STYLE[div]}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">
                    {div === "أسطورة" ? "🏆" : div === "ذهب" ? "🥇" : div === "فولاذ" ? "🛡️" : "🌑"} قسم {div}
                  </span>
                  <span className="text-[10px] text-slate-400">{rows.length} تحالف</span>
                </div>
                <div className="space-y-1">
                  {rows.slice(0, 5).map((r, i) => (
                    <div key={r._id} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2.5 py-1.5 text-[11px]">
                      <span className="text-slate-200">
                        {i === 0 && div === "أسطورة" ? "👑 " : ""}
                        {r.crest} {r.name}
                      </span>
                      <span className="font-mono text-amber-300">{r.honorPoints}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Object.values(standings.divisions).every((v) => v.length === 0) && (
            <p className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
              لا تحالفات مسجلة بعد — كن أول من يرفع شعار التحالف هذا الموسم.
            </p>
          )}
        </div>
      )}

      {/* رخام الأبطال */}
      {history && history.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4">
          <h3 className="mb-2 text-sm font-bold text-slate-200">🏛️ رخام الأبطال</h3>
          <div className="space-y-1.5">
            {history.slice(0, 4).map((s) => (
              <div key={s._id} className="rounded-lg bg-slate-900/50 px-3 py-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-200">
                    {s.championCrest} {s.championName}
                  </span>
                  <span className="text-slate-500">موسم {s.season} · {s.championPoints} نقطة</span>
                </div>
                {s.runnerName && (
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    🥈 الوصيف: {s.runnerName} ({s.runnerPoints})
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={doHerald}
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-amber-500/30 py-1.5 text-[11px] text-amber-300 transition hover:bg-amber-950/30 disabled:opacity-40"
          >
            <Sparkles className="ml-1 inline h-3.5 w-3.5" /> اقرأ نبأ التتويج بلسان المُعلن
          </button>
          {chronicle && (
            <p className="mt-2 rounded-lg bg-amber-950/15 p-2 text-[11px] leading-relaxed text-amber-100/90">{chronicle}</p>
          )}
        </div>
      )}
    </div>
  );
}
