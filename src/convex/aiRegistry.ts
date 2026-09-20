/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎛️ v12.0 — سجل الوكلاء الكامل (Census) — بحث عميق داخل كل ذكاء في اللعبة
 *
 * هذا الملف هو «دفتر الأنساب» لكل ذكاء في «حرب العقول»: كل عقل باسمه،
 * وبماذا يعمل فعلاً، وفي أي ملف يقيم، وهل له مسار تنفيذ حقيقي أم أنه
 * طبقة تُستدعى من غيره، وما الذي يستطيع المالك فعله به.
 *
 * القاعدة الصارمة: لا يوجد «ذكاء» مُعلَن بلا تسجيل هنا، ولا تسجيل بلا
 * حقيقة في الكود. وحقل `wiring` صريح بالصدق:
 *   • wired   = له مسار تنفيذ يستطيع المالك تشغيله الآن من الغرفة.
 *   • passive = طبقة تُستدعى تلقائياً من أنظمة أخرى (لا زر تشغيل).
 *   • dormant = موجود في الكود لكن يحتاج شرطاً خارجياً (مفتاح API / تفعيل نائب).
 *
 * ملاحظة أمانة: أي ذكاء نائم يظهر كـ«نائم» بسبب حقيقي مكتوب، لا نخفيه.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type AiKind = "engine" | "unit" | "job" | "colony" | "module" | "advisor";
export type AiWiring = "wired" | "passive" | "dormant";
export type AiDept =
  | "المحرك"
  | "الشخصي"
  | "الرقابي"
  | "البلاغات"
  | "الإدارة"
  | "المحتوى"
  | "الصحة"
  | "التوصيات"
  | "التخصيص"
  | "السيادة"
  | "الوكلاء"
  | "الذاكرة"
  | "الأدوات"
  | "الذكاء"
  | "القيادة";

/** القدرات التي يستطيع المالك منحها/سلبها — كل قدرة لها أثر حقيقي في التنفيذ */
export type AiCapability =
  | "orders" // استقبال أوامر نصية وتنفيذها في دورتها
  | "auto_run" // العمل تلقائياً بلا أمر
  | "writes" // الكتابة في قاعدة البيانات
  | "punish" // فرض عقوبات على اللاعبين
  | "content" // توليد محتوى (أسئلة/تحديات)
  | "economy" // المساس بالاقتصاد
  | "broadcast" // إرسال إشعارات عامة
  | "self_heal"; // إصلاح ذاتي للأخطاء

export interface AiEntry {
  key: string;
  name: string;
  emoji: string;
  dept: AiDept;
  kind: AiKind;
  wiring: AiWiring;
  /** ماذا يعمل فعلاً — بجملة صادقة واحدة أو اثنتين */
  purpose: string;
  /** الملف الحقيقي الذي يقيم فيه */
  module: string;
  /** ما يستهلكه فعلاً (للتخطيط ومراقبة الحصة) */
  consumes: string;
  /** مفتاح مهمة الجدولة المرتبط (إن وُجد) */
  jobKey?: string;
  /** معرّف الوحدة في مركز الذكاء الموحد (إن وُجد) */
  unitKey?: string;
  /** مفعّل افتراضياً؟ */
  defaultOn: boolean;
  /** سقف افتراضي: تشغيلات في الساعة / اليوم (0 = بلا حد) */
  caps: { perHour: number; perDay: number };
  capabilities: AiCapability[];
  /** أشياء يمكن للمالك إيقافها فوراً بالاسم */
  stoppables: string[];
  /** سبب النوم إن كان نائماً */
  dormantReason?: string;
}

// ───────────────────────────────────────────────────────────────────────
// ① السجل — ٣٤ ذكاءً ونظاماً
// ───────────────────────────────────────────────────────────────────────

export const AI_REGISTRY: readonly AiEntry[] = [
  // ═══ المحرك ═══
  {
    key: "engine_llm",
    name: "محرك الاستدعاء الحقيقي",
    emoji: "⚙️",
    dept: "المحرك",
    kind: "engine",
    wiring: "wired",
    purpose: "الطريق الوحيد لأي نداء ذكاء خارجي: نظامان فقط (مفتاح+رابط أو مفتاح وحده) وبلا أي نتيجة وهمية.",
    module: "src/convex/aiConfig.ts",
    consumes: "نداء شبكة واحد لكل رسالة ذكاء + حصة المزوّد",
    defaultOn: true,
    caps: { perHour: 60, perDay: 600 },
    capabilities: ["writes"],
    stoppables: ["وقف كل النداءات الخارجية", "فرض النماذج المجانية فقط", "منع الفشل الصامت"],
  },
  {
    key: "deputy_bridge",
    name: "جسر نائب المالك",
    emoji: "🛰️",
    dept: "المحرك",
    kind: "engine",
    wiring: "passive",
    purpose: "يوصّل أوامر العرش إلى نسخ النائب الحية وينفّذها في دورتها، ويعلن حالة الاتصال.",
    module: "src/convex/apiHubStore.ts · apiHubInternal.ts · masterAI.ts",
    consumes: "قراءة/كتابة صفوف الأوامر + سجل التنفيذ",
    defaultOn: true,
    caps: { perHour: 120, perDay: 1200 },
    capabilities: ["orders", "auto_run", "writes", "self_heal"],
    stoppables: ["وقف تمرير الأوامر", "وقف تفعيل الأنظمة الحرة", "منع التنفيذ الذاتي"],
  },

  // ═══ وحدات مركز الذكاء الموحد (١٢) ═══
  {
    key: "unit_coach",
    name: "المدرب الشخصي",
    emoji: "🎓",
    dept: "الشخصي",
    kind: "unit",
    wiring: "passive",
    unitKey: "coach",
    purpose: "يحلل أداء اللاعب ويوصي بتدريب مركّز على نقاط ضعفه.",
    module: "src/convex/aiCoach.ts",
    consumes: "قراءة إحصاءات اللعبة + كتابة نصائح",
    defaultOn: true,
    caps: { perHour: 30, perDay: 300 },
    capabilities: ["orders", "writes", "content"],
    stoppables: ["وقف التوصيات الشخصية", "إيقاف نصائح المدرب"],
  },
  {
    key: "unit_referee",
    name: "الحكم الآلي",
    emoji: "⚖️",
    dept: "الرقابي",
    kind: "unit",
    wiring: "wired",
    unitKey: "referee",
    purpose: "يكشف غش السرعة والشذوذ ويضبط صعوبة الأسئلة حسب مهارة اللاعب.",
    module: "src/convex/fairPlay.ts",
    consumes: "فحص سجلات الجولات + كتابة صفوف الشك",
    defaultOn: true,
    caps: { perHour: 60, perDay: 800 },
    capabilities: ["writes", "punish"],
    stoppables: ["وقف كشف الغش", "وقف أثر الشك على الترتيب"],
  },
  {
    key: "unit_guardian",
    name: "الحارس الرقابي",
    emoji: "🛡️",
    dept: "الرقابي",
    kind: "unit",
    wiring: "wired",
    unitKey: "guardian",
    purpose: "يراقب الدردشة ويطبّق القوانين تلقائياً، وسياسته مشتقّة من حساسيته (١–١٠).",
    module: "src/convex/aiGuardian.ts · clanCore.ts",
    consumes: "قراءة آخر الرسائل + كتم/تنبيه + سجل",
    jobKey: "chat_guardian",
    defaultOn: false,
    caps: { perHour: 60, perDay: 480 },
    capabilities: ["punish", "writes", "orders", "broadcast"],
    stoppables: ["وقف الكتم التلقائي", "وقف التنبيهات", "إبقاء الخطوط الحمراء فقط"],
  },
  {
    key: "unit_reports",
    name: "محلل البلاغات",
    emoji: "📮",
    dept: "البلاغات",
    kind: "unit",
    wiring: "wired",
    unitKey: "reports",
    purpose: "يرتّب البلاغات حسب الأولوية ويعطي حكماً أولياً مفسَّراً لكل بلاغ.",
    module: "src/convex/aiIntelligence.ts · sovereignGovernor.ts",
    consumes: "قراءة صندوق البلاغات + كتابة حكم أولي",
    defaultOn: true,
    caps: { perHour: 40, perDay: 300 },
    capabilities: ["writes", "punish", "orders"],
    stoppables: ["وقف الحكم الأولي", "وقف الترتيب بالأولوية"],
  },
  {
    key: "unit_governor",
    name: "الحاكم الآلي",
    emoji: "🤖",
    dept: "الإدارة",
    kind: "unit",
    wiring: "wired",
    unitKey: "governor",
    purpose: "تشغيل ذاتي للعبة: يرصد التضخم الاقتصادي والأخطاء ويتصرّف في الأعمال الآمنة بلا إذن.",
    module: "src/convex/aiGovernor.ts",
    consumes: "مسح دوري + كتابة إجراءات + سجل",
    defaultOn: false,
    caps: { perHour: 30, perDay: 240 },
    capabilities: ["auto_run", "writes", "economy", "punish", "orders"],
    stoppables: ["وقف التصرف الذاتي", "وقف المساس بالاقتصاد", "وقف العقوبات التلقائية"],
  },
  {
    key: "unit_questions",
    name: "مهندس الأسئلة",
    emoji: "🧩",
    dept: "المحتوى",
    kind: "unit",
    wiring: "wired",
    unitKey: "questions",
    purpose:
      "ينشر الأسئلة المجدولة المستحقة ويراجع جودة الحزم. تنبيه صادق: التوليد الآلي نفسه دالة نائبة في الكود تُعيد صفراً — المولّد الحقيقي هو نداء الذكاء عبر مركز API.",
    module: "src/convex/aiQuestions.ts",
    consumes: "نشر مجدول + كتابة أسئلة",
    jobKey: "questions_publish",
    defaultOn: false,
    caps: { perHour: 20, perDay: 120 },
    capabilities: ["content", "writes", "orders"],
    stoppables: ["وقف توليد الأسئلة", "وقف نشر المجدول", "وقف قبول الأسئلة تلقائياً"],
  },
  {
    key: "unit_health",
    name: "مراقب الصحة",
    emoji: "🩺",
    dept: "الصحة",
    kind: "unit",
    wiring: "wired",
    unitKey: "health",
    purpose: "يرصد صحة اللعبة والاقتصاد والمجتمع ويصدر تنبيهات مبنية على أرقام حقيقية.",
    module: "src/convex/commandDeck.ts · aiIntelligence.ts",
    consumes: "قراءة مؤشرات + تنبيهات",
    defaultOn: true,
    caps: { perHour: 30, perDay: 240 },
    capabilities: ["writes", "broadcast", "orders"],
    stoppables: ["وقف التنبيهات", "وقف تشخيص الاقتصاد"],
  },
  {
    key: "unit_recommender",
    name: "المُوصي الذكي",
    emoji: "🎯",
    dept: "التوصيات",
    kind: "unit",
    wiring: "wired",
    unitKey: "recommender",
    purpose: "يقترح تحديات وأحداثاً مناسبة حسب نشاط اللاعبين الحقيقي.",
    module: "src/convex/aiIntelligence.ts · adaptiveRewards.ts",
    consumes: "تحليل النشاط + اقتراحات",
    defaultOn: true,
    caps: { perHour: 30, perDay: 240 },
    capabilities: ["content", "orders", "writes"],
    stoppables: ["وقف الاقتراحات", "وقف الأحداث المقترحة"],
  },
  {
    key: "unit_personalizer",
    name: "مخصص التجربة",
    emoji: "🧬",
    dept: "التخصيص",
    kind: "unit",
    wiring: "passive",
    unitKey: "personalizer",
    purpose: "يطابق الخصوم ويختار أسئلة ديناميكية حسب مهارة كل لاعب ونقاط ضعفه.",
    module: "src/convex/aiEnhancements.ts · adaptiveRewards.ts",
    consumes: "قراءة ملف اللاعب + تخصيص المطابقة",
    defaultOn: true,
    caps: { perHour: 90, perDay: 900 },
    capabilities: ["writes", "orders"],
    stoppables: ["وقف المطابقة الذكية", "وقف الأسئلة الديناميكية"],
  },
  {
    key: "unit_notifier",
    name: "وسيط الإشعارات",
    emoji: "🔔",
    dept: "التخصيص",
    kind: "unit",
    wiring: "passive",
    unitKey: "notifier",
    purpose: "إشعارات ذكية تحترم ساعات الهدوء وتفضيلات كل لاعب وترتيب الأولوية.",
    module: "src/convex/deferredNotifications · notificationTiers",
    consumes: "قراءة/كتابة الإشعارات المؤجلة",
    defaultOn: true,
    caps: { perHour: 120, perDay: 1200 },
    capabilities: ["broadcast", "writes", "orders"],
    stoppables: ["وقف الإشعارات غير العاجلة", "فرض ساعات هدوء", "وقف الحملات العامة"],
  },
  {
    key: "unit_doctor",
    name: "طبيب Gemini",
    emoji: "🧪",
    dept: "الصحة",
    kind: "unit",
    wiring: "wired",
    unitKey: "doctor",
    purpose: "يشخّص الأخطاء: سبب جذري بالعربية + حل + قابلية إصلاح تلقائي.",
    module: "src/convex/aiDoctor · aiIntelligence.ts",
    consumes: "نداء ذكاء لكل تشخيص",
    defaultOn: true,
    caps: { perHour: 20, perDay: 120 },
    capabilities: ["self_heal", "writes", "orders"],
    stoppables: ["وقف التشخيص التلقائي", "وقف الإصلاح الذاتي"],
  },
  {
    key: "unit_sovereign",
    name: "الحاكم السيادي (الذكاء الحر)",
    emoji: "👑",
    dept: "السيادة",
    kind: "unit",
    wiring: "wired",
    unitKey: "sovereign",
    purpose: "سلطة عليا ذاتية: يدير الأنظمة، يحاكم ويعاقب بعواقب حقيقية، ويطوّر اللعبة بلا انتظار أحد.",
    module: "src/convex/sovereignGovernor.ts · sovereign.ts",
    consumes: "مسح شامل + عقوبات + سجل قرارات",
    jobKey: "chat_guardian",
    defaultOn: false,
    caps: { perHour: 40, perDay: 480 },
    capabilities: ["auto_run", "punish", "economy", "writes", "broadcast", "self_heal"],
    stoppables: ["وقف العقوبات الآلية", "وقف الأحكام", "وقف المساس بالنظام"],
  },

  // ═══ مهام الجدولة (المتبقية) ═══
  {
    key: "job_ai_hub_bridge",
    name: "جسر مركز الذكاء الموحد",
    emoji: "🌉",
    dept: "المحرك",
    kind: "job",
    wiring: "wired",
    purpose: "يمسك يد كل الوحدات: تبادل سياق، رصد شذوذ، وتسجيل أحداث موحّدة بين العقود.",
    module: "src/convex/aiHub.ts",
    consumes: "قراءة/كتابة أحداث المركز + نداءات تحليل",
    jobKey: "ai_hub_bridge",
    defaultOn: false,
    caps: { perHour: 2, perDay: 24 },
    capabilities: ["writes", "orders", "self_heal"],
    stoppables: ["وقف الجسر", "وقف تبادل السياق"],
  },
  {
    key: "job_ai_hub_prune",
    name: "تقليم أحداث المركز",
    emoji: "🧹",
    dept: "المحرك",
    kind: "job",
    wiring: "wired",
    purpose: "يحذف أحداث المركز الأقدم من ٣ أيام — يمنع تضخّم القاعدة.",
    module: "src/convex/aiHub.ts",
    consumes: "حذف مقيّد",
    jobKey: "ai_hub_prune",
    defaultOn: false,
    caps: { perHour: 2, perDay: 24 },
    capabilities: ["writes"],
    stoppables: ["وقف التقليم (ينمو السجل)"],
  },
  {
    key: "job_agents_life",
    name: "نبضة حياة الوكلاء",
    emoji: "🌱",
    dept: "الوكلاء",
    kind: "job",
    wiring: "wired",
    purpose: "يُبقي وكلاء AI أحياءً: يولدون ويتحدثون ويلعبون ويتقاعدون مع الوقت.",
    module: "src/convex/aiAgents.ts",
    consumes: "نداءات ذكاء + كتابة حسابات لاعبين وجولات",
    jobKey: "agents_life",
    defaultOn: false,
    caps: { perHour: 4, perDay: 48 },
    capabilities: ["auto_run", "writes", "content", "orders"],
    stoppables: ["وقف الولادة", "وقف الكلام", "وقف لعب الوكلاء"],
  },
  {
    key: "job_minds_life",
    name: "نبضة حياة العقول",
    emoji: "🧠",
    dept: "الوكلاء",
    kind: "job",
    wiring: "wired",
    purpose: "يولّد أفكار العقول الحيّة ويبني روابطها ويحرّك مجالسها.",
    module: "src/convex/livingMinds.ts",
    consumes: "كتابات كثيرة نسبياً + نداءات",
    jobKey: "minds_life",
    defaultOn: false,
    caps: { perHour: 2, perDay: 12 },
    capabilities: ["writes", "content", "orders"],
    stoppables: ["وقف توليد الأفكار", "وقف المجالس", "وقف الروابط"],
  },
  {
    key: "job_leagues_rollover",
    name: "تدوير الدوريات",
    emoji: "🏆",
    dept: "الإدارة",
    kind: "job",
    wiring: "wired",
    purpose: "يصفر نقاط الدوريات الأسبوعية ويوزّع النتائج في وقتها.",
    module: "src/convex/leagues.ts",
    consumes: "كتابات دورية مقيّدة",
    jobKey: "leagues_rollover",
    defaultOn: false,
    caps: { perHour: 1, perDay: 4 },
    capabilities: ["writes", "economy"],
    stoppables: ["وقف التدوير الأسبوعي"],
  },
  {
    key: "job_seasons_rollover",
    name: "تدوير المواسم",
    emoji: "🌗",
    dept: "الإدارة",
    kind: "job",
    wiring: "wired",
    purpose: "يغلق الموسم المنتهي ويفتح التالي ويمنح المكافآت المستحقة.",
    module: "src/convex/seasons.ts",
    consumes: "كتابات دورية + مكافآت",
    jobKey: "seasons_rollover",
    defaultOn: false,
    caps: { perHour: 1, perDay: 24 },
    capabilities: ["writes", "economy"],
    stoppables: ["وقف إغلاق الموسم", "وقف المكافآت"],
  },
  {
    key: "job_crown_locks",
    name: "إنهاء أقفال العرش",
    emoji: "🔓",
    dept: "السيادة",
    kind: "job",
    wiring: "wired",
    purpose: "يفتح أقفال العرش المنتهية (الساحة/الدردشة/الاقتصاد) تلقائياً.",
    module: "src/convex/crownDeck.ts",
    consumes: "قراءة/كتابة أقفال",
    jobKey: "crown_locks",
    defaultOn: false,
    caps: { perHour: 2, perDay: 24 },
    capabilities: ["writes"],
    stoppables: ["وقف فتح الأقفال (تبقى مقفلة)"],
  },
  {
    key: "job_clans_crown",
    name: "تاج العشائر الأسبوعي",
    emoji: "🛡️",
    dept: "الإدارة",
    kind: "job",
    wiring: "wired",
    purpose: "يصفر نقاط العشائر وينصّب الأعلى تاجاً في نهاية الأسبوع.",
    module: "src/convex/clans.ts",
    consumes: "كتابات دورية",
    jobKey: "clans_crown",
    defaultOn: false,
    caps: { perHour: 1, perDay: 4 },
    capabilities: ["writes", "economy"],
    stoppables: ["وقف التتويج الأسبوعي"],
  },
  {
    key: "job_roof_conflicts",
    name: "كشف خلافات الوحدات",
    emoji: "⚔️",
    dept: "المحرك",
    kind: "job",
    wiring: "wired",
    purpose: "يكشف تضارب وحدتين حول نفس الهدف ويعرضه على العرش للحسم.",
    module: "src/convex/aiRoof.ts",
    consumes: "قراءة أحداث + كتابة خلافات",
    jobKey: "ai_roof_conflicts",
    defaultOn: false,
    caps: { perHour: 2, perDay: 24 },
    capabilities: ["writes", "orders"],
    stoppables: ["وقف كشف الخلافات"],
  },
  {
    key: "job_self_maintenance",
    name: "الصيانة الذاتية",
    emoji: "🧰",
    dept: "المحرك",
    kind: "job",
    wiring: "wired",
    purpose: "يحذف السجلات القديمة من الجداول الكبيرة — يحفظ المساحة وسرعة الاستعلام.",
    module: "src/convex/maintenance.ts",
    consumes: "حذف مقيّد (الأهم لبقاء الخدمة)",
    jobKey: "self_maintenance",
    defaultOn: true,
    caps: { perHour: 1, perDay: 4 },
    capabilities: ["writes", "self_heal"],
    stoppables: ["وقف الصيانة (خطر تضخّم)"],
  },

  // ═══ المستعمرات (جماعات الذكاء) ═══
  {
    key: "colony_agents",
    name: "خمسون وكيلاً حياً",
    emoji: "👥",
    dept: "الوكلاء",
    kind: "colony",
    wiring: "wired",
    purpose: "وكلاء لهم حسابات لاعبين حقيقية: يتحدثون في الغرف ويلعبون جولات تُحسب نقاطها فعلاً.",
    module: "src/convex/aiAgents.ts",
    consumes: "نداء ذكاء لكل جملة/جولة + كتابة نتائج",
    defaultOn: false,
    caps: { perHour: 4, perDay: 48 },
    capabilities: ["auto_run", "writes", "content", "orders"],
    stoppables: ["وقف كل الوكلاء", "وقف الكلام فقط", "وقف اللعب فقط", "تجميد وكيل بعينه"],
  },
  {
    key: "colony_governor_assistants",
    name: "خمسون مساعداً متخصصاً",
    emoji: "🧑‍💼",
    dept: "الإدارة",
    kind: "colony",
    wiring: "passive",
    purpose: "مساعدو الحاكم الآلي موزّعون على الأمن والمحتوى والاقتصاد والمجتمع والعمليات.",
    module: "src/convex/aiGovernor.ts",
    consumes: "يعمل عبر الحاكم الآلي",
    defaultOn: false,
    caps: { perHour: 30, perDay: 240 },
    capabilities: ["orders", "writes"],
    stoppables: ["وقف قسم بعينه", "وقف كل المساعدين"],
  },
  {
    key: "colony_deputy_assistants",
    name: "عشرون مساعداً للنائب",
    emoji: "🕴️",
    dept: "المحرك",
    kind: "colony",
    wiring: "dormant",
    purpose: "مساعدو نائب المالك بصلاحيات تنفيذية: تعديل وحذف ووضع — ينفّذون أوامره مباشرة.",
    module: "src/convex/aiSuite.ts",
    consumes: "نداءات node + تنفيذ مباشر",
    defaultOn: false,
    caps: { perHour: 30, perDay: 240 },
    capabilities: ["orders", "writes", "punish", "economy"],
    stoppables: ["وقف المساعدين", "وقف الصلاحيات التنفيذية"],
    dormantReason: "يحتاج تفعيل نائب المالك (اتصال حيّ + مفتاح ذكاء) قبل أن يعمل",
  },
  {
    key: "colony_minds",
    name: "العقول الاثنا عشر الحيّة",
    emoji: "🌀",
    dept: "الوكلاء",
    kind: "colony",
    wiring: "wired",
    purpose: "اثنا عشر كائناً بشخصيات ومزاج وذاكرة تتلاشى، ومجالس تتحاور وتصعّد للمالك.",
    module: "src/convex/livingMinds.ts · aiCouncil.ts · aiCollective.ts",
    consumes: "كتابات ونداءات في نبضة الحياة",
    defaultOn: false,
    caps: { perHour: 2, perDay: 12 },
    capabilities: ["auto_run", "writes", "content", "orders"],
    stoppables: ["وقف العقول", "وقف المجالس", "وقف التصعيد للمالك"],
  },

  // ═══ الوحدات المدمجة (طبقات تُستدعى) ═══
  {
    key: "mod_brain",
    name: "عقل الوكلاء (صياغة الكلام)",
    emoji: "🗣️",
    dept: "الوكلاء",
    kind: "module",
    wiring: "passive",
    purpose: "شخصيات ونوايا ومحرّك تركيب جمل عربي يتجنّب التكرار — يعمل بلا أي مزوّد خارجي.",
    module: "src/convex/aiBrain.ts",
    consumes: "صفر شبكة (منطق محلي في الخادم)",
    defaultOn: true,
    caps: { perHour: 300, perDay: 3000 },
    capabilities: ["content", "orders"],
    stoppables: ["وقف الرد التلقائي في الغرف", "تقييد اللهجة"],
  },
  {
    key: "mod_cipher",
    name: "اللهجة المشفرة",
    emoji: "🔐",
    dept: "الوكلاء",
    kind: "module",
    wiring: "passive",
    purpose: "لغة سرية تتحدث بها العقول عند الأمور الحساسة — والمالك وحده يفكّها.",
    module: "src/convex/aiCipher.ts",
    consumes: "صفر شبكة",
    defaultOn: true,
    caps: { perHour: 0, perDay: 0 },
    capabilities: ["orders"],
    stoppables: ["منع اللهجة المشفرة", "كشفها تلقائياً للمالك"],
  },
  {
    key: "mod_voice",
    name: "صوت الوكلاء (اختياري)",
    emoji: "🎙️",
    dept: "الوكلاء",
    kind: "module",
    wiring: "dormant",
    purpose: "طبقة تحسين فوق العقل المدمج: إن وُجد مفتاح ذكاء تُصاغ الجمل بشخصية ومزاج وذاكرة.",
    module: "src/convex/aiVoice.ts",
    consumes: "نداء ذكاء لكل جملة عند التفعيل",
    defaultOn: false,
    caps: { perHour: 60, perDay: 400 },
    capabilities: ["content", "orders"],
    stoppables: ["الرجوع للعقل المجاني فقط"],
    dormantReason: "يحتاج مفتاح مزوّد ذكاء مضبوطاً في مركز API",
  },
  {
    key: "mod_memory",
    name: "حزمة الذاكرة والتقييم الذاتي",
    emoji: "💾",
    dept: "الذاكرة",
    kind: "module",
    wiring: "passive",
    purpose: "ذاكرة دائمة متعددة الأنواع + تقييم ذاتي بعد كل رد + اقتراحات تحسين.",
    module: "src/convex/aiEnhancements.ts · aiUpgradeKit.ts · aiCollective.ts",
    consumes: "كتابات ذاكرة مقيّدة",
    defaultOn: true,
    caps: { perHour: 200, perDay: 2000 },
    capabilities: ["writes", "orders"],
    stoppables: ["وقف حفظ الذكريات", "وقف التقييم الذاتي", "مسح الذاكرة الجماعية"],
  },
  {
    key: "mod_toolbelt",
    name: "صندوق الأدوات (بحث الويب)",
    emoji: "🧰",
    dept: "الأدوات",
    kind: "module",
    wiring: "passive",
    purpose: "مهام حقيقية للأعقاد: بحث ويب بلا مفتاح، جلب صفحات، تحليل، وحفظ في الذاكرة.",
    module: "src/convex/aiToolbelt.ts",
    consumes: "طلبات شبكة خارجية لكل مهمة",
    defaultOn: false,
    caps: { perHour: 20, perDay: 100 },
    capabilities: ["content", "writes", "orders"],
    stoppables: ["وقف البحث الخارجي", "وقف جلب الصفحات"],
  },
  {
    key: "mod_intelligence",
    name: "عقل التنبؤ بالمشاكل",
    emoji: "🔮",
    dept: "الصحة",
    kind: "module",
    wiring: "passive",
    purpose: "يتنبأ بالمشاكل قبل وقوعها من قراءة الاتجاهات الحقيقية.",
    module: "src/convex/aiIntelligence.ts",
    consumes: "قراءات تحليلية",
    defaultOn: true,
    caps: { perHour: 20, perDay: 120 },
    capabilities: ["orders", "self_heal"],
    stoppables: ["وقف التنبؤ"],
  },
  {
    key: "mod_fairplay",
    name: "طبقة اللعب النظيف",
    emoji: "🧭",
    dept: "الرقابي",
    kind: "module",
    wiring: "passive",
    purpose: "تصنّف الأحداث المشبوهة وتجمّعها في سجل موحّد للمراجعة.",
    module: "src/convex/fairPlay.ts",
    consumes: "كتابات سجل نظيف",
    defaultOn: true,
    caps: { perHour: 60, perDay: 600 },
    capabilities: ["punish", "writes"],
    stoppables: ["وقف رصد الشك", "وقف الملفات المشبوهة"],
  },
  {
    key: "mod_adaptive_rewards",
    name: "المكافآت التكيفية",
    emoji: "🔗",
    dept: "التوصيات",
    kind: "module",
    wiring: "passive",
    purpose: "تحسب مكافأة كل لاعب من عوامل مترابطة (تقدمه + نشاطه + مجموعته).",
    module: "src/convex/adaptiveRewards.ts",
    consumes: "حسابات + كتابة مكافآت",
    defaultOn: true,
    caps: { perHour: 120, perDay: 1200 },
    capabilities: ["economy", "writes"],
    stoppables: ["وقف المكافآت التكيفية"],
  },
  {
    key: "mod_mindhub",
    name: "ملتقى العقول",
    emoji: "🕸️",
    dept: "الذكاء",
    kind: "module",
    wiring: "dormant",
    purpose: "جلسات حوار بين العقول (غرفة الحرب / العقل الحر) تُدار عبر node.",
    module: "src/convex/mindHub.ts · mindHubStore.ts",
    consumes: "جلسات + نداءات",
    defaultOn: false,
    caps: { perHour: 10, perDay: 60 },
    capabilities: ["content", "orders"],
    stoppables: ["وقف جلسات الملتقى"],
    dormantReason: "لا نبضة مجدولة تربطه بعد — يُشغَّل يدوياً أو عند ربطه بنبضة",
  },

  // ═══ مستشارو العرش ═══
  {
    key: "advisor_crown",
    name: "مستشار العرش",
    emoji: "👑",
    dept: "القيادة",
    kind: "advisor",
    wiring: "wired",
    purpose: "يجيب العرش من البيانات الحيّة، ويمنحه نبضة ٣٦٠° وأوامر تنفيذ فورية.",
    module: "src/convex/crownDeck.ts · commandDeck.ts",
    consumes: "نداء ذكاء لكل سؤال + قراءات",
    defaultOn: true,
    caps: { perHour: 40, perDay: 300 },
    capabilities: ["orders", "writes", "self_heal"],
    stoppables: ["وقف إجابات المستشار", "وقف الأوامر الفورية"],
  },
  {
    key: "advisor_atlas",
    name: "أطلس اللعبة (٨٠ ميزة)",
    emoji: "🗺️",
    dept: "القيادة",
    kind: "advisor",
    wiring: "passive",
    purpose: "العقل التنفيذي للوحة التحكم: سجل الأنظمة العشرة و٨٠ ميزة تنفّذ فعلاً على قاعدة اللعبة.",
    module: "src/convex/atlas.ts",
    consumes: "قراءة/كتابة مباشرة على جداول اللعبة",
    defaultOn: true,
    caps: { perHour: 60, perDay: 400 },
    capabilities: ["writes", "economy", "punish", "orders"],
    stoppables: ["وقف تنفيذ ميزة بعينها", "وقف كل ميزات أطلس"],
  },
  {
    key: "advisor_sovereign_rule",
    name: "محرك المراسيم السيادية",
    emoji: "📜",
    dept: "السيادة",
    kind: "advisor",
    wiring: "passive",
    purpose: "المرسوم الفوري (XP/عملات/خصم/تخصص الأسبوع) ووضع الطوارئ — تنفيذ لحظي للجميع.",
    module: "src/convex/sovereign.ts",
    consumes: "كتابة مراسيم تُقرأ في كل حساب مكافأة",
    defaultOn: true,
    caps: { perHour: 20, perDay: 100 },
    capabilities: ["economy", "writes", "broadcast", "orders"],
    stoppables: ["وقف المراسيم", "وقف وضع الطوارئ"],
  },
];

export const AI_BY_KEY = new Map(AI_REGISTRY.map((e) => [e.key, e]));
export const AI_KEYS = AI_REGISTRY.map((e) => e.key);

export function aiEntry(key: string): AiEntry | null {
  return AI_BY_KEY.get(key) ?? null;
}

/** المهام المجدولة الموجودة فعلاً في سجل aiCron (لربط الغرفة بها) */
export const JOB_KEYS = AI_REGISTRY.filter((e) => e.jobKey).map((e) => e.key);

/**
 * كل ذكاء مرتبط بمهمة جدولة معيّنة. مهمة واحدة قد يتحكم بها أكثر من ذكاء
 * (مثال: حارس الدردشة والحاكم السيادي يشتركان في `chat_guardian`) — فيجب أن
 * يوافق الجميع قبل التنفيذ، وإلا توقّف.
 */
export function entriesForJob(jobKey: string): AiEntry[] {
  return AI_REGISTRY.filter((e) => e.jobKey === jobKey);
}

/** كل من له مسار تشغيل فوري من الغرفة */
export const RUNNABLE_KEYS = AI_REGISTRY.filter((e) => e.wiring === "wired").map((e) => e.key);

export function entriesByDept(): { dept: AiDept; entries: AiEntry[] }[] {
  const map = new Map<AiDept, AiEntry[]>();
  for (const e of AI_REGISTRY) {
    const list = map.get(e.dept) ?? [];
    list.push(e);
    map.set(e.dept, list);
  }
  return [...map.entries()].map(([dept, entries]) => ({ dept, entries }));
}

/** إحصاء صادق للسجل — يُعرض في رأس الغرفة */
export function censusStats() {
  const byWiring = { wired: 0, passive: 0, dormant: 0 } as Record<AiWiring, number>;
  const byKind = {} as Record<AiKind, number>;
  for (const e of AI_REGISTRY) {
    byWiring[e.wiring] += 1;
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
  return {
    total: AI_REGISTRY.length,
    byWiring,
    byKind,
    defaultOn: AI_REGISTRY.filter((e) => e.defaultOn).length,
    dormant: AI_REGISTRY.filter((e) => e.wiring === "dormant").map((e) => ({ key: e.key, name: e.name, reason: e.dormantReason ?? "" })),
  };
}

/**
 * 🪢 «حبل الرقبة» — تدقيق التغطية: هل بقي ذكاء واحد **خارج** الغرفة؟
 *
 * المالك طلب ألا يبقى ذكاء واحد خارج السيطرة، فالتدقيق يقارن سجل الغرفة
 * بكل مسارات التنفيذ الحقيقية في اللعبة:
 *   • كل مهمة جدولة في الموزّع يجب أن يكون لها مقعد هنا.
 *   • كل وحدة في مركز الذكاء الموحّد كذلك.
 *   • وكل رابط في السجل (jobKey/unitKey) يجب أن يقابل مساراً حقيقياً.
 * أي فرق = ذكاء يعمل بلا رقابة، أو رابط ميت يخدع الواجهة.
 */
export interface CoverageReport {
  total: number;
  registeredJobs: number;
  registeredUnits: number;
  realJobs: number;
  realUnits: number;
  unregisteredJobs: string[];
  unregisteredUnits: string[];
  deadJobLinks: string[];
  deadUnitLinks: string[];
  covered: boolean;
  hasDeadLinks: boolean;
}

export function coverageReport(jobKeys: readonly string[], unitKeys: readonly string[]): CoverageReport {
  const registeredJobs = new Set(AI_REGISTRY.map((e) => e.jobKey).filter((k): k is string => Boolean(k)));
  const registeredUnits = new Set(AI_REGISTRY.map((e) => e.unitKey).filter((k): k is string => Boolean(k)));
  const jobSet = new Set(jobKeys);
  const unitSet = new Set(unitKeys);

  const unregisteredJobs = jobKeys.filter((k) => !registeredJobs.has(k));
  const unregisteredUnits = unitKeys.filter((k) => !registeredUnits.has(k));
  const deadJobLinks = [...registeredJobs].filter((k) => !jobSet.has(k));
  const deadUnitLinks = [...registeredUnits].filter((k) => !unitSet.has(k));

  return {
    total: AI_REGISTRY.length,
    registeredJobs: registeredJobs.size,
    registeredUnits: registeredUnits.size,
    realJobs: jobKeys.length,
    realUnits: unitKeys.length,
    unregisteredJobs: [...unregisteredJobs],
    unregisteredUnits: [...unregisteredUnits],
    deadJobLinks,
    deadUnitLinks,
    covered: unregisteredJobs.length === 0 && unregisteredUnits.length === 0,
    hasDeadLinks: deadJobLinks.length + deadUnitLinks.length > 0,
  };
}

/** فهرس بحث عميق: كل كلمة في الاسم/الوصف/الوحدة/المفتاح تُطابَق */
export function searchAi(query: string): AiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...AI_REGISTRY];
  const terms = q.split(/\s+/).filter(Boolean);
  return AI_REGISTRY.filter((e) => {
    const haystack = [e.key, e.name, e.purpose, e.module, e.dept, e.kind, ...e.stoppables, ...e.capabilities]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/** وصف القدرة بالعربية — للعرض في الواجهة بصدق */
export const CAPABILITY_LABEL: Record<AiCapability, string> = {
  orders: "تنفيذ أوامر العرش",
  auto_run: "العمل الذاتي بلا أمر",
  writes: "الكتابة في قاعدة البيانات",
  punish: "فرض عقوبات",
  content: "توليد محتوى",
  economy: "المساس بالاقتصاد",
  broadcast: "إرسال إشعارات عامة",
  self_heal: "إصلاح ذاتي",
};
