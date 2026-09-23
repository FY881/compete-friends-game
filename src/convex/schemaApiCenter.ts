import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 جداول مركز API v16.0 — التوجيه الحقيقي + الحدود + الاستهلاك
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  1. apiRoutes      — توجيه كل وحدة AI في اللعبة (نموذج/حرارة/طول/JSON).
 *  2. apiGuard       — إعدادات الحماية: سقوف يومية، حد الدقيقة، الكاش، القاطع.
 *  3. apiUsageDaily  — استهلاك حقيقي مُجمَّع لكل يوم ومزوّد ونموذج.
 *  4. apiReplyCache  — ذاكرة الاستجابة: تمنع دفع مرتين لنفس الطلب تماماً.
 *  5. apiCallEvents  — سجل الاستدعاءات الكامل: سبب الفشل، الكاش، المحاولة.
 *
 * تُدمَج في مخطط اللعبة عبر `...premiumTables` في schema.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const apiCenterTables = {
  // ═══ ① مصفوفة التوجيه: صف لكل وحدة AI في اللعبة ═══
  apiRoutes: defineTable({
    task: v.string(), // مفتاح الوحدة (questions | moderation | commentary …)
    label: v.string(), // الاسم العربي كما يظهر للمالك
    /** النموذج المفضّل لهذه الوحدة — null = أفضل نموذج متاح للمزوّد */
    model: v.optional(v.union(v.string(), v.null())),
    /** درجة الإبداع لهذه الوحدة (null = كما يطلبها الكود) */
    temperature: v.optional(v.union(v.number(), v.null())),
    /** سقف طول الرد لهذه الوحدة (0 = بلا سقف) */
    maxTokens: v.number(),
    needsJson: v.boolean(),
    /** إيقاف وحدة بعينها من مركز API */
    enabled: v.boolean(),
    /** آخر من عدّلها ومتى */
    updatedBy: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_task", ["task"]),

  // ═══ ② إعدادات الحماية (صف واحد id="main") ═══
  apiGuard: defineTable({
    id: v.string(),
    enabled: v.boolean(),
    dailyCallCap: v.number(),
    dailyTokenCap: v.number(),
    perMinuteCap: v.number(),
    cacheEnabled: v.boolean(),
    circuitEnabled: v.boolean(),
    failureThreshold: v.number(),
    cooldownMs: v.number(),
    allowEnvBootstrap: v.boolean(),
    updatedAt: v.number(),
  }).index("by_id_key", ["id"]),

  // ═══ ③ الاستهلاك الحقيقي لكل يوم ═══
  apiUsageDaily: defineTable({
    day: v.string(), // YYYY-MM-DD بالتوقيت العالمي
    provider: v.string(), // معرّف المزوّد (A | B | env)
    model: v.string(),
    calls: v.number(),
    okCalls: v.number(),
    failCalls: v.number(),
    cacheHits: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    totalLatencyMs: v.number(),
    updatedAt: v.number(),
  })
    .index("by_day", ["day"])
    .index("by_day_model", ["day", "model"]),

  // ═══ ④ ذاكرة الاستجابة — نفس الطلب لا يُدفع مرتين ═══
  apiReplyCache: defineTable({
    fp: v.string(), // بصمة الطلب (نموذج + حرارة + الرسائل)
    reply: v.string(),
    provider: v.string(),
    model: v.string(),
    task: v.string(),
    hits: v.number(),
    expiresAt: v.number(), // 0 = بلا انتهاء
    createdAt: v.number(),
  })
    .index("by_fp", ["fp"])
    .index("by_created", ["createdAt"]),

  // ═══ ⑤ سجل الاستدعاءات الكامل — تشخيص حقيقي ═══
  apiCallEvents: defineTable({
    ok: v.boolean(),
    provider: v.string(),
    providerKind: v.string(), // key_url | key_only | env
    task: v.string(),
    taskLabel: v.string(),
    label: v.string(), // الاسم الأصلي الذي مرّره الكود
    model: v.string(),
    latencyMs: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    cached: v.boolean(),
    attempt: v.number(),
    error: v.optional(v.string()),
    /** حجم الرسائل المُرسلة (حروف) — مؤشر تكلفة سريع */
    promptChars: v.number(),
    at: v.number(),
  })
    .index("by_created", ["at"])
    .index("by_task", ["task"]),
};
