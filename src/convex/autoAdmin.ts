import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import {
  getSettingsData,
  isOwnerEmail,
  isStaffUser,
  type ModSettings,
  setSetting,
} from "./owner";
import { DEFAULT_MODEL } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { callOpenRouter, parseVerdict, type AiVerdict } from "./moderation";
import { APK_BYTES, APK_FILE_NAME, APK_MIRROR_URL, APK_SHA256 } from "./apkRelease";
import { getOpenRouterKey } from "./aiConfig";

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

// ── Autonomous housekeeping ──────────────────────────────────────────────
const SPAM_WINDOW_MS = 24 * 60 * 60 * 1000; // report-spam window
const SPAM_MIN_REPORTS = 3; // ≥3 reports in the window…
const SPAM_MIN_DISMISSED = 2; // …with ≥2 dismissed → warn the reporter
const WARNING_DECAY_MS = 30 * 24 * 60 * 60 * 1000; // warnings older than 30 days are forgiven
const FINISHED_GAME_RETENTION_MS = 48 * 60 * 60 * 1000; // finished rooms kept 48h
const REACTION_RETENTION_MS = 24 * 60 * 60 * 1000; // reactions kept 24h
const DOWNLOAD_REPORT_WINDOW_MS = 24 * 60 * 60 * 1000; // failures to watch
const DOWNLOAD_REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // keep reports 7 days
const APK_CHECK_INTERVAL_MS = 60 * 60 * 1000; // integrity check at most hourly
const STUCK_COUNTDOWN_MS = 2 * 60 * 1000; // countdown frozen >2 min → rescue

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
  runAction: (a: any, args: any) => Promise<any>;
}): Promise<void> {
  const settings: ModSettings = await ctx.runQuery(
    internal.autoAdmin.getSettingsForSweep,
    {},
  );
  if (!settings.aiAdminEnabled) return; // the owner turned the administrator off

  await ensureAiRuntime(ctx); // حقن النظامين المضبوطين قبل القراءة/الاستدعاء
  const apiKey = getOpenRouterKey();
  const issues: SweepIssue[] = [];
  let reportsReviewed = 0;
  let punishmentsApplied = 0;
  let roomsCleaned = 0;
  let usersEscalated = 0;
  let autoFixes = 0;

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
          ctx,
          apiKey,
          DEFAULT_MODEL,
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

  // ── 3.5. Warn report spammers (many reports, mostly dismissed) ─────────
  const spammers = await ctx.runQuery(internal.autoAdmin.getReportSpammers, {
    windowMs: SPAM_WINDOW_MS,
    minReports: SPAM_MIN_REPORTS,
    minDismissed: SPAM_MIN_DISMISSED,
  });
  for (const spammer of spammers) {
    await ctx.runMutation(internal.autoAdmin.warnReporter, {
      userId: spammer.reporterId,
      total: spammer.total,
      dismissed: spammer.dismissed,
    });
    autoFixes += 1;
  }

  // ── 3.6. Forgive warnings older than 30 days (clean slate) ─────────────
  const decayed = await ctx.runQuery(internal.autoAdmin.getDecayedWarnings, {
    olderThanMs: WARNING_DECAY_MS,
  });
  for (const user of decayed) {
    await ctx.runMutation(internal.autoAdmin.clearWarnings, { userId: user._id });
    autoFixes += 1;
  }

  // ── 3.7. Rescue stuck countdowns (phase=countdown frozen past 2 min) ───
  const stuck = await ctx.runQuery(internal.autoAdmin.getStuckCountdowns, {
    olderThanMs: STUCK_COUNTDOWN_MS,
  });
  for (const game of stuck) {
    await ctx.runMutation(internal.autoAdmin.fixStuckCountdown, {
      gameId: game._id,
    });
    roomsCleaned += 1;
    autoFixes += 1;
  }

  // ── 3.8. Delete finished rooms older than 48h (keeps history) ──────────
  const oldFinished = await ctx.runQuery(internal.autoAdmin.getOldFinishedGames, {
    olderThanMs: FINISHED_GAME_RETENTION_MS,
  });
  for (const game of oldFinished) {
    await ctx.runMutation(internal.autoAdmin.deleteFinishedGame, {
      gameId: game._id,
    });
    roomsCleaned += 1;
    autoFixes += 1;
  }

  // ── 3.9. Clean orphaned player rows (game was deleted) ─────────────────
  const orphans = await ctx.runQuery(internal.autoAdmin.getOrphanPlayerRows, {});
  if (orphans.length > 0) {
    await ctx.runMutation(internal.autoAdmin.cleanupOrphanRows, {
      ids: orphans.map((o: { _id: string }) => o._id),
    });
    autoFixes += 1;
  }

  // ── 3.10. Trim old reactions (TTL 24h) ─────────────────────────────────
  const oldReactions = await ctx.runQuery(internal.autoAdmin.getOldReactions, {
    olderThanMs: REACTION_RETENTION_MS,
  });
  for (const reaction of oldReactions) {
    await ctx.runMutation(internal.autoAdmin.deleteReaction, {
      reactionId: reaction._id,
    });
  }

  // ── 3.11. APK integrity check — the official file on the live site ────
  const siteUrlClean = (settings.siteUrl ?? "").trim().replace(/\/+$/, "");
  const hasSiteUrl = /^https?:\/\//i.test(siteUrlClean);
  const lastApkCheckAt = await ctx.runQuery(
    internal.autoAdmin.getApkCheckTimestamp,
    {},
  );
  // مصدر الفحص: المرآة الموثّقة أولاً (بايتات مطابقة للبصمة الرسمية)،
  // ثم رابط الموقع الرسمي إن كان مضبوطاً.
  const apkCheckUrl =
    APK_MIRROR_URL ??
    (hasSiteUrl ? `${siteUrlClean}/downloads/${APK_FILE_NAME}` : null);
  let apkCheckDetail: string | null = null;
  if (
    apkCheckUrl &&
    Date.now() - (lastApkCheckAt ?? 0) > APK_CHECK_INTERVAL_MS
  ) {
    try {
      const res = await fetch(apkCheckUrl, {
        cache: "no-store",
      });
      const buf = new Uint8Array(await res.arrayBuffer());
      const digest = await sha256Hex(buf);
      const ok = res.ok && buf.length === APK_BYTES && digest === APK_SHA256;
      apkCheckDetail = ok
        ? `ملف APK الرسمي سليم: ${buf.length} بايت والبصمة مطابقة للنسخة المنشورة.`
        : `ملف APK المنشور مختلف عن النسخة الرسمية: استُلم ${buf.length} بايت والبصمة ${digest ?? "غير محسوبة"} (المتوقع ${APK_BYTES}).`;
      await ctx.runMutation(internal.autoAdmin.recordApkCheck, {
        ok,
        detail: apkCheckDetail,
      });
      autoFixes += 1;
    } catch (error) {
      apkCheckDetail = `تعذّر فحص ملف APK على الموقع الرسمي (${siteUrlClean}): ${error instanceof Error ? error.message : "خطأ غير معروف"}.`;
    }
  }

  // ── 3.12. Download failure reports from real players ──────────────────
  const recentDownloadFailures = await ctx.runQuery(
    internal.autoAdmin.getRecentDownloadFailures,
    { sinceMs: DOWNLOAD_REPORT_WINDOW_MS },
  );
  await ctx.runMutation(internal.autoAdmin.deleteOldDownloadReports, {
    olderThanMs: DOWNLOAD_REPORT_RETENTION_MS,
  });

  // ── 3.13. AI question-bank refill — auto-generate for weak categories ──
  // إذا وُجدت فئة تحت الحد الأدنى من الأسئلة (والمفتاح مضبوط والمهلة انقضت)،
  // يولّد المدير الآلي دفعة جديدة ويضعها في طابور مراجعة المالك.
  let aiRefillResult: {
    ok: boolean;
    reason?: string;
    category?: string;
    count?: number;
  } | null = null;
  if (apiKey && settings.aiAdminEnabled) {
    try {
      aiRefillResult = await ctx.runAction(
        internal.aiQuestions.autoRefillWeakCategory,
        {},
      );
      if (aiRefillResult?.ok) autoFixes += 1;
    } catch (error) {
      aiRefillResult = {
        ok: false,
        reason: `خطأ: ${error instanceof Error ? error.message : "غير معروف"}`,
      };
    }
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
  if (spammers.length > 0) {
    issues.push({
      severity: "medium",
      title: "مُبلِّغون مزعجون حُذّروا تلقائياً",
      detail: `حُذّر ${spammers.length} لاعباً لإرسال بلاغات مكررة (${SPAM_MIN_REPORTS}+) معظمها بلا مخالفة (${SPAM_MIN_DISMISSED}+ مرفوضة).`,
      fix: "تحذير تلقائي مطبق لمنع إساءة استخدام صندوق البلاغات. إن تكرر الأمر بعد التحذير راجعهم في «المستخدمون» للنظر في كتم أطول.",
    });
  }
  if (decayed.length > 0) {
    issues.push({
      severity: "low",
      title: "تحذيرات قديمة أُسقطت تلقائياً",
      detail: `أُسقطت التحذيرات الرسمية عن ${decayed.length} لاعباً لأنها تجاوزت 30 يوماً (فرصة جديدة للجميع).`,
      fix: "لا حاجة لتدخل — سياسة الإسقاط التلقائي مطبقة.",
    });
  }
  if (stuck.length > 0 || oldFinished.length > 0 || orphans.length > 0) {
    issues.push({
      severity: "low",
      title: "تنظيف ذاتي للغرف والبيانات",
      detail: `أنقذ المدير الآلي ${stuck.length} جولة عالقة، وحذف ${oldFinished.length} غرفة منتهية قديمة، ونظّف ${orphans.length} صف لاعب يتيم.`,
      fix: "لا حاجة لتدخل — التنظيف تلقائي بالكامل.",
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
  if (!apkCheckUrl) {
    issues.push({
      severity: "medium",
      title: "الفحص الآلي لملف APK معطّل (لا يوجد مصدر تحميل)",
      detail: "لا توجد مرآة موثّقة ولا رابط موقع رسمي — لا يمكن للمدير الآلي التحقق من سلامة ملف APK المنشور.",
      fix: "أضف APK_MIRROR_URL في src/convex/apkRelease.ts أو الصق رابط الموقع الرسمي في تبويب «المدير الآلي» ثم اضغط «تشغيل الفحص الآن».",
    });
  }
  if (apkCheckDetail) {
    const ok = apkCheckDetail.includes("سليم");
    issues.push({
      severity: ok ? "low" : "high",
      title: ok ? "فحص سلامة ملف APK" : "تنبيه: ملف APK المنشور غير مطابق للنسخة الرسمية",
      detail: apkCheckDetail,
      fix: ok
        ? "لا حاجة لتدخل — الملف المنشور مطابق للبصمة الرسمية."
        : "أعد رفع ملف APK الرسمي إلى public/downloads/ و src/assets/ وحدّث البصمة والحجم في src/convex/apkRelease.ts، ثم أعد البناء.",
    });
  }
  if (recentDownloadFailures.length > 0) {
    const byError = new Map<string, number>();
    for (const r of recentDownloadFailures) {
      const key = r.error.slice(0, 60);
      byError.set(key, (byError.get(key) ?? 0) + 1);
    }
    const topError = [...byError.entries()].sort((a, b) => b[1] - a[1])[0];
    issues.push({
      severity: recentDownloadFailures.length >= 5 ? "high" : "medium",
      title: "فشل تنزيل APK لدى المستخدمين",
      detail: `${recentDownloadFailures.length} محاولة تنزيل فاشلة خلال 24 ساعة${topError ? ` — أشهر سبب: «${topError[0]}» (${topError[1]} مرة)` : ""}. التفاصيل الكاملة في تبويب «التحميلات» بغرفة المالك.`,
      fix: "السبب الأشهر: تخزين مؤقت قديم من Service Worker. الإصدار الحالي يشفي نفسه ذاتياً (مسح الكاش وإعادة المحاولة تلقائياً). إن تكرر الأمر، انسخ تقرير تبويب «التحميلات» وأرسله للمطوّر.",
    });
  }
  if (aiRefillResult?.ok) {
    issues.push({
      severity: "low",
      title: "مولّد الأسئلة الذكي أضاف أسئلة جديدة",
      detail: `فئة «${aiRefillResult.category}» كانت تحت الحد الأدنى — وُلّد ${aiRefillResult.count} سؤالاً جديداً بالذكاء الاصطناعي وأُضيفت لطابور المراجعة في تبويب «المدير الآلي».`,
      fix: "راجع الأسئلة الجديدة في تبويب «المدير الآلي» واعتمد ما يناسب — المعتمد منها يدخل الجولات فوراً.",
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
  if (recentDownloadFailures.length > 0) {
    summaryParts.push(`عالج ${recentDownloadFailures.length} تقرير تنزيل فاشل`);
  }
  if (aiRefillResult?.ok) {
    summaryParts.push(
      `ولّد ${aiRefillResult.count} سؤالاً لفئة «${aiRefillResult.category}»`,
    );
  }
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
      autoFixes,
      downloadFailures: recentDownloadFailures.length,
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

// ---------------------------------------------------------------------------
// Autonomous housekeeping: internal queries (read-only lookups for the sweep)
// ---------------------------------------------------------------------------

/** Reporters who filed many reports in the window, most of which were dismissed. */
export const getReportSpammers = internalQuery({
  args: {
    windowMs: v.number(),
    minReports: v.number(),
    minDismissed: v.number(),
  },
  handler: async (ctx, { windowMs, minReports, minDismissed }) => {
    const now = Date.now();
    const reports = await ctx.db.query("reports").collect();
    const byReporter = new Map<
      string,
      { reporterId: string; total: number; dismissed: number }
    >();
    for (const r of reports) {
      if (now - r.createdAt > windowMs) continue;
      const entry = byReporter.get(r.reporterId) ?? {
        reporterId: r.reporterId,
        total: 0,
        dismissed: 0,
      };
      entry.total += 1;
      if (r.status === "dismissed") entry.dismissed += 1;
      byReporter.set(r.reporterId, entry);
    }
    return [...byReporter.values()]
      .filter((e) => e.total >= minReports && e.dismissed >= minDismissed)
      .sort((a, b) => b.dismissed - a.dismissed);
  },
});

/** Users whose warnings are old enough to be forgiven. */
export const getDecayedWarnings = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    return users.filter(
      (u) =>
        (u.warnings ?? 0) > 0 &&
        u.lastWarningAt != null &&
        now - u.lastWarningAt > olderThanMs &&
        !isStaffUser(u),
    );
  },
});

/** Games frozen in the countdown phase for too long. */
export const getStuckCountdowns = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const now = Date.now();
    const games = await ctx.db.query("games").collect();
    return games.filter(
      (g) =>
        g.status === "playing" &&
        g.phase === "countdown" &&
        now - g.questionStartedAt > olderThanMs,
    );
  },
});

/** Finished games older than the retention window (their history is kept). */
export const getOldFinishedGames = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const now = Date.now();
    const games = await ctx.db.query("games").collect();
    return games.filter(
      (g) => g.status === "finished" && now - g.createdAt > olderThanMs,
    );
  },
});

/** gamePlayers rows whose game no longer exists. */
export const getOrphanPlayerRows = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [players, games] = await Promise.all([
      ctx.db.query("gamePlayers").collect(),
      ctx.db.query("games").collect(),
    ]);
    const ids = new Set(games.map((g) => g._id));
    return players.filter((p) => !ids.has(p.gameId));
  },
});

/** Reactions older than the retention window. */
export const getOldReactions = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const now = Date.now();
    const reactions = await ctx.db.query("reactions").collect();
    return reactions.filter((r) => now - r.createdAt > olderThanMs);
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

// ---------------------------------------------------------------------------
// Autonomous housekeeping: internal mutations (write actions for the sweep)
// ---------------------------------------------------------------------------

/** Issue a formal warning to a report spammer (never the staff). */
export const warnReporter = internalMutation({
  args: {
    userId: v.id("users"),
    total: v.number(),
    dismissed: v.number(),
  },
  handler: async (ctx, { userId, total, dismissed }) => {
    const user = await ctx.db.get(userId);
    if (!user || isStaffUser(user)) return;
    const now = Date.now();
    await ctx.db.patch(userId, {
      warnings: (user.warnings ?? 0) + 1,
      lastWarningAt: now,
    });
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "report_spam_warn",
      targetId: userId,
      targetName: user.name ?? "لاعب",
      reason: `تحذير تلقائي: ${total} بلاغاً في 24 ساعة، ${dismissed} منها بلا مخالفة`,
      severity: "medium",
      createdAt: now,
    });
  },
});

/** Clear warnings that have passed the decay window. */
export const clearWarnings = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || (user.warnings ?? 0) === 0) return;
    const now = Date.now();
    await ctx.db.patch(userId, { warnings: 0 });
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "warning_decay",
      targetId: userId,
      targetName: user.name ?? "لاعب",
      reason: "إسقاط تلقائي للتحذيرات بعد 30 يوماً بدون مخالفات جديدة",
      severity: "low",
      createdAt: now,
    });
  },
});

/** Rescue a game stuck in the countdown phase: open the answer window now. */
export const fixStuckCountdown = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "playing" || game.phase !== "countdown") return;
    const now = Date.now();
    await ctx.db.patch(gameId, {
      phase: "answering",
      questionStartedAt: now,
    });
    await ctx.scheduler.runAfter(
      game.settings?.timePerQuestionMs ?? 15_000,
      internal.games.revealQuestion,
      { gameId, index: game.currentQuestionIndex },
    );
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "countdown_fix",
      targetName: "غرفة",
      reason: `إنقاذ تلقائي: عدّاد جولة عالق (${game.code}) — فُتحت نافذة الإجابة`,
      severity: "low",
      createdAt: now,
    });
  },
});

/** Delete a finished room + its player rows + reactions (history stays). */
export const deleteFinishedGame = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "finished") return;
    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    for (const p of players) await ctx.db.delete(p._id);
    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);
    await ctx.db.delete(gameId);
  },
});

/** Delete orphaned gamePlayers rows. */
export const cleanupOrphanRows = internalMutation({
  args: { ids: v.array(v.id("gamePlayers")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      await ctx.db.delete(id);
    }
  },
});

/** Delete one stale reaction (TTL). */
export const deleteReaction = internalMutation({
  args: { reactionId: v.id("reactions") },
  handler: async (ctx, { reactionId }) => {
    await ctx.db.delete(reactionId);
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
      autoFixes: v.number(),
      downloadFailures: v.number(),
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
// Autonomous housekeeping: APK download health (queries & writes)
// ---------------------------------------------------------------------------

/** Failure reports from the last window (error text + count). */
export const getRecentDownloadFailures = internalQuery({
  args: { sinceMs: v.number() },
  handler: async (ctx, { sinceMs }) => {
    const since = Date.now() - sinceMs;
    const rows = await ctx.db
      .query("downloadReports")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .collect();
    return rows.map((r) => ({ error: r.error, createdAt: r.createdAt }));
  },
});

/** Timestamp of the last APK integrity check (settings store). */
export const getApkCheckTimestamp = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "apk_last_check_at"))
      .first();
    if (!row) return null;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : null;
  },
});

/** Record an APK integrity check (timestamp + audit log). */
export const recordApkCheck = internalMutation({
  args: { ok: v.boolean(), detail: v.string() },
  handler: async (ctx, { ok, detail }) => {
    await setSetting(ctx, "apk_last_check_at", Date.now());
    await ctx.db.insert("moderationLogs", {
      actorType: "system",
      actorName: "المدير الآلي",
      action: "apk_check",
      targetName: "ملف APK",
      reason: detail,
      severity: ok ? "low" : "high",
      createdAt: Date.now(),
    });
  },
});

/** Delete download-failure reports older than the retention window. */
export const deleteOldDownloadReports = internalMutation({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs;
    const rows = await ctx.db
      .query("downloadReports")
      .withIndex("by_created", (q) => q.lte("createdAt", cutoff))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});

/** SHA-256 of a byte array (best-effort, null when unavailable). */
async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
    if (!cryptoApi?.subtle) return null;
    const buf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const digest = await cryptoApi.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

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
