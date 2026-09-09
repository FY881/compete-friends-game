/**
 * ═══════════════════════════════════════════════════════════════════════
 * موجّة 8 — البطولة التلقائية يديرها الذكاء
 *
 * نظام يجري بلا تدخل بشري:
 *  - كل ساعة: إن لم توجد بطولة نشطة → أطلق بطولة بأسماء وتصعيد متجدد
 *    (تُختار دورياً من قائمة أسماء ذكية)، وتُسجَّل في سجلّ القرارات.
 *  - كل ساعة أيضاً: أي بطولة تجاوزت نهايتها → تُنهى، يُتوَّج الفائزون
 *    الثلاثة، ويُمنح الفائز الأول لقب «البطل» تلقائياً (نقاط ولاء).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const AUTO_NAMES = [
  "بطولة نهاية الأسبوع 🏆",
  "ساحة الأساطير الأسبوعية ⚔️",
  "تحدي العقول الكبير 🧠",
  "دورة الأبطال 🔥",
  "ملحمة النقاط 💎",
  "غزوة الذكاء 🌟",
  "درع الأسبوع 🛡️",
];

const AUTO_DESCRIPTIONS = [
  "بطولة تلقائية يديرها الذكاء — العب جولاتك واجمع أعلى مجموع",
  "من سيصل القمة هذا الأسبوع؟ العب وتنافس تلقائياً",
  "كل جولة تحتسب — أفضل جولاتك فقط تدخل مجموعك",
];

async function logDecision(
  ctx: MutationCtx,
  entry: { action: string; detail: string; severity: "low" | "medium" | "high" },
) {
  await ctx.db.insert("aiDecisionLog", {
    system: "autoadmin",
    actorName: "مدير البطولات الآلي",
    action: entry.action,
    detail: entry.detail,
    severity: entry.severity,
    createdAt: Date.now(),
  });
}

/** منسّق البطولات — يُستدعى من cron كل ساعة. */
export const manage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1) أنهِ أي بطولة تجاوزت نهايتها
    const activeRows = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const t of activeRows) {
      if (t.endsAt > now) continue;

      const entries = await ctx.db
        .query("tournamentEntries")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", t._id))
        .collect();
      const top = entries.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

      await ctx.db.patch(t._id, {
        status: "ended",
        endsAt: now,
        winnerIds: top.map((e) => e.userId),
      });

      // مكافآت ولاء: 200 / 120 / 60 نقطة
      const PRIZES = [200, 120, 60];
      for (let i = 0; i < top.length; i++) {
        await ctx.runMutation(internal.loyalty.awardPoints, {
          userId: top[i].userId,
          amount: PRIZES[i],
          reason: `المركز ${i + 1} في «${t.name}» (+${PRIZES[i]})`,
        });
      }

      await logDecision(ctx, {
        action: "auto_tournament_ended",
        detail: `أنهى «${t.name}» — الفائز: ${top[0]?.userName ?? "لا مشاركين"} (${top.length} مشارك)`,
        severity: "medium",
      });
    }

    // 2) أطلق بطولة جديدة إن لم توجد
    const stillActive = await ctx.db
      .query("tournaments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (stillActive.some((t) => t.endsAt > now)) return { action: "none" };

    // اسم متجدد حسب رقم الأسبوع (لا يتكرر بسرعة)
    const weekIndex = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    const name = AUTO_NAMES[weekIndex % AUTO_NAMES.length];
    const description = AUTO_DESCRIPTIONS[weekIndex % AUTO_DESCRIPTIONS.length];

    await ctx.db.insert("tournaments", {
      name,
      description,
      status: "active",
      startsAt: now,
      endsAt: now + 7 * 24 * 60 * 60 * 1000,
      bestRoundsCount: 5,
      createdAt: now,
    });

    await logDecision(ctx, {
      action: "auto_tournament_started",
      detail: `أطلق «${name}» تلقائياً لمدة أسبوع — تحتسب أفضل 5 جولات`,
      severity: "low",
    });

    return { action: "created", name };
  },
});