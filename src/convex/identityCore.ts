// ---------------------------------------------------------------------------
// 🪪 نواة الهوية — تطبيع الأسماء وقواعد التفرد (نقية ومُختبرة)
// كل اسم ظاهر في اللعبة (النخبة، الغرف، الأصدقاء) يجب أن يُميّز لاعباً واحداً.
// ---------------------------------------------------------------------------

/** الحد الأقصى والأدنى للاسم الظاهر */
export const NAME_MIN = 2;
export const NAME_MAX = 24;

/**
 * تطبيع الاسم: توحيد المسافات، إزالة محارف التحكم، تقليم الحواف.
 * التطابق بعد التطبيع = نفس الاسم (فلا يخدعنا اختلاف مسافة أو محرف خفي).
 */
export function normalizeDisplayName(raw: string): string {
  // eslint-disable-next-line no-control-regex -- إزالة محارف التحكم مقصودة
  return raw
    // إزالة محارف التحكم والصفر-العرض (انتحال أسماء)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
}

/** لماذا يُرفض الاسم؟ null يعني مقبولاً. */
export function nameRejection(
  raw: string,
  takenByOther: boolean,
): string | null {
  const clean = normalizeDisplayName(raw);
  if (clean.length < NAME_MIN) return "الاسم قصير جداً — حرفان على الأقل";
  if (clean.length < raw.trim().length && raw.trim().length > NAME_MAX) {
    return `الاسم طويل — ${NAME_MAX} حرفاً كحد أقصى`;
  }
  if (takenByOther) return "هذا الاسم محجوز للاعب آخر — اختر اسماً مميزاً";
  // أسماء نظامية محجوزة
  const reserved = ["admin", "owner", "مالك", "المالك", "الملك", "نظام", "النظام", "جيم", "gem"];
  if (reserved.some((r) => clean.toLowerCase() === r)) {
    return "هذا الاسم محجوز للنظام — اختر اسماً آخر";
  }
  return null;
}
