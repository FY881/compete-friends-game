import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 ERROR HUNTER v7.0 "APEX" — المرحلة أ: العناقيد الدلالية + الانتكاسات
 *
 *  1. تجميع الأخطاء دلالياً عبر Gemini: الأخطاء التي «تعني الشيء نفسه»
 *     تُجمع في عنقود واحد مهما اختلفت صياغتها.
 *  2. مدّعي الانتكاسات: عنقود كان محسوماً وعاد → يُعلَّم regression
 *     ويرتفع عداد انتكاساته تلقائياً (أولوية أعلى).
 *  3. تفسير المكدس: Gemini يحوّل أثر المكدس الخام إلى قصة فشل عربية
 *     (سلسلة الانكسار + الطبقة المسؤولة + لماذا حدث).
 * ═══════════════════════════════════════════════════════════════════════
 */

const MODEL = "gemini-3.6-flash";

async function callGemini(prompt: string): Promise<string | null> {
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
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
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

// ═══════════════ استعلامات داخلية ═══════════════

export const getUnclusteredInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", Date.now() - 48 * 3600_000))
      .order("desc")
      .take(args.limit * 4);
    return rows.filter((r) => r.clusterId === undefined).slice(0, args.limit);
  },
});

export const listClustersInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(args.limit);
  },
});

export const getErrorInternal = internalQuery({
  args: { id: v.id("errorLogs") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const attachStoryInternal = internalMutation({
  args: { id: v.id("errorLogs"), story: v.string() },
  handler: async (ctx, { id, story }) => {
    await ctx.db.patch(id, { aiAnalysis: story });
  },
});

// ═══════════════ العناقيد + الانتكاسات ═══════════════

export const upsertClusterAndLink = internalMutation({
  args: {
    errorId: v.id("errorLogs"),
    title: v.string(),
    rootCauseFamily: v.string(),
    severity: v.string(),
    autoFixable: v.optional(v.boolean()),
    fixSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(60);
    const match = existing.find(
      (c) => c.rootCauseFamily === args.rootCauseFamily && now - c.lastSeen < 7 * 86400_000,
    );

    let clusterId: any;
    let isRegression = false;
    if (match) {
      await ctx.db.patch(match._id, {
        memberCount: match.memberCount + 1,
        lastSeen: now,
        sampleMessage: args.title.length < match.sampleMessage.length ? args.title : match.sampleMessage,
      });
      clusterId = match._id;
      // ⚖️ مدّعي الانتكاسات: كان محسوماً ثم عاد
      if (match.lastResolvedAt) {
        isRegression = true;
        await ctx.db.patch(match._id, {
          regressionCount: (match.regressionCount ?? 0) + 1,
          lastResolvedAt: undefined,
          aiVerdict: "regression",
        });
      }
    } else {
      clusterId = await ctx.db.insert("aiErrorClusters", {
        title: args.title.slice(0, 120),
        rootCauseFamily: args.rootCauseFamily,
        memberCount: 1,
        sampleMessage: args.title.slice(0, 200),
        aiVerdict: "untriaged",
        severity: args.severity,
        autoFixable: args.autoFixable,
        fixSummary: args.fixSummary,
        firstSeen: now,
        lastSeen: now,
        createdAt: now,
      });
    }
    await ctx.db.patch(args.errorId, { clusterId });
    return { clusterId: String(clusterId), isRegression };
  },
});

export const markClusterResolved = internalMutation({
  args: { clusterId: v.id("aiErrorClusters") },
  handler: async (ctx, { clusterId }) => {
    await ctx.db.patch(clusterId, { lastResolvedAt: Date.now() });
    return { ok: true };
  },
});

/** حل خطأ من غرفة المالك — يغلق عنقوده تلقائياً إذا لم يبقَ أعضاء مفتوحون */
export const resolveErrorWithClusterCheck = mutation({
  args: { errorId: v.id("errorLogs") },
  handler: async (ctx, { errorId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!me || ((me as any).role !== "owner" && me.email !== "omw70op@gmail.com")) {
      throw new Error("للمالك فقط");
    }
    const err = await ctx.db.get(errorId);
    if (!err) throw new Error("السجل غير موجود");
    await ctx.db.patch(errorId, { resolved: true, resolvedBy: "owner" });

    if (err.clusterId) {
      const cluster = await ctx.db.get(err.clusterId);
      if (cluster) {
        // هل بقي أي عضو آخر في نفس العنقود مفتوحاً؟
        const siblings = await ctx.db
          .query("errorLogs")
          .withIndex("by_created", (q) => q.gte("createdAt", cluster.firstSeen))
          .take(200);
        const stillOpen = siblings.some(
          (m) => String(m.clusterId) === String(err.clusterId) && !m.resolved && String(m._id) !== String(errorId),
        );
        if (!stillOpen) {
          await ctx.runMutation(internal.geminiApex.markClusterResolved, { clusterId: err.clusterId });
        }
      }
    }
    return { ok: true };
  },
});

// ═══════════════ لوحة العناقيد للمالك ═══════════════

export const getClusterBoard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || ((me as any).role !== "owner" && me.email !== "omw70op@gmail.com")) return null;

    const clusters = await ctx.db
      .query("aiErrorClusters")
      .withIndex("by_lastSeen")
      .order("desc")
      .take(40);
    const now = Date.now();
    return {
      clusters: clusters.map((c) => ({
        id: String(c._id),
        title: c.title,
        rootCauseFamily: c.rootCauseFamily,
        memberCount: c.memberCount,
        sampleMessage: c.sampleMessage,
        verdict: c.aiVerdict,
        severity: c.severity,
        autoFixable: c.autoFixable,
        fixSummary: c.fixSummary,
        regressionCount: c.regressionCount ?? 0,
        isRegression: c.aiVerdict === "regression",
        lastSeenAgeMin: Math.round((now - c.lastSeen) / 60000),
      })),
      totals: {
        clusters: clusters.length,
        untriaged: clusters.filter((c) => c.aiVerdict === "untriaged").length,
        regressions: clusters.filter((c) => c.aiVerdict === "regression").length,
        members: clusters.reduce((a, c) => a + c.memberCount, 0),
      },
    };
  },
});

// ═══════════════ تفسير المكدس بالذكاء الاصطناعي ═══════════════

export const aiStackTraceInterpreter = internalAction({
  args: { errorId: v.id("errorLogs") },
  handler: async (ctx, { errorId }) => {
    const err = await ctx.runQuery(internal.geminiApex.getErrorInternal, { id: errorId });
    if (!err || !err.stack) return { interpreted: false };
    const story = await callGemini(
      `أنت محلل أعطال خبير. اقرأ أثر المكدس هذا وحوّله إلى قصة فشل واضحة بالعربية، بهذا التنسيق:
سلسلة الانكسار: <أ ← ب ← ج>
الطبقة المسؤولة: <واجهة React / Convex خادم / شبكة / متصفح>
لماذا حدث: <سطر واحد>

الخطأ: ${err.message}
المكدس: ${err.stack.slice(0, 1500)}`,
    );
    if (!story) return { interpreted: false };
    await ctx.runMutation(internal.geminiApex.attachStoryInternal, {
      id: errorId,
      story: story.slice(0, 1200),
    });
    return { interpreted: true, story };
  },
});

// ═══════════════ دورة التجميع الدلالي (cron) ═══════════════

export const clusterUntriaged = internalAction({
  handler: async (
    ctx,
  ): Promise<{ clustered: number; regressions: number } | { skipped: true; reason: string }> => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return { skipped: true, reason: "لا يوجد مفتاح GEMINI_API_KEY" };

    const errors = await ctx.runQuery(internal.geminiApex.getUnclusteredInternal, { limit: 8 });
    if (errors.length === 0) return { clustered: 0, regressions: 0 };

    const clusters = await ctx.runQuery(internal.geminiApex.listClustersInternal, { limit: 30 });
    const knownFamilies = clusters.map((c) => c.rootCauseFamily).join("، ") || "لا شيء بعد";

    let clustered = 0;
    let regressions = 0;
    for (const err of errors) {
      const prompt = `صنّف هذا الخطأ في لعبة عربية (React+Convex) إلى عائلة سبب جذري. العائلات المعروفة: ${knownFamilies}. إن لم تناسب أي عائلة، اخترع اسماً عربياً موجزاً (كلمتان كحد أقصى).

أجب بهذا التنسيق فقط:
العائلة: <اسم العائلة>
العنوان: <وصف عربي موجز>
الخطورة: <منخفضة أو متوسطة أو حرجة>
قابلية الإصلاح التلقائي: <نعم أو لا>

الخطأ (فئة ${err.category}): ${err.message.slice(0, 300)}
${err.stack ? `المكدس: ${err.stack.slice(0, 600)}` : ""}`;

      const raw = await callGemini(prompt);
      if (!raw) continue;
      const get = (label: string) => {
        const m = raw.match(new RegExp(`${label}:\\s*([^\\n]+)`));
        return m ? m[1].trim() : "";
      };
      const family = get("العائلة") || err.category;
      const title = get("العنوان") || err.message.slice(0, 100);
      const sevTxt = get("الخطورة");
      const severity = sevTxt.includes("حرجة") ? "critical" : sevTxt.includes("متوسطة") ? "medium" : "low";
      const autoFixable = get("قابلية الإصلاح التلقائي").startsWith("نعم");

      const result = await ctx.runMutation(internal.geminiApex.upsertClusterAndLink, {
        errorId: err._id,
        title,
        rootCauseFamily: family,
        severity,
        autoFixable,
      });
      clustered++;
      if (result.isRegression) regressions++;
    }
    return { clustered, regressions };
  },
});
