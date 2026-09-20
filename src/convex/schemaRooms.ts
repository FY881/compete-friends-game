import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ v10.0 — جداول «الغرف الخاصة المتقدمة» و«ملتقى العقول»
 *
 * تُدمَج في مخطط اللعبة عبر `...roomForumTables` في schemaExtra.ts،
 * فلا نلمس الجداول القديمة (chatRooms/chatMessages) ولا نكسر أي غرفة قائمة.
 *
 *  الغرف الخاصة:
 *  1. roomProfiles      — الطبقة المتقدمة لكل غرفة (نوع، خصوصية، حدود، أدوار، إعدادات)
 *  2. roomInvites       — دعوات بروابط محدودة الاستخدام والصلاحية
 *  3. roomTopics        — مواضيع داخل الغرفة لتقسيم النقاش
 *  4. roomTopicLinks    — ربط الرسائل بمواضيعها (بدون تعديل جدول الرسائل)
 *  5. roomAudit         — سجل كامل لكل إجراء داخل الغرفة
 *  6. roomModNotes      — مذكرات الإشراف داخل الغرفة (سبب التقييد/الطرد)
 *
 *  ملتقى العقول:
 *  7. forumSections     — أقسام الملتقى
 *  8. forumPosts        — المنشورات
 *  9. forumComments     — التعليقات (ردود متفرعة + اقتباس)
 * 10. forumVotes        — التصويتات (يمنع التصويت المكرر فعلياً)
 * 11. forumModerators   — مشرفو الملتقى المعيّنون من المالك
 * 12. forumSubscriptions— متابعة منشور → إشعارات ذكية
 * 13. forumModLog       — سجل إجراءات الإشراف
 * 14. forumSettings     — إعدادات الملتقى العامة (وثيقة واحدة يضبطها المالك)
 * ═══════════════════════════════════════════════════════════════════════
 */
export const roomForumTables = {
  // ═══════════════════════════════════════════════════════════════════════
  // ║ ① الطبقة المتقدمة للغرفة — مصدر الحقيقة لكل إعدادات v10.0          ║
  // ═══════════════════════════════════════════════════════════════════════
  roomProfiles: defineTable({
    roomId: v.id("chatRooms"),
    /** open | private | group | membership | clan | event | temporary | duel */
    kind: v.string(),
    /** open | invite | membership | clan | event */
    visibility: v.string(),
    avatar: v.string(), // إيموجي الغرفة
    bannerTone: v.string(), // emerald | sky | violet | amber | rose | slate
    tags: v.array(v.string()),
    rules: v.string(), // قوانين الغرفة الخاصة (تُفرض مع قوانين المجتمع)
    welcomeMessage: v.string(),
    memberLimit: v.number(), // 0 = حسب الرتبة
    requiresTier: v.string(), // أدنى رتبة عضوية للانضمام
    clanId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    /** 0 = دائمة */
    expiresAt: v.number(),
    permanent: v.boolean(),
    slowModeSec: v.number(),
    /** normal | watch | locked | closed — قرار الإدارة السيادي */
    moderationState: v.string(),
    moderationNote: v.optional(v.string()),
    /** { userId: owner|admin|moderator|member|restricted } */
    memberRoles: v.any(),
    /** { role: { permission: boolean } } — صلاحيات قابلة للتخصيص لكل دور */
    rolePerms: v.any(),
    pinnedMessageIds: v.array(v.string()),
    featured: v.boolean(), // تُعرض في ملتقى العقول
    challengeReward: v.number(), // عملات لتحدّي الغرفة
    messageCount: v.number(),
    joinCount: v.number(),
    lastActivityAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_kind", ["kind", "lastActivityAt"])
    .index("by_featured", ["featured", "lastActivityAt"])
    .index("by_expiry", ["expiresAt"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ② دعوات الغرف — رابط بكود محدود الاستخدام والصلاحية                  ║
  // ═══════════════════════════════════════════════════════════════════════
  roomInvites: defineTable({
    roomId: v.id("chatRooms"),
    code: v.string(),
    createdBy: v.id("users"),
    createdByName: v.string(),
    maxUses: v.number(), // 0 = بلا حد
    uses: v.number(),
    expiresAt: v.number(), // 0 = بلا انتهاء
    revoked: v.boolean(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_room", ["roomId", "createdAt"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ③ مواضيع الغرفة — مسارات نقاش منفصلة داخل الغرفة الواحدة            ║
  // ═══════════════════════════════════════════════════════════════════════
  roomTopics: defineTable({
    roomId: v.id("chatRooms"),
    title: v.string(),
    createdBy: v.id("users"),
    createdByName: v.string(),
    status: v.string(), // open | closed
    pinned: v.boolean(),
    messageCount: v.number(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId", "lastMessageAt"])
    .index("by_room_pinned", ["roomId", "pinned"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ④ ربط الرسائل بالمواضيع (بلا تعديل جدول الرسائل القديم)             ║
  // ═══════════════════════════════════════════════════════════════════════
  roomTopicLinks: defineTable({
    roomId: v.id("chatRooms"),
    topicId: v.id("roomTopics"),
    messageId: v.id("chatMessages"),
    at: v.number(),
  })
    .index("by_topic", ["topicId", "at"])
    .index("by_room", ["roomId", "at"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑤ سجل إجراءات الغرفة — شفافية كاملة للاعب وللمالك                    ║
  // ═══════════════════════════════════════════════════════════════════════
  roomAudit: defineTable({
    roomId: v.id("chatRooms"),
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    action: v.string(),
    details: v.string(),
    source: v.string(), // member | room_owner | owner | ai | system
    at: v.number(),
  })
    .index("by_room", ["roomId", "at"])
    .index("by_at", ["at"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑥ مذكرات الإشراف داخل الغرفة — سبب مكتوب لكل تقييد/طرد              ║
  // ═══════════════════════════════════════════════════════════════════════
  roomModNotes: defineTable({
    roomId: v.id("chatRooms"),
    targetId: v.id("users"),
    targetName: v.string(),
    actorId: v.id("users"),
    actorName: v.string(),
    action: v.string(), // warn | mute | restrict | kick | unmute
    reason: v.string(),
    until: v.number(), // 0 = دائم/بلا مدة
    createdAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_target", ["targetId", "createdAt"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑥ب v11.0 — استطلاعات الغرف: كانت مجرد صلاحية بلا وظيفة، صارت نظاماً  ║
  // ═══════════════════════════════════════════════════════════════════════
  roomPolls: defineTable({
    roomId: v.id("chatRooms"),
    question: v.string(),
    /** { id, label, votes } — الأصوات تُحدَّث في نفس الصف عند كل تصويت */
    options: v.array(v.object({ id: v.string(), label: v.string(), votes: v.number() })),
    /** multi = يختار أكثر من خيار (بحدّ maxChoices) */
    multi: v.boolean(),
    maxChoices: v.number(),
    createdBy: v.id("users"),
    createdByName: v.string(),
    closed: v.boolean(),
    expiresAt: v.number(), // 0 = بلا انتهاء
    totalVotes: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room", ["roomId", "createdAt"])
    .index("by_room_open", ["roomId", "closed", "createdAt"])
    .index("by_closed", ["closed", "updatedAt"]),

  roomPollVotes: defineTable({
    pollId: v.id("roomPolls"),
    roomId: v.id("chatRooms"),
    userId: v.id("users"),
    userName: v.string(),
    choices: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_poll_user", ["pollId", "userId"])
    .index("by_poll", ["pollId", "updatedAt"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑦ ملتقى العقول — أقسام                                                 ║
  // ═══════════════════════════════════════════════════════════════════════
  forumSections: defineTable({
    slug: v.string(),
    name: v.string(),
    emoji: v.string(),
    description: v.string(),
    order: v.number(),
    minTierRank: v.number(), // 0 = متاح للجميع
    allowPosts: v.boolean(),
    allowPolls: v.boolean(),
    allowComments: v.boolean(),
    locked: v.boolean(),
    archived: v.boolean(),
    postCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑧ ملتقى العقول — المنشورات                                            ║
  // ═══════════════════════════════════════════════════════════════════════
  forumPosts: defineTable({
    sectionId: v.id("forumSections"),
    sectionSlug: v.string(),
    authorId: v.id("users"),
    authorName: v.string(),
    title: v.string(),
    body: v.string(),
    kind: v.string(), // discussion | question | idea | challenge | poll | announcement | room
    tags: v.array(v.string()),
    roomId: v.optional(v.id("chatRooms")),
    challenge: v.optional(
      v.object({
        difficulty: v.string(),
        reward: v.number(),
        questionCount: v.number(),
        /** كود اللعب الحقيقي في الساحة (/arena?challenge=CODE) */
        code: v.optional(v.string()),
      }),
    ),
    poll: v.optional(
      v.object({
        options: v.array(v.object({ id: v.string(), label: v.string(), votes: v.number() })),
        multi: v.boolean(),
        endsAt: v.number(),
      }),
    ),
    upvotes: v.number(),
    downvotes: v.number(),
    commentCount: v.number(),
    viewCount: v.number(),
    qualityScore: v.number(),
    highlighted: v.boolean(),
    pinnedAt: v.optional(v.number()),
    lockedAt: v.optional(v.number()),
    hiddenAt: v.optional(v.number()),
    hiddenBy: v.optional(v.string()),
    acceptedCommentId: v.optional(v.string()),
    status: v.string(), // open | answered | closed | hidden
    createdAt: v.number(),
    lastActivityAt: v.number(),
  })
    .index("by_section_activity", ["sectionSlug", "lastActivityAt"])
    .index("by_activity", ["lastActivityAt"])
    .index("by_author", ["authorId", "createdAt"])
    .index("by_quality", ["qualityScore"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑨ ملتقى العقول — التعليقات (ردود متفرعة + اقتباس)                    ║
  // ═══════════════════════════════════════════════════════════════════════
  forumComments: defineTable({
    postId: v.id("forumPosts"),
    parentId: v.optional(v.string()),
    authorId: v.id("users"),
    authorName: v.string(),
    body: v.string(),
    quoted: v.optional(v.string()),
    upvotes: v.number(),
    deleted: v.boolean(),
    isAnswer: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_post", ["postId", "createdAt"])
    .index("by_author", ["authorId"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑩ ملتقى العقول — التصويتات (تصويت واحد لكل لاعب لكل هدف)             ║
  // ═══════════════════════════════════════════════════════════════════════
  forumVotes: defineTable({
    targetType: v.string(), // post | comment | poll
    targetId: v.string(),
    userId: v.id("users"),
    value: v.number(), // 1 | -1
    createdAt: v.number(),
  })
    .index("by_target_user", ["targetType", "targetId", "userId"])
    .index("by_user", ["userId"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑪ ملتقى العقول — مشرفو الملتقى (تعيين من المالك بصلاحيات محددة)       ║
  // ═══════════════════════════════════════════════════════════════════════
  forumModerators: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    sections: v.array(v.string()), // ["*"] = كل الأقسام
    canPin: v.boolean(),
    canLock: v.boolean(),
    canHide: v.boolean(),
    appointedBy: v.string(),
    active: v.boolean(),
    appointedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_active", ["active"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑫ ملتقى العقول — المتابعات (إشعارات ذكية عند ردود جديدة)             ║
  // ═══════════════════════════════════════════════════════════════════════
  forumSubscriptions: defineTable({
    userId: v.id("users"),
    postId: v.id("forumPosts"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_post", ["postId"])
    .index("by_user_post", ["userId", "postId"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑬ ملتقى العقول — سجل إجراءات الإشراف                                  ║
  // ═══════════════════════════════════════════════════════════════════════
  forumModLog: defineTable({
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    action: v.string(),
    targetType: v.string(), // post | comment | section | moderator | settings
    targetId: v.string(),
    details: v.string(),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_actor", ["actorId", "at"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑭ ملتقى العقول — إعدادات عامة يضبطها المالك (وثيقة واحدة)            ║
  // ═══════════════════════════════════════════════════════════════════════
  forumSettings: defineTable({
    key: v.string(), // "global"
    allowPosts: v.boolean(),
    allowComments: v.boolean(),
    allowPolls: v.boolean(),
    allowRoomsShowcase: v.boolean(),
    minPostLength: v.number(),
    maxPostsPerHour: v.number(),
    autoHighlightScore: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ ⑮ v11.0 — التحدّيات الحقيقية: غرفة أو ملتقى ⇒ تُلعَب في الساحة       ║
  // ║ مصدر الحقيقة الواحد: وعدُ المكافأة لا يُصدَّق إلا من هنا              ║
  // ═══════════════════════════════════════════════════════════════════════
  challenges: defineTable({
    code: v.string(),
    source: v.string(), // room | forum
    roomId: v.optional(v.id("chatRooms")),
    postId: v.optional(v.id("forumPosts")),
    clanId: v.optional(v.string()), // إن كان التحدّي داخل غرفة عشيرة ⇒ خزنتها تُموَّل
    title: v.string(),
    note: v.string(),
    difficulty: v.string(), // easy | medium | hard | expert
    questionCount: v.number(),
    rewardXp: v.number(),
    rewardCoins: v.number(),
    createdBy: v.id("users"),
    createdByName: v.string(),
    status: v.string(), // open | closed
    expiresAt: v.number(), // 0 = بلا انتهاء
    plays: v.number(),
    completions: v.number(),
    rewardedCount: v.number(),
    xpGranted: v.number(),
    bestScore: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_room", ["roomId", "createdAt"])
    .index("by_source", ["source", "createdAt"])
    .index("by_status_expiry", ["status", "expiresAt"])
    .index("by_creator", ["createdBy", "createdAt"]),

  challengeRuns: defineTable({
    challengeId: v.id("challenges"),
    code: v.string(),
    userId: v.id("users"),
    userName: v.string(),
    correct: v.number(),
    total: v.number(),
    score: v.number(),
    durationMs: v.number(),
    suspicious: v.boolean(),
    xpAwarded: v.number(),
    coinsAwarded: v.number(),
    grade: v.string(), // fail | bronze | silver | gold | perfect
    createdAt: v.number(),
  })
    .index("by_challenge", ["challengeId", "createdAt"])
    .index("by_challenge_user", ["challengeId", "userId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_code", ["code", "createdAt"]),
};
