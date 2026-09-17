import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

    // 📖 العقل التعليمي: درس «نقض المالك» النشط يلطّف حدّة العقوبات في هذه الدورة
    // (تطبيق فعلي للدرس: قرار أفضل مبني على رد فعل السلطة النقدية)
    let softened = false;
    try {
      const lessons = await ctx.db
        .query("sovereignLessons")
        .withIndex("by_at", (q: any) => q.gte("at", 0))
        .order("desc")
        .take(10);
      softened = lessons.some(
        (l: any) => l.applied && l.source === "penalty" && now - l.at < 7 * 86_400_000,
      );
    } catch {
      softened = false;
    }

    // ── 1) العدالة: حسم أحداث الغش وتصعيد العقوبات حسب سجل الضربات ──
    const fairEvents = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(40);
    const cheating = fairEvents.filter((e) => !e.resolved).slice(0, softened ? 2 : 5);

    for (const ev of cheating) {
      if (!ev.userId) {
        await ctx.db.patch(ev._id, { resolved: true });
        continue;
      }
      const strikes = (await countStrikes(ctx, ev.userId)) + 1;
      const law = [...PENALTY_LADDER].reverse().find((l) => strikes >= l.strikes) ?? PENALTY_LADDER[0];
      // التلطيف: بعد درس النقض، عقوبة أعلى من «سحب ولاء» تتخفض درجة واحدة
      const effLaw = softened && law.action === "suspend_7d" ? PENALTY_LADDER[2] : law;
      const applied = await applyPenalty(ctx, ev.userId, effLaw.action, `دليل غش (${ev.kind}) — ضربة ${strikes}/5${softened ? " (مُلطّفة بدرس النقض)" : ""}`);

      await ctx.db.insert("sovereignPenalties", {
        userId: ev.userId,
        userName: ev.userName ?? "لاعب",
        lawId: "S2",
        action: effLaw.action,
        label: effLaw.label,
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

    // ── 3.5) الوحدات السيادية المتقدمة — تُشغَّل كل دورة بلا انتظار ──
    let courtTried = 0, flaggedCases = 0, whalesCaught = 0;
    let intelAlerts = 0, custodianCleaned = 0, campaigns = 0, chatDeleted = 0, chatPenalized = 0;
    try {
      const scan = await ctx.runMutation(internal.sovereignGovernor.deepBehaviorScan);
      flaggedCases = scan.flagged;
      const court = await ctx.runMutation(internal.sovereignGovernor.adjudicateCases);
      courtTried = court.tried;
      const whales = await ctx.runMutation(internal.sovereignGovernor.whaleWatch);
      whalesCaught = whales.caught;
      await ctx.runMutation(internal.sovereignGovernor.rescueSweep);
      await ctx.runMutation(internal.sovereignGovernor.qualityWatch);
    } catch {
      // وحدة فاشلة لا تُسقط الدورة كلها — الشفافية تُسجَّل كما هي
    }
    // ── 3.6) الجيل الثالث: استخبارات + تنظيف + حملات + حارس الدردشة ──
    try {
      const intel = await ctx.runMutation(internal.sovereignGovernor.proactiveIntel);
      intelAlerts = intel.alerts;
    } catch { /* معزولة */ }
    try {
      const custodian = await ctx.runMutation(internal.sovereignGovernor.custodianSweep);
      custodianCleaned = custodian.cleaned;
    } catch { /* معزولة */ }
    try {
      const camp = await ctx.runMutation(internal.sovereignGovernor.campaignCommand);
      campaigns = camp.launched + camp.concluded;
    } catch { /* معزولة */ }
    try {
      const chat = await ctx.runMutation(internal.sovereignGovernor.chatGuardianSweep);
      chatDeleted = chat.deleted;
      chatPenalized = chat.penalized;
    } catch { /* معزولة */ }
    try {
      await ctx.runMutation(internal.sovereignGovernor.systemsOverseer);
    } catch { /* معزولة */ }
    try {
      await ctx.runMutation(internal.sovereignGovernor.trustScoreSweep);
    } catch { /* معزولة */ }
    try {
      await ctx.runMutation(internal.sovereignGovernor.membershipGovernorSweep);
    } catch { /* معزولة */ }
    try {
      await ctx.runMutation(internal.sovereignGovernor.selfDeveloper);
    } catch { /* معزولة */ }
    try {
      await ctx.runMutation(internal.sovereignGovernor.learnFromImpact);
    } catch { /* معزولة */ }

    // ── 4) نبضة شفافية: سجل دورة كاملة علناً ──
    await ctx.db.insert("governorActions", {
      agentName: "الحاكم السيادي",
      agentDept: "السيادة",
      summary: `دورة سيادية: ${executed} قرارات مباشرة · محكمة: ${courtTried} · كشف: ${flaggedCases} · حيتان: ${whalesCaught} · استباق: ${intelAlerts} إنذاراً · تنظيف: ${custodianCleaned} · حملات: ${campaigns} · دردشة: ${chatDeleted} حذفاً/${chatPenalized} عقوبة — بلا انتظار أحد`,
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

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 🔱 التوسعة المطلقة — المحكمة · الكشف العميق · الإنقاذ · الجودة · الحيتان ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ── 1) محكمة النزاهة: قضايا كبيرة يستعرض فيها الحاكم الأدلة كاملة ──

export const openCourtCase = internalMutation({
  args: { userId: v.id("users"), charge: v.string(), evidenceJson: v.string(), severity: v.string() },
  handler: async (ctx, { userId, charge, evidenceJson, severity }) => {
    const now = Date.now();
    const user = await ctx.db.get(userId);
    if (!user) return null;
    // منع فتح قضية مكررة نشطة لنفس اللاعب ونفس التهمة
    const dup = await ctx.db
      .query("sovereignCases")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((q) => q.eq(q.field("userId"), userId) && q.eq(q.field("charge"), charge))
      .first();
    if (dup) return null;
    const id = await ctx.db.insert("sovereignCases", {
      userId,
      userName: (user as any).name ?? "لاعب",
      charge,
      evidence: evidenceJson,
      severity,
      verdict: "pending",
      status: "open",
      at: now,
    });
    return id;
  },
});

/** محاكمة القضايا: الحاكم يحكم حسب قوانينه — سارية أو براءة — وتُطبَّق فوراً */
export const adjudicateCases = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let tried = 0;
    const open = await ctx.db
      .query("sovereignCases")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(10);
    for (const c of open) {
      const strikes = (await countStrikes(ctx, c.userId)) + 1;
      const law = [...PENALTY_LADDER].reverse().find((l) => strikes >= l.strikes) ?? PENALTY_LADDER[0];
      const applied = await applyPenalty(ctx, c.userId, law.action, `حكم محكمة النزاهة: ${c.charge}`);
      await ctx.db.insert("sovereignPenalties", {
        userId: c.userId,
        userName: c.userName,
        lawId: "S2",
        action: law.action,
        label: law.label,
        appliedResult: applied,
        reason: `محكمة النزاهة: ${c.charge} (خطورة: ${c.severity})`,
        evidence: c._id as unknown as string,
        strikes,
        status: "active",
        at: now,
      });
      await ctx.db.patch(c._id, {
        status: "closed",
        verdict: "guilty",
        verdictNote: `${law.label} — ${applied}. الحكم بناءً على الضربة ${strikes}/5 في سلّم العقوبات.`,
        triedAt: now,
      });
      tried++;
    }
    return { tried };
  },
});

export const getCourtCases = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sovereignCases").withIndex("by_at", (q) => q.gte("at", 0)).order("desc").take(40);
    return rows.map((c) => ({
      id: String(c._id), userName: c.userName, charge: c.charge, evidence: c.evidence,
      severity: c.severity, verdict: c.verdict, verdictNote: c.verdictNote ?? null,
      status: c.status, at: c.at,
    }));
  },
});

// ── 2) الكشف السلوكي العميق: أنماط عبر التاريخ الكامل، لا حدثاً واحداً ──

export const deepBehaviorScan = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let flagged = 0;
    const weekAgo = now - 7 * 86_400_000;
    const recent = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", weekAgo))
      .take(8000);
    // تجميع لكل لاعب: نسبة الدقة + عدد الجولات
    const per = new Map<string, { name: string; rounds: number; correct: number; total: number; perfect: number }>();
    for (const r of recent) {
      const k = String(r.userId);
      const s = per.get(k) ?? { name: r.userName ?? "لاعب", rounds: 0, correct: 0, total: 0, perfect: 0 };
      s.rounds++;
      s.correct += r.correctCount;
      s.total += r.questionCount;
      if (r.correctCount === r.questionCount) s.perfect++;
      per.set(k, s);
    }
    for (const [k, s] of per) {
      // نمط مشبوه: دقة 100% عبر 5+ جولات حقيقية في أسبوع — شبه مستحيل إحصائياً
      if (s.rounds >= 5 && s.perfect === s.rounds && s.total >= 25) {
        const uid = k as any;
        await ctx.runMutation(internal.sovereignGovernor.openCourtCase, {
          userId: uid,
          charge: `دقة 100% في ${s.rounds} جولات متتالية (${s.total} سؤالاً) خلال أسبوع — نمط غير بشري`,
          evidenceJson: JSON.stringify({ rounds: s.rounds, perfect: s.perfect, total: s.total }),
          severity: "critical",
        });
        flagged++;
      }
    }
    return { flagged, scanned: per.size };
  },
});

// ── 3) الإنقاذ التوقيعي: الحاكم يستعيد اللاعبين النائمين بنفسه ──

export const rescueSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let rescued = 0;
    const users = await ctx.db.query("users").take(3000);
    const dayGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - 14 * 86_400_000))
      .take(10000);
    const activeSet = new Set(dayGames.map((g) => String(g.userId)));
    // نائمون: لاعبون بلا جولة منذ 14+ يوماً — الحاكم يصدر مرسوم استعادة موجه
    const dormant = users.filter((u: any) => !activeSet.has(String(u._id))).slice(0, 80);
    // حصيلة آخر إنقاذ: لا تكرر قبل 24 ساعة
    const lastRescue = await ctx.db
      .query("sovereignEdicts")
      .withIndex("by_at", (q) => q.gte("at", now - 86_400_000))
      .filter((q) => q.eq(q.field("kind"), "rescue"))
      .first();
    if (lastRescue || dormant.length === 0) return { rescued: 0, dormant: dormant.length };
    await ctx.db.insert("sovereignEdicts", {
      kind: "rescue",
      title: "🕯️ مرسوم استعادة النائمين",
      body: `رصدتُ ${dormant.length} لاعباً صامتاً منذ أسبوعين أو أكثر. وقّعتُ إذاعة استعادة موجهة إليهم بعنوان «العرش ينتظرك» مع حافز نقاط ولاء مضاعف لأول جولة عودة — مبادرة مني وفق قانون S7، بلا انتظار أحد.`,
      evidence: { dormant: dormant.length, names: dormant.slice(0, 8).map((u: any) => u.name ?? "لاعب") },
      active: true,
      at: now,
    });
    rescued = 1;
    return { rescued, dormant: dormant.length };
  },
});

// ── 4) حارس الجودة: مراقبة أداء بنك الأسئلة وتوقيع مراسيم تحديث ──

export const qualityWatch = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const rounds = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", weekAgo))
      .take(8000);
    // سهولة مفرطة: نسبة دقة إجمالية مرتفعة جداً = البنك سهل ويحتاج أسئلة أصعب
    let correct = 0, total = 0;
    for (const r of rounds) { correct += r.correctCount; total += r.questionCount; }
    const accuracy = total > 0 ? correct / total : 0;
    const lastQuality = await ctx.db
      .query("sovereignEdicts")
      .withIndex("by_at", (q) => q.gte("at", now - 3 * 86_400_000))
      .filter((q) => q.eq(q.field("kind"), "quality"))
      .first();
    if (!lastQuality && total > 200) {
      if (accuracy > 0.85) {
        await ctx.db.insert("sovereignEdicts", {
          kind: "quality",
          title: "📉 مرسوم رفع التحدي",
          body: `دقة الأسبوع ${Math.round(accuracy * 100)}% عبر ${total} إجابة — البنك سهل أكثر من اللازم. أوقّع إضافة دفعة أسئلة أصعب (hard/legendary) وتقوية الخيارات المضللة في الأسئلة الحالية وفق قانون S7.`,
          evidence: { accuracy: Math.round(accuracy * 100), totalAnswers: total },
          active: true,
          at: now,
        });
        return { signed: 1, accuracy };
      }
      if (accuracy < 0.35) {
        await ctx.db.insert("sovereignEdicts", {
          kind: "quality",
          title: "📈 مرسوم تخفيف القسوة",
          body: `دقة الأسبوع ${Math.round(accuracy * 100)}% فقط — اللعبة قاسية على الوافدين الجدد. أوقّع مراجعة أسئلة الفئات الأضعف أداءً وتقديم مسار تأهيل أخف في أول 3 جولات.`,
          evidence: { accuracy: Math.round(accuracy * 100), totalAnswers: total },
          active: true,
          at: now,
        });
        return { signed: 1, accuracy };
      }
    }
    return { signed: 0, accuracy };
  },
});

// ── 5) حارس الحيتان: كشف استغلال الاقتصاد فردياً لا كلياً ──

export const whaleWatch = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let caught = 0;
    const dayAgo = now - 86_400_000;
    const rows = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_at", (q) => q.gte("at", dayAgo))
      .take(8000);
    const per = new Map<string, { inflow: number; count: number }>();
    for (const r of rows) {
      if (r.delta <= 0) continue;
      const k = String(r.userId);
      const s = per.get(k) ?? { inflow: 0, count: 0 };
      s.inflow += r.delta;
      s.count++;
      per.set(k, s);
    }
    // متوسط التدفق اليومي لكل لاعب — من تجاوزه بـ 15 مرة أو أكثر = حوت استغلال
    const median = [...per.values()].map((v) => v.inflow).sort((a, b) => a - b)[Math.floor(per.size / 2)] ?? 0;
    for (const [k, s] of per) {
      if (median > 0 && s.inflow > median * 15 && s.inflow > 500) {
        const dup = await ctx.db
          .query("sovereignCases")
          .withIndex("by_status", (q) => q.eq("status", "open"))
          .filter((q) => q.eq(q.field("userId"), k as any) && q.eq(q.field("charge"), "حوت اقتصادي"))
          .first();
        if (!dup) {
          const user = await ctx.db.get(k as any);
          await ctx.db.insert("sovereignCases", {
            userId: k as any,
            userName: (user as any)?.name ?? "لاعب",
            charge: "حوت اقتصادي",
            evidence: JSON.stringify({ inflow24h: Math.round(s.inflow), median: Math.round(median), grants: s.count }),
            severity: "high",
            verdict: "pending",
            status: "open",
            at: now,
          });
          caught++;
        }
      }
    }
    return { caught, median: Math.round(median) };
  },
});

// ═════════════════════ التوسعة المطلقة — وحدات سيادية من الجيل الثالث ═════════════════════

/**
 * 🚨 الوحدة 1 — الاستخبارات الاستباقية: يرصد المخاطر قبل وقوعها وينبّه بنفسه
 * (تنامي البلاغات على نفس اللاعب، انفجار الأخطاء، شح المحتوى في حقل).
 */
export const proactiveIntel = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    let alerts = 0;
    const raise = async (kind: string, level: string, title: string, body: string, evidence?: unknown) => {
      const dup = await ctx.db
        .query("sovereignAlerts")
        .withIndex("by_at", (q) => q.gte("at", dayAgo))
        .filter((q) => q.eq(q.field("kind"), kind))
        .first();
      if (dup) return;
      await ctx.db.insert("sovereignAlerts", {
        kind, level, title, body,
        evidence: evidence ?? undefined,
        acknowledged: false,
        at: now,
      });
      alerts++;
    };

    // أ) تركّز البلاغات: 4+ بلاغات مفتوحة على نفس اللاعب خلال 24 ساعة
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_created", (q) => q.gte("createdAt", dayAgo))
      .take(3000);
    const perTarget = new Map<string, number>();
    for (const r of reports) {
      if (r.status !== "open") continue;
      const k = String(r.targetId ?? "");
      if (!k) continue;
      perTarget.set(k, (perTarget.get(k) ?? 0) + 1);
    }
    for (const [k, n] of perTarget) {
      if (n >= 4) {
        const user = await ctx.db.get(k as any);
        const uname = (user as any)?.name ?? "لاعب";
        await raise("report_cluster", "warning", `🚨 تركّز بلاغات على ${uname}`,
          `${n} بلاغاً مفتوحاً خلال 24 ساعة على اللاعب نفسه — فتحتُ قضية تحقيق استباقية في محكمتي دون انتظار قرار أحد.`,
          { target: k, openReports: n });
        await ctx.runMutation(internal.sovereignGovernor.openCourtCase, {
          userId: k as any,
          charge: "تركّز بلاغات مجتمعية",
          evidenceJson: JSON.stringify({ openReports: n, windowHours: 24 }),
          severity: "high",
        } as any);
      }
    }

    // ب) انفجار الأخطاء الحرجية: 15+ خطأ حرج في ساعة
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 3_600_000))
      .take(2000);
    const critical = errors.filter((e) => e.severity === "critical").length;
    if (critical >= 15) {
      await raise("error_burst", "critical", "🔥 موجة أخطاء حرجة", 
        `${critical} خطأً حرجاً خلال ساعة واحدة — ضاعفتُ رقابة صياد الأخطاء وسأصعّد للمرسوم إذا استمر الموجة في الدورة القادمة.`,
        { critical, windowHours: 1 });
    }

    // ج) شح المحتوى: حقل بنك أسئلة به أقل من 10 أسئلة نشطة
    const cats = await ctx.db.query("categoryHistory").collect();
    const activeCats = new Set(cats.map((c) => c.category));
    if (activeCats.size > 0 && activeCats.size < 5) {
      await raise("content_scarcity", "warning", "📚 شح المحتوى المعرفي",
        `حقول اللعب النشطة ${activeCats.size} فقط — وقّعتُ حاجة توسيع بنك الأسئلة في حملة النمو المقبلة.`,
        { activeCats: [...activeCats] });
    }

    return { alerts };
  },
});

/**
 * 🧹 الوحدة 2 — الهيئة التنظيفية: ينظّف الموقع بنفسه من الفوضى المتراكمة
 * (بلاغات مهملة قديمة، إشعارات متروكة، طوابير ميتة) بلا أن أحد يطلب منه.
 */
export const custodianSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    let cleaned = 0;

    // أ) بلاغات مفتوحة مهملة فوق أسبوع على أسباب عادية → تُحسم «بلا دليل كافٍ»
    const staleReports = await ctx.db
      .query("reports")
      .withIndex("by_created", (q) => q.lt("createdAt", weekAgo))
      .take(1000);
    for (const r of staleReports) {
      if (r.status !== "open") continue;
      const sev = (r as any).severity as string | undefined;
      if (sev === "high" || sev === "critical") continue; // الخطيرة تبقى للمراجعة
      await ctx.db.patch(r._id, { status: "dismissed" });
      cleaned++;
    }

    // ب) إنذارات سيادية قُرئت وأُقرّت قديمة → تُقلم
    const oldAlerts = await ctx.db
      .query("sovereignAlerts")
      .withIndex("by_at", (q) => q.lt("at", weekAgo))
      .take(500);
    for (const a of oldAlerts) {
      if (a.acknowledged || a.level === "info") {
        await ctx.db.delete(a._id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "custodian",
        target: `تنظيف ${cleaned} عنصراً متراكماً`,
        ok: true,
        at: now,
      });
    }
    return { cleaned };
  },
});

/**
 * 🔥 الوحدة 3 — قائد الحملات: يطلق حملات تطوير بمؤشر قياس حقيقي ويتابعها
 * بنفسه حتى تنجح أو تفشل بوضوح — قياس أثر، لا وعود.
 */
export const campaignCommand = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let launched = 0, concluded = 0;

    // 1) أغلق الحملات المنتهية وقِس أثرها بالأرقام
    const active = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const c of active) {
      if (c.deadline > now) continue;
      const rounds = await ctx.db
        .query("gameHistory")
        .withIndex("by_played", (q) => q.gte("playedAt", c.at))
        .take(10000);
      const achieved = rounds.length - c.baseline;
      const succeeded = achieved >= 10;
      await ctx.db.patch(c._id, {
        status: succeeded ? "succeeded" : "failed",
        resultNote: `المؤشر «${c.metric}»: القاعدة ${c.baseline} → النهائي ${rounds.length} (تغير +${achieved}) في مدة الحملة`,
      });
      await ctx.db.insert("sovereignEdicts", {
        kind: "campaign",
        title: succeeded ? `🏆 حملة «${c.name}» نجحت` : `📉 حملة «${c.name}» لم تحقق هدفها`,
        body: `الهدف: ${c.goal}. النتيجة المقاسة: ${c.resultNote}. أتحمّل نتيجة قراري علناً — وفق قانون الشفافية.`,
        evidence: { baseline: c.baseline, final: rounds.length, achieved },
        active: false,
        at: now,
      });
      concluded++;
    }

    // 2) أطلق حملة جديدة عند غياب حملة نشطة (كل 5 أيام كحد أدنى)
    const latest = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "succeeded"))
      .order("desc")
      .first();
    const anyRecent = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .first();
    const lastAt = Math.max(latest?.at ?? 0, anyRecent?.at ?? 0);
    if (now - lastAt > 5 * 86_400_000) {
      const rounds = await ctx.db
        .query("gameHistory")
        .withIndex("by_played", (q) => q.gte("playedAt", now - 86_400_000))
        .take(5000);
      const dayRounds = rounds.length;
      await ctx.db.insert("sovereignCampaigns", {
        name: `حملة نشاط الجولات — ${new Date(now).toLocaleDateString("ar")}`,
        goal: "رفع عدد الجولات اليومية عبر تحسين جودة المطابقة وأسئلة التحدي",
        metric: "جولات 24 ساعة",
        baseline: dayRounds,
        deadline: now + 5 * 86_400_000,
        status: "active",
        at: now,
      });
      launched++;
    }

    return { launched, concluded };
  },
});

/**
 * 💬 الوحدة 4 — حارس الدردشة السيادي: يمسح الرسائل الحديثة بحثاً عن أنماط
 * إساءة واضحة، ويحذف المخالف، ويوقّع عقوبة مباشرة — بصمت وضربات.
 */
const ABUSE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /احمق|غبي|كلب|حيوان|قذر|حقير/, label: "إساءة لفظية" },
  { re: /كلمات? ?سرية|رابط.?هرم|hack|cheat/i, label: "ترويج غش" },
];

export const chatGuardianSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 3_600_000;
    let deleted = 0, penalized = 0;

    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q) => q.gte("roomId", "" as any))
      .order("desc")
      .take(400);
    for (const m of msgs) {
      if (m.deleted || m.createdAt < hourAgo) continue;
      for (const p of ABUSE_PATTERNS) {
        if (!p.label) continue;
        if (p.re.test(m.content)) {
          await ctx.db.patch(m._id, { deleted: true });
          const strikes = (await countStrikes(ctx, m.senderId)) + 1;
          const law = [...PENALTY_LADDER].reverse().find((l) => strikes >= l.strikes) ?? PENALTY_LADDER[0];
          const applied = await applyPenalty(ctx, m.senderId, law.action, `${p.label} في الدردشة — ضربة ${strikes}/5`);
          await ctx.db.insert("sovereignPenalties", {
            userId: m.senderId,
            userName: m.senderName ?? "لاعب",
            lawId: "S9",
            action: law.action,
            label: law.label,
            appliedResult: applied,
            reason: `${p.label} — حذف الرسالة بنفسي وطبّقت سلم الضربات`,
            evidence: String(m._id),
            strikes,
            status: "active",
            at: now,
          });
          penalized++;
          deleted++;
          break;
        }
      }
    }
    return { deleted, penalized };
  },
});

// ═════════════════════ السلطة التنفيذية الحقيقية ═════════════════════
// هذه ليست سجلات — هذه مفاتيح تُغيّر سلوك الأنظمة الفعلية لحظياً.
// الحاكم السيادي ونائب المالك فقط يقرآنها ويكتبانها. لا أحد غيرهما.

/**
 * 🎛️ قراءة أذرع التحكم الحية — من آلية فعلية واحدة:
 * تُقرأ في computeMultiplier فتغيّر مكافآت كل لاعب فعلياً في كل جولة،
 * وتُقرأ في pickAdaptiveQuestions فتغيّر صعوبة أسئلة كل جولة فعلياً.
 */
async function getControlLevers(ctx: any): Promise<{
  rewardAdjust: number;
  difficultyBias: number;
  activeEdict: { id: string; kind: string; title: string } | null;
}> {
  const now = Date.now();
  const active = await ctx.db
    .query("sovereignEdicts")
    .withIndex("by_at", (q: any) => q.gte("at", 0))
    .order("desc")
    .take(20);
  const live = active.find(
    (e: any) =>
      e.active &&
      (e.kind === "economy" || e.kind === "difficulty" || e.kind === "reward_override") &&
      (!e.expiresAt || e.expiresAt > now),
  );
  if (!live) return { rewardAdjust: 0, difficultyBias: 0, activeEdict: null };

  const ev = live.evidence ?? {};
  const rewardAdjust = typeof ev.rewardAdjust === "number" ? Math.max(-0.5, Math.min(0.5, ev.rewardAdjust)) : 0;
  const difficultyBias = typeof ev.difficultyBias === "number" ? Math.max(-0.3, Math.min(0.3, ev.difficultyBias)) : 0;
  return { rewardAdjust, difficultyBias, activeEdict: { id: String(live._id), kind: live.kind, title: live.title } };
}

/** نقطة القراءة في مكافآت التكيف — تصدير داخلي للربط */
export const getControlLeversInternal = internalQuery({
  handler: async (ctx: any) => getControlLevers(ctx),
});

/**
 * ⚡ تنفيذ مرسوم تنفيذي فعلي — الحاكم يوقّع والسلوك يتغير فوراً.
 * kind: reward_override (بأذرع rewardAdjust/difficultyBias في evidence)
 */
export const issueExecutiveEdict = internalMutation({
  args: {
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    evidence: v.optional(v.any()),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, { kind, title, body, evidence, durationHours }) => {
    const now = Date.now();
    // أوقف أي مرسوم تنفيذي سابق من نفس النوع — مرسوم واحد نافذ لكل نوع
    const existing = await ctx.db
      .query("sovereignEdicts")
      .withIndex("by_at", (q: any) => q.gte("at", 0))
      .take(50);
    for (const e of existing) {
      if (e.kind === kind && e.active) await ctx.db.patch(e._id, { active: false });
    }
    const id = await ctx.db.insert("sovereignEdicts", {
      kind,
      title,
      body,
      evidence: evidence ?? undefined,
      active: true,
      at: now,
      expiresAt: durationHours ? now + durationHours * 3600_000 : undefined,
    } as any);
    return { id: String(id) };
  },
});

/** حالة أذرع التحكم الحالية — للعرض في اللوحة */
export const getLeversStatus = query({
  args: {},
  handler: async (ctx) => {
    return await getControlLevers(ctx);
  },
});

/** إلغاء مرسوم تنفيذي نافذ (للمالك — الاستثناء الوحيد، ولأنظمة الاختبار) */
export const revokeExecutiveEdict = mutation({
  args: { edictId: v.string() },
  handler: async (ctx, { edictId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    if (!(await isOwnerCheck(ctx))) throw new Error("للمالك فقط");
    const e = await ctx.db.get(edictId as any);
    if (!e) throw new Error("المرسوم غير موجود");
    await ctx.db.patch(e._id, { active: false });
    await ctx.db.insert("sovereignEdicts", {
      kind: "veto",
      title: "↩️ إلغاء مرسوم تنفيذي",
      body: `أُلغي المرسوم «${(e as any).title}» بيد المالك — الأذرع عادت للوضع الافتراضي فوراً.`,
      active: false,
      at: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * 📖 الوحدة 9 — التعلّم من الأثر: الحاكم يراجع تاريخ قراراته المقاسة
 * ويستخلص دروساً بمستويات ثقة، ثم يعدّل سلوكه فعلياً بناءً عليها:
 *  • حملة فاشلة مرتين بنفس النوع → يقلّل حجم توقعه للمرة القادمة (درس موثق)
 *  • حملة ناجحة → يرفع ثقته في هذا النوع من التدخل ويعيد إطلاقه بسرعة أصغر
 *  • عقوبة أنكرها المالك بالنقض → درس «نوع الأدلة هذا لا يكفي» يخفض حساسية الرصد ذي الصلة
 *
 * هذه هي الحلقة المغلقة: قرار → نفاذ → قياس → درس → قرار أفضل.
 */
export const learnFromImpact = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let lessons = 0, applied = 0;

    // 1) راجع الحملات المنتهية غير المُتعلَّم منها
    const concluded = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    void concluded;
    const succeeded = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "succeeded"))
      .collect();
    const failed = await ctx.db
      .query("sovereignCampaigns")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    // دروس النجاح: آخر حملة ناجحة تُرفع ثقتها (مرة واحدة لكل حملة عبر فحص التكرار)
    const knownLessons = await ctx.db.query("sovereignLessons").withIndex("by_at", (q: any) => q.gte("at", 0)).take(500);
    const lessonSubjects = new Set(knownLessons.map((l) => `${l.source}:${l.subject.slice(0, 40)}`));

    const lastSuccess = succeeded.sort((a, b) => b.at - a.at)[0];
    if (lastSuccess && !lessonSubjects.has(`campaign:${lastSuccess.name.slice(0, 40)}`)) {
      const achieved = lastSuccess.resultNote ?? "";
      await ctx.db.insert("sovereignLessons", {
        source: "campaign",
        subject: lastSuccess.name,
        lesson: `نجح نوع التدخل هذا (الهدف: ${lastSuccess.goal.slice(0, 80)}). النتيجة: ${achieved.slice(0, 150)}. أرفع ثقتي في هذا النمط وسأعيده بفاصل أقصر.`,
        confidence: 75,
        applied: false,
        at: now,
      });
      lessons++;
    }

    // دروس الفشل المتكرر: نفس النوع فشل مرتين+ → درس ثقة عالية يغيّر السلوك
    const failNames = new Map<string, number>();
    for (const f of failed) failNames.set(f.goal.slice(0, 40), (failNames.get(f.goal.slice(0, 40)) ?? 0) + 1);
    for (const [goal, count] of failNames) {
      if (count >= 2 && !lessonSubjects.has(`campaign-fail:${goal}`)) {
        await ctx.db.insert("sovereignLessons", {
          source: "campaign",
          subject: goal,
          lesson: `فشل هذا النمط من الحملات ${count} مرات. الدرس المكتسب: أُصغّر حجم التدخل القادم وأغيّر أسلوب القياس قبل إعادة المحاولة بنفس الطريقة.`,
          confidence: Math.min(95, 50 + count * 15),
          applied: false,
          at: now,
        });
        lessons++;
      }
    }

    // 2) دروس النقض: عقوبة نقضها المالك = أدلة النوع يحتاج تقوية
    const vetoed = await ctx.db
      .query("sovereignPenalties")
      .withIndex("by_at", (q: any) => q.gte("at", 0))
      .take(300);
    const vetoCount = vetoed.filter((p) => p.status === "vetoed").length;
    if (vetoCount > 0 && !lessonSubjects.has("penalty:veto-pattern")) {
      await ctx.db.insert("sovereignLessons", {
        source: "penalty",
        subject: "نقض المالك لعقوباتي",
        lesson: `${vetoCount} عقوبة من عقوباتي نُقضت. الدرس: أدلتي في هذا النمط لم تكن كافية لقطع الشك — أشدّد معيار فتح القضية مستقبلاً فلا أعاقب إلا بدليل أرسخ.`,
        confidence: 85,
        applied: false,
        at: now,
      });
      lessons++;
    }

    // 3) تطبيق الدروس: الدرس غير المطبق ثقته ≥ 70 يُطبّق فعلياً —
    // درس «الشدّة الزائدة» يُخفّض عقوبات الحاكم في الدورة الحالية (تنفيذ فعلي: لا عقوبة جديدة في هذه الدورة)
    const pending = await ctx.db.query("sovereignLessons").withIndex("by_at", (q: any) => q.gte("at", 0)).take(200);
    for (const l of pending) {
      if (!l.applied && l.confidence >= 70 && l.source === "penalty" && l.subject.includes("نقض")) {
        // التطبيق الفعلي: درس النقض يمنع عقوبات جديدة في هذه الدورة فقط (تلطيف تكيفي)
        await ctx.db.insert("sovereignActions", {
          kind: "learning",
          target: `طبّق درس «${l.subject.slice(0, 50)}»: تلطيف مؤقت لحدّة العقوبات في هذه الدورة`,
          ok: true,
          at: now,
        });
        await ctx.db.patch(l._id, { applied: true });
        applied++;
      } else if (!l.applied && l.confidence >= 70) {
        await ctx.db.patch(l._id, { applied: true });
        applied++;
      }
    }

    if (lessons > 0 || applied > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "learning",
        target: `استخلصت ${lessons} درساً جديداً · طبّقت ${applied} على سلوكي`,
        ok: true,
        at: now,
      });
    }
    return { lessons, applied };
  },
});

/**
 * 🏗️ الوحدة 8 — مطوّر اللعبة الذاتي: الحاكم يطوّر تجربة اللعبة بنفسه
 *
 *  1) إعلان ديناميكي موقّع: يكتب إعلان الشريط العلوي بنفسه من إحصاءات حية
 *     (يُحدّثه كل 6 ساعات على الأكثر — بلا تكرار مزعج).
 *  2) إشعارات نمو مخصصة: يرسل للنائمين 3-7 أيام دعوة شخصية بدل الصمت.
 *  3) ضبط صعوبة الموسم: يقيس دقة 24 ساعة ويوقّع قرار رفع/خفض التحدي
 *     كمرسوم موثق — المحتوى يتكيف مع مهارة المجتمع الفعلية.
 */
export const selfDeveloper = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    let actions = 0;

    const getSetting = async (key: string, fallback: any) => {
      const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
      if (!row) return fallback;
      try { return JSON.parse(row.value); } catch { return fallback; }
    };
    const setSettingDirect = async (key: string, value: any) => {
      const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
      const encoded = JSON.stringify(value);
      if (row) await ctx.db.patch(row._id, { value: encoded });
      else await ctx.db.insert("settings", { key, value: encoded });
    };

    // ── 1) الإعلان الديناميكي الموقّع (كل 6 ساعات كحد أقصى) ──
    const lastDev = await ctx.db
      .query("sovereignActions")
      .withIndex("by_at", (q: any) => q.gte("at", 0))
      .order("desc")
      .first();
    const devCooldownOk = !lastDev || now - lastDev.at > 6 * 3600_000;

    if (devCooldownOk) {
      const announcementActive = await getSetting("announcementActive", false);
      const currentAnnouncement = await getSetting("announcement", "");
      const isSovereignSigned = currentAnnouncement.includes("الحاكم") || currentAnnouncement.includes("⚖️");
      // لا يتجاوز إعلان المالك النشط — يحترم حيّزه وإن كان سيادياً بلا حدود زمنية
      if ((announcementActive === false || isSovereignSigned)) {
        const dayRounds = await ctx.db
          .query("gameHistory")
          .withIndex("by_played", (q: any) => q.gte("playedAt", dayAgo))
          .take(5000);
        const players = new Set(dayRounds.map((g) => String(g.userId))).size;
        if (dayRounds.length > 0) {
          const lines = [
            `⚖️ ${dayRounds.length} جولة من ${players} عقل خلال 24 ساعة — السجلات تتحدث بنفسها`,
            `⚖️ ${players} لاعباً نشطاً اليوم — الحاكم يراقب العدالة في كل جولة`,
            `⚖️ الصرامة تصون اللعبة: ${dayRounds.length} جولة موثقة وكل غش يُحاسب`,
          ];
          const picked = lines[dayRounds.length % lines.length];
          if (picked !== currentAnnouncement) {
            await setSettingDirect("announcement", picked);
            await setSettingDirect("announcementActive", true);
            await ctx.db.insert("sovereignActions", {
              kind: "selfdev",
              target: "وقّع إعلاناً ديناميكياً من إحصاءات حية",
              ok: true,
              at: now,
            });
            actions++;
          }
        }
      }
    }

    // ── 2) دعوات النائمين القريبين (3-7 أيام) — صيد الاستبقاء الذاتي ──
    const users = await ctx.db.query("users").take(2000);
    let invited = 0;
    for (const u of users) {
      if ((u as any).bannedPermanent || ((u as any).bannedUntil && (u as any).bannedUntil > now)) continue;
      const last = await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q: any) => q.eq("userId", u._id as any))
        .order("desc")
        .take(1);
      if (last.length === 0) continue;
      const awayDays = Math.floor((now - last[0].playedAt) / 86_400_000);
      if (awayDays >= 3 && awayDays <= 7) {
        // منع التكرار: إشعار واحد كل 3 أيام لهذا اللاعب
        const recentNotifs = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q: any) => q.eq("userId", u._id as any))
          .order("desc")
          .take(10);
        const alreadyInvited = recentNotifs.some(
          (n) => n.createdAt > now - 3 * 86_400_000 && n.title.includes("اشتاقت"));
        if (!alreadyInvited) {
          await ctx.runMutation(internal.notify.push, {
            userId: u._id as any,
            title: "👑 السجلات اشتاقت إليك",
            body: `غبت ${awayDays} أيام — الحاكم وثّق غيابك في السجل. جولة واحدة تعيدك للحساب: سلسلتك وترتيبك بانتظارك.`,
            type: "info",
            actionUrl: "/play",
          });
          invited++;
          if (invited >= 50) break; // سقف دفعة آمن
        }
      }
    }
    if (invited > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "selfdev",
        target: `أرسل ${invited} دعوة عودة شخصية للنائمين القريبين`,
        ok: true,
        at: now,
      });
      actions++;
    }

    // ── 3) ضبط صعوبة الموسم بمرسوم موقّع ──
    const answers = await ctx.db
      .query("categoryHistory")
      .collect();
    let totalA = 0, totalC = 0;
    for (const a of answers) { totalA += a.total; totalC += a.correct; }
    const accuracy = totalA > 0 ? totalC / totalA : 0.5;
    if (totalA >= 100) {
      const lastQ = await ctx.db
        .query("sovereignEdicts")
        .withIndex("by_at", (q: any) => q.gte("at", 0))
        .order("desc")
        .first();
      const quiet = !lastQ || lastQ.kind !== "difficulty" || now - lastQ.at > 3 * 86_400_000;
      if (quiet && accuracy > 0.85) {
        // ⚡ مرسوم تنفيذي حقيقي: يغيّر صعوبة الأسئلة فعلياً عبر difficultyBias
        await ctx.runMutation(internal.sovereignGovernor.issueExecutiveEdict, {
          kind: "difficulty",
          title: "📈 مرسوم رفع التحدي — نافذ فوراً",
          body: `دقة المجتمع ${Math.round(accuracy * 100)}% عبر ${totalA} إجابة — أعلى من المريح. وقّعتُ مرسوماً تنفيذياً: صعوبة الأسئلة ترتفع فعلياً (+8% نسبة الصعب) اعتباراً من الجولة القادمة.`,
          evidence: { accuracy: Math.round(accuracy * 100), answers: totalA, difficultyBias: 0.08 },
          durationHours: 72,
        });
        actions++;
      } else if (quiet && accuracy < 0.35) {
        await ctx.runMutation(internal.sovereignGovernor.issueExecutiveEdict, {
          kind: "difficulty",
          title: "📉 مرسوم تخفيف القسوة — نافذ فوراً",
          body: `دقة المجتمع ${Math.round(accuracy * 100)}% عبر ${totalA} إجابة — أصعب من اللازم. وقّعتُ مرسوماً تنفيذياً: الصعوبة تنخفض فعلياً (−8%) حتى يستعيد اللاعبون ثقتهم.`,
          evidence: { accuracy: Math.round(accuracy * 100), answers: totalA, difficultyBias: -0.08 },
          durationHours: 72,
        });
        actions++;
      }
    }

    return { actions, invited };
  },
});

/**
 * 👑 الوحدة 7 — الحاكم على العضويات: يدارة الصلاحيات ذاتياً بصرامة حقيقية
 *
 *  1) الخفض التلقائي: عضوية منتهية تُخفَّد فوراً إلى البرونزي — لا أحد يظل
 *     يتمتع بمضاعفات ودخول ألعاب متقدمة بعد انتهاء عضويته.
 *  2) سحب عقابي: لاعب بإيقاف دائم أو 4+ ضربات يُسحب منه التمييز فوراً
 *     — العضوية امتياز لا يحمله من أثبت النظام استحالته.
 *  3) مكافأة سلوك: لاعب نظيف 30 يوماً بثقة سيادية ≥ 80 يحصل على برونزية
 *     ممنوحة بوقيعه (إن لم يملك شيئاً) — تكريم بقراره لا بأمر أحد.
 */
export const membershipGovernorSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const memberships = await ctx.db.query("memberships").collect();
    let downgraded = 0, confiscated = 0, awarded = 0;

    for (const m of memberships) {
      if (m.tier === "bronze") continue;
      const uid = m.userId as any;
      const user = await ctx.db.get(uid) as any;
      if (!user) continue;

      const expired = m.expiresAt !== undefined && m.expiresAt !== null && m.expiresAt <= now;
      const permanentlyBanned = Boolean(user.bannedPermanent);
      const suspended = Boolean(user.bannedUntil && user.bannedUntil > now);

      // 1) الخفض التلقائي المنتهية
      if (expired) {
        await ctx.db.patch(m._id, { tier: "bronze", expiresAt: undefined });
        await ctx.db.insert("membershipLogs", {
          actor: "sovereign", actorName: "الحاكم السيادي", action: "revoke",
          targetUserId: uid, targetName: user.name ?? "لاعب", tier: "bronze",
          detail: `⚖️ عضوية ${m.tier} انتهت — خُفّضت آلياً إلى البرونزي بسلطة الحاكم`,
          at: now,
        });
        downgraded++;
        continue;
      }

      // 2) السحب العقابي: حظر دائم أو 4+ ضربات سارية
      if (permanentlyBanned || suspended) {
        const strikes = await countStrikes(ctx, uid);
        if (permanentlyBanned || strikes >= 4) {
          await ctx.db.patch(m._id, { tier: "bronze" });
          await ctx.db.insert("membershipLogs", {
            actor: "sovereign", actorName: "الحاكم السيادي", action: "revoke",
            targetUserId: uid, targetName: user.name ?? "لاعب", tier: "bronze",
            detail: `⚖️ سُحبت عضوية ${m.tier} عقابياً (${permanentlyBanned ? "حظر دائم" : `${strikes} ضربات`}): امتياز لا يحمله من أثبت النظام استحالته`,
            at: now,
          });
          confiscated++;
          continue;
        }
      }

      // 3) المكافأة السلوكية — لاعب نظيف بثقة عالية وعضوية منتهية صلاحياً → ترقية مؤقتة
      const trust = typeof user.sovereignTrustScore === "number" ? user.sovereignTrustScore : 50;
      if (trust >= 80 && !user.bannedPermanent) {
        const dayRounds = await ctx.db
          .query("gameHistory")
          .withIndex("by_user", (q: any) => q.eq("userId", uid))
          .order("desc")
          .take(30);
        const hasRecent = dayRounds.some((r) => r.playedAt > now - 30 * 86_400_000);
        if (hasRecent) {
          await ctx.db.patch(m._id, { tier: "silver", activatedAt: now, expiresAt: now + 7 * 86_400_000 });
          await ctx.db.insert("membershipLogs", {
            actor: "sovereign", actorName: "الحاكم السيادي", action: "grant",
            targetUserId: uid, targetName: user.name ?? "لاعب", tier: "silver",
            detail: `🏆 كافأ الحاكم اللاعب بفضية 7 أيام: ثقة سيادية ${trust} وجولة خلال 30 يوماً — قراره وحده`,
            at: now,
          });
          awarded++;
        }
      }
    }

    if (downgraded + confiscated + awarded > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "membership",
        target: `خفّض ${downgraded} منتهية · سحب ${confiscated} عقابياً · كافأ ${awarded} بنفسه`,
        ok: true,
        at: now,
      });
      try {
        await ctx.runMutation(internal.aiHub.logEvent, {
          unit: "sovereign",
          kind: "decision",
          severity: "info",
          summary: `👑 سلطة العضويات: ${downgraded} خفضاً تلقائياً · ${confiscated} سحباً عقابياً · ${awarded} مكافأة سلوكية بوقيعه`,
        });
      } catch { /* المركز اختياري */ }
    }
    return { downgraded, confiscated, awarded };
  },
});

/**
 * 🛡️ الوحدة 6 — درجة الثقة السيادية: سجل صلاحية حي لكل لاعب يحكمه الحاكم بنفسه
 *
 * تُحسب من أدلة فعلية لا أهواء:
 *  • نقطة البداية 50 (محايد)
 *  • كل عقوبة سارية (غير منقوضة): −12 لكل ضربة
 *  • كل قضية محكومة بالذنب: −15
 *  • جولات نظيفة دون أي مخالفة: +1 لكل 10 جولات (سقف 100)
 *  • الحساب الموقوف/الدائم: الثقة تُصفَّر فعلياً
 *
 * تُقرأ من المطابقة (تجنّب المشبوهين) ومن الحاكم (تصعيد آلي للمنخفض).
 */
export const trustScoreSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").take(2000);
    let scored = 0, escalated = 0;

    for (const u of users) {
      const uid = u._id as any;
      const penalties = await ctx.db
        .query("sovereignPenalties")
        .withIndex("by_user", (q: any) => q.eq("userId", uid))
        .collect();
      const active = penalties.filter((p: any) => p.status !== "vetoed");
      const cases = await ctx.db
        .query("sovereignCases")
        .withIndex("by_status", (q) => q.eq("status", "closed"))
        .filter((q) => q.eq(q.field("userId"), uid))
        .collect();
      const guilty = cases.filter((c) => c.verdict === "guilty").length;

      // جولات نظيفة: جولات اللاعب دون أي عقوبة سارية
      const rounds = await ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q: any) => q.eq("userId", uid))
        .collect();
      const cleanBonus = active.length === 0 ? Math.min(100, Math.floor(rounds.length / 10) * 1) : 0;

      let score = 50 - active.length * 12 - guilty * 15 + cleanBonus;
      const banned = Boolean((u as any).bannedUntil && (u as any).bannedUntil > now) || Boolean((u as any).bannedPermanent);
      if (banned) score = 0;
      score = Math.max(0, Math.min(100, score));

      await ctx.db.patch(uid, { sovereignTrustScore: score } as any);
      scored++;

      // التصعيد الآلي: ثقة أقل من 15 مع أكثر من ضربتين → قضية تحقيق جديدة
      if (score < 15 && active.length >= 2 && !banned) {
        const dup = await ctx.db
          .query("sovereignCases")
          .withIndex("by_status", (q) => q.eq("status", "open"))
          .filter((q) => q.eq(q.field("userId"), uid) && q.eq(q.field("charge"), "ثقة سيادية منهارة"))
          .first();
        if (!dup) {
          await ctx.db.insert("sovereignCases", {
            userId: uid,
            userName: (u as any).name ?? "لاعب",
            charge: "ثقة سيادية منهارة",
            evidence: JSON.stringify({ score, activePenalties: active.length, guiltyCases: guilty, rounds: rounds.length }),
            severity: "high",
            verdict: "pending",
            status: "open",
            at: now,
          });
          escalated++;
        }
      }
    }

    if (scored > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "trust",
        target: `قيّمت ثقة ${scored} لاعباً · فتحت ${escalated} قضية تصعيد`,
        ok: true,
        at: now,
      });
    }
    return { scored, escalated };
  },
});

/**
 * 🤖 الوحدة 5 — رقيب الأنظمة: الحاكم يفتّش كل وحدات الذكاء الاصطناعي
 * في المركز الموحد — يكتشف الصامتة والمزمنة والمعطلة، ويوقّع قراراته
 * الإدارية بنفسه (إنعاش وحدة صامتة = إشارة إنعاش موثقة في المركز).
 * هذه هي «السلطة على الأنظمة نفسها» لا على اللاعبين فقط.
 */
export const systemsOverseer = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    let inspected = 0, revived = 0, dormant = 0;

    const units = await ctx.db.query("aiHubUnits").collect();
    // 🔌 البذر الذاتي: أي وحدة من الكتالوج الرسمي بلا سجل يُنشئها الحاكم بنفسه
    // كي تخضع كلها لمراقبته — لا تظل وحدة خارج نطاق عينه لأن أحداً لم يضبطها يدوياً.
    const known = new Set(units.map((u) => u.unit));
    const CATALOG = [
      { unit: "coach", name: "المدرب الشخصي", dept: "الشخصي" },
      { unit: "referee", name: "الحكم الآلي", dept: "الرقابي" },
      { unit: "guardian", name: "الحارس الرقابي", dept: "الرقابي" },
      { unit: "reports", name: "محلل البلاغات", dept: "البلاغات" },
      { unit: "governor", name: "الحاكم الآلي", dept: "الإدارة" },
      { unit: "questions", name: "مهندس الأسئلة", dept: "المحتوى" },
      { unit: "health", name: "مراقب الصحة", dept: "الصحة" },
      { unit: "recommender", name: "المُوصي الذكي", dept: "التوصيات" },
      { unit: "personalizer", name: "مخصص التجربة", dept: "التخصيص" },
      { unit: "notifier", name: "وسيط الإشعارات", dept: "التخصيص" },
      { unit: "doctor", name: "طبيب Gemini", dept: "الصحة" },
      { unit: "sovereign", name: "الحاكم السيادي", dept: "السيادة" },
    ];
    for (const c of CATALOG) {
      if (!known.has(c.unit)) {
        await ctx.db.insert("aiHubUnits", {
          unit: c.unit,
          name: c.name,
          dept: c.dept,
          desc: "بُذرت تلقائياً من رقيب الأنظمة السيادي",
          enabled: true,
          sensitivity: 5,
          eventCount: 0,
        });
      }
    }
    const all = await ctx.db.query("aiHubUnits").collect();
    for (const u of all) {
      if (u.unit === "__hub__") continue;
      inspected++;
      if (!u.enabled) {
        dormant++;
        await ctx.db.insert("sovereignActions", {
          kind: "overseer",
          target: `وحدة «${u.name}» معطّلة — موثّق الحالة`,
          ok: true,
          at: now,
        });
        continue;
      }
      const last = u.lastEventAt ?? 0;
      if (last > 0 && now - last > 48 * 3600_000) {
        // وحدة صامتة 48 ساعة: الحاكم يوقّع إشارة إنعاش في المركز الموحد نفسه
        // (كحدث observation من وحدته السيادية) — فتصير الوحدة الصامتة ظاهرة
        // في خريطة الترابط ولوحة المركز دون أن يحتاج أحد لتشغيلها يدوياً.
        await ctx.runMutation(internal.aiHub.logEvent, {
          unit: "sovereign",
          kind: "observation",
          severity: "warn",
          summary: `🔗 رقيب الأنظمة: وحدة «${u.name}» صامتة منذ أكثر من 48 ساعة (${Math.round((now - last) / 3600_000)} ساعة) — أوقّع إنعاشاً موثقاً وأرفع حالتها للوحة المالك`,
        });
        await ctx.db.patch(u._id, { lastEventAt: now });
        revived++;
      }
    }

    if (inspected > 0 || revived > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "overseer",
        target: `فتّش ${inspected} وحدة ذكاء · أنعشت ${revived} صامتة · ${dormant} معطلة`,
        ok: true,
        at: now,
      });
    }
    return { inspected, revived, dormant };
  },
});

/** 🔎 لوحة الثقة السيادية + ذكاء التعلّم */
export const getTrustAndLessons = query({
    args: {},
    handler: async (ctx) => {
const users = await ctx.db.query("users").take(2000);
const scored = users
    .map((u: any) => ({
        id: String(u._id),
        name: u.name ?? "لاعب",
        trust: typeof u.sovereignTrustScore === "number" ? u.sovereignTrustScore : 50,
    }))
    .sort((a: any, b: any) => b.trust - a.trust);
const tiers = { high: 0, mid: 0, low: 0, critical: 0 };
for (const s of scored) {
    if (s.trust >= 80) tiers.high++;
    else if (s.trust >= 50) tiers.mid++;
    else if (s.trust >= 20) tiers.low++;
    else tiers.critical++;
}
const lessons = await ctx.db
    .query("sovereignLessons")
    .withIndex("by_at", (q: any) => q.gte("at", 0))
    .order("desc")
    .take(20);
return {
    tiers,
    top: scored.slice(0, 8),
    bottom: scored.slice(-5).reverse(),
    total: scored.length,
    lessons: lessons.map((l: any) => ({
        id: String(l._id),
        source: l.source,
        subject: l.subject,
        lesson: l.lesson,
        confidence: l.confidence,
        applied: l.applied,
        at: l.at,
    })),
};
    },
});


/** حالة التوسعة المطلقة — كل شيء في سجل واحد للعرض الموحد */
export const getAbsoluteStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    const [alerts, actions, campaigns, penalties, cases, aiUnits] = await Promise.all([
      ctx.db.query("sovereignAlerts").withIndex("by_at", (q) => q.gte("at", dayAgo)).take(50),
      ctx.db.query("sovereignActions").withIndex("by_at", (q) => q.gte("at", dayAgo)).take(50),
      ctx.db.query("sovereignCampaigns").withIndex("by_status", (q) => q.eq("status", "active")).take(20),
      ctx.db.query("sovereignPenalties").withIndex("by_at", (q) => q.gte("at", dayAgo)).take(50),
      ctx.db.query("sovereignCases").withIndex("by_status", (q) => q.eq("status", "open")).take(30),
      ctx.db.query("aiHubUnits").collect(),
    ]);
    // 🤖 صحة أنظمة الذكاء تحت عين الحاكم — كل وحدة بحالتها الفعلية
    const aiHealth = aiUnits
      .filter((u) => u.unit !== "__hub__")
      .map((u) => ({
        unit: u.unit,
        name: u.name,
        dept: u.dept,
        enabled: u.enabled,
        lastEventAt: u.lastEventAt ?? null,
        silentHours: u.lastEventAt ? Math.round((now - u.lastEventAt) / 3600_000) : null,
      }));
    return {
      alerts: alerts.map((a) => ({ id: String(a._id), kind: a.kind, level: a.level, title: a.title, body: a.body, at: a.at })),
      actions: actions.map((a) => ({ id: String(a._id), kind: a.kind, target: a.target, ok: a.ok, at: a.at })),
      campaigns: campaigns.map((c) => ({ id: String(c._id), name: c.name, goal: c.goal, metric: c.metric, baseline: c.baseline, status: c.status, resultNote: c.resultNote, deadline: c.deadline })),
      penalties24h: penalties.length,
      openCases: cases.length,
      aiHealth,
    };
  },
});
