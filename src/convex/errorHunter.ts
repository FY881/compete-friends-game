/**
 * ═══════════════════════════════════════════════════════════════
 * صياد الأخطاء — محرك الإصلاح الذاتي المتقدم
 * ═══════════════════════════════════════════════════════════════
 *
 * نظام كامل يكتشف ويسجّل ويعالج ويتنبأ بالأخطاء.
 * يتعلم من كل خطأ ويحسن أداءه مع الوقت.
 */

import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { callLlm } from "./aiConfig";

// ═══════════════════════════════════════════════════════════════
// التسجيل — تسجيل الخطأ مع التجميع الذكي
// ═══════════════════════════════════════════════════════════════

/** توليد بصمة فريدة للخطأ — نفس الخطأ من نفس المكون = نفس البصمة */
function fingerprint(message: string, component?: string, route?: string): string {
  const raw = `${component || "unknown"}::${route || "/"}::${message.slice(0, 120)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

/** تصنيف الخطأ حسب نوعه */
function categorizeError(message: string, stack?: string): string {
  const combined = `${message} ${stack || ""}`;
  if (/hook|use[A-Z].*outside|rendered more/i.test(combined)) return "hooks_violation";
  if (/chunk|lazy|import.*chunk|loading chunk/i.test(combined)) return "chunk_load";
  if (/network|fetch.*fail|connection|ECONNREFUSED/i.test(combined)) return "network";
  if (/convex|subscription|query.*fail|mutation.*fail/i.test(combined)) return "api";
  if (/render|cannot read|undefined.*prop|null.*access|element type/i.test(combined)) return "render";
  if (/process is not defined|ReferenceError/i.test(combined)) return "runtime";
  if (/quota|storage|IndexedDB/i.test(combined)) return "storage";
  if (/permission|CORS|blocked/i.test(combined)) return "security";
  return "unknown";
}

/** تحديد شدة الخطأ */
function classifySeverity(message: string, category: string): "low" | "medium" | "high" | "critical" {
  if (/chunk|Failed to fetch dynamically/i.test(message)) return "critical";
  if (/hooks_violation|Rendered more/i.test(message)) return "critical";
  if (/process is not defined|ReferenceError/i.test(message)) return "critical";
  if (category === "render") return "high";
  if (category === "api") return "high";
  if (category === "network") return "medium";
  if (category === "hooks_violation") return "high";
  if (category === "chunk_load") return "high";
  if (category === "runtime") return "high";
  return "low";
}

/**
 * تسجيل خطأ من العميل — يُجمّع مع الأخطاء المماثلة عدداً
 */
export const logError = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    component: v.optional(v.string()),
    route: v.optional(v.string()),
    url: v.optional(v.string()),
    autoHealed: v.boolean(),
    healStrategy: v.optional(v.string()),
    healResult: v.optional(v.string()),
    deviceInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fp = fingerprint(args.message, args.component, args.route);
    const category = categorizeError(args.message, args.stack);
    const severity = classifySeverity(args.message, category);
    const now = Date.now();

    // فحص: هل البصمة موجودة مسبقاً؟
    const existing = await ctx.db
      .query("errorLogs")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fp))
      .first();

    if (existing) {
      // تحديث العدّاد — لا نكرر السجل
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        lastSeen: now,
        autoHealed: args.autoHealed || existing.autoHealed,
        healStrategy: args.healStrategy || existing.healStrategy,
        healResult: args.healResult || existing.healResult,
      });
      return { id: existing._id, isNew: false };
    }

    // سجل جديد
    const id = await ctx.db.insert("errorLogs", {
      fingerprint: fp,
      message: args.message.slice(0, 500),
      stack: args.stack?.slice(0, 2000),
      component: args.component,
      route: args.route,
      url: args.url,
      severity,
      category,
      autoHealed: args.autoHealed,
      healStrategy: args.healStrategy,
      healResult: args.healResult,
      deviceInfo: args.deviceInfo?.slice(0, 200),
      count: 1,
      firstSeen: now,
      lastSeen: now,
      resolved: false,
      createdAt: now,
    });

    // إذا الخطأ حرج، أرسل إشعار فوري للمالك
    if (severity === "critical") {
      await ctx.db.insert("notifications", {
        userId: "__all__",
        title: "🚨 خطأ حرج جديد",
        body: `صياد الأخطاء اكتشف: ${args.message.slice(0, 100)}`,
        type: "warning",
        read: false,
        createdAt: now,
      });
    }

    return { id, isNew: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// الاستعلامات — جلب الأخطاء والإحصائيات
// ═══════════════════════════════════════════════════════════════

/** جلب الأخطاء غير المحلولة (للاستخدام من الأكشن) */
export const getUnresolvedErrors = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .take(10);
  },
});

/** جلب الأخطاء مرتبة حسب الأحدث */
export const getErrors = query({
  args: {
    limit: v.optional(v.number()),
    severity: v.optional(v.string()),
    category: v.optional(v.string()),
    unresolvedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let q = ctx.db.query("errorLogs").withIndex("by_created");

    if (args.unresolvedOnly) {
      q = ctx.db.query("errorLogs").withIndex("by_unresolved", (q) =>
        q.eq("resolved", false),
      );
    } else if (args.severity) {
      q = ctx.db.query("errorLogs").withIndex("by_severity", (q) =>
        q.eq("severity", args.severity as "low" | "medium" | "high" | "critical"),
      );
    }

    const errors = await q.order("desc").take(limit);
    return args.category
      ? errors.filter((e) => e.category === args.category)
      : errors;
  },
});

/** إحصائيات الأخطاء الشاملة */
export const getErrorStats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("errorLogs").collect();
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const recent1h = all.filter((e) => e.lastSeen > hourAgo);
    const recent24h = all.filter((e) => e.lastSeen > dayAgo);
    const unresolved = all.filter((e) => !e.resolved);
    const critical = all.filter((e) => e.severity === "critical" && !e.resolved);
    const autoHealed = all.filter((e) => e.autoHealed);
    const notHealed = all.filter((e) => !e.autoHealed && !e.resolved);

    const totalInstances = all.reduce((sum, e) => sum + e.count, 0);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const e of all) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.count;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + e.count;
    }

    return {
      totalUniqueErrors: all.length,
      totalInstances,
      unresolvedCount: unresolved.length,
      criticalCount: critical.length,
      recent1hCount: recent1h.length,
      recent24hCount: recent24h.length,
      autoHealedCount: autoHealed.length,
      notHealedCount: notHealed.length,
      healRate: all.length > 0 ? autoHealed.length / all.length : 1,
      byCategory,
      bySeverity,
      topErrors: unresolved
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  },
});

/** جلب أنماط الأخطاء المُتعلّمة */
export const getErrorPatterns = query({
  handler: async (ctx) => {
    return await ctx.db.query("errorPatterns").collect();
  },
});

// ═══════════════════════════════════════════════════════════════
// الإصلاح — تعليمات الإصلاح + تمديد الأخطاء
// ═══════════════════════════════════════════════════════════════

/** تمديد خطأ كمحلّ */
export const resolveError = mutation({
  args: {
    errorId: v.id("errorLogs"),
    resolvedBy: v.string(), // "auto" | "owner" | "unknown"
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, {
      resolved: true,
      resolvedBy: args.resolvedBy,
    });
    return { success: true };
  },
});

/** تعليم نمط جديد */
export const learnPattern = mutation({
  args: {
    pattern: v.string(),
    category: v.string(),
    description: v.string(),
    autoFixAction: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("errorPatterns")
      .withIndex("by_pattern", (q) => q.eq("pattern", args.pattern))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        occurrences: existing.occurrences + 1,
        lastOccurrence: Date.now(),
      });
      return { id: existing._id, isNew: false };
    }

    const id = await ctx.db.insert("errorPatterns", {
      ...args,
      occurrences: 1,
      lastOccurrence: Date.now(),
      successRate: 0.5,
      active: true,
      createdAt: Date.now(),
    });
    return { id, isNew: true };
  },
});

/** تحديث نسبة نجاح النمط */
export const updatePatternSuccessRate = mutation({
  args: {
    patternId: v.id("errorPatterns"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.patternId);
    if (!p) return;
    const alpha = 0.1;
    const newRate = args.success
      ? p.successRate + alpha * (1 - p.successRate)
      : p.successRate + alpha * (0 - p.successRate);
    await ctx.db.patch(args.patternId, { successRate: newRate });
  },
});

// ═══════════════════════════════════════════════════════════════
// الأداء — تسجيل مقاييس الأداء
// ═══════════════════════════════════════════════════════════════

export const recordPerformance = mutation({
  args: {
    userId: v.optional(v.id("users")),
    fps: v.optional(v.number()),
    memoryUsedMB: v.optional(v.number()),
    memoryTotalMB: v.optional(v.number()),
    networkLatencyMs: v.optional(v.number()),
    networkType: v.optional(v.string()),
    route: v.optional(v.string()),
    loadTimeMs: v.optional(v.number()),
    convSyncMs: v.optional(v.number()),
    componentCount: v.optional(v.number()),
    domNodes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("performanceMetrics", {
      ...args,
      recordedAt: Date.now(),
    });

    // تنظيف المقاييس القديمة (أقدم من 24 ساعة)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const oldMetrics = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_time", (q) => q.lt("recordedAt", dayAgo))
      .take(20);
    for (const m of oldMetrics) {
      await ctx.db.delete(m._id);
    }

    return { id };
  },
});

/** ملخص أداء آخر ساعة */
export const getPerformanceSummary = query({
  handler: async (ctx) => {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const metrics = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_time", (q) => q.gte("recordedAt", hourAgo))
      .take(200);

    if (metrics.length === 0) {
      return {
        avgFps: 0,
        avgLatency: 0,
        avgMemory: 0,
        sampleCount: 0,
        fpsIssues: 0,
        latencyIssues: 0,
      };
    }

    const avgFps = metrics.reduce((s, m) => s + (m.fps || 0), 0) / metrics.length;
    const avgLatency = metrics.reduce((s, m) => s + (m.networkLatencyMs || 0), 0) / metrics.length;
    const avgMemory = metrics.reduce((s, m) => s + (m.memoryUsedMB || 0), 0) / metrics.length;
    const fpsIssues = metrics.filter((m) => (m.fps || 60) < 30).length;
    const latencyIssues = metrics.filter((m) => (m.networkLatencyMs || 0) > 500).length;

    return {
      avgFps: Math.round(avgFps),
      avgLatency: Math.round(avgLatency),
      avgMemory: Math.round(avgMemory),
      sampleCount: metrics.length,
      fpsIssues,
      latencyIssues,
    };
  },
});

// ═══════════════════════════════════════════════════════════════
// صحة النظام — تحديث الحالة اللحظية
// ═══════════════════════════════════════════════════════════════

export const updateSystemHealth = mutation({
  args: {
    activeUsers: v.number(),
    errorRate: v.number(),
    avgFps: v.number(),
    avgLatency: v.number(),
    diagnostics: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const unresolved = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .collect();

    const critical = unresolved.filter((e) => e.severity === "critical");
    const status =
      critical.length >= 3
        ? "critical"
        : critical.length >= 1 || args.errorRate > 5
          ? "degraded"
          : "healthy";

    const existing = await ctx.db
      .query("systemHealth")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        errorRate: args.errorRate,
        activeUsers: args.activeUsers,
        avgFps: args.avgFps,
        avgLatency: args.avgLatency,
        unresolvedErrors: unresolved.length,
        criticalErrors: critical.length,
        lastSweepAt: now,
        diagnostics: args.diagnostics,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("systemHealth", {
        key: "current",
        status,
        errorRate: args.errorRate,
        activeUsers: args.activeUsers,
        avgFps: args.avgFps,
        avgLatency: args.avgLatency,
        unresolvedErrors: unresolved.length,
        criticalErrors: critical.length,
        lastAutoFix: undefined,
        lastSweepAt: now,
        uptime: 0,
        diagnostics: args.diagnostics,
        updatedAt: now,
      });
    }

    return { status };
  },
});

/** جلب حالة النظام الحالية */
export const getSystemHealth = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("systemHealth")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();
  },
});

// ═══════════════════════════════════════════════════════════════
// التنظيف — حذف الأخطاء القديمة المحلولة
// ═══════════════════════════════════════════════════════════════

export const cleanupOldErrors = mutation({
  handler: async (ctx) => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldResolved = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.lt("createdAt", weekAgo))
      .collect();

    let deleted = 0;
    for (const e of oldResolved) {
      if (e.resolved) {
        await ctx.db.delete(e._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

// ═══════════════════════════════════════════════════════════════
// التحليل بالـ AI — فحص عميق للأخطاء
// ═══════════════════════════════════════════════════════════════

export const analyzeErrorsWithAI = action({
  args: {},
  handler: async (ctx) => {

    // جلب الأخطاء غير المحلولة — نستخدم api reference عبر dynamic import
    // لتجنب الاستيراد الدائري
    const apiMod: any = await import("./_generated/api");
    const errors: any[] = await ctx.runQuery(apiMod.api.errorHunter.getUnresolvedErrors);

    if (errors.length === 0) return { success: true, analyzed: 0 };

    // بناء سياق التحليل
    const errorContext = errors
      .map(
        (e: any, i: number) =>
          `[${i + 1}] ${e.severity.toUpperCase()}: ${e.message}\nCategory: ${e.category}\nCount: ${e.count}x\nComponent: ${e.component || "unknown"}\nRoute: ${e.route || "unknown"}\nStack: ${(e.stack || "").slice(0, 300)}`,
      )
      .join("\n\n");

    const prompt: string = `أنت محلل أخطاء محترف لتطبيق ألعاب عربي (حرب العقول).
حلل الأخطاء التالية وقدم:
1. تحليل سبب كل خطأ
2. مدى خطورته الفعلية
3. هل يمكن إصلاحه تلقائياً أم يحتاج تدخل بشري
4. الحل المقترح (إن أمكن)

الأخطاء:
${errorContext}

أرجع النتيجة بصيغة JSON array فقط:
[{"fingerprint":"...","analysis":"تحليل عربي","fixSuggestion":"حل مقترح","canAutoFix":true/false,"actualSeverity":"low|medium|high|critical"}]`;

    try {
      // عبر callLlm — OpenRouter مع بديل OneHop (DeepSeek) تلقائي عند الفشل
      const content: string = await callLlm(
        [{ role: "user", content: prompt }],
        2000,
        0.3,
        "Zaka Error Hunter",
      );

      // محاولة استخراج JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return { success: true, analyzed: errors.length, analysis };
      }

      return { success: true, analyzed: errors.length, rawAnalysis: content };
    } catch (err: any) {
      return { success: false, reason: err.message };
    }
  },
});
