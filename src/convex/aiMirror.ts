import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🪞 المرآة الحربية (War Mirror) — الأداة 20 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * السلسلة اكتملت: «بازار العقول» اكتشف نقيضك، و«صراع النقيض» جعلك
 * تحاربه — وهذه الأداة **تدرّبك على الحرب** وتتنبأ بنتيجتها:
 *
 *   1) 🎲 محاكاة Monte Carlo حقيقية: آلاف الأدوار الوهمية بين بصمتك
 *      وبصمة نقيضك (دقة كل فئة، الفئات المجهولة تُعايَرة 35%) —
 *      فتخرج باحتمال نصر رقمي، لا شعور.
 *   2) 🪞 انعكاس النقيض: يكشف أين سيذوب تفوقك (أقوى فئاته مقابل أضعف
 *      فئاتك)، وأين ستنقضّ أنت (أضعف فئاته = نقاط الاختراق).
 *   3) 📜 خطة الحرب: نشر أسبوعي بأوامر تكتيكية محسوبة من فجوات
 *      المحاكاة (زرع الفجوة، قنص الاختراق، كرامة التمكّن) — تُشتق
 *      **من الخادم بالكامل** فلا يمكن تزييفها من الواجهة.
 *   4) ⚖️ الحكم الصادق: بعد أسبوع تُعاد قراءة بصمتك الحقيقية وتُقارن
 *      ببصمة بدء الخطة — تحسّن 5 نقاط+ في أغلب فئات الفجوة = نصر
 *      ومكافأة 45 ولاء؛ وإلا فخسارة موثقة بلا رحمة.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;
const JUDGE_REWARD = 45;
const UNKNOWN_CAT_ACC = 0.35; // تعيير الفئات التي لم يجرّبها طرف
const SIM_ITERS = 300;
const SIM_QUESTIONS = 12;
const IMPROVE_THRESHOLD = 0.05; // تحسّن 5 نقاط مئوية في الفئة
const MIN_SAMPLE = 8; // نفس عتبة بصمة بازار العقول

type FingerprintLite = {
  userId: Id<"users">;
  name: string;
  accByCat: Record<string, number>;
  overall: number;
  sample: number;
};

type MirrorSim = {
  winProbability: number;
  myWinRate: number;
  foeWinRate: number;
  draws: number;
  projectedScore: number;
  foeProjectedScore: number;
  gapCategories: string[];
  breakTargets: string[];
  shockLevers: string[];
  nemesisStrengthCat: string;
  twinName: string;
  twinAffinity: number;
};

type MirrorResult =
  | { hasNemesis: false; reason: string }
  | { hasNemesis: true; nemesisId: string; nemesisName: string; contrast: number; sim: MirrorSim };

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** مفتاح الأسبوع الزمني (ISO) — فترة الخطة الحربية */
export function weekKeyOf(now: number): string {
  const d = new Date(now);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc + (4 - day) * DAY);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════
// 1) المحاكاة — قلب المرآة
// ═══════════════════════════════════════════════════════════════════════

export const simulateForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<MirrorResult> => {
    const fps = (await ctx.runQuery(internal.aiMentor.collectFingerprints, {})) as unknown as FingerprintLite[];
    const mine = fps.find((f) => String(f.userId) === String(userId));
    if (!mine) return { hasNemesis: false, reason: "بصمتك غير مكتملة — تحتاج 8+ إجابات حقيقية." };

    const row = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const mate = row[0];
    if (!mate) return { hasNemesis: false, reason: "لا نقيض معلن بعد — افتح بازار العقول لبناء شبكتك." };

    const foe = fps.find((f) => String(f.userId) === String(mate.nemesisId));
    if (!foe) return { hasNemesis: false, reason: "بصمة نقيضك ضاعت (قلة لعب) — العب قليلاً وسيُعاد اكتشافه." };

    // ── بناء ساحة الفئات المشتركة والمجهولة ──
    const cats = new Set<string>([...Object.keys(mine.accByCat), ...Object.keys(foe.accByCat)]);
    const unknownCount = [...cats].filter((c) => mine.accByCat[c] === undefined || foe.accByCat[c] === undefined).length;

    const accOf = (f: FingerprintLite, c: string) => f.accByCat[c] ?? UNKNOWN_CAT_ACC;

    // ── Monte Carlo: أدوار وهمية بـ12 سؤالاً من مزيج الفئات ──
    const catList = [...cats];
    let meWins = 0;
    let foeWins = 0;
    let draws = 0;
    const seed = hashStr(`${String(userId)}:${String(mate.nemesisId)}`);
    let rngState = seed || 1;
    const rand = () => {
      // LCG حتمي بسيط — محاكاة مستقرة خلال الجلسة
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };

    for (let it = 0; it < SIM_ITERS; it++) {
      let meScore = 0;
      let foeScore = 0;
      for (let q = 0; q < SIM_QUESTIONS; q++) {
        const cat = catList[Math.floor(rand() * catList.length)];
        const pMe = accOf(mine, cat);
        const pFoe = accOf(foe, cat);
        if (rand() < pMe) meScore += 1;
        if (rand() < pFoe) foeScore += 1;
      }
      const diff = meScore - foeScore;
      if (Math.abs(diff) <= 1) draws += 1; // تعادل عملي (فارق سؤال واحد)
      else if (diff > 0) meWins += 1;
      else foeWins += 1;
    }

    const total = SIM_ITERS;
    const myWinRate = Math.round((meWins / total) * 100);
    const foeWinRate = Math.round((foeWins / total) * 100);
    const drawRate = Math.round((draws / total) * 100);
    const winProbability = Math.min(100, myWinRate + Math.round(drawRate * 0.4)); // التعادل يميل لحظة الحسم لصاحب الأرض

    // ── فجوات المحاكاة ──
    const gaps = [...cats]
      .map((c) => ({ cat: c, gap: accOf(foe, c) - accOf(mine, c) }))
      .sort((a, b) => b.gap - a.gap);
    const gapCategories = gaps.filter((g) => g.gap >= 0.1).slice(0, 2).map((g) => g.cat);
    if (gapCategories.length === 0) {
      // لا فجوة صريحة: درّب على أضعف فئاتك عموماً
      gapCategories.push(...[...cats].sort((a, b) => accOf(mine, a) - accOf(mine, b)).slice(0, 2));
    }
    const breakTargets = [...cats]
      .map((c) => ({ cat: c, gap: accOf(mine, c) - accOf(foe, c) }))
      .sort((a, b) => b.gap - a.gap)
      .filter((g) => g.gap >= 0.1)
      .slice(0, 1)
      .map((g) => g.cat);

    const nemesisStrengthCat = [...cats].sort((a, b) => accOf(foe, b) - accOf(foe, a))[0] ?? "عام";
    const myAvg = meWins / total;
    const foeAvg = foeWins / total;
    const projectedScore = Math.round((0.4 + 0.6 * myAvg) * SIM_QUESTIONS);
    const foeProjectedScore = Math.round((0.4 + 0.6 * foeAvg) * SIM_QUESTIONS);

    const shockLevers = [
      unknownCount > 0
        ? `عندك ${unknownCount} فئة مجهولة عن نقيضك — كل فئة مجهولة هي ساحة يفوز فيها بالمعايرة (${Math.round(UNKNOWN_CAT_ACC * 100)}%).`
        : `لا فئات مجهولة — الحسم سيكون في الفجوة الحادة مع «${mate.nemesisName}».`,
      gapCategories.length > 0
        ? `فجوتك الأخطر: «${gapCategories[0]}» — نقيضك يتفوق فيها بـ${Math.round((gaps[0]?.gap ?? 0) * 100)} نقطة.`
        : `لا توجد فئة يتفوقك فيها بوضوح — نصرتك مرشحة لكن الرضا قاتل.`,
      breakTargets.length > 0
        ? `سلاحك السري: «${breakTargets[0]}» — تتقدم فيه على نقيضك بفارق يكفي لقلب جولة كاملة.`
        : `لا سلاح كاسح — اعتمد على الثبات: خطئه المتكرر أقوى حلفائك.`,
    ];

    return {
      hasNemesis: true,
      nemesisId: String(mate.nemesisId),
      nemesisName: mate.nemesisName,
      contrast: mate.nemesisContrast,
      sim: {
        winProbability,
        myWinRate,
        foeWinRate,
        draws: drawRate,
        projectedScore,
        foeProjectedScore,
        gapCategories,
        breakTargets,
        shockLevers,
        nemesisStrengthCat,
        twinName: mate.twinName,
        twinAffinity: mate.twinAffinity,
      },
    };
  },
});

/** نسخة واجهة: محاكاة للمستخدم الحالي */
export const getMyMirror = query({
  handler: async (ctx): Promise<MirrorResult | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return (await ctx.runQuery(internal.aiMirror.simulateForUser, { userId })) as MirrorResult;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) نشر خطة الحرب — كل الأوامر تُشتق من الخادم (صفر ثقة بالواجهة)
// ═══════════════════════════════════════════════════════════════════════

type WarOrder = { num: number; title: string; body: string; category: string };

function buildOrders(sim: MirrorSim): WarOrder[] {
  const gapCat = sim.gapCategories[0] ?? "عام";
  const gapCat2 = sim.gapCategories[1] ?? gapCat;
  const breakCat = sim.breakTargets[0] ?? gapCat2;
  const orders: WarOrder[] = [
    {
      num: 1,
      title: "زرع الفجوة",
      body: `لخص 10 أسئلة من فئة «${gapCat}» — هي الأرض التي يفوز فيها نقيضك عليك. الهدف: رفع دقتك فيها 5 نقاط+ قبل الحكم.`,
      category: gapCat,
    },
    {
      num: 2,
      title: "قنص الاختراق",
      body: breakCat !== gapCat
        ? `في «${breakCat}» أنت المتفوق — لا تكتفِ بالفوز فيها: اقصد دقة 90%+ حتى تتحول من نقطة قوة إلى سلاح حسم.`
        : `ثبّت تفوقك العام: أعِد لعب أسئلة أقوى فئات نقيضك (${sim.nemesisStrengthCat}) لتختصر مصدر قوته.`,
      category: breakCat,
    },
    {
      num: 3,
      title: "كرامة التمكّن",
      body: `احمِ معدلك العام: بلا جولات متسرعة (<3 ثوانٍ) هذا الأسبوع — احتمال نحرك ${sim.winProbability}% يُبنى على بصمتك كما هي اليوم، وكل تسرّع يهدمها.`,
      category: "عام",
    },
  ];
  return orders;
}

export const deployPlan = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const mirror = (await ctx.runQuery(internal.aiMirror.simulateForUser, { userId })) as MirrorResult;
    if (!mirror.hasNemesis) throw new Error(mirror.reason);

    // خطة نشطة؟ لا نشر مزدوج
    const active = await ctx.db
      .query("warPlans")
      .withIndex("by_user_period", (q) => q.eq("userId", userId).eq("periodKey", weekKeyOf(Date.now())))
      .take(5);
    if (active.some((p) => p.status === "active")) throw new Error("خطة هذا الأسبوع نشطة بالفعل — انتظر الحكم الأسبوعي.");

    const fps = (await ctx.runQuery(internal.aiMentor.collectFingerprints, {})) as unknown as FingerprintLite[];
    const mine = fps.find((f) => String(f.userId) === String(userId));
    if (!mine) throw new Error("بصمتك غير مكتملة للنشر — العب 8+ إجابات.");
    if (mine.sample < MIN_SAMPLE) throw new Error(`بصمتك رقيقة (${mine.sample} إجابة) — تحتاج ${MIN_SAMPLE}+ للنشر الموثوق.`);

    const now = Date.now();
    const orders = buildOrders(mirror.sim);
    await ctx.db.insert("warPlans", {
      userId,
      userName: me.name ?? "لاعب",
      periodKey: weekKeyOf(now),
      nemesisId: mirror.nemesisId as Id<"users">,
      nemesisName: mirror.nemesisName,
      twinId: userId, // يُحدَّث لاحقاً من الشبكة عند الحكم إن لزم
      twinAffinity: mirror.sim.twinAffinity,
      winProbability: mirror.sim.winProbability,
      projectedScore: mirror.sim.projectedScore,
      foeProjectedScore: mirror.sim.foeProjectedScore,
      gapCategories: mirror.sim.gapCategories,
      breakTargets: mirror.sim.breakTargets,
      accByCatBefore: JSON.stringify(mine.accByCat),
      orders: JSON.stringify(orders),
      status: "active" as const,
      createdAt: now,
      judgeAt: now + WEEK,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "war_mirror",
      actorName: "المرآة الحربية",
      action: "plan_deployed",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `خطة أسبوعية ضد «${mirror.nemesisName}» — احتمال نصر ${mirror.sim.winProbability}% وفجوة في «${mirror.sim.gapCategories.join("، ")}»`,
      severity: "low",
      createdAt: now,
    });
    return { ok: true as const, orders, winProbability: mirror.sim.winProbability };
  },
});

export const getMyPlan = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("warPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(8);
    return rows.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) الحكم الأسبوعي الصادق
// ═══════════════════════════════════════════════════════════════════════

export const judgePlans = internalMutation({
  handler: async (ctx): Promise<{ judged: number }> => {
    const now = Date.now();
    const active = await ctx.db
      .query("warPlans")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(40);
    const due = active.filter((p) => p.judgeAt <= now);
    if (due.length === 0) return { judged: 0 };

    const fps = (await ctx.runQuery(internal.aiMentor.collectFingerprints, {})) as unknown as FingerprintLite[];
    const byId = new Map(fps.map((f) => [String(f.userId), f]));

    let judged = 0;
    for (const plan of due) {
      const nowF = byId.get(String(plan.userId));
      const beforeAcc = JSON.parse(plan.accByCatBefore) as Record<string, number>;

      const improved: string[] = [];
      const details: string[] = [];
      for (const cat of plan.gapCategories) {
        const before = beforeAcc[cat] ?? UNKNOWN_CAT_ACC;
        const after = nowF?.accByCat[cat];
        if (after === undefined) {
          details.push(`«${cat}»: لم تُختبر بعد (قبل: ${Math.round(before * 100)}%)`);
          continue;
        }
        const delta = Math.round((after - before) * 100);
        if (after >= before + IMPROVE_THRESHOLD) improved.push(cat);
        details.push(`«${cat}»: ${Math.round(before * 100)}% → ${Math.round(after * 100)}% (${delta >= 0 ? "+" : ""}${delta})`);
      }

      const required = Math.max(1, Math.ceil(plan.gapCategories.length / 2));
      const won = improved.length >= required && nowF !== undefined;

      if (won) {
        const wr = await ctx.db
          .query("loyaltyWallets")
          .withIndex("by_user", (q) => q.eq("userId", plan.userId))
          .take(1);
        if (wr[0]) {
          await ctx.db.patch(wr[0]._id, { points: wr[0].points + JUDGE_REWARD, updatedAt: now });
        } else {
          await ctx.db.insert("loyaltyWallets", {
            userId: plan.userId,
            points: JUDGE_REWARD,
            lifetimeEarned: JUDGE_REWARD,
            perks: [],
            updatedAt: now,
          });
        }
        await ctx.db.insert("loyaltyLedger", {
          userId: plan.userId,
          delta: JUDGE_REWARD,
          reason: `نصر خطة الحرب: تحسّن في «${improved.join("، ")}»`,
          at: now,
        });
      }

      await ctx.db.patch(plan._id, {
        status: won ? "won" : "lost",
        improvedCats: improved,
        reward: won ? JUDGE_REWARD : 0,
        verdict: details.join(" · "),
        resolvedAt: now,
      });

      await ctx.db.insert("aiDecisionLog", {
        system: "war_mirror",
        actorName: "المرآة الحربية",
        action: won ? "plan_won" : "plan_lost",
        targetId: String(plan.userId),
        targetName: plan.userName,
        detail: `${won ? `دُفع ${JUDGE_REWARD} ولاء` : "خطة بلا تحسّن موثق"} — ضد «${plan.nemesisName}»: ${details.join(" · ")}`,
        severity: "low",
        createdAt: now,
      });
      judged += 1;
    }
    return { judged };
  },
});

export const mirrorJob = internalMutation({
  handler: async (ctx: MutationCtx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiMirror.judgePlans, {})) as unknown;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) خطاف ذكاء اختياري: مراجعة الخطة بلسان المستشار الحربي
// ═══════════════════════════════════════════════════════════════════════

export const warCounsel = mutation({
  args: { planId: v.id("warPlans") },
  handler: async (ctx, { planId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("الخطة غير موجودة");
    if (String(plan.userId) !== String(userId)) throw new Error("هذه الخطة ليست لك");
    try {
      await ensureAiRuntime(ctx);
      const { callLlm } = await import("./aiConfig");
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت مستشار حرب عقولية في لعبة أسئلة عربية. خاطب اللاعب بضمير المخاطب في 3 أسطر صارمة: أين ستُحسم معركته ضد نقيضه، وما الأمر الأهم في خطته، وما عقوبة التهاون. بلا مجاملات.",
          },
          {
            role: "user",
            content: JSON.stringify({
              اللاعب: plan.userName,
              النقيض: plan.nemesisName,
              احتمال_النصر: plan.winProbability,
              توقعي: plan.projectedScore,
              توقع_النقيض: plan.foeProjectedScore,
              فجوات_الخطة: plan.gapCategories,
              أهداف_الاختراق: plan.breakTargets,
              الأوامر: JSON.parse(plan.orders) as WarOrder[],
            }),
          },
        ],
        240,
        0.8,
        "MindClash War Mirror Counselor",
      );
      const clean = raw.trim().slice(0, 460);
      if (clean.length > 30) return { ok: true as const, counsel: clean };
      return { ok: false as const, note: "لم يُنتج المستشار نصاً كافياً" };
    } catch (e) {
      return { ok: false as const, note: e instanceof Error ? e.message : "فشل المستشار — المحاكاة الرقمية تبقى مصدر الحقيقة" };
    }
  },
});
