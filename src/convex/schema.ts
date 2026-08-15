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

      role: v.optional(roleValidator), // role of the user. do not remove

      // ── Discipline & punishment state (managed by the owner room) ──
      warnings: v.optional(v.number()), // formal warnings issued
      mutedUntil: v.optional(v.number()), // ms timestamp — chat muted until this time
      bannedUntil: v.optional(v.number()), // ms timestamp — account suspended until this time
      bannedPermanent: v.optional(v.boolean()), // permanent ban flag
      banReason: v.optional(v.string()), // why the user was punished
      cheatStrikes: v.optional(v.number()), // anti-cheat detections (tab-switch while answering)
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
        v.literal("answering"), // answer window is open
        v.literal("revealing"), // showing correct answer before next question
      ),
      questionIds: v.array(v.string()), // ids into the shared QUESTION_BANK
      currentQuestionIndex: v.number(),
      questionStartedAt: v.number(), // server timestamp when the current question started
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
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

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
      badgesEarned: v.array(v.string()), // badges unlocked by this result
      playedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_game", ["gameId"])
      .index("by_user_game", ["userId", "gameId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
