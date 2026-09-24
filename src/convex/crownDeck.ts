import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { getCurrentUser } from "./users";
import { isOwnerUser } from "./owner";
import { callCenterLlm } from "./apiCore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 CROWN DECK — غرفة المالك v5.0 «العرش» — المرحلة أ
 *
 * 1. مركز القيادة الحي 360°: نبضة موحّدة حية من كل الأنظمة في استعلام واحد
 * 2. المستشار AI للمالك: إجابات Gemini من البيانات الحقيقية الحية
 * 3. محاكي القرارات: يحاكي أثر التغيير الخطير قبل تطبيقه (أرقام حقيقية)
 * 4. بطاقة الصحة اليومية: تقييم 0–100 صادر كل صباح مع الأسباب
 * 5. رادار المخاطر التنبؤي: يرصد الأنماط قبل وقوع الأزمة
 * ═══════════════════════════════════════════════════════════════════════
 */

const MODEL = "gemini-3.6-flash";

async function callGemini(ctx: unknown, prompt: string, maxTokens = 700): Promise<string | null> {
  try {
    return await callCenterLlm(
      ctx,
      [{ role: "user", content: prompt }],
      maxTokens,
      0.3,
      "Zaka Crown Deck",
      "simulator",
    );
  } catch {
    return null;
  }
}

async function isOwner(ctx: any): Promise<boolean> {
  const me = await getCurrentUser(ctx);
  return isOwnerUser(me);
}

/** يُعيد بيانات المالك الحالي أو null — للاستخدام في الـ mutations */
async function getCurrentOwnerUser(ctx: any) {
  const me = await getCurrentUser(ctx);
  if (!me || !isOwnerUser(me)) return null;
  return me;
}

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ مركز القيادة الحي 360° — كل الأنظمة في نبضة واحدة (استعلام حي واحد)
// ═══════════════════════════════════════════════════════════════════════

export const getPulse360 = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const dayAgo = now - 86_400_000;

    const [users, openReports, errors24h, rounds, chat24h, settings] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("reports").withIndex("by_status" as any, (q: any) => q.eq("status", "open")).collect(),
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", dayAgo)).collect(),
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", dayAgo)).collect(),
      ctx.db.query("chatMessages").withIndex("by_created" as any, (q: any) => q.gte("createdAt", dayAgo)).collect(),
      ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "antiCheatEnabled")).unique(),
    ]);

    const activePlayers = new Set(rounds.map((r: any) => String(r.userId)));
    const criticalCount = errors24h.filter(
      (e: any) => e.severity === "critical" || String(e.message ?? "").includes("Server Error"),
    ).length;

    const systems = [
      { id: "players", name: "اللاعبون", healthy: activePlayers.size > 0, value: `${activePlayers.size} نشط / ${users.length}`, severity: activePlayers.size > 0 ? "ok" : "warn" },
      { id: "reports", name: "البلاغات", healthy: openReports.length < 5, value: `${openReports.length} مفتوح`, severity: openReports.length >= 10 ? "critical" : openReports.length >= 5 ? "warn" : "ok" },
      { id: "errors", name: "صياد الأخطاء", healthy: criticalCount === 0, value: `${errors24h.length} خطأ · ${criticalCount} حرج`, severity: criticalCount > 0 ? "critical" : errors24h.length > 20 ? "warn" : "ok" },
      { id: "chat", name: "المجتمع", healthy: chat24h.length > 0, value: `${chat24h.length} رسالة/24س`, severity: chat24h.length === 0 ? "warn" : "ok" },
      { id: "anticheat", name: "مكافحة الغش", healthy: settings?.value === "true", value: settings?.value === "true" ? "مفعّلة" : "متوقفة", severity: settings?.value === "true" ? "ok" : "warn" },
    ];

    const worst = systems.find((s) => s.severity === "critical");
    const overall = worst ? "critical" : systems.some((s) => s.severity === "warn") ? "warn" : "ok";

    return {
      at: now,
      overall,
      systems,
      totals: {
        users: users.length,
        activePlayers: activePlayers.size,
        openReports: openReports.length,
        errors24h: errors24h.length,
        criticalErrors24h: criticalCount,
        chatMsgs24h: chat24h.length,
        rounds24h: rounds.length,
      },
      alerts: [
        ...(criticalCount > 0 ? [{ severity: "critical", text: `${criticalCount} خطأ حرج خلال 24 ساعة` }] : []),
        ...(openReports.length >= 5 ? [{ severity: "warn", text: `${openReports.length} بلاغ مفتوح` }] : []),
        ...(settings?.value !== "true" ? [{ severity: "warn", text: "نظام مكافحة الغش متوقف" }] : []),
      ],
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ المستشار AI للمالك — إجابات من بيانات حية حقيقية
// ═══════════════════════════════════════════════════════════════════════

export const askAdvisor = action({
  args: { question: v.string() },
  handler: async (ctx, { question }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { answer: null as string | null, reason: "غير مصرح" };
    const q = question.trim().slice(0, 400);
    if (!q) return { answer: null as string | null, reason: "سؤال فارغ" };

    const pulse = await ctx.runQuery(api.crownDeck.getPulse360, {});
    if (!pulse) return { answer: null as string | null, reason: "غير مصرح" };

    const evidence = JSON.stringify(
      {
        الإجماليات: pulse.totals,
        الأنظمة: pulse.systems.map((s: any) => `${s.name}: ${s.value} (${s.severity})`),
        التنبيهات: pulse.alerts.map((a: any) => a.text),
      },
      null,
      1,
    );

    const raw = await callGemini(
      ctx,
      `أنت المستشار الشخصي لمالك لعبة «حرب العقول» (كويز عربية). أجب بالعربية، موجزاً وعملياً، بناءً حصرياً على هذه البيانات الحية:\n\n${evidence}\n\nسؤال المالك: ${q}\n\nإذا كانت البيانات غير كافية للإجابة قل ذلك بصراحة ثم أعطِ أفضل ما يمكن استنتاجه. اجعل الإجابة من 3 إلى 8 أسطر مع توصية واضحة في النهاية.`,
      600,
    );
    return { answer: raw as string | null, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY أو فشل الاتصال" };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ محاكي القرارات — ماذا سيحدث لو نُفّذ التغيير؟ (أرقام حقيقية)
// ═══════════════════════════════════════════════════════════════════════

export const simulateDecision = action({
  args: {
    decision: v.string(),
    domain: v.union(
      v.literal("economy"),
      v.literal("matching"),
      v.literal("community"),
      v.literal("content"),
      v.literal("membership"),
    ),
  },
  handler: async (ctx, { decision, domain }) => {
    const pulse = await ctx.runQuery(api.crownDeck.getPulse360, {});
    if (!pulse) return { simulation: null as string | null, reason: "غير مصرح" };

    const weekAgo = Date.now() - 7 * 86_400_000;
    const roundsWeek = await ctx.runQuery(internal.crownDeck.getRoundsWindowInternal, { since: weekAgo });

    const context = JSON.stringify({
      القرار_المقترح: decision,
      المجال: domain,
      لاعبون: pulse.totals.users,
      نشاط_24س: { جولات: pulse.totals.rounds24h, نشطون: pulse.totals.activePlayers },
      جولات_أسبوع: roundsWeek,
      بلاغات_مفتوحة: pulse.totals.openReports,
    });

    const raw = await callGemini(
      ctx,
      `أنت محلل استراتيجي للعبة «حرب العقول». حلّل أثر هذا القرار قبل تطبيقه، بالعربية، بهذا التنسيق الدقيق:\n\nالتوقع: <ماذا سيحدث خلال أسبوع — من سطرين إلى ثلاثة>\nالفرصة: <أكبر مكسب متوقع>\nالخطر: <أكبر خسارة أو ضرر محتمل>\nدرجة الأمان: <آمن أو متوسط أو خطير>\nالتوصية: <نفّذ الآن أو جرّب على نطاق صغير أو لا تنفّذ>\n\nالسياق الحي:\n${context}`,
      700,
    );
    return { simulation: raw as string | null, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY" };
  },
});

export const getRoundsWindowInternal = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const rounds = await ctx.db
      .query("gameHistory")
      .withIndex("by_played" as any, (q: any) => q.gte("playedAt", since))
      .collect();
    return rounds.length;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ بطاقة الصحة اليومية — تقييم 0–100 + الأسباب (تُحفظ نسخة يومية واحدة)
// ═══════════════════════════════════════════════════════════════════════

type DailyHealth = {
  day: string;
  score: number;
  verdict: string;
  reasons: string[];
  generatedAt: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeHealthScore(totals: {
  users: number; rounds24h: number; openReports: number; errors24h: number; criticalErrors24h: number; chatMsgs24h: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  if (totals.criticalErrors24h > 0) {
    const penalty = Math.min(30, totals.criticalErrors24h * 8);
    score -= penalty;
    reasons.push(`−${penalty}: ${totals.criticalErrors24h} خطأ حرج خلال 24 ساعة`);
  }
  if (totals.errors24h > 10) {
    const penalty = Math.min(15, Math.floor(totals.errors24h / 5));
    score -= penalty;
    reasons.push(`−${penalty}: حجم الأخطاء مرتفع (${totals.errors24h})`);
  }
  if (totals.openReports >= 5) {
    const penalty = Math.min(15, totals.openReports);
    score -= penalty;
    reasons.push(`−${penalty}: ${totals.openReports} بلاغ مفتوح`);
  }
  if (totals.users > 0) {
    const activity = totals.rounds24h / Math.max(1, totals.users);
    if (activity < 0.1) {
      score -= 20;
      reasons.push(`−20: نشاط منخفض جداً (${Math.round(activity * 100)}% من اللاعبين لعبوا)`);
    } else if (activity > 0.5) {
      reasons.push(`نشاط ممتاز: ${Math.round(activity * 100)}% نسبة اللعب`);
    }
  } else {
    score -= 10;
    reasons.push("−10: لا يوجد لاعبون مسجلون");
  }
  if (totals.chatMsgs24h === 0 && totals.users > 3) {
    score -= 5;
    reasons.push("−5: المجتمع صامت تماماً اليوم");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export const getDailyHealthCard = query({
  args: {},
  handler: async (ctx): Promise<DailyHealth | null> => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const dayAgo = now - 86_400_000;

    const [users, rounds, openReports, errors, chat] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", dayAgo)).collect(),
      ctx.db.query("reports").withIndex("by_status" as any, (q: any) => q.eq("status", "open")).collect(),
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", dayAgo)).collect(),
      ctx.db.query("chatMessages").withIndex("by_created" as any, (q: any) => q.gte("createdAt", dayAgo)).collect(),
    ]);

    const totals = {
      users: users.length,
      rounds24h: rounds.length,
      openReports: openReports.length,
      errors24h: errors.length,
      criticalErrors24h: errors.filter((e: any) => e.severity === "critical" || String(e.message ?? "").includes("Server Error")).length,
      chatMsgs24h: chat.length,
    };
    const { score, reasons } = computeHealthScore(totals);
    const verdict =
      score >= 85 ? "اللعبة بصحة ممتازة 👑" :
      score >= 70 ? "اللعبة صحية مع ملاحظات" :
      score >= 50 ? "تحتاج انتباهاً — توجد مشاكل متصاعدة" :
      "حالة حرجة — تدخل عاجل مطلوب";

    return { day: todayKey(), score, verdict, reasons, generatedAt: now };
  },
});

// 5️⃣ رادار المخاطر التنبؤي — أنماط قبل الأزمة
export const getRiskRadar = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const signals: { level: "high" | "medium" | "low"; title: string; detail: string; window: string }[] = [];

    const [rounds48, errors48, reportsWeek, chat24] = await Promise.all([
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", now - 48 * 3600_000)).collect(),
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", now - 48 * 3600_000)).collect(),
      ctx.db.query("reports").withIndex("by_created" as any, (q: any) => q.gte("createdAt", now - 7 * 86_400_000)).collect(),
      ctx.db.query("chatMessages").withIndex("by_created" as any, (q: any) => q.gte("createdAt", now - 24 * 3600_000)).collect(),
    ]);

    const last24 = rounds48.filter((r: any) => r.playedAt >= now - 24 * 3600_000).length;
    const prev24 = rounds48.length - last24;
    if (prev24 >= 5 && last24 < prev24 * 0.5) {
      signals.push({
        level: "high",
        title: "انهيار محتمل في النشاط",
        detail: `الجولات هبطت من ${prev24} إلى ${last24} خلال 24 ساعة — نمط يسبق فقدان اللاعبين عادة.`,
        window: "24 ساعة",
      });
    }

    const errorsLast24 = errors48.filter((e: any) => e.createdAt >= now - 24 * 3600_000).length;
    const errorsPrev24 = errors48.length - errorsLast24;
    if (errorsPrev24 >= 3 && errorsLast24 > errorsPrev24 * 1.8) {
      signals.push({
        level: "high",
        title: "تصاعد سريع في الأخطاء",
        detail: `الأخطاء قفزت من ${errorsPrev24} إلى ${errorsLast24} (أكثر من الضعف) — تحقق من صياد الأخطاء فوراً.`,
        window: "24 ساعة",
      });
    }

    if (reportsWeek.length >= 6) {
      const recent = reportsWeek.filter((r: any) => r.createdAt >= now - 48 * 3600_000).length;
      if (recent >= Math.ceil(reportsWeek.length / 2)) {
        signals.push({
          level: "medium",
          title: "تسارع البلاغات",
          detail: `${recent} من أصل ${reportsWeek.length} بلاغات الأسبوع وصلت خلال 48 ساعة — احتمال أزمة مجتمعية.`,
          window: "7 أيام",
        });
      }
    }

    if (chat24.length === 0) {
      signals.push({
        level: "low",
        title: "صمت غير طبيعي في المجتمع",
        detail: "صفر رسائل دردشة خلال 24 ساعة — قد يعني خللاً في الدردشة أو انسحاباً جماعياً.",
        window: "24 ساعة",
      });
    }

    return { at: now, signals };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 6️⃣ لوحة اللاعبين الاستقصائية — ملف أي لاعب بنظرة واحدة (تعزيز الدوسييه)
// يضيف طبقة «صحته التقنية» من صياد الأخطاء + تدخلات AI + ملخصاً تنفيذياً
// ═══════════════════════════════════════════════════════════════════════

export const getInvestigativePanel = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;

    const [user, profile, errors, rounds, punishments] = await Promise.all([
      ctx.db.get(userId),
      ctx.db.query("profiles").withIndex("by_user" as any, (q: any) => q.eq("userId", userId)).unique(),
      ctx.db.query("clientErrors").withIndex("by_last" as any, (q: any) => q.gte("lastSeen", weekAgo)).collect(),
      ctx.db.query("gameHistory").withIndex("by_user" as any, (q: any) => q.eq("userId", userId)).take(300),
      ctx.db.query("moderationLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0)).order("desc").take(300),
    ]);
    if (!user) return null;

    const myRounds = rounds.filter((r: any) => String(r.userId) === String(userId));
    const myPunishments = punishments.filter((l: any) => String(l.targetId) === String(userId)).slice(0, 10);

    // الأخطاء التي واجهها هذا اللاعب تحديداً (مطابقة المسار مع مساراته الأخيرة)
    const techIssues = errors
      .filter((e: any) => e.route && myRounds.length > 0)
      .slice(0, 5)
      .map((e: any) => ({ message: e.message, count: e.count, lastSeen: e.lastSeen }));

    const roundsWeek = myRounds.filter((r: any) => r.playedAt >= weekAgo).length;
    const roundsPrevWeek = myRounds.filter((r: any) => r.playedAt < weekAgo && r.playedAt >= now - 14 * 86_400_000).length;
    const trend = roundsPrevWeek === 0 ? (roundsWeek > 0 ? 100 : 0) : Math.round(((roundsWeek - roundsPrevWeek) / roundsPrevWeek) * 100);

    return {
      identity: { id: String(user._id), name: user.name ?? "لاعب مجهول", email: user.email ?? null, image: user.image ?? null },
      profile: {
        xp: profile?.xp ?? 0,
        gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
        warnings: (user as any).warnings ?? 0,
        cheatStrikes: (user as any).cheatStrikes ?? 0,
        bannedUntil: (user as any).bannedUntil ?? null,
        bannedPermanent: !!(user as any).bannedPermanent,
        mutedUntil: (user as any).mutedUntil ?? null,
      },
      activity: { roundsWeek, roundsPrevWeek, trendPct: trend, lastRoundAt: myRounds.length > 0 ? Math.max(...myRounds.map((r: any) => r.playedAt)) : null },
      techIssues,
      punishments: myPunishments.map((l: any) => ({ at: l.createdAt, action: l.action, reason: l.reason })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 7️⃣ مسجل القرارات الموثّق — قرار + توقع → قياس أثر حقيقي بعد أسبوع
// ═══════════════════════════════════════════════════════════════════════

export const logDecision = mutation({
  args: {
    title: v.string(),
    why: v.string(),
    expected: v.string(),
  },
  handler: async (ctx, { title, why, expected }) => {
    const me = await getCurrentOwnerUser(ctx);
    if (!me) throw new Error("غير مصرح — للمالك فقط");
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;

    const [rounds7d, users] = await Promise.all([
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", weekAgo)).collect(),
      ctx.db.query("users").collect(),
    ]);
    const openReports = await ctx.db
      .query("reports").withIndex("by_status" as any, (q: any) => q.eq("status", "open")).collect();

    await ctx.db.insert("crownDecisions", {
      title: title.trim().slice(0, 160),
      why: why.trim().slice(0, 400),
      expected: expected.trim().slice(0, 400),
      beforeSnapshot: {
        rounds7d: rounds7d.length,
        users: users.length,
        openReports: openReports.length,
      },
      measured: false,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** قياس الأثر: يُستدعى آلياً بعد 7 أيام عبر cron، أو يدوياً من الغرفة */
export const measureDecision = internalMutation({
  args: { decisionId: v.optional(v.id("crownDecisions")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;

    const targets = args.decisionId
      ? [await ctx.db.get(args.decisionId)]
      : (await ctx.db.query("crownDecisions").withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0)).order("desc").take(100))
          .filter((d: any) => d && !d.measured && now - d.createdAt >= 6.5 * 86_400_000);

    let measured = 0;
    for (const d of targets) {
      if (!d) continue;
      const [rounds7d, users] = await Promise.all([
        ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", weekAgo)).collect(),
        ctx.db.query("users").collect(),
      ]);
      const openReports = await ctx.db
        .query("reports").withIndex("by_status" as any, (q: any) => q.eq("status", "open")).collect();
      const after = { rounds7d: rounds7d.length, users: users.length, openReports: openReports.length };
      const b = d.beforeSnapshot;
      const roundsDelta = after.rounds7d - b.rounds7d;
      const reportsDelta = after.openReports - b.openReports;
      const verdict =
        `النشاط ${roundsDelta >= 0 ? "+" : ""}${roundsDelta} جولة · البلاغات ${reportsDelta >= 0 ? "+" : ""}${reportsDelta} · ` +
        (roundsDelta > 0 && reportsDelta <= 0 ? "الأثر إيجابي واضح ✅" : roundsDelta < 0 && reportsDelta > 0 ? "الأثر سلبي — راجع القرار ⚠️" : "أثر متوازن — راقب أسبوعاً إضافياً") as string;
      await ctx.db.patch(d._id, { measured: true, measuredAt: now, afterSnapshot: after, verdict });
      measured++;
    }
    return { measured };
  },
});

export const getDecisionLedger = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const rows = await ctx.db
      .query("crownDecisions")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(30);
    return rows;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 8️⃣ وحدة الإذاعة المستهدفة — إشعارات حقيقية لطبقات محددة + سجل توصيل
// ═══════════════════════════════════════════════════════════════════════

export const broadcast = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    audience: v.union(
      v.literal("all"),
      v.literal("tier:bronze"), v.literal("tier:silver"), v.literal("tier:gold"),
      v.literal("tier:diamond"), v.literal("tier:exclusive"),
      v.literal("active"), // لعب خلال آخر 7 أيام
      v.literal("dormant"), // لم يلعب خلال آخر 14 يوماً
      v.literal("user"),
    ),
    targetUserId: v.optional(v.id("users")),
    kind: v.union(v.literal("info"), v.literal("update"), v.literal("system")),
  },
  handler: async (ctx, { title, body, audience, targetUserId, kind }) => {
    const me = await getCurrentOwnerUser(ctx);
    if (!me) throw new Error("غير مصرح — للمالك فقط");
    const now = Date.now();

    const row = (userId: string | "__all__") =>
      ctx.runMutation(internal.notify.push, {
        userId: userId as any,
        title: title.trim().slice(0, 100),
        body: body.trim().slice(0, 500),
        type: kind,
        category: "events",
        priority: "important",
      });

    let delivered = 0;
    let audienceLabel = "الجميع";

    if (audience === "user") {
      if (!targetUserId) throw new Error("حدد اللاعب المستهدف");
      await row(targetUserId);
      delivered = 1;
      const u = await ctx.db.get(targetUserId);
      audienceLabel = u?.name ?? "لاعب محدد";
    } else if (audience === "all") {
      await row("__all__");
      delivered = 1; // إشعار عام واحد يصل للجميع
    } else if (audience === "active" || audience === "dormant") {
      const cutoff = audience === "active" ? now - 7 * 86_400_000 : now - 14 * 86_400_000;
      const users = await ctx.db.query("users").collect();
      const rounds = await ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", cutoff)).collect();
      const active = new Set(rounds.map((r: any) => String(r.userId)));
      for (const u of users) {
        const isActive = active.has(String(u._id));
        if (audience === "active" && !isActive) continue;
        if (audience === "dormant" && isActive) continue;
        await row(u._id);
        delivered++;
      }
      audienceLabel = audience === "active" ? "النشطون آخر 7 أيام" : "النائمون +14 يوماً";
    } else {
      // tier:xxx
      const tier = audience.split(":")[1];
      const ms = await ctx.db.query("memberships").withIndex("by_tier" as any, (q: any) => q.eq("tier", tier)).collect();
      for (const m of ms) {
        await row(m.userId);
        delivered++;
      }
      audienceLabel = `عضوية ${tier}`;
    }

    await ctx.db.insert("crownBroadcasts", {
      title: title.trim().slice(0, 100),
      body: body.trim().slice(0, 500),
      audience,
      audienceLabel,
      delivered,
      createdAt: now,
    });
    return { delivered, audienceLabel };
  },
});

export const getBroadcastLog = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    return ctx.db
      .query("crownBroadcasts")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(20);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 9️⃣ قفل الطوارئ الشامل — تجميد نظام محدد بفتح تلقائي مجدول
// ═══════════════════════════════════════════════════════════════════════

export const getEmergencyLocks = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const [site, arenaLock, chatLock, economyLock] = await Promise.all([
      ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "siteLocked")).first(),
      ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "crownLockArena")).first(),
      ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "crownLockChat")).first(),
      ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "crownLockEconomy")).first(),
    ]);
    const read = (row: any) => {
      if (!row) return { locked: false, until: null as number | null, reason: "" };
      try {
        const v = JSON.parse(row.value as string);
        const expired = v.until && v.until < Date.now();
        return { locked: !expired && !!v.locked, until: v.until ?? null, reason: v.reason ?? "" };
      } catch {
        return { locked: false, until: null as number | null, reason: "" };
      }
    };
    return {
      site: read(site),
      arena: read(arenaLock),
      chat: read(chatLock),
      economy: read(economyLock),
    };
  },
});

async function setLockKV(ctx: any, key: string, locked: boolean, durationHours: number | null, reason: string) {
  const value = JSON.stringify({
    locked,
    until: durationHours ? Date.now() + durationHours * 3600_000 : null,
    reason: reason.slice(0, 200),
  });
  const existing = await ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", key)).first();
  if (existing) await ctx.db.patch(existing._id, { value });
  else await ctx.db.insert("settings", { key, value });
}

export const setEmergencyLock = mutation({
  args: {
    system: v.union(v.literal("arena"), v.literal("chat"), v.literal("economy"), v.literal("site")),
    locked: v.boolean(),
    durationHours: v.optional(v.number()), // null/absent = يدوي
    reason: v.string(),
  },
  handler: async (ctx, { system, locked, durationHours, reason }) => {
    const me = await getCurrentOwnerUser(ctx);
    if (!me) throw new Error("غير مصرح — للمالك فقط");
    if (system === "site") {
      // يمر عبر نظام siteLocked الرسمي
      const value = JSON.stringify(locked);
      const existing = await ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "siteLocked")).first();
      if (existing) await ctx.db.patch(existing._id, { value });
      else await ctx.db.insert("settings", { key: "siteLocked", value });
    } else {
      await setLockKV(ctx, `crownLock${system.charAt(0).toUpperCase()}${system.slice(1)}`, locked, durationHours ?? null, reason);
    }
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "الملك",
      actorRole: "owner" as const,
      action: locked ? "emergency_lock" : "emergency_unlock",
      detail: `${system}: ${reason}${durationHours ? ` (فتح تلقائي بعد ${durationHours} ساعة)` : ""}`.slice(0, 300),
      at: Date.now(),
    });
    return { ok: true };
  },
});

/** فتح تلقائي للأقفال المنتهية — cron كل 10 دقائق */
export const expireLocks = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let opened = 0;
    for (const key of ["crownLockArena", "crownLockChat", "crownLockEconomy"]) {
      const row = await ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", key)).first();
      if (!row) continue;
      try {
        const v = JSON.parse(row.value as string);
        if (v.locked && v.until && v.until < now) {
          await ctx.db.patch(row._id, { value: JSON.stringify({ locked: false, until: null, reason: v.reason }) });
          opened++;
        }
      } catch { /* skip */ }
    }
    return { opened };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🔟 مصرفي المملكة AI — تحليل اقتصادي بـ Gemini من تدفق حقيقي
// ═══════════════════════════════════════════════════════════════════════

export const askRoyalBanker = action({
  args: { question: v.string() },
  handler: async (ctx, { question }) => {
    const pulse = await ctx.runQuery(api.crownDeck.getPulse360, {});
    if (!pulse) return { answer: null as string | null, reason: "غير مصرح" };

    const eco = await ctx.runQuery(api.commandDeck.getEconomyPulse, {});
    if (!eco || eco.unauthorized) return { answer: null as string | null, reason: "غير مصرح" };

    const evidence = JSON.stringify(
      {
        تدفق_24س: { داخلي: eco.inflow, خارجي: eco.outflow, صافي: eco.net, صحة: eco.health },
        أكبر_أسباب_الحركة: eco.reasons.slice(0, 5),
        أكبر_منفقين: eco.topSpenders.slice(0, 5).map((s: any) => `${s.name}: ${s.spent}`),
        النشاط: pulse.totals,
      },
      null,
      1,
    );
    const raw = await callGemini(
      ctx,
      `أنت «مصرفي المملكة» — محلل اقتصادي للعبة «حرب العقول». أجب بالعربية بالاعتماد حصرياً على هذه البيانات الحية:

${evidence}

سؤال المالك: ${question.trim().slice(0, 300)}

إن رصدت تضخماً أو انكماشاً قل ذلك صراحة مع الأرقام، واختم بتوصية واضحة (من 3 إلى 7 أسطر).`,
      600,
    );
    return { answer: raw as string | null, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY" };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣1️⃣ غرفة اجتماعات العقول — وحدات AI تناقش وتصوّت (Gemini من بيانات حية)
// ═══════════════════════════════════════════════════════════════════════

const COUNCIL_UNITS = [
  { unit: "referee", name: "الحكم الآلي" },
  { unit: "governor", name: "الحاكم الآلي" },
  { unit: "guardian", name: "الحارس الرقابي" },
  { unit: "health", name: "مراقب الصحة" },
  { unit: "questions", name: "مهندس الأسئلة" },
  { unit: "recommender", name: "المُوصي الذكي" },
];

export const runCouncilSession = action({
  args: { topic: v.string() },
  handler: async (ctx, { topic }): Promise<{ session: any; reason: string | null }> => {
    const pulse = await ctx.runQuery(api.crownDeck.getPulse360, {});
    if (!pulse) return { session: null, reason: "غير مصرح" };

    const evidence = JSON.stringify(
      { الأنظمة: pulse.systems, الإجماليات: pulse.totals, التنبيهات: pulse.alerts },
      null,
      1,
    );
    const raw = await callGemini(
      ctx,
      `أنت منسّق «مجلس العقول» للعبة «حرب العقول». الموضوع: ${topic.trim().slice(0, 200)}

البيانات الحية:
${evidence}

كل عضو من الأعضاء الستة يتكلم ببيت واحد (20-40 كلمة) من وجهة نظره، ثم يصوّت (نعم/لا/امتناع) على مناقشة هذا الموضوع الآن، ويُقدَّم التوصية النهائية.

أجب بهذا التنسيق الدقيق بالضبط، سطر لكل عضو:
الحكم الآلي | <كلامه> | نعم
الحاكم الآلي | <كلامه> | نعم
الحارس الرقابي | <كلامه> | لا
مراقب الصحة | <كلامه> | امتناع
مهندس الأسئلة | <كلامه> | نعم
المُوصي الذكي | <كلامه> | نعم
التوصية: <توصية واحدة واضحة من سطرين>`,
      900,
    );
    if (!raw) return { session: null, reason: "لا يوجد مفتاح GEMINI_API_KEY" };

    const speeches: { unit: string; unitName: string; stance: string; vote: string }[] = [];
    let recommendation = "";
    let yes = 0, no = 0;
    for (const line of raw.split("\n")) {
      const m = line.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*(نعم|لا|امتناع)$/);
      if (m) {
        const unitName = m[1].trim();
        const found = COUNCIL_UNITS.find((u) => u.name === unitName);
        const vote = m[3].trim();
        if (vote === "نعم") yes++;
        else if (vote === "لا") no++;
        speeches.push({ unit: found?.unit ?? "unknown", unitName, stance: m[2].trim().slice(0, 300), vote });
      }
      const rec = line.match(/^التوصية:\s*(.+)$/);
      if (rec) recommendation = rec[1].trim().slice(0, 400);
    }
    if (speeches.length === 0) return { session: null, reason: "تعذّر تحليل رد المجلس" };

    const id = await ctx.runMutation(internal.crownDeck.saveCouncilSession, {
      topic: topic.trim().slice(0, 160),
      speeches,
      recommendation: recommendation || "—",
      yesVotes: yes,
      noVotes: no,
    });
    return { session: { id, topic, speeches, recommendation, yesVotes: yes, noVotes: no }, reason: null };
  },
});

export const saveCouncilSession = internalMutation({
  args: {
    topic: v.string(),
    speeches: v.array(v.object({ unit: v.string(), unitName: v.string(), stance: v.string(), vote: v.string() })),
    recommendation: v.string(),
    yesVotes: v.number(),
    noVotes: v.number(),
  },
  handler: async (ctx, a) =>
    ctx.db.insert("crownCouncilSessions", { ...a, status: "closed", createdAt: Date.now() }),
});

export const getCouncilHistory = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    return ctx.db
      .query("crownCouncilSessions")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(15);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣2️⃣ سجل الذكاء الموحد — بحث وفلترة عبر كل قرارات كل الأنظمة
// ═══════════════════════════════════════════════════════════════════════

export const searchIntelligenceLog = query({
  args: {
    system: v.optional(v.string()), // فلتر النظام
    severity: v.optional(v.string()), // فلتر الخطورة
    text: v.optional(v.string()), // بحث نصي في التفاصيل
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { system, severity, text, limit }) => {
    if (!(await isOwner(ctx))) return null;
    const rows = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(400);
    const needle = text?.trim().toLowerCase() ?? "";
    const filtered = rows.filter((r: any) => {
      if (system && system !== "all" && r.system !== system) return false;
      if (severity && severity !== "all" && r.severity !== severity) return false;
      if (needle && !(`${r.detail} ${r.action} ${r.targetName ?? ""}`.toLowerCase().includes(needle))) return false;
      return true;
    });
    return filtered.slice(0, limit ?? 60);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣3️⃣ محلل السلوك الجمعي — أنماط جماعية حقيقية من بيانات اللاعبين
// ═══════════════════════════════════════════════════════════════════════

export const getCollectiveBehavior = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const patterns: { title: string; detail: string; severity: "info" | "warn" }[] = [];

    // 1) أين ينسحب الجدد؟ (سلسلة الجولات الأولى)
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played" as any, (q: any) => q.gte("playedAt", now - 30 * 86_400_000))
      .take(4000);
    const byUser = new Map<string, number[]>();
    for (const h of history) {
      const arr = byUser.get(String(h.userId)) ?? [];
      arr.push(h.playedAt);
      byUser.set(String(h.userId), arr);
    }
    let quitAfter2 = 0, quitAfter5 = 0, newPlayers = 0;
    for (const [, times] of byUser) {
      if (times.length < 8) {
        newPlayers++;
        if (times.length <= 2) quitAfter2++;
        else if (times.length <= 5) quitAfter5++;
      }
    }
    if (newPlayers >= 5) {
      patterns.push({
        title: "نقطة الانسحاب الجماعي",
        detail: `${quitAfter2} من ${newPlayers} لاعبين متأخرين توقفوا عند جولتين أو أقل، و${quitAfter5} توقفوا عند 5. إذا كانت النسبة عالية فالمسار الأول يحتاج تسهيلاً أو مكافأة.`,
        severity: quitAfter2 > newPlayers / 2 ? "warn" : "info",
      });
    }

    // 2) ذروات اللعب — أفضل ساعة للإطلاق
    const hourBuckets = new Array(24).fill(0) as number[];
    for (const h of history) hourBuckets[new Date(h.playedAt).getHours()]++;
    const bestHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const quietHour = hourBuckets.indexOf(Math.min(...hourBuckets));
    if (history.length >= 20) {
      patterns.push({
        title: "ذروة النشاط اليومية",
        detail: `أعلى نشاط الساعة ${bestHour}:00 وأهدأ ساعة ${quietHour}:00 — أطلق الأحداث قبل الذروة بنصف ساعة لالتقاط أكبر جمهور.`,
        severity: "info",
      });
    }

    // 3) فجوة الفوز — هل اللعبة صعبة أكثر من اللازم؟
    const recent = history.slice(0, 500);
    if (recent.length >= 30) {
      const winRate = recent.filter((h: any) => h.won).length / recent.length;
      if (winRate < 0.15) {
        patterns.push({
          title: "فجوة الفوز ضيقة جداً",
          detail: `نسبة الفوز العامة ${(winRate * 100).toFixed(0)}% فقط — اللاعبون يفقدون الدافع عندما يكون الفوز شبه مستحيل. راجع توزيع الصعوبة.`,
          severity: "warn",
        });
      } else if (winRate > 0.6) {
        patterns.push({
          title: "الفوز سهل أكثر من اللازم",
          detail: `نسبة الفوز ${(winRate * 100).toFixed(0)}% — التحدي ضعيف. ارفع تنويع الأسئلة الصعبة للحفاظ على الإثارة.`,
          severity: "info",
        });
      }
    }

    return { at: now, patterns, sampleSize: history.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣4️⃣ مختبر الأحداث AI — أفكار مبنية على نشاط حقيقي + قياس أثر المنتهية
// ═══════════════════════════════════════════════════════════════════════

export const getEventLab = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();

    // الأحداث المنتهية مع أثرها المقاس فعلياً
    const events = await ctx.db
      .query("liveEvents")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(10);
    const ended = events
      .filter((e: any) => !e.active)
      .map((e: any) => ({
        name: e.name,
        multiplier: e.multiplier,
        roundsDuring: e.roundsDuring ?? 0,
        participantsDuring: e.participantsDuring ?? 0,
        durationH: Math.max(1, Math.round(((e.endsAt ?? e.createdAt) - e.startsAt) / 3600_000)),
      }));

    return { ended, activeCount: events.filter((e: any) => e.active).length, at: now };
  },
});

export const brainstormEvents = action({
  args: {},
  handler: async (ctx) => {
    const pulse = await ctx.runQuery(api.crownDeck.getPulse360, {});
    if (!pulse) return { ideas: null, reason: "غير مصرح" };
    const lab = await ctx.runQuery(api.crownDeck.getEventLab, {});
    if (!lab) return { ideas: null, reason: "غير مصرح" };

    const evidence = JSON.stringify({
      النشاط: pulse.totals,
      أحداث_سابقة: lab.ended.slice(0, 5),
    }, null, 1);
    const raw = await callGemini(
      `أنت مختبر أحداث لعبة «حرب العقول». اقترح 3 أفكار أحداث مبنية على البيانات الحية، بالعربية، بهذا التنسيق:

فكرة 1: <الاسم>
النوع: <xp_boost أو point_rush أو loyalty_festival> | المضاعف: <1.5-3> | المدة: <ساعات>
السبب: <لماذا هذه الفكرة الآن بناءً على البيانات>

فكرة 2: ...
فكرة 3: ...

البيانات:
${evidence}`, 700);
    return { ideas: raw, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY" };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣5️⃣ مترجم الشكاوى الذكي — تلخيص وتصنيف البلاغات والاعتراضات آلياً
// ═══════════════════════════════════════════════════════════════════════

export const getComplaintDigest = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const [openReports, pendingAppeals] = await Promise.all([
      ctx.db.query("reports").withIndex("by_status" as any, (q: any) => q.eq("status", "open")).collect(),
      ctx.db.query("appeals").withIndex("by_status" as any, (q: any) => q.eq("status", "pending")).collect(),
    ]);
    return {
      reports: openReports.slice(0, 25).map((r: any) => ({
        id: String(r._id),
        reason: r.reason,
        details: r.details ?? "",
        reporter: r.reporterName,
        target: r.targetName,
        createdAt: r.createdAt,
      })),
      appeals: pendingAppeals.slice(0, 15).map((a: any) => ({
        id: String(a._id),
        message: a.message,
        punishmentType: a.punishmentType,
        userName: a.userName,
        createdAt: a.createdAt,
      })),
    };
  },
});

export const summarizeComplaints = action({
  args: {},
  handler: async (ctx) => {
    const digest = await ctx.runQuery(api.crownDeck.getComplaintDigest, {});
    if (!digest) return { summary: null, reason: "غير مصرح" };
    const raw = await callGemini(
      `أنت مترجم شكاوى لعبة «حرب العقول». لخّص هذه البلاغات والاعتراضات بالعربية في تقرير تنفيذي قصير:

البلاغات المفتوحة:
${JSON.stringify(digest.reports.slice(0, 15), null, 1)}

الاعتراضات المعلقة:
${JSON.stringify(digest.appeals.slice(0, 10), null, 1)}

اكتب بالضبط بهذا التنسيق:
الخلاصة: <سطران عن الحالة العامة>
الأولوية 1: <أهم بلاغ/اعتراض + لماذا>
الأولوية 2: <التالي>
الأولوية 3: <التالي>
نمط متكرر: <شكوى تتكرر إن وُجدت، أو «لا يوجد نمط واضح»>`, 600);
    return { summary: raw, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY أو لا شكاوى" };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🏁 المرحلة د — القيادة والشفافية (المهام 16-20)
// ═══════════════════════════════════════════════════════════════════════

// 1️⃣6️⃣ مسجّل الرحلات — إعادة تشغيل حادثة خطوة بخطوة من آثارها الموثّقة
export const getIncidentReplay = query({
  args: { route: v.optional(v.string()) },
  handler: async (ctx, { route }) => {
    if (!(await isOwner(ctx))) return null;
    const rows = await ctx.db
      .query("errorLogs")
      .withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(60);
    const filtered = route && route !== "all"
      ? rows.filter((r: any) => r.route === route)
      : rows;
    // تجميع حوادث متتالية بالمسار + الزمن
    const timeline = filtered.slice(0, 25).map((r: any) => ({
      id: String(r._id),
      at: r.at,
      route: r.route ?? "—",
      message: String(r.message ?? "").slice(0, 160),
      playerAction: String(r.playerAction ?? "").slice(0, 300), // آثار breadcrumbs
      autoHealed: !!r.autoHealed,
      strategy: r.healStrategy ?? null,
    }));
    return { timeline, total: filtered.length };
  },
});

// 1️⃣7️⃣ الدرج الذاتي للجراحة — يدمج APEX مع أقفال الطوارئ النشطة
export const getSurgerySelfRank = query({
  args: {},
  handler: async (ctx): Promise<{ queue: any; siteLocked: boolean } | null> => {
    if (!(await isOwner(ctx))) return null;
    const apex = await ctx.runQuery(api.errorHunterApex.getApexRankedQueue, {});
    if (!apex) return null;
    const locks = await ctx.db.query("settings").withIndex("by_key" as any, (q: any) => q.eq("key", "siteLocked")).first();
    const siteLocked = locks?.value === "true" || locks?.value === "1";
    return { queue: apex, siteLocked };
  },
});

// 1️⃣8️⃣ مخططات الاتجاهات الأسبوعية — أرقام حقيقية 7 أيام + استنتاج مكتوب
export const getWeeklyTrends = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const [rounds, errors, broadcasts] = await Promise.all([
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", weekAgo)).collect(),
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", weekAgo)).collect(),
      ctx.db.query("crownBroadcasts").withIndex("by_created" as any, (q: any) => q.gte("createdAt", weekAgo)).collect(),
    ]);
    const days: { day: string; rounds: number; errors: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = now - i * 86_400_000;
      const key = new Date(start).toISOString().slice(0, 10);
      days.push({
        day: key,
        rounds: rounds.filter((r: any) => new Date(r.playedAt).toISOString().slice(0, 10) === key).length,
        errors: errors.filter((e: any) => new Date(e.createdAt).toISOString().slice(0, 10) === key).length,
      });
    }
    const halfRounds = [days.slice(0, 4), days.slice(3)].map((w) => w.reduce((s, d) => s + d.rounds, 0));
    const direction = halfRounds[0] === 0 ? (halfRounds[1] > 0 ? "نمو" : "ثابت") : halfRounds[1] > halfRounds[0] * 1.15 ? "نمو" : halfRounds[1] < halfRounds[0] * 0.85 ? "تراجع" : "ثابت";
    return {
      days,
      totalRounds: rounds.length,
      totalErrors: errors.length,
      broadcasts: broadcasts.length,
      direction,
      insight:
        direction === "نمو"
          ? `النشاط ينمو (+${Math.round(((halfRounds[1] - halfRounds[0]) / Math.max(1, halfRounds[0])) * 100)}% بين نصفي الأسبوع) — حافظ الزخم بحدث قصير.`
          : direction === "تراجع"
            ? `النشاط يتراجع (${Math.round(((halfRounds[1] - halfRounds[0]) / Math.max(1, halfRounds[0])) * 100)}%) — أطلق حدثاً أو إذاعة للنائمين الآن.`
            : "النشاط مستقر — لحظة مناسبة لتجربة تغيير محسوب عبر محاكي القرارات.",
    };
  },
});

// 1️⃣9️⃣ حوادث ← مهام — تحويل تقرير إلى بطاقة مهمة منظمة في aiDecisionLog
export const incidentToTask = mutation({
  args: { errorId: v.id("errorLogs") },
  handler: async (ctx, { errorId }) => {
    const me = await getCurrentOwnerUser(ctx);
    if (!me) throw new Error("غير مصرح — للمالك فقط");
    const err = await ctx.db.get(errorId);
    if (!err) throw new Error("الحادثة غير موجودة");
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: me.name ?? "الملك",
      action: "incident_task_created",
      targetId: String(errorId),
      detail: `🛠️ مهمة إصلاح: ${String(err.message).slice(0, 150)} — المسار: ${err.route ?? "—"}${err.aiAnalysis ? ` · السبب: ${String(err.aiAnalysis).slice(0, 120)}` : ""}${err.aiFixSuggestion ? ` · الإصلاح: ${String(err.aiFixSuggestion).slice(0, 150)}` : ""}`.slice(0, 480),
      severity: (err.severity as any) === "critical" ? "high" : "medium",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// 2️⃣0️⃣ الذاكرة الخالدة — لقطة أسبوعية من كل شيء تُؤرشف دائماً (لا تُمس أبدًا)
export const captureImmortalSnapshot = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const [users, rounds, errors, decisions, broadcasts, sessions] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("gameHistory").withIndex("by_played" as any, (q: any) => q.gte("playedAt", weekAgo)).collect(),
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("createdAt", weekAgo)).collect(),
      ctx.db.query("crownDecisions").withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0)).order("desc").take(50),
      ctx.db.query("crownBroadcasts").withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0)).order("desc").take(50),
      ctx.db.query("crownCouncilSessions").withIndex("by_created" as any, (q: any) => q.gte("createdAt", 0)).order("desc").take(20),
    ]);
    const key = `crown_immortal_${new Date(now).toISOString().slice(0, 10)}`;
    const existing = await ctx.db.query("systemFlags").withIndex("by_key" as any, (q: any) => q.eq("key", key)).first();
    if (existing) return { skipped: true };
    const snapshot = {
      users: users.length,
      rounds7d: rounds.length,
      errors7d: errors.length,
      decisions: decisions.map((d: any) => d.title),
      broadcasts: broadcasts.map((b: any) => `${b.title} → ${b.audienceLabel} (${b.delivered})`),
      councilTopics: sessions.map((s: any) => s.topic),
      at: now,
    };
    await ctx.db.insert("systemFlags", { key, value: JSON.stringify(snapshot) });
    return { captured: true };
  },
});
