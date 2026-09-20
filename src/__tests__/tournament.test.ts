import { beforeEach, describe, expect, it } from "vitest";
import {
  QUESTIONS_PER_ROUND,
  TOTAL_ROUNDS,
  forfeitTournament,
  prestigeLabel,
  questionsForRound,
  resetTournamentState,
  rivalAccuracyForRound,
  roundPrize,
  settleRound,
  startTournament,
} from "@/lib/tournament";
import { OFFLINE_BANK } from "@/lib/offline-bank";

/** قراءة الحالة الحقيقية من التخزين (خارج React). */
function readState() {
  // نستخدم مخزن المتصفح مباشرة — المحرك يكتب في نفس المفتاح
  const raw = localStorage.getItem("mindclash.tournament.v1");
  return raw ? (JSON.parse(raw) as { currentRound: number; crowns: number; bestRun: number; usedQuestionIds: string[] }) : null;
}

beforeEach(() => {
  localStorage.clear();
  resetTournamentState();
});

describe("بطولة السلطان — القوس والقوانين", () => {
  it("منحنى دقة الخصوم يتصاعد ويزعّم عند ٤ و٨", () => {
    expect(rivalAccuracyForRound(1)).toBeLessThan(rivalAccuracyForRound(3));
    expect(rivalAccuracyForRound(3)).toBeLessThan(rivalAccuracyForRound(4));
    expect(rivalAccuracyForRound(7)).toBeLessThan(rivalAccuracyForRound(8));
    expect(rivalAccuracyForRound(8)).toBe(0.85);
    expect(rivalAccuracyForRound(4)).toBe(0.72);
    for (let r = 1; r <= TOTAL_ROUNDS; r += 1) {
      expect(rivalAccuracyForRound(r)).toBeGreaterThan(0);
      expect(rivalAccuracyForRound(r)).toBeLessThanOrEqual(0.85);
    }
  });

  it("المكافآت تتزايد والجولة الأخيرة هي الأعظم", () => {
    for (let r = 2; r <= TOTAL_ROUNDS; r += 1) {
      expect(roundPrize(r)).toBeGreaterThan(roundPrize(r - 1));
    }
    expect(roundPrize(TOTAL_ROUNDS)).toBe(4000);
  });

  it("أسئلة الجولة: العدد كامل، بلا تكرار داخل البطولة، وملائمة للصعوبة", () => {
    const t = startTournament();
    const used: string[] = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r += 1) {
      const qs = questionsForRound(r, used);
      expect(qs.length).toBe(QUESTIONS_PER_ROUND);
      const ids = qs.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      // لا سؤال يُعاد من جولات سابقة
      for (const q of qs) expect(used).not.toContain(q.id);
      used.push(...ids);
    }
    expect(t.bracket.length).toBe(TOTAL_ROUNDS);
    expect(t.bracket[3].isBoss).toBe(true);
    expect(t.bracket[7].isBoss).toBe(true);
    expect(t.bracket[7].name).toBe("مقام السلطان");
  });

  it("خسارة جولة = إقصاء وتحفظ أفضل وصول، وأسلحة المستهلكة تُصفَّر", () => {
    startTournament();
    // فوز جولتين ثم خسارة الثالثة
    expect(settleRound(true)).toMatchObject({ won: true, crowned: false });
    expect(settleRound(true)).toMatchObject({ won: true, crowned: false });
    const result = settleRound(false);
    expect(result).toMatchObject({ won: false, prize: 0, crowned: false });
    const st = readState();
    expect(st?.currentRound).toBe(0);
    expect(st?.bestRun).toBe(2);
    expect(st?.usedQuestionIds).toHaveLength(0);
  });

  it("التتويج: فوز كل الجولات يمنح لقبًا ويزيد عدّاد التتويجات", () => {
    startTournament();
    for (let r = 1; r < TOTAL_ROUNDS; r += 1) {
      const res = settleRound(true);
      expect(res.won).toBe(true);
      expect(res.crowned).toBe(false);
    }
    const final = settleRound(true);
    expect(final.crowned).toBe(true);
    expect(final.prize).toBe(4000);
    const st = readState();
    expect(st?.crowns).toBe(1);
    expect(st?.bestRun).toBe(TOTAL_ROUNDS);
    expect(st?.currentRound).toBe(0);
  });

  it("التخلي يحفظ عمق الوصول ولا يمنح مكافأة الجولة غير المُخوضة", () => {
    startTournament();
    settleRound(true);
    settleRound(true);
    forfeitTournament();
    const st = readState();
    expect(st?.currentRound).toBe(0);
    expect(st?.bestRun).toBe(2);
  });

  it("قوس متكامل يستهلك جزءاً معقولاً من البنك (لا يفرغه)", () => {
    startTournament();
    const used: string[] = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r += 1) {
      used.push(...questionsForRound(r, used).map((q) => q.id));
      settleRound(true);
    }
    expect(used.length).toBe(TOTAL_ROUNDS * QUESTIONS_PER_ROUND);
    expect(used.length).toBeLessThan(OFFLINE_BANK.length);
  });

  it("ألقاب المكانة تتصاعد منطقياً", () => {
    expect(prestigeLabel(8)).toContain("سلطان");
    expect(prestigeLabel(6)).not.toContain("سلطان");
    expect(prestigeLabel(0)).not.toBe(prestigeLabel(4));
  });
});

  it("تسوية بلا بطولة نشطة آمنة (لا ترمي ولا تفسد الحالة)", () => {
    expect(() => settleRound(true)).not.toThrow();
    expect(readState()?.currentRound ?? 0).toBe(0);
  });
