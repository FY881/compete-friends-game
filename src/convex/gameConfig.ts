/**
 * Shared constants that drive game pacing, scoring and progression.
 * The client mirrors the values it needs in `src/lib/game-config.ts`.
 */
import type { Difficulty } from "./questions";

export const CODE_LENGTH = 6;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_NAME_LENGTH = 24;
export const MAX_PLAYERS = 12;

// ── Room settings (chosen by the host in the lobby) ──────────────────────
export const QUESTION_COUNT = 5; // default questions per game
export const ANSWER_MS = 15_000; // default answer window
export const REVEAL_MS = 5_000; // how long the correct answer stays on screen
export const COUNTDOWN_MS = 3_000; // 3-2-1 countdown before the first question

export const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10] as const;
export const TIME_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000] as const; // 5s = "blitz"

// ── Timed rounds («مدة الجولة») ─────────────────────────────────────
// When the host picks a duration instead of a question count, the round runs
// on the clock: questions keep flowing until the time budget is used up.
// `0` = classic mode (round ends after `questionCount` questions).
export const DURATION_MODE_OFF = 0;
export const DURATION_OPTIONS = [5, 10, 15] as const; // minutes
export const MINUTE_MS = 60_000;

/**
 * How many questions a timed round should pre-pick so the game never runs
 * dry before the clock does: every question cycle takes roughly
 * `timePerQuestionMs` (answer) + `REVEAL_MS` (reveal), + a small buffer.
 * Capped so the room row stays light.
 */
export function timedPoolSize(minutes: number, timePerQuestionMs: number): number {
  if (!minutes || minutes <= 0) return 0;
  const cycleMs = Math.max(1, timePerQuestionMs + REVEAL_MS);
  const needed = Math.ceil((minutes * MINUTE_MS) / cycleMs) + 4; // buffer for countdown/joins
  return Math.min(Math.max(needed, 3), 100);
}

export const LIFELINES_PER_GAME = 1; // 50/50 uses per player per game

// ── Bonus systems ────────────────────────────────────────────────────────
// The first player to answer a question correctly earns a bonus on top of
// their normal points, rewarding speed over guessing.
export const FIRST_BLOOD_BONUS = 50;
// The last question of a round is the "golden question": all points are
// doubled, so the comeback is always alive until the final second.
export const GOLDEN_QUESTION_MULTIPLIER = 2;
// Winning margin needed for the "blowout" badge (2nd place at least this far).
export const BLOWOUT_MARGIN = 200;
// Maximum simultaneously active rooms a single player may own.
export const MAX_ACTIVE_ROOMS = 3;

// ── Scoring by difficulty ────────────────────────────────────────────────
// A correct answer earns the base points plus a speed bonus scaled by how
// much of the answer window was left when the player answered.
export const DIFFICULTY_BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 150,
  hard: 200,
};
export const DIFFICULTY_SPEED_BONUS: Record<Difficulty, number> = {
  easy: 100,
  medium: 140,
  hard: 180,
};

// ── Streaks ──────────────────────────────────────────────────────────────
// Consecutive correct answers stack a small bonus on top of the question
// points, capped so streaks stay fair.
export const STREAK_BONUS_PER_STEP = 20;
export const MAX_STREAK_BONUS = 100;

// ── XP economy (profiles & levels) ───────────────────────────────────────
export const XP_PER_GAME = 20;
export const XP_PER_CORRECT_ANSWER = 10;
export const XP_FOR_WIN = 30;
export const XP_FOR_STREAK_3 = 15;
export const XP_FOR_STREAK_5 = 25;
export const XP_PERFECT_GAME = 20;

export const FAST_ANSWER_MS = 3_000; // answers under this count for the "fast hand" badge

// ── Daily rewards («المكافأة اليومية») ──────────────────────────────────
// Claiming the daily reward builds a login streak: each day grants base XP
// plus a step per streak day, capped. Playing the first game of a day also
// grants a small bonus and feeds the same streak calendar.
export const DAILY_XP_BASE = 30;
export const DAILY_XP_STEP = 10;
export const DAILY_XP_CAP = 150;
export const FIRST_GAME_OF_DAY_XP = 30;

/** Day key (YYYY-MM-DD, UTC) used to compare calendar days for streaks. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function dailyRewardXp(streak: number): number {
  return Math.min(DAILY_XP_BASE + (streak - 1) * DAILY_XP_STEP, DAILY_XP_CAP);
}

/** Cumulative XP required to *reach* a given level (level 1 starts at 0). */
export function xpToReachLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpToReachLevel(level + 1)) {
    level += 1;
  }
  return Math.min(level, 100);
}

/** Human titles shown next to a player's level. */
export function levelTitle(level: number): string {
  if (level >= 60) return "إمبراطور العقول";
  if (level >= 45) return "فيلسوف العقول";
  if (level >= 30) return "أسطورة حية";
  if (level >= 21) return "أسطورة";
  if (level >= 16) return "نابغة";
  if (level >= 11) return "عبقري";
  if (level >= 8) return "ذكي";
  if (level >= 5) return "متعلم";
  if (level >= 3) return "واعد";
  return "مبتدئ";
}
