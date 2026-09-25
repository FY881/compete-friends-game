export const DIFFICULTIES = ["easy", "medium", "hard", "extreme"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** أسماء عربية موحّدة تظهر في الخادم والواجهة. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
  extreme: "شبه مستحيل",
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * Converts legacy or malformed database values into a valid game tier.
 * Unknown values intentionally become medium rather than being presented as
 * an expert question without evidence.
 */
export function normalizeDifficulty(value: unknown): Difficulty {
  return isDifficulty(value) ? value : "medium";
}
