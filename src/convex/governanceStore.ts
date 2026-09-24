import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { isOwnerUser } from "./owner";
import { AI_REGISTRY } from "./aiRegistry";

async function actor(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("المستخدم غير موجود");
  const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
  const isDeputy = Boolean(deputy?.active && deputy.role === "deputy_owner");
  if (!isOwnerUser(user) && !isDeputy) throw new Error("غير مصرح — هذا المسار لمالك اللعبة أو نائب المالك فقط");
  return { userId, name: user.name ?? "مسؤول" };
}

export const createProposal = mutation({
  args: {
    title: v.string(), operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")),
    targetKey: v.string(), summary: v.string(), rationale: v.string(), risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }),
  },
  handler: async (ctx, args) => {
    const who = await actor(ctx);
    if (args.title.trim().length < 5 || args.summary.trim().length < 20 || args.rationale.trim().length < 20) throw new Error("بيانات المقترح غير مكتملة");
    if (args.targetKey.trim().length < 3 || args.requestedModule.name.trim().length < 3) throw new Error("مفتاح أو اسم الوحدة غير صالح");
    try { JSON.parse(args.requestedModule.config || "{}"); } catch { throw new Error("إعداد الوحدة يجب أن يكون JSON صالحاً"); }
    const now = Date.now();
    const id = await ctx.db.insert("evolutionProposals", { ...args, authorId: who.userId, status: "court_review", createdAt: now, updatedAt: now });
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
    const proposals = await ctx.db.query("evolutionProposals").withIndex("by_status", (q: any) => q.gte("createdAt", 0)).order("desc").take(40);
    const operations = await ctx.db.query("evolutionOperations").withIndex("by_at", (q: any) => q.gte("at", 0)).order("desc").take(30);
    const audit = await ctx.db.query("secretChamberAudit").withIndex("by_at", (q: any) => q.gte("at", 0)).order("desc").take(50);
    return { proposals, operations, audit, courtUnits: AI_REGISTRY.filter((x) => ["unit_questions", "unit_guardian", "unit_reports", "governor", "forge"].includes(x.key)).map((u) => ({ key: u.key, name: u.name, purpose: u.purpose })) };
  },
});

export const getProposal = internalQuery({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, { proposalId }) => ctx.db.get(proposalId) });
export const recordCourtDecision = internalMutation({ args: { proposalId: v.id("evolutionProposals"), verdict: v.string(), summary: v.string(), reviews: v.array(v.any()), actorName: v.string() }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { courtVerdict: a.verdict as any, courtSummary: a.summary, courtReviews: a.reviews as any[], courtAt: now, status: a.verdict === "approved" ? "awaiting_deputy" : "court_rejected", updatedAt: now, lastError: a.verdict === "approved" ? undefined : a.summary }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: a.actorName, actorRole: "system", action: "court_decision", detail: a.summary, at: now }); } });
export const recordDeputyApproval = internalMutation({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { deputyApprovedAt: now, status: "awaiting_governor", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "نائب المالك", actorRole: "deputy_owner", action: "deputy_approved", detail: "موافقة نائب المالك بعد قرار المجلس", at: now }); } });
export const recordGovernorApproval = internalMutation({ args: { proposalId: v.id("evolutionProposals"), reason: v.string() }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { governorApprovedAt: now, chamberOpenedAt: now, status: "joint_approved", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "الحاكم السيادي", actorRole: "sovereign_governor", action: "chamber_opened", detail: a.reason, at: now }); } });
export const markExecuting = internalMutation({ args: { proposalId: v.id("evolutionProposals") }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { status: "executing", updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_started", detail: "طلب API حقيقي بدأ", at: now }); } });
export const markFailed = internalMutation({ args: { proposalId: v.id("evolutionProposals"), error: v.string() }, handler: async (ctx, a) => { const now = Date.now(); await ctx.db.patch(a.proposalId, { status: "failed", lastError: a.error, updatedAt: now }); await ctx.db.insert("secretChamberAudit", { proposalId: a.proposalId, actor: "أداة التطوير", actorRole: "instrument", action: "instrument_failed", detail: a.error, at: now }); } });
export const applyInstrument = internalMutation({ args: { proposalId: v.id("evolutionProposals"), name: v.string(), description: v.string(), kind: v.string(), config: v.string(), provider: v.string(), model: v.string(), tokensIn: v.number(), tokensOut: v.number(), evidence: v.string(), actorName: v.string() }, handler: async (ctx, a) => {
  const p = await ctx.db.get(a.proposalId); if (!p || p.status !== "executing" || !p.chamberOpenedAt) throw new Error("بوابة الأداة مغلقة");
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
