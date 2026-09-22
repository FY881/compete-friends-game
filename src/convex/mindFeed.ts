import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  FACULTY_KEYS,
  FACULTY_XP_CAP,
  computeTierFromXp,
  rankLevelFor,
} from "./mindCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 تغذية العقل على الخادم — المرحلة 1 من التوسع
 *
 * الفجوة الحقيقية التي يعالجها هذا الملف:
 * «العقل المتطور» (٦ قوى) كان يُبنى من الإجابات **في الأوفلاين فقط**
 * (localEngine → recordMindSession). أما كل لعب أونلاين (الشكل الأساسي
 * للعبة) فكان يجري عبر games.finishGame الذي يغذي كل الأنظمة (عشائر،
 * دوريات، موسم، إنجازات...) **عدا العقل نفسه** — فلاعب أونلاين لا يبني
 * عقله أبداً، ورتبته على لوحة الصدارة تتجمد.
 *
 * الحل: كل جولة خادمية تنتهي → تُحتسب مكاسب القوى من إجابات اللاعب
 * الحقيقية (نفس منطق وروح المحرك المحلي: دقة/صعوبة/سرعة/سلسلة/إصابة
 * سابقة) وتُكتب مباشرة في mindProfiles مع كل الحدود.
 *
 * قواعد صارمة:
 *   • لا كتابة إطلاقاً للاعب الذي عقله مُجمَّد (عقوبة العرش تُحترم).
 *   • كل قوة مقيدة بسقف FACULTY_XP_CAP — لا تجاوز ممكن.
 *   • المكاسب تحتها سقف صريح لكل جولة (تمنع قفزات غير منطقية).
 *   • tierScore/rankLevel يُحسبان على الخادم دائماً — لا ثقة بالعميل.
 *   • الإجابة الفارغة (null = لم يُجب) لا تنتج أي نقطة.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** سقف المكاسب لكل قوة من جولة واحدة — بلا قفزات. */
const MAX_GAIN_PER_FACULTY = 40;

interface AnswerInfo {
  questionId: string;
  selected: number;
  correct: boolean;
  elapsedMs?: number;
}

interface QuestionInfo {
  difficulty: string; // "easy" | "medium" | "hard"
}

/**
 * حساب مكاسب القوى من إجابات جولة حقيقية — نقية وقابلة للاختبار.
 * نفس روح facultyGainsForSession في المحرك المحلي لكن بمصادر الخادم:
 *  • الصعوبة تأتي من بنك/جدول الأسئلة المحلول مسبقاً
 *  • «إصابة سابقة» تعادل الإجابة الصحيحة بعد خطأ على نفس السؤال في هذه الجولة
 *    (نسخة خادمية بسيطة — الذاكرة عبر الجولات تُدار بمكسب أعلى للأخطاء المُصلحة)
 *  • السرعة نسبة زمن الإجابة إلى 20 ثانية (معدّل العدّاد القياسي)
 */
export function serverFacultyGains(
  answers: (AnswerInfo | null)[],
  questionById: Map<string, QuestionInfo>,
  timerSeconds: number,
): Record<string, number> {
  const gains: Record<string, number> = {};
  for (const k of FACULTY_KEYS) gains[k] = 0;

  for (const a of answers) {
    if (!a) continue; // لم يُجب — لا شيء
    const q = questionById.get(a.questionId);
    const hard = q?.difficulty === "hard";
    const medium = q?.difficulty === "medium";

    if (a.correct) {
      gains.knowledge += 3 + (hard ? 2 : medium ? 1 : 0);
      gains.logic += hard ? 5 : medium ? 3 : 2;
      gains.memory += 3;
      // الحدس: سرعة الإصابة تدل على بديهة
      if (typeof a.elapsedMs === "number" && a.elapsedMs > 0 && a.elapsedMs < 3000) {
        gains.intuition += 3;
      }
      // السرعة: نسبة زمن الإجابة إلى مدة العدّاد
      if (typeof a.elapsedMs === "number" && a.elapsedMs >= 0 && timerSeconds > 0) {
        const ratio = a.elapsedMs / Math.max(1000, timerSeconds * 1000);
        gains.speed += Math.max(0, Math.round(6 - ratio * 8));
      }
    } else {
      // الخطأ يعلّم — لكن بقدر أقل
      gains.memory += 3;
      gains.logic += 1;
    }
  }

  // سقف القوة الواحدة في الجولة
  for (const k of FACULTY_KEYS) gains[k] = Math.min(MAX_GAIN_PER_FACULTY, gains[k]);
  return gains;
}

/** تقرير المكاسب الذي يعود للاعب في الواجهة — شفاف بالسبب. */
export interface MindFeedResult {
  updated: boolean;
  gains: Record<string, number>;
  rankLevelBefore: number;
  rankLevelAfter: number;
  tierScoreAfter: number;
  rankUp: boolean;
}

export const feedFromGame = internalMutation({
  args: {
    userId: v.id("users"),
    answers: v.array(
      v.union(
        v.null(),
        v.object({
          questionId: v.string(),
          selected: v.number(),
          correct: v.boolean(),
          elapsedMs: v.optional(v.number()),
        }),
      ),
    ),
    questionDifficulties: v.array(v.object({ id: v.string(), difficulty: v.string() })),
    timerSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<MindFeedResult> => {
    const result: MindFeedResult = {
      updated: false,
      gains: {},
      rankLevelBefore: 1,
      rankLevelAfter: 1,
      tierScoreAfter: 0,
      rankUp: false,
    };

    const profile = await ctx.db
      .query("mindProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // لا ملف عقل بعد؟ — اللاعب يزامن من جهازه أول مرة (syncMyMind) ثم تتغذى جولاته
    if (!profile) return result;
    if (profile.frozen) return result; // عقوبة العرش تُحترم — لا تقدّم

    const questionById = new Map(
      args.questionDifficulties.map((q) => [q.id, { difficulty: q.difficulty }]),
    );
    const gains = serverFacultyGains(
      args.answers as (AnswerInfo | null)[],
      questionById,
      args.timerSeconds,
    );

    const totalGain = Object.values(gains).reduce((s, n) => s + n, 0);
    if (totalGain <= 0) return result;

    const faculties: Record<string, number> = { ...(profile.faculties as Record<string, number>) };
    for (const k of FACULTY_KEYS) {
      faculties[k] = Math.min(FACULTY_XP_CAP, (faculties[k] ?? 0) + (gains[k] ?? 0));
    }

    const tierScoreAfter = computeTierFromXp(faculties as never);
    const rankLevelBefore = profile.rankLevel;
    const rankLevelAfter = rankLevelFor(tierScoreAfter);

    await ctx.db.patch(profile._id, {
      faculties,
      tierScore: tierScoreAfter,
      rankLevel: rankLevelAfter,
      updatedAt: Date.now(),
    } as never);

    return {
      updated: true,
      gains,
      rankLevelBefore,
      rankLevelAfter,
      tierScoreAfter,
      rankUp: rankLevelAfter > rankLevelBefore,
    };
  },
});

/** إشعار ترقية رتبة العقل — يُستدعى فقط عند rankUp الفعلي. */
export const notifyRankUp = internalMutation({
  args: { userId: v.id("users"), rankLevel: v.number() },
  handler: async (ctx, { userId, rankLevel }) => {
    await ctx.runMutation(internal.notify.push, {
      userId,
      title: "🧠 عقلك ارتقى رتبة!",
      body: `بنيتُ عقلك من إجاباتك الحقيقية في اللعب — رتبتك الآن: ${rankLevel} من 8. راجع مختبر العقل.`,
      type: "info",
      category: "system",
      priority: "important",
    });
  },
});
