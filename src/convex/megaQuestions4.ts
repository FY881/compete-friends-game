import type { Question } from "./questions";

/**
 * 📚 الحزمة التوسعية الرابعة — توسيع ضخم حقيقي لبنك الأسئلة (q739 – q828).
 *
 * 90 سؤالاً جديداً موزعة على عشرة حقول معرفية، بتدرّج صعوبة حقيقي
 * (easy / medium / hard) وصياغة عربية واضحة وخيارات متقاربة ترفع جودة التحدي.
 * كل سؤال حقيقي بمصدر ثابت — لا حشو ولا تكرار لأي معرّف في البنك.
 */
export const MEGA_PACK_4: Question[] = [
  // ═══ علوم (q739 – q747) ═══
  { id: "q739", category: "علوم", difficulty: "easy", question: "ما هو الغاز الأكثر وفرة في الغلاف الجوي للأرض؟", options: ["الأكسجين", "النيتروجين", "ثاني أكسيد الكربون", "الأرجون"], correctIndex: 1 },
  { id: "q740", category: "علوم", difficulty: "medium", question: "ما هي وحدة قياس شدة التيار الكهربائي؟", options: ["الفولت", "الأمبير", "الأوم", "الواط"], correctIndex: 1 },
  { id: "q741", category: "علوم", difficulty: "medium", question: "ما هو المعدن الوحيد السائل في درجة حرارة الغرفة؟", options: ["الرصاص", "الزئبق", "القصدير", "الألمنيوم"], correctIndex: 1 },
  { id: "q742", category: "علوم", difficulty: "medium", question: "كم تبلغ سرعة الضوء في الفراغ تقريباً؟", options: ["30 ألف كم/ث", "300 ألف كم/ث", "3 ملايين كم/ث", "3000 كم/ث"], correctIndex: 1 },
  { id: "q743", category: "علوم", difficulty: "medium", question: "ما هو العضو المسؤول عن إفراز الأنسولين في الجسم؟", options: ["الكبد", "الكليتان", "البنكرياس", "الطحال"], correctIndex: 2 },
  { id: "q744", category: "علوم", difficulty: "hard", question: "ما هي قيمة الأس الهيدروجيني (pH) للماء النقي؟", options: ["5", "7", "9", "11"], correctIndex: 1 },
  { id: "q745", category: "علوم", difficulty: "easy", question: "ما هي الصبغة التي تمنح النبات لونه الأخضر؟", options: ["الكلوروفيل", "الكاروتين", "الهيموغلوبين", "الميلانين"], correctIndex: 0 },
  { id: "q746", category: "علوم", difficulty: "medium", question: "ما هو الغاز الذي يستخدم في طفايات الحريق لإخماد النار؟", options: ["الأكسجين", "الهيليوم", "ثاني أكسيد الكربون", "الميثان"], correctIndex: 2 },
  { id: "q747", category: "علوم", difficulty: "hard", question: "ما هي الجسيمات سالبة الشحنة في الذرة؟", options: ["البروتونات", "النيوترونات", "الإلكترونات", "النواة"], correctIndex: 2 },

  // ═══ جغرافيا (q748 – q756) ═══
  { id: "q748", category: "جغرافيا", difficulty: "easy", question: "ما هي أكبر صحراء حارة في العالم؟", options: ["صحراء الربع الخالي", "الصحراء الكبرى", "صحراء غوبي", "صحراء كالاهاري"], correctIndex: 1 },
  { id: "q749", category: "جغرافيا", difficulty: "easy", question: "ما هي أصغر قارة في العالم من حيث المساحة؟", options: ["أوروبا", "أنتاركتيكا", "أستراليا", "أمريكا الجنوبية"], correctIndex: 2 },
  { id: "q750", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة أستراليا؟", options: ["سيدني", "ملبورن", "كانبرا", "بيرث"], correctIndex: 2 },
  { id: "q751", category: "جغرافيا", difficulty: "medium", question: "ما هو المضيق الذي يفصل بين المغرب وإسبانيا؟", options: ["مضيق هرمز", "مضيق جبل طارق", "مضيق باب المندب", "مضيق البوسفور"], correctIndex: 1 },
  { id: "q752", category: "جغرافيا", difficulty: "hard", question: "ما هي أطول سلسلة جبال في العالم؟", options: ["الهيمالايا", "الأنديز", "الألب", "روكي"], correctIndex: 1 },
  { id: "q753", category: "جغرافيا", difficulty: "hard", question: "ما هي الدولة الأفريقية الأكبر من حيث عدد السكان؟", options: ["مصر", "نيجيريا", "إثيوبيا", "جنوب أفريقيا"], correctIndex: 1 },
  { id: "q754", category: "جغرافيا", difficulty: "medium", question: "ما هي أكبر مسطح مائي مغلق في العالم؟", options: ["بحيرة فيكتوريا", "بحر قزوين", "البحر الميت", "بحيرة سوبيريور"], correctIndex: 1 },
  { id: "q755", category: "جغرافيا", difficulty: "easy", question: "ما هي عاصمة البرازيل؟", options: ["ريو دي جانيرو", "ساو باولو", "برازيليا", "سلفادور"], correctIndex: 2 },
  { id: "q756", category: "جغرافيا", difficulty: "easy", question: "ما هي القناة التي تربط البحر الأحمر بالبحر المتوسط؟", options: ["قناة بنما", "قناة السويس", "قناة كيل", "قناة كورنث"], correctIndex: 1 },

  // ═══ رياضيات (q757 – q765) ═══
  { id: "q757", category: "رياضيات", difficulty: "easy", question: "ما هو الجذر التربيعي للعدد 144؟", options: ["11", "12", "13", "14"], correctIndex: 1 },
  { id: "q758", category: "رياضيات", difficulty: "easy", question: "كم عدد أضلاع الشكل السداسي؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q759", category: "رياضيات", difficulty: "medium", question: "ما هو مجموع زوايا المثلث بالدرجات؟", options: ["90", "180", "270", "360"], correctIndex: 1 },
  { id: "q760", category: "رياضيات", difficulty: "hard", question: "ما هو أصغر عدد أولي؟", options: ["0", "1", "2", "3"], correctIndex: 2 },
  { id: "q761", category: "رياضيات", difficulty: "easy", question: "كم درجة قياس الزاوية القائمة؟", options: ["45", "90", "180", "270"], correctIndex: 1 },
  { id: "q762", category: "رياضيات", difficulty: "medium", question: "ما هو حاصل ضرب 7 في 8؟", options: ["48", "54", "56", "64"], correctIndex: 2 },
  { id: "q763", category: "رياضيات", difficulty: "hard", question: "ما هو ناتج 15% من العدد 200؟", options: ["15", "20", "30", "45"], correctIndex: 2 },
  { id: "q764", category: "رياضيات", difficulty: "medium", question: "كم ثانية في الساعة الواحدة؟", options: ["600", "1800", "3600", "6000"], correctIndex: 2 },
  { id: "q765", category: "رياضيات", difficulty: "hard", question: "ما هو العدد الذي إذا ضربته في أي عدد كان الناتج صفراً؟", options: ["1", "0", "-1", "10"], correctIndex: 1 },

  // ═══ لغة (q766 – q774) ═══
  { id: "q766", category: "لغة", difficulty: "easy", question: "ما هو جمع كلمة «كتاب»؟", options: ["كاتبون", "كتب", "كتابات فقط", "مكتبات فقط"], correctIndex: 1 },
  { id: "q767", category: "لغة", difficulty: "easy", question: "ما هو مفرد كلمة «تلاميذ»؟", options: ["تلميذ", "تالميذ", "مِتلمذ", "تلمذة"], correctIndex: 0 },
  { id: "q768", category: "لغة", difficulty: "easy", question: "ما هي الكلمة التي تعني عكس «الكرم»؟", options: ["الجود", "السخاء", "البخل", "العطاء"], correctIndex: 2 },
  { id: "q769", category: "لغة", difficulty: "medium", question: "كم عدد حروف اللغة العربية؟", options: ["26", "27", "28", "29"], correctIndex: 2 },
  { id: "q770", category: "لغة", difficulty: "easy", question: "ما هو الفعل الماضي من «يكتب»؟", options: ["كاتب", "كتب", "مكتوب", "كتابة"], correctIndex: 1 },
  { id: "q771", category: "لغة", difficulty: "medium", question: "ما هو جمع كلمة «نهر»؟", options: ["نهرات", "أنهار", "نُهور فقط", "نواهر"], correctIndex: 1 },
  { id: "q772", category: "لغة", difficulty: "easy", question: "ما هو عكس كلمة «الصعود»؟", options: ["الطلوع", "الهبوط", "الارتفاع", "النزوح"], correctIndex: 1 },
  { id: "q773", category: "لغة", difficulty: "hard", question: "في جملة «قرأ الطالبُ الدرسَ» ما هو المفعول به؟", options: ["قرأ", "الطالب", "الدرس", "لا مفعول به"], correctIndex: 2 },
  { id: "q774", category: "لغة", difficulty: "hard", question: "ما هو نوع كلمة «شمس» من حيث التذكير والتأنيث؟", options: ["مذكر", "مؤنث", "يصح الوجهان بلا قاعدة", "جمع"], correctIndex: 1 },

  // ═══ منطق (q775 – q783) ═══
  { id: "q775", category: "منطق", difficulty: "easy", question: "إذا كانت كل القطط حيوانات، و«ميمي» قطة، فماذا نستنتج؟", options: ["ميمي ليست حيواناً", "ميمي حيوان", "كل الحيوانات قطط", "لا استنتاج ممكن"], correctIndex: 1 },
  { id: "q776", category: "منطق", difficulty: "easy", question: "أكمل النمط: 2، 4، 8، 16، …", options: ["20", "24", "32", "36"], correctIndex: 2 },
  { id: "q777", category: "منطق", difficulty: "medium", question: "أكمل النمط: 1، 1، 2، 3، 5، 8، …", options: ["11", "12", "13", "16"], correctIndex: 2 },
  { id: "q778", category: "منطق", difficulty: "easy", question: "أي العناصر لا ينتمي إلى المجموعة: تفاح، موز، جزر، عنب؟", options: ["تفاح", "موز", "جزر", "عنب"], correctIndex: 2 },
  { id: "q779", category: "منطق", difficulty: "medium", question: "أكمل ترتيب الحروف الهجائية: أ، ب، ت، ث، …", options: ["ح", "ج", "خ", "د"], correctIndex: 1 },
  { id: "q780", category: "منطق", difficulty: "hard", question: "أكمل النمط: 100، 90، 81، 73، …", options: ["65", "66", "67", "68"], correctIndex: 1 },
  { id: "q781", category: "منطق", difficulty: "hard", question: "إذا كان اليوم الثلاثاء، فما هو اليوم بعد عشرة أيام؟", options: ["الخميس", "الجمعة", "السبت", "الأحد"], correctIndex: 1 },
  { id: "q782", category: "منطق", difficulty: "easy", question: "أي العناصر لا ينتمي إلى المجموعة: قلم، مسطرة، دفتر، سيارة؟", options: ["قلم", "مسطرة", "دفتر", "سيارة"], correctIndex: 3 },
  { id: "q783", category: "منطق", difficulty: "medium", question: "أكمل النمط: 5، 10، 20، 40، …", options: ["50", "60", "80", "100"], correctIndex: 2 },

  // ═══ تاريخ (q784 – q792) ═══
  { id: "q784", category: "تاريخ", difficulty: "easy", question: "في أي عام انتهت الحرب العالمية الثانية؟", options: ["1918", "1939", "1945", "1950"], correctIndex: 2 },
  { id: "q785", category: "تاريخ", difficulty: "medium", question: "من هو أول رئيس للولايات المتحدة الأمريكية؟", options: ["أبراهام لينكولن", "جورج واشنطن", "توماس جيفرسون", "بنجامين فرانكلين"], correctIndex: 1 },
  { id: "q786", category: "تاريخ", difficulty: "easy", question: "في أي عام هبط الإنسان على سطح القمر أول مرة؟", options: ["1959", "1965", "1969", "1972"], correctIndex: 2 },
  { id: "q787", category: "تاريخ", difficulty: "hard", question: "ما هي أقدم حضارة معروفة في بلاد الرافدين؟", options: ["البابلية", "الآشورية", "السومرية", "الأكدية"], correctIndex: 2 },
  { id: "q788", category: "تاريخ", difficulty: "medium", question: "في أي عام سقط جدار برلين؟", options: ["1979", "1985", "1989", "1991"], correctIndex: 2 },
  { id: "q789", category: "تاريخ", difficulty: "hard", question: "من قاد الجيش المسلم في فتح مصر؟", options: ["خالد بن الوليد", "عمرو بن العاص", "سعد بن أبي وقاص", "أبو عبيدة بن الجراح"], correctIndex: 1 },
  { id: "q790", category: "تاريخ", difficulty: "medium", question: "في أي عام تأسست الأمم المتحدة؟", options: ["1919", "1945", "1948", "1955"], correctIndex: 1 },
  { id: "q791", category: "تاريخ", difficulty: "medium", question: "من هو المستكشف الذي وصل إلى الأمريكتين عام 1492؟", options: ["ماجلان", "كريستوفر كولومبوس", "فاسكو دا غاما", "جيمس كوك"], correctIndex: 1 },
  { id: "q792", category: "تاريخ", difficulty: "hard", question: "أي إمبراطورية قديمة اتخذت من مدينة «بيزنطة» عاصمة لها؟", options: ["الرومانية الغربية", "البيزنطية", "الفارسية", "المغولية"], correctIndex: 1 },

  // ═══ رياضة (q793 – q801) ═══
  { id: "q793", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق كرة القدم داخل الملعب؟", options: ["9", "10", "11", "12"], correctIndex: 2 },
  { id: "q794", category: "رياضة", difficulty: "easy", question: "كل كم سنة تُقام الألعاب الأولمبية الصيفية؟", options: ["سنتان", "ثلاث", "أربع", "خمس"], correctIndex: 2 },
  { id: "q795", category: "رياضة", difficulty: "medium", question: "في أي رياضة يُستخدم مصطلح «سلام دانك»؟", options: ["كرة اليد", "كرة السلة", "الكرة الطائرة", "التنس"], correctIndex: 1 },
  { id: "q796", category: "رياضة", difficulty: "medium", question: "من فاز بكأس العالم لكرة القدم 2022؟", options: ["فرنسا", "الأرجنتين", "البرازيل", "كرواتيا"], correctIndex: 1 },
  { id: "q797", category: "رياضة", difficulty: "hard", question: "كم عدد الأشواط في مباراة كرة السلة بدوري NBA؟", options: ["شوطان", "ثلاثة", "أربعة", "خمسة"], correctIndex: 2 },
  { id: "q798", category: "رياضة", difficulty: "easy", question: "ما هي الرياضة الملقبة بـ«اللعبة الجميلة»؟", options: ["التنس", "كرة القدم", "الكريكيت", "الغولف"], correctIndex: 1 },
  { id: "q799", category: "رياضة", difficulty: "easy", question: "في أي رياضة يُستخدم المضرب والريشة؟", options: ["تنس الطاولة", "الريشة الطائرة", "الإسكواش", "الغولف"], correctIndex: 1 },
  { id: "q800", category: "رياضة", difficulty: "hard", question: "كم يبلغ طول حوض السباحة الأولمبي؟", options: ["25 متراً", "33 متراً", "50 متراً", "100 متر"], correctIndex: 2 },
  { id: "q801", category: "رياضة", difficulty: "medium", question: "كم عدد لاعبي فريق الكرة الطائرة داخل الملعب؟", options: ["5", "6", "7", "8"], correctIndex: 1 },

  // ═══ تكنولوجيا (q802 – q810) ═══
  { id: "q802", category: "تكنولوجيا", difficulty: "easy", question: "إلى ماذا يرمز الاختصار CPU؟", options: ["وحدة معالجة الرسوميات", "وحدة المعالجة المركزية", "ذاكرة الوصول العشوائي", "وحدة التخزين"], correctIndex: 1 },
  { id: "q803", category: "تكنولوجيا", difficulty: "medium", question: "ما هي لغة البرمجة الأساسية لتشغيل التفاعل في صفحات الويب؟", options: ["بايثون", "جافاسكربت", "جافا", "روبي"], correctIndex: 1 },
  { id: "q804", category: "تكنولوجيا", difficulty: "easy", question: "إلى ماذا يرمز الاختصار RAM؟", options: ["ذاكرة القراءة فقط", "ذاكرة الوصول العشوائي", "وحدة التخزين الدائم", "معالج الرسوميات"], correctIndex: 1 },
  { id: "q805", category: "تكنولوجيا", difficulty: "easy", question: "ما هو نظام التشغيل مفتوح المصدر الأشهر للهواتف الذكية؟", options: ["iOS", "أندرويد", "ويندوز فون", "سيمبيان"], correctIndex: 1 },
  { id: "q806", category: "تكنولوجيا", difficulty: "medium", question: "ما هو البروتوكول المشفّر المستخدم لتصفح الويب الآمن؟", options: ["HTTP", "HTTPS", "FTP", "SMTP"], correctIndex: 1 },
  { id: "q807", category: "تكنولوجيا", difficulty: "easy", question: "ما هي الشركة التي طوّرت نظام تشغيل ويندوز؟", options: ["آبل", "مايكروسوفت", "جوجل", "آي بي إم"], correctIndex: 1 },
  { id: "q808", category: "تكنولوجيا", difficulty: "easy", question: "إلى ماذا يرمز الاختصار AI؟", options: ["الواقع المعزز", "الذكاء الاصطناعي", "التعلم الآلي", "الحوسبة السحابية"], correctIndex: 1 },
  { id: "q809", category: "تكنولوجيا", difficulty: "medium", question: "ما هي وحدة قياس سعة التخزين الأكبر من الميجابايت مباشرة؟", options: ["الكيلوبايت", "الجيجابايت", "التيرابايت", "البِت"], correctIndex: 1 },
  { id: "q810", category: "تكنولوجيا", difficulty: "hard", question: "ما هو أول حاسوب إلكتروني رقمي عام الغرض؟", options: ["UNIVAC", "ENIAC", "IBM PC", "Colossus"], correctIndex: 1 },

  // ═══ حيوانات (q811 – q819) ═══
  { id: "q811", category: "حيوانات", difficulty: "easy", question: "ما هو أسرع حيوان بري في العالم؟", options: ["الأسد", "الفهد", "الحصان", "الغزال"], correctIndex: 1 },
  { id: "q812", category: "حيوانات", difficulty: "easy", question: "ما هو أكبر حيوان على وجه الأرض؟", options: ["الفيل الأفريقي", "الحوت الأزرق", "الزرافة", "القرش الأبيض"], correctIndex: 1 },
  { id: "q813", category: "حيوانات", difficulty: "easy", question: "كم عدد أرجل العنكبوت؟", options: ["6", "8", "10", "12"], correctIndex: 1 },
  { id: "q814", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الذي يُضرب به المثل في البطء؟", options: ["السلحفاة", "الأرنب", "القط", "الثعلب"], correctIndex: 0 },
  { id: "q815", category: "حيوانات", difficulty: "medium", question: "أي طائر لا يستطيع الطيران ويعيش في القطب الجنوبي؟", options: ["النعامة", "البطريق", "الديك الرومي", "الكيوي"], correctIndex: 1 },
  { id: "q816", category: "حيوانات", difficulty: "medium", question: "ما هو أكبر طائر في العالم؟", options: ["النسر", "النعامة", "اللقلق", "الطاووس"], correctIndex: 1 },
  { id: "q817", category: "حيوانات", difficulty: "hard", question: "أي حيوان يستطيع النوم واقفاً بشكل طبيعي؟", options: ["القط", "الحصان", "الكلب", "الأرنب"], correctIndex: 1 },
  { id: "q818", category: "حيوانات", difficulty: "hard", question: "أي حيوان لديه بصمة أنف فريدة تشبه بصمة الإنسان؟", options: ["الكلب", "القط", "الحصان", "الفيل"], correctIndex: 0 },
  { id: "q819", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الذي يغيّر لون جلده للتمويه؟", options: ["الحرباء", "الضفدع", "السحلية", "الأفعى"], correctIndex: 0 },

  // ═══ فضاء (q820 – q828) ═══
  { id: "q820", category: "فضاء", difficulty: "easy", question: "ما هو النجم الأقرب إلى كوكب الأرض؟", options: ["الشعرى اليمانية", "الشمس", "النجم القطبي", "بروكسيما"], correctIndex: 1 },
  { id: "q821", category: "فضاء", difficulty: "easy", question: "كم عدد كواكب المجموعة الشمسية؟", options: ["7", "8", "9", "10"], correctIndex: 1 },
  { id: "q822", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الملقب بـ«الكوكب الأحمر»؟", options: ["الزهرة", "المريخ", "المشتري", "عطارد"], correctIndex: 1 },
  { id: "q823", category: "فضاء", difficulty: "easy", question: "كم عدد الأقمار الطبيعية لكوكب الأرض؟", options: ["قمر واحد", "قمران", "ثلاثة", "لا يوجد"], correctIndex: 0 },
  { id: "q824", category: "فضاء", difficulty: "medium", question: "ما هي المجرة التي تضم مجموعتنا الشمسية؟", options: ["أندروميدا", "درب التبانة", "المجرة المثلثية", "سومبريرو"], correctIndex: 1 },
  { id: "q825", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب المشهور بحلقاته الواضحة؟", options: ["المشتري", "زحل", "أورانوس", "نبتون"], correctIndex: 1 },
  { id: "q826", category: "فضاء", difficulty: "hard", question: "من هو أول إنسان صعد إلى الفضاء؟", options: ["نيل أرمسترونغ", "يوري غاغارين", "باز ألدرين", "جون غلين"], correctIndex: 1 },
  { id: "q827", category: "فضاء", difficulty: "medium", question: "ما هي القوة التي تُبقي الكواكب تدور حول الشمس؟", options: ["المغناطيسية", "الجاذبية", "الاحتكاك", "الدفع"], correctIndex: 1 },
  { id: "q828", category: "فضاء", difficulty: "hard", question: "كم يستغرق ضوء الشمس للوصول إلى الأرض تقريباً؟", options: ["8 ثوانٍ", "8 دقائق", "ساعة واحدة", "يوم كامل"], correctIndex: 1 },
];
