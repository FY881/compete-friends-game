import { query } from "./_generated/server";
import { getSettingsData } from "./owner";

/**
 * معلومات الإصدار المنشورة — محور «خطة تحديث التطبيق».
 *
 * عندما تريد إطلاق نسخة جديدة:
 * 1. ارفع CURRENT_VERSION هنا و APP_VERSION في `src/lib/app-version.ts` معاً.
 * 2. ارفع versionCode/versionName في `android/app/build.gradle`.
 * 3. أعد بناء الويب وبناء الـ APK (اسم الملف يحمل رقم الإصدار).
 *
 * ملاحظة مهمة حول رابط التحميل: لا يُبنى الرابط من `SITE_URL` (متغير الخادم)
 * لأنه يشير إلى نطاق Convex الذي لا يخدّم ملفات APK (كان ينتج «No matching
 * routes found»). الرابط يُبنى في المتصفح من نطاق الموقع نفسه
 * (`window.location.origin`) عبر `resolveApkUrl` في `src/lib/app-version.ts`،
 * ولتطبيق أندرويد الأصلي يُستخدم `siteUrl` القابل للضبط من غرفة المالك.
 */
const CURRENT_VERSION = "1.0.1";

const UPDATE_NOTES: string[] = [
  "إعادة بناء كاملة لتطبيق أندرويد من أحدث إصدار للموقع — كل تحسينات الويب (الذكاء الاصطناعي، غرفة المالك، التسجيل السريع بالاسم) أصبحت داخل التطبيق الآن.",
  "موقّع بالتوقيع الرسمي للعبة (v2+v3 بنفس المفتاح) — ثبّت النسخة الجديدة فوق القديمة مباشرة بدون حذف التطبيق.",
  "التنزيل موثّق بالبصمة الرقمية SHA-256: أي ملف لا يطابق النسخة الرسمية تماماً يُرفض قبل وصوله لهاتفك.",
  "إصلاح مشكلة «حدثت مشكلة عند تحليل الحزمة» نهائياً: الملف الذي يصلك من زر التنزيل هو نسخة APK حقيقية موقّعة، وليست صفحة خطأ أو ملف ZIP.",
];

export const getAppInfo = query({
  handler: async (ctx) => {
    // `siteUrl` = رابط الموقع الرسمي (يضبطه المالك من غرفة المالك).
    // فارغ افتراضياً → المتصفح يستخدم نطاقه الحالي تلقائياً.
    const settings = await getSettingsData(ctx);
    const apkFileName = `al-abqari-v${CURRENT_VERSION}.apk`;
    return {
      version: CURRENT_VERSION,
      notes: UPDATE_NOTES,
      apkFileName,
      // مسار نسبي — المتصفح يحلّه على نطاق الموقع نفسه. (كان يُبنى من
      // SITE_URL الذي يشير لنطاق Convex فينتج «No matching routes found».)
      apkUrl: `/downloads/${apkFileName}`,
      siteUrl: settings.siteUrl,
    };
  },
});
