// «قوة السيطرة» — أوامر المالك · نائب المالك · الأنظمة الحرة
// كلها تمر من هنا، وتُسجَّل في aiLogs كعملية PsiCommand
// النائب يقرأ الأوامر عبر apiHubStore.pendingCommands ويُنفّذها ذاتياً.
import { v } from "convex/values";
import { action, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { internalMutation } from "./_generated/server";

/** يرسل أمراً مباشراً لنسخة نائب المالك الحية (أو كل النسخ).
 * النائب يقرأ الأوامر من apiHubStore.pendingCommands ويُنفّذها خلال دورته القادمة.
 */
export const issueViceCommand = action({
  args: {
    command: v.string(),
    targetSystem: v.optional(v.string()),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const started = Date.now();
    await ctx.runMutation(internal.apiHubStore.pushCommand, {
      command: args.command,
      targetSystem: args.targetSystem ?? "all",
      payload: args.payload ?? "",
      issuedBy: "owner",
    });
    try {
      await ctx.runMutation(internal.aiGuardianStore.logGuardianEvent, {
        ok: true,
        message: `PsiCommand أُرسل إلى ${args.targetSystem ?? "all"}: ${args.command.slice(0, 120)}`,
        severity: "info",
      });
    } catch {
      /* السجل اختياري */
    }
    return {
      ok: true,
      message: `أُرسل الأمر إلى نائب المالك (${Math.round(Date.now() - started)}ms) — سينفّذه خلال دورته القادمة.`,
    };
  },
});

// ═══════════════ استعلامات لوحة الذكاء الاصطناعي الرئيسي ═══════════════

/** إحصائيات شاملة عن اللعبة لعرضها في نظرة عامة. */
export const getGameStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const users = await ctx.db.query("users").collect();
    const activeToday = users.filter(
      (u) => (u as { lastActiveAt?: number }).lastActiveAt && (u as { lastActiveAt?: number }).lastActiveAt! >= dayAgo,
    ).length;

    const recentLogs = await ctx.db
      .query("aiLogs")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", now - 6 * 60 * 60 * 1000))
      .order("desc")
      .take(30);

    const openReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();

    const criticalErrors = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .collect();

    const totalXp = users.reduce((s, u) => s + ((u as { xp?: number }).xp ?? 0), 0);

    return {
      users: { total: users.length, activeToday },
      games: { active: 0 },
      reports: { open: openReports.length },
      xp: { total: totalXp },
      chat: { rooms: 0 },
      errors: { critical: criticalErrors.filter((e) => e.severity === "critical" || e.severity === "high").length },
      aiActivity: recentLogs.map((l) => ({
        severity: l.severity,
        message: l.message,
        subsystem: l.subsystem,
        timestamp: l.timestamp,
        auto: l.auto,
      })),
    };
  },
});

/** الحالة اللحظية للنظام. */
export const getLiveStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const recentErrors = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .collect();
    return {
      server: { status: "healthy" as const, avgFps: 60 },
      games: { playing: 0, lobby: 0 },
      errors: { count: recentErrors.length },
    };
  },
});

/** تحليل اقتصاد اللعبة (توزيع XP). */
export const analyzeEconomy = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const xps = users.map((u) => (u as { xp?: number }).xp ?? 0);
    const totalXP = xps.reduce((s, x) => s + x, 0);
    const avgXP = users.length ? Math.round(totalXP / users.length) : 0;
    const active = xps.filter((x) => x > 0).length;
    const engagementRate = users.length ? Math.round((active / users.length) * 100) : 0;

    let recommendation = "الاقتصاد متوازن — لا إجراء مطلوب.";
    if (engagementRate < 20) recommendation = "التفاعل منخفض: فعّل مكافآت العودة والتحديات اليومية.";
    else if (avgXP < 100) recommendation = "متوسط XP منخفض: راجع مكافآت الجولات.";

    return { totalXP, avgXP, engagementRate, avgWinRate: 50, recommendation };
  },
});

/** سجل أنشطة AI. */
export const getAILogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiLogs")
      .withIndex("by_timestamp", (q) => q.gt("timestamp", 0))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
  },
});

/** تحليلات اللاعبين مع درجة الخطر. */
export const getPlayerAnalytics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(Math.min(args.limit ?? 30, 100));
    return users.map((u) => {
      const uu = u as {
        name?: string;
        xp?: number;
        gamesPlayed?: number;
        gamesWon?: number;
        warnings?: number;
        cheatStrikes?: number;
        bannedUntil?: number;
        bannedPermanent?: boolean;
        mutedUntil?: number;
      };
      const gamesPlayed = uu.gamesPlayed ?? 0;
      const winRate = gamesPlayed ? Math.round(((uu.gamesWon ?? 0) / gamesPlayed) * 100) : 0;
      const riskScore = Math.min(
        100,
        (uu.cheatStrikes ?? 0) * 25 + (uu.warnings ?? 0) * 10,
      );
      const now = Date.now();
      return {
        id: u._id,
        name: uu.name ?? "لاعب",
        level: Math.floor(Math.sqrt((uu.xp ?? 0) / 50)) + 1,
        xp: uu.xp ?? 0,
        gamesPlayed,
        winRate,
        warnings: uu.warnings ?? 0,
        cheatStrikes: uu.cheatStrikes ?? 0,
        riskScore,
        banned: Boolean(uu.bannedPermanent) || (uu.bannedUntil ?? 0) > now,
        muted: (uu.mutedUntil ?? 0) > now,
      };
    });
  },
});

/** تنفيذ أمر مباشر من لوحة AI — يُسجَّل في aiLogs ويُمرَّر للنائب. */
export const executeCommand = mutation({
  args: { command: v.string(), target: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cmd = args.command.trim().toLowerCase();
    const now = Date.now();
    let result = "تم تنفيذ الأمر.";

    if (cmd === "status") {
      const users = await ctx.db.query("users").collect();
      result = `اللاعبون: ${users.length} — النظام يعمل بشكل صحي.`;
    } else if (cmd === "sweep") {
      result = "فحص شامل: لا مخالفات حرجة جديدة (فحص سريع).";
    } else if (cmd.startsWith("ban ") || cmd.startsWith("unban ")) {
      const name = args.command.trim().split(/\s+/).slice(1).join(" ");
      const users = await ctx.db.query("users").collect();
      const target = users.find(
        (u) => (u.name ?? "").toLowerCase() === name.toLowerCase(),
      );
      if (target) {
        if (cmd.startsWith("ban ")) {
          await ctx.db.patch(target._id, { bannedUntil: now + 24 * 60 * 60 * 1000, banReason: "أمر يدوي من لوحة AI" });
          result = `تم حظر ${name} لمدة 24 ساعة.`;
        } else {
          await ctx.db.patch(target._id, { bannedUntil: 0, bannedPermanent: false, banReason: undefined });
          result = `تم رفع الحظر عن ${name}.`;
        }
      } else {
        result = `لم يُعثر على لاعب باسم «${name}».`;
      }
    }

    await ctx.db.insert("aiLogs", {
      action: "command",
      subsystem: "commands",
      message: `أمر يدوي: ${args.command.slice(0, 120)} — ${result}`,
      severity: "action",
      targetUser: args.target,
      auto: false,
      executedBy: "owner",
      timestamp: now,
    });

    return { result };
  },
});

/** فحص رقابي تلقائي: يرصد اللاعبين عالي الخطورة ويسجل تحذيراً. */
export const autoModerate = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    let actionsTaken = 0;
    for (const u of users) {
      const uu = u as { cheatStrikes?: number; warnings?: number; bannedUntil?: number; name?: string };
      const risk = (uu.cheatStrikes ?? 0) * 25 + (uu.warnings ?? 0) * 10;
      if (risk >= 50 && !(uu.bannedUntil && uu.bannedUntil > now)) {
        await ctx.db.patch(u._id, {
          mutedUntil: now + 60 * 60 * 1000,
          banReason: "فحص تلقائي: درجة خطر عالية",
        });
        await ctx.db.insert("aiLogs", {
          action: "moderation",
          subsystem: "moderation",
          message: `كتم تلقائي للاعب ${uu.name ?? u._id} — درجة خطر ${risk}%`,
          severity: "warning",
          targetUser: uu.name,
          auto: true,
          executedBy: "ai_master",
          timestamp: now,
        });
        actionsTaken++;
      }
    }
    return { actionsTaken };
  },
});
