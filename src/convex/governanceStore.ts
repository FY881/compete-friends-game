import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isOwnerUser } from "./owner";
import { AI_REGISTRY } from "./aiRegistry";
import { chamberGate, deputySelfReviewGate, governorFreezeGate, governorOwnerGrantGate, governorSelfReviewGate, mandateGate, protectedTargetGate, sovereignExecutionGate } from "./governanceCore";

const GOVERNOR_SCOPE = "sovereign_governor";

/** يقرأ صف حالة سلطة الحاكم بلا إنشاء (آمن داخل الاستعلامات). */
async function readGovernorState(ctx: any) {
  return await ctx.db.query("evolutionGovernorState").withIndex("by_scope", (q: any) => q.eq("scope", GOVERNOR_SCOPE)).first();
}

/** يقرأ أو ينشئ صف حالة الحاكم — داخل الطفرات فقط. */
async function ensureGovernorState(ctx: any) {
  const existing = await readGovernorState(ctx);
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("evolutionGovernorState", { scope: GOVERNOR_SCOPE, frozen: false, executions: 0, mandateExecutions: 0, chamberExecutions: 0, rollbacks: 0, updatedAt: now });
  return await ctx.db.get(id);
}

/** عدّادات حقيقية مشتقة من قاعدة البيانات — لا أرقام وهمية. */
async function bumpGovernorState(ctx: any, delta: { executions?: number; mandateExecutions?: number; chamberExecutions?: number; rollbacks?: number; lastExecutionAt?: number }) {
  const state = await ensureGovernorState(ctx);
  if (!state) return;
  const now = Date.now();
  await ctx.db.patch(state._id, {
    executions: state.executions + (delta.executions ?? 0),
    mandateExecutions: state.mandateExecutions + (delta.mandateExecutions ?? 0),
    chamberExecutions: state.chamberExecutions + (delta.chamberExecutions ?? 0),
    rollbacks: state.rollbacks + (delta.rollbacks ?? 0),
    lastExecutionAt: delta.lastExecutionAt ?? state.lastExecutionAt,
    updatedAt: now,
  });
}

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

/**
 * 🛠️ أداة الحاكم السيادي الواقعية: تُعيد الوحدات الحقيقية في runtime حتى يعدّلها
 * الحاكم كما يريد (تعديل/حذف/بناء) بدل العمل على الهواء. مقصورة على المالك ونائبه.
 */
export const listEvolutionModules = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) return null;
    const modules = await ctx.db.query("evolutionModules").withIndex("by_key", (q: any) => q.gte("key", "")).collect();
    return modules.map((m) => ({ key: m.key, name: m.name, description: m.description, kind: m.kind, status: m.status, version: m.version, updatedAt: m.updatedAt }));
  },
});

/**
 * إذن المالك على طلب الحاكم السيادي — ميزة مستقلة ومخصصة لطلبات الحاكم.
 * تُسجَّل بنطاق ownerGrantScope="governor_request" ويُدقّق القرار في الغرفة.
 */
export const recordOwnerGovernorDecision = internalMutation({
  args: { proposalId: v.id("evolutionProposals"), approved: v.boolean(), reason: v.string() },
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.proposalId);
    if (!p) throw new Error("طلب الحاكم غير موجود");
    const gate = governorOwnerGrantGate(p);
    if (!gate.allowed) throw new Error(gate.reason);
    const now = Date.now();
    if (!a.approved) {
      await ctx.db.patch(a.proposalId, { status: "cancelled", lastError: a.reason, ownerReason: a.reason, ownerGrantScope: "governor_request", ownerVerdictAt: now, updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المالك", actorRole: "owner", action: "owner_rejected_governor_request", detail: a.reason, at: now });
      return { approved: false };
    }
    await ctx.db.patch(a.proposalId, { ownerApprovedAt: now, ownerReason: a.reason, ownerGrantScope: "governor_request", ownerVerdictAt: now, status: "awaiting_governor", updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "المالك", actorRole: "owner", action: "owner_granted_governor_request", detail: a.reason, at: now });
    return { approved: true };
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
  args: { authorId: v.id("users"), title: v.string(), operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")), targetKey: v.string(), summary: v.string(), rationale: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")), requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }), mandateId: v.optional(v.id("evolutionMandates")) },
  handler: async (ctx, a) => {
    const now = Date.now();
    const id = await ctx.db.insert("evolutionProposals", { ...a, proposerRole: "sovereign_governor", status: "court_review", createdAt: now, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: id, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: a.mandateId ? "proposal_created_under_mandate" : "proposal_created", detail: `${a.operation}: ${a.targetKey}${a.mandateId ? " — داخل تفويض المالك" : ""}`, at: now });
    return id;
  },
});

/**
 * قرار نائب المالك على طلبه هو: تعديل أو سحب قبل جلسة المحكمة فقط.
 * أداة حقيقية مدمجة في صلاحياته، لكنها لا تتجاوز المحكمة ولا إذن المالك.
 */
export const deputySelfDecide = internalMutation({
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
    const gate = deputySelfReviewGate(p, a.action);
    if (!gate.allowed) throw new Error(gate.reason);
    const now = Date.now();
    if (a.action === "withdraw") {
      await ctx.db.patch(a.proposalId, { status: "cancelled", lastError: a.reason, updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "نائب المالك", actorRole: "deputy_owner", action: "deputy_withdrew", detail: a.reason, at: now });
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
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "نائب المالك", actorRole: "deputy_owner", action: "deputy_amended", detail: a.reason, at: now });
    return { ok: true, status: p.status };
  },
});

/** إدراج طلب صاغه نائب المالك بأداة المسودة الذكية — لا يتجاوز المحكمة. */
export const insertDeputyProposal = internalMutation({
  args: { authorId: v.id("users"), title: v.string(), operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")), targetKey: v.string(), summary: v.string(), rationale: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")), requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }) },
  handler: async (ctx, a) => {
    const now = Date.now();
    const id = await ctx.db.insert("evolutionProposals", { ...a, proposerRole: "deputy_owner", status: "court_review", createdAt: now, updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { proposalId: id, actor: "نائب المالك", actorRole: "deputy_owner", action: "proposal_drafted", detail: `مسودة ذكية: ${a.operation}: ${a.targetKey}`, at: now });
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
    // مسار التفويض: قرار المحكمة كافٍ للانتقال إلى التنفيذ السريع (إذن المالك ممنوح مسبقاً بالتفويض)
    const status = a.verdict === "approved"
      ? (current.mandateId ? "mandate_approved" : "awaiting_deputy")
      : a.verdict === "conditional" ? "court_conditional" : "court_rejected";
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
export const getEvolutionModule = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const module = await ctx.db.query("evolutionModules").withIndex("by_key", (q: any) => q.eq("key", key)).first();
    return module ? { key: module.key, name: module.name, description: module.description, kind: module.kind, config: module.config, version: module.version } : null;
  },
});
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

export const markExecuting = internalMutation({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, a) => {
  const p = await ctx.db.get(a.proposalId);
  if (!p) throw new Error("الطلب غير موجود");
  const freeze = governorFreezeGate(await readGovernorState(ctx));
  if (!freeze.allowed) throw new Error(freeze.reason);
  const target = protectedTargetGate(p.targetKey);
  if (!target.allowed) throw new Error(target.reason);
  if (!chamberGate(p).allowed) throw new Error("بوابة الغرفة مغلقة");
  const now = Date.now();
  await ctx.db.patch(a.proposalId, { status: "executing", updatedAt: now });
  await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_started", detail: "طلب API حقيقي بدأ عبر الغرفة السرية", at: now });
} });

/**
 * 🕊️ حجز تنفيذ عبر تفويض المالك السارٍ (المسار السريع الجديد).
 * لا يمنح شيئاً بنفسه: يعيد التحقق حيّاً من التجميد والهدف المحمي وصلاحية
 * التفويض وقرار المحكمة، ثم يحجز الطلب للتنفيذ الفعلي.
 */
export const markExecutingViaMandate = internalMutation({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, a) => {
  const p = await ctx.db.get(a.proposalId);
  if (!p) throw new Error("الطلب غير موجود");
  if (!p.mandateId) throw new Error("هذا الطلب غير مرتبط بتفويض المالك");
  if (p.status !== "mandate_approved") throw new Error("الطلب ليس في مرحلة التنفيذ المفوّض");
  const mandate = await ctx.db.get(p.mandateId);
  const freeze = governorFreezeGate(await readGovernorState(ctx));
  if (!freeze.allowed) throw new Error(freeze.reason);
  const target = protectedTargetGate(p.targetKey);
  if (!target.allowed) throw new Error(target.reason);
  const coverage = mandateGate(mandate, { operation: p.operation, targetKey: p.targetKey, risk: p.risk }, Date.now());
  if (!coverage.allowed) throw new Error(coverage.reason);
  if (p.courtVerdict !== "approved") throw new Error("التفويض لا يُغني عن قرار المحكمة");
  const now = Date.now();
  await ctx.db.patch(a.proposalId, { status: "executing", updatedAt: now, lastError: undefined });
  await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "mandate_execution_claimed", detail: `تفويض ${p.mandateId} — ${p.operation}: ${p.targetKey}`, at: now });
} });
export const markFailed = internalMutation({ args: { proposalId: v.id("evolutionProposals"), error: v.string() }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { status: "failed", lastError: a.error, updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_failed", detail: a.error, at: now }); } });
export const applyInstrument = internalMutation({ args: { proposalId: v.id("evolutionProposals"), name: v.string(), description: v.string(), kind: v.string(), config: v.string(), provider: v.string(), model: v.string(), tokensIn: v.number(), tokensOut: v.number(), evidence: v.string(), actorName: v.string() }, handler: async (ctx, a) => {
  const p = await ctx.db.get(a.proposalId); if (!p) throw new Error("الطلب غير موجود");
  const mandateRow = p.mandateId ? await ctx.db.get(p.mandateId) : null;
  const execGate = sovereignExecutionGate({ proposal: p, mandate: mandateRow, state: await readGovernorState(ctx), now: Date.now() });
  if (!execGate.allowed) throw new Error(execGate.reason);
  const now = Date.now(); const existing = await ctx.db.query("evolutionModules").withIndex("by_key", (q: any) => q.eq("key", p.targetKey)).first();
  let before: string | undefined; let outcome: string;
  if (p.operation === "delete") { if (!existing) throw new Error("الوحدة غير موجودة"); before = JSON.stringify(existing); await ctx.db.delete(existing._id); outcome = "deleted"; }
  else if (p.operation === "modify" || p.operation === "construct") { if (!existing) throw new Error("الوحدة غير موجودة للتعديل"); before = JSON.stringify(existing); await ctx.db.patch(existing._id, { name: a.name, description: a.description, kind: a.kind as any, config: a.config, version: existing.version + 1, updatedAt: now }); outcome = "updated"; }
  else { if (existing) throw new Error("مفتاح الوحدة مستخدم"); await ctx.db.insert("evolutionModules", { key: p.targetKey, name: a.name, description: a.description, kind: a.kind as any, status: "active", config: a.config, version: 1, sourceProposal: a.proposalId, createdAt: now, updatedAt: now }); outcome = "created"; }
  const operationId = await ctx.db.insert("evolutionOperations", { proposalId: a.proposalId, operation: outcome, targetKey: p.targetKey, before, after: JSON.stringify({ name: a.name, description: a.description, kind: a.kind, config: a.config }), provider: a.provider, model: a.model, apiVerified: true, tokensIn: a.tokensIn, tokensOut: a.tokensOut, result: outcome, evidence: a.evidence, at: now });
  await ctx.db.patch(a.proposalId, { status: "executed", executedAt: now, executionId: operationId, updatedAt: now, lastError: undefined, ownerGrantScope: p.mandateId ? "mandate" : p.ownerGrantScope });
  // استهلاك رصيد التفويض عند التنفيذ الفعلي فقط — لا يُستهلك على محاولة فاشلة
  if (p.mandateId && mandateRow) await ctx.db.patch(p.mandateId, { usedCount: mandateRow.usedCount + 1, updatedAt: now });
  await bumpGovernorState(ctx, { executions: 1, mandateExecutions: p.mandateId ? 1 : 0, chamberExecutions: p.mandateId ? 0 : 1, lastExecutionAt: now });
  await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.actorName, actorRole: "instrument", action: `instrument_${outcome}`, detail: `${execGate.path === "mandate" ? "بموجب التفويض — " : "بموجب الغرفة السرية — "}${a.provider}/${a.model} — ${a.tokensIn}+${a.tokensOut} tokens — ${operationId}`, at: now });
  return { operationId, path: execGate.path };
} });

// ─────────────────────────────────────────────────────────────────────────────
// 🕊️ سلطة الحاكم السيادية الموسّعة: تفويض من المالك + تجميد فوري + نقض حقيقي
// ─────────────────────────────────────────────────────────────────────────────

async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) throw new Error("هذه الصلاحية لمالك اللعبة وحده");
  return { userId, name: user.name ?? "المالك" };
}

/** التفويض السارٍ الوحيد للحاكم — يُقرأ داخل المسارات الحسّاسة. */
export const getActiveMandate = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evolutionMandates").withIndex("by_status", (q: any) => q.eq("status", "active")).order("desc").first();
  },
});

/** حالة التجميد فقط — تُفحص قبل كل حجز تنفيذ. */
export const getGovernorState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const state = await readGovernorState(ctx);
    return { frozen: Boolean(state?.frozen), frozenReason: state?.frozenReason ?? "" };
  },
});

/** لوحة سلطة الحاكم: التفويض + التجميد + عدّادات حقيقية من قاعدة البيانات. */
export const mandateState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
    const isOwner = isOwnerUser(user);
    if (!isOwner && !(deputy?.active && deputy.role === "deputy_owner")) return null;
    const active = await ctx.db.query("evolutionMandates").withIndex("by_status", (q: any) => q.eq("status", "active")).order("desc").first();
    const mandates = await ctx.db.query("evolutionMandates").order("desc").take(10);
    const state = await readGovernorState(ctx);
    const now = Date.now();
    return {
      isOwner,
      active: active
        ? { ...active, expired: active.expiresAt <= now, remaining: Math.max(0, active.quota - active.usedCount) }
        : null,
      mandates,
      governor: {
        frozen: Boolean(state?.frozen),
        frozenReason: state?.frozenReason ?? "",
        frozenAt: state?.frozenAt ?? null,
        executions: state?.executions ?? 0,
        mandateExecutions: state?.mandateExecutions ?? 0,
        chamberExecutions: state?.chamberExecutions ?? 0,
        rollbacks: state?.rollbacks ?? 0,
        lastExecutionAt: state?.lastExecutionAt ?? null,
      },
      now,
    };
  },
});

/**
 * 🕊️ منح الحاكم تفويضاً حقيقياً: نطاق عمليات + قائمة وحدات بيضاء + سقف خطر +
 * رصيد تنفيذ + انتهاء زمني. لا يشمل أبداً أهدافاً محمية (إنتاج/كود/مفاتيح).
 */
export const grantMandate = mutation({
  args: {
    title: v.string(),
    operations: v.array(v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct"))),
    moduleAllowlist: v.array(v.string()),
    maxRisk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    quota: v.number(),
    expiresInHours: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, a) => {
    const who = await requireOwner(ctx);
    if (a.title.trim().length < 5) throw new Error("عنوان التفويض قصير");
    if (a.reason.trim().length < 20) throw new Error("اكتب سبباً واضحاً للتفويض (٢٠ حرفاً على الأقل)");
    if (a.operations.length === 0) throw new Error("حدد عملية واحدة على الأقل للتفويض");
    if (a.quota < 1 || a.quota > 50) throw new Error("الرصيد يجب أن يكون بين ١ و٥٠ تنفيذاً");
    if (a.expiresInHours < 1 || a.expiresInHours > 720) throw new Error("المدة يجب أن تكون بين ساعة و٧٢٠ ساعة");
    const allowlist = a.moduleAllowlist.map((key) => key.trim().toLowerCase()).filter(Boolean);
    for (const key of allowlist) {
      const gate = protectedTargetGate(key);
      if (!gate.allowed) throw new Error(`${key}: ${gate.reason}`);
    }
    const now = Date.now();
    // تفويض سارٍ واحد فقط: منح تفويض جديد يسحب الأقدم تلقائياً لتفادي أي غموض.
    const previous = await ctx.db.query("evolutionMandates").withIndex("by_status", (q: any) => q.eq("status", "active")).order("desc").first();
    if (previous) {
      await ctx.db.patch(previous._id, { status: "revoked", revokedAt: now, revokeReason: "أُسقط لصالح تفويض أحدث من المالك", updatedAt: now });
      await ctx.db.insert("secretChamberAudit", { actor: who.name, actorRole: "owner", action: "mandate_superseded", detail: `تفويض #${previous._id} أُسقط لصالح تفويض أحدث`, at: now });
    }
    const expiresAt = now + Math.floor(a.expiresInHours) * 3600_000;
    const id = await ctx.db.insert("evolutionMandates", {
      title: a.title.trim().slice(0, 160),
      grantedById: who.userId,
      grantedByName: who.name,
      operations: a.operations,
      moduleAllowlist: allowlist,
      maxRisk: a.maxRisk,
      quota: Math.floor(a.quota),
      usedCount: 0,
      status: "active",
      expiresAt,
      reason: a.reason.trim().slice(0, 2000),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("secretChamberAudit", { actor: who.name, actorRole: "owner", action: "mandate_granted", detail: `${a.title.trim()} — عمليات: ${a.operations.join("/")} — سقف الخطر: ${a.maxRisk} — رصيد: ${a.quota} — ينتهي: ${new Date(expiresAt).toISOString()}`, at: now });
    return { mandateId: id, expiresAt };
  },
});

/** سحب التفويض فوراً — يوقف كل تنفيذ مفوّض من اللحظة نفسها. */
export const revokeMandate = mutation({
  args: { mandateId: v.id("evolutionMandates"), reason: v.string() },
  handler: async (ctx, a) => {
    const who = await requireOwner(ctx);
    if (a.reason.trim().length < 10) throw new Error("اكتب سبب سحب التفويض (١٠ أحرف على الأقل)");
    const mandate = await ctx.db.get(a.mandateId);
    if (!mandate) throw new Error("التفويض غير موجود");
    if (mandate.status !== "active") throw new Error("التفويض غير نشط أصلاً");
    const now = Date.now();
    await ctx.db.patch(a.mandateId, { status: "revoked", revokedAt: now, revokeReason: a.reason.trim().slice(0, 1000), updatedAt: now });
    await ctx.db.insert("secretChamberAudit", { actor: who.name, actorRole: "owner", action: "mandate_revoked", detail: `${mandate.title} — ${a.reason.trim()}`, at: now });
    return { ok: true };
  },
});

/** مفتاح التجميد الفوري (Kill Switch): يوقف الحاكم بمساريه معاً. */
export const setGovernorFreeze = mutation({
  args: { frozen: v.boolean(), reason: v.string() },
  handler: async (ctx, a) => {
    const who = await requireOwner(ctx);
    if (a.frozen && a.reason.trim().length < 10) throw new Error("اكتب سبب التجميد (١٠ أحرف على الأقل)");
    const state = await ensureGovernorState(ctx);
    const now = Date.now();
    await ctx.db.patch(state._id, {
      frozen: a.frozen,
      frozenReason: a.frozen ? a.reason.trim().slice(0, 1000) : undefined,
      frozenAt: a.frozen ? now : undefined,
      frozenBy: a.frozen ? who.name : undefined,
      updatedAt: now,
    });
    await ctx.db.insert("secretChamberAudit", { actor: who.name, actorRole: "owner", action: a.frozen ? "governor_frozen" : "governor_unfrozen", detail: a.frozen ? a.reason.trim() : "رفع المالك التجميد عن سلطة الحاكم", at: now });
    return { frozen: a.frozen };
  },
});

/**
 * ↩️ نقض تنفيذ سابق واستعادة الإصدار الفعلي من لقطة `before` المخزنة.
 * نقض حقيقي على البيانات: لا يعتمد على أي محاكاة، وكل خطوة تُسجّل في الغرفة.
 */
export const rollbackExecution = mutation({
  args: { proposalId: v.id("evolutionProposals"), reason: v.string() },
  handler: async (ctx, a) => {
    const who = await requireOwner(ctx);
    if (a.reason.trim().length < 10) throw new Error("اكتب سبب النقض (١٠ أحرف على الأقل)");
    const p = await ctx.db.get(a.proposalId);
    if (!p || p.status !== "executed" || !p.executionId) throw new Error("لا يوجد تنفيذ مكتمل قابل للنقض");
    if (p.revertedAt) throw new Error("هذا التنفيذ منقوض مسبقاً");
    const op = await ctx.db.get(p.executionId);
    if (!op) throw new Error("سجل التنفيذ مفقود");
    const now = Date.now();
    const current = await ctx.db.query("evolutionModules").withIndex("by_key", (q: any) => q.eq("key", p.targetKey)).first();
    let outcome: string;
    let preRollback: string;
    if (!op.before) {
      // التنفيذ الأصلي كان إنشاءً: النقض = حذف الوحدة المُنشأة.
      if (!current) throw new Error("الوحدة المُنشأة لم تعد موجودة — لا شيء لنقضه");
      preRollback = JSON.stringify(current);
      await ctx.db.delete(current._id);
      outcome = "rollback_deleted";
    } else {
      const snap = JSON.parse(op.before);
      preRollback = JSON.stringify(current ?? null);
      if (current) {
        await ctx.db.patch(current._id, { name: snap.name, description: snap.description, kind: snap.kind, config: snap.config, version: current.version + 1, updatedAt: now });
      } else {
        await ctx.db.insert("evolutionModules", { key: p.targetKey, name: snap.name, description: snap.description, kind: snap.kind, status: snap.status ?? "active", config: snap.config, version: (snap.version ?? 1) + 1, sourceProposal: p._id, createdAt: now, updatedAt: now });
      }
      outcome = "rollback_restored";
    }
    const operationId = await ctx.db.insert("evolutionOperations", { proposalId: a.proposalId, operation: outcome, targetKey: p.targetKey, before: preRollback, after: op.before ?? "{}", provider: "Owner Rollback", model: "rollback", apiVerified: true, tokensIn: 0, tokensOut: 0, result: outcome, evidence: a.reason.trim().slice(0, 3000), at: now });
    await ctx.db.patch(a.proposalId, { revertedAt: now, revertOperationId: operationId, updatedAt: now });
    await bumpGovernorState(ctx, { rollbacks: 1 });
    await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: who.name, actorRole: "owner", action: "execution_rolled_back", detail: `${p.targetKey} — ${a.reason.trim()} — ${operationId}`, at: now });
    return { ok: true, outcome, operationId };
  },
});
