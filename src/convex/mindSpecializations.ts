import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 تخصصات العقل المتطور — إتقان حقيقي لكل حقل معرفي
 *
 *  • يُحدَّث آلياً من كل جولة (يستدعيه finishGame) من دفتر الفئات الفعلي
 *  • مستوى الإتقان محسوب من الدقة والحجم معاً — لا عشوائية ولا وهم
 *  • المستويات: مبتدئ → تلميذ → عالم → خبير → سامي
 *  • تُقرأ من محرك الأسئلة التكيفية فتصير أسئلتك حسب تخصصك لا اعتباطاً
 *  • تظهر في الملف الشخصي كتخصص معلن (تخصيص ملف أعمق من الطبقات البريميوم)
 * ═══════════════════════════════════════════════════════════════════════
 */

/** سقف مستوى الإتقان من التطبيق: يمنع الوهم، والنقاط الإضافية بريميوم فقط */
const BASE_CAP = 80;

/** مستويات التخصص بأسمائها العربية وحدودها */
const LEVELS: { key: string; label: string; min: number; emoji: string }[] = [
  { key: "novice", label: "مبتدئ", min: 0, emoji: "🌱" },
  { key: "apprentice", label: "تلميذ", min: 30, emoji: "📘" },
  { key: "scholar", label: "عالم", min: 50, emoji: "🎓" },
  { key: "expert", label: "خبير", min: 65, emoji: "🏅" },
  { key: "grandmaster", label: "سامي", min: 80, emoji: "👑" },
];

const levelOf = (mastery: number) => [...LEVELS].reverse().find((l) => mastery >= l.min) ?? LEVELS[0];

/** مستوى الإتقان الحقيقي: دقة × حجم — يكافئ الثبات لا الحظ */
function computeMastery(correct: number, total: number, accuracy: number): number {
  if (total === 0) return 0;
  const confidence = Math.min(1, total / 60); // 60 إجابة = ثقة كاملة
  return Math.round(Math.min(BASE_CAP, accuracy * 100 * (0.55 + 0.45 * confidence)));
}

/** مزامنة تخصصات لاعب من دفتر الفئات الحقيقي — يستدعيه finishGame بعد كل جولة */
export const syncFromCategoryHistory = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("categoryHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let leveled = 0;
    for (const r of rows) {
      if (r.total < 5) continue; // لا تخصص بلا دليل كافٍ
      const accuracy = r.correct / r.total;
      const mastery = computeMastery(r.correct, r.total, accuracy);
      const level = levelOf(mastery).key;

      const existing = await ctx.db
        .query("mindSpecializations")
        .withIndex("by_user_cat", (q) => q.eq("userId", userId).eq("category", r.category))
        .first();

      if (existing) {
        if (existing.mastery !== mastery || existing.level !== level) leveled++;
        await ctx.db.patch(existing._id, {
          mastery,
          level,
          correct: r.correct,
          total: r.total,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("mindSpecializations", {
          userId,
          category: r.category,
          mastery,
          level,
          correct: r.correct,
          total: r.total,
          updatedAt: Date.now(),
        });
        leveled++;
      }
    }

    // 🔗 تسجيل حقيقي في مركز الذكاء الموحد (وحدة مخصص التجربة)
    if (leveled > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "personalizer",
        kind: "decision",
        severity: "info",
        summary: `مزامنة تخصصات العقل لـ ${leveled} حقل معرفي من بيانات جولة حقيقية`,
      });
    }
    return { synced: rows.length, leveled };
  },
});

/** تخصصاتي — تظهر في ملفي وتُقرأ من محرك الأسئلة */
export const getMySpecializations = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .map((r) => ({
        category: r.category,
        mastery: r.mastery,
        level: r.level,
        levelLabel: levelOf(r.mastery).label,
        levelEmoji: levelOf(r.mastery).emoji,
        correct: r.correct,
        total: r.total,
      }))
      .sort((a, b) => b.mastery - a.mastery);
  },
});

/** تخصص أي لاعب — للعرض العام في ملفه (خصوصيته تُحترم في طبقات التخصيص) */
export const getPublicSpecializations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((r) => r.mastery >= 30)
      .map((r) => ({ category: r.category, mastery: r.mastery, levelLabel: levelOf(r.mastery).label }))
      .sort((a, b) => b.mastery - a.mastery)
      .slice(0, 6);
  },
});

/** أقوى تخصص لي — اللقب المعلن في الملف */
export const getMyPrimarySpecialization = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length === 0) return null;
    const top = rows.sort((a, b) => b.mastery - a.mastery)[0];
    const lvl = levelOf(top.mastery);
    return {
      category: top.category,
      mastery: top.mastery,
      level: lvl.key,
      levelLabel: lvl.label,
      emoji: lvl.emoji,
      title: `${lvl.emoji} ${lvl.label} ${top.category}`,
    };
  },
});

/** أضعف 3 حقول — توصية تدريب حقيقية مبنية على بياناتي لا افتراضات */
export const getWeakestFields = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("mindSpecializations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows
      .filter((r) => r.mastery < 50)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
      .map((r) => ({
        category: r.category,
        mastery: r.mastery,
        levelLabel: levelOf(r.mastery).label,
        hint: `دقتك ${Math.round((r.correct / Math.max(1, r.total)) * 100)}% في ${r.category} — التدريب هنا يرفع تخصصك أسرع`,
      }));
  },
});
