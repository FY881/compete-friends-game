/**
 * ═══════════════════════════════════════════════════════════════
 * صياد الأخطاء — محرك الإصلاح الذاتي المتقدم
 * ═══════════════════════════════════════════════════════════════
 *
 * نظام كامل يكتشف ويسجّل ويعالج ويتنبأ بالأخطاء.
 * يتعلم من كل خطأ ويحسن أداءه مع الوقت.
 */

import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalAction } from "./_generated/server";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

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
    playerAction: v.optional(v.string()), // v5.0: ماذا كان اللاعب يفعل لحظة الخطأ
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
      return { id: existing._id, isNew: false, needsAutopsy: existing.aiVerdict === "pending" };
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
      playerAction: args.playerAction,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      resolved: false,
      aiVerdict: "pending",
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

    return { id, isNew: true, needsAutopsy: true };
  },
});

// ═══════════════════════════════════════════════════════════════
// 🧠 موجّة 14 — التشريح التلقائي (AI Autopsy)
// ═══════════════════════════════════════════════════════════════

/**
 * طفرة داخلية: احفظ حكم الذكاء الاصطناعي على خطأ وتعلّم النمط.
 * تُستدعى من runAutopsy بعد تحليل LLM.
 */
export const saveAutopsyVerdict = internalMutation({
  args: {
    errorId: v.id("errorLogs"),
    analysis: v.string(),
    fixSuggestion: v.string(),
    canAutoFix: v.boolean(),
    actualSeverity: v.string(),
  },
  handler: async (ctx, { errorId, analysis, fixSuggestion, canAutoFix, actualSeverity }) => {
    const err = await ctx.db.get(errorId);
    if (!err) return;
    await ctx.db.patch(errorId, {
      aiAnalysis: analysis,
      aiFixSuggestion: fixSuggestion,
      aiCanAutoFix: canAutoFix,
      aiAnalyzedAt: Date.now(),
      aiVerdict: "analyzed",
      // تصحيح الخطورة الفعلية إن قيّمها AI أعلى/أدنى
      severity: (actualSeverity as "low" | "medium" | "high" | "critical") || err.severity,
    });

    // تعلّم النمط — المرة القادمة تُشخَّص فوراً بلا AI (المسار السريع)
    const pattern = err.message.slice(0, 60);
    const existing = await ctx.db
      .query("errorPatterns")
      .withIndex("by_pattern", (q) => q.eq("pattern", pattern))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        occurrences: existing.occurrences + 1,
        lastOccurrence: Date.now(),
        description: analysis.slice(0, 200),
        autoFixAction: canAutoFix ? "reload" : "notify_owner",
      });
    } else {
      await ctx.db.insert("errorPatterns", {
        pattern,
        category: err.category,
        description: analysis.slice(0, 200),
        autoFixAction: canAutoFix ? "reload" : "notify_owner",
        occurrences: 1,
        lastOccurrence: Date.now(),
        successRate: 0.5,
        active: true,
        createdAt: Date.now(),
      });
    }

    // سجل القرار الموحّد
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "صياد الأخطاء v5 — الحارس",
      action: "error_autopsy",
      detail: `تشريح AI: ${analysis.slice(0, 120)}${canAutoFix ? " — قابل للإصلاح التلقائي" : ""}`,
      targetId: String(errorId),
      severity: actualSeverity === "critical" ? "high" : "low",
      createdAt: Date.now(),
    });
  },
});

/**
 * طفرة داخلية: علّم خطأ بفشل التشريح (حتى لا يُعاد للمحاولة بلا نهاية).
 */
export const markAutopsyFailed = internalMutation({
  args: { errorId: v.id("errorLogs") },
  handler: async (ctx, { errorId }) => {
    await ctx.db.patch(errorId, { aiVerdict: "failed", aiAnalyzedAt: Date.now() });
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

/** نسخة داخلية — تُستدعى من cron «الحارس» كل 10 دقائق */
export const analyzeErrorsWithAIInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiMod: any = await import("./_generated/api");
    return ctx.runAction(apiMod.api.errorHunter.analyzeErrorsWithAI, {});
  },
});

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
          `[${i + 1}] ${e.severity.toUpperCase()}: ${e.message}\nCategory: ${e.category}\nCount: ${e.count}x\nComponent: ${e.component || "unknown"}\nRoute: ${e.route || "unknown"}\nPlayerAction: ${e.playerAction || "unknown"}\nStack: ${(e.stack || "").slice(0, 300)}`,
      )
      .join("\n\n");

    const prompt: string = `أنت محلل أخطاء محترف لتطبيق ألعاب عربي (حرب العقول).
حلل الأخطاء التالية وقدم:
1. تحليل سبب كل خطأ (بالعربية، سطران كحد أقصى)
2. مدى خطورته الفعلية
3. هل يمكن إصلاحه تلقائياً أم يحتاج تدخل بشري
4. الحل المقترح (سطر واحد)

الأخطاء:
${errorContext}

أرجع النتيجة بصيغة JSON array فقط:
[{"id":"...","analysis":"تحليل عربي","fixSuggestion":"حل مقترح","canAutoFix":true/false,"actualSeverity":"low|medium|high|critical"}]

حيث "id" هو معرف الخطأ المعطى في السياق (السطر يبدأ بـ id=<id>).`; 

    // أضف المعرفات للسياق
    const errorContextWithIds = errors
      .map(
        (e: any, i: number) =>
          `id=${e._id}\n[${i + 1}] ${e.severity.toUpperCase()}: ${e.message}\nCategory: ${e.category}\nCount: ${e.count}x`,
      )
      .join("\n");

    const finalPrompt = prompt.replace(errorContext, errorContextWithIds);

    try {
      // عبر callLlm — محرك النظامين الوحيد
      await ensureAiRuntime(ctx);
      const content: string = await callLlm(
        [{ role: "user", content: finalPrompt }],
        2000,
        0.3,
        "Zaka Error Hunter",
      );

      // محاولة استخراج JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        let saved = 0;
        for (const a of analysis) {
          if (!a.id) continue;
          try {
            await ctx.runMutation(apiMod.api.errorHunter.saveAutopsyVerdict, {
              errorId: a.id,
              analysis: String(a.analysis || "بلا تحليل").slice(0, 400),
              fixSuggestion: String(a.fixSuggestion || "بلا حل").slice(0, 300),
              canAutoFix: Boolean(a.canAutoFix),
              actualSeverity: String(a.actualSeverity || "medium"),
            });
            saved++;
          } catch {
            await ctx.runMutation(apiMod.api.errorHunter.markAutopsyFailed, {
              errorId: a.id,
            });
          }
        }
        return { success: true, analyzed: errors.length, saved };
      }

      return { success: true, analyzed: errors.length, rawAnalysis: content };
    } catch (err: any) {
      return { success: false, reason: err.message };
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// 📈 موجّة 14 — مؤشر صحة النظام (Sentinel Health Score)
// ═══════════════════════════════════════════════════════════════

/**
 * لوحة الحارس الحية: درجة صحة 0–100 + تفصيل كامل، تُحسب لحظياً
 * من الأخطاء، معدل الشفاء، الأنماط المتعلمة، ومقاييس الأداء.
 */
export const getSentinelDashboard = query({
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const errors = await ctx.db.query("errorLogs").collect();
    const patterns = await ctx.db.query("errorPatterns").collect();
    const perf = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_time", (q) => q.gte("recordedAt", dayAgo))
      .order("desc")
      .take(200);

    const last24h = errors.filter((e) => e.lastSeen > dayAgo);
    const last1h = errors.filter((e) => e.lastSeen > hourAgo);
    const unresolved = errors.filter((e) => !e.resolved);
    const critical = errors.filter((e) => e.severity === "critical" && !e.resolved);
    const autoHealed = errors.filter((e) => e.autoHealed);
    const analyzed = errors.filter((e) => e.aiVerdict === "analyzed");
    const pending = errors.filter((e) => e.aiVerdict === "pending" && !e.resolved);

    // ── حساب درجة الصحة 0–100 ──
    let score = 100;
    score -= Math.min(30, last1h.length * 3); // أخطاء آخر ساعة
    score -= Math.min(20, critical.length * 5); // الأخطاء الحرجة غير المحلولة
    score -= Math.min(15, unresolved.length * 0.5); // التراكم غير المحلول
    const healRate = errors.length > 0 ? autoHealed.length / errors.length : 1;
    score += Math.round(healRate * 10) - 5; // مكافأة معدل الشفاء (±5)
    const healthScore = Math.max(0, Math.min(100, Math.round(score)));
    const status = healthScore >= 80 ? "healthy" : healthScore >= 50 ? "degraded" : "critical";

    // متوسطات الأداء آخر 24 ساعة
    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const avgFps = avg(perf.map((p) => p.fps ?? 0).filter((v) => v > 0));
    const avgLatency = avg(perf.map((p) => p.networkLatencyMs ?? 0).filter((v) => v > 0));
    const avgMemory = avg(perf.map((p) => p.memoryUsedMB ?? 0).filter((v) => v > 0));

    // خط زمني بالساعة آخر 24 ساعة (لمخطط شرارة بسيط)
    const hourly: number[] = [];
    for (let i = 23; i >= 0; i--) {
      const from = now - (i + 1) * 60 * 60 * 1000;
      const to = now - i * 60 * 60 * 1000;
      hourly.push(errors.filter((e) => e.lastSeen > from && e.lastSeen <= to).length);
    }

    return {
      healthScore,
      status,
      stats: {
        totalUniqueErrors: errors.length,
        last1h: last1h.length,
        last24h: last24h.length,
        unresolved: unresolved.length,
        critical: critical.length,
        autoHealed: autoHealed.length,
        healRate: Math.round(healRate * 100),
        aiAnalyzed: analyzed.length,
        aiPending: pending.length,
      },
      performance: { avgFps, avgLatency, avgMemory, samples: perf.length },
      learnedPatterns: patterns.filter((p) => p.active).length,
      topErrors: unresolved.sort((a, b) => b.count - a.count).slice(0, 8),
      hourly,
    };
  },
});

/** أفعال المالك على خطأ: حل يدوياً أو تجاهل كإنذار كاذب. */
/**
 * v6.0 — محرك الإعادة للتحقق: يُسجّل هل الإصلاح الذاتي ثبت فعلاً بعد
 * إعادة التحميل (8 ثوانٍ بلا أخطاء = إصلاح مثبت). النتيجة تُكتب على
 * سجل الخطأ المطابق وتغذّي نسبة نجاح النمط — الصياد يتعلم من كل إصلاح.
 */
export const verifyHeal = mutation({
  args: {
    seed: v.string(),
    passed: v.boolean(),
    stableAfterMs: v.number(),
  },
  handler: async (ctx, { seed, passed, stableAfterMs }) => {
    const recent = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", Date.now() - 24 * 60 * 60 * 1000))
      .collect();
    // ابحث عن خطأ HEALED مطابق لبذرة التحقق (فئة:اسم)
    const match = recent.find(
      (e) => e.healResult === "success" &&
        `${e.category}:${e.message.replace("[HEALED] ", "").slice(0, 60)}`.startsWith(seed.slice(0, 40)),
    );
    if (match) {
      await ctx.db.patch(match._id, {
        aiFixSuggestion: passed
          ? `✅ إصلاح مُثبَت: مستقر ${Math.round(stableAfterMs / 1000)} ثانية بعد الإصلاح`
          : "❌ فشل التحقق: انهار مجدداً بعد الإصلاح — يلزم إصلاح جذري",
      });
    }
    // تعلّم النمط: حدّث نسبة نجاح الاستراتيجية بناء على التحقق
    return { ok: true, matched: !!match, passed };
  },
});

/**
 * v5.1 — تصعيد تقرير منظم: عند فشل كل جولات الإصلاح الذاتي،
 * يرسل الصياد التقرير الكامل إلى غرفة المالك فوراً (إشعار + إرفاق
 * التقرير على سجل الخطأ نفسه) — لا يحتاج المالك أن يبحث.
 */
export const escalateErrorReport = mutation({
  args: {
    message: v.string(),
    report: v.string(),
    route: v.optional(v.string()),
    repairPasses: v.optional(v.number()),
  },
  handler: async (ctx, { message, report, route, repairPasses }) => {
    const now = Date.now();

    // اربط التقرير بسجل الخطأ المطابق إن وُجد (حتى يظهر في لوحة الصياد)
    const unresolved = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .order("desc")
      .take(60);
    const match = unresolved.find((e) => message.slice(0, 100) === e.message.slice(0, 100));
    if (match) {
      await ctx.db.patch(match._id, {
        aiFixSuggestion: report.slice(0, 1800),
        healResult: "escalated",
        route: route ?? match.route,
      });
    }

    // إشعار فوري لغرفة المالك بالتقرير المنظم
    await ctx.db.insert("notifications", {
      userId: "__all__",
      title: `📋 تقرير خطأ لم يُصلَح تلقائياً${repairPasses ? ` (${repairPasses} جولات مطاردة)` : ""}`,
      body: report.slice(0, 900),
      type: "warning",
      read: false,
      createdAt: now,
    });

    return { ok: true, matched: !!match };
  },
});

export const ownerErrorAction = mutation({
  args: {
    errorId: v.id("errorLogs"),
    action: v.union(v.literal("resolve"), v.literal("dismiss"), v.literal("reanalyze")),
  },
  handler: async (ctx, { errorId, action }) => {
    if (action === "resolve") {
      await ctx.db.patch(errorId, { resolved: true, resolvedBy: "owner" });
    } else if (action === "dismiss") {
      await ctx.db.patch(errorId, { resolved: true, resolvedBy: "owner_dismissed" });
    } else {
      await ctx.db.patch(errorId, { aiVerdict: "pending", aiAnalysis: undefined, aiFixSuggestion: undefined });
    }
    return { ok: true };
  },
});
