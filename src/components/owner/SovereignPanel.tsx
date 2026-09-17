import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Crown, Gavel, ScrollText, Loader2, Landmark, TrendingUp, Undo2, ShieldCheck, BrainCircuit } from "lucide-react";

/**
 * 🛡️ نبضة الحاكم — شريط حي يُعرض أعلى كل تبويب رئيسي في غرفة المالك:
 * يذكّر أن الحاكم السيادي يراقب وينفّذ باستقلال، ويعرض آخر قراراته.
 */
export function SovereignPulseCard({ compact = false }: { compact?: boolean }) {
  const status = useQuery(api.sovereignGovernor.getSovereignStatus, {});
  const edicts = useQuery(api.sovereignGovernor.getEdicts, {});
  const latest = edicts?.[0];
  if (!status) return null;
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-l from-amber-950/25 via-transparent to-transparent px-4 py-3",
      compact && "py-2.5",
    )} dir="rtl">
      <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-200">
          الحاكم السيادي يراقب وينفّذ — {status.stats.activeEdicts} مرسوماً نشطاً · {status.stats.totalPenalties - status.stats.vetoed} عقوبة نافذة
        </p>
        {latest && !compact && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">آخر قرار موقّع: {latest.title} — {latest.body.slice(0, 110)}…</p>
        )}
      </div>
      {!compact && (
        <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-200" onClick={() => window.dispatchEvent(new CustomEvent("owner-navigate", { detail: "sovereign" }))}>
          فتح سجل السيادة
        </Button>
      )}
    </div>
  );
}

/**
 * 🧠 لوحة الثقة السيادية وذكاء التعلّم — توزيع درجات الثقة ودروس الحاكم المستخلصة من أثر قراراته.
 */
export function TrustAndLessonsCard() {
  const data = useQuery(api.sovereignGovernor.getTrustAndLessons, {});
  if (!data) return null;
  return (
    <Card className="border-sky-500/25 bg-gradient-to-l from-sky-950/15 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuit className="h-4 w-4 text-sky-400" /> الثقة السيادية وذكاء التعلّم ({data.total} لاعب)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-emerald-500/10 p-2"><b className="text-emerald-400">{data.tiers.high}</b><p className="text-muted-foreground">ثقة عالية 80+</p></div>
          <div className="rounded-lg bg-sky-500/10 p-2"><b className="text-sky-400">{data.tiers.mid}</b><p className="text-muted-foreground">محايد 50-79</p></div>
          <div className="rounded-lg bg-amber-500/10 p-2"><b className="text-amber-400">{data.tiers.low}</b><p className="text-muted-foreground">منخفضة 20-49</p></div>
          <div className="rounded-lg bg-rose-500/10 p-2"><b className="text-rose-400">{data.tiers.critical}</b><p className="text-muted-foreground">حرجة أقل من 20</p></div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="mb-1 text-xs font-bold text-emerald-300">أعلى الثقة</p>
            {data.top.map((t) => (
              <p key={t.id} className="flex justify-between text-xs"><span>{t.name}</span><b className="text-emerald-400">{t.trust}</b></p>
            ))}
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="mb-1 text-xs font-bold text-rose-300">أدنى الثقة — تحت مراقبة الحاكم</p>
            {data.bottom.map((t) => (
              <p key={t.id} className="flex justify-between text-xs"><span>{t.name}</span><b className="text-rose-400">{t.trust}</b></p>
            ))}
          </div>
        </div>
        {data.lessons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-sky-300">دروس استخلصها الحاكم من أثر قراراته</p>
            {data.lessons.slice(0, 5).map((l) => (
              <div key={l.id} className="rounded-md border border-sky-500/20 bg-sky-950/10 p-2 text-xs">
                <span className="font-bold">{l.subject}</span>
                <Badge variant={l.applied ? "default" : "outline"} className="mr-2 text-[10px]">{l.applied ? "مطبّق" : `ثقة ${l.confidence}`}</Badge>
                <p className="mt-1 text-muted-foreground">{l.lesson}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 👑 لوحة الحاكم السيادي — عرض علني لكتاب قوانينه وعقوباته ومراسيمه.
 * الحق الوحيد هنا: النقض (بعد وقوع الفعل). لا أمر ولا اقتراح ولا ضغط.
 */
export function SovereignPanel() {
  const status = useQuery(api.sovereignGovernor.getSovereignStatus, {});
  const penalties = useQuery(api.sovereignGovernor.getPenaltyLog, {});
  const edicts = useQuery(api.sovereignGovernor.getEdicts, {});
  const cases = useQuery(api.sovereignGovernor.getCourtCases, {});
  const veto = useMutation(api.sovereignGovernor.vetoPenalty);
  const [vetoNote, setVetoNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (!status || !penalties || !edicts || !cases) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin ml-2" /> تحميل الدولة السيادية…
      </div>
    );
  }

  const doVeto = async (id: string) => {
    setBusy(id);
    try {
      await veto({ penaltyId: id as any, note: vetoNote[id] || "نقض المالك" });
      toast.success("تم النقض — أُلغي أثر العقوبة فعلياً واستُرد ما سُلب");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل النقض");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* الحالة */}
      <Card className="border-amber-500/30 bg-gradient-to-l from-amber-950/20 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-300">
            <Crown className="h-5 w-5" /> الحاكم السيادي — سجل علني
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">مراسيم نشطة:</span> <b className="text-emerald-400">{status.stats.activeEdicts}</b></div>
          <div><span className="text-muted-foreground">إجمالي المراسيم:</span> <b>{status.stats.totalEdicts}</b></div>
          <div><span className="text-muted-foreground">عقوبات نافذة:</span> <b className="text-rose-400">{status.stats.totalPenalties - status.stats.vetoed}</b></div>
          <div><span className="text-muted-foreground">منقوضة:</span> <b className="text-sky-400">{status.stats.vetoed}</b></div>
        </CardContent>
      </Card>

      {/* كتاب القوانين */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-amber-400" /> كتاب قوانين الحاكم (يصدره هو وحده)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status.laws.map((l) => (
            <div key={l.id} className="flex gap-2 items-start rounded-md bg-muted/40 px-3 py-2">
              <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-300">{l.id}</Badge>
              <span>{l.text}</span>
            </div>
          ))}
          <div className="pt-2 text-xs text-muted-foreground">
            سلّم العقوبات: {status.penaltyLadder.map((p) => `${p.label} (${p.strikes}ض)`).join(" ← ")}
          </div>
        </CardContent>
      </Card>

      {/* سجل العقوبات + النقض */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Gavel className="h-4 w-4 text-rose-400" /> سجل العقوبات النافذة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {penalties.length === 0 && <p className="text-sm text-muted-foreground">لا عقوبات بعد — الدورة السيادية كل 15 دقيقة.</p>}
          {penalties.slice(0, 15).map((p) => (
            <div key={p.id} className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-3 text-sm space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <b>{p.userName}</b>
                <Badge variant="outline" className="border-rose-500/40 text-rose-300">{p.label}</Badge>
                <span className="text-xs text-muted-foreground">ضربة {p.strikes}/5 · قانون {p.lawId}</span>
                {p.status === "vetoed" && <Badge className="bg-sky-500/20 text-sky-300">مُنقوضة</Badge>}
              </div>
              <p className="text-muted-foreground text-xs">السبب: {p.reason} · النتيجة الفعلية: {p.appliedResult}</p>
              {p.status === "vetoed" && p.vetoNote && (
                <p className="text-xs text-sky-300">مبرر النقض: {p.vetoNote}</p>
              )}
              {status.canVeto && p.status !== "vetoed" && (
                <div className="flex gap-2 pt-1">
                  <Textarea
                    value={vetoNote[p.id] ?? ""}
                    onChange={(e) => setVetoNote((s) => ({ ...s, [p.id]: e.target.value }))}
                    placeholder="مبرر النقض (يُوثَّق علناً)"
                    className="min-h-[38px] text-xs"
                    dir="rtl"
                  />
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => doVeto(p.id)} className="shrink-0">
                    {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3 ml-1" />} نقض
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* محكمة النزاهة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Gavel className="h-4 w-4 text-violet-400" /> محكمة النزاهة — قضايا الحاكم بالأدلة الكاملة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {cases.length === 0 && (
            <p className="text-sm text-muted-foreground">لا قضايا مفتوحة — الكشف السلوكي العميق يجري كل دورة (15 دقيقة) عبر تاريخ أسبوع كامل لكل لاعب.</p>
          )}
          {cases.slice(0, 12).map((c) => (
            <div key={c.id} className={cn(
              "rounded-lg border p-3 text-sm space-y-1",
              c.status === "open" ? "border-amber-500/30 bg-amber-950/10" : "border-violet-500/20 bg-violet-950/10",
            )}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{c.userName}</b>
                <Badge variant="outline" className={c.severity === "critical" ? "border-rose-500/50 text-rose-300" : "border-amber-500/50 text-amber-300"}>{c.severity === "critical" ? "خطورة حرجة" : "خطورة عالية"}</Badge>
                {c.status === "open" ? (
                  <Badge className="bg-amber-500/20 text-amber-300">قيد المحاكمة</Badge>
                ) : (
                  <Badge className="bg-violet-500/20 text-violet-300">صدر الحكم</Badge>
                )}
                <span className="text-xs text-muted-foreground">{new Date(c.at).toLocaleString("ar")}</span>
              </div>
              <p className="font-medium">التهمة: {c.charge}</p>
              {c.status === "closed" && c.verdictNote && <p className="text-xs text-violet-200">الحكم: {c.verdictNote}</p>}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">عرض الأدلة</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px]" dir="ltr">{c.evidence}</pre>
              </details>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* المراسيم */}
      <TrustAndLessonsCard />

      {/* المراسيم */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-emerald-400" /> مراسيم الحاكم الموقّعة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {edicts.length === 0 && <p className="text-sm text-muted-foreground">لا مراسيم بعد.</p>}
          {edicts.slice(0, 15).map((e) => (
            <div key={e.id} className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {e.kind === "growth" && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                {e.kind === "economy" && <Landmark className="h-3.5 w-3.5 text-amber-400" />}
                {e.kind === "veto" && <Undo2 className="h-3.5 w-3.5 text-sky-400" />}
                <b>{e.title}</b>
                <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("ar")}</span>
              </div>
              <p className="text-muted-foreground">{e.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
