import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getSettingsData, isOwnerEmail, type ModSettings } from "./owner";
import { callOpenRouter, parseVerdict, type AiVerdict } from "./moderation";

// ---------------------------------------------------------------------------
// «المدير الآلي» — ذكاء اصطناعي يدير شؤون الموقع تلقائياً.
//
// يعمل كل 15 دقيقة عبر مجدول Convex (crons.ts) دون أي تدخل بشري:
//   1. يراجع البلاغات المفتوحة بالذكاء الاصطناعي ويطبّق العقوبات تلقائياً.
//   2. ينظّف الغرف القديمة/العالقة تلقائياً.
//   3. يرفع العقوبات على المخالفين المتكررين (تحذيرات مكررة).
//   4. يكتب تقريراً مفصّلاً: إحصاءات + مشاكل + الحل الجاهز لكل مشكلة
//      (غالباً كود جاهز) ليُرسل للمطوّر فيُطبّقه فوراً.
// ---------------------------------------------------------------------------

const STALE_WAITING_MS = 12 * 60 * 60 * 1000; // lobby untouched for 12h → delete
const STUCK_PLAYING_MS = 30 * 60 * 1000; // a game stuck for 30 min → finalize
const MAX_REPORTS_PER_SWEEP = 8; // cost cap per sweep
const ESCALATION_WARNINGS = 3; // 3+ warnings → automatic 24h mute
const ESCALATION_MUTE_MS = 24 * 60 * 60 * 1000;
const REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // keep reports 7 days

type SweepIssue = {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  fix: string;
};

/** Shared sweep logic — used by the 15-min cron and the manual "run now". */
async function performSweep(ctx: {
  runQuery: (q: any, args: any) => Promise<any>;
  runMutation: (m: any, args: any) => Promise<any>;
}): Promise<void> {
  const settings: ModSettings = await ctx.runQuery(
    internal.autoAdmin.getSettingsForSweep,
    {},
  );
  if (!settings.aiAdminEnabled) return; // the owner turned the administrator off

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  const issues: SweepIssue[] = [];
  let reportsReviewed = 0;
  let punishmentsApplied = 0;
  let roomsCleaned = 0;
  let usersEscalated = 0;

  // ── 1. Review open reports with the AI + auto-apply punishments ────────
  const openReports = await ctx.runQuery(internal.autoAdmin.getOpenReports, {
    limit: MAX_REPORTS_PER_SWEEP,
  });
  const rulesText: string[] = await ctx.runQuery(
    internal.moderation.getActiveRulesText,
    {},
  );

  if (openReports.length > 0 && !apiKey) {
    issues.push({
      severity: "high",
      title: "مفتاح OpenRouter غير مضبوط — لا يمكن فحص البلاغات",
      detail: `يوجد ${openReports.length} بلاغ مفتوح بانتظار مراجعة الذكاء الاصطناعي لكن مفتاح OpenRouter غير موجود.`,
      fix: "أضف OPENROUTER_API_KEY (المفتاح الكامل) في تبويب «المفاتيح / API Keys» في المنصة. بدونها لا يعمل الرقيب الآلي ولا المدير الآلي.",
    });
  } else {
    for (const report of openReports) {
      try {
        const content = [
          `اللاعب المُبلَّغ عنه: ${report.targetName}`,
          `سبب البلاغ: ${report.reason}`,
          report.details ? `التفاصيل: ${report.details}` : null,
          `مُقدِّم البلاغ: ${report.reporterName}`,
        ]
          .filter(Boolean)
          .join("\n");
        const verdict: AiVerdict = await callOpenRouter(
          apiKey,
          settings.aiModel,
          rulesText,
          content,
        );
        reportsReviewed += 1;
        if (
          settings.aiAutoApply &&
          !verdict.compliant &&
          verdict.suggestedAction !== "none"
        ) {
          punishmentsApplied += 1;
        }
        await ctx.runMutation(internal.moderation.recordAiReview, {
          reportId: report._id,
          verdict: {
            compliant: verdict.compliant,
            violation: verdict.violation ?? undefined,
            severity: verdict.severity,
            suggestedAction: verdict.suggestedAction,
            suggestedDurationMs: verdict.suggestedDurationMs ?? undefined,
            reasoning: verdict.reasoning,
          },
          autoApply: settings.aiAutoApply,
        });
      } catch (error) {
        await ctx.runMutation(internal.moderation.recordAiReview, {
          reportId: report._id,
          error: error instanceof Error ? error.message : "خطأ غير معروف",
          autoApply: false,
        });
      }
    }
  }

  // ── 2. Clean stale waiting rooms + stuck playing games ─────────────────
  const now = Date.now();
  const staleWaiting = await ctx.runQuery(internal.autoAdmin.getStaleWaitingRooms, {
    olderThan: STALE_WAITING_MS,
  });
  for (const game of staleWaiting) {
    await ctx.runMutation(internal.autoAdmin.cleanupRoom, {
      gameId: game._id,
    });
    roomsCleaned += 1;
  }

  const stuckGames = await ctx.runQuery(internal.autoAdmin.getStuckPlayingGames, {
    olderThan: STUCK_PLAYING_MS,
  });
  for (const game of stuckGames) {
    await ctx.runMutation(internal.autoAdmin.forceFinishGame, {
      gameId: game._id,
    });
    roomsCleaned += 1;
  }

  // ── 3. Escalate repeat violators (3+ warnings, not yet punished) ───────
  const repeatViolators = await ctx.runQuery(
    internal.autoAdmin.getRepeatViolators,
    { minWarnings: ESCALATION_WARNINGS },
  );
  for (const user of repeatViolators) {
    await ctx.runMutation(internal.autoAdmin.escalateUser, {
      userId: user._id,
      muteMs: ESCALATION_MUTE_MS,
    });
    usersEscalated += 1;
  }

  // ── 4. Health counts for the report ─────────────────────────────────────
  const counts = await ctx.runQuery(internal.autoAdmin.getSiteCounts, {});

  // ── 5. Assemble issues ──────────────────────────────────────────────────
  if (!apiKey) {
    // already added above when reports were waiting
    if (openReports.length === 0) {
      issues.push({
        severity: "high",
        title: "مفتاح OpenRouter غير مضبوط",
        detail: "المدير الآلي يعمل لكنه لا يستطيع مراجعة البلاغات بالذكاء الاصطناعي بدون المفتاح.",
        fix: "أضف OPENROUTER_API_KEY في تبويب «المفاتيح / API Keys» بالمنصة، ثم اضغط «تشغيل الآن».",
      });
    }
  }
  if (counts.openReportsLeft > 0) {
    issues.push({
      severity: "medium",
      title: "بلاغات تنتظر المراجعة",
      detail: `لا يزال ${counts.openReportsLeft} بلاغاً مفتوحاً لم يُراجع بعد.`,
      fix: "لا حاجة لتدخل — ستُراجع في الجولة القادمة للمدير الآلي (خلال 15 دقيقة) أو اضغط «تشغيل الآن».",
    });
  }
  if (staleWaiting.length > 0 || stuckGames.length > 0) {
    issues.push({
      severity: "low",
      title: "غرف قديمة نُظّفت تلقائياً",
      detail: `حُذفت ${staleWaiting.length} غرفة لوبي مهجورة وأُنهيت ${stuckGames.length} جولة عالقة — لا شيء للقيام به.`,
      fix: "لا حاجة لتدخل — التنظيف تلقائي. إن تكررت الجولات العالقة كثيراً أرسل للمطوّر: «جولات تعلق في phase=revealing»، وسيضيف حارساً إضافياً في finishGame.",
    });
  }
  if (repeatViolators.length > 0) {
    issues.push({
      severity: "medium",
      title: "مخالفون متكررون رُفعت عقوبتهم",
      detail: `تم كتم ${repeatViolators.length} لاعباً لمدة 24 ساعة بسبب بلوغهم ${ESCALATION_WARNINGS} تحذيرات.`,
      fix: "عقوبة تلقائية مطبقة. إن استمر السلوك بعد الكتم، راجعهم في تبويب «المستخدمون» للنظر في حظر أطول.",
    });
  }
  if (counts.bannedUsers > 0) {
    issues.push({
      severity: "low",
      title: "حسابات محظورة حالياً",
      detail: `${counts.bannedUsers} حساباً محظوراً الآن.`,
      fix: "حالة طبيعية — ترفع العقوبات تلقائياً بانتهاء مدتها.",
    });
  }
  if (issues.length === 0) {
    issues.push({
      severity: "low",
      title: "كل شيء هادئ ✨",
      detail: "لا بلاغات مفتوحة، لا غرف عالقة، لا مخالفين متكررين — الموقع يعمل بنجاح.",
      fix: "لا حاجة لأي تدخل.",
    });
  }

  const summaryParts: string[] = [];
  if (reportsReviewed > 0) summaryParts.push(`راجع ${reportsReviewed} بلاغاً`);
  if (punishmentsApplied > 0) summaryParts.push(`طبّق ${punishmentsApplied} عقوبة`);
  if (roomsCleaned > 0) summaryParts.push(`نظّف ${roomsCleaned} غرفة`);
  if (usersEscalated > 0) summaryParts.push(`أدار ${usersEscalated} مخالفاً`);
  const summary =
    summaryParts.length > 0
      ? `المدير الآلي: ${summaryParts.join("، ")}.`
      : "المدير الآلي: فحص دوري سليم — لا شيء يستدعي التدخل.";

  await ctx.runMutation(internal.autoAdmin.writeReport, {
    summary,
    stats: {
      reportsReviewed,
      punishmentsApplied,
      roomsCleaned,
      usersEscalated,
      bannedUsers: counts.bannedUsers,
      activeRooms: counts.activeRooms,
      openReportsLeft: counts.openReportsLeft,
    },
    issues,
  });
}

// ---------------------------------------------------------------------------
// Internal queries (read context for the action)
// ---------------------------------------------------------------------------

export const getSettingsForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getSettingsData(ctx);
  },
});

export const getOpenReports = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("asc")
      .take(limit);
  },
});

export const getStaleWaitingRooms = internalQuery({
  args: { olderThan: v.number() },
  handler: async (ctx, { olderThan }) => {
    const now = Date.now();
    const games = await ctx.db.query("games").collect();
    return games.filter(
      (g) => g.status === "waiting" && now - g.createdAt > olderThan,
    );
  },
});

export const getStuckPlayingGames = internalQuery({
  args: { olderThan: v.number() },
  handler: async (ctx, { olderThan }) => {
    const now = Date.now();
    const games = await ctx.db.query("games").collect();
    return games.filter(
      (g) => g.status === "playing" && now - g.createdAt > olderThan,
    );
  },
});

export const getRepeatViolators = internalQuery({
  args: { minWarnings: v.number() },
  handler: async (ctx, { minWarnings }) => {
    const users = await ctx.db.query("users").collect();
    const now = Date.now();
    return users.filter(
      (u) =>
        (u.warnings ?? 0) >= minWarnings &&
        !u.bannedPermanent &&
        (u.bannedUntil == null || u.bannedUntil <= now) &&
        (u.mutedUntil == null || u.mutedUntil <= now),
    );
  },
});

export const getSiteCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [users, games, reports] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("reports").collect(),
    ]);
    return {
      bannedUsers: users.filter(
        (u) => u.bannedPermanent || (u.bannedUntil ?? 0) > Date.now(),
      ).length,
      activeRooms: games.filter((g) => g.status !== "finished").length,
      openReportsLeft: reports.filter((r) => r.status === "open").length,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (write context for the action)
// ---------------------------------------------------------------------------

/** Delete a stale lobby and its player rows. */
export const cleanupRoom = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "waiting") return;
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    for (const p of players) {
      await ctx.db.delete(p._id);
    }
    await ctx.db.delete(gameId);
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "kick",
      targetName: "غرفة",
      reason: `تنظيف تلقائي: غرفة لوبي مهجورة (${game.code})`,
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

/** Finalize a game stuck in "playing" so nobody is trapped forever. */
export const forceFinishGame = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "playing") return;
    await ctx.db.patch(gameId, { status: "finished" });
    await ctx.scheduler.runAfter(0, internal.games.finishGame, { gameId });
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "kick",
      targetName: "غرفة",
      reason: `إنهاء تلقائي: جولة عالقة (${game.code}) — وزّعت الخبرة على اللاعبين`,
      severity: "medium",
      createdAt: Date.now(),
    });
  },
});

/** Escalate a repeat violator: automatic 24h mute, logged. */
export const escalateUser = internalMutation({
  args: { userId: v.id("users"), muteMs: v.number() },
  handler: async (ctx, { userId, muteMs }) => {
    const user = await ctx.db.get(userId);
    if (!user) return;
    const now = Date.now();
    await ctx.db.patch(userId, { mutedUntil: now + muteMs });
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "ai_mute",
      targetId: userId,
      targetName: user.name ?? "لاعب",
      reason: `تصعيد تلقائي: بلوغ ${user.warnings ?? 0} تحذيرات — كتم 24 ساعة`,
      severity: "medium",
      createdAt: now,
    });
  },
});

/** Persist the sweep report (and trim history older than 7 days). */
export const writeReport = internalMutation({
  args: {
    summary: v.string(),
    stats: v.object({
      reportsReviewed: v.number(),
      punishmentsApplied: v.number(),
      roomsCleaned: v.number(),
      usersEscalated: v.number(),
      bannedUsers: v.number(),
      activeRooms: v.number(),
      openReportsLeft: v.number(),
    }),
    issues: v.array(
      v.object({
        severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        title: v.string(),
        detail: v.string(),
        fix: v.string(),
      }),
    ),
  },
  handler: async (ctx, { summary, stats, issues }) => {
    const now = Date.now();
    await ctx.db.insert("adminReports", {
      summary,
      stats,
      issues,
      createdAt: now,
    });
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "ai_review",
      targetName: "الموقع",
      reason: summary,
      severity: issues.some((i) => i.severity === "high") ? "high" : "low",
      createdAt: now,
    });
    // Keep history tidy: drop reports older than 7 days.
    const old = await ctx.db.query("adminReports").collect();
    for (const r of old) {
      if (now - r.createdAt > REPORT_RETENTION_MS) {
        await ctx.db.delete(r._id);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** Cron entry (every 15 minutes) — runs the autonomous sweep. */
export const runSweep = internalAction({
  args: {},
  handler: async (ctx) => {
    await performSweep(ctx);
  },
});

/** Manual "run now" from the owner room — owner only. */
export const runSweepNow = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email || !isOwnerEmail(identity.email)) {
      throw new Error("غرفة المالك فقط — سجّل الدخول بالبريد الدائم للمالك");
    }
    await performSweep(ctx);
    return { ok: true };
  },
});
