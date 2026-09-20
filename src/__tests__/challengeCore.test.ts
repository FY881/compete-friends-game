import { describe, expect, it } from "vitest";
import {
  CHALLENGE_MAX_QUESTIONS,
  CHALLENGE_MAX_REWARD_XP,
  CHALLENGE_MIN_QUESTIONS,
  CHALLENGE_PASS_RATIO,
  bestPerUser,
  boardOf,
  challengeCode,
  challengeStatus,
  difficultySpec,
  gradeChallenge,
  myChallengeState,
  normalizeChallengeSpec,
  normalizeCode,
  rankOfUser,
  remainingLabel,
  rewardForRun,
  validateRun,
  type RunRow,
} from "../convex/challengeCore";

const HOUR = 60 * 60 * 1000;

function run(over: Partial<RunRow> & { userId: string }): RunRow {
  return {
    userName: over.userId,
    correct: 8,
    total: 10,
    score: 800,
    xpAwarded: 0,
    createdAt: 1000,
    ...over,
  };
}

describe("حدود التحدّي — لا تحدٍّ خارج الضبط", () => {
  it("يقيّد عدد الأسئلة والمكافأة داخل النطاق المُعلن", () => {
    const tooBig = normalizeChallengeSpec({ questionCount: 900, rewardXp: 99999, rewardCoins: 99999, ttlHours: 99999 });
    expect(tooBig.questionCount).toBe(CHALLENGE_MAX_QUESTIONS);
    expect(tooBig.rewardXp).toBe(CHALLENGE_MAX_REWARD_XP);
    expect(tooBig.rewardCoins).toBe(500);
    expect(tooBig.ttlHours).toBe(720);

    const tooSmall = normalizeChallengeSpec({ questionCount: 1, rewardXp: -50, rewardCoins: -5, ttlHours: -2 });
    expect(tooSmall.questionCount).toBe(CHALLENGE_MIN_QUESTIONS);
    expect(tooSmall.rewardXp).toBeGreaterThanOrEqual(0);
    expect(tooSmall.rewardCoins).toBe(0);
    expect(tooSmall.ttlHours).toBe(0);
  });

  it("يرفض الصعوبة المجهولة ويعود إلى المتوسط", () => {
    expect(normalizeChallengeSpec({ difficulty: "impossible" }).difficulty).toBe("medium");
    expect(normalizeChallengeSpec({ difficulty: "expert" }).difficulty).toBe("expert");
  });

  it("الصعوبة الأصعب تعطي مضاعفاً ووقتاً أقل", () => {
    expect(difficultySpec("hard").multiplier).toBeGreaterThan(difficultySpec("easy").multiplier);
    expect(difficultySpec("expert").seconds).toBeLessThan(difficultySpec("easy").seconds);
    expect(difficultySpec(null).id).toBe("medium");
  });
});

describe("تقييم النتيجة", () => {
  it("يرتّب الرتب عند الحدود بالضبط", () => {
    expect(gradeChallenge(10, 10).tier).toBe("perfect");
    expect(gradeChallenge(8, 10).tier).toBe("gold");
    expect(gradeChallenge(7, 10).tier).toBe("silver");
    expect(gradeChallenge(5, 10).tier).toBe("bronze");
    expect(gradeChallenge(4, 10).tier).toBe("fail");
  });

  it("مقاوم للأرقام الفاسدة (صفر إجمالي وصحيحة أكبر من المجموع)", () => {
    expect(gradeChallenge(0, 0).ratio).toBe(0);
    expect(gradeChallenge(99, 10).ratio).toBe(1);
    expect(gradeChallenge(-5, 10).ratio).toBe(0);
  });
});

describe("المكافأة الحقيقية", () => {
  it("لا مكافأة تحت عتبة النجاح — عاقبة واضحة", () => {
    const res = rewardForRun({ correct: 4, total: 10, difficulty: "hard", rewardXp: 100, rewardCoins: 50 });
    expect(res.passed).toBe(false);
    expect(res.xp).toBe(0);
    expect(res.coins).toBe(0);
    expect(res.note).toContain(`${Math.round(CHALLENGE_PASS_RATIO * 100)}`);
  });

  it("تزيد بالدقة والصعوبة ولا تتجاوز السقف", () => {
    const weak = rewardForRun({ correct: 6, total: 10, difficulty: "medium", rewardXp: 100, rewardCoins: 0 });
    const strong = rewardForRun({ correct: 10, total: 10, difficulty: "medium", rewardXp: 100, rewardCoins: 0 });
    expect(strong.xp).toBeGreaterThan(weak.xp);

    const easy = rewardForRun({ correct: 10, total: 10, difficulty: "easy", rewardXp: 100, rewardCoins: 0 });
    const hard = rewardForRun({ correct: 10, total: 10, difficulty: "hard", rewardXp: 100, rewardCoins: 0 });
    expect(hard.xp).toBeGreaterThan(easy.xp);

    const huge = rewardForRun({ correct: 10, total: 10, difficulty: "expert", rewardXp: 600, rewardCoins: 500 });
    expect(huge.xp).toBeLessThanOrEqual(CHALLENGE_MAX_REWARD_XP);
    expect(huge.coins).toBeLessThanOrEqual(500);
  });

  it("النتيجة المشكوك فيها تُحتسب بالنصف بالضبط", () => {
    const clean = rewardForRun({ correct: 8, total: 10, difficulty: "medium", rewardXp: 200, rewardCoins: 100 });
    const sus = rewardForRun({ correct: 8, total: 10, difficulty: "medium", rewardXp: 200, rewardCoins: 100, suspicious: true });
    expect(sus.xp).toBe(Math.round(clean.xp / 2));
    expect(sus.coins).toBe(Math.round(clean.coins / 2));
    expect(sus.note).toContain("نصف");
  });

  it("كفاءة المكافأة تبقى بين صفر وواحد", () => {
    const res = rewardForRun({ correct: 10, total: 10, difficulty: "expert", rewardXp: 500, rewardCoins: 0 });
    expect(res.efficiency).toBeGreaterThan(0);
    expect(res.efficiency).toBeLessThanOrEqual(1);
  });
});

describe("التحقق من نتيجة العميل", () => {
  it("يرفض عدد أسئلة مخالفاً للتحدّي (لا اختصار للفوز)", () => {
    const bad = validateRun({ correct: 5, total: 5, score: 100, durationMs: 60_000 }, 20);
    expect(bad.ok).toBe(false);
    expect(bad.run.total).toBe(20);
  });

  it("يقصّ الصحيحة عند المجموع ويسقّف النقاط", () => {
    const ok = validateRun({ correct: 99, total: 10, score: 9_999_999, durationMs: 60_000 }, 10);
    expect(ok.ok).toBe(true);
    expect(ok.run.correct).toBe(10);
    expect(ok.run.score).toBeLessThanOrEqual(1_000_000);
  });

  it("يكشف الزمن غير المعقول (لعب فوري أو متروك)", () => {
    const fast = validateRun({ correct: 10, total: 10, score: 900, durationMs: 300 }, 10);
    expect(fast.suspicious).toBe(true);
    const abandoned = validateRun({ correct: 10, total: 10, score: 900, durationMs: 20 * HOUR }, 10);
    expect(abandoned.suspicious).toBe(true);
    const normal = validateRun({ correct: 10, total: 10, score: 900, durationMs: 90_000 }, 10);
    expect(normal.suspicious).toBe(false);
  });
});

describe("الحالة والمدة", () => {
  const now = 1_700_000_000_000;

  it("يقرأ الانتهاء والإغلاق بصدق", () => {
    expect(challengeStatus({ status: "open", expiresAt: now + HOUR, plays: 0 }, now)).toBe("open");
    expect(challengeStatus({ status: "open", expiresAt: now - 1, plays: 0 }, now)).toBe("expired");
    expect(challengeStatus({ status: "closed", expiresAt: 0, plays: 0 }, now)).toBe("closed");
  });

  it("يسمّي المدة المتبقية بلغة مفهومة", () => {
    expect(remainingLabel({ status: "open", expiresAt: 0, plays: 0 }, now)).toBe("بلا انتهاء");
    expect(remainingLabel({ status: "closed", expiresAt: now + HOUR, plays: 0 }, now)).toBe("أُغلق بقرار الإدارة");
    expect(remainingLabel({ status: "open", expiresAt: now + 50 * HOUR, plays: 0 }, now)).toContain("يوم");
    expect(remainingLabel({ status: "open", expiresAt: now + 5 * HOUR, plays: 0 }, now)).toContain("ساعة");
  });
});

describe("لوحة الصدارة بالعدل", () => {
  const rows: RunRow[] = [
    run({ userId: "a", score: 500 }),
    run({ userId: "a", score: 900, correct: 10 }),
    run({ userId: "b", score: 900, correct: 10 }),
    run({ userId: "c", score: 700, correct: 7 }),
  ];

  it("لا يتكدّس لاعب واحد في القمة — الأفضل لكل لاعب فقط", () => {
    const board = bestPerUser(rows);
    expect(board.map((r) => r.userId)).toEqual(["a", "b", "c"]);
    expect(board[0].score).toBe(900);
  });

  it("الترتيب يحسم بالدقة ثم بالأسبق عند تعادل النقاط", () => {
    const tie: RunRow[] = [
      run({ userId: "x", score: 900, correct: 9, createdAt: 2000 }),
      run({ userId: "y", score: 900, correct: 10, createdAt: 3000 }),
    ];
    expect(bestPerUser(tie)[0].userId).toBe("y");
    expect(rankOfUser(tie, "x")).toBe(2);
  });

  it("يحدّ حجم اللوحة ويعيد صفراً لمن لم يشارك", () => {
    expect(boardOf(rows, 2)).toHaveLength(2);
    expect(rankOfUser(rows, "ghost")).toBe(0);
  });
});

describe("حالة اللاعب في التحدّي", () => {
  it("يفرّق بين من لعب ولم ينل ومن نال مكافأته", () => {
    const fresh = myChallengeState([], "a");
    expect(fresh.played).toBe(false);
    const played = myChallengeState([run({ userId: "a", score: 300, xpAwarded: 0 })], "a");
    expect(played.played).toBe(true);
    expect(played.rewarded).toBe(false);
    const rewarded = myChallengeState(
      [
        run({ userId: "a", score: 300, xpAwarded: 0 }),
        run({ userId: "a", score: 600, xpAwarded: 42, createdAt: 2000 }),
      ],
      "a",
    );
    expect(rewarded.rewarded).toBe(true);
    expect(rewarded.attempts).toBe(2);
    expect(rewarded.bestScore).toBe(600);
  });
});

describe("كود التحدّي", () => {
  it("يحمل المصدر وستة رموز بلا حروف ملتبسة", () => {
    const code = challengeCode("room", 123456);
    expect(code).toMatch(/^ROOM-[A-Z0-9]{6}$/);
    // الحروف الملتبسة مستبعدة من الجزء العشوائي (لا O ولا I ولا ١) — سهلة القراءة والكتابة
    expect(code.slice(5)).not.toMatch(/[OI1]/);
    expect(challengeCode("forum", 7).startsWith("FORUM-")).toBe(true);
  });

  it("يعيد التوليد من بذور مختلفة ويعيد التطبيع بأمان", () => {
    expect(challengeCode("room", 1)).not.toBe(challengeCode("room", 2));
    expect(normalizeCode(" room-abc123 ")).toBe("ROOM-ABC123");
    expect(normalizeCode(null)).toBe("");
  });
});
