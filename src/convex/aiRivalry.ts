import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗡️ صراع النقيض (Rivalry Duels) — الأداة 19 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * «بازار العقول» اكتشف عدوّك المعلن: العقل الأبعد عن بصمتك (nemesis).
 * هذه الأداة تحوّل ذلك الاكتشاف الصامت إلى **صراع حي**:
 *
 *   1) 🌩️ الإشعال الآلي: مهمة دورية تفتح نزالات سحابية (v1/v2/v3) للاعبين
 *      النشطين — أنت تعرف من foe ويعرفك، دون أن يكتب أحد كلمة واحدة.
 *   2) ⚡ تحدّي يدوي: استدعِ نقيضك بنفسك متى شئت.
 *   3) 🎖️ الإعلان بالبصمة السلوكية: تلعب جولة حقيقية وتُقدّم أرقامها
 *      (نتيجة، دقة، أسرع إجابة) — والخادم يرفض أي رقم أكبر من تاريخك.
 *   4) 🔮 السرد المُولَّد: نص الدرامية لكل نزال بالذكاء (وبديل محلي حاد).
 *   5) ⚖️ الحكم الزمني: انتهت النافذة (3 أيام)؟ يُحكم من الإعلانات:
 *      الفائز ينهب 120 ولاء، والغياب يُسجَّل موثقاً في دفتر العقل.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const DUEL_DAYS = 3;
const WIN_REWARD = 120;
const MAX_OPEN_PER_USER = 1;
const MAX_IGNITE_PER_CYCLE = 10;

// ═══════════════════════════════════════════════════════════════════════
// البصمة الإحصائية المشتركة (من gamePlayers الحقيقية)
// ═══════════════════════════════════════════════════════════════════════

type PlayerStat = {
  userId: string;
  name: string;
  games: number;
  totalQ: number;
  bestScore: number;
  fastestCorrect: number; // أسرع إجابة صحيحة (ثوانٍ)
  holyCategory: string; // أكثر فئة أصاب فيها
};

type DbReader = MutationCtx["db"] | QueryCtx["db"];

async function buildPlayerStats(db: DbReader): Promise<Map<string, PlayerStat>> {
  const rows = await db.query("gamePlayers").take(4000);
  const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
  type Acc = {
    name: string;
    games: number;
    totalQ: number;
    bestScore: number;
    fastestCorrect: number;
    holyCat: Record<string, number>;
  };
  const byUser = new Map<string, Acc>();

  for (const row of rows) {
    const uid = String(row.userId);
    const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
    if (answers.length < 6) continue;
    let acc = byUser.get(uid);
    if (!acc) {
      acc = { name: row.name ?? "لاعب", games: 0, totalQ: 0, bestScore: 0, fastestCorrect: Infinity, holyCat: {} };
      byUser.set(uid, acc);
    }
    acc.games += 1;
    acc.bestScore = Math.max(acc.bestScore, row.score ?? 0);
    for (const a of answers) {
      acc.totalQ += 1;
      if (a.correct) {
        if (a.elapsedMs > 0) acc.fastestCorrect = Math.min(acc.fastestCorrect, a.elapsedMs / 1000);
        const q = bankMap.get(a.questionId);
        if (q) acc.holyCat[q.category] = (acc.holyCat[q.category] ?? 0) + 1;
      }
    }
  }

  const out = new Map<string, PlayerStat>();
  for (const [uid, acc] of byUser) {
    if (acc.games < 2 || acc.totalQ < 12) continue;
    const holy = Object.entries(acc.holyCat).sort((a, b) => b[1] - a[1])[0];
    out.set(uid, {
      userId: uid,
      name: acc.name,
      games: acc.games,
      totalQ: acc.totalQ,
      bestScore: acc.bestScore,
      fastestCorrect: Number.isFinite(acc.fastestCorrect) ? acc.fastestCorrect : 30,
      holyCategory: holy?.[0] ?? "عام",
    });
  }
  return out;
}

/** إحصاءة اللاعب الحالي — تُستدعى من declare عبر runQuery (قيم مسطّحة فقط) */
export const myStatInternal = internalQuery({
  handler: async (ctx): Promise<PlayerStat | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const stats = await buildPlayerStats(ctx.db);
    return stats.get(String(userId)) ?? null;
  },
});

/** تفاصيل الانتصار من gameHistory — تقوية الإشعال */
export const victoryHistoryInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(60);
    const wins = rows.filter((r) => r.won && (r.questionCount ?? 0) >= 4);
    const tightest = [...wins].sort((a, b) => (a.questionCount ?? 99) - (b.questionCount ?? 99))[0];
    const biggest = [...wins].sort((a, b) => (b.playerCount ?? 0) - (a.playerCount ?? 0))[0];
    const lastPlayedAt = [...rows].sort((a, b) => b.playedAt - a.playedAt)[0]?.playedAt ?? 0;
    return {
      tightestWin: tightest?.questionCount ?? 0,
      biggestBattle: biggest?.playerCount ?? 0,
      lastPlayedAt,
      winsCount: wins.length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// نكات الإشعال
// ═══════════════════════════════════════════════════════════════════════

const SALT_LINES = [
  "قيل إن بصمتك تشبه بصمته في مكان واحد… وهو يعرف أين.",
  "هو أسرع منك بثانية واحدة في أضعف فئاتك. ابدأ التدريب.",
  "سُئل عنك فقال: «أعرف عقله قبل أن أعرف اسمه».",
  "في دائرة النقيض يُقال: من يتقاسم البصمة، يقتسم التاج.",
  "دقّق في فئتك الأقدس… هو يعرف سبب كرامتك عنها.",
  "بصمتاكما متباعدتان إلى أقصى حدّ — وهذا وحده سبب الحرب.",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type NewDuel = Omit<Doc<"rivalryDuels">, "_id" | "_creationTime">;

type SoulRow = {
  userId: Doc<"users">["_id"];
  userName: string;
  nemesisId: Doc<"users">["_id"];
  nemesisName: string;
  nemesisContrast: number;
};

function buildDuel(m: SoulRow, now: number): NewDuel {
  const tier = 1 + (hashStr(`${String(m.userId)}:${String(m.nemesisId)}:${now}`) % 3);
  return {
    challengerId: m.userId,
    challengerName: m.userName,
    foeId: m.nemesisId,
    foeName: m.nemesisName,
    contrast: m.nemesisContrast,
    tier,
    status: "open" as const,
    salt: SALT_LINES[hashStr(`${String(m.nemesisId)}:${now}`) % SALT_LINES.length],
    reward: WIN_REWARD,
    createdAt: now,
    judgeAt: now + DUEL_DAYS * DAY,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1) الإشعال الآلي الدوري
// ═══════════════════════════════════════════════════════════════════════

export const igniteDuels = internalMutation({
  handler: async (ctx): Promise<{ ignited: number; note?: string }> => {
    const now = Date.now();
    const weekAgo = now - 7 * DAY;
    const mates = await ctx.db.query("mindSoulmates").take(500);
    if (mates.length === 0) return { ignited: 0, note: "لا شبكة توأمات بعد" };

    let ignited = 0;
    for (const mate of mates) {
      if (ignited >= MAX_IGNITE_PER_CYCLE) break;
      if (String(mate.nemesisId) === String(mate.userId)) continue;

      const openCount = await ctx.db
        .query("rivalryDuels")
        .withIndex("by_challenger_status", (q) => q.eq("challengerId", mate.userId).eq("status", "open"))
        .take(3);
      if (openCount.length >= MAX_OPEN_PER_USER) continue;

      const hist = (await ctx.runQuery(internal.aiRivalry.victoryHistoryInternal, {
        userId: mate.userId,
      })) as { lastPlayedAt: number };
      if (hist.lastPlayedAt > 0 && hist.lastPlayedAt < weekAgo) continue; // نشِط فقط

      await ctx.db.insert("rivalryDuels", buildDuel(mate, now));
      await ctx.db.insert("aiDecisionLog", {
        system: "rivalry",
        actorName: "صراع النقيض",
        action: "duel_ignited",
        targetId: String(mate.userId),
        targetName: mate.userName,
        detail: `نزال سحابي ضد «${mate.nemesisName}» (تباعد ${mate.nemesisContrast}%)`,
        severity: "low",
        createdAt: now,
      });
      ignited += 1;
    }
    return { ignited };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) التحدّي اليدوي
// ═══════════════════════════════════════════════════════════════════════

export const challengeNemesis = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const rows = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const nemesis = rows[0];
    if (!nemesis) throw new Error("لا يوجد نقيض معلن لك بعد — بازار العقول يحتاج بصمة أعمق (8+ إجابات).");

    const open = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "open"))
      .take(2);
    if (open.length >= MAX_OPEN_PER_USER) throw new Error("لديك نزال مفتوح بالفعل — أنهِ أولاً ثم عُد.");

    const now = Date.now();
    await ctx.db.insert("rivalryDuels", buildDuel(nemesis, now));
    return { ok: true as const, foeName: nemesis.nemesisName, contrast: nemesis.nemesisContrast };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) قراءات الواجهة
// ═══════════════════════════════════════════════════════════════════════

export const getMyDuels = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const asChallengerOpen = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "open"))
      .take(5);
    const asChallengerDone = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "settled"))
      .take(10);
    const asFoeOpen = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_foe_status", (q) => q.eq("foeId", userId).eq("status", "open"))
      .take(5);
    const asFoeDone = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_foe_status", (q) => q.eq("foeId", userId).eq("status", "settled"))
      .take(10);
    return [...asChallengerOpen, ...asFoeOpen, ...asChallengerDone, ...asFoeDone]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12);
  },
});

export const getMyNemesis = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return rows[0] ?? null;
  },
});

/** لوحة الرعب العامة: أشرس النزالات النشطة + آخر الأحكام */
export const getBoard = query({
  handler: async (ctx) => {
    const open = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(20);
    const settled = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_status", (q) => q.eq("status", "settled"))
      .order("desc")
      .take(15);
    return {
      open: [...open].sort((a, b) => b.contrast - a.contrast).slice(0, 10),
      settled: [...settled].sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)).slice(0, 10),
      openCount: open.length,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) الإعلان بالبصمة السلوكية
// ═══════════════════════════════════════════════════════════════════════

type DeclaredPerf = {
  score: number;
  correct: number;
  questions: number;
  players: number;
  fastest: number;
  won: boolean;
  at: number;
};

function localNarrative(i: {
  declaredName: string;
  foeName: string;
  contrast: number;
  tier: number;
  score: number;
  correct: number;
  questions: number;
  fastest: number;
  won: boolean;
  holy: string;
}): string {
  const acc = Math.round((i.correct / Math.max(1, i.questions)) * 100);
  const speedNote =
    i.fastest > 0 && i.fastest <= 2 ? " وبرقّة كسرت حدّ البديهة" : i.fastest > 0 ? " وثانية صمدت عنه الأسئلة العمياء" : "";
  const tierName = i.tier === 3 ? "نزال الدم 🩸" : i.tier === 2 ? "نزال العقول 🧠" : "نزال الظل 🌑";
  return (
    `${tierName}: «${i.declaredName}» واجه بصمة «${i.foeName}» في فصل من فصول التباعد (${i.contrast}%). ` +
    `أعلن ${i.correct}/${i.questions} صحيحة (${acc}%) بنتيجة ${i.score}${speedNote}. ` +
    (i.won
      ? `النصر سطّر اسمه، وفئة «${i.holy}» بقيت أقدس ما يملك.`
      : `الخسارة ليست نهاية البصمة — بل إعلان الحرب القادمة.`)
  );
}

export const declare = mutation({
  args: {
    duelId: v.id("rivalryDuels"),
    score: v.number(),
    correctCount: v.number(),
    questionCount: v.number(),
    playerCount: v.number(),
    fastestAnswerSec: v.number(),
    won: v.boolean(),
  },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const duel = await ctx.db.get(a.duelId);
    if (!duel) throw new Error("النزال غير موجود");
    if (duel.status !== "open") throw new Error("النزال مغلق");
    const isChallenger = String(duel.challengerId) === String(userId);
    if (!isChallenger && String(duel.foeId) !== String(userId)) throw new Error("هذا النزال ليس لك");
    if (a.questionCount < 4 || a.questionCount > 50) throw new Error("عدد أسئلة غير منطقي");
    if (a.correctCount > a.questionCount) throw new Error("نتيجة غير منطقية");
    if (a.score < 0 || a.playerCount < 1 || a.playerCount > 200) throw new Error("نتيجة غير منطقية");

    const stat = (await ctx.runQuery(internal.aiRivalry.myStatInternal, {})) as PlayerStat | null;
    if (!stat) throw new Error("بصمتك ضعيفة جداً (تحتاج 12+ إجابة حقيقية). العب أكثر ثم عُد.");

    // مقياس الصدق: لا نتيجة تتجاوز تاريخك الموثق بكثير
    if (a.score > stat.bestScore * 1.4 + 50) {
      throw new Error(`النتيجة أكبر من تاريخك بكثير (أفضل نتيجة موثقة: ${stat.bestScore}). رُفض الإعلان.`);
    }

    const now = Date.now();
    const decl: DeclaredPerf = {
      score: a.score,
      correct: a.correctCount,
      questions: a.questionCount,
      players: a.playerCount,
      fastest: a.fastestAnswerSec,
      won: a.won,
      at: now,
    };
    const narrative = localNarrative({
      declaredName: isChallenger ? duel.challengerName : duel.foeName,
      foeName: isChallenger ? duel.foeName : duel.challengerName,
      contrast: duel.contrast,
      tier: duel.tier,
      score: a.score,
      correct: a.correctCount,
      questions: a.questionCount,
      fastest: a.fastestAnswerSec,
      won: a.won,
      holy: stat.holyCategory,
    });

    await ctx.db.patch(a.duelId, isChallenger ? { challengerDeclared: decl, narrative } : { foeDeclared: decl, narrative });

    // اكتمال الإعلانين → حكم فوري
    const fresh = await ctx.db.get(a.duelId);
    if (fresh && fresh.challengerDeclared && fresh.foeDeclared) {
      await judgeDuel(ctx, fresh);
    }
    return { ok: true as const, narrative };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) الحكم (مشترك بين الإعلان الكامل والحكم الزمني)
// ═══════════════════════════════════════════════════════════════════════

async function judgeDuel(
  ctx: MutationCtx,
  duel: Doc<"rivalryDuels">,
): Promise<{ winner: "challenger" | "foe" | null }> {
  const now = Date.now();
  const cDecl = duel.challengerDeclared;
  const fDecl = duel.foeDeclared;
  const reward = duel.reward ?? WIN_REWARD;

  const perfScore = (d?: DeclaredPerf) =>
    !d ? -Infinity : d.score * 1000 + (d.correct / Math.max(1, d.questions)) * 500 - d.fastest;

  const cScore = perfScore(cDecl);
  const fScore = perfScore(fDecl);
  const winner: "challenger" | "foe" | null =
    cScore === fScore ? null : cScore > fScore ? "challenger" : "foe";

  if (winner) {
    const winnerId = winner === "challenger" ? duel.challengerId : duel.foeId;
    const loserName = winner === "challenger" ? duel.foeName : duel.challengerName;
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", winnerId))
      .take(1);
    if (wr[0]) {
      await ctx.db.patch(wr[0]._id, { points: wr[0].points + reward, updatedAt: now });
    } else {
      await ctx.db.insert("loyaltyWallets", {
        userId: winnerId,
        points: reward,
        lifetimeEarned: reward,
        perks: [],
        updatedAt: now,
      });
    }
    await ctx.db.insert("loyaltyLedger", {
      userId: winnerId,
      delta: reward,
      reason: `نصر في نزال النقيض ضد «${loserName}»`,
      at: now,
    });
  }

  const winnerName = winner === "challenger" ? duel.challengerName : duel.foeName;
  const verdict = !cDecl && !fDecl
    ? `تعادل محكم — لم يُعلن أحد داخل نافذة ${DUEL_DAYS} أيام. لا مجد، لا فتوى.`
    : !cDecl || !fDecl
      ? `فاز «${winnerName}» بغياب خصمه — لم يقدّم البقية بصمته في النافذة.`
      : `فاز «${winnerName}» بتفاضل دقيق (${cDecl.score} مقابل ${fDecl.score} نقطة).`;

  await ctx.db.patch(duel._id, {
    status: "settled",
    winner: winner ?? "draw",
    verdictDetail: verdict,
    resolvedAt: now,
  });

  await ctx.db.insert("aiDecisionLog", {
    system: "rivalry",
    actorName: "صراع النقيض",
    action: winner ? "duel_settled" : "duel_draw",
    targetId: String(duel.challengerId),
    targetName: duel.challengerName,
    detail: `${winner ? `فاز «${winnerName}» ودُفع ${reward} ولاء` : "تعادل بلا إعلان"} — ضد «${duel.foeName}»`,
    severity: "low",
    createdAt: now,
  });

  return { winner };
}

/** الحكم الدوري: يُسوّي كل النزالات المفتوحة التي انتهت نافذتها */
export const judgeDue = internalMutation({
  handler: async (ctx): Promise<{ settled: number }> => {
    const now = Date.now();
    const open = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(60);
    const due = open.filter((d) => d.judgeAt <= now);
    let settled = 0;
    for (const d of due) {
      await judgeDuel(ctx, d);
      settled += 1;
    }
    return { settled };
  },
});

export const rivalryJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const ignite = (await ctx.runMutation(internal.aiRivalry.igniteDuels, {})) as unknown;
    const judge = (await ctx.runMutation(internal.aiRivalry.judgeDue, {})) as unknown;
    return { ignite, judge };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 6) سرد ذكاء اختياري — زر «أعد السرد بالذكاء» في الواجهة
// ═══════════════════════════════════════════════════════════════════════

export const enhanceNarrative = mutation({
  args: { duelId: v.id("rivalryDuels") },
  handler: async (ctx, { duelId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("النزال غير موجود");
    if (String(duel.challengerId) !== String(userId) && String(duel.foeId) !== String(userId)) {
      throw new Error("هذا النزال ليس لك");
    }
    if (!getOpenRouterKey()) return { ok: false as const, note: "لا مزوّد AI مفعّل — السرد المحلي يكفي" };
    try {
      await ensureAiRuntime(ctx);
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت راوٍ درامي لنزالات عقلية في لعبة أسئلة عربية. اكتب 3 أسطر: افتتاحية عن التباعد بين العقلين، ثم تفاصيل الأداء المعلن، ثم خاتمة تُخلّد الفائز أو تُلهب الخاسر. بلا مبالغة كاريكاتورية.",
          },
          {
            role: "user",
            content: JSON.stringify({
              المتحدي: duel.challengerName,
              النقيض: duel.foeName,
              التباعد: duel.contrast,
              الدرجة: duel.tier,
              إعلان_المتحدّي: duel.challengerDeclared ?? null,
              إعلان_النقيض: duel.foeDeclared ?? null,
              الحكم: duel.verdictDetail ?? null,
              النكتة: duel.salt,
            }),
          },
        ],
        260,
        0.85,
        "MindClash Rivalry Narrator",
      );
      const clean = raw.trim().slice(0, 480);
      if (clean.length > 30) {
        await ctx.db.patch(duelId, { narrative: clean });
        return { ok: true as const, narrative: clean };
      }
      return { ok: false as const, note: "السرد الذكي لم يُنتج نصاً كافياً" };
    } catch (e) {
      return { ok: false as const, note: e instanceof Error ? e.message : "فشل السرد الذكي" };
    }
  },
});
