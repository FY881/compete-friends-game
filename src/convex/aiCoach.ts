/**
 * ═══════════════════════════════════════════════════════════════════
 * AI Coach الشخصي — تحليل عميق + توصيات ذكية + أهداف شخصية
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, action, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

// ─── Analyze Player Performance ────────────────────────────────
export const analyzePerformance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const games = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (!profile || games.length === 0) {
      return {
        level: 1,
        totalGames: 0,
        winRate: 0,
        avgScore: 0,
        bestStreak: 0,
        strengths: [],
        weaknesses: [],
        suggestions: ["العب أول جولة لبدء التحليل!"],
        nextGoal: "فز بأول جولة لك",
        weeklyTrend: "new",
      };
    }

    const totalGames = games.length;
    const gamesWon = games.filter((g) => (g.score ?? 0) > 0).length;
    const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;
    const avgScore = totalGames > 0 ? Math.round(games.reduce((sum, g) => sum + (g.score ?? 0), 0) / totalGames) : 0;
    const bestScore = Math.max(...games.map((g) => g.score ?? 0), 0);

    // Analyze strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    if (winRate >= 60) strengths.push("نسبة فوز ممتازة!");
    else if (winRate < 40) weaknesses.push("نسبة الفوز منخفضة — حاول التركيز أكثر");

    if (avgScore >= 200) strengths.push("متوسط نقاط عالي");
    else if (avgScore < 100) weaknesses.push("متوسط النقاط منخفض — أجب أسرع");

    if (totalGames >= 50) strengths.push("لاعب نشط جداً");
    if (totalGames < 10) suggestions.push("العب أكثر لتحسين مهاراتك");

    // Recent performance trend (last 10 games)
    const recentGames = games.slice(-10);
    const recentAvg = recentGames.length > 0
      ? Math.round(recentGames.reduce((sum, g) => sum + (g.score ?? 0), 0) / recentGames.length)
      : 0;
    const olderGames = games.slice(-20, -10);
    const olderAvg = olderGames.length > 0
      ? Math.round(olderGames.reduce((sum, g) => sum + (g.score ?? 0), 0) / olderGames.length)
      : 0;

    const weeklyTrend = recentAvg > olderAvg + 20 ? "improving"
      : recentAvg < olderAvg - 20 ? "declining"
      : "stable";

    // Level calculations
    const totalXp = games.reduce((sum, g) => sum + (g.score ?? 0), 0);
    let level = 1;
    let xpNeeded = 100;
    let xpAccumulated = 0;
    while (xpAccumulated + xpNeeded <= totalXp) {
      xpAccumulated += xpNeeded;
      level++;
      xpNeeded = Math.floor(xpNeeded * 1.15);
    }

    // Smart suggestions
    if (weeklyTrend === "declining") {
      suggestions.push("أداؤك ينخفض مؤخراً — خذ استراحة قصيرة ثم عد بتركيز أعلى");
    }
    if (strengths.length === 0 && weaknesses.length === 0) {
      suggestions.push("العب أكثر لتحسين مهاراتك واحصل على تحليل أعمق");
    }
    if (suggestions.length === 0) {
      suggestions.push("أداؤك مستقر — حاول تحدٍّي أصدقائك في تحدي 1v1");
    }

    // Next goal
    let nextGoal = "";
    if (level < 5) nextGoal = "بلغ المستوى 5";
    else if (level < 10) nextGoal = "بلغ المستوى 10 وافتح الألعاب الجديدة";
    else if (level < 25) nextGoal = "بلغ المستوى 25 وأصبحت خبيراً";
    else if (winRate < 50) nextGoal = "حسّن نسبة فوزك إلى 50%";
    else nextGoal = "حافظ على أدائك الممتاز وتحدى أصدقاءك";

    return {
      level,
      totalGames,
      gamesWon,
      winRate,
      avgScore,
      bestScore,
      bestStreak: Math.max(...games.map((g) => (g as Record<string, unknown>).bestStreak as number ?? 0), 0),
      totalXp,
      strengths,
      weaknesses,
      suggestions,
      nextGoal,
      weeklyTrend,
      recentPerformance: recentAvg,
    };
  },
});

// ─── AI Chat for Coaching ─────────────────────────────────────
export const coachChat = action({
  args: {
    message: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { message, sessionId }) => {
    await ensureAiRuntime(ctx); // حقن النظامين المضبوطين من مركز API
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error(
        "لا يوجد نظام API مُفعّل — فعّل النظام الأول (مفتاح + رابط) أو الثاني (مفتاح فقط) من مركز API",
      );
    }

    const userId = await getAuthUserId(ctx);

    let playerContext = "لاعب جديد — لا يوجد بيانات كافية";
    if (userId) {
      const profile = await ctx.runQuery(internal.aiCoach.getPlayerContext, { userId: userId as string });
      if (profile) {
        playerContext = `اللاعب: ${profile.name} | المستوى: ${profile.level} | XP: ${profile.totalXp} | فوز: ${profile.gamesWon}/${profile.totalGames} (${profile.winRate}%) | أفضل سلسلة: ${profile.bestStreak} | آخر 10 ألعاب: ${profile.recentScores.join(", ")}`;
      }
    }

    const systemPrompt = `أنت AI Coach شخصي متقدم في لعبة "حرب العقول". أنت مدرب ذكي يتابع أداء اللاعب ويقدم نصائح مخصصة.

سياق اللاعب الحالي:
${playerContext}

مهمتك:
1. حلل أداء اللاعب ونقاط قوته وضعفه
2. اقترح تحديات وتمارين مخصصة لتحسين المستوى
3. قدم تحفيز وتعزيز إيجابي
4. كن ودوداً ومحفزاً ومفيداً
5. أجب بالعربية فقط
6. كن مختصراً وواضحاً (3-5 جمل)

إذا سأل عن إحصائيات، اعرض ما تملك من بيانات.
إذا سأل عن نصائح، أعطِ نصيحة محددة وعملية.
إذا سأل عن تحدي، اقترح تحدياً مناسباً لمستواه.`;

    // ⚡ الترقية: المدرّب لديه ذاكرة دائمة عن كل لاعب + تقييم ذاتي + ثقة
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `aiCoach:${userId ?? "anonymous"}`,
      systemPrompt,
      [{ role: "user", content: message }],
      1024,
      0.7,
    );
    // يتعلم أسلوب اللاعب المفضل عبر الزمن
    if (message.length > 30) {
      await rememberFor(ctx, `aiCoach:${userId ?? "anonymous"}`, "preference", `أسلوب تفاعل اللاعب: ${message.slice(0, 150)}`, 3);
    }

    // Save to memory
    await ctx.runMutation((internal as any).aiCoach.saveCoachMemory, {
      sessionId,
      role: "user",
      content: message,
    });
    await ctx.runMutation((internal as any).aiCoach.saveCoachMemory, {
      sessionId,
      role: "assistant",
      content: reply,
    });

    return { reply };
  },
});

// ─── Internal helpers ─────────────────────────────────────────
export const getPlayerContext = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId as any);
    if (!user || !('name' in user)) return null;

    const games = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .collect();

    const totalGames = games.length;
    const gamesWon = games.filter((g) => (g.score ?? 0) > 0).length;
    const totalXp = games.reduce((sum, g) => sum + (g.score ?? 0), 0);
    const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;

    // Calculate level
    let level = 1;
    let xpNeeded = 100;
    let xpAccumulated = 0;
    while (xpAccumulated + xpNeeded <= totalXp) {
      xpAccumulated += xpNeeded;
      level++;
      xpNeeded = Math.floor(xpNeeded * 1.15);
    }

    return {
      name: user.name ?? "مجهول",
      level,
      totalXp,
      totalGames,
      gamesWon,
      winRate,
      bestStreak: Math.max(...games.map((g) => (g as Record<string, unknown>).bestStreak as number ?? 0), 0),
      recentScores: games.slice(-10).map((g) => g.score ?? 0),
    };
  },
});

export const saveCoachMemory = internalMutation({
  args: {
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiFreeMemory", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

// ─── Proactive Insights (runs on-demand) ──────────────────────
export const getProactiveInsights = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const games = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const insights: string[] = [];
    const tips: string[] = [];

    if (games.length === 0) {
      return {
        insights: ["أنت لاعب جديد — ابدأ بلعب أول جولة!"],
        tips: ["اختار الأسئلة السريعة أولاً", "التركيز على الإجابة الصحيحة أهم من السرعة"],
        encouragement: "🎉 مرحباً بك في حرب العقول!",
      };
    }

    const totalGames = games.length;
    const gamesWon = games.filter((g) => (g.score ?? 0) > 0).length;
    const avgScore = totalGames > 0 ? Math.round(games.reduce((sum, g) => sum + (g.score ?? 0), 0) / totalGames) : 0;

    // Analyze play patterns
    const lastWeekGames = games.filter((g) => Date.now() - g.playedAt < 7 * 24 * 60 * 60 * 1000);
    if (lastWeekGames.length < 5) {
      tips.push("أنت تلعب أقل من 5 جولات أسبوعياً — حاول اللعب أكثر لتحسين مهاراتك");
    }

    if (avgScore > 200) {
      insights.push("أداؤك ممتاز! نقاطك أعلى من المتوسط");
    }

    if (gamesWon > totalGames * 0.7) {
      insights.push("نسبة فوزك عالية جداً — أنت من أفضل اللاعبين!");
    }

    // Check play time patterns
    const hours = games.map((g) => new Date(g.playedAt).getHours());
    const morningGames = hours.filter((h) => h >= 6 && h < 12).length;
    const eveningGames = hours.filter((h) => h >= 18 && h < 24).length;
    if (eveningGames > morningGames * 2) {
      tips.push("أنت تلعب أكثر في المساء — حاول اللعب صباحاً للحصول على مكافآت الصباح");
    }

    // Encouragement
    let encouragement = "";
    if (gamesWon === 0) {
      encouragement = "💡 حاول التركيز أكثر — كل لاعب كبير بدأ من هنا!";
    } else if (avgScore > 150) {
      encouragement = "🌟 أنت على الطريق الصحيح! استمر في التحسن";
    } else {
      encouragement = "💪 لا تستسلم! كل جولة هي فرصة للتحسن";
    }

    return {
      insights: insights.length > 0 ? insights : ["أداؤك مستقر — حاول تحدي أصدقاءك!"],
      tips: tips.length > 0 ? tips : ["حافظ على تركيزك أثناء اللعب", "الإجابة الصحيحة أهم من السرعة"],
      encouragement,
    };
  },
});
