/**
 * lazyRetry — wraps React.lazy() with automatic retry on failure.
 * When a dynamic import fails (proxy timeout, network hiccup, etc.),
 * it retries up to `retries` times before giving up.
 */
import { lazy, type ComponentType } from "react";

export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000,
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (n: number) => {
        factory()
          .then(resolve)
          .catch((err) => {
            if (n <= 0) {
              reject(err);
              return;
            }
            console.warn(
              `[lazyRetry] Import failed (${retries - n + 1}/${retries}), retrying in ${delay}ms...`,
            );
            setTimeout(() => attempt(n - 1), delay);
          });
      };
      attempt(retries);
    });
  });
}
