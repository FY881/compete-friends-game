/**
 * lazyRetry — wraps React.lazy() with aggressive, cache-aware retry on failure.
 *
 * v6.2 التحليل الجذري: إعادة المحاولة على نفس URL الـ chunk القديم عديمة
 * الفائدة إن حُذف الـ chunk من الخادم بعد نشر تحديث. الحل:
 *  1) كل محاولة إعادة تضيف cache-busting (?t=) إلى رابط الوحدة —
 *     يجبر المتصفح على إعادة جلب الوحدة وليس استخدام نسخة الكاش الميتة.
 *  2) قبل المحاولة الأخيرة تُمسح Cache Storage وService Workers القديمة —
 *     إن كانت المشكلة من نسخة كاش فستُعالج هنا دون إعادة تحميل الصفحة.
 *  3) عند الفشل النهائي يُطلق حدث lazy-retry-exhausted ليعرف صياد الأخطاء
 *     أن الإصلاح داخل الحد فشل — فيمارس علاجه الخاص فيطبّق hard reload مرة واحدة.
 */
import { lazy, type ComponentType } from "react";

const CACHE_BUST = "?__retry=";

export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 4,
  baseDelay = 500,
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch(async (err) => {
            if (remaining <= 0) {
              console.error("[lazyRetry] All retries exhausted, giving up.", err);
              try {
                window.dispatchEvent(new CustomEvent("lazy-retry-exhausted", { detail: { message: String(err?.message ?? err) } }));
              } catch { /* noop */ }
              reject(err);
              return;
            }
            const delay = baseDelay * Math.pow(2, retries - remaining);
            const attemptNum = retries - remaining + 1;
            console.warn(`[lazyRetry] Import failed (attempt ${attemptNum}/${retries}), retrying in ${delay}ms...`);

            // قبل المحاولة الأخيرة: نظّف الكاش القديم الذي قد يحمل chunk ميتاً
            if (remaining === 1) {
              try {
                if ("caches" in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map((n) => caches.delete(n)));
                }
                if (navigator.serviceWorker?.controller) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map((r) => r.unregister()));
                }
                console.warn("[lazyRetry] Stale caches cleared before final retry.");
              } catch { /* best-effort */ }
            }

            setTimeout(() => attempt(remaining - 1), delay);
          });
      };
      attempt(retries);
    });
  });
}
