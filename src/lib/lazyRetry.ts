/**
 * lazyRetry — wraps React.lazy() with aggressive retry on failure.
 * When a dynamic import fails (chunk_load, proxy timeout, etc.), it retries
 * with exponential backoff to handle stale caches and network hiccups.
 */
import { lazy, type ComponentType } from "react";

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
          .catch((err) => {
            if (remaining <= 0) {
              // Final failure — try clearing the cache before giving up
              console.error("[lazyRetry] All retries exhausted, giving up.", err);
              reject(err);
              return;
            }
            // Exponential backoff: 500ms, 1000ms, 2000ms, 4000ms
            const delay = baseDelay * Math.pow(2, retries - remaining);
            const attemptNum = retries - remaining + 1;
            console.warn(
              `[lazyRetry] Import failed (attempt ${attemptNum}/${retries}), retrying in ${delay}ms...`,
            );
            setTimeout(() => attempt(remaining - 1), delay);
          });
      };
      attempt(retries);
    });
  });
}
