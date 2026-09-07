/**
 * الذكاء الاصطناعي الرئيسي — نائب المالك
 * المفتاح الرسمي الوحيد لتشغيل كل أنظمة الذكاء في اللعبة:
 *  - نائب الرئيس
 *  - جميع الأنظمة الآلية (موجّهة عبر API)
 *  - اتصالات الغرفة الداخلية
 *  - الاستشارات والتحليل الخارجي
 *
 * ⚠️ هذا المفتاح مسؤول عن تنفيذ كل شيء في اللعبة بالذكاء الاصطناعي،
 * لذا يجب التعامل معه بحذر: لا يُستخدم إلا في السياق الإداري والأنظمة
 * المُخوَّلة، ويُمرَّر فقط عبر مسارات آمنة (أctions Convex / owner UI).
 */
export const ADMIN_AI_KEY =
  "sk-J3x07DW6NCnFG2DBReSsHJVTJhlCgnwYy3DSkL8M68WlVPHn";

/** المفتاح الاحتياطي الثاني — مركز API يفعّله تلقائياً عند فشل الأول */
export const BACKUP_AI_KEY =
  "sk-apx3b03c6023a7bd97c1da347628421b1c39bf4475261ad88f";

export const ADMIN_AI_PROVIDER = "openrouter";

export const ADMIN_AI_MODEL = "deepseek/deepseek-v4-flash";

export const AI_CREDENTIALS_README =
  "هذا الملف خاص بالمفاتيح العامة والثابتة فقط. المفاتيح الحساسة تُدار من مشروعك في Keys/API keys ولا تُكتب هنا.";

