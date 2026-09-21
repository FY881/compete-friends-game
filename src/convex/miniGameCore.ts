/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎮 v14.0 — نواة الألعاب المصغّرة (منطق نقي، قابل للاختبار)
 *
 * المشكلة التي وُجد هذا الملف لحلّها: قسم «الألعاب المصغّرة» كان يعرض
 * **مكافأة خبرة معلنة** على ٩٦ لعبة، لكن النتيجة كانت تُحفظ في حالة React
 * المحلية فقط — تُفقد بالتحديث، ولا تصل للخادم، ولا تمنح خبرة أبداً.
 * أي: وعد معلن بلا دافع.
 *
 * هذه النواة تُنتج الرقم الحقيقي من **نتيجة اللاعب نفسها**، لا من ادّعاء
 * العميل:
 *   • الخبرة تُشتقّ من النتيجة × معامل الصعوبة (ولا تُقبل قيمة من الواجهة).
 *   • عوائد متناقصة داخل اليوم — فلا مزرعة خبرة بلعبة واحدة.
 *   • سقف يومي صارم للخبرة كلها (بغضّ النظر عن عدد الألعاب).
 *   • رفض النتائج غير المنطقية (زمن مستحيل، نتيجة سالبة/ضخمة).
 *
 * وكل قرار يعود بسبب مكتوب بالعربية — لا صمت ولا رقم غامض.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** بادئات معرّفات الألعاب المصغّرة الحقيقية (٨ فئات × ١٢ لعبة) */
export const MINI_GAME_PREFIXES = ["ch", "exp", "mem", "num", "spd", "stg", "vis", "wrd"] as const;

/** سقف الخبرة اليومي من الألعاب المصغّرة كلها */
export const MINI_GAME_DAILY_XP_CAP = 300;

/** أكبر نتيجة مقبولة منطقياً */
export const MINI_GAME_MAX_SCORE = 100_000;

/** أقل نتيجة تُحتسب لها خبرة — دونها اللعب بلا مكافأة */
export const MINI_GAME_MIN_SCORE = 10;

/** أعلى خبرة أساسية قبل معامل الصعوبة */
export const MINI_GAME_MAX_BASE_XP = 120;

/** سماحية الزمن: ثوانٍ إضافية فوق حدّ اللعبة تُقبل كثقل شبكة/تحميل */
export const MINI_GAME_TIME_SLACK_SECONDS = 20;

export type MiniGameDifficulty = "easy" | "medium" | "hard";

const ID_RE = /^(ch|exp|mem|num|spd|stg|vis|wrd)[0-9]+$/;

/** هل هذا معرّف لعبة مصغّرة حقيقية؟ (يمنع تسجيل نتائج لألعاب وهمية) */
export function isKnownMiniGameId(raw: string | undefined | null): boolean {
  return ID_RE.test((raw ?? "").trim());
}

export function isMiniGameDifficulty(raw: unknown): raw is MiniGameDifficulty {
  return raw === "easy" || raw === "medium" || raw === "hard";
}

/** معامل الصعوبة — الصعب يستحق أكثر، لكن بفارق محسوب لا مفتوح */
export function difficultyMultiplier(d: MiniGameDifficulty): number {
  if (d === "hard") return 1.4;
  if (d === "medium") return 1;
  return 0.7;
}

export interface MiniGameRewardInput {
  score: number;
  difficulty: MiniGameDifficulty;
  /** كم مرة لُعبت هذه اللعبة اليوم (قبل هذه المحاولة) */
  playsTodayForGame: number;
  /** كم خبرة اكتسب اللاعب اليوم من الألعاب المصغّرة كلها */
  xpEarnedToday: number;
  /** مدة اللعب الفعلية بالمللي ثانية */
  timeMs: number;
  /** حدّ اللعبة بالثواني (كما هي معلنة في الواجهة) */
  timeLimitSeconds: number;
}

export interface MiniGameReward {
  /** الخبرة الفعلية المستحقة — الرقم الوحيد الذي يُدفع */
  xp: number;
  /** هل أوقف السقف اليومي جزءاً من المكافأة؟ */
  cappedByDaily: boolean;
  /** هل المحاولة بلا خبرة بسبب تكرار اللعب؟ */
  fatigued: boolean;
  /** سبب مكتوب — يُعرض للاعب بالحرف */
  reason: string;
  /** مضاعف التكرار المُطبَّق (1 = أول لعب اليوم) */
  freshness: number;
}

/** عوائد متناقصة: أول لعب كامل، ثم يتضاءل، ثم يتوقف */
export function freshnessForPlays(playsTodayForGame: number): number {
  if (playsTodayForGame <= 0) return 1;
  if (playsTodayForGame <= 2) return 0.6;
  if (playsTodayForGame <= 5) return 0.3;
  return 0;
}

export function rewardForMiniGame(input: MiniGameRewardInput): MiniGameReward {
  const none = (reason: string, extra: Partial<MiniGameReward> = {}): MiniGameReward => ({
    xp: 0,
    cappedByDaily: false,
    fatigued: false,
    reason,
    freshness: 1,
    ...extra,
  });

  const score = Math.floor(input.score);
  if (!Number.isFinite(score) || score < 0 || score > MINI_GAME_MAX_SCORE) {
    return none("نتيجة غير منطقية — رُفضت.");
  }
  if (score < MINI_GAME_MIN_SCORE) {
    return none(`النتيجة أقل من ${MINI_GAME_MIN_SCORE} — اللعب بلا مكافأة (لكن موثَّق).`);
  }

  const limitMs = Math.max(0, input.timeLimitSeconds) * 1000 + MINI_GAME_TIME_SLACK_SECONDS * 1000;
  if (limitMs > 0 && input.timeMs > limitMs) {
    return none("زمن غير منطقي مقارنة بحدّ اللعبة — رُفضت المكافأة.");
  }

  const freshness = freshnessForPlays(input.playsTodayForGame);
  const base = Math.min(MINI_GAME_MAX_BASE_XP, Math.round(score / 10)) * difficultyMultiplier(input.difficulty);
  const beforeCap = Math.max(0, Math.round(base * freshness));

  if (beforeCap === 0) {
    return none("لعبتها كثيراً اليوم — نتيجتك تُسجَّل بلا خبرة، وعُد غداً.", { fatigued: true, freshness: 0 });
  }

  const remaining = Math.max(0, MINI_GAME_DAILY_XP_CAP - Math.max(0, input.xpEarnedToday));
  if (remaining === 0) {
    return none(`وصلت سقف اليوم (${MINI_GAME_DAILY_XP_CAP} خبرة) — تُسجَّل النتيجة بلا خبرة.`, { cappedByDaily: true });
  }

  const xp = Math.min(beforeCap, remaining);
  const cappedByDaily = xp < beforeCap;

  const parts: string[] = [`${score} نقطة × صعوبة ${input.difficulty}`];
  if (freshness < 1) parts.push(`تكرار اليوم (${Math.round(freshness * 100)}٪)`);
  if (cappedByDaily) parts.push(`السقف اليومي قصّها إلى ${xp}`);

  return {
    xp,
    cappedByDaily,
    fatigued: false,
    freshness,
    reason: parts.join(" · "),
  };
}

/** ما تبقّى للاعب من سقف اليوم — يُعرض في الواجهة بصدق */
export function remainingDailyXp(xpEarnedToday: number): number {
  return Math.max(0, MINI_GAME_DAILY_XP_CAP - Math.max(0, Math.floor(xpEarnedToday)));
}
