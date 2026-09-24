/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 مخزن مركز API — القراءات والكتابات الحقيقية (بلا Node runtime)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * مبدآن يحكمان هذا الملف:
 *  ① قراءة واحدة فقط لكل استدعاء AI: `readEngineConfig` تجمع المزوّدين
 *     والتوجيه والحدود والنماذج المُكتشَفة في رحلة قاعدة بيانات واحدة.
 *  ② كتابة واحدة فقط: `recordCall` تُسجّل الاستدعاء وتُحدّث الاستهلاك
 *     والكاش وقاطع الدائرة معاً — بلا كتابات متفرقة.
 * ═══════════════════════════════════════════════════════════════════════
 */
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  AI_TASKS,
  DEFAULT_GUARD,
  DEFAULT_TASK_KEY,
  PROVIDER_PRESETS,
  detectPresetId,
  getTaskDef,
  sanitizeGuard,
  type ApiGuardConfig,
} from "./apiCenterCore";

// ═══════════════════════════════════════════════════════════════════════
// أدوات مشتركة
// ═══════════════════════════════════════════════════════════════════════

export const SETTING_A = "apiSystemA";
export const SETTING_B = "apiSystemB";

export type StoredProvider = {
  apiKey: string;
  baseUrl?: string;
  presetId?: string;
  /**Explicitly distinguish key-only providers from key+URL providers.*/
  kind?: "key_url" | "key_only";
  model?: string | null;
  enabled?: boolean;
  updatedAt: number;
};

/** سياق قراءة (استعلام أو تعديل — كلاهما يقرأ) */
type ReadCtx = QueryCtx | MutationCtx;

async function readJson<T>(ctx: ReadCtx, key: string): Promise<T | null> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function writeJson(ctx: MutationCtx, key: string, value: unknown): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  const json = JSON.stringify(value);
  if (row) await ctx.db.patch(row._id, { value: json });
  else await ctx.db.insert("settings", { key, value: json });
}

export function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** المزوّد المخزَّن ← كائن حقيقي موحّد (يُستخدم في المحرك والواجهة) */
function toProvider(which: "A" | "B", stored: StoredProvider | null) {
  if (!stored || !stored.apiKey) return null;
  const baseUrl = (stored.baseUrl ?? "").trim();
  const presetId = stored.presetId ?? detectPresetId(baseUrl);
  return {
    id: which,
    // Rows created before the kind field existed are inferred safely. An empty URL
    // means this is the key-only slot, not a broken key+URL provider.
    kind: stored.kind ?? (baseUrl ? ("key_url" as const) : ("key_only" as const)),
    apiKey: stored.apiKey,
    baseUrl,
    presetId,
    model: stored.model ?? null,
    enabled: stored.enabled !== false,
    updatedAt: stored.updatedAt,
  };
}

/** الإعداد الافتراضي للتوجيه — يُدمج مع ما اختاره المالك */
export function defaultRouteRow(task: string) {
  const def = getTaskDef(task);
  return {
    task: def.key,
    label: def.label,
    model: null as string | null,
    temperature: null as number | null,
    maxTokens: def.maxTokens,
    needsJson: def.needsJson,
    enabled: true,
    cacheTtlMs: def.cacheTtlMs,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ① قراءة المحرك — رحلة واحدة لكل استدعاء AI
// ═══════════════════════════════════════════════════════════════════════

export const readEngineConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [a, b, guardRow, routeRows, modelsA, modelsB, envNote] = await Promise.all([
      readJson<StoredProvider>(ctx, SETTING_A),
      readJson<StoredProvider>(ctx, SETTING_B),
      ctx.db
        .query("apiGuard")
        .withIndex("by_id_key", (q) => q.eq("id", "main"))
        .first(),
      ctx.db.query("apiRoutes").withIndex("by_task", (q) => q.gte("task", "")).collect(),
      readJson<{ models: string[]; at: number }>(ctx, "apiModelsA"),
      readJson<{ models: string[]; at: number }>(ctx, "apiModelsB"),
      readJson<{ active: boolean; at: number; presetId: string }>(ctx, "apiEnvBootstrap"),
    ]);

    const merged: Record<string, any> = {};
    for (const def of AI_TASKS) merged[def.key] = defaultRouteRow(def.key);
    for (const row of routeRows) {
      if (!merged[row.task]) continue;
      merged[row.task] = {
        task: row.task,
        label: row.label || merged[row.task].label,
        model: row.model ?? null,
        temperature: typeof row.temperature === "number" ? row.temperature : null,
        maxTokens: row.maxTokens,
        needsJson: row.needsJson,
        enabled: row.enabled,
        cacheTtlMs: merged[row.task].cacheTtlMs ?? 0,
      };
    }
    if (!merged[DEFAULT_TASK_KEY]) merged[DEFAULT_TASK_KEY] = defaultRouteRow(DEFAULT_TASK_KEY);

    return {
      providers: [toProvider("A", a), toProvider("B", b)].filter(Boolean),
      guard: sanitizeGuard(guardRow ?? DEFAULT_GUARD),
      routes: merged,
      discovered: {
        A: modelsA?.models ?? [],
        B: modelsB?.models ?? [],
      },
      envBootstrap: envNote ?? null,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ② قراءة ما قبل الاستدعاء — الكاش + لقطة الحدود (رحلة واحدة)
// ═══════════════════════════════════════════════════════════════════════

export const preflight = internalQuery({
  args: { fp: v.optional(v.string()), now: v.number() },
  handler: async (ctx, { fp, now }) => {
    const day = dayKey(now);
    const [usage, minuteRows, circuit] = await Promise.all([
      ctx.db
        .query("apiUsageDaily")
        .withIndex("by_day", (q) => q.eq("day", day))
        .collect(),
      ctx.db
        .query("apiCallEvents")
        .withIndex("by_created", (q) => q.gte("at", now - 60_000))
        .collect(),
      ctx.db
        .query("apiCircuit")
        .withIndex("by_main", (q) => q.eq("id", "main"))
        .first(),
    ]);

    let cache: { reply: string } | null = null;
    if (fp) {
      const row = await ctx.db
        .query("apiReplyCache")
        .withIndex("by_fp", (q) => q.eq("fp", fp))
        .first();
      if (row && (row.expiresAt === 0 || row.expiresAt > now)) cache = { reply: row.reply };
    }

    const dayCalls = usage.reduce((s: number, r: any) => s + r.calls, 0);
    const dayTokens = usage.reduce((s: number, r: any) => s + r.tokensIn + r.tokensOut, 0);

    return {
      cache,
      minuteCalls: minuteRows.filter((r: any) => !r.cached).length,
      dayCalls,
      dayTokens,
      circuitOpen: Boolean(circuit?.open),
      circuitOpenedAt: (circuit?.openedAt as number | null | undefined) ?? null,
      failures: circuit?.failures ?? 0,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ③ التسجيل — كتابة واحدة لكل استدعاء
// ═══════════════════════════════════════════════════════════════════════

export const recordCall = internalMutation({
  args: {
    ok: v.boolean(),
    provider: v.string(),
    providerKind: v.string(),
    task: v.string(),
    label: v.string(),
    model: v.string(),
    latencyMs: v.number(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    cached: v.boolean(),
    attempt: v.number(),
    error: v.optional(v.string()),
    promptChars: v.number(),
    at: v.number(),
    /** حفظ الرد في الذاكرة (إن كانت الوحدة تسمح) */
    cacheFp: v.optional(v.string()),
    cacheReply: v.optional(v.string()),
    cacheTtlMs: v.number(),
    /** سقف الفشل المتتالي لفتح القاطع */
    failureThreshold: v.number(),
    /** هل الحماية مفعّلة؟ (تحدّد هل نُحرّك القاطع) */
    guardOn: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiCallEvents", {
      ok: args.ok,
      provider: args.provider,
      providerKind: args.providerKind,
      task: args.task,
      taskLabel: getTaskDef(args.task).label,
      label: args.label,
      model: args.model,
      latencyMs: args.latencyMs,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      cached: args.cached,
      attempt: args.attempt,
      error: args.error,
      promptChars: args.promptChars,
      at: args.at,
    });

    // الاستهلاك اليومي — لا نعدّ الكاش استدعاءً مدفوعاً
    const day = dayKey(args.at);
    const existing = await ctx.db
      .query("apiUsageDaily")
      .withIndex("by_day_model", (q) => q.eq("day", day).eq("model", args.model))
      .first();
    const patch = {
      calls: (existing?.calls ?? 0) + (args.cached ? 0 : 1),
      okCalls: (existing?.okCalls ?? 0) + (args.ok ? 1 : 0),
      failCalls: (existing?.failCalls ?? 0) + (args.ok ? 0 : 1),
      cacheHits: (existing?.cacheHits ?? 0) + (args.cached ? 1 : 0),
      tokensIn: (existing?.tokensIn ?? 0) + args.tokensIn,
      tokensOut: (existing?.tokensOut ?? 0) + args.tokensOut,
      totalLatencyMs: (existing?.totalLatencyMs ?? 0) + args.latencyMs,
      updatedAt: args.at,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("apiUsageDaily", {
        day,
        provider: args.provider,
        model: args.model,
        ...patch,
      });
    }

    // الذاكرة — نحفظ فقط الردود الناجحة غير المسترجَعة من الذاكرة
    if (args.cacheFp && args.cacheReply && args.cacheTtlMs > 0 && args.ok && !args.cached) {
      const prev = await ctx.db
        .query("apiReplyCache")
        .withIndex("by_fp", (q) => q.eq("fp", args.cacheFp!))
        .first();
      const row = {
        reply: args.cacheReply,
        provider: args.provider,
        model: args.model,
        task: args.task,
        expiresAt: args.at + args.cacheTtlMs,
        createdAt: args.at,
      };
      if (prev) await ctx.db.patch(prev._id, row);
      else await ctx.db.insert("apiReplyCache", { fp: args.cacheFp, hits: 0, ...row });
    }

    if (args.cached) {
      const hit = args.cacheFp
        ? await ctx.db
            .query("apiReplyCache")
            .withIndex("by_fp", (q) => q.eq("fp", args.cacheFp!))
            .first()
        : null;
      if (hit) await ctx.db.patch(hit._id, { hits: hit.hits + 1 });
    }

    // قاطع الدائرة
    if (args.guardOn && args.providerKind !== "cached") {
      const circuit = await ctx.db
        .query("apiCircuit")
        .withIndex("by_main", (q) => q.eq("id", "main"))
        .first();
      if (args.ok) {
        if (circuit && (circuit.failures > 0 || circuit.open)) {
          await ctx.db.patch(circuit._id, { failures: 0, open: false, openedAt: null });
        }
      } else {
        const failures = (circuit?.failures ?? 0) + 1;
        const open = failures >= Math.max(1, args.failureThreshold);
        if (circuit) {
          await ctx.db.patch(circuit._id, {
            failures,
            open,
            openedAt: open ? args.at : (circuit.openedAt ?? null),
          });
        } else {
          await ctx.db.insert("apiCircuit", {
            id: "main",
            failures,
            open,
            openedAt: open ? args.at : null,
          });
        }
      }
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ④ الواجهة العامة — محميّة بالمالك وحده
//    (التقليم يجري داخل نظام الصيانة الموجود — بلا cron جديد)
// ═══════════════════════════════════════════════════════════════════════

const OWNER_EMAIL = "omw70op@gmail.com";

async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(userId)) as { role?: string; email?: string; name?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) {
    throw new Error("مركز API للمالك فقط.");
  }
  return me;
}

function mask(key?: string): string {
  const k = (key ?? "").trim();
  if (!k) return "—";
  if (k.length < 12) return "••••";
  return `${k.slice(0, 6)}••••${k.slice(-4)}`;
}

/** كل ما تحتاجه الواجهة في استعلام واحد — بلا عشرات الرحلات */
export const getCenter = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const now = Date.now();
    const day = dayKey(now);
    const weekAgo = dayKey(now - 6 * 24 * 60 * 60 * 1000);

    const [a, b, guardRow, routeRows, modelsA, modelsB, envNote, circuit] = await Promise.all([
      readJson<StoredProvider>(ctx, SETTING_A),
      readJson<StoredProvider>(ctx, SETTING_B),
      ctx.db.query("apiGuard").withIndex("by_id_key", (q) => q.eq("id", "main")).first(),
      ctx.db.query("apiRoutes").withIndex("by_task", (q) => q.gte("task", "")).collect(),
      readJson<{ models: string[]; at: number }>(ctx, "apiModelsA"),
      readJson<{ models: string[]; at: number }>(ctx, "apiModelsB"),
      readJson<{ active: boolean; at: number; presetId: string }>(ctx, "apiEnvBootstrap"),
      ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first(),
    ]);

    const [usageRows, weekRows, events, cacheRows] = await Promise.all([
      ctx.db.query("apiUsageDaily").withIndex("by_day", (q) => q.eq("day", day)).collect(),
      ctx.db.query("apiUsageDaily").withIndex("by_day", (q) => q.gte("day", weekAgo)).collect(),
      ctx.db.query("apiCallEvents").withIndex("by_created", (q) => q.gte("at", 0)).order("desc").take(120),
      ctx.db.query("apiReplyCache").withIndex("by_created", (q) => q.gte("createdAt", 0)).order("desc").take(200),
    ]);

    const guard = sanitizeGuard(guardRow ?? DEFAULT_GUARD);

    const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);
    const todayCalls = sum(usageRows, (r) => r.calls);
    const todayOk = sum(usageRows, (r) => r.okCalls);
    const todayFail = sum(usageRows, (r) => r.failCalls);
    const todayHits = sum(usageRows, (r) => r.cacheHits);
    const todayTokensIn = sum(usageRows, (r) => r.tokensIn);
    const todayTokensOut = sum(usageRows, (r) => r.tokensOut);
    const todayLatency = sum(usageRows, (r) => r.totalLatencyMs);

    const series = Array.from({ length: 7 }, (_, i) => {
      const key = dayKey(now - (6 - i) * 24 * 60 * 60 * 1000);
      const rows = weekRows.filter((r: any) => r.day === key);
      return {
        day: key,
        calls: sum(rows, (r) => r.calls),
        tokens: sum(rows, (r) => r.tokensIn + r.tokensOut),
        cacheHits: sum(rows, (r) => r.cacheHits),
      };
    });

    // استهلاك اليوم لكل وحدة AI — من السجل الحي (حقيقي لا مُقدَّر)
    const perTask: Record<string, { calls: number; fails: number; cached: number; ms: number }> = {};
    for (const e of events) {
      if (e.at < new Date(`${day}T00:00:00.000Z`).getTime()) continue;
      const slot = (perTask[e.task] ??= { calls: 0, fails: 0, cached: 0, ms: 0 });
      slot.calls += 1;
      if (!e.ok) slot.fails += 1;
      if (e.cached) slot.cached += 1;
      slot.ms += e.latencyMs;
    }

    const merged: Record<string, any> = {};
    for (const def of AI_TASKS) merged[def.key] = { ...defaultRouteRow(def.key), group: def.group, what: def.what, cacheTtlMs: def.cacheTtlMs };
    for (const row of routeRows) {
      if (!merged[row.task]) continue;
      merged[row.task] = { ...merged[row.task], ...row };
    }

    const providerView = (which: "A" | "B", stored: StoredProvider | null, discovered: { models: string[]; at: number } | null) => {
      if (!stored || !stored.apiKey) return null;
      const baseUrl = (stored.baseUrl ?? "").trim();
      const presetId = stored.presetId ?? detectPresetId(baseUrl);
      return {
        id: which,
        kind: stored.kind ?? (baseUrl ? "key_url" : "key_only"),
        maskedKey: mask(stored.apiKey),
        baseUrl,
        presetId,
        model: stored.model ?? null,
        enabled: stored.enabled !== false,
        updatedAt: stored.updatedAt,
        discoveredModels: discovered?.models ?? [],
        discoveredAt: discovered?.at ?? null,
      };
    };

    return {
      providers: {
        A: providerView("A", a, modelsA),
        B: providerView("B", b, modelsB),
      },
      presets: PROVIDER_PRESETS.map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.baseUrl,
        models: p.models,
        supportsJsonMode: p.supportsJsonMode,
        notes: p.notes,
      })),
      guard,
      routes: Object.values(merged).sort((x: any, y: any) => AI_TASKS.findIndex((t) => t.key === x.task) - AI_TASKS.findIndex((t) => t.key === y.task)),
      usage: {
        today: {
          calls: todayCalls,
          ok: todayOk,
          fail: todayFail,
          cacheHits: todayHits,
          tokensIn: todayTokensIn,
          tokensOut: todayTokensOut,
          avgLatency: todayCalls > 0 ? Math.round(todayLatency / todayCalls) : 0,
          successRate: todayCalls + todayHits > 0 ? Math.round((todayOk / Math.max(1, todayCalls)) * 100) : 100,
        },
        byModel: usageRows.map((r: any) => ({
          model: r.model,
          calls: r.calls,
          tokens: r.tokensIn + r.tokensOut,
          cacheHits: r.cacheHits,
          avgLatency: r.calls > 0 ? Math.round(r.totalLatencyMs / r.calls) : 0,
        })),
        series,
        perTask,
      },
      cache: {
        entries: cacheRows.length,
        hits: cacheRows.reduce((s: number, r: any) => s + (r.hits ?? 0), 0),
        savedCalls: cacheRows.reduce((s: number, r: any) => s + (r.hits ?? 0), 0),
        recent: cacheRows.slice(0, 8).map((r: any) => ({ task: r.task, model: r.model, hits: r.hits ?? 0, createdAt: r.createdAt })),
      },
      circuit: {
        open: Boolean(circuit?.open),
        failures: circuit?.failures ?? 0,
        openedAt: (circuit?.openedAt as number | null | undefined) ?? null,
        cooldownLeftMs: circuit?.open && circuit.openedAt ? Math.max(0, guard.cooldownMs - (now - circuit.openedAt)) : 0,
      },
      events: events.slice(0, 40),
      errors: events.filter((e: any) => !e.ok && !e.cached).slice(0, 12),
      envBootstrap: envNote ?? null,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ⑥ أوامر المالك — كل زر هنا يُغيّر سلوك اللعبة فعلاً
// ═══════════════════════════════════════════════════════════════════════

export const saveProvider = mutation({
  args: {
    which: v.union(v.literal("A"), v.literal("B")),
    apiKey: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    presetId: v.optional(v.string()),
    model: v.optional(v.union(v.string(), v.null())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    const key = args.which === "A" ? SETTING_A : SETTING_B;
    const prev = await readJson<StoredProvider>(ctx, key);
    const apiKey = (args.apiKey ?? prev?.apiKey ?? "").trim();
    if (apiKey.length < 10) throw new Error("مفتاح API قصير جداً (يجب أن يتجاوز 10 أحرف).");

    const baseUrl = (args.baseUrl ?? prev?.baseUrl ?? "").trim();
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      throw new Error("رابط المزوّد غير صالح — يجب أن يبدأ بـ http:// أو https://");
    }
    const presetId = args.presetId ?? (baseUrl ? detectPresetId(baseUrl) : (prev?.presetId ?? "generic"));

    await writeJson(ctx, key, {
      apiKey,
      baseUrl,
      presetId,
      kind: baseUrl ? "key_url" : "key_only",
      model: args.model === undefined ? (prev?.model ?? null) : args.model,
      enabled: args.enabled === undefined ? (prev?.enabled !== false) : args.enabled,
      updatedAt: Date.now(),
    });

    // تغيّر المزوّد ⇒ النماذج المُكتشَفة قديمة
    if ((prev?.baseUrl ?? "") !== baseUrl) {
      await writeJson(ctx, args.which === "A" ? "apiModelsA" : "apiModelsB", { models: [], at: 0 });
    }

    await ctx.db.insert("apiEvents", {
      apiId: null,
      provider: args.which,
      event: "provider_saved",
      detail: `حُفظ المزوّد ${args.which} (${presetId})${args.which === "B" ? " — مفتاح فقط" : ` — ${baseUrl}`}`,
      severity: "info",
      at: Date.now(),
    });

    return { ok: true, keyPreview: mask(apiKey), presetId, by: me.email ?? me.name ?? "المالك" };
  },
});

export const deleteProvider = mutation({
  args: { which: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const key = args.which === "A" ? SETTING_A : SETTING_B;
    const row = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (row) await ctx.db.delete(row._id);
    await writeJson(ctx, args.which === "A" ? "apiModelsA" : "apiModelsB", { models: [], at: 0 });
    await ctx.db.insert("apiEvents", {
      apiId: null,
      provider: args.which,
      event: "provider_deleted",
      detail: `حُذف المزوّد ${args.which} نهائياً — لا يوجد أثر للمفتاح`,
      severity: "warning",
      at: Date.now(),
    });
    return { ok: true };
  },
});

/** حفظ نماذج المزوّد التي اكتشفناها فعلاً من /models */
export const saveDiscoveredModels = mutation({
  args: { which: v.union(v.literal("A"), v.literal("B")), models: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    await writeJson(ctx, args.which === "A" ? "apiModelsA" : "apiModelsB", {
      models: args.models.slice(0, 60),
      at: Date.now(),
    });
    return { ok: true, count: args.models.length };
  },
});

/** ملاحظة التشغيل من متغيّرات البيئة (يكتبها الخادم عند تجاوز المركز لفقدانه مزوّداً) */
export const noteEnvBootstrap = internalMutation({
  args: { active: v.boolean(), presetId: v.string() },
  handler: async (ctx, args) => {
    await writeJson(ctx, "apiEnvBootstrap", { active: args.active, presetId: args.presetId, at: Date.now() });
  },
});

export const saveRoute = mutation({
  args: {
    task: v.string(),
    model: v.optional(v.union(v.string(), v.null())),
    temperature: v.optional(v.union(v.number(), v.null())),
    maxTokens: v.number(),
    needsJson: v.boolean(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    const def = getTaskDef(args.task);
    const maxTokens = Math.max(0, Math.min(8000, Math.floor(args.maxTokens)));
    const temperature =
      typeof args.temperature === "number"
        ? Math.max(0, Math.min(2, Math.round(args.temperature * 100) / 100))
        : null;
    const model = (args.model ?? "")?.trim() ? args.model : null;

    const existing = await ctx.db
      .query("apiRoutes")
      .withIndex("by_task", (q) => q.eq("task", def.key))
      .first();
    const row = {
      task: def.key,
      label: def.label,
      model,
      temperature,
      maxTokens,
      needsJson: args.needsJson,
      enabled: args.enabled,
      updatedBy: me.email ?? me.name ?? "المالك",
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("apiRoutes", row);
    return { ok: true };
  },
});

export const resetRoutes = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const rows = await ctx.db.query("apiRoutes").withIndex("by_task", (q) => q.gte("task", "")).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.insert("apiEvents", {
      apiId: null,
      provider: "center",
      event: "routes_reset",
      detail: `أُعيدت مصفوفة التوجيه للافتراضي (${rows.length} صف)`,
      severity: "info",
      at: Date.now(),
    });
    return { ok: true, cleared: rows.length };
  },
});

export const saveGuard = mutation({
  args: {
    enabled: v.boolean(),
    dailyCallCap: v.number(),
    dailyTokenCap: v.number(),
    perMinuteCap: v.number(),
    cacheEnabled: v.boolean(),
    circuitEnabled: v.boolean(),
    failureThreshold: v.number(),
    cooldownMs: v.number(),
    allowEnvBootstrap: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const guard: ApiGuardConfig = sanitizeGuard(args);
    const existing = await ctx.db.query("apiGuard").withIndex("by_id_key", (q) => q.eq("id", "main")).first();
    const row = { id: "main", ...guard, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("apiGuard", row);
    return { ok: true, guard };
  },
});

export const resetCircuit = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const existing = await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first();
    if (existing) await ctx.db.patch(existing._id, { failures: 0, open: false, openedAt: null });
    else await ctx.db.insert("apiCircuit", { id: "main", failures: 0, open: false, openedAt: null });
    return { ok: true };
  },
});

export const flushCache = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const rows = await ctx.db.query("apiReplyCache").withIndex("by_created", (q) => q.gte("createdAt", 0)).take(400);
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.insert("apiEvents", {
      apiId: null,
      provider: "center",
      event: "cache_flushed",
      detail: `أُفرغت ذاكرة الاستجابة (${rows.length} مدخل)`,
      severity: "info",
      at: Date.now(),
    });
    return { ok: true, cleared: rows.length };
  },
});

/** يحفظ نتيجة الاكتشاف الحقيقي (تستدعيه أفعال Node فقط) */
export const saveDiscovered = internalMutation({
  args: { which: v.union(v.literal("A"), v.literal("B")), models: v.array(v.string()) },
  handler: async (ctx, args) => {
    await writeJson(ctx, args.which === "A" ? "apiModelsA" : "apiModelsB", {
      models: args.models.slice(0, 60),
      at: Date.now(),
    });
    return { ok: true, count: args.models.length };
  },
});

export const clearUsage = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const usage = await ctx.db.query("apiUsageDaily").withIndex("by_day", (q) => q.gte("day", "")).collect();
    for (const r of usage) await ctx.db.delete(r._id);
    const events = await ctx.db.query("apiCallEvents").withIndex("by_created", (q) => q.gte("at", 0)).take(500);
    for (const r of events) await ctx.db.delete(r._id);
    return { ok: true, clearedUsage: usage.length, clearedEvents: events.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🩺 أدوات الإصلاح الذاتي — تستدعى من أفعال المركز (internal)
// ═══════════════════════════════════════════════════════════════════════

/** قراءة حالة القاطع داخلياً لاتخاذ قرار الإصلاح الذاتي */
export const readCircuitInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first();
  },
});

/** إعادة فتح القاطع داخلياً — الإصلاح الذاتي بعد فحص ناجح */
export const resetCircuitInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("apiCircuit").withIndex("by_main", (q) => q.eq("id", "main")).first();
    if (existing) await ctx.db.patch(existing._id, { failures: 0, open: false, openedAt: null });
    else await ctx.db.insert("apiCircuit", { id: "main", failures: 0, open: false, openedAt: null });
    return { ok: true };
  },
});

/** تقليم الردود المُخزّنة الأقدم من 24 ساعة — يعيد عدد المحذوف */
export const pruneOldCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("apiReplyCache")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(300);
    for (const r of old) await ctx.db.delete(r._id);
    return old.length;
  },
});
