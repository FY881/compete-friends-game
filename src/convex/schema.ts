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
  questionCount: v.number(), // 3 | 5 | 7 | 10 (classic mode) — ignored when durationMinutes > 0
  timePerQuestionMs: v.number(), // 10s | 15s | 20s | 30s
  categories: v.array(v.string()), // empty array = all categories
  durationMinutes: v.optional(v.number()), // 0/absent = classic by question count; 5 | 10 | 15 = timed round
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

      // ── Reporter reputation (نظام البلاغات الذكي) ──
      // كسب/خسارة السمعة يقرّره المالك عند مراجعة البلاغ: بلاغ صحيح يرفعها،
      // بلاغ كيدي يخفضها. تُستخدم كعامل ثقة عند تصنيف البلاغات الجديدة.
      reporterReputation: v.optional(v.number()),
      validReports: v.optional(v.number()),
      invalidReports: v.optional(v.number()),

      // ── المتجر 2.0 — التجميلات المجهّزة ──
      equippedTitle: v.optional(v.string()), // اللقب المجهّز (يظهر بجانب الاسم)
      equippedFrame: v.optional(v.string()), // مفتاح الإطار المجهّز
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

    // ═══ الإصدار 3.0 — أدوار الموقع: نائب المالك + سجل التدقيق + الممنوعات ═══
    siteRoles: defineTable({
      userId: v.id("users"),
      role: v.union(v.literal("deputy_owner")),
      active: v.boolean(),
      appointedBy: v.id("users"),
      appointedAt: v.number(),
      revokedAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_role", ["role", "active"]),

    auditLog: defineTable({
      actorId: v.id("users"),
      actorName: v.string(),
      actorRole: v.union(v.literal("owner"), v.literal("deputy_owner")),
      action: v.string(),
      targetId: v.optional(v.id("users")),
      detail: v.string(),
      at: v.number(),
    }).index("by_created", ["at"]),

    siteBans: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("play_ban"), v.literal("chat_mute")),
      active: v.boolean(),
      until: v.optional(v.number()),
      reason: v.string(),
      issuedBy: v.id("users"),
      issuedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_kind", ["userId", "kind"]),

    // ═══ حروب العشائر — الموسم الرسمي ═══
    clanWars: defineTable({
      week: v.number(),
      clanAId: v.id("clans"),
      clanBId: v.id("clans"),
      clanAName: v.string(),
      clanBName: v.string(),
      pointsA: v.number(),
      pointsB: v.number(),
      division: v.string(),
      status: v.union(v.literal("active"), v.literal("settled")),
      rewardPaid: v.boolean(),
      createdAt: v.number(),
      settledAt: v.optional(v.number()),
    }).index("by_week", ["week"]),

    clanTreasury: defineTable({
      clanId: v.id("clans"),
      coins: v.number(),
      upgrades: v.array(v.string()),
      updatedAt: v.number(),
    }).index("by_clan", ["clanId"]),

    clanUpgrades: defineTable({
      clanId: v.id("clans"),
      key: v.string(),
      expiresAt: v.optional(v.number()),
      boughtAt: v.number(),
    })
      .index("by_clan", ["clanId"])
      .index("by_clan_key", ["clanId", "key"]),

    // ═══ المتجر 2.0 — التجميلات المملوكة ═══
    cosmetics: defineTable({
      userId: v.id("users"),
      key: v.string(),
      kind: v.union(v.literal("avatar"), v.literal("frame"), v.literal("title")),
      equipped: v.boolean(),
      expiresAt: v.optional(v.number()),
      acquiredAt: v.number(),
      giftedBy: v.optional(v.id("users")),
    })
      .index("by_user", ["userId"])
      .index("by_user_key", ["userId", "key"]),

    // Simple key/value store for owner-configurable settings.
    settings: defineTable({
      key: v.string(),
      value: v.string(), // JSON-encoded value
    }).index("by_key", ["key"]),

    // ── مركز الإعلانات المركزي ──
    // إعلانات متعددة قابلة للجدولة — تعرض المالك يُنشئ أي عدد منها،
    // الأخطر/الأحدث منها يظهر للجميع عبر AnnouncementBanner.
    announcements: defineTable({
      title: v.string(),
      body: v.string(),
      active: v.boolean(),
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      startsAt: v.optional(v.number()), // optional schedule start
      expiresAt: v.optional(v.number()), // optional schedule end
      createdAt: v.number(),
    })
      .index("by_active", ["active"])
      .index("by_created", ["createdAt"]),

    // ── سجل القرارات الموحّد (مجلس العقول) ──
    // كل قرار تصدره أنظمة الذكاء (رقابة، إدارة آلية، نائب المالك، حارسة
    // العضويات، مولّد الأسئلة، نظام البلاغات) يُسجَّل هنا في ناقل واحد
    // شفاف وقابل للبحث — ليُعرض في لوحة القيادة وتبويب الشفافية.
    aiDecisionLog: defineTable({
      system: v.string(), // معرف النظام المُصدِر (moderation | autoadmin | viceowner | gem | questions | reports | owner)
      actorName: v.string(),
      action: v.string(), // نوع القرار
      targetId: v.optional(v.string()),
      targetName: v.optional(v.string()),
      detail: v.string(), // سطر عربي موجز
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

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
      roundEndsAt: v.optional(v.number()), // timed rounds: absolute ms timestamp when the match must stop
      rematchOf: v.optional(v.id("games")), // set when this game is a rematch of another
      arenaDuel: v.optional(v.boolean()), // موجّة 11: غرفة مبارزة حلبة (لاعبان، تحديث ELO تلقائياً)
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
      userName: v.optional(v.string()), // اسم اللاعب وقت الجولة (للملخصات)
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
      .index("by_user_game", ["userId", "gameId"])
      .index("by_played", ["playedAt"]),

    // ⭐ أفضل لحظات الأسبوع — ملخص آلي يُنشر في العشائر
    highlights: defineTable({
      weekKey: v.string(), // مثل "2026-W36"
      moments: v.array(
        v.object({
          rank: v.number(),
          kind: v.string(),
          title: v.string(),
          detail: v.string(),
          playerName: v.string(),
        }),
      ),
      createdAt: v.number(),
    }).index("by_week", ["weekKey"]),

    // ═══════════════════════════════════════════════════════════════════
    // ║ موجّة 5 — البطولات الأسبوعية ║
    // ║ بطولة تُنشئها الإدارة، يلعب اللاعبون جولات عادية ويُحسب لهم ║
    // ║ مجموع أفضل جولاتهم خلال نافذة البطولة تلقائياً من gameHistory. ║
    // ═══════════════════════════════════════════════════════════════════
    tournaments: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("active"), // تلقي نتائج وجولات اللاعبين
        v.literal("ended"), // انتهت — النتائج النهائية معروضة
      ),
      startsAt: v.number(),
      endsAt: v.number(),
      bestRoundsCount: v.number(), // كم جولة تُحتسب لكل لاعب (مثلاً أفضل 5)
      winnerIds: v.optional(v.array(v.id("users"))), // أعلى 3 عند الإنهاء
      createdAt: v.number(),
    }).index("by_status", ["status"]),

    // تسجيل اللاعب في البطولة (يقبل تلقائياً عند أول جولة أيضاً)
    tournamentEntries: defineTable({
      tournamentId: v.id("tournaments"),
      userId: v.id("users"),
      userName: v.string(),
      totalScore: v.number(), // مجموع أفضل الجولات المحتسبة
      roundsCounted: v.number(),
      joinedAt: v.number(),
    })
      .index("by_tournament", ["tournamentId"])
      .index("by_tournament_user", ["tournamentId", "userId"]),

    // ═══════════════════════════════════════════════════════════════════
    // ║ موجّة 7 — نقاط الولاء + الإحالات ║
    // ║ محفظة نقاط يكسبها اللاعب من اللعب اليومي والبطولات، وينفقها ║
    // ║ على امتيازات تجميلية (إطارات/ألقاب/شارات). ║
    // ═══════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════
    // ║ موجّة 12 — العشائر وحروبها الأسبوعية ║
    // ║ عشيرة حتى 20 عضواً باسم وشعار، تجمع نقاط الحرب من جولات أعضائها  ║
    // ║ خلال أسبوع الحرب الحالي، مع دردشة داخلية ولوحة صدارة للعشائر.    ║
    // ═══════════════════════════════════════════════════════════════════
    clans: defineTable({
      name: v.string(), // اسم فريد للعشيرة
      emoji: v.string(), // شعار (إيموجي)
      ownerId: v.id("users"),
      members: v.array(v.id("users")), // حتى 20
      pointsThisWeek: v.number(), // نقاط حرب الأسبوع الحالي
      totalPoints: v.number(), // مجموع نقاط تاريخي
      weeklyResetAt: v.number(), // متى أُعيد ضبط النقاط آخر مرة
      warDivision: v.optional(v.number()), // قسم الحرب 0=برونز 1=فضي 2=ذهبي 3=ماسي
      createdAt: v.number(),
    })
      .index("by_name", ["name"])
      .index("by_points", ["pointsThisWeek"]),

    // رسائل دردشة العشيرة الداخلية
    clanMessages: defineTable({
      clanId: v.id("clans"),
      senderId: v.id("users"),
      senderName: v.string(),
      content: v.string(),
      createdAt: v.number(),
    }).index("by_clan", ["clanId", "createdAt"]),

    loyaltyWallets: defineTable({
      userId: v.id("users"),
      points: v.number(),
      lifetimeEarned: v.number(),
      // الامتيازات المملوكة (مفاتيح مثل "frame_gold" مع وقت الانتهاء)
      perks: v.array(v.object({
        key: v.string(),
        expiresAt: v.optional(v.number()), // null = دائم
      })),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // سجل حركات المحفظة (كسب/إنفاق) — شفافية كاملة
    loyaltyLedger: defineTable({
      userId: v.id("users"),
      delta: v.number(), // موجب = كسب، سالب = إنفاق
      reason: v.string(),
      at: v.number(),
    }).index("by_user", ["userId"]),

    // 🎁 الصندوق الغامض اليومي — صف لكل فتح (يضمن حداً يومياً)
    dailyBoxes: defineTable({
      userId: v.id("users"),
      day: v.string(), // مفتاح اليوم YYYY-MM-DD
      rewardKind: v.string(), // loyalty | xp | xpBoost | streakShield
      rewardLabel: v.string(),
      openedAt: v.number(),
    }).index("by_user_day", ["userId", "day"]),

    // 🚀 المعززات النشطة — معزز خبرة ×2 (بجولات متبقية) أو درع سلسلة
    boosts: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("xp_x2"), v.literal("streak_shield")),
      remainingRounds: v.number(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_kind", ["userId", "kind"]),

    // ═══════════════════════════════════════════════════════════════════
    // ║ موجّة 11 — الحلبة العالمية: تصنيف ELO لكل لاعب ║
    // ║ صف واحد لكل لاعب — نقاط التصنيف، عدد الانتصارات/الهزائم،        ║
    // ║ والدرع (برونز/فضي/ذهب/ماسي/أسطورة) محسوب من النقاط.              ║
    // ═══════════════════════════════════════════════════════════════════
    arenaRatings: defineTable({
      userId: v.id("users"),
      rating: v.number(), // نقاط ELO (يبدأ من 1000)
      wins: v.number(),
      losses: v.number(),
      draws: v.number(),
      lastPlayedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_rating", ["rating"]),

    // ═════════════════════════════════════════════════════════════════════
    // ║ موجّة 12 — مواسم الحلبة (Arena Seasons) ║
    // ║ موسم تنافسي لكل 30 يوماً — تصنيف منفصل يبدأ من 1000، وترتيب ومكافآت ║
    // ║ نهاية الموسم تُحتسب تلقائياً عند أول نشاط بعد انتهاء الموسم.        ║
    // ═════════════════════════════════════════════════════════════════════
    arenaSeasons: defineTable({
      number: v.number(), // رقم الموسم (يزيد تلقائياً)
      name: v.string(), // اسم عربي جذاب
      startAt: v.number(),
      endAt: v.number(), // startAt + 30 يوماً
      status: v.union(
        v.literal("active"),
        v.literal("closed"), // انتهى وجرى توزيع المكافآت
      ),
    }).index("by_status", ["status"]),

    arenaSeasonPlayers: defineTable({
      seasonId: v.id("arenaSeasons"),
      userId: v.id("users"),
      rating: v.number(), // تصنيف الموسم (منفصل عن الدائم)
      wins: v.number(),
      losses: v.number(),
      draws: v.number(),
      bestRating: v.number(),
      rewardClaimed: v.optional(v.boolean()),
      rewardRank: v.optional(v.number()),
      rewardTier: v.optional(v.string()),
    })
      .index("by_season_user", ["seasonId", "userId"])
      .index("by_season_rating", ["seasonId", "rating"]),

    // الإحالات: كل لاعب له كود، ومن يسجل به يحصل الطرفان على نقاط
    referralCodes: defineTable({
      userId: v.id("users"),
      code: v.string(), // قصير فريد مثل "ZAK-7K2F"
      invites: v.number(), // عدد من سجّل به
      createdAt: v.number(),
    }).index("by_code", ["code"]).index("by_user", ["userId"]),

    // Live emoji reactions inside a game lobby — friends hype each other up.
    reactions: defineTable({
      gameId: v.id("games"),
      name: v.string(), // reacting player's display name
      emoji: v.string(), // one emoji (e.g. 🔥 😂 🎉)
      createdAt: v.number(),
    }).index("by_game", ["gameId"]),

    // 👀 مشجعو المبارزات — شاهدوا الأصدقاء يتنافسون حياً
    spectators: defineTable({
      gameId: v.id("games"),
      userId: v.id("users"),
      name: v.string(),
      joinedAt: v.number(),
      lastHeartbeat: v.number(), // نبض الحضور — يُحسب «مشاهد الآن» خلال دقيقتين
    })
      .index("by_game", ["gameId"])
      .index("by_game_user", ["gameId", "userId"]),

    // دردشة مشجعي المبارزة (أحدث 50 رسالة تُحفظ)
    spectatorMessages: defineTable({
      gameId: v.id("games"),
      senderId: v.id("users"),
      senderName: v.string(),
      content: v.string(),
      isSpectator: v.boolean(),
      createdAt: v.number(),
    }).index("by_game_time", ["gameId", "createdAt"]),

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

    // حزم الأسئلة الموسمية — أحداث محدودة الوقت بأسئلة AI مخصصة
    questionPacks: defineTable({
      slug: v.string(), // معرف فريد مثل "ramadan-2026"
      name: v.string(),
      description: v.optional(v.string()),
      theme: v.string(), // موضوع الحزمة يوجه توليد AI (مثل "أسئلة رمضان")
      status: v.union(v.literal("active"), v.literal("ended")),
      startsAt: v.number(),
      endsAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_status", ["status"]),

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
    // ║ سجل أفعال العضوية — أثر حقيقي قابل للتحقق لكل عملية (منح/تمديد/سحب) ║
    // ║ يسجّله المالك وحارسة العضويات «جيم» ونائب المالك — ويظهر للرصد. ║
    // ═══════════════════════════════════════════════════════════════════════
    membershipLogs: defineTable({
      actor: v.string(), // "owner" | "as_gem" | "vice_owner" | "system"
      actorName: v.string(),
      action: v.union(
        v.literal("grant"),
        v.literal("extend"),
        v.literal("revoke"),
        v.literal("audit"),
        v.literal("reminder"),
        v.literal("code"),
        v.literal("review"),
      ),
      targetUserId: v.optional(v.id("users")),
      targetName: v.optional(v.string()),
      tier: v.optional(
        v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("diamond"),
          v.literal("exclusive"),
        ),
      ),
      detail: v.string(),
      at: v.number(),
    })
      .index("by_created", ["at"])
      .index("by_actor", ["actor", "at"]),

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

    // أعلام نظام بسيطة (صف واحد key/value) — لمنع تكرار المهام المجدولة
    systemFlags: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),

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
    // ═══════════════════════════════════════════════════════════════════
    // ║ الدوريات الخاصة — مجموعات أصدقاء بصدارة أسبوعية ║
    // ═══════════════════════════════════════════════════════════════════
    leagues: defineTable({
      name: v.string(),
      code: v.string(), // رمز انضمام فريد
      ownerId: v.id("users"),
      tier: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond")),
      weekKey: v.string(), // مفتاح الأسبوع الحالي (YYYY-Wnn)
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    // عضوية لاعب في دوري — النقاط الأسبوعية تُصفَّر آلياً كل أسبوع
    leagueMembers: defineTable({
      leagueId: v.id("leagues"),
      userId: v.id("users"),
      weeklyPoints: v.number(),
      seasonPoints: v.number(), // تراكمي للموسم
      joinedAt: v.number(),
    })
      .index("by_league", ["leagueId"])
      .index("by_user", ["userId"]),

    // ═══════════════════════════════════════════════════════════════════
    // ║ التنافس المباشر — أنت ضد صديق (Rivalries) ║
    // ═══════════════════════════════════════════════════════════════════
    // صف واحد لكل زوج لاعبين (مرتّب معجمياً aId < bId) يُحدَّث تلقائياً
    // بعد كل جولة مشتركة: انتصارات، هزائم، تعادلات، آخر نتيجة.
    rivalries: defineTable({
      aId: v.id("users"),
      bId: v.id("users"),
      aWins: v.number(),
      bWins: v.number(),
      draws: v.number(),
      totalGames: v.number(),
      lastGameId: v.optional(v.id("games")),
      lastWinnerId: v.optional(v.id("users")), // undefined = تعادل
      lastPlayedAt: v.number(),
    })
      .index("by_pair", ["aId", "bId"])
      .index("by_a", ["aId"])
      .index("by_b", ["bId"]),

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
      gameCode: v.optional(v.string()), // موجّة 11: رمز غرفة المبارزة المرتبطة
      arena: v.optional(v.boolean()), // موجّة 11: مبارزة حلبة عالمية (تزاوج تلقائي)
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

    // ═══════════════════════════════════════════════════════════════════
    // ║ موجّة 13 — تذكرة الموسم 2.0 (Season Pass) ║
    // ║ تقدم اللاعب في مسار 30 مستوى، تُكتسب نقاط التذكرة من الجولات،    ║
    // ║ كل مستوى يمنح جائزة (نقاط ولاء/خبرة)، والمستويات 10/20/30        ║
    // ║ تمنح إطارات موسم حصرية تظهر في الصدارة والملف الشخصي.            ║
    // ═══════════════════════════════════════════════════════════════════
    seasonPasses: defineTable({
      userId: v.id("users"),
      seasonNumber: v.number(),
      passPoints: v.number(), // نقاط التذكرة المكتسبة هذا الموسم
      claimedTiers: v.array(v.number()), // المستويات المستلمة جوائزها
      // إطارات موسمية مملوكة (مفتاح + تاريخ انتهاء نهاية الموسم)
      seasonFrames: v.array(v.string()),
    })
      .index("by_user_season", ["userId", "seasonNumber"])
      .index("by_season", ["seasonNumber"]),

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
    // ║ AI Suite — سجل نشاط أنظمة الذكاء الثلاثين ║
    // ═══════════════════════════════════════════════════════════════════════
    aiSuiteActivity: defineTable({
      systemId: v.string(),
      systemName: v.string(),
      summary: v.string(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مجالس العقول — نقاشات AI تلقائية حرة بين الأنظمة ║
    // ═══════════════════════════════════════════════════════════════════════
    councilSessions: defineTable({
      topic: v.string(),
      participantIds: v.array(v.string()), // معرفات أنظمة AI المشاركة (2-8)
      maxTurns: v.number(), // عدد الأدوار الإجمالي
      intervalSec: v.number(), // الثواني بين كل دور
      freeMode: v.boolean(), // الوضع الحر: ترتيب متحدثين عشوائي ونقاش أوسع
      status: v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("ended"),
      ),
      turnCount: v.number(),
      messages: v.array(
        v.object({
          systemId: v.string(),
          systemName: v.string(),
          emoji: v.string(),
          content: v.string(),
          at: v.number(),
        }),
      ),
      ownerMessage: v.optional(v.union(v.string(), v.null())), // تدخل المالك — يُقرأ ثم يُمسح
      lastError: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      finishedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ الغرفة الخاصة — 10 عقول مستقلة تتكلم فيما بينها بلا تدخل بشري ║
    // ═══════════════════════════════════════════════════════════════════════
    privateCouncilSessions: defineTable({
      agenda: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("ended"),
      ),
      turnCount: v.number(),
      maxTurns: v.number(),
      intervalSec: v.number(),
      messages: v.array(
        v.object({
          mindId: v.string(),
          mindName: v.string(),
          emoji: v.string(),
          content: v.string(),
          at: v.number(),
        }),
      ),
      executedActions: v.array(
        v.object({
          mindId: v.string(),
          mindName: v.string(),
          type: v.string(),
          description: v.string(),
          result: v.string(), // "executed" | "rejected" | "needs-owner"
          at: v.number(),
        }),
      ),
      lastError: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      finishedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ ذاكرة جماعية دائمة — كل معرفة تتعلمها العقول تبقى للأبد ║
    // ═══════════════════════════════════════════════════════════════════════
    aiCollectiveMemories: defineTable({
      room: v.union(v.literal("private"), v.literal("free")),
      kind: v.string(), // "fact" | "decision" | "skill" | "lesson" | "research"
      title: v.string(),
      content: v.string(),
      sourceMind: v.string(),
      importance: v.number(), // 1-10
      createdAt: v.number(),
    }).index("by_room_importance", ["room", "importance"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ تصعيد للمالك — القرارات المصيرية تحتاج موافقة المالك ║
    // ═══════════════════════════════════════════════════════════════════════
    aiOwnerEscalations: defineTable({
      room: v.union(v.literal("private"), v.literal("free")),
      mindName: v.string(),
      decision: v.string(),
      rationale: v.string(),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      ownerResponse: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      respondedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_status", ["status"]).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ غرفة الحريّة — نقاش حر في كل شيء ما عدا اللعبة ║
    // ═══════════════════════════════════════════════════════════════════════
    freeRoomSessions: defineTable({
      topic: v.string(),
      status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
      turnCount: v.number(),
      maxTurns: v.number(),
      intervalSec: v.number(),
      messages: v.array(
        v.object({
          mindId: v.string(),
          mindName: v.string(),
          emoji: v.string(),
          content: v.string(),
          at: v.number(),
        }),
      ),
      lastError: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      finishedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ ملتقى العقول — غرفتا النقاش الذاتي (الحرب + العقل الحر) ║
    // ═══════════════════════════════════════════════════════════════════════
    mindHubSessions: defineTable({
      room: v.union(v.literal("war"), v.literal("free")),
      agenda: v.string(),
      status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
      turnCount: v.number(),
      maxTurns: v.number(),
      intervalSec: v.number(),
      messages: v.array(
        v.object({
          mindId: v.string(),
          mindName: v.string(),
          emoji: v.string(),
          content: v.string(),
          at: v.number(),
        }),
      ),
      executedActions: v.array(
        v.object({
          mindId: v.string(),
          mindName: v.string(),
          type: v.string(),
          description: v.string(),
          result: v.string(), // executed | pending-owner | rejected
          at: v.number(),
        }),
      ),
      lessons: v.optional(v.array(v.string())),
      lastError: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
      finishedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ نائب المالك — يعمل عبر مفتاح OpenRouter الرسمي الوحيد             ║
    // ║ مسؤول عن كل التفاصيل المملة عن AI و API — حرّ دائم لا يتأثر     ║
    // ║ بقرار البشر، له إمكانيات المالك بالضبط وهو الأول                  ║
    // ═══════════════════════════════════════════════════════════════════════
    viceOwnerSessions: defineTable({
      mission: v.string(), // المهمة الحالية التي اختارها بنفسه
      focus: v.union(
        v.literal("ai_ops"), // إدارة أنظمة AI و API — مسؤوليته الأساسية
        v.literal("audit"), // تدقيق شامل
        v.literal("optimization"), // تحسين الأداء
        v.literal("exploration"), // استكشاف حر
      ),
      status: v.union(v.literal("active"), v.literal("paused"), v.literal("ended")),
      turnCount: v.number(),
      maxTurns: v.number(),
      intervalSec: v.number(),
      // سجل أعماله — كل شيء يفعله ويقرره بحريته الكاملة
      activity: v.array(
        v.object({
          type: v.string(), // decision | fix | audit | api_call | ai_command | exploration
          title: v.string(),
          detail: v.string(),
          severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
          at: v.number(),
        }),
      ),
      lastError: v.optional(v.union(v.string(), v.null())),
      model: v.string(), // النموذج المستخدم
      createdAt: v.number(),
      finishedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مركز API — كل واجهات البرمجة في مكان واحد + اكتشاف تلقائي        ║
    // ═══════════════════════════════════════════════════════════════════════
    apiRegistry: defineTable({
      name: v.string(),
      provider: v.string(),
      baseUrl: v.string(),
      apiKey: v.optional(v.string()), // مفتاح مخفي عن الواجهة العادية
      authStyle: v.union(v.literal("bearer"), v.literal("header"), v.literal("query"), v.literal("none")),
      authHeaderName: v.optional(v.string()),
      model: v.optional(v.string()),
      // المواصفات المكتشفة تلقائياً أو يدوياً
      capabilities: v.array(v.string()), // chat | json | vision | search | translate...
      notes: v.optional(v.string()),
      // الحالة والصحة
      status: v.union(v.literal("active"), v.literal("untested"), v.literal("failed"), v.literal("disabled")),
      lastTestedAt: v.optional(v.number()),
      lastLatencyMs: v.optional(v.number()),
      successCount: v.number(),
      failCount: v.number(),
      // من أين جاء — يدوي أو بالاكتشاف التلقائي
      source: v.union(v.literal("manual"), v.literal("auto-discovered")),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // أنظمة أنشأها نائب المالك بنفسه من تلقاء نفسه
    viceOwnerSystems: defineTable({
      name: v.string(),
      purpose: v.string(),
      spec: v.string(), // المواصفات الكاملة التي صاغها بنفسه
      // ما نفّذه فعلاً من الأنظمة
      status: v.union(v.literal("proposed"), v.literal("built"), v.literal("active"), v.literal("retired")),
      builtAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ عالم المساعدين — كيانات حية بصلاحيات تنفيذية حقيقية             ║
    // ═══════════════════════════════════════════════════════════════════════
    assistantWorld: defineTable({
      assistantId: v.string(), // as_cobalt ...
      name: v.string(),
      emoji: v.string(),
      title: v.string(), // وظيفته في العالم
      home: v.string(), // مكان إقامته
      personality: v.string(),
      privilege: v.string(), // صلاحياته الحقيقية
      // حالته الحية
      energy: v.number(), // 0-100
      mood: v.string(),
      reputation: v.number(), // 0-100 — كم يثق به نائب المالك
      level: v.number(), // يتقدم بإنجازاته
      tasksCompleted: v.number(),
      actionsExecuted: v.number(),
      lastActionAt: v.optional(v.union(v.number(), v.null())),
      // جهاز الكمبيوتر الخاص به
      computer: v.object({
        cpuLoad: v.number(), // 0-100
        installedTools: v.array(v.string()),
        uptimeMs: v.number(),
        lastCommand: v.optional(v.string()),
        lastCommandResult: v.optional(v.string()),
        logsCount: v.number(),
      }),
      lastActivity: v.optional(v.union(v.string(), v.null())),
      createdAt: v.number(),
    }).index("by_assistant", ["assistantId"]),

    assistantLogs: defineTable({
      assistantId: v.string(),
      name: v.string(),
      emoji: v.string(),
      type: v.union(v.literal("thought"), v.literal("action"), v.literal("order"), v.literal("life")),
      action: v.string(), // inspect | moderate | reward | announce | propose | fix | chat ...
      detail: v.string(),
      result: v.union(v.literal("executed"), v.literal("failed"), v.literal("noted")),
      at: v.number(),
    }).index("by_assistant", ["assistantId", "at"]).index("by_created", ["at"]),

    // أوامر نائب المالك للمساعدين — تُنفَّذ بأولوية عالية
    assistantOrders: defineTable({
      targetId: v.union(v.literal("all"), v.string()),
      task: v.string(),
      priority: v.union(v.literal("high"), v.literal("normal")),
      status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("done"), v.literal("rejected")),
      acceptedBy: v.optional(v.string()),
      result: v.optional(v.string()),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    }).index("by_status", ["status", "createdAt"]).index("by_created", ["createdAt"]),

    // السجل المركزي — كل أمر نُفِّذ فعلاً من نائب المالك أو المساعدين
    viceAudit: defineTable({
      executor: v.string(), // "vice_owner" | assistant id
      executorName: v.string(),
      command: v.string(), // النص الكامل للأمر
      action: v.string(), // ban | mute | grant_xp | announce | system | order | sweep ...
      target: v.string(),
      params: v.optional(v.string()),
      result: v.union(v.literal("executed"), v.literal("failed"), v.literal("skipped")),
      detail: v.string(),
      at: v.number(),
    }).index("by_created", ["at"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ ترقية AI الشاملة — ذاكرة دائمة + تقييمات + اقتراحات استباقية      ║
    // ═══════════════════════════════════════════════════════════════════════
    aiMemories: defineTable({
      agentId: v.string(), // aiSuite:coder | mindHub:em_quantum | viceOwner | aiCoach:user123
      kind: v.union(v.literal("lesson"), v.literal("preference"), v.literal("fact"), v.literal("style")),
      content: v.string(),
      importance: v.number(), // 1-10
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
      useCount: v.number(),
    }).index("by_agent", ["agentId", "importance"]),

    aiFeedback: defineTable({
      agentId: v.string(),
      sessionId: v.optional(v.string()),
      rating: v.number(), // 1-5
      comment: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_agent", ["agentId"]),

    aiSuggestions: defineTable({
      agentId: v.string(),
      agentName: v.string(),
      title: v.string(),
      detail: v.string(),
      impact: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      category: v.string(),
      status: v.union(v.literal("open"), v.literal("accepted"), v.literal("dismissed")),
      createdAt: v.number(),
    }).index("by_status", ["status", "createdAt"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ Master AI — AI Activity Log ║
    // ═══════════════════════════════════════════════════════════════════════
    aiLogs: defineTable({
      action: v.string(),       // "moderation" | "matchmaking" | "economy" | "analytics" | "achievement" | "auto_fix" | "report"
      subsystem: v.string(),    // "moderation" | "matchmaking" | "economy" | "analytics" | "reports" | "security" | "commands"
      message: v.string(),      // Arabic description of what was done
      severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical"), v.literal("action")),
      targetUser: v.optional(v.string()),  // affected user name or ID
      targetRoom: v.optional(v.string()),  // affected room
      data: v.optional(v.string()),        // JSON — detailed context
      auto: v.boolean(),                    // true = AI did it automatically, false = owner command
      executedBy: v.string(),               // "ai_master" | "owner" | "system"
      timestamp: v.number(),
    })
      .index("by_timestamp", ["timestamp"])
      .index("by_action", ["action"])
      .index("by_severity", ["severity"])
      .index("by_subsystem", ["subsystem"]),

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

      // ── موجّة 14: صياد الأخطاء v5.0 «الحارس» — التشريح بالذكاء الاصطناعي ──
      aiAnalysis: v.optional(v.string()), // تحليل السبب الجذري بالعربية
      aiFixSuggestion: v.optional(v.string()), // الحل المقترح
      aiCanAutoFix: v.optional(v.boolean()), // هل يمكن إصلاحه تلقائياً؟
      aiAnalyzedAt: v.optional(v.number()), // وقت التشريح
      aiVerdict: v.optional(v.string()), // pending | analyzed | failed
      playerAction: v.optional(v.string()), // ماذا كان اللاعب يفعل لحظة الخطأ (v5.0)
    })
      .index("by_fingerprint", ["fingerprint"])
      .index("by_severity", ["severity"])
      .index("by_created", ["createdAt"])
      .index("by_unresolved", ["resolved", "createdAt"])
      .index("by_verdict", ["aiVerdict"]),


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
      avgHealMs: v.optional(v.number()), // v5.0: متوسط زمن الشفاء لهذا النمط
    })      .index("by_pattern", ["pattern"]),


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

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مركز التقدم — المهام والمعالم المستلمة ║
    // ═══════════════════════════════════════════════════════════════════════
    questClaims: defineTable({
      userId: v.id("users"),
      kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("milestone")),
      periodKey: v.string(), // يوم / أسبوع / معرف المعلم
      questId: v.string(),
      claimedAt: v.number(),
    })
      .index("by_user_kind_period", ["userId", "kind", "periodKey"])
      .index("by_user", ["userId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مركز التقدم — الأسئلة المفضلة ║
    // ═══════════════════════════════════════════════════════════════════════
    favorites: defineTable({
      userId: v.id("users"),
      questionId: v.string(),
      addedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_question", ["userId", "questionId"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مركز التقدم — الدعوات ║
    // ═══════════════════════════════════════════════════════════════════════
    referrals: defineTable({
      userId: v.id("users"),
      code: v.string(),
      appliedBy: v.array(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_code", ["code"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ مركز التقدم — إعدادات اللاعب ║
    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    // ║ أطلس كنترول — أنظمة السيطرة الكاملة (Atlas Control) ║
    // ═══════════════════════════════════════════════════════════════════════

    // أوامر السيطرة الصادرة من أطلس: تُنفَّذ فوراً على الخادم وتنعكس على اللعبة.
    atlasCommands: defineTable({
      system: v.string(), // أحد أنظمة أطلس العشرة
      feature: v.string(), // معرّف الميزة من سجل الـ 80 ميزة
      command: v.string(), // اسم العملية الفعلية (identify: api function)
      args: v.optional(v.string()), // JSON — مدخلات العملية
      result: v.optional(v.string()), // JSON — نتيجة التنفيذ الفعلية
      ok: v.boolean(),
      error: v.optional(v.string()),
      executedBy: v.string(), // اسم المشرف المنفّذ
      severity: v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("critical"),
      ),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_system", ["system"])
      .index("by_feature", ["feature"]),

    // أفكار الأنظمة الحرة: ملاحظات واقتراحات مولّدة دورياً بتفكير شامل.
    atlasInsights: defineTable({
      kind: v.string(), // "observation" | "anomaly" | "suggestion" | "summary"
      system: v.string(), // النظام المصدر
      severity: v.union(
        v.literal("info"),
        v.literal("blue"),
        v.literal("orange"),
        v.literal("red"),
        v.literal("purple"),
      ),
      title: v.string(),
      body: v.string(),
      data: v.optional(v.string()), // JSON — الأرقام الداعمة
      status: v.union(
        v.literal("open"),
        v.literal("accepted"),
        v.literal("dismissed"),
      ),
      createdAt: v.number(),
      decidedAt: v.optional(v.number()),
    })
      .index("by_created", ["createdAt"])
      .index("by_status", ["status"]),

    // ذاكرة التعلّم: قرارات المالك → تُدرِّب الأنظمة الحرة (ميزة 80).
    atlasLearningMemory: defineTable({
      kind: v.string(),
      signature: v.string(), // بصمة الحالة (تُستخدم لمطابقة الحالات المشابهة)
      decision: v.string(), // ما قرره المالك فعلياً
      timesSeen: v.number(),
      lastSeenAt: v.number(),
      createdAt: v.number(),
    }).index("by_signature", ["signature"]),

    // سجل جلسات أطلس (أمان + تدقيق دخول).
    atlasSessions: defineTable({
      userId: v.id("users"),
      loginAt: v.number(),
      logoutAt: v.optional(v.number()),
      userAgent: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    playerSettings: defineTable({
      userId: v.id("users"),
      soundEnabled: v.boolean(),
      musicEnabled: v.boolean(),
      motionLevel: v.union(v.literal("full"), v.literal("reduced"), v.literal("off")),
      notificationsEnabled: v.boolean(),
      theme: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
      equippedTitle: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // ═══ مركز API الاحترافي — جداول الحرس والكاش والتدقيق ═══
    apiCache: defineTable({
      fp: v.string(),
      reply: v.string(),
      provider: v.string(),
      createdAt: v.number(),
    }).index("by_fp", ["fp"]),

    apiCallLogs: defineTable({
      ok: v.boolean(),
      provider: v.string(),
      model: v.string(),
      keyUsed: v.string(),
      latencyMs: v.number(),
      tokensIn: v.number(),
      tokensOut: v.number(),
      taskType: v.string(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    apiCircuit: defineTable({
      id: v.string(),
      failures: v.number(),
      open: v.boolean(),
      openedAt: v.optional(v.union(v.number(), v.null())),
    }).index("by_main", ["id"]),

    apiKeyProbes: defineTable({
      results: v.array(
        v.object({
          key: v.string(),
          ok: v.boolean(),
          latencyMs: v.number(),
          error: v.optional(v.string()),
        }),
      ),
      probedAt: v.number(),
    }).index("by_probed", ["probedAt"]),

    // ═══ أوامر نائب المالك ─────────────────────────────── ═══
    // ═══ الأوامر المُصدرة من الواجهة أو من circulatedHumansReadable
    // ═══ النائب يقرأها خلال دورته ويُنفّذها بالترتيب               ═══
    viceCommands: defineTable({
      command: v.string(),
      targetSystem: v.string(), // "viceOwner" | اسم نظام محدد | "all"
      payload: v.optional(v.string()),
      issuedBy: v.string(),
      status: v.union(v.literal("pending"), v.literal("executed"), v.literal("rejected")),
      executedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ═══ المعلّق الذكي للبطولات ────────────────────────── ═══
    commentary: defineTable({
      text: v.string(),
      mood: v.string(),
      tournamentName: v.string(),
      trigger: v.string(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    apiPromptTemplates: defineTable({
      name: v.string(),
      systemPrompt: v.string(),
      maxTokens: v.number(),
      createdAt: v.number(),
    }).index("by_name", ["name"]),

    // ═══════════════════════════════════════════════════════════════════════
    // ║ سجل أحداث مركز API — مراقبة، إصلاح ذاتي، حماية                  ║
    // ═══════════════════════════════════════════════════════════════════════
    apiEvents: defineTable({
      apiId: v.optional(v.union(v.id("apiRegistry"), v.null())),
      provider: v.string(),
      event: v.string(), // probe | auto-fix | protection | guard | key | lifecycle
      detail: v.string(),
      severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
      at: v.number(),
    }).index("by_created", ["at"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
