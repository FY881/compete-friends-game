import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { QUESTION_BANK } from "./questions";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * 🧬 عقل القمة التطوري (Summit Mind)
 *
 * الأداة الأخيرة: لعبتك لم تعد تحلل العقول — بل **تورّثها**.
 *
 * المفهوم: كل لاعب عبقري يترك خلفه «جينات معرفية» — فئات أقواهم، فئات
 * وهمهم، سرعة إجابته، وأخطاؤه المتكررة. عندما يغيب لاعب (أسبوع بلا لعب)،
 * عقله **يتحلل إلى جينات** تُنشر في بنك الجينات العام. عندما ينضم لاعب
 * جديد أو لاعب متعثر، يستلم «وصية عقلية»: ميراث من أقوى بصمة متوافقة —
 * فئات يبدأ التدريب منها، وأخطاء يجنّبها دون أن يرتكبها.
 *
 *  1) 🧬 بنك الجينات: بصمات اللاعبين الغائبين تتحلل إلى جينات موثقة
 *  2) 👶 الوصية العقلية: لاعب متعثر يستلم ميراثاً من عقله التوأم الراحل
 *  3) 🌳 شجرة النسب: كل عقلك المُستلم يعرف من ورث — وكل وارث يُحيي اسم واهبه
 *  4) 📜 ميثاق العقل: نص توصية يصنعه الذكاء من بصمة الواهب، يقرأه الوارث
 *
 * النتيجة: معرفة اللاعبين القدامى لا تموت — تتحول إلى تراث يُبنى عليه،
 * واللعبة تحتفظ بذاكرة جماعية تعيش أطول من أي لاعب.
 */

const DAY = 24 * 3600_000;
const GHOST_AFTER_DAYS = 7; // غياب 7 أيام = عقله مؤهل للتحلل
const MIN_SAMPLE = 10;

// ── 1) التحلل: بصمات الغائبين تُحوَّل إلى جينات ──────────────────────────

export const decomposeGhostMinds = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - GHOST_AFTER_DAYS * DAY;
    const recent = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", cutoff))
      .take(3000);
    const activeUsers = new Set(recent.map((r) => String(r.userId)));

    // بصمات من aiMentor (نفس قراءة gamePlayers) — الغائبون فقط
    const fps = (await ctx.runQuery(internal.aiSummit.readFingerprints, {})) as {
      userId: string;
      name: string;
      accByCat: Record<string, number>;
      overall: number;
      sample: number;
      lastSeen: number;
    }[];

    const existing = new Set(
      (await ctx.db.query("mindGenealogy").take(500)).map((g) => String(g.ancestorId)),
    );

    let decomposed = 0;
    for (const fp of fps) {
      if (activeUsers.has(fp.userId)) continue;
      if (existing.has(fp.userId)) continue;
      if (fp.sample < MIN_SAMPLE) continue;

      // أعلى فئتين وأضعف فئة = الجينات
      const cats = Object.entries(fp.accByCat).sort((a, b) => b[1] - a[1]);
      if (cats.length < 2) continue;
      const geneStrong = cats[0][0];
      const geneSecond = cats[1][0];
      const geneWeak = cats[cats.length - 1][0];

      await ctx.db.insert("mindGenealogy", {
        ancestorId: fp.userId as never,
        ancestorName: fp.name,
        geneStrong,
        geneSecond,
        geneWeak,
        strengthAcc: Math.round(cats[0][1] * 100),
        overallAcc: Math.round(fp.overall * 100),
        lastSeen: fp.lastSeen,
        inheritedBy: undefined,
        inheritedAt: undefined,
        charter: undefined,
        createdAt: now,
      });
      decomposed += 1;
    }
    return { decomposed };
  },
});

export const readFingerprints = internalQuery({
  handler: async (ctx) => {
    const rows = await ctx.db.query("gamePlayers").take(4000);
    const bankMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
    type Acc = {
      name: string;
      accByCat: Record<string, { c: number; t: number }>;
      total: { c: number; t: number };
      lastSeen: number;
    };
    const byUser = new Map<string, Acc>();
    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      if (answers.length < 3) continue;
      let acc = byUser.get(String(row.userId));
      if (!acc) {
        acc = { name: row.name ?? "لاعب", accByCat: {}, total: { c: 0, t: 0 }, lastSeen: row.joinedAt ?? 0 };
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
      }
    }
    const out = [];
    for (const [uid, acc] of byUser) {
      if (acc.total.t < MIN_SAMPLE) continue;
      const accByCat: Record<string, number> = {};
      for (const [cat, b] of Object.entries(acc.accByCat)) accByCat[cat] = b.c / Math.max(1, b.t);
      out.push({
        userId: uid,
        name: acc.name,
        accByCat,
        overall: acc.total.c / Math.max(1, acc.total.t),
        sample: acc.total.t,
        lastSeen: acc.lastSeen,
      });
    }
    return out;
  },
});

// ── 2) الميراث: لاعب متعثر يستلم وصية عقلية ──────────────────────────────

export const claimLegacy = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiSummit:getMeInternal" as any, {})) as {
      userId: string;
      name: string;
    } | null;
    if (!me) throw new Error("يجب تسجيل الدخول أولاً");

    // بصمتي — لأعرف أين أعاني
    const fps = (await ctx.runQuery(internal.aiSummit.readFingerprints, {})) as {
      userId: string;
      accByCat: Record<string, number>;
      overall: number;
    }[];
    const mine = fps.find((f) => f.userId === me.userId);
    const myWeak = mine
      ? Object.entries(mine.accByCat).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null
      : null;

    // أقرب جينات متاحة: تطابق أقوى جين مع ضعفي (أثمن وصية)
    const available = (await ctx.runQuery("aiSummit:getAvailableGenes" as any, {})) as {
      _id: string;
      ancestorId: string;
      ancestorName: string;
      geneStrong: string;
      geneSecond: string;
      geneWeak: string;
      strengthAcc: number;
      overallAcc: number;
    }[];
    if (available.length === 0) throw new Error("بنك الجينات فارغ — تتحلل العقول الغائبة دورياً");

    let best = available[0];
    let bestScore = -1;
    for (const g of available) {
      let score = 0;
      if (myWeak && g.geneStrong === myWeak) score += 10; // يملك قوتي الناقص
      if (myWeak && g.geneWeak === myWeak) score -= 3; // نفس ضعفي = أقل فائدة
      score += g.overallAcc / 20;
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }

    // ميثاق العقل: نص توصية من الواهب للوارث
    let charter = `ميراث ${best.ancestorName}: كانت قوته في «${best.geneStrong}» (${best.strengthAcc}%) ووضعه في «${best.geneWeak}». ابدأ من قوته، واحذر ضعفه.`;
    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx as never);
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت كاتب وصايا عقلية لعبة أسئلة عربية. اكتب وصية من لاعب خبير راحل (لعبة) لوارث جديد: سطرين — أين قوته وكيف يبني عليها، وأين وهمه وكيف يجنّبه. طابع إنساني مؤثر بلا مبالغة.",
            },
            {
              role: "user",
              content: `الواهب: ${best.ancestorName} — قوته: ${best.geneStrong} (${best.strengthAcc}%)، ثانويته: ${best.geneSecond}، ضعفه: ${best.geneWeak}. دقته العامة ${best.overallAcc}%. الوارث: ${me.name}${myWeak ? ` — ضعفه الحالي: ${myWeak}` : ""}`,
            },
          ],
          200,
          0.8,
          "MindClash Summit Charter",
        );
        const clean = raw.trim().slice(0, 280);
        if (clean.length > 20) charter = clean;
      } catch {
        /* الوصية المحلية كافية */
      }
    }

    await ctx.runMutation("aiSummit:assignLegacy" as any, {
      geneId: best._id as never,
      heirId: me.userId as never,
      heirName: me.name,
      charter,
    });

    return { ancestor: best.ancestorName, charter, geneStrong: best.geneStrong, geneWeak: best.geneWeak };
  },
});

export const getAvailableGenes = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("mindGenealogy").take(300);
    return rows.filter((r) => !r.inheritedBy);
  },
});

export const assignLegacy = internalMutation({
  args: {
    geneId: v.id("mindGenealogy"),
    heirId: v.id("users"),
    heirName: v.string(),
    charter: v.string(),
  },
  handler: async (ctx, { geneId, heirId, heirName, charter }) => {
    await ctx.db.patch(geneId, {
      inheritedBy: heirId,
      inheritedAt: Date.now(),
      charter,
    });
    const doc = await ctx.db.get(geneId);
    await ctx.db.insert("aiDecisionLog", {
      system: "summit",
      actorName: "عقل القمة",
      action: "legacy_inherited",
      targetId: String(heirId),
      targetName: heirName,
      detail: `ورث جينات ${doc?.ancestorName ?? "واهب"} — ${charter.slice(0, 120)}`,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

// ── 3) قراءات الواجهة ────────────────────────────────────────────────────

export const getMyLegacy = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db.query("mindGenealogy").take(300);
    return rows.find((r) => r.inheritedBy === userId) ?? null;
  },
});

export const getGenealogyStats = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("mindGenealogy").take(300);
    return {
      total: rows.length,
      inherited: rows.filter((r) => r.inheritedBy).length,
      available: rows.filter((r) => !r.inheritedBy).length,
    };
  },
});

export const getMyAncestry = query({
  handler: async (ctx) => {
    // هل بصمتي تحللت؟ (أنا واهب)
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db.query("mindGenealogy").take(300);
    const asAncestor = rows.find((r) => r.ancestorId === userId);
    return asAncestor ? { geneStrong: asAncestor.geneStrong, heirName: null as string | null } : null;
  },
});

export const getMeInternal = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    return { userId, name: me.name ?? "لاعب" };
  },
});

// ── 4) المهمة الدورية ────────────────────────────────────────────────────

export const summitJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return ctx.runMutation(internal.aiSummit.decomposeGhostMinds, {});
  },
});
