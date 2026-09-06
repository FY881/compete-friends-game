/**
 * AI Configuration — مركز الإعدادات الذكية
 * يوفر مفتاح API من أي مصدر (متغير بيئة، إعدادات المالك، أو مفتاح افتراضي).
 * جميع أنظمة AI تستخدم هذا الملف للحصول على المفتاح.
 *
 * 🔄 البديل المؤقت: OneHop (onehop.ai) — إذا فشل OpenRouter تنتقل كل الأنظمة
 * تلقائياً إلى OneHop بنموذج deepseek/deepseek-v4-flash دون أي تدخل.
 */

// المفتاح الافتراضي الدائم — يعمل مع كل الأنظمة
const HARDCODED_KEY =
  "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";

// ── البديل المؤقت: OneHop ──────────────────────────────────
export const ONEHOP_BASE_URL = "https://api.onehop.ai/v1/chat/completions";
export const ONEHOP_KEY = "oh_live_-gwnQrTscb21FyPFFOtzJBRjb5svkS6I";
export const ONEHOP_MODEL = "deepseek/deepseek-v4-flash";

/**
 * يحصل على مفتاح OpenRouter من أي مصدر متاح.
 * الأولوية: متغير البيئة > المفتاح المُمرّر > الافتراضي
 */
export function getOpenRouterKey(providedKey?: string | null): string {
  // 1. المفتاح المُمرّر من الواجهة (إذا كان هناك إعدادات مخصصة)
  if (providedKey && providedKey.trim().length > 10) {
    return providedKey.trim();
  }

  // 2. متغير البيئة (الذي يُضبط في المنصة)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim().length > 10) {
    return envKey.trim();
  }

  // 3. المفتاح الافتراضي الدائم
  return HARDCODED_KEY;
}

/**
 * النموذج الوحيد working — openrouter/free هو موزّع ذكي يختار تلقائياً
 * نموذجاً مجانياً متاحاً. جميع النماذج الفردية بـ :free انتهت.
 */
export const FREE_MODELS = [
  "openrouter/free",
];

/**
 * النموذج الافتراضي لكل الاستدعاءات — مُثبّت على openrouter/free.
 * لا تغيّر هذا إلا إذا أثبت OpenRouter نموذجاً مجانياً جديداً.
 */
export const DEFAULT_MODEL = "openrouter/free";

/**
 * ⚡ الاستدعاء الموحّد مع تجربة البديل تلقائياً —
 * يستدعي OpenRouter أولاً، وإذا فشل (خطأ شبكة/مفتاح/حد استخدام)
 * يعيد المحاولة عبر OneHop بنفس رسائل المحادثة.
 * تعيد كل أنظمة AI استدعاء هذه الدالة بدلاً من fetch المباشر.
 */
export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
  label = "Zaka AI",
): Promise<string> {
  // ── المحاولة 1: OpenRouter ──
  try {
    return await callOpenRouterDirect(messages, maxTokens, temperature, label);
  } catch (orErr) {
    // ── المحاولة 2: OneHop (البديل المؤقت) ──
    try {
      return await callOneHop(messages, maxTokens, temperature);
    } catch {
      // أعطِ خطأ OpenRouter الأصلي لأنه الأكثر دلالة
      throw orErr;
    }
  }
}

/** OpenRouter مباشر */
async function callOpenRouterDirect(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  label: string,
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenRouterKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.app",
      "X-Title": label,
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI أعاد رداً فارغاً");
  return content;
}

/** OneHop — البديل المؤقت */
export async function callOneHop(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
): Promise<string> {
  const response = await fetch(ONEHOP_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ONEHOP_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: ONEHOP_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OneHop API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OneHop أعاد رداً فارغاً");
  return content;
}

/**
 * يتحقق من أن النموذج صالح ويُعيد الافتراضي إذا كان معطلاً
 */
export function ensureWorkingModel(model?: string | null): string {
  if (!model || model.includes(":free") || model === "openrouter/auto") {
    return DEFAULT_MODEL;
  }
  return model;
}

/**
 * معلومات النظام للتشخيص
 */
export function getSystemInfo() {
  return {
    hasEnvKey: Boolean(process.env.OPENROUTER_API_KEY),
    envKeyPreview: process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_API_KEY.slice(0, 15) + "..."
      : "غير مضبوط",
    fallbackKeyPreview: HARDCODED_KEY.slice(0, 15) + "...",
    models: FREE_MODELS,
    backup: { provider: "OneHop", model: ONEHOP_MODEL },
  };
}
