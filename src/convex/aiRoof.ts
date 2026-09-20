import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUser } from "./users";
import { isOwnerUser } from "./owner";
import { UNIT_CATALOG } from "./aiHub";
import {
  ROOF_PROFILES,
  SENSITIVITY_DEFAULT,
  UNIT_BEHAVIOR,
  computeRoofPulse,
  conflictKey,
  contextAlerts,
  detectConflicts,
  policyFor,
  sensitivityForProfile,
  summarizeContext,
  unitHealth,
  type ConflictEvent,
  type RoofProfile,
  type UnitState,
} from "./aiCore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 سقف الذكاء الموحّد — الطبقة التي تجعل الوحدات تعمل كواحد
 *
 * مركز الذكاء (`aiHub`) يسجّل القرارات ويضبط الأرقام. هذا الملف يجعل
 * الأرقام **تعمل فعلاً** ويضيف ما كان ناقصاً:
 *
 *   ١) سياسة حقيقية لكل وحدة من حساسيتها — وقراراتها تتغيّر بها فعلاً
 *      (حارس الدردشة يقرأ سياسته قبل كل رسالة: aiCore.reviseByPolicy)
 *   ٢) سياق مشترك حيّ يُبنى من الأنظمة الحقيقية: العقول · العشائر ·
 *      البلاغات · الأخطاء · الاقتصاد — تقرأه كل الوحدات وتُعرض للمالك
 *   ٣) صحة كل وحدة (تعمل/صامتة/متقادمة/مزدحمة) ودرجة صحة للسقف كله
 *   ٤) كشف تلقائي للخلافات بين الوحدات ⇒ قرار المالك = تعلُّم حقيقي
 *
 * كل القراءات مقيّدة بـ take() — صفر استعلامات غير محدودة.
 * ═══════════════════════════════════════════════════════════════════════
 */

const SCAN_UNITS = 60;
const SCAN_MINDS = 200;
const SCAN_CLANS = 200;
const SCAN_REPORTS = 80;
const SCAN_ERRORS = 120;
const SCAN_EVENTS = 400;
const SCAN_CONFLICTS = 40;
const DAY_MS = 86_400_000;

// ═══════════════════════════════════════════════════════════════════════
// قراءة السياسة — يستخدمها أي نظام قبل أن يتخذ قراراً
// ═══════════════════════════════════════════════════════════════════════

/**
 * سياسة وحدة معيّنة كما ضبطها المالك (حساسية 1..10).
 * دالة عادية تُستدعى داخل أي طفرة بلا استعلام إضافي — لذلك يمكن لوحدة
 * الرقابة أن تقرأ سياستها في نفس معاملة القرار.
 */
export async function readUnitPolicy(ctx: QueryCtx | MutationCtx, unit: string) {
  const rec = await ctx.db
    .query("aiHubUnits")
    .withIndex("by_unit", (q) => q.eq("unit", unit))
    .first();
  return policyFor(unit, rec?.sensitivity ?? SENSITIVITY_DEFAULT);
}

/** هل الوحدة مفعّلة؟ (لا سجل = مفعّلة افتراضياً — توافق مع السلوك الحالي) */
export async function unitEnabled(ctx: QueryCtx | MutationCtx, unit: string): Promise<boolean> {
  const rec = await ctx.db
    .query("aiHubUnits")
    .withIndex("by_unit", (q) => q.eq("unit", unit))
    .first();
  return rec?.enabled ?? true;
}

// ═══════════════════════════════════════════════════════════════════════
// السياق المشترك الحيّ — من البيانات الحقيقية لا من الوصف
// ═══════════════════════════════════════════════════════════════════════

async function buildLiveContext(ctx: QueryCtx) {
  const now = Date.now();
  const dayAgo = now - DAY_MS;

  const [minds, clans, reports, errors, treasuries, goals] = await Promise.all([
    ctx.db.query("mindProfiles").withIndex("by_rank").order("desc").take(SCAN_MINDS),
    ctx.db.query("clans").withIndex("by_power", (q) => q.gte("power", 0)).order("desc").take(SCAN_CLANS),
    ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "open")).take(SCAN_REPORTS),
    ctx.db.query("errorLogs").withIndex("by_created").order("desc").take(SCAN_ERRORS),
    ctx.db.query("clanTreasury").take(SCAN_CLANS),
    ctx.db.query("clanGoals").take(SCAN_CLANS),
  ]);

  const activeMinds = minds.filter((m) => m.updatedAt >= dayAgo).length;
  const avgTier =
    minds.length === 0 ? 0 : Math.round((minds.reduce((s, m) => s + m.tierScore, 0) / minds.length) * 10) / 10;
  const clanMembers = clans.reduce((s, c) => s + c.members.length, 0);
  const avgPower = clans.length === 0 ? 0 : Math.round(clans.reduce((s, c) => s + (c.power ?? 0), 0) / clans.length);
  const flags24h = (await ctx.db.query("clanModeration").withIndex("by_created").order("desc").take(50)).filter(
    (f) => f.at >= dayAgo,
  ).length;

  const errors24h = errors.filter((e) => e.createdAt >= dayAgo);
  const criticalErrors = errors24h.filter((e) => e.severity === "critical").length;
  const openReports = reports.length;
  // أقصى خطورة في البلاغ تُقرأ من حكم الذكاء المرفق (الجدول لا يحمل حقل خطورة مباشراً)
  const criticalReports = reports.filter((r) => r.aiVerdict?.severity === "high").length;

  const context = {
    minds: {
      total: minds.length,
      active24h: activeMinds,
      avgTier,
      frozen: minds.filter((m) => m.frozen).length,
    },
    clans: {
      total: clans.length,
      members: clanMembers,
      avgPower,
      frozen: clans.filter((c) => c.frozen).length,
      flags24h,
    },
    reports: { open: openReports, critical: criticalReports },
    errors: { last24h: errors24h.length, critical: criticalErrors },
    economy: {
      treasuryCoinsTotal: treasuries.reduce((s, t) => s + t.coins, 0),
      guildGoalsClaimed: goals.filter((g) => g.claimedAt).length,
    },
  };

  return { context, lines: summarizeContext(context), alerts: contextAlerts(context) };
}

/** السياق المشترك — متاح لأي وحدة داخلية (تقرأه قبل قرارها) وللمالك. */
export const getSharedContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const { context, lines, alerts } = await buildLiveContext(ctx);
    return { at: Date.now(), context, lines, alerts };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// السقف الموحّد — صورة واحدة للمالك
// ═══════════════════════════════════════════════════════════════════════

/** يجمع حالة كل وحدة: كتالوج + ضبط + صحة فعلية. */
async function loadUnits(ctx: QueryCtx): Promise<UnitState[]> {
  const rows = await ctx.db.query("aiHubUnits").withIndex("by_unit").take(SCAN_UNITS);
  return UNIT_CATALOG.map((c) => {
    const rec = rows.find((r) => r.unit === c.unit);
    return {
      unit: c.unit,
      name: c.name,
      dept: c.dept,
      enabled: rec?.enabled ?? true,
      sensitivity: rec?.sensitivity ?? SENSITIVITY_DEFAULT,
      lastEventAt: rec?.lastEventAt ?? null,
      eventCount: rec?.eventCount ?? 0,
    };
  });
}

export const getUnifiedRoof = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (me === null || !isOwnerUser(me)) return null;

    const now = Date.now();
    const [units, live, events, conflicts] = await Promise.all([
      loadUnits(ctx),
      buildLiveContext(ctx),
      ctx.db.query("aiHubEvents").withIndex("by_at", (q) => q.gte("at", now - DAY_MS)).order("desc").take(SCAN_EVENTS),
      ctx.db.query("aiConflicts").take(SCAN_CONFLICTS),
    ]);

    const health = unitHealth(units, now);
    const pulse = computeRoofPulse(health);
    const pending = conflicts.filter((c) => c.status === "pending").sort((a, b) => b.at - a.at);

    return {
      at: now,
      pulse,
      units: health.map((h) => ({
        unit: h.unit,
        name: h.name,
        dept: h.dept,
        enabled: h.enabled,
        sensitivity: h.sensitivity,
        status: h.status,
        statusLabel: h.label,
        policyLabel: h.policy.label,
        blockAt: h.policy.blockAt,
        warnAt: h.policy.warnAt,
        rateLimitPerMinute: h.policy.rateLimitPerMinute,
        strikeTolerance: h.policy.strikeTolerance,
        effect: h.effect,
        lastEventAt: h.lastEventAt,
        eventCount: h.eventCount,
      })),
      context: live.context,
      contextLines: live.lines,
      contextAlerts: live.alerts,
      events: events.slice(0, 30).map((e) => ({
        id: String(e._id),
        unit: e.unit,
        kind: e.kind,
        severity: e.severity,
        summary: e.summary,
        at: e.at,
      })),
      conflicts: pending.map((c) => ({
        id: String(c._id),
        target: c.target,
        unitA: c.unitA,
        unitB: c.unitB,
        severity: c.severity,
        summaryA: c.summaryA,
        summaryB: c.summaryB,
        at: c.at,
      })),
      profiles: ROOF_PROFILES,
      behaviors: UNIT_BEHAVIOR,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ضبط الحساسية — بضغطة أو بملف كامل
// ═══════════════════════════════════════════════════════════════════════

async function requireOwnerCtx(ctx: MutationCtx) {
  const me = await getCurrentUser(ctx);
  if (me === null || !isOwnerUser(me)) throw new Error("غير مصرح — هذه الصلاحية للحاكم السيادي فقط");
  return me;
}

const setResult = v.object({ ok: v.boolean(), message: v.string() });

export const setUnitSensitivity = mutation({
  args: {
    unit: v.string(),
    sensitivity: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  returns: setResult,
  handler: async (ctx, { unit, sensitivity, enabled }) => {
    const me = await requireOwnerCtx(ctx);
    const meta = UNIT_CATALOG.find((c) => c.unit === unit);
    if (!meta) return { ok: false, message: "وحدة غير معروفة" };

    const value = sensitivity ?? SENSITIVITY_DEFAULT;
    if (sensitivity !== undefined && (value < 1 || value > 10)) {
      return { ok: false, message: "الحساسية بين ١ و ١٠" };
    }

    const rec = await ctx.db
      .query("aiHubUnits")
      .withIndex("by_unit", (q) => q.eq("unit", unit))
      .first();
    if (rec) {
      await ctx.db.patch(rec._id, {
        enabled: enabled ?? rec.enabled,
        sensitivity: sensitivity ?? rec.sensitivity,
      });
    } else {
      await ctx.db.insert("aiHubUnits", {
        unit,
        name: meta.name,
        dept: meta.dept,
        desc: meta.desc,
        enabled: enabled ?? true,
        sensitivity: value,
        eventCount: 0,
      });
    }

    const policy = policyFor(unit, value);
    await ctx.db.insert("aiHubEvents", {
      unit,
      kind: "config",
      severity: "info",
      summary:
        `ضبط المالك: ${enabled !== undefined ? (enabled ? "تفعيل" : "تعطيل") : ""}` +
        `${sensitivity !== undefined ? ` · حساسية ${value}/10 (${policy.label})` : ""}` +
        ` ⇒ الحجب عند ${policy.blockAt} · التنبيه عند ${policy.warnAt} · ${policy.rateLimitPerMinute} رسالة/دقيقة · تحمّل ${policy.strikeTolerance} مخالفة`,
      at: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "ai_unit_config",
      detail: `ضبط «${meta.name}»: حساسية ${value}/10 (${policy.label}) — الأثر: ${UNIT_BEHAVIOR.find((b) => b.unit === unit)?.effect ?? "تغيّر حدود الرصد والتنبيه"}`,
      at: Date.now(),
    });

    return {
      ok: true,
      message: `${meta.name}: حساسية ${value}/10 (${policy.label}) — الحجب عند ${policy.blockAt}`,
    };
  },
});

export const applyRoofProfile = mutation({
  args: { profile: v.string() },
  returns: setResult,
  handler: async (ctx, { profile }) => {
    const me = await requireOwnerCtx(ctx);
    const known = ROOF_PROFILES.find((p) => p.id === profile);
    if (!known) return { ok: false, message: "ملف غير معروف" };

    const now = Date.now();
    for (const c of UNIT_CATALOG) {
      const value = sensitivityForProfile(known.id as RoofProfile, c.unit);
      const rec = await ctx.db
        .query("aiHubUnits")
        .withIndex("by_unit", (q) => q.eq("unit", c.unit))
        .first();
      if (rec) {
        await ctx.db.patch(rec._id, { sensitivity: value });
      } else {
        await ctx.db.insert("aiHubUnits", {
          unit: c.unit,
          name: c.name,
          dept: c.dept,
          desc: c.desc,
          enabled: true,
          sensitivity: value,
          eventCount: 0,
        });
      }
    }

    await ctx.db.insert("aiHubEvents", {
      unit: "aiHub",
      kind: "config",
      severity: "warn",
      summary: `طُبِّق ${known.icon} ${known.name} على كل الوحدات (${UNIT_CATALOG.length} وحدة) — ${known.description}`,
      at: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "ai_roof_profile",
      detail: `تطبيق ${known.name} على ${UNIT_CATALOG.length} وحدة ذكاء`,
      at: now,
    });

    return { ok: true, message: `طُبِّق ${known.name} على كل الوحدات` };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// الخلافات — كشف تلقائي وحلّ بقرار المالك
// ═══════════════════════════════════════════════════════════════════════

/** يستخرج هدف الحدث من حمولته (JSON) إن وُجد. */
function targetOf(payload: string | undefined): string | null {
  if (!payload) return null;
  try {
    const p = JSON.parse(payload) as { targetId?: string; target?: string; userId?: string; name?: string };
    return p.targetId ?? p.target ?? p.userId ?? p.name ?? null;
  } catch {
    return null;
  }
}

export const scanConflicts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const events = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", now - DAY_MS))
      .order("desc")
      .take(SCAN_EVENTS);

    const inputs: ConflictEvent[] = events.map((e) => ({
      unit: e.unit,
      kind: e.kind,
      severity: e.severity,
      summary: e.summary,
      target: targetOf(e.payload),
      at: e.at,
    }));

    const detected = detectConflicts(inputs);
    const existing = await ctx.db.query("aiConflicts").take(SCAN_CONFLICTS);
    let inserted = 0;

    for (const c of detected) {
      const key = conflictKey(c);
      if (existing.some((x) => x.key === key && x.status === "pending")) continue;
      await ctx.db.insert("aiConflicts", {
        key,
        target: c.target,
        unitA: c.unitA,
        unitB: c.unitB,
        stanceA: c.stanceA,
        stanceB: c.stanceB,
        severity: c.severity,
        summaryA: c.summaryA,
        summaryB: c.summaryB,
        status: "pending",
        at: c.at,
      });
      inserted += 1;
    }

    if (inserted > 0) {
      await ctx.db.insert("aiHubEvents", {
        unit: "aiHub",
        kind: "conflict_scan",
        severity: "warn",
        summary: `كشف ${inserted} خلافاً بين وحدات الذكاء حول نفس الهدف — بانتظار قرار العرش`,
        at: now,
      });
    }
    return { scanned: inputs.length, detected: detected.length, inserted };
  },
});

/** زر «افحص الآن» في غرفة المالك. */
export const scanNow = mutation({
  args: {},
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    await requireOwnerCtx(ctx);
    const now = Date.now();
    const events = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", now - DAY_MS))
      .order("desc")
      .take(SCAN_EVENTS);
    const detected = detectConflicts(
      events.map((e) => ({
        unit: e.unit,
        kind: e.kind,
        severity: e.severity,
        summary: e.summary,
        target: targetOf(e.payload),
        at: e.at,
      })),
    );
    const existing = await ctx.db.query("aiConflicts").take(SCAN_CONFLICTS);
    let inserted = 0;
    for (const c of detected) {
      const key = conflictKey(c);
      if (existing.some((x) => x.key === key && x.status === "pending")) continue;
      await ctx.db.insert("aiConflicts", {
        key,
        target: c.target,
        unitA: c.unitA,
        unitB: c.unitB,
        stanceA: c.stanceA,
        stanceB: c.stanceB,
        severity: c.severity,
        summaryA: c.summaryA,
        summaryB: c.summaryB,
        status: "pending",
        at: c.at,
      });
      inserted += 1;
    }
    return {
      ok: true,
      message:
        inserted > 0
          ? `كُشف ${inserted} خلاف جديد من ${events.length} حدثاً خلال 24 ساعة`
          : `لا خلافات جديدة — الوحدات متفقة (فُحص ${events.length} حدثاً)`,
    };
  },
});

export const resolveConflict = mutation({
  args: {
    conflictId: v.id("aiConflicts"),
    winner: v.string(),
    resolution: v.optional(v.string()),
    dismiss: v.optional(v.boolean()),
  },
  returns: setResult,
  handler: async (ctx, { conflictId, winner, resolution, dismiss }) => {
    const me = await requireOwnerCtx(ctx);
    const row = await ctx.db.get(conflictId);
    if (!row) return { ok: false, message: "الخلاف غير موجود" };
    if (row.status !== "pending") return { ok: false, message: "هذا الخلاف محسوم سابقاً" };

    const now = Date.now();
    const status = dismiss ? "dismissed" : "resolved";
    await ctx.db.patch(conflictId, {
      status,
      winner: dismiss ? undefined : winner,
      resolution: resolution?.trim().slice(0, 200) || (dismiss ? "لا خلاف فعلي" : "قرار العرش"),
      resolvedBy: me.name ?? "المالك",
      resolvedAt: now,
    });

    // 🧠 تعلُّم حقيقي: القرار يُسجَّل في السجل الموحّد فتراه بقية الوحدات
    await ctx.db.insert("aiHubEvents", {
      unit: "aiHub",
      kind: "conflict_resolved",
      severity: "info",
      summary: dismiss
        ? `أُغلق خلاف على «${row.target}» باعتباره غير جوهري`
        : `حسم العرش خلاف «${row.target}»: الراجح ${winner} — قرار: ${resolution?.trim().slice(0, 80) || "قرار العرش"}`,
      payload: JSON.stringify({ targetId: row.target, winner, loser: winner === row.unitA ? row.unitB : row.unitA }),
      at: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "ai_conflict_resolved",
      detail: dismiss
        ? `إغلاق خلاف وحدات على «${row.target}»`
        : `حسم خلاف وحدات على «${row.target}» لصالح ${winner}`,
      at: now,
    });

    return {
      ok: true,
      message: dismiss ? "أُغلق الخلاف" : `حُسم لصالح ${winner} — سُجِّل في السجل الموحّد`,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// فحص حيّ (يُستخدم للتحقق وللعرض) — يكشف أن الحساسية تغيّر السلوك فعلاً
// ═══════════════════════════════════════════════════════════════════════

export const roofInfo = query({
  args: {},
  handler: async () => ({
    units: UNIT_CATALOG.map((c) => ({ unit: c.unit, name: c.name, dept: c.dept })),
    profiles: ROOF_PROFILES.map((p) => ({
      id: p.id,
      name: p.name,
      guardianSensitivity: sensitivityForProfile(p.id, "guardian"),
    })),
    policies: [1, 5, 10].map((s) => {
      const p = policyFor("guardian", s);
      return {
        sensitivity: s,
        label: p.label,
        blockAt: p.blockAt,
        warnAt: p.warnAt,
        rateLimitPerMinute: p.rateLimitPerMinute,
        strikeTolerance: p.strikeTolerance,
      };
    }),
  }),
});
