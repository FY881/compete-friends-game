/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚖️ LAW ENFORCEMENT AI — نظام إنفاذ القوانين الذكي
 * ═══════════════════════════════════════════════════════════════════════
 *
 * AI that monitors chat rooms, challenges, and the community.
 * Receives reports, analyzes them against 20 strict rules,
 * determines validity and severity, and suggests/executes actions.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ═══════════════════════════════════════════════════════════════════════
// THE 20 RULES — القوانين العشرون
// ═══════════════════════════════════════════════════════════════════════

export const RULES = [
  { id: 1, title: "منع السبام", desc: "يُمنع إرسال رسائل متكررة أو مزعجة بشكل ممنهج.", category: "essential" as const, severity: "medium" as const },
  { id: 2, title: "منع الإساءة", desc: "يُمنع التنمر أو الإساءة اللفظية أو التحرش بأي شكل.", category: "prohibited" as const, severity: "high" as const },
  { id: 3, title: "منع الروابط المشبوهة", desc: "يُمنع مشاركة روابط احتيالية أو محتوى مشبوه.", category: "prohibited" as const, severity: "high" as const },
  { id: 4, title: "منع انتحال الهوية", desc: "يُمنع انتحال هوية لاعب آخر أو الإدارة.", category: "prohibited" as const, severity: "high" as const },
  { id: 5, title: "منع الغش", desc: "يُمنع الغش أو استغلال ثغرات اللعبة.", category: "prohibited" as const, severity: "high" as const },
  { id: 6, title: "منع المحتوى المثير للجدل", desc: "يُمنع نشر محتوى سياسي أو ديني مثير للجدل.", category: "essential" as const, severity: "medium" as const },
  { id: 7, title: "منع المحتوى غير اللائق", desc: "يُمنع نشر محتوى إباحي أو غير لائق.", category: "prohibited" as const, severity: "high" as const },
  { id: 8, title: "منع التحريض", desc: "يُمنع التحريض على العنف أو الكراهية.", category: "prohibited" as const, severity: "high" as const },
  { id: 9, title: "منع الإزعاج المتكرر", desc: "يُمنع إزعاج لاعب آخر بشكل متكرر بعد طلب التوقف.", category: "prohibited" as const, severity: "medium" as const },
  { id: 10, title: "منع الحسابات المتعددة", desc: "يُمنع استخدام أكثر من حساب لتجاوز الأنظمة.", category: "prohibited" as const, severity: "high" as const },
  { id: 11, title: "منع بيع/شراء الحسابات", desc: "يُمنع بيع أو شراء الحسابات أو العناصر بشكل غير قانوني.", category: "prohibited" as const, severity: "high" as const },
  { id: 12, title: "حماية الخصوصية", desc: "يُمنع مشاركة معلومات شخصية للآخرين بدون إذنهم.", category: "essential" as const, severity: "high" as const },
  { id: 13, title: "منع التلاعب بالنتائج", desc: "يُمنع التلاعب بنتائج التحديات أو الترتيب.", category: "prohibited" as const, severity: "high" as const },
  { id: 14, title: "منع الغرف الخبيثة", desc: "يُمنع إنشاء غرف بهدف النشاط الخبيث أو الإزعاج المنظم.", category: "prohibited" as const, severity: "high" as const },
  { id: 15, title: "احترام القرارات", desc: "يُمنع تجاهل قرارات المشرفين أو الإدارة بشكل متكرر.", category: "essential" as const, severity: "medium" as const },
  { id: 16, title: "منع البرامج غير المصرح بها", desc: "يُمنع استخدام برامج أو أدوات غير مصرح بها تؤثر على اللعب.", category: "prohibited" as const, severity: "high" as const },
  { id: 17, title: "منع كراهية المجموعات", desc: "يُمنع نشر محتوى يحرض على الكراهية ضد أي مجموعة.", category: "prohibited" as const, severity: "high" as const },
  { id: 18, title: "منع إساءة البلاغات", desc: "يُمنع استغلال نظام البلاغات بشكل خبيث أو متكرر دون مبرر.", category: "essential" as const, severity: "medium" as const },
  { id: 19, title: "منع الرسائل الجماعية", desc: "يُمنع إرسال رسائل مزعجة أو ترويجية بالجملة بدون إذن.", category: "essential" as const, severity: "medium" as const },
  { id: 20, title: "حماية المجتمع", desc: "يُمنع أي سلوك يضر بتجربة اللاعبين أو استقرار المجتمع.", category: "essential" as const, severity: "high" as const },
];

// ═══════════════════════════════════════════════════════════════════════
// SEED RULES — إدخال القوانين في قاعدة البيانات
// ═══════════════════════════════════════════════════════════════════════

export const seedRules = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db.query("rules").collect();
    if (existing.length >= 20) return { message: "Rules already seeded", count: existing.length };

    let added = 0;
    for (const rule of RULES) {
      const alreadyExists = existing.find((r) => r.title === rule.title);
      if (!alreadyExists) {
        await ctx.db.insert("rules", {
          title: rule.title,
          category: rule.category,
          description: rule.desc,
          severity: rule.severity,
          order: rule.id,
          active: true,
        });
        added++;
      }
    }
    return { message: `Added ${added} rules`, total: existing.length + added };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ANALYZE REPORT — تحليل البلاغ بالذكاء الاصطناعي
// ═══════════════════════════════════════════════════════════════════════

interface AnalysisResult {
  valid: boolean;
  confidence: number; // 0-100
  matchedRules: number[];
  severity: "low" | "medium" | "high";
  suggestedAction: "none" | "warn" | "mute" | "ban";
  suggestedDurationMs?: number;
  reasoning: string;
}

function analyzeReport(
  reportReason: string,
  reportDetails: string,
  reporterHistory: { reportCount: number; falseReports: number },
  targetHistory: { warnings: number; cheatStrikes: number; priorReports: number; mutedUntil: number; bannedUntil: number },
): AnalysisResult {
  const reason = `${reportReason} ${reportDetails}`.toLowerCase();
  const matchedRules: number[] = [];
  let maxSeverity: "low" | "medium" | "high" = "low";
  const severityOrder = { low: 0, medium: 1, high: 2 };

  // Pattern matching against rules
  const patterns: { ruleId: number; keywords: string[] }[] = [
    { ruleId: 1, keywords: ["سبام", "تكرار", "رسائل متكررة", "spam", "مزعج"] },
    { ruleId: 2, keywords: ["إساءة", "شتائم", "تنمر", "abuse", "إهانة", "بذيء"] },
    { ruleId: 3, keywords: ["رابط", "رابط مشبوه", "احتيال", "link", "phishing"] },
    { ruleId: 4, keywords: ["انتحال", "هوية مزيفة", "impersonate", "تنكرة"] },
    { ruleId: 5, keywords: ["غش", "cheat", "ثغرة", "glitch", "تلاعب"] },
    { ruleId: 6, keywords: ["سياسي", "ديني", "جدل", "politic", "عقيدة"] },
    { ruleId: 7, keywords: ["إباحي", "غير لائق", "عري", "porn", "sexual"] },
    { ruleId: 8, keywords: ["عنف", "كراهية", "تحريض", "violence", "kill", "hate"] },
    { ruleId: 9, keywords: ["إزعاج", "مضايقة", "harass"] },
    { ruleId: 10, keywords: ["حسابات متعددة", "multi", "حساب ثانٍ"] },
    { ruleId: 11, keywords: ["بيع", "شراء", "sell", "buy", "account"] },
    { ruleId: 12, keywords: ["شخصي", "هاتف", "اسم عائلة", "address", "personal"] },
    { ruleId: 13, keywords: ["تلاعب بالنتيجة", "stream sniping"] },
    { ruleId: 14, keywords: ["غرفة خبيثة", "malicious", "تنظيم", "organized"] },
    { ruleId: 15, keywords: ["تجاهل المشرف", "ignores mod", "لا يمتثل"] },
    { ruleId: 16, keywords: ["برنامج", "أداة", "bot", "hack", "mod menu"] },
    { ruleId: 17, keywords: ["كراهية", "تمييز", "عرق", "hate speech", "bigotry"] },
    { ruleId: 18, keywords: ["بلاغ كيدي", "false report", "إساءة البلاغ"] },
    { ruleId: 19, keywords: ["رسائل جماعية", "broadcast", "ترويج", "promotional"] },
    { ruleId: 20, keywords: ["ضرر بالمجتمع", "community harm", "instability"] },
  ];

  for (const { ruleId, keywords } of patterns) {
    if (keywords.some((kw) => reason.includes(kw))) {
      matchedRules.push(ruleId);
      const rule = RULES.find((r) => r.id === ruleId);
      if (rule && severityOrder[rule.severity] > severityOrder[maxSeverity]) {
        maxSeverity = rule.severity;
      }
    }
  }

  // Fallback
  if (matchedRules.length === 0) {
    return {
      valid: false, confidence: 30, matchedRules: [], severity: "low",
      suggestedAction: "none",
      reasoning: "No matching rule found. Consider reviewing manually.",
    };
  }

  // Confidence calculation
  let confidence = 70;
  confidence += matchedRules.length * 5;
  if (reporterHistory.falseReports > 3) confidence -= 20;
  if (targetHistory.warnings > 2) confidence += 10;
  if (targetHistory.cheatStrikes > 0) confidence += 5;
  confidence = Math.min(99, Math.max(10, confidence));

  // Determine action
  let suggestedAction: "none" | "warn" | "mute" | "ban" = "warn";
  let suggestedDurationMs: number | undefined;

  if (maxSeverity === "high") {
    if (targetHistory.warnings >= 3) {
      suggestedAction = "ban";
      suggestedDurationMs = 7 * 24 * 60 * 60 * 1000;
    } else {
      suggestedAction = "mute";
      suggestedDurationMs = 24 * 60 * 60 * 1000;
    }
  } else if (maxSeverity === "medium") {
    suggestedAction = targetHistory.warnings >= 4 ? "mute" : "warn";
    if (suggestedAction === "mute") suggestedDurationMs = 60 * 60 * 1000;
  } else {
    suggestedAction = "warn";
  }

  if (targetHistory.bannedUntil > Date.now()) {
    return {
      valid: true, confidence: 100, matchedRules, severity: maxSeverity,
      suggestedAction: "none",
      reasoning: "Target is already banned. No additional action needed.",
    };
  }

  const reasoning = `Matched ${matchedRules.length} rule(s): [${matchedRules.join(",")}]. ` +
    `Target has ${targetHistory.warnings} warnings, ${targetHistory.cheatStrikes} cheat strikes. ` +
    `Reporter has ${reporterHistory.falseReports} false reports. ` +
    `Max severity: ${maxSeverity}.`;

  return { valid: true, confidence, matchedRules, severity: maxSeverity, suggestedAction, suggestedDurationMs, reasoning };
}

// ═══════════════════════════════════════════════════════════════════════
// PROCESS REPORT — معالجة البلاغ
// ═══════════════════════════════════════════════════════════════════════

export const processReport = mutation({
  args: {
    reportId: v.id("reports"),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return { error: "Report not found" };

    // Get reporter history
    const reporterId = report.reporterId;
    const allReports = await ctx.db.query("reports").collect();
    const reporterReports = allReports.filter((r) => r.reporterId === reporterId);
    const falseReports = reporterReports.filter((r) => r.status === "dismissed").length;

    // Get target history — targetId is a users._id
    const targetId = report.targetId;
    const targetUser = await ctx.db.get(targetId);
    const targetWarnings = targetUser?.warnings || 0;
    const targetStrikes = targetUser?.cheatStrikes || 0;
    const targetMuted = targetUser?.mutedUntil || 0;
    const targetBanned = targetUser?.bannedUntil || 0;
    const targetPriorReports = allReports.filter((r) => r.targetId === targetId).length;

    // Run AI analysis
    const analysis = analyzeReport(
      report.reason || "",
      report.details || "",
      { reportCount: reporterReports.length, falseReports },
      {
        warnings: targetWarnings,
        cheatStrikes: targetStrikes,
        priorReports: targetPriorReports,
        mutedUntil: targetMuted,
        bannedUntil: targetBanned,
      },
    );

    // Update report with AI verdict
    await ctx.db.patch(args.reportId, {
      aiVerdict: {
        compliant: !analysis.valid,
        violation: analysis.valid ? analysis.reasoning : undefined,
        severity: analysis.severity,
        suggestedAction: analysis.suggestedAction === "none" ? "none"
          : analysis.suggestedAction === "warn" ? "warn"
          : analysis.suggestedAction === "mute" ? "mute"
          : "ban",
        suggestedDurationMs: analysis.suggestedDurationMs,
        reasoning: analysis.reasoning,
      },
      status: "reviewed",
    });

    // Log the AI action
    await ctx.db.insert("aiLogs", {
      action: "report_analysis",
      subsystem: "reports",
      message: `AI analyzed report: ${analysis.valid ? "VALID" : "INVALID"} (${analysis.confidence}% confidence). ${analysis.reasoning}`,
      severity: analysis.severity === "high" ? "critical" : analysis.severity === "medium" ? "warning" : "info",
      targetUser: targetUser?.name,
      data: JSON.stringify({ reportId: args.reportId, matchedRules: analysis.matchedRules, confidence: analysis.confidence }),
      auto: true,
      executedBy: "ai_master",
      timestamp: Date.now(),
    });

    // Auto-execute if confidence > 80%
    let autoExecuted = false;
    if (analysis.valid && analysis.confidence > 80) {
      if (analysis.suggestedAction === "warn" && targetUser) {
        await ctx.db.patch(targetId, {
          warnings: targetWarnings + 1,
        });
        await ctx.db.insert("notifications", {
          userId: targetId,
          title: "⚠️ تحذير رسمي",
          body: `تم تحذيرك بسبب مخالفة قوانين اللعبة. تحذيرك رقم ${targetWarnings + 1}.`,
          type: "warning",
          read: false,
          createdAt: Date.now(),
        });
        autoExecuted = true;
      } else if (analysis.suggestedAction === "mute" && targetUser) {
        const duration = analysis.suggestedDurationMs || 60 * 60 * 1000;
        await ctx.db.patch(targetId, {
          mutedUntil: Date.now() + duration,
        });
        await ctx.db.insert("notifications", {
          userId: targetId,
          title: "🔇 تم كتمك مؤقتاً",
          body: `تم كتمك لمدة ${Math.round(duration / 3600000)} ساعة بسبب مخالفة القوانين.`,
          type: "warning",
          read: false,
          createdAt: Date.now(),
        });
        autoExecuted = true;
      } else if (analysis.suggestedAction === "ban" && targetUser) {
        const duration = analysis.suggestedDurationMs || 7 * 24 * 60 * 60 * 1000;
        await ctx.db.patch(targetId, {
          bannedUntil: Date.now() + duration,
          banReason: `AI auto-enforced: ${analysis.matchedRules.map((r) => RULES.find((ru) => ru.id === r)?.title).join(", ")}`,
        });
        await ctx.db.insert("notifications", {
          userId: targetId,
          title: "🚫 تم حظرك مؤقتاً",
          body: `تم حظرك لمدة ${Math.round(duration / 3600000)} ساعة بسبب مخالفة القوانين.`,
          type: "ban",
          read: false,
          createdAt: Date.now(),
        });
        autoExecuted = true;
      }
    }

    return { analysis, autoExecuted };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// GET PENDING REPORTS — البلاغات المعلقة (status === "open")
// ═══════════════════════════════════════════════════════════════════════

export const getPendingReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const reports = await ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "open")).take(limit);
    return reports.map((r) => ({
      ...r,
      aiVerdictParsed: r.aiVerdict || null,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// GET REPORT STATS — إحصائيات البلاغات
// ═══════════════════════════════════════════════════════════════════════

export const getReportStats = query({
  args: {},
  handler: async (ctx) => {
    const allReports = await ctx.db.query("reports").collect();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const todayReports = allReports.filter((r) => r.createdAt > dayAgo);
    const open = allReports.filter((r) => r.status === "open");
    const reviewed = allReports.filter((r) => r.status === "reviewed");
    const dismissed = allReports.filter((r) => r.status === "dismissed");

    const aiProcessed = allReports.filter((r) => r.aiVerdict);
    const autoResolved = reviewed.filter((r) => r.aiVerdict);

    return {
      total: allReports.length,
      today: todayReports.length,
      open: open.length,
      reviewed: reviewed.length,
      dismissed: dismissed.length,
      aiProcessed: aiProcessed.length,
      autoResolved: autoResolved.length,
      aiAccuracy: aiProcessed.length > 0 ? Math.round((autoResolved.length / aiProcessed.length) * 100) : 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// GET RULES — القوانين النشطة
// ═══════════════════════════════════════════════════════════════════════

export const getRules = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rules").collect();
  },
});
