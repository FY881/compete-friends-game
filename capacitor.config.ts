import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for «تحدّي العقول» (Mind Clash).
 *
 * - The web build (Vite) outputs to `dist/` — Capacitor bundles it into the APK.
 * - `VITE_CONVEX_URL` is baked into the web build at build time, so the app
 *   inside the APK talks to the same Convex backend as the hosted site.
 * - RTL/Arabic is enabled at the Android level (`supportsRtl` is set by
 *   Capacitor automatically from the app locale).
 */
const config: CapacitorConfig = {
  appId: "com.mindclash.quiz",
  appName: "تحدّي العقول",
  webDir: "dist",
  server: {
    // Serve the bundled app over https://localhost inside the WebView.
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#f6faf9",
    allowMixedContent: false,
    // The app is a portrait-first game — keep the WebView stable on rotation.
    initialFocus: true,
  },
  plugins: {
    // Reserve for future native plugins (haptics, sharing, etc.).
  },
};

export default config;
