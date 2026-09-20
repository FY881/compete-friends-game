import {
  OFFLINE_QUESTION_BANK,
  QUESTIONS_PER_STAGE,
  TOTAL_STAGES,
  type OfflineQuestion,
} from "@/convex/offlineQuestions";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧼 تنقية بنك الأسئلة الأوفلاين
 * ═══════════════════════════════════════════════════════════════════════
 *
 * بنك الـ360 سؤالاً يحتوي عدداً من النصوص المشوّهة التي تسرّبت أثناء
 * توليده آلياً: كلمات عربية التصقت بمقاطع لاتينية («سبitzer»، «الcarbon»)
 * أو حروف من أبجديات أخرى (صينية/عبرية/كورية) دخلت داخل الكلمة العربية.
 *
 * التصحيح مُعلَن هنا صراحةً — لا كتابة عشوائية على البيانات الأصلية:
 *   1) خريطة استبدال للنصوص المشوّهة المعروفة (شملت حتى الكلمات التي
 *      فصلها فراغ مثل «ال Geek» أو «فيزتنا» أو «yAxis»).
 *   2) تصحيح فهارس إجابات خاطئة علمياً (معرّفة بالمعرّف `id`).
 *   3) تجاوز كامل لخيارات سؤال بعينه عند الحاجة (`OPTION_OVERRIDES`).
 *   4) تقليم المسافات الطرفية من السؤال والخيارات والتصنيف.
 *   5) شبكة أمان: أي سؤال يبقى مشوّهاً بعد ذلك يُستبعد من العرض نهائياً،
 *      فلا يرى اللاعب نصاً مكسوراً أبداً.
 *
 * المصدر يبقى كما هو (`src/convex/offlineQuestions.ts`)، والتشغيل نظيف.
 */

/** نصوص مشوّهة → صياغتها العربية الصحيحة. */
const TEXT_FIXES: Record<string, string> = {
  "سبitzer": "سبيتزر",
  "ما هو العنصر الذي يُعرف بالelement of life؟": "ما هو العنصر الذي يُعرف بعنصر الحياة؟",
  "الcarbon": "الكربون",
  "الdictionary": "المعجم",
  "ما هو عددendtime Planck؟": "ما هو مقدار زمن بلانك؟",
  "كم عدد كromosomes human body cell?": "كم عدد الكروموسومات في خلية جسم الإنسان؟",
  "أُسSEE": "الكريكيت",
  "الشعرىedByMan": "منكب الجوزاء",
  "ب桕د": "رجل الجبار",
  "الandro": "أندروميدا",
  "المgénta": "الماجلان",
  "ISAAC أerson": "إسحاق أزيموف",
  "الkerja": "الظل",
  // ── تلوّث التحق بمسافة أو شوّه الكلمة كاملاً (لا يلتقطه فحص الالتصاق) ──
  "ال Geek": "الإنجليزية",
  "Computer Pزيموفal Unit": "Computer Personal Unit",
  "ما هي نظرية أينشتاين الشهيرة المعادلة(vol) E=mc²؟": "ما هي نظرية أينشتاين الشهيرة E=mc²؟",
  "كم عدد عظام جسم الإنسان adults?": "كم عدد عظام جسم الإنسان البالغ؟",
  "كم فيزتنا من الأرض إلى القمر؟": "كم تبلغ المسافة من الأرض إلى القمر؟",
  ".Speed + Time = Distance. إذا كان المسافة تضاعفت والسرعة ثابتة، ماذا يحدث للوقت؟":
    "إذا تضاعفت المسافة والسرعة ثابتة، ماذا يحدث للوقت؟",
  "ما هو أكبر عدد أولي واحد yAxis 50؟": "ما هو أكبر عدد أولي أصغر من 50؟",
  "ما هي الوحدة الأصغر في الم living organism?": "ما هي الوحدة الأصغر في الكائن الحي؟",
  "ما هو مخترع telephone؟": "من هو مخترع الهاتف؟",
  "إذا كان 2 hacked = 4 و 3 hacked = 9، فما هو 5 hacked؟":
    "إذا كان مربع 2 هو 4 ومربع 3 هو 9، فما هو مربع 5؟",
  "ما العدد الذي يضربك في الرأس ويُنقذ حياتك؟": "ما هو الشيء الذي يضربك في الرأس ويُنقذ حياتك؟",
  "الم threw": "المشط",
  "المالم": "المنديل",
  "المظل": "المظلة",
  "كم عدد فراشات الدماغ البشرية (neurons) تقريباً؟":
    "كم عدد الخلايا العصبية في الدماغ البشري تقريباً؟",
  "pongo": "بومبو",
  "ريدينغ": "ريدلي سكوت",
  "العاجين": "الملاط",
  "ثانيأكسيد الكربون": "ثاني أكسيد الكربون",
  "من هو مخترع Algebra في العالم الإسلامي؟": "من هو مؤسس علم الجبر في العالم الإسلامي؟",
  "alan shepard": "آلان شيبرد",
  "الحلزوني": "درب التبانة",
  "ikipedia": "معلومات عامة",
  "تاي‌슨 غاي": "تايسون غاي",
  "الמ‌لح": "الملح",
};

/**
 * تصحيح إجابات خاطئة علمياً — المفتاح هو `id` السؤال.
 * o341: «أقرب نجم إلى الأرض باستثناء الشمس» — الجواب الصحيح هو
 *       ألفا سنتوري (القنطور الأقرب) لا الشعرى اليمانية.
 */
const INDEX_FIXES: Record<string, number> = {
  o341: 2,
};

/**
 * تجاوز كامل لخيارات سؤال بعينه — للحالات التي لا يكفي فيها استبدال نص واحد:
 *   o142: خيار مكرّر («باميان» مرتين) يجعل السؤال معطوباً → خيار بديل سليم.
 *   o326: مصلح «Declaration» في الكريكيت لا الغولف، والخيار الرابع كان مشوّهاً
 *         («أُسSEE») → تصحيح الإجابة والخيارات معاً.
 */
const OPTION_OVERRIDES: Record<string, { options: string[]; correctIndex: number }> = {
  o142: { options: ["بخارى", "أصفهان", "باميان", "همدان"], correctIndex: 0 },
  o326: { options: ["التنس", "الكريكيت", "السباحة", "الهوكي"], correctIndex: 1 },
};

/**
 * ينظّف النص: يزيل المسافات الطرفية ثم يطبّق التصحيحات المعروفة.
 * (المفاتيح في `TEXT_FIXES` مكتوبة بلا مسافات طرفية — فالتقليم أولاً.)
 */
function normalize(value: string): string {
  const trimmed = value.trim();
  return TEXT_FIXES[trimmed] ?? trimmed;
}

/** هل يحتوي النص على خلط حروف عربية/لاتينية (دليل تشوّه)؟ */
const CORRUPT = /[\u0621-\u064A\u0660-\u0669][A-Za-z]|[A-Za-z][\u0621-\u064A\u0660-\u0669]/;
/** حروف من أبجديات أخرى دخلت سهواً (سيريلية/يونانية/عبرية/كورية/CJK). */
const ALIEN_SCRIPT = /[\u0400-\u04FF\u0590-\u05FF\u0370-\u03FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

/**
 * أسئلة سليمة تماماً تُستخدم فيها مصطلحات أجنبية عن قصد — فلا تُستبعد.
 * o11: «المعدن الذي يُعرف بـ argentum» (المصطلح اللاتيني هو جوهر السؤال).
 * o74: «ما قيمة π تقريباً؟» (الرمز اليوناني مقصود).
 */
const INTENTIONAL_TERMS = new Set<string>(["o11", "o74"]);

function isCorrupt(text: string, id?: string): boolean {
  if (id && INTENTIONAL_TERMS.has(id)) return false;
  return CORRUPT.test(text) || ALIEN_SCRIPT.test(text);
}

/**
 * يحوّل السؤال إلى نسخته النظيفة، أو يعيد `null` إن تعذّر تطهيره.
 * (شبكة الأمان: نص مكسور لا يصل للاعب أبداً.)
 */
function sanitize(q: OfflineQuestion): OfflineQuestion | null {
  const question = normalize(q.question);
  const category = normalize(q.category);
  const override = OPTION_OVERRIDES[q.id];
  const options = (override?.options ?? q.options).map(normalize);
  const correctIndex = override?.correctIndex ?? INDEX_FIXES[q.id] ?? q.correctIndex;

  if (
    !question ||
    !category ||
    options.length < 2 ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    return null;
  }
  if (isCorrupt(question, q.id) || options.some((o) => isCorrupt(o, q.id))) return null;
  // خيارات مكرّرة = سؤال معطوب (يُحذف الأخير المكرر عبر الاستبعاد)
  if (new Set(options).size !== options.length) return null;

  return { ...q, category, question, options, correctIndex };
}

/** البنك النظيف الجاهز للعرض — كل سؤال فيه اجتاز التنقية. */
export const OFFLINE_BANK: OfflineQuestion[] = OFFLINE_QUESTION_BANK.map(sanitize).filter(
  (q): q is OfflineQuestion => q !== null,
);

/** عدد الأسئلة المستبعدة بسبب تشوّه تعذّر إصلاحه. */
export const OFFLINE_DROPPED = OFFLINE_QUESTION_BANK.length - OFFLINE_BANK.length;

export { QUESTIONS_PER_STAGE, TOTAL_STAGES };
export type { OfflineQuestion };
