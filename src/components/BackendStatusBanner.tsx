import { useEffect, useState, useSyncExternalStore } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { isBackendDegraded, subscribeBackendState } from "@/lib/backendGuard";

/**
 * 🛡 شريط وضع الاستقرار — يظهر فقط حين يتعطّل الخادم (حصة/انقطاع).
 *
 * بدلاً من شاشة خطأ مرعبة، يرى اللاعب رسالة هادئة تُطمئنه: النظام يحمي
 * نفسه، وسيعود تلقائياً بلا أي إجراء. الواجهة تبقى قابلة للاستخدام،
 * ودورة الاستفسار عن التعافي تعمل في الخلفية بهدوء.
 */
export function BackendStatusBanner() {
  const degraded = useSyncExternalStore(
    subscribeBackendState,
    isBackendDegraded,
    () => false,
  );
  const [probing, setProbing] = useState(false);

  // مؤشر بصري بسيط: يتغيّر مرة كل ثانيتين أثناء الانتظار (بلا أي استدعاء خادم)
  useEffect(() => {
    if (!degraded) return;
    const t = window.setInterval(() => setProbing((v) => !v), 2000);
    return () => window.clearInterval(t);
  }, [degraded]);

  if (!degraded) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[12px] font-semibold text-amber-800 backdrop-blur-md dark:text-amber-200"
    >
      <ShieldCheck className="size-4 shrink-0" />
      <span>
        وضع الاستقرار نشط — أوقفنا كل العمليات الخلفية لحماية النظام من الإجهاد، وسيعود تلقائياً عند تعافي الخادم.
      </span>
      <Loader2
        className={`size-3.5 shrink-0 transition-opacity ${probing ? "opacity-100" : "opacity-30"}`}
      />
    </div>
  );
}
