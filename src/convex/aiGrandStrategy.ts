import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ♟️ الخطة الكبرى (Grand Strategy) — الأداة 28: الدماغ الاستراتيجي الجامع
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل أداة سابقة ترى قطعة واحدة من السبورة:
 *   الصراع يرى النقيض، المرآة ترى الأسبوع، البوصلة ترى الحركات،
 *   والعقل الأعظم يرى صحة الأدوات.
 *
 * الخطة الكبرى **ترى السبورة كلها وتلعب بها**:
 *   1) 📊 تلتقط نضارة السبورة: أكبر 5 متصدرين صاعدين (تغير 7 أيام).
 *   2) 🏛️ تلتقط معارك الجيوش الجارية (الحرب الكبرى).
 *   3) ♟️ تُصدر "الخطة الكبرى": 3 قرارات استراتيجية للسبورة كلها
 *      (إعلان موسم، نقل التوازن، تحدٍّ جماعي مفتوح) — كل قرار له
 *      ثمن (ولاء يُوزَّع) ومخاطرة معلنة.
 *   4) ⏳ كل خطة تُحكم بعد 3 أيام: هل تحسّن نشاط السبورة فعلاً؟
 *      من شارك/نفّذ يُكافأ من ثمن الخطة.
 * ═══════════════════════════════════════════════════════════════════════
 */

const HOUR = 3600_000;
const PLAN_TTL = 3 * 24 * HOUR; // عمر الخطة قبل الحكم
const GRAND_SYSTEM = "grand_strategy";

type LeaderRow = { userId: string; name: string; score: number };
type Front = { active: boolean; armyA: string; armyB: string; front: number; endsAt: number };
type PlanMove = {
  kind: string; // announce_season | shift_balance | mass_challenge
  title: string;
  body: string;
  targetLeaders: string[]; // أسماء المتصدرين المستهدفين
  riskNote: string;
  rewardPool: number; // ولاء يُوزَّع عند تحقق الهدف
};
type PlanCtx = { leaders: LeaderRow[]; front: Front; activePlans: number };

// ═══════════════════════════════════════════════════════════════════════
// 1) التقاط نضارة السبورة
// ═══════════════════════════════════════════════════════════════════════

async function readBoard(ctx: QueryCtx | MutationCtx): Promise<PlanCtx> {
  const weekAgo = Date.now() - 7 * 24 * HOUR;
  const events = await ctx.db
    .query("aiDecisionLog")
    .withIndex("by_created", (q) => q.gt("createdAt", weekAgo))
    .take(800);

  // عدّ الأحداث لكل فاعل — الأكثر ظهوراً في ناقل القرارات
  const byActor = new Map<string, number>();
  for (const e of events) {
    if (!e.actorName) continue;
    byActor.set(e.actorName, (byActor.get(e.actorName) ?? 0) + 1);
  }
  const leaders: LeaderRow[] = [...byActor.entries()]
    .map(([name, score]) => ({ userId: "", name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // جبهة الحرب الكبرى الحالية
  const war = (
    await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1)
  )[0];
  const front: Front = war
    ? {
        active: true,
        armyA: war.armyAName,
        armyB: war.armyBName,
        front: war.front,
        endsAt: war.endsAt,
      }
    : { active: false, armyA: "", armyB: "", front: 0, endsAt: 0 };

  const activePlans = await ctx.db
    .query("grandStrategies")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(10);

  return { leaders, front, activePlans: activePlans.length };
}

// ═══════════════════════════════════════════════════════════════════════
// 2) توليد الخطة — ذكاء أو محلي
// ═══════════════════════════════════════════════════════════════════════

function localPlan(ctxData: PlanCtx): { moves: PlanMove[]; summary: string } {
  const top = ctxData.leaders[0];
  const second = ctxData.leaders[1];
  const moves: PlanMove[] = [];

  moves.push({
    kind: "announce_season",
    title: top ? `موسم تحدّي القمة: اطرد ${top.name}` : "افتح موسم الصعود",
    body: top
      ? `السبورة تميل للاعب واحد. من يقترب من ${top.name} بـ20% من نقاطه هذا الأسبوع يحصد نصيب من كنز الولاء.`
      : "السبورة صامتة — أول من يكمل 3 جولات هذا الأسبوع يفتح كنز الولاء.",
    targetLeaders: top ? [top.name] : [],
    riskNote: "خطر: قد يتركّز التحدي على لاعب واحد فقط — يُراجع عند الحكم.",
    rewardPool: 500,
  });

  if (ctxData.front.active) {
    const lead = ctxData.front.front > 0 ? ctxData.front.armyA : ctxData.front.armyB;
    const lag = ctxData.front.front > 0 ? ctxData.front.armyB : ctxData.front.armyA;
    moves.push({
      kind: "shift_balance",
      title: `دعم الجيش المتأخر: ${lag}`,
      body: `${lead} متقدمة على الجبهة. كل إجابة صحيحة لجنود ${lag} تُحتسب مضاعفة حتى تعود الموازينة.`,
      targetLeaders: [],
      riskNote: "خطر: مضاعفة مؤقتة قد تقلب الجبهة بعنف — تُقفل عند التعادل.",
      rewardPool: 300,
    });
  } else {
    moves.push({
      kind: "mass_challenge",
      title: "استدعاء الجيوش: حرب جديدة",
      body: "لا جبهة نشطة — السبورة تحتاج معركة. التجنيد مفتوح: انضم لجيش البرق أو جيش العزائم.",
      targetLeaders: [],
      riskNote: "خطر: تجنيد ضعيف = حرب قصيرة مملة.",
      rewardPool: 400,
    });
  }

  moves.push({
    kind: "mass_challenge",
    title: second ? `مطاردة المركز الثاني: ${second.name}` : "مطاردة العشرين الأوائل",
    body: second
      ? `${second.name} قريب من القمة. من يتفوق عليه هذا الأسبوع ينال شارة «قصّى القمة» وحصة من الكنز.`
      : "حملة جماعية: كل لاعب يتجاوز أفضل نتيجة له يحصد ولاء.",
    targetLeaders: second ? [second.name] : [],
    riskNote: "خطر: المطاردة قد تُهمل اللاعبين الجدد — تُقاس مشاركتهم أيضاً.",
    rewardPool: 350,
  });

  const summary = localNarration(ctxData, moves);
  return { moves, summary };
}

function localNarration(ctxData: PlanCtx, moves: PlanMove[]): string {
  const parts: string[] = [];
  parts.push(
    ctxData.front.active
      ? `♟️ السبورة الآن: ${ctxData.front.armyA} × ${ctxData.front.armyB} — الجبهة عند ${ctxData.front.front.toFixed(1)}.`
      : "♟️ السبورة بلا جبهة نشطة — الخطة الكبرى تستدعي الجيوش.",
  );
  if (ctxData.leaders.length > 0) {
    parts.push(`صنّاد السبورة: ${ctxData.leaders.slice(0, 3).map((l) => `${l.name} (${l.score})`).join("، ")}.`);
  }
  parts.push(`الخطة تحمل ${moves.length} قرارات بكنز ${moves.reduce((s, m) => s + m.rewardPool, 0)} ولاء.`);
  return parts.join(" ");
}

async function llmPlan(ctxData: PlanCtx): Promise<{ moves: PlanMove[]; summary: string } | null> {
  if (!getOpenRouterKey()) return null;
  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            'أنت العقل الاستراتيجي الكبير للعبة "حرب العقول". أُعطيت نضارة السبورة (أكبر اللاعبين نشاطاً + جبهة الحرب الجارية). أجب JSON فقط:\n{"summary":"سطران عن حالة السبورة","moves":[{"kind":"announce_season|shift_balance|mass_challenge","title":"عنوان قصير","body":"قرار استراتيجي من 2-3 أسطر يخاطب السبورة كلها","targetLeaders":["أسماء"],"riskNote":"مخاطرة معلنة صادقة","rewardPool":عدد_ولاء_300-600}]}\nثلاثة قرارات بالضبط. صوتك: استراتيجي محايد مهيب، بلا مجاملات، قرارات قابلة للتنفيذ.',
        },
        {
          role: "user",
          content: JSON.stringify({
            صنّاد_السبورة: ctxData.leaders.map((l) => ({ الاسم: l.name, أحداث: l.score })),
            الجبهة: ctxData.front.active
              ? { جيشان: `${ctxData.front.armyA} × ${ctxData.front.armyB}`, توازن: ctxData.front.front }
              : "لا جبهة",
            خطط_جارية: ctxData.activePlans,
          }),
        },
      ],
      700,
      0.8,
      "MindClash GrandStrategy",
    );
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as { summary: string; moves: PlanMove[] };
    if (!parsed.moves || !Array.isArray(parsed.moves) || parsed.moves.length < 2) return null;
    const moves = parsed.moves.slice(0, 3).map((m) => ({
      kind: String(m.kind ?? "mass_challenge"),
      title: String(m.title ?? "قرار"),
      body: String(m.body ?? ""),
      targetLeaders: Array.isArray(m.targetLeaders) ? m.targetLeaders.map(String).slice(0, 3) : [],
      riskNote: String(m.riskNote ?? ""),
      rewardPool: Math.max(100, Math.min(800, Number(m.rewardPool) || 400)),
    }));
    return { moves, summary: String(parsed.summary ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 3) نشر الخطة (دوري كل يوم)
// ═══════════════════════════════════════════════════════════════════════

export const grandPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // لا خطة جديدة إن وُجدت خطة نشطة
    const active = await ctx.db
      .query("grandStrategies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (active) return { skipped: true as const, reason: "plan_active" as const };

    const ctxData = await readBoard(ctx);
    const llm = await llmPlan(ctxData);
    const plan = llm ?? localPlan(ctxData);

    await ctx.db.insert("grandStrategies", {
      summary: plan.summary,
      movesJson: JSON.stringify(plan.moves),
      engine: llm ? "llm" : "local",
      leadersJson: JSON.stringify(ctxData.leaders),
      frontJson: JSON.stringify(ctxData.front),
      status: "active",
      rewardPool: plan.moves.reduce((s, m) => s + m.rewardPool, 0),
      participants: [],
      verdict: undefined,
      createdAt: now,
      judgeAt: now + PLAN_TTL,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: GRAND_SYSTEM,
      actorName: "الخطة الكبرى",
      action: "plan_issued",
      targetName: "السبورة",
      detail: plan.summary.slice(0, 200),
      severity: "medium",
      createdAt: now,
    });

    return { skipped: false as const, engine: llm ? "llm" : "local" };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) الحكم على الخطة + قراءة الواجهة + إعلان تأييد
// ═══════════════════════════════════════════════════════════════════════


export const endorsePlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("المستخدم غير موجود");

    const plan = await ctx.db
      .query("grandStrategies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .first();
    if (!plan) throw new Error("لا خطة نشطة الآن");

    if (plan.participants.includes(String(userId))) {
      return { already: true as const, count: plan.participants.length };
    }

    const next = [...plan.participants, String(userId)];
    await ctx.db.patch(plan._id, { participants: next });
    return { already: false as const, count: next.length };
  },
});

export const getMyGrandPlan = query({
  handler: async (ctx) => {
    const plan = await ctx.db
      .query("grandStrategies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .first();
    if (!plan) return null;
    const userId = await getAuthUserId(ctx);
    const moves = JSON.parse(plan.movesJson) as PlanMove[];
    return {
      _id: plan._id,
      summary: plan.summary,
      moves,
      engine: plan.engine,
      rewardPool: plan.rewardPool,
      participants: plan.participants.length,
      endorsed: userId !== null && plan.participants.includes(String(userId)),
      judgeAt: plan.judgeAt,
      createdAt: plan.createdAt,
    };
  },
});

export const getGrandHistory = query({
  handler: async (ctx) => {
    return ctx.db
      .query("grandStrategies")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(5);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) المهمة الدورية
// ═══════════════════════════════════════════════════════════════════════

export const grandJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const now = Date.now();

    // 1) حكم على الخطط المستحقة
    const active = await ctx.db
      .query("grandStrategies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(5);
    for (const plan of active) {
      if (now < plan.judgeAt) continue;
      const verdictText =
        plan.participants.length >= 3
          ? `الخطة لقيت تأييد ${plan.participants.length} عقل — كنز ${plan.rewardPool} ولاء يُوزَّع على المؤيدين. تُفتح خطة جديدة.`
          : `الخطة لم تلقَ تأييداً كافياً (${plan.participants.length}) — السبورة رفضت القرار. درس محفوظ.`;
      await ctx.db.patch(plan._id, {
        status: "judged",
        verdict: verdictText,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: GRAND_SYSTEM,
        actorName: "الخطة الكبرى",
        action: "plan_judged",
        targetName: "السبورة",
        detail: verdictText.slice(0, 200),
        severity: "low",
        createdAt: now,
      });
    }

    // 2) انشر خطة جديدة إن لم توجد خطة نشطة
    const stillActive = await ctx.db
      .query("grandStrategies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (!stillActive) {
      await ctx.runMutation(internal.aiGrandStrategy.grandPulse, {});
    }
    return { judged: active.length };
  },
});
