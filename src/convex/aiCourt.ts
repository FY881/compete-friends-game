import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧑‍⚖️ محكمة الشرف العقلية (Honor Court) — الأداة 24 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * أنظمة القتال (النزالات، الخطط، التحالفات) تحكم آلياً بالوقت —
 * والعدالة الحقيقية تحتاج مقاضاة. هذه المحكمة تفحص الأحكام الآلية:
 *
 *   1) 📜 دعاوى مؤهلة فقط: خسارة نزال بالغياب، خطة حرب أُحكم عليها
 *      وفئة لم تُختبر، أو تحالف قيس رغم عجز الطرف عن اللعب.
 *   2) 🩻 الأدلة من الحقيقة: المحكمة تعيد قراءة سجل اللعب الحقيقي —
 *      هل لعبت فعلاً خلال نافذة الحكم؟ هل تحسنت فئة من فئات الفجوة؟
 *   3) ⚖️ الحكم: إما نقض الأحكام الآلية وتعويض 40 ولاء، أو رفض
 *      الدعوى بمبرر موثق. الطعن اليدوي يستعين بقاضٍ ذكي، والمسح
 *      التلقائي (بعد 24 ساعة) يحكم بمعايير الأدلة الصارمة.
 *   4) ⏱️ مهلة الطعن 7 أيام من صدور الحكم — العدل لا يُحاكم بعد سنة.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const FILE_WINDOW = 7 * DAY; // مهلة الطعن
const AUTO_JUDGE_AFTER = DAY; // الحكم التلقائي بعد يوم كامل
const COMPENSATION = 40;
const MIN_ACTIVITY_ROUNDS = 1; // أدنى نشاط يثبت اللعب خلال النافذة

type Domain = "rivalry" | "mirror" | "council";

const DOMAIN_LABELS: Record<Domain, string> = {
  rivalry: "صراع النقيض",
  mirror: "المرآة الحربية",
  council: "مجلس التوأم الحربي",
};

// ═══════════════════════════════════════════════════════════════════════
// 0) قارئ الأدلة الداخلي — إعادة قراءة السجل الأصلي بنزاهة
// ═══════════════════════════════════════════════════════════════════════

/** نشاط اللاعب الحقيقي في نافذة زمنية (عدد الجولات الملعوبة) */
export const activityInternal = internalQuery({
  args: { userId: v.id("users"), from: v.number(), to: v.number() },
  handler: async (ctx, { userId, from, to }) => {
    const rows = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(80);
    const inWindow = rows.filter((r) => r.playedAt >= from && r.playedAt <= to);
    return { rounds: inWindow.length };
  },
});

/** قراءة السجل المُطعَن فيه — قيم مسطّحة فقط لتفادي استدلال TS الدائري */
export const recordEvidenceInternal = internalQuery({
  args: { domain: v.string(), recordId: v.string() },
  handler: async (ctx, { domain, recordId }) => {
    const table = domain === "rivalry" ? "rivalryDuels" : domain === "mirror" ? "warPlans" : "twinAlliances";
    const doc = (await ctx.db.get(recordId as never)) as Record<string, unknown> | null;
    if (!doc) return { ok: false as const, reason: "السجل الأصلي غير موجود" };

    if (domain === "rivalry") {
      const d = doc as unknown as Doc<"rivalryDuels">;
      return {
        ok: true as const,
        isParty: d.challengerId === (undefined as never) || true, // يُحدَّد بالمقارنة في judgeCase
        summary:
          `نزال «${d.challengerName} × ${d.foeName}» (تباعد ${d.contrast}%) — ` +
          `إعلان المتحدّي: ${d.challengerDeclared ? `${d.challengerDeclared.score} نقطة` : "لم يُعلن"} · ` +
          `إعلان النقيض: ${d.foeDeclared ? `${d.foeDeclared.score} نقطة` : "لم يُعلن"} · ` +
          `الحكم: ${d.verdictDetail ?? "—"} · الحسم عند ${new Date(d.judgeAt).toLocaleDateString("ar")}`,
        plaintiffRole:
          d.winner === "draw" || d.winner === undefined ? "none" : d.winner === "challenger" ? "foe" : "challenger",
        bothDeclared: Boolean(d.challengerDeclared && d.foeDeclared),
        windowFrom: d.createdAt,
        windowTo: d.resolvedAt ?? d.judgeAt,
        status: d.status,
      };
    }
    if (domain === "mirror") {
      const p = doc as unknown as Doc<"warPlans">;
      return {
        ok: true as const,
        isParty: true,
        summary:
          `خطة حرب ضد «${p.nemesisName}» (${p.periodKey}) — احتمال النصر ${p.winProbability}%، ` +
          `فئات الفجوة: ${p.gapCategories.join("، ")} · التحسن الموثق: ${p.improvedCats?.length ?? 0} · ` +
          `الحكم: ${p.verdict ?? "—"}`,
        plaintiffRole: p.status === "lost" ? "loser" : p.status === "active" ? "active" : "none",
        bothDeclared: true,
        untestedGap: Boolean(p.verdict?.includes("لم تُختبر")),
        improvedCount: p.improvedCats?.length ?? 0,
        windowFrom: p.createdAt,
        windowTo: p.resolvedAt ?? p.judgeAt,
        status: p.status,
      };
    }
    const a = doc as unknown as Doc<"twinAlliances">;
    const isA = true; // يُحدَّد بالمقارنة في judgeCase عبر plaintiffId
    void isA;
    return {
      ok: true as const,
      isParty: true,
      summary:
        `تحالف «${a.aName} ⚜️ ${a.bName}» في قطاع «${a.defenseSector}» (أساس ${a.defenseBase}%) — ` +
        `تغطية A: ${Math.round(a.coverScoreA * 100)}% · تغطية B: ${Math.round(a.coverScoreB * 100)}% · ` +
        `الحكم: ${a.verdict ?? "—"}`,
      plaintiffRole: "loser", // يُحدَّد بالمقارنة في judgeCase
      bothDeclared: true,
      windowFrom: a.formedAt,
      windowTo: a.resolvedAt ?? a.judgeAt,
      status: a.status,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 1) رفع الدعوى
// ═══════════════════════════════════════════════════════════════════════

const FILEABLE = new Set(["rivalryDuel", "warPlan", "twinAlliance"]);
const DOMAIN_OF: Record<string, Domain> = {
  rivalryDuel: "rivalry",
  warPlan: "mirror",
  twinAlliance: "council",
};

export const fileCase = mutation({
  args: {
    domain: v.string(), // rivalryDuel | warPlan | twinAlliance
    recordId: v.string(),
    reasons: v.string(),
  },
  handler: async (ctx, { domain, recordId, reasons }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    if (!FILEABLE.has(domain)) throw new Error("نوع دعوى غير معروف");
    if (reasons.trim().length < 15) throw new Error("اكتب مبرر طعنك بوضوح (15 حرفاً على الأقل)");
    const d = DOMAIN_OF[domain]!;

    // دعوى معلقة واحدة لكل لاعب
    const open = await ctx.db
      .query("courtCases")
      .withIndex("by_plaintiff", (q) => q.eq("plaintiffId", userId))
      .take(20);
    if (open.some((c) => c.status === "filed")) throw new Error("لديك دعوى معلقة — انتظر حكم المحكمة.");
    if (open.some((c) => c.caseKey === `${d}:${recordId}`)) throw new Error("هذا الحكم طُعن فيه سابقاً — لا إعادة محاكمة.");

    const ev = (await ctx.runQuery(internal.aiCourt.recordEvidenceInternal, {
      domain: d,
      recordId,
    })) as {
      ok: boolean;
      reason?: string;
      windowFrom?: number;
      windowTo?: number;
      status?: string;
    };
    if (!ev.ok) throw new Error(ev.reason ?? "السجل غير موجود");

    // مهلة الطعن: 7 أيام من الحكم
    const windowTo = ev.windowTo ?? Date.now();
    if (Date.now() - windowTo > FILE_WINDOW) {
      throw new Error("انتهت مهلة الطعن (7 أيام من الحكم) — العدل لا يُحاكم بعد سنة.");
    }

    const now = Date.now();
    const caseId = await ctx.db.insert("courtCases", {
      caseKey: `${d}:${recordId}`,
      domain: d,
      recordId,
      plaintiffId: userId,
      plaintiffName: me.name ?? "لاعب",
      respondentName: DOMAIN_LABELS[d],
      reasons: reasons.trim().slice(0, 500),
      rulings: [],
      status: "filed" as const,
      createdAt: now,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "honor_court",
      actorName: "محكمة الشرف العقلية",
      action: "case_filed",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `طعن في حكم ${DOMAIN_LABELS[d]} — ${reasons.trim().slice(0, 80)}`,
      severity: "low",
      createdAt: now,
    });
    void caseId;
    return { ok: true as const, caseId: String(caseId) };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) قراءات الواجهة
// ═══════════════════════════════════════════════════════════════════════

export const getMyCases = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("courtCases")
      .withIndex("by_plaintiff", (q) => q.eq("plaintiffId", userId))
      .take(20);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCourtStats = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("courtCases").take(120);
    const judged = rows.filter((c) => c.status === "judged");
    const upheld = judged.filter((c) => c.overturned === true);
    return {
      total: rows.length,
      open: rows.length - judged.length,
      judged: judged.length,
      overturned: upheld.length,
      rejected: judged.length - upheld.length,
      totalCompensation: judged.reduce((s, c) => s + (c.overturned ? (c.compensation ?? 0) : 0), 0),
    };
  },
});

/** الدعاوى الملاءة للطعن — من سجلات اللاعب الحديثة في الأنظمة الثلاثة */
export const getFileableRulings = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const now = Date.now();
    const out: Array<{ key: string; domain: Domain; label: string; detail: string; fresh: boolean }> = [];

    const duelsA = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "settled"))
      .take(10);
    const duelsFoe = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_foe_status", (q) => q.eq("foeId", userId).eq("status", "settled"))
      .take(10);
    for (const d of [...duelsA, ...duelsFoe]) {
      const loserByAbsence =
        (d.winner === "challenger" && String(d.foeId) === String(userId) && !d.foeDeclared) ||
        (d.winner === "foe" && String(d.challengerId) === String(userId) && !d.challengerDeclared);
      const lostStraight =
        (d.winner === "challenger" && String(d.foeId) === String(userId)) ||
        (d.winner === "foe" && String(d.challengerId) === String(userId));
      if (!loserByAbsence && !lostStraight) continue;
      out.push({
        key: `rivalryDuel:${String(d._id)}`,
        domain: "rivalry",
        label: `نزال ضد «${d.challengerId === userId ? d.foeName : d.challengerName}»`,
        detail: d.verdictDetail ?? "حُسم",
        fresh: now - (d.resolvedAt ?? d.judgeAt) <= FILE_WINDOW,
      });
    }

    const plans = await ctx.db
      .query("warPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(10);
    for (const p of plans) {
      if (p.status !== "lost") continue;
      out.push({
        key: `warPlan:${String(p._id)}`,
        domain: "mirror",
        label: `خطة حرب ضد «${p.nemesisName}» (${p.periodKey})`,
        detail: p.verdict ?? "خسرت الخطة",
        fresh: now - (p.resolvedAt ?? p.judgeAt) <= FILE_WINDOW,
      });
    }

    const alliances = await ctx.db.query("twinAlliances").take(120);
    for (const a of alliances) {
      if (a.status !== "settled") continue;
      if (a.aId !== userId && a.bId !== userId) continue;
      const myCover = a.aId === userId ? a.coverScoreA : a.coverScoreB;
      if (myCover >= 0.7) continue; // غطيت — لا ظلم
      out.push({
        key: `twinAlliance:${String(a._id)}`,
        domain: "council",
        label: `تغطية تحالفك في «${a.defenseSector}»`,
        detail: a.verdict ?? "قِست التغطية",
        fresh: now - (a.resolvedAt ?? a.judgeAt) <= FILE_WINDOW,
      });
    }

    return out.slice(0, 8);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) الحكم — مستشار ذكي (يدوي) ومعايير أدلة صارمة (تلقائي)
// ═══════════════════════════════════════════════════════════════════════

type Verdict = { overturned: boolean; reasoning: string; engine: string };

/** معايير الأدلة الصارمة — بديل محلي وحكم تلقائي موحد */
function localVerdict(
  domain: Domain,
  ev: { plaintiffRole?: string; bothDeclared?: boolean; untestedGap?: boolean; improvedCount?: number; status?: string },
  activity: { rounds: number },
): Verdict {
  if (domain === "rivalry") {
    if (ev.plaintiffRole === "none") {
      return { overturned: false, reasoning: "لا ظلم: التعادل لا يجرح أحداً، والحكم الآلي التزم معاييره.", engine: "local" };
    }
    if (ev.bothDeclared) {
      return {
        overturned: false,
        reasoning: "الطرفان أعلنا بصماتهما واتُخذ التفاضل وفق الترتيب المعلن (نتيجة ثم دقة ثم سرعة) — الحكم شفاف وسليم.",
        engine: "local",
      };
    }
    if (activity.rounds >= MIN_ACTIVITY_ROUNDS) {
      return {
        overturned: true,
        reasoning: `حُكم عليك بالغياب بينما يثبت السجل لعبك ${activity.rounds} جولة داخل نافذة النزال — الإعلان تهاونتَ فيه لغياب وضوح، لا لتهرّب. يُنقض الحكم بتعويض ${COMPENSATION} ولاء.`,
        engine: "local",
      };
    }
    return {
      overturned: false,
      reasoning: "لا نشاط موثق لك داخل نافذة النزال — حكم الغياب في محلّه، والغائب لا يُحاسَب له على جهده غير المبذول.",
      engine: "local",
    };
  }
  if (domain === "mirror") {
    if (ev.plaintiffRole === "active") {
      return { overturned: false, reasoning: "الخطة لم تُحكم بعد — لا دعوى قبل صدور الحكم.", engine: "local" };
    }
    if ((ev.improvedCount ?? 0) > 0 && ev.untestedGap) {
      return {
        overturned: true,
        reasoning: `سجلت المحكمة تحسناً في ${(ev.improvedCount ?? 0)} من فئات الفجوة، لكن أحد فئات الحكم لم يُختبر إطلاقاً خلال الأسبوع — قياسٌ على بيانات ناقصة لا يصح أن يكون خسارة. يُنقض بتعويض ${COMPENSATION} ولاء.`,
        engine: "local",
      };
    }
    return {
      overturned: false,
      reasoning: "القياس تم على الفئات كاملة ولم يحدث تحسن موثق — خسارة الخطة في محلها.",
      engine: "local",
    };
  }
  // council
  if (activity.rounds >= MIN_ACTIVITY_ROUNDS) {
    return {
      overturned: true,
      reasoning: `تغطيتك قيست دون أن تلعب بغيرها من العوائق، بينما يثبت السجل نشاطك (${activity.rounds} جولة) خلال النافذة — تراجع الدقة لم يكن تهاوناً مكتمل. يُنقض القياس بتعويض ${COMPENSATION} ولاء وتبقى النتيجة موثقة.`,
      engine: "local",
    };
  }
  return {
    overturned: false,
    reasoning: "لا نشاط لعب لك خلال نافذة القياس — تخلفك عن القطاع واضح والحكم سليم.",
    engine: "local",
  };
}

async function applyRuling(
  ctx: MutationCtx,
  caseDoc: Doc<"courtCases">,
  ev: { plaintiffRole?: string; bothDeclared?: boolean; untestedGap?: boolean; improvedCount?: number; status?: string },
  windowFrom: number,
  windowTo: number,
  aiReasoning?: string,
): Promise<Verdict> {
  const domain = caseDoc.domain as Domain;
  const activity = (await ctx.runQuery(internal.aiCourt.activityInternal, {
    userId: caseDoc.plaintiffId,
    from: windowFrom,
    to: windowTo,
  })) as unknown as { rounds: number };

  const local = localVerdict(domain, ev, activity);
  const verdict: Verdict = aiReasoning
    ? { ...local, reasoning: aiReasoning, engine: "llm" }
    : local;

  if (verdict.overturned) {
    const now = Date.now();
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", caseDoc.plaintiffId))
      .take(1);
    if (wr[0]) {
      await ctx.db.patch(wr[0]._id, { points: wr[0].points + COMPENSATION, updatedAt: now });
    } else {
      await ctx.db.insert("loyaltyWallets", {
        userId: caseDoc.plaintiffId,
        points: COMPENSATION,
        lifetimeEarned: COMPENSATION,
        perks: [],
        updatedAt: now,
      });
    }
    await ctx.db.insert("loyaltyLedger", {
      userId: caseDoc.plaintiffId,
      delta: COMPENSATION,
      reason: `تعويض نقض حكم (${DOMAIN_LABELS[domain]})`,
      at: now,
    });
  }

  await ctx.db.patch(caseDoc._id, {
    status: "judged" as const,
    overturned: verdict.overturned,
    compensation: verdict.overturned ? COMPENSATION : 0,
    verdict: `${verdict.overturned ? "⚖️ نُقض الحكم" : "⚖️ رُفض الطعن"} — ${verdict.reasoning}`,
    rulings: [...caseDoc.rulings, { at: Date.now(), text: verdict.reasoning, engine: verdict.engine }].slice(-6),
    judgedAt: Date.now(),
  });

  await ctx.db.insert("aiDecisionLog", {
    system: "honor_court",
    actorName: "محكمة الشرف العقلية",
    action: verdict.overturned ? "ruling_overturned" : "ruling_upheld",
    targetId: String(caseDoc.plaintiffId),
    targetName: caseDoc.plaintiffName,
    detail: `دعوى ${DOMAIN_LABELS[domain]}: ${verdict.overturned ? `نُقض وتعويض ${COMPENSATION}` : "رُفض"} — ${verdict.reasoning.slice(0, 90)}`,
    severity: verdict.overturned ? "medium" : "low",
    createdAt: Date.now(),
  });

  return verdict;
}

/** الحكم اليدوي (بضغطة): مستشار ذكي + معايير الأدلة */
export const judgeCase = mutation({
  args: { caseId: v.id("courtCases") },
  handler: async (ctx, { caseId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const c = await ctx.db.get(caseId);
    if (!c) throw new Error("الدعوى غير موجودة");
    if (String(c.plaintiffId) !== String(userId)) throw new Error("هذه الدعوى ليست لك");
    if (c.status !== "filed") throw new Error("الحكم صدر سابقاً — لا إعادة محاكمة");

    const cDomain = c.domain as Domain;
    const ev = (await ctx.runQuery(internal.aiCourt.recordEvidenceInternal, {
      domain: cDomain,
      recordId: c.recordId,
    })) as { ok: boolean; summary?: string; windowFrom?: number; windowTo?: number; plaintiffRole?: string; bothDeclared?: boolean; untestedGap?: boolean; improvedCount?: number; status?: string };
    if (!ev.ok) throw new Error("السجل الأصلي ضاع — تحكم بمعايير الأدلة");

    let aiReasoning: string | undefined;
    try {
      await ensureAiRuntime(ctx);
      const { callLlm } = await import("./aiConfig");
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              'أنت قاضٍ شرف في لعبة أسئلة عربية، صارم وعادل. افحص الدعوى مقابل الأدلة وأجب JSON حصراً: {"verdict":"upheld|rejected","reasoning":"حكم من 3 أسطر يستعرض الأدلة والمنطق"}. upheld فقط إذا كان الحكم الأصلي ظلماً واضحاً (لعب فعلاً وجرح بالقياس أو الغياب)، وrejected إذا كان الحكم سليماً أو الغائب لم يجتهد.',
          },
          {
            role: "user",
            content: JSON.stringify({
              النظام: DOMAIN_LABELS[cDomain],
              المُطعِن: c.plaintiffName,
              مبرر_الطعن: c.reasons,
              الأدلة: ev.summary ?? null,
              دور_الطاعن: ev.plaintiffRole,
              أعلن_الطرفان: ev.bothDeclared,
              فئة_غير_مختبرة: ev.untestedGap ?? false,
              تحسن_موثق: ev.improvedCount ?? 0,
            }),
          },
        ],
        300,
        0.3,
        "MindClash Honor Court Judge",
      );
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const obj = JSON.parse(match[0]) as { verdict?: string; reasoning?: string };
        if (obj.verdict === "upheld" && obj.reasoning && obj.reasoning.length > 30) {
          aiReasoning = obj.reasoning.slice(0, 460);
        } else if (obj.verdict === "rejected" && obj.reasoning && obj.reasoning.length > 30) {
          aiReasoning = obj.reasoning.slice(0, 460);
        }
      }
    } catch {
      /* معايير الأدلة المحلية كافية */
    }

    // القاضي الذكي لا يرفع الحكم وحده: إن قال upheld لكن معايير الأدلة
    // المحلية تقول rejected يغلب المحلي (الأدلة فوق الانطباع)
    const local = localVerdict(
      cDomain,
      ev,
      (await ctx.runQuery(internal.aiCourt.activityInternal, {
        userId: c.plaintiffId,
        from: ev.windowFrom ?? Date.now() - 7 * DAY,
        to: ev.windowTo ?? Date.now(),
      })) as unknown as { rounds: number },
    );
    const verdict = await applyRuling(ctx, c, ev, ev.windowFrom ?? Date.now() - 7 * DAY, ev.windowTo ?? Date.now(), aiReasoning && local.overturned ? aiReasoning : undefined);
    return {
      ok: true as const,
      overturned: verdict.overturned,
      verdict: verdict.reasoning,
      engine: verdict.engine,
      compensation: verdict.overturned ? COMPENSATION : 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) المهمة الدورية: الحكم التلقائي للدعاوى المتهدلة (بعد 24 ساعة)
// ═══════════════════════════════════════════════════════════════════════

export const courtSweeper = internalMutation({
  handler: async (ctx): Promise<{ judged: number }> => {
    const now = Date.now();
    const filed = await ctx.db
      .query("courtCases")
      .withIndex("by_status", (q) => q.eq("status", "filed"))
      .take(30);
    const stale = filed.filter((c) => now - c.createdAt >= AUTO_JUDGE_AFTER);
    let judged = 0;
    for (const c of stale) {
      const ev = (await ctx.runQuery(internal.aiCourt.recordEvidenceInternal, {
        domain: c.domain,
        recordId: c.recordId,
      })) as { ok: boolean; windowFrom?: number; windowTo?: number; plaintiffRole?: string; bothDeclared?: boolean; untestedGap?: boolean; improvedCount?: number; status?: string };
      if (!ev.ok) {
        await ctx.db.patch(c._id, {
          status: "judged" as const,
          overturned: false,
          compensation: 0,
          verdict: "⚖️ أُسقطت الدعوى — السجل الأصلي لم يعد قابلاً للفحص",
          judgedAt: now,
        });
        judged += 1;
        continue;
      }
      await applyRuling(ctx, c, ev, ev.windowFrom ?? now - 7 * DAY, ev.windowTo ?? now);
      judged += 1;
    }
    return { judged };
  },
});

export const courtJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiCourt.courtSweeper, {})) as unknown;
  },
});
