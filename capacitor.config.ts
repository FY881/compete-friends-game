import type { CapacitorConfig } from "@capacitor/cli";

/**
 * إعدادات تطبيق أندرويد (Capacitor).
 *
 * - appId ثابتة (com.mindclash.quiz) — لا تُغيَّر أبداً وإلا اعتبرها أندرويد
 *   تطبيقاً مختلفاً ولن يستطيع المستخدمون تحديث نسختهم المثبّتة.
 * - appName «العبقري» — الاسم الذي يظهر تحت الأيقونة في هاتف المستخدم.
 * - عند بناء APK جديد: تأكد أن هذا الملف هو المستخدم في البناء (وليس نسخة
 *   قديمة بالاسم القديم «تحدّي العقول»)، ثم وقّع الملف الناتج بمفتاح
 *   المشروع الرسمي (android/keystore/README.md).
 */
const config: CapacitorConfig = {
  appId: "com.mindclash.quiz",
  appName: "العبقري",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    backgroundColor: "#f6faf9",
    allowMixedContent: false,
    initialFocus: true,
  },
};

export default config;
