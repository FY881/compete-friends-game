/**
 * ═══════════════════════════════════════════════════════════════════════
 * نظام البلاغات الذكي — تحليل AI تلقائي + تصعيد ذكي + حماية
 * متوافق مع Schema reports: { reporterId, reporterName, targetId, targetName,
 *   reason, details, status:"open"|"reviewed"|"dismissed", aiVerdict:{...}, createdAt }
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";

// ═══════════════════════════════════════════════════════════════════════
// ① تصنيفات البلاغات
// ═══════════════════════════════════════════════════════════════════════

export const REPORT_CATEGORIES = [
  { id: "spam", name: "سبام / إزعاج", severity: "medium", icon: "📢", description: "رسائل متكررة أو ترويجية" },
  { id: "abuse", name: "إساءة / شتائم", severity: "high", icon: "🤬", description: "إساءة لفظية أو شتائم" },
  { id: "harassment", name: "تنمر / تحرش", severity: "high", icon: "😈", description: "تنمر أو مضايقة متكررة" },
  { id: "cheating", name: "غش / تلاعب", severity: "high", icon: "🚫", description: "استخدام ثغرات أو غش" },
  { id: "inappropriate", name: "محتوى غير لائق", severity: "high", icon: "⛔", description: "صور أو نصوص مخلة" },
  { id: "fake_report", name: "بلاغ كيدي", severity: "low", icon: "🎭", description: "بلاغ كاذب متعمد" },
  { id: "threat", name: "تهديد", severity: "high", icon: "⚠️", description: "تهديد بالعنف أو الأذى" },
  { id: "other", name: "أخرى", severity: "medium", icon: "📝", description: "بلاغ لا يندرج تحت الفئات" },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// ② إرسال بلاغ — يخزن في reports بالشكل الصحيح
// ═══════════════════════════════════════════════════════════════════════
export const submitReport = mutation({
  args: {
    targetUserId: v.string(),
    targetName: v.string(),
    category: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
    roomId: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    // Rate limiting: max 3 reports per hour
    const oneHourAgo = Date.now() - 3600000;
    const recentReports = await ctx.db
      .query("reports")
      .filter((q) => q.and(
        q.eq(q.field("reporterId"), userId),
        q.gt(q.field("createdAt"), oneHourAgo),
      ))
      .collect();

    if (recentReports.length >= 3) {
      throw new Error("لقد أرسلت 3 بلاغات في الساعة الأخيرة — حاول لاحقاً");
    }

    // Check for duplicate report (same reporter, same target, within 24h)
    const duplicate = await ctx.db
      .query("reports")
      .filter((q) => q.and(
        q.eq(q.field("reporterId"), userId),
        q.eq(q.field("targetId"), args.targetUserId),
        q.gt(q.field("createdAt"), Date.now() - 24 * 60 * 60 * 1000),
      ))
      .first();

    if (duplicate) {
      throw new Error("لقد أرسلت بلاغاً على هذا اللاعب اليوم بالفعل");
    }

    const category = REPORT_CATEGORIES.find((c) => c.id === args.category);
    const reporter = await ctx.db.get(userId);
    const severity = category?.severity ?? "medium";

    // Build the reason string including category info
    const fullReason = `[${category?.name ?? args.category}] ${args.reason}`;

    // Convert string to Id<"users">
    const targetId = ctx.db.normalizeId("users", args.targetUserId);
    if (!targetId) throw new Error("المستخدم المُبلَّغ عنه غير موجود");

    const reportId = await ctx.db.insert("reports", {
      reporterId: userId,
      reporterName: reporter?.name ?? "مجهول",
      targetId,
      targetName: args.targetName,
      reason: fullReason,
      details: args.details,
      status: "open",
      aiVerdict: undefined,
      createdAt: Date.now(),
    });

    return { reportId, severity };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ تحليل AI للبلاغ (internal query — يُستخدم من السيرفر)
// ═══════════════════════════════════════════════════════════════════════
export const getReportData = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const report = await ctx.db.get(reportId);
    return report;
  },
});

export const getTargetHistory = internalQuery({
  args: { targetId: v.string() },
  handler: async (ctx, { targetId }) => {
    const reports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("targetId"), targetId))
      .collect();
    const logs = await ctx.db
      .query("moderationLogs")
      .filter((q) => q.eq(q.field("targetName"), targetId))
      .collect();

    return {
      reportCount: reports.length,
      previousReports: reports.slice(-5).map((r) => ({
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
      })),
      moderationCount: logs.length,
    };
  },
});

export const saveAiVerdict = internalMutation({
  args: {
    reportId: v.id("reports"),
    verdict: v.object({
      compliant: v.boolean(),
      violation: v.optional(v.string()),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      suggestedAction: v.union(
        v.literal("none"),
        v.literal("warn"),
        v.literal("mute"),
        v.literal("ban"),
      ),
      suggestedDurationMs: v.optional(v.number()),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, { reportId, verdict }) => {
    await ctx.db.patch(reportId, {
      aiVerdict: verdict,
      status: "reviewed",
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ تحليل AI للبلاغ (mutation — يُستدعى من الواجهة)
// ═══════════════════════════════════════════════════════════════════════
export const analyzeReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      return { success: false, message: "مفتاح API غير متاح" };
    }

    const report = await ctx.db.get(reportId);
    if (!report) return { success: false, message: "البلاغ غير موجود" };

    // Get target user history for context
    const targetReports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("targetId"), report.targetId))
      .collect();

    const systemPrompt = `أنت محلل بلاغات ذكي في لعبة "حرب العقول". مهمتك تحليل البلاغ بدقة عالية.

بيانات البلاغ:
- السبب: ${report.reason}
- التفاصيل: ${report.details ?? "لا توجد"}
- المُبلَّغ عنه: ${report.targetName}
- المُبلِّغ: ${report.reporterName}

سجل المُبلَّغ عنه:
- عدد البلاغات السابقة: ${targetReports.length}

أجب بتنسيق JSON فقط:
{
  "compliant": <true|false>,
  "violation": "<وصف المخالفة إن وجدت>",
  "severity": "<low|medium|high>",
  "suggestedAction": "<none|warn|mute|ban>",
  "suggestedDurationMs": <مدة العقوبة بالمللي ثانية إن وجدت أو null>,
  "reasoning": "<تحليل مختصر بالعربية>"
}`;

    try {
      // عبر callLlm — OpenRouter مع بديل OneHop (DeepSeek) تلقائي عند الفشل
      const content: string = await callLlm(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: "حلل هذا البلاغ وأعطني التقييم والإجراء المقترح بصيغة JSON" },
        ],
        512,
        0.3,
        "MindClash Report Analysis",
      );

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);

        const verdict = {
          compliant: Boolean(analysis.compliant),
          violation: analysis.violation ?? undefined,
          severity: (["low", "medium", "high"].includes(analysis.severity) ? analysis.severity : "medium") as "low" | "medium" | "high",
          suggestedAction: (["none", "warn", "mute", "ban"].includes(analysis.suggestedAction) ? analysis.suggestedAction : "none") as "none" | "warn" | "mute" | "ban",
          suggestedDurationMs: analysis.suggestedDurationMs ?? undefined,
          reasoning: analysis.reasoning ?? "تحليل تلقائي",
        };

        await ctx.db.patch(reportId, {
          aiVerdict: verdict,
          status: "reviewed",
        });

        return { success: true, verdict };
      }

      return { success: false, message: "تعذر تحليل الرد" };
    } catch (error) {
      return { success: false, message: `خطأ في التحليل: ${error}` };
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑤ جلب البلاغات للمالك
// ═══════════════════════════════════════════════════════════════════════
export const getReports = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return [];

    let q = ctx.db.query("reports");
    if (status && (status === "open" || status === "reviewed" || status === "dismissed")) {
      q = q.filter((report) => report.eq(report.field("status"), status));
    }

    const reports = await q.order("desc").take(100);
    return reports.map((r) => ({
      ...r,
      categoryInfo: REPORT_CATEGORIES.find((c) => r.reason.startsWith(`[${c.name}]`) || r.reason.includes(c.id)),
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑥ اتخاذ إجراء على بلاغ
// ═══════════════════════════════════════════════════════════════════════
export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    action: v.union(
      v.literal("dismiss"),
      v.literal("warn"),
      v.literal("mute"),
      v.literal("ban"),
      v.literal("keep_open"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { reportId, action, note }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) throw new Error("غير مصرح");

    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("البلاغ غير موجود");

    if (action === "keep_open") {
      return { success: true, message: "تم الإبقاء على البلاغ مفتوحاً" };
    }

    // Update report status
    const newStatus = action === "dismiss" ? "dismissed" : "reviewed";
    await ctx.db.patch(reportId, { status: newStatus });

    // Apply action on target user if needed
    if (action !== "dismiss") {
      const targetUser = await ctx.db.get(report.targetId);
      if (targetUser) {
        switch (action) {
          case "warn":
            await ctx.db.patch(report.targetId, {
              warnings: (targetUser.warnings ?? 0) + 1,
              lastWarningAt: Date.now(),
            });
            break;
          case "mute":
            await ctx.db.patch(report.targetId, {
              mutedUntil: Date.now() + 60 * 60 * 1000, // 1 hour
            });
            break;
          case "ban":
            await ctx.db.patch(report.targetId, {
              bannedPermanent: true,
              banReason: note ?? "حظر من نظام البلاغات الذكي",
            });
            break;
        }

        // Log the moderation action
        await ctx.db.insert("moderationLogs", {
          actorType: "owner",
          actorName: me.name ?? "المالك",
          action: action === "warn" ? "warn" : action === "mute" ? "mute" : "ban",
          targetId: report.targetId,
          targetName: report.targetName,
          reason: note ?? report.reason,
          severity: action === "ban" ? "high" : action === "mute" ? "medium" : "low",
          createdAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑦ إحصائيات البلاغات
// ═══════════════════════════════════════════════════════════════════════
export const getReportStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const reports = await ctx.db.query("reports").collect();
    const now = Date.now();
    const today = reports.filter((r) => now - r.createdAt < 24 * 60 * 60 * 1000);
    const thisWeek = reports.filter((r) => now - r.createdAt < 7 * 24 * 60 * 60 * 1000);

    const byStatus: Record<string, number> = {};
    reports.forEach((r) => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; });

    // Count AI-analyzed reports
    const withVerdict = reports.filter((r) => r.aiVerdict);
    const aiDecisions = withVerdict.length;

    return {
      total: reports.length,
      today: today.length,
      thisWeek: thisWeek.length,
      open: byStatus["open"] ?? 0,
      reviewed: byStatus["reviewed"] ?? 0,
      dismissed: byStatus["dismissed"] ?? 0,
      byStatus,
      aiDecisions,
    };
  },
});
