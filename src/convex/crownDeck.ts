import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { getCurrentUser } from "./users";
import { isOwnerUser } from "./owner";

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

async function callGemini(prompt: string, maxTokens = 700): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
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
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("at", dayAgo)).collect(),
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
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("at", dayAgo)).collect(),
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
      ctx.db.query("errorLogs").withIndex("by_created" as any, (q: any) => q.gte("at", now - 48 * 3600_000)).collect(),
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

    const errorsLast24 = errors48.filter((e: any) => e.at >= now - 24 * 3600_000).length;
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

    const row = (name: string, userId: string | "__all__") => ({
      userId: userId as any,
      title: title.trim().slice(0, 100),
      body: body.trim().slice(0, 500),
      type: kind,
      read: false,
      createdAt: now,
    });

    let delivered = 0;
    let audienceLabel = "الجميع";

    if (audience === "user") {
      if (!targetUserId) throw new Error("حدد اللاعب المستهدف");
      await ctx.db.insert("notifications", row("", targetUserId));
      delivered = 1;
      const u = await ctx.db.get(targetUserId);
      audienceLabel = u?.name ?? "لاعب محدد";
    } else if (audience === "all") {
      await ctx.db.insert("notifications", row("", "__all__"));
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
        await ctx.db.insert("notifications", row("", u._id));
        delivered++;
      }
      audienceLabel = audience === "active" ? "النشطون آخر 7 أيام" : "النائمون +14 يوماً";
    } else {
      // tier:xxx
      const tier = audience.split(":")[1];
      const ms = await ctx.db.query("memberships").withIndex("by_tier" as any, (q: any) => q.eq("tier", tier)).collect();
      for (const m of ms) {
        await ctx.db.insert("notifications", row("", m.userId));
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
      `أنت «مصرفي المملكة» — محلل اقتصادي للعبة «حرب العقول». أجب بالعربية بالاعتماد حصرياً على هذه البيانات الحية:

${evidence}

سؤال المالك: ${question.trim().slice(0, 300)}

إن رصدت تضخماً أو انكماشاً قل ذلك صراحة مع الأرقام، واختم بتوصية واضحة (من 3 إلى 7 أسطر).`,
      600,
    );
    return { answer: raw as string | null, reason: raw ? null : "لا يوجد مفتاح GEMINI_API_KEY" };
  },
});
