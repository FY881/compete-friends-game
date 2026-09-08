// ═══════════════════════════════════════════════════════════════════════
// عالم المساعدين — السجل (mutations/queries خارج runtime الـ Node)
// كل دالة هنا تنفّذ تأثيراً حقيقياً على بيانات اللعبة الفعلية.
// ═══════════════════════════════════════════════════════════════════════
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { ASSISTANT_MINDS } from "../lib/assistantMinds";

const DAY = 24 * 60 * 60 * 1000;

// ── إنشاء العالم: كل مساعد يُحضّر له ملفه وجهازه ──────────────
export const seedWorld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("assistantWorld").collect();
    const known = new Set(existing.map((a) => a.assistantId));
    let created = 0;
    for (const mind of ASSISTANT_MINDS) {
      if (known.has(mind.id)) continue;
      await ctx.db.insert("assistantWorld", {
        assistantId: mind.id,
        name: mind.name,
        emoji: mind.emoji,
        title: mind.title,
        home: mind.home,
        personality: mind.personality,
        privilege: mind.privilege,
        energy: mind.energy,
        mood: mind.mood,
        reputation: 60,
        level: 1,
        tasksCompleted: 0,
        actionsExecuted: 0,
        lastActionAt: null,
        computer: {
          cpuLoad: Math.round(Math.random() * 20 + 10),
          installedTools: ["terminal", "reports-viewer", "players-index", "economy-ledger", "archive"],
          uptimeMs: 0,
          lastCommand: undefined,
          lastCommandResult: undefined,
          logsCount: 0,
        },
        lastActivity: null,
        createdAt: Date.now(),
      });
      created++;
    }
    return { created, total: ASSISTANT_MINDS.length };
  },
});

export const getWorld = query({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("assistantWorld").collect();
    const logs = await ctx.db.query("assistantLogs").withIndex("by_created").order("desc").take(30);
    return { assistants: world, recentLogs: logs };
  },
});

export const getAssistant = internalQuery({
  args: { assistantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("assistantWorld")
      .withIndex("by_assistant", (q) => q.eq("assistantId", args.assistantId))
      .first();
  },
});

export const getWorldStats = query({
  args: {},
  handler: async (ctx) => {
    const world = await ctx.db.query("assistantWorld").collect();
    const logs = await ctx.db.query("assistantLogs").collect();
    const orders = await ctx.db.query("assistantOrders").collect();
    return {
      assistants: world.length,
      active: world.filter((a) => a.energy > 30).length,
      totalActions: world.reduce((s, a) => s + a.actionsExecuted, 0),
      totalTasks: world.reduce((s, a) => s + a.tasksCompleted, 0),
      totalLogs: logs.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      totalOrders: orders.length,
      avgReputation: world.length ? Math.round(world.reduce((s, a) => s + a.reputation, 0) / world.length) : 0,
    };
  },
});

export const listLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("assistantLogs").withIndex("by_created").order("desc").take(args.limit ?? 40);
  },
});

export const logAssistantActivity = internalMutation({
  args: {
    assistantId: v.string(),
    name: v.string(),
    emoji: v.string(),
    type: v.union(v.literal("thought"), v.literal("action"), v.literal("order"), v.literal("life")),
    action: v.string(),
    detail: v.string(),
    result: v.union(v.literal("executed"), v.literal("failed"), v.literal("noted")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("assistantLogs", {
      assistantId: args.assistantId,
      name: args.name,
      emoji: args.emoji,
      type: args.type,
      action: args.action,
      detail: args.detail,
      result: args.result,
      at: Date.now(),
    });
    const world = await ctx.db
      .query("assistantWorld")
      .withIndex("by_assistant", (q) => q.eq("assistantId", args.assistantId))
      .first();
    if (world) {
      await ctx.db.patch(world._id, {
        lastActivity: args.detail.slice(0, 160),
        lastActionAt: Date.now(),
        actionsExecuted: world.actionsExecuted + 1,
        computer: {
          ...world.computer,
          logsCount: world.computer.logsCount + 1,
          lastCommand: args.action,
          lastCommandResult: args.result === "executed" ? "ok" : args.result,
          uptimeMs: world.computer.uptimeMs + 1000 * 60 * 5,
        },
      });
    }
    return id;
  },
});

export const updateLife = internalMutation({
  args: {
    assistantId: v.string(),
    energy: v.optional(v.number()),
    mood: v.optional(v.string()),
    reputationDelta: v.optional(v.number()),
    xp: v.optional(v.number()),
    taskDone: v.optional(v.boolean()),
    installedTool: v.optional(v.string()),
    cpuLoad: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db
      .query("assistantWorld")
      .withIndex("by_assistant", (q) => q.eq("assistantId", args.assistantId))
      .first();
    if (!world) return;
    const patch: Record<string, unknown> = {};
    if (args.energy !== undefined) patch.energy = Math.max(0, Math.min(100, args.energy));
    if (args.mood !== undefined) patch.mood = args.mood;
    if (args.reputationDelta !== undefined)
      patch.reputation = Math.max(0, Math.min(100, world.reputation + args.reputationDelta));
    if (args.xp !== undefined) patch.level = world.level + args.xp;
    if (args.taskDone) patch.tasksCompleted = world.tasksCompleted + 1;
    if (args.installedTool && !world.computer.installedTools.includes(args.installedTool)) {
      patch.computer = {
        ...world.computer,
        installedTools: [...world.computer.installedTools, args.installedTool],
      };
    } else if (args.cpuLoad !== undefined) {
      patch.computer = { ...world.computer, cpuLoad: args.cpuLoad };
    }
    await ctx.db.patch(world._id, patch);
  },
});

// ── تنفيذ حقيقي: أوامر على اللاعبين ───────────────────────────
export const applyWarn = internalMutation({
  args: { userId: v.id("users"), byName: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    const warnings = (user.warnings ?? 0) + 1;
    await ctx.db.patch(args.userId, { warnings, lastWarningAt: Date.now() });
    return { name: user.name ?? "لاعب", warnings };
  },
});

export const applyMute = internalMutation({
  args: { userId: v.id("users"), byName: v.string(), reason: v.string(), hours: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    await ctx.db.patch(args.userId, {
      mutedUntil: Date.now() + args.hours * 60 * 60 * 1000,
      warnings: (user.warnings ?? 0) + 1,
    });
    return { name: user.name ?? "لاعب", hours: args.hours };
  },
});

export const applyBan = internalMutation({
  args: { userId: v.id("users"), byName: v.string(), reason: v.string(), hours: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    const permanent = args.hours <= 0;
    await ctx.db.patch(args.userId, {
      bannedUntil: permanent ? undefined : Date.now() + args.hours * 60 * 60 * 1000,
      bannedPermanent: permanent,
      banReason: args.reason || "قرار تنفيذي من القيادة",
    });
    return { name: user.name ?? "لاعب", permanent };
  },
});

export const applyUnban = internalMutation({
  args: { userId: v.id("users"), byName: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    await ctx.db.patch(args.userId, { bannedUntil: undefined, bannedPermanent: false, banReason: undefined });
    return { name: user.name ?? "لاعب" };
  },
});

export const applyUnmute = internalMutation({
  args: { userId: v.id("users"), byName: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    await ctx.db.patch(args.userId, { mutedUntil: undefined });
    return { name: user.name ?? "لاعب" };
  },
});

export const applyGrantXp = internalMutation({
  args: { userId: v.id("users"), amount: v.number(), byName: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) throw new Error("لا يوجد ملف تقدم لهذا اللاعب");
    await ctx.db.patch(profile._id, { xp: profile.xp + args.amount, updatedAt: Date.now() });
    return { xp: profile.xp + args.amount };
  },
});

export const grantBadge = internalMutation({
  args: { userId: v.id("users"), badge: v.string(), byName: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) throw new Error("لا يوجد ملف تقدم لهذا اللاعب");
    if (profile.badges.includes(args.badge)) return { already: true };
    await ctx.db.patch(profile._id, { badges: [...profile.badges, args.badge], updatedAt: Date.now() });
    return { badges: profile.badges.length + 1 };
  },
});

export const sendAnnouncement = internalMutation({
  args: { title: v.string(), body: v.string(), byName: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: "__all__",
      title: args.title,
      body: args.body,
      type: "system",
      read: false,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const moderateReport = internalMutation({
  args: {
    reportId: v.id("reports"),
    compliant: v.boolean(),
    verdict: v.string(),
    action: v.string(),
    byName: v.string(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("البلاغ غير موجود");
    await ctx.db.patch(report._id, {
      status: args.compliant ? "dismissed" : "reviewed",
      aiVerdict: {
        compliant: args.compliant,
        violation: args.compliant ? undefined : args.verdict.slice(0, 200),
        severity: args.action === "ban" ? "high" : args.action === "mute" ? "medium" : "low",
        suggestedAction:
          args.action === "ban" ? "ban" : args.action === "mute" ? "mute" : args.action === "warn" ? "warn" : "none",
        suggestedDurationMs: args.action === "ban" ? 24 * DAY : args.action === "mute" ? DAY : undefined,
        reasoning: `قرار ${args.byName}: ${args.verdict}`.slice(0, 400),
      },
    });
    return { ok: true };
  },
});

export const proposeSystem = internalMutation({
  args: { name: v.string(), purpose: v.string(), spec: v.string(), byName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("viceOwnerSystems", {
      name: args.name.slice(0, 120),
      purpose: args.purpose.slice(0, 300),
      spec: args.spec.slice(0, 2000),
      status: "proposed",
      createdAt: Date.now(),
    });
  },
});

export const logAiEvent = internalMutation({
  args: {
    action: v.string(),
    subsystem: v.string(),
    message: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical"), v.literal("action")),
    targetUser: v.optional(v.string()),
    executedBy: v.string(),
    data: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiLogs", {
      action: args.action,
      subsystem: args.subsystem,
      message: args.message,
      severity: args.severity,
      targetUser: args.targetUser,
      data: args.data,
      auto: true,
      executedBy: args.executedBy,
      timestamp: Date.now(),
    });
  },
});

// ── السجل المركزي (viceAudit) ─────────────────────────────────
export const writeAudit = internalMutation({
  args: {
    executor: v.string(),
    executorName: v.string(),
    command: v.string(),
    action: v.string(),
    target: v.string(),
    params: v.optional(v.string()),
    result: v.union(v.literal("executed"), v.literal("failed"), v.literal("skipped")),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("viceAudit", {
      executor: args.executor,
      executorName: args.executorName,
      command: args.command.slice(0, 400),
      action: args.action,
      target: args.target.slice(0, 200),
      params: args.params,
      result: args.result,
      detail: args.detail.slice(0, 600),
      at: Date.now(),
    });
  },
});

export const listAudit = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query("viceAudit").withIndex("by_created").order("desc").take(args.limit ?? 50);
  },
});

export const getAuditStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("viceAudit").collect();
    return {
      total: all.length,
      executed: all.filter((a) => a.result === "executed").length,
      failed: all.filter((a) => a.result === "failed").length,
      byExecutor: Object.entries(
        all.reduce<Record<string, number>>((acc, a) => {
          acc[a.executor] = (acc[a.executor] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .map(([executor, count]) => {
          const name = all.find((a) => a.executor === executor)?.executorName ?? executor;
          return { executor, name, count };
        }),
    };
  },
});

// ── الأوامر (assistantOrders) ─────────────────────────────────
export const createOrder = internalMutation({
  args: {
    targetId: v.union(v.literal("all"), v.string()),
    task: v.string(),
    priority: v.union(v.literal("high"), v.literal("normal")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("assistantOrders", {
      targetId: args.targetId,
      task: args.task.slice(0, 400),
      priority: args.priority,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const listOrders = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("assistantOrders")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const getPendingOrdersFor = internalQuery({
  args: { assistantId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("assistantOrders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(10);
    return all.filter((o) => o.targetId === "all" || o.targetId === args.assistantId);
  },
});

export const acceptOrder = internalMutation({
  args: { orderId: v.id("assistantOrders"), assistantId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { status: "accepted", acceptedBy: args.assistantId });
  },
});

export const completeOrder = internalMutation({
  args: { orderId: v.id("assistantOrders"), result: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { status: "done", result: args.result.slice(0, 300), completedAt: Date.now() });
  },
});

// ── مساعدة عامة: البحث عن لاعب بالاسم ─────────────────────────
export const findUserByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(200);
    return (
      users.find((u) => (u.name ?? "").trim().toLowerCase() === args.name.trim().toLowerCase()) ??
      users.find((u) => (u.name ?? "").toLowerCase().includes(args.name.trim().toLowerCase()))
    );
  },
});

export const listOpenReports = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(args.limit ?? 5);
  },
});

export const getTopPlayer = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("profiles").withIndex("by_xp").order("desc").first();
  },
});