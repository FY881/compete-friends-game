/** Default number of questions per round. */
export const QUESTION_COUNT = 5;

/** Available question-count options for the host. */
export const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10] as const;

/** Answer window in milliseconds (15 seconds default). */
export const ANSWER_MS = 15_000;

/** 3-2-1 countdown before the first question. */
export const COUNTDOWN_MS = 3_000;

/** Available time-per-question options (ms). */
export const TIME_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000] as const;

/** Number of lifelines (50/50 + second chance) available per game. */
export const LIFELINES_PER_GAME = 1;

/** Format a millisecond duration into an Arabic-friendly label. */
export function formatTimeOption(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} ثانية`;
  const min = sec / 60;
  return `${min} ${min === 1 ? "دقيقة" : "دقائق"}`;
}
