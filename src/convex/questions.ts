/**
 * The shared question bank used by every challenge.
 * Each round picks a random subset, so friends never play the same questions twice.
 * Questions carry a difficulty level that scales the points on offer.
 */

export type Difficulty = "easy" | "medium" | "hard";

export type Question = {
  id: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

/** All available categories, used by the room setup filters. */
export const CATEGORIES = [
  "عام",
  "علوم",
  "جغرافيا",
  "رياضيات",
  "لغة",
  "منطق",
  "تاريخ",
  "رياضة",
  "فنون",
  "تكنولوجيا",
  "أفلام ومسلسلات",
  "طعام ومشروبات",
  "حيوانات",
  "فضاء",
  "موسيقى",
  "دين وثقافة",
  "جسم الإنسان",
  "منوعات",
] as const;

export const QUESTION_BANK: Question[] = [
  // ── عام ───────────────────────────────────────────────────────────────
  { id: "q01", category: "عام", difficulty: "easy", question: "ما هو أكبر محيط على وجه الأرض؟", options: ["المحيط الهادئ", "المحيط الأطلسي", "المحيط الهندي", "المحيط المتجمد الشمالي"], correctIndex: 0 },
  { id: "q02", category: "عام", difficulty: "easy", question: "كم عدد ألوان قوس قزح؟", options: ["ستة", "سبعة", "خمسة", "ثمانية"], correctIndex: 1 },
  { id: "q03", category: "عام", difficulty: "easy", question: "ما هو الحيوان الملقَّب بـ«سفينة الصحراء»؟", options: ["الحصان", "الفيل", "الجمل", "الحمار"], correctIndex: 2 },
  { id: "q04", category: "عام", difficulty: "easy", question: "ما هي العملة الرسمية في اليابان؟", options: ["اليوان", "الين", "الوون", "الدرهم"], correctIndex: 1 },
  { id: "q05", category: "عام", difficulty: "easy", question: "ما هو اللون الناتج عن خلط الأزرق مع الأصفر؟", options: ["الأخضر", "البنفسجي", "البرتقالي", "البني"], correctIndex: 0 },
  { id: "q06", category: "عام", difficulty: "easy", question: "كم عدد أيام السنة الكبيسة؟", options: ["365", "366", "364", "360"], correctIndex: 1 },
  { id: "q07", category: "عام", difficulty: "medium", question: "ما هو أكبر عضو في جسم الإنسان؟", options: ["الجلد", "الكبد", "الدماغ", "الرئتان"], correctIndex: 0 },

  // ── علوم ──────────────────────────────────────────────────────────────
  { id: "q08", category: "علوم", difficulty: "easy", question: "ما هو الكوكب الأقرب إلى الشمس؟", options: ["الزهرة", "المريخ", "الأرض", "عطارد"], correctIndex: 3 },
  { id: "q09", category: "علوم", difficulty: "medium", question: "ما هو الغاز الذي تمتصّه النباتات من الجو أثناء التمثيل الضوئي؟", options: ["الأكسجين", "ثاني أكسيد الكربون", "النيتروجين", "الهيدروجين"], correctIndex: 1 },
  { id: "q10", category: "علوم", difficulty: "medium", question: "كم عدد عظام جسم الإنسان البالغ تقريباً؟", options: ["306", "266", "206", "106"], correctIndex: 2 },
  { id: "q11", category: "علوم", difficulty: "easy", question: "ما هو العنصر الكيميائي الذي رمزه O؟", options: ["الذهب", "الهيدروجين", "الأوزون", "الأكسجين"], correctIndex: 3 },
  { id: "q12", category: "علوم", difficulty: "medium", question: "ما هو أسرع حيوان بري في العالم؟", options: ["النمر", "الغزال", "الفهد", "الحصان"], correctIndex: 2 },
  { id: "q121", category: "علوم", difficulty: "easy", question: "ما هو مصدر الطاقة الرئيسي للأرض؟", options: ["القمر", "الشمس", "الرياح", "النفط"], correctIndex: 1 },
  { id: "q122", category: "علوم", difficulty: "easy", question: "كم درجة مئوية هي درجة غليان الماء؟", options: ["50", "90", "100", "110"], correctIndex: 2 },
  { id: "q123", category: "علوم", difficulty: "medium", question: "ما هو الغاز الأكثر وفرة في الغلاف الجوي؟", options: ["الأكسجين", "النيتروجين", "ثاني أكسيد الكربون", "الهيدروجين"], correctIndex: 1 },
  { id: "q124", category: "علوم", difficulty: "medium", question: "ما هو الرمز الكيميائي للذهب؟", options: ["Go", "Au", "Ag", "Gd"], correctIndex: 1 },
  { id: "q125", category: "علوم", difficulty: "medium", question: "ما هي وحدة قياس القوة؟", options: ["نيوتن", "جول", "واط", "باسكال"], correctIndex: 0 },
  { id: "q126", category: "علوم", difficulty: "medium", question: "ما هو الكوكب الملقَّب بـ«توأم الأرض»؟", options: ["الزهرة", "المريخ", "عطارد", "نبتون"], correctIndex: 0 },

  // ── جغرافيا ───────────────────────────────────────────────────────────
  { id: "q13", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة اليابان؟", options: ["أوساكا", "طوكيو", "كيوتو", "هيروشيما"], correctIndex: 1 },
  { id: "q14", category: "جغرافيا", difficulty: "medium", question: "ما هي أكبر دولة عربية من حيث المساحة؟", options: ["السعودية", "السودان", "مصر", "الجزائر"], correctIndex: 3 },
  { id: "q15", category: "جغرافيا", difficulty: "easy", question: "ما هو أطول نهر في أفريقيا؟", options: ["الكونغو", "النيجر", "النيل", "زامبيزي"], correctIndex: 2 },
  { id: "q16", category: "جغرافيا", difficulty: "medium", question: "ما هي أصغر قارة في العالم؟", options: ["أوروبا", "القارة القطبية الجنوبية", "أستراليا", "أمريكا الجنوبية"], correctIndex: 2 },
  { id: "q17", category: "جغرافيا", difficulty: "medium", question: "أي دولة عربية تُلقَّب بـ«بلد المليون شهيد»؟", options: ["تونس", "المغرب", "ليبيا", "الجزائر"], correctIndex: 3 },
  { id: "q116", category: "جغرافيا", difficulty: "easy", question: "ما هي أعلى قمة جبلية في العالم؟", options: ["إيفرست", "كيليمانجارو", "مون بلان", "إلبروس"], correctIndex: 0 },
  { id: "q117", category: "جغرافيا", difficulty: "easy", question: "ما هو أكبر صحراء حارة في العالم؟", options: ["الصحراء الكبرى", "صحراء الربع الخالي", "صحراء غوبي", "صحراء كلهاري"], correctIndex: 0 },
  { id: "q118", category: "جغرافيا", difficulty: "easy", question: "كم عدد قارات العالم؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q119", category: "جغرافيا", difficulty: "medium", question: "ما هو أعمق محيط في العالم؟", options: ["الهادئ", "الأطلسي", "الهندي", "المتجمد"], correctIndex: 0 },
  { id: "q120", category: "جغرافيا", difficulty: "medium", question: "ما هي الدولة العربية الأكبر سكاناً؟", options: ["مصر", "السعودية", "العراق", "الجزائر"], correctIndex: 0 },

  // ── رياضيات ───────────────────────────────────────────────────────────
  { id: "q18", category: "رياضيات", difficulty: "easy", question: "كم يساوي 7 × 8؟", options: ["54", "64", "56", "48"], correctIndex: 2 },
  { id: "q19", category: "رياضيات", difficulty: "hard", question: "ما هو ناتج 9 + 9 ÷ 3؟", options: ["18", "6", "12", "15"], correctIndex: 2 },
  { id: "q20", category: "رياضيات", difficulty: "easy", question: "ما هو العدد الذي إذا ضربته في نفسه كان الناتج 144؟", options: ["12", "14", "11", "16"], correctIndex: 0 },
  { id: "q21", category: "رياضيات", difficulty: "hard", question: "ما هو نصف رُبع العدد 400؟", options: ["100", "200", "25", "50"], correctIndex: 3 },
  { id: "q22", category: "رياضيات", difficulty: "easy", question: "إذا كانت الساعة 60 دقيقة، فكم دقيقة في ساعة ونصف؟", options: ["90", "75", "100", "80"], correctIndex: 0 },
  { id: "q132", category: "رياضيات", difficulty: "easy", question: "ما اسم المثلث الذي جميع أضلاعه متساوية؟", options: ["متساوي الأضلاع", "متساوي الساقين", "قائم الزاوية", "مختلف الأضلاع"], correctIndex: 0 },

  // ── لغة ───────────────────────────────────────────────────────────────
  { id: "q23", category: "لغة", difficulty: "easy", question: "ما هو جمع كلمة «كتاب»؟", options: ["كتائب", "كتب", "أكتب", "كتابات"], correctIndex: 1 },
  { id: "q24", category: "لغة", difficulty: "easy", question: "ما هو مفرد كلمة «أقلام»؟", options: ["قلام", "قلم", "قلّم", "أقلم"], correctIndex: 1 },
  { id: "q25", category: "لغة", difficulty: "medium", question: "كم عدد حروف اللغة العربية؟", options: ["26", "30", "28", "29"], correctIndex: 2 },
  { id: "q26", category: "لغة", difficulty: "easy", question: "ما هو عكس كلمة «الهدوء»؟", options: ["السكينة", "الطمأنينة", "الضجيج", "الراحة"], correctIndex: 2 },
  { id: "q129", category: "لغة", difficulty: "easy", question: "كم عدد حروف اللغة الإنجليزية؟", options: ["24", "25", "26", "27"], correctIndex: 2 },

  // ── منطق ──────────────────────────────────────────────────────────────
  { id: "q27", category: "منطق", difficulty: "easy", question: "ما هو العدد التالي في المتتالية: 2، 4، 8، 16، …؟", options: ["24", "30", "32", "64"], correctIndex: 2 },
  { id: "q28", category: "منطق", difficulty: "hard", question: "لديك 3 تفاحات وأخذت اثنتين، كم تفاحة أصبحت معك؟", options: ["3", "1", "2", "5"], correctIndex: 2 },
  { id: "q29", category: "منطق", difficulty: "medium", question: "إذا كان اليوم هو الثلاثاء، فما هو اليوم بعد غدٍ؟", options: ["الأربعاء", "الخميس", "الجمعة", "الاثنين"], correctIndex: 1 },
  { id: "q30", category: "منطق", difficulty: "easy", question: "ما هو الرقم الذي يلي 99 مباشرةً عند العدّ التنازلي؟", options: ["98", "97", "100", "89"], correctIndex: 0 },

  // ── تاريخ ─────────────────────────────────────────────────────────────
  { id: "q31", category: "تاريخ", difficulty: "easy", question: "في أي عام انتهت الحرب العالمية الثانية؟", options: ["1939", "1945", "1943", "1918"], correctIndex: 1 },
  { id: "q32", category: "تاريخ", difficulty: "easy", question: "من هو أول إنسان سافر إلى الفضاء؟", options: ["نيل أرمسترونغ", "باز ألدرين", "فالنتينا تيريشكوفا", "يوري غاغارين"], correctIndex: 3 },
  { id: "q33", category: "تاريخ", difficulty: "medium", question: "في أي مدينة أقيمت دورة الألعاب الأولمبية عام 2024؟", options: ["طوكيو", "لندن", "باريس", "لوس أنجلوس"], correctIndex: 2 },
  { id: "q110", category: "تاريخ", difficulty: "medium", question: "من هو القائد الذي فتح القسطنطينية؟", options: ["صلاح الدين", "محمد الفاتح", "هارون الرشيد", "خالد بن الوليد"], correctIndex: 1 },
  { id: "q111", category: "تاريخ", difficulty: "easy", question: "ما هي الحضارة التي بنت الأهرامات؟", options: ["الرومانية", "الفرعونية", "البابلية", "الفينيقية"], correctIndex: 1 },
  { id: "q112", category: "تاريخ", difficulty: "easy", question: "في أي عام بدأت الحرب العالمية الأولى؟", options: ["1914", "1918", "1939", "1905"], correctIndex: 0 },
  { id: "q113", category: "تاريخ", difficulty: "easy", question: "من هو القائد الأشهر في معركة حطين؟", options: ["صلاح الدين الأيوبي", "قطز", "الظاهر بيبرس", "طارق بن زياد"], correctIndex: 0 },
  { id: "q114", category: "تاريخ", difficulty: "easy", question: "ما هي الدولة التي بنت سور الصين العظيم؟", options: ["اليابان", "الصين", "كوريا", "منغوليا"], correctIndex: 1 },
  { id: "q115", category: "تاريخ", difficulty: "medium", question: "من هو أول خليفة للمسلمين بعد النبي محمد ﷺ؟", options: ["أبو بكر الصديق", "عمر بن الخطاب", "عثمان بن عفان", "علي بن أبي طالب"], correctIndex: 0 },

  // ── رياضة ─────────────────────────────────────────────────────────────
  { id: "q34", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق كرة القدم داخل الملعب؟", options: ["10", "12", "9", "11"], correctIndex: 3 },
  { id: "q35", category: "رياضة", difficulty: "medium", question: "ما هي الرياضة التي يمارسها «نوفاك ديوكوفيتش»؟", options: ["السباحة", "التنس", "الغولف", "كرة السلة"], correctIndex: 1 },
  { id: "q103", category: "رياضة", difficulty: "easy", question: "كم عدد أشواط مباراة كرة القدم (دون وقت إضافي)؟", options: ["شوط واحد", "شوطان", "ثلاثة", "أربعة"], correctIndex: 1 },
  { id: "q104", category: "رياضة", difficulty: "medium", question: "ما هي الدولة الفائزة بكأس العالم 2022؟", options: ["فرنسا", "الأرجنتين", "البرازيل", "ألمانيا"], correctIndex: 1 },
  { id: "q105", category: "رياضة", difficulty: "easy", question: "ما هي اللعبة التي تُلعب بمضرب وكرة صغيرة على طاولة؟", options: ["التنس", "تنس الطاولة", "الاسكواش", "الريشة الطائرة"], correctIndex: 1 },
  { id: "q106", category: "رياضة", difficulty: "easy", question: "كم عدد اللاعبين في فريق كرة السلة داخل الملعب؟", options: ["5", "6", "7", "11"], correctIndex: 0 },
  { id: "q107", category: "رياضة", difficulty: "medium", question: "ما هي الرياضة التي تُعرف بـ«لعبة الملوك»؟", options: ["الشطرنج", "الجولف", "البولو", "التنس"], correctIndex: 0 },
  { id: "q108", category: "رياضة", difficulty: "medium", question: "في أي مدينة أقيمت أولمبياد 2016؟", options: ["لندن", "ريو دي جانيرو", "طوكيو", "بكين"], correctIndex: 1 },
  { id: "q109", category: "رياضة", difficulty: "medium", question: "من هو اللاعب الذي سجّل هدف «يد الله» الشهير؟", options: ["بيليه", "مارادونا", "ميسي", "رونالدو"], correctIndex: 1 },

  // ── فنون ──────────────────────────────────────────────────────────────
  { id: "q36", category: "فنون", difficulty: "easy", question: "من هو الرسام الشهير الذي رسم «الموناليزا»؟", options: ["فان جوخ", "بيكاسو", "ليوناردو دافنشي", "ريمبرانت"], correctIndex: 2 },
  { id: "q37", category: "فنون", difficulty: "medium", question: "كم عدد أوتار آلة الكمان؟", options: ["6", "4", "5", "7"], correctIndex: 1 },

  // ── تكنولوجيا ─────────────────────────────────────────────────────────
  { id: "q38", category: "تكنولوجيا", difficulty: "easy", question: "من هو المؤسس المشارك الأبرز لشركة أبل؟", options: ["ستيف جوبز", "بيل غيتس", "إيلون ماسك", "مارك زوكربيرغ"], correctIndex: 0 },
  { id: "q39", category: "تكنولوجيا", difficulty: "easy", question: "ما هو أشهر محرك بحث على الإنترنت؟", options: ["جوجل", "بينغ", "ياهو", "داك داك غو"], correctIndex: 0 },
  { id: "q40", category: "تكنولوجيا", difficulty: "medium", question: "ماذا يعني الاختصار HTML؟", options: ["لغة ترميز النصوص التشعبية", "بروتوكول نقل الملفات", "لغة برمجة عالية المستوى", "نظام تشغيل"], correctIndex: 0 },
  { id: "q41", category: "تكنولوجيا", difficulty: "easy", question: "ما هو نظام التشغيل المثبت على أجهزة آيفون؟", options: ["أندرويد", "iOS", "ويندوز", "لينكس"], correctIndex: 1 },
  { id: "q42", category: "تكنولوجيا", difficulty: "easy", question: "من هو مؤسس شركة مايكروسوفت؟", options: ["ستيف جوبز", "بيل غيتس", "جيف بيزوس", "لاري بيج"], correctIndex: 1 },
  { id: "q43", category: "تكنولوجيا", difficulty: "easy", question: "ما هي العملة الرقمية الأكثر شهرة؟", options: ["إيثيريوم", "بيتكوين", "دوجكوين", "لايتكوين"], correctIndex: 1 },
  { id: "q44", category: "تكنولوجيا", difficulty: "medium", question: "ما هو الاسم الشهير لروبوت الدردشة الذي طوّرته OpenAI؟", options: ["سيري", "أليكسا", "ChatGPT", "جيميني"], correctIndex: 2 },
  { id: "q45", category: "تكنولوجيا", difficulty: "hard", question: "في أي عام أُطلقت أول شبكة إنترنت حديثة (ARPANET)؟", options: ["1955", "1969", "1981", "1995"], correctIndex: 1 },
  { id: "q46", category: "تكنولوجيا", difficulty: "easy", question: "ما هي أكبر منصة تواصل اجتماعي من حيث عدد المستخدمين؟", options: ["تويتر", "إنستغرام", "فيسبوك", "تيك توك"], correctIndex: 2 },
  { id: "q47", category: "تكنولوجيا", difficulty: "hard", question: "ما اسم أول هاتف آيفون أطلقته أبل؟", options: ["آيفون 3G", "آيفون 2G", "آيفون 4", "آيفون 5"], correctIndex: 1 },

  // ── أفلام ومسلسلات ────────────────────────────────────────────────────
  { id: "q48", category: "أفلام ومسلسلات", difficulty: "easy", question: "من هو الممثل الذي يؤدي شخصية «آيرون مان»؟", options: ["كريس إيفانز", "روبرت داوني جونيور", "كريس هيمسوورث", "توم هولاند"], correctIndex: 1 },
  { id: "q49", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مخرج فيلم «تايتانيك»؟", options: ["جيمس كاميرون", "ستيفن سبيلبرغ", "كريستوفر نولان", "كوينتن تارانتينو"], correctIndex: 0 },
  { id: "q50", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو الفيلم الذي فاز بجائزة الأوسكار لأفضل فيلم عام 2024؟", options: ["أوبنهايمر", "باربي", "قتلة زهرة القمر", "مايسترو"], correctIndex: 0 },
  { id: "q51", category: "أفلام ومسلسلات", difficulty: "easy", question: "من يؤدي شخصية «سبايدرمان» في أفلام مارفل الأخيرة؟", options: ["توبي ماغواير", "أندرو غارفيلد", "توم هولاند", "جايك جيلينهال"], correctIndex: 2 },
  { id: "q52", category: "أفلام ومسلسلات", difficulty: "easy", question: "ما هو الحيوان الذي يجسّد شخصية «سيمبا» في فيلم الأسد الملك؟", options: ["فيل", "أسد", "نمر", "زرافة"], correctIndex: 1 },
  { id: "q53", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مخرج فيلم «إنترستلار»؟", options: ["كريستوفر نولان", "جيمس كاميرون", "ريدلي سكوت", "دينيس فيلنوف"], correctIndex: 0 },
  { id: "q54", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو بطل مسلسل «بريكنغ باد»؟", options: ["برايان كرانستون", "جون هام", "برايان كوكس", "كيفن سبيسي"], correctIndex: 0 },
  { id: "q55", category: "أفلام ومسلسلات", difficulty: "easy", question: "في فيلم «فروزن»، ما اسم الملكة التي تملك قوى الجليد؟", options: ["آنا", "إلسا", "أولاف", "سفن"], correctIndex: 1 },
  { id: "q56", category: "أفلام ومسلسلات", difficulty: "easy", question: "من هو بطل سلسلة أفلام «المهمة المستحيلة»؟", options: ["توم كروز", "مات ديمون", "براد بيت", "ليوناردو دي كابريو"], correctIndex: 0 },

  // ── طعام ومشروبات ─────────────────────────────────────────────────────
  { id: "q57", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو المكوّن الرئيسي للحمص؟", options: ["العدس", "الحمص", "الفول", "الفاصوليا"], correctIndex: 1 },
  { id: "q58", category: "طعام ومشروبات", difficulty: "easy", question: "من أين يأتي العسل؟", options: ["النحل", "النمل", "الدبابير", "الفراشات"], correctIndex: 0 },
  { id: "q59", category: "طعام ومشروبات", difficulty: "hard", question: "ما هي الفاكهة المعروفة بـ«ملكة الفواكه» في جنوب شرق آسيا؟", options: ["المانجو", "الدوريان", "الجاك فروت", "الأناناس"], correctIndex: 1 },
  { id: "q60", category: "طعام ومشروبات", difficulty: "medium", question: "ما هي الدولة المشهورة بصناعة الشوكولاتة الفاخرة؟", options: ["فرنسا", "سويسرا", "إيطاليا", "بلجيكا"], correctIndex: 1 },
  { id: "q61", category: "طعام ومشروبات", difficulty: "easy", question: "مما يُصنع الخبز عادةً؟", options: ["الأرز", "القمح", "الذرة", "الشعير"], correctIndex: 1 },
  { id: "q62", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو المشروب الأكثر استهلاكاً في العالم بعد الماء؟", options: ["القهوة", "الشاي", "العصير", "الحليب"], correctIndex: 1 },
  { id: "q63", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو الطبق الإيطالي المصنوع من الأرز؟", options: ["الريزوتو", "الباستا", "اللازانيا", "الغنوتشي"], correctIndex: 0 },
  { id: "q64", category: "طعام ومشروبات", difficulty: "easy", question: "مما يُصنع الجبن؟", options: ["الحليب", "البيض", "الزبدة", "الكريمة"], correctIndex: 0 },
  { id: "q65", category: "طعام ومشروبات", difficulty: "hard", question: "ما هو البهار الملقَّب بـ«الذهب الأحمر»؟", options: ["الزعفران", "الكركم", "الفلفل", "القرفة"], correctIndex: 0 },

  // ── حيوانات ───────────────────────────────────────────────────────────
  { id: "q66", category: "حيوانات", difficulty: "easy", question: "ما هو أكبر حيوان على وجه الأرض؟", options: ["الفيل الأفريقي", "الحوت الأزرق", "الزرافة", "القرش الأبيض"], correctIndex: 1 },
  { id: "q67", category: "حيوانات", difficulty: "easy", question: "كم عدد أرجل العنكبوت؟", options: ["6", "8", "10", "12"], correctIndex: 1 },
  { id: "q68", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي ينام واقفاً؟", options: ["القط", "الحصان", "الدب", "الثعلب"], correctIndex: 1 },
  { id: "q69", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الوحيد الذي لا يستطيع القفز؟", options: ["الحصان", "الفيل", "الغزال", "الكنغر"], correctIndex: 1 },
  { id: "q70", category: "حيوانات", difficulty: "easy", question: "ما هو أكبر طائر لا يطير؟", options: ["البطريق", "النعامة", "الديك الرومي", "الكيوي"], correctIndex: 1 },
  { id: "q71", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان صاحب أطول رقبة؟", options: ["الزرافة", "الجمل", "الفيل", "الحصان"], correctIndex: 0 },
  { id: "q72", category: "حيوانات", difficulty: "easy", question: "ما اسم صغير الأسد؟", options: ["الشبل", "الجرو", "المهر", "الجدي"], correctIndex: 0 },
  { id: "q73", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الذي يعيش في الصحراء ويستطيع البقاء أسابيع دون ماء؟", options: ["الجمل", "الفيل", "الحصان", "البقرة"], correctIndex: 0 },
  { id: "q74", category: "حيوانات", difficulty: "medium", question: "ما هو أسرع طائر في العالم؟", options: ["النسر", "الصقر الشاهين", "البومة", "اللقلق"], correctIndex: 1 },
  { id: "q75", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الملقَّب بـ«ملك الغابة»؟", options: ["النمر", "الأسد", "الفيل", "الذئب"], correctIndex: 1 },

  // ── فضاء ──────────────────────────────────────────────────────────────
  { id: "q76", category: "فضاء", difficulty: "easy", question: "ما هو أقرب نجم إلى الأرض؟", options: ["الشمس", "القمر", "سيريوس", "بروكسيما سنتوري"], correctIndex: 0 },
  { id: "q77", category: "فضاء", difficulty: "easy", question: "كم عدد كواكب المجموعة الشمسية؟", options: ["7", "8", "9", "10"], correctIndex: 1 },
  { id: "q78", category: "فضاء", difficulty: "easy", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["المشتري", "زحل", "نبتون", "الأرض"], correctIndex: 0 },
  { id: "q79", category: "فضاء", difficulty: "easy", question: "في أي عام هبط الإنسان على القمر لأول مرة؟", options: ["1965", "1969", "1972", "1961"], correctIndex: 1 },
  { id: "q80", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الملقَّب بـ«الكوكب الأحمر»؟", options: ["المريخ", "الزهرة", "عطارد", "المشتري"], correctIndex: 0 },
  { id: "q81", category: "فضاء", difficulty: "easy", question: "ما هو الجرم السماوي الذي يدور حول الأرض؟", options: ["الشمس", "القمر", "المريخ", "المذنب"], correctIndex: 1 },
  { id: "q82", category: "فضاء", difficulty: "medium", question: "ما اسم المجرة التي نعيش فيها؟", options: ["أندروميدا", "درب التبانة", "سحابة ماجلان", "الدوامة"], correctIndex: 1 },
  { id: "q83", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الذي يتميز بحلقات واضحة حوله؟", options: ["زحل", "المشتري", "المريخ", "نبتون"], correctIndex: 0 },
  { id: "q84", category: "فضاء", difficulty: "medium", question: "ما هو أقرب كوكب إلى الأرض؟", options: ["الزهرة", "المريخ", "عطارد", "المشتري"], correctIndex: 0 },
  { id: "q85", category: "فضاء", difficulty: "hard", question: "ما اسم أول قمر صناعي أُطلق إلى الفضاء؟", options: ["أبولو 11", "سبوتنيك 1", "فوياجر", "هابل"], correctIndex: 1 },

  // ── موسيقى ────────────────────────────────────────────────────────────
  { id: "q86", category: "موسيقى", difficulty: "medium", question: "كم عدد النوتات الموسيقية الأساسية؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q87", category: "موسيقى", difficulty: "easy", question: "ما هي الآلة الموسيقية المكوّنة من 88 مفتاحاً؟", options: ["البيانو", "الأورغن", "الأكورديون", "الجيتار"], correctIndex: 0 },
  { id: "q88", category: "موسيقى", difficulty: "easy", question: "من هو المغني الملقَّب بـ«ملك البوب»؟", options: ["مايكل جاكسون", "إلفيس بريسلي", "فريد ميركوري", "برنس"], correctIndex: 0 },
  { id: "q89", category: "موسيقى", difficulty: "easy", question: "ما هي الآلة الوترية التي تُعزف بالقوس؟", options: ["الجيتار", "الكمان", "العود", "القانون"], correctIndex: 1 },
  { id: "q90", category: "موسيقى", difficulty: "medium", question: "ما هي آلة النفخ المصنوعة من النحاس؟", options: ["الترومبيت", "الفلوت", "الساكسفون", "الكلارينيت"], correctIndex: 0 },

  // ── دين وثقافة ────────────────────────────────────────────────────────
  { id: "q91", category: "دين وثقافة", difficulty: "easy", question: "كم عدد أركان الإسلام؟", options: ["3", "4", "5", "6"], correctIndex: 2 },
  { id: "q92", category: "دين وثقافة", difficulty: "easy", question: "ما هو الشهر الذي يصوم فيه المسلمون؟", options: ["رمضان", "شوال", "محرم", "ذو الحجة"], correctIndex: 0 },
  { id: "q93", category: "دين وثقافة", difficulty: "medium", question: "كم عدد سور القرآن الكريم؟", options: ["110", "112", "114", "116"], correctIndex: 2 },
  { id: "q94", category: "دين وثقافة", difficulty: "easy", question: "ما هي القبلة التي يتجه إليها المسلمون في الصلاة؟", options: ["المسجد الأقصى", "الكعبة المشرفة", "المسجد النبوي", "جبل عرفات"], correctIndex: 1 },
  { id: "q95", category: "دين وثقافة", difficulty: "easy", question: "ما هو أول أركان الإسلام؟", options: ["الشهادتان", "الصلاة", "الزكاة", "الحج"], correctIndex: 0 },
  { id: "q96", category: "دين وثقافة", difficulty: "easy", question: "في أي مدينة وُلد النبي محمد ﷺ؟", options: ["مكة المكرمة", "المدينة المنورة", "الطائف", "القدس"], correctIndex: 0 },
  { id: "q128", category: "دين وثقافة", difficulty: "medium", question: "ما هي أطول سورة في القرآن الكريم؟", options: ["البقرة", "آل عمران", "النساء", "الأعراف"], correctIndex: 0 },

  // ── جسم الإنسان ───────────────────────────────────────────────────────
  { id: "q97", category: "جسم الإنسان", difficulty: "medium", question: "كم عدد أسنان الإنسان البالغ؟", options: ["28", "30", "32", "36"], correctIndex: 2 },
  { id: "q98", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو المسؤول عن ضخ الدم؟", options: ["القلب", "الكبد", "الدماغ", "الرئتان"], correctIndex: 0 },
  { id: "q99", category: "جسم الإنسان", difficulty: "hard", question: "كم عدد أزواج الكروموسومات عند الإنسان؟", options: ["21", "22", "23", "24"], correctIndex: 2 },
  { id: "q100", category: "جسم الإنسان", difficulty: "medium", question: "كم عدد حجرات القلب؟", options: ["2", "3", "4", "5"], correctIndex: 2 },
  { id: "q101", category: "جسم الإنسان", difficulty: "easy", question: "ما هي المادة التي تشكّل معظم جسم الإنسان؟", options: ["البروتين", "الماء", "الدهون", "الكالسيوم"], correctIndex: 1 },
  { id: "q102", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو المسؤول عن التفكير؟", options: ["الدماغ", "القلب", "الكبد", "العينان"], correctIndex: 0 },

  // ── منوعات ────────────────────────────────────────────────────────────
  { id: "q127", category: "منوعات", difficulty: "easy", question: "ما هو اللون الناتج عن خلط الأحمر مع الأبيض؟", options: ["البرتقالي", "الوردي", "البنفسجي", "الرمادي"], correctIndex: 1 },
  { id: "q130", category: "منوعات", difficulty: "easy", question: "ما هو الشهر الذي يأتي بعد يناير؟", options: ["فبراير", "مارس", "ديسمبر", "نوفمبر"], correctIndex: 0 },
  { id: "q131", category: "منوعات", difficulty: "easy", question: "ما هي العملة الرسمية للمملكة العربية السعودية؟", options: ["الريال", "الدينار", "الدرهم", "الجنيه"], correctIndex: 0 },
  { id: "q133", category: "منوعات", difficulty: "easy", question: "كم عدد أيام شهر فبراير في السنة الكبيسة؟", options: ["28", "29", "30", "31"], correctIndex: 1 },

  // ── النسخة النهائية: 100 سؤال جديد (q134 – q233) ──────────────────────

  // ── عام ───────────────────────────────────────────────────────────────
  { id: "q134", category: "عام", difficulty: "easy", question: "ما هو أطول نهر في العالم؟", options: ["الميسيسيبي", "النيل", "اليانغتسي", "الأمازون"], correctIndex: 1 },
  { id: "q135", category: "عام", difficulty: "easy", question: "ما هي عاصمة فرنسا؟", options: ["روما", "مدريد", "لندن", "باريس"], correctIndex: 3 },
  { id: "q136", category: "عام", difficulty: "easy", question: "ما هي عاصمة مصر؟", options: ["القاهرة", "الجيزة", "الأقصر", "الإسكندرية"], correctIndex: 0 },
  { id: "q137", category: "عام", difficulty: "easy", question: "كم عدد أضلاع المثلث؟", options: ["5", "6", "3", "4"], correctIndex: 2 },
  { id: "q138", category: "عام", difficulty: "medium", question: "ما هو المعدن السائل في درجة حرارة الغرفة؟", options: ["الذهب", "الألمنيوم", "الزئبق", "الحديد"], correctIndex: 2 },
  { id: "q139", category: "عام", difficulty: "medium", question: "ما هو أكبر حيوان بري على وجه الأرض؟", options: ["وحيد القرن", "فرس النهر", "الدب البني", "الفيل الأفريقي"], correctIndex: 3 },

  // ── علوم ──────────────────────────────────────────────────────────────
  { id: "q140", category: "علوم", difficulty: "easy", question: "ما هو العنصر الكيميائي الذي رمزه H؟", options: ["الهيدروجين", "الأكسجين", "الكربون", "الهيليوم"], correctIndex: 0 },
  { id: "q141", category: "علوم", difficulty: "easy", question: "كم عدد حواس الإنسان الأساسية؟", options: ["7", "5", "4", "6"], correctIndex: 1 },
  { id: "q142", category: "علوم", difficulty: "medium", question: "ما هي أصغر وحدة بنائية في الكائن الحي؟", options: ["الخلية", "الذرة", "النسيج", "العضو"], correctIndex: 0 },
  { id: "q143", category: "علوم", difficulty: "medium", question: "ما هي سرعة الضوء تقريباً؟", options: ["300 ألف كيلومتر في الثانية", "150 ألف كيلومتر في الثانية", "3 ملايين كيلومتر في الثانية", "30 ألف كيلومتر في الثانية"], correctIndex: 0 },
  { id: "q144", category: "علوم", difficulty: "hard", question: "ما هو العنصر الأكثر وفرة في الكون؟", options: ["الكربون", "الهيدروجين", "الأكسجين", "النيتروجين"], correctIndex: 1 },
  { id: "q145", category: "علوم", difficulty: "hard", question: "ما اسم العملية التي تحوّل الغذاء إلى طاقة داخل الخلايا؟", options: ["النتح", "التنفس الخلوي", "التخمر", "التمثيل الضوئي"], correctIndex: 1 },

  // ── جغرافيا ───────────────────────────────────────────────────────────
  { id: "q146", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة إيطاليا؟", options: ["روما", "ميلانو", "نابولي", "فلورنسا"], correctIndex: 0 },
  { id: "q147", category: "جغرافيا", difficulty: "easy", question: "في أي قارة تقع مصر؟", options: ["أوروبا", "آسيا", "أمريكا الجنوبية", "أفريقيا"], correctIndex: 3 },
  { id: "q148", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة أستراليا؟", options: ["سيدني", "ملبورن", "بريزبن", "كانبرا"], correctIndex: 3 },
  { id: "q149", category: "جغرافيا", difficulty: "medium", question: "ما هي أكبر بحيرة في العالم من حيث المساحة؟", options: ["بحيرة فيكتوريا", "بحر قزوين", "بحيرة بايكال", "بحيرة تنجانيقا"], correctIndex: 1 },
  { id: "q150", category: "جغرافيا", difficulty: "medium", question: "ما هي الدولة التي يشبه شكلها الحذاء؟", options: ["اليونان", "البرتغال", "إيطاليا", "إسبانيا"], correctIndex: 2 },
  { id: "q151", category: "جغرافيا", difficulty: "hard", question: "ما هي أطول سلسلة جبال في العالم؟", options: ["جبال الألب", "جبال روكي", "جبال الهيمالايا", "جبال الأنديز"], correctIndex: 3 },

  // ── رياضيات ───────────────────────────────────────────────────────────
  { id: "q152", category: "رياضيات", difficulty: "easy", question: "كم يساوي 12 × 3؟", options: ["32", "36", "34", "38"], correctIndex: 1 },
  { id: "q153", category: "رياضيات", difficulty: "easy", question: "ما هو العدد الزوجي من بين الأعداد التالية؟", options: ["31", "7", "24", "13"], correctIndex: 2 },
  { id: "q154", category: "رياضيات", difficulty: "medium", question: "كم يساوي 25% من 200؟", options: ["75", "25", "50", "40"], correctIndex: 2 },
  { id: "q155", category: "رياضيات", difficulty: "medium", question: "ما هو الجذر التربيعي للعدد 81؟", options: ["11", "7", "8", "9"], correctIndex: 3 },
  { id: "q156", category: "رياضيات", difficulty: "medium", question: "كم عدد الدقائق في اليوم الواحد؟", options: ["1200", "1680", "1440", "1500"], correctIndex: 2 },
  { id: "q157", category: "رياضيات", difficulty: "hard", question: "كم يساوي (4 + 6) × 3؟", options: ["24", "36", "22", "30"], correctIndex: 3 },

  // ── لغة ───────────────────────────────────────────────────────────────
  { id: "q158", category: "لغة", difficulty: "easy", question: "ما هو مفرد كلمة «معلمون»؟", options: ["معلمة", "معلم", "معلمات", "تعليم"], correctIndex: 1 },
  { id: "q159", category: "لغة", difficulty: "easy", question: "ما هو جمع كلمة «بنت»؟", options: ["أبناء", "بنتات", "بنيات", "بنات"], correctIndex: 3 },
  { id: "q160", category: "لغة", difficulty: "easy", question: "ما هو حرف الجر في جملة «ذهبتُ إلى المدرسة»؟", options: ["ذهبت", "المدرسة", "إلى", "تُ"], correctIndex: 2 },
  { id: "q161", category: "لغة", difficulty: "medium", question: "كم عدد حروف المد في اللغة العربية؟", options: ["أربعة", "حرفان", "خمسة", "ثلاثة"], correctIndex: 3 },
  { id: "q162", category: "لغة", difficulty: "medium", question: "ما هي الكلمة الصحيحة إملائياً؟", options: ["إنشاء الله", "ان شاء الله", "إن شاء الله", "إنشاءُ الله"], correctIndex: 2 },
  { id: "q163", category: "لغة", difficulty: "hard", question: "ما هو المصدر من الفعل «علّم»؟", options: ["معلم", "تعلّم", "معلومة", "تعليم"], correctIndex: 3 },

  // ── منطق ──────────────────────────────────────────────────────────────
  { id: "q164", category: "منطق", difficulty: "easy", question: "أكمل المتتالية: 2، 4، 6، 8، …؟", options: ["10", "9", "12", "14"], correctIndex: 0 },
  { id: "q165", category: "منطق", difficulty: "easy", question: "ما هو الشيء الذي له أسنان ولا يعضّ؟", options: ["السكين", "المشط", "المنشار", "القفل"], correctIndex: 1 },
  { id: "q166", category: "منطق", difficulty: "medium", question: "في سباق، تجاوزتَ صاحبَ المركز الثاني، فما مركزك الآن؟", options: ["الثالث", "الأول", "الأخير", "الثاني"], correctIndex: 3 },
  { id: "q167", category: "منطق", difficulty: "medium", question: "قطار كهربائي يسير من الشرق إلى الغرب، أين يتجه دخانه؟", options: ["الشرق", "لا يصدر دخاناً", "الغرب", "الشمال"], correctIndex: 1 },
  { id: "q168", category: "منطق", difficulty: "medium", question: "أكمل المتتالية: 1، 1، 2، 3، 5، 8، …؟", options: ["12", "11", "13", "14"], correctIndex: 2 },
  { id: "q169", category: "منطق", difficulty: "hard", question: "لديك 8 عملات متطابقة وإحداها أخف وزناً، كم وزنًا تحتاج بميزان كفتين لتجدها؟", options: ["أربع وزنات", "ثلاث وزنات", "وزنة واحدة", "وزنتان"], correctIndex: 3 },

  // ── تاريخ ─────────────────────────────────────────────────────────────
  { id: "q170", category: "تاريخ", difficulty: "easy", question: "من هو مؤسس الدولة السعودية الحديثة؟", options: ["الملك عبد العزيز آل سعود", "الملك فيصل", "الملك سعود", "الملك خالد"], correctIndex: 0 },
  { id: "q171", category: "تاريخ", difficulty: "easy", question: "من هو القائد المسلم الذي فتح الأندلس؟", options: ["طارق بن زياد", "خالد بن الوليد", "صلاح الدين الأيوبي", "محمد الفاتح"], correctIndex: 0 },
  { id: "q172", category: "تاريخ", difficulty: "easy", question: "على أي دولة أُلقيت أول قنبلة ذرية في التاريخ؟", options: ["اليابان", "ألمانيا", "إيطاليا", "روسيا"], correctIndex: 0 },
  { id: "q173", category: "تاريخ", difficulty: "medium", question: "من هو مؤلف كتاب «المقدمة» الشهير؟", options: ["ابن رشد", "ابن خلدون", "الجاحظ", "الفارابي"], correctIndex: 1 },
  { id: "q174", category: "تاريخ", difficulty: "medium", question: "ما هي أول عاصمة للدولة الإسلامية بعد الهجرة؟", options: ["القدس", "مكة المكرمة", "دمشق", "المدينة المنورة"], correctIndex: 3 },
  { id: "q175", category: "تاريخ", difficulty: "medium", question: "ما هي الحضارة التي اخترعت الكتابة المسمارية؟", options: ["الإغريقية", "الرومانية", "الفرعونية", "السومرية"], correctIndex: 3 },

  // ── رياضة ─────────────────────────────────────────────────────────────
  { id: "q176", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق الكرة الطائرة داخل الملعب؟", options: ["6", "5", "7", "8"], correctIndex: 0 },
  { id: "q177", category: "رياضة", difficulty: "easy", question: "كم عدد الحكام الأساسيين داخل ملعب كرة القدم؟", options: ["أربعة", "حكم واحد", "حكمان", "ثلاثة"], correctIndex: 1 },
  { id: "q178", category: "رياضة", difficulty: "easy", question: "ما هي الرياضة الوطنية في اليابان؟", options: ["السومو", "الجودو", "الكاراتيه", "الكيندو"], correctIndex: 0 },
  { id: "q179", category: "رياضة", difficulty: "medium", question: "ما هي الدولة الفائزة بكأس العالم 2018؟", options: ["فرنسا", "ألمانيا", "البرازيل", "إسبانيا"], correctIndex: 0 },
  { id: "q180", category: "رياضة", difficulty: "medium", question: "في أي مدينة أقيمت أولمبياد 2020؟", options: ["لندن", "طوكيو", "باريس", "ريو دي جانيرو"], correctIndex: 1 },
  { id: "q181", category: "رياضة", difficulty: "hard", question: "من هو الهداف التاريخي لكأس العالم؟", options: ["رونالدو البرازيلي", "ليونيل ميسي", "ميروسلاف كلوزه", "بيليه"], correctIndex: 2 },

  // ── فنون ──────────────────────────────────────────────────────────────
  { id: "q182", category: "فنون", difficulty: "easy", question: "من هو الرسام الذي قطع جزءاً من أذنه؟", options: ["بيكاسو", "فان جوخ", "مونيه", "سلفادور دالي"], correctIndex: 1 },
  { id: "q183", category: "فنون", difficulty: "easy", question: "ما هو المتحف الباريسي الذي يضم لوحة «الموناليزا»؟", options: ["أورسيه", "بومبيدو", "اللوفر", "متروبوليتان"], correctIndex: 2 },
  { id: "q184", category: "فنون", difficulty: "medium", question: "من هو الفنان الذي رسم لوحة «الصرخة»؟", options: ["فان جوخ", "بيكاسو", "سلفادور دالي", "إدوارد مونك"], correctIndex: 3 },
  { id: "q185", category: "فنون", difficulty: "medium", question: "من أي مادة نُحت تمثال «ديفيد» لمايكل أنجلو؟", options: ["البرونز", "الخشب", "الرخام", "الجرانيت"], correctIndex: 2 },
  { id: "q186", category: "فنون", difficulty: "hard", question: "كم عدد المفاتيح السوداء في البيانو؟", options: ["40", "30", "52", "36"], correctIndex: 3 },

  // ── تكنولوجيا ─────────────────────────────────────────────────────────
  { id: "q187", category: "تكنولوجيا", difficulty: "easy", question: "ما هو نظام التشغيل الأشهر للحواسيب الشخصية؟", options: ["ويندوز", "أندرويد", "iOS", "لينكس"], correctIndex: 0 },
  { id: "q188", category: "تكنولوجيا", difficulty: "easy", question: "ماذا يعني الاختصار CPU؟", options: ["كرت الشاشة", "اللوحة الأم", "وحدة الذاكرة العشوائية", "وحدة المعالجة المركزية"], correctIndex: 3 },
  { id: "q189", category: "تكنولوجيا", difficulty: "easy", question: "ما هو المتصفح الذي طوّرته جوجل؟", options: ["سفاري", "كروم", "فايرفوكس", "إيدج"], correctIndex: 1 },
  { id: "q190", category: "تكنولوجيا", difficulty: "medium", question: "من هو مؤسس فيسبوك؟", options: ["جاك دورسي", "بيل غيتس", "إيلون ماسك", "مارك زوكربيرغ"], correctIndex: 3 },
  { id: "q191", category: "تكنولوجيا", difficulty: "medium", question: "ماذا يعني الاختصار WWW؟", options: ["متصفح إنترنت", "الشبكة العنكبوتية العالمية", "بروتوكول نقل الملفات", "نظام تشغيل"], correctIndex: 1 },
  { id: "q192", category: "تكنولوجيا", difficulty: "hard", question: "ما اسم أول معالج أنتجته شركة إنتل عام 1971؟", options: ["بنتيوم", "إنتل 4004", "إنتل 8086", "كور i3"], correctIndex: 1 },

  // ── أفلام ومسلسلات ────────────────────────────────────────────────────
  { id: "q193", category: "أفلام ومسلسلات", difficulty: "easy", question: "من هو الممثل الذي لعب دور «جون ويك»؟", options: ["كيانو ريفز", "جيسون ستاثام", "توم كروز", "ليام نيسون"], correctIndex: 0 },
  { id: "q194", category: "أفلام ومسلسلات", difficulty: "easy", question: "في فيلم «شريك»، ما اسم صديق شريك الحمار؟", options: ["دونكي", "فيونا", "لورد فاركواد", "بينوكيو"], correctIndex: 0 },
  { id: "q195", category: "أفلام ومسلسلات", difficulty: "easy", question: "في سلسلة «هاري بوتر»، ما اسم مدرسة السحر؟", options: ["دورمسترانغ", "بيوباتون", "هوغوورتس", "أكاديمية كايام"], correctIndex: 2 },
  { id: "q196", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مخرج فيلم «أفاتار»؟", options: ["جيمس كاميرون", "كريستوفر نولان", "ستيفن سبيلبرغ", "ريدلي سكوت"], correctIndex: 0 },
  { id: "q197", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو بطل فيلم «غلاديتور»؟", options: ["هيو جاكمان", "براد بيت", "ميل غيبسون", "راسل كرو"], correctIndex: 3 },
  { id: "q198", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هي الممثلة التي لعبت دور «هيرميون» في هاري بوتر؟", options: ["إيما واتسون", "كيرا نايتلي", "آن هاثاواي", "إيما ستون"], correctIndex: 0 },

  // ── طعام ومشروبات ─────────────────────────────────────────────────────
  { id: "q199", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو المشروب المصنوع من حبوب البن؟", options: ["القهوة", "الشاي", "العصير", "الحليب"], correctIndex: 0 },
  { id: "q200", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو الطبق الإيطالي المصنوع من العجين؟", options: ["الباستا", "السوشي", "الكسكس", "التاكو"], correctIndex: 0 },
  { id: "q201", category: "طعام ومشروبات", difficulty: "medium", question: "مما يُصنع التوفو؟", options: ["فول الصويا", "الحليب", "الأرز", "العدس"], correctIndex: 0 },
  { id: "q202", category: "طعام ومشروبات", difficulty: "medium", question: "ما هي الدولة الأولى عالمياً في إنتاج التمور؟", options: ["السعودية", "مصر", "العراق", "تونس"], correctIndex: 0 },
  { id: "q203", category: "طعام ومشروبات", difficulty: "medium", question: "ما اسم الخبز الفرنسي الطويل والرفيع؟", options: ["البانيتون", "الباغيت", "الكرواسون", "البريوش"], correctIndex: 1 },

  // ── حيوانات ───────────────────────────────────────────────────────────
  { id: "q204", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الملقَّب بـ«صديق الإنسان»؟", options: ["الكلب", "القط", "الحصان", "الببغاء"], correctIndex: 0 },
  { id: "q205", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الذي يخزّن الطعام في خدّيه؟", options: ["الهامستر", "الأرنب", "السنجاب", "الفأر"], correctIndex: 0 },
  { id: "q206", category: "حيوانات", difficulty: "easy", question: "ما هو الطائر الذي يقلّد كلام الإنسان؟", options: ["الببغاء", "العصفور", "الحمام", "النسر"], correctIndex: 0 },
  { id: "q207", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي يغيّر لون جلده للتمويه؟", options: ["الحرباء", "الضفدع", "الأفعى", "السحلية"], correctIndex: 0 },
  { id: "q208", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي ينام وعيناه مفتوحتان؟", options: ["الأسماك", "القطط", "الكلاب", "الخيول"], correctIndex: 0 },
  { id: "q209", category: "حيوانات", difficulty: "hard", question: "ما هو الحيوان الذي يمتلك ثلاثة قلوب؟", options: ["الحوت", "الفيل", "الأخطبوط", "الزرافة"], correctIndex: 2 },

  // ── فضاء ──────────────────────────────────────────────────────────────
  { id: "q210", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الملقَّب بـ«نجمة الصباح»؟", options: ["الزهرة", "المريخ", "المشتري", "عطارد"], correctIndex: 0 },
  { id: "q211", category: "فضاء", difficulty: "easy", question: "ماذا نسمي الصخرة التي تسقط من الفضاء على الأرض؟", options: ["نيزك", "مذنب", "كوكب", "قمر صناعي"], correctIndex: 0 },
  { id: "q212", category: "فضاء", difficulty: "easy", question: "ما هي وكالة الفضاء الأمريكية؟", options: ["ناسا", "إيسا", "روسكوزموس", "سبيس إكس"], correctIndex: 0 },
  { id: "q213", category: "فضاء", difficulty: "medium", question: "كم يستغرق ضوء الشمس للوصول إلى الأرض؟", options: ["8 دقائق تقريباً", "ثانية واحدة", "ساعة كاملة", "يوم كامل"], correctIndex: 0 },
  { id: "q214", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب السابع من الشمس؟", options: ["زحل", "نبتون", "أورانوس", "بلوتو"], correctIndex: 2 },
  { id: "q215", category: "فضاء", difficulty: "hard", question: "ما هو الكوكب الأبرد في المجموعة الشمسية؟", options: ["زحل", "نبتون", "بلوتو", "أورانوس"], correctIndex: 3 },

  // ── موسيقى ────────────────────────────────────────────────────────────
  { id: "q216", category: "موسيقى", difficulty: "easy", question: "ما هي الآلة التي تنفخ فيها لتعزف؟", options: ["الفلوت", "البيانو", "الجيتار", "الطبول"], correctIndex: 0 },
  { id: "q217", category: "موسيقى", difficulty: "easy", question: "كم عدد أوتار الجيتار؟", options: ["6", "4", "8", "12"], correctIndex: 0 },
  { id: "q218", category: "موسيقى", difficulty: "medium", question: "من هو الملحن الذي أصيب بالصمم في أواخر حياته؟", options: ["بيتهوفن", "موزارت", "باخ", "شوبان"], correctIndex: 0 },
  { id: "q219", category: "موسيقى", difficulty: "medium", question: "ما هي الآلة الموسيقية العربية الشهيرة ذات العنق الطويل؟", options: ["العود", "القانون", "الناي", "الدربكة"], correctIndex: 0 },
  { id: "q220", category: "موسيقى", difficulty: "medium", question: "من هو المغني المصري الملقَّب بـ«العندليب»؟", options: ["فريد الأطرش", "أم كلثوم", "محمد عبد الوهاب", "عبد الحليم حافظ"], correctIndex: 3 },

  // ── دين وثقافة ────────────────────────────────────────────────────────
  { id: "q221", category: "دين وثقافة", difficulty: "easy", question: "ما هو الكتاب المقدس للمسلمين؟", options: ["القرآن الكريم", "التوراة", "الإنجيل", "الزبور"], correctIndex: 0 },
  { id: "q222", category: "دين وثقافة", difficulty: "easy", question: "كم عدد ركعات صلاة الفجر؟", options: ["ركعتان", "ثلاث", "أربع", "خمس"], correctIndex: 0 },
  { id: "q223", category: "دين وثقافة", difficulty: "easy", question: "ما هي أول سورة في ترتيب المصحف؟", options: ["الفاتحة", "البقرة", "الإخلاص", "الناس"], correctIndex: 0 },
  { id: "q224", category: "دين وثقافة", difficulty: "medium", question: "ما هو الشهر الذي يأتي قبل رمضان؟", options: ["رجب", "شعبان", "شوال", "محرم"], correctIndex: 1 },
  { id: "q225", category: "دين وثقافة", difficulty: "medium", question: "في أي مدينة يقع المسجد الأقصى؟", options: ["القدس", "مكة المكرمة", "المدينة المنورة", "دمشق"], correctIndex: 0 },

  // ── جسم الإنسان ───────────────────────────────────────────────────────
  { id: "q226", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو المسؤول عن الرؤية؟", options: ["الأذن", "العين", "الأنف", "اللسان"], correctIndex: 1 },
  { id: "q227", category: "جسم الإنسان", difficulty: "easy", question: "ما هو المعدن المهم لتقوية العظام؟", options: ["الحديد", "البوتاسيوم", "الصوديوم", "الكالسيوم"], correctIndex: 3 },
  { id: "q228", category: "جسم الإنسان", difficulty: "medium", question: "ما هي أكبر غدة في جسم الإنسان؟", options: ["البنكرياس", "الغدة الدرقية", "الكبد", "الطحال"], correctIndex: 2 },
  { id: "q229", category: "جسم الإنسان", difficulty: "medium", question: "كم عدد عضلات جسم الإنسان تقريباً؟", options: ["أقل من 200", "حوالي 300", "أكثر من 600", "أكثر من 1000"], correctIndex: 2 },

  // ── منوعات ────────────────────────────────────────────────────────────
  { id: "q230", category: "منوعات", difficulty: "easy", question: "ما هو اللون الناتج عن خلط الأحمر مع الأصفر؟", options: ["البرتقالي", "الأخضر", "البنفسجي", "الوردي"], correctIndex: 0 },
  { id: "q231", category: "منوعات", difficulty: "easy", question: "ما هو الشهر الأخير في السنة الميلادية؟", options: ["ديسمبر", "نوفمبر", "أكتوبر", "يناير"], correctIndex: 0 },
  { id: "q232", category: "منوعات", difficulty: "medium", question: "ما هي العملة الرسمية للولايات المتحدة؟", options: ["الدولار", "اليورو", "الجنيه", "الين"], correctIndex: 0 },
  { id: "q233", category: "منوعات", difficulty: "medium", question: "ما هي اللغة الأكثر تحدثاً في العالم كلغة أم؟", options: ["الإسبانية", "العربية", "الإنجليزية", "المندارية الصينية"], correctIndex: 3 },

  // ── حزمة الأسئلة الجديدة (q234 – q263) — تحديث البناء 2 ───────────────
  { id: "q234", category: "منوعات", difficulty: "easy", question: "كم عدد الأيام في الأسبوع؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q235", category: "منوعات", difficulty: "easy", question: "ما هو الكائن الذي يضع البيض ولا يطير؟", options: ["الدجاجة", "البطة", "النعامة", "الإوزة"], correctIndex: 2 },
  { id: "q236", category: "منوعات", difficulty: "medium", question: "ما هو البحر الذي يفصل بين السعودية ومصر؟", options: ["البحر الأبيض المتوسط", "البحر الأحمر", "الخليج العربي", "بحر العرب"], correctIndex: 1 },
  { id: "q237", category: "تكنولوجيا", difficulty: "easy", question: "ما هي الشركة التي تصنع هواتف آيفون؟", options: ["سامسونغ", "هواوي", "أبل", "شاومي"], correctIndex: 2 },
  { id: "q238", category: "تكنولوجيا", difficulty: "medium", question: "ماذا يعني الاختصار USB؟", options: ["ناقل تسلسلي عام", "نظام تشغيل أساسي", "بروتوكول شبكات", "ذاكرة سحابية"], correctIndex: 0 },
  { id: "q239", category: "تكنولوجيا", difficulty: "medium", question: "ما هو أصغر وحدة بيانات في الحاسوب؟", options: ["البايت", "البت", "الكيلوبايت", "الميجابايت"], correctIndex: 1 },
  { id: "q240", category: "علوم", difficulty: "easy", question: "ما هي العملية التي تصنع بها النباتات غذاءها؟", options: ["التنفس", "البناء الضوئي", "النتح", "التكاثر"], correctIndex: 1 },
  { id: "q241", category: "علوم", difficulty: "medium", question: "ما هو أقرب الكواكب إلى الشمس؟", options: ["الزهرة", "عطارد", "الأرض", "المريخ"], correctIndex: 1 },
  { id: "q242", category: "رياضة", difficulty: "easy", question: "في أي رياضة تستخدم سلة وخاتم؟", options: ["كرة القدم", "كرة السلة", "الطائرة", "اليد"], correctIndex: 1 },
  { id: "q243", category: "رياضة", difficulty: "medium", question: "ما هي الدولة التي فازت بكأس العالم 2014؟", options: ["ألمانيا", "إسبانيا", "البرازيل", "الأرجنتين"], correctIndex: 0 },
  { id: "q244", category: "أفلام ومسلسلات", difficulty: "easy", question: "من هو البطل الخارق الملقب بـ«الرجل العنكبوت»؟", options: ["سبايدرمان", "باتمان", "سوبرمان", "الرجل الحديدي"], correctIndex: 0 },
  { id: "q245", category: "أفلام ومسلسلات", difficulty: "medium", question: "في أي فيلم تظهر عبارة «ليكن القوة معك»؟", options: ["حرب النجوم", "ستار تريك", "ماتريكس", "أفاتار"], correctIndex: 0 },
  { id: "q246", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة المغرب؟", options: ["الدار البيضاء", "الرباط", "مراكش", "فاس"], correctIndex: 1 },
  { id: "q247", category: "جغرافيا", difficulty: "medium", question: "ما هي الدولة التي تلقب بـ«بلد النيل»؟", options: ["السودان", "مصر", "أوغندا", "إثيوبيا"], correctIndex: 1 },
  { id: "q248", category: "تاريخ", difficulty: "easy", question: "من هو العالم الذي اكتشف الجاذبية؟", options: ["أينشتاين", "نيوتن", "غاليليو", "كوبرنيكوس"], correctIndex: 1 },
  { id: "q249", category: "تاريخ", difficulty: "medium", question: "في أي قرن سقطت الأندلس؟", options: ["الخامس عشر", "السادس عشر", "الرابع عشر", "السابع عشر"], correctIndex: 0 },
  { id: "q250", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي الفاكهة الصفراء الطويلة التي يحبها القردة؟", options: ["التفاح", "الموز", "البرتقال", "المانجو"], correctIndex: 1 },
  { id: "q251", category: "طعام ومشروبات", difficulty: "medium", question: "من أين يُستخرج زيت الزيتون؟", options: ["الزيتون", "الجوز", "اللوز", "بذور عباد الشمس"], correctIndex: 0 },
  { id: "q252", category: "حيوانات", difficulty: "easy", question: "ما هو أبطأ حيوان بري؟", options: ["السلحفاة", "الحلزون", "الكسلان", "القنفذ"], correctIndex: 1 },
  { id: "q253", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي يتغذى على أوراق الكافور ويحمل صغيره في جيب؟", options: ["الكنغر", "الكوالا", "الباندا", "الأبوسوم"], correctIndex: 1 },
  { id: "q254", category: "فضاء", difficulty: "easy", question: "ما اسم المجرة التي تقع فيها الأرض؟", options: ["أندروميدا", "درب التبانة", "الدوامة", "العين السوداء"], correctIndex: 1 },
  { id: "q255", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب الملقب بـ«الكوكب الماسي»؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 2 },
  { id: "q256", category: "لغة", difficulty: "easy", question: "ما هو جمع كلمة «بيت»؟", options: ["بيوت", "أبيات", "بيوتات", "مبيت"], correctIndex: 0 },
  { id: "q257", category: "لغة", difficulty: "medium", question: "ما هو ضد كلمة «الشجاعة»؟", options: ["الجبن", "الخوف", "التردد", "الهروب"], correctIndex: 0 },
  { id: "q258", category: "منطق", difficulty: "easy", question: "ما هو العدد التالي: 10، 20، 30، …؟", options: ["35", "40", "45", "50"], correctIndex: 1 },
  { id: "q259", category: "منطق", difficulty: "hard", question: "إذا كان 5 + 5 = 10، فما هو 5 × 5؟", options: ["10", "15", "25", "50"], correctIndex: 2 },
  { id: "q260", category: "دين وثقافة", difficulty: "easy", question: "ما هو الركن الثالث من أركان الإسلام؟", options: ["الصلاة", "الزكاة", "الصوم", "الحج"], correctIndex: 1 },
  { id: "q261", category: "دين وثقافة", difficulty: "medium", question: "كم عدد أشهر السنة الهجرية؟", options: ["10", "11", "12", "13"], correctIndex: 2 },
  { id: "q262", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو المسؤول عن السمع؟", options: ["الأنف", "العين", "الأذن", "اللسان"], correctIndex: 2 },
  { id: "q263", category: "جسم الإنسان", difficulty: "medium", question: "كم لتراً من الدم في جسم الإنسان البالغ تقريباً؟", options: ["2-3", "4-5", "6-7", "8-9"], correctIndex: 1 },
];
