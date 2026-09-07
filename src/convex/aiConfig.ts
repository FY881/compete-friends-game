/**
 * AI Configuration — مركز الإعدادات الذكية
 * المفتاح الرسمي الوحيد: sk-apx3... (AI Gateway متوافق مع OpenRouter).
 * OpenRouter المباشر و OneHop أُزيلوا تماماً — كل شيء عبر المفتاح الرسمي.
 */

import { ADMIN_AI_KEY, BACKUP_AI_KEY } from "../lib/aiCredentials";

const GATEWAY_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

/** المفتاح الفعّال: المُمرَّر إن وُجد، وإلا المفتاح الرسمي، وإلا env، وإلا الاحتياطي */
export function getOpenRouterKey(providedKey?: string | null): string {
  if (providedKey && providedKey.trim().length > 10) return providedKey.trim();
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey && envKey.trim().length > 10) return envKey.trim();
  if (ADMIN_AI_KEY && ADMIN_AI_KEY.trim().length > 10) return ADMIN_AI_KEY.trim();
  if (BACKUP_AI_KEY && BACKUP_AI_KEY.trim().length > 10) return BACKUP_AI_KEY.trim();
  return "";
}

export const FREE_MODELS = ["openrouter/free"];
export const DEFAULT_MODEL = "openrouter/free";

/**
 * ⚡ الاستدعاء الموحّد — عبر المفتاح الرسمي فقط.
 * لا OpenRouter منفصل ولا OneHop: فشل المفتاح = رسالة واضحة من مركز API.
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
    throw new Error("لا يوجد مفتاح AI — أضف المفتاح من مركز API.");
  }
  const response = await fetch(GATEWAY_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.app",
      "X-Title": label,
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      throw new Error(
        `المفتاح الرسمي معطّل مؤقتاً — تجاوز حد الاستخدام (429). أُوقف الاستدعاء حتى إعادة التفعيل من مركز API.`,
      );
    }
    throw new Error(`AI Gateway error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI أعاد رداً فارغاً");
  return content;
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
    backupKeyPreview: BACKUP_AI_KEY ? BACKUP_AI_KEY.slice(0, 12) + "..." : "أُزيل",
    onehopKeyPreview: "أُزيل نهائياً",
    models: FREE_MODELS,
    defaultModel: DEFAULT_MODEL,
    backup: null as null | { provider: string; model: string },
  };
}
