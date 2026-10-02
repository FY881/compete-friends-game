import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🩺 أداة 31 — المدقّق الشامل / حارس الصحة الدائم (Health Guard)
 *
 * فحص دقيق جداً لكل شيء في اللعبة — يعمل دورياً كل ساعة (عبر aiCron)
 * ويُشغَّل يدوياً من السطح. كل فحص يُسجَّل بنتيجته، وكل ما يمكن إصلاحه
 * تلقائياً يُصلَح فوراً في نفس الجولة، فلا تعود المشكلة دون أن تُكتشف.
 *
 * المناطق المدقَّقة:
 *   1) crons     — كل مهام الخلفية: أخطاء أخيرة، تأخر عن جدولها
 *   2) errors    — الأخطاء غير المحلولة آخر 24 ساعة + شدّتها
 *   3) clusters  — عناقيد الأخطاء غير المشخّصة
 *   4) patches   — رقع الجرّاح الذكي المعلّقة
 *   5) agents    — الوكلاء الأحرار: الأحياء، وتعطيل المهملين (إصلاح)
 *   6) decisions — نبض ناقل القرارات (آخر 24 ساعة)
 *   7) hygiene   — تنظيف السجلات الفاترة + سجلات الفحص القديمة (إصلاح)
 * ═══════════════════════════════════════════════════════════════════════
 */

interface CheckResult {
  area: string;
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  healed?: boolean;
}

const DAY = 86_400_000;

/** جولة الفحص الكاملة — تُستدعى من cron ومن الزر اليدوي. */
async function runFullAudit(ctx: MutationCtx): Promise<CheckResult[]> {
  const now = Date.now();
  const results: CheckResult[] = [];

  // ── 1) crons: أخطاء أخيرة وتأخر عن الجدول ──────────────────────────
  const jobRows = await ctx.db.query("aiCronJobs").collect();
  const errored = jobRows.filter((j) => j.lastStatus === "error");
  if (errored.length > 0) {
    results.push({
      area: "crons",
      name: "أخطاء المهام الخلفية",
      status: "warn",
      detail: `${errored.length} مهمة أخطأت آخر تشغيل: ${errored
        .slice(0, 3)
        .map((j) => j.key)
        .join("، ")}`,
    });
  } else {
    results.push({
      area: "crons",
      name: "أخطاء المهام الخلفية",
      status: "pass",
      detail: `كل المهام المسجّلة (${jobRows.length}) تشغّلت بلا أخطاء`,
    });
  }

  const staleJobs = jobRows.filter(
    (j) => j.enabled && j.lastRunAt > 0 && now - j.lastRunAt > j.intervalMinutes * 60_000 * 2.5,
  );
  if (staleJobs.length > 0) {
    results.push({
      area: "crons",
      name: "تأخر المهام عن جدولها",
      status: "warn",
      detail: `${staleJobs.length} مهمة مفعّلة متأخرة عن جدولها: ${staleJobs
        .slice(0, 3)
        .map((j) => j.key)
        .join("، ")}`,
    });
  } else {
    results.push({
      area: "crons",
      name: "تأخر المهام عن جدولها",
      status: "pass",
      detail: "كل المهام المفعّلة تُشغَّل في مواعيدها",
    });
  }

  // ── 2) errors: الأخطاء غير المحلولة آخر 24 ساعة ─────────────────────
  const recentErrors = await ctx.db
    .query("errorLogs")
    .withIndex("by_created", (q) => q.gte("createdAt", now - DAY))
    .collect();
  const unresolved = recentErrors.filter((e) => !e.resolved);
  const critical = unresolved.filter((e) => e.severity === "high" || e.severity === "critical");
  if (critical.length > 0) {
    results.push({
      area: "errors",
      name: "أخطاء حرّة غير محلولة (24 ساعة)",
      status: "fail",
      detail: `${critical.length} خطأ حرّ/حرج من أصل ${unresolved.length} غير محلول`,
    });
  } else if (unresolved.length > 20) {
    results.push({
      area: "errors",
      name: "أخطاء غير محلولة (24 ساعة)",
      status: "warn",
      detail: `${unresolved.length} خطأ غير محلول، لا حرّ منها`,
    });
  } else {
    results.push({
      area: "errors",
      name: "أخطاء غير محلولة (24 ساعة)",
      status: "pass",
      detail: `فقط ${unresolved.length} خطأ غير محلول — الوضع سليم`,
    });
  }

  // ── 3) clusters: عناقيد غير مشخّصة ─────────────────────────────────
  const untriaged = await ctx.db
    .query("aiErrorClusters")
    .withIndex("by_verdict", (q) => q.eq("aiVerdict", "untriaged"))
    .collect();
  const fresh = untriaged.filter((c) => now - c.lastSeen < 7 * DAY);
  results.push({
    area: "clusters",
    name: "عناقيد أخطاء غير مشخّصة",
    status: fresh.length > 5 ? "warn" : "pass",
    detail:
      fresh.length > 0
        ? `${fresh.length} عنقود نشط بانتظار التشخيص`
        : "لا عناقيد نشطة بانتظار التشخيص",
  });

  // ── 4) patches: رقع معلّقة ─────────────────────────────────────────
  const pendingPatches = await ctx.db
    .query("aiPatches")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();
  results.push({
    area: "patches",
    name: "رقع الجرّاح المعلّقة",
    status: pendingPatches.length > 10 ? "warn" : "pass",
    detail: `${pendingPatches.length} رقعة بانتظار قرار المالك`,
  });

  // ── 5) agents: الوكلاء الأحرار — تعطيل المهملين (إصلاح تلقائي) ─────
  const activeAgents = await ctx.db
    .query("freeAgents")
    .withIndex("by_active", (q) => q.eq("active", true))
    .collect();
  const STALE_AGENT = 7 * DAY;
  let deactivated = 0;
  for (const a of activeAgents) {
    if (a.lastPulseAt > 0 && now - a.lastPulseAt > STALE_AGENT) {
      await ctx.db.patch(a._id, { active: false });
      deactivated += 1;
      if (deactivated >= 100) break; // سقف أمان للجولة الواحدة
    }
  }
  results.push({
    area: "agents",
    name: "أحرار مهملون",
    status: "pass",
    detail:
      deactivated > 0
        ? `${deactivated} وكيل ساكناً أكثر من 7 أيام أُوقفوا تلقائياً من ${activeAgents.length} نشط`
        : `${activeAgents.length} حرّاً نشطاً كلهم في نبضاتهم الأخيرة`,
    healed: deactivated > 0,
  });

  // ── 6) decisions: نبض ناقل القرارات ────────────────────────────────
  const recentDecisions = await ctx.db
    .query("aiDecisionLog")
    .withIndex("by_created", (q) => q.gte("createdAt", now - DAY))
    .take(1);
  results.push({
    area: "decisions",
    name: "نبض ناقل القرارات",
    status: recentDecisions.length > 0 ? "pass" : "warn",
    detail:
      recentDecisions.length > 0
        ? "الأنظمة تسجّل قراراتها بنشاط آخر 24 ساعة"
        : "لا قرارات مسجّلة آخر 24 ساعة — ربما هدوء أو توقّف أنظمة",
  });

  // ── 7) hygiene: تنظيف السجلات الفاترة (إصلاح تلقائي) ───────────────
  let prunedNotes = 0;
  const oldNotes = await ctx.db
    .query("agentMindNotes")
    .withIndex("by_created", (q) => q.lt("createdAt", now - 30 * DAY))
    .take(50);
  for (const n of oldNotes) {
    await ctx.db.delete(n._id);
    prunedNotes += 1;
  }
  let prunedRuns = 0;
  const oldRuns = await ctx.db
    .query("healthAuditRuns")
    .withIndex("by_created", (q) => q.lt("createdAt", now - 14 * DAY))
    .order("desc")
    .take(50);
  for (const r of oldRuns) {
    await ctx.db.delete(r._id);
    prunedRuns += 1;
  }
  if (prunedNotes + prunedRuns > 0) {
    results.push({
      area: "hygiene",
      name: "تنظيف السجلات الفاترة",
      status: "pass",
      detail: `حُذف ${prunedNotes} ملاحظة وكيل أقدم من 30 يوماً، و${prunedRuns} سجل فحص أقدم من 14 يوماً`,
      healed: true,
    });
  }

  return results;
}

/** يُسجّل جولة الفحص ويعيد خلاصتها. */
async function recordRun(ctx: MutationCtx, results: CheckResult[]): Promise<string> {
  const now = Date.now();
  const passed = results.filter((r) => r.status === "pass").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const failures = results.filter((r) => r.status === "fail").length;
  const healed = results.filter((r) => r.healed === true).length;
  const verdict = failures > 0 ? "حرج" : warnings > 0 ? "تنبيهات" : "سليم";
  await ctx.db.insert("healthAuditRuns", {
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    totalChecks: results.length,
    passed,
    warnings,
    failures,
    healed,
    verdict,
    results,
    createdAt: now,
  });
  return verdict;
}

/** نبضة الفحص الدورية — كل ساعة عبر aiCron. */
export const healthPulse = internalMutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const results = await runFullAudit(ctx);
    await recordRun(ctx, results);
    return null;
  },
});

/** تشغيل فحص شامل الآن — أي مستخدم مسجّل. */
export const runAuditNow = mutation({
  args: {},
  handler: async (ctx): Promise<{ verdict: string; total: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");
    const results = await runFullAudit(ctx);
    const verdict = await recordRun(ctx, results);
    return { verdict, total: results.length };
  },
});

/** آخر جولة فحص — للعرض في السطح. */
export const getLatestAudit = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("healthAuditRuns")
      .withIndex("by_created")
      .order("desc")
      .first();
    return row ?? null;
  },
});

/** آخر 10 جولات — سجل التاريخ. */
export const getAuditHistory = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("healthAuditRuns")
      .withIndex("by_created")
      .order("desc")
      .take(10);
  },
});
