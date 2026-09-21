import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 جداول الغرفة الحيّة v15.0
 *
 * `gameAdaptations` — سجل كل تعديل حقيقي للصعوبة داخل غرفة لعب.
 * الغرض ثلاثي:
 *   ١) الشفافية: اللاعبون يرون أن الصعوبة تغيّرت ولماذا (لا صمت).
 *   ٢) منع العبث: من عدّل، ومتى، وكم سؤالاً استُبدل.
 *   ٣) الرقابة: استعلام المالك يقرأ آخر التعديلات بفهرس زمني بلا مسح.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const gameLiveTables = {
  gameAdaptations: defineTable({
    gameId: v.id("games"),
    code: v.string(),
    actorId: v.id("users"),
    actorName: v.string(),
    atQuestionIndex: v.number(),
    fromDifficulty: v.string(),
    toDifficulty: v.string(),
    fromHardRatio: v.number(),
    toHardRatio: v.number(),
    roomAccuracy: v.number(),
    sample: v.number(),
    swappedCount: v.number(),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_game", ["gameId", "createdAt"])
    .index("by_created", ["createdAt"])
    .index("by_code", ["code", "createdAt"]),
};
