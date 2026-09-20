/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ v11.0 — خادم التحدّيات الحقيقية (غرفة ⇄ ملتقى ⇄ ساحة)
 *
 * المشكلة التي يحلّها: «تحدّي الغرفة» و«تحدّي الملتقى» كانا نصّاً في رسالة
 * بلا سجل وبلا لعب وبلا مكافأة. الآن كل تحدٍّ يُنشئ صفّاً حقيقياً بكود،
 * يُلعَب فعلاً في الساحة، وتُحتسب مكافأته من الخادم لا من وعد الواجهة.
 *
 * المبادئ الملزمة هنا:
 *   • لا ثقة بأرقام المتصفح — كل نتيجة تمرّ على validateRun في challengeCore.
 *   • مكافأة واحدة لكل لاعب لكل تحدٍّ (إعادة اللعب تُحسّن ترتيبك بلا ربح مضاعف).
 *   • كل قراءة مقيّدة بـ take() — لا استعلام ثقيل مهما كثرت التحدّيات.
 *   • كل قرار إداري يُسجَّل (auditLog) ويُبلّغ صاحبه (notifications).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import {
  CHALLENGE_BOARD_SIZE,
  bestPerUser,
  boardOf,
  challengeCode,
  challengeStatus,
  difficultySpec,
  gradeChallenge,
  myChallengeState,
  normalizeChallengeSpec,
  normalizeCode,
  rankOfUser,
  remainingLabel,
  rewardForRun,
  validateRun,
  type RunRow,
} from "./challengeCore";

// ───────────────────────────────────────────────────────────────────────
// أدوات داخلية
// ───────────────────────────────────────────────────────────────────────

function safe(text: string | undefined, max = 120): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function readChallengeByCode(ctx: QueryCtx | MutationCtx, rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  return ctx.db.query("challenges").withIndex("by_code", (q) => q.eq("code", code)).first();
}

async function readRuns(ctx: QueryCtx | MutationCtx, challengeId: Id<"challenges">, limit = 120) {
  return ctx.db
    .query("challengeRuns")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId))
    .order("desc")
    .take(limit);
}

function toRunRow(row: {
  userId: Id<"users">;
  userName: string;
  correct: number;
  total: number;
  score: number;
  xpAwarded: number;
  createdAt: number;
}): RunRow {
  return {
    userId: row.userId as unknown as string,
    userName: row.userName,
    correct: row.correct,
    total: row.total,
    score: row.score,
    xpAwarded: row.xpAwarded,
    createdAt: row.createdAt,
  };
}

async function awardXp(ctx: MutationCtx, userId: Id<"users">, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  const now = Date.now();
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
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
  return amount;
}

async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
  body: string,
  actionUrl?: string,
): Promise<void> {
  await ctx.db.insert("notifications", {
    userId,
    title: safe(title, 80),
    body: safe(body, 300),
    type: "info",
    read: false,
    actionUrl,
    createdAt: Date.now(),
  });
}

// ───────────────────────────────────────────────────────────────────────
// ① إنشاء تحدٍّ حقيقي — المسار الوحيد (غرفة أو ملتقى)
// ───────────────────────────────────────────────────────────────────────

export interface CreateChallengeArgs {
  source: "room" | "forum";
  title: string;
  note?: string;
  difficulty?: string | null;
  questionCount?: number | null;
  rewardXp?: number | null;
  rewardCoins?: number | null;
  ttlHours?: number | null;
  roomId?: Id<"chatRooms"> | null;
  postId?: Id<"forumPosts"> | null;
  clanId?: string | null;
  createdBy: Id<"users">;
  createdByName: string;
}

/**
 * ينشئ صفّ التحدّي بكود قابل للمشاركة، ويعيد الكود + المواصفة المضبوطة.
 * يُستدعى من غرفة الدردشة ومن الملتقى — فلا يوجد تحدٍّ بلا سجل.
 */
export async function createChallengeRecord(
  ctx: MutationCtx,
  args: CreateChallengeArgs,
): Promise<{ challengeId: Id<"challenges">; code: string; spec: ReturnType<typeof normalizeChallengeSpec>; expiresAt: number }> {
  const spec = normalizeChallengeSpec({
    difficulty: args.difficulty,
    questionCount: args.questionCount,
    rewardXp: args.rewardXp,
    rewardCoins: args.rewardCoins,
    ttlHours: args.ttlHours,
  });
  const now = Date.now();
  const expiresAt = spec.ttlHours > 0 ? now + spec.ttlHours * 60 * 60 * 1000 : 0;
  let code = challengeCode(args.source, now);
  // تصادم الأكواد نادر لكنه مرفوض: نعيد التوليد مرتين كحدّ أقصى
  for (let i = 0; i < 2; i += 1) {
    const clash = await ctx.db.query("challenges").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!clash) break;
    code = challengeCode(args.source, now + i * 7919 + Math.floor(Math.random() * 1000));
  }
  const challengeId = await ctx.db.insert("challenges", {
    code,
    source: args.source,
    roomId: args.roomId ?? undefined,
    postId: args.postId ?? undefined,
    clanId: args.clanId ?? undefined,
    title: safe(args.title, 90) || (args.source === "room" ? "تحدٍّ في الغرفة" : "تحدٍّ جماعي"),
    note: safe(args.note ?? "", 200),
    difficulty: spec.difficulty,
    questionCount: spec.questionCount,
    rewardXp: spec.rewardXp,
    rewardCoins: spec.rewardCoins,
    createdBy: args.createdBy,
    createdByName: safe(args.createdByName, 40) || "لاعب",
    status: "open",
    expiresAt,
    plays: 0,
    completions: 0,
    rewardedCount: 0,
    xpGranted: 0,
    bestScore: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { challengeId, code, spec, expiresAt };
}

// ───────────────────────────────────────────────────────────────────────
// ② قراءة التحدّي للاعب — كل ما يلزم لبدء اللعب فعلاً
// ───────────────────────────────────────────────────────────────────────

export const getChallenge = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const row = await readChallengeByCode(ctx, args.code);
    if (!row) return null;
    const now = Date.now();
    const runs = await readRuns(ctx, row._id);
    const rows = runs.map(toRunRow);
    const status = challengeStatus(row, now);
    const meId = await getAuthUserId(ctx);
    return {
      id: row._id as unknown as string,
      code: row.code,
      source: row.source,
      title: row.title,
      note: row.note,
      difficulty: row.difficulty,
      difficultyLabel: difficultySpec(row.difficulty).label,
      difficultyEmoji: difficultySpec(row.difficulty).emoji,
      seconds: difficultySpec(row.difficulty).seconds,
      questionCount: row.questionCount,
      rewardXp: row.rewardXp,
      rewardCoins: row.rewardCoins,
      createdByName: row.createdByName,
      status,
      playable: status === "open",
      remaining: remainingLabel(row, now),
      plays: row.plays,
      completions: row.completions,
      rewardedCount: row.rewardedCount,
      participants: new Set(rows.map((r) => r.userId)).size,
      board: boardOf(rows, CHALLENGE_BOARD_SIZE),
      myRank: meId ? rankOfUser(rows, meId as unknown as string) : 0,
      mine: meId ? myChallengeState(rows, meId as unknown as string) : null,
      roomId: (row.roomId as unknown as string) ?? null,
    };
  },
});

/** تحدّيات غرفة معيّنة (لتعرضها لوحة الغرفة بحالة حقيقية لكل تحدٍّ). */
export const getRoomChallenges = query({
  args: { roomId: v.id("chatRooms") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("challenges")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .order("desc")
      .take(12);
    const now = Date.now();
    const meId = await getAuthUserId(ctx);
    const out = [];
    for (const row of rows) {
      const runs = await readRuns(ctx, row._id, 60);
      const mapped = runs.map(toRunRow);
      out.push({
        id: row._id as unknown as string,
        code: row.code,
        title: row.title,
        difficulty: row.difficulty,
        questionCount: row.questionCount,
        rewardXp: row.rewardXp,
        rewardCoins: row.rewardCoins,
        status: challengeStatus(row, now),
        remaining: remainingLabel(row, now),
        plays: row.plays,
        participants: new Set(mapped.map((r) => r.userId)).size,
        rewardedCount: row.rewardedCount,
        bestScore: row.bestScore,
        createdAt: row.createdAt,
        mine: meId ? myChallengeState(mapped, meId as unknown as string) : null,
      });
    }
    return out;
  },
});

/** آخر تحدّيات الملتقى — تُعرض كشرائح قابلة للعب داخل الملتقى. */
export const getForumChallenges = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("challenges").withIndex("by_source", (q) => q.eq("source", "forum")).order("desc").take(8);
    const now = Date.now();
    return rows.map((row) => ({
      id: row._id as unknown as string,
      code: row.code,
      title: row.title,
      difficulty: row.difficulty,
      questionCount: row.questionCount,
      rewardXp: row.rewardXp,
      rewardCoins: row.rewardCoins,
      status: challengeStatus(row, now),
      remaining: remainingLabel(row, now),
      createdByName: row.createdByName,
      participants: row.plays,
      rewardedCount: row.rewardedCount,
    }));
  },
});

// ───────────────────────────────────────────────────────────────────────
// ③ إتمام التحدّي — هنا تُدفع المكافأة الحقيقية
// ───────────────────────────────────────────────────────────────────────

export const submitChallengeRun = mutation({
  args: {
    code: v.string(),
    correct: v.number(),
    total: v.number(),
    score: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول لتُحتسب مكافأة التحدّي");
    const challenge = await readChallengeByCode(ctx, args.code);
    if (!challenge) throw new Error("التحدّي غير موجود — تحقّق من الكود");

    const now = Date.now();
    if (challengeStatus(challenge, now) !== "open") {
      throw new Error("انتهت صلاحية هذا التحدّي أو أُغلق");
    }

    const validation = validateRun(
      { correct: args.correct, total: args.total, score: args.score, durationMs: args.durationMs },
      challenge.questionCount,
    );
    if (!validation.ok) throw new Error(validation.reason);

    const me = await ctx.db.get(meId);
    const previous = await ctx.db
      .query("challengeRuns")
      .withIndex("by_challenge_user", (q) => q.eq("challengeId", challenge._id).eq("userId", meId))
      .take(20);
    const alreadyRewarded = previous.some((r) => r.xpAwarded > 0);

    const reward = rewardForRun({
      correct: validation.run.correct,
      total: validation.run.total,
      difficulty: challenge.difficulty,
      rewardXp: challenge.rewardXp,
      rewardCoins: challenge.rewardCoins,
      suspicious: validation.suspicious,
    });

    // مكافأة واحدة لكل لاعب: إعادة اللعب تُحسّن ترتيبك فقط
    const rewardedNow = !alreadyRewarded && reward.passed;
    const xpAwarded = rewardedNow ? reward.xp : 0;
    const coinsAwarded = rewardedNow ? reward.coins : 0;

    await ctx.db.insert("challengeRuns", {
      challengeId: challenge._id,
      code: challenge.code,
      userId: meId,
      userName: safe(me?.name ?? "لاعب", 40),
      correct: validation.run.correct,
      total: validation.run.total,
      score: validation.run.score,
      durationMs: validation.run.durationMs,
      suspicious: validation.suspicious,
      xpAwarded,
      coinsAwarded,
      grade: reward.grade.tier,
      createdAt: now,
    });

    if (xpAwarded > 0) await awardXp(ctx, meId, xpAwarded);

    // تحدّي عشيرة ⇒ مكافأة العملات تُموَّل خزينة العشيرة فعلاً
    let coinsTo: "purse" | "treasury" = "purse";
    let treasuryCoins = 0;
    if (coinsAwarded > 0 && challenge.clanId) {
      const treasury = await ctx.db
        .query("clanTreasury")
        .withIndex("by_clan", (q) => q.eq("clanId", challenge.clanId as never))
        .first();
      if (treasury) {
        await ctx.db.patch(treasury._id, { coins: treasury.coins + coinsAwarded, updatedAt: now });
        coinsTo = "treasury";
        treasuryCoins = coinsAwarded;
      }
    }

    const bestScore = Math.max(challenge.bestScore, validation.run.score);
    await ctx.db.patch(challenge._id, {
      plays: challenge.plays + 1,
      completions: challenge.completions + (reward.passed ? 1 : 0),
      rewardedCount: challenge.rewardedCount + (rewardedNow ? 1 : 0),
      xpGranted: challenge.xpGranted + xpAwarded,
      bestScore,
      updatedAt: now,
    });

    // إشعار صاحب التحدّي عند تجاوز أفضل نتيجة سابقة
    if ((challenge.createdBy as unknown as string) !== (meId as unknown as string) && bestScore > 0 && validation.run.score >= bestScore) {
      await notify(
        ctx,
        challenge.createdBy,
        `⚔️ ${me?.name ?? "لاعب"} تصدّر تحدّيك`,
        `${challenge.title} — ${validation.run.correct}/${validation.run.total} · النقاط ${validation.run.score}`,
        `/arena?challenge=${challenge.code}`,
      );
    }

    return {
      ok: true,
      code: challenge.code,
      grade: reward.grade,
      passed: reward.passed,
      rewardedNow,
      alreadyRewarded,
      xpAwarded,
      coinsAwarded,
      coinsTo,
      treasuryCoins,
      note: alreadyRewarded && reward.passed
        ? "نلت مكافأة هذا التحدّي سابقاً — هذه المحاولة تُحسّن ترتيبك فقط"
        : reward.note,
      bestScore,
    };
  },
});

/** آخر محاولاتي — يعرضها اللاعب في تبويب العقل/الملف بصدق. */
export const getMyChallengeRuns = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return [];
    const rows = await ctx.db
      .query("challengeRuns")
      .withIndex("by_user", (q) => q.eq("userId", meId))
      .order("desc")
      .take(15);
    const titles = new Map<string, string>();
    for (const row of rows) {
      if (!titles.has(row.code)) {
        const ch = await ctx.db.get(row.challengeId);
        titles.set(row.code, ch?.title ?? "تحدٍّ");
      }
    }
    return rows.map((row) => ({
      code: row.code,
      title: titles.get(row.code) ?? "تحدٍّ",
      correct: row.correct,
      total: row.total,
      score: row.score,
      xpAwarded: row.xpAwarded,
      grade: row.grade,
      gradeLabel: gradeChallenge(row.correct, row.total).label,
      createdAt: row.createdAt,
    }));
  },
});

// ───────────────────────────────────────────────────────────────────────
// ④ سيطرة المالك — نبضة + قائمة + إغلاق/إعادة فتح
// ───────────────────────────────────────────────────────────────────────

export const challengePulse = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    const me = meId ? await ctx.db.get(meId) : null;
    if (!isOwnerUser(me)) return null;
    const now = Date.now();
    const rows = await ctx.db.query("challenges").order("desc").take(200);
    const open = rows.filter((r) => challengeStatus(r, now) === "open");
    const expired = rows.filter((r) => challengeStatus(r, now) === "expired");
    const closed = rows.filter((r) => challengeStatus(r, now) === "closed");
    const bySource = { room: 0, forum: 0 } as Record<string, number>;
    for (const row of rows) bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    return {
      total: rows.length,
      open: open.length,
      expired: expired.length,
      closed: closed.length,
      bySource,
      plays: rows.reduce((s, r) => s + r.plays, 0),
      completions: rows.reduce((s, r) => s + r.completions, 0),
      rewarded: rows.reduce((s, r) => s + r.rewardedCount, 0),
      xpGranted: rows.reduce((s, r) => s + r.xpGranted, 0),
      top: rows
        .slice()
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 8)
        .map((r) => ({
          id: r._id as unknown as string,
          code: r.code,
          title: r.title,
          source: r.source,
          status: challengeStatus(r, now),
          difficulty: r.difficulty,
          plays: r.plays,
          rewarded: r.rewardedCount,
          xpGranted: r.xpGranted,
          createdByName: r.createdByName,
          remaining: remainingLabel(r, now),
        })),
    };
  },
});

export const ownerListChallenges = query({
  args: { filter: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    const me = meId ? await ctx.db.get(meId) : null;
    if (!isOwnerUser(me)) return [];
    const now = Date.now();
    const rows = await ctx.db.query("challenges").order("desc").take(60);
    const filter = args.filter ?? "all";
    return rows
      .filter((r) => {
        const status = challengeStatus(r, now);
        if (filter === "open") return status === "open";
        if (filter === "expired") return status === "expired";
        if (filter === "closed") return status === "closed";
        if (filter === "room" || filter === "forum") return r.source === filter;
        return true;
      })
      .slice(0, 30)
      .map((r) => ({
        id: r._id as unknown as string,
        code: r.code,
        title: r.title,
        note: r.note,
        source: r.source,
        status: challengeStatus(r, now),
        difficulty: r.difficulty,
        questionCount: r.questionCount,
        rewardXp: r.rewardXp,
        rewardCoins: r.rewardCoins,
        plays: r.plays,
        rewarded: r.rewardedCount,
        xpGranted: r.xpGranted,
        bestScore: r.bestScore,
        createdByName: r.createdByName,
        remaining: remainingLabel(r, now),
        createdAt: r.createdAt,
      }));
  },
});

export const ownerSetChallengeStatus = mutation({
  args: { challengeId: v.id("challenges"), status: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(meId);
    if (!isOwnerUser(me)) throw new Error("غير مصرح — هذه الصلاحية للمالك");

    const status = args.status === "closed" ? "closed" : "open";
    const row = await ctx.db.get(args.challengeId);
    if (!row) throw new Error("التحدّي غير موجود");
    await ctx.db.patch(args.challengeId, {
      status,
      updatedAt: Date.now(),
      // عند إعادة الفتح نمنح مهلة جديدة حتى لا يبقى منتهياً للأبد
      expiresAt: status === "open" && row.expiresAt > 0 && row.expiresAt <= Date.now() ? Date.now() + 72 * 60 * 60 * 1000 : row.expiresAt,
    });

    await ctx.db.insert("auditLog", {
      actorId: meId,
      actorName: me?.name ?? "المالك",
      actorRole: "owner",
      action: status === "closed" ? "challenge_closed" : "challenge_reopened",
      detail: `${row.title} (${row.code}) — ${safe(args.reason ?? "قرار سيادي", 120)}`,
      at: Date.now(),
    });

    if (status === "closed") {
      await notify(ctx, row.createdBy, "⚖️ أُغلق تحدّيك", `${row.title} — ${safe(args.reason ?? "قرار إداري", 120)}`);
    } else {
      await notify(ctx, row.createdBy, "✅ أُعيد فتح تحدّيك", `${row.title} — يمكن للاعبين اللعب من جديد`);
    }
    return { ok: true, status };
  },
});

/** حذف صفوف انتهت صلاحيتها منذ أكثر من ٣٠ يوماً — يحفظ مساحة القاعدة. */
export const internalSweepChallenges = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query("challenges").withIndex("by_status_expiry", (q) => q.eq("status", "closed")).take(50);
    let removed = 0;
    for (const row of rows) {
      if (row.expiresAt > 0 && row.expiresAt < cutoff) {
        const runs = await ctx.db
          .query("challengeRuns")
          .withIndex("by_challenge", (q) => q.eq("challengeId", row._id))
          .take(200);
        for (const run of runs) await ctx.db.delete(run._id);
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    return { removed };
  },
});

/** أفضل النتائج في تحدٍّ ما — يُستخدم في الملتقى والغرفة بقراءة مقيّدة. */
export async function challengeBoardFor(
  ctx: QueryCtx,
  challengeId: Id<"challenges">,
  size = CHALLENGE_BOARD_SIZE,
): Promise<RunRow[]> {
  const runs = await readRuns(ctx, challengeId);
  return boardOf(runs.map(toRunRow), size);
}

export { bestPerUser };
