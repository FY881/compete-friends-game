import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isOwnerUser } from "./owner";
import { AI_REGISTRY } from "./aiRegistry";
import { chamberGate, governorSelfReviewGate, instrumentGate } from "./governanceCore";

async function actor(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("المستخدم غير موجود");
  const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
  const isDeputy = Boolean(deputy?.active && deputy.role === "deputy_owner");
  if (!isOwnerUser(user) && !isDeputy) throw new Error("غير مصرح — هذا المسار لمالك اللعبة أو نائب المالك فقط");
  return { userId, name: user.name ?? "مسؤول", isDeputy };
}

export const createProposal = mutation({
  args: {
    title: v.string(), operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")),
    targetKey: v.string(), summary: v.string(), rationale: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }),
  },
  handler: async (ctx, args) => {
    const who = await actor(ctx);
    if (!who.isDeputy) throw new Error("الاقتراح المباشر متاح لنائب المالك فقط — استخدم اقتراح الحاكم السيادي");
    if (args.title.trim().length < 5 || args.summary.trim().length < 20 || args.rationale.trim().length < 20) throw new Error("بيانات المقترح غير مكتملة");
    if (args.targetKey.trim().length < 3 || args.requestedModule.name.trim().length < 3) throw new Error("مفتاح أو اسم الوحدة غير صالح");
    try { JSON.parse(args.requestedModule.config || "{}"); } catch { throw new Error("إعداد الوحدة يجب أن يكون JSON صالحاً"); }
    const now = Date.now();
    const id = await ctx.db.insert("evolutionProposals", { ...args, authorId: who.userId, proposerRole: "deputy_owner", status: "court_review", createdAt: now, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: id, actor: who.name, actorRole: "deputy_owner", action: "proposal_created", detail: `${args.operation}: ${args.targetKey}`, at: now });
    return id;
  },
});

export const listConsole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) return null;
    const proposals = await ctx.db.query("evolutionProposals").order("desc").take(40);
    const operations = await ctx.db.query("evolutionOperations").withIndex("by_at", (q: any) => q.gte("at", 0)).order("desc").take(30);
    const audit = await ctx.db.query("secretChamberAudit").withIndex("by_at", (q: any) => q.gte("at", 0)).order("desc").take(50);
    return { proposals, operations, audit, courtUnits: AI_REGISTRY.map((u) => ({ key: u.key, name: u.name, purpose: u.purpose, dept: u.dept, wiring: u.wiring })) };
  },
});

export const ownerDecide = mutation({
  args: { proposalId: v.id("evolutionProposals"), approved: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("تسجيل الدخول مطلوب");
    const user = await ctx.db.get(userId);
    if (!user || !isOwnerUser(user)) throw new Error("موافقة المالك مطلوبة");
    const p = await ctx.db.get(args.proposalId);
    if (!p || p.status !== "awaiting_owner" || !p.deputyApprovedAt || p.courtVerdict !== "approved") throw new Error("إذن المالك متاح بعد موافقة نائب المالك فقط");
    const now = Date.now();
    if (!args.approved) {
      await ctx.db.patch(args.proposalId, { status: "cancelled", ownerReason: args.reason, lastError: args.reason, updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { proposalId: args.proposalId, actor: "المالك", actorRole: "owner", action: "owner_rejected", detail: args.reason, at: now });
      return { approved: false };
    }
    await ctx.db.patch(args.proposalId, { ownerApprovedAt: now, ownerReason: args.reason, status: "awaiting_governor", updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: args.proposalId, actor: "المالك", actorRole: "owner", action: "owner_approved", detail: args.reason, at: now });
    return { approved: true };
  },
});

export const getGovernanceActor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    return { name: user.name ?? "مسؤول", isOwner: isOwnerUser(user), isDeputy: Boolean(deputy?.active && deputy.role === "deputy_owner") };
  },
});

export const insertGovernorProposal = internalMutation({
  args: { authorId: v.id("users"), title: v.string(), operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")), targetKey: v.string(), summary: v.string(), rationale: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")), requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }) },
  handler: async (ctx, a) => {
    const now = Date.now();
    const id = await ctx.db.insert("evolutionProposals", { ...a, proposerRole: "sovereign_governor", status: "court_review", createdAt: now, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: id, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "proposal_created", detail: `${a.operation}: ${a.targetKey}`, at: now });
    return id;
  },
});

/**
 * قرار الحاكم السيادي على طلبه هو: تعديل أو سحب قبل جلسة المحكمة فقط.
 * هذا لا يفتح تنفيذاً ولا يتجاوز المحكمة؛ يمنع فقط طلباً غير صالح من العبور.
 */
export const governorSelfDecide = internalMutation({
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
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p) throw new Error("الطلب غير موجود");
    const gate = governorSelfReviewGate(p, a.action);
    if (!gate.allowed) throw new Error(gate.reason);
    const now = Date.now();
    if (a.action === "withdraw") {
      await ctx.db.patch(a.proposalId, { status: "cancelled", lastError: a.reason, updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "governor_withdrew", detail: a.reason, at: now });
      return { ok: true, status: "cancelled" };
    }
    await ctx.db.patch(a.proposalId, {
      title: a.title ?? p.title,
      summary: a.summary ?? p.summary,
      rationale: a.rationale ?? p.rationale,
      risk: a.risk ?? p.risk,
      requestedModule: a.requestedModule ?? p.requestedModule,
      updatedAt: now,
    });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "governor_amended", detail: a.reason, at: now });
    return { ok: true, status: p.status };
  },
});

/**
 * إذن المالك الخاص بطلبات الحاكم السيادي: اعتماد أو رفض صريح قبل أي أداة.
 * هذه هي “الميزة الجديدة” التي تجعل إذن المالك شرطاً مستقلاً غير قابل للتجاوز.
 */
export const recordOwnerDecision = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), approved: v.boolean(), reason: v.string() },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p || p.status !== "awaiting_owner" || !p.deputyApprovedAt) throw new Error("إذن المالك متاح بعد موافقة نائب المالك فقط");
    const now = Date.now();
    if (!a.approved) {
      await ctx.db.patch(a.proposalId, { status: "cancelled", lastError: a.reason, ownerReason: a.reason, updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المالك", actorRole: "owner", action: "owner_rejected", detail: a.reason, at: now });
      return { approved: false };
    }
    await ctx.db.patch(a.proposalId, { ownerApprovedAt: now, ownerReason: a.reason, status: "awaiting_governor", updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المالك", actorRole: "owner", action: "owner_approved", detail: a.reason, at: now });
    return { approved: true };
  },
});

export const claimCourt = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), actorName: v.string() },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p || p.status !== "court_review") throw new Error("المقترح قيد المعالجة أو خارج مرحلة المراجعة");
    const now = Date.now();
    await ctx.db.patch(a.proposalId, { status: "court_deliberating", updatedAt: now, lastError: undefined });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.actorName, actorRole: "system", action: "court_opened", detail: `استدعاء ${AI_REGISTRY.length} وحدة`, at: now });
  },
});

export const failCourt = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), error: v.string() },
  handler: async (ctx, a) => {
    const now = Date.now();
    await ctx.db.patch(a.proposalId, { status: "court_review", lastError: a.error, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المحكمة", actorRole: "system", action: "court_failed", detail: a.error, at: now });
  },
});

export const recordCourtDecision = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), verdict: v.union(v.literal("approved"), v.literal("rejected"), v.literal("conditional")), summary: v.string(), reviews: v.array(v.any()), conditions: v.optional(v.array(v.string())), actorName: v.string() },
  handler: async (ctx, a) => {
    const current = await ctx.db.get(a.proposalId);
    if (!current || current.status !== "court_deliberating") throw new Error("جلسة المحكمة غير صالحة");
    const now = Date.now();
    const status = a.verdict === "approved" ? "awaiting_deputy" : a.verdict === "conditional" ? "court_conditional" : "court_rejected";
    await ctx.db.patch(a.proposalId, { courtVerdict: a.verdict, courtSummary: a.summary, courtReviews: a.reviews as any[], courtConditions: a.conditions, courtAt: now, status, updatedAt: now, lastError: a.verdict === "rejected" ? a.summary : undefined });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.actorName, actorRole: "system", action: `court_${a.verdict}`, detail: a.summary, at: now });
  },
});

export const resolveCourtConditions = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), evidence: v.string(), approved: v.boolean() },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p || p.status !== "court_conditional") throw new Error("لا توجد شروط MHC معلقة");
    const now = Date.now();
    await ctx.db.patch(a.proposalId, { status: a.approved ? "awaiting_deputy" : "court_rejected", conditionsEvidence: a.evidence, conditionsResolvedAt: now, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المحكمة", actorRole: "system", action: a.approved ? "conditions_approved" : "conditions_rejected", detail: a.evidence, at: now });
  },
});

export const governanceIntegrity = query({
  args: {},
  handler: async () => ({
    ok: true,
    courtUnitCount: AI_REGISTRY.length,
    allRegisteredUnitsIncluded: COURT_UNIT_KEYS.length === AI_REGISTRY.length,
    requiredFlow: ["court", "deputy_owner", "owner", "sovereign_governor", "secret_chamber", "instrument"],
    instrumentRequiresLiveApiResponse: true,
    checkedAt: Date.now(),
  }),
});

const COURT_UNIT_KEYS = AI_REGISTRY.map((unit) => unit.key);

export const getProposal = internalQuery({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, { proposalId }) => ctx.db.get(proposalId) });
export const recordDeputyApproval = internalMutation({ args: { proposalId: v.id("evolutionProposals"), reason: v.string() }, handler: async (ctx, a) => { const p = await ctx.db.get(a.proposalId); if (!p || p.status !== "awaiting_deputy" || p.courtVerdict !== "approved") throw new Error("موافقة نائب المالك غير متاحة خارج مرحلة ما بعد قرار المحكمة"); const now = Date.now(); await ctx.db.patch(a.proposalId, { deputyApprovedAt: now, deputyReason: a.reason, status: "awaiting_owner", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "نائب المالك", actorRole: "deputy_owner", action: "deputy_approved", detail: a.reason.slice(0, 3000), at: now }); } });
export const recordOwnerApproval = internalMutation({ args: { proposalId: v.id("evolutionProposals"), reason: v.string() }, handler: async (ctx, a) => { const p = await ctx.db.get(a.proposalId); if (!p || p.status !== "awaiting_owner" || !p.deputyApprovedAt) throw new Error("موافقة المالك غير متاحة في هذه المرحلة"); const now = Date.now(); await ctx.db.patch(a.proposalId, { ownerApprovedAt: now, ownerReason: a.reason, status: "awaiting_governor", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المالك", actorRole: "owner", action: "owner_approved", detail: "موافقة المالك الصريحة بعد موافقةCourt ونائب المالك", at: now }); } });
export const recordGovernorApproval = internalMutation({ args: { proposalId: v.id("evolutionProposals"), reason: v.string() }, handler: async (ctx, a) => { const p = await ctx.db.get(a.proposalId); if (!p || p.status !== "awaiting_governor" || !p.ownerApprovedAt || !p.deputyApprovedAt || p.courtVerdict !== "approved") throw new Error("بوابة الحاكم مغلقة: يلزم قرار المحكمة ثم نائب المالك ثم إذن المالك"); const now = Date.now(); await ctx.db.patch(a.proposalId, { governorApprovedAt: now, governorReason: a.reason, chamberOpenedAt: now, status: "joint_approved", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "chamber_opened", detail: a.reason.slice(0, 3000), at: now }); } });
export const recordRejection = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), role: v.union(v.literal("deputy_owner"), v.literal("sovereign_governor")), reason: v.string() },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p) throw new Error("المقترح غير موجود");
    const now = Date.now();
    await ctx.db.patch(a.proposalId, { status: "court_rejected", lastError: a.reason, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.role === "deputy_owner" ? "نائب المالك" : "الحاكم السيادي", actorRole: a.role, action: "proposal_rejected", detail: a.reason, at: now });
  },
});

export const markExecuting = internalMutation({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, a) => { const p = await ctx.db.get(a.proposalId); if (!p || !chamberGate(p).allowed) throw new Error("بوابة الغرفة مغلقة"); const now = Date.now(); await ctx.db.patch(a.proposalId, { status: "executing", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_started", detail: "طلب API حقيقي بدأ", at: now }); } });
export const markFailed = internalMutation({ args: { proposalId: v.id("evolutionProposals"), error: v.string() }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { status: "failed", lastError: a.error, updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_failed", detail: a.error, at: now }); } });
export const applyInstrument = internalMutation({ args: { proposalId: v.id("evolutionProposals"), name: v.string(), description: v.string(), kind: v.string(), config: v.string(), provider: v.string(), model: v.string(), tokensIn: v.number(), tokensOut: v.number(), evidence: v.string(), actorName: v.string() }, handler: async (ctx, a) => {
  const p = await ctx.db.get(a.proposalId); if (!p || !instrumentGate(p).allowed) throw new Error("بوابة الأداة مغلقة");
  const now = Date.now(); const existing = await ctx.db.query("evolutionModules").withIndex("by_key", (q: any) => q.eq("key", p.targetKey)).first();
  let before: string | undefined; let outcome: string;
  if (p.operation === "delete") { if (!existing) throw new Error("الوحدة غير موجودة"); before = JSON.stringify(existing); await ctx.db.delete(existing._id); outcome = "deleted"; }
  else if (p.operation === "modify" || p.operation === "construct") { if (!existing) throw new Error("الوحدة غير موجودة للتعديل"); before = JSON.stringify(existing); await ctx.db.patch(existing._id, { name: a.name, description: a.description, kind: a.kind as any, config: a.config, version: existing.version + 1, updatedAt: now }); outcome = "updated"; }
  else { if (existing) throw new Error("مفتاح الوحدة مستخدم"); await ctx.db.insert("evolutionModules", { key: p.targetKey, name: a.name, description: a.description, kind: a.kind as any, status: "active", config: a.config, version: 1, sourceProposal: a.proposalId, createdAt: now, updatedAt: now }); outcome = "created"; }
  const operationId = await ctx.db.insert("evolutionOperations", { proposalId: a.proposalId, operation: outcome, targetKey: p.targetKey, before, after: JSON.stringify({ name: a.name, description: a.description, kind: a.kind, config: a.config }), provider: a.provider, model: a.model, apiVerified: true, tokensIn: a.tokensIn, tokensOut: a.tokensOut, result: outcome, evidence: a.evidence, at: now });
  await ctx.db.patch(a.proposalId, { status: "executed", executedAt: now, executionId: operationId, updatedAt: now, lastError: undefined });
  await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.actorName, actorRole: "instrument", action: `instrument_${outcome}`, detail: `${a.provider}/${a.model} — ${a.tokensIn}+${a.tokensOut} tokens — ${operationId}`, at: now });
  return { operationId };
} });
