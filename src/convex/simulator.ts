/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 10 — محاكي «ماذا لو» الاستراتيجي (أداة المالك)
 *
 * يكتب المالك سؤالاً استراتيجياً («ماذا لو ضاعفت مكافآت الموسم؟»)،
 * فيجمع المحاكي إحصاءات حقيقية من قاعدة البيانات (جولات، لاعبين، دقة،
 * سلاسل، بطولات) ويرسلها مع السؤال إلى نموذج الذكاء ليصبح التحليل
 * مبنياً على أرقام واقعية لا تخمين — ثم يُسجَّل كل تحليل في سجلّ
 * القرارات الموحّد للشفافية الكاملة.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

/** لقطة حقيقية من قاعدة البيانات تُغذّي النموذج. */
async function gatherStats(ctx: any) {
  const now = Date.now();
  const since7d = now - 7 * 24 * 60 * 60 * 1000;

  const history = await ctx.db
    .query("gameHistory")
    .withIndex("by_created", (q: any) => q.gte("playedAt", since7d))
    .collect()
    .catch(() => [] as any[]);

  // gameHistory has no by_created index in some deployments — fall back to a broad scan
  const rows = history.length > 0 ? history : await ctx.db.query("gameHistory").collect();

  const users = await ctx.db.query("users").collect();
  const profiles = await ctx.db.query("profiles").collect();
  const tournaments = await ctx.db.query("tournaments").collect();
  const decisions7d = await ctx.db
    .query("aiDecisionLog")
    .withIndex("by_created", (q: any) => q.gte("createdAt", since7d))
    .collect();

  const activePlayers = new Set<string>();
  let totalScore = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let wins = 0;
  for (const r of rows) {
    if (r.playedAt >= since7d) activePlayers.add(String(r.userId));
    totalScore += r.score ?? 0;
    totalCorrect += r.correctCount ?? 0;
    totalQuestions += r.questionCount ?? 0;
    if (r.won) wins++;
  }

  // متوسط الفجوة بين الأول والثاني (مؤشر تنافسية)
  const byGame = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byGame.get(String(r.gameId)) ?? [];
    arr.push(r.score ?? 0);
    byGame.set(String(r.gameId), arr);
  }
  let gapSum = 0;
  let gapCount = 0;
  for (const scores of byGame.values()) {
    if (scores.length >= 2) {
      const sorted = [...scores].sort((a, b) => b - a);
      gapSum += sorted[0] - sorted[1];
      gapCount++;
    }
  }

  return {
    totalUsers: users.length,
    totalRounds: rows.length,
    roundsLast7d: rows.filter((r: any) => r.playedAt >= since7d).length,
    activePlayersLast7d: activePlayers.size,
    avgScorePerRound: rows.length ? Math.round(totalScore / rows.length) : 0,
    accuracyPct: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    winRatePct: rows.length ? Math.round((wins / rows.length) * 100) : 0,
    avgFirstSecondGap: gapCount ? Math.round(gapSum / gapCount) : 0,
    tournamentsTotal: tournaments.length,
    aiDecisionsLast7d: decisions7d.length,
    avgXpPerPlayer: profiles.length
      ? Math.round(profiles.reduce((s: number, p: any) => s + (p.xp ?? 0), 0) / profiles.length)
      : 0,
  };
}

export type SimulationStats = Awaited<ReturnType<typeof gatherStats>>;

/** إحصاءات حقيقية معروضة بجانب المحاكي (للمالك فقط). */
export const getStatsSnapshot = query({
  args: {},
  handler: async (ctx): Promise<SimulationStats | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;
    return gatherStats(ctx);
  },
});

/** آخر تحليلات المحاكي (للمالك فقط). */
export const getHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const rows = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(150);
    return rows
      .filter((r) => r.action === "whatif_simulation")
      .slice(0, Math.min(Math.max(limit ?? 10, 1), 30))
      .map((r) => ({
        id: r._id,
        question: r.targetName ?? "",
        detail: r.detail,
        createdAt: r.createdAt,
      }));
  },
});

/** قراءة داخلية لمستخدم (للاستخدام من داخل action بلا ctx.db). */
const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    return u ? { email: u.email ?? null, role: u.role ?? null } : null;
  },
});

export { getUserById };

/** كتابة داخليّة — سطر واحد في سجلّ القرارات الموحّد. */
const logSimulation = internalMutation({
  args: { question: v.string(), detail: v.string() },
  handler: async (ctx, { question, detail }) => {
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "محاكي ماذا لو",
      action: "whatif_simulation",
      targetName: question,
      detail,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

export { logSimulation };

/**
 * تشغيل التحليل: يجمع الأرقام الواقعية، يرسلها مع سؤال المالك إلى النموذج،
 * ويعيد تحليلاً استراتيجياً مبنياً على البيانات + سيناريو مبسط.
 */
export const runSimulation = action({
  args: { question: v.string() },
  handler: async (ctx, { question }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.runQuery(internal.simulator.getUserById, { userId });
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح — أداة المالك فقط");

    const q = question.trim();
    if (q.length < 5) throw new Error("اكتب سؤالك الاستراتيجي أولاً");
    if (q.length > 400) throw new Error("السؤال طويل جداً — 400 حرف كحد أقصى");

    await ensureAiRuntime(ctx);
    const stats = await gatherStats(ctx);

    const statsText = [
      `إجمالي المستخدمين: ${stats.totalUsers}`,
      `جولات ملعوبة (الكل): ${stats.totalRounds} — منها ${stats.roundsLast7d} في آخر 7 أيام`,
      `لاعبون نشطون آخر 7 أيام: ${stats.activePlayersLast7d}`,
      `متوسط نقاط الجولة: ${stats.avgScorePerRound}`,
      `دقة الإجابات: ${stats.accuracyPct}%`,
      `نسبة الجولات التي فيها فائز: ${stats.winRatePct}%`,
      `متوسط فارق الأول عن الثاني: ${stats.avgFirstSecondGap} نقطة (تنافسية)`,
      `بطولات أُقيمت: ${stats.tournamentsTotal}`,
      `قرارات AI آخر 7 أيام: ${stats.aiDecisionsLast7d}`,
      `متوسط خبرة اللاعب: ${stats.avgXpPerPlayer}`,
    ].join("\n");

    const systemPrompt = `أنت «خبير القياس» في مجلس عقول لعبة "حرب العقول" — محلل استراتيجي يعتمد على البيانات الحقيقية فقط.
سؤال المالك يبدأ غالباً بـ«ماذا لو…». مهمتك:
1. أجب على افتراض المالك بتحليل مبني على الأرقام المرفقة (اقتبس الأرقام فعلياً).
2. قدّر التأثير المتوقع على: الاحتفاظ باللاعبين، التنافسية، الاقتصاد (نقاط الولاء)، وعبء الإشراف.
3. اذكر مخاطرة واحدة على الأقل وبديلة عملية.
اجعل الإجابة بالعربية، منظمة بعناوين قصيرة ورموز تعبيرية، بحد أقصى ~220 كلمة. لا تؤلف أرقاماً غير موجودة.`;

    const content = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `سؤال المالك: ${q}\n\nالأرقام الحقيقية من قاعدة البيانات:\n${statsText}` },
      ],
      1100,
      0.6,
      "MindClash What-If Simulator",
    );

    const answer = (content ?? "").trim() || "تعذّر توليد تحليل — حاول مرة أخرى.";

    // شفافية كاملة: كل تحليل يُسجَّل في سجلّ القرارات الموحّد
    await ctx.runMutation(internal.simulator.logSimulation, {
      question: q.slice(0, 120),
      detail: answer.slice(0, 280),
    });

    return { answer, stats };
  },
});
