/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗓️ نواة «تحدي اليوم» — الحساب النقي الموحّد
 * ═══════════════════════════════════════════════════════════════════════
 *
 * لماذا وُجدت: كان كل منطق التحدي اليومي (اختيار الأسئلة · النقاط · الخبرة ·
 * الشارات) مكتوباً داخل ملف الخادم بلا أي اختبار، بينما النظام كله غير موصول
 * بأي واجهة. فوُضع المنطق هنا نقيّاً بلا قاعدة بيانات ليُختبر بالكامل،
 * ويصبح للسلوك مصدر حقيقة واحد لا ينحرف.
 *
 * المبادئ:
 *  • نفس العشرة أسئلة لكل اللاعبين في اليوم نفسه (بذرة ثابتة من التاريخ).
 *  • الإجابة الصحيحة لا تُرسل للعميل أبداً — التحقق خادمي بحت.
 *  • الزمن المنقضي يُستخدم لمكافأة السرعة، والزمن المستحيل يُبطل المكافأة
 *    ولا يرفض المحاولة (حتى لا يُعاقَب لاعب بريء تركه يقرأ).
 *  • كل رفض يعود بسبب عربي واضح.
 * ═══════════════════════════════════════════════════════════════════════
 */

export const DAILY_QUESTION_COUNT = 10;
export const DAILY_MAX_XP = 60;
/** سقف زمن السؤال المعتمد في حساب مكافأة السرعة */
export const DAILY_ANSWER_TIME_CAP_MS = 15_000;
/**
 * أدنى زمن معقول لقراءة سؤال واختيار إجابة. من أسرع من هذا (أو أرسل صفراً
 * ليستعجل المكافأة) يُحتسب له هذا الحد — فلا يبلغ السقف أبداً.
 *
 * ⚠️ صدقاً: الزمن يُقيسه المتصفح، فالغش التام غير قابل للمنع التقني. لكن أثره
 * يُقيَّد إلى مدى ضيّق: ١٠٠ نقطة من ١٥٠ أساسية لا تتأثر بالزمن أصلاً، والغش
 * هنا لن يتجاوز أسرع لاعب صادق إلا بفارق ضئيل. لا يُرفض أي لاعب حقيقي.
 */
export const DAILY_MIN_ANSWER_MS = 2_500;
/** فوق هذا الزمن يكون الرقم مُصنَّعاً لا مقيساً — يُرفض الإرسال */
export const DAILY_TIME_FORGERY_MS = 6 * 3600_000;

export const DAILY_BADGES = {
  first: "daily_first",
  perfect: "daily_perfect",
  sevenDays: "daily_7_days",
  thirtyDays: "daily_30_days",
} as const;

// ─────────────────────────── تاريخ اليوم ───────────────────────────

/**
 * مفتاح اليوم (YYYY-MM-DD) بتوقيت UTC — نفس الأساس الذي يستخدمه الجدول
 * والصدارة، فلا يختلف «اليوم» بين نظامين أبداً.
 */
export function dayKeyUtc(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** لحظة تصفير التحدي القادم (منتصف الليل UTC) — تعرضها الواجهة عدّاداً حقيقياً */
export function nextDailyResetAt(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
}

/** يحوّل مفتاح يوم إلى ميلي ثانية (UTC) — أو NaN إن كان المفتاح مشوّهاً */
function dayKeyToMs(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// ─────────────────────────── اختيار أسئلة اليوم ───────────────────────────

/** مولّد شبه عشوائي بذوره نصّية — نفس البذرة تعطي نفس السلسلة دائماً (FNV-1a) */
export function seededRandom(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** بذرة اليوم — ثابتة لكل اللاعبين، فلا يستطيع أحد تزوير «أسئلته» */
export function dailySeed(day: string): string {
  return `daily-challenge-${day}`;
}

/** العشرة أسئلة المختارة ليوم معيّن — حتمية تماماً */
export function questionsForDay<T extends { id: string }>(
  bank: T[],
  day: string,
  count: number = DAILY_QUESTION_COUNT,
): T[] {
  const rand = seededRandom(dailySeed(day));
  return shuffle(bank, rand).slice(0, Math.max(0, Math.min(count, bank.length)));
}

// ─────────────────────────── الحساب ───────────────────────────

/** الزمن الذي يُحتسب فعلاً: يُرفع إلى الحد الأدنى ويُقيَّد بسقف السؤال */
export function scoringElapsedMs(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return DAILY_ANSWER_TIME_CAP_MS;
  return Math.max(DAILY_MIN_ANSWER_MS, Math.min(DAILY_ANSWER_TIME_CAP_MS, elapsedMs));
}

/**
 * نقاط إجابة واحدة: ١٠٠ أساس + مكافأة سرعة حتى ٥٠.
 *
 * المكافأة تتوزّع خطياً على كامل النافذة (٠ ↔ ١٥ ثانية) لا على سُدسها؛
 * فالسقف القديم كان يمنح المكافأة الكاملة لأي إجابة تحت ٧.٥ ثانية،
 * فيصبح إرسال زمن صفري مربحاً بلا مقابل. الآن كل ميلي ثانية تفرق.
 */
export function answerScore(elapsedMs: number): number {
  const t = scoringElapsedMs(elapsedMs);
  const ratio = Math.max(0, Math.min(1, (DAILY_ANSWER_TIME_CAP_MS - t) / DAILY_ANSWER_TIME_CAP_MS));
  return 100 + Math.round(ratio * 50);
}

/** خبرة التحدي اليومي — مقيّدة بالسقف مهما حدث */
export function dailyXp(correctCount: number, total: number, bestStreak: number): number {
  const perfect = total > 0 && correctCount === total;
  const raw = correctCount * 10 + (perfect ? 20 : 0) + (bestStreak >= 5 ? 15 : 0);
  return Math.max(0, Math.min(DAILY_MAX_XP, raw));
}

// ─────────────────────────── الشارات ───────────────────────────

export interface BadgeOutcome {
  /** كل الشارات بعد المحاولة (بلا تكرار) */
  next: string[];
  /** الشارات الجديدة التي اكتسبها اللاعب الآن فقط */
  earned: string[];
}

export function badgesForDaily(opts: {
  had: readonly string[];
  perfect: boolean;
  /** عدد الأيام التي أنجز فيها التحدي *بعد* احتساب اليوم الحالي */
  totalDays: number;
}): BadgeOutcome {
  const had = new Set(opts.had);
  const next = new Set(had);
  next.add(DAILY_BADGES.first);
  if (opts.perfect) next.add(DAILY_BADGES.perfect);
  if (opts.totalDays >= 7) next.add(DAILY_BADGES.sevenDays);
  if (opts.totalDays >= 30) next.add(DAILY_BADGES.thirtyDays);
  const nextArr = [...next];
  return { next: nextArr, earned: nextArr.filter((id) => !had.has(id)) };
}

// ─────────────────────────── سلسلة الأيام ───────────────────────────

export interface StreakInfo {
  /** السلسلة الحالية المنتهية باليوم أو بالأمس (فلا تنكسر قبل أن ينتهي اليوم) */
  current: number;
  /** أطول سلسلة في تاريخ اللاعب */
  longest: number;
  /** هل أنجز تحدّي اليوم فعلاً؟ */
  playedToday: boolean;
}

const DAY_MS = 86_400_000;

/**
 * يحسب السلسلة من قائمة أيام الإنجاز (غير مرتّبة، وقد تحتوي تكراراً).
 * لا تنكسر السلسلة قبل انتهاء اليوم: من لعب أمس فقط وما زال أمامه اليوم
 * تُعرض سلسلته كما هي، لا صفراً.
 */
export function dailyStreak(days: readonly string[], today: string): StreakInfo {
  const times = [...new Set(days)]
    .map(dayKeyToMs)
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (times.length === 0) return { current: 0, longest: 0, playedToday: false };

  const set = new Set(times);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < times.length; i++) {
    run = times[i] - times[i - 1] === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayMs = dayKeyToMs(today);
  const playedToday = set.has(todayMs);
  let anchor = playedToday ? todayMs : todayMs - DAY_MS;
  if (!set.has(anchor)) return { current: 0, longest, playedToday };

  let current = 0;
  while (set.has(anchor)) {
    current += 1;
    anchor -= DAY_MS;
  }
  return { current, longest: Math.max(longest, current), playedToday };
}

// ─────────────────────────── التحقق والتقييم ───────────────────────────

export interface DailyAttemptAnswer {
  questionId: string;
  selected: number;
  elapsedMs: number;
}

export interface DailyScoreableQuestion {
  id: string;
  correctIndex: number;
  options: readonly string[];
}

export type DailyVerdict =
  | {
      ok: true;
      correctCount: number;
      bestStreak: number;
      score: number;
      perfect: boolean;
      /** هل احتُسبت أوقات جميع الإجابات كأوقات معقولة؟ (تشخيص للشفافية) */
      timingsTrustworthy: boolean;
    }
  | { ok: false; error: string };

/**
 * التقييم الخادمي الكامل: يرفض المحاولة المشوّهة، ويحسب النقاط والسلسلة.
 * لا يُمنح أي رقم من الواجهة ثقة: تُطابَق مجموعة الأسئلة، ويُقيَّد الزمن.
 */
export function validateDailyAttempt(args: {
  day: string;
  today: string;
  questions: readonly DailyScoreableQuestion[];
  answers: readonly DailyAttemptAnswer[];
}): DailyVerdict {
  const { day, today, questions, answers } = args;

  if (questions.length === 0) return { ok: false, error: "لا توجد أسئلة لهذا اليوم." };
  if (day !== today) {
    return { ok: false, error: "هذا التحدي ليس تحدياً لليوم — تظهر أسئلة جديدة كل يوم." };
  }
  if (answers.length !== questions.length) {
    return { ok: false, error: "أجب عن جميع الأسئلة قبل الإرسال." };
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  let timingsTrustworthy = true;

  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) return { ok: false, error: "سؤال غير معروف في هذا التحدي." };
    if (seen.has(a.questionId)) return { ok: false, error: "لا يجوز تكرار السؤال نفسه في محاولة واحدة." };
    seen.add(a.questionId);
    if (!Number.isInteger(a.selected) || a.selected < 0 || a.selected >= q.options.length) {
      return { ok: false, error: "اختيار خارج نطاق الخيارات." };
    }
    if (!Number.isFinite(a.elapsedMs) || a.elapsedMs < 0) {
      return { ok: false, error: "زمن إجابة غير صالح." };
    }
    if (a.elapsedMs > DAILY_TIME_FORGERY_MS) {
      return { ok: false, error: "زمن إجابة مُصنَّع — أُلغيت المحاولة." };
    }
    if (a.elapsedMs < DAILY_MIN_ANSWER_MS) timingsTrustworthy = false;
  }

  if (seen.size !== questions.length) {
    return { ok: false, error: "يجب الإجابة عن جميع أسئلة اليوم دون نقص." };
  }

  let correctCount = 0;
  let bestStreak = 0;
  let streak = 0;
  let score = 0;
  for (const a of answers) {
    const q = byId.get(a.questionId)!;
    if (a.selected === q.correctIndex) {
      correctCount += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      score += answerScore(a.elapsedMs);
    } else {
      streak = 0;
    }
  }

  return {
    ok: true,
    correctCount,
    bestStreak,
    score,
    perfect: correctCount === questions.length,
    timingsTrustworthy,
  };
}

/** هل يمكن ترتيب لاعبَين؟ الترتيب: نقاط ثم إجابات صحيحة ثم الأسرع في الوصول للنقاط */
export function compareDailyBoards(
  a: { score: number; correctCount: number; playedAt: number },
  b: { score: number; correctCount: number; playedAt: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  return a.playedAt - b.playedAt; // الأسبق أولاً — لا ميزة للتأجيل
}
