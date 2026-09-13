import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUser } from "./users";
import { levelFromXp } from "./gameConfig";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛰️ غرفة القيادة المركزية — عقل غرفة المالك (ترقية مستقبلية 5.0)
 *
 *  1. getCommandOverview : نبضة حية موحدة — مؤشرات كل الأنظمة + تنبيهات
 *     ذكية ملونة حسب الخطورة، تُبنى من بيانات حقيقية حية.
 *  2. searchPlayers      : بحث لاعبين متقدم (نص + دور + حالة الحظر +
 *     نطاق مستوى + ترتيب) لإجراءات سريعة ودقيقة.
 *  3. searchAuditTrail   : سجل تدقيق ذكي يجمع moderationLogs + auditLog
 *     مع فلترة بالمصدر/الخطورة/النوع/الوقت والبحث النصي.
 *  4. getEconomyPulse    : صحة الاقتصاد — تدفق النقاط الداخل والخارج،
 *     أكبر المنفقين، وسرعة تضخم/انكماش حقيقية من loyaltyLedger.
 * ═══════════════════════════════════════════════════════════════════════
 */

async function requireOwner(ctx: { db: any }) {
  const me = await getCurrentUser(ctx as never);
  if (!me || !isOwnerCheck(me)) return null;
  return me;
}

function isOwnerCheck(u: any): boolean {
  return !!u && (u.role === "owner" || u.email === "omw70op@gmail.com");
}

export type SmartAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
  tab: string; // تبويب غرفة المالك المقترح للانتقال
};

export const getCommandOverview = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const [users, games, openReports, modLogs, audit, ledger] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("games").collect(),
        ctx.db
          .query("reports")
          .withIndex("by_status", (q: any) => q.eq("status", "open"))
          .collect(),
        ctx.db
          .query("moderationLogs")
          .withIndex("by_created", (q: any) => q.gte("createdAt", dayAgo))
          .order("desc")
          .take(300),
        ctx.db
          .query("auditLog")
          .withIndex("by_created", (q: any) => q.gte("at", dayAgo))
          .order("desc")
          .take(200),
        ctx.db.query("loyaltyLedger").withIndex("by_user", (q: any) => q.gte("at", dayAgo)).take(2000),
      ]);

    const banned = users.filter((u: Doc<"users">) => u.bannedPermanent || (u.bannedUntil ?? 0) > now).length;
    const muted = users.filter((u: Doc<"users">) => (u.mutedUntil ?? 0) > now).length;
    const activeGames = games.filter((g: Doc<"games">) => g.status !== "finished").length;
    const aiActions24h = modLogs.filter((l: Doc<"moderationLogs">) => l.actorType === "ai").length;
    const ownerActions24h = audit.length + modLogs.filter((l: Doc<"moderationLogs">) => l.actorType === "owner").length;

    // تدفق الاقتصاد من دفتر الولاء الحقيقي (آخر 24 ساعة)
    let loyaltyIn = 0;
    let loyaltyOut = 0;
    for (const l of ledger) {
      if (l.delta > 0) loyaltyIn += l.delta;
      else loyaltyOut += -l.delta;
    }
    const netLoyalty = loyaltyIn - loyaltyOut;

    // التسجيلات خلال 24 ساعة (createdAt غير متاح على users دائماً؛ نستخدم من لديهم حقل)
    const newPlayers = users.filter((u: any) => (u.createdAt ?? 0) > dayAgo).length;

    // ═══ التنبيهات الذكية ═══
    const alerts: SmartAlert[] = [];
    if (openReports.length >= 5) {
      alerts.push({
        id: "reports",
        level: openReports.length >= 12 ? "critical" : "warning",
        title: `${openReports.length} بلاغ مفتوح`,
        detail: "بلاغات بانتظار المراجعة — راجعها قبل أن تتراكم وتفسد ثقة المجتمع.",
        tab: "reports",
      });
    }
    if (users.length > 0 && banned / users.length > 0.12) {
      alerts.push({
        id: "banratio",
        level: "warning",
        title: "نسبة الحظر مرتفعة",
        detail: `${banned} من ${users.length} لاعب محظورون — قد يشير لقانون قاسٍ أو موجة غش.`,
        tab: "players",
      });
    }
    if (netLoyalty < 0 && Math.abs(netLoyalty) > loyaltyIn * 0.8) {
      alerts.push({
        id: "economy",
        level: "warning",
        title: "الاقتصاد ينكمش",
        detail: `الإنفاق يقترب من الكسب (${loyaltyOut} مقابل ${loyaltyIn}) — اللاعبون يستنزفون محافظهم.`,
        tab: "economy",
      });
    }
    const cheatActions = modLogs.filter((l: Doc<"moderationLogs">) => l.action === "cheat").length;
    if (cheatActions >= 3) {
      alerts.push({
        id: "cheat",
        level: cheatActions >= 8 ? "critical" : "warning",
        title: `${cheatActions} حالة غش في 24 ساعة`,
        detail: "الحكم الآلي رصد الغش — راجع سجل اللعب النظيف وأكّد العقوبات.",
        tab: "fairplay",
      });
    }
    if (aiActions24h === 0) {
      alerts.push({
        id: "ai-idle",
        level: "info",
        title: "الذكاء الآلي خامل",
        detail: "لم تنفّذ أنظمة AI أي إجراء خلال 24 ساعة — تأكد أن الرقابة مفعّلة.",
        tab: "ai",
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        id: "all-good",
        level: "info",
        title: "كل شيء تحت السيطرة",
        detail: "لا بلاغات حرجة، الاقتصاد مستقر، والذكاء يعمل. وقت مثالي للتطوير.",
        tab: "dashboard",
      });
    }

    return {
      now,
      users: { total: users.length, banned, muted, newPlayers },
      games: { total: games.length, active: activeGames },
      reports: { open: openReports.length },
      ai: { actions24h: aiActions24h, cheat24h: cheatActions },
      actions: { owner24h: ownerActions24h, total24h: ownerActions24h + aiActions24h },
      economy: { loyaltyIn, loyaltyOut, netLoyalty },
      alerts: alerts.slice(0, 6),
    };
  },
});

export const searchPlayers = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("all"), v.literal("banned"), v.literal("muted"), v.literal("clean"))),
    minLevel: v.optional(v.number()),
    maxLevel: v.optional(v.number()),
    role: v.optional(v.union(v.literal("all"), v.literal("staff"), v.literal("player"))),
    sort: v.optional(v.union(v.literal("level"), v.literal("games"), v.literal("warnings"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const { levelFromXp: levelOf } = await import("./gameConfig");
    const q = (args.search ?? "").trim().toLowerCase();
    const users = await ctx.db.query("users").take(500);
    const rows: any[] = [];
    for (const u of users) {
      const p = await ctx.db
        .query("profiles")
        .withIndex("by_user", (iq: any) => iq.eq("userId", u._id))
        .first();
      const xp = p?.xp ?? 0;
      const level = levelOf(xp);
      if (q && !`${u.name ?? ""}`.toLowerCase().includes(q) && !`${u.email ?? ""}`.toLowerCase().includes(q)) continue;
      const bannedNow = !!u.bannedPermanent || (u.bannedUntil ?? 0) > Date.now();
      const mutedNow = (u.mutedUntil ?? 0) > Date.now();
      const status = bannedNow ? "banned" : mutedNow ? "muted" : "clean";
      if (args.status && args.status !== "all" && status !== args.status) continue;
      if (args.minLevel !== undefined && level < args.minLevel) continue;
      if (args.maxLevel !== undefined && level > args.maxLevel) continue;
      if (args.role === "staff" && !u.role) continue;
      if (args.role === "player" && u.role) continue;
      rows.push({
        id: u._id,
        name: u.name ?? "لاعب مجهول",
        email: u.email ?? null,
        level,
        xp,
        status,
        warnings: u.warnings ?? 0,
        cheatStrikes: u.cheatStrikes ?? 0,
        gamesPlayed: p?.gamesPlayed ?? 0,
        gamesWon: p?.gamesWon ?? 0,
        winRate: p && p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0,
      });
    }
    const sort = args.sort ?? "level";
    rows.sort((a, b) =>
      sort === "games" ? b.gamesPlayed - a.gamesPlayed : sort === "warnings" ? b.warnings - a.warnings : b.level - a.level,
    );
    return rows.slice(0, args.limit ?? 60);
  },
});

export const searchAuditTrail = query({
  args: {
    source: v.optional(v.union(v.literal("all"), v.literal("ai"), v.literal("owner"), v.literal("system"))),
    severity: v.optional(v.union(v.literal("all"), v.literal("low"), v.literal("medium"), v.literal("high"))),
    search: v.optional(v.string()),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const since = Date.now() - (args.hours ?? 168) * 3600_000;
    const q = (args.search ?? "").trim().toLowerCase();

    const modLogs = await ctx.db
      .query("moderationLogs")
      .withIndex("by_created", (iq: any) => iq.gte("createdAt", since))
      .order("desc")
      .take(500);
    const audit = await ctx.db
      .query("auditLog")
      .withIndex("by_created", (iq: any) => iq.gte("at", since))
      .order("desc")
      .take(300);

    type Entry = { at: number; source: string; actor: string; action: string; target: string; detail: string; severity: string };
    let entries: Entry[] = [
      ...modLogs.map((l: Doc<"moderationLogs">) => ({
        at: l.createdAt,
        source: l.actorType,
        actor: l.actorName,
        action: l.action,
        target: l.targetName,
        detail: l.reason,
        severity: l.severity as string,
      })),
      ...audit.map((a: Doc<"auditLog">) => ({
        at: a.at,
        source: "owner",
        actor: a.actorName,
        action: a.action,
        target: "",
        detail: a.detail,
        severity: "medium",
      })),
    ];
    if (args.source && args.source !== "all") entries = entries.filter((e) => e.source === args.source);
    if (args.severity && args.severity !== "all") entries = entries.filter((e) => e.severity === args.severity);
    if (q)
      entries = entries.filter(
        (e) =>
          e.actor.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q),
      );
    entries.sort((a, b) => b.at - a.at);
    return entries.slice(0, 120);
  },
});

/**
 * 📥 صندوق البلاغات الذكي — ترقية قسم البلاغات
 * درجة أولوية حقيقية لكل بلاغ مفتوح محسوبة من:
 *  - خطورة حكم الذكاء الآلي (إن وُجد)
 *  - سمعة المُبلِّغ (ثقة تاريخية)
 *  - تاريخ البلاغات الموثّقة ضد نفس الهدف + سجل عقوباته
 *  - قِدم البلاغ (الأقدم يطفو)
 */
export const getSmartInbox = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const now = Date.now();

    const open = await ctx.db
      .query("reports")
      .withIndex("by_status", (q: any) => q.eq("status", "open"))
      .collect();

    const reporters = await Promise.all(open.map((r: any) => ctx.db.get(r.reporterId)));
    const history = await ctx.db.query("reports").collect();
    const modLogs = await ctx.db
      .query("moderationLogs")
      .withIndex("by_created", (q: any) => q.gte("createdAt", now - 30 * 86400_000))
      .take(1000);

    const priorAgainst = new Map<string, number>();
    for (const r of history) {
      if (r.status === "reviewed") {
        const k = String(r.targetId);
        priorAgainst.set(k, (priorAgainst.get(k) ?? 0) + 1);
      }
    }
    const punishedBefore = new Set(
      modLogs
        .filter((l: any) => l.action === "ban" || l.action === "mute" || l.action === "warn")
        .map((l: any) => String(l.targetId)),
    );

    const items = open.map((r: any, i: number) => {
      const reporter = reporters[i];
      const reputation = (reporter as any)?.reporterReputation ?? 0;
      const ageHours = Math.max(0, (now - r.createdAt) / 3600_000);

      let score = 20;
      const sev = r.aiVerdict?.severity;
      if (sev === "high") score += 45;
      else if (sev === "medium") score += 25;
      else if (sev === "low") score += 10;
      if (r.aiVerdict && !r.aiVerdict.compliant) score -= 20;
      score += Math.max(-15, Math.min(15, reputation * 3));
      score += Math.min(10, priorAgainst.get(String(r.targetId)) ?? 0);
      if (punishedBefore.has(String(r.targetId))) score += 15;
      score += Math.min(15, ageHours / 4);

      let priority: "urgent" | "high" | "normal" | "low";
      if (score >= 70) priority = "urgent";
      else if (score >= 45) priority = "high";
      else if (score >= 25) priority = "normal";
      else priority = "low";

      return {
        id: r._id,
        reporterName: r.reporterName as string,
        reporterReputation: reputation,
        targetId: String(r.targetId),
        targetName: r.targetName as string,
        targetPunishedBefore: punishedBefore.has(String(r.targetId)),
        reason: r.reason as string,
        details: (r.details ?? null) as string | null,
        aiVerdict: r.aiVerdict
          ? {
              compliant: r.aiVerdict.compliant,
              severity: r.aiVerdict.severity as string,
              suggestedAction: r.aiVerdict.suggestedAction as string,
              reasoning: r.aiVerdict.reasoning as string,
            }
          : null,
        createdAt: r.createdAt as number,
        ageHours: Math.round(ageHours),
        score: Math.round(score),
        priority,
      };
    });

    items.sort((a: any, b: any) => b.score - a.score);

    const byReason = new Map<string, number>();
    for (const it of items) byReason.set(it.reason, (byReason.get(it.reason) ?? 0) + 1);
    const reasons = [...byReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      items: items.slice(0, 50),
      reasons,
      urgent: items.filter((it: any) => it.priority === "urgent").length,
      total: items.length,
    };
  },
});

export const getEconomyPulse = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const dayAgo = Date.now() - 24 * 3600_000;
    const ledger = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_user", (q: any) => q.gte("at", dayAgo))
      .take(3000);

    let inflow = 0, outflow = 0;
    const byReason = new Map<string, number>();
    const byUser = new Map<string, number>();
    for (const l of ledger) {
      const delta = l.delta as number;
      if (delta > 0) inflow += delta;
      else outflow += -delta;
      const reason = (l.reason as string) || "أخرى";
      byReason.set(reason, (byReason.get(reason) ?? 0) + delta);
      if (delta < 0) byUser.set(String(l.userId), (byUser.get(String(l.userId)) ?? 0) + -delta);
    }

    const topSpenders: { userId: string; spent: number; name: string }[] = [];
    for (const [uid, spent] of [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      const u = await ctx.db.get(uid as Id<"users">);
      topSpenders.push({ userId: uid, spent, name: u?.name ?? "لاعب مجهول" });
    }

    const velocity = inflow + outflow;
    const health =
      outflow === 0 ? 100 : inflow === 0 ? 20 : Math.max(5, Math.min(100, Math.round((inflow / (inflow + outflow)) * 140)));

    const reasons = [...byReason.entries()]
      .map(([reason, total]) => ({ reason, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 8);

    return { inflow, outflow, net: inflow - outflow, velocity, health, reasons, topSpenders, entries24h: ledger.length };
  },
});
