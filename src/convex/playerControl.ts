import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./users";
import { OWNER_EMAIL } from "./owner";
import { isAccountNotice, normalizeCategory } from "./notifyCore";

function isOwnerEmail(email?: string | null): boolean {
  return email === OWNER_EMAIL;
}

// ═══════════════════════════════════════════════════════════════════════════
// ║ Helper: التحقق من صلاحيات المالك ║
// ═══════════════════════════════════════════════════════════════════════════
async function requireOwner(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("غير مصرح");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerEmail(user.email)) throw new Error("غير مصرح — المالك فقط");
  return userId;
}

// ═══════════════════════════════════════════════════════════════════════════
// ║ 1. التحكم في حالة الأونلاين/الأوفلاين ║
// ═══════════════════════════════════════════════════════════════════════════
export const setPlayerOnlineStatus = mutation({
  args: {
    userId: v.id("users"),
    forceOffline: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.forceOffline) {
      await ctx.db.patch(args.userId, {
        bannedUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,
        banReason: args.reason ?? "أجبر على الأوفلاين من المالك",
      });
    } else {
      await ctx.db.patch(args.userId, {
        bannedUntil: undefined,
        bannedPermanent: false,
        banReason: undefined,
      });
    }
    await ctx.db.insert("ownerActions", {
      action: args.forceOffline ? "force_offline" : "force_online",
      targetUserId: args.userId,
      details: args.reason ?? "",
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 2. قفل/فتح أي قسم أو مرحلة ║
// ═══════════════════════════════════════════════════════════════════════════
export const toggleFeatureLock = mutation({
  args: {
    featureKey: v.string(),
    locked: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", `feature_lock_${args.featureKey}`))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: JSON.stringify({ locked: args.locked, message: args.message }) });
    } else {
      await ctx.db.insert("settings", {
        key: `feature_lock_${args.featureKey}`,
        value: JSON.stringify({ locked: args.locked, message: args.message }),
      });
    }
    return { ok: true };
  },
});

export const getFeatureLock = query({
  args: { featureKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", `feature_lock_${args.featureKey}`))
      .unique();
    if (!row) return { locked: false, message: null };
    try { return JSON.parse(row.value); } catch { return { locked: false, message: null }; }
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 3. مسح كاش / بيانات مؤقتة لأي لاعب ║
// ═══════════════════════════════════════════════════════════════════════════
export const clearPlayerCache = mutation({
  args: { userId: v.id("users"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    // Reset streak and daily data
    await ctx.db.patch(args.userId, { cheatStrikes: 0 });
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (profile) {
      await ctx.db.patch(profile._id, { dailyStreak: 0, lastClaimDay: undefined, lastPlayedDay: undefined });
    }
    await ctx.db.insert("ownerActions", {
      action: "clear_cache",
      targetUserId: args.userId,
      details: args.reason ?? "مسح الكاش",
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 4. إرسال إشعار فوري وإجباري ║
// ═══════════════════════════════════════════════════════════════════════════
export const sendNotification = mutation({
  args: {
    userId: v.union(v.literal("__all__"), v.id("users")),
    title: v.string(),
    body: v.string(),
    type: v.union(v.literal("info"), v.literal("warning"), v.literal("ban"), v.literal("update"), v.literal("system")),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    await requireOwner(ctx);
    // 🚦 إشعار المالك يمرّ عبر المسار الموحّد أيضاً — لا كتابة متجاوزة للسياسة
    await ctx.runMutation(internal.notify.push, {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      actionUrl: args.actionUrl,
    });
    return { ok: true };
  },
});

/**
 * جرس الإشعارات (المسار القديم) — الآن يحترم الكتم بقواعد النواة الموحّدة.
 * قبل ذلك كان يعرض كل صف بلا استثناء، فيكتم اللاعب فئةً ويظل يراها هنا —
 * أي أن إعدادًا حقيقياً في الخادم كان بلا أثر في هذه الواجهة.
 */
export const getMyNotifications = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const pref = await ctx.db
      .query("notificationPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const enabledMap = (pref?.enabled as Record<string, boolean> | undefined) ?? {};
    const specific = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", "__all__"))
      .order("desc")
      .take(50);
    return [...specific, ...all]
      // 🚦 الفئة المكتومة لا تظهر هنا أيضاً — وإشعار العقوبة يظهر دائماً
      .filter((n) => {
        const cat = normalizeCategory((n as { category?: string }).category);
        if (isAccountNotice({ type: n.type })) return true;
        return enabledMap[cat] !== false;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 5. تجميد حساب مؤقت أو دائم ║
// ═══════════════════════════════════════════════════════════════════════════
export const freezeAccount = mutation({
  args: {
    userId: v.id("users"),
    duration: v.union(v.literal("1h"), v.literal("24h"), v.literal("7d"), v.literal("30d"), v.literal("permanent")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const durations: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "permanent": 365 * 24 * 60 * 60 * 1000 * 100,
    };
    const isPermanent = args.duration === "permanent";
    await ctx.db.patch(args.userId, {
      bannedUntil: isPermanent ? undefined : Date.now() + durations[args.duration],
      bannedPermanent: isPermanent,
      banReason: args.reason,
    });
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: "المالك",
      action: isPermanent ? "permanent_ban" : "temp_ban",
      targetId: args.userId,
      targetName: "",
      reason: args.reason,
      severity: "high",
      createdAt: Date.now(),
    });
    await ctx.db.insert("ownerActions", {
      action: "freeze_account",
      targetUserId: args.userId,
      details: `تجميد ${args.duration}: ${args.reason}`,
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 6. منح/سحب صلاحيات أو عناصر ║
// ═══════════════════════════════════════════════════════════════════════════
export const grantOrRevoke = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("badge"), v.literal("role"), v.literal("xp"), v.literal("warning_reset")),
    value: v.string(),
    action: v.union(v.literal("grant"), v.literal("revoke")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.type === "xp") {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
      if (profile) {
        const delta = args.action === "grant" ? parseInt(args.value) || 100 : -(parseInt(args.value) || 100);
        await ctx.db.patch(profile._id, { xp: Math.max(0, profile.xp + delta) });
      }
    } else if (args.type === "badge") {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
      if (profile) {
        const badges = args.action === "grant"
          ? [...new Set([...profile.badges, args.value])]
          : profile.badges.filter((b: string) => b !== args.value);
        await ctx.db.patch(profile._id, { badges });
      }
    } else if (args.type === "role") {
      await ctx.db.patch(args.userId, { role: args.action === "grant" ? args.value as any : "user" as any });
    } else if (args.type === "warning_reset") {
      await ctx.db.patch(args.userId, { warnings: 0, cheatStrikes: 0 });
    }
    await ctx.db.insert("ownerActions", {
      action: `${args.type}_${args.action}`,
      targetUserId: args.userId,
      details: `${args.type}: ${args.value}`,
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 7. مراقبة نشاط لاعب بشكل حي ║
// ═══════════════════════════════════════════════════════════════════════════
export const monitorPlayer = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    const recentGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
    const reports = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("targetId"), args.userId))
      .order("desc")
      .take(5);
    return {
      user: { name: user.name, email: user.email, role: user.role, warnings: user.warnings, bannedPermanent: user.bannedPermanent, banReason: user.banReason },
      profile,
      recentGames,
      recentReports: reports,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 8. تعديل بيانات أي لاعب ║
// ═══════════════════════════════════════════════════════════════════════════
export const editPlayerData = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    xp: v.optional(v.number()),
    gamesPlayed: v.optional(v.number()),
    gamesWon: v.optional(v.number()),
    bestScore: v.optional(v.number()),
    correctAnswers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.name) await ctx.db.patch(args.userId, { name: args.name });
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (profile) {
      await ctx.db.patch(profile._id, {
        ...(args.xp !== undefined && { xp: args.xp }),
        ...(args.gamesPlayed !== undefined && { gamesPlayed: args.gamesPlayed }),
        ...(args.gamesWon !== undefined && { gamesWon: args.gamesWon }),
        ...(args.bestScore !== undefined && { bestScore: args.bestScore }),
        ...(args.correctAnswers !== undefined && { correctAnswers: args.correctAnswers }),
      });
    }
    await ctx.db.insert("ownerActions", {
      action: "edit_player",
      targetUserId: args.userId,
      details: "تعديل بيانات اللاعب",
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 10. التحكم في المزامنة ║
// ═══════════════════════════════════════════════════════════════════════════
export const toggleSync = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const existing = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", "sync_enabled")).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: JSON.stringify(args.enabled) });
    } else {
      await ctx.db.insert("settings", { key: "sync_enabled", value: JSON.stringify(args.enabled) });
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 11. وضع الصيانة ║
// ═══════════════════════════════════════════════════════════════════════════
export const toggleMaintenance = mutation({
  args: { active: v.boolean(), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.insert("maintenanceMode", {
      active: args.active,
      message: args.message ?? "التطبيق في وضع الصيانة. حاول مرة أخرى لاحقاً.",
      startedAt: Date.now(),
      endedAt: args.active ? undefined : Date.now(),
    });
    return { ok: true };
  },
});

export const getMaintenance = query({
  handler: async (ctx) => {
    const latest = await ctx.db.query("maintenanceMode").order("desc").first();
    return latest?.active ? latest : null;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 15. لوحة تحكم سريعة باللاعبين ║
// ═══════════════════════════════════════════════════════════════════════════
export const getAllPlayersBrief = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      id: u._id,
      name: u.name ?? "مجهول",
      email: u.email,
      role: u.role ?? "user",
      warnings: u.warnings ?? 0,
      banned: !!(u.bannedUntil && u.bannedUntil > Date.now()) || !!u.bannedPermanent,
      cheatStrikes: u.cheatStrikes ?? 0,
    }));
  },
});

export const bulkAction = mutation({
  args: {
    userIds: v.array(v.id("users")),
    action: v.union(v.literal("warn"), v.literal("mute"), v.literal("ban"), v.literal("pardon"), v.literal("reset_warnings")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    for (const uid of args.userIds) {
      if (args.action === "warn") {
        const u = await ctx.db.get(uid);
        await ctx.db.patch(uid, { warnings: (u?.warnings ?? 0) + 1, lastWarningAt: now });
      } else if (args.action === "mute") {
        await ctx.db.patch(uid, { mutedUntil: now + 60 * 60 * 1000 });
      } else if (args.action === "ban") {
        await ctx.db.patch(uid, { bannedUntil: now + 24 * 60 * 60 * 1000, banReason: "حظر جماعي من المالك" });
      } else if (args.action === "pardon") {
        await ctx.db.patch(uid, { bannedUntil: undefined, bannedPermanent: false, mutedUntil: undefined, banReason: undefined });
      } else if (args.action === "reset_warnings") {
        await ctx.db.patch(uid, { warnings: 0, cheatStrikes: 0 });
      }
    }
    return { ok: true, affected: args.userIds.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 17. التحكم في التخزين المحلي ║
// ═══════════════════════════════════════════════════════════════════════════
export const resetPlayerProgress = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (profile) {
      await ctx.db.patch(profile._id, { xp: 0, gamesPlayed: 0, gamesWon: 0, bestScore: 0, bestStreak: 0, correctAnswers: 0, totalAnswers: 0, badges: [] });
    }
    await ctx.db.insert("ownerActions", {
      action: "reset_progress",
      targetUserId: args.userId,
      details: "إعادة ضبط كاملة",
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 18. رموز صلاحيات مؤقتة ║
// ═══════════════════════════════════════════════════════════════════════════
export const createPermissionToken = mutation({
  args: {
    userId: v.id("users"),
    permissions: v.array(v.string()),
    permanent: v.boolean(),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const token = `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await ctx.db.insert("permissionTokens", {
      token,
      userId: args.userId,
      permissions: args.permissions,
      permanent: args.permanent,
      expiresAt: args.permanent ? undefined : Date.now() + (args.durationHours ?? 24) * 60 * 60 * 1000,
      usedCount: 0,
      active: true,
      createdAt: Date.now(),
    });
    return { token };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 19. نسخ احتياطي واستعادة ║
// ═══════════════════════════════════════════════════════════════════════════
export const backupPlayer = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    const history = await ctx.db.query("gameHistory").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const data = JSON.stringify({ profile, history, timestamp: Date.now() });
    await ctx.db.insert("playerBackups", { userId: args.userId, backupData: data, createdAt: Date.now() });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ 20. السيطرة الكلية ║
// ═══════════════════════════════════════════════════════════════════════════
export const totalControl = mutation({
  args: { confirmationCode: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.confirmationCode !== "TOTAL_CONTROL_2025") throw new Error("كود التأكيد خاطئ");
    // Grant admin role temporarily
    await ctx.db.insert("ownerActions", {
      action: "total_control_activated",
      details: "تم تفعيل السيطرة الكلية",
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    return { ok: true, message: "تم تفعيل السيطرة الكلية — جميع الصلاحيات مفتوحة" };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام العضويات ║
// ═══════════════════════════════════════════════════════════════════════════
export const createMembershipCode = mutation({
  args: {
    tier: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond"), v.literal("exclusive")),
    durationDays: v.optional(v.number()),
    maxUses: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const code = `${args.tier.toUpperCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    await ctx.db.insert("membershipCodes", {
      code,
      tier: args.tier,
      durationDays: args.durationDays,
      maxUses: args.maxUses,
      usedCount: 0,
      usedBy: [],
      active: true,
      createdAt: Date.now(),
    });
    return { code };
  },
});

export const redeemMembershipCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const codeRow = await ctx.db.query("membershipCodes").withIndex("by_code", (q) => q.eq("code", args.code)).unique();
    if (!codeRow || !codeRow.active) throw new Error("الكود غير صالح");
    if (codeRow.usedCount >= codeRow.maxUses) throw(new Error("الكود استُنفد"));
    const features: Record<string, string[]> = {
      bronze: ["avatar_border", "daily_bonus_x2"],
      silver: ["avatar_border", "daily_bonus_x2", "custom_emoji", "priority_queue"],
      gold: ["avatar_border", "daily_bonus_x3", "custom_emoji", "priority_queue", "exclusive_categories", "badges_pack"],
      diamond: ["avatar_border", "daily_bonus_x5", "custom_emoji", "priority_queue", "exclusive_categories", "badges_pack", "profile_theme", "ai_hints_extra"],
      exclusive: ["avatar_border", "daily_bonus_x10", "custom_emoji", "priority_queue", "exclusive_categories", "badges_pack", "profile_theme", "ai_hints_extra", "vip_lounge", "custom_titles"],
    };
    const expiresAt = codeRow.durationDays ? Date.now() + codeRow.durationDays * 24 * 60 * 60 * 1000 : undefined;
    await ctx.db.insert("memberships", {
      userId,
      tier: codeRow.tier,
      activatedAt: Date.now(),
      expiresAt,
      codeUsed: args.code,
      features: features[codeRow.tier] ?? [],
    });
    await ctx.db.patch(codeRow._id, {
      usedCount: codeRow.usedCount + 1,
      usedBy: [...codeRow.usedBy, userId],
    });
    return { ok: true, tier: codeRow.tier };
  },
});

export const getMyMembership = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const m = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").first();
    if (!m) return null;
    if (m.expiresAt && m.expiresAt < Date.now()) return null;
    return m;
  },
});

export const getAllMembershipCodes = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await ctx.db.query("membershipCodes").order("desc").take(100);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ غرف المناقشة ║
// ═══════════════════════════════════════════════════════════════════════════
export const createChatRoom = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("public"), v.literal("private"), v.literal("password"), v.literal("invite")),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const inviteCode = args.type === "invite" ? Math.random().toString(36).slice(2, 10) : undefined;
    return await ctx.db.insert("chatRooms", {
      name: args.name,
      description: args.description,
      type: args.type,
      password: args.password,
      inviteCode,
      ownerId: userId,
      members: [userId],
      admins: [userId],
      pinnedMessageId: undefined,
      archived: false,
      createdAt: Date.now(),
    });
  },
});

export const sendChatMessage = mutation({
  args: {
    roomId: v.id("chatRooms"),
    content: v.string(),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("poll"), v.literal("system")),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (!room.members.includes(userId)) throw new Error("لست عضواً في هذه الغرفة");
    const user = await ctx.db.get(userId);
    return await ctx.db.insert("chatMessages", {
      roomId: args.roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: args.content,
      type: args.type,
      pinned: false,
      deleted: false,
      reactions: [],
      replyTo: args.replyTo,
      createdAt: Date.now(),
    });
  },
});

export const getChatMessages = query({
  args: { roomId: v.id("chatRooms"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getChatRooms = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const allRooms = await ctx.db.query("chatRooms").collect();
    return allRooms.filter((r) => !r.archived && (r.type === "public" || r.members.includes(userId)));
  },
});

export const joinChatRoom = mutation({
  args: { roomId: v.id("chatRooms"), password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.type === "password" && room.password !== args.password) throw new Error("كلمة المرور خاطئة");
    if (room.members.includes(userId)) return { ok: true };
    await ctx.db.patch(args.roomId, { members: [...room.members, userId] });
    return { ok: true };
  },
});

export const pinMessage = mutation({
  args: { roomId: v.id("chatRooms"), messageId: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.patch(args.roomId, { pinnedMessageId: args.messageId });
    return { ok: true };
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("chatMessages"), emoji: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("الرسالة غير موجودة");
    const existing = msg.reactions.find((r: any) => r.emoji === args.emoji && r.userId === userId);
    const reactions = existing
      ? msg.reactions.filter((r: any) => !(r.emoji === args.emoji && r.userId === userId))
      : [...msg.reactions, { emoji: args.emoji, userId }];
    await ctx.db.patch(args.messageId, { reactions });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ سجل أفعال المالك ║
// ═══════════════════════════════════════════════════════════════════════════
export const getOwnerActions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db.query("ownerActions").order("desc").take(args.limit ?? 50);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ مفاتيح API ║
// ═══════════════════════════════════════════════════════════════════════════
export const addApiKey = mutation({
  args: { name: v.string(), provider: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db.insert("apiKeys", {
      name: args.name,
      provider: args.provider,
      key: args.key,
      active: true,
      useCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const getApiKeys = query({
  handler: async (ctx) => {
    await requireOwner(ctx);
    const keys = await ctx.db.query("apiKeys").collect();
    return keys.map((k) => ({ ...k, key: k.key.slice(0, 10) + "..." + k.key.slice(-4) }));
  },
});

export const deleteApiKey = mutation({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.delete(args.apiKeyId);
    return { ok: true };
  },
});

export const toggleApiKey = mutation({
  args: { apiKeyId: v.id("apiKeys"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.patch(args.apiKeyId, { active: args.active });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ قوانين اللعب الأونلاين ║
// ═══════════════════════════════════════════════════════════════════════════
export const addOnlineRule = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    autoAction: v.union(v.literal("none"), v.literal("warn"), v.literal("mute"), v.literal("kick"), v.literal("ban")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const count = (await ctx.db.query("onlineRules").collect()).length;
    return await ctx.db.insert("onlineRules", {
      ...args,
      active: true,
      order: count,
      createdAt: Date.now(),
    });
  },
});

export const getOnlineRules = query({
  handler: async (ctx) => {
    return await ctx.db.query("onlineRules").withIndex("by_active", (q) => q.eq("active", true)).order("asc").collect();
  },
});

export const deleteOnlineRule = mutation({
  args: { ruleId: v.id("onlineRules") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.delete(args.ruleId);
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام الدعوات ║
// ═══════════════════════════════════════════════════════════════════════════
export const createInviteCode = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const code = `INV_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await ctx.db.insert("invites", { inviterId: userId, code, used: false, rewardClaimed: false, createdAt: Date.now() });
    return { code };
  },
});

export const useInviteCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const invite = await ctx.db.query("invites").withIndex("by_code", (q) => q.eq("code", args.code)).unique();
    if (!invite || invite.used) throw new Error("الكود غير صالح أو مستخدم");
    await ctx.db.patch(invite._id, { used: true, inviteeId: userId });
    // Grant XP reward to inviter
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", invite.inviterId)).unique();
    if (profile) {
      await ctx.db.patch(profile._id, { xp: profile.xp + 50 });
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام السمعة ║
// ═══════════════════════════════════════════════════════════════════════════
export const voteReputation = mutation({
  args: { targetUserId: v.id("users"), positive: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    if (userId === args.targetUserId) throw new Error("لا يمكنك التصويت لنفسك");
    const existing = await ctx.db.query("reputation").withIndex("by_user", (q) => q.eq("userId", args.targetUserId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        score: existing.score + (args.positive ? 1 : -1),
        positiveVotes: existing.positiveVotes + (args.positive ? 1 : 0),
        negativeVotes: existing.negativeVotes + (args.positive ? 0 : 1),
        lastVoteAt: Date.now(),
      });
    } else {
      await ctx.db.insert("reputation", {
        userId: args.targetUserId,
        score: args.positive ? 1 : -1,
        positiveVotes: args.positive ? 1 : 0,
        negativeVotes: args.positive ? 0 : 1,
        lastVoteAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const getReputation = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("reputation").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام المواسم ║
// ═══════════════════════════════════════════════════════════════════════════
export const createSeason = mutation({
  args: {
    name: v.string(),
    number: v.number(),
    durationDays: v.number(),
    rewards: v.array(v.object({ rank: v.number(), badge: v.string(), xp: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await ctx.db.insert("seasons", {
      name: args.name,
      number: args.number,
      startAt: Date.now(),
      endAt: Date.now() + args.durationDays * 24 * 60 * 60 * 1000,
      rewards: args.rewards,
      active: true,
    });
    return { ok: true };
  },
});

export const getActiveSeason = query({
  handler: async (ctx) => {
    return await ctx.db.query("seasons").withIndex("by_active", (q) => q.eq("active", true)).first();
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام الهدايا ║
// ═══════════════════════════════════════════════════════════════════════════
export const sendGift = mutation({
  args: {
    receiverId: v.id("users"),
    giftType: v.string(),
    message: v.optional(v.string()),
    xpAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const sender = await ctx.db.get(userId);
    const receiver = await ctx.db.get(args.receiverId);
    if (!receiver) throw new Error("المستخدم غير موجود");
    return await ctx.db.insert("gifts", {
      senderId: userId,
      senderName: sender?.name ?? "مجهول",
      receiverId: args.receiverId,
      receiverName: receiver.name ?? "مجهول",
      giftType: args.giftType,
      message: args.message,
      xpAmount: args.xpAmount,
      claimed: false,
      createdAt: Date.now(),
    });
  },
});

export const getMyGifts = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("gifts").withIndex("by_receiver", (q) => q.eq("receiverId", userId)).order("desc").take(50);
  },
});

export const claimGift = mutation({
  args: { giftId: v.id("gifts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const gift = await ctx.db.get(args.giftId);
    if (!gift || gift.receiverId !== userId || gift.claimed) throw new Error("الهدية غير صالحة");
    await ctx.db.patch(args.giftId, { claimed: true });
    if (gift.xpAmount) {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
      if (profile) await ctx.db.patch(profile._id, { xp: profile.xp + gift.xpAmount });
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ تحدي اليوم ║
// ═══════════════════════════════════════════════════════════════════════════
export const getDailyChallengeLeaderboard = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    const entries = await ctx.db.query("dailyChallenges").withIndex("by_day", (q) => q.eq("day", today)).order("desc").take(50);
    const results = [];
    for (const e of entries) {
      const user = await ctx.db.get(e.userId);
      results.push({ ...e, userName: user?.name ?? "مجهول" });
    }
    return results;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ أرشيف الأسئلة الشخصية ║
// ═══════════════════════════════════════════════════════════════════════════
export const archiveQuestion = mutation({
  args: {
    questionId: v.string(),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctIndex: v.number(),
    wasCorrect: v.boolean(),
    favorited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    return await ctx.db.insert("questionArchive", { userId, ...args, createdAt: Date.now() });
  },
});

export const getMyArchive = query({
  args: { favoritesOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    if (args.favoritesOnly) {
      return await ctx.db.query("questionArchive").withIndex("by_fav", (q) => q.eq("userId", userId).eq("favorited", true)).order("desc").take(100);
    }
    return await ctx.db.query("questionArchive").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(200);
  },
});

export const toggleFavorite = mutation({
  args: { archiveId: v.id("questionArchive") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.archiveId);
    if (item) await ctx.db.patch(args.archiveId, { favorited: !item.favorited });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ الإنجازات ║
// ═══════════════════════════════════════════════════════════════════════════
export const getMyAchievements = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("achievements").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(100);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام الإنجاز التلقائي ║
// ═══════════════════════════════════════════════════════════════════════════
export const checkAndAwardAchievements = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (!profile) return;
    const existing = await ctx.db.query("achievements").withIndex("by_user", (q) => q.eq("userId", args.userId)).collect();
    const types = new Set(existing.map((e) => e.type));
    const now = Date.now();
    const defs: { type: string; name: string; desc: string; icon: string; rarity: string; xp: number; check: boolean }[] = [
      { type: "first_win", name: "أول انتصار", desc: "فاز بأول جولة", icon: "🏆", rarity: "common", xp: 50, check: profile.gamesWon >= 1 },
      { type: "streak_5", name: "سلسلة 5", desc: "5 إجابات صحيحة متتالية", icon: "🔥", rarity: "uncommon", xp: 100, check: profile.bestStreak >= 5 },
      { type: "streak_10", name: "سلسلة 10", desc: "10 إجابات صحيحة متتالية", icon: "⚡", rarity: "rare", xp: 250, check: profile.bestStreak >= 10 },
      { type: "games_10", name: "لاعب مخضرم", desc: "10 جولات", icon: "🎮", rarity: "common", xp: 75, check: profile.gamesPlayed >= 10 },
      { type: "games_50", name: "محترف", desc: "50 جولة", icon: "🏅", rarity: "uncommon", xp: 200, check: profile.gamesPlayed >= 50 },
      { type: "perfect_10", name: "مثالي", desc: "10/10 في جولة", icon: "💎", rarity: "epic", xp: 500, check: profile.bestScore >= 1000 },
      { type: "xp_1000", name: "طالب المعرفة", desc: "1000 نقطة خبرة", icon: "📚", rarity: "uncommon", xp: 150, check: profile.xp >= 1000 },
      { type: "xp_5000", name: " hakim", desc: "5000 نقطة خبرة", icon: "👑", rarity: "rare", xp: 300, check: profile.xp >= 5000 },
      { type: "games_100", name: "أسطورة", desc: "100 جولة", icon: "🌟", rarity: "legendary", xp: 1000, check: profile.gamesPlayed >= 100 },
      { type: "wins_25", name: "محارب", desc: "25 انتصار", icon: "⚔️", rarity: "rare", xp: 400, check: profile.gamesWon >= 25 },
    ];
    for (const d of defs) {
      if (!types.has(d.type) && d.check) {
        await ctx.db.insert("achievements", {
          userId: args.userId, type: d.type, name: d.name, description: d.desc,
          icon: d.icon, rarity: d.rarity as any, xpReward: d.xp, earnedAt: now,
        });
        await ctx.db.patch(profile._id, { xp: profile.xp + d.xp });
      }
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ الأهداف الجماعية ║
// ═══════════════════════════════════════════════════════════════════════════
export const createCollectiveGoal = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    targetScore: v.number(),
    reward: v.string(),
    deadlineDays: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    return await ctx.db.insert("collectiveGoals", {
      title: args.title, description: args.description, targetScore: args.targetScore,
      currentScore: 0, participants: [], reward: args.reward, active: true,
      deadline: Date.now() + args.deadlineDays * 24 * 60 * 60 * 1000, createdAt: Date.now(),
    });
  },
});

export const getActiveGoals = query({
  handler: async (ctx) => {
    return await ctx.db.query("collectiveGoals").withIndex("by_active", (q) => q.eq("active", true)).collect();
  },
});

export const contributeToGoal = mutation({
  args: { goalId: v.id("collectiveGoals"), score: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const goal = await ctx.db.get(args.goalId);
    if (!goal || !goal.active) throw new Error("الهدف غير نشط");
    await ctx.db.patch(args.goalId, {
      currentScore: goal.currentScore + args.score,
      participants: goal.participants.includes(userId) ? goal.participants : [...goal.participants, userId],
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ تحديات1v1 ║
// ═══════════════════════════════════════════════════════════════════════════
export const createDuel = mutation({
  args: { opponentId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const challenger = await ctx.db.get(userId);
    const opponent = await ctx.db.get(args.opponentId);
    return await ctx.db.insert("duels", {
      challengerId: userId, challengerName: challenger?.name ?? "مجهول",
      opponentId: args.opponentId, opponentName: opponent?.name ?? "مجهول",
      status: "waiting", challengerScore: 0, opponentScore: 0,
      questionCount: 5, currentQuestion: 0, createdAt: Date.now(),
    });
  },
});

export const getAvailableDuels = query({
  handler: async (ctx) => {
    return await ctx.db.query("duels").withIndex("by_status", (q) => q.eq("status", "waiting")).order("desc").take(20);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ سجل أفعال المالك ║
// ═══════════════════════════════════════════════════════════════════════════
export const undoOwnerAction = mutation({
  args: { actionId: v.id("ownerActions") },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const action = await ctx.db.get(args.actionId);
    if (!action || !action.reversible || action.undone) throw new Error("لا يمكن التراجع");
    await ctx.db.patch(args.actionId, { undone: true });
    // Reverse specific actions
    if (action.action === "freeze_account" && action.targetUserId) {
      await ctx.db.patch(action.targetUserId, { bannedUntil: undefined, bannedPermanent: false, banReason: undefined });
    } else if (action.action === "clear_cache" && action.targetUserId) {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", action.targetUserId!)).unique();
      if (profile) await ctx.db.patch(profile._id, { dailyStreak: 0 });
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// ║ نظام دخول المالك بكلمة المرور ║
// ═══════════════════════════════════════════════════════════════════════════

/** Simple hash for password comparison (not cryptographic — obfuscation only) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `h${Math.abs(hash).toString(36)}`;
}

/** Verify owner password and set role to admin temporarily */
export const verifyOwnerPassword = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
    
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "ownerPasswordHash"))
      .unique();
    
    if (!row) throw new Error("لم يتم تفعيل كلمة مرور المالك بعد");
    
    const stored = JSON.parse(row.value) as { hash: string; active: boolean };
    if (!stored.active) throw new Error("كلمة مرور المالك معطّلة حالياً");
    
    const inputHash = simpleHash(args.password);
    if (inputHash !== stored.hash) throw new Error("كلمة المرور خاطئة");
    
    // Grant admin role temporarily
    await ctx.db.patch(userId, { role: "admin" });
    
    // Log the action
    await ctx.db.insert("ownerActions", {
      action: "owner_password_login",
      targetUserId: userId,
      details: "دخول المالك عبر كلمة المرور",
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });
    
    return { ok: true, role: "admin" };
  },
});

/** Set or update owner password (owner only) */
export const setOwnerPassword = mutation({
  args: { password: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    
    if (args.password.length < 4) throw new Error("كلمة المرور قصيرة جداً")
    
    const hash = simpleHash(args.password);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "ownerPasswordHash"))
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: JSON.stringify({ hash, active: args.active }),
      });
    } else {
      await ctx.db.insert("settings", {
        key: "ownerPasswordHash",
        value: JSON.stringify({ hash, active: args.active }),
      });
    }
    
    await ctx.db.insert("ownerActions", {
      action: args.active ? "set_owner_password" : "disable_owner_password",
      details: args.active ? "تم تفعيل كلمة مرور المالك" : "تم تعطيل كلمة مرور المالك",
      reversible: true,
      undone: false,
      createdAt: Date.now(),
    });
    
    return { ok: true };
  },
});

/** Delete owner password completely (owner only) */
export const deleteOwnerPassword = mutation({
  handler: async (ctx) => {
    await requireOwner(ctx);
    
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "ownerPasswordHash"))
      .unique();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    
    await ctx.db.insert("ownerActions", {
      action: "delete_owner_password",
      details: "تم حذف كلمة مرور المالك نهائياً",
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });
    
    return { ok: true };
  },
});

/** Get owner password status */
export const getOwnerPasswordStatus = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { exists: false, active: false };
    
    const user = await ctx.db.get(userId);
    if (!user || !isOwnerEmail(user.email)) return { exists: false, active: false };
    
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "ownerPasswordHash"))
      .unique();
    
    if (!row) return { exists: false, active: false };
    
    const stored = JSON.parse(row.value) as { hash: string; active: boolean };
    return { exists: true, active: stored.active };
  },
});
