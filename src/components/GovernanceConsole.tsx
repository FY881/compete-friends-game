import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gavel, LockKeyhole, Play, ShieldCheck, Sparkles, Bot, CheckCircle2, Radio } from "lucide-react";

export function GovernanceConsole() {
  const data = useQuery(api.governanceStore.listConsole);
  const create = useMutation(api.governanceStore.createProposal);
  const court = useAction(api.governance.conveneCourt);
  const deputy = useAction(api.governance.deputyDecide);
  const governor = useAction(api.governance.governorDecide);
  const instrument = useAction(api.governance.runInstrument);
  const [form, setForm] = useState({ title: "", targetKey: "", name: "", description: "", summary: "", rationale: "", config: '{"enabled":true}' });
  const [busy, setBusy] = useState("");
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((s) => ({ ...s, [key]: event.target.value }));

  async function submit() {
    setBusy("create");
    try {
      await create({ ...form, operation: "create", risk: "medium", requestedModule: { name: form.name, description: form.description, kind: "feature", config: form.config } });
      toast.success("سُجّل المقترح وأُرسل إلى المجلس");
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل الإنشاء"); }
    finally { setBusy(""); }
  }

  async function step(kind: string, proposalId: Id<"evolutionProposals">) {
    setBusy(`${kind}:${proposalId}`);
    try {
      if (kind === "court") await court({ proposalId });
      if (kind === "deputy") await deputy({ proposalId });
      if (kind === "governor") await governor({ proposalId });
      if (kind === "run") await instrument({ proposalId });
      toast.success("تمت الخطوة وسُجل الدليل");
    } catch (e) { toast.error(e instanceof Error ? e.message : "توقفت العملية"); }
    finally { setBusy(""); }
  }

  if (data === null) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">هذا المسار محجوز لمالك اللعبة ونائب المالك.</CardContent></Card>;

  return (
    <div dir="rtl" className="space-y-5">
      <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-100">
        <CardHeader><CardTitle className="flex items-center gap-2"><Gavel className="size-5 text-amber-400" />المجلس ← نائب المالك ← الحاكم السيادي ← الغرفة السرية</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
          {["مقترح موثّق", "مداخلات AI حقيقية", "موافقتان إلزاميتان", "توثيق API ورصيد"].map((label, i) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3"><b className="text-amber-300">{i + 1}.</b> {label}</div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" />اقترح تطويراً حقيقياً</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><Input value={form.title} onChange={set("title")} placeholder="عنوان التعديل" /><Input value={form.targetKey} onChange={set("targetKey")} placeholder="مفتاح الوحدة snake_case" /></div>
          <Input value={form.name} onChange={set("name")} placeholder="اسم وحدة التطوير" />
          <Textarea value={form.description} onChange={set("description")} placeholder="وصف الوحدة وأثرها الحقيقي" />
          <div className="grid gap-3 md:grid-cols-2"><Textarea value={form.summary} onChange={set("summary")} placeholder="ملخص التعديل" /><Textarea value={form.rationale} onChange={set("rationale")} placeholder="سبب الحاجة إلى التعديل" /></div>
          <Textarea value={form.config} onChange={set("config")} className="font-mono text-xs" placeholder="إعداد JSON" />
          <Button onClick={submit} disabled={busy === "create"}>إرسال إلى المجلس</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>دورة القرارات</CardTitle></CardHeader><CardContent className="space-y-3">
          {data?.proposals.map((p: any) => <div key={p._id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><b>{p.title}</b><Badge variant="outline">{p.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{p.summary}</p>{p.courtSummary && <p className="mt-2 text-xs text-emerald-700">المجلس: {p.courtSummary}</p>}<div className="mt-3 flex flex-wrap gap-2">
            {p.status === "court_review" && <Button size="sm" onClick={() => step("court", p._id)} disabled={busy === `court:${p._id}`}><Radio className="size-4" />انعقاد المجلس</Button>}
            {p.status === "awaiting_deputy" && <Button size="sm" onClick={() => step("deputy", p._id)} disabled={busy === `deputy:${p._id}`}><Bot className="size-4" />قرار نائب المالك</Button>}
            {p.status === "awaiting_governor" && <Button size="sm" onClick={() => step("governor", p._id)} disabled={busy === `governor:${p._id}`}><ShieldCheck className="size-4" />قرار الحاكم</Button>}
            {p.status === "joint_approved" && <Button size="sm" onClick={() => step("run", p._id)} disabled={busy === `run:${p._id}`}><Play className="size-4" />تشغيل الأداة</Button>}
          </div></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="size-5" />سجل الغرفة السرية</CardTitle></CardHeader><CardContent className="max-h-[560px] space-y-2 overflow-auto">
          {data?.audit.map((a: any) => <div key={a._id} className="rounded-lg border bg-muted/20 p-3 text-xs"><div className="flex justify-between"><b>{a.action}</b><span>{new Date(a.at).toLocaleString("ar-EG")}</span></div><p className="mt-1 text-muted-foreground">{a.actor}: {a.detail}</p></div>)}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>عمليات موثّقة</CardTitle></CardHeader><CardContent className="space-y-2">{data?.operations.map((o: any) => <div key={o._id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><CheckCircle2 className="size-4 text-emerald-600" /><b>{o.operation}</b><span>{o.targetKey}</span><span className="ms-auto text-xs text-muted-foreground">{o.provider}/{o.model} · {o.tokensIn}+{o.tokensOut} tokens</span></div>)}</CardContent></Card>
    </div>
  );
}
