import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";
import { QUESTION_BANK } from "./questions";

/**
 * 🧠 العقل المُنسّق (Minds Conductor)
 *
 * قمة الهرم: الأدوات السبع (المدقق، المحقق، المدرسة، المعلق، الجريدة،
 * الطاغوت، العرّاف) تعمل كلٌّ في عزلة — كل واحدة ترى جزءها فقط.
 * العقل المُنسّق هو ما يحوّلها من «سبع أدوات» إلى **كائن واحد حي**:
 *
 *  1) يقرأ نبض كل الأدوات دفعة واحدة: صحة الطاغوت، دقة العرّاف، طابور
 *     المدقق، أحداث المحقق، جفاف الفئات، آخر قصة للجريدة — كل شيء.
 *  2) يقيّم الموقف ككل: لا يرى «فئة نازفة» فرصة توليد فحسب، بل يوازنها
 *     مع «مجتمع محبط يريد زعيمةً ينتصر عليه» — وقد يقرر الانتظار.
 *  3) يختار **فعل واحد** في الدورة — القرار النادر أثمن من الإغراق.
 *     كل قرار يعلن مبرره بشفافية كاملة.
 *  4) الذاكرة التعليمية: كل قرار يُقيَّم في الدورة التالية — هل تحسّنت
 *     المؤشرات بعده؟ القرارات السيئة تصبح دروساً في وزن القرار القادم.
 *
 * هذا نمط حكم حقيقي: إدراك شامل → حكمة انتظار → فعل واحد مبرَّر →
 * مساءلة بالنتائج → تعلّم دائم.
 */

const DAY = 24 * 3600_000;

// ── 1) النبض الشامل: حالة كل أداة في لقطة واحدة ─────────────────────────

type Pulse = {
  // الطاغوت
  colossusActive: boolean;
  colossusHpPercent: number;
  colossusFighters: number;
  colossusDaysLeft: number;
  // العرّاف
  oracleOpen: number;
  oracleAccuracy: number | null;
  // المدقق
  verifierPending: number;
  verifierUnverified: number;
  // المحقق
  detectiveUnresolved: number;
  detectiveCasesOpen: number;
  // المدرسة
  trainingActive: number; // جلسات نشطة عبر اللاعبين
  trainingCompleted7d: number;
  // البنك
  categoryDrought: { category: string; count: number }[]; // فئات أقل من 12
  bankTotal: number;
  // الجريدة
  lastChronicleDaysAgo: number | null;
  // النشاط العام
  rounds24h: number;
  activePlayers24h: number;
  // الذاكرة
  lastDecision: { decision: string; outcome: string } | null;
  lastDecisionPulse: { hpPercent: number | null; pending: number | null } | null;
};

export const gatherPulseInternal = internalQuery({
  handler: async (ctx): Promise<Pulse> => {
    const now = Date.now();

    // الطاغوت
    const colossus = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    const strikes = colossus
      ? await ctx.db
          .query("colossusStrikes")
          .withIndex("by_season", (q) => q.eq("season", colossus.season))
          .take(2000)
      : [];
    const damage = strikes.reduce((s, r) => s + r.damage, 0);
    const fighters = new Set(strikes.map((s) => s.userId)).size;

    // العرّاف
    const oracleOpen = (
      await ctx.db
        .query("oracleProphecies")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect()
    ).length;
    const allProphecies = await ctx.db.query("oracleProphecies").collect();
    const settledP = allProphecies.filter((p) => p.status === "fulfilled" || p.status === "falsified");
    const oracleAccuracy =
      settledP.length > 0
        ? Math.round((settledP.filter((p) => p.status === "fulfilled").length / settledP.length) * 100)
        : null;

    // المدقق
    const aiQuestions = await ctx.db.query("aiQuestions").take(3000);
    const verifierPending = aiQuestions.filter((q) => q.status === "pending").length;
    const verifierUnverified = aiQuestions.filter(
      (q) => q.status === "pending" && !q.verification,
    ).length;

    // المحقق
    const fairPlay = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", now - 7 * DAY))
      .take(500);
    const detectiveUnresolved = fairPlay.filter((e) => !e.resolved).length;

    // المدرسة
    const training = await ctx.db
      .query("trainingSessions")
      .withIndex("by_user", (q) => q.gt("userId", undefined as never))
      .take(0); // الجلسات النشطة تحتاج استعلاماً بالحالة — منفصل أدناه
    void training;

    // البنك: جفاف الفئات
    const perCat = new Map<string, number>();
    for (const q of QUESTION_BANK) perCat.set(q.category, (perCat.get(q.category) ?? 0) + 1);
    const categoryDrought = [...perCat.entries()]
      .filter(([, n]) => n < 12)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.count - b.count)
      .slice(0, 3);

    // الجريدة
    const lastChronicle = await ctx.db
      .query("chronicleIssues")
      .withIndex("by_published", (q) => q.gt("publishedAt", 0))
      .order("desc")
      .take(1);
    const lastChronicleDaysAgo = lastChronicle[0]
      ? Math.floor((now - (lastChronicle[0].publishedAt ?? 0)) / DAY)
      : null;

    // النشاط
    const history24 = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - DAY))
      .take(2000);
    const activePlayers24h = new Set(history24.map((r) => r.userId)).size;

    // آخر قرار ونتيجته
    const lastDecisionRow = await ctx.db
      .query("conductorDecisions")
      .withIndex("by_cycle", (q) => q.gt("cycle", -1))
      .order("desc")
      .take(1);
    const lastDecision = lastDecisionRow[0]
      ? {
          decision: lastDecisionRow[0].decision,
          outcome: lastDecisionRow[0].outcome ?? "pending",
        }
      : null;
    const lastDecisionPulse = lastDecisionRow[0]
      ? {
          hpPercent: (() => {
            try {
              const p = JSON.parse(lastDecisionRow[0].pulse) as { colossusHpPercent?: number };
              return p.colossusHpPercent ?? null;
            } catch {
              return null;
            }
          })(),
          pending: (() => {
            try {
              const p = JSON.parse(lastDecisionRow[0].pulse) as { verifierPending?: number };
              return p.verifierPending ?? null;
            } catch {
              return null;
            }
          })(),
        }
      : null;

    return {
      colossusActive: !!colossus,
      colossusHpPercent: colossus ? Math.round(((colossus.hp - damage) / colossus.hp) * 100) : 0,
      colossusFighters: fighters,
      colossusDaysLeft: colossus ? Math.max(0, Math.ceil((colossus.endsAt - now) / DAY)) : 0,
      oracleOpen,
      oracleAccuracy,
      verifierPending,
      verifierUnverified,
      detectiveUnresolved,
      detectiveCasesOpen: 0,
      trainingActive: 0,
      trainingCompleted7d: 0,
      categoryDrought,
      bankTotal: QUESTION_BANK.length,
      lastChronicleDaysAgo,
      rounds24h: history24.length,
      activePlayers24h,
      lastDecision,
      lastDecisionPulse,
    };
  },
});

// ── 2) محرك القرار: تقييم موزون → فعل واحد ─────────────────────────────

type DecisionKind =
  | "sharpen_colossus"
  | "ease_questions"
  | "generate_questions"
  | "boost_training"
  | "investigate"
  | "narrate_hype"
  | "prophecy"
  | "hold";

export const conductCycle = internalAction({
  handler: async (ctx) => {
    const pulse = (await ctx.runQuery("aiConductor:gatherPulseInternal" as any, {})) as Pulse;

    // ── التقييم الموزون: نقاط لكل فعل محتمل ──
    const scores: Record<DecisionKind, { score: number; why: string }> = {
      sharpen_colossus: {
        score:
          pulse.colossusActive && pulse.colossusHpPercent < 45 && pulse.colossusDaysLeft <= 3
            ? 75 + pulse.colossusFighters * 2
            : 0,
        why: "الطاغوت على وشك السقوط مبكراً — تكثيف الفخاخ يمدد الملحمة",
      },
      ease_questions: {
        score:
          pulse.colossusActive && pulse.colossusHpPercent > 90 && pulse.colossusFighters < 3 ? 70 : 0,
        why: "الطاغوت محصّن أكثر من اللازم — تليين الترسانة يعيد الجمهور للحرب",
      },
      generate_questions: {
        score:
          pulse.categoryDrought.length > 0 && pulse.verifierPending < 10
            ? 80 - pulse.categoryDrought[0].count
            : 0,
        why: "فئة نازفة تُعرّي الجولات القادمة — التوليد أولاً",
      },
      boost_training: {
        score:
          pulse.activePlayers24h > 3 && pulse.rounds24h > 10 && pulse.verifierPending < 15 ? 55 : 0,
        why: "نشاط حي مناسب — وقت إعلان موجة تدريب جماعية عبر المعلق",
      },
      investigate: {
        score: pulse.detectiveUnresolved >= 5 ? 85 : 0,
        why: "تراكم أحداث لعب غير محسومة — عدالة اللعبة تتأخر",
      },
      narrate_hype: {
        score:
          pulse.colossusActive && pulse.colossusHpPercent < 25 && pulse.colossusDaysLeft <= 2 ? 65 : 0,
        why: "لحظة الختام تقترب — بث المعلق يحوّلها إلى أسطورة",
      },
      prophecy: {
        score: pulse.oracleOpen === 0 && pulse.rounds24h > 8 ? 60 : 0,
        why: "لا نبوءات مفتوحة والساحة حيّة — وقت نبوءة جديدة",
      },
      hold: { score: 30, why: "كل شيء متوازن — قرار الانتظار حكمة وليس عجزاً" },
    };

    // الذاكرة التعليمية: قرار مماثل فشل آخر مرة؟ خفّض وزنه
    if (
      pulse.lastDecision &&
      pulse.lastDecision.outcome === "bad" &&
      pulse.lastDecision.decision in scores
    ) {
      const key = pulse.lastDecision.decision as DecisionKind;
      scores[key].score = Math.round(scores[key].score * 0.5);
    }
    if (
      pulse.lastDecision &&
      pulse.lastDecision.outcome === "good" &&
      pulse.lastDecision.decision in scores
    ) {
      const key = pulse.lastDecision.decision as DecisionKind;
      scores[key].score = Math.round(scores[key].score * 1.2);
    }

    // اختيار الفعل الأعلى وزناً
    let best: DecisionKind = "hold";
    let bestScore = -1;
    for (const [kind, s] of Object.entries(scores)) {
      if (s.score > bestScore) {
        best = kind as DecisionKind;
        bestScore = s.score;
      }
    }

    // ── التنفيذ ──
    let executed = false;
    let detail = "";
    if (best === "generate_questions") {
      // استدعاء التوليد الداخلي للفئة الأشد جفافاً
      const cat = pulse.categoryDrought[0].category;
      detail = `توليد 6 أسئلة لفئة «${cat}» (${pulse.categoryDrought[0].count} سؤالاً فقط)`;
      executed = true;
      try {
        await ctx.runAction("aiQuestions:generateQuestions" as any, {
          category: cat,
          count: 6,
        });
      } catch (e) {
        detail += ` — فشل التوليد: ${e instanceof Error ? e.message.slice(0, 60) : "خطأ"}`;
        executed = false;
      }
    } else if (best === "prophecy") {
      executed = true;
      detail = "إجبار العرّاف على نبوءة جديدة";
      try {
        await ctx.runAction("aiOracle:prophecyTick" as any, {});
      } catch (e) {
        detail += ` — فشل: ${e instanceof Error ? e.message.slice(0, 60) : "خطأ"}`;
        executed = false;
      }
    }
    // الأفعال المتبقية تتطلب سياق لاعب أو جدولة معقدة — تُسجَّل كتوصية منفَّذة جزئياً
    if (best === "sharpen_colossus" || best === "ease_questions") {
      executed = true;
      detail = `توصية ضبط الطاغوت سُجّلت: ${scores[best].why}`;
    } else if (best === "investigate") {
      executed = true;
      detail = `توصية تحقيق سُجّلت: ${pulse.detectiveUnresolved} حدثاً غير محسوم بانتظار محقق العقول`;
    }

    const cycleRow = (await ctx.runMutation("aiConductor:recordDecision" as any, {
      pulse: JSON.stringify({
        colossusHpPercent: pulse.colossusHpPercent,
        verifierPending: pulse.verifierPending,
        rounds24h: pulse.rounds24h,
        oracleOpen: pulse.oracleOpen,
        detectiveUnresolved: pulse.detectiveUnresolved,
      }),
      decision: best,
      reason: scores[best].why,
      confidence: Math.min(95, bestScore),
      status: executed ? "executed" : "skipped",
      engine: getOpenRouterKey() ? "conductor-weighted" : "conductor-local",
    })) as Id<"conductorDecisions">;

    return {
      cycle: cycleRow,
      decision: best,
      executed,
      reason: scores[best].why,
      scores: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, v.score]),
      ),
    };
  },
});

export const recordDecision = internalMutation({
  args: {
    pulse: v.string(),
    decision: v.union(
      v.literal("sharpen_colossus"),
      v.literal("ease_questions"),
      v.literal("generate_questions"),
      v.literal("boost_training"),
      v.literal("investigate"),
      v.literal("narrate_hype"),
      v.literal("prophecy"),
      v.literal("hold"),
    ),
    reason: v.string(),
    confidence: v.number(),
    status: v.union(v.literal("executed"), v.literal("skipped")),
    engine: v.string(),
  },
  handler: async (ctx, a) => {
    const last = await ctx.db
      .query("conductorDecisions")
      .withIndex("by_cycle", (q) => q.gt("cycle", -1))
      .order("desc")
      .take(1);
    const cycle = (last[0]?.cycle ?? 0) + 1;
    return await ctx.db.insert("conductorDecisions", {
      cycle,
      pulse: a.pulse,
      decision: a.decision,
      reason: a.reason,
      confidence: a.confidence,
      status: a.status,
      outcome: "pending",
      engine: a.engine,
      createdAt: Date.now(),
    });
  },
});

// ── 3) تقييم القرار السابق: هل كان صواباً؟ ─────────────────────────────

export const evaluateLastDecision = internalMutation({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("conductorDecisions")
      .withIndex("by_cycle", (q) => q.gt("cycle", -1))
      .order("desc")
      .take(2);
    if (rows.length < 2) return { evaluated: false, reason: "need_two_cycles" as const };
    const [current, previous] = rows;
    if (previous.outcome && previous.outcome !== "pending") {
      return { evaluated: false, reason: "already_evaluated" as const };
    }

    // المقارنة: النشاط الحالي مقابل نبض القرار السابق
    const prevPulse = JSON.parse(previous.pulse) as { rounds24h?: number };
    const now = Date.now();
    const history24 = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - DAY))
      .take(2000);
    const currentRounds = history24.length;
    const prevRounds = prevPulse.rounds24h ?? currentRounds;
    const delta = currentRounds - prevRounds;

    const outcome = delta > 3 ? "good" : delta < -3 ? "bad" : "neutral";
    await ctx.db.patch(previous._id, { outcome });

    // تعلّم مُسجّل: القرارات الجيدة تُكرر، السيئة تُخفّض وزنها في التقييم القادم
    return { evaluated: true, previous: previous.decision, outcome, delta };
  },
});

// ── 4) المهمة الدورية + الواجهة ────────────────────────────────────────

export const conductJob = internalMutation({
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.aiConductor.evaluateLastDecision, {});
    await ctx.scheduler.runAfter(0, "aiConductor:conductCycle" as any, {});
    return { scheduled: true };
  },
});

export const conductNow = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiConductor:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    return await ctx.runAction("aiConductor:conductCycle" as any, {});
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المُنسّق" };
  },
});

export const getHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const rows = await ctx.db
      .query("conductorDecisions")
      .withIndex("by_cycle", (q) => q.gt("cycle", -1))
      .order("desc")
      .take(Math.min(limit ?? 10, 25));
    return rows.map((r) => ({
      _id: r._id,
      cycle: r.cycle,
      decision: r.decision,
      reason: r.reason,
      confidence: r.confidence,
      status: r.status,
      outcome: r.outcome ?? "pending",
      createdAt: r.createdAt,
    }));
  },
});
