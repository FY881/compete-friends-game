import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════
// جدول مجدوَل مصغَّر جذرياً — وضع الاستقرار الأقصى 🛡
//
// الهدف: عدم تجاوز حدود الخطة المجانية أبداً حتى لا يُعطَّل
// النشر (deployments disabled). لذلك أُلغيت كل المهام غير
// الأساسية نهائياً، وبقيت 6 مهام ضرورية فقط بفترات 12–24 ساعة.
//
// المهام الملغاة (كانت تستهلك الحصة الأكبر):
//   autoAdmin, crownDeck.measureDecision, apkSync, aiGuardian,
//   errorHunter (تشريح + تنبؤ), streakRiskSweep, autoTournament,
//   worldChampionship, aiGovernor, aiHub (bridge + prune),
//   aiAgents.lifeTick, livingMinds.lifeTick, highlights,
//   clanWars (matchmake + settle), geminiDoctor, geminiApex,
//   sovereignGovernor.sovereignCycle, smartNotifications
// ═══════════════════════════════════════════════════════════════

const crons = cronJobs();

// 🏆 تصفير النقاط الأسبوعية للدوريات
crons.interval(
  "leagues-weekly-rollover",
  { hours: 24 },
  internal.leagues.weeklyRollover,
  {},
);

// 👑 فتح الأقفال الطارئة المنتهية
crons.interval(
  "crown-expire-locks",
  { hours: 12 },
  internal.crownDeck.expireLocks,
  {},
);

// 🎯 اعتماد الأسئلة المجدولة من المالك
crons.interval(
  "question-scheduled-publish",
  { hours: 12 },
  internal.aiQuestions.publishScheduled,
  {},
);

// 🔄 إغلاق المواسم المنتهية وفتح الموسم التالي
crons.interval(
  "season-auto-rollover",
  { hours: 24 },
  internal.seasons.autoRollover,
  {},
);

// 👑 تاج العشائر الأسبوعي
crons.interval(
  "clan-weekly-crown",
  { hours: 24 },
  internal.clans.weeklyCrown,
  {},
);

// 🧹 الصيانة الذاتية — كل 24 ساعة: حذف السجلات القديمة (11 جدول)
crons.interval(
  "log-pruning",
  { hours: 24 },
  internal.maintenance.pruneAll,
  {},
);

export default crons;
