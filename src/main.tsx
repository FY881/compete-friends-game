// Polyfill `process` for packages like the Vercel AI SDK that reference
// `process.env` in browser code without a `typeof` guard.
if (typeof window !== "undefined" && typeof process === "undefined") {
  (window as unknown as Record<string, unknown>).process = { env: {} };
}
import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import React, { StrictMode, useEffect, lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ErrorHunter, setErrorHunterClient, startPerformanceMonitor } from "@/components/ErrorHunter";
import { SplashScreen } from "@/components/SplashScreen";
import { PremiumThemeProvider } from "@/components/PremiumThemeProvider";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { initBackendGuard, isBackendDegraded, noteBackendError } from "@/lib/backendGuard";
import "./index.css";

// ── أعلام نسخة البناء (محلية لتُمكّن Rollup من إسقاط كود المالك نهائياً) ──
// Vite يستبدل import.meta.env.* وقت البناء بنص حرفي، فيُسقط البناء مسارات
// غرفة المالك من نسخة اللاعبين (VITE_NO_OWNER=1) ويحوّل نسخة المالك إلى
// بوابة مالك موجهة (VITE_OWNER_APP=1).
const OWNER_APP_MODE = import.meta.env.VITE_OWNER_APP === "1";
const ATLAS_APP_MODE = import.meta.env.VITE_ATLAS_APP === "1";
const OWNER_ROOM_ENABLED = import.meta.env.VITE_NO_OWNER !== "1";
import { lazyRetry } from "@/lib/lazyRetry";

// Lazy load route components with automatic retry on failure
const Landing = lazyRetry(() => import("./pages/Landing.tsx"));
const AuthPage = lazyRetry(() => import("./pages/Auth.tsx"));
const Play = lazyRetry(() => import("./pages/Play.tsx"));
const Game = lazyRetry(() => import("./pages/Game.tsx"));
const Profile = lazyRetry(() => import("./pages/Profile.tsx"));
const Owner = lazyRetry(() => import("./pages/Owner.tsx"));
const OwnerPremiumLogin = lazyRetry(() => import("./components/owner/OwnerPremiumLogin.tsx"));
const Rules = lazyRetry(() => import("./pages/Rules.tsx"));
const Download = lazyRetry(() => import("./pages/Download.tsx"));
const NotFound = lazyRetry(() => import("./pages/NotFound.tsx"));
const Membership = lazyRetry(() => import("./pages/Membership.tsx"));
const MiniGames = lazyRetry(() => import("./pages/MiniGames.tsx"));
const ChatRooms = lazyRetry(() => import("./pages/ChatRooms.tsx"));
const Hub = lazyRetry(() => import("./pages/Hub.tsx"));
const Atlas = lazyRetry(() => import("./pages/Atlas.tsx"));
const AtlasLogin = lazyRetry(() => import("./components/atlas/AtlasLogin.tsx"));
// 🛡 ساحة الأوفلاين — تعمل بلا خادم، فلا تُحاط بـ RequireAuth أبداً.
const Offline = lazyRetry(() => import("./pages/Offline.tsx"));

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

/**
 * 🛡 قاطع دائرة الإبلاغ عن الأخطاء (Error-Report Circuit Breaker)
 *
 * السبب الحقيقي لتعطّل النشر المتكرر: عند تجاوز حصة Convex تُرفض كل
 * الاستعلامات على الخادم، فينتج عن كل رفض خطأ جديد على العميل، وكل خطأ
 * كان يُرسَل كـ mutation — أي حلقة تصعيد تُضاعف الاستهلاك وقت الأزمة بالذات.
 *
 * هذا القاطع يوقف الحلقة نهائياً:
 *  1) لا يُبلَّغ أبداً عن أخطاء الحصة/الحدود — هي ليست أخطاء تطبيق.
 *  2) لا يُبلَّغ عن أخطاء الشبكة/انقطاع الاتصال — ليست أخطاء تطبيق.
 *  3) إزالة التكرار: نفس البصمة تُبلَّغ مرة واحدة فقط في الجلسة.
 *  4) سقف صارم: 10 بلاغات كحد أقصى لكل جلسة، وفاصل 5 ثوانٍ بينها.
 */
const REPORT_DEDUPE = new Set<string>();
let reportsSent = 0;
let lastReportAt = 0;
const MAX_REPORTS_PER_SESSION = 10;
const MIN_REPORT_INTERVAL_MS = 5_000;

/** أخطاء المنصة/الحصة/الشبكة — لا تُبلَّغ ولا تُحتسب كعيوب في اللعبة. */
const NON_APP_ERROR =
  /exceeded the free plan|free plan limits|deployments have been disabled|upgrade to a pro plan|too many requests|rate limit|quota|ECONNRESET|ETIMEDOUT|Failed to fetch|NetworkError|Load failed|dynamically imported module|Importing a module script failed|offline|ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ConvexError:.*Server Error/i;

export function isNonAppError(message: string, stack?: string): boolean {
  return NON_APP_ERROR.test(`${message} ${stack ?? ""}`);
}

/** Fire-and-forget: send a runtime error to the owner room automatically. */
function reportRuntimeError(message: string, stack?: string) {
  try {
    // 🛡 v8.0 — أولاً: إن كان خطأ منصة/حصة، يُفعّل «وضع الاستقرار» فوراً
    // فتُوقف كل الكتابات الاختيارية ولا يتضاعف الاستهلاك أثناء الأزمة.
    if (noteBackendError(message, stack)) {
      console.warn("[حرب العقول] 🛡️ حد المنصة — تم تفعيل وضع الاستقرار تلقائياً");
      return;
    }
    // 1+2) أخطاء الشبكة لا تُبلَّغ — تمنع حلقة "الخطأ يولّد بلاغاً يولّد خطأً"
    if (isNonAppError(message, stack)) {
      console.warn("[حرب العقول] خطأ منصة/شبكة — لم يُبلَّغ عنه:", message.slice(0, 120));
      return;
    }
    // 3) وضع الاستقرار = لا بلاغات إطلاقاً حتى يعود الخادم
    if (isBackendDegraded()) return;
    // 4) سقف صارم لكل جلسة + فاصل زمني
    if (reportsSent >= MAX_REPORTS_PER_SESSION) return;
    const now = Date.now();
    if (now - lastReportAt < MIN_REPORT_INTERVAL_MS) return;
    // 3) إزالة التكرار بالبصمة
    const fingerprint = `${message.slice(0, 160)}|${(stack ?? "").slice(0, 120)}`;
    if (REPORT_DEDUPE.has(fingerprint)) return;
    REPORT_DEDUPE.add(fingerprint);
    reportsSent += 1;
    lastReportAt = now;

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
              onClick={() => {
                try { localStorage.clear(); sessionStorage.clear(); } catch { /* ok */ }
                window.location.href = "/";
              }}
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

// ── Error Hunter: initialize client + start performance monitor ──
setErrorHunterClient(convex);
startPerformanceMonitor();

// 🛡 حارس الخلفية: نبضة استفسار رخيصة (بلا أي قراءة قاعدة بيانات) تُستخدم
// فقط عند تعطّل الخادم لمعرفة لحظة تعافيه، فيعود النظام تلقائياً بلا تدخل.
initBackendGuard(() => convex.query(api.health.ping, {}));

// Global capture: any uncaught error or rejected promise anywhere in the app
// lands in the error hunter (deduped) so no failure stays invisible.
// v7.2: third-party noise (platform toolbar snapshot libs like html2canvas-pro
// loaded from CDNs) must never take down the session — classify + contain.
const THIRD_PARTY_NOISE = /html2canvas|snapdom|vly-toolbar|daytonaproxy|cdn\.jsdelivr/i;
function isThirdPartyNoise(message: string, stack?: string) {
  const combined = `${message} ${stack ?? ""}`;
  return THIRD_PARTY_NOISE.test(combined);
}

window.addEventListener("error", (event) => {
  const message = event.message || "Uncaught error";
  const stack = event.error instanceof Error ? event.error.stack : undefined;
  if (isThirdPartyNoise(message, stack) || THIRD_PARTY_NOISE.test(event.filename ?? "")) {
    // سجّل كأثر فقط — لا تكسر الجلسة ولا تعرض شاشة خطأ لخطأ ليس من كودنا
    console.warn("[ErrorHunter v7.2] third-party noise contained:", message.slice(0, 120));
    return;
  }
  reportRuntimeError(message, stack);
}, true);
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled promise rejection";
  const stack = reason instanceof Error ? reason.stack : undefined;
  if (isThirdPartyNoise(msg, stack)) {
    console.warn("[ErrorHunter v7.2] third-party rejection contained:", msg.slice(0, 120));
    return;
  }
  if (reason instanceof Error) {
    reportRuntimeError(reason.message, reason.stack);
  } else {
    reportRuntimeError(msg);
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
      .then(async (reg: ServiceWorkerRegistration | undefined) => {
        // 🔔 اشتراك Push الحقيقي: بعد تفعيل SW وطلب إذن الإشعارات،
        // نحاول الاشتراك بقناة Push (يعمل مع أي خادم push لاحقاً).
        if (reg && typeof Notification !== "undefined") {
          if (Notification.permission === "default") {
            // طلب الإذن عند أول تفاعل من المستخدم — بلا نوافذ مزعجة
            const ask = () => {
              Notification.requestPermission().catch(() => {});
              window.removeEventListener("pointerdown", ask);
            };
            window.addEventListener("pointerdown", ask, { once: true });
          }
          if (Notification.permission === "granted" && "pushManager" in reg) {
            const existing = await reg.pushManager.getSubscription().catch(() => undefined);
            if (!existing) {
              await reg.pushManager
                .subscribe({ userVisibleOnly: true })
                .catch(() => undefined);
            }
          }
        }
        // التحديث الفوري للنسخة: عند تفعيل Service Worker جديد، يُعاد تحميل
        // التحديث الفوري للنسخة: عند تفعيل Service Worker جديد، يُعاد تحميل
        // الصفحة تلقائياً بنسخة طازجة من الشبكة — فلا يبقى أحد عالقاً على
        // نسخة قديمة («قشرة» مخزنة) تسبب مشاكل التنزيل. محمي من التكرار
        // اللانهائي بعلامة جلسة: إعادة تحميل واحدة فقط لكل تفعيل.
        // Protect against infinite reload loops: only reload once per 60 seconds
        if (!sessionStorage.getItem("mindclash.sw-reloaded")) {
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            const now = Date.now();
            const lastReload = parseInt(sessionStorage.getItem("mindclash.sw-last-reload") || "0", 10);
            // Skip if we reloaded less than 60 seconds ago (prevents infinite loops)
            if (now - lastReload < 60000) return;
            try {
              sessionStorage.setItem("mindclash.sw-reloaded", "1");
              sessionStorage.setItem("mindclash.sw-last-reload", String(now));
            } catch { /* ignore */ }
            window.location.reload();
          });
        }
      })
      .catch(() => undefined);
  });
}



/**
 * بوابة تطبيق المالك المستقل (نسخة APK المنفصلة):
 * الصفحة الرئيسية فيه توجّه دائماً إلى تجربة المالك — حساب ←
 * تسجيل دخول المالك (Premium) ← لوحة التحكم الكاملة.
 */
function OwnerAppHome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    navigate(
      isAuthenticated ? "/owner-login" : "/auth?returnTo=/owner-login",
      { replace: true },
    );
  }, [isAuthenticated, isLoading, navigate]);

  return <RouteLoading />;
}

/**
 * بوابة تطبيق أطلس كنترول المستقل (نسخة APK المنفصلة):
 * الصفحة الرئيسية توجّه دائماً إلى تجربة أطلس — حساب ← بوابة أطلس ←
 * لوحة السيطرة الكاملة على اللعبة.
 */
function AtlasAppHome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    navigate(
      isAuthenticated ? "/atlas-login" : "/auth?returnTo=/atlas-login",
      { replace: true },
    );
  }, [isAuthenticated, isLoading, navigate]);

  return <RouteLoading />;
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
      <PremiumThemeProvider>
        <BackendStatusBanner />
      <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route
                path="/"
                element={ATLAS_APP_MODE ? <AtlasAppHome /> : OWNER_APP_MODE ? <OwnerAppHome /> : <Landing />}
              />
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
              {OWNER_ROOM_ENABLED && (
                <>
                  <Route
                    path="/owner-login"
                    element={<OwnerPremiumLogin />}
                  />
                  <Route
                    path="/owner"
                    element={
                      <RequireAuth>
                        <Owner />
                      </RequireAuth>
                    }
                  />
                </>
              )}
              <Route
                path="/atlas-login"
                element={<AtlasLogin />}
              />
              <Route
                path="/atlas"
                element={
                  <RequireAuth>
                    <Atlas />
                  </RequireAuth>
                }
              />
              {/* مسار العضويات 4.0: يحتاج مصادقة (يقرأ عضويتك ورصيدك ورتبك) */}
              <Route
                path="/membership"
                element={
                  <RequireAuth>
                    <Membership />
                  </RequireAuth>
                }
              />
              <Route path="/rules" element={<Rules />} />
              {/* مسار مفتوح دائماً بلا مصادقة: يبقى اللعب متاحاً ولو تعطّل الخادم */}
              <Route path="/offline" element={<Offline />} />
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
              <Route
                path="/hub"
                element={
                  <RequireAuth>
                    <Hub />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PremiumThemeProvider>
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
