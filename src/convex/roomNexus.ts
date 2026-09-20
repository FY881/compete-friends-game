/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ v10.0 — خادم الغرف الخاصة المتقدمة
 *
 * يحوّل «الغرفة» من سجل دردشة إلى كيان كامل: نوع، خصوصية، أدوار وصلاحيات
 * دقيقة، دعوات محدودة، مواضيع، قواعد، وضع بطيء، سجل إجراءات، وسيطرة سيادية
 * من المالك. كل قرار هنا مُنفَّذ فعلياً — لا خيار بلا وظيفة خلفية.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import {
  canCreateKind,
  canJoin,
  cleanText,
  effectiveMemberLimit,
  filterRooms,
  generateInviteCode,
  hasPermission,
  inviteCodesEqual,
  normalizeTags,
  permissionsFor,
  resolveRole,
  roomHealth,
  roomKind,
  roomState,
  roleLabel,
  slowModeRemaining,
  sortRooms,
  summarizeRoomAudit,
  tierRank,
  tierRoomQuota,
  validateInvite,
  validateRoomName,
  type RoomFilterMode,
  type RoomPermission,
  type RoomRole,
  type RoomSortMode,
} from "./roomCore";

const MAX_ROOMS_SCAN = 200;

// ───────────────────────────────────────────────────────────────────────
// أدوات داخلية
// ───────────────────────────────────────────────────────────────────────

/** قراءة رتبة عضوية اللاعب الفعلية (بما فيها انتهاء الصلاحية) */
export async function readTier(ctx: QueryCtx | MutationCtx, userId: string): Promise<string> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId as never))
    .order("desc")
    .first();
  if (!membership) return "bronze";
  if (membership.expiresAt && membership.expiresAt <= Date.now()) return "bronze";
  return membership.tier ?? "bronze";
}

type ProfileDoc = {
  _id: string;
  roomId: string;
  kind: string;
  visibility: string;
  avatar: string;
  bannerTone: string;
  tags: string[];
  rules: string;
  welcomeMessage: string;
  memberLimit: number;
  requiresTier: string;
  clanId?: string;
  eventId?: string;
  expiresAt: number;
  permanent: boolean;
  slowModeSec: number;
  moderationState: string;
  moderationNote?: string;
  memberRoles: Record<string, string>;
  rolePerms: Record<string, Record<string, boolean>>;
  pinnedMessageIds: string[];
  featured: boolean;
  challengeReward: number;
  messageCount: number;
  joinCount: number;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
};

/** يُنشئ ملفاً افتراضياً لأي غرفة قديمة عند أول لمسة — ترحيل ذاتي بلا هجرات يدوية */
async function ensureProfile(ctx: MutationCtx, roomId: Id<"chatRooms">): Promise<void> {
  const existing = await ctx.db
    .query("roomProfiles")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();
  if (existing) return;

  const room = await ctx.db.get(roomId);
  if (!room) throw new Error("الغرفة غير موجودة");

  const legacyKind = room.type === "public" ? "open" : room.type === "password" ? "private" : "private";
  const spec = roomKind(legacyKind);
  const now = Date.now();
  const id = await ctx.db.insert("roomProfiles", {
    roomId,
    kind: legacyKind,
    visibility: spec.visibility,
    avatar: spec.emoji,
    bannerTone: spec.tone,
    tags: [],
    rules: "",
    welcomeMessage: "",
    memberLimit: spec.memberLimit,
    requiresTier: "bronze",
    expiresAt: 0,
    permanent: true,
    slowModeSec: 0,
    moderationState: "normal",
    memberRoles: {},
    rolePerms: {},
    pinnedMessageIds: [],
    featured: false,
    challengeReward: 0,
    messageCount: 0,
    joinCount: room.members.length,
    lastActivityAt: room.createdAt,
    createdAt: now,
    updatedAt: now,
  } as never);
  void id;
}

async function readProfile(ctx: QueryCtx | MutationCtx, roomId: Id<"chatRooms">): Promise<ProfileDoc | null> {
  const p = await ctx.db
    .query("roomProfiles")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();
  return (p as unknown as ProfileDoc) ?? null;
}

async function writeAudit(
  ctx: MutationCtx,
  roomId: Id<"chatRooms">,
  actor: { id?: Id<"users">; name: string; source: string },
  action: string,
  details: string,
) {
  await ctx.db.insert("roomAudit", {
    roomId,
    actorId: actor.id,
    actorName: actor.name,
    action,
    details,
    source: actor.source,
    at: Date.now(),
  } as never);
}

async function postSystem(ctx: MutationCtx, roomId: Id<"chatRooms">, senderId: Id<"users">, senderName: string, content: string) {
  await ctx.db.insert("chatMessages", {
    roomId,
    senderId,
    senderName,
    content,
    type: "system",
    reactions: [],
    pinned: false,
    deleted: false,
    createdAt: Date.now(),
  } as never);
}

async function touchProfile(ctx: MutationCtx, roomId: Id<"chatRooms">, patch: Record<string, unknown>) {
  const profile = await ctx.db
    .query("roomProfiles")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();
  if (!profile) return;
  await ctx.db.patch(profile._id, { ...patch, updatedAt: Date.now() } as never);
}

/** يُنفَّذ من مسار إرسال الرسائل: يفرض القفل/التقييد/الوضع البطيء ويحدّث إحصاءات الغرفة */
export async function enforceRoomSend(
  ctx: MutationCtx,
  roomId: Id<"chatRooms">,
  userId: Id<"users">,
): Promise<{ ok: boolean; reason: string }> {
  const profile = await readProfile(ctx, roomId);
  if (!profile) {
    // غرفة قديمة بلا ملف — ننشئ ملفاً ونمرّر الرسالة (بلا تعطيل)
    await ensureProfile(ctx, roomId);
    return { ok: true, reason: "ok" };
  }
  const room = await ctx.db.get(roomId);
  if (!room) return { ok: false, reason: "الغرفة غير موجودة" };

  const state = roomState(profile, Date.now());
  if (state.closed) {
    await writeAudit(ctx, roomId, { name: "النظام", source: "system" }, "send_blocked", state.reason);
    return { ok: false, reason: state.reason || "الغرفة مغلقة" };
  }
  if (state.locked) return { ok: false, reason: "الغرفة مقفلة مؤقتاً — قراءة فقط" };

  const role = resolveRole(profile, room.ownerId, room.admins, userId);
  if (!hasPermission(profile, role, "speak")) {
    return { ok: false, reason: "أنت مقيَّد في هذه الغرفة — لا يمكنك الكتابة" };
  }

  const recent = await ctx.db
    .query("chatMessages")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .order("desc")
    .take(6);
  const mine = recent.find((m) => m.senderId === userId);
  if (mine) {
    const wait = slowModeRemaining(profile, mine.createdAt, Date.now());
    if (wait > 0) return { ok: false, reason: `الوضع البطيء مفعّل — انتظر ${wait} ثانية` };
  }
  await touchProfile(ctx, roomId, {
    messageCount: profile.messageCount + 1,
    lastActivityAt: Date.now(),
  });
  return { ok: true, reason: "ok" };
}

// ═══════════════════════════════════════════════════════════════════════
// ① عرض الغرف: فلترة + ترتيب + بحث حقيقي
// ═══════════════════════════════════════════════════════════════════════
export const listRoomsV2 = query({
  args: {
    filter: v.optional(v.string()),
    sort: v.optional(v.string()),
    q: v.optional(v.string()),
    kind: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const now = Date.now();
    const rooms = await ctx.db.query("chatRooms").order("desc").take(MAX_ROOMS_SCAN);
    const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
    const profileByRoom = new Map<string, ProfileDoc>();
    for (const p of profiles) profileByRoom.set(p.roomId as unknown as string, p as unknown as ProfileDoc);

    const views = rooms.map((room) => {
      const profile = profileByRoom.get(room._id as unknown as string) ?? null;
      const kind = roomKind(profile?.kind);
      const role = resolveRole(
        profile,
        room.ownerId as unknown as string,
        room.admins as unknown as string[],
        meId as unknown as string | null,
      );
      return {
        _id: room._id as unknown as string,
        name: room.name,
        description: room.description ?? "",
        kind: kind.id,
        kindLabel: kind.label,
        kindEmoji: kind.emoji,
        tone: profile?.bannerTone ?? kind.tone,
        avatar: profile?.avatar ?? kind.emoji,
        visibility: profile?.visibility ?? kind.visibility,
        tags: (profile?.tags ?? []) as string[],
        memberCount: room.members.length,
        memberLimit: profile?.memberLimit ?? 0,
        messageCount: profile?.messageCount ?? 0,
        lastActivityAt: profile?.lastActivityAt ?? room.createdAt,
        createdAt: room.createdAt,
        expiresAt: profile?.expiresAt ?? 0,
        featured: profile?.featured ?? false,
        moderationState: profile?.moderationState ?? "normal",
        isMember: meId !== null && room.members.includes(meId),
        isOwner: meId !== null && room.ownerId === meId,
        isAdmin: meId !== null && room.admins.includes(meId),
        myRole: role,
        archived: room.archived,
      };
    });

    const filtered = filterRooms(views, (args.filter ?? "all") as RoomFilterMode, args.q ?? "", now);
    const kindFiltered = args.kind ? filtered.filter((r) => r.kind === args.kind) : filtered;
    const sorted = sortRooms(kindFiltered, (args.sort ?? "active") as RoomSortMode);
    return sorted.slice(0, Math.min(args.limit ?? 60, 200));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② تفاصيل الغرفة الكاملة (بحسب صلاحيات المستخدم فعلياً)
// ═══════════════════════════════════════════════════════════════════════
export const getRoomDetails = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, { roomId }) => {
    const meId = await getAuthUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const profile = await readProfile(ctx, roomId as never);
    const kind = roomKind(profile?.kind);
    const role = resolveRole(
      profile,
      room.ownerId as unknown as string,
      room.admins as unknown as string[],
      meId as unknown as string | null,
    );
    const perms = role ? permissionsFor(profile, role) : [];
    const can = (p: RoomPermission) => hasPermission(profile, role, p);
    const state = roomState(profile, Date.now());
    const tier = meId ? await readTier(ctx, meId) : "bronze";

    const owner = await ctx.db.get(room.ownerId);

    const topicsRaw = await ctx.db
      .query("roomTopics")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(30);

    const auditRaw = can("viewAudit")
      ? await ctx.db
          .query("roomAudit")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .order("desc")
          .take(60)
      : [];

    const invitesRaw = can("invite")
      ? await ctx.db
          .query("roomInvites")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .order("desc")
          .take(20)
      : [];

    const modNotes = can("viewAudit")
      ? await ctx.db
          .query("roomModNotes")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .order("desc")
          .take(25)
      : [];

    const members = await Promise.all(
      room.members.slice(0, 80).map(async (id) => {
        const u = await ctx.db.get(id);
        const memberRole = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], id as unknown as string);
        return {
          _id: id as unknown as string,
          name: u?.name ?? "لاعب",
          image: u?.image ?? null,
          role: memberRole,
          roleLabel: memberRole ? roleLabel(memberRole) : "عضو",
        };
      }),
    );

    const messages24h = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(60);
    const active24h = messages24h.filter((m) => Date.now() - m.createdAt < 24 * 60 * 60 * 1000).length;

    return {
      room: {
        _id: room._id as unknown as string,
        name: room.name,
        description: room.description ?? "",
        type: room.type,
        archived: room.archived,
        createdAt: room.createdAt,
        ownerId: room.ownerId as unknown as string,
        ownerName: owner?.name ?? "لاعب",
        pinnedMessageId: room.pinnedMessageId ?? null,
      },
      profile,
      kind,
      state,
      myRole: role,
      myPerms: perms,
      isMember: meId !== null && room.members.includes(meId),
      canManage: can("manageSettings"),
      canModerate: can("mute") || can("kick") || can("deleteMessages"),
      tier,
      tierRankNow: tierRank(tier),
      topics: topicsRaw.map((t) => ({
        _id: t._id as unknown as string,
        title: t.title,
        status: t.status,
        pinned: t.pinned,
        messageCount: t.messageCount,
        lastMessageAt: t.lastMessageAt,
        createdByName: t.createdByName,
      })),
      members,
      invites: invitesRaw.map((i) => ({
        _id: i._id as unknown as string,
        code: i.code,
        uses: i.uses,
        maxUses: i.maxUses,
        expiresAt: i.expiresAt,
        revoked: i.revoked,
        createdByName: i.createdByName,
      })),
      audit: auditRaw.map((a) => ({
        _id: a._id as unknown as string,
        actorName: a.actorName,
        action: a.action,
        details: a.details,
        source: a.source,
        at: a.at,
      })),
      modNotes: modNotes.map((n) => ({
        _id: n._id as unknown as string,
        targetName: n.targetName,
        action: n.action,
        reason: n.reason,
        until: n.until,
        actorName: n.actorName,
        createdAt: n.createdAt,
      })),
      stats: { active24h, memberCount: room.members.length },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ حصة الإنشاء حسب العضوية + الأنواع المتاحة
// ═══════════════════════════════════════════════════════════════════════
export const getMyRoomQuota = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return null;
    const tier = await readTier(ctx, meId);
    const quota = tierRoomQuota(tier);
    const owned = await ctx.db
      .query("chatRooms")
      .withIndex("by_owner", (q) => q.eq("ownerId", meId))
      .take(50);
    const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
    const ownedIds = new Set(owned.map((r) => r._id as unknown as string));
    const myProfiles = profiles.filter((p) => ownedIds.has(p.roomId as unknown as string));
    const featuredUsed = myProfiles.filter((p) => p.featured).length;
    return {
      tier,
      maxRooms: quota.maxRooms,
      used: owned.length,
      remaining: quota.maxRooms < 0 ? -1 : Math.max(0, quota.maxRooms - owned.length),
      memberLimit: quota.memberLimit,
      canUseKinds: quota.canUseKinds,
      featuredUsed,
      featuredLimit: tierRank(tier) >= 3 ? 3 : tierRank(tier) >= 1 ? 1 : 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ إنشاء غرفة متقدمة
// ═══════════════════════════════════════════════════════════════════════
export const createRoomV2 = mutation({
  args: {
    name: v.string(),
    kind: v.string(),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    tone: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    rules: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    memberLimit: v.optional(v.number()),
    requiresTier: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    clanId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    slowModeSec: v.optional(v.number()),
    challengeReward: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(meId);
    if (!me) throw new Error("الحساب غير موجود");
    const tier = await readTier(ctx, meId);
    const spec = roomKind(args.kind);

    if (!canCreateKind(spec.id, tier)) {
      throw new Error(`نوع «${spec.label}» غير متاح في عضويتك الحالية`);
    }
    const nameCheck = validateRoomName(args.name);
    if (!nameCheck.ok) throw new Error(nameCheck.reason);

    const quota = tierRoomQuota(tier);
    if (quota.maxRooms === 0) throw new Error("الغرف الخاصة متاحة من العضوية الفضية فما فوق");
    if (quota.maxRooms > 0) {
      const owned = await ctx.db
        .query("chatRooms")
        .withIndex("by_owner", (q) => q.eq("ownerId", meId))
        .take(50);
      if (owned.length >= quota.maxRooms) {
        throw new Error(`وصلت حدّ عضويتك (${quota.maxRooms} غرف) — ارقِ عضويتك لفتح المزيد`);
      }
    }
    if (args.featured) {
      const limit = tierRank(tier) >= 3 ? 3 : tierRank(tier) >= 1 ? 1 : 0;
      if (limit === 0) throw new Error("عرض الغرفة في الملتقى يحتاج عضوية فضية فما فوق");
    }
    const duration = Math.max(0, Math.min(args.durationHours ?? 0, 24 * 30));
    const now = Date.now();
    const expiresAt = spec.permanent && duration === 0 ? 0 : duration > 0 ? now + duration * 60 * 60 * 1000 : spec.permanent ? 0 : now + 24 * 60 * 60 * 1000;
    const memberLimit = effectiveMemberLimit(spec.id, tier, args.memberLimit ?? 0);
    const legacyType = spec.visibility === "open" ? "public" : spec.visibility === "membership" ? "private" : "invite";

    const roomId = await ctx.db.insert("chatRooms", {
      name: cleanText(args.name, 40),
      description: cleanText(args.description ?? "", 300),
      type: legacyType,
      ownerId: meId,
      members: [meId],
      admins: [meId],
      archived: false,
      createdAt: now,
    });

    await ctx.db.insert("roomProfiles", {
      roomId,
      kind: spec.id,
      visibility: spec.visibility,
      avatar: cleanText(args.avatar ?? spec.emoji, 4) || spec.emoji,
      bannerTone: cleanText(args.tone ?? spec.tone, 12),
      tags: normalizeTags(args.tags),
      rules: cleanText(args.rules ?? "", 1500),
      welcomeMessage: cleanText(args.welcomeMessage ?? "", 300),
      memberLimit,
      requiresTier: args.requiresTier && tierRank(args.requiresTier) > 0 ? args.requiresTier : spec.minTierRank > 0 ? "silver" : "bronze",
      clanId: args.clanId,
      eventId: args.eventId,
      expiresAt,
      permanent: expiresAt === 0,
      slowModeSec: Math.max(0, Math.min(args.slowModeSec ?? 0, 3600)),
      moderationState: "normal",
      memberRoles: { [meId as unknown as string]: "owner" },
      rolePerms: {},
      pinnedMessageIds: [],
      featured: Boolean(args.featured),
      challengeReward: Math.max(0, Math.min(args.challengeReward ?? 0, 500)),
      messageCount: 0,
      joinCount: 1,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    } as never);

    await postSystem(ctx, roomId as never, meId as never, me.name ?? "المالك", `أُنشئت الغرفة «${cleanText(args.name, 40)}» — النوع: ${spec.label} ${spec.emoji}`);
    await writeAudit(
      ctx,
      roomId as never,
      { id: meId as never, name: me.name ?? "المالك", source: "room_owner" },
      "room_created",
      `${spec.label} · حد الأعضاء ${memberLimit || "بلا حد"} · ${expiresAt ? "مؤقتة" : "دائمة"}`,
    );

    return { roomId, kind: spec.id, memberLimit, expiresAt, featured: Boolean(args.featured) };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑤ الانضمام الحقيقي (يتحقق من النوع/العضوية/الحد/الانتهاء/الدعوة)
// ═══════════════════════════════════════════════════════════════════════
export const joinRoomV2 = mutation({
  args: { roomId: v.id("chatRooms"), inviteCode: v.optional(v.string()) },
  handler: async (ctx, { roomId, inviteCode }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if (room.archived) throw new Error("الغرفة مؤرشفة");

    let profile = await readProfile(ctx, roomId as never);
    if (!profile) {
      await ensureProfile(ctx, roomId as never);
      profile = await readProfile(ctx, roomId as never);
    }
    const spec = roomKind(profile?.kind);
    const tier = await readTier(ctx, meId);
    const isOwner = (room.ownerId as unknown as string) === (meId as unknown as string);

    const decision = canJoin({
      profile,
      roomOwnerId: room.ownerId as unknown as string,
      members: room.members as unknown as string[],
      memberCount: room.members.length,
      userId: meId as unknown as string,
      tier,
      now: Date.now(),
      isOwner,
    });
    if (!decision.ok) throw new Error(decision.reason);
    if (room.members.includes(meId)) return { alreadyMember: true, roomId };

    // الغرف غير المفتوحة تحتاج دعوة صالحة فعلياً
    if (spec.visibility !== "open" && !isOwner) {
      const code = (inviteCode ?? "").trim();
      if (!code) throw new Error("هذه غرفة بدعوة — تحتاج رابط دعوة صالح");
      const invites = await ctx.db
        .query("roomInvites")
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .order("desc")
        .take(40);
      const invite = invites.find((i) => inviteCodesEqual(i.code, code));
      const check = validateInvite(invite ?? null, Date.now());
      if (!invite || !check.ok) throw new Error(check.reason);
      await ctx.db.patch(invite._id, { uses: invite.uses + 1 } as never);
    }

    const members = [...room.members, meId];
    await ctx.db.patch(roomId, { members });
    if (profile) {
      await ctx.db.patch(profile._id as never, {
        joinCount: profile.joinCount + 1,
        lastActivityAt: Date.now(),
        updatedAt: Date.now(),
      } as never);
    }

    const roles = { ...(profile?.memberRoles ?? {}) };
    if (!roles[meId as unknown as string]) roles[meId as unknown as string] = "member";
    if (profile) await ctx.db.patch(profile._id as never, { memberRoles: roles } as never);

    const welcome = profile?.welcomeMessage?.trim();
    await postSystem(
      ctx,
      roomId as never,
      meId as never,
      (await ctx.db.get(meId))?.name ?? "لاعب",
      `${(await ctx.db.get(meId))?.name ?? "لاعب"} انضم إلى الغرفة${welcome ? ` — ${welcome}` : ""}`,
    );
    await writeAudit(
      ctx,
      roomId as never,
      { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "member" },
      "member_joined",
      inviteCode ? `${roleLabel("member")} عبر دعوة` : roleLabel("member"),
    );
    return { joined: true, memberCount: members.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑥ الشخصية والدعوات
// ═══════════════════════════════════════════════════════════════════════
export const createInvite = mutation({
  args: {
    roomId: v.id("chatRooms"),
    maxUses: v.optional(v.number()),
    durationHours: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, args.roomId as never);
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "invite")) throw new Error("ليست لديك صلاحية الدعوة");

    const kinds = await ctx.db
      .query("roomInvites")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(30);
    const activeCount = kinds.filter((k) => !k.revoked && (k.expiresAt === 0 || k.expiresAt > Date.now())).length;
    if (activeCount >= 10) throw new Error("بحد أقصى ١٠ دعوات فعّالة لكل غرفة");

    const now = Date.now();
    const days = Math.max(0, Math.min(args.durationHours ?? 168, 24 * 30));
    let code = generateInviteCode(now + Math.floor(Math.random() * 100000));
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query("roomInvites").withIndex("by_code", (q) => q.eq("code", code)).first();
      if (!clash) break;
      code = generateInviteCode(now + i * 7919 + Math.floor(Math.random() * 50000));
    }

    const inviteId = await ctx.db.insert("roomInvites", {
      roomId: args.roomId,
      code,
      createdBy: meId,
      createdByName: (await ctx.db.get(meId))?.name ?? "لاعب",
      maxUses: Math.max(0, Math.min(args.maxUses ?? 0, 500)),
      uses: 0,
      expiresAt: days > 0 ? now + days * 60 * 60 * 1000 : 0,
      revoked: false,
      note: args.note ? cleanText(args.note, 80) : undefined,
      createdAt: now,
    });
    await writeAudit(
      ctx,
      args.roomId as never,
      { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "room_owner" },
      "invite_created",
      `كود ${code} · استخدامات ${args.maxUses || "بلا حد"} · صلاحية ${days ? `${days} ساعة` : "بلا انتهاء"}`,
    );
    return { inviteId, code };
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("roomInvites") },
  handler: async (ctx, { inviteId }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw new Error("الدعوة غير موجودة");
    const room = await ctx.db.get(invite.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, invite.roomId as never);
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "invite")) throw new Error("ليست لديك صلاحية إلغاء الدعوات");
    await ctx.db.patch(inviteId, { revoked: true } as never);
    await writeAudit(ctx, invite.roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "room_owner" }, "invite_revoked", `كود ${invite.code}`);
    return { ok: true };
  },
});

/** فحص كود دعوة قبل الدخول — يعرض اسم الغرفة الحقيقي فقط */
export const checkInvite = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return { valid: false, reason: "كود غير صالح" };
    const invite = await ctx.db.query("roomInvites").withIndex("by_code", (q) => q.eq("code", clean)).first();
    const check = validateInvite(invite ?? null, Date.now());
    if (!invite || !check.ok) return { valid: false, reason: check.reason };
    const room = await ctx.db.get(invite.roomId);
    const profile = room ? await readProfile(ctx, room._id as never) : null;
    return {
      valid: true,
      reason: "صالحة",
      roomId: invite.roomId as unknown as string,
      roomName: room?.name ?? "غرفة",
      kindLabel: roomKind(profile?.kind).label,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑦ تحديث الإعدادات والقواعد والوضع البطيء
// ═══════════════════════════════════════════════════════════════════════
export const updateRoomSettings = mutation({
  args: {
    roomId: v.id("chatRooms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    avatar: v.optional(v.string()),
    tone: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    rules: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    memberLimit: v.optional(v.number()),
    slowModeSec: v.optional(v.number()),
    featured: v.optional(v.boolean()),
    challengeReward: v.optional(v.number()),
    requiresTier: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    rolePerms: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    let profile = await readProfile(ctx, args.roomId as never);
    if (!profile) {
      await ensureProfile(ctx, args.roomId as never);
      profile = await readProfile(ctx, args.roomId as never);
    }
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "manageSettings")) throw new Error("ليست لديك صلاحية تعديل الإعدادات");
    const tier = await readTier(ctx, meId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const roomPatch: Record<string, unknown> = {};
    const changed: string[] = [];

    if (args.name !== undefined) {
      const check = validateRoomName(args.name);
      if (!check.ok) throw new Error(check.reason);
      roomPatch.name = cleanText(args.name, 40);
      changed.push("الاسم");
    }
    if (args.description !== undefined) {
      roomPatch.description = cleanText(args.description, 300);
      changed.push("الوصف");
    }
    if (args.avatar !== undefined) {
      patch.avatar = cleanText(args.avatar, 4) || "💬";
      changed.push("الرمز");
    }
    if (args.tone !== undefined) {
      patch.bannerTone = cleanText(args.tone, 12);
      changed.push("السمة اللونية");
    }
    if (args.tags !== undefined) {
      patch.tags = normalizeTags(args.tags);
      changed.push("الوسوم");
    }
    if (args.rules !== undefined) {
      patch.rules = cleanText(args.rules, 1500);
      changed.push("القوانين");
    }
    if (args.welcomeMessage !== undefined) {
      patch.welcomeMessage = cleanText(args.welcomeMessage, 300);
      changed.push("رسالة الترحيب");
    }
    if (args.memberLimit !== undefined) {
      patch.memberLimit = effectiveMemberLimit(profile?.kind ?? "private", tier, args.memberLimit);
      changed.push(`حد الأعضاء (${patch.memberLimit || "بلا حد"})`);
    }
    if (args.slowModeSec !== undefined) {
      patch.slowModeSec = Math.max(0, Math.min(args.slowModeSec, 3600));
      changed.push(`الوضع البطيء (${patch.slowModeSec}ث)`);
    }
    if (args.challengeReward !== undefined) {
      patch.challengeReward = Math.max(0, Math.min(args.challengeReward, 500));
      changed.push(`مكافأة التحدي (${patch.challengeReward})`);
    }
    if (args.requiresTier !== undefined) {
      patch.requiresTier = args.requiresTier;
      changed.push(`الحد الأدنى للعضوية (${args.requiresTier})`);
    }
    if (args.durationHours !== undefined) {
      const hours = Math.max(0, Math.min(args.durationHours, 24 * 30));
      patch.expiresAt = hours > 0 ? Date.now() + hours * 60 * 60 * 1000 : 0;
      patch.permanent = hours === 0;
      changed.push(hours > 0 ? `تمديد ${hours} ساعة` : "غرفة دائمة");
    }
    if (args.featured !== undefined) {
      const limit = tierRank(tier) >= 3 ? 3 : tierRank(tier) >= 1 ? 1 : 0;
      const owned = await ctx.db.query("chatRooms").withIndex("by_owner", (q) => q.eq("ownerId", meId)).take(20);
      const ownedIds = new Set(owned.map((r) => r._id as unknown as string));
      const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
      const featuredUsed = profiles.filter(
        (p) => ownedIds.has(p.roomId as unknown as string) && p.featured && (p.roomId as unknown as string) !== (args.roomId as unknown as string),
      ).length;
      if (args.featured && featuredUsed >= limit) throw new Error(`حد العرض في الملتقى لعضويتك ${limit} غرفة`);
      patch.featured = args.featured;
      changed.push(args.featured ? "عرض في الملتقى" : "إخفاء من الملتقى");
    }
    if (args.rolePerms !== undefined) {
      // تحقّق أن المفاتيح أدوار معروفة — منع أي قيم غريبة تدخل الخريطة
      const clean: Record<string, Record<string, boolean>> = {};
      for (const [roleKey, perms] of Object.entries((args.rolePerms ?? {}) as Record<string, unknown>)) {
        if (!["admin", "moderator", "member", "restricted"].includes(roleKey)) continue;
        if (!perms || typeof perms !== "object") continue;
        const bucket: Record<string, boolean> = {};
        for (const [permKey, on] of Object.entries(perms as Record<string, unknown>)) {
          bucket[permKey] = on === true;
        }
        clean[roleKey] = bucket;
      }
      patch.rolePerms = clean;
      changed.push("صلاحيات الأدوار");
    }

    if (Object.keys(roomPatch).length > 0) await ctx.db.patch(args.roomId, roomPatch);
    if (profile) await ctx.db.patch(profile._id as never, patch as never);

    if (changed.length > 0) {
      await postSystem(ctx, args.roomId as never, meId as never, (await ctx.db.get(meId))?.name ?? "المالك", `تحديث إعدادات الغرفة: ${changed.join(" · ")}`);
      await writeAudit(ctx, args.roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "المالك", source: "room_owner" }, "room_updated", changed.join(" · "));
    }
    return { ok: true, changed };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑧ الأدوار ونقل الملكية
// ═══════════════════════════════════════════════════════════════════════
export const setMemberRole = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.id("users"), role: v.string() },
  handler: async (ctx, { roomId, targetUserId, role }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, roomId as never);
    const myRole = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, myRole, "manageRoles")) throw new Error("ليست لديك صلاحية إدارة الأدوار");
    if ((targetUserId as unknown as string) === (room.ownerId as unknown as string)) {
      throw new Error("لا يمكن تغيير دور مالك الغرفة — استخدم نقل الملكية");
    }
    if (myRole !== "owner" && role === "admin") throw new Error("ترقية مشرف عام تحتاج موافقة مالك الغرفة");
    if (!["admin", "moderator", "member", "restricted"].includes(role)) throw new Error("دور غير معروف");

    const roles = { ...(profile?.memberRoles ?? {}) };
    roles[targetUserId as unknown as string] = role as RoomRole;
    const members = room.members as unknown as string[];
    if (!members.includes(targetUserId as unknown as string)) throw new Error("هذا اللاعب ليس عضواً في الغرفة");
    const admins = new Set(room.admins as unknown as string[]);
    if (role === "admin") admins.add(targetUserId as unknown as string);
    else admins.delete(targetUserId as unknown as string);

    await ctx.db.patch(roomId, { admins: [...admins] as unknown as typeof room.admins });
    if (profile) await ctx.db.patch(profile._id as never, { memberRoles: roles, updatedAt: Date.now() } as never);
    const target = await ctx.db.get(targetUserId);
    await postSystem(ctx, roomId as never, meId as never, (await ctx.db.get(meId))?.name ?? "المشرف", `تغيّر دور ${target?.name ?? "عضو"} إلى «${roleLabel(role as RoomRole)}»`);
    await writeAudit(ctx, roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "المشرف", source: "room_owner" }, "role_changed", `${target?.name ?? "عضو"} ← ${roleLabel(role as RoomRole)}`);
    return { ok: true, role };
  },
});

export const transferOwnership = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.id("users") },
  handler: async (ctx, { roomId, targetUserId }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(roomId);
    if (!room || (room.ownerId as unknown as string) !== (meId as unknown as string)) throw new Error("مالك الغرفة فقط يمكنه نقل الملكية");
    const members = room.members as unknown as string[];
    if (!members.includes(targetUserId as unknown as string)) throw new Error("النقل يكون لعضو داخل الغرفة فقط");
    const profile = await readProfile(ctx, roomId as never);
    const roles = { ...(profile?.memberRoles ?? {}) };
    roles[meId as unknown as string] = "admin";
    roles[targetUserId as unknown as string] = "owner";
    const admins = new Set(room.admins as unknown as string[]);
    admins.add(targetUserId as unknown as string);
    admins.add(meId);

    await ctx.db.patch(roomId, { ownerId: targetUserId, admins: [...admins] as unknown as typeof room.admins });
    if (profile) await ctx.db.patch(profile._id as never, { memberRoles: roles, updatedAt: Date.now() } as never);
    const target = await ctx.db.get(targetUserId);
    await postSystem(ctx, roomId as never, meId as never, (await ctx.db.get(meId))?.name ?? "المالك", `انتقلت ملكية الغرفة إلى ${target?.name ?? "عضو"}`);
    await writeAudit(ctx, roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "المالك", source: "room_owner" }, "ownership_transferred", `المالك الجديد: ${target?.name ?? "عضو"}`);
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑨ الإشراف داخل الغرفة (تحذير/كتم/تقييد/طرد) بسبب مكتوب
// ═══════════════════════════════════════════════════════════════════════
export const roomModerate = mutation({
  args: {
    roomId: v.id("chatRooms"),
    targetUserId: v.id("users"),
    action: v.string(), // warn | mute | restrict | unmute | kick
    reason: v.string(),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    if ((args.targetUserId as unknown as string) === (room.ownerId as unknown as string)) throw new Error("لا يمكن تقييد مالك الغرفة");
    const profile = await readProfile(ctx, args.roomId as never);
    const myRole = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    const needed: RoomPermission = args.action === "kick" ? "kick" : args.action === "warn" ? "mute" : "mute";
    if (!hasPermission(profile, myRole, needed)) throw new Error("ليست لديك صلاحية هذا الإجراء");
    const reason = cleanText(args.reason, 200) || "مخالفة قوانين الغرفة";
    const now = Date.now();
    const minutes = Math.max(1, Math.min(args.durationMinutes ?? 60, 60 * 24 * 30));
    const roles = { ...(profile?.memberRoles ?? {}) };
    const target = await ctx.db.get(args.targetUserId);

    if (args.action === "kick") {
      await ctx.db.patch(args.roomId, {
        members: (room.members as unknown as string[]).filter((id) => id !== (args.targetUserId as unknown as string)) as unknown as typeof room.members,
        admins: (room.admins as unknown as string[]).filter((id) => id !== (args.targetUserId as unknown as string)) as unknown as typeof room.admins,
      });
      delete roles[args.targetUserId as unknown as string];
    } else if (args.action === "restrict") {
      roles[args.targetUserId as unknown as string] = "restricted";
    } else if (args.action === "unmute") {
      if (roles[args.targetUserId as unknown as string] === "restricted") roles[args.targetUserId as unknown as string] = "member";
      await ctx.db.patch(args.targetUserId, { mutedUntil: undefined } as never);
    } else if (args.action === "mute" || args.action === "warn") {
      if (args.action === "mute") {
        await ctx.db.patch(args.targetUserId, { mutedUntil: now + minutes * 60 * 1000 } as never);
      }
      await ctx.db.insert("notifications", {
        userId: args.targetUserId,
        title: args.action === "mute" ? "🔇 كتم في الغرفة" : "⚠️ تحذير في الغرفة",
        body: `${reason}${args.action === "mute" ? ` — لمدة ${minutes} دقيقة` : ""}`,
        type: args.action === "mute" ? ("ban" as const) : ("warning" as const),
        read: false,
        createdAt: now,
      } as never);
    } else {
      throw new Error("إجراء غير معروف");
    }

    if (args.action === "restrict" && profile) {
      await ctx.db.patch(profile._id as never, { memberRoles: roles, updatedAt: now } as never);
    }
    await ctx.db.insert("roomModNotes", {
      roomId: args.roomId,
      targetId: args.targetUserId,
      targetName: target?.name ?? "عضو",
      actorId: meId,
      actorName: (await ctx.db.get(meId))?.name ?? "مشرف",
      action: args.action,
      reason,
      until: args.action === "mute" ? now + minutes * 60 * 1000 : 0,
      createdAt: now,
    });
    await postSystem(ctx, args.roomId as never, meId as never, (await ctx.db.get(meId))?.name ?? "مشرف", `إجراء إشرافي على ${target?.name ?? "عضو"}: ${args.action} — ${reason}`);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "مشرف", source: "room_owner" }, args.action === "kick" ? "member_kicked" : args.action === "mute" ? "member_muted" : args.action === "restrict" ? "member_restricted" : `mod_${args.action}`, `${target?.name ?? "عضو"}: ${reason}`);
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑩ المواضيع والتثبيت المتعدد
// ═══════════════════════════════════════════════════════════════════════
export const createTopic = mutation({
  args: { roomId: v.id("chatRooms"), title: v.string() },
  handler: async (ctx, { roomId, title }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, roomId as never);
    const spec = roomKind(profile?.kind);
    if (!spec.allowTopics) throw new Error("هذا النوع من الغرف لا يدعم المواضيع");
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!room.members.includes(meId) && !hasPermission(profile, role, "topics")) throw new Error("يجب أن تكون عضواً في الغرفة");
    if (!hasPermission(profile, role, "topics")) throw new Error("ليست لديك صلاحية إنشاء المواضيع");
    const clean = cleanText(title, 80);
    if (clean.length < 3) throw new Error("عنوان الموضوع قصير جداً");
    const open = await ctx.db.query("roomTopics").withIndex("by_room", (q) => q.eq("roomId", roomId)).take(40);
    if (open.filter((t) => t.status === "open").length >= 20) throw new Error("بحد أقصى ٢٠ موضوعاً مفتوحاً للغرفة");

    const now = Date.now();
    const topicId = await ctx.db.insert("roomTopics", {
      roomId,
      title: clean,
      createdBy: meId,
      createdByName: (await ctx.db.get(meId))?.name ?? "لاعب",
      status: "open",
      pinned: false,
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
    });
    await postSystem(ctx, roomId as never, meId as never, (await ctx.db.get(meId))?.name ?? "لاعب", `فُتح موضوع جديد: «${clean}»`);
    await writeAudit(ctx, roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "member" }, "topic_created", clean);
    return { topicId, title: clean };
  },
});

export const setTopicState = mutation({
  args: { topicId: v.id("roomTopics"), status: v.optional(v.string()), pinned: v.optional(v.boolean()) },
  handler: async (ctx, { topicId, status, pinned }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const topic = await ctx.db.get(topicId);
    if (!topic) throw new Error("الموضوع غير موجود");
    const room = await ctx.db.get(topic.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, topic.roomId as never);
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "topics")) throw new Error("ليست لديك صلاحية إدارة المواضيع");
    const patch: Record<string, unknown> = {};
    if (status) patch.status = status === "closed" ? "closed" : "open";
    if (pinned !== undefined) patch.pinned = pinned;
    await ctx.db.patch(topicId, patch as never);
    await writeAudit(
      ctx,
      topic.roomId as never,
      { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "room_owner" },
      status === "closed" ? "topic_closed" : pinned ? "topic_pinned" : "topic_updated",
      topic.title,
    );
    return { ok: true };
  },
});

export const getTopicMessages = query({
  args: { topicId: v.id("roomTopics"), limit: v.optional(v.number()) },
  handler: async (ctx, { topicId, limit }) => {
    const links = await ctx.db
      .query("roomTopicLinks")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .order("desc")
      .take(Math.min(limit ?? 50, 100));
    const messages = await Promise.all(links.map((l) => ctx.db.get(l.messageId)));
    return messages
      .filter((m): m is NonNullable<typeof m> => m !== null && !m.deleted)
      .reverse()
      .map((m) => ({
        _id: m._id as unknown as string,
        senderName: m.senderName,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt,
      }));
  },
});

export const togglePinV2 = mutation({
  args: { roomId: v.id("chatRooms"), messageId: v.id("chatMessages") },
  handler: async (ctx, { roomId, messageId }) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, roomId as never);
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "pin")) throw new Error("ليست لديك صلاحية التثبيت");
    const msg = await ctx.db.get(messageId);
    if (!msg || (msg.roomId as unknown as string) !== (roomId as unknown as string)) throw new Error("الرسالة ليست في هذه الغرفة");

    const list = [...(profile?.pinnedMessageIds ?? [])];
    const idStr = messageId as unknown as string;
    const wasPinned = list.includes(idStr) || msg.pinned;
    const next = wasPinned ? list.filter((x) => x !== idStr) : [idStr, ...list].slice(0, 10);
    await ctx.db.patch(messageId, { pinned: !wasPinned });
    if (profile) await ctx.db.patch(profile._id as never, { pinnedMessageIds: next, updatedAt: Date.now() } as never);
    await writeAudit(ctx, roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "لاعب", source: "room_owner" }, wasPinned ? "message_unpinned" : "message_pinned", msg.content.slice(0, 80));
    return { pinned: !wasPinned, pinnedCount: next.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑪ تحدّي داخل الغرفة + البلاغ ضد الغرفة
// ═══════════════════════════════════════════════════════════════════════
export const startRoomChallenge = mutation({
  args: {
    roomId: v.id("chatRooms"),
    difficulty: v.string(),
    questionCount: v.number(),
    reward: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const profile = await readProfile(ctx, args.roomId as never);
    if (!roomKind(profile?.kind).allowChallenges) throw new Error("هذا النوع من الغرف لا يدعم التحديات");
    const role = resolveRole(profile, room.ownerId as unknown as string, room.admins as unknown as string[], meId as unknown as string);
    if (!hasPermission(profile, role, "challenges")) throw new Error("ليست لديك صلاحية إطلاق تحدٍّ");

    const count = Math.max(5, Math.min(args.questionCount, 30));
    const reward = Math.max(0, Math.min(args.reward ?? profile?.challengeReward ?? 0, 500));
    const now = Date.now();
    const code = `ROOM-${generateInviteCode(now).slice(0, 6)}`;
    const messageId = await ctx.db.insert("chatMessages", {
      roomId: args.roomId,
      senderId: meId,
      senderName: (await ctx.db.get(meId))?.name ?? "المالك",
      content: `⚔️ تحدٍّ ذهني جديد في الغرفة — ${count} أسئلة · صعوبة ${args.difficulty} · مكافأة ${reward} عملة\nادخل من الساحة: /arena?challenge=${code}`,
      type: "system",
      reactions: [],
      pinned: true,
      deleted: false,
      createdAt: now,
    } as never);
    if (profile) {
      const pinned = [messageId as unknown as string, ...(profile.pinnedMessageIds ?? [])].slice(0, 10);
      await ctx.db.patch(profile._id as never, {
        pinnedMessageIds: pinned,
        challengeReward: reward,
        lastActivityAt: now,
        updatedAt: now,
      } as never);
    }
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "المالك", source: "room_owner" }, "challenge_started", `${count} أسئلة · ${args.difficulty} · مكافأة ${reward}`);
    return { ok: true, code, questionCount: count, reward };
  },
});

export const reportRoom = mutation({
  args: { roomId: v.id("chatRooms"), reason: v.string(), details: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const me = await ctx.db.get(meId);
    const owner = await ctx.db.get(room.ownerId);
    const open = await ctx.db
      .query("reports")
      .filter((q) => q.eq(q.field("reporterId"), meId))
      .take(20);
    const dup = open.find((r) => (r.targetId as unknown as string) === (room.ownerId as unknown as string) && r.status === "open");
    if (dup) throw new Error("لديك بلاغ مفتوح بالفعل ضد هذه الغرفة");

    await ctx.db.insert("reports", {
      reporterId: meId,
      reporterName: me?.name ?? "لاعب",
      targetId: room.ownerId,
      targetName: `غرفة: ${room.name} — ${owner?.name ?? "مالك"}`,
      reason: cleanText(args.reason, 120),
      details: cleanText(`[غرفة ${room._id}] ${args.details ?? ""}`, 400),
      status: "open",
    } as never);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me?.name ?? "لاعب", source: "member" }, "room_reported", cleanText(args.reason, 120));
    await ctx.db.insert("notifications", {
      userId: room.ownerId,
      title: "🚩 بلاغ ضد غرفتك",
      body: `${me?.name ?? "لاعب"} أبلغ عن الغرفة: ${cleanText(args.reason, 80)} — راجع قوانين الغرفة`,
      type: "warning" as const,
      read: false,
      createdAt: Date.now(),
    } as never);
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑫ نبضة المالك: صحة كل الغرف + أقوى المخالفات + تدخّل فوري
// ═══════════════════════════════════════════════════════════════════════
async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const meId = await getAuthUserId(ctx);
  if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
  const me = await ctx.db.get(meId);
  if (!me || !isOwnerUser(me)) throw new Error("هذه الصلاحية للحاكم السيادي فقط");
  return { meId, me };
}

export const ownerRoomsPulse = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return null;
    const me = await ctx.db.get(meId);
    if (!me || !isOwnerUser(me)) return null;

    const now = Date.now();
    const rooms = await ctx.db.query("chatRooms").take(MAX_ROOMS_SCAN);
    const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
    const profileByRoom = new Map<string, ProfileDoc>();
    for (const p of profiles) profileByRoom.set(p.roomId as unknown as string, p as unknown as ProfileDoc);
    const recentMessages = await ctx.db.query("chatMessages").order("desc").take(300);
    const openReports = await ctx.db.query("reports").order("desc").take(200);
    const audit = await ctx.db.query("roomAudit").order("desc").take(60);

    const messagesByRoom = new Map<string, number>();
    for (const m of recentMessages) {
      const rid = m.roomId as unknown as string;
      messagesByRoom.set(rid, (messagesByRoom.get(rid) ?? 0) + 1);
    }
    const reportsByOwner = new Map<string, number>();
    for (const r of openReports) {
      if (r.status !== "open") continue;
      const tid = r.targetId as unknown as string;
      reportsByOwner.set(tid, (reportsByOwner.get(tid) ?? 0) + 1);
    }

    const rows = rooms.map((room) => {
      const profile = profileByRoom.get(room._id as unknown as string) ?? null;
      const health = roomHealth(
        {
          profile,
          memberCount: room.members.length,
          messages24h: messagesByRoom.get(room._id as unknown as string) ?? 0,
          reportsOpen: reportsByOwner.get(room.ownerId as unknown as string) ?? 0,
          flagged24h: 0,
        },
        now,
      );
      return {
        _id: room._id as unknown as string,
        name: room.name,
        kind: roomKind(profile?.kind).id,
        kindLabel: roomKind(profile?.kind).label,
        emoji: profile?.avatar ?? roomKind(profile?.kind).emoji,
        ownerId: room.ownerId as unknown as string,
        memberCount: room.members.length,
        messageCount: profile?.messageCount ?? 0,
        featured: profile?.featured ?? false,
        moderationState: profile?.moderationState ?? "normal",
        moderationNote: profile?.moderationNote ?? "",
        expiresAt: profile?.expiresAt ?? 0,
        expired: (profile?.expiresAt ?? 0) > 0 && (profile?.expiresAt ?? 0) <= now,
        archived: room.archived,
        health,
      };
    });

    const byKind: Record<string, number> = {};
    for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

    return {
      totals: {
        rooms: rows.length,
        profileRooms: profiles.length,
        members: rows.reduce((s, r) => s + r.memberCount, 0),
        messages: rows.reduce((s, r) => s + r.messageCount, 0),
        watch: rows.filter((r) => r.moderationState === "watch").length,
        locked: rows.filter((r) => r.moderationState === "locked").length,
        expired: rows.filter((r) => r.expired && !r.archived).length,
        featured: rows.filter((r) => r.featured).length,
        avgHealth: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.health.score, 0) / rows.length) : 0,
      },
      byKind,
      needsAttention: rows.filter((r) => r.health.score < 60).sort((a, b) => a.health.score - b.health.score).slice(0, 10),
      topRooms: [...rows].sort((a, b) => b.messageCount - a.messageCount).slice(0, 8),
      expiring: rows.filter((r) => r.expiresAt > 0 && r.expiresAt - now < 24 * 60 * 60 * 1000).slice(0, 10),
      recentActions: audit.map((a) => ({
        _id: a._id as unknown as string,
        roomId: a.roomId as unknown as string,
        actorName: a.actorName,
        action: a.action,
        details: a.details,
        source: a.source,
        at: a.at,
      })),
      actionSummary: summarizeRoomAudit(audit.map((a) => ({ action: a.action }))),
    };
  },
});

export const ownerListRooms = query({
  args: { q: v.optional(v.string()), onlyProblem: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return [];
    const me = await ctx.db.get(meId);
    if (!me || !isOwnerUser(me)) return [];
    const now = Date.now();
    const rooms = await ctx.db.query("chatRooms").take(MAX_ROOMS_SCAN);
    const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
    const profileByRoom = new Map<string, ProfileDoc>();
    for (const p of profiles) profileByRoom.set(p.roomId as unknown as string, p as unknown as ProfileDoc);
    const q = (args.q ?? "").trim().toLowerCase();
    const out = [];
    for (const room of rooms) {
      const profile = profileByRoom.get(room._id as unknown as string) ?? null;
      const owner = await ctx.db.get(room.ownerId);
      if (q && !`${room.name} ${owner?.name ?? ""}`.toLowerCase().includes(q)) continue;
      const health = roomHealth({ profile, memberCount: room.members.length, messages24h: 0, reportsOpen: 0, flagged24h: 0 }, now);
      if (args.onlyProblem && health.score >= 60) continue;
      out.push({
        _id: room._id as unknown as string,
        name: room.name,
        kindLabel: roomKind(profile?.kind).label,
        emoji: profile?.avatar ?? roomKind(profile?.kind).emoji,
        ownerName: owner?.name ?? "لاعب",
        ownerId: room.ownerId as unknown as string,
        memberCount: room.members.length,
        memberLimit: profile?.memberLimit ?? 0,
        messageCount: profile?.messageCount ?? 0,
        moderationState: profile?.moderationState ?? "normal",
        featured: profile?.featured ?? false,
        expiresAt: profile?.expiresAt ?? 0,
        archived: room.archived,
        health,
        rules: profile?.rules ?? "",
      });
    }
    return out.sort((a, b) => a.health.score - b.health.score).slice(0, 100);
  },
});

export const ownerSetRoomState = mutation({
  args: { roomId: v.id("chatRooms"), state: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { meId, me } = await requireOwner(ctx);
    const profiles = await ctx.db
      .query("roomProfiles")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    if (!profiles) throw new Error("لا يوجد ملف متقدم لهذه الغرفة بعد");
    if (!["normal", "watch", "locked", "closed"].includes(args.state)) throw new Error("حالة غير معروفة");
    const note = cleanText(args.note ?? "", 200);
    await ctx.db.patch(profiles._id, { moderationState: args.state, moderationNote: note, updatedAt: Date.now() } as never);
    const room = await ctx.db.get(args.roomId);
    if (room) {
      await postSystem(ctx, args.roomId as never, meId as never, me.name ?? "الحاكم", `قرار إداري على الغرفة: ${args.state === "normal" ? "رفع القيود" : args.state === "watch" ? "المراقبة" : args.state === "locked" ? "قفل مؤقت" : "إغلاق"}${note ? ` — ${note}` : ""}`);
      await ctx.db.insert("notifications", {
        userId: room.ownerId,
        title: "⚖️ قرار على غرفتك",
        body: `حالة غرفتك الآن: ${args.state}${note ? ` — ${note}` : ""}`,
        type: "system" as const,
        read: false,
        createdAt: Date.now(),
      } as never);
    }
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "owner_state_changed", `${args.state}${note ? ` — ${note}` : ""}`);
    return { ok: true };
  },
});

export const ownerSetRoomLimit = mutation({
  args: { roomId: v.id("chatRooms"), memberLimit: v.number() },
  handler: async (ctx, args) => {
    const { meId, me } = await requireOwner(ctx);
    const profiles = await ctx.db.query("roomProfiles").withIndex("by_room", (q) => q.eq("roomId", args.roomId)).first();
    if (!profiles) throw new Error("لا يوجد ملف متقدم لهذه الغرفة بعد");
    const limit = Math.max(2, Math.min(args.memberLimit, 2000));
    await ctx.db.patch(profiles._id, { memberLimit: limit, updatedAt: Date.now() } as never);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "owner_limit_changed", `الحد الجديد ${limit}`);
    return { ok: true, memberLimit: limit };
  },
});

export const ownerTransferRoom = mutation({
  args: { roomId: v.id("chatRooms"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const { meId, me } = await requireOwner(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("اللاعب غير موجود");
    const members = new Set(room.members as unknown as string[]);
    members.add(args.targetUserId as unknown as string);
    const admins = new Set(room.admins as unknown as string[]);
    admins.add(args.targetUserId as unknown as string);
    await ctx.db.patch(args.roomId, {
      ownerId: args.targetUserId,
      members: [...members] as unknown as typeof room.members,
      admins: [...admins] as unknown as typeof room.admins,
    });
    await ctx.db.insert("notifications", {
      userId: args.targetUserId,
      title: "👑 أصبحت مالك غرفة",
      body: `نقل إليك الحاكم السيادي ملكية الغرفة «${room.name}»`,
      type: "system" as const,
      read: false,
      createdAt: Date.now(),
    } as never);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "ownership_transferred", `بقرار سيادي إلى ${target.name ?? "لاعب"}`);
    return { ok: true };
  },
});

export const ownerSetFeatured = mutation({
  args: { roomId: v.id("chatRooms"), featured: v.boolean() },
  handler: async (ctx, args) => {
    const { meId, me } = await requireOwner(ctx);
    const profiles = await ctx.db.query("roomProfiles").withIndex("by_room", (q) => q.eq("roomId", args.roomId)).first();
    if (!profiles) throw new Error("لا يوجد ملف متقدم لهذه الغرفة بعد");
    await ctx.db.patch(profiles._id, { featured: args.featured, updatedAt: Date.now() } as never);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "owner_featured", args.featured ? "عرض في الملتقى" : "إخفاء");
    return { ok: true };
  },
});

export const ownerDeleteRoom = mutation({
  args: { roomId: v.id("chatRooms"), reason: v.string() },
  handler: async (ctx, args) => {
    const { meId, me } = await requireOwner(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("الغرفة غير موجودة");
    await ctx.db.patch(args.roomId, { archived: true });
    const profiles = await ctx.db.query("roomProfiles").withIndex("by_room", (q) => q.eq("roomId", args.roomId)).first();
    if (profiles) await ctx.db.patch(profiles._id, { moderationState: "closed", featured: false, updatedAt: Date.now() } as never);
    await ctx.db.insert("notifications", {
      userId: room.ownerId,
      title: "🚫 أُغلقت غرفتك",
      body: cleanText(args.reason, 200) || "بقرار إداري",
      type: "ban" as const,
      read: false,
      createdAt: Date.now(),
    } as never);
    await writeAudit(ctx, args.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "owner_deleted", cleanText(args.reason, 200) || "بقرار إداري");
    return { ok: true };
  },
});

/** أرشفة الغرف المؤقتة المنتهية — يُستدعى من المالك أو من الموزّع الواحد */
export const pruneExpiredRooms = mutation({
  args: {},
  handler: async (ctx) => {
    const { meId, me } = await requireOwner(ctx);
    const now = Date.now();
    const profiles = await ctx.db.query("roomProfiles").take(MAX_ROOMS_SCAN);
    const expired = profiles.filter((p) => p.expiresAt > 0 && p.expiresAt <= now && p.moderationState !== "closed");
    let archived = 0;
    for (const p of expired.slice(0, 50)) {
      await ctx.db.patch(p._id, { moderationState: "closed", featured: false, updatedAt: now } as never);
      const room = await ctx.db.get(p.roomId);
      if (room && !room.archived) {
        await ctx.db.patch(p.roomId, { archived: true });
        archived++;
      }
      await writeAudit(ctx, p.roomId as never, { id: meId as never, name: me.name ?? "الحاكم", source: "owner" }, "room_archived", "انتهت مدة الغرفة المؤقتة");
    }
    return { scanned: profiles.length, expired: expired.length, archived };
  },
});
