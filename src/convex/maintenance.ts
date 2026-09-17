import { internalMutation } from "./_generated/server";

/**
 * 🧹 الصيانة الدورية — تنظيف السجلات القديمة
 * يحذف السجلات الأقدم من 30 يوماً من الجداول الضخمة المتنامية
 * لتقليل التخزين والحفاظ على سرعة الاستعلامات.
 */

const RETENTION_DAYS = 30;
const BATCH = 500;

function cutoff(): number {
  return Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export const pruneOldLogs = internalMutation({
  handler: async (ctx) => {
    const before = cutoff();
    let total = 0;

    // سجل قرارات الذكاء
    const dec = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.lt("createdAt", before))
      .take(BATCH);
    for (const d of dec) {
      await ctx.db.delete(d._id);
      total++;
    }

    // سجلات النشاط والأنظمة
    const logs = await ctx.db
      .query("aiLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", before))
      .take(BATCH);
    for (const l of logs) {
      await ctx.db.delete(l._id);
      total++;
    }

    // أخطاء العميل القديمة غير المحدّثة
    const ce = await ctx.db
      .query("clientErrors")
      .withIndex("by_last", (q) => q.lt("lastSeen", before))
      .take(BATCH);
    for (const e of ce) {
      await ctx.db.delete(e._id);
      total++;
    }

    return { deleted: total, before };
  },
});
