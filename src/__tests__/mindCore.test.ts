import { describe, expect, it } from "vitest";
import {
  FACULTY_KEYS,
  FACULTY_META,
  FACULTY_THRESHOLDS,
  FACULTY_XP_CAP,
  MAX_GRANT_AMOUNT,
  MAX_TIER_SCORE,
  MIND_RANKS,
  clampSnapshot,
  computeMindPulse,
  computeTierFromXp,
  describePosition,
  dominantFaculty,
  facultyLevelFromXp,
  mergeGrants,
  nextRank,
  rankForTier,
  rankLevelFor,
  rankPosition,
  rankProgress,
  shouldSyncMind,
  snapshotSignature,
  type FacultyKey,
  type MindGrant,
  type MindPulseRow,
} from "@/convex/mindCore";

const zeroFaculty = (): Record<FacultyKey, number> => {
  const f = {} as Record<FacultyKey, number>;
  for (const k of FACULTY_KEYS) f[k] = 0;
  return f;
};

describe("سلّم رتب العقول", () => {
  it("يعطي الرتبة الصحيحة عند كل عتبة", () => {
    expect(rankForTier(0).name).toBe(MIND_RANKS[0].name);
    expect(rankForTier(5).level).toBe(1);
    expect(rankForTier(6).level).toBe(2);
    expect(rankForTier(12).level).toBe(2);
    expect(rankForTier(13).level).toBe(3);
    expect(rankForTier(MAX_TIER_SCORE - 1).level).toBe(MIND_RANKS.length);
    expect(rankForTier(MAX_TIER_SCORE).level).toBe(MIND_RANKS.length);
    expect(rankForTier(9999).level).toBe(MIND_RANKS.length);
  });

  it("يتعامل مع القيم غير الصالحة كصفر لا كخطأ (لا ثقة بالعميل)", () => {
    expect(rankForTier(Number.NaN).level).toBe(1);
    expect(rankForTier(-10).level).toBe(1);
    // اللانهاية/غير الرقمي لا تُمنح القمة — تُعامل كصفر
    expect(rankLevelFor(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("يحسب المسافة للرتبة التالية ويعيد null عند القمة", () => {
    expect(nextRank(0)?.rank.level).toBe(2);
    expect(nextRank(0)?.remaining).toBe(6);
    expect(nextRank(20)?.remaining).toBe(2);
    expect(nextRank(MAX_TIER_SCORE)).toBeNull();
  });

  it("تقدّم الرتبة محصور بين 0 و 1", () => {
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(6)).toBe(0);
    expect(rankProgress(3)).toBeCloseTo(0.5, 5);
    expect(rankProgress(MAX_TIER_SCORE)).toBe(1);
    expect(rankProgress(10_000)).toBe(1);
  });
});

describe("مستويات القوى وسقف المجموع", () => {
  it("يشتق المستوى من العتبات نفسها التي يعمل بها المحرك", () => {
    expect(FACULTY_THRESHOLDS.length).toBe(12);
    expect(facultyLevelFromXp(0)).toBe(1);
    expect(facultyLevelFromXp(FACULTY_THRESHOLDS[1])).toBe(2);
    expect(facultyLevelFromXp(FACULTY_THRESHOLDS[11])).toBe(12);
    expect(facultyLevelFromXp(99_999)).toBe(12);
    expect(facultyLevelFromXp(-50)).toBe(1);
  });

  it("مجموع القوى = المستويات المكتسبة: صفر للاعب جديد، 66 عند القمة", () => {
    const f = zeroFaculty();
    for (const k of FACULTY_KEYS) f[k] = FACULTY_THRESHOLDS[11];
    expect(computeTierFromXp(f)).toBe(MAX_TIER_SCORE);
    expect(MAX_TIER_SCORE).toBe(66);
    expect(computeTierFromXp(zeroFaculty())).toBe(0);
  });
});

describe("تقييد لقطة العقل (لا ثقة بالعميل)", () => {
  it("يتجاهل مجموع القوى المرسل ويحسبه من الأرصدة", () => {
    const snap = clampSnapshot({
      name: "لاعب",
      tierScore: MAX_TIER_SCORE,
      rankLevel: MIND_RANKS.length,
      faculties: zeroFaculty(),
    });
    expect(snap.tierScore).toBe(0);
    expect(snap.rankLevel).toBe(1);
  });

  it("يقيّد الأرصدة السالبة والضخمة", () => {
    const faculties = zeroFaculty();
    faculties.logic = -500;
    faculties.speed = 1_000_000;
    const snap = clampSnapshot({ faculties });
    expect(snap.faculties.logic).toBe(0);
    expect(snap.faculties.speed).toBe(FACULTY_XP_CAP);
  });

  it("يحدّ طول المصفوفات والنصوص ويمنع التكرار", () => {
    const snap = clampSnapshot({
      name: "ن".repeat(200),
      equipped: ["a", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
      unlocked: Array.from({ length: 60 }, (_, i) => `spec-${i}`),
      mastery: Array.from({ length: 40 }, (_, i) => ({ category: `c${i}`, score: 500, tier: 9 })),
    });
    expect(snap.name.length).toBeLessThanOrEqual(40);
    expect(new Set(snap.equipped).size).toBe(snap.equipped.length);
    expect(snap.equipped.length).toBeLessThanOrEqual(8);
    expect(snap.unlocked.length).toBeLessThanOrEqual(24);
    expect(snap.mastery.length).toBeLessThanOrEqual(8);
    expect(snap.mastery[0].score).toBe(100);
    expect(snap.mastery[0].tier).toBe(4);
  });

  it("يعطي قيماً افتراضية آمنة لمدخل فارغ", () => {
    const snap = clampSnapshot(undefined);
    expect(snap.name).toBe("لاعب");
    expect(snap.identityIcon).toBe("🌱");
    expect(snap.sessions).toBe(0);
    expect(snap.avatar).toBeNull();
    expect(snap.equipped).toEqual([]);
  });
});

describe("بصمة العقل — تحمي حصة الخادم من الكتابة الزائدة", () => {
  const base = {
    tierScore: 10,
    sessions: 5,
    faculties: zeroFaculty(),
    equipped: ["a", "b"],
    unlocked: ["a"],
    mastery: [{ category: "علم", score: 50, tier: 2 }],
  };

  it("ثابتة مهما تغيّر ترتيب المصفوفات", () => {
    const first = snapshotSignature(base);
    const second = snapshotSignature({
      ...base,
      equipped: ["b", "a"],
      mastery: [{ category: "علم", score: 50, tier: 2 }],
    });
    expect(first).toBe(second);
  });

  it("تتغيّر عند تغيّر خبرة أي قوة أو عدد الجولات", () => {
    const f = zeroFaculty();
    f.logic = 45;
    expect(snapshotSignature({ ...base, faculties: f })).not.toBe(snapshotSignature(base));
    expect(snapshotSignature({ ...base, sessions: 6 })).not.toBe(snapshotSignature(base));
  });

  it("shouldSyncMind يرفع أول مرة ويمنع التكرار بعدها", () => {
    expect(shouldSyncMind(null, "x")).toBe(true);
    expect(shouldSyncMind("x", "x")).toBe(false);
    expect(shouldSyncMind("x", "y")).toBe(true);
  });
});

describe("منح العرش — تُطبَّق مرة واحدة بالضبط", () => {
  const grant = (over: Partial<MindGrant> = {}): MindGrant => ({
    id: "g1",
    kind: "xp",
    faculty: "logic",
    amount: 250,
    reason: "منحة",
    actorName: "الحاكم",
    at: 1,
    ...over,
  });

  it("يضيف الخبرة إلى القوة المطلوبة", () => {
    const res = mergeGrants(zeroFaculty(), [grant()], []);
    expect(res.faculties.logic).toBe(250);
    expect(res.applications).toHaveLength(1);
    expect(res.applied).toContain("g1");
    expect(res.resetRequested).toBe(false);
  });

  it("لا يُطبّق المنحة نفسها مرتين", () => {
    const res = mergeGrants(zeroFaculty(), [grant()], ["g1"]);
    expect(res.faculties.logic).toBe(0);
    expect(res.applications).toHaveLength(0);
  });

  it("المنحة الشاملة تشمل القوى الست", () => {
    const res = mergeGrants(zeroFaculty(), [grant({ faculty: "all", amount: 100 })], []);
    for (const k of FACULTY_KEYS) expect(res.faculties[k]).toBe(100);
  });

  it("يقيّد حجم المنحة ويرفض القوة المجهولة", () => {
    const res = mergeGrants(zeroFaculty(), [grant({ amount: 999_999, faculty: "unknown" })], []);
    expect(res.faculties.logic).toBe(MAX_GRANT_AMOUNT);
    expect(res.applications[0].faculty).toBe("logic");
    const big = mergeGrants({ ...zeroFaculty(), logic: FACULTY_XP_CAP - 10 }, [grant({ amount: 500 })], []);
    expect(big.faculties.logic).toBe(FACULTY_XP_CAP);
  });

  it("قرار التصفير يُعلَن ويصفّر كل القوى", () => {
    const f = zeroFaculty();
    f.knowledge = 900;
    const res = mergeGrants(f, [grant({ kind: "reset", amount: 0 })], []);
    expect(res.resetRequested).toBe(true);
    expect(res.faculties.knowledge).toBe(0);
  });

  it("يحفظ بصمات المنح المُستهلكة مهما تكرّرت", () => {
    const res = mergeGrants(zeroFaculty(), [grant(), grant({ id: "g2", faculty: "speed" })], ["old"]);
    expect(res.applied).toEqual(expect.arrayContaining(["old", "g1", "g2"]));
  });
});

describe("نبضة العقول — عين المالك على المجتمع الذهني", () => {
  const row = (over: Partial<MindPulseRow> = {}): MindPulseRow => ({
    tierScore: 10,
    rankLevel: 3,
    faculties: { ...zeroFaculty(), logic: 500 },
    updatedAt: Date.now(),
    frozen: false,
    synced24h: true,
    ...over,
  });

  it("تعيد حالة فارغة صريحة بلا عقول", () => {
    const pulse = computeMindPulse([]);
    expect(pulse.empty).toBe(true);
    expect(pulse.total).toBe(0);
    expect(pulse.dominantFaculty).toBeNull();
    expect(pulse.rankBuckets).toHaveLength(MIND_RANKS.length);
  });

  it("تحسب المجاميع والمتوسط والقمة والنشاط والتجميد", () => {
    const rows = [
      row({ tierScore: 10 }),
      row({ tierScore: 20, frozen: true, synced24h: false }),
      row({ tierScore: 30, synced24h: false }),
    ];
    const pulse = computeMindPulse(rows);
    expect(pulse.total).toBe(3);
    expect(pulse.topTier).toBe(30);
    expect(pulse.avgTier).toBe(20);
    expect(pulse.active24h).toBe(1);
    expect(pulse.frozen).toBe(1);
    expect(pulse.empty).toBe(false);
  });

  it("توزّع اللاعبين على الرتب حسب مجموع قواهم لا حسب رقم مخزَّن", () => {
    const pulse = computeMindPulse([row({ tierScore: 0, rankLevel: 8 }), row({ tierScore: MAX_TIER_SCORE, rankLevel: 1 })]);
    const first = pulse.rankBuckets.find((b) => b.level === 1);
    const last = pulse.rankBuckets.find((b) => b.level === MIND_RANKS.length);
    expect(first?.count).toBe(1);
    expect(last?.count).toBe(1);
  });

  it("تكشف القوة المهيمنة وأكثرها تصدّراً", () => {
    const a = row({ faculties: { ...zeroFaculty(), speed: 800 } });
    const b = row({ faculties: { ...zeroFaculty(), speed: 500, logic: 100 } });
    const c = row({ faculties: { ...zeroFaculty(), memory: 200 } });
    const pulse = computeMindPulse([a, b, c]);
    expect(pulse.dominantFaculty?.key).toBe("speed");
    expect(pulse.facultyLeaders.find((l) => l.key === "speed")?.count).toBe(2);
  });
});

describe("ترتيب اللاعب ووصفه", () => {
  it("يحسب الموقع من قائمة مرتبة مقيّدة", () => {
    const pos = rankPosition(20, [50, 40, 30, 10], 4, 200);
    expect(pos.rank).toBe(4);
    expect(pos.ahead).toBe(3);
    expect(pos.ceilingReached).toBe(false);
  });

  it("يعلن وصول سقف الاستعلام بصدق", () => {
    const pos = rankPosition(5, [50, 40], 2, 2);
    expect(pos.ceilingReached).toBe(true);
  });

  it("يصف الموقع بجملة صادقة", () => {
    expect(describePosition({ rank: 1, total: 1, ahead: 0, ceilingReached: false })).toContain("أول عقل");
    expect(describePosition({ rank: 1, total: 8, ahead: 0, ceilingReached: false })).toContain("القمة");
    expect(describePosition({ rank: 3, total: 11, ahead: 2, ceilingReached: false })).toContain("ترتيبك 3");
  });
});

describe("تكامل ثابت: المفاتيح والبيانات الوصفية", () => {
  it("لكل قوة وصف حقيقي لما تغذّيه في اللعب", () => {
    for (const k of FACULTY_KEYS) {
      expect(FACULTY_META[k].name.length).toBeGreaterThan(0);
      expect(FACULTY_META[k].feeds.length).toBeGreaterThan(0);
    }
  });

  it("اقوى قوة تُختار من الأرصدة فعلاً", () => {
    const f = zeroFaculty();
    f.intuition = 40;
    f.knowledge = 41;
    expect(dominantFaculty(f).key).toBe("knowledge");
    expect(dominantFaculty(zeroFaculty()).key).toBe(FACULTY_KEYS[0]);
  });
});
