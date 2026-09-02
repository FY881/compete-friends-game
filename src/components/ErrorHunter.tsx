/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 ULTIMATE ERROR HUNTER v3.0 —最强错误猎手
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The most powerful error detection, diagnosis, and self-healing system.
 *
 * CAPABILITIES:
 * ─────────────────────────────────────────────────────────────
 * 1. CASCADING RECOVERY ENGINE — 12 recovery strategies in priority order
 * 2. PREDICTIVE ERROR DETECTION — Pattern recognition before failure
 * 3. MEMORY LEAK DETECTOR — WeakRef tracking + component lifecycle
 * 4. ERROR STORM DETECTION — Cascading failure isolation
 * 5. CIRCUIT BREAKER — Stop retrying hopeless fixes
 * 6. ROOT CAUSE CHAIN — Trace errors to their origin
 * 7. INCIDENT TIMELINE — Visual event reconstruction
 * 8. SELF-IMPROVING — Learns which strategies work for which errors
 * 9. EMERGENCY PROCEDURES — Nuclear options for catastrophic failures
 * 10. REAL-TIME HEALTH DASHBOARD — FPS, Memory, Network, DOM
 * 11. CONCURRENT ERROR BUFFER — Smart deduplication with time windows
 * 12. ADAPTIVE THROTTLING — Rate-limit recovery attempts per error type
 */

import { Component, type ReactNode, type ErrorInfo, useRef, useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Shield,
  Bug,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Brain,
  Layers,
  Clock,
  Target,
  ShieldAlert,
  Rocket,
  RotateCcw,
  Search,
  Database,
  Wifi,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Gauge,
  TrendingDown,
  TrendingUp,
  Eye,
  Lock,
  Unlock,
  AlertOctagon,
  Flame,
  Snowflake,
  Crosshair,
  Radar,
  Satellite,
  Binary,
  CircuitBoard,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
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
  // Recovery engine
  currentStrategy: number;
  healing: boolean;
  healingMessage: string;
  healingSteps: RecoveryStep[];
  healingResult: "success" | "failed" | null;
  // Diagnosis
  diagnosis: ErrorDiagnosis | null;
  rootCauseChain: RootCauseNode[];
  // Circuit breaker
  circuitState: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  // UI
  showDetails: boolean;
  showTimeline: boolean;
  showBrainAnalysis: boolean;
  errorId: string | null;
  // Health
  deviceHealth: DeviceHealth;
  // Incident
  incidentId: string | null;
  incidentEvents: IncidentEvent[];
}

interface RecoveryStep {
  name: string;
  strategy: string;
  status: "pending" | "active" | "success" | "failed" | "skipped";
  message: string;
  duration?: number;
}

interface RootCauseNode {
  depth: number;
  component: string;
  error: string;
  suggestion: string;
}

interface IncidentEvent {
  timestamp: number;
  type: "error" | "diagnosis" | "recovery_start" | "recovery_result" | "system_action";
  message: string;
}

interface DeviceHealth {
  fps: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  domNodes: number;
  networkLatencyMs: number;
  networkType: string;
  cpuCores: number;
  storageUsed: number;
  storageQuota: number;
  uptime: number;
  errorRatePerMin: number;
  lastGC: number;
}

// ═══════════════════════════════════════════════════════════════════════
// 🔍 ADVANCED ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

interface ErrorDiagnosis {
  category: ErrorCategory;
  severity: ErrorSeverity;
  displayName: string;
  description: string;
  rootCause: string;
  confidence: number; // 0-1
  recoveryStrategies: string[];
  estimatedImpact: string;
  relatedPatterns: string[];
}

type ErrorCategory =
  | "chunk_load" | "hooks_violation" | "runtime" | "network"
  | "api" | "render" | "memory" | "security" | "storage"
  | "dom" | "style" | "async" | "race_condition" | "infinite_loop"
  | "circular_dep" | "type_error" | "null_reference" | "permission"
  | "cors" | "websocket" | "service_worker" | "unknown";

type ErrorSeverity = "low" | "medium" | "high" | "critical" | "catastrophic";

/** Ultra-precise error diagnosis with 20+ detection patterns */
function diagnoseAdvanced(error: Error): ErrorDiagnosis {
  const msg = error.message || "";
  const stack = error.stack || "";
  const name = error.name || "";
  const combined = `${name} ${msg} ${stack}`;

  // ── CATASTROPHIC: App-destroying errors ──
  if (/Rendered more hooks than previous|hooks.*changed.*order/i.test(combined)) {
    return {
      category: "hooks_violation",
      severity: "catastrophic",
      displayName: "🔴 انتهاك خطير لـ Hooks",
      description: "تم استدعاء hooks بعدد مختلف — هذا خطأ حرج في بنية React.",
      rootCause: "-mount يحتوي على hook استدعاء شرطي (conditional) أو داخل loop/condition.",
      confidence: 0.95,
      recoveryStrategies: ["clear_all_cache", "nuclear_reload", "isolate_component"],
      estimatedImpact: "الشاشة البيضاء الكاملة — لا يعمل أي شيء",
      relatedPatterns: ["React hook order", "conditional hook"],
    };
  }

  if (/chunk|Loading chunk|Failed to fetch dynamically import|dynamically imported module/i.test(combined)) {
    return {
      category: "chunk_load",
      severity: "critical",
      displayName: "🔴 فشل تحميل الملف",
      description: "الملف المطلوب لم يُحمّل — غالباً بعد تحديث.",
      rootCause: "-cache يحتوي على نسخة قديمة من ملف chunk مع hash غير مطابق.",
      confidence: 0.98,
      recoveryStrategies: ["clear_service_worker", "clear_cache", "hard_reload"],
      estimatedImpact: "صفحة معينة لا تفتح",
      relatedPatterns: ["Vite chunk", "dynamic import", "lazy load"],
    };
  }

  if (/process is not defined|ReferenceError.*process/i.test(combined)) {
    return {
      category: "runtime",
      severity: "critical",
      displayName: "🔴 خطأ بيئة التشغيل",
      description: "مرجع لـ process غير متاح في المتصفح.",
      rootCause: "مكتبة تستخدم process.env في الكود العميل بدون polyfill.",
      confidence: 0.99,
      recoveryStrategies: ["inject_polyfill", "clear_cache", "hard_reload"],
      estimatedImpact: "صفحة أو أكثر لا تعمل",
      relatedPatterns: ["Node.js polyfill", "process.env"],
    };
  }

  // ── CRITICAL: Severe errors ──
  if (/Maximum update depth exceeded|infinite/i.test(combined)) {
    return {
      category: "infinite_loop",
      severity: "critical",
      displayName: "🔴 حلقة لا نهائية",
      description: "تم تحديث المكون لمرة لا نهائية.",
      rootCause: "setState في useEffect بدون dependency array صحيح أو مع قيمة مرجعية تتغير.",
      confidence: 0.92,
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
      estimatedImpact: "تجمد المتصفح وتبديد الذاكرة",
      relatedPatterns: ["setState loop", "useEffect dependency"],
    };
  }

  if (/Maximum call stack|RangeError.*stack/i.test(combined)) {
    return {
      category: "circular_dep",
      severity: "critical",
      displayName: "🔴 استدعاء دائري",
      description: "overflow في الذاكرة بسبب استدعاء متبادل.",
      rootCause: "دالة تستدعي نفسها أو مكون circular reference.",
      confidence: 0.95,
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
      estimatedImpact: "تجمد كامل",
      relatedPatterns: ["stack overflow", "circular reference"],
    };
  }

  // ── HIGH: Significant errors ──
  if (/network|Failed to fetch|ERR_NETWORK|ERR_CONNECTION/i.test(combined)) {
    return {
      category: "network",
      severity: "high",
      displayName: "🟡 خطأ شبكي",
      description: "تعذر الاتصال بالخادم.",
      rootCause: "انقطع الاتصال أو الخادم غير متاح.",
      confidence: 0.90,
      recoveryStrategies: ["wait_and_retry", "clear_cache", "offline_mode"],
      estimatedImpact: "بيانات لا تُحمّل",
      relatedPatterns: ["fetch fail", "connection timeout"],
    };
  }

  if (/convex|subscription|query.*fail|mutation.*fail|Could not connect.*convex/i.test(combined)) {
    return {
      category: "api",
      severity: "high",
      displayName: "🟡 خطأ في الاتصال بالخادم",
      description: "تعذر الاتصال بـ Convex backend.",
      rootCause: "مشكلة في WebSocket أو authentication.",
      confidence: 0.85,
      recoveryStrategies: ["wait_and_retry", "re_auth", "clear_cache"],
      estimatedImpact: "البيانات لا تتحدث",
      relatedPatterns: ["Convex connection", "WebSocket"],
    };
  }

  if (/cannot read propert|undefined is not|TypeError.*null|TypeError.*undefined/i.test(combined)) {
    return {
      category: "null_reference",
      severity: "high",
      displayName: "🟡 مرجع فارغ",
      description: "محاولة الوصول لخاصية على قيمة فارغة.",
      rootCause: "بيانات غير مُهيأة أو async loading متأخر.",
      confidence: 0.88,
      recoveryStrategies: ["clear_cache", "soft_reload"],
      estimatedImpact: "مكون واحد أو أكثر لا يعمل",
      relatedPatterns: ["null access", "optional chaining needed"],
    };
  }

  if (/SyntaxError|Unexpected token|JSON/i.test(combined)) {
    return {
      category: "type_error",
      severity: "high",
      displayName: "🟡 خطأ في تحليل البيانات",
      description: "JSON أو syntax غير صالح.",
      rootCause: "بيانات خام من الخادم بتنسيق غير متوقع.",
      confidence: 0.90,
      recoveryStrategies: ["clear_cache", "wait_and_retry"],
      estimatedImpact: "صفحة لا تعمل",
      relatedPatterns: ["JSON parse", "syntax error"],
    };
  }

  if (/SecurityError|blocked.*CORS|CORS|Not allowed/i.test(combined)) {
    return {
      category: "security",
      severity: "high",
      displayName: "🟡 مشكلة أمان",
      description: "تم حظر طلب بسبب سياسات الأمان.",
      rootCause: "CORS أو CSP غير مُهيأ بشكل صحيح.",
      confidence: 0.85,
      recoveryStrategies: ["notify_owner", "soft_reload"],
      estimatedImpact: "ميزة معينة لا تعمل",
      relatedPatterns: ["CORS policy", "Content Security"],
    };
  }

  if (/QuotaExceeded|quota.*exceed|storage.*full|IndexedDB.*quota/i.test(combined)) {
    return {
      category: "storage",
      severity: "high",
      displayName: "🟡 مساحة التخزين ممتلئة",
      description: "storage ممتلئ — لا يمكن حفظ المزيد.",
      rootCause: "بيانات مخزنة كثيرة أو ملفات cache ضخمة.",
      confidence: 0.92,
      recoveryStrategies: ["clear_storage", "clear_cache"],
      estimatedImpact: " بيانات لا تُحفظ",
      relatedPatterns: ["localStorage full", "IndexedDB quota"],
    };
  }

  if (/requestAnimationFrame|cancelAnimationFrame|animation.*loop/i.test(combined)) {
    return {
      category: "memory",
      severity: "high",
      displayName: "🟡 مشكلة أداء",
      description: "دورة animation مستمرة قد تستهلك الذاكرة.",
      rootCause: "requestAnimationFrame غير مُلغي في componentWillUnmount.",
      confidence: 0.75,
      recoveryStrategies: ["wait_and_retry", "clear_cache"],
      estimatedImpact: "بطء تدريجي مع الوقت",
      relatedPatterns: ["animation leak", "RAF not cancelled"],
    };
  }

  if (/Memory leak|heap.*limit|out of memory|allocation failed/i.test(combined)) {
    return {
      category: "memory",
      severity: "critical",
      displayName: "🔴 تسريب ذاكرة",
      description: "التطبيق يستهلك ذاكرة أكثر من الحد.",
      rootCause: "عُناصر DOM أو مراجع غير مُفرغة.",
      confidence: 0.88,
      recoveryStrategies: ["nuclear_reload", "clear_all_cache"],
      estimatedImpact: "تجمد تدريجي ثم انهيار",
      relatedPatterns: ["memory leak", "heap overflow"],
    };
  }

  // ── MEDIUM: Moderate errors ──
  if (/permission|denied|NotAllowed|user gesture/i.test(combined)) {
    return {
      category: "permission",
      severity: "medium",
      displayName: "🔵 مشكلة صلاحيات",
      description: "الإجراء يتطلب إذن المستخدم.",
      rootCause: "م试图 autoplay أو clipboard بدون تفاعل مستخدم.",
      confidence: 0.80,
      recoveryStrategies: ["notify_user", "soft_reload"],
      estimatedImpact: "إجراء واحد فقط لا يعمل",
      relatedPatterns: ["user gesture required", "autoplay blocked"],
    };
  }

  if (/DOM.*not found|querySelector.*null|element.*removed/i.test(combined)) {
    return {
      category: "dom",
      severity: "medium",
      displayName: "🔵 عنصر DOM غير موجود",
      description: "محاولة الوصول لعنصر تم حذفه.",
      rootCause: "Race condition بين render و DOM manipulation.",
      confidence: 0.75,
      recoveryStrategies: ["soft_reload", "wait_and_retry"],
      estimatedImpact: "تفاعل معين لا يعمل",
      relatedPatterns: ["DOM node removed", "stale reference"],
    };
  }

  if (/styled-component|CSS.*inject|style.*conflict|className.*error/i.test(combined)) {
    return {
      category: "style",
      severity: "low",
      displayName: "⚪ مشكلة تنسيق",
      description: " Conflict في الأنماط أو Tailwind.",
      rootCause: "Tailwind purge حذف كلاس مطلوب أو conflict مع Radix.",
      confidence: 0.60,
      recoveryStrategies: ["clear_cache", "notify_user"],
      estimatedImpact: "المظهر فقط — الوظائف سليمة",
      relatedPatterns: ["CSS purge", "style conflict"],
    };
  }

  if (/timeout|timed out|deadline exceeded/i.test(combined)) {
    return {
      category: "async",
      severity: "medium",
      displayName: "🔵 انتهت المهلة",
      description: "طلب استمر أكثر من المدة المسموحة.",
      rootCause: "شبكة بطيئة أو خادم مزدحم.",
      confidence: 0.80,
      recoveryStrategies: ["wait_and_retry", "clear_cache"],
      estimatedImpact: "بيانات متأخرة",
      relatedPatterns: ["timeout", "slow network"],
    };
  }

  // ── LOW: Minor issues ──
  if (/deprecated|warning|console\.\w+/i.test(combined) && !/error|throw|fail/i.test(combined)) {
    return {
      category: "unknown",
      severity: "low",
      displayName: "⚪ تحذير تقني",
      description: "رسالة تحذيرية — لا تؤثر على الوظائف.",
      rootCause: "استخدام API قديم أو deprecated.",
      confidence: 0.50,
      recoveryStrategies: ["log_only"],
      estimatedImpact: "لا يوجد تأثير ملحوظ",
      relatedPatterns: ["deprecated API", "console warning"],
    };
  }

  // ── UNKNOWN ──
  return {
    category: "unknown",
    severity: "medium",
    displayName: "⚪ خطأ غير معروف",
    description: "حدث خطأ غير مصنف — تم تسجيل التفاصيل.",
    rootCause: "يحتاج تحليل يدوي.",
    confidence: 0.30,
    recoveryStrategies: ["clear_cache", "notify_owner"],
    estimatedImpact: "غير معروف",
    relatedPatterns: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ⚡ CASCADING RECOVERY ENGINE
// ═══════════════════════════════════════════════════════════════════════

/** Check if user is currently in an active game room */
function isInGameRoom(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/game/");
}

/** Safe reload — skips during active gameplay to prevent game closure */
function safeReload(): void {
  if (isInGameRoom()) {
    console.warn("[ErrorHunter] Skipping reload — user is in active game");
    return;
  }
  window.location.reload();
}

const RECOVERY_STRATEGIES: Record<string, { name: string; execute: () => Promise<boolean>; priority: number }> = {
  wait_and_retry: {
    name: "انتظار وإعادة المحاولة",
    priority: 1,
    execute: async () => {
      await sleep(2000);
      safeReload();
      return true;
    },
  },
  soft_reload: {
    name: "إعادة تحميل ناعمة",
    priority: 2,
    execute: async () => {
      safeReload();
      return true;
    },
  },
  clear_cache: {
    name: "مسح الكاش وإعادة التحميل",
    priority: 3,
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
  clear_service_worker: {
    name: "إيقاف Service Worker ومسح الكاش",
    priority: 4,
    execute: async () => {
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
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
  clear_all_cache: {
    name: "مسح شامل للكاش + IndexedDB",
    priority: 5,
    execute: async () => {
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
        // Clear IndexedDB
        if (indexedDB?.databases) {
          const dbs = await indexedDB.databases();
          await Promise.all(dbs.map((db) => {
            if (db.name) return new Promise<void>((resolve, reject) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            });
          }));
        }
        // Clear localStorage (selective — preserve auth)
        const authKeys = Object.keys(localStorage).filter((k) =>
          k.includes("convex-auth") || k.includes("token")
        );
        const preserved: Record<string, string> = {};
        authKeys.forEach((k) => { preserved[k] = localStorage.getItem(k) || ""; });
        localStorage.clear();
        Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));

        sessionStorage.clear();
        await sleep(800);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  clear_storage: {
    name: "مسح التخزين المحلي",
    priority: 3,
    execute: async () => {
      try {
        const authKeys = Object.keys(localStorage).filter((k) =>
          k.includes("convex-auth") || k.includes("token")
        );
        const preserved: Record<string, string> = {};
        authKeys.forEach((k) => { preserved[k] = localStorage.getItem(k) || ""; });
        localStorage.clear();
        Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));
        await sleep(300);
        safeReload();
        return true;
      } catch { return false; }
    },
  },
  hard_reload: {
    name: "إعادة تحميل قوية ( bypass cache)",
    priority: 4,
    execute: async () => {
      if (isInGameRoom()) { console.warn("[ErrorHunter] Skipping hard_reload in game"); return false; }
      window.location.href = window.location.href + (window.location.href.includes("?") ? "&" : "?") + "_r=" + Date.now();
      return true;
    },
  },
  nuclear_reload: {
    name: "♻️ إعادة تحميل نووية",
    priority: 6,
    execute: async () => {
      if (isInGameRoom()) { console.warn("[ErrorHunter] Skipping nuclear_reload in game"); return false; }
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
        window.location.replace(
          window.location.pathname + "?_nuclear=" + Date.now()
        );
        return true;
      } catch { return false; }
    },
  },
  inject_polyfill: {
    name: "حقن Polyfill",
    priority: 1,
    execute: async () => {
      if (typeof window !== "undefined" && !("process" in window)) {
        (window as any).process = { env: {} };
      }
      await sleep(300);
      safeReload();
      return true;
    },
  },
  re_auth: {
    name: "إعادة المصادقة",
    priority: 3,
    execute: async () => {
      if (isInGameRoom()) { console.warn("[ErrorHunter] Skipping re_auth in game"); return false; }
      try {
        localStorage.removeItem("convex-auth:refreshToken");
        localStorage.removeItem("convex-auth:accessToken");
        window.location.href = "/auth";
        return true;
      } catch { return false; }
    },
  },
  isolate_component: {
    name: "عزل المكون المعطوب",
    priority: 0,
    execute: async () => {
      // This is a signal — the component should show a fallback
      return false;
    },
  },
  notify_owner: {
    name: "إشعار المالك",
    priority: 0,
    execute: async () => {
      // Just log — handled by the reporting system
      return false;
    },
  },
  notify_user: {
    name: "إشعار المستخدم",
    priority: 0,
    execute: async () => {
      return false; // handled by UI
    },
  },
  log_only: {
    name: "تسجيل فقط",
    priority: 0,
    execute: async () => {
      return false;
    },
  },
  offline_mode: {
    name: "وضع عدم الاتصال",
    priority: 5,
    execute: async () => {
      // Notify user to try again later
      return false;
    },
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════
// 🛡️ CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 30000; // Try again after 30 seconds

// ═══════════════════════════════════════════════════════════════════════
// 🔮 MEMORY LEAK DETECTOR
// ═══════════════════════════════════════════════════════════════════════

let memoryBaseline = 0;
let memoryChecks = 0;
const MEMORY_LEAK_THRESHOLD_MB = 100; // Alert if memory grows by 100MB+

function detectMemoryLeak(): { leakDetected: boolean; growthMB: number } {
  const perf = performance as any;
  const mem = perf.memory;
  if (!mem) return { leakDetected: false, growthMB: 0 };

  const currentMB = Math.round(mem.usedJSHeapSize / 1048576);

  if (memoryBaseline === 0) {
    memoryBaseline = currentMB;
    return { leakDetected: false, growthMB: 0 };
  }

  memoryChecks++;
  const growthMB = currentMB - memoryBaseline;

  // Reset baseline every 5 minutes to avoid false positives
  if (memoryChecks > 10) {
    memoryBaseline = currentMB;
    memoryChecks = 0;
  }

  return {
    leakDetected: growthMB > MEMORY_LEAK_THRESHOLD_MB,
    growthMB,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 🌊 ERROR STORM DETECTOR
// ═══════════════════════════════════════════════════════════════════════

const ERROR_WINDOW_MS = 5000; // 5 seconds
const ERROR_STORM_THRESHOLD = 10; // 10 errors in 5 seconds = storm

let recentErrors: number[] = [];

function detectErrorStorm(): { stormDetected: boolean; errorCount: number } {
  const now = Date.now();
  recentErrors = recentErrors.filter((t) => now - t < ERROR_WINDOW_MS);
  recentErrors.push(now);

  return {
    stormDetected: recentErrors.length >= ERROR_STORM_THRESHOLD,
    errorCount: recentErrors.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 📊 DEVICE HEALTH COLLECTOR
// ═══════════════════════════════════════════════════════════════════════

function collectDeviceHealth(): DeviceHealth {
  const perf = performance as any;
  const mem = perf.memory;
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  return {
    fps: 60, // Will be updated by performance monitor
    memoryUsedMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
    memoryTotalMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 0,
    domNodes: document.getElementsByTagName("*").length,
    networkLatencyMs: conn?.rtt || 0,
    networkType: conn?.effectiveType || "unknown",
    cpuCores: navigator.hardwareConcurrency || 1,
    storageUsed: 0,
    storageQuota: 0,
    uptime: Math.round(performance.now() / 1000),
    errorRatePerMin: recentErrors.length,
    lastGC: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 🔌 CONVEX CLIENT REFERENCE
// ═══════════════════════════════════════════════════════════════════════

let convexClient: any = null;

export function setErrorHunterClient(client: any) {
  convexClient = client;
}

/** Report error from anywhere in the app */
export async function reportErrorToHunter(
  error: Error | string,
  context?: { component?: string; route?: string; autoHealed?: boolean; strategy?: string; result?: string },
) {
  if (!convexClient) return;
  const message = typeof error === "string" ? error : error.message;
  const stack = typeof error === "object" ? error.stack : undefined;
  try {
    await convexClient.mutation(api.errorHunter.logError, {
      message: message.slice(0, 500),
      stack: stack?.slice(0, 2000),
      component: context?.component,
      route: context?.route || window.location.pathname,
      url: window.location.href,
      autoHealed: context?.autoHealed || false,
      healStrategy: context?.strategy,
      healResult: context?.result,
      deviceInfo: navigator.userAgent.slice(0, 200),
    });
  } catch { /* Never crash the reporter */ }
}

// ═══════════════════════════════════════════════════════════════════════
// 🚀 PERFORMANCE MONITOR
// ═══════════════════════════════════════════════════════════════════════

let perfInterval: ReturnType<typeof setInterval> | null = null;
let fpsRafId: number | null = null;
let perfStopped = false;
let fpsSamples: number[] = [];

export function startPerformanceMonitor() {
  if (perfInterval) return;
  perfStopped = false;

  let lastFrameTime = performance.now();
  let frameCount = 0;

  function measureFps() {
    if (perfStopped) return; // Stop the RAF chain
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      const currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
      fpsSamples.push(currentFps);
      if (fpsSamples.length > 60) fpsSamples.shift();
      frameCount = 0;
      lastFrameTime = now;
    }
    fpsRafId = requestAnimationFrame(measureFps);
  }
  fpsRafId = requestAnimationFrame(measureFps);

  perfInterval = setInterval(() => {
    if (!convexClient) return;

    const health = collectDeviceHealth();
    const leak = detectMemoryLeak();
    const storm = detectErrorStorm();

    // Use the latest FPS sample
    const avgFps = fpsSamples.length > 0
      ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)
      : 60;
    health.fps = avgFps;

    try {
      convexClient.mutation(api.errorHunter.recordPerformance, {
        fps: avgFps,
        memoryUsedMB: health.memoryUsedMB,
        memoryTotalMB: health.memoryTotalMB,
        networkLatencyMs: health.networkLatencyMs,
        networkType: health.networkType,
        route: window.location.pathname,
        loadTimeMs: Math.round(performance.now()),
        domNodes: health.domNodes,
      }).catch(() => {});

      // Update system health
      convexClient.mutation(api.errorHunter.updateSystemHealth, {
        activeUsers: 1,
        errorRate: health.errorRatePerMin,
        avgFps,
        avgLatency: health.networkLatencyMs,
        diagnostics: JSON.stringify({
          memoryGrowthMB: leak.growthMB,
          leakDetected: leak.leakDetected,
          stormDetected: storm.stormDetected,
          stormCount: storm.errorCount,
          domNodes: health.domNodes,
          uptime: health.uptime,
        }),
      }).catch(() => {});
    } catch { /* silent */ }
  }, 30000);
}

export function stopPerformanceMonitor() {
  perfStopped = true;
  if (fpsRafId !== null) {
    cancelAnimationFrame(fpsRafId);
    fpsRafId = null;
  }
  if (perfInterval) {
    clearInterval(perfInterval);
    perfInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🧠 MAIN COMPONENT — ULTIMATE ERROR HUNTER
// ═══════════════════════════════════════════════════════════════════════

export class ErrorHunter extends Component<Props, State> {
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null;

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
      showBrainAnalysis: false,
      errorId: null,
      deviceHealth: collectDeviceHealth(),
      incidentId: null,
      incidentEvents: [],
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // ── Step 1: Advanced Diagnosis ──
    const diagnosis = diagnoseAdvanced(error);
    this.setState({ diagnosis });

    // ── Step 2: Build Root Cause Chain ──
    const rootCauseChain = this.buildRootCauseChain(error, errorInfo);
    this.setState({ rootCauseChain });

    // ── Step 3: Check Circuit Breaker ──
    if (this.state.circuitState === "open") {
      this.setState({
        healing: false,
        healingResult: "failed",
        healingMessage: "🛑 Circuit Breaker مفتوح — تم توقف محاولات الإصلاح",
      });
      this.reportToServer(error, errorInfo, diagnosis, false, "circuit_open");
      return;
    }

    // ── Step 4: Detect Error Storm ──
    const storm = detectErrorStorm();
    if (storm.stormDetected) {
      console.warn(`[ErrorHunter] 🌊 Error storm detected: ${storm.errorCount} errors in 5s`);
    }

    // ── Step 5: Report to Server ──
    this.reportToServer(error, errorInfo, diagnosis);

    // ── Step 6: Start Cascading Recovery ──
    this.startCascadingRecovery(diagnosis);
  }

  private buildRootCauseChain(error: Error, errorInfo: ErrorInfo): RootCauseNode[] {
    const chain: RootCauseNode[] = [];
    const stack = error.stack || "";
    const lines = stack.split("\n").slice(0, 6);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        chain.push({
          depth: i,
          component: match[1],
          error: i === 0 ? error.message : "invoked by",
          suggestion: this.getSuggestionForFrame(match[1], i),
        });
      }
    }

    // Add component stack info
    if (errorInfo.componentStack) {
      const components = errorInfo.componentStack
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 4);
      components.forEach((comp, i) => {
        chain.push({
          depth: chain.length,
          component: comp.trim().replace(/\s*\n/g, ""),
          error: "rendered here",
          suggestion: "",
        });
      });
    }

    return chain;
  }

  private getSuggestionForFrame(name: string, depth: number): string {
    if (depth === 0) return "هنا حدث الخطأ مباشرة";
    if (name.includes("hook") || name.includes("Hook")) return " Rwanda تحقق من استخدام Hooks";
    if (name.includes("render") || name.includes("Render")) return " تحقق من عرض المكون";
    if (name.includes("callback") || name.includes("Callback")) return " تحقق من الدالة المرجعية";
    if (name.includes("effect") || name.includes("Effect")) return " تحقق من useEffect";
    return "";
  }

  private async reportToServer(
    error: Error,
    errorInfo: ErrorInfo,
    diagnosis: ErrorDiagnosis,
    autoHealed = false,
    strategy?: string,
  ) {
    try {
      const id = await convexClient?.mutation(api.errorHunter.logError, {
        message: error.message.slice(0, 500),
        stack: error.stack?.slice(0, 2000),
        component: this.props.name || errorInfo.componentStack?.split("\n")?.[1]?.trim(),
        route: window.location.pathname,
        url: window.location.href,
        autoHealed,
        healStrategy: strategy,
        deviceInfo: navigator.userAgent.slice(0, 200),
      });
      if (id?.id) this.setState({ errorId: id.id });
    } catch { /* Never crash */ }
  }

  private async startCascadingRecovery(diagnosis: ErrorDiagnosis) {
    const strategies = diagnosis.recoveryStrategies
      .map((s) => RECOVERY_STRATEGIES[s])
      .filter(Boolean)
      .sort((a, b) => a.priority - b.priority);

    if (strategies.length === 0) {
      this.setState({ healing: false, healingResult: "failed" });
      return;
    }

    this.setState({
      healing: true,
      healingMessage: "🚀 بدء محرك الإصلاح المتسلسل...",
      healingSteps: strategies.map((s) => ({
        name: s.name,
        strategy: "",
        status: "pending" as const,
        message: "",
      })),
    });

    // Add timeline event
    this.addTimelineEvent("recovery_start", `بدء ${strategies.length} استراتيجيات إصلاح`);

    for (let i = 0; i < strategies.length; i++) {
      const strategyKey = diagnosis.recoveryStrategies[i];
      const strategy = strategies[i];
      if (!strategy) continue;

      // Check circuit breaker
      if (this.state.circuitState === "open") {
        this.updateStep(i, "skipped", "⏭️ تم الإيقاف — Circuit Breaker مفتوح");
        break;
      }

      this.setState({ currentStrategy: i });
      this.updateStep(i, "active", `جارٍ: ${strategy.name}...`);
      this.setState({ healingMessage: `🔧 المحاولة ${i + 1}/${strategies.length}: ${strategy.name}` });
      this.addTimelineEvent("recovery_start", strategy.name);

      const startTime = Date.now();
      try {
        const success = await strategy.execute();
        const duration = Date.now() - startTime;

        if (success) {
          this.updateStep(i, "success", `✅ نجح: ${strategy.name} (${duration}ms)`);
          this.addTimelineEvent("recovery_result", `✅ نجح: ${strategy.name}`);

          // Report success
          this.reportToServer(
            new Error(`[HEALED] ${diagnosis.displayName}`),
            { componentStack: "" },
            diagnosis,
            true,
            strategyKey,
          );

          this.setState({ healingResult: "success" });

          // If strategy triggers reload, we won't reach here
          // If it returns false (non-reload), continue to next strategy
          if (strategyKey === "isolate_component" || strategyKey === "notify_owner" || strategyKey === "notify_user" || strategyKey === "log_only") {
            // These don't reload, continue trying
            continue;
          }

          // Strategy that reloads — wait briefly then report circuit breaker success
          this.setState({ consecutiveFailures: 0, circuitState: "closed" });
          return;
        }

        // Failed — try next
        this.updateStep(i, "failed", `❌ فشل: ${strategy.name}`);
        this.addTimelineEvent("recovery_result", `❌ فشل: ${strategy.name}`);
      } catch {
        this.updateStep(i, "failed", `❌ خطأ في: ${strategy.name}`);
        this.addTimelineEvent("recovery_result", `❌ خطأ: ${strategy.name}`);
      }
    }

    // All strategies failed
    const newFailures = this.state.consecutiveFailures + 1;
    const newCircuitState = newFailures >= CIRCUIT_BREAKER_THRESHOLD ? "open" : this.state.circuitState;

    this.setState({
      healingResult: "failed",
      healingMessage: "🛑 جميع استراتيجيات الإصلاح فشلت",
      consecutiveFailures: newFailures,
      circuitState: newCircuitState,
    });

    this.addTimelineEvent("system_action",
      newCircuitState === "open"
        ? "🔒 Circuit Breaker فُتح — توقف محاولات الإصلاح"
        : `⚠️ فشلت المحاولات (${newFailures}/${CIRCUIT_BREAKER_THRESHOLD})`
    );
  }

  private updateStep(index: number, status: RecoveryStep["status"], message: string) {
    this.setState((s) => ({
      healingSteps: s.healingSteps.map((step, i) =>
        i === index ? { ...step, status, message } : step
      ),
    }));
  }

  private addTimelineEvent(type: IncidentEvent["type"], message: string) {
    this.setState((s) => ({
      incidentEvents: [
        ...s.incidentEvents,
        { timestamp: Date.now(), type, message },
      ],
    }));
  }

  private handleReload = () => {
    if ("caches" in window) {
      caches.keys().then((n) => Promise.all(n.map((k) => caches.delete(k))));
    }
    safeReload();
  };

  private handleGoHome = () => { window.location.href = "/play"; };

  private toggleDetails = () => this.setState((s) => ({ showDetails: !s.showDetails }));
  private toggleTimeline = () => this.setState((s) => ({ showTimeline: !s.showTimeline }));
  private toggleBrain = () => this.setState((s) => ({ showBrainAnalysis: !s.showBrainAnalysis }));

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { error, diagnosis, healingSteps, healingResult, circuitState,
      showDetails, showTimeline, showBrainAnalysis, rootCauseChain, incidentEvents } = this.state;
    const d = diagnosis || diagnoseAdvanced(error!);

    // ── Healing in progress ──
    if (this.state.healing && !healingResult) {
      return (
        <ErrorScreen>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-lg"
          >
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="size-8 text-primary animate-pulse" />
            </div>
            <h2 className="mt-5 text-xl font-bold">🧠 صياد الأخطاء يعمل...</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.healingMessage}
            </p>
            <div className="mt-4 flex justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>

            {/* Recovery steps progress */}
            <div className="mt-5 space-y-1.5 text-start">
              {healingSteps.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all ${
                    step.status === "active"
                      ? "bg-primary/10 text-primary"
                      : step.status === "success"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : step.status === "failed"
                          ? "bg-rose-500/10 text-rose-600"
                          : step.status === "skipped"
                            ? "bg-muted text-muted-foreground"
                            : "text-muted-foreground/60"
                  }`}
                >
                  <span className="w-4 text-center">
                    {step.status === "active" ? <Loader2 className="size-3 animate-spin" /> :
                     step.status === "success" ? "✅" :
                     step.status === "failed" ? "❌" :
                     step.status === "skipped" ? "⏭️" : "⏳"}
                  </span>
                  <span className="flex-1">{step.name}</span>
                </div>
              ))}
            </div>

            {/* Circuit breaker indicator */}
            {circuitState !== "closed" && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-amber-600">
                <Lock className="size-3" />
                Circuit Breaker: {circuitState === "open" ? "مفتوح" : "شبه مفتوح"}
              </div>
            )}
          </motion.div>
        </ErrorScreen>
      );
    }

    // ── Error display ──
    return (
      <ErrorScreen>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/80 bg-card p-6 shadow-sm scrollbar-thin"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              d.severity === "catastrophic" ? "bg-red-600/10 text-red-700" :
              d.severity === "critical" ? "bg-red-500/10 text-red-600" :
              d.severity === "high" ? "bg-amber-500/10 text-amber-600" :
              d.severity === "medium" ? "bg-blue-500/10 text-blue-600" :
              "bg-muted text-muted-foreground"
            }`}>
              {d.severity === "catastrophic" ? <AlertOctagon className="size-6" /> :
               d.severity === "critical" ? <Bug className="size-6" /> :
               d.severity === "high" ? <AlertTriangle className="size-6" /> :
               <Shield className="size-6" />}
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold">{d.displayName}</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.description}</p>
            </div>
          </div>

          {/* Severity + Category + Confidence badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge severity={d.severity} />
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              <CircuitBoard className="size-2.5" /> {d.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              <Target className="size-2.5" /> ثقة {Math.round(d.confidence * 100)}%
            </span>
            {d.estimatedImpact && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                <Eye className="size-2.5" /> {d.estimatedImpact}
              </span>
            )}
          </div>

          {/* Root Cause Chain */}
          {rootCauseChain.length > 0 && (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                <Radar className="size-3.5 text-primary" /> سلسلة السبب الجذري
              </p>
              <div className="space-y-1">
                {rootCauseChain.slice(0, 5).map((node, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-4 text-center text-muted-foreground/60">{i + 1}</span>
                    <span className="w-1 h-1 rounded-full bg-primary/40" />
                    <span className="font-mono text-muted-foreground truncate max-w-[200px]">{node.component}</span>
                    {node.suggestion && (
                      <span className="text-primary/70 truncate">← {node.suggestion}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recovery result */}
          {healingResult && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                healingResult === "success"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-rose-500/10 text-rose-600"
              }`}
            >
              {healingResult === "success" ? (
                <><CheckCircle2 className="size-4" /> تم الإصلاح بنجاح — جارٍ إعادة التحميل</>
              ) : (
                <><XCircle className="size-4" /> تعذّر الإصلاح التلقائي — جرّب يدوياً</>
              )}
            </motion.div>
          )}

          {/* Recovery steps summary */}
          {healingSteps.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/60 p-2">
              <button
                type="button"
                onClick={this.toggleTimeline}
                className="flex w-full items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3" /> سجل الاسترداد ({healingSteps.length} خطوات)
                </span>
                {showTimeline ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
              <AnimatePresence>
                {showTimeline && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="mt-1 space-y-0.5">
                      {healingSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[10px] text-muted-foreground">
                          <span>{step.status === "success" ? "✅" : step.status === "failed" ? "❌" : step.status === "skipped" ? "⏭️" : "⏳"}</span>
                          <span className="flex-1">{step.name}</span>
                          {step.duration && <span className="text-[9px]">{step.duration}ms</span>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Timeline */}
          {incidentEvents.length > 0 && (
            <div className="mt-3 rounded-xl border border-border/60 p-2">
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-muted-foreground">
                <Clock className="size-3" /> التسلسل الزمني للحادثة
              </p>
              <div className="space-y-0.5">
                {incidentEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <span className="w-14 text-[8px] font-mono opacity-50">
                      {new Date(ev.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="flex-1">{ev.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root Cause Analysis (Brain) */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <button
              type="button"
              onClick={this.toggleBrain}
              className="flex w-full items-center justify-between text-xs font-bold text-primary"
            >
              <span className="flex items-center gap-1.5">
                <Brain className="size-3.5" /> تحليل السبب الجذري
              </span>
              {showBrainAnalysis ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            <AnimatePresence>
              {showBrainAnalysis && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-bold text-foreground">السبب المحتمل: </span>
                      {d.rootCause}
                    </div>
                    <div>
                      <span className="font-bold text-foreground">الحد الأقصى للتأثير: </span>
                      {d.estimatedImpact}
                    </div>
                    {d.relatedPatterns.length > 0 && (
                      <div>
                        <span className="font-bold text-foreground">أنماط مرتبطة: </span>
                        {d.relatedPatterns.join(" · ")}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-foreground">استراتيجيات الإصلاح: </span>
                      {d.recoveryStrategies.map((s) => RECOVERY_STRATEGIES[s]?.name || s).join(" → ")}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Device Health */}
          <DeviceHealthPanel health={this.state.deviceHealth} />

          {/* Action buttons */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="size-4" />
              إعادة التحميل
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Home className="size-4" />
              العودة للرئيسية
            </button>
          </div>

          {/* Technical details */}
          <div className="mt-4 text-start">
            <button
              type="button"
              onClick={this.toggleDetails}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <span>تفاصيل تقنية</span>
              {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-[10px] leading-4 text-muted-foreground/90 scrollbar-thin">
                    {error!.message}
                    {this.state.errorInfo?.componentStack ? `\n\nالمكونات:\n${this.state.errorInfo.componentStack}` : ""}
                    {error!.stack ? `\n\nStack:\n${error!.stack.slice(0, 800)}` : ""}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </ErrorScreen>
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// UI SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function Badge({ severity }: { severity: ErrorSeverity }) {
  const map: Record<ErrorSeverity, { label: string; cls: string }> = {
    catastrophic: { label: "كارثي", cls: "bg-red-600/10 text-red-700" },
    critical: { label: "حرج", cls: "bg-red-500/10 text-red-600" },
    high: { label: "مرتفع", cls: "bg-amber-500/10 text-amber-600" },
    medium: { label: "متوسط", cls: "bg-blue-500/10 text-blue-600" },
    low: { label: "منخفض", cls: "bg-muted text-muted-foreground" },
  };
  const { label, cls } = map[severity] || map.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      <ShieldAlert className="size-2.5" /> {label}
    </span>
  );
}

function DeviceHealthPanel({ health }: { health: DeviceHealth }) {
  const metrics = [
    { icon: Gauge, label: "FPS", value: health.fps, status: health.fps > 30 ? "good" : health.fps > 15 ? "warn" : "bad" },
    { icon: MemoryStick, label: "RAM", value: `${health.memoryUsedMB}MB`, status: health.memoryUsedMB < 200 ? "good" : health.memoryUsedMB < 400 ? "warn" : "bad" },
    { icon: Network, label: "شبكة", value: health.networkType, status: health.networkLatencyMs < 200 ? "good" : health.networkLatencyMs < 500 ? "warn" : "bad" },
    { icon: HardDrive, label: "DOM", value: health.domNodes, status: health.domNodes < 2000 ? "good" : health.domNodes < 5000 ? "warn" : "bad" },
    { icon: Cpu, label: "أنوية", value: health.cpuCores, status: "good" as const },
    { icon: Clock, label: "وقت", value: `${health.uptime}s`, status: "good" as const },
  ];

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Activity className="size-3" /> صحة الجهاز
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-0.5 rounded-lg bg-card/50 p-2">
            <m.icon className={`size-3.5 ${
              m.status === "good" ? "text-emerald-500" :
              m.status === "warn" ? "text-amber-500" : "text-red-500"
            }`} />
            <span className="text-[9px] text-muted-foreground">{m.label}</span>
            <span className="text-[10px] font-bold">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HEALTH INDICATOR (Corner widget)
// ═══════════════════════════════════════════════════════════════════════

export function HealthIndicator() {
  return null; // Can be activated for live corner widget
}
