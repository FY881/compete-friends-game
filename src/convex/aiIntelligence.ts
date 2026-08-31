import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ═══════════════════════════════════════════════════════════════════════
// ║ 4.1 نظام التنبؤ بالمشاكل (Problem Prediction System)
// ═══════════════════════════════════════════════════════════════════════

export const predictProblems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const predictions: {
      id: string;
      category: string;
      severity: "low" | "medium" | "high";
      title: string;
      detail: string;
      suggestedFix: string;
      confidence: number;
      createdAt: number;
    }[] = [];

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // 1. Player churn prediction
    const profiles = await ctx.db.query("profiles").collect();
    const activeUsers = new Set<string>();
    const recentGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_user")
      .collect();
    for (const g of recentGames) {
      if (g.playedAt > weekAgo) activeUsers.add(g.userId);
    }
    const totalPlayers = profiles.length;
    const activeCount = activeUsers.size;
    const churnRate = totalPlayers > 0 ? (totalPlayers - activeCount) / totalPlayers : 0;

    if (churnRate > 0.4 && totalPlayers > 5) {
      predictions.push({
        id: "churn-high",
        category: "player_engagement",
        severity: "high",
        title: "نسبة هجر اللاعبين مرتفعة",
        detail: `${Math.round(churnRate * 100)}% من اللاعبين لم يلعبوا خلال الأسبوع الأخير (${totalPlayers - activeCount} من ${totalPlayers})`,
        suggestedFix: "أطلق حدثاً مفاجئاً أو أرسل إشعارات تحفيزية للاعبين غير النشطين",
        confidence: Math.min(0.95, 0.5 + churnRate),
        createdAt: now,
      });
    }

    // 2. Room health prediction
    const liveGames = await ctx.db
      .query("games")
      .collect();
    const staleRooms = liveGames.filter(
      (g) => g.status === "waiting" && now - g.createdAt > 60 * 60 * 1000,
    );
    if (staleRooms.length > 3) {
      predictions.push({
        id: "stale-rooms",
        category: "room_health",
        severity: "medium",
        title: "غرف ميتة تزداد",
        detail: `يوجد ${staleRooms.length} غرف انتظار نشطة منذ أكثر من ساعة بدون لاعبين`,
        suggestedFix: "نظّف الغرف القديمة تلقائياً أو قلل الحد الأقصى للغرف النشطة",
        confidence: 0.85,
        createdAt: now,
      });
    }

    // 3. Report backlog prediction
    const openReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    if (openReports.length > 5) {
      predictions.push({
        id: "report-backlog",
        category: "moderation",
        severity: "high",
        title: "تراكم البلاغات المعلقة",
        detail: `يوجد ${openReports.length} بلاغ مفتوح بانتظار المراجعة`,
        suggestedFix: "راجع البلاغات العالقة فوراً أو فعّل المعالجة الآلية للبلاغات القديمة",
        confidence: 0.9,
        createdAt: now,
      });
    }

    // 4. Economy health (daily challenge participation)
    const today = new Date().toISOString().slice(0, 10);
    const todayChallenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_day", (q) => q.eq("day", today))
      .collect();
    const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
    const yesterdayChallenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_day", (q) => q.eq("day", yesterday))
      .collect();
    if (yesterdayChallenges.length > 0 && todayChallenges.length < yesterdayChallenges.length * 0.5) {
      predictions.push({
        id: "activity-drop",
        category: "engagement",
        severity: "medium",
        title: "انخفاض النشاط اليومي",
        detail: `dukros(${todayChallenges.length}) مقارنة بأمس (${yesterdayChallenges.length}) — انخفاض أكثر من 50%`,
        suggestedFix: "أطلق تحدياً مفاجئاً أو حدثاً موسمياً لرفع التفاعل",
        confidence: 0.75,
        createdAt: now,
      });
    }

    // 5. Cheat detection pattern
    const cheatUsers = await ctx.db
      .query("users")
      .collect();
    const cheaters = cheatUsers.filter(
      (u) => (u.cheatStrikes ?? 0) >= 3,
    );
    if (cheaters.length > 0) {
      predictions.push({
        id: "cheat-pattern",
        category: "fairness",
        severity: "high",
        title: "لاعبون متكررو الغش",
        detail: `${cheaters.length} لاعب لديهم 3 أو أكثر من مخالفة الغش المسجلة`,
        suggestedFix: "راجع سجلات الغش وفعّل الحظر التلقائي للمخالفة المتكررة",
        confidence: 0.95,
        createdAt: now,
      });
    }

    return {
      predictions,
      summary: `تم اكتشاف ${predictions.length} مشكلة محتملة`,
      generatedAt: now,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ║ 4.2 تقييم AI الذاتي (Self-Evaluation)
// ═══════════════════════════════════════════════════════════════════════

export const getSelfEvaluation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Count moderation actions
    const allLogs = await ctx.db.query("moderationLogs").collect();
    const recentLogs = allLogs.filter((l) => l.createdAt > weekAgo);
    const aiActions = recentLogs.filter((l) => l.actorType === "ai");
    const ownerActions = recentLogs.filter((l) => l.actorType === "owner");

    // Count auto-admin reports
    const adminReports = await ctx.db.query("adminReports").collect();
    const recentReports = adminReports.filter((r) => r.createdAt > weekAgo);
    const totalAutoFixes = recentReports.reduce(
      (sum, r) => sum + r.stats.autoFixes,
      0,
    );
    const totalPunishments = recentReports.reduce(
      (sum, r) => sum + r.stats.punishmentsApplied,
      0,
    );

    // Count client errors
    const errors = await ctx.db.query("clientErrors").collect();
    const recentErrors = errors.filter((e) => e.lastSeen > dayAgo);
    const totalErrorCount = recentErrors.reduce((sum, e) => sum + e.count, 0);

    // Reports resolved vs pending
    const openReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const resolvedReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "reviewed"))
      .collect();

    // Score components (0-100 each)
    const moderationScore = Math.min(
      100,
      Math.round(
        (totalAutoFixes / Math.max(1, openReports.length + totalPunishments)) *
          100,
      ),
    );
    const responseScore = Math.min(
      100,
      Math.round(
        (resolvedReports.length /
          Math.max(1, resolvedReports.length + openReports.length)) *
          100,
      ),
    );
    const stabilityScore = Math.max(
      0,
      100 - Math.min(100, totalErrorCount * 2),
    );
    const activityScore = Math.min(
      100,
      Math.round(
        (recentLogs.length / Math.max(1, 7)) * 10,
      ),
    );

    const overallScore = Math.round(
      (moderationScore * 0.3 +
        responseScore * 0.3 +
        stabilityScore * 0.25 +
        activityScore * 0.15),
    );

    return {
      overallScore,
      breakdown: {
        moderation: { score: moderationScore, label: "فعالية الرقابة" },
        response: { score: responseScore, label: "سرعة الاستجابة" },
        stability: { score: stabilityScore, label: "استقرار النظام" },
        activity: { score: activityScore, label: "مستوى النشاط" },
      },
      stats: {
        aiActionsThisWeek: aiActions.length,
        ownerActionsThisWeek: ownerActions.length,
        autoFixesThisWeek: totalAutoFixes,
        punishmentsThisWeek: totalPunishments,
        openReports: openReports.length,
        resolvedReports: resolvedReports.length,
        activeErrors: recentErrors.length,
        totalErrorCount,
      },
      recommendations: generateRecommendations(
        moderationScore,
        responseScore,
        stabilityScore,
        activityScore,
        openReports.length,
        recentErrors.length,
      ),
      evaluatedAt: now,
    };
  },
});

function generateRecommendations(
  modScore: number,
  respScore: number,
  stabScore: number,
  actScore: number,
  openReports: number,
  errors: number,
): string[] {
  const recs: string[] = [];
  if (modScore < 50) recs.push("فعّل المعالجة الآلية للبلاغات القديمة لرفع فعالية الرقابة");
  if (respScore < 50) recs.push(`يوجد ${openReports} بلاغ مفتوح — راجعها فوراً`);
  if (stabScore < 50) recs.push("يوجد أخطاء نشطة في النظام — تحقق من سجل الأخطاء");
  if (actScore < 30) recs.push("النشاط منخفض — أطلق أحداثاً تحفيزية");
  if (recs.length === 0) recs.push("الأداء ممتاز — استمر!");
  return recs;
}

// ═══════════════════════════════════════════════════════════════════════
// ║ 5. نظام أوامر متقدمة للمالك (Advanced Command System)
// ═══════════════════════════════════════════════════════════════════════

export const executeOwnerCommand = mutation({
  args: {
    command: v.string(),
    targetUserId: v.optional(v.id("users")),
    params: v.optional(v.string()),
  },
  handler: async (ctx, { command, targetUserId, params }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const now = Date.now();
    let result = "";
    let reversible = false;
    const targetName = targetUserId
      ? (await ctx.db.get(targetUserId))?.name ?? "مجهول"
      : undefined;

    switch (command) {
      case "ban": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        const reason = params ?? "أمر مباشر من المالك";
        await ctx.db.patch(targetUserId, {
          bannedPermanent: true,
          banReason: reason,
        });
        result = `تم حظر ${targetName} نهائياً — السبب: ${reason}`;
        reversible = true;
        break;
      }
      case "unban": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        await ctx.db.patch(targetUserId, {
          bannedPermanent: false,
          bannedUntil: undefined,
          banReason: undefined,
        });
        result = `تم رفع الحظر عن ${targetName}`;
        reversible = true;
        break;
      }
      case "mute": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        const durationMs = params ? parseInt(params) * 60000 : 30 * 60000;
        await ctx.db.patch(targetUserId, {
          mutedUntil: now + durationMs,
        });
        result = `تم كتم ${targetName} لمدة ${Math.round(durationMs / 60000)} دقيقة`;
        reversible = true;
        break;
      }
      case "unmute": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        await ctx.db.patch(targetUserId, { mutedUntil: undefined });
        result = `تم رفع الكتم عن ${targetName}`;
        break;
      }
      case "warn": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        const user2 = await ctx.db.get(targetUserId);
        const warnings = (user2?.warnings ?? 0) + 1;
        await ctx.db.patch(targetUserId, {
          warnings,
          lastWarningAt: now,
        });
        result = `تم إنذار ${targetName} (إنذار رقم ${warnings})`;
        break;
      }
      case "reset_warnings": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        await ctx.db.patch(targetUserId, {
          warnings: 0,
          lastWarningAt: undefined,
        });
        result = `تم مسح إنذارات ${targetName}`;
        break;
      }
      case "set_admin": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        await ctx.db.patch(targetUserId, { role: "admin" });
        result = `تم تعيين ${targetName} كمسؤول`;
        break;
      }
      case "remove_admin": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        await ctx.db.patch(targetUserId, { role: "user" });
        result = `تم إزالة صلاحية المسؤول عن ${targetName}`;
        break;
      }
      case "backup_player": {
        if (!targetUserId) throw new Error("يجب تحديد المستخدم");
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", targetUserId!))
          .first();
        const history = await ctx.db
          .query("gameHistory")
          .withIndex("by_user", (q) => q.eq("userId", targetUserId!))
          .collect();
        await ctx.db.insert("playerBackups", {
          userId: targetUserId,
          backupData: JSON.stringify({ profile, historyCount: history.length }),
          createdAt: now,
        });
        result = `تم نسخ بيانات ${targetName} احتياطياً`;
        break;
      }
      case "clean_stale_rooms": {
        const stale = await ctx.db.query("games").collect();
        let cleaned = 0;
        for (const g of stale) {
          if (g.status === "waiting" && now - g.createdAt > 3 * 60 * 60 * 1000) {
            await ctx.db.delete(g._id);
            cleaned++;
          }
        }
        result = `تم تنظيف ${cleaned} غرفة قديمة`;
        break;
      }
      case "broadcast": {
        if (!params) throw new Error("يجب كتابة رسالة الإذاعة");
        await ctx.db.insert("notifications", {
          userId: "__all__",
          title: "إذاعة من الإدارة",
          body: params,
          type: "info",
          read: false,
          createdAt: now,
        });
        result = `تم إرسال الإذاعة: ${params.slice(0, 50)}...`;
        break;
      }
      case "system_stats": {
        const users = await ctx.db.query("users").collect();
        const games = await ctx.db.query("games").collect();
        const profiles2 = await ctx.db.query("profiles").collect();
        result = JSON.stringify({
          totalUsers: users.length,
          totalGames: games.length,
          activeGames: games.filter((g) => g.status === "playing").length,
          totalProfiles: profiles2.length,
        });
        break;
      }
      default:
        throw new Error(`أمر غير معروف: ${command}`);
    }

    // Log the action
    await ctx.db.insert("ownerActions", {
      action: command,
      targetUserId: targetUserId ?? undefined,
      targetName,
      details: result,
      reversible,
      undone: false,
      createdAt: now,
    });

    // Also add to moderation logs
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: user.name ?? "المالك",
      action: command,
      targetId: targetUserId ?? undefined,
      targetName: targetName ?? "النظام",
      reason: params ?? command,
      severity: command === "ban" ? "high" : command === "mute" ? "medium" : "low",
      createdAt: now,
    });

    return { success: true, result };
  },
});

// Undo reversible owner actions
export const undoOwnerAction = mutation({
  args: { actionId: v.id("ownerActions") },
  handler: async (ctx, { actionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const action = await ctx.db.get(actionId);
    if (!action) throw new Error("الإجراء غير موجود");
    if (!action.reversible) throw new Error("هذا الإجراء لا يمكن التراجع عنه");
    if (action.undone) throw new Error("تم التراجع عن هذا الإجراء مسبقاً");

    if (action.action === "ban" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, {
        bannedPermanent: false,
        bannedUntil: undefined,
        banReason: undefined,
      });
    } else if (action.action === "unban" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, {
        bannedPermanent: true,
        banReason: "تم الحظر مجدداً via تراجع",
      });
    } else if (action.action === "mute" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, { mutedUntil: undefined });
    } else if (action.action === "set_admin" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, { role: "user" });
    } else if (action.action === "remove_admin" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, { role: "admin" });
    } else {
      throw new Error("لا يمكن التراجع عن هذا الإجراء");
    }

    await ctx.db.patch(actionId, { undone: true });
    return { success: true, message: `تم التراجع عن: ${action.action}` };
  },
});

// Get command history for audit
export const getCommandHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const actions = await ctx.db
      .query("ownerActions")
      .withIndex("by_created")
      .order("desc")
      .take(limit ?? 50);

    return actions.map((a) => ({
      id: a._id,
      action: a.action,
      targetName: a.targetName,
      details: a.details,
      reversible: a.reversible,
      undone: a.undone,
      createdAt: a.createdAt,
    }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ║ 6. نظام تيليجرام (Telegram Integration)
// ═══════════════════════════════════════════════════════════════════════

// Note: Actual Telegram API calls require a server-side function.
// This stores the configuration and queues messages.
// The HTTP handler or cron job would process the queue.

export const sendTelegramNotification = mutation({
  args: {
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, { message, priority }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    // Store notification in settings for now (actual Telegram API needs HTTP endpoint)
    const key = `tg_pending_${Date.now()}`;
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({ message, priority, sentAt: Date.now() }),
    });

    // Also send as in-app notification
    await ctx.db.insert("notifications", {
      userId: "__all__",
      title: `تنبيه [${priority}]`,
      body: message,
      type: priority === "high" ? "warning" : "info",
      read: false,
      createdAt: Date.now(),
    });

    return { success: true, queued: true };
  },
});

// Telegram webhook receiver (HTTP endpoint would call this)
export const processTelegramCommand = internalMutation({
  args: {
    command: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, { command, chatId }) => {
    const now = Date.now();

    // Store the received command
    await ctx.db.insert("settings", {
      key: `tg_cmd_${now}`,
      value: JSON.stringify({
        command,
        chatId,
        processedAt: now,
      }),
    });

    return { received: true };
  },
});

// Get pending Telegram messages
export const getPendingTelegramMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("غير مصرح");

    const settings = await ctx.db
      .query("settings")
      .collect();
    const pending = settings
      .filter((s) => s.key.startsWith("tg_pending_"))
      .map((s) => {
        const data = JSON.parse(s.value);
        return { key: s.key, ...data };
      })
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, 20);

    return pending;
  },
});
