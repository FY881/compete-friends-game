/**
 * بنك الأسئلة الأوفلاين — 300 سؤال على 30 مرحلة (10 أسئلة لكل مرحلة).
 * تتراوح من السهل إلى الأسطوري مع تنوع كامل في المواضيع.
 */

export interface OfflineQuestion {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correctIndex: number;
  stage: number; // 1-30
  reward: number; // XP reward
}

export const OFFLINE_QUESTION_BANK: OfflineQuestion[] = [
  // ═══════════════════════════════════════════════════════════════
  // المرحلة 1-5: سهل (100 XP لكل سؤال)
  // ═══════════════════════════════════════════════════════════════
  // Stage 1 — معلومات عامة أساسية
  { id: "o1", category: "معلومات عامة", difficulty: "easy", question: "ما هي عاصمة فرنسا؟", options: ["برلين", "باريس", "مدريد", "روما"], correctIndex: 1, stage: 1, reward: 100 },
  { id: "o2", category: "معلومات عامة", difficulty: "easy", question: "كم عدد كواكب المجموعة الشمسية؟", options: ["7", "8", "9", "10"], correctIndex: 1, stage: 1, reward: 100 },
  { id: "o3", category: "معلومات عامة", difficulty: "easy", question: "ما هو أكبر محيط في العالم؟", options: ["الأطلسي", "الهندي", "الهادئ", "الشمالي"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o4", category: "معلومات عامة", difficulty: "easy", question: "في أي قارة تقع مصر؟", options: ["آسيا", "أوروبا", "أفريقيا", "أمريكا"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o5", category: "معلومات عامة", difficulty: "easy", question: "ما هو الحيوان الأسرع في العالم؟", options: ["الأسد", "الفهد", "الحصان", "النسر"], correctIndex: 1, stage: 1, reward: 100 },
  { id: "o6", category: "معلومات عامة", difficulty: "easy", question: "كم عدد أضلاع المثلث؟", options: ["2", "3", "4", "5"], correctIndex: 1, stage: 1, reward: 100 },
  { id: "o7", category: "معلومات عامة", difficulty: "easy", question: "ما هو نهر الأمازون؟", options: ["بحيرة", "نهر", "جبال", "صحراء"], correctIndex: 1, stage: 1, reward: 100 },
  { id: "o8", category: "معلومات عامة", difficulty: "easy", question: "أين يقع برج إيفل؟", options: ["لندن", "روما", "باريس", "برلين"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o9", category: "معلومات عامة", difficulty: "easy", question: "ما هو اللون الذي يرمز للسلام؟", options: ["الأحمر", "الأزرق", "الأبيض", "الأسود"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o10", category: "معلومات عامة", difficulty: "easy", question: "كم عدد أيام السنة؟", options: ["360", "364", "365", "366"], correctIndex: 2, stage: 1, reward: 100 },

  // Stage 2 — علوم أساسية
  { id: "o11", category: "علوم", difficulty: "easy", question: "ما هو المعدن الذي يُعرف بالargentum؟", options: ["الذهب", "الفضة", "النحاس", "الحديد"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o12", category: "علوم", difficulty: "easy", question: "كم عدد عظام جسم الإنسان البالغ تقريباً؟", options: ["106", "206", "306", "406"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o13", category: "علوم", difficulty: "easy", question: "ما هو الغاز الذي نتنفسه؟", options: ["الهيدروجين", "النيتروجين", "الأكسجين", "ثانيأكسيد الكربون"], correctIndex: 2, stage: 2, reward: 100 },
  { id: "o14", category: "علوم", difficulty: "easy", question: "ما هي وظيفة القلب؟", options: ["التنفس", "ضخ الدم", "هضم الطعام", "过滤 الدم"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o15", category: "علوم", difficulty: "easy", question: "كم عدد الكواكب التي تدور حول الشمس؟", options: ["7", "8", "9", "10"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o16", category: "علوم", difficulty: "easy", question: "ما هو الكوكب الأحمر؟", options: ["المشتري", "زحل", "المريخ", "عطارد"], correctIndex: 2, stage: 2, reward: 100 },
  { id: "o17", category: "علوم", difficulty: "easy", question: "ما هيghestMountains in the world؟", options: ["كيليمنجارو", "الإفرست", "ك2", "مون بلان"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o18", category: "علوم", difficulty: "easy", question: "ما هو المرض الذي تسببه نقص فيتامين C؟", options: ["السكري", "السرطان", "القرابي", "السل"], correctIndex: 2, stage: 2, reward: 100 },
  { id: "o19", category: "علوم", difficulty: "easy", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o20", category: "علوم", difficulty: "easy", question: "كم عدد أضلاع المربع؟", options: ["3", "4", "5", "6"], correctIndex: 1, stage: 2, reward: 100 },

  // Stage 3 — جغرافيا
  { id: "o21", category: "جغرافيا", difficulty: "easy", question: "ما هي أكبر دولة في العالم من حيث المساحة؟", options: ["الصين", "أمريكا", "كندا", "روسيا"], correctIndex: 3, stage: 3, reward: 100 },
  { id: "o22", category: "جغرافيا", difficulty: "easy", question: "أين يقع نهر النيل؟", options: ["آسيا", "أوروبا", "أفريقيا", "أمريكا"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o23", category: "جغرافيا", difficulty: "easy", question: "ما هي أصغر دولة في العالم؟", options: ["موناكو", "الفاتيكان", "سان مارينو", "لوكسمبورغ"], correctIndex: 1, stage: 3, reward: 100 },
  { id: "o24", category: "جغرافيا", difficulty: "easy", question: "في أي دولة يقع تاج محل؟", options: ["باكستان", "بنغلاديش", "الهند", "سريلانكا"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o25", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة اليابان؟", options: ["بكين", "سيول", "طوكيو", "بانكوك"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o26", category: "جغرافيا", difficulty: "easy", question: "أين يقع بحر الميت؟", options: ["مصر", "الأردن وفلسطين", "السعودية", "تركيا"], correctIndex: 1, stage: 3, reward: 100 },
  { id: "o27", category: "جغرافيا", difficulty: "easy", question: "كم عدد قارات العالم؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o28", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة ألمانيا؟", options: ["ميونخ", "فرانكفورت", "برلين", "هامبورغ"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o29", category: "جغرافيا", difficulty: "easy", question: "ما هو أطول نهر في أفريقيا؟", options: ["الكونغو", "النيجر", "النيل", "زامبيزي"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o30", category: "جغرافيا", difficulty: "easy", question: "في أي قارة تقع البرازيل؟", options: ["أمريكا الشمالية", "أوروبا", "أمريكا الجنوبية", "أفريقيا"], correctIndex: 2, stage: 3, reward: 100 },

  // Stage 4 — تراث وثقافة عربية
  { id: "o31", category: "ثقافة عربية", difficulty: "easy", question: "من هو مخترع Algebra في العالم الإسلامي؟", options: ["الخوارزمي", "ابن سينا", "ابن الهيثم", "البيروني"], correctIndex: 0, stage: 4, reward: 100 },
  { id: "o32", category: "ثقافة عربية", difficulty: "easy", question: "ما هي أطول سورة في القرآن الكريم؟", options: ["البقرة", "آل عمران", "المائدة", "الأعراف"], correctIndex: 0, stage: 4, reward: 100 },
  { id: "o33", category: "ثقافة عربية", difficulty: "easy", question: "ما هي عاصمة المملكة العربية السعودية؟", options: ["جدة", "مكة المكرمة", "الرياض", "المدينة المنورة"], correctIndex: 2, stage: 4, reward: 100 },
  { id: "o34", category: "ثقافة عربية", difficulty: "easy", question: "في أي عام كانت هجرة النبي صلى الله عليه وسلم؟", options: ["620 م", "622 م", "624 م", "630 م"], correctIndex: 1, stage: 4, reward: 100 },
  { id: "o35", category: "ثقافة عربية", difficulty: "easy", question: "ما هو اسم الكتاب المقدس للuslimين؟", options: ["التوراة", "الإنجيل", "القرآن", "الزبور"], correctIndex: 2, stage: 4, reward: 100 },
  { id: "o36", category: "ثقافة عربية", difficulty: "easy", question: "كم عدد أعمدة الإسلام؟", options: ["3", "4", "5", "6"], correctIndex: 2, stage: 4, reward: 100 },
  { id: "o37", category: "ثقافة عربية", difficulty: "easy", question: "من هو مؤسس الدولة الأموية؟", options: ["عمر بن عبد العزيز", "معاوية بن أبي سفيان", "عبد الملك بن مروان", "الوليد بن عبد الملك"], correctIndex: 1, stage: 4, reward: 100 },
  { id: "o38", category: "ثقافة عربية", difficulty: "easy", question: "ما هي أقدم جامعة في العالم الإسلامي؟", options: ["الزهراء", "الأزهر", "القرويين", "الزيتونة"], correctIndex: 2, stage: 4, reward: 100 },
  { id: "o39", category: "ثقافة عربية", difficulty: "easy", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 4, reward: 100 },
  { id: "o40", category: "ثقافة عربية", difficulty: "easy", question: "ما هي لغة القرآن الكريم؟", options: ["الفارسية", "العربية", "التركية", "ال Geek"], correctIndex: 1, stage: 4, reward: 100 },

  // Stage 5 — ترفيه وأفلام
  { id: "o41", category: "ترفيه", difficulty: "easy", question: "من بطل فيلم Titanic؟", options: ["توم هانكس", "ليوناردو ديكابريو", "براد بيت", "ويل سميث"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o42", category: "ترفيه", difficulty: "easy", question: "ما هو اسم الساحر في فيلم Harry Potter؟", options: ["فولدمورت", "هاري بوتر", "رون ويزلي", "دومبادور"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o43", category: "ترفيه", difficulty: "easy", question: "من غنى أغنية Thriller؟", options: ["بروس سبرينغستين", "مايكل جاكسون", "إلتون جون", "فريدي ميركوري"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o44", category: "ترفيه", difficulty: "easy", question: "ما هي أشهر ألعاب الألعاب الأولمبية؟", options: ["السباحة", "ألعاب القوى", "الجمباز", "الملاكمة"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o45", category: "ترفيه", difficulty: "easy", question: "من هو مخترع المصباح الكهربائي؟", options: ["تسلا", "إديسون", "بل", "ماركوني"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o46", category: "ترفيه", difficulty: "easy", question: "ما هي عاصمة إيطاليا؟", options: ["ميلانو", "روما", "نابولي", "تورينو"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o47", category: "ترفيه", difficulty: "easy", question: "في أي سنة تأسس نادي برشلونة؟", options: ["1899", "1902", "1910", "1920"], correctIndex: 0, stage: 5, reward: 100 },
  { id: "o48", category: "ترفيه", difficulty: "easy", question: "ما هو الشعار الرسمي لنادي ريال مدريد؟", options: ["نسر", "أسد", "دب", "نمر"], correctIndex: 0, stage: 5, reward: 100 },
  { id: "o49", category: "ترفيه", difficulty: "easy", question: "كم عدد لاعبي فريق كرة القدم في الملعب؟", options: ["9", "10", "11", "12"], correctIndex: 2, stage: 5, reward: 100 },
  { id: "o50", category: "ترفيه", difficulty: "easy", question: "من هو أشهر لاعب كرة قدم في التاريخ؟", options: ["رونالدو", "ميسي", "بيله", "مارادونا"], correctIndex: 1, stage: 5, reward: 100 },

  // ═══════════════════════════════════════════════════════════════
  // المرحلة 6-10: متوسط (200 XP لكل سؤال)
  // ═══════════════════════════════════════════════════════════════
  // Stage 6 — تاريخ
  { id: "o51", category: "تاريخ", difficulty: "medium", question: "في أي سنة سقطت الإمبراطورية الرومانية الغربية؟", options: ["376 م", "410 م", "476 م", "527 م"], correctIndex: 2, stage: 6, reward: 200 },
  { id: "o52", category: "تاريخ", difficulty: "medium", question: "من هو أول خليفة راشدي؟", options: ["عمر بن الخطاب", "أبو بكر الصديق", "عثمان بن عفان", "علي بن أبي طالب"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o53", category: "تاريخ", difficulty: "medium", question: "في أي سنة انتهت الحرب العالمية الثانية؟", options: ["1943", "1944", "1945", "1946"], correctIndex: 2, stage: 6, reward: 200 },
  { id: "o54", category: "تاريخ", difficulty: "medium", question: "من هو قائد معركة عين جالوت؟", options: ["صلاح الدين الأيوبي", "سيف الدين قطز", "الظاهر بيبرس", "الناصر محمد بن قلاوون"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o55", category: "تاريخ", difficulty: "medium", question: "ما هي أقدم حضارة في التاريخ؟", options: ["المصرية", "السومرية", "الصينية", "الهندية"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o56", category: "تاريخ", difficulty: "medium", question: "في أي سنة تم فتح القسطنطينية؟", options: ["1451", "1453", "1455", "1460"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o57", category: "تاريخ", difficulty: "medium", question: "من هو مخترع الطباعة؟", options: ["غutenberg", "إديسون", "غاليليو", "ديكارت"], correctIndex: 0, stage: 6, reward: 200 },
  { id: "o58", category: "تاريخ", difficulty: "medium", question: "ما هي دولة الاستكشاف الكبرى في عصر النهضة؟", options: ["إنجلترا", "فرنسا", "إسبانيا والبرتغال", "هولندا"], correctIndex: 2, stage: 6, reward: 200 },
  { id: "o59", category: "تاريخ", difficulty: "medium", question: "في أي سنة أعلنت أمريكا استقلالها؟", options: ["1774", "1776", "1778", "1780"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o60", category: "تاريخ", difficulty: "medium", question: "من هو الفاتح العثماني للقسطنطينية؟", options: ["بايزيد الثاني", "محمد الفاتح", "سليم الأول", "سليمان القانوني"], correctIndex: 1, stage: 6, reward: 200 },

  // Stage 7 — علوم متقدمة
  { id: "o61", category: "علوم", difficulty: "medium", question: "ما هو العنصر الكيميائي الذي رمزه O؟", options: ["الذهب", "الأكسجين", "الفضة", "النحاس"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o62", category: "علوم", difficulty: "medium", question: "كم عدد الكروموسومات في خلية الإنسان العادية؟", options: ["23", "44", "46", "48"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o63", category: "علوم", difficulty: "medium", question: "ما هي سرعة الضوء تقريباً؟", options: ["200,000 كم/ث", "300,000 كم/ث", "400,000 كم/ث", "500,000 كم/ث"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o64", category: "علوم", difficulty: "medium", question: "ما هو المستوي الأول للطاقة في المجموعة الشمسية؟", options: ["المشتري", "الشمس", "الترابي", "زحل"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o65", category: "علوم", difficulty: "medium", question: "ما هو العنصر الذي يشكل حوالي 78% من الغلاف الجوي؟", options: ["الأكسجين", "الهيدروجين", "النيتروجين", " ثانيأكسيد الكربون"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o66", category: "علوم", difficulty: "medium", question: "كم عدد فصوص الدماغ؟", options: ["2", "3", "4", "5"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o67", category: "علوم", difficulty: "medium", question: "ما هو العنصر الكيميائي الذي رمزه Fe؟", options: ["النحاس", "الفضة", "الحديد", "الذهب"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o68", category: "علوم", difficulty: "medium", question: "ما هي الوظيفة الرئيسية للكبد؟", options: ["التنفس", "تصفية الدم", "هضم الطعام", "إنتاج الأنسولين"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o69", category: "علوم", difficulty: "medium", question: "ما هو نموذج الذرة الذي طرحه نيلز بور؟", options: ["النموذج الكروي", "النموذج الذري", "النموذج المداري", "النموذج الكواركي"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o70", category: "علوم", difficulty: "medium", question: "كم عدد حواس الإنسان الأساسية؟", options: ["4", "5", "6", "7"], correctIndex: 2, stage: 7, reward: 200 },

  // Stage 8 — رياضيات
  { id: "o71", category: "رياضيات", difficulty: "medium", question: "ما هي الجذر التربيعي للعدد 144؟", options: ["10", "11", "12", "13"], correctIndex: 2, stage: 8, reward: 200 },
  { id: "o72", category: "رياضيات", difficulty: "medium", question: "ما هو العدد الأولي التالي بعد 13؟", options: ["14", "15", "16", "17"], correctIndex: 3, stage: 8, reward: 200 },
  { id: "o73", category: "رياضيات", difficulty: "medium", question: "كم ناتج 15 × 15؟", options: ["200", "225", "250", "275"], correctIndex: 1, stage: 8, reward: 200 },
  { id: "o74", category: "رياضيات", difficulty: "medium", question: "ما هو قيمة π تقريباً؟", options: ["3.12", "3.14", "3.16", "3.18"], correctIndex: 1, stage: 8, reward: 200 },
  { id: "o75", category: "رياضيات", difficulty: "medium", question: "إذا كان س + 5 = 12، فما قيمة س؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 8, reward: 200 },
  { id: "o76", category: "رياضيات", difficulty: "medium", question: "ما هي مساحة مستطيل طوله 8 وعرضه 5؟", options: ["13", "30", "40", "60"], correctIndex: 2, stage: 8, reward: 200 },
  { id: "o77", category: "رياضيات", difficulty: "medium", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 8, reward: 200 },
  { id: "o78", category: "رياضيات", difficulty: "medium", question: "ما هي ناتج 2 اس 10؟", options: ["512", "1024", "2048", "4096"], correctIndex: 1, stage: 8, reward: 200 },
  { id: "o79", category: "رياضيات", difficulty: "medium", question: "ما هو العدد الذهبي تقريباً؟", options: ["1.414", "1.618", "2.236", "2.718"], correctIndex: 1, stage: 8, reward: 200 },
  { id: "o80", category: "رياضيات", difficulty: "medium", question: "ما هي ناتج cos(60 درجة)؟", options: ["0.25", "0.5", "0.75", "1"], correctIndex: 1, stage: 8, reward: 200 },

  // Stage 9 — سينما وموسيقى
  { id: "o81", category: "أفلام ومسلسلات", difficulty: "medium", question: "من أخرج فيلم Avatar (2009)؟", options: ["ستيفن سبيلبرغ", "جيمس كاميرون", "كريستوفر نولان", " ريدينغ"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o82", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هي سلسلة أفلام Star Wars؟", options: ["كوميدية", "خيال علمي", "رعب", "رومانسية"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o83", category: "أفلام ومسلسلات", difficulty: "medium", question: "من لعب دور Iron Man في MCU؟", options: ["كريس إيفانز", "روبرت داوني جونيور", "كريس همسورث", "مارك رافالو"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o84", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو اسم المنصة التي عرضت مسلسل Game of Thrones؟", options: ["نتفلكس", "HBO", "أمازون برايم", "ديزني+"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o85", category: "أفلام ومسلسلات", difficulty: "medium", question: "كم عدد أفلام The Lord of the Rings الأصلية؟", options: ["2", "3", "4", "5"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o86", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هي مغنية أغنية Rolling in the Deep؟", options: ["تيلور سويفت", "أديل", "ريانا", "ليدي غاغا"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o87", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هي أول دولة أنتجت رسوماً متحركة (أنمي)؟", options: ["أمريكا", "اليابان", "فرنسا", "كوريا"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o88", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مخرج فيلم Inception؟", options: ["ستيفن سبيلبرغ", "كريستوفر نولان", "ريدلي سكوت", "ديفيد فينشر"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o89", category: "أفلام ومسلسلات", difficulty: "medium", question: "في أي عام صدر فيلم The Matrix الأول؟", options: ["1997", "1998", "1999", "2000"], correctIndex: 2, stage: 9, reward: 200 },
  { id: "o90", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مؤسس شركة Apple؟", options: ["بيل غيتس", "ستيف جوبز", "مارك زوكربيرغ", "إيلون ماسك"], correctIndex: 1, stage: 9, reward: 200 },

  // Stage 10 — تقنية
  { id: "o91", category: "تقنية", difficulty: "medium", question: "ما هو اختصار HTML؟", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"], correctIndex: 0, stage: 10, reward: 200 },
  { id: "o92", category: "تقنية", difficulty: "medium", question: "في أي سنة تأسس فيسبوك؟", options: ["2002", "2003", "2004", "2005"], correctIndex: 2, stage: 10, reward: 200 },
  { id: "o93", category: "تقنية", difficulty: "medium", question: "ما هو اختصار CPU؟", options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Core Processing Unit"], correctIndex: 0, stage: 10, reward: 200 },
  { id: "o94", category: "تقنية", difficulty: "medium", question: "ما هو أول هاتف ذكي من Apple؟", options: ["iPhone 3G", "iPhone 2G", "iPhone 4", "iPhone 5"], correctIndex: 1, stage: 10, reward: 200 },
  { id: "o95", category: "تقنية", difficulty: "medium", question: "ما هي لغة البرمجة الأكثر استخداماً في العالم؟", options: ["Python", "Java", "JavaScript", "C++"], correctIndex: 2, stage: 10, reward: 200 },
  { id: "o96", category: "تقنية", difficulty: "medium", question: "ما هو اختصار RAM؟", options: ["Random Access Memory", "Read Access Memory", "Run Access Memory", "Rapid Access Memory"], correctIndex: 0, stage: 10, reward: 200 },
  { id: "o97", category: "تقنية", difficulty: "medium", question: "كم بت比ت في 1 كيلوبايت؟", options: ["512", "1000", "1024", "2048"], correctIndex: 2, stage: 10, reward: 200 },
  { id: "o98", category: "تقنية", difficulty: "medium", question: "ما هو نظام التشغيل الذي طوره Linux؟", options: ["Windows", "macOS", "Linux", "Android"], correctIndex: 2, stage: 10, reward: 200 },
  { id: "o99", category: "تقنية", difficulty: "medium", question: "ما هو اختصار API؟", options: ["Application Programming Interface", "Advanced Program Integration", "Application Process Integration", "Advanced Programming Interface"], correctIndex: 0, stage: 10, reward: 200 },
  { id: "o100", category: "تقنية", difficulty: "medium", question: "في أي سنة أُنشئ أول بريد إلكتروني؟", options: ["1965", "1971", "1978", "1985"], correctIndex: 1, stage: 10, reward: 200 },

  // ═══════════════════════════════════════════════════════════════
  // المرحلة 11-20: صعب (300 XP لكل سؤال)
  // ═══════════════════════════════════════════════════════════════
  // Stage 11-15 — علوم وتقنية صعبة
  { id: "o101", category: "علوم", difficulty: "hard", question: "ما هو العنصر الكيميائي الذي رمزه Au؟", options: ["الفضة", "النحاس", "الذهب", "الألومنيوم"], correctIndex: 2, stage: 11, reward: 300 },
  { id: "o102", category: "علوم", difficulty: "hard", question: "ما هي وحدة قياس التيار الكهربائي؟", options: ["الفولت", "الأمبير", "الواط", "الأوم"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o103", category: "علوم", difficulty: "hard", question: "كم يبلغ عدد ذرات أفوجادرو؟", options: ["6.02 × 10²¹", "6.02 × 10²³", "6.02 × 10²⁵", "6.02 × 10²⁷"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o104", category: "علوم", difficulty: "hard", question: "ما هو العنصر الذي له أكبر عدد ذري؟", options: ["الأكسجين", "الكربون", "الحديد", "الأ꒦"], correctIndex: 2, stage: 11, reward: 300 },
  { id: "o105", category: "علوم", difficulty: "hard", question: "ما هي نظرية أينشتاين الشهيرة المعادلة她说 E=mc²؟", options: ["نظرية النسبية العامة", "نظرية النسبية الخاصة", "نظرية الأوتار", "نظرية الكم"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o106", category: "علوم", difficulty: "hard", question: "ما هو العنصر الذي رمزه Ag؟", options: ["الذهب", "الفضة", "الألومنيوم", "الزئبق"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o107", category: "علوم", difficulty: "hard", question: "كم عدد عظام جسم الإنسان adults?", options: ["106", "186", "206", "256"], correctIndex: 2, stage: 11, reward: 300 },
  { id: "o108", category: "علوم", difficulty: "hard", question: "ما هي أصغر وحدة في المادة؟", options: ["الذرة", "الجزيء", "البروتون", "الكوارك"], correctIndex: 3, stage: 11, reward: 300 },
  { id: "o109", category: "علوم", difficulty: "hard", question: "كم فيزتنا من الأرض إلى القمر؟", options: ["300,000 كم", "384,000 كم", "450,000 كم", "500,000 كم"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o110", category: "علوم", difficulty: "hard", question: "ما هو الغاز الذي يسبب الاحتباس الحراري؟", options: ["الأكسجين", "النيتروجين", " ثانيأكسيد الكربون", "الهيدروجين"], correctIndex: 2, stage: 11, reward: 300 },

  // Stage 12 — تاريخ متقدم
  { id: "o111", category: "تاريخ", difficulty: "hard", question: "في أي سنة سقط الخلافة العثمانية؟", options: ["1918", "1920", "1922", "1924"], correctIndex: 3, stage: 12, reward: 300 },
  { id: "o112", category: "تاريخ", difficulty: "hard", question: "من هو القائد المغولي الذي حكم أكبر إمبراطورية في التاريخ؟", options: ["جنكيز خان", "تيمورلنك", "أكبار", "خون خان"], correctIndex: 0, stage: 12, reward: 300 },
  { id: "o113", category: "تاريخ", difficulty: "hard", question: "ما هي أقدم لغة مكتوبة في التاريخ؟", options: ["العربية", "الهيروغليفية", "السومرية", "الصينية"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o114", category: "تاريخ", difficulty: "hard", question: "في أي سنة حُررت القدس في العهد الراشدي؟", options: ["633 م", "636 م", "638 م", "640 م"], correctIndex: 2, stage: 12, reward: 300 },
  { id: "o115", category: "تاريخ", difficulty: "hard", question: "من هو مؤسس الإمبراطورية الرومانية؟", options: [" يوليوس قيصر", "أوغسطس", "نيرون", "مارك أنطونيو"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o116", category: "تاريخ", difficulty: "hard", question: "في أي سنة كانت معركة بدر؟", options: ["1 هـ", "2 هـ", "3 هـ", "4 هـ"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o117", category: "تاريخ", difficulty: "hard", question: "ما هي أقدم ديمقراطية في التاريخ؟", options: ["الرومانية", "اليونانية", "الهندية", "الصينية"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o118", category: "تاريخ", difficulty: "hard", question: "من هو آخر ملوك فرنسا قبل الثورة؟", options: ["لويس 14", "لويس 15", "لويس 16", "لويس 18"], correctIndex: 2, stage: 12, reward: 300 },
  { id: "o119", category: "تاريخ", difficulty: "hard", question: "في أي سنة اخترع غوتنبرغ الطباعة؟", options: ["1440", "1450", "1460", "1470"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o120", category: "تاريخ", difficulty: "hard", question: "ما هي أول دولة استخدمت الورق النقدي؟", options: ["الصين", "الهند", "يابان", "كوريا"], correctIndex: 0, stage: 12, reward: 300 },

  // Stage 13 — جغرافيا صعبة
  { id: "o121", category: "جغرافيا", difficulty: "hard", question: "ما هي أعمق نقطة في المحيطات؟", options: ["خندق ماريانا", "خندق بورتو ريكو", "خندق تونغا", "خندق فيليبين"], correctIndex: 0, stage: 13, reward: 300 },
  { id: "o122", category: "جغرافيا", difficulty: "hard", question: "في أي دولة تقع جبال الأنديز؟", options: ["أمريكا الجنوبية فقط", "أمريكا الجنوبية وأمريكا الشمالية", "أوروبا", "آسيا"], correctIndex: 0, stage: 13, reward: 300 },
  { id: "o123", category: "جغرافيا", difficulty: "hard", question: "ما هي عاصمة استراليا؟", options: ["سيدني", "ملبورن", "كانبرا", "بريسبن"], correctIndex: 2, stage: 13, reward: 300 },
  { id: "o124", category: "جغرافيا", difficulty: "hard", question: "أين يقع أكبر صحراء في العالم؟", options: ["أفريقيا", "آسيا", "أمريكا الجنوبية", "القارة القطبية الجنوبية"], correctIndex: 3, stage: 13, reward: 300 },
  { id: "o125", category: "جغرافيا", difficulty: "hard", question: "ما هو أطول نهر في آسيا؟", options: ["النيل", "الغانج", "اليانغتسي", "الأموز"], correctIndex: 2, stage: 13, reward: 300 },
  { id: "o126", category: "جغرافيا", difficulty: "hard", question: "كم تبلغ مساحة الصحراء الكبرى؟", options: ["6 ملايين كم²", "9 ملايين كم²", "12 مليون كم²", "15 مليون كم²"], correctIndex: 1, stage: 13, reward: 300 },
  { id: "o127", category: "جغرافيا", difficulty: "hard", question: "ما هي عاصمة كندا؟", options: ["تورنتو", "مونتريال", "أوتاوا", "فانكوفر"], correctIndex: 2, stage: 13, reward: 300 },
  { id: "o128", category: "جغرافيا", difficulty: "hard", question: "في أي دولة يقع برج خليفة؟", options: ["قطر", "الإمارات", "السعودية", "البحرين"], correctIndex: 1, stage: 13, reward: 300 },
  { id: "o129", category: "جغرافيا", difficulty: "hard", question: "ما هي أكبر دولة في أفريقيا من حيث المساحة؟", options: ["نيجيريا", "الجزائر", "الكونغو", "السودان"], correctIndex: 1, stage: 13, reward: 300 },
  { id: "o130", category: "جغرافيا", difficulty: "hard", question: "كم عدد جزر إندونيسيا تقريباً؟", options: ["10,000", "14,000", "17,000", "20,000"], correctIndex: 2, stage: 13, reward: 300 },

  // Stage 14-15 — ثقافة ورياضة
  { id: "o131", category: "رياضة", difficulty: "hard", question: "كم مرة فاز البرازيل بكأس العالم؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o132", category: "رياضة", difficulty: "hard", question: "في أي دولة أُقيمت أول دورة أولمبية حديثة؟", options: ["إيطاليا", "يونان", "فرنسا", "إنجلترا"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o133", category: "رياضة", difficulty: "hard", question: "كم مساحة ملعب كرة القدم стандартياً؟", options: ["7,000 م²", "7,140 م²", "8,000 م²", "6,500 م²"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o134", category: "رياضة", difficulty: "hard", question: "من هو أكثر لاعب حصولاً على كرات ذهبية؟", options: ["رونالدو", "ميسي", "مودريتش", "إينييستا"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o135", category: "رياضة", difficulty: "hard", question: "في أي سنة أقيمت أول بطولة لكأس العالم لكرة القدم؟", options: ["1926", "1928", "1930", "1932"], correctIndex: 2, stage: 14, reward: 300 },
  { id: "o136", category: "رياضة", difficulty: "hard", question: "كم عدد ألوان الأعلام الأولمبية؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o137", category: "رياضة", difficulty: "hard", question: "ما هي أطول مسابقة سباحة في الأولمبياد؟", options: ["200 م", "400 م", "800 م", "1500 م"], correctIndex: 3, stage: 14, reward: 300 },
  { id: "o138", category: "رياضة", difficulty: "hard", question: "من هو أسرع عداء في التاريخ (100 م)؟", options: ["يوسين بولت", "تاي슨 غاي", "جاستن غاتلين", "أسافا باول"], correctIndex: 0, stage: 14, reward: 300 },
  { id: "o139", category: "رياضة", difficulty: "hard", question: "كم عدد مجموعات التنس في بطولة غراند سلام للرجال؟", options: ["3", "4", "5", "6"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o140", category: "رياضة", difficulty: "hard", question: "في أي دولة نشأ رياضة الكارتيه؟", options: ["اليابان", "الصين", "الهند", "كوريا"], correctIndex: 0, stage: 14, reward: 300 },

  { id: "o141", category: "ثقافة عربية", difficulty: "hard", question: "من هو مؤسس الفرائض في الإسلام؟", options: ["الخوارزمي", "الحسن بن الهيثم", "ابن الزبير", "أبو عبد الله الماجريتي"], correctIndex: 0, stage: 15, reward: 300 },
  { id: "o142", category: "ثقافة عربية", difficulty: "hard", question: "في أي مدينة وُلد ابن سينا؟", options: ["بخارى", "أصفهان", "باميان", "烧"], correctIndex: 0, stage: 15, reward: 300 },
  { id: "o143", category: "ثقافة عربية", difficulty: "hard", question: "ما هو أكبر كتاب عربي من حيث الحجم؟", options: ["الكامل في التاريخ", "لسان العرب", "البداية والنهاية", "تاريخ الطبري"], correctIndex: 1, stage: 15, reward: 300 },
  { id: "o144", category: "ثقافة عربية", difficulty: "hard", question: "من هو أول من أسس المدارس النظامية في الإسلام؟", options: ["المنصور العباسي", "المأمون العباسي", "هارون الرشيد", "المتوكل العباسي"], correctIndex: 1, stage: 15, reward: 300 },
  { id: "o145", category: "ثقافة عربية", difficulty: "hard", question: "ما هي أقدم مكتبة عامة في العالم الإسلامي؟", options: ["مكتبة الأزهر", "مكتبة القرويين", "مكتبة الزيتونة", "دار الحكمة"], correctIndex: 1, stage: 15, reward: 300 },
  { id: "o146", category: "ثقافة عربية", difficulty: "hard", question: "في أي سنة فتح المسلمين الأندلس؟", options: ["711 م", "715 م", "720 م", "732 م"], correctIndex: 0, stage: 15, reward: 300 },
  { id: "o147", category: "ثقافة عربية", difficulty: "hard", question: "من هو مخترع الساعة المائية؟", options: ["الخازني", "ابن الهيثم", "الفرابي", "ابن رشد"], correctIndex: 0, stage: 15, reward: 300 },
  { id: "o148", category: "ثقافة عربية", difficulty: "hard", question: "كم عدد أعمدة الإيمان؟", options: ["5", "6", "7", "8"], correctIndex: 1, stage: 15, reward: 300 },
  { id: "o149", category: "ثقافة عربية", difficulty: "hard", question: "ما هي أول دولة عربية استقلت عن الاستعمار؟", options: ["مصر", "ليبيا", "تونس", "المغرب"], correctIndex: 0, stage: 15, reward: 300 },
  { id: "o150", category: "ثقافة عربية", difficulty: "hard", question: "من هو صاحب كتاب \"الأغاني\"؟", options: ["الجاحظ", "أبو الفرج الأصفهاني", "ابن عبد ربه", "المتنبي"], correctIndex: 1, stage: 15, reward: 300 },

  // ═══════════════════════════════════════════════════════════════
  // المرحلة 16-25: صعب جداً + اختبار منطقي + بديهة
  // ═══════════════════════════════════════════════════════════════
  // Stage 16 — منطق وتفكير نقدي
  { id: "o151", category: "منطق", difficulty: "hard", question: "إذا كان جميع القطط حيوانات، وبعض الحيوانات ناطقة، فهل بعض القطط ناطقة؟", options: ["نعم بالتأكيد", "لا بالتأكيد", "ربما", "الstatement خاطئ"], correctIndex: 1, stage: 16, reward: 300 },
  { id: "o152", category: "منطق", difficulty: "hard", question: "أب عنده 3 أبناء، كل ابن عنده أخ واحد. كم عدد الأبناء؟", options: ["3", "4", "6", "9"], correctIndex: 0, stage: 16, reward: 300 },
  { id: "o153", category: "منطق", difficulty: "hard", question: ".Speed + Time = Distance. إذا كان المسافة تضاعفت والسرعة ثابتة، ماذا يحدث للوقت؟", options: ["يقل النصف", "يظل كما هو", "يضاعف", "يصبح صفر"], correctIndex: 2, stage: 16, reward: 300 },
  { id: "o154", category: "منطق", difficulty: "hard", question: "رجل يمشي جنوباً 5 كم، ثم شرقاً 5 كم، ثم شمالاً 5 كم، فيجد نفس المكان الذي بدأ منه. أين هو؟", options: ["القطب الجنوبي", "القطب الشمالي", "خط الاستواء", "في الصحراء"], correctIndex: 0, stage: 16, reward: 300 },
  { id: "o155", category: "منطق", difficulty: "hard", question: "ثعبان في صندوق مربع. إذا قطعت الصندوق من المنتصف أفقياً وعمودياً، كم قطعة ستكون؟", options: ["3", "4", "5", "6"], correctIndex: 2, stage: 16, reward: 300 },
  { id: "o156", category: "منطق", difficulty: "hard", question: "رقم مضاعف 6، أكبر من 20 وأصغر من 35. ما هو؟", options: ["24", "30", "36", "28"], correctIndex: 1, stage: 16, reward: 300 },
  { id: "o157", category: "منطق", difficulty: "hard", question: "إذا كان أمسriday، فماذا يكون بعد غد؟", options: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس"], correctIndex: 2, stage: 16, reward: 300 },
  { id: "o158", category: "منطق", difficulty: "hard", question: "5×5÷5+5-5 = ؟", options: ["0", "5", "10", "25"], correctIndex: 1, stage: 16, reward: 300 },
  { id: "o159", category: "منطق", difficulty: "hard", question: "أين يمكن أن تجد أantaGravity Naturally?", options: ["الفضاء", "القارة القطبية", "لا يوجد مكان", "المحيط"], correctIndex: 2, stage: 16, reward: 300 },
  { id: "o160", category: "منطق", difficulty: "hard", question: "كم مرة يظهر الرقم 3 من 1 إلى 100؟", options: ["18", "19", "20", "21"], correctIndex: 2, stage: 16, reward: 300 },

  // Stage 17-20 — ألغاز وبديهة
  { id: "o161", category: "ألغاز", difficulty: "hard", question: "شيء له رأس ولسان ولا يتكلم. ما هو؟", options: ["القلم", "الحذاء", "المفتاح", "الساعة"], correctIndex: 1, stage: 17, reward: 300 },
  { id: "o162", category: "ألغاز", difficulty: "hard", question: "شيء يزداد كلما أخذت منه. ما هو؟", options: ["المال", "الحفرة", "الماء", "الوقت"], correctIndex: 1, stage: 17, reward: 300 },
  { id: "o163", category: "ألغاز", difficulty: "hard", question: "شيء يمشي بلا أرجل. ما هو؟", options: ["الماء", "النهر", "الساعة", "الإنسان"], correctIndex: 2, stage: 17, reward: 300 },
  { id: "o164", category: "ألغاز", difficulty: "hard", question: "شيء يسمعك بلا أذن ويكلّمك بلا لسان. ما هو؟", options: ["الهاتف", "الراديو", "ال电视", "الصدى"], correctIndex: 0, stage: 17, reward: 300 },
  { id: "o165", category: "ألغاز", difficulty: "hard", question: "شيء يบكي بلا أن يتألم. ما هو؟", options: ["الطفل", "البصل", "القطة", "الغيمة"], correctIndex: 1, stage: 17, reward: 300 },
  { id: "o166", category: "ألغاز", difficulty: "hard", question: "شيء يمكنك كسره دون أن تلمسه. ما هو؟", options: ["الزجاج", "الصمت", "الحبل", "ال壺"], correctIndex: 1, stage: 18, reward: 300 },
  { id: "o167", category: "ألغاز", difficulty: "hard", question: "شيء له عيون لكن لا يرى. ما هو؟", options: ["الوجه", "البطاطس", "الإبرة", "الكتاب"], correctIndex: 1, stage: 18, reward: 300 },
  { id: "o168", category: "ألغاز", difficulty: "hard", question: "شيء تراه في منتصف الماء لكن لا تراه في الباخرة. ما هو؟", options: ["السمكة", "الحفرة", "العجلة", "الإسكلة"], correctIndex: 1, stage: 18, reward: 300 },
  { id: "o169", category: "ألغاز", difficulty: "hard", question: "شيء يمشي في الشمس ويتوقف في الظل. ما هو؟", options: ["الإنسان", "الظل", "الساعة", "الحصان"], correctIndex: 1, stage: 18, reward: 300 },
  { id: "o170", category: "ألغاز", difficulty: "hard", question: "شيء يمكنه السباحة لكنه يموت إذا مَسَّه الماء. ما هو؟", options: ["السمكة", "الماء الملح", "الמلح", "الحرب"], correctIndex: 2, stage: 18, reward: 300 },

  // Stage 19-20 — سرعة بديهة
  { id: "o171", category: "سرعة بديهة", difficulty: "hard", question: "تث الـ3 تسقط في قاع دلو. كم بقي؟", options: ["0", "1", "2", "3"], correctIndex: 1, stage: 19, reward: 300 },
  { id: "o172", category: "سرعة بديهة", difficulty: "hard", question: "غزلان تجري شرقاً 30 كم/س، وغزة تجري غرباً 30 كم/س. كم المسافة بينهما بعد ساعة؟", options: ["30 كم", "60 كم", "90 كم", "120 كم"], correctIndex: 1, stage: 19, reward: 300 },
  { id: "o173", category: "سرعة بديهة", difficulty: "hard", question: "رجل يحمل صندوقاً ثقيلاً. إذا أضاف صندوقاً آخر ثقيلاً، ماذا يحدث للصندوق الأول؟", options: ["يثقل أكثر", "يخف", "لا يتغير", "ينكسر"], correctIndex: 2, stage: 19, reward: 300 },
  { id: "o174", category: "سرعة بديهة", difficulty: "hard", question: "إذا قطعت شجرة في غابة ولا أحد يسمع، هل صدر صوت؟", options: ["نعم", "لا", "يعتمد", "السؤال خاطئ"], correctIndex: 0, stage: 19, reward: 300 },
  { id: "o175", category: "سرعة بديهة", difficulty: "hard", question: "عمر الأب 40 وعمر ابنه نصف عمره. بعد 10 سنوات، كم سيكون عمر الأب؟", options: ["45", "50", "55", "60"], correctIndex: 1, stage: 19, reward: 300 },
  { id: "o176", category: "سرعة بديهة", difficulty: "hard", question: "ما هي الكمية التي إذا ضربتها بنفسها أعطتك 9؟", options: ["3", "4.5", "81", "3 و -3"], correctIndex: 3, stage: 20, reward: 300 },
  { id: "o177", category: "سرعة بديهة", difficulty: "hard", question: "سباق عنده 5 لاعبين، كم مكاناً خلف الفائز؟", options: ["3", "4", "5", "6"], correctIndex: 1, stage: 20, reward: 300 },
  { id: "o178", category: "سرعة بديهة", difficulty: "hard", question: "أين يقع أثقل جسم في المجموعة الشمسية؟", options: ["الأرض", "المشتري", "الشمس", "زحل"], correctIndex: 2, stage: 20, reward: 300 },
  { id: "o179", category: "سرعة بديهة", difficulty: "hard", question: "ما هو العدد الذي إذا قسمته على نفسه تحصل على 1؟", options: ["0", "1", "أي عدد", "لا يوجد"], correctIndex: 2, stage: 20, reward: 300 },
  { id: "o180", category: "سرعة بديهة", difficulty: "hard", question: "شيء يُبنى بالليل وينهار بالنهار. ما هو؟", options: ["البيت", "الحلم", "السكر", "الخل"], correctIndex: 1, stage: 20, reward: 300 },

  // ═══════════════════════════════════════════════════════════════
  // المرحلة 21-30: مراحل التحدي (400-500 XP)
  // ═══════════════════════════════════════════════════════════════
  // Stage 21-25 — تحديات متقدمة
  { id: "o181", category: "تحدي", difficulty: "hard", question: "في فيبوناتشي، ما هو الرقم السادس؟ (0,1,1,2,3,5...)", options: ["6", "7", "8", "9"], correctIndex: 2, stage: 21, reward: 400 },
  { id: "o182", category: "تحدي", difficulty: "hard", question: "ما هي القوة التي تجذب الجسم نحو مركز الأرض؟", options: ["المغناطيسية", "الجاذبية", "الاحتكاك", "الipherals"], correctIndex: 1, stage: 21, reward: 400 },
  { id: "o183", category: "تحدي", difficulty: "hard", question: "كم عددAngles in a hexagon?", options: ["4", "5", "6", "7"], correctIndex: 2, stage: 21, reward: 400 },
  { id: "o184", category: "تحدي", difficulty: "hard", question: "ما هو فيتامين الشمس؟", options: ["A", "B", "C", "D"], correctIndex: 3, stage: 21, reward: 400 },
  { id: "o185", category: "تحدي", difficulty: "hard", question: "ما هي أصغر دولة في العالم من حيث المساحة؟", options: ["موناكو", "الفاتيكان", "سان مارينو", "ليختنشتاين"], correctIndex: 1, stage: 21, reward: 400 },
  { id: "o186", category: "تحدي", difficulty: "hard", question: "ما هو أكبر عدد أولي واحد yAxis 50؟", options: ["43", "47", "49", "53"], correctIndex: 1, stage: 22, reward: 400 },
  { id: "o187", category: "تحدي", difficulty: "hard", question: "ما هي النسبة المئوية لمساحة اليابسة من مساحة الأرض؟", options: ["19%", "29%", "39%", "49%"], correctIndex: 1, stage: 22, reward: 400 },
  { id: "o188", category: "تحدي", difficulty: "hard", question: "كم عدد الجسيمات في نواة الهيليوم؟", options: ["2", "3", "4", "5"], correctIndex: 2, stage: 22, reward: 400 },
  { id: "o189", category: "تحدي", difficulty: "hard", question: "ما هي وحدة قياس شدة الصوت؟", options: ["الديسيبل", "الفولت", "الأمبير", "الواط"], correctIndex: 0, stage: 22, reward: 400 },
  { id: "o190", category: "تحدي", difficulty: "hard", question: "ما هو العنصر الكيميائي الذي رمزه Na؟", options: ["النتريل", "النترج...", "الصوديوم", "النيكل"], correctIndex: 2, stage: 22, reward: 400 },

  // Stage 23-25 — تحديات أصعب
  { id: "o191", category: "تحدي", difficulty: "hard", question: "ما هو التفاعل الذي تختفي فيه الضوء؟", options: ["الانعكاس", "الانكسار", "الامتصاص", "الحجب"], correctIndex: 2, stage: 23, reward: 400 },
  { id: "o192", category: "تحدي", difficulty: "hard", question: "ما هو أصغر كوكب في المجموعة الشمسية؟", options: ["عطارد", "المريخ", "بلوتو", "زحل"], correctIndex: 0, stage: 23, reward: 400 },
  { id: "o193", category: "تحدي", difficulty: "hard", question: "كم عدد نجوم الدب الأكبر؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 23, reward: 400 },
  { id: "o194", category: "تحدي", difficulty: "hard", question: "ما هي الوحدة الأصغر في الم living organism?", options: ["العضو", "النسيج", "الخلية", "الجزيء"], correctIndex: 2, stage: 23, reward: 400 },
  { id: "o195", category: "تحدي", difficulty: "hard", question: "ما هو العنصر الذي يوجد في كل الأحماض؟", options: ["الأكسجين", "الهيدروجين", "الكربون", "النيتروجين"], correctIndex: 1, stage: 23, reward: 400 },

  // Stage 26-30 — الأسطوري (500 XP)
  { id: "o196", category: "أسطوري", difficulty: "hard", question: "في فيزياء الكم، ما هو مبدأ عدم اليقين لهيزنبرغ؟", options: ["لا يمكن معرفة المكان والسرعة معاً بدقة", "الضوء موجة فقط", "الجاذبية كهربائية", "الزمن يتوقف"], correctIndex: 0, stage: 26, reward: 500 },
  { id: "o197", category: "أسطوري", difficulty: "hard", question: "ما هو أكبر عدد أولي مرسالي (Mersenne prime) معروف تقريباً؟", options: ["2^31-1", "2^61-1", "2^89-1", "2^127-1"], correctIndex: 3, stage: 26, reward: 500 },
  { id: "o198", category: "أسطوري", difficulty: "hard", question: "ما هي الأبعاد الأربعة في نظرية الأوتار؟", options: ["الطول والعرض والارتفاع والزمن", "الطول والعرض والارتفاع والحرارة", "الزمن والمكان والطاقة والكتلة", "3 مكانيات + زمن واحد"], correctIndex: 0, stage: 26, reward: 500 },
  { id: "o199", category: "أسطوري", difficulty: "hard", question: "كم عدد الثقوب السوداء في مركز المجرة؟", options: ["0", "1", "عدة آلاف", "لا أحد يعرف"], correctIndex: 1, stage: 27, reward: 500 },
  { id: "o200", category: "أسطوري", difficulty: "hard", question: "ما هو نظير الهيدروجين الأكثر وفرة في الكون؟", options: ["ديوتيريوم", "تريتيوم", "هيليوم-3", "ليثيوم-7"], correctIndex: 0, stage: 27, reward: 500 },
  { id: "o201", category: "أسطوري", difficulty: "hard", question: "ما هي سرعة الصوت في الهواء عند 20 درجة مئوية تقريباً؟", options: ["243 م/ث", "343 م/ث", "443 م/ث", "543 م/ث"], correctIndex: 1, stage: 27, reward: 500 },
  { id: "o202", category: "أسطوري", difficulty: "hard", question: "ما هو أكبر تلسكوب في العالم حالياً (2024)؟", options: ["هابل", "جيمس ويب", "كبلر", "سبitzer"], correctIndex: 1, stage: 28, reward: 500 },
  { id: "o203", category: "أسطوري", difficulty: "hard", question: "ما هو معدن أسنان الإنسان؟", options: [" العاج", "المينا", "العاجين", "الكالسيت"], correctIndex: 1, stage: 28, reward: 500 },
  { id: "o204", category: "أسطوري", difficulty: "hard", question: "كم مرة تدور الأرض حول نفسها في سنة واحدة؟", options: ["1", "365", "365.25", "366"], correctIndex: 2, stage: 28, reward: 500 },
  { id: "o205", category: "أسطوري", difficulty: "hard", question: "ما هي أكبر خلية في جسم الإنسان؟", options: ["البويضة", "الخلية العصبية", "خلية العضلات", "خلية الجلد"], correctIndex: 0, stage: 29, reward: 500 },
  { id: "o206", category: "أسطوري", difficulty: "hard", question: "في أي سنة أطلق أول قمر صناعي؟", options: ["1955", "1957", "1960", "1962"], correctIndex: 1, stage: 29, reward: 500 },
  { id: "o207", category: "أسطوري", difficulty: "hard", question: "ما هي أصغر دولة آسيوية من حيث المساحة؟", options: ["سنغافورة", "البرتغال", "بروناي", "ماليزيا"], correctIndex: 0, stage: 29, reward: 500 },
  { id: "o208", category: "أسطوري", difficulty: "hard", question: "ما هو أعمق بحيرة في العالم؟", options: ["بحيرة تايكا", "بحيرة بيكال", "بحيرة فيكتوريا", "بحيرة تنجانيقا"], correctIndex: 1, stage: 29, reward: 500 },
  { id: "o209", category: "أسطوري", difficulty: "hard", question: "كم عدد ألوان الطيف المرئي؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 30, reward: 500 },
  { id: "o210", category: "أسطوري", difficulty: "hard", question: "ما هو أكبر عضو في جسم الإنسان؟", options: ["الكبد", "الجلد", "الدماغ", "الرئتان"], correctIndex: 1, stage: 30, reward: 500 },

  // ═══════════════════════════════════════════════════════════════
  // إكمال 300 سؤال — فئات إضافية
  // ═══════════════════════════════════════════════════════════════
  // Stage 6-10 إضافي — علوم وتقنية
  { id: "o211", category: "علوم", difficulty: "medium", question: "ما هو العنصر الكيميائي الذي رمزه H؟", options: ["الهيليوم", "الهيدروجين", "الحديد", "النحاس"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o212", category: "علوم", difficulty: "medium", question: "كم عدد أزواج الأضلاع المتوازية في شبه المنحرف؟", options: ["1", "2", "0", "3"], correctIndex: 0, stage: 6, reward: 200 },
  { id: "o213", category: "علوم", difficulty: "medium", question: "ما هو وحدة قياس الطاقة؟", options: ["الفولت", "الأمبير", "الجول", "الأوم"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o214", category: "علوم", difficulty: "medium", question: "ما هو أكبر عضو في جسم الإنسان؟", options: ["الكبد", "الجلد", "الدماغ", "الرئتان"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o215", category: "علوم", difficulty: "medium", question: "كم عدد حواس الإنسان؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o216", category: "تقنية", difficulty: "medium", question: "ما هو اختصار GPS؟", options: ["Global Positioning System", "General Purpose System", "Global Processing System", "General Positioning System"], correctIndex: 0, stage: 8, reward: 200 },
  { id: "o217", category: "تقنية", difficulty: "medium", question: "ما هو مخترع telephone؟", options: ["توماس إديسون", "ألكسندر غراهام بيل", "نيكولا تسلا", "جيمس واتس"], correctIndex: 1, stage: 8, reward: 200 },
  { id: "o218", category: "تقنية", difficulty: "medium", question: "ما هو اختصار URL؟", options: ["Universal Resource Locator", "Uniform Resource Locator", "Universal Reference Link", "Uniform Reference Locator"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o219", category: "تقنية", difficulty: "medium", question: "في أي سنة أُطلق أول قمر صناعي؟", options: ["1955", "1957", "1960", "1962"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o220", category: "تقنية", difficulty: "medium", question: "ما هو اختصار WiFi؟", options: ["Wireless Fidelity", "Wide Fidelity", "Wireless Frequency", "Wide Frequency"], correctIndex: 0, stage: 10, reward: 200 },

  // Stage 11-15 إضافي — تحديات ثقافية
  { id: "o221", category: "ثقافة عربية", difficulty: "hard", question: "ما هو اسم المدينة التي بُنيت على 7 تلال؟", options: ["إسطنبول", "روما", "أثينا", "القاهرة"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o222", category: "ثقافة عربية", difficulty: "hard", question: "في أي دولة يقع وادي الأردن؟", options: ["مصر", "الأردن", "لبنان", "سوريا"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o223", category: "رياضة", difficulty: "hard", question: "كم عدد مجموعات التنس في بطولة ويملدون؟", options: ["3", "4", "5", "6"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o224", category: "رياضة", difficulty: "hard", question: "في أي دولة نشأت رياضة الجودو؟", options: ["الصين", "اليابان", "كوريا", "تايلاند"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o225", category: "رياضة", difficulty: "hard", question: "كم عدد لاعبي فريق الرغبي في الملعب؟", options: ["11", "13", "15", "17"], correctIndex: 2, stage: 12, reward: 300 },
  { id: "o226", category: "علوم", difficulty: "hard", question: "ما هو العنصر الذي يُعرف بالelement of life؟", options: ["الcarbon", "الأكسجين", "الهيدروجين", "النيتروجين"], correctIndex: 0, stage: 13, reward: 300 },
  { id: "o227", category: "علوم", difficulty: "hard", question: "ما هي الوحدة الفيزيائية لأ划 الكهرباء؟", options: ["الأمبير", "الفولت", "الواط", "الأوم"], correctIndex: 2, stage: 13, reward: 300 },
  { id: "o228", category: "منطق", difficulty: "hard", question: "إذا كان + = × و - = ÷، فما ناتج 2 + 3؟", options: ["5", "6", "8", "1"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o229", category: "منطق", difficulty: "hard", question: "رقم مكعبه 64. ما هو؟", options: ["4", "8", "16", "32"], correctIndex: 0, stage: 14, reward: 300 },
  { id: "o230", category: "منطق", difficulty: "hard", question: "إذا كان 2 hacked = 4 و 3 hacked = 9، فما هو 5 hacked؟", options: ["10", "15", "25", "35"], correctIndex: 2, stage: 15, reward: 300 },

  // Stage 16-20 إضافي — سرعة بديهة وألغاز
  { id: "o231", category: "سرعة بديهة", difficulty: "hard", question: "شيء يظهر مرة واحدة في دقيقة ومرتين في ساعة ولا يظهر في سنة. ما هو؟", options: ["الحرف e", "الرقم 1", "الحرف a", "الرقم 0"], correctIndex: 0, stage: 16, reward: 300 },
  { id: "o232", category: "سرعة بديهة", difficulty: "hard", question: "3 لاعبين لعبوا ضد 3 لاعبين. كم لاعباً في الملعب؟", options: ["3", "6", "9", "0"], correctIndex: 1, stage: 16, reward: 300 },
  { id: "o233", category: "ألغاز", difficulty: "hard", question: "شيء يتكلم بكل اللغات لكنه لا يعرف كلمة واحدة. ما هو؟", options: ["الكتاب", "الهاتف", "الترجمان", "الdictionary"], correctIndex: 0, stage: 17, reward: 300 },
  { id: "o234", category: "ألغاز", difficulty: "hard", question: "شيء يملأ الغرفة فارغة لكن لا يملأ البيت. ما هو؟", options: ["الضوء", "الهواء", "الصمت", "الظل"], correctIndex: 2, stage: 17, reward: 300 },
  { id: "o235", category: "ألغاز", difficulty: "hard", question: "شيء يمكنه الخروج من البيت دون أن يفتح الباب. ما هو؟", options: ["القط", "النافذة", "الضوء", "الرياح"], correctIndex: 2, stage: 18, reward: 300 },
  { id: "o236", category: "سرعة بديهة", difficulty: "hard", question: "ما العدد الذي يضربك في الرأس ويُنقذ حياتك؟", options: ["الم threw", "الغطاء", "الم节能减排", "المظل"], correctIndex: 3, stage: 19, reward: 300 },
  { id: "o237", category: "سرعة بديهة", difficulty: "hard", question: "شيء يمكنك رؤيته لكن لا يمكنه رؤيتك. ما هو؟", options: ["المرآة", "الطفل", "الحائط", "الغسالة"], correctIndex: 0, stage: 20, reward: 300 },
  { id: "o238", category: "منطق", difficulty: "hard", question: "8 كم من الشرق، ثم 6 كم من الشمال. كم المسافة المستقيمة للنقطة الأصل؟", options: ["10 كم", "14 كم", "48 كم", "15 كم"], correctIndex: 0, stage: 20, reward: 300 },
  { id: "o239", category: "منطق", difficulty: "hard", question: "في متاهة، إذا ذهبت يميناً 3 مرات، ثم يساراً مرة واحدة، ثم فوقاً مرتين، أين ستكون؟", options: ["في النقطة الأصل", "يمين 2+", "فوق 2", "لا يمكن تحديده"], correctIndex: 3, stage: 20, reward: 300 },
  { id: "o240", category: "منطق", difficulty: "hard", question: "رقم مضاعف 7، مجموع أرقامه = 10. ما هو؟", options: ["28", "37", "46", "55"], correctIndex: 1, stage: 20, reward: 300 },

  // Stage 21-25 إضافي — تحديات ثقافية صعبة
  { id: "o241", category: "تحدي", difficulty: "hard", question: "من هو مخترع المصباح الكهربائي؟", options: ["تسلا", "إديسون", "بل", "ماركوني"], correctIndex: 1, stage: 21, reward: 400 },
  { id: "o242", category: "تحدي", difficulty: "hard", question: "ما هو أكبر صحراء حارة في العالم؟", options: ["الصحراء الكبرى", "صحراء أون情况来看", "صحراء كالاهاري", "الصحراء العربية"], correctIndex: 0, stage: 21, reward: 400 },
  { id: "o243", category: "تحدي", difficulty: "hard", question: "كم عدد قارات العالم؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 22, reward: 400 },
  { id: "o244", category: "تحدي", difficulty: "hard", question: "ما هو السرعة الضوئية تقريباً بالكيلومتر في الثانية؟", options: ["200,000", "300,000", "400,000", "500,000"], correctIndex: 1, stage: 22, reward: 400 },
  { id: "o245", category: "تحدي", difficulty: "hard", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 23, reward: 400 },
  { id: "o246", category: "تحدي", difficulty: "hard", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 1, stage: 23, reward: 400 },
  { id: "o247", category: "تحدي", difficulty: "hard", question: "في أي سنة اخترع غوتنبرغ الطباعة؟", options: ["1440", "1450", "1460", "1470"], correctIndex: 1, stage: 24, reward: 400 },
  { id: "o248", category: "تحدي", difficulty: "hard", question: "كم عدد أضلاع المثلث؟", options: ["2", "3", "4", "5"], correctIndex: 1, stage: 24, reward: 400 },
  { id: "o249", category: "تحدي", difficulty: "hard", question: "ما هو أكبر محيط في العالم؟", options: ["الأطلسي", "الهندي", "الهادئ", "الشمالي"], correctIndex: 2, stage: 25, reward: 400 },
  { id: "o250", category: "تحدي", difficulty: "hard", question: "ما هي عاصمة اليابان؟", options: ["بكين", "سيول", "طوكيو", "بانكوك"], correctIndex: 2, stage: 25, reward: 400 },

  // Stage 26-30 إضافي — أسطوري
  { id: "o251", category: "أسطوري", difficulty: "hard", question: "ما هو عددendtime Planck؟", options: ["5.39 × 10⁻⁴⁴ ثانية", "6.67 × 10⁻¹¹", "1.38 × 10⁻²³", "6.62 × 10⁻³⁴"], correctIndex: 0, stage: 26, reward: 500 },
  { id: "o252", category: "أسطوري", difficulty: "hard", question: "ما هو أكبر حيوان عاش في التاريخ؟", options: ["التيرانوصور", "الديناصور الأزرق", "الحيوان الأزرق", "الماموث"], correctIndex: 2, stage: 27, reward: 500 },
  { id: "o253", category: "أسطوري", difficulty: "hard", question: "ما هي نظرية التطور الذي طرحها داروين؟", options: ["الانتخاب الطبيعي", "الوراثة المندلية", "النشوء", "الطفرة"], correctIndex: 0, stage: 27, reward: 500 },
  { id: "o254", category: "أسطوري", difficulty: "hard", question: "ما هو العنصر الذي يشكل 90% من النجوم؟", options: ["الهيدروجين", "الهيليوم", "الكربون", "الأكسجين"], correctIndex: 0, stage: 28, reward: 500 },
  { id: "o255", category: "أسطوري", difficulty: "hard", question: "كم عدد فراشات الدماغ البشرية (neurons) تقريباً؟", options: ["86 مليون", "86 مليار", "860 مليار", "8.6 تريليون"], correctIndex: 1, stage: 28, reward: 500 },
  { id: "o256", category: "أسطوري", difficulty: "hard", question: "ما هو أصغر جسيم في الفيزياء الحديثة؟", options: ["الإلكترون", "الكوارك", "الفوتون", "النيوترون"], correctIndex: 1, stage: 29, reward: 500 },
  { id: "o257", category: "أسطوري", difficulty: "hard", question: "كم عدد كromosomes human body cell?", options: ["23", "44", "46", "48"], correctIndex: 2, stage: 29, reward: 500 },
  { id: "o258", category: "أسطوري", difficulty: "hard", question: "ما هو فيزياء الذي اكتشف الجاذبية؟", options: ["غاليليو", "نيوتن", "أينشتاين", "كوبرنيكوس"], correctIndex: 1, stage: 30, reward: 500 },
  { id: "o259", category: "أسطوري", difficulty: "hard", question: "كم فيزتنا من الأرض إلى القمر؟", options: ["300,000 كم", "384,000 كم", "450,000 كم", "500,000 كم"], correctIndex: 1, stage: 30, reward: 500 },
  { id: "o260", category: "أسطوري", difficulty: "hard", question: "ما هي أكبر نجمة معروفة في الكون؟", options: ["الشمس", "بيوتوجوز", "قلف الجبار", "أندرسون"], correctIndex: 1, stage: 30, reward: 500 },

  // ═══════════════════════════════════════════════════════════════
  // آخر 40 سؤالاً لإكمال 300
  // ═══════════════════════════════════════════════════════════════
  { id: "o261", category: "معلومات عامة", difficulty: "easy", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o262", category: "معلومات عامة", difficulty: "easy", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 1, stage: 2, reward: 100 },
  { id: "o263", category: "معلومات عامة", difficulty: "easy", question: "أين يقع برج بيزا المائل؟", options: ["فرنسا", "إسبانيا", "إيطاليا", "يونان"], correctIndex: 2, stage: 3, reward: 100 },
  { id: "o264", category: "علوم", difficulty: "medium", question: "كم عدد عظام جسم الإنسان؟", options: ["106", "186", "206", "256"], correctIndex: 2, stage: 7, reward: 200 },
  { id: "o265", category: "علوم", difficulty: "medium", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o266", category: "رياضة", difficulty: "hard", question: "كم مرة فاز المنتخب البرازيلي بكأس العالم؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 14, reward: 300 },
  { id: "o267", category: "رياضة", difficulty: "hard", question: "كم عدد لاعبي فريق كرة القدم في الملعب؟", options: ["9", "10", "11", "12"], correctIndex: 2, stage: 14, reward: 300 },
  { id: "o268", category: "منطق", difficulty: "hard", question: "رجل ترك بيتاً ومشى 5 كم جنوباً ثم 5 كم شرقاً ثم 5 كم شمالاً فوجد نفسه في نفس المكان. أين هو؟", options: ["القطب الجنوبي", "القطب الشمالي", "خط الاستواء", "الصحراء"], correctIndex: 0, stage: 16, reward: 300 },
  { id: "o269", category: "منطق", difficulty: "hard", question: "إذا كنت في سباق وعدوت المتسابق الثاني، في أي مكان أنت؟", options: ["الأول", "الثاني", "الثالث", "الرابع"], correctIndex: 1, stage: 16, reward: 300 },
  { id: "o270", category: "منطق", difficulty: "hard", question: "شيء له رأس ولسان ولا يتكلم. ما هو؟", options: ["القلم", "الحذاء", "المفتاح", "الساعة"], correctIndex: 1, stage: 17, reward: 300 },
  { id: "o271", category: "منطق", difficulty: "hard", question: "شيء يزداد كلما أخذت منه. ما هو؟", options: ["المال", "الحفرة", "الماء", "الوقت"], correctIndex: 1, stage: 17, reward: 300 },
  { id: "o272", category: "أسطوري", difficulty: "hard", question: "ما هي أصغر وحدة في المادة؟", options: ["الذرة", "البروتون", "الكوارك", "النيوترون"], correctIndex: 2, stage: 26, reward: 500 },
  { id: "o273", category: "أسطوري", difficulty: "hard", question: "كم عدد كروموسومات الإنسان؟", options: ["23", "44", "46", "48"], correctIndex: 2, stage: 27, reward: 500 },
  { id: "o274", category: "أسطوري", difficulty: "hard", question: "ما هو اكتشاف بنك沦为 الذي أحدث ثورة في الفيزياء؟", options: ["النواة", "الإلكترون", "الفايزيائي", "الجاذبية"], correctIndex: 0, stage: 28, reward: 500 },
  { id: "o275", category: "أسطوري", difficulty: "hard", question: "ما هو أكبر عدد أولي معروف في عام 2024؟", options: ["2^82,589,933 - 1", "2^57,885,161 - 1", "2^77,232,917 - 1", "2^136,279,841 - 1"], correctIndex: 0, stage: 29, reward: 500 },
  { id: "o276", category: "ترفيه", difficulty: "easy", question: "ما هو اسم المهرج الشهير في سيرك؟", options: ["بكو", "راغو", "جوجو", "pongo"], correctIndex: 0, stage: 5, reward: 100 },
  { id: "o277", category: "ترفيه", difficulty: "easy", question: "ما هو أشهر لعبة فيديو في العالم؟", options: ["FIFA", "Minecraft", "Fortnite", "PUBG"], correctIndex: 1, stage: 5, reward: 100 },
  { id: "o278", category: "ترفيه", difficulty: "easy", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2, stage: 5, reward: 100 },
  { id: "o279", category: "معلومات عامة", difficulty: "easy", question: "ما هي لغة القرآن الكريم؟", options: ["الفارسية", "العربية", "التركية", "اليونانية"], correctIndex: 1, stage: 4, reward: 100 },
  { id: "o280", category: "معلومات عامة", difficulty: "easy", question: "في أي قارة تقع الهند؟", options: ["أوروبا", "آسيا", "أفريقيا", "أمريكا"], correctIndex: 1, stage: 4, reward: 100 },
  { id: "o281", category: "معلومات عامة", difficulty: "easy", question: "ما هو أكبر محيط في العالم؟", options: ["الأطلسي", "الهندي", "الهادئ", "الشمالي"], correctIndex: 2, stage: 1, reward: 100 },
  { id: "o282", category: "معلومات عامة", difficulty: "easy", question: "كم عدد أيام السنة الميلادية العادية؟", options: ["360", "364", "365", "366"], correctIndex: 2, stage: 2, reward: 100 },
  { id: "o283", category: "علوم", difficulty: "medium", question: "ما هو أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 1, stage: 7, reward: 200 },
  { id: "o284", category: "علوم", difficulty: "medium", question: "كم عدد حواس الإنسان الأساسية؟", options: ["4", "5", "6", "7"], correctIndex: 2, stage: 8, reward: 200 },
  { id: "o285", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة مصر؟", options: ["الإسكندرية", "القاهرة", "أسوان", "الجيزة"], correctIndex: 1, stage: 3, reward: 100 },
  { id: "o286", category: "جغرافيا", difficulty: "medium", question: "أين يقع نهر النيل؟", options: ["آسيا", "أوروبا", "أفريقيا", "أمريكا"], correctIndex: 2, stage: 6, reward: 200 },
  { id: "o287", category: "ثقافة عربية", difficulty: "easy", question: "كم عدد أعمدة الإسلام؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 4, reward: 100 },
  { id: "o288", category: "ثقافة عربية", difficulty: "medium", question: "من هو مخترع Algebra في العالم الإسلامي؟", options: ["الخوارزمي", "ابن سينا", "ابن الهيثم", "البيروني"], correctIndex: 0, stage: 6, reward: 200 },
  { id: "o289", category: "تاريخ", difficulty: "medium", question: "في أي سنة سقطت الإمبراطورية الرومانية؟", options: ["410 م", "476 م", "527 م", "600 م"], correctIndex: 1, stage: 6, reward: 200 },
  { id: "o290", category: "تاريخ", difficulty: "hard", question: "من هو القائد الإسلامي في معركة حطين؟", options: ["سيف الدين قطز", "صلاح الدين الأيوبي", "الظاهر بيبرس", "الناصر محمد"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o291", category: "تقنية", difficulty: "medium", question: "ما هو اختصار HTML؟", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"], correctIndex: 0, stage: 9, reward: 200 },
  { id: "o292", category: "تقنية", difficulty: "hard", question: "في أي سنة أُنشئ أول بريد إلكتروني؟", options: ["1965", "1971", "1978", "1985"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o293", category: "ترفيه", difficulty: "medium", question: "من أخرج فيلم Titanic؟", options: ["ستيفن سبيلبرغ", "جيمس كاميرون", "كريستوفر نولان", "ريدلي سكوت"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o294", category: "ترفيه", difficulty: "hard", question: "من غنى أغنية Thriller؟", options: ["بروس سبرينغستين", "مايكل جاكسون", "إلتون جون", "فريدي ميركوري"], correctIndex: 1, stage: 11, reward: 300 },
  { id: "o295", category: "رياضة", difficulty: "medium", question: "في أي سنة أُقيمت أول دورة أولمبية حديثة؟", options: ["1892", "1896", "1900", "1904"], correctIndex: 1, stage: 9, reward: 200 },
  { id: "o296", category: "رياضة", difficulty: "hard", question: "كم عدد لاعبي فريق كرة السلة في الملعب؟", options: ["4", "5", "6", "7"], correctIndex: 1, stage: 13, reward: 300 },
  { id: "o297", category: "علوم", difficulty: "hard", question: "ما هو العنصر الكيميائي الذي رمزه Au؟", options: ["الفضة", "النحاس", "الذهب", "الزئبق"], correctIndex: 2, stage: 11, reward: 300 },
  { id: "o298", category: "علوم", difficulty: "hard", question: "ما هي نظرية أينشتاين الشهيرة E=mc²؟", options: ["النسبية العامة", "النسبية الخاصة", "نظرية الأوتار", "نظرية الكم"], correctIndex: 1, stage: 12, reward: 300 },
  { id: "o299", category: "ألغاز", difficulty: "hard", question: "شيء يسمعك بلا أذن ويكلّمك بلا لسان. ما هو؟", options: ["الهاتف", "الراديو", "الهاتف الأرضي", "الصدى"], correctIndex: 0, stage: 18, reward: 300 },
  { id: "o300", category: "ألغاز", difficulty: "hard", question: "شيء يمكنك كسره دون أن تلمسه. ما هو؟", options: ["الزجاج", "الصمت", "الحبل", "ال壷"], correctIndex: 1, stage: 18, reward: 300 },
];

/** عدد المراحل الكلي */
export const TOTAL_STAGES = 30;

/** عدد الأسئلة في كل مرحلة */
export const QUESTIONS_PER_STAGE = 10;
