// ═══════════════════════════════════════════════════════════════════════
// ║ 50 ميزة قوية — قائمة شاملة موزعة على مجالات اللعبة ║
// ═══════════════════════════════════════════════════════════════════════

export interface Feature {
  id: string;
  name: string;
  description: string;
  category: FeatureCategory;
  enabled: boolean;
  icon: string;
  tier?: "bronze" | "silver" | "gold" | "diamond" | "exclusive";
}

export type FeatureCategory =
  | "gameplay"
  | "social"
  | "progression"
  | "economy"
  | "customization"
  | "events"
  | "analytics"
  | "ai"
  | "quality";

// ─── 10 ميزات اللعب والتحديات ──────────────────────────────────────
export const GAMEPLAY_FEATURES: Feature[] = [
  { id: "f01", name: "تحدي اليوم", description: "تحدي ذكاء يومي فريد لكل لاعب", category: "gameplay", enabled: true, icon: "📅" },
  { id: "f02", name: "تحدي 1v1", description: "تحدي مباشر لاعب ضد لاعب", category: "gameplay", enabled: true, icon: "⚔️" },
  { id: "f03", name: "منقّي الإجابات 50/50", description: "إزالة خيارين خاطئين", category: "gameplay", enabled: true, icon: "🎯" },
  { id: "f04", name: "فرصة ثانية", description: "إعادة محاولة السؤال بعد خطأ", category: "gameplay", enabled: true, icon: "🔄" },
  { id: "f05", name: "السؤال الذهبي", description: "سؤال أخير بنقاط مضاعفة", category: "gameplay", enabled: true, icon: "✨" },
  { id: "f06", name: "borneo streak مكافأة", description: "مكافأة لسلسلة الإجابات الصحيحة", category: "gameplay", enabled: true, icon: "🔥" },
  { id: "f07", name: "أول دم", description: "مكافأة من يُجب على السؤال أولاً", category: "gameplay", enabled: true, icon: "🥇" },
  { id: "f08", name: "وضع البطاقات", description: "تحدي سريع ب30 ثانية لكل سؤال", category: "gameplay", enabled: true, icon: "⚡" },
  { id: "f09", name: "تحدي المجموع", description: "إجابة على 10 أسئلة في دقيقة واحدة", category: "gameplay", enabled: true, icon: "🎯" },
  { id: "f10", name: "ombineo المغامرة", description: "سلسلة أسئلة متصلة بقصة", category: "gameplay", enabled: true, icon: "📖" },
];

// ─── 10 ميزات اجتماعية ─────────────────────────────────────────────
export const SOCIAL_FEATURES: Feature[] = [
  { id: "f11", name: "غرف الدردشة", description: "دردشة حية مع لاعبين آخرين", category: "social", enabled: true, icon: "💬" },
  { id: "f12", name: "نظام الإشعارات", description: "إشعارات فورية للأحداث المهمة", category: "social", enabled: true, icon: "🔔" },
  { id: "f13", name: "نظام البلاغات", description: "الإبلاغ عن لاعبين مخالفين", category: "social", enabled: true, icon: "⚠️" },
  { id: "f14", name: "نظام الدعوات", description: "ادعو أصدقاء واحصل على مكافآت", category: "social", enabled: true, icon: "📨" },
  { id: "f15", name: "نظام السمعة", description: "تقييم اللاعبين من الأقران", category: "social", enabled: true, icon: "⭐" },
  { id: "f16", name: "ردود الفعل", description: "إيموجي تفاعلي في غرف اللعب", category: "social", enabled: true, icon: "😊" },
  { id: "f17", name: "الأهداف الجماعية", description: "تحدي جماعي لجميع اللاعبين", category: "social", enabled: true, icon: "🎯" },
  { id: "f18", name: "نظام الهدايا", description: "أرسل هدايا و XP للأصدقاء", category: "social", enabled: true, icon: "🎁" },
  { id: "f19", name: "المتصدر العام", description: "ترتيب اللاعبين الأكثر نشاطاً", category: "social", enabled: true, icon: "🏆" },
  { id: "f20", name: "غرف خاصة بالأعضاء", description: "غرف دردشة حصرية حسب العضوية", category: "social", enabled: true, icon: "🔒" },
];

// ─── 10 ميزات التقدم والإنجازات ────────────────────────────────────
export const PROGRESSION_FEATURES: Feature[] = [
  { id: "f21", name: "نظام المستوى", description: "مستويات تصاعدية بمكافآت", category: "progression", enabled: true, icon: "📊" },
  { id: "f22", name: "الإنجازات", description: "shanrات وألقاب قابلة للفتح", category: "progression", enabled: true, icon: "🏅" },
  { id: "f23", name: "الملف الشخصي", description: "عرض إحصائياتك وإنجازاتك", category: "progression", enabled: true, icon: "👤" },
  { id: "f24", name: "سجل الأسئلة", description: "أرشيف أسئلة عُرضت عليك", category: "progression", enabled: true, icon: "📚" },
  { id: "f25", name: "ال streak اليومي", description: "مكافأة لكل يوم تلعب فيه", category: "progression", enabled: true, icon: "🔥" },
  { id: "f26", name: "سمات الشخصية", description: "اختر إيموجي مميز لملفك", category: "progression", enabled: true, icon: "🎭" },
  { id: "f27", name: "المفضلة", description: "احفظ أسئلتك المفضلة", category: "progression", enabled: true, icon: "❤️" },
  { id: "f28", name: "تحليل الذكاء", description: "تحليل AI لأدائك وتقدمك", category: "progression", enabled: true, icon: "🧠" },
  { id: "f29", name: "المقارنة", description: "قارن أداءك بأصدقائك", category: "progression", enabled: true, icon: "📈" },
  { id: "f30", name: "أبطال الأسبوع", description: "أفضل اللاعبين كل أسبوع", category: "progression", enabled: true, icon: "👑" },
];

// ─── 10 ميزات اقتصادية ─────────────────────────────────────────────
export const ECONOMY_FEATURES: Feature[] = [
  { id: "f31", name: "نظام العضويات", description: "5 مستويات ب.special مميزات", category: "economy", enabled: true, icon: "💎" },
  { id: "f32", name: "نظام الهدايا", description: "أرسل واستلم هدايا رقمية", category: "economy", enabled: true, icon: "🎁" },
  { id: "f33", name: "المكافآت اليومية", description: "XP مجاناً كل يوم", category: "economy", enabled: true, icon: "📅" },
  { id: "f34", name: "multiplier مضاعفات", description: "نقاط مضاعفة في أوقات محددة", category: "economy", enabled: true, icon: "✖️" },
  { id: "f35", name: "السوق", description: "تبادل وشراء مكافآت رقمية", category: "economy", enabled: true, icon: "🏪" },
  { id: "f36", name: "نقاط الولاء", description: "اكسب نقاط مع كل نشاط", category: "economy", enabled: true, icon: "💳" },
  { id: "f37", name: "الأكواد الترويجية", description: "أكواد خصم ومكافآت خاصة", category: "economy", enabled: true, icon: "🎟️" },
  { id: "f38", name: "السحب اليومي", description: " Chance للحصول على مكافأة عشوائية", category: "economy", enabled: true, icon: "🎰" },
  { id: "f39", name: "مكافأة الإنجاز", description: "XP إضافي عند فتح إنجاز", category: "economy", enabled: true, icon: "🏆" },
  { id: "f40", name: "ال season pass", description: "ممر موسمي بمكافآت حصرية", category: "economy", enabled: true, icon: "🎫" },
];

// ─── 10 ميزات إضافية ──────────────────────────────────────────────
export const EXTRA_FEATURES: Feature[] = [
  { id: "f41", name: "صياد الأخطاء التلقائي", description: "اكتشاف وإصلاح الأخطاء تلقائياً", category: "quality", enabled: true, icon: "🐛" },
  { id: "f42", name: "وضع الصيانة", description: "إيقاف مؤقت للنظام للصيانة", category: "quality", enabled: true, icon: "🔧" },
  { id: "f43", name: "النسخ الاحتياطي", description: "نسخ احتياطي تلقائي للبيانات", category: "quality", enabled: true, icon: "💾" },
  { id: "f44", name: "AI Coach شخصي", description: "مدرب ذكاء اصطناعي خاص بك", category: "ai", enabled: true, icon: "🤖" },
  { id: "f45", name: "المطابقة الذكية", description: " tìm对手 بنفس مستواك", category: "gameplay", enabled: true, icon: "🎯" },
  { id: "f46", name: "تنبؤ المشاكل", description: "اكتشاف المشاكل قبل حدوثها", category: "ai", enabled: true, icon: "🔮" },
  { id: "f47", name: "تقييم AI الذاتي", description: "تقييم أداء أنظمة الذكاء", category: "ai", enabled: true, icon: "📊" },
  { id: "f48", name: "الأوامر المتقدمة", description: "نظام أوامر متكامل للمالك", category: "ai", enabled: true, icon: "⌨️" },
  { id: "f49", name: "ربط تيليجرام", description: "تحكم عن بُعد عبر تيليجرام", category: "ai", enabled: true, icon: "📱" },
  { id: "f50", name: "Reduce Motion", description: "تقليل الحركات للمستخدمين", category: "quality", enabled: true, icon: "♿" },
];

// ─── 30 ميزات متقدمة جديدة (المرحلة الثانية) ─────────────────────────
export const ADVANCED_FEATURES: Feature[] = [
  { id: "f51", name: "جناح AI موسّع", description: "30 نظام AI حرة تعتمد على API وتفكر بشكل كامل", category: "ai", enabled: true, icon: "🧠" },
  { id: "f52", name: "محلل الأداء الاستراتيجي", description: "تحليل استراتيجي شامل لبيانات اللعبة", category: "ai", enabled: true, icon: "📊" },
  { id: "f53", name: "خبير الأمن السيبراني", description: "فحص الثغرات واقتراح الإصلاحات أونلاين", category: "ai", enabled: true, icon: "🛡️" },
  { id: "f54", name: "مولّد المحتوى الإبداعي", description: "كتابة نصوص وإعلانات وأوصاف تلقائياً", category: "ai", enabled: true, icon: "✍️" },
  { id: "f55", name: "محلل سلوك اللاعبين", description: "رصد الأنماط غير الطبيعية والغش", category: "ai", enabled: true, icon: "🕵️" },
  { id: "f56", name: "مستشار الاقتصاد", description: "موازنة المتجر والعملات والعروض", category: "ai", enabled: true, icon: "💰" },
  { id: "f57", name: "مخطط الأحداث", description: "تخطيط مواسم وأحداث وجدولة ذكية", category: "ai", enabled: true, icon: "🗓️" },
  { id: "f58", name: "مسؤول المجتمع", description: "صياغة قوانين وردود رسمية للبلاغات", category: "ai", enabled: true, icon: "🤝" },
  { id: "f59", name: "مدقق الأسئلة الذكي", description: "مراجعة دقة أسئلة بنك اللعبة آلياً", category: "ai", enabled: true, icon: "✅" },
  { id: "f60", name: "مترجم المحتوى", description: "ترجمة المحتوى لغات متعددة بجودة عالية", category: "ai", enabled: true, icon: "🌍" },
  { id: "f61", name: "محلل المشاعر", description: "تحليل مزاج المجتمع من الدردشة والبلاغات", category: "ai", enabled: true, icon: "❤️‍🔥" },
  { id: "f62", name: "مصمم الألعاب المصغرة", description: "اقتراح ألعاب وأنماط تحديات جديدة", category: "ai", enabled: true, icon: "🎮" },
  { id: "f63", name: "محلل الاحتفاظ", description: "توقّع هجر اللاعبين وخطط استرجاعهم", category: "ai", enabled: true, icon: "📉" },
  { id: "f64", name: "مدرب اللاعبين", description: "نصائح شخصية لتحسين أداء كل لاعب", category: "ai", enabled: true, icon: "🏋️" },
  { id: "f65", name: "مراقب السيرفرات", description: "تشخيص بطء الأداء ومشاكل الاتصال", category: "ai", enabled: true, icon: "🖥️" },
  { id: "f66", name: "مولّد التحديات اليومية", description: "تحدي يومي فريد مولّد بالذكاء الاصطناعي", category: "gameplay", enabled: true, icon: "📅" },
  { id: "f67", name: "نظام الألقاب الذكية", description: "ألقاب ديناميكية تتغير حسب الأداء", category: "progression", enabled: true, icon: "🎖️" },
  { id: "f68", name: "لوحة قيادة قابلة للتخصيص", description: "رتب أدوات المالك بترتيبك المفضل", category: "analytics", enabled: true, icon: "🧩" },
  { id: "f69", name: "تنبيهات ذكية مرتبة", description: "تنبيهات ملونة حسب الخطورة مع أولوية ذكية", category: "quality", enabled: true, icon: "🚨" },
  { id: "f70", name: "تقارير قابلة للتصدير", description: "تصدير CSV/JSON لأي بيانات في النظام", category: "analytics", enabled: true, icon: "📄" },
  { id: "f71", name: "سجل تدقيق كامل", description: "أرشيف مفصّل لكل إجراء مالك أو مشرف", category: "analytics", enabled: true, icon: "🧾" },
  { id: "f72", name: "وضع الطوارئ الفوري", description: "إيقاف شامل للعبة بضغطة واحدة", category: "quality", enabled: true, icon: "🆘" },
  { id: "f73", name: "البحث الموحّد", description: "بحث واحد في كل بيانات النظام دفعة واحدة", category: "analytics", enabled: true, icon: "🔎" },
  { id: "f74", name: "إجراءات جماعية سريعة", description: "حدّد عدة لاعبين ونفّذ أمراً واحداً", category: "quality", enabled: true, icon: "⚡" },
  { id: "f75", name: "جدولة العروض الموسمية", description: "عروض متجر تُفعّل وتُنهى تلقائياً", category: "economy", enabled: true, icon: "🏷️" },
  { id: "f76", name: "حماية الحسابات", description: "رصد محاولات الاختراق والحسابات المشبوهة", category: "social", enabled: true, icon: "🔐" },
  { id: "f77", name: "ملخصات المالك الذكية", description: "ملخص يومي ذكي لحالة كل الأنظمة", category: "ai", enabled: true, icon: "📬" },
  { id: "f78", name: "محرك الأفكار الحر", description: "AI حر بدون قيود لأي مهمة أو سؤال", category: "ai", enabled: true, icon: "🕊️" },
  { id: "f79", name: "التعلم من قرارات المالك", description: "الأنظمة تتحسن من قراراتك السابقة", category: "ai", enabled: true, icon: "📚" },
  { id: "f80", name: "الربط الهجين API", description: "كل أنظمة AI تعمل عبر OpenRouter API مجاناً", category: "ai", enabled: true, icon: "🔗" },
];

export const ALL_FEATURES: Feature[] = [
  ...GAMEPLAY_FEATURES,
  ...SOCIAL_FEATURES,
  ...PROGRESSION_FEATURES,
  ...ECONOMY_FEATURES,
  ...EXTRA_FEATURES,
  ...ADVANCED_FEATURES,
];

export const FEATURE_CATEGORIES: { key: FeatureCategory; label: string; icon: string }[] = [
  { key: "gameplay", label: "اللعب والتحديات", icon: "🎮" },
  { key: "social", label: "المجتمع والتفاعل", icon: "👥" },
  { key: "progression", label: "التقدم والإنجازات", icon: "📈" },
  { key: "economy", label: "الاقتصاد والمكافآت", icon: "💰" },
  { key: "ai", label: "أنظمة الذكاء الاصطناعي", icon: "🤖" },
  { key: "quality", label: "جودة النظام", icon: "⚙️" },
  { key: "analytics", label: "التحليلات والتقارير", icon: "📊" },
];
