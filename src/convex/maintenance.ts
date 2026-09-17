import { internalMutation } from "./_generated/server";

/**
 * 🧹 نظام AI للصيانة الذاتية — يعمل كل 24 ساعة
 * يحذف السجلات القديمة والمتنامية من كل الجداول الكبيرة
 * للحفاظ على التخزين وسرعة الاستعلامات وتقليل استهلاك crons.
 *
 * مدة الاحتفاظ: 7 أيام للسجلات التشغيلية، 30 يوماً للأخطاء.
 * كل حذف يُقتطع بحد أقصى لكل جدول حتى لا تتجاوز الدورة حدود الخطة.
 */

const OPS_RETENTION_DAYS = 7; // سجلات تشغيلية (قرارات، أنشطة، بلاغات)
const ERR_RETENTION_DAYS = 30; // أخطاء العميل
const BATCH = 400; // سقف حذف لكل جدول في الدورة الواحدة

function cutoff(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/** يحذف دفعة واحدة من جدول بمؤشر زمني ويعيد عدد المحذوف */
async function pruneByIndex(
  ctx: any,
  table: string,
  index: string,
  field: string,
  before: number,
): Promise<number> {
  const docs = await ctx.db
    .query(table as never)
    .withIndex(index as never, (q: any) => q.lt(field, before))
    .take(BATCH);
  for (const d of docs) await ctx.db.delete(d._id);
  return docs.length;
}

export const pruneAll = internalMutation({
  handler: async (ctx) => {
    const opsBefore = cutoff(OPS_RETENTION_DAYS);
    const errBefore = cutoff(ERR_RETENTION_DAYS);
    const stats: Record<string, number> = {};

    // ── سجلات تشغيلية (أقدم من 7 أيام) ──
    stats.aiDecisionLog = await pruneByIndex(ctx, "aiDecisionLog", "by_created", "createdAt", opsBefore);
    stats.aiLogs = await pruneByIndex(ctx, "aiLogs", "by_timestamp", "timestamp", opsBefore);
    stats.moderationLogs = await pruneByIndex(ctx, "moderationLogs", "by_created", "createdAt", opsBefore);
    stats.auditLog = await pruneByIndex(ctx, "auditLog", "by_created", "at", opsBefore);
    stats.fairPlayLog = await pruneByIndex(ctx, "fairPlayLog", "by_at", "at", opsBefore);
    stats.mindHonorLog = await pruneByIndex(ctx, "mindHonorLog", "by_created", "createdAt", opsBefore);
    stats.membershipLogs = await pruneByIndex(ctx, "membershipLogs", "by_created", "at", opsBefore);
    stats.assistantLogs = await pruneByIndex(ctx, "assistantLogs", "by_created", "at", opsBefore);
    stats.apiCallLogs = await pruneByIndex(ctx, "apiCallLogs", "by_created", "createdAt", opsBefore);

    // ── أخطاء العميل (أقدم من 30 يوماً) ──
    stats.clientErrors = await pruneByIndex(ctx, "clientErrors", "by_last", "lastSeen", errBefore);
    stats.errorLogs = await pruneByIndex(ctx, "errorLogs", "by_created", "createdAt", errBefore);

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return { deleted: total, stats, opsBefore, errBefore };
  },
});

// حافظ على الدالة القديمة للتوافق
export const pruneOldLogs = pruneAll;
