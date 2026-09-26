import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Sparkles, Flame, Trophy } from "lucide-react";

/**
 * ✨ لحظات القدر — جدار الأسطورة
 * كل لحظة استثنائية في اللعبة تُحفظ هنا بقصة وندرة — ليلعب الجميع ليدخلوا الجدار.
 */

type Moment = {
  _id: string;
  userName: string;
  kind: string;
  title: string;
  narrative?: string;
  detail: string;
  rarity: number;
  playedAt: number;
};

const KIND_META: Record<string, { icon: string; label: string }> = {
  perfection_hard: { icon: "💯", label: "الكمال" },
  streak_legend: { icon: "🔥", label: "سلسلة" },
  comeback: { icon: "🕊️", label: "عودة" },
  photo_finish: { icon: "📏", label: "فارق ضئيل" },
  speed_demon: { icon: "⚡", label: "صاعق" },
  dark_horse_win: { icon: "🐎", label: "حصان أسود" },
  marathon_mind: { icon: "🏃", label: "ماراثون" },
  nemesis_fall: { icon: "👑", label: "سقوط عملاق" },
};

function rarityStyle(r: number): string {
  if (r >= 85) return "border-amber-400/50 bg-amber-500/12";
  if (r >= 75) return "border-fuchsia-400/40 bg-fuchsia-500/10";
  return "border-white/12 bg-white/5";
}

export function MomentWall() {
  const wall = useQuery(api.aiMoment.getWall) as Moment[] | undefined;
  const mine = useQuery(api.aiMoment.getMyMoments) as Moment[] | undefined;
  const stats = useQuery(api.aiMoment.getMomentStats) as
    | { total: number; rarest: number | null; topKind: string | null }
    | undefined;

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4" dir="rtl">
      {/* الرأس */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-l from-amber-500/15 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-300" />
          <h2 className="text-base font-extrabold text-amber-100">جدار الأسطورة</h2>
          <span className="mr-auto text-[10px] text-white/40">
            {stats ? `${stats.total} لحظة · أندرها ${stats.rarest ?? 0}%` : "…"}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          اللحظات الاستثنائية لا تضيع هنا — يكتشفها الذكاء من جولاتكم الحقيقية ويكتب قصصها.
        </p>
      </div>

      {/* لحظاتي */}
      {mine && mine.length > 0 && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200">
            <Trophy className="h-4 w-4" />
            لحظاتك المخلّدة ({mine.length})
          </div>
          <div className="mt-2 space-y-1.5">
            {mine.slice(0, 3).map((m) => (
              <div key={m._id} className="rounded-xl bg-black/25 p-2.5 text-xs text-white/85">
                {KIND_META[m.kind]?.icon ?? "✨"} {m.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الجدار */}
      {wall && wall.length > 0 ? (
        <div className="space-y-2.5">
          {wall.map((m) => {
            const meta = KIND_META[m.kind] ?? { icon: "✨", label: "لحظة" };
            return (
              <div key={m._id} className={`rounded-2xl border p-4 ${rarityStyle(m.rarity)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/75">
                    <span>{meta.icon}</span>
                    {meta.label}
                    <span className="text-white/35">· {m.userName}</span>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    <Flame className="h-3 w-3" />
                    {m.rarity}% ندرة
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-bold text-white">{m.title}</div>
                {m.narrative && (
                  <p className="mt-2 rounded-xl bg-black/25 p-3 text-xs leading-relaxed text-white/75">
                    {m.narrative}
                  </p>
                )}
                <div className="mt-1.5 text-[10px] text-white/40">
                  {new Date(m.playedAt).toLocaleDateString("ar", { day: "numeric", month: "long" })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-xs text-white/45">
          الجدار صامت… العب جولاتك — اللحظة القادمة قد تكون أسطورتك
        </div>
      )}
    </div>
  );
}
