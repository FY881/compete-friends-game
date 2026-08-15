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

export default crons;
