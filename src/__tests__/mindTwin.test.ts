import { describe, expect, it } from "vitest";
import { TWIN_MIN_SAMPLE, fairDifficulty } from "@/convex/mindTwin";

/**
 * 🧬 اختبارات منطق التوأم الذهني النقي.
 * القاعدة الحاكمة: الصعوبة تُشتقّ من دقة اللاعب الفعلية — لا تُختار اعتباطاً.
 */
describe("fairDifficulty — صعوبة عادلة من دقة حقيقية", () => {
  it("دقة ضعيفة ⇒ سهل", () => {
    expect(fairDifficulty(0)).toBe("easy");
    expect(fairDifficulty(44.9)).toBe("easy");
  });

  it("الحدود تُصنَّف تصنيفاً متصاعداً بلا فجوات", () => {
    expect(fairDifficulty(45)).toBe("medium");
    expect(fairDifficulty(64.9)).toBe("medium");
    expect(fairDifficulty(65)).toBe("hard");
    expect(fairDifficulty(81.9)).toBe("hard");
    expect(fairDifficulty(82)).toBe("expert");
    expect(fairDifficulty(100)).toBe("expert");
  });

  it("لا صعوبة أعلى مع دقة أقل — الرتابة محفوظة", () => {
    const order = { easy: 0, medium: 1, hard: 2, expert: 3 } as const;
    let prev = -1;
    for (let acc = 0; acc <= 100; acc += 5) {
      const rank = order[fairDifficulty(acc)];
      expect(rank).toBeGreaterThanOrEqual(prev);
      prev = rank;
    }
  });
});

describe("TWIN_MIN_SAMPLE — عتبة القياس الصادقة", () => {
  it("لا نحكم على فئة بأقل من ثلاث إجابات", () => {
    expect(TWIN_MIN_SAMPLE).toBeGreaterThanOrEqual(3);
  });
});
