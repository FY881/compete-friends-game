import type { Question } from "./questions";

/**
 * 📚 الحزمة التوسعية الكبرى — المرحلة 3 من التحول الشامل
 * أسئلة جديدة (q543+) عبر كل الفئات بدرجات صعوبة متدرجة،
 * بصياغة عربية واضحة وخيارات متقاربة لرفع جودة التحدي.
 */
export const MEGA_PACK_1: Question[] = [
  // ── علوم ──
  { id: "q543", category: "علوم", difficulty: "medium", question: "ما هو الغاز الذي تشتعل به الشمس أساساً؟", options: ["الأكسجين", "الهيدروجين", "النيتروجين", "الهيليوم"], correctIndex: 1 },
  { id: "q544", category: "علوم", difficulty: "hard", question: "ما هو عدد كروموسومات الخلية البشرية العادية؟", options: ["23", "42", "46", "48"], correctIndex: 2 },
  { id: "q545", category: "علوم", difficulty: "easy", question: "ما هو المعدن السائل في درجة حرارة الغرفة؟", options: ["الزئبق", "الرصاص", "القصدير", "الفضة"], correctIndex: 0 },
  { id: "q546", category: "علوم", difficulty: "medium", question: "من طور نظرية النسبية العامة؟", options: ["نيوتن", "أينشتاين", "بور", "بلانك"], correctIndex: 1 },
  { id: "q547", category: "علوم", difficulty: "hard", question: "ما هي أسرع سرعة معروفة في الكون؟", options: ["سرعة الصوت", "سرعة الضوء", "سرعة الرياح الشمسية", "سرعة الصواريخ"], correctIndex: 1 },
  { id: "q548", category: "علوم", difficulty: "medium", question: "ما هي الوحدة المستخدمة لقياس قوة التيار الكهربائي؟", options: ["الفولت", "الأوم", "الأمبير", "الواط"], correctIndex: 2 },
  { id: "q549", category: "علوم", difficulty: "easy", question: "كم عدد عظام جسم الإنسان البالغ؟", options: ["106", "206", "306", "406"], correctIndex: 1 },
  { id: "q550", category: "علوم", difficulty: "hard", question: "ما هو العنصر الأكثر وفرة في الكون؟", options: ["الأكسجين", "الكربون", "الهيدروجين", "الهيليوم"], correctIndex: 2 },
  { id: "q551", category: "علوم", difficulty: "medium", question: "ما هي العملية التي تحوّل النباتات الضوء إلى طاقة؟", options: ["التنفس", "البناء الضوئي", "التبخر", "النتح"], correctIndex: 1 },
  { id: "q552", category: "علوم", difficulty: "easy", question: "ما هو الحرف الكيميائي للماء؟", options: ["CO2", "H2O", "O2", "NaCl"], correctIndex: 1 },

  // ── جغرافيا ──
  { id: "q553", category: "جغرافيا", difficulty: "medium", question: "ما هو أعمق نقطة في المحيطات؟", options: ["خندق ماريانا", "خندق جاوة", "خندق بورتوريكو", "خندق تونغا"], correctIndex: 0 },
  { id: "q554", category: "جغرافيا", difficulty: "hard", question: "ما هي الدولة التي تضم أكبر عدد من الجزر في العالم؟", options: ["إندونيسيا", "السويد", "الفلبين", "اليابان"], correctIndex: 1 },
  { id: "q555", category: "جغرافيا", difficulty: "easy", question: "ما هو أطول نهر في العالم؟", options: ["الأمازون", "النيل", "اليانغتسي", "المسيسيبي"], correctIndex: 1 },
  { id: "q556", category: "جغرافيا", difficulty: "medium", question: "في أي قارة تقع صحراء أتاكاما؟", options: ["آسيا", "أفريقيا", "أمريكا الجنوبية", "أستراليا"], correctIndex: 2 },
  { id: "q557", category: "جغرافيا", difficulty: "hard", question: "ما هي أصغر دولة عربية من حيث المساحة؟", options: ["لبنان", "البحرين", "قطر", "الكويت"], correctIndex: 1 },
  { id: "q558", category: "جغرافيا", difficulty: "medium", question: "ما هو أعلى قمة جبلية في أفريقيا؟", options: ["كليمنجارو", "كنيا", "أطلس", "دراكنزبرغ"], correctIndex: 0 },
  { id: "q559", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة المغرب؟", options: ["الدار البيضاء", "الرباط", "مراكش", "فاس"], correctIndex: 1 },
  { id: "q560", category: "جغرافيا", difficulty: "hard", question: "ما هي البحر الذي لا يحدها أي دولة؟", options: ["بحر سارجاسو", "البحر الأحمر", "بحر الشمال", "البحر الميت"], correctIndex: 0 },

  // ── تاريخ ──
  { id: "q561", category: "تاريخ", difficulty: "medium", question: "في أي عام هبط الإنسان على سطح القمر لأول مرة؟", options: ["1965", "1969", "1971", "1972"], correctIndex: 1 },
  { id: "q562", category: "تاريخ", difficulty: "hard", question: "من هو مؤسس الدولة الأيوبية؟", options: ["صلاح الدين", "نور الدين محمود", "شيركوه", "العادل"], correctIndex: 0 },
  { id: "q563", category: "تاريخ", difficulty: "easy", question: "من بنى أهرامات الجيزة؟", options: ["الفراعنة", "الرومان", "الإغريق", "البابليون"], correctIndex: 0 },
  { id: "q564", category: "تاريخ", difficulty: "hard", question: "ما هي أقدم مدينة مأهولة في التاريخ؟", options: ["أريحا", "بابل", "أثينا", "دمشق"], correctIndex: 0 },
  { id: "q565", category: "تاريخ", difficulty: "medium", question: "في أي قرن كانت حروب الصليبية؟", options: ["القرن 10-12", "القرن 11-13", "القرن 12-14", "القرن 13-15"], correctIndex: 1 },
  { id: "q566", category: "تاريخ", difficulty: "medium", question: "من كان آخر ملوك الأندلس؟", options: ["بو عبد الله", "المأمون", "المعتصم", "الحكم الثاني"], correctIndex: 0 },
  { id: "q567", category: "تاريخ", difficulty: "easy", question: "من هو قائد معركة القادسية؟", options: ["سعد بن أبي وقاص", "خالد بن الوليد", "أبو عبيدة", "عمرو بن العاص"], correctIndex: 0 },
  { id: "q568", category: "تاريخ", difficulty: "hard", question: "ما هو اسم أول حاسوب إلكتروني رقمي؟", options: ["ENIAC", "UNIVAC", "IBM 701", "Colossus"], correctIndex: 0 },

  // ── رياضيات ──
  { id: "q569", category: "رياضيات", difficulty: "medium", question: "ما هي قيمة باي (π) تقريباً؟", options: ["3.14", "2.72", "1.61", "3.41"], correctIndex: 0 },
  { id: "q570", category: "رياضيات", difficulty: "hard", question: "ما هو ناتج ضرب 7×8+4÷2؟", options: ["30", "58", "60", "62"], correctIndex: 1 },
  { id: "q571", category: "رياضيات", difficulty: "easy", question: "كم عدد أضلاع المسدس؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q572", category: "رياضيات", difficulty: "medium", question: "ما هو الجذر التربيعي للعدد 144؟", options: ["10", "11", "12", "14"], correctIndex: 2 },
  { id: "q573", category: "رياضيات", difficulty: "hard", question: "ما هو مجموع زوايا المثلث بالدرجات؟", options: ["90", "180", "270", "360"], correctIndex: 1 },
  { id: "q574", category: "رياضيات", difficulty: "medium", question: "ما هو العدد الأولي الأكبر من 10 والأصغر من 20؟", options: ["11", "13", "17", "كل ما سبق"], correctIndex: 3 },
  { id: "q575", category: "رياضيات", difficulty: "easy", question: "ما هو 15% من 200؟", options: ["15", "25", "30", "35"], correctIndex: 2 },
  { id: "q576", category: "رياضيات", difficulty: "hard", question: "ما هو ناتج (2³)²؟", options: ["12", "36", "64", "81"], correctIndex: 2 },

  // ── لغة ──
  { id: "q577", category: "لغة", difficulty: "medium", question: "ما هو جمع كلمة «قلم»؟", options: ["أقلام", "قلمان", "قالمون", "قلمون"], correctIndex: 0 },
  { id: "q578", category: "لغة", difficulty: "hard", question: "ما هو المضاد الصحيح لكلمة «سخاء»؟", options: ["الجود", "البخل", "الكرم", "الوفاء"], correctIndex: 1 },
  { id: "q579", category: "لغة", difficulty: "easy", question: "كم عدد حروف اللغة العربية؟", options: ["26", "28", "30", "32"], correctIndex: 1 },
  { id: "q580", category: "لغة", difficulty: "medium", question: "ما هو مرادف كلمة «أَسَد»؟", options: ["الذئب", "الليث", "الفهد", "النمر"], correctIndex: 1 },
  { id: "q581", category: "لغة", difficulty: "hard", question: "ما هي الكلمة التي تنتهي بـ «ة» مؤنثة دائماً؟", options: ["طلحة", "حمزة", "سعاد", "دانية"], correctIndex: 3 },
  { id: "q582", category: "لغة", difficulty: "medium", question: "«الطالبُ مجتهدٌ» — ما إعراب «مجتهدٌ»؟", options: ["فاعل", "خبر", "مفعول", "حال"], correctIndex: 1 },
  { id: "q583", category: "لغة", difficulty: "easy", question: "ما هي علامة رفع الجمع المذكر السالم؟", options: ["الضمة", "الواو", "الألف", "الياء"], correctIndex: 1 },
  { id: "q584", category: "لغة", difficulty: "hard", question: "من هو شاعر «الكميت»؟", options: ["عنترة", "الأعشى", "عمرو بن كلثوم", "زهير"], correctIndex: 2 },

  // ── منطق ──
  { id: "q585", category: "منطق", difficulty: "hard", question: "إذا كانت كل الورود نباتات، وبعض النباتات سامة، فما الاستنتاج الصحيح؟", options: ["كل الورود سامة", "بعض الورود قد تكون سامة", "لا ورود سامة", "كل النباتات ورود"], correctIndex: 1 },
  { id: "q586", category: "منطق", difficulty: "medium", question: "ما هو العنصر التالي في السلسلة: 2، 6، 12، 20، ...؟", options: ["26", "28", "30", "32"], correctIndex: 2 },
  { id: "q587", category: "منطق", difficulty: "easy", question: "إذا كان اليوم ثلاثاء، فما اليوم بعد 5 أيام؟", options: ["السبت", "الأحد", "الجمعة", "الخميس"], correctIndex: 2 },
  { id: "q588", category: "منطق", difficulty: "hard", question: "أحجية: أثقل من الجبل وأخف من الريشة، ما هو؟", options: ["الفكرة", "الحقيقة", "اللاشيء", "الزمن"], correctIndex: 0 },
  { id: "q589", category: "منطق", difficulty: "medium", question: "في سباق إذا سبقتَ صاحب المركز الثاني فأين أنت؟", options: ["الأول", "الثاني", "الثالث", "يعتمد"], correctIndex: 1 },
  { id: "q590", category: "منطق", difficulty: "hard", question: "ما هو العدد الناقص: 1، 1، 2، 3، 5، 8، ...؟", options: ["11", "12", "13", "14"], correctIndex: 2 },
  { id: "q591", category: "منطق", difficulty: "easy", question: "أيها يختلف عن البقية: قطة، كلب، أسد، كرسي؟", options: ["قطة", "كلب", "أسد", "كرسي"], correctIndex: 3 },
  { id: "q592", category: "منطق", difficulty: "medium", question: "إذا كان A>B و B>C فما العلاقة بين A و C؟", options: ["A<C", "A>C", "A=C", "لا يمكن التحديد"], correctIndex: 1 },

  // ── تكنولوجيا ──
  { id: "q593", category: "تكنولوجيا", difficulty: "easy", question: "ماذا يعني اختصار WWW؟", options: ["World Wide Web", "World Web Wide", "Web World Wide", "Wide World Web"], correctIndex: 0 },
  { id: "q594", category: "تكنولوجيا", difficulty: "medium", question: "من هو مؤسس شركة مايكروسوفت؟", options: ["ستيف جوبز", "بيل غيتس", "مارك زوكربيرغ", "إيلون ماسك"], correctIndex: 1 },
  { id: "q595", category: "تكنولوجيا", difficulty: "hard", question: "ما هي لغة البرمجة الأكثر استخداماً في الذكاء الاصطناعي؟", options: ["Java", "Python", "C++", "Ruby"], correctIndex: 1 },
  { id: "q596", category: "تكنولوجيا", difficulty: "medium", question: "ماذا يعني اختصار CPU؟", options: ["وحدة المعالجة المركزية", "شاشة الكمبيوتر", "الذاكرة المؤقتة", "قرص التخزين"], correctIndex: 0 },
  { id: "q597", category: "تكنولوجيا", difficulty: "easy", question: "ما هو التطبيق الأشهر للرسائل القصيرة العالمية؟", options: ["WhatsApp", "Snapchat", "TikTok", "LinkedIn"], correctIndex: 0 },
  { id: "q598", category: "تكنولوجيا", difficulty: "hard", question: "في أي عام أُطلق أول هاتف آيفون؟", options: ["2005", "2007", "2009", "2010"], correctIndex: 1 },
  { id: "q599", category: "تكنولوجيا", difficulty: "medium", question: "ما هي الوحدة الأساسية لقياس مساحة التخزين؟", options: ["البايت", "البكسل", "الهرتز", "الفولت"], correctIndex: 0 },
  { id: "q600", category: "تكنولوجيا", difficulty: "hard", question: "ماذا يعني اختصار AI؟", options: ["ذكاء اصطناعي", "إنترنت متقدم", "تطبيقات ذكية", "أتمتة صناعية"], correctIndex: 0 },

  // ── فضاء ──
  { id: "q601", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الأحمر؟", options: ["المريخ", "الزهرة", "المشتري", "زحل"], correctIndex: 0 },
  { id: "q602", category: "فضاء", difficulty: "medium", question: "ما هي أكبر كوكب في المجموعة الشمسية؟", options: ["زحل", "المشتري", "نبتون", "أورانوس"], correctIndex: 1 },
  { id: "q603", category: "فضاء", difficulty: "hard", question: "ما هي المدة التي يحتاجها ضوء الشمس للوصول للأرض؟", options: ["8 دقائق", "8 ثوانٍ", "8 ساعات", "8 أيام"], correctIndex: 0 },
  { id: "q604", category: "فضاء", difficulty: "medium", question: "من كان أول رائد فضاء في التاريخ؟", options: ["يوري غاغارين", "نيل أرمسترونغ", "بوز ألدرين", "جون غلين"], correctIndex: 0 },
  { id: "q605", category: "فضاء", difficulty: "hard", question: "ما هو اسم المجرة التي توجد فيها الأرض؟", options: ["درب التبانة", "أندروميدا", "المثلث", "الماجلان"], correctIndex: 0 },
  { id: "q606", category: "فضاء", difficulty: "easy", question: "كم عدد أقمار المريخ؟", options: ["0", "1", "2", "4"], correctIndex: 2 },
  { id: "q607", category: "فضاء", difficulty: "medium", question: "ما هو النجم الأقرب للأرض بعد الشمس؟", options: ["بروكسيما قنطورس", "سيريوس", "الشعرى", "نجم القطب"], correctIndex: 0 },
  { id: "q608", category: "فضاء", difficulty: "hard", question: "ما هي الثقب الأسود؟", options: ["منطقة جاذبية هائلة", "كوكب مظلم", "نجم بارد", "سديم"], correctIndex: 0 },

  // ── رياضة ──
  { id: "q609", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق كرة القدم في الملعب؟", options: ["9", "10", "11", "12"], correctIndex: 2 },
  { id: "q610", category: "رياضة", difficulty: "medium", question: "في أي بلد وُلدت لعبة كرة السلة؟", options: ["أمريكا", "كندا", "إنجلترا", "أستراليا"], correctIndex: 1 },
  { id: "q611", category: "رياضة", difficulty: "hard", question: "من فاز بكأس العالم لكرة القدم 2022؟", options: ["فرنسا", "الأرجنتين", "البرازيل", "كرواتيا"], correctIndex: 1 },
  { id: "q612", category: "رياضة", difficulty: "medium", question: "كم مدة مباراة كرة القدم؟", options: ["60 دقيقة", "80 دقيقة", "90 دقيقة", "120 دقيقة"], correctIndex: 2 },
  { id: "q613", category: "رياضة", difficulty: "easy", question: "ما هي الرياضة التي تُلعب في ملعب ويمبلي؟", options: ["الrugby", "كرة القدم", "الكريكيت", "التنس"], correctIndex: 1 },
  { id: "q614", category: "رياضة", difficulty: "hard", question: "كم عدد حلقات العلم الأولمبي؟", options: ["4", "5", "6", "7"], correctIndex: 1 },
  { id: "q615", category: "رياضة", difficulty: "medium", question: "من هو أعلى لاعب كرة سلة في التاريخ؟", options: ["يائو مينغ", "شاكيل أونيل", "ليبرون جيمس", "كوبي براينت"], correctIndex: 0 },
  { id: "q616", category: "رياضة", difficulty: "easy", question: "ما هي اللعبة التي تُلعب على طاولة بمضربين وكرة صغيرة؟", options: ["التنس", "كرة الطاولة", "الاسكواش", "الريشة"], correctIndex: 1 },

  // ── جسم الإنسان ──
  { id: "q617", category: "جسم الإنسان", difficulty: "easy", question: "ما هو أكبر عضو في جسم الإنسان؟", options: ["القلب", "الكبد", "الجلد", "الرئة"], correctIndex: 2 },
  { id: "q618", category: "جسم الإنسان", difficulty: "medium", question: "كم عدد غرف القلب البشري؟", options: ["2", "3", "4", "5"], correctIndex: 2 },
  { id: "q619", category: "جسم الإنسان", difficulty: "hard", question: "ما هو الجزء المسؤول عن التوازن في الجسم؟", options: ["الأذن الداخلية", "العين", "الأنف", "اللسان"], correctIndex: 0 },
  { id: "q620", category: "جسم الإنسان", difficulty: "medium", question: "أي عضو ينتج الأنسولين؟", options: ["الكبد", "البنكرياس", "الكلية", "الطحال"], correctIndex: 1 },
  { id: "q621", category: "جسم الإنسان", difficulty: "easy", question: "كم عدد أسنان الإنسان البالغ؟", options: ["28", "30", "32", "34"], correctIndex: 2 },
  { id: "q622", category: "جسم الإنسان", difficulty: "hard", question: "ما هو أطول عظم في جسم الإنسان؟", options: ["عظم الفخذ", "عظم الساق", "عظم الذراع", "الضلع"], correctIndex: 0 },
  { id: "q623", category: "جسم الإنسان", difficulty: "medium", question: "ما هي فصيلة الدم النادرة عالمياً؟", options: ["A", "B", "O", "AB سالب"], correctIndex: 3 },
  { id: "q624", category: "جسم الإنسان", difficulty: "easy", question: "أي عضو ينقي الدم؟", options: ["القلب", "الكبد", "الكلية", "الرئة"], correctIndex: 2 },

  // ── أفلام ومسلسلات ──
  { id: "q625", category: "أفلام ومسلسلات", difficulty: "easy", question: "من هو مخرج فيلم «إنسبيشن»؟", options: ["كريستوفر نولان", "ستيفن سبيلبرغ", "جيمس كاميرون", "مارتن سكورسيزي"], correctIndex: 0 },
  { id: "q626", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو أطول سلسلة أفلام في التاريخ؟", options: ["هاري بوتر", "جيمس بوند", "مارفل", "-star wars"], correctIndex: 1 },
  { id: "q627", category: "أفلام ومسلسلات", difficulty: "hard", question: "من فاز بأوسكار أفضل ممثل عن فيلم «The Revenant»؟", options: ["ليوناردو دي كابريو", "توم هانكس", "مات ديمون", "براد بيت"], correctIndex: 0 },
  { id: "q628", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما هو المسلسل الذي يتميز بحرفي «W» و«M» في شعاره؟", options: ["Stranger Things", "Westworld", "Wire", "The Boys"], correctIndex: 0 },
  { id: "q629", category: "أفلام ومسلسلات", difficulty: "easy", question: "ما هو الفيلم الأعلى ربحاً في التاريخ؟", options: ["Avatar", "Avengers Endgame", "Titanic", "Star Wars"], correctIndex: 0 },
  { id: "q630", category: "أفلام ومسلسلات", difficulty: "hard", question: "من ألف رواية «سيد الخواتم»؟", options: ["ج. ر. ر. تولكين", "ج. ك. رولينج", "جورج مارتن", "ستيفن كينغ"], correctIndex: 0 },

  // ── طعام ومشروبات ──
  { id: "q631", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو الطبق الوطني لليابان؟", options: ["الرامن", "السوشي", "التمبورا", "الأودون"], correctIndex: 1 },
  { id: "q632", category: "طعام ومشروبات", difficulty: "medium", question: "من أي نبات يُستخرج السكر الأبيض؟", options: ["البنجر أو قصب السكر", "الذرة", "الأرز", "القمح"], correctIndex: 0 },
  { id: "q633", category: "طعام ومشروبات", difficulty: "hard", question: "ما هو أكثر نوع فلفل حرارة في العالم؟", options: ["كارولينا ريبر", "هابانيرو", "جاكرينو", "سيرانو"], correctIndex: 0 },
  { id: "q634", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي المادة التي تمنح الفلفل حِدّته؟", options: ["الكابسيسين", "السكر", "الحمض", "الملح"], correctIndex: 0 },
  { id: "q635", category: "طعام ومشروبات", difficulty: "medium", question: "من أي حبوب يُصنع الخبز التقليدي؟", options: ["القمح", "الأرز", "الشوفان", "الذرة"], correctIndex: 0 },
  { id: "q636", category: "طعام ومشروبات", difficulty: "hard", question: "ما هو الجبن الأشهر في إيطاليا للبيتزا؟", options: ["الموزاريلا", "البارميزان", "الشيدر", "الريكوتا"], correctIndex: 0 },
  { id: "q637", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي المشروب الأكثر استهلاكاً بعد الماء؟", options: ["الشاي", "القهوة", "العصير", "السوفت درينك"], correctIndex: 0 },
  { id: "q638", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو الفاكهة التي تحتوي على أعلى نسبة فيتامين C؟", options: ["البرتقال", "الجوافة", "الليمون", "الفراولة"], correctIndex: 1 },

  // ── حيوانات ──
  { id: "q639", category: "حيوانات", difficulty: "easy", question: "ما هو أسرع حيوان بري؟", options: ["الأسد", "الفهد", "الحصان", "الغزال"], correctIndex: 1 },
  { id: "q640", category: "حيوانات", difficulty: "medium", question: "كم قلباً يملك الأخطبوط؟", options: ["1", "2", "3", "4"], correctIndex: 2 },
  { id: "q641", category: "حيوانات", difficulty: "hard", question: "ما هو الحيوان الذي لا يشرب الماء طوال حياته؟", options: ["الكلب", "القط", "الكنغر", "الجمل"], correctIndex: 2 },
  { id: "q642", category: "حيوانات", difficulty: "easy", question: "ما هو أكبر حيوان في العالم؟", options: ["الفيل الأفريقي", "الحوت الأزرق", "القرش الأبيض", "الزرافة"], correctIndex: 1 },
  { id: "q643", category: "حيوانات", difficulty: "medium", question: "ما هي الطائر الذي يصدر صوتاً يشبه الضحك؟", options: ["الضحكة بيرد", "الببغاء", "الوقواق", "الطوط"], correctIndex: 0 },
  { id: "q644", category: "حيوانات", difficulty: "hard", question: "كم سن يعيش سلحفاة غالاباغوس تقريباً؟", options: ["50 سنة", "80 سنة", "100+ سنة", "200+ سنة"], correctIndex: 2 },
  { id: "q645", category: "حيوانات", difficulty: "easy", question: "ما هي الحيوان الذي يُلقب بسفينة الصحراء؟", options: ["الجمل", "الحمار", "الحصان", "الأرنب"], correctIndex: 0 },
  { id: "q646", category: "حيوانات", difficulty: "medium", question: "ما هو الحيوان الذي يحلم في نومه مثله مثل البشر؟", options: ["القط", "الكلب", "الماوس", "الجميع"], correctIndex: 3 },

  // ── موسيقى ──
  { id: "q647", category: "موسيقى", difficulty: "easy", question: "كم عدد أوتار الجيتار الكلاسيكي؟", options: ["4", "5", "6", "7"], correctIndex: 2 },
  { id: "q648", category: "موسيقى", difficulty: "medium", question: "من هو الملك مايكل جاكسون؟", options: ["مغني البوب", "مغني الروك", "مغني الراب", "مغني الجاز"], correctIndex: 0 },
  { id: "q649", category: "موسيقى", difficulty: "hard", question: "ما هو المقام الموسيقي الأشهر في الموسيقى العربية؟", options: ["مقام الرست", "مقام البياتي", "مقام الحجاز", "كل ما سبق"], correctIndex: 3 },
  { id: "q650", category: "موسيقى", difficulty: "medium", question: "من ألف سيمفونية التاسعة الشهيرة؟", options: ["بيتهوفن", "موتسارت", "باخ", "شوبرت"], correctIndex: 0 },
  { id: "q651", category: "موسيقى", difficulty: "easy", question: "ما هو الآلة الوترية الأكبر في الأوركسترا؟", options: ["الكمان", "التشيلو", "الكونترباص", "الفيولا"], correctIndex: 2 },
  { id: "q652", category: "موسيقى", difficulty: "hard", question: "من هو فنان «أغنية Thriller»؟", options: ["مايكل جاكسون", "برنس", "مادونا", "وينك"], correctIndex: 0 },

  // ── فنون ──
  { id: "q653", category: "فنون", difficulty: "easy", question: "من رسم لوحة الموناليزا؟", options: ["ليوناردو دافنشي", "بicaso", "فان جوخ", "مونيه"], correctIndex: 0 },
  { id: "q654", category: "فنون", difficulty: "medium", question: "ما هو الفن الذي يعتمد على الأشكال الهندسية البسيطة؟", options: ["التجريدي", "الواقعي", "الانطباعي", "السريالي"], correctIndex: 0 },
  { id: "q655", category: "فنون", difficulty: "hard", question: "في أي متحف تُعرض لوحة النجم ليلاً لفان جوخ؟", options: ["متحف اللوفر", "متحف MoMA بنيويورك", "المتحف البريطاني", "متحف مدريد"], correctIndex: 1 },
  { id: "q656", category: "فنون", difficulty: "medium", question: "من هو نحات تمثال ديفيد الشهير؟", options: ["مايكل أنجلو", "دوناتيلو", "رودان", "برنيني"], correctIndex: 0 },
  { id: "q657", category: "فنون", difficulty: "easy", question: "ما هو اللون الأساسي الذي يُرمز له بـ R في RGB؟", options: ["الأحمر", "الأزرق", "الأخضر", "الأصفر"], correctIndex: 0 },
  { id: "q658", category: "فنون", difficulty: "hard", question: "من هو رسام لوحة «صرخة»؟", options: ["إدفارد مونك", "فان جوخ", "غوغان", "سورا"], correctIndex: 0 },

  // ── منوعات ──
  { id: "q659", category: "منوعات", difficulty: "easy", question: "ما هو لون أرجل الطاووس الذكر؟", options: ["الأزرق", "الأبيض", "الأسود", "الذهبي"], correctIndex: 0 },
  { id: "q660", category: "منوعات", difficulty: "medium", question: "ما هي أسرع طائرة ركاب في التاريخ؟", options: ["كونكورد", "بوينغ 747", "إيرباص A380", "دوغلاس DC-10"], correctIndex: 0 },
  { id: "q661", category: "منوعات", difficulty: "hard", question: "ما هي أطول سلسلة جبال في العالم؟", options: ["جبال الأنديز", "الهيمالايا", "الألب", "الروكي"], correctIndex: 0 },
  { id: "q662", category: "منوعات", difficulty: "medium", question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q663", category: "منوعات", difficulty: "easy", question: "ما هو رمز الذهب الكيميائي؟", options: ["Au", "Ag", "Fe", "Cu"], correctIndex: 0 },
  { id: "q664", category: "منوعات", difficulty: "hard", question: "ما هي المادة التي لا تصنع منها أي شيء آخر؟", options: ["العنصر", "المركب", "الخلط", "السائل"], correctIndex: 0 },
];

/**
 * 🎯 حزمة الألغاز والتحديات — عقل خارق
 * أسئلة ألغاز أعلى تعقيداً لفئة «ملاحظة ودقة» و«ألغاز».
 */
export const MEGA_PACK_2: Question[] = [
  { id: "q665", category: "ألغاز وأحاجي", difficulty: "hard", question: "شيء إذا وضعته في الماء لا يتبلل، ما هو؟", options: ["الظل", "النور", "النار", "الهواء"], correctIndex: 0 },
  { id: "q666", category: "ألغاز وأحاجي", difficulty: "hard", question: "يتكلم كل لغات العالم بلا لسان، ما هو؟", options: ["الصدى", "الراديو", "المرآة", "الميكروفون"], correctIndex: 0 },
  { id: "q667", category: "ألغاز وأحاجي", difficulty: "medium", question: "أخوان يتجاهلان بعضهما ولا يتكلمان، ما هما؟", options: ["العينان", "اليدان", "القدمان", "الأذنان"], correctIndex: 0 },
  { id: "q668", category: "ألغاز وأحاجي", difficulty: "hard", question: "شيء كلما أخذت منه كبر، ما هو؟", options: ["الحفرة", "الكعكة", "العلم", "المال"], correctIndex: 0 },
  { id: "q669", category: "ألغاز وأحاجي", difficulty: "medium", question: "ما هو الشيء الذي يزيد ولا ينقص أبداً؟", options: ["العمر", "الماء", "الطعام", "النوم"], correctIndex: 0 },
  { id: "q670", category: "ألغاز وأحاجي", difficulty: "hard", question: "يكتب ولا يقرأ، ويحفظ ولا ينفع نفسه، ما هو؟", options: ["القلم", "الكاتب", "الدفتر", "المكتبة"], correctIndex: 0 },
  { id: "q671", category: "ألغاز وأحاجي", difficulty: "medium", question: "أشياء توجد في وسط باريس لكنها غير موجودة في لندن، ما هي؟", options: ["حرف R", "الأبراج", "الجسور", "المتاحف"], correctIndex: 0 },
  { id: "q672", category: "ألغاز وأحاجي", difficulty: "hard", question: "شيء يمشي بلا رجلين ويبكي بلا عينين، ما هو؟", options: ["السحاب", "الساعة", "النهر", "الريح"], correctIndex: 0 },
  { id: "q673", category: "ملاحظة ودقة", difficulty: "hard", question: "أي رقم يختلف عن البقية: 2، 3، 5، 7، 9، 11؟", options: ["2", "5", "7", "9"], correctIndex: 3 },
  { id: "q674", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة تختلف: شمس، قمر، نجمة، مطر؟", options: ["شمس", "قمر", "نجمة", "مطر"], correctIndex: 3 },
  { id: "q675", category: "ملاحظة ودقة", difficulty: "hard", question: "كلمة «LEVEL» — كم حرفاً مكرراً فيها؟", options: ["1", "2", "3", "4"], correctIndex: 2 },
  { id: "q676", category: "ملاحظة ودقة", difficulty: "medium", question: "أي شكل له أكبر عدد من خطوط التماثل: المربع أم الدائرة أم المثلث؟", options: ["المربع", "الدائرة", "المثلث", "متساوية"], correctIndex: 1 },
  { id: "q677", category: "ملاحظة ودقة", difficulty: "hard", question: "كم مرة يظهر الرقم 7 في الأعداد من 1 إلى 100؟", options: ["10", "11", "20", "21"], correctIndex: 2 },
  { id: "q678", category: "ملاحظة ودقة", difficulty: "medium", question: "أي جملة تحتوي على جميع حروف الأبجدية الإنجليزية؟", options: ["The quick brown fox", "Hello world program", "Artificial intelligence", "Machine learning"], correctIndex: 0 },

  // ── دين وثقافة ──
  { id: "q679", category: "دين وثقافة", difficulty: "easy", question: "كم عدد أركان الإسلام؟", options: ["3", "4", "5", "6"], correctIndex: 2 },
  { id: "q680", category: "دين وثقافة", difficulty: "medium", question: "ما هي أول سورة في القرآن الكريم؟", options: ["الفاتحة", "البقرة", "الناس", "الإخلاص"], correctIndex: 0 },
  { id: "q681", category: "دين وثقافة", difficulty: "hard", question: "كم عدد سور القرآن الكريم؟", options: ["110", "114", "120", "124"], correctIndex: 1 },
  { id: "q682", category: "دين وثقافة", difficulty: "medium", question: "ما هو الحج الذي يُؤدى مرة في العمر؟", options: ["الحج الواجب", "العمرة", "الحج الفرض", "الحج الأكبر"], correctIndex: 0 },
  { id: "q683", category: "دين وثقافة", difficulty: "easy", question: "كم عدد الصلوات المفروضة يومياً؟", options: ["3", "4", "5", "6"], correctIndex: 2 },
  { id: "q684", category: "دين وثقافة", difficulty: "hard", question: "ما هي السورة التي تُسمى قلب القرآن؟", options: ["يس", "الرحمن", "الكهف", "الملك"], correctIndex: 0 },
];
