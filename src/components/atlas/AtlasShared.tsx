import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Loader2, Send, CheckCircle2, XCircle, RefreshCw, Sparkles,
  Terminal, Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ATLAS_COLORS, ATLAS_SEVERITY, atlasCompact, atlasMinutes,
} from "@/lib/atlas-design";
import type { Id } from "@/convex/_generated/dataModel";

/** عناصر واجهة مشتركة بين أنظمة أطلس كنترول العشرة. */

export const SEV_COLOR: Record<string, string> = {
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

export function StatCard({ label, value, accent, sub }: {
  label: string; value: string | number; accent: string; sub?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-all hover:shadow-lg"
      style={{ background: "var(--atlas-panel)", borderColor: "rgba(148,163,184,0.14)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <span className="size-2 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums" style={{ color: ATLAS_COLORS.goldBright }}>
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Panel({ title, icon: Icon, accent, children, action }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-5 shadow-xl"
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

export function SeverityDot({ sev }: { sev: string }) {
  const c = SEV_COLOR[sev] ?? ATLAS_COLORS.slate;
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> جارٍ التحميل…
    </div>
  );
}

/** ينفّذ إجراءً مع toast + حالة انتظار موحّدة */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل التنفيذ"); }
    finally { setBusy(false); }
  };
  return { busy, run };
}

/* ═══════════════ محرك الأوامر الحر بالعربية (ميزة c8) ═══════════════ */

export function CommandEngine() {
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Array<{ ok: boolean; text: string }>>([]);

  const setMaintenance = useMutation(api.atlas.atlasSetMaintenance);
  const broadcast = useMutation(api.atlas.atlasBroadcast);
  const setAi = useMutation(api.atlas.atlasSetAiControl);
  const createCode = useMutation(api.atlas.atlasCreateCode);
  const seedRules = useMutation(api.lawEnforcement.seedRules);
  const think = useMutation(api.atlas.atlasThink);

  const isSearchQuery = /^(ابحث|بحث|من هو|من هي)\s+\S+/.test(cmd.trim());
  const searchTerm = cmd.trim().replace(/^(ابحث|بحث|من هو|من هي)\s*/, "");
  const search = useQuery(
    api.atlas.searchPlayers,
    isSearchQuery ? { q: searchTerm, limit: 8 } : "skip",
  );

  const push = (ok: boolean, text: string) =>
    setHistory((h) => [{ ok, text }, ...h].slice(0, 6));

  const run = async () => {
    const raw = cmd.trim();
    if (!raw || busy) return;
    setBusy(true);
    try {
      if (/^(فعّل|فعل|شغّل|شغل)\s+(الذكاء|كل الأنظمة الذكية)$/.test(raw)) {
        await setAi({ aiEnabled: true });
        push(true, "✅ تم تشغيل كل الأنظمة الذكية");
      } else if (/^(أوقف|اوقف|عطّل|عطل)\s+(الذكاء|كل الأنظمة الذكية)$/.test(raw)) {
        await setAi({ aiEnabled: false });
        push(true, "⛔ تم إيقاف كل الأنظمة الذكية");
      } else if (/^(افتح|شغّل|شغل)\s+الصيانة$/.test(raw)) {
        await setMaintenance({ active: true, message: "اللعبة تحت الصيانة بأمر من أطلس كنترول" });
        push(true, "🔧 وضع الصيانة مفعّل — اللعبة مقفلة للاعبين");
      } else if (/^(أغلق|اقفل|أوقف|اوقف)\s+الصيانة$/.test(raw)) {
        await setMaintenance({ active: false });
        push(true, "✅ انتهت الصيانة — اللعبة متاحة");
      } else if (/^(أرسل|ارسل|بثّ|بث)\s+(إشعار|اشعار)/.test(raw)) {
        const text = raw.replace(/^(أرسل|ارسل|بثّ|بث)\s*(إشعار|اشعار)\s*/, "").trim() || "إشعار من أطلس كنترول";
        await broadcast({ title: "📢 بث من أطلس كنترول", body: text, type: "info" });
        push(true, `📨 أُرسل إشعار لكل اللاعبين: «${text}»`);
      } else if (/^(أنشئ|انشئ|اصنع)\s+كود/.test(raw)) {
        const tier = /ذهبي/.test(raw) ? ("gold" as const)
          : /ماسي|ألماس/.test(raw) ? ("diamond" as const)
          : /حصري/.test(raw) ? ("exclusive" as const)
          : /فضي/.test(raw) ? ("silver" as const)
          : ("bronze" as const);
        const res = await createCode({ tier, maxUses: 10 });
        push(true, `🔑 تم إنشاء كود: ${res.code} (10 استخدامات)`);
      } else if (/ازرع القوانين|زرع القوانين/.test(raw)) {
        await seedRules({});
        push(true, "⚖️ أُعيدت زراعة القوانين الرسمية الثلاثين");
      } else if (/^(فكّر|فكر)/.test(raw)) {
        const res = await think({ prompt: raw });
        push(true, `🧠 أطلس فكّر وأنتج ${res.count} ملاحظة — انظر قسم الأنظمة الحرة`);
      } else if (/^(احظر|حظر)/.test(raw)) {
        push(false, "للحظر باسم اللاعب: افتح نظام اللاعبين ← ابحث ← اختر اللاعب ← اختر العقوبة (لضمان العقوبة على الشخص الصحيح).");
      } else {
        push(false, "لم أفهم الأمر. جرّب: «فعّل الذكاء»، «افتح الصيانة»، «أغلق الصيانة»، «أرسل إشعار نص الرسالة»، «أنشئ كود ذهبي»، «ازرع القوانين»، «فكّر».");
      }
      setCmd("");
    } catch (err) {
      push(false, err instanceof Error ? err.message : "فشل تنفيذ الأمر");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="محرك الأوامر الحر — بالعربية (c8)" icon={Terminal} accent={ATLAS_COLORS.cyan}>
      <div className="flex gap-2">
        <Input
          dir="rtl"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
          placeholder="اكتب أمراً… مثل: فعّل الذكاء / افتح الصيانة / أرسل إشعار صيانة قريباً / أنشئ كود ذهبي / فكّر"
          className="flex-1 border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
        />
        <Button onClick={() => void run()} disabled={busy} className="shrink-0 gap-1.5 font-bold">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          تنفيذ
        </Button>
      </div>
      {search && (
        <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-slate-200">
          <span className="font-bold text-cyan-300">نتائج البحث:</span>{" "}
          {search.length === 0 ? "لا نتائج" : search.map((p) => `${p.name}${p.banned ? " (محظور)" : ""}`).join("، ")}
        </div>
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
              {h.ok
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />}
              <span className="text-slate-200">{h.text}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ═══════════════ الأنظمة الحرة — التفكير الشامل ═══════════════ */

export function InsightsSection() {
  const insights = useQuery(api.atlas.getInsights, { limit: 30 });
  const think = useMutation(api.atlas.atlasThink);
  const decide = useMutation(api.atlas.decideInsight);
  const { busy, run } = useRunner();

  const kindLabel: Record<string, string> = {
    anomaly: "شذوذ", suggestion: "اقتراح", observation: "ملاحظة", summary: "ملخص",
  };

  return (
    <Panel
      title="الأنظمة الحرة — تفكير شامل في حالة اللعبة"
      icon={Sparkles}
      accent={ATLAS_SEVERITY.purple.color}
      action={
        <Button size="sm" disabled={busy} onClick={() => void run(() => think({}), "أطلس فكّر الآن — النتائج هنا")}
          className="gap-1.5">
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> تفكير الآن
        </Button>
      }
    >
      {!insights && <Loading />}
      {insights?.length === 0 && (
        <div className="py-6 text-center text-sm text-slate-500">
          لا ملاحظات بعد — اضغط «تفكير الآن» ليفحص أطلس اللعبة بالكامل ويكتشف الشذوذ مبكراً.
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
                  <Badge variant="secondary" className="text-[10px]">{kindLabel[i.kind] ?? i.kind}</Badge>
                  {i.status !== "open" && (
                    <Badge className={i.status === "accepted" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/40 text-slate-400"}>
                      {i.status === "accepted" ? "معتمد ✅" : "مرفوض"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{i.body}</p>
                <div className="mt-0.5 text-[10px] text-slate-500">{i.system} · {atlasMinutes(Date.now() - i.createdAt)}</div>
              </div>
              {i.status === "open" && (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" disabled={busy}
                    onClick={() => void run(() => decide({ insightId: i._id, accept: true }), "معتمد — تعلّم أطلس من قرارك")}
                    className="h-7 bg-emerald-600 px-2.5 text-[11px] hover:bg-emerald-500">اعتماد</Button>
                  <Button size="sm" disabled={busy}
                    onClick={() => void run(() => decide({ insightId: i._id, accept: false }), "تم الرفض")}
                    className="h-7 bg-slate-700 px-2.5 text-[11px] hover:bg-slate-600">رفض</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        🧠 أطلس يراقب باستمرار ويقترح — لكن <span className="font-bold text-slate-300">القرار النهائي لك دائماً</span>.
        كل اعتماد يدرّب ذاكرته فيقترح أفضل في المرة القادمة.
      </p>
    </Panel>
  );
}

/** معرّف مستخدم معروض — يُستخدم في قوائم الاختيار */
export type PlayerPick = { _id: Id<"users">; name: string };
