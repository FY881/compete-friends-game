"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import { AI_REGISTRY } from "./aiRegistry";
import { callLlmDetailed } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { deriveCourtVerdict } from "./governanceCore";

const COURT_UNITS = [...AI_REGISTRY];
const proposalText = (p: any) => JSON.stringify({
  title: p.title,
  operation: p.operation,
  targetKey: p.targetKey,
  summary: p.summary,
  rationale: p.rationale,
  risk: p.risk,
  requestedModule: p.requestedModule,
});

async function requireAuthority(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("المستخدم غير موجود");
  const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
  if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) throw new Error("غير مصرح");
  return { userId, name: user.name ?? "مسؤول" };
}

export const conveneCourt = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const who = await requireAuthority(ctx);
    const p = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!p || p.status !== "court_review") throw new Error("المقترح غير موجود أو خارج مرحلة المراجعة");
    if (COURT_UNITS.length !== AI_REGISTRY.length || COURT_UNITS.length < 3) throw new Error("تشكل المحكمة غير مكتمل");
    await ctx.runMutation(internal.governanceStore.claimCourt, { proposalId, actorName: who.name });
    try {
      await ensureAiRuntime(ctx);
      const settled = await Promise.all(COURT_UNITS.map(async (unit) => {
        const result = await callLlmDetailed({
          messages: [
            { role: "system", content: `أنت ${unit.name}، عضو في محكمة كل أنظمة اللعبة. اختم صوتك بأحد: VOTE: APPROVE أو VOTE: CONDITIONAL أو VOTE: REJECT، ثم حجة قصيرة محددة.` },
            { role: "user", content: `الاختصاص: ${unit.purpose}\nالمقترح:\n${proposalText(p)}` },
          ],
          maxTokens: 180,
          temperature: 0.25,
          label: `Court ${unit.key}`,
          jsonMode: false,
          task: "other",
        });
        const vote = /VOTE:\s*APPROVE/i.test(result.text)
          ? "approve"
          : /VOTE:\s*CONDITIONAL/i.test(result.text)
            ? "conditional"
            : /VOTE:\s*REJECT/i.test(result.text)
              ? "reject"
              : "abstain";
        return {
          unit: unit.key,
          name: unit.name,
          purpose: unit.purpose,
          opinion: result.text.slice(0, 900),
          vote,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
        };
      }));
      const order = new Map(COURT_UNITS.map((unit, index) => [unit.key, index]));
      const reviews = settled.sort((a, b) => (order.get(a.unit) ?? 0) - (order.get(b.unit) ?? 0));
      const approvals = reviews.filter((review) => review.vote === "approve").length;
      const conditionals = reviews.filter((review) => review.vote === "conditional").length;
      const verdict = deriveCourtVerdict(reviews.map((review) => review.vote as "approve" | "conditional" | "reject" | "abstain"), COURT_UNITS.length);
      const summary = `${approvals} موافقة، ${conditionals} مشروطة، ${reviews.length - approvals - conditionals} رفض أو امتناع من ${reviews.length} وحدة مسجلة.`;
      let conditions: string[] | undefined;
      if (verdict === "conditional") {
        const synthesis = await callLlmDetailed({
          messages: [
            { role: "system", content: "أنت رئيس المحكمة. استخرج شروط القبول الحقيقية فقط. أعد JSON بالصيغة {\"conditions\":[\"...\"]} ولا تضف شروطاً." },
            { role: "user", content: `القرار: ${summary}\nالمراجعات: ${JSON.stringify(reviews)}` },
          ],
          maxTokens: 500,
          temperature: 0.1,
          label: "Court Conditions",
          jsonMode: true,
          task: "other",
        });
        const match = synthesis.text.match(/\{[\s\S]*\}/);
        conditions = match ? JSON.parse(match[0]).conditions : [];
        if (!Array.isArray(conditions) || conditions.length === 0) throw new Error("المحكمة لم تزود شروط القبول؛ توقف المسار");
      }
      await ctx.runMutation(internal.governanceStore.recordCourtDecision, { proposalId, verdict, summary, reviews, conditions, actorName: who.name });
      return { verdict, summary, reviews, conditions: conditions ?? [] };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "فشل غير معروف";
      await ctx.runMutation(internal.governanceStore.failCourt, { proposalId, error: detail });
      throw error;
    }
  },
});

export const governorPropose = action({
  args: { brief: v.string() },
  handler: async (ctx, { brief }): Promise<any> => {
    const who = await requireAuthority(ctx);
    if (brief.trim().length < 30) throw new Error("التكليف لا يصف التعديل الجوهري بوضوح");
    await ensureAiRuntime(ctx);
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت الحاكم السيادي. اقترح تعديلاً جوهرياً آمناً. أعد JSON فقط يحتوي title وoperation وtargetKey وsummary وrationale وrisk وrequestedModule." },
        { role: "user", content: brief },
      ],
      maxTokens: 900,
      temperature: 0.25,
      label: "Sovereign Governor Proposal",
      jsonMode: true,
      task: "other",
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("الحاكم لم يخرج مقترحاً صالحاً");
    const spec = JSON.parse(match[0]);
    const operation = ["create", "modify", "delete", "construct"].includes(spec.operation) ? spec.operation : "construct";
    const risk = ["low", "medium", "critical"].includes(spec.risk) ? spec.risk : "medium";
    return await ctx.runMutation(internal.governanceStore.insertGovernorProposal, {
      authorId: who.userId,
      title: String(spec.title),
      operation,
      targetKey: String(spec.targetKey),
      summary: String(spec.summary),
      rationale: String(spec.rationale),
      risk,
      requestedModule: {
        name: String(spec.requestedModule.name),
        description: String(spec.requestedModule.description),
        kind: String(spec.requestedModule.kind),
        config: JSON.stringify(spec.requestedModule.config),
      },
    });
  },
});

export const resolveConditions = action({
  args: { proposalId: v.id("evolutionProposals"), evidence: v.string() },
  handler: async (ctx, { proposalId, evidence }): Promise<any> => {
    await requireAuthority(ctx);
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "court_conditional") throw new Error("لا يوجد قرار مشروط");
    if (evidence.trim().length < 20) throw new Error("دليل استيفاء الشروط غير كافٍ");
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت لجنة تحقق شروط المحكمة. وافق فقط إذا استوفى الدليل كل الشروط. اختم بـ CONDITIONS: APPROVE أو CONDITIONS: REJECT." },
        { role: "user", content: `الشروط: ${JSON.stringify(proposal.courtConditions)}\nالدليل: ${evidence}` },
      ],
      maxTokens: 300,
      temperature: 0.1,
      label: "Court Conditions Review",
      jsonMode: false,
      task: "other",
    });
    const approved = /CONDITIONS:\s*APPROVE/i.test(result.text);
    const record = `${evidence}\n${result.text}`.slice(0, 3000);
    await ctx.runMutation(internal.governanceStore.resolveCourtConditions, { proposalId, evidence: record, approved });
    return { approved, review: result.text };
  },
});

export const deputyDecide = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "awaiting_deputy" || proposal.courtVerdict !== "approved") throw new Error("المقترح لم يحظَ بموافقة المحكمة");
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت نائب المالك. راجع قرار المحكمة. لا توافق إلا إذا كان الأثر واضحاً والتشغيل قابلاً للتحقق. أجب DECISION: APPROVE أو DECISION: REJECT ثم سبب." },
        { role: "user", content: `المجلس: ${proposal.courtSummary}\nالمراجعات: ${JSON.stringify(proposal.courtReviews)}\nالمقترح: ${proposalText(proposal)}` },
      ],
      maxTokens: 350,
      temperature: 0.2,
      label: "Deputy Governance",
      jsonMode: false,
      task: "other",
    });
    if (!/DECISION:\s*APPROVE/i.test(result.text)) {
      await ctx.runMutation(internal.governanceStore.recordRejection, { proposalId, role: "deputy_owner", reason: result.text.slice(0, 3000) });
      throw new Error(`رفض نائب المالك: ${result.text.slice(0, 250)}`);
    }
    await ctx.runMutation(internal.governanceStore.recordDeputyApproval, { proposalId, reason: result.text.slice(0, 3000) });
    return { approved: true, reason: result.text };
  },
});

export const governorDecide = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "awaiting_governor" || proposal.courtVerdict !== "approved" || !proposal.deputyApprovedAt) throw new Error("يلزم موافقة نائب المالك أولاً");
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت الحاكم السيادي. وافق فقط إذا كان التسلسل صحيحاً والأثر واضحاً والعملية قابلة للتدقيق. أجب DECISION: APPROVE أو DECISION: REJECT ثم سبب." },
        { role: "user", content: `المجلس: ${proposal.courtSummary}\nنائب المالك وافق في ${new Date(proposal.deputyApprovedAt).toISOString()}\nالمقترح: ${proposalText(proposal)}` },
      ],
      maxTokens: 350,
      temperature: 0.15,
      label: "Sovereign Governor Governance",
      jsonMode: false,
      task: "other",
    });
    if (!/DECISION:\s*APPROVE/i.test(result.text)) {
      await ctx.runMutation(internal.governanceStore.recordRejection, { proposalId, role: "sovereign_governor", reason: result.text.slice(0, 3000) });
      throw new Error(`رفض الحاكم السيادي: ${result.text.slice(0, 250)}`);
    }
    await ctx.runMutation(internal.governanceStore.recordGovernorApproval, { proposalId, reason: result.text.slice(0, 3000) });
    return { approved: true, chamberOpened: true, reason: result.text };
  },
});

export const runInstrument = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const who = await requireAuthority(ctx);
    const proposal: any = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "joint_approved" || proposal.courtVerdict !== "approved" || !proposal.deputyApprovedAt || !proposal.governorApprovedAt || !proposal.chamberOpenedAt) throw new Error("الغرفة السرية مغلقة: المسار غير مكتمل");
    await ctx.runMutation(internal.governanceStore.markExecuting, { proposalId });
    try {
      await ensureAiRuntime(ctx);
      const result = await callLlmDetailed({
        messages: [
          { role: "system", content: "أنت أداة التطوير. أعد JSON فقط: {\"name\":\"...\",\"description\":\"...\",\"kind\":\"feature|content|rule|integration\",\"config\":{}}. لا تدّع تعديل كود غير قابل للتطبيق." },
          { role: "user", content: `العملية المعتمدة: ${proposalText(proposal)}\nأعد الإصدار النهائي الآمن والقابل للتدقيق.` },
        ],
        maxTokens: 700,
        temperature: 0.25,
        label: "Secret Chamber Instrument",
        jsonMode: true,
        task: "other",
      });
      const match = result.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("رد API لم يحتوِ على JSON صالح");
      const spec = JSON.parse(match[0]);
      const kind = ["feature", "content", "rule", "integration"].includes(spec.kind) ? spec.kind : "feature";
      const applied = await ctx.runMutation(internal.governanceStore.applyInstrument, {
        proposalId,
        name: String(spec.name || proposal.requestedModule.name).slice(0, 120),
        description: String(spec.description || proposal.requestedModule.description).slice(0, 1200),
        kind,
        config: JSON.stringify(spec.config ?? JSON.parse(proposal.requestedModule.config)),
        provider: result.provider,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        evidence: result.text.slice(0, 3000),
        actorName: who.name,
      });
      return { ok: true, operationId: applied.operationId, provider: result.provider, model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "فشل غير معروف";
      await ctx.runMutation(internal.governanceStore.markFailed, { proposalId, error: detail });
      throw new Error(`توقفت الأداة: ${detail}`);
    }
  },
});
