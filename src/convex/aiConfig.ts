/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 محرك الذكاء الموحّد — مركز API هو المتحكّم الوحيد
 * ═══════════════════════════════════════════════════════════════════════
 *
 * لا يوجد أي مسار بديل: كل استدعاء AI في اللعبة يمرّ من هنا حصراً.
 *
 *  ⚙️ المحرّك يقرأ من مركز API أربعة أشياء قبل كل طلب:
 *     ① المزوّدون المضبوطون (مفتاح + رابط، أو مفتاح فقط).
 *     ② مصفوفة التوجيه: أي وحدة تستخدم أي نموذج وبأي حرارة وطول.
 *     ③ الحدود: سقف يومي، حد الدقيقة، الكاش، قاطع الدائرة.
 *     ④ النماذج المُكتشَفة فعلياً من المزوّد.
 *
 * وأثناء الطلب:
 *     • يطبّع الرابط (يقبل `api.minimax.io/v1` كما يكتبه المالك).
 *     • يجرّب سلسلة نماذج مرتّبة بالسرعة، ويتنقّل بين المزوّدين عند الفشل.
 *     • يحترم اختلاف المزوّدين (JSON mode / فصل التفكير / <think>).
 *     • يُسجّل كل طلب: الوحدة، النموذج، الزمن، التوكنات، سبب الفشل.
 *
 * لا نتائج وهمية أبداً: إن فشل كل شيء يُرمى خطأ واضح وصريح.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { internal } from "./_generated/api";
import {
  DEFAULT_GUARD,
  DEFAULT_TASK_KEY,
  MAX_MODEL_CANDIDATES,
  chatUrlCandidates,
  decideCall,
  estimateTokens,
  getPreset,
  humanizeProviderError,
  isAuthFailure,
  isBalanceFailure,
  isPathFailure,
  matchTaskFromLabel,
  modelCandidates,
  modelsUrlCandidates,
  normalizeChatUrl,
  normalizeModelsUrl,
  promptFingerprint,
  stripThinking,
  type ApiGuardConfig,
} from "./apiCenterCore";

// ═══════════════════════════════════════════════════════════════════════
// حالة المحرك — تُضبط من apiCore.ensureAiRuntime قبل كل استدعاء
// ═══════════════════════════════════════════════════════════════════════

export type EngineProvider = {
  id: string; // A | B | env
  kind: "key_url" | "key_only";
  apiKey: string;
  baseUrl?: string;
  presetId: string;
  model?: string | null;
  enabled: boolean;
};

export type EngineRoute = {
  task: string;
  label: string;
  model: string | null;
  temperature: number | null;
  maxTokens: number;
  needsJson: boolean;
  enabled: boolean;
  /** مدة صلاحية الكاش لهذه الوحدة (٠ = بلا كاش) — من سجل الوحدات */
  cacheTtlMs: number;
};

export type EngineState = {
  providers: EngineProvider[];
  guard: ApiGuardConfig;
  routes: Record<string, EngineRoute>;
  discovered: Record<string, string[]>;
};

let engine: EngineState = {
  providers: [],
  guard: DEFAULT_GUARD,
  routes: {},
  discovered: { A: [], B: [] },
};

// سياق الإجراء الحالي — يُستخدم لتسجيل الأدلة في قاعدة البيانات فقط.
// التوثيق لا يُسقط استدعاءً أبداً، وأسوأ احتمال هو سطر منسوب لوحدة مجاورة.
let activeCtx: unknown = null;

export function setEngineReporter(ctx: unknown): void {
  activeCtx = ctx ?? null;
}

export function setEngineConfig(partial: Partial<EngineState>): void {
  engine = {
    providers: partial.providers ?? engine.providers,
    guard: partial.guard ?? engine.guard,
    routes: partial.routes ?? engine.routes,
    discovered: partial.discovered ?? engine.discovered,
  };
}

export function getEngineConfig(): EngineState {
  return engine;
}

/** توافق مع الشكل القديم (نظامان بمفتاح ورابط) */
export function setRuntimeConfig(systems: Array<{ kind: "key_url" | "key_only"; apiKey: string; baseUrl?: string }>): void {
  setEngineConfig({
    providers: systems.map((s, i) => ({
      id: i === 0 ? "A" : "B",
      kind: s.kind,
      apiKey: s.apiKey,
      baseUrl: s.baseUrl,
      presetId: "generic",
      model: null,
      enabled: true,
    })),
  });
}

export function getRuntimeConfig() {
  return engine.providers;
}

// ═══════════════════════════════════════════════════════════════════════
// ثوابت عامة
// ═══════════════════════════════════════════════════════════════════════

export const DEFAULT_MODEL = "openrouter/auto";
export const FREE_MODELS = [DEFAULT_MODEL];
export const FALLBACK_MODELS = ["gpt-4o-mini", "deepseek-chat"];
/** مهلة الطلب الواحد — ذكاء لعبة يجب أن يعود بسرعة أو يتراجع */
const REQUEST_TIMEOUT_MS = 25_000;

const DEFAULT_ROUTE: EngineRoute = {
  task: DEFAULT_TASK_KEY,
  label: "أي وحدة أخرى",
  model: null,
  temperature: null,
  maxTokens: 0,
  needsJson: false,
  enabled: true,
  cacheTtlMs: 0,
};

// ═══════════════════════════════════════════════════════════════════════
// حلّ المزوّدين والوحدات
// ═══════════════════════════════════════════════════════════════════════

function usableProviders(): EngineProvider[] {
  return engine.providers.filter((p) => {
    if (!p.enabled) return false;
    if (!p.apiKey || p.apiKey.trim().length < 10) return false;
    if (p.kind === "key_only") return true;
    return (p.baseUrl ?? "").trim().startsWith("http");
  });
}

export function resolveRoute(task: string): EngineRoute {
  return engine.routes[task] ?? engine.routes[DEFAULT_TASK_KEY] ?? DEFAULT_ROUTE;
}

/** نقطة الاتصال الفعلية لمزوّد — يقبل كل ما يكتبه المالك. */
export function providerChatUrl(p: EngineProvider): string {
  return providerChatUrls(p)[0] ?? "";
}

/**
 * All valid chat endpoints for a provider. The first one is the normalized
 * OpenAI-compatible endpoint; alternatives are needed for providers such as
 * MiniMax that still expose a legacy chatcompletion path.
 */
export function providerChatUrls(p: EngineProvider): string[] {
  if (p.kind === "key_only") {
    return ["https://openrouter.ai/api/v1/chat/completions"];
  }
  return chatUrlCandidates(p.baseUrl ?? "", p.presetId);
}

export function providerModelsUrl(p: EngineProvider): string {
  return providerModelsUrls(p)[0] ?? "";
}

export function providerModelsUrls(p: EngineProvider): string[] {
  if (p.kind === "key_only") return ["https://openrouter.ai/api/v1/models"];
  return modelsUrlCandidates(p.baseUrl ?? "", p.presetId);
}

/** هل المزوّد الأول (مفتاح + رابط) مفعّل؟ — للتوافق القديم */
export function isCustomEndpoint(): boolean {
  return usableProviders().some((p) => p.kind === "key_url");
}

export function pickCustomModels(baseUrl: string, key: string): Promise<string[]> {
  void baseUrl;
  void key;
  const p = usableProviders()[0];
  if (!p) return Promise.resolve(FALLBACK_MODELS);
  return Promise.resolve(modelCandidates(p.presetId, engine.discovered[p.id] ?? [], p.model));
}

export function getOpenRouterKey(providedKey?: string | null): string {
  if (providedKey && providedKey.trim().length > 10) return providedKey.trim();
  const p = usableProviders()[0];
  return p?.apiKey?.trim() ?? "";
}

export function getAdminKeyPreview(): string {
  const n = usableProviders().length;
  return n > 0 ? `${n} مزوّد مفعّل (مركز API)` : "لا مزوّد مفعّل — اضبطه من مركز API";
}

export function ensureWorkingModel(model?: string | null): string {
  return model && model.trim() ? model : DEFAULT_MODEL;
}

export function getSystemInfo() {
  const providers = usableProviders();
  return {
    providers: providers.map((p) => ({ id: p.id, kind: p.kind, presetId: p.presetId })),
    hasEnvKey: providers.length > 0,
    envKeyPreview: getAdminKeyPreview(),
    models: FREE_MODELS,
    defaultModel: DEFAULT_MODEL,
    guard: engine.guard,
    deputyOnline,
  };
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
  if (!deputyOnline) throw new Error("أنظمة AI الحرة معطّلة — انتظر نجاح نائب المالك أولاً.");
}

// ═══════════════════════════════════════════════════════════════════════
// بناء الطلب ومطابقة استجابة المزوّد
// ═══════════════════════════════════════════════════════════════════════

type ChatMessage = { role: string; content: string };

type BuiltRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export function buildRequest(input: {
  provider: EngineProvider;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
  label: string;
  /** Optional alternate endpoint selected by the resilient caller. */
  url?: string;
}): BuiltRequest {
  const preset = getPreset(input.provider.presetId);
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.maxTokens,
    temperature: input.temperature,
    stream: false,
  };
  if (input.jsonMode && preset.supportsJsonMode) body.response_format = { type: "json_object" };
  if (preset.reasoningSplit) body.reasoning_split = true;
  if (
    preset.thinkingToggle &&
    preset.thinkingTogglePrefixes.some((pre) => input.model.startsWith(pre))
  ) {
    body.thinking = { type: "disabled" };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": "https://minds-war.app",
    "X-Title": input.label,
  };
  if (preset.authStyle === "header" && preset.authHeaderName) {
    headers[preset.authHeaderName] = input.provider.apiKey;
  } else {
    headers.Authorization = `Bearer ${input.provider.apiKey}`;
  }
  return {
    url: input.url ?? providerChatUrl(input.provider),
    headers,
    body,
  };
}

/** يستخرج نصّ الرد من OpenAI وMiniMax وواجهات JSON القديمة. */
export function readCompletion(data: unknown): { text: string; tokensIn: number; tokensOut: number } {
  const d = data as {
    choices?: Array<{
      text?: string | null;
      message?: {
        content?: unknown;
        reasoning?: string | null;
        reasoning_content?: string | null;
        reasoning_details?: Array<{ text?: string }>;
      };
    }>;
    reply?: unknown;
    response?: unknown;
    output_text?: unknown;
    content?: unknown;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const contentToText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((part) => {
          if (typeof part === "string") return part;
          const p = part as { text?: unknown; content?: unknown };
          return typeof p.text === "string" ? p.text : contentToText(p.content);
        })
        .join(" ");
    }
    if (value && typeof value === "object") {
      const p = value as { text?: unknown; content?: unknown };
      return typeof p.text === "string" ? p.text : contentToText(p.content);
    }
    return "";
  };

  const choice = d?.choices?.[0];
  const direct =
    contentToText(choice?.message?.content) ||
    contentToText(choice?.text) ||
    contentToText(d?.output_text) ||
    contentToText(d?.content) ||
    contentToText(d?.reply) ||
    contentToText(d?.response);
  const details = Array.isArray(choice?.message?.reasoning_details)
    ? choice!.message!.reasoning_details!.map((r) => r?.text ?? "").join(" ")
    : "";
  const reasoning =
    (typeof choice?.message?.reasoning_content === "string" && choice.message.reasoning_content) ||
    (typeof choice?.message?.reasoning === "string" && choice.message.reasoning) ||
    details;
  const text = direct.trim().length > 0 ? stripThinking(direct) : stripThinking(String(reasoning ?? ""));
  const usage = d?.usage ?? {};
  return {
    text,
    tokensIn: Number(usage.prompt_tokens ?? 0) || 0,
    tokensOut: Number(usage.completion_tokens ?? 0) || 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// التوثيق — لا يُسقط استدعاءً أبداً
// ═══════════════════════════════════════════════════════════════════════

type ReportInput = {
  ok: boolean;
  provider: string;
  providerKind: string;
  task: string;
  label: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  cached: boolean;
  attempt: number;
  error?: string;
  promptChars: number;
  cacheFp?: string;
  cacheReply?: string;
  cacheTtlMs: number;
};

async function report(input: ReportInput): Promise<void> {
  const ctx = activeCtx as { runMutation?: (...a: unknown[]) => Promise<unknown> } | null;
  if (!ctx?.runMutation) return;
  try {
    await ctx.runMutation(internal.apiCenterStore.recordCall, {
      ...input,
      at: Date.now(),
      failureThreshold: engine.guard.failureThreshold,
      guardOn: engine.guard.enabled,
    });
  } catch {
    // التوثيق نفسه لا يجوز أن يُسقط الاستدعاء
  }
}

// ═══════════════════════════════════════════════════════════════════════
// الاستدعاء الموحّد
// ═══════════════════════════════════════════════════════════════════════

export type LlmResult = {
  text: string;
  task: string;
  provider: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  cached: boolean;
  attempts: number;
};

export type LlmOptions = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  label: string;
  jsonMode: boolean;
  /** تجاوز الوحدة صراحةً (اختياري) */
  task?: string;
};

export async function callLlmDetailed(opts: LlmOptions): Promise<LlmResult> {
  const started = Date.now();
  const label = opts.label || "Zaka AI";
  const task = opts.task ?? matchTaskFromLabel(label);
  const route = resolveRoute(task);
  const promptChars = opts.messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);

  if (!route.enabled) {
    throw new Error(`وحدة «${route.label}» موقوفة من مركز API — فعّلها أو غيّر التوجيه.`);
  }

  const providers = usableProviders();
  if (providers.length === 0) {
    throw new Error("لا يوجد مزوّد AI مفعّل. اضبط المفتاح والرابط من مركز API في غرفة المالك.");
  }

  const temperature = typeof route.temperature === "number" ? route.temperature : opts.temperature;
  const maxTokens = route.maxTokens > 0 ? Math.min(opts.maxTokens, route.maxTokens) : opts.maxTokens;
  const jsonMode = opts.jsonMode || route.needsJson;
  const cacheTtlMs = route.cacheTtlMs;

  const head = providers[0];
  const fp =
    cacheTtlMs > 0 && engine.guard.cacheEnabled
      ? promptFingerprint(opts.messages, route.model ?? head.model ?? head.presetId, temperature)
      : "";

  // ① فحص واحد: الكاش + لقطة الحدود
  if (activeCtx && (fp || engine.guard.enabled)) {
    const ctx = activeCtx as { runQuery?: (...a: unknown[]) => Promise<unknown> } | null;
    if (ctx?.runQuery) {
      try {
        const snap = (await ctx.runQuery(internal.apiCenterStore.preflight, {
          fp: fp || undefined,
          now: Date.now(),
        })) as {
          cache: { reply: string } | null;
          minuteCalls: number;
          dayCalls: number;
          dayTokens: number;
          circuitOpen: boolean;
          circuitOpenedAt: number | null;
          failures: number;
        };
        const decision = decideCall({
          guard: engine.guard,
          snapshot: {
            minuteCalls: snap.minuteCalls,
            dayCalls: snap.dayCalls,
            dayTokens: snap.dayTokens,
            circuitOpen: Boolean(snap.circuitOpen),
            circuitOpenedAt: snap.circuitOpenedAt,
            failures: snap.failures,
          },
          cacheReply: snap.cache?.reply ?? null,
          cacheAllowed: cacheTtlMs > 0,
          now: Date.now(),
        });

        if (decision.outcome === "cache") {
          await report({
            ok: true,
            provider: head.id,
            providerKind: "cached",
            task,
            label,
            model: route.model ?? head.model ?? "—",
            latencyMs: Date.now() - started,
            tokensIn: 0,
            tokensOut: 0,
            cached: true,
            attempt: 0,
            promptChars,
            cacheFp: fp,
            cacheTtlMs: 0,
          });
          return {
            text: decision.reply,
            task,
            provider: head.id,
            model: route.model ?? head.model ?? "—",
            latencyMs: Date.now() - started,
            tokensIn: 0,
            tokensOut: 0,
            cached: true,
            attempts: 0,
          };
        }

        if (decision.outcome === "block") {
          await report({
            ok: false,
            provider: head.id,
            providerKind: head.kind,
            task,
            label,
            model: route.model ?? head.model ?? "—",
            latencyMs: Date.now() - started,
            tokensIn: 0,
            tokensOut: 0,
            cached: false,
            attempt: 0,
            error: decision.reason,
            promptChars,
            cacheTtlMs: 0,
          });
          throw new Error(`مركز API أوقف الطلب: ${decision.reason}`);
        }
      } catch (e) {
        // أوقفه القرار صراحةً ⇒ يخرج. أي خطأ آخر في الفحص لا يمنع الاستدعاء.
        if (e instanceof Error && e.message.startsWith("مركز API أوقف الطلب:")) throw e;
      }
    }
  }

  // ② سلسلة المحاولات: مزوّد ← نماذج ← مسارات محادثة ← محاولتان.
  // المسارات البديلة مهمة: MiniMax يعلن مسار OpenAI，但也 يعرّض مسارات
  // chatcompletion legacy. Previously those alternatives were documented but
  // never actually attempted, so one 404 made every AI tab fail together.
  let lastErr = "فشل استدعاء AI";
  let attempts = 0;
  let lastModel = route.model ?? head.model ?? "—";

  for (const provider of providers) {
    const chain = modelCandidates(
      provider.presetId,
      engine.discovered[provider.id] ?? [],
      route.model ?? provider.model ?? null,
    ).slice(0, MAX_MODEL_CANDIDATES);
    const urls = providerChatUrls(provider);
    let providerFatal = false;

    for (const model of chain) {
      if (providerFatal) break;
      lastModel = model;
      let dropped = false;

      for (const url of urls) {
        if (providerFatal) break;
        for (let attempt = 0; attempt < 2; attempt++) {
          attempts += 1;
          const built = buildRequest({
            provider,
            model,
            messages: opts.messages,
            maxTokens,
            temperature,
            jsonMode,
            label,
            url,
          });
          if (dropped) {
            delete built.body.response_format;
            delete built.body.reasoning_split;
            delete built.body.thinking;
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
          const at = Date.now();
          try {
            const response = await fetch(built.url, {
              method: "POST",
              headers: built.headers,
              body: JSON.stringify(built.body),
              signal: controller.signal,
            });
            const latencyMs = Date.now() - at;
            const raw = await response.text().catch(() => "");

            if (!response.ok) {
              lastErr = humanizeProviderError(response.status, raw);
              const unsupportedExtra =
                response.status === 400 &&
                /response_format|reasoning_split|thinking|max_tokens|stream/i.test(raw) &&
                !dropped;
              if (unsupportedExtra) {
                dropped = true;
                continue;
              }
              await report({
                ok: false,
                provider: provider.id,
                providerKind: provider.kind,
                task,
                label,
                model,
                latencyMs,
                tokensIn: 0,
                tokensOut: 0,
                cached: false,
                attempt,
                error: lastErr,
                promptChars,
                cacheTtlMs: 0,
              });

              // Path failures are retriable on the next candidate endpoint.
              if (isPathFailure(response.status)) break;
              // A rejected key or exhausted balance applies to the whole provider.
              if (isAuthFailure(response.status) || response.status === 402 || isBalanceFailure(response.status, raw)) {
                providerFatal = true;
                break;
              }
              // 429 and other request errors can be model-specific; continue
              // with the remaining model candidates.
              continue;
            }

            let parsed: unknown = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = null;
            }
            const plainTextIsUsable =
              !parsed && raw.trim().length > 0 && !/^\s*(<!doctype|<html|<\?xml)/i.test(raw);
            const { text, tokensIn, tokensOut } = parsed
              ? readCompletion(parsed)
              : plainTextIsUsable
                ? { text: stripThinking(raw.slice(0, 4000)), tokensIn: 0, tokensOut: 0 }
                : { text: "", tokensIn: 0, tokensOut: 0 };

            if (!text.trim()) {
              lastErr = "المزوّد أعاد رداً فارغاً أو استجابة غير مفهومة";
              continue;
            }

            const msgText = opts.messages.map((m) => m.content).join(" ");
            await report({
              ok: true,
              provider: provider.id,
              providerKind: provider.kind,
              task,
              label,
              model,
              latencyMs,
              tokensIn: tokensIn || estimateTokens(msgText),
              tokensOut: tokensOut || estimateTokens(text),
              cached: false,
              attempt,
              promptChars,
              cacheFp: fp || undefined,
              cacheReply: fp ? text : undefined,
              cacheTtlMs,
            });

            return {
              text,
              task,
              provider: provider.id,
              model,
              latencyMs,
              tokensIn,
              tokensOut,
              cached: false,
              attempts,
            };
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "خطأ شبكة";
          } finally {
            clearTimeout(timer);
          }
        }
      }
    }
  }

  await report({
    ok: false,
    provider: head.id,
    providerKind: head.kind,
    task,
    label,
    model: lastModel,
    latencyMs: Date.now() - started,
    tokensIn: 0,
    tokensOut: 0,
    cached: false,
    attempt: attempts,
    error: lastErr,
    promptChars,
    cacheTtlMs: 0,
  });
  throw new Error(lastErr);
}

/** ⚡ الواجهة المستخدمة في كل اللعبة — نفس التوقيع القديم حرفياً */
export async function callLlm(
  messages: ChatMessage[],
  maxTokens = 900,
  temperature = 0.9,
  label = "Zaka AI",
  _apiKey?: string | null,
  jsonMode = false,
  task?: string,
): Promise<string> {
  void _apiKey; // مُهمَل بالقصد — المصدر الوحيد للمفاتيح هو مركز API
  const res = await callLlmDetailed({ messages, maxTokens, temperature, label, jsonMode, task });
  return res.text;
}

export async function callOpenRouterDirect(
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
  label: string,
  _apiKey?: string | null,
): Promise<string> {
  void _apiKey; // مُهمَل بالقصد — المصدر الوحيد للمفاتيح هو مركز API
  return callLlm(messages, maxTokens, temperature, label);
}
