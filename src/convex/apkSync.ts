/**
 * تحميل ملف APK الرسمي من المرآة الموثّقة وتخزينه في تخزين Convex الدائم —
 * فيبقى التنزيل متاحاً ببايتات مطابقة للبصمة الرسمية مهما تعطّل خادم
 * الملفات الثابت (الذي كان يُفسد الملفات الثنائية أثناء المزامنة).
 *
 * كيف يعمل:
 * - «المدير الآلي» يستدعي `syncApkFromSources` كل 10 دقائق (crons).
 * - يجرّب المرآة الموثّقة: يفحص الحجم + بصمة SHA-256 قبل التخزين — لا
 *   يُخزَّن في Convex storage إلا ملف مطابق تماماً للبصمة الرسمية.
 * - يخزّن النتيجة في جدول `apkRelease` (رابط التخزين + الحالة) ويقرأها
 *   صفحة التحميل وداخل التطبيق للتنزيل الموثّق.
 */
import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { APK_BYTES, APK_MIRROR_PAGE_URL, APK_MIRROR_URL, APK_SHA256 } from "./apkRelease";
import { internal } from "./_generated/api";

/** مفتاح الصف الوحيد في جدول apkRelease. */
const RELEASE_KEY = "current";

async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  try {
    const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
    if (!cryptoApi?.subtle) return null;
    const buf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const digest = await cryptoApi.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** حفظ حالة الإصدار الحالي (upsert) — يُستدعى من داخل الدوال فقط. */
export const saveRelease = internalMutation({
  args: {
    key: v.string(),
    storageId: v.optional(v.string()),
    storageUrl: v.optional(v.string()),
    size: v.optional(v.number()),
    sha256: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lastSyncAt: v.number(),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("apkRelease")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId ?? existing.storageId,
        storageUrl: args.storageUrl ?? existing.storageUrl,
        size: args.size ?? existing.size,
        sha256: args.sha256 ?? existing.sha256,
        sourceUrl: args.sourceUrl ?? existing.sourceUrl,
        lastSyncAt: args.lastSyncAt,
        lastError: args.lastError,
      });
    } else {
      await ctx.db.insert("apkRelease", {
        key: args.key,
        storageId: args.storageId,
        storageUrl: args.storageUrl,
        size: args.size,
        sha256: args.sha256,
        sourceUrl: args.sourceUrl,
        lastSyncAt: args.lastSyncAt,
        lastError: args.lastError,
      });
    }
  },
});

/**
 * مزامنة ملف APK في تخزين Convex الدائم — يُستدعى تلقائياً كل 10 دقائق
 * من crons، ويمكن استدعاؤه يدوياً من غرفة المالك عند الحاجة.
 */
export const syncApkFromSources = internalAction({
  args: {},
  handler: async (ctx) => {
    const sources = [APK_MIRROR_URL].filter((u): u is string => Boolean(u));
    let lastError: string | null =
      sources.length === 0 ? "لا يوجد مصدر تحميل (APK_MIRROR_URL فارغ)" : null;

    for (const source of sources) {
      try {
        const res = await fetch(source, { cache: "no-store" });
        if (!res.ok) {
          lastError = `${source} → HTTP ${res.status}`;
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length !== APK_BYTES) {
          lastError = `${source} → الحجم ${buf.length} ≠ المتوقع ${APK_BYTES}`;
          continue;
        }
        const digest = await sha256Hex(buf);
        if (!digest || digest !== APK_SHA256) {
          lastError = `${source} → بصمة غير مطابقة (${digest ?? "غير محسوبة"})`;
          continue;
        }
        const storageId = await ctx.storage.store(new Blob([buf]));
        const storageUrl = await ctx.storage.getUrl(storageId);
        await ctx.runMutation(internal.apkSync.saveRelease, {
          key: RELEASE_KEY,
          storageId,
          storageUrl: storageUrl ?? undefined,
          size: buf.length,
          sha256: digest,
          sourceUrl: source,
          lastSyncAt: Date.now(),
          lastError: undefined,
        });
        return { ok: true, storageUrl };
      } catch (error) {
        lastError = `${source} → ${error instanceof Error ? error.message : "خطأ غير معروف"}`;
      }
    }

    await ctx.runMutation(internal.apkSync.saveRelease, {
      key: RELEASE_KEY,
      lastSyncAt: Date.now(),
      lastError: lastError ?? undefined,
      sourceUrl: sources[0],
    });
    return { ok: false, error: lastError };
  },
});

/** قراءة حالة إصدار APK الحالية — مصدر الحقيقة لصفحة التحميل وداخل التطبيق. */
export const getApkRelease = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("apkRelease")
      .withIndex("by_key", (q) => q.eq("key", RELEASE_KEY))
      .first();

    let storageUrl: string | null = row?.storageUrl ?? null;
    if (row?.storageId) {
      // رابط مُحدَّث إن كان الرابط المخزّن منتهي الصلاحية.
      try {
        const fresh = await ctx.storage.getUrl(row.storageId as Id<"_storage">);
        if (fresh) storageUrl = fresh;
      } catch {
        // يبقى الرابط المخزّن — ستعيد المزامنة التالية توليده.
      }
    }

    return {
      storageUrl,
      storageId: row?.storageId ?? null,
      size: row?.size ?? APK_BYTES,
      sha256: row?.sha256 ?? APK_SHA256,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      mirrorUrl: APK_MIRROR_URL,
      mirrorPageUrl: APK_MIRROR_PAGE_URL,
    };
  },
});
