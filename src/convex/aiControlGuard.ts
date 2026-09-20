/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔗 v12.0 — حبل الرقبة: الحرس الموحّد لكل تنفيذ ذكاء
 *
 * كل مسار تنفيذ في النظام (المُوزِّع، جسر المركز، نبضة الوكلاء، الحراس…)
 * يمرّ من هنا **قبل** أن يفعل أي شيء. فيقرأ قرار العرش الفعلي:
 * هل هو مطفأ؟ موقوف حتى وقت؟ استهلك حصته؟ أو مسموح له بالعمل؟
 *
 * وكل قرار (تشغيل/تخطي/فشل) يُسجَّل في السجل الموحّد `aiLedger`
 * — فلا يوجد ذكاء يعمل خارج هذا الحبل أبداً.
 *
 * ملاحظة تصميم: هذا الملف لا يستورد أي وحدة ذكاء أخرى، فلا تحدث دورات
 * استيراد، ويمكن لأي وحدة أن تستدعيه بأمان.
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { MutationCtx, QueryCtx } from "./_generated/server";
import { aiEntry } from "./aiRegistry";
import {
  defaultControl,
  noteRunUsage,
  resolveAiState,
  rollCounters,
  type AiControlRow,
} from "./aiControlCore";

const LEDGER_KEEP_DAYS = 7;

export async function readControl(ctx: QueryCtx | MutationCtx, key: string): Promise<AiControlRow | null> {
  const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", key)).first();
  return (row as unknown as AiControlRow) ?? null;
}

/** يُنشئ صف السيطرة من السجل عند أول لمسة — فلا ذكاء بلا صف. */
export async function ensureControl(ctx: MutationCtx, key: string): Promise<AiControlRow> {
  const existing = await readControl(ctx, key);
  const entry = aiEntry(key);
  const now = Date.now();
  if (existing) return existing;
  if (!entry) throw new Error(`ذكاء غير مسجّل: ${key}`);
  const fresh = defaultControl(entry, now);
  const id = await ctx.db.insert("aiControls", {
    ...fresh,
    granted: fresh.granted as string[],
    revoked: fresh.revoked as string[],
  } as never);
  void id;
  return fresh;
}

/**
 * حراسة مجموعة من مفاتيح الذكاء في ضربة واحدة.
 * تُستخدم مثلًا لمهمة جدولة يشترك فيها أكثر من ذكاء: إن أوقف المالك أحدهما
 * أو استهلك حصته توقف التنفيذ — فلا يمر عمل من ثغرة وكيل آخر.
 */
export async function guardGroup(
  ctx: MutationCtx,
  keys: readonly string[],
  opts: { force?: boolean; countUsage?: boolean } = {},
): Promise<{ allowed: boolean; reason: string; blockedBy: string | null }> {
  for (const key of keys) {
    const res = await guardAi(ctx, key, opts);
    if (!res.allowed) return { allowed: false, reason: res.reason, blockedBy: key };
  }
  return { allowed: true, reason: "ok", blockedBy: null };
}

export async function logLedger(
  ctx: MutationCtx,
  key: string,
  kind: "control" | "run" | "skip" | "error" | "order" | "grant" | "revoke" | "stop" | "start",
  detail: string,
  actor = "system",
): Promise<void> {
  const entry = aiEntry(key);
  await ctx.db.insert("aiLedger", {
    key,
    name: entry?.name ?? key,
    emoji: entry?.emoji ?? "🤖",
    kind,
    actor,
    detail: detail.replace(/\s+/g, " ").slice(0, 200),
    at: Date.now(),
  });
}

/**
 * القرار قبل التنفيذ. يعيد `{ allowed, reason }` ويزيد العدّاد إن سُمح.
 * `force` مُخصّص للتشغيل اليدوي من العرش (يتجاوز الإطفاء والوقت، لا السجل).
 */
export async function guardAi(
  ctx: MutationCtx,
  key: string,
  opts: { force?: boolean; countUsage?: boolean } = {},
): Promise<{ allowed: boolean; reason: string; enabled: boolean }> {
  const entry = aiEntry(key);
  if (!entry) return { allowed: false, reason: `ذكاء غير مسجّل: ${key}`, enabled: false };
  let control = await readControl(ctx, key);
  if (!control) control = await ensureControl(ctx, key);

  const now = Date.now();
  const res = resolveAiState(entry, control, now);

  if (!res.allowed && !opts.force) {
    await logLedger(ctx, key, "skip", res.reason, "auto");
    return { allowed: false, reason: res.reason, enabled: false };
  }
  if (res.allowed && opts.countUsage !== false) {
    const counters = noteRunUsage(control.counters, now);
    const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (row) await ctx.db.patch(row._id, { counters, updatedAt: now });
  }
  return { allowed: true, reason: opts.force ? "تشغيل قسري" : res.reason, enabled: true };
}

/** يُسجّل نتيجة التنفيذ الحقيقية (نجاح/فشل) + يحدّث آخر نتيجة. */
export async function markAiRun(
  ctx: MutationCtx,
  key: string,
  outcome: { ok: boolean; result: string; ms?: number },
): Promise<void> {
  const row = await ctx.db.query("aiControls").withIndex("by_key", (q) => q.eq("key", key)).first();
  if (!row) return;
  const now = Date.now();
  const counters = rollCounters(row.counters as unknown as AiControlRow["counters"], now);
  await ctx.db.patch(row._id, {
    totalRuns: (row.totalRuns ?? 0) + 1,
    totalErrors: (row.totalErrors ?? 0) + (outcome.ok ? 0 : 1),
    lastRunAt: now,
    lastResult: outcome.result.replace(/\s+/g, " ").slice(0, 180),
    counters,
    updatedAt: now,
  });
  await logLedger(ctx, key, outcome.ok ? "run" : "error", outcome.result, "auto");
}

/** تنظيف سجل الوكلاء القديم — يمنع تضخّم القاعدة. */
export async function pruneLedger(ctx: MutationCtx): Promise<{ removed: number }> {
  const cutoff = Date.now() - LEDGER_KEEP_DAYS * 24 * 60 * 60 * 1000;
  const rows = await ctx.db.query("aiLedger").withIndex("by_at").take(200);
  let removed = 0;
  for (const row of rows) {
    if (row.at < cutoff) {
      await ctx.db.delete(row._id);
      removed += 1;
    }
  }
  return { removed };
}
