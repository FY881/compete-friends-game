/**
 * ═══════════════════════════════════════════════════════════════════════
 * MEGA_PACK_6 — التوسعة الثانية الضخمة (q2000+) — ~200 سؤال جديد
 * تُربط في questions.ts داخل QUESTION_BANK. الفئات مطابقة لـ CATEGORIES.
 * ═══════════════════════════════════════════════════════════════════════
 */
import type { Question } from "./questions";

export const MEGA_PACK_6: Question[] = [
  // ── عام (q2001+) ─────────────────────────────────────────────────────
  { id: "q2001", category: "عام", difficulty: "medium", question: "ما هي أكبر دولة في العالم مساحةً؟", options: ["كندا", "الصين", "روسيا", "أمريكا"], correctIndex: 2 },
  { id: "q2002", category: "عام", difficulty: "easy", question: "كم عدد ألوان علم مصر؟", options: ["3", "4", "5", "2"], correctIndex: 0 },
  { id: "q2003", category: "عام", difficulty: "medium", question: "ما هي العملة الرسمية للمملكة المتحدة؟", options: ["اليورو", "الجنيه الإسترليني", "الدولار", "الفرنك"], correctIndex: 1 },
  { id: "q2004", category: "عام", difficulty: "hard", question: "ما هو أضيق ممر مائي يربط البحر الأحمر بالخليج؟", options: ["قناة السويس", "باب المندب", "هرمز", "البوسفور"], correctIndex: 1 },
  { id: "q2005", category: "عام", difficulty: "easy", question: "ما هي اللغة الأكثر تحدثاً في العالم؟", options: ["الإنجليزية", "الإسبانية", "الماندرين الصينية", "الهندية"], correctIndex: 2 },
  { id: "q2006", category: "عام", difficulty: "medium", question: "ما اسم أشهر برج في باريس؟", options: ["برج مونبارناس", "برج إيفل", "برج لندن", "برج دبي"], correctIndex: 1 },
  { id: "q2007", category: "عام", difficulty: "easy", question: "كم عدد أشهر السنة الميلادية؟", options: ["10", "11", "12", "13"], correctIndex: 2 },
  { id: "q2008", category: "عام", difficulty: "medium", question: "ما هو الحيوان الرمزي للصين (غير الباندا)؟", options: ["النمر الصيني", "التنين", "الحصان", "الغزال"], correctIndex: 1 },
  { id: "q2009", category: "عام", difficulty: "hard", question: "ما هي أصغر محيط في العالم؟", options: ["الهادئ", "الأطلسي", "الهندي", "المتجمد الشمالي"], correctIndex: 3 },
  { id: "q2010", category: "عام", difficulty: "easy", question: "ما هي أكبر مدينة عربية سكاناً؟", options: ["القاهرة", "بغداد", "الرياض", "الإسكندرية"], correctIndex: 0 },
  { id: "q2011", category: "عام", difficulty: "medium", question: "ما هي أعلى شارة عسكرية عالمياً في السلم الدبلوماسي؟", options: ["السفير", "القنصل", "المفوض", "الملحق"], correctIndex: 0 },
  { id: "q2012", category: "عام", difficulty: "hard", question: "كم عدد الدول الأعضاء في الأمم المتحدة تقريباً؟", options: ["173", "193", "203", "183"], correctIndex: 1 },
  { id: "q2013", category: "عام", difficulty: "easy", question: "ما هو المعدن المستخدم في صناعة مجوهرات الألماس؟", options: ["الفضة", "الذهب الأبيض", "النحاس", "الحديد"], correctIndex: 1 },
  { id: "q2014", category: "عام", difficulty: "medium", question: "ما هي أكبر شركة تقنية بالقيمة السوقية حالياً؟", options: ["آبل", "أرامكو", "مايكروسوفت", "أمازون"], correctIndex: 0 },
  { id: "q2015", category: "عام", difficulty: "hard", question: "ما هو الحدث الذي عُرف بـ«سقوط برلين»؟", options: ["سقوط جدار برلين 1989", "حرب 1967", "الحرب العالمية", "تأسيس الأمم المتحدة"], correctIndex: 0 },

  // ── علوم ─────────────────────────────────────────────────────────────
  { id: "q2016", category: "علوم", difficulty: "easy", question: "ما هي وحدة قياس درجة الحرارة في النظام الدولي؟", options: ["الفهرنهايت", "الكلفن", "السلسيوس", "الرنكين"], correctIndex: 1 },
  { id: "q2017", category: "علوم", difficulty: "medium", question: "ما هو الغاز المستخدم في البالونات الطائرة؟", options: ["الأكسجين", "الهيليوم", "النيتروجين", "الهيدروجين"], correctIndex: 1 },
  { id: "q2018", category: "علوم", difficulty: "hard", question: "من اكتشف البنسلين؟", options: ["لويس باستور", "ألكسندر فليمنغ", "روبرت كوخ", "إدوارد جينر"], correctIndex: 1 },
  { id: "q2019", category: "علوم", difficulty: "medium", question: "ما هو الضوء المرئي للعين البشرية تقريباً؟", options: ["300-500 نانومتر", "380-750 نانومتر", "100-200 نانومتر", "800-1000 نانومتر"], correctIndex: 1 },
  { id: "q2020", category: "علوم", difficulty: "easy", question: "ما هو العنصر الأكثر وفرة في الكون؟", options: ["الأكسجين", "الهيليوم", "الهيدروجين", "الكربون"], correctIndex: 2 },
  { id: "q2021", category: "علوم", difficulty: "hard", question: "ما هي سرعة الضوء في الفراغ تقريباً؟", options: ["300,000 كم/ث", "150,000 كم/ث", "500,000 كم/ث", "1,000,000 كم/ث"], correctIndex: 0 },
  { id: "q2022", category: "علوم", difficulty: "medium", question: "ما هو العضو المسؤول عن إفراز الصفراء؟", options: ["البنكرياس", "الكبد", "المعدة", "الأمعاء"], correctIndex: 1 },
  { id: "q2023", category: "علوم", difficulty: "hard", question: "ما هو الفرق الأساسي بين المركب والعنصر؟", options: ["المركب يتكون من عنصرين أو أكثر", "العنصر أثقل", "المركب معدني", "لا فرق"], correctIndex: 0 },
  { id: "q2024", category: "علوم", difficulty: "medium", question: "ما هي الأداة التي تقيس ضغط الجو؟", options: ["الترمومتر", "البارومتر", "الأنمومتر", "الهيغرومتر"], correctIndex: 1 },
  { id: "q2025", category: "علوم", difficulty: "easy", question: "كم عدد الأسنان اللبنية عند الطفل؟", options: ["18", "20", "22", "24"], correctIndex: 1 },
  { id: "q2026", category: "علوم", difficulty: "hard", question: "ما هي الوحدة المستخدمة لقياس شدة الصوت؟", options: ["الهيرتز", "الديسيبل", "الواط", "الفولت"], correctIndex: 1 },
  { id: "q2027", category: "علوم", difficulty: "medium", question: "ما هو العنصر السائل عند درجة حرارة الغرفة عدا الزئبق؟", options: ["البروم", "الكلور", "اليود", "الفلور"], correctIndex: 0 },
  { id: "q2028", category: "علوم", difficulty: "medium", question: "ما اسم العملية التي تحوّل الماء من سائل إلى بخار؟", options: ["التكثيف", "التبخر", "التسامي", "التجمد"], correctIndex: 1 },
  { id: "q2029", category: "علوم", difficulty: "hard", question: "من هو العالم الفيزيائي الذي صاغ قانون الحركة الأول؟", options: ["أينشتاين", "نيوتن", "غاليليو", "أرخميدس"], correctIndex: 1 },

  // ── جغرافيا ──────────────────────────────────────────────────────────
  { id: "q2030", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة إيطاليا؟", options: ["ميلان", "روما", "نابولي", "فلورنسا"], correctIndex: 1 },
  { id: "q2031", category: "جغرافيا", difficulty: "hard", question: "ما هو أطول نهر في آسيا؟", options: ["النيل", "اليانغتسي", "الميكونغ", "الغانج"], correctIndex: 1 },
  { id: "q2032", category: "جغرافيا", difficulty: "easy", question: "في أي قارة تقع الصحراء الكبرى؟", options: ["آسيا", "أفريقيا", "أستراليا", "أمريكا"], correctIndex: 1 },
  { id: "q2033", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة إسبانيا؟", options: ["برشلونة", "مدريد", "إشبيلية", "بلنسية"], correctIndex: 1 },
  { id: "q2034", category: "جغرافيا", difficulty: "hard", question: "ما اسم أعلى قمة في أمريكا الشمالية؟", options: ["دينالي", "إيفرست", "كليمنجارو", "مونت بلان"], correctIndex: 0 },
  { id: "q2035", category: "جغرافيا", difficulty: "easy", question: "ما البحر الذي يفصل أوروبا عن أفريقيا؟", options: ["البحر الأحمر", "البحر المتوسط", "بحر الشمال", "البحر الأسود"], correctIndex: 1 },
  { id: "q2036", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة اليابان؟", options: ["أوساكا", "طوكيو", "كيوتو", "ناغويا"], correctIndex: 1 },
  { id: "q2037", category: "جغرافيا", difficulty: "hard", question: "ما هي أكبر دولة مساحةً في أفريقيا بعد الجزائر والسودان؟", options: ["الكونغو الديمقراطية", "ليبيا", "تشاد", "النيجر"], correctIndex: 0 },
  { id: "q2038", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة الأردن؟", options: ["عمّان", "الزرقاء", "إربد", "العقبة"], correctIndex: 0 },
  { id: "q2039", category: "جغرافيا", difficulty: "easy", question: "ما اسم أطول نهر في مصر؟", options: ["النيل", "الفرات", "دجلة", "الأردن"], correctIndex: 0 },
  { id: "q2040", category: "جغرافيا", difficulty: "medium", question: "كم عدد دول الخليج العربي؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q2041", category: "جغرافيا", difficulty: "hard", question: "ما هو أعمق نقطة في المحيطات؟", options: ["خندق ماريانا", "خندق تونغا", "خندق جاوة", "خندق بورتوريكو"], correctIndex: 0 },
  { id: "q2042", category: "جغرافيا", difficulty: "easy", question: "في أي دولة يقع برج خليفة؟", options: ["قطر", "الإمارات", "السعودية", "الكويت"], correctIndex: 1 },
  { id: "q2043", category: "جغرافيا", difficulty: "medium", question: "ما هي عاصمة السعودية؟", options: ["جدة", "الرياض", "الدمام", "مكة"], correctIndex: 1 },
  { id: "q2044", category: "جغرافيا", difficulty: "medium", question: "ما هي القارة التي لا توجد بها صحراء واسعة؟", options: ["أوروبا", "أفريقيا", "آسيا", "أستراليا"], correctIndex: 0 },

  // ── رياضيات ──────────────────────────────────────────────────────────
  { id: "q2045", category: "رياضيات", difficulty: "medium", question: "ما ناتج 25٪ من 80؟", options: ["15", "20", "25", "30"], correctIndex: 1 },
  { id: "q2046", category: "رياضيات", difficulty: "easy", question: "ما هو العدد الزوجي التالي بعد 8؟", options: ["9", "10", "11", "12"], correctIndex: 1 },
  { id: "q2047", category: "رياضيات", difficulty: "hard", question: "ما هو ناتج (3+5)×2؟", options: ["11", "16", "13", "22"], correctIndex: 1 },
  { id: "q2048", category: "رياضيات", difficulty: "medium", question: "كم ضلعاً في المثمّن؟", options: ["6", "7", "8", "9"], correctIndex: 2 },
  { id: "q2049", category: "رياضيات", difficulty: "hard", question: "ما هو معدل 15 و 20 و 25؟", options: ["18", "20", "22", "25"], correctIndex: 1 },
  { id: "q2050", category: "رياضيات", difficulty: "easy", question: "ما هو العدد الأولي بين 4 و 10؟", options: ["6", "7", "8", "9"], correctIndex: 1 },
  { id: "q2051", category: "رياضيات", difficulty: "medium", question: "ما ناتج 9×9؟", options: ["72", "81", "90", "99"], correctIndex: 1 },
  { id: "q2052", category: "رياضيات", difficulty: "hard", question: "ما هي زاوية القسمة بين عقربي الساعة عند 6:00؟", options: ["90 درجة", "120 درجة", "180 درجة", "270 درجة"], correctIndex: 2 },
  { id: "q2053", category: "رياضيات", difficulty: "easy", question: "ما هو مجموع 100 و 250؟", options: ["300", "350", "400", "450"], correctIndex: 1 },
  { id: "q2054", category: "رياضيات", difficulty: "medium", question: "ما هو الجذر التربيعي للعدد 81؟", options: ["7", "8", "9", "11"], correctIndex: 2 },
  { id: "q2055", category: "رياضيات", difficulty: "hard", question: "ما ناتج 2 أس 10؟", options: ["512", "1024", "2048", "256"], correctIndex: 1 },
  { id: "q2056", category: "رياضيات", difficulty: "medium", question: "كم ثانية في نصف ساعة؟", options: ["1200", "1800", "2400", "3000"], correctIndex: 1 },

  // ── لغة ──────────────────────────────────────────────────────────────
  { id: "q2057", category: "لغة", difficulty: "medium", question: "ما جمع كلمة «شمس»؟", options: ["شموس", "أشمس", "شمسات", "شمسون"], correctIndex: 0 },
  { id: "q2058", category: "لغة", difficulty: "hard", question: "ما مرادف كلمة «السهل» في الشعر؟", options: ["الميسور", "الجبل", "الوادي", "الصحراء"], correctIndex: 0 },
  { id: "q2059", category: "لغة", difficulty: "easy", question: "ما مضاد كلمة «الحاضر»؟", options: ["الغائب", "الماضي", "القادم", "القريب"], correctIndex: 0 },
  { id: "q2060", category: "لغة", difficulty: "medium", question: "ما نوع «ما» في «ما قرأتُ الكتاب»؟", options: ["اسم موصول", "حرف نفي", "اسم استفهام", "حرف جر"], correctIndex: 1 },
  { id: "q2061", category: "لغة", difficulty: "hard", question: "من شاعر «المتنبي» اللقب؟", options: ["أحمد بن الحسين", "أبو تمام", "البحتري", "جرير"], correctIndex: 0 },
  { id: "q2062", category: "لغة", difficulty: "easy", question: "ما جمع كلمة «رجل»؟", options: ["رجالات", "رجال", "أرجال", "رجول"], correctIndex: 1 },
  { id: "q2063", category: "لغة", difficulty: "medium", question: "ما مرادف كلمة «العظمة»؟", options: ["الهيبة", "الضعف", "الصغر", "الخوف"], correctIndex: 0 },
  { id: "q2064", category: "لغة", difficulty: "hard", question: "ما معنى «التمييز» في النحو؟", options: ["المصدر المبهم", "الفاعل", "المفعول", "الحال"], correctIndex: 0 },
  { id: "q2065", category: "لغة", difficulty: "medium", question: "ما هي الكلمة التي تُكتب خطأً شائعاً؟", options: ["إن شاء الله", "إلى الآ حين", "خطأ شائع", "كل ما سبق"], correctIndex: 3 },
  { id: "q2066", category: "لغة", difficulty: "easy", question: "ما مضاد كلمة «الوصول»؟", options: ["المغادرة", "القدوم", "الوصول", "الرحيل"], correctIndex: 0 },

  // ── منطق ─────────────────────────────────────────────────────────────
  { id: "q2067", category: "منطق", difficulty: "medium", question: "ما هو العدد التالي: 1، 4، 9، 16، __؟", options: ["20", "24", "25", "30"], correctIndex: 2 },
  { id: "q2068", category: "منطق", difficulty: "hard", question: "إذا كانت سارة أسرع من هدى، وهدى أسرع من نورة، فمن الأبطأ؟", options: ["سارة", "هدى", "نورة", "لا يُعرف"], correctIndex: 2 },
  { id: "q2069", category: "منطق", difficulty: "medium", question: "الكل يموت. سقراط إنسان. إذن:", options: ["سقراط يموت", "سقراط لا يموت", "قد يموت", "لا استنتاج"], correctIndex: 0 },
  { id: "q2070", category: "منطق", difficulty: "hard", question: "ما هو العدد الناقص: 2، 3، 5، 7، 11، __؟", options: ["13", "14", "15", "12"], correctIndex: 0 },
  { id: "q2071", category: "منطق", difficulty: "easy", question: "ما هو التالي: أ، ب، ت، __؟", options: ["ج", "ث", "خ", "د"], correctIndex: 0 },
  { id: "q2072", category: "منطق", difficulty: "medium", question: "إذا كان 5 عمال يبنون بيتاً في 10 أيام، فكم يلزم من عامل ليبنيه في 5 أيام (بنفس الكفاءة)؟", options: ["5", "10", "15", "20"], correctIndex: 1 },
  { id: "q2073", category: "منطق", difficulty: "hard", question: "أي بيان لا يتبع البقية: الكل مصريون، بعض المصريين عرب، كل العرب ساميون؟", options: ["الكل مصريون", "بعض المصريين عرب", "كل العرب ساميون", "الكل عرب"], correctIndex: 3 },
  { id: "q2074", category: "منطق", difficulty: "medium", question: "عمر الابن ثلث عمر الأب، والأب 45، فكم عمر الابن؟", options: ["12", "15", "18", "20"], correctIndex: 1 },

  // ── تاريخ ────────────────────────────────────────────────────────────
  { id: "q2075", category: "تاريخ", difficulty: "medium", question: "متى كانت الحرب العالمية الأولى؟", options: ["1914-1918", "1939-1945", "1905-1910", "1920-1925"], correctIndex: 0 },
  { id: "q2076", category: "تاريخ", difficulty: "hard", question: "من هو القائد المسلم الذي فتح الأندلس؟", options: ["طارق بن زياد", "موسى بن نصير", "عبد الرحمن الداخل", "حجاج بن يوسف"], correctIndex: 0 },
  { id: "q2077", category: "تاريخ", difficulty: "medium", question: "ما هي الدولة التي بنيت سور الصين العظيم؟", options: ["اليابان", "الصين", "كوريا", "منغوليا"], correctIndex: 1 },
  { id: "q2078", category: "تاريخ", difficulty: "easy", question: "من هو آخر أنبياء الإسلام؟", options: ["عيسى", "محمد ﷺ", "موسى", "إبراهيم"], correctIndex: 1 },
  { id: "q2079", category: "تاريخ", difficulty: "hard", question: "في أي سنة تأسست الأمم المتحدة؟", options: ["1919", "1945", "1950", "1960"], correctIndex: 1 },
  { id: "q2080", category: "تاريخ", difficulty: "medium", question: "من هو مؤسس علم الجبر؟", options: ["الخوارزمي", "ابن سينا", "البيروني", "ابن الهيثم"], correctIndex: 0 },
  { id: "q2081", category: "تاريخ", difficulty: "hard", question: "متى كانت معركة اليرموك؟", options: ["636م", "632م", "640م", "650م"], correctIndex: 0 },
  { id: "q2082", category: "تاريخ", difficulty: "medium", question: "من هو أول من دخل القمر؟", options: ["نيل أرمسترونغ", "باز ألدرين", "يوري غاغارين", "مايكل كولينز"], correctIndex: 0 },
  { id: "q2083", category: "تاريخ", difficulty: "easy", question: "ما هي الحضارة التي بنيت الأهرامات؟", options: ["الفراعنة", "الرومان", "اليونان", "البابليون"], correctIndex: 0 },
  { id: "q2084", category: "تاريخ", difficulty: "hard", question: "من هو الخليفة الذي جُمع فيه القرآن في مصحف واحد؟", options: ["أبو بكر", "عثمان بن عفان", "علي بن أبي طالب", "عمر بن الخطاب"], correctIndex: 1 },

  // ── رياضة ────────────────────────────────────────────────────────────
  { id: "q2085", category: "رياضة", difficulty: "easy", question: "كم مدة شوط كرة القدم الواحد؟", options: ["30 دقيقة", "45 دقيقة", "50 دقيقة", "60 دقيقة"], correctIndex: 1 },
  { id: "q2086", category: "رياضة", difficulty: "medium", question: "ما هي الرياضة التي يُلقّب فيها اللاعب بـ«الجولكر»؟", options: ["كرة القدم", "كرة السلة", "التنس", "الهوكي"], correctIndex: 0 },
  { id: "q2087", category: "رياضة", difficulty: "hard", question: "من هو أسطوره كرة السلة الأمريكية رقم 23؟", options: ["ماجيك جونسون", "مايكل جوردان", "كوبي براينت", "لبرون جيمس"], correctIndex: 1 },
  { id: "q2088", category: "رياضة", difficulty: "easy", question: "كم نقطة تُمنح للتسديدة الثلاثية في كرة السلة؟", options: ["2", "3", "4", "5"], correctIndex: 1 },
  { id: "q2089", category: "رياضة", difficulty: "medium", question: "كم لاعباً في فريق الهوكي داخل الملعب؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q2090", category: "رياضة", difficulty: "hard", question: "في أي بلد نشأت الرياضة الأولمبية الأصلية؟", options: ["روما", "اليونان", "مصر", "بلاد الرافدين"], correctIndex: 1 },
  { id: "q2091", category: "رياضة", difficulty: "medium", question: "ما هي المسافة القياسية لسباق الماراثون؟", options: ["30 كم", "42.195 كم", "50 كم", "21 كم"], correctIndex: 1 },
  { id: "q2092", category: "رياضة", difficulty: "easy", question: "كم عدد لاعبي فريق الكيرلنغ؟", options: ["2", "3", "4", "5"], correctIndex: 2 },

  // ── فنون ─────────────────────────────────────────────────────────────
  { id: "q2093", category: "فنون", difficulty: "medium", question: "من هو الرسام الإسباني الشهير لفنون الكوبيزم؟", options: ["بيكاسو", "دالي", "غويا", "فيليبي"], correctIndex: 0 },
  { id: "q2094", category: "فنون", difficulty: "hard", question: "ما هي الحركة الفنية التي تأثرت بالأحلام واللاشعور؟", options: ["السريالية", "التكعيبية", "الواقعية", "الانطباعية"], correctIndex: 0 },
  { id: "q2095", category: "فنون", difficulty: "easy", question: "ما هو الفن الأصيل في الخط العربي؟", options: ["الخطاطة", "النحت", "التصوير", "الرسم"], correctIndex: 0 },
  { id: "q2096", category: "فنون", difficulty: "medium", question: "من كتب «الأيام»؟", options: ["توفيق الحكيم", "طه حسين", "نجيب محفوظ", "عبقرة الكاتب"], correctIndex: 1 },
  { id: "q2097", category: "فنون", difficulty: "hard", question: "من هو الروائي المصري الحائز على نوبل؟", options: ["نجيب محفوظ", "توفيق الحكيم", "يوسف إدريس", "غسان كنفاني"], correctIndex: 0 },
  { id: "q2098", category: "فنون", difficulty: "easy", question: "ما هي الأداة الأساسية للنحات؟", options: ["الإزميل", "الفرشاة", "القلم الرصاص", "الكاميرا"], correctIndex: 0 },
  { id: "q2099", category: "فنون", difficulty: "medium", question: "من مؤلف «ألف ليلة وليلة» المشهورة عالمياً؟", options: ["مجهول الكاتب", "نزار قباني", "محمود درويش", "توفيق الحكيم"], correctIndex: 0 },

  // ── تكنولوجيا ────────────────────────────────────────────────────────
  { id: "q2100", category: "تكنولوجيا", difficulty: "easy", question: "ماذا تعني RAM؟", options: ["ذاكرة الوصول العشوائي", "قرص صلب", "معالج", "شاشة"], correctIndex: 0 },
  { id: "q2101", category: "تكنولوجيا", difficulty: "medium", question: "ما هي شركة أندرويد؟", options: ["آبل", "جوجل", "مايكروسوفت", "نوكيا"], correctIndex: 1 },
  { id: "q2102", category: "تكنولوجيا", difficulty: "hard", question: "من هو مؤسس آبل مع ستيف جوبز؟", options: ["ستيف وزنياك", "بيل جيتس", "إيلون ماسك", "جيف بيزوس"], correctIndex: 0 },
  { id: "q2103", category: "تكنولوجيا", difficulty: "easy", question: "ما هي لغة برمجة صفحات الويب الأساسية؟", options: ["HTML", "Python", "Java", "C++"], correctIndex: 0 },
  { id: "q2104", category: "تكنولوجيا", difficulty: "medium", question: "ما هي العملة الرقمية الأولى؟", options: ["بيتكوين", "إيثيريوم", "دجكوين", "لايتكوين"], correctIndex: 0 },
  { id: "q2105", category: "تكنولوجيا", difficulty: "hard", question: "ماذا يعني مصطلح «السحابة» (Cloud)؟", options: ["خوادم عبر الإنترنت", "برنامج ألعاب", "نظام تشغيل", "شبكة محلية"], correctIndex: 0 },
  { id: "q2106", category: "تكنولوجيا", difficulty: "medium", question: "ما هو البروتوكول المستخدم لإرسال البريد الإلكتروني؟", options: ["SMTP", "HTTP", "FTP", "TCP"], correctIndex: 0 },
  { id: "q2107", category: "تكنولوجيا", difficulty: "easy", question: "ما هي الوحدة الأساسية للمعلومات الرقمية؟", options: ["البايت", "البت", "الكيلوبايت", "الميجابايت"], correctIndex: 1 },
  { id: "q2108", category: "تكنولوجيا", difficulty: "hard", question: "من اخترع الطباعة الحديثة؟", options: ["غوتنبرغ", "إديسون", "بيل", "تسلا"], correctIndex: 0 },
  { id: "q2109", category: "تكنولوجيا", difficulty: "medium", question: "ما هو أقوى نوع كوابل الإنترنت؟", options: ["الألياف الضوئية", "النحاس", "اللاسلكي", "الستلايت"], correctIndex: 0 },

  // ── أفلام ومسلسلات ──────────────────────────────────────────────────
  { id: "q2110", category: "أفلام ومسلسلات", difficulty: "easy", question: "من بطل فيلم «روكي»؟", options: ["سيلفستر ستالوني", "أرنولد شوارزنيجر", "بروس ويليس", "توم كروز"], correctIndex: 0 },
  { id: "q2111", category: "أفلام ومسلسلات", difficulty: "medium", question: "ما اسم السفينة الشهيرة في فيلم «ستار تريك»؟", options: ["الإنتربرايز", "الميلينيوم فالكون", "الديستروير", "الأفلاغ"], correctIndex: 0 },
  { id: "q2112", category: "أفلام ومسلسلات", difficulty: "hard", question: "من مخرج ثلاثية «اللورد أوف ذا رينغز»؟", options: ["بيتر جاكسون", "جورج لوكاس", "ستيفن سبيلبرغ", "جيمس كاميرون"], correctIndex: 0 },
  { id: "q2113", category: "أفلام ومسلسلات", difficulty: "easy", question: "ما هو الفيلم الأعلى إيراداً في التاريخ؟", options: ["أفاتار", "أفينجرز", "تيتانك", "ستار وورز"], correctIndex: 0 },
  { id: "q2114", category: "أفلام ومسلسلات", difficulty: "medium", question: "من هو مخرج أفلام «الجوكر»؟", options: ["تود فيليبس", "كريستوفر نولان", "مارتن سكورسيزي", "كوينتين تارانتينو"], correctIndex: 0 },
  { id: "q2115", category: "أفلام ومسلسلات", difficulty: "hard", question: "ما هو أول فيلم ملون في التاريخ؟", options: ["بيكينغ أتلانتا", "الساحر أوز", "غون مع الويند", "سبارتاكوس"], correctIndex: 0 },
  { id: "q2116", category: "أفلام ومسلسلات", difficulty: "easy", question: "من بطل فيلم «تيرمينيتور»؟", options: ["أرنولد شوارزنيجر", "سيلفستر ستالوني", "بروس ويليس", "جيت لي"], correctIndex: 0 },

  // ── طعام ومشروبات ───────────────────────────────────────────────────
  { id: "q2117", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي البلد الأصل للكيب؟", options: ["اليمن", "البرازيل", "كولومبيا", "إثيوبيا"], correctIndex: 3 },
  { id: "q2118", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو الطبق الهندي الحار الشهير؟", options: ["الكاري", "البيتزا", "البرياني", "السوشي"], correctIndex: 0 },
  { id: "q2119", category: "طعام ومشروبات", difficulty: "hard", question: "ما هو أغلى توابل في العالم؟", options: ["الزعفران", "الهيل", "الفانيلا", "القرفة"], correctIndex: 0 },
  { id: "q2120", category: "طعام ومشروبات", difficulty: "easy", question: "ما هي الفاكهة الوطنية للبرازيل؟", options: ["المانجو", "الأفوكادو", "البرتقال", "الأناناس"], correctIndex: 2 },
  { id: "q2121", category: "طعام ومشروبات", difficulty: "medium", question: "من أي نبات يُستخرج الشاي الأخضر؟", options: ["نبات الشاي", "الأعشاب", "الأزهار", "الفواكه"], correctIndex: 0 },
  { id: "q2122", category: "طعام ومشروبات", difficulty: "easy", question: "ما هو الحلوى الشهيرة في تركيا؟", options: ["البقلاوة", "الكنافة", "الأم علي", "كلها صحيحة"], correctIndex: 3 },
  { id: "q2123", category: "طعام ومشروبات", difficulty: "medium", question: "ما هو المكون الأساسي في الغواكامولي؟", options: ["الأفوكادو", "الطماطم", "البصل", "الليمون"], correctIndex: 0 },

  // ── حيوانات ──────────────────────────────────────────────────────────
  { id: "q2124", category: "حيوانات", difficulty: "easy", question: "ما هو أكبر حيوان بري؟", options: ["الفيل الأفريقي", "الزرافة", "النهر", "الدب"], correctIndex: 0 },
  { id: "q2125", category: "حيوانات", difficulty: "medium", question: "كم قلباً للحصان؟", options: ["1", "2", "3", "4"], correctIndex: 0 },
  { id: "q2126", category: "حيوانات", difficulty: "hard", question: "ما هو الحيوان الذي يفرز السم عبر أسنانه أمامية؟", options: ["الثعبان", "العقرب", "العنكبوت", "القناديل"], correctIndex: 0 },
  { id: "q2127", category: "حيوانات", difficulty: "easy", question: "ما هو الحيوان الوطني لأستراليا؟", options: ["الكنغر", "الكوالا", "الإميو", "الدينغو"], correctIndex: 0 },
  { id: "q2128", category: "حيوانات", difficulty: "medium", question: "كم ساعة ينام القطة يومياً؟", options: ["6 ساعات", "10 ساعات", "12-16 ساعة", "20 ساعة"], correctIndex: 2 },
  { id: "q2129", category: "حيوانات", difficulty: "hard", question: "ما هو الحيوان الذي يعيش في القطب الشمالي وله فرو أبيض؟", options: ["الدب القطبي", "الثعلب", "الرنة", "الحوت"], correctIndex: 0 },
  { id: "q2130", category: "حيوانات", difficulty: "easy", question: "ما هي أكبر قطة في العالم؟", options: ["النمر", "الأسد", "النمور (التايغر)", "الفهد"], correctIndex: 2 },

  // ── فضاء ─────────────────────────────────────────────────────────────
  { id: "q2131", category: "فضاء", difficulty: "medium", question: "ما هو الكوكب الذي يُلقب بـ«الكوكب الحلقي»؟", options: ["زحل", "المشتري", "أورانوس", "نبتون"], correctIndex: 0 },
  { id: "q2132", category: "فضاء", difficulty: "hard", question: "كم يبعد الشمس عن الأرض تقريباً؟", options: ["150 مليون كم", "500 مليون كم", "10 مليون كم", "مليار كم"], correctIndex: 0 },
  { id: "q2133", category: "فضاء", difficulty: "easy", question: "ما هو الكوكب الأزرق؟", options: ["الأرض", "المريخ", "الزهرة", "نبتون"], correctIndex: 0 },
  { id: "q2134", category: "فضاء", difficulty: "medium", question: "ما هي الجاذبية على القمر مقارنة بالأرض؟", options: ["نصفها", "سدسها", "ثلثها", "ربعها"], correctIndex: 1 },
  { id: "q2135", category: "فضاء", difficulty: "hard", question: "ما هو اسم المسبار الذي خرج من المجموعة الشمسية؟", options: ["فوياجر 1", "أبولو 11", "هابل", "كيبلر"], correctIndex: 0 },
  { id: "q2136", category: "فضاء", difficulty: "easy", question: "كم قمراً للأرض؟", options: ["1", "2", "3", "4"], correctIndex: 0 },
  { id: "q2137", category: "فضاء", difficulty: "medium", question: "من هو أول رائد فضاء عربي؟", options: ["الأمير سلطان بن سلمان", "حازم النضال", "محمد الفارس", "طارق الحسن"], correctIndex: 0 },

  // ── موسيقى ───────────────────────────────────────────────────────────
  { id: "q2138", category: "موسيقى", difficulty: "easy", question: "ما هو الآلة ذات الأوتار الأشهر في الموسيقى العربية؟", options: ["العود", "البيانو", "الكمان", "الناي"], correctIndex: 0 },
  { id: "q2139", category: "موسيقى", difficulty: "medium", question: "من لُقّب بـ«بيرد» في موسيقى الجاز؟", options: ["تشارلي باركر", "لويس أرمسترونغ", "ديزي غيليسبي", "جون كولترين"], correctIndex: 0 },
  { id: "q2140", category: "موسيقى", difficulty: "hard", question: "كم زر في الفلوت القياسي؟", options: ["13", "16", "19", "22"], correctIndex: 1 },
  { id: "q2141", category: "موسيقى", difficulty: "easy", question: "من هي المطربة اللبنانية الأسطورية؟", options: ["فيروز", "أم كلثوم", "أسمهان", "وردة"], correctIndex: 0 },
  { id: "q2142", category: "موسيقى", difficulty: "medium", question: "ما هو الأسلوب الموسيقي المنشأ في أمريكا؟", options: ["الجاز", "الأوبرا", "السيمفونية", "الفلكلور"], correctIndex: 0 },
  { id: "q2143", category: "موسيقى", difficulty: "hard", question: "كم نغمة في السلم الموسيقي الغربي؟", options: ["5", "7", "12", "15"], correctIndex: 2 },

  // ── دين وثقافة ──────────────────────────────────────────────────────
  { id: "q2144", category: "دين وثقافة", difficulty: "easy", question: "كم عدد الصلوات اليومية؟", options: ["3", "4", "5", "6"], correctIndex: 2 },
  { id: "q2145", category: "دين وثقافة", difficulty: "medium", question: "ما هي أول سورة في القرآن؟", options: ["الفاتحة", "البقرة", "العلق", "الناس"], correctIndex: 0 },
  { id: "q2146", category: "دين وثقافة", difficulty: "hard", question: "ما هي السورة التي تُسمى «قلب القرآن»؟", options: ["يس", "الرحمن", "الكهف", "الملك"], correctIndex: 0 },
  { id: "q2147", category: "دين وثقافة", difficulty: "easy", question: "ما هو الشهر الذي يأتي بعد رمضان؟", options: ["شوال", "رجب", "ذو الحجة", "محرم"], correctIndex: 0 },
  { id: "q2148", category: "دين وثقافة", difficulty: "medium", question: "كم عدد أركان الإيمان؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q2149", category: "دين وثقافة", difficulty: "hard", question: "ما اسم الحج الذي يجمع بين الحج والعمرة؟", options: ["التمتع", "الإفراد", "القِران", "العمرة"], correctIndex: 2 },
  { id: "q2150", category: "دين وثقافة", difficulty: "easy", question: "ما هو اليوم الذي يوافق يوم عرفة؟", options: ["9 ذي الحجة", "10 محرم", "12 ربيع", "27 رجب"], correctIndex: 0 },

  // ── جسم الإنسان ─────────────────────────────────────────────────────
  { id: "q2151", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو الذي ينقي الدم؟", options: ["الكلية", "القلب", "الرئة", "الكبد"], correctIndex: 0 },
  { id: "q2152", category: "جسم الإنسان", difficulty: "medium", question: "كم عظمة في جسم الإنسان البالغ؟", options: ["206", "180", "250", "300"], correctIndex: 0 },
  { id: "q2153", category: "جسم الإنسان", difficulty: "hard", question: "ما هو الجزء المسؤول عن الرؤية في الدماغ؟", options: ["الفص القذالي", "الفص الجبهي", "الفص الصدغي", "الفص الجداري"], correctIndex: 0 },
  { id: "q2154", category: "جسم الإنسان", difficulty: "easy", question: "ما هو العضو الذي ينتج البول؟", options: ["الكلية", "المثانة", "الكبد", "البنكرياس"], correctIndex: 0 },
  { id: "q2155", category: "جسم الإنسان", difficulty: "medium", question: "كم دقيقة يحتاج الدم للدورة الكاملة في الجسم؟", options: ["دقيقة واحدة", "5 دقائق", "10 دقائق", "30 دقيقة"], correctIndex: 0 },
  { id: "q2156", category: "جسم الإنسان", difficulty: "hard", question: "ما هو الهرمون المسؤول عن النوم؟", options: ["الميلاتونين", "الأدرينالين", "الإنسولين", "الكورتيزول"], correctIndex: 0 },
  { id: "q2157", category: "جسم الإنسان", difficulty: "easy", question: "كم حاسة أساسية عند الإنسان؟", options: ["3", "4", "5", "6"], correctIndex: 2 },

  // ── منوعات ───────────────────────────────────────────────────────────
  { id: "q2158", category: "منوعات", difficulty: "easy", question: "ما هو الرمز العالمي للطب؟", options: ["العصا والأفعى", "الصليب", "النجمة", "الهلال"], correctIndex: 0 },
  { id: "q2159", category: "منوعات", difficulty: "medium", question: "ما هي أصغر وحدة في المجتمع؟", options: ["الأسرة", "القبيلة", "المدينة", "الدولة"], correctIndex: 0 },
  { id: "q2160", category: "منوعات", difficulty: "hard", question: "كم لغة رسمية في الأمم المتحدة؟", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { id: "q2161", category: "منوعات", difficulty: "easy", question: "ما هو اللون التقليدي للعرسان في الغرب؟", options: ["الأبيض", "الأحمر", "الأزرق", "الأسود"], correctIndex: 0 },
  { id: "q2162", category: "منوعات", difficulty: "medium", question: "كم مدة الحمل عند الإنسان؟", options: ["7 أشهر", "9 أشهر", "10 أشهر", "12 شهراً"], correctIndex: 1 },
  { id: "q2163", category: "منوعات", difficulty: "easy", question: "ما هو الحيوان الذي يمثل رمز السلام؟", options: ["الحمامة", "النسر", "الأسد", "الغزال"], correctIndex: 0 },

  // ── ألغاز وأحاجي ────────────────────────────────────────────────────
  { id: "q2164", category: "ألغاز وأحاجي", difficulty: "medium", question: "شيء يوجد في وسط باريس لكن ليس في لندن؟", options: ["حرف الراء", "النهر", "البرج", "الجسر"], correctIndex: 0 },
  { id: "q2165", category: "ألغاز وأحاجي", difficulty: "hard", question: "يمشي بلا أرجل ويطير بلا أجنحة ويبكي بلا عيون، ما هو؟", options: ["السحاب", "الريح", "الساعة", "النهر"], correctIndex: 0 },
  { id: "q2166", category: "ألغاز وأحاجي", difficulty: "medium", question: "له أسنان ولا يعض؟", options: ["المشط", "المنشار", "السلسال", "الفرشاة"], correctIndex: 0 },
  { id: "q2167", category: "ألغاز وأحاجي", difficulty: "easy", question: "شيء يُقتل ولا يُدفن؟", options: ["العطش", "الظمأ", "الجوع", "الخوف"], correctIndex: 0 },
  { id: "q2168", category: "ألغاز وأحاجي", difficulty: "hard", question: "كلما زاد نقص، وكلما نقص زاد؟", options: ["الفراغ", "الحفرة", "المال", "العلم"], correctIndex: 0 },

  // ── ملاحظة ودقة ─────────────────────────────────────────────────────
  { id: "q2169", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة مختلفة: صيف، شتاء، ربيع، مطر؟", options: ["صيف", "شتاء", "ربيع", "مطر"], correctIndex: 3 },
  { id: "q2170", category: "ملاحظة ودقة", difficulty: "hard", question: "أي رقم يختلف: 121، 144، 169، 180؟", options: ["121", "144", "169", "180"], correctIndex: 3 },
  { id: "q2171", category: "ملاحظة ودقة", difficulty: "medium", question: "أي عنصر مختلف: الذهب، الفضة، النحاس، الماء؟", options: ["الذهب", "الفضة", "النحاس", "الماء"], correctIndex: 3 },
  { id: "q2172", category: "ملاحظة ودقة", difficulty: "easy", question: "أي شيء مختلف: تفاحة، موزة، برتقالة، سيف؟", options: ["تفاحة", "موزة", "برتقالة", "سيف"], correctIndex: 3 },
  { id: "q2173", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة مختلفة: قلب، كبد، رئة، حجر؟", options: ["قلب", "كبد", "رئة", "حجر"], correctIndex: 3 },
  { id: "q2174", category: "ملاحظة ودقة", difficulty: "hard", question: "أي رقم لا ينتمي: 2، 4، 8، 12، 16؟", options: ["2", "4", "12", "16"], correctIndex: 2 },
  { id: "q2175", category: "ملاحظة ودقة", difficulty: "medium", question: "أي كلمة مختلفة: كتاب، دفتر، مجلة، سيارة؟", options: ["كتاب", "دفتر", "مجلة", "سيارة"], correctIndex: 3 },
];
