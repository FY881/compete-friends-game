/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛡️ حارس الخلفية (Backend Guard) — يمنع تكرار تعطّل النظام
 * ═══════════════════════════════════════════════════════════════════════
 *
 * المشكلة الحقيقية: عند تجاوز حدود المنصة، يرفض خادم Convex كل استدعاء.
 * فيتحوّل التطبيق إلى حلقة تُضاعف الاستهلاك وقت الأزمة بالذات:
 *   خطأ ← بلاغ ← كتابة ← خطأ جديد… حتى تُستنفد الحصة تماماً.
 *
 * هذا الحارس يقوم بأربعة أمور حقيقية:
 *   1) يتعرّف على أخطاء المنصة (حصة/حدود) ويميّزها عن عيوب اللعبة.
 *   2) بمجرد رصدها → «وضع الاستقرار»: يوقف فوراً كل الكتابات الاختيارية
 *      (مقاييس الأداء، بلاغات الأخطاء، نبضات المراقبة) فلا يُستهلك أي
 *      استدعاء إضافي أثناء الأزمة.
 *   3) يستفسر عن التعافي بنبضة واحدة رخيصة (0 قراءة قاعدة بيانات) بفاصل
 *      متزايد (٣ → ١٠ → ٢٠ → ٣٠ دقيقة) — لا إغراق للخادم.
 *   4) عند النجاح يعود كل شيء للعمل تلقائياً بلا تدخل من أحد.
 *
 * الحالة تُحفظ في sessionStorage: إعادة تحميل الصفحة لا تُعيد إطلاق
 * العاصفة، بل تبقى واعية بأن النظام في وضع الاستقرار.
 */

const DEGRADED_KEY = "bg.degraded";
const DEGRADED_SINCE_KEY = "bg.degradedAt";

/** أنماط أخطاء المنصة/الحصة — ليست عيوباً في اللعبة ولا تُبلَّغ عنها. */
const PLATFORM_ERROR =
  /exceeded the free plan|free plan limits|deployments have been disabled|upgrade to a pro plan|reached your free|plan limits|too many requests|rate limit|quota exceeded|exceeded.*quota|over the limit|billing|resource limit/i;

/** فواصل الاستفسار عن التعافي بالمللي ثانية — تتصاعد كي لا نُغرق الخادم. */
const PROBE_DELAYS_MS = [3 * 60_000, 10 * 60_000, 20 * 60_000, 30 * 60_000];

type Listener = (degraded: boolean) => void;

let degraded = false;
let probeStep = 0;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeRunner: (() => Promise<unknown>) | null = null;
let probeInFlight = false;
const listeners = new Set<Listener>();

// ── قراءة الحالة المحفوظة من الجلسة السابقة (نجت من إعادة التحميل) ──
try {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(DEGRADED_KEY) === "1") {
    degraded = true;
  }
} catch {
  /* التخزين غير متاح — نبدأ بحالة سليمة */
}

/** هل النظام الآن في «وضع الاستقرار» (الخلفية معطّلة)؟ */
export function isBackendDegraded(): boolean {
  return degraded;
}

/** اشترك في تغيّر حالة الخلفية (يعيد دالة إلغاء الاشتراك). */
export function subscribeBackendState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const l of listeners) {
    try {
      l(degraded);
    } catch {
      /* مستمع معطوب لا يُسقط الحارس */
    }
  }
}

/**
 * يفحص رسالة خطأ: هل هي خطأ منصة/حصة؟
 * يعيد `true` إن كان كذلك — ويكون قد فعّل وضع الاستقرار.
 */
export function noteBackendError(message: string, stack?: string): boolean {
  const combined = `${message ?? ""} ${stack ?? ""}`;
  if (!PLATFORM_ERROR.test(combined)) return false;
  enterDegradedMode();
  return true;
}

/** يفعّل وضع الاستقرار فوراً (يُستدعى عند أول خطأ منصة). */
export function enterDegradedMode(): void {
  if (degraded) {
    scheduleProbe();
    return;
  }
  degraded = true;
  probeStep = 0;
  try {
    sessionStorage.setItem(DEGRADED_KEY, "1");
    sessionStorage.setItem(DEGRADED_SINCE_KEY, String(Date.now()));
  } catch {
    /* ok */
  }
  console.warn(
    "[حرب العقول] 🛡️ وضع الاستقرار: أُوقفت كل الكتابات الاختيارية مؤقتاً حتى تعافي الخادم",
  );
  emit();
  scheduleProbe();
}

/** يعيد النظام من وضع الاستقرار — يستأنف كل شيء تلقائياً. */
export function exitDegradedMode(): void {
  if (!degraded) return;
  degraded = false;
  probeStep = 0;
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  try {
    sessionStorage.removeItem(DEGRADED_KEY);
    sessionStorage.removeItem(DEGRADED_SINCE_KEY);
  } catch {
    /* ok */
  }
  console.info("[حرب العقول] ✅ تعافى الخادم — عاد النظام للعمل الكامل تلقائياً");
  emit();
}

/** كم مضى على دخول وضع الاستقرار (بالمللي ثانية)، أو 0 إن كنا سليمين. */
export function degradedSinceMs(): number {
  if (!degraded) return 0;
  try {
    const raw = sessionStorage.getItem(DEGRADED_SINCE_KEY);
    const at = raw ? Number(raw) : 0;
    return at > 0 ? Date.now() - at : 0;
  } catch {
    return 0;
  }
}

/**
 * يربط الحارس بعميل Convex: يزوّده بنبضة رخيصة للاستفسار عن التعافي.
 * لا يُستدعى الاستفسار إلا في وضع الاستقرار — كلفته صفر في الوضع الطبيعي.
 */
export function initBackendGuard(probe: () => Promise<unknown>): void {
  probeRunner = probe;
  if (degraded) scheduleProbe();
}

function scheduleProbe(): void {
  if (probeTimer || !probeRunner) return;
  const step = Math.min(probeStep, PROBE_DELAYS_MS.length - 1);
  const delay = PROBE_DELAYS_MS[step];
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void runProbe();
  }, delay);
}

async function runProbe(): Promise<void> {
  if (!probeRunner || probeInFlight) return;
  probeInFlight = true;
  try {
    await probeRunner();
    // نجحت النبضة = الخادم عاد → استئناف كامل تلقائي
    exitDegradedMode();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // ⚠️ إن كانت النبضة فشلت بسبب حصة، نبقى في وضع الاستقرار ولا نُصعّد
    if (!PLATFORM_ERROR.test(msg)) {
      console.warn("[حرب العقول] فشل استفسار التعافي:", msg.slice(0, 160));
    }
    probeStep = Math.min(probeStep + 1, PROBE_DELAYS_MS.length - 1);
    scheduleProbe();
  } finally {
    probeInFlight = false;
  }
}

/**
 * بوابة واحدة تستعملها كل الكتابات الاختيارية قبل التنفيذ.
 * تُرجع `true` إن كان يجب التوقف (الخلفية متعطّلة أو الصفحة مخفية/أوفلاين).
 */
export function shouldPauseOptionalWork(): boolean {
  if (degraded) return true;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return false;
}
