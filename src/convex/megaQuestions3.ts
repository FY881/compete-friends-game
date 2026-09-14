import type { Question } from "./questions";

/**
 * 📚 الحزمة التوسعية الثالثة — المرحلة 14 من التحول الشامل
 * أسئلة جديدة (q685+) عبر كل الفئات بدرجات صعوبة متدرجة،
 * صياغة عربية واضحة وخيارات متقاربة لرفع جودة التحدي.
 */
export const MEGA_PACK_3: Question[] = [
  // ── علوم ──
  { id: "q685", category: "علوم", difficulty: "medium", question: "ما هو العضو المسؤول عن إنتاج الأنسولين في الجسم؟", options: ["الكبد", "البنكرياس", "الكلية", "الطحال"], correctIndex: 1 },
  { id: "q686", category: "علوم", difficulty: "hard", question: "ما هي أسرع سرعة في الكون المعروف؟", options: ["سرعة الصوت", "سرعة الضوء", "سرعة الرياح الشمسية", "سرعة المذنبات"], correctIndex: 1 },
  { id: "q687", category: "علوم", difficulty: "easy", question: "ما هو الكوكب الأحمر في المجموعة الشمسية؟", options: ["الزهرة", "المريخ", "المشتري", "عطارد"], correctIndex: 1 },
  { id: "q688", category: "علوم", difficulty: "medium", question: "ما هو الغاز الذي تمتصه النباتات في عملية البناء الضوئي؟", options: ["الأكسجين", "ثاني أكسيد الكربون", "النيتروجين", "الهيدروجين"], correctIndex: 1 },
  { id: "q689", category: "علوم", difficulty: "hard", question: "من اقترح نظرية النسبية العامة؟", options: ["نيوتن", "أينشتاين", "بور", "هايزنبرغ"], correctIndex: 1 },
  { id: "q690", category: "علوم", difficulty: "medium", question: "ما هي أصغر وحدة بناء في الكائن الحي؟", options: ["النسيج", "الخلية", "الجزيء", "العضو"], correctIndex: 1 },
  { id: "q691", category: "علوم", difficulty: "easy", question: "ما هي الحالة التي يتحول إليها الجليد عند تسخينه؟", options: ["بخار مباشرة", "سائل", "يذوب فقط", "يتسامى"], correctIndex: 1 },
  { id: "q692", category: "علوم", difficulty: "hard", question: "ما اسم الجسيم المتوسط الذي يربط الكواركات؟", options: ["الفوتون", "الغلوون", "الميون", "النيوترينو"], correctIndex: 1 },
  { id: "q693", category: "علوم", difficulty: "medium", question: "ما هو pH الماء النقي عند 25 درجة مئوية؟", options: ["5", "7", "9", "11"], correctIndex: 1 },
  { id: "q694", category: "علوم", difficulty: "medium", question: "كم يبلغ عمر الأرض تقريباً؟", options: ["1.5 مليار سنة", "4.5 مليار سنة", "10 مليارات سنة", "6000 سنة"], correctIndex: 1 },

  // ── تاريخ ──
  { id: "q695", category: "تاريخ", difficulty: "medium", question: "في أي عام وقعت معركة حطين؟", options: ["1174", "1187", "1192", "1258"], correctIndex: 1 },
  { id: "q696", category: "تاريخ", difficulty: "hard", question: "من هو مؤسس الدولة السلجوقية؟", options: ["طغرل بك", "ألب أرسلان", "مالك شاه", "سنجر"], correctIndex: 0 },
  { id: "q697", category: "تاريخ", difficulty: "medium", question: "أي حضارة بنت الأهرامات في مصر؟", options: ["السومرية", "الفرعونية", "الفينيقية", "البابلية"], correctIndex: 1 },
  { id: "q698", category: "تاريخ", difficulty: "hard", question: "ما هي الحرب التي انتهت بمعاهدة فرساي؟", options: ["الحرب العالمية الأولى", "الحرب العالمية الثانية", "حرب القرم", "حرب السنوات السبع"], correctIndex: 0 },
  { id: "q699", category: "تاريخ", difficulty: "easy", question: "من بنى سور الصين العظيم؟", options: ["المانشو", "الصينيون القدماء", "المغول", "اليابانيون"], correctIndex: 1 },
  { id: "q700", category: "تاريخ", difficulty: "medium", question: "متى سقطت القسطنطينية؟", options: ["1353", "1453", "1492", "1517"], correctIndex: 1 },
  { id: "q701", category: "تاريخ", difficulty: "hard", question: "من هو آخر خليفة عباسي في بغداد؟", options: ["المستعصم", "المتوكل", "الناصر", "المقتدر"], correctIndex: 0 },
  { id: "q702", category: "تاريخ", difficulty: "medium", question: "ما هي أقدم عاصمة معروفة في التاريخ؟", options: ["أور", "أثينا", "روما", "طيبة"], correctIndex: 0 },

  // ── جغرافيا ──
  { id: "q703", category: "جغرافيا", difficulty: "medium", question: "ما هو أطول نهر في آسيا؟", options: ["الفرات", "اليانغتسي", "السند", "دجلة"], correctIndex: 1 },
  { id: "q704", category: "جغرافيا", difficulty: "hard", question: "ما هي أعمق نقطة في المحيط الهادي؟", options: ["خندق ماريانا", "خندق جاوة", "خندق بورتوريكو", "خندق تونغا"], correctIndex: 0 },
  { id: "q705", category: "جغرافيا", difficulty: "easy", question: "ما هي أكبر صحراء حارة في العالم؟", options: ["الربع الخالي", "الصحراء الكبرى", "غمبي", "أتاكاما"], correctIndex: 1 },
  { id: "q706", category: "جغرافيا", difficulty: "medium", question: "أي بحر يفصل بين أوروبا وأفريقيا؟", options: ["البحر الأحمر", "البحر المتوسط", "بحر البلطيق", "بحر إيرلندا"], correctIndex: 1 },
  { id: "q707", category: "جغرافيا", difficulty: "hard", question: "ما هو البلد الأكبر مساحةً في العالم؟", options: ["كندا", "الصين", "روسيا", "أمريكا"], correctIndex: 2 },
  { id: "q708", category: "جغرافيا", difficulty: "medium", question: "ما هو المضيق الفاصل بين آسيا وأوروبا في تركيا؟", options: ["هرمز", "البوسفور", "جبل طارق", "باب المندب"], correctIndex: 1 },
  { id: "q709", category: "جغرافيا", difficulty: "easy", question: "ما هي أعلى قمة في العالم؟", options: ["K2", "إفرست", "كليمنجارو", "مونت بلانك"], correctIndex: 1 },

  // ── لغة وأدب ──
  { id: "q710", category: "لغة وأدب", difficulty: "medium", question: "من صاحب مقامات الحريري؟", options: ["الحريري", "الهمذاني", "الجاحظ", "ابن المقفع"], correctIndex: 0 },
  { id: "q711", category: "لغة وأدب", difficulty: "hard", question: "ما هو البحر الشعري الذي يكثر في مراثي الخنساء؟", options: ["الطويل", "الكامل", "البسيط", "الوافر"], correctIndex: 0 },
  { id: "q712", category: "لغة وأدب", difficulty: "medium", question: "من كتب «مقدمة» في علم الاجتماع قبل ابن خلدون؟", options: ["لا أحد قبله", "الجاحظ", "المسعودي", "ابن بطوطة"], correctIndex: 0 },
  { id: "q713", category: "لغة وأدب", difficulty: "easy", question: "ما جمع كلمة «قلم»؟", options: ["قلمات", "أقلام", "قولمة", "قلمون"], correctIndex: 1 },
  { id: "q714", category: "لغة وأدب", difficulty: "hard", question: "ما اسم الشاعر الملقب بـ«شاعر النيل»؟", options: ["حافظ إبراهيم", "أحمد شوقي", "معروف الرصافي", "بدر شاكر السياب"], correctIndex: 0 },
  { id: "q715", category: "لغة وأدب", difficulty: "medium", question: "كم حرفاً في الأبجدية العربية؟", options: ["26", "28", "30", "32"], correctIndex: 1 },

  // ── رياضيات ومنطق ──
  { id: "q716", category: "رياضيات ومنطق", difficulty: "medium", question: "ما هو مجموع زوايا الرباعي بالدرجات؟", options: ["180", "270", "360", "450"], correctIndex: 2 },
  { id: "q717", category: "رياضيات ومنطق", difficulty: "hard", question: "ما هي قيمة العدد النيبري مقربة لخانتين؟", options: ["2.71", "3.14", "1.61", "2.31"], correctIndex: 0 },
  { id: "q718", category: "رياضيات ومنطق", difficulty: "medium", question: "إذا كان س = 5، فما قيمة 3س + 4؟", options: ["15", "19", "23", "27"], correctIndex: 1 },
  { id: "q719", category: "رياضيات ومنطق", difficulty: "easy", question: "ما هو مربع العدد 12؟", options: ["124", "144", "169", "196"], correctIndex: 1 },
  { id: "q720", category: "رياضيات ومنطق", difficulty: "hard", question: "كم عدد أضلاع المتوازي الست常规؟ (سداسي منتظم)", options: ["5", "6", "7", "8"], correctIndex: 1 },

  // ── رياضة ──
  { id: "q721", category: "رياضة", difficulty: "easy", question: "بأي جزء من الجسم يُلعب كرة القدم رسمياً؟", options: ["اليد", "القدم", "الرأس فقط", "الجسم كله"], correctIndex: 1 },
  { id: "q722", category: "رياضة", difficulty: "medium", question: "في أي بلد أقيمت أول كأس عالم لكرة القدم؟", options: ["البرازيل", "أوروغواي", "إيطاليا", "فرنسا"], correctIndex: 1 },
  { id: "q723", category: "رياضة", difficulty: "hard", question: "كم مرة فازت البرازيل بكأس العالم حتى 2022؟", options: ["4", "5", "6", "3"], correctIndex: 1 },
  { id: "q724", category: "رياضة", difficulty: "medium", question: "كم طول ملعب الماراثون الأولمبي؟", options: ["40 كم", "42.195 كم", "45 كم", "38 كم"], correctIndex: 1 },
  { id: "q725", category: "رياضة", difficulty: "easy", question: "ما هي الرياضة التي يُلقب لاعبها بـ«ملكة الألعاب»؟", options: ["السباحة", "ألعاب القوى", "الجمباز", "الملاكمة"], correctIndex: 1 },

  // ── تقنية ──
  { id: "q726", category: "تقنية", difficulty: "medium", question: "ما معنى اختصار HTML؟", options: ["لغة ترميز النص الفائق", "لغة برمجة عالية المستوى", "بروتوكول نقل نص", "قاعدة بيانات نصية"], correctIndex: 0 },
  { id: "q727", category: "تقنية", difficulty: "hard", question: "من اخترع المحرك البخاري المحسّن الذي أشعل الثورة الصناعية؟", options: ["جيمس وات", "توماس إديسون", "نيكولا تسلا", "مايكل فاراداي"], correctIndex: 0 },
  { id: "q728", category: "تقنية", difficulty: "easy", question: "ما هو الجهاز المسؤول عن المعالجة في الحاسوب؟", options: ["الشاشة", "المعالج المركزي", "لوحة المفاتيح", "الطابعة"], correctIndex: 1 },
  { id: "q729", category: "تقنية", difficulty: "medium", question: "ما معنى اختصار RAM؟", options: ["ذاكرة الوصول العشوائي", "ذاكرة القراءة فقط", "وحدة المعالجة", "منفذ الشبكة"], correctIndex: 0 },
  { id: "q730", category: "تقنية", difficulty: "hard", question: "ما هي الخوارزمية الأكثر استخداماً لتشفير HTTPS؟", options: ["RSA/TLS", "MD5", "SHA-1", "Base64"], correctIndex: 0 },

  // ── فنون وثقافة ──
  { id: "q731", category: "فنون وثقافة", difficulty: "medium", question: "من رسم لوحة «الليل المرصّع بالنجوم»؟", options: ["فان جوخ", "بيكاسو", "مونيه", "دافنشي"], correctIndex: 0 },
  { id: "q732", category: "فنون وثقافة", difficulty: "hard", question: "ما هي أقدم آلة موسيقية معروفة في التاريخ؟", options: ["الناي", "العود", "الدف", "القيثارة"], correctIndex: 0 },
  { id: "q733", category: "فنون وثقافة", difficulty: "easy", question: "ما اللون الذي يُحصل عليه بمزج الأزرق والأصفر؟", options: ["البني", "الأخضر", "البرتقالي", "البنفسجي"], correctIndex: 1 },
  { id: "q734", category: "فنون وثقافة", difficulty: "medium", question: "كم مفردة في الأوبيرا الكلاسيكية عادة؟", options: ["3 فصول", "4 فصول", "5 فصول", "فصل واحد"], correctIndex: 0 },

  // ── دين وثقافة ──
  { id: "q735", category: "دين وثقافة", difficulty: "medium", question: "كم عدد أركان الإيمان؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q736", category: "دين وثقافة", difficulty: "hard", question: "ما هي الغزوة التي قُتل فيها حمزة بن عبد المطلب؟", options: ["أُحد", "بدر", "الخندق", "خيبر"], correctIndex: 0 },
  { id: "q737", category: "دين وثقافة", difficulty: "easy", question: "ما هو الشهر الذي يأتي بعد رمضان؟", options: ["شعبان", "شوال", "رجب", "ذو القعدة"], correctIndex: 1 },
  { id: "q738", category: "دين وثقافة", difficulty: "medium", question: "كم مرة يُلف الكعبة في الطواف؟", options: ["3", "5", "7", "10"], correctIndex: 2 },
];
