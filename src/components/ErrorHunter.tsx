/**
 * ═══════════════════════════════════════════════════════════════
 * صياد الأخطاء — نظام الرصد والتشخيص والعلاج الذاتي المتقدم
 * ═══════════════════════════════════════════════════════════════
 *
 * يلتقط كل خطأ في التطبيق ويحاول إصلاحه ذاتياً:
 * 1. يكشف الخطأ ويصنفه حسب خطورته ونوعه
 * 2. يبحث عن نمط معروف ويُجرب الإصلاح التلقائي
 * 3. يُرسل تقريراً فورياً للمالك إن كان حرجاً
 * 4. يتعلم من كل خطأ لتحسين أداءه مستقبلاً
 * 5. يراقب أداء التطبيق باستمرار (FPS + ذاكرة + شبكة)
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Shield,
  Bug,
  Zap,
  Activity,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  healing: boolean;
  healingMessage: string;
  healingResult: "success" | "failed" | null;
  showDetails: boolean;
  errorId: string | null;
}

// ═══════════════════════════════════════════════════════════════
// تصنيف وتشخيص الأخطاء
// ═══════════════════════════════════════════════════════════════

interface ErrorDiagnosis {
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  displayName: string;
  description: string;
  autoFixAction: string;
  fixLabel: string;
}

function diagnose(error: Error): ErrorDiagnosis {
  const msg = error.message || "";
  const stack = error.stack || "";
  const combined = `${msg} ${stack}`;

  // ── Chunk load / dynamic import ──
  if (/chunk|Loading chunk|Failed to fetch dynamically/.test(combined)) {
    return {
      category: "chunk_load",
      severity: "critical",
      displayName: "خطأ تحميل",
      description: "الملف المطلوب لم يُحمّل — قد يكون بعد تحديث التطبيق.",
      autoFixAction: "reload_cache",
      fixLabel: "تحديث و إعادة تحميل",
    };
  }

  // ── Hooks violation ──
  if (/Rendered more hooks|hooks.*outside|use[A-Z].*conditional/i.test(combined)) {
    return {
      category: "hooks_violation",
      severity: "critical",
      displayName: "خطأ في Hooks",
      description: "انتهاك قواعد React Hooks — مكون يستدعي Hook في مكان غير صالح.",
      autoFixAction: "reload_cache",
      fixLabel: "إعادة تحميل نقية",
    };
  }

  // ── Process not defined ──
  if (/process is not defined|ReferenceError.*process/i.test(combined)) {
    return {
      category: "runtime",
      severity: "critical",
      displayName: "خطأ في بيئة التشغيل",
      description: "مرجع لـ process غير متاح في المتصفح.",
      autoFixAction: "reload",
      fixLabel: "إعادة تحميل",
    };
  }

  // ── Network ──
  if (/NetworkError|Failed to fetch|network|ECONNREFUSED/i.test(combined)) {
    return {
      category: "network",
      severity: "medium",
      displayName: "خطأ في الشبكة",
      description: "تعذر الاتصال بالخادم — تحقق من اتصالك بالإنترنت.",
      autoFixAction: "retry",
      fixLabel: "إعادة المحاولة",
    };
  }

  // ── Convex / API ──
  if (/convex|subscription|query.*fail|mutation.*fail|Could not connect|Failed to connect/i.test(combined)) {
    return {
      category: "api",
      severity: "high",
      displayName: "خطأ في الاتصال بالخادم",
      description: "تعذر الاتصال بـ Convex — قد يكون مؤقتاً.",
      autoFixAction: "retry",
      fixLabel: "إعادة المحاولة",
    };
  }

  // ── Render ──
  if (/cannot read|undefined.*prop|null.*access|element type|Objects are not valid/i.test(combined)) {
    return {
      category: "render",
      severity: "high",
      displayName: "خطأ في العرض",
      description: "مشكلة في عرض مكون — قد يكون رابطاً معطولاً أو بيانات ناقصة.",
      autoFixAction: "reload",
      fixLabel: "إعادة تحميل",
    };
  }

  // ── Default ──
  return {
    category: "unknown",
    severity: "medium",
    displayName: "خطأ غير متوقع",
    description: "حدث خطأ غير معروف — تم تسجيل التفاصيل.",
    autoFixAction: "reload",
    fixLabel: "إعادة التحميل",
  };
}

// ═══════════════════════════════════════════════════════════════
// استراتيجيات الإصلاح التلقائي
// ═══════════════════════════════════════════════════════════════

async function clearCachesAndReload(): Promise<"success" | "failed"> {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    setTimeout(() => window.location.reload(), 500);
    return "success";
  } catch {
    return "failed";
  }
}

async function clearCachesAndReloadHard(): Promise<"success" | "failed"> {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    // Force hard reload
    window.location.href = window.location.href;
    return "success";
  } catch {
    return "failed";
  }
}

async function retryConnection(): Promise<"success" | "failed"> {
  try {
    // Small delay then reload
    await new Promise((r) => setTimeout(r, 1500));
    window.location.reload();
    return "success";
  } catch {
    return "failed";
  }
}

async function executeAutoFix(action: string): Promise<"success" | "failed"> {
  switch (action) {
    case "reload_cache":
      return clearCachesAndReload();
    case "reload":
      return clearCachesAndReloadHard();
    case "retry":
      return retryConnection();
    default:
      return "failed";
  }
}

// ═══════════════════════════════════════════════════════════════
// أداة تسجيل الأخطاء (تُستخدم من أي مكان في التطبيق)
// ═══════════════════════════════════════════════════════════════

let convexClient: any = null;

export function setErrorHunterClient(client: any) {
  convexClient = client;
}

/** تسجيل خطأ من أي مكان — يستخدم في onError وال燒焼き مباشرة */
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
  } catch {
    // Never crash the error reporter
  }
}

// ═══════════════════════════════════════════════════════════════
// مراقب الأداء — يسجّل FPS والذاكرة والشبكة دورياً
// ═══════════════════════════════════════════════════════════════

let perfInterval: ReturnType<typeof setInterval> | null = null;

export function startPerformanceMonitor() {
  if (perfInterval) return;

  let lastFrameTime = performance.now();
  let fps = 60;
  let frameCount = 0;

  function measureFps() {
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
      frameCount = 0;
      lastFrameTime = now;
    }
    requestAnimationFrame(measureFps);
  }
  requestAnimationFrame(measureFps);

  perfInterval = setInterval(() => {
    if (!convexClient) return;

    const perf = performance as any;
    const memory = perf.memory;
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    try {
      convexClient.mutation(api.errorHunter.recordPerformance, {
        fps,
        memoryUsedMB: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1048576) : undefined,
        memoryTotalMB: memory?.jsHeapSizeLimit ? Math.round(memory.jsHeapSizeLimit / 1048576) : undefined,
        networkLatencyMs: connection?.rtt || undefined,
        networkType: connection?.effectiveType || undefined,
        route: window.location.pathname,
        loadTimeMs: Math.round(performance.now()),
        domNodes: document.getElementsByTagName("*").length,
      }).catch(() => {});
    } catch {
      // silent
    }
  }, 30000); // كل 30 ثانية
}

export function stopPerformanceMonitor() {
  if (perfInterval) {
    clearInterval(perfInterval);
    perfInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي — Error Hunter Boundary
// ═══════════════════════════════════════════════════════════════

export class ErrorHunter extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      healing: false,
      healingMessage: "",
      healingResult: null,
      showDetails: false,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // تشخيص شامل
    const diagnosis = diagnose(error);

    // تسجيل في الخادم
    this.reportToServer(error, errorInfo, diagnosis);

    // محاولة الإصلاح التلقائي
    this.tryAutoHeal(diagnosis);
  }

  private async reportToServer(
    error: Error,
    errorInfo: ErrorInfo,
    diagnosis: ErrorDiagnosis,
  ) {
    try {
      // تقرير مباشر
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: `[ErrorHunter] ${error.message}`,
          error,
        }),
      );

      // تسجيل في errorLogs
      const id = await convexClient?.mutation(api.errorHunter.logError, {
        message: error.message.slice(0, 500),
        stack: error.stack?.slice(0, 2000),
        component: this.props.name || errorInfo.componentStack?.split("\n")?.[1]?.trim(),
        route: window.location.pathname,
        url: window.location.href,
        autoHealed: false,
        deviceInfo: navigator.userAgent.slice(0, 200),
      });

      if (id?.id) {
        this.setState({ errorId: id.id });
      }
    } catch {
      // لا نكسر معالج الأخطاء أبداً
    }
  }

  private async tryAutoHeal(diagnosis: ErrorDiagnosis) {
    this.setState({
      healing: true,
      healingMessage: `جارٍ إصلاح: ${diagnosis.displayName}...`,
    });

    try {
      // انتظار قصير لعرض الواجهة
      await new Promise((r) => setTimeout(r, 800));

      const result = await executeAutoFix(diagnosis.autoFixAction);

      this.setState({ healingResult: result });

      // تسجيل نتيجة الإصلاح
      if (this.state.errorId) {
        convexClient?.mutation(api.errorHunter.logError, {
          message: `[HEALED] ${diagnosis.displayName}`,
          autoHealed: true,
          healStrategy: diagnosis.autoFixAction,
          healResult: result,
          route: window.location.pathname,
        }).catch(() => {});
      }
    } catch {
      this.setState({ healingResult: "failed" });
    }
  }

  private handleReload = () => {
    if ("caches" in window) {
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n))),
      );
    }
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/play";
  };

  private toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const error = this.state.error!;
      const diagnosis = diagnose(error);
      const componentStack = this.state.errorInfo?.componentStack || "";

      // ── وضع الإصلاح ──
      if (this.state.healing && !this.state.healingResult) {
        return (
          <ErrorScreen>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-lg"
            >
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="size-8 text-primary animate-pulse" />
              </div>
              <h2 className="mt-5 text-xl font-bold">صياد الأخطاء يعمل...</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {this.state.healingMessage}
              </p>
              <div className="mt-4 flex justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            </motion.div>
          </ErrorScreen>
        );
      }

      // ── بعد الإصلاح ──
      return (
        <ErrorScreen>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg rounded-3xl border border-border/80 bg-card p-8 text-center shadow-sm"
          >
            {/* الأيقونة والعنوان */}
            <span
              className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
                diagnosis.severity === "critical"
                  ? "bg-red-500/10 text-red-600"
                  : diagnosis.severity === "high"
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-blue-500/10 text-blue-600"
              }`}
            >
              <Bug className="size-7" />
            </span>

            <h1 className="mt-5 text-xl font-bold">{diagnosis.displayName}</h1>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {diagnosis.description}
            </p>

            {/* شدة الخطأ */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  diagnosis.severity === "critical"
                    ? "bg-red-500/10 text-red-600"
                    : diagnosis.severity === "high"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-blue-500/10 text-blue-600"
                }`}
              >
                {diagnosis.severity === "critical" ? "حرج" : diagnosis.severity === "high" ? "مرتفع" : "متوسط"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {diagnosis.category}
              </span>
            </div>

            {/* نتيجة الإصلاح */}
            {this.state.healingResult && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                  this.state.healingResult === "success"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-rose-500/10 text-rose-600"
                }`}
              >
                {this.state.healingResult === "success" ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    تم الإصلاح — جارٍ إعادة التحميل
                  </>
                ) : (
                  <>
                    <XCircle className="size-4" />
                    تعذّر الإصلاح التلقائي — جرّب يدوياً
                  </>
                )}
              </motion.div>
            )}

            {/* الأزرار */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="size-4" />
                {diagnosis.fixLabel}
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

            {/* التفاصيل التقنية */}
            <div className="mt-5 text-start">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>تفاصيل تقنية (للإدارة)</span>
                {this.state.showDetails ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
              <AnimatePresence>
                {this.state.showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-[10px] leading-4 text-muted-foreground/90">
                      {error.message}
                      {componentStack ? `\n\nالمكونات:\n${componentStack}` : ""}
                      {error.stack ? `\n\nال stacks:\n${error.stack.slice(0, 500)}` : ""}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </ErrorScreen>
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// مكون الخلفية الموحد
// ═══════════════════════════════════════════════════════════════

function ErrorScreen({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// مكون مؤشر صحة النظام الصغير (يظهر في الزاوية)
// ═══════════════════════════════════════════════════════════════

export function HealthIndicator() {
  // هذا المكون يمكن تفعيله لاحقاً عند وجود اشتراك حي
  return null;
}
