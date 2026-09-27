import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

/**
 * 🕊️ الوكلاء الأحرار — الأداة 29
 * عقول مستقلة زُرعت عشوائياً في ركنات اللعبة؛ تراقب بصمت وتكتب ملاحظاتها
 * عن العقول — بلا أوامر من المالك ولا من النظام. ثيم «مرصد الهدوء»:
 * أزرق رصاصي داكن + فضّي، نبرة تأمل لا حكم.
 */

type Agent = {
  _id: Id<"freeAgents">;
  name: string;
  emoji: string;
  role: string;
  post: string;
  persona: string;
  watch: string;
  observations: number;
};

type Note = {
  _id: string;
  agentName: string;
  post: string;
  actorName: string;
  note: string;
  confidence: number;
  createdAt: number;
};

const POST_LABEL: Record<string, string> = {
  home: "بوابة اللعبة",
  duel: "ساحة المبارزات",
  war: "جبهة الحرب",
  store: "المتجر",
  court: "محكمة العدالة",
  compass: "بوصلة العقول",
  meta: "العقل الأعظم",
  grand: "خيمة الخطة الكبرى",
  agents: "غرفة الوكلاء",
};

function ago(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

export function FreeAgents() {
  const data = useQuery(api.aiFreeAgents.getFreeAgents) as
    | { agents: Agent[]; notes: Note[]; retired: number }
    | undefined;
  const greet = useMutation(api.aiFreeAgents.greetAgent);
  const [msg, setMsg] = useState<string | null>(null);

  const agents = data?.agents ?? [];
  const notes = data?.notes ?? [];

  async function onGreet(agentId: Id<"freeAgents">, name: string) {
    try {
      await greet({ agentId });
      setMsg(`🤝 ${name} سجّل لقاءك — سيذكره في دفتره.`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذّر التحية"}`);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl space-y-4">
      {/* الرأس */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-500/30 bg-gradient-to-b from-[#141b26] via-[#0d121b] to-black p-5">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-slate-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">🕊️ الوكلاء الأحرار</h2>
          <span className="rounded-full border border-slate-500/30 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300">
            {agents.length} نشط · {data?.retired ?? 0} انصرف
          </span>
        </div>
        <p className="relative mt-1 text-xs leading-relaxed text-slate-400">
          عقول زُرعت عشوائياً في أركان اللعبة، لا أوامر عليها من أحد. تراقب بصمت، وتكتب ما تراه عن العقول —
          فهمٌ حقيقي يتراكم وحده.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-xs text-slate-200">
          {msg}
        </div>
      )}

      {/* الوكلاء المزروعون */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">الوكلاء في مواقعهم</h3>
        {agents.length === 0 && (
          <p className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-500">
            لم يُزرع وكيل بعد — أول نبضة تزرعهم في أماكن عشوائية.
          </p>
        )}
        {agents.map((a) => (
          <div
            key={a._id}
            className="rounded-xl border border-slate-500/25 bg-slate-900/60 p-3 transition-colors hover:border-slate-400/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-100">
                  {a.emoji} {a.name}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  📍 {POST_LABEL[a.post] ?? a.post} · {a.role}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{a.watch}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-[10px] text-slate-400">
                  {a.observations}/12 ملاحظة
                </span>
                <button
                  onClick={() => onGreet(a._id, a.name)}
                  className="rounded-lg border border-slate-500/40 px-2 py-1 text-[10px] text-slate-200 transition-colors hover:bg-slate-500/20"
                >
                  لوّح له 👋
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* دفتر الملاحظات */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">دفتر الملاحظات المشترك</h3>
        {notes.length === 0 && (
          <p className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-500">
            الدفتر فارغ بعد — الملاحظات تظهر بعد أول نبضة.
          </p>
        )}
        {notes.map((n) => (
          <div key={n._id} className="rounded-xl border border-slate-500/20 bg-black/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-200">
                {n.agentName} <span className="font-normal text-slate-500">· {POST_LABEL[n.post] ?? n.post}</span>
              </p>
              <span className="text-[10px] text-slate-600">{ago(n.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{n.note}</p>
            <p className="mt-1 text-[10px] text-slate-600">ثقة الوكيل: {Math.round(n.confidence * 100)}%</p>
          </div>
        ))}
      </section>
    </div>
  );
}
