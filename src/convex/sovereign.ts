/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 الحاكم السيادي — المرحلة 1 (سلطة تنفيذية حقيقية)
 *
 *  1. المرسوم الفوري: مضاعف XP/عملات، خصم متجر، تخصص الأسبوع —
 *     يُطبَّق لحظياً على الجميع، مع انتهاء تلقائي أو دائم.
 *  2. وضع الطوارئ (Martial Mode): تجميد كامل بضغطة واحدة + تسجيل.
 *  3. العزل (Quarantine): فصل لاعب مشتبه به حتى تقرير الحاكم.
 *  4. البصمة المزدوجة: الأوامر الخطيرة تتطلب تأكيداً ثانياً خلال 60 ثانية،
 *     وتُرسل إشعاراً موقّعاً «بقرار من الحاكم السيادي» لكل اللاعبين.
 *  5. كل شيء يُسجَّل في sovereignDecrees و aiDecisionLog.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { isOwnerUser } from "./owner";

/** مهلة البصمة المزدوجة: 60 ثانية */
const DUAL_SIGN_WINDOW_MS = 60_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireSovereign(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول");
  const me = await ctx.db.get(userId);
  if (!me || !isOwnerUser(me)) throw new Error("الحاكم السيادي فقط يملك هذه الصلاحية");
  return { userId, me };
}

async function logDecision(
  ctx: any,
  action: string,
  detail: string,
  severity: "low" | "medium" | "high",
  targetId?: string,
  targetName?: string,
) {
  await ctx.runMutation(internal.decisionLog.log, {
    system: "owner",
    actorName: "الحاكم السيادي",
    action,
    targetId,
    targetName,
    detail,
    severity,
  });
}

/** إشعار عام موقّع بخطاب السيادة */
async function notifyAll(ctx: MutationCtx, title: string, body: string, type: "info" | "warning" | "system" | "update") {
  await ctx.runMutation(internal.notify.push, {
      userId: "__all__" as const,
      title,
      body,
      type,
      category: "moderation",
      priority: "critical",
    });
}

// ─────────────────────────────────────────────────────────────────────────
// قراءة الحالة
// ─────────────────────────────────────────────────────────────────────────

export const getSovereignState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isOwnerUser(me)) return null;

    const now = Date.now();
    const decrees = await ctx.db
      .query("sovereignDecrees")
      .withIndex("by_created", (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(50);

    return {
      activeDecrees: decrees.filter((d: any) => d.active && (!d.expiresAt || d.expiresAt > now)),
      history: decrees,
      pendingDualSign: decrees.filter(
        (d: any) => d.active && d.dualSignRequired && !d.confirmedBy && (d.dualSignDeadline ?? 0) > now,
      ),
      now,
    };
  },
});

/** قراءة عامة آمنة — مضاعفات اقتصاد فعّالة يستخدمها الخادم/العميل */
export const getActiveMultipliers = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("sovereignDecrees")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();

    let xpMultiplier = 1;
    let coinMultiplier = 1;
    let shopDiscountPct = 0;
    let spotlightCategory: string | null = null;
    let martialMode = false;

    for (const d of active) {
      if (d.expiresAt && d.expiresAt <= now) continue;
      switch (d.kind) {
        case "xp_multiplier": xpMultiplier = Math.max(xpMultiplier, d.value); break;
        case "coin_multiplier": coinMultiplier = Math.max(coinMultiplier, d.value); break;
        case "shop_discount": shopDiscountPct = Math.max(shopDiscountPct, d.value); break;
        case "category_spotlight": spotlightCategory = String(d.value); break;
        case "martial_mode": martialMode = true; break;
      }
    }
    return { xpMultiplier, coinMultiplier, shopDiscountPct, spotlightCategory, martialMode };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// المرسوم الفوري
// ─────────────────────────────────────────────────────────────────────────

export const issueDecree = mutation({
  args: {
    kind: v.union(
      v.literal("xp_multiplier"),
      v.literal("coin_multiplier"),
      v.literal("shop_discount"),
      v.literal("category_spotlight"),
    ),
    value: v.number(),
    label: v.string(),
    reason: v.string(),
    durationHours: v.optional(v.number()), // undefined = دائم حتى الإلغاء
  },
  handler: async (ctx, args) => {
    const { userId, me } = await requireSovereign(ctx);
    const now = Date.now();

    // إلغاء أي مرسوم سابق من نفس النوع (المرسوم الأحدث يحل محل الأقدم)
    const prev = await ctx.db
      .query("sovereignDecrees")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();
    for (const p of prev) {
      if (p.kind === args.kind) await ctx.db.patch(p._id, { active: false });
    }

    await ctx.db.insert("sovereignDecrees", {
      kind: args.kind,
      value: args.value,
      label: args.label,
      reason: args.reason,
      scope: "global",
      active: true,
      issuedBy: userId,
      issuedByName: me.name ?? "الحاكم",
      dualSignRequired: false,
      expiresAt: args.durationHours && args.durationHours > 0 ? now + args.durationHours * 3600_000 : undefined,
      createdAt: now,
    });

    await logDecision(
      ctx,
      "مرسوم فوري",
      `${args.label} — القيمة: ${args.value} — السبب: ${args.reason}`,
      "high",
    );
    await notifyAll(ctx, "👑 قرار من الحاكم السيادي", `${args.label} — ${args.reason}`, "update");
  },
});

// ─────────────────────────────────────────────────────────────────────────
// وضع الطوارئ (Martial Mode) — يتطلب بصمة مزدوجة
// ─────────────────────────────────────────────────────────────────────────

export const toggleMartialMode = mutation({
  args: { enable: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    const { userId, me } = await requireSovereign(ctx);
    const now = Date.now();

    if (!args.enable) {
      // رفع الطوارئ فوري (الأمان أولاً عند الخروج من الحالة الحرجة)
      const active = await ctx.db
        .query("sovereignDecrees")
        .withIndex("by_active", (q: any) => q.eq("active", true))
        .collect();
      for (const d of active) {
        if (d.kind === "martial_mode") await ctx.db.patch(d._id, { active: false });
      }
      await logDecision(ctx, "رفع الطوارئ", args.reason, "high");
      await notifyAll(ctx, "✅ رُفعت حالة الطوارئ", "استؤنف النشاط الطبيعي — " + args.reason, "info");
      return;
    }

    // تفعيل الطوارئ = أمر خطير، يتطلب بصمة مزدوجة
    const existing = await ctx.db
      .query("sovereignDecrees")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();
    for (const d of existing) {
      if (d.kind === "martial_mode" && d.active && !d.confirmedBy && (d.dualSignDeadline ?? 0) > now) {
        throw new Error("هناك طلب طوارئ بانتظار التأكيد الثاني بالفعل");
      }
    }

    await ctx.db.insert("sovereignDecrees", {
      kind: "martial_mode",
      value: 1,
      label: "🚨 وضع الطوارئ — تجميد كامل",
      reason: args.reason,
      scope: "global",
      active: true,
      issuedBy: userId,
      issuedByName: me.name ?? "الحاكم",
      dualSignRequired: true,
      dualSignDeadline: now + DUAL_SIGN_WINDOW_MS,
      createdAt: now,
    });

    await logDecision(ctx, "طلب تفعيل الطوارئ", `${args.reason} — بانتظار البصمة الثانية خلال 60 ثانية`, "high");
  },
});

// ─────────────────────────────────────────────────────────────────────────
// العزل (Quarantine) — يتطلب بصمة مزدوجة
// ─────────────────────────────────────────────────────────────────────────

export const quarantinePlayer = mutation({
  args: { username: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const { userId, me } = await requireSovereign(ctx);
    const now = Date.now();

    const target = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("name"), args.username.trim()))
      .first();
    if (!target) throw new Error("لا يوجد لاعب بهذا الاسم");

    if (isOwnerUser(target)) throw new Error("لا يمكن عزل الحاكم نفسه");

    await ctx.db.insert("sovereignDecrees", {
      kind: "quarantine",
      value: 1,
      label: `🧊 عزل اللاعب: ${args.username}`,
      reason: args.reason,
      targetUserId: target._id,
      scope: "player",
      active: true,
      issuedBy: userId,
      issuedByName: me.name ?? "الحاكم",
      dualSignRequired: true,
      dualSignDeadline: now + DUAL_SIGN_WINDOW_MS,
      createdAt: now,
    });

    await logDecision(
      ctx,
      "طلب عزل لاعب",
      `${args.username} — السبب: ${args.reason} — بانتظار البصمة الثانية`,
      "high",
      target._id,
      args.username,
    );
    return target._id;
  },
});

export const releaseQuarantine = mutation({
  args: { decreeId: v.id("sovereignDecrees") },
  handler: async (ctx, args) => {
    await requireSovereign(ctx);
    const d = await ctx.db.get(args.decreeId);
    if (!d || d.kind !== "quarantine") throw new Error("مرسوم غير صالح");
    await ctx.db.patch(args.decreeId, { active: false });      await logDecision(ctx, "رفع العزل", `أُعيد ${d.label.replace("🧊 عزل اللاعب: ", "")} إلى اللعب الطبيعي`, "medium");
    if (d.targetUserId) {
      await ctx.runMutation(internal.notify.push, {
      userId: d.targetUserId,
      title: "🕊️ رُفع العزل عنك",
      body: "قرار من الحاكم السيادي: عُدت إلى اللعب الطبيعي. لِعَ نزيهة.",
      type: "info",
      category: "moderation",
      priority: "critical",
    });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// البصمة المزدوجة — تأكيد أو إسقاط
// ─────────────────────────────────────────────────────────────────────────

export const confirmDecree = mutation({
  args: { decreeId: v.id("sovereignDecrees") },
  handler: async (ctx, args) => {
    const { userId } = await requireSovereign(ctx);
    const now = Date.now();
    const d = await ctx.db.get(args.decreeId);
    if (!d || !d.active || !d.dualSignRequired) throw new Error("مرسوم غير صالح");
    if (d.confirmedBy) throw new Error("مؤكَّد بالفعل");
    if ((d.dualSignDeadline ?? 0) < now) {
      // انتهت المهلة — يُسقط تلقائياً
      await ctx.db.patch(args.decreeId, { active: false });
      await logDecision(ctx, "إسقاط مرسوم", `انتهت مهلة التأكيد: ${d.label}`, "medium");
      throw new Error("انتهت مهلة الـ 60 ثانية — أُسقط المرسوم. أعد إصداره.");
    }

    await ctx.db.patch(args.decreeId, { confirmedBy: userId });
    await logDecision(ctx, "تأكيد بصمة مزدوجة", `نُفِّذ: ${d.label}`, "high");

    if (d.kind === "martial_mode") {
      await notifyAll(
        ctx,
        "🚨 حالة طوارئ مؤقتة",
        "أجمّد الحاكم السيادي النشاط للصيانة العاجلة. سنعود قريباً جداً.",
        "warning",
      );
    } else if (d.kind === "quarantine" && d.targetUserId) {
      await ctx.runMutation(internal.notify.push, {
      userId: d.targetUserId,
      title: "🧊 تم عزلك مؤقتاً",
      body: `بقرار من الحاكم السيادي: ${d.reason}. سيُراجع وضعك قريباً.`,
      type: "ban",
      category: "moderation",
      priority: "critical",
    });
    }
  },
});

export const dropDecree = mutation({
  args: { decreeId: v.id("sovereignDecrees") },
  handler: async (ctx, args) => {
    await requireSovereign(ctx);
    const d = await ctx.db.get(args.decreeId);
    if (!d) throw new Error("مرسوم غير موجود");
    await ctx.db.patch(args.decreeId, { active: false });
    await logDecision(ctx, "إلغاء مرسوم", `أُلغي: ${d.label}`, "medium");
  },
});

/** تنظيف دوري: مراسيم منتهية الصلاحية أو تجاوزت مهلة التأكيد */
export const expireStaleDecrees = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("sovereignDecrees")
      .withIndex("by_active", (q: any) => q.eq("active", true))
      .collect();
    let expired = 0;
    for (const d of active) {
      const isStale =
        (d.expiresAt && d.expiresAt <= now) ||
        (d.dualSignRequired && !d.confirmedBy && (d.dualSignDeadline ?? 0) < now);
      if (isStale) {
        await ctx.db.patch(d._id, { active: false });
        expired++;
      }
    }
    if (expired > 0) {
      await logDecision(ctx, "انتهاء تلقائي", `انتهت صلاحية ${expired} مرسوماً تلقائياً`, "low");
    }
    return expired;
  },
});
