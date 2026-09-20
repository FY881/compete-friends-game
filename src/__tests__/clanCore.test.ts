import { describe, expect, it } from "vitest";
import {
  CLAN_GOALS,
  CLAN_RANKS,
  FAIR_EQUAL_SHARE_PCT,
  MAX_CLAN_POWER,
  MAX_MEMBER_POWER,
  clanPerks,
  clanRankFor,
  clanRankProgress,
  classifyViolation,
  computeClanPower,
  computeClanPulse,
  contributionWeight,
  describeClanStanding,
  explainShare,
  goalProgressPct,
  goalReward,
  goalTarget,
  memberPower,
  nextClanRank,
  scoreClanMessage,
  sortContributors,
  splitReward,
  violationLabel,
} from "@/convex/clanCore";

const mind = (userId: string, tierScore: number, sessions: number, name = userId) => ({
  userId,
  name,
  tierScore,
  sessions,
});

describe("سلّم رتب العشائر ومزاياها", () => {
  it("يعطي الرتبة الصحيحة عند العتبات", () => {
    expect(clanRankFor(0).level).toBe(1);
    expect(clanRankFor(399).level).toBe(1);
    expect(clanRankFor(400).level).toBe(2);
    expect(clanRankFor(MAX_CLAN_POWER).level).toBe(CLAN_RANKS.length);
    expect(clanRankFor(Number.NaN).level).toBe(1);
    expect(clanRankFor(-50).level).toBe(1);
  });

  it("المزايا أرقام حقيقية تتدرّج مع الرتبة", () => {
    expect(clanPerks(1).warPointsPct).toBe(0);
    expect(clanPerks(4).warPointsPct).toBe(12);
    expect(clanPerks(6).goalRewardPct).toBeGreaterThan(clanPerks(4).goalRewardPct);
    expect(clanPerks(7).treasuryDiscountPct).toBe(10);
    expect(clanPerks(99).warPointsPct).toBe(clanPerks(CLAN_RANKS.length).warPointsPct);
    expect(clanPerks(0).warPointsPct).toBe(0);
  });

  it("التقدّم والرتبة التالية صحيحان", () => {
    expect(nextClanRank(0)?.rank.level).toBe(2);
    expect(nextClanRank(0)?.remaining).toBe(400);
    expect(nextClanRank(MAX_CLAN_POWER)).toBeNull();
    expect(clanRankProgress(0)).toBe(0);
    expect(clanRankProgress(200)).toBeCloseTo(0.5, 5);
    expect(clanRankProgress(MAX_CLAN_POWER)).toBe(1);
  });
});

describe("القوة الذهنية — من عقول الأعضاء فعلاً", () => {
  it("قوة العضو = قواه ×10 + عمق تدريبه", () => {
    expect(memberPower({ tierScore: 0, sessions: 0 })).toBe(0);
    expect(memberPower({ tierScore: 10, sessions: 0 })).toBe(100);
    expect(memberPower({ tierScore: 10, sessions: 100 })).toBe(150);
    // العمق مسقوف: لا تضخّم من جولات لا نهائية
    expect(memberPower({ tierScore: 0, sessions: 100_000 })).toBe(60);
  });

  it("لا تتجاوز قوة العضو السقف المعلن", () => {
    expect(memberPower({ tierScore: 66, sessions: 1000 })).toBeLessThanOrEqual(MAX_MEMBER_POWER);
  });

  it("تقرير القوة يرتّب الأعضاء ويكشف القادة والصامتين", () => {
    const report = computeClanPower([
      mind("a", 30, 50, "أحمد"),
      mind("b", 60, 200, "سارة"),
      mind("c", 0, 0, "خالد"),
    ]);
    expect(report.power).toBe(300 + 25 + 600 + 60 + 0);
    expect(report.memberCount).toBe(3);
    expect(report.champion?.name).toBe("سارة");
    expect(report.silentMembers).toBe(1);
    expect(report.topTier).toBe(60);
    expect(report.rank.level).toBe(clanRankFor(report.power).level);
    expect(report.members[0].power).toBeGreaterThanOrEqual(report.members[1].power);
  });

  it("عشيرة بلا أعضاء = قوة صفر ورتبة أولى", () => {
    const report = computeClanPower([]);
    expect(report.power).toBe(0);
    expect(report.rank.level).toBe(1);
    expect(report.champion).toBeNull();
  });
});

describe("الأهداف الأسبوعية — عدل لا تحيّز", () => {
  it("الهدف يتوسّع مع عدد الأعضاء", () => {
    const def = CLAN_GOALS[0];
    expect(goalTarget(def, 1)).toBe(def.base);
    expect(goalTarget(def, 3)).toBe(def.base + def.perMember * 2);
    expect(goalTarget(def, 0)).toBe(def.base);
  });

  it("مكافأة الهدف ترتفع بمزايا الرتبة", () => {
    const def = CLAN_GOALS[2];
    expect(goalReward(def, 1)).toBe(def.reward);
    expect(goalReward(def, 6)).toBeGreaterThan(def.reward);
  });

  it("نسبة التقدّم محصورة بين صفر وواحد", () => {
    expect(goalProgressPct(0, 10)).toBe(0);
    expect(goalProgressPct(5, 10)).toBe(0.5);
    expect(goalProgressPct(50, 10)).toBe(1);
  });

  it("كل هدف حقيقي: معرّف ووحدة ومكافأة", () => {
    for (const g of CLAN_GOALS) {
      expect(g.id.length).toBeGreaterThan(0);
      expect(g.unit.length).toBeGreaterThan(0);
      expect(g.reward).toBeGreaterThan(0);
      expect(g.perMember).toBeGreaterThan(0);
    }
  });
});

describe("التوزيع العادل للمكافآت", () => {
  it("المجموع يساوي المكافأة بالضبط (لا هللة تضيع)", () => {
    const shares = splitReward(1000, [10, 5, 3, 1]);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(1000);
  });

  it("من عمل أكثر أخذ أكثر — لكن المشاركة نفسها لها قيمة", () => {
    const shares = splitReward(1000, [100, 10]);
    expect(shares[0]).toBeGreaterThan(shares[1]);
    expect(shares[1]).toBeGreaterThan(0);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(1000);
  });

  it("لا مكافأة على الغياب", () => {
    const shares = splitReward(900, [50, 0, 40]);
    expect(shares[1]).toBe(0);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(900);
  });

  it("٣٠٪ تُقسَّم بالتساوي فعلاً", () => {
    const shares = splitReward(1000, [1, 1, 1, 1]);
    const each = 1000 / 4;
    for (const s of shares) expect(Math.abs(s - each)).toBeLessThanOrEqual(1);
    expect(FAIR_EQUAL_SHARE_PCT).toBe(30);
  });

  it("حالات حدّية: بلا مساهمات أو بلا أعضاء أو مكافأة صفر", () => {
    expect(splitReward(500, [0, 0])).toEqual([0, 0]);
    expect(splitReward(500, [])).toEqual([]);
    expect(splitReward(0, [5, 5])).toEqual([0, 0]);
    expect(splitReward(-100, [5])).toEqual([0]);
  });

  it("ترتيب المساهمين بعدل مع شرح حصة صادق", () => {
    const rows = [
      { userId: "a", name: "أ", rounds: 3, wins: 1, perfect: 0, points: 40 },
      { userId: "b", name: "ب", rounds: 9, wins: 5, perfect: 2, points: 120 },
    ];
    const sorted = sortContributors(rows);
    expect(sorted[0].userId).toBe("b");
    expect(contributionWeight(sorted[0])).toBe(120 + 2 * 15 + 5 * 5);
    expect(explainShare(sorted[0], 700, 1000)).toContain("70%");
    expect(explainShare(rows[0], 0, 1000)).toContain("لا مساهمة");
  });
});

describe("رقابة الدردشة — قرار مُفسَّر", () => {
  const base = { recentTimestamps: [], strikes: 0, now: 1_000_000 };

  it("الرسالة السليمة تمرّ", () => {
    const d = scoreClanMessage({ ...base, text: "جاهزون لجولة جماعية؟" });
    expect(d.verdict).toBe("ok");
    expect(d.reasons).toHaveLength(0);
  });

  it("التطاول يُرفض فوراً ويُصنَّف", () => {
    const d = scoreClanMessage({ ...base, text: "أنت غبي يا هذا" });
    expect(d.verdict).toBe("flag");
    expect(classifyViolation(d.reasons)).toBe("abuse");
    expect(violationLabel("abuse")).toContain("تطاول");
  });

  it("الروابط تُنبَّه لا تُرفض", () => {
    const d = scoreClanMessage({ ...base, text: "انضموا هنا https://x.com/y" });
    expect(d.verdict).toBe("warn");
    expect(classifyViolation(d.reasons)).toBe("link");
  });

  it("الفيضان يُرفض (٨ رسائل في دقيقة)", () => {
    const now = 1_000_000;
    const recent = Array.from({ length: 8 }, (_, i) => now - i * 1000);
    const d = scoreClanMessage({ ...base, now, recentTimestamps: recent, text: "هيا" });
    expect(d.verdict).toBe("flag");
    expect(classifyViolation(d.reasons)).toBe("flood");
  });

  it("الرسائل القديمة لا تُحتسب في الفيضان", () => {
    const now = 1_000_000;
    const recent = Array.from({ length: 20 }, (_, i) => now - 200_000 - i * 1000);
    const d = scoreClanMessage({ ...base, now, recentTimestamps: recent, text: "هيا" });
    expect(d.verdict).toBe("ok");
  });

  it("التكرار والصراخ تنبيهات مُصنَّفة", () => {
    const rep = scoreClanMessage({ ...base, text: "نفس الشيء", repeatCount: 3 });
    expect(rep.verdict).toBe("warn");
    expect(classifyViolation(rep.reasons)).toBe("repeat");

    const caps = scoreClanMessage({ ...base, text: "HELLO EVERYONE JOIN" });
    expect(caps.verdict).toBe("warn");
    expect(classifyViolation(caps.reasons)).toBe("caps");
  });

  it("السلوك المتكرر يُصعَّد إلى رفض بعد تنبيهين", () => {
    const d = scoreClanMessage({ ...base, strikes: 2, text: "انضموا https://a.b" });
    expect(d.verdict).toBe("flag");
    expect(d.reasons.join(" ")).toContain("سبق التنبيه");
  });

  it("الرسالة الفارغة تُرفض بوضوح", () => {
    const d = scoreClanMessage({ ...base, text: "   " });
    expect(d.verdict).toBe("mute");
    expect(d.message.length).toBeGreaterThan(0);
  });
});

describe("نبضة العشائر للمالك", () => {
  const row = (over: Partial<{ power: number; memberCount: number; pointsThisWeek: number; frozen: boolean }> = {}) => ({
    power: 1000,
    level: 3,
    memberCount: 5,
    pointsThisWeek: 300,
    ...over,
  });

  it("حالة فارغة صريحة", () => {
    const pulse = computeClanPulse([], []);
    expect(pulse.empty).toBe(true);
    expect(pulse.totalClans).toBe(0);
    expect(pulse.topViolation).toBeNull();
  });

  it("تحسب المجاميع والرتب والمخالفات", () => {
    const now = 5_000_000;
    const pulse = computeClanPulse(
      [row({ power: 5000 }), row({ power: 200, frozen: true }), row({ power: 1500 })],
      [
        { kind: "abuse", at: now - 1000 },
        { kind: "abuse", at: now - 2000 },
        { kind: "link", at: now - 86_400_001 },
      ],
      now,
    );
    expect(pulse.totalClans).toBe(3);
    expect(pulse.totalMembers).toBe(15);
    expect(pulse.topPower).toBe(5000);
    expect(pulse.frozen).toBe(1);
    expect(pulse.flags24h).toBe(2);
    expect(pulse.topViolation?.kind).toBe("abuse");
    expect(pulse.topViolation?.label).toContain("تطاول");
    expect(pulse.rankBuckets.reduce((s, b) => s + b.count, 0)).toBe(3);
  });

  it("جملة المكانة صادقة في كل الحالات", () => {
    expect(describeClanStanding(1, 1, 0)).toContain("الأولى");
    expect(describeClanStanding(1, 10, 5000)).toContain("الأقوى");
    expect(describeClanStanding(9, 10, 100)).toContain("ترتيبكم 9");
  });
});
