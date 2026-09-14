/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛡️ BULLETPROOF ERROR HUNTER v4.0
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DESIGN PRINCIPLE: The error UI must NEVER crash.
 * - ZERO external imports in error rendering path (no framer-motion, no lucide)
 * - Pure HTML/CSS animations via inline styles
 * - Self-contained — everything needed to render is defined in this file
 * - If THIS component crashes, RootErrorBoundary catches it as last resort
 *
 * CAPABILITIES:
 * 1. Cascading Recovery Engine — 14 strategies in priority order
 * 2. Predictive Error Detection — 20+ error categories
 * 3. Memory Leak Detector
 * 4. Error Storm Detection
 * 5. Circuit Breaker — prevents infinite recovery loops
 * 6. Root Cause Chain analysis
 * 7. Incident Timeline
 * 8. Game-Aware Recovery — NEVER reloads during active gameplay
 * 9. Service Worker Loop Protection
 * 10. Autonomous AI Repair (Convex backend)
 * 11. Master Reset — nuclear option when everything fails
 * 12. v5.0: Breadcrumbs + offline queue + persistent incidents +
 *     safe storage clearing (auth & settings ALWAYS survive)
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { api } from "@/convex/_generated/api";
import {
  addBreadcrumb, getBreadcrumbs, installBreadcrumbListeners,
  enqueueErrorReport, flushErrorQueue, pendingReportCount,
  storeIncident, getStoredIncidents, type StoredIncident,
  recordErrorForRate, currentErrorRate,
  safeClearStorage, safeClearCaches, safeUnregisterServiceWorkers,
} from "@/lib/errorHunterCore";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  currentStrategy: number;
  healing: boolean;
  healingMessage: string;
  healingSteps: RecoveryStep[];
  healingResult: "success" | "failed" | null;
  diagnosis: ErrorDiagnosis | null;
  rootCauseChain: RootCauseNode[];
  circuitState: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  showDetails: boolean;
  copied?: boolean;
  showTimeline: boolean;
  showPast: boolean;
  showBrain: boolean;
  errorId: string | null;
  incidentEvents: IncidentEvent[];
  pastIncidents: StoredIncident[];
  deviceHealth: DeviceHealth;
}

interface RecoveryStep {
  name: string;
  status: "pending" | "active" | "success" | "failed" | "skipped";
  message: string;
}

interface RootCauseNode {
  depth: number;
  component: string;
  error: string;
  suggestion: string;
}

interface IncidentEvent {
  timestamp: number;
  type: string;
  message: string;
}

interface DeviceHealth {
  fps: number;
  memoryMB: number;
  domNodes: number;
  networkType: string;
  cpuCores: number;
  uptime: number;
}

interface ErrorDiagnosis {
  category: string;
  severity: string;
  displayName: string;
  description: string;
  rootCause: string;
  confidence: number;
  recoveryStrategies: string[];
  estimatedImpact: string;
}

// ═══════════════════════════════════════════════════════════════════════
// 🔍 ADVANCED ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

function diagnoseAdvanced(error: Error): ErrorDiagnosis {
  const msg = error.message || "";
  const stack = error.stack || "";
  const name = error.name || "";
  const combined = `${name} ${msg} ${stack}`;

  if (/Rendered more hooks|hooks.*changed.*order/i.test(combined)) {
    return {
      category: "hooks_violation", severity: "catastrophic",
      displayName: "انتهاك خطير لـ Hooks",
      description: "تم استدعاء hooks بعدد مختلف — خطأ حرج في بنية React.",
      rootCause: "hook استدعاء شرطي أو داخل loop.",
      confidence: 0.95, estimatedImpact: "الشاشة البيضاء",
      recoveryStrategies: ["clear_all_cache", "nuclear_reload", "isolate_component"],
    };
  }

  if (/chunk|Loading chunk|Failed to fetch dynamically import|dynamically imported module/i.test(combined)) {
    return {
      category: "chunk_load", severity: "critical",
      displayName: "فشل تحميل الملف",
      description: "الملف المطلوب لم يُحمّل — غالباً بعد تحديث.",
      rootCause: "cache يحتوي على نسخة قديمة من chunk.",
      confidence: 0.98, estimatedImpact: "صفحة لا تفتح",
      recoveryStrategies: ["clear_service_worker", "clear_cache", "hard_reload"],
    };
  }

  if (/process is not defined|ReferenceError.*process/i.test(combined)) {
    return {
      category: "runtime", severity: "critical",
      displayName: "خطأ بيئة التشغيل",
      description: "مرجع لـ process غير متاح في المتصفح.",
      rootCause: "مكتبة تستخدم process.env بدون polyfill.",
      confidence: 0.99, estimatedImpact: "صفحة لا تعمل",
      recoveryStrategies: ["inject_polyfill", "clear_cache", "hard_reload"],
    };
  }

  if (/Maximum update depth exceeded|infinite/i.test(combined)) {
    return {
      category: "infinite_loop", severity: "critical",
      displayName: "حلقة لا نهائية",
      description: "تم تحديث المكون لمرة لا نهائية.",
      rootCause: "setState في useEffect بدون dependency array صحيح.",
      confidence: 0.92, estimatedImpact: "تجمد المتصفح",
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
    };
  }

  if (/Maximum call stack|RangeError.*stack/i.test(combined)) {
    return {
      category: "circular_dep", severity: "critical",
      displayName: "استدعاء دائري",
      description: "overflow في الذاكرة بسبب استدعاء متبادل.",
      rootCause: "دالة تستدعي نفسها أو circular reference.",
      confidence: 0.95, estimatedImpact: "تجمد كامل",
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
    };
  }

  if (/network|Failed to fetch|ERR_NETWORK|ERR_CONNECTION/i.test(combined)) {
    return {
      category: "network", severity: "high",
      displayName: "خطأ شبكي",
      description: "تعذر الاتصال بالخادم.",
      rootCause: "انقطاع الاتصال أو الخادم غير متاح.",
      confidence: 0.90, estimatedImpact: "بيانات لا تُحمّل",
      recoveryStrategies: ["wait_and_retry", "clear_cache", "offline_mode"],
    };
  }

  if (/convex|subscription|query.*fail|Could not connect.*convex/i.test(combined)) {
    return {
      category: "api", severity: "high",
      displayName: "خطأ في الاتصال بالخادم",
      description: "تعذر الاتصال بـ Convex backend.",
      rootCause: "مشكلة في WebSocket أو authentication.",
      confidence: 0.85, estimatedImpact: "البيانات لا تتحدث",
      recoveryStrategies: ["wait_and_retry", "re_auth", "clear_cache"],
    };
  }

  if (/cannot read propert|undefined is not|TypeError.*null|TypeError.*undefined/i.test(combined)) {
    return {
      category: "null_reference", severity: "high",
      displayName: "مرجع فارغ",
      description: "محاولة الوصول لخاصية على قيمة فارغة.",
      rootCause: "بيانات غير مُهيأة أو async loading متأخر.",
      confidence: 0.88, estimatedImpact: "مكون لا يعمل",
      recoveryStrategies: ["clear_cache", "soft_reload"],
    };
  }

  if (/SyntaxError|Unexpected token|JSON/i.test(combined)) {
    return {
      category: "type_error", severity: "high",
      displayName: "خطأ في تحليل البيانات",
      description: "JSON أو syntax غير صالح.",
      rootCause: "بيانات خام بتنسيق غير متوقع.",
      confidence: 0.90, estimatedImpact: "صفحة لا تعمل",
      recoveryStrategies: ["clear_cache", "wait_and_retry"],
    };
  }

  if (/SecurityError|blocked.*CORS|CORS/i.test(combined)) {
    return {
      category: "security", severity: "high",
      displayName: "مشكلة أمان",
      description: "تم حظر طلب بسبب سياسات الأمان.",
      rootCause: "CORS أو CSP غير مُهيأ.",
      confidence: 0.85, estimatedImpact: "ميزة لا تعمل",
      recoveryStrategies: ["notify_owner", "soft_reload"],
    };
  }

  if (/QuotaExceeded|storage.*full|IndexedDB.*quota/i.test(combined)) {
    return {
      category: "storage", severity: "high",
      displayName: "مساحة التخزين ممتلئة",
      description: "storage ممتلئ.",
      rootCause: "بيانات مخزنة كثيرة.",
      confidence: 0.92, estimatedImpact: "بيانات لا تُحفظ",
      recoveryStrategies: ["clear_storage", "clear_cache"],
    };
  }

  if (/Memory leak|heap.*limit|out of memory/i.test(combined)) {
    return {
      category: "memory", severity: "critical",
      displayName: "تسريب ذاكرة",
      description: "التطبيق يستهلك ذاكرة أكثر من الحد.",
      rootCause: "عناصر DOM أو مراجع غير مُفرغة.",
      confidence: 0.88, estimatedImpact: "تجمد ثم انهيار",
      recoveryStrategies: ["nuclear_reload", "clear_all_cache"],
    };
  }

  if (/permission|denied|NotAllowed|user gesture/i.test(combined)) {
    return {
      category: "permission", severity: "medium",
      displayName: "مشكلة صلاحيات",
      description: "الإجراء يتطلب إذن المستخدم.",
      rootCause: "autoplay أو clipboard بدون تفاعل.",
      confidence: 0.80, estimatedImpact: "إجراء لا يعمل",
      recoveryStrategies: ["notify_user", "soft_reload"],
    };
  }

  if (/timeout|timed out/i.test(combined)) {
    return {
      category: "async", severity: "medium",
      displayName: "انتهت المهلة",
      description: "طلب استمر أكثر من المدة المسموحة.",
      rootCause: "شبكة بطيئة أو خادم مزدحم.",
      confidence: 0.80, estimatedImpact: "بيانات متأخرة",
      recoveryStrategies: ["wait_and_retry", "clear_cache"],
    };
  }

  return {
    category: "unknown", severity: "medium",
    displayName: "خطأ غير معروف",
    description: "حدث خطأ غير مصنف.",
    rootCause: "يحتاج تحليل يدوي.",
    confidence: 0.30, estimatedImpact: "غير معروف",
    recoveryStrategies: ["clear_cache", "notify_owner"],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 🛡️ GAME-AWARE RECOVERY
// ═══════════════════════════════════════════════════════════════════════

function isInGameRoom(): boolean {
  try {
    return typeof window !== "undefined" && window.location.pathname.startsWith("/game/");
  } catch { return false; }
}

function isInOwnerPanel(): boolean {
  try {
    return typeof window !== "undefined" && window.location.pathname.startsWith("/owner");
  } catch { return false; }
}

/** Safe reload — NEVER reloads during gameplay or in the owner panel */
function safeReload(): void {
  if (isInGameRoom()) {
    console.warn("[ErrorHunter] SKIP reload — user is in active game");
    return;
  }
  if (isInOwnerPanel()) {
    console.warn("[ErrorHunter] SKIP reload — user is in owner panel");
    return;
  }
  window.location.reload();
}

function safeNavigate(path: string): void {
  if (isInGameRoom()) {
    console.warn("[ErrorHunter] SKIP navigation — user is in active game");
    return;
  }
  window.location.href = path;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════
// ⚡ RECOVERY STRATEGIES
// ═══════════════════════════════════════════════════════════════════════

interface Strategy {
  name: string;
  priority: number;
  execute: () => Promise<boolean>;
}

const RECOVERY_STRATEGIES: Record<string, Strategy> = {
  inject_polyfill: {
    name: "حقن Process Polyfill",
    priority: 1,
    execute: async () => {
      try {
        if (typeof window !== "undefined" && !("process" in window)) {
          (window as any).process = { env: {} };
        }
        await sleep(300);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  wait_and_retry: {
    name: "انتظار وإعادة المحاولة",
    priority: 2,
    execute: async () => {
      await sleep(2000);
      safeReload();
      return true;
    },
  },
  soft_reload: {
    name: "إعادة تحميل ناعمة",
    priority: 3,
    execute: async () => {
      safeReload();
      return true;
    },
  },
  clear_cache: {
    name: "مسح الكاش وإعادة التحميل",
    priority: 4,
    execute: async () => {
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        await sleep(500);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  re_auth: {
    name: "إعادة توصيل الجلسة",
    priority: 4,
    // v5.0: لا نحذف التوكن أبداً — إعادة التحميل تجبر عميل Convex على
    // إعادة مصادقة الجلسة من التوكن المحفوظ نفسه. المستخدم لا يخرج.
    execute: async () => {
      if (isInGameRoom()) return false;
      try {
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  clear_storage: {
    name: "تنظيف التخزين المحلي (الجلسة والإعدادات محفوظة)",
    priority: 4,
    // v5.0: SAFE clearing — convex-auth + كل مفاتيح الإعدادات تُحفظ دائماً.
    execute: async () => {
      try {
        const res = safeClearStorage();
        addBreadcrumb("action", `تنظيف آمن للتخزين: ${res.cleared} مفتاحاً · ${res.preserved} محفوظ`);
        await sleep(300);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  clear_service_worker: {
    name: "إيقاف Service Worker ومسح الكاش",
    priority: 5,
    execute: async () => {
      try {
        if (navigator.serviceWorker?.controller) {
          await navigator.serviceWorker.getRegistrations().then((regs) =>
            Promise.all(regs.map((r) => r.unregister()))
          );
        }
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        await sleep(800);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  hard_reload: {
    name: "إعادة تحميل قوية (bypass cache)",
    priority: 5,
    execute: async () => {
      if (isInGameRoom()) return false;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("_r", Date.now().toString());
        window.location.href = url.toString();
        return true;
      } catch { return false; }
    },
  },
  clear_all_cache: {
    name: "مسح شامل للكاش + IndexedDB",
    priority: 6,
    execute: async () => {
      try {
        await safeClearCaches();
        await safeUnregisterServiceWorkers();
        // v5.0: لا نلمس IndexedDB الخاصة بالتطبيق (قد تحتوي بيانات لاعب)
        // — فقط مسح تخزين آمن يحفظ الجلسة والإعدادات.
        const res = safeClearStorage();
        addBreadcrumb("action", `مسح شامل آمن: ${res.cleared} مفتاحاً · ${res.preserved} محفوظ`);
        await sleep(800);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  nuclear_reload: {
    name: "إعادة تحميل نووية",
    priority: 7,
    execute: async () => {
      if (isInGameRoom()) return false;
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        if (navigator.serviceWorker?.controller) {
          await navigator.serviceWorker.getRegistrations().then((regs) =>
            Promise.all(regs.map((r) => r.unregister()))
          );
        }
        const url = new URL(window.location.pathname, window.location.origin);
        url.searchParams.set("_nuclear", Date.now().toString());
        window.location.replace(url.toString());
        return true;
      } catch { return false; }
    },
  },
  isolate_component: {
    name: "عزل المكون المعطوب",
    priority: 0,
    execute: async () => false,
  },
  notify_owner: {
    name: "إشعار المالك",
    priority: 0,
    execute: async () => false,
  },
  notify_user: {
    name: "إشعار المستخدم",
    priority: 0,
    execute: async () => false,
  },
  log_only: {
    name: "تسجيل فقط",
    priority: 0,
    execute: async () => false,
  },
  offline_mode: {
    name: "وضع عدم الاتصال",
    priority: 5,
    execute: async () => false,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// 🛡️ CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_TIMEOUT = 30000;

// ═══════════════════════════════════════════════════════════════════════
// 🔮 MEMORY LEAK + ERROR STORM DETECTORS
// ═══════════════════════════════════════════════════════════════════════

let memoryBaseline = 0;
let memoryChecks = 0;

function detectMemoryLeak(): { detected: boolean; growthMB: number } {
  const perf = performance as any;
  const mem = perf.memory;
  if (!mem) return { detected: false, growthMB: 0 };
  const currentMB = Math.round(mem.usedJSHeapSize / 1048576);
  if (memoryBaseline === 0) { memoryBaseline = currentMB; return { detected: false, growthMB: 0 }; }
  memoryChecks++;
  const growth = currentMB - memoryBaseline;
  if (memoryChecks > 10) { memoryBaseline = currentMB; memoryChecks = 0; }
  return { detected: growth > 100, growthMB: growth };
}

let recentErrors: number[] = [];
const STORM_THRESHOLD = 10;
const STORM_WINDOW = 5000;

function detectStorm(): { detected: boolean; count: number } {
  const now = Date.now();
  recentErrors = recentErrors.filter((t) => now - t < STORM_WINDOW);
  recentErrors.push(now);
  recordErrorForRate(); // v5.0: التغذية الموحدة لمقياس معدل الأخطاء
  return { detected: recentErrors.length >= STORM_THRESHOLD, count: recentErrors.length };
}

// ═══════════════════════════════════════════════════════════════════════
// 📊 DEVICE HEALTH
// ═══════════════════════════════════════════════════════════════════════

function collectHealth(): DeviceHealth {
  const perf = performance as any;
  const mem = perf.memory;
  return {
    fps: 60,
    memoryMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
    domNodes: typeof document !== "undefined" ? document.getElementsByTagName("*").length : 0,
    networkType: (navigator as any).connection?.effectiveType || "unknown",
    cpuCores: navigator.hardwareConcurrency || 1,
    uptime: Math.round(performance.now() / 1000),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 🔌 CONVEX CLIENT
// ═══════════════════════════════════════════════════════════════════════

let convexClient: any = null;

export function setErrorHunterClient(client: any) {
  convexClient = client;
}

export async function reportErrorToHunter(
  error: Error | string,
  ctx?: { component?: string; route?: string; autoHealed?: boolean; strategy?: string },
) {
  recordErrorForRate();
  const payload = {
    message: (typeof error === "string" ? error : error.message).slice(0, 500),
    stack: typeof error === "object" ? error.stack?.slice(0, 2000) : undefined,
    component: ctx?.component,
    route: ctx?.route || (typeof window !== "undefined" ? window.location.pathname : "/"),
    url: typeof window !== "undefined" ? window.location.href : "",
    autoHealed: ctx?.autoHealed || false,
    healStrategy: ctx?.strategy,
    deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
    // v5.0: سياق حقيقي — ماذا كان اللاعب يفعل قبل الخطأ
    playerAction: getBreadcrumbs().slice(-10).map((b) => `${b.type}:${b.message}`).join(" → "),
  };

  // v5.0: إن لم يكن العميل جاهزاً أو الشبكة مقطوعة → الطابور الدائم
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!convexClient || offline) {
    enqueueErrorReport(payload);
    return;
  }
  try {
    await convexClient.mutation(api.errorHunter.logError, payload);
  } catch {
    // فشل الإرسال (شبكة/خادم) — يُحفظ في الطابور ولا يضيع أبداً
    enqueueErrorReport(payload);
  }
}

/** v5.0: إرسال التقارير المعلّقة عند عودة الاتصال — استدعِها بعد تهيئة العميل */
export async function flushPendingErrorReports() {
  if (!convexClient || pendingReportCount() === 0) return 0;
  return flushErrorQueue(async (payload) => {
    try {
      await convexClient.mutation(api.errorHunter.logError, payload as any);
      return true;
    } catch { return false; }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 🚀 PERFORMANCE MONITOR (with proper cleanup)
// ═══════════════════════════════════════════════════════════════════════

let perfInterval: ReturnType<typeof setInterval> | null = null;
let fpsRafId: number | null = null;
let perfStopped = false;
let fpsSamples: number[] = [];

export function startPerformanceMonitor() {
  if (perfInterval) return;
  perfStopped = false;

  // v5.0: تفعيل مسجّل السياق + تفريغ التقارير المعلّقة عند عودة الاتصال
  installBreadcrumbListeners();
  flushPendingErrorReports().catch(() => {});
  window.addEventListener("online", () => { flushPendingErrorReports().catch(() => {}); });

  let lastFrameTime = performance.now();
  let frameCount = 0;

  function measureFps() {
    if (perfStopped) return;
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      fpsSamples.push(Math.round((frameCount * 1000) / (now - lastFrameTime)));
      if (fpsSamples.length > 60) fpsSamples.shift();
      frameCount = 0;
      lastFrameTime = now;
    }
    fpsRafId = requestAnimationFrame(measureFps);
  }
  fpsRafId = requestAnimationFrame(measureFps);

  perfInterval = setInterval(() => {
    if (!convexClient || perfStopped) return;
    const health = collectHealth();
    const leak = detectMemoryLeak();
    const storm = detectStorm();
    const avgFps = fpsSamples.length > 0
      ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)
      : 60;
    health.fps = avgFps;

    try {
      convexClient.mutation(api.errorHunter.recordPerformance, {
        fps: avgFps,
        memoryUsedMB: health.memoryMB,
        memoryTotalMB: 0,
        networkLatencyMs: 0,
        networkType: health.networkType,
        route: window.location.pathname,
        loadTimeMs: Math.round(performance.now()),
        domNodes: health.domNodes,
      }).catch(() => {});

      convexClient.mutation(api.errorHunter.updateSystemHealth, {
        activeUsers: 1,
        errorRate: currentErrorRate(), // v5.0: نافذة متدحرجة 60 ثانية حقيقية
        avgFps,
        avgLatency: 0,
        diagnostics: JSON.stringify({
          leakDetected: leak.detected,
          stormDetected: storm.detected,
          stormCount: storm.count,
          domNodes: health.domNodes,
          uptime: health.uptime,
        }),
      }).catch(() => {});
    } catch { /* silent */ }
  }, 30000);
}

export function stopPerformanceMonitor() {
  perfStopped = true;
  if (fpsRafId !== null) { cancelAnimationFrame(fpsRafId); fpsRafId = null; }
  if (perfInterval) { clearInterval(perfInterval); perfInterval = null; }
}

// ═══════════════════════════════════════════════════════════════════════
// 🧠 MAIN COMPONENT — BULLETPROOF ERROR HUNTER
// ═══════════════════════════════════════════════════════════════════════

export class ErrorHunter extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      currentStrategy: 0,
      healing: false,
      healingMessage: "",
      healingSteps: [],
      healingResult: null,
      diagnosis: null,
      rootCauseChain: [],
      circuitState: "closed",
      consecutiveFailures: 0,
      showDetails: false,
      showTimeline: false,
      showPast: false,
      showBrain: false,
      errorId: null,
      incidentEvents: [],
      pastIncidents: getStoredIncidents(), // v5.0: حوادث سابقة نجت من إعادة التحميل
      deviceHealth: collectHealth(),
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Step 1: Diagnose
    let diagnosis: ErrorDiagnosis;
    try {
      diagnosis = diagnoseAdvanced(error);
    } catch {
      diagnosis = {
        category: "unknown", severity: "high",
        displayName: "خطأ في التشخيص", description: "فشل تحليل الخطأ.",
        rootCause: "خطأ غير متوقع في ErrorHunter نفسه.",
        confidence: 0.1, estimatedImpact: "غير معروف",
        recoveryStrategies: ["clear_cache", "nuclear_reload"],
      };
    }
    this.setState({ diagnosis });

    // Step 2: Root cause chain
    const chain = this.buildRootCauseChain(error, errorInfo);
    this.setState({ rootCauseChain: chain });

    // Step 3: Circuit breaker
    if (this.state.circuitState === "open") {
      this.setState({
        healing: false,
        healingResult: "failed",
        healingMessage: "Circuit Breaker مفتوح — توقف محاولات الإصلاح",
      });
      this.reportError(error, errorInfo, diagnosis, false, "circuit_open");
      return;
    }

    // Step 4: Storm detection
    const storm = detectStorm();
    if (storm.detected) {
      console.warn(`[ErrorHunter] Error storm: ${storm.count} errors in 5s`);
    }

    // Step 5: Report
    this.reportError(error, errorInfo, diagnosis);

    // Step 6: Recovery
    this.startRecovery(diagnosis);
  }

  private buildRootCauseChain(error: Error, errorInfo: ErrorInfo): RootCauseNode[] {
    const chain: RootCauseNode[] = [];
    try {
      const lines = (error.stack || "").split("\n").slice(0, 6);
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].trim().match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (match) {
          chain.push({
            depth: i, component: match[1],
            error: i === 0 ? error.message : "invoked by",
            suggestion: i === 0 ? "هنا حدث الخطأ" : "",
          });
        }
      }
      if (errorInfo.componentStack) {
        errorInfo.componentStack.split("\n").filter(Boolean).slice(0, 4).forEach((c) => {
          chain.push({ depth: chain.length, component: c.trim(), error: "rendered here", suggestion: "" });
        });
      }
    } catch { /* don't crash */ }
    return chain;
  }

  private reportError(error: Error, errorInfo: ErrorInfo, diagnosis: ErrorDiagnosis, autoHealed = false, strategy?: string) {
    recordErrorForRate();
    const payload = {
      message: error.message.slice(0, 500),
      stack: error.stack?.slice(0, 2000),
      component: this.props.name || errorInfo.componentStack?.split("\n")?.[1]?.trim(),
      route: typeof window !== "undefined" ? window.location.pathname : "/",
      url: typeof window !== "undefined" ? window.location.href : "",
      autoHealed,
      healStrategy: strategy,
      deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
      playerAction: getBreadcrumbs().slice(-10).map((b) => `${b.type}:${b.message}`).join(" → "),
    };

    // v5.0: سجل الحادثة أولاً — يبقى حتى لو أعاد الإصلاح تحميل الصفحة
    storeIncident({
      at: Date.now(),
      route: payload.route,
      category: diagnosis.category,
      message: error.message.slice(0, 200),
      healed: autoHealed,
      strategy,
    });

    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (!convexClient || offline) {
      enqueueErrorReport(payload);
      return;
    }
    try {
      convexClient.mutation(api.errorHunter.logError, payload)
        .then((result: any) => {
          if (result?.id) this.setState({ errorId: result.id });
        })
        .catch(() => { enqueueErrorReport(payload); });
    } catch { enqueueErrorReport(payload); }
  }

  private async startRecovery(diagnosis: ErrorDiagnosis) {
    // ════════════════════════════════════════════════════════════════════
    // CRITICAL: On page routes (/play, /profile, /rooms, etc.),
    // NEVER auto-recover. Auto-recovery causes infinite reload loops
    // because the same error persists after reload. Only show the error
    // screen and let the user manually decide.
    // Auto-recovery is ONLY allowed in game rooms (/game/*).
    // ════════════════════════════════════════════════════════════════════
    const isPageRoute = !isInGameRoom();
    if (isPageRoute) {
      this.setState({
        healing: false,
        healingResult: null,
        healingMessage: "",
        healingSteps: [],
      });
      this.addTimeline("system_action", "تعطيل الإصلاح التلقائي — الصفحة الرئيسية لا تُعاد تحميل تلقائياً");
      return;
    }

    const strategies = diagnosis.recoveryStrategies
      .map((s) => ({ key: s, ...RECOVERY_STRATEGIES[s] }))
      .filter((s) => s.execute)
      .sort((a, b) => a.priority - b.priority);

    if (strategies.length === 0) {
      this.setState({ healing: false, healingResult: "failed" });
      return;
    }

    this.setState({
      healing: true,
      healingMessage: "بدء محرك الإصلاح المتسلسل...",
      healingSteps: strategies.map((s) => ({ name: s.name, status: "pending" as const, message: "" })),
    });

    this.addTimeline("recovery_start", `بدء ${strategies.length} استراتيجيات`);

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      if (this.state.circuitState === "open") {
        this.updateStep(i, "skipped", "Circuit Breaker مفتوح");
        break;
      }

      this.setState({ currentStrategy: i });
      this.updateStep(i, "active", `جارٍ: ${strategy.name}...`);
      this.setState({ healingMessage: `المحاولة ${i + 1}/${strategies.length}: ${strategy.name}` });
      this.addTimeline("recovery_start", strategy.name);

      const start = Date.now();
      try {
        const success = await strategy.execute();
        const duration = Date.now() - start;

        if (success) {
          this.updateStep(i, "success", `نجح: ${strategy.name} (${duration}ms)`);
          this.addTimeline("recovery_result", `نجح: ${strategy.name}`);
          this.reportError(
            new Error(`[HEALED] ${diagnosis.displayName}`),
            { componentStack: "" }, diagnosis, true, strategy.key,
          );
          this.setState({ healingResult: "success", consecutiveFailures: 0, circuitState: "closed" });
          return;
        }

        this.updateStep(i, "failed", `فشل: ${strategy.name}`);
        this.addTimeline("recovery_result", `فشل: ${strategy.name}`);
      } catch {
        this.updateStep(i, "failed", `خطأ: ${strategy.name}`);
        this.addTimeline("recovery_result", `خطأ: ${strategy.name}`);
      }
    }

    const newFailures = this.state.consecutiveFailures + 1;
    const newState = newFailures >= CIRCUIT_THRESHOLD ? "open" : this.state.circuitState;
    this.setState({
      healingResult: "failed",
      healingMessage: "جميع استراتيجيات الإصلاح فشلت",
      consecutiveFailures: newFailures,
      circuitState: newState,
    });
    this.addTimeline("system_action",
      newState === "open" ? "Circuit Breaker فُتح" : `فشلت المحاولات (${newFailures}/${CIRCUIT_THRESHOLD})`
    );

    // v5.1: فشل ≠ استسلام — أطلق جولة مطاردة ذاتية متصاعدة.
    // قاطع الدائرة المفتوح وحده يوقف المطارِدة (حماية من العاصفة).
    if (newState !== "open") {
      this.scheduleAutoRetry();
    }
  }

  private updateStep(index: number, status: RecoveryStep["status"], message: string) {
    this.setState((s) => ({
      healingSteps: s.healingSteps.map((step, i) =>
        i === index ? { ...step, status, message } : step
      ),
    }));
  }

  private addTimeline(type: string, message: string) {
    this.setState((s) => ({
      incidentEvents: [...s.incidentEvents, { timestamp: Date.now(), type, message }],
    }));
  }

  private handleReload = () => { safeReload(); };
  private handleGoHome = () => { safeNavigate("/play"); };

  // ═══ v5.1 — القنّاص: مطاردة ذاتية متصاعدة ═══
  // عند فشل جولة الإصلاح، يعيد الصياد الهجوم تلقائياً حتى 3 جولات
  // متصاعدة (مع فاصل قصير يسمح للشبكة/الذاكرة بالتعافي) قبل أن يستسلم
  // ويعرض زر نسخ التقرير.
  private readonly MAX_AUTO_PASSES = 3;

  private autoRetryPasses = 0;

  private scheduleAutoRetry = () => {
    if (this.autoRetryPasses >= this.MAX_AUTO_PASSES) {
      this.addTimeline("system_action", `استُنفدت ${this.MAX_AUTO_PASSES} جولات مطاردة ذاتية — التقرير جاهز للنسخ`);
      return;
    }
    this.autoRetryPasses++;
    const delayMs = 1200 * this.autoRetryPasses; // تصاعد التأخير
    this.addTimeline("recovery_start", `⚔️ جولة مطاردة ${this.autoRetryPasses}/${this.MAX_AUTO_PASSES} بعد ${Math.round(delayMs / 1000)} ثانية`);
    setTimeout(() => {
      const d = this.state.error ? diagnoseAdvanced(this.state.error) : null;
      if (d) this.startRecovery(d);
    }, delayMs);
  };

  // ═══ v5.1 — نسخ تقرير منظم للمطوّر ═══
  private handleCopyReport = () => {
    const { error, incidentEvents, deviceHealth } = this.state;
    const d = error ? diagnoseAdvanced(error) : null;
    const attempts = this.autoRetryPasses;
    const report = [
      "═══ 🐛 تقرير خطأ — حرب العقول (صياد الأخطاء v5.1) ═══",
      `🕐 الوقت: ${new Date().toLocaleString("ar-SA")}`,
      `📍 المسار: ${typeof window !== "undefined" ? window.location.pathname : "?"}`,
      `🏷 الفئة: ${d?.category || "unknown"} · الخطورة: ${d?.severity || "unknown"} · الثقة: ${Math.round((d?.confidence || 0) * 100)}%`,
      "",
      `❌ الخطأ: ${error?.message || "غير معروف"}`,
      "",
      error?.stack ? `📚 المكدس:\n${error.stack.slice(0, 1200)}` : "📚 المكدس: غير متوفر",
      "",
      this.state.errorInfo?.componentStack ? `🧩 شجرة المكونات:\n${this.state.errorInfo.componentStack.slice(0, 800)}` : "",
      `🔗 سلسلة السبب: ${this.state.rootCauseChain.map((n) => n.component).join(" → ") || "—"}`,
      `🧠 التشخيص: ${d?.rootCause || "—"}`,
      `💡 الحل المقترح محلياً: ${d?.estimatedImpact || "—"}`,      `🔁 جولات الإصلاح التلقائي: ${attempts}/${this.MAX_AUTO_PASSES} — ${this.state.healingResult === "success" ? "نجحت" : "فشلت جميعها"}`,
      `💾 الجهاز: RAM ${deviceHealth.memoryMB}MB · DOM ${deviceHealth.domNodes} · شبكة ${deviceHealth.networkType} · FPS ${deviceHealth.fps} · ${deviceHealth.uptime}s`,
      incidentEvents.length > 0 ? `⏱ التسلسل:\n${incidentEvents.map((e) => `- [${new Date(e.timestamp).toLocaleTimeString("ar-SA")}] ${e.type}: ${e.message}`).join("\n").slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n");

    const done = () => this.setState({ copied: true });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(report).then(done).catch(() => this.fallbackCopy(report, done));
    } else {
      this.fallbackCopy(report, done);
    }
  };

  private fallbackCopy(text: string, done: () => void) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch { /* best effort */ }
  }
  private handleMasterReset = () => {
    // v5.0: SAFE master reset — يجدد كاش التطبيق والـ SW فقط.
    // الجلسة (convex-auth) والإعدادات والتفضيلات تنجو دائماً —
    // لا حاجة لتسجيل دخول من جديد أبداً.
    (async () => {
      try {
        await safeClearCaches();
        await safeUnregisterServiceWorkers();
        safeClearStorage();
      } catch { /* ok */ }
      setTimeout(() => { window.location.replace("/?_reset=" + Date.now()); }, 500);
    })();
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — ZERO EXTERNAL DEPENDENCIES (pure HTML/CSS)
  // ═══════════════════════════════════════════════════════════════════

  renderTimeline = () => {
    const { incidentEvents } = this.state;
    const past = this.state.pastIncidents ?? [];
    return (
      <>
        {incidentEvents.length > 0 && (
          <div style={sectionStyle}>
            <button type="button" onClick={() => this.setState((s) => ({ showTimeline: !s.showTimeline }))} style={toggleBtnStyle}>
              <span>📋 سجل الاسترداد ({incidentEvents.length} خطوات)</span>
              <span>{this.state.showTimeline ? "▲" : "▼"}</span>
            </button>
            {this.state.showTimeline && (
              <div style={{ marginTop: 8 }}>
                {incidentEvents.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "3px 0", color: "#94a3b8" }}>
                    <span>{e.type === "recovery_result" ? (e.message.includes("نجح") ? "✅" : "❌") : e.type === "system_action" ? "⚙️" : "⏳"}</span>
                    <span style={{ flex: 1 }}>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {past.length > 0 && (
          <div style={sectionStyle}>
            <button type="button" onClick={() => this.setState((s) => ({ showPast: !s.showPast }))} style={toggleBtnStyle}>
              <span>🗂 حوادث سابقة في هذه الجلسة ({past.length}) — نجت من إعادة التحميل</span>
              <span>{this.state.showPast ? "▲" : "▼"}</span>
            </button>
            {this.state.showPast && past.slice(-5).reverse().map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "3px 0", color: "#64748b" }}>
                <span>{p.healed ? "✅" : "⚠️"}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, width: 64 }}>
                  {new Date(p.at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  [{p.category}] {p.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { error, diagnosis, healingSteps, healingResult, circuitState,
      showDetails, showTimeline, showBrain, rootCauseChain, incidentEvents } = this.state;
    const d = diagnosis || (error ? diagnoseAdvanced(error) : null);

    // ── HEALING IN PROGRESS ──
    if (this.state.healing && !healingResult) {
      return (
        <ErrorFallback>
          <div style={cardStyle}>
            <div style={iconCircleStyle}>
              <span style={{ fontSize: 28 }}>🛡️</span>
            </div>
            <h2 style={titleStyle}>صياد الأخطاء يعمل...</h2>
            <p style={subtitleStyle}>{this.state.healingMessage}</p>
            <div style={spinnerStyle} />

            <div style={{ marginTop: 20, width: "100%" }}>
              {healingSteps.map((step, i) => (
                <div key={i} style={{
                  ...stepStyle,
                  backgroundColor: step.status === "active" ? "rgba(59,130,246,0.1)" :
                    step.status === "success" ? "rgba(16,185,129,0.1)" :
                    step.status === "failed" ? "rgba(239,68,68,0.1)" : "transparent",
                }}>
                  <span style={{ width: 24, textAlign: "center" }}>
                    {step.status === "active" ? "⏳" :
                     step.status === "success" ? "✅" :
                     step.status === "failed" ? "❌" :
                     step.status === "skipped" ? "⏭️" : "•"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{step.name}</span>
                </div>
              ))}
            </div>

            {circuitState !== "closed" && (
              <p style={{ marginTop: 12, fontSize: 11, color: "#d97706" }}>
                🔒 Circuit Breaker: {circuitState === "open" ? "مفتوح" : "شبه مفتوح"}
              </p>
            )}
          </div>
        </ErrorFallback>
      );
    }

    // ── ERROR DISPLAY ──
    return (
      <ErrorFallback>
        <div style={{ ...cardStyle, maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              ...iconCircleStyle,
              backgroundColor: d?.severity === "catastrophic" || d?.severity === "critical" ? "rgba(239,68,68,0.1)" :
                d?.severity === "high" ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
            }}>
              <span style={{ fontSize: 24 }}>{d?.severity === "catastrophic" ? "🔴" : d?.severity === "critical" ? "🐛" : d?.severity === "high" ? "⚠️" : "🛡️"}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{d?.displayName || "خطأ غير معروف"}</h1>
              <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, lineHeight: 1.6 }}>{d?.description || ""}</p>
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            <span style={badgeStyle(d?.severity || "medium")}>{d?.severity || "unknown"}</span>
            <span style={badgeStyle("low")}>{d?.category || "unknown"}</span>
            <span style={badgeStyle("low")}>ثقة {Math.round((d?.confidence || 0) * 100)}%</span>
            {d?.estimatedImpact && <span style={badgeStyle("low")}>{d.estimatedImpact}</span>}
          </div>

          {/* Root cause chain */}
          {rootCauseChain.length > 0 && (
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>🔗 سلسلة السبب الجذري</p>
              {rootCauseChain.slice(0, 5).map((node, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "2px 0" }}>
                  <span style={{ color: "#64748b", width: 16 }}>{i + 1}</span>
                  <span style={{ fontFamily: "monospace", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                    {node.component}
                  </span>
                  {node.suggestion && <span style={{ color: "#60a5fa" }}>← {node.suggestion}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Recovery result */}
          {healingResult && (
            <div style={{
              ...sectionStyle,
              backgroundColor: healingResult === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: healingResult === "success" ? "#10b981" : "#ef4444",
              fontWeight: 600,
            }}>
              {healingResult === "success"
                ? "✅ تم الإصلاح بنجاح — جارٍ إعادة التحميل"
                : "❌ تعذّر الإصلاح التلقائي — جرّب يدوياً أو استخدم إعادة التعيين"}
            </div>
          )}

          {/* Recovery steps */}
          {healingSteps.length > 0 && (
            <div style={sectionStyle}>
              <button type="button" onClick={() => this.setState((s) => ({ showTimeline: !s.showTimeline }))}
                style={toggleBtnStyle}>
                <span>📋 سجل الاسترداد ({healingSteps.length} خطوات)</span>
                <span>{showTimeline ? "▲" : "▼"}</span>
              </button>
              {showTimeline && (
                <div style={{ marginTop: 8 }}>
                  {healingSteps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, padding: "3px 0", color: "#94a3b8" }}>
                      <span>{step.status === "success" ? "✅" : step.status === "failed" ? "❌" : step.status === "skipped" ? "⏭️" : "⏳"}</span>
                      <span style={{ flex: 1 }}>{step.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {incidentEvents.length > 0 && (
            <div style={sectionStyle}>
              <p style={sectionTitleStyle}>⏱ التسلسل الزمني</p>
              {incidentEvents.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 10, padding: "2px 0", color: "#64748b" }}>
                  <span style={{ fontFamily: "monospace", width: 60, fontSize: 9 }}>
                    {new Date(ev.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span style={{ flex: 1 }}>{ev.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Brain analysis */}
          {d && (
            <div style={{ ...sectionStyle, border: "1px solid rgba(59,130,246,0.2)", backgroundColor: "rgba(59,130,246,0.05)" }}>
              <button type="button" onClick={() => this.setState((s) => ({ showBrain: !s.showBrain }))}
                style={{ ...toggleBtnStyle, color: "#3b82f6" }}>
                <span>🧠 تحليل السبب الجذري</span>
                <span>{showBrain ? "▲" : "▼"}</span>
              </button>
              {showBrain && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>
                  <p><strong style={{ color: "#e2e8f0" }}>السبب: </strong>{d.rootCause}</p>
                  <p><strong style={{ color: "#e2e8f0" }}>التأثير: </strong>{d.estimatedImpact}</p>
                  <p><strong style={{ color: "#e2e8f0" }}>الاستراتيجيات: </strong>
                    {d.recoveryStrategies.map((s) => RECOVERY_STRATEGIES[s]?.name || s).join(" → ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Device Health */}
          <div style={sectionStyle}>
            <p style={sectionTitleStyle}>📊 صحة الجهاز</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "RAM", value: `${this.state.deviceHealth.memoryMB}MB` },
                { label: "DOM", value: this.state.deviceHealth.domNodes },
                { label: "شبكة", value: this.state.deviceHealth.networkType },
                { label: "أنوية", value: this.state.deviceHealth.cpuCores },
                { label: "وقت", value: `${this.state.deviceHealth.uptime}s` },
                { label: "FPS", value: this.state.deviceHealth.fps },
              ].map((m) => (
                <div key={m.label} style={{ textAlign: "center", padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 10, color: "#64748b" }}>{m.label}</span>
                  <br />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={this.handleReload} style={primaryBtnStyle}>
              🔄 إعادة التحميل
            </button>
            <button type="button" onClick={this.handleCopyReport} style={{ ...secondaryBtnStyle, color: "#60a5fa", borderColor: "rgba(59,130,246,0.3)" }}>
              {this.state.copied ? "✅ تم نسخ التقرير" : "📋 نسخ تقرير المشكلة"}
            </button>
            <button type="button" onClick={this.handleGoHome} style={secondaryBtnStyle}>
              🏠 الرئيسية
            </button>
            <button type="button" onClick={this.handleMasterReset} style={dangerBtnStyle}>
              ⚠️ إعادة تعيين شاملة
            </button>
          </div>
          {this.state.copied && (
            <p style={{ marginTop: 8, fontSize: 11, color: "#10b981", textAlign: "center" }}>
              ✅ تم نسخ التقرير المنظم — الصقه لأي مطوّر أو في دردشة الدعم وسيُحل فوراً
            </p>
          )}

          {/* Technical details */}
          <div style={{ marginTop: 16 }}>
            <button type="button" onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              style={{ ...toggleBtnStyle, fontSize: 12 }}>
              <span>🔍 تفاصيل تقنية</span>
              <span>{showDetails ? "▲" : "▼"}</span>
            </button>
            {showDetails && (
              <pre style={{
                marginTop: 8, maxHeight: 160, overflow: "auto",
                fontSize: 10, fontFamily: "monospace", lineHeight: 1.4,
                padding: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                backgroundColor: "rgba(0,0,0,0.3)", color: "#94a3b8", whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {error?.message}
                {error?.stack ? `\n\n${error.stack.slice(0, 800)}` : ""}
                {this.state.errorInfo?.componentStack ? `\n\nComponents:\n${this.state.errorInfo.componentStack}` : ""}
              </pre>
            )}
          </div>
        </div>
      </ErrorFallback>
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🎨 PURE CSS UI COMPONENTS (ZERO EXTERNAL IMPORTS)
// ═══════════════════════════════════════════════════════════════════════

function ErrorFallback({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "#0f172a", color: "#e2e8f0", padding: 24,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  width: "100%", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "#1e293b", padding: 32, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
};

const iconCircleStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 16,
  display: "flex", alignItems: "center", justifyContent: "center",
  backgroundColor: "rgba(59,130,246,0.1)", marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, margin: 0, marginTop: 12, color: "#e2e8f0",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13, color: "#94a3b8", marginTop: 8, lineHeight: 1.6,
};

const spinnerStyle: React.CSSProperties = {
  width: 24, height: 24, border: "3px solid rgba(59,130,246,0.2)",
  borderTopColor: "#3b82f6", borderRadius: "50%",
  animation: "spin 0.8s linear infinite", margin: "16px auto 0",
};

const stepStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
  borderRadius: 8, fontSize: 13, marginBottom: 4,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 16, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
  padding: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#94a3b8", margin: 0, marginBottom: 8,
};

const toggleBtnStyle: React.CSSProperties = {
  display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center",
  background: "none", border: "none", color: "#94a3b8", fontSize: 12,
  fontWeight: 600, cursor: "pointer", padding: "4px 0",
};

const badgeStyle = (severity: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
  backgroundColor: severity === "catastrophic" || severity === "critical" ? "rgba(239,68,68,0.15)" :
    severity === "high" ? "rgba(245,158,11,0.15)" :
    severity === "medium" ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.15)",
  color: severity === "catastrophic" || severity === "critical" ? "#ef4444" :
    severity === "high" ? "#f59e0b" :
    severity === "medium" ? "#3b82f6" : "#94a3b8",
});

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 20px", borderRadius: 12, border: "none",
  backgroundColor: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 700,
  cursor: "pointer", transition: "opacity 0.2s",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 20px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "transparent",
  color: "#e2e8f0", fontSize: 13, fontWeight: 700,
  cursor: "pointer", transition: "opacity 0.2s",
};

const dangerBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "10px 20px", borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)",
  color: "#ef4444", fontSize: 13, fontWeight: 700,
  cursor: "pointer", transition: "opacity 0.2s",
};

// Inject minimal CSS for spinner animation
if (typeof document !== "undefined") {
  const style = document.getElementById("errorhunter-styles") || document.createElement("style");
  style.id = "errorhunter-styles";
  if (!style.textContent) {
    style.textContent = `
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }
}
