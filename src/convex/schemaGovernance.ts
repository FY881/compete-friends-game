import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Court → Deputy Owner → Sovereign Governor governance and chamber evidence. */
export const governanceTables = {
  evolutionModules: defineTable({
    key: v.string(),
    name: v.string(),
    description: v.string(),
    kind: v.union(v.literal("feature"), v.literal("content"), v.literal("rule"), v.literal("integration")),
    status: v.union(v.literal("active"), v.literal("disabled")),
    config: v.string(),
    version: v.number(),
    sourceProposal: v.optional(v.id("evolutionProposals")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * 🕊️ تفويض الحاكم السيادي: سلطة جذرية ممنوحة من المالك، محدودة النطاق والرصيد والزمن،
   * وقابلة للسحب فوراً. لا تشمل الإنتاج/الكود/المفاتيح أبداً — تلك تبقى في مسار الموافقة الفردية.
   */
  evolutionMandates: defineTable({
    title: v.string(),
    grantedById: v.id("users"),
    grantedByName: v.string(),
    operations: v.array(v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct"))),
    /** قائمة بيضاء لمفاتيح الوحدات — فارغة تعني كل وحدات runtime المسموحة عدا المحمية */
    moduleAllowlist: v.array(v.string()),
    maxRisk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    /** رصيد التنفيذ الكلي تحت هذا التفويض — لا يُتجدد تلقائياً */
    quota: v.number(),
    usedCount: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    expiresAt: v.number(),
    reason: v.string(),
    revokedAt: v.optional(v.number()),
    revokeReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status", "createdAt"]),

  /** حالة سلطة الحاكم: مفتاح تجميد فوري + عدّادات حقيقية من قاعدة البيانات */
  evolutionGovernorState: defineTable({
    scope: v.string(),
    frozen: v.boolean(),
    frozenReason: v.optional(v.string()),
    frozenAt: v.optional(v.number()),
    frozenBy: v.optional(v.string()),
    executions: v.number(),
    mandateExecutions: v.number(),
    chamberExecutions: v.number(),
    rollbacks: v.number(),
    lastExecutionAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_scope", ["scope"]),

  evolutionIntegrations: defineTable({
    key: v.string(),
    name: v.string(),
    kind: v.union(v.literal("git"), v.literal("ci"), v.literal("storage"), v.literal("webhook")),
    credentialEnv: v.string(),
    endpoint: v.optional(v.string()),
    enabled: v.boolean(),
    allowlist: v.array(v.string()),
    lastHealthAt: v.optional(v.number()),
    lastHealthDetail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  evolutionProposals: defineTable({
    authorId: v.id("users"),
    proposerRole: v.union(v.literal("deputy_owner"), v.literal("sovereign_governor"), v.literal("mind_hub")),
    title: v.string(),
    operation: v.union(v.literal("create"), v.literal("modify"), v.literal("delete"), v.literal("construct")),
    targetKey: v.string(),
    summary: v.string(),
    rationale: v.string(),
    risk: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    requestedModule: v.object({ name: v.string(), description: v.string(), kind: v.string(), config: v.string() }),
    status: v.union(
      v.literal("court_review"), v.literal("court_deliberating"), v.literal("court_conditional"), v.literal("court_rejected"), v.literal("awaiting_deputy"),
      v.literal("awaiting_owner"), v.literal("awaiting_governor"), v.literal("joint_approved"), v.literal("mandate_approved"), v.literal("executing"),
      v.literal("executed"), v.literal("failed"), v.literal("cancelled"),
    ),
    courtVerdict: v.optional(v.union(v.literal("approved"), v.literal("rejected"), v.literal("conditional"))),
    courtSummary: v.optional(v.string()),
    courtReviews: v.optional(v.array(v.object({ unit: v.string(), name: v.string(), purpose: v.string(), opinion: v.string(), vote: v.string(), provider: v.string(), model: v.string(), latencyMs: v.number() }))),
    courtConditions: v.optional(v.array(v.string())),
    conditionsEvidence: v.optional(v.string()),
    conditionsResolvedAt: v.optional(v.number()),
    courtAt: v.optional(v.number()),
    deputyApprovedAt: v.optional(v.number()),
    deputyReason: v.optional(v.string()),
    ownerApprovedAt: v.optional(v.number()),
    ownerReason: v.optional(v.string()),
    ownerGrantScope: v.optional(v.union(v.literal("deputy_request"), v.literal("governor_request"), v.literal("mandate"), v.literal("mind_hub_request"))),
    ownerVerdictAt: v.optional(v.number()),
    /** التفويض السارٍ الذي أجاز هذا الطلب (مسار الحاكم السريع) */
    mandateId: v.optional(v.id("evolutionMandates")),
    /** نُقض التنفيذ واستُعيد الإصدار السابق — نقض حقيقي قابل للتدقيق */
    revertedAt: v.optional(v.number()),
    revertOperationId: v.optional(v.id("evolutionOperations")),
    governorApprovedAt: v.optional(v.number()),
    governorReason: v.optional(v.string()),
    chamberOpenedAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    executionId: v.optional(v.id("evolutionOperations")),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status", "createdAt"]).index("by_author", ["authorId"]).index("by_proposer_status", ["proposerRole", "status"]),

  evolutionOperations: defineTable({
    proposalId: v.id("evolutionProposals"), operation: v.string(), targetKey: v.string(),
    before: v.optional(v.string()), after: v.string(), provider: v.string(), model: v.optional(v.string()),
    apiVerified: v.boolean(), tokensIn: v.number(), tokensOut: v.number(), result: v.string(), evidence: v.string(), at: v.number(),
  }).index("by_proposal", ["proposalId"]).index("by_at", ["at"]),

  secretChamberAudit: defineTable({
    proposalId: v.optional(v.id("evolutionProposals")), actor: v.string(),
    actorRole: v.union(v.literal("deputy_owner"), v.literal("owner"), v.literal("sovereign_governor"), v.literal("instrument"), v.literal("system")),
    action: v.string(), detail: v.string(), ipHint: v.optional(v.string()), at: v.number(),
  }).index("by_at", ["at"]).index("by_proposal", ["proposalId"]),
};
