import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⏱️ مركز التحكم الكامل بمهام AI المجدولة (AI Cron Control Center)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * المشكلة: كانت كل مهام الخلفية تُعلَن مباشرة في `crons.ts`، أي أن تغييرها
 * كان يحتاج تعديل كود وإعادة نشر — ولا يملك المالك أي تحكم حيّ بها. ولهذا
 * إما تُشغَّل كلها (وتستهلك الحصة) أو تُلغى كلها (وتتوقف أنظمة حقيقية).
 *
 * الحل: «مُوزِّع واحد» + «سجل مهام في قاعدة البيانات»:
 *
 *   1) مهمة cron واحدة فقط في النظام كله (`aiCron.dispatch`) تعمل كل ساعة.
 *   2) كل مهمة AI/نظام حقيقية مُسجّلة في هذه الوحدة بمعرّف واسم ووصف.
 *   3) حالة كل مهمة (مفعّلة؟ كل كم؟ آخر تشغيل؟ كم مرة؟ آخر خطأ؟) محفوظة
 *      في قاعدة البيانات، فيتحكم بها المالك **فوراً وبلا إعادة نشر**.
 *   4) المُوزِّع لا ينفّذ إلا المهام **المفعّلة والمستحقة فقط** — فتكلفتها
 *      في وضعها الافتراضي لا تتغيّر عن الوضع الحالي المستقر.
 *   5) «مفتاح إيقاف شامل» واحد يوقف كل مهام AI بضغطة واحدة (الحالة طوارئ).
 *
 * كل هذا حقيقي: التفعيل واليَّاسَّة والتشغيل الفوري كلها تُنفَّذ فعلاً.
 */

// ═══════════════════════════════════════════════════════════════════════
// سجل المهام — كل مهمة تشير إلى دالة داخلية حقيقية موجودة في النظام
// ═══════════════════════════════════════════════════════════════════════

interface JobDef {
  key: string;
  name: string;
  description: string;
  group: string;
  /** الفاصل الافتراضي بالدقائق */
  intervalMinutes: number;
  /** مفعّلة افتراضياً؟ (الافتراضي محافظ: مهمة الصيانة فقط) */
  enabled: boolean;
  /** التنفيذ الفعلي — يستدعي دالة داخلية حقيقية */
  run: (ctx: any) => Promise<unknown>;
}

const JOB_DEFS: JobDef[] = [
  {
    key: "self_maintenance",
    name: "الصيانة الذاتية",
    description:
      "يحذف السجلات القديمة من كل الجداول الكبيرة — يحافظ على التخزين وسرعة الاستعلامات ويقلل الاستهلاك.",
    group: "صيانة",
    intervalMinutes: 1440,
    enabled: true,
    run: (ctx) => ctx.runMutation(internal.maintenance.pruneAll, {}),
  },
  {
    key: "chat_guardian",
    name: "حارس الدردشة الذكي",
    description: "يمسح رسائل الدردشة الحديثة ويفرض القوانين على المخالفات تلقائياً.",
    group: "رقابة",
    intervalMinutes: 60,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.chatGuardianSweep, {}),
  },
  {
    key: "ai_hub_bridge",
    name: "جسر مركز الذكاء الموحد",
    description: "يربط وحدات الذكاء ويتبادل السياق بينها ويسجّل الأحداث الموحدة.",
    group: "AI",
    intervalMinutes: 60,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.aiHub.bridgeTick, {}),
  },
  {
    key: "ai_hub_prune",
    name: "تقليم أحداث مركز الذكاء",
    description: "يحذف أحداث المركز الأقدم من ٣ أيام — يمنع تضخّم الجدول.",
    group: "AI",
    intervalMinutes: 1440,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.aiHub.pruneHubEvents, { keepDays: 3 }),
  },
  {
    key: "agents_life",
    name: "نبضة حياة الوكلاء",
    description: "يُبقي وكلاء AI أحياءً: يولدون ويتفاعلون ويتقاعدون مع الوقت.",
    group: "AI",
    intervalMinutes: 360,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.aiAgents.lifeTick, {}),
  },
  {
    key: "minds_life",
    name: "نبضة حياة العقول",
    description: "يولّد أفكار العقول الحيّة ويبني روابطها. ⚠️ الكثر منه يُنتج بيانات كثيرة.",
    group: "AI",
    intervalMinutes: 1440,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.livingMinds.lifeTick, {}),
  },
  {
    key: "questions_publish",
    name: "نشر الأسئلة المجدولة",
    description: "ينشر أسئلة AI التي انتهى وقت جدولتها وتنتظر الظهور للاعبين.",
    group: "محتوى",
    intervalMinutes: 60,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.aiQuestions.publishScheduled, {}),
  },
  {
    key: "leagues_rollover",
    name: "تدوير الدوريات الأسبوعي",
    description: "يصفر نقاط الدوريات ويوزّع النتائج مع انتهاء كل أسبوع.",
    group: "مسابقات",
    intervalMinutes: 10080,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.leagues.weeklyRollover, {}),
  },
  {
    key: "seasons_rollover",
    name: "تدوير المواسم",
    description: "يغلق الموسم المنتهي ويفتح الذي يليه ويمنح المكافآت.",
    group: "مسابقات",
    intervalMinutes: 1440,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.seasons.autoRollover, {}),
  },
  {
    key: "crown_locks",
    name: "إنهاء أقفال العرش",
    description: "يفتح أقفال العرش (الساحة/الدردشة/الاقتصاد) المنتهية مدتها تلقائياً.",
    group: "حُكم",
    intervalMinutes: 60,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.crownDeck.expireLocks, {}),
  },
  {
    key: "clans_crown",
    name: "تاج العصابات الأسبوعي",
    description: "يصفر نقاط العصابات وينصّب الأعلى تاجاً في نهاية الأسبوع.",
    group: "مسابقات",
    intervalMinutes: 10080,
    enabled: false,
    run: (ctx) => ctx.runMutation(internal.clans.weeklyCrown, {}),
  },
];

const JOB_BY_KEY = new Map(JOB_DEFS.map((d) => [d.key, d]));

/** الفواصل المسموح بها (بالدقائق) — تمنع قيماً تُغرق الخادم */
export const ALLOWED_INTERVALS = [15, 60, 360, 1440, 10080] as const;

const OWNER_EMAIL = "omw70op@gmail.com";
const PAUSE_KEY = "aiCronPaused";

// ═══════════════════════════════════════════════════════════════════════
// أدوات داخلية
// ═══════════════════════════════════════════════════════════════════════

/** غرفة المالك فقط — نفس نمط التحقق المستخدم في بقية وحدات الإدارة. */
async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(userId)) as { role?: string; email?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) {
    throw new Error("غرفة المالك فقط.");
  }
  return me;
}

/** يُنشئ الصف أو يحدّثه — مصدر الحقيقة لحالة كل مهمة. */
async function upsert(ctx: any, key: string, patch: Record<string, unknown>) {
  const def = JOB_BY_KEY.get(key);
  const existing = await ctx.db
    .query("aiCronJobs")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
    return existing._id;
  }
  return await ctx.db.insert("aiCronJobs", {
    key,
    enabled: def?.enabled ?? false,
    intervalMinutes: def?.intervalMinutes ?? 1440,
    lastRunAt: 0,
    lastDurationMs: 0,
    lastStatus: "never",
    lastResult: "",
    runCount: 0,
    errorCount: 0,
    updatedAt: Date.now(),
    ...patch,
  });
}

/** هل مفتاح الإيقاف الشامل مُفعَّل؟ */
async function isPaused(ctx: any): Promise<boolean> {
  try {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", PAUSE_KEY))
      .first();
    if (!row) return false;
    return JSON.parse(row.value as string) === true;
  } catch {
    return false;
  }
}

/**
 * قلب المُوزِّع: يقرأ الحالة، ويُنفّذ المهام المفعّلة المستحقة فقط.
 * `force` = تشغيل كل المفعّلات فوراً بغضّ النظر عن موعدها (أمر المالك).
 */
async function dispatchBody(ctx: any, opts: { force?: boolean } = {}) {
  if (await isPaused(ctx)) {
    return { paused: true, ran: 0, skipped: JOB_DEFS.length, results: [] as unknown[] };
  }

  const now = Date.now();
  const rows = await ctx.db.query("aiCronJobs").collect();
  const byKey = new Map<string, any>(rows.map((r: any) => [r.key, r]));

  let ran = 0;
  const results: { key: string; status: string; ms?: number; note?: string }[] = [];

  for (const def of JOB_DEFS) {
    const row = byKey.get(def.key);
    const enabled = row?.enabled ?? def.enabled;
    if (!enabled) continue;

    const interval = row?.intervalMinutes ?? def.intervalMinutes;
    const last = row?.lastRunAt ?? 0;
    if (!opts.force && now - last < interval * 60_000) continue;

    const started = Date.now();
    try {
      await def.run(ctx);
      const ms = Date.now() - started;
      ran += 1;
      results.push({ key: def.key, status: "ok", ms });
      await upsert(ctx, def.key, {
        lastRunAt: Date.now(),
        lastDurationMs: ms,
        lastStatus: "ok",
        lastResult: "تم التنفيذ بنجاح",
        runCount: (row?.runCount ?? 0) + 1,
        errorCount: row?.errorCount ?? 0,
      });
    } catch (err) {
      const ms = Date.now() - started;
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      results.push({ key: def.key, status: "error", ms, note: msg });
      // نسجّل الفشل ونحدّث وقت التشغيل أيضاً: يمنع «عاصفة إعادة محاولة»
      // تُستهلك فيها الحصة بسرعة عند وجود عطل متكرر.
      await upsert(ctx, def.key, {
        lastRunAt: Date.now(),
        lastDurationMs: ms,
        lastStatus: "error",
        lastResult: msg,
        runCount: (row?.runCount ?? 0) + 1,
        errorCount: (row?.errorCount ?? 0) + 1,
      });
    }
  }

  return { paused: false, ran, skipped: JOB_DEFS.length - ran, results };
}

// ═══════════════════════════════════════════════════════════════════════
// الاستعلامات (غرفة المالك)
// ═══════════════════════════════════════════════════════════════════════

/** كل المهام مع حالتها الحقيقية + إجماليات. */
export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const rows = await ctx.db.query("aiCronJobs").collect();
    const byKey = new Map<string, any>(rows.map((r: any) => [r.key, r]));

    const jobs = JOB_DEFS.map((def) => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        group: def.group,
        enabled: row?.enabled ?? def.enabled,
        intervalMinutes: row?.intervalMinutes ?? def.intervalMinutes,
        lastRunAt: (row?.lastRunAt ?? 0) as number,
        lastDurationMs: (row?.lastDurationMs ?? 0) as number,
        lastStatus: (row?.lastStatus ?? "never") as string,
        lastResult: (row?.lastResult ?? "") as string,
        runCount: (row?.runCount ?? 0) as number,
        errorCount: (row?.errorCount ?? 0) as number,
      };
    });

    const enabledCount = jobs.filter((j) => j.enabled).length;
    const totalRuns = jobs.reduce((sum, j) => sum + j.runCount, 0);
    const totalErrors = jobs.reduce((sum, j) => sum + j.errorCount, 0);
    const lastActivity = jobs.reduce((max, j) => Math.max(max, j.lastRunAt), 0);
    // استهلاك تقديري: كم تنفيذ في اليوم لو بقيت المهام على حالها
    const runsPerDay = jobs
      .filter((j) => j.enabled)
      .reduce((sum, j) => sum + Math.max(1, Math.round(1440 / Math.max(15, j.intervalMinutes))), 0);

    return {
      paused: await isPaused(ctx),
      jobs,
      allowedIntervals: [...ALLOWED_INTERVALS],
      stats: {
        total: jobs.length,
        enabled: enabledCount,
        disabled: jobs.length - enabledCount,
        totalRuns,
        totalErrors,
        lastActivity,
        runsPerDay,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// أوامر المالك (تحكم فعلي فوري — بلا إعادة نشر)
// ═══════════════════════════════════════════════════════════════════════

/** تشغيل/إيقاف مهمة واحدة. */
export const setJobEnabled = mutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, enabled }) => {
    await requireOwner(ctx);
    if (!JOB_BY_KEY.has(key)) throw new Error("مهمة غير معروفة.");
    await upsert(ctx, key, { enabled });
    return { key, enabled };
  },
});

/** تغيير دورية مهمة (من قائمة القيم المسموح بها فقط). */
export const setJobInterval = mutation({
  args: { key: v.string(), intervalMinutes: v.number() },
  handler: async (ctx, { key, intervalMinutes }) => {
    await requireOwner(ctx);
    if (!JOB_BY_KEY.has(key)) throw new Error("مهمة غير معروفة.");
    if (!(ALLOWED_INTERVALS as readonly number[]).includes(intervalMinutes)) {
      throw new Error("دورية غير مسموح بها.");
    }
    await upsert(ctx, key, { intervalMinutes });
    return { key, intervalMinutes };
  },
});

/** تنفيذ مهمة واحدة الآن فوراً — بغضّ النظر عن موعدها. */
export const runJobNow = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireOwner(ctx);
    const def = JOB_BY_KEY.get(key);
    if (!def) throw new Error("مهمة غير معروفة.");

    const row = await ctx.db
      .query("aiCronJobs")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();

    const started = Date.now();
    try {
      await def.run(ctx);
      const ms = Date.now() - started;
      await upsert(ctx, key, {
        lastRunAt: Date.now(),
        lastDurationMs: ms,
        lastStatus: "ok",
        lastResult: "تم التنفيذ يدوياً",
        runCount: (row?.runCount ?? 0) + 1,
        errorCount: row?.errorCount ?? 0,
      });
      return { ok: true, ms, message: "تم التنفيذ بنجاح." };
    } catch (err) {
      const ms = Date.now() - started;
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      await upsert(ctx, key, {
        lastRunAt: Date.now(),
        lastDurationMs: ms,
        lastStatus: "error",
        lastResult: msg,
        runCount: (row?.runCount ?? 0) + 1,
        errorCount: (row?.errorCount ?? 0) + 1,
      });
      return { ok: false, ms, message: msg };
    }
  },
});

/** تشغيل كل المهام المفعّلة الآن — «أمر تنفيذ شامل». */
export const runAllEnabledNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return await dispatchBody(ctx, { force: true });
  },
});

/** المفتاح الشامل: إيقاف/تشغيل كل مهام AI بضغطة واحدة. */
export const setGlobalPause = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, { paused }) => {
    await requireOwner(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", PAUSE_KEY))
      .first();
    const value = JSON.stringify(paused);
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key: PAUSE_KEY, value });
    }
    return { paused };
  },
});

/** إعادة مهمة إلى إعداداتها الافتراضية (تفعيل + دورية + إحصاءات الصحة). */
export const resetJob = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireOwner(ctx);
    const def = JOB_BY_KEY.get(key);
    if (!def) throw new Error("مهمة غير معروفة.");
    await upsert(ctx, key, {
      enabled: def.enabled,
      intervalMinutes: def.intervalMinutes,
      lastStatus: "never",
      lastResult: "",
      errorCount: 0,
    });
    return { key };
  },
});

/** تفعيل الكل / إيقاف الكل (بلا استثناء). */
export const setAllEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireOwner(ctx);
    for (const def of JOB_DEFS) {
      await upsert(ctx, def.key, { enabled });
    }
    return { enabled, count: JOB_DEFS.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// المُوزِّع (نقطة الاتصال الوحيدة بالـ cron)
// ═══════════════════════════════════════════════════════════════════════

/**
 * تُستدعى من مهمة cron واحدة في `crons.ts`.
 * تنفّذ فقط المهام المفعّلة المستحقة — فتبقى التكلفة منخفضة دائماً.
 */
export const dispatch = internalMutation({
  args: {},
  handler: async (ctx) => await dispatchBody(ctx),
});

/** يضمن وجود صف لكل مهمة معرّفة (يُستدعى عند الحاجة فقط). */
export const ensureSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("aiCronJobs").collect();
    const have = new Set(rows.map((r: any) => r.key));
    let created = 0;
    for (const def of JOB_DEFS) {
      if (have.has(def.key)) continue;
      await upsert(ctx, def.key, {});
      created += 1;
    }
    return { created, total: JOB_DEFS.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🗑 تنظيف بيانات AI نهائياً — حذف حقيقي مدرَّج
// ═══════════════════════════════════════════════════════════════════════
//
// لماذا هذا مهم؟ كان أكبر مُستهلك لـ Database I/O هو الاستعلامات التفاعلية
// التي تمسح جداول ضخمة (أفكار العقول، سجلات قرارات AI، التغذيات). حذف
// هذه الجداول يقلّص كل قراءة لاحقة إلى الصفر تقريباً — أي يمنع تكرار
// تجاوز الحصة جذرياً بلا حاجة لتعديل كود.
//
// الحذف **مدرَّج ومقيّد** (دفعة لكل جدول في كل استدعاء) لأن المعاملة
// الواحدة محدودة بـ 16,000 كتابة — يُعاد الضغط للحصول على الدفعة التالية.

/**
 * جداول «المخلفات»: سجلات ومخارج AI وذاكرته ومراقب الأداء والأخطاء.
 * كلها قابلة للحذف بلا أثر على حسابات اللاعبين أو تقدّمهم أو مقتنياتهم.
 */
export const AI_DATA_TABLES = [
  // سجلات وقرارات AI
  "aiDecisionLog",
  "aiLogs",
  "aiErrorClusters",
  "aiFeedback",
  "aiPatches",
  "aiSuggestions",
  "aiOwnerEscalations",
  "aiSuiteActivity",
  // تغذيات وأحداث
  "aiAgentFeed",
  "aiHubEvents",
  "assistantLogs",
  "assistantOrders",
  "spectatorMessages",
  "spectators",
  // ذاكرة AI وعقول
  "aiMemories",
  "aiCollectiveMemories",
  "aiFreeMemory",
  "aiFreeCommands",
  "mindThoughts",
  "mindChat",
  "mindRequests",
  "mindVotes",
  "atlasLearningMemory",
  "atlasCommands",
  // قياسات وأخطاء وسجلات إدارية
  "performanceMetrics",
  "clientErrors",
  "errorLogs",
  "errorPatterns",
  "moderationLogs",
  "auditLog",
  "fairPlayLog",
  "apiCallLogs",
  "apiEvents",
  "viceAudit",
  "viceCommands",
] as const;

/**
 * 👑 حذف بيانات AI/السجلات نهائياً — دفعة محدودة في كل ضغطة.
 *
 * `limitPerTable` = أقصى عدد صفوف تُحذف من كل جدول في الاستدعاء الواحد
 * (افتراضياً 150، وبسقف 400 للحفاظ على حدود المعاملة).
 *
 * يعيد عدد ما حُذف فعلاً لكل جدول، و`more: true` إن بقي المزيد
 * (اضغط مرة أخرى لإكمال التنظيف).
 */
export const purgeAiData = mutation({
  args: { limitPerTable: v.optional(v.number()) },
  handler: async (ctx, { limitPerTable }) => {
    await requireOwner(ctx);
    const cap = Math.max(25, Math.min(400, Math.floor(limitPerTable ?? 150)));
    const deleted: Record<string, number> = {};
    let more = false;

    for (const table of AI_DATA_TABLES) {
      try {
        const rows = await ctx.db.query(table as any).take(cap);
        for (const row of rows) {
          await ctx.db.delete(row._id);
        }
        if (rows.length > 0) deleted[table] = rows.length;
        if (rows.length >= cap) more = true;
      } catch {
        // جدول غير موجود في هذا المخطط — نتخطّاه بلا فشل للاستدعاء كله
      }
    }

    const total = Object.values(deleted).reduce((sum, n) => sum + n, 0);
    return { total, deleted, more };
  },
});

/**
 * 📊 فحص سريع: هل بقي شيء في جداول المخلفات؟
 * يقرأ صفاً واحداً فقط من كل جدول (تكلفته شبه معدومة) فلا يُستهلك I/O.
 */
export const aiDataLeft = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const nonEmpty: string[] = [];
    for (const table of AI_DATA_TABLES) {
      try {
        const one = await ctx.db.query(table as any).take(1);
        if (one.length > 0) nonEmpty.push(table);
      } catch {
        // جدول غير موجود — لا يُحتسب
      }
    }
    return { tables: AI_DATA_TABLES.length, nonEmpty };
  },
});
