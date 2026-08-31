import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { StrictMode, useEffect, lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ErrorHunter } from "@/components/ErrorHunter";
import { SplashScreen } from "@/components/SplashScreen";
import "./index.css";
import { lazyRetry } from "@/lib/lazyRetry";

// Lazy load route components with automatic retry on failure
const Landing = lazyRetry(() => import("./pages/Landing.tsx"));
const AuthPage = lazyRetry(() => import("./pages/Auth.tsx"));
const Play = lazyRetry(() => import("./pages/Play.tsx"));
const Game = lazyRetry(() => import("./pages/Game.tsx"));
const Profile = lazyRetry(() => import("./pages/Profile.tsx"));
const Owner = lazyRetry(() => import("./pages/Owner.tsx"));
const Rules = lazyRetry(() => import("./pages/Rules.tsx"));
const Download = lazyRetry(() => import("./pages/Download.tsx"));
const NotFound = lazyRetry(() => import("./pages/NotFound.tsx"));
const MiniGames = lazyRetry(() => import("./pages/MiniGames.tsx"));
const ChatRooms = lazyRetry(() => import("./pages/ChatRooms.tsx"));

// Simple loading fallback for route transitions — all Arabic
function RouteLoading() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">جارٍ التحميل…</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Fire-and-forget: send a runtime error to the owner room automatically. */
function reportRuntimeError(message: string, stack?: string) {
  try {
    const route =
      typeof window !== "undefined" ? window.location.pathname : undefined;
    const url =
      typeof window !== "undefined" ? window.location.href : undefined;
    convex
      .mutation(api.owner.reportClientError, { message, stack, url, route })
      .catch(() => undefined);
  } catch {
    // reporting must never break the app
  }
}

/** Hard guard so runtime errors never leave the app as a blank screen. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "خطأ غير معروف",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[حرب العقول] Root crash:", err);
    reportRuntimeError(err.message || "Unknown", err.stack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-lg rounded-3xl border border-border/80 bg-card p-8 text-center shadow-sm">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-7" />
            </span>
            <h1 className="mt-5 text-xl font-bold">حدث خطأ غير متوقع</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              وقعت مشكلة تقنية أثناء عرض هذه الصفحة. أُبلغت الإدارة تلقائياً
              بالتفاصيل — اضغط «إعادة التحميل» للمتابعة.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="size-4" />
              إعادة التحميل
            </button>
            <details className="mt-5 text-start">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                تفاصيل تقنية (للإدارة)
              </summary>
              <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-[10px] leading-4 text-muted-foreground/90">
                {this.state.message}
                {this.state.stack ? `\n\n${this.state.stack}` : ""}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Global capture: any uncaught error or rejected promise anywhere in the app
// lands in the owner room (deduped) so no failure stays invisible.
window.addEventListener("error", (event) => {
  reportRuntimeError(
    event.message || "Uncaught error",
    event.error instanceof Error ? event.error.stack : undefined,
  );
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (reason instanceof Error) {
    reportRuntimeError(reason.message, reason.stack);
  } else {
    reportRuntimeError(
      typeof reason === "string" && reason ? reason : "Unhandled promise rejection",
    );
  }
});

// Offline-capable app install (PWA). Registered only in production builds so
// it never interferes with the dev/preview server (HMR).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache: "none" — يجلب نسخة sw.js الجديدة دائماً بدون تخزين
    // مؤقت، فتصل إصلاحات التنزيل (منع اعتراض ملفات APK) لكل الأجهزة فوراً.
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(() => {
        // التحديث الفوري للنسخة: عند تفعيل Service Worker جديد، يُعاد تحميل
        // الصفحة تلقائياً بنسخة طازجة من الشبكة — فلا يبقى أحد عالقاً على
        // نسخة قديمة («قشرة» مخزنة) تسبب مشاكل التنزيل. محمي من التكرار
        // اللانهائي بعلامة جلسة: إعادة تحميل واحدة فقط لكل تفعيل.
        if (!sessionStorage.getItem("mindclash.sw-reloaded")) {
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            try {
              sessionStorage.setItem("mindclash.sw-reloaded", "1");
            } catch {
              // ignore
            }
            window.location.reload();
          });
        }
      })
      .catch(() => undefined);
  });
}



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


function AppShell() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  return (
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/play" />}
              />
              <Route
                path="/play"
                element={
                  <RequireAuth>
                    <Play />
                  </RequireAuth>
                }
              />
              <Route
                path="/game/:code"
                element={
                  <RequireAuth>
                    <Game />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route
                path="/owner"
                element={
                  <RequireAuth>
                    <Owner />
                  </RequireAuth>
                }
              />
              <Route path="/rules" element={<Rules />} />
              <Route path="/download" element={<Download />} />
              <Route path="/games" element={<MiniGames />} />
              <Route
                path="/rooms"
                element={
                  <RequireAuth>
                    <ChatRooms />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ErrorHunter>
        <AppShell />
      </ErrorHunter>
    </RootErrorBoundary>
  </StrictMode>,
);
