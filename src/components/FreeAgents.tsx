import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

/**
 * 🕊️ الوكلاء الأحرار — الأداة 29/30
 * مرصد الأحرار: عقول مستقلة زُرعت عشوائياً في **كل ركن** من أركان اللعبة،
 * تراقب بصمت، تفهم عقول اللاعبين من أفعالهم الحقيقية، تتناسل، وتتشابك،
 * ثم تجمّع فهمها المشترك في ملف لكل عقل — بلا أمر من المالك ولا من النظام.
 * ثيم «مرصد الهدوء»: أزرق رصاصي داكن + فضّي، نبرة تأمل لا حكم.
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

type Intel = {
  _id: string;
  agentName: string;
  post: string;
  subjectName: string;
  kind: string;
  trait: string;
  insight: string;
  strength: number;
  createdAt: number;
};

type Bond = {
  _id: string;
  aName: string;
  bName: string;
  kind: string;
  note: string;
  strength: number;
  createdAt: number;
};

type Dossier = {
  _id: string;
  subjectName: string;
  traits: string[];
  verdict: string;
  confidence: number;
  contributors: number;
  notesCount: number;
  updatedAt: number;
};

type Corner = { post: string; label: string; emoji: string };

type Data = {
  agents: Agent[];
  notes: Note[];
  intel: Intel[];
  bonds: Bond[];
  dossiers: Dossier[];
  corners: Corner[];
  stats: {
    active: number;
    retired: number;
    covered: number;
    totalCorners: number;
    intel: number;
    bonds: number;
    dossiers: number;
  };
};

const CAP_PER_POST = 2;
const LEGACY: Record<string, string> = {
  meta: "العقل الأعظم",
  grand: "الخطة الكبرى",
};

const KIND_STYLE: Record<string, string> = {
  pattern: "border-slate-500/40 text-slate-300",
  fingerprint: "border-sky-500/40 text-sky-300",
  warning: "border-amber-500/40 text-amber-300",
  contact: "border-emerald-500/40 text-emerald-300",
};

const BOND_STYLE: Record<string, string> = {
  alliance: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  rivalry: "border-rose-500/40 bg-rose-500/5 text-rose-300",
  exchange: "border-sky-500/40 bg-sky-500/5 text-sky-300",
};

const BOND_LABEL: Record<string, string> = {
  alliance: "وفاق",
  rivalry: "خلاف",
  exchange: "تبادل",
};

function ago(ts: number): string {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

export function FreeAgents() {
  const data = useQuery(api.aiFreeAgents.getFreeAgents) as unknown as Data | undefined;
  const greet = useMutation(api.aiFreeAgents.greetAgent);
  const [msg, setMsg] = useState<string | null>(null);

  const agents = data?.agents ?? [];
  const notes = data?.notes ?? [];
  const intel = data?.intel ?? [];
  const bonds = data?.bonds ?? [];
  const dossiers = data?.dossiers ?? [];
  const corners = data?.corners ?? [];
  const stats = data?.stats;

  const labelOf = (post: string) => {
    const c = corners.find((x) => x.post === post);
    return c?.label ?? LEGACY[post] ?? post;
  };
  const emojiOf = (post: string) => corners.find((x) => x.post === post)?.emoji ?? "•";
  const perPost = new Map<string, Agent[]>();
  for (const a of agents) {
    const arr = perPost.get(a.post) ?? [];
    arr.push(a);
    perPost.set(a.post, arr);
  }

  async function onGreet(agentId: Id<"freeAgents">, name: string) {
    try {
      await greet({ agentId });
      setMsg(`🤝 ${name} سجّل لقاءك — سيذكره في فهمه.`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "تعذّر التحية"}`);
    }
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-2xl space-y-4">
      {/* الرأس */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-500/30 bg-gradient-to-b from-[#141b26] via-[#0d121b] to-black p-5">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-slate-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-100">🕊️ الوكلاء الأحرار</h2>
          <span className="rounded-full border border-slate-500/30 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300">
            {stats ? `${stats.active} نشط · ${stats.retired} انصرف` : "…"}
          </span>
        </div>
        <p className="relative mt-1 text-xs leading-relaxed text-slate-400">
          عقول لا تأتمر بأحد: تُزرع في كل ركن عشوائياً، تفهم عقول اللاعبين من أفعالهم الحقيقية،
          تتناسل وتتشابك، وتجمّع فهمها المشترك — بلا أي تدخّل منك أو من النظام.
        </p>
        {stats && (
          <div className="relative mt-3 grid grid-cols-4 gap-2 text-center">
            <Stat label="التغطية" value={`${stats.covered}/${stats.totalCorners}`} />
            <Stat label="بصمات عقول" value={String(stats.intel)} />
            <Stat label="علاقات" value={String(stats.bonds)} />
            <Stat label="ملفات فهم" value={String(stats.dossiers)} />
          </div>
        )}
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-500/30 bg-slate-500/10 px-3 py-2 text-xs text-slate-200">
          {msg}
        </div>
      )}

      {/* خريطة التغطية */}
      {corners.length > 0 && (
        <section className="rounded-2xl border border-slate-500/25 bg-slate-900/40 p-3">
          <h3 className="mb-2 text-xs font-bold text-slate-300">أركان اللعبة — أين حلّ الأحرار</h3>
          <div className="flex flex-wrap gap-1.5">
            {corners.map((c) => {
              const here = perPost.get(c.post) ?? [];
              return (
                <span
                  key={c.post}
                  title={here.map((a) => a.name).join("، ") || "لم يُزرع أحد هنا بعد"}
                  className={
                    "rounded-full border px-2 py-1 text-[10px] transition-colors " +
                    (here.length > 0
                      ? "border-slate-400/40 bg-slate-500/10 text-slate-100"
                      : "border-slate-700/40 text-slate-600")
                  }
                >
                  {c.emoji} {c.label}
                  {here.length > 0 && (
                    <span className="ms-1 text-slate-400">
                      {here.length}/{CAP_PER_POST}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* الوكلاء في مواقعهم */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">
          الوكلاء في مواقعهم <span className="font-normal text-slate-500">({agents.length})</span>
        </h3>
        {agents.length === 0 && (
          <p className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-500">
            لم يُزرع وكيل بعد — أول نبضة تزرع البذور الأولى في أركان عشوائية.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
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
                    {emojiOf(a.post)} {labelOf(a.post)} · {a.role}
                  </p>
                </div>
                <button
                  onClick={() => onGreet(a._id, a.name)}
                  className="shrink-0 rounded-lg border border-slate-500/40 px-2 py-1 text-[10px] text-slate-200 transition-colors hover:bg-slate-500/20"
                >
                  لوّح له 👋
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{a.persona}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-slate-400/70"
                    style={{ width: `${Math.min(100, (a.observations / 24) * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500">{a.observations}/24 ملاحظة</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ملفات الفهم المشترك */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">ملفات فهم العقول — الفهم المشترك</h3>
        {dossiers.length === 0 && (
          <p className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-500">
            لا ملفات بعد — تظهر بعد أن تتراكم بصمات عدة وكلاء عن العقل نفسه.
          </p>
        )}
        {dossiers.map((d) => (
          <div key={d._id} className="rounded-xl border border-sky-500/20 bg-[#0b1220] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-100">🧠 {d.subjectName}</p>
              <span className="text-[10px] text-slate-500">
                {d.contributors} وكيل · {d.notesCount} بصمة
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {d.traits.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{d.verdict}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                <div
                  className="h-full rounded-full bg-sky-400/70"
                  style={{ width: `${Math.round(d.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-500">ثقة {Math.round(d.confidence * 100)}%</span>
            </div>
          </div>
        ))}
      </section>

      {/* شبكة العلاقات */}
      {bonds.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">شبكة الأحرار — وفاق وخلاف</h3>
          {bonds.map((b) => (
            <div
              key={b._id}
              className={"rounded-xl border p-2.5 " + (BOND_STYLE[b.kind] ?? BOND_STYLE.exchange)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold">
                  {b.aName} <span className="opacity-60">↔</span> {b.bName}
                </p>
                <span className="rounded-full border px-2 py-0.5 text-[9px]">
                  {BOND_LABEL[b.kind] ?? b.kind}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">{b.note}</p>
            </div>
          ))}
        </section>
      )}

      {/* بصمات العقول */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">بصمات العقول — آخر ما استُخلص</h3>
        {intel.length === 0 && (
          <p className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-500">
            لا بصمات بعد — تُصاغ من أفعال اللاعبين الحقيقية في النبضة القادمة.
          </p>
        )}
        {intel.map((it) => (
          <div key={it._id} className="rounded-xl border border-slate-500/20 bg-black/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                <span className="font-bold text-slate-200">{it.agentName}</span> يقرأ{" "}
                <span className="text-slate-100">{it.subjectName}</span>
              </p>
              <span
                className={
                  "rounded-full border px-2 py-0.5 text-[9px] " +
                  (KIND_STYLE[it.kind] ?? KIND_STYLE.pattern)
                }
              >
                {it.trait}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{it.insight}</p>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-600">
              <span>
                {emojiOf(it.post)} {labelOf(it.post)}
              </span>
              <span>
                {ago(it.createdAt)} · قوة {Math.round(it.strength * 100)}%
              </span>
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
          <div key={n._id} className="rounded-xl border border-slate-500/20 bg-black/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-200">
                {n.agentName} <span className="font-normal text-slate-500">· {labelOf(n.post)}</span>
              </p>
              <span className="text-[10px] text-slate-600">{ago(n.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{n.note}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-500/20 bg-black/30 px-2 py-1.5">
      <p className="text-sm font-bold text-slate-100">{value}</p>
      <p className="text-[9px] text-slate-500">{label}</p>
    </div>
  );
}
