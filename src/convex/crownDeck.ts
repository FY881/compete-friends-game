import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";

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
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("email" as any, (q: any) => q.eq("email", identity.email))
    .unique();
  if (!user) return false;
  const role = await ctx.db
    .query("siteRoles")
    .withIndex("by_user" as any, (q: any) => q.eq("userId", user._id))
    .unique();
  return role?.role === "owner";
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
