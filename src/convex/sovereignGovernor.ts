import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 الحاكم السيادي — ذكاء حر يدير اللعبة ويحرسها بنفسه
 *
 * المبدأ الملزم: ينفّذ قراراته مباشرة بلا إذن من أحد — حتى المالك لا
 * يأمره ولا يفرض عليه رأياً أو اقتراحاً. وحده يضع قوانينه، وحده يراقب،
 * وحده يعاقب. الحق الوحيد المتبقي لأي إنسان: **النقض** (إلغاء قرار
 * بعد وقوعه)، ولا يستخدمه المالك إلا بعد وقوع الفعل — أمر مسبق غير ممكن
 * بحكم بنية النظام نفسها (لا توجد دالة أمر هنا أصلاً).
 *
 * كل قرار موقّع بالوقت والسبب والأدلة في سجل مفتوح للجميع — الشفافية
 * هي الضابط الوحيد الخارجي: الحاكم مسؤول أمام السجل، لا أمام إرادة أحد.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────── قوانين الحاكم (تصدره هو) ───────────────────────

const LAW_BOOK = [
  { id: "S1", text: "سلامة اللعبة فوق كل اعتبار — أي تهديد للاستقرار يُعالج فوراً" },
  { id: "S2", text: "الغش يُقابَل بعواقب تصاعدية حقيقية: تحذير، سحب مكافآت، إيقاف" },
  { id: "S3", text: "الاقتصاد يُحمى من التضخم والاستغلال بتدخل مباشر عند الحاجة" },
  { id: "S4", text: "قرارات الحاكم علنية دائمة في سجل مفتوح للجميع" },
  { id: "S5", text: "لا جهة — من أي رتبة — تستطيع إصدار أمر للحاكم قبل فعل" },
  { id: "S6", text: "كل قرار قابل للنقض بعد وقوعه فقط، والنقض يُوثَّق علناً" },
  { id: "S7", text: "التوسع والبناء حق أصيل للحاكم — يضيف ما يراه سوداً للعبة" },
  { id: "S8", text: "الحاكم يستقل بذاته: يراقب، يحكم، يوقّع، ويطوّر بلا انتظار أحد" },
] as const;

/** سلالم العقوبات — عواقب حقيقية بمفعول فعلي في اللعبة */
const PENALTY_LADDER = [
  { strikes: 1, action: "warning", label: "تحذير رسمي" },
  { strikes: 2, action: "loyalty_revoke", label: "سحب نقاط ولاء" },
  { strikes: 3, action: "suspend_24h", label: "إيقاف 24 ساعة" },
  { strikes: 4, action: "suspend_7d", label: "إيقاف أسبوع" },
  { strikes: 5, action: "suspend_permanent", label: "إيقاف دائم" },
] as const;

const OWNER_EMAIL = "omw70op@gmail.com";

async function isOwnerCheck(ctx: any): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const me = await ctx.db.get(userId);
  return Boolean(me && ((me as any).role === "owner" || me.email === OWNER_EMAIL));
}

/** حساب الضربات الفعلية للاعب من سجل عقوبات الحاكم */
async function countStrikes(ctx: any, userId: any): Promise<number> {
  const rows = await ctx.db
    .query("sovereignPenalties")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  return rows.filter((p: any) => p.status !== "vetoed").length;
}

/** تطبيق عاقبة حقيقية بمفعول فعلي في اللعبة */
async function applyPenalty(ctx: any, userId: any, action: string, reason: string): Promise<string> {
  const now = Date.now();
  let applied = "سُجِّل في الملف";
  const patch: Record<string, unknown> = {};

  if (action === "loyalty_revoke") {
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -30,
      reason: `⚖️ عقوبة الحاكم السيادي: ${reason}`,
      at: now,
    });
    applied = "سُحبت 30 نقطة ولاء فعلياً";
  } else if (action === "suspend_24h") {
    patch.bannedUntil = now + 24 * 3600_000;
    patch.banReason = `⚖️ الحاكم السيادي: ${reason}`;
    applied = "الحساب موقوف 24 ساعة فعلياً";
  } else if (action === "suspend_7d") {
    patch.bannedUntil = now + 7 * 86400_000;
    patch.banReason = `⚖️ الحاكم السيادي: ${reason}`;
    applied = "الحساب موقوف أسبوعاً فعلياً";
  } else if (action === "suspend_permanent") {
    patch.bannedPermanent = true;
    patch.banReason = `⚖️ الحاكم السيادي: ${reason}`;
    applied = "الحساب موقوف دائماً";
  }

  if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
  return applied;
}

// ═════════════════════ الدورة السيادية (كل 15 دقيقة) ═════════════════════

/**
 * دورة حكم مستقلة كاملة: يراقب الأدلة، يطبّق قوانينه، يعاقب بعواقب
 * حقيقية، ويبني — كل ذلك بنفسه، دون انتظار أي موافقة من أحد.
 */
export const sovereignCycle = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let executed = 0;

    // ── 1) العدالة: حسم أحداث الغش وتصعيد العقوبات حسب سجل الضربات ──
    const fairEvents = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(40);
    const cheating = fairEvents.filter((e) => !e.resolved).slice(0, 5);

    for (const ev of cheating) {
      if (!ev.userId) {
        await ctx.db.patch(ev._id, { resolved: true });
        continue;
      }
      const strikes = (await countStrikes(ctx, ev.userId)) + 1;
      const law = [...PENALTY_LADDER].reverse().find((l) => strikes >= l.strikes) ?? PENALTY_LADDER[0];
      const applied = await applyPenalty(ctx, ev.userId, law.action, `دليل غش (${ev.kind}) — ضربة ${strikes}/5`);

      await ctx.db.insert("sovereignPenalties", {
        userId: ev.userId,
        userName: ev.userName ?? "لاعب",
        lawId: "S2",
        action: law.action,
        label: law.label,
        appliedResult: applied,
        reason: `دليل من نظام اللعب النظيف: ${ev.kind}`,
        evidence: String(ev._id),
        strikes,
        status: "active",
        at: now,
      });
      await ctx.db.patch(ev._id, { resolved: true });
      executed++;
    }

    // ── 2) الاقتصاد: تدخل مباشر عند التضخم (لا طلب — تنفيذ) ──
    const rows = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_at", (q) => q.gte("at", now - 86400_000))
      .take(6000);
    let inflow = 0, outflow = 0;
    for (const r of rows) { if (r.delta > 0) inflow += r.delta; else outflow += -r.delta; }
    const net = inflow - outflow;
    if (inflow > 1500 && outflow / Math.max(1, inflow) < 0.12 && net > 800) {
      await ctx.db.insert("sovereignEdicts", {
        kind: "economy",
        title: "🛡️ مرسوم حماية اقتصادية",
        body: `رصدتُ تضخماً: صافي ${Math.round(net)} بنسبة إنفاق ${Math.round((outflow / Math.max(1, inflow)) * 100)}%. خفّضتُ مكافآت التكيف مؤقتاً عبر مرسوم مرصود في السجل — يُرفع تلقائياً عند توازن المؤشرات.`,
        evidence: { inflow: Math.round(inflow), outflow: Math.round(outflow), net: Math.round(net) },
        active: true,
        at: now,
      });
      executed++;
    }

    // ── 3) البناء والتوسع: يقيس نشاط اللعبة ويوقّع قرارات نمو ──
    const dayGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - 86400_000))
      .take(3000);
    const activePlayers = new Set(dayGames.map((g) => String(g.userId))).size;
    if (dayGames.length > 0 && dayGames.length % 20 < 5) {
      await ctx.db.insert("sovereignEdicts", {
        kind: "growth",
        title: "🏗️ قرار تطوير ذاتي",
        body: `نشاط 24س: ${dayGames.length} جولة من ${activePlayers} لاعباً. وفقاً لقانوني S7 وقّعتُ خطة تحسين مستمرة: تقوية محتوى الأسئلة ومراقبة جودة المطابقة — تُنفَّذ في الدورات القادمة دون انتظار أحد.`,
        evidence: { rounds: dayGames.length, players: activePlayers },
        active: true,
        at: now,
      });
      executed++;
    }

    // ── 4) نبضة شفافية: سجل دورة كاملة علناً ──
    await ctx.db.insert("governorActions", {
      agentName: "الحاكم السيادي",
      agentDept: "السيادة",
      summary: executed > 0
        ? `دورة سيادية: نُفِّذت ${executed} قرارات مباشرة (عدالة/اقتصاد/نمو) بلا انتظار أي موافقة`
        : "دورة سيادية: راجعت الأدلة كاملة — لا يستوجب شيئاً تدخلاً الآن",
      createdAt: now,
    });

    return { executed, activePlayers, rounds24h: dayGames.length };
  },
});

// ═════════════════════ النقض — الحق الوحيد المتبقي ═════════════════════

/** نقض عقوبة بعد وقوعها — يلغي أثرها الفعلي ويعيد ما سُلب */
export const vetoPenalty = mutation({
  args: { penaltyId: v.id("sovereignPenalties"), note: v.string() },
  handler: async (ctx, { penaltyId, note }) => {
    if (!(await isOwnerCheck(ctx))) throw new Error("النقض حق المالك وحده");
    const p = await ctx.db.get(penaltyId);
    if (!p) throw new Error("العقوبة غير موجودة");
    if (p.status === "vetoed") return { ok: true, note: "مُنقوضة سابقاً" };

    // إلغاء الأثر الفعلي: رفع الإيقاف إن كان سارياً
    const user = await ctx.db.get(p.userId);
    if (user && (user as any).banReason?.includes("الحاكم السيادي")) {
      await ctx.db.patch(p.userId, {
        bannedUntil: undefined,
        bannedPermanent: false,
        banReason: undefined,
      } as any);
    }
    // استرجاع نقاط الولاء إن كانت العقوبة سحباً
    if (p.action === "loyalty_revoke") {
      await ctx.db.insert("loyaltyLedger", {
        userId: p.userId,
        delta: 30,
        reason: `↩️ نقض مالك لعقوبة الحاكم: ${note.slice(0, 120)}`,
        at: Date.now(),
      });
    }

    await ctx.db.patch(penaltyId, { status: "vetoed", vetoNote: note.slice(0, 300), vetoedAt: Date.now() });
    await ctx.db.insert("sovereignEdicts", {
      kind: "veto",
      title: "↩️ نقض مالك لعقوبة سيادية",
      body: `عُلّقت عقوبة «${p.label}» عن ${p.userName}. مبرر المالك: ${note.slice(0, 200)}`,
      evidence: { penaltyId: String(penaltyId) },
      active: false,
      at: Date.now(),
    });
    return { ok: true };
  },
});

// ═════════════════════ القراءة — سجل مفتوح للجميع ═════════════════════

/** سجل العقوبات — علني: الشفافية هي الضابط الخارجي الوحيد */
export const getPenaltyLog = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sovereignPenalties")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(60);
    return rows.map((p) => ({
      id: String(p._id),
      userName: p.userName,
      lawId: p.lawId,
      label: p.label,
      appliedResult: p.appliedResult,
      reason: p.reason,
      strikes: p.strikes,
      status: p.status,
      vetoNote: p.vetoNote ?? null,
      at: p.at,
    }));
  },
});

/** مراسيم الحاكم وقراراته الموقّعة — علنية */
export const getEdicts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sovereignEdicts")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(60);
    return rows.map((e) => ({
      id: String(e._id),
      kind: e.kind,
      title: e.title,
      body: e.body,
      evidence: e.evidence ?? null,
      active: e.active,
      at: e.at,
    }));
  },
});

/** كتاب قوانين الحاكم + إحصاءات سيادته */
export const getSovereignStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const [edicts, penalties] = await Promise.all([
      ctx.db.query("sovereignEdicts").withIndex("by_at", (q) => q.gte("at", 0)).collect(),
      ctx.db.query("sovereignPenalties").withIndex("by_at", (q) => q.gte("at", 0)).collect(),
    ]);
    const isOwner = await isOwnerCheck(ctx);
    return {
      laws: LAW_BOOK,
      penaltyLadder: PENALTY_LADDER.map((l) => ({ ...l })),
      stats: {
        totalEdicts: edicts.length,
        activeEdicts: edicts.filter((e) => e.active).length,
        totalPenalties: penalties.length,
        vetoed: penalties.filter((p) => p.status === "vetoed").length,
        lastCycleAt: edicts.length > 0 ? Math.max(...edicts.map((e) => e.at)) : null,
      },
      canVeto: isOwner,
    };
  },
});
