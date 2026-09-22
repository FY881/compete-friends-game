/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔔 نواة الإشعارات الموحّدة — مصدر الحقيقة الوحيد لسياسة التسليم
 * ═══════════════════════════════════════════════════════════════════════
 *
 * المشكلة التي وُلدت هذه النواة لحلّها:
 * كان في اللعبة مساران لكتابة الإشعارات:
 *  ① `smartNotifications.smartPush` — يحترم الكتم وساعات الهدوء والسقف.
 *  ② `notify.push` — يُدرج الصف مباشرة، متجاهلاً كل تفضيلات اللاعب.
 * فكان اللاعب يكتم «المبارزات» ثم تصله دعوة مبارزة فوراً — زر الكتم يكذب.
 *
 * الآن: كل قرار تسليم يُحسب هنا، في دوال نقية بلا قاعدة بيانات،
 * فيُختبر بالكامل ويسري أثره على كل مسارات الإرسال بلا استثناء.
 *
 * السياسة (مرتّبة، والأول يفوز):
 *  1. فئة مكتومة صراحةً ← تُسقَط (إسقاط نهائي، عدا إشعارات العقوبة).
 *  2. إشعار عقوبة (`ban`) ← لا يمكن كتمه أبداً (شأن قانوني على الحساب).
 *  3. أولوية حرجة ← تتجاوز الهدوء والسقف دائماً.
 *  4. داخل ساعات الهدوء ← يُؤجَّل (أو يُسقَط إن ألغى اللاعب التأجيل).
 *  5. أدنى أولوية مقبولة ← ما دونها يُؤجَّل.
 *  6. سقف الساعة ← يُؤجَّل ما زاد.
 *  7. وإلا ← تسليم فوري.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────── الفئات ───────────────────────────

export const NOTIF_CATEGORIES = [
  "duels",
  "streaks",
  "membership",
  "events",
  "social",
  "economy",
  "system",
] as const;
export type NotifCategory = (typeof NOTIF_CATEGORIES)[number];

export const NOTIF_CATEGORY_LABELS: Record<NotifCategory, string> = {
  duels: "⚔️ المبارزات والتحديات",
  streaks: "🔥 السلاسل والإنجازات",
  membership: "💎 العضوية والمميزات",
  events: "🎪 الأحداث والمواسم",
  social: "👥 المجتمع والعشيرة",
  economy: "💰 الاقتصاد والمتجر",
  system: "🛠️ النظام والحساب",
};

export function isNotifCategory(x: unknown): x is NotifCategory {
  return typeof x === "string" && (NOTIF_CATEGORIES as readonly string[]).includes(x);
}

/** أي فئة غير معروفة تُعامَل كـ system — لا فئة معلّقة بلا تصنيف. */
export function normalizeCategory(x?: string): NotifCategory {
  return isNotifCategory(x) ? x : "system";
}

// ─────────────────────────── الأنواع والأولوية ───────────────────────────

export const NOTIF_TYPES = ["info", "warning", "ban", "update", "system"] as const;
export type NotifType = (typeof NOTIF_TYPES)[number];

export const PRIORITY_RANK: Record<string, number> = { normal: 0, important: 1, critical: 2 };
export type NotifPriority = "normal" | "important" | "critical";

export function isNotifPriority(x: unknown): x is NotifPriority {
  return typeof x === "string" && x in PRIORITY_RANK;
}

export const PRIORITY_LABELS: Record<number, string> = {
  2: "عاجل",
  1: "مهم",
  0: "عادي",
};

/**
 * الأولوية المشتقّة من النوع والفئة — تُستخدم عند العرض في الصندوق
 * وعند حساب «هل يتجاوز هذا الإشعار ساعات الهدوء؟».
 */
export function priorityOf(n: { type?: string; category?: string }): number {
  if (n.type === "ban" || n.type === "warning") return 2;
  if (n.category === "duels" || n.category === "streaks") return 1;
  if (n.type === "update") return 1;
  return 0;
}

/** الإشعارات التي لا يجوز أن يضيع أي منها: العقوبات على الحساب. */
export function isAccountNotice(n: { type?: string }): boolean {
  return n.type === "ban";
}

/** الأولوية الصريحة إن وُجدت، وإلا المشتقّة من النوع/الفئة. */
export function resolvedRank(n: { type?: string; category?: string; priority?: string }): number {
  if (isNotifPriority(n.priority)) return PRIORITY_RANK[n.priority];
  return priorityOf(n);
}

/**
 * حرج = يتجاوز ساعات الهدوء والسقف الساعي.
 * العقوبة (`ban`) حرجة بنصّ السياسة حتى لو جاءت بأولوية عادية.
 */
export function isCritical(n: { type?: string; priority?: string; category?: string }): boolean {
  if (n.type === "ban") return true;
  return resolvedRank(n) >= 2;
}

// ─────────────────────────── الحدود المسموحة ───────────────────────────

export const NOTIF_LIMITS = {
  maxPerHour: { min: 0, max: 60 },
  digestHour: { min: 0, max: 23 },
  /** أقصى انتظار في طابور التأجيل قبل التسليم القسري — منعاً للتجويع. */
  maxDeferMs: 12 * 3600_000,
} as const;

export const TIER_DEFAULTS = {
  minPriority: "normal" as NotifPriority,
  quietDefer: true,
  maxPerHour: 12,
  digestHour: 9,
};

export function inRange(value: number, r: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= r.min && value <= r.max;
}

// ─────────────────────────── ساعات الهدوء ───────────────────────────

export interface QuietHours {
  from: number;
  to: number;
}

/**
 * هل الساعة داخل نطاق الهدوء؟ يدعم النطاق العابر لمنتصف الليل
 * (مثال: from=22 إلى to=7 يعني 23 و 3 و 6 داخل النطاق، و 12 خارجه).
 */
export function isInQuietHours(hour: number, q: QuietHours | undefined): boolean {
  if (!q) return false;
  const from = q.from;
  const to = q.to;
  if (from === to) return false; // نطاق فارغ = لا هدوء
  if (from < to) return hour >= from && hour < to;
  return hour >= from || hour < to; // عابر لمنتصف الليل
}

/** أول لحظة يخرج فيها اللاعب من ساعات الهدوء (بتوقيت الجهاز الحالي). */
export function quietEndsAt(now: number, q: QuietHours | undefined): number {
  if (!q) return now;
  const end = new Date(now);
  end.setHours(q.to, 0, 0, 0);
  if (end.getTime() <= now) end.setDate(end.getDate() + 1);
  return end.getTime();
}

// ─────────────────────────── قرار التسليم ───────────────────────────

export type DeliveryAction = "deliver" | "defer" | "drop";

export type DeliveryReason =
  | "delivered"
  | "category_muted"
  | "account_notice"
  | "critical"
  | "quiet_hours"
  | "below_threshold"
  | "rate_limited";

export interface DeliveryInput {
  type?: string;
  category?: string;
  priority?: string;
  /** هل كتم اللاعب هذه الفئة صراحةً؟ */
  muted: boolean;
  quietHours?: QuietHours;
  /** هل يُؤجَّل ما وقع في ساعات الهدوء أم يُسقَط؟ */
  quietDefer: boolean;
  minPriority: string;
  maxPerHour: number;
  /** الساعة الحالية (0-23) بتوقيت الجهاز. */
  nowHour: number;
  /** عدد الإشعارات المسلَّمة فعلاً في الساعة المنقضية. */
  recentCount: number;
}

export interface DeliveryDecision {
  action: DeliveryAction;
  reason: DeliveryReason;
  /** لماذا — جملة عربية تظهر في سجل وحدة الإشعارات. */
  explain: string;
}

/**
 * القرار الوحيد الموحّد لتسليم أي إشعار في اللعبة.
 * لا يلمس قاعدة البيانات ولا الوقت الحقيقي — مدخلاته صريحة، فنتيجته محسومة.
 */
export function decideDelivery(input: DeliveryInput): DeliveryDecision {
  const category = normalizeCategory(input.category);
  const accountNotice = isAccountNotice(input);
  const critical = isCritical(input);

  // ① إشعار عقوبة على الحساب: لا يُكتم ولا يُؤجَّل مهما كانت تفضيلات اللاعب.
  if (accountNotice) {
    return {
      action: "deliver",
      reason: "account_notice",
      explain: "إشعار عقوبة على الحساب — يتجاوز الكتم والهدوء دائماً",
    };
  }

  // ② كتم صريح للفئة: قرار اللاعب الصريح يُحترم بلا استثناء.
  if (input.muted) {
    return {
      action: "drop",
      reason: "category_muted",
      explain: `فئة «${NOTIF_CATEGORY_LABELS[category]}» مكتومة بطلب اللاعب — لم يُخزَّن شيء`,
    };
  }

  // ③ الأولوية الحرجة: تتجاوز الهدوء والسقف.
  if (critical) {
    return {
      action: "deliver",
      reason: "critical",
      explain: "أولوية حرجة — تتجاوز ساعات الهدوء والسقف الساعي",
    };
  }

  // ④ ساعات الهدوء.
  if (isInQuietHours(input.nowHour, input.quietHours)) {
    if (!input.quietDefer) {
      return {
        action: "drop",
        reason: "quiet_hours",
        explain: "داخل ساعات الهدوء واللاعب ألغى التأجيل — أُسقط الإشعار",
      };
    }
    return {
      action: "defer",
      reason: "quiet_hours",
      explain: "داخل ساعات الهدوء — أُجّل إلى ما بعد انتهائها بدل أن يضيع",
    };
  }

  // ⑤ دون أدنى أولوية يقبلها اللاعب.
  const minRank = PRIORITY_RANK[input.minPriority] ?? 0;
  if (resolvedRank(input) < minRank) {
    return {
      action: "defer",
      reason: "below_threshold",
      explain: `أدنى أولوية مقبولة «${input.minPriority}» — أُجّل إلى الملخص`,
    };
  }

  // ⑥ السقف الساعي.
  if (input.maxPerHour > 0 && input.recentCount >= input.maxPerHour) {
    return {
      action: "defer",
      reason: "rate_limited",
      explain: `بلوغ السقف الساعي (${input.maxPerHour}/ساعة) — أُجّل`,
    };
  }

  return { action: "deliver", reason: "delivered", explain: "تسليم فوري بلا قيود" };
}

/** هل يستحق هذا الإشعار أن يُسلَّم لاحقاً وهو في الطابور؟ (الكتم يسري حتى على الطابور) */
export function survivesQueue(
  entry: { type?: string; category?: string; muted: boolean },
): boolean {
  if (isAccountNotice(entry)) return true;
  return !entry.muted;
}
