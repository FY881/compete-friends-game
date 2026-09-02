/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 MASTER AI — الدكاء الاصطناعي الأعلى الذي يتحكم في كل شيء
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function isOwnerUser(user: any): boolean {
  const OWNER_EMAILS = ["omar450@freebuff.com", "admin@freebuff.com"];
  return OWNER_EMAILS.includes(user?.email?.toLowerCase() ?? "");
}

async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("غير مصرح");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) throw new Error("غير مصرح — المالك فقط");
  return { userId, user };
}

function levelFromXp(xp: number): number {
  let level = 1;
  let xpNeeded = 100;
  let xpAccumulated = 0;
  while (xpAccumulated + xpNeeded <= xp) {
    xpAccumulated += xpNeeded;
    level++;
    xpNeeded = Math.floor(xpNeeded * 1.15);
  }
  return level;
}

async function logAIAction(
  ctx: any,
  args: {
    action: string;
    subsystem: string;
    message: string;
    severity: "info" | "warning" | "critical" | "action";
    targetUser?: string;
    targetRoom?: string;
    data?: string;
    auto?: boolean;
    executedBy?: string;
  }
) {
  await ctx.db.insert("aiLogs", {
    action: args.action,
    subsystem: args.subsystem,
    message: args.message,
    severity: args.severity,
    targetUser: args.targetUser,
    targetRoom: args.targetRoom,
    data: args.data,
    auto: args.auto ?? true,
    executedBy: args.executedBy ?? "ai_master",
    timestamp: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 1. AI MONITORING — مراقبة كل النشاط
// ═══════════════════════════════════════════════════════════════════════

export const getGameStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const allUsers = await ctx.db.query("users").collect();
    const totalUsers = allUsers.length;

    const profiles = await ctx.db.query("profiles").collect();
    const activeToday = profiles.filter((p) => (p as any).updatedAt > dayAgo).length;
    const activeWeek = profiles.filter((p) => (p as any).updatedAt > weekAgo).length;

    const allGames = await ctx.db.query("games").collect();
    const activeGames = allGames.filter((g) => g.status === "playing").length;
    const waitingGames = allGames.filter((g) => g.status === "waiting").length;
    const totalGames = allGames.length;

    const totalXP = profiles.reduce((sum, p) => sum + (p.xp || 0), 0);

    const levels: Record<string, number> = {};
    for (const p of profiles) {
      const lvl = levelFromXp(p.xp || 0);
      const bucket = lvl <= 5 ? "1-5" : lvl <= 15 ? "6-15" : lvl <= 30 ? "16-30" : "31+";
      levels[bucket] = (levels[bucket] || 0) + 1;
    }

    const reports = await ctx.db.query("reports").collect();
    const openReports = reports.filter((r: any) => r.status === "pending").length;

    const errors = await ctx.db.query("errorLogs").collect();
    const criticalErrors = errors.filter((e) => e.severity === "critical" && !e.resolved).length;

    const chatRooms = await ctx.db.query("chatRooms").collect();

    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_key", (q) => q.eq("key", "current"))
      .first();

    const aiLogs = await ctx.db
      .query("aiLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", dayAgo))
      .order("desc")
      .take(100);

    return {
      users: { total: totalUsers, activeToday, activeWeek },
      games: { total: totalGames, active: activeGames, waiting: waitingGames },
      xp: { total: totalXP, avg: profiles.length > 0 ? Math.round(totalXP / profiles.length) : 0 },
      levels,
      reports: { total: reports.length, open: openReports },
      errors: { total: errors.length, critical: criticalErrors },
      chat: { rooms: chatRooms.length },
      health: health || null,
      aiActivity: aiLogs,
      timestamp: now,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2. AI AUTO-MODERATION — الرقابة التلقائية الذكية
// ═══════════════════════════════════════════════════════════════════════

export const autoModerate = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const allUsers = await ctx.db.query("users").collect();
    let actionsTaken = 0;
    const details: string[] = [];

    for (const target of allUsers) {
      const strikes = (target as any).cheatStrikes || 0;
      const alreadyBanned = (target as any).bannedPermanent || ((target as any).bannedUntil || 0) > Date.now();
      if (alreadyBanned) continue;

      if (strikes >= 5) {
        await ctx.db.patch(target._id, { bannedPermanent: true, banReason: "AI auto-ban: 5+ cheat strikes" });
        await logAIAction(ctx, {
          action: "auto_ban", subsystem: "moderation",
          message: `Auto-permanent ban: ${(target as any).name || "unknown"} (${strikes} strikes)`,
          severity: "critical", targetUser: (target as any).name, auto: true, executedBy: "ai_master",
        });
        actionsTaken++;
        details.push(`banned: ${(target as any).name}`);
      } else if (strikes >= 3) {
        await ctx.db.patch(target._id, { bannedUntil: Date.now() + 3600000, banReason: "AI auto temp ban" });
        await logAIAction(ctx, {
          action: "auto_temp_ban", subsystem: "moderation",
          message: `Auto temp ban (1h): ${(target as any).name || "unknown"} (${strikes} strikes)`,
          severity: "warning", targetUser: (target as any).name, auto: true, executedBy: "ai_master",
        });
        actionsTaken++;
        details.push(`temp ban: ${(target as any).name}`);
      }
    }

    await logAIAction(ctx, {
      action: "auto_moderation_sweep", subsystem: "moderation",
      message: `Moderation sweep: ${actionsTaken} actions${details.length > 0 ? ". " + details.join("; ") : ". Clean."}`,
      severity: actionsTaken > 0 ? "action" : "info", auto: true, executedBy: "ai_master",
    });

    return { actionsTaken, details };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3. AI ECONOMY — تحليل الاقتصاد
// ═══════════════════════════════════════════════════════════════════════

export const analyzeEconomy = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    if (profiles.length === 0) return { status: "no_data", players: 0 };

    const xpValues = profiles.map((p) => p.xp || 0);
    const totalXP = xpValues.reduce((a, b) => a + b, 0);
    const avgXP = Math.round(totalXP / profiles.length);

    const sorted = [...xpValues].sort((a, b) => b - a);
    const top10Count = Math.max(1, Math.ceil(profiles.length * 0.1));
    const top10Avg = Math.round(sorted.slice(0, top10Count).reduce((a, b) => a + b, 0) / top10Count);
    const bottom10Avg = Math.round(sorted.slice(-top10Count).reduce((a, b) => a + b, 0) / top10Count);
    const inequalityRatio = bottom10Avg > 0 ? Math.round(top10Avg / bottom10Avg) : 999;

    const gamesPlayed = profiles.map((p) => p.gamesPlayed || 0);
    const avgGames = Math.round(gamesPlayed.reduce((a, b) => a + b, 0) / profiles.length);
    const activePlayers = profiles.filter((p) => (p.gamesPlayed || 0) > 0).length;
    const engagementRate = Math.round((activePlayers / profiles.length) * 100);

    const winRates = profiles
      .filter((p) => (p.gamesPlayed || 0) >= 5)
      .map((p) => Math.round(((p.gamesWon || 0) / (p.gamesPlayed || 1)) * 100));
    const avgWinRate = winRates.length > 0 ? Math.round(winRates.reduce((a, b) => a + b, 0) / winRates.length) : 0;

    return {
      totalXP, avgXP, inequalityRatio, top10AvgXP: top10Avg, bottom10AvgXP: bottom10Avg,
      avgGamesPerPlayer: avgGames, activePlayers, totalPlayers: profiles.length,
      engagementRate, avgWinRate,
      health: inequalityRatio < 5 ? "balanced" : inequalityRatio < 10 ? "mild_inequality" : "high_inequality",
      recommendation: inequalityRatio > 10 ? "XP gap too high." : engagementRate < 30 ? "Low engagement." : "Economy healthy.",
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4. AI PLAYER ANALYSIS — تحليل اللاعبين
// ═══════════════════════════════════════════════════════════════════════

export const getPlayerAnalytics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    const profiles = await ctx.db.query("profiles").withIndex("by_xp", (q) => q.gte("xp", 0)).order("desc").take(limit);
    const players = [];
    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (!user) continue;
      const strikes = (user as any).cheatStrikes || 0;
      const warnings = (user as any).warnings || 0;
      const banned = (user as any).bannedPermanent || ((user as any).bannedUntil || 0) > Date.now();
      const muted = ((user as any).mutedUntil || 0) > Date.now();
      let riskScore = Math.min(100, strikes * 20 + warnings * 10);
      if (banned) riskScore = 100;
      players.push({
        id: profile.userId, name: (user as any).name || "unknown",
        xp: profile.xp, level: levelFromXp(profile.xp || 0),
        gamesPlayed: profile.gamesPlayed || 0, gamesWon: profile.gamesWon || 0,
        winRate: profile.gamesPlayed ? Math.round(((profile.gamesWon || 0) / profile.gamesPlayed) * 100) : 0,
        cheatStrikes: strikes, warnings, banned, muted, riskScore,
        lastActive: (user as any).updatedAt || 0,
      });
    }
    return players;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5. AI REPORT — تقرير شامل
// ═══════════════════════════════════════════════════════════════════════

export const generateReport = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const profiles = await ctx.db.query("profiles").collect();
    const games = await ctx.db.query("games").collect();
    const reports = await ctx.db.query("reports").collect();
    const errors = await ctx.db.query("errorLogs").collect();

    const aiLogs = await ctx.db.query("aiLogs").withIndex("by_timestamp", (q) => q.gte("timestamp", dayAgo)).order("desc").take(50);

    const activeToday = profiles.filter((p) => (p as any).updatedAt > dayAgo).length;
    const gamesToday = games.filter((g) => (g as any).createdAt > dayAgo).length;
    const errorsToday = errors.filter((e) => e.createdAt > dayAgo).length;
    const criticalErrors = errors.filter((e) => e.severity === "critical" && !e.resolved).length;
    const openReports = reports.filter((r: any) => r.status === "pending").length;
    const aiActionsToday = aiLogs.filter((l) => l.auto).length;
    const ownerCommandsToday = aiLogs.filter((l) => !l.auto).length;

    return {
      summary: { activeToday, gamesToday, errorsToday, criticalErrors, openReports, totalUsers: profiles.length, totalGames: games.length },
      aiActivity: { autoActions: aiActionsToday, ownerCommands: ownerCommandsToday, totalLogs: aiLogs.length },
      recentLogs: aiLogs.slice(0, 20),
      generatedAt: now,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 6. AI COMMANDS — أوامر المالك
// ═══════════════════════════════════════════════════════════════════════

export const executeCommand = mutation({
  args: { command: v.string(), target: v.optional(v.string()), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const cmd = args.command.toLowerCase().trim();

    if (cmd.startsWith("ban ") || cmd === "ban") {
      const targetName = args.target || cmd.replace("ban ", "").trim();
      const users = await ctx.db.query("users").collect();
      const target = users.find((u) => (u as any).name?.toLowerCase() === targetName.toLowerCase());
      if (target) {
        await ctx.db.patch(target._id, { bannedPermanent: true, banReason: args.reason || "Owner ban" });
        await logAIAction(ctx, { action: "owner_ban", subsystem: "moderation", message: `Owner banned ${(target as any).name}`, severity: "critical", targetUser: (target as any).name, auto: false, executedBy: "owner" });
        return { success: true, result: `Banned ${(target as any).name}` };
      }
      return { success: false, result: `User "${targetName}" not found` };
    }

    if (cmd.startsWith("unban ") || cmd === "unban") {
      const targetName = args.target || cmd.replace("unban ", "").trim();
      const users = await ctx.db.query("users").collect();
      const target = users.find((u) => (u as any).name?.toLowerCase() === targetName.toLowerCase());
      if (target) {
        await ctx.db.patch(target._id, { bannedPermanent: false, bannedUntil: undefined, banReason: undefined });
        await logAIAction(ctx, { action: "owner_unban", subsystem: "moderation", message: `Owner unbanned ${(target as any).name}`, severity: "action", targetUser: (target as any).name, auto: false, executedBy: "owner" });
        return { success: true, result: `Unbanned ${(target as any).name}` };
      }
      return { success: false, result: `User "${targetName}" not found` };
    }

    if (cmd === "sweep" || cmd === "moderate") {
      const allUsers = await ctx.db.query("users").collect();
      let swept = 0;
      for (const target of allUsers) {
        if ((target as any).cheatStrikes >= 5 && !(target as any).bannedPermanent) {
          await ctx.db.patch(target._id, { bannedPermanent: true, banReason: "AI sweep: 5+ strikes" });
          swept++;
        }
      }
      await logAIAction(ctx, { action: "owner_sweep", subsystem: "moderation", message: `Owner sweep: ${swept} banned`, severity: "action", auto: false, executedBy: "owner" });
      return { success: true, result: `Sweep: ${swept} banned` };
    }

    if (cmd === "status") {
      const profiles = await ctx.db.query("profiles").collect();
      const games = await ctx.db.query("games").collect();
      const errors = await ctx.db.query("errorLogs").collect();
      return { success: true, result: `Users: ${profiles.length} | Active: ${games.filter((g) => g.status === "playing").length} | Errors: ${errors.filter((e) => !e.resolved).length}` };
    }

    return { success: false, result: `Unknown: "${cmd}". Use: ban, unban, sweep, status` };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 7. AI LOGS — سجل الأنشطة
// ═══════════════════════════════════════════════════════════════════════

export const getAILogs = query({
  args: { limit: v.optional(v.number()), subsystem: v.optional(v.string()), severity: v.optional(v.string()), autoOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    const logs = await ctx.db.query("aiLogs").withIndex("by_timestamp").order("desc").take(500);
    let filtered = logs;
    if (args.subsystem) filtered = filtered.filter((l) => l.subsystem === args.subsystem);
    if (args.severity) filtered = filtered.filter((l) => l.severity === args.severity);
    if (args.autoOnly) filtered = filtered.filter((l) => l.auto);
    return filtered.slice(0, limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 8. AI LIVE STATUS — الحالة اللحظية
// ═══════════════════════════════════════════════════════════════════════

export const getLiveStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const health = await ctx.db.query("systemHealth").withIndex("by_key", (q) => q.eq("key", "current")).first();
    const recentErrors = await ctx.db.query("errorLogs").withIndex("by_created", (q) => q.gte("createdAt", fiveMinAgo)).take(10);
    const allGames = await ctx.db.query("games").collect();
    const playingNow = allGames.filter((g) => g.status === "playing").length;
    const lobbyNow = allGames.filter((g) => g.status === "waiting").length;
    const recentAI = await ctx.db.query("aiLogs").withIndex("by_timestamp", (q) => q.gte("timestamp", fiveMinAgo)).order("desc").take(10);
    return {
      server: { status: health?.status || "healthy", errorRate: health?.errorRate || 0, avgFps: health?.avgFps || 0, uptime: health?.uptime || 0 },
      games: { playing: playingNow, lobby: lobbyNow },
      errors: { count: recentErrors.length, critical: recentErrors.filter((e) => e.severity === "critical").length },
      aiActions: recentAI,
      timestamp: now,
    };
  },
});
