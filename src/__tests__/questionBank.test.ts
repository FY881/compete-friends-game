import { describe, expect, it } from "vitest";
import { CATEGORIES, QUESTION_BANK } from "../convex/questions";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  isDifficulty,
  normalizeDifficulty,
} from "../lib/question-difficulty";

describe("Question bank integrity", () => {
  it("has a substantial bank", () => {
    expect(QUESTION_BANK.length).toBeGreaterThan(1000);
  });

  it("uses unique question ids", () => {
    const ids = new Set<string>();
    const duplicates: string[] = [];
    for (const q of QUESTION_BANK) {
      if (ids.has(q.id)) duplicates.push(q.id);
      ids.add(q.id);
    }
    expect(duplicates).toEqual([]);
  });

  it("has exactly 4 non-empty options per question", () => {
    for (const q of QUESTION_BANK) {
      expect(q.options, `options of ${q.id}`).toHaveLength(4);
      for (const option of q.options) {
        expect(typeof option).toBe("string");
        expect(option.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps correctIndex within the options range", () => {
    for (const q of QUESTION_BANK) {
      expect(
        q.correctIndex >= 0 && q.correctIndex <= 3,
        `correctIndex of ${q.id}`,
      ).toBe(true);
    }
  });

  it("uses official categories only", () => {
    for (const q of QUESTION_BANK) {
      expect(CATEGORIES, `category of ${q.id}`).toContain(q.category);
    }
  });

  it("has a non-empty question text", () => {
    for (const q of QUESTION_BANK) {
      expect(q.question.trim().length, `question text of ${q.id}`).toBeGreaterThan(0);
    }
  });
});

describe("Difficulty distribution", () => {
  it("covers all four difficulty tiers", () => {
    for (const d of DIFFICULTIES) {
      const count = QUESTION_BANK.filter((q) => q.difficulty === d).length;
      expect(count, `tier ${d} has questions`).toBeGreaterThan(0);
    }
  });

  it("keeps extreme as a rare tier", () => {
    const total = QUESTION_BANK.length;
    const extreme = QUESTION_BANK.filter((q) => q.difficulty === "extreme").length;
    expect(extreme).toBeGreaterThan(10);
    expect(extreme / total).toBeLessThan(0.1);
  });
});

describe("Difficulty helpers", () => {
  it("defines arabic labels for every tier", () => {
    for (const d of DIFFICULTIES) {
      expect(DIFFICULTY_LABELS[d].length).toBeGreaterThan(0);
    }
    expect(DIFFICULTY_LABELS.extreme).toBe("شبه مستحيل");
  });

  it("validates difficulty values", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("extreme")).toBe(true);
    expect(isDifficulty("very_hard")).toBe(false);
    expect(isDifficulty(null)).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
  });

  it("normalizes unknown values to medium", () => {
    expect(normalizeDifficulty("easy")).toBe("easy");
    expect(normalizeDifficulty("extreme")).toBe("extreme");
    expect(normalizeDifficulty("legacy-value")).toBe("medium");
    expect(normalizeDifficulty(undefined)).toBe("medium");
  });
});
