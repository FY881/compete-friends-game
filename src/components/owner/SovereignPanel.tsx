import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Crown, Gavel, ScrollText, Loader2, Landmark, TrendingUp, Undo2 } from "lucide-react";

/**
 * 👑 لوحة الحاكم السيادي — عرض علني لكتاب قوانينه وعقوباته ومراسيمه.
 * الحق الوحيد هنا: النقض (بعد وقوع الفعل). لا أمر ولا اقتراح ولا ضغط.
 */
export function SovereignPanel() {
  const status = useQuery(api.sovereignGovernor.getSovereignStatus, {});
  const penalties = useQuery(api.sovereignGovernor.getPenaltyLog, {});
  const edicts = useQuery(api.sovereignGovernor.getEdicts, {});
  const veto = useMutation(api.sovereignGovernor.vetoPenalty);
  const [vetoNote, setVetoNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (!status || !penalties || !edicts) {
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
