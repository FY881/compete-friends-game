import { beforeEach, describe, expect, it } from "vitest";
import type { OfflineQuestion } from "@/lib/offline-bank";
import {
  FACULTIES,
  MAX_EQUIPPED,
  MASTERY_TIERS,
  SPECIALIZATIONS,
  domainMastery,
  equipSpecialization,
  grantFacultyXp,
  equippedSpecializations,
  facultyGainsForSession,
  facultyLevel,
  facultyProgress,
  isSpecUnlocked,
  masteryTierIndex,
  mindEffect,
  mindIdentity,
  mindTierScore,
  readMind,
  recordMindSession,
  resetEvolvedMind,
  swapSpecialization,
  unequipSpecialization,
  unlockedSpecializations,
} from "@/lib/evolvedMind";
import { finishSession, readSave, resetAll } from "@/lib/localEngine";

beforeEach(() => {
  resetAll();
  resetEvolvedMind();
});

function q(id: string, difficulty: OfflineQuestion["difficulty"], category = "علوم"): OfflineQuestion {
  return {
    id,
    category,
    difficulty,
    question: `سؤال ${id}`,
    options: ["أ", "ب", "ج", "د"],
    correctIndex: 0,
    stage: 1,
    reward: 40,
  };
}

/** جولة كاملة صحيحة (٥ أسئلة صعبة) — نبني بها القوى فعلاً. */
function perfectSession(prefix: string, category = "علوم") {
  const questions = [1, 2, 3, 4, 5].map((n) => q(`${prefix}${n}`, "hard", category));
  return recordMindSession({
    mode: "quick",
    questions,
    answers: questions.map(() => 0),
    timesMs: questions.map(() => 1200),
    timerSeconds: 20,
    bestStreak: 5,
    perfect: true,
    domains: { [category]: { answered: 5, correct: 5 } },
  });
}

describe("العقل المتطور — القوى الست", () => {
  it("ست قوى معرّفة ولكل منها هوية عرض", () => {
    expect(FACULTIES).toHaveLength(6);
    for (const f of FACULTIES) {
      expect(f.name.length).toBeGreaterThan(1);
      expect(f.source.length).toBeGreaterThan(5);
      expect(f.passive.length).toBeGreaterThan(5);
    }
  });

  it("المستوى يصعد مع الرصيد وينتهي عند السقف", () => {
    expect(facultyLevel(0)).toBe(1);
    expect(facultyLevel(45)).toBe(2);
    expect(facultyLevel(120)).toBe(3);
    expect(facultyLevel(999999)).toBe(12);
  });

  it("شريط التقدم يعكس الرصيد داخل المستوى", () => {
    const p = facultyProgress(60); // بين 45 (م2) و120 (م3)
    expect(p.level).toBe(2);
    expect(p.into).toBe(15);
    expect(p.needed).toBe(75);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
    expect(facultyProgress(999999).maxed).toBe(true);
  });

  it("التقدم تراكمي: رصيد أكبر لا يعطي مستوى أقل", () => {
    let last = 1;
    for (let xp = 0; xp < 5000; xp += 137) {
      const lv = facultyLevel(xp);
      expect(lv).toBeGreaterThanOrEqual(last);
      last = lv;
    }
  });
});

describe("العقل المتطور — بناء القوى من اللعب الحقيقي", () => {
  it("السؤال الصعب يغذّي المنطق والمعرفة أكثر من السهل", () => {
    const hard = facultyGainsForSession(
      { questions: [q("h1", "hard")], answers: [0], timesMs: [1000], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    const easy = facultyGainsForSession(
      { questions: [q("e1", "easy")], answers: [0], timesMs: [1000], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    expect(hard.logic).toBeGreaterThan(easy.logic);
    expect(hard.knowledge).toBeGreaterThan(easy.knowledge);
  });

  it("الإجابة السريعة تمنح سرعة والإجابة المتأخرة لا تمنح", () => {
    const fast = facultyGainsForSession(
      { questions: [q("f1", "medium")], answers: [0], timesMs: [1200], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    const slow = facultyGainsForSession(
      { questions: [q("f2", "medium")], answers: [0], timesMs: [19_500], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    expect(fast.speed).toBeGreaterThan(0);
    expect(slow.speed).toBe(0);
  });

  it("تجاوز سؤال أخطأت فيه سابقاً يغذّي الذاكرة بقوة أكبر", () => {
    const fresh = facultyGainsForSession(
      { questions: [q("m1", "medium")], answers: [0], timesMs: [3000], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    const recalled = facultyGainsForSession(
      { questions: [q("m1", "medium")], answers: [0], timesMs: [3000], timerSeconds: 20, bestStreak: 1, perfect: false },
      { m1: { w: 2, r: 0 } },
    );
    expect(recalled.memory).toBeGreaterThan(fresh.memory);
  });

  it("الإصابة في مجال جديد تماماً تغذّي الحدس", () => {
    const fresh = facultyGainsForSession(
      { questions: [q("i1", "easy", "تاريخ")], answers: [0], timesMs: [3000], timerSeconds: 20, bestStreak: 1, perfect: false },
      {},
    );
    const known = facultyGainsForSession(
      { questions: [q("i2", "easy", "تاريخ")], answers: [0], timesMs: [3000], timerSeconds: 20, bestStreak: 1, perfect: false },
      { i2: { w: 0, r: 5 } },
    );
    expect(fresh.intuition).toBeGreaterThan(known.intuition);
    expect(known.intuition).toBe(0);
  });

  it("الخطأ يعلّم (ذاكرة + منطق) لكن بغير مبالغة", () => {
    const wrong = facultyGainsForSession(
      { questions: [q("w1", "hard")], answers: [1], timesMs: [5000], timerSeconds: 20, bestStreak: 0, perfect: false },
      {},
    );
    expect(wrong.memory).toBe(3);
    expect(wrong.logic).toBe(1);
    expect(wrong.knowledge).toBe(0);
  });

  it("انتهاء الوقت لا يبني أي قوة", () => {
    const t = facultyGainsForSession(
      { questions: [q("t1", "hard")], answers: [-1], timesMs: [20_000], timerSeconds: 20, bestStreak: 0, perfect: false },
      {},
    );
    expect(Object.values(t).every((v) => v === 0)).toBe(true);
  });

  it("السلاسل الطويلة والجولات المثالية تغذّي التركيز", () => {
    const focused = facultyGainsForSession(
      {
        questions: [q("c1", "easy")],
        answers: [0],
        timesMs: [3000],
        timerSeconds: 20,
        bestStreak: 10,
        perfect: true,
      },
      {},
    );
    expect(focused.focus).toBeGreaterThanOrEqual(30);
  });
});

describe("العقل المتطور — الجلسة الكاملة والإتقان", () => {
  it("تسجيل جولة يبني القوى ويرفع رصيدها فعلاً", () => {
    const report = perfectSession("s1");
    expect(report.totalGained).toBeGreaterThan(0);
    expect(report.gains.length).toBeGreaterThan(0);
    const state = readMind();
    expect(state.totalSessions).toBe(1);
    expect(state.faculty.logic).toBeGreaterThan(0);
    expect(state.faculty.knowledge).toBeGreaterThan(0);
  });

  it("الجولات المتكررة ترقّي القوى وترفع مستوى العقل", () => {
    const before = mindTierScore(readMind());
    for (let i = 0; i < 6; i += 1) perfectSession(`r${i}`);
    const after = readMind();
    expect(mindTierScore(after)).toBeGreaterThan(before);
    expect(facultyLevel(after.faculty.logic)).toBeGreaterThan(1);
  });

  it("ذروة الإتقان لا تُمنح قبل 5 إجابات ثم تُحتسب بالدقة والتدريب", () => {
    expect(domainMastery({ answered: 4, correct: 4 })).toBe(0);
    expect(domainMastery({ answered: 30, correct: 30 })).toBe(100);
    // الدقة هي الأساس: نصف الصواب لا يبلغ رتبة الخبير مهما كثر التدريب
    const halfAccurate = domainMastery({ answered: 30, correct: 15 });
    expect(halfAccurate).toBeLessThanOrEqual(50);
    expect(masteryTierIndex(halfAccurate)).toBeLessThan(masteryTierIndex(85));
    // والتدريب يرفع الرتبة: نفس الدقة بإجابات أكثر لا تنقص
    expect(domainMastery({ answered: 30, correct: 24 })).toBeGreaterThan(
      domainMastery({ answered: 6, correct: 5 }),
    );
    expect(masteryTierIndex(0)).toBe(0);
    expect(masteryTierIndex(100)).toBe(MASTERY_TIERS.length - 1);
  });

  it("رتبة الإتقان تُصرف مرة واحدة فقط (لا تكرار للمكافأة)", () => {
    const first = perfectSession("d1", "فلك");
    const firstReward = first.masteryCoins;
    const second = perfectSession("d2", "فلك");
    // الجولة الثانية لا تكرّر رتبة صُرفت سابقاً
    const repeated = second.masteryUps.filter((m) => first.masteryUps.some((f) => f.tier === m.tier && f.category === m.category));
    expect(repeated).toEqual([]);
    expect(second.masteryCoins).toBeLessThanOrEqual(firstReward);
    expect(first.masteryUps.length).toBeGreaterThan(0);
  });

  it("ذاكرة الأسئلة محدودة الحجم (لا تضخّم للتخزين)", () => {
    for (let i = 0; i < 60; i += 1) {
      const questions = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => q(`big-${i}-${n}`, "medium"));
      recordMindSession({
        mode: "quick",
        questions,
        answers: questions.map(() => 0),
        timesMs: questions.map(() => 2000),
        timerSeconds: 20,
        bestStreak: 3,
        perfect: false,
        domains: { علوم: { answered: 8, correct: 8 } },
      });
    }
    expect(Object.keys(readMind().recalls).length).toBeLessThanOrEqual(400);
  });

  it("سجل الجولات محدود ويحفظ آخر الجولات فقط", () => {
    for (let i = 0; i < 30; i += 1) perfectSession(`l${i}`);
    expect(readMind().log.length).toBeLessThanOrEqual(20);
  });
});

describe("العقل المتطور — التخصصات والتأثيرات", () => {
  it("عشر تخصصات ولكل منها شرط وتأثير حقيقي", () => {
    expect(SPECIALIZATIONS).toHaveLength(10);
    for (const s of SPECIALIZATIONS) {
      expect(s.requires.length).toBeGreaterThan(0);
      const effectSum =
        Math.abs(s.effect.xpPct) +
        Math.abs(s.effect.coinsPct) +
        Math.abs(s.effect.timeSec) +
        Math.abs(s.effect.rivalAccuracy) +
        Math.abs(s.effect.streakShields);
      expect(effectSum).toBeGreaterThan(0);
    }
  });

  it("لا تخصص مفتوح في البداية، واللعب الحقيقي يفتحها تدريجياً", () => {
    expect(unlockedSpecializations(readMind())).toHaveLength(0);
    // الجولات الحقيقية وحدها (بلا أي منح إداري) تفتح أول تخصص
    for (let i = 0; i < 8; i += 1) perfectSession(`u${i}`);
    const open = unlockedSpecializations(readMind());
    expect(open.length).toBeGreaterThan(0);
    expect(open.map((s) => s.id)).not.toContain("sp_monarch");
  });

  it("التجهيز محصور بـ٣ مقاعد ويرفض ما هو مقفل", () => {
    const first = SPECIALIZATIONS.find((s) => s.id === "sp_orator")!;
    expect(equipSpecialization(first.id)).toBe("not_unlocked");

    // نمنح القوى مستويات كافية لفتح عدة تخصصات (كما لو لعب اللاعب أسابيع)
    for (const f of FACULTIES) grantFacultyXp(f.id, 500);
    const open = unlockedSpecializations(readMind());
    expect(open.length).toBeGreaterThanOrEqual(MAX_EQUIPPED + 1);
    for (let i = 0; i < MAX_EQUIPPED; i += 1) expect(equipSpecialization(open[i].id)).toBe("ok");
    const extra = open[MAX_EQUIPPED];
    expect(equipSpecialization(extra.id)).toBe("full");
    expect(equippedSpecializations(readMind())).toHaveLength(MAX_EQUIPPED);

    const drop = open[0].id;
    unequipSpecialization(drop);
    expect(equippedSpecializations(readMind())).toHaveLength(MAX_EQUIPPED - 1);
    expect(equipSpecialization(extra.id)).toBe("ok");
    expect(equippedSpecializations(readMind()).some((s) => s.id === drop)).toBe(false);
  });

  it("التبديل في مقعد واحد يعمل بلا تجاوز الحد", () => {
    for (const f of FACULTIES) grantFacultyXp(f.id, 500);
    const open = unlockedSpecializations(readMind());
    for (let i = 0; i < MAX_EQUIPPED; i += 1) equipSpecialization(open[i].id);
    const replacement = open[open.length - 1];
    expect(swapSpecialization(0, replacement.id)).toBe("ok");
    const equipped = equippedSpecializations(readMind());
    expect(equipped).toHaveLength(MAX_EQUIPPED);
    expect(equipped.some((s) => s.id === replacement.id)).toBe(true);
  });

  it("التخصصات الأسطورية تتطلب مستويات عالية فعلاً", () => {
    const monarch = SPECIALIZATIONS.find((s) => s.id === "sp_monarch")!;
    const transcendent = SPECIALIZATIONS.find((s) => s.id === "sp_transcendent")!;
    for (const f of FACULTIES) grantFacultyXp(f.id, 500); // القوى في المستوى الخامس
    expect(isSpecUnlocked(monarch, readMind())).toBe(true);
    expect(isSpecUnlocked(transcendent, readMind())).toBe(false);
    for (const f of FACULTIES) grantFacultyXp(f.id, 2600); // القوى في المستوى العاشر
    expect(isSpecUnlocked(transcendent, readMind())).toBe(true);
  });

  it("تأثير العقل يصبح أرقاماً حقيقية بعد التطور", () => {
    const empty = mindEffect(readMind());
    expect(empty.xpPct).toBe(0);
    expect(empty.timeSec).toBe(0);
    expect(empty.streakShields).toBe(0);

    for (let i = 0; i < 12; i += 1) perfectSession(`p${i}`);
    const grown = mindEffect(readMind());
    expect(grown.xpPct).toBeGreaterThan(0);
    expect(grown.coinsPct).toBeGreaterThan(0);
    // حدود التوازن محفوظة
    expect(grown.xpPct).toBeLessThanOrEqual(60);
    expect(grown.coinsPct).toBeLessThanOrEqual(70);
    expect(grown.timeSec).toBeLessThanOrEqual(8);
    expect(grown.rivalAccuracy).toBeGreaterThanOrEqual(-0.25);
    expect(grown.streakShields).toBeLessThanOrEqual(3);
  });

  it("هوية العقل تتغيّر بحسب أقوى قوة فعلاً", () => {
    expect(mindIdentity(readMind()).title).toBe("عقل ناشئ");
    for (let i = 0; i < 4; i += 1) perfectSession(`id${i}`);
    const identity = mindIdentity(readMind());
    expect(identity.title).not.toBe("عقل ناشئ");
    expect(identity.top?.level).toBeGreaterThan(1);
  });

  it("التخصص المقفل لا يمكن تجهيزه ولا يؤثر", () => {
    const locked = SPECIALIZATIONS.find((s) => s.id === "sp_transcendent")!;
    expect(isSpecUnlocked(locked, readMind())).toBe(false);
    expect(equipSpecialization(locked.id)).toBe("not_unlocked");
    expect(equippedSpecializations(readMind())).toHaveLength(0);
  });
});

describe("العقل المتطور — الترابط مع محرك اللعب", () => {
  it("إنهاء جولة يبني العقل ويعيد تقريراً شفافاً", () => {
    const save = readSave();
    const questions = [1, 2, 3, 4, 5].map((n) => q(`eng${n}`, "medium"));
    const outcome = finishSession({
      mode: "quick",
      label: "تحدي سريع",
      questions,
      answers: questions.map(() => 0),
      score: 800,
      bestStreak: 5,
      timesMs: questions.map(() => 1500),
      timerSeconds: 20,
    });
    expect(outcome.mind.totalGained).toBeGreaterThan(0);
    expect(readMind().totalSessions).toBe(1);
    expect(save.stats.xp).toBe(0);
  });

  it("مكافأة العقل ترفع الخبرة الفعلية المحفوظة (مقيسة، لا معلنة)", () => {
    // نبني عقلاً قوياً في مسار منفصل عبر جولات المحرك نفسها
    for (let i = 0; i < 10; i += 1) {
      const qs = [1, 2, 3, 4, 5].map((n) => q(`bonus-${i}-${n}`, "hard"));
      finishSession({
        mode: "quick",
        label: "تدريب",
        questions: qs,
        answers: qs.map(() => 0),
        score: 500,
        bestStreak: 5,
        timesMs: qs.map(() => 1200),
        timerSeconds: 20,
      });
    }
    const perks = mindEffect(readMind());
    expect(perks.xpPct).toBeGreaterThan(0);

    resetAll();
    resetEvolvedMind();
    const qs = [1, 2, 3, 4, 5].map((n) => q(`base-${n}`, "medium"));
    const baselineXp = finishSession({
      mode: "quick",
      label: "قياس",
      questions: qs,
      answers: qs.map(() => 0),
      score: 500,
      bestStreak: 5,
      timesMs: qs.map(() => 1500),
      timerSeconds: 20,
    }).xpGained;

    // نُعيد بناء نفس العقل ثم نقيس نفس الجولة مرة أخرى
    resetAll();
    resetEvolvedMind();
    for (let i = 0; i < 10; i += 1) {
      const warm = [1, 2, 3, 4, 5].map((n) => q(`warm-${i}-${n}`, "hard"));
      finishSession({
        mode: "quick",
        label: "تدريب",
        questions: warm,
        answers: warm.map(() => 0),
        score: 0,
        bestStreak: 0,
        timesMs: warm.map(() => 1200),
        timerSeconds: 20,
      });
    }
    const boostedXp = finishSession({
      mode: "quick",
      label: "قياس",
      questions: qs,
      answers: qs.map(() => 0),
      score: 500,
      bestStreak: 5,
      timesMs: qs.map(() => 1500),
      timerSeconds: 20,
    }).xpGained;

    expect(boostedXp).toBeGreaterThan(baselineXp);
    expect(readSave().stats.xp).toBeGreaterThanOrEqual(boostedXp);
  });

  it("إتقان المجالات يُصرف للاعب عملات فعلية", () => {
    const qs = [1, 2, 3, 4, 5, 6].map((n) => q(`coin${n}`, "medium", "رياضيات"));
    const before = readSave().stats.coins;
    const outcome = finishSession({
      mode: "quick",
      label: "رياضيات",
      questions: qs,
      answers: qs.map(() => 0),
      score: 600,
      bestStreak: 6,
      timesMs: qs.map(() => 2000),
      timerSeconds: 20,
    });
    expect(outcome.mind.masteryCoins).toBeGreaterThan(0);
    expect(readSave().stats.coins).toBeGreaterThanOrEqual(before + outcome.mind.masteryCoins);
  });
});
