import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * 🔍 مرصد العادات (Habit Observatory)
 *
 * الأداة التي تقرأ ما لا يعرفه اللاعب عن نفسه.
 *
 * كل عقل يكرر أنماطاً خفية لا يشعر بها: يتهور في أول 3 ثوانٍ، ينهار عند
 * السؤال السادس، يتعناد على فئة فاشلة، يعزب عن الفئات الصعبة، أو يشتعل
 * حماساً في نهايات الجولات فقط. هذه الأنماط تُقاس فعلياً من إجاباتك —
 * ثم يولّد المرصد **تحدي كسر عادة** مخصصاً: عادة واحدة، هدف واحد، وحكم
 * أسبوعي من أدائك الفعلي. من يكسر عادته يتطور عقلُه فعلاً.
 *
 *  1) 🔬 التشخيص: 5 أنماط بمؤشرات كمية (0-100) من بصمة الإجابات الحقيقية
 *  2) 🎯 تحدي الكسر: عادة مختارة تلقائياً (الأعلى مؤشراً) + هدف قابل للقياس
 *  3) ⚖️ متابعة أسبوعية: هل تحسّن المؤشر فعلاً؟ الوفاء يمنح ولاء، والانتكاس يُسجّل
 *  4) 📓 مذكرة المرصد: سجل تطور عاداتك عبر الأسابيع — قصة عقلك مكتوبة
 */

const DAY = 24 * 3600_000;

// ── 1) التشخيص: قراءة الأنماط من الإجابات ───────────────────────────────

type HabitProfile = {
  userId: string;
  name: string;
  sample: number;
  // المؤشرات 0-100 (كلما زاد، زادت المشكلة)
  hasteIndex: number; // التسرع: نسبة إجابات < 3 ثوانٍ الخاطئة
  collapseIndex: number; // الانهيار: تراجع الدقة في آخر ثلث الجولات
  stubbornnessIndex: number; // العناد: تكرار فئة ضعيفة رغم الفشل
  avoidanceIndex: number; // الوحشة: تجنب فئات لم تُجرّب أبداً
  lateIgnitionIndex: number; // الحماس المتأخر: دقة النهايات تتفوق على البدايات بكثير
  weakestCategory: string | null;
  strengths: string[];
};

export const diagnoseInternal = internalQuery({
  handler: async (ctx): Promise<HabitProfile[]> => {
    const rows = await ctx.db.query("gamePlayers").take(4000);
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));

    type Acc = {
      name: string;
      haste: { fastWrong: number; fastTotal: number };
      first: { c: number; t: number };
      last: { c: number; t: number };
      catTries: Record<string, { c: number; t: number }>;
      total: { c: number; t: number };
      perGameCat: Map<string, Set<string>>; // gameId → فئات اللعب فيها
    };
    const byUser = new Map<string, Acc>();

    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      if (answers.length < 6) continue;
      let acc = byUser.get(String(row.userId));
      if (!acc) {
        acc = {
          name: row.name ?? "لاعب",
          haste: { fastWrong: 0, fastTotal: 0 },
          first: { c: 0, t: 0 },
          last: { c: 0, t: 0 },
          catTries: {},
          total: { c: 0, t: 0 },
          perGameCat: new Map(),
        };
        byUser.set(String(row.userId), acc);
      }
      const third = Math.ceil(answers.length / 3);
      answers.forEach((a, i) => {
        const q = bankMap.get(a.questionId);
        if (!q) return;
        acc.total.t += 1;
        if (a.correct) acc.total.c += 1;
        // التسرع
        if (a.elapsedMs > 0 && a.elapsedMs < 3000) {
          acc.haste.fastTotal += 1;
          if (!a.correct) acc.haste.fastWrong += 1;
        }
        // البداية والنهاية
        if (i < third) {
          acc.first.t += 1;
          if (a.correct) acc.first.c += 1;
        } else if (i >= answers.length - third) {
          acc.last.t += 1;
          if (a.correct) acc.last.c += 1;
        }
        // الفئات
        const cat = acc.catTries[q.category] ?? { c: 0, t: 0 };
        cat.t += 1;
        if (a.correct) cat.c += 1;
        acc.catTries[q.category] = cat;
        acc.perGameCat.set(row.gameId, (acc.perGameCat.get(row.gameId) ?? new Set()).add(q.category));
      });
    }

    const allCats = new Set(QUESTION_BANK.map((q) => q.category));
    const out: HabitProfile[] = [];
    for (const [uid, acc] of byUser) {
      if (acc.total.t < 20) continue;
      const hasteIndex = acc.haste.fastTotal > 0 ? Math.round((acc.haste.fastWrong / acc.haste.fastTotal) * 100) : 0;
      const firstAcc = acc.first.t > 0 ? acc.first.c / acc.first.t : 0.5;
      const lastAcc = acc.last.t > 0 ? acc.last.c / acc.last.t : 0.5;
      const collapseIndex = Math.max(0, Math.round((firstAcc - lastAcc) * 100));
      const lateIgnitionIndex = Math.max(0, Math.round((lastAcc - firstAcc) * 100));

      const cats = Object.entries(acc.catTries);
      const weakest = [...cats].sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)[0];
      const stubbornnessIndex =
        weakest && weakest[1].t >= 8
          ? Math.round((weakest[1].t / acc.total.t) * 100 * (1 - weakest[1].c / weakest[1].t))
          : 0;
      const avoidanceIndex = Math.max(0, Math.round((1 - cats.length / Math.max(1, allCats.size)) * 100));
      const strengths = [...cats].sort((a, b) => b[1].c / b[1].t - a[1].c / a[1].t).slice(0, 2).map(([c]) => c);

      out.push({
        userId: uid,
        name: acc.name,
        sample: acc.total.t,
        hasteIndex,
        collapseIndex,
        stubbornnessIndex,
        avoidanceIndex,
        lateIgnitionIndex,
        weakestCategory: weakest?.[0] ?? null,
        strengths,
      });
    }
    return out;
  },
});

// ── 2) تحدي كسر العادة ───────────────────────────────────────────────────

const CHALLENGES: Record<string, { title: string; goal: string; targetKind: string }> = {
  haste: { title: "تحدي النَّفَس العميق", goal: "قلل إجاباتك الأسرع من 3 ثوانٍ الخاطئة — فكّر ثانيتين إضافيتين في كل سؤال صعب", targetKind: "haste" },
  collapse: { title: "تحدي الصمود", goal: "حافظ على تركيزك حتى آخر سؤال — لا تخسر جولة بدأتها قوياً", targetKind: "collapse" },
  stubbornness: { title: "تحدي الانفتاح", goal: "وازن تدريبك: فئة ضعيفة واحدة تكفي — توزّع جولاتك على فئات أوسع", targetKind: "stubbornness" },
  avoidance: { title: "تحدي الاستكشاف", goal: "جرّب فئتين جديدتين لم تلعبهما أبداً — عقلك أوسع من عاداتك", targetKind: "avoidance" },
  lateIgnition: { title: "تحدي البداية الحاسمة", goal: "اشتعل من السؤال الأول — لا تنتظر النهايات لتُظهر ذكاءك", targetKind: "lateIgnition" },
};

export const getMyHabits = query({
  handler: async (ctx): Promise<HabitProfile | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profiles = (await ctx.runQuery(internal.aiHabit.diagnoseInternal, {})) as HabitProfile[];
    return profiles.find((p) => p.userId === String(userId)) ?? null;
  },
});

export const startBreakChallenge = mutation({
  args: { habit: v.string() },
  handler: async (ctx, { habit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    const def = CHALLENGES[habit];
    if (!def) throw new Error("عادة غير معروفة");

    // تحدٍّ نشط لنفس العادة؟
    const existing = await ctx.db
      .query("habitChallenges")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .take(5);
    if (existing.some((c) => c.habit === habit)) throw new Error("التحدي نشط بالفعل");

    const profiles = (await ctx.runQuery(internal.aiHabit.diagnoseInternal, {})) as HabitProfile[];
    const mine = profiles.find((p) => p.userId === String(userId));
    const beforeIndex =
      habit === "haste" ? mine?.hasteIndex
      : habit === "collapse" ? mine?.collapseIndex
      : habit === "stubbornness" ? mine?.stubbornnessIndex
      : habit === "avoidance" ? mine?.avoidanceIndex
      : mine?.lateIgnitionIndex ?? 50;

    const now = Date.now();
    await ctx.db.insert("habitChallenges", {
      userId,
      userName: me.name ?? "لاعب",
      habit,
      title: def.title,
      goal: def.goal,
      beforeIndex: beforeIndex ?? 50,
      status: "active",
      startedAt: now,
      judgeAt: now + 7 * DAY,
    });
    return { started: true as const, title: def.title };
  },
});

// ── 3) متابعة أسبوعية: هل تحسّن المؤشر فعلاً؟ ───────────────────────────

export const judgeHabits = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("habitChallenges")
      .withIndex("by_status_judge", (q) => q.eq("status", "active"))
      .take(30);
    const payable = due.filter((c) => c.judgeAt <= now);
    if (payable.length === 0) return { judged: 0 };

    const profiles = (await ctx.runQuery(internal.aiHabit.diagnoseInternal, {})) as HabitProfile[];
    let judged = 0;
    for (const c of payable) {
      const mine = profiles.find((p) => p.userId === String(c.userId));
      const afterIndex =
        c.habit === "haste" ? mine?.hasteIndex
        : c.habit === "collapse" ? mine?.collapseIndex
        : c.habit === "stubbornness" ? mine?.stubbornnessIndex
        : c.habit === "avoidance" ? mine?.avoidanceIndex
        : mine?.lateIgnitionIndex ?? 50;
      const improved = (afterIndex ?? 50) < (c.beforeIndex ?? 50) - 5; // تحسّن حقيقي 5+ نقاط
      const reward = 45;

      if (improved) {
        const wr = await ctx.db
          .query("loyaltyWallets")
          .withIndex("by_user", (q) => q.eq("userId", c.userId))
          .take(1);
        if (wr[0]) await ctx.db.patch(wr[0]._id, { points: wr[0].points + reward, updatedAt: now });
      }
      await ctx.db.patch(c._id, {
        status: improved ? "broken" : "relapsed",
        afterIndex: afterIndex ?? undefined,
        reward: improved ? reward : 0,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "habit",
        actorName: "مرصد العادات",
        action: improved ? "habit_broken" : "habit_relapsed",
        targetId: String(c.userId),
        targetName: c.userName,
        detail: `${c.title}: ${c.beforeIndex} → ${afterIndex ?? "?"} ${improved ? `— دُفع ${reward} ولاء` : "— انتكاس موثق"}`,
        severity: "low",
        createdAt: now,
      });
      judged += 1;
    }
    return { judged };
  },
});

// ── 4) مذكرة المرصد ─────────────────────────────────────────────────────

export const getMyChallenges = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("habitChallenges")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(15);
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },
});

// ملاحظة المرصد المولدة (اختيارية بالذكاء) — تُستدعى من الواجهة عبر action
export const getObserverNote = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const profiles = (await ctx.runQuery(internal.aiHabit.diagnoseInternal, {})) as HabitProfile[];
    return profiles.find((p) => p.userId === String(userId)) ?? null;
  },
});

export const habitJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return ctx.runMutation(internal.aiHabit.judgeHabits, {}) as unknown;
  },
});

export const callLlmUnused = callLlm; // يُستخدم في تحسينات لاحقة للنصوص
export const getOpenRouterKeyUnused = getOpenRouterKey;
