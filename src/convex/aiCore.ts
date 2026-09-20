/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 نواة سقف الذكاء الموحد — منطق نقي بلا أي اعتماديات
 *
 * مركز الذكاء الموحد كان يسجّل قرارات الوحدات ويضبط «حساسية» من ١ إلى ١٠…
 * لكن الحساسية كانت **رقماً مخزَّناً لا يغيّر شيئاً**. هذه النواة تجعلها
 * قراراً حقيقياً: كل وحدة تقرأ سياستها المشتقّة من حساسيتها فتتغيّر حدود
 * الحجب والتحذير ومعدّل الرسائل وتحمل المخالفات — بأرقام ملموسة.
 *
 * وتضيف ما كان ناقصاً في السقف الواحد:
 *   • صحة كل وحدة (مفعّلة/صامتة/متقادمة/مزدحمة) ودرجة صحة موحّدة للسقف
 *   • كشف الخلافات بين الوحدات حول نفس الهدف ⇒ قرار للمالك (تعلُّم حقيقي)
 *   • قراءة موحّدة للسياق الحيّ (عقول · عشائر · بلاغات · أخطاء)
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ الحساسية ⇒ سياسة حقيقية
// ═══════════════════════════════════════════════════════════════════════

export const SENSITIVITY_MIN = 1;
export const SENSITIVITY_MAX = 10;
/** الحساسية الافتراضية — وهي التي تُنتج السلوك الحالي المعروف (أمان للتوافق). */
export const SENSITIVITY_DEFAULT = 5;

/** ما الذي تتحكّم فيه حساسية كل وحدة فعلاً. */
export type UnitScope = "moderation" | "cheat" | "quality" | "engagement" | "alerts" | "governance";

export interface UnitBehavior {
  unit: string;
  scope: UnitScope;
  /** نص يشرح للمالك ما سيتغيّر فعلاً عند رفع الحساسية */
  effect: string;
}

export const UNIT_BEHAVIOR: UnitBehavior[] = [
  { unit: "guardian", scope: "moderation", effect: "ترفع/تخفض حدّ حجب رسائل الدردشة، معدّل الإرسال المسموح، وتحمّل المخالفات" },
  { unit: "referee", scope: "cheat", effect: "تشدّد كشف الغش: نسبة الثقة المطلوبة للرفض وعدد الجولات المرصودة" },
  { unit: "reports", scope: "moderation", effect: "ترجّح كفة البلاغ: أي البلاغات تُصعَّد فوراً وأيّها يُترك للمراجعة" },
  { unit: "questions", scope: "quality", effect: "ترفع عتبة قبول جودة الأسئلة المولّدة قبل نشرها" },
  { unit: "coach", scope: "engagement", effect: "تزيد عدد التوصيات والتنبيهات الشخصية التي تُبنى من تحليل الأداء" },
  { unit: "personalizer", scope: "engagement", effect: "توسّع نطاق التخصيص: تطابق أوسع ومستويات أسئلة ديناميكية أكثر" },
  { unit: "notifier", scope: "alerts", effect: "تحكم حساسية الإشعارات: أكثر صرامة = إشعارات أقل وأهم فقط" },
  { unit: "health", scope: "alerts", effect: "ترفع حساسية رصد الاقتصاد والمجتمع: تنبيه أبكر قبل الأزمة" },
  { unit: "governor", scope: "governance", effect: "توسّع التدخل الذاتي في الإدارة والقوانين وردود الفعل" },
  { unit: "sovereign", scope: "governance", effect: "ترفع قوة العقوبات السيادية وتفعيل التدخل المستقل" },
  { unit: "recommender", scope: "engagement", effect: "تزيد عدد التحديات والأحداث المقترحة تلقائياً" },
  { unit: "doctor", scope: "alerts", effect: "تحكم متى تُصعَّد أخطاء النظام للتشخيص العميق" },
];

export function behaviorOf(unit: string): UnitBehavior {
  return (
    UNIT_BEHAVIOR.find((b) => b.unit === unit) ?? {
      unit,
      scope: "alerts",
      effect: "تحكم حساسية الرصد والتنبيه لهذه الوحدة",
    }
  );
}

export interface UnitPolicy {
  unit: string;
  /** الحساسية المطبَّعة 1..10 */
  sensitivity: number;
  scope: UnitScope;
  /** درجة تُحجب/تُرفض عندها (0..10) */
  blockAt: number;
  /** درجة تُنبَّه عندها (0..10) */
  warnAt: number;
  /** أقصى رسائل في الدقيقة (لوحدات الرقابة) */
  rateLimitPerMinute: number;
  /** كم مخالفة يتحمّلها العضو قبل المنع المؤقت */
  strikeTolerance: number;
  /** نسبة الثقة المطلوبة لأي حكم (0..1) */
  minConfidence: number;
  /** وصف مختصر للسلوك الحالي يظهر للمالك */
  label: string;
}

const clampSensitivity = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : SENSITIVITY_DEFAULT;
  return Math.max(SENSITIVITY_MIN, Math.min(SENSITIVITY_MAX, v));
};

/**
 * سياسة الوحدة من حساسيتها.
 * مصمَّمة بحيث تكون الحساسية ٥ **مطابقة تماماً** للسلوك الحالي
 * (حد الحجب ٦ · معدّل ٨ رسائل/دقيقة · تحمّل مخالفتين) فلا يتغيّر شيء صامتاً.
 */
export function policyFor(unit: string, sensitivity: number): UnitPolicy {
  const s = clampSensitivity(sensitivity);
  const scope = behaviorOf(unit).scope;

  // كل درجة حساسية أعلى = أحدّ. 5 هي نقطة التوازن المطابقة للسلوك الحالي.
  const blockAt = Math.max(2, Math.min(10, 6 + (SENSITIVITY_DEFAULT - s)));
  const warnAt = Math.max(1, Math.min(9, 2 + Math.round((SENSITIVITY_DEFAULT - s) * 0.6)));
  const rateLimitPerMinute = Math.max(2, Math.min(40, 8 - (s - SENSITIVITY_DEFAULT) * 2));
  // تحمّل مخالفة واحدة على الأقل — كي لا يُحجب أول تنبيه بلا سابق إنذار
  const strikeTolerance = Math.max(1, Math.min(6, 2 + (SENSITIVITY_DEFAULT - s)));
  const minConfidence = Math.max(0.3, Math.min(0.98, 0.6 + (s - SENSITIVITY_DEFAULT) * 0.05));

  const label =
    s >= 9 ? "صارم جداً" : s >= 7 ? "صارم" : s >= 5 ? "متوازن" : s >= 3 ? "متسامح" : "متسامح جداً";

  return {
    unit,
    sensitivity: s,
    scope,
    blockAt,
    warnAt,
    rateLimitPerMinute,
    strikeTolerance,
    minConfidence,
    label,
  };
}

/** حساسية مقترحة من ملف جاهز (بضغطة واحدة في غرفة المالك). */
export type RoofProfile = "strict" | "balanced" | "relaxed";

export const ROOF_PROFILES: { id: RoofProfile; name: string; icon: string; description: string }[] = [
  { id: "strict", name: "الوضع المتشدّد", icon: "🛡️", description: "رقابة أقسى ومخالفات أقل تحمّلاً — مناسب عند الفوضى" },
  { id: "balanced", name: "الوضع المتوازن", icon: "⚖️", description: "الأسلوب الافتراضي المضبوط على تجربة اللعبة الحالية" },
  { id: "relaxed", name: "الوضع المتسامح", icon: "🕊️", description: "حرية أوسع للمجتمع مع بقاء الخطوط الحمراء محجوبة" },
];

export function sensitivityForProfile(profile: RoofProfile, unit: string): number {
  const scope = behaviorOf(unit).scope;
  // الوحدات الرقابية هي الأكثر تأثّراً؛ وحدات التوصيات أقل حدّة حتى في التشدد.
  const strictBump = scope === "moderation" ? 3 : scope === "cheat" || scope === "governance" ? 2 : 1;
  if (profile === "strict") return clampSensitivity(SENSITIVITY_DEFAULT + strictBump);
  if (profile === "relaxed") return clampSensitivity(SENSITIVITY_DEFAULT - 2);
  return SENSITIVITY_DEFAULT;
}

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ الحساسية تُغيّر القرار فعلاً
// ═══════════════════════════════════════════════════════════════════════

export interface RawDecision {
  verdict: "ok" | "warn" | "mute" | "flag";
  score: number;
  reasons: string[];
}

/**
 * يعيد النظر في قرار وحدة بموجب سياستها:
 *   • حساسية أعلى ⇒ قرارات الحدود تُرفع إلى الحجب
 *   • حساسية أقل ⇒ قرارات الحدود تُخفَّض إلى تنبيه (تراجع محسوب)
 * وكل تعديل يُذكَر بصراحة في الأسباب — فالشفافية شرط.
 */
export function reviseByPolicy<T extends RawDecision>(decision: T, policy: UnitPolicy): T {
  if (decision.verdict === "ok") return decision;

  if (decision.verdict === "flag" && decision.score < policy.blockAt) {
    return {
      ...decision,
      verdict: "warn",
      reasons: [...decision.reasons, `خُفِّض إلى تنبيه بحساسية ${policy.sensitivity}/10 (${policy.label})`],
    } as T;
  }

  if (decision.verdict === "warn" && decision.score >= policy.blockAt) {
    return {
      ...decision,
      verdict: "flag",
      reasons: [...decision.reasons, `رُفع إلى حجب بحساسية ${policy.sensitivity}/10 (${policy.label})`],
    } as T;
  }

  return decision;
}

/** هل تمرّ هذه الدرجة تحت سياسة معيّنة؟ (يُستخدم في الفحوص والتحليلات) */
export function passesPolicy(score: number, policy: UnitPolicy): boolean {
  return score < policy.blockAt;
}

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ صحة الوحدات — من يعمل ومن صمت ومن تقادم
// ═══════════════════════════════════════════════════════════════════════

export type UnitStatus = "healthy" | "idle" | "stale" | "silent" | "noisy" | "disabled";

export interface UnitState {
  unit: string;
  name: string;
  dept: string;
  enabled: boolean;
  sensitivity: number;
  lastEventAt: number | null;
  eventCount: number;
}

export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
export const NOISY_EVENTS_PER_DAY = 200;

export interface UnitHealthRow extends UnitState {
  status: UnitStatus;
  label: string;
  policy: UnitPolicy;
  effect: string;
}

const STATUS_LABEL: Record<UnitStatus, string> = {
  healthy: "تعمل",
  idle: "بانتظار نشاط",
  stale: "متقادمة",
  silent: "صامتة",
  noisy: "مزدحمة",
  disabled: "معطّلة",
};

export function unitHealth(units: readonly UnitState[], now = Date.now()): UnitHealthRow[] {
  const dayAgo = now - 86_400_000;
  return units.map((u) => {
    const last = u.lastEventAt ?? null;
    let status: UnitStatus;
    if (!u.enabled) status = "disabled";
    else if (last === null) status = "silent";
    else if (now - last > STALE_AFTER_MS) status = "stale";
    else if (u.eventCount > NOISY_EVENTS_PER_DAY && last >= dayAgo) status = "noisy";
    else if (last < dayAgo) status = "idle";
    else status = "healthy";
    return {
      ...u,
      status,
      label: STATUS_LABEL[status],
      policy: policyFor(u.unit, u.sensitivity),
      effect: behaviorOf(u.unit).effect,
    };
  });
}

export interface RoofPulse {
  totalUnits: number;
  enabled: number;
  healthy: number;
  disabled: number;
  silent: number;
  stale: number;
  /** درجة صحة السقف الموحّد 0..100 */
  score: number;
  /** الوحدة الأكثر نشاطاً */
  busiest: { unit: string; events: number } | null;
  /** متوسط الحساسية المطبَّقة */
  avgSensitivity: number;
}

export function computeRoofPulse(rows: readonly UnitHealthRow[]): RoofPulse {
  if (rows.length === 0) {
    return {
      totalUnits: 0,
      enabled: 0,
      healthy: 0,
      disabled: 0,
      silent: 0,
      stale: 0,
      score: 0,
      busiest: null,
      avgSensitivity: 0,
    };
  }
  const enabled = rows.filter((r) => r.enabled);
  const healthy = rows.filter((r) => r.status === "healthy" || r.status === "idle").length;
  const disabled = rows.filter((r) => r.status === "disabled").length;
  const silent = rows.filter((r) => r.status === "silent").length;
  const stale = rows.filter((r) => r.status === "stale").length;
  const busiestRow = [...rows].sort((a, b) => b.eventCount - a.eventCount)[0];
  const avgSensitivity =
    Math.round((rows.reduce((s, r) => s + r.policy.sensitivity, 0) / rows.length) * 10) / 10;

  // الصحة = المفعّلات النشطة ناقص عقوبات التعطّل والصمت والجمود
  const base = enabled.length === 0 ? 0 : (healthy / enabled.length) * 100;
  const penalty = disabled * 3 + stale * 4 + silent * 2;
  const score = Math.max(0, Math.min(100, Math.round(base - penalty)));

  return {
    totalUnits: rows.length,
    enabled: enabled.length,
    healthy,
    disabled,
    silent,
    stale,
    score,
    busiest: busiestRow && busiestRow.eventCount > 0 ? { unit: busiestRow.unit, events: busiestRow.eventCount } : null,
    avgSensitivity,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ كشف الخلافات بين الوحدات — قرار يحتاج العرش
// ═══════════════════════════════════════════════════════════════════════

export type Stance = "restrict" | "allow";

export interface ConflictEvent {
  unit: string;
  kind: string;
  severity: "info" | "warn" | "critical";
  summary: string;
  /** معرّف الهدف (لاعب/رسالة/سؤال) إن وُجد */
  target: string | null;
  at: number;
}

const RESTRICT_WORDS = ["حظر", "كتم", "رفض", "حجب", "عقوبة", "منع", "ban", "block", "reject"];
const ALLOW_WORDS = ["عفو", "قبول", "تمرير", "إلغاء", "استئناف", "إعادة", "pardon", "approve", "allow", "قبول"];

/** موقف الحدث: هل يشدّد على الهدف أم يُخفّف عنه؟ */
export function stanceOf(event: ConflictEvent): Stance | null {
  const text = `${event.kind} ${event.summary}`;
  if (RESTRICT_WORDS.some((w) => text.includes(w))) return "restrict";
  if (ALLOW_WORDS.some((w) => text.includes(w))) return "allow";
  if (event.severity === "critical" || event.severity === "warn") return "restrict";
  if (event.severity === "info" && event.kind === "decision") return "allow";
  return null;
}

export interface DetectedConflict {
  target: string;
  unitA: string;
  unitB: string;
  stanceA: Stance;
  stanceB: Stance;
  severity: "warn" | "critical";
  summaryA: string;
  summaryB: string;
  at: number;
}

/**
 * يكتشف تعارضاً حقيقياً: وحدتان مختلفتان، نفس الهدف، موقفان متضادان.
 * لا يُبلَّغ عن أي شيء آخر — فلا إزعاج بلا سبب.
 */
export function detectConflicts(events: readonly ConflictEvent[], windowMs = 86_400_000): DetectedConflict[] {
  const byTarget = new Map<string, ConflictEvent[]>();
  for (const e of events) {
    if (!e.target) continue;
    const stance = stanceOf(e);
    if (!stance) continue;
    const list = byTarget.get(e.target) ?? [];
    list.push(e);
    byTarget.set(e.target, list);
  }

  const out: DetectedConflict[] = [];
  for (const [target, list] of byTarget) {
    const restrict = list.filter((e) => stanceOf(e) === "restrict");
    const allow = list.filter((e) => stanceOf(e) === "allow");
    if (restrict.length === 0 || allow.length === 0) continue;

    // نأخذ أقرب زوج زمنياً من وحدتين مختلفتين
    let best: { a: ConflictEvent; b: ConflictEvent; gap: number } | null = null;
    for (const a of restrict) {
      for (const b of allow) {
        if (a.unit === b.unit) continue;
        const gap = Math.abs(a.at - b.at);
        if (gap > windowMs) continue;
        if (!best || gap < best.gap) best = { a, b, gap };
      }
    }
    if (!best) continue;

    out.push({
      target,
      unitA: best.a.unit,
      unitB: best.b.unit,
      stanceA: "restrict",
      stanceB: "allow",
      severity: best.a.severity === "critical" || best.b.severity === "critical" ? "critical" : "warn",
      summaryA: best.a.summary,
      summaryB: best.b.summary,
      at: Math.max(best.a.at, best.b.at),
    });
  }

  return out.sort((a, b) => b.at - a.at);
}

/** بصمة الخلاف — تمنع تكرار تسجيل نفس التعارض كل ساعة. */
export function conflictKey(c: DetectedConflict): string {
  return `${c.target}|${[c.unitA, c.unitB].sort().join("+")}`;
}

/** جملة عربية تصف الخلاف وقراره المقترح — تُعرض للمالك. */
export function describeConflict(c: DetectedConflict): string {
  return `${c.unitA} يشدّد و${c.unitB} يُخفّف بشأن «${c.target}» — يحتاج قرارك أيّهما أوثق`;
}

// ═══════════════════════════════════════════════════════════════════════
// 5️⃣ السياق الموحّد الحيّ — قراءة واحدة تفهمها كل الوحدات
// ═══════════════════════════════════════════════════════════════════════

export interface RoofContextInput {
  minds: { total: number; active24h: number; avgTier: number; frozen: number };
  clans: { total: number; members: number; avgPower: number; frozen: number; flags24h: number };
  reports: { open: number; critical: number };
  errors: { last24h: number; critical: number };
  economy: { treasuryCoinsTotal: number; guildGoalsClaimed: number };
}

export function summarizeContext(ctx: RoofContextInput): string[] {
  const lines: string[] = [];
  lines.push(
    ctx.minds.total === 0
      ? "لا عقول مسجَّلة بعد — أول مزامنة من لاعب ستُغذّي هذا السياق"
      : `${ctx.minds.total} عقل مسجَّل · ${ctx.minds.active24h} نشط خلال 24س · متوسط القوى ${ctx.minds.avgTier}${
          ctx.minds.frozen > 0 ? ` · ${ctx.minds.frozen} مُجمَّد` : ""
        }`,
  );
  lines.push(
    ctx.clans.total === 0
      ? "لا عشائر بعد — المجتمع المنظَّم لم يبدأ"
      : `${ctx.clans.total} عشيرة · ${ctx.clans.members} عضو · متوسط القوة ${ctx.clans.avgPower}${
          ctx.clans.flags24h > 0 ? ` · ${ctx.clans.flags24h} مخالفة دردشة خلال 24س` : ""
        }`,
  );
  lines.push(
    ctx.reports.open === 0
      ? "لا بلاغات مفتوحة"
      : `${ctx.reports.open} بلاغ مفتوح${ctx.reports.critical > 0 ? ` منها ${ctx.reports.critical} حرج` : ""}`,
  );
  lines.push(
    ctx.errors.last24h === 0
      ? "لا أخطاء نظام خلال 24 ساعة ✅"
      : `${ctx.errors.last24h} خطأ خلال 24س${ctx.errors.critical > 0 ? ` · ${ctx.errors.critical} حرج` : ""}`,
  );
  lines.push(
    `خزائن العشائر ${ctx.economy.treasuryCoinsTotal} عملة · أهداف عشائر مُستلمة ${ctx.economy.guildGoalsClaimed}`,
  );
  return lines;
}

/** تنبيهات السياق التي يجب أن تتصرّف الوحدات بناءً عليها. */
export function contextAlerts(ctx: RoofContextInput): { severity: "warn" | "critical"; text: string }[] {
  const alerts: { severity: "warn" | "critical"; text: string }[] = [];
  if (ctx.errors.critical > 0) alerts.push({ severity: "critical", text: `${ctx.errors.critical} خطأ حرج خلال 24 ساعة` });
  if (ctx.reports.critical > 0) alerts.push({ severity: "critical", text: `${ctx.reports.critical} بلاغ حرج بانتظار قرار` });
  if (ctx.clans.flags24h >= 10) alerts.push({ severity: "warn", text: `${ctx.clans.flags24h} مخالفة دردشة عشائر خلال 24س — راجع حساسية الحارس` });
  if (ctx.minds.total > 0 && ctx.minds.active24h === 0) alerts.push({ severity: "warn", text: "لا عقل نشط خلال 24 ساعة — المجتمع خامل" });
  if (ctx.clans.frozen > 0) alerts.push({ severity: "warn", text: `${ctx.clans.frozen} عشيرة مُجمَّدة بقرار` });
  return alerts;
}
