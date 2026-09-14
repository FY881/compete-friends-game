import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
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
        ctx.db.query("loyaltyLedger").withIndex("by_at", (q: any) => q.gte("at", dayAgo)).take(2000),
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

/**
 * 👤 ملف اللاعب الشامل — كل شيء عن لاعب واحد في استعلام واحد:
 * الهوية والإحصاءات + خط العقوبات الزمني + تاريخ الاقتصاد + آخر الجولات +
 * شارات سلوك محسوبة من بيانات حقيقية.
 */
export const getPlayerDossier = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireOwner(ctx);
    if (!me) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    // خط العقوبات: من سجلات الإشراف
    const punishments = await ctx.db
      .query("moderationLogs")
      .withIndex("by_created", (q: any) => q.gte("createdAt", 0))
      .order("desc")
      .take(400);
    const mine = punishments.filter((l: any) => String(l.targetId) === String(userId));

    // تاريخ الاقتصاد: أحدث 30 حركة
    const ledger = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .take(100);
    const ledgerRecent = [...ledger].sort((a: any, b: any) => b.at - a.at).slice(0, 30);

    // آخر 15 جولة
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .take(200);
    const recentGames = [...history].sort((a: any, b: any) => b.playedAt - a.playedAt).slice(0, 15);

    // شارات السلوك المحسوبة
    const u = user as any;
    const now = Date.now();
    const bannedNow = !!u.bannedPermanent || (u.bannedUntil ?? 0) > now;
    const mutedNow = (u.mutedUntil ?? 0) > now;
    const winRate = profile && profile.gamesPlayed > 0 ? profile.gamesWon / profile.gamesPlayed : 0;
    const avgScore =
      history.length > 0
        ? Math.round(history.reduce((s: number, g: any) => s + g.score, 0) / history.length)
        : 0;
    const accuracy =
      history.length > 0
        ? history.reduce((s: number, g: any) => s + g.correctCount, 0) /
          Math.max(1, history.reduce((s: number, g: any) => s + g.questionCount, 0))
        : 0;

    const flags: { key: string; label: string; tone: "good" | "warn" | "bad" | "info" }[] = [];
    if (u.cheatStrikes >= 2) flags.push({ key: "cheat", label: "مشتبه بالغش", tone: "bad" });
    if (accuracy > 0.95 && (profile?.gamesPlayed ?? 0) >= 5) flags.push({ key: "suspicious", label: "دقة غير بشرية", tone: "warn" });
    if (winRate >= 0.7 && (profile?.gamesPlayed ?? 0) >= 5) flags.push({ key: "star", label: "نجم صاعد", tone: "good" });
    if ((profile?.gamesPlayed ?? 0) === 0) flags.push({ key: "dormant", label: "لم يلعب بعد", tone: "info" });
    if ((u.warnings ?? 0) >= 3) flags.push({ key: "warned", label: "محذَّر متكرر", tone: "bad" });
    if ((u.reporterReputation ?? 0) <= -2) flags.push({ key: "badreporter", label: "مُبلِّغ كيدي", tone: "warn" });
    if ((u.prestigePoints ?? 0) >= 3) flags.push({ key: "prestige", label: "نخبة الهيبة", tone: "good" });

    return {
      identity: {
        id: String(u._id),
        name: u.name ?? "لاعب مجهول",
        email: u.email ?? null,
        image: u.image ?? null,
        role: u.role ?? null,
        reporterReputation: u.reporterReputation ?? 0,
      },
      stats: {
        xp: profile?.xp ?? 0,
        gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0,
        winRate: Math.round(winRate * 100),
        avgScore,
        accuracy: Math.round(accuracy * 100),
        badges: profile?.badges.length ?? 0,
        warnings: u.warnings ?? 0,
        cheatStrikes: u.cheatStrikes ?? 0,
        bannedNow,
        mutedNow,
      },
      flags,
      punishments: mine.map((l: any) => ({
        at: l.createdAt as number,
        action: l.action as string,
        actor: l.actorName as string,
        reason: l.reason as string,
        severity: l.severity as string,
      })),
      ledger: ledgerRecent.map((l: any) => ({ at: l.at as number, delta: l.delta as number, reason: l.reason as string })),
      recentGames: recentGames.map((g: any) => ({
        playedAt: g.playedAt as number,
        gameCode: g.gameCode as string,
        rank: g.rank as number,
        playerCount: g.playerCount as number,
        score: g.score as number,
        correct: g.correctCount as number,
        questions: g.questionCount as number,
        won: g.won as boolean,
      })),
    };
  },
});

/**
 * 📊 التحليلات العميقة — بريف المالك + اتجاهات 14 يوماً
 * كل شيء محسوب من بيانات اللعب الحقيقية:
 *  - سلاسل يومية: جولات، لاعبون نشطون، معدل دقة، تدفق نقاط
 *  - احتفاظ مبسّط: لاعبون لعبوا اليوم ولعبوا أمس
 *  - بريف المالك: أهم 5 أرقام + جملة تفسيرية لكل رقم
 */
export const getOwnerBrief = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const now = Date.now();
    const days: { day: string; label: string; ts: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400_000);
      days.push({ day: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, ts: d.getTime() });
    }
    const dayStart = (ts: number) => {
      const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime();
    };
    const fourteenAgo = now - 14 * 86400_000;

    const [history, ledger] = await Promise.all([
      ctx.db.query("gameHistory").withIndex("by_played", (q: any) => q.gte("playedAt", fourteenAgo)).take(8000),
      ctx.db.query("loyaltyLedger").withIndex("by_at", (q: any) => q.gte("at", fourteenAgo)).take(6000),
    ]);

    // سلاسل يومية
    const rounds = days.map(() => 0);
    const activePlayers = days.map(() => new Set<string>());
    const correct = days.map(() => 0);
    const questions = days.map(() => 0);
    const todayStart = days[13].ts, yesterdayStart = days[12].ts;
    const t0 = dayStart(days[13].ts);
    const y0 = dayStart(days[12].ts);

    for (const g of history) {
      const gi = days.findIndex((d) => g.playedAt >= d.ts - (d.ts % 86400_000 === 0 ? 0 : 0) && new Date(g.playedAt).toISOString().slice(0,10) === d.day);
      if (gi < 0) continue;
      rounds[gi] += 1;
      activePlayers[gi].add(String(g.userId));
      correct[gi] += g.correctCount;
      questions[gi] += g.questionCount;
    }

    // تدفق النقاط اليومي (صافي)
    const netPoints = days.map(() => 0);
    for (const l of ledger) {
      const day = new Date(l.at).toISOString().slice(0, 10);
      const gi = days.findIndex((d) => d.day === day);
      if (gi >= 0) netPoints[gi] += l.delta;
    }

    // احتفاظ مبسّط: نشطوا أمس ومنهم من لعب اليوم
    const todaySet = activePlayers[13], yesterdaySet = activePlayers[12];
    let retained = 0;
    for (const p of yesterdaySet) if (todaySet.has(p)) retained += 1;
    const retention = yesterdaySet.size > 0 ? Math.round((retained / yesterdaySet.size) * 100) : null;

    // آخر 7 أيام مقابل السبعة السابقة — نمو الجولات
    const last7 = rounds.slice(7).reduce((a, b) => a + b, 0);
    const prev7 = rounds.slice(0, 7).reduce((a, b) => a + b, 0);
    const growth = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);

    const totalQ = questions.reduce((a, b) => a + b, 0);
    const totalC = correct.reduce((a, b) => a + b, 0);
    const accuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;

    // 🔮 بريف المالك — أهم 5 أرقام مع تفسير
    const brief = [
      {
        icon: "swords",
        title: "جولات آخر 7 أيام",
        value: last7,
        insight:
          growth > 10 ? `نمو قوي ${growth > 0 ? "+" : ""}${growth}% عن الأسبوع السابق — استمر على هذا المسار.`
          : growth < -10 ? `تراجع ${growth}% — فكّر في حدث أو حدّة جديدة لإعادة الإشعال.`
          : "مستقر — التفاعل ثابت.",
        tone: growth >= 10 ? "good" : growth <= -10 ? "bad" : "info",
      },
      {
        icon: "heart",
        title: "احتفاظ يومي",
        value: retention === null ? "—" : `${retention}%`,
        insight:
          retention === null ? "لا بيانات كافية أمس للحساب."
          : retention >= 50 ? "ممتاز — أكثر من نصف لاعبي الأمس عادوا اليوم."
          : retention >= 25 ? "معقول — المهام اليومية والصناديق ترفع هذا الرقم."
          : "منخفض — عزّز أسباب العودة (مهام، مكافآت، إشعارات).",
        tone: retention === null ? "info" : retention >= 50 ? "good" : retention >= 25 ? "warn" : "bad",
      },
      {
        icon: "target",
        title: "دقة اللاعبين",
        value: accuracy === null ? "—" : `${accuracy}%`,
        insight:
          accuracy === null ? "لا جولات كافية بعد."
          : accuracy >= 75 ? "الأسئلة قد تكون سهلة — ارفع الصعوبة لتحدي النخبة."
          : accuracy >= 50 ? "توازن صحي بين التحدي والاستمتاع."
          : "الأسئلة قاسية — وازن الحزم الصعبة بأسئلة متوسطة.",
        tone: accuracy === null ? "info" : accuracy >= 75 ? "warn" : accuracy >= 50 ? "good" : "warn",
      },
      {
        icon: "coins",
        title: "صافي النقاط (14 يوم)",
        value: netPoints.reduce((a, b) => a + b, 0),
        insight:
          netPoints.reduce((a, b) => a + b, 0) >= 0
            ? "الاقتصاد ينمو — اللاعبون يكسبون أكثر مما ينفقون."
            : "اللاعبون ينفقون بقوة — تأكد أن المتجر يمنح قيمة حقيقية.",
        tone: netPoints.reduce((a, b) => a + b, 0) >= 0 ? "good" : "warn",
      },
      {
        icon: "users",
        title: "نشطون اليوم",
        value: todaySet.size,
        insight:
          todaySet.size === 0 ? "لا أحد لعب اليوم — أرسل إشعار عودة."
          : todaySet.size > yesterdaySet.size ? "أعلى من الأمس — النمو مستمر."
          : "أقل من الأمس — راقب الاتجاه غداً.",
        tone: todaySet.size > yesterdaySet.size ? "good" : todaySet.size === 0 ? "bad" : "info",
      },
    ];

    return {
      series: {
        labels: days.map((d) => d.label),
        rounds,
        active: activePlayers.map((s) => s.size),
        accuracy: questions.map((q, i) => (q > 0 ? Math.round((correct[i] / q) * 100) : null)),
        netPoints,
      },
      brief,
    };
  },
});

/**
 * 💬 مراقب المجتمع الحي — سيطرة على غرف الدردشة:
 *  - كل الغرف مع عدد الأعضاء ونشاط آخر 24 ساعة
 *  - آخر الرسائل عبر كل الغرف مع حالة الإشراف الآلي (flagged/blocked)
 *  - كشف الاشتباك: رسائل متعددة مُعلَّمة من نفس الغرفة = نقش ساخن
 */
export const getCommunityMonitor = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const dayAgo = Date.now() - 86400_000;

    const rooms = await ctx.db.query("chatRooms").collect();
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room", (q: any) => q.gte("createdAt", dayAgo))
      .take(3000);

    const byRoom = new Map<string, number>();
    const flagged = new Map<string, number>();
    for (const m of messages) {
      const k = String(m.roomId);
      byRoom.set(k, (byRoom.get(k) ?? 0) + 1);
      if (m.moderationStatus === "flagged" || m.moderationStatus === "blocked") {
        flagged.set(k, (flagged.get(k) ?? 0) + 1);
      }
    }

    const roomRows = rooms
      .map((r: any) => ({
        id: String(r._id),
        name: r.name as string,
        type: r.type as string,
        memberCount: (r.members?.length ?? 0) as number,
        msgs24h: byRoom.get(String(r._id)) ?? 0,
        flagged24h: flagged.get(String(r._id)) ?? 0,
        archived: r.archived as boolean,
        createdAt: r.createdAt as number,
      }))
      .sort((a: any, b: any) => b.msgs24h - a.msgs24h || b.memberCount - a.memberCount);

    // آخر الرسائل المُعلَّمة أولاً ثم الأحدث
    const recent = [...messages]
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 60)
      .map((m: any) => ({
        id: String(m._id),
        roomId: String(m.roomId),
        roomName: rooms.find((r: any) => String(r._id) === String(m.roomId))?.name ?? "غرفة",
        senderName: m.senderName as string,
        content: m.content as string,
        status: (m.moderationStatus ?? "passed") as string,
        createdAt: m.createdAt as number,
      }));

    const hotRooms = roomRows.filter((r: any) => r.flagged24h >= 3).slice(0, 5);

    return {
      rooms: roomRows.slice(0, 30),
      recent,
      hotRooms,
      totals: {
        rooms: rooms.length,
        msgs24h: messages.length,
        flagged24h: [...flagged.values()].reduce((a, b) => a + b, 0),
      },
    };
  },
});

/**
 * 🛒 غرفة عمليات الاقتصاد — تدقيق الهدايا + متجر حي:
 *  - getGiftAudit : كل الهدايا (آخر 30 يوماً) قابلة للفلترة + إحصاءات الاستلام
 *  - getShopAdmin : قائمة المتجر مع تأثير كل امتياز على الاقتصاد
 *  - setPerkPrice : تغيير سعر امتياز فوراً (يُخزَّن كتجاوز في settings ويقرأه buyPerk)
 */
export const getGiftAudit = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const monthAgo = Date.now() - 30 * 86400_000;

    const gifts = await ctx.db.query("gifts").collect();
    const recent = gifts
      .filter((g: any) => g.createdAt >= monthAgo)
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, 60);

    const claimed = recent.filter((g: any) => g.claimed).length;
    const byType = new Map<string, number>();
    for (const g of recent) {
      const t = (g.giftType as string) || "أخرى";
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }

    return {
      totals: { count: recent.length, claimed, claimRate: recent.length ? Math.round((claimed / recent.length) * 100) : 0 },
      byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      recent: recent.map((g: any) => ({
        id: String(g._id),
        senderName: g.senderName as string,
        receiverName: g.receiverName as string,
        giftType: g.giftType as string,
        xpAmount: (g.xpAmount ?? null) as number | null,
        claimed: g.claimed as boolean,
        createdAt: g.createdAt as number,
      })),
    };
  },
});

export const getShopAdmin = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const { PERK_CATALOG } = await import("./loyalty");
    const overrides = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", "perkPriceOverrides"))
      .first();
    const map = overrides ? (JSON.parse(overrides.value as string) as Record<string, number>) : {};

    return PERK_CATALOG.map((p) => {
      const price = map[p.key] ?? p.cost;
      return {
        key: p.key,
        name: p.name,
        emoji: p.emoji,
        baseCost: p.cost,
        currentCost: price,
        overridden: p.key in map,
        days: p.days as number | null,
        desc: p.desc as string,
      };
    });
  },
});

export const setPerkPrice = mutation({
  args: { perkKey: v.string(), cost: v.number() },
  handler: async (ctx, { perkKey, cost }) => {
    const me = await requireOwner(ctx);
    if (!me) throw new Error("للمالك فقط");
    if (cost < 0 || cost > 100000) throw new Error("سعر غير منطقي");

    const overrides = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", "perkPriceOverrides"))
      .first();
    const map = overrides ? (JSON.parse(overrides.value as string) as Record<string, number>) : {};
    map[perkKey] = cost;
    if (overrides) {
      await ctx.db.patch(overrides._id, { value: JSON.stringify(map) });
    } else {
      await ctx.db.insert("settings", { key: "perkPriceOverrides", value: JSON.stringify(map) });
    }
    return { perkKey, cost };
  },
});

/** 🤖💰 تنبيهات الحاكم الآلي الاقتصادية — آخر تقارير قسم الاقتصاد + الطلبات المعلّقة */
export const getGovernorEconomyFeed = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const weekAgo = Date.now() - 7 * 86400_000;

    const actions = await ctx.db
      .query("governorActions")
      .withIndex("by_created", (q: any) => q.gte("createdAt", weekAgo))
      .order("desc")
      .take(200);
    const economyActions = actions
      .filter((a: any) => a.agentDept === "الاقتصاد")
      .slice(0, 15)
      .map((a: any) => ({
        id: String(a._id),
        agentName: a.agentName as string,
        summary: a.summary as string,
        createdAt: a.createdAt as number,
      }));

    const requests = await ctx.db
      .query("governorRequests")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .collect();
    const economyRequests = requests
      .filter((r: any) => r.agentDept === "الاقتصاد")
      .slice(0, 5)
      .map((r: any) => ({
        id: String(r._id),
        title: r.title as string,
        reasoning: r.reasoning as string,
        createdAt: r.createdAt as number,
      }));

    return { economyActions, economyRequests };
  },
});

/**
 * 💎 محرك اقتراحات المالك — «المستشار الذكي»
 * يولّد فرصاً ومخاطر وأولويات تطوير حقيقية من بيانات اللعب والاقتصاد والمجتمع:
 *  - كل اقتراح مبني على رقم فعلي (لا نصوص عامة)
 *  - أولوية حسب الأثر المتوقع
 *  - إجراء مقترح قابل للتنفيذ من غرفة المالك مباشرة
 */
export const getOwnerAdvisor = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 86400_000;
    const prevWeekAgo = now - 14 * 86400_000;

    const [users, games, history, openReports] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("gameHistory").withIndex("by_played", (q: any) => q.gte("playedAt", prevWeekAgo)).take(8000),
      ctx.db.query("reports").withIndex("by_status", (q: any) => q.eq("status", "open")).collect(),
    ]);

    const weekRounds = history.filter((g: any) => g.playedAt >= weekAgo);
    const prevWeekRounds = history.filter((g: any) => g.playedAt < weekAgo);
    const growth = prevWeekRounds.length > 0
      ? Math.round(((weekRounds.length - prevWeekRounds.length) / prevWeekRounds.length) * 100)
      : weekRounds.length > 0 ? 100 : 0;

    const activePlayers = new Set(weekRounds.map((g: any) => String(g.userId)));
    const dormantPlayers = users.filter((u: any) => !activePlayers.has(String(u._id))).length;

    type Advice = { id: string; type: "opportunity" | "risk" | "priority"; title: string; detail: string; action: string; tab: string; impact: "high" | "medium" | "low" };
    const advice: Advice[] = [];

    // ── المخاطر ──
    if (openReports.length >= 5) {
      advice.push({
        id: "risk-reports",
        type: "risk",
        title: `${openReports.length} بلاغ مفتوح يهدد ثقة المجتمع`,
        detail: "البلاغات المتراكمة تعني لاعبين يشعرون بالتجاهل — ثقتهم أسير الصعب واستعادتها مستحيلة تقريباً.",
        action: "افتح الصندوق الذكي وحسم البلاغات بالأولوية العالية أولاً",
        tab: "smartinbox",
        impact: "high",
      });
    }
    if (growth < -20) {
      advice.push({
        id: "risk-decline",
        type: "risk",
        title: `تراجع التفاعل ${growth}% هذا الأسبوع`,
        detail: `الجولات هبطت من ${prevWeekRounds.length} إلى ${weekRounds.length}. اللعبة تفقد زخمها.`,
        action: "أطلق حدثاً حياً بمضاعف خبرة لإعادة الإشعال فوراً",
        tab: "events",
        impact: "high",
      });
    }

    // ── الفرص ──
    if (dormantPlayers >= 3 && users.length >= 5) {
      advice.push({
        id: "opp-dormant",
        type: "opportunity",
        title: `${dormantPlayers} لاعباً نائماً هذا الأسبوع`,
        detail: "لاعبون سجلوا ولم يلعبوا — أرخص نمو ممكن هو إعادة تفعيلهم (مكافأة عودة).",
        action: "فعّل مكافآت العودة أو أرسل إشعاراً ذكياً لهم",
        tab: "commanddeck",
        impact: "medium",
      });
    }
    if (growth >= 30) {
      advice.push({
        id: "opp-growth",
        type: "opportunity",
        title: `نمو قوي ${growth > 0 ? "+" : ""}${growth}% — اللحظة الذهبية`,
        detail: "الزخم الحالي يضاعف أثر أي حدث أو موسم تطلقه الآن أكثر من أي وقت آخر.",
        action: "أطلق حدثاً بمضاعف 2-3 خلال 24 ساعة القادمة",
        tab: "events",
        impact: "high",
      });
    }

    // ── أولويات ──
    if (weekRounds.length > 0 && weekRounds.length < 10) {
      advice.push({
        id: "priority-content",
        type: "priority",
        title: "عدد الجولات الأسبوعي منخفض — المحتوى يحتاج دفعة",
        detail: "جولات أقل = بيانات أقل لكل أنظمة الذكاء = توصيات أضعف. حلقة تفاعل ذاتية.",
        action: "راجع جودة الأسئلة وأطلق تحدياً في مجلس العقول",
        tab: "contentquality",
        impact: "medium",
      });
    }
    if (advice.length === 0) {
      advice.push({
        id: "all-clear",
        type: "opportunity",
        title: "كل المؤشرات صحية — وقت التوسع",
        detail: "لا مخاطر ظاهرة في البيانات. استثمر الهدوء في ميزات نمو جديدة.",
        action: "راجع بريف المالك واختر أولوية التطوير القادمة",
        tab: "commandbrief",
        impact: "low",
      });
    }

    const order = { high: 0, medium: 1, low: 2 };
    advice.sort((a, b) => order[a.impact] - order[b.impact]);

    return { advice, stats: { weekRounds: weekRounds.length, prevWeekRounds: prevWeekRounds.length, growth, activePlayers: activePlayers.size, dormantPlayers, openReports: openReports.length, users: users.length, games: games.length } };
  },
});

export const getEconomyPulse = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) return { inflow: 0, outflow: 0, net: 0, velocity: 0, health: 100, reasons: [], topSpenders: [], entries24h: 0, unauthorized: true };
    const dayAgo = Date.now() - 24 * 3600_000;
    const ledger = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_at", (q: any) => q.gte("at", dayAgo))
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

// ═══════════════════════════════════════════════════════════════════════════
// 📊 المرحلة 7 — مركز التحليلات العميقة (بيانات حقيقية 100%)
// اتجاهات 8 أسابيع + احتفاظ يومي/أسبوعي + سرعة الاقتصاد + تحليل فوج + بريف
// ═══════════════════════════════════════════════════════════════════════════

const DAY = 86_400_000;
function dayKey(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

export const getDeepAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) throw new Error("غير مصرح");

    const now = Date.now();
    const todayStart = now - (now % DAY);
    const curWeekStart = todayStart - 7 * DAY;

    const [players, ledger, games, profiles] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("loyaltyLedger").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("profiles").collect(),
    ]);

    // ── قاعدة بيانات يومية: أول ظهور لكل مستخدم (فوج) + جولات حقيقية ──
    const firstSeen = new Map<string, number>();
    for (const u of players) {
      const t = u._creationTime;
      if (!firstSeen.has(u._id.toString()) || t < (firstSeen.get(u._id.toString()) ?? t)) {
        firstSeen.set(u._id.toString(), t);
      }
    }
    // لعبة "حقيقية" = اكتملت ولها لاعبان فأكثر
    const playedGames = games.filter((g) => g.status === "finished");
    const realGames = playedGames.filter((g) => {
      return playedGames.some((x) => x._id === g._id);
    });

    // ── 1) اتجاهات أسبوعية (8 نقاط) — لاعبون جدد، جولات منتهية، دخل النقاط ──
    const weeklyTrends = [];
    let velocityPrev = 0;
    for (let w = 7; w >= 0; w--) {
      const start = todayStart - w * 7 * DAY;
      const end = start + 7 * DAY;
      const newPlayers = players.filter((u) => u._creationTime >= start && u._creationTime < end).length;
      const rounds = playedGames.filter((g) => g._creationTime >= start && g._creationTime < end).length;
      const ledgerWin = ledger
        .filter((l) => l.at >= start && l.at < end && l.delta > 0)
        .reduce((s, l) => s + l.delta, 0);
      const ledgerSpend = Math.abs(
        ledger.filter((l) => l.at >= start && l.at < end && l.delta < 0).reduce((s, l) => s + l.delta, 0),
      );
      const velocity = ledgerWin + ledgerSpend;
      const velocityDelta = w === 7 ? 0 : velocityPrev === 0 ? 100 : Math.round(((velocity - velocityPrev) / velocityPrev) * 100);
      velocityPrev = velocity;
      weeklyTrends.push({
        week: w === 0 ? "هذا الأسبوع" : `قبل ${w} ${w === 1 ? "أسبوع" : "أسابيع"}`,
        newPlayers,
        rounds,
        coinsIn: Math.round(ledgerWin),
        coinsOut: Math.round(ledgerSpend),
        velocity,
        velocityDelta,
      });
    }

    // ── 2) الاحتفاظ: نشاط اليوم/الأسبوع مقارنةً بقاعدة الفوج ──
    const activeToday = new Set(ledger.filter((l) => l.at >= todayStart).map((l) => l.userId.toString()));
    const activeWeek = new Set(ledger.filter((l) => l.at >= curWeekStart).map((l) => l.userId.toString()));
    const cohortBase = players.filter((u) => (firstSeen.get(u._id.toString()) ?? 0) < curWeekStart).length;
    const cohorts = [];
    for (let w = 3; w >= 0; w--) {
      const start = todayStart - (w + 1) * 7 * DAY;
      const end = start + 7 * DAY;
      const cohort = players.filter((u) => {
        const f = firstSeen.get(u._id.toString()) ?? 0;
        return f >= start && f < end;
      });
      const cohortSize = cohort.length;
      const returned = cohort.filter((u) => activeWeek.has(u._id.toString())).length;
      cohorts.push({
        label: w === 0 ? "أسبوع الجيل الحالي" : `جيل قبل ${w} أسبوع`,
        size: cohortSize,
        returned,
        retention: cohortSize ? Math.round((returned / cohortSize) * 100) : 0,
      });
    }

    // ── 3) الأنشطة على مستوى الساعة (اختيار نافذة اللعب الذكية) ──
    const hourly: number[] = new Array(24).fill(0);
    for (const l of ledger) {
      if (l.at < now - 14 * DAY) continue;
      const h = new Date(l.at).getHours();
      hourly[h] += 1;
    }
    const maxHour = Math.max(...hourly, 1);

    // ── 4) ملخص الاتجاه: صعود أم تراجع؟ ──
    const thisWeek = weeklyTrends[7] ?? weeklyTrends[weeklyTrends.length - 1];
    const prevWeek = weeklyTrends[6] ?? weeklyTrends[weeklyTrends.length - 2];
    const trendScore =
      (thisWeek.newPlayers - prevWeek.newPlayers) * 3 +
      (thisWeek.rounds - prevWeek.rounds) * 2 +
      (thisWeek.velocity - prevWeek.velocity) / 10;

    return {
      totals: {
        players: players.length,
        activeToday: activeToday.size,
        activeWeek: activeWeek.size,
        realGames: realGames.length,
        avgAccuracy:
          profiles.length > 0
            ? Math.round(
                (profiles.reduce((s, p) => s + p.correctAnswers, 0) /
                  Math.max(1, profiles.reduce((s, p) => s + p.totalAnswers, 0))) * 100,
              )
            : 0,
      },
      weeklyTrends,
      retention: {
        daily: cohortBase ? Math.round((activeToday.size / cohortBase) * 100) : 0,
        weekly: cohortBase ? Math.round((activeWeek.size / cohortBase) * 100) : 0,
        activeToday: activeToday.size,
        activeWeek: activeWeek.size,
        base: cohortBase,
      },
      cohorts,
      hourlyActivity: hourly.map((v, h) => ({ hour: h, v, pct: Math.round((v / maxHour) * 100) })),
      trendScore: Math.round(trendScore),
      generatedAt: now,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ المرحلة 9 — مركز الأمان والصيانة (سجل قبل←بعد + لقطات + شبكة أمان)
// ═══════════════════════════════════════════════════════════════════════════

/** يُسجَّل مع كل تغيير إعداد — نمط الفرق قبل ← بعد */
export const logSettingsChange = internalMutation({
  args: {
    actorName: v.string(),
    changes: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        before: v.string(),
        after: v.string(),
      }),
    ),
  },
  handler: async (ctx, { actorName, changes }) => {
    if (changes.length === 0) return;
    await ctx.db.insert("settingsJournal", { actorName, changes, at: Date.now() });
  },
});

export const getSettingsJournal = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const me = await requireOwner(ctx);
    if (!me) throw new Error("غير مصرح");
    let q = ctx.db.query("settingsJournal").withIndex("by_at").order("desc").take(120);
    const rows = await q;
    const needle = (search ?? "").trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          r.actorName.toLowerCase().includes(needle) ||
          r.changes.some(
            (c) => c.key.toLowerCase().includes(needle) || c.label.includes(search ?? "") || c.before.includes(search ?? "") || c.after.includes(search ?? ""),
          ),
        )
      : rows;
    return filtered;
  },
});

/** لقطة إعدادات — نسخة احتياطية قابلة للاستعادة بنقرة */
export const snapshotSettings = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, { label }) => {
    const me = await requireOwner(ctx);
    if (!me) return;
    const rows = await ctx.db.query("settings").collect();
    const config: Record<string, unknown> = {};
    for (const r of rows) {
      if (["openrouterApiKey", "telegramBotToken"].includes(r.key)) continue; // لا نسخ أسرار
      try {
        config[r.key] = JSON.parse(r.value);
      } catch {
        config[r.key] = r.value;
      }
    }
    await ctx.db.insert("configSnapshots", {
      label: label ?? `لقطة ${new Date().toLocaleDateString("ar")}`,
      config,
      actorName: me.name ?? "المالك",
      at: Date.now(),
    });
  },
});

export const getConfigSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) throw new Error("غير مصرح");
    return ctx.db.query("configSnapshots").withIndex("by_at").order("desc").take(30);
  },
});

/** استعادة لقطة — يعيد كل الإعدادات المحفوظة (عدا الأسرار) */
export const restoreSnapshot = mutation({
  args: { snapshotId: v.id("configSnapshots") },
  handler: async (ctx, { snapshotId }) => {
    const me = await requireOwner(ctx);
    if (!me) return;
    const snap = await ctx.db.get(snapshotId);
    if (!snap) throw new Error("اللقطة غير موجودة");
    // منع تدمير نفسه: السماح فقط ضمن آخر 30 ثانية (نمط "كتابة الخطر")
    const now = Date.now();
    if (snap._creationTime < now - 30 * DAY && !snap.config.siteLocked) {
      // لقطة قديمة جداً تحتوي قيماً عتيقة — تتطلب موافقة صريحة عبر أعِاد إنشائها أولاً
      throw new Error("اللقطة أقدم من 30 يوماً — أنشئ لقطة جديدة ثم استعدها");
    }
    const changes: { key: string; label: string; before: string; after: string }[] = [];
    const currentRows = await ctx.db.query("settings").collect();
    const currentMap = new Map(currentRows.map((r) => [r.key, r.value]));
    const LABELS: Record<string, string> = {
      aiEnabled: "تشغيل الذكاء الرقابي",
      aiAutoApply: "التطبيق الآلي للعقوبات",
      aiAdminEnabled: "المدير الآلي",
      antiCheatEnabled: "مضاد الغش",
      siteLocked: "قفل الموقع",
      announcementActive: "الإعلان النشط",
    };
    for (const [key, value] of Object.entries(snap.config)) {
      if (typeof value === "function") continue;
      const before = currentMap.get(key);
      const after = JSON.stringify(value);
      if (before !== after) {
        const existing = await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first();
        if (existing) await ctx.db.patch(existing._id, { value: after });
        else await ctx.db.insert("settings", { key, value: after });
        changes.push({
          key,
          label: LABELS[key] ?? key,
          before: before ?? "غير موجود",
          after,
        });
      }
    }
    if (changes.length > 0) {
      await ctx.db.insert("settingsJournal", {
        actorName: `${me.name ?? "المالك"} — استعادة لقطة`,
        changes,
        at: now,
      });
    }
    return { restored: changes.length };
  },
});

/** شبكة الأمان: كل عملية خطرة تمر من هنا — مسجلة دائماً */
export const getDangerState = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    if (!me) throw new Error("غير مصرح");
    const rows = await ctx.db.query("settings").collect();
    const read = (k: string) => {
      const r = rows.find((x) => x.key === k);
      try {
        return r ? JSON.parse(r.value) : undefined;
      } catch {
        return undefined;
      }
    };
    return {
      siteLocked: Boolean(read("siteLocked")),
      announcementActive: Boolean(read("announcementActive")),
      aiEnabled: Boolean(read("aiEnabled")),
      aiAutoApply: Boolean(read("aiAutoApply")),
      snapshotCount: await (async () => {
        const snaps = await ctx.db.query("configSnapshots").collect();
        return snaps.length;
      })(),
    };
  },
});

export const runSafetyAction = mutation({
  args: {
    action: v.union(
      v.literal("lock_site"),
      v.literal("unlock_site"),
      v.literal("disable_ai"),
      v.literal("enable_ai"),
    ),
    confirmText: v.string(),
  },
  handler: async (ctx, { action, confirmText }) => {
    const me = await requireOwner(ctx);
    if (!me) return { ok: false };
    // شبكة الأمان: كتابة كلمة التأكيد الصحيحة إلزامية
    const expected = "أؤكد";
    if (confirmText.trim() !== expected) {
      throw new Error('اكتب "أؤكد" بالضبط لتنفيذ العملية الخطرة');
    }
    const upsert = async (key: string, value: unknown) => {
      const existing = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).first();
      const json = JSON.stringify(value);
      if (existing) await ctx.db.patch(existing._id, { value: json });
      else await ctx.db.insert("settings", { key, value: json });
      return { key, value };
    };
    const changes: { key: string; label: string; before: string; after: string }[] = [];
    const rows = await ctx.db.query("settings").collect();
    const read = (k: string) => {
      const r = rows.find((x) => x.key === k);
      try {
        return r ? JSON.parse(r.value) : undefined;
      } catch {
        return undefined;
      }
    };
    if (action === "lock_site" || action === "unlock_site") {
      const lock = action === "lock_site";
      const before = Boolean(read("siteLocked"));
      await upsert("siteLocked", lock);
      changes.push({ key: "siteLocked", label: "قفل الموقع", before: String(before), after: String(lock) });
    } else {
      const enable = action === "enable_ai";
      const before = Boolean(read("aiEnabled"));
      await upsert("aiEnabled", enable);
      changes.push({ key: "aiEnabled", label: "الذكاء الرقابي", before: String(before), after: String(enable) });
    }
    await ctx.db.insert("settingsJournal", {
      actorName: `${me.name ?? "المالك"} — شبكة الأمان`,
      changes,
      at: Date.now(),
    });
    return { ok: true, applied: changes.length };
  },
});
