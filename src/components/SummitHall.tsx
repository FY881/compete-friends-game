import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { TreePine, ScrollText, Sparkles, Dna } from "lucide-react";

/**
 * 🌳 عقل القمة — واجهة اللاعب
 * الوصية العقلية: ميراث من لاعب خبير راحل، وبنك جينات حي.
 */

type Legacy = {
  ancestorName: string;
  geneStrong: string;
  geneSecond: string;
  geneWeak: string;
  strengthAcc: number;
  overallAcc: number;
  charter?: string;
  inheritedAt?: number;
};

export function SummitHall() {
  const myLegacy = useQuery(api.aiSummit.getMyLegacy) as Legacy | null | undefined;
  const stats = useQuery(api.aiSummit.getGenealogyStats) as
    | { total: number; inherited: number; available: number }
    | undefined;
  const ancestry = useQuery(api.aiSummit.getMyAncestry) as
    | { geneStrong: string; heirName: string | null }
    | null
    | undefined;
  const claimLegacy = useAction(api.aiSummit.claimLegacy);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClaim() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await claimLegacy();
      setMsg(`🌳 ورثت عقل «${r.ancestor}» — ${r.geneStrong} قوته، و${r.geneWeak} وهمه`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذر استلام الميراث"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl border border-lime-400/30 bg-gradient-to-l from-lime-500/12 to-transparent p-4">
        <div className="flex items-center gap-2">
          <TreePine className="h-5 w-5 text-lime-300" />
          <h2 className="text-base font-extrabold text-lime-100">عقل القمة التطوري</h2>
          <span className="mr-auto text-[10px] text-white/40">
            {stats ? `${stats.total} عقلاً · ${stats.available} بانتظار الوارث` : "…"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          عقول اللاعبين الغائبين تتحلل إلى جينات معرفية — ومن يعقبهم يرث وصيتهم ويحيي اسمهم.
        </p>
      </div>

      {/* وصيتي */}
      {myLegacy ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
            <ScrollText className="h-4 w-4" />
            الوصية العقلية التي ورثتها
          </div>
          <div className="mt-2 text-sm font-bold text-white">من عقل: {myLegacy.ancestorName} 🕊️</div>
          {myLegacy.charter && (
            <p className="mt-2 rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-amber-50/90">
              «{myLegacy.charter}»
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/15 p-2">
              <div className="text-[10px] text-white/50">قوته</div>
              <div className="text-sm font-bold text-emerald-200">{myLegacy.geneStrong}</div>
              <div className="text-[10px] text-white/40">{myLegacy.strengthAcc}%</div>
            </div>
            <div className="rounded-xl bg-sky-500/15 p-2">
              <div className="text-[10px] text-white/50">ثانويته</div>
              <div className="text-sm font-bold text-sky-200">{myLegacy.geneSecond}</div>
            </div>
            <div className="rounded-xl bg-red-500/15 p-2">
              <div className="text-[10px] text-white/50">وهمه — تجنّبه</div>
              <div className="text-sm font-bold text-red-200">{myLegacy.geneWeak}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-5 text-center">
          <Dna className="mx-auto h-8 w-8 text-lime-300/60" />
          <p className="mt-2 text-xs text-white/55">
            لم تستلم وصية بعد — بنك الجينات فيه {stats?.available ?? 0} عقلاً بانتظار وارث
          </p>
          <button
            onClick={onClaim}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-xl bg-lime-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-lime-500 disabled:opacity-50 mx-auto"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {busy ? "يستلم الميراث…" : "استلم وصية عقلية"}
          </button>
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-white/15 bg-black/30 p-3 text-center text-xs text-white/85">{msg}</div>
      )}

      {/* أنا واهب؟ */}
      {ancestry && (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-xs text-white/65">
          🕊️ بصمتك تحللت وبقيت في التراث — قوتك «{ancestry.geneStrong}» ما زالت تُدرَّس لمن يرثها.
        </div>
      )}
    </div>
  );
}
