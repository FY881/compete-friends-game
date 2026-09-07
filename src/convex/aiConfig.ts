/**
 * AI Configuration — مركز الإعدادات الذكية
 * المفتاح الرسمي الوحيد: OpenRouter (sk-or-v1...). لا Gemini ولا أي مزود آخر.
 * كل أنظمة AI في اللعبة تمر عبر هذا المفتاح فقط.
 */

import { ADMIN_AI_KEY, BACKUP_AI_KEY } from "../lib/aiCredentials";

// نسخة مُصرّحة صراحةً كـ string — المفتاح الاحتياطي أُزيل، لكن نحتاج منع const literal
// ("") من تقليص النوع إلى never عند استخدامه في شروط.
const backupKey: string = BACKUP_AI_KEY;

const GATEWAY_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

/** المفتاح الفعّال: المُمرَّر إن وُجد، وإلا المفتاح الرسمي، وإلا env، وإلا الاحتياطي */
export function getOpenRouterKey(providedKey?: string | null): string {
  if (providedKey && providedKey.trim().length > 10) return providedKey.trim();
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim().length > 10) return envKey.trim();
  if (ADMIN_AI_KEY && ADMIN_AI_KEY.trim().length > 10) return ADMIN_AI_KEY.trim();
  if (backupKey && backupKey.trim().length > 10) return backupKey.trim();
  return "";
}

// نستخدم openrouter/auto بدلاً من openrouter/free: النموذج المجاني يصل سريعاً
// لحد الاستخدام اليومي (429 free-models-per-day). auto يختار أفضل نموذج متاح
// للمفتاح الحالي، فيتجاوز الحد للمفتاح ذي الرصيد ويوقف أخطاء الـ AI المتكررة.
export const FREE_MODELS = ["openrouter/auto", "openrouter/free"];
export const DEFAULT_MODEL = "openrouter/auto";

/** سلسلة نماذج بديلة — كلها عبر نفس مفتاح OpenRouter الرسمي (لا مزود خارجي) */
export const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
];

/**
 * ⚡ الاستدعاء الموحّد — عبر المفتاح الرسمي فقط، مع إصلاح ذاتي:
 *  - إعادة محاولة تلقائية عند الرد الفارغ (سبب «AI أعاد رداً فارغاً» السابق)
 *  - التنقل تلقائياً بين نماذج OpenRouter عند 429/فشل النموذج
 *  - قراءة الرد من حقل reasoning إن أعاد النموذج التفكير فقط
 */
export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
  label = "Zaka AI",
  apiKey?: string | null,
): Promise<string> {
  const key = getOpenRouterKey(apiKey);
  if (!key) {
    throw new Error("لا يوجد مفتاح AI — المفتاح الرسمي مفقود من aiCredentials.");
  }
  const models = [DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL)];
  let lastErr = "فشل استدعاء AI";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(GATEWAY_BASE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zaka.app",
            "X-Title": label,
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        });
        if (!response.ok) {
          const err = await response.text();
          if (response.status === 429) {
            lastErr = "المفتاح تجاوز حد الاستخدام (429) — أُوقف مؤقتاً حتى إعادة التفعيل.";
            break; // انتقل للنموذج التالي فوراً
          }
          lastErr = `AI Gateway error (${response.status}): ${err.slice(0, 200)}`;
          continue; // أعد المحاولة على نفس النموذج
        }
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
        };
        const msg = data.choices?.[0]?.message;
        const text =
          typeof msg?.content === "string" && msg.content.trim().length > 0
            ? msg.content
            : typeof msg?.reasoning === "string" && msg.reasoning.trim().length > 0
              ? msg.reasoning
              : "";
        if (text.trim()) return text;
        // رد فارغ → أعد المحاولة (سبب «AI أعاد رداً فارغاً» الشائع)
        lastErr = "AI أعاد رداً فارغاً";
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "خطأ شبكة";
      }
    }
  }
  throw new Error(`${lastErr} — أصلح حارس AI تلقائياً وسيعيد المحاولة.`);
}

/** توافق مع الملفات القديمة — نفس الاستدعاء الموحّد */
export async function callOpenRouterDirect(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
  label: string,
  apiKey?: string | null,
): Promise<string> {
  return callLlm(messages, maxTokens, temperature, label, apiKey);
}

// ═══════════════════════════════════════════════════════════════
// بوابة الحرية — كل أنظمة AI تعمل بحرية كاملة فقط بعد نجاح نائب المالك
// ═══════════════════════════════════════════════════════════════
let deputyOnline = false;
let deputyOnlineAt = 0;

export function markDeputyOnline(): void {
  deputyOnline = true;
  deputyOnlineAt = Date.now();
}

export function isDeputyOnline(): boolean {
  return deputyOnline;
}

export function getDeputyStatus() {
  return { online: deputyOnline, onlineAt: deputyOnlineAt };
}

/** تُستخدم في الأنظمة الحرة: إن لم ينجح نائب المالك بعد، ارفض بوضوح */
export function requireDeputyOnline(): void {
  if (!deputyOnline) {
    throw new Error(
      "أنظمة AI الحرة معطّلة — انتظر نجاح نائب المالك على المفتاح الرسمي أولًا.",
    );
  }
}

export function getAdminKeyPreview(): string {
  return ADMIN_AI_KEY.slice(0, 12) + "...";
}

export function ensureWorkingModel(model?: string | null): string {
  if (!model || model.includes(":free") || model === "openrouter/auto") return DEFAULT_MODEL;
  return model;
}

export function getSystemInfo() {
  return {
    hasEnvKey: Boolean(process.env.OPENROUTER_API_KEY),
    envKeyPreview: process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_API_KEY.slice(0, 15) + "..."
      : "غير مضبوط",
    adminKeyPreview: ADMIN_AI_KEY.slice(0, 12) + "...",
    backupKeyPreview: backupKey ? backupKey.slice(0, 12) + "..." : "أُزيل",
    onehopKeyPreview: "غير موجود — OpenRouter فقط",
    models: FREE_MODELS,
    defaultModel: DEFAULT_MODEL,
    backup: null as null | { provider: string; model: string },
  };
}
