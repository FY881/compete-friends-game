import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isBackendDegraded, subscribeBackendState } from "@/lib/backendGuard";
import { Loader2, ShieldAlert, RefreshCw, Home, CloudOff } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";

/**
 * RequireAuth — مُعامِل المصادقة المُحسَّن.
 *
 * التحسينات:
 * 1. لا يُعيد التوجيه أثناء إعادة الاتصال بـ Convex (مؤقت فقط)
 * 2. يحفظ المسار حتى بعد إعادة التحميل
 * 3. يمنع إغلاق اللعبة أثناء اللعب بسبب انقطاع مؤقت
 * 4. يوجّه فقط بعد انتظار كافٍ للتأكد من فقدان المصادقة فعلياً
 *
 * 🛡 v8.0 — لم يعد يعلّق للأبد:
 * كان ينتظر المصادقة إلى ما لا نهاية، فإذا كان الخادم معطّلاً (حصة/انقطاع)
 * بقي اللاعب أمام سبينر صامت بلا أي تفسير. الآن: إما أن تُحلّ المصادقة، أو
 * تظهر شاشة واضحة تشرح السبب وتُتيح إعادة المحاولة والعودة للرئيسية.
 */

/** أقصى انتظار للمصادقة قبل إظهار شاشة «تعذّر الاتصال» بدل السبينر الأبدي */
const BACKEND_WAIT_MS = 8_000;

function CheckingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </main>
  );
}

/** شاشة «الخادم غير متاح» — واضحة، هادئة، وفيها مخرج دائماً. */
function BackendUnavailableScreen({ returnTo }: { returnTo: string }) {
  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="mt-5 text-xl font-bold">تعذّر الاتصال بخادم اللعبة</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          الخادم غير متاح حالياً، لذلك لا يمكن التحقق من حسابك. لا تفقد أي شيء —
          بياناتك محفوظة، وستعود اللعبة للعمل تلقائياً بمجرد تعافي الخادم.
        </p>

        <div className="mt-6 space-y-2">
          {/* 🛡 المخرج الحقيقي: ساحة أوفلاين لا تحتاج خادماً إطلاقاً */}
          <Button className="w-full gap-2" asChild>
            <Link to="/offline">
              <CloudOff className="size-4" />
              العب الآن بلا إنترنت (٣٦٠ سؤالاً)
            </Link>
          </Button>
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="size-4" />
            إعادة المحاولة
          </Button>
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link to="/">
              <Home className="size-4" />
              العودة للصفحة الرئيسية
            </Link>
          </Button>
        </div>

        <p className="mt-5 rounded-xl bg-muted/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          مسارك محفوظ: <span className="font-mono">{returnTo || "/"}</span>
          <br />
          يُفتح تلقائياً بعد إعادة المحاولة.
        </p>
      </div>
    </main>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // حالة الخلفية: إن كانت في وضع الاستقرار فلا فائدة من الانتظار الطويل
  const degraded = useSyncExternalStore(
    subscribeBackendState,
    isBackendDegraded,
    () => false,
  );

  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setWaitedTooLong(false);
      return;
    }
    const t = window.setTimeout(() => setWaitedTooLong(true), BACKEND_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  const returnTo = `${location.pathname}${location.search}`;

  if (isLoading) {
    // 🛡 خادم معطّل أو انتظار طويل = شاشة واضحة بدل سبينر أبدي
    if (degraded || waitedTooLong) {
      return <BackendUnavailableScreen returnTo={returnTo} />;
    }
    return <CheckingScreen label="جارٍ التحقق من الهوية…" />;
  }

  if (!isAuthenticated) {
    // داخل غرفة لعب: لا نُخرج اللاعب بسبب انقطاع مؤقت
    const isGameRoom = location.pathname.startsWith("/game/");
    if (isGameRoom) {
      if (degraded) return <BackendUnavailableScreen returnTo={returnTo} />;
      return <CheckingScreen label="جارٍ إعادة الاتصال… لا تغادر الصفحة" />;
    }

    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
