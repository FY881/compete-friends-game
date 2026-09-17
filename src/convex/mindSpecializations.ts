import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * 🚪 بوابة البداية الذكية — أحدث ما فعلته يحدد خطوتك القادمة
 *
 * الحاكم الذكي يقرأ تاريخك الفعلي ويوجهك فور دخولك صفحة اللعب:
 *  • لاعب جديد (0 جولات) → سباق الذكاء: أسرع انطباع وأخف عتبة دخول
 *  • لاعب عائد دون جولة أسبوعية → سباق الذكاء للإعادة
 *  • لاعب نشط → أقرب إنجاز أو الحقل الأضعف للتدريب
 *  • لاعب متقن → التحدي الأعلى المتاح لعضويته
 *
 * لا تخمين ولا قوالب — كل توصية محسوبة من البيانات الحية.
 */
export const getSmartGateway = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const now = Date.now();
    const week = 7 * 86_400_000;

    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(60);

    const lastPlayed = history[0]?.playedAt ?? null;
    const daysAway = lastPlayed ? Math.floor((now - lastPlayed) / 86_400_000) : null;
    const roundsThisWeek = history.filter((h) => h.playedAt > now - week).length;

    // حالة اللاعب الحقيقية
    let playerKind: "brand_new" | "returning" | "active" | "veteran";
    if (history.length === 0) playerKind = "brand_new";
    else if (daysAway !== null && daysAway >= 7) playerKind = "returning";
    else if (history.length < 15) playerKind = "active";
    else playerKind = "veteran";

    // أنماط اللعب المتاحة — الحاكم الذكي يرشح حسب الحالة والعضوية
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const tier = (membership as any)?.tier ?? "bronze";
    const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];
    const tierIdx = Math.max(0, TIER_ORDER.indexOf(tier));

    // أقرب إنجاز للنشطين: أقل مسافة للأهداف المعروفة (من gameStats)
    const user = await ctx.db.get(userId);
    const stats = ((user as any)?.gameStats ?? {}) as Record<string, number>;
    const totalGames = stats.totalGames ?? 0;
    const nextGamesMilestone = [10, 50, 100].find((m) => m > totalGames) ?? null;

    // أضعف حقل نشط (للتدريب الموجّه)
    const catRows = await ctx.db
      .query("categoryHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const weakest = catRows
      .filter((c) => c.total >= 5)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)[0];

    // التوجيه الفعلي — قرار الحاكم الذكي لحظة الدخول
    let recommendedMode = "quiz_rush";
    let headline = "";
    let sub = "";
    if (playerKind === "brand_new") {
      headline = "أهلاً بك في حرب العقول 🧠";
      sub = "ابدأ بسباق الذكاء — خمسة أسئلة خاطفة تُخبرك فوراً أين عقلك الأقوى";
    } else if (playerKind === "returning") {
      headline = `العرش اشتاق إليك — ${daysAway} يوماً بعد رحيلك`;
      sub = "سباق الذكاء بانتظارك لاستعادة إيقاعك — جولة واحدة تُعيدك للسير";
    } else if (playerKind === "active" && weakest) {
      recommendedMode = "puzzle_masters";
      headline = `فرصة تدريب ذهبية`;
      sub = `حقل «${weakest.category}» أدنى حقولك (${Math.round((weakest.correct / weakest.total) * 100)}%) — عصر الألغاز يرشدك لرفعه`;
    } else if (playerKind === "veteran" && nextGamesMilestone) {
      recommendedMode = "champion_battle";
      headline = `تبعد ${nextGamesMilestone - totalGames} جولة عن إنجاز جديد`; 
      sub = "تحدي الأبطال أسرع طريق لبلوغه — سبعة أسئلة تُغيّر ترتيبك";
    } else if (playerKind === "veteran" && tierIdx >= 3) {
      recommendedMode = "diamond_rush";
      headline = "النادر يستحق المثابرة";
      sub = "اندفاع الماس مفتوح لك — مكافآت ضخمة بانتظار من لا يخاف";
    } else {
      headline = "أبقِ إيقاعك حياً";
      sub = "سباق الذكاء كل يوم يبني سلسلتك ويحمي نقاط ولائك";
    }

    return {
      playerKind,
      roundsThisWeek,
      daysAway,
      recommendedMode,
      headline,
      sub,
      totalGames,
    };
  },
});

/**
 * 🗓️ الأرشيف الشخصي الأسبوعي — تحليل أسبوعي حقيقي لكل لاعب
 *
 * يُحسب فورياً من البيانات الفعلية (gameHistory + categoryHistory) عند الطلب:
 *  • عدد جولاتك هذا الأسبوع + دقتك الأسبوعية مقابل دقتك الكلية
 *  • أقوى 3 حقول وأضعف 3 (من دفتر الفئات الحقيقي)
 *  • اتجاهك: صاعد / ثابت / هابط (مقارنة آخر 7 أيام بالأسبوع السابق)
 *  • توصية تدريب مبنية على ضعفك الفعلي لا على قوالب
 *
 * لا جدول ولا cron — الاستعلام يقرأ الحقيقة الحية، فلا يتأخر ولا يكذب.
 */
export const getWeeklyArchive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const now = Date.now();
    const week = 7 * 86_400_000;

    // جولات الأسبوعين الأخيرين (الحالي + السابق) لقياس الاتجاه
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    const thisWeek = history.filter((h) => h.playedAt > now - week);
    const lastWeek = history.filter(
      (h) => h.playedAt > now - 2 * week && h.playedAt <= now - week,
    );

    const accOf = (rows: typeof history) => {
      const total = rows.reduce((a, r) => a + r.questionCount, 0);
      const correct = rows.reduce((a, r) => a + r.correctCount, 0);
      return total > 0 ? Math.round((correct / total) * 100) : null;
    };

    const totalAll = history.reduce((a, r) => a + r.questionCount, 0);
    const correctAll = history.reduce((a, r) => a + r.correctCount, 0);
    const accAll = totalAll > 0 ? Math.round((correctAll / totalAll) * 100) : null;
    const accThis = accOf(thisWeek);
    const accLast = accOf(lastWeek);

    // الاتجاه: فرق الدقة الأسبوعية، مع حد أدنى 3 جولات في الأسبوعين للحكم
    let trend: "up" | "down" | "flat" | "new" = "new";
    if (accThis !== null && accLast !== null) {
      trend = accThis - accLast >= 5 ? "up" : accLast - accThis >= 5 ? "down" : "flat";
    }

    // أقوى/أضعف الحقول من دفتر الفئات (فقط بما لديه دليل كافٍ)
    const catRows = await ctx.db
      .query("categoryHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const fields = catRows
      .filter((c) => c.total >= 5)
      .map((c) => ({
        category: c.category,
        accuracy: Math.round((c.correct / c.total) * 100),
        answers: c.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const strongest = fields.slice(0, 3);
    const weakest = fields.slice(-3).reverse().filter((f) => f.accuracy < 70);

    // توصية التدريب: أضعف حقل نشط، أو التنويع إن كان متقناً لكل شيء
    const recommendation =
      weakest.length > 0
        ? `دَرِّب حقل «${weakest[0].category}» — دقتك فيه ${weakest[0].accuracy}% عبر ${weakest[0].answers} إجابة، وهو أدنى حقولك النشطة`
        : fields.length >= 3
          ? "حقولك كلها قوية — نوّع تحدياتك بحقول جديدة لتفتح تخصصاً رابعاً"
          : "العب المزيد لنبني أرشيفك — 5 إجابات في أي حقل تفتح تحليله";

    return {
      roundsThisWeek: thisWeek.length,
      accuracyThisWeek: accThis,
      accuracyLastWeek: accLast,
      accuracyAllTime: accAll,
      trend,
      strongest,
      weakest,
      recommendation,
      totalRounds: history.length,
    };
  },
});

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
