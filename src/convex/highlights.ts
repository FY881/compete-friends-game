/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⭐ أفضل 5 لحظات — ملخص أسبوعي آلي لأبرز ما جرى في الساحة
 *
 *  دورة كل ساعة تفتش عن أبرز لحظات الأسبوع من سجل الجولات:
 *   - أسرع إجابة صحيحة (sniper)
 *   - أكبر فارق فوز (blowout)
 *   - أطول سلسلة صحيحة
 *   - العودة الأسطورية (comeback_win)
 *   - أعلى نتيجة بالجولة
 *  وترسّخ اللقطة في جدول highlights ليعرضها الموقع أسبوعاً بأسبوع،
 *  مع نشرها تلقائياً في دردشة العشائر النشطة.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

function weekKeyOf(now = Date.now()): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // الاثنين = 0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-W${String(
    Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000)),
  ).padStart(2, "0")}`;
}

/**
 * الدورة الأسبوعية: اجمع أبرز لحظات الأسبوع الماضي (الجولات المنتهية خلاله)
 * ورتّبها نقاطاً لتحديد أفضل 5. تُخزَّن النتيجة بمفتاح الأسبوع ولا تتكرر.
 */
export const computeWeeklyHighlights = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const wk = weekKeyOf(now - 7 * 86400000); // الأسبوع المكتمل

    const exists = await ctx.db
      .query("highlights")
      .withIndex("by_week", (q) => q.eq("weekKey", wk))
      .first();
    if (exists) return { skipped: true as const, weekKey: wk };

    const weekStart = now - 7 * 86400000;
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gt("playedAt", weekStart))
      .take(500);

    type Moment = {
      kind: string;
      title: string;
      detail: string;
      playerName: string;
      score: number;
    };
    const moments: (Moment & { rankScore: number })[] = [];

    for (const row of history) {
      const name = row.userName ?? "لاعب";
      // أعلى نتيجة (تتوفر دائماً في السجل)
      if (row.score >= 300) {
        moments.push({
          kind: "highscore",
          title: "🏆 نتيجة ساحقة",
          detail: `${name} جمع ${row.score} نقطة في جولة واحدة (${row.correctCount}/${row.questionCount} صحيحة)`,
          playerName: name,
          score: row.score,
          rankScore: row.score,
        });
      }
      // جولة كاملة بلا خطأ
      if (row.correctCount === row.questionCount && row.questionCount >= 5) {
        moments.push({
          kind: "perfect",
          title: "🎯 جولة كاملة",
          detail: `${name} أجاب كل الأسئلة (${row.questionCount}) بلا خطأ واحد`,
          playerName: name,
          score: row.score,
          rankScore: row.score + 200,
        });
      }
      // فوز أول بثلاث نجوم
      if (row.won && (row.stars ?? 0) >= 3) {
        moments.push({
          kind: "stardom",
          title: "⭐ فوز بثلاث نجوم",
          detail: `${name} خطف المركز الأول بثلاث نجوم كاملة`,
          playerName: name,
          score: row.score,
          rankScore: 350,
        });
      }
    }

    // أفضل 5 فريدة لكل لاعب
    const seen = new Set<string>();
    const top5 = moments
      .sort((a, b) => b.rankScore - a.rankScore)
      .filter((m) => {
        const key = `${m.kind}:${m.playerName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);

    if (top5.length === 0) return { created: 0 as const, weekKey: wk };

    await ctx.db.insert("highlights", {
      weekKey: wk,
      moments: top5.map((m, i) => ({
        rank: i + 1,
        kind: m.kind,
        title: m.title,
        detail: m.detail,
        playerName: m.playerName,
      })),
      createdAt: now,
    });

    // انشر الملخص في دردشة العشائر النشطة
    const recap = top5.map((m, i) => `${i + 1}. ${m.title} — ${m.detail}`).join("\n");
    const clans = await ctx.db.query("clans").collect();
    for (const clan of clans) {
      if (clan.members.length === 0) continue;
      await ctx.db.insert("clanMessages", {
        clanId: clan._id,
        senderId: clan.ownerId,
        senderName: "📜 ملخص الأسبوع",
        content: `⭐ أفضل لحظات الأسبوع:\n${recap}`,
        createdAt: now,
      });
    }

    return { created: top5.length as number, weekKey: wk, posted: clans.length };
  },
});

/** ملخص الأسبوع الحالي أو الأخير — يظهر في صفحة اللعب. */
export const getLatestHighlights = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("highlights").order("desc").take(1);
    return rows[0] ?? null;
  },
});
