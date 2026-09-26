import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Dna, Swords, Map, Send, RefreshCw } from "lucide-react";

/**
 * 🧬 بازار العقول — واجهة اللاعب
 * توأم الروح 👯 · نقيضك ⚔️ · مسار العقل 🗺️ · عهود التحدي 🤝
 */

type Soulmate = {
  twinName: string;
  twinAffinity: number;
  nemesisName: string;
  nemesisContrast: number;
};

type MindPath = {
  focusCategory: string;
  secondCategory: string;
  strengthCategory: string;
  weakAcc: number;
  strongAcc: number;
  coachNote: string;
  weeklyTarget: number;
};

type Pact = {
  _id: string;
  fromName: string;
  kind: string;
  message: string;
  status: string;
};

export function MentorHub() {
  const soulmate = useQuery(api.aiMentor.getMySoulmate) as Soulmate | null | undefined;
  const path = useQuery(api.aiMentor.getMyPath) as MindPath | null | undefined;
  const stats = useQuery(api.aiMentor.getBazaarStats) as { souls: number; paths: number } | undefined;
  const bonds = useQuery(api.aiMentor.getMyBonds) as Pact[] | undefined;

  const buildPath = useAction(api.aiMentor.buildMyPath);
  const challengeTwin = useMutation(api.aiMentor.challengeMyTwin);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onBuildPath() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await buildPath();
      setMsg(`🗺️ جُدّد مسار عقلك — بؤرة الأسبوع: «${p.focusCategory}»`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "فشل بناء المسار"}`);
    } finally {
      setBusy(false);
    }
  }

  async function onChallengeTwin() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await challengeTwin({});
      setMsg(`🤝 أُرسل التحدي إلى «${r.to}»`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذر إرسال التحدي"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-l from-amber-500/10 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Dna className="h-5 w-5 text-amber-300" />
          <h2 className="text-base font-extrabold text-amber-100">بازار العقول</h2>
          <span className="mr-auto text-[10px] text-white/40">
            {stats ? `${stats.souls} توأمة · ${stats.paths} مساراً` : "…"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          عقول اللاعبين تقارن ببعضها من إجاباتكم الحقيقية — من يشبه عقلك؟ ومن يناقضه؟
        </p>
      </div>

      {/* توأم الروح + نقيضك */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="text-[11px] font-bold text-emerald-200">👯 توأم الروح</div>
          {soulmate ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-white">{soulmate.twinName}</div>
              <div className="text-xs text-emerald-100/80">قرب العقلين {soulmate.twinAffinity}%</div>
              <button
                onClick={onChallengeTwin}
                disabled={busy}
                className="mt-2 flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
                تحدَّ توأمك
              </button>
            </>
          ) : (
            <div className="mt-2 text-xs text-white/45">
              الشبكة تُبنى دورياً من إجابات اللاعبين — العب أكثر ليكتشف عقلك توأمه
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
          <div className="text-[11px] font-bold text-red-200">⚔️ نقيضك</div>
          {soulmate ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-white">{soulmate.nemesisName}</div>
              <div className="text-xs text-red-100/80">تباعد العقلين {soulmate.nemesisContrast}%</div>
              <div className="mt-2 text-[10px] leading-relaxed text-white/45">
                قوته في ضعفك — أثمن خصم لتدريب نقاط عم盲ك
              </div>
            </>
          ) : (
            <div className="mt-2 text-xs text-white/45">لم يُحدَّد بعد</div>
          )}
        </div>
      </div>

      {/* مسار العقل */}
      <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-200">
            <Map className="h-4 w-4" />
            مسار العقل — خطة الأسبوع
          </div>
          <button
            onClick={onBuildPath}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {path ? "تجديد" : "ابنِ مساري"}
          </button>
        </div>
        {path ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-red-500/15 p-2">
                <div className="text-[10px] text-white/50">بؤرة التدريب</div>
                <div className="text-sm font-bold text-red-200">{path.focusCategory}</div>
                <div className="text-[10px] text-white/40">{path.weakAcc}% دقة</div>
              </div>
              <div className="rounded-xl bg-amber-500/15 p-2">
                <div className="text-[10px] text-white/50">ثاني أولوية</div>
                <div className="text-sm font-bold text-amber-200">{path.secondCategory}</div>
              </div>
              <div className="rounded-xl bg-emerald-500/15 p-2">
                <div className="text-[10px] text-white/50">حصينتك</div>
                <div className="text-sm font-bold text-emerald-200">{path.strengthCategory}</div>
                <div className="text-[10px] text-white/40">{path.strongAcc}% دقة</div>
              </div>
            </div>
            <p className="rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-sky-50/90">
              🎓 {path.coachNote}
            </p>
            <div className="text-[10px] text-white/40">هدف الأسبوع: {path.weeklyTarget} إجابة صحيحة على بؤرة التدريب</div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/45">
            ابنِ مسارك ليحلل عقلك: أضعف فئتين، أقوى حصينتك، وخطة أسبوعية من مدرّبك
          </p>
        )}
      </div>

      {/* عهود واردة */}
      {bonds && bonds.length > 0 && (
        <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-200">
            <Swords className="h-4 w-4" />
            عهود التحدي الواردة
          </div>
          <div className="mt-2 space-y-1.5">
            {bonds.map((b) => (
              <div key={b._id} className="rounded-xl bg-black/25 p-2.5 text-xs text-white/80">
                <span className="font-bold text-violet-100">{b.fromName}</span> — {b.message}
                <span className="mr-2 text-[10px] text-white/40">
                  {b.status === "pending" ? "⏳ بانتظار الرد" : b.status === "accepted" ? "✅ مقبول" : "❌ مرفوض"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-white/15 bg-black/30 p-3 text-center text-xs text-white/85">
          {msg}
        </div>
      )}
    </div>
  );
}
