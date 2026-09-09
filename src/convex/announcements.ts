/**
 * ═══════════════════════════════════════════════════════════════════════
 * مركز الإعلانات المركزي
 *
 * يسمح للمالك بإنشاء أي عدد من الإعلانات، كلٌّ منها: عنوان + نص + أولوية
 * + جدولة اختيارية (بداية/نهاية). الإعلان الأحدث/الأعلى أولوية الذي لا
 * تزال جدولته سارية هو الذي يظهر للجميع عبر AnnouncementBanner.
 *
 * يحافظ على توافق مع الإعلان القديم في الإعدادات (announcement) كخيار
 * احتياطي إن لم توجد إعلانات في الجدول الجديد.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";

const PRIORITY_RANK: Record<"low" | "medium" | "high", number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  priority: "low" | "medium" | "high";
  startsAt: number | null;
  expiresAt: number | null;
  createdAt: number;
  visible: boolean; // محسوبة: active + الجدولة سارية
};

async function requireStaffUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
  const me = await ctx.db.get(userId);
  if (!isStaffUser(me)) throw new Error("غير مصرح");
  return me;
}

/** الإعلان الظاهر حالياً للجميع (أعلى أولوية ثم الأحدث) — عام وبدون صلاحيات. */
export const getActive = query({
  args: {},
  handler: async (ctx): Promise<AnnouncementRow | null> => {
    const now = Date.now();
    const rows = await ctx.db.query("announcements").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const visible = rows
      .filter((r) => (r.startsAt ?? 0) <= now && (r.expiresAt ?? Infinity) >= now)
      .sort(
        (a, b) =>
          (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
          b.createdAt - a.createdAt,
      );
    const top = visible[0];
    if (!top) return null;
    return {
      id: top._id,
      title: top.title,
      body: top.body,
      active: top.active,
      priority: top.priority,
      startsAt: top.startsAt ?? null,
      expiresAt: top.expiresAt ?? null,
      createdAt: top.createdAt,
      visible: true,
    };
  },
});

/** قائمة الإعلانات كلها للمالك. */
export const list = query({
  args: {},
  handler: async (ctx): Promise<AnnouncementRow[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;
    const now = Date.now();
    const rows = await ctx.db
      .query("announcements")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      id: r._id,
      title: r.title,
      body: r.body,
      active: r.active,
      priority: r.priority,
      startsAt: r.startsAt ?? null,
      expiresAt: r.expiresAt ?? null,
      createdAt: r.createdAt,
      visible: r.active && (r.startsAt ?? 0) <= now && (r.expiresAt ?? Infinity) >= now,
    }));
  },
});

/** إنشاء إعلان جديد. */
export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaffUser(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title && !body) throw new Error("أدخل عنواناً أو نصاً للإعلان");
    await ctx.db.insert("announcements", {
      title,
      body,
      active: true,
      priority: args.priority,
      startsAt: args.startsAt,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

/** تفعيل/إيقاف إعلان. */
export const setActive = mutation({
  args: { id: v.id("announcements"), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    await requireStaffUser(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("الإعلان غير موجود");
    await ctx.db.patch(id, { active });
  },
});

/** حذف إعلان نهائياً. */
export const remove = mutation({
  args: { id: v.id("announcements") },
  handler: async (ctx, { id }) => {
    await requireStaffUser(ctx);
    await ctx.db.delete(id);
  },
});