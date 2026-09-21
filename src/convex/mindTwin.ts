/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 التوأم الذهني (Mental Twin) — v13.0
 *
 * الفكرة: لكل لاعب «توأم» يقرأ أداءه الحقيقي فئةً فئة، فيقول له بصدق:
 *   • أين قوّتك فعلًا (لا مجاملة)، وأين نقطة ضعفك فعلًا (لا تخمين).
 *   • كم أنت واثق من هذه القراءة (حجم العيّنة الحقيقي).
 *   • وما الفئة التي يجب أن تتدرب عليها الآن، وبأي صعوبة.
 *
 * وكل هذا من **بيانات لعب حقيقية فقط**:
 *   `mindSpecializations` (إتقان كل فئة) + `categoryHistory` (صح/مجموع) +
 *   `profiles` (الحجم الكلي). لا أرقام مُختلقة ولا نسب مُجمّلة.
 *
 * ثم — وهذا الجزء المهم — يستطيع اللاعب أن يجعل نقطة ضعفه **تحدّياً حقيقياً**
 * يشاركه مع أصدقائه (`TWIN-XXXXXX`)، فتُبنى أسئلة الساحة من الفئة نفسها
 * (لا من العشوائية)، والمكافأة تُدفع من الخادم كما في أي تحدٍّ آخر.
 *
 * ملاحظة صدق: أقوى/أضعف فئة تُحسب **داخل الخادم** عند إنشاء التحدّي، لا في
 * الواجهة — فلا يستطيع اللاعب تزوير «نقطة ضعفه» للحصول على تحدٍّ أسهل.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { createChallengeRecord } from "./challenges";

/** أقل عدد إجابات حقيقي لاعتبار الفئة «مقيسة» — أقل من ذلك تخمين */
export const TWIN_MIN_SAMPLE = 3;
/** سقف صفوف الإتقان التي نقرأها لبناء العيّنة الحقيقية */
const SAMPLE_CAP = 400;

const LEVEL_LABEL: Record<string, string> = {
  novice: "مبتدئ",
  apprentice: "متدرّب",
  scholar: "عالم",
  master: "معلّم",
  grandmaster: "أستاذ أعظم",
};

export interface TwinCategory {
  category: string;
  correct: number;
  total: number;
  accuracy: number; // 0-100 من الإجابات الحقيقية
  mastery: number; // 0-100 من mindSpecializations (يساوي الدقة إن غاب)
  level: string;
  levelLabel: string;
  measured: boolean;
}

/** صعوبة عادلة مشتقّة من دقة اللاعب الفعلية في تلك الفئة */
export function fairDifficulty(accuracy: number): "easy" | "medium" | "hard" | "expert" {
  if (accuracy < 45) return "easy";
  if (accuracy < 65) return "medium";
  if (accuracy < 82) return "hard";
  return "expert";
}

/** يقرأ كل قراءات اللاعب ويدمجها في مصدر واحد */
async function readCategories(ctx: QueryCtx | MutationCtx, userId: string): Promise<TwinCategory[]> {
  const specs = await ctx.db
    .query("mindSpecializations")
    .withIndex("by_user", (q) => q.eq("userId", userId as never))
    .take(120);
  const hist = await ctx.db
    .query("categoryHistory")
    .withIndex("by_user", (q) => q.eq("userId", userId as never))
    .take(160);

  const byCat = new Map<string, { correct: number; total: number; mastery: number | null; level: string }>();

  for (const h of hist) {
    const cur = byCat.get(h.category) ?? { correct: 0, total: 0, mastery: null, level: "" };
    cur.correct += h.correct;
    cur.total += h.total;
    byCat.set(h.category, cur);
  }
  for (const s of specs) {
    const cur = byCat.get(s.category) ?? { correct: 0, total: 0, mastery: null, level: "" };
    cur.correct = Math.max(cur.correct, s.correct);
    cur.total = Math.max(cur.total, s.total);
    cur.mastery = s.mastery;
    cur.level = s.level;
    byCat.set(s.category, cur);
  }

  return [...byCat.entries()].map(([category, v2]) => {
    const accuracy = v2.total > 0 ? Math.round((v2.correct / v2.total) * 1000) / 10 : 0;
    const mastery = v2.mastery ?? accuracy;
    return {
      category,
      correct: v2.correct,
      total: v2.total,
      accuracy,
      mastery,
      level: v2.level || (mastery >= 90 ? "grandmaster" : mastery >= 75 ? "master" : mastery >= 55 ? "scholar" : mastery >= 30 ? "apprentice" : "novice"),
      levelLabel: LEVEL_LABEL[v2.level] ?? "",
      measured: v2.total >= TWIN_MIN_SAMPLE,
    };
  });
}

/** نسبة اللاعب الحقيقية بين كل العقول — من بيانات الإتقان الفعلية وحدود واضحة */
async function percentileOf(ctx: QueryCtx | MutationCtx, userId: string): Promise<{ percentile: number; sampleMinds: number }> {
  const rows = await ctx.db.query("mindSpecializations").take(SAMPLE_CAP);
  const per = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const key = r.userId as unknown as string;
    const cur = per.get(key) ?? { sum: 0, n: 0 };
    cur.sum += r.mastery;
    cur.n += 1;
    per.set(key, cur);
  }
  const mine = per.get(userId);
  if (!mine || mine.n === 0) return { percentile: 0, sampleMinds: per.size };
  const myAvg = mine.sum / mine.n;
  const others = [...per.entries()].filter(([k]) => k !== userId).map(([, v2]) => v2.sum / v2.n);
  if (others.length === 0) return { percentile: 100, sampleMinds: 1 };
  const below = others.filter((x) => x < myAvg).length;
  return { percentile: Math.round((below / others.length) * 1000) / 10, sampleMinds: per.size };
}

// ═══════════════════════════════════════════════════════════════════════
// ① القراءة — تشخيص صادق + وصفة تدريب حقيقية
// ═══════════════════════════════════════════════════════════════════════

export const getMyTwin = query({
  args: {},
  handler: async (ctx) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) return null;
    const me = await ctx.db.get(meId);

    const cats = await readCategories(ctx, meId as unknown as string);
    const measured = cats.filter((c) => c.measured).sort((a, b) => b.mastery - a.mastery);
    const unmeasured = cats.filter((c) => !c.measured);

    const answeredTotal = cats.reduce((s, c) => s + c.total, 0);
    // الثقة = حجم العيّنة الحقيقي + تنوّع الفئات المقيسة (لا أكثر)
    const confidence = Math.min(
      100,
      Math.round((Math.min(answeredTotal, 120) / 120) * 60 + (Math.min(measured.length, 8) / 8) * 40),
    );

    const strengths = measured.slice(0, 3);
    const weaknessPool = measured.length > 3 ? measured.slice(3) : measured;
    const weaknesses = [...weaknessPool].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
    const focus = weaknesses[0] ?? null;

    const { percentile, sampleMinds } = await percentileOf(ctx, meId as unknown as string);

    const reading: string[] = [];
    if (answeredTotal === 0) {
      reading.push("لم تُسجَّل إجاباتك بعد — التوأم يحتاج جولات حقيقية ليقرأ عقلك.");
    } else {
      if (strengths[0]) {
        reading.push(`عقلك يبرع في «${strengths[0].category}» بإتقان ${strengths[0].mastery}٪ — هذه ساحتك التي تكسب فيها.`);
      }
      if (focus) {
        reading.push(
          `أضعف نقطة مقيسة: «${focus.category}» بإتقان ${focus.mastery}٪ من ${focus.total} إجابة — التدريب عليها يرفع معدلك العام أسرع من أي شيء آخر.`,
        );
      }
      if (unmeasured.length > 0) {
        reading.push(`${unmeasured.length} فئة لم تُقَس بعد (أقل من ${TWIN_MIN_SAMPLE} إجابات) — لا نحكم عليها بلا دليل.`);
      }
      if (confidence < 40) {
        reading.push("ثقة القراءة منخفضة: العب جولات أكثر ليصبح التشخيص أدق.");
      }
    }

    return {
      name: me?.name ?? "اللاعب",
      answeredTotal,
      confidence,
      percentile,
      sampleMinds,
      strengths,
      weaknesses,
      focus,
      unmeasured,
      all: measured,
      reading,
      // وصفة التدريب: فئة + صعوبة عادلة + عدد أسئلة — كلها مشتقّة من أدائك الفعلي
      drills: weaknesses.map((w) => ({
        category: w.category,
        difficulty: fairDifficulty(w.accuracy),
        questionCount: 8,
        mastery: w.mastery,
        because: `دقتك هناك ${w.accuracy}٪ من ${w.total} إجابة`,
      })),
      minSample: TWIN_MIN_SAMPLE,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② الفعل — نحوّل نقطة الضعف إلى تحدٍّ حقيقي قابل للمشاركة
// ═══════════════════════════════════════════════════════════════════════

export const createTwinChallenge = mutation({
  args: { questionCount: v.optional(v.number()), ttlHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meId = await getAuthUserId(ctx);
    if (!meId) throw new Error("يجب تسجيل الدخول.");
    const me = await ctx.db.get(meId);

    // 🔒 الفئة تُحسب هنا في الخادم — لا تُقبل من الواجهة (منع التلاعب)
    const cats = await readCategories(ctx, meId as unknown as string);
    const measured = cats.filter((c) => c.measured);
    if (measured.length === 0) {
      throw new Error(`العب ${TWIN_MIN_SAMPLE} إجابات على الأقل في فئة واحدة ليقرأ التوأم عقلك.`);
    }
    const measuredSorted = [...measured].sort((a, b) => b.mastery - a.mastery);
    const pool = measuredSorted.length > 3 ? measuredSorted.slice(3) : measuredSorted;
    const focus = [...pool].sort((a, b) => a.mastery - b.mastery)[0];

    const difficulty = fairDifficulty(focus.accuracy);
    const questionCount = Math.max(5, Math.min(20, Math.floor(args.questionCount ?? 10)));
    // صعوبة أعلى ⇒ مكافأة أعلى (تُضبط داخل challengeCore بحدود صارمة)
    const rewardXp = difficulty === "easy" ? 40 : difficulty === "medium" ? 80 : difficulty === "hard" ? 140 : 220;

    const res = await createChallengeRecord(ctx, {
      source: "twin",
      title: `توأم ${me?.name ?? "لاعب"}: نقطة ضعفه «${focus.category}»`,
      note: `اقرأ عقلي: أضعف فئة عندي «${focus.category}» (إتقان ${focus.mastery}٪). هل تتغلّب عليها؟`,
      difficulty,
      questionCount,
      rewardXp,
      rewardCoins: 0,
      ttlHours: Math.max(1, Math.min(720, Math.floor(args.ttlHours ?? 168))),
      category: focus.category,
      createdBy: meId,
      createdByName: me?.name ?? "لاعب",
    });

    return {
      code: res.code,
      title: `توأم ${me?.name ?? "لاعب"}: نقطة ضعفه «${focus.category}»`,
      category: focus.category,
      difficulty: res.spec.difficulty,
      questionCount: res.spec.questionCount,
      rewardXp: res.spec.rewardXp,
      mastery: focus.mastery,
      expiresAt: res.expiresAt,
      sharePath: `/arena?challenge=${res.code}`,
    };
  },
});
