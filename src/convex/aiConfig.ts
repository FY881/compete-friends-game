/**
 * AI Configuration — مركز الإعدادات الذكية
 * يوفر مفتاح API من أي مصدر (متغير بيئة، إعدادات المالك، أو مفتاح افتراضي).
 * جميع أنظمة AI تستخدم هذا الملف للحصول على المفتاح.
 */

// المفتاح الافتراضي الدائم — يعمل مع كل الأنظمة
const HARDCODED_KEY =
  "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";

/**
 * يحصل على مفتاح OpenRouter من أي مصدر متاح.
 * الأولوية: متغير البيئة > المفتاح المُمرّر > الافتراضي
 */
export function getOpenRouterKey(providedKey?: string | null): string {
  // 1. المفتاح المُمرّر من الواجهة (إذا كان هناك إعدادات مخصصة)
  if (providedKey && providedKey.trim().length > 10) {
    return providedKey.trim();
  }

  // 2. متغير البيئة (الذي يُضبط في المنصة)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim().length > 10) {
    return envKey.trim();
  }

  // 3. المفتاح الافتراضي الدائم
  return HARDCODED_KEY;
}

/**
 * النموذج الافتراضي — openrouter/free هو موزّع ذكي يختار تلقائياً
 * نموذجاً مجانياً متاحاً. جميع النماذج الفردية بـ :free انتهت.
 */
export const FREE_MODELS = [
  "openrouter/free",
];

/** النموذج الافتراضي لكل الاستدعاءات */
export const DEFAULT_MODEL = "openrouter/free";

/**
 * معلومات النظام للتشخيص
 */
export function getSystemInfo() {
  return {
    hasEnvKey: Boolean(process.env.OPENROUTER_API_KEY),
    envKeyPreview: process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_API_KEY.slice(0, 15) + "..."
      : "غير مضبوط",
    fallbackKeyPreview: HARDCODED_KEY.slice(0, 15) + "...",
    models: FREE_MODELS,
  };
}
