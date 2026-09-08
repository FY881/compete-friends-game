/**
 * ═══════════════════════════════════════════════════════════════
 * مركز API — النظامان الوحيدان (System A / System B)
 * ═══════════════════════════════════════════════════════════════
 *
 *  ⚙️ النظام الأول (System A): مفتاح API + رابط المزود (URL).
 *  🔑 النظام الثاني (System B): مفتاح API فقط (بوابة افتراضية).
 *
 * يُخزَّن النظامان في جدول settings (مستمر عبر الجلسات) ويُحقن
 * في محرك aiConfig عبر setRuntimeConfig. كل عملية تحقق هي طلب
 * شبكة حقيقي، والناتج (نجاح/فشل + زمن + الرد) يُسجَّل دليلاً
 * قابلاً للتحقق في apiCallLogs + apiEvents.
 * ═══════════════════════════════════════════════════════════════
 */
"use node";

import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { setRuntimeConfig, getRuntimeConfig, DEFAULT_MODEL } from "./aiConfig";

const SETTING_A = "apiSystemA";
const SETTING_B = "apiSystemB";

const DEFAULT_GATEWAY = "https://openrouter.ai/api/v1/chat/completions";

type StoredSystem = {
  apiKey: string;
  baseUrl?: string;
  updatedAt: number;
};

async function readSetting(ctx: any, key: string): Promise<StoredSystem | null> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  if (!row) return null;
  try {
    const v = JSON.parse(row.value) as StoredSystem;
    return v.apiKey ? v : null;
  } catch {
    return null;
  }
}

async function writeSetting(ctx: any, key: string, value: StoredSystem): Promise<void> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  const json = JSON.stringify(value);
  if (row) await ctx.db.patch(row._id, { value: json });
  else await ctx.db.insert("settings", { key, value: json });
}

/** إعادة حقن النظامين في محرك aiConfig بعد أي تغيير */
async function refreshRuntime(ctx: any): Promise<void> {
  const a = await readSetting(ctx, SETTING_A);
  const b = await readSetting(ctx, SETTING_B);
  const systems = [];
  if (a) systems.push({ kind: "key_url" as const, apiKey: a.apiKey, baseUrl: a.baseUrl });
  if (b) systems.push({ kind: "key_only" as const, apiKey: b.apiKey });
  setRuntimeConfig(systems);
}

// ── قراءة الحالة (مفتاح مخفي جزئياً) ────────────────────────────
export const getSystems = query({
  args: {},
  handler: async (ctx) => {
    const a = await readSetting(ctx, SETTING_A);
    const b = await readSetting(ctx, SETTING_B);
    const mask = (k?: string) => (k && k.length > 10 ? `${k.slice(0, 6)}••••${k.slice(-4)}` : k);
    return {
      systemA: a ? { apiKey: mask(a.apiKey), baseUrl: a.baseUrl, updatedAt: a.updatedAt } : null,
      systemB: b ? { apiKey: mask(b.apiKey), updatedAt: b.updatedAt } : null,
      runtime: getRuntimeConfig(),
    };
  },
});

// ── النظام الأول (System A): مفتاح + رابط ────────────────────────
export const saveSystemA = mutation({
  args: { apiKey: v.string(), baseUrl: v.string() },
  handler: async (ctx, { apiKey, baseUrl }) => {
    const key = apiKey.trim();
    const url = baseUrl.trim();
    if (key.length < 10) throw new Error("مفتاح API قصير جداً (يجب أن يتجاوز 10 أحرف).");
    if (!url.startsWith("http://") && !url.startsWith("https://"))
      throw new Error("رابط المزود غير صالح — يجب أن يبدأ بـ http:// أو https://");
    await writeSetting(ctx, SETTING_A, { apiKey: key, baseUrl: url, updatedAt: Date.now() });
    await refreshRuntime(ctx);
    return { ok: true, apiKey: `${key.slice(0, 6)}••••${key.slice(-4)}`, baseUrl: url };
  },
});

// ── النظام الثاني (System B): مفتاح فقط ──────────────────────────
export const saveSystemB = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    const key = apiKey.trim();
    if (key.length < 10) throw new Error("مفتاح API قصير جداً (يجب أن يتجاوز 10 أحرف).");
    await writeSetting(ctx, SETTING_B, { apiKey: key, updatedAt: Date.now() });
    await refreshRuntime(ctx);
    return { ok: true, apiKey: `${key.slice(0, 6)}••••${key.slice(-4)}` };
  },
});

// ── حذف نظام ─────────────────────────────────────────────────────
export const deleteSystem = mutation({
  args: { which: v.union(v.literal("systemA"), v.literal("systemB")) },
  handler: async (ctx, { which }) => {
    const key = which === "systemA" ? SETTING_A : SETTING_B;
    const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
    if (row) await ctx.db.delete(row._id);
    await refreshRuntime(ctx);
    return { ok: true };
  },
});

/**
 * 🧪 تحقق حقيقي: طلب شبكة فعلي إلى النظام المختار، يكتب دليلاً
 * (نجاح/فشل + زمن + الحالة + الرد) في السجل، ويعيده للواجهة.
 *
 * يُسجَّل الدليل عبر apiHubStore.logCall + logApiEvent (متاحان مسبقاً)
 * تجنّباً لأي مرجع ذاتي عبر api في نفس الملف.
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
    const stored = await readSetting(ctx, which === "systemA" ? SETTING_A : SETTING_B);
    if (!stored) throw new Error("النظام غير مضبوط — احفظه أولاً.");
    const url =
      which === "systemA" && stored.baseUrl ? stored.baseUrl : DEFAULT_GATEWAY;
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
          model: DEFAULT_MODEL,
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
          provider: which === "systemA" ? "systemA" : "systemB",
          model: DEFAULT_MODEL,
          keyUsed: which === "systemA" ? "systemA" : "systemB",
          latencyMs,
          tokensIn: 0,
          tokensOut: 0,
          taskType: "verify",
        });
        await ctx.runMutation(internal.apiHubStore.logApiEvent, {
          provider: which === "systemA" ? "systemA" : "systemB",
          event: "verify_ok",
          detail: `تحقق ناجح (${latencyMs}ms): ${reply || "استجابة فارغة"}`,
          severity: "info",
          at: Date.now(),
        });
        return { ok: true, system: which, url, latencyMs, status: response.status, reply, proofLogged: true };
      }
      await ctx.runMutation(internal.apiHubStore.logCall, {
        ok: false,
        provider: which === "systemA" ? "systemA" : "systemB",
        model: DEFAULT_MODEL,
        keyUsed: which === "systemA" ? "systemA" : "systemB",
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        taskType: "verify",
      });
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: which === "systemA" ? "systemA" : "systemB",
        event: "verify_fail",
        detail: `فشل (${response.status}): ${text.slice(0, 200)}`,
        severity: "warning",
        at: Date.now(),
      });
      return { ok: false, system: which, url, latencyMs, status: response.status, error: text.slice(0, 200), proofLogged: true };
    } catch (e) {
      const latencyMs = Date.now() - started;
      const msg = e instanceof Error ? e.message : "خطأ شبكة";
      await ctx.runMutation(internal.apiHubStore.logCall, {
        ok: false,
        provider: which === "systemA" ? "systemA" : "systemB",
        model: DEFAULT_MODEL,
        keyUsed: which === "systemA" ? "systemA" : "systemB",
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        taskType: "verify",
      });
      await ctx.runMutation(internal.apiHubStore.logApiEvent, {
        provider: which === "systemA" ? "systemA" : "systemB",
        event: "verify_fail",
        detail: `فشل شبكة: ${msg}`,
        severity: "warning",
        at: Date.now(),
      });
      return { ok: false, system: which, url, latencyMs, status: 0, error: msg, proofLogged: true };
    }
  },
});

// ── سجل الإثبات الأخير (آخر عمليات التحقق) ──────────────────────
export const getProofLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const calls = await ctx.db
      .query("apiCallLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(limit ?? 20);
    const events = await ctx.db
      .query("apiEvents")
      .withIndex("by_created", (q) => q.gte("at", 0))
      .order("desc")
      .take(limit ?? 20);
    return { calls, events };
  },
});