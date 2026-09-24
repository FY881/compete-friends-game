/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔌 جسر الربط — يحقن مركز API في محرك الذكاء قبل كل استدعاء
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  `ensureAiRuntime(ctx)` هي النقطة الوحيدة التي تُشحن المحرك:
 *    • المزوّدون المضبوطون من غرفة المالك (مفتاح + رابط / مفتاح فقط).
 *    • مصفوفة التوجيه لكل وحدة AI.
 *    • الحدود (سقف يومي، حد الدقيقة، الكاش، قاطع الدائرة).
 *    • النماذج المُكتشَفة فعلياً من /models.
 *
 *  وتُشحن أيضاً سياق الإجراء حتى يُسجَّل كل استدعاء دليلاً حقيقياً.
 *
 *  تشغيل احتياطي: إن لم يُضبط أي مزوّد في المركز وكانت الحدود تسمح،
 *  يُقرأ المفتاح من متغيّرات بيئة الخادم — بلا كتابة أي مفتاح في الكود.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { internal } from "./_generated/api";
import {
  callLlm,
  setEngineConfig,
  setEngineReporter,
  type EngineProvider,
  type EngineRoute,
} from "./aiConfig";

/** متغيّرات البيئة المدعومة للتشغيل الاحتياطي، بالأولوية */
const ENV_SOURCES: Array<{ keys: string[]; presetId: string; baseUrl: string; urlKeys: string[]; models?: string[] }> = [
  {
    keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    // واجهة Gemini المتوافقة مع OpenAI — تعمل مباشرة مع محرك المركز.
    presetId: "generic",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    urlKeys: [],
    models: ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    keys: ["MINIMAX_API_KEY", "MINIMAX_TOKEN", "MINIMAX_KEY"],
    presetId: "minimax",
    baseUrl: "https://api.minimax.io/v1",
    urlKeys: ["MINIMAX_BASE_URL", "MINIMAX_API_BASE", "MINIMAX_URL"],
  },
  {
    keys: ["FIREWORKS_API_KEY"],
    presetId: "fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    urlKeys: ["FIREWORKS_BASE_URL"],
  },
  {
    keys: ["AI_API_KEY", "LLM_API_KEY", "AI_GATEWAY_KEY", "VLY_AI_API_KEY"],
    presetId: "generic",
    baseUrl: "",
    urlKeys: ["AI_BASE_URL", "LLM_BASE_URL", "AI_API_BASE"],
  },
  {
    keys: ["OPENROUTER_API_KEY"],
    presetId: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    urlKeys: ["OPENROUTER_BASE_URL"],
  },
];

function envModelsFor(presetId: string): string[] {
  return ENV_SOURCES.find((s) => s.presetId === presetId)?.models ?? [];
}

function envValue(names: string[]): string {
  for (const name of names) {
    const v = process.env?.[name];
    if (typeof v === "string" && v.trim().length > 10) return v.trim();
  }
  return "";
}

/** يقرأ مزوّداً من بيئة الخادم إن وُجد — لا مفتاح مكتوب في الكود أبداً */
function providerFromEnv(): EngineProvider | null {
  for (const source of ENV_SOURCES) {
    const apiKey = envValue(source.keys);
    if (!apiKey) continue;
    const baseUrl = envValue(source.urlKeys) || source.baseUrl;
    if (!baseUrl) continue;
    return {
      id: "env",
      kind: "key_url",
      apiKey,
      baseUrl,
      presetId: source.presetId,
      model: source.models?.[0] ?? null,
      enabled: true,
    };
  }
  return null;
}

/**
 * 🔌 الحقن الحقيقي: يُستدعى من كل نظام يستدعي AI — فلا يعمل أي استدعاء
 * خارج إعدادات مركز API.
 */
export async function ensureAiRuntime(ctx: unknown): Promise<void> {
  setEngineReporter(ctx);
  try {
    const cfg = (await (ctx as any).runQuery(internal.apiCenterStore.readEngineConfig, {})) as {
      providers: EngineProvider[];
      guard: {
        enabled: boolean;
        dailyCallCap: number;
        dailyTokenCap: number;
        perMinuteCap: number;
        cacheEnabled: boolean;
        circuitEnabled: boolean;
        failureThreshold: number;
        cooldownMs: number;
        allowEnvBootstrap: boolean;
      };
      routes: Record<string, EngineRoute>;
      discovered: { A: string[]; B: string[] };
    };

    let providers = cfg.providers ?? [];
    let envUsed = false;
    let envModels: string[] = [];

    if (providers.length === 0 && cfg.guard?.allowEnvBootstrap !== false) {
      const envProvider = providerFromEnv();
      if (envProvider) {
        providers = [envProvider];
        envUsed = true;
        envModels = envModelsFor(envProvider.presetId);
      }
    }

    setEngineConfig({
      providers,
      guard: cfg.guard,
      routes: cfg.routes,
      discovered: {
        ...(cfg.discovered ?? {}),
        ...(envUsed ? { env: envModels } : {}),
      },
    });

    if (envUsed) {
      try {
        await (ctx as any).runMutation(internal.apiCenterStore.noteEnvBootstrap, {
          active: true,
          presetId: providers[0]?.presetId ?? "generic",
        });
      } catch {
        // ملاحظة التشغيل الاحتياطي لا تُسقط الاستدعاء
      }
    }
  } catch (e) {
    // Do not hide a database/Convex failure behind a generic "no provider" error.
    // Clear the provider list for safety, then expose the real cause to the caller.
    setEngineConfig({ providers: [] });
    const detail = e instanceof Error ? e.message : "تعذر قراءة إعدادات مركز API";
    throw new Error(`تعذر تحميل إعدادات مركز API: ${detail}`);
  }
}

/**
 * The single safe entry point for legacy AI modules. It always reloads the
 * center configuration on the server and never accepts a client-side secret.
 */
export async function callCenterLlm(
  ctx: unknown,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.7,
  label = "Zaka AI",
  task = "other",
  jsonMode = false,
): Promise<string> {
  await ensureAiRuntime(ctx);
  return callLlm(messages, maxTokens, temperature, label, null, jsonMode, task);
}
