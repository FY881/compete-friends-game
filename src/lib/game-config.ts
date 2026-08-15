/**
 * Client-side mirror of the server game constants in `src/convex/gameConfig.ts`.
 * Keep the values in sync when tuning the game.
 */
export const ANSWER_MS = 15_000; // how long players have to answer a question
export const REVEAL_MS = 5_000; // how long the correct answer stays on screen
export const COUNTDOWN_MS = 3_000; // 3-2-1 countdown before the first question
export const QUESTION_COUNT = 5;
export const MAX_PLAYERS = 12;
export const LIFELINES_PER_GAME = 1;

export const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10] as const;
export const TIME_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000] as const;

export function formatTimeOption(ms: number): string {
  return `${ms / 1000} ثوانٍ`;
}

export function formatTimeMs(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${seconds} ث`;
}
