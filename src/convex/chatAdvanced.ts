/**
 * ═══════════════════════════════════════════════════════════════════════
 * الدردشة المتقدمة — 15 ميزة بريميوم
 * ═══════════════════════════════════════════════════════════════════════
 * 1.  مؤشر الكتابة (Typing Indicators)
 * 2.  تعديل الرسائل (Edit Messages)
 * 3.  تمرير الرسائل (Forward Messages)
 * 4.  إشارات @mentions
 * 5.  حفظ الرسائل (Saved/Bookmarked)
 * 6.  فلترة المحتوى قبل الإرسال (Moderation)
 * 7.  إدارة الأعضاء (إضافة/حذف/ترقية/خفض)
 * 8.  الاستطلاعات (Polls)
 * 9.  ردود ذكية (Smart Replies)
 * 10. تثبيت متعدد (Multi-pin)
 * 11. الرسائل الصوتية (Voice Messages)
 * 12. الحالة عبر الإنترنت (Online Status)
 * 13. الرسائل المحفوظة个人ية (Personal Saved)
 * 14. إحصائيات عضو مفصلة
 * 15. تحليل مشاعر الغرفة (Room Mood)
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ═══════════════════════════════════════════════════════════════════════
// المoderation — كلمات محظورة + فلترة ذكية قبل الإرسال
// ═══════════════════════════════════════════════════════════════════════

const BANNED_WORDS = [
  // كلمات بذيئة أساسية
  "卡尔", "قحاب", "كلب", "حمار", "وسخ",
  // إساءة مباشرة
  "غلات", "تافه", "حقير", "سخيف",
  // سبام
  "اربح", "مجاناً", "اضغط هنا", "عرض خاص",
  // تحريض
  "اقتل", "اذبح", "احرق",
];

const SPAM_PATTERNS = [
  /(.)\1{5,}/,           // تكرار حرف أكثر من 5 مرات
  /[!؟]{4,}/,            // علامات ترقيم كثيرة جداً
  /(https?:\/\/\S+\s*){3,}/, // 3 روابط أو أكثر
  /[\u0600-\u06FF]{100}/,  // نص عربي طويل جداً بدون مسافات
];

function moderateContent(content: string): { passed: boolean; reason?: string } {
  const lower = content.toLowerCase();

  // فحص الكلمات المحظورة
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return { passed: false, reason: `المحتوى يحتوي على كلمة محظورة: "${word}"` };
    }
  }

  // فحص أنماط السبام
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      return { passed: false, reason: "المحتوى يشبه السبام أو الإرسال المتكرر" };
    }
  }

  // فحص الطول
  if (content.length > 2000) {
    return { passed: false, reason: "الرسالة طويلة جداً (الحد الأقصى 2000 حرف)" };
  }

  // فحص الرسائل الفارغة
  if (!content.trim()) {
    return { passed: false, reason: "الرسالة فارغة" };
  }

  return { passed: true };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. مؤشر الكتابة (Typing Indicators)
// ═══════════════════════════════════════════════════════════════════════

export const setTyping = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    const typingUntil = Date.now() + 5000; // 5 ثوانٍ

    // حذف أي مؤشر كتابة قديم لهذا المستخدم في هذه الغرفة
    const existing = await ctx.db
      .query("typingStatus")
      .withIndex("by_user_room", (q) => q.eq("userId", userId).eq("roomId", roomId))
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    // إضافة مؤشر جديد
    await ctx.db.insert("typingStatus", {
      roomId,
      userId,
      userName: user?.name ?? "مجهول",
      typingUntil,
    });

    return { success: true };
  },
});

export const clearTyping = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const existing = await ctx.db
      .query("typingStatus")
      .withIndex("by_user_room", (q) => q.eq("userId", userId).eq("roomId", roomId))
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    return { success: true };
  },
});

export const getTypingUsers = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const typing = await ctx.db
      .query("typingStatus")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    // فلترة المنتهي صلاحيتهم
    return typing
      .filter((t) => t.typingUntil > now && t.userId !== userId)
      .map((t) => ({ userId: t.userId, name: t.userName }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2. تعديل الرسائل (Edit Messages)
// ═══════════════════════════════════════════════════════════════════════

export const editMessage = mutation({
  args: {
    messageId: v.string(),
    newContent: v.string(),
  },
  handler: async (ctx, { messageId, newContent }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const msg = await ctx.db.get(msgId);
    if (!msg) throw new Error("الرسالة غير موجودة");
    if (msg.senderId !== userId) throw new Error("يمكنك تعديل رسالتك فقط");
    if (msg.type === "system") throw new Error("لا يمكن تعديل رسائل النظام");

    // فلترة المحتوى
    const moderation = moderateContent(newContent);
    if (!moderation.passed) {
      throw new Error(moderation.reason);
    }

    await ctx.db.patch(msgId, {
      content: newContent.slice(0, 2000),
      edited: true,
      editedAt: Date.now(),
      moderationStatus: "passed",
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3. تمرير الرسائل (Forward Messages)
// ═══════════════════════════════════════════════════════════════════════

export const forwardMessage = mutation({
  args: {
    messageId: v.string(),
    targetRoomId: v.id("chatRooms"),
  },
  handler: async (ctx, { messageId, targetRoomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const originalMsg = await ctx.db.get(msgId);
    if (!originalMsg) throw new Error("الرسالة غير موجودة");

    const targetRoom = await ctx.db.get(targetRoomId);
    if (!targetRoom) throw new Error("الغرفة الهدف غير موجودة");
    if (!targetRoom.members.includes(userId)) throw new Error("أنت لست عضواً في الغرفة الهدف");

    const sourceRoom = await ctx.db.get(originalMsg.roomId);
    const user = await ctx.db.get(userId);

    await ctx.db.insert("chatMessages", {
      roomId: targetRoomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: originalMsg.content,
      type: "forward",
      reactions: [],
      pinned: false,
      deleted: false,
      forwardFrom: {
        senderName: originalMsg.senderName,
        roomName: sourceRoom?.name ?? "غرفة",
        originalContent: originalMsg.content,
      },
      moderationStatus: "passed",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4. حفظ الرسائل (Save / Bookmark)
// ═══════════════════════════════════════════════════════════════════════

export const toggleSaveMessage = mutation({
  args: {
    messageId: v.string(),
  },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const msgId = ctx.db.normalizeId("chatMessages", messageId);
    if (!msgId) throw new Error("معرف الرسالة غير صالح");
    const msg = await ctx.db.get(msgId);
    if (!msg) throw new Error("الرسالة غير موجودة");

    // فحص إن كانت محفوظة مسبقاً
    const existing = await ctx.db
      .query("savedMessages")
      .withIndex("by_user_message", (q) => q.eq("userId", userId).eq("messageId", msgId))
      .collect();

    if (existing.length > 0) {
      // إزالة من المحفوظات
      await ctx.db.delete(existing[0]._id);
      return { saved: false };
    } else {
      // حفظ
      await ctx.db.insert("savedMessages", {
        userId,
        messageId: msgId,
        roomId: msg.roomId,
        content: msg.content,
        senderName: msg.senderName,
        savedAt: Date.now(),
      });
      return { saved: true };
    }
  },
});

export const getSavedMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const saved = await ctx.db
      .query("savedMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return saved;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5. إدارة الأعضاء (Add/Remove/Promote/Demote)
// ═══════════════════════════════════════════════════════════════════════

export const addMember = mutation({
  args: {
    roomId: v.id("chatRooms"),
    targetUserId: v.string(),
  },
  handler: async (ctx, { roomId, targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId && !room.admins.includes(userId)) {
      throw new Error("ليس لك صلاحية إضافة أعضاء");
    }

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");
    if (room.members.includes(targetId)) throw new Error("العضو موجود مسبقاً");

    const targetUser = await ctx.db.get(targetId);
    await ctx.db.patch(roomId, { members: [...room.members, targetId] });

    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `أضاف ${(await ctx.db.get(userId))?.name ?? "المشرف"} ${targetUser?.name ?? "عضوًا"} إلى الغرفة`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const removeMember = mutation({
  args: {
    roomId: v.id("chatRooms"),
    targetUserId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, targetUserId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId && !room.admins.includes(userId)) {
      throw new Error("ليس لك صلاحية حذف الأعضاء");
    }
    if (targetUserId === room.ownerId) throw new Error("لا يمكن حذف المالك");

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");

    const targetUser = await ctx.db.get(targetId);
    const updatedMembers = room.members.filter((id) => id !== targetId);
    const updatedAdmins = room.admins.filter((id) => id !== targetId);

    await ctx.db.patch(roomId, { members: updatedMembers, admins: updatedAdmins });

    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `تم إزالة ${targetUser?.name ?? "عضو"} من الغرفة${reason ? ` — ${reason}` : ""}`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const promoteToAdmin = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.string() },
  handler: async (ctx, { roomId, targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId) throw new Error("المالك فقط يمكنه ترقية المشرفين");

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");
    if (!room.members.includes(targetId)) throw new Error("العضو ليس في الغرفة");
    if (room.admins.includes(targetId)) throw new Error("العضو مشرف بالفعل");

    await ctx.db.patch(roomId, { admins: [...room.admins, targetId] });

    const targetUser = await ctx.db.get(targetId);
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `تم ترقية ${targetUser?.name ?? "عضو"} إلى مشرف ⭐`,
      type: "system",
      reactions: [],
      pinned: false,
      deleted: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const demoteAdmin = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.string() },
  handler: async (ctx, { roomId, targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.ownerId !== userId) throw new Error("المالك فقط يمكنه خفض المشرفين");

    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) throw new Error("معرف المستخدم غير صالح");

    const updatedAdmins = room.admins.filter((id) => id !== targetId);
    await ctx.db.patch(roomId, { admins: updatedAdmins });

    const targetUser = await ctx.db.get(targetId);
    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: (await ctx.db.get(userId))?.name ?? "مجهول",
      content: `تم خفض ${targetUser?.name ?? "عضو"} من المشرفين`,
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
// 6. جلب معلومات الأعضاء (لإدارة الأعضاء في الواجهة)
// ═══════════════════════════════════════════════════════════════════════

export const getRoomMembers = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) return [];

    const members = [];
    for (const memberId of room.members) {
      const user = await ctx.db.get(memberId);
      if (user) {
        members.push({
          _id: user._id,
          name: user.name ?? "مجهول",
          image: user.image,
          avatarEmoji: user.avatarEmoji,
          isOwner: room.ownerId === memberId,
          isAdmin: room.admins.includes(memberId),
          muted: user.mutedUntil ? user.mutedUntil > Date.now() : false,
          mutedUntil: user.mutedUntil,
        });
      }
    }
    return members;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 7. الاستطلاعات (Polls)
// ═══════════════════════════════════════════════════════════════════════

export const createPoll = mutation({
  args: {
    roomId: v.id("chatRooms"),
    question: v.string(),
    options: v.array(v.string()),
  },
  handler: async (ctx, { roomId, question, options }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room || !room.members.includes(userId)) throw new Error("غير مصرح");

    const user = await ctx.db.get(userId);
    if (options.length < 2 || options.length > 6) throw new Error("عدد الخيارات يجب أن يكون بين 2 و 6");

    // نخزّن الاستطلاع كنص منسق
    const pollContent = `📊 استطلاع: ${question}\n\n${options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}\n\n💡 أرسل رقم الخيار للتصويت`;

    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: pollContent,
      type: "poll",
      reactions: [],
      pinned: false,
      deleted: false,
      moderationStatus: "passed",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 8. الرسائل الصوتية (Voice Messages)
// ═══════════════════════════════════════════════════════════════════════

export const sendVoiceMessage = mutation({
  args: {
    roomId: v.id("chatRooms"),
    content: v.string(), // transcripted text or "🎤 رسالة صوتية"
    duration: v.number(), // بالثواني
  },
  handler: async (ctx, { roomId, content, duration }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const room = await ctx.db.get(roomId);
    if (!room || !room.members.includes(userId)) throw new Error("غير مصرح");

    const user = await ctx.db.get(userId);

    const moderation = moderateContent(content);
    const modStatus = moderation.passed ? "passed" as const : "flagged" as const;

    await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: content || `🎤 رسالة صوتية (${duration} ثانية)`,
      type: "voice",
      reactions: [],
      pinned: false,
      deleted: false,
      moderationStatus: modStatus,
      moderationReason: moderation.reason,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 9. إرسال رسالة مع فلترة تلقائية + @mentions
// ═══════════════════════════════════════════════════════════════════════

export const sendMessageAdvanced = mutation({
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

    // فحص المحتوى قبل الإرسال
    const moderation = moderateContent(content);
    const modStatus = moderation.passed ? "passed" as const : "flagged" as const;

    // استخراج @mentions
    const mentionRegex = /@(\S+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentionNames.push(match[1]);
    }

    // البحث عن المستخدمين المُشار إليهم
    const allMembers = await Promise.all(
      room.members.map(async (mid) => {
        const u = await ctx.db.get(mid);
        return u ? { id: mid, name: u.name ?? "" } : null;
      })
    );

    const mentionIds = mentionNames
      .map((name) => allMembers.find((m) => m?.name.includes(name))?.id)
      .filter((id): id is typeof room.members[number] => id !== undefined);

    const user = await ctx.db.get(userId);
    const msgId = await ctx.db.insert("chatMessages", {
      roomId,
      senderId: userId,
      senderName: user?.name ?? "مجهول",
      content: content.slice(0, 2000),
      type: "text",
      reactions: [],
      pinned: false,
      deleted: false,
      replyTo,
      mentionIds: mentionIds.length > 0 ? mentionIds : undefined,
      moderationStatus: modStatus,
      moderationReason: moderation.reason,
      createdAt: Date.now(),
    });

    // حذف مؤشر الكتابة بعد الإرسال
    const typingDocs = await ctx.db
      .query("typingStatus")
      .withIndex("by_user_room", (q) => q.eq("userId", userId).eq("roomId", roomId))
      .collect();
    for (const doc of typingDocs) {
      await ctx.db.delete(doc._id);
    }

    return {
      messageId: msgId,
      moderation: modStatus,
      moderationReason: moderation.reason,
      mentionedUsers: mentionIds.length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 10. إحصائيات عضو مفصلة في الغرفة
// ═══════════════════════════════════════════════════════════════════════

export const getMemberStats = query({
  args: { roomId: v.id("chatRooms"), targetUserId: v.string() },
  handler: async (ctx, { roomId, targetUserId }) => {
    const targetId = ctx.db.normalizeId("users", targetUserId);
    if (!targetId) return null;

    const user = await ctx.db.get(targetId);
    if (!user) return null;

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    const userMessages = messages.filter(
      (m) => m.senderId === targetId && m.type !== "system"
    );
    const totalReactions = userMessages.reduce((sum, m) => sum + m.reactions.length, 0);
    const pinnedCount = userMessages.filter((m) => m.pinned).length;
    const deletedCount = userMessages.filter((m) => m.deleted).length;
    const flaggedCount = userMessages.filter((m) => m.moderationStatus === "flagged").length;

    // أكثر الأوقات نشاطاً
    const hours = userMessages.map((m) => new Date(m.createdAt).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach((h) => { hourCounts[h] = (hourCounts[h] ?? 0) + 1; });
    const peakHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

    // متوسط طول الرسائل
    const avgLength = userMessages.length > 0
      ? Math.round(userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length)
      : 0;

    const room = await ctx.db.get(roomId);

    return {
      name: user.name ?? "مجهول",
      avatarEmoji: user.avatarEmoji,
      totalMessages: userMessages.length,
      totalReactions,
      pinnedCount,
      deletedCount,
      flaggedCount,
      peakHour: peakHour ? `${peakHour[0]}:00` : "غير معروف",
      avgMessageLength: avgLength,
      isMember: room?.members?.includes(targetId) ?? false,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 11. تحليل مشاعر الغرفة (Room Mood Analysis)
// ═══════════════════════════════════════════════════════════════════════

export const getRoomMood = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(100);

    const recent = messages.filter((m) => m.type !== "system" && !m.deleted);

    // تحليل بسيط للمشاعر بناءً على الإيموجيات والكلمات
    const positiveWords = ["شكراً", "أحسنت", "رائع", "ممتاز", "حلو", "❤️", "👍", "🔥", "🎉", "😄"];
    const negativeWords = ["غلط", "حشى", "مو عاجبني", "زهقان", "😢", "😡", "🤬"];
    const questionCount = recent.filter((m) => m.content.includes("؟")).length;
    const reactionTotal = recent.reduce((sum, m) => sum + m.reactions.length, 0);

    let positiveScore = 0;
    let negativeScore = 0;
    recent.forEach((m) => {
      positiveWords.forEach((w) => { if (m.content.includes(w)) positiveScore++; });
      negativeWords.forEach((w) => { if (m.content.includes(w)) negativeScore++; });
    });

    const total = positiveScore + negativeScore || 1;
    const moodScore = Math.round(((positiveScore / total) * 100));

    let mood = "محايد 😐";
    if (moodScore > 70) mood = "سعيد 😄";
    else if (moodScore > 55) mood = "إيجابي 🙂";
    else if (moodScore < 30) mood = "سلبي 😞";
    else if (moodScore < 45) mood = "هادئ 🤔";

    return {
      mood,
      moodScore,
      recentActivity: recent.length,
      questionCount,
      reactionTotal,
      avgMessagesPerHour: recent.length > 0
        ? Math.round((recent.length / Math.max(1, (recent[0].createdAt - recent[recent.length - 1].createdAt) / 3600000)) * 10) / 10
        : 0,
      topEmojis: (() => {
        const emojiCounts: Record<string, number> = {};
        recent.forEach((m) => {
          m.reactions.forEach((r) => { emojiCounts[r.emoji] = (emojiCounts[r.emoji] ?? 0) + 1; });
        });
        return Object.entries(emojiCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([emoji, count]) => ({ emoji, count }));
      })(),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 12. الحالة عبر الإنترنت (Online Presence — via typingStatus ping)
// ═══════════════════════════════════════════════════════════════════════

export const pingPresence = mutation({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // نستخدم typingStatus كـ presence — إذا كان typingUntil حديث فهو "متصل"
    const existing = await ctx.db
      .query("typingStatus")
      .withIndex("by_user_room", (q) => q.eq("userId", userId).eq("roomId", roomId))
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    // نضع timeout طويل (60 ثانية) كـ presence marker
    await ctx.db.insert("typingStatus", {
      roomId,
      userId,
      userName: (await ctx.db.get(userId))?.name ?? "",
      typingUntil: Date.now() + 60000,
    });
  },
});

export const getOnlineMembers = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const now = Date.now();
    const typing = await ctx.db
      .query("typingStatus")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    // المتصلون: من لديهم typingUntil حديث (خلال 60 ثانية)
    const online = typing
      .filter((t) => t.typingUntil > now - 30000)
      .map((t) => t.userId);

    return [...new Set(online)];
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 13. جلب جميع الغرف مع معلومات إضافية (للتمرير السريع)
// ═══════════════════════════════════════════════════════════════════════

export const getRoomsWithMeta = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const allRooms = await ctx.db.query("chatRooms").collect();
    const now = Date.now();

    const roomsWithMeta = [];
    for (const room of allRooms) {
      if (!room.members.includes(userId) && room.type !== "public") continue;
      if (room.archived) continue;

      // آخر رسالة
      const lastMsg = await ctx.db
        .query("chatMessages")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .order("desc")
        .first();

      // عدد غير المقروء (رسائل بعد آخر قراءة — مبسط)
      const recentMessages = await ctx.db
        .query("chatMessages")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .order("desc")
        .take(20);

      const unreadCount = recentMessages.filter(
        (m) => m.senderId !== userId && m.type !== "system" && !m.deleted
      ).length;

      roomsWithMeta.push({
        _id: room._id,
        name: room.name,
        description: room.description,
        type: room.type,
        memberCount: room.members.length,
        isMember: room.members.includes(userId),
        isOwner: room.ownerId === userId,
        isAdmin: room.admins.includes(userId),
        archived: room.archived,
        createdAt: room.createdAt,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content.slice(0, 50),
              senderName: lastMsg.senderName,
              time: lastMsg.createdAt,
              isOwn: lastMsg.senderId === userId,
            }
          : null,
        unreadCount: room.members.includes(userId) ? Math.min(unreadCount, 99) : 0,
      });
    }

    // ترتيب حسب آخر رسالة
    roomsWithMeta.sort((a, b) => {
      const aTime = a.lastMessage?.time ?? a.createdAt;
      const bTime = b.lastMessage?.time ?? b.createdAt;
      return bTime - aTime;
    });

    return roomsWithMeta;
  },
});
