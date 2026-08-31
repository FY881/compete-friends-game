import type { CapacitorConfig } from "@capacitor/cli";

/**
 * إعدادات تطبيق المالك المستقل (APK منفصل).
 *
 * - appId مختلف عن اللعبة الرئيسية (com.mindclash.owner)
 * - appName "حرب العقول — لوحة التحكم" — اسم واضح للمالك
 * - نفس الكود لكن بوابته تفتح على /owner مباشرة
 */
const config: CapacitorConfig = {
  appId: "com.mindclash.owner",
  appName: "حرب العقول — لوحة التحكم",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
    url: "https://quaint-ptarmigan-843.convex.site", // redirect to the same web app
  },
  android: {
    backgroundColor: "#0a0e1a",
    allowMixedContent: false,
    initialFocus: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0a0e1a",
      showSpinner: true,
      spinnerColor: "#fbbf24",
    },
  },
};

export default config;
