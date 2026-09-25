import type { Question } from "./questions";

/** Questions q3001–q3040: two questions at each of the four difficulty tiers in five core categories. */
export const MEGA_PACK_7: Question[] = [
  // ── عام ────────────────────────────────────────────────────────────────
  { id: "q3001", category: "عام", difficulty: "easy", question: "ما أكبر صحراء في العالم من حيث المساحة؟", options: ["الربع الخالي", "الصحراء الكبرى", "أنتاركتيكا", "أتاكاما"], correctIndex: 2 },
  { id: "q3002", category: "عام", difficulty: "easy", question: "كم عدد قارات العالم؟", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { id: "q3003", category: "عام", difficulty: "medium", question: "أي دولة استضافت أول كأس عالم لكرة القدم؟", options: ["البرازيل", "أوروغواي", "فرنسا", "إيطاليا"], correctIndex: 1 },
  { id: "q3004", category: "عام", difficulty: "medium", question: "ما سطح ملعب بطولة ويمبلد؟", options: ["العشب", "الإسمنت", "الرمل", "الخشب"], correctIndex: 0 },
  { id: "q3005", category: "عام", difficulty: "hard", question: "أي دولة تملك أطول سواحل بحرية إجمالاً؟", options: ["كندا", "النرويج", "الولايات المتحدة", "روسيا"], correctIndex: 0 },
  { id: "q3006", category: "عام", difficulty: "hard", question: "ما الرمز الدولي المكوّن من حرفين لدولة اليونان؟", options: ["GR", "LB", "LE", "LY"], correctIndex: 0 },
  { id: "q3007", category: "عام", difficulty: "extreme", question: "أي دولة تملك أكبر عدد من المناطق الزمنية إذا احتُسبت مستعمراتها؟", options: ["الولايات المتحدة", "فرنسا", "روسيا", "الصين"], correctIndex: 1 },
  { id: "q3008", category: "عام", difficulty: "extreme", question: "ما الدولة الجزرية التي تقع على خط التوقيت UTC+14؟", options: ["كيريتياتي", "توفالو", "ساموا", "فيجي"], correctIndex: 0 },

  // ── علوم ───────────────────────────────────────────────────────────────
  { id: "q3009", category: "علوم", difficulty: "easy", question: "ما الرمز الكيميائي للنحاس؟", options: ["Cu", "Co", "Ca", "Cd"], correctIndex: 0 },
  { id: "q3010", category: "علوم", difficulty: "easy", question: "ما قيمة pH للماء النقي في الظروف المعتدلة؟", options: ["0", "7", "10", "14"], correctIndex: 1 },
  { id: "q3011", category: "علوم", difficulty: "medium", question: "ما الجزيء الذي ينقل الطاقة الفورية في الخلايا عادةً؟", options: ["DNA", "ATP", "RNA", "إنزيم"], correctIndex: 1 },
  { id: "q3012", category: "علوم", difficulty: "medium", question: "ما الصبغة التي تلتقط الضوء أثناء التمثيل الضوئي؟", options: ["الكلوروفيل", "الهيموغلوبين", "الكاروتين", "الميلانين"], correctIndex: 0 },
  { id: "q3013", category: "علوم", difficulty: "hard", question: "ما الشحنة الكهربائية للنيوترون؟", options: ["موجبة", "سالبة", "محايدة", "تتغير حسب العنصر"], correctIndex: 2 },
  { id: "q3014", category: "علوم", difficulty: "hard", question: "ما الذي تفعله الإنزيمات في التفاعلات الحيوية؟", options: ["ترفع طاقة التنشيط", "تخفض طاقة التنشيط", "تمنع كل التفاعلات", "تضاعف حرارة الخلية"], correctIndex: 1 },
  { id: "q3015", category: "علوم", difficulty: "extreme", question: "ما الذي تقيسه ثابتة هابل في علم الكونيات؟", options: ["كتلة المجرات", "معدل اتساع الكون", "عمر النجوم", "شدة الحقل المغناطيسي"], correctIndex: 1 },
  { id: "q3016", category: "علوم", difficulty: "extreme", question: "ما الآلية الطبيعية التي استمد منها تقنيات CRISPR؟", options: ["دفاع البكتيريا ضد الفيروسات", "انقسام الخلية", "التخمر", "التبخر"], correctIndex: 0 },

  // ── جغرافيا ─────────────────────────────────────────────────────────────
  { id: "q3017", category: "جغرافيا", difficulty: "easy", question: "ما عاصمة النرويج؟", options: ["بيرغن", "أوسلو", "ستوكهولم", "هلسنكي"], correctIndex: 1 },
  { id: "q3018", category: "جغرافيا", difficulty: "easy", question: "أي دولة تحيط بها جنوب أفريقيا من جميع الجهات؟", options: ["ليسوتو", "إسواتيني", "ناميبيا", "بوتسوانا"], correctIndex: 0 },
  { id: "q3019", category: "جغرافيا", difficulty: "medium", question: "ما أعمق بحيرة في العالم؟", options: ["بايكال", "فيكتوريا", "سوبيريور", "تنجانيقا"], correctIndex: 0 },
  { id: "q3020", category: "جغرافيا", difficulty: "medium", question: "في أي دولة تقع غابة الأمازون الأساسية؟", options: ["البرازيل", "الأرجنتين", "بيرو", "كولومبيا"], correctIndex: 0 },
  { id: "q3021", category: "جغرافيا", difficulty: "hard", question: "يفصل مضيق جبل طارق بين أي دولتين؟", options: ["المغرب وإسبانيا", "تونس وإيطاليا", "مصر والسعودية", "اليونان وتركيا"], correctIndex: 0 },
  { id: "q3022", category: "جغرافيا", difficulty: "hard", question: "ما أطول سلسلة جبال متصلة في العالم؟", options: ["الهيمالايا", "الروكي", "الأنديز", "الألب"], correctIndex: 2 },
  { id: "q3023", category: "جغرافيا", difficulty: "extreme", question: "ما أكبر بحيرة في العالم من حيث المساحة إذا عُدّت البحيرات الداخلية؟", options: ["سوبيريور", "بايكال", "قزوين", "تنجانيقا"], correctIndex: 2 },
  { id: "q3024", category: "جغرافيا", difficulty: "extreme", question: "بحيرة تيتيكاا تمتد أساساً بين أي دولتين؟", options: ["بيرو وبوليفيا", "الأرجنتين وشيلي", "إثيوبيا وإريتريا", "مصر والسودان"], correctIndex: 0 },

  // ── رياضيات ────────────────────────────────────────────────────────────
  { id: "q3025", category: "رياضيات", difficulty: "easy", question: "كم يساوي 9 × 9؟", options: ["72", "81", "90", "99"], correctIndex: 1 },
  { id: "q3026", category: "رياضيات", difficulty: "easy", question: "كم نسبة ثلاثة أرباع العدد 100؟", options: ["25%", "50%", "75%", "80%"], correctIndex: 2 },
  { id: "q3027", category: "رياضيات", difficulty: "medium", question: "ما المضاعف المشترك الأصغر للعددين 4 و6؟", options: ["10", "12", "18", "24"], correctIndex: 1 },
  { id: "q3028", category: "رياضيات", difficulty: "medium", question: "كم يساوي 2¹⁰؟", options: ["512", "768", "1024", "2048"], correctIndex: 2 },
  { id: "q3029", category: "رياضيات", difficulty: "hard", question: "كم يساوي 8!؟", options: ["40320", "4032", "403200", "362880"], correctIndex: 0 },
  { id: "q3030", category: "رياضيات", difficulty: "hard", question: "كم عدد القواسم الموجبة للعدد 36؟", options: ["6", "8", "9", "12"], correctIndex: 2 },
  { id: "q3031", category: "رياضيات", difficulty: "extreme", question: "كم قيمة دالة أويلر φ(12)؟", options: ["2", "4", "6", "8"], correctIndex: 1 },
  { id: "q3032", category: "رياضيات", difficulty: "extreme", question: "ما آخر ثلاثة أرقام من 7¹⁰⁰؟", options: ["001", "343", "721", "000"], correctIndex: 0 },

  // ── لغة ────────────────────────────────────────────────────────────────
  { id: "q3033", category: "لغة", difficulty: "easy", question: "ما جمع كلمة مسافر؟", options: ["مسافرين", "مسافرات", "سافرين", "مسافرون فقط"], correctIndex: 0 },
  { id: "q3034", category: "لغة", difficulty: "easy", question: "ما ضد كلمة شجاع؟", options: ["كريم", "جبان", "قوي", "مؤدب"], correctIndex: 1 },
  { id: "q3035", category: "لغة", difficulty: "medium", question: "ما إعراب كلمة مسافر في جملة: جاء مسافر؟", options: ["فاعل مرفوع", "مفعول به منصوب", "خبر مرفوع", "حال منصوب"], correctIndex: 0 },
  { id: "q3036", category: "لغة", difficulty: "medium", question: "ما نوع الأسلوب في: لن أهدر وقتك؟", options: ["تأكيد", "نفي", "استفهام", "نداء"], correctIndex: 1 },
  { id: "q3037", category: "لغة", difficulty: "hard", question: "ما نوع الهمزة في كلمة استخرج؟", options: ["قطع", "وصل", "متطرفة", "متوسطة"], correctIndex: 1 },
  { id: "q3038", category: "لغة", difficulty: "hard", question: "ما إعراب كلمة العلم في جملة: العلم نور؟", options: ["مبتدأ", "خبر", "فاعل", "جار مجرور"], correctIndex: 0 },
  { id: "q3039", category: "لغة", difficulty: "extreme", question: "ما إعراب كلمة يحيي في: حي النبي صلى الله عليه وسلم؟", options: ["اسم فاعل", "فعل ماض مبني على الفتح", "فعل مضارع", "فعل أمر"], correctIndex: 1 },
  { id: "q3040", category: "لغة", difficulty: "extreme", question: "ما نوع لا في: لا تحزن؟", options: ["نافية للجملة", "ناهية", "جواب نفي", "زائدة"], correctIndex: 1 },
];
