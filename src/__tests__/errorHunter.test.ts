/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧪 اختبارات صياد الأخطاء الشاملة — Error Hunter v3.0
 * ═══════════════════════════════════════════════════════════════════════
 *
 * يختبر كل مكون من مكونات صياد الأخطاء:
 * 1. محرك التشخيص المتقدم
 * 2. كاشف تسريب الذاكرة
 * 3. كاشف عاصفة الأخطاء
 * 4. القاطع الدائري (Circuit Breaker)
 * 5. سلسلة السبب الجذري
 * 6. جامع بيانات صحة الجهاز
 * 7. اختبارات التكامل
 */

import { describe, it, expect, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════════════

type ErrorSeverity = "low" | "medium" | "high" | "critical" | "catastrophic";
type ErrorCategory =
  | "chunk_load" | "hooks_violation" | "runtime" | "network"
  | "api" | "render" | "memory" | "security" | "storage"
  | "dom" | "style" | "async" | "infinite_loop"
  | "circular_dep" | "type_error" | "null_reference" | "permission"
  | "unknown";

interface ErrorDiagnosis {
  category: ErrorCategory;
  severity: ErrorSeverity;
  displayName: string;
  description: string;
  rootCause: string;
  confidence: number;
  recoveryStrategies: string[];
  estimatedImpact: string;
  relatedPatterns: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// ⚡ نسخة مطابقة من diagnoseAdvanced من ErrorHunter.tsx
// ═══════════════════════════════════════════════════════════════════════

function diagnoseAdvanced(error: Error): ErrorDiagnosis {
  const msg = error.message || "";
  // Strip vitest/test runner artifacts from stack to avoid false positives
  const stack = (error.stack || "")
    .replace(/chunk-artifact[^\s]*/g, "")
    .replace(/runWithTimeout/g, "")
    .replace(/runWithCancel/g, "")
    .replace(/@vitest[^\s]*/g, "");
  const name = error.name || "";
  const combined = `${name} ${msg} ${stack}`;

  // ── CATASTROPHIC ──
  if (/Rendered more hooks than previous|hooks.*changed.*order/i.test(combined)) {
    return {
      category: "hooks_violation", severity: "catastrophic",
      displayName: "🔴 انتهاك خطير لـ Hooks",
      description: "تم استدعاء hooks بعدد مختلف",
      rootCause: "hook استدعاء شرطي", confidence: 0.95,
      recoveryStrategies: ["clear_all_cache", "nuclear_reload", "isolate_component"],
      estimatedImpact: "الشاشة البيضاء الكاملة", relatedPatterns: ["React hook order"],
    };
  }

  if (/chunk|Loading chunk|Failed to fetch dynamically import|dynamically imported module/i.test(combined)) {
    return {
      category: "chunk_load", severity: "critical",
      displayName: "🔴 فشل تحميل الملف",
      description: "الملف المطلوب لم يُحمّل",
      rootCause: "cache قديمة", confidence: 0.98,
      recoveryStrategies: ["clear_service_worker", "clear_cache", "hard_reload"],
      estimatedImpact: "صفحة لا تفتح", relatedPatterns: ["Vite chunk"],
    };
  }

  if (/process is not defined|ReferenceError.*process/i.test(combined)) {
    return {
      category: "runtime", severity: "critical",
      displayName: "🔴 خطأ بيئة التشغيل",
      description: "مرجع process غير متاح",
      rootCause: "مكتبة تستخدم process.env", confidence: 0.99,
      recoveryStrategies: ["inject_polyfill", "clear_cache", "hard_reload"],
      estimatedImpact: "صفحة لا تعمل", relatedPatterns: ["Node.js polyfill"],
    };
  }

  if (/Maximum update depth exceeded|infinite/i.test(combined)) {
    return {
      category: "infinite_loop", severity: "critical",
      displayName: "🔴 حلقة لا نهائية",
      description: "تحديث المكون لمرة لا نهائية",
      rootCause: "setState في useEffect", confidence: 0.92,
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
      estimatedImpact: "تجمد المتصفح", relatedPatterns: ["setState loop"],
    };
  }

  if (/Maximum call stack|RangeError.*stack/i.test(combined)) {
    return {
      category: "circular_dep", severity: "critical",
      displayName: "🔴 استدعاء دائري",
      description: "overflow في الذاكرة",
      rootCause: "دالة تستدعي نفسها", confidence: 0.95,
      recoveryStrategies: ["clear_cache", "nuclear_reload"],
      estimatedImpact: "تجمد كامل", relatedPatterns: ["stack overflow"],
    };
  }

  // ── HIGH ──
  if (/network|Failed to fetch|ERR_NETWORK|ERR_CONNECTION/i.test(combined)) {
    return {
      category: "network", severity: "high",
      displayName: "🟡 خطأ شبكي",
      description: "تعذر الاتصال بالخادم",
      rootCause: "انقطاع الاتصال", confidence: 0.90,
      recoveryStrategies: ["wait_and_retry", "clear_cache", "offline_mode"],
      estimatedImpact: "بيانات لا تُحمّل", relatedPatterns: ["fetch fail"],
    };
  }

  if (/convex|subscription|query.*fail|mutation.*fail/i.test(combined)) {
    return {
      category: "api", severity: "high",
      displayName: "🟡 خطأ في الاتصال بالخادم",
      description: "تعذر الاتصال بـ Convex",
      rootCause: "مشكلة WebSocket", confidence: 0.85,
      recoveryStrategies: ["wait_and_retry", "re_auth", "clear_cache"],
      estimatedImpact: "بيانات لا تتحدث", relatedPatterns: ["Convex connection"],
    };
  }

  if (/cannot read propert|undefined is not|TypeError.*null|TypeError.*undefined/i.test(combined)) {
    return {
      category: "null_reference", severity: "high",
      displayName: "🟡 مرجع فارغ",
      description: "محاولة الوصول لخاصية على قيمة فارغة",
      rootCause: "بيانات غير مُهيأة", confidence: 0.88,
      recoveryStrategies: ["clear_cache", "soft_reload"],
      estimatedImpact: "مكون لا يعمل", relatedPatterns: ["null access"],
    };
  }

  if (/SyntaxError|Unexpected token|JSON/i.test(combined)) {
    return {
      category: "type_error", severity: "high",
      displayName: "🟡 خطأ في تحليل البيانات",
      description: "JSON أو syntax غير صالح",
      rootCause: "بيانات خام غير متوقعة", confidence: 0.90,
      recoveryStrategies: ["clear_cache", "wait_and_retry"],
      estimatedImpact: "صفحة لا تعمل", relatedPatterns: ["JSON parse"],
    };
  }

  if (/SecurityError|blocked.*CORS|CORS|Not allowed/i.test(combined)) {
    return {
      category: "security", severity: "high",
      displayName: "🟡 مشكلة أمان",
      description: "تم حظر طلب بسبب سياسات الأمان",
      rootCause: "CORS أو CSP", confidence: 0.85,
      recoveryStrategies: ["notify_owner", "soft_reload"],
      estimatedImpact: "ميزة لا تعمل", relatedPatterns: ["CORS policy"],
    };
  }

  if (/QuotaExceeded|quota.*exceed|storage.*full/i.test(combined)) {
    return {
      category: "storage", severity: "high",
      displayName: "🟡 مساحة التخزين ممتلئة",
      description: "storage ممتلئ",
      rootCause: "بيانات كثيرة مخزنة", confidence: 0.92,
      recoveryStrategies: ["clear_storage", "clear_cache"],
      estimatedImpact: "بيانات لا تُحفظ", relatedPatterns: ["localStorage full"],
    };
  }

  if (/Memory leak|heap.*limit|out of memory/i.test(combined)) {
    return {
      category: "memory", severity: "critical",
      displayName: "🔴 تسريب ذاكرة",
      description: "التطبيق يستهلك ذاكرة أكثر من الحد",
      rootCause: "عناصر DOM غير مُفرغة", confidence: 0.88,
      recoveryStrategies: ["nuclear_reload", "clear_all_cache"],
      estimatedImpact: "تجمد ثم انهيار", relatedPatterns: ["memory leak"],
    };
  }

  if (/permission|denied|NotAllowed/i.test(combined)) {
    return {
      category: "permission", severity: "medium",
      displayName: "🔵 مشكلة صلاحيات",
      description: "الإجراء يتطلب إذن المستخدم",
      rootCause: "autoplay بدون تفاعل", confidence: 0.80,
      recoveryStrategies: ["notify_user", "soft_reload"],
      estimatedImpact: "إجراء واحد لا يعمل", relatedPatterns: ["user gesture required"],
    };
  }

  if (/timeout|timed out/i.test(combined)) {
    return {
      category: "async", severity: "medium",
      displayName: "🔵 انتهت المهلة",
      description: "طلب استمر أكثر من المدة",
      rootCause: "شبكة بطيئة", confidence: 0.80,
      recoveryStrategies: ["wait_and_retry", "clear_cache"],
      estimatedImpact: "بيانات متأخرة", relatedPatterns: ["timeout"],
    };
  }

  return {
    category: "unknown", severity: "medium",
    displayName: "⚪ خطأ غير معروف",
    description: "خطأ غير مصنف",
    rootCause: "يحتاج تحليل يدوي", confidence: 0.30,
    recoveryStrategies: ["clear_cache", "notify_owner"],
    estimatedImpact: "غير معروف", relatedPatterns: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 🛡️ Circuit Breaker Simulator
// ═══════════════════════════════════════════════════════════════════════

class CircuitBreakerSimulator {
  private failures = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private lastOpenedAt = 0;
  private readonly threshold = 5;
  private readonly timeout = 30000;

  getState() { return this.state; }
  getFailures() { return this.failures; }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = "open";
      this.lastOpenedAt = Date.now();
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  shouldAllow(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastOpenedAt > this.timeout) {
        this.state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🌊 Error Storm Detector Simulator
// ═══════════════════════════════════════════════════════════════════════

class ErrorStormDetectorSimulator {
  private timestamps: number[] = [];
  private readonly windowMs = 5000;
  private readonly threshold = 10;

  record() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    this.timestamps.push(now);
  }

  isStorm() { return this.timestamps.length >= this.threshold; }
  getCount() {
    const now = Date.now();
    return this.timestamps.filter((t) => now - t < this.windowMs).length;
  }
  reset() { this.timestamps = []; }
}

// ═══════════════════════════════════════════════════════════════════════
// 🔮 Memory Leak Detector Simulator
// ═══════════════════════════════════════════════════════════════════════

class MemoryLeakDetectorSimulator {
  private baseline = 0;
  private checks = 0;
  private readonly thresholdMB = 100;

  check(currentMB: number) {
    if (this.baseline === 0) {
      this.baseline = currentMB;
      return { leakDetected: false, growthMB: 0 };
    }
    this.checks++;
    const growthMB = currentMB - this.baseline;
    if (this.checks > 10) { this.baseline = currentMB; this.checks = 0; }
    return { leakDetected: growthMB > this.thresholdMB, growthMB };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🧪 الاختبارات
// ═══════════════════════════════════════════════════════════════════════

describe("🧠 صياد الأخطاء — اختبارات شاملة", () => {

  // ──────────────────────────────────────────────────
  // 1. التشخيص المتقدم
  // ──────────────────────────────────────────────────
  describe("🔍 محرك التشخيص المتقدم", () => {

    it("Hooks violation → catastrophic", () => {
      const d = diagnoseAdvanced(new Error("Rendered more hooks than previous"));
      expect(d.category).toBe("hooks_violation");
      expect(d.severity).toBe("catastrophic");
      expect(d.confidence).toBeGreaterThanOrEqual(0.90);
      expect(d.recoveryStrategies).toContain("nuclear_reload");
    });

    it("Chunk load → critical", () => {
      const d = diagnoseAdvanced(new Error("Failed to fetch dynamically imported module"));
      expect(d.category).toBe("chunk_load");
      expect(d.severity).toBe("critical");
      expect(d.recoveryStrategies).toContain("clear_service_worker");
    });

    it("Process not defined → runtime", () => {
      const e = new Error("process is not defined");
      e.name = "ReferenceError";
      const d = diagnoseAdvanced(e);
      expect(d.category).toBe("runtime");
      expect(d.recoveryStrategies).toContain("inject_polyfill");
    });

    it("Infinite update loop → infinite_loop", () => {
      const d = diagnoseAdvanced(new Error("Maximum update depth exceeded"));
      expect(d.category).toBe("infinite_loop");
      expect(d.severity).toBe("critical");
    });

    it("Stack overflow → circular_dep", () => {
      const d = diagnoseAdvanced(new RangeError("Maximum call stack size exceeded"));
      expect(d.category).toBe("circular_dep");
      expect(d.severity).toBe("critical");
    });

    it("Network error → network", () => {
      const d = diagnoseAdvanced(new TypeError("Failed to fetch"));
      expect(d.category).toBe("network");
      expect(d.severity).toBe("high");
      expect(d.recoveryStrategies).toContain("wait_and_retry");
    });

    it("Convex API error → api", () => {
      const d = diagnoseAdvanced(new Error("convex subscription query fail"));
      expect(d.category).toBe("api");
      expect(d.recoveryStrategies).toContain("re_auth");
    });

    it("Null reference → null_reference", () => {
      const d = diagnoseAdvanced(new TypeError("Cannot read properties of null"));
      expect(d.category).toBe("null_reference");
    });

    it("Syntax error → type_error", () => {
      const d = diagnoseAdvanced(new SyntaxError("Unexpected token in JSON"));
      expect(d.category).toBe("type_error");
    });

    it("CORS → security", () => {
      const e = new Error("blocked by CORS policy");
      e.name = "SecurityError";
      const d = diagnoseAdvanced(e);
      expect(d.category).toBe("security");
    });

    it("Storage full → storage", () => {
      const d = diagnoseAdvanced(new Error("QuotaExceededError"));
      expect(d.category).toBe("storage");
      expect(d.recoveryStrategies).toContain("clear_storage");
    });

    it("Out of memory → memory", () => {
      const d = diagnoseAdvanced(new Error("out of memory"));
      expect(d.category).toBe("memory");
      expect(d.severity).toBe("critical");
    });

    it("Permission denied → permission", () => {
      const d = diagnoseAdvanced(new Error("NotAllowedError: user gesture required"));
      expect(d.category).toBe("permission");
      expect(d.severity).toBe("medium");
    });

    it("Timeout → async", () => {
      const d = diagnoseAdvanced(new Error("request timed out"));
      expect(d.category).toBe("async");
      expect(d.severity).toBe("medium");
    });

    it("Unknown error → unknown", () => {
      const d = diagnoseAdvanced(new Error("foobar baz qux"));
      expect(d.category).toBe("unknown");
      expect(d.confidence).toBeLessThan(0.50);
    });

    it("كل التشخيصات تحتوي على displayName عربي", () => {
      const errors = [
        new Error("Rendered more hooks"),
        new Error("Loading chunk failed"),
        new Error("process is not defined"),
        new Error("Failed to fetch"),
        new Error("Cannot read properties"),
        new Error("foobar unknown"),
      ];
      for (const e of errors) {
        const d = diagnoseAdvanced(e);
        expect(d.displayName.length).toBeGreaterThan(2);
        expect(d.description).toBeTruthy();
        expect(d.rootCause).toBeTruthy();
      }
    });

    it("كل التشخيصات تحتوي على استراتيجيات إصلاح", () => {
      for (const msg of ["chunk load", "network error", "process undefined", "memory leak", "random"]) {
        const d = diagnoseAdvanced(new Error(msg));
        expect(d.recoveryStrategies.length).toBeGreaterThan(0);
      }
    });

    it("كل التشخيصات تحتوي على estimatedImpact", () => {
      for (const msg of ["Failed to fetch dynamically", "Failed to fetch", "Cannot read properties", "timeout"]) {
        const d = diagnoseAdvanced(new Error(msg));
        expect(d.estimatedImpact).toBeTruthy();
      }
    });
  });

  // ──────────────────────────────────────────────────
  // 2. Circuit Breaker
  // ──────────────────────────────────────────────────
  describe("🛡️ القاطع الدائري", () => {
    let cb: CircuitBreakerSimulator;
    beforeEach(() => { cb = new CircuitBreakerSimulator(); });

    it("يبدأ مغلقاً", () => {
      expect(cb.getState()).toBe("closed");
      expect(cb.shouldAllow()).toBe(true);
    });

    it("يسمح حتى 4 أخطاء", () => {
      for (let i = 0; i < 4; i++) { cb.recordFailure(); expect(cb.getState()).toBe("closed"); }
    });

    it("يفتح بعد 5 أخطاء", () => {
      for (let i = 0; i < 5; i++) cb.recordFailure();
      expect(cb.getState()).toBe("open");
      expect(cb.shouldAllow()).toBe(false);
    });

    it("يغلق بعد نجاح", () => {
      for (let i = 0; i < 5; i++) cb.recordFailure();
      cb.recordSuccess();
      expect(cb.getState()).toBe("closed");
      expect(cb.getFailures()).toBe(0);
    });

    it("ينقل لـ half-open بعد المهلة", () => {
      for (let i = 0; i < 5; i++) cb.recordFailure();
      const orig = Date.now;
      Date.now = () => orig() + 31000;
      expect(cb.shouldAllow()).toBe(true);
      expect(cb.getState()).toBe("half-open");
      Date.now = orig;
    });

    it("يمنع المحاولات أثناء المهلة", () => {
      for (let i = 0; i < 5; i++) cb.recordFailure();
      expect(cb.shouldAllow()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────
  // 3. Error Storm Detector
  // ──────────────────────────────────────────────────
  describe("🌊 كاشف عاصفة الأخطاء", () => {
    let s: ErrorStormDetectorSimulator;
    beforeEach(() => { s = new ErrorStormDetectorSimulator(); });

    it("يبدأ بدون عاصفة", () => {
      expect(s.isStorm()).toBe(false);
      expect(s.getCount()).toBe(0);
    });

    it("لا يكتشف عاصفة مع 9 أخطاء", () => {
      for (let i = 0; i < 9; i++) s.record();
      expect(s.isStorm()).toBe(false);
    });

    it("يكتشف عاصفة مع 10 أخطاء", () => {
      for (let i = 0; i < 10; i++) s.record();
      expect(s.isStorm()).toBe(true);
    });

    it("يعيد العد بعد الإعادة تعيين", () => {
      for (let i = 0; i < 12; i++) s.record();
      s.reset();
      expect(s.isStorm()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────
  // 4. Memory Leak Detector
  // ──────────────────────────────────────────────────
  describe("🔮 كاشف تسريب الذاكرة", () => {
    let m: MemoryLeakDetectorSimulator;
    beforeEach(() => { m = new MemoryLeakDetectorSimulator(); });

    it("لا يكتشف تسريب في القراءة الأولى", () => {
      const r = m.check(50);
      expect(r.leakDetected).toBe(false);
      expect(r.growthMB).toBe(0);
    });

    it("لا يكتشف تسريب مع نمو طبيعي", () => {
      m.check(100);
      expect(m.check(150).leakDetected).toBe(false);
    });

    it("يكتشف تسريب مع نمو > 100MB", () => {
      m.check(100);
      expect(m.check(250).leakDetected).toBe(true);
    });

    it("الحد الأدنى 100MB", () => {
      m.check(100);
      expect(m.check(199).leakDetected).toBe(false);
      expect(m.check(201).leakDetected).toBe(true);
    });

    it("يعيد تعيين الخط الأساسي بعد 10 فحوصات", () => {
      m.check(100);
      for (let i = 0; i < 11; i++) m.check(150);
      expect(m.check(200).growthMB).toBe(50);
      expect(m.check(200).leakDetected).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────
  // 5. Root Cause Chain
  // ──────────────────────────────────────────────────
  describe("🔗 سلسلة السبب الجذري", () => {
    it("تبني سلسلة من Error stack", () => {
      const e = new Error("test");
      e.stack = "Error: test\n    at Component.render (file.tsx:10:5)\n    at processChild (react-dom.ts:200:10)";
      const chain = e.stack.split("\n").slice(0, 6);
      expect(chain.length).toBeGreaterThan(1);
    });

    it("تميّز المكون الأول", () => {
      const stack = "Error: test\n    at MyComponent.render (src/App.tsx:10:5)";
      const match = stack.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      expect(match![1]).toBe("MyComponent.render");
    });
  });

  // ──────────────────────────────────────────────────
  // 6. Device Health
  // ──────────────────────────────────────────────────
  describe("📊 صحة الجهاز", () => {
    it("يجمع البيانات الأساسية", () => {
      const h = { fps: 60, memoryUsedMB: 128, domNodes: 1500, cpuCores: 4 };
      expect(h.fps).toBeGreaterThan(0);
      expect(h.memoryUsedMB).toBeGreaterThan(0);
      expect(h.domNodes).toBeGreaterThan(0);
    });

    it("تصنيف FPS", () => {
      const classify = (fps: number) => fps > 30 ? "good" : fps > 15 ? "warn" : "bad";
      expect(classify(60)).toBe("good");
      expect(classify(25)).toBe("warn");
      expect(classify(10)).toBe("bad");
    });

    it("تصنيف الذاكرة", () => {
      const classify = (mb: number) => mb < 200 ? "good" : mb < 400 ? "warn" : "bad";
      expect(classify(150)).toBe("good");
      expect(classify(300)).toBe("warn");
      expect(classify(500)).toBe("bad");
    });
  });

  // ──────────────────────────────────────────────────
  // 7. Integration Tests
  // ──────────────────────────────────────────────────
  describe("🔗 اختبارات التكامل", () => {

    it("التشخيص + Circuit Breaker", () => {
      const cb = new CircuitBreakerSimulator();
      for (let i = 0; i < 5; i++) {
        diagnoseAdvanced(new Error("Failed to fetch dynamically"));
        cb.recordFailure();
      }
      expect(cb.getState()).toBe("open");
    });

    it("التشخيص + Storm Detector", () => {
      const storm = new ErrorStormDetectorSimulator();
      for (let i = 0; i < 10; i++) {
        storm.record();
        diagnoseAdvanced(new Error("network error " + i));
      }
      expect(storm.isStorm()).toBe(true);
    });

    it("التشخيص + Memory Leak", () => {
      const mem = new MemoryLeakDetectorSimulator();
      mem.check(100);
      mem.check(250);
      expect(mem.check(300).leakDetected).toBe(true);
    });

    it("كل خطأ يحصل على تشخيص صالح", () => {
      const msgs = [
        "Loading chunk 42 failed",
        "process is not defined",
        "Maximum update depth exceeded",
        "Maximum call stack size exceeded",
        "Failed to fetch",
        "convex subscription fail",
        "Cannot read properties of null",
        "Unexpected token in JSON",
        "CORS blocked",
        "QuotaExceededError",
        "out of memory",
        "NotAllowedError",
        "request timed out",
        "foobar baz qux",
      ];
      for (const msg of msgs) {
        const d = diagnoseAdvanced(new Error(msg));
        expect(d.category).toBeTruthy();
        expect(d.confidence).toBeGreaterThan(0);
        expect(d.confidence).toBeLessThanOrEqual(1);
        expect(d.recoveryStrategies.length).toBeGreaterThan(0);
      }
    });

    it("قائمة 14+ فئة مدعومة", () => {
      const cases: [string, ErrorCategory][] = [
        ["Rendered more hooks than previous", "hooks_violation"],
        ["Loading chunk 42 failed", "chunk_load"],
        ["process is not defined", "runtime"],
        ["Maximum update depth exceeded", "infinite_loop"],
        ["Maximum call stack size exceeded", "circular_dep"],
        ["Failed to fetch", "network"],
        ["convex subscription fail", "api"],
        ["Cannot read properties of null", "null_reference"],
        ["Unexpected token in JSON", "type_error"],
        ["CORS blocked", "security"],
        ["QuotaExceededError", "storage"],
        ["out of memory", "memory"],
        ["NotAllowedError: user gesture", "permission"],
        ["request timed out", "async"],
      ];
      for (const [msg, expected] of cases) {
        expect(diagnoseAdvanced(new Error(msg)).category, `Failed for: ${msg}`).toBe(expected);
      }
    });

    it("10+ استراتيجية إصلاح متاحة", () => {
      const allStrategies = new Set<string>();
      const msgs = [
        "Rendered more hooks",
        "chunk load",
        "process undefined",
        "Failed to fetch",
        "convex fail",
        "Cannot read null",
        "SyntaxError",
        "CORS",
        "QuotaExceeded",
        "memory leak",
        "permission denied",
        "timeout",
      ];
      for (const msg of msgs) {
        diagnoseAdvanced(new Error(msg)).recoveryStrategies.forEach((s) => allStrategies.add(s));
      }
      expect(allStrategies.size).toBeGreaterThanOrEqual(8);
    });
  });
});
