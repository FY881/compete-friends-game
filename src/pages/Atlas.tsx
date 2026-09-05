import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Radar, Users, KeyRound, BookOpen, MessagesSquare, Flag, BrainCircuit,
  Store, BarChart3, ShieldAlert, Search, Loader2, Send, CheckCircle2,
  XCircle, Download, Moon, Sun, RefreshCw, Sparkles, AlertTriangle,
  Terminal, Activity, Crown, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDarkMode } from "@/hooks/use-dark-mode";
import {
  ATLAS_NAME, ATLAS_TAGLINE, ATLAS_VERSION, ATLAS_COLORS, ATLAS_SEVERITY,
  atlasCompact, atlasTime, atlasMinutes,
} from "@/lib/atlas-design";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * أطلس كنترول — لوحة السيطرة الكاملة على حرب العقول.
 * 10 أنظمة كبرى × 8 ميزات = 80 ميزة حقيقية، كلها مربوطة بخادم اللعبة (Convex)
 * نفسه — كل أمر ينعكس مباشرة على اللعبة أونلاين، بلا أي محاكاة.
 */

type SystemId =
  | "control" | "players" | "memberships" | "content" | "rooms"
  | "reports" | "ai" | "economy" | "analytics" | "emergency";

const SYSTEM_ICONS: Record<SystemId, React.ComponentType<{ className?: string }>> = {
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

const SEV_COLOR: Record<string, string> = {
  info: ATLAS_SEVERITY.info.color,
  blue: ATLAS_SEVERITY.blue.color,
  orange: ATLAS_SEVERITY.orange.color,
  red: ATLAS_SEVERITY.red.color,
  purple: ATLAS_SEVERITY.purple.color,
  low: ATLAS_SEVERITY.info.color,
  medium: ATLAS_SEVERITY.orange.color,
  high: ATLAS_SEVERITY.red.color,
  warning: ATLAS_SEVERITY.orange.color,
  critical: ATLAS_SEVERITY.red.color,
};

/* ═══════════════════ مكونات مشتركة ═══════════════════ */

function StatCard({ label, value, accent, sub }: {
  label: string; value: string | number; accent: string; sub?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-all hover:shadow-lg"
      style={{ background: "var(--atlas-panel)", borderColor: "rgba(148,163,184,0.14)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums" style={{ color: ATLAS_COLORS.goldBright }}>
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Panel({ title, icon: Icon, accent, children, action }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-5 shadow-xl backdrop-blur"
      style={{ background: "var(--atlas-panel)", borderColor: "rgba(148,163,184,0.14)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${accent ?? ATLAS_COLORS.royal}1f`, color: accent ?? ATLAS_COLORS.royal }}
            >
              <Icon className="size-5" />
            </span>
          )}
          <h3 className="truncate text-base font-bold text-slate-100">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SeverityDot({ sev }: { sev: string }) {
  const c = SEV_COLOR[sev] ?? ATLAS_COLORS.slate;
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />;
}

/* ═══════════════════ محرك الأوامر الحر (c8) ═══════════════════ */

type CommandResult = { ok: boolean; text: string };

function CommandEngine() {
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<CommandResult[]>([]);

  const punish = useMutation(api.atlas.atlasPunish);
  const pardon = useMutation(api.atlas.atlasPardon);
  const editPlayer = useMutation(api.atlas.atlasEditPlayer);
  const setMaintenance = useMutation(api.atlas.atlasSetMaintenance);
  const broadcast = useMutation(api.atlas.atlasBroadcast);
  const setAi = useMutation(api.atlas.atlasSetAiControl);
  const createCode = useMutation(api.atlas.atlasCreateCode);
  const seedRules = useMutation(api.atlas.atlasSeedRules);
  const think = useMutation(api.atlas.atlasThink);
  const search = useQuery(
    api.atlas.searchPlayers,
    cmd.trim().length >= 3 && /^(ابحث|بحث|من هو|من هي)/.test(cmd.trim()) ? { q: cmd.replace(/^(ابحث|بحث|من هو|من هي)\s*/, "").trim() } : "skip",
  );

  const run = async () => {
    const raw = cmd.trim();
    if (!raw || busy) return;
    setBusy(true);
    const push = (ok: boolean, text: string) => {
      setHistory((h) => [{ ok, text }, ...h].slice(0, 6));
    };
    try {
      // أمر الإيقاف/التشغيل الشامل للذكاء
      if (/^(فعّل|فعل|شغّل|شغل)\s+(الذكاء|كل الأنظمة الذكية)/.test(raw)) {
        await setAi({ aiEnabled: true });
        push(true, "✅ تم تشغيل كل الأنظمة الذكية");
      } else if (/^(أوقف|اوقف|عطّل|عطل)\s+(الذكاء|كل الأنظمة الذكية)/.test(raw)) {
        await setAi({ aiEnabled: false });
        push(true, "⛔ تم إيقاف كل الأنظمة الذكية");
      // الصيانة
      } else if (/^(افتح|شغّل|شغل)\s+الصيانة/.test(raw)) {
        await setMaintenance({ active: true, message: "اللعبة تحت الصيانة بأمر من أطلس كنترول" });
        push(true, "🔧 وضع الصيانة مفعّل — اللعبة مقفلة للاعبين");
      } else if (/^(أغلق|اقفل|أوقف|اوقف)\s+الصيانة/.test regex() as never) {
        push(false, "خطأ داخلي");
      } else if (/^(أغلق|اقفل)\s+الصيانة/.test(raw)) {
        await setMaintenance({ active: false });
        push(true, "✅ انتهت الصيانة — اللعبة متاحة");
      // بوق القيادة
      } else if (/^(أرسل|ارسل|بثّ|بث)\s+(إشعار|اشعار)/.test(raw)) {
        const text = raw.replace(/^.*?(إشعار|اشعار)\s*/, "").trim() || "إشعار من أطلس كنترول";
        await broadcast({ title: "📢 بث من أطلس كنترول", body: text, type: "info" });
        push(true, `📨 أُرسل إشعار لكل اللاعبين: «${text}»`);
      // أكواد العضوية
      } else if (/^(أنشئ|انشئ|اصنع)\s+كود/.test(raw)) {
        const tier = /ذهبي/.test(raw) ? "gold" : /ماسي|ألماس/.test(raw) ? "diamond" : /حصري/.test(raw) ? "exclusive" : /فضي/.test(raw) ? "silver" : "bronze";
        const res = await createCode({ tier: tier as "gold", maxUses: 10 });
        push(true, `🔑 تم إنشاء كود: ${res.code} (10 استخدامات)`);
      // زرع القوانين
      } else if (/ازرع|زرع القوانين/.test(raw)) {
        await seedRules({});
        push(true, "⚖️ أُعيدت زراعة القوانين الرسمية");
      // التفكير الذاتي
      } else if (/فكّر|فكر/.test(raw)) {
        const res = await think({ prompt: raw });
        push(true, `🧠 أطلس فكّر وأنتج ${res.count} ملاحظة — انظر قسم الأنظمة الحرة`);
      // حظر/عقوبة
      } else if (/^(احظر|حظر|احضر)/.test(raw)) {
        push(false, "للحظر باسم لاعب: افتح نظام اللاعبين ← ابحث ← اختر اللاعب ← عقوبة (لأن الحظر يحتاج معرّف اللاعب بدقة).");
      } else {
        push(false, "لم أفهم الأمر. جرّب: «فعّل الذكاء»، «افتح الصيانة»، «أرسل إشعار نص الرسالة»، «أنشئ كود ذهبي»، «فكّر»، «ازرع القوانين».");
      }
      setCmd("");
    } catch (err) {
      push(false, err instanceof Error ? err.message : "فشل تنفيذ الأمر");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="محرك الأوامر الحر — بالعربية" icon={Terminal} accent={ATLAS_COLORS.cyan}>
      <div className="flex gap-2">
        <Input
          dir="rtl"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder="اكتب أمراً… مثل: فعّل الذكاء / أرسل إشعار صيانة قريباً / أنشئ كود ذهبي / فكّر"
          className="flex-1 border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
        />
        <Button onClick={run} disabled={busy} className="shrink-0 gap-1.5 font-bold">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          تنفيذ
        </Button>
      </div>
      {search && (
        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-slate-200">
          <span className="font-bold text-cyan-300">نتائج البحث:</span>{" "}
          {search.length === 0 ? "لا نتائج" : search.map((p) => p.name).join("، ")}
        </div starting />
      )}
      {history.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {history.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border p-2.5 text-[13px]"
              style={{
                background: h.ok ? "rgba(52,211,153,0.06)" : "rgba(244,63,94,0.06)",
                borderColor: h.ok ? "rgba(52,211,153,0.25)" : "rgba(244,63,94,0.25)",
              }}
            >
              {h.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />}
              <span className="text-slate-200">{h.text}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ═══════════════════ 1) السيطرة المركزية الحية ═══════════════════ */

function ControlSystem({ overview, onOpenPlayer }: {
  overview: NonNullable<typeof api.atlas.getOverview._returnType> | undefined;
  onOpenPlayer: () => void;
}) {
  if (!overview) return <Loading />;
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
      <CommandEngine />
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

function PlayersSystem() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Id<"users"> | null>(null);
  const [reason, setReason] = useState("");
  const players = useQuery(api.atlas.searchPlayers, { q: q.trim() || undefined, limit: 60 });
  const file = useQuery(api.atlas.getPlayerFile, selected ? { userId: selected } : "skip");

  const punish = useMutation(api.atlas.atlasPunish);
  const pardon = useMutation(api.atlas.atlasPardon);
  const editPlayer = useMutation(api.atlas.atlasEditPlayer);
  const resetProgress = useMutation(api.atlas.atlasResetProgress);
  const broadcast = useMutation(api.atlas.atlasBroadcast);

  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="سجل اللاعبين + البحث الفوري" icon={Users} accent={ATLAS_COLORS.cyan}
        action={<Badge variant="secondary">{players?.length ?? 0}</Badge>}>
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
                selected === p._id ? "border-violet-500/60 bg-violet-500/10" : "border-slate-800 bg-slate-900/40 hover:bg-slate-800/50"
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
                {p.warnings > 0 && <Badge variant="secondary">{p.warnings} ⚠</Badge>}
              </div>
            </button>
          ))}
          {players?.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا نتائج</div>}
        </div>
      </Panel>

      <Panel title="الملف الشامل (الكاميرا الذكية)" icon={Activity} accent={ATLAS_COLORS.gold}>
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
                {file.user.mutedUntil > Date.now() && <Badge className="bg-orange-500/15 text-orange-300">مكتوم حتى {atlasTime(file.user.mutedUntil)}</Badge>}
                {file.membership && (
                  <Badge style={{ background: `${TIERS[file.membership.tier]?.color ?? "#888"}22`, color: TIERS[file.membership.tier]?.color ?? "#ccc" }}>
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

            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => punish({ userId: selected!, action: "warn", reason }), "تم إرسال تحذير")}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                ⚠ تحذير
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => punish({ userId: selected!, action: "mute", reason, durationHours: 1 }), "تم الكتم ساعة")}
                className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10">
                🔇 كتم 1س
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => punish({ userId: selected!, action: "ban_temp", reason, durationHours: 24 }), "تم الحظر 24س")}
                className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                🔒 حظر 24س
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => punish({ userId: selected!, action: "ban_perm", reason }), "حظر دائم")}
                className="border-rose-600/50 text-rose-300 hover:bg-rose-600/10">
                ⛔ حظر دائم
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => pardon({ userId: selected! }), "تم رفع كل العقوبات")}
                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                🕊 عفو
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => editPlayer({ userId: selected!, role: file.user.role === "admin" ? "user" : "admin" }), "تم تغيير الدور")}
                className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10">
                {file.user.role === "admin" ? "↓ إلغاء الإشراف" : "↑ ترقية مشرف"}
              </Button>
            </div>

            <Input
              dir="rtl" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="سبب العقوبة (اختياري لكن موثّق)…"
              className="border-slate-700 bg-slate-900/60 text-slate-100"
            />

            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} className="flex-1 border-slate-700 text-slate-300"
                onClick={() => run(() => resetProgress({ userId: selected! }), "تم تصفير التقدم (مع نسخة احتياطية)")}>
                ♻️ تصفير التقدم
              </Button>
              <Button size="sm" variant="outline" disabled={busy} className="flex-1 border-slate-700 text-slate-300"
                onClick={() => run(() => broadcast({ title: "رسالة من الإدارة", body: `رسالة موجهة من أطلس كنترول إلى ${file.user.name}`, type: "info", targetUserId: selected! }), "تم إرسال الرسالة")}>
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

function MembershipsSystem() {
  const data = useQuery(api.atlas.membershipAdminData, {});
  const grant = useMutation(api.atlas.atlasGrantMembership);
  const revoke = useMutation(api.atlas.atlasRevokeMembership);
  const createCode = useMutation(api.atlas.atlasCreateCode);
  const deleteCode = useMutation(api.atlas.atlasDeleteCode);

  const [tier, setTier] = useState<"bronze" | "silver" | "gold" | "diamond" | "exclusive">("gold");
  const [maxUses, setMaxUses] = useState(10);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { const r = await fn(); if (r && typeof r === "object" && "code" in r) toast.success(`تم إنشاء الكود: ${(r as { code: string }).code}`); else toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {data.tiers.map((t) => (
          <StatCard key={t.id} label={t.name} value={t.count} accent={TIERS[t.id]?.color ?? "#888"} sub={`${data.total} إجمالي`} />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="مصنع الأكواد" icon={KeyRound} accent={ATLAS_COLORS.royal}>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TIERS) as [string, { name: string; color: string }][]).map(([id, t]) => (
              <button
                key={id}
                onClick={() => setTier(id as typeof tier)}
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
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-slate-400">عدد الاستخدامات:</label>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 border-slate-700 bg-slate-900/60 text-slate-100" />
            <Button disabled={busy} onClick={() => run(() => createCode({ tier, maxUses }), "تم")}
              className="gap-1.5 font-bold">
              <Sparkles className="size-4" /> توليد كود
            </Button>
          </div>
          <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
            {data.codes.map((c) => (
              <div key={c._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold" style={{ color: TIERS[c.tier]?.color }}>{c.code}</div>
                  <div className="text-[11px] text-slate-500">{TIERS[c.tier]?.name} · {c.usedCount}/{c.maxUses || "∞"} استُخدم</div>
                </div>
                {c.active ? (
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => run(() => deleteCode({ codeId: c._id }), "تم تعطيل الكود")}
                    className="border-rose-500/40 text-[11px] text-rose-300">تعطيل</Button>
                ) : (
                  <Badge variant="secondary">معطّل</Badge>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="المستفيدون الحاليون" icon={Crown} accent={ATLAS_COLORS.gold}
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
                    onClick={() => run(() => revoke({ userId: h.userId }), "تم سحب العضوية")}
                    className="border-rose-500/40 text-[11px] text-rose-300">سحب</Button>
                </div>
              </div>
            ))}
            {data.holders.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا مستفيدين بعد</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 4) المحتوى والأسئلة ═══════════════════ */

function ContentSystem() {
  const data = useQuery(api.atlas.contentAdminData, {});
  const toggleQ = useMutation(api.atlas.atlasToggleQuestion);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;
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
        <Panel title="توزيع التصنيفات" icon={BookOpen} accent={ATLAS_COLORS.emerald}>
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

        <Panel title="مراقبة الجودة — أعلام مشاكل" icon={AlertTriangle} accent={ATLAS_COLORS.amber}>
          {data.qualityFlags.length === 0 ? (
            <div className="py-8 text-center text-sm text-emerald-400">✅ لا مشاكل جودة — البنك نظيف</div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {data.qualityFlags.map((f) => (
                <div key={f.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[13px] text-slate-200">{f.question}</div>
                  <div className="mt-1 text-[11px] text-amber-400">{f.reason}</div>
                  <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => run(() => toggleQ({ questionId: f.id, disabled: true }), "سُحب السؤال من التداول")}
                    className="mt-2 border-rose-500/40 text-[11px] text-rose-300">سحب من التداول</Button>
                </div>
              ))}
            </div>
          )}
          {data.disabledCount > 0 && (
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-400">
              {data.disabledCount} سؤالاً معطّلاً — افتح بنك الأسئلة في غرفة المالك لإعادة تفعيلها، أو استخدم أمر «ازرع القوانين» لإعادة ضبط الإعدادات.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 5) الغرف والقوانين ═══════════════════ */

function RoomsSystem() {
  const data = useQuery(api.atlas.roomsAdminData, {});
  const seedRules = useMutation(api.atlas.atlasSeedRules);
  const think = useMutation(api.atlas.atlasThink);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;
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
        <Panel title="خريطة الغرف" icon={MessagesSquare} accent={ATLAS_COLORS.amber}>
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
                  <span>{atlasMinutes(Date.now() - r.createdAt)}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${(r.messages / maxMsgs) * 100}%`, background: ATLAS_COLORS.amber }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="المنظومة القانونية" icon={Shield} accent={ATLAS_COLORS.royal}>
          <div className="mb-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => seedRules({}), "أُعيدت زراعة القوانين الرسمية")}
              className="gap-1.5">⚖️ زرع القوانين</Button>
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => run(() => think({ prompt: "فكّر في حالة المجتمع" }), "أطلس فكّر — انظر الأنظمة الحرة")}
              className="border-violet-500/40 text-violet-300">🧠 تحليل مجتمعي</Button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {data.rules.map((r) => (
              <div key={r._id} className="flex items-center gap-2 rounded-lg bg-slate-900/40 px-3 py-2 text-[12px]">
                <SeverityDot sev={r.severity} />
                <span className="flex-1 truncate text-slate-300">{r.title}</span>
                {r.active ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" /> : <XCircle className="size-3.5 shrink-0 text-slate-600" />}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 6) البلاغات الذكية ═══════════════════ */

function ReportsSystem() {
  const data = useQuery(api.atlas.reportsAdminData, {});
  const resolve = useMutation(api.atlas.atlasResolveReport);
  const think = useMutation(api.atlas.atlasThink);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="مفتوحة" value={data.stats.open} accent={ATLAS_COLORS.crimson} />
        <StatCard label="عالية الخطورة" value={data.stats.highSeverityOpen} accent={ATLAS_SEVERITY.purple.color} />
        <StatCard label="محسومة" value={data.stats.resolved} accent={ATLAS_COLORS.emerald} />
        <StatCard label="مرفوضة" value={data.stats.dismissed} accent={ATLAS_COLORS.slate} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="صندوق البلاغات الحي" icon={Flag} accent={ATLAS_COLORS.crimson}
          action={
            <Button size="sm" variant="outline" disabled={busy}
              onClick={() => run(() => think({ prompt: "حلّل البلاغات" }), "أطلس حلّل البلاغات")}
              className="border-violet-500/40 text-[11px] text-violet-300">🧠 تحليل ذكي</Button>
          }>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {data.open.length === 0 && <div className="py-8 text-center text-sm text-emerald-400">✅ لا بلاغات مفتوحة</div>}
            {data.open.map((r) => (
              <div key={r._id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-100">{r.reason}</div>
                    {r.details && <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{r.details}</div>}
                    <div className="mt-1 text-[10px] text-slate-500">{r.reporterName} ← {r.targetName} · {atlasMinutes(Date.now() - r.createdAt)}</div>
                  </div>
                  {r.aiVerdict && <SeverityDot sev={r.aiVerdict.severity} />}
                </div>
                {r.aiVerdict && (
                  <div className="mt-2 rounded-lg bg-violet-500/8 p-2 text-[11px] text-violet-200">
                    🧠 حكم الذكاء: {r.aiVerdict.severity === "high" ? "خطورة عالية" : r.aiVerdict.severity === "medium" ? "متوسطة" : "منخفضة"} — {r.aiVerdict.suggestedAction}
                  </div>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" disabled={busy}
                    onClick={() => run(() => resolve({ reportId: r._id, approved: true }), "تم اعتماد البلاغ")}
                    className="h-7 flex-1 bg-emerald-600 text-[11px] hover:bg-emerald-500">اعتماد + إجراء</Button>
                  <Button size="sm" disabled={busy}
                    onClick={() => run(() => resolve({ reportId: r._id, approved: false }), "تم رفض البلاغ")}
                    className="h-7 flex-1 bg-slate-700 text-[11px] hover:bg-slate-600">رفض</Button>
                </div>
                </div>
            ))}
          </div>
        </Panel>

        <Panel title="اتجاهات البلاغات (أكثر الأسباب)" icon={BarChart3} accent={ATLAS_COLORS.amber}>
          <div className="space-y-2">
            {Object.entries(data.stats.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, n]) => {
              const max = Math.max(...Object.values(data.stats.byReason));
              return (
                <div key={reason}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="truncate text-slate-300">{reason}</span>
                    <span className="tabular-nums text-slate-500">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: `linear-gradient(90deg, ${ATLAS_COLORS.crimson}, ${ATLAS_COLORS.amber})` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(data.stats.byReason).length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا بيانات بعد</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════ 7) الذكاء الاصطناعي ═══════════════════ */

function AiSystem() {
  const data = useQuery(api.atlas.aiAdminData, {});
  const setAi = useMutation(api.atlas.atlasSetAiControl);
  const think = useMutation(api.atlas.atlasThink);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { key: "aiEnabled" as const, label: "المفتاح الرئيسي للذكاء", desc: "شغّل أو أوقف كل الأنظمة الذكية", on: data.aiEnabled },
          { key: "aiAutoApply" as const, label: "التطبيق التلقائي", desc: "تنفيذ قرارات الذكاء فوراً دون مراجعة", on: data.aiAutoApply },
          { key: "aiAdminEnabled" as const, label: "الإدارة الآلية", desc: "المسح الدوري الشامل بلا تدخل", on: data.aiAdminEnabled },
        ].map((s) => (
          <div key={s.key} className="rounded-2xl border p-4" style={{ background: "var(--atlas-panel)", borderColor: s.on ? "rgba(139,92,246,0.4)" : "rgba(148,163,184,0.14)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-100">{s.label}</span>
              <button
                onClick={() => run(() => setAi({ [s.key]: !s.on }), s.on ? "تم الإيقاف" : "تم التشغيل")}
                disabled={busy}
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ background: s.on ? ATLAS_COLORS.royal : "#334155" }}
              >
                <span className="absolute top-0.5 size-5 rounded-full bg-white transition-all" style={{ [s.on ? "right" : "left"]: 2 } as React.CSSProperties} />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => run(() => think({}), "أطلس فكّر في اللعبة الآن — النتائج في قسم الأنظمة الحرة")}
          className="gap-1.5 font-bold"><BrainCircuit className="size-4" /> طلب تفكير شامل الآن</Button>
      </div>

      <Panel title="سجل نشاط الذكاء (شفافية كاملة)" icon={Activity} accent={ATLAS_COLORS.royal}>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {data.logs.length === 0 && <div className="py-8 text-center text-sm text-slate-500">لا نشاط بعد</div>}
          {data.logs.map((l) => (
            <div key={l._id} className="flex items-start gap-2 rounded-lg bg-slate-900/40 px-3 py-2 text-[12px]">
              <SeverityDot sev={l.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-slate-200">{l.message}</div>
                <div className="text-[10px] text-slate-500">{l.subsystem} · {l.action} {l.auto ? "· تلقائي" : ""} · {atlasMinutes(Date.now() - l.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════ 8) الاقتصاد والمتجر ═══════════════════ */

function EconomySystem() {
  const data = useQuery(api.atlas.economyAdminData, {});
  if (!data) return <Loading />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="عناصر المتجر" value={data.store.items} accent={ATLAS_COLORS.amber} sub={`${data.store.sections} أقسام · ${data.store.bundles} حزم`} />
        <StatCard label="عملات اللاعبين" value={atlasCompact(data.currency.coins)} accent={ATLAS_COLORS.gold} sub={`متوسط ${atlasCompact(data.currency.avgCoins)}/لاعب`} />
        <StatCard label="هدايا مرسلة" value={data.gifts.total} accent={ATLAS_COLORS.royal} sub={`${data.gifts.unclaimed} غير مستلمة`} />
        <StatCard label="هدايا 7 أيام" value={data.gifts.last7d} accent={ATLAS_COLORS.emerald} />
      </div>
      <Panel title="كتالوج المتجر (أول 20 عنصراً)" icon={Store} accent={ATLAS_COLORS.amber}>
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

function AnalyticsSystem() {
  const data = useQuery(api.atlas.analyticsData, {});
  const [report, setReport] = useState<string | null>(null);
  const exportReport = useQuery(api.atlas.exportFullReport, report === "go" ? {} : "skip");

  if (!data) return <Loading />;

  const max = Math.max(1, ...data.finished7d);
  const days = ["أمس-6", "أمس-5", "أمس-4", "أمس-3", "أمس-2", "أمس", "اليوم"];

  const doExport = () => {
    setReport("go");
    setTimeout(() => {
      if (exportReport) {
        const blob = new Blob([JSON.stringify(exportReport, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `atlas-report-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        toast.success("تم تنزيل التقرير التنفيذي");
        setReport(null);
      }
    }, 600);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="جولات منتهية" value={atlasCompact(data.totals.finished)} accent={ATLAS_COLORS.emerald} sub={`من ${atlasCompact(data.totals.games)}`} />
        <StatCard label="دقة الإجابات" value={`${data.totals.avgAccuracy}%`} accent={ATLAS_COLORS.cyan} sub={`${atlasCompact(data.totals.answers)} إجابة`} />
        <StatCard label="التشبّث (3+ جولات)" value={`${data.totals.retention}%`} accent={ATLAS_COLORS.gold} />
        <StatCard label="حسابات" value={atlasCompact(data.totals.users)} accent={ATLAS_COLORS.royal} sub={`${atlasCompact(data.totals.rounds)} جولة مسجلة`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="نشاط 7 أيام" icon={BarChart3} accent={ATLAS_COLORS.cyan}>
          <div className="flex h-40 items-end gap-2">
            {data.finished7d.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-slate-400">{v}</span>
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${Math.max(4, (v / max) * 120)}px`, background: `linear-gradient(180deg, ${ATLAS_COLORS.cyan}, ${ATLAS_COLORS.royal}44)` }} />
                <span className="text-[9px] text-slate-500">{days[i]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="أبطال الساحة — أعلى 10" icon={Crown} accent={ATLAS_COLORS.gold}>
          <div className="space-y-1.5">
            {data.topPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-900/40 px-3 py-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ background: i === 0 ? `${ATLAS_COLORS.gold}33` : "rgba(148,163,184,0.1)", color: i === 0 ? ATLAS_COLORS.goldBright : "#94a3b8" }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{p.name}</span>
                <span className="tabular-nums text-[12px] font-bold" style={{ color: ATLAS_COLORS.goldBright }}>{atlasCompact(p.xp)} XP</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Button onClick={doExport} className="gap-1.5 font-bold">
        <Download className="size-4" /> تصدير التقرير التنفيذي (JSON)
      </Button>
    </div>
  );
}

/* ═══════════════════ 10) الطوارئ والصيانة ═══════════════════ */

function EmergencySystem() {
  const data = useQuery(api.atlas.emergencyAdminData, {});
  const setMaintenance = useMutation(api.atlas.atlasSetMaintenance);
  const broadcast = useMutation(api.atlas.atlasBroadcast);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  if (!data) return <Loading />;

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
              وضع الصيانة: {data.maintenance.active ? "مفعّل ⛔" : "متاح ✅"}
            </div>
            {data.maintenance.active && <div className="mt-1 text-xs text-rose-300">{data.maintenance.message}</div>}
          </div>
          <div className="flex gap-2">
            {data.maintenance.active ? (
              <Button size="sm" disabled={busy} onClick={() => run(() => setMaintenance({ active: false }), "انتهت الصيانة")}
                className="bg-emerald-600 hover:bg-emerald-500">إنهاء الصيانة</Button>
            ) : (
              <>
                <Input dir="rtl" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="رسالة الصيانة (اختياري)"
                  className="w-56 border-slate-700 bg-slate-900/60 text-slate-100" />
                <Button size="sm" disabled={busy} variant="destructive"
                  onClick={() => run(() => setMaintenance({ active: true, message: msg || undefined }), "وضع الصيانة مفعّل")}>
                  تفعيل الصيانة
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="جلسات أطلس" value={data.sessions} accent={ATLAS_COLORS.royal} sub="دخول موثّق" />
        <StatCard label="أوامر مسجّلة" value={data.audit.length} accent={ATLAS_COLORS.cyan} />
        <StatCard label="أخطاء غير معالجة" value={Object.values(data.bySeverity).reduce((s, n) => s + n, 0)} accent={ATLAS_COLORS.crimson} />
        <StatCard label="أعلى خطورة" value={data.bySeverity.critical ?? 0} accent={ATLAS_SEVERITY.red.color} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="مركز الأخطاء الحي" icon={AlertTriangle} accent={ATLAS_COLORS.crimson}>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {data.errors.length === 0 && <div className="py-8 text-center text-sm text-emerald-400">✅ لا أخطاء — كل شيء سليم</div>}
            {data.errors.map((e) => (
              <div key={e._id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                <div className="flex items-start gap-2">
                  <SeverityDot sev={e.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-slate-200" dir="ltr">{e.message}</div>
                    <div className="text-[10px] text-slate-500">{e.category} {e.route && `· ${e.route}`} · ×{e.count} · {atlasMinutes(Date.now() - e.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="بث الطوارئ + سجل التدقيق" icon={Send} accent={ATLAS_COLORS.amber}>
          <EmergencyBroadcast broadcast={broadcast} busy={busy} run={run} />
          <div className="mt-4 max-h-44 space-y-1 overflow-y-auto border-t border-slate-800 pt-3">
            {data.audit.slice(0, 25).map((a) => (
              <div key={a._id} className="flex items-center gap-2 text-[11px]">
                <span className={a.ok ? "text-emerald-400" : "text-rose-400"}>{a.ok ? "✓" : "✗"}</span>
                <span className="text-slate-400">{a.system}/{a.feature}</span>
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

function EmergencyBroadcast({ broadcast, busy, run }: {
  broadcast: ReturnType<typeof useMutation<typeof api.atlas.atlasBroadcast>>;
  busy: boolean;
  run: (fn: () => Promise<unknown>, okMsg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "warning" | "ban" | "update" | "system">("warning");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(["info", "warning", "ban", "update", "system"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)}
            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors"
            style={{
              background: type === t ? `${SEV_COLOR[t] ?? ATLAS_COLORS.royal}22` : "transparent",
              borderColor: type === t ? SEV_COLOR[t] ?? ATLAS_COLORS.royal : "rgba(148,163,184,0.25)",
              color: type === t ? SEV_COLOR[t] ?? ATLAS_COLORS.royal : "#94a3b8",
            }}>
            {{ info: "معلومة", warning: "تحذير", ban: "عقوبات", update: "تحديث", system: "نظام" }[t]}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        <Input dir="rtl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان البث…"
          className="border-slate-700 bg-slate-900/60 text-slate-100" />
        <Input dir="rtl" value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص البث…"
          className="border-slate-700 bg-slate-900/60 text-slate-100" />
        <Button size="sm" disabled={busy || !title.trim() || !body.trim()}
          onClick={() => run(() => broadcast({ title, body, type }), "تم بث الطوارئ لكل الأجهزة")}
          className="w-full font-bold">
          📢 بث فوري
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════ الأنظمة الحرة — التفكير الشامل ═══════════════════ */

function InsightsSection() {
  const insights = useQuery(api.atlas.getInsights, { limit: 30 });
  const think = useMutation(api.atlas.atlasThink);
  const decide = useMutation(api.atlas.decideInsight);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل"); }
    finally { setBusy(false); }
  };

  return (
    <Panel
      title="الأنظمة الحرة — تفكير شامل في حالة اللعبة"
      icon={Sparkles}
      accent={ATLAS_SEVERITY.purple.color}
      action={
        <Button size="sm" disabled={busy} onClick={() => run(() => think({}), "أطلس فكّر الآن")}
          className="gap-1.5">
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> تفكير الآن
        </Button>
      }
    >
      {!insights && <Loading />}
      {insights?.length === 0 && (
        <div className="py-6 text-center text-sm text-slate-500">
          لا ملاحظات بعد — اضغط «تفكير الآن» ليفحص أطلس اللعبة بالكامل.
        </div>
      )}
      <div className="space-y-2">
        {insights?.map((i) => (
          <div key={i._id} className="rounded-xl border p-3.5" style={{
            background: "rgba(15,20,40,0.5)",
            borderColor: `${SEV_COLOR[i.severity] ?? "#888"}44`,
          }}>
            <div className="flex items-start gap-2.5">
              <SeverityDot sev={i.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-100">{i.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{i.kind === "anomaly" ? "شذوذ" : i.kind === "suggestion" ? "اقتراح" : i.kind === "observation" ? "ملاحظة" : "ملخص"}</Badge>
                  {i.status !== "open" && (
                    <Badge className={i.status === "accepted" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/40 text-slate-400"}>
                      {i.status === "accepted" ? "معتمد ✅" : "مرفوض"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{i.body}</p>
                <div className="text-[10px] text-slate-500">{i.system} · {atlasMinutes(Date.now() - i.createdAt)}</div>
              </div>
              {i.status === "open" && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" disabled={busy} onClick={() => run(() => decide({ insightId: i._id, accept: true }), "معتمد — تعلّم أطلس من قرارك")}
                    className="h-7 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-500">اعتماد</Button>
                  <Button size="sm" disabled={busy} onClick={() => run(() => decide({ insightId: i._id, accept: false }), "تم الرفض")}
                    className="h-7 bg-slate-700 px-2 text-[11px] hover:bg-slate-600">رفض</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        🧠 أطلس يراقب باستمرار ويقترح — لكن <span className="font-bold text-slate-300">القرار النهائي لك دائماً</span>. كل اعتماد يدرّب ذاكرته ليقترح أفضل في المرة القادمة.
      </p>
    </Panel>
  );
}

/* ═══════════════════ الهيكل الرئيسي ═══════════════════ */

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
    </div>
  );
}

const OWNER_ID_SEED = "atlas-owner-seed";

export default function Atlas() {
  const [active, setActive] = useState<SystemId>("control");
  const { isDark, toggle } = useDarkMode();

  // سجل النظام + نظرة شاملة — دائماً حيّان
  const overview = useQuery(api.atlas.getOverview, {});
  const registry = useQuery(api.atlas.getAtlasSystemRegistry, {});

  // حماية: أي رفض صلاحية يعرض بوابة الدخول
  const authError = overview === null;

  const systems = registry?.systems ?? [];

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "var(--atlas-bg)" }}>
      {/* ── الترويسة ── */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--atlas-bg) 85%, transparent)", borderColor: "rgba(148,163,184,0.12)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/icons/atlas-icon-192.png" alt={ATLAS_NAME} className="size-11 rounded-xl shadow-lg" draggable={false} />
            <div className="min-w-0">
              <h1
                className="truncate text-lg font-black leading-tight"
                style={{
                  background: `linear-gradient(120deg, ${ATLAS_COLORS.goldBright}, ${ATLAS_COLORS.gold} 45%, ${ATLAS_COLORS.royal})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {ATLAS_NAME}
              </h1>
              <p className="truncate text-[11px] text-slate-400">{ATLAS_TAGLINE} · v{ATLAS_VERSION}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={toggle} className="size-9 text-slate-300" aria-label="تبديل الوضع">
              {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
            </Button>
          </div>
        </div>
      </header>

      {authError && (
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            انتهت الجلسة أو فقدنا صلاحية المالك — أعد الدخول من بوابة أطلس.
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {/* شريط الأنظمة العشرة */}
        <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {systems.length === 0 && Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-800/40" />
          ))}
          {systems.map((s) => {
            const Icon = SYSTEM_ICONS[s.id as SystemId] ?? Radar;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id as SystemId)}
                className="group relative overflow-hidden rounded-2xl border p-3 text-start transition-all"
                style={{
                  background: isActive ? `${s.accent}1a` : "var(--atlas-panel)",
                  borderColor: isActive ? s.accent : "rgba(148,163,184,0.12)",
                  boxShadow: isActive ? `0 0 24px ${s.accent}33` : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${s.accent}22`, color: s.accent }}>
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold" style={{ color: s.accent }}>النظام {s.num}</div>
                    <div className="truncate text-[12px] font-bold text-slate-100">{s.name}</div>
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-slate-500">{s.featureCount} ميزات حقيقية</div>
              </button>
            );
          })}
        </nav>

        {/* سجل الميزات الثمانين للنظام النشط */}
        {registry && (
          <div className="mb-5 rounded-2xl border p-4" style={{ background: "var(--atlas-panel)", borderColor: "rgba(148,163,184,0.12)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                ميزات {systems.find((s) => s.id === active)?.name} ({systems.find((s) => s.id === active)?.features.length ?? 0})
              </span>
              <Badge variant="secondary" className="text-[10px]">{registry.featureCount} ميزة إجمالاً</Badge>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {systems.find((s) => s.id === active)?.features.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-2">
                  <div className="flex items-center gap-1.5">
                    {f.kind === "action" && <Zap className={`size-3 ${f.danger ? "text-rose-400" : "text-amber-400"}`} />}
                    <span className="truncate text-[11px] font-bold text-slate-200">{f.name}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* الأنظمة الحرة — فوق كل شيء */}
        <div className="mb-5">
          <InsightsSection />
        </div>

        {/* محتوى النظام النشط */}
        {active === "control" && <ControlSystem overview={overview} onOpenPlayer={() => setActive("players")} />}
        {active === "players" && <PlayersSystem />}
        {active === "memberships" && <MembershipsSystem />}
        {active === "content" && <ContentSystem />}
        {active === "rooms" && <RoomsSystem />}
        {active === "reports" && <ReportsSystem />}
        {active === "ai" && <AiSystem />}
        {active === "economy" && <EconomySystem />}
        {active === "analytics" && <AnalyticsSystem />}
        {active === "emergency" && <EmergencySystem />}

        {/* التذييل */}
        <footer className="mt-8 border-t border-slate-800/60 pt-4 text-center text-[11px] text-slate-600">
          {ATLAS_NAME} v{ATLAS_VERSION} — سيطرة حقيقية أونلاين على «حرب العقول» · كل أمر يُسجَّل في سجل التدقيق الدائم
        </footer>
      </main>
    </div>
  );
}
