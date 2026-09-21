import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎮 جداول الألعاب المصغّرة v14.0
 *
 * لماذا ثلاث جداول؟
 *   ١) `miniGameResults`          — أفضل نتيجة حقيقية لكل لاعب × لعبة (سجل دائم).
 *   ٢) `miniGameDaily`            — سقف الخبرة اليومي لكل لاعب (يمنع المزرعة).
 *   ٣) `miniGameDailyPerGame`     — كم مرة لُعبت كل لعبة اليوم (للتناقص والعوائد).
 *
 * الفصل مقصود: كل استعلام يُصبح مقيّداً بفهرس واحد بلا مسح، والسقف اليومي
 * يُقرأ بصف واحد لا بجمع كل المحاولات.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const miniGameTables = {
  miniGameResults: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    category: v.string(),
    difficulty: v.string(),
    bestScore: v.number(),
    lastScore: v.number(),
    plays: v.number(),
    xpEarned: v.number(),
    lastPlayedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_game", ["userId", "gameId"])
    .index("by_game_score", ["gameId", "bestScore"])
    .index("by_category_score", ["category", "bestScore"]),

  miniGameDaily: defineTable({
    userId: v.id("users"),
    day: v.string(), // YYYY-MM-DD
    xpEarned: v.number(),
    plays: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_day", ["userId", "day"])
    .index("by_day", ["day"]),

  miniGameDailyPerGame: defineTable({
    userId: v.id("users"),
    day: v.string(),
    gameId: v.string(),
    plays: v.number(),
    updatedAt: v.number(),
  }).index("by_user_day_game", ["userId", "day", "gameId"]),
};
