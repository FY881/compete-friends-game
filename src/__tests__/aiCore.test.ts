import { describe, expect, it } from "vitest";
import {
  ROOF_PROFILES,
  SENSITIVITY_DEFAULT,
  STALE_AFTER_MS,
  UNIT_BEHAVIOR,
  behaviorOf,
  computeRoofPulse,
  conflictKey,
  contextAlerts,
  describeConflict,
  detectConflicts,
  passesPolicy,
  policyFor,
  reviseByPolicy,
  sensitivityForProfile,
  stanceOf,
  summarizeContext,
  unitHealth,
  type ConflictEvent,
  type RoofContextInput,
  type UnitState,
} from "@/convex/aiCore";
import { scoreClanMessage } from "@/convex/clanCore";

const unit = (over: Partial<UnitState> = {}): UnitState => ({
  unit: "guardian",
  name: "الحارس",
  dept: "الرقابي",
  enabled: true,
  sensitivity: SENSITIVITY_DEFAULT,
  lastEventAt: Date.now(),
  eventCount: 5,
  ...over,
});

describe("الحساسية ⇒ سياسة حقيقية", () => {
  it("الحساسية ٥ تُنتج السلوك الحالي بالضبط (توافق كامل)", () => {
    const p = policyFor("guardian", SENSITIVITY_DEFAULT);
    expect(p.blockAt).toBe(6);
    expect(p.warnAt).toBe(2);
    expect(p.rateLimitPerMinute).toBe(8);
    expect(p.strikeTolerance).toBe(2);
    expect(p.label).toBe("متوازن");
  });

  it("الحساسية الأعلى تشدّد والأقل تتسامح — بشكل متدرّج", () => {
    const strict = policyFor("guardian", 10);
    const base = policyFor("guardian", 5);
    const relaxed = policyFor("guardian", 1);
    expect(strict.blockAt).toBeLessThan(base.blockAt);
    expect(relaxed.blockAt).toBeGreaterThan(base.blockAt);
    expect(strict.rateLimitPerMinute).toBeLessThan(base.rateLimitPerMinute);
    expect(relaxed.rateLimitPerMinute).toBeGreaterThan(base.rateLimitPerMinute);
    expect(strict.minConfidence).toBeGreaterThan(base.minConfidence);
    expect(strict.label).toBe("صارم جداً");
    expect(relaxed.label).toBe("متسامح جداً");
  });

  it("الحدود لا تخرج عن المدى الآمن مهما كان المدخل", () => {
    for (const s of [-50, 0, 1, 5, 10, 99, Number.NaN]) {
      const p = policyFor("guardian", s);
      expect(p.sensitivity).toBeGreaterThanOrEqual(1);
      expect(p.sensitivity).toBeLessThanOrEqual(10);
      expect(p.blockAt).toBeGreaterThanOrEqual(2);
      expect(p.blockAt).toBeLessThanOrEqual(10);
      expect(p.rateLimitPerMinute).toBeGreaterThanOrEqual(2);
      expect(p.rateLimitPerMinute).toBeLessThanOrEqual(40);
      expect(p.strikeTolerance).toBeGreaterThanOrEqual(1);
      expect(p.minConfidence).toBeGreaterThanOrEqual(0.3);
      expect(p.minConfidence).toBeLessThanOrEqual(0.98);
    }
  });

  it("لكل وحدة في النظام أثر موصوف", () => {
    for (const b of UNIT_BEHAVIOR) {
      expect(b.effect.length).toBeGreaterThan(0);
      expect(b.unit.length).toBeGreaterThan(0);
    }
    expect(behaviorOf("unknown-unit").unit).toBe("unknown-unit");
    expect(behaviorOf("guardian").scope).toBe("moderation");
  });

  it("الملفات الجاهزة تعطي قيماً متوقّعة", () => {
    expect(ROOF_PROFILES).toHaveLength(3);
    expect(sensitivityForProfile("balanced", "guardian")).toBe(SENSITIVITY_DEFAULT);
    expect(sensitivityForProfile("strict", "guardian")).toBeGreaterThan(SENSITIVITY_DEFAULT);
    expect(sensitivityForProfile("relaxed", "guardian")).toBeLessThan(SENSITIVITY_DEFAULT);
    // الرقابة تتشدّد أكثر من التوصيات في الوضع المتشدّد
    expect(sensitivityForProfile("strict", "guardian")).toBeGreaterThan(
      sensitivityForProfile("strict", "recommender"),
    );
  });
});

describe("الحساسية تُغيّر القرار فعلاً", () => {
  const decision = { verdict: "flag" as const, score: 4, reasons: ["روابط خارجية"] };

  it("التشديد يرفع التنبيه الحدّي إلى حجب", () => {
    const strict = policyFor("guardian", 9);
    const revised = reviseByPolicy({ ...decision, verdict: "warn" }, strict);
    expect(revised.verdict).toBe("flag");
    expect(revised.reasons.join(" ")).toContain("رُفع إلى حجب");
  });

  it("التسامح يخفّض الحجب الحدّي إلى تنبيه مع توضيح السبب", () => {
    const relaxed = policyFor("guardian", 1);
    const revised = reviseByPolicy(decision, relaxed);
    expect(revised.verdict).toBe("warn");
    expect(revised.reasons.join(" ")).toContain("خُفِّض إلى تنبيه");
  });

  it("القرارات السليمة لا تُلمس إطلاقاً", () => {
    const ok = { verdict: "ok" as const, score: 0, reasons: [] };
    expect(reviseByPolicy(ok, policyFor("guardian", 10))).toBe(ok);
  });

  it("passesPolicy يعكس حدّ الحجب المطبَّق", () => {
    expect(passesPolicy(5, policyFor("guardian", 5))).toBe(true);
    expect(passesPolicy(6, policyFor("guardian", 5))).toBe(false);
    expect(passesPolicy(6, policyFor("guardian", 10))).toBe(false);
  });

  it("🔗 تكامل حقيقي: حساسية الحارس تُغيّر حكم رسالة فعلية", () => {
    const text = "انضموا هنا https://example.com/room";
    const base = scoreClanMessage({
      text,
      recentTimestamps: [],
      strikes: 0,
      now: 1_000_000,
      limits: { rateLimit: policyFor("guardian", 5).rateLimitPerMinute, strikesBeforeMute: policyFor("guardian", 5).strikeTolerance },
    });
    const strict = reviseByPolicy(
      scoreClanMessage({
        text,
        recentTimestamps: [],
        strikes: 0,
        now: 1_000_000,
        limits: { rateLimit: policyFor("guardian", 10).rateLimitPerMinute, strikesBeforeMute: policyFor("guardian", 10).strikeTolerance },
      }),
      policyFor("guardian", 10),
    );
    const relaxed = reviseByPolicy(base, policyFor("guardian", 1));
    expect(base.verdict).toBe("warn");
    expect(strict.verdict).toBe("flag");
    expect(relaxed.verdict).toBe("warn");
  });

  it("🔗 تكامل حقيقي: حساسية الحارس تغيّر حدّ الإرسال السريع", () => {
    const now = 2_000_000;
    const recent = Array.from({ length: 6 }, (_, i) => now - i * 1000);
    const strict = policyFor("guardian", 10);
    const relaxed = policyFor("guardian", 1);
    const strictDecision = scoreClanMessage({
      text: "هيا نلعب",
      recentTimestamps: recent,
      strikes: 0,
      now,
      limits: { rateLimit: strict.rateLimitPerMinute, strikesBeforeMute: strict.strikeTolerance },
    });
    const relaxedDecision = scoreClanMessage({
      text: "هيا نلعب",
      recentTimestamps: recent,
      strikes: 0,
      now,
      limits: { rateLimit: relaxed.rateLimitPerMinute, strikesBeforeMute: relaxed.strikeTolerance },
    });
    expect(strictDecision.verdict).toBe("flag");
    expect(relaxedDecision.verdict).toBe("ok");
  });
});

describe("صحة الوحدات والسقف", () => {
  const now = 10_000_000_000;

  it("تصنّف كل حالة بدقة", () => {
    const rows = unitHealth(
      [
        unit({ unit: "a", lastEventAt: now - 1000, enabled: true }),
        unit({ unit: "b", lastEventAt: now - 1000, enabled: false }),
        unit({ unit: "c", lastEventAt: null }),
        unit({ unit: "d", lastEventAt: now - STALE_AFTER_MS - 1000 }),
        unit({ unit: "e", lastEventAt: now - 2 * 86_400_000, eventCount: 1 }),
        unit({ unit: "f", lastEventAt: now - 1000, eventCount: 9999 }),
      ],
      now,
    );
    const byUnit = new Map(rows.map((r) => [r.unit, r.status]));
    expect(byUnit.get("a")).toBe("healthy");
    expect(byUnit.get("b")).toBe("disabled");
    expect(byUnit.get("c")).toBe("silent");
    expect(byUnit.get("d")).toBe("stale");
    expect(byUnit.get("e")).toBe("idle");
    expect(byUnit.get("f")).toBe("noisy");
  });

  it("نبضة السقف تعطي درجة وصحة وإحصاءات", () => {
    const rows = unitHealth(
      [
        unit({ unit: "a", lastEventAt: now - 1000 }),
        unit({ unit: "b", lastEventAt: now - 1000, eventCount: 40 }),
        unit({ unit: "c", lastEventAt: null }),
      ],
      now,
    );
    const pulse = computeRoofPulse(rows);
    expect(pulse.totalUnits).toBe(3);
    expect(pulse.enabled).toBe(3);
    expect(pulse.healthy).toBe(2);
    expect(pulse.silent).toBe(1);
    expect(pulse.score).toBeGreaterThan(0);
    expect(pulse.score).toBeLessThanOrEqual(100);
    expect(pulse.busiest?.unit).toBe("b");
    expect(pulse.avgSensitivity).toBe(SENSITIVITY_DEFAULT);
  });

  it("السقف الفارغ = صفر بلا انفجار", () => {
    const pulse = computeRoofPulse([]);
    expect(pulse.score).toBe(0);
    expect(pulse.busiest).toBeNull();
  });
});

describe("كشف خلافات الوحدات", () => {
  const ev = (over: Partial<ConflictEvent>): ConflictEvent => ({
    unit: "guardian",
    kind: "decision",
    severity: "info",
    summary: "قرار",
    target: "player-1",
    at: 1000,
    ...over,
  });

  it("يميّز موقف التشديد من التخفيف", () => {
    expect(stanceOf(ev({ kind: "ban", summary: "حظر العضو" }))).toBe("restrict");
    expect(stanceOf(ev({ kind: "pardon", summary: "عفو عن اللاعب" }))).toBe("allow");
    expect(stanceOf(ev({ kind: "note", severity: "info", summary: "ملاحظة" }))).toBeNull();
  });

  it("يكشف خلافاً حقيقياً بين وحدتين على نفس الهدف", () => {
    const conflicts = detectConflicts(
      [
        ev({ unit: "guardian", kind: "ban", summary: "حظر اللاعب", severity: "warn", at: 1000 }),
        ev({ unit: "referee", kind: "pardon", summary: "عفو — لا غش", severity: "info", at: 1500 }),
      ],
      86_400_000,
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].target).toBe("player-1");
    expect(conflicts[0].unitA).toBe("guardian");
    expect(conflicts[0].unitB).toBe("referee");
    expect(describeConflict(conflicts[0])).toContain("يحتاج قرارك");
  });

  it("لا خلاف إذا اتفقت الوحدات أو اختلفت الوحدة مع نفسها", () => {
    expect(
      detectConflicts([
        ev({ unit: "guardian", kind: "ban", summary: "حظر", severity: "warn" }),
        ev({ unit: "guardian", kind: "pardon", summary: "عفو" }),
      ]),
    ).toHaveLength(0);
    expect(
      detectConflicts([
        ev({ unit: "guardian", kind: "ban", summary: "حظر", severity: "warn" }),
        ev({ unit: "referee", kind: "ban", summary: "حظر أيضاً", severity: "warn" }),
      ]),
    ).toHaveLength(0);
  });

  it("يتجاهل الأحداث بلا هدف معروف", () => {
    expect(
      detectConflicts([
        ev({ unit: "guardian", kind: "ban", summary: "حظر", target: null }),
        ev({ unit: "referee", kind: "pardon", summary: "عفو", target: null }),
      ]),
    ).toHaveLength(0);
  });

  it("بصمة الخلاف ثابتة مهما اختلف ترتيب الوحدتين", () => {
    const a = detectConflicts([
      ev({ unit: "guardian", kind: "ban", summary: "حظر", severity: "warn", at: 1 }),
      ev({ unit: "referee", kind: "pardon", summary: "عفو", at: 2 }),
    ])[0];
    const b = detectConflicts([
      ev({ unit: "referee", kind: "pardon", summary: "عفو", at: 2 }),
      ev({ unit: "guardian", kind: "ban", summary: "حظر", severity: "warn", at: 1 }),
    ])[0];
    expect(conflictKey(a)).toBe(conflictKey(b));
  });
});

describe("السياق المشترك الحيّ", () => {
  const ctx: RoofContextInput = {
    minds: { total: 12, active24h: 5, avgTier: 22.5, frozen: 1 },
    clans: { total: 3, members: 14, avgPower: 1500, frozen: 0, flags24h: 11 },
    reports: { open: 4, critical: 1 },
    errors: { last24h: 7, critical: 0 },
    economy: { treasuryCoinsTotal: 4200, guildGoalsClaimed: 6 },
  };

  it("يلخّص الحالة بجمل عربية صادقة", () => {
    const lines = summarizeContext(ctx);
    expect(lines).toHaveLength(5);
    expect(lines.join(" ")).toContain("12 عقل");
    expect(lines.join(" ")).toContain("3 عشيرة");
    expect(lines.join(" ")).toContain("4 بلاغ مفتوح");
    expect(lines.join(" ")).toContain("خزائن العشائر 4200");
  });

  it("حالة فارغة تُوصف بوضوح لا بأصفار مبهمة", () => {
    const empty = summarizeContext({
      minds: { total: 0, active24h: 0, avgTier: 0, frozen: 0 },
      clans: { total: 0, members: 0, avgPower: 0, frozen: 0, flags24h: 0 },
      reports: { open: 0, critical: 0 },
      errors: { last24h: 0, critical: 0 },
      economy: { treasuryCoinsTotal: 0, guildGoalsClaimed: 0 },
    });
    expect(empty.join(" ")).toContain("لا عقول مسجَّلة");
    expect(empty.join(" ")).toContain("لا عشائر بعد");
    expect(empty.join(" ")).toContain("لا بلاغات مفتوحة");
    expect(empty.join(" ")).toContain("لا أخطاء نظام");
  });

  it("تنبيهات السياق تُشتق من الأرقام فعلاً", () => {
    const alerts = contextAlerts(ctx);
    expect(alerts.map((a) => a.text).join(" ")).toContain("بلاغ حرج");
    expect(alerts.map((a) => a.text).join(" ")).toContain("حساسية الحارس");
    expect(contextAlerts({ ...ctx, reports: { open: 0, critical: 0 }, clans: { ...ctx.clans, flags24h: 0 } })).toHaveLength(0);
  });

  it("خمول المجتمع يُنبّه عليه", () => {
    const alerts = contextAlerts({ ...ctx, minds: { total: 9, active24h: 0, avgTier: 10, frozen: 0 } });
    expect(alerts.map((a) => a.text).join(" ")).toContain("خامل");
  });
});
