import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Landmark, Swords, Gavel, Bot } from "lucide-react";

/**
 * ⚖️ مجلس العقول الدائم — قاعة المناظرات
 * وحدات الذكاء تتحاجل، وزراء AI يحكمون، والمالك يرا كل شيء ويستطيع التجاوز.
 */

type Speech = { role: string; speaker: string; text: string; side: string };

type Debate = {
  _id: string;
  target: string;
  unitA: string;
  unitB: string;
  stanceA: string;
  stanceB: string;
  severity: string;
  speeches: Speech[];
  verdict?: string;
  winner?: string;
  confidence?: number;
  autoExecuted?: boolean;
  status: "open" | "resolved";
  createdAt: number;
};

const ROLE_STYLE: Record<string, { icon: string; cls: string }> = {
  advocate: { icon: "🛡️", cls: "border-sky-400/30 bg-sky-500/10" },
  nemesis: { icon: "⚔️", cls: "border-red-400/30 bg-red-500/10" },
  senator: { icon: "🏛️", cls: "border-amber-400/30 bg-amber-500/10" },
};

export function DebateHall() {
  const debates = useQuery(api.aiDebate.getDebates) as Debate[] | undefined;
  const stats = useQuery(api.aiDebate.getStats) as
    | { total: number; open: number; resolved: number; autoExecuted: number; avgConfidence: number | null }
    | undefined;
  const ownerOverride = useMutation(api.aiDebate.ownerOverride);

  async function onOverride(id: string, decision: string) {
    try {
      await ownerOverride({ debateId: id as never, decision });
    } catch {
      /* سجل فقط */
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* الرأس */}
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
        <Landmark className="h-5 w-5 text-amber-300" />
        <div className="flex-1 text-sm text-amber-100">
          <span className="font-bold">مجلس العقول الدائم</span> — عندما تتعارض وحدتان، يُفتح ملف مناظرة:
          محامٍ يدافع، نقيض يهاجم، سيناتور يحكم. الثقة العالية = تنفيذ آلي.
        </div>
      </div>

      {/* الإحصاءات */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "ملفات", value: stats.total, cls: "text-white" },
            { label: "مفتوحة", value: stats.open, cls: "text-amber-200" },
            { label: "منوطة آلياً", value: stats.autoExecuted, cls: "text-emerald-200" },
            { label: "متوسط الثقة", value: stats.avgConfidence != null ? `${stats.avgConfidence}%` : "—", cls: "text-sky-200" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-black/25 p-2.5">
              <div className={`text-lg font-extrabold ${s.cls}`}>{s.value}</div>
              <div className="text-[10px] text-white/45">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* الملفات */}
      {debates && debates.length > 0 ? (
        debates.map((d) => (
          <div key={d._id} className="rounded-2xl border border-white/12 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white/85">
                <Swords className="h-4 w-4 text-red-300" />
                {d.unitA} <span className="text-white/40">ضد</span> {d.unitB}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  d.status === "open" ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                {d.status === "open" ? "مناظرة جارية" : d.autoExecuted ? "نُفِّذ آلياً" : "بانتظار المالك"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-white/50">النزاع حول: {d.target}</div>

            {/* المواقف */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-sky-500/10 p-2.5 text-[11px] leading-relaxed text-sky-100/85">
                <span className="font-bold">{d.unitA}:</span> {d.stanceA}
              </div>
              <div className="rounded-xl bg-red-500/10 p-2.5 text-[11px] leading-relaxed text-red-100/85">
                <span className="font-bold">{d.unitB}:</span> {d.stanceB}
              </div>
            </div>

            {/* الخطابات */}
            {d.speeches.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {d.speeches.map((s, i) => {
                  const st = ROLE_STYLE[s.role] ?? { icon: "🤖", cls: "border-white/10 bg-white/5" };
                  return (
                    <div key={i} className={`rounded-xl border p-2.5 ${st.cls}`}>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70">
                        <span>{st.icon}</span>
                        {s.speaker}
                        <span className="text-white/30">({s.side === "A" ? d.unitA : s.side === "B" ? d.unitB : "محايد"})</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-white/80">{s.text}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* الحكم */}
            {d.status === "resolved" && d.verdict && (
              <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-200">
                  <Gavel className="h-3.5 w-3.5" />
                  حكم السيناتور — ثقة {d.confidence}%
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-50/90">{d.verdict}</p>
              </div>
            )}

            {/* تجاوز المالك */}
            {d.status === "resolved" && !d.autoExecuted && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onOverride(d._id, `اعتمدت حكم المجلس في نزاع: ${d.target}`)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500"
                >
                  ✓ اعتماد الحكم
                </button>
                <button
                  onClick={() => onOverride(d._id, `رفضت حكم المجلس في نزاع: ${d.target}`)}
                  className="rounded-lg bg-red-600/80 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-500"
                >
                  ✗ رفض الحكم
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
          <Bot className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-2 text-xs text-white/45">
            لا ملفات مناظرة بعد — تُفتح تلقائياً عند تعارض وحدتَي ذكاء
          </p>
        </div>
      )}
    </div>
  );
}
