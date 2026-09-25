import type { Question } from "./questions";

/** Questions q3121–q3160: balanced additions for music, culture, biology, general knowledge, and puzzles. */
export const MEGA_PACK_10: Question[] = [
  // ── موسيقى ─────────────────────────────────────────────────────────────
  { id: "q3121", category: "موسيقى", difficulty: "easy", question: "كم عدد النوتات الطبيعية في السلم الموسيقي الكبير؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q3122", category: "موسيقى", difficulty: "easy", question: "ماذا يعني Crescendo في الموسيقى؟", options: ["تبطئة", "رفع مستوى الصوت تدريجياً", "تسريع", "العودة للمقطوعة"], correctIndex: 1 },
  { id: "q3123", category: "موسيقى", difficulty: "medium", question: "من ألّف السيمفونية التاسعة؟", options: ["باخ", "بيتهوفن", "موزارت", "شوبان"], correctIndex: 1 },
  { id: "q3124", category: "موسيقى", difficulty: "medium", question: "ماذا تعني Andante في المقام الموسيقي؟", options: ["ببطء معتدل", "بسرعة قصوى", "بصوت عالٍ", "بدون إيقاع"], correctIndex: 0 },
  { id: "q3125", category: "موسيقى", difficulty: "hard", question: "أي عصر موسيقي تنتمي إليه أعمال Bach وHandel؟", options: ["الباروك", "الكلاسيكي", "الرومانسي", "الحديث"], correctIndex: 0 },
  { id: "q3126", category: "موسيقى", difficulty: "hard", question: "ما الآلة التي تُعزف عادةً بالقوس؟", options: ["الكمان", "العود", "الأوكتاف", "الناي"], correctIndex: 0 },
  { id: "q3127", category: "موسيقى", difficulty: "extreme", question: "ما المقام القديم الذي لا يزال أساساً لكثير من المقامات العربية؟", options: ["الربع", "الراست", "الدو", "الصول"], correctIndex: 1 },
  { id: "q3128", category: "موسيقى", difficulty: "extreme", question: "ما اسم المجموعة التي ألّفها Bach من مجموعتين للبيانو في جميع المفاتيح؟", options: ["كتاب المدّ", "البيانو المضبوط", "الموسيقى القديمة", "الأربعة فصول"], correctIndex: 1 },

  // ── دين وثقافة ──────────────────────────────────────────────────────────
  { id: "q3129", category: "دين وثقافة", difficulty: "easy", question: "ما اسم صلاة الجمعة؟", options: ["صلاة الفجر", "صلاة الجمعة", "صلاة المغرب", "صلاة العيد"], correctIndex: 1 },
  { id: "q3130", category: "دين وثقافة", difficulty: "easy", question: "ما الشهر التاسع من السنة الهجرية؟", options: ["شعبان", "رمضان", "شوال", "ربيع"], correctIndex: 1 },
  { id: "q3131", category: "دين وثقافة", difficulty: "medium", question: "ما الركن الذي يشمل الحج إلى البيت الحرام؟", options: ["الصلاة", "الزكاة", "الصوم", "الحج"], correctIndex: 3 },
  { id: "q3132", category: "دين وثقافة", difficulty: "medium", question: "ما اسم الشهر الذي يؤدي فيه المسلمون فريضة الحج؟", options: ["ذي الحجة", "محرم", "ربيع الأول", "جمادى"], correctIndex: 0 },
  { id: "q3133", category: "دين وثقافة", difficulty: "hard", question: "ما اسم المعبد الذي بناه جوستنيان الأول في إسطنبول؟", options: ["آيا صوفيا", "كنيسة نهر", "كاتدرائية نوتردام", "كنيسة الفاتيكان"], correctIndex: 0 },
  { id: "q3134", category: "دين وثقافة", difficulty: "hard", question: "ما اسم حاكم مالي الشهير الذي اشتهر بعلومه ورحلاته؟", options: ["منسا موسي", "هارون الرشيد", "ابن بطوطة", "المأمون"], correctIndex: 2 },
  { id: "q3135", category: "دين وثقافة", difficulty: "extreme", question: "في المصريات القديمة، ترتبط أي آلهة بالأمومة والولادة؟", options: ["إيزيس", "حورس", "أنوبيس", "نفرتيتي"], correctIndex: 0 },
  { id: "q3136", category: "دين وثقافة", difficulty: "extreme", question: "ما اسم المكتبة الشهيرة التي ازدهرت في بغداد في العصر الذهبي؟", options: ["مكتبة الإسكندرية", "بيت الحكمة", "مكتبة الإسكندري", "دار الكتب"], correctIndex: 1 },

  // ── جسم الإنسان ────────────────────────────────────────────────────────
  { id: "q3137", category: "جسم الإنسان", difficulty: "easy", question: "ما العضو الذي يضخ الدم؟", options: ["القلب", "الكبد", "الطحال", "المعدة"], correctIndex: 0 },
  { id: "q3138", category: "جسم الإنسان", difficulty: "easy", question: "كم عدد عظام جسم الإنسان البالغ تقريباً؟", options: ["186", "206", "226", "306"], correctIndex: 1 },
  { id: "q3139", category: "جسم الإنسان", difficulty: "medium", question: "أين يحدث تبادل الغازات في الرئتين أساساً؟", options: ["الشعيرات", "الحويصلات الهوائية", "القصبة", "الغشاء البلوري"], correctIndex: 1 },
  { id: "q3140", category: "جسم الإنسان", difficulty: "medium", question: "ما الهرمون الذي يخفض سكر الدم وينتج من البنكرياس؟", options: ["الكورتيزول", "الإنسولين", "الأدرينالين", "الثيروكسين"], correctIndex: 1 },
  { id: "q3141", category: "جسم الإنسان", difficulty: "hard", question: "ما الوحدة الأساسية للجهاز العصبي؟", options: ["الخلية العصبية", "النفرون", "الخلية العضلية", "الجسيم"], correctIndex: 0 },
  { id: "q3142", category: "جسم الإنسان", difficulty: "hard", question: "ما الصفائح الدموية التي تشارك أساساً في تخثر الدم؟", options: ["الصفيحات", "الكريات البيضاء", "كريات الدم الحمراء", "البلازما"], correctIndex: 0 },
  { id: "q3143", category: "جسم الإنسان", difficulty: "extreme", question: "ما القواعد النيتروجينية الأربع في الحمض النووي DNA؟", options: ["A وT وC وG", "A وU وC وG", "X وY وW وZ", "A وB وC وD"], correctIndex: 0 },
  { id: "q3144", category: "جسم الإنسان", difficulty: "extreme", question: "أي جزء في الدماغ يساعد على ضبط حرارة الجسم والجوع والعطش؟", options: ["المخيخ", "تحت المهاد", "الفص الجداري", "النخاع"], correctIndex: 1 },

  // ── منوعات ─────────────────────────────────────────────────────────────
  { id: "q3145", category: "منوعات", difficulty: "easy", question: "كم متراً في الكيلومتر الواحد؟", options: ["100", "1000", "10000", "10"], correctIndex: 1 },
  { id: "q3146", category: "منوعات", difficulty: "easy", question: "كم متراً مربعاً في الهكتار الواحد؟", options: ["1000", "5000", "10000", "20000"], correctIndex: 2 },
  { id: "q3147", category: "منوعات", difficulty: "medium", question: "ما وحدة قياس القوة في النظام الدولي؟", options: ["النيوتن", "الجول", "الواط", "الباسكال"], correctIndex: 0 },
  { id: "q3148", category: "منوعات", difficulty: "medium", question: "ما وحدة قياس التردد الزمني؟", options: ["الهرتز", "النيوتن", "الجول", "الباسكال"], correctIndex: 0 },
  { id: "q3149", category: "منوعات", difficulty: "hard", question: "ما المبدأ الذي يجعل انعكاس الضوء الكلي يحدث داخل الألياف الضوئية؟", options: ["الانعكاس الكلي الداخلي", "الانكسار فقط", "الانتشار الحراري", "الشحنات الكهربائية"], correctIndex: 0 },
  { id: "q3150", category: "منوعات", difficulty: "hard", question: "كم يبلغ الضغط الجوي القياسي تقريباً؟", options: ["760 mmHg", "100 mmHg", "560 mmHg", "1060 mmHg"], correctIndex: 0 },
  { id: "q3151", category: "منوعات", difficulty: "extreme", question: "ما الوحدة التي تقيس الجرعة الممتصة من الإشعاع المؤين؟", options: ["الجول", "الغراي", "السيفرت", "البيك"], correctIndex: 1 },
  { id: "q3152", category: "منوعات", difficulty: "extreme", question: "ماذا يقصد بالميغابايت عادةً في الأنظمة الرقمية الثنائية الحديثة؟", options: ["2²⁰ بايت", "10⁶ بايت", "2¹⁰ بايت", "10⁹ بايت"], correctIndex: 0 },

  // ── ألغاز وأحاجي ───────────────────────────────────────────────────────
  { id: "q3153", category: "ألغاز وأحاجي", difficulty: "easy", question: "ما الشيء الذي له يدان ولا يستطيع أن يصفق؟", options: ["الساعة", "الباب", "الشجرة", "الطاولة"], correctIndex: 0 },
  { id: "q3154", category: "ألغاز وأحاجي", difficulty: "easy", question: "ما الشيء الذي يجفّ أكثر كلما جفّ أكثر؟", options: ["المنشفة", "الورق", "الخشب", "الزجاج"], correctIndex: 0 },
  { id: "q3155", category: "ألغاز وأحاجي", difficulty: "medium", question: "ما الشيء الذي يحمل مدناً كثيرة ولا يحمل بيتاً واحداً؟", options: ["الخريطة", "الكرة", "الحقيبة", "الساعة"], correctIndex: 0 },
  { id: "q3156", category: "ألغاز وأحاجي", difficulty: "medium", question: "إذا كان A يساوي ضعف B، وB يساوي 3 أمثال C، فما العلاقة بين A وC؟", options: ["A=C", "A=2C", "A=3C", "A=6C"], correctIndex: 3 },
  { id: "q3157", category: "ألغاز وأحاجي", difficulty: "hard", question: "تستغرق 5 آلات 5 دقائق لصنع 5 قطع. كم تستغرق 100 آلة لصنع 100 قطعة؟", options: ["5 دقائق", "10 دقائق", "20 دقيقة", "100 دقيقة"], correctIndex: 0 },
  { id: "q3158", category: "ألغاز وأحاجي", difficulty: "hard", question: "حشرة تتحرك 3 أمتار في النهار وتتراجع 2 أمتار ليلاً. كم يوماً تحتاج لبلوغ ارتفاع 10 أمتار؟", options: ["6 أيام", "7 أيام", "8 أيام", "10 أيام"], correctIndex: 2 },
  { id: "q3159", category: "ألغاز وأحاجي", difficulty: "extreme", question: "عند جسر يعبره شخصان في دقيقة، وآخر في دقيقتين، والعابر في 5 دقائق، والمصباح واحد. ما أقل وقت لعبور الثلاثة؟", options: ["8 دقائق", "9 دقائق", "10 دقائق", "11 دقيقة"], correctIndex: 3 },
  { id: "q3160", category: "ألغاز وأحاجي", difficulty: "extreme", question: "عنكبوت على جدار ارتفاعه 30م. يصعد 15م ثم تنزل ذبابة 1م كل يوم، ثم يصعد العنكبوت 15م. كم يوماً حتى القمة؟", options: ["27 يوماً", "28 يوماً", "29 يوماً", "30 يوماً"], correctIndex: 3 },
];
