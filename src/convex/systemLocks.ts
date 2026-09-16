import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔒 أقفال الأنظمة — التنفيذ الحقيقي لقرارات الطوارئ من غرفة المالك
 *
 *  المشكلة التي يحلّها هذا الملف: أقفال الطوارئ كانت **تُكتَب ولا تُنفَّذ**،
 *  فزر «قفل الاقتصاد» لم يكن يمنع أي شراء فعلياً. الآن كل إجراء حسّاس يمر
 *  من هنا، فينعكس قرار المالك على كل طبقات اللعبة فوراً — بلا استثناء.
 *
 *  الأقفال تُخزَّن في جدول `settings` تحت هذه المفاتيح:
 *    crownLockArena · crownLockChat · crownLockEconomy   (+ siteLocked الرسمي)
 *  وكل قفل يحمل سبباً مكتوباً ووقتاً اختيارياً للفتح التلقائي.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type LockSystem = "arena" | "chat" | "economy" | "site";

const LOCK_KEYS: Record<Exclude<LockSystem, "site">, string> = {
  arena: "crownLockArena",
  chat: "crownLockChat",
  economy: "crownLockEconomy",
};

const SYSTEM_LABEL: Record<LockSystem, string> = {
  arena: "الساحة والمبارزات",
  chat: "الدردشة والمجتمع",
  economy: "الاقتصاد والمتجر",
  site: "الموقع بالكامل",
};

type LockState = { locked: boolean; until: number | null; reason: string };

const OPEN: LockState = { locked: false, until: null, reason: "" };

/** قراءة حالة قفل نظام — القفل المنتهي يُعامل كأنه مفتوح فوراً */
export async function readLock(ctx: any, system: LockSystem): Promise<LockState> {
  const key = system === "site" ? "siteLocked" : LOCK_KEYS[system];
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key" as any, (q: any) => q.eq("key", key))
    .first();
  if (!row) return OPEN;
  const raw = row.value as string;
  try {
    const parsed = JSON.parse(raw);
    // قفل الموقع مخزَّن كقيمة منطقية صريحة
    if (typeof parsed === "boolean") {
      return parsed ? { locked: true, until: null, reason: "" } : OPEN;
    }
    const expired = parsed.until && parsed.until < Date.now();
    if (expired || !parsed.locked) return OPEN;
    return { locked: true, until: parsed.until ?? null, reason: parsed.reason ?? "" };
  } catch {
    return OPEN;
  }
}

/**
 * يرمي خطأً عربياً واضحاً إذا كان النظام مقفلاً — تُستدعى قبل أي إجراء حسّاس.
 * خطأ تشغيلي مقصود (ليس عطلاً) ليصل صدى قرار المالك إلى اللاعب مباشرة.
 */
export async function assertSystemOpen(ctx: any, system: LockSystem): Promise<void> {
  const state = await readLock(ctx, system);
  if (!state.locked) return;
  const endsAt = state.until
    ? ` — يُفتح تلقائياً ${new Date(state.until).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}`
    : "";
  const why = state.reason ? ` السبب: ${state.reason}` : "";
  throw new Error(`⛔ ${SYSTEM_LABEL[system]} مقفلة مؤقتاً بقرار الإدارة.${endsAt}${why}`);
}

/** حالة الأقفال لكل الواجهات — لتُظهر للاعب الحقيقة بدل أزرار لا تعمل */
export const getLockStatus = query({
  args: {},
  handler: async (ctx) => {
    const [arena, chat, economy, site] = await Promise.all([
      readLock(ctx, "arena"),
      readLock(ctx, "chat"),
      readLock(ctx, "economy"),
      readLock(ctx, "site"),
    ]);
    return { arena, chat, economy, site, at: Date.now() };
  },
});

/** وصف مقروء لحالة قفل واحد — للاستخدام في الرسائل والإشعارات */
export const LOCK_SYSTEM_LABEL = SYSTEM_LABEL;
export const LOCK_SYSTEM_VALIDATOR = v.union(
  v.literal("arena"),
  v.literal("chat"),
  v.literal("economy"),
  v.literal("site"),
);
