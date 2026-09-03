import { describe, it, expect } from "vitest";
import {
  dayKey,
  weekKey,
  startOfDayTs,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  MILESTONES,
  TITLES,
  computeDailyQuestProgress,
  computeWeeklyQuestProgress,
  claimableMilestones,
  isTitleUnlocked,
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_REWARD_INVITER_XP,
  REFERRAL_REWARD_REDEEMER_XP,
  DEFAULT_PLAYER_SETTINGS,
  TITLE_RARITY_LABEL,
} from "@/lib/progression";
import type { QuestInput, TitleCheckInput } from "@/lib/progression";

const EMPTY_INPUT: QuestInput = {
  gamesToday: 0,
  winsToday: 0,
  correctToday: 0,
  dailyChallengeDoneToday: false,
  games7d: 0,
  wins7d: 0,
  correct7d: 0,
  xp7d: 0,
  perfectGame7d: false,
};

describe("أدوات التاريخ", () => {
  it("dayKey ينتج YYYY-MM-DD", () => {
    const ts = Date.UTC(2026, 0, 5, 14, 30);
    expect(dayKey(ts)).toBe("2026-01-05");
  });

  it("startOfDayTs يعيد منتصف الليل لنفس المفتاح", () => {
    const ts = Date.UTC(2026, 5, 15, 20, 0);
    const day = dayKey(ts);
    expect(startOfDayTs(day)).toBe(Date.UTC(2026, 5, 15, 0, 0));
  });

  it("weekKey ينتج تنسيق سنة-أسبوع ثابت", () => {
    // 2026-01-05 هو يوم الاثنين من الأسبوع الثاني
    expect(weekKey(Date.UTC(2026, 0, 5, 12))).toBe("2026-W02");
    expect(weekKey(Date.UTC(2026, 0, 7, 12))).toBe("2026-W02"); // نفس الأسبوع
  });
});

describe("المهام اليومية", () => {
  it("لا تكتمل أي مهمة بدون نشاط", () => {
    const result = computeDailyQuestProgress(EMPTY_INPUT);
    expect(result).toHaveLength(DAILY_QUESTS.length);
    for (const p of result) expect(p.completed).toBe(false);
  });

  it("تُحتسب من البيانات الحقيقية وتُغطّى عند السقف", () => {
    const input: QuestInput = {
      ...EMPTY_INPUT,
      gamesToday: 2,
      winsToday: 1,
      correctToday: 50,
      dailyChallengeDoneToday: true,
    };
    const result = computeDailyQuestProgress(input);
    const byId = new Map(result.map((p) => [p.quest.id, p]));
    expect(byId.get("d_play")?.completed).toBe(true);
    expect(byId.get("d_win")?.completed).toBe(true);
    expect(byId.get("d_challenge")?.completed).toBe(true);
    // d_correct target=8 والمدخل 50 → يُغطّى لكن لا يتجاوز
    expect(byId.get("d_correct")?.progress).toBe(8);
  });
});

describe("المهام الأسبوعية", () => {
  it("game + wins + xp + perfect", () => {
    const input: QuestInput = {
      ...EMPTY_INPUT,
      games7d: 7,
      wins7d: 3,
      xp7d: 999,
      perfectGame7d: true,
    };
    const result = computeWeeklyQuestProgress(input);
    const byId = new Map(result.map((p) => [p.quest.id, p]));
    expect(byId.get("w_games")?.completed).toBe(true);
    expect(byId.get("w_wins")?.completed).toBe(true);
    expect(byId.get("w_xp")?.completed).toBe(true);
    expect(byId.get("w_xp")?.progress).toBe(300); // target=300
    expect(byId.get("w_perfect")?.completed).toBe(true);
  });
});

describe("المعالم", () => {
  it("تصفية المعالم القابلة للمطالبة فقط", () => {
    const claimed = new Set([MILESTONES[0].id]);
    const ready = claimableMilestones(2600, claimed);
    expect(ready).toContainEqual(expect.objectContaining({ id: "m_1000" }));
    expect(ready).toContainEqual(expect.objectContaining({ id: "m_2500" }));
    expect(ready).not.toContainEqual(expect.objectContaining({ id: "m_500" })); // مستلمة
    expect(ready).not.toContainEqual(expect.objectContaining({ id: "m_5000" })); // غير مبلغ
  });

  it("جميع المعالم مرتبة تصاعدياً بالـ XP", () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].xp).toBeGreaterThan(MILESTONES[i - 1].xp);
    }
  });
});

describe("الألقاب", () => {
  const base: TitleCheckInput = {
    gamesPlayed: 0,
    gamesWon: 0,
    accuracy: 0,
    bestStreak: 0,
    fastestAnswerMs: null,
    correctAnswers: 0,
    level: 1,
    perfectGames: 0,
    dailyStreak: 0,
  };

  it("جميع الألقاب مذكورة مع تسمية نادرة", () => {
    for (const t of TITLES) {
      expect(TITLE_RARITY_LABEL[t.rarity]).toBeTruthy();
      expect(isTitleUnlocked(t.id, base)).toBe(false); // لا شيء مفتوح بالبداية
    }
  });

  it("شروط كل لقب تعمل بمفردها", () => {
    expect(isTitleUnlocked("t_rookie", { ...base, gamesPlayed: 1 })).toBe(true);
    expect(isTitleUnlocked("t_winner", { ...base, gamesWon: 1 })).toBe(true);
    expect(isTitleUnlocked("t_ten_games", { ...base, gamesPlayed: 10 })).toBe(true);
    expect(isTitleUnlocked("t_accurate", { ...base, accuracy: 70 })).toBe(true);
    expect(isTitleUnlocked("t_sharp", { ...base, bestStreak: 5 })).toBe(true);
    expect(isTitleUnlocked("t_fast", { ...base, fastestAnswerMs: 2900 })).toBe(true);
    expect(isTitleUnlocked("t_scholar", { ...base, correctAnswers: 100 })).toBe(true);
    expect(isTitleUnlocked("t_level10", { ...base, level: 10 })).toBe(true);
    expect(isTitleUnlocked("t_perfect", { ...base, perfectGames: 1 })).toBe(true);
    expect(isTitleUnlocked("t_daily7", { ...base, dailyStreak: 7 })).toBe(true);
    expect(isTitleUnlocked("t_level25", { ...base, level: 25 })).toBe(true);
    expect(isTitleUnlocked("t_legend", { ...base, level: 50 })).toBe(true);
    expect(isTitleUnlocked("t_level50_doesnt_exist", base)).toBe(false);
  });
});

describe("أكواد الدعوة", () => {
  it("كود بطول 8 من الأبجدية الآمنة", () => {
    const code = generateReferralCode("عمر");
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("أكواد مختلفة لنفس الاسم في أوقات مختلفة", () => {
    const a = generateReferralCode("PLAYER");
    const b = generateReferralCode("PLAYER");
    // البادئة ثابتة واللاحقة تعتمد على الوقت → في الغالب مختلف؛ نتحقق من الشكل فقط
    expect(a.slice(0, 4)).toBe(b.slice(0, 4));
    expect(a.slice(4)).toMatch(/^[A-Z0-9]{4}$/);
  });

  it("normalizeReferralCode ينظف المسافات والأحرف الصغيرة", () => {
    expect(normalizeReferralCode("  ab12-cd34 ")).toBe("AB12CD34");
  });

  it("مكافآت الدعوة موجبة", () => {
    expect(REFERRAL_REWARD_INVITER_XP).toBeGreaterThan(0);
    expect(REFERRAL_REWARD_REDEEMER_XP).toBeGreaterThan(0);
  });
});

describe("الإعدادات الافتراضية", () => {
  it("قيم افتراضية كاملة وصالحة", () => {
    expect(DEFAULT_PLAYER_SETTINGS.soundEnabled).toBe(true);
    expect(DEFAULT_PLAYER_SETTINGS.musicEnabled).toBe(true);
    expect(DEFAULT_PLAYER_SETTINGS.motionLevel).toBe("full");
    expect(DEFAULT_PLAYER_SETTINGS.notificationsEnabled).toBe(true);
    expect(DEFAULT_PLAYER_SETTINGS.theme).toBe("system");
  });
});
