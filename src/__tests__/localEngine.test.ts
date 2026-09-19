import { beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  BANK_SIZE,
  buildQuestions,
  CATEGORIES,
  finishSession,
  isDailyDone,
  leaderboard,
  levelInfo,
  mindPower,
  myRank,
  readSave,
  resetAll,
  unlockedTitles,
  updateProfile,
  withShuffledOptions,
  type ModeId,
} from "@/lib/localEngine";
import { OFFLINE_BANK } from "@/lib/offline-bank";

beforeEach(() => {
  resetAll();
});

describe("محرك اللعبة المحلي — الجولات قابلة للعب فعلاً", () => {
  it("يبني العدد الصحيح من الأسئلة لكل نمط", () => {
    const s = readSave();
    expect(buildQuestions("quick", s)).toHaveLength(10);
    expect(buildQuestions("marathon", s)).toHaveLength(25);
    expect(buildQuestions("daily", s)).toHaveLength(12);
    expect(buildQuestions("duel", s)).toHaveLength(10);
  });

  it("لا يُكرّر سؤالاً داخل الجولة الواحدة (وضعا الماراثون والسريع)", () => {
    const s = readSave();
    for (const mode of ["quick", "marathon", "duel"] as ModeId[]) {
      const ids = buildQuestions(mode, s).map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("وضع الفئة يعيد أسئلة من الفئة المطلوبة فقط", () => {
    const s = readSave();
    const target = CATEGORIES[0].name;
    const qs = buildQuestions("category", s, { category: target });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.category).toBe(target);
  });

  it("التحدي اليومي ثابت ومتكرر في نفس اليوم", () => {
    const s = readSave();
    const a = buildQuestions("daily", s).map((q) => q.id);
    const b = buildQuestions("daily", s).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("كل سؤال في أي جولة صالح للعرض وأجوبته متسقة", () => {
    const s = readSave();
    for (const mode of ["quick", "marathon", "daily", "duel"] as ModeId[]) {
      for (const q of buildQuestions(mode, s)) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.question.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("خلط الخيارات يحفظ الإجابة الصحيحة ولا يفقد خياراً", () => {
    const q = OFFLINE_BANK[0];
    const correctText = q.options[q.correctIndex];
    for (let i = 0; i < 25; i++) {
      const { options, correctIndex } = withShuffledOptions(q);
      expect(options).toHaveLength(q.options.length);
      expect(new Set(options)).toEqual(new Set(q.options));
      expect(options[correctIndex]).toBe(correctText);
    }
  });
});

describe("محرك اللعبة المحلي — المستوى والتقدّم", () => {
  it("المستوى يبدأ من ١ ويتقدّم بلا نهاية", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(0).progress).toBe(0);
    expect(levelInfo(1_000_000).level).toBeGreaterThan(levelInfo(5_000).level);
    // التقدّم داخل المستوى دائماً بين 0 و 1
    for (const xp of [0, 399, 400, 5000, 55_000]) {
      const p = levelInfo(xp).progress;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("الرتب تُفتح تصاعدياً مع الخبرة", () => {
    expect(unlockedTitles(0)).toEqual(["عقل مبتدئ"]);
    expect(unlockedTitles(1_000_000).length).toBeGreaterThan(unlockedTitles(0).length);
  });

  it("قوة العقل ترتفع مع الخبرة والسلاسل", () => {
    const base = readSave().stats;
    expect(mindPower({ ...base, xp: base.xp + 500 })).toBeGreaterThan(mindPower(base));
    expect(mindPower({ ...base, bestStreak: base.bestStreak + 5 })).toBeGreaterThan(
      mindPower(base),
    );
  });
});

describe("محرك اللعبة المحلي — إنهاء الجولة والحفظ", () => {
  it("الجولة المثالية تمنح خبرة وتمنح إنجازات وترفع المستوى", () => {
    const s = readSave();
    const questions = buildQuestions("quick", s);
    const answers = questions.map((q) => q.correctIndex);

    const { unlocked, xpGained } = finishSession({
      mode: "quick",
      label: "تحدي سريع",
      questions,
      answers,
      score: 1200,
      bestStreak: 10,
    });

    const after = readSave();
    expect(xpGained).toBeGreaterThan(0);
    expect(after.stats.xp).toBe(xpGained);
    expect(after.stats.correct).toBe(questions.length);
    expect(after.stats.answered).toBe(questions.length);
    expect(after.stats.perfectRuns).toBe(1);
    expect(after.stats.matches).toBe(1);
    expect(after.stats.bestStreak).toBe(10);
    expect(after.stats.coins).toBeGreaterThan(0);
    // «أول نزال» و«إتقان تام» يجب أن يُفتحا في الجولة الأولى
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain("first_match");
    expect(ids).toContain("perfect1");
    expect(after.stats.history[0].correct).toBe(questions.length);
  });

  it("الإجابات الخاطئة لا تُحتسب صحيحة", () => {
    const s = readSave();
    const questions = buildQuestions("quick", s);
    const answers = questions.map((q) => (q.correctIndex + 1) % q.options.length);

    finishSession({
      mode: "quick",
      label: "تحدي سريع",
      questions,
      answers,
      score: 100,
      bestStreak: 0,
    });

    const after = readSave();
    expect(after.stats.correct).toBe(0);
    expect(after.stats.perfectRuns).toBe(0);
  });

  it("انتهاء الوقت (‎-1) لا يُحتسب إجابة ولا صحيحاً", () => {
    const s = readSave();
    const questions = buildQuestions("quick", s).slice(0, 3);
    finishSession({
      mode: "quick",
      label: "تحدي سريع",
      questions,
      answers: [-1, -1, -1],
      score: 0,
      bestStreak: 0,
    });
    const after = readSave();
    expect(after.stats.answered).toBe(0);
    expect(after.stats.correct).toBe(0);
  });

  it("التحدي اليومي يُسجّل مرة واحدة في اليوم ويرفع سلسلة الأيام", () => {
    const s = readSave();
    expect(isDailyDone(s)).toBe(false);

    const questions = buildQuestions("daily", s);
    finishSession({
      mode: "daily",
      label: "التحدي اليومي",
      questions,
      answers: questions.map((q) => q.correctIndex),
      score: 900,
      bestStreak: 12,
    });

    const after = readSave();
    expect(isDailyDone(after)).toBe(true);
    expect(after.stats.dailyStreak).toBe(1);
  });

  it("التقدّم يُحفظ في localStorage ويُستعاد", () => {
    const s = readSave();
    updateProfile({ name: "عقل الاختبار" });
    const questions = buildQuestions("quick", s);
    finishSession({
      mode: "quick",
      label: "تحدي سريع",
      questions,
      answers: questions.map((q) => q.correctIndex),
      score: 500,
      bestStreak: 5,
    });

    const raw = window.localStorage.getItem("mindclash.localgame.v2");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { profile: { name: string }; stats: { xp: number } };
    expect(parsed.profile.name).toBe("عقل الاختبار");
    expect(parsed.stats.xp).toBeGreaterThan(0);
  });
});

describe("محرك اللعبة المحلي — لوحة التصنيف", () => {
  it("تضمّ اللاعب مرة واحدة ومرتبة تنازلياً", () => {
    const rows = leaderboard(readSave());
    expect(rows.filter((r) => r.isYou)).toHaveLength(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    }
  });

  it("rank يعطي ترتيباً صالحاً وفرقاً واضحاً لمن فوقك", () => {
    const { rank, total, row } = myRank(readSave());
    expect(rank).toBeGreaterThanOrEqual(1);
    expect(rank).toBeLessThanOrEqual(total);
    if (rank > 1) expect(row.gapToNext).toBeGreaterThan(0);
  });

  it("التقدّم يرفع ترتيبك بين الخصوم", () => {
    const before = myRank(readSave()).rank;
    const s = readSave();
    const questions = buildQuestions("marathon", s);
    finishSession({
      mode: "marathon",
      label: "ماراثون الذكاء",
      questions,
      answers: questions.map((q) => q.correctIndex),
      score: 5000,
      bestStreak: 25,
    });
    expect(myRank(readSave()).rank).toBeLessThanOrEqual(before);
  });
});

describe("محرك اللعبة المحلي — ثوابت البنك", () => {
  it("البنك كافٍ لكل الأنماط", () => {
    expect(BANK_SIZE).toBeGreaterThanOrEqual(340);
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(6);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(14);
  });
});
