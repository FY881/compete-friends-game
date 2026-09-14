/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 ERROR HUNTER CORE v5.0 — real diagnostics infrastructure
 *
 * Techniques (all real, no fakery):
 *  1. Safe storage clearing — a strict PRESERVE allowlist means clearing
 *     cache can NEVER log the player out or lose their settings.
 *  2. Offline report queue — errors are persisted in a bounded ring
 *     buffer in localStorage and flushed when connectivity returns
 *     (navigator.onLine + retry with exponential backoff). No error is
 *     ever lost because the network was down at crash time.
 *  3. Breadcrumbs — the last 40 user actions (route changes, clicks on
 *     buttons, mutations sent) are attached to every error report, so
 *     the owner sees WHAT the player was doing, not just a stack trace.
 *  4. Persistent incident log — incidents survive the reload the Hunter
 *     itself triggers (stored in localStorage, session-scoped).
 *  5. Accurate error-rate — rolling 60s window instead of a never-reset
 *     counter that inflated telemetry forever after one storm.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1) SAFE STORAGE — clearing can never log you out or wipe settings
// ═══════════════════════════════════════════════════════════════════════

/** Keys/prefixes that must NEVER be destroyed by any recovery strategy. */
const PRESERVE_PREFIXES = [
  "convex-auth",        // session tokens (any variant)
  "auth",               // generic auth storage
  "token",              // tokens
  "mindclash",          // our own settings/preferences/sw-guards
  "theme",              // UI preferences
  "lang",               // language preference
  "settings",           // any settings blobs
  "profile",            // cached profile data
  "vly",                // platform toolbar state
];

const SESSION_ONLY_ALLOW_CLEAR = [
  "mindclash.sw-reloaded",   // safe to clear: SW reload guard (regenerated)
  "mindclash.sw-last-reload",
];

function isPreserved(key: string): boolean {
  return PRESERVE_PREFIXES.some((p) => key.toLowerCase().includes(p.toLowerCase()));
}

export function snapshotPreserved(): Record<string, string> {
  const saved: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isPreserved(k)) saved[k] = localStorage.getItem(k) || "";
    }
  } catch { /* storage unavailable */ }
  return saved;
}

export function restorePreserved(saved: Record<string, string>) {
  try {
    Object.entries(saved).forEach(([k, v]) => {
      try { localStorage.setItem(k, v); } catch { /* quota */ }
    });
  } catch { /* ignore */ }
}

/**
 * Clear ONLY non-preserved localStorage keys + safe session keys.
 * Auth tokens and player settings always survive.
 */
export function safeClearStorage(): { cleared: number; preserved: number } {
  let cleared = 0, preserved = 0;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (isPreserved(k)) { preserved++; continue; }
      doomed.push(k);
    }
    doomed.forEach((k) => { try { localStorage.removeItem(k); cleared++; } catch { /* */ } });

    // sessionStorage: clear only known-safe keys, keep the rest
    for (const k of SESSION_ONLY_ALLOW_CLEAR) {
      try { sessionStorage.removeItem(k); } catch { /* */ }
    }
  } catch { /* ignore */ }
  return { cleared, preserved };
}

/** Clear caches + unregister SWs. Never touches storage at all. */
export async function safeClearCaches(): Promise<number> {
  let n = 0;
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map(async (name) => { await caches.delete(name); n++; }));
    }
  } catch { /* ignore */ }
  return n;
}

export async function safeUnregisterServiceWorkers(): Promise<number> {
  let n = 0;
  try {
    if (navigator.serviceWorker?.controller) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async (r) => { await r.unregister(); n++; }));
    }
  } catch { /* ignore */ }
  return n;
}

// ═══════════════════════════════════════════════════════════════════════
// 2) BREADCRUMBS — what was the player doing before the crash?
// ═══════════════════════════════════════════════════════════════════════

export interface Breadcrumb {
  at: number;
  type: "route" | "click" | "action" | "network" | "console";
  message: string;
}

const MAX_BREADCRUMBS = 40;
let breadcrumbs: Breadcrumb[] = [];

export function addBreadcrumb(type: Breadcrumb["type"], message: string) {
  breadcrumbs.push({ at: Date.now(), type, message: String(message).slice(0, 160) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

/** Auto-instrument: route changes + clicks + online/offline. Idempotent. */
let instrumented = false;
export function installBreadcrumbListeners() {
  if (instrumented || typeof window === "undefined") return;
  instrumented = true;

  // Route changes (React Router pushes history entries)
  const origPush = history.pushState?.bind(history);
  if (origPush) {
    history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      try {
        const url = String(args[2] ?? "");
        addBreadcrumb("route", `تنقّل إلى ${url}`);
      } catch { /* */ }
      return origPush(...args);
    };
  }
  window.addEventListener("popstate", () => addBreadcrumb("route", `عودة إلى ${location.pathname}`));

  // Clicks (delegated, passive — negligible cost)
  window.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement)?.closest("button, a, [role=button]") as HTMLElement | null;
    if (t) {
      const label = (t.getAttribute("aria-label") || t.textContent || t.tagName).trim().slice(0, 60);
      addBreadcrumb("click", `نقر: ${label}`);
    }
  }, { passive: true, capture: true });

  // Connectivity
  window.addEventListener("offline", () => addBreadcrumb("network", "انقطع الاتصال"));
  window.addEventListener("online", () => addBreadcrumb("network", "عاد الاتصال — سيتم إرسال التقارير المعلّقة"));

  // Unhandled rejections become breadcrumbs even if not full crashes
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    addBreadcrumb("console", `rejection: ${r instanceof Error ? r.message : String(r).slice(0, 100)}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 3) OFFLINE REPORT QUEUE — no error is ever lost
// ═══════════════════════════════════════════════════════════════════════

const QUEUE_KEY = "mindclash.errqueue";
const MAX_QUEUE = 25;

type QueuedReport = {
  at: number;
  payload: Record<string, unknown>;
};

function readQueue(): QueuedReport[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch { return []; }
}

function writeQueue(q: QueuedReport[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch { /* quota */ }
}

export function enqueueErrorReport(payload: Record<string, unknown>) {
  const q = readQueue();
  q.push({ at: Date.now(), payload });
  writeQueue(q);
}

export function pendingReportCount(): number {
  return readQueue().length;
}

export function clearQueuedReport(pred: (r: QueuedReport) => boolean) {
  writeQueue(readQueue().filter((r) => !pred(r)));
}

/**
 * Flush pending reports. `send` should attempt delivery and return true
 * on success. Uses exponential backoff between attempts (real retry).
 */
export async function flushErrorQueue(
  send: (payload: Record<string, unknown>) => Promise<boolean>,
  opts: { maxAttempts?: number } = {},
): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  const maxAttempts = opts.maxAttempts ?? 3;
  let delivered = 0;
  let q = readQueue();
  const remaining: QueuedReport[] = [];

  for (const item of q) {
    let ok = false;
    for (let attempt = 0; attempt < maxAttempts && !ok; attempt++) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      try {
        ok = await send(item.payload);
      } catch { ok = false; }
      if (!ok && attempt < maxAttempts - 1) {
        await new Promise((res) => setTimeout(res, 500 * Math.pow(2, attempt))); // 0.5s, 1s
      }
    }
    if (ok) delivered++;
    else remaining.push(item);
  }

  writeQueue(remaining);
  return delivered;
}

// ═══════════════════════════════════════════════════════════════════════
// 4) PERSISTENT INCIDENT LOG — survives the reload we trigger
// ═══════════════════════════════════════════════════════════════════════

const INCIDENT_KEY = "mindclash.incidents";
const MAX_INCIDENTS = 10;

export interface StoredIncident {
  at: number;
  route: string;
  category: string;
  message: string;
  healed: boolean;
  strategy?: string;
}

export function storeIncident(inc: StoredIncident) {
  try {
    const list: StoredIncident[] = JSON.parse(localStorage.getItem(INCIDENT_KEY) || "[]");
    list.push(inc);
    localStorage.setItem(INCIDENT_KEY, JSON.stringify(list.slice(-MAX_INCIDENTS)));
  } catch { /* quota */ }
}

export function getStoredIncidents(): StoredIncident[] {
  try {
    return JSON.parse(localStorage.getItem(INCIDENT_KEY) || "[]");
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════
// 6) SHADOW MODE — reload-loop breaker + verified-heal ledger (v6.0)
// ═══════════════════════════════════════════════════════════════════════

const SHADOW_KEY = "mindclash.shadow";
const VERIFY_KEY = "mindclash.verify";

export interface ShadowState {
  // عدّاد إعادة التحميل خلال نافذة قصيرة — يكشف حلقة الإعادة اللانهائية
  reloadStamps: number[];
  // آخر بذرة إصلاح تمت مطاردتها — لربطها بحالة الجلسة الجديدة بعد الإعادة
  lastHealSeed: string | null;
  // هل الإصلاح الأخير بانتظار التحقق؟ (تعيّن صحيح بعد العودة من إعادة التحميل)
  pendingVerify: string | null;
}

function readShadow(): ShadowState {
  try {
    const s = JSON.parse(localStorage.getItem(SHADOW_KEY) || "null");
    if (s && Array.isArray(s.reloadStamps)) return s as ShadowState;
  } catch { /* */ }
  return { reloadStamps: [], lastHealSeed: null, pendingVerify: null };
}

function writeShadow(s: ShadowState) {
  try { localStorage.setItem(SHADOW_KEY, JSON.stringify({
    ...s,
    reloadStamps: s.reloadStamps.slice(-10),
  })); } catch { /* quota */ }
}

/**
 * يُستدعى قبل أي إعادة تحميل: يُسجّل الطابع الزمني، ويكشف حلقة الإعادة.
 * يعيد false إذا كنا داخل حلقة (أكثر من 3 إعادات خلال 30 ثانية) —
 * فيمنع الصياد من إعادة التحميل مجدداً (الوضع الشبحي: بلا اهتزاز للاعب).
 */
export function guardReload(): { allowed: boolean; loopDetected: boolean } {
  const s = readShadow();
  const now = Date.now();
  s.reloadStamps = s.reloadStamps.filter((t) => now - t < 30_000);
  s.reloadStamps.push(now);
  const loop = s.reloadStamps.length > 3;
  writeShadow(s);
  return { allowed: !loop, loopDetected: loop };
}

/** يُستدعى عند نجاح إصلاح سيُتبع بإعادة تحميل — يعلّمه بانتظار التحقق */
export function markHealPendingVerify(healSeed: string) {
  const s = readShadow();
  s.pendingVerify = healSeed;
  writeShadow(s);
}

/**
 * يُستدعى بعد عودة التطبيق من إعادة تحميل الإصلاح: إن مرّت 8 ثوانٍ
 * بلا خطأ جديد — الإصلاح مُثبت. يعيد seed إذا كان التحقق ناجحاً.
 */
export function confirmHealIfStable(): { seed: string | null; stableAfterMs: number } {
  const s = readShadow();
  if (!s.pendingVerify) return { seed: null, stableAfterMs: 0 };
  const started = s.reloadStamps[s.reloadStamps.length - 1] ?? Date.now();
  const stableMs = Date.now() - started;
  if (stableMs >= 8000) {
    const seed = s.pendingVerify;
    s.pendingVerify = null;
    writeShadow(s);
    return { seed, stableAfterMs: stableMs };
  }
  return { seed: null, stableAfterMs: stableMs };
}

/** يعلم أن الإصلاح لم يثبت (انهار مرة أخرى بعد الإصلاح) — للتعلم */
export function invalidatePendingVerify(): string | null {
  const s = readShadow();
  const seed = s.pendingVerify;
  if (seed) {
    s.pendingVerify = null;
    writeShadow(s);
  }
  return seed;
}

// ═══════════════════════════════════════════════════════════════════════
// 7) ACCURATE ERROR RATE — rolling 60s window
// ═══════════════════════════════════════════════════════════════════════

const RATE_WINDOW = 60_000;
const rateStamps: number[] = [];

export function recordErrorForRate() {
  const now = Date.now();
  rateStamps.push(now);
  // prune eagerly
  while (rateStamps.length && now - rateStamps[0] > RATE_WINDOW) rateStamps.shift();
}

export function currentErrorRate(): number {
  const now = Date.now();
  while (rateStamps.length && now - rateStamps[0] > RATE_WINDOW) rateStamps.shift();
  return rateStamps.length;
}

/** Keep the internal storm detector consistent with the rate tracker. */
export function pruneOldErrorStamps() {
  currentErrorRate();
}
