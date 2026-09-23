/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 نواة مركز API — منطق نقي بلا قاعدة بيانات ولا شبكة (قابل للاختبار)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل قرار حقيقي في مركز API يُحسب هنا أولاً:
 *
 *  ① قوالب المزوّدين  — تجعل أي API جديد يعمل بلا تعديل كود.
 *  ② سجل وحدات AI     — كل وحدة في اللعبة لها توجيهها الخاص.
 *  ③ تطبيع الرابط     — يقبل `api.minimax.io/v1` ويحوّله لنقطة اتصال صحيحة.
 *  ④ سلاسل النماذج    — التفضيل ← قالب المزوّد ← المُكتشَف ← الاحتياطي.
 *  ⑤ قرارات الحماية   — كاش / سقف يومي / حد الدقيقة / قاطع الدائرة.
 *
 * لا يستورد هذا الملف أي شيء من Convex: لذلك قواعده تُختبر مباشرة.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// ① قوالب المزوّدين — كل مزوّد = بيانات، لا كود
// ═══════════════════════════════════════════════════════════════════════

export type AuthStyle = "bearer" | "header" | "query" | "none";

export type ProviderPreset = {
  id: string;
  label: string;
  /** سلسلة تُطابق المضيف لاكتشاف المزوّد تلقائياً */
  hostPattern: string;
  /** الرابط الأساسي المقترح */
  baseUrl: string;
  /** مسار المحادثة (يُلحق بالأساس إن لم يكن موجوداً) */
  chatPath: string;
  /** مسار قائمة النماذج */
  modelsPath: string;
  /** نماذج معروفة مضمونة، مرتّبة بالأسرع أولاً */
  models: string[];
  authStyle: AuthStyle;
  authHeaderName?: string;
  /** هل يقبل response_format: { type: "json_object" }؟ */
  supportsJsonMode: boolean;
  /** يفصل نص التفكير في reasoning_details بدل content */
  reasoningSplit: boolean;
  /** يقبل تعطيل التفكير عبر thinking:{type:"disabled"} */
  thinkingToggle: boolean;
  /** بادئة النماذج التي يقبل معها تعطيل التفكير */
  thinkingTogglePrefixes: string[];
  /** ما هي وحدة المزود — تُعرض في الواجهة */
  notes: string;
};

/**
 * القوالب الجاهزة. الأول هو المسار المُوصى به (MiniMax) لأنه يعطي
 * رابطاً توافقياً مع OpenAI + نماذج سريعة مناسبة لذكاء داخل لعبة.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "minimax",
    label: "MiniMax — M-series (موصى به)",
    hostPattern: "minimax",
    baseUrl: "https://api.minimax.io/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    // مرتّبة بالأسرع أولاً: ذكاء اللعبة يحتاج زمن استجابة منخفضاً
    models: [
      "MiniMax-M2.7-highspeed",
      "MiniMax-M2.5-highspeed",
      "MiniMax-M2.1-highspeed",
      "MiniMax-M2",
      "MiniMax-M2.5",
      "MiniMax-M2.1",
      "MiniMax-M2.7",
      "MiniMax-M3",
    ],
    authStyle: "bearer",
    supportsJsonMode: false,
    reasoningSplit: true,
    thinkingToggle: true,
    thinkingTogglePrefixes: ["MiniMax-M3"],
    notes: "واجهة متوافقة مع OpenAI. النماذج العادية تُخرج التفكير داخل <think> — نُنظّفه قبل الاستخدام.",
  },
  {
    id: "openrouter",
    label: "OpenRouter — بوابة النماذج",
    hostPattern: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    models: ["openrouter/auto", "openai/gpt-4o-mini"],
    authStyle: "bearer",
    supportsJsonMode: true,
    reasoningSplit: false,
    thinkingToggle: false,
    thinkingTogglePrefixes: [],
    notes: "بوابة تدعم مئات النماذج بمفتاح واحد.",
  },
  {
    id: "openai",
    label: "OpenAI الرسمي",
    hostPattern: "api.openai.com",
    baseUrl: "https://api.openai.com/v1",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    models: ["gpt-4o-mini", "gpt-4o"],
    authStyle: "bearer",
    supportsJsonMode: true,
    reasoningSplit: false,
    thinkingToggle: false,
    thinkingTogglePrefixes: [],
    notes: "المزوّد الرسمي — يكتشف النماذج المتاحة لحسابك فعلياً.",
  },
  {
    id: "generic",
    label: "مزوّد مخصّص (متوافق مع OpenAI)",
    hostPattern: "",
    baseUrl: "",
    chatPath: "/chat/completions",
    modelsPath: "/models",
    models: [],
    authStyle: "bearer",
    supportsJsonMode: true,
    reasoningSplit: false,
    thinkingToggle: false,
    thinkingTogglePrefixes: [],
    notes: "أي خدمة تتكلم لغة OpenAI. اكتب الرابط والمفتاح وسيكتشف النماذج بنفسه.",
  },
];

export function getPreset(id: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];
}

/** يكتشف قالب المزوّد من الرابط — أي مزوّد مستقبلي يقع على «مخصّص» ويعمل تلقائياً */
export function detectPresetId(baseUrl: string): string {
  const host = hostOf(baseUrl).toLowerCase();
  if (!host) return "generic";
  for (const p of PROVIDER_PRESETS) {
    if (p.hostPattern && host.includes(p.hostPattern.toLowerCase())) return p.id;
  }
  return "generic";
}

function hostOf(baseUrl: string): string {
  const withScheme = ensureScheme(baseUrl);
  try {
    return new URL(withScheme).host;
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ③ تطبيع الرابط — يقبل ما يكتبه المالك حرفياً
// ═══════════════════════════════════════════════════════════════════════

/** يضيف https:// إن نُسي، ويشذّب الفراغات والشرطة الأخيرة */
export function ensureScheme(raw: string): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * يحوّل ما يكتبه المالك إلى نقطة اتصال محادثة صحيحة فعلاً:
 *   api.minimax.io/v1                     → https://api.minimax.io/v1/chat/completions
 *   https://api.minimax.io/v1/            → https://api.minimax.io/v1/chat/completions
 *   https://x.com/v1/chat/completions     → كما هو
 *   https://x.com                         → https://x.com/v1/chat/completions
 */
export function normalizeChatUrl(raw: string, presetId = "generic"): string {
  const base = ensureScheme(raw);
  if (!base) return "";
  const preset = getPreset(presetId);
  if (base.toLowerCase().endsWith(preset.chatPath.toLowerCase())) return base;
  const withoutQuery = base.split("?")[0];
  if (/\/chat\/completions$/i.test(withoutQuery)) return withoutQuery;
  if (/\/v\d+$/i.test(withoutQuery)) return `${withoutQuery}${preset.chatPath}`;
  const path = safePath(withoutQuery);
  if (path === "" || path === "/") return `${withoutQuery}/v1${preset.chatPath}`;
  return `${withoutQuery}${preset.chatPath}`;
}

/** يبني رابط قائمة النماذج من نفس الأساس */
export function normalizeModelsUrl(raw: string, presetId = "generic"): string {
  const chat = normalizeChatUrl(raw, presetId);
  if (!chat) return "";
  const preset = getPreset(presetId);
  return chat.replace(/\/chat\/completions$/i, preset.modelsPath);
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ④ سلاسل النماذج — التفضيل ← قالب المزوّد ← المُكتشَف ← الاحتياطي
// ═══════════════════════════════════════════════════════════════════════

/** احتياطي عام أخير — يُجرَّب فقط بعد استنفاد كل ما هو أدقّ منه */
export const GENERIC_FALLBACK_MODELS = [
  "gpt-4o-mini",
  "deepseek-chat",
  "gpt-4o",
];

/** أقصى عدد نماذج نجرّبها في الاستدعاء الواحد (حماية من الزمن الطويل) */
export const MAX_MODEL_CANDIDATES = 4;

export function modelCandidates(
  presetId: string,
  discovered: string[],
  preferred?: string | null,
): string[] {
  const preset = getPreset(presetId);
  const chain: string[] = [];
  const push = (m?: string | null) => {
    const v = (m ?? "").trim();
    if (v && !chain.includes(v)) chain.push(v);
  };

  push(preferred);
  // قالب المزوّد أولاً إن كان مضبوطاً (نعرف أنها صالحة)
  if (preset.id !== "generic") for (const m of preset.models) push(m);
  // ثم ما اكتشفناه فعلياً من /models — أسرع/أرخص أولاً
  const discoveredSorted = [...discovered].sort((a, b) => speedScore(b) - speedScore(a));
  for (const m of discoveredSorted) push(m);
  if (preset.id === "generic") for (const m of preset.models) push(m);
  for (const m of GENERIC_FALLBACK_MODELS) push(m);

  return chain.slice(0, MAX_MODEL_CANDIDATES);
}

/**
 * ترتيب تفضيلي: النماذج السريعة/الخفيفة أولاً.
 * حدود الكلمات مقصودة: «minimax» تحتوي «mini» و«max» — بلا حدود
 * ستُحسب النماذج السريعة والثقيلة في المزوّد نفسه بنفس الدرجة.
 */
export function speedScore(model: string): number {
  const m = model.toLowerCase();
  let score = 0;
  if (/\b(highspeed|flash|turbo|mini|fast|light|small)\b/.test(m)) score += 4;
  if (/\bm2\.7\b|\bm2\.5\b|\bm2\.1\b|\bm2\b/.test(m)) score += 2;
  if (/\bm3\b|gpt-4o(?!-mini)|opus|\bpro\b|\bmax\b/.test(m)) score -= 1;
  return score;
}

// ═══════════════════════════════════════════════════════════════════════
// ② سجل وحدات AI — كل قسم في اللعبة له توجيهه
// ═══════════════════════════════════════════════════════════════════════

export type AiTaskDef = {
  key: string;
  label: string;
  group: string;
  what: string;
  temperature: number;
  maxTokens: number;
  needsJson: boolean;
  /** مدة صلاحية الكاش بالمللي ثانية — ٠ = لا كاش (محتوى يجب أن يكون طازجاً) */
  cacheTtlMs: number;
};

/**
 * الوحدات الحقيقية التي تستدعي AI في اللعبة. المفاتيح ثابتة،
 * والوحدات الجديدة مستقبلاً تسقط على «أي وحدة أخرى» وتظهر في السجل.
 */
export const AI_TASKS: AiTaskDef[] = [
  { key: "questions", label: "مولّد الأسئلة", group: "المحتوى", what: "يولّد أسئلة جديدة للبنك", temperature: 0.9, maxTokens: 1600, needsJson: true, cacheTtlMs: 0 },
  { key: "packs", label: "مولّد حزم الأسئلة", group: "المحتوى", what: "يبني حزمة أسئلة كاملة عن ثيم", temperature: 0.9, maxTokens: 1600, needsJson: true, cacheTtlMs: 0 },
  { key: "quiz", label: "ذكاء اللعب السريع", group: "المحتوى", what: "أسئلة ومهام اللعب الفوري", temperature: 0.8, maxTokens: 700, needsJson: false, cacheTtlMs: 0 },
  { key: "moderation", label: "الرقابة الآلية", group: "الأمان", what: "يفحص الرسائل والأسماء ويقرّر الإجراء", temperature: 0.1, maxTokens: 512, needsJson: true, cacheTtlMs: 0 },
  { key: "manual-moderation", label: "الرقابة اليدوية", group: "الأمان", what: "مشرف المالك لفحص حالة بعينها", temperature: 0.2, maxTokens: 700, needsJson: true, cacheTtlMs: 0 },
  { key: "reports", label: "تحليل البلاغات", group: "الأمان", what: "يقيّم البلاغ ويقترح إجراءً", temperature: 0.2, maxTokens: 700, needsJson: true, cacheTtlMs: 0 },
  { key: "guardian", label: "الحارس السيادي", group: "الأمان", what: "نبضة صحة سريعة للنظام", temperature: 0.1, maxTokens: 60, needsJson: false, cacheTtlMs: 60_000 },
  { key: "error-hunter", label: "صياد الأخطاء", group: "الأمان", what: "يحلّل تقارير الأخطاء ويقترح إصلاحاً", temperature: 0.2, maxTokens: 900, needsJson: true, cacheTtlMs: 0 },
  { key: "help-desk", label: "مكتب الدعم", group: "اللاعب", what: "يشرح للاعب ما يحدث في اللعبة", temperature: 0.4, maxTokens: 700, needsJson: false, cacheTtlMs: 300_000 },
  { key: "assistant", label: "المساعد الذكي", group: "اللاعب", what: "مساعد اللاعب داخل الواجهة", temperature: 0.7, maxTokens: 700, needsJson: false, cacheTtlMs: 300_000 },
  { key: "coach", label: "المدرّب الشخصي", group: "اللاعب", what: "نصائح مبنية على أداء اللاعب", temperature: 0.7, maxTokens: 500, needsJson: false, cacheTtlMs: 600_000 },
  { key: "membership-assistant", label: "مساعد العضوية", group: "اللاعب", what: "يفسّر المميزات والعروض", temperature: 0.6, maxTokens: 600, needsJson: false, cacheTtlMs: 600_000 },
  { key: "commentary", label: "المعلّق الرياضي", group: "الأحداث", what: "تعليق حماسي على البطولات", temperature: 1.0, maxTokens: 300, needsJson: false, cacheTtlMs: 0 },
  { key: "upgraded-ai", label: "الوكلاء المطوّرون", group: "الإدارة", what: "نسخة مرقّاة لكل وكيل إداري", temperature: 0.7, maxTokens: 900, needsJson: false, cacheTtlMs: 0 },
  { key: "toolbelt", label: "عدّة أدوات المالك", group: "الإدارة", what: "أدوات سريعة في غرفة المالك", temperature: 0.5, maxTokens: 700, needsJson: false, cacheTtlMs: 300_000 },
  { key: "simulator", label: "محاكي ماذا-لو", group: "الإدارة", what: "يحلّل سيناريوهات بالأرقام الحقيقية", temperature: 0.5, maxTokens: 1200, needsJson: false, cacheTtlMs: 120_000 },
  { key: "vice-owner", label: "نائب المالك", group: "الإدارة", what: "قرارات النائب التنفيذية", temperature: 0.6, maxTokens: 900, needsJson: false, cacheTtlMs: 0 },
  { key: "secret", label: "الأسرار السيادية", group: "الإدارة", what: "مهام الحرية السرّية", temperature: 0.8, maxTokens: 700, needsJson: false, cacheTtlMs: 0 },
  { key: "other", label: "أي وحدة أخرى", group: "عام", what: "التوجيه الافتراضي لكل وحدة غير مُسمّاة", temperature: 0.7, maxTokens: 800, needsJson: false, cacheTtlMs: 0 },
];

export const TASK_KEYS = AI_TASKS.map((t) => t.key);
export const DEFAULT_TASK_KEY = "other";

export function getTaskDef(key: string): AiTaskDef {
  return AI_TASKS.find((t) => t.key === key) ?? AI_TASKS[AI_TASKS.length - 1];
}

/** يُنظّف الاسم: يوحّد الحروف ويُسقط الرموز */
export function normalizeLabel(label: string): string {
  return (label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * 🧭 الجسر الذكي: يشتق وحدة AI من الاسم الذي يمرّره الكود.
 * هذا ما يجعل «الربط بكل اللعبة» حقيقياً بلا لمس ١٩ موضع استدعاء،
 * وأي وحدة جديدة مستقبلاً تعمل تلقائياً وتظهر باسمها في السجل.
 */
const LABEL_ALIASES: Array<[string, string]> = [
  ["manual moderation", "manual-moderation"],
  ["help desk", "help-desk"],
  ["pack generator", "packs"],
  ["question generator", "questions"],
  ["report analysis", "reports"],
  ["error hunter", "error-hunter"],
  ["upgraded ai", "upgraded-ai"],
  ["membership assistant", "membership-assistant"],
  ["vice owner", "vice-owner"],
  ["what if simulator", "simulator"],
  ["quiz game", "quiz"],
  ["moderation", "moderation"],
  ["commentator", "commentary"],
  ["assistant", "assistant"],
  ["guardian", "guardian"],
  ["toolbelt", "toolbelt"],
  ["simulator", "simulator"],
  ["coach", "coach"],
  ["secret", "secret"],
];

export function matchTaskFromLabel(label: string): string {
  const n = normalizeLabel(label);
  if (!n) return DEFAULT_TASK_KEY;
  for (const [needle, task] of LABEL_ALIASES) {
    if (n.includes(needle)) return task;
  }
  return DEFAULT_TASK_KEY;
}

// ═══════════════════════════════════════════════════════════════════════
// ⑤ قرارات الحماية — كاش / سقف / حد / قاطع دائرة
// ═══════════════════════════════════════════════════════════════════════

export type ApiGuardConfig = {
  /** إيقاف كامل — يعطّل الكاش والسقوف والقاطع معاً */
  enabled: boolean;
  /** سقف الاستدعاءات اليومي (٠ = بلا سقف) */
  dailyCallCap: number;
  /** سقف التوكنات اليومي (٠ = بلا سقف) */
  dailyTokenCap: number;
  /** سقف الاستدعاءات في الدقيقة (٠ = بلا سقف) */
  perMinuteCap: number;
  cacheEnabled: boolean;
  circuitEnabled: boolean;
  /** عدد الفشل المتتالي الذي يفتح القاطع */
  failureThreshold: number;
  /** مدة التبريد قبل إعادة المحاولة */
  cooldownMs: number;
  /** السماح بالتشغيل من متغيرات بيئة الخادم إن لم يُضبط مزوّد في المركز */
  allowEnvBootstrap: boolean;
};

export const DEFAULT_GUARD: ApiGuardConfig = {
  enabled: true,
  dailyCallCap: 0,
  dailyTokenCap: 0,
  perMinuteCap: 0,
  cacheEnabled: true,
  circuitEnabled: true,
  failureThreshold: 5,
  cooldownMs: 5 * 60_000,
  allowEnvBootstrap: true,
};

function intOr(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizeGuard(raw: Partial<ApiGuardConfig> | null | undefined): ApiGuardConfig {
  const r = raw ?? {};
  return {
    enabled: boolOr(r.enabled, DEFAULT_GUARD.enabled),
    dailyCallCap: intOr(r.dailyCallCap, DEFAULT_GUARD.dailyCallCap),
    dailyTokenCap: intOr(r.dailyTokenCap, DEFAULT_GUARD.dailyTokenCap),
    perMinuteCap: intOr(r.perMinuteCap, DEFAULT_GUARD.perMinuteCap),
    cacheEnabled: boolOr(r.cacheEnabled, DEFAULT_GUARD.cacheEnabled),
    circuitEnabled: boolOr(r.circuitEnabled, DEFAULT_GUARD.circuitEnabled),
    failureThreshold: Math.max(1, intOr(r.failureThreshold, DEFAULT_GUARD.failureThreshold)),
    cooldownMs: Math.max(1_000, intOr(r.cooldownMs, DEFAULT_GUARD.cooldownMs)),
    allowEnvBootstrap: boolOr(r.allowEnvBootstrap, DEFAULT_GUARD.allowEnvBootstrap),
  };
}

export type GuardSnapshot = {
  minuteCalls: number;
  dayCalls: number;
  dayTokens: number;
  circuitOpen: boolean;
  circuitOpenedAt: number | null;
  failures: number;
};

export type CallDecision =
  | { outcome: "cache"; reply: string; reason: string }
  | { outcome: "block"; reason: string }
  | { outcome: "proceed"; reason: string };

/**
 * القرار الواحد قبل أي استدعاء. الترتيب مقصود:
 * الكاش أولاً (أرخص) ثم القاطع (لا نُغرق مزوّداً ميتاً) ثم السقوف.
 */
export function decideCall(input: {
  guard: ApiGuardConfig;
  snapshot: GuardSnapshot;
  cacheReply: string | null;
  cacheAllowed: boolean;
  now: number;
}): CallDecision {
  const { guard, snapshot, cacheReply, cacheAllowed, now } = input;

  if (cacheAllowed && guard.cacheEnabled && cacheReply) {
    return { outcome: "cache", reply: cacheReply, reason: "استُخدمت استجابة محفوظة (نفس الطلب تماماً)" };
  }

  if (!guard.enabled) {
    return { outcome: "proceed", reason: "الحماية معطّلة — استدعاء مباشر" };
  }

  if (guard.circuitEnabled && snapshot.circuitOpen) {
    const openedAt = snapshot.circuitOpenedAt ?? 0;
    if (now - openedAt < guard.cooldownMs) {
      const left = Math.ceil((guard.cooldownMs - (now - openedAt)) / 1000);
      return {
        outcome: "block",
        reason: `قاطع الدائرة مفتوح بعد ${snapshot.failures} فشل متتالٍ — إعادة المحاولة بعد ${left} ثانية`,
      };
    }
    // انتهى التبريد: نسمح بمحاولة واحدة (نصف مفتوح)
  }

  if (guard.dailyCallCap > 0 && snapshot.dayCalls >= guard.dailyCallCap) {
    return { outcome: "block", reason: `بلغتَ سقف الاستدعاءات اليومي (${guard.dailyCallCap})` };
  }

  if (guard.dailyTokenCap > 0 && snapshot.dayTokens >= guard.dailyTokenCap) {
    return { outcome: "block", reason: `بلغتَ سقف التوكنات اليومي (${guard.dailyTokenCap})` };
  }

  if (guard.perMinuteCap > 0 && snapshot.minuteCalls >= guard.perMinuteCap) {
    return { outcome: "block", reason: `بلغتَ حد الاستدعاءات في الدقيقة (${guard.perMinuteCap})` };
  }

  return { outcome: "proceed", reason: "داخل الحدود" };
}

/** هل القاطع مفتوح فعلاً الآن (بعد احتساب التبريد)؟ */
export function circuitIsOpen(snapshot: GuardSnapshot, guard: ApiGuardConfig, now: number): boolean {
  if (!guard.circuitEnabled || !snapshot.circuitOpen) return false;
  const openedAt = snapshot.circuitOpenedAt ?? 0;
  return now - openedAt < guard.cooldownMs;
}

// ═══════════════════════════════════════════════════════════════════════
// بصمة الطلب — أساس الكاش
// ═══════════════════════════════════════════════════════════════════════

export function fnv1a(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** بصمة مستقرة: نفس المدخلات ⇒ نفس البصمة دائماً، ومختلفة لأي تغيير */
export function promptFingerprint(
  messages: Array<{ role: string; content: string }>,
  model: string,
  temperature: number,
): string {
  const payload = JSON.stringify({
    m: model,
    t: Math.round(temperature * 100) / 100,
    p: messages.map((x) => `${x.role}:${x.content}`),
  });
  const a = fnv1a(payload);
  const b = fnv1a(payload, 0x9e3779b9);
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${payload.length}`;
}

/** تقدير التوكنات عند غياب usage من المزوّد */
export function estimateTokens(text: string): number {
  const len = (text ?? "").length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 3));
}

// ═══════════════════════════════════════════════════════════════════════
// تنظيف ردّ النموذج
// ═══════════════════════════════════════════════════════════════════════

/**
 * نماذج التفكير تُغلق تفكيرها في <think>…</think>.
 * داخل لعبة، هذا النص لا يُعرض للاعب ولا يُلوّث JSON.
 */
export function stripThinking(text: string): string {
  if (!text) return "";
  return text
    .replace(/<think[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
    .trim();
}

/** استخراج JSON من ردّ قد يحيط به نص أو ``` */
export function extractJson(text: string): string {
  const cleaned = stripThinking(text);
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : cleaned).trim();
  const first = body.search(/[[{]/);
  if (first < 0) return body;
  const lastObj = body.lastIndexOf("}");
  const lastArr = body.lastIndexOf("]");
  const last = Math.max(lastObj, lastArr);
  if (last <= first) return body;
  return body.slice(first, last + 1);
}

// ═══════════════════════════════════════════════════════════════════════
// أوصاف جاهزة للواجهة
// ═══════════════════════════════════════════════════════════════════════

export function guardSummary(guard: ApiGuardConfig): string {
  if (!guard.enabled) return "الحماية معطّلة — كل الاستدعاءات تمر بلا قيود";
  const parts: string[] = [];
  parts.push(guard.dailyCallCap > 0 ? `سقف يومي ${guard.dailyCallCap} استدعاء` : "بلا سقف استدعاءات يومي");
  parts.push(guard.perMinuteCap > 0 ? `${guard.perMinuteCap}/دقيقة` : "بلا حد للدقيقة");
  parts.push(guard.cacheEnabled ? "الكاش مفعّل" : "الكاش موقوف");
  parts.push(guard.circuitEnabled ? `قاطع بعد ${guard.failureThreshold} فشل` : "القاطع موقوف");
  return parts.join(" · ");
}

export function formatMasked(key: string | undefined | null): string {
  const k = (key ?? "").trim();
  if (k.length < 12) return k ? "••••" : "—";
  return `${k.slice(0, 6)}••••${k.slice(-4)}`;
}
