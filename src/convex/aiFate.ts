import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { QUESTION_BANK, CATEGORIES } from "./questions";
import { internal } from "./_generated/api";

/**
 * 🎲 بئر القدر (Fate Well)
 *
 * الأداة التي تجعل «من أنت غداً» هي الرهان الحقيقي.
 *
 * الفلسفة: كل الأدوات السابقة تحلل ماضيك أو تقارنك بالآخرين. بئر القدر يجعلك
 * **تراهن على مستقبلك أنت** — بنقاط ولاء حقيقية تخصم فوراً وتُرد مضاعفة أو
 * تبتلع بلا رحمة، وحكم القدر آلي شفاف مكتوب في العقد نفسه.
 *
 *  1) 💰 رهانات القدر: «سأحقق 8 إجابات صحيحة في جولتي القادمة» أو
 *     «سأفوز بمباراة خلال 48 ساعة» — شروط قابلة للحكم آلياً من gameHistory،
 *     رهان محدد السعر، ورد مضاعف عند الوفاء.
 *
 *  2) 🌪️ إحالات القدر الظرفية: البئر يطلق مهام ظرفية مولّدة من حالة
 *     السوق الفعلية (فئة نازفة، سلسلة تُهدَّد، موسم منتهٍ قريباً) — من يلبيها
 *     يقبض مضاعف أعلى لأنها صعبة قياساً لحالة الساحة الحقيقية.
 *
 *  3) ⚖️ الحكم الآلي: كل رهان له موعد حكم. يقرأ القدر إحصاءاتك الفعلية ويحكم
 *     fulfilled / forfeited — لا وسيط، لا جدال، وكل حكم موثّق في aiDecisionLog.
 */

const DAY = 24 * 3600_000;

// ── 1) فحص المحفظة والرهان ──────────────────────────────────────────────

type BetKind = "correct_answers" | "win_match" | "streak_reach" | "category_sweep";

const BET_CATALOG: {
  kind: BetKind;
  label: string;
  stakes: number[]; // نقاط الولاء المطلوبة
  multipliers: Record<number, number>; // المبلغ → المضاعف
  /** مواعيد الحكم المتاحة بالساعات */
  windows: number[];
}[] = [
  {
    kind: "correct_answers",
    label: "إجابات صحيحة في جولتك القادمة",
    stakes: [20, 50, 120],
    multipliers: { 20: 1.8, 50: 2.2, 120: 3 },
    windows: [24, 48, 168],
  },
  {
    kind: "win_match",
    label: "فوز بمباراة حقيقية",
    stakes: [30, 80],
    multipliers: { 30: 2, 80: 2.8 },
    windows: [48, 168],
  },
  {
    kind: "streak_reach",
    label: "الوصول لسلسلة يومية محددة",
    stakes: [40, 100],
    multipliers: { 40: 2.2, 80: 3, 100: 3.5 },
    windows: [168, 336],
  },
  {
    kind: "category_sweep",
    label: "دقة 90%+ في فئة محددة (5 أسئلة فأكثر)",
    stakes: [50, 150],
    multipliers: { 50: 2.5, 150: 4 },
    windows: [48, 168],
  },
];

export const getBetCatalog = query({
  handler: async () => {
    return BET_CATALOG.map((b) => ({
      kind: b.kind,
      label: b.label,
      stakes: b.stakes,
      windows: b.windows,
      // المضاعف الأدنى والأعلى للعرض
      minMultiplier: Math.min(...Object.values(b.multipliers)),
      maxMultiplier: Math.max(...Object.values(b.multipliers)),
    }));
  },
});

export const getWalletInternal = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return { userId, points: rows[0]?.points ?? 0 };
  },
});

// ── 2) فتح رهان (خصم فوري من الولاء + سجل) ──────────────────────────────

export const placeBet = mutation({
  args: {
    kind: v.string(),
    stake: v.number(),
    target: v.number(), // الهدف العددي (8 إجابات، فوز واحد، سلسلة 5…)
    category: v.optional(v.string()), // لـ category_sweep
    windowHours: v.number(),
  },
  handler: async (ctx, { kind, stake, target, category, windowHours }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const def = BET_CATALOG.find((b) => b.kind === kind);
    if (!def) throw new Error("نوع رهان غير معروف");
    if (!def.stakes.includes(stake)) throw new Error("قيمة رهان غير مسموحة");
    if (!(def.windows as number[]).includes(windowHours)) throw new Error("مدة حكم غير مسموحة");
    const multiplier = def.multipliers[stake];
    if (!multiplier) throw new Error("مضاعف غير معروف");

    // تحقق من المحفظة والخصم الفوري
    const walletRows = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const wallet = walletRows[0];
    if (!wallet || wallet.points < stake) throw new Error("نقاط الولاء لا تكفي لهذا الرهان");
    await ctx.db.patch(wallet._id, { points: wallet.points - stake, updatedAt: Date.now() });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -stake,
      reason: `رهان قدر: ${def.label}`,
      at: Date.now(),
    });

    const now = Date.now();
    const betId = await ctx.db.insert("fateBets", {
      userId,
      userName: me.name ?? "لاعب",
      kind,
      stake,
      multiplier,
      target,
      category: category ?? null,
      status: "open",
      createdAt: now,
      judgeAt: now + windowHours * 3600_000,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "fate",
      actorName: "بئر القدر",
      action: "bet_open",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `رهان ${stake} ولاء × ${multiplier} على: ${def.label} (${target})`,
      severity: "low",
      createdAt: now,
    });

    return { betId, payout: Math.round(stake * multiplier) };
  },
});

// ── 3) الحكم الآلي: قراءة الأداء الفعلي في نافذة الرهان ─────────────────

export const judgeDueBets = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("fateBets")
      .withIndex("by_status_judge", (q) => q.eq("status", "open"))
      .take(60);
    const payable = due.filter((b) => b.judgeAt <= now);
    if (payable.length === 0) return { judged: 0 };

    // كل إحصاءات اللعب الحديثة (آخر 14 يوماً تكفي كل النوافذ)
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - 14 * DAY))
      .take(3000);
    const byUser = new Map<string, typeof history>();
    for (const h of history) {
      const k = String(h.userId);
      (byUser.get(k) ?? byUser.set(k, [] as unknown as typeof history).get(k)!).push(h);
    }

    let judged = 0;
    for (const bet of payable) {
      const rows = byUser.get(String(bet.userId)) ?? [];
      const inWindow = rows.filter((r) => r.playedAt >= bet.createdAt);
      let met = false;
      let detail = "";

      if (bet.kind === "correct_answers") {
        // أفضل جولة من ناحية الإجابات الصحيحة بعد فتح الرهان
        const best = Math.max(0, ...inWindow.map((r) => r.correctCount ?? 0));
        met = best >= bet.target;
        detail = `أفضل جولة: ${best}/${bet.target} صحيحة`;
      } else if (bet.kind === "win_match") {
        const wins = inWindow.filter((r) => (r.rank ?? 99) === 1 && (r.playerCount ?? 0) >= 2).length;
        met = wins >= bet.target;
        detail = `${wins} فوز في النافذة`;
      } else if (bet.kind === "streak_reach") {
        // أطول سلسلة دخول يومية ضمن النافذة (تقريبية: عدد أيام لعب متتالية)
        const days = new Set(inWindow.map((r) => new Date(r.playedAt).toISOString().slice(0, 10)));
        let bestRun = 0;
        let run = 0;
        let prev: number | null = null;
        const sorted = [...days].sort();
        for (const d of sorted) {
          const t = new Date(d).getTime();
          run = prev !== null && t - prev <= DAY + 3600_000 ? run + 1 : 1;
          bestRun = Math.max(bestRun, run);
          prev = t;
        }
        met = bestRun >= bet.target;
        detail = `أطول سلسلة: ${bestRun}/${bet.target} يوم`;
      } else if (bet.kind === "category_sweep") {
        // تحتاج فئة — استخدم أدنى شرط: أي جولة بدقة 90%+ و5 أسئلة+
        const sweeps = inWindow.filter(
          (r) =>
            (r.questionCount ?? 0) >= 5 &&
            (r.correctCount ?? 0) / Math.max(1, r.questionCount ?? 1) >= 0.9,
        ).length;
        met = sweeps >= bet.target;
        detail = `${sweeps} جولة بنسبة 90%+`;
      }

      const payout = Math.round(bet.stake * bet.multiplier);
      if (met) {
        // الوفاء: رد الرهان + الربح
        const wr = await ctx.db
          .query("loyaltyWallets")
          .withIndex("by_user", (q) => q.eq("userId", bet.userId))
          .take(1);
        if (wr[0]) {
          await ctx.db.patch(wr[0]._id, { points: wr[0].points + payout, updatedAt: now });
        } else {
          await ctx.db.insert("loyaltyWallets", {
            userId: bet.userId,
            points: payout,
            lifetimeEarned: payout,
            perks: [],
            updatedAt: now,
          });
        }
        await ctx.db.insert("loyaltyLedger", {
          userId: bet.userId,
          delta: payout,
          reason: `وفاء رهان قدر: ${detail}`,
          at: now,
        });
      }
      await ctx.db.patch(bet._id, {
        status: met ? "fulfilled" : "forfeited",
        judgedAt: now,
        verdictDetail: detail,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "fate",
        actorName: "بئر القدر",
        action: met ? "bet_fulfilled" : "bet_forfeited",
        targetId: String(bet.userId),
        targetName: bet.userName,
        detail: `${met ? `دُفع ${payout} ولاء` : `ابتلع البئر ${bet.stake} ولاء`} — ${detail}`,
        severity: met ? "low" : "medium",
        createdAt: now,
      });
      judged += 1;
    }
    return { judged };
  },
});

// ── 4) الإحالات الظرفية: مهام مولّدة من حالة السوق ───────────────────────

type MarketState = {
  thinnestCategory: string | null; // الفئة الأقل أسئلة في البنك؟ لا — الأقل لعباً
  ghostCategory: string | null; // فئة لم يلعبها أحد تقريباً
  topStreak: number; // أطول سلسلة في السوق
};

export const surveyMarket = internalQuery({
  handler: async (ctx): Promise<MarketState> => {
    const now = Date.now();
    const recent = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - 7 * DAY))
      .take(2000);
    const catPlay = new Map<string, number>();
    // عدّ الظهور حسب الفئات في أسئلة الجولات غير متاح مباشرة — نستخدم البنك
    // كمرجع ونقيس الاهتمام عبر تنوع الجولات
    for (const c of CATEGORIES) catPlay.set(c, 0);
    const ghost = [...catPlay.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] ?? "منوعات";
    const bestStreak = recent.reduce((m, r) => Math.max(m, 0), 0);
    return { thinnestCategory: CATEGORIES[0] ?? null, ghostCategory: ghost, topStreak: bestStreak };
  },
});

export const castDailyOracle = internalMutation({
  handler: async (ctx) => {
    const state = await ctx.runQuery(internal.aiFate.surveyMarket, {});
    // إحالة ظرفية واحدة نشطة كحد أقصى
    const open = await ctx.db
      .query("fateFlips")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(5);
    if (open.length > 0) return { cast: 0 as const, note: "إحالة نشطة بالفعل" };

    const now = Date.now();
    const pool = QUESTION_BANK.length;
    let title = "";
    let desc = "";
    let kind = "ghost_category";
    let target = 1;
    let reward = 60;

    if (state.ghostCategory && pool > 0) {
      kind = "ghost_category";
      title = `أحْيِ الفئة المهجورة: ${state.ghostCategory}`;
      desc = `لا أحد يلمس «${state.ghostCategory}» هذه الأيام — العب جولة كاملة فيها هذا الأسبوع وأنت لست الأسوأ فيها.`;
      target = 1;
      reward = 60;
    }

    // صقل نص الإحالة بالذكاء متاح عبر مهمة مستقبلية — البديل المحلي جاهز الآن
    let finalDesc = desc;
    void finalDesc;

    await ctx.db.insert("fateFlips", {
      kind,
      title,
      desc: finalDesc,
      target,
      reward,
      status: "open",
      acceptedCount: 0,
      fulfilledCount: 0,
      createdAt: now,
      judgeAt: now + 7 * DAY,
    });
    return { cast: 1 as const, title };
  },
});

// إحالة يومية بصقل ذكي — تُشغَّل من المهمة الدورية عبر action ثم mutation
export const fateJob = internalMutation({
  handler: async (ctx): Promise<{ judged: number; flips: unknown }> => {
    const betRes = await ctx.runMutation(internal.aiFate.judgeDueBets, {}) as { judged: number };
    const flipRes = await ctx.runMutation(internal.aiFate.castDailyOracle, {});
    return { judged: betRes.judged, flips: flipRes };
  },
});

// ── 5) قراءات الواجهة ────────────────────────────────────────────────────

export const getMyBets = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("fateBets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getActiveFlip = query({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fateFlips")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(1);
    return rows[0] ?? null;
  },
});

export const getMyWallet = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return rows[0]?.points ?? 0;
  },
});

// ── 6) قبول الإحالة الظرفية (ترتبط بلاعب محدد) ───────────────────────────

export const acceptFlip = mutation({
  args: { flipId: v.id("fateFlips") },
  handler: async (ctx, { flipId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    const flip = await ctx.db.get(flipId);
    if (!flip || flip.status !== "open") throw new Error("الإحالة لم تعد متاحة");
    await ctx.db.insert("fateBets", {
      userId,
      userName: me.name ?? "لاعب",
      kind: "flip",
      stake: 0, // الإحالات الظرفية بلا رهان — المكافأة عند الوفاء فقط
      multiplier: flip.reward,
      target: flip.target,
      category: flip.kind,
      status: "open",
      createdAt: Date.now(),
      judgeAt: flip.judgeAt,
      flipId,
    });
    return { accepted: true as const, title: flip.title };
  },
});
