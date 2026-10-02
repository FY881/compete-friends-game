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
  spot?: string;
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
  axes?: {
    aggression: number;
    curiosity: number;
    commerce: number;
    loyalty: number;
    sociability: number;
    caution: number;
  };
  verdict: string;
  confidence: number;
  contributors: number;
  notesCount: number;
  updatedAt: number;
};

type Lineage = {
  _id: string;
  childName: string;
  parentName: string;
  generation: number;
  post: string;
  createdAt: number;
};

type Corner = { post: string; label: string; emoji: string; count?: number };

type Prediction = {
  _id: string;
  agentName: string;
  post: string;
  subjectName: string;
  predictedLabel: string;
  basis: string;
  status: string;
  actualLabel?: string;
  createdAt: number;
  windowEndsAt: number;
};

type Seer = { name: string; post: string; hits: number; misses: number; accuracy: number };

type Trigger = {
  _id: string;
  subjectName: string;
  fromLabel: string;
  toLabel: string;
  hits: number;
  total: number;
  confidence: number;
  avgLagMs: number;
  trend?: string;
  revisions?: number;
};

type Flow = {
  _id: string;
  fromLabel: string;
  toLabel: string;
  moves: number;
  minds: number;
  weight: number;
};

type Intent = { subject: string; best: Trigger; rules: number };

type Deeper = {
  triggers: Trigger[];
  intents: Intent[];
  flows: Flow[];
  stats: {
    rules: number;
    subjects: number;
    flows: number;
    strongest: number;
    avgConfidence: number;
    revisions: number;
    falling: number;
    rising: number;
  };
};

type Rhythm = {
  _id: string;
  subjectName: string;
  hours: number[];
  samples: number;
  peakHour: number;
  chronotype: string;
  nightShare: number;
};

type Circle = {
  _id: string;
  aName: string;
  bName: string;
  systemLabel: string;
  encounters: number;
  strength: number;
};

type Influence = {
  _id: string;
  name: string;
  leads: number;
  follows: number;
  pull: number;
  topSystemLabel: string;
};

type Society = {
  rhythms: Rhythm[];
  circles: Circle[];
  influence: Influence[];
  stats: {
    rhythms: number;
    circles: number;
    influencers: number;
    nightOwls: number;
    avgPull: number;
  };
};

const CHRONO: Record<string, string> = {
  "ليل": "🌙",
  "صباح": "🌅",
  "نهار": "☀️",
  "مساء": "🌆",
};

const TREND: Record<string, { label: string; cls: string }> = {
  rising: { label: "▲ يثبت", cls: "border-emerald-500/40 text-emerald-300" },
  falling: { label: "▼ يتراجع", cls: "border-rose-500/40 text-rose-300" },
  steady: { label: "＝ ثابت", cls: "border-slate-500/40 text-slate-400" },
};

type Stats = {
  active: number;
  retired: number;
  covered: number;
  totalCorners: number;
  capacity: number;
  intel?: number;
  bonds?: number;
  dossiers?: number;
  predictions?: number;
  hits?: number;
  misses?: number;
  openPredictions?: number;
  accuracy?: number;
};

type Annal = {
  _id: string;
  actorName: string;
  action: string;
  targetName: string;
  detail: string;
  createdAt: number;
};

type Cluster = { trait: string; members: string[] };

const AXIS_LABEL: { key: keyof NonNullable<Dossier["axes"]>; label: string }[] = [
  { key: "aggression", label: "قتال" },
  { key: "curiosity", label: "فضول" },
  { key: "commerce", label: "تجارة" },
  { key: "loyalty", label: "ولاء" },
  { key: "sociability", label: "مجالس" },
  { key: "caution", label: "حذر" },
];

type Data = {
  agents: Agent[];
  notes: Note[];
  intel: Intel[];
  bonds: Bond[];
  dossiers: Dossier[];
  annals: Annal[];
  clusters: Cluster[];
  lineage: Lineage[];
  corners: Corner[];
  stats: Stats;
};

type Watch = {
  agents: Agent[];
  predictions: Prediction[];
  seers: Seer[];
  corners: Corner[];
  method: string[];
  stats: Stats;
};

const ANNAL_LABEL: Record<string, string> = {
  agent_planted: "بذرة",
  agent_born: "تناسل",
  agent_migrated: "ارتحال",
  agent_retired: "انصراف",
  note_written: "بصمة",
};

const CAP_PER_POST = 100; // نفس سعة الخادم بعد توسيع الأُفق
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

const PRED_STYLE: Record<string, string> = {
  open: "border-slate-500/30 bg-slate-900/50 text-slate-300",
  hit: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  miss: "border-rose-500/40 bg-rose-500/5 text-rose-300",
};

const PRED_LABEL: Record<string, string> = {
  open: "بانتظار الواقع",
  hit: "أصاب ✅",
  miss: "أخطأ ✗",
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
  const watch = useQuery(api.aiMindWatch.getMindWatch) as unknown as Watch | undefined;
  const deeper = useQuery(api.aiMindDeeper.getMindDeeper) as unknown as Deeper | undefined;
  const society = useQuery(api.aiMindSociety.getMindSociety) as unknown as Society | undefined;
  const greet = useMutation(api.aiFreeAgents.greetAgent);
  const [msg, setMsg] = useState<string | null>(null);

  const agents: Agent[] = watch?.agents ?? data?.agents ?? [];
  const notes = data?.notes ?? [];
  const intel = data?.intel ?? [];
  const bonds = data?.bonds ?? [];
  const dossiers = data?.dossiers ?? [];
  const annals = data?.annals ?? [];
  const clusters = data?.clusters ?? [];
  const lineage = data?.lineage ?? [];
  const corners: Corner[] = watch?.corners ?? data?.corners ?? [];
  const predictions = watch?.predictions ?? [];
  const seers = watch?.seers ?? [];
  const method = watch?.method ?? [];
  const triggers = deeper?.triggers ?? [];
  const intents = deeper?.intents ?? [];
  const flows = deeper?.flows ?? [];
  const rhythms = society?.rhythms ?? [];
  const circles = society?.circles ?? [];
  const influence = society?.influence ?? [];
  const stats: Stats | undefined = watch?.stats ?? data?.stats;

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
            {stats ? `${stats.active}/${stats.capacity} حرّ · ${stats.retired} انصرف` : "…"}
          </span>
        </div>
        <p className="relative mt-1 text-xs leading-relaxed text-slate-400">
          عقول لا تأتمر بأحد: تُزرع في كل ركن عشوائياً، تفهم عقول اللاعبين من أفعالهم الحقيقية،
          تتناسل وتتشابك، وتجمّع فهمها المشترك — بلا أي تدخّل منك أو من النظام.
        </p>
        {stats && (
          <div className="relative mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <Stat label="أركان مسكونة" value={`${stats.covered}/${stats.totalCorners}`} />
            <Stat label="أحرار أحياء" value={`${stats.active}/${stats.capacity}`} />
            <Stat
              label="دقة التنبؤ"
              value={
                (stats.hits ?? 0) + (stats.misses ?? 0) > 0
                  ? `${Math.round((stats.accuracy ?? 0) * 100)}%`
                  : "…"
              }
            />
            <Stat
              label="نبوءات محسومة"
              value={`${(stats.hits ?? 0) + (stats.misses ?? 0)}`}
            />
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
              const n = c.count ?? here.length;
              return (
                <span
                  key={c.post}
                  title={here.map((a) => a.name).join("، ") || "لم يُزرع أحد هنا بعد"}
                  className={
                    "rounded-full border px-2 py-1 text-[10px] transition-colors " +
                    (n > 0
                      ? "border-slate-400/40 bg-slate-500/10 text-slate-100"
                      : "border-slate-700/40 text-slate-600")
                  }
                >
                  {c.emoji} {c.label}
                  {n > 0 && (
                    <span className="ms-1 text-slate-400">
                      {n}/{CAP_PER_POST}
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
                  {a.spot && (
                    <p className="mt-0.5 text-[10px] text-slate-600">📌 {a.spot} داخل الركن</p>
                  )}
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
            {d.axes && (
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1">
                {AXIS_LABEL.map((ax) => (
                  <div key={ax.key} className="flex items-center gap-1.5">
                    <span className="w-8 shrink-0 text-[9px] text-slate-500">{ax.label}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                      <div
                        className="h-full rounded-full bg-sky-400/70"
                        style={{ width: `${Math.round((d.axes?.[ax.key] ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* عناقيد العقول */}
      {clusters.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">عناقيد العقول — من يشاركون البصمة</h3>
          {clusters.map((c) => (
            <div key={c.trait} className="rounded-xl border border-sky-500/20 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300">
                  {c.trait}
                </span>
                <span className="text-[10px] text-slate-500">{c.members.length} عقل</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{c.members.join(" ، ")}</p>
            </div>
          ))}
        </section>
      )}

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

      {/* شجرة السلالات */}
      {lineage.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">شجرة السلالات — من أنجب من</h3>
          <div className="space-y-2 rounded-xl border border-slate-500/20 bg-black/30 p-3">
            {Object.entries(
              lineage.reduce<Record<string, Lineage[]>>((acc, l) => {
                if (!acc[l.parentName]) acc[l.parentName] = [];
                acc[l.parentName].push(l);
                return acc;
              }, {}),
            ).map(([parent, kids]) => (
              <div key={parent}>
                <p className="text-[11px] font-bold text-slate-200">🕊️ {parent}</p>
                <ul className="mt-1 space-y-0.5 ps-4">
                  {kids.map((k) => (
                    <li key={k._id} className="text-[11px] text-slate-400">
                      ↳ {k.childName}{" "}
                      <span className="text-slate-600">
                        (الجيل {k.generation} · {labelOf(k.post)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* سجل البلوغ */}
      {annals.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">سجل البلوغ — ازدياد الأحرار</h3>
          <div className="rounded-xl border border-slate-500/20 bg-black/30 p-3">
            <ul className="space-y-1.5">
              {annals.map((a) => (
                <li key={a._id} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                  <span className="shrink-0 rounded-full border border-slate-500/30 px-1.5 py-0.5 text-[9px] text-slate-400">
                    {ANNAL_LABEL[a.action] ?? a.action}
                  </span>
                  <span className="min-w-0">{a.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* منهج فهم العقول */}
      {method.length > 0 && (
        <section className="rounded-2xl border border-slate-500/25 bg-slate-900/40 p-3">
          <h3 className="mb-2 text-xs font-bold text-slate-300">
            منهج الفهم — سبع خطوات تُنفّذها النبضة وحدها
          </h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {method.map((m) => (
              <li key={m} className="text-[11px] leading-relaxed text-slate-400">
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            لا أمر من المالك ولا من النظام: الرصد والتنبؤ والمحاسبة تقع كلها على الخادم.
          </p>
        </section>
      )}

      {/* أدقّ العيون */}
      {seers.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">
            أدقّ العيون — من صار فهمه أقرب إلى الواقع
          </h3>
          {seers.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5"
            >
              <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-emerald-200">
                🔭 {s.name}
                <span className="ms-1 font-normal text-slate-500">· {labelOf(s.post)}</span>
              </p>
              <span className="shrink-0 text-[10px] text-slate-400">
                {s.hits} إصابة · {s.misses} خطأ
              </span>
              <span className="shrink-0 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[9px] text-emerald-300">
                {Math.round(s.accuracy * 100)}%
              </span>
            </div>
          ))}
        </section>
      )}

      {/* محرّكات العقل */}
      {triggers.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">
            محرّكات العقل — ما الذي يدفعه لفعل التالي
          </h3>
          <p className="text-[10px] leading-relaxed text-slate-500">
            قواعد مقيسة من تسلسل الأفعال الحقيقي لا من سؤال: «بعد كل مرة في نظام، إلى أين يقصد؟»
            {deeper?.stats ? ` — ${deeper.stats.rules} قاعدة عن ${deeper.stats.subjects} عقل.` : ""}
          </p>
          {intents.map((it) => (
            <div
              key={it.subject}
              className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-bold text-indigo-200">
                  ⚙️ {it.subject}
                </p>
                <span className="shrink-0 text-[10px] text-slate-500">{it.rules} قاعدة</span>
              </div>
              {it.best.trend && (
                <span
                  className={
                    "mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] " +
                    (TREND[it.best.trend]?.cls ?? TREND.steady.cls)
                  }
                >
                  {TREND[it.best.trend]?.label ?? it.best.trend}
                  {(it.best.revisions ?? 0) > 0 ? ` · ${it.best.revisions} مراجعة` : ""}
                </span>
              )}
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                بعد «{it.best.fromLabel}» يقصد «{it.best.toLabel}» في {it.best.hits} من{" "}
                {it.best.total} مرة
                <span className="text-slate-500">
                  {" · "}خلال {Math.round(it.best.avgLagMs / 60000)} دقيقة وسطياً
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-indigo-400/70"
                    style={{ width: `${Math.round(it.best.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500">
                  ثبات {Math.round(it.best.confidence * 100)}%
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* مجتمع العقول: الإيقاع والرفقة والجرّ */}
      {rhythms.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">
            مجتمع العقول — الإيقاع ودوائر الرفقة ومن يجرّ
          </h3>
          {society?.stats && (
            <p className="text-[10px] leading-relaxed text-slate-500">
              {society.stats.rhythms} إيقاع مقيس · {society.stats.circles} دائرة رفقة ·{" "}
              {society.stats.influencers} عقلًا يجذب غيره · {society.stats.nightOwls} عقلًا ليليّ.
            </p>
          )}

          {rhythms.map((r) => {
            const max = Math.max(1, ...r.hours);
            return (
              <div key={r._id} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] font-bold text-violet-200">
                    {CHRONO[r.chronotype] ?? "⏰"} {r.subjectName}
                  </p>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {r.chronotype} · قمّته {r.peakHour}:00 · ليل {Math.round(r.nightShare * 100)}%
                  </span>
                </div>
                <div className="mt-2 flex h-6 items-end gap-px">
                  {r.hours.map((n, i) => (
                    <div
                      key={i}
                      title={`${i}:00 — ${n}`}
                      className={
                        "flex-1 rounded-sm " +
                        (i === r.peakHour ? "bg-violet-300" : "bg-violet-500/50")
                      }
                      style={{ height: `${Math.max(6, Math.round((n / max) * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {circles.map((c) => (
            <div key={c._id} className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-slate-200">
                  👥 {c.aName} <span className="text-teal-300">+</span> {c.bName}
                </p>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {c.encounters} لقاء · {c.systemLabel}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-teal-400/70"
                    style={{ width: `${Math.round(c.strength * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500">
                  تزامن {Math.round(c.strength * 100)}%
                </span>
              </div>
            </div>
          ))}

          {influence.map((n) => (
            <div
              key={n._id}
              className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-2.5"
            >
              <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-orange-200">
                {n.pull >= 0.6 ? "🧲" : "🫱"} {n.name}
                {n.topSystemLabel ? (
                  <span className="ms-1 font-normal text-slate-500">· {n.topSystemLabel}</span>
                ) : null}
              </p>
              <span className="shrink-0 text-[10px] text-slate-400">
                يجرّ {n.leads} · يُجرّ {n.follows}
              </span>
              <span className="shrink-0 rounded-full border border-orange-500/40 px-2 py-0.5 text-[9px] text-orange-300">
                جرّ {Math.round(n.pull * 100)}%
              </span>
            </div>
          ))}
        </section>
      )}

      {/* خريطة جاذبية الأنظمة */}
      {flows.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">
            خريطة جاذبية الأنظمة — إلى أين تُسحب العقول
          </h3>
          <p className="text-[10px] leading-relaxed text-slate-500">
            مجموع مسارات كل العقول الحقيقية: أي منطقة في اللعبة تجذب إليها بعد كل خروج من أخرى
            — أثر أقدام لا رأي أحد.
          </p>
          {flows.map((f) => (
            <div key={f._id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-slate-300">
                  <span className="text-slate-400">{f.fromLabel}</span>{" "}
                  <span className="text-amber-300">→</span>{" "}
                  <span className="font-bold text-slate-100">{f.toLabel}</span>
                </p>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {f.moves} انتقال · {f.minds} عقل
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700/50">
                  <div
                    className="h-full rounded-full bg-amber-400/70"
                    style={{ width: `${Math.round(f.weight * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-500">جذب {Math.round(f.weight * 100)}%</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* سجل النبوءات */}
      {predictions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300">
            سجل النبوءات — هل فهموا العقل فعلاً؟
          </h3>
          {predictions.map((p) => (
            <div
              key={p._id}
              className={"rounded-xl border p-2.5 " + (PRED_STYLE[p.status] ?? PRED_STYLE.open)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-slate-400">
                  <span className="font-bold text-slate-200">{p.agentName}</span> يتوقّع لـ
                  <span className="text-slate-100"> {p.subjectName}</span>
                </p>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px]">
                  {PRED_LABEL[p.status] ?? p.status}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">{p.basis}</p>
              <p className="mt-1 text-[9px] opacity-80">
                🎯 «{p.predictedLabel}»
                {p.actualLabel ? ` · حدث فعلاً: «${p.actualLabel}»` : ""}
                {" · "}
                {ago(p.createdAt)}
              </p>
            </div>
          ))}
        </section>
      )}

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
