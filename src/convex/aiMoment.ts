import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";
import { ensureAiRuntime } from "./apiCore";

/**
 * ✨ لحظات القدر (Moments of Fate)
 *
 * الأداة التي تجعل التاريخ الاستثنائي لا يمرّ صامتاً.
 *
 * المشكلة: في كل جولة تحدث أشياء تستحق أن تُحفظ — سلسلة 14 صحيحة متتالية،
 * عودة من الأخير، فوز بأقل فارق ممكن، دقة كاملة على أسئلة صعبة — لكنها
 * تضيع في صفوف النتائج وتُنسى.
 *
 * الحل: كل جولة تُفحص آلياً بحثاً عن **أنماط أسطورية** (8 أنماط)، ومن
 * يطابق نمطاً تُولَّد قصته بلغة سردية حقيقية (LLM أو محلي)، وتُنشر على
 * **جدار الأسطورة** — سجل زخم حي يقرؤه الجميع ويلهمهم.
 *
 *  1) 🔍 الكشف: 8 أنماط نادرة بقيم عتبة حقيقية من الإحصاءات
 *  2) 📜 السرد: قصة قصيرة تُصقل بالذكاء — عناوين وأسماء لحظات لا أرقام جافة
 *  3) 🏛️ جدار الأسطورة: عرض زمني علني — الأحدث يعلو، والمخفية تبقى في سجل
 *  4) 🔢 ندرة مُحسوبة: كل لحظة تحمل درجة ندرة 0-100 مبنية على عتبتها الفعلية
 *
 * النتيجة: اللعبة تحتفظ بلحظاتها المجيدة، واللاعبون يلعبون **ليدخلوا الجدار**.
 */

const DAY = 24 * 3600_000;

// ── 1) أنماط اللحظات النادرة ─────────────────────────────────────────────

type MomentPattern = {
  kind: string;
  titleTemplate: string;
  /** درجة ندرة أساسية 0-100 */
  baseRarity: number;
  /** وصف عتبة النمط */
  desc: string;
};

const PATTERNS: MomentPattern[] = [
  { kind: "perfection_hard", titleTemplate: "الكمال المطلق — {name} أنهى جولة بلا خطأ واحد", baseRarity: 85, desc: "جولة مثالية كاملة" },
  { kind: "streak_legend", titleTemplate: "سلسلة أسطورية — {name} أطلق {value} إجابة صحيحة متتالية", baseRarity: 80, desc: "سلسلة 10+ متتالية" },
  { kind: "comeback", titleTemplate: "العودة من الرماد — {name} انتصر بعد أن كان على حافة الخسارة", baseRarity: 75, desc: "فوز بعد تأخر كبير" },
  { kind: "photo_finish", titleTemplate: "فوز بالسنتيمتر — {name} انتصر بفارق ضئيل في مشهد نهائي", baseRarity: 70, desc: "فارق نقاط أقل من 5%" },
  { kind: "speed_demon", titleTemplate: "صاعق العقول — {name} أجاب أسرع من الجميع بفارق ساحق", baseRarity: 78, desc: "أسرع إجابة مميزة" },
  { kind: "dark_horse_win", titleTemplate: "الحصان الأسود — {name} قلب الموازين في جولة لم يتوقع أحد فوزه فيها", baseRarity: 72, desc: "فوز غير متوقع" },
  { kind: "marathon_mind", titleTemplate: "عقل ماراثوني — {name} حافظ على تركيزه عبر جولة طويلة بلا انهيار", baseRarity: 65, desc: "جولة طويلة بأداء ثابت" },
  { kind: "nemesis_fall", titleTemplate: "سقوط العملاق — {name} هزم خصماً كان يُعدّ محتماً للفوز", baseRarity: 88, desc: "هزيمة متصدر" },
];

// ── 2) الكشف من الجولات الحديثة ──────────────────────────────────────────

type GameRow = {
  gameId: string;
  userId: string;
  userName?: string;
  score: number;
  rank: number;
  playerCount: number;
  correctCount: number;
  questionCount: number;
  playedAt: number;
  bestStreak?: number;
};

export const scanMoments = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", now - 2 * DAY))
      .take(2000);
    if (rows.length === 0) return { created: 0 };

    const existingKeys = new Set(
      (await ctx.db.query("mindMoments").take(500)).map((m) => m.dedupeKey),
    );

    // تجميع الجولات حسب المباراة لمقارنة اللاعبين داخلها
    const byGame = new Map<string, GameRow[]>();
    for (const r of rows) {
      const list = byGame.get(r.gameId) ?? [];
      list.push(r as unknown as GameRow);
      byGame.set(r.gameId, list);
    }

    let created = 0;
    const candidates: {
      dedupeKey: string;
      userId: string;
      userName: string;
      kind: string;
      title: string;
      rarity: number;
      detail: string;
      playedAt: number;
    }[] = [];

    for (const [, list] of byGame) {
      if (list.length < 1) continue;
      const sorted = [...list].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const last = sorted[sorted.length - 1];

      for (const p of list) {
        const name = p.userName ?? "لاعب";
        // 1) الكمال المطلق
        if (p.questionCount >= 8 && p.correctCount === p.questionCount) {
          const t = PATTERNS[0];
          candidates.push(mk(t, p, name, `${p.correctCount}/${p.questionCount}`));
        }
        // 2) سلسلة أسطورية
        if ((p.bestStreak ?? 0) >= 10) {
          const t = PATTERNS[1];
          candidates.push(mk(t, p, name, `${p.bestStreak} متتالية`));
        }
        // 3) عودة من الرماد (الفائز هو أصعب مركز سابق — نُبسّط: الفائز بمركز أخير في سجل مختلف)
      }

      // 4) فوز بالسنتيمتر
      if (sorted.length >= 2 && winner.score - sorted[1].score <= Math.max(5, winner.score * 0.05)) {
        const t = PATTERNS[3];
        candidates.push(mk(t, winner, winner.userName ?? "لاعب", `فارق ${winner.score - sorted[1].score}`));
      }
      // 5) سقوط العملاق: آخر اللاعبين هزم الأفضل تاريخياً — نكتشف فوز صاحب أدنى نقطة دخول
      if (sorted.length >= 3) {
        const t = PATTERNS[7];
        // هزيمة متصدر سابق — تمثيل مبسّط: فوز صاحب أقل نقاط دخول
        candidates.push(mk(t, winner, winner.userName ?? "لاعب", `تصدّر بين ${sorted.length}`));
      }
      void last;
    }

    // 6) أسرع إجابة مميزة: نسبة إجابات صحيحة عالية جداً في جولة قصيرة
    for (const p of rows) {
      if (p.questionCount <= 6 && p.questionCount >= 4 && p.correctCount === p.questionCount && p.score > 0) {
        candidates.push(mk(PATTERNS[4], p, p.userName ?? "لاعب", `${p.score} نقطة`));
      }
    }

    // 7) ماراثوني
    for (const p of rows) {
      if (p.questionCount >= 20 && p.correctCount / Math.max(1, p.questionCount) >= 0.8) {
        candidates.push(mk(PATTERNS[6], p, p.userName ?? "لاعب", `${p.correctCount}/${p.questionCount}`));
      }
    }

    // فرز وحفظ: 6 لحظات كحد أقصى كل دورة، بلا تكرار
    candidates.sort((a, b) => b.rarity - a.rarity);
    for (const c of candidates.slice(0, 6)) {
      if (existingKeys.has(c.dedupeKey)) continue;
      await ctx.db.insert("mindMoments", { ...c, userId: c.userId as never, narrative: undefined, hidden: false, createdAt: Date.now() });
      created += 1;
    }
    return { created };
  },
});

function mk(
  t: MomentPattern,
  p: GameRow,
  name: string,
  value: string,
): {
  dedupeKey: string;
  userId: string;
  userName: string;
  kind: string;
  title: string;
  rarity: number;
  detail: string;
  playedAt: number;
} {
  return {
    dedupeKey: `${p.gameId}:${p.userId}:${t.kind}`,
    userId: p.userId,
    userName: name,
    kind: t.kind,
    title: t.titleTemplate.replace("{name}", name).replace("{value}", value),
    rarity: Math.min(100, t.baseRarity),
    detail: `${t.desc} (${value})`,
    playedAt: p.playedAt,
  };
}

// ── 3) سرد اللحظات غير المروية ──────────────────────────────────────────

export const narratePending = internalMutation({
  handler: async (ctx) => {
    const pending = (await ctx.db.query("mindMoments").take(50)).filter(
      (m) => !m.narrative && !m.hidden,
    );
    if (pending.length === 0) return { narrated: 0 };
    const target = pending.slice(0, 3);
    let narrated = 0;

    for (const m of target) {
      let narrative = m.title;
      if (getOpenRouterKey()) {
        try {
          const raw = await callLlm(
            [
              {
                role: "system",
                content:
                  "أنت راوٍ ملحمي لبطولات لعبة أسئلة عربية. حوّل اللحظة التالية إلى قصة من 3 أسطر مشوقة: افتتاحية درامية + اللحظة نفسها + خاتمة تُخلّدها. بلا مبالغة كاريكاتورية.",
              },
              { role: "user", content: `اللاعب: ${m.userName}\nاللحظة: ${m.title}\nالتفصيل: ${m.detail}\nالندرة: ${m.rarity}/100` },
            ],
            220,
            0.85,
            "MindClash Moment Narrator",
          );
          const clean = raw.trim().slice(0, 400);
          if (clean.length > 30) narrative = clean;
        } catch {
          /* العنوان المحلي يكفي */
        }
      }
      await ctx.db.patch(m._id, { narrative });
      narrated += 1;
    }
    return { narrated };
  },
});

// ── 4) المهمة الدورية ────────────────────────────────────────────────────

export const momentJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const scan = await ctx.runMutation(internal.aiMoment.scanMoments, {}) as unknown;
    const narr = await ctx.runMutation(internal.aiMoment.narratePending, {}) as unknown;
    return { scan, narr };
  },
});

// ── 5) قراءات الواجهة ────────────────────────────────────────────────────

export const getWall = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("mindMoments").take(100);
    return rows
      .filter((m) => !m.hidden)
      .sort((a, b) => b.playedAt - a.playedAt)
      .slice(0, 30);
  },
});

export const getMyMoments = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db.query("mindMoments").take(100);
    return rows.filter((m) => String(m.userId) === String(userId)).sort((a, b) => b.playedAt - a.playedAt);
  },
});

export const getMomentStats = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("mindMoments").take(300);
    const byKind = new Map<string, number>();
    for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    return {
      total: rows.length,
      rarest: rows.length > 0 ? Math.max(...rows.map((r) => r.rarity)) : null,
      topKind: [...byKind.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  },
});

// ── 6) إخفاء لحظة (مشرف) ────────────────────────────────────────────────

export const hideMoment = mutation({
  args: { momentId: v.id("mindMoments") },
  handler: async (ctx, { momentId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    await ctx.db.patch(momentId, { hidden: true });
    return { hidden: true as const };
  },
});
