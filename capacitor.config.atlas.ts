import type { CapacitorConfig } from "@capacitor/cli";

/**
 * أطلس كنترول — تطبيق التحكم المستقل بلعبة «حرب العقول».
 *
 * - appId مختلف تماماً عن اللعبة (com.mindclash.atlas) — يُثبَّت بجانبها
 *   بلا أي تعارض، ولا يحتوي أي جزء من واجهة اللاعبين.
 * - الاسم الظاهر: «أطلس كنترول» — هوية بريميوم تعكس السيطرة الكاملة.
 * - نفس الكود لكن بوابته تفتح على تجربة أطلس مباشرة (VITE_OWNER_APP=1).
 */
const config: CapacitorConfig = {
  appId: "com.mindclash.atlas",
  appName: "أطلس كنترول",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#070b16",
    allowMixedContent: false,
    initialFocus: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#070b16",
      showSpinner: true,
      spinnerColor: "#8b7cf6",
    },
  },
};

export default config;
