/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👑 أدوار الموقع — نائب المالك (الإصدار 3.0)
 *
 *  - المالك (owner email) يعيّن/يعزل نائب المالك — هو الوحيد بصلاحية التعيين
 *  - نائب المالك يسيطر على كل شيء ما عدا نقل الملكية وتعيين النواب
 *  - كل فعل إداري يُسجَّل في auditLog غير قابل للتغيير
 *  - الممنوعات (siteBans): حظر لعب / كتم دردشة — تُفحص في بوابات اللعب والدردشة
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { isOwnerUser } from "./owner";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

async function getUserPublic(ctx: any, userId: any) {
  const u = await ctx.db.get(userId);
  return u ? { id: u._id, name: u.name ?? "لاعب", email: u.email ?? "" } : null;
}

/** هل هذا المستخدم نائب مالك نشط؟ */
export async function isDeputyOwner(ctx: any, userId: any): Promise<boolean> {
  const row = await ctx.db
    .query("siteRoles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  return !!(row && row.active && row.role === "deputy_owner");
}

/** سجل فعل إداري في سجل التدقيق غير القابل للتغيير */
export async function writeAudit(
  ctx: any,
  actorId: any,
  actorRole: "owner" | "deputy_owner",
  action: string,
  detail: string,
  targetId?: any,
) {
  const actor = await ctx.db.get(actorId);
  await ctx.db.insert("auditLog", {
    actorId,
    actorName: actor?.name ?? "غير معروف",
    actorRole,
    action,
    targetId: targetId ?? undefined,
    detail,
    at: Date.now(),
  });
}

/** بوابات الملكية: يعيد userId + الدور (يطرح خطأ إن لم يكن مالكاً أو نائباً) */
async function requireOwnerOrDeputy(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("غير مصرح");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("غير مصرح");
  if (isOwnerUser(user)) return { userId, role: "owner" as const, user };
  if (await isDeputyOwner(ctx, userId)) return { userId, role: "deputy_owner" as const, user };
  throw new Error("غير مصرح — هذه الواجهة للمالك ونائب المالك فقط");
}

/** بوابات الملكية الكاملة: المالك فقط */
async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("غير مصرح");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) throw new Error("غير مصرح — المالك فقط");
  return userId;
}

// ─────────────────────────────────────────────────────────────────────────
// صلاحياتي — تُستخدم في كل الواجهات
// ─────────────────────────────────────────────────────────────────────────

export const getMySiteRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { role: "player" as const, isOwner: false, isDeputy: false };
    const user = await ctx.db.get(userId);
    const owner = isOwnerUser(user);
    const deputy = owner ? false : await isDeputyOwner(ctx, userId);
    return {
      role: owner ? ("owner" as const) : deputy ? ("deputy_owner" as const) : ("player" as const),
      isOwner: owner,
      isDeputy: deputy,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// التعيين والعزل — المالك فقط
// ─────────────────────────────────────────────────────────────────────────

/** قائمة نواب العيّنهم حالياً */
export const listDeputies = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const rows = await ctx.db
      .query("siteRoles")
      .withIndex("by_role", (q: any) => q.eq("role", "deputy_owner"))
      .collect();
    const out = [];
    for (const r of rows) {
      const u = await getUserPublic(ctx, r.userId);
      out.push({
        _id: r._id,
        userId: r.userId,
        name: u?.name ?? "؟",
        email: u?.email ?? "",
        active: r.active,
        appointedAt: r.appointedAt,
      });
    }
    return out;
  },
});

/** البحث عن لاعب بالاسم أو البريد — لاختيار نائب جديد */
export const searchPlayers = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    await requireOwner(ctx);
    const t = term.trim().toLowerCase();
    if (t.length < 2) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u: any) => {
        const name = (u.name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return name.includes(t) || email.includes(t);
      })
      .slice(0, 8)
      .map((u: any) => ({ userId: u._id as any, name: u.name ?? "لاعب", email: u.email ?? "" }));
  },
});

/** تعيين نائب مالك — المالك فقط، حتى نائبين نشطين */
export const appointDeputy = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const ownerId = await requireOwner(ctx);
    if (userId === ownerId) throw new Error("لا يمكنك تعيين نفسك — أنت المالك أصلاً");
    const existing = await ctx.db
      .query("siteRoles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (existing?.active && existing.role === "deputy_owner") {
      throw new Error("هذا اللاعب نائب مالك بالفعل");
    }
    const actives = await ctx.db
      .query("siteRoles")
      .withIndex("by_role", (q: any) => q.eq("role", "deputy_owner"))
      .collect();
    if (actives.filter((r: any) => r.active).length >= 2) {
      throw new Error("الحد الأقصى نائبَان نشطان — اعزل أحدهما أولاً");
    }
    const target = await getUserPublic(ctx, userId);
    if (!target) throw new Error("اللاعب غير موجود");

    if (existing) {
      await ctx.db.patch(existing._id, {
        active: true,
        role: "deputy_owner",
        appointedBy: ownerId,
        appointedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("siteRoles", {
        userId,
        role: "deputy_owner",
        appointedBy: ownerId,
        appointedAt: Date.now(),
        active: true,
      });
    }
    await writeAudit(ctx, ownerId, "owner", "appoint_deputy", `تعيين نائب مالك: ${target.name}`, userId);
    return { ok: true as const, name: target.name };
  },
});

/** عزل نائب مالك — المالك فقط */
export const revokeDeputy = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const ownerId = await requireOwner(ctx);
    const row = await ctx.db
      .query("siteRoles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (!row || !row.active || row.role !== "deputy_owner") throw new Error("هذا اللاعب ليس نائب مالك نشط");
    await ctx.db.patch(row._id, { active: false });
    const target = await getUserPublic(ctx, userId);
    await writeAudit(ctx, ownerId, "owner", "revoke_deputy", `عزل نائب المالك: ${target?.name ?? "؟"}`, userId);
    return { ok: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إدارة اللاعبين — نائب المالك (أو المالك)
// ─────────────────────────────────────────────────────────────────────────

/** فرض حظر لعب أو كتم دردشة — حتى مدة محددة أو دائم */
export const issueBan = mutation({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("play_ban"), v.literal("chat_mute")),
    reason: v.string(),
    durationHours: v.optional(v.number()), // غير موجود = دائم
  },
  handler: async (ctx, { userId, kind, reason, durationHours }) => {
    const { userId: actorId, role } = await requireOwnerOrDeputy(ctx);
    const until = durationHours ? Date.now() + durationHours * 3600_000 : undefined;
    // أوقف أي ممنوعة سابقة من نفس النوع
    const prev = await ctx.db
      .query("siteBans")
      .withIndex("by_user_kind", (q: any) => q.eq("userId", userId).eq("kind", kind))
      .collect();
    for (const p of prev) if (p.active) await ctx.db.patch(p._id, { active: false });

    await ctx.db.insert("siteBans", {
      userId,
      kind,
      reason,
      until,
      issuedBy: actorId,
      issuedAt: Date.now(),
      active: true,
    });
    const target = await getUserPublic(ctx, userId);
    const label = kind === "play_ban" ? "حظر لعب" : "كتم دردشة";
    await writeAudit(
      ctx,
      actorId,
      role,
      kind === "play_ban" ? "play_ban" : "chat_mute",
      `${label} على ${target?.name ?? "؟"} — السبب: ${reason}${until ? ` — حتى ${new Date(until).toLocaleString("ar")}` : " — دائم"}`,
      userId,
    );
    return { ok: true as const };
  },
});

/** رفع ممنوعة */
export const liftBan = mutation({
  args: { userId: v.id("users"), kind: v.union(v.literal("play_ban"), v.literal("chat_mute")) },
  handler: async (ctx, { userId, kind }) => {
    const { userId: actorId, role } = await requireOwnerOrDeputy(ctx);
    const bans = await ctx.db
      .query("siteBans")
      .withIndex("by_user_kind", (q: any) => q.eq("userId", userId).eq("kind", kind))
      .collect();
    let lifted = 0;
    for (const b of bans) {
      if (b.active) {
        await ctx.db.patch(b._id, { active: false });
        lifted++;
      }
    }
    if (lifted === 0) throw new Error("لا توجد ممنوعة نشطة من هذا النوع");
    const target = await getUserPublic(ctx, userId);
    await writeAudit(ctx, actorId, role, "lift_ban", `رفع ${kind === "play_ban" ? "حظر اللعب" : "كتم الدردشة"} عن ${target?.name ?? "؟"}`, userId);
    return { ok: true as const, lifted };
  },
});

/** تعديل نقاط الولاء والخبرة يدوياً — مع سبب إلزامي */
export const adjustPlayerStats = mutation({
  args: {
    userId: v.id("users"),
    pointsDelta: v.optional(v.number()),
    xpDelta: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, { userId, pointsDelta, xpDelta, reason }) => {
    const { userId: actorId, role } = await requireOwnerOrDeputy(ctx);
    const target = await getUserPublic(ctx, userId);
    if (!target) throw new Error("اللاعب غير موجود");

    if (pointsDelta && pointsDelta !== 0) {
      const wallet = await ctx.db
        .query("loyaltyWallets")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .first();
      if (wallet) {
        await ctx.db.patch(wallet._id, { points: Math.max(0, wallet.points + pointsDelta), updatedAt: Date.now() });
        await ctx.db.insert("loyaltyLedger", {
          userId,
          delta: pointsDelta,
          reason: `⚙️ تعديل إداري: ${reason}`,
          at: Date.now(),
        });
      }
    }
    if (xpDelta && xpDelta !== 0) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .first();
      if (profile) await ctx.db.patch(profile._id, { xp: Math.max(0, profile.xp + xpDelta) });
    }
    await writeAudit(
      ctx,
      actorId,
      role,
      "adjust_stats",
      `تعديل إحصاءات ${target.name}: ${pointsDelta ? `نقاط ${pointsDelta > 0 ? "+" : ""}${pointsDelta} ` : ""}${xpDelta ? `خبرة ${xpDelta > 0 ? "+" : ""}${xpDelta}` : ""} — السبب: ${reason}`,
      userId,
    );
    return { ok: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// بوابات الفحص الداخلية — يستدعيها نظام اللعب والدردشة
// ─────────────────────────────────────────────────────────────────────────

/** هل اللاعب محظور من اللعب الآن؟ (داخلي) */
export const isPlayBannedInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const bans = await ctx.db
      .query("siteBans")
      .withIndex("by_user_kind", (q: any) => q.eq("userId", userId).eq("kind", "play_ban"))
      .collect();
    const now = Date.now();
    return bans.some((b: any) => b.active && (!b.until || b.until > now));
  },
});

/** هل اللاعب مكتوم الآن؟ (داخلي) */
export const isChatMutedInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const bans = await ctx.db
      .query("siteBans")
      .withIndex("by_user_kind", (q: any) => q.eq("userId", userId).eq("kind", "chat_mute"))
      .collect();
    const now = Date.now();
    return bans.some((b: any) => b.active && (!b.until || b.until > now));
  },
});

/** حالة أي لاعب — لوحة الإدارة */
export const getPlayerStatus = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    await requireOwnerOrDeputy(ctx);
    const t = term.trim().toLowerCase();
    if (t.length < 2) return null;
    const users = await ctx.db.query("users").collect();
    const user = users.find((u: any) => {
      const name = (u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return name === t || email === t || name.includes(t) || email.includes(t);
    });
    if (!user) return null;
    const now = Date.now();
    const bans = await ctx.db
      .query("siteBans")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    const wallet = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    return {
      userId: user._id as any,
      name: user.name ?? "لاعب",
      email: user.email ?? "",
      xp: profile?.xp ?? 0,
      points: wallet?.points ?? 0,
      playBanned: bans.some((b: any) => b.kind === "play_ban" && b.active && (!b.until || b.until > now)),
      chatMuted: bans.some((b: any) => b.kind === "chat_mute" && b.active && (!b.until || b.until > now)),
      banReasons: bans.filter((b: any) => b.active).map((b: any) => b.reason),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// سجل التدقيق — عرض (المالك يرى الكل، النائب يرى الكل أيضاً لكنه لا يستطيع الحذف — لا يوجد حذف أصلاً)
// ─────────────────────────────────────────────────────────────────────────

export const getAuditLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireOwnerOrDeputy(ctx);
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_created", (q: any) => q.gt("at", 0))
      .order("desc")
      .take(Math.min(limit ?? 60, 200));
    return rows.map((r: any) => ({
      _id: r._id,
      actorName: r.actorName,
      actorRole: r.actorRole,
      action: r.action,
      detail: r.detail,
      at: r.at,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// لوحة تحليلات نائب المالك
// ─────────────────────────────────────────────────────────────────────────

export const getDeputyDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireOwnerOrDeputy(ctx);
    const now = Date.now();
    const dayAgo = now - 24 * 3600_000;

    const users = await ctx.db.query("users").collect();
    const games = await ctx.db.query("gameHistory").collect();
    const activeBans = await ctx.db.query("siteBans").collect();
    const reports = await ctx.db.query("modLogs").collect().catch(() => []);

    const gamesToday = games.filter((g: any) => (g.playedAt ?? g.at ?? 0) > dayAgo).length;
    const bannedNow = activeBans.filter(
      (b: any) => b.active && (!b.until || b.until > now),
    ).length;

    return {
      totalPlayers: users.length,
      gamesToday,
      totalGames: games.length,
      bannedNow,
      openIssues: Array.isArray(reports) ? reports.length : 0,
    };
  },
});
