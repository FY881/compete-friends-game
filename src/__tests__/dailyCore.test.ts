import { describe, expect, it } from "vitest";
import {
  DAILY_BADGES,
  DAILY_MAX_XP,
  DAILY_MIN_ANSWER_MS,
  DAILY_QUESTION_COUNT,
  DAILY_TIME_FORGERY_MS,
  answerScore,
  badgesForDaily,
  compareDailyBoards,
  dailyStreak,
  dailyXp,
  dayKeyUtc,
  nextDailyResetAt,
  questionsForDay,
  scoringElapsedMs,
  seededRandom,
  validateDailyAttempt,
  type DailyAttemptAnswer,
  type DailyScoreableQuestion,
} from "@/convex/dailyCore";

const bank = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `q${i}`, correctIndex: 0 }));

/** عشرة أسئلة بأربعة خيارات — كبنك الأسئلة الحقيقي */
const questions: DailyScoreableQuestion[] = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`,
  correctIndex: i % 4,
  options: ["أ", "ب", "ج", "د"],
}));

const correct = (): DailyAttemptAnswer[] =>
  questions.map((q) => ({ questionId: q.id, selected: q.correctIndex, elapsedMs: 5_000 }));

describe("مفتاح اليوم والتصفير", () => {
  it("مفتاح اليوم بصيغة YYYY-MM-DD بتوقيت UTC", () => {
    expect(dayKeyUtc(Date.UTC(2026, 8, 22, 13, 45))).toBe("2026-09-22");
    // قبل منتصف الليل UTC بدقيقة يبقى في اليوم نفسه
    expect(dayKeyUtc(Date.UTC(2026, 8, 22, 23, 59))).toBe("2026-09-22");
    // وبعدها بدقيقة يصبح يوماً جديداً
    expect(dayKeyUtc(Date.UTC(2026, 8, 23, 0, 0))).toBe("2026-09-23");
  });

  it("التصفير القادم دائماً منتصف الليل UTC التالي", () => {
    expect(nextDailyResetAt(Date.UTC(2026, 8, 22, 13, 45))).toBe(Date.UTC(2026, 8, 23));
    expect(nextDailyResetAt(Date.UTC(2026, 8, 22, 23, 59))).toBe(Date.UTC(2026, 8, 23));
    // عند منتصف الليل بالضبط ينتقل لليوم التالي لا لنفسه
    expect(nextDailyResetAt(Date.UTC(2026, 8, 23, 0, 0))).toBe(Date.UTC(2026, 8, 24));
  });
});

describe("اختيار أسئلة اليوم", () => {
  it("حتمي: نفس اليوم ⇒ نفس الأسئلة دائماً", () => {
    const a = questionsForDay(bank(60), "2026-09-22");
    const b = questionsForDay(bank(60), "2026-09-22");
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it("عادل: كل اللاعبين يتلقون المجموعة نفسها (لا بذرة لكل لاعب)", () => {
    // الدالة لا تقبل معرّف لاعب أصلاً — وهذا جوهر العدالة
    const forAll = questionsForDay(bank(60), "2026-09-22");
    expect(forAll).toHaveLength(DAILY_QUESTION_COUNT);
    expect(new Set(forAll.map((q) => q.id)).size).toBe(DAILY_QUESTION_COUNT);
  });

  it("يختلف من يوم لآخر", () => {
    const d1 = questionsForDay(bank(60), "2026-09-22").map((q) => q.id).join(",");
    const d2 = questionsForDay(bank(60), "2026-09-23").map((q) => q.id).join(",");
    expect(d1).not.toBe(d2);
  });

  it("لا يتجاوز حجم البنك المتاح", () => {
    expect(questionsForDay(bank(4), "2026-09-22")).toHaveLength(4);
    expect(questionsForDay(bank(0), "2026-09-22")).toHaveLength(0);
  });

  it("المولّد البذري نفسه يعطي السلسلة نفسها دائماً", () => {
    const r1 = seededRandom("seed");
    const r2 = seededRandom("seed");
    for (let i = 0; i < 5; i++) expect(r1()).toBe(r2());
    expect(seededRandom("seed")()).not.toBe(seededRandom("other")());
  });
});

describe("النقاط والخبرة", () => {
  it("الزمن المستحيل يُرفع إلى الحد الأدنى — لا مكافأة سرعة للغش", () => {
    expect(scoringElapsedMs(0)).toBe(DAILY_MIN_ANSWER_MS);
    expect(scoringElapsedMs(-5000)).toBe(DAILY_MIN_ANSWER_MS);
    expect(answerScore(0)).toBe(answerScore(DAILY_MIN_ANSWER_MS));
    // والزمن الصفري لا يمنح ١٥٠ نقطة (أقصى مكافأة) — الغش يخسر لا يربح
    expect(answerScore(0)).toBeLessThan(150);
    expect(answerScore(0)).toBe(100 + Math.round(((15_000 - DAILY_MIN_ANSWER_MS) / 15_000) * 50));
  });

  it("الزمن الصالح يُقيَّد بسقف السؤال", () => {
    expect(scoringElapsedMs(60_000)).toBe(15_000);
    expect(scoringElapsedMs(5_000)).toBe(5_000);
  });

  it("الأسرع ياخذ نقاطاً أكثر — والنقاط ضمن مداها", () => {
    const fast = answerScore(1_000);
    const slow = answerScore(14_000);
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThanOrEqual(100);
    expect(fast).toBeLessThanOrEqual(150);
  });

  it("زمن غير رقمي لا يُنتج نقاطاً شاذة", () => {
    expect(scoringElapsedMs(Number.NaN)).toBe(15_000);
    expect(Number.isFinite(answerScore(Number.NaN))).toBe(true);
  });

  it("الخبرة مقيّدة بالسقف ومتزايدة مع الإجابات", () => {
    expect(dailyXp(0, 10, 0)).toBe(0);
    expect(dailyXp(5, 10, 0)).toBe(50);
    expect(dailyXp(10, 10, 5)).toBe(DAILY_MAX_XP);
    expect(dailyXp(10, 10, 10)).toBeLessThanOrEqual(DAILY_MAX_XP);
  });
});

describe("الشارات", () => {
  it("أول تحدٍّ يمنح شارة البداية", () => {
    const r = badgesForDaily({ had: [], perfect: false, totalDays: 1 });
    expect(r.earned).toContain(DAILY_BADGES.first);
  });

  it("الكمال يمنح شارته", () => {
    const r = badgesForDaily({ had: [], perfect: true, totalDays: 1 });
    expect(r.earned).toContain(DAILY_BADGES.perfect);
  });

  it("سبعة أيام وثلاثون يوماً يمنحان شاراتهما", () => {
    expect(badgesForDaily({ had: [], perfect: false, totalDays: 7 }).earned).toContain(
      DAILY_BADGES.sevenDays,
    );
    expect(badgesForDaily({ had: [], perfect: false, totalDays: 30 }).earned).toContain(
      DAILY_BADGES.thirtyDays,
    );
    expect(badgesForDaily({ had: [], perfect: false, totalDays: 29 }).earned).not.toContain(
      DAILY_BADGES.thirtyDays,
    );
  });

  it("لا يمنح شارة يملكها اللاعب مسبقاً", () => {
    const r = badgesForDaily({
      had: [DAILY_BADGES.first, DAILY_BADGES.perfect],
      perfect: true,
      totalDays: 1,
    });
    expect(r.earned).toHaveLength(0);
    expect(r.next).toContain(DAILY_BADGES.first);
  });

  it("لا يكرّر الشارات", () => {
    const r = badgesForDaily({ had: [], perfect: true, totalDays: 40 });
    expect(new Set(r.next).size).toBe(r.next.length);
  });
});

describe("سلسلة الأيام", () => {
  it("بلا أي يوم ⇒ صفر", () => {
    expect(dailyStreak([], "2026-09-22")).toEqual({ current: 0, longest: 0, playedToday: false });
  });

  it("ثلاثة أيام متتالية تنتهي اليوم", () => {
    const r = dailyStreak(["2026-09-20", "2026-09-21", "2026-09-22"], "2026-09-22");
    expect(r.current).toBe(3);
    expect(r.playedToday).toBe(true);
  });

  it("لا تنكسر السلسلة قبل انتهاء اليوم: لعب أمس فقط ⇒ سلسلة حيّة", () => {
    const r = dailyStreak(["2026-09-20", "2026-09-21"], "2026-09-22");
    expect(r.current).toBe(2);
    expect(r.playedToday).toBe(false);
  });

  it("انقطاع يومين يكسر السلسلة", () => {
    const r = dailyStreak(["2026-09-19", "2026-09-20"], "2026-09-22");
    expect(r.current).toBe(0);
    expect(r.longest).toBe(2);
  });

  it("ترتيب عشوائي وتكرار لا يفسدان الحساب", () => {
    const r = dailyStreak(
      ["2026-09-22", "2026-09-20", "2026-09-21", "2026-09-21", "2026-09-22"],
      "2026-09-22",
    );
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });

  it("أطول سلسلة تُحفظ حتى بعد انقطاعها", () => {
    const r = dailyStreak(
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-20"],
      "2026-09-22",
    );
    expect(r.longest).toBe(4);
    expect(r.current).toBe(0);
  });

  it("مفاتيح تالفة تُتجاهل ولا تُسقط الحساب", () => {
    const r = dailyStreak(["غير-تاريخ", "2026-09-22"], "2026-09-22");
    expect(r.current).toBe(1);
  });
});

describe("التحقق الخادمي من المحاولة", () => {
  const base = { day: "2026-09-22", today: "2026-09-22", questions };

  it("محاولة سليمة: عشر إجابات صحيحة", () => {
    const v = validateDailyAttempt({ ...base, answers: correct() });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.correctCount).toBe(10);
    expect(v.bestStreak).toBe(10);
    expect(v.perfect).toBe(true);
    expect(v.score).toBeGreaterThan(1000);
  });

  it("يرفض يوماً غير اليوم", () => {
    const v = validateDailyAttempt({ ...base, day: "2026-09-21", answers: correct() });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toContain("تحد");
  });

  it("يرفض النقص في الإجابات", () => {
    const v = validateDailyAttempt({ ...base, answers: correct().slice(0, 9) });
    expect(v.ok).toBe(false);
  });

  it("يرفض تكرار السؤال نفسه", () => {
    const dupes = correct();
    dupes[1] = { ...dupes[1], questionId: dupes[0].questionId };
    const v = validateDailyAttempt({ ...base, answers: dupes });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toContain("تكرار");
  });

  it("يرفض سؤالاً من خارج مجموعة اليوم", () => {
    const bad = correct();
    bad[0] = { ...bad[0], questionId: "q-خارجي" };
    const v = validateDailyAttempt({ ...base, answers: bad });
    expect(v.ok).toBe(false);
  });

  it("يرفض اختياراً خارج نطاق الخيارات", () => {
    const bad = correct();
    bad[0] = { ...bad[0], selected: 99 };
    expect(validateDailyAttempt({ ...base, answers: bad }).ok).toBe(false);
    bad[0] = { ...bad[0], selected: -1 };
    expect(validateDailyAttempt({ ...base, answers: bad }).ok).toBe(false);
  });

  it("يرفض زمناً سالباً أو مُصنَّعاً", () => {
    const neg = correct();
    neg[0] = { ...neg[0], elapsedMs: -1 };
    expect(validateDailyAttempt({ ...base, answers: neg }).ok).toBe(false);

    const forged = correct();
    forged[0] = { ...forged[0], elapsedMs: DAILY_TIME_FORGERY_MS + 1 };
    const v = validateDailyAttempt({ ...base, answers: forged });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.error).toContain("مُصنَّع");
  });

  it("زمن فوري لا يُبطل المحاولة بل يُلغي مكافأة السرعة", () => {
    const instant = questions.map((q) => ({
      questionId: q.id,
      selected: q.correctIndex,
      elapsedMs: 10,
    }));
    const v = validateDailyAttempt({ ...base, answers: instant });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.timingsTrustworthy).toBe(false);
    // النقاط تعادل أسوأ زمن مسموح، لا أفضله
    expect(v.score).toBe(answerScore(DAILY_MIN_ANSWER_MS) * questions.length);
  });

  it("الخاطئة لا تمنح نقاطاً وتكسر السلسلة", () => {
    const mixed = questions.map((q, i) => ({
      questionId: q.id,
      selected: i === 3 || i === 4 ? (q.correctIndex + 1) % 4 : q.correctIndex,
      elapsedMs: 5_000,
    }));
    const v = validateDailyAttempt({ ...base, answers: mixed });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.correctCount).toBe(8);
    // أخطأ في السؤالين ٣ و ٤ ⇒ سلسلة ٣ ثم انكسار ثم سلسلة ٥
    expect(v.bestStreak).toBe(5);
    expect(v.perfect).toBe(false);
  });

  it("بلا أسئلة ⇒ رفض واضح لا محاولة صفرية", () => {
    const v = validateDailyAttempt({ ...base, questions: [], answers: [] });
    expect(v.ok).toBe(false);
  });

  it("الحتمية: نفس المحاولة ⇒ نفس النتيجة دائماً", () => {
    const first = validateDailyAttempt({ ...base, answers: correct() });
    for (let i = 0; i < 10; i++) {
      expect(validateDailyAttempt({ ...base, answers: correct() })).toEqual(first);
    }
  });
});

describe("ترتيب الصدارة", () => {
  it("النقاط أولاً ثم الإجابات الصحيحة ثم الأسبق", () => {
    const board = [
      { score: 900, correctCount: 8, playedAt: 300 },
      { score: 1200, correctCount: 9, playedAt: 500 },
      { score: 1200, correctCount: 10, playedAt: 900 },
      { score: 1200, correctCount: 10, playedAt: 100 },
    ].sort(compareDailyBoards);
    expect(board[0].playedAt).toBe(100); // أعلى نقاط وكمال وأسبق
    expect(board[1].playedAt).toBe(900); // نفس النقاط والكمال لكن لاحقاً
    expect(board[2].correctCount).toBe(9); // نقاط أقل كمالاً
    expect(board[3].score).toBe(900);
  });
});
