// ═══════════════════════════════════════════════════════════════
// مركز API — مخزن النظامين (System A / System B) — بدون Node runtime
// يُخزَّن النظامان في جدول settings ويُحقن في محرك aiConfig.
// ═══════════════════════════════════════════════════════════════
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SETTING_A = "apiSystemA";
const SETTING_B = "apiSystemB";

type StoredSystem = {
  apiKey: string;
  baseUrl?: string;
  updatedAt: number;
};

async function readSetting(ctx: any, key: string): Promise<StoredSystem | null> {
  const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as StoredSystem;
    return parsed.apiKey ? parsed : null;
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

// ── قراءة الحالة (المفتاح مخفي جزئياً) ──────────────────────────
export const getSystems = query({
  args: {},
  handler: async (ctx) => {
    const a = await readSetting(ctx, SETTING_A);
    const b = await readSetting(ctx, SETTING_B);
    const mask = (k?: string) => (k && k.length > 10 ? `${k.slice(0, 6)}••••${k.slice(-4)}` : k);
    return {
      systemA: a ? { apiKey: mask(a.apiKey), baseUrl: a.baseUrl, updatedAt: a.updatedAt } : null,
      systemB: b ? { apiKey: mask(b.apiKey), updatedAt: b.updatedAt } : null,
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
    return { ok: true };
  },
});

// ── سجل الإثبات (آخر عمليات التحقق) ─────────────────────────────
export const getProofLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const calls = await ctx.db
      .query("apiCallLogs")
      .withIndex("by_created", (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(limit ?? 20);
    const events = await ctx.db
      .query("apiEvents")
      .withIndex("by_created", (q: any) => q.gte("at", 0))
      .order("desc")
      .take(limit ?? 20);
    return { calls, events };
  },
});