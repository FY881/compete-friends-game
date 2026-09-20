/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 محرك اللعبة المحلي (Local Mind Engine) — اللعبة تعمل بلا خادم إطلاقاً
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الغاية: أن تبقى «حرب العقول» حيّة مهما حدث للخادم. كل شيء هنا حقيقي
 * ومحفوظ في متصفح اللاعب، بلا أي استدعاء شبكة ولا استهلاك لأي حصة:
 *
 *   • ملف شخصي (اسم/رمز/رتبة) ومستوى ونقاط خبرة بعَتبات حقيقية.
 *   • إحصاءات دقيقة: دقة، أفضل سلسلة، جولات مثالية، تفصيل لكل فئة.
 *   • ١٤ إنجازاً بمنطق فتح حقيقي (يُقيَّم على الإحصاءات لا على الواجهة).
 *   • لوحة تصنيف محلية: خصوم ذكاء اصطناعي بنقاط ثابتة تتقدّم يومياً +
 *     ترتيبك الحقيقي بينهم (بلا خادم).
 *   • اختيار أسئلة تكيّفي: يرجّح فئاتك الضعيفة ويرفع الصعوبة مع مستواك.
 *
 * الحالة تُحفظ في localStorage وتُبثّ للمكوّنات عبر useSyncExternalStore،
 * فلا حاجة لأي مكتبة إدارة حالة إضافية.
 */

import { useSyncExternalStore } from "react";
import { OFFLINE_BANK, type OfflineQuestion } from "@/lib/offline-bank";
import {
  mindEffect,
  readMind,
  recordMindSession,
  resetEvolvedMind,
  type MindSessionReport,
} from "@/lib/evolvedMind";

// ═══════════════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════════════

export type ModeId = "quick" | "marathon" | "daily" | "category" | "duel";

export interface Profile {
  name: string;
  avatar: string;
  /** رتبة يختارها اللاعب من الرتب المفتوحة بمستواه */
  title: string;
  createdAt: number;
}

export interface CategoryStat {
  answered: number;
  correct: number;
}

export interface MatchRecord {
  at: number;
  mode: ModeId;
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  label: string;
}

export interface Stats {
  xp: number;
  coins: number;
  answered: number;
  correct: number;
  bestStreak: number;
  perfectRuns: number;
  matches: number;
  duelWins: number;
  dailyStreak: number;
  lastDaily: string | null;
  achievements: string[];
  categories: Record<string, CategoryStat>;
  history: MatchRecord[];
}

export interface SaveState {
  v: 2;
  profile: Profile;
  stats: Stats;
}

export interface SessionOutcome {
  mode: ModeId;
  label: string;
  /** الأسئلة المستخدمة في الجولة (لتحديث تفصيل الفئات) */
  questions: OfflineQuestion[];
  /** الفهرس المُختار لكل سؤال، أو -1 إن انتهى الوقت/الخسارة */
  answers: number[];
  score: number;
  bestStreak: number;
  /** زمن الإجابة الفعلي بالمللي ثانية لكل سؤال — يغذّي قوة «السرعة» */
  timesMs?: number[];
  /** مدة عدّاد الجولة بالثواني — مرجع قياس السرعة */
  timerSeconds?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// الرتب والمستويات
// ═══════════════════════════════════════════════════════════════════════

/** عناوين العقول بحسب المستوى — تُفتح تدريجياً وتُختار كرتبة. */
export const RANKS = [
  { level: 1, title: "عقل مبتدئ" },
  { level: 3, title: "مفكّر" },
  { level: 5, title: "محلّل" },
  { level: 8, title: "استراتيجي" },
  { level: 12, title: "عبقري" },
  { level: 17, title: "حكيم العقول" },
  { level: 23, title: "سيّد الحكمة" },
  { level: 30, title: "أسطورة العقول" },
] as const;

export interface LevelInfo {
  level: number;
  inLevel: number;
  needed: number;
  progress: number;
}

/** XP اللازم للانتقال من مستوى إلى الذي يليه (يتصاعد). */
function xpNeededFor(level: number): number {
  return 400 + (level - 1) * 260;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  let need = xpNeededFor(level);
  while (remaining >= need && level < 200) {
    remaining -= need;
    level += 1;
    need = xpNeededFor(level);
  }
  return {
    level,
    inLevel: remaining,
    needed: need,
    progress: need > 0 ? remaining / need : 0,
  };
}

export function unlockedTitles(xp: number): string[] {
  const { level } = levelInfo(xp);
  return RANKS.filter((r) => r.level <= level).map((r) => r.title);
}

// ═══════════════════════════════════════════════════════════════════════
// الإنجازات — منطق فتح حقيقي مبني على الإحصاءات
// ═══════════════════════════════════════════════════════════════════════

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  reward: number;
  /** يُقيَّم على الحالة الجديدة بعد كل جولة */
  test: (s: Stats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_match", title: "أول نزال", desc: "أكمل جولتك الأولى", icon: "⚔️", reward: 100, test: (s) => s.matches >= 1 },
  { id: "m10", title: "مُثابر", desc: "أكمل ١٠ جولات", icon: "🔁", reward: 250, test: (s) => s.matches >= 10 },
  { id: "m50", title: "محارب العقول", desc: "أكمل ٥٠ جولة", icon: "🛡️", reward: 800, test: (s) => s.matches >= 50 },
  { id: "streak5", title: "سلسلة مشتعلة", desc: "٥ إجابات صحيحة متتالية", icon: "🔥", reward: 200, test: (s) => s.bestStreak >= 5 },
  { id: "streak10", title: "لا يُوقَف", desc: "١٠ إجابات صحيحة متتالية", icon: "⚡", reward: 500, test: (s) => s.bestStreak >= 10 },
  { id: "streak20", title: "عقل خارق", desc: "٢٠ إجابة صحيحة متتالية", icon: "🧠", reward: 1200, test: (s) => s.bestStreak >= 20 },
  { id: "perfect1", title: "إتقان تام", desc: "أنهِ جولة بنسبة ١٠٠٪", icon: "🎯", reward: 300, test: (s) => s.perfectRuns >= 1 },
  { id: "perfect5", title: "دقّة الجرّاح", desc: "٥ جولات مثالية", icon: "💎", reward: 1000, test: (s) => s.perfectRuns >= 5 },
  { id: "acc80", title: "قنّاص المعرفة", desc: "أجب على ٤٠ سؤالاً بدقة ٨٠٪+", icon: "🏹", reward: 600, test: (s) => s.answered >= 40 && s.correct / Math.max(1, s.answered) >= 0.8 },
  { id: "lvl5", title: "المحلّل", desc: "ابلغ المستوى ٥", icon: "📈", reward: 300, test: (s) => levelInfo(s.xp).level >= 5 },
  { id: "lvl10", title: "العبقري", desc: "ابلغ المستوى ١٠", icon: "🌟", reward: 900, test: (s) => levelInfo(s.xp).level >= 10 },
  { id: "lvl20", title: "أسطورة صاعدة", desc: "ابلغ المستوى ٢٠", icon: "👑", reward: 2500, test: (s) => levelInfo(s.xp).level >= 20 },
  { id: "daily3", title: "مواظب", desc: "٣ أيام متتالية في التحدي اليومي", icon: "📅", reward: 500, test: (s) => s.dailyStreak >= 3 },
  { id: "duel5", title: "كاسر العقول", desc: "افز في ٥ مواجهات", icon: "🥊", reward: 800, test: (s) => s.duelWins >= 5 },
];

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_MAP.get(id);
}

// ═══════════════════════════════════════════════════════════════════════
// التخزين والحالة
// ═══════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "mindclash.localgame.v2";
const AVATARS = ["🧠", "🦅", "🐺", "🦁", "🐉", "🦉", "🔥", "⚡", "👑", "🎯", "💎", "🚀"];
export { AVATARS };

const DEFAULT_AVATAR = AVATARS[0];

function emptyStats(): Stats {
  return {
    xp: 0,
    coins: 0,
    answered: 0,
    correct: 0,
    bestStreak: 0,
    perfectRuns: 0,
    matches: 0,
    duelWins: 0,
    dailyStreak: 0,
    lastDaily: null,
    achievements: [],
    categories: {},
    history: [],
  };
}

function defaultState(): SaveState {
  return {
    v: 2,
    profile: {
      name: "اللاعب",
      avatar: DEFAULT_AVATAR,
      title: RANKS[0].title,
      createdAt: Date.now(),
    },
    stats: emptyStats(),
  };
}

function load(): SaveState {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const base = defaultState();
    return {
      v: 2,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      stats: { ...base.stats, ...(parsed.stats ?? {}), categories: parsed.stats?.categories ?? {}, history: parsed.stats?.history ?? [] },
    };
  } catch {
    return defaultState();
  }
}

let state: SaveState = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* التخزين ممتلئ/محجوب — الجولة تعمل على أي حال */
  }
}

function commit(next: SaveState): void {
  state = next;
  persist();
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* مستمع معطوب لا يُسقط المحرك */
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SaveState {
  return state;
}

/** يربط أي مكوّن بحالة اللعبة المحلية (تفاعلية كاملة، بلا خادم). */
export function useLocalGame(): SaveState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * قراءة لقطة الحالة الحالية خارج React.
 * تُستخدم للتصدير وللاختبارات التي تتحقق من أثر الجولات فعلاً.
 */
export function readSave(): SaveState {
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
// الإجراءات
// ═══════════════════════════════════════════════════════════════════════

export function updateProfile(patch: Partial<Pick<Profile, "name" | "avatar" | "title">>): void {
  commit({ ...state, profile: { ...state.profile, ...patch } });
}

/** يُعلن الإنجازات المفتوحة حديثاً (للاحتفال بها في الواجهة). */
export function evaluateAchievements(stats: Stats): { stats: Stats; unlocked: AchievementDef[] } {
  const unlocked: AchievementDef[] = [];
  let bonus = 0;
  for (const a of ACHIEVEMENTS) {
    if (stats.achievements.includes(a.id)) continue;
    let ok = false;
    try {
      ok = a.test(stats);
    } catch {
      ok = false;
    }
    if (ok) {
      unlocked.push(a);
      bonus += a.reward;
    }
  }
  if (unlocked.length === 0) return { stats, unlocked };
  return {
    stats: {
      ...stats,
      achievements: [...stats.achievements, ...unlocked.map((u) => u.id)],
      coins: stats.coins + bonus,
    },
    unlocked,
  };
}

/**
 * ⚔️ منح عملات حقيقي لمحفظة اللاعب — يُستخدم في مكافآت التحدّيات التي
 * تحقّق منها الخادم. يعيد المقدار الممنوح فعلاً (0 إن كان الطلب غير صالح).
 */
export function grantCoins(amount: number): number {
  const safe = Math.max(0, Math.min(5000, Math.floor(Number.isFinite(amount) ? amount : 0)));
  if (safe <= 0) return 0;
  commit({ ...state, stats: { ...state.stats, coins: state.stats.coins + safe } });
  return safe;
}

/**
 * ⚔️ يبني أسئلة تحدٍّ حقيقي: بعدد أسئلة التحدّي وبصعوبته المُعلنة،
 * وبلا تكرار. وإن ضاق المجمّع يكمل من باقي الصعوبات — فلا تحدٍّ ناقص.
 */
export function buildChallengeQuestions(
  spec: { questionCount: number; difficulty: string },
  s: SaveState,
): OfflineQuestion[] {
  const wanted = Math.max(5, Math.min(30, Math.floor(spec.questionCount || 10)));
  const tiers: Record<string, string[]> = {
    easy: ["easy", "medium", "hard"],
    medium: ["medium", "hard", "easy"],
    hard: ["hard", "medium", "easy"],
    expert: ["hard", "medium", "easy"],
  };
  const order = tiers[spec.difficulty] ?? tiers.medium;
  const seen = new Set<string>();
  const out: OfflineQuestion[] = [];
  for (const diff of order) {
    if (out.length >= wanted) break;
    const pool = OFFLINE_BANK.filter((q) => q.difficulty === diff && !seen.has(q.id));
    // نبدأ من الأسئلة التي لم يلقّها اللاعب كثيراً — التحدّي يبقى جديداً
    const fresh = pool.filter((q) => (s.stats.categories[q.category]?.answered ?? 0) < 40);
    const source = fresh.length >= wanted - out.length ? fresh : pool;
    for (const q of shuffle(source)) {
      if (out.length >= wanted) break;
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isDailyDone(s: SaveState): boolean {
  return s.stats.lastDaily === todayKey();
}

/**
 * ينهي جولة: يحدّث كل الإحصاءات، يبني «العقل المتطور»، ويعيد الإنجازات الجديدة.
 * مكافآت العقل (خبرة/عملات) تُطبَّق فعلاً على نتيجة الجولة لا على الشاشة فقط.
 */
export function finishSession(outcome: SessionOutcome): {
  unlocked: AchievementDef[];
  xpGained: number;
  /** تقرير العقل المتطور: ما الذي بنته هذه الجولة فعلاً */
  mind: MindSessionReport;
} {
  const { questions, answers } = outcome;
  // تأثيرات العقل تُقرأ **قبل** تسجيل الجولة — فالترقيات تنفع من الجولة التالية
  const perks = mindEffect(readMind());

  let correct = 0;
  let answeredCount = 0;
  let xpGained = 0;
  const categories: Record<string, CategoryStat> = { ...state.stats.categories };

  questions.forEach((q, i) => {
    const picked = answers[i];
    const cat = q.category;
    const cur = categories[cat] ?? { answered: 0, correct: 0 };
    // سؤال انتهى وقته أو لم يُلمس (‎-1) لا يُحتسب «مُجاباً» — وإلا هبطت
    // دقة اللاعب بغير ذنبٍ منه، وهو ما يخالف منطق الفئات أدناه.
    const answered = picked !== undefined && picked >= 0;
    const isCorrect = answered && q.correctIndex === picked;
    categories[cat] = {
      answered: cur.answered + (answered ? 1 : 0),
      correct: cur.correct + (isCorrect ? 1 : 0),
    };
    if (answered) answeredCount += 1;
    if (isCorrect) {
      correct += 1;
      xpGained += q.reward;
    }
  });

  const total = questions.length;
  // مكافأة السلسلة: تُحتسب من أفضل سلسلة محقّقة في الجولة
  const streakBonus = Math.round(outcome.bestStreak * 15);
  // مكافأة الإتقان: جولة كاملة بلا خطأ
  const perfect = total > 0 && correct === total;
  const perfectBonus = perfect ? 250 : 0;
  const dailyBonus = outcome.mode === "daily" ? 400 : 0;
  const duelBonus = outcome.mode === "duel" && correct > total / 2 ? 300 : 0;

  xpGained += streakBonus + perfectBonus + dailyBonus + duelBonus;
  // مكافأة العقل: تُطبَّق على خبرة الجولة (مقيسة لا معلنة)
  xpGained = Math.round(xpGained * (1 + perks.xpPct / 100));
  const coinGain = Math.round((outcome.score / 8) * (1 + perks.coinsPct / 100));

  const isDaily = outcome.mode === "daily";
  let dailyStreak = state.stats.dailyStreak;
  let lastDaily = state.stats.lastDaily;
  if (isDaily) {
    const today = todayKey();
    if (lastDaily !== today) {
      const yesterday = todayKey(new Date(Date.now() - 86_400_000));
      dailyStreak = lastDaily === yesterday ? dailyStreak + 1 : 1;
      lastDaily = today;
    }
  }

  const record: MatchRecord = {
    at: Date.now(),
    mode: outcome.mode,
    score: outcome.score,
    correct,
    total,
    bestStreak: outcome.bestStreak,
    label: outcome.label,
  };

  const nextStats: Stats = {
    ...state.stats,
    xp: state.stats.xp + xpGained,
    coins: state.stats.coins + coinGain,
    answered: state.stats.answered + answeredCount,
    correct: state.stats.correct + correct,
    bestStreak: Math.max(state.stats.bestStreak, outcome.bestStreak),
    perfectRuns: state.stats.perfectRuns + (perfect ? 1 : 0),
    matches: state.stats.matches + 1,
    duelWins: state.stats.duelWins + (outcome.mode === "duel" && correct > total / 2 ? 1 : 0),
    dailyStreak,
    lastDaily,
    categories,
    history: [record, ...state.stats.history].slice(0, 60),
  };

  const { stats: evaluated, unlocked } = evaluateAchievements(nextStats);

  // بناء العقل المتطور من هذه الجولة (قوى + تخصصات + إتقان مجالات حقيقي)
  const mind = recordMindSession({
    mode: outcome.mode,
    questions,
    answers,
    timesMs: outcome.timesMs,
    timerSeconds: outcome.timerSeconds ?? 20,
    bestStreak: outcome.bestStreak,
    perfect,
    domains: categories,
  });

  // مكافآت الإتقان تُضاف للعملات (لا تتأثر بنسبة العقل — مكافأة ثابتة)
  const finalStats: Stats =
    mind.masteryCoins > 0 ? { ...evaluated, coins: evaluated.coins + mind.masteryCoins } : evaluated;

  // ترقية الرتبة تلقائياً إن ارتقى المستوى وظلّت الرتبة الحالية متأخرة
  const titles = unlockedTitles(finalStats.xp);
  const profile =
    titles.length > 0 && !titles.includes(state.profile.title)
      ? { ...state.profile, title: titles[titles.length - 1] }
      : state.profile;

  commit({ ...state, profile, stats: finalStats });
  return { unlocked, xpGained, mind };
}

export function resetAll(): void {
  resetEvolvedMind();
  commit(defaultState());
}

// ═══════════════════════════════════════════════════════════════════════
// لوحة التصنيف المحلية — خصوم بنقاط ثابتة تتقدّم يومياً
// ═══════════════════════════════════════════════════════════════════════

const RIVALS: { name: string; avatar: string; base: number; growth: number }[] = [
  { name: "ظل العقول", avatar: "🐉", base: 5200, growth: 190 },
  { name: "النابغة", avatar: "🦉", base: 4700, growth: 170 },
  { name: "عاصفة الذكاء", avatar: "⚡", base: 4250, growth: 150 },
  { name: "قنّاص المنطق", avatar: "🎯", base: 3800, growth: 135 },
  { name: "الجبل", avatar: "🦁", base: 3400, growth: 120 },
  { name: "الحكيم الصامت", avatar: "🧠", base: 3000, growth: 110 },
  { name: "ذئب المحيط", avatar: "🐺", base: 2650, growth: 100 },
  { name: "المتحدّي", avatar: "🐺", base: 2300, growth: 90 },
  { name: "الصاعد", avatar: "🦅", base: 1950, growth: 80 },
  { name: "المبتدئ الواعد", avatar: "🚀", base: 1500, growth: 65 },
];

function hashCode(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** قوة العقل: مقياس واحد يجمع خبرتك وسلاسلك وجولاتك المثالية. */
export function mindPower(s: Stats): number {
  return Math.round(s.xp * 0.6 + s.bestStreak * 45 + s.perfectRuns * 120 + s.matches * 25);
}

export interface RankRow {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isYou: boolean;
  /** مقدار ما يلزم لتجاوز من فوقك (فارغ لمن هو في القمة) */
  gapToNext?: number;
}

/** يبني لوحة ترتيب حيّة: خصوم ثابتون يتقدّمون يومياً + ترتيبك الحقيقي. */
export function leaderboard(s: SaveState): RankRow[] {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const rows: RankRow[] = RIVALS.map((r) => {
    const jitter = hashCode(r.name) % 240;
    return {
      id: r.name,
      name: r.name,
      avatar: r.avatar,
      score: Math.round(r.base + r.growth * dayIndex * 0.35 + jitter),
      isYou: false,
    };
  });
  rows.push({ id: "you", name: s.profile.name || "أنت", avatar: s.profile.avatar, score: mindPower(s.stats), isYou: true });
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, gapToNext: i > 0 ? rows[i - 1].score - r.score + 1 : undefined }));
}

export function myRank(s: SaveState): { rank: number; total: number; row: RankRow } {
  const rows = leaderboard(s);
  const idx = rows.findIndex((r) => r.isYou);
  return { rank: idx + 1, total: rows.length, row: rows[idx] };
}

// ═══════════════════════════════════════════════════════════════════════
// اختيار الأسئلة — تكيّفي مع أداء اللاعب (بلا خادم)
// ═══════════════════════════════════════════════════════════════════════

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function withShuffledOptions(
  q: OfflineQuestion,
  rnd: () => number = Math.random,
): { options: string[]; correctIndex: number } {
  const pairs = q.options.map((text, i) => ({ text, correct: i === q.correctIndex }));
  const mixed = shuffle(pairs, rnd);
  return {
    options: mixed.map((p) => p.text),
    correctIndex: mixed.findIndex((p) => p.correct),
  };
}

/** كل الفئات المتاحة في البنك، مرتّبة بحسب كثرة الأسئلة. */
export const CATEGORIES: { name: string; count: number }[] = (() => {
  const map = new Map<string, number>();
  for (const q of OFFLINE_BANK) map.set(q.category, (map.get(q.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
})();

/** دقة اللاعب في فئة معيّنة (0-1)، أو null إن لم يلعبها بعد. */
export function categoryAccuracy(s: SaveState, category: string): number | null {
  const c = s.stats.categories[category];
  if (!c || c.answered < 3) return null;
  return c.correct / c.answered;
}

/** الصعوبة المستهدفة بحسب المستوى: ترتفع مع التقدّم. */
function targetDifficulties(level: number): OfflineQuestion["difficulty"][] {
  if (level <= 2) return ["easy", "easy", "medium"];
  if (level <= 5) return ["easy", "medium", "medium"];
  if (level <= 10) return ["medium", "medium", "hard"];
  return ["medium", "hard", "hard"];
}

function weightedPick(pool: OfflineQuestion[], s: SaveState): OfflineQuestion {
  // ترجيح: الفئات الضعيفة تُسحب أكثر (ذكاء تكيّفي حقيقي بلا خادم)
  const weights = pool.map((q) => {
    const acc = categoryAccuracy(s, q.category);
    if (acc === null) return 1.6; // فئة جديدة = استكشاف
    return 0.5 + (1 - acc) * 2.5; // كلما ضعفت، ارتفع الترجيح
  });
  const totalW = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalW;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** يبني قائمة أسئلة جولة كاملة (بلا تكرار) بحسب النمط. */
export function buildQuestions(mode: ModeId, s: SaveState, opts: { category?: string } = {}): OfflineQuestion[] {
  const { level } = levelInfo(s.stats.xp);

  if (mode === "daily") {
    // تحدٍّ يومي ثابت للجميع في نفس اليوم: بذر مشتق من التاريخ
    const rnd = mulberry32(hashCode(todayKey()));
    const full = shuffle(OFFLINE_BANK, rnd);
    const picked: OfflineQuestion[] = [];
    const seenCat = new Set<string>();
    for (const q of full) {
      if (picked.length >= 12) break;
      // تنويع: نتخطّى تكرار نفس الفئة في أول ٨ أسئلة
      if (seenCat.has(q.category) && picked.length < 8) continue;
      seenCat.add(q.category);
      picked.push(q);
    }
    return picked.length >= 12 ? picked.slice(0, 12) : shuffle(OFFLINE_BANK, rnd).slice(0, 12);
  }

  if (mode === "category" && opts.category) {
    const pool = OFFLINE_BANK.filter((q) => q.category === opts.category);
    return shuffle(pool).slice(0, Math.min(10, pool.length));
  }

  const wanted = mode === "marathon" ? 25 : mode === "duel" ? 10 : 10;
  const diffs = targetDifficulties(level);
  const used = new Set<string>();
  const out: OfflineQuestion[] = [];

  // 1) زيارة صريحة للفئات الضعيفة — يبدأ اللاعب بأضعف ما لديه
  const weak = CATEGORIES.filter((c) => {
    const acc = categoryAccuracy(s, c.name);
    return acc !== null && acc < 0.7;
  }).slice(0, 3);
  for (const w of weak) {
    if (out.length >= wanted) break;
    const pool = OFFLINE_BANK.filter((q) => q.category === w.name && !used.has(q.id));
    const q = weightedPick(pool, s);
    if (q) {
      out.push(q);
      used.add(q.id);
    }
  }

  // 2) استكمال الجولة: صعوبة موائمة + ترجيح الفئات الضعيفة
  let guard = 0;
  while (out.length < wanted && guard < 600) {
    guard += 1;
    const wantDiff = diffs[out.length % diffs.length];
    const pool = OFFLINE_BANK.filter((q) => q.difficulty === wantDiff && !used.has(q.id));
    if (pool.length === 0) break;
    const q = weightedPick(pool, s);
    out.push(q);
    used.add(q.id);
  }

  return out;
}

/** أقوى ٥ أسئلة من بنك اللعبة (للعرض الترويجي في الواجهة). */
export function sampleQuestions(n = 5): OfflineQuestion[] {
  return shuffle(OFFLINE_BANK).slice(0, n);
}

export const BANK_SIZE = OFFLINE_BANK.length;
