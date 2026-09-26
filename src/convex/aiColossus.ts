import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { QUESTION_BANK, CATEGORIES } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";
import { DIFFICULTY_LABELS } from "../lib/question-difficulty";

/**
 * 👹 الطاغوت (The Colossus) — عدو جماعي حي يتعلم
 *
 * الأداة الأبعد: عدو واحد يواجهه الموقع كله أسبوعياً، لكنه ليس ثابتاً —
 * إنما **يتعلم من دقة المجتمع في الموسم السابق**:
 *
 *  1) يقرأ الطاغوت دقة المجتمع الحقيقية من سجل ضربات الموسم الفائت:
 *     أي فئات سقط فيها الجميع؟ من هم أفراس النهرة؟
 *  2) يبني ترسانته تكيفياً: يكثر من الأسئلة في الفئات التي جُرح فيها المجتمع،
 *     ويزرع **فخاخاً** في أقوى فئات أفضل لاعبيه — وثقته بالنفس تُقال صراحةً.
 *  3) صحته تُشتق من دقة المجتمع: مجتمع دقيق = طاغوت صلب؛ مجتمع متعثر =
 *     طاغوت متعجرف يقلّل من الشأن — والنص يتغير مع شخصيته.
 *  4) الضرر يُحسب سرعةً ودقةً معاً، وضرباته المسجّلة تُغذّي موسمه القادم.
 *  5) مكافآت من خزينة الولاء عند إسقاطه — والقصة تُكمل في جريدة سجل العقول.
 *
 * الحلقة: مجتمع يلعب → الطاغوت يتعلم → يرجع أشرس → المجتمع يتكيف →
 * ...تعايش تطوري دائم بين اللاعبين والذكاء الاصطناعي.
 */

const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;
const QUESTIONS_PER_FIGHT = 5;
const MAX_STRIKES_PER_USER = 3; // ثلاث ضربات على الطاغوت يومياً

const PERSONAS = [
  { key: "tyrant", name: "الطاغوت المتعجرف", taunt: "أبني ترسانتي من سقطتكم — تعالوا واخسروا مرة أخرى." },
  { key: "sage", name: "الحكيم الغامض", taunt: "أعرف أين تسقط عقولكم... والسؤال: هل تعرفون أنتم؟" },
  { key: "trickster", name: "المخادع", taunt: "زرعت فخاخي في أقوى ما تزعمون إتقانه — بالتوفيق." },
  { key: "warlord", name: "سيّد الحرب", taunt: "كل ضربة تضربوني بها هي درسٌ سأردّه لكم مضاعفاً." },
] as const;

// ── 1) التكيف: قراءة الموسم الفائت وبناء الموسم الجديد ──────────────────

export const evolveSeason = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const season = Math.floor(now / WEEK);

    // موسم نشط بالفعل؟
    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (active) return { created: false, reason: "active_exists" as const };

    // أرشف الموسم الفائت (هُزم أم نجا؟)
    const expired = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_season", (q) => q.lt("season", season))
      .collect();
    for (const s of expired) {
      if (s.status === "active") {
        const strikes = await ctx.db
          .query("colossusStrikes")
          .withIndex("by_season", (q) => q.eq("season", s.season))
          .take(1000);
        const solvers = new Set(strikes.filter((st) => st.correct).map((st) => st.userId)).size;
        await ctx.db.patch(s._id, {
          status: solvers > 0 ? "defeated" : "escaped",
          solversCount: solvers,
        });
      }
    }

    // ── التعلم: دقة المجتمع من سجل ضربات آخر 4 مواسم ──
    const history = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_season", (q) => q.gte("season", season - 4))
      .take(3000);

    const catPerf = new Map<string, { correct: number; total: number }>();
    let overallCorrect = 0;
    let overallTotal = 0;
    // نربط الضربات بالأسئلة عبر الموسم نفسه (questionIds محفوظة في الموسم)
    for (const s of expired.filter((x) => x.status === "active" || x.status === "defeated" || x.status === "escaped")) {
      const strikes = history.filter((st) => st.season === s.season);
      for (const st of strikes) {
        const qid = s.questionIds[st.questionIndex];
        if (!qid) continue;
        const q = QUESTION_BANK.find((qq) => qq.id === qid);
        if (!q) continue;
        const bucket = catPerf.get(q.category) ?? { correct: 0, total: 0 };
        bucket.total += 1;
        if (st.correct) {
          bucket.correct += 1;
          overallCorrect += 1;
        }
        overallTotal += 1;
        catPerf.set(q.category, bucket);
      }
    }

    // مجتمع بلا تاريخ؟ أهداف أولية متوازنة
    const accuracyByCat = [...catPerf.entries()]
      .map(([category, b]) => ({ category, rate: b.total > 0 ? b.correct / b.total : 0.5, total: b.total }))
      .sort((a, b) => a.rate - b.rate);
    const weakCategories = accuracyByCat.slice(0, 4).map((c) => c.category);
    const strongCategories = accuracyByCat.slice(-4).reverse().map((c) => c.category);

    // ── بناء الترسانة التكيفية: 15 سؤالاً ──
    // 60% من فئات الضعف (حيث جُرح المجتمع)، 40% فخاخ في فئات القوة
    const questionIds: string[] = [];
    const used = new Set<string>();
    const pick = (categories: string[], difficulties: string[], count: number) => {
      const pool = QUESTION_BANK.filter(
        (q) =>
          categories.includes(q.category) &&
          difficulties.includes(q.difficulty) &&
          !used.has(q.id),
      );
      for (const q of pool.sort(() => Math.random() - 0.5)) {
        if (questionIds.length >= count && questionIds.length >= 15) break;
        if (used.has(q.id)) continue;
        questionIds.push(q.id);
        used.add(q.id);
        if (questionIds.length >= 15) break;
      }
    };
    const weak = weakCategories.length > 0 ? weakCategories : ["عام", "علوم", "تاريخ", "لغة"];
    const strong = strongCategories.length > 0 ? strongCategories : ["رياضة", "فنون", "جغرافيا"];
    pick(weak, ["medium", "hard", "extreme"], 9); // جبهة الضعف: قاسية
    pick(strong, ["medium", "hard"], 6); // الفخاخ: في بيوت القوة

    // الحصة العادلة إن نقصت الفئات
    if (questionIds.length < 15) {
      pick(CATEGORIES as unknown as string[], ["medium", "hard", "extreme"], 15);
    }

    // ── الصحة: دقة المجتمع تحدد قوة الطاغوت ──
    const communityAccuracy = overallTotal > 0 ? overallCorrect / overallTotal : 0.55;
    const hp = Math.max(60, Math.min(150, Math.round(15 * communityAccuracy * 2 * 15 / 3)));

    // الشخصية تتحرك مع الأداء: مجتمع قوي = طاغوت متعجرف يحتقر؛ ضعيف = حكيم يحترم
    const personaIdx =
      communityAccuracy >= 0.7 ? 0 : communityAccuracy >= 0.55 ? 1 : communityAccuracy >= 0.4 ? 2 : 3;
    const persona = PERSONAS[personaIdx];

    const rowId = await ctx.db.insert("colossusSeasons", {
      season,
      name: persona.name,
      persona: persona.key,
      taunt: persona.taunt,
      hp,
      questionIds,
      weaknesses: weak.slice(0, 2), // فئات مكافأة مضاعفة
      status: "active",
      createdAt: now,
      endsAt: now + WEEK,
    });

    return { created: true as const, season, rowId, hp, communityAccuracy };
  },
});

// ── 2) واجهة المواجهة ───────────────────────────────────────────────────

/** حالة الطاغوت الحالية — تقرؤها واجهة المواجهة. */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const season = Math.floor(Date.now() / WEEK);
    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();

    const userId = await getAuthUserId(ctx);
    let myStrikes: { correct: boolean; damage: number; at: number }[] = [];
    if (userId && active) {
      const rows = await ctx.db
        .query("colossusStrikes")
        .withIndex("by_user_season", (q) => q.eq("userId", userId).eq("season", season))
        .collect();
      myStrikes = rows
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({ correct: r.correct, damage: r.damage, at: r.createdAt }));
    }

    if (!active) return null;

    // الضرر المجموع + الشجعان
    const strikes = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_season", (q) => q.eq("season", active.season))
      .take(2000);
    const totalDamage = strikes.reduce((s, r) => s + r.damage, 0);
    const byUser = new Map<string, { name: string; damage: number; hits: number }>();
    for (const st of strikes) {
      const cur = byUser.get(st.userId) ?? { name: st.userName, damage: 0, hits: 0 };
      cur.damage += st.damage;
      cur.hits += 1;
      byUser.set(st.userId, cur);
    }
    const topSlayers = [...byUser.values()].sort((a, b) => b.damage - a.damage).slice(0, 3);

    return {
      season: active.season,
      name: active.name,
      persona: active.persona,
      taunt: active.taunt,
      hp: active.hp,
      damageTaken: totalDamage,
      hpLeft: Math.max(0, active.hp - totalDamage),
      weaknesses: active.weaknesses,
      questionsPerFight: QUESTIONS_PER_FIGHT,
      myStrikesLeft: MAX_STRIKES_PER_USER - myStrikes.length,
      myStrikes,
      topSlayers,
      endsAt: active.endsAt,
      fightersCount: byUser.size,
    };
  },
});

/** إطلاق ضربة: أسئلة المواجهة الحية (5 أسئلة من الترسانة، بلا تكرار للمُجاب). */
export const startStrike = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (!active) throw new Error("لا موسم نشط حالياً — انتظر التطور القادم");

    const season = active.season;
    const mine = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_user_season", (q) => q.eq("userId", userId).eq("season", season))
      .collect();
    if (mine.length >= MAX_STRIKES_PER_USER) {
      throw new Error(`استنفدت ضرباتك (${MAX_STRIKES_PER_USER}) — عد غداً بذكاء أكبر`);
    }

    // 5 أسئلة عشوائية من الترسانة
    const shuffled = [...active.questionIds].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_FIGHT);
    return {
      season: active.season,
      colossusName: active.name,
      persona: active.persona,
      taunt: active.taunt,
      weaknesses: active.weaknesses,
      questionIds: shuffled,
    };
  },
});

/** الأسئلة الكاملة للضربة الجارية (الخادم يتحقق من الجلسة عبر الموسم). */
export const getStrikeQuestions = query({
  args: { season: v.number() },
  handler: async (ctx, { season }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_season", (q) => q.eq("season", season))
      .first();
    if (!active || active.status !== "active") return null;
    const mine = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_user_season", (q) => q.eq("userId", userId).eq("season", season))
      .collect();
    if (mine.length >= MAX_STRIKES_PER_USER) return null;

    // أسئلة من البنك
    const map = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const questions = active.questionIds
      .map((qid) => map.get(qid))
      .filter((q): q is NonNullable<typeof q> => q !== undefined)
      .map((q) => ({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: [...q.options],
      }));
    return {
      season: active.season,
      colossusName: active.name,
      taunt: active.taunt,
      weaknesses: active.weaknesses,
      questions,
    };
  },
});

/** تسجيل الضربة: الضرر = سرعة × صعوبة، ومكافأة مضاعفة على فئات ضعف الطاغوت. */
export const submitStrike = mutation({
  args: {
    season: v.number(),
    answers: v.array(
      v.object({ questionId: v.string(), selected: v.number(), elapsedMs: v.number() }),
    ),
  },
  handler: async (ctx, { season, answers }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_season", (q) => q.eq("season", season))
      .first();
    if (!active || active.status !== "active") throw new Error("الموسم انتهى");
    if (answers.length === 0) throw new Error("لا إجابات");

    const mine = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_user_season", (q) => q.eq("userId", userId).eq("season", season))
      .collect();
    if (mine.length >= MAX_STRIKES_PER_USER) throw new Error("استنفدت ضرباتك");

    const map = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    const now = Date.now();
    let correct = 0;
    let damage = 0;
    let index = mine.length;
    const details: { questionId: string; correct: boolean; correctIndex: number; damage: number }[] = [];

    for (const a of answers) {
      const q = map.get(a.questionId);
      if (!q) continue;
      const isCorrect = a.selected === q.correctIndex;
      const speedFactor = Math.max(0, Math.min(1, 1 - a.elapsedMs / 20000));
      let hit = 0;
      if (isCorrect) {
        correct += 1;
        hit = 3 + Math.round(speedFactor * 4); // 3-7 ضرر أساسي
        if (active.weaknesses.includes(q.category)) hit *= 2; // نقطة الضعف: مضاعفة
      }
      damage += hit;
      details.push({ questionId: a.questionId, correct: isCorrect, correctIndex: q.correctIndex, damage: hit });
      await ctx.db.insert("colossusStrikes", {
        season,
        userId,
        userName: me.name ?? "لاعب",
        questionIndex: index,
        correct: isCorrect,
        elapsedMs: a.elapsedMs,
        damage: hit,
        createdAt: now,
      });
      index += 1;
    }

    // هل سقط الطاغوت؟
    const allStrikes = await ctx.db
      .query("colossusStrikes")
      .withIndex("by_season", (q) => q.eq("season", season))
      .take(3000);
    const totalDamage = allStrikes.reduce((s, r) => s + r.damage, 0);
    const defeated = totalDamage >= active.hp;

    let defeatedNow = false;
    if (defeated && !active.defeatedBy) {
      defeatedNow = true;
      await ctx.db.patch(active._id, {
        status: "defeated",
        defeatedBy: allStrikes.filter((r) => r.correct).length,
        solversCount: new Set(allStrikes.filter((r) => r.correct).map((r) => r.userId)).size,
      });
    }

    // مكافأة الولاء عند المساهمة في الإسقاط
    if (defeatedNow) {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: 100,
        reason: `⚔️ شاركت في إسقاط ${active.name}`,
      });
    } else if (damage >= 10) {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: 10 + correct * 5,
        reason: "ضربة على الطاغوت",
      });
    }

    return {
      correct,
      total: details.length,
      damage,
      hpLeft: Math.max(0, active.hp - totalDamage),
      defeated: defeatedNow || defeated,
      details,
    };
  },
});

// ── 3) توليد الاستفزاز الذكي (اختياري — يرفع الشخصية لدرجة أعلى) ────────

export const sharpenTaunt = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiColossus:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");

    const active = (await ctx.runQuery("aiColossus:getActiveInternal" as any, {})) as {
      name: string;
      persona: string;
      hp: number;
      weaknesses: string[];
    } | null;
    if (!active) throw new Error("لا موسم نشط");

    await ensureAiRuntime(ctx);
    if (!getOpenRouterKey()) throw new Error("لا مزوّد AI مفعّل");

    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            "أنت كاتب شخصيات شريرة لعبة أسئلة عربية. اكتب استفزازاً من سطرين لعدو جماعي يواجه المجتمع، بشخصية معطاة، بأسلوب حاد مسرحي عربي فصيح. أجب بالنص فقط.",
        },
        {
          role: "user",
          content: `الشخصية: ${active.name}\nصحته: ${active.hp}\nنقاط ضعفه (لا يذكرها): ${active.weaknesses.join("، ")}`,
        },
      ],
      150,
      0.9,
      "MindClash Minds Colossus",
    );
    const clean = raw.trim().replace(/^["«]|["»]$/g, "").slice(0, 240);
    if (clean.length < 15) throw new Error("صياغة غير مقبولة — حاول مجدداً");

    await ctx.runMutation("aiColossus:updateTauntInternal" as any, { taunt: clean });
    return { taunt: clean };
  },
});

export const getActiveInternal = internalQuery({
  handler: async (ctx) => {
    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (!active) return null;
    return {
      name: active.name,
      persona: active.persona,
      hp: active.hp,
      weaknesses: active.weaknesses,
    };
  },
});

export const updateTauntInternal = internalMutation({
  args: { taunt: v.string() },
  handler: async (ctx, { taunt }) => {
    const active = await ctx.db
      .query("colossusSeasons")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (active) await ctx.db.patch(active._id, { taunt });
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "قائد الجيش" };
  },
});

// ── 4) تطور دوري: تُسجَّل في aiCron (أسبوعي) ────────────────────────────

// ملاحظة: evolveSeason أعلاه هو نقطة الدخول المباشرة للمهمة الدورية —
// تسجيلها في aiCron يتم عبر internal.aiColossus.evolveSeason مباشرة
// (نفس نمط maintenance.pruneAll). لا حاجة لغلاف إضافي.
