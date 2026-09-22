import { describe, expect, it } from "vitest";
import { serverFacultyGains } from "../convex/mindFeed";
import {
  FACULTY_KEYS,
  FACULTY_XP_CAP,
  facultyLevelFromXp,
  computeTierFromXp,
  rankLevelFor,
  clampSnapshot,
} from "../convex/mindCore";

type A = { questionId: string; selected: number; correct: boolean; elapsedMs?: number } | null;

const H = (id: string) => ({ id, difficulty: "hard" });
const M = (id: string) => ({ id, difficulty: "medium" });
const E = (id: string) => ({ id, difficulty: "easy" });

describe("serverFacultyGains — تغذية العقل الخادمية", () => {
  it("لا نقاط لأي قوة من إجابة فارغة (لم يُجب)", () => {
    const qd = [H("q1"), M("q2")];
    const gains = serverFacultyGains([null, null] as A[], new Map(qd.map((q) => [q.id, q])), 20);
    for (const k of FACULTY_KEYS) expect(gains[k]).toBe(0);
  });

  it("الإجابة الصحيحة تبني أكثر من الخطأ — لكل قوة", () => {
    const qd = [M("q1")];
    const map = new Map(qd.map((q) => [q.id, q]));
    const hit = serverFacultyGains(
      [{ questionId: "q1", selected: 0, correct: true, elapsedMs: 5000 }] as A[],
      map,
      20,
    );
    const miss = serverFacultyGains(
      [{ questionId: "q1", selected: 1, correct: false, elapsedMs: 5000 }] as A[],
      map,
      20,
    );
    expect(hit.knowledge).toBeGreaterThan(miss.knowledge);
    expect(hit.logic).toBeGreaterThan(miss.logic);
  });

  it("الصعب يبني المنطق أكثر من المتوسط — الرتابة", () => {
    const map = new Map([
      ["h", H("h")],
      ["m", M("m")],
    ]);
    const hard = serverFacultyGains(
      [{ questionId: "h", selected: 0, correct: true, elapsedMs: 5000 }] as A[],
      map,
      20,
    );
    const medium = serverFacultyGains(
      [{ questionId: "m", selected: 0, correct: true, elapsedMs: 5000 }] as A[],
      map,
      20,
    );
    expect(hard.logic).toBeGreaterThan(medium.logic);
    expect(hard.knowledge).toBeGreaterThan(medium.knowledge);
  });

  it("السرعة تُشتق من الزمن الحقيقي — أبطأ = أقل", () => {
    const qd = [E("q1")];
    const map = new Map(qd.map((q) => [q.id, q]));
    const fast = serverFacultyGains(
      [{ questionId: "q1", selected: 0, correct: true, elapsedMs: 2000 }] as A[],
      map,
      20,
    );
    const slow = serverFacultyGains(
      [{ questionId: "q1", selected: 0, correct: true, elapsedMs: 19000 }] as A[],
      map,
      20,
    );
    expect(fast.speed).toBeGreaterThan(slow.speed);
  });

  it("كل قوة محصورة بسقف الجولة — حتى 50 إجابة صحيحة", () => {
    const qd = Array.from({ length: 50 }, (_, i) => E(`q${i}`));
    const map = new Map(qd.map((q) => [q.id, q]));
    const answers = qd.map((q) => ({
      questionId: q.id,
      selected: 0,
      correct: true,
      elapsedMs: 1000,
    })) as A[];
    const gains = serverFacultyGains(answers, map, 20);
    for (const k of FACULTY_KEYS) expect(gains[k]).toBeLessThanOrEqual(40);
  });

  it("سؤال غير معروف الصعوبة لا يكسر الحساب", () => {
    const map = new Map([["known", M("known")]]);
    const gains = serverFacultyGains(
      [{ questionId: "unknown", selected: 0, correct: true }] as A[],
      map,
      20,
    );
    expect(gains.knowledge).toBeGreaterThanOrEqual(0);
  });
});

describe("سلامة السلّم — نفس عقود mindCore", () => {
  it("سقف XP يمنع تجاوز المستوى 12", () => {
    expect(facultyLevelFromXp(FACULTY_XP_CAP)).toBe(12);
    expect(facultyLevelFromXp(FACULTY_XP_CAP + 999)).toBe(12);
  });

  it("tierScore هو مجموع المستويات المكتسبة فوق 1 — لاعب جديد = 0", () => {
    const empty = Object.fromEntries(FACULTY_KEYS.map((k) => [k, 0]));
    expect(computeTierFromXp(empty as never)).toBe(0);
    const maxed = Object.fromEntries(FACULTY_KEYS.map((k) => [k, FACULTY_XP_CAP]));
    expect(computeTierFromXp(maxed as never)).toBeLessThanOrEqual(66);
  });

  it("rankLevel متزايد مع tierScore", () => {
    expect(rankLevelFor(0)).toBe(1);
    expect(rankLevelFor(66)).toBeGreaterThanOrEqual(rankLevelFor(0));
  });

  it("clampSnapshot يقيد أي مدخلات عميل شاذة", () => {
    const clamped = clampSnapshot({
      faculties: { logic: 999999, knowledge: -50 },
      tierScore: 999,
      sessions: -5,
    });
    expect(clamped.faculties.logic).toBeLessThanOrEqual(FACULTY_XP_CAP);
    expect(clamped.faculties.knowledge).toBe(0);
    expect(clamped.tierScore).toBeLessThanOrEqual(66);
  });
});
