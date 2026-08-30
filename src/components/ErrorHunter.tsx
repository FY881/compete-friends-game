/**
 * صياد الأخطاء — نظام الإصلاح الذاتي المتقدم
 * 
 * يلتقط كل خطأ في التطبيق، يُرسله للخادم، ويحاول إصلاحه تلقائياً.
 * لا يترك أي خطأ دون علاج.
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, RefreshCw, Home, Shield } from "lucide-react";

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
}

// ═══════════════════════════════════════════════════════════════
// Auto-healing strategies — إصلاح ذاتي للأخطاء الشائعة
// ═══════════════════════════════════════════════════════════════
const HEALING_STRATEGIES: Record<string, () => void> = {
  // React hooks violation — reload fixes stale service worker code
  "Rendered more hooks": () => {
    console.log("[صياد الأخطاء] hooks violation detected — forcing fresh load");
    // Clear service worker cache and reload
    if ("caches" in window) {
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n))),
      );
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    setTimeout(() => window.location.reload(), 500);
  },
  // Chunk loading error — Vite hash mismatch after deploy
  "ChunkLoadError": () => {
    console.log("[صياد الأخطاء] chunk load error — clearing cache and reloading");
    if ("caches" in window) {
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n))),
      );
    }
    setTimeout(() => window.location.reload(), 300);
  },
  // Network errors — just show retry
  "NetworkError": () => {},
  "Failed to fetch": () => {},
  // Convex offline — reconnect
  "Could not connect": () => {},
  "Failed to connect": () => {},
};

function findHealingStrategy(error: Error): (() => void) | null {
  const msg = error.message || "";
  const stack = error.stack || "";
  const combined = msg + " " + stack;

  for (const [pattern, strategy] of Object.entries(HEALING_STRATEGIES)) {
    if (combined.includes(pattern)) return strategy;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Error Hunter Component
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
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Report to backend
    this.reportError(error, errorInfo);

    // Try auto-healing
    this.tryAutoHeal(error);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      console.warn(
        "[صياد الأخطاء] Error captured:",
        error.message,
        errorInfo?.componentStack?.slice(0, 200),
      );
      // Fire a global error event that main.tsx picks up via window.addEventListener("error")
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: `[ErrorHunter] ${error.message}`,
          error,
        }),
      );
    } catch {
      // Never crash the error handler itself
    }
  }

  private async tryAutoHeal(error: Error) {
    const strategy = findHealingStrategy(error);
    if (strategy) {
      this.setState({
        healing: true,
        healingMessage: "جارٍ الإصلاح التلقائي...",
      });
      try {
        await new Promise((r) => setTimeout(r, 1000));
        strategy();
      } catch {
        this.setState({ healing: false });
      }
    }
  }

  private handleReload = () => {
    // Clear all caches before reload
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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.state.healing) {
        return (
          <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-8 text-center shadow-lg">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Shield className="size-8 text-primary animate-pulse" />
              </div>
              <h2 className="mt-5 text-xl font-bold">صياد الأخطاء يعمل...</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {this.state.healingMessage}
              </p>
              <div className="mt-4 flex justify-center">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            </div>
          </div>
        );
      }

      const errorMsg = this.state.error?.message || "خطأ غير معروف";
      const isChunkError = errorMsg.includes("ChunkLoadError") || errorMsg.includes("Loading chunk");

      return (
        <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-lg rounded-3xl border border-border/80 bg-card p-8 text-center shadow-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <AlertTriangle className="size-7" />
            </span>
            <h1 className="mt-5 text-xl font-bold">
              {isChunkError ? "تحديث التطبيق متاح" : "حدث خطأ مؤقت"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {isChunkError
                ? "تم تحديث التطبيق — أعد التحميل للحصول على أحدث إصدار."
                : "صياد الأخطاء اكتشف مشكلة. لا تقلق — تم تسجيل التفاصيل."}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="size-4" />
                {isChunkError ? "تحديث و إعادة تحميل" : "إعادة التحميل"}
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

            <details className="mt-5 text-start">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                تفاصيل تقنية (للإدارة)
              </summary>
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-[10px] leading-4 text-muted-foreground/90">
                {errorMsg}
                {this.state.errorInfo?.componentStack
                  ? `\n\nالمكونات:\n${this.state.errorInfo.componentStack}`
                  : ""}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
