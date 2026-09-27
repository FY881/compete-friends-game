import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK, CATEGORIES } from "./questions";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👻 مبارزة الشبح (Ghost Duel) — الأداة 25 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل أنظمة القتال تنتظر أياماً (نزالات 3 أيام، خطط أسبوع، تحالفات أسبوع).
 * هذه المبارزة **فورية**: شبح نقيضك — مبني من بصمته الحقيقية — يجيب
 * الأسئلة معك سؤالاً بسؤال، باحتمالات دقته الفعلية في كل فئة:
 *
 *   1) 🩻 الشبح من البيانات: نختار 7 أسئلة (3 من أقوى فئات الشبح —
 *      تتدرب حيث هو خطير، 2 من أضعف فئاتك، 2 عشوائية) ويُحاكى جوابه
 *      مسبقاً بحُظّه الحقيقي من الإجابات.
 *   2) ⚡ حسم فوري: 7 أسئلة، شبحك يجيب في وقته الوهمي (2-14 ثانية حسب
 *      الصعوبة)، والفائز يُعلن لحظة السؤال السابع.
 *   3) 🏆 الغنيمة: نصر 60 ولاء، تعادل 25 — بحد مبارزة كل 3 ساعات.
 *   4) 👻 كلمة الشبح الأخيرة: تعليق ختامي من نقيضك بالذكاء (اختياري).
 * ═══════════════════════════════════════════════════════════════════════
 */

const HOUR = 3600_000;
const DUEL_QUESTIONS = 7;
const EXPIRY_MS = 15 * 60_000; // المبارزة تُقصى بعد ربع ساعة
const COOLDOWN_MS = 3 * HOUR;
const WIN_REWARD = 60;
const DRAW_REWARD = 25;
const UNKNOWN_ACC = 0.35;

const TAUNTS = [
  "«تعال… بصمتي تعرفك قبل أن تعرف نفسك.»",
  "«سرعتك لا تساوي شيئاً أمام عقل يقرأ الأسئلة مرتين.»",
  "«سأجيب ببطء… لتشمّ الفارق.»",
  "«هذه ليست مباراة، هذه محاكمة لبصمتك.»",
  "«كنت أنتظارك منذ أن تكوّن نقيضك.»",
];

type GhostDuel = Doc<"ghostDuels">;

const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ghostElapsed(difficulty: string): number {
  const span = difficulty === "easy" ? [2000, 6000] : difficulty === "hard" ? [6000, 14000] : [4000, 10000];
  return Math.round(span[0] + Math.random() * (span[1] - span[0]));
}

// ═══════════════════════════════════════════════════════════════════════
// 1) بدء المبارزة — بناء الشبح وتحاكي إجاباته مسبقاً
// ═══════════════════════════════════════════════════════════════════════

export const startDuel = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const now = Date.now();
    const active = await ctx.db
      .query("ghostDuels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(5);
    if (active.some((d) => d.status === "active" && d.expiresAt > now)) {
      throw new Error("لديك مبارزة جارية — أكملها أولاً!");
    }
    const last = active
      .filter((d) => d.status === "settled")
      .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0))[0];
    if (last?.settledAt && now - last.settledAt < COOLDOWN_MS) {
      const left = Math.ceil((COOLDOWN_MS - (now - last.settledAt)) / 60000);
      throw new Error(`الشبح يرتاح — مبارزتك القادمة بعد ${left} دقيقة.`);
    }

    const mate = (
      await ctx.db
        .query("mindSoulmates")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(1)
    )[0];
    if (!mate) throw new Error("لا نقيض معلن لك بعد — بازار العقول يحتاج بصمتك أولاً.");

    const fps = (await ctx.runQuery(internal.aiMentor.collectFingerprints, {})) as unknown as Array<{
      userId: Id<"users">;
      name: string;
      accByCat: Record<string, number>;
      overall: number;
      sample: number;
    }>;
    const ghost = fps.find((f) => String(f.userId) === String(mate.nemesisId));
    if (!ghost) throw new Error("بصمة نقيضك ضاعت مؤقتاً (قلة لعب) — الشبح لا يُبنى على بيانات ناقصة.");

    // اختيار الأسئلة: 3 من أقوى فئتي الشبح (تدرب حيث هو خطير) + 2 من أضعف فئاتك + 2 عشوائية
    const myWeak = Object.entries(fps.find((f) => String(f.userId) === String(userId))?.accByCat ?? {})
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([c]) => c);
    const ghostStrong = Object.entries(ghost.accByCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([c]) => c);

    const byCat = new Map<string, string[]>();
    for (const q of QUESTION_BANK) {
      const list = byCat.get(q.category) ?? [];
      list.push(q.id);
      byCat.set(q.category, list);
    }
    const pickFrom = (cats: readonly string[], n: number): string[] => {
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        const cat = cats.length > 0 ? pick(cats) : pick(CATEGORIES);
        out.push(pick(byCat.get(cat) ?? QUESTION_BANK.map((q) => q.id)));
      }
      return out;
    };
    const ids = [
      ...pickFrom(ghostStrong, 3),
      ...pickFrom(myWeak, 2),
      ...pickFrom(CATEGORIES, DUEL_QUESTIONS - 5),
    ];

    // محاكاة إجابات الشبح مسبقاً — بحُظّه الحقيقي في كل فئة
    const questions = ids.map((id) => {
      const q = bankMap.get(id)!;
      const p = ghost.accByCat[q.category] ?? UNKNOWN_ACC;
      return {
        questionId: id,
        ghostCorrect: Math.random() < p,
        ghostElapsedMs: ghostElapsed(q.difficulty),
      };
    });

    await ctx.db.insert("ghostDuels", {
      userId,
      userName: me.name ?? "لاعب",
      ghostId: mate.nemesisId,
      ghostName: mate.nemesisName,
      ghostContrast: mate.nemesisContrast,
      ghostSample: ghost.sample,
      ghostAccSnapshot: JSON.stringify(ghost.accByCat),
      questions,
      myCorrect: 0,
      ghostCorrect: 0,
      myAnswered: 0,
      result: undefined,
      reward: 0,
      verdict: undefined,
      status: "active" as const,
      createdAt: now,
      expiresAt: now + EXPIRY_MS,
      taunt: pick(TAUNTS),
    });

    return { ok: true as const, ghostName: mate.nemesisName, contrast: mate.nemesisContrast, count: DUEL_QUESTIONS };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) قراءة المباراة (مُنقّاة: بلا إجابات صحيحة للأسئلة غير المجابة)
// ═══════════════════════════════════════════════════════════════════════

export const getMyDuel = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const now = Date.now();
    const rows = await ctx.db
      .query("ghostDuels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(8);
    const active = rows.find((d) => d.status === "active" && d.expiresAt > now);
    const last = rows
      .filter((d) => d.status === "settled")
      .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0))[0];

    const mate = (
      await ctx.db
        .query("mindSoulmates")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(1)
    )[0];

    const cooldownLeft = last?.settledAt ? Math.max(0, COOLDOWN_MS - (now - last.settledAt)) : 0;

    const sanitize = (d: GhostDuel) => ({
      _id: String(d._id),
      ghostName: d.ghostName,
      ghostContrast: d.ghostContrast,
      ghostSample: d.ghostSample,
      taunt: d.taunt,
      myCorrect: d.myCorrect,
      ghostCorrect: d.ghostCorrect,
      myAnswered: d.myAnswered,
      total: d.questions.length,
      result: d.result,
      reward: d.reward,
      verdict: d.verdict,
      expiresAt: d.expiresAt,
      // كشف تدريجي: الأسئلة المجابة فقط تُظهر مفتاح الإجابة
      items: d.questions.map((q, i) => {
        const bank = bankMap.get(q.questionId);
        const revealed = i < d.myAnswered;
        return {
          index: i,
          question: bank?.question ?? "—",
          options: bank?.options ?? [],
          category: bank?.category ?? "عام",
          difficulty: bank?.difficulty ?? "medium",
          correctIndex: revealed ? (bank?.correctIndex ?? -1) : undefined,
          ghostCorrect: revealed ? q.ghostCorrect : undefined,
          ghostElapsedMs: revealed ? q.ghostElapsedMs : undefined,
        };
      }),
    });

    return {
      duel: active ? sanitize(active) : null,
      last: last ? sanitize(last) : null,
      nemesisName: mate?.nemesisName ?? null,
      cooldownMs: cooldownLeft,
      canStart: !active && cooldownLeft === 0 && Boolean(mate),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) الإجابة سؤالاً بسؤال — والحسم لحظة السؤال الأخير
// ═══════════════════════════════════════════════════════════════════════

async function settleDuel(ctx: MutationCtx, duel: GhostDuel): Promise<{ result: "win" | "loss" | "draw"; reward: number }> {
  const now = Date.now();
  const result: "win" | "loss" | "draw" =
    duel.myCorrect > duel.ghostCorrect ? "win" : duel.ghostCorrect > duel.myCorrect ? "loss" : "draw";
  const reward = result === "win" ? WIN_REWARD : result === "draw" ? DRAW_REWARD : 0;

  if (reward > 0) {
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", duel.userId))
      .take(1);
    if (wr[0]) {
      await ctx.db.patch(wr[0]._id, { points: wr[0].points + reward, updatedAt: now });
    } else {
      await ctx.db.insert("loyaltyWallets", {
        userId: duel.userId,
        points: reward,
        lifetimeEarned: reward,
        perks: [],
        updatedAt: now,
      });
    }
    await ctx.db.insert("loyaltyLedger", {
      userId: duel.userId,
      delta: reward,
      reason: result === "win" ? `نصر مبارزة الشبح ضد «${duel.ghostName}»` : `تعادل مشرّف مع شبح «${duel.ghostName}»`,
      at: now,
    });
  }

  await ctx.db.insert("aiDecisionLog", {
    system: "ghost_duel",
    actorName: "مبارزة الشبح",
    action: result === "win" ? "ghost_defeated" : result === "draw" ? "ghost_draw" : "ghost_lost",
    targetId: String(duel.userId),
    targetName: duel.userName,
    detail: `${duel.myCorrect}:${duel.ghostCorrect} ضد شبح «${duel.ghostName}»${reward > 0 ? ` — دُفع ${reward} ولاء` : ""}`,
    severity: "low",
    createdAt: now,
  });

  return { result, reward };
}

export const answerQuestion = mutation({
  args: { duelId: v.id("ghostDuels"), index: v.number(), selected: v.number() },
  handler: async (ctx, { duelId, index, selected }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("المبارزة غير موجودة");
    if (String(duel.userId) !== String(userId)) throw new Error("هذه المبارزة ليست لك");
    if (duel.status !== "active") throw new Error("المبارزة انتهت");
    if (Date.now() > duel.expiresAt) throw new Error("انتهى وقت المبارزة — الشبح تلاشى");
    if (index !== duel.myAnswered) throw new Error("أجب بالترتيب — السؤال الحالي مختلف");

    const q = duel.questions[index];
    const bank = bankMap.get(q.questionId);
    if (!bank) throw new Error("سؤال غير معروف");
    const correct = selected === bank.correctIndex;
    const myCorrect = duel.myCorrect + (correct ? 1 : 0);
    const ghostCorrect = duel.ghostCorrect + (q.ghostCorrect ? 1 : 0);
    const myAnswered = duel.myAnswered + 1;
    const finished = myAnswered >= duel.questions.length;

    await ctx.db.patch(duelId, { myCorrect, ghostCorrect, myAnswered });

    let result: "win" | "loss" | "draw" | null = null;
    let reward = 0;
    if (finished) {
      const fresh = (await ctx.db.get(duelId)) as GhostDuel;
      const s = await settleDuel(ctx, fresh);
      result = s.result;
      reward = s.reward;
      await ctx.db.patch(duelId, {
        status: "settled" as const,
        result,
        reward,
        settledAt: Date.now(),
        verdict:
          result === "win"
            ? `هزمت شبح «${duel.ghostName}» ${myCorrect}:${ghostCorrect} — غنيمة ${WIN_REWARD} ولاء`
            : result === "draw"
              ? `تعادل مشرّف ${myCorrect}:${ghostCorrect} مع شبح «${duel.ghostName}» — ${DRAW_REWARD} ولاء`
              : `شبح «${duel.ghostName}» تفوق ${ghostCorrect}:${myCorrect} — تدرّب وعُد بعد 3 ساعات`,
      });
    }

    return {
      correct,
      correctIndex: bank.correctIndex,
      ghostCorrect: q.ghostCorrect,
      ghostElapsedMs: q.ghostElapsedMs,
      myCorrect,
      ghostCorrectTotal: ghostCorrect,
      finished,
      result,
      reward,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) كلمة الشبح الأخيرة — تعليق ختامي ذكي (اختياري)
// ═══════════════════════════════════════════════════════════════════════

export const ghostVerdict = mutation({
  args: { duelId: v.id("ghostDuels") },
  handler: async (ctx, { duelId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("المبارزة غير موجودة");
    if (String(duel.userId) !== String(userId)) throw new Error("هذه المبارزة ليست لك");
    if (duel.status !== "settled") throw new Error("المبارزة لم تُحسم بعد");
    try {
      await ensureAiRuntime(ctx);
      const { callLlm } = await import("./aiConfig");
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت شبح نقيض عقلية في لعبة أسئلة عربية — عقل مبني من بصمة لاعب حقيقي يخطئ حيث يخطئ ويتألق حيث يتألق. علّق على نتيجة المبارزة بأسلوب مهيب غامض من سطرين: إن خسرت أمامه اطرأ حلواً قاسياً، وإن هزمته اعترف بندرة ذلك.",
          },
          {
            role: "user",
            content: JSON.stringify({
              الشبح: duel.ghostName,
              الطاعن: duel.userName,
              تباعد_البصمة: duel.ghostContrast,
              النتيجة: `${duel.myCorrect}:${duel.ghostCorrect}`,
              الحكم: duel.result,
            }),
          },
        ],
        160,
        0.9,
        "MindClash Ghost Verdict",
      );
      const clean = raw.trim().slice(0, 320);
      if (clean.length > 25) {
        await ctx.db.patch(duelId, { verdict: `${duel.verdict ?? ""} 👻 ${clean}` });
        return { ok: true as const, verdict: clean };
      }
      return { ok: false as const, note: "الشبح امتنع عن الكلام" };
    } catch (e) {
      return { ok: false as const, note: e instanceof Error ? e.message : "لا صوت للأشباح الآن" };
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) قصّي المباريات المتهالكة (مهمة دورية)
// ═══════════════════════════════════════════════════════════════════════

export const ghostSweeper = internalMutation({
  handler: async (ctx): Promise<{ expired: number }> => {
    const now = Date.now();
    const active = await ctx.db
      .query("ghostDuels")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(60);
    const stale = active.filter((d) => d.expiresAt <= now);
    for (const d of stale) {
      await ctx.db.patch(d._id, {
        status: "expired" as const,
        verdict: `تلاشى الشبح — لم تُكمل المبارزة (${d.myAnswered}/${d.questions.length})`,
      });
    }
    return { expired: stale.length };
  },
});

export const ghostJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiGhost.ghostSweeper, {})) as unknown;
  },
});
