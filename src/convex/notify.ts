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
import { OWNER_EMAIL } from "./owner";

/**
 * أدخل إشعاراً للاعب (أو الكل بـ "__all__") — الاستخدام الداخلي فقط.
 *
 * ⚠️ لم يعد يكتب في القاعدة مباشرةً: يمرّ عبر `smartNotifications.smartPush`
 * ليخضع لنفس السياسة الموحدة (الكتم · ساعات الهدوء · الأولوية · السقف الساعي).
 * قبل هذا التغيير كان كل إشعار يمرّ من هنا يتجاوز تفضيلات اللاعب تماماً،
 * فيكتم اللاعب «المبارزات» وتصله دعوة مبارزة فوراً — زر الكتم كان يكذب.
 */
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
    /** فئة الإشعار الحقيقية — تُسند تلقائياً إلى system إن غابت. */
    category: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("critical"), v.literal("important"), v.literal("normal")),
    ),
    actionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // النتيجة لا تُستهلك هنا: القرار (تسليم/تأجيل/إسقاط) يُسجَّل في مركز الذكاء
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      category: args.category ?? "system",
      priority: args.priority,
      actionUrl: args.actionUrl,
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
      category: "duels",
      priority: "important",
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
      category: "duels",
      priority: "important",
      actionUrl: "/play",
    });
    await ctx.runMutation(internal.notify.push, {
      userId: p.playerBId,
      title: "نتيجة مبارزة الحلبة",
      body: `${p.playerAName} — ${lineB}`,
      type: "info",
      category: "duels",
      priority: "important",
      actionUrl: "/play",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إشعار إذن المالك — يصل للمالك لحظة وصول طلب الحاكم السيادي إلى بوابة إذنه
// ─────────────────────────────────────────────────────────────────────────

export const ownerPermissionRequested = internalMutation({
  args: { proposalId: v.string(), title: v.string(), summary: v.string(), risk: v.string(), proposerRole: v.string() },
  handler: async (ctx, { proposalId, title, summary, risk, proposerRole }) => {
    const ownerId = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", OWNER_EMAIL))
      .first();
    if (!ownerId) return;
    const who = proposerRole === "sovereign_governor" ? "الحاكم السيادي" : proposerRole === "deputy_owner" ? "نائب المالك" : "طلب تطوير";
    const riskLabel = risk === "critical" ? "خطر حرج" : risk === "medium" ? "خطر متوسط" : "خطر منخفض";
    await ctx.runMutation(internal.notify.push, {
      userId: ownerId._id,
      title: "⚖️ طلب تطوير بانتظار إذنك",
      body: `${who} — ${title} (${riskLabel}): ${summary}`,
      type: "warning",
      category: "system",
      priority: "critical",
      actionUrl: `/governance-console?proposal=${proposalId}`,
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
      category: "events",
      priority: "important",
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
          category: "streaks",
          // مهمة لا حرجة: سلوك «عد والعب» يجب أن يحترم ساعات الهدوء والكتم
          priority: "important",
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
