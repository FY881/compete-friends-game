/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 v10.0 — خادم «ملتقى العقول» (الواجهة المجتمعية للاعبين)
 *
 * منتدى حقيقي: أقسام، منشورات بأنواعها (نقاش/استفسار/اقتراح/تحدٍّ/استطلاع/
 * إعلان/عرض غرفة)، تعليقات متفرعة واقتباس، تصويت بلا تكرار، إجابة مقبولة،
 * تثبيت وإغلاق وإخفاء، مشرفون معيّنون بصلاحيات محددة، وسيطرة سيادية كاملة
 * من المالك — مع ربط حقيقي بالغرف الخاصة والعضوية والبلاغات.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import { readTier } from "./roomNexus";
import { createChallengeRecord } from "./challenges";
import {
  DEFAULT_LIMITS,
  DEFAULT_SECTIONS,
  FORUM_RANKS,
  cleanText,
  forumPulse,
  isHighlightWorthy,
  karmaOf,
  matchSearch,
  moderatorFor,
  nextRank,
  postKind,
  qualityScore,
  rankFromKarma,
  rankPosts,
  sectionBySlug,
  trendingTags,
  validatePost,
  withinHourlyLimit,
  type ForumLimits,
  type ForumSortMode,
  type ModProfile,
} from "./forumCore";

const SCAN_LIMIT = 150;
const MAX_DEPTH = 3;

// ───────────────────────────────────────────────────────────────────────
// أدوات داخلية
// ───────────────────────────────────────────────────────────────────────
type LimitsDoc = ForumLimits & { _id?: string };

async function readLimits(ctx: QueryCtx | MutationCtx): Promise<LimitsDoc> {
  const row = await ctx.db.query("forumSettings").withIndex("by_key", (q) => q.eq("key", "global")).first();
  if (!row) return { ...DEFAULT_LIMITS };
  return {
    minPostLength: row.minPostLength,
    maxPostsPerHour: row.maxPostsPerHour,
    autoHighlightScore: row.autoHighlightScore,
    allowPosts: row.allowPosts,
    allowComments: row.allowComments,
    allowPolls: row.allowPolls,
  };
}

async function readMods(ctx: QueryCtx | MutationCtx): Promise<(ModProfile & { name: string; canHide: boolean })[]> {
  const rows = await ctx.db.query("forumModerators").withIndex("by_active", (q) => q.eq("active", true)).take(50);
  return rows.map((r) => ({
    userId: r.userId as unknown as string,
    sections: r.sections,
    canPin: r.canPin,
    canLock: r.canLock,
    canHide: r.canHide,
    name: r.userName,
  }));
}

async function isForumOwner(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const meId = await getAuthUserId(ctx);
  if (!meId) return false;
  const me = await ctx.db.get(meId);
  return Boolean(me && isOwnerUser(me));
}

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const meId = await getAuthUserId(ctx);
  if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
  const me = await ctx.db.get(meId);
  if (!me || !isOwnerUser(me)) throw new Error("هذه الصلاحية للحاكم السيادي فقط");
  return { meId, name: me.name ?? "الحاكم" };
}

async function logMod(
  ctx: MutationCtx,
  actor: { id?: never; name: string },
  action: string,
  targetType: string,
  targetId: string,
  details: string,
) {
  await ctx.db.insert("forumModLog", {
    actorId: actor.id,
    actorName: actor.name,
    action,
    targetType,
    targetId,
    details,
    at: Date.now(),
  });
}

async function notify(ctx: MutationCtx, userId: never, title: string, body: string, type: "info" | "warning" | "system") {
  await ctx.db.insert("notifications", {
    userId,
    title,
    body,
    type,
    read: false,
    createdAt: Date.now(),
  } as never);
}

async function authorKarma(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const posts = await ctx.db.query("forumPosts").withIndex("by_author", (q) => q.eq("authorId", userId)).take(60);
  const comments = await ctx.db.query("forumComments").withIndex("by_author", (q) => q.eq("authorId", userId)).take(60);
  const upvotesReceived =
    posts.reduce((s, p) => s + Math.max(0, p.upvotes - p.downvotes), 0) +
    comments.reduce((s, c) => s + Math.max(0, c.upvotes), 0);
  const accepted = posts.filter((p) => p.acceptedCommentId).length;
  const karma = karmaOf({ posts: posts.length, comments: comments.length, upvotesReceived, acceptedAnswers: accepted });
  return { karma, posts: posts.length, comments: comments.length, upvotesReceived, accepted };
}

/** يقارن عمق الرد — يمنع التعشيش العميق الذي يفسد القراءة */
async function depthOf(ctx: QueryCtx | MutationCtx, parentId: string | undefined): Promise<number> {
  let depth = 0;
  let cursor = parentId;
  while (cursor && depth < 8) {
    const parent = ctx.db.normalizeId("forumComments", cursor);
    if (!parent) break;
    const doc = await ctx.db.get(parent);
    if (!doc) break;
    depth++;
    cursor = doc.parentId;
  }
  return depth;
}

// ═══════════════════════════════════════════════════════════════════════
// ① تهيئة الملتقى (تُستدعى مرة عند أول فتح — آمنة ومتكررة بلا ضرر)
// ═══════════════════════════════════════════════════════════════════════
export const ensureForumReady = mutation({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const now = Date.now();
    let created = 0;
    for (const spec of DEFAULT_SECTIONS) {
      const existing = await ctx.db.query("forumSections").withIndex("by_slug", (q) => q.eq("slug", spec.slug)).first();
      if (existing) continue;
      await ctx.db.insert("forumSections", {
        slug: spec.slug,
        name: spec.name,
        emoji: spec.emoji,
        description: spec.description,
        order: spec.order,
        minTierRank: spec.minTierRank,
        allowPosts: spec.allowPosts,
        allowPolls: spec.allowPolls,
        allowComments: spec.allowComments,
        locked: false,
        archived: false,
        postCount: 0,
        createdAt: now,
      });
      created++;
    }
    const settings = await ctx.db.query("forumSettings").withIndex("by_key", (q) => q.eq("key", "global")).first();
    if (!settings) {
      await ctx.db.insert("forumSettings", {
        key: "global",
        allowPosts: DEFAULT_LIMITS.allowPosts,
        allowComments: DEFAULT_LIMITS.allowComments,
        allowPolls: DEFAULT_LIMITS.allowPolls,
        allowRoomsShowcase: true,
        minPostLength: DEFAULT_LIMITS.minPostLength,
        maxPostsPerHour: DEFAULT_LIMITS.maxPostsPerHour,
        autoHighlightScore: DEFAULT_LIMITS.autoHighlightScore,
        updatedAt: now,
      });
    }
    return { createdSections: created };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② الأقسام + إحصاءات عامة
// ═══════════════════════════════════════════════════════════════════════
export const listSections = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    const mods = await readMods(ctx);
    const isOwner = await isForumOwner(ctx);
    const rows = await ctx.db.query("forumSections").withIndex("by_order", (q) => q.gte("order", 0)).take(50);
    const posts = await ctx.db.query("forumPosts").order("desc").take(SCAN_LIMIT);
    const tier = meId ? await readTier(ctx, meId) : "bronze";
    const rank = (t: string) => ["bronze", "silver", "gold", "platinum", "diamond", "legend"].indexOf(t);

    const source = rows.length > 0 ? rows : [];
    const byName = new Map(source.map((s) => [s.slug, s]));
    const list = [...DEFAULT_SECTIONS]
      .sort((a, b) => a.order - b.order)
      .map((spec) => {
        const row = byName.get(spec.slug);
        const sectionPosts = posts.filter((p) => p.sectionSlug === spec.slug && p.status !== "hidden");
        const last = sectionPosts.reduce((max, p) => Math.max(max, p.lastActivityAt), 0);
        const mod = moderatorFor(mods, meId, spec.slug);
        return {
          _id: (row?._id ?? spec.slug) as unknown as string,
          slug: spec.slug,
          name: row?.name ?? spec.name,
          emoji: row?.emoji ?? spec.emoji,
          description: row?.description ?? spec.description,
          order: row?.order ?? spec.order,
          minTierRank: row?.minTierRank ?? spec.minTierRank,
          locked: row?.locked ?? false,
          allowPosts: row?.allowPosts ?? spec.allowPosts,
          allowPolls: row?.allowPolls ?? spec.allowPolls,
          allowComments: row?.allowComments ?? spec.allowComments,
          kinds: spec.kinds,
          postCount: row?.postCount ?? sectionPosts.length,
          lastActivityAt: last,
          canModerate: Boolean(mod) || isOwner,
          lockedForMe: (row?.minTierRank ?? spec.minTierRank) > rank(tier),
        };
      });
    return { sections: list, myTier: tier };
  },
});

export const getForumStats = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    const now = Date.now();
    const posts = await ctx.db.query("forumPosts").order("desc").take(SCAN_LIMIT);
    const comments = await ctx.db.query("forumComments").order("desc").take(200);
    const visible = posts.filter((p) => p.status !== "hidden");
    const authors24 = new Set(posts.filter((p) => now - p.createdAt < 86400000).map((p) => p.authorId as unknown as string));
    const unanswered = visible.filter((p) => p.kind === "question" && !p.acceptedCommentId).length;
    const mods = await readMods(ctx);
    return {
      posts: visible.length,
      comments: comments.filter((c) => !c.deleted).length,
      authors24: authors24.size,
      unanswered,
      highlighted: visible.filter((p) => p.highlighted).length,
      trending: trendingTags(visible.map((p) => ({ tags: p.tags, upvotes: p.upvotes, commentCount: p.commentCount, lastActivityAt: p.lastActivityAt })), now, 8),
      moderators: mods.map((m) => ({ userId: m.userId, name: m.name, sections: m.sections })),
      canModerate: mods.some((m) => m.userId === (meId as unknown as string)),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ تغذية المنشورات (فلترة + ترتيب ذكي + بحث)
// ═══════════════════════════════════════════════════════════════════════
export const listPosts = query({
  args: {
    sectionSlug: v.optional(v.string()),
    sort: v.optional(v.string()),
    kind: v.optional(v.string()),
    tag: v.optional(v.string()),
    q: v.optional(v.string()),
    authorId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const now = Date.now();
    const rows = args.sectionSlug
      ? await ctx.db
          .query("forumPosts")
          .withIndex("by_section_activity", (q) => q.eq("sectionSlug", args.sectionSlug as string))
          .order("desc")
          .take(SCAN_LIMIT)
      : await ctx.db.query("forumPosts").order("desc").take(SCAN_LIMIT);

    const myVotes = meId
      ? await ctx.db.query("forumVotes").withIndex("by_user", (q) => q.eq("userId", meId)).take(200)
      : [];
    const voteByPost = new Map<string, number>();
    for (const vote of myVotes) if (vote.targetType === "post") voteByPost.set(vote.targetId, vote.value);

    const subs = meId
      ? await ctx.db.query("forumSubscriptions").withIndex("by_user", (q) => q.eq("userId", meId)).take(100)
      : [];
    const subSet = new Set(subs.map((s) => s.postId as unknown as string));

    const authorIds = [...new Set(rows.map((p) => p.authorId as unknown as string))].slice(0, 40);
    const rankByAuthor = new Map<string, { label: string; emoji: string }>();
    for (const id of authorIds) {
      const karma = await authorKarma(ctx, id as never);
      const r = rankFromKarma(karma.karma);
      rankByAuthor.set(id, { label: r.label, emoji: r.emoji });
    }

    const enriched = rows.map((p) => ({
      _id: p._id as unknown as string,
      sectionSlug: p.sectionSlug,
      authorId: p.authorId as unknown as string,
      authorName: p.authorName,
      authorRank: rankByAuthor.get(p.authorId as unknown as string) ?? { label: FORUM_RANKS[0].label, emoji: FORUM_RANKS[0].emoji },
      title: p.title,
      body: p.body,
      kind: p.kind,
      tags: p.tags,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      commentCount: p.commentCount,
      viewCount: p.viewCount,
      qualityScore: p.qualityScore,
      highlighted: p.highlighted,
      pinned: Boolean(p.pinnedAt),
      locked: Boolean(p.lockedAt),
      status: p.status,
      myVote: voteByPost.get(p._id as unknown as string) ?? 0,
      subscribed: subSet.has(p._id as unknown as string),
      hasPoll: Boolean(p.poll),
      challenge: p.challenge ?? null,
      roomId: (p.roomId as unknown as string) ?? null,
      createdAt: p.createdAt,
      lastActivityAt: p.lastActivityAt,
      acceptedCommentId: p.acceptedCommentId ?? null,
    }));

    let filtered = enriched;
    if (args.kind) filtered = filtered.filter((p) => p.kind === args.kind);
    if (args.tag) filtered = filtered.filter((p) => p.tags.includes(args.tag as string));
    if (args.authorId) filtered = filtered.filter((p) => p.authorId === (args.authorId as unknown as string));
    if (args.q) filtered = filtered.filter((p) => matchSearch(p, args.q as string));

    // المثبّت أولاً دائماً، ثم الترتيب المختار
    const pinned = filtered.filter((p) => p.pinned);
    const ranked = rankPosts(filtered, (args.sort ?? "new") as ForumSortMode, now);
    const ordered = [...pinned, ...ranked.filter((p) => !p.pinned)];
    return ordered.slice(0, Math.min(args.limit ?? 40, 100));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ منشور واحد كامل (مع التعليقات المتفرعة وحقوقي فيه)
// ═══════════════════════════════════════════════════════════════════════
export const getPost = query({
  args: { postId: v.id("forumPosts") },
  handler: async (ctx, { postId }) => {
    const meId = await getAuthUserId(ctx);
    const post = await ctx.db.get(postId);
    if (!post) return null;
    const mods = await readMods(ctx);
    const isOwner = await isForumOwner(ctx);
    const mod = moderatorFor(mods, meId, post.sectionSlug);
    const section = sectionBySlug(post.sectionSlug);

    const comments = await ctx.db
      .query("forumComments")
      .withIndex("by_post", (q) => q.eq("postId", postId))
      .order("asc")
      .take(200);

    const myVotes = meId
      ? await ctx.db.query("forumVotes").withIndex("by_user", (q) => q.eq("userId", meId)).take(300)
      : [];
    const voteFor = (type: string, id: string) =>
      myVotes.find((vote) => vote.targetType === type && vote.targetId === id)?.value ?? 0;

    const subscription = meId
      ? await ctx.db
          .query("forumSubscriptions")
          .withIndex("by_user_post", (q) => q.eq("userId", meId).eq("postId", postId))
          .first()
      : null;

    const authorKarmaInfo = await authorKarma(ctx, post.authorId);

    const commentAuthors = [...new Set(comments.map((c) => c.authorId as unknown as string))].slice(0, 50);
    const rankByAuthor = new Map<string, { label: string; emoji: string }>();
    for (const id of commentAuthors) {
      const k = await authorKarma(ctx, id as never);
      const r = rankFromKarma(k.karma);
      rankByAuthor.set(id, { label: r.label, emoji: r.emoji });
    }

    const tag = post.tags[0];
    const recent = await ctx.db.query("forumPosts").order("desc").take(60);
    const related = recent
      .filter((p) => (p._id as unknown as string) !== (postId as unknown as string) && p.status !== "hidden")
      .filter((p) => (tag ? p.tags.includes(tag) : p.sectionSlug === post.sectionSlug))
      .slice(0, 5)
      .map((p) => ({
        _id: p._id as unknown as string,
        title: p.title,
        kind: p.kind,
        upvotes: p.upvotes,
        commentCount: p.commentCount,
      }));

    return {
      post: {
        _id: post._id as unknown as string,
        sectionSlug: post.sectionSlug,
        sectionName: section?.name ?? post.sectionSlug,
        authorId: post.authorId as unknown as string,
        authorName: post.authorName,
        authorKarma: authorKarmaInfo.karma,
        authorRank: rankFromKarma(authorKarmaInfo.karma),
        title: post.title,
        body: post.body,
        kind: post.kind,
        kindLabel: postKind(post.kind).label,
        tags: post.tags,
        upvotes: post.upvotes,
        downvotes: post.downvotes,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        qualityScore: qualityScore({
          upvotes: post.upvotes,
          downvotes: post.downvotes,
          commentCount: post.commentCount,
          body: post.body,
          tags: post.tags,
          kind: post.kind,
          createdAt: post.createdAt,
          lastActivityAt: post.lastActivityAt,
          acceptedCommentId: post.acceptedCommentId ?? null,
          status: post.status,
        }),
        highlighted: post.highlighted,
        pinned: Boolean(post.pinnedAt),
        locked: Boolean(post.lockedAt),
        hidden: post.status === "hidden",
        status: post.status,
        poll: post.poll ?? null,
        challenge: post.challenge ?? null,
        roomId: (post.roomId as unknown as string) ?? null,
        acceptedCommentId: post.acceptedCommentId ?? null,
        createdAt: post.createdAt,
        lastActivityAt: post.lastActivityAt,
      },
      comments: comments.map((c) => ({
        _id: c._id as unknown as string,
        parentId: c.parentId ?? null,
        authorId: c.authorId as unknown as string,
        authorName: c.authorName,
        authorRank: rankByAuthor.get(c.authorId as unknown as string) ?? { label: FORUM_RANKS[0].label, emoji: FORUM_RANKS[0].emoji },
        body: c.deleted ? "🗑️ حُذف هذا التعليق" : c.body,
        quoted: c.quoted ?? null,
        upvotes: c.upvotes,
        deleted: c.deleted,
        isAnswer: c.isAnswer,
        myVote: voteFor("comment", c._id as unknown as string),
        createdAt: c.createdAt,
      })),
      related,
      myVote: voteFor("post", postId as unknown as string),
      pollVotes: myVotes.filter((vote) => vote.targetType === "poll" && vote.targetId.startsWith(postId as unknown as string)),
      subscribed: Boolean(subscription),
      canModerate: Boolean(mod) || isOwner,
      myCaps: {
        canPin: Boolean(mod?.canPin) || isOwner,
        canLock: Boolean(mod?.canLock) || isOwner,
        canHide: Boolean(mod?.canHide) || isOwner,
        isAuthor: meId !== null && (post.authorId as unknown as string) === (meId as unknown as string),
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑤ ملفي في الملتقى + متابعاتي
// ═══════════════════════════════════════════════════════════════════════
export const getMyForumProfile = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return null;
    const karmaInfo = await authorKarma(ctx, meId);
    const rank = rankFromKarma(karmaInfo.karma);
    const progress = nextRank(karmaInfo.karma);
    const mods = await readMods(ctx);
    const mine = mods.find((m) => m.userId === (meId as unknown as string));
    const subs = await ctx.db.query("forumSubscriptions").withIndex("by_user", (q) => q.eq("userId", meId)).take(50);
    const posts = await ctx.db.query("forumPosts").withIndex("by_author", (q) => q.eq("authorId", meId)).order("desc").take(20);
    return {
      karma: karmaInfo.karma,
      rank,
      nextRank: progress.next,
      remaining: progress.remaining,
      posts: karmaInfo.posts,
      comments: karmaInfo.comments,
      upvotesReceived: karmaInfo.upvotesReceived,
      acceptedAnswers: karmaInfo.accepted,
      isModerator: Boolean(mine),
      moderatedSections: mine?.sections ?? [],
      caps: mine ? { canPin: mine.canPin, canLock: mine.canLock, canHide: mine.canHide } : null,
      subscriptions: subs.length,
      recentPosts: posts.map((p) => ({
        _id: p._id as unknown as string,
        title: p.title,
        kind: p.kind,
        upvotes: p.upvotes,
        commentCount: p.commentCount,
        status: p.status,
        lastActivityAt: p.lastActivityAt,
      })),
    };
  },
});

export const getMySubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return [];
    const subs = await ctx.db.query("forumSubscriptions").withIndex("by_user", (q) => q.eq("userId", meId)).take(50);
    const out = [];
    for (const s of subs) {
      const post = await ctx.db.get(s.postId);
      if (!post || post.status === "hidden") continue;
      out.push({
        postId: post._id as unknown as string,
        title: post.title,
        kind: post.kind,
        sectionSlug: post.sectionSlug,
        commentCount: post.commentCount,
        lastActivityAt: post.lastActivityAt,
        newSinceSubscribe: post.lastActivityAt > s.createdAt,
      });
    }
    return out.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑥ عرض الغرف المميزة داخل الملتقى (ربط حقيقي بالغرف الخاصة)
// ═══════════════════════════════════════════════════════════════════════
export const listRoomsShowcase = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("forumSettings").withIndex("by_key", (q) => q.eq("key", "global")).first();
    if (settings && !settings.allowRoomsShowcase) return [];
    const profiles = await ctx.db.query("roomProfiles").withIndex("by_featured", (q) => q.eq("featured", true)).take(24);
    const out = [];
    for (const p of profiles) {
      if (p.moderationState === "closed") continue;
      const room = await ctx.db.get(p.roomId);
      if (!room || room.archived) continue;
      const owner = await ctx.db.get(room.ownerId);
      out.push({
        roomId: room._id as unknown as string,
        name: room.name,
        description: room.description ?? "",
        kind: p.kind,
        emoji: p.avatar,
        tone: p.bannerTone,
        tags: p.tags,
        memberCount: room.members.length,
        messageCount: p.messageCount,
        lastActivityAt: p.lastActivityAt,
        ownerName: owner?.name ?? "لاعب",
        challengeReward: p.challengeReward,
      });
    }
    const active = out.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    const recentProfiles = await ctx.db.query("roomProfiles").take(60);
    const recent = [...recentProfiles].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    if (active.length < 3) {
      for (const p of recent) {
        if (active.length >= Math.min(args.limit ?? 6, 12)) break;
        if (p.moderationState === "closed" || p.featured) continue;
        const room = await ctx.db.get(p.roomId);
        if (!room || room.archived || room.members.length < 3) continue;
        const owner = await ctx.db.get(room.ownerId);
        active.push({
          roomId: room._id as unknown as string,
          name: room.name,
          description: room.description ?? "",
          kind: p.kind,
          emoji: p.avatar,
          tone: p.bannerTone,
          tags: p.tags,
          memberCount: room.members.length,
          messageCount: p.messageCount,
          lastActivityAt: p.lastActivityAt,
          ownerName: owner?.name ?? "لاعب",
          challengeReward: p.challengeReward,
        });
      }
    }
    return active.slice(0, Math.min(args.limit ?? 6, 12));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑦ النشر والتعديل والحذف
// ═══════════════════════════════════════════════════════════════════════
export const createPost = mutation({
  args: {
    sectionSlug: v.string(),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    tags: v.optional(v.array(v.string())),
    pollOptions: v.optional(v.array(v.string())),
    pollMulti: v.optional(v.boolean()),
    pollHours: v.optional(v.number()),
    challengeDifficulty: v.optional(v.string()),
    challengeReward: v.optional(v.number()),
    challengeQuestions: v.optional(v.number()),
    roomId: v.optional(v.id("chatRooms")),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(meId);
    if (!me) throw new Error("الحساب غير موجود");
    const limits = await readLimits(ctx);
    if (!limits.allowPosts) throw new Error("النشر متوقف حالياً بقرار الإدارة");
    const mods = await readMods(ctx);
    const isOwner = await isForumOwner(ctx);
    const mod = moderatorFor(mods, meId, args.sectionSlug);

    const sectionRow = await ctx.db.query("forumSections").withIndex("by_slug", (q) => q.eq("slug", args.sectionSlug)).first();
    const spec = sectionBySlug(args.sectionSlug);
    if (!spec) throw new Error("قسم غير معروف");
    if (sectionRow?.locked && !isOwner && !mod) throw new Error("هذا القسم مقفل حالياً");
    if (sectionRow && !sectionRow.allowPosts && !isOwner && !mod) throw new Error("النشر متوقف في هذا القسم");
    if (sectionRow && !sectionRow.allowPolls && args.kind === "poll" && !isOwner && !mod) {
      throw new Error("الاستطلاعات متوقفة في هذا القسم");
    }
    if (args.kind === "poll" && !limits.allowPolls && !isOwner && !mod) throw new Error("الاستطلاعات متوقفة حالياً");
    if (!spec.kinds.includes(postKind(args.kind).id)) {
      throw new Error(`هذا القسم لا يقبل نوع «${postKind(args.kind).label}»`);
    }
    if (postKind(args.kind).id === "announcement" && !isOwner && !mod) {
      throw new Error("الإعلانات للإدارة فقط");
    }

    const tier = await readTier(ctx, meId);
    const tierR = Math.max(0, ["bronze", "silver", "gold", "platinum", "diamond", "legend"].indexOf(tier));
    if (spec.minTierRank > tierR && !isOwner && !mod) throw new Error("تحتاج عضوية أعلى للمشاركة في هذا القسم");

    const now = Date.now();
    const mineRecent = await ctx.db.query("forumPosts").withIndex("by_author", (q) => q.eq("authorId", meId)).order("desc").take(12);
    const lastHour = mineRecent.filter((p) => now - p.createdAt < 60 * 60 * 1000).length;
    if (!withinHourlyLimit(lastHour, limits.maxPostsPerHour) && !isOwner && !mod) {
      throw new Error(`تجاوزت حدّ النشر (${limits.maxPostsPerHour} منشورات في الساعة)`);
    }

    if (args.kind === "room") {
      if (!args.roomId) throw new Error("عرض الغرفة يتطلب اختيار غرفة تملكها");
      const room = await ctx.db.get(args.roomId);
      if (!room || (room.ownerId as unknown as string) !== (meId as unknown as string)) {
        throw new Error("تعرض فقط غرفة تملكها");
      }
      const profile = await ctx.db.query("roomProfiles").withIndex("by_room", (q) => q.eq("roomId", args.roomId as never)).first();
      if (!profile) throw new Error("الغرفة غير مهيّأة للعرض بعد");
      if (!profile.featured && !isOwner) {
        await ctx.db.patch(profile._id, { featured: true, updatedAt: now });
      }
    }

    const validated = validatePost(
      {
        kind: args.kind,
        title: args.title,
        body: args.body,
        tags: args.tags,
        pollOptions: args.pollOptions,
        pollMulti: args.pollMulti,
        pollHours: args.pollHours,
        challengeDifficulty: args.challengeDifficulty,
        challengeReward: args.challengeReward,
        challengeQuestions: args.challengeQuestions,
        roomId: args.roomId as unknown as string,
      },
      tierR,
      now,
    );
    if (!validated.ok) throw new Error(validated.reason);

    const sectionId = sectionRow?._id;
    if (!sectionId) throw new Error("القسم غير مهيّأ — أعد فتح الملتقى لحظة");

    const base = {
      upvotes: 0,
      downvotes: 0,
      commentCount: 0,
      body: validated.body,
      tags: validated.tags,
      kind: validated.kind.id,
    };
    const initialQuality = qualityScore({
      ...base,
      createdAt: now,
      lastActivityAt: now,
      acceptedCommentId: null,
      status: "open",
    });

    const postId = await ctx.db.insert("forumPosts", {
      sectionId,
      sectionSlug: args.sectionSlug,
      authorId: meId,
      authorName: me.name ?? "لاعب",
      title: validated.title,
      body: validated.body,
      kind: validated.kind.id,
      tags: validated.tags,
      roomId: args.kind === "room" ? args.roomId : undefined,
      challenge: validated.challenge,
      poll: validated.poll,
      upvotes: 0,
      downvotes: 0,
      commentCount: 0,
      viewCount: 0,
      qualityScore: initialQuality,
      highlighted: isHighlightWorthy({ ...base, createdAt: now, lastActivityAt: now, acceptedCommentId: null, status: "open" }, limits.autoHighlightScore) && validated.kind.id !== "announcement",
      status: "open",
      createdAt: now,
      lastActivityAt: now,
    });

    // ⚔️ v11.0: منشور التحدّي لا يُنشر وعداً — يُنشأ له تحدٍّ حقيقي بكود يُلعَب في الساحة
    let challengeCodeOut: string | null = null;
    if (validated.kind.id === "challenge" && validated.challenge) {
      const created = await createChallengeRecord(ctx, {
        source: "forum",
        title: validated.title,
        note: validated.body.slice(0, 180),
        difficulty: validated.challenge.difficulty,
        questionCount: validated.challenge.questionCount,
        rewardXp: validated.challenge.reward,
        rewardCoins: 0,
        ttlHours: 168,
        postId,
        createdBy: meId,
        createdByName: me.name ?? "لاعب",
      });
      challengeCodeOut = created.code;
      await ctx.db.patch(postId, {
        challenge: { ...validated.challenge, code: created.code },
      });
    }

    if (sectionRow) await ctx.db.patch(sectionRow._id, { postCount: sectionRow.postCount + 1 });

    // إشعار المشرفين المعنيين — إشراف فعّال لا انتظار
    for (const m of mods.filter((x) => x.sections.includes("*") || x.sections.includes(args.sectionSlug)).slice(0, 5)) {
      await notify(ctx, m.userId as never, "🧠 منشور جديد في قسمك", `${validated.kind.label}: ${validated.title}`, "info");
    }

    return {
      postId,
      highlighted: initialQuality >= limits.autoHighlightScore,
      kind: validated.kind.id,
      challengeCode: challengeCodeOut,
    };
  },
});

export const updatePost = mutation({
  args: { postId: v.id("forumPosts"), title: v.optional(v.string()), body: v.optional(v.string()), tags: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const isOwner = await isForumOwner(ctx);
    const mods = await readMods(ctx);
    const mod = moderatorFor(mods, meId, post.sectionSlug);
    const isAuthor = (post.authorId as unknown as string) === (meId as unknown as string);
    if (!isAuthor && !mod && !isOwner) throw new Error("لا تملك صلاحية تعديل هذا المنشور");
    if (isAuthor && !mod && !isOwner && Date.now() - post.createdAt > 60 * 60 * 1000) {
      throw new Error("مضى وقت التعديل (ساعة واحدة) — تواصل مع مشرف القسم");
    }
    const kind = postKind(post.kind);
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) {
      const t = cleanText(args.title, kind.titleMax);
      if (t.length < 6) throw new Error("العنوان قصير جداً");
      patch.title = t;
    }
    if (args.body !== undefined) {
      const b = cleanText(args.body.replace(/\n/g, " "), kind.bodyMax);
      if (b.length < kind.bodyMin) throw new Error("النص قصير جداً");
      patch.body = args.body.slice(0, kind.bodyMax);
    }
    if (args.tags !== undefined) {
      patch.tags = (args.tags ?? []).map((t) => cleanText(t.replace(/^#/, ""), 20)).filter((t) => t.length >= 2).slice(0, 5);
    }
    await ctx.db.patch(args.postId, patch);
    if (!isAuthor) {
      await logMod(ctx, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "مشرف" }, "post_edited_by_mod", "post", args.postId as unknown as string, cleanText(args.title ?? post.title, 80));
    }
    return { ok: true };
  },
});

export const deletePost = mutation({
  args: { postId: v.id("forumPosts"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const isOwner = await isForumOwner(ctx);
    const mods = await readMods(ctx);
    const mod = moderatorFor(mods, meId, post.sectionSlug);
    const isAuthor = (post.authorId as unknown as string) === (meId as unknown as string);
    const reason = cleanText(args.reason ?? "", 200);
    const now = Date.now();

    if (isAuthor && !mod && !isOwner && post.commentCount > 0) {
      throw new Error("لا يمكن حذف منشور له تعليقات — يمكنك إغلاقه أو طلب إشراف");
    }
    if (!isAuthor && !mod && !isOwner) throw new Error("لا تملك صلاحية الحذف");
    if (mod && !mod.canHide && !isOwner && !isAuthor) throw new Error("صلاحيتك لا تشمل الإخفاء");

    await ctx.db.patch(args.postId, {
      status: "hidden",
      hiddenAt: now,
      hiddenBy: (await ctx.db.get(meId))?.name ?? "مشرف",
      highlighted: false,
    });
    if (post.sectionId) {
      const section = await ctx.db.get(post.sectionId);
      if (section && section.postCount > 0) await ctx.db.patch(post.sectionId, { postCount: section.postCount - 1 });
    }
    if (!isAuthor) {
      await logMod(ctx, { id: meId as never, name: (await ctx.db.get(meId))?.name ?? "مشرف" }, "post_hidden", "post", args.postId as unknown as string, reason || post.title);
      await notify(ctx, post.authorId as never, "🚫 أُخفي منشورك في الملتقى", reason || `المنشور: ${post.title}`, "warning");
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑧ التصويت (بلا تكرار فعلي) + الاستطلاعات
// ═══════════════════════════════════════════════════════════════════════
export const votePost = mutation({
  args: { postId: v.id("forumPosts"), value: v.number() },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const value = args.value > 0 ? 1 : args.value < 0 ? -1 : 0;
    const existing = await ctx.db
      .query("forumVotes")
      .withIndex("by_target_user", (q) => q.eq("targetType", "post").eq("targetId", args.postId as unknown as string).eq("userId", meId))
      .first();

    let up = post.upvotes;
    let down = post.downvotes;
    if (existing) {
      if (existing.value === 1) up--;
      else down--;
      if (value === 0 || existing.value === value) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, { value, createdAt: Date.now() });
        if (value === 1) up++;
        else down++;
      }
    } else if (value !== 0) {
      await ctx.db.insert("forumVotes", {
        targetType: "post",
        targetId: args.postId as unknown as string,
        userId: meId,
        value,
        createdAt: Date.now(),
      });
      if (value === 1) up++;
      else down++;
    }

    const limits = await readLimits(ctx);
    const q = qualityScore({
      upvotes: up,
      downvotes: down,
      commentCount: post.commentCount,
      body: post.body,
      tags: post.tags,
      kind: post.kind,
      createdAt: post.createdAt,
      lastActivityAt: post.lastActivityAt,
      acceptedCommentId: post.acceptedCommentId ?? null,
      status: post.status,
    });
    await ctx.db.patch(args.postId, {
      upvotes: Math.max(0, up),
      downvotes: Math.max(0, down),
      qualityScore: q,
      highlighted: post.kind === "announcement" ? post.highlighted : isHighlightWorthy({ upvotes: up, downvotes: down, commentCount: post.commentCount, body: post.body, tags: post.tags, kind: post.kind, createdAt: post.createdAt, lastActivityAt: post.lastActivityAt, acceptedCommentId: post.acceptedCommentId ?? null, status: post.status }, limits.autoHighlightScore),
    });
    return { upvotes: Math.max(0, up), downvotes: Math.max(0, down), qualityScore: q };
  },
});

export const voteComment = mutation({
  args: { commentId: v.id("forumComments"), value: v.number() },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("التعليق غير موجود");
    const value = args.value > 0 ? 1 : args.value < 0 ? -1 : 0;
    const existing = await ctx.db
      .query("forumVotes")
      .withIndex("by_target_user", (q) => q.eq("targetType", "comment").eq("targetId", args.commentId as unknown as string).eq("userId", meId))
      .first();
    let up = comment.upvotes;
    if (existing) {
      if (existing.value === 1) up--;
      if (value === 0 || existing.value === value) await ctx.db.delete(existing._id);
      else {
        await ctx.db.patch(existing._id, { value, createdAt: Date.now() });
        if (value === 1) up++;
      }
    } else if (value === 1) {
      await ctx.db.insert("forumVotes", {
        targetType: "comment",
        targetId: args.commentId as unknown as string,
        userId: meId,
        value,
        createdAt: Date.now(),
      });
      up++;
    }
    await ctx.db.patch(args.commentId, { upvotes: Math.max(0, up) });
    return { upvotes: Math.max(0, up) };
  },
});

export const votePoll = mutation({
  args: { postId: v.id("forumPosts"), optionId: v.string() },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post || !post.poll) throw new Error("لا يوجد استطلاع في هذا المنشور");
    if (post.poll.endsAt > 0 && post.poll.endsAt < Date.now()) throw new Error("انتهى وقت التصويت");
    const existing = await ctx.db
      .query("forumVotes")
      .withIndex("by_target_user", (q) => q.eq("targetType", "poll").eq("targetId", `${args.postId as unknown as string}:${args.optionId}`).eq("userId", meId))
      .first();

    const options = post.poll.options.map((o) => ({ ...o }));
    const target = options.find((o) => o.id === args.optionId);
    if (!target) throw new Error("خيار غير موجود");

    if (existing) {
      target.votes = Math.max(0, target.votes - 1);
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, { poll: { ...post.poll, options } });
      return { voted: false, options };
    }

    if (!post.poll.multi) {
      const allMine = await ctx.db.query("forumVotes").withIndex("by_user", (q) => q.eq("userId", meId)).take(200);
      for (const vote of allMine.filter((x) => x.targetType === "poll" && x.targetId.startsWith(args.postId as unknown as string))) {
        const prevId = vote.targetId.split(":")[1];
        const prev = options.find((o) => o.id === prevId);
        if (prev) prev.votes = Math.max(0, prev.votes - 1);
        await ctx.db.delete(vote._id);
      }
    }
    target.votes += 1;
    await ctx.db.insert("forumVotes", {
      targetType: "poll",
      targetId: `${args.postId as unknown as string}:${args.optionId}`,
      userId: meId,
      value: 1,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.postId, { poll: { ...post.poll, options }, lastActivityAt: Date.now() });
    return { voted: true, options };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑨ التعليقات + الإجابة المقبولة + المتابعة
// ═══════════════════════════════════════════════════════════════════════
export const addComment = mutation({
  args: {
    postId: v.id("forumPosts"),
    body: v.string(),
    parentId: v.optional(v.id("forumComments")),
    quoted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    if (post.status === "hidden") throw new Error("هذا المنشور مخفي");
    if (post.lockedAt) throw new Error("النقاش مغلق");
    const limits = await readLimits(ctx);
    if (!limits.allowComments) throw new Error("التعليقات متوقفة حالياً");
    const sectionRow = await ctx.db.query("forumSections").withIndex("by_slug", (q) => q.eq("slug", post.sectionSlug)).first();
    if (sectionRow && !sectionRow.allowComments) throw new Error("التعليقات متوقفة في هذا القسم");
    const body = cleanText(args.body.replace(/\n/g, " "), 2000);
    if (body.length < 2) throw new Error("التعليق قصير جداً");
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || (parent.postId as unknown as string) !== (args.postId as unknown as string)) {
        throw new Error("التعليق الأب غير صحيح");
      }
      const depth = await depthOf(ctx, args.parentId as unknown as string);
      if (depth >= MAX_DEPTH) throw new Error("لا يمكن التعمق أكثر من ٣ مستويات — أضف رداً في المستوى الأعلى");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("forumComments", {
      postId: args.postId,
      parentId: args.parentId as unknown as string | undefined,
      authorId: meId,
      authorName: (await ctx.db.get(meId))?.name ?? "لاعب",
      body,
      quoted: args.quoted ? cleanText(args.quoted, 200) : undefined,
      upvotes: 0,
      deleted: false,
      isAnswer: false,
      createdAt: now,
    });
    await ctx.db.patch(args.postId, { commentCount: post.commentCount + 1, lastActivityAt: now });

    if ((post.authorId as unknown as string) !== (meId as unknown as string)) {
      await notify(ctx, post.authorId as never, "💬 تعليق جديد على منشورك", `${body.slice(0, 80)}`, "info");
    }
    const subs = await ctx.db.query("forumSubscriptions").withIndex("by_post", (q) => q.eq("postId", args.postId)).take(20);
    for (const s of subs) {
      if ((s.userId as unknown as string) === (meId as unknown as string)) continue;
      if ((s.userId as unknown as string) === (post.authorId as unknown as string)) continue;
      await notify(ctx, s.userId as never, "🔔 رد جديد في منشور تتابعه", `${post.title}: ${body.slice(0, 60)}`, "info");
    }
    return { commentId };
  },
});

export const acceptAnswer = mutation({
  args: { commentId: v.id("forumComments") },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("التعليق غير موجود");
    const post = await ctx.db.get(comment.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const isAuthor = (post.authorId as unknown as string) === (meId as unknown as string);
    if (!isAuthor) throw new Error("صاحب السؤال فقط يختار أفضل جواب");
    if (postKind(post.kind).answerable === false) throw new Error("هذا النوع من المنشورات لا يقبل أفضل جواب");

    const now = Date.now();
    if (post.acceptedCommentId) {
      const prevId = ctx.db.normalizeId("forumComments", post.acceptedCommentId);
      if (prevId) await ctx.db.patch(prevId, { isAnswer: false });
    }
    await ctx.db.patch(args.commentId, { isAnswer: true });
    const limits = await readLimits(ctx);
    const q = qualityScore({
      upvotes: post.upvotes,
      downvotes: post.downvotes,
      commentCount: post.commentCount,
      body: post.body,
      tags: post.tags,
      kind: post.kind,
      createdAt: post.createdAt,
      lastActivityAt: now,
      acceptedCommentId: args.commentId as unknown as string,
      status: "answered",
    });
    await ctx.db.patch(post._id, {
      acceptedCommentId: args.commentId as unknown as string,
      status: "answered",
      lastActivityAt: now,
      qualityScore: q,
      highlighted: q >= limits.autoHighlightScore,
    });
    await notify(ctx, comment.authorId as never, "✅ اختير جوابك أفضل جواب", `في: ${post.title}`, "info");
    return { ok: true };
  },
});

export const subscribePost = mutation({
  args: { postId: v.id("forumPosts"), subscribe: v.boolean() },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const existing = await ctx.db
      .query("forumSubscriptions")
      .withIndex("by_user_post", (q) => q.eq("userId", meId).eq("postId", args.postId))
      .first();
    if (args.subscribe && !existing) {
      await ctx.db.insert("forumSubscriptions", { userId: meId, postId: args.postId, createdAt: Date.now() });
    } else if (!args.subscribe && existing) {
      await ctx.db.delete(existing._id);
    }
    return { subscribed: args.subscribe };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑩ إجراءات الإشراف (تثبيت/إغلاق/إبراز/نقل) + البلاغ
// ═══════════════════════════════════════════════════════════════════════
export const moderatePost = mutation({
  args: { postId: v.id("forumPosts"), action: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const isOwner = await isForumOwner(ctx);
    const mods = await readMods(ctx);
    const mod = moderatorFor(mods, meId, post.sectionSlug);
    if (!mod && !isOwner) throw new Error("ليست لديك صلاحية إشراف في هذا القسم");
    const actorName = (await ctx.db.get(meId))?.name ?? "مشرف";
    const reason = cleanText(args.reason ?? "", 200);
    const now = Date.now();
    const patch: Record<string, unknown> = {};
    let action = args.action;

    switch (args.action) {
      case "pin":
        if (!isOwner && !mod?.canPin) throw new Error("صلاحيتك لا تشمل التثبيت");
        patch.pinnedAt = now;
        action = "post_pinned";
        break;
      case "unpin":
        if (!isOwner && !mod?.canPin) throw new Error("صلاحيتك لا تشمل التثبيت");
        patch.pinnedAt = undefined;
        action = "post_unpinned";
        break;
      case "lock":
        if (!isOwner && !mod?.canLock) throw new Error("صلاحيتك لا تشمل الإغلاق");
        patch.lockedAt = now;
        action = "post_locked";
        break;
      case "unlock":
        if (!isOwner && !mod?.canLock) throw new Error("صلاحيتك لا تشمل الإغلاق");
        patch.lockedAt = undefined;
        action = "post_unlocked";
        break;
      case "highlight":
        if (!isOwner && !mod?.canPin) throw new Error("صلاحيتك لا تشمل الإبراز");
        patch.highlighted = true;
        action = "highlight_set";
        break;
      case "unhighlight":
        if (!isOwner && !mod?.canPin) throw new Error("صلاحيتك لا تشمل الإبراز");
        patch.highlighted = false;
        action = "highlight_cleared";
        break;
      case "restore":
        if (!isOwner && !mod?.canHide) throw new Error("صلاحيتك لا تشمل الاستعادة");
        patch.status = post.acceptedCommentId ? "answered" : "open";
        patch.hiddenAt = undefined;
        action = "post_restored";
        break;
      default:
        throw new Error("إجراء غير معروف");
    }

    await ctx.db.patch(args.postId, patch);
    await logMod(ctx, { id: meId as never, name: actorName }, action, "post", args.postId as unknown as string, reason || post.title);
    if ((post.authorId as unknown as string) !== (meId as unknown as string)) {
      await notify(ctx, post.authorId as never, "⚖️ إجراء إشرافي على منشورك", `${action}${reason ? ` — ${reason}` : ""}`, "info");
    }
    return { ok: true, action };
  },
});

export const reportPost = mutation({
  args: { postId: v.id("forumPosts"), reason: v.string(), details: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول أولاً");
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("المنشور غير موجود");
    const me = await ctx.db.get(meId);
    const mine = await ctx.db.query("reports").filter((q) => q.eq(q.field("reporterId"), meId)).take(30);
    if (mine.some((r) => r.status === "open" && (r.details ?? "").includes(`[منشور ${args.postId as unknown as string}]`))) {
      throw new Error("أبلغت عن هذا المنشور بالفعل");
    }
    await ctx.db.insert("reports", {
      reporterId: meId,
      reporterName: me?.name ?? "لاعب",
      targetId: post.authorId,
      targetName: `منشور: ${post.title} — ${post.authorName}`,
      reason: cleanText(args.reason, 120),
      details: cleanText(`[منشور ${args.postId as unknown as string}] ${args.details ?? ""}`, 400),
      status: "open",
      createdAt: Date.now(),
    });
    const mods = await readMods(ctx);
    for (const m of mods.filter((x) => x.sections.includes("*") || x.sections.includes(post.sectionSlug)).slice(0, 5)) {
      await notify(ctx, m.userId as never, "🚩 بلاغ في قسمك", `${post.title}: ${cleanText(args.reason, 60)}`, "warning");
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑪ سجل الإشراف + نبضة المالك + أدوات سيادية
// ═══════════════════════════════════════════════════════════════════════
export const getModLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return [];
    const isOwner = await isForumOwner(ctx);
    const mods = await readMods(ctx);
    const mine = mods.find((m) => m.userId === (meId as unknown as string));
    if (!isOwner && !mine) return [];
    const rows = await ctx.db.query("forumModLog").withIndex("by_at", (q) => q.gte("at", 0)).order("desc").take(Math.min(args.limit ?? 40, 100));
    return rows.map((r) => ({
      _id: r._id as unknown as string,
      actorName: r.actorName,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      details: r.details,
      at: r.at,
    }));
  },
});

export const forumOwnerPulse = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return null;
    const me = await ctx.db.get(meId);
    if (!me || !isOwnerUser(me)) return null;
    const now = Date.now();
    const posts = await ctx.db.query("forumPosts").order("desc").take(200);
    const comments = await ctx.db.query("forumComments").order("desc").take(200);
    const reports = await ctx.db.query("reports").order("desc").take(150);
    const modLog = await ctx.db.query("forumModLog").withIndex("by_at", (q) => q.gte("at", 0)).order("desc").take(40);
    const mods = await ctx.db.query("forumModerators").withIndex("by_active", (q) => q.eq("active", true)).take(50);
    const sections = await ctx.db.query("forumSections").withIndex("by_order", (q) => q.gte("order", 0)).take(50);

    const day = 24 * 60 * 60 * 1000;
    const posts24h = posts.filter((p) => now - p.createdAt < day).length;
    const comments24h = comments.filter((c) => now - c.createdAt < day).length;
    const hidden24h = posts.filter((p) => p.hiddenAt && now - p.hiddenAt < day).length;
    const authors24 = new Set(posts.filter((p) => now - p.createdAt < day).map((p) => p.authorId as unknown as string)).size;
    const openReports = reports.filter((r) => r.status === "open").length;
    const unanswered = posts.filter((p) => p.kind === "question" && !p.acceptedCommentId && p.status !== "hidden").length;

    const pulse = forumPulse({ posts24h, comments24h, openReports, hidden24h, activeAuthors24h: authors24, unansweredQuestions: unanswered });

    const bySection = sections.map((s) => {
      const list = posts.filter((p) => p.sectionSlug === s.slug);
      return {
        slug: s.slug,
        name: s.name,
        emoji: s.emoji,
        total: list.length,
        last24h: list.filter((p) => now - p.createdAt < day).length,
        locked: s.locked,
        allowPosts: s.allowPosts,
        allowPolls: s.allowPolls,
        allowComments: s.allowComments,
        minTierRank: s.minTierRank,
        postCount: s.postCount,
      };
    });

    const topAuthors = Object.entries(
      posts.reduce<Record<string, number>>((acc, p) => {
        const k = p.authorName;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      pulse,
      totals: {
        posts: posts.length,
        visible: posts.filter((p) => p.status !== "hidden").length,
        hidden: posts.filter((p) => p.status === "hidden").length,
        highlighted: posts.filter((p) => p.highlighted).length,
        comments: comments.filter((c) => !c.deleted).length,
        openReports,
        moderators: mods.length,
      },
      bySection,
      topAuthors,
      trending: trendingTags(posts.filter((p) => p.status !== "hidden").map((p) => ({ tags: p.tags, upvotes: p.upvotes, commentCount: p.commentCount, lastActivityAt: p.lastActivityAt })), now, 10),
      moderators: mods.map((m) => ({
        _id: m._id as unknown as string,
        userId: m.userId as unknown as string,
        userName: m.userName,
        sections: m.sections,
        canPin: m.canPin,
        canLock: m.canLock,
        canHide: m.canHide,
        appointedBy: m.appointedBy,
        appointedAt: m.appointedAt,
      })),
      recentModActions: modLog.map((m) => ({
        _id: m._id as unknown as string,
        actorName: m.actorName,
        action: m.action,
        targetType: m.targetType,
        details: m.details,
        at: m.at,
      })),
      needsAttention: posts
        .filter((p) => p.status !== "hidden" && p.downvotes > p.upvotes + 2)
        .slice(0, 8)
        .map((p) => ({ _id: p._id as unknown as string, title: p.title, authorName: p.authorName, upvotes: p.upvotes, downvotes: p.downvotes, commentCount: p.commentCount })),
    };
  },
});

export const ownerUpsertSection = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
    minTierRank: v.optional(v.number()),
    allowPosts: v.optional(v.boolean()),
    allowPolls: v.optional(v.boolean()),
    allowComments: v.optional(v.boolean()),
    locked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { meId, name } = await requireOwner(ctx);
    const slug = cleanText(args.slug.toLowerCase(), 24).replace(/\s+/g, "-");
    if (slug.length < 2) throw new Error("معرّف القسم غير صالح");
    const existing = await ctx.db.query("forumSections").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!existing) {
      if (!args.name) throw new Error("القسم الجديد يحتاج اسماً");
      const id = await ctx.db.insert("forumSections", {
        slug,
        name: cleanText(args.name, 40),
        emoji: cleanText(args.emoji ?? "💬", 4) || "💬",
        description: cleanText(args.description ?? "", 200),
        order: args.order ?? 50,
        minTierRank: args.minTierRank ?? 0,
        allowPosts: args.allowPosts ?? true,
        allowPolls: args.allowPolls ?? true,
        allowComments: args.allowComments ?? true,
        locked: args.locked ?? false,
        archived: false,
        postCount: 0,
        createdAt: Date.now(),
      });
      await logMod(ctx, { id: meId as never, name }, "section_created", "section", slug, cleanText(args.name, 60));
      return { sectionId: id, created: true };
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = cleanText(args.name, 40);
    if (args.emoji !== undefined) patch.emoji = cleanText(args.emoji, 4) || "💬";
    if (args.description !== undefined) patch.description = cleanText(args.description, 200);
    if (args.order !== undefined) patch.order = args.order;
    if (args.minTierRank !== undefined) patch.minTierRank = Math.max(0, Math.min(args.minTierRank, 5));
    if (args.allowPosts !== undefined) patch.allowPosts = args.allowPosts;
    if (args.allowPolls !== undefined) patch.allowPolls = args.allowPolls;
    if (args.allowComments !== undefined) patch.allowComments = args.allowComments;
    if (args.locked !== undefined) patch.locked = args.locked;
    await ctx.db.patch(existing._id, patch);
    await logMod(ctx, { id: meId as never, name }, "section_updated", "section", slug, JSON.stringify(patch).slice(0, 300));
    return { sectionId: existing._id as unknown as string, created: false };
  },
});

export const appointModerator = mutation({
  args: {
    userId: v.id("users"),
    sections: v.array(v.string()),
    canPin: v.optional(v.boolean()),
    canLock: v.optional(v.boolean()),
    canHide: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { meId, name } = await requireOwner(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("اللاعب غير موجود");
    const valid = args.sections.filter((s) => s === "*" || Boolean(sectionBySlug(s)));
    if (valid.length === 0) throw new Error("اختر قسماً صالحاً واحداً على الأقل");
    const existing = await ctx.db.query("forumModerators").withIndex("by_user", (q) => q.eq("userId", args.userId)).first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sections: valid,
        canPin: args.canPin ?? existing.canPin,
        canLock: args.canLock ?? existing.canLock,
        canHide: args.canHide ?? existing.canHide,
        active: true,
        appointedBy: name,
        appointedAt: Date.now(),
      });
      await logMod(ctx, { id: meId as never, name }, "moderator_appointed", "moderator", args.userId as unknown as string, `${target.name}: ${valid.join(",")}`);
      await notify(ctx, args.userId as never, "🧠 أصبحت مشرف ملتقى", `أقسامك: ${valid.join(" · ")}`, "system");
      return { moderatorId: existing._id as unknown as string, updated: true };
    }
    const id = await ctx.db.insert("forumModerators", {
      userId: args.userId,
      userName: target.name ?? "لاعب",
      sections: valid,
      canPin: args.canPin ?? true,
      canLock: args.canLock ?? true,
      canHide: args.canHide ?? false,
      appointedBy: name,
      active: true,
      appointedAt: Date.now(),
    });
    await logMod(ctx, { id: meId as never, name }, "moderator_appointed", "moderator", args.userId as unknown as string, `${target.name}: ${valid.join(",")}`);
    await notify(ctx, args.userId as never, "🧠 أصبحت مشرف ملتقى", `أقسامك: ${valid.join(" · ")}`, "system");
    return { moderatorId: id, updated: false };
  },
});

export const revokeModerator = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { meId, name } = await requireOwner(ctx);
    const existing = await ctx.db.query("forumModerators").withIndex("by_user", (q) => q.eq("userId", args.userId)).first();
    if (!existing) throw new Error("هذا اللاعب ليس مشرفاً");
    await ctx.db.patch(existing._id, { active: false });
    await logMod(ctx, { id: meId as never, name }, "moderator_revoked", "moderator", args.userId as unknown as string, existing.userName);
    await notify(ctx, args.userId as never, "⚖️ أُنهيت صلاحية الإشراف", "بقرار من الحاكم السيادي", "system");
    return { ok: true };
  },
});

export const ownerSetLimits = mutation({
  args: {
    allowPosts: v.optional(v.boolean()),
    allowComments: v.optional(v.boolean()),
    allowPolls: v.optional(v.boolean()),
    allowRoomsShowcase: v.optional(v.boolean()),
    minPostLength: v.optional(v.number()),
    maxPostsPerHour: v.optional(v.number()),
    autoHighlightScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { meId, name } = await requireOwner(ctx);
    const row = await ctx.db.query("forumSettings").withIndex("by_key", (q) => q.eq("key", "global")).first();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.allowPosts !== undefined) patch.allowPosts = args.allowPosts;
    if (args.allowComments !== undefined) patch.allowComments = args.allowComments;
    if (args.allowPolls !== undefined) patch.allowPolls = args.allowPolls;
    if (args.allowRoomsShowcase !== undefined) patch.allowRoomsShowcase = args.allowRoomsShowcase;
    if (args.minPostLength !== undefined) patch.minPostLength = Math.max(5, Math.min(args.minPostLength, 200));
    if (args.maxPostsPerHour !== undefined) patch.maxPostsPerHour = Math.max(1, Math.min(args.maxPostsPerHour, 50));
    if (args.autoHighlightScore !== undefined) patch.autoHighlightScore = Math.max(10, Math.min(args.autoHighlightScore, 95));
    if (row) await ctx.db.patch(row._id, patch);
    else {
      await ctx.db.insert("forumSettings", {
        key: "global",
        allowPosts: args.allowPosts ?? DEFAULT_LIMITS.allowPosts,
        allowComments: args.allowComments ?? DEFAULT_LIMITS.allowComments,
        allowPolls: args.allowPolls ?? DEFAULT_LIMITS.allowPolls,
        allowRoomsShowcase: args.allowRoomsShowcase ?? true,
        minPostLength: patch.minPostLength as number ?? DEFAULT_LIMITS.minPostLength,
        maxPostsPerHour: patch.maxPostsPerHour as number ?? DEFAULT_LIMITS.maxPostsPerHour,
        autoHighlightScore: patch.autoHighlightScore as number ?? DEFAULT_LIMITS.autoHighlightScore,
        updatedAt: Date.now(),
      });
    }
    await logMod(ctx, { id: meId as never, name }, "limits_updated", "settings", "global", JSON.stringify(patch).slice(0, 300));
    return { ok: true };
  },
});

export const ownerDeleteComment = mutation({
  args: { commentId: v.id("forumComments"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { meId, name } = await requireOwner(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("التعليق غير موجود");
    await ctx.db.patch(args.commentId, { deleted: true, body: "🗑️ حُذف هذا التعليق" });
    await logMod(ctx, { id: meId as never, name }, "comment_deleted", "comment", args.commentId as unknown as string, cleanText(args.reason ?? comment.body, 120));
    return { ok: true };
  },
});

export const isForumModerator = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return { isModerator: false, isOwner: false, sections: [] as string[] };
    const mods = await readMods(ctx);
    const mine = mods.find((m) => m.userId === (meId as unknown as string));
    return {
      isModerator: Boolean(mine),
      isOwner: await isForumOwner(ctx),
      sections: mine?.sections ?? [],
    };
  },
});
