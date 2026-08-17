/**
 * الإصدار الحالي المثبّت في هذه النسخة من التطبيق.
 *
 * نظام التحديث يعمل هكذا:
 * - هذا الثابت = الإصدار الذي بُنيت به هذه النسخة (مثبّت داخل الكود).
 * - `src/convex/appInfo.ts` فيه `CURRENT_VERSION` = أحدث إصدار منشور على الخادم.
 * - العميل يقارن الاثنين؛ إذا كان إصدار الخادم أحدث تظهر لافتة «تحديث متاح».
 *
 * عند إصدار نسخة جديدة:
 * 1. ارفع الرقم هنا وفي `src/convex/appInfo.ts` معاً.
 * 2. ضع ملف APK الجديد في `src/assets/` (بجانب هذا الملف) وحدّث الاستيراد
 *    `apkAssetUrlRaw` أدناه ليطابق اسم الملف الجديد.
 * 3. ارفع `versionCode`/`versionName` في `android/app/build.gradle`
 *    (versionCode يزيد برقم، versionName = نفس رقم سيمانتك).
 * 4. أعد البناء → يظهر ملف APK جديد في صفحة التحميل تلقائياً.
 *
 * لماذا يُستورد الملف كأصل (asset) بدل وضعه في `public/downloads`؟
 * - `public/downloads/...` مسار مباشر قد لا يخدمه بعض مزوّدي الاستضافة
 *   (كان ينتج صفحة «No matching routes found» عند فتحه).
 * - الاستيراد عبر Vite بـ `?url` يضع الملف تحت `/assets/` بنفس مسار ملفات
 *   التطبيق نفسها — وهو المسار الذي يخدمه أي مزوّد يعرض التطبيق أصلاً.
 *   (بدون `?url` يفشل البناء لأن Rollup يحاول قراءة الـ APK كوحدة JS.)
 */
import apkAssetUrlRaw from "@/assets/al-abqari-v1.0.1.apk?url";

/** مسار الملف الفعلي — بدون استعلامات Vite (مثل ?import) التي تفشل في fetch. */
const apkAssetUrl = apkAssetUrlRaw.split("?")[0];

export const APP_VERSION = "1.0.1";

export const APP_VERSION_LABEL = `العبقري ${APP_VERSION}`;

/** هل هذه نسخة تطبيق أندرويد الأصلية (WebView على https://localhost)؟ */
function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const capacitor = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;
  } catch {
    // تجاهل — نتائج الفحص لا تؤثر على الويب
  }
  return window.location.origin === "https://localhost";
}

/** هل الرابط عنوان ويب صالح (http/https)؟ */
function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** نوع MIME الرسمي لملفات أندرويد — يمنع المتصفح من تحويل الملف إلى .zip. */
const APK_MIME_TYPE = "application/vnd.android.package-archive";

/**
 * بصمة SHA-256 والحجم بالبايت لملف APK الرسمي الذي ننشره.
 *
 * التنزيل الآن «موثّق»: يرفض المتصفح أي ملف لا يطابق هاتين القيمتين تماماً
 * (صفحة خطأ HTML، ملف ناقص/مقطوع، أو أي بايتات مختلفة) قبل حفظه باسم .apk —
 * فحتى لو تعرّض النقل لأي خلل لن يصل هاتفك أبداً ملف «حدثت مشكلة عند تحليل
 * الحزمة». عند نشر نسخة جديدة: أعد بناء APK ثم ضع بصمته وحجمه هنا.
 */
export const APK_SHA256 =
  "107b78d61c4628c28906b2e7c2c4575d9262cdcbe182c118546c0bc685eccad1";
export const APK_BYTES = 12037991;

/** حساب SHA-256 لمحتوى Blob (يُستخدم للتحقق من سلامة الملف قبل التنزيل). */
async function sha256Hex(blob: Blob): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const buffer = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null; // تعذّر الحساب؟ نتخطى فحص البصمة ونكتفي بفحص الحجم.
  }
}

/**
 * بناء رابط تحميل الـ APK الصحيح.
 *
 * القاعدة:
 * - المتصفح (ويب/PWA): مسار الأصول الحالي (`/assets/...`) — يخدمه الخادم
 *   الذي يعرض التطبيق، مهما كان (لن ينتج «No matching routes found»).
 * - تطبيق أندرويد (WebView على https://localhost): يستخدم `siteUrl` الذي
 *   يضبطه المالك من غرفة المالك (رابط الموقع الرسمي)؛ وإن كان فارغاً
 *   يستخدم الملف المضمّن داخل التطبيق نفسه.
 */
export function resolveApkUrl(
  fileName: string | null | undefined,
  siteUrl?: string | null,
): string {
  const file = fileName ?? `al-abqari-v${APP_VERSION}.apk`;
  const cleanSite = (siteUrl ?? "").trim().replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin && !isNativeApp()) {
    return `${window.location.origin}${apkAssetUrl}`;
  }

  // تطبيق أندرويد الأصلي: الموقع الرسمي هو المرجع لتحميل أحدث نسخة.
  if (isHttpUrl(cleanSite)) {
    return `${cleanSite}/downloads/${file}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${apkAssetUrl}`;
  }

  return `/downloads/${file}`;
}

/**
 * قائمة روابط محتملة لتنزيل الـ APK، مرتبة من الأقرب للنجاح.
 * التنزيل يتم عبر `fetch` (داخل الصفحة) — فلا يحدث أي انتقال لصفحة
 * خطأ أو صفحة «No matching routes found» نهائياً.
 */
export function getApkDownloadCandidates(
  fileName: string | null | undefined,
  siteUrl?: string | null,
): string[] {
  const file = fileName ?? `al-abqari-v${APP_VERSION}.apk`;
  const cleanSite = (siteUrl ?? "").trim().replace(/\/+$/, "");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  const candidates: string[] = [];
  const push = (url: string) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  if (isNativeApp()) {
    // الأصلي: الموقع الرسمي أولاً (أحدث نسخة)، ثم الملف المضمّن داخل التطبيق.
    if (isHttpUrl(cleanSite)) push(`${cleanSite}/downloads/${file}`);
    if (origin) push(`${origin}${apkAssetUrl}`);
    if (origin) push(`${origin}/downloads/${file}`);
  } else {
    // الويب: مسار الأصول مضمون في كل البيئات، ثم المسار المباشر، ثم الموقع الرسمي.
    if (origin) push(`${origin}${apkAssetUrl}`);
    if (origin) push(`${origin}/downloads/${file}`);
    if (isHttpUrl(cleanSite)) push(`${cleanSite}/downloads/${file}`);
  }
  return candidates;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  // إصلاح مهم: خادم الاستضافة يرسل ملفات .apk بدون Content-Type (أو بنوع
  // zip لأن الـ APK حاوية ZIP)، فيشمّه المتصفح كـ zip ويحوّل اسم الملف إلى
  // `.zip` — هذا سبب «الملف نزل بصيغة zip». الحل: إعادة بناء الـ Blob بنوع
  // MIME الرسمي للـ APK، فيحفظه المتصفح بامتداد .apk كما هو تماماً.
  const apkBlob =
    blob.type === APK_MIME_TYPE ? blob : new Blob([blob], { type: APK_MIME_TYPE });
  // تأكيد أن الاسم ينتهي بـ .apk مهما فعل المتصفح (إزالة أي .zip ملتصق).
  const safeName = fileName.endsWith(".apk")
    ? fileName
    : `${fileName.replace(/\.zip$/i, "")}.apk`;
  const url = URL.createObjectURL(apkBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * هل الملف يبدأ بتوقيع ZIP/APK الحقيقي (البايتان «PK»)?
 * يرفض صفحات HTML الخطأ («No matching routes found») التي قد يعيدها الخادم
 * لمسار لا يعرفه — حتى لا ينزل المستخدم صفحة خطأ باسم ملف تثبيت.
 */
async function looksLikeApk(blob: Blob): Promise<boolean> {
  try {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b; // "PK"
  } catch {
    return true; // تعذّر الفحص؟ لا نمنع التنزيل.
  }
}

/**
 * تنزيل ملف APK بطريقة لا تفتح أي صفحة:
 * - ويب/PWA: `fetch` الملف من أول رابط ناجح ثم تنزيله كـ Blob.
 * - تطبيق أندرويد: فتح رابط الموقع الرسمي في المتصفح الخارجي (أكثر موثوقية).
 *
 * @throws خطأ عربي واضح إن فشلت كل المصادر.
 */
export async function downloadApk(
  fileName: string | null | undefined,
  siteUrl?: string | null,
): Promise<void> {
  const file = fileName ?? `al-abqari-v${APP_VERSION}.apk`;

  if (isNativeApp()) {
    // افتح صفحة التحميل الرسمية في المتصفح الخارجي. زرّها ينزّل الملف عبر
    // fetch + Blob باسم .apk صريح. (فتح رابط الملف المباشر قد يتحول إلى
    // .zip لأن الخادم يرسله بدون Content-Type فيشمّه المتصفح كملف zip.)
    const cleanSite = (siteUrl ?? "").trim().replace(/\/+$/, "");
    if (isHttpUrl(cleanSite)) {
      window.open(`${cleanSite}/download`, "_blank", "noopener");
      return;
    }
    const url = resolveApkUrl(file, siteUrl);
    window.open(url, "_blank", "noopener");
    return;
  }

  const candidates = getApkDownloadCandidates(file, siteUrl);
  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const blob = await response.blob();
      // فحص سريع: ملف APK حقيقي أكبر من 100 كيلوبايت ويبدأ بتوقيع PK
      // (يحمي من صفحات HTML الخاطئة أو ملفات ناقصة).
      if (blob.size < 100_000) {
        lastError = new Error("empty blob");
        continue;
      }
      if (!(await looksLikeApk(blob))) {
        lastError = new Error("not an apk");
        continue;
      }
      // التحقق الكامل: الحجم + البصمة الرقمية يجب أن يطابقا ملف APK الرسمي
      // حرفياً. أي ملف مختلف (صفحة خطأ، تحميل مقطوع، ملف قديم) يُرفض هنا
      // قبل أن يصل لهاتفك — هذا ما يمنع «حدثت مشكلة عند تحليل الحزمة» نهائياً.
      if (blob.size !== APK_BYTES) {
        lastError = new Error(
          `size mismatch: got ${blob.size}, expected ${APK_BYTES}`,
        );
        continue;
      }
      const digest = await sha256Hex(blob);
      if (digest && digest !== APK_SHA256) {
        lastError = new Error("sha256 mismatch");
        continue;
      }
      triggerBlobDownload(blob, file);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    "تعذّر تنزيل ملف APK سليم: كل المصادر أرسلت ملفاً مختلفاً عن النسخة الرسمية (الحجم/البصمة غير مطابقين) — عادة بسبب تخزين مؤقت قديم. حدّث الصفحة (Ctrl+Shift+R) وحاول مجدداً، وإن استمرت المشكلة أخبرنا.",
  );
}

/** تحليل رقم سيمانتك «x.y.z» إلى أرقام للمقارنة. */
export function parseVersion(v: string): number[] {
  return v
    .trim()
    .split(".")
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
}

/** هل إصدار `candidate` أحدث من `base`؟ (مقارنة سيمانتك آمنة) */
export function isNewerVersion(candidate: string | undefined | null, base: string): boolean {
  if (!candidate) return false;
  if (candidate === base) return false;
  const a = parseVersion(candidate);
  const b = parseVersion(base);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
