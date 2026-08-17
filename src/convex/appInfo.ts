import { query } from "./_generated/server";
import { getSettingsData } from "./owner";
import {
  APK_BYTES,
  APK_FILE_NAME,
  APK_SHA256,
  BUILD_ID,
  CURRENT_VERSION,
  UPDATE_NOTES,
} from "./apkRelease";

/**
 * معلومات الإصدار المنشورة — محور «خطة تحديث التطبيق».
 *
 * عندما تريد إطلاق نسخة جديدة:
 * 1. ارفع CURRENT_VERSION/APK_FILE_NAME/APK_SHA256/APK_BYTES في
 *    `src/convex/apkRelease.ts` (مصدر الحقيقة الوحيد) و APP_VERSION في
 *    `src/lib/app-version.ts` معاً.
 * 2. ارفع versionCode/versionName في `android/app/build.gradle`.
 * 3. أعد بناء الويب وبناء الـ APK (اسم الملف يحمل رقم الإصدار).
 *
 * ملاحظة مهمة حول رابط التحميل: لا يُبنى الرابط من `SITE_URL` (متغير الخادم)
 * لأنه يشير إلى نطاق Convex الذي لا يخدّم ملفات APK (كان ينتج «No matching
 * routes found»). الرابط يُبنى في المتصفح من نطاق الموقع نفسه
 * (`window.location.origin`) عبر `resolveApkUrl` في `src/lib/app-version.ts`،
 * ولتطبيق أندرويد الأصلي يُستخدم `siteUrl` القابل للضبط من غرفة المالك.
 *
 * البصمة والحجم يُرسلان للعميل أيضاً — فيتحقق زر التنزيل من الملف الفعلي
 * مقابل قيم الخادم (وليس فقط الثوابت المبنية داخل الكود)، فتظل القيم
 * متزامنة دائماً حتى بعد تحديث الملف.
 */
export const getAppInfo = query({
  handler: async (ctx) => {
    // `siteUrl` = رابط الموقع الرسمي (يضبطه المالك من غرفة المالك).
    // فارغ افتراضياً → المتصفح يستخدم نطاقه الحالي تلقائياً.
    const settings = await getSettingsData(ctx);
    return {
      version: CURRENT_VERSION,
      buildId: BUILD_ID,
      notes: UPDATE_NOTES,
      apkFileName: APK_FILE_NAME,
      // مسار نسبي — المتصفح يحلّه على نطاق الموقع نفسه. (كان يُبنى من
      // SITE_URL الذي يشير لنطاق Convex فينتج «No matching routes found».)
      apkUrl: `/downloads/${APK_FILE_NAME}`,
      apkSha256: APK_SHA256,
      apkBytes: APK_BYTES,
      siteUrl: settings.siteUrl,
    };
  },
});
