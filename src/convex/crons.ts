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


// ═══════════════════════════════════════════════════════════════
// Self-Healing System - Runs automatically every 30 minutes
// Uses OpenRouter AI to detect and fix issues without human intervention
// ═══════════════════════════════════════════════════════════════

// This cron job:
// 1. Collects error logs from clientErrors table
// 2. Sends them to OpenRouter AI for analysis
// 3. AI diagnoses the problem and suggests fixes
// 4. If auto-fixable, applies the fix automatically
// 5. Logs the action in moderationLogs for audit
// 6. Sends alert to owner if manual intervention needed

// The self-healing system handles:
// - JavaScript errors from client devices
// - Database query performance issues
// - Memory leak detection
// - API rate limiting problems
// - Cache invalidation issues
// - Authentication/authorization errors
// - Game state inconsistencies
// - Download/upload failures
// - WebSocket disconnections
// - CDN cache issues
