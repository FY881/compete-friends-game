import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 📚 أرشيف الأسئلة — الكتابة التلقائية من الجولات الحقيقية
 *
 * الفجوة التي يعالجها: جدول questionArchive كان له نظام كامل (عرض لللاعب
 * في /profile + تحليلات Hub) لكن لا أحد يكتب فيه إلا دالة يدوية ميتة —
 * فبقي الأرشيف فارغاً للأبد والتحليلات ناقصة مصدرها.
 *
 * الآن: كل جولة تنتهي → تُؤرشف إجاباتها الفعلية (نص السؤال والخيارات
 * والصح/خطأ) تلقائياً. المفضلة اليدوية تعمل فوقه كما هي.
 *
 * حدود صارمة: 15 سؤالاً كحد أقصى لكل لاعب في الجولة (سقف الغرف الفعلي)،
 * والأسئلة المكررة داخل نفس الجولة تُؤرشف مرة واحدة.
 * ═══════════════════════════════════════════════════════════════════════
 */

export const archiveFromGame = internalMutation({
  args: {
    userId: v.id("users"),
    entries: v.array(
      v.object({
        questionId: v.string(),
        category: v.string(),
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
        wasCorrect: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { userId, entries }) => {
    const now = Date.now();
    const seen = new Set<string>();
    let archived = 0;
    // سقف صارم: 15 صف لكل جولة (أقصى عدد أسئلة في الغرف)
    for (const e of entries.slice(0, 15)) {
      if (seen.has(e.questionId)) continue;
      seen.add(e.questionId);
      // منع التكرار عبر الجولات: نفس السؤال لنفس اللاعب يُحدَّث لا يُضاعف
      const existing = await ctx.db
        .query("questionArchive")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(400);
      const prior = existing.find((r) => r.questionId === e.questionId);
      if (prior) {
        await ctx.db.patch(prior._id, {
          wasCorrect: e.wasCorrect,
          createdAt: now,
        } as never);
      } else {
        await ctx.db.insert("questionArchive", {
          userId,
          ...e,
          favorited: false,
          createdAt: now,
        } as never);
      }
      archived += 1;
    }
    return { archived };
  },
});
