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

export const ADMIN_AI_PROVIDER = "openrouter";
export const ADMIN_AI_MODEL = "deepseek/deepseek-v4-flash";
