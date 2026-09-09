/**
 * ═══════════════════════════════════════════════════════════════════════
 * غرف الدردشة الأسطورية — Backend متوافق مع Schema الحالي
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  isDuplicateSpam,
  maxMatchSeverity,
  ruleTitle,
  scanCommunityText,
} from "../lib/communityRules";

/**
 * رقيب القوانين الآلي على الرسائل: يفحص كل رسالة فور إرسالها، يكتشف
 * السبام بالنص المكرر، ويطبق سلم التنبيه التلقائي (تنبيه ← كتم) مع تسجيل
 * كامل للإدارة في aiLogs وإشعار ملون للمرسل.
 */
async function enforceChatMessage(
  ctx: any,
  userId: string,
  roomId: string,
  content: string,
) {
  const now = Date.now();
  const matches = scanCommunityText(content);

  // كشف السبام: نص مكرر لنفس المرسل خلال دقيقتين
  const recent = await ctx.db
    .query("chatMessages")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .order("desc")
    .take(40);
  const mineRecent = recent
    .filter((m: any) => m.senderId === userId && now - (m.createdAt ?? 0) < 120000)
    .map((m: any) => m.content ?? "");
  if (
    isDuplicateSpam(content, mineRecent, 2) &&
    !matches.some((m) => m.ruleId === 1 || m.ruleId === 19 || m.ruleId === 26)
  ) {
    matches.unshift({ ruleId: 1, evidence: "رسالة مكررة" });
  }

  if (matches.length === 0) {
    return { flagged: false, matchedTitles: [] as string[], action: "none" };
  }

  const severity = maxMatchSeverity(matches);
  const user = await ctx.db.get(userId);
  const warnings = user?.warnings ?? 0;
  const lastWarningAt = user?.lastWarningAt ?? 0;
  const titles = [...new Set(matches.map((m) => ruleTitle(m.ruleId)))];

  // مهلة بين التنبيهات تمنع إغراق نفس اللاعب بالإشعارات
  if (lastWarningAt && now - lastWarningAt < 45000) {
    await ctx.db.insert("aiLogs", {
      action: "auto_moderation_log",
      subsystem: "moderation",
      message: `رسالة مخالفة مرصودة (بدون تنبيه — مهلة): ${titles.join("، ")}`,
      severity: severity === "high" ? "warning" : "info",
      targetUser: user?.name,
      targetRoom: roomId,
      data: JSON.stringify({ ruleIds: matches.map((m) => m.ruleId) }),
      auto: true,
      executedBy: "ai_master",
      timestamp: now,
    });
    return { flagged: true, matchedTitles: titles, action: "log" };
  }

  const patch: any = { lastWarningAt: now, warnings: warnings + 1 };
  let action: "warn" | "mute" = "warn";
  // سلم تصاعدي: 3 تنبيهات أو مخالفة خطيرة ثانية ← كتم تلقائي لمدة ساعة
  if ((severity === "high" && warnings >= 1) || warnings >= 3) {
    patch.mutedUntil = now + 60 * 60 * 1000;
    action = "mute";
  }
  await ctx.db.patch(userId, patch);

  await ctx.db.insert("notifications", {
    userId,
    title: action === "mute" ? "🔇 كتم تلقائي" : "⚠️ تنبيه تلقائي",
    body:
      action === "mute"
        ? `كُتمت لمدة ساعة بعد رصد مخالفة: ${titles.join("، ")}`
        : `رصدنا رسالة تخالف القوانين (${titles.join("، ")}). تكررها يقود لكتم تلقائي.`,
    type: action === "mute" ? ("ban" as const) : ("warning" as const),
    read: false,
    createdAt: now,
  });

  await ctx.db.insert("aiLogs", {
    action: "auto_moderation",
    subsystem: "moderation",
    message: `تطبيق ${action === "mute" ? "كتم" : "تنبيه"} تلقائي بسبب: ${titles.join("، ")}`,
    severity: action === "mute" ? "critical" : severity === "high" ? "warning" : "info",
    targetUser: user?.name,
    targetRoom: roomId,
    data: JSON.stringify({
      content: content.slice(0, 200),
      ruleIds: matches.map((m) => m.ruleId),
      warnings: warnings + 1,
      action,
    }),
    auto: true,
    executedBy: "ai_master",
    timestamp: now,
  });

  return { flagged: true, matchedTitles: titles, action };
}

// ═══════════════════════════════════════════════════════════════════════
// ① إنشاء غرفة
// ═══════════════════════════════════════════════════════════════════════
export const createRoom = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(v.literal("public"), v.literal("private"), v.literal("password"), v.literal("invite")),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const user = await ctx.db.get(userId);
    const inviteCode = args.type === "invite" ? Math.random().toString(36).slice(2, 8).toUpperCase() : undefined;

    const roomId = await ctx.db.insert("chatRooms", {
      name: args.name,
      description: args.description ?? "",
      type: args.type,
      password: args.password,
      inviteCode,
      ownerId: userId,
      members: [userId],
      admins: [userId],
      archived: false,
      createdAt: Date.now(),
    });

    // Welcome message
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: `أنشأ الغرفة: ${args.name}`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { roomId, name: args.name, inviteCode };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② إرسال رسالة
// ═══════════════════════════════════════════════════════════════════════
export const sendMessage = mutation({
  args: {
    roomId: v.id("chatRooms"),
    content: v.string(),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, content, replyTo }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.archived) throw new Error("الغرفة مُؤرشفة");
    if (!room.members.includes(userId)) throw new Error("أنت لست عضواً في هذه الغرفة");

    const user = await ctx.db.get(userId);

    const messageId = await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: content.slice(0, 2000),
      type: "text",
      reactions: [],
      pinned: false,
      deleted: false,
      replyTo,
      createdAt: Date.now(),
    });

    // مراقبة الالتزام بالقوانين — فحص تلقائي فوري لكل رسالة
    const enforcement = await enforceChatMessage(ctx, userId, roomId, content.slice(0, 2000));

    return {
      messageId,
      content: content.slice(0, 2000),
      flagged: enforcement.flagged,
      matchedTitles: enforcement.matchedTitles,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ جلب الرسائل
// ═══════════════════════════════════════════════════════════════════════
export const getMessages = query({
  args: {
    roomId: v.id("chatRooms"),
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, { roomId, limit, before }) => {
    const take = Math.min(limit ?? 50, 100);
    let q = ctx.db
      .query("chatMessages")
      .withIndex("by_room", (qi) => qi.eq("roomId", roomId));

    if (before) {
      q = q.filter((qi) => qi.lt(qi.field("createdAt"), before));
    }

    const messages = await q.order("desc").take(take);
    return messages.reverse();
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ رد على رسالة
// ═══════════════════════════════════════════════════════════════════════
export const replyToMessage = mutation({
  args: {
    roomId: v.id("chatRooms"),
    messageId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { roomId, messageId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room || !room.members.includes(userId)) throw new Error("غير مصرح");

    const user = await ctx.db.get(userId);
    const replyId = await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: content.slice(0, 2000),
      type: "text",
      reactions: [],
      pinned: false,
      deleted: false,
      replyTo: messageId,
      createdAt: Date.now(),
    });

    // مراقبة الالتزام بالقوانين على الردود أيضاً
    await enforceChatMessage(ctx, userId, roomId, content.slice(0, 2000));

    return { replyId };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑤ ردود فعل
// ═══════════════════════════════════════════════════════════════════════
export const toggleReaction = mutation({
  args: {
    messageId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, { messageId, emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const msg = await ctx.db.get(msgId);
    if (!msg) throw new Error("الرسالة غير موجودة");

    const reactions = [...(msg.reactions ?? [])];
    const existing = reactions.findIndex((r) => r.emoji === emoji && r.userId === userId);

    if (existing >= 0) {
      reactions.splice(existing, 1);
    } else {
      reactions.push({ emoji, userId });
    }

    await ctx.db.patch(msgId, { reactions });
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑥ تثبيت رسالة
// ═══════════════════════════════════════════════════════════════════════
export const togglePin = mutation({
  args: { roomId: v.id("chatRooms"), messageId: v.string() },
  handler: async (ctx, { roomId, messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId && !room.admins.includes(userId)) {
      throw new Error("ليس لك صلاحية التثبيت");
    }

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const msg = await ctx.db.get(msgId);
    if (!msg) throw new Error("الرسالة غير موجودة");

    const newPinned = !msg.pinned;
    await ctx.db.patch(msgId, { pinned: newPinned });

    if (newPinned) {
      await ctx.db.patch(roomId, { pinnedMessageId: messageId });
    } else if (room.pinnedMessageId === messageId) {
      await ctx.db.patch(roomId, { pinnedMessageId: undefined });
    }

    return { pinned: newPinned };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑦ حذف رسالة
// ═══════════════════════════════════════════════════════════════════════
export const deleteMessage = mutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const rawMsg = await ctx.db.get(msgId);
    if (!rawMsg) throw new Error("الرسالة غير موجودة");
    const msg = rawMsg as any;
    const roomId = msg.roomId as string;
    const senderId = msg.senderId as string;

    // Owner, admin, or the sender
    const room = await ctx.db.get(roomId as any) as any;
    if (!room) throw new Error("الغرفة غير موجودة");

    const isOwner = room.ownerId === userId;
    const isAdmin = room.admins.includes(userId);
    const isSender = senderId === userId;

    if (!isOwner && !isAdmin && !isSender) {
      throw new Error("ليس لك صلاحية الحذف");
    }

    await ctx.db.patch(msgId, { deleted: true, content: "🗑️ تم حذف هذه الرسالة" });
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑧ الانضمام
// ═══════════════════════════════════════════════════════════════════════
export const joinRoom = mutation({
  args: { roomId: v.id("chatRooms"), password: v.optional(v.string()) },
  handler: async (ctx, { roomId, password }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.archived) throw new Error("الغرفة مُؤرشفة");
    if (room.type === "private") throw new Error("هذه غرفة خاصة");
    if (room.type === "password" && room.password !== password) {
      throw new Error("كلمة المرور خاطئة");
    }
    if (room.members.includes(userId)) return { alreadyMember: true };

    const updatedMembers = [...room.members, userId];
    await ctx.db.patch(roomId, { members: updatedMembers });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: `انضم ${user?.name ?? "لاعب"} إلى الغرفة`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true, memberCount: updatedMembers.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑨ المغادرة
// ═══════════════════════════════════════════════════════════════════════
export const leaveRoom = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (userId === room.ownerId) throw new Error("المالك لا يمكنه مغادرة غرفته");

    const updatedMembers = room.members.filter((id) => id !== userId);
    const updatedAdmins = room.admins.filter((id) => id !== userId);
    await ctx.db.patch(roomId, { members: updatedMembers, admins: updatedAdmins });

    const user = await ctx.db.get(userId);
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: `غادر ${user?.name ?? "لاعب"} الغرفة`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑩ كتم عضو (update mutedUntil on user)
// ═══════════════════════════════════════════════════════════════════════
export const muteMember = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.string(), durationMinutes: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, { roomId, targetUserId, durationMinutes, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId && !room.admins.includes(userId)) {
      throw new Error("ليس لك صلاحية الكتم");
    }

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");
    const targetUser = await ctx.db.get(targetId);
    const mutedUntil = Date.now() + durationMinutes * 60 * 1000;
    await ctx.db.patch(targetId, { mutedUntil });

    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `\u062a\u0645 \u0643\u062a\u0645 ${targetUser?.name ?? "\u0639\u0636\u0648"} \u0644\u0645\u062f\u0629 ${durationMinutes} \u062f\u0642\u064a\u0642\u0629${reason ? ` — ${reason}` : ""}`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑪ طرد عضو
// ═══════════════════════════════════════════════════════════════════════
export const kickMember = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { roomId, targetUserId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId && !room.admins.includes(userId)) {
      throw new Error("ليس لك صلاحية الطرد");
    }
    if (targetUserId === room.ownerId) throw new Error("لا يمكن طرد المالك");

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");

    const updatedMembers = room.members.filter((id) => id !== targetId);
    const updatedAdmins = room.admins.filter((id) => id !== targetId);
    await ctx.db.patch(roomId, { members: updatedMembers, admins: updatedAdmins });

    const targetUser = await ctx.db.get(targetId);
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `تم طرد ${targetUser?.name ?? "عضو"}${reason ? ` — ${reason}` : ""}`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑫ جلب غرف المستخدم
// ═══════════════════════════════════════════════════════════════════════
export const getUserRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const allRooms = await ctx.db.query("chatRooms").collect();
    return allRooms
      .filter((r) => r.members.includes(userId) || r.type === "public")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map((r) => ({
        _id: r._id,
        name: r.name,
        description: r.description,
        type: r.type,
        memberCount: r.members.length,
        isMember: r.members.includes(userId),
        isOwner: r.ownerId === userId,
        isAdmin: r.admins.includes(userId),
        archived: r.archived,
        createdAt: r.createdAt,
      }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑬ إحصائيات الغرفة
// ═══════════════════════════════════════════════════════════════════════
export const getRoomStats = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return null;

    const meId = await getAuthUserId(ctx);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const now = Date.now();
    const today = messages.filter((m) => now - m.createdAt < 24 * 60 * 60 * 1000);
    const thisWeek = messages.filter((m) => now - m.createdAt < 7 * 24 * 60 * 60 * 1000);
    const senders = new Set(messages.map((m) => m.senderId));
    const pinned = messages.filter((m) => m.pinned).length;

    const senderCounts: Record<string, number> = {};
    messages.forEach((m) => { senderCounts[m.senderName] = (senderCounts[m.senderName] ?? 0) + 1; });
    const topSenders = Object.entries(senderCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalMessages: messages.length,
      todayMessages: today.length,
      weekMessages: thisWeek.length,
      uniqueMembers: senders.size,
      memberCount: room.members.length,
      pinnedCount: pinned,
      topSenders,
      createdAt: room.createdAt,
      // موجّة 6.3 — هل المُستدعي عريف هذه الغرفة؟ (لإظهار أدوات العُرفة)
      isModerator: meId !== null && (room.ownerId === meId || room.admins.includes(meId)),
      // موجّة 9.3 — هل المُستدعي مالك الغرفة؟ (لإظهار إدارة العُرفاء)
      isOwner: meId !== null && room.ownerId === meId,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑭ تعديل إعدادات الغرفة
// ═══════════════════════════════════════════════════════════════════════
export const updateRoom = mutation({
  args: {
    roomId: v.id("chatRooms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    addAdmin: v.optional(v.string()),
    removeAdmin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(args.roomId);
    if (!room || room.ownerId !== userId) throw new Error("مالك الغرفة فقط يمكنه التعديل");

    const patches: Record<string, unknown> = {};
    if (args.name) patches.name = args.name;
    if (args.description !== undefined) patches.description = args.description;
    if (args.archived !== undefined) patches.archived = args.archived;
    if (args.addAdmin) {
      patches.admins = [...new Set([...room.admins, args.addAdmin])];
    }
    if (args.removeAdmin) {
      patches.admins = room.admins.filter((id) => id !== args.removeAdmin);
    }

    await ctx.db.patch(args.roomId, patches);
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑮ بحث في الرسائل
// ═══════════════════════════════════════════════════════════════════════
export const searchMessages = query({
  args: { roomId: v.id("chatRooms"), query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { roomId, query: q, limit }) => {
    const take = Math.min(limit ?? 20, 50);
    const allMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (qi) => qi.eq("roomId", roomId))
      .order("desc")
      .take(500);

    return allMessages
      .filter((m) => m.content.includes(q) && !m.deleted)
      .slice(0, take);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑯ جلب جميع الغرف (للمالك)
// ═══════════════════════════════════════════════════════════════════════
export const getAllRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return [];

    return (await ctx.db.query("chatRooms").collect()).map((r) => ({
      _id: r._id,
      name: r.name,
      type: r.type,
      memberCount: r.members.length,
      archived: r.archived,
      createdAt: r.createdAt,
    }));
  },
});
