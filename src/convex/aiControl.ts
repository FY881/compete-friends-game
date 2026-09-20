/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎛️ v12.0 — خادم غرفة الوكلاء: سيطرة كاملة حقيقية على كل ذكاء
 *
 * ماذا يفعل هذا الملف، بالحقيقة لا بالوصف:
 *   ① يعرض سجلًا كاملًا لكل ذكاء في اللعبة مع حالته الحيّة وسبب توقفه.
 *   ② ينفّذ «شغّل الآن» فعلاً عبر مسار تنفيذ حقيقي لكل ذكاء (لا زر وهمي).
 *   ③ يوقف/يشغّل، ويوقف **لمدة يكتبها المالك**، ويقيّد الاستهلاك بحصص.
 *   ④ يمنح/يسحب قدرات، ويوقف أشياء بالاسم، ويحقن أوامر نصية في سياق الوحدة.
 *   ⑤ يسجّل كل قرار وكل تنفيذ في سجل موحّد (`aiLedger`) + سجل التدقيق.
 *
 * ولا يعمل أي ذكاء تلقائياً خارج الحرس `aiControlGuard` — وهذا هو الحبل.
 * ═══════════════════════════════════════════════════════════════════════
 */

import {
  action,
  internalMutation,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import {
  AI_REGISTRY,
  aiEntry,
  censusStats,
  searchAi,
  type AiCapability,
} from "./aiRegistry";
import {
  appendOrder,
  clampCap,
  clampStopHours,
  defaultControl,
  diagnoseAi,
  disabledUntilFrom,
  effectiveCapabilities,
  emptyCounters,
  MAX_ORDER_LEN,
  resolveAiState,
  roomSummary,
  sanitizeOrder,
  type AiControlRow,
  type RoomRowView,
} from "./aiControlCore";
import { ensureControl, guardAi, logLedger, markAiRun, pruneLedger, readControl } from "./aiControlGuard";

// ───────────────────────────────────────────────────────────────────────
// أدوات
// ───────────────────────────────────────────────────────────────────────

const OWNER_EMAIL = "omw70op@gmail.com";

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(userId)) as { role?: string; email?: string; name?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) throw new Error("غرفة الوكلاء للمالك فقط.");
  return { me, userId };
}

function rowToControl(row: Record<string, unknown> | null): AiControlRow | null {
  if (!row) return null;
  return {
    key: row.key as string,
    enabled: Boolean(row.enabled),
    disabledUntil: (row.disabledUntil as number) ?? 0,
    capPerHour: (row.capPerHour as number) ?? 0,
    capPerDay: (row.capPerDay as number) ?? 0,
    orders: (row.orders as AiControlRow["orders"]) ?? [],
    granted: (row.granted as AiCapability[]) ?? [],
    revoked: (row.revoked as AiCapability[]) ?? [],
    stopped: (row.stopped as string[]) ?? [],
    note: (row.note as string) ?? "",
    counters: (row.counters as AiControlRow["counters"]) ?? emptyCounters(Date.now()),
    totalRuns: (row.totalRuns as number) ?? 0,
    totalErrors: (row.totalErrors as number) ?? 0,
    lastRunAt: (row.lastRunAt as number) ?? 0,
    lastResult: (row.lastResult as string) ?? "",
    updatedAt: (row.updatedAt as number) ?? 0,
  };
}

async function auditControl(
  ctx: MutationCtx,
  actorName: string,
  actorId: string,
  actionName: string,
  detail: string,
): Promise<void> {
  const me = (await ctx.db.get(actorId as never)) as { email?: string; role?: string } | null;
  await ctx.db.insert("auditLog", {
    actorId: actorId as never,
    actorName,
    actorRole: isOwnerUser(me) ? "owner" : "deputy_owner",
    action: actionName,
    detail: detail.slice(0, 200),
    at: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// ① بذر السجل: صف سيطرة لكل ذكاء — لا ذكاء بلا مقعد في الغرفة
// ═══════════════════════════════════════════════════════════════════════

export const seedControls = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    const now = Date.now();
    for (const entry of AI_REGISTRY) {
      const existing = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", entry.key)).first();
      if (existing) continue;
      const fresh = defaultControl(entry, now);
      await ctx.db.insert("aiControls", {
        ...fresh,
        granted: fresh.granted as string[],
        revoked: fresh.revoked as string[],
      } as never);
      created += 1;
    }
    return { created, total: AI_REGISTRY.length };
  },
});

/** الواجهة العامة للبذر — يستدعيها زر «بذر السجل» في غرفة الوكلاء. */
export const seedControlsPublic = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    let created = 0;
    const now = Date.now();
    for (const entry of AI_REGISTRY) {
      const existing = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", entry.key)).first();
      if (existing) continue;
      const fresh = defaultControl(entry, now);
      await ctx.db.insert("aiControls", {
        ...fresh,
        granted: fresh.granted as string[],
        revoked: fresh.revoked as string[],
      } as never);
      created += 1;
    }
    return { ok: true, created, total: AI_REGISTRY.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② الغرفة: السجل الكامل + الحالة الحيّة + التشخيص
// ═══════════════════════════════════════════════════════════════════════

export const getAgentRoom = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();

    const controls = await ctx.db.query("aiControls").take(200);
    const controlByKey = new Map<string, AiControlRow>();
    for (const row of controls) controlByKey.set(row.key, rowToControl(row as unknown as Record<string, unknown>)!);

    const jobRows = await ctx.db.query("aiCronJobs").take(60);
    const jobByKey = new Map(jobRows.map((r) => [r.key, r] as const));
    const unitRows = await ctx.db.query("aiHubUnits").take(60);
    const unitByKey = new Map(unitRows.map((r) => [r.unit, r] as const));

    const agents = await ctx.db.query("aiAgents").take(200);
    const agentsCount = agents.filter((a) => !a.retired).length;
    const hubEvents = await ctx.db.query("aiHubEvents").order("desc").take(1);

    // حالة المحرك الحقيقي — تُقرأ من مركز API لا من التخمين
    const settingsRows = await ctx.db.query("settings").take(200);
    const apiRow = settingsRows.find((s) => s.key === "apiCenterSystems" || s.key === "api_systems" || s.key === "apiHubSystems");
    const hasKey = (() => {
      try {
        const raw = apiRow?.value ?? "";
        if (!raw) return false;
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return Boolean(apiRow?.value && apiRow.value.length > 20);
      }
    })();

    const matching = searchAi(args.q ?? "");

    const rows: (RoomRowView & {
      entry: (typeof AI_REGISTRY)[number];
      diagnosis: ReturnType<typeof diagnoseAi>;
      enabled: boolean;
      disabledUntil: number;
      remainingMinutes: number;
      orderList: AiControlRow["orders"];
      granted: AiCapability[];
      revoked: AiCapability[];
      note: string;
      lastResult: string;
      totalRuns: number;
      totalErrors: number;
      lastRunAt: number;
      hourUsed: number;
      dayUsed: number;
      capPerHour: number;
      capPerDay: number;
      job: { enabled: boolean; intervalMinutes: number; lastRunAt: number; lastStatus: string; lastResult: string; errorCount: number } | null;
      unit: { enabled: boolean; sensitivity: number; lastEventAt: number; eventCount: number } | null;
    })[] = [];

    for (const entry of matching) {
      const control = controlByKey.get(entry.key) ?? null;
      const live = {
        job: entry.jobKey
          ? (() => {
              const j = jobByKey.get(entry.jobKey!);
              return j
                ? { enabled: j.enabled, intervalMinutes: j.intervalMinutes, lastRunAt: j.lastRunAt, lastStatus: j.lastStatus, lastResult: j.lastResult, errorCount: j.errorCount }
                : null;
            })()
          : null,
        unit: entry.unitKey
          ? (() => {
              const u = unitByKey.get(entry.unitKey!);
              return u ? { enabled: u.enabled, sensitivity: u.sensitivity, lastEventAt: u.lastEventAt ?? 0, eventCount: u.eventCount ?? 0 } : null;
            })()
          : null,
        hasKey,
        deputyOnline: false,
        agentsCount,
      };
      const res = resolveAiState(entry, control, now);
      const diagnosis = diagnoseAi(entry, control, live, now);
      const effective = control ?? defaultControl(entry, now);
      rows.push({
        key: entry.key,
        name: entry.name,
        emoji: entry.emoji,
        dept: entry.dept,
        kind: entry.kind,
        wiring: entry.wiring,
        state: entry.wiring === "dormant" ? "dormant" : res.state,
        headline: diagnosis.headline,
        hourUsed: res.quota.hourUsed,
        dayUsed: res.quota.dayUsed,
        capPerHour: effective.capPerHour,
        capPerDay: effective.capPerDay,
        enabled: effective.enabled,
        disabledUntil: effective.disabledUntil,
        totalRuns: effective.totalRuns,
        totalErrors: effective.totalErrors,
        lastRunAt: effective.lastRunAt,
        capabilities: effectiveCapabilities(entry, control),
        stopped: effective.stopped,
        orders: effective.orders.length,
        orderList: effective.orders,
        granted: effective.granted,
        revoked: effective.revoked,
        note: effective.note,
        lastResult: effective.lastResult,
        remainingMinutes: res.remainingMinutes,
        entry,
        diagnosis,
        job: live.job,
        unit: live.unit,
      });
    }

    const summary = roomSummary(rows as unknown as RoomRowView[], now);
    const ledger = await ctx.db.query("aiLedger").withIndex("by_at").order("desc").take(40);

    return {
      summary,
      census: censusStats(),
      rows,
      ledger: ledger.map((l) => ({ key: l.key, name: l.name, emoji: l.emoji, kind: l.kind, actor: l.actor, detail: l.detail, at: l.at })),
      engine: {
        hasKey,
        agentsCount,
        lastHubEvent: hubEvents[0]?.at ?? 0,
        totalRuns: summary.totalRuns,
      },
      at: now,
    };
  },
});

export const getAiLedger = query({
  args: { key: v.optional(v.string()), kind: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const limit = Math.max(1, Math.min(200, args.limit ?? 60));
    const rows = args.key
      ? await ctx.db.query("aiLedger").withIndex("by_key", (q) => q.eq("key", args.key!)).order("desc").take(limit)
      : args.kind
        ? await ctx.db.query("aiLedger").withIndex("by_kind", (q) => q.eq("kind", args.kind!)).order("desc").take(limit)
        : await ctx.db.query("aiLedger").withIndex("by_at").order("desc").take(limit);
    return rows.map((r) => ({ key: r.key, name: r.name, emoji: r.emoji, kind: r.kind, actor: r.actor, detail: r.detail, at: r.at }));
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ التنفيذ الحقيقي — «شغّل الآن» لكل ذكاء له مسار
// ═══════════════════════════════════════════════════════════════════════

type Runner = { label: string; kind: "mutation" | "action"; run: (ctx: ActionCtx) => Promise<unknown> };

const RUNNERS: Record<string, Runner> = {
  engine_llm: {
    label: "نداء حقيقي لمزوّد الذكاء للتأكد من المفتاح",
    kind: "action",
    run: (ctx) => ctx.runAction(api.geminiDoctor.testKey, {}),
  },
  unit_guardian: {
    label: "مسح الدردشة وفرض القوانين",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.chatGuardianSweep, {}),
  },
  unit_sovereign: {
    label: "دورة الحاكم السيادي الكاملة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.sovereignCycle, {}),
  },
  unit_governor: {
    label: "دورة الحكم الذاتي",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.sovereignCycle, {}),
  },
  unit_referee: {
    label: "كشف السلوك الشاذ والغش",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.deepBehaviorScan, {}),
  },
  unit_reports: {
    label: "حسم القضايا من البلاغات المفتوحة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.adjudicateCases, {}),
  },
  unit_health: {
    label: "فحص أنظمة اللعبة والاقتصاد",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.systemsOverseer, {}),
  },
  unit_recommender: {
    label: "استخبار استباقي واقتراحات",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.proactiveIntel, {}),
  },
  unit_doctor: {
    label: "تشخيص الأخطاء غير المحللة",
    kind: "action",
    run: (ctx) => ctx.runAction(internal.geminiDoctor.diagnoseUnanalyzed, {}),
  },
  unit_questions: {
    label: "نشر الأسئلة المجدولة المستحقة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiQuestions.publishScheduled, {}),
  },
  colony_agents: {
    label: "نبضة حياة الوكلاء (ولادة/كلام/لعب)",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiAgents.lifeTick, {}),
  },
  colony_minds: {
    label: "نبضة حياة العقول الاثني عشر",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.livingMinds.lifeTick, {}),
  },
  advisor_crown: {
    label: "دورة التطوير الذاتي للّعبة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.selfDeveloper, {}),
  },
  job_ai_hub_bridge: {
    label: "جسر مركز الذكاء (تبادل السياق)",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiHub.bridgeTick, {}),
  },
  job_ai_hub_prune: {
    label: "تقليم أحداث المركز",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiHub.pruneHubEvents, { keepDays: 3 }),
  },
  job_roof_conflicts: {
    label: "كشف خلافات الوحدات",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiRoof.scanConflicts, {}),
  },
  job_self_maintenance: {
    label: "صيانة وحذف السجلات القديمة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.maintenance.pruneAll, {}),
  },
  job_agents_life: {
    label: "نبضة حياة الوكلاء",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiAgents.lifeTick, {}),
  },
  job_minds_life: {
    label: "نبضة حياة العقول",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.livingMinds.lifeTick, {}),
  },
  job_questions_publish: {
    label: "نشر الأسئلة المجدولة",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.aiQuestions.publishScheduled, {}),
  },
  job_leagues_rollover: {
    label: "تدوير الدوريات",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.leagues.weeklyRollover, {}),
  },
  job_seasons_rollover: {
    label: "تدوير المواسم",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.seasons.autoRollover, {}),
  },
  job_crown_locks: {
    label: "فتح أقفال العرش المنتهية",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.crownDeck.expireLocks, {}),
  },
  job_clans_crown: {
    label: "تتويج العشائر أسبوعياً",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.clans.weeklyCrown, {}),
  },
  job_chat_guardian: {
    label: "مسح الدردشة وفرض القوانين",
    kind: "mutation",
    run: (ctx) => ctx.runMutation(internal.sovereignGovernor.chatGuardianSweep, {}),
  },
};

/** وصف التشغيل المعروض في الواجهة — بلا وعود: ما سيحدث فعلاً بالحرف */
export const runPlan = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    return Object.entries(RUNNERS).map(([key, r]) => ({ key, label: r.label, kind: r.kind }));
  },
});

export const beginRunInternal = internalMutation({
  args: { key: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, { key, force }) => {
    const entry = aiEntry(key);
    if (!entry) throw new Error(`ذكاء غير مسجّل: ${key}`);
    await ensureControl(ctx, key);
    const gate = await guardAi(ctx, key, { force: force === true, countUsage: true });
    if (!gate.allowed) {
      await logLedger(ctx, key, "skip", `مُنع التنفيذ: ${gate.reason}`, "owner");
      return { allowed: false, reason: gate.reason };
    }
    await logLedger(ctx, key, "run", force ? "تشغيل قسري بأمر العرش" : "تشغيل يدوي من غرفة الوكلاء", "owner");
    return { allowed: true, reason: gate.reason };
  },
});

export const finishRunInternal = internalMutation({
  args: { key: v.string(), ok: v.boolean(), result: v.string() },
  handler: async (ctx, { key, ok, result }) => {
    await markAiRun(ctx, key, { ok, result });
    return { ok: true };
  },
});

/**
 * ⚔️ «شغّل الآن» — ينتقل عبر مسار تنفيذ حقيقي لكل ذكاء.
 * ويعيد رسالة صادقة: إما ما نُفِّذ فعلًا، أو سبب الرفض/الفشل بالحرف.
 */
export const runAiNow = action({
  args: { key: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, { key, force }) => {
    const entry = aiEntry(key);
    if (!entry) return { ok: false, message: `ذكاء غير مسجّل: ${key}` };
    const runner = RUNNERS[key];
    if (!runner) {
      return {
        ok: false,
        message: `${entry.name}: لا يملك مسار تنفيذ مباشر — طبقة تُستدعى من أنظمة أخرى (يمكنك ضبطه وإيقافه، لا تشغيله منفرداً).`,
      };
    }

    const begin = (await ctx.runMutation(internal.aiControl.beginRunInternal, { key, force })) as {
      allowed: boolean;
      reason: string;
    };
    if (!begin.allowed) return { ok: false, message: `${entry.name}: ${begin.reason}` };

    const started = Date.now();
    try {
      const out = await runner.run(ctx);
      const ms = Date.now() - started;
      const brief = typeof out === "object" && out !== null ? JSON.stringify(out).slice(0, 160) : String(out).slice(0, 160);
      const message = `${entry.name}: نُفِّذ ${runner.label} في ${ms} مللي — النتيجة: ${brief}`;
      await ctx.runMutation(internal.aiControl.finishRunInternal, { key, ok: true, result: message });
      return { ok: true, message, ms };
    } catch (error) {
      const ms = Date.now() - started;
      const msg = error instanceof Error ? error.message : String(error);
      const message = `${entry.name}: فشل (${runner.label}) — ${msg.slice(0, 160)}`;
      await ctx.runMutation(internal.aiControl.finishRunInternal, { key, ok: false, result: message });
      return { ok: false, message, ms };
    }
  },
});

/** تشغيل جماعي حقيقي بمدى محدد — «شغّل كل شيء» بلا كذب. */
export const runManyNow = action({
  args: { scope: v.optional(v.string()), force: v.optional(v.boolean()) },
  handler: async (ctx, { scope, force }) => {
    const wanted = scope ?? "runnable";
    const keys = Object.keys(RUNNERS).filter((key) => {
      const entry = aiEntry(key);
      if (!entry) return false;
      if (wanted === "jobs") return entry.kind === "job";
      if (wanted === "colonies") return entry.kind === "colony";
      if (wanted === "units") return entry.kind === "unit";
      return true;
    });

    const results: { key: string; name: string; ok: boolean; message: string }[] = [];
    for (const key of keys) {
      const entry = aiEntry(key)!;
      try {
        const res = (await ctx.runAction(api.aiControl.runAiNow, { key, force })) as { ok: boolean; message: string };
        results.push({ key, name: entry.name, ok: res.ok, message: res.message });
      } catch (error) {
        results.push({
          key,
          name: entry.name,
          ok: false,
          message: error instanceof Error ? error.message.slice(0, 160) : "فشل غير مفسَّر",
        });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return {
      ok: okCount > 0,
      ran: results.length,
      succeeded: okCount,
      failed: results.length - okCount,
      results,
      message: `شُغِّل ${results.length} ذكاءً: نجح ${okCount} وفشل ${results.length - okCount}`,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ أوامر العرش على الوكلاء — كل قرار يُسجَّل
// ═══════════════════════════════════════════════════════════════════════

export const setAiEnabled = mutation({
  args: { key: v.string(), enabled: v.boolean(), hours: v.optional(v.number()), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const entry = aiEntry(args.key);
    if (!entry) throw new Error("ذكاء غير مسجّل");
    const control = await ensureControl(ctx, args.key);
    const now = Date.now();
    const hours = clampStopHours(args.hours ?? 0);
    const disabledUntil = args.enabled ? 0 : disabledUntilFrom(hours, now);

    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (row) {
      await ctx.db.patch(row._id, {
        enabled: args.enabled,
        disabledUntil,
        updatedAt: now,
      });
    }
    void control;
    const detail = args.enabled
      ? `تشغيل ${entry.name}`
      : hours > 0
        ? `إيقاف ${entry.name} لمدة ${hours} ساعة`
        : `إيقاف ${entry.name} بلا انتهاء`;
    await logLedger(ctx, args.key, args.enabled ? "start" : "stop", `${detail}${args.reason ? ` — ${sanitizeOrder(args.reason)}` : ""}`, "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, args.enabled ? "ai_enabled" : "ai_disabled", detail);
    return { ok: true, enabled: args.enabled, disabledUntil, hours };
  },
});

export const setAiCaps = mutation({
  args: { key: v.string(), perHour: v.optional(v.number()), perDay: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const entry = aiEntry(args.key);
    if (!entry) throw new Error("ذكاء غير مسجّل");
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    const perHour = args.perHour === undefined ? row.capPerHour : clampCap(args.perHour);
    const perDay = args.perDay === undefined ? row.capPerDay : clampCap(args.perDay);
    await ctx.db.patch(row._id, { capPerHour: perHour, capPerDay: perDay, updatedAt: Date.now() });
    const detail = `حصص ${entry.name}: ${perHour || "بلا حد"}/ساعة · ${perDay || "بلا حد"}/يوم`;
    await logLedger(ctx, args.key, "control", detail, "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_caps", detail);
    return { ok: true, perHour, perDay };
  },
});

export const addAiOrder = mutation({
  args: { key: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const entry = aiEntry(args.key);
    if (!entry) throw new Error("ذكاء غير مسجّل");
    const control = await ensureControl(ctx, args.key);
    const now = Date.now();
    const orders = appendOrder(control.orders, args.text, now);
    if (orders.length === control.orders.length) throw new Error("الأمر قصير جداً (٣ أحرف على الأقل)");
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    await ctx.db.patch(row._id, { orders, updatedAt: now });
    await logLedger(ctx, args.key, "order", `أمر جديد للعرش: ${sanitizeOrder(args.text)}`, "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_order", `${entry.name}: ${sanitizeOrder(args.text).slice(0, 80)}`);
    return { ok: true, orders: orders.length, maxLength: MAX_ORDER_LEN };
  },
});

export const clearAiOrders = mutation({
  args: { key: v.string(), orderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    const current = (row.orders ?? []) as AiControlRow["orders"];
    const orders = args.orderId ? current.filter((o) => o.id !== args.orderId) : [];
    await ctx.db.patch(row._id, { orders, updatedAt: Date.now() });
    await logLedger(ctx, args.key, "control", args.orderId ? "حذف أمر واحد" : "محو كل الأوامر", "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_orders_cleared", args.key);
    return { ok: true, orders: orders.length };
  },
});

export const setAiCapability = mutation({
  args: { key: v.string(), capability: v.string(), granted: v.boolean() },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const entry = aiEntry(args.key);
    if (!entry) throw new Error("ذكاء غير مسجّل");
    const allowed = new Set(entry.capabilities as string[]);
    if (!allowed.has(args.capability)) throw new Error("هذه القدرة ليست من قدرات هذا الذكاء");
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    const granted: string[] = (row.granted ?? []).filter((c) => c !== args.capability);
    const revoked: string[] = (row.revoked ?? []).filter((c) => c !== args.capability);
    if (args.granted) granted.push(args.capability);
    else revoked.push(args.capability);
    await ctx.db.patch(row._id, { granted, revoked, updatedAt: Date.now() });
    const detail = `${args.granted ? "منح" : "سحب"} قدرة «${args.capability}» لـ${entry.name}`;
    await logLedger(ctx, args.key, args.granted ? "grant" : "revoke", detail, "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_capability", detail);
    return { ok: true, granted, revoked };
  },
});

export const setAiStop = mutation({
  args: { key: v.string(), feature: v.string(), stopped: v.boolean() },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const entry = aiEntry(args.key);
    if (!entry) throw new Error("ذكاء غير مسجّل");
    if (!entry.stoppables.includes(args.feature)) throw new Error("هذا البند ليس ضمن ما يمكن إيقافه لهذا الذكاء");
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    const stopped: string[] = (row.stopped ?? []).filter((f) => f !== args.feature);
    if (args.stopped) stopped.push(args.feature);
    await ctx.db.patch(row._id, { stopped, updatedAt: Date.now() });
    const detail = `${args.stopped ? "إيقاف" : "إعادة تشغيل"} «${args.feature}» في ${entry.name}`;
    await logLedger(ctx, args.key, "control", detail, "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_feature_toggle", detail);
    return { ok: true, stopped };
  },
});

export const setAiNote = mutation({
  args: { key: v.string(), note: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireOwner(ctx);
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    await ctx.db.patch(row._id, { note: sanitizeOrder(args.note), updatedAt: Date.now() });
    void userId;
    return { ok: true };
  },
});

export const resetAiCounters = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    await ensureControl(ctx, args.key);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!row) throw new Error("تعذّر قراءة صف السيطرة");
    const now = Date.now();
    await ctx.db.patch(row._id, { counters: emptyCounters(now), updatedAt: now });
    await logLedger(ctx, args.key, "control", "تصفير العدّادات والحصص", "owner");
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_counters_reset", args.key);
    return { ok: true };
  },
});

/** 🚨 إيقاف طارئ شامل: يوقف المهام والوحدات لنفس المدة التي يكتبها المالك. */
export const emergencyStopAll = mutation({
  args: { hours: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const now = Date.now();
    const hours = clampStopHours(args.hours);
    const disabledUntil = disabledUntilFrom(hours, now);
    let touched = 0;
    for (const entry of AI_REGISTRY) {
      if (entry.kind === "module" && entry.wiring === "passive") continue;
      await ensureControl(ctx, entry.key);
      const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", entry.key)).first();
      if (!row) continue;
      await ctx.db.patch(row._id, { enabled: false, disabledUntil, updatedAt: now });
      await logLedger(
        ctx,
        entry.key,
        "stop",
        hours > 0 ? `إيقاف طارئ شامل لمدة ${hours} ساعة` : "إيقاف طارئ شامل بلا انتهاء",
        "owner",
      );
      touched += 1;
    }
    const detail = `🚨 إيقاف طارئ لكل الوكلاء (${touched}) — ${hours > 0 ? `${hours} ساعة` : "بلا انتهاء"}${args.reason ? ` · ${sanitizeOrder(args.reason)}` : ""}`;
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_emergency_stop", detail);
    return { ok: true, touched, disabledUntil, hours };
  },
});

/** ✅ إحياء الوكلاء: يعيد كل ذكاء إلى حالته الافتراضية بسقوف آمنة. */
export const reviveDefaults = mutation({
  args: { enableAll: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { me, userId } = await requireOwner(ctx);
    const now = Date.now();
    const enableAll = args.enableAll === true;
    let touched = 0;
    let enabledCount = 0;
    for (const entry of AI_REGISTRY) {
      await ensureControl(ctx, entry.key);
      const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", entry.key)).first();
      if (!row) continue;
      const enable = enableAll ? true : entry.defaultOn;
      if (enable) enabledCount += 1;
      await ctx.db.patch(row._id, {
        enabled: enable,
        disabledUntil: 0,
        counters: emptyCounters(now),
        updatedAt: now,
      });
      touched += 1;
    }
    const detail = enableAll
      ? `إحياء شامل: ${enabledCount} ذكاءً مفعّلاً بسقوف آمنة`
      : `عودة للافتراضي: ${enabledCount} ذكاءً مفعّلاً فقط`;
    await auditControl(ctx, me.name ?? "المالك", userId as unknown as string, "ai_revive", detail);
    await logLedger(ctx, "engine_llm", "control", detail, "owner");
    return { ok: true, touched, enabled: enabledCount };
  },
});

export const clearAiLedger = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    let removed = 0;
    for (let i = 0; i < 6; i += 1) {
      const rows = await ctx.db.query("aiLedger").withIndex("by_at").take(200);
      if (rows.length === 0) break;
      for (const row of rows) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    return { ok: true, removed };
  },
});

/** تنظيف دوري للسجل — يُستدعى من نبضة الحياة نفسها (بلا cron جديد). */
export const sweepLedger = internalMutation({
  args: {},
  handler: async (ctx) => await pruneLedger(ctx),
});
