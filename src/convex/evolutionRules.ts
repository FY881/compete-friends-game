/**
 * ⚖️ سطح القوانين الحيّة (Live Rule Surface)
 *
 * هذه الوحدة النقية تعرّف القوانين التي يملك الحاكم السيادي حقّ تعديلها
 * فعلياً، مع حدودها الدنيا والقصوى. القيم الافتراضية مأخوذة من
 * `gameConfig.ts` — أي أنها القيم التي تعمل بها اللعبة الآن.
 *
 * لا تتصل بـ Convex ولا تكتب شيئاً: تُستخدم من الخادم (المسارات الحسّاسة)
 * ومن الواجهة (معاينة قبل/بعد) معاً، ومغطاة باختبارات وحدة.
 */
import {
  DAILY_XP_BASE,
  DAILY_XP_CAP,
  DAILY_XP_STEP,
  DIFFICULTY_BASE_POINTS,
  DIFFICULTY_SPEED_BONUS,
  FIRST_BLOOD_BONUS,
  FIRST_GAME_OF_DAY_XP,
  GOLDEN_QUESTION_MULTIPLIER,
  MAX_STREAK_BONUS,
  STREAK_BONUS_PER_STEP,
  XP_FOR_STREAK_3,
  XP_FOR_STREAK_5,
  XP_FOR_WIN,
  XP_PER_CORRECT_ANSWER,
  XP_PER_GAME,
  XP_PERFECT_GAME,
} from "./gameConfig";

export type RuleDef = {
  /** مسار داخل كائن القوانين، مثل "scoring.base.hard" */
  path: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
};

/** كائن القوانين الفعّال الذي تقرأه مسارات اللعب الحقيقية. */
export type LiveRules = {
  scoring: {
    base: { easy: number; medium: number; hard: number; extreme: number };
    speed: { easy: number; medium: number; hard: number; extreme: number };
    streakBonusPerStep: number;
    maxStreakBonus: number;
    firstBloodBonus: number;
    goldenMultiplier: number;
  };
  xp: {
    perGame: number;
    perCorrect: number;
    forWin: number;
    forStreak3: number;
    forStreak5: number;
    perfect: number;
    firstOfDay: number;
  };
  daily: { base: number; step: number; cap: number };
};

export const DEFAULT_LIVE_RULES: LiveRules = {
  scoring: {
    base: { easy: DIFFICULTY_BASE_POINTS.easy, medium: DIFFICULTY_BASE_POINTS.medium, hard: DIFFICULTY_BASE_POINTS.hard, extreme: DIFFICULTY_BASE_POINTS.extreme },
    speed: { easy: DIFFICULTY_SPEED_BONUS.easy, medium: DIFFICULTY_SPEED_BONUS.medium, hard: DIFFICULTY_SPEED_BONUS.hard, extreme: DIFFICULTY_SPEED_BONUS.extreme },
    streakBonusPerStep: STREAK_BONUS_PER_STEP,
    maxStreakBonus: MAX_STREAK_BONUS,
    firstBloodBonus: FIRST_BLOOD_BONUS,
    goldenMultiplier: GOLDEN_QUESTION_MULTIPLIER,
  },
  xp: {
    perGame: XP_PER_GAME,
    perCorrect: XP_PER_CORRECT_ANSWER,
    forWin: XP_FOR_WIN,
    forStreak3: XP_FOR_STREAK_3,
    forStreak5: XP_FOR_STREAK_5,
    perfect: XP_PERFECT_GAME,
    firstOfDay: FIRST_GAME_OF_DAY_XP,
  },
  daily: { base: DAILY_XP_BASE, step: DAILY_XP_STEP, cap: DAILY_XP_CAP },
};

/** كل قانون قابل للتعديل بحدوده. الحدود هي خط الأمان الأخير للخادم. */
export const RULE_DEFS: RuleDef[] = [
  { path: "scoring.base.easy", label: "نقاط الإجابة الصحيحة — سهل", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.scoring.base.easy },
  { path: "scoring.base.medium", label: "نقاط الإجابة الصحيحة — متوسط", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.scoring.base.medium },
  { path: "scoring.base.hard", label: "نقاط الإجابة الصحيحة — صعب", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.scoring.base.hard },
  { path: "scoring.base.extreme", label: "نقاط الإجابة الصحيحة — شبه مستحيل", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.scoring.base.extreme },
  { path: "scoring.speed.easy", label: "مكافأة السرعة — سهل", min: 0, max: 2000, defaultValue: DEFAULT_LIVE_RULES.scoring.speed.easy },
  { path: "scoring.speed.medium", label: "مكافأة السرعة — متوسط", min: 0, max: 2000, defaultValue: DEFAULT_LIVE_RULES.scoring.speed.medium },
  { path: "scoring.speed.hard", label: "مكافأة السرعة — صعب", min: 0, max: 2000, defaultValue: DEFAULT_LIVE_RULES.scoring.speed.hard },
  { path: "scoring.speed.extreme", label: "مكافأة السرعة — شبه مستحيل", min: 0, max: 2000, defaultValue: DEFAULT_LIVE_RULES.scoring.speed.extreme },
  { path: "scoring.streakBonusPerStep", label: "مكافأة السلسلة لكل خطوة", min: 0, max: 200, defaultValue: DEFAULT_LIVE_RULES.scoring.streakBonusPerStep },
  { path: "scoring.maxStreakBonus", label: "سقف مكافأة السلسلة", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.scoring.maxStreakBonus },
  { path: "scoring.firstBloodBonus", label: "مكافأة الأسبق للإجابة", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.scoring.firstBloodBonus },
  { path: "scoring.goldenMultiplier", label: "مضاعف السؤال الذهبي", min: 1, max: 5, defaultValue: DEFAULT_LIVE_RULES.scoring.goldenMultiplier },
  { path: "xp.perGame", label: "خبرة لكل جولة", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.xp.perGame },
  { path: "xp.perCorrect", label: "خبرة لكل إجابة صحيحة", min: 0, max: 200, defaultValue: DEFAULT_LIVE_RULES.xp.perCorrect },
  { path: "xp.forWin", label: "خبرة الفوز", min: 0, max: 1000, defaultValue: DEFAULT_LIVE_RULES.xp.forWin },
  { path: "xp.forStreak3", label: "خبرة سلسلة ٣", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.xp.forStreak3 },
  { path: "xp.forStreak5", label: "خبرة سلسلة ٥", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.xp.forStreak5 },
  { path: "xp.perfect", label: "خبرة الجولة الكاملة", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.xp.perfect },
  { path: "xp.firstOfDay", label: "خبرة أول جولة في اليوم", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.xp.firstOfDay },
  { path: "daily.base", label: "المكافأة اليومية — الأساس", min: 0, max: 500, defaultValue: DEFAULT_LIVE_RULES.daily.base },
  { path: "daily.step", label: "المكافأة اليومية — الزيادة اليومية", min: 0, max: 200, defaultValue: DEFAULT_LIVE_RULES.daily.step },
  { path: "daily.cap", label: "المكافأة اليومية — السقف", min: 0, max: 2000, defaultValue: DEFAULT_LIVE_RULES.daily.cap },
];

/** مفاتيح وحدات runtime التي تحمل القوانين الحيّة — واقعية داخل evolutionModules. */
export const RULE_MODULE_KEYS = ["live_scoring", "live_xp_economy", "live_daily_rewards"] as const;
export type RuleModuleKey = (typeof RULE_MODULE_KEYS)[number];

const RULE_PREFIX: Record<RuleModuleKey, string> = {
  live_scoring: "scoring.",
  live_xp_economy: "xp.",
  live_daily_rewards: "daily.",
};

/** هل هذا المفتاح سطح قوانين حيّة؟ وما حدوده؟ */
export function ruleSurfaceFor(moduleKey: string): RuleDef[] | null {
  const prefix = (RULE_PREFIX as Record<string, string>)[moduleKey];
  if (!prefix) return null;
  return RULE_DEFS.filter((def) => def.path.startsWith(prefix));
}

export function isRuleModuleKey(moduleKey: string): moduleKey is RuleModuleKey {
  return ruleSurfaceFor(moduleKey) !== null;
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

function writePath(target: Record<string, unknown>, path: string, value: number): void {
  const parts = path.split(".");
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const next = node[parts[i]];
    if (!next || typeof next !== "object") node[parts[i]] = {};
    node = node[parts[i]] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

export type RuleRejection = { moduleKey: string; field: string; reason: string };

export type ResolvedRules = {
  rules: LiveRules;
  /** مفاتيح الوحدات النشطة التي أثّرت فعلاً على اللعبة */
  applied: string[];
  /** حقول رُفضت لأنها غير رقمية أو خارج الحدود — لا تُطبَّق أبداً */
  rejected: RuleRejection[];
};

/**
 * يُرجع القوانين الفعّالة: القيم الافتراضية + تجاوزات الوحدات النشطة فقط.
 * أي قيمة خارج الحدود أو غير رقمية تُرفض وتُسجَّل، ولا تُطبَّق على اللعبة.
 */
export function resolveLiveRules(
  modules: ReadonlyArray<{ key: string; status: string; config: string }>,
): ResolvedRules {
  const rules = JSON.parse(JSON.stringify(DEFAULT_LIVE_RULES)) as LiveRules;
  const applied: string[] = [];
  const rejected: RuleRejection[] = [];

  for (const module of modules) {
    if (module.status !== "active") continue;
    const defs = ruleSurfaceFor(module.key);
    if (!defs) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(module.config || "{}");
    } catch {
      rejected.push({ moduleKey: module.key, field: "*", reason: "الإعداد ليس JSON صالحاً" });
      continue;
    }
    if (!parsed || typeof parsed !== "object") {
      rejected.push({ moduleKey: module.key, field: "*", reason: "الإعداد ليس كائناً" });
      continue;
    }
    let touched = false;
    for (const def of defs) {
      const raw = readPath(parsed, def.path);
      if (raw === undefined || raw === null) continue;
      const value = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(value)) {
        rejected.push({ moduleKey: module.key, field: def.path, reason: "قيمة غير رقمية" });
        continue;
      }
      if (value < def.min || value > def.max) {
        rejected.push({ moduleKey: module.key, field: def.path, reason: `خارج الحدود (${def.min}–${def.max})` });
        continue;
      }
      writePath(rules as unknown as Record<string, unknown>, def.path, value);
      touched = true;
    }
    if (touched && !applied.includes(module.key)) applied.push(module.key);
  }

  return { rules, applied, rejected };
}

export type RuleValidation = {
  /** null يعني أن المفتاح ليس سطح قوانين حيّة (مسار وحدة عادي). */
  values: Record<string, number> | null;
  errors: string[];
  ignored: string[];
};

/**
 * تحقق صارم من إعداد قانون مقترح: كل قيمة يجب أن تكون رقمية وداخل الحدود.
 * يُستخدم عند الاقتراح وعند التنفيذ — فلا يُكتب على اللعبة شيء خارج الحدود.
 */
export function validateRuleConfig(moduleKey: string, config: unknown): RuleValidation {
  const defs = ruleSurfaceFor(moduleKey);
  if (!defs) return { values: null, errors: [], ignored: [] };

  let parsed: unknown = config;
  if (typeof config === "string") {
    try {
      parsed = JSON.parse(config || "{}");
    } catch {
      return { values: {}, errors: ["الإعداد ليس JSON صالحاً"], ignored: [] };
    }
  }
  if (!parsed || typeof parsed !== "object") return { values: {}, errors: ["الإعداد ليس كائناً"], ignored: [] };

  const values: Record<string, number> = {};
  const errors: string[] = [];
  for (const def of defs) {
    const raw = readPath(parsed, def.path);
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      errors.push(`${def.label}: قيمة غير رقمية`);
      continue;
    }
    if (value < def.min || value > def.max) {
      errors.push(`${def.label}: ${value} خارج الحدود (${def.min}–${def.max})`);
      continue;
    }
    values[def.path] = value;
  }

  const known = new Set(defs.map((def) => def.path.split(".")[0]));
  const branches = Object.keys(parsed as Record<string, unknown>);
  const ignored = branches.filter((branch) => !known.has(branch));
  return { values, errors, ignored };
}

export type RulePreviewRow = {
  path: string;
  label: string;
  from: number;
  to: number;
  changed: boolean;
  status: "ok" | "out_of_bounds" | "invalid";
};

/**
 * معاينة حقيقية قبل/بعد: تقارن ما سيصبح عليه القانون فعلاً بالقيمة الحيّة الآن.
 * تُستخدم في واجهة إذن المالك حتى يرى بالضبط ما ستُغيَّره اللعبة.
 */
export function previewRuleConfig(moduleKey: string, config: unknown, live: LiveRules): RulePreviewRow[] {
  const defs = ruleSurfaceFor(moduleKey);
  if (!defs) return [];
  let parsed: unknown = config;
  if (typeof config === "string") {
    try {
      parsed = JSON.parse(config || "{}");
    } catch {
      return defs.map((def) => ({ path: def.path, label: def.label, from: readPath(live, def.path) as number, to: Number.NaN, changed: true, status: "invalid" as const }));
    }
  }
  const rows: RulePreviewRow[] = [];
  for (const def of defs) {
    const from = (readPath(live, def.path) as number) ?? def.defaultValue;
    const raw = readPath(parsed, def.path);
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === "number" ? raw : Number(raw);
    const invalid = !Number.isFinite(value);
    const outOfBounds = !invalid && (value < def.min || value > def.max);
    rows.push({
      path: def.path,
      label: def.label,
      from,
      to: invalid ? Number.NaN : value,
      changed: invalid || value !== from,
      status: invalid ? "invalid" : outOfBounds ? "out_of_bounds" : "ok",
    });
  }
  return rows;
}

/** الفروق الفعلية بين قوانين قبل وقوانين بعد — تُستخدم في سجل التغييرات. */
export function diffLiveRules(before: LiveRules, after: LiveRules): RulePreviewRow[] {
  return RULE_DEFS.map((def) => {
    const from = Number(readPath(before, def.path) ?? def.defaultValue);
    const to = Number(readPath(after, def.path) ?? def.defaultValue);
    return { path: def.path, label: def.label, from, to, changed: from !== to, status: "ok" as const };
  }).filter((row) => row.changed);
}

/** يدمج قيماً مُتحقَّقاً منها (بمسارات نقطية) فوق إعداد قائم ويُعيد الكائن المتداخل. */
export function applyRuleValues(base: unknown, values: Record<string, number>): Record<string, unknown> {
  const target: Record<string, unknown> =
    base && typeof base === "object" && !Array.isArray(base)
      ? (JSON.parse(JSON.stringify(base)) as Record<string, unknown>)
      : {};
  for (const [path, value] of Object.entries(values)) writePath(target, path, value);
  return target;
}

/** يدمج قيماً مُتحقَّقاً منها فوق إعداد وحدة قائم (نص JSON) ويُعيد نصاً جاهزاً للتخزين. */
export function mergeRuleConfig(existingConfig: string | undefined, values: Record<string, number>): string {
  let base: unknown = {};
  try {
    base = JSON.parse(existingConfig || "{}");
  } catch {
    base = {};
  }
  return JSON.stringify(applyRuleValues(base, values));
}

/** وصف مقروء لحدود القانون للتضمين في تعليمات الحاكم. */
export function ruleSurfaceBrief(moduleKey: string): string {
  const defs = ruleSurfaceFor(moduleKey);
  if (!defs) return "";
  return defs.map((def) => `${def.path} (${def.min}..${def.max})`).join("، ");
}
