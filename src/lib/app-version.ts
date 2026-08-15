/**
 * الإصدار الحالي المثبّت في هذه النسخة من التطبيق.
 *
 * نظام التحديث يعمل هكذا:
 * - هذا الثابت = الإصدار الذي بُنيت به هذه النسخة (مثبّت داخل الكود).
 * - `src/convex/appInfo.ts` فيه `CURRENT_VERSION` = أحدث إصدار منشور على الخادم.
 * - العميل يقارن الاثنين؛ إذا كان إصدار الخادم أحدث تظهر لافتة «تحديث متاح».
 *
 * عند إصدار نسخة جديدة:
 * 1. ارفع الرقم هنا وفي `src/convex/appInfo.ts` معاً.
 * 2. ارفع `versionCode`/`versionName` في `android/app/build.gradle`
 *    (versionCode يزيد برقم، versionName = نفس رقم سيمانتك).
 * 3. أعد البناء → يظهر ملف APK جديد في صفحة التحميل تلقائياً
 *    (اسم الملف يحتوي رقم الإصدار).
 */
export const APP_VERSION = "1.0.0";

export const APP_VERSION_LABEL = `العبقري ${APP_VERSION}`;

/** تحليل رقم سيمانتك «x.y.z» إلى أرقام للمقارنة. */
export function parseVersion(v: string): number[] {
  return v
    .trim()
    .split(".")
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

/** هل إصدار `candidate` أحدث من `base`؟ (مقارنة سيمانتك آمنة) */
export function isNewerVersion(candidate: string | undefined | null, base: string): boolean {
  if (!candidate) return false;
  if (candidate === base) return false;
  const a = parseVersion(candidate);
  const b = parseVersion(base);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
