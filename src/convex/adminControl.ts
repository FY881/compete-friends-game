/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام التحكم الإداري الشامل — 20 ميزة قوية للمالك
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

// ─── Feature 1: التحكم الكامل في حالة الأونلاين/الأوفلاين ──────────
export const setPlayerOnlineStatus = mutation({
  args: {
    userId: v.id("users"),
    isOnline: v.boolean(),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");
    const owner = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), me.email))
      .first();
    if (!owner || owner.role !== "admin") throw new Error("المالك فقط");

    // Store in settings as a JSON map
    const key = `online_status_${args.userId}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    const data = JSON.stringify({
      isOnline: args.isOnline,
      message: args.statusMessage ?? "",
      setAt: Date.now(),
    });

    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key, value: data });
    }

    return { success: true };
  },
});

// ─── Feature 2: قفل أو فتح أي قسم ──────────
export const toggleSectionLock = mutation({
  args: {
    section: v.string(),
    locked: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");
    const key = `section_lock_${args.section}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    const data = JSON.stringify({
      locked: args.locked,
      reason: args.reason ?? "",
      setAt: Date.now(),
    });

    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key, value: data });
    }

    return { success: true };
  },
});

// ─── Feature 3: مسح كاش/بيانات مؤقتة ──────────
export const clearPlayerCache = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    // Reset profile streaks and temporary data
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        dailyStreak: 0,
        lastClaimDay: undefined,
        lastPlayedDay: undefined,
        updatedAt: Date.now(),
      });
    }

    // Log the action
    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: "المالك",
      action: "cache_clear",
      targetId: args.userId,
      targetName: target?.name ?? "مجهول",
      reason: args.reason ?? "مسح كاش إداري",
      severity: "low",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ─── Feature 4: إرسال إشعار فوري وإجباري ──────────
export const sendForceNotification = mutation({
  args: {
    title: v.string(),
    message: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical"),
      v.literal("event"),
    ),
    targetUserId: v.optional(v.id("users")), // null = broadcast
  },
  handler: async (ctx, args) => {
    const key = `notification_${Date.now()}`;
    const data = JSON.stringify({
      title: args.title,
      message: args.message,
      type: args.type,
      targetUserId: args.targetUserId ?? "all",
      createdAt: Date.now(),
      read: false,
    });
    await ctx.db.insert("settings", { key, value: data });
    return { success: true };
  },
});

// ─── Feature 5: تجميد حساب لاعب ──────────
export const freezePlayer = mutation({
  args: {
    userId: v.id("users"),
    permanent: v.boolean(),
    message: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const patchData: Record<string, unknown> = {
      bannedPermanent: args.permanent,
      banReason: args.message,
      lastWarningAt: Date.now(),
    };

    if (!args.permanent && args.durationMs) {
      patchData.bannedUntil = Date.now() + args.durationMs;
    }

    await ctx.db.patch(args.userId, patchData);

    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: "المالك",
      action: args.permanent ? "ban_permanent" : "ban",
      targetId: args.userId,
      targetName: target?.name ?? "مجهول",
      reason: args.message,
      severity: "high",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ─── Feature 6: منح أو سحب أي صلاحية ──────────
export const grantOrRevokePermission = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    grant: v.boolean(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const key = `perm_${args.permission}_${args.userId}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (args.grant) {
      const data = JSON.stringify({
        granted: true,
        grantedAt: Date.now(),
        expiresAt: args.durationMs ? Date.now() + args.durationMs : null,
      });
      if (existing) {
        await ctx.db.patch(existing._id, { value: data });
      } else {
        await ctx.db.insert("settings", { key, value: data });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

// ─── Feature 7: مراقبة نشاط لاعب بشكل حي ──────────
export const getLivePlayerActivity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get recent game activity
    const recentGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const recentReports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("targetId"), args.userId))
      .order("desc")
      .take(5);

    const recentModeration = await ctx.db
      .query("moderationLogs")
      .filter((q) => q.eq(q.field("targetId"), args.userId))
      .order("desc")
      .take(5);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return {
      recentGames,
      recentReports,
      recentModeration,
      profile,
    };
  },
});

// ─── Feature 8: تعديل بيانات أي لاعب ──────────
export const editPlayerData = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    xp: v.optional(v.number()),
    level: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    // Update user name
    if (args.name !== undefined) {
      await ctx.db.patch(args.userId, { name: args.name });
    }

    // Update profile XP/level
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      const patchData: Record<string, unknown> = { updatedAt: Date.now() };
      if (args.xp !== undefined) patchData.xp = args.xp;
      await ctx.db.patch(profile._id, patchData);
    }

    return { success: true };
  },
});

// ─── Feature 9: إنشاء/حذف غرف ومجموعات ──────────
export const createCustomRoom = mutation({
  args: {
    name: v.string(),
    settings: v.string(), // JSON string of settings
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const key = `custom_room_${Date.now()}`;
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({ name: args.name, ...JSON.parse(args.settings), createdAt: Date.now() }),
    });

    return { success: true, roomId: key };
  },
});

// ─── Feature 10: التحكم في المزامنة ──────────
export const toggleSync = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "sync_enabled"))
      .first();

    const data = JSON.stringify({ enabled: args.enabled, setAt: Date.now() });
    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key: "sync_enabled", value: data });
    }

    return { success: true };
  },
});

// ─── Feature 11: وضع صيانة عام أو جزئي ──────────
export const setMaintenanceMode = mutation({
  args: {
    enabled: v.boolean(),
    message: v.optional(v.string()),
    sections: v.optional(v.array(v.string())), // empty = all
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "maintenance"))
      .first();

    const data = JSON.stringify({
      enabled: args.enabled,
      message: args.message ?? "النظام في وضع الصيانة حالياً",
      sections: args.sections ?? [],
      setAt: Date.now(),
    });

    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key: "maintenance", value: data });
    }

    return { success: true };
  },
});

// ─── Feature 12: إرسال أوامر تنفيذية ──────────
export const sendDeviceCommand = mutation({
  args: {
    command: v.union(
      v.literal("update"),
      v.literal("logout"),
      v.literal("reload"),
      v.literal("clear_data"),
      v.literal("force_update"),
    ),
    targetUserId: v.optional(v.id("users")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const key = `device_cmd_${Date.now()}`;
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({
        command: args.command,
        targetUserId: args.targetUserId ?? "all",
        message: args.message ?? "",
        createdAt: Date.now(),
        executed: false,
      }),
    });

    return { success: true };
  },
});

// ─── Feature 13: إدارة المحتوى الأوفلاين ──────────
export const manageOfflineContent = mutation({
  args: {
    contentId: v.string(),
    content: v.string(),
    contentType: v.string(),
    action: v.union(v.literal("add"), v.literal("update"), v.literal("remove")),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const key = `offline_content_${args.contentId}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (args.action === "remove") {
      if (existing) await ctx.db.delete(existing._id);
    } else {
      const data = JSON.stringify({
        content: args.content,
        contentType: args.contentType,
        updatedAt: Date.now(),
      });
      if (existing) {
        await ctx.db.patch(existing._id, { value: data });
      } else {
        await ctx.db.insert("settings", { key, value: data });
      }
    }

    return { success: true };
  },
});

// ─── Feature 14: نظام استثناءات ──────────
export const setExemption = mutation({
  args: {
    userId: v.id("users"),
    exemptFrom: v.string(), // e.g. "rate_limit", "cooldown", "ban_check"
    exempt: v.boolean(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const key = `exempt_${args.exemptFrom}_${args.userId}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (args.exempt) {
      const data = JSON.stringify({
        exempt: true,
        reason: args.reason,
        setAt: Date.now(),
      });
      if (existing) {
        await ctx.db.patch(existing._id, { value: data });
      } else {
        await ctx.db.insert("settings", { key, value: data });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

// ─── Feature 15: لوحة تحكم سريعة باللاعبين ──────────
export const getConnectedPlayers = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").take(200);
    const results = [];

    for (const user of allUsers) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      results.push({
        id: user._id,
        name: user.name ?? "مجهول",
        email: user.email ?? "ضيف",
        isOnline: false, // Will be determined by last activity
        level: profile
          ? Math.floor(Math.sqrt(profile.xp / 100)) + 1
          : 1,
        xp: profile?.xp ?? 0,
        gamesPlayed: profile?.gamesPlayed ?? 0,
        banned: user.bannedPermanent || (user.bannedUntil != null && user.bannedUntil > Date.now()),
        muted: user.mutedUntil != null && user.mutedUntil > Date.now(),
        warnings: user.warnings ?? 0,
        role: user.role ?? "user",
      });
    }

    return results;
  },
});

// ─── Feature 16: حقن رسالة نظام ──────────
export const injectSystemMessage = mutation({
  args: {
    targetUserId: v.id("users"),
    message: v.string(),
    messageType: v.union(
      v.literal("system"),
      v.literal("achievement"),
      v.literal("reward"),
      v.literal("event"),
    ),
  },
  handler: async (ctx, args) => {
    const key = `sys_msg_${args.targetUserId}_${Date.now()}`;
    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({
        targetUserId: args.targetUserId,
        message: args.message,
        type: args.messageType,
        createdAt: Date.now(),
        delivered: false,
      }),
    });

    return { success: true };
  },
});

// ─── Feature 17: التحكم في التخزين المحلي ──────────
export const controlLocalStorage = mutation({
  args: {
    userId: v.id("users"),
    action: v.union(v.literal("clear"), v.literal("freeze"), v.literal("restore")),
    backupData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = `storage_control_${args.userId}`;
    const data = JSON.stringify({
      action: args.action,
      backupData: args.backupData ?? null,
      executedAt: Date.now(),
    });

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key, value: data });
    }

    return { success: true };
  },
});

// ─── Feature 18: إنشاء رموز صلاحيات مؤقتة ──────────
export const createPermissionToken = mutation({
  args: {
    permissions: v.array(v.string()),
    durationMs: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const token = `PTK_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const key = `perm_token_${token}`;

    await ctx.db.insert("settings", {
      key,
      value: JSON.stringify({
        token,
        permissions: args.permissions,
        expiresAt: Date.now() + args.durationMs,
        description: args.description ?? "",
        used: false,
        createdAt: Date.now(),
        createdBy: me.email,
      }),
    });

    return { token, expiresAt: Date.now() + args.durationMs };
  },
});

// ─── Feature 19: نسخ احتياطي واستعادة ──────────
export const createBackup = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const user = await ctx.db.get(args.userId);
    const gameHistory = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(50);

    const backup = JSON.stringify({
      user: user ? { name: user.name, email: user.email, role: user.role } : null,
      profile,
      gameHistory,
      backedUpAt: Date.now(),
      reason: args.reason ?? "نسخة احتياطية يدوية",
    });

    const key = `backup_${args.userId}_${Date.now()}`;
    await ctx.db.insert("settings", { key, value: backup });

    return { success: true, backupKey: key };
  },
});

// ─── Feature 20: وضع السيطرة الكلية ──────────
export const enableTotalControl = mutation({
  args: {
    enabled: v.boolean(),
    confirmCode: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirmCode !== "TOTAL_CONTROL_CONFIRM") {
      throw new Error("كود التأكيد غير صحيح");
    }

    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "total_control_mode"))
      .first();

    const data = JSON.stringify({
      enabled: args.enabled,
      activatedAt: Date.now(),
      activatedBy: me.email,
    });

    if (existing) {
      await ctx.db.patch(existing._id, { value: data });
    } else {
      await ctx.db.insert("settings", { key: "total_control_mode", value: data });
    }

    return { success: true };
  },
});

// ─── Get all control settings ──────────
export const getControlSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").take(500);
    const controlSettings: Record<string, unknown> = {};

    for (const s of settings) {
      if (
        s.key.startsWith("section_lock_") ||
        s.key.startsWith("notification_") ||
        s.key.startsWith("device_cmd_") ||
        s.key.startsWith("perm_token_") ||
        s.key.startsWith("maintenance") ||
        s.key.startsWith("total_control") ||
        s.key.startsWith("sync_") ||
        s.key.startsWith("online_status_")
      ) {
        try {
          controlSettings[s.key] = JSON.parse(s.value);
        } catch {
          controlSettings[s.key] = s.value;
        }
      }
    }

    return controlSettings;
  },
});

// ─── Get pending device commands (polled by clients) ──────────
export const getPendingCommands = query({
  args: {},
  handler: async (ctx) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) return [];

    const commands = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), "device_cmd_"))
      .filter((q) => q.lt(q.field("key"), "device_cmd_z"))
      .take(20);

    const pending: Array<{ command: string; message: string }> = [];
    for (const c of commands) {
      try {
        const data = JSON.parse(c.value);
        if (!data.executed && (data.targetUserId === "all" || data.targetUserId === me.subject)) {
          pending.push({ command: data.command, message: data.message ?? "" });
        }
      } catch {
        // skip
      }
    }

    return pending;
  },
});
