/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام غرف المناقشة المتطورة — أفضل من تيليجرام
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── إنشاء غرفة جديدة ──────────
export const createRoom = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    password: v.optional(v.string()),
    maxMembers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), me.email))
      .first();

    const roomId = await ctx.db.insert("settings", {
      key: `chat_room_${Date.now()}`,
      value: JSON.stringify({
        name: args.name,
        description: args.description ?? "",
        isPrivate: args.isPrivate,
        password: args.password ?? null,
        maxMembers: args.maxMembers ?? 100,
        createdBy: user?._id ?? me.subject,
        creatorName: user?.name ?? "مجهول",
        createdAt: Date.now(),
        members: [user?._id ?? me.subject],
        pinnedMessages: [],
        status: "active",
      }),
    });

    return { roomId: roomId.toString(), name: args.name };
  },
});

// ─── إرسال رسالة ──────────
export const sendMessage = mutation({
  args: {
    roomKey: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("file"),
      v.literal("poll"),
      v.literal("system"),
    ),
    replyTo: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), me.email))
      .first();

    const msgKey = `chat_msg_${args.roomKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await ctx.db.insert("settings", {
      key: msgKey,
      value: JSON.stringify({
        roomKey: args.roomKey,
        senderId: user?._id ?? me.subject,
        senderName: user?.name ?? "مجهول",
        content: args.content,
        type: args.type,
        replyTo: args.replyTo ?? null,
        metadata: args.metadata ?? null,
        reactions: {},
        isPinned: false,
        edited: false,
        createdAt: Date.now(),
      }),
    });

    return { success: true };
  },
});

// ─── جلب رسائل الغرفة ──────────
export const getRoomMessages = query({
  args: {
    roomKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allMsgs = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), `chat_msg_${args.roomKey}_`))
      .filter((q) => q.lt(q.field("key"), `chat_msg_${args.roomKey}_z`))
      .order("asc")
      .take(args.limit ?? 100);

    return allMsgs.map((m) => {
      try {
        const data = JSON.parse(m.value);
        return { id: m._id, ...data };
      } catch {
        return null;
      }
    }).filter(Boolean);
  },
});

// ─── جلب قائمة الغرف ──────────
export const getRooms = query({
  args: {},
  handler: async (ctx) => {
    const allRooms = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), "chat_room_"))
      .filter((q) => q.lt(q.field("key"), "chat_room_z"))
      .order("desc")
      .take(50);

    return allRooms.map((r) => {
      try {
        const data = JSON.parse(r.value);
        return { id: r._id, key: r.key, ...data };
      } catch {
        return null;
      }
    }).filter(Boolean);
  },
});

// ─── حذف رسالة ──────────
export const deleteMessage = mutation({
  args: {
    messageId: v.id("settings"),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");
    await ctx.db.delete(args.messageId);
    return { success: true };
  },
});

// ─── تثبيت/إلغاء تثبيت رسالة ──────────
export const togglePinMessage = mutation({
  args: {
    messageId: v.id("settings"),
    pinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("الرسالة غير موجودة");

    try {
      const data = JSON.parse(msg.value);
      data.isPinned = args.pinned;
      await ctx.db.patch(args.messageId, { value: JSON.stringify(data) });
    } catch {
      throw new Error("خطأ في بيانات الرسالة");
    }

    return { success: true };
  },
});

// ─── ردود فعل على رسالة ──────────
export const addReaction = mutation({
  args: {
    messageId: v.id("settings"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("الرسالة غير موجودة");

    try {
      const data = JSON.parse(msg.value);
      if (!data.reactions) data.reactions = {};
      if (!data.reactions[args.emoji]) data.reactions[args.emoji] = [];

      const userId = me.subject;
      if (data.reactions[args.emoji].includes(userId)) {
        data.reactions[args.emoji] = data.reactions[args.emoji].filter(
          (id: string) => id !== userId,
        );
      } else {
        data.reactions[args.emoji].push(userId);
      }

      await ctx.db.patch(args.messageId, { value: JSON.stringify(data) });
    } catch {
      throw new Error("خطأ في بيانات الرسالة");
    }

    return { success: true };
  },
});

// ─── الانضمام لغرفة ──────────
export const joinRoom = mutation({
  args: {
    roomKey: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const room = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.roomKey))
      .first();

    if (!room) throw new Error("الغرفة غير موجودة");

    const data = JSON.parse(room.value);

    if (data.isPrivate && data.password && data.password !== args.password) {
      throw new Error("كلمة المرور غير صحيحة");
    }

    const userId = me.subject;
    if (!data.members) data.members = [];
    if (!data.members.includes(userId)) {
      data.members.push(userId);
    }

    await ctx.db.patch(room._id, { value: JSON.stringify(data) });
    return { success: true };
  },
});

// ─── البحث في الرسائل ──────────
export const searchMessages = query({
  args: {
    query: v.string(),
    roomKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allMsgs = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), "chat_msg_"))
      .take(200);

    const results: Array<unknown> = [];
    const searchLower = args.query.toLowerCase();

    for (const m of allMsgs) {
      try {
        const data = JSON.parse(m.value);
        if (
          data.content?.toLowerCase().includes(searchLower) &&
          (!args.roomKey || data.roomKey === args.roomKey)
        ) {
          results.push({ id: m._id, ...data });
        }
      } catch {
        // skip
      }
    }

    return results.slice(0, 50);
  },
});
