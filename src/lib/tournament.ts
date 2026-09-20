/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 بطولة السلطان — القوس الإقصائي المحلي (Sultan's Tournament)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * توسعة جوهرية للساحة المحلية: قوس إقصائي من **٨ جولات** ضد خصوم ذكاء
 * يتصاعد قوّتهم جولة بعد جولة، مع **معركتي زعيم** (الجولة ٤ و٨) تُحسم
 * بعدّاد أقصر. الجولة الواحدة = ٥ أسئلة نزال مباشر (نقاطك ضد نقاطه).
 *
 * القوانين الحقيقية:
 *   • خسارة جولة = إقصاء من البطولة (تحتفظ بمكافآت الجولات المُجزوزة).
 *   • كل جولة تُلعب بأسئلة **بلا تكرار داخل البطولة نفسها**.
 *   • الزعيم (مقام السلطان) يجيب بدقة ٨٥٪ ووقت ١٤ ثانية للسؤال.
 *   • تتوّج باللقب بفوز الجولة ٨ — يُحفظ تاريخ تتويجاتك للأبد.
 *
 * كل شيء يعمل أوفلاين تماماً: لا خادم، لا شبكة، لا حصة — تُحفظ حالة
 * القوس في localStorage وتبثّ للمكوّنات عبر useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";
import { OFFLINE_BANK, type OfflineQuestion } from "@/lib/offline-bank";

// ═══════════════════════════════════════════════════════════════════════
// الثوابت
// ═══════════════════════════════════════════════════════════════════════

export const TOTAL_ROUNDS = 8;
export const QUESTIONS_PER_ROUND = 5;
export const BOSS_ROUNDS = [4, 8];
export const BOSS_TIMER = 14;
export const NORMAL_TIMER = 20;

/** دقة خصم الجولة (تصاعد قاسٍ) — الزعيم النهائي ٨٥٪. */
export function rivalAccuracyForRound(round: number): number {
  if (round === TOTAL_ROUNDS) return 0.85;
  if (round === 4) return 0.72;
  return 0.5 + round * 0.04; // ج1: 54% … ج7: 78%
}

/** مكافأة الجولة (عملات) — تتضاعف تقريباً كل جولتين. */
export function roundPrize(round: number): number {
  return [150, 250, 400, 700, 1000, 1500, 2200, 4000][round - 1] ?? 100;
}

/** أسماء خصوم القوس — يُختار خصمك من صفوة اللوحة وقت خوض الجولة. */
const RIVAL_POOL = [
  { name: "فارس الصحراء", avatar: "🐺" },
  { name: "حكيم الأطلس", avatar: "🦉" },
  { name: "سيفان الحكماء", avatar: "🦅" },
  { name: "الوزير الماكر", avatar: "🐉" },
  { name: "قائد الرماح", avatar: "🦁" },
  { name: "نجم الشرق", avatar: "⚡" },
  { name: "ظل الفرعون", avatar: "🔥" },
  { name: "مقام السلطان", avatar: "👑" },
];

// ═══════════════════════════════════════════════════════════════════════
// الحالة والتخزين
// ═══════════════════════════════════════════════════════════════════════

export interface TournamentRival {
  name: string;
  avatar: string;
  accuracy: number;
  isBoss: boolean;
}

export interface TournamentState {
  v: 1;
  /** جولة البطولة الجارية (1-8) — 0 = لا بطولة نشطة */
  currentRound: number;
  /** معرّفات الأسئلة المستهلكة في هذه البطولة (منع التكرار) */
  usedQuestionIds: string[];
  /** مكافآت الجولات المجزوزة في البطولة الجارية */
  bankedCoins: number;
  /** خصوم القوس الثمانية (تُثبَّت عند بدء البطولة) */
  bracket: TournamentRival[];
  /** إحصاءات مجدّدة: عدد مرات التتويج وأفضل إنجاز */
  crowns: number;
  bestRun: number;
  /** سجل آخر ٥ بطولات */
  log: { at: number; reached: number; crowned: boolean }[];
}

const STORAGE_KEY = "mindclash.tournament.v1";

function emptyState(): TournamentState {
  return { v: 1, currentRound: 0, usedQuestionIds: [], bankedCoins: 0, bracket: [], crowns: 0, bestRun: 0, log: [] };
}

function load(): TournamentState {
  if (typeof localStorage === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TournamentState>;
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      usedQuestionIds: parsed.usedQuestionIds ?? [],
      bracket: parsed.bracket ?? [],
      log: parsed.log ?? [],
    };
  } catch {
    return emptyState();
  }
}

let state: TournamentState = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* التخزين ممتلئ — البطولة تعمل على أي حال */
  }
}

function commit(next: TournamentState): void {
  state = next;
  persist();
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* مستمع معطوب لا يُسقط النظام */
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): TournamentState => state;

/** يربط مكوّن البطولة بحالتها (تفاعلية كاملة). */
export function useTournament(): TournamentState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ═══════════════════════════════════════════════════════════════════════
// المنطق
// ═══════════════════════════════════════════════════════════════════════

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** خليط صعوبة الجولة: تصاعد قاسٍ مع ثقل «صعب» قرب النهاية. */
function difficultyMixForRound(round: number): OfflineQuestion["difficulty"][] {
  if (round >= 6) return ["hard", "hard", "hard", "hard", "hard"];
  if (round >= 4) return ["medium", "hard", "hard", "medium", "hard"];
  if (round >= 2) return ["easy", "medium", "medium", "hard", "medium"];
  return ["easy", "easy", "medium", "medium", "hard"];
}

/** يثبّت قوس ٨ خصوم — الزعيم في مكانه (الجولة ٤ و٨) بإحكام أعلى. */
function buildBracket(): TournamentRival[] {
  const names = shuffle(RIVAL_POOL.slice(0, TOTAL_ROUNDS - 1).concat());
  // نضمن أن «مقام السلطان» (الزعيم النهائي) هو خصم الجولة ٨ دائماً
  const rivals: TournamentRival[] = [];
  let nameIdx = 0;
  for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
    const isBoss = BOSS_ROUNDS.includes(round);
    const base = isBoss && round === TOTAL_ROUNDS
      ? RIVAL_POOL[RIVAL_POOL.length - 1]
      : { name: names[nameIdx]?.name ?? "منافق العقول", avatar: names[nameIdx]?.avatar ?? "🎭" };
    if (!isBoss || round !== TOTAL_ROUNDS) nameIdx += 1;
    rivals.push({
      name: base.name,
      avatar: base.avatar,
      accuracy: rivalAccuracyForRound(round),
      isBoss,
    });
  }
  return rivals;
}

/** يبدأ بطولة جديدة (أو يستبدل قوساً قديماً منتهياً). */
export function startTournament(): TournamentState {
  const next: TournamentState = {
    ...emptyState(),
    crowns: state.crowns,
    bestRun: state.bestRun,
    log: state.log,
    currentRound: 1,
    bracket: buildBracket(),
  };
  commit(next);
  return next;
}

/** أسئلة الجولة المطلوبة: صعوبة الجولة + بلا تكرار داخل البطولة. */
export function questionsForRound(round: number, usedIds: readonly string[]): OfflineQuestion[] {
  const used = new Set(usedIds);
  const mix = difficultyMixForRound(round);
  const out: OfflineQuestion[] = [];
  for (const diff of mix) {
    const pool = OFFLINE_BANK.filter((q) => q.difficulty === diff && !used.has(q.id));
    const pick = shuffle(pool)[0];
    if (pick) {
      out.push(pick);
      used.add(pick.id);
    }
  }
  // إن نقص البنك (نادراً): نكمل من أي صعوبة متاحة
  if (out.length < QUESTIONS_PER_ROUND) {
    for (const q of shuffle(OFFLINE_BANK)) {
      if (out.length >= QUESTIONS_PER_ROUND) break;
      if (!used.has(q.id)) {
        out.push(q);
        used.add(q.id);
      }
    }
  }
  return out;
}

export interface RoundResult {
  /** هل فزت الجولة (نقاطك > نقاط الخصم)؟ */
  won: boolean;
  /** مكافأة الجولة — تُمنح فقط عند الفوز */
  prize: number;
  crowned: boolean;
}

/** يُسوّى مصير الجولة: فوز = تقدّم + مكافأة، خسارة = إقصاء + أرشفة. */
export function settleRound(won: boolean): RoundResult {
  const round = state.currentRound;
  if (round <= 0 || round > TOTAL_ROUNDS) return { won: false, prize: 0, crowned: false };

  if (!won) {
    const reached = round - 1;
    const log = [{ at: Date.now(), reached, crowned: false }, ...state.log].slice(0, 5);
    commit({
      ...state,
      currentRound: 0,
      usedQuestionIds: [],
      bankedCoins: 0,
      bracket: [],
      bestRun: Math.max(state.bestRun, reached),
      log,
    });
    return { won: false, prize: 0, crowned: false };
  }

  const prize = roundPrize(round);
  const isFinal = round === TOTAL_ROUNDS;

  if (isFinal) {
    const log = [{ at: Date.now(), reached: TOTAL_ROUNDS, crowned: true }, ...state.log].slice(0, 5);
    commit({
      ...state,
      currentRound: 0,
      usedQuestionIds: [],
      bankedCoins: 0,
      bracket: [],
      crowns: state.crowns + 1,
      bestRun: TOTAL_ROUNDS,
      log,
    });
    return { won: true, prize, crowned: true };
  }

  commit({
    ...state,
    currentRound: round + 1,
    bankedCoins: state.bankedCoins + prize,
  });
  return { won: true, prize, crowned: false };
}

/** تسجيل معرّفات أسئلة الجولة (يُستدعى عند بدء الجولة). */
export function markQuestionsUsed(questions: readonly OfflineQuestion[]): void {
  if (state.currentRound <= 0) return;
  const ids = questions.map((q) => q.id);
  commit({ ...state, usedQuestionIds: [...state.usedQuestionIds, ...ids] });
}

/** زر التخلي: يُنهي البطولة ويحتفظ بالمُجزّز فقط. */
export function forfeitTournament(): void {
  if (state.currentRound <= 0) return;
  const reached = state.currentRound - 1;
  const log = [{ at: Date.now(), reached, crowned: false }, ...state.log].slice(0, 5);
  commit({
    ...state,
    currentRound: 0,
    usedQuestionIds: [],
    bankedCoins: 0,
    bracket: [],
    bestRun: Math.max(state.bestRun, reached),
    log,
  });
}

/** يصفّر كل حالة البطولة (بيانات الإحصاءات المجدّدة أيضاً) — للاختبارات والتصفير الشامل. */
export function resetTournamentState(): void {
  commit(emptyState());
}

/** لقب حسب عمق الوصول (للعرض في بطاقة البطولة). */
export function prestigeLabel(reached: number): string {
  if (reached >= TOTAL_ROUNDS) return "سلطان العقول 👑";
  if (reached >= 6) return "يزاول الحكم";
  if (reached >= 4) return "نبلاء البلاط";
  if (reached >= 2) return "فارس القصر";
  return "وافد جديد";
}
