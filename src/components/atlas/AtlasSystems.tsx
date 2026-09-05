import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Radar, Users, KeyRound, BookOpen, MessagesSquare, Flag, BrainCircuit,
  Store, BarChart3, ShieldAlert, Search, AlertTriangle, Activity, Crown,
  Download, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ATLAS_COLORS, ATLAS_SEVERITY, atlasCompact, atlasTime, atlasMinutes,
} from "@/lib/atlas-design";
import type { Id } from "@/convex/_generated/dataModel";
import { StatCard, Panel, SeverityDot, Loading, useRunner } from "./AtlasShared";

/** أنظمة أطلس كنترول العشرة — كل ميزة مربوطة بدالة خادم حقيقية. */

export const SYSTEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  control: Radar, players: Users, memberships: KeyRound, content: BookOpen,
  rooms: MessagesSquare, reports: Flag, ai: BrainCircuit, economy: Store,
  analytics: BarChart3, emergency: ShieldAlert,
};

const TIERS: Record<string, { name: string; color: string }> = {
  bronze: { name: "برونزية", color: "#d97706" },
  silver: { name: "فضية", color: "#94a3b8" },
  gold: { name: "ذهبية", color: "#d4af37" },
  diamond: { name: "ماسية", color: "#38bdf8" },
  exclusive: { name: "حصرية", color: "#a855f7" },
};

type TierId = "bronze" | "silver" | "gold" | "diamond" | "exclusive";

/* ═══════════════════ 1) السيطرة المركزية الحية ═══════════════════ */

export function ControlSystem({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const overview = useQuery(api.atlas.getOverview, {});
  if (overview === undefined) return <Loading />;
  if (overview === null) {
    return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
      لا صلاحية — أعد الدخول من بوابة أطلس.
    </div>;
  }
  const t = overview.totals;
  return (
    <div className="space-y-5">
      {overview.maintenance.active && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <AlertTriangle className="size-5 shrink-0 text-rose-400" />
          <div className="text-sm">
            <span className="font-bold text-rose-300">وضع الصيانة مفعّل الآن</span>
            <span className="text-rose-200/80"> — {overview.maintenance.message}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="الحسابات" value={atlasCompact(t.users)} accent={ATLAS_COLORS.royal} sub={`${t.admins} مشرف`} />
        <StatCard label="جولات حية الآن" value={t.liveGames} accent={ATLAS_COLORS.emerald} sub={`${t.waitingGames} في الانتظار`} />
        <StatCard label="الرسائل / ساعة" value={atlasCompact(t.messagesLastHour)} accent={ATLAS_COLORS.cyan} sub={`${atlasCompact(t.messagesLast24h)} في 24 س`} />
        <StatCard label="بلاغات مفتوحة" value={t.openReports} accent={ATLAS_COLORS.crimson} sub={`${t.banned} محظور · ${t.muted} مكتوم`} />
        <StatCard label="إجمالي الخبرة" value={atlasCompact(t.totalXp)} accent={ATLAS_COLORS.gold} sub={`${atlasCompact(t.totalGames)} جولة لُعبت`} />
        <StatCard label="الغرف" value={t.rooms} accent={ATLAS_COLORS.amber} sub={`${t.memberships} عضوية نشطة`} />
        <StatCard label="بنك الأسئلة" value={atlasCompact(t.questions)} accent={ATLAS_COLORS.royal} sub={`${t.storeItems} عنصر متجر`} />
        <StatCard label="أخطاء حرجة" value={t.criticalErrors} accent={ATLAS_COLORS.crimson} sub={`${t.unresolvedErrors} غير معالج`} />
        <StatCard label="جولات اليوم" value={t.finishedToday} accent={ATLAS_COLORS.emerald} />
        <StatCard label="الملفات" value={t.profiles} accent={ATLAS_COLORS.slate} />
        <StatCard label="إصدار اللعبة" value={overview.release.version} accent={ATLAS_COLORS.gold} sub={`بناء ${overview.release.build}`} />
        <StatCard label="ميزات أطلس" value={overview.featureCount} accent={ATLAS_COLORS.royal} sub={`${overview.systems.length} أنظمة`} />
      </div>
      <button
        onClick={onOpenPlayer}
        className="w-full rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 text-start transition-colors hover:bg-slate-800/60"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <Search className="size-4 text-cyan-400" />
          الكاميرا الذكية — افتح ملف أي لاعب فوراً (c2)
        </div>
        <p className="mt-1 text-xs text-slate-400">من نظام اللاعبين: بحث فوري ← ملف شامل ← إجراءات مباشرة.</p>
      </button>
    </div>
  );
}

/* ═══════════════════ 2) اللاعبون ═══════════════════ */

export function PlayersSystem() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Id<"users"> | null>(null);
  const [reason, setReason] = useState("");
  const { busy, run } = useRunner();

  const players = useQuery(api.atlas.searchPlayers, { q: q.trim() || undefined, limit: 60 });
  const file = useQuery(api.atlas.getPlayerFile, selected ? { userId: selected } : "skip");

  const punish = useMutation(api.atlas.atlasPunish);
  const pardon = useMutation(api.atlas.atlasPardon);
  const editPlayer = useMutation(api.atlas.atlasEditPlayer);
  const resetProgress = useMutation(api.atlas.atlasResetProgress);
  const broadcast = useMutation(api.atlas.atlasBroadcast);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel
        title="سجل اللاعبين + البحث الفوري (p1/p2)"
        icon={Users}
        accent={ATLAS_COLORS.cyan}
        action={<Badge variant="secondary">{players?.length ?? 0}</Badge>}
      >
        <Input
          dir="rtl" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو البريد…"
          className="mb-3 border-slate-700 bg-slate-900/60 text-slate-100"
        />
        <div className="max-h-[460px] space-y-2 overflow-y-auto pl-1">
          {players === undefined && <Loading />}
          {players?.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelected(p._id)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-start transition-colors ${
                selected === p._id
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/50"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-100">{p.name}</div>
                <div className="truncate text-[11px] text-slate-500">{p.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {p.role === "admin" && <Badge className="bg-amber-500/15 text-amber-300">مشرف</Badge>}
                {p.banned && <Badge className="bg-rose-500/15 text-rose-300">محظور</Badge>}
                {p.muted && <Badge className="bg-orange-500/15 text-orange-300">مكتوم</Badge>}
                {p.warnings > 0 && <Badge variant="secondary">⚠ {p.warnings}</Badge>}
              </div>
            </button>
          ))}
          {players?.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا نتائج</div>}
        </div>
      </Panel>

      <Panel title="الملف الشامل — الكاميرا الذكية (p3)" icon={Activity} accent={ATLAS_COLORS.gold}>
        {!selected && <div className="py-10 text-center text-sm text-slate-500">اختر لاعباً من القائمة</div>}
        {selected && file === undefined && <Loading />}
        {file && (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-black text-slate-100">{file.user.name}</div>
              <div className="text-xs text-slate-500">{file.user.email}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {file.user.role === "admin" && <Badge className="bg-amber-500/15 text-amber-300">مشرف</Badge>}
                {file.user.bannedPermanent && <Badge className="bg-rose-500/20 text-rose-300">حظر دائم</Badge>}
                {file.user.mutedUntil > Date.now() && (
                  <Badge className="bg-orange-500/15 text-orange-300">مكتوم حتى {atlasTime(file.user.mutedUntil)}</Badge>
                )}
                {file.membership && (
                  <Badge style={{
                    background: `${TIERS[file.membership.tier]?.color ?? "#888"}22`,
                    color: TIERS[file.membership.tier]?.color ?? "#ccc",
                  }}>
                    {TIERS[file.membership.tier]?.name ?? file.membership.tier}
                  </Badge>
                )}
              </div>
            </div>

            {file.profile && (
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="الخبرة" value={atlasCompact(file.profile.xp)} accent={ATLAS_COLORS.gold} />
                <StatCard label="جولات" value={file.profile.gamesPlayed} accent={ATLAS_COLORS.royal} sub={`فاز ${file.profile.gamesWon}`} />
                <StatCard label="أفضل نتيجة" value={file.profile.bestScore} accent={ATLAS_COLORS.emerald} />
              </div>
            )}

            <Input
              dir="rtl" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="سبب العقوبة (يُوثَّق في السجل)…"
              className="border-slate-700 bg-slate-900/60 text-slate-100"
            />

            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(() => punish({ userId: selected!, action: "warn", reason }), "تم إرسال تحذير")}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                ⚠ تحذير
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(() => punish({ userId: selected!, action: "mute", reason, durationHours: 1 }), "تم الكتم ساعة")}
                className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10">
                🔇 كتم 1س
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(() => punish({ userId: selected!, action: "ban_temp", reason, durationHours: 24 }), "تم الحظر 24س")}
                className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                🔒 حظر 24س
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(() => punish({ userId: selected!, action: "ban_perm", reason }), "حظر دائم")}
                className="border-rose-600/50 text-rose-300 hover:bg-rose-600/10">
                ⛔ حظر دائم
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(() => pardon({ userId: selected! }), "تم رفع كل العقوبات")}
                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                🕊 عفو
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void run(
                  () => editPlayer({ userId: selected!, role: file.user.role === "admin" ? "user" : "admin" }),
                  "تم تغيير الدور",
                )}
                className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10">
                {file.user.role === "admin" ? "↓ إلغاء الإشراف" : "↑ ترقية مشرف"}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} className="flex-1 border-slate-700 text-slate-300"
                onClick={() => void run(() => resetProgress({ userId: selected! }), "تم تصفير التقدم (مع نسخة احتياطية)")}>
                ♻️ تصفير التقدم
              </Button>
              <Button size="sm" variant="outline" disabled={busy} className="flex-1 border-slate-700 text-slate-300"
                onClick={() => void run(
                  () => broadcast({
                    title: "رسالة من الإدارة",
                    body: `رسالة موجهة من أطلس كنترول إلى ${file.user.name}`,
                    type: "info",
                    targetUserId: selected!,
                  }),
                  "تم إرسال الرسالة",
                )}>
                📨 رسالة موجهة
              </Button>
            </div>

            {file.recentGames.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-400">آخر الجولات</div>
                <div className="space-y-1">
                  {file.recentGames.slice(0, 5).map((g, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-1.5 text-[12px] text-slate-300">
                      <span>{g.correct}/{g.total} صحيحة</span>
                      <span className="tabular-nums">{g.score} نقطة</span>
                      <span className="text-slate-500">{atlasMinutes(Date.now() - g.playedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ═══════════════════ 3) العضويات والأكواد ═══════════════════ */

export function MembershipsSystem() {
  const data = useQuery(api.atlas.membershipAdminData, {});
  const grant = useMutation(api.atlas.atlasGrantMembership);
  const revoke = useMutation(api.atlas.atlasRevokeMembership);
  const createCode = useMutation(api.atlas.atlasCreateCode);
  const deleteCode = useMutation(api.atlas.atlasDeleteCode);
  const { busy, run } = useRunner();

  const [tier, setTier] = useState<TierId>("gold");
  const [maxUses, setMaxUses] = useState(10);

  // منح مباشر
  const [gq, setGq] = useState("");
  const [target, setTarget] = useState<{ _id: Id<"users">; name: string } | null>(null);
  const [gTier, setGTier] = useState<TierId>("gold");
  const results = useQuery(api.atlas.searchPlayers, gq.trim().length >= 2 ? { q: gq, limit: 6 } : "skip");

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {data.tiers.map((t) => (
          <StatCard key={t.id} label={t.name} value={t.count} accent={TIERS[t.id]?.color ?? "#888"} sub={`${data.total} إجمالي`} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="مصنع الأكواد (m2/m3)" icon={KeyRound} accent={ATLAS_COLORS.royal}>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TIERS) as Array<[string, { name: string; color: string }]>).map(([id, t]) => (
              <button
                key={id}
                onClick={() => setTier(id as TierId)}
                className="rounded-xl border px-3.5 py-2 text-sm font-bold transition-all"
                style={{
                  background: tier === id ? `${t.color}22` : "rgba(15,20,40,0.5)",
                  borderColor: tier === id ? t.color : "rgba(148,163,184,0.2)",
                  color: tier === id ? t.color : "#94a3b8",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400">عدد الاستخدامات:</label>
            <Input
              type="number" min={1} value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 border-slate-700 bg-slate-900/60 text-slate-100"
            />
            <Button disabled={busy}
              onClick={() => void run(async () => {
                const r = await createCode({ tier, maxUses });
                toast.success(`تم إنشاء الكود: ${r.code}`);
              }, "")}
              className="gap-1.5 font-bold">
              توليد كود
            </Button>
          </div>
          <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
            {data.codes.map((c) => (
              <div key={c._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold" style={{ color: TIERS[c.tier]?.color }}>{c.code}</div>
                  <div className="text-[11px] text-slate-500">
                    {TIERS[c.tier]?.name} · {c.usedCount}/{c.maxUses === 0 ? "∞" : c.maxUses} استُخدم
                    {c.durationDays ? ` · ${c.durationDays} يوم` : ""}
                  </div>
                </div>
                {c.active ? (
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => void run(() => deleteCode({ codeId: c._id }), "تم تعطيل الكود")}
                    className="border-rose-500/40 text-[11px] text-rose-300">تعطيل</Button>
                ) : (
                  <Badge variant="secondary">معطّل</Badge>
                )}
              </div>
            ))}
            {data.codes.length === 0 && <div className="py-6 text-center text-sm text-slate-500">لا أكواد بعد — ولّد أول كود</div>}
          </div>
        </Panel>

        <Panel title="المستفيدون الحاليون (m8)" icon={Crown} accent={ATLAS_COLORS.gold}
          action={<Badge variant="secondary">{data.holders.length}</Badge>}>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.holders.map((h) => (
              <div key={h.userId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100">{h.name}</div>
                  <div className="text-[11px] text-slate-500">
                    تنتهي: {h.expiresAt ? atlasTime(h.expiresAt) : "دائمة"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge style={{ background: `${TIERS[h.tier]?.color}22`, color: TIERS[h.tier]?.color }}>
                    {TIERS[h.tier]?.name}
                  </Badge>
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => void run(() => revoke({ userId: h.userId }), "تم سحب العضوية")}
                    className="border-rose-500/40 text-[11px] text-rose-300">سحب</Button>
                </div>
              </div>
            ))}
            {data.holders.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا مستفيدين بعد</div>}
          </div>
        </Panel>
      </div>

      <Panel title="منح مباشر لأي لاعب دون كود (m4/m5)" icon={Users} accent={ATLAS_COLORS.emerald}>
        <div className="space-y-2">
          {!target && (
            <Input
              dir="rtl" value={gq} onChange={(e) => setGq(e.target.value)}
              placeholder="ابحث عن اللاعب لمنحه عضوية…"
              className="border-slate-700 bg-slate-900/60 text-slate-100"
            />
          )}
          {!target && results && results.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {results.map((p) => (
                <button key={p._id}
                  onClick={() => { setTarget({ _id: p._id, name: p.name }); setGq(""); }}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-[12px] text-slate-200 hover:border-emerald-500/50">
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {target && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-300">اللاعب: {target.name}</Badge>
              <select
                value={gTier}
                onChange={(e) => setGTier(e.target.value as TierId)}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-sm text-slate-100"
              >
                {(Object.entries(TIERS) as Array<[string, { name: string }]>).map(([id, t]) => (
                  <option key={id} value={id}>{t.name}</option>
                ))}
              </select>
              <Button size="sm" disabled={busy}
                onClick={() => void run(
                  () => grant({ userId: target._id, tier: gTier }),
                  `تم منح العضوية ${TIERS[gTier].name}`,
                )}
                className="bg-emerald-600 hover:bg-emerald-500">منح الآن</Button>
              <Button size="sm" variant="ghost" onClick={() => setTarget(null)} className="text-slate-400">إلغاء</Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════ 4) المحتوى والأسئلة ═══════════════════ */

export function ContentSystem() {
  const data = useQuery(api.atlas.contentAdminData, {});
  const toggleQ = useMutation(api.atlas.atlasToggleQuestion);
  const { busy, run } = useRunner();

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;
  const maxCat = Math.max(1, ...Object.values(data.byCategory));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="إجمالي الأسئلة" value={atlasCompact(data.total)} accent={ATLAS_COLORS.royal} />
        <StatCard label="التصنيفات" value={Object.keys(data.byCategory).length} accent={ATLAS_COLORS.emerald} />
        <StatCard label="معطّلة" value={data.disabledCount} accent={ATLAS_COLORS.crimson} />
        <StatCard label="أعلام جودة" value={data.qualityFlags.length} accent={ATLAS_COLORS.amber} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="توزيع التصنيفات والصعوبة (q2/q6/q8)" icon={BookOpen} accent={ATLAS_COLORS.emerald}>
          <div className="space-y-2">
            {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
              <div key={cat}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-300">{cat}</span>
                  <span className="tabular-nums text-slate-500">{n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(n / maxCat) * 100}%`, background: `linear-gradient(90deg, ${ATLAS_COLORS.royal}, ${ATLAS_COLORS.cyan})` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Object.entries(data.byDifficulty).map(([d, n]) => (
              <StatCard key={d} label={d} value={n} accent={ATLAS_COLORS.slate} />
            ))}
          </div>
        </Panel>

        <Panel title="مراقبة الجودة + سحب الأسئلة (q3/q4/q7)" icon={AlertTriangle} accent={ATLAS_COLORS.amber}>
          {data.qualityFlags.length === 0 ? (
            <div className="py-8 text-center text-sm text-emerald-400">✅ لا مشاكل جودة — البنك نظيف</div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {data.qualityFlags.map((f) => (
                <div key={f.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[13px] text-slate-200">{f.question}</div>
                  <div className="mt-1 text-[11px] text-amber-400">{f.reason}</div>
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => void run(() => toggleQ({ questionId: f.id, disabled: true }), "سُحب السؤال من التداول")}
                    className="mt-2 border-rose-500/40 text-[11px] text-rose-300">سحب من التداول</Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 5) الغرف والقوانين ═══════════════════ */

export function RoomsSystem() {
  const data = useQuery(api.atlas.roomsAdminData, {});
  const seedRules = useMutation(api.lawEnforcement.seedRules);
  const think = useMutation(api.atlas.atlasThink);
  const { busy, run } = useRunner();

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;
  const maxMsgs = Math.max(1, ...data.rooms.map((r) => r.messages));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="الغرف" value={data.rooms.length} accent={ATLAS_COLORS.amber} />
        <StatCard label="كل الرسائل" value={atlasCompact(data.totalMessages)} accent={ATLAS_COLORS.cyan} />
        <StatCard label="رسائل 24س" value={atlasCompact(data.messagesLast24h)} accent={ATLAS_COLORS.emerald} />
        <StatCard label="بلاغات مفتوحة" value={data.reports.open} accent={ATLAS_COLORS.crimson} sub={`${data.reports.resolved} محسومة`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="خريطة الغرف + نبض الرسائل (r1/r2)" icon={MessagesSquare} accent={ATLAS_COLORS.amber}>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {data.rooms.map((r) => (
              <div key={r._id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-bold text-slate-100">{r.name}</div>
                  {r.archived && <Badge variant="secondary">مؤرشفة</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>👥 {r.members}</span>
                  <span>💬 {r.messages}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${(r.messages / maxMsgs) * 100}%`, background: ATLAS_COLORS.amber }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="المنظومة القانونية (r3/r4/r7/r8)" icon={ShieldAlert} accent={ATLAS_COLORS.royal}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(() => seedRules({}), "أُعيدت زراعة القوانين الثلاثين")}
              className="gap-1.5">زرع القوانين</Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void run(() => think({ prompt: "فكّر في حالة المجتمع" }), "أطلس حلّل المجتمع — انظر الأنظمة الحرة")}
              className="border-violet-500/40 text-violet-300">تحليل مجتمعي</Button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {data.rules.map((r) => (
              <div key={r._id} className="flex items-center gap-2 rounded-lg bg-slate-900/40 px-3 py-2 text-[12px]">
                <SeverityDot sev={r.severity} />
                <span className="flex-1 truncate text-slate-300">{r.title}</span>
                <span className={`size-2 shrink-0 rounded-full ${r.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 6) البلاغات الذكية ═══════════════════ */

export function ReportsSystem() {
  const data = useQuery(api.atlas.reportsAdminData, {});
  const resolve = useMutation(api.atlas.atlasResolveReport);
  const think = useMutation(api.atlas.atlasThink);
  const { busy, run } = useRunner();

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;
  const maxReason = Math.max(1, ...Object.values(data.stats.byReason));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="مفتوحة" value={data.stats.open} accent={ATLAS_COLORS.crimson} />
        <StatCard label="عالية الخطورة" value={data.stats.highSeverityOpen} accent={ATLAS_SEVERITY.purple.color} />
        <StatCard label="محسومة" value={data.stats.resolved} accent={ATLAS_COLORS.emerald} />
        <StatCard label="مرفوضة" value={data.stats.dismissed} accent={ATLAS_COLORS.slate} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="صندوق البلاغات الحي (a1/a2/a4/a7)"
          icon={Flag}
          accent={ATLAS_COLORS.crimson}
          action={
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => void run(() => think({ prompt: "حلّل البلاغات" }), "أطلس حلّل البلاغات")}
              className="border-violet-500/40 text-[11px] text-violet-300">تحليل ذكي</Button>
          }
        >
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {data.open.length === 0 && <div className="py-8 text-center text-sm text-emerald-400">لا بلاغات مفتوحة</div>}
            {data.open.map((r) => (
              <div key={r._id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-100">{r.reason}</div>
                    {r.details && <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{r.details}</div>}
                    <div className="mt-1 text-[10px] text-slate-500">
                      {r.reporterName} ← {r.targetName} · {atlasMinutes(Date.now() - r.createdAt)}
                    </div>
                  </div>
                  {r.aiVerdict && <SeverityDot sev={r.aiVerdict.severity} />}
                </div>
                {r.aiVerdict && (
                  <div className="mt-2 rounded-lg bg-violet-500/10 p-2 text-[11px] text-violet-200">
                    حكم الذكاء: {r.aiVerdict.severity === "high" ? "خطورة عالية" : r.aiVerdict.severity === "medium" ? "متوسطة" : "منخفضة"}
                    {r.aiVerdict.suggestedAction ? ` — إجراء مقترح: ${r.aiVerdict.suggestedAction}` : ""}
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" disabled={busy}
                    onClick={() => void run(() => resolve({ reportId: r._id, approved: true }), "تم اعتماد البلاغ")}
                    className="h-7 flex-1 bg-emerald-600 text-[11px] hover:bg-emerald-500">اعتماد + إجراء</Button>
                  <Button size="sm" disabled={busy}
                    onClick={() => void run(() => resolve({ reportId: r._id, approved: false }), "تم رفض البلاغ")}
                    className="h-7 flex-1 bg-slate-700 text-[11px] hover:bg-slate-600">رفض</Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="اتجاهات البلاغات — أكثر الأسباب (a6)" icon={BarChart3} accent={ATLAS_COLORS.amber}>
          <div className="space-y-2">
            {Object.entries(data.stats.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, n]) => (
              <div key={reason}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate text-slate-300">{reason}</span>
                  <span className="tabular-nums text-slate-500">{n}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${(n / maxReason) * 100}%`, background: `linear-gradient(90deg, ${ATLAS_COLORS.crimson}, ${ATLAS_COLORS.amber})` }} />
                </div>
              </div>
            ))}
            {Object.keys(data.stats.byReason).length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">لا بيانات بعد</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 7) الذكاء الاصطناعي ═══════════════════ */

export function AiSystem() {
  const data = useQuery(api.atlas.aiAdminData, {});
  const setAi = useMutation(api.atlas.atlasSetAiControl);
  const think = useMutation(api.atlas.atlasThink);
  const { busy, run } = useRunner();

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;

  const switches = [
    { key: "aiEnabled" as const, label: "المفتاح الرئيسي للذكاء (l1)", desc: "شغّل أو أوقف كل الأنظمة الذكية في اللعبة", on: data.aiEnabled },
    { key: "aiAutoApply" as const, label: "التطبيق التلقائي (l4)", desc: "تنفيذ قرارات الذكاء فوراً دون مراجعة", on: data.aiAutoApply },
    { key: "aiAdminEnabled" as const, label: "الإدارة الآلية (l5)", desc: "المسح الدوري الشامل بلا تدخل بشري", on: data.aiAdminEnabled },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {switches.map((s) => (
          <div key={s.key} className="rounded-2xl border p-4"
            style={{
              background: "var(--atlas-panel)",
              borderColor: s.on ? "rgba(139,92,246,0.4)" : "rgba(148,163,184,0.14)",
            }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-100">{s.label}</span>
              <button
                onClick={() => void run(() => setAi({ [s.key]: !s.on }), s.on ? "تم الإيقاف" : "تم التشغيل")}
                disabled={busy}
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{ background: s.on ? ATLAS_COLORS.royal : "#334155" }}
                aria-label={s.label}
              >
                <span className="absolute top-0.5 size-5 rounded-full bg-white transition-all" style={{ right: s.on ? 2 : 22 }} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy}
          onClick={() => void run(() => think({}), "أطلس فكّر في اللعبة — النتائج في قسم الأنظمة الحرة")}
          className="gap-1.5 font-bold">
          <BrainCircuit className="size-4" /> طلب تفكير شامل الآن (l2)
        </Button>
        <Badge variant="secondary" className="self-center">النموذج: {data.aiModel}</Badge>
      </div>

      <Panel title="سجل نشاط الذكاء — شفافية كاملة (l3/l6/l7)" icon={Activity} accent={ATLAS_COLORS.royal}>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {data.logs.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا نشاط بعد</div>}
          {data.logs.map((l) => (
            <div key={l._id} className="flex items-start gap-2 rounded-lg bg-slate-900/40 px-3 py-2 text-[12px]">
              <SeverityDot sev={l.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-slate-200">{l.message}</div>
                <div className="text-[10px] text-slate-500">
                  {l.subsystem} · {l.action}{l.auto ? " · تلقائي" : ""} · {atlasMinutes(Date.now() - l.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════ 8) الاقتصاد والمتجر ═══════════════════ */

export function EconomySystem() {
  const data = useQuery(api.atlas.economyAdminData, {});
  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="عناصر المتجر" value={data.store.items} accent={ATLAS_COLORS.amber}
          sub={`${data.store.sections} أقسام · ${data.store.bundles} حزم`} />
        <StatCard label="عملات اللاعبين" value={atlasCompact(data.currency.coins)} accent={ATLAS_COLORS.gold}
          sub={`متوسط ${atlasCompact(data.currency.avgCoins)}/لاعب`} />
        <StatCard label="هدايا مرسلة" value={data.gifts.total} accent={ATLAS_COLORS.royal}
          sub={`${data.gifts.unclaimed} غير مستلمة`} />
        <StatCard label="هدايا 7 أيام" value={data.gifts.last7d} accent={ATLAS_COLORS.emerald} sub="مؤشر النشاط (e7)" />
      </div>
      <Panel title={`كتالوج المتجر — ${data.store.sectionsList.join(" · ")} (e4/e8)`} icon={Store} accent={ATLAS_COLORS.amber}>
        <div className="grid gap-2 md:grid-cols-2">
          {data.itemsPreview.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
              <span className="text-[13px] text-slate-200">{i.name}</span>
              <Badge variant="secondary">{i.price} 🪙</Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════ 9) الإحصائيات والتحليلات ═══════════════════ */

export function AnalyticsSystem() {
  const data = useQuery(api.atlas.analyticsData, {});
  const exportReport = useQuery(api.atlas.exportFullReport, {});

  const doExport = () => {
    if (!exportReport) { toast.info("جارٍ تجهيز التقرير — حاول ثانية"); return; }
    const blob = new Blob([JSON.stringify(exportReport, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `atlas-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("تم تنزيل التقرير التنفيذي (JSON)");
  };

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;

  const max = Math.max(1, ...data.finished7d);
  const days = ["-6", "-5", "-4", "-3", "-2", "أمس", "اليوم"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="جولات منتهية" value={atlasCompact(data.totals.finished)} accent={ATLAS_COLORS.emerald} sub={`من ${atlasCompact(data.totals.games)}`} />
        <StatCard label="دقة الإجابات" value={`${data.totals.avgAccuracy}%`} accent={ATLAS_COLORS.cyan} sub={`${atlasCompact(data.totals.answers)} إجابة`} />
        <StatCard label="التشبّث (3+ جولات)" value={`${data.totals.retention}%`} accent={ATLAS_COLORS.gold} sub="مؤشر الاستبقاء (s7)" />
        <StatCard label="حسابات" value={atlasCompact(data.totals.users)} accent={ATLAS_COLORS.royal} sub={`${atlasCompact(data.totals.rounds)} جولة مسجلة`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="نشاط 7 أيام (s5)" icon={BarChart3} accent={ATLAS_COLORS.cyan}>
          <div className="flex h-44 items-end gap-2">
            {data.finished7d.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-slate-400">{v}</span>
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${Math.max(4, (v / max) * 130)}px`, background: `linear-gradient(180deg, ${ATLAS_COLORS.cyan}, ${ATLAS_COLORS.royal}44)` }} />
                <span className="text-[9px] text-slate-500">{days[i]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="أبطال الساحة — أعلى 10 (s6)" icon={Crown} accent={ATLAS_COLORS.gold}>
          <div className="space-y-1.5">
            {data.topPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-900/40 px-3 py-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{
                    background: i === 0 ? `${ATLAS_COLORS.gold}33` : "rgba(148,163,184,0.1)",
                    color: i === 0 ? ATLAS_COLORS.goldBright : "#94a3b8",
                  }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{p.name}</span>
                <span className="tabular-nums text-[12px] font-bold" style={{ color: ATLAS_COLORS.goldBright }}>
                  {atlasCompact(p.xp)} XP
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Button onClick={doExport} className="gap-1.5 font-bold">
        <Download className="size-4" /> تصدير التقرير التنفيذي (JSON) — s3/s8
      </Button>
    </div>
  );
}

/* ═══════════════════ 10) الطوارئ والصيانة ═══════════════════ */

export function EmergencySystem() {
  const data = useQuery(api.atlas.emergencyAdminData, {});
  const setMaintenance = useMutation(api.atlas.atlasSetMaintenance);
  const broadcast = useMutation(api.atlas.atlasBroadcast);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "warning" | "ban" | "update" | "system">("warning");
  const { busy, run } = useRunner();

  if (data === undefined) return <Loading />;
  if (data === null) return <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">لا صلاحية.</div>;

  const totalErrors = Object.values(data.bySeverity).reduce((s, n) => s + n, 0);
  const typeLabels = { info: "معلومة", warning: "تحذير", ban: "عقوبات", update: "تحديث", system: "نظام" } as const;
  const typeColors: Record<string, string> = {
    info: ATLAS_SEVERITY.info.color, warning: ATLAS_COLORS.amber, ban: ATLAS_COLORS.crimson,
    update: ATLAS_COLORS.cyan, system: ATLAS_COLORS.royal,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border p-5" style={{
        background: "var(--atlas-panel)",
        borderColor: data.maintenance.active ? "rgba(244,63,94,0.5)" : "rgba(148,163,184,0.14)",
      }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <ShieldAlert className="size-5" style={{ color: data.maintenance.active ? ATLAS_COLORS.crimson : ATLAS_COLORS.emerald }} />
              وضع الصيانة: {data.maintenance.active ? "مفعّل ⛔" : "غير مفعّل ✅"} (x1)
            </div>
            {data.maintenance.active && <div className="mt-1 text-xs text-rose-300">{data.maintenance.message}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.maintenance.active ? (
              <Button size="sm" disabled={busy} onClick={() => void run(() => setMaintenance({ active: false }), "انتهت الصيانة — اللعبة متاحة")}
                className="bg-emerald-600 hover:bg-emerald-500">إنهاء الصيانة</Button>
            ) : (
              <>
                <Input dir="rtl" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="رسالة الصيانة (اختياري)"
                  className="w-56 border-slate-700 bg-slate-900/60 text-slate-100" />
                <Button size="sm" disabled={busy} variant="destructive"
                  onClick={() => void run(() => setMaintenance({ active: true, message: msg || undefined }), "وضع الصيانة مفعّل")}>
                  تفعيل الصيانة
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="جلسات أطلس" value={data.sessions} accent={ATLAS_COLORS.royal} sub="دخول موثّق (x6)" />
        <StatCard label="أوامر مسجّلة" value={data.audit.length} accent={ATLAS_COLORS.cyan} sub="سجل التدقيق (x4)" />
        <StatCard label="أخطاء غير معالجة" value={totalErrors} accent={ATLAS_COLORS.crimson} sub="مركز الأخطاء (x3)" />
        <StatCard label="أخطاء حرجة" value={data.bySeverity.critical ?? 0} accent={ATLAS_SEVERITY.red.color} sub="أعلى خطورة (x7)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="مركز الأخطاء الحي (x3/x7)" icon={AlertTriangle} accent={ATLAS_COLORS.crimson}>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {data.errors.length === 0 && <div className="py-8 text-center text-sm text-emerald-400">لا أخطاء — كل شيء سليم</div>}
            {data.errors.map((e) => (
              <div key={e._id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="flex items-start gap-2">
                  <SeverityDot sev={e.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[12px] text-slate-200" dir="ltr">{e.message}</div>
                    <div className="text-[10px] text-slate-500">
                      {e.category}{e.route ? ` · ${e.route}` : ""} · ×{e.count} · {atlasMinutes(Date.now() - e.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="بث الطوارئ + سجل التدقيق (x2/x4/x8)" icon={Send} accent={ATLAS_COLORS.amber}>
          <div className="flex flex-wrap gap-1.5">
            {(["info", "warning", "ban", "update", "system"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors"
                style={{
                  background: type === t ? `${typeColors[t]}22` : "transparent",
                  borderColor: type === t ? typeColors[t] : "rgba(148,163,184,0.25)",
                  color: type === t ? typeColors[t] : "#94a3b8",
                }}>
                {typeLabels[t]}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            <Input dir="rtl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان البث…"
              className="border-slate-700 bg-slate-900/60 text-slate-100" />
            <Input dir="rtl" value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص البث…"
              className="border-slate-700 bg-slate-900/60 text-slate-100" />
            <Button size="sm" disabled={busy || !title.trim() || !body.trim()}
              onClick={() => void run(() => broadcast({ title, body, type }), "تم بث الإشعار لكل الأجهزة")}
              className="w-full font-bold">
              بث فوري
            </Button>
          </div>
          <div className="mt-4 max-h-44 space-y-1 overflow-y-auto border-t border-slate-800 pt-3">
            {data.audit.slice(0, 25).map((a) => (
              <div key={a._id} className="flex items-center gap-2 text-[11px]">
                <span className={a.ok ? "text-emerald-400" : "text-rose-400"}>{a.ok ? "✓" : "✗"}</span>
                <span className="shrink-0 text-slate-400">{a.system}/{a.feature}</span>
                <span className="truncate text-slate-300">{a.command}</span>
                <span className="ms-auto shrink-0 text-slate-500">{atlasMinutes(Date.now() - a.createdAt)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
