import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";

/**
 * 👤 صدى الذات (Self Echo)
 *
 * الأجرأ نفسياً: أقوى منافس يمكن لأي لاعب أن يواجهه هو **عقله القديم**.
 *
 * نبني من إجابات اللاعب الحقيقية «بصمة عقل» — نموذج إحصائي لطريقة إجابته:
 *  - سرعته المتوسطة لكل درجة صعوبة (يجيب الصعب أبطأ؟ أم يتهور؟)
 *  - دقته الفعلية لكل فئة (يتلعثم في «جغرافيا» لكنه صاروخ «تاريخ»)
 *  - أنماط أخطائه: يخطئ في النهايات عند السلاسل الطويلة؟ يتحمس في البدايات؟
 *
 * ثم نبني منها **مُحاكاة معكوسة**: نسخة من نفسه تعيد إجابات الإحصاء نفسه
 * على نفس الأسئلة — واللاعب اليوم يجب أن **يتجاوز ذاته الأمس** كي يفوز.
 *
 * هذه المواجهة فريدة: لا خصم بشري، لا روبية عامة — إنها مرآة عقلية
 * تنمو كلما نما اللاعب، فتنافسه دائماً على حافة قدراته الحقيقية.
 */

const QUESTIONS_PER_MATCH = 7;
const DAY = 24 * 3600_000;

// ── 1) بناء البصمة: قراءة عقل اللاعب من إجاباته ─────────────────────────

type MindProfile = {
  speedByDifficulty: Record<string, number>; // متوسط سرعة الإجابة بالمللي ثانية
  accuracyByCategory: Record<string, number>; // 0..1
  overallAccuracy: number;
  firstHalfAccuracy: number; // أداؤه في أول نصف الأسئلة
  secondHalfAccuracy: number; // في النصف الثاني (يكتشف التعب أو الاحتدام)
  sampleSize: number;
};

export const buildProfileInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<MindProfile> => {
    const now = Date.now();
    const rows = await ctx.db
      .query("gamePlayers")
      .withIndex("by_user_game", (q) => q.eq("userId", userId))
      .collect();

    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const speedByDiff: Record<string, number[]> = {};
    const accByCat: Record<string, { c: number; t: number }> = {};
    let firstHalf: { c: number; t: number } = { c: 0, t: 0 };
    let secondHalf: { c: number; t: number } = { c: 0, t: 0 };
    let total = { c: 0, t: 0 };
    let sampleSize = 0;

    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      if (answers.length < 3) continue;
      const half = Math.ceil(answers.length / 2);
      answers.forEach((a, i) => {
        const q = bankMap.get(a.questionId);
        if (!q) return;
        sampleSize += 1;
        total.t += 1;
        if (a.correct) total.c += 1;
        if (i < half) {
          firstHalf.t += 1;
          if (a.correct) firstHalf.c += 1;
        } else {
          secondHalf.t += 1;
          if (a.correct) secondHalf.c += 1;
        }
        (speedByDiff[q.difficulty] ??= []).push(a.elapsedMs);
        const bucket = accByCat[q.category] ?? { c: 0, t: 0 };
        bucket.t += 1;
        if (a.correct) bucket.c += 1;
        accByCat[q.category] = bucket;
      });
    }

    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, n) => s + n, 0) / arr.length : 8000);
    const speedByDifficulty: Record<string, number> = {};
    for (const [d, arr] of Object.entries(speedByDiff)) speedByDifficulty[d] = Math.round(avg(arr));

    const accuracyByCategory: Record<string, number> = {};
    for (const [cat, b] of Object.entries(accByCat)) {
      accuracyByCategory[cat] = b.t > 0 ? b.c / b.t : 0.5;
    }

    return {
      speedByDifficulty,
      accuracyByCategory,
      overallAccuracy: total.t > 0 ? total.c / total.t : 0.5,
      firstHalfAccuracy: firstHalf.t > 0 ? firstHalf.c / firstHalf.t : 0.5,
      secondHalfAccuracy: secondHalf.t > 0 ? secondHalf.c / secondHalf.t : 0.5,
      sampleSize,
    };
  },
});

// ── 2) بدء المواجهة: بناء الصدى وحساب إجاباته المسبقة ───────────────────

export const startEchoMatch = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    // مواجهة نشطة؟ أكملها
    const active = await ctx.db
      .query("echoMatches")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
    if (active) return { runId: active._id, created: false as const };

    const profile = (await ctx.runQuery(
      "aiEcho:buildProfileInternal" as any,
      { userId },
    )) as MindProfile;

    if (profile.sampleSize < 12) {
      throw new Error(
        "عقلك لم يكتب بصمته بعد — العب بعض الجولات (12 إجابة على الأقل) ليتشكل صداؤك.",
      );
    }

    // اختيار الأسئلة: توزيع يرسم خريطة قدراته (فئات قوته وضعفه ودرجات متوسطة)
    const strongCats = Object.entries(profile.accuracyByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);
    const weakCats = Object.entries(profile.accuracyByCategory)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([c]) => c);

    const picked: string[] = [];
    const used = new Set<string>();
    const pickFrom = (filter: (qid: string) => boolean, n: number) => {
      const pool = QUESTION_BANK.filter((q) => !used.has(q.id) && filter(q.id));
      for (const q of pool.sort(() => Math.random() - 0.5)) {
        if (picked.length >= QUESTIONS_PER_MATCH) break;
        picked.push(q.id);
        used.add(q.id);
        if (picked.length >= n + picked.length - 0) break;
      }
    };
    // 3 من فئات قوته (hard)، 2 من ضعفه (medium)، 2 متوسطات عامة
    pickFrom((id) => {
      const q = QUESTION_BANK.find((x) => x.id === id);
      return !!q && strongCats.includes(q.category) && q.difficulty === "hard";
    }, 3);
    pickFrom((id) => {
      const q = QUESTION_BANK.find((x) => x.id === id);
      return !!q && weakCats.includes(q.category) && q.difficulty === "medium";
    }, 2);
    pickFrom((id) => {
      const q = QUESTION_BANK.find((x) => x.id === id);
      return !!q && q.difficulty === "medium";
    }, 2);

    // ── محاكاة إجابات الصدى: نفس إحصاءات الماضي على هذه الأسئلة ──
    const echoAnswers = picked.map((qid) => {
      const q = QUESTION_BANK.find((x) => x.id === qid);
      if (!q) return { questionId: qid, correct: false, elapsedMs: 8000 };
      const speed = profile.speedByDifficulty[q.difficulty] ?? 8000;
      // دقة الصدى في هذه الفئة = دقة اللاعب التاريخية في نفس الفئة
      const catAcc = profile.accuracyByCategory[q.category] ?? profile.overallAccuracy;
      // عشوائية محكومة: النرد بنفس احتمالات الماضي
      const correct = Math.random() < catAcc;
      // سرعة الصدى = سرعته التاريخية ± 15% تذبذب واقعي
      const elapsedMs = Math.round(speed * (0.85 + Math.random() * 0.3));
      return { questionId: qid, correct, elapsedMs };
    });

    const runId = await ctx.db.insert("echoMatches", {
      userId,
      echoVersion: Date.now(),
      questionIds: picked,
      status: "active",
      echoAnswers,
      createdAt: Date.now(),
    });

    return { runId, created: true as const, questions: picked.length };
  },
});

// ── 3) قراءة المواجهة الحية ────────────────────────────────────────────

export const getMyEchoMatch = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const active = await ctx.db
      .query("echoMatches")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();

    const lastDone = await ctx.db
      .query("echoMatches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const last = lastDone
      .filter((m) => m.status === "done")
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0] ?? null;

    if (!active) return { active: null, last };

    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const questions = active.questionIds
      .map((qid) => bankMap.get(qid))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: [...q.options],
      }));

    return { active: { _id: active._id, questions }, last };
  },
});

// ── 4) الحسم: من فاز — أنت أم ظلّك؟ ────────────────────────────────────

export const finishEchoMatch = mutation({
  args: { runId: v.id("echoMatches"), answers: v.array(v.object({ questionId: v.string(), selected: v.number(), elapsedMs: v.number() })) },
  handler: async (ctx, { runId, answers }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== userId || run.status !== "active") {
      throw new Error("المواجهة غير متاحة");
    }

    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    let myCorrect = 0;
    for (const a of answers) {
      const q = bankMap.get(a.questionId);
      if (q && a.selected === q.correctIndex) myCorrect += 1;
    }
    const echoCorrect = run.echoAnswers.filter((e) => e.correct).length;

    // المقارنة: الدقة أولاً، والسرعة حكم عند التعادل
    const mySpeed = answers.length > 0 ? answers.reduce((s, a) => s + a.elapsedMs, 0) / answers.length : 99e9;
    const echoSpeed = run.echoAnswers.length > 0 ? run.echoAnswers.reduce((s, e) => s + e.elapsedMs, 0) / run.echoAnswers.length : 99e9;
    const verdict =
      myCorrect > echoCorrect || (myCorrect === echoCorrect && mySpeed < echoSpeed)
        ? "surpassed"
        : myCorrect === echoCorrect
          ? "matched"
          : "lost";

    await ctx.db.patch(runId, {
      status: "done",
      myCorrect,
      echoCorrect,
      verdict,
      finishedAt: Date.now(),
    });

    const narration =
      verdict === "surpassed"
        ? `تجاوزت صدى ذاتك: ${myCorrect} مقابل ${echoCorrect} — عقلك اليوم أقوى من عقلك الأمس. العرّاف نفسه لن يتنبأ بسقفك.`
        : verdict === "matched"
          ? `تعادل حاداً مع ذاتك القديمة (${myCorrect}:${echoCorrect}) — أنت على حافة قفزة جديدة.`
          : `ظلّك القديم ما زال يسبقك (${myCorrect}:${echoCorrect}) — عد من المدرسة وانتقم من نفسك.`;

    return { myCorrect, echoCorrect, verdict, narration };
  },
});

// ── 5) إحصاءة الصدى للواجهة ────────────────────────────────────────────

export const getEchoStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const matches = await ctx.db
      .query("echoMatches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const done = matches.filter((m) => m.status === "done");
    const surpassed = done.filter((m) => m.verdict === "surpassed").length;
    return {
      total: done.length,
      surpassed,
      matched: done.filter((m) => m.verdict === "matched").length,
      lost: done.filter((m) => m.verdict === "lost").length,
      winRate: done.length > 0 ? Math.round((surpassed / done.length) * 100) : null,
    };
  },
});
