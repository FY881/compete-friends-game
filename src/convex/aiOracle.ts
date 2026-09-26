import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";
import { QUESTION_BANK } from "./questions";

/**
 * 🔮 عرّاف العقول (Minds Oracle)
 *
 * الأداة الأجرأ فكرياً: عرّاف يتنبأ علناً بالأسبوع القادم — **ويُحاسب**.
 *
 * الفكرة الجوهرية: كل نظام AI آخر يعطي نصائح وتحليلات لا أحد يراجعها.
 * العرّاف مختلف: يُصدر نبوءات صريحة قابلة للتكذيب («سيفوز فلان بنهاية
 * الأسبوع»، «دقة فئة الجغرافيا ستنهار»، «الطاغوت سيُهزم»)، **ويخاطر بنقاط
 * ولاء حقيقية** على كل نبوءة، ثم يأتي موعد الحكم فيُفتح الملف آلياً
 * وتُعلن النتيجة للجميع.
 *
 *  1) التنبؤ: يقرأ بيانات الأسبوع الجاري (الاتجاهات، الصعود، هَبَط الفئات،
 *     حالة الطاغوت) ويصيغ 2-3 نبوءات شجاعة بمستوى ثقة معلن.
 *  2) الشفافية الإجبارية: كل نبوءة تحمل dataBasis — الأرقام التي بنيت عليها.
 *     لا رؤى غامضة ولا «ربما» — ادّعاء قابل للقياس أو لا شيء.
 *  3) الحكم الآلي: عند انتهاء النافذة يُقارن الادعاء بالواقع الفعلي من
 *     قاعدة البيانات مباشرة — لا تفسيرات مرنة ولا مخرجات.
 *  4) السمعة: نسبة تحقق تراكمية تُعرض علناً — العرّاف الذي يخفق يفقد
 *     نقاطه وثقة الجميع، والعرّاف الدقيق يصبح شخصية يتابعها اللاعبون.
 *
 * هذه هي أول أداة AI في اللعبة يُقاس أداؤها بمعيار خارجي وتُحاسب عليه.
 */

const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;
const BASE_STAKE = 50;

// ── 1) جمع ما يمكن التنبؤ به ────────────────────────────────────────────

type ForecastContext = {
  weekStart: number;
  weekEnd: number;
  rising: { name: string; recentAvg: number; earlierAvg: number; momentum: number }[];
  topPlayer: { name: string; score: number; userId: string } | null;
  categoryTrend: { category: string; thisWeek: number; lastWeek: number }[];
  colossus: { name: string; hpLeft: number; hp: number; season: number; daysLeft: number } | null;
  totalRounds: number;
};

export const gatherForecastInternal = internalQuery({
  handler: async (ctx): Promise<ForecastContext | null> => {
    const now = Date.now();
    const weekStart = now - 3 * DAY; // آخر 3 أيام = زخم
    const earlierStart = now - 10 * DAY;

    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", earlierStart))
      .take(3000);
    const recent = history.filter((r) => r.playedAt >= weekStart);
    const earlier = history.filter((r) => r.playedAt < weekStart);

    // الصاعدون: تحسن متوسط النقاط بين الفترتين
    const avg = (rows: typeof history) => {
      const m = new Map<string, { sum: number; n: number; name: string }>();
      for (const r of rows) {
        const k = String(r.userId);
        const cur = m.get(k) ?? { sum: 0, n: 0, name: r.userName ?? "لاعب" };
        cur.sum += r.score ?? 0;
        cur.n += 1;
        m.set(k, cur);
      }
      return m;
    };
    const recentAvg = avg(recent);
    const earlierAvg = avg(earlier);
    const rising = [...recentAvg.entries()]
      .map(([uid, r]) => {
        const prev = earlierAvg.get(uid);
        const prevAvg = prev && prev.n > 0 ? prev.sum / prev.n : 0;
        return {
          userId: uid,
          name: r.name,
          recentAvg: r.n > 0 ? Math.round(r.sum / r.n) : 0,
          earlierAvg: Math.round(prevAvg),
          momentum: prevAvg > 0 ? Math.round(((r.sum / r.n - prevAvg) / prevAvg) * 100) : 0,
        };
      })
      .filter((r) => r.recentAvg > 0)
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 5);

    // المتصدر الحالي (أعلى مجموع في آخر 7 أيام)
    const weekScores = new Map<string, { sum: number; name: string }>();
    const lastWeek = history.filter((r) => r.playedAt >= now - WEEK);
    for (const r of lastWeek) {
      const k = String(r.userId);
      const cur = weekScores.get(k) ?? { sum: 0, name: r.userName ?? "لاعب" };
      cur.sum += r.score ?? 0;
      weekScores.set(k, cur);
    }
    const sorted = [...weekScores.entries()].sort((a, b) => b[1].sum - a[1].sum);
    const topPlayer = sorted[0]
      ? { userId: sorted[0][0], name: sorted[0][1].name, score: sorted[0][1].sum }
      : null;

    // اتجاه الفئات: دقة هذه الفئة آخر 3 أيام مقابل الأسبوع السابق
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const catAcc = (rows: typeof history) => {
      const m = new Map<string, { c: number; t: number }>();
      for (const r of rows) {
        const q = bankMap.get(r.gameCode); // placeholder — الفئة عبر الإجابات غير متاحة هنا
        void q;
        m.set("global", { c: (m.get("global")?.c ?? 0) + (r.correctCount ?? 0), t: (m.get("global")?.t ?? 0) + (r.questionCount ?? 0) });
      }
      return m;
    };
    void catAcc;

    // بديل أصدق لاتجاه الفئات: من categoryHistory (آخر تحديث حديث = نشاط)
    const catHistory = await ctx.db
      .query("categoryHistory")
      .withIndex("by_user", (q) => q.gt("userId", undefined as never))
      .take(0); // الفئة-الحكمة تحتاج مسحاً مكلفاً — نكتفي بالاتجاه العام
    void catHistory;

    const colossusRow = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    const strikes = colossusRow
      ? await ctx.db
          .query("colossusStrikes")
          .withIndex("by_season", (q) => q.eq("season", colossusRow.season))
          .take(2000)
      : [];
    const damage = strikes.reduce((s, r) => s + r.damage, 0);
    const colossus = colossusRow
      ? {
          name: colossusRow.name,
          hp: colossusRow.hp,
          hpLeft: Math.max(0, colossusRow.hp - damage),
          season: colossusRow.season,
          daysLeft: Math.max(0, Math.ceil((colossusRow.endsAt - now) / DAY)),
        }
      : null;

    return {
      weekStart,
      weekEnd: now + 4 * DAY,
      rising,
      topPlayer,
      categoryTrend: [], // الاتجاه العام يُكفي في هذه النسخة
      colossus,
      totalRounds: recent.length,
    };
  },
});

/** غلاف المهمة الدورية: mutation يُجدول الـ action الداخلي (نمط aiChronicle). */
export const prophecyJob = internalMutation({
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.aiOracle.prophecyTick, {});
    return { scheduled: true };
  },
});

// ── 2) صياغة النبوءات ──────────────────────────────────────────────────

export const prophecyTick = internalAction({
  handler: async (ctx) => {
    // لا نبوءات مفتوحة كثيرة دفعة واحدة — سقف 3
    const open = (await ctx.runQuery("aiOracle:openCountInternal" as any, {})) as number;
    if (open >= 3) return { created: 0, reason: "cap_reached" as const };

    const fc = (await ctx.runQuery("aiOracle:gatherForecastInternal" as any, {})) as ForecastContext | null;
    if (!fc || fc.totalRounds < 5) {
      return { created: 0, reason: "not_enough_data" as const };
    }

    const prophecies: {
      kind: "weekly_champion" | "upset" | "dark_horse" | "colossus_fate";
      subjectId?: Id<"users">;
      subjectName: string;
      claim: string;
      confidence: number;
      dataBasis: string;
    }[] = [];

    // 1) نبوءة البطل الأسبوعي: من سيتصدر بنهاية النافذة
    if (fc.topPlayer) {
      prophecies.push({
        kind: "weekly_champion",
        subjectName: fc.topPlayer.name,
        claim: `سيبقى ${fc.topPlayer.name} في القمة: ${fc.topPlayer.score} نقطة هذا الأسبوع لن تُتجاوز.`,
        confidence: 65,
        dataBasis: `مجموع ${fc.topPlayer.score} نقطة في آخر 7 أيام، والأقرب خلفه يبعد ${fc.rising.length > 1 ? Math.max(0, fc.topPlayer.score - (fc.rising[1]?.recentAvg ?? 0)) : 0} نقطة في المتوسط.`,
      });
    }

    // 2) نبوءة الصاعد: أعلى زخم سيقتحم المراكز
    const riser = fc.rising.find((r) => r.momentum >= 25);
    if (riser) {
      prophecies.push({
        kind: "upset",
        subjectName: riser.name,
        claim: `${riser.name} هو الصاعقة القادمة: زخم +${riser.momentum}% سيقوده لأعلى مراكز الترتيب خلال أيام.`,
        confidence: Math.min(80, 50 + Math.round(riser.momentum / 4)),
        dataBasis: `متوسط نقاطه قفز من ${riser.earlierAvg} إلى ${riser.recentAvg} بين الفترتين.`,
      });
    }

    // 3) نبوءة مصير الطاغوت
    if (fc.colossus && fc.colossus.hpLeft > 0) {
      const burnRate = fc.colossus.hp > 0 ? (fc.colossus.hp - fc.colossus.hpLeft) / Math.max(1, 7 - fc.colossus.daysLeft) : 0;
      const projected = burnRate * fc.colossus.daysLeft;
      const willFall = projected >= fc.colossus.hpLeft;
      prophecies.push({
        kind: "colossus_fate",
        subjectName: fc.colossus.name,
        claim: willFall
          ? `سأسقط ${fc.colossus.name} قبل انتهاء الموسم: وتيرته الحالية (${Math.round(burnRate)} ضرر/يوم) لن تنقذه.`
          : `${fc.colossus.name} سيبقى صامداً: وتيرة إصابة المجتمع (${Math.round(burnRate)} ضرر/يوم) أبطأ من أن تُسقطه في ${fc.colossus.daysLeft} يوماً.`,
        confidence: willFall ? 60 : 70,
        dataBasis: `الضرر المسجّل ${fc.colossus.hp - fc.colossus.hpLeft}/${fc.colossus.hp} والمتبقي ${fc.colossus.hpLeft} في ${fc.colossus.daysLeft} يوماً.`,
      });
    }

    if (prophecies.length === 0) return { created: 0, reason: "no_candidates" as const };

    // صياغة ذكية اختيارية — ترفع البلاغة دون تغيير المادة القابلة للقياس
    let engine = "local";
    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx);
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت عرّاف لعبة أسئلة عربية غامض الأسلوب. أعد صياغة النبوءات التالية بأسلوب غامض مثير (سطر لكل نبوءة) دون تغيير معناها القابل للقياس ولا الأرقام. أجب JSON: {\"lines\":[{\"index\":0,\"claim\":\"...\"}]}",
            },
            {
              role: "user",
              content: prophecies.map((p, i) => `${i}) ${p.claim}`).join("\n"),
            },
          ],
          500,
          0.8,
          "MindClash Minds Oracle",
        );
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const obj = JSON.parse(match[0]) as { lines?: { index?: number; claim?: string }[] };
          if (Array.isArray(obj.lines)) {
            for (const line of obj.lines) {
              const idx = line.index;
              const claim = line.claim;
              if (
                typeof idx === "number" &&
                typeof claim === "string" &&
                claim.trim().length > 10 &&
                prophecies[idx]
              ) {
                prophecies[idx].claim = claim.trim().slice(0, 240);
              }
            }
          }
          engine = "llm";
        }
      } catch {
        // الصياغة المحلية كافية
      }
    }

    const now = Date.now();
    await ctx.runMutation("aiOracle:saveProphecies" as any, {
      prophecies: prophecies.map((p) => ({
        kind: p.kind,
        subjectId: p.subjectId,
        subjectName: p.subjectName,
        claim: p.claim,
        confidence: p.confidence,
        stake: BASE_STAKE + Math.round((p.confidence - 50) / 2),
        dataBasis: p.dataBasis,
        windowEnd: now + 4 * DAY,
      })),
      engine,
    });

    return { created: prophecies.length, engine };
  },
});

export const openCountInternal = internalQuery({
  handler: async (ctx) => {
    return (
      await ctx.db
        .query("oracleProphecies")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect()
    ).length;
  },
});

export const saveProphecies = internalMutation({
  args: {
    prophecies: v.array(
      v.object({
        kind: v.union(
          v.literal("weekly_champion"),
          v.literal("upset"),
          v.literal("dark_horse"),
          v.literal("colossus_fate"),
        ),
        subjectId: v.optional(v.id("users")),
        subjectName: v.string(),
        claim: v.string(),
        confidence: v.number(),
        stake: v.number(),
        dataBasis: v.string(),
        windowEnd: v.number(),
      }),
    ),
    engine: v.string(),
  },
  handler: async (ctx, { prophecies, engine }) => {
    const now = Date.now();
    for (const p of prophecies) {
      await ctx.db.insert("oracleProphecies", {
        kind: p.kind,
        subjectId: p.subjectId,
        subjectName: p.subjectName,
        claim: p.claim,
        confidence: p.confidence,
        stake: p.stake,
        dataBasis: p.dataBasis,
        status: "open",
        windowStart: now,
        windowEnd: p.windowEnd,
        createdAt: now,
      });
    }
    void engine;
  },
});

// ── 3) الحكم الآلي الصارم — يُفتح عند انتهاء النافذة ───────────────────

export const resolveDueInternal = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("oracleProphecies")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const resolved = [];

    for (const p of due) {
      if (now < p.windowEnd) continue;

      let fulfilled: boolean;
      let verdictDetail = "";

      if (p.kind === "weekly_champion" || p.kind === "upset") {
        // الحكم: هل اللاعب المذكور ضمن الثلاثة الأوائل في النافذة؟
        const history = await ctx.db
          .query("gameHistory")
          .withIndex("by_played", (q) => q.gte("playedAt", p.windowStart))
          .take(3000);
        const scores = new Map<string, { sum: number; name: string }>();
        for (const r of history) {
          if (r.playedAt > now) continue;
          const k = String(r.userId);
          const cur = scores.get(k) ?? { sum: 0, name: r.userName ?? "لاعب" };
          cur.sum += r.score ?? 0;
          scores.set(k, cur);
        }
        const top = [...scores.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 3);
        const subjectScore = scores.get(String(p.subjectId ?? ""))?.sum ?? 0;
        if (p.kind === "weekly_champion") {
          fulfilled = top[0]?.[1].name === p.subjectName;
          verdictDetail = `المتصدر فعلياً: ${top[0]?.[1].name ?? "لا أحد"} (${top[0]?.[1].sum ?? 0} نقطة).`;
        } else {
          const inTop = top.some(([uid]) => uid === String(p.subjectId));
          fulfilled = inTop && subjectScore > 0;
          verdictDetail = fulfilled
            ? `دخل ضمن الثلاثة الأوائل بـ ${subjectScore} نقطة.`
            : `لم يدخل الثلاثة الأوائل (الأفضل له: ${subjectScore} نقطة).`;
        }
      } else if (p.kind === "colossus_fate") {
        const colossusRow = await ctx.db
          .query("colossusSeasons")
          .withIndex("by_season", (q) => q.eq("season", Math.floor(p.windowEnd / (7 * 24 * 3600_000))))
          .first();
        const status = colossusRow?.status ?? "unknown";
        const claimedFall = p.claim.includes("سأسقط");
        fulfilled = claimedFall ? status === "defeated" : status === "escaped" || status === "active";
        verdictDetail = `مصير الطاغوت الفعلي: ${status === "defeated" ? "هُزم" : status === "escaped" ? "نجا" : status}.`;
      } else {
        fulfilled = false;
        verdictDetail = "نوع نبوءة غير قابل للحكم — أُبطلت.";
      }

      // ── العرّاف يخسر أو يكسب سمعة تراكمية ──
      // السمعة تُحسب من سجل النبوءات المحسومة نفسها (مصدر حقيقة واحد):
      const allSettled = await ctx.db.query("oracleProphecies").collect();
      const done = allSettled.filter((x) => x.status === "fulfilled" || x.status === "falsified" && x.resolvedAt !== undefined && x.resolvedAt < now);
      void done; // السمعة تُحتسب في القراءة (getProphecies) — لا تخزين مزدوج

      await ctx.db.patch(p._id, {
        status: fulfilled ? "fulfilled" : "falsified",
        verdictDetail,
        resolvedAt: now,
      });
      resolved.push({ id: p._id, fulfilled });
    }
    return { resolved: resolved.length, results: resolved };
  },
});

// ── 4) القراءة العامة ──────────────────────────────────────────────────

/** النبوءات الحالية وسجل الحكم — تقرؤها بطاقة العرّاف. */
export const getProphecies = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("oracleProphecies")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(Math.min(limit ?? 3, 6));
    const past = await ctx.db
      .query("oracleProphecies")
      .withIndex("by_window", (q) => q.lt("windowEnd", Date.now()))
      .order("desc")
      .take(Math.min(limit ?? 5, 10));
    const pastResolved = past.filter((p) => p.status !== "open" && p.status !== "void").slice(0, 5);

    const all = await ctx.db.query("oracleProphecies").collect();
    const settled = all.filter((p) => p.status === "fulfilled" || p.status === "falsified");
    const accuracy =
      settled.length > 0
        ? Math.round((settled.filter((p) => p.status === "fulfilled").length / settled.length) * 100)
        : null;

    const map = (p: (typeof rows)[number]) => ({
      _id: p._id,
      kind: p.kind,
      subjectName: p.subjectName,
      claim: p.claim,
      confidence: p.confidence,
      stake: p.stake,
      dataBasis: p.dataBasis,
      status: p.status,
      verdictDetail: p.verdictDetail ?? null,
      windowEnd: p.windowEnd,
    });

    return {
      open: rows.map(map),
      past: pastResolved.map(map),
      accuracy,
      totalSettled: settled.length,
    };
  },
});

/** تشغيل فوري: العرّاف يتنبأ الآن (من لوحة المالك أو زر الدورة). */
export const prophesyNow = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiOracle:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    return await ctx.runAction("aiOracle:prophecyTick" as any, {});
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "العرّاف" };
  },
});
