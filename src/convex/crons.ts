import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════
// 🛡 وضع الاستقرار الأقصى — مهمة واحدة فقط
//
// الهدف: نظام لا ينقطع أبداً. كل مهام الخلفية الأخرى أُلغيت
// نهائياً حتى لا تتجاوز حصة الخطة المجانية أبداً:
//   leagues rollover, crown locks, scheduled questions,
//   seasons rollover, clans crown — أصبحت تعمل عند الطلب فقط
//   (من غرفة المالك أو من تفاعل اللاعبين).
//
// المتبقي: نظام AI للصيانة الذاتية كل 24 ساعة — يحذف السجلات
// القديمة من كل الجداول الكبيرة للحفاظ على التخزين وسرعة
// الاستعلامات (internal.maintenance.pruneAll).
// ═══════════════════════════════════════════════════════════════

const crons = cronJobs();

crons.interval(
  "ai-self-maintenance-daily",
  { hours: 24 },
  internal.maintenance.pruneAll,
  {},
);

export default crons;
