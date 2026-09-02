import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Room settings chosen by the host before the game starts. */
export const gameSettingsValidator = v.object({
  questionCount: v.number(), // 3 | 5 | 7 | 10
  timePerQuestionMs: v.number(), // 10s | 15s | 20s | 30s
  categories: v.array(v.string()), // empty array = all categories
});

/** One recorded answer inside a player's answers array. */
export const answerValidator = v.object({
  questionId: v.string(),
  selected: v.number(),
  correct: v.boolean(),
  points: v.number(),
  elapsedMs: v.number(),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      avatarEmoji: v.optional(v.string()), // chosen avatar emoji (e.g. 🦅) shown on profile & leaderboard

      role: v.optional(roleValidator), // role of the user. do not remove

      // ── Discipline & punishment state (managed by the owner room) ──
      warnings: v.optional(v.number()), // formal warnings issued
      mutedUntil: v.optional(v.number()), // ms timestamp — chat muted until this time
      bannedUntil: v.optional(v.number()), // ms timestamp — account suspended until this time
      bannedPermanent: v.optional(v.boolean()), // permanent ban flag
      banReason: v.optional(v.string()), // why the user was punished
      cheatStrikes: v.optional(v.number()), // anti-cheat detections (tab-switch while answering)
      lastWarningAt: v.optional(v.number()), // when the last formal warning was issued (used by the auto-admin to decay old warnings)
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // The site laws: essential rules, prohibitions and the punishment ladder.
    // Editable by the owner, shown publicly on /rules.
    rules: defineTable({
      title: v.string(),
      category: v.union(
        v.literal("essential"), // قوانين أساسية
        v.literal("prohibited"), // ممنوعات
        v.literal("punishment"), // العقوبات
      ),
      description: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      order: v.number(),
      active: v.boolean(),
    }).index("by_category", ["category"]),

    // User-submitted reports against other players.
    reports: defineTable({
      reporterId: v.id("users"),
      reporterName: v.string(),
      targetId: v.id("users"),
      targetName: v.string(),
      reason: v.string(),
      details: v.optional(v.string()),
      status: v.union(
        v.literal("open"), // awaiting review
        v.literal("reviewed"), // AI/owner decided and acted
        v.literal("dismissed"), // no violation found
      ),
      aiVerdict: v.optional(
        v.object({
          compliant: v.boolean(),
          violation: v.optional(v.string()),
          severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
          suggestedAction: v.union(
            v.literal("none"),
            v.literal("warn"),
            v.literal("mute"),
            v.literal("ban"),
          ),
          suggestedDurationMs: v.optional(v.number()),
          reasoning: v.string(),
        }),
      ),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"]),

    // Every punishment / AI decision, for the owner's audit log.
    moderationLogs: defineTable({
      actorType: v.union(v.literal("ai"), v.literal("owner"), v.literal("system")),
      actorName: v.string(),
      action: v.string(), // e.g. warn | mute | ban | pardon | cheat | review
      targetId: v.optional(v.id("users")),
      targetName: v.string(),
      reason: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      gameCode: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // Simple key/value store for owner-configurable settings.
    settings: defineTable({
      key: v.string(),
      value: v.string(), // JSON-encoded value
    }).index("by_key", ["key"]),

    // A competitive challenge room created by a host.
    games: defineTable({
      code: v.string(), // short join code (e.g. "K7P2MX")
      hostId: v.id("users"), // the user who created the game
      status: v.union(
        v.literal("waiting"), // lobby, friends can join
        v.literal("playing"), // questions in progress
        v.literal("finished"), // results are shown
      ),
      phase: v.union(
        v.literal("countdown"), // 3-2-1 before the first question
        v.literal("answering"), // answer window is open
        v.literal("revealing"), // showing correct answer before next question
      ),
      questionIds: v.array(v.string()), // ids into the shared QUESTION_BANK
      currentQuestionIndex: v.number(),
      questionStartedAt: v.number(), // server timestamp when the current question started
      firstCorrect: v.optional(v.array(v.union(v.string(), v.null()))), // per-question first correct userId
      createdAt: v.number(),
      settings: gameSettingsValidator, // room rules chosen by the host
      rematchOf: v.optional(v.id("games")), // set when this game is a rematch of another
    })
      .index("by_code", ["code"])
      .index("by_host", ["hostId"])
      .index("by_rematch", ["rematchOf"]),

    // One row per player per game.
    gamePlayers: defineTable({
      gameId: v.id("games"),
      userId: v.id("users"),
      name: v.string(), // display name taken when joining
      score: v.number(),
      streak: v.number(), // current consecutive correct answers
      bestStreak: v.number(), // longest streak reached in this game
      answers: v.array(
        v.union(
          v.null(),
          v.object({
            questionId: v.string(),
            selected: v.number(),
            correct: v.boolean(),
            points: v.number(),
            elapsedMs: v.number(),
          }),
        ),
      ), // per-question answers indexed by question number
      fiftyFiftyUsedFor: v.optional(v.number()), // question index where 50/50 was used
      secondChanceUsedFor: v.optional(v.number()), // question index where the second-chance retry was used (فرصة ثانية)
      joinedAt: v.number(),
    })
      .index("by_game", ["gameId"])
      .index("by_user_game", ["userId", "gameId"]),

    // Per-user progression: XP, level, lifetime stats and earned badges.
    profiles: defineTable({
      userId: v.id("users"),
      xp: v.number(),
      gamesPlayed: v.number(),
      gamesWon: v.number(),
      bestScore: v.number(),
      bestStreak: v.number(),
      correctAnswers: v.number(),
      totalAnswers: v.number(),
      fastestAnswerMs: v.optional(v.number()),
      badges: v.array(v.string()),
      // Daily rewards: a login streak that grants XP + badges each day.
      dailyStreak: v.optional(v.number()), // consecutive days the reward was claimed
      lastClaimDay: v.optional(v.string()), // YYYY-MM-DD of the last daily claim
      lastPlayedDay: v.optional(v.string()), // YYYY-MM-DD of the last finished game
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_xp", ["xp"]),

    // Reports produced by the autonomous AI administrator (runs every 15 min).
    // Each sweep reviews open reports, applies punishments, cleans stale
    // rooms and writes a fix-ready report the owner can hand to the dev.
    adminReports: defineTable({
      summary: v.string(), // one-line Arabic summary of the sweep
      stats: v.object({
        reportsReviewed: v.number(),
        punishmentsApplied: v.number(),
        roomsCleaned: v.number(),
        usersEscalated: v.number(),
        bannedUsers: v.number(),
        activeRooms: v.number(),
        openReportsLeft: v.number(),
        autoFixes: v.number(), // autonomous fixes applied by the sweep (spam warns, decay, cleanups, countdown rescue)
        downloadFailures: v.number(), // failed APK downloads reported in the last 24h
      }),
      issues: v.array(
        v.object({
          severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
          title: v.string(),
          detail: v.string(),
          fix: v.string(), // actionable fix, often a code snippet to hand to the dev
        }),
      ),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // One row per player per finished game, for history & the profile page.
    gameHistory: defineTable({
      gameId: v.id("games"),
      userId: v.id("users"),
      gameCode: v.string(),
      rank: v.number(),
      playerCount: v.number(),
      score: v.number(),
      correctCount: v.number(),
      questionCount: v.number(),
      xpEarned: v.number(),
      won: v.boolean(),
      stars: v.optional(v.number()), // 1-3 stars rating for the round
      badgesEarned: v.array(v.string()), // badges unlocked by this result
      firstOfDay: v.optional(v.boolean()), // true when this round earned the first-game-of-the-day bonus
      playedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_game", ["gameId"])
      .index("by_user_game", ["userId", "gameId"]),

    // Live emoji reactions inside a game lobby — friends hype each other up.
    reactions: defineTable({
      gameId: v.id("games"),
      name: v.string(), // reacting player's display name
      emoji: v.string(), // one emoji (e.g. 🔥 😂 🎉)
      createdAt: v.number(),
    }).index("by_game", ["gameId"]),

    // Automated reports of failed APK downloads, sent by the client so the
    // auto-admin sweep can diagnose & fix download issues without human help.
    downloadReports: defineTable({
      userId: v.id("users"),
      userName: v.string(),
      url: v.string(), // which candidate URL was tried
      receivedSize: v.optional(v.number()),
      receivedHash: v.optional(v.string()),
      expectedSize: v.optional(v.number()),
      expectedHash: v.optional(v.string()),
      error: v.string(),
      userAgent: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // «تحدي اليوم» — one row per player per calendar day (best attempt kept).
    dailyChallenges: defineTable({
      userId: v.id("users"),
      day: v.string(), // YYYY-MM-DD
      score: v.number(), // best score achieved that day
      correctCount: v.number(),
      bestStreak: v.number(),
      xpEarned: v.number(),
      playedAt: v.number(),
    })
      .index("by_user_day", ["userId", "day"])
      .index("by_day", ["day"]),

    // أسئلة يولّدها الذكاء الاصطناعي (OpenRouter) — تنتظر مراجعة المالك
    // ثم تدخل بنك الأسئلة الحي. لا تُحذف أبداً (تبقى مرجعاً للجولات
    // الجارية)، وحالتها فقط تتغير.
    aiQuestions: defineTable({
      qid: v.string(), // custom id مثل "ai-1a2b3c" — يُخزَّن في games.questionIds
      category: v.string(), // must be one of CATEGORIES
      difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
      question: v.string(),
      options: v.array(v.string()), // exactly 4
      correctIndex: v.number(), // 0-3
      status: v.union(
        v.literal("pending"), // بانتظار مراجعة المالك
        v.literal("approved"), // معتمدة وتدخل الجولات
        v.literal("rejected"), // مرفوضة — لا تدخل جولات جديدة
      ),
      createdAt: v.number(),
    })
      .index("by_qid", ["qid"])
      .index("by_status", ["status"])
      .index("by_category_status", ["category", "status"]),

    // أخطاء جافاسكريبت تلقائية من أجهزة اللاعبين (تُلتقط من المتصفح/التطبيق
    // وتصل هنا ليراجعها المالك — فلا يتكرر أي خطأ غامض دون أثر).
    clientErrors: defineTable({
      key: v.string(), // message + stack مقطوعان — للتجميع/منع التكرار
      message: v.string(),
      stack: v.optional(v.string()),
      url: v.optional(v.string()),
      route: v.optional(v.string()),
      count: v.number(), // كم مرة تكرر الخطأ
      firstSeen: v.number(),
      lastSeen: v.number(),    }).index("by_key", ["key"])
      .index("by_last", ["lastSeen"]),

    // حالة ملف APK الرسمي في تخزين Convex الدائم: يُحمَّل من المرآة الموثّقة
    // ثم يُخزَّن هنا بعد التحقق من الحجم والبصمة — فيبقى التنزيل متاحاً
    // ببايتات مطابقة للبصمة الرسمية مهما تعطّل خادم الملفات الثابت.
    apkRelease: defineTable({
      key: v.string(), // "current"
      storageId: v.optional(v.string()),
      storageUrl: v.optional(v.string()),
      size: v.optional(v.number()),
      sha256: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      lastSyncAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
    }).index("by_key", ["key"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام العضويات المتعددة (فضي/ذهبي/ماسي/خاصة) ║
    // ═══════════════════════════════════════════════════════════════════════
    memberships: defineTable({
      userId: v.id("users"),
      tier: v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("diamond"),
        v.literal("exclusive"),
      ),
      activatedAt: v.number(),
      expiresAt: v.optional(v.number()), // null = permanent
      codeUsed: v.optional(v.string()),
      features: v.array(v.string()),
    }).index("by_user", ["userId"]).index("by_tier", ["tier"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ أكواد العضوية (تُصدر من غرفة المالك) ║
    // ═══════════════════════════════════════════════════════════════════════
    membershipCodes: defineTable({
      code: v.string(),
      tier: v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("diamond"),
        v.literal("exclusive"),
      ),
      durationDays: v.optional(v.number()), // null = permanent
      maxUses: v.number(),
      usedCount: v.number(),
      usedBy: v.array(v.id("users")),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_code", ["code"]).index("by_active", ["active"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ غرف المناقشة المتطورة ║
    // ═══════════════════════════════════════════════════════════════════════
    chatRooms: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      type: v.union(
        v.literal("public"),
        v.literal("private"),
        v.literal("password"),
        v.literal("invite"),
      ),
      password: v.optional(v.string()),
      inviteCode: v.optional(v.string()),
      ownerId: v.id("users"),
      members: v.array(v.id("users")),
      admins: v.array(v.id("users")),
      pinnedMessageId: v.optional(v.string()),
      archived: v.boolean(),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ رسائل المناقشة ║
    // ═══════════════════════════════════════════════════════════════════════
    chatMessages: defineTable({
      roomId: v.id("chatRooms"),
      senderId: v.id("users"),
      senderName: v.string(),
      content: v.string(),
      type: v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("poll"),
        v.literal("system"),
        v.literal("voice"),
        v.literal("forward"),
      ),
      pinned: v.boolean(),
      deleted: v.boolean(),
      reactions: v.array(v.object({ emoji: v.string(), userId: v.id("users") })),
      replyTo: v.optional(v.string()),
      forwardFrom: v.optional(v.object({
        senderName: v.string(),
        roomName: v.string(),
        originalContent: v.string(),
      })),
      edited: v.optional(v.boolean()),
      editedAt: v.optional(v.number()),
      bookmarked: v.optional(v.boolean()),
      mentionIds: v.optional(v.array(v.id("users"))),
      moderationStatus: v.optional(v.union(
        v.literal("passed"),
        v.literal("flagged"),
        v.literal("blocked"),
      )),
      moderationReason: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_room", ["roomId"]).index("by_sender", ["senderId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مؤشرات الكتابة (حية) ║
    // ═══════════════════════════════════════════════════════════════════════
    typingStatus: defineTable({
      roomId: v.id("chatRooms"),
      userId: v.id("users"),
      userName: v.string(),
      typingUntil: v.number(),
    }).index("by_room", ["roomId"]).index("by_user_room", ["userId", "roomId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ الرسائل المحفوظة / المفضلة ║
    // ═══════════════════════════════════════════════════════════════════════
    savedMessages: defineTable({
      userId: v.id("users"),
      messageId: v.id("chatMessages"),
      roomId: v.id("chatRooms"),
      content: v.string(),
      senderName: v.string(),
      savedAt: v.number(),
    }).index("by_user", ["userId"]).index("by_user_message", ["userId", "messageId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ الإشعارات الفورية ║
    // ═══════════════════════════════════════════════════════════════════════
    notifications: defineTable({
      userId: v.union(v.literal("__all__"), v.id("users")),
      title: v.string(),
      body: v.string(),
      type: v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("ban"),
        v.literal("update"),
        v.literal("system"),
      ),
      read: v.boolean(),
      actionUrl: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_read", ["read"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ التوكنات المؤقتة للصلاحيات ║
    // ═══════════════════════════════════════════════════════════════════════
    permissionTokens: defineTable({
      token: v.string(),
      userId: v.id("users"),
      permissions: v.array(v.string()),
      permanent: v.boolean(),
      expiresAt: v.optional(v.number()),
      usedCount: v.number(),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_token", ["token"]).index("by_user", ["userId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ سجل أفعال المالك ║
    // ═══════════════════════════════════════════════════════════════════════
    ownerActions: defineTable({
      action: v.string(),
      targetUserId: v.optional(v.id("users")),
      targetName: v.optional(v.string()),
      details: v.string(),
      reversible: v.boolean(),
      undone: v.boolean(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نسخ احتياطي لبيانات اللاعب ║
    // ═══════════════════════════════════════════════════════════════════════
    playerBackups: defineTable({
      userId: v.id("users"),
      backupData: v.string(), // JSON string of profile + history
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ وضع الصيانة ║
    // ═══════════════════════════════════════════════════════════════════════
    maintenanceMode: defineTable({
      active: v.boolean(),
      message: v.string(),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
    }).index("by_active", ["active"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ أرشيف الأسئلة الشخصية ║
    // ═══════════════════════════════════════════════════════════════════════
    questionArchive: defineTable({
      userId: v.id("users"),
      questionId: v.string(),
      category: v.string(),
      question: v.string(),
      options: v.array(v.string()),
      correctIndex: v.number(),
      wasCorrect: v.boolean(),
      favorited: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_fav", ["userId", "favorited"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام الهدايا ║
    // ═══════════════════════════════════════════════════════════════════════
    gifts: defineTable({
      senderId: v.id("users"),
      senderName: v.string(),
      receiverId: v.id("users"),
      receiverName: v.string(),
      giftType: v.string(), // xp, badge, emoji, etc
      message: v.optional(v.string()),
      xpAmount: v.optional(v.number()),
      claimed: v.boolean(),
      createdAt: v.number(),
    }).index("by_receiver", ["receiverId"]).index("by_sender", ["senderId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام الدعوات ║
    // ═══════════════════════════════════════════════════════════════════════
    invites: defineTable({
      inviterId: v.id("users"),
      inviteeId: v.optional(v.id("users")),
      code: v.string(),
      used: v.boolean(),
      rewardClaimed: v.boolean(),
      createdAt: v.number(),
    }).index("by_code", ["code"]).index("by_inviter", ["inviterId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام السمعة ║
    // ═══════════════════════════════════════════════════════════════════════
    reputation: defineTable({
      userId: v.id("users"),
      score: v.number(), // -100 to +100
      positiveVotes: v.number(),
      negativeVotes: v.number(),
      lastVoteAt: v.number(),
    }).index("by_user", ["userId"]).index("by_score", ["score"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ تحدي الذكاء اليومي ║
    // ═══════════════════════════════════════════════════════════════════════
    dailyChallengeBoard: defineTable({
      day: v.string(), // YYYY-MM-DD
      topPlayers: v.array(v.object({
        userId: v.id("users"),
        name: v.string(),
        score: v.number(),
      })),
      totalPlayers: v.number(),
      avgScore: v.number(),
    }).index("by_day", ["day"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ تحديات1v1 ║
    // ═══════════════════════════════════════════════════════════════════════
    duels: defineTable({
      challengerId: v.id("users"),
      challengerName: v.string(),
      opponentId: v.optional(v.id("users")),
      opponentName: v.optional(v.string()),
      status: v.union(
        v.literal("waiting"),
        v.literal("active"),
        v.literal("finished"),
      ),
      challengerScore: v.number(),
      opponentScore: v.number(),
      questionCount: v.number(),
      currentQuestion: v.number(),
      winnerId: v.optional(v.id("users")),
      createdAt: v.number(),
    }).index("by_status", ["status"]).index("by_challenger", ["challengerId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ الإنجازات المتقدمة ║
    // ═══════════════════════════════════════════════════════════════════════
    achievements: defineTable({
      userId: v.id("users"),
      type: v.string(), // e.g. "first_win", "streak_10", "perfect_score"
      name: v.string(),
      description: v.string(),
      icon: v.string(),
      rarity: v.union(
        v.literal("common"),
        v.literal("uncommon"),
        v.literal("rare"),
        v.literal("epic"),
        v.literal("legendary"),
      ),
      xpReward: v.number(),
      earnedAt: v.number(),
    }).index("by_user", ["userId"]).index("by_type", ["type"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام المواسم ║
    // ═══════════════════════════════════════════════════════════════════════
    seasons: defineTable({
      name: v.string(),
      number: v.number(),
      startAt: v.number(),
      endAt: v.number(),
      rewards: v.array(v.object({
        rank: v.number(),
        badge: v.string(),
        xp: v.number(),
      })),
      active: v.boolean(),
    }).index("by_active", ["active"]),

    seasonScores: defineTable({
      userId: v.id("users"),
      seasonNumber: v.number(),
      totalScore: v.number(),
      gamesPlayed: v.number(),
      wins: v.number(),
    }).index("by_season", ["seasonNumber"]).index("by_user_season", ["userId", "seasonNumber"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نظام مفاتيح API الخاصة بالمالك ║
    // ═══════════════════════════════════════════════════════════════════════
    apiKeys: defineTable({
      name: v.string(),
      provider: v.string(), // openrouter, openai, custom, etc
      key: v.string(),
      active: v.boolean(),
      lastUsedAt: v.optional(v.number()),
      useCount: v.number(),
      createdAt: v.number(),
    }).index("by_provider", ["provider"]).index("by_active", ["active"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ قوانين اللعب الأونلاين ║
    // ═══════════════════════════════════════════════════════════════════════
    onlineRules: defineTable({
      title: v.string(),
      description: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      autoAction: v.union(
        v.literal("none"),
        v.literal("warn"),
        v.literal("mute"),
        v.literal("kick"),
        v.literal("ban"),
      ),
      active: v.boolean(),
      order: v.number(),
      createdAt: v.number(),
    }).index("by_active", ["active"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ الأهداف الجماعية (العقل الجمعي) ║
    // ═══════════════════════════════════════════════════════════════════════
    collectiveGoals: defineTable({
      title: v.string(),
      description: v.string(),
      targetScore: v.number(),
      currentScore: v.number(),
      participants: v.array(v.id("users")),
      reward: v.string(),
      active: v.boolean(),
      deadline: v.number(),
      createdAt: v.number(),
    }).index("by_active", ["active"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ ذاكرة AI حر الدائمة ║
    // ═══════════════════════════════════════════════════════════════════════
    aiFreeMemory: defineTable({
      sessionId: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      metadata: v.optional(v.string()), // JSON string for extra data
      createdAt: v.number(),
    }).index("by_session", ["sessionId"]).index("by_time", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ سجل أوامر AI حر التنفيذية ║
    // ═══════════════════════════════════════════════════════════════════════
    aiFreeCommands: defineTable({
      command: v.string(),
      result: v.string(),
      success: v.boolean(),
      executedAt: v.number(),
    }).index("by_time", ["executedAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ صياد الأخطاء — سجل الأخطاء المُلتقطة ║
    // ═══════════════════════════════════════════════════════════════════════
    errorLogs: defineTable({
      fingerprint: v.string(), // hash من message + component — للتجميع
      message: v.string(),
      stack: v.optional(v.string()),
      component: v.optional(v.string()), // المكون الذي أخطأ
      route: v.optional(v.string()), // المسار الحالي
      url: v.optional(v.string()),
      severity: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical"),
      ),
      category: v.string(), // hooks_violation | chunk_load | network | api | render | unknown
      autoHealed: v.boolean(),
      healStrategy: v.optional(v.string()),
      healResult: v.optional(v.string()), // success | failed | skipped
      userId: v.optional(v.id("users")),
      deviceInfo: v.optional(v.string()), // UA مختصر
      count: v.number(), // عدد التكرارات المجمّعة
      firstSeen: v.number(),
      lastSeen: v.number(),
      resolved: v.boolean(),
      resolvedBy: v.optional(v.string()), // auto | owner | unknown
      createdAt: v.number(),
    })
      .index("by_fingerprint", ["fingerprint"])
      .index("by_severity", ["severity"])
      .index("by_created", ["createdAt"])
      .index("by_unresolved", ["resolved", "createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ صياد الأخطاء — أنماط الأخطاء المُتعلّمة ║
    // ═══════════════════════════════════════════════════════════════════════
    errorPatterns: defineTable({
      pattern: v.string(), // نمط الخطأ (regex-friendly)
      category: v.string(),
      description: v.string(),
      autoFixAction: v.string(), // reload | clear_cache | reconnect | skip | notify_owner
      occurrences: v.number(),
      lastOccurrence: v.number(),
      successRate: v.number(), // 0-1 — نسبة نجاح الإصلاح التلقائي
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_pattern", ["pattern"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ صياد الأخطاء — مقاييس الأداء ║
    // ═══════════════════════════════════════════════════════════════════════
    performanceMetrics: defineTable({
      userId: v.optional(v.id("users")),
      fps: v.optional(v.number()),
      memoryUsedMB: v.optional(v.number()),
      memoryTotalMB: v.optional(v.number()),
      networkLatencyMs: v.optional(v.number()),
      networkType: v.optional(v.string()), // wifi | 4g | 3g | unknown
      route: v.optional(v.string()),
      loadTimeMs: v.optional(v.number()), // وقت تحميل الصفحة
      convSyncMs: v.optional(v.number()), // وقت مزامنة Convex
      componentCount: v.optional(v.number()), // عدد المكونات المشحونة
      domNodes: v.optional(v.number()), // عدد عقد DOM
      recordedAt: v.number(),
    }).index("by_time", ["recordedAt"]).index("by_user", ["userId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ صياد الأخطاء — صحة النظام اللحظية ║
    // ═══════════════════════════════════════════════════════════════════════
    systemHealth: defineTable({
      key: v.string(), // "current" — سطر واحد فقط
      status: v.union(
        v.literal("healthy"),
        v.literal("degraded"),
        v.literal("critical"),
      ),
      errorRate: v.number(), // أخطاء/دقيقة
      activeUsers: v.number(),
      avgFps: v.number(),
      avgLatency: v.number(),
      unresolvedErrors: v.number(),
      criticalErrors: v.number(),
      lastAutoFix: v.optional(v.number()),
      lastSweepAt: v.number(),
      uptime: v.number(), // uptime بالثواني
      diagnostics: v.optional(v.string()), // JSON — تشخيصات مفصلة
      updatedAt: v.number(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
