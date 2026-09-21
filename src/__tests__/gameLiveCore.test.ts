import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_MIN_SAMPLE,
  buildLiveRows,
  planTail,
  predictNext,
  recommendDifficulty,
  worthRetuning,
  type LivePlayerInput,
} from "@/convex/gameLiveCore";

const q = (correct: boolean, elapsedMs = 4000) => ({ correct, elapsedMs });
const player = (over: Partial<LivePlayerInput> = {}): LivePlayerInput => ({
  userId: "u1",
  name: "لاعب",
  score: 0,
  streak: 0,
  answers: [],
  ...over,
});

describe("buildLiveRows — لا رقم بلا إجابة مسجّلة", () => {
  it("يتجاهل الفجوات (null) ولا يحسبها خطأً", () => {
    const rows = buildLiveRows([player({ answers: [q(true), null, null] })]);
    expect(rows[0].answered).toBe(1);
    expect(rows[0].correct).toBe(1);
    expect(rows[0].wrong).toBe(0);
    expect(rows[0].accuracy).toBe(100);
  });

  it("الدقّة والأزمنة محسوبة من الإجابات الحقيقية فقط", () => {
    const rows = buildLiveRows([player({ answers: [q(true, 2000), q(false, 6000), q(true, 4000)] })]);
    expect(rows[0].answered).toBe(3);
    expect(rows[0].correct).toBe(2);
    expect(rows[0].wrong).toBe(1);
    expect(rows[0].accuracy).toBeCloseTo(66.7, 1);
    expect(rows[0].avgMs).toBe(4000);
    expect(rows[0].fastestMs).toBe(2000);
  });

  it("ترتيب النقاط وترتيب السرعة حقيقيان", () => {
    const rows = buildLiveRows([
      player({ userId: "a", name: "أ", score: 300, answers: [q(true, 9000)] }),
      player({ userId: "b", name: "ب", score: 700, answers: [q(true, 3000)] }),
      player({ userId: "c", name: "ج", score: 500, answers: [] }),
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.userId, r]));
    expect(byId.b.rank).toBe(1);
    expect(byId.c.rank).toBe(2);
    expect(byId.a.rank).toBe(3);
    expect(byId.b.speedRank).toBe(1);
    expect(byId.a.speedRank).toBe(2);
    expect(byId.c.speedRank).toBe(0);
  });

  it("الاتجاه (momentum) يعكس الأداء القريب فعلاً", () => {
    const improving = buildLiveRows([
      player({ answers: [q(false), q(false), q(false), q(false), q(false), q(true), q(true), q(true), q(true), q(true)] }),
    ]);
    const declining = buildLiveRows([
      player({ answers: [q(true), q(true), q(true), q(true), q(true), q(false), q(false), q(false), q(false), q(false)] }),
    ]);
    expect(improving[0].momentum).toBeGreaterThan(0);
    expect(declining[0].momentum).toBeLessThan(0);
  });

  it("غرفة بلا لاعبين أو بلا إجابات لا تُنتج أرقاماً مُختلقة", () => {
    expect(buildLiveRows([])).toEqual([]);
    const rows = buildLiveRows([player()]);
    expect(rows[0].accuracy).toBe(0);
    expect(rows[0].avgMs).toBe(0);
    expect(rows[0].fastestMs).toBe(0);
  });
});

describe("predictNext — تنعيم صادق لا تخمين", () => {
  it("بلا إجابات يبقى في المنطقة المحيّدة", () => {
    const p = predictNext(buildLiveRows([player()])[0]);
    expect(p.probability).toBeCloseTo(50, 0);
    expect(p.confidence).toBe(0);
    expect(p.label).toBe("لم يُقَس بعد");
  });

  it("دقّة أعلى ⇒ احتمال أعلى، ودقّة أدنى ⇒ احتمال أدنى", () => {
    const good = predictNext(buildLiveRows([player({ answers: Array.from({ length: 8 }, () => q(true)) })])[0]);
    const bad = predictNext(buildLiveRows([player({ answers: Array.from({ length: 8 }, () => q(false)) })])[0]);
    expect(good.probability).toBeGreaterThan(bad.probability);
    expect(good.probability).toBeLessThan(100);
    expect(bad.probability).toBeGreaterThan(0);
  });

  it("الثقة تزيد بحجم العيّنة ولا تتجاوز ١٠٠", () => {
    const tiny = predictNext(buildLiveRows([player({ answers: [q(true)] })])[0]);
    const many = predictNext(buildLiveRows([player({ answers: Array.from({ length: 40 }, () => q(true)) })])[0]);
    expect(many.confidence).toBeGreaterThan(tiny.confidence);
    expect(many.confidence).toBeLessThanOrEqual(100);
  });

  it("الزمن المتوقّع مشتقّ من زمن اللاعب الفعلي", () => {
    const p = predictNext(buildLiveRows([player({ answers: [q(true, 5000), q(true, 5000)] })])[0]);
    expect(p.expectedMs).toBeGreaterThan(0);
    expect(Math.abs(p.expectedMs - 5000)).toBeLessThan(1000);
  });
});

describe("recommendDifficulty — القرار من دقّة الغرفة", () => {
  it("عيّنة صغيرة ⇒ لا مخاطرة، مع سبب مكتوب", () => {
    const call = recommendDifficulty(buildLiveRows([player({ answers: [q(true)] })]));
    expect(call.sample).toBeLessThan(ADAPTIVE_MIN_SAMPLE);
    expect(call.difficulty).toBe("medium");
    expect(call.hardRatio).toBe(0.2);
    expect(call.reason.length).toBeGreaterThan(10);
  });

  it("دقّة عالية ⇒ أسئلة أصعب بكثير", () => {
    const strong = buildLiveRows([player({ answers: Array.from({ length: 12 }, () => q(true)) })]);
    const call = recommendDifficulty(strong);
    expect(call.difficulty).toBe("hard");
    expect(call.hardRatio).toBeGreaterThanOrEqual(0.4);
  });

  it("دقّة ضعيفة ⇒ تخفيف حقيقي", () => {
    const weak = buildLiveRows([
      player({ userId: "a", answers: [q(false), q(false), q(false), q(false)] }),
      player({ userId: "b", answers: [q(true), q(false), q(false), q(false)] }),
    ]);
    const call = recommendDifficulty(weak);
    expect(call.difficulty).toBe("easy");
    expect(call.hardRatio).toBeLessThan(0.2);
  });

  it("نسبة الصعب لا تنقص حين ترتفع الدقّة (رتابة القرار)", () => {
    let prev = 0;
    for (const hits of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      const rows = buildLiveRows([
        player({ answers: Array.from({ length: 8 }, (_, i) => q(i < hits)) }),
      ]);
      const call = recommendDifficulty(rows);
      expect(call.hardRatio).toBeGreaterThanOrEqual(prev);
      prev = call.hardRatio;
    }
  });

  it("لا يوصي أبداً بنسبة صعب خارج المدى المعقول", () => {
    for (const hits of [0, 3, 6, 12]) {
      const rows = buildLiveRows([player({ answers: Array.from({ length: 12 }, (_, i) => q(i < hits)) })]);
      const call = recommendDifficulty(rows);
      expect(call.hardRatio).toBeGreaterThanOrEqual(0);
      expect(call.hardRatio).toBeLessThanOrEqual(0.6);
      expect(["easy", "medium", "hard"]).toContain(call.difficulty);
    }
  });
});

describe("planTail — لا نلمس سؤالاً مُجاباً عنه أبداً", () => {
  it("الذيل يبدأ بعد السؤال الحالي", () => {
    const plan = planTail(10, 3);
    expect(plan.tailStart).toBe(4);
    expect(plan.tailCount).toBe(6);
    expect(plan.shouldRetune).toBe(true);
  });

  it("لا يعدّل عند نهاية الجولة", () => {
    expect(planTail(10, 9).shouldRetune).toBe(false);
    expect(planTail(10, 8).shouldRetune).toBe(false);
    expect(planTail(10, 8).why.length).toBeGreaterThan(5);
  });

  it("يتحمّل فهرساً خارج المدى بلا انفجار", () => {
    expect(planTail(0, 0).tailCount).toBe(0);
    expect(planTail(5, 99).tailCount).toBe(0);
    expect(planTail(5, -3).tailStart).toBe(0);
  });
});

describe("worthRetuning — يمنع التبديل العبثي", () => {
  it("أول ضبط دائماً يستحق", () => {
    const call = recommendDifficulty(buildLiveRows([player()]));
    expect(worthRetuning(null, call)).toBe(true);
  });

  it("تغيير التصنيف يستحق، والفرق الطفيف لا", () => {
    const same = recommendDifficulty(buildLiveRows([player()]));
    expect(worthRetuning({ difficulty: "medium", hardRatio: 0.2 }, same)).toBe(false);
    expect(worthRetuning({ difficulty: "medium", hardRatio: 0.2 }, { ...same, difficulty: "hard" })).toBe(true);
    expect(worthRetuning({ difficulty: "medium", hardRatio: 0.2 }, { ...same, hardRatio: 0.35 })).toBe(true);
  });
});
