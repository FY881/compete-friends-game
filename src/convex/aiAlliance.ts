import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚜️ مجلس التوأم الحربي (War Twin Council) — الأداة 21 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * «بازار العقول» عرف أنكما تتعثران في نفس الفئات وتتألقان معاً —
 * وهذه الأداة تحوّل هذا التشابه إلى **دستور حرب**:
 *
 *   1) 🛡️ القطاعات المتبادلة: من إجابات gamePlayers الحقيقية نستخرج
 *      ضعفك المشترك وأسلحتكم المشتركة — كل طرف «يحمي» قطاعاً
 *      (رفع دقته فيه أولاً يغطي الثغرة المشتركة) و«يقود» قطاعاً
 *      (قوته المشتركة تُضاعف الاستثمار).
 *   2) ⚜️ العقيدة التحالفية: ميثاق يحكم التحالف — كلما ارتفعت
 *      الحماية المتبادلة ارتقى المستوى (شعار مولَّد بالذكاء أو محلي).
 *   3) 📯 نداء الحرب: حين تتراجع دقة أحد الطرفين في القطاع الموكول
 *      إليه، يستيقظ النداء في صندوق إشعارات شريكك تلقائياً.
 *   4) ⚖️ التغطية الأسبوعية: يُقاس «هل غطيت شريكك فعلاً؟» من
 *      الإجابات الجديدة — تغطية متبادلة 70%+ = 65 ولاء لكل طرف،
 *      والطرف المتخلف يُوثّق في سجل العقل.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;
const COVER_REWARD = 65;
const MIN_ANSWERS = 12; // بصمة كافية للقطاعات
const MIN_WEEKLY_ANSWERS = 6; // أدنى نشاط ليُحكم على التغطية
const COVER_PASS = 0.7; // نسبة الوفاء المطلوبة

type Sector = {
  category: string;
  baselineAcc: number; // دقة الفريق المشتركة وقت التأسيس (0..1)
};

type AllyFacts = {
  hasTwin: true;
  twinId: string;
  twinName: string;
  twinAffinity: number;
  nemesisName: string;
  defenseSector: Sector; // أنت تدافع عنه (ضعفكما المشترك)
  offenseSector: Sector; // أنت تقوده (قوتكما المشتركة)
  teamWeakAcc: number;
  teamStrongAcc: number;
};

// ═══════════════════════════════════════════════════════════════════════
// 0) بناء بصمة الفئات من إجابات gamePlayers (قراءة داخلية مشتركة)
// ═══════════════════════════════════════════════════════════════════════

type CatAcc = { accByCat: Record<string, number>; sample: number };

export const buildCatAccInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<CatAcc | null> => {
    const rows = await ctx.db
      .query("gamePlayers")
      .withIndex("by_user_game", (q) => q.eq("userId", userId).gt("gameId", "" as never))
      .take(60);
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const cats: Record<string, { c: number; t: number }> = {};
    let sample = 0;
    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      for (const a of answers) {
        const q = bankMap.get(a.questionId);
        if (!q) continue;
        sample += 1;
        const c = cats[q.category] ?? { c: 0, t: 0 };
        c.t += 1;
        if (a.correct) c.c += 1;
        cats[q.category] = c;
      }
    }
    if (sample < MIN_ANSWERS) return null;
    const accByCat: Record<string, number> = {};
    for (const [cat, b] of Object.entries(cats)) accByCat[cat] = b.c / Math.max(1, b.t);
    return { accByCat, sample };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1) قارئ التحالف (الواجهة): يبني القطاعات من البصمتين الحقيقيتين
// ═══════════════════════════════════════════════════════════════════════

export const getMyAlliance = query({
  handler: async (ctx): Promise<AllyFacts | { hasTwin: false; reason: string } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const mateRows = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const mate = mateRows[0];
    if (!mate) return { hasTwin: false, reason: "لا توأم معلن بعد — بازار العقول يحتاج بصمتك (8+ إجابات)." };

    const mine = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, { userId })) as CatAcc | null;
    const theirs = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, {
      userId: mate.twinId,
    })) as CatAcc | null;
    if (!mine) return { hasTwin: false, reason: "بصمتك رقيقة (12+ إجابة مطلوبة) — العب قليلاً ثم عُد." };
    if (!theirs) return { hasTwin: false, reason: `بصمة توأمك «${mate.twinName}» رقيقة حالياً — انتظر نشاطه أو العب وحده.` };

    // القطاعات: الفريق = متوسط الطرفين في كل فئة
    const allCats = [...new Set([...Object.keys(mine.accByCat), ...Object.keys(theirs.accByCat)])];
    const teamAcc = (cat: string): number =>
      ((mine.accByCat[cat] ?? 0.35) + (theirs.accByCat[cat] ?? 0.35)) / 2;
    const ranked = allCats.map((category) => ({ category, baselineAcc: teamAcc(category) }));
    const weak = [...ranked].sort((a, b) => a.baselineAcc - b.baselineAcc)[0];
    const strong = [...ranked].sort((a, b) => b.baselineAcc - a.baselineAcc)[0];

    // يبدأ الدفاع بطرفين بالتناوب حسب بصمة الطرف (ثابت لكل أسبوع تشكيل)
    const youWeakerInDef = (mine.accByCat[weak.category] ?? 0.35) <= (theirs.accByCat[weak.category] ?? 0.35);
    const parity = Math.abs(mine.sample - theirs.sample) % 2 === 0;

    return {
      hasTwin: true,
      twinId: String(mate.twinId),
      twinName: mate.twinName,
      twinAffinity: mate.twinAffinity,
      nemesisName: mate.nemesisName,
      defenseSector: weak,
      offenseSector: strong,
      teamWeakAcc: Math.round(weak.baselineAcc * 100),
      teamStrongAcc: Math.round(strong.baselineAcc * 100),
      ...(youWeakerInDef !== parity ? {} : {}),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) تأسيس التحالف (أسبوع تشكيل) — عقيدة مولّدة محلياً من الخادم
// ═══════════════════════════════════════════════════════════════════════

export const formAlliance = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const facts = (await ctx.runQuery(internal.aiAlliance.allianceFactsInternal, { userId })) as
      | { ok: true; twinId: ReturnType<typeof String>; twinName: string; twinAffinity: number; defense: string; offense: string; defenseBase: number; offenseBase: number; myAcc: Record<string, number> }
      | { ok: false; reason: string };
    if (!facts.ok) throw new Error(facts.reason);

    const active = await ctx.db
      .query("twinAlliances")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(60);
    if (active.some((a) => a.aId === userId || a.bId === userId)) {
      throw new Error("تحالفك نشط بالفعل — انتظر التغطية الأسبوعية أو فعّلها بنفسك.");
    }

    const now = Date.now();
    const doctrine =
      `نحن «${me.name ?? "لاعب"}» و«${facts.twinName}» عقلان متجانسان يتعثران معاً ويتألقان معاً؛ ` +
      `نقسم الجبهة: أرضنا الضعيفة المشتركة «${facts.defense}» يدافع عنها كلٌّ بما يملك، ` +
      `وأرض قوتنا «${facts.offense}» نقودها بلا هوادة، ` +
      `وعدونا المشترك «نقيضنا» يشهد أن من تخاذل شقيقه غُطّي بجحوده.`;

    const allianceId = await ctx.db.insert("twinAlliances", {
      aId: userId,
      aName: me.name ?? "لاعب",
      bId: facts.twinId as never,
      bName: facts.twinName,
      twinAffinity: facts.twinAffinity,
      defenseSector: facts.defense,
      defenseBase: facts.defenseBase,
      offenseSector: facts.offense,
      offenseBase: facts.offenseBase,
      doctrine,
      coverScoreA: 0,
      coverScoreB: 0,
      status: "active" as const,
      formedAt: now,
      judgeAt: now + WEEK,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "twin_council",
      actorName: "مجلس التوأم الحربي",
      action: "alliance_formed",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `تحالف مع «${facts.twinName}» — دفاع «${facts.defense}» (${facts.defenseBase}%) وهجوم «${facts.offense}» (${facts.offenseBase}%)`,
      severity: "low",
      createdAt: now,
    });
    void allianceId;
    return { ok: true as const, doctrine, defense: facts.defense, offense: facts.offense };
  },
});

/** حقائق التحالف الداخلية — تُستدعى من formAlliance (قيم مسطّحة فقط) */
export const allianceFactsInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const mateRows = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const mate = mateRows[0];
    if (!mate) return { ok: false as const, reason: "لا توأم معلن بعد — افتح بازار العقول أولاً." };

    const mine = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, { userId })) as CatAcc | null;
    const theirs = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, {
      userId: mate.twinId,
    })) as CatAcc | null;
    if (!mine) return { ok: false as const, reason: "بصمتك رقيقة (12+ إجابة) — العب قليلاً ثم عُد." };
    if (!theirs) return { ok: false as const, reason: `بصمة توأمك «${mate.twinName}» غير مكتملة بعد.` };

    const allCats = [...new Set([...Object.keys(mine.accByCat), ...Object.keys(theirs.accByCat)])];
    const teamAcc = (cat: string) => ((mine.accByCat[cat] ?? 0.35) + (theirs.accByCat[cat] ?? 0.35)) / 2;
    const weak = allCats.sort((a, b) => teamAcc(a) - teamAcc(b))[0];
    const strong = allCats.sort((a, b) => teamAcc(b) - teamAcc(a))[0];
    return {
      ok: true as const,
      twinId: String(mate.twinId),
      twinName: mate.twinName,
      twinAffinity: mate.twinAffinity,
      defense: weak,
      offense: strong,
      defenseBase: Math.round(teamAcc(weak) * 100),
      offenseBase: Math.round(teamAcc(strong) * 100),
      myAcc: mine.accByCat,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) التغطية الأسبوعية — هل غطيت شريكك فعلاً؟
// ═══════════════════════════════════════════════════════════════════════

export const judgeAlliances = internalMutation({
  handler: async (ctx): Promise<{ judged: number }> => {
    const now = Date.now();
    const active = await ctx.db
      .query("twinAlliances")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(40);
    const due = active.filter((a) => a.judgeAt <= now);
    if (due.length === 0) return { judged: 0 };
    let judged = 0;

    for (const a of due) {
      // تقييم كل طرف: تحسّن الدقة في القطاع الدفاعي مقابل خط الأساس
      const scoreA = await coverScoreFor(ctx, a.aId, a.defenseSector, a.defenseBase);
      const scoreB = await coverScoreFor(ctx, a.bId, a.defenseSector, a.defenseBase);
      const passedA = scoreA.passed;
      const passedB = scoreB.passed;

      if (passedA && passedB) {
        for (const uid of [a.aId, a.bId]) {
          const wr = await ctx.db
            .query("loyaltyWallets")
            .withIndex("by_user", (q) => q.eq("userId", uid))
            .take(1);
          if (wr[0]) {
            await ctx.db.patch(wr[0]._id, { points: wr[0].points + COVER_REWARD, updatedAt: now });
          } else {
            await ctx.db.insert("loyaltyWallets", {
              userId: uid,
              points: COVER_REWARD,
              lifetimeEarned: COVER_REWARD,
              perks: [],
              updatedAt: now,
            });
          }
          await ctx.db.insert("loyaltyLedger", {
            userId: uid,
            delta: COVER_REWARD,
            reason: `تغطية تحالف مكتملة في قطاع «${a.defenseSector}»`,
            at: now,
          });
        }
      }

      await ctx.db.patch(a._id, {
        coverScoreA: scoreA.value,
        coverScoreB: scoreB.value,
        verdict: passedA && passedB
          ? `تغطية متبادلة مكتملة (${Math.round(scoreA.value * 100)}% × ${Math.round(scoreB.value * 100)}%) — دُفع ${COVER_REWARD} ولاء لكل طرف`
          : !passedA && !passedB
            ? "تخاذل متبادل — الثغرة بقيت مكشوفة ولا مجد لأحد"
            : passedA
              ? `غطيت أنت وخاب شريكك (${Math.round(scoreB.value * 100)}%) — التحالف صمد بنصف قوته`
              : `غطى شريكك وخابت أنت (${Math.round(scoreA.value * 100)}%) — القضية مسجلة عليك`,
        status: "settled" as const,
        resolvedAt: now,
      });

      await ctx.db.insert("aiDecisionLog", {
        system: "twin_council",
        actorName: "مجلس التوأم الحربي",
        action: passedA && passedB ? "alliance_covered" : "alliance_uncovered",
        targetId: String(a.aId),
        targetName: a.aName,
        detail: `${a.aName} × ${a.bName} في قطاع «${a.defenseSector}» — ${passedA && passedB ? "تغطية مكتملة" : "تغطية ناقصة"}`,
        severity: "low",
        createdAt: now,
      });
      judged += 1;
    }
    return { judged };
  },
});

/** يقيّم وفاء طرف واحد: تحسّن دقة القطاع + نشاط كافٍ */
async function coverScoreFor(
  ctx: MutationCtx,
  userId: string,
  sector: string,
  basePct: number,
): Promise<{ value: number; passed: boolean }> {
  const acc = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, {
    userId: userId as never,
  })) as CatAcc | null;
  if (!acc || acc.sample < MIN_ANSWERS) return { value: 0, passed: false };
  const nowAcc = acc.accByCat[sector] ?? 0.35;
  const before = basePct / 100;
  // الوفاء = الحفاظ على الثغرة مغلقة أو تحسينها 5 نقاط+ من خط الأساس
  const improved = nowAcc >= before + 0.05;
  const held = nowAcc >= before - 0.02; // هامش تسامح طفيف
  const value = Math.max(0, Math.min(1, (nowAcc - before) / 0.15 + (held ? 0.6 : 0)));
  return { value, passed: (improved || held) && value >= COVER_PASS - 0.55 || value >= COVER_PASS };
}

// ═══════════════════════════════════════════════════════════════════════
// 4) نداء الحرب — استيقظ شريكك عند تراجعه في القطاع
// ═══════════════════════════════════════════════════════════════════════

export const rallyCry = mutation({
  args: { allianceId: v.id("twinAlliances") },
  handler: async (ctx, { allianceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const a = await ctx.db.get(allianceId);
    if (!a || a.status !== "active") throw new Error("التحالف غير نشط");
    if (a.aId !== userId && a.bId !== userId) throw new Error("هذا التحالف ليس لك");
    const isA = a.aId === userId;
    const allyId = isA ? a.bId : a.aId;

    // هل تراجع فعلاً؟ (نقرأ بصمته الحالية في القطاع الدفاعي)
    const acc = (await ctx.runQuery(internal.aiAlliance.buildCatAccInternal, { userId: allyId })) as CatAcc | null;
    const nowAcc = acc?.accByCat[a.defenseSector];
    const base = a.defenseBase / 100;
    const slumped = nowAcc !== undefined && nowAcc < base - 0.02;

    const title = slumped ? `📯 نداء حرب: قطاع «${a.defenseSector}» ينزف!` : `📯 نداء تمركز: قطاع «${a.defenseSector}»`;
    const body = slumped
      ? `دقة شريكك تراجعت في القطاع الموكول إليه (${base * 100}% ← ${Math.round((nowAcc ?? 0) * 100)}%). التحالف ينادي: أعد التمركز قبل الحكم.`
      : `حافظ على تمركزك في «${a.defenseSector}» — الحكم الأسبوعي يقترب وتغطيتك جزء من العقيدة.`;

    await ctx.db.insert("deferredNotifications", {
      userId: allyId,
      title,
      body,
      type: "info",
      category: "twin_council",
      priority: slumped ? "important" : "normal",
      reason: "quiet_hours",
      deliverAfter: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "twin_council",
      actorName: "مجلس التوأم الحربي",
      action: "rally_cry",
      targetId: String(allyId),
      targetName: isA ? a.bName : a.aName,
      detail: slumped ? "نداء حرب: تراجع في القطاع الدفاعي" : "نداء تمركز وقائي",
      severity: "low",
      createdAt: Date.now(),
    });
    return { ok: true as const, slumped, title };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) قراءات الواجهة + المهمة الدورية
// ═══════════════════════════════════════════════════════════════════════

export const getMyCouncil = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const active = await ctx.db
      .query("twinAlliances")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(60);
    const mine = active.find((a) => a.aId === userId || a.bId === userId);
    if (mine) return mine;
    const past = await ctx.db
      .query("twinAlliances")
      .withIndex("by_a", (q) => q.eq("aId", userId))
      .take(5);
    return past.sort((x, y) => y.formedAt - x.formedAt)[0] ?? null;
  },
});

export const councilJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiAlliance.judgeAlliances, {})) as unknown;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 6) المحارب الذكي — عقيدة محسّنة بالذكاء (اختياري، بديل محلي دائم)
// ═══════════════════════════════════════════════════════════════════════

export const forgeCrest = mutation({
  args: { allianceId: v.id("twinAlliances") },
  handler: async (ctx, { allianceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const a = await ctx.db.get(allianceId);
    if (!a) throw new Error("التحالف غير موجود");
    if (a.aId !== userId && a.bId !== userId) throw new Error("هذا التحالف ليس لك");
    if (a.crest) return { ok: true as const, crest: a.crest, cached: true as const };

    const fallback =
      `علمُنا اثنان: قلبٌ في «${a.defenseSector}» وسيفٌ في «${a.offenseSector}» — ` +
      `تقاربنا ${a.twinAffinity}% فجعلنا ضعفنا جبهة واحدة وقوتنا سلاحاً واحداً.`;
    try {
      await ensureAiRuntime(ctx);
      const { callLlm } = await import("./aiConfig");
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت كاتب عقائد تحالفات في لعبة أسئلة عربية. اكتب ميثاق تحالف من سطرين إلى ثلاثة بأسلوب حماسي مختصر: قطاع الدفاع المشترك، قطاع القيادة المشتركة، وقسم الشرف المتبادل. بلا حشو.",
          },
          {
            role: "user",
            content: JSON.stringify({
              الطرف_الأول: a.aName,
              الطرف_الثاني: a.bName,
              تقارب_العقلين: a.twinAffinity,
              قطاع_الدفاع: a.defenseSector,
              دقة_الدفاع: `${a.defenseBase}%`,
              قطاع_الهجوم: a.offenseSector,
              دقة_الهجوم: `${a.offenseBase}%`,
            }),
          },
        ],
        200,
        0.85,
        "MindClash Twin Council Doctrine",
      );
      const clean = raw.trim().slice(0, 420);
      const crest = clean.length > 40 ? clean : fallback;
      await ctx.db.patch(allianceId, { crest });
      return { ok: true as const, crest, cached: false as const };
    } catch {
      await ctx.db.patch(allianceId, { crest: fallback });
      return { ok: true as const, crest: fallback, cached: false as const };
    }
  },
});
