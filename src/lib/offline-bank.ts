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
 *   1) خريطة استبدال للنصوص المشوّهة المعروفة.
 *   2) تصحيح فهارس إجابات خاطئة علمياً (معرّفة بالمعرّف `id`).
 *   3) شبكة أمان: أي سؤال يبقى مشوّهاً بعد ذلك يُستبعد من العرض نهائياً،
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
  " ISAAC أerson": "إسحاق أزيموف",
  "الkerja": "الظل",
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

/** يطبّق التصحيحات النصية على سؤال واحد. */
function clean(value: string): string {
  return TEXT_FIXES[value] ?? value;
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
  const question = clean(q.question);
  const options = q.options.map(clean);
  const fixedIndex = INDEX_FIXES[q.id];
  const correctIndex = fixedIndex ?? q.correctIndex;

  if (
    !question ||
    options.length < 2 ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    return null;
  }
  if (isCorrupt(question, q.id) || options.some((o) => isCorrupt(o, q.id))) return null;
  // خيارات مكرّرة = سؤال معطوب (يُحذف الأخير المكرر عبر الاستبعاد)
  if (new Set(options).size !== options.length) return null;

  return { ...q, question, options, correctIndex };
}

/** البنك النظيف الجاهز للعرض — كل سؤال فيه اجتاز التنقية. */
export const OFFLINE_BANK: OfflineQuestion[] = OFFLINE_QUESTION_BANK.map(sanitize).filter(
  (q): q is OfflineQuestion => q !== null,
);

/** عدد الأسئلة المستبعدة بسبب تشوّه تعذّر إصلاحه. */
export const OFFLINE_DROPPED = OFFLINE_QUESTION_BANK.length - OFFLINE_BANK.length;

export { QUESTIONS_PER_STAGE, TOTAL_STAGES };
export type { OfflineQuestion };
