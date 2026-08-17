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
export async function downloadApk(
  fileName: string | null | undefined,
  siteUrl?: string | null,
  integrity?: ApkIntegrity,
): Promise<void> {
  const file = fileName ?? `al-abqari-v${APP_VERSION}.apk`;
  // القيم الرسمية: قيم الخادم إن وصلت (مصدر الحقيقة)، وإلا ثوابت الكود.
  const expectedBytes = integrity?.bytes ?? APK_BYTES;
  const expectedSha = integrity?.sha256 ?? APK_SHA256;

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
  // ملاحظة: «null as DownloadError | null» وليس «: DownloadError | null = null»
  // لأن التضييق النوعي في TypeScript يحوّل الأخيرة إلى null نهائياً فلا تصل
  // خصائص التشخيص (receivedSize…) — أما الصيغة الحالية فتبقي النوع كاتحاد.
  let lastError = null as DownloadError | null;

  /** محاولة واحدة على كل الروابط — تعيد true عند النجاح وتُحدّث التشخيص. */
  const tryDownload = async (): Promise<boolean> => {
    for (const url of candidates) {
      try {
        // كاسر التخزين المؤقت: يضمن أن حتى الـ Service Worker القديم المثبت
        // لن يجد نسخة قديمة مخزنة، فيُحضّر الملف من الشبكة دائماً.
        const bustedUrl = withCacheBuster(url);
        const response = await fetch(bustedUrl, {
          cache: "no-store",
          headers: {
            Accept: "application/vnd.android.package-archive, application/octet-stream, */*",
          },
        });
        if (!response.ok) {
          lastError = new DownloadError(`HTTP ${response.status}`, {
            sourceUrl: url,
          });
          continue;
        }
        const blob = await response.blob();
        // فحص سريع: ملف APK حقيقي أكبر من 100 كيلوبايت ويبدأ بتوقيع PK
        // (يحمي من صفحات HTML الخاطئة أو ملفات ناقصة).
        if (blob.size < 100_000) {
          lastError = new DownloadError("ملف فارغ أو ناقص", {
            receivedSize: blob.size,
            sourceUrl: url,
          });
          continue;
        }
        if (!(await looksLikeApk(blob))) {
          lastError = new DownloadError("الملف ليس حزمة APK", {
            receivedSize: blob.size,
            sourceUrl: url,
          });
          continue;
        }
        // التحقق الكامل: الحجم + البصمة الرقمية يجب أن يطابقا ملف APK الرسمي
        // حرفياً. أي ملف مختلف (صفحة خطأ، تحميل مقطوع، ملف قديم) يُرفض هنا
        // قبل أن يصل لهاتفك — هذا ما يمنع «حدثت مشكلة عند تحليل الحزمة» نهائياً.
        if (blob.size !== expectedBytes) {
          lastError = new DownloadError(
            `اختلاف الحجم: استُلم ${blob.size} بايت والمتوقع ${expectedBytes}`,
            { receivedSize: blob.size, sourceUrl: url },
          );
          continue;
        }
        const digest = await sha256Hex(blob);
        if (digest && digest !== expectedSha) {
          lastError = new DownloadError("اختلاف البصمة الرقمية", {
            receivedSize: blob.size,
            receivedHash: digest,
            sourceUrl: url,
          });
          continue;
        }
        triggerBlobDownload(blob, file);
        return true;
      } catch (error) {
        lastError = new DownloadError(
          error instanceof Error ? error.message : "خطأ شبكة",
          { sourceUrl: url },
        );
      }
    }
    return false;
  };

  if (await tryDownload()) return;

  // ── الشفاء الذاتي الدائم ────────────────────────────────────────────
  // عند الفشل: مسح كل الـ Service Workers والكاش (سبب «الملف التالف» الأشهر)
  // ثم إعادة المحاولة فوراً — بدون حاجة لتحديث الصفحة أو أي تدخل يدوي.
  const healed = await selfHealStaleCache();
  if (healed && (await tryDownload())) return;

  throw new DownloadError(
    "تعذّر تنزيل ملف APK سليم: كل المصادر أرسلت ملفاً مختلفاً عن النسخة الرسمية (الحجم/البصمة غير مطابقين). أصلح النظام التخزين المؤقت تلقائياً وأعاد المحاولة — اضغط الزر مرة أخرى الآن، وإن تكررت المشكلة أُرسل تشخيص كامل تلقائياً إلى غرفة المالك.",
    {
      receivedSize: lastError?.receivedSize,
      receivedHash: lastError?.receivedHash,
      sourceUrl: lastError?.sourceUrl,
      healed,
    },
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
