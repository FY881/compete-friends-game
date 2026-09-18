import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, TIER_ORDER, tierIndex, type Tier } from "./tiers";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 📈 لوحة العضوية للمالك — أرقام حقيقية بقراءات مضبوطة
 * ═══════════════════════════════════════════════════════════════════════
 *
 * كل رقم هنا مقروء **فعلاً** من قاعدة البيانات، لكن كل قراءة **محدودة**
 * (take) حتى لا تستهلك حصة الخطة المجانية عند فتح اللوحة:
 *   • توزيع المستويات، النشط والمنتهي، المنتهي قريباً.
 *   • التجارب، القسائم، المهام، المقاعد، الترقيات المؤقتة، العروض.
 *   • الخزنة، الرتب الشرفية، وآخر الأحداث الحيّة.
 *
 * وترجع اللوحة `sampleSize` مع كل قسم لتقول بصدق: «هذا العدد مقروء من
 * كذا سجلاً» — فلا يظن المالك أن العدد إجمالي مطلق إن كان مقروءاً جزئياً.
 */

const OWNER_EMAIL = "omw70op@gmail.com";

async function requireOwner(ctx: any) {
  const ownerId = await getAuthUserId(ctx);
  if (ownerId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(ownerId)) as { role?: string; email?: string; name?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) throw new Error("غرفة المالك فقط.");
  return me;
}

async function userByName(ctx: any, name: string) {
  const target = await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("name"), name.trim()))
    .first();
  if (!target) throw new Error("لا يوجد لاعب بهذا الاسم.");
  return target;
}

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

export const getMembershipAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (ownerId === null) return null;
    const me = (await ctx.db.get(ownerId)) as { role?: string; email?: string } | null;
    if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) return null;

    const now = Date.now();
    const WEEK = 7 * DAY;

    // ── العضويات ──
    const memberships = await ctx.db.query("memberships").take(600);
    const byTier: Record<string, number> = {};
    for (const t of TIER_ORDER) byTier[t] = 0;
    let active = 0;
    let expired = 0;
    let permanent = 0;
    let expiringSoon = 0;
    for (const m of memberships) {
      byTier[m.tier] = (byTier[m.tier] ?? 0) + 1;
      if (!m.expiresAt) {
        permanent += 1;
        active += 1;
      } else if (m.expiresAt > now) {
        active += 1;
        if (m.expiresAt - now <= WEEK) expiringSoon += 1;
      } else {
        expired += 1;
      }
    }

    // ── الترقيات المؤقتة ──
    const boosts = await ctx.db.query("membershipBoosts").take(600);
    const boostsBySource: Record<string, number> = {};
    let boostsActive = 0;
    for (const b of boosts) {
      if (b.expiresAt > now) {
        boostsActive += 1;
        boostsBySource[b.source] = (boostsBySource[b.source] ?? 0) + 1;
      }
    }

    // ── التجارب ──
    const trials = await ctx.db.query("membershipTrials").take(400);
    const trialActive = trials.filter((t) => t.expiresAt > now).length;
    const trialConverted = trials.filter((t) => t.expiresAt <= now).length;

    // ── القسائم ──
    const promos = await ctx.db.query("promoCodes").take(200);
    const redemptions = await ctx.db.query("promoRedemptions").take(600);
    const topPromos = promos
      .map((p) => ({
        code: p.code,
        tier: p.tier as Tier,
        usedCount: p.usedCount,
        maxUses: p.maxUses,
        active: p.active,
        usedPercent: p.maxUses > 0 ? Math.round((p.usedCount / p.maxUses) * 100) : 0,
      }))
      .sort((a, b) => b.usedCount - a.usedCount)
      .slice(0, 5);

    // ── المهام ──
    const claims = await ctx.db.query("membershipQuestClaims").take(600);
    const questCounts: Record<string, number> = {};
    for (const c of claims) questCounts[c.questId] = (questCounts[c.questId] ?? 0) + 1;
    const topQuests = Object.entries(questCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([questId, count]) => ({ questId, count }));

    // ── المقاعد والفرق ──
    const squads = await ctx.db.query("memberSquads").take(150);
    const liveSquads = squads.filter((s) => !s.disbandedAt);
    let seatsActive = 0;
    let seatsPending = 0;
    let seatsTotal = 0;
    for (const s of liveSquads) {
      seatsTotal += s.seatsTotal;
      const seats = await ctx.db
        .query("squadSeats")
        .withIndex("by_squad", (q) => q.eq("squadId", s._id))
        .take(60);
      for (const seat of seats) {
        if (seat.status === "active") seatsActive += 1;
        if (seat.status === "pending") seatsPending += 1;
      }
    }

    // ── مشاركة الامتيازات ──
    const shares = await ctx.db.query("perkShares").take(300);
    const sharesActive = shares.filter((s) => s.active && s.expiresAt > now).length;

    // ── العروض والتجديد ──
    const offers = await ctx.db.query("renewalOffers").take(300);
    const offersOpen = offers.filter((o) => !o.used && o.expiresAt > now).length;
    const offersUsed = offers.filter((o) => o.used).length;
    const credits = await ctx.db.query("membershipCredits").take(300);
    const bankedDays = credits.reduce((sum, c) => sum + c.bankedDays, 0);
    const renewalPrefs = await ctx.db.query("renewalPrefs").take(300);
    const autoRenewOn = renewalPrefs.filter((p) => p.autoRenew).length;

    // ── الرتب الشرفية ──
    const prestige = await ctx.db.query("membershipPrestige").take(300);
    const prestigeAvg =
      prestige.length > 0
        ? Math.round(prestige.reduce((sum, p) => sum + p.points, 0) / prestige.length)
        : 0;
    const prestigeTop = prestige.reduce(
      (best, p) => (p.points > best.points ? p : best),
      { points: 0, level: 1 } as { points: number; level: number },
    );

    // ── الخزنة ──
    const vaults = await ctx.db.query("perkVault").take(200);
    const vaultOpens = vaults.reduce((sum, v) => sum + v.opens, 0);
    const vaultFragments = vaults.reduce((sum, v) => sum + v.fragments, 0);

    // ── آخر الأحداث ──
    const events = await ctx.db.query("membershipEvents").withIndex("by_at").order("desc").take(12);

    return {
      generatedAt: now,
      tiers: TIER_ORDER.map((t) => ({
        tier: t,
        name: TIER_META[t].name,
        emoji: TIER_META[t].emoji,
        count: byTier[t] ?? 0,
      })),
      memberships: { active, expired, permanent, expiringSoon, sampleSize: memberships.length },
      boosts: { active: boostsActive, bySource: boostsBySource, sampleSize: boosts.length },
      trials: { total: trials.length, active: trialActive, ended: trialConverted },
      promos: { total: promos.length, redemptions: redemptions.length, top: topPromos },
      quests: { totalClaims: claims.length, top: topQuests },
      squads: {
        live: liveSquads.length,
        disbanded: squads.length - liveSquads.length,
        seatsActive,
        seatsPending,
        seatsTotal,
        fillPercent: seatsTotal > 0 ? Math.round((seatsActive / seatsTotal) * 100) : 0,
      },
      shares: { active: sharesActive, total: shares.length },
      renewal: {
        offersOpen,
        offersUsed,
        bankedDays,
        autoRenewOn,
        prefsTracked: renewalPrefs.length,
      },
      prestige: { tracked: prestige.length, avgPoints: prestigeAvg, topLevel: prestigeTop.level },
      vault: { tracked: vaults.length, opens: vaultOpens, fragmentsOutstanding: vaultFragments },
      recentEvents: events.map((e) => ({
        id: String(e._id),
        actor: e.actorName,
        kind: e.kind,
        tier: (e.tier as Tier) ?? null,
        detail: e.detail,
        at: e.at,
      })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 👑 تحكم المالك الفعلي في العضويات
// ═══════════════════════════════════════════════════════════════════════

/** إنهاء عضوية لاعب فوراً — المالك فقط (أثر حقيقي وقيد في السجل). */
export const ownerRevokeMembership = mutation({
  args: { userName: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await userByName(ctx, args.userName);

    const now = Date.now();
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .take(5);
    let count = 0;
    for (const m of memberships) {
      if (!m.expiresAt || m.expiresAt > now) {
        await ctx.db.patch(m._id, { expiresAt: now });
        count += 1;
      }
    }

    // وإن كانت هناك فترة سماح تحفظ المستوى، تُلغى أيضاً
    const boosts = await ctx.db
      .query("membershipBoosts")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .take(30);
    for (const b of boosts) {
      if (b.source === "grace" && b.expiresAt > now) {
        await ctx.db.patch(b._id, { expiresAt: now });
      }
    }

    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "revoke",
      detail: `أُنهيت العضوية إدارياً${args.reason ? `: ${args.reason}` : ""}`,
    });

    return { ok: true, revoked: count, target: target.name ?? "لاعب" };
  },
});

/** تعديل الرصيد المدّخر للاعب (منح أو سحب) — المالك فقط. */
export const ownerAdjustCredits = mutation({
  args: { userName: v.string(), days: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await userByName(ctx, args.userName);

    const existing = await ctx.db
      .query("membershipCredits")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .first();
    const delta = Math.round(args.days);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bankedDays: Math.max(0, existing.bankedDays + delta),
        lifetimeBanked: delta > 0 ? existing.lifetimeBanked + delta : existing.lifetimeBanked,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("membershipCredits", {
        userId: target._id,
        bankedDays: Math.max(0, delta),
        lifetimeBanked: delta > 0 ? delta : 0,
        lifetimeUsed: 0,
        updatedAt: now,
      });
    }

    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "credits",
      detail: `${delta >= 0 ? "منح" : "سحب"} ${Math.abs(delta)} يوماً من الرصيد المدّخر${args.note ? ` — ${args.note}` : ""}`,
      days: delta,
    });

    return { ok: true, target: target.name ?? "لاعب", delta };
  },
});

/** ترقية مستخدم إدارياً مع تسجيل السبب — تكمّل ownerSetTier في المتجر. */
export const ownerGrantTierDays = mutation({
  args: {
    userName: v.string(),
    tier: v.union(v.literal("silver"), v.literal("gold"), v.literal("diamond"), v.literal("exclusive")),
    days: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await userByName(ctx, args.userName);
    const now = Date.now();
    const days = Math.max(1, Math.min(365, Math.round(args.days)));

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", target._id))
      .order("desc")
      .first();

    const stillActive = membership?.expiresAt && membership.expiresAt > now;
    const sameTier = membership && membership.tier === args.tier;
    const baseTime = sameTier && stillActive ? (membership!.expiresAt as number) : now;
    const expiresAt = baseTime + days * DAY;
    const targetTier: Tier =
      membership && tierIndex(membership.tier as Tier) > tierIndex(args.tier) && stillActive
        ? (membership.tier as Tier)
        : args.tier;

    if (membership) {
      await ctx.db.patch(membership._id, {
        tier: targetTier,
        activatedAt: sameTier && stillActive ? membership.activatedAt : now,
        expiresAt,
        codeUsed: membership.codeUsed ?? "owner",
      });
    } else {
      await ctx.db.insert("memberships", {
        userId: target._id,
        tier: targetTier,
        activatedAt: now,
        expiresAt,
        features: [],
      });
    }

    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "grant",
      tier: targetTier,
      detail: `منح ${TIER_META[targetTier].name} ${days} يوماً${args.note ? ` — ${args.note}` : ""}`,
      days,
      expiresAt,
    });

    return { ok: true, target: target.name ?? "لاعب", tier: targetTier, expiresAt, days };
  },
});
