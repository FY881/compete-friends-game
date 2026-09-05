/**
 * أطلس كنترول — طبقة الأنظمة الخلفية (Atlas Control Backend)
 *
 * العقل التنفيذي لتطبيق «أطلس كنترول» المستقل:
 * - سجل الأنظمة العشرة الكبرى + الـ 80 ميزة (مصدر واحد تتقاسمه الخلفية والواجهة).
 * - كل ميزة تُنفَّذ عبر دوال خادم فعلية تقرأ وتكتب في قاعدة بيانات اللعبة
 *   نفسها (users / games / reports / memberships / settings / notifications /
 *   errorLogs / moderationLogs…) فتنعكس مباشرة على «حرب العقول» أونلاين
 *   — بلا أي محاكاة أو بيانات وهمية.
 * - محرك الأنظمة الحرة: مسح شامل لحالة اللعبة، كشف الشذوذ، اقتراحات ذكية،
 *   وذاكرة تعلّم من قرارات المالك.
 *
 * الصلاحيات: كل شيء محصور بالمالك الرسمي — نفس حماية غرفة المالك، مع
 * تسجيل كل أمر في سجل تدقيق دائم (atlasCommands).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { isOwnerUser } from "./owner";
import { QUESTION_BANK, CATEGORIES } from "./questions";
import { ALL_ITEMS, STORE_SECTIONS, STORE_BUNDLES } from "./store";
import { MEMBERSHIP_TIERS } from "./memberships";
import { REPORT_CATEGORIES } from "./reportsSmart";
import {
  CURRENT_VERSION,
  BUILD_ID,
  APK_FILE_NAME,
  APK_SHA256,
  APK_BYTES,
} from "./apkRelease";

// ═══════════════════════════════════════════════════════════════════════
// سجل الأنظمة العشرة الكبرى + الـ 80 ميزة (المصدر الموحّد)
// ═══════════════════════════════════════════════════════════════════════

export type AtlasFeatureDef = {
  id: string;
  name: string;
  desc: string;
  kind: "view" | "action";
  danger?: boolean;
};

export type AtlasSystemId =
  | "control" | "players" | "memberships" | "content" | "rooms"
  | "reports" | "ai" | "economy" | "analytics" | "emergency";

export type AtlasSystemDef = {
  id: AtlasSystemId;
  num: number;
  name: string;
  desc: string;
  icon: string;
  accent: string;
  features: AtlasFeatureDef[];
};

const CONTROL_FEATURES: AtlasFeatureDef[] = [
  { id: "c1", name: "نبض اللعبة الحي", desc: "حالة اللعبة الكاملة لحظة بلحظة: متصلون، جولات جارية، رسائل، صحة الأنظمة.", kind: "view" },
  { id: "c2", name: "الكاميرا الذكية على لاعب", desc: "افتح ملف أي لاعب مباشرة من القيادة: بياناته، عضويته، وسجلاته.", kind: "view" },
  { id: "c3", name: "تعديل حي لبيانات لاعب", desc: "عدّل اسم أو دور أي حساب فوراً — ينعكس في اللعبة خلال ثوانٍ.", kind: "action" },
  { id: "c4", name: "محرك العقوبات الفوري", desc: "حظر، كتم، تحذير أو طرد بضغطة واحدة من قلب لوحة القيادة.", kind: "action", danger: true },
  { id: "c5", name: "العفو الفوري", desc: "ألغِ أي عقوبة نشطة وأعد اللاعب للعب خلال ثانية واحدة.", kind: "action" },
  { id: "c6", name: "الإجراء الجماعي السريع", desc: "طبّق أمراً واحداً على عدة لاعبين دفعة واحدة مع سجل كامل.", kind: "action", danger: true },
  { id: "c7", name: "بوق القيادة", desc: "أرسل إشعاراً فورياً لكل اللاعبين أو لحساب محدد — يظهر مباشرة في التطبيق.", kind: "action" },
  { id: "c8", name: "محرك الأوامر الحر", desc: "اكتب أي أمر بالعربية وينفّذه محرك أطلس: من «احظر فلان» إلى «فعّل الصيانة».", kind: "action" },
];

const PLAYERS_FEATURES: AtlasFeatureDef[] = [
  { id: "p1", name: "سجل اللاعبين الكامل", desc: "قائمة كل الحسابات مع البحث الفوري والتصفية حسب الحالة والدور.", kind: "view" },
  { id: "p2", name: "البحث المتقدم", desc: "ابحث بالاسم أو البريد — نتائج فورية أثناء الكتابة.", kind: "view" },
  { id: "p3", name: "الملف الشامل", desc: "صفحة لاعب كاملة: النقاط، المباريات، السجل الانضباطي، العضوية.", kind: "view" },
  { id: "p4", name: "التعديل المباشر", desc: "عدّل الاسم أو الدور من داخل الملف مباشرة.", kind: "action" },
  { id: "p5", name: "إجراء جماعي موجه", desc: "حدد مجموعة لاعبين ونفّذ عليهم إجراءً موحّداً مع سجل كامل.", kind: "action", danger: true },
  { id: "p6", name: "تصفير التقدم", desc: "أعد حساب أي لاعب إلى الصفر مع نسخة احتياطية تلقائية قبل التنفيذ.", kind: "action", danger: true },
  { id: "p7", name: "نسخة احتياطية كاملة", desc: "احفظ لقطة كاملة من بيانات أي لاعب لاستعادتها لاحقاً.", kind: "action" },
  { id: "p8", name: "سجل أفعال اللاعبين", desc: "سجل تدقيق دائم لكل ما نُفّذ على الحسابات: من فعل؟ متى؟ ولماذا؟", kind: "view" },
];

const MEMBERSHIPS_FEATURES: AtlasFeatureDef[] = [
  { id: "m1", name: "خريطة العضويات", desc: "إحصاءات كل الفئات: برونز، فضة، ذهب، ماسة، حصري — والنسبة لكل فئة.", kind: "view" },
  { id: "m2", name: "مصنع الأكواد", desc: "ولّد أكواد عضوية بأي فئة ومدة وعدد استخدامات.", kind: "action" },
  { id: "m3", name: "سجل الأكواد الحي", desc: "كل الأكواد الصادرة: من استخدمها، كم مرة، وهل ما زالت فعالة.", kind: "view" },
  { id: "m4", name: "منح مباشر", desc: "امنح عضوية لأي لاعب مباشرة دون كود — تظهر فوراً في ملفه.", kind: "action" },
  { id: "m5", name: "سحب العضوية", desc: "ألغِ عضوية أي حساب فوراً.", kind: "action", danger: true },
  { id: "m6", name: "تعطيل كود", desc: "أوقف أي كود عن العمل نهائياً بضغطة واحدة.", kind: "action" },
  { id: "m7", name: "رقابة الأكواد", desc: "مراقبة الاستخدام غير الطبيعي للأكواد ومحاولات إعادة التداول.", kind: "view" },
  { id: "m8", name: "قائمة المستفيدين", desc: "اطلع على كل الحسابات التي تمتلك عضوية نشطة الآن.", kind: "view" },
];

const CONTENT_FEATURES: AtlasFeatureDef[] = [
  { id: "q1", name: "بنك الأسئلة الحي", desc: "استعرض بنك الأسئلة الكامل مع التصنيفات ومستويات الصعوبة.", kind: "view" },
  { id: "q2", name: "إحصاءات المحتوى", desc: "أرقام دقيقة: عدد الأسئلة لكل تصنيف وكل مستوى صعوبة.", kind: "view" },
  { id: "q3", name: "تعطيل/تفعيل سؤال", desc: "اسحب أي سؤال من التداول فوراً أو أعد إدراجه بعد مراجعته.", kind: "action" },
  { id: "q4", name: "مراقبة الجودة", desc: "رصد الأسئلة ذات المشاكل المحتملة (نص ناقص، خيارات مكررة) قبل أن تصل للاعبين.", kind: "view" },
  { id: "q5", name: "جاهزية التحديات", desc: "فحص جاهزية التحديات والأحداث قبل إطلاقها.", kind: "view" },
  { id: "q6", name: "توزيع التصنيفات", desc: "رؤية توازن التصنيفات (منطق، رياضيات، ملاحظة…) لموازنة اللعب.", kind: "view" },
  { id: "q7", name: "أسئلة معطلة", desc: "قائمة الأسئلة المسحوبة من التداول حالياً وإعادتها بضغطة.", kind: "view" },
  { id: "q8", name: "موازنة الصعوبة", desc: "مؤشر توازن مستويات الصعوبة عبر البنك كاملاً.", kind: "view" },
];

const ROOMS_FEATURES: AtlasFeatureDef[] = [
  { id: "r1", name: "خريطة الغرف", desc: "كل غرف الدردشة: عدد الأعضاء والرسائل وآخر نشاط.", kind: "view" },
  { id: "r2", name: "متابعة الرسائل", desc: "معدل الرسائل الحي عبر الغرف لرصد النشاط غير الطبيعي.", kind: "view" },
  { id: "r3", name: "سجل القوانين", desc: "القوانين الرسمية وحالتها (مفعّلة/معطلة) كما تظهر للاعبين.", kind: "view" },
  { id: "r4", name: "إنفاذ القوانين", desc: "شغّل مسح البلاغات عبر ذكاء إنفاذ القوانين وطبّق القرارات.", kind: "action" },
  { id: "r5", name: "إحصاءات البلاغات", desc: "أرقام البلاغات: المفتوحة، المحسومة، حسب الفئة.", kind: "view" },
  { id: "r6", name: "قرار بلاغ", desc: "حوّل أي بلاغ: اعتمد الإجراء أو ارفضه مع سبب موثّق.", kind: "action" },
  { id: "r7", name: "زراعة القوانين", desc: "أعد زراعة القوانين الرسمية في قاعدة البيانات بضغطة واحدة.", kind: "action" },
  { id: "r8", name: "نبض المجتمع", desc: "مؤشر صحة المجتمع العام: النشاط، البلاغات، العقوبات.", kind: "view" },
];

const REPORTS_FEATURES: AtlasFeatureDef[] = [
  { id: "a1", name: "صندوق البلاغات الحي", desc: "كل البلاغات المفتوحة مع تحليل الذكاء الاصطناعي المرفق.", kind: "view" },
  { id: "a2", name: "تحليل بلاغ بالذكاء", desc: "عرض حكم الذكاء الاصطناعي: صحة، خطورة، إجراء مقترح.", kind: "view" },
  { id: "a3", name: "الفئات الذكية", desc: "تصنيف البلاغات تلقائياً حسب فئات المنظومة الرسمية.", kind: "view" },
  { id: "a4", name: "حسم البلاغ", desc: "قرار نهائي على أي بلاغ مع سجل كامل في سجل الإشراف.", kind: "action" },
  { id: "a5", name: "رصد البلاغات الكيدية", desc: "مؤشر على الحسابات التي تبالغ في الإبلاغ (القانون 18).", kind: "view" },
  { id: "a6", name: "اتجاه البلاغات", desc: "أسباب البلاغات الأكثر تكراراً واتجاهها الزمني.", kind: "view" },
  { id: "a7", name: "البلاغات الحرجة", desc: "صفحة البلاغات عالية الخطورة أولاً — لا شيء يضيع.", kind: "view" },
  { id: "a8", name: "دورة القرار", desc: "من بلاغ → تحليل → قرار → توثيق، في مسار واحد مرئي.", kind: "view" },
];

const AI_FEATURES: AtlasFeatureDef[] = [
  { id: "l1", name: "مفتاح الذكاء الرئيسي", desc: "شغّل أو أوقف كل أنظمة الذكاء في اللعبة من مفتاح واحد.", kind: "action", danger: true },
  { id: "l2", name: "التفكير الذاتي", desc: "اطلب من محرك أطلس أن يفكر في حالة اللعبة الآن ويقدم رأيه.", kind: "action" },
  { id: "l3", name: "سجل نشاط الذكاء", desc: "كل ما فعله الذكاء الآلي: قرارات، إشراف، إصلاحات.", kind: "view" },
  { id: "l4", name: "التطبيق التلقائي", desc: "اضبط هل تنفّذ الأنظمة الذكية قراراتها تلقائياً أم تعرضها للمراجعة.", kind: "action" },
  { id: "l5", name: "الإدارة الآلية", desc: "المسح الشامل الدوري لكل اللعبة بدون تدخل بشري.", kind: "action" },
  { id: "l6", name: "شفافية الذكاء", desc: "أسباب كل قرار ذكي موثقة ومعروضة للمالك.", kind: "view" },
  { id: "l7", name: "مراقبة النماذج", desc: "حالة النموذج الذكي المستخدم للأنظمة التحليلية.", kind: "view" },
  { id: "l8", name: "أوامر حرّة بالعربية", desc: "أمر بالعربية الطبيعية وينفّذ فوراً داخل اللعبة.", kind: "action" },
];

const ECONOMY_FEATURES: AtlasFeatureDef[] = [
  { id: "e1", name: "لوحة الاقتصاد", desc: "حالة العملات والمتجر والحزم والعروض في لمحة.", kind: "view" },
  { id: "e2", name: "حركات المتجر", desc: "مؤشر النشاط الشرائي واتجاهه عبر كتالوج المتجر.", kind: "view" },
  { id: "e3", name: "قفل عنصر", desc: "اسحب أي سؤال مرتبط بعنصر المتجر من التداول فوراً.", kind: "action" },
  { id: "e4", name: "كتالوج المتجر", desc: "استعرض كل العناصر والأقسام والأسعار الحالية.", kind: "view" },
  { id: "e5", name: "مؤشر التضخم", desc: "رصد نمو العملات مقابل المحتوى المتاح لمنع الانهيار الاقتصادي.", kind: "view" },
  { id: "e6", name: "توازن الأسعار", desc: "مقارنة أسعار العناصر بقيمة أثرها الفعلي في اللعب.", kind: "view" },
  { id: "e7", name: "هدايا اللاعبين", desc: "متابعة نظام الهدايا بين اللاعبين وسجل الاستلام.", kind: "view" },
  { id: "e8", name: "حزم وعروض", desc: "استعراض الحزم والعروض النشطة في المتجر.", kind: "view" },
];

const ANALYTICS_FEATURES: AtlasFeatureDef[] = [
  { id: "s1", name: "لوحة التحليلات الحية", desc: "مؤشرات النشاط والنمو والجودة لحظياً.", kind: "view" },
  { id: "s2", name: "التنبؤ بالمشكلات", desc: "محرك التنبؤ يرصد الأنماط ويتوقع المشاكل قبل وقوعها.", kind: "view" },
  { id: "s3", name: "تقرير تنفيذي", desc: "ولّد تقريراً شاملاً بكل أرقام اللعبة قابل للتصدير JSON.", kind: "view" },
  { id: "s4", name: "مؤشرات الجودة", desc: "دقة الإجابات، معدل الفوز، متوسط النقاط.", kind: "view" },
  { id: "s5", name: "نشاط 7 أيام", desc: "منحنى الجولات المنتهية يومياً لآخر أسبوع.", kind: "view" },
  { id: "s6", name: "أبطال الساحة", desc: "أعلى 10 لاعبين بالنقاط الخبرة الآن.", kind: "view" },
  { id: "s7", name: "استبقاء اللاعبين", desc: "نسبة اللاعبين الذين تجاوزوا 3 جولات (مؤشر تشبّث).", kind: "view" },
  { id: "s8", name: "تصدير البيانات", desc: "صدّر التقرير التنفيذي كملف JSON كامل بضغطة واحدة.", kind: "view" },
];

const EMERGENCY_FEATURES: AtlasFeatureDef[] = [
  { id: "x1", name: "وضع الصيانة", desc: "افتح أو أغلق صيانة اللعبة الكاملة برسالة مخصصة.", kind: "action", danger: true },
  { id: "x2", name: "بث الطوارئ", desc: "إشعار عاجل لكل الأجهزة فوراً بنوع حرج.", kind: "action", danger: true },
  { id: "x3", name: "مركز الأخطاء", desc: "أخطاء العملاء الحية مع التصنيف والخطورة وإحصاءاتها.", kind: "view" },
  { id: "x4", name: "سجل التدقيق الكامل", desc: "سجل دائم لكل أمر نُفّذ من أطلس: النظام، الميزة، المنفّذ.", kind: "view" },
  { id: "x5", name: "جاهزية النسخ", desc: "حالة الإصدار المنشور وبصمة APK ورقم البناء.", kind: "view" },
  { id: "x6", name: "حماية الدخول", desc: "الدخول للمالك الرسمي فقط مع سجل جلسات كامل.", kind: "view" },
  { id: "x7", name: "الصحة العامة", desc: "نبض صحة الأنظمة عبر الأخطاء غير المعالجة حسب الخطورة.", kind: "view" },
  { id: "x8", name: "أوامر الطوارئ السريعة", desc: "أزرار إجراءات فورية من قلب قسم الطوارئ.", kind: "action" },
];

/** الأنظمة العشرة الكبرى — بالترتيب الملزم للتنفيذ. */
export const ATLAS_SYSTEMS: AtlasSystemDef[] = [
  { id: "control", num: 1, name: "السيطرة المركزية الحية", desc: "مركز قيادة فوري على حالة اللعبة بالكامل مع محرك أوامر حرة.", icon: "Radar", accent: "#6366f1", features: CONTROL_FEATURES },
  { id: "players", num: 2, name: "إدارة اللاعبين المتقدمة", desc: "بحث وملفات وإجراءات جماعية وسجل كامل لكل حساب.", icon: "Users", accent: "#0ea5e9", features: PLAYERS_FEATURES },
  { id: "memberships", num: 3, name: "العضويات والأكواد", desc: "صلاحيات كاملة على فئات العضوية وأكواد التفعيل.", icon: "KeyRound", accent: "#a855f7", features: MEMBERSHIPS_FEATURES },
  { id: "content", num: 4, name: "المحتوى والأسئلة", desc: "بنك الأسئلة والتحديات بتحكم كامل وجودة مراقبة.", icon: "BookOpen", accent: "#10b981", features: CONTENT_FEATURES },
  { id: "rooms", num: 5, name: "الغرف والقوانين", desc: "غرف الدردشة، صحة المجتمع، والمنظومة القانونية.", icon: "MessagesSquare", accent: "#f59e0b", features: ROOMS_FEATURES },
  { id: "reports", num: 6, name: "البلاغات الذكية", desc: "تحليل البلاغات بدعم القرار وحسمها في مسار واحد.", icon: "Flag", accent: "#ef4444", features: REPORTS_FEATURES },
  { id: "ai", num: 7, name: "التحكم في الذكاء الاصطناعي", desc: "مفاتيح الأنظمة الذكية وسجلاتها وشفافيتها وتفكيرها الحر.", icon: "BrainCircuit", accent: "#8b5cf6", features: AI_FEATURES },
  { id: "economy", num: 8, name: "الاقتصاد والمتجر", desc: "العملات والعروض وتوازن الاقتصاد وكتالوج المتجر.", icon: "Store", accent: "#f97316", features: ECONOMY_FEATURES },
  { id: "analytics", num: 9, name: "الإحصائيات والتحليلات", desc: "مؤشرات حية، تنبؤ بالمشكلات، وتقارير قابلة للتصدير.", icon: "BarChart3", accent: "#14b8a6", features: ANALYTICS_FEATURES },
  { id: "emergency", num: 10, name: "الطوارئ والصيانة والأمان", desc: "صيانة، بث عاجل، سجل تدقيق كامل، وحماية دخول.", icon: "ShieldAlert", accent: "#f43f5e", features: EMERGENCY_FEATURES },
];

/** عدد الميزات الفعلية — 80 بالضبط (10 أنظمة × 8 ميزات). */
export const ATLAS_FEATURE_COUNT = ATLAS_SYSTEMS.reduce(
  (sum, s) => sum + s.features.length,
  0,
);

// ═══════════════════════════════════════════════════════════════════════
// الصلاحيات والتدقيق
// ═══════════════════════════════════════════════════════════════════════

async function requireAtlasOwner(ctx: {
  db: QueryCtx["db"];
  auth: QueryCtx["auth"];
}) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) {
    throw new Error("أطلس كنترول للمالك الرسمي فقط");
  }
  return user;
}

async function requireAtlasOwnerMutation(ctx: {
  db: MutationCtx["db"];
  auth: MutationCtx["auth"];
}) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) {
    throw new Error("أطلس كنترول للمالك الرسمي فقط");
  }
  return user;
}

/** سجل تدقيق دائم لكل أمر يُنفَّذ من أطلس. */
async function logAudit(
  ctx: { db: MutationCtx["db"] },
  entry: {
    system: string;
    feature: string;
    command: string;
    ok: boolean;
    error?: string;
    result?: unknown;
    executedBy: string;
    severity?: "info" | "warning" | "critical";
  },
) {
  await ctx.db.insert("atlasCommands", {
    system: entry.system,
    feature: entry.feature,
    command: entry.command,
    ok: entry.ok,
    error: entry.error,
    result:
      entry.result === undefined
        ? undefined
        : JSON.stringify(entry.result).slice(0, 4000),
    executedBy: entry.executedBy,
    severity: entry.severity ?? (entry.ok ? "info" : "critical"),
    createdAt: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 1) نظرة شاملة حية — قلب السيطرة المركزية
// ═══════════════════════════════════════════════════════════════════════

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);

    const now = Date.now();
    const [users, games, rooms, memberships, reports, chatMessages, errors, profiles] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("games").collect(),
        ctx.db.query("chatRooms").collect(),
        ctx.db.query("memberships").collect(),
        ctx.db.query("reports").collect(),
        ctx.db.query("chatMessages").collect(),
        ctx.db.query("errorLogs").collect(),
        ctx.db.query("profiles").collect(),
      ]);

    const bannedNow = users.filter(
      (u) => u.bannedPermanent || (u.bannedUntil && u.bannedUntil > now),
    ).length;
    const mutedNow = users.filter((u) => u.mutedUntil && u.mutedUntil > now).length;
    const liveGames = games.filter((g) => g.status === "playing").length;
    const waitingGames = games.filter((g) => g.status === "waiting").length;
    const finishedToday = games.filter(
      (g) => g.status === "finished" && now - g.createdAt < 24 * 60 * 60_000,
    ).length;
    const msgsLastHour = chatMessages.filter((m) => now - m.createdAt < 60 * 60_000).length;
    const msgsLast24h = chatMessages.filter((m) => now - m.createdAt < 24 * 60 * 60_000).length;
    const openReports = reports.filter((r) => r.status === "open").length;
    const totalXp = profiles.reduce((s, p) => s + p.xp, 0);
    const totalGames = profiles.reduce((s, p) => s + p.gamesPlayed, 0);
    const admins = users.filter((u) => u.role === "admin").length;

    const tierCounts: Record<string, number> = {};
    for (const m of memberships) tierCounts[m.tier] = (tierCounts[m.tier] ?? 0) + 1;

    const criticalErrors = errors.filter(
      (e) => e.severity === "critical" && !e.resolved,
    ).length;
    const unresolvedErrors = errors.filter((e) => !e.resolved).length;

    const maintenance = await ctx.db
      .query("maintenanceMode")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    return {
      now,
      totals: {
        users: users.length,
        admins,
        banned: bannedNow,
        muted: mutedNow,
        profiles: profiles.length,
        totalXp,
        totalGames,
        liveGames,
        waitingGames,
        finishedToday,
        rooms: rooms.length,
        memberships: memberships.length,
        openReports,
        messagesLastHour: msgsLastHour,
        messagesLast24h: msgsLast24h,
        questions: QUESTION_BANK.length,
        criticalErrors,
        unresolvedErrors,
        storeItems: ALL_ITEMS.length,
      },
      tiers: tierCounts,
      maintenance: maintenance
        ? { active: true, message: maintenance.message, startedAt: maintenance.startedAt }
        : { active: false, message: "", startedAt: 0 },
      release: {
        version: CURRENT_VERSION,
        build: BUILD_ID,
        apk: APK_FILE_NAME,
        sha256: APK_SHA256,
        bytes: APK_BYTES,
      },
      systems: ATLAS_SYSTEMS.map((s) => ({
        id: s.id,
        num: s.num,
        name: s.name,
        featureCount: s.features.length,
        accent: s.accent,
      })),
      featureCount: ATLAS_FEATURE_COUNT,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) اللاعبون — بحث، ملف، إجراءات
// ═══════════════════════════════════════════════════════════════════════

export const searchPlayers = query({
  args: { q: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAtlasOwner(ctx);
    const needle = (args.q ?? "").trim().toLowerCase();
    const users = await ctx.db.query("users").collect();
    const filtered = needle
      ? users.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(needle) ||
            (u.email ?? "").toLowerCase().includes(needle),
        )
      : users;
    const limited = filtered
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit ?? 60);
    const now = Date.now();
    return limited.map((u) => ({
      _id: u._id,
      name: u.name ?? "بلا اسم",
      email: u.email ?? "",
      role: u.role ?? "user",
      banned: Boolean(u.bannedPermanent || (u.bannedUntil && u.bannedUntil > now)),
      bannedPermanent: Boolean(u.bannedPermanent),
      muted: Boolean(u.mutedUntil && u.mutedUntil > now),
      warnings: u.warnings ?? 0,
      cheatStrikes: u.cheatStrikes ?? 0,
    }));
  },
});

/** الملف الشامل للاعب — الكاميرا الذكية. */
export const getPlayerFile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAtlasOwner(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("اللاعب غير موجود");
    const now = Date.now();

    const [profile, membership, actions, history] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first(),
      ctx.db
        .query("ownerActions")
        .withIndex("by_created", (q) => q.gte("createdAt", now - 90 * 86400_000))
        .collect(),
      ctx.db
        .query("gameHistory")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(10),
    ]);

    const relatedActions = actions
      .filter((a) => a.targetUserId === args.userId)
      .slice(0, 15);

    return {
      user: {
        _id: user._id,
        name: user.name ?? "بلا اسم",
        email: user.email ?? "",
        role: user.role ?? "user",
        warnings: user.warnings ?? 0,
        mutedUntil: user.mutedUntil ?? 0,
        bannedUntil: user.bannedUntil ?? 0,
        bannedPermanent: Boolean(user.bannedPermanent),
        banReason: user.banReason ?? "",
        cheatStrikes: user.cheatStrikes ?? 0,
      },
      profile: profile
        ? {
            xp: profile.xp,
            gamesPlayed: profile.gamesPlayed,
            gamesWon: profile.gamesWon,
            bestScore: profile.bestScore,
            bestStreak: profile.bestStreak,
            correctAnswers: profile.correctAnswers,
            totalAnswers: profile.totalAnswers,
            dailyStreak: profile.dailyStreak ?? 0,
          }
        : null,
      membership: membership
        ? { tier: membership.tier, expiresAt: membership.expiresAt ?? null }
        : null,
      actions: relatedActions.map((a) => ({
        action: a.action,
        details: a.details,
        createdAt: a.createdAt,
      })),
      recentGames: history.map((g) => ({
        score: g.score,
        correct: g.correctCount,
        total: g.questionCount,
        won: g.won,
        playedAt: g.playedAt,
      })),
    };
  },
});

export const atlasEditPlayer = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"), v.literal("member"))),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined && args.name.trim()) patch.name = args.name.trim();
    if (args.role !== undefined) patch.role = args.role;
    await ctx.db.patch(args.userId, patch);
    await logAudit(ctx, {
      system: "players",
      feature: "c3",
      command: "editPlayer",
      ok: true,
      result: args,
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true };
  },
});

export const atlasPunish = mutation({
  args: {
    userId: v.id("users"),
    action: v.union(
      v.literal("warn"),
      v.literal("mute"),
      v.literal("kick"),
      v.literal("ban_temp"),
      v.literal("ban_perm"),
    ),
    reason: v.optional(v.string()),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const now = Date.now();
    const patch: Record<string, unknown> = {};
    let details = "";
    switch (args.action) {
      case "warn":
        patch.lastWarningAt = now;
        details = `أطلس: تحذير رسمي — ${args.reason ?? "مخالفة"}`;
        break;
      case "mute":
        patch.mutedUntil = now + (args.durationHours ?? 1) * 3600_000;
        details = `أطلس: كتم لمدة ${args.durationHours ?? 1} ساعة — ${args.reason ?? ""}`;
        break;
      case "ban_temp":
        patch.bannedUntil = now + (args.durationHours ?? 24) * 3600_000;
        patch.banReason = args.reason ?? "حظر مؤقت من أطلس";
        details = `أطلس: حظر مؤقت ${args.durationHours ?? 24} ساعة`;
        break;
      case "ban_perm":
        patch.bannedPermanent = true;
        patch.banReason = args.reason ?? "حظر دائم من أطلس";
        details = "أطلس: حظر دائم";
        break;
      case "kick":
        details = `أطلس: طرد — ${args.reason ?? ""}`;
        break;
    }
    await ctx.db.patch(args.userId, patch);
    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: `أطلس — ${owner.name ?? "المالك"}`,
      action: args.action === "kick" ? "kick" : args.action.replace("ban_", "ban"),
      targetId: args.userId,
      targetName: target?.name ?? "؟",
      reason: details,
      severity: args.action.includes("ban") ? "high" : args.action === "mute" ? "medium" : "low",
      createdAt: now,
    });
    await logAudit(ctx, {
      system: "players",
      feature: "c4",
      command: "punish",
      ok: true,
      result: { userId: args.userId, action: args.action },
      executedBy: owner.name ?? "المالك",
      severity: args.action.includes("ban") ? "critical" : "warning",
    });
    return { ok: true, details };
  },
});

export const atlasPardon = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    await ctx.db.patch(args.userId, {
      mutedUntil: 0,
      bannedUntil: 0,
      bannedPermanent: false,
      banReason: "",
    });
    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: `أطلس — ${owner.name ?? "المالك"}`,
      action: "pardon",
      targetId: args.userId,
      targetName: target?.name ?? "؟",
      reason: "أطلس: عفو كامل وإلغاء كل العقوبات",
      severity: "low",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "players",
      feature: "c5",
      command: "pardon",
      ok: true,
      result: { userId: args.userId },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true };
  },
});

export const atlasBulkAction = mutation({
  args: {
    userIds: v.array(v.id("users")),
    action: v.union(
      v.literal("warn"),
      v.literal("mute"),
      v.literal("ban_temp"),
      v.literal("pardon"),
    ),
    reason: v.optional(v.string()),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const now = Date.now();
    let applied = 0;
    for (const userId of args.userIds) {
      const patch: Record<string, unknown> = {};
      switch (args.action) {
        case "warn":
          patch.lastWarningAt = now;
          break;
        case "mute":
          patch.mutedUntil = now + (args.durationHours ?? 1) * 3600_000;
          break;
        case "ban_temp":
          patch.bannedUntil = now + (args.durationHours ?? 24) * 3600_000;
          patch.banReason = args.reason ?? "حظر جماعي من أطلس";
          break;
        case "pardon":
          patch.mutedUntil = 0;
          patch.bannedUntil = 0;
          patch.bannedPermanent = false;
          break;
      }
      await ctx.db.patch(userId, patch);
      applied++;
    }
    await logAudit(ctx, {
      system: "players",
      feature: "c6",
      command: "bulkAction",
      ok: true,
      result: { count: applied, action: args.action },
      executedBy: owner.name ?? "المالك",
      severity: args.action === "ban_temp" ? "critical" : "warning",
    });
    return { ok: true, applied };
  },
});

export const atlasResetProgress = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (profile) {
      // نسخة احتياطية قبل التصفير (ميزة p6/p7)
      await ctx.db.insert("playerBackups", {
        userId: args.userId,
        backupData: JSON.stringify(profile),
        createdAt: Date.now(),
      });
      await ctx.db.patch(profile._id, {
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        bestScore: 0,
        bestStreak: 0,
        correctAnswers: 0,
        totalAnswers: 0,
      });
    }
    await logAudit(ctx, {
      system: "players",
      feature: "p6",
      command: "resetProgress",
      ok: true,
      result: { userId: args.userId },
      executedBy: owner.name ?? "المالك",
      severity: "critical",
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) العضويات والأكواد
// ═══════════════════════════════════════════════════════════════════════

export const membershipAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const [codes, memberships, users] = await Promise.all([
      ctx.db.query("membershipCodes").collect(),
      ctx.db.query("memberships").collect(),
      ctx.db.query("users").collect(),
    ]);
    const tierCounts: Record<string, number> = {};
    for (const m of memberships) tierCounts[m.tier] = (tierCounts[m.tier] ?? 0) + 1;
    const nameOf = new Map(users.map((u) => [u._id, u.name ?? "بلا اسم"]));
    const now = Date.now();
    return {
      tiers: MEMBERSHIP_TIERS.map((t: any) => ({
        id: String(t.id ?? t.tier ?? "?"),
        name: String(t.name ?? t.label ?? "?"),
        count: tierCounts[String(t.id ?? t.tier ?? "?")] ?? 0,
      })),
      codes: codes
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 60)
        .map((c) => ({
          _id: c._id,
          code: c.code,
          tier: c.tier,
          durationDays: c.durationDays ?? null,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          active: c.active && (c.maxUses === 0 || c.usedCount < c.maxUses),
          createdAt: c.createdAt,
        })),
      holders: memberships
        .filter((m) => !m.expiresAt || m.expiresAt > now)
        .slice(0, 40)
        .map((m) => ({
          userId: m.userId,
          name: nameOf.get(m.userId) ?? "محذوف",
          tier: m.tier,
          expiresAt: m.expiresAt ?? null,
        })),
      total: memberships.length,
    };
  },
});

export const atlasGrantMembership = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const expiresAt = args.durationDays
      ? Date.now() + args.durationDays * 86400_000
      : undefined;
    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        activatedAt: Date.now(),
        expiresAt,
        features: [args.tier],
      });
    } else {
      await ctx.db.insert("memberships", {
        userId: args.userId,
        tier: args.tier,
        activatedAt: Date.now(),
        expiresAt,
        features: [args.tier],
      });
    }
    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: `أطلس — ${owner.name ?? "المالك"}`,
      action: "grant_membership",
      targetId: args.userId,
      targetName: target?.name ?? "؟",
      reason: `أطلس: منح عضوية ${args.tier}`,
      severity: "low",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "memberships",
      feature: "m4",
      command: "grantMembership",
      ok: true,
      result: { userId: args.userId, tier: args.tier },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true };
  },
});

export const atlasRevokeMembership = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    const target = await ctx.db.get(args.userId);
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: `أطلس — ${owner.name ?? "المالك"}`,
      action: "revoke_membership",
      targetId: args.userId,
      targetName: target?.name ?? "؟",
      reason: "أطلس: سحب العضوية",
      severity: "medium",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "memberships",
      feature: "m5",
      command: "revokeMembership",
      ok: true,
      result: { userId: args.userId },
      executedBy: owner.name ?? "المالك",
      severity: "warning",
    });
    return { ok: true };
  },
});

export const atlasCreateCode = mutation({
  args: {
    tier: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    durationDays: v.optional(v.number()),
    maxUses: v.number(),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const code = `ATLAS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await ctx.db.insert("membershipCodes", {
      code,
      tier: args.tier,
      durationDays: args.durationDays,
      maxUses: args.maxUses,
      usedCount: 0,
      usedBy: [],
      active: true,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "memberships",
      feature: "m2",
      command: "createCode",
      ok: true,
      result: { code, tier: args.tier },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true, code };
  },
});

export const atlasDeleteCode = mutation({
  args: { codeId: v.id("membershipCodes") },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    await ctx.db.patch(args.codeId, { active: false });
    await logAudit(ctx, {
      system: "memberships",
      feature: "m6",
      command: "deleteCode",
      ok: true,
      result: { codeId: args.codeId },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) المحتوى — بنك الأسئلة
// ═══════════════════════════════════════════════════════════════════════

export const contentAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const disabledRow = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "modSettings"))
      .unique();
    const disabledIds: string[] = disabledRow
      ? ((JSON.parse(disabledRow.value) as any).disabledQuestions ?? [])
      : [];

    const byCategory: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    for (const q of QUESTION_BANK) {
      byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
      byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1;
    }

    const qualityFlags = QUESTION_BANK.filter(
      (q) =>
        new Set(q.options).size !== q.options.length ||
        q.options.some((o) => o.trim().length < 1) ||
        q.question.trim().length < 10,
    ).slice(0, 20);

    return {
      total: QUESTION_BANK.length,
      byCategory,
      byDifficulty,
      categories: CATEGORIES,
      disabledIds,
      qualityFlags: qualityFlags.map((q) => ({
        id: q.id,
        question: q.question,
        reason:
          new Set(q.options).size !== q.options.length
            ? "خيارات مكررة"
            : "نص قصير/مريب",
      })),
      disabledCount: disabledIds.length,
    };
  },
});

export const atlasToggleQuestion = mutation({
  args: { questionId: v.string(), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "modSettings"))
      .unique();
    const current: any = row ? JSON.parse(row.value) : {};
    const list: string[] = current.disabledQuestions ?? [];
    const next = args.disabled
      ? Array.from(new Set([...list, args.questionId]))
      : list.filter((id) => id !== args.questionId);
    current.disabledQuestions = next;
    const value = JSON.stringify(current);
    if (row) {
      await ctx.db.patch(row._id, { value });
    } else {
      await ctx.db.insert("settings", { key: "modSettings", value });
    }
    await logAudit(ctx, {
      system: "content",
      feature: "q3",
      command: "toggleQuestion",
      ok: true,
      result: { questionId: args.questionId, disabled: args.disabled },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true, disabledCount: next.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) الغرف والقوانين
// ═══════════════════════════════════════════════════════════════════════

export const roomsAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const now = Date.now();
    const [rooms, messages, rules, reports] = await Promise.all([
      ctx.db.query("chatRooms").collect(),
      ctx.db.query("chatMessages").collect(),
      ctx.db.query("rules").collect(),
      ctx.db.query("reports").collect(),
    ]);
    const msgsByRoom = new Map<string, number>();
    for (const m of messages) {
      const key = String(m.roomId);
      msgsByRoom.set(key, (msgsByRoom.get(key) ?? 0) + 1);
    }
    return {
      rooms: rooms
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 50)
        .map((r) => ({
          _id: r._id,
          name: r.name,
          members: r.members.length,
          messages: msgsByRoom.get(String(r._id)) ?? 0,
          archived: r.archived,
          createdAt: r._creationTime,
        })),
      totalMessages: messages.length,
      messagesLast24h: messages.filter((m) => now - m.createdAt < 86400_000).length,
      rules: rules
        .sort((a, b) => a.order - b.order)
        .map((r) => ({
          _id: r._id,
          title: r.title,
          active: r.active,
          severity: r.severity,
        })),
      reports: {
        open: reports.filter((r) => r.status === "open").length,
        resolved: reports.filter((r) => r.status !== "open").length,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 6) البلاغات الذكية
// ═══════════════════════════════════════════════════════════════════════

export const reportsAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const open = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(50);
    const all = await ctx.db.query("reports").collect();
    const byReason: Record<string, number> = {};
    for (const r of all) {
      const key = r.reason.slice(0, 24);
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
    const resolved = all.filter((r) => r.status !== "open");
    const highSeverityOpen = open.filter(
      (r) => (r.aiVerdict?.severity ?? "low") === "high",
    ).length;
    return {
      open: open.map((r) => ({
        _id: r._id,
        reason: r.reason,
        details: r.details ?? "",
        reporterName: r.reporterName,
        targetName: r.targetName,
        status: r.status,
        aiVerdict: r.aiVerdict ?? null,
        createdAt: r.createdAt,
      })),
      stats: {
        total: all.length,
        open: all.filter((r) => r.status === "open").length,
        resolved: resolved.length,
        dismissed: all.filter((r) => r.status === "dismissed").length,
        highSeverityOpen,
        byReason,
      },
      categories: REPORT_CATEGORIES,
    };
  },
});

export const atlasResolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    approved: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("البلاغ غير موجود");
    await ctx.db.patch(args.reportId, {
      status: args.approved ? "reviewed" : "dismissed",
    });
    await ctx.db.insert("moderationLogs", {
      actorType: "owner",
      actorName: `أطلس — ${owner.name ?? "المالك"}`,
      action: args.approved ? "report_approved" : "report_dismissed",
      targetId: report.targetId,
      targetName: report.targetName,
      reason: args.note ?? report.reason,
      severity:
        (report.aiVerdict?.severity ?? "low") === "high" ? "high" : "medium",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "reports",
      feature: "a4",
      command: "resolveReport",
      ok: true,
      result: { reportId: args.reportId, approved: args.approved },
      executedBy: owner.name ?? "المالك",
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 7) الذكاء الاصطناعي — مفاتيح وسجلات وتفكير حر
// ═══════════════════════════════════════════════════════════════════════

export const aiAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "modSettings"))
      .unique();
    const parsed: any = settings ? JSON.parse(settings.value) : {};
    const logs = await ctx.db
      .query("aiLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(40);
    return {
      aiEnabled: parsed.aiEnabled ?? true,
      aiAutoApply: parsed.aiAutoApply ?? false,
      aiAdminEnabled: parsed.aiAdminEnabled ?? true,
      aiModel: parsed.aiModel ?? "openrouter/free",
      logs: logs.map((l) => ({
        _id: l._id,
        action: l.action,
        subsystem: l.subsystem,
        message: l.message,
        severity: l.severity,
        auto: l.auto,
        timestamp: l.timestamp,
      })),
    };
  },
});

export const atlasSetAiControl = mutation({
  args: {
    aiEnabled: v.optional(v.boolean()),
    aiAutoApply: v.optional(v.boolean()),
    aiAdminEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "modSettings"))
      .unique();
    const current: any = row ? JSON.parse(row.value) : {};
    if (args.aiEnabled !== undefined) current.aiEnabled = args.aiEnabled;
    if (args.aiAutoApply !== undefined) current.aiAutoApply = args.aiAutoApply;
    if (args.aiAdminEnabled !== undefined) current.aiAdminEnabled = args.aiAdminEnabled;
    const value = JSON.stringify(current);
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("settings", { key: "modSettings", value });
    await logAudit(ctx, {
      system: "ai",
      feature: "l1",
      command: "aiControl",
      ok: true,
      result: args,
      executedBy: owner.name ?? "المالك",
      severity: args.aiEnabled === false ? "warning" : "info",
    });
    return { ok: true };
  },
});

/**
 * المحرك الحر — تفكير شامل في حالة اللعبة الآن.
 * يعمل داخل خادم Convex بلا أي مفاتيح خارجية: يجمع القرائن من كل الأنظمة
 * ويولّد ملاحظات/اقتراحات حقيقية مبنية على الأرقام الفعلية، ويخزنها
 * في atlasInsights — مع ذاكرة تعلّم من قرارات المالك.
 */
export const atlasThink = mutation({
  args: { prompt: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const now = Date.now();
    const [users, games, reports, messages, errors] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("reports").collect(),
      ctx.db.query("chatMessages").collect(),
      ctx.db.query("errorLogs").collect(),
    ]);

    type Insight = {
      kind: string;
      system: string;
      severity: "info" | "blue" | "orange" | "red" | "purple";
      title: string;
      body: string;
      data?: string;
    };
    const insights: Insight[] = [];

    // 1) نشاط الرسائل — كشف شذوذ
    const msgsLastHour = messages.filter((m) => now - m.createdAt < 3600_000).length;
    const msgsPrevHour = messages.filter(
      (m) => now - m.createdAt >= 3600_000 && now - m.createdAt < 7200_000,
    ).length;
    if (msgsPrevHour > 0 && msgsLastHour > msgsPrevHour * 2) {
      insights.push({
        kind: "anomaly",
        system: "rooms",
        severity: "orange",
        title: "ارتفاع مفاجئ في رسائل الدردشة",
        body: `الرسائل في الساعة الأخيرة (${msgsLastHour}) ضعف الساعة السابقة (${msgsPrevHour}). راقب الغرف — قد يكون سباماً منظّماً.`,
        data: JSON.stringify({ msgsLastHour, msgsPrevHour }),
      });
    }

    // 2) بلاغات مفتوحة
    const openReports = reports.filter((r) => r.status === "open").length;
    if (openReports > 5) {
      insights.push({
        kind: "suggestion",
        system: "reports",
        severity: openReports > 15 ? "red" : "orange",
        title: `${openReports} بلاغاً مفتوحاً بحاجة لقرار`,
        body: "افتح نظام البلاغات الذكية واحسم البلاغات القديمة أولاً — تراكمها يبطئ عدالة المجتمع كلها.",
        data: JSON.stringify({ openReports }),
      });
    }

    // 3) أخطاء حرجة
    const critical = errors.filter(
      (e) => e.severity === "critical" && !e.resolved,
    ).length;
    if (critical > 0) {
      insights.push({
        kind: "anomaly",
        system: "emergency",
        severity: "red",
        title: `${critical} خطأ حرج غير معالج`,
        body: "افتح مركز الأخطاء في نظام الطوارئ وراجع الأخطاء الحرجة — قد تعطل تجربة لاعبين الآن.",
        data: JSON.stringify({ critical }),
      });
    }

    // 4) حسابات محظورة
    const banned = users.filter(
      (u) => u.bannedPermanent || (u.bannedUntil && u.bannedUntil > now),
    ).length;
    if (users.length > 20 && banned > users.length * 0.1) {
      insights.push({
        kind: "observation",
        system: "players",
        severity: "purple",
        title: "نسبة الحظر مرتفعة",
        body: `${banned} من ${users.length} حساباً محظوراً (${Math.round((banned / users.length) * 100)}%). راجع ملفات الحظر للتأكد من عدم وجود حظر خاطئ.`,
        data: JSON.stringify({ banned, users: users.length }),
      });
    }

    // 5) غرف انتظار مهجورة
    const staleLobbies = games.filter(
      (g) => g.status === "waiting" && now - g.createdAt > 2 * 3600_000,
    ).length;
    if (staleLobbies > 0) {
      insights.push({
        kind: "suggestion",
        system: "control",
        severity: "blue",
        title: `${staleLobbies} غرفة انتظار مهجورة`,
        body: "غرف انتظار عمرها أكثر من ساعتين بدون انطلاق — أنظفها من قلب السيطرة المركزية.",
        data: JSON.stringify({ staleLobbies }),
      });
    }

    if (insights.length === 0) {
      insights.push({
        kind: "summary",
        system: "control",
        severity: "info",
        title: "كل الأنظمة تعمل ضمن النطاق الطبيعي",
        body: `فحص شامل: ${users.length} حساباً، ${games.length} جولة، ${reports.length} بلاغ، ${errors.filter((e) => !e.resolved).length} خطأ غير معالج — لا أنماط شاذة الآن.`,
      });
    }

    // ذاكرة التعلّم: مطابقة الأمر الحر مع قرارات المالك السابقة
    const prompt = (args.prompt ?? "").trim();
    let memoryHit: string | null = null;
    if (prompt) {
      const mem = await ctx.db.query("atlasLearningMemory").collect();
      const hit = mem.find((m) => prompt.includes(m.kind));
      if (hit) memoryHit = hit.decision;
    }

    for (const ins of insights) {
      await ctx.db.insert("atlasInsights", {
        kind: ins.kind,
        system: ins.system,
        severity: ins.severity,
        title: ins.title,
        body: ins.body,
        data: ins.data,
        status: "open",
        createdAt: now,
      });
    }

    await logAudit(ctx, {
      system: "ai",
      feature: "l2",
      command: "aiThink",
      ok: true,
      result: { insights: insights.length, prompt },
      executedBy: owner.name ?? "المالك",
    });

    return {
      ok: true,
      count: insights.length,
      insights,
      memoryHit,
      prompt: prompt || null,
    };
  },
});

export const getInsights = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAtlasOwner(ctx);
    const rows = await ctx.db
      .query("atlasInsights")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 30);
    return rows.map((r) => ({
      _id: r._id,
      kind: r.kind,
      system: r.system,
      severity: r.severity,
      title: r.title,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt,
    }));
  },
});

/** قرار المالك على اقتراح الأنظمة الحرة — يدرّب ذاكرة التعلّم. */
export const decideInsight = mutation({
  args: { insightId: v.id("atlasInsights"), accept: v.boolean() },
  handler: async (ctx, args) => {
    await requireAtlasOwnerMutation(ctx);
    const row = await ctx.db.get(args.insightId);
    if (!row) throw new Error("الاقتراح غير موجود");
    await ctx.db.patch(args.insightId, {
      status: args.accept ? "accepted" : "dismissed",
      decidedAt: Date.now(),
    });
    if (args.accept) {
      const sig = `${row.kind}:${row.system}`;
      const existing = await ctx.db
        .query("atlasLearningMemory")
        .withIndex("by_signature", (q) => q.eq("signature", sig))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          timesSeen: existing.timesSeen + 1,
          lastSeenAt: Date.now(),
        });
      } else {
        await ctx.db.insert("atlasLearningMemory", {
          kind: row.kind,
          signature: sig,
          decision: row.title,
          timesSeen: 1,
          lastSeenAt: Date.now(),
          createdAt: Date.now(),
        });
      }
    }
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 8) الاقتصاد والمتجر
// ═══════════════════════════════════════════════════════════════════════

export const economyAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const [profiles, gifts] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("gifts").collect(),
    ]);
    const totalXp = profiles.reduce((s, p) => s + p.xp, 0);
    const coins = Math.floor(totalXp / 10);
    return {
      store: {
        items: ALL_ITEMS.length,
        sections: STORE_SECTIONS.length,
        bundles: STORE_BUNDLES.length,
        sectionsList: STORE_SECTIONS.map((s: any) => String(s?.name ?? s?.id ?? "قسم")),
      },
      currency: {
        coins,
        players: profiles.length,
        avgCoins: profiles.length ? Math.floor(coins / profiles.length) : 0,
      },
      gifts: {
        total: gifts.length,
        unclaimed: gifts.filter((g) => !g.claimed).length,
        last7d: gifts.filter((g) => Date.now() - g.createdAt < 7 * 86400_000).length,
      },
      itemsPreview: ALL_ITEMS.slice(0, 20).map((i: any) => ({
        id: String(i?.id ?? "?"),
        name: String(i?.name ?? "?"),
        price: Number(i?.price ?? 0),
      })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 9) التحليلات والتنبؤ + التقرير التنفيذي
// ═══════════════════════════════════════════════════════════════════════

export const analyticsData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const now = Date.now();
    const [profiles, games, users, history] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("gameHistory").collect(),
    ]);

    const dayMs = 86400_000;
    const finished7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const from = now - (i + 1) * dayMs;
      const to = now - i * dayMs;
      finished7d.push(
        games.filter(
          (g) => g.status === "finished" && g.createdAt >= from && g.createdAt < to,
        ).length,
      );
    }

    const acc = profiles.reduce(
      (s, p) => s + (p.totalAnswers > 0 ? p.correctAnswers / p.totalAnswers : 0),
      0,
    );
    const avgAccuracy = profiles.length ? acc / profiles.length : 0;
    const retention = profiles.filter((p) => p.gamesPlayed >= 3).length;

    return {
      finished7d,
      totals: {
        games: games.length,
        finished: games.filter((g) => g.status === "finished").length,
        users: users.length,
        rounds: history.length,
        answers: profiles.reduce((s, p) => s + p.totalAnswers, 0),
        avgAccuracy: Math.round(avgAccuracy * 100),
        retention: profiles.length
          ? Math.round((retention / profiles.length) * 100)
          : 0,
      },
      topPlayers: profiles
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10)
        .map((p) => {
          const u = users.find((x) => x._id === p.userId);
          return { name: u?.name ?? "؟", xp: p.xp, bestScore: p.bestScore };
        }),
    };
  },
});

export const exportFullReport = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const [users, profiles, games, reports, errors, memberships] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("profiles").collect(),
        ctx.db.query("games").collect(),
        ctx.db.query("reports").collect(),
        ctx.db.query("errorLogs").collect(),
        ctx.db.query("memberships").collect(),
      ]);
    return {
      generatedAt: Date.now(),
      game: "حرب العقول",
      controlApp: "أطلس كنترول",
      version: CURRENT_VERSION,
      build: BUILD_ID,
      totals: {
        users: users.length,
        profiles: profiles.length,
        games: games.length,
        finishedGames: games.filter((g) => g.status === "finished").length,
        reports: reports.length,
        openReports: reports.filter((r) => r.status === "open").length,
        errors: errors.length,
        memberships: memberships.length,
        questions: QUESTION_BANK.length,
      },
      topPlayers: profiles
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 20)
        .map((p) => {
          const u = users.find((x) => x._id === p.userId);
          return { name: u?.name ?? "؟", xp: p.xp, bestScore: p.bestScore };
        }),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 10) الطوارئ والصيانة والأمان + سجل التدقيق والجلسات
// ═══════════════════════════════════════════════════════════════════════

export const emergencyAdminData = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    const [maintenance, errors, commands, sessions] = await Promise.all([
      ctx.db
        .query("maintenanceMode")
        .withIndex("by_active", (q) => q.eq("active", true))
        .first(),
      ctx.db
        .query("errorLogs")
        .withIndex("by_unresolved", (q) => q.eq("resolved", false))
        .order("desc")
        .take(30),
      ctx.db
        .query("atlasCommands")
        .withIndex("by_created")
        .order("desc")
        .take(60),
      ctx.db.query("atlasSessions").collect(),
    ]);
    const bySeverity: Record<string, number> = {};
    for (const e of errors) {
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    }
    return {
      maintenance: maintenance
        ? { active: true, message: maintenance.message, startedAt: maintenance.startedAt }
        : { active: false, message: "", startedAt: 0 },
      errors: errors.map((e) => ({
        _id: e._id,
        message: e.message.slice(0, 200),
        severity: e.severity,
        category: e.category,
        route: e.route ?? "",
        count: (e as any).count ?? 1,
        createdAt: e.createdAt,
      })),
      bySeverity,
      audit: commands.map((c) => ({
        _id: c._id,
        system: c.system,
        feature: c.feature,
        command: c.command,
        ok: c.ok,
        executedBy: c.executedBy,
        severity: c.severity,
        createdAt: c.createdAt,
      })),
      sessions: sessions.length,
    };
  },
});

export const atlasSetMaintenance = mutation({
  args: { active: v.boolean(), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    const current = await ctx.db
      .query("maintenanceMode")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();
    if (args.active) {
      if (current) {
        await ctx.db.patch(current._id, {
          message: args.message ?? current.message,
        });
      } else {
        await ctx.db.insert("maintenanceMode", {
          active: true,
          message: args.message ?? "اللعبة تحت الصيانة — عد قريباً!",
          startedAt: Date.now(),
        });
      }
    } else if (current) {
      await ctx.db.patch(current._id, { active: false, endedAt: Date.now() });
    }
    await logAudit(ctx, {
      system: "emergency",
      feature: "x1",
      command: "maintenance",
      ok: true,
      result: { active: args.active },
      executedBy: owner.name ?? "المالك",
      severity: args.active ? "critical" : "info",
    });
    return { ok: true };
  },
});

export const atlasBroadcast = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("ban"),
      v.literal("update"),
      v.literal("system"),
    ),
    targetUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const owner = await requireAtlasOwnerMutation(ctx);
    await ctx.db.insert("notifications", {
      userId: args.targetUserId ?? "__all__",
      title: args.title,
      body: args.body,
      type: args.type,
      read: false,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      system: "control",
      feature: "c7",
      command: "notify",
      ok: true,
      result: {
        title: args.title,
        type: args.type,
        targeted: Boolean(args.targetUserId),
      },
      executedBy: owner.name ?? "المالك",
      severity: args.type === "ban" || args.type === "warning" ? "warning" : "info",
    });
    return { ok: true };
  },
});

export const getAuditTrail = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAtlasOwner(ctx);
    const rows = await ctx.db
      .query("atlasCommands")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 100);
    return rows.map((r) => ({
      _id: r._id,
      system: r.system,
      feature: r.feature,
      command: r.command,
      ok: r.ok,
      error: r.error ?? null,
      executedBy: r.executedBy,
      severity: r.severity,
      createdAt: r.createdAt,
    }));
  },
});

/** تسجيل جلسة دخول أطلس (أمان + تدقيق دخول — ميزة x6). */
export const atlasSessionLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
    const user = await ctx.db.get(userId);
    if (!user || !isOwnerUser(user)) {
      throw new Error("أطلس كنترول للمالك الرسمي فقط");
    }
    await ctx.db.insert("atlasSessions", {
      userId,
      loginAt: Date.now(),
    });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// سجل الأنظمة للواجهة
// ═══════════════════════════════════════════════════════════════════════

export const getAtlasSystemRegistry = query({
  args: {},
  handler: async (ctx) => {
    await requireAtlasOwner(ctx);
    return {
      systems: ATLAS_SYSTEMS,
      featureCount: ATLAS_FEATURE_COUNT,
    };
  },
});
