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
const CURRENT_VERSION = "1.0.0";

const UPDATE_NOTES: string[] = [
  "إصلاح جذري لمشكلة «حدثت مشكلة عند تحليل الحزمة»: التنزيل الآن يتحقق من البصمة الرقمية SHA-256 وحجم الملف لكل بايت — أي ملف غير مطابق (صفحة خطأ أو تحميل مقطوع) يُرفض تلقائياً ولا يصل لهاتفك.",
  "تطبيق أندرويد أصلي كامل للعبة العبقري: غرف فورية، أسئلة من 230+ سؤال، ترتيب مباشر، مستويات وشارات.",
  "يتحدّث التطبيق تلقائياً: تظهر لافتة داخل اللعبة عند توفر نسخة جديدة.",
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
