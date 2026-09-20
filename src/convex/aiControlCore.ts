/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎛️ v12.0 — نواة السيطرة على الوكلاء (منطق نقي بلا اعتماديات)
 *
 * العقد الواحد بين: غرفة الوكلاء في الواجهة، وخادم السيطرة، والمُوزِّع،
 * وجسر مركز الذكاء، وكل نبضة تنفيذ — فلا يقرّر أحد حالة أي ذكاء بنفسه.
 *
 * ما تحكمه هذه النواة:
 *   ① الحالة الفعلية لكل ذكاء: يعمل · موقوف · موقوف حتى وقت يكتبه المالك · استهلك حصته
 *   ② الحصص (في الساعة/في اليوم) بنوافذ زمنية متجددة — «بعيداً عن الحد المسموح»
 *   ③ القدرات الممنوحة/المسحوبة — قرار حقيقي لا شارة
 *   ④ الأوامر النصية التي يكتبها المالك لكل ذكاء + الأشياء الموقوفة بالاسم
 *   ⑤ التشخيص الصادق: لماذا لا يعمل هذا الذكاء الآن؟ (سبب مكتوب لا «لا شيء»)
 *   ⑥ الملخّص: كم ذكاءً يعمل فعلاً، وكم يستهلك، وأين الفوضى
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { AiCapability, AiEntry } from "./aiRegistry";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** أقصى مدة إيقاف يكتبها المالك (ساعة) */
export const MAX_STOP_HOURS = 24 * 365;
/** أقصى سقف حصة */
export const MAX_CAP = 5000;
/** أقصى طول أمر نصي */
export const MAX_ORDER_LEN = 200;
/** أقصى عدد أوامر فعّالة لكل ذكاء */
export const MAX_ORDERS = 12;

export interface AiOrder {
  id: string;
  text: string;
  at: number;
}

export interface AiCounters {
  hourStart: number;
  hourCount: number;
  dayStart: number;
  dayCount: number;
}

export interface AiControlRow {
  key: string;
  enabled: boolean;
  /** 0 = بلا انتهاء؛ وإلا وقت انتهاء الإيقاف (ms) */
  disabledUntil: number;
  capPerHour: number;
  capPerDay: number;
  orders: AiOrder[];
  granted: AiCapability[];
  revoked: AiCapability[];
  /** أشياء أوقفها المالك بالاسم (من `stoppables`) */
  stopped: string[];
  note: string;
  counters: AiCounters;
  totalRuns: number;
  totalErrors: number;
  lastRunAt: number;
  lastResult: string;
  updatedAt: number;
}

export type AiState = "on" | "off" | "paused" | "quota";

export interface AiResolution {
  state: AiState;
  allowed: boolean;
  reason: string;
  /** إن كان موقوفاً: كم يتبقّى بالدقائق */
  remainingMinutes: number;
  quota: { perHour: number; perDay: number; hourLeft: number; dayLeft: number; hourUsed: number; dayUsed: number };
}

// ───────────────────────────────────────────────────────────────────────
// ① الافتراضي — يُبنى من السجل نفسه
// ───────────────────────────────────────────────────────────────────────

export function defaultControl(entry: AiEntry, now: number): AiControlRow {
  return {
    key: entry.key,
    enabled: entry.defaultOn,
    disabledUntil: 0,
    capPerHour: entry.caps.perHour,
    capPerDay: entry.caps.perDay,
    orders: [],
    granted: [],
    revoked: [],
    stopped: [],
    note: "",
    counters: { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 },
    totalRuns: 0,
    totalErrors: 0,
    lastRunAt: 0,
    lastResult: "",
    updatedAt: now,
  };
}

export function emptyCounters(now: number): AiCounters {
  return { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
}

// ───────────────────────────────────────────────────────────────────────
// ② نوافذ الحصص — تتجدّد تلقائياً بلا أي مهمة صيانة
// ───────────────────────────────────────────────────────────────────────

export function rollCounters(counters: AiCounters | undefined, now: number): AiCounters {
  const c = counters ?? emptyCounters(now);
  const hourStart = now - c.hourStart >= HOUR_MS ? now : c.hourStart;
  const dayStart = now - c.dayStart >= DAY_MS ? now : c.dayStart;
  return {
    hourStart,
    hourCount: hourStart === c.hourStart ? c.hourCount : 0,
    dayStart,
    dayCount: dayStart === c.dayStart ? c.dayCount : 0,
  };
}

export function noteRunUsage(counters: AiCounters | undefined, now: number): AiCounters {
  const rolled = rollCounters(counters, now);
  return { ...rolled, hourCount: rolled.hourCount + 1, dayCount: rolled.dayCount + 1 };
}

export function quotaInfo(counters: AiCounters | undefined, row: Pick<AiControlRow, "capPerHour" | "capPerDay">, now: number) {
  const rolled = rollCounters(counters, now);
  return {
    perHour: row.capPerHour,
    perDay: row.capPerDay,
    hourUsed: rolled.hourCount,
    dayUsed: rolled.dayCount,
    hourLeft: row.capPerHour <= 0 ? Number.POSITIVE_INFINITY : Math.max(0, row.capPerHour - rolled.hourCount),
    dayLeft: row.capPerDay <= 0 ? Number.POSITIVE_INFINITY : Math.max(0, row.capPerDay - rolled.dayCount),
  };
}

// ───────────────────────────────────────────────────────────────────────
// ③ الحالة الفعلية — القرار الذي يحكم كل تنفيذ
// ───────────────────────────────────────────────────────────────────────

export function resolveAiState(
  entry: AiEntry,
  row: AiControlRow | null,
  now: number,
): AiResolution {
  const control = row ?? defaultControl(entry, now);
  const quota = quotaInfo(control.counters, control, now);

  if (entry.wiring === "dormant") {
    return {
      state: "off",
      allowed: false,
      reason: entry.dormantReason ?? "نائم — يحتاج شرطاً خارجياً",
      remainingMinutes: 0,
      quota,
    };
  }

  if (!control.enabled) {
    if (control.disabledUntil > now) {
      return {
        state: "paused",
        allowed: false,
        reason: `موقوف بأمر العرش حتى ${new Date(control.disabledUntil).toLocaleString("ar")}`,
        remainingMinutes: Math.ceil((control.disabledUntil - now) / 60000),
        quota,
      };
    }
    return { state: "off", allowed: false, reason: "مُطفأ — أوقفه العرش", remainingMinutes: 0, quota };
  }

  if (control.capPerHour > 0 && quota.hourUsed >= control.capPerHour) {
    return {
      state: "quota",
      allowed: false,
      reason: `استهلك حصته في الساعة (${quota.hourUsed}/${control.capPerHour}) — يستأنف تلقائياً`,
      remainingMinutes: Math.ceil((control.counters.hourStart + HOUR_MS - now) / 60000),
      quota,
    };
  }
  if (control.capPerDay > 0 && quota.dayUsed >= control.capPerDay) {
    return {
      state: "quota",
      allowed: false,
      reason: `استهلك حصته اليومية (${quota.dayUsed}/${control.capPerDay}) — يستأنف تلقائياً`,
      remainingMinutes: Math.ceil((control.counters.dayStart + DAY_MS - now) / 60000),
      quota,
    };
  }

  return { state: "on", allowed: true, reason: "يعمل — ضمن حدوده", remainingMinutes: 0, quota };
}

/** التشغيل اليدوي من العرش: يتجاوز الإطفاء والوقت، لكنه لا يكسر الحصة إلا إن اختار المالك */
export function manualRunAllowed(entry: AiEntry, row: AiControlRow | null, now: number, force: boolean) {
  const res = resolveAiState(entry, row, now);
  if (res.allowed) return { ok: true, reason: "يعمل" };
  if (entry.wiring === "dormant") return { ok: false, reason: entry.dormantReason ?? "نائم" };
  if (force) return { ok: true, reason: "تشغيل قسري بأمر العرش (يتجاوز الحالة)" };
  return { ok: false, reason: res.reason };
}

// ───────────────────────────────────────────────────────────────────────
// ④ القدرات والأوامر والأشياء الموقوفة
// ───────────────────────────────────────────────────────────────────────

/** القدرات الفعلية = قدرات السجل + الممنوح − المسحوب */
export function effectiveCapabilities(entry: AiEntry, row: AiControlRow | null): AiCapability[] {
  const granted = new Set<AiCapability>([...(entry.capabilities as AiCapability[]), ...((row?.granted ?? []) as AiCapability[])]);
  for (const r of (row?.revoked ?? []) as AiCapability[]) granted.delete(r);
  return [...granted];
}

export function hasCapability(entry: AiEntry, row: AiControlRow | null, cap: AiCapability): boolean {
  return effectiveCapabilities(entry, row).includes(cap);
}

export function isFeatureStopped(row: AiControlRow | null, feature: string): boolean {
  return (row?.stopped ?? []).includes(feature);
}

/** تنظيف أمر المالك: بلا أسطر مخفية، بطول معقول، وبلا فراغات مكرّرة */
export function sanitizeOrder(text: string): string {
  return (text ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ORDER_LEN);
}

export function appendOrder(orders: AiOrder[], text: string, now: number): AiOrder[] {
  const clean = sanitizeOrder(text);
  if (clean.length < 3) return orders;
  const row: AiOrder = { id: `o-${now}-${Math.floor(Math.random() * 1e6)}`, text: clean, at: now };
  return [row, ...orders].slice(0, MAX_ORDERS);
}

export function clampCap(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(MAX_CAP, n));
}

/** الساعات التي يكتبها المالك للتوأيقيت: ٠ = بلا انتهاء، والأقصى سنة */
export function clampStopHours(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(MAX_STOP_HOURS, Math.round(n * 10) / 10));
}

export function disabledUntilFrom(hours: number, now: number): number {
  return hours <= 0 ? 0 : now + Math.round(hours * HOUR_MS);
}

// ───────────────────────────────────────────────────────────────────────
// ⑤ التشخيص الصادق — «لماذا لا يعمل؟» بجواب مكتوب
// ───────────────────────────────────────────────────────────────────────

export interface AiLiveFacts {
  hasKey: boolean;
  deputyOnline: boolean;
  job?: { enabled: boolean; lastRunAt: number; lastStatus: string; lastResult: string; errorCount: number } | null;
  unit?: { enabled: boolean; sensitivity: number; lastEventAt: number; eventCount: number } | null;
  agentsCount?: number;
  rows?: number;
}

export interface AiDiagnosis {
  level: "working" | "idle" | "blocked" | "dormant" | "error";
  headline: string;
  reasons: string[];
}

export function diagnoseAi(entry: AiEntry, row: AiControlRow | null, live: AiLiveFacts, now: number): AiDiagnosis {
  const reasons: string[] = [];
  const res = resolveAiState(entry, row, now);

  if (entry.wiring === "dormant") {
    reasons.push(entry.dormantReason ?? "يحتاج شرطاً خارجياً");
    if (!live.hasKey) reasons.push("لا يوجد مفتاح ذكاء مضبوط في مركز API");
    if (!live.deputyOnline) reasons.push("نائب المالك غير متصل — الأنظمة الحرة معطّلة");
    return { level: "dormant", headline: "نائم", reasons };
  }

  if (res.state === "paused") {
    reasons.push(res.reason);
    return { level: "blocked", headline: `موقوف ${res.remainingMinutes} دقيقة`, reasons };
  }
  if (res.state === "off") {
    reasons.push("مُطفأ من غرفة الوكلاء");
    if (entry.defaultOn) reasons.push("كان مفعّلاً افتراضياً — أوقفه أمر يدوي");
    return { level: "blocked", headline: "مُطفأ", reasons };
  }
  if (res.state === "quota") {
    reasons.push(res.reason);
    return { level: "blocked", headline: "استهلك حصته", reasons };
  }

  // يعمل — لكن هل ينفّذ فعلاً؟
  const last = row?.lastRunAt ?? 0;
  const lastJobRun = live.job?.lastRunAt ?? 0;
  const latest = Math.max(last, lastJobRun);
  if (live.job && live.job.lastStatus === "error") {
    reasons.push(`آخر تنفيذ فشل: ${live.job.lastResult || "خطأ غير مفسَّر"}`);
    return { level: "error", headline: "يفشل عند التنفيذ", reasons };
  }
  if (entry.kind === "colony" && entry.key === "colony_agents" && (live.agentsCount ?? 0) === 0) {
    reasons.push("لا يوجد أي وكيل حيّ بعد — شغّل النبضة مرة لتولد العائلة الأولى");
  }
  if (entry.kind === "unit" && live.unit && live.unit.eventCount === 0) {
    reasons.push("لم يسجّل أي حدث بعد — لم تُنفَّذ أي دورة له");
  }
  if (!latest) {
    reasons.push("لم يعمل ولا مرة واحدة منذ إنشائه");
    return { level: "idle", headline: "ينتظر أول دورة", reasons };
  }
  const silentFor = now - latest;
  if (silentFor > 3 * DAY_MS) {
    reasons.push(`آخر نشاط قبل ${Math.floor(silentFor / DAY_MS)} يوم — قد تكون دوريته طويلة`);
    return { level: "idle", headline: "يعمل لكنه صامت طويلاً", reasons };
  }
  reasons.push(`آخر تنفيذ: ${new Date(latest).toLocaleString("ar")}`);
  return { level: "working", headline: "يعمل فعلاً", reasons };
}

// ───────────────────────────────────────────────────────────────────────
// ⑥ الملخّص — نبضة الغرفة
// ───────────────────────────────────────────────────────────────────────

export interface RoomRowView {
  key: string;
  name: string;
  emoji: string;
  dept: string;
  kind: string;
  wiring: string;
  state: AiState | "dormant";
  headline: string;
  hourUsed: number;
  dayUsed: number;
  capPerHour: number;
  capPerDay: number;
  enabled: boolean;
  disabledUntil: number;
  totalRuns: number;
  totalErrors: number;
  lastRunAt: number;
  capabilities: AiCapability[];
  stopped: string[];
  orders: number;
}

export function roomSummary(rows: RoomRowView[], now: number) {
  const working = rows.filter((r) => r.state === "on").length;
  const paused = rows.filter((r) => r.state === "paused").length;
  const off = rows.filter((r) => r.state === "off").length;
  const quota = rows.filter((r) => r.state === "quota").length;
  const dormant = rows.filter((r) => r.state === "dormant").length;
  const totalRuns = rows.reduce((s, r) => s + r.totalRuns, 0);
  const totalErrors = rows.reduce((s, r) => s + r.totalErrors, 0);
  const usedToday = rows.reduce((s, r) => s + r.dayUsed, 0);
  const capToday = rows.reduce((s, r) => s + (r.capPerDay > 0 ? r.capPerDay : 0), 0);
  const stoppedFeatures = rows.reduce((s, r) => s + r.stopped.length, 0);
  const stale = rows.filter((r) => r.state === "on" && r.lastRunAt > 0 && now - r.lastRunAt > 3 * DAY_MS).length;
  return {
    total: rows.length,
    working,
    paused,
    off,
    quota,
    dormant,
    stale,
    totalRuns,
    totalErrors,
    usedToday,
    capToday,
    /** نسبة ما استُهلك من سقف اليوم — «بعيداً عن الحد المسموح» */
    usagePercent: capToday === 0 ? 0 : Math.min(100, Math.round((usedToday / capToday) * 100)),
    stoppedFeatures,
    at: now,
  };
}
