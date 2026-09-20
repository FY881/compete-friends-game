/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗳️ v11.0 — استطلاعات الغرف الخاصة (نظام حقيقي لا صلاحية معلّقة)
 *
 * كان في الغرف خيار صلاحية اسمه «الاستطلاعات» بلا أي نظام خلفه. الآن:
 *   • المنشئ يصوغ سؤالاً بخيارين إلى ستة، بمدة محدّدة (أو بلا انتهاء).
 *   • كل عضو يصوّت **مرة واحدة**، ويمكنه تغيير صوته — ولا يُحتسب صوتان أبداً.
 *   • الأصوات تُخزَّن في سجل مستقل + عدّاد في صف الاستطلاع (قراءة واحدة للعرض).
 *   • الاستطلاع الفردي يقبل خياراً واحداً، والجماعي بحدّ أقصى واضح.
 *   • إغلاق فوري بيد صاحب الصلاحية، وكل قرار يُسجَّل في سجل الغرفة.
 *   • الانتهاء بالزمن يُحترم تلقائياً: لا تصويت على استطلاع منتهٍ.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  applyPollVote,
  hasPermission,
  pollIsOpen,
  pollRemaining,
  pollTallies,
  resolveRole,
  validatePollChoices,
  type RoomRole,
} from "./roomCore";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MIN_QUESTION = 4;
const MAX_QUESTION = 140;
const MAX_OPTION_LABEL = 60;
const MAX_CHOICES = 3;
const MAX_POLLS_PER_ROOM = 12;

function safe(text: string, max: number): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function optionId(index: number): string {
  return `o${index + 1}`;
}

// حالة الاستطلاع ونسبه ومنطق صوته تأتي من نواة الغرف roomCore (مُختبرة).

type Ctx = QueryCtx | MutationCtx;

async function roomAccess(
  ctx: Ctx,
  roomId: Id<"chatRooms">,
  userId: string | null,
): Promise<{ room: Awaited<ReturnType<Ctx["db"]["get"]>>; role: RoomRole | null; isMember: boolean } | null> {
  const roomDoc = await ctx.db.get(roomId);
  if (!roomDoc) return null;
  const profile = await ctx.db
    .query("roomProfiles")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .first();
  const room = roomDoc as unknown as {
    ownerId: Id<"users">;
    admins: Id<"users">[];
    members: Id<"users">[];
    name: string;
  };
  const isMember = userId !== null && room.members.some((m) => (m as unknown as string) === userId);
  const role = resolveRole(
    profile as never,
    room.ownerId as unknown as string,
    room.admins as unknown as string[],
    userId,
  );
  return { room: roomDoc, role, isMember };
}

async function audit(
  ctx: MutationCtx,
  roomId: Id<"chatRooms">,
  actor: { id?: Id<"users">; name: string },
  action: string,
  details: string,
): Promise<void> {
  await ctx.db.insert("roomAudit", {
    roomId,
    actorId: actor.id,
    actorName: actor.name,
    action,
    details: details.slice(0, 160),
    source: actor.id ? "member" : "system",
    at: Date.now(),
  });
}

// ───────────────────────────────────────────────────────────────────────
// القراءة: استطلاعات الغرفة مع أصواتي ونسبها الحقيقية
// ───────────────────────────────────────────────────────────────────────

export const getRoomPolls = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const access = await roomAccess(ctx, args.roomId, meId as unknown as string | null);
    if (!access) return { polls: [], canManage: false, canVote: false };
    const now = Date.now();
    const rows = await ctx.db
      .query("roomPolls")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(MAX_POLLS_PER_ROOM);

    const polls = [];
    for (const poll of rows) {
      const myVote = meId
        ? await ctx.db
            .query("roomPollVotes")
            .withIndex("by_poll_user", (q) => q.eq("pollId", poll._id).eq("userId", meId))
            .first()
        : null;
      polls.push({
        id: poll._id as unknown as string,
        question: poll.question,
        options: pollTallies(poll.options),
        multi: poll.multi,
        maxChoices: poll.maxChoices,
        totalVotes: poll.totalVotes,
        open: pollIsOpen(poll, now),
        remaining: pollRemaining(poll, now),
        createdByName: poll.createdByName,
        createdAt: poll.createdAt,
        myChoices: (myVote?.choices as string[]) ?? [],
        votes: poll.options.reduce((sum, o) => sum + o.votes, 0),
      });
    }

    const profile = await ctx.db
      .query("roomProfiles")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    return {
      polls,
      canManage: hasPermission(profile as never, access.role, "polls"),
      canVote: access.isMember || access.role !== null,
    };
  },
});

// ───────────────────────────────────────────────────────────────────────
// الإنشاء والتصويت والإغلاق
// ───────────────────────────────────────────────────────────────────────

export const createRoomPoll = mutation({
  args: {
    roomId: v.id("chatRooms"),
    question: v.string(),
    options: v.array(v.string()),
    multi: v.optional(v.boolean()),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const access = await roomAccess(ctx, args.roomId, meId as unknown as string);
    if (!access) throw new Error("الغرفة غير موجودة");
    const profile = await ctx.db
      .query("roomProfiles")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    if (!hasPermission(profile as never, access.role, "polls")) {
      throw new Error("ليست لديك صلاحية إنشاء استطلاع في هذه الغرفة");
    }

    const question = safe(args.question, MAX_QUESTION);
    if (question.length < MIN_QUESTION) throw new Error("نص السؤال قصير جداً");
    const labels: string[] = [];
    for (const raw of args.options) {
      const label = safe(raw ?? "", MAX_OPTION_LABEL);
      if (label.length === 0) continue;
      if (labels.some((l) => l.toLowerCase() === label.toLowerCase())) continue;
      labels.push(label);
      if (labels.length >= MAX_OPTIONS) break;
    }
    if (labels.length < MIN_OPTIONS) throw new Error(`الاستطلاع يحتاج ${MIN_OPTIONS} خيارات مختلفة على الأقل`);

    const existing = await ctx.db
      .query("roomPolls")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(MAX_POLLS_PER_ROOM);
    const openCount = existing.filter((p) => pollIsOpen(p, Date.now())).length;
    if (openCount >= 5) throw new Error("لدى الغرفة ٥ استطلاعات مفتوحة — أغلق واحداً قبل إنشاء آخر");

    const multi = args.multi === true;
    const hours = Math.max(0, Math.min(720, Math.round(args.hours ?? 24)));
    const now = Date.now();
    const me = await ctx.db.get(meId);
    const pollId = await ctx.db.insert("roomPolls", {
      roomId: args.roomId,
      question,
      options: labels.map((label, i) => ({ id: optionId(i), label, votes: 0 })),
      multi,
      maxChoices: multi ? Math.min(MAX_CHOICES, labels.length) : 1,
      createdBy: meId,
      createdByName: safe(me?.name ?? "عضو", 40),
      closed: false,
      expiresAt: hours > 0 ? now + hours * 60 * 60 * 1000 : 0,
      totalVotes: 0,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, args.roomId, { id: meId, name: me?.name ?? "عضو" }, "poll_created", `${question} · ${labels.length} خيارات`);
    return { ok: true, pollId: pollId as unknown as string, options: labels.length };
  },
});

export const voteRoomPoll = mutation({
  args: { pollId: v.id("roomPolls"), choices: v.array(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("الاستطلاع غير موجود");
    const access = await roomAccess(ctx, poll.roomId, meId as unknown as string);
    if (!access) throw new Error("الغرفة غير موجودة");
    if (!access.isMember) throw new Error("التصويت لأعضاء الغرفة فقط");
    const now = Date.now();
    if (!pollIsOpen(poll, now)) throw new Error("الاستطلاع مغلق أو انتهى وقته");

    const checked = validatePollChoices(
      { multi: poll.multi, maxChoices: poll.maxChoices, options: poll.options },
      args.choices,
    );
    if (!checked.ok) throw new Error(checked.reason);
    const picked = checked.choices;

    const previous = await ctx.db
      .query("roomPollVotes")
      .withIndex("by_poll_user", (q) => q.eq("pollId", args.pollId).eq("userId", meId))
      .first();

    // عدّاد الأصوات يُعدَّل بفرق التغيير فقط — فلا صوت مزدوج ولا صوت ضائع
    const applied = applyPollVote(poll.options, (previous?.choices as string[]) ?? [], picked);
    const nextOptions = applied.options;
    const totalVotes = applied.totalVotes;

    if (previous) {
      await ctx.db.patch(previous._id, { choices: picked, updatedAt: now });
    } else {
      const me = await ctx.db.get(meId);
      await ctx.db.insert("roomPollVotes", {
        pollId: args.pollId,
        roomId: poll.roomId,
        userId: meId,
        userName: safe(me?.name ?? "عضو", 40),
        choices: picked,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.pollId, {
      options: nextOptions,
      totalVotes,
      updatedAt: now,
    });
    return {
      ok: true,
      changed: applied.isNewVote,
      options: pollTallies(nextOptions),
      totalVotes,
    };
  },
});

export const closeRoomPoll = mutation({
  args: { pollId: v.id("roomPolls"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("الاستطلاع غير موجود");
    const access = await roomAccess(ctx, poll.roomId, meId as unknown as string);
    const profile = await ctx.db
      .query("roomProfiles")
      .withIndex("by_room", (q) => q.eq("roomId", poll.roomId))
      .first();
    const isCreator = (poll.createdBy as unknown as string) === (meId as unknown as string);
    if (!isCreator && !hasPermission(profile as never, access?.role ?? null, "polls")) {
      throw new Error("ليست لديك صلاحية إغلاق الاستطلاع");
    }
    const now = Date.now();
    await ctx.db.patch(args.pollId, { closed: true, updatedAt: now });
    const me = await ctx.db.get(meId);
    await audit(
      ctx,
      poll.roomId,
      { id: meId, name: me?.name ?? "عضو" },
      "poll_closed",
      `${poll.question}${args.reason ? ` — ${safe(args.reason, 60)}` : ""}`,
    );
    return { ok: true };
  },
});

/** حذف استطلاعات منتهية قديمة (٣٠ يوماً) — يحفظ مساحة القاعدة. */
export const internalSweepRoomPolls = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query("roomPolls").withIndex("by_closed", (q) => q.eq("closed", true)).take(40);
    let removed = 0;
    for (const poll of rows) {
      if (poll.updatedAt > cutoff) continue;
      const votes = await ctx.db
        .query("roomPollVotes")
        .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
        .take(200);
      for (const vote of votes) await ctx.db.delete(vote._id);
      await ctx.db.delete(poll._id);
      removed += 1;
    }
    return { removed };
  },
});
