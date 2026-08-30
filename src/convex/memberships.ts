/**
 * ═══════════════════════════════════════════════════════════════════
 * نظام العضويات المتعددة بالأكواد السرية
 * ═══════════════════════════════════════════════════════════════════
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const MEMBERSHIP_TIERS = [
  {
    id: "bronze",
    name: "برونزي",
    emoji: "🥉",
    color: "text-amber-700 bg-amber-500/10",
    benefits: [".LOGO في البروفايل", "صورة رمزية إضافية"],
    price: "مجاني",
  },
  {
    id: "silver",
    name: "فضي",
    emoji: "🥈",
    color: "text-slate-600 bg-slate-500/10",
    benefits: ["كل مزايا البرونزي", " shoved الأسئلة", "تمييز في القائمة", "5 تلميحات يومية"],
    price: "رموز سرية",
  },
  {
    id: "gold",
    name: "ذهبي",
    emoji: "🥇",
    color: "text-yellow-600 bg-yellow-500/10",
    benefits: ["كل مزايا الفضي", " doubtedXP مضاعف 1.5x", "10 تلميحات يومية", "وصول للتحديات الخاصة"],
    price: "رموز سرية",
  },
  {
    id: "diamond",
    name: "ماسي",
    emoji: "💎",
    color: "text-blue-600 bg-blue-500/10",
    benefits: ["كل مزايا الذهبي", "XP مضاعف 2x", "20 تلميحات يومية", "دعم أولوية", "شارة خاصة"],
    price: "رموز سرية",
  },
  {
    id: "legendary",
    name: "أسطوري",
    emoji: "👑",
    color: "text-purple-600 bg-purple-500/10",
    benefits: ["كل المزايا", "XP مضاعف 3x", "تلميحات غير محدودة", "دخول خاص", "ملف فخري حصري"],
    price: "رموز سرية",
  },
] as const;

// ─── إنشاء كود عضوية ──────────
export const createCode = mutation({
  args: {
    tierId: v.string(),
    durationDays: v.number(), // 0 = دائم, -1 = لمرة واحدة
    count: v.number(), // عدد الأكواد
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), me.email))
      .first();
    if (!user || user.role !== "admin") throw new Error("المالك فقط");

    const codes: string[] = [];
    for (let i = 0; i < Math.min(args.count, 50); i++) {
      const code = `ZK-${args.tierId.toUpperCase().slice(0, 2)}-${Date.now().toString(36).toUpperCase().slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      codes.push(code);

      await ctx.db.insert("settings", {
        key: `mem_code_${code}`,
        value: JSON.stringify({
          code,
          tierId: args.tierId,
          durationDays: args.durationDays,
          used: false,
          usedBy: null,
          usedAt: null,
          description: args.description ?? "",
          createdBy: user.name ?? "المالك",
          createdAt: Date.now(),
          expiresAt:
            args.durationDays > 0 ? Date.now() + args.durationDays * 86400000 : null,
        }),
      });
    }

    return { codes, count: codes.length };
  },
});

// ─── تفعيل كود ──────────
export const redeemCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const codeRecord = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", `mem_code_${args.code}`))
      .first();

    if (!codeRecord) throw new Error("الكود غير موجود");

    const data = JSON.parse(codeRecord.value);

    if (data.used && data.durationDays === -1) {
      throw new Error("الكود مستخدم بالفعل (لمرة واحدة)");
    }

    if (data.expiresAt && Date.now() > data.expiresAt) {
      throw new Error("انتهت صلاحية الكود");
    }

    // Mark as used
    data.used = true;
    data.usedBy = me.subject;
    data.usedAt = Date.now();
    await ctx.db.patch(codeRecord._id, { value: JSON.stringify(data) });

    // Grant membership
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), me.email))
      .first();

    const membershipKey = `membership_${me.subject}`;
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", membershipKey))
      .first();

    const memberData = JSON.stringify({
      tierId: data.tierId,
      activatedAt: Date.now(),
      expiresAt:
        data.durationDays > 0 ? Date.now() + data.durationDays * 86400000 : null,
      code: args.code,
    });

    if (existing) {
      await ctx.db.patch(existing._id, { value: memberData });
    } else {
      await ctx.db.insert("settings", { key: membershipKey, value: memberData });
    }

    // Log usage
    await ctx.db.insert("settings", {
      key: `mem_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      value: JSON.stringify({
        code: args.code,
        tierId: data.tierId,
        userId: me.subject,
        userName: user?.name ?? "مجهول",
        usedAt: Date.now(),
      }),
    });

    const tier = MEMBERSHIP_TIERS.find((t) => t.id === data.tierId);
    return { success: true, tier: tier?.name ?? data.tierId };
  },
});

// ─── جلب حالة العضوية ──────────
export const getMyMembership = query({
  args: {},
  handler: async (ctx) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) return null;

    const membership = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", `membership_${me.subject}`))
      .first();

    if (!membership) return null;

    const data = JSON.parse(membership.value);

    // Check expiry
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return { ...data, expired: true, tier: MEMBERSHIP_TIERS.find((t) => t.id === data.tierId) };
    }

    return { ...data, expired: false, tier: MEMBERSHIP_TIERS.find((t) => t.id === data.tierId) };
  },
});

// ─── جلب كل الأكواد (للمالك) ──────────
export const getAllCodes = query({
  args: {},
  handler: async (ctx) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const codes = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), "mem_code_"))
      .filter((q) => q.lt(q.field("key"), "mem_code_z"))
      .order("desc")
      .take(200);

    return codes.map((c) => {
      try {
        const data = JSON.parse(c.value);
        return { id: c._id, ...data };
      } catch {
        return null;
      }
    }).filter(Boolean);
  },
});

// ─── جلب سجل الاستخدام ──────────
export const getUsageLogs = query({
  args: {},
  handler: async (ctx) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");

    const logs = await ctx.db
      .query("settings")
      .filter((q) => q.gt(q.field("key"), "mem_log_"))
      .filter((q) => q.lt(q.field("key"), "mem_log_z"))
      .order("desc")
      .take(100);

    return logs.map((l) => {
      try {
        return JSON.parse(l.value);
      } catch {
        return null;
      }
    }).filter(Boolean);
  },
});

// ─── حذف كود ──────────
export const deleteCode = mutation({
  args: { codeId: v.id("settings") },
  handler: async (ctx, args) => {
    const me = await ctx.auth.getUserIdentity();
    if (!me) throw new Error("غير مصرح");
    await ctx.db.delete(args.codeId);
    return { success: true };
  },
});
