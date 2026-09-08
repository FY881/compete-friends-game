/**
 * ═══════════════════════════════════════════════════════════════
 * AI Configuration — محرك الاستدعاء الحقيقي الوحيد في اللعبة
 * ═══════════════════════════════════════════════════════════════
 *
 * النظام المطلوب: نظامان فقط، لا ثالث لهما.
 *
 *  ⚙️ النظام الأول (System A): مفتاح API + رابط المزود (URL).
 *     يُستخدم مع أي مزوّد يعطي رابطاً خاصاً (توافقي مع OpenAI).
 *
 *  🔑 النظام الثاني (System B): مفتاح API فقط (بدون URL).
 *     يُستخدم عبر البوابة الافتراضية الثابتة (OpenRouter) للأنظمة
 *     التي تدعم هذا النمط.
 *
 * كل استدعاء هو طلب شبكة حقيقي (fetch). إن فشل الاتصال يُرمى خطأ
 * واضح لا يُكتم (لا نتائج وهمية أبداً).
 *
 * يعمل محركاً وحيداً: كل أنظمة AI في اللعبة تمر عبر callLlm هنا.
 * ═══════════════════════════════════════════════════════════════
 */

// ── النظامان الفعّالان في الذاكرة (يُضبطان من apiCore عبر setRuntimeConfig) ──
export type RuntimeSystem = {
  /** "key_url" = النظام الأول (مفتاح + رابط) | "key_only" = النظام الثاني (مفتاح فقط) */
  kind: "key_url" | "key_only";
  apiKey: string;
  baseUrl?: string; // النظام الأول فقط
};

// الحالة الحية في هذا الـ runtime — لا تُخزَّن بين الجلسات.
// تُملأ من واجهة النظامين عبر دالة setRuntimeConfig وتُقرأ من env كمصدر احتياطي.
let runtimeSystems: RuntimeSystem[] = [];

/** ضبط النظامين الفعّالين في هذا الـ runtime (يُستدعى من apiCore عند الحفظ/الحذف) */
export function setRuntimeConfig(systems: RuntimeSystem[]): void {
  runtimeSystems = Array.isArray(systems) ? systems : [];
}

/** قراءة النظامين المضبوطين حالياً */
export function getRuntimeConfig(): RuntimeSystem[] {
  return [...runtimeSystems];
}

// البوابة الافتراضية للنظام الثاني (مفتاح فقط) — OpenRouter
const DEFAULT_GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

// النموذج الافتراضي (أسماء نماذج OpenRouter — تُستخدم مع البوابة الافتراضية فقط)
export const DEFAULT_MODEL = "openrouter/auto";
export const FREE_MODELS = [DEFAULT_MODEL, "openrouter/free"];
export const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
];

// نماذج احتياطية للمزوّدات المخصّصة (النظام الأول — رابط خاص) تُجرَّب عند تعذّر الاكتشاف
const CUSTOM_FALLBACK_MODELS = [
  "deepseek-v4-flash-lr",
  "deepseek-v4-flash",
  "deepseek-chat",
  "gpt-4o-mini",
  "gpt-5.6-new",
];

// ذاكرة مؤقتة لاكتشاف نماذج المزوّد المخصّص (النظام الأول)
let customModelsCache: { origin: string; models: string[]; at: number } | null = null;

/** هل النظام الأول (مفتاح + رابط خاص) مفعّل حالياً؟ */
export function isCustomEndpoint(): boolean {
  const sysA = runtimeSystems.find((s) => s.kind === "key_url");
  return !!(
    sysA &&
    sysA.apiKey.trim().length > 10 &&
    sysA.baseUrl &&
    sysA.baseUrl.trim().startsWith("http")
  );
}

/**
 * 🔍 اكتشاف حقيقي لنموذج يعمل عند مزوّد مخصّص (النظام الأول):
 * يستدعي {origin}/v1/models بالمفتاح الحقيقي ويعيد قائمة نماذج،
 * مع تفضيل النماذج السريعة/الرخيصة. عند الفشل يرجع قائمة احتياطية عامة.
 */
export async function pickCustomModels(baseUrl: string, key: string): Promise<string[]> {
  let origin = baseUrl.trim();
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    // أبقه كما هو
  }
  const cacheKey = origin;
  if (customModelsCache && customModelsCache.origin === cacheKey && Date.now() - customModelsCache.at < 5 * 60_000) {
    return customModelsCache.models;
  }
  const fallback = CUSTOM_FALLBACK_MODELS;
  try {
    const res = await fetch(`${origin}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const ids = (json.data ?? []).map((m) => m.id).filter((x): x is string => !!x && x.trim().length > 0);
      if (ids.length) {
        const preferred =
          ids.find((m) => /flash-lr/i.test(m)) ??
          ids.find((m) => /flash/i.test(m)) ??
          ids.find((m) => /mini|light|fast|small/i.test(m)) ??
          ids[0];
        const models = [preferred, ...fallback.filter((m) => m !== preferred), ...ids.filter((m) => m !== preferred)];
        customModelsCache = { origin: cacheKey, models, at: Date.now() };
        return models;
      }
    }
  } catch {
    // تجاهل — سنعتمد القائمة الاحتياطية
  }
  return fallback;
}

/**
 * 🔍 حلّ نقطة الاتصال الحقيقية:
 *  1. إن ضُبط النظام الأول (key_url) → استخدم رابطه ومفتاحه.
 *  2. وإلا إن ضُبط النظام الثاني (key_only) → استخدم بوابته الافتراضية ومفتاحه.
 *  3. وإلا خطأ واضح وصريح: لا يوجد أي نظام مُفعّل — لا مسارات خلفية ولا env.
 */
function resolveEndpoint(): { url: string; key: string } {
  const sysA = runtimeSystems.find((s) => s.kind === "key_url");
  if (sysA && sysA.apiKey.trim().length > 10 && sysA.baseUrl && sysA.baseUrl.trim().startsWith("http")) {
    return { url: sysA.baseUrl.trim(), key: sysA.apiKey.trim() };
  }
  const sysB = runtimeSystems.find((s) => s.kind === "key_only");
  if (sysB && sysB.apiKey.trim().length > 10) {
    return { url: DEFAULT_GATEWAY, key: sysB.apiKey.trim() };
  }
  throw new Error(
    "لا يوجد نظام API مُفعّل. فعّل النظام الأول (مفتاح + رابط) أو النظام الثاني (مفتاح فقط) من مركز API.",
  );
}

/**
 * 🔑 استخراج المفتاح الفعّال الحالي (نظام A ثم نظام B ثم env) — للتوافق القديم.
 */
export function getOpenRouterKey(providedKey?: string | null): string {
  if (providedKey && providedKey.trim().length > 10) return providedKey.trim();
  const sysA = runtimeSystems.find((s) => s.kind === "key_url");
  if (sysA && sysA.apiKey.trim().length > 10) return sysA.apiKey.trim();
  const sysB = runtimeSystems.find((s) => s.kind === "key_only");
  if (sysB && sysB.apiKey.trim().length > 10) return sysB.apiKey.trim();
  return "";
}

/**
 * ⚡ الاستدعاء الموحّد الحقيقي — عبر النظامين فقط (A ثم B ثم env).
 * طلب شبكة فعلي مع إعادة محاولة تلقائية عند الفشل والانتقال للنموذج البديل.
 */
export async function callLlm(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
  label = "Zaka AI",
  _apiKey?: string | null,
  jsonMode = false,
): Promise<string> {
  const { url, key } = resolveEndpoint();
  const models = isCustomEndpoint()
    ? await pickCustomModels(url, key)
    : [DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL)];
  let lastErr = "فشل استدعاء AI";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zaka.app",
            "X-Title": label,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        if (!response.ok) {
          const err = await response.text();
          if (response.status === 429) {
            lastErr = "تجاوز حد الاستخدام (429) — أُوقف مؤقتاً.";
            break;
          }
          lastErr = `AI Gateway error (${response.status}): ${err.slice(0, 200)}`;
          continue;
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
        lastErr = "AI أعاد رداً فارغاً";
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "خطأ شبكة";
      }
    }
  }
  throw new Error(`${lastErr}`);
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

// ── بوابة الحرية — الأنظمة الحرة تنتظر تفعيل نائب المالك ──
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

export function requireDeputyOnline(): void {
  if (!deputyOnline) {
    throw new Error("أنظمة AI الحرة معطّلة — انتظر نجاح نائب المالك أولاً.");
  }
}

export function getAdminKeyPreview(): string {
  return "نظامان مفعّلان (مركز API)";
}

export function ensureWorkingModel(model?: string | null): string {
  if (!model || model.includes(":free") || model === "openrouter/auto") return DEFAULT_MODEL;
  return model;
}

export function getSystemInfo() {
  const systems = getRuntimeConfig();
  const active = systems.find((s) => s.apiKey && s.apiKey.trim().length > 10);
  return {
    systems,
    hasEnvKey: Boolean(active),
    envKeyPreview: active
      ? `${active.apiKey.slice(0, 6)}••••${active.apiKey.slice(-4)}`
      : "غير مضبوط",
    models: FREE_MODELS,
    defaultModel: DEFAULT_MODEL,
    deputyOnline,
  };
}