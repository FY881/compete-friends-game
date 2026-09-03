import { describe, it, expect } from "vitest";
import {
  categoryBreakdown,
  difficultyBreakdown,
  buildActivityTrend,
  buildInsights,
  DIFFICULTY_LABELS,
} from "@/lib/analytics";
import type { AnswerSample } from "@/lib/analytics";

const SAMPLES: AnswerSample[] = [
  { category: "علوم", difficulty: "easy", wasCorrect: true },
  { category: "علوم", difficulty: "easy", wasCorrect: false },
  { category: "علوم", difficulty: "medium", wasCorrect: true },
  { category: "رياضيات", difficulty: "hard", wasCorrect: true },
  { category: "رياضيات", difficulty: "hard", wasCorrect: false },
  { category: "رياضيات", difficulty: "hard", wasCorrect: false },
  { category: "تاريخ", difficulty: "medium", wasCorrect: true },
];

describe("categoryBreakdown", () => {
  it("يجمع حسب التصنيف مع دقة صحيحة", () => {
    const rows = categoryBreakdown(SAMPLES);
    const علوم = rows.find((r) => r.key === "علوم");
    const رياضيات = rows.find((r) => r.key === "رياضيات");
    expect(علوم?.total).toBe(3);
    expect(علوم?.correct).toBe(2);
    expect(علوم?.accuracy).toBe(67); // 2/3 → 66.66 → 67
    expect(رياضيات?.total).toBe(3);
    expect(رياضيات?.accuracy).toBe(33); // 1/3
  });

  it("يرتب تنازلياً حسب عدد الإجابات", () => {
    const rows = categoryBreakdown(SAMPLES);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].total).toBeGreaterThanOrEqual(rows[i].total);
    }
  });
});

describe("difficultyBreakdown", () => {
  it("يحافظ على ترتيب سهولة ثم متوسط ثم صعب", () => {
    const rows = difficultyBreakdown(SAMPLES);
    expect(rows.map((r) => r.key)).toEqual(["easy", "medium", "hard"]);
    expect(rows[0].accuracy).toBe(50); // easy 1/2
  });

  it("يتجاهل الصعوبات غير المعروفة", () => {
    const rows = difficultyBreakdown([
      ...SAMPLES,
      { category: "عام", difficulty: "expert", wasCorrect: true },
    ]);
    expect(rows.some((r) => r.key === "expert")).toBe(false);
  });
});

describe("DIFFICULTY_LABELS", () => {
  it("يسمّي المستويات بالعربية", () => {
    expect(DIFFICULTY_LABELS.easy).toBe("سهل");
    expect(DIFFICULTY_LABELS.medium).toBe("متوسط");
    expect(DIFFICULTY_LABELS.hard).toBe("صعب");
  });
});

describe("buildActivityTrend", () => {
  it("يملأ آخر N أيام حتى اليوم ويجمع القيم في الخلايا الصحيحة", () => {
    const now = Date.UTC(2026, 0, 10, 15, 0); // السبت 10 يناير 2026
    const trend = buildActivityTrend(
      [
        { playedAt: now - 24 * 60 * 60 * 1000, correctCount: 5, xpEarned: 80 }, // 9 يناير
        { playedAt: now, correctCount: 8, xpEarned: 120 }, // 10 يناير
        { playedAt: now - 8 * 24 * 60 * 60 * 1000, correctCount: 9, xpEarned: 200 }, // خارج النافذة
      ],
      7,
      now,
    );
    expect(trend).toHaveLength(7);
    expect(trend[6].day).toBe("2026-01-10");
    expect(trend[6].games).toBe(1);
    expect(trend[6].correct).toBe(8);
    expect(trend[6].xp).toBe(120);
    expect(trend[5].xp).toBe(80);
    expect(trend[0].games).toBe(0);
    const totalXp = trend.reduce((s, d) => s + d.xp, 0);
    expect(totalXp).toBe(200); // خارج النافذة لم يُحتسب
  });
});

describe("buildInsights", () => {
  it("يشجع اللاعب الجديد بلا إجابات", () => {
    const insights = buildInsights({
      answered: 0,
      accuracy: 0,
      totalGames: 0,
      wins: 0,
      bestStreak: 0,
      categories: [],
    });
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(insights[0]).toContain("أول جولة");
  });

  it("يمدح الدقة العالية ويذكر أضعف تصنيف", () => {
    const insights = buildInsights({
      answered: 60,
      accuracy: 82,
      totalGames: 20,
      wins: 12,
      bestStreak: 9,
      categories: [
        { key: "علوم", total: 40, correct: 36, accuracy: 90 },
        { key: "تاريخ", total: 20, correct: 10, accuracy: 50 },
      ],
    });
    const joined = insights.join("\n");
    expect(joined).toContain("ممتاز");
    expect(joined).toContain("تاريخ");
    expect(joined).toContain("سلسلة");
  });

  it("لا يتجاوز 5 رؤى", () => {
    const insights = buildInsights({
      answered: 200,
      accuracy: 55,
      totalGames: 40,
      wins: 20,
      bestStreak: 7,
      categories: [
        { key: "أ", total: 60, correct: 30, accuracy: 50 },
        { key: "ب", total: 40, correct: 25, accuracy: 63 },
        { key: "ج", total: 40, correct: 28, accuracy: 70 },
        { key: "د", total: 60, correct: 30, accuracy: 50 },
      ],
    });
    expect(insights.length).toBeLessThanOrEqual(5);
  });
});
