/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ v11.0 — نواة التحدّيات (منطق نقي بلا اعتماديات)
 *
 * العقد الواحد بين: تحدّي الغرفة · تحدّي الملتقى · الساحة · لوحة المالك · الاختبارات.
 *
 * يحكم هذا الملف خمسة أشياء فقط، وكلها قابلة للقياس:
 *   ① حدود التحدّي (عدد الأسئلة · الصعوبة · المكافأة) — تُفرض على المنشئ أياً كان
 *   ② تقييم النتيجة (رتبة + نجاح/رسوب)
 *   ③ حساب المكافأة الحقيقية (خبرة + عملات) من الأداء لا من الوعد
 *   ④ التحقق من النتيجة القادمة من المتصفح (رفض التلاعب + تقييد القيم)
 *   ⑤ الحالة والترتيب (مفتوح · منتهٍ · مغلق · لوحة الصدارة)
 *
 * قاعدة صارمة: لا شيء في هذا الملف «شكلي» — كل رقم يُستهلك فعلاً في اللعب
 * أو في التحقق أو في العرض.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────
// ① الحدود — مصدر واحد للحقيقة (الغرفة والملتقى والساحة يقرؤون منها)
// ───────────────────────────────────────────────────────────────────────

export const CHALLENGE_MIN_QUESTIONS = 5;
export const CHALLENGE_MAX_QUESTIONS = 30;
export const CHALLENGE_MAX_REWARD_XP = 600;
export const CHALLENGE_MAX_REWARD_COINS = 500;
export const CHALLENGE_MIN_REWARD_XP = 10;
export const CHALLENGE_MIN_REWARD_COINS = 0;
/** أقل نسبة نجاح تستحق مكافأة — تحت هذا الحدّ صفر (عاقبة حقيقية) */
export const CHALLENGE_PASS_RATIO = 0.5;
/** مدة صلاحية افتراضية بالتحدّي بالساعات (٠ = بلا انتهاء) */
export const CHALLENGE_DEFAULT_TTL_HOURS = 72;
export const CHALLENGE_MAX_TTL_HOURS = 720;
/** أقصى محاولة مكافأة لكل لاعب في التحدّي الواحد */
export const CHALLENGE_REWARD_PER_USER = 1;
/** لوحة الصدارة: أقصى عدد صفوف */
export const CHALLENGE_BOARD_SIZE = 10;
/** حدّ زمني أدنى لكل سؤال (مللي) — أقل من ذلك = نتيجة مشكوك فيها */
export const CHALLENGE_MIN_MS_PER_QUESTION = 500;
/** حدّ زمني أعلى لكل سؤال (مللي) */
export const CHALLENGE_MAX_MS_PER_QUESTION = 120_000;

export type ChallengeDifficulty = "easy" | "medium" | "hard" | "expert";
export type ChallengeSource = "room" | "forum";
export type ChallengeStatus = "open" | "expired" | "closed";

interface DifficultySpec {
  id: ChallengeDifficulty;
  label: string;
  emoji: string;
  /** مضاعف المكافأة — الصعب يستحق أكثر */
  multiplier: number;
  /** ثواني العدّاد المُقترحة في الساحة */
  seconds: number;
}

export const CHALLENGE_DIFFICULTIES: readonly DifficultySpec[] = [
  { id: "easy", label: "سهل", emoji: "🌱", multiplier: 0.8, seconds: 20 },
  { id: "medium", label: "متوسط", emoji: "⚖️", multiplier: 1, seconds: 16 },
  { id: "hard", label: "صعب", emoji: "🔥", multiplier: 1.3, seconds: 13 },
  { id: "expert", label: "خبير", emoji: "💀", multiplier: 1.6, seconds: 11 },
];

export function difficultySpec(raw: string | undefined | null): DifficultySpec {
  const found = CHALLENGE_DIFFICULTIES.find((d) => d.id === raw);
  return found ?? CHALLENGE_DIFFICULTIES[1];
}

export function isChallengeDifficulty(raw: string | undefined | null): raw is ChallengeDifficulty {
  return CHALLENGE_DIFFICULTIES.some((d) => d.id === raw);
}

/** تقييد أي رقم بين حدّين بأمان (يستخدمه الخادم والواجهة معاً). */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export interface ChallengeSpec {
  difficulty: ChallengeDifficulty;
  questionCount: number;
  rewardXp: number;
  rewardCoins: number;
  ttlHours: number;
}

/**
 * يوائم أي طلب تحدٍّ (من غرفة أو ملتقى أو مالك) إلى مواصفة مضبوطة.
 * لا يوجد مسار آخر لإنشاء تحدٍّ — فالحدود مفروضة في مكان واحد.
 */
export function normalizeChallengeSpec(input: {
  difficulty?: string | null;
  questionCount?: number | null;
  rewardXp?: number | null;
  rewardCoins?: number | null;
  ttlHours?: number | null;
}): ChallengeSpec {
  return {
    difficulty: isChallengeDifficulty(input.difficulty) ? (input.difficulty as ChallengeDifficulty) : "medium",
    questionCount: clampNumber(input.questionCount, CHALLENGE_MIN_QUESTIONS, CHALLENGE_MAX_QUESTIONS, 10),
    rewardXp: clampNumber(input.rewardXp, CHALLENGE_MIN_REWARD_XP, CHALLENGE_MAX_REWARD_XP, 60),
    rewardCoins: clampNumber(input.rewardCoins, CHALLENGE_MIN_REWARD_COINS, CHALLENGE_MAX_REWARD_COINS, 0),
    ttlHours: clampNumber(input.ttlHours, 0, CHALLENGE_MAX_TTL_HOURS, CHALLENGE_DEFAULT_TTL_HOURS),
  };
}

// ───────────────────────────────────────────────────────────────────────
// ② التقييم — رتبة النتيجة
// ───────────────────────────────────────────────────────────────────────

export interface ChallengeGrade {
  tier: "fail" | "bronze" | "silver" | "gold" | "perfect";
  label: string;
  emoji: string;
  passed: boolean;
  ratio: number;
}

export function gradeChallenge(correct: number, total: number): ChallengeGrade {
  const safeTotal = Math.max(1, Math.floor(total || 0));
  const safeCorrect = Math.max(0, Math.min(safeTotal, Math.floor(correct || 0)));
  const ratio = safeCorrect / safeTotal;
  if (ratio >= 1) return { tier: "perfect", label: "إتقان تام", emoji: "💎", passed: true, ratio };
  if (ratio >= 0.8) return { tier: "gold", label: "ذهبي", emoji: "🥇", passed: true, ratio };
  if (ratio >= 0.65) return { tier: "silver", label: "فضي", emoji: "🥈", passed: true, ratio };
  if (ratio >= CHALLENGE_PASS_RATIO) return { tier: "bronze", label: "برونزي", emoji: "🥉", passed: true, ratio };
  return { tier: "fail", label: "لم تُجتز", emoji: "🚫", passed: false, ratio };
}

// ───────────────────────────────────────────────────────────────────────
// ③ المكافأة الحقيقية — تُحسب من الأداء المُتحقَّق منه فقط
// ───────────────────────────────────────────────────────────────────────

export interface ChallengeReward {
  xp: number;
  coins: number;
  passed: boolean;
  grade: ChallengeGrade;
  /** 0..1 — نسبة ما ناله اللاعب من سقف التحدّي، تُعرض في الواجهة بصدق */
  efficiency: number;
  note: string;
}

/**
 * مكافأة التحدّي = المكافأة المُعلنة × مضاعف الصعوبة × الدقة، وبصفر تحت عتبة النجاح.
 * لا تُحتسب إلا مرة واحدة لكل لاعب (الخادم هو من يفرض ذلك عبر سجل المحاولات).
 */
export function rewardForRun(input: {
  correct: number;
  total: number;
  difficulty: string;
  rewardXp: number;
  rewardCoins: number;
  suspicious?: boolean;
}): ChallengeReward {
  const spec = difficultySpec(input.difficulty);
  const baseXp = clampNumber(input.rewardXp, 0, CHALLENGE_MAX_REWARD_XP, 0);
  const baseCoins = clampNumber(input.rewardCoins, 0, CHALLENGE_MAX_REWARD_COINS, 0);
  const grade = gradeChallenge(input.correct, input.total);
  if (!grade.passed) {
    return {
      xp: 0,
      coins: 0,
      passed: false,
      grade,
      efficiency: 0,
      note: `لم تتجاوز عتبة النجاح (${Math.round(CHALLENGE_PASS_RATIO * 100)}٪) — لا مكافأة هذه المرة`,
    };
  }
  const penalty = input.suspicious ? 0.5 : 1;
  const rawXp = baseXp * spec.multiplier * grade.ratio * penalty;
  const rawCoins = baseCoins * spec.multiplier * grade.ratio * penalty;
  const xp = Math.max(0, Math.min(CHALLENGE_MAX_REWARD_XP, Math.round(rawXp)));
  const coins = Math.max(0, Math.min(CHALLENGE_MAX_REWARD_COINS, Math.round(rawCoins)));
  const ceiling = Math.max(1, Math.round(baseXp * spec.multiplier));
  return {
    xp,
    coins,
    passed: true,
    grade,
    efficiency: Math.max(0, Math.min(1, xp / ceiling)),
    note: input.suspicious
      ? "زمن اللعب أقل من المعقول — احتُسبت نصف المكافأة"
      : `${grade.emoji} ${grade.label} — نلت ${Math.round(grade.ratio * 100)}٪ من قيمة التحدّي`,
  };
}

// ───────────────────────────────────────────────────────────────────────
// ④ التحقق من النتيجة القادمة من المتصفح — لا ثقة بأرقام العميل
// ───────────────────────────────────────────────────────────────────────

export interface RunInput {
  correct: number;
  total: number;
  score: number;
  durationMs: number;
}

export interface RunValidation {
  ok: boolean;
  reason: string;
  run: RunInput;
  suspicious: boolean;
}

/**
 * القواعد المُفرضة على أي نتيجة قادمة من المتصفح:
 *   • عدد الأسئلة = عدد أسئلة التحدّي المُعلن (لا يُختصر التحدّي للفوز السريع)
 *   • الإجابات الصحيحة لا تتجاوز المجموع
 *   • النتيجة رقمية موجبة ومسقوفة
 *   • الزمن داخل نطاق معقول وإلا عُدّت النتيجة مشكوكاً فيها (نصف مكافأة)
 */
export function validateRun(input: Partial<RunInput>, expectedTotal: number): RunValidation {
  const total = clampNumber(input.total, 0, CHALLENGE_MAX_QUESTIONS, 0);
  const expected = clampNumber(expectedTotal, CHALLENGE_MIN_QUESTIONS, CHALLENGE_MAX_QUESTIONS, 10);
  const correct = clampNumber(input.correct, 0, total, 0);
  const score = clampNumber(input.score, 0, 1_000_000, 0);
  const durationMs = clampNumber(input.durationMs, 0, 24 * 60 * 60 * 1000, 0);

  if (total !== expected) {
    return {
      ok: false,
      reason: `عدد الأسئلة المُرسل (${total}) لا يطابق عدد أسئلة التحدّي (${expected})`,
      run: { correct: 0, total: expected, score: 0, durationMs: 0 },
      suspicious: true,
    };
  }

  const minMs = expected * CHALLENGE_MIN_MS_PER_QUESTION;
  const maxMs = expected * CHALLENGE_MAX_MS_PER_QUESTION;
  const suspicious = durationMs < minMs || durationMs > maxMs;

  return {
    ok: true,
    reason: suspicious ? "زمن غير معقول — تُحتسب المكافأة بالنصف" : "نتيجة سليمة",
    run: { correct, total, score, durationMs },
    suspicious,
  };
}

// ───────────────────────────────────────────────────────────────────────
// ⑤ الحالة والترتيب
// ───────────────────────────────────────────────────────────────────────

export interface ChallengeLike {
  status: string;
  expiresAt: number;
  plays: number;
}

export function challengeStatus(row: ChallengeLike, now: number): ChallengeStatus {
  if (row.status === "closed") return "closed";
  if (row.expiresAt > 0 && now >= row.expiresAt) return "expired";
  return "open";
}

export function isPlayable(row: ChallengeLike, now: number): boolean {
  return challengeStatus(row, now) === "open";
}

export function remainingMs(row: ChallengeLike, now: number): number {
  if (row.expiresAt <= 0) return 0;
  return Math.max(0, row.expiresAt - now);
}

/** نصّ المدة المتبقية — يُعرض للاعب بصدق بدل «فعّال» الغامضة. */
export function remainingLabel(row: ChallengeLike, now: number): string {
  const status = challengeStatus(row, now);
  if (status === "closed") return "أُغلق بقرار الإدارة";
  if (status === "expired") return "انتهت مدته";
  const ms = remainingMs(row, now);
  if (ms <= 0) return "بلا انتهاء";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 24) return `يتبقّى ${Math.floor(hours / 24)} يوم`;
  if (hours >= 1) return `يتبقّى ${hours} ساعة`;
  return `يتبقّى ${Math.max(1, Math.floor(ms / 60000))} دقيقة`;
}

export interface RunRow {
  userId: string;
  userName: string;
  correct: number;
  total: number;
  score: number;
  xpAwarded: number;
  createdAt: number;
}

/**
 * لوحة الصدارة: أفضل نتيجة **لكل لاعب** (لا يتكدّس لاعب واحد في القمة)،
 * مرتّبة بالنقاط ثم الدقة ثم الأسبق.
 */
export function bestPerUser(rows: readonly RunRow[]): RunRow[] {
  const best = new Map<string, RunRow>();
  for (const row of rows) {
    const prev = best.get(row.userId);
    if (!prev || row.score > prev.score || (row.score === prev.score && row.correct > prev.correct)) {
      best.set(row.userId, row);
    }
  }
  return [...best.values()].sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.createdAt - b.createdAt,
  );
}

export function boardOf(rows: readonly RunRow[], size: number = CHALLENGE_BOARD_SIZE): RunRow[] {
  return bestPerUser(rows).slice(0, Math.max(1, size));
}

/** موقع اللاعب في اللوحة (1-based) أو 0 إن لم يشارك. */
export function rankOfUser(rows: readonly RunRow[], userId: string): number {
  const idx = bestPerUser(rows).findIndex((r) => r.userId === userId);
  return idx < 0 ? 0 : idx + 1;
}

/** هل نال اللاعب مكافأته؟ (يُقرأ من سجل المحاولات لا من ادعاء الواجهة) */
export function rewardedRuns(rows: readonly RunRow[]): RunRow[] {
  return rows.filter((r) => r.xpAwarded > 0);
}

/** نصّ حالة اللاعب في التحدّي — يُعرض في الغرفة والملتقى والساحة. */
export function myChallengeState(rows: readonly RunRow[], userId: string): {
  played: boolean;
  rewarded: boolean;
  attempts: number;
  bestScore: number;
  label: string;
} {
  const mine = rows.filter((r) => r.userId === userId);
  if (mine.length === 0) return { played: false, rewarded: false, attempts: 0, bestScore: 0, label: "لم تلعب بعد" };
  const bestScore = Math.max(...mine.map((r) => r.score));
  const rewarded = mine.some((r) => r.xpAwarded > 0);
  return {
    played: true,
    rewarded,
    attempts: mine.length,
    bestScore,
    label: rewarded ? `نلت مكافأتك · أفضل ${bestScore}` : `أفضل نتيجة ${bestScore} — المكافأة لم تُنل بعد`,
  };
}

/** كود تحدٍّ قصير قابل للمشاركة (ROOM-XXXXXX / FORUM-XXXXXX). */
export function challengeCode(prefix: ChallengeSource, seed: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = Math.abs(Math.floor(seed)) || 1;
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    n = (n * 1103515245 + 12345) % 2147483648;
    out += alphabet[n % alphabet.length];
  }
  return `${prefix.toUpperCase()}-${out}`;
}

export function normalizeCode(raw: string | undefined | null): string {
  return (raw ?? "").trim().toUpperCase().slice(0, 24);
}
