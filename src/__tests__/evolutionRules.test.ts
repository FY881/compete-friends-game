import { describe, expect, it } from "vitest";
import {
  applyRuleValues,
  DEFAULT_LIVE_RULES,
  diffLiveRules,
  mergeRuleConfig,
  previewRuleConfig,
  resolveLiveRules,
  ruleSurfaceFor,
  validateRuleConfig,
} from "../convex/evolutionRules";
import { DIFFICULTY_BASE_POINTS, GOLDEN_QUESTION_MULTIPLIER, XP_FOR_WIN } from "../convex/gameConfig";

describe("Live rule defaults", () => {
  it("mirror the real game constants", () => {
    expect(DEFAULT_LIVE_RULES.scoring.base.hard).toBe(DIFFICULTY_BASE_POINTS.hard);
    expect(DEFAULT_LIVE_RULES.scoring.goldenMultiplier).toBe(GOLDEN_QUESTION_MULTIPLIER);
    expect(DEFAULT_LIVE_RULES.xp.forWin).toBe(XP_FOR_WIN);
  });
});

describe("resolveLiveRules", () => {
  const scoringModule = {
    key: "live_scoring",
    status: "active",
    config: JSON.stringify({ scoring: { base: { hard: 260 }, goldenMultiplier: 3 } }),
  };

  it("returns the defaults when nothing overrides them", () => {
    const { rules, applied, rejected } = resolveLiveRules([]);
    expect(rules).toEqual(DEFAULT_LIVE_RULES);
    expect(applied).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("applies real values coming from an active rule module", () => {
    const { rules, applied, rejected } = resolveLiveRules([scoringModule]);
    expect(rules.scoring.base.hard).toBe(260);
    expect(rules.scoring.goldenMultiplier).toBe(3);
    expect(rules.scoring.base.easy).toBe(DEFAULT_LIVE_RULES.scoring.base.easy);
    expect(applied).toEqual(["live_scoring"]);
    expect(rejected).toEqual([]);
  });

  it("ignores disabled modules and keys outside the rule surface", () => {
    const { applied } = resolveLiveRules([
      { ...scoringModule, status: "disabled" },
      { key: "some_feature", status: "active", config: "{}" },
    ]);
    expect(applied).toEqual([]);
  });

  it("refuses out-of-bounds and non-numeric values instead of applying them", () => {
    const { rules, rejected } = resolveLiveRules([
      {
        key: "live_scoring",
        status: "active",
        config: JSON.stringify({ scoring: { base: { hard: 99_999 }, firstBloodBonus: "كثير" } }),
      },
    ]);
    expect(rules.scoring.base.hard).toBe(DEFAULT_LIVE_RULES.scoring.base.hard);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((row) => row.moduleKey === "live_scoring")).toBe(true);
  });

  it("rejects a module whose config is not valid JSON", () => {
    const { rejected } = resolveLiveRules([{ key: "live_xp_economy", status: "active", config: "{broken" }]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].field).toBe("*");
  });
});

describe("validateRuleConfig", () => {
  it("returns null values for modules outside the rule surface", () => {
    expect(validateRuleConfig("arena_rules", "{}").values).toBeNull();
  });

  it("collects bounded values and reports violations", () => {
    const check = validateRuleConfig("live_xp_economy", JSON.stringify({ xp: { forWin: 80, perGame: 5_000 } }));
    expect(check.values).toEqual({ "xp.forWin": 80 });
    expect(check.errors.some((message) => message.includes("خبرة لكل جولة"))).toBe(true);
  });

  it("reports branches outside the surface so they are never written", () => {
    const check = validateRuleConfig(
      "live_scoring",
      JSON.stringify({ scoring: { firstBloodBonus: 10 }, unrelated: { x: 1 } }),
    );
    expect(check.ignored).toEqual(["unrelated"]);
    expect(check.values).toEqual({ "scoring.firstBloodBonus": 10 });
  });
});

describe("Rule preview and merge", () => {
  it("previews the real before/after values the owner is approving", () => {
    const rows = previewRuleConfig(
      "live_scoring",
      JSON.stringify({ scoring: { goldenMultiplier: 4, base: { hard: 99_999 } } }),
      DEFAULT_LIVE_RULES,
    );
    const golden = rows.find((row) => row.path === "scoring.goldenMultiplier");
    expect(golden?.from).toBe(DEFAULT_LIVE_RULES.scoring.goldenMultiplier);
    expect(golden?.to).toBe(4);
    expect(golden?.status).toBe("ok");
    expect(rows.find((row) => row.path === "scoring.base.hard")?.status).toBe("out_of_bounds");
  });

  it("merges validated values over the existing config without dropping the others", () => {
    const existing = JSON.stringify({ scoring: { base: { easy: 120 }, firstBloodBonus: 40 } });
    const merged = JSON.parse(mergeRuleConfig(existing, { "scoring.goldenMultiplier": 3 })) as {
      scoring: { goldenMultiplier: number; base: { easy: number }; firstBloodBonus: number };
    };
    expect(merged.scoring.goldenMultiplier).toBe(3);
    expect(merged.scoring.base.easy).toBe(120);
    expect(merged.scoring.firstBloodBonus).toBe(40);
  });

  it("diffs two rule sets down to the fields that really changed", () => {
    const after = applyRuleValues(DEFAULT_LIVE_RULES, { "xp.forWin": 60 }) as unknown as typeof DEFAULT_LIVE_RULES;
    const diffs = diffLiveRules(DEFAULT_LIVE_RULES, after);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe("xp.forWin");
    expect(diffs[0].to).toBe(60);
  });

  it("exposes bounded surfaces per module key", () => {
    const defs = ruleSurfaceFor("live_daily_rewards");
    expect(defs?.every((def) => def.path.startsWith("daily."))).toBe(true);
    expect(ruleSurfaceFor("arena_rules")).toBeNull();
  });
});
