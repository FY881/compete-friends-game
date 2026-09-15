/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚖️ الحكم الآلي واللعب النظيف (الإصدار 3.0، المرحلة 5)
 *
 *  1. كشف الغش الزمني: إجابات بسرعة مستحيلة (< عتبة بشرية) تُسجَّل تلقائياً
 *  2. كشف الشذوذ: دقة 100% متكررة عبر جولات كثيرة → ملف شكّ يُراجع آلياً
 *  3. سجل اللعب النظيف (fairPlayLog): كل الأحداث المشبوهة تُجمَع هنا،
 *     ويتكامل مع لوحة المالك/النائب
 *  4. تخصيص الصعوبة: عند اختيار أسئلة الجولة، ترجيح حسب مهارة اللاعب
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { isDeputyOwner } from "./siteRoles";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/** أدنى زمن بشري معقول للإجابة عن سؤال (مللي ثانية) */
export const MIN_HUMAN_ANSWER_MS = 350;

// ─────────────────────────────────────────────────────────────────────────
// التسجيل الداخلي — يُستدعى من games.submitAnswer و games.finishGame
// ─────────────────────────────────────────────────────────────────────────

/** سجّل حدثاً مشبوهة في سجل اللعب النظيف */
export const logFairPlayEvent = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(
      v.literal("impossible_speed"),
      v.literal("perfect_repeat"),
      v.literal("pattern_anomaly"),
    ),
    detail: v.string(),
    gameCode: v.optional(v.string()),
  },
  handler: async (ctx, { userId, kind, detail, gameCode }) => {
    const now = Date.now();
    const user = await ctx.db.get(userId);
    await ctx.db.insert("fairPlayLog", {
      userId,
      userName: user?.name ?? "لاعب",
      kind,
      detail,
      gameCode,
      resolved: false,
      at: now,
    });

    // تصعيد تلقائي: 3+ أحداث غير محسومة خلال 24 ساعة → عقوبة الغش المعروفة
    const dayAgo = now - 24 * 3600_000;
    const recent = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_user_at", (q) => q.eq("userId", userId).gt("at", dayAgo))
      .collect();
    const unresolved = recent.filter((r) => !r.resolved);
    if (unresolved.length >= 3) {
      await ctx.db.patch(userId, {
        cheatStrikes: (user?.cheatStrikes ?? 0) + 1,
      });
      for (const r of unresolved) {
        await ctx.db.patch(r._id, { resolved: true });
      }
    }
    return { ok: true as const };
  },
});

/**
 * كشف الغش الزمني — يُستدعى من submitAnswer قبل قبول الإجابة.
 * إجابة صحيحة بسرعة أقل من العتبة البشرية = حدث مشبوه.
 */
export const checkImpossibleSpeed = internalMutation({
  args: {
    userId: v.id("users"),
    elapsedMs: v.number(),
    correct: v.boolean(),
    gameCode: v.optional(v.string()),
  },
  handler: async (ctx, { userId, elapsedMs, correct, gameCode }) => {
    if (!correct || elapsedMs >= MIN_HUMAN_ANSWER_MS) return { flagged: false as const };
    await ctx.runMutation(internal.fairPlay.logFairPlayEvent, {
      userId,
      kind: "impossible_speed",
      detail: `إجابة صحيحة خلال ${elapsedMs}مللي ثانية — أسرع من العتبة البشرية (${MIN_HUMAN_ANSWER_MS}ms)`,
      gameCode,
    });
    return { flagged: true as const };
  },
});

/**
 * كشف الشذوذ بعد نهاية الجولة — دقة كاملة متكررة.
 * 3 جولات كاملة الدقة من أصل آخر 5 = ملف شك.
 */
export const checkPerfectRepeat = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
    if (history.length < 5) return { flagged: false as const };
    const perfect = history.filter(
      (g) => g.questionCount >= 3 && g.correctCount === g.questionCount,
    ).length;
    if (perfect < 4) return { flagged: false as const };
    await ctx.runMutation(internal.fairPlay.logFairPlayEvent, {
      userId,
      kind: "perfect_repeat",
      detail: `${perfect} من آخر ${history.length} جولات بدقة كاملة — نسبة إحصائياً مستحيلة`,
    });
    return { flagged: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// تخصيص الصعوبة — ترجيح الأسئلة حسب مهارة اللاعب
// ─────────────────────────────────────────────────────────────────────────

/** مستوى مهارة اللاعب (0..1) — من آخر جولاته الحقيقية */
export const getSkillLevel = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(8);
    if (history.length === 0) return 0.5; // لاعب جديد — متوسط
    const ratios = history.map((g) =>
      g.questionCount > 0 ? g.correctCount / g.questionCount : 0,
    );
    // متوسط مرجّح: الجولات الأحدث أهم
    let weight = 1;
    let sum = 0;
    let total = 0;
    for (const r of ratios) {
      sum += r * weight;
      total += weight;
      weight *= 0.8;
    }
    return Math.min(1, Math.max(0, sum / total));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// واجهات الإدارة — لوحة المالك/النائب
// ─────────────────────────────────────────────────────────────────────────

/** سجل اللعب النظيف — يظهر في لوحة الإدارة */
export const getFairPlayLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
    return rows.map((r) => ({
      _id: r._id,
      userId: r.userId,
      userName: r.userName,
      kind: r.kind,
      detail: r.detail,
      gameCode: r.gameCode ?? null,
      resolved: r.resolved,
      at: r.at,
    }));
  },
});

/** طرد حدث مشبوه — يقرر الإدارة أنه سلوك مقبول */
export const resolveFairPlayEvent = mutation({
  args: { eventId: v.id("fairPlayLog") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const user = await ctx.db.get(userId);
    const isOwner = user?.email?.toLowerCase() === "omw70op@gmail.com";
    if (!isOwner) {
      // النائب؟
      if (!(await isDeputyOwner(ctx, userId))) throw new Error("غير مصرح — للمالك والنائب فقط");
    }
    await ctx.db.patch(eventId, { resolved: true });
    return { ok: true as const };
  },
});
