import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * 🧬 بازار العقول (Minds Bazaar)
 *
 * أول أداة لا تنظر إلى لاعب واحد — بل إلى **شبكة العقول كلها**.
 *
 * من كل إجابة حقيقية في gamePlayers نبني «بصمة عقل»: دقة لكل فئة × سرعة
 * لكل صعوبة. ثم نقارن البصمات ببعضها (مسافة إقليدية موزونة) ونستخرج:
 *
 *  1) 👯 توأم الروح — أقرب عقل لـعقلك: يتجاوب مع نفس أسئلتك، يخطئ حيث تخطئ.
 *     التحدّي معه دائماً متوازن وممتع، والتكافل يفتح «وعد التوأم».
 *  2) ⚔️ نقيضك — أبعد عقل عنك: قوته في ضعفك وضعفه في قوتك. مواجهته هي
 *     أثمن درس تدريبي في اللعبة كلها، ومعارفتها تكشف عمى فئاتك.
 *  3) 🗺️ مسار العقل — خطة أسبوعية شخصية: بؤرة التدريب، هدف السرعة،
 *     وسؤال التحدّي — مشتقّة من أضعف فئاتك، وتُصقل ردودها بالذكاء.
 *
 * كل شيء من بيانات حقيقية 100% — لا افتراضات، لا مكياج.
 */

const MIN_ANSWERS = 8; // شرط البصمة الموثوقة
const DAY = 24 * 3600_000;

type Fingerprint = {
  userId: Id<"users">;
  name: string;
  accByCat: Record<string, number>; // 0..1
  speedByDiff: Record<string, number>; // ms
  overall: number; // 0..1
  sample: number;
};

// ── 1) قراءة البصمات من الإجابات الحقيقية ────────────────────────────────

export const collectFingerprints = internalQuery({
  handler: async (ctx): Promise<Fingerprint[]> => {
    const rows = await ctx.db.query("gamePlayers").take(4000);
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));

    type Acc = {
      name: string;
      accByCat: Record<string, { c: number; t: number }>;
      speedByDiff: Record<string, number[]>;
      total: { c: number; t: number };
    };
    const byUser = new Map<string, Acc>();

    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      if (answers.length < 3) continue;
      let acc = byUser.get(String(row.userId));
      if (!acc) {
        acc = { name: row.name ?? "لاعب", accByCat: {}, speedByDiff: {}, total: { c: 0, t: 0 } };
        byUser.set(String(row.userId), acc);
      }
      for (const a of answers) {
        const q = bankMap.get(a.questionId);
        if (!q) continue;
        acc.total.t += 1;
        if (a.correct) acc.total.c += 1;
        const cat = acc.accByCat[q.category] ?? { c: 0, t: 0 };
        cat.t += 1;
        if (a.correct) cat.c += 1;
        acc.accByCat[q.category] = cat;
        (acc.speedByDiff[q.difficulty] ??= []).push(a.elapsedMs);
      }
    }

    const out: Fingerprint[] = [];
    for (const [uid, acc] of byUser) {
      if (acc.total.t < MIN_ANSWERS) continue;
      const accByCat: Record<string, number> = {};
      for (const [cat, b] of Object.entries(acc.accByCat)) accByCat[cat] = b.c / Math.max(1, b.t);
      const speedByDiff: Record<string, number> = {};
      for (const [diff, arr] of Object.entries(acc.speedByDiff)) {
        speedByDiff[diff] = arr.reduce((s, n) => s + n, 0) / Math.max(1, arr.length);
      }
      out.push({
        userId: uid as Id<"users">,
        name: acc.name,
        accByCat,
        speedByDiff,
        overall: acc.total.c / Math.max(1, acc.total.t),
        sample: acc.total.t,
      });
    }
    return out;
  },
});

// ── 2) مسافة العقول: كلما قلّت، اقترب العقلان ────────────────────────────

function mindDistance(a: Fingerprint, b: Fingerprint): number {
  // دقة الفئات المشتركة (وزن رئيسي)
  const cats = new Set([...Object.keys(a.accByCat), ...Object.keys(b.accByCat)]);
  let d = 0;
  let w = 0;
  for (const c of cats) {
    const da = a.accByCat[c] ?? 0.5;
    const db = b.accByCat[c] ?? 0.5;
    d += (da - db) ** 2 * 10;
    w += 10;
  }
  // سرعة الصعوبات المشتركة (وزن أقل، مُعايَرة إلى 0..1)
  const diffs = new Set([...Object.keys(a.speedByDiff), ...Object.keys(b.speedByDiff)]);
  for (const diff of diffs) {
    const sa = a.speedByDiff[diff] ?? 8000;
    const sb = b.speedByDiff[diff] ?? 8000;
    d += (Math.min(1, Math.abs(sa - sb) / 10000)) ** 2 * 3;
    w += 3;
  }
  // الفارق العام
  d += (a.overall - b.overall) ** 2 * 5;
  w += 5;
  return w > 0 ? Math.sqrt(d / w) : 999;
}

// ── 3) المهمة الدورية: تحديث شبكة التوأمات ───────────────────────────────

export const refreshSoulmates = internalMutation({
  handler: async (ctx) => {
    const fps = await ctx.runQuery(internal.aiMentor.collectFingerprints, {});
    if (fps.length < 2) return { pairs: 0, note: "بصمات غير كافية" };

    // امسح الجدول القديم وأعد البناء (الشبكة صغيرة ومحكومة)
    const old = await ctx.db.query("mindSoulmates").take(600);
    for (const doc of old) await ctx.db.delete(doc._id);

    let pairs = 0;
    // لكل لاعب: أقرب (توأم) وأبعد (نقيض)
    for (const me of fps) {
      let twin: Fingerprint | null = null;
      let twinD = Infinity;
      let nemesis: Fingerprint | null = null;
      let nemD = -1;
      for (const other of fps) {
        if (other.userId === me.userId) continue;
        const d = mindDistance(me, other);
        if (d < twinD) {
          twinD = d;
          twin = other;
        }
        if (d > nemD) {
          nemD = d;
          nemesis = other;
        }
      }
      if (!twin || !nemesis) continue;
      await ctx.db.insert("mindSoulmates", {
        userId: me.userId,
        userName: me.name,
        twinId: twin.userId,
        twinName: twin.name,
        twinAffinity: Math.max(0, Math.round((1 - Math.min(1, twinD / 2)) * 100)),
        nemesisId: nemesis.userId,
        nemesisName: nemesis.name,
        nemesisContrast: Math.min(100, Math.round(nemD * 50)),
        createdAt: Date.now(),
      });
      pairs += 1;
    }
    return { pairs };
  },
});

// ── 4) قراءات الواجهة ────────────────────────────────────────────────────

export const getMySoulmate = query({
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

export const getMyPath = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("mindPaths")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return rows[0] ?? null;
  },
});

export const getBazaarStats = query({
  handler: async (ctx) => {
    const mates = await ctx.db.query("mindSoulmates").take(500);
    const paths = await ctx.db.query("mindPaths").take(500);
    return { souls: mates.length, paths: paths.length };
  },
});

// ── 5) مسار العقل: خطة شخصية من أضعف الفئات (action بصقل ذكي) ────────────

export const buildMyPath = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiMentor:getMeInternal" as any, {})) as {
      userId: Id<"users">;
      name: string;
    } | null;
    if (!me) throw new Error("يجب تسجيل الدخول أولاً");

    const fps = (await ctx.runQuery(internal.aiMentor.collectFingerprints, {})) as Fingerprint[];
    const mine = fps.find((f) => f.userId === me.userId);
    if (!mine) throw new Error("تحتاج 8 إجابات على الأقل لبناء بصمة عقلك");

    // أضعف فئتين وأقوى فئة من بصمتي الحقيقية
    const catRows = Object.entries(mine.accByCat).sort((a, b) => a[1] - b[1]);
    if (catRows.length < 1) throw new Error("بصمة غير كافية — العب جولتين أولاً");
    const weakest = catRows[0][0];
    const secondWeakest = catRows[1]?.[0] ?? weakest;
    const strongest = [...catRows].sort((a, b) => b[1] - a[1])[0][0];
    const weakAcc = Math.round(catRows[0][1] * 100);
    const strongAcc = Math.round(Math.max(...catRows.map(([, v]) => v)) * 100);

    // إحصاء البنك لتحديد حجم المورد
    const bankCount = QUESTION_BANK.filter((q) => q.category === weakest).length;

    // صقل نص الخطة بالذكاء (متاح دائماً بديل محلي)
    let coachNote = `ركّز هذا الأسبوع على «${weakest}» — دقتك فيها ${weakAcc}% مقابل ${strongAcc}% في «${strongest}». ${bankCount} سؤالاً بانتظارك.`;
    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx);
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت مدرب عقول محترف في لعبة أسئلة عربية. اكتب ملاحظة تحفيزية قصيرة (سطرين) للاعب تشرح له لماذا ضعف فئة معينة يستحق أولويته هذا الأسبوع، وكيف يوازن تدريبه. عربية مباشرة بلا حشو.",
            },
            {
              role: "user",
              content: `اللاعب: ${me.name}\nأضعف فئة: ${weakest} (دقة ${weakAcc}%)\nثاني أضعف: ${secondWeakest}\nأقوى فئة: ${strongest} (دقة ${strongAcc}%)`,
            },
          ],
          180,
          0.7,
          "MindClash Minds Bazaar",
        );
        const clean = raw.trim().slice(0, 220);
        if (clean.length > 15) coachNote = clean;
      } catch {
        // الملاحظة المحلية كافية
      }
    }

    const existing = (await ctx.runQuery("aiMentor:getMyPathInternal" as any, {})) as {
      _id: Id<"mindPaths">;
    } | null;
    const doc = {
      userId: me.userId,
      focusCategory: weakest,
      secondCategory: secondWeakest,
      strengthCategory: strongest,
      weakAcc,
      strongAcc,
      coachNote,
      weeklyTarget: 12,
      speedTargetMs: 9000,
      challengeQuestionId: pickChallengeId(weakest),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.runMutation("aiMentor:upsertPath" as any, { id: existing._id, doc });
    } else {
      await ctx.runMutation("aiMentor:upsertPath" as any, { id: null, doc });
    }
    return doc;
  },
});

function pickChallengeId(category: string): string | undefined {
  const pool = QUESTION_BANK.filter((q) => q.category === category && q.difficulty === "hard");
  const q = pool[Math.floor(Math.random() * pool.length)] ?? QUESTION_BANK.find((x) => x.category === category);
  return q?.id;
}

export const getMeInternal = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    return { userId, name: me.name ?? "لاعب" };
  },
});

export const getMyPathInternal = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("mindPaths")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    return rows[0] ?? null;
  },
});

export const upsertPath = internalMutation({
  args: {
    id: v.union(v.id("mindPaths"), v.null()),
    doc: v.object({
      userId: v.id("users"),
      focusCategory: v.string(),
      secondCategory: v.string(),
      strengthCategory: v.string(),
      weakAcc: v.number(),
      strongAcc: v.number(),
      coachNote: v.string(),
      weeklyTarget: v.number(),
      speedTargetMs: v.number(),
      challengeQuestionId: v.optional(v.string()),
      updatedAt: v.number(),
    }),
  },
  handler: async (ctx, { id, doc }) => {
    if (id) await ctx.db.patch(id, doc);
    else await ctx.db.insert("mindPaths", doc);
  },
});

// ── 6) وعد التوأم: تحدٍّ متبادل بين التوأمين (mutation حقيقي) ────────────

export const challengeMyTwin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const rows = await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    const mate = rows[0];
    if (!mate) throw new Error("لا يوجد توأم بعد — انتظر تحديث الشبكة");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    await ctx.db.insert("mindPacts", {
      fromId: userId,
      fromName: me.name ?? "لاعب",
      toId: mate.twinId,
      toName: mate.twinName,
      kind: "twin_challenge",
      message: `تحدّي توأم الروح: دقتكما متقاربة ${mate.twinAffinity}% — من الأفضل هذا الأسبوع؟`,
      status: "pending",
      createdAt: Date.now(),
    });
    return { sent: true as const, to: mate.twinName };
  },
});

export const getMyBonds = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("mindPacts")
      .withIndex("by_to", (q) => q.eq("toId", userId))
      .take(20);
    return rows;
  },
});
