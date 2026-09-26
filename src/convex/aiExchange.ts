import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * 📈 صرف القدرات (Minds Exchange)
 *
 * الأداة التي تحوّل نقاط الولاء من «رصيد صامت» إلى **عملة اقتصاد حي**.
 *
 * الفلسفة: مؤشر السوق (MIDX) يُحسب فعلياً من نبض اللعبة — عدد الجولات
 * واللاعبين النشطين ومعدل كسب الولاء — ويتحرك صعوداً وهبوطاً كأي سوق.
 * اللاعب يراهن على **حركة السوق نفسها**: «أشتري عند 100 وأبيع عند 110» —
 * والحكم آلي من قيمة المؤشر الفعلية وقت الاستحقاق.
 *
 *  1) 📊 المؤشر MIDX: خط أساس 100 + معاملات من النشاط الحقيقي (جولات، لاعبون، ولاء مُتداول)
 *  2) 📉 التاريخ: كل قراءة تُحفظ — رسوم بيانية وتقلبات موثقة
 *  3) 💹 الصفقات: شراء/بيع حصص عند قيمة المؤشر لحظة التعاقد، والحكم آلياً
 *  4) 🔮 تنبؤ المحلل: توقع موجز صادق بالذكاء يُقيَّم لاحقاً (دقة المحلل معلنة!)
 *
 * النتيجة: اقتصاد ثانٍ داخل اللعبة يعكس صحتها الحقيقية — من يقرأ السوق
 * يربح، ومن يراهن عمياء يخسر، وكله أرقام حية لا عشوائية.
 */

const BASE_INDEX = 100;
const MIN_LOYALTY = 30;

// ── 1) حساب المؤشر من النشاط الفعلي ─────────────────────────────────────

export const computeIndex = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 3600_000;
    const weekAgo = now - 7 * 24 * 3600_000;

    // نشاط اليوم مقابل الأسبوع
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", weekAgo))
      .take(3000);
    const todayRounds = history.filter((h) => h.playedAt >= dayAgo).length;
    const weekRounds = history.length;
    const activeToday = new Set(history.filter((h) => h.playedAt >= dayAgo).map((h) => String(h.userId))).size;

    // الولاء المُتداول (مجموع المحافظ المحدودة)
    const wallets = await ctx.db.query("loyaltyWallets").take(500);
    const circulating = wallets.reduce((s, w) => s + Math.max(0, w.points), 0);

    // معادلة المؤشر: نمو النشاط + السيولة + تنشيط اليوم
    const activityRatio = weekRounds > 0 ? todayRounds / (weekRounds / 7) : 1; // 1 = طبيعي
    const liquidityFactor = Math.log10(Math.max(10, circulating)) / 3; // ~1-1.6
    const engagement = Math.min(1.3, 0.7 + activeToday / 20);

    const midx = Math.round(BASE_INDEX * activityRatio * liquidityFactor * engagement * 10) / 10;
    return { midx, todayRounds, weekRounds, activeToday, circulating };
  },
});

export const tickIndex = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const s = (await ctx.runQuery(internal.aiExchange.computeIndex, {})) as {
      midx: number;
      todayRounds: number;
      weekRounds: number;
      activeToday: number;
      circulating: number;
    };
    await ctx.db.insert("exchangeTicks", {
      midx: s.midx,
      activeToday: s.activeToday,
      todayRounds: s.todayRounds,
      circulating: s.circulating,
      createdAt: Date.now(),
    });
    // تسوية الصفقات المستحقة
    const settled = await ctx.runMutation(internal.aiExchange.settleTrades, { currentMidx: s.midx });
    return { midx: s.midx, settled };
  },
});

// ── 2) الصفقات: شراء/بيع على حركة المؤشر ────────────────────────────────

export const openTrade = mutation({
  args: {
    direction: v.union(v.literal("up"), v.literal("down")),
    stake: v.number(),
    windowHours: v.number(),
  },
  handler: async (ctx, { direction, stake, windowHours }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    if (stake < MIN_LOYALTY) throw new Error(`الحد الأدنى ${MIN_LOYALTY} ولاء`);
    if (![24, 48, 168].includes(windowHours)) throw new Error("مدة غير مسموحة");

    const cur = (await ctx.runQuery(internal.aiExchange.computeIndex, {})) as { midx: number };

    // خصم فوري من المحفظة
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const wallet = wr[0];
    if (!wallet || wallet.points < stake) throw new Error("نقاط الولاء لا تكفي");
    await ctx.db.patch(wallet._id, { points: wallet.points - stake, updatedAt: Date.now() });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: -stake,
      reason: `صفقة سوق: راهن على ${direction === "up" ? "صعود" : "هبوط"} المؤشر`,
      at: Date.now(),
    });

    const now = Date.now();
    const tradeId = await ctx.db.insert("exchangeTrades", {
      userId,
      userName: me.name ?? "لاعب",
      direction,
      stake,
      entryMidx: cur.midx,
      windowHours,
      status: "open" as const,
      exitMidx: undefined,
      payout: undefined,
      createdAt: now,
      settleAt: now + windowHours * 3600_000,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "exchange",
      actorName: "صرف القدرات",
      action: "trade_open",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `${stake} ولاء على ${direction === "up" ? "صعود" : "هبوط"} MIDX من ${cur.midx} خلال ${windowHours} ساعة`,
      severity: "low",
      createdAt: now,
    });
    return { tradeId, entryMidx: cur.midx };
  },
});

export const settleTrades = internalMutation({
  args: { currentMidx: v.number() },
  handler: async (ctx, { currentMidx }) => {
    const now = Date.now();
    const open = await ctx.db
      .query("exchangeTrades")
      .withIndex("by_status_settle", (q) => q.eq("status", "open"))
      .take(50);
    const due = open.filter((t) => t.settleAt <= now);
    let settled = 0;
    for (const t of due) {
      const won = t.direction === "up" ? currentMidx > t.entryMidx : currentMidx < t.entryMidx;
      // المضاعف يكبر مع طول النافذة
      const multiplier = t.windowHours >= 168 ? 2.6 : t.windowHours >= 48 ? 2.1 : 1.8;
      const payout = won ? Math.round(t.stake * multiplier) : 0;

      if (won) {
        const wr = await ctx.db
          .query("loyaltyWallets")
          .withIndex("by_user", (q) => q.eq("userId", t.userId))
          .take(1);
        if (wr[0]) await ctx.db.patch(wr[0]._id, { points: wr[0].points + payout, updatedAt: now });
        await ctx.db.insert("loyaltyLedger", {
          userId: t.userId,
          delta: payout,
          reason: `صفقة سوق رابحة: MIDX ${t.entryMidx} → ${currentMidx}`,
          at: now,
        });
      }
      await ctx.db.patch(t._id, {
        status: won ? "won" : "lost",
        exitMidx: currentMidx,
        payout: won ? payout : 0,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "exchange",
        actorName: "صرف القدرات",
        action: won ? "trade_won" : "trade_lost",
        targetId: String(t.userId),
        targetName: t.userName,
        detail: `MIDX ${t.entryMidx} → ${currentMidx} (${won ? `دُفع ${payout}` : "خسارة الرهان"})`,
        severity: "low",
        createdAt: now,
      });
      settled += 1;
    }
    return { settled };
  },
});

// ── 3) تنبؤ المحلل الصادق ───────────────────────────────────────────────

export const analystForecast = internalMutation({
  handler: async (ctx) => {
    const ticks = await ctx.db.query("exchangeTicks").take(200);
    if (ticks.length < 3) return { cast: 0 };
    const sorted = [...ticks].sort((a, b) => a.createdAt - b.createdAt);
    const recent = sorted.slice(-6);
    const first = recent[0].midx;
    const last = recent[recent.length - 1].midx;
    const trend = last > first ? "up" : last < first ? "down" : "flat";
    const changePct = Math.round(((last - first) / Math.max(1, first)) * 100);

    let comment = `المؤشر ${trend === "up" ? "صاعد" : trend === "down" ? "هابط" : "مستقر"} بـ ${changePct}% خلال آخر القراءات — ${trend === "up" ? "زخم النشاط يدفع السيولة" : trend === "down" ? "الساحة هادئة والسيولة تتراجع" : "توازن دقيق بين الداخل والخارج"}.`;
    if (getOpenRouterKey()) {
      try {
        const raw = await callLlm(
          [
            { role: "system", content: "أنت محلل أسواق عربية لاذع وذكي في لعبة أسئلة. سطران: قراءة حركة مؤشر النشاط + توصية ساخرة قصيرة. بلا وعود مضمونة." },
            { role: "user", content: `MIDX: ${first} → ${last} (${changePct}%)\nنشاط اليوم: ${recent[recent.length - 1].activeToday}\nسيولة متداولة: ${recent[recent.length - 1].circulating}` },
          ],
          150,
          0.8,
          "MindClash Exchange Analyst",
        );
        const clean = raw.trim().slice(0, 220);
        if (clean.length > 20) comment = clean;
      } catch {
        /* المحلي كافٍ */
      }
    }

    await ctx.db.insert("exchangeForecasts", {
      trend,
      changePct,
      comment,
      // الحكم لاحقاً: هل اتجاه التوقع تطابق مع الحركة الفعلية التالية؟
      status: "open",
      createdAt: Date.now(),
    });
    return { cast: 1, trend };
  },
});

// ── 4) المهمة الدورية ────────────────────────────────────────────────────

export const exchangeJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const tick = (await ctx.runMutation(internal.aiExchange.tickIndex, {})) as unknown;
    const forecast = (await ctx.runMutation(internal.aiExchange.analystForecast, {})) as unknown;
    return { tick, forecast };
  },
});

// ── 5) قراءات الواجهة ────────────────────────────────────────────────────

export const getIndex = query({
  handler: async (ctx) => {
    const ticks = await ctx.db.query("exchangeTicks").take(50);
    const sorted = [...ticks].sort((a, b) => a.createdAt - b.createdAt);
    return {
      current: sorted[sorted.length - 1]?.midx ?? BASE_INDEX,
      history: sorted.slice(-24),
    };
  },
});

export const getMyTrades = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("exchangeTrades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getLatestForecast = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("exchangeForecasts").take(10);
    return rows.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

export const getWalletPoints = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return wr[0]?.points ?? 0;
  },
});
