import { query } from "./_generated/server";

/**
 * معلومات الإصدار المنشورة — محور «خطة تحديث التطبيق».
 *
 * عندما تريد إطلاق نسخة جديدة:
 * 1. ارفع CURRENT_VERSION هنا و APP_VERSION في `src/lib/app-version.ts` معاً.
 * 2. ارفع versionCode/versionName في `android/app/build.gradle`.
 * 3. أعد بناء الويب وبناء الـ APK (اسم الملف يحمل رقم الإصدار).
 *
 * كل النسخ القديمة المثبّتة تقرأ هذه الدالة، تقارن رقمها، وتظهر
 * لافتة «تحديث متاح» مع ملاحظات الإصدار الجديد ورابط التحميل.
 */
const CURRENT_VERSION = "1.0.0";

const UPDATE_NOTES: string[] = [
  "إصدار أندرويد الأول — تطبيق أصلي كامل للعبة العبقري.",
  "العب مباشرة من التطبيق: غرف فورية، أسئلة من 230+ سؤال، ترتيب مباشر، مستويات وشارات.",
  "يتحدّث التطبيق تلقائياً: تظهر لافتة داخل اللعبة عند توفر نسخة جديدة.",
];

export const getAppInfo = query({
  handler: async (ctx) => {
    // رابط التحميل المطلق يُبنى من SITE_URL (متغير بيئة Convex) إن وُجد،
    // وإلا يرجع العميل لرابط نسبي على موقعه الحالي.
    const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
    return {
      version: CURRENT_VERSION,
      notes: UPDATE_NOTES,
      apkFileName: `al-abqari-v${CURRENT_VERSION}.apk`,
      apkUrl: siteUrl
        ? `${siteUrl}/downloads/al-abqari-v${CURRENT_VERSION}.apk`
        : `/downloads/al-abqari-v${CURRENT_VERSION}.apk`,
    };
  },
});
