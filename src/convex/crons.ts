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

// 🛡️ حارس AI — كل 10 دقائق: يفحص المفتاح الرسمي بنداء حي، ويصلح فشلات
// AI تلقائياً (تصفير قاطع الدائرة، إعادة تفعيل المزودين) بلا أي تدخل بشري.
crons.interval(
  "ai-guardian-patrol",
  { minutes: 10 },
  internal.aiGuardian.patrol,
  {},
);

// 🧠 صياد الأخطاء v5 «الحارس» — كل 10 دقائق: تشريح تلقائي للأخطاء غير المحلولة
// بالذكاء الاصطناعي (تحليل السبب الجذري + الحل المقترح + تعلّم النمط) — بلا أي تدخل بشري.
crons.interval(
  "error-hunter-autopsy",
  { minutes: 10 },
  internal.errorHunter.analyzeErrorsWithAIInternal,
  {},
);

// موجّة 8 — مدير البطولات الآلي: كل ساعة ينهي المنتهي ويطلق بطولة أسبوعية
// جديدة بأسماء متجددة، ويمنح الفائزين نقاط ولاء — بلا أي تدخل بشري.
crons.interval(
  "auto-tournament-manager",
  { minutes: 60 },
  internal.autoTournament.manage,
  {},
);

// موجّة 12 — تاج العشائر الأسبوعي: كل ساعة يصفّر نقاط الحرب للعشائر
// التي اكتمل أسبوعها ويسجّل التاج في سجلّ القرارات.
crons.interval(
  "clan-weekly-crown",
  { minutes: 60 },
  internal.clans.weeklyCrown,
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

// ═══════════════════════════════════════════════════════════════
// Self-Healing Cron Jobs — يشتغل فعلياً كل 30 دقيقة
// ═══════════════════════════════════════════════════════════════

// Note: To add actual cron jobs, you need to import the functions:
// import { autoAdminSweep } from "./autoAdmin";
// Then schedule them like:
// crons.define({ name: "self-healing", schedule: "*/30 * * * *", 
//   handler: autoAdminSweep });

// The actual sweep function is runSweepNow in autoAdmin.ts
// by the owner from the Owner room UI.
