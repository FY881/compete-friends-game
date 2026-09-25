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
import { Gavel, LockKeyhole, Play, ShieldCheck, Sparkles, Bot, CheckCircle2, Radio, GitBranch, Power, Undo2 } from "lucide-react";

import { isRuleModuleKey, previewRuleConfig, ruleSurfaceFor, RULE_MODULE_KEYS } from "@/convex/evolutionRules";

const MANDATE_OPS = ["create", "modify", "construct", "delete"] as const;
type MandateRisk = "low" | "medium" | "critical";

/** يقرأ قيمة قانون حيّ من كائن القوانين بمسار نقطي. */
function readLiveValue(source: unknown, path: string): number {
  return path.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), source) as number;
}

export function GovernanceConsole() {
  const data = useQuery(api.governanceStore.listConsole);
  const modules = useQuery(api.governanceStore.listEvolutionModules);
  const create = useMutation(api.governanceStore.createProposal);
  const court = useAction(api.governance.conveneCourt);
  const deputy = useAction(api.governance.deputyDecide);
  const governor = useAction(api.governance.governorDecide);
  const owner = useAction(api.governance.ownerDecide);
  const governorSelf = useAction(api.governance.governorSelfReview);
  const deputyDraft = useAction(api.governance.deputyDraftProposal);
  const deputySelf = useAction(api.governance.deputySelfReview);
  const instrument = useAction(api.governance.runInstrument);
  const governorPropose = useAction(api.governance.governorPropose);
  const ownerGovernor = useAction(api.governance.ownerGovernorDecide);
  const resolveConditions = useAction(api.governance.resolveConditions);
  const mandateExecute = useAction(api.governance.governorMandateExecute);
  const mandateState = useQuery(api.governanceStore.mandateState);
  const liveRulesData = useQuery(api.evolutionRuntime.liveRules);
  const grantMandateMut = useMutation(api.governanceStore.grantMandate);
  const revokeMandateMut = useMutation(api.governanceStore.revokeMandate);
  const freezeMut = useMutation(api.governanceStore.setGovernorFreeze);
  const rollbackMut = useMutation(api.governanceStore.rollbackExecution);
  const [freezeReason, setFreezeReason] = useState("");
  const [mf, setMf] = useState({ title: "", allowlist: "", quota: "3", hours: "24", ops: ["modify", "construct"] as string[], maxRisk: "medium" as MandateRisk, reason: "" });
  const githubEvolution = useAction(api.githubEvolution.createEvolutionPullRequest);
  const [brief, setBrief] = useState("");
  const [govOp, setGovOp] = useState<"create" | "modify" | "delete" | "construct">("modify");
  const [govTarget, setGovTarget] = useState("");
  const [deputyBrief, setDeputyBrief] = useState("");
  const [impact, setImpact] = useState({ title: "", targetKey: "", summary: "", rationale: "", rollback: "" });
  const [form, setForm] = useState({ title: "", targetKey: "", name: "", description: "", summary: "", rationale: "", config: '{"enabled":true}' });
  const [busy, setBusy] = useState("");
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((s) => ({ ...s, [key]: event.target.value }));

  async function submit() {
    setBusy("create");
    try {
      await create({ title: form.title, targetKey: form.targetKey, summary: form.summary, rationale: form.rationale, operation: "create", risk: "medium", requestedModule: { name: form.name, description: form.description, kind: "feature", config: form.config } });
      toast.success("سُجّل المقترح وأُرسل إلى المجلس");
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل الإنشاء"); }
    finally { setBusy(""); }
  }

  async function submitHighImpactPlan() {
    if (impact.title.trim().length < 5 || impact.summary.trim().length < 20 || impact.rationale.trim().length < 20 || impact.rollback.trim().length < 20) {
      toast.error("أكمل سبب التغيير وخطة الرجوع قبل إرسال طلب الأثر العالي");
      return;
    }
    setBusy("impact");
    try {
      await create({
        title: impact.title,
        targetKey: impact.targetKey || "high_impact_change",
        operation: "construct",
        summary: impact.summary,
        rationale: `${impact.rationale}\nخطة الرجوع: ${impact.rollback}`,
        risk: "critical",
        requestedModule: { name: impact.targetKey || "high_impact_change", description: "طلب تخطيط تعديل عالي الأثر؛ لا تنفيذ مباشر", kind: "high_impact_plan", config: JSON.stringify({ directProductionMutation: false, humanExecutionRequired: true, rollback: impact.rollback }) },
      });
      toast.success("تم إرسال مخطط الأثر العالي إلى المحكمة؛ لم يُنفذ أي تغيير");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر إرسال المخطط"); }
    finally { setBusy(""); }
  }

  async function proposeAsGovernor() {
    setBusy("governor-propose");
    try {
      const res = await governorPropose({ brief, operation: govOp, targetKey: govTarget.trim() || undefined });
      toast.success(res?.fastTrack
        ? `الطلب داخل تفويضك «${res.mandateTitle ?? ""}» — سينفّذ بعد قرار المحكمة دون إعادة إذن فردي`
        : "أعد الحاكم طلبه بالأداة الحقيقية وأرسله إلى المحكمة (تسلسل كامل)");
      setBrief("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل اقتراح الحاكم"); }
    finally { setBusy(""); }
  }

  async function ownerGovernorDecide(proposalId: Id<"evolutionProposals">, approved: boolean) {
    let reason = "";
    if (!approved) {
      const input = window.prompt("سبب رفض المالك لطلب الحاكم (يُسجل في الغرفة السرية):");
      if (input === null) return;
      reason = input.trim();
      if (reason.length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    }
    setBusy(`owner-gov:${proposalId}`);
    try {
      await ownerGovernor({ proposalId, approved, reason: reason || undefined });
      toast.success(approved ? "مُنح إذن المالك لطلب الحاكم — بانتظار قرار الحاكم السيادي" : "رُفض طلب الحاكم وأُوقف قبل أي تنفيذ");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تسجيل إذن المالك لطلب الحاكم"); }
    finally { setBusy(""); }
  }

  async function satisfy(proposalId: Id<"evolutionProposals">) {
    const evidence = window.prompt("اكتب دليل استيفاء كل شروط المحكمة:");
    if (!evidence) return;
    setBusy(`conditions:${proposalId}`);
    try { await resolveConditions({ proposalId, evidence }); toast.success("تمت مراجعة الشروط"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "فشل استيفاء الشروط"); }
    finally { setBusy(""); }
  }

  async function openEvolutionPullRequest(proposalId: Id<"evolutionProposals">) {
    setBusy(`github:${proposalId}`);
    try {
      const result = await githubEvolution({ proposalId });
      toast.success(`تم فتح Pull Request: ${result.pullRequestUrl ?? "تم تسجيل العملية"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر فتح Pull Request");
    } finally {
      setBusy("");
    }
  }

  async function ownerDecide(proposalId: Id<"evolutionProposals">, approved: boolean) {
    let reason = "";
    if (!approved) {
      const input = window.prompt("سبب رفض المالك (يُسجل في الغرفة السرية):");
      if (input === null) return;
      reason = input.trim();
      if (reason.length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    }
    setBusy(`owner:${proposalId}`);
    try {
      await owner({ proposalId, approved, reason: reason || undefined });
      toast.success(approved ? "مُنح إذن المالك — بانتظار الحاكم السيادي" : "رُفض الطلب وأُوقف قبل أي تنفيذ");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تسجيل قرار المالك"); }
    finally { setBusy(""); }
  }

  async function draftAsDeputy() {
    setBusy("deputy-draft");
    try {
      const res = await deputyDraft({ brief: deputyBrief });
      toast.success("أداة نائب المالك أنتجت طلباً منضبطاً وأرسلته إلى المحكمة");
      setDeputyBrief("");
      return res;
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر توليد الطلب"); }
    finally { setBusy(""); }
  }

  async function deputySelfReview(proposalId: Id<"evolutionProposals">, action: "amend" | "withdraw") {
    const reason = window.prompt(action === "withdraw" ? "سبب سحب نائب المالك لطلبه:" : "سبب تعديل نائب المالك لطلبه:");
    if (reason === null) return;
    if (reason.trim().length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    setBusy(`deputy:${action}:${proposalId}`);
    try {
      await deputySelf({ proposalId, action, reason: reason.trim() });
      toast.success(action === "withdraw" ? "سُحب طلب نائب المالك وسُجل" : "عُدّل طلب نائب المالك وسُجل");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تنفيذ قرار نائب المالك"); }
    finally { setBusy(""); }
  }

  async function governorSelfReview(proposalId: Id<"evolutionProposals">, action: "amend" | "withdraw") {
    const reason = window.prompt(action === "withdraw" ? "سبب سحب الحاكم لطلبه:" : "سبب تعديل الحاكم لطلبه:");
    if (reason === null) return;
    if (reason.trim().length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    setBusy(`${action}:${proposalId}`);
    try {
      await governorSelf({ proposalId, action, reason: reason.trim() });
      toast.success(action === "withdraw" ? "سُحب طلب الحاكم وسُجل في السجل" : "عُدّل طلب الحاكم وسُجل في السجل");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تنفيذ قرار الحاكم"); }
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

  async function grantMandate() {
    if (mf.ops.length === 0) { toast.error("حدد عملية واحدة على الأقل للتفويض"); return; }
    setBusy("mandate-grant");
    try {
      await grantMandateMut({
        title: mf.title,
        operations: mf.ops as ("create" | "modify" | "delete" | "construct")[],
        moduleAllowlist: mf.allowlist.split(",").map((s) => s.trim()).filter(Boolean),
        maxRisk: mf.maxRisk,
        quota: Number(mf.quota) || 0,
        expiresInHours: Number(mf.hours) || 0,
        reason: mf.reason,
      });
      toast.success("مُنح الحاكم تفويضاً حقيقياً بحدوده المسجلة — يُطبَّق فوراً على الخادم");
      setMf({ title: "", allowlist: "", quota: "3", hours: "24", ops: ["modify", "construct"], maxRisk: "medium", reason: "" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر منح التفويض"); }
    finally { setBusy(""); }
  }

  async function revokeMandateNow(mandateId: Id<"evolutionMandates">) {
    const reason = window.prompt("سبب سحب التفويض من الحاكم:");
    if (reason === null) return;
    if (reason.trim().length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    setBusy("mandate-revoke");
    try { await revokeMandateMut({ mandateId, reason: reason.trim() }); toast.success("سُحب التفويض — توقفت كل عمليات الحاكم المفوّضة فوراً"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "تعذر سحب التفويض"); }
    finally { setBusy(""); }
  }

  async function toggleFreeze(frozen: boolean) {
    if (frozen && freezeReason.trim().length < 10) { toast.error("اكتب سبب التجميد (١٠ أحرف على الأقل)"); return; }
    setBusy("freeze");
    try { await freezeMut({ frozen, reason: freezeReason.trim() }); toast.success(frozen ? "جُمّدت سلطة الحاكم فوراً (المساران معاً)" : "رُفع التجميد عن سلطة الحاكم"); setFreezeReason(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تغيير حالة التجميد"); }
    finally { setBusy(""); }
  }

  async function runMandate(proposalId: Id<"evolutionProposals">) {
    setBusy(`mandate-run:${proposalId}`);
    try { await mandateExecute({ proposalId }); toast.success("نُفّذ التعديل فعلياً على وحدة runtime بموجب تفويضك"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "تعذر التنفيذ المفوّض"); }
    finally { setBusy(""); }
  }

  async function rollback(proposalId: Id<"evolutionProposals">) {
    const reason = window.prompt("سبب نقض التنفيذ واستعادة الإصدار السابق فعلياً:");
    if (reason === null) return;
    if (reason.trim().length < 10) { toast.error("اكتب سبباً واضحاً لا يقل عن ١٠ أحرف"); return; }
    setBusy(`rollback:${proposalId}`);
    try {
      const res = await rollbackMut({ proposalId, reason: reason.trim() });
      toast.success(res.outcome === "rollback_deleted" ? "نُقض الإنشاء وحُذفت الوحدة من runtime" : "استُعيد الإصدار السابق من اللقطة المخزنة");
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر النقض"); }
    finally { setBusy(""); }
  }

  if (data === null) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">هذا المسار محجوز لمالك اللعبة ونائب المالك.</CardContent></Card>;

  const mandate = mandateState?.active ?? null;
  const govState = mandateState?.governor;
  const mandates = mandateState?.mandates ?? [];
  const isOwner = mandateState?.isOwner ?? false;
  const mandateHoursLeft = mandate ? Math.max(0, Math.round((mandate.expiresAt - Date.now()) / 3600_000)) : 0;

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
          <Button onClick={submit} disabled={busy === "create"}>اقتراح نائب المالك</Button>
          <div className="my-2 border-t" />
          <Textarea value={deputyBrief} onChange={(e) => setDeputyBrief(e.target.value)} placeholder="أداة نائب المالك: اكتب ما تريد تغييره بحرية، وسيحوّله الذكاء إلى طلب منضبط يمر بالمحكمة ثم إذن المالك" />
          <Button variant="secondary" onClick={draftAsDeputy} disabled={busy === "deputy-draft"}>توليد طلب نائب المالك بالأداة الذكية</Button>
          <div className="my-2 border-t" />
          <p className="text-xs font-semibold text-muted-foreground">أداة الحاكم السيادي — يعدّل اللعبة كما يريد، وبعد إذنك الصريح فقط</p>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={govOp} onChange={(e) => setGovOp(e.target.value as "create" | "modify" | "delete" | "construct")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="modify">تعديل وحدة runtime قائمة</option>
              <option value="construct">إعادة بناء وحدة قائمة</option>
              <option value="delete">حذف وحدة من اللعبة</option>
              <option value="create">إنشاء وحدة جديدة</option>
            </select>
            <Input list="evolution-modules" value={govTarget} onChange={(e) => setGovTarget(e.target.value)} placeholder="مفتاح الوحدة الحقيقية snake_case" />
            <datalist id="evolution-modules">{(modules ?? []).map((m: any) => <option key={m.key} value={m.key}>{m.name}</option>)}</datalist>
          </div>
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="تكليف الحاكم: اكتب بحرية ما تريد تغييره، وستحوّله الأداة إلى طلب منضبط على وحدة حقيقية" />
          <Button variant="outline" onClick={proposeAsGovernor} disabled={busy === "governor-propose"}>توليد طلب الحاكم بالأداة الحقيقية</Button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader><CardTitle className="flex items-center gap-2 text-amber-700">مخطط التعديلات عالية الأثر</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">للإنتاج أو الصلاحيات أو قاعدة البيانات أو API أو main: إعداد ومراجعة فقط، ولا يوجد تنفيذ مباشر.</p>
          <div className="grid gap-3 md:grid-cols-2"><Input value={impact.title} onChange={(e) => setImpact({ ...impact, title: e.target.value })} placeholder="عنوان طلب الأثر العالي" /><Input value={impact.targetKey} onChange={(e) => setImpact({ ...impact, targetKey: e.target.value })} placeholder="المفتاح أو النظام المتأثر" /></div>
          <Textarea value={impact.summary} onChange={(e) => setImpact({ ...impact, summary: e.target.value })} placeholder="ملخص التغيير المطلوب" />
          <Textarea value={impact.rationale} onChange={(e) => setImpact({ ...impact, rationale: e.target.value })}                    placeholder="سبب الحاجة والأثر المتوقع" />
          <Textarea value={impact.rollback} onChange={(e) => setImpact({ ...impact, rollback: e.target.value })} placeholder="خطة rollback التفصيلية" />
          <Button onClick={submitHighImpactPlan} disabled={busy === "impact"} variant="outline">إرسال مخطط الأثر العالي إلى المحكمة</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>وحدات اللعبة الحقيقية في runtime</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {modules === null && <p className="text-xs text-muted-foreground">هذا المسار محجوز لمالك اللعبة ونائب المالك.</p>}
          {modules?.length === 0 && <p className="text-xs text-muted-foreground">لا توجد وحدات runtime بعد — أنشئ أول وحدة بأداة الحاكم بعد اكتمال التسلسل.</p>}
          {(modules ?? []).map((m: any) => <div key={m.key} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span><b>{m.name}</b> <span className="font-mono text-xs text-muted-foreground">{m.key}</span></span><span className="text-xs text-muted-foreground">{m.kind} · v{m.version}</span></div>)}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>دورة القرارات</CardTitle></CardHeader><CardContent className="space-y-3">
          {data?.proposals.map((p: any) => <div key={p._id} className="rounded-xl border p-4"><div className="flex justify-between gap-2"><b>{p.title}</b><Badge variant="outline">{p.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">مقترح {p.proposerRole}: {p.summary}</p>{p.courtSummary && <p className="mt-2 text-xs text-emerald-700">المجلس: {p.courtSummary}</p>}{p.courtConditions?.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-amber-700">{p.courtConditions.map((c: string) => <li key={c}>{c}</li>)}</ul>}{p.courtReviews && <details className="mt-2 text-xs"><summary>مراجعة {p.courtReviews.length} وحدة ذكاء</summary><div className="mt-2 max-h-52 space-y-1 overflow-auto">{p.courtReviews.map((r: any) => <p key={r.unit} className="rounded border p-2"><b>{r.name}</b> — {r.vote} — {r.provider}/{r.model}<br />{r.opinion}</p>)}</div></details>}          {isRuleModuleKey(p.targetKey) && liveRulesData && (() => {
            const rows = previewRuleConfig(p.targetKey, p.requestedModule.config, liveRulesData.rules);
            return (
              <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
                <p className="text-[11px] font-semibold">تأثير حقيقي على اللعبة — {p.targetKey}</p>
                <div className="mt-1 space-y-0.5">
                  {rows.map((row) => (
                    <p key={row.path} className="text-[11px]">
                      {row.label}: {row.from} → <b>{Number.isFinite(row.to) ? row.to : "قيمة غير صالحة"}</b>
                      {row.status === "out_of_bounds" && <span className="text-rose-600"> (خارج الحدود — لن تُنفذ)</span>}
                      {row.status === "invalid" && <span className="text-rose-600"> (غير رقمية)</span>}
                    </p>
                  ))}
                  {rows.length === 0 && <p className="text-[11px] text-muted-foreground">لا تغيير في القوانين الحيّة</p>}
                </div>
              </div>
            );
          })()}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.status === "court_review" && <Button size="sm" onClick={() => step("court", p._id)} disabled={busy === `court:${p._id}`}><Radio className="size-4" />انعقاد المجلس</Button>}
            {p.status === "court_conditional" && <Button size="sm" variant="outline" onClick={() => satisfy(p._id)} disabled={busy === `conditions:${p._id}`}>استيفاء شروط المحكمة</Button>}
            {p.status === "awaiting_deputy" && <Button size="sm" onClick={() => step("deputy", p._id)} disabled={busy === `deputy:${p._id}`}><Bot className="size-4" />قرار نائب المالك</Button>}
            {p.status === "awaiting_owner" && p.proposerRole === "sovereign_governor" && <><Button size="sm" onClick={() => ownerGovernorDecide(p._id, true)} disabled={busy === `owner-gov:${p._id}`}><ShieldCheck className="size-4" />إذن المالك لطلب الحاكم</Button><Button size="sm" variant="destructive" onClick={() => ownerGovernorDecide(p._id, false)} disabled={busy === `owner-gov:${p._id}`}>رفض المالك لطلب الحاكم</Button></>}
            {p.status === "awaiting_owner" && p.proposerRole !== "sovereign_governor" && <><Button size="sm" onClick={() => ownerDecide(p._id, true)} disabled={busy === `owner:${p._id}`}><ShieldCheck className="size-4" />إذن المالك</Button><Button size="sm" variant="destructive" onClick={() => ownerDecide(p._id, false)} disabled={busy === `owner:${p._id}`}>رفض المالك</Button></>}
            {p.proposerRole === "sovereign_governor" && (p.status === "court_review" || p.status === "court_conditional") && <><Button size="sm" variant="outline" onClick={() => governorSelfReview(p._id, "amend")} disabled={busy === `amend:${p._id}`}>تعديل طلب الحاكم</Button><Button size="sm" variant="outline" onClick={() => governorSelfReview(p._id, "withdraw")} disabled={busy === `withdraw:${p._id}`}>سحب طلب الحاكم</Button></>}
            {p.proposerRole === "deputy_owner" && (p.status === "court_review" || p.status === "court_conditional") && <><Button size="sm" variant="outline" onClick={() => deputySelfReview(p._id, "amend")} disabled={busy === `deputy:amend:${p._id}`}>تعديل طلب نائب المالك</Button><Button size="sm" variant="outline" onClick={() => deputySelfReview(p._id, "withdraw")} disabled={busy === `deputy:withdraw:${p._id}`}>سحب طلب نائب المالك</Button></>}
            {p.status === "awaiting_governor" && <Button size="sm" onClick={() => step("governor", p._id)} disabled={busy === `governor:${p._id}`}><ShieldCheck className="size-4" />قرار الحاكم</Button>}
            {p.status === "joint_approved" && <Button size="sm" onClick={() => step("run", p._id)} disabled={busy === `run:${p._id}`}><Play className="size-4" />تشغيل الأداة</Button>}
            {p.status === "joint_approved" && <Button size="sm" variant="outline" onClick={() => openEvolutionPullRequest(p._id)} disabled={busy === `github:${p._id}`}><GitBranch className="size-4" />فتح Pull Request آمن</Button>}
            {p.status === "mandate_approved" && <Button size="sm" onClick={() => runMandate(p._id)} disabled={busy === `mandate-run:${p._id}`}><Power className="size-4" />تنفيذ الحاكم بموجب تفويضك</Button>}
            {p.status === "executed" && !p.revertedAt && <Button size="sm" variant="outline" onClick={() => rollback(p._id)} disabled={busy === `rollback:${p._id}`}><Undo2 className="size-4" />نقض واسترجاع الإصدار السابق</Button>}
            {p.revertedAt && <Badge variant="outline" className="border-rose-500/50 text-rose-600">منقوض — استُعيد الإصدار السابق</Badge>}
            {p.mandateId && <Badge variant="outline" className="border-amber-500/50 text-amber-700">مفوّض</Badge>}
          </div></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="size-5" />سجل الغرفة السرية</CardTitle></CardHeader><CardContent className="max-h-[560px] space-y-2 overflow-auto">
          {data?.audit.map((a: any) => <div key={a._id} className="rounded-lg border bg-muted/20 p-3 text-xs"><div className="flex justify-between"><b>{a.action}</b><span>{new Date(a.at).toLocaleString("ar-EG")}</span></div><p className="mt-1 text-muted-foreground">{a.actor}: {a.detail}</p></div>)}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>عمليات موثّقة</CardTitle></CardHeader><CardContent className="space-y-2">{data?.operations.map((o: any) => <div key={o._id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><CheckCircle2 className="size-4 text-emerald-600" /><b>{o.operation}</b><span>{o.targetKey}</span><span className="ms-auto text-xs text-muted-foreground">{o.provider}/{o.model} · {o.tokensIn}+{o.tokensOut} tokens</span></div>)}</CardContent></Card>

      {/* 🕊️ سلطة الحاكم السيادية: تفويض حقيقي + تجميد فوري + عدّادات من قاعدة البيانات */}
      <Card className="border-amber-500/40">
        <CardHeader><CardTitle className="flex items-center gap-2"><Power className="size-5 text-amber-600" />سلطة الحاكم السيادية — تفويض، تجميد، ونقض</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            {[["تنفيذات كلية", govState?.executions ?? 0], ["بموجب التفويض", govState?.mandateExecutions ?? 0], ["عبر الغرفة السرية", govState?.chamberExecutions ?? 0], ["عمليات نقض", govState?.rollbacks ?? 0]].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-muted-foreground">{label}</p>
                <p className="text-lg font-black">{value}</p>
              </div>
            ))}
          </div>

          <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-xs ${govState?.frozen ? "border-rose-500/50 bg-rose-500/10" : "border-emerald-500/40 bg-emerald-500/5"}`}>
            <ShieldCheck className="size-4" />
            <span className="font-bold">{govState?.frozen ? `سلطة الحاكم مجمّدة — ${govState.frozenReason}` : "سلطة الحاكم فعّالة"}</span>
            {isOwner && (
              <div className="ms-auto flex flex-wrap items-center gap-2">
                <Input value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="سبب التجميد (١٠ أحرف)" className="h-8 w-56 text-xs" />
                {govState?.frozen
                  ? <Button size="sm" variant="outline" onClick={() => toggleFreeze(false)} disabled={busy === "freeze"}>رفع التجميد</Button>
                  : <Button size="sm" variant="destructive" onClick={() => toggleFreeze(true)} disabled={busy === "freeze"}><Power className="size-4" />تجميد فوري</Button>}
              </div>
            )}
          </div>

          {mandate ? (
            <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{mandate.title}</b>
                <Badge variant="outline">{mandate.expired ? "منتهٍ" : `ينتهي بعد ${mandateHoursLeft} ساعة`}</Badge>
                <Badge variant="outline">رصيد متبقٍ {mandate.remaining}/{mandate.quota}</Badge>
                <Badge variant="outline">سقف الخطر: {mandate.maxRisk}</Badge>
                <Badge variant="outline">عمليات: {mandate.operations.join(" / ")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">القائمة البيضاء: {mandate.moduleAllowlist.length > 0 ? mandate.moduleAllowlist.join(", ") : "كل وحدات runtime المسموحة (عدا الأهداف المحمية)"}</p>
              <p className="text-xs text-muted-foreground">سبب المنح: {mandate.reason}</p>
              {isOwner && <Button size="sm" variant="destructive" onClick={() => revokeMandateNow(mandate._id)} disabled={busy === "mandate-revoke"}>سحب التفويض فوراً</Button>}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              لا يوجد تفويض سارٍ — كل طلب من الحاكم يمر بالتسلسل الكامل مع إذنك الفردي لكل تعديل.
            </p>
          )}

          {isOwner && (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-xs font-semibold text-muted-foreground">منح تفويض جديد للحاكم — لا يشمل الإنتاج ولا الكود ولا المفاتيح ولا قاعدة البيانات أبداً</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={mf.title} onChange={(e) => setMf({ ...mf, title: e.target.value })} placeholder="عنوان التفويض (مثال: مرسوم ضبط الوحدات الأسبوعي)" />
                <Input value={mf.allowlist} onChange={(e) => setMf({ ...mf, allowlist: e.target.value })} placeholder="مفاتيح وحدات مسموحة، بفاصلة (فارغة = الكل عدا المحمية)" />
                <Input type="number" value={mf.quota} onChange={(e) => setMf({ ...mf, quota: e.target.value })} placeholder="رصيد التنفيذ (1–50)" />
                <Input type="number" value={mf.hours} onChange={(e) => setMf({ ...mf, hours: e.target.value })} placeholder="المدة بالساعات (1–720)" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {MANDATE_OPS.map((op) => (
                  <label key={op} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={mf.ops.includes(op)} onChange={() => setMf({ ...mf, ops: mf.ops.includes(op) ? mf.ops.filter((x) => x !== op) : [...mf.ops, op] })} />
                    {op}
                  </label>
                ))}
                <select value={mf.maxRisk} onChange={(e) => setMf({ ...mf, maxRisk: e.target.value as MandateRisk })} className="ms-auto h-8 rounded-md border border-input bg-background px-2 text-xs">
                  <option value="low">أقصى خطر: منخفض</option>
                  <option value="medium">أقصى خطر: متوسط</option>
                  <option value="critical">أقصى خطر: حرج</option>
                </select>
              </div>
              <Textarea value={mf.reason} onChange={(e) => setMf({ ...mf, reason: e.target.value })} placeholder="سبب منح التفويض (٢٠ حرفاً على الأقل) — يُسجَّل في الغرفة السرية" />
              <Button onClick={grantMandate} disabled={busy === "mandate-grant"}><Power className="size-4" />منح التفويض</Button>
            </div>
          )}

          {mandates.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">سجل التفويضات ({mandates.length})</summary>
              <div className="mt-2 space-y-1">
                {mandates.map((m: any) => (
                  <p key={m._id} className="rounded border p-2">
                    <b>{m.title}</b> — {m.status} — نُفّذ {m.usedCount}/{m.quota} — ينتهي {new Date(m.expiresAt).toLocaleString("ar-EG")}
                    {m.revokeReason ? ` — السبب: ${m.revokeReason}` : ""}
                  </p>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* ⚖️ القوانين الحيّة — ما يعدّله الحاكم يؤثر فعلياً على نتائج اللاعبين */}
      <Card className="border-emerald-500/40">
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-emerald-600" />القوانين الحيّة — تأثير الحاكم الحقيقي على اللعبة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            يقرأ الخادم هذه القيم فعلياً عند تسجيل النقاط، ومنح الخبرة، ومنح المكافأة اليومية.
            إن لم توجد الوحدة فالقيمة المعروضة هي قيمة اللعبة الافتراضية، وإن وُجدت فالحاكم قد عدّلها فعلاً.
          </p>
          {!liveRulesData ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">لوحة القوانين الحيّة متاحة للمالك ونائب المالك.</p>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                {RULE_MODULE_KEYS.map((key) => {
                  const surface = liveRulesData.surfaces.find((s: any) => s.key === key);
                  const defs = ruleSurfaceFor(key) ?? [];
                  return (
                    <div key={key} className="rounded-xl border p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <b className="font-mono text-xs">{key}</b>
                        <Badge variant="outline">{surface?.active ? `نشط v${surface.version}` : surface?.exists ? "معطّل" : "غير موجود"}</Badge>
                      </div>
                      <div className="space-y-1">
                        {defs.map((def) => {
                          const current = readLiveValue(liveRulesData.rules, def.path);
                          const changed = current !== def.defaultValue;
                          return (
                            <div key={def.path} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate text-muted-foreground">{def.label}</span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <b>{current}</b>
                                {changed && <Badge variant="outline" className="border-emerald-500/50 text-emerald-700">معدّل (الأصل {def.defaultValue})</Badge>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">وحدات مؤثرة الآن: {liveRulesData.applied.length > 0 ? liveRulesData.applied.join(", ") : "لا شيء — اللعبة على قيمها الافتراضية"}</Badge>
                {liveRulesData.rejected.length > 0 && <Badge variant="outline" className="border-rose-500/50 text-rose-600">قيم مرفوضة: {liveRulesData.rejected.length} — لم تُطبَّق على اللعبة</Badge>}
              </div>
              {liveRulesData.rejected.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">تفاصيل القيم المرفوضة</summary>
                  <div className="mt-2 space-y-1">
                    {liveRulesData.rejected.map((row: any, index: number) => (
                      <p key={`${row.moduleKey}-${row.field}-${index}`} className="rounded border border-rose-500/30 p-2">
                        <b className="font-mono">{row.moduleKey}</b> · {row.field} — {row.reason}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
