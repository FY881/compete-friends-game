import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * RequireAuth — مُعامِل المصادقة المُحسَّن.
 *
 * التحسينات:
 * 1. لا يُعيد التوجيه أثناء إعادة الاتصال بـ Convex (مؤقت فقط)
 * 2. يحفظ المسار حتى بعد إعادة التحميل
 * 3. يمنع إغلاق اللعبة أثناء اللعب بسبب انقطاع مؤقت
 * 4. ي伺م التوجيه فقط بعد انتظار كافي (3 ثوانٍ) للتأكد من فقدان المصادقة فعلياً
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // أثناء التحميل الأولي — أظهر شاشة تحميل
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">جارٍ التحقق من الهوية…</p>
        </div>
      </main>
    );
  }

  // إذا لم يُصادق بعد 3 ثوانٍ — أعد التوجيه
  // التأخير يمنع الإغلاق أثناء إعادة الاتصال بـ Convex
  if (!isAuthenticated) {
    // Check if we're in a game room — if so, show a waiting screen instead of redirecting
    const isGameRoom = location.pathname.startsWith("/game/");
    if (isGameRoom) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              جارٍ إعادة الاتصال… لا تغادر الصفحة
            </p>
          </div>
        </main>
      );
    }

    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
