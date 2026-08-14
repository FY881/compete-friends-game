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
    }).index("email", ["email"]), // index for the email. do not remove or modify

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
    })
      .index("by_code", ["code"])
      .index("by_host", ["hostId"]),

    // One row per player per game.
    gamePlayers: defineTable({
      gameId: v.id("games"),
      userId: v.id("users"),
      name: v.string(), // display name taken when joining
      score: v.number(),
      answers: v.array(
        v.union(
          v.null(),
          v.object({
            questionId: v.string(),
            selected: v.number(),
            correct: v.boolean(),
            points: v.number(),
          }),
        ),
      ), // per-question answers indexed by question number
      joinedAt: v.number(),
    })
      .index("by_game", ["gameId"])
      .index("by_user_game", ["userId", "gameId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
