/**
 * ═══════════════════════════════════════════════════════════════════════
 * MEGA_PACK_5 — التوسعة الضخمة للبنك (q900+) — ~220 سؤالاً جديداً
 * تُربط في questions.ts داخل QUESTION_BANK.
 * الفئات مطابقة تماماً لقائمة CATEGORIES الرسمية.
 * ═══════════════════════════════════════════════════════════════════════
 */
import type { Question } from "./questions";

export const MEGA_PACK_5: Question[] = [
  // ── عام ──────────────────────────────────────────────────────────────
  { id: "q901", category: "عام", difficulty: "easy", question: "كم عدد قارات العالم؟", options: ["خمس", "ست", "سبع", "ثماني"], correctIndex: 2 },
  { id: "q902", category: "عام", difficulty: "easy", question: "ما هو أطول نهر في العالم؟", options: ["النيل", "الأمازون", "الفرات", "الدانوب"], correctIndex: 1 },
  { id: "q903", category: "عام", difficulty: "easy", question: "ما لون دم الأخطبوط؟", options: ["أحمر", "أزرق", "أخضر", "شفاف"], correctIndex: 1 },
  { id: "q904", category: "عام", difficulty: "medium", question: "ما هو أصغر بلد في العالم بمساحته؟", options: ["موناكو", "الفاتيكان", "مالطا", "سان مارينو"], correctIndex: 1 },
  { id: "q905", category: "عام", difficulty: "easy", question: "كم عدد أيام الأسبوع؟", options: ["خمسة", "ستة", "سبعة", "ثمانية"], correctIndex: 2 },
  { id: "q906", category: "عام", difficulty: "medium", question: "ما هو المعدن السائل في درجة حرارة الغرفة؟", options: ["الزئبق", "الرصاص", "القصدير", "الحديد"], correctIndex: 0 },
  { id: "q907", category: "عام", difficulty: "easy", question: "ما هي أكبر صحراء حارة في العالم؟", options: ["الربع الخالي", "الصحراء الكبرى", "صحراء غوبي", "صحراء كالاهاري"], correctIndex: 1 },
  { id: "q908", category: "عام", difficulty: "medium", question: "كم عدد عيون الإبرة القياسية؟", options: ["واحدة", "اثنتان", "ثلاث", "لا يوجد"], correctIndex: 0 },
  { id: "q909", category: "عام", difficulty: "medium", question: "ما هي عاصمة أستراليا؟", options: ["سيدني", "ملبورن", "كانبرا", "بيرث"], correctIndex: 2 },
  { id: "q910", category: "عام", difficulty: "easy", question: "كم دقيقة في الساعة الواحدة؟", options: ["30", "45", "60", "90"], correctIndex: 2 },

  // ── علوم ─────────────────────────────────────────────────────────────
  { id: "q911", category: "علوم", difficulty: "medium", question: "ما هو الجزء المسؤول عن إنتاج الطاقة في الخلية؟", options: ["النواة", "الميتوكوندريا", "الرايبوسوم", "الغشاء الخلوي"], correctIndex: 1 },
  { id: "q912", category: "علوم", difficulty: "medium", question: "ما هو أسرع من الصوت؟", options: ["الطائرة", "الضوء", "الرصاصة", "الصاروخ"], correctIndex: 1 },
  { id: "q913", category: "علوم", difficulty: "hard", question: "ما هو الرمز الكيميائي للحديد؟", options: ["Ir", "Fe", "Au", "Ag"], correctIndex: 1 },
  { id: "q914", category: "علوم", difficulty: "medium", question: "كم عدد الكروموسومات في الخلية البشرية الطبيعية؟", options: ["23", "46", "48", "44"], correctIndex: 1 },
  { id: "q915", category: "علوم", difficulty: "easy", question: "ما هو الغاز الذي نتنفسه ونحتاجه للحياة؟", options: ["النيتروجين", "الأكسجين", "الهيليوم", "الميثان"], correctIndex: 1 },
  { id: "q916", category: "علوم", difficulty: "medium", question: "ما هي أقوى عدسة مكبرة طبيعية؟", options: ["قطرة ماء", "بلورة", "قطرة زيت", "قطرة عسل"], correctIndex: 0 },
  { id: "q917", category: "علوم", difficulty: "hard", question: "ما هو نصف عمر الكربون المشع تقريباً؟", options: ["5730 سنة", "1600 سنة", "100 سنة", "50 ألف سنة"], correctIndex: 0 },
  { id: "q918", category: "علوم", difficulty: "medium", question: "ما اسم أصغر جزء من المادة يحتفظ بخواص العنصر؟", options: ["الجزيء", "الذرة", "البروتون", "الإلكترون"], correctIndex: 1 },
  { id: "q919", category: "علوم", difficulty: "easy", question: "بمَ تُقاس شدة الزلازل؟", options: ["السلم الديسيبلي", "مقياس ريختر", "السلسيوس", "البارومتر"], correctIndex: 1 },
  { id: "q920", category: "علوم", difficulty: "medium", question: "ما هي الظاهرة التي تجعل القلم يبدو مكسوراً في الماء؟", options: ["الانعكاس", "الانكسار", "الحيد", "الامتصاص"], correctIndex: 1 },
  { id: "q921", category: "علوم", difficulty: "hard", question: "من صاحب نظرية النسبية العامة؟", options: ["نيوتن", "أينشتاين", "بوهر", "هايزنبرغ"], correctIndex: 1 },
  { id: "q922", category: "علوم", difficulty: "medium", question: "ما هو المعدن الأكثر توصيلاً للكهرباء؟", options: ["النحاس", "الفضة", "الذهب", "الألمنيوم"], correctIndex: 1 },
  { id: "q923", category: "علوم", difficulty: "medium", question: "كم عدد أطوار المادة الأساسية؟", options: ["ثلاثة", "أربعة", "خمسة", "ستة"], correctIndex: 0 },
  { id: "q924", category: "علوم", difficulty: "hard", question: "ما هو الحيوان الذي لا ينام أصلاً؟", options: ["الضفدع الثور", "الدلفين", "الخفاش", "الكوالا"], correctIndex: 0 },

  // ── جغرافيا ──────────────────────────────────────────────────────────
  { id: "q925", category: "جغرافيا", difficulty: "medium", question: "ما هي أعلى قمة جبلية في العالم؟", options: ["K2", "إيفرست", "كليمنجارو", "مونت بلان"], correctIndex: 1 },
  { id: "q926", category: "جغرافيا", difficulty: "easy", question: "ما هي أكبر دولة عربية من حيث المساحة؟", options: ["السعودية", "الجزائر", "السودان", "ليبيا"], correctIndex: 1 },
  { id: "q927", category: "جغرافيا", difficulty: "medium", question: "أي بحر يفصل بين مصر والسعودية؟", options: ["البحر المتوسط", "البحر الأحمر", "بحر العرب", "الخليج العربي"], correctIndex: 1 },
  { id: "q928", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة كندا؟", options: ["تورونتو", "أوتاوا", "مونتريال", "فانكوفر"], correctIndex: 1 },
  { id: "q929", category: "جغرافيا", difficulty: "hard", question: "ما هو أعمق محيط في العالم؟", options: ["الأطلسي", "الهندي", "الهادئ", "المتجمد الجنوبي"], correctIndex: 2 },
  { id: "q930", category: "جغرافيا", difficulty: "medium", question: "في أي قارة تقع دولة تشيلي؟", options: ["أوروبا", "آسيا", "أمريكا الجنوبية", "أفريقيا"], correctIndex: 2 },
  { id: "q931", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة تركيا؟", options: ["إسطنبول", "أنقرة", "إزمير", "بورصة"], correctIndex: 1 },
  { id: "q932", category: "جغرافيا", difficulty: "hard", question: "ما هو أطول سلسلة جبال في العالم؟", options: ["الهيمالايا", "الألب", "الأند", "الروكي"], correctIndex: 2 },
  { id: "q933", category: "جغرافيا", difficulty: "medium", question: "ما هي أكبر جزيرة في العالم؟", options: ["غرينلاند", "مدغشقر", "بورنيو", "أستراليا"], correctIndex: 0 },
  { id: "q934", category: "جغرافيا", difficulty: "easy", question: "ما البحر الذي يطل عليه مصر من الشمال؟", options: ["الأحمر", "المتوسط", "العرب", "الأسود"], correctIndex: 1 },
  { id: "q935", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة اليونان؟", options: ["أثينا", "سبارتا", "تسالونيكي", "كورفو"], correctIndex: 0 },
  { id: "q936", category: "جغرافيا", difficulty: "hard", question: "ما اسم أكبر شلال مائي في العالم بالعرض؟", options: ["نياجرا", "شلالات فيكتوريا", "إغواسو", "أنجل"], correctIndex: 2 },

  // ── رياضيات ──────────────────────────────────────────────────────────
  { id: "q937", category: "رياضيات", difficulty: "easy", question: "كم عدد أضلاع المثلث؟", options: ["2", "3", "4", "5"], correctIndex: 1 },
  { id: "q938", category: "رياضيات", difficulty: "easy", question: "ما حاصل 12 × 12؟", options: ["124", "144", "134", "154"], correctIndex: 1 },
  { id: "q939", category: "رياضيات", difficulty: "medium", question: "ما هو العدد الأولي الأكبر من 7 وأصغر من 12؟", options: ["8", "9", "11", "10"], correctIndex: 2 },
  { id: "q940", category: "رياضيات", difficulty: "medium", question: "ما قيمة باي (π) تقريباً؟", options: ["3.14", "2.72", "1.61", "3.71"], correctIndex: 0 },
  { id: "q941", category: "رياضيات", difficulty: "hard", question: "ما هو مجموع زوايا المثلث؟", options: ["90", "180", "270", "360"], correctIndex: 1 },
  { id: "q942", category: "رياضيات", difficulty: "medium", question: "ما هو الجذر التربيعي للعدد 144؟", options: ["10", "12", "14", "16"], correctIndex: 1 },
  { id: "q943", category: "رياضيات", difficulty: "hard", question: "كم عدد أضلاع الهيكساجون؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q944", category: "رياضيات", difficulty: "medium", question: "ما ناتج 7 أس 2؟", options: ["14", "49", "21", "77"], correctIndex: 1 },
  { id: "q945", category: "رياضيات", difficulty: "easy", question: "ما هو العدد الناقص: 5، 10، 15، __؟", options: ["18", "20", "22", "25"], correctIndex: 1 },
  { id: "q946", category: "رياضيات", difficulty: "hard", question: "ما هو لوغاريتم العدد 100 للأساس 10؟", options: ["1", "2", "10", "100"], correctIndex: 1 },

  // ── لغة ──────────────────────────────────────────────────────────────
  { id: "q947", category: "لغة", difficulty: "medium", question: "ما جمع كلمة «قلم»؟", options: ["قلمات", "أقلام", "قلمون", "قوالم"], correctIndex: 1 },
  { id: "q948", category: "لغة", difficulty: "medium", question: "ما مضاد كلمة «الكرم»؟", options: ["الجود", "البخل", "الشجاعة", "الصدق"], correctIndex: 1 },
  { id: "q949", category: "لغة", difficulty: "hard", question: "ما مرادف كلمة «البليغ»؟", options: ["الفسح", "الفصيح", "الغامض", "السريع"], correctIndex: 1 },
  { id: "q950", category: "لغة", difficulty: "easy", question: "كم عدد حروف اللغة العربية؟", options: ["26", "28", "29", "30"], correctIndex: 1 },
  { id: "q951", category: "لغة", difficulty: "medium", question: "ما نوع كلمة «جاء» في «جاء الطالب»؟", options: ["اسم", "فعل", "حرف", "ضمير"], correctIndex: 1 },
  { id: "q952", category: "لغة", difficulty: "hard", question: "ما معنى كلمة «النجوم» في اللغة القديمة؟", options: ["الطلاع", "السحاب", "الرياح", "الأشجار"], correctIndex: 0 },
  { id: "q953", category: "لغة", difficulty: "medium", question: "ما جمع كلمة «ماء»؟", options: ["مياه", "ماءات", "أمواة", "ماءون"], correctIndex: 0 },
  { id: "q954", category: "لغة", difficulty: "easy", question: "ما مضاد كلمة «الصبح»؟", options: ["الليل", "الظهر", "العصر", "الفجر"], correctIndex: 0 },

  // ── منطق ─────────────────────────────────────────────────────────────
  { id: "q955", category: "منطق", difficulty: "medium", question: "كل القطط تكره الماء، وبعض القطط سوداء، إذن:", options: ["كل السود يكرهون الماء", "بعض السود يكرهون الماء", "لا يمكن الاستنتاج", "كل القطط سوداء"], correctIndex: 1 },
  { id: "q956", category: "منطق", difficulty: "easy", question: "ما هو العدد التالي في السلسلة: 2، 4، 8، 16، __؟", options: ["24", "32", "20", "30"], correctIndex: 1 },
  { id: "q957", category: "منطق", difficulty: "medium", question: "إذا كان أحمد أطول من سعيد وسعيد أطول من خالد، فمن الأقصر؟", options: ["أحمد", "سعيد", "خالد", "لا يُعرف"], correctIndex: 2 },
  { id: "q958", category: "منطق", difficulty: "hard", question: "ساعة يدك تشير 3:15، ما الزاوية بين عقربيها؟", options: ["0 درجة", "7.5 درجة", "15 درجة", "30 درجة"], correctIndex: 1 },
  { id: "q959", category: "منطق", difficulty: "medium", question: "ما العدد الناقص: 1، 1، 2، 3، 5، 8، __؟", options: ["11", "13", "12", "14"], correctIndex: 1 },
  { id: "q960", category: "منطق", difficulty: "easy", question: "ما هو العدد التالي: 3، 6، 9، 12، __؟", options: ["14", "15", "16", "18"], correctIndex: 1 },
  { id: "q961", category: "منطق", difficulty: "hard", question: "إن كان كل A هو B، وكل B هو C، فإن كل A هو C:", options: ["صحيح دائماً", "خطأ دائماً", "أحياناً", "لا يمكن الحكم"], correctIndex: 0 },
  { id: "q962", category: "منطق", difficulty: "medium", question: "كم مرة تُطبع كلمة «مرحبا» في حلقة تكرر 5 مرات؟", options: ["4", "5", "6", "10"], correctIndex: 1 },

  // ── تاريخ ────────────────────────────────────────────────────────────
  { id: "q963", category: "تاريخ", difficulty: "medium", question: "في أي عام كانت الحرب العالمية الثانية؟", options: ["1914", "1939", "1945", "1950"], correctIndex: 1 },
  { id: "q964", category: "تاريخ", difficulty: "easy", question: "من هو أول خليفة في الإسلام؟", options: ["عمر بن الخطاب", "أبو بكر الصديق", "عثمان بن عفان", "علي بن أبي طالب"], correctIndex: 1 },
  { id: "q965", category: "تاريخ", difficulty: "medium", question: "متى كانت غزوة بدر الكبرى؟", options: ["2 هجري", "5 هجري", "8 هجري", "10 هجري"], correctIndex: 0 },
  { id: "q966", category: "تاريخ", difficulty: "hard", question: "من هو مؤسس دولة الموحدون؟", options: ["عبد المؤمن", "يوسف بن تاشفين", "محمد بن تومرت", "يعقوب المنصور"], correctIndex: 2 },
  { id: "q967", category: "تاريخ", difficulty: "medium", question: "من اكتشف أمريكا عام 1492؟", options: ["ماجلان", "كولومبوس", "كوك", "دريك"], correctIndex: 1 },
  { id: "q968", category: "تاريخ", difficulty: "medium", question: "ما هي الدولة التي بنت هرم خوفو؟", options: ["العراق", "مصر", "المكسيك", "السودان"], correctIndex: 1 },
  { id: "q969", category: "تاريخ", difficulty: "hard", question: "في أي سنة سقطت القسطنطينية؟", options: ["1258", "1453", "1492", "1517"], correctIndex: 1 },
  { id: "q970", category: "تاريخ", difficulty: "medium", question: "من هو قائد معركة حطين؟", options: ["صلاح الدين الأيوبي", "نور الدين زنكي", "الظاهر بيبرس", "سيف الدين قتز"], correctIndex: 0 },
  { id: "q971", category: "تاريخ", difficulty: "easy", question: "متى استقلت الجزائر؟", options: ["1954", "1962", "1956", "1970"], correctIndex: 1 },
  { id: "q972", category: "تاريخ", difficulty: "hard", question: "ما هو اسم أول حاسوب إلكتروني؟", options: ["ENIAC", "UNIVAC", "IBM-701", "Apple I"], correctIndex: 0 },

  // ── رياضة ────────────────────────────────────────────────────────────
  { id: "q973", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي كرة القدم في الفريق الواحد؟", options: ["10", "11", "12", "9"], correctIndex: 1 },
  { id: "q974", category: "رياضة", difficulty: "medium", question: "في أي بلد أقيمت أول كأس عالم لكرة القدم؟", options: ["البرازيل", "أوروغواي", "إيطاليا", "فرنسا"], correctIndex: 1 },
  { id: "q975", category: "رياضة", difficulty: "medium", question: "كم مدة مباراة كرة السلة في الدوريات الكبرى؟", options: ["32 دقيقة", "40 دقيقة", "48 دقيقة", "50 دقيقة"], correctIndex: 2 },
  { id: "q976", category: "رياضة", difficulty: "hard", question: "من هو اللاعب الذي فاز بـ 7 كرات ذهبية؟", options: ["كريستيانو رونالدو", "ليونيل ميسي", "رونالدينيو", "زين الدين زيدان"], correctIndex: 1 },
  { id: "q977", category: "رياضة", difficulty: "easy", question: "كم عدد حلقات شعار الألعاب الأولمبية؟", options: ["4", "5", "6", "7"], correctIndex: 1 },
  { id: "q978", category: "رياضة", difficulty: "medium", question: "أي رياضة تستخدم المصطلح «ستريك»؟", options: ["التنس", "البولينغ", "الجولف", "البيسبول"], correctIndex: 1 },
  { id: "q979", category: "رياضة", difficulty: "hard", question: "من فاز بكأس العالم لكرة القدم أكثر مرة؟", options: ["ألمانيا", "إيطاليا", "البرازيل", "الأرجنتين"], correctIndex: 2 },
  { id: "q980", category: "رياضة", difficulty: "easy", question: "كم نقطة تمنح للتودو في التنس؟", options: ["1", "2", "3", "4"], correctIndex: 0 },

  // ── فنون ─────────────────────────────────────────────────────────────
  { id: "q981", category: "فنون", difficulty: "medium", question: "من رسم لوحة الموناليزا؟", options: ["فان جوخ", "ليوناردو دافنشي", "بيكاسو", "مونيه"], correctIndex: 1 },
  { id: "q982", category: "فنون", difficulty: "hard", question: "من رسم لوحة «الليل النجمي»؟", options: ["فان جوخ", "غويا", "سورا", "سيزان"], correctIndex: 0 },
  { id: "q983", category: "فنون", difficulty: "medium", question: "من مؤلف مسرحية هاملت؟", options: ["شكسبير", "موليير", "تشيخوف", "أوقست ويلسون"], correctIndex: 0 },
  { id: "q984", category: "فنون", difficulty: "medium", question: "ما هي الحركة الفنية التي أسسها بيكاسو؟", options: ["التكعيبية", "الانطباعية", "السريالية", "التعبيرية"], correctIndex: 0 },
  { id: "q985", category: "فنون", difficulty: "hard", question: "من هو النحات الذي نحت تمثال دافيد؟", options: ["ميكيلانجلو", "دوناتيلو", "رافائيل", "برنيني"], correctIndex: 0 },
  { id: "q986", category: "فنون", difficulty: "easy", question: "ما هو الفن الذي يستخدم الكلمات كصورة؟", options: ["الخط العربي", "الرسم الزيتي", "النحت", "التصوير"], correctIndex: 0 },

  // ── تكنولوجيا ────────────────────────────────────────────────────────
  { id: "q987", category: "تكنولوجيا", difficulty: "easy", question: "ماذا تعني CPU؟", options: ["وحدة المعالجة المركزية", "شريحة الرسوميات", "الذاكرة العشوائية", "القرص الصلب"], correctIndex: 0 },
  { id: "q988", category: "تكنولوجيا", difficulty: "medium", question: "من مؤسس مايكروسوفت؟", options: ["ستيف جوبز", "بيل جيتس", "إيلون ماسك", "مارك زوكربيرغ"], correctIndex: 1 },
  { id: "q989", category: "تكنولوجيا", difficulty: "medium", question: "ما هي لغة برمجة تستخدم في تطوير تطبيقات أندرويد الحديثة؟", options: ["Kotlin", "Swift", "Ruby", "PHP"], correctIndex: 0 },
  { id: "q990", category: "تكنولوجيا", difficulty: "hard", question: "ماذا تعني WWW؟", options: ["World Wide Web", "Web World Wide", "Wide Web World", "World Web Wide"], correctIndex: 0 },
  { id: "q991", category: "تكنولوجيا", difficulty: "medium", question: "ما اسم أول متصفح ويب؟", options: ["WorldWideWeb", "Mosaic", "Netscape", "Internet Explorer"], correctIndex: 0 },
  { id: "q992", category: "تكنولوجيا", difficulty: "easy", question: "ما هي ذاكرة مؤقتة سريعة في المعالج؟", options: ["Cache", "RAM", "ROM", "SSD"], correctIndex: 0 },
  { id: "q993", category: "تكنولوجيا", difficulty: "hard", question: "ما هو بروتوكول النقل الآمن للمواقع؟", options: ["HTTPS", "HTTP", "FTP", "SMTP"], correctIndex: 0 },
  { id: "q994", category: "تكنولوجيا", difficulty: "medium", question: "من اخترع الويب؟", options: ["تيم بيرنرز لي", "فينت سيرف", "بيل جيتس", "ستيف جوبز"], correctIndex: 0 },
  { id: "q995", category: "تكنولوجيا", difficulty: "easy", question: "ما هي وحدة قياس سرعة الإنترنت؟", options: ["Mbps", "GHz", "MP", "mAh"], correctIndex: 0 },

  // ── أفلام ومسلسلات ──────────────────────────────────────────────────
  { id: "q996", category: "أفلام ومسلسلات", difficulty: "easy", question: "من أخرج فيلم «الحفرة»؟", options: ["بونغ جون هو", "كريستوفر نولان", "ستيفن سبيلبرغ", "مارتن سكورسيزي"], correctIndex: 0 },
  { id: "q997", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو الفيلم الحائز على أكثر الأوسكار؟", options: ["تيتانك", "بن هور", "اللورد أوف ذا رينغز", "كل ما سبق"], correctIndex: 3 },
  { id: "q998", category: "أفلام ومسلسلات", difficulty: "medium", question: "من بطل فيلم «العراب»؟", options: ["مارلون براندو", "آل باتشينو", "روبرت دي نيرو", "جاك نيكلسون"], correctIndex: 0 },
  { id: "q999", category: "أفلام ومسلسلات", difficulty: "easy", question: "ما اسم الشركة التي أنتجت فيلم «توي ستوري»؟", options: ["ديزني", "بيكسار", "دريم ووركس", "وارنر"], correctIndex: 1 },
  { id: "q1000", category: "أفلام ومسلسلات", difficulty: "hard", question: "من مخرج فيلم «اينسبشن»؟", options: ["كريستوفر نولان", "دينيس فيلنوف", "ريدلي سكوت", "جيمس كاميرون"], correctIndex: 0 },
  { id: "q1001", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو المسلسل الكوري الأشهر عالمياً على نتفليكس؟", options: ["لعبة الحبار", "البيت الورقي", "المملكة", "فينسنزو"], correctIndex: 0 },
  { id: "q1002", category: "أفلام ومسلسلات", difficulty: "easy", question: "من بطل مسلسل «بريكينغ باد»؟", options: ["برايان كرانستون", "آرون بول", "بوب أودينكيرك", "جيانكارلو إسبوزيتو"], correctIndex: 0 },

  // ── طعام ومشروبات ───────────────────────────────────────────────────
  { id: "q1003", category: "طعام ومشروبات", difficulty: "easy", question: "من أي نبات يُصنع السكر الأبيض غالباً؟", options: ["البنجر أو قصب السكر", "الذرة", "الأرز", "الشعير"], correctIndex: 0 },
  { id: "q1004", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو البلد الأصل للبيتزا؟", options: ["اليونان", "إيطاليا", "فرنسا", "إسبانيا"], correctIndex: 1 },
  { id: "q1005", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو النبات الذي يُستخرج منه القهوة؟", options: ["حبوب البن", "ورق الشاي", "كاكاو", "فانيلا"], correctIndex: 0 },
  { id: "q1006", category: "طعام ومشروبات", difficulty: "hard", question: "ما هو الطبق الوطني لليابان؟", options: ["الرامن", "السوشي", "التيرياكي", "التيمبورا"], correctIndex: 0 },
  { id: "q1007", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي الفاكهة التي تحتوي على أكثر فيتامين C؟", options: ["البرتقال", "الكيوي", "التفاح", "الموز"], correctIndex: 1 },
  { id: "q1008", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو المكون الأساسي للحمّص بالطحينة؟", options: ["الحمص", "الفول", "العدس", "الفاصوليا"], correctIndex: 0 },
  { id: "q1009", category: "طعام ومشروبات", difficulty: "medium", question: "من أي حبوب يُصنع الخبز الأبيض غالباً؟", options: ["القمح", "الذرة", "الشعير", "الأرز"], correctIndex: 0 },

  // ── حيوانات ──────────────────────────────────────────────────────────
  { id: "q1010", category: "حيوانات", difficulty: "easy", question: "ما هو أسرع حيوان في العالم؟", options: ["الصقر", "الفهد", "السمكة الشراعية", "الفأر"], correctIndex: 0 },
  { id: "q1011", category: "حيوانات", difficulty: "medium", question: "كم قلباً للأخطبوط؟", options: ["1", "2", "3", "4"], correctIndex: 2 },
  { id: "q1012", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي ينام واقفاً؟", options: ["الحصان", "الحمار", "الجمل", "الكلب"], correctIndex: 0 },
  { id: "q1013", category: "حيوانات", difficulty: "hard", question: "ما هو أكبر حيوان ثديي في المحيط؟", options: ["الحوت الأزرق", "أوركا", "قرش أبيض", "دلفين"], correctIndex: 0 },
  { id: "q1014", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الوطني للصين؟", options: ["النمر", "الباندا", "القرد", "التنين"], correctIndex: 1 },
  { id: "q1015", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي يعيش أطول؟", options: ["السلحفاة", "الحوت", "الفيل", "التمساح"], correctIndex: 0 },
  { id: "q1016", category: "حيوانات", difficulty: "hard", question: "كم سنة يعيش الفأر تقريباً؟", options: ["سنة واحدة", "5 سنوات", "10 سنوات", "15 سنة"], correctIndex: 0 },
  { id: "q1017", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الذي يُسمى ملك الغابة؟", options: ["النمر", "الأسد", "الدب", "الذئب"], correctIndex: 1 },

  // ── فضاء ─────────────────────────────────────────────────────────────
  { id: "q1018", category: "فضاء", difficulty: "easy", question: "كم كوكباً في المجموعة الشمسية؟", options: ["7", "8", "9", "10"], correctIndex: 1 },
  { id: "q1019", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب الأحمر؟", options: ["الزهرة", "المريخ", "المشتري", "زحل"], correctIndex: 1 },
  { id: "q1020", category: "فضاء", difficulty: "medium", question: "ما اسم أقرب نجم إلى الأرض؟", options: ["الشمس", "بروكسيما سنتوري", "سيريوس", "الشعرى اليمانية"], correctIndex: 0 },
  { id: "q1021", category: "فضاء", difficulty: "hard", question: "ما هي المجرّة التي توجد بها الأرض؟", options: ["درب التبانة", "أندروميدا", "مجموعة العذراء", "مجرة السافان"], correctIndex: 0 },
  { id: "q1022", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب الأكبر في المجموعة الشمسية؟", options: ["زحل", "المشتري", "نبتون", "أورانوس"], correctIndex: 1 },
  { id: "q1023", category: "فضاء", difficulty: "hard", question: "من أول رائدة فضاء امرأة؟", options: ["فالنتينا تيريشكوفا", "سالي رايد", "ماي جيميسون", "سويتلانا سافيتسكايا"], correctIndex: 0 },
  { id: "q1024", category: "فضاء", difficulty: "medium", question: "كم قمراً لكوكب المريخ؟", options: ["0", "1", "2", "3"], correctIndex: 2 },
  { id: "q1025", category: "فضاء", difficulty: "easy", question: "ما اسم أول قمر صناعي؟", options: ["سبوتنيك 1", "أبولو 11", "فوياجر 1", "هابل"], correctIndex: 0 },

  // ── موسيقى ───────────────────────────────────────────────────────────
  { id: "q1026", category: "موسيقى", difficulty: "easy", question: "كم وتراً في الجيتار القياسي؟", options: ["4", "5", "6", "7"], correctIndex: 2 },
  { id: "q1027", category: "موسيقى", difficulty: "medium", question: "من لُقّب بـ«ملك البوب»؟", options: ["مايكل جاكسون", "إلفيس بريسلي", "بروس سبرينغستين", "بيلي جويل"], correctIndex: 0 },
  { id: "q1028", category: "موسيقى", difficulty: "medium", question: "من مؤلف السيمفونية الخامسة الشهيرة؟", options: ["بيتهوفن", "موتسارت", "باخ", "شوبان"], correctIndex: 0 },
  { id: "q1029", category: "موسيقى", difficulty: "hard", question: "ما هي الآلة الوحيدة التي تُعزف بالنَفَس والأصابع معاً في الموسيقى العربية؟", options: ["الناي", "العود", "القانون", "الربابة"], correctIndex: 0 },
  { id: "q1030", category: "موسيقى", difficulty: "easy", question: "كم مفتاحاً في البيانو القياسي؟", options: ["76", "84", "88", "96"], correctIndex: 2 },
  { id: "q1031", category: "موسيقى", difficulty: "medium", question: "من الفنان العربي الملقب بـ«كوكب الشرق»؟", options: ["أم كلثوم", "فيروز", "أسمهان", "ليلى مراد"], correctIndex: 0 },
  { id: "q1032", category: "موسيقى", difficulty: "medium", question: "ما الآلة ذات الوتر الواحد في التراث العربي؟", options: ["الربابة", "العود", "القانون", "الناي"], correctIndex: 0 },

  // ── دين وثقافة ──────────────────────────────────────────────────────
  { id: "q1033", category: "دين وثقافة", difficulty: "easy", question: "كم عدد أركان الإسلام؟", options: ["4", "5", "6", "7"], correctIndex: 1 },
  { id: "q1034", category: "دين وثقافة", difficulty: "medium", question: "ما هي أطول سورة في القرآن الكريم؟", options: ["البقرة", "آل عمران", "النساء", "المائدة"], correctIndex: 0 },
  { id: "q1035", category: "دين وثقافة", difficulty: "easy", question: "كم عدد أسطر الحج في السنة؟", options: ["1", "2", "3", "4"], correctIndex: 0 },
  { id: "q1036", category: "دين وثقافة", difficulty: "medium", question: "ما اسم أول مسجد بُني في الإسلام؟", options: ["المسجد النبوي", "مسجد قباء", "المسجد الحرام", "المسجد الأقصى"], correctIndex: 1 },
  { id: "q1037", category: "دين وثقافة", difficulty: "hard", question: "كم عدد الصفحات في المصحف الشريف تقريباً (بعدد الأجزاء)؟", options: ["30 جزءاً", "40 جزءاً", "60 جزءاً", "20 جزءاً"], correctIndex: 0 },
  { id: "q1038", category: "دين وثقافة", difficulty: "medium", question: "في أي شهر يصوم المسلمون؟", options: ["رجب", "شعبان", "رمضان", "شوال"], correctIndex: 2 },
  { id: "q1039", category: "دين وثقافة", difficulty: "easy", question: "ما هو الحج الذي يُسمى «حجة الوداع»؟", options: ["حجة النبي ﷺ الأخيرة", "حجة عمر", "حجة عثمان", "حجة علي"], correctIndex: 0 },

  // ── جسم الإنسان ─────────────────────────────────────────────────────
  { id: "q1040", category: "جسم الإنسان", difficulty: "easy", question: "كم عدد أسنان البالغ الطبيعية؟", options: ["28", "30", "32", "34"], correctIndex: 2 },
  { id: "q1041", category: "جسم الإنسان", difficulty: "medium", question: "ما هو العضو الذي ينتج الأنسولين؟", options: ["الكبد", "البنكرياس", "الكلية", "الطحال"], correctIndex: 1 },
  { id: "q1042", category: "جسم الإنسان", difficulty: "medium", question: "كم لتراً من الدم يملك جسم البالغ تقريباً؟", options: ["3", "5", "7", "9"], correctIndex: 1 },
  { id: "q1043", category: "جسم الإنسان", difficulty: "hard", question: "ما هو أطول عظم في جسم الإنسان؟", options: ["عظم الفخذ", "عظم الساق", "عظم الحوض", "عظم الترقوة"], correctIndex: 0 },
  { id: "q1044", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو المسؤول عن ضخ الدم؟", options: ["الرئة", "القلب", "الكبد", "الدماغ"], correctIndex: 1 },
  { id: "q1045", category: "جسم الإنسان", difficulty: "medium", question: "كم زوجاً من الأضلاع في القفص الصدري؟", options: ["10", "11", "12", "13"], correctIndex: 2 },
  { id: "q1046", category: "جسم الإنسان", difficulty: "medium", question: "ما هي أصغر عظمة في جسم الإنسان؟", options: ["الركاب في الأذن", "السلامية", "القضمة", "عظم الأنف"], correctIndex: 0 },

  // ── منوعات ───────────────────────────────────────────────────────────
  { id: "q1047", category: "منوعات", difficulty: "easy", question: "ما هو الحيوان الرمزي لعيد الفصح؟", options: ["الأرنب", "الدجاجة", "الخروف", "الحمامة"], correctIndex: 0 },
  { id: "q1048", category: "منوعات", difficulty: "medium", question: "ما هو اللون المفضل لدى معظم البشر وفق الدراسات؟", options: ["الأزرق", "الأحمر", "الأخضر", "الأسود"], correctIndex: 0 },
  { id: "q1049", category: "منوعات", difficulty: "medium", question: "كم ساعة ينام الأسد يومياً؟", options: ["4 ساعات", "8 ساعات", "12-16 ساعة", "20 ساعة"], correctIndex: 2 },
  { id: "q1050", category: "منوعات", difficulty: "hard", question: "ما هو أول شيء يصنعه الإنسان عادةً من الطين؟", options: ["الفخار", "الطوب", "الورق", "الزجاج"], correctIndex: 0 },
  { id: "q1051", category: "منوعات", difficulty: "easy", question: "ما هو الشعار الذي يُمثّل السلام عالمياً؟", options: ["الحمامة", "النسر", "الأسد", "الذئب"], correctIndex: 0 },
  { id: "q1052", category: "منوعات", difficulty: "medium", question: "كم عدد ألوان علم دولة الإمارات؟", options: ["3", "4", "5", "6"], correctIndex: 1 },
  { id: "q1053", category: "منوعات", difficulty: "easy", question: "ما هو الطائر الذي لا يطير ويعيش في أنتاركتيكا؟", options: ["البطريق", "النعامة", "الكيوي", "الكرسوب"], correctIndex: 0 },

  // ── ألغاز وأحاجي ────────────────────────────────────────────────────
  { id: "q1054", category: "ألغاز وأحاجي", difficulty: "medium", question: "شيء يُكتب ولا يُقرأ، ويُجرح ولا يُلتئم؟", options: ["القلب", "الورق", "الجرح", "الكتاب"], correctIndex: 0 },
  { id: "q1055", category: "ألغاز وأحاجي", difficulty: "medium", question: "له أصابع بلا يد، ويُمسك بلا عين؟", options: ["القفاز", "الحذاء", "القبعة", "الكم"], correctIndex: 0 },
  { id: "q1056", category: "ألغاز وأحاجي", difficulty: "hard", question: "شيء يمشي بلا قدم ويبكي بلا عين؟", options: ["السحاب", "الريح", "النهر", "الساعة"], correctIndex: 0 },
  { id: "q1057", category: "ألغاز وأحاجي", difficulty: "easy", question: "ما هو الشيء الذي يزيد ولا ينقص أبداً؟", options: ["العمر", "المال", "الماء", "الهواء"], correctIndex: 0 },
  { id: "q1058", category: "ألغاز وأحاجي", difficulty: "medium", question: "بيت بلا أبواب ولا نوافذ، يسكنه من لا يموت؟", options: ["القبور", "البيت الشعري", "القفص", "المسجد"], correctIndex: 1 },

  // ── ملاحظة ودقة ─────────────────────────────────────────────────────
  { id: "q1059", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة مختلفة: تفاح، برتقال، موز، جزر؟", options: ["تفاح", "برتقال", "موز", "جزر"], correctIndex: 3 },
  { id: "q1060", category: "ملاحظة ودقة", difficulty: "medium", question: "أي رقم يختلف: 2، 3، 5، 7، 9، 11؟", options: ["3", "5", "9", "11"], correctIndex: 2 },
  { id: "q1061", category: "ملاحظة ودقة", difficulty: "hard", question: "أي كلمة مختلفة: قطة، نمر، أسد، حصان؟", options: ["قطة", "نمر", "أسد", "حصان"], correctIndex: 3 },
  { id: "q1062", category: "ملاحظة ودقة", difficulty: "medium", question: "أي شكل مختلف: مربع، مستطيل، مثلث، دائرة؟", options: ["مربع", "مستطيل", "مثلث", "دائرة"], correctIndex: 3 },
  { id: "q1063", category: "ملاحظة ودقة", difficulty: "easy", question: "أي لون مختلف: أحمر، أخضر، أزرق، مربع؟", options: ["أحمر", "أخضر", "أزرق", "مربع"], correctIndex: 3 },
];

// ── دفعة إضافية — قطع حاجز الألف (q1100+) ─────────────────────────────
export const MEGA_PACK_5B: Question[] = [
  { id: "q1101", category: "عام", difficulty: "medium", question: "ما هي عاصمة البرازيل؟", options: ["ريو دي جانيرو", "ساو باولو", "برازيليا", "سلفادور"], correctIndex: 2 },
  { id: "q1102", category: "عام", difficulty: "easy", question: "كم لوناً في قوس قزح المذكورة عادةً؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q1103", category: "عام", difficulty: "medium", question: "ما هو أكبر محيط مساحةً؟", options: ["الأطلسي", "الهندي", "الهادئ", "المتجمد"], correctIndex: 2 },
  { id: "q1104", category: "علوم", difficulty: "medium", question: "ما هو الرمز الكيميائي للصوديوم؟", options: ["So", "Na", "S", "Sd"], correctIndex: 1 },
  { id: "q1105", category: "علوم", difficulty: "hard", question: "ما هو الجسيم المتحمل بالشحنة السالبة؟", options: ["البروتون", "النيوترون", "الإلكترون", "البوزيترون"], correctIndex: 2 },
  { id: "q1106", category: "علوم", difficulty: "easy", question: "ما هي الظاهرة التي تُميّز القوس قزح؟", options: ["الانعكاس والانكسار", "التفكك", "الحيود", "كل ما سبق"], correctIndex: 3 },
  { id: "q1107", category: "جغرافيا", difficulty: "hard", question: "ما هي أصغر دولة عربية مساحةً؟", options: ["لبنان", "البحرين", "قطر", "الكويت"], correctIndex: 1 },
  { id: "q1108", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة المغرب؟", options: ["الدار البيضاء", "الرباط", "مراكش", "فاس"], correctIndex: 1 },
  { id: "q1109", category: "رياضيات", difficulty: "medium", question: "ما ناتج 15٪ من 200؟", options: ["25", "30", "35", "40"], correctIndex: 1 },
  { id: "q1110", category: "رياضيات", difficulty: "hard", question: "ما هو مجموع الزوايا الداخلية للرباعي؟", options: ["180", "270", "360", "450"], correctIndex: 2 },
  { id: "q1111", category: "لغة", difficulty: "medium", question: "ما جمع كلمة «كتاب»؟", options: ["كتبان", "كتب", "كتابات", "أكتبة"], correctIndex: 1 },
  { id: "q1112", category: "لغة", difficulty: "hard", question: "ما معنى «الجوهر»؟", options: ["السطح", "العَين والمضمون", "القشرة", "الغلاف"], correctIndex: 1 },
  { id: "q1113", category: "منطق", difficulty: "medium", question: "إذا كان اليوم الثلاثاء، فما اليوم بعد غد؟", options: ["الأربعاء", "الخميس", "الجمعة", "السبت"], correctIndex: 1 },
  { id: "q1114", category: "منطق", difficulty: "hard", question: "كلمة «مدام» قارأة من اليمين واليسار بنفس القراءة، ما اسم هذا النمط؟", options: ["متناوب", "متماثل (بالين دروم)", "مركب", "مشتق"], correctIndex: 1 },
  { id: "q1115", category: "تاريخ", difficulty: "medium", question: "من هو مؤسس المملكة العربية السعودية؟", options: ["الملك فيصل", "الملك عبدالعزيز آل سعود", "الملك سعود", "الملك فهد"], correctIndex: 1 },
  { id: "q1116", category: "تاريخ", difficulty: "hard", question: "متى كانت معركة عين جالوت؟", options: ["1258م", "1260م", "1291م", "1219م"], correctIndex: 1 },
  { id: "q1117", category: "رياضة", difficulty: "medium", question: "كم لاعباً في فريق كرة الطائرة داخل الملعب؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q1118", category: "رياضة", difficulty: "hard", question: "ما هي الدولة المستضيفة لكأس العالم 2022؟", options: ["روسيا", "قطر", "البرازيل", "كندا"], correctIndex: 1 },
  { id: "q1119", category: "فنون", difficulty: "medium", question: "من رسم لوحة «تحليق البشرية» الشهيرة «الصرخة»؟", options: ["إدفارد مونك", "غوستاف كليمت", "سالفادور دالي", "أوتو ديكس"], correctIndex: 0 },
  { id: "q1120", category: "فنون", difficulty: "medium", question: "ما هو الفن الإسلامي الأشهر في الزخرفة؟", options: ["الخط والنباتات الهندسية", "التماثيل", "اللوحات الزيتية", "الجرافيتي"], correctIndex: 0 },
  { id: "q1121", category: "تكنولوجيا", difficulty: "medium", question: "ماذا تعني AI؟", options: ["الذكاء الاصطناعي", "الإنترنت المتقدم", "الطيران الآلي", "التحليل الرقمي"], correctIndex: 0 },
  { id: "q1122", category: "تكنولوجيا", difficulty: "hard", question: "ما هي الشركة المطورة لنظام iOS؟", options: ["جوجل", "آبل", "مايكروسوفت", "سامسونغ"], correctIndex: 1 },
  { id: "q1123", category: "أفلام ومسلسلات", difficulty: "medium", question: "من مخرج فيلم «السابع والرعب» الشهير «ذا شاينينغ»؟", options: ["ستانلي كوبريك", "ألفريد هيتشكوك", "جون كاربنتر", "ويس كرافن"], correctIndex: 0 },
  { id: "q1124", category: "أفلام ومسلسلات", difficulty: "easy", question: "ما اسم الأسد الصغير في فيلم «الملك ليون»؟", options: ["سيمبا", "موفاسا", "سكار", "تيمون"], correctIndex: 0 },
  { id: "q1125", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو المشروب الأكثر استهلاكاً في العالم بعد الماء؟", options: ["الشاي", "القهوة", "العصير", "اللبن"], correctIndex: 0 },
  { id: "q1126", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو المكون الأساسي في صناعة الشوكولاتة؟", options: ["الكاكاو", "القرفة", "الفانيلا", "الكراميل"], correctIndex: 0 },
  { id: "q1127", category: "حيوانات", difficulty: "medium", question: "كم سنياً يعيش الفيل تقريباً؟", options: ["20 سنة", "40 سنة", "60-70 سنة", "100 سنة"], correctIndex: 2 },
  { id: "q1128", category: "حيوانات", difficulty: "hard", question: "ما هو الحيوان الذي يتنفس عبر جلده؟", options: ["الضفدع", "الثعلب", "الببغاء", "السنجاب"], correctIndex: 0 },
  { id: "q1129", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب الأكثر حرارةً في مجموعتنا الشمسية؟", options: ["عطارد", "الزهرة", "المريخ", "المشتري"], correctIndex: 1 },
  { id: "q1130", category: "فضاء", difficulty: "hard", question: "ما هي السنة التي هبط فيها الإنسان على القمر؟", options: ["1965", "1969", "1971", "1972"], correctIndex: 1 },
  { id: "q1131", category: "موسيقى", difficulty: "medium", question: "من الملحن الألماني الشهير الذي أصابه الصمّ؟", options: ["بيتهوفن", "موتسارت", "هامل", "فاغنر"], correctIndex: 0 },
  { id: "q1132", category: "موسيقى", difficulty: "easy", question: "كم صفاً في مفاتيح البيانو البيضاء؟", options: ["42", "52", "62", "72"], correctIndex: 1 },
  { id: "q1133", category: "دين وثقافة", difficulty: "medium", question: "كم عدد الحجاج الواجب عليهم الوصول في عرفة؟", options: ["9 ذي الحجة", "10 ذي الحجة", "8 ذي الحجة", "7 ذي الحجة"], correctIndex: 0 },
  { id: "q1134", category: "دين وثقافة", difficulty: "easy", question: "كم عدد السور المكية تقريباً في القرآن؟", options: ["86", "28", "50", "60"], correctIndex: 0 },
  { id: "q1135", category: "جسم الإنسان", difficulty: "medium", question: "أين يوجد أقسى عظم في جسم الإنسان؟", options: ["عظم الفخذ", "عظم الفك", "الترقوة", "الساعد"], correctIndex: 0 },
  { id: "q1136", category: "جسم الإنسان", difficulty: "hard", question: "ما هو الدماغ المسؤول عن التوازن؟", options: ["المخيخ", "المخ", "جذع الدماغ", "النخاع"], correctIndex: 0 },
  { id: "q1137", category: "منوعات", difficulty: "medium", question: "ما هو الشعار الوطني لكندا؟", options: ["ورقة القيقب", "النسر", "الأسد", "التنين"], correctIndex: 0 },
  { id: "q1138", category: "منوعات", difficulty: "easy", question: "ما هو الحيوان الأليف الأشهر عالمياً؟", options: ["الكلب", "القطة", "الطائر", "السمكة"], correctIndex: 0 },
  { id: "q1139", category: "ألغاز وأحاجي", difficulty: "medium", question: "شيء إذا كسرته يعمل أفضل، ما هو؟", options: ["البيضة", "المرآة", "الفرع", "الحجر"], correctIndex: 0 },
  { id: "q1140", category: "ألغاز وأحاجي", difficulty: "hard", question: "كلما أخذت منه كبر، ما هو؟", options: ["الحفرة", "الكنز", "العلم", "الماء"], correctIndex: 0 },
  { id: "q1141", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة مختلفة: سيف، خنجر، رمح، قلم؟", options: ["سيف", "خنجر", "رمح", "قلم"], correctIndex: 3 },
  { id: "q1142", category: "ملاحظة ودقة", difficulty: "hard", question: "أي مجموعة تحتوي على عنصر شاذ: 4، 9، 16، 20، 25؟", options: ["4", "16", "20", "25"], correctIndex: 2 },
];
