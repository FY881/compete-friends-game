import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// «المدير الآلي» — يجري فحصاً شاملاً للموقع كل 15 دقيقة:
// يراجع البلاغات بالذكاء الاصطناعي، يطبّق العقوبات، ينظّف الغرف
// القديمة/العالقة، يرفع العقوبات على المخالفين المتكررين، ويكتب
// تقريراً جاهزاً بالإصلاحات في غرفة المالك. بلا أي تدخل بشري.
const crons = cronJobs();

crons.interval(
  "auto-admin-sweep",
  { minutes: 15 },
  internal.autoAdmin.runSweep,
  {},
);

// مزامنة ملف APK في تخزين Convex الدائم: يحمّل الملف من المرآة الموثّقة
// ويتحقق من الحجم والبصمة ثم يخزّنه — فيبقى التنزيل متاحاً ببايتات سليمة
// حتى لو تعطل خادم الملفات الثابت أو انتهت صلاحية المرآة المؤقتة.
crons.interval(
  "apk-release-sync",
  { minutes: 10 },
  internal.apkSync.syncApkFromSources,
  {},
);

export default crons;
