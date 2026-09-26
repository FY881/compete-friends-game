import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * 📰 سجل العقول (Minds Chronicle)
 *
 * جريدة الموقع الذكية — الأداة التي تحوّل أسبوعاً كاملاً من اللعب الحقيقي
 * إلى إصدار صحفي مكتمل تقرؤه الجماعة كلها:
 *
 *  1) يُجمع أرشيف الأسبوع من جداول اللعب الحقيقية: نتائج الجولات،
 *     أفضل الدرجات، أكبر سلاسل، عدد الأبطال، فئات الأسبوع الأكثر حماساً،
 *     وأحداث اللعب النظيف.
 *  2) يُبنى «مكتب التحرير»: كل قسم له محرر (بطل الأسبوع، معركة الأسبوع،
 *     صعود العقول، رقم الأسبوع، كشف الأقنعة) — والأرقام تُحسب محلياً أولاً،
 *     فلا يخترع الذكاء الاصطناعي شيئاً.
 *  3) يكتب الذكاء الاصطناعي العناوين والافتتاحية والسرد بأسلوب صحفي رياضي
 *     عربي مشوّق — والفشل يعني تراجعاً آمناً لنفس الأقسام بصياغة محلية.
 *  4) يُنشر الإصدار للجميع، ويُفتح من بطاقة «جريدة الموقع» — كل لاعب يقرأ
 *     قصة مجتمعه هذا الأسبوع.
 *
 * التوليد مجدول أسبوعياً عبر نظام aiCron، مع إمكانية توليد فوري للمالك.
 */

// ── 1) تجميع أرشيف الأسبوع (internalQuery — كل الأرقام حقيقية) ──────────

type WeekStats = {
  weekStart: number;
  weekEnd: number;
  roundsPlayed: number;
  activePlayers: number;
  topScores: { name: string; score: number; correct: number; total: number }[];
  biggestStreak: { name: string; bestStreak: number } | null;
  mostWinning: { name: string; wins: number } | null;
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number;
  fastestPerfect: { name: string; correct: number; total: number } | null;
  fairPlayEvents: number;
  newChampions: number;
};

export const collectWeekInternal = internalQuery({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
  },
  handler: async (ctx, { weekStart, weekEnd }): Promise<WeekStats> => {
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", weekStart))
      .take(2000);
    const rows = history.filter((r) => r.playedAt < weekEnd);

    const perPlayer = new Map<string, { name: string; score: number; correct: number; total: number; wins: number; rounds: number; bestStreak: number }>();
    let totalCorrect = 0;
    let totalQuestions = 0;
    const playerIds = new Set<string>();

    for (const r of rows) {
      const key = String(r.userId);
      playerIds.add(key);
      totalCorrect += r.correctCount ?? 0;
      totalQuestions += r.questionCount ?? 0;
      const cur = perPlayer.get(key) ?? {
        name: r.userName ?? "لاعب",
        score: 0,
        correct: 0,
        total: 0,
        wins: 0,
        rounds: 0,
        bestStreak: 0,
      };
      cur.score += r.score ?? 0;
      cur.correct += r.correctCount ?? 0;
      cur.total += r.questionCount ?? 0;
      if (r.won) cur.wins += 1;
      cur.rounds += 1;
      perPlayer.set(key, cur);
    }

    const topScores = [...perPlayer.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const mostWinning =
      [...perPlayer.values()].sort((a, b) => b.wins - a.wins)[0] ?? null;

    // أكبر سلسلة: من نتائج الجولات المكتملة في gameHistory نفسها
    // (gamePlayers مفهرس بالغرفة فقط — لسنا بحاجته: bestStreak يُقاس في الأرشيف)
    let biggestStreak: { name: string; bestStreak: number } | null = null;
    const weekGames = new Set(rows.map((r) => String(r.gameId)));
    if (weekGames.size > 0 && weekGames.size <= 200) {
      for (const gid of weekGames) {
        const gps = await ctx.db
          .query("gamePlayers")
          .withIndex("by_game", (q) => q.eq("gameId", gid as never))
          .collect();
        for (const gp of gps) {
          if (gp.joinedAt < weekStart || gp.joinedAt >= weekEnd) continue;
          if (gp.bestStreak > (biggestStreak?.bestStreak ?? 0)) {
            biggestStreak = { name: gp.name, bestStreak: gp.bestStreak };
          }
        }
      }
    }

    const fairPlayEvents = (
      await ctx.db
        .query("fairPlayLog")
        .withIndex("by_at", (q) => q.gte("at", weekStart))
        .take(200)
    ).length;

    return {
      weekStart,
      weekEnd,
      roundsPlayed: rows.length,
      activePlayers: playerIds.size,
      topScores,
      biggestStreak,
      mostWinning,
      totalCorrect,
      totalQuestions,
      accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      fastestPerfect: null, // يُستخرج أدناه عبر bestStreak كوكيل مؤقت
      fairPlayEvents,
      newChampions: topScores.length,
    };
  },
});

// ── 2) التوليد: بناء الأقسام محلياً ثم صياغة ذكية ───────────────────────

function localSections(s: WeekStats): { key: string; title: string; body: string; emoji: string }[] {
  const sections: { key: string; title: string; body: string; emoji: string }[] = [];
  const hero = s.topScores[0];
  if (hero) {
    sections.push({
      key: "champion",
      emoji: "👑",
      title: `بطل الأسبوع: ${hero.name}`,
      body: `بـ ${hero.score} نقطة عبر الجولات، و${hero.correct} إجابة صحيحة من ${hero.total} — ${hero.name} يوقّع أسبوعه باسمه على صدارة سجل العقول.`,
    });
  }
  if (s.topScores.length >= 2) {
    const [a, b] = s.topScores;
    sections.push({
      key: "battle",
      emoji: "⚔️",
      title: "معركة الأسبوع",
      body: `صراع على القمة لم يهدأ: ${a.name} (${a.score}) في مواجهة ${b.name} (${b.score}) — ${Math.abs(a.score - b.score) <= 100 ? "فارق لا يتجاوز نصل السكين!" : "صراع القوة يُحسم بالتفاصيل الصغيرة."}`,
    });
  }
  if (s.biggestStreak) {
    sections.push({
      key: "streak",
      emoji: "🔥",
      title: "السلسلة الأعنف",
      body: `${s.biggestStreak.name} أشعل ${s.biggestStreak.bestStreak} إجابات متتالية في جولة واحدة — جدار صامد أمامه الجميع.`,
    });
  }
  sections.push({
    key: "numbers",
    emoji: "📊",
    title: "رقم الأسبوع",
    body: `${s.roundsPlayed} جولة، ${s.activePlayers} عقل ناشط، ودقة عامة ${s.accuracy}% — ساحة لا تنام، وأرقام تنمو بثقة.`,
  });
  if (s.fairPlayEvents > 0) {
    sections.push({
      key: "fairplay",
      emoji: "⚖️",
      title: "كشف الأقنعة",
      body: `${s.fairPlayEvents} إشارة لعب نظيف رصدها الحكم الآلي هذا الأسبوع — الساحة نظيفة، والمحتالون يعرفون الطريق.`,
    });
  } else {
    sections.push({
      key: "fairplay",
      emoji: "🛡️",
      title: "أسبوع نظيف",
      body: "لا إشارات غش تستحق الذكر — أدمغة تتنافس بالمعرفة وحدها، وهذه أجمل أخبار الأسبوع.",
    });
  }
  return sections;
}

export const generateChronicle = internalAction({
  args: {
    weekStart: v.number(),
    weekEnd: v.number(),
    edition: v.string(),
  },
  handler: async (ctx, { weekStart, weekEnd, edition }) => {
    const stats = (await ctx.runQuery("aiChronicle:collectWeekInternal" as any, {
      weekStart,
      weekEnd,
    })) as WeekStats;

    // أسبوع فارغ؟ لا إصدار
    if (stats.roundsPlayed === 0) return { published: false as const, reason: "no_games" };

    const sections = localSections(stats);
    let headline = `سجل العقول — إصدار ${edition}`;
    let intro = `أسبوع جديد يُختم في ساحة حرب العقول: ${stats.roundsPlayed} جولة و${stats.activePlayers} عقل ناشط كتبوا فصول هذا العدد.`;
    let engine = "local";

    if (getOpenRouterKey()) {
      try {
        await ensureAiRuntime(ctx);
        const factSheet = `أرقام الأسبوع الحقيقية (لا تخترع غيرها):
- الجولات: ${stats.roundsPlayed} | اللاعبون النشطون: ${stats.activePlayers}
- الدقة العامة: ${stats.accuracy}% (${stats.totalCorrect}/${stats.totalQuestions})
- المتصدرون: ${stats.topScores.map((t) => `${t.name} (${t.score} نقطة، ${t.correct}/${t.total})`).join("، ")}
${stats.biggestStreak ? `- أكبر سلسلة: ${stats.biggestStreak.name} بـ ${stats.biggestStreak.bestStreak} إجابة متتالية` : ""}
${stats.mostWinning && stats.mostWinning.wins > 0 ? `- الأكثر فوزاً: ${stats.mostWinning.name} (${stats.mostWinning.wins} فوزاً)` : ""}
- إشارات اللعب النظيف: ${stats.fairPlayEvents}`;

        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت رئيس تحرير جريدة رياضية عربية أسبوعية لجماعة لعبة أسئلة تسمى «حرب العقول». أسلوبك: صحفي مشوّق، فصيح، عناوين قوية، افتتاحية قصيرة مركزة (3 أسطر). تلتزم بالأرقام المرسلة حرفياً ولا تخترع أي شيء. أجب JSON حصراً: {\"headline\":\"...\",\"intro\":\"...\",\"sections\":[{\"key\":\"champion|battle|streak|numbers|fairplay\",\"title\":\"...\",\"body\":\"...\"}]} اكتب sections للقسمين champion وbattle على الأقل، وأعد صياغة ما تريد من بقية الأقسام بنفس المفاتيح.",
            },
            { role: "user", content: `${factSheet}\n\nاكتب إصدار جريدة هذا الأسبوع.` },
          ],
          1200,
          0.7,
          "MindClash Minds Chronicle",
        );
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const obj = JSON.parse(match[0]) as Record<string, unknown>;
          if (typeof obj.headline === "string" && obj.headline.trim()) {
            headline = obj.headline.trim().slice(0, 160);
          }
          if (typeof obj.intro === "string" && obj.intro.trim()) {
            intro = obj.intro.trim().slice(0, 600);
          }
          if (Array.isArray(obj.sections)) {
            const aiSections = (obj.sections as Record<string, unknown>[])
              .filter(
                (s) =>
                  typeof s.key === "string" &&
                  typeof s.title === "string" &&
                  typeof s.body === "string" &&
                  s.title.trim() && s.body.trim(),
              )
              .slice(0, 6)
              .map((s) => ({
                key: String(s.key),
                title: String(s.title).slice(0, 120),
                body: String(s.body).slice(0, 700),
                emoji:
                  sections.find((loc) => loc.key === String(s.key))?.emoji ?? "📰",
              }));
            if (aiSections.length >= 2) {
              // ادمج: الأقسام الذكية تغلب المحلية بنفس المفتاح
              const merged = [...aiSections];
              for (const loc of sections) {
                if (!merged.some((m) => m.key === loc.key)) merged.push(loc);
              }
              sections.length = 0;
              sections.push(...merged);
            }
          }
          engine = "llm";
        }
      } catch {
        // بلا شبكة؟ الإصدار المحلي جاهز أصلاً
      }
    }

    await ctx.runMutation("aiChronicle:upsertIssue" as any, {
      edition,
      weekStart,
      weekEnd,
      headline,
      intro,
      sections,
      engine,
    });

    return { published: true as const, engine, sections: sections.length };
  },
});

export const upsertIssue = internalMutation({
  args: {
    edition: v.string(),
    weekStart: v.number(),
    weekEnd: v.number(),
    headline: v.string(),
    intro: v.string(),
    sections: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        body: v.string(),
        emoji: v.string(),
      }),
    ),
    engine: v.string(),
  },
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("chronicleIssues")
      .withIndex("by_edition", (q) => q.eq("edition", a.edition))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        headline: a.headline,
        intro: a.intro,
        sections: a.sections,
        engine: a.engine,
        publishedAt: Date.now(),
        status: "published",
      });
      return existing._id;
    }
    return await ctx.db.insert("chronicleIssues", {
      edition: a.edition,
      weekStart: a.weekStart,
      weekEnd: a.weekEnd,
      status: "published",
      headline: a.headline,
      intro: a.intro,
      sections: a.sections,
      engine: a.engine,
      publishedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

// ── 3) مهمة أسبوعية — تُسجَّل في aiCron ─────────────────────────────────

/** نقطة دخول مهمة الـ cron: تُجدول توليد الإصدار (mutation → action). */
export const weeklyEdition = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const d = new Date(now);
    const jan1 = new Date(d.getFullYear(), 0, 1).getTime();
    const weekNo = Math.max(1, Math.ceil((now - jan1) / (7 * 86400_000)));
    const edition = `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    await ctx.scheduler.runAfter(0, internal.aiChronicle.generateChronicle, {
      weekStart: now - 7 * 86400_000,
      weekEnd: now,
      edition,
    });
    return { scheduled: true, edition };
  },
});

// ── 4) القراءة العامة + إدارة المالك ───────────────────────────────────

/** آخر إصدار منشور — يقرؤه الجميع من بطاقة الجريدة. */
export const getLatestIssue = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("chronicleIssues")
      .withIndex("by_published", (q) => q.gt("publishedAt", 0))
      .order("desc")
      .take(1);
    const issue = rows[0];
    if (!issue) return null;
    return {
      edition: issue.edition,
      weekStart: issue.weekStart,
      weekEnd: issue.weekEnd,
      headline: issue.headline,
      intro: issue.intro,
      sections: issue.sections,
      engine: issue.engine ?? "local",
      publishedAt: issue.publishedAt ?? issue.createdAt,
    };
  },
});

/** أرشيف الإصدارات السابقة. */
export const getArchive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("chronicleIssues")
      .withIndex("by_published", (q) => q.gt("publishedAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 8, 20));
    return rows.map((r) => ({
      edition: r.edition,
      headline: r.headline,
      publishedAt: r.publishedAt ?? r.createdAt,
      sectionCount: r.sections.length,
    }));
  },
});

/** توليد فوري — للمالك من لوحة الإدارة. */
export const generateNow = action({
  handler: async (ctx) => {
    const me = (await ctx.runQuery("aiChronicle:getStaffActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    const now = Date.now();
    const d = new Date(now);
    const jan1 = new Date(d.getFullYear(), 0, 1).getTime();
    const weekNo = Math.max(1, Math.ceil((now - jan1) / (7 * 86400_000)));
    const edition = `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    const result = (await ctx.runAction("aiChronicle:generateChronicle" as any, {
      weekStart: now - 7 * 86400_000,
      weekEnd: now,
      edition,
    })) as { published: boolean; engine?: string; reason?: string };
    if (!result.published) {
      throw new Error("لا جولات كافية هذا الأسبوع لإصدار جريدة.");
    }
    return result;
  },
});

export const getStaffActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "رئيس التحرير" };
  },
});
