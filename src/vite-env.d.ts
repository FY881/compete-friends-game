/// <reference types="vite/client" />

/** ملف APK يُستورد كأصل (asset) — يعيد رابطًا يخدمه Vite تحت /assets/ في البناء. */
declare module "*.apk" {
  const src: string;
  export default src;
}

declare module "*.apk?url" {
  const src: string;
  export default src;
}
