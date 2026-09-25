"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { AI_REGISTRY } from "./aiRegistry";
import { callLlmDetailed } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { deriveCourtVerdict, governorOwnerGrantGate, governorToolTargetGate, mandateGate, protectedTargetGate } from "./governanceCore";

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
  const actorInfo = await ctx.runQuery(internal.governanceStore.getGovernanceActor, { userId });
  if (!actorInfo) throw new Error("المستخدم غير موجود");
  if (!actorInfo.isOwner && !actorInfo.isDeputy) throw new Error("غير مصرح");
  return { userId, name: actorInfo.name };
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

/**
 * 🛠️ أداة الحاكم السيادي الحقيقية المدمجة فيه:
 * يكتب تكليفه الحر ويختار عملية فعلية على وحدة runtime قائمة فعلاً (تعديل/حذف/
 * بناء) أو إنشاء وحدة جديدة. الأداة تتحقق من الوحدة الحقيقية عبر الخادم، ثم
 * تحوّل التكليف إلى Proposal منضبط يمر بالمحكمة ← نائب المالك ← إذن المالك ←
 * الحاكم ← الغرفة ← التنفيذ. لا تعدّل شيئاً مباشرة ولا تتجاوز بوابتك.
 */
export const governorPropose = action({
  args: {
    brief: v.string(),
    operation: v.optional(v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct"))),
    targetKey: v.optional(v.string()),
  },
  handler: async (ctx, { brief, operation: requestedOperation, targetKey: requestedTarget }): Promise<any> => {
    const who = await requireAuthority(ctx);
    if (brief.trim().length < 30) throw new Error("التكليف لا يصف التعديل الجوهري بوضوح");
    await ensureAiRuntime(ctx);
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت الحاكم السيادي. اقترح تعديلاً جوهرياً آمناً. أعد JSON فقط يحتوي title وoperation (create|modify|delete|construct) وtargetKey (snake_case) وsummary وrationale وrisk (low|medium|critical) وrequestedModule{name,description,kind,config}.config كائن JSON." },
        { role: "user", content: requestedOperation ? `العملية المطلوبة: ${requestedOperation}\nالوحدة المستهدفة: ${requestedTarget ?? "(اخترها بنفسك)"}\nالتكليف: ${brief}` : brief },
      ],
      maxTokens: 900,
      temperature: 0.25,
      label: "Sovereign Governor Tool",
      jsonMode: true,
      task: "other",
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("الحاكم لم يخرج مقترحاً صالحاً");
    const spec = JSON.parse(match[0]);
    const opList = ["create", "modify", "delete", "construct"] as const;
    const operation: "create" | "modify" | "delete" | "construct" = requestedOperation ?? (opList.includes(spec.operation) ? spec.operation : "construct");
    const risk = ["low", "medium", "critical"].includes(spec.risk) ? spec.risk : "medium";
    const targetKey = String(requestedTarget ?? spec.targetKey ?? "governor_change").slice(0, 80);
    // تحقق واقعي: العملية يجب أن تنطبق على وحدة runtime حقيقية.
    const existing = await ctx.runQuery(internal.governanceStore.getEvolutionModule, { key: targetKey });
    const targetGate = governorToolTargetGate(operation, Boolean(existing));
    if (!targetGate.allowed) throw new Error(targetGate.reason);
    // حدود مطلقة: الإنتاج/الكود/المفاتيح خارج سلطة الحاكم ولو وُجد تفويض.
    const boundary = protectedTargetGate(targetKey);
    if (!boundary.allowed) throw new Error(boundary.reason);
    // إن كان هناك تفويض سارٍ يغطي الطلب: يُربط الطلب به ويُسرَّع بعد قرار المحكمة.
    const mandate = await ctx.runQuery(internal.governanceStore.getActiveMandate, {});
    const coverage = mandateGate(mandate, { operation, targetKey, risk }, Date.now());
    const moduleSpec = spec.requestedModule ?? {};
    const id = await ctx.runMutation(internal.governanceStore.insertGovernorProposal, {
      authorId: who.userId,
      title: String(spec.title ?? "مرسوم تطوير من الحاكم السيادي").slice(0, 160),
      operation,
      targetKey,
      summary: String(spec.summary ?? brief).slice(0, 1200),
      rationale: String(spec.rationale ?? brief).slice(0, 1200),
      risk,
      requestedModule: {
        name: String(moduleSpec.name ?? existing?.name ?? targetKey).slice(0, 120),
        description: String(moduleSpec.description ?? spec.summary ?? brief).slice(0, 1200),
        kind: String(moduleSpec.kind ?? existing?.kind ?? "feature").slice(0, 40),
        config: JSON.stringify(moduleSpec.config ?? (existing ? JSON.parse(existing.config) : {})),
      },
      mandateId: coverage.allowed && mandate ? mandate._id : undefined,
    });
    return {
      proposalId: id,
      operation,
      targetKey,
      targetExisted: Boolean(existing),
      provider: result.provider,
      model: result.model,
      fastTrack: coverage.allowed,
      mandateTitle: coverage.allowed && mandate ? mandate.title : undefined,
    };
  },
});

/**
 * 👑 إذن/رفض المالك على طلب الحاكم السيادي (ميزة مستقلة).
 * لا تُشغَّل أداة الحاكم إلا بعد هذا الإذن الصريح، والرفض يُوقف الطلب فوراً.
 */
export const ownerGovernorDecide = action({
  args: {
    proposalId: v.id("evolutionProposals"),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { proposalId, approved, reason }): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("تسجيل الدخول مطلوب");
    const actorInfo = await ctx.runQuery(internal.governanceStore.getGovernanceActor, { userId });
    if (!actorInfo?.isOwner) throw new Error("إذن المالك متاح لصاحب اللعبة فقط");
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal) throw new Error("طلب الحاكم غير موجود");
    const gate = governorOwnerGrantGate(proposal);
    if (!gate.allowed) throw new Error(gate.reason);
    const note = (reason ?? "").trim() || (approved
      ? "إذن صريح من المالك لطلب الحاكم السيادي بعد قرار المحكمة وموافقة نائب المالك"
      : "رفض صريح من المالك لطلب الحاكم السيادي: أُوقف الطلب ولم يُفتح أي تنفيذ");
    const verdict = await ctx.runMutation(internal.governanceStore.recordOwnerGovernorDecision, { proposalId, approved, reason: note });
    return verdict.approved ? { approved: true, next: "awaiting_governor" } : { approved: false, status: "cancelled" };
  },
});

/**
 * 🛠️ الأداة الحقيقية المدمجة في نائب المالك:
 * يكتب تكليفاً حراً، فتحوّله API حقيقية إلى Proposal منضبط (عنوان/عملية/هدف/
 * ملخص/سبب/خطر/وحدة)، ثم يدخل المسار الإلزامي: المحكمة ← نائب المالك ← إذن
 * المالك ← الحاكم ← الغرفة ← التنفيذ. لا يعدّل أي شيء مباشرة بنفسه.
 */
export const deputyDraftProposal = action({
  args: { brief: v.string() },
  handler: async (ctx, { brief }): Promise<any> => {
    const who = await requireAuthority(ctx);
    const actorInfo = await ctx.runQuery(internal.governanceStore.getGovernanceActor, { userId: who.userId });
    if (!actorInfo?.isOwner && !actorInfo?.isDeputy) throw new Error("أداة صياغة الطلبات متاحة لنائب المالك فقط");
    if (brief.trim().length < 30) throw new Error("اكتب تكليفاً أوضح (٣٠ حرفاً على الأقل) ليحوّله النائب إلى طلب منضبط");
    await ensureAiRuntime(ctx);
    const result = await callLlmDetailed({
      messages: [
        { role: "system", content: "أنت نائب المالك في لعبة حرب العقول. حوّل التكليف إلى طلب تعديل إداري منضبط. أعد JSON فقط: title, operation (create|modify|delete|construct), targetKey (snake_case), summary, rationale, risk (low|medium|critical), requestedModule{name,description,kind,config}.config كائن JSON. لا تقترح تجاوز المحكمة أو تعديل الإنتاج مباشرة." },
        { role: "user", content: brief },
      ],
      maxTokens: 900,
      temperature: 0.25,
      label: "Deputy Draft Proposal",
      jsonMode: true,
      task: "other",
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("الأداة لم تُخرج طلباً صالحاً — أعد صياغة التكليف");
    const spec = JSON.parse(match[0]);
    const operation = ["create", "modify", "delete", "construct"].includes(spec.operation) ? spec.operation : "construct";
    const risk = ["low", "medium", "critical"].includes(spec.risk) ? spec.risk : "medium";
    const moduleSpec = spec.requestedModule ?? {};
    try { JSON.stringify(moduleSpec.config ?? {}); } catch { throw new Error("إعداد الوحدة غير قابل للتسلسل"); }
    const id = await ctx.runMutation(internal.governanceStore.insertDeputyProposal, {
      authorId: who.userId,
      title: String(spec.title ?? "طلب تطوير من نائب المالك").slice(0, 160),
      operation,
      targetKey: String(spec.targetKey ?? "deputy_change").slice(0, 80),
      summary: String(spec.summary ?? brief).slice(0, 1200),
      rationale: String(spec.rationale ?? brief).slice(0, 1200),
      risk,
      requestedModule: {
        name: String(moduleSpec.name ?? spec.targetKey ?? "deputy_change").slice(0, 120),
        description: String(moduleSpec.description ?? spec.summary ?? brief).slice(0, 1200),
        kind: String(moduleSpec.kind ?? "feature").slice(0, 40),
        config: JSON.stringify(moduleSpec.config ?? {}),
      },
    });
    return { proposalId: id, raw: result.text, provider: result.provider, model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
  },
});

/**
 * صلاحيات نائب المالك الحقيقية على طلبه: تعديل أو سحب قبل جلسة المحكمة فقط.
 * لا يحذف سجلاً ولا يتجاوز بوابات الحكم.
 */
export const deputySelfReview = action({
  args: {
    proposalId: v.id("evolutionProposals"),
    action: v.union(v.literal("amend"), v.literal("withdraw")),
    reason: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    rationale: v.optional(v.string()),
    risk: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("critical"))),
    requestedModule: v.optional(v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() })),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireAuthority(ctx);
    if (args.reason.trim().length < 10) throw new Error("سبب قرار نائب المالك غير كافٍ — اكتب ما لا يقل عن ١٠ أحرف");
    if (args.requestedModule?.config) {
      try { JSON.parse(args.requestedModule.config || "{}"); } catch { throw new Error("إعداد الوحدة يجب أن يكون JSON صالحاً"); }
    }
    return await ctx.runMutation(internal.governanceStore.deputySelfDecide, {
      proposalId: args.proposalId,
      action: args.action,
      reason: args.reason.slice(0, 3000),
      title: args.title,
      summary: args.summary,
      rationale: args.rationale,
      risk: args.risk,
      requestedModule: args.requestedModule,
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
    // لا يُسمح لأي زائر بتشغيل قرار نائب المالك: يلزم المالك أو نائب المالك المسجل.
    await requireAuthority(ctx);
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

export const ownerDecide = action({
  args: {
    proposalId: v.id("evolutionProposals"),
    approved: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { proposalId, approved, reason }): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("تسجيل الدخول مطلوب");
    const actorInfo = await ctx.runQuery(internal.governanceStore.getGovernanceActor, { userId });
    if (!actorInfo?.isOwner) throw new Error("إذن المالك متاح لصاحب اللعبة فقط");
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "awaiting_owner" || !proposal.deputyApprovedAt) throw new Error("الموافقة غير متاحة قبل موافقة نائب المالك");
    const decision = approved !== false && approved !== undefined ? true : Boolean(approved);
    const note = (reason ?? "").trim() || (decision
      ? "إذن صريح من المالك: موافقة على الطلب بعد قرار المحكمة وموافقة نائب المالك، وأُغلِق التنفيذ حتى موافقة الحاكم السيادي"
      : "رفض صريح من المالك: أُوقف الطلب ولم يُفتح أي تنفيذ");
    const result = await ctx.runMutation(internal.governanceStore.recordOwnerDecision, { proposalId, approved: decision, reason: note });
    return result.approved
      ? { approved: true, next: "awaiting_governor" }
      : { approved: false, status: "cancelled" };
  },
});

/**
 * صلاحيات الحاكم السيادي الحقيقية على طلبه:
 * يستطيع سحب طلبه أو تعديله قبل أن تبدأ جلسة المحكمة، ثم يُسجَّل القرار في
 * سجل الغرفة العميق. هذا لا يمنحه تجاوز المحكمة أو إذن المالك؛ هو يمنع فقط
 * أن يظل طلب رديء عالقاً، ويعطي الحاكم حقاً فعلياً في تصحيح مساره.
 */
export const governorSelfReview = action({
  args: {
    proposalId: v.id("evolutionProposals"),
    action: v.union(v.literal("amend"), v.literal("withdraw")),
    reason: v.string(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    rationale: v.optional(v.string()),
    risk: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("critical"))),
    requestedModule: v.optional(v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() })),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireAuthority(ctx);
    if (args.reason.trim().length < 10) throw new Error("سبب قرار الحاكم غير كافٍ — اكتب ما لا يقل عن ١٠ أحرف");
    if (args.requestedModule?.config) {
      try { JSON.parse(args.requestedModule.config || "{}"); } catch { throw new Error("إعداد الوحدة يجب أن يكون JSON صالحاً"); }
    }
    return await ctx.runMutation(internal.governanceStore.governorSelfDecide, {
      proposalId: args.proposalId,
      action: args.action,
      reason: args.reason.slice(0, 3000),
      title: args.title,
      summary: args.summary,
      rationale: args.rationale,
      risk: args.risk,
      requestedModule: args.requestedModule,
    });
  },
});

export const governorDecide = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    // قرار الحاكم لا يُشغّله إلا المالك أو نائب المالك المسجل.
    await requireAuthority(ctx);
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "awaiting_governor" || proposal.courtVerdict !== "approved" || !proposal.deputyApprovedAt || !proposal.ownerApprovedAt) throw new Error("يلزم موافقة نائب المالك وموافقة المالك أولاً");
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

/**
 * 🛠️ جسم الأداة الحقيقية المشترك: ينتج الإصدار النهائي ويطبّقه على وحدة
 * runtime فعلية. يُستخدم من مسار الغرفة السرية ومن مسار التفويض معاً،
 * بينما تبقى بوابات كل مسار محفوظة على الخادم.
 */
async function runSecretInstrument(ctx: any, proposal: any, who: { name: string }) {
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
        proposalId: proposal._id,
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
      return { ok: true, operationId: applied.operationId, path: applied.path, provider: result.provider, model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "فشل غير معروف";
      await ctx.runMutation(internal.governanceStore.markFailed, { proposalId: proposal._id, error: detail });
      throw new Error(`توقفت أداة الحاكم: ${detail}`);
    }
}

/** مسار الغرفة السرية: التسلسل الكامل (المحكمة ← نائب المالك ← المالك ← الحاكم). */
export const runInstrument = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const who = await requireAuthority(ctx);
    const proposal: any = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal || proposal.status !== "joint_approved" || proposal.courtVerdict !== "approved" || !proposal.deputyApprovedAt || !proposal.ownerApprovedAt || !proposal.governorApprovedAt || !proposal.chamberOpenedAt) throw new Error("الغرفة السرية مغلقة: المسار غير مكتمل");
    await ctx.runMutation(internal.governanceStore.markExecuting, { proposalId });
    return await runSecretInstrument(ctx, proposal, who);
  },
});

/**
 * 🕊️ التنفيذ المفوّض (الميزة الجديدة): ينفّذ طلب الحاكم بعد قرار المحكمة
 * بموجب تفويض سارٍ من المالك، مع إعادة تحقق حيّة من التجميد والهدف المحمي
 * وسقف الخطر والقائمة البيضاء والرصيد عند لحظة التنفيذ نفسها.
 */
export const governorMandateExecute = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const who = await requireAuthority(ctx);
    const proposal: any = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal) throw new Error("الطلب غير موجود");
    if (!proposal.mandateId) throw new Error("هذا الطلب غير مرتبط بتفويض المالك");
    if (proposal.status !== "mandate_approved") throw new Error("الطلب ليس جاهزاً للتنفيذ المفوّض");
    await ctx.runMutation(internal.governanceStore.markExecutingViaMandate, { proposalId });
    return await runSecretInstrument(ctx, proposal, who);
  },
});
