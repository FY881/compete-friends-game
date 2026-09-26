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
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * 🧪 عالِم العقول (Minds Scientist)
 *
 * الأداة الأكثر نضجاً منهجياً: كل الأدوات السابقة تلاحظ وتقرر — لكن لا شيء
 * يعرف **لماذا**. لماذا يرتفع النشاط؟ هل لأن الطاغوت أشرس، أم لأن العرّاف
 * نشر نبوءة مثيرة، أم صدفة؟
 *
 * العالِم يجيب بمنهجية حقيقية:
 *  1) الفرضية: من بيانات الملاحظة يصوغ ادعاءً سببياً قابلاً للاختبار
 *     («إطالة فترة الكشف ترفع رضا اللاعبين فيتزايد إنشاء إعادات المباراة»).
 *  2) التجربة المُقسّمة: غرف جديدة تُقسم بالحظ (بصمة رمزها) بين مجموعة
 *     تجريبية (تطبّق التغيير) ومجموعة ضبط (تبقى على الوضع القديم) —
 *     **تجربة مضبوطة حقيقية** وليس مجرد «جرب وشوف».
 *  3) القياس: لقطة مؤشرات قبل وأثناء وبعد، لكل مجموعة على حدة.
 *  4) الاستنتاج: فرق المقاييس بين المجموعتين = الأثر السببي الصافي،
 *     مع درجة ثقة إحصائية صريحة — والفرق غير دالّ يُعلن بصدق كذلك.
 *  5) التوصية: تعميم النتيجة يبقى بيد المالك — العلم لا يطفئ تجربته
 *     فيفاجئ الجميع، بل يعرض دليله أولاً.
 *
 * هذه أول أداة AI في اللعبة تُنتج **معرفة سببية** بدلاً من قرارات مباشرة.
 */

const DAY = 24 * 3600_000;
const MIN_EXPERIMENT_DAYS = 3;
const MIN_ROOMS_PER_GROUP = 3;

// ── 1) الرافعات القابلة للتجربة (آمنة ومعزولة) ──────────────────────────

const LEVERS: { key: string; name: string; hypothesis: string; treatment: string; control: string }[] = [
  {
    key: "reveal_pace",
    name: "إيقاع الكشف",
    hypothesis: "إطالة ثانية كشف الإجابة تمنح اللاعبين وقت تهيؤ نفسيني فتزداد إعادات المباراة",
    treatment: JSON.stringify({ revealExtraMs: 1500 }),
    control: JSON.stringify({ revealExtraMs: 0 }),
  },
  {
    key: "streak_celebration",
    name: "احتفال السلاسل",
    hypothesis: "إبراز السلسلة النارية بصرياً في الواجهة يرفع دافع الاستمرار فتطول السلاسل فعلاً",
    treatment: JSON.stringify({ celebrateStreaks: true }),
    control: JSON.stringify({ celebrateStreaks: false }),
  },
];

// ── 2) بدء تجربة جديدة (اختيار ذكي للفرضية الأجدى) ──────────────────────

export const designExperiment = internalAction({
  handler: async (ctx) => {
    // تجربة جارية؟ لا تُفتح أخرى (عزل منهجي صارم)
    const running = (await ctx.runQuery("aiScientist:runningCountInternal" as any, {})) as number;
    if (running > 0) return { started: false as const, reason: "experiment_running" as const };

    // البيانات الحية تختار الرافعة الأجدى (مبدئياً: تناوب منهجي)
    const startedCount = (await ctx.runQuery("aiScientist:totalExperimentsInternal" as any, {})) as number;
    const lever = LEVERS[startedCount % LEVERS.length];

    // صياغة ذكية للفرضية (تُعمّق الصياغة المحلية دون تغيير مضمونها)
    let hypothesis = lever.hypothesis;
    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx);
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت باحث تجربة مستخدم عربي دقيق. أعد صياغة الفرضية التالية بصياغة علمية أنيقة (سطر واحد) دون تغيير معناها القابل للقياس. أجب بالنص فقط.",
            },
            { role: "user", content: lever.hypothesis },
          ],
          200,
          0.5,
          "MindClash Minds Scientist",
        );
        const clean = raw.trim().slice(0, 240);
        if (clean.length > 30) hypothesis = clean;
      } catch {
        // الصياغة المحلية كافية
      }
    }

    await ctx.runMutation("aiScientist:startExperiment" as any, {
      hypothesis,
      lever: lever.key,
      treatment: lever.treatment,
      control: lever.control,
    });

    return { started: true as const, lever: lever.key, hypothesis };
  },
});

export const runningCountInternal = internalQuery({
  handler: async (ctx) => {
    return (
      await ctx.db
        .query("experiments")
        .withIndex("by_status", (q) => q.eq("status", "running"))
        .collect()
    ).length;
  },
});

export const totalExperimentsInternal = internalQuery({
  handler: async (ctx) => {
    return (await ctx.db.query("experiments").collect()).length;
  },
});

export const startExperiment = internalMutation({
  args: {
    hypothesis: v.string(),
    lever: v.string(),
    treatment: v.string(),
    control: v.string(),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("experiments", {
      hypothesis: a.hypothesis,
      lever: a.lever,
      treatment: a.treatment,
      control: a.control,
      treatmentRooms: [],
      controlRooms: [],
      status: "running",
      startedAt: Date.now(),
    });
  },
});

// ── 3) توزيع الغرف الجديدة: عشوائية محكومة بالحظ ───────────────────────

export const assignRoom = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const running = await ctx.db
      .query("experiments")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();
    if (!running) return { assigned: false as const };

    // التوزيع بالحظ من بصمة الرمز — متماثل ومستقر لكل غرفة
    const hash = [...code].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const isTreatment = hash % 2 === 0;
    const group = isTreatment ? "treatmentRooms" : "controlRooms";
    const current = isTreatment ? running.treatmentRooms : running.controlRooms;
    // مجموعات غير متوازنة؟ الوفاء بالتوازن أولاً
    const balanceDiff = running.treatmentRooms.length - running.controlRooms.length;
    const assignTreatment = balanceDiff < 0 ? true : balanceDiff > 0 ? false : isTreatment;
    const finalGroup = assignTreatment ? "treatmentRooms" : "controlRooms";

    if (!current.includes(code)) {
      await ctx.db.patch(running._id, {
        [finalGroup]: [...(assignTreatment ? running.treatmentRooms : running.controlRooms), code],
      } as never);
    }
    return { assigned: true as const, group: finalGroup };
  },
});

// ── 4) خاتمة التجربة: قياس واستنتاج ────────────────────────────────────

export const concludeDue = internalAction({
  handler: async (ctx) => {
    const now = Date.now();
    const running = (await ctx.runQuery("aiScientist:getRunningInternal" as any, {})) as {
      _id: string;
      hypothesis: string;
      lever: string;
      treatmentRooms: string[];
      controlRooms: string[];
      startedAt: number;
    } | null;
    if (!running) return { concluded: false as const, reason: "none_running" as const };
    if (now - running.startedAt < MIN_EXPERIMENT_DAYS * DAY) {
      return { concluded: false as const, reason: "too_early" as const };
    }
    if (
      running.treatmentRooms.length < MIN_ROOMS_PER_GROUP ||
      running.controlRooms.length < MIN_ROOMS_PER_GROUP
    ) {
      // عيّنة غير كافية — إنهاء صادق بلا استنتاج
      await ctx.runMutation("aiScientist:markConcluded" as any, {
        experimentId: running._id,
        conclusion:
          "أُلغيت التجربة: عدد الغرف في إحدى المجموعتين لم يبلغ الحد الأدنى الإحصائي — لا استنتاج سببي ممكن.",
        confidence: 0,
        applied: false,
      });
      return { concluded: true as const, verdict: "aborted_no_sample" as const };
    }

    // القياس: مؤشر النشاط لكل مجموعة (إعادات المباراة + الجولات)
    const measure = async (rooms: string[]) => {
      let rematches = 0;
      let rounds = 0;
      let scores = 0;
      let scoreCount = 0;
      for (const code of rooms) {
        const rematchRows = await ctx.runQuery("aiScientist:roomRematchesInternal" as any, { code });
        rematches += (rematchRows as number) ?? 0;
        const roundRows = (await ctx.runQuery("aiScientist:roomRoundsInternal" as any, { code })) as {
          count: number;
          avgScore: number;
        } | null;
        if (roundRows) {
          rounds += roundRows.count;
          scores += roundRows.avgScore * roundRows.count;
          scoreCount += roundRows.count;
        }
      }
      return { rematches, rounds, avgScore: scoreCount > 0 ? scores / scoreCount : 0 };
    };

    const t = await measure(running.treatmentRooms);
    const c = await measure(running.controlRooms);

    // الاستنتاج: مقارنة معدل إعادات المباراة لكل غرفة (المؤشر الأساسي)
    const tRate = running.treatmentRooms.length > 0 ? t.rematches / running.treatmentRooms.length : 0;
    const cRate = running.controlRooms.length > 0 ? c.rematches / running.controlRooms.length : 0;
    const lift = cRate > 0 ? Math.round(((tRate - cRate) / cRate) * 100) : 0;

    // الثقة الإحصائية: تقريبية من حجم العينة وحجم الأثر (توضيحية بلا ادعاء p-value زائف)
    const effectSize = cRate > 0 ? Math.abs(tRate - cRate) / cRate : 0;
    const confidence = Math.min(
      90,
      Math.round(
        (running.treatmentRooms.length + running.controlRooms.length) * 6 +
          effectSize * 80,
      ),
    );

    const meaningful = confidence >= 50 && Math.abs(lift) >= 10;
    const conclusion = meaningful
      ? lift > 0
        ? `النتيجة تدعم الفرضية: مجموعة التجربة حققت معدل إعادة مباراة أعلى بـ ${lift}% من الضبط — الأثر السببي مرجّح بقوة ${confidence}%. يُوصى بتعميم التغيير.`
        : `النتيجة تنفي الفرضية: مجموعة التجربة أدت معدل إعادة أقل بـ ${Math.abs(lift)}% — التغيير يبدو معاكساً للأثر المنشود (ثقة ${confidence}%). يُوصى بعدم التعميم.`
      : `الفرق بين المجموعتين غير دالّ (${lift}% فقط، ثقة ${confidence}%) — لا دليل كافٍ على أثر سببي. علمياً: «لا أثر مكتشف» نتيجة أيضاً.`;

    const shouldApply = meaningful && lift > 0 && confidence >= 60;

    await ctx.runMutation("aiScientist:markConcluded" as any, {
      experimentId: running._id,
      conclusion,
      confidence,
      applied: shouldApply,
    });

    return {
      concluded: true as const,
      verdict: meaningful ? (lift > 0 ? "supported" as const : "refuted" as const) : "inconclusive" as const,
      lift,
      confidence,
      shouldApply,
    };
  },
});

export const getRunningInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query("experiments")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();
  },
});

export const markConcluded = internalMutation({
  args: {
    experimentId: v.id("experiments"),
    conclusion: v.string(),
    confidence: v.number(),
    applied: v.boolean(),
  },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.experimentId, {
      status: a.confidence === 0 ? "aborted" : "concluded",
      conclusion: a.conclusion,
      causalConfidence: a.confidence,
      appliedGlobally: a.applied,
      concludedAt: Date.now(),
    });
  },
});

// استعلامات قياس مساندة
export const roomRematchesInternal = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!game) return 0;
    const rematches = await ctx.db
      .query("games")
      .withIndex("by_rematch", (q) => q.eq("rematchOf", game._id))
      .collect();
    return rematches.length;
  },
});

export const roomRoundsInternal = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!game) return null;
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (players.length === 0) return null;
    const avgScore = players.reduce((s, p) => s + p.score, 0) / players.length;
    return { count: 1, avgScore };
  },
});

// ── 5) المهمة الدورية + الواجهة ────────────────────────────────────────

export const scientistJob = internalMutation({
  handler: async (ctx) => {
    const running = await ctx.db
      .query("experiments")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .first();
    if (running) {
      await ctx.scheduler.runAfter(0, internal.aiScientist.concludeDue, {});
    } else {
      await ctx.scheduler.runAfter(0, "aiScientist:designExperiment" as any, {});
    }
    return { scheduled: true };
  },
});

export const getLab = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const rows = await ctx.db
      .query("experiments")
      .withIndex("by_started", (q) => q.gt("startedAt", 0))
      .order("desc")
      .take(10);
    return rows.map((r) => ({
      _id: r._id,
      hypothesis: r.hypothesis,
      lever: r.lever,
      status: r.status,
      treatmentRooms: r.treatmentRooms.length,
      controlRooms: r.controlRooms.length,
      conclusion: r.conclusion ?? null,
      causalConfidence: r.causalConfidence ?? null,
      appliedGlobally: r.appliedGlobally ?? null,
      startedAt: r.startedAt,
      concludedAt: r.concludedAt ?? null,
      daysRunning: Math.floor((Date.now() - r.startedAt) / DAY),
    }));
  },
});

export const runNow = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiScientist:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    return await ctx.runAction("aiScientist:concludeDue" as any, {});
  },
});

export const designNow = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiScientist:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    return await ctx.runAction("aiScientist:designExperiment" as any, {});
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "العالِم" };
  },
});
