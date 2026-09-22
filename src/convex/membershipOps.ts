/**
 * ═══════════════════════════════════════════════════════════════════════
 * عمليات العضوية الحقيقية — منح/تمديد/سحب + جولات رقابة + إصدار أكواد
 * كل عملية تترك أثراً حقيقياً في جدول memberships وقابلة للتحقق عبر
 * سجل membershipLogs. يستخدمها المالك من الواجهة، وحارسة العضويات
 * «جيم» من عالم المساعدين، ونائب المالك عبر النظام المركزي للسيطرة.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MEMBERSHIP_TIERS } from "./membershipSystem";

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"] as const;
const DAY = 24 * 60 * 60 * 1000;

type Tier = (typeof TIER_ORDER)[number];

const tierLabel = (t: string): string =>
  MEMBERSHIP_TIERS.find((x) => x.id === t)?.name ?? t;

// ───────────────────────────────────────────────────────────────────────
// أدوات داخلية مشتركة (تعمل على ctx.db) — تُستخدم من الدوال العامة والداخلية
// ───────────────────────────────────────────────────────────────────────
type DbCtx = { db: any };

async function findUserByName(ctx: DbCtx, name: string): Promise<{ _id: string; name?: string } | null> {
  const users = await ctx.db.query("users").take(200);
  const n = name.trim().toLowerCase();
  return (
    users.find((u: any) => (u.name ?? "").trim().toLowerCase() === n) ??
    users.find((u: any) => (u.name ?? "").toLowerCase().includes(n)) ??
    null
  );
}

async function getMembership(ctx: DbCtx, userId: string): Promise<any | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId as any))
    .order("desc")
    .first();
}

/** إصدار كود عضوية حقيقي قابل للتفعيل عبر redeemCode (نفس صيغة createCode) */
async function createCodes(ctx: DbCtx, tierId: Tier, durationDays: number, count: number, createdBy: string): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < Math.min(count, 50); i++) {
    const code = `ZK-${tierId.toUpperCase().slice(0, 2)}-${Date.now().toString(36).toUpperCase().slice(-4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    codes.push(code);
    await ctx.db.insert("settings", {
      key: `mem_code_${code}`,
      value: JSON.stringify({
        code,
        tierId,
        durationDays,
        used: false,
        usedBy: null,
        usedAt: null,
        description: `أصدرته حارسة الخزينة (${createdBy})`,
        createdBy,
        createdAt: Date.now(),
        expiresAt: durationDays > 0 ? Date.now() + durationDays * DAY : null,
      }),
    });
  }
  return codes;
}

async function assertOwner(ctx: any): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("غير مصرح");
  const me = await ctx.db.get(userId);
  if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) throw new Error("غير مصرح — المالك فقط");
}

// ───────────────────────────────────────────────────────────────────────
// سجل العضوية — أثر حقيقي
// ───────────────────────────────────────────────────────────────────────
export const logMembershipAction = internalMutation({
  args: {
    actor: v.string(),
    actorName: v.string(),
    action: v.union(
      v.literal("grant"), v.literal("extend"), v.literal("revoke"),
      v.literal("audit"), v.literal("reminder"), v.literal("code"), v.literal("review"),
    ),
    targetUserId: v.optional(v.id("users")),
    targetName: v.optional(v.string()),
    tier: v.optional(v.union(
      v.literal("bronze"), v.literal("silver"), v.literal("gold"),
      v.literal("diamond"), v.literal("exclusive"),
    )),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("membershipLogs", { ...args, at: Date.now() });
  },
});

// ───────────────────────────────────────────────────────────────────────
// العمليات الداخلية — تنفّذها «جيم» أو النظام المركزي للسيطرة
// ───────────────────────────────────────────────────────────────────────
export const grantMembership = internalMutation({
  args: {
    targetName: v.string(),
    tier: v.union(
      v.literal("bronze"), v.literal("silver"), v.literal("gold"),
      v.literal("diamond"), v.literal("exclusive"),
    ),
    days: v.number(), // 0 = دائمة
    actor: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, { targetName, tier, days, actor, actorName }) => {
    if (!TIER_ORDER.includes(tier as Tier)) throw new Error("مستوى عضوية غير صحيح");
    const user = await findUserByName(ctx, targetName);
    if (!user) throw new Error(`اللاعب «${targetName}» غير موجود`);
    const existing = await getMembership(ctx, user._id);
    const expiresAt = days > 0 ? Date.now() + days * DAY : undefined;
    if (existing) {
      await ctx.db.patch(existing._id, { tier, expiresAt, activatedAt: Date.now() });
    } else {
      await ctx.db.insert("memberships", {
        userId: user._id as any,
        tier,
        activatedAt: Date.now(),
        expiresAt,
        features: [],
      });
    }
    const detail = `منح «${user.name ?? targetName}» عضوية ${tierLabel(tier)}${days > 0 ? ` لمدة ${days} يوم` : " دائمة"}`;
    await ctx.db.insert("membershipLogs", {
      actor, actorName, action: "grant", targetUserId: user._id as any,
      targetName: user.name ?? targetName, tier, detail, at: Date.now(),
    });
    return { ok: true, userId: user._id, detail };
  },
});

export const extendMembership = internalMutation({
  args: {
    targetName: v.string(),
    days: v.number(),
    actor: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, { targetName, days, actor, actorName }) => {
    const user = await findUserByName(ctx, targetName);
    if (!user) throw new Error(`اللاعب «${targetName}» غير موجود`);
    const existing = await getMembership(ctx, user._id);
    if (!existing) throw new Error(`«${user.name ?? targetName}» لا يملك عضوية بعد`);
    const base = (existing.expiresAt && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now());
    const newExpiry = base + days * DAY;
    await ctx.db.patch(existing._id, { expiresAt: newExpiry });
    const detail = `تمديد عضوية «${user.name ?? targetName}» (${tierLabel(existing.tier)}) ${days} يوم — تنتهي ${new Date(newExpiry).toLocaleDateString("ar-SA")}`;
    await ctx.db.insert("membershipLogs", {
      actor, actorName, action: "extend", targetUserId: user._id as any,
      targetName: user.name ?? targetName, tier: existing.tier, detail, at: Date.now(),
    });
    return { ok: true, expiresAt: newExpiry, detail };
  },
});

export const revokeMembership = internalMutation({
  args: {
    targetName: v.string(),
    actor: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, { targetName, actor, actorName }) => {
    const user = await findUserByName(ctx, targetName);
    if (!user) throw new Error(`اللاعب «${targetName}» غير موجود`);
    const existing = await getMembership(ctx, user._id);
    if (!existing) throw new Error(`«${user.name ?? targetName}» لا يملك عضوية مدفوعة`);
    const detail = `سحب عضوية «${user.name ?? targetName}» (${tierLabel(existing.tier)}) — عاد إلى الأساسي`;
    await ctx.db.patch(existing._id, { tier: "bronze", expiresAt: Date.now() });
    await ctx.db.insert("membershipLogs", {
      actor, actorName, action: "revoke", targetUserId: user._id as any,
      targetName: user.name ?? targetName, tier: "bronze", detail, at: Date.now(),
    });
    return { ok: true, detail };
  },
});

/** جولة رقابة: من تنتهي عضويتهم خلال N أيام → إشعار تذكير + سجل */
export const membershipAudit = internalMutation({
  args: {
    withinDays: v.number(),
    actor: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, { withinDays, actor, actorName }) => {
    const now = Date.now();
    const horizon = now + withinDays * DAY;
    const memberships = await ctx.db.query("memberships").collect();
    const active = memberships.filter((m) => m.expiresAt && m.expiresAt > now && m.expiresAt <= horizon);
    let reminded = 0;
    for (const m of active) {
      const user = (await ctx.db.get(m.userId as any)) as { name?: string } | null;
      const name = user?.name ?? "لاعب";
      const remain = Math.max(1, Math.ceil(((m.expiresAt as number) - now) / DAY));
      await ctx.runMutation(internal.notify.push, {
        userId: m.userId as any,
        title: `تنتهي عضويتك ${tierLabel(m.tier)} قريباً 🕒`,
        body: `لديك ${remain} يوم (أو أقل) قبل انتهاء عضويتك. جدّدها لتواصل امتيازاتك.`,
        type: "info",
        category: "membership",
        priority: "important",
      });
      await ctx.db.insert("membershipLogs", {
        actor, actorName, action: "reminder", targetUserId: m.userId as any,
        targetName: name, tier: m.tier, detail: `تذكير: عضوية «${name}» تنتهي خلال ${remain} يوم`, at: now,
      });
      reminded++;
    }
    const detail = `جولة الرقابة على العضويات: ${reminded} عضوية تنتهي خلال ${withinDays} يوم — أُرسل تذكير لكل عضو`;
    await ctx.db.insert("membershipLogs", {
      actor, actorName, action: "audit", detail, at: now,
    });
    return { ok: true, reminded, detail };
  },
});

export const createRedeemableCodes = internalMutation({
  args: {
    tier: v.union(
      v.literal("bronze"), v.literal("silver"), v.literal("gold"),
      v.literal("diamond"), v.literal("exclusive"),
    ),
    days: v.number(),
    count: v.number(),
    actor: v.string(),
    actorName: v.string(),
  },
  handler: async (ctx, { tier, days, count, actor, actorName }) => {
    const codes = await createCodes(ctx, tier as Tier, days, count, actorName);
    const detail = `أصدرت ${codes.length} كود ${tierLabel(tier)}${days > 0 ? ` (${days} يوم)` : " دائم"} — أولها: ${codes[0] ?? "—"}`;
    await ctx.db.insert("membershipLogs", {
      actor, actorName, action: "code", tier, detail, at: Date.now(),
    });
    return { ok: true, codes, detail };
  },
});

// ───────────────────────────────────────────────────────────────────────
// دوال داخلية للقراءة (تُستخدم من «جيم» والنظام المركزي)
// ───────────────────────────────────────────────────────────────────────
export const listExpiringMemberships = internalQuery({
  args: { withinDays: v.number() },
  handler: async (ctx, { withinDays }) => {
    const now = Date.now();
    const horizon = now + withinDays * DAY;
    const memberships = await ctx.db.query("memberships").collect();
    const out: Array<{ userId: string; name: string; tier: string; expiresAt: number; daysLeft: number }> = [];
    for (const m of memberships) {
      if (m.expiresAt && m.expiresAt > now && m.expiresAt <= horizon) {
        const user = (await ctx.db.get(m.userId as any)) as { name?: string } | null;
        out.push({
          userId: m.userId as any,
          name: user?.name ?? "لاعب",
          tier: m.tier,
          expiresAt: m.expiresAt,
          daysLeft: Math.max(1, Math.ceil((m.expiresAt - now) / DAY)),
        });
      }
    }
    return out.sort((a, b) => a.expiresAt - b.expiresAt);
  },
});

// ───────────────────────────────────────────────────────────────────────
// الواجهة العامة للمالك — نظرة شاملة + منح/تمديد/سحب
// ───────────────────────────────────────────────────────────────────────
export const getMembershipInsights = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const now = Date.now();
    const memberships = await ctx.db.query("memberships").collect();
    const users = await ctx.db.query("users").collect();
    const logs = await ctx.db
      .query("membershipLogs")
      .withIndex("by_created", (q: any) => q.gte("at", 0))
      .order("desc")
      .take(30);

    const activeByTier: Record<string, number> = { bronze: 0, silver: 0, gold: 0, diamond: 0, exclusive: 0 };
    let activeCount = 0;
    let paidActive = 0;
    let totalDays = 0;
    let measured = 0;
    const expiringSoon: Array<{ name: string; tier: string; daysLeft: number; userId: string }> = [];
    const topByDays: Array<{ name: string; tier: string; days: number }> = [];

    for (const m of memberships) {
      const active = !m.expiresAt || m.expiresAt > now;
      if (!active) continue;
      activeByTier[m.tier] = (activeByTier[m.tier] ?? 0) + 1;
      activeCount++;
      if (m.tier !== "bronze") paidActive++;
      const days = Math.floor((now - m.activatedAt) / DAY);
      totalDays += days;
      measured++;
      if (m.expiresAt && m.expiresAt <= now + 7 * DAY) {
        const u = users.find((x: any) => x._id === m.userId);
        expiringSoon.push({ name: u?.name ?? "لاعب", tier: m.tier, daysLeft: m.expiresAt ? Math.max(1, Math.ceil((m.expiresAt - now) / DAY)) : 0, userId: m.userId as any });
      }
      if (m.tier !== "bronze") {
        const u = users.find((x: any) => x._id === m.userId);
        topByDays.push({ name: u?.name ?? "لاعب", tier: m.tier, days });
      }
    }

    const codes = await ctx.db.query("membershipCodes").collect();
    const activeCodes = codes.filter((c) => c.active).length;
    const codesUsed = codes.reduce((s, c) => s + c.usedCount, 0);

    return {
      totalUsers: users.length,
      activeMemberships: activeCount,
      paidActive,
      activeByTier,
      conversionRate: users.length ? Math.round((paidActive / users.length) * 100) : 0,
      avgDays: measured ? Math.round(totalDays / measured) : 0,
      expiringSoon: expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 15),
      topByDays: topByDays.sort((a, b) => b.days - a.days).slice(0, 10),
      activeCodes,
      codesUsed,
      recentLogs: logs,
    };
  },
});

type GrantResult = { ok: boolean; userId: string; detail: string };
type ExtendResult = { ok: boolean; expiresAt: number; detail: string };
type RevokeResult = { ok: boolean; detail: string };
type AuditResult = { ok: boolean; reminded: number; detail: string };
type CodeResult = { ok: boolean; codes: string[]; detail: string };

export const ownerGrant = mutation({
  args: { targetName: v.string(), tier: v.string(), days: v.number() },
  handler: async (ctx, { targetName, tier, days }): Promise<GrantResult> => {
    await assertOwner(ctx);
    if (!TIER_ORDER.includes(tier as Tier)) throw new Error("مستوى عضوية غير صحيح");
    return (await ctx.runMutation(internal.membershipOps.grantMembership, {
      targetName, tier: tier as Tier, days, actor: "owner", actorName: "👑 المالك",
    })) as GrantResult;
  },
});

export const ownerExtend = mutation({
  args: { targetName: v.string(), days: v.number() },
  handler: async (ctx, { targetName, days }): Promise<ExtendResult> => {
    await assertOwner(ctx);
    return (await ctx.runMutation(internal.membershipOps.extendMembership, {
      targetName, days, actor: "owner", actorName: "👑 المالك",
    })) as ExtendResult;
  },
});

export const ownerRevoke = mutation({
  args: { targetName: v.string() },
  handler: async (ctx, { targetName }): Promise<RevokeResult> => {
    await assertOwner(ctx);
    return (await ctx.runMutation(internal.membershipOps.revokeMembership, {
      targetName, actor: "owner", actorName: "👑 المالك",
    })) as RevokeResult;
  },
});

export const ownerAudit = mutation({
  args: { withinDays: v.optional(v.number()) },
  handler: async (ctx, { withinDays }): Promise<AuditResult> => {
    await assertOwner(ctx);
    return (await ctx.runMutation(internal.membershipOps.membershipAudit, {
      withinDays: withinDays ?? 3, actor: "owner", actorName: "👑 المالك",
    })) as AuditResult;
  },
});

export const ownerCreateCodes = mutation({
  args: { tier: v.string(), days: v.number(), count: v.number() },
  handler: async (ctx, { tier, days, count }): Promise<CodeResult> => {
    await assertOwner(ctx);
    if (!TIER_ORDER.includes(tier as Tier)) throw new Error("مستوى عضوية غير صحيح");
    return (await ctx.runMutation(internal.membershipOps.createRedeemableCodes, {
      tier: tier as Tier, days, count: Math.min(Math.max(1, count), 50), actor: "owner", actorName: "👑 المالك",
    })) as CodeResult;
  },
});