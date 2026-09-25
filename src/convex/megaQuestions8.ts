import type { Question } from "./questions";

/** Questions q3041–q3080: balanced additions for logic, history, sports, arts, and technology. */
export const MEGA_PACK_8: Question[] = [
  // ── منطق ───────────────────────────────────────────────────────────────
  { id: "q3041", category: "منطق", difficulty: "easy", question: "ما العدد التالي: 3، 10، 17، 24، ...؟", options: ["29", "30", "31", "32"], correctIndex: 2 },
  { id: "q3042", category: "منطق", difficulty: "easy", question: "أي عدد يختلف عن البقية: 2، 4، 6، 9؟", options: ["2", "4", "6", "9"], correctIndex: 3 },
  { id: "q3043", category: "منطق", difficulty: "medium", question: "ما العدد التالي: 1، 1، 2، 3، 5، 8، ...؟", options: ["10", "11", "12", "13"], correctIndex: 3 },
  { id: "q3044", category: "منطق", difficulty: "medium", question: "إذا كانت كل أدمغة النوارير زرقاء، وكل زرقاء ضخمة، فماذا يلزم؟", options: ["كل النوارير ضخمة", "كل الزرقاء نوارير", "كل الضخمة زرقاء", "لا استنتاج"], correctIndex: 0 },
  { id: "q3045", category: "منطق", difficulty: "hard", question: "إذا كان P صحيحاً وQ خطأ، فما قيمة العبارة P أو Q؟", options: ["صحيح", "خطأ", "غير محددة", "تغير كل مرة"], correctIndex: 0 },
  { id: "q3046", category: "منطق", difficulty: "hard", question: "إذا كان إذا P فإن Q، وQ خطأ، فماذا يلزم عن P؟", options: ["P صحيح", "P خطأ", "P أو Q صحيح", "لا يلزم شيء"], correctIndex: 1 },
  { id: "q3047", category: "منطق", difficulty: "extreme", question: "الشخص الصادق يقول دائماً الحقيقة، والكاذب يكذب دائماً. A يقول B كاذب، وB يقول A صادق. ما النتيجة؟", options: ["A صادق وB كاذب", "A كاذب وB صادق", "كلاهما صادق", "لا ترتيب متسق"], correctIndex: 3 },
  { id: "q3048", category: "منطق", difficulty: "extreme", question: "P تتحقق في 60٪ من الحالات، وQ تتحقق في 40٪، وP تعني Q. ما الحد الأقصى لاحتمال تحققهما معاً؟", options: ["24٪", "30٪", "40٪", "60٪"], correctIndex: 2 },

  // ── تاريخ ──────────────────────────────────────────────────────────────
  { id: "q3049", category: "تاريخ", difficulty: "easy", question: "تأسست الأمم المتحدة في عام: 1945.", options: ["1919", "1945", "1939", "1955"], correctIndex: 1 },
  { id: "q3050", category: "تاريخ", difficulty: "easy", question: "هبط الإنسان على القمر لأول مرة في عام: 1969.", options: ["1965", "1969", "1972", "1961"], correctIndex: 1 },
  { id: "q3051", category: "تاريخ", difficulty: "medium", question: "وُقعت الماغنا كارتا أول مرة في عام: 1215.", options: ["1066", "1215", "1348", "1492"], correctIndex: 1 },
  { id: "q3052", category: "تاريخ", difficulty: "medium", question: "سقطت القسطنطينية بيد العثمانيين في عام: 1453.", options: ["1453", "1450", "1401", "1500"], correctIndex: 0 },
  { id: "q3053", category: "تاريخ", difficulty: "hard", question: "نشر إسحاق نيوتن كتاب المبادئ الذي يشرح قوانين الحركة والجذب عام: 1687.", options: ["1642", "1666", "1687", "1712"], correctIndex: 2 },
  { id: "q3054", category: "تاريخ", difficulty: "hard", question: "في أي عام وصل كريستوفر كولومبوس إلى أمريكا؟", options: ["1421", "1492", "1519", "1522"], correctIndex: 1 },
  { id: "q3055", category: "تاريخ", difficulty: "extreme", question: "في أي عام نشر نيكولاس كوبرنيكوس كتابه عن دوران الأجرام السماوية؟", options: ["1492", "1543", "1601", "1687"], correctIndex: 1 },
  { id: "q3056", category: "تاريخ", difficulty: "extreme", question: "أي معاهدة قسمت المناطق التي طالبت بها إسبانيا والبرتغال خارج أوروبا؟", options: ["معاهدة توردسيلاس", "معاهدة فيرساي", "معاهدة لوند", "معاهدة زيورخ"], correctIndex: 0 },

  // ── رياضة ──────────────────────────────────────────────────────────────
  { id: "q3057", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق كرة القدم داخل الملعب؟", options: ["9", "10", "11", "12"], correctIndex: 2 },
  { id: "q3058", category: "رياضة", difficulty: "easy", question: "كم عدد اللاعبين في فريق كرة السلة داخل الملعب؟", options: ["5", "6", "7", "11"], correctIndex: 0 },
  { id: "q3059", category: "رياضة", difficulty: "medium", question: "كم دقيقة يستغرق الشوط الأول من مباراة كرة القدم الرسمية؟", options: ["30", "40", "45", "60"], correctIndex: 2 },
  { id: "q3060", category: "رياضة", difficulty: "medium", question: "كم المسافة الرسمية لسباق الماراثون؟", options: ["40 كم", "42.195 كم", "45 كم", "50 كم"], correctIndex: 1 },
  { id: "q3061", category: "رياضة", difficulty: "hard", question: "أي دولة استضافت أولمبياد 1996؟", options: ["موسكو", "أتلانتا", "باريس", "سيدني"], correctIndex: 1 },
  { id: "q3062", category: "رياضة", difficulty: "hard", question: "متى تأسس الاتحاد الدولي لكرة القدم؟", options: ["1904", "1921", "1930", "1945"], correctIndex: 0 },
  { id: "q3063", category: "رياضة", difficulty: "extreme", question: "أي منتخب فاز بلقب كأس العالم في عام 2022؟", options: ["فرنسا", "الأرجنتين", "البرازيل", "ألمانيا"], correctIndex: 1 },
  { id: "q3064", category: "رياضة", difficulty: "extreme", question: "متى أُنشئ دوري أبطال أوروبا؟", options: ["1923", "1955", "1974", "1992"], correctIndex: 1 },

  // ── فنون ───────────────────────────────────────────────────────────────
  { id: "q3065", category: "فنون", difficulty: "easy", question: "من رسم لوحة الموناليزا؟", options: ["رافاييل", "ليوناردو دافنشي", "فان جوخ", "بيكاسو"], correctIndex: 1 },
  { id: "q3066", category: "فنون", difficulty: "easy", question: "من نحت تمثال المفكر؟", options: ["رودان", "برنيني", "دوناتيلو", "ميكل أنجلو"], correctIndex: 0 },
  { id: "q3067", category: "فنون", difficulty: "medium", question: "من رسم لوحة غرنيكا؟", options: ["بيكاسو", "دالي", "مونيه", "رودان"], correctIndex: 0 },
  { id: "q3068", category: "فنون", difficulty: "medium", question: "كم مفتاحاً في البيانو القياسي؟", options: ["76", "80", "88", "100"], correctIndex: 2 },
  { id: "q3069", category: "فنون", difficulty: "hard", question: "من ألّف موسيقى طقوس الربيع؟", options: ["إيغور سترافينسكي", "بيتهوفن", "بروكوف", "تشايكوفسكي"], correctIndex: 0 },
  { id: "q3070", category: "فنون", difficulty: "hard", question: "من رسم لوحة ثبات الذاكرة؟", options: ["سلفادور دالي", "بيكاسو", "مونيه", "كانفاس"], correctIndex: 0 },
  { id: "q3071", category: "فنون", difficulty: "extreme", question: "من رسم سلسلة لوحات الموجة العظيمة؟", options: ["هوكوساي", "إيسو تاكرا", "مارك شاغر", "تانوما"], correctIndex: 0 },
  { id: "q3072", category: "فنون", difficulty: "extreme", question: "من رسم الرجل الفيتروفي؟", options: ["ليوناردو دافنشي", "مايكل أنجلو", "رافاييل", "دوناتيلو"], correctIndex: 0 },

  // ── تكنولوجيا ──────────────────────────────────────────────────────────
  { id: "q3073", category: "تكنولوجيا", difficulty: "easy", question: "كم قيمة البت في النظام الثنائي؟", options: ["0 و1", "1 و2", "0 و2", "2 و4"], correctIndex: 0 },
  { id: "q3074", category: "تكنولوجيا", difficulty: "easy", question: "ماذا يعني HTML؟", options: ["لغة ترميز النصوص التشعبية", "لغة برمجة", "نظام تشغيل", "قاعدة بيانات"], correctIndex: 0 },
  { id: "q3075", category: "تكنولوجيا", difficulty: "medium", question: "ما وظيفة نظام DNS الأساسية؟", options: ["ترجمة أسماء النطاقات إلى عناوين", "ضغط الصور", "تشغيل الألعاب", "إدارة الطابعات"], correctIndex: 0 },
  { id: "q3076", category: "تكنولوجيا", difficulty: "medium", question: "ما التعقيد الزمني للبحث الثنائي في قائمة مرتبة؟", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], correctIndex: 1 },
  { id: "q3077", category: "تكنولوجيا", difficulty: "hard", question: "في RAID 1، ما وظيفة النسخ المتطابق؟", options: ["توزيع البيانات على أقراص", "نسخ نسخة طبق الأصل", "توزيع البيانات على شرائط", "تشفير القرص"], correctIndex: 1 },
  { id: "q3078", category: "تكنولوجيا", difficulty: "hard", question: "ماذا يضمن HTTPS بخلاف HTTP؟", options: ["سرعة أعلى دائماً", "تشفير الاتصال", "ملفات أكبر", "إخفاء اسم الموقع دائماً"], correctIndex: 1 },
  { id: "q3079", category: "تكنولوجيا", difficulty: "extreme", question: "كم بت في عنوان IPv6 القياسي؟", options: ["32", "64", "128", "256"], correctIndex: 2 },
  { id: "q3080", category: "تكنولوجيا", difficulty: "extreme", question: "ما اسم المسألة التي لا يمكن لأي برنامج عام حلها لكل الحالات؟", options: ["مسألة التوقف", "مشكلة بائع المسافر", "P vs NP", "Turing complete"], correctIndex: 0 },
];
