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

export const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10] as const;
export const TIME_OPTIONS = [10_000, 15_000, 20_000, 30_000] as const;

export const LIFELINES_PER_GAME = 1; // 50/50 uses per player per game

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
  if (level >= 21) return "فيلسوف العقول";
  if (level >= 16) return "أسطورة";
  if (level >= 11) return "نابغة";
  if (level >= 8) return "عبقري";
  if (level >= 5) return "ذكي";
  if (level >= 3) return "متعلم";
  return "مبتدئ";
}
