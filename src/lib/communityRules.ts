/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚖️ قوانين المجتمع الثلاثون — مصدر واحد نقي (قابل للاختبار)
 * ═══════════════════════════════════════════════════════════════════════
 * يستخدمها: نظام إنفاذ القوانين (Convex)، صفحة القوانين، فحص الرسائل الآلي،
 * واختبارات الوحدة. أي تغيير هنا ينعكس على كل الأنظمة دفعة واحدة.
 */

export type RuleCategory = "essential" | "prohibited" | "punishment";
export type RuleSeverity = "low" | "medium" | "high";

export interface CommunityRule {
  id: number;
  title: string;
  desc: string;
  category: RuleCategory;
  severity: RuleSeverity;
}

export const COMMUNITY_RULES: CommunityRule[] = [
  { id: 1, title: "منع السبام", desc: "يُمنع إرسال رسائل متكررة أو مزعجة بشكل ممنهج.", category: "essential", severity: "medium" },
  { id: 2, title: "منع الإساءة", desc: "يُمنع التنمر أو الإساءة اللفظية أو التحرش بأي شكل.", category: "prohibited", severity: "high" },
  { id: 3, title: "منع الروابط المشبوهة", desc: "يُمنع مشاركة روابط احتيالية أو محتوى مشبوه.", category: "prohibited", severity: "high" },
  { id: 4, title: "منع انتحال الهوية", desc: "يُمنع انتحال هوية لاعب آخر أو الإدارة.", category: "prohibited", severity: "high" },
  { id: 5, title: "منع الغش", desc: "يُمنع الغش أو استغلال ثغرات اللعبة.", category: "prohibited", severity: "high" },
  { id: 6, title: "منع المحتوى المثير للجدل", desc: "يُمنع نشر محتوى سياسي أو ديني مثير للجدل.", category: "essential", severity: "medium" },
  { id: 7, title: "منع المحتوى غير اللائق", desc: "يُمنع نشر محتوى إباحي أو غير لائق.", category: "prohibited", severity: "high" },
  { id: 8, title: "منع التحريض", desc: "يُمنع التحريض على العنف أو الكراهية.", category: "prohibited", severity: "high" },
  { id: 9, title: "منع الإزعاج المتكرر", desc: "يُمنع إزعاج لاعب آخر بشكل متكرر بعد طلب التوقف.", category: "prohibited", severity: "medium" },
  { id: 10, title: "منع الحسابات المتعددة", desc: "يُمنع استخدام أكثر من حساب لتجاوز الأنظمة.", category: "prohibited", severity: "high" },
  { id: 11, title: "منع بيع/شراء الحسابات", desc: "يُمنع بيع أو شراء الحسابات أو العناصر بشكل غير قانوني.", category: "prohibited", severity: "high" },
  { id: 12, title: "حماية الخصوصية", desc: "يُمنع مشاركة معلومات شخصية للآخرين بدون إذنهم.", category: "essential", severity: "high" },
  { id: 13, title: "منع التلاعب بالنتائج", desc: "يُمنع التلاعب بنتائج التحديات أو الترتيب.", category: "prohibited", severity: "high" },
  { id: 14, title: "منع الغرف الخبيثة", desc: "يُمنع إنشاء غرف بهدف النشاط الخبيث أو الإزعاج المنظم.", category: "prohibited", severity: "high" },
  { id: 15, title: "احترام القرارات", desc: "يُمنع تجاهل قرارات المشرفين أو الإدارة بشكل متكرر.", category: "essential", severity: "medium" },
  { id: 16, title: "منع البرامج غير المصرح بها", desc: "يُمنع استخدام برامج أو أدوات غير مصرح بها تؤثر على اللعب.", category: "prohibited", severity: "high" },
  { id: 17, title: "منع كراهية المجموعات", desc: "يُمنع نشر محتوى يحرض على الكراهية ضد أي مجموعة.", category: "prohibited", severity: "high" },
  { id: 18, title: "منع إساءة البلاغات", desc: "يُمنع استغلال نظام البلاغات بشكل خبيث أو متكرر دون مبرر.", category: "essential", severity: "medium" },
  { id: 19, title: "منع الرسائل الجماعية", desc: "يُمنع إرسال رسائل مزعجة أو ترويجية بالجملة بدون إذن.", category: "essential", severity: "medium" },
  { id: 20, title: "حماية المجتمع", desc: "يُمنع أي سلوك يضر بتجربة اللاعبين أو استقرار المجتمع.", category: "essential", severity: "high" },
  { id: 21, title: "منع التهكم على المبتدئين", desc: "يُمنع التهكم أو السخرية من اللاعبين الجدد أو محدودي الخبرة، وواجب الأعضاء مساعدتهم بلطف.", category: "essential", severity: "low" },
  { id: 22, title: "منع الرسائل الخاصة المزعجة", desc: "يُمنع إرسال رسائل خاصة متكررة لأي لاعب لا تربطك به صداقة أو موافقة مسبقة.", category: "prohibited", severity: "medium" },
  { id: 23, title: "حماية القاصرين", desc: "يُمنع طلب معلومات شخصية من القاصرين أو ممارسة أي تواصل غير لائق معهم.", category: "prohibited", severity: "high" },
  { id: 24, title: "منع نشر الشائعات", desc: "يُمنع نشر أخبار كاذبة أو شائعات عن اللعبة أو اللاعبين أو الإدارة بقصد الإضرار.", category: "prohibited", severity: "medium" },
  { id: 25, title: "منع الإعلان عن منافسين", desc: "يُمنع الإعلان عن مواقع أو تطبيقات أو منصات منافسة داخل أي غرفة أو رسالة.", category: "prohibited", severity: "medium" },
  { id: 26, title: "منع النشر المتقاطع", desc: "يُمنع إرسال نفس الرسالة في أكثر من غرفة أو قناة بشكل متعمد (Cross-posting).", category: "essential", severity: "medium" },
  { id: 27, title: "منع المحتوى المؤلم الصريح", desc: "يُمنع مشاركة صور أو مقاطع عنيفة أو مؤلمة أو مزعجة خارج سياق تعليمي واضح.", category: "prohibited", severity: "high" },
  { id: 28, title: "منع النصب والاحتيال التجاري", desc: "يُمنع عرض بيع وهمي أو النصب في أي معاملة داخل المتجر أو الهدايا أو الترقيات.", category: "prohibited", severity: "high" },
  { id: 29, title: "منع الأسماء المسيئة", desc: "يُمنع اختيار أسماء أو شعارات مسيئة أو مخالفة للقوانين في الحسابات والغرف.", category: "essential", severity: "medium" },
  { id: 30, title: "الالتزام بالتحديثات", desc: "قوانين المجتمع قابلة للتحديث، وتُعلن التعديلات رسمياً وتُلزم جميع اللاعبين فور نشرها.", category: "punishment", severity: "low" },
];

export const RULE_CATEGORY_LABEL: Record<RuleCategory, string> = {
  essential: "قوانين أساسية",
  prohibited: "ممنوعات صريحة",
  punishment: "سلم العقوبات",
};

export const RULE_SEVERITY_LABEL: Record<RuleSeverity, string> = {
  low: "بسيطة",
  medium: "متوسطة",
  high: "خطيرة",
};

export function ruleById(id: number): CommunityRule | undefined {
  return COMMUNITY_RULES.find((r) => r.id === id);
}

// ═══════════════════════════════════════════════════════════════════════
// الماسح الآلي — كلمات/أنماط للمخالفات القابلة للرصد الفوري
// ═══════════════════════════════════════════════════════════════════════

export interface ScanMatch {
  ruleId: number;
  evidence: string; // أول كلمة/نمط مطابق وجد
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "") // تشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** أنماط قابلة للرصد الآلي — كلمات حادة لا لبس فيها لتقليل الأخطاء. */
export const AUTO_PATTERNS: Record<number, string[]> = {
  1: ["سبام", "spam", "رسائل مكرره", "رسايل مكرره", "نشر مكرر"],
  2: ["اخرس", "اغبي", "غبيه", "حقير", "حقيره", "كلب", "حمار", "تافه", "انسلخ", "عقيم", "قذر", "سخيف", "تخلف", "متخلف", "تافهه", "خنزير", "قرد", "مقرف", "تبا", "اللعنه", "اذهب للجحيم"],
  3: ["http://", "https://", "www.", "رابط", "لينك", "دخول حسابك", "اشترك من هنا", "اربح جوائز من هنا"],
  4: ["انا الادمن", "انا المالك", "انا المشرف", "بصفتي ادمن", "انا مدير اللعبه", "انتحلت شخصيتي"],
  7: ["صوره جريئه", "مقطع جريء", "افلام كبار", "للكبار فقط", "nsfw", "اباحي", "اباحيه"],
  8: ["اذبحه", "اضربه", "اكسر وجهه", "سنقتل", "سنذبح", "احب القتل", "دعونا نقتل", "اقتل نفسك"],
  9: ["توقف عن مضايقتي", "اتعرض للمضايقه", "يضايقني باستمرار", "يرسل لي رسائل رغم رفضي"],
  12: ["رقم هاتفي", "عنوان منزلي", "صورتي الشخصيه", "بياناتي الخاصه", "كلمه السر", "كلمة المرور", "بطاقتي"],
  17: ["اقصوا", "ارحلوا من البلد", "حرقهم", "مجموعه حقيره", "الشعوب العربيه حقيره", "كل الاجانب"],
  19: ["انضم لقناتنا", "تابعونا", "اشترك في قناتي", "بيع برومو", "خصومات اليوم", "عرض خاص هنا"],
  21: ["جديد وضعيف", "مبتدئ تافه", "لا تعرف تلعب", "ماذا تفعل يا غبي", "هذا مستوى اطفال"],
  22: ["لماذا تراسلني", "لا تراسلني", "اوقف الرسائل الخاصه", "رسائلك الخاصه مزعجه"],
  23: ["كم عمرك", "ارسل لي صوره", "تعال نتحدث خاص", "هل انت تحت 18", "ما اسم مدرستك"],
  24: ["اشاعه", "شائعه", "اللعبه ستغلق", "اللعبه بتتوقف", "سيتم حذف حساباتنا"],
  25: ["حمّل تطبيق", "موقع منافس", "لعبه افضل من هذه", "العب معنا هناك", "منصه ثانيه"],
  26: ["انشروها في كل الغرف", "ابعثها لكل الغرف", "وزعها على كل القنوات"],
  27: ["مقطع دموي", "صوره مروعه", "فيديو عنيف", "مشهد قتل حقيقي", "صور حرق"],
  28: ["احول لك الفلوس", "ارسل لي المبلغ اولا", "ادفع قبل الاستلام", "بيع وهمي", "سوف اخدعك"],
  29: ["اسمي مسيء", "هذا اسم قبيح", "غير اسمك"],
};

/** فحص نص حر ضد القوانين القابلة للرصد الآلي. */
export function scanCommunityText(raw: string): ScanMatch[] {
  const text = normalize(raw);
  if (!text) return [];
  const found: ScanMatch[] = [];
  for (const [ruleIdStr, keywords] of Object.entries(AUTO_PATTERNS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        found.push({ ruleId: Number(ruleIdStr), evidence: kw });
        break;
      }
    }
  }
  return found;
}

/** أقوى خطورة ضمن مجموعة مطابقات. */
export function maxMatchSeverity(matches: ScanMatch[]): RuleSeverity {
  const order: Record<RuleSeverity, number> = { low: 0, medium: 1, high: 2 };
  let best: RuleSeverity = "low";
  for (const m of matches) {
    const rule = ruleById(m.ruleId);
    if (rule && order[rule.severity] > order[best]) best = rule.severity;
  }
  return best;
}

/** كشف السبام: نص مكرر (بعد التطبيع) أكثر من مرة خلال نافذة زمنية قصيرة. */
export function isDuplicateSpam(
  current: string,
  recentTexts: string[],
  threshold = 2,
): boolean {
  const norm = normalize(current);
  if (norm.length < 2) return false;
  let count = 0;
  for (const t of recentTexts) {
    if (normalize(t) === norm) count++;
  }
  return count >= threshold;
}

/** اسم أي قانون من رقمه (عربي). */
export function ruleTitle(id: number): string {
  return ruleById(id)?.title ?? `قانون ${id}`;
}
