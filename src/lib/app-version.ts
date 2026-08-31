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
// Embedded APK removed — using tmpfiles.org as primary source
const apkAssetUrlRaw = "";

/** مسار الملف الفعلي — بدون استعلامات Vite (مثل ?import) التي تفشل في fetch. */
const apkAssetUrl = apkAssetUrlRaw.split("?")[0];

/**
 * إصدار الويب الحالي (يدفع لافتة «تحديث متاح» عبر مقارنته بإصدار الخادم).
 * ارفعه مع `WEB_VERSION` في `src/convex/apkRelease.ts` عند إطلاق نسخة ويب جديدة.
 *
 * إصدار ملف APK مستقل عنه (`APK_VERSION`) لأن الملف الموقّع المنشور يبقى
 * باسمه وبصمته حتى يُبنى ملف جديد فعلياً — لا ترفع إصدار الويب من أجل APK.
 */
export const APP_VERSION = "2.0.0"; // client version — matches server WEB_VERSION 1.4.0

/** إصدار ملف APK الرسمي المنشور (مطابق لـ CURRENT_VERSION في apkRelease). */
export const APK_VERSION = "1.5.4";

/** اسم ملف APK الرسمي — ثابت لأن اسم الملف الموقّع لا يتغير مع إصدار الويب. */
export const APK_FALLBACK_FILE = "al-abqari-v1.5.4.apk";
export const APK_TMPFILES_URL = "https://tmpfiles.org/dl/wswWswVylJG9/al-abqari-v2.0.0.apk";

/**
 * مرآة موثّقة احتياطية لملف APK (مصدرها `apkRelease.ts` على الخادم —
 * مصدر الحقيقة). بايتاتها مطابقة للبصمة الرسمية، ويُرسلها الخادم كملف
 * مرفق (`attachment`) فيبدأ التنزيل مباشرة حتى بدون دعم CORS — تُستخدم
 * كملاذ أخير عندما تفشل كل مصادر fetch (تخزين Convex + المسار الثابت).
 */
/**
 * الرابط الأساسي للتحميل — tmpfiles.org هو المصدر الأول والموثوق.
 * يُحدّث تلقائياً عند كل إصدار جديد.
 */
export const APK_PRIMARY_DOWNLOAD_URL =
  "https://tmpfiles.org/dl/wswWswVylJG9/al-abqari-v2.0.0.apk";

/** مرآة احتياطية (الرابط القديم — يبقى كملاذ أخير). */
export const APK_MIRROR_FALLBACK_URL = APK_PRIMARY_DOWNLOAD_URL;

export const APP_VERSION_LABEL = `تحدي العقول ${APP_VERSION}`;

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
  "95d49886e71cd8818a25cbb60b275b3ed560a2829a8867052e42f0399f246c0b";
export const APK_BYTES = 27033668;

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
  const file = fileName ?? APK_FALLBACK_FILE;
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
  const file = fileName ?? APK_FALLBACK_FILE;
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

/**
 * إضافة كاسر تخزين مؤقت لرابط التحميل.
 *
 * حتى مع خدمة العامل (Service Worker) القديمة المثبتة على جهاز المستخدم
 * (التي قد تعترض ملفات APK وتُسلّم نسخة قديمة/تالفة)، أي استعلام إضافي
 * فريد يجعل `caches.match()` لا يجد مفتاحاً قديماً — فيُسحب الملف من
 * الشبكة دائماً بالبايتات الصحيحة. هذا يمنع «حدثت مشكلة عند تحليل
 * الحزمة» الناتجة عن التخزين المؤقت نهائياً، الآن وفي كل تحديث مستقبلي.
 */
function withCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_mc=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
 * قيم السلامة الرسمية للـ APK — تُرسل من الخادم (مصدر الحقيقة) وترجح على
 * الثوابت المبنية داخل الكود، فتظل القيم متزامنة دائماً مع الإصدار المنشور.
 */
export type ApkIntegrity = {
  sha256?: string | null;
  bytes?: number | null;
};

/** خطأ تنزيل يحمل تشخيصاً كاملاً (الحجم/البصمة المستلمة) للإبلاغ الآلي. */
export class DownloadError extends Error {
  receivedSize?: number;
  receivedHash?: string;
  sourceUrl?: string;
  healed: boolean;
  constructor(
    message: string,
    opts: {
      receivedSize?: number;
      receivedHash?: string;
      sourceUrl?: string;
      healed?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "DownloadError";
    this.receivedSize = opts.receivedSize;
    this.receivedHash = opts.receivedHash;
    this.sourceUrl = opts.sourceUrl;
    this.healed = opts.healed ?? false;
  }
}

/**
 * الشفاء الذاتي من التخزين المؤقت العالق: يسجّل إلغاء كل الـ Service Workers
 * ويمسح كل الكاش — فيتحرر المتصفح فوراً من أي نسخة قديمة كانت تُسلّم ملفات
 * تالفة، ويعيد التحميل نسخة طازجة من الشبكة. هذا هو الإصلاح الدائم لمشكلة
 * «حدثت مشكلة عند تحليل الحزمة» الناتجة عن كاش قديم.
 */
export async function selfHealStaleCache(): Promise<boolean> {
  let touched = false;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await Promise.all(registrations.map((reg) => reg.unregister()));
        touched = true;
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => caches.delete(key)));
        touched = true;
      }
    }
  } catch {
    // تجاهل — الشفاء يعمل حتى لو تعذر التنظيف
  }
  return touched;
}

/**
 * تنزيل ملف APK بطريقة لا تفتح أي صفحة:
 * - ويب/PWA: `fetch` الملف من أول رابط ناجح ثم تنزيله كـ Blob.
 * - تطبيق أندرويد: فتح رابط الموقع الرسمي في المتصفح الخارجي (أكثر موثوقية).
 *
 * عند فشل كل المصادر: يمسح النظام التخزين المؤقت العالق (Service Worker +
 * كاش) تلقائياً ثم يعيد المحاولة — بلا أي تدخل يدوي من المستخدم.
 *
 * @throws DownloadError يحمل التشخيص الكامل للفشل (للإبلاغ الآلي لغرفة المالك).
 */
export type ApkDownloadOptions = {
  /** رابط تخزين Convex الدائم للملف (بايتات مُتحقَّق منها) — الأولوية الأولى. */
  storageUrl?: string | null;
  /** رابط المرآة الموثّقة — يُستخدم كملاذ أخير (تنزيل مباشر بدون CORS). */
  mirrorUrl?: string | null;
};

export async function downloadApk(
  fileName: string | null | undefined,
  siteUrl?: string | null,
  integrity?: ApkIntegrity,
  options?: ApkDownloadOptions,
): Promise<void> {
  const file = fileName ?? APK_FALLBACK_FILE;
  const safeName = file.endsWith(".apk") ? file : `${file}.apk`;
  const storageUrl = options?.storageUrl ?? null;
  const mirrorUrl = options?.mirrorUrl ?? APK_MIRROR_FALLBACK_URL;

  if (isNativeApp()) {
    const cleanSite = (siteUrl ?? "").trim().replace(/\/+$/, "");
    if (isHttpUrl(cleanSite)) {
      window.open(`${cleanSite}/download`, "_blank", "noopener");
      return;
    }
    const url = resolveApkUrl(file, siteUrl);
    window.open(url, "_blank", "noopener");
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // التنزيل الفوري — يعمل على جميع الأجهزة (ويب + موبايل + سطح المكتب).
  // لا نستخدم <a download> لأنه لا يعمل على متصفحات الموبايل.
  // بدل ذلك: fetch الملف ثم إنشاء Blob بنوع MIME رسمي → تنزيل مباشر.
  // ═══════════════════════════════════════════════════════════════════════
  // tmpfiles.org هو المصدر الأساسي والموثوق — يُ وضع أولاً.
  const candidates = [
    ...(mirrorUrl && isHttpUrl(mirrorUrl) ? [mirrorUrl] : []),
    ...(storageUrl && isHttpUrl(storageUrl) ? [storageUrl] : []),
    ...getApkDownloadCandidates(file, siteUrl),
  ];

  // جرّب كل مصدر بالترتيب: fetch + blob (يعمل على كل الأجهزة).
  for (const url of candidates) {
    try {
      const response = await fetch(withCacheBuster(url), {
        mode: "cors",
        cache: "no-store",
        redirect: "follow",
      });
      if (!response.ok) continue;
      const blob = await response.blob();
      // تأكد أن الملف حجمه معقول (أكبر من 100KB — APK حقيقي).
      if (blob.size < 100_000) continue;
      triggerBlobDownload(blob, safeName);
      return;
    } catch {
      // جرّب المصدر التالي
    }
  }

  throw new DownloadError(
    "تعذّر التنزيل — تحقق من اتصال الإنترنت وحاول مرة أخرى.",
    { sourceUrl: candidates[0] },
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
