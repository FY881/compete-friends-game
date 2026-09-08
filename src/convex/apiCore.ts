/**
 * ═══════════════════════════════════════════════════════════════
 * مركز API — التحقق الحقيقي (Node runtime — actions فقط)
 * ═══════════════════════════════════════════════════════════════
 *
 *  ⚙️ النظام الأول (System A): مفتاح API + رابط المزود (URL).
 *  🔑 النظام الثاني (System B): مفتاح API فقط (بوابة افتراضية).
 *
 * كل تحقق هو طلب شبكة حقيقي (fetch). الدليل (نجاح/فشل + زمن +
 * الحالة + الرد) يُسجَّل في apiCallLogs + apiEvents — قابل للتحقق.
 * ═══════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DEFAULT_MODEL, pickCustomModels, setRuntimeConfig } from "./aiConfig";

/**
 * 🔌 الربط الحقيقي: يقرأ النظامين من قاعدة البيانات ويحقنهما في محرك
 * الاستدعاء (aiConfig) قبل أي استدعاء AI. تُستدعى من كل الأنظمة
 * التي تستدعي callLlm — فلا يعمل أي استدعاء خارج النظامين أبداً.
 */
export async function ensureAiRuntime(ctx: any): Promise<void> {
  try {
    const a = (await ctx.runQuery(internal.apiCoreInternal.readStored, { key: "apiSystemA" })) as
      | { apiKey: string; baseUrl?: string }
      | null;
    const b = (await ctx.runQuery(internal.apiCoreInternal.readStored, { key: "apiSystemB" })) as
      | { apiKey: string }
      | null;
    const systems = [];
    if (a && a.apiKey && a.apiKey.length > 10) {
      systems.push({ kind: "key_url" as const, apiKey: a.apiKey, baseUrl: a.baseUrl });
    }
    if (b && b.apiKey && b.apiKey.length > 10) {
      systems.push({ kind: "key_only" as const, apiKey: b.apiKey });
    }
    setRuntimeConfig(systems);
  } catch {
    // بلا نظامين مضبوطين — callLlm سيرمي خطأ واضحاً عند الاستدعاء
    setRuntimeConfig([]);
  }
}

const DEFAULT_GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

type StoredSystem = {
  apiKey: string;
  baseUrl?: string;
  updatedAt: number;
};

/** قراءة النظام من settings (نسخة داخل action عبر internalQuery) */
async function readSystem(ctx: any, which: "systemA" | "systemB"): Promise<StoredSystem | null> {
  const key = which === "systemA" ? "apiSystemA" : "apiSystemB";
  return (await ctx.runQuery(internal.apiCoreInternal.readStored, { key })) as StoredSystem | null;
}

/**
 * 🧪 تحقق حقيقي: طلب شبكة فعلي إلى النظام المختار، يكتب دليلاً
 * (نجاح/فشل + زمن + الحالة + الرد) في السجل، ويعيده للواجهة.
 */
export const verifySystem = action({
  args: { which: v.union(v.literal("systemA"), v.literal("systemB")) },
  handler: async (ctx, { which }): Promise<{
    ok: boolean;
    system: string;
    url: string;
    latencyMs: number;
    status: number;
    reply?: string;
    error?: string;
    proofLogged: boolean;
  }> => {
    const stored = await readSystem(ctx, which);
    if (!stored) throw new Error("النظام غير مضبوط — احفظه أولاً.");
    const url = which === "systemA" && stored.baseUrl ? stored.baseUrl : DEFAULT_GATEWAY;
    const systemName = which === "systemA" ? "systemA" : "systemB";

    // النظام الأول (رابط خاص) قد لا يقبل أسماء نماذج OpenRouter — نكتشف نموذجاً حقيقياً صالحاً.
    const verifyModel =
      which === "systemA" ? (await pickCustomModels(url, stored.apiKey))[0] : DEFAULT_MODEL;

    const started = Date.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stored.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://zaka.app",
          "X-Title": "Zaka Verify",
        },
        body: JSON.stringify({
          model: verifyModel,
          messages: [{ role: "user", content: "قل: جاهز" }],
          max_tokens: 20,
        }),
      });
      const latencyMs = Date.now() - started;
      const text = await response.text().catch(() => "");

      if (response.ok) {
        let reply = "";
        try {
          const j = JSON.parse(text);
          reply = String(j?.choices?.[0]?.message?.content ?? "").slice(0, 200);
        } catch {
          reply = text.slice(0, 200);
        }
        await ctx.runMutation(internal.apiHubStore.logCall, {
          ok: true,
          provider: systemName,
          model: DEFAULT_MODEL,
          keyUsed: systemName,
          latencyMs,
          tokensIn: 0,
          tokensOut: 0,
          taskType: "verify",
        });
        await ctx.runMutation(internal.apiHubStore.logApiEvent, {
          provider: systemName,
          event: "verify_ok",
          detail: `تحقق ناجح (${latencyMs}ms): ${reply || "استجابة فارغة"}`,
          severity: "info",
          at: Date.now(),
        });
        return { ok: true, system: systemName, url, latencyMs, status: response.status, reply, proofLogged: true };
      }

      await ctx.runMutation(internal.apiHubStore.logCall, {
        ok: false,
        provider: systemName,
        model: DEFAULT_MODEL,
        keyUsed: systemName,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        taskType: "verify",
      });
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: systemName,
        event: "verify_fail",
        detail: `فشل (${response.status}): ${text.slice(0, 200)}`,
        severity: "warning",
        at: Date.now(),
      });
      return { ok: false, system: systemName, url, latencyMs, status: response.status, error: text.slice(0, 200), proofLogged: true };
    } catch (e) {
      const latencyMs = Date.now() - started;
      const msg = e instanceof Error ? e.message : "خطأ شبكة";
      await ctx.runMutation(internal.apiHubStore.logCall, {
        ok: false,
        provider: systemName,
        model: DEFAULT_MODEL,
        keyUsed: systemName,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        taskType: "verify",
      });
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: systemName,
        event: "verify_fail",
        detail: `فشل شبكة: ${msg}`,
        severity: "warning",
        at: Date.now(),
      });
      return { ok: false, system: systemName, url, latencyMs, status: 0, error: msg, proofLogged: true };
    }
  },
});