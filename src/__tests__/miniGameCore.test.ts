import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MINI_GAME_DAILY_XP_CAP,
  MINI_GAME_FEATURED_MULTIPLIER,
  MINI_GAME_MAX_SCORE,
  MINI_GAME_MIN_SCORE,
  MINI_GAME_TIME_SLACK_SECONDS,
  MINI_GAME_TOTAL,
  allMiniGameIds,
  dailyFeaturedGame,
  difficultyMultiplier,
  freshnessForPlays,
  isKnownMiniGameId,
  isMiniGameDifficulty,
  remainingDailyXp,
  rewardForMiniGame,
} from "@/convex/miniGameCore";

const base = {
  score: 400,
  difficulty: "medium" as const,
  playsTodayForGame: 0,
  xpEarnedToday: 0,
  timeMs: 20_000,
  timeLimitSeconds: 60,
};

describe("isKnownMiniGameId — لا نتيجة بلا لعبة حقيقية", () => {
  it("يقبل معرّفات الفئات الثمانية الحقيقية", () => {
    for (const id of ["mem1", "spd12", "wrd7", "stg3", "num5", "vis9", "ch2", "exp11"]) {
      expect(isKnownMiniGameId(id)).toBe(true);
    }
  });

  it("يرفض أي معرّف مُلفَّق", () => {
    for (const id of ["", "hack", "mem", "memX", "unknown1", "mem1; drop", " MEM1", "zzz9"]) {
      expect(isKnownMiniGameId(id)).toBe(false);
    }
  });

  it("الصعوبات المقبولة ثلاث فقط", () => {
    expect(isMiniGameDifficulty("easy")).toBe(true);
    expect(isMiniGameDifficulty("medium")).toBe(true);
    expect(isMiniGameDifficulty("hard")).toBe(true);
    expect(isMiniGameDifficulty("insane")).toBe(false);
    expect(isMiniGameDifficulty(undefined)).toBe(false);
  });
});

describe("difficultyMultiplier — الصعب يستحق أكثر بفارق محسوب", () => {
  it("متزايد ولا ينفجر", () => {
    expect(difficultyMultiplier("easy")).toBeLessThan(difficultyMultiplier("medium"));
    expect(difficultyMultiplier("medium")).toBeLessThan(difficultyMultiplier("hard"));
    expect(difficultyMultiplier("hard")).toBeLessThanOrEqual(2);
  });
});

describe("freshnessForPlays — عوائد متناقصة تمنع المزرعة", () => {
  it("أول لعب كامل ثم يتضاءل ثم يتوقف", () => {
    expect(freshnessForPlays(0)).toBe(1);
    expect(freshnessForPlays(1)).toBeLessThan(1);
    expect(freshnessForPlays(3)).toBeLessThan(freshnessForPlays(1));
    expect(freshnessForPlays(6)).toBe(0);
    expect(freshnessForPlays(50)).toBe(0);
  });

  it("لا يزيد أبداً بكثرة اللعب", () => {
    let prev = 1;
    for (let n = 1; n <= 20; n += 1) {
      const f = freshnessForPlays(n);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
  });
});

describe("rewardForMiniGame — الخبرة تُشتقّ من النتيجة لا من ادّعاء الواجهة", () => {
  it("نتيجة أعلى ⇒ خبرة أعلى (مع ثبات الباقي)", () => {
    const low = rewardForMiniGame({ ...base, score: 100 });
    const high = rewardForMiniGame({ ...base, score: 900 });
    expect(high.xp).toBeGreaterThan(low.xp);
    expect(high.xp).toBeGreaterThan(0);
  });

  it("صعوبة أصعب ⇒ خبرة أعلى لنفس النتيجة", () => {
    const easy = rewardForMiniGame({ ...base, difficulty: "easy" });
    const hard = rewardForMiniGame({ ...base, difficulty: "hard" });
    expect(hard.xp).toBeGreaterThan(easy.xp);
  });

  it("نتيجة ضعيفة جداً ⇒ صفر خبرة لكن بسبب مكتوب", () => {
    const r = rewardForMiniGame({ ...base, score: MINI_GAME_MIN_SCORE - 1 });
    expect(r.xp).toBe(0);
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("نتيجة غير منطقية أو سالبة أو ضخمة ⇒ مرفوضة", () => {
    expect(rewardForMiniGame({ ...base, score: -5 }).xp).toBe(0);
    expect(rewardForMiniGame({ ...base, score: MINI_GAME_MAX_SCORE + 1 }).xp).toBe(0);
    expect(rewardForMiniGame({ ...base, score: Number.NaN }).xp).toBe(0);
  });

  it("زمن مستحيل مقارنة بحدّ اللعبة ⇒ بلا مكافأة", () => {
    const impossible = rewardForMiniGame({
      ...base,
      timeMs: (base.timeLimitSeconds + MINI_GAME_TIME_SLACK_SECONDS + 1) * 1000,
    });
    expect(impossible.xp).toBe(0);
    const withinSlack = rewardForMiniGame({
      ...base,
      timeMs: (base.timeLimitSeconds + MINI_GAME_TIME_SLACK_SECONDS - 1) * 1000,
    });
    expect(withinSlack.xp).toBeGreaterThan(0);
  });

  it("السقف اليومي يُطبَّق ولا يُتجاوز أبداً", () => {
    const r = rewardForMiniGame({ ...base, score: 5000, xpEarnedToday: MINI_GAME_DAILY_XP_CAP - 3 });
    expect(r.xp).toBeLessThanOrEqual(3);
    expect(r.cappedByDaily || r.xp === 0).toBeTruthy();
    const none = rewardForMiniGame({ ...base, xpEarnedToday: MINI_GAME_DAILY_XP_CAP });
    expect(none.xp).toBe(0);
    expect(none.reason.length).toBeGreaterThan(0);
  });

  it("تكرار نفس اللعبة يقلّل الخبرة حتى الصفر بسبب مكتوب", () => {
    const first = rewardForMiniGame({ ...base, playsTodayForGame: 0 });
    const sixth = rewardForMiniGame({ ...base, playsTodayForGame: 3 });
    const tenth = rewardForMiniGame({ ...base, playsTodayForGame: 9 });
    expect(first.xp).toBeGreaterThan(sixth.xp);
    expect(tenth.xp).toBe(0);
    expect(tenth.fatigued).toBe(true);
    expect(tenth.reason.length).toBeGreaterThan(0);
  });

  it("الخبرة لا تخرج عن حدود منطقية أبداً", () => {
    for (const score of [0, 10, 100, 1000, 100000]) {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        for (const playsTodayForGame of [0, 1, 3, 7]) {
          const r = rewardForMiniGame({ ...base, score, difficulty, playsTodayForGame });
          expect(r.xp).toBeGreaterThanOrEqual(0);
          expect(r.xp).toBeLessThanOrEqual(MINI_GAME_DAILY_XP_CAP);
          expect(Number.isInteger(r.xp)).toBe(true);
        }
      }
    }
  });
});

describe("remainingDailyXp", () => {
  it("لا يعطي رصيداً سالباً ولا يتجاوز السقف", () => {
    expect(remainingDailyXp(0)).toBe(MINI_GAME_DAILY_XP_CAP);
    expect(remainingDailyXp(-50)).toBe(MINI_GAME_DAILY_XP_CAP);
    expect(remainingDailyXp(MINI_GAME_DAILY_XP_CAP + 999)).toBe(0);
  });
});

/**
 * 🛡️ حرس الانحراف: هذا الاختبار يقرأ ملف الواجهة الحقيقي ويستخرج معرّفات
 * الألعاب المصغّرة منه، ثم يتأكد أن **كل معرّف** يقبله تحقق الخادم.
 * الغرض: إن أضاف أحدهم لعبة جديدة بمعرّف لا يقبله الخادم، تسقط النتائج
 * بصمت. هذا الاختبار يجعل ذلك مستحيلاً.
 */
function uiMiniGameIds(): string[] {
  const raw = readFileSync(resolve(process.cwd(), "src/components/game/MiniGames.tsx"), "utf8");
  return [...new Set([...raw.matchAll(/\{\s*id:\s*"([a-z]+[0-9]+)"/g)].map((m) => m[1]))];
}

describe("حرس الانحراف — كل لعبة في الواجهة يقبلها الخادم", () => {
  it("لا معرّف لعبة في الواجهة يرفضه الخادم", () => {
    const ids = uiMiniGameIds();
    expect(ids.length).toBeGreaterThan(50);
    expect(ids.filter((id) => !isKnownMiniGameId(id))).toEqual([]);
  });

  it("فضاء معرّفات الخادم يطابق الواجهة تماماً — لا زيادة ولا نقصان", () => {
    const ui = uiMiniGameIds().sort();
    const server = allMiniGameIds().sort();
    expect(server).toEqual(ui);
    expect(MINI_GAME_TOTAL).toBe(ui.length);
  });
});

describe("🗓️ لعبة اليوم — حتمية وتغطي كل الألعاب", () => {
  it("نفس اليوم ⇒ نفس اللعبة دائماً (لا عشوائية في الخادم)", () => {
    for (const day of ["2026-09-21", "2026-01-01", "2027-12-31"]) {
      expect(dailyFeaturedGame(day)).toBe(dailyFeaturedGame(day));
    }
  });

  it("لعبة اليوم دائماً من الألعاب الحقيقية", () => {
    const ids = new Set(allMiniGameIds());
    for (let d = 1; d <= 28; d += 1) {
      const day = `2026-01-${String(d).padStart(2, "0")}`;
      const picked = dailyFeaturedGame(day);
      expect(ids.has(picked)).toBe(true);
      expect(isKnownMiniGameId(picked)).toBe(true);
    }
  });

  it("يوم مختلف ⇒ لا تتجمّد على لعبة واحدة أبداً", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 60; d += 1) {
      const day = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);
      seen.add(dailyFeaturedGame(day));
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("مضاعف لعبة اليوم — حقيقي ومحدود", () => {
  it("المضاعف يرفع الخبرة فعلاً في أول لعب فقط", () => {
    const plain = rewardForMiniGame({ ...base, score: 600 });
    const featuredFirst = rewardForMiniGame({ ...base, score: 600, featured: true, playsTodayForGame: 0 });
    const featuredRepeat = rewardForMiniGame({ ...base, score: 600, featured: true, playsTodayForGame: 1 });
    expect(featuredFirst.xp).toBeGreaterThan(plain.xp);
    expect(featuredFirst.reason).toContain("لعبة اليوم");
    // إعادة اللعب لا تمنح المضاعف مجدداً
    expect(featuredRepeat.xp).toBeLessThan(featuredFirst.xp);
  });

  it("المضاعف لا يخرق السقف اليومي أبداً", () => {
    const r = rewardForMiniGame({
      ...base,
      score: 100000,
      featured: true,
      playsTodayForGame: 0,
      xpEarnedToday: MINI_GAME_DAILY_XP_CAP - 1,
    });
    expect(r.xp).toBeLessThanOrEqual(1);
    expect(MINI_GAME_FEATURED_MULTIPLIER).toBeGreaterThan(1);
  });
});
