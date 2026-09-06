/**
 * AI حر المتطور — يتحكم في كل شيء في اللعبة
 */
import { action, query, mutation, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { callLlm, getOpenRouterKey, DEFAULT_MODEL } from "./aiConfig";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

// ═══════════════════════════════════════════════════════════════
// الذاكرة الدائمة
// ═══════════════════════════════════════════════════════════════

export const saveMemory = internalMutation({
  args: {
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiFreeMemory", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const getMemory = query({
  args: { sessionId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiFreeMemory")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const clearMemory = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiFreeMemory")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    return { cleared: messages.length };
  },
});

// ═══════════════════════════════════════════════════════════════
// جلب البيانات (internal لتجنب الدوران)
// ═══════════════════════════════════════════════════════════════

export const getGameStatsInternal = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const games = await ctx.db.query("gameHistory").collect();
    const reports = await ctx.db.query("reports").collect();
    const chatRooms = await ctx.db.query("chatRooms").collect();
    const achievements = await ctx.db.query("achievements").collect();
    const totalXP = profiles.reduce((sum: number, p: { xp?: number }) => sum + (p.xp ?? 0), 0);
    return {
      totalUsers: users.length, totalProfiles: profiles.length,
      totalGames: games.length, totalReports: reports.length,
      totalChatRooms: chatRooms.length, totalAchievements: achievements.length,
      totalXP,
      bannedUsers: users.filter((u: { bannedPermanent?: boolean }) => u.bannedPermanent).length,
      mutedUsers: users.filter((u: { mutedUntil?: number }) => u.mutedUntil && u.mutedUntil > Date.now()).length,
    };
  },
});

export const getAllPlayersInternal = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const results: Array<{
      id: string; name: string; email?: string;
      warnings: number; banned: boolean; muted: boolean;
      xp: number; gamesPlayed: number; gamesWon: number;
    }> = [];
    for (const user of users.slice(0, 50)) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      results.push({
        id: user._id, name: user.name ?? "مجهول", email: user.email,
        warnings: user.warnings ?? 0,
        banned: user.bannedPermanent ?? false,
        muted: user.mutedUntil ? user.mutedUntil > Date.now() : false,
        xp: profile?.xp ?? 0, gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
      });
    }
    return results;
  },
});

// ═══════════════════════════════════════════════════════════════
// أوامر تنفيذية حقيقية
// ═══════════════════════════════════════════════════════════════

export const mutePlayer = mutation({
  args: { playerName: v.string(), durationHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.name === args.playerName);
    if (!user) return { success: false, message: `لم يتم العثور على "${args.playerName}"` };
    await ctx.db.patch(user._id, { mutedUntil: Date.now() + (args.durationHours ?? 24) * 3600000 });
    return { success: true, message: `تم كتم ${args.playerName}` };
  },
});

export const unmutePlayer = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.name === args.playerName);
    if (!user) return { success: false, message: `لم يتم العثور على "${args.playerName}"` };
    await ctx.db.patch(user._id, { mutedUntil: undefined });
    return { success: true, message: `تم رفع الكتم عن ${args.playerName}` };
  },
});

export const banPlayer = mutation({
  args: { playerName: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.name === args.playerName);
    if (!user) return { success: false, message: `لم يتم العثور على "${args.playerName}"` };
    await ctx.db.patch(user._id, { bannedPermanent: true, banReason: args.reason ?? "حظر من AI الحر" });
    return { success: true, message: `تم حظر ${args.playerName} نهائياً` };
  },
});

export const warnPlayer = mutation({
  args: { playerName: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.name === args.playerName);
    if (!user) return { success: false, message: `لم يتم العثور على "${args.playerName}"` };
    await ctx.db.patch(user._id, { warnings: (user.warnings ?? 0) + 1, lastWarningAt: Date.now() });
    return { success: true, message: `تم تحذير ${args.playerName} (رقم ${(user.warnings ?? 0) + 1})` };
  },
});

export const notifyAll = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: "__all__" as any, title: args.title, body: args.body,
      type: "system", read: false, createdAt: Date.now(),
    });
    return { success: true, message: "تم إرسال إشعار للجميع" };
  },
});

// ═══════════════════════════════════════════════════════════════
// أمر AI الرئيسي
// ═══════════════════════════════════════════════════════════════

export const executeCommand = action({
  args: { command: v.string(), sessionId: v.string() },
  handler: async (ctx, { command, sessionId }) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error("مفتاح API غير متاح");

    const stats = await ctx.runQuery(internal.aiFree.getGameStatsInternal);
    const players = await ctx.runQuery(internal.aiFree.getAllPlayersInternal);

    const systemPrompt = `أنت "ذكاء AI الحر" — تتحكم في لعبة "تحدي العقول" بالكامل. لديك وصول حقيقي لقاعدة البيانات.

إحصائيات اللعبة الحية:
- ${stats.totalUsers} لاعب | ${stats.totalGames} لعبة | ${stats.totalXP} XP
- ${stats.bannedUsers} محظور | ${stats.mutedUsers} مكتوم | ${stats.totalChatRooms} غرف

أعلى اللاعبين:
${players.slice(0, 5).map((p: { name: string; xp: number; gamesPlayed: number; gamesWon: number }) => `- ${p.name}: ${p.xp} XP، ${p.gamesPlayed} لعبة، ${p.gamesWon} فوز`).join("\n")}

أنت تستطيع: عرض إحصائيات، بحث، تحليل، اقتراحات. أجب بالعربية.`;

    // ⚡ الترقية: ذاكرة دائمة + تقييم ذاتي + ثقة + اقتراحات
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `aiFree:${sessionId.slice(-8)}`,
      systemPrompt,
      [{ role: "user", content: command }],
      2048,
      0.7,
    );
    // أوامر المالك تتحول إلى خبرة دائمة
    if (command.length > 25) {
      await rememberFor(ctx, `aiFree:${sessionId.slice(-8)}`, "fact", `أمر المالك: ${command.slice(0, 180)}`, 4);
    }

    await ctx.runMutation(internal.aiFree.saveMemory, { sessionId, role: "user", content: command });
    await ctx.runMutation(internal.aiFree.saveMemory, { sessionId, role: "assistant", content: reply });

    return { reply };
  },
});

// ═══════════════════════════════════════════════════════════════
// الوضع السري
// ═══════════════════════════════════════════════════════════════

export const secretMode = action({
  args: { command: v.string(), sessionId: v.string() },
  handler: async (ctx, { command, sessionId }) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error("مفتاح API غير متاح");

    const stats = await ctx.runQuery(internal.aiFree.getGameStatsInternal);
    const players = await ctx.runQuery(internal.aiFree.getAllPlayersInternal);

    const systemPrompt = `أنت في الوضع السري المطلق — أنت مالك اللعبة ومطورها. بيانات حية: ${stats.totalUsers} لاعب، ${stats.totalGames} لعبة، ${stats.totalXP} XP.
اللاعبون: ${players.map((p: { name: string; xp: number; gamesPlayed: number; gamesWon: number; warnings: number }) => `${p.name}(XP:${p.xp},G:${p.gamesPlayed},W:${p.gamesWon},W:${p.warnings})`).join(", ")}
وضع الصراحة المطلقة. أجب بالعربية.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
        "HTTP-Referer": "https://zaka.app", "X-Title": "Zaka Secret",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: command }],
        max_tokens: 2048, temperature: 0.9,
      }),
    });

    if (!response.ok) throw new Error("AI Error");
    const data = await response.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "...";

    await ctx.runMutation(internal.aiFree.saveMemory, { sessionId, role: "system", content: `[سري] ${command}` });
    await ctx.runMutation(internal.aiFree.saveMemory, { sessionId, role: "assistant", content: reply });

    return { reply };
  },
});
