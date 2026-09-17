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
    kind: v.string(), // economy | growth | veto | rescue | quality
    title: v.string(),
    body: v.string(),
    evidence: v.optional(v.any()),
    active: v.boolean(),
    at: v.number(),
  }).index("by_at", ["at"]),

  // ⚖️ محكمة النزاهة — قضايا الحاكم بأدلة كاملة وأحكام موثقة
  sovereignCases: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    charge: v.string(),
    evidence: v.string(), // JSON أدلة
    severity: v.string(), // high | critical
    verdict: v.string(), // pending | guilty | innocent
    verdictNote: v.optional(v.string()),
    status: v.string(), // open | closed
    at: v.number(),
    triedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_at", ["at"]),

  // 🌊 سجل أفعال الحاكم السيادية المباشرة — كل فعل يطبّقه على الموقع لحظياً
  sovereignActions: defineTable({
    kind: v.string(),
    target: v.string(), // ما فُعل بالضبط
    details: v.optional(v.string()), // JSON
    ok: v.boolean(),
    at: v.number(),
  }).index("by_at", ["at"]),

  // 🚨 إنذارات الحاكم الاستباقية — مخاطر رصدها قبل وقوعها
  sovereignAlerts: defineTable({
    kind: v.string(),
    level: v.string(), // info | warning | critical
    title: v.string(),
    body: v.string(),
    evidence: v.optional(v.any()),
    acknowledged: v.boolean(),
    at: v.number(),
  }).index("by_at", ["at"]),

  // 🔥 سجل الحملات السيادية — مبادرات تطوير وقّعها الحاكم ونفّذها بنفسه
  sovereignCampaigns: defineTable({
    name: v.string(),
    goal: v.string(),
    metric: v.string(), // المؤشر الذي يقيس النجاح
    baseline: v.number(), // قيمة المؤشر عند الإطلاق
    deadline: v.number(),
    status: v.string(), // active | succeeded | failed
    resultNote: v.optional(v.string()),
    at: v.number(),
  }).index("by_status", ["status"]),
};
