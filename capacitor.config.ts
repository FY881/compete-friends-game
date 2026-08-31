import type { CapacitorConfig } from "@capacitor/cli";

/**
 * إعدادات تطبيق أندرويد (Capacitor).
 *
 * - appId ثابتة (com.mindclash.quiz) — لا تُغيَّر أبداً وإلا اعتبرها أندرويد
 *   تطبيقاً مختلفاً ولن يستطيع المستخدمون تحديث نسختهم المثبّتة.
 * - appName «حرب العقول» — الاسم الجديد للعبة في هاتف المستخدم.
 * - عند بناء APK جديد: تأكد أن هذا الملف هو المستخدم في البناء (وليس نسخة
 *   قديمة بالاسم القديم)، ثم وقّع الملف الناتج بمفتاح
 *   المشروع الرسمي (android/keystore/README.md).
 */
const config: CapacitorConfig = {
  appId: "com.mindclash.quiz",
  appName: "حرب العقول",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0a0e1a",
    allowMixedContent: false,
    initialFocus: true,
  },
};

export default config;
