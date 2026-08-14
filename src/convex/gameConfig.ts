/**
 * Shared constants that drive game pacing and scoring.
 * The client mirrors these values in `src/lib/game-config.ts`.
 */
export const CODE_LENGTH = 6;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const QUESTION_COUNT = 5;
export const ANSWER_MS = 15_000; // how long players have to answer a question
export const REVEAL_MS = 5_000; // how long the correct answer stays on screen
export const BASE_POINTS = 100; // points for a correct answer
export const SPEED_BONUS = 100; // extra points scaled by remaining time
export const MAX_NAME_LENGTH = 24;
