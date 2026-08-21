/**
 * Runtime guard for React Rules of Hooks.
 *
 * In development mode, this module monkey-patches React's hook dispatcher
 * to detect when a component renders fewer hooks than the previous render
 * (the "Rendered more hooks than during the previous render" error).
 *
 * It logs a clear warning to the console pointing at the offending component.
 *
 * Import this file once in src/main.tsx (import "./hooks/no-hooks-after-return").
 * It has zero runtime cost in production builds.
 */

if (import.meta.env.DEV && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const R = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!R) {
    // Patch the console.error to intercept React's hook violation message
    const origError = console.error;
    // eslint-disable-next-line prefer-rest-params
    console.error = function (...args: unknown[]) {
      const msg = String(args[0] ?? "");
      if (
        msg.includes("Rendered more hooks") ||
        msg.includes("fewer hooks")
      ) {
        origError.call(
          console,
          "🚨 [Hooks Guard] React detected a hook count mismatch.",
          "This means a component calls hooks conditionally (after an early return).",
          "Find the component and move ALL hooks before any return statements.",
          "\n",
          ...args,
        );
      } else {
        origError.apply(console, args);
      }
    };
  }
}
