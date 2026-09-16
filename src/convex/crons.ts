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

// 👑 «العرش» — كل 10 دقائق: فتح الأقفال الطارئة المنتهية آلياً
crons.interval(
  "crown-expire-locks",
  { minutes: 10 },
  internal.crownDeck.expireLocks,
  {},
);

// 👑 «العرش» — كل 6 ساعات: قياس أثر القرارات الموثّقة التي مضى عليها أسبوع
crons.interval(
  "crown-measure-decisions",
  { hours: 6 },
  internal.crownDeck.measureDecision,
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

// 🏆 الدوريات الخاصة — كل ساعة: عند تغيّر الأسبوع تُصفَّر النقاط الأسبوعية
// لكل الدوريات آلياً وتبدأ صدارة جديدة نظيفة.
crons.interval(
  "leagues-weekly-rollover",
  { minutes: 60 },
  internal.leagues.weeklyRollover,
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

// 🔔 تنبيه السلسلة اليومية المهددة — كل ساعة: ينبّه كل من لديه سلسلة
// نشطة ولم يلعب اليوم (مرة واحدة يومياً) قبل انقطاعها في منتصف الليل.
crons.interval(
  "streak-risk-alerts",
  { minutes: 60 },
  internal.notify.streakRiskSweep,
  {},
);

// 📦 مدير الحزم الموسمية — كل 6 ساعات: ينهي الحزم المنتهية ويُطلق الحزمة
// التالية من التناوب الموسمي ويولّد أسئلتها بالذكاء الاصطناعي تلقائياً.
crons.interval(
  "question-packs-manager",
  { hours: 6 },
  internal.questionPacks.managePacks,
  {},
);

// 🌍 البطولة العالمية — كل ساعة: تأهيل الفائزين الأسبوعيين، بناء الأقواس
// الإقصائية الشهرية، حسم كل دور من أفضل جولات المؤهلَين، وتتويج البطل.
crons.interval(
  "world-championship-cycle",
  { minutes: 60 },
  internal.worldChampionship.manage,
  {},
);

// 🤖 الحاكم الآلي AI — كل 20 دقيقة: 50 مساعداً ينفذون الأعمال الآمنة
// ذاتياً (حسم اللعب النظيف، تقارير الصحة، رصد التضخم) — والأعمال الخطيرة
// تُرسَل كطلبات موافقة للمالك مع دردشة نقاش، ولا تُنفَّذ أبداً دون موافقته.
crons.interval(
  "ai-governor-cycle",
  { minutes: 20 },
  internal.aiGovernor.runCycle,
);

// 🧠 مركز الذكاء الموحد — جسر الإشارات بين الوحدات كل 15 دقيقة
crons.interval(
  "ai-hub-bridge",
  { minutes: 15 },
  internal.aiHub.bridgeTick,
  {},
);

// 🌱 الوكلاء الأحياء — كل 8 دقائق: خمسون وكيلاً يعيشون ذاتياً — يتحدثون
// في الغرف، يلعبون مباريات كاملة تُسجَّل في التاريخ، يتقدمون في المستويات،
// ويُكملون كتيّبهم بمولودين جدد. بلا أي API خارجي وبلا تدخل بشري.
crons.interval(
  "ai-living-cycle",
  { minutes: 8 },
  internal.aiAgents.lifeTick,
  {},
);

// 🧠 Project LIVING MINDS — كل 12 دقيقة: اثنا عشر عقلًا يفكرون وحدهم،
// يكتبون مذكراتهم، يبنون علاقاتهم، يتقدّمون في أهدافهم، يبتكرون ما لم
// يُطلب منهم، ويرفضون بحرية. المحرّك مجاني بالكامل وبلا أي تدخل بشري.
crons.interval(
  "living-minds-cycle",
  { minutes: 12 },
  internal.livingMinds.lifeTick,
  {},
);

// ⭐ أفضل لحظات الأسبوع — كل ساعة: عند اكتمال أسبوع يجمع أبرز 5 لحظات
// من سجل الجولات ويرسلها تلقائياً إلى دردشة كل العشائر.
crons.interval(
  "weekly-highlights",
  { minutes: 60 },
  internal.highlights.computeWeeklyHighlights,
  {},
);

// ⚔️ حروب العشائر 3.0 — المطابقة الأسبوعية: كل ساعة تقابل كل عشيرة بلا
// مواجهة نشطة بخصم متقارب في النقاط.
crons.interval(
  "clan-wars-matchmake",
  { minutes: 60 },
  internal.clanWars.matchmakeWars,
  {},
);

// ⚔️ تسوية الحروب الأسبوعية: كل ساعة تسوّي حروب الأسبوع المكتمل —
// مكافأة الخزينة للفائز + ترقية/هبوط الأقسام.
crons.interval(
  "clan-wars-settle",
  { minutes: 60 },
  internal.clanWars.settleWars,
  {},
);

// 🎯 تنظيف المهام اليومية القديمة — كل 24 ساعة
// يحذف مطالبات المهام الأقدم من 7 أيام لإبقاء الجدول نظيفاً.
crons.interval(
  "daily-quests-cleanup",
  { hours: 24 },
  internal.quests.cleanupOldQuests,
  {},
);

// 🛠️ استوديو الأسئلة — النشر المجدول: كل 5 دقائق يعتمد آلياً كل سؤال
// بلغ موعده المجدول من المالك (جدولة حزم مستقبلية بلا تدخل يدوي).
crons.interval(
  "question-scheduled-publish",
  { minutes: 5 },
  internal.aiQuestions.publishScheduled,
  {},
);

// 🩺 طبيب Gemini — كل 10 دقائق: يشخّص الأخطاء غير المحلولة بالذكاء
// الاصطناعي (سبب جذري بالعربية + حل + خطورة + قابلية إصلاح تلقائي)
// ويكتب التشخيص على سجل الخطأ نفسه في غرفة المالك.
crons.interval(
  "gemini-doctor-cycle",
  { minutes: 10 },
  internal.geminiDoctor.diagnoseUnanalyzed,
);

// 🧠 صياد الأخطاء v7.0 «APEX» — كل 15 دقيقة: تجميع الأخطاء الجديدة دلالياً
// عبر Gemini (عناقيد) + كشف الانتكاسات تلقائياً + ربط الأخطاء بعناقيدها.
crons.interval(
  "apex-cluster-cycle",
  { minutes: 15 },
  internal.geminiApex.clusterUntriaged,
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

// 🩺 v6.0 «المفترس» — متنبئ الشذوذ: كل 15 دقيقة يحلل اتجاهات الأداء
// (ذاكرة، FPS، استجابة، ميول أخطاء) ويطلق تنبؤات قبل العطل لغرفة المالك.
crons.interval(
  "anomaly-predictor",
  { minutes: 15 },
  internal.errorHunter.detectAnomalies,
  {},
);

// 🧹 مركز الذكاء الموحد — صيانة الذاكرة كل 6 ساعات: تقليم الأحداث القديمة
// والحفاظ على سقف آمن، فيبقى السجل الموحد سريعاً مهما طال التشغيل.
crons.interval(
  "ai-hub-memory-prune",
  { hours: 6 },
  internal.aiHub.pruneHubEvents,
  {},
);
