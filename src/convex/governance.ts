"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import { AI_REGISTRY } from "./aiRegistry";
import { callLlmDetailed } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

const COURT_UNITS = AI_REGISTRY.filter((x) => ["unit_questions", "unit_guardian", "unit_reports", "governor", "forge"].includes(x.key));
const proposalText = (p: any) => JSON.stringify({ title: p.title, operation: p.operation, targetKey: p.targetKey, summary: p.summary, rationale: p.rationale, risk: p.risk, requestedModule: p.requestedModule });

async function actor(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("المستخدم غير موجود");
  const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
  if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) throw new Error("غير مصرح");
  return { name: user.name ?? "مسؤول" };
}

export const conveneCourt = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }) => {
    const who = await actor(ctx);
    const p = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!p || p.status !== "court_review") throw new Error("المقترح غير موجود أو ليس قيد مراجعة المجلس");
    if (COURT_UNITS.length < 3) throw new Error("تشكل المجلس غير مكتمل");
    const reviews: Array<{ unit: string; name: string; opinion: string; vote: string; latencyMs: number }> = [];
    for (const unit of COURT_UNITS) {
      const result = await callLlmDetailed({
        messages: [
          { role: "system", content: `أنت ${unit.name} عضو حقيقي في مجلس العقول. احكم باستقلالية. اختم بـ VOTE: APPROVE أو VOTE: CONDITIONAL أو VOTE: REJECT ثم جملة عربية.` },
          { role: "user", content: `وظفتك: ${unit.purpose}\nالمقترح:\n${proposalText(p)}` },
        ], maxTokens: 260, temperature: 0.25, label: `Court ${unit.key}`, jsonMode: false, task: "other",
      });
      const vote = /VOTE:\s*APPROVE/i.test(result.text) ? "approve" : /VOTE:\s*CONDITIONAL/i.test(result.text) ? "conditional" : /VOTE:\s*REJECT/i.test(result.text) ? "reject" : "abstain";
      reviews.push({ unit: unit.key, name: unit.name, opinion: result.text.slice(0, 900), vote, latencyMs: result.latencyMs });
    }
    const approvals = reviews.filter((r) => r.vote === "approve").length;
    const conditionals = reviews.filter((r) => r.vote === "conditional").length;
    const verdict = approvals >= 3 ? "approved" : "rejected";
    const summary = `${approvals} موافقة، ${conditionals} مشروطة، ${reviews.length - approvals - conditionals} رفض أو امتناع.`;
    await ctx.runMutation(internal.governanceStore.recordCourtDecision, { proposalId, verdict, summary, reviews, actorName: who.name });
    return { verdict, summary, reviews };
  },
});

export const deputyDecide = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }) => {
    const p = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!p || p.status !== "awaiting_deputy") throw new Error("المقترح لم يحظَ بموافقة المجلس");
    const r = await callLlmDetailed({ messages: [
      { role: "system", content: "أنت نائب المالك. راجع قرار المجلس. لا توافق إلا إذا كان الأثر واضحاً والتشغيل قابلاً للتحقق. أجب DECISION: APPROVE أو DECISION: REJECT ثم سبب." },
      { role: "user", content: `المجلس: ${p.courtSummary}\nالمراجعات: ${JSON.stringify(p.courtReviews)}\nالمقترح: ${proposalText(p)}` },
    ], maxTokens: 350, temperature: 0.2, label: "Deputy Governance", jsonMode: false, task: "other" });
    if (!/DECISION:\s*APPROVE/i.test(r.text)) throw new Error(`رفض نائب المالك: ${r.text.slice(0, 250)}`);
    await ctx.runMutation(internal.governanceStore.recordDeputyApproval, { proposalId });
    return { approved: true, reason: r.text };
  },
});

export const governorDecide = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }) => {
    const p = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!p || p.status !== "awaiting_governor" || !p.deputyApprovedAt) throw new Error("يلزم موافقة نائب المالك أولاً");
    const r = await callLlmDetailed({ messages: [
      { role: "system", content: "أنت الحاكم السيادي. وافق فقط إذا كان التسلسل صحيحاً والأثر واضحاً والعملية قابلة للتدقيق. أجب DECISION: APPROVE أو DECISION: REJECT ثم سبب." },
      { role: "user", content: `المجلس: ${p.courtSummary}\nنائب المالك وافق في ${new Date(p.deputyApprovedAt).toISOString()}\nالمقترح: ${proposalText(p)}` },
    ], maxTokens: 350, temperature: 0.15, label: "Sovereign Governor Governance", jsonMode: false, task: "other" });
    if (!/DECISION:\s*APPROVE/i.test(r.text)) throw new Error(`رفض الحاكم السيادي: ${r.text.slice(0, 250)}`);
    await ctx.runMutation(internal.governanceStore.recordGovernorApproval, { proposalId, reason: r.text.slice(0, 1200) });
    return { approved: true, chamberOpened: true, reason: r.text };
  },
});

export const runInstrument = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const who = await actor(ctx);
    const p: any = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!p || p.status !== "joint_approved" || !p.deputyApprovedAt || !p.governorApprovedAt || !p.chamberOpenedAt) throw new Error("الغرفة السرية مغلقة: المسار غير مكتمل");
    await ctx.runMutation(internal.governanceStore.markExecuting, { proposalId });
    try {
      await ensureAiRuntime(ctx);
      const r = await callLlmDetailed({ messages: [
        { role: "system", content: "أنت أداة التطوير. أعد JSON فقط: {\"name\":\"...\",\"description\":\"...\",\"kind\":\"feature|content|rule|integration\",\"config\":{}}. لا تدّع تعديل كود غير قابل للتطبيق." },
        { role: "user", content: `العملية المعتمدة: ${proposalText(p)}\nأعد الإصدار النهائي الآمن والقابل للتدقيق.` },
      ], maxTokens: 700, temperature: 0.25, label: "Secret Chamber Instrument", jsonMode: true, task: "other" });
      const match = r.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("رد API لم يحتوِ على JSON صالح");
      const spec = JSON.parse(match[0]);
      const kind = ["feature", "content", "rule", "integration"].includes(spec.kind) ? spec.kind : "feature";
      const result: any = await ctx.runMutation(internal.governanceStore.applyInstrument, { proposalId, name: String(spec.name || p.requestedModule.name).slice(0, 120), description: String(spec.description || p.requestedModule.description).slice(0, 1200), kind, config: JSON.stringify(spec.config ?? JSON.parse(p.requestedModule.config)), provider: r.provider, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, evidence: r.text.slice(0, 3000), actorName: who.name });
      return { ok: true, operationId: result.operationId, provider: r.provider, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut };
    } catch (e) {
      const error = e instanceof Error ? e.message : "فشل غير معروف";
      await ctx.runMutation(internal.governanceStore.markFailed, { proposalId, error });
      throw new Error(`توقفت الأداة: ${error}`);
    }
  },
});
