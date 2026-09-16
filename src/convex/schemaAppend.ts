import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * 👑 الحاكم السيادي — جداول عقوبات ومراسيم حقيقية بمفعول فعلي.
 * تُدمج في المخطط الرئيسي عبر schemaExtra.
 */
export const sovereignTables = {
  sovereignPenalties: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    lawId: v.string(),
    action: v.string(),
    label: v.string(),
    appliedResult: v.string(),
    reason: v.string(),
    evidence: v.string(),
    strikes: v.number(),
    status: v.string(), // active | vetoed
    vetoNote: v.optional(v.string()),
    vetoedAt: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_at", ["at"]),

  sovereignEdicts: defineTable({
    kind: v.string(), // economy | growth | veto
    title: v.string(),
    body: v.string(),
    evidence: v.optional(v.any()),
    active: v.boolean(),
    at: v.number(),
  }).index("by_at", ["at"]),
};
