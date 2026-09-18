/**
 * ═══════════════════════════════════════════════════════════════════════
 * مركز التقدم — الواجهة الخلفية
 * ═══════════════════════════════════════════════════════════════════════
 * مهام يومية/أسبوعية + معالم + مفضلة + دعوات + ألقاب + إعدادات.
 * كل التقدم يُحسب من بيانات اللعب الحقيقية (gameHistory، dailyChallenges، profiles).
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { levelFromXp } from "./gameConfig";
import { QUESTION_BANK } from "./questions";
import {
  DEFAULT_PLAYER_SETTINGS,
  DAILY_QUESTS,
  MILESTONES,
  TITLES,
  WEEKLY_QUESTS,
  claimableMilestones,
  computeDailyQuestProgress,
  computeWeeklyQuestProgress,
  dayKey,
  generateReferralCode,
  isTitleUnlocked,
  normalizeReferralCode,
  REFERRAL_REWARD_INVITER_XP,
  REFERRAL_REWARD_REDEEMER_XP,
  startOfDayTs,
  weekKey,
} from "../lib/progression";
import {
  buildActivityTrend,
  buildInsights,
  categoryBreakdown,
  difficultyBreakdown,
} from "../lib/analytics";
import type { PlayerSettings, QuestInput, QuestKind } from "../lib/progression";

// ─── أدوات مساعدة ─────────────────────────────────────────────────────────

async function getProfileOrNull(ctx: any, userId: string) {
  return ctx.db.query("profiles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
}

async function awardXp(ctx: any, userId: string, amount: number) {
  const now = Date.now();
  const profile = await getProfileOrNull(ctx, userId);
  if (profile) {
    await ctx.db.patch(profile._id, { xp: (profile.xp ?? 0) + amount, updatedAt: now });
  } else {
    await ctx.db.insert("profiles", {
      userId,
      xp: amount,
      gamesPlayed: 0,
      gamesWon: 0,
      bestScore: 0,
      bestStreak: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      badges: [],
      updatedAt: now,
    });
  }
}

/** تجميع مدخلات المهام من السجلات الحقيقية. */
async function collectQuestInput(ctx: any, userId: string): Promise<QuestInput> {
  const now = Date.now();
  const today = dayKey(now);
  const todayStart = startOfDayTs(today);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const history = await ctx.db
    .query("gameHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const challenges = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_user_day", (q: any) => q.eq("userId", userId))
    .collect();

  const todayGames = history.filter((h: any) => h.playedAt >= todayStart);
  const weekGames = history.filter((h: any) => h.playedAt >= weekAgo);
  const todayChallenge = challenges.find((c: any) => c.day === today);
  const weekChallenges = challenges.filter((c: any) => c.day >= dayKey(weekAgo));

  return {
    gamesToday: todayGames.length,
    winsToday: todayGames.filter((h: any) => h.won).length,
    correctToday:
      todayGames.reduce((s: number, h: any) => s + (h.correctCount ?? 0), 0) +
      (todayChallenge?.correctCount ?? 0),
    dailyChallengeDoneToday: Boolean(todayChallenge),
    games7d: weekGames.length,
    wins7d: weekGames.filter((h: any) => h.won).length,
    correct7d:
      weekGames.reduce((s: number, h: any) => s + (h.correctCount ?? 0), 0) +
      weekChallenges.reduce((s: number, c: any) => s + (c.correctCount ?? 0), 0),
    xp7d:
      weekGames.reduce((s: number, h: any) => s + (h.xpEarned ?? 0), 0) +
      weekChallenges.reduce((s: number, c: any) => s + (c.xpEarned ?? 0), 0),
    perfectGame7d: weekGames.some((h: any) => h.questionCount > 0 && h.correctCount === h.questionCount),
  };
}

/** الخريطة: kind+periodKey+questId → مطلوب/مستلم. */
async function collectClaims(ctx: any, userId: string) {
  const rows = await ctx.db
    .query("questClaims")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  const set = new Set<string>();
  for (const row of rows) {
    set.add(`${row.kind}:${row.periodKey}:${row.questId}`);
  }
  return set;
}

function questDefById(kind: QuestKind, id: string) {
  const defs = kind === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS;
  return defs.find((d) => d.id === id);
}

function milestoneById(id: string) {
  return MILESTONES.find((m) => m.id === id);
}

/** قراءة أو إنشاء إعدادات اللاعب. */
async function getSettingsDoc(ctx: any, userId: string) {
  const doc = await ctx.db
    .query("playerSettings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  return doc;
}

// ─── الاستعلام الرئيسي: كل شيء في طلب واحد ───────────────────────────────

export const getHub = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const profile = await getProfileOrNull(ctx, userId);
    const xp = profile?.xp ?? 0;
    const level = levelFromXp(xp);
    const now = Date.now();
    const today = dayKey(now);
    const week = weekKey(now);

    const input = await collectQuestInput(ctx, userId);
    const claims = await collectClaims(ctx, userId);

    const daily = computeDailyQuestProgress(input).map((p) => ({
      ...p,
      claimed: claims.has(`daily:${today}:${p.quest.id}`),
    }));
    const weekly = computeWeeklyQuestProgress(input).map((p) => ({
      ...p,
      claimed: claims.has(`weekly:${week}:${p.quest.id}`),
    }));

    const milestones = MILESTONES.map((m) => ({
      ...m,
      reached: xp >= m.xp,
      claimed: claims.has(`milestone:${m.id}:${m.id}`),
    }));

    const titleInput = {
      gamesPlayed: profile?.gamesPlayed ?? 0,
      gamesWon: profile?.gamesWon ?? 0,
      accuracy:
        (profile?.totalAnswers ?? 0) > 0
          ? Math.round(((profile?.correctAnswers ?? 0) / (profile?.totalAnswers ?? 1)) * 100)
          : 0,
      bestStreak: profile?.bestStreak ?? 0,
      fastestAnswerMs: profile?.fastestAnswerMs ?? null,
      correctAnswers: profile?.correctAnswers ?? 0,
      level,
      // ⚠️ هذا الاستعلام مشترك من كل تبويب في «ملتقى العقول»، وكان يقرأ
      // **كل** تاريخ اللاعب بلا حدّ — وكل كتابة في gameHistory تُعيد تشغيله.
      // الآن: قراءة مفهرسة محدودة بأحدث ٥٠٠ جولة (كافية لكل الألقاب والأهداف).
      perfectGames: await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .order("desc")
        .take(500)
        .then((rows: any[]) =>
          rows.filter((r: any) => r.questionCount >= 1 && r.correctCount === r.questionCount).length,
        ),
      dailyStreak: profile?.dailyStreak ?? 0,
    };
    const settingsDoc = await getSettingsDoc(ctx, userId);
    const settings: PlayerSettings = settingsDoc
      ? {
          soundEnabled: settingsDoc.soundEnabled,
          musicEnabled: settingsDoc.musicEnabled,
          motionLevel: settingsDoc.motionLevel,
          notificationsEnabled: settingsDoc.notificationsEnabled,
          theme: settingsDoc.theme,
        }
      : { ...DEFAULT_PLAYER_SETTINGS };

    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();

    const user = await ctx.db.get(userId);

    return {
      profile: {
        xp,
        level,
        gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
        winRate:
          (profile?.gamesPlayed ?? 0) > 0
            ? Math.round(((profile?.gamesWon ?? 0) / (profile?.gamesPlayed ?? 1)) * 100)
            : 0,
        bestScore: profile?.bestScore ?? 0,
        bestStreak: profile?.bestStreak ?? 0,
        correctAnswers: profile?.correctAnswers ?? 0,
        totalAnswers: profile?.totalAnswers ?? 0,
        accuracy:
          (profile?.totalAnswers ?? 0) > 0
            ? Math.round(((profile?.correctAnswers ?? 0) / (profile?.totalAnswers ?? 1)) * 100)
            : 0,
        dailyStreak: profile?.dailyStreak ?? 0,
        canClaimDaily: profile ? profile.lastClaimDay !== today : true,
        name: user?.name ?? "لاعب",
      },
      daily,
      weekly,
      milestones,
      titles: TITLES.map((t) => ({
        ...t,
        unlocked: isTitleUnlocked(t.id, titleInput),
        equipped: settingsDoc?.equippedTitle === t.id,
      })),
      settings,
      referral: {
        code: referral?.code ?? null,
        redeemedCount: referral?.appliedBy.length ?? 0,
      },
      favoritesCount: favorites.length,
      claimableCount:
        daily.filter((d) => d.completed && !d.claimed).length +
        weekly.filter((w) => w.completed && !w.claimed).length +
        claimableMilestones(xp, new Set(claims)).length,
    };
  },
});

// ─── المطالبة بالمهام والمعالم ────────────────────────────────────────────

export const claimQuest = mutation({
  args: { kind: v.union(v.literal("daily"), v.literal("weekly"), v.literal("milestone")), questId: v.string() },
  handler: async (ctx, { kind, questId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const now = Date.now();
    const periodKey = kind === "daily" ? dayKey(now) : kind === "weekly" ? weekKey(now) : questId;

    // منع المطالبة المزدوجة
    const existing = await ctx.db
      .query("questClaims")
      .withIndex("by_user_kind_period", (q: any) =>
        q.eq("userId", userId).eq("kind", kind).eq("periodKey", periodKey),
      )
      .filter((q: any) => q.eq(q.field("questId"), questId))
      .first();
    if (existing) throw new Error("استلمت هذه المكافأة بالفعل");

    // التحقق من اكتمال المهمة فعلياً (لا يُثق بالعميل)
    let rewardXp = 0;
    const input = await collectQuestInput(ctx, userId);

    if (kind === "daily") {
      const def = questDefById("daily", questId);
      if (!def) throw new Error("مهمة غير معروفة");
      const progress = computeDailyQuestProgress(input).find((p) => p.quest.id === questId);
      if (!progress?.completed) throw new Error("المهمة لم تكتمل بعد");
      rewardXp = def.rewardXp;
    } else if (kind === "weekly") {
      const def = questDefById("weekly", questId);
      if (!def) throw new Error("مهمة غير معروفة");
      const progress = computeWeeklyQuestProgress(input).find((p) => p.quest.id === questId);
      if (!progress?.completed) throw new Error("المهمة لم تكتمل بعد");
      rewardXp = def.rewardXp;
    } else {
      const def = milestoneById(questId);
      if (!def) throw new Error("معلم غير معروف");
      const profile = await getProfileOrNull(ctx, userId);
      if ((profile?.xp ?? 0) < def.xp) throw new Error("لم تصل لهذا المعلم بعد");
      rewardXp = def.rewardXp;
    }

    await ctx.db.insert("questClaims", { userId, kind, periodKey, questId, claimedAt: now });
    await awardXp(ctx, userId, rewardXp);
    return { rewardXp };
  },
});

// ─── المفضلة ──────────────────────────────────────────────────────────────

const QUESTION_MAP = new Map(QUESTION_BANK.map((q) => [q.id, q]));

export const getFavorites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const rows = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return rows
      .map((row) => {
        const q = QUESTION_MAP.get(row.questionId);
        if (!q) return null;
        return {
          questionId: q.id,
          category: q.category,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          addedAt: row.addedAt,
        };
      })
      .filter((x) => x !== null);
  },
});

export const toggleFavorite = mutation({
  args: { questionId: v.string() },
  handler: async (ctx, { questionId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (!QUESTION_MAP.has(questionId)) throw new Error("سؤال غير موجود");

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_question", (q: any) => q.eq("userId", userId).eq("questionId", questionId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false };
    }
    await ctx.db.insert("favorites", { userId, questionId, addedAt: Date.now() });
    return { added: true };
  },
});

// ─── الدعوات ──────────────────────────────────────────────────────────────

export const ensureReferral = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (existing) return { code: existing.code, redeemedCount: existing.appliedBy.length };

    const user = await ctx.db.get(userId);
    let code = generateReferralCode(user?.name ?? "");
    // ضمان التفرد
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query("referrals").withIndex("by_code", (q: any) => q.eq("code", code)).first();
      if (!clash) break;
      code = generateReferralCode(`${user?.name ?? "PLAYER"}${i}`);
    }
    await ctx.db.insert("referrals", { userId, code, appliedBy: [], createdAt: Date.now() });
    return { code, redeemedCount: 0 };
  },
});

export const applyReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const clean = normalizeReferralCode(code);
    if (clean.length < 6) throw new Error("الكود غير صالح");

    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_code", (q: any) => q.eq("code", clean))
      .first();
    if (!referral) throw new Error("هذا الكود غير موجود");
    if (referral.userId === userId) throw new Error("لا يمكنك استخدام كودك الخاص");
    if (referral.appliedBy.includes(userId as any)) throw new Error("استخدمت هذا الكود من قبل");

    await ctx.db.patch(referral._id, { appliedBy: [...referral.appliedBy, userId] });
    await awardXp(ctx, userId, REFERRAL_REWARD_REDEEMER_XP);
    await awardXp(ctx, referral.userId, REFERRAL_REWARD_INVITER_XP);

    return {
      inviterXp: REFERRAL_REWARD_INVITER_XP,
      myXp: REFERRAL_REWARD_REDEEMER_XP,
      total: referral.appliedBy.length + 1,
    };
  },
});

// ─── الألقاب ──────────────────────────────────────────────────────────────

export const equipTitle = mutation({
  args: { titleId: v.string() },
  handler: async (ctx, { titleId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (!TITLES.some((t) => t.id === titleId)) throw new Error("لقب غير معروف");

    // التحقق من الفتح
    const profile = await getProfileOrNull(ctx, userId);
    const level = levelFromXp(profile?.xp ?? 0);
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const unlocked = isTitleUnlocked(titleId, {
      gamesPlayed: profile?.gamesPlayed ?? 0,
      gamesWon: profile?.gamesWon ?? 0,
      accuracy:
        (profile?.totalAnswers ?? 0) > 0
          ? Math.round(((profile?.correctAnswers ?? 0) / (profile?.totalAnswers ?? 1)) * 100)
          : 0,
      bestStreak: profile?.bestStreak ?? 0,
      fastestAnswerMs: profile?.fastestAnswerMs ?? null,
      correctAnswers: profile?.correctAnswers ?? 0,
      level,
      perfectGames: history.filter((r: any) => r.questionCount > 0 && r.correctCount === r.questionCount).length,
      dailyStreak: profile?.dailyStreak ?? 0,
    });
    if (!unlocked) throw new Error("لم تفتح هذا اللقب بعد");

    const existing = await getSettingsDoc(ctx, userId);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { equippedTitle: titleId, updatedAt: now });
    } else {
      await ctx.db.insert("playerSettings", {
        userId,
        ...DEFAULT_PLAYER_SETTINGS,
        equippedTitle: titleId,
        updatedAt: now,
      });
    }
    return { equipped: titleId };
  },
});

// ─── التحليلات الشخصية ────────────────────────────────────────────────────

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const profile = await getProfileOrNull(ctx, userId);
    const xp = profile?.xp ?? 0;
    const level = levelFromXp(xp);

    // آخر سجلات اللعب (للمنحنى اليومي)
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const recentGames = [...history]
      .sort((a: any, b: any) => b.playedAt - a.playedAt)
      .slice(0, 300);
    const trend = buildActivityTrend(
      recentGames.map((g: any) => ({
        playedAt: g.playedAt,
        correctCount: g.correctCount ?? 0,
        xpEarned: g.xpEarned ?? 0,
      })),
      7,
    );

    // عينات الإجابات من أرشيف الأسئلة (آخر 800)
    const archive = await ctx.db
      .query("questionArchive")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const samples = [...archive]
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 800)
      .map((a: any) => ({
        category: a.category ?? "عام",
        difficulty: a.difficulty ?? "easy",
        wasCorrect: Boolean(a.wasCorrect),
      }));

    const categories = categoryBreakdown(samples);
    const difficulties = difficultyBreakdown(samples);
    const overallAccuracy =
      (profile?.totalAnswers ?? 0) > 0
        ? Math.round(((profile?.correctAnswers ?? 0) / (profile?.totalAnswers ?? 1)) * 100)
        : samples.length > 0
          ? Math.round((samples.filter((s) => s.wasCorrect).length / samples.length) * 100)
          : 0;

    const totals = {
      games: profile?.gamesPlayed ?? 0,
      wins: profile?.gamesWon ?? 0,
      answered: profile?.totalAnswers ?? samples.length,
      accuracy: overallAccuracy,
      bestStreak: profile?.bestStreak ?? 0,
      trendGames: trend.reduce((s: number, t: any) => s + t.games, 0),
      trendCorrect: trend.reduce((s: number, t: any) => s + t.correct, 0),
      trendXp: trend.reduce((s: number, t: any) => s + t.xp, 0),
    };

    const insights = buildInsights({
      answered: totals.answered,
      accuracy: totals.accuracy,
      totalGames: totals.games,
      wins: totals.wins,
      bestStreak: totals.bestStreak,
      categories,
    });

    const user = await ctx.db.get(userId);
    return {
      player: { name: user?.name ?? "لاعب", level, xp },
      trend,
      categories,
      difficulties,
      totals,
      insights,
    };
  },
});

// ─── الإعدادات ────────────────────────────────────────────────────────────

export const updateSettings = mutation({
  args: {
    soundEnabled: v.boolean(),
    musicEnabled: v.boolean(),
    motionLevel: v.union(v.literal("full"), v.literal("reduced"), v.literal("off")),
    notificationsEnabled: v.boolean(),
    theme: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
  },
  handler: async (ctx, settings) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const existing = await getSettingsDoc(ctx, userId);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...settings, updatedAt: now });
    } else {
      await ctx.db.insert("playerSettings", { userId, ...settings, updatedAt: now });
    }
    return { saved: true };
  },
});