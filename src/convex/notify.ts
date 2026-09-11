/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔔 إشعارات اللاعبين الآلية — حلقة جذب اللاعبين للعودة
 *
 * إشعارات فورية داخل التطبيق (تصل لجرس الإشعارات + إشعار المتصفح):
 *  - تحدٍّ مبارزة: عند تزاوج طابور الحلبة / إنشاء غرفة مبارزة
 *  - نتيجة المبارزة: فوز/خسارة/تعادل بعد كل مبارزة حلبة
 *  - بدء البطولة: إشعار عام عند إطلاق بطولة أسبوعية جديدة
 *  - السلسلة اليومية المعرّضة للانقطاع: دورة كل ساعة تنبّه من لم يلعب اليوم
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** أدخل إشعاراً للاعب (أو الكل بـ "__all__") — الاستخدام الداخلي فقط. */
export const push = internalMutation({
  args: {
    userId: v.union(v.literal("__all__"), v.id("users")),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("ban"),
      v.literal("update"),
      v.literal("system"),
    ),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      read: false,
      actionUrl: args.actionUrl,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إشعار تحدٍّ مبارزة — يُستدعى من arena.createDuelRoom عند تزاوج الطابور
// ─────────────────────────────────────────────────────────────────────────

export const duelChallenge = internalMutation({
  args: {
    opponentId: v.id("users"),
    challengerName: v.string(),
    gameCode: v.string(),
  },
  handler: async (ctx, { opponentId, challengerName, gameCode }) => {
    await ctx.runMutation(internal.notify.push, {
      userId: opponentId,
      title: "⚔️ تحدٍّ جديد!",
      body: `${challengerName} أرسلك إلى مبارزة حلبة — الغرفة جاهزة الآن!`,
      type: "info",
      actionUrl: `/game/${gameCode}`,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إشعار نتيجة مبارزة الحلبة — يُستدعى من arena.recordDuelResult
// ─────────────────────────────────────────────────────────────────────────

export const duelResult = internalMutation({
  args: {
    playerAId: v.id("users"),
    playerAName: v.string(),
    playerAScore: v.number(),
    playerANewRating: v.number(),
    playerBId: v.id("users"),
    playerBName: v.string(),
    playerBScore: v.number(),
    playerBNewRating: v.number(),
    outcome: v.union(v.literal("a"), v.literal("b"), v.literal("draw")),
  },
  handler: async (ctx, p) => {
    const base = (won: boolean) =>
      won ? "🎉 فوز مجيد!" : "⚔️ هزيمة — الثأر ممكن دائماً";
    const lineA = `${base(p.outcome === "a")} النتيجة ${p.playerAScore} : ${p.playerBScore} — تصنيفك الجديد ${p.playerANewRating}`;
    const lineB = `${base(p.outcome === "b")} النتيجة ${p.playerBScore} : ${p.playerAScore} — تصنيفك الجديد ${p.playerBNewRating}`;
    await ctx.runMutation(internal.notify.push, {
      userId: p.playerAId,
      title: "نتيجة مبارزة الحلبة",
      body: `${p.playerBName} — ${lineA}`,
      type: "info",
      actionUrl: "/play",
    });
    await ctx.runMutation(internal.notify.push, {
      userId: p.playerBId,
      title: "نتيجة مبارزة الحلبة",
      body: `${p.playerAName} — ${lineB}`,
      type: "info",
      actionUrl: "/play",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إشعار بدء بطولة جديدة — يُستدعى من autoTournament عند الإطلاق
// ─────────────────────────────────────────────────────────────────────────

export const tournamentStarted = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await ctx.runMutation(internal.notify.push, {
      userId: "__all__",
      title: "🏆 بطولة جديدة انطلقت!",
      body: `بطولة «${name}» مفتوحة الآن — انضم قبل اكتمال المقاعد!`,
      type: "update",
      actionUrl: "/play",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// السلسلة اليومية المعرّضة للانقطاع — دورة كل ساعة: نبّه كل من لعب
// بالأمس ولم يلعب اليوم (السلسلة تنقطع في منتصف الليل) — مرة واحدة يومياً
// ─────────────────────────────────────────────────────────────────────────

function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const streakRiskSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = dayKey(now);
    const lastNotifiedKey = "streak-risk:last-notified";
    const flag = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", lastNotifiedKey))
      .first();
    if (flag?.value === today) return { skipped: true as const };

    const profiles = await ctx.db.query("profiles").collect();
    let warned = 0;
    for (const pr of profiles) {
      // لعِب بالأمس (لديه سلسلة) ولم يلعب اليوم — سلسلته مهددة
      if ((pr.dailyStreak ?? 0) > 0 && pr.lastPlayedDay && pr.lastPlayedDay !== today) {
        // تجنّب التكرار: تخطَّ من نبهناهم بالفعل اليوم (نفحص إشعاراتهم)
        const recent = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", pr.userId))
          .order("desc")
          .take(15);
        const already = recent.some(
          (n) => n.title.includes("السلسلة") && now - n.createdAt < 20 * 3600_000,
        );
        if (already) continue;
        await ctx.runMutation(internal.notify.push, {
          userId: pr.userId,
          title: "🔥 سلسلتك اليومية مهددة!",
          body: `سلسلة ${pr.dailyStreak} يوم ستنقطع في منتصف الليل — العب جولة واحدة الآن لتحفظها!`,
          type: "warning",
          actionUrl: "/play",
        });
        warned++;
      }
    }
    if (flag) {
      await ctx.db.patch(flag._id, { value: today });
    } else {
      await ctx.db.insert("systemFlags", { key: lastNotifiedKey, value: today });
    }
    return { warned };
  },
});
