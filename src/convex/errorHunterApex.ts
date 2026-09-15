import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🦾 ERROR HUNTER v7.0 "APEX" — Phases B/C/D backend
 *
 *  B6  AI Repair Commander: adaptive strategy ordering from the success ledger
 *  B8  Session Doctor: per-player live health score for the owner room
 *  C13 AI Daily War Report: one ruthless Arabic morning briefing
 *  C14 AI Anomaly Correlator: links performance anomalies to error clusters
 *  C15 AI Owner Q&A: ask anything about incidents, answered from evidence
 *  D17 Impact × Regression × Confidence auto-ranking (Surgery Room queue)
 *  D18 Heal-rate trend oracle (weekly health evolution)
 * ═══════════════════════════════════════════════════════════════════════
 */

const MODEL = "gemini-3.6-flash";

async function callGemini(prompt: string, maxTokens = 600): Promise<string | null> {
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

function requireOwnerSync(me: { email?: string | null; role?: string | null } | null | undefined): boolean {
  return !!me && ((me as any).role === "owner" || me.email === "omw70op@gmail.com");
}

export const isOwnerCheck = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    return requireOwnerSync(u);
  },
});

// ═══════════════ B6 — AI Repair Commander (success ledger) ═══════════════

/** سجل النجاح: لكل فئة، أي استراتيجيات نجحت فعلاً — يقرأه العميل لترتيب التعافي */
export const getHealStrategyLedger = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("errorPatterns").collect();
    const byCategory = new Map<string, { attempts: number; wins: number; strategies: Map<string, [number, number]> }>();
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", Date.now() - 14 * 86400_000))
      .take(1000);
    for (const e of errors) {
      if (!e.healStrategy) continue;
      let entry = byCategory.get(e.category);
      if (!entry) { entry = { attempts: 0, wins: 0, strategies: new Map() }; byCategory.set(e.category, entry); }
      entry.attempts++;
      if (e.healResult === "success") entry.wins++;
      const key = e.healStrategy;
      const prev = entry.strategies.get(key) ?? [0, 0];
      entry.strategies.set(key, [prev[0] + 1, prev[1] + (e.healResult === "success" ? 1 : 0)]);
    }
    return {
      categories: [...byCategory.entries()].map(([category, v]) => ({
        category,
        attempts: v.attempts,
        winRate: v.attempts ? Math.round((v.wins / v.attempts) * 100) : 0,
        strategies: [...v.strategies.entries()]
          .map(([strategy, [attempts, wins]]) => ({ strategy, attempts, winRate: attempts ? Math.round((wins / attempts) * 100) : 0 }))
          .sort((a, b) => b.winRate - a.winRate),
      })),
    };
  },
});

// ═══════════════ B8 — Session Doctor (per-player health) ═══════════════

export const getSessionHealth = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!requireOwnerSync(me)) return null;

    const dayAgo = Date.now() - 86400_000;
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", dayAgo))
      .take(2000);
    const perf = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_time", (q) => q.gte("recordedAt", dayAgo))
      .take(3000);

    const sevWeight: Record<string, number> = { critical: 4, high: 2.5, medium: 1.2, low: 0.5 };
    const perUser = new Map<string, { errs: number; weight: number; crit: number; healed: number; fps: number[]; mem: number[]; lastRoute: string }>();
    const touch = (uid: string) => {
      let e = perUser.get(uid);
      if (!e) { e = { errs: 0, weight: 0, crit: 0, healed: 0, fps: [], mem: [], lastRoute: "" }; perUser.set(uid, e); }
      return e;
    };
    for (const e of errors) {
      if (!e.userId) continue;
      const entry = touch(String(e.userId));
      entry.errs += e.count;
      entry.weight += e.count * (sevWeight[e.severity] ?? 1);
      if (e.severity === "critical") entry.crit += e.count;
      if (e.autoHealed && e.healResult === "success") entry.healed += e.count;
      if (e.route) entry.lastRoute = e.route;
    }
    for (const p of perf) {
      if (!p.userId) continue;
      const entry = touch(String(p.userId));
      if ((p.fps ?? 0) > 0) entry.fps.push(p.fps!);
      if ((p.memoryUsedMB ?? 0) > 0) entry.mem.push(p.memoryUsedMB!);
      if (p.route) entry.lastRoute = p.route;
    }

    const rows = [...perUser.entries()]
      .map(([uid, s]) => {
        // درجة صحة اللاعب 0-100
        let score = 100;
        score -= Math.min(45, s.weight * 1.5);
        score -= Math.min(20, s.crit * 4);
        if (s.healed > 0) score += Math.min(10, s.healed);
        const avgFps = s.fps.length ? s.fps.reduce((a, b) => a + b, 0) / s.fps.length : 0;
        if (avgFps > 0 && avgFps < 30) score -= 15;
        const avgMem = s.mem.length ? s.mem.reduce((a, b) => a + b, 0) / s.mem.length : 0;
        if (avgMem > 400) score -= 10;
        return {
          userId: uid,
          healthScore: Math.max(0, Math.min(100, Math.round(score))),
          errors24h: s.errs,
          critical24h: s.crit,
          autoHealed: s.healed,
          avgFps: Math.round(avgFps),
          avgMemoryMB: Math.round(avgMem),
          lastRoute: s.lastRoute,
        };
      })
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 25);

    // أسماء اللاعبين
    const names = new Map<string, string>();
    for (const r of rows.slice(0, 10)) {
      const u = await ctx.db.get(r.userId as any);
      if (u) names.set(r.userId, (u as any).name ?? "لاعب");
    }

    return {
      players: rows.map((r) => ({ ...r, name: names.get(r.userId) ?? "لاعب" })),
      suffering: rows.filter((r) => r.healthScore < 50).length,
    };
  },
});

// ═══════════════ C13 — AI Daily War Report ═══════════════

export const aiDailyWarReport = action({
  handler: async (ctx): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return "⚠️ يجب تسجيل الدخول";
    const isOwner = await ctx.runQuery(internal.errorHunterApex.isOwnerCheck, { userId });
    if (!isOwner) return "⚠️ للمالك فقط";

    const dayAgo = Date.now() - 86400_000;
    const snapshot = await ctx.runQuery(internal.errorHunterApex.warReportSnapshot, { since: dayAgo });

    const reply = await callGemini(
      `أنت قائد عمليات صياد الأخطاء. اكتب تقرير حرب صباحي صارم بالعربية من هذه البيانات الحقيقية. التنسيق:
🔴 ما انكسر: <أهم 3 عناقيد/أخطاء بالأثر>
🟢 ما شُفي تلقائياً: <إحصاء + أبرز نجاح>
⚠️ ينزف ويحتاج قرارك: <ما لم يُحل وله تأثير لاعبين>
🎯 أولويتك الآن: <ترتيب 1-2-3 محدد>

البيانات:
- أخطاء 24س: ${snapshot.totalErrors} (حرجة: ${snapshot.critical}) — محلولة: ${snapshot.resolved} — شُفيت ذاتياً: ${snapshot.autoHealed}
- عناقيد نشطة: ${snapshot.clusters.length}
${snapshot.clusters.slice(0, 5).map((c: any) => `  · ${c.title} (${c.memberCount} خطأ، خطورة ${c.severity}${c.isRegression ? " — انتكاسة!" : ""})`).join("\n")}
- أعلى الأخطاء تأثيراً:
${snapshot.topImpact.map((e: any) => `  · [${e.severity}] ${e.message.slice(0, 90)} (تأثير ${e.impact})`).join("\n")}
- معدل الشفاء الذاتي: ${snapshot.healRate}%`,
      700,
    );
    return reply ?? "⚠️ فشل الاتصال بـ Gemini — تحقق من المفتاح.";
  },
});

export const warReportSnapshot = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .take(2000);
    const clusters = await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(20);
    const now = Date.now();
    const sevWeight: Record<string, number> = { critical: 4, high: 2.5, medium: 1.2, low: 0.5 };
    const topImpact = errors
      .filter((e) => !e.resolved)
      .map((e) => ({
        message: e.message,
        severity: e.severity,
        impact: Math.round(e.count * (sevWeight[e.severity] ?? 1) * 10) / 10,
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5);
    const total = errors.reduce((a, e) => a + e.count, 0);
    const healed = errors.reduce((a, e) => a + (e.autoHealed && e.healResult === "success" ? e.count : 0), 0);
    return {
      totalErrors: total,
      critical: errors.filter((e) => e.severity === "critical").length,
      resolved: errors.filter((e) => e.resolved).length,
      autoHealed: healed,
      healRate: total ? Math.round((healed / total) * 100) : 100,
      clusters: clusters.map((c) => ({ title: c.title, memberCount: c.memberCount, severity: c.severity, isRegression: c.aiVerdict === "regression" })),
      topImpact,
      at: now,
    };
  },
});

// ═══════════════ C14 — AI Anomaly Correlator ═══════════════

export const correlateAnomalies = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!requireOwnerSync(me)) return null;

    const now = Date.now();
    const dayAgo = now - 86400_000;
    const perf = await ctx.db
      .query("performanceMetrics")
      .withIndex("by_time", (q) => q.gte("recordedAt", dayAgo))
      .take(2000);
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", dayAgo))
      .take(1000);

    // تبويب زمني بالساعة: أداء مقابل أخطاء
    const buckets = 12;
    const win = 86400_000 / buckets;
    const timeline: { hour: string; errors: number; avgFps: number; avgMem: number }[] = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const from = now - (i + 1) * win;
      const to = now - i * win;
      const errs = errors.filter((e) => e.lastSeen > from && e.lastSeen <= to).reduce((a, e) => a + e.count, 0);
      const p = perf.filter((m) => m.recordedAt > from && m.recordedAt <= to);
      const fps = p.filter((m) => (m.fps ?? 0) > 0);
      const mem = p.filter((m) => (m.memoryUsedMB ?? 0) > 0);
      timeline.push({
        hour: new Date(from).getHours().toString().padStart(2, "0") + ":00",
        errors: errs,
        avgFps: fps.length ? Math.round(fps.reduce((a, m) => a + m.fps!, 0) / fps.length) : 0,
        avgMem: mem.length ? Math.round(mem.reduce((a, m) => a + m.memoryUsedMB!, 0) / mem.length) : 0,
      });
    }

    // ارتباط بسيط حقيقي: هل تسبق قمم الذاكرة/تدهور FPS قمم الأخطاء بساعة؟
    const correlations: string[] = [];
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const cur = timeline[i];
      if (prev.avgMem > 0 && cur.avgMem > 0 && prev.avgMem > 350 && cur.errors > prev.errors * 2 && cur.errors >= 5) {
        correlations.push(`نمو ذاكرة ${prev.avgMem}MB في ${prev.hour} سبق موجة أخطاء ${cur.errors} في ${cur.hour} — احتمال تسريب يتحول لأعطال`);
      }
      if (prev.avgFps > 0 && cur.avgFps > 0 && prev.avgFps >= 40 && cur.avgFps < prev.avgFps * 0.75 && cur.errors >= 3) {
        correlations.push(`تدهور FPS (${prev.avgFps}→${cur.avgFps}) في ${cur.hour} اقترن بموجة أخطاء ${cur.errors}`);
      }
    }

    return { timeline, correlations: correlations.slice(0, 5) };
  },
});

// ═══════════════ C15 — AI Owner Q&A Court ═══════════════

export const askAboutErrors = action({
  args: { question: v.string() },
  handler: async (ctx, { question }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return "⚠️ يجب تسجيل الدخول";
    const isOwner = await ctx.runQuery(internal.errorHunterApex.isOwnerCheck, { userId });
    if (!isOwner) return "⚠️ للمالك فقط";
    const q = question.trim().slice(0, 300);
    if (!q) return "اكتب سؤالك.";

    const weekAgo = Date.now() - 7 * 86400_000;
    const evidence = await ctx.runQuery(internal.errorHunterApex.evidenceChain, { since: weekAgo });

    const reply = await callGemini(
      `أنت محقق أخطاء خبير في لعبة عربية. أجب على سؤال المالك بالعربية من الأدلة الحقيقية فقط (لا تخترع). إن لم تكفِ الأدلة قل ذلك بوضوح.

السؤال: ${q}

الأدلة (آخر 7 أيام):
عناقيد: ${evidence.clusters.map((c: any) => `${c.title}(${c.memberCount} خطأ، ${c.severity}${c.isRegression ? "، انتكاسة" : ""})`).join(" · ") || "لا شيء"}
أعلى الأخطاء تأثيراً: ${evidence.topImpact.map((e: any) => `[${e.severity}] ${e.message.slice(0, 80)}`).join(" · ") || "لا شيء"}
إحصاءات: إجمالي ${evidence.totalErrors} خطأ، شُفي ذاتياً ${evidence.autoHealed}، محلول ${evidence.resolved}.`,
      500,
    );
    return reply ?? "⚠️ فشل الاتصال بـ Gemini — تحقق من المفتاح.";
  },
});

export const evidenceChain = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .take(1500);
    const clusters = await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(20);
    const sevWeight: Record<string, number> = { critical: 4, high: 2.5, medium: 1.2, low: 0.5 };
    return {
      clusters: clusters.map((c) => ({ title: c.title, memberCount: c.memberCount, severity: c.severity, isRegression: c.aiVerdict === "regression" })),
      topImpact: errors
        .filter((e) => !e.resolved)
        .sort((a, b) => b.count * (sevWeight[b.severity] ?? 1) - a.count * (sevWeight[a.severity] ?? 1))
        .slice(0, 8)
        .map((e) => ({ message: e.message, severity: e.severity })),
      totalErrors: errors.reduce((a, e) => a + e.count, 0),
      autoHealed: errors.reduce((a, e) => a + (e.autoHealed && e.healResult === "success" ? e.count : 0), 0),
      resolved: errors.filter((e) => e.resolved).length,
    };
  },
});

// ═══════════════ D17 — Surgery Room auto-ranking (impact × regression × confidence) ═══════════════

export const getApexRankedQueue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!requireOwnerSync(me)) return null;

    const now = Date.now();
    const clusters = await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(40);
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_unresolved", (q) => q.eq("resolved", false))
      .order("desc")
      .take(200);

    const sevWeight: Record<string, number> = { critical: 4, high: 2.5, medium: 1.2, low: 0.5 };
    const clusterById = new Map(clusters.map((c) => [String(c._id), c]));

    const rows = errors
      .map((e) => {
        const recencyFactor = 1 / (1 + Math.max(0.1, now - e.lastSeen) / 3600000 / 6);
        const cluster = e.clusterId ? clusterById.get(String(e.clusterId)) : undefined;
        const regressionBoost = cluster?.aiVerdict === "regression" ? 2.5 : 1;
        // ثقة الإصلاح: أخطاء شُفيت ذاتياً سابقاً تهبط أولويتها
        const confidenceDiscount = e.autoHealed && e.healResult === "success" ? 0.3 : 1;
        const aiVerifiedBoost = e.aiVerdict === "analyzed" && e.aiCanAutoFix ? 1.2 : 1;
        const priority =
          Math.round(e.count * (sevWeight[e.severity] ?? 1) * recencyFactor * regressionBoost * confidenceDiscount * aiVerifiedBoost * 10) / 10;
        return {
          _id: String(e._id),
          message: e.message.slice(0, 140),
          category: e.category,
          severity: e.severity,
          count: e.count,
          impact: priority,
          isRegression: cluster?.aiVerdict === "regression",
          regressionFamily: cluster?.title ?? null,
          aiFixable: e.aiCanAutoFix ?? false,
        };
      })
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 25);

    return rows;
  },
});

// ═══════════════ D18 — Heal-rate trend oracle (weekly) ═══════════════

export const getHealthTrends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!requireOwnerSync(me)) return null;

    const now = Date.now();
    const weekAgo = now - 7 * 86400_000;
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", weekAgo))
      .take(3000);

    const days: { day: string; errors: number; healed: number; healRate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const from = now - (i + 1) * 86400_000;
      const to = now - i * 86400_000;
      const day = errors.filter((e) => e.createdAt >= from && e.createdAt < to);
      const total = day.reduce((a, e) => a + e.count, 0);
      const healed = day.reduce((a, e) => a + (e.autoHealed && e.healResult === "success" ? e.count : 0), 0);
      days.push({
        day: new Date(from).toLocaleDateString("ar", { weekday: "short" }),
        errors: total,
        healed,
        healRate: total ? Math.round((healed / total) * 100) : 100,
      });
    }

    const firstHalf = days.slice(0, 3).reduce((a, d) => a + d.errors, 0);
    const secondHalf = days.slice(4).reduce((a, d) => a + d.errors, 0);
    const trend = secondHalf > firstHalf * 1.3 ? "worsening" : firstHalf > secondHalf * 1.3 ? "improving" : "stable";

    // أكثر العائلات تكراراً
    const clusters = await ctx.db.query("aiErrorClusters").withIndex("by_lastSeen").order("desc").take(15);
    const topFamilies = clusters
      .slice()
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 5)
      .map((c) => ({ title: c.title, members: c.memberCount, severity: c.severity, isRegression: c.aiVerdict === "regression" }));

    return {
      days,
      trend,
      verdict:
        trend === "improving" ? "اللعبة تتحسن — الأخطاء تتراجع" : trend === "worsening" ? "اللعبة تسوء — راجع العائلات الأعلى" : "مستقر — راقب العائلات المكررة",
      topFamilies,
    };
  },
});
