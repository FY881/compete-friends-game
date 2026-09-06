/**
 * AI Configuration — مركز الإعدادات الذكية
 * يوفر مفتاح API من أي مصدر (متغير بيئة، إعدادات المالك، أو مفتاح افتراضي).
 * جميع أنظمة AI تستخدم هذا الملف للحصول على المفتاح.
 *
 * 🔄 البديل المؤقت: OneHop (onehop.ai) — إذا فشل OpenRouter تنتقل كل الأنظمة
 * تلقائياً إلى OneHop بنموذج deepseek/deepseek-v4-flash دون أي تدخل.
 */

// المفتاح الرسمي الوحيد للعبة — من module المفاتيح الداخلي
import { ADMIN_AI_KEY } from "../lib/aiCredentials";

// المفتاح الاحتياطي القديم (يُزال reliance عليه من المسار الرئيسي)


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

  // 3. المفتاح الرسمي الدائم (الوحيد المُستخدَم حالياً)
  return ADMIN_AI_KEY;
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
 * ⚡ الاستدعاء الموحّد مع تحكم المفتاح الرسمي ومعالجة 429 والبديل التلقائي —
 * يستدعي OpenRouter أولاً بالمفتاح الرسمي، وإذا تعيّق حد الاستخدام (429)
 * يعرض رسالة واضحة ويوقف الطلبات المؤقتة. عند فشل غير حد الاستخدام
 * ينتقل تلقائياً إلى OneHop بنفس رسائل المحادثة.
 * تعيد كل أنظمة AI استدعاء هذه الدالة بدلاً من fetch المباشر.
 */
export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
  label = "Zaka AI",
  apiKey?: string | null,
): Promise<string> {
  // ── المحاولة 1: OpenRouter ──
  try {
    return await callOpenRouterDirect(messages, maxTokens, temperature, label, apiKey);
  } catch (orErr) {
    const msg = orErr instanceof Error ? orErr.message : String(orErr);
    if (msg.includes("429") || msg.includes("Rate limit exceeded")) {
      throw new Error(
        `OpenRouter معطّل مؤقتاً — تم تجاوز حد الاستخدام اليومي (429).` +
        ` أُوقف الاستدعاء حتى تفعيله مجدداً من مركز الـ API،` +
        ` وسيعود نائب الرئيس والأنظمة عندها دون تدخل منك.` +
        (apiKey && apiKey.startsWith("sk-") ? " · مفتاح رئيسي مضبوط." : ""),
      );
    }
    // ── المحاولة 2: OneHop (البديل المؤقت) ──
    try {
      return await callOneHop(messages, maxTokens, temperature);
    } catch {
      throw orErr;
    }
  }
}

/** OpenRouter مباشر مع تحكم المفتاح الرسمي */
export async function callOpenRouterDirect(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  label: string,
  apiKey?: string | null,
): Promise<string> {
  const effectiveKey = apiKey && apiKey.trim().length > 10 ? apiKey.trim() : ADMIN_AI_KEY;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
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
  apiKey?: string | null,
): Promise<string> {
  const effectiveKey = apiKey && apiKey.trim().length > 10 ? apiKey.trim() : ONEHOP_KEY;
  const response = await fetch(ONEHOP_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveKey}`,
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


export function getAdminKeyPreview(): string {
  return ADMIN_AI_KEY.slice(0, 12) + "...";
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
    adminKeyPreview: ADMIN_AI_KEY.slice(0, 12) + "...",
    onehopKeyPreview: ONEHOP_KEY.slice(0, 12) + "...",
    models: FREE_MODELS,
    defaultModel: DEFAULT_MODEL,
    backup: { provider: "OneHop", model: ONEHOP_MODEL },
  };
}
