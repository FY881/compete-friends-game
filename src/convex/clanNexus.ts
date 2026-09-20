import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUser } from "./users";
import { isOwnerUser } from "./owner";
import { readUnitPolicy, unitEnabled } from "./aiRoof";
import { reviseByPolicy } from "./aiCore";
import {
  CLAN_GOALS,
  CLAN_RANKS,
  MAX_CLAN_POWER,
  clanPerks,
  clanRankFor,
  classifyViolation,
  computeClanPower,
  computeClanPulse,
  contributionWeight,
  describeClanStanding,
  explainShare,
  goalProgressPct,
  goalReward,
  goalTarget,
  scoreClanMessage,
  sortContributors,
  splitReward,
  type ClanGoalDef,
  type ClanMemberMind,
} from "./clanCore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ نكسس العشائر — العشيرة قوة ذهنية جماعية، لا دردشة
 *
 * هذا الملف يربط ثلاث طبقات كانت منفصلة:
 *   ١) عقول الأعضاء (نكسس العقول) ⇒ قوة العشيرة ورتبتها ومزاياها
 *   ٢) جولاتهم الحقيقية ⇒ مساهمات أسبوعية وأهداف مشتركة
 *   ٣) مكافأة عادلة (٣٠٪ بالتساوي + ٧٠٪ بحسب المساهمة) ⇒ خزينة العشيرة
 *      وخبرة كل عضو — فيصير للعب الجماعي معنى ملموس.
 * ويضيف فوقها رقابة مُفسَّرة للدردشة وأدوات قيادة كاملة للعرش.
 *
 * كل القراءات مقيّدة بـ take() — صفر collect غير محدود (حماية الاستخدام).
 * ═══════════════════════════════════════════════════════════════════════
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** لا نُعيد حساب قوة العشيرة قبل انقضاء هذه المدة (كتابات محدودة). */
const POWER_REFRESH_MS = 10 * 60 * 1000;
/** سقف مسح العشائر (يحمي الاستعلام من النمو غير المحدود). */
const CLAN_SCAN = 200;
/** سقف مخالفات العضو المُقروءة لحساب بصماته. */
const STRIKE_SCAN = 20;
/** سقف الرسائل المقروءة لفحص الفيضان والتكرار. */
const MOD_MESSAGE_SCAN = 40;

function weekKey(t: number): number {
  return Math.floor(t / WEEK_MS) * WEEK_MS;
}

// ═══════════════════════════════════════════════════════════════════════
// أدوات داخلية
// ═══════════════════════════════════════════════════════════════════════

/**
 * العشيرة التي ينتمي إليها اللاعب — قراءة واحدة بالفهرس (بلا مسح).
 * وإن لم يوجد ربط (عشيرة أُنشئت قبل فهرس العضوية) نعود بمسح مقيّد،
 * فاللعبة لا تُحبس أبداً بسبب بيانات قديمة.
 */
async function findClanOf(ctx: QueryCtx, userId: Id<"users">) {
  const link = await ctx.db.query("clanMembers").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (link) return await ctx.db.get(link.clanId);
  const clans = await ctx.db
    .query("clans")
    .withIndex("by_points", (q) => q.gte("pointsThisWeek", 0))
    .order("desc")
    .take(CLAN_SCAN);
  return clans.find((c) => c.members.includes(userId)) ?? null;
}

/** يصلح ربط العضوية الناقص (ترحيل ذاتي عند أول نشاط حقيقي). */
async function healMemberLink(ctx: MutationCtx, clanId: Id<"clans">, userId: Id<"users">) {
  const link = await ctx.db.query("clanMembers").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (!link) await ctx.db.insert("clanMembers", { clanId, userId, joinedAt: Date.now() });
}

/** يحسب قوة العشيرة من عقول أعضائها فعلاً (عضو واحد = قراءة مقيّدة). */
async function computePowerForClan(ctx: QueryCtx, clan: { members: Id<"users">[] }) {
  const minds: ClanMemberMind[] = [];
  for (const mid of clan.members.slice(0, 30)) {
    const [profile, user] = await Promise.all([
      ctx.db.query("mindProfiles").withIndex("by_user", (q) => q.eq("userId", mid)).first(),
      ctx.db.get(mid),
    ]);
    minds.push({
      userId: String(mid),
      name: user?.name ?? "لاعب",
      tierScore: profile?.tierScore ?? 0,
      sessions: profile?.sessions ?? 0,
    });
  }
  return computeClanPower(minds);
}

async function loadContributions(ctx: QueryCtx, clanId: Id<"clans">, week: number) {
  const rows = await ctx.db
    .query("clanContributions")
    .withIndex("by_clan_week", (q) => q.eq("clanId", clanId).eq("weekKey", week))
    .take(40);
  return rows;
}

/** أهداف الأسبوع بحالتها الحية — محسوبة من المساهمات الحقيقية. */
async function goalsState(
  ctx: QueryCtx,
  clan: { _id: Id<"clans">; members: Id<"users">[]; clanLevel?: number | undefined },
  week: number,
) {
  const [rows, claims] = await Promise.all([
    loadContributions(ctx, clan._id, week),
    ctx.db
      .query("clanGoals")
      .withIndex("by_clan_week", (q) => q.eq("clanId", clan._id).eq("weekKey", week))
      .take(10),
  ]);
  const level = clan.clanLevel ?? 1;
  const progressOf = (def: ClanGoalDef) => {
    switch (def.id) {
      case "rounds":
        return rows.reduce((s, r) => s + r.rounds, 0);
      case "wins":
        return rows.reduce((s, r) => s + r.wins, 0);
      case "perfect":
        return rows.reduce((s, r) => s + r.perfect, 0);
      case "points":
        return rows.reduce((s, r) => s + r.points, 0);
      default:
        return 0;
    }
  };

  return CLAN_GOALS.map((def) => {
    const target = goalTarget(def, clan.members.length);
    const progress = progressOf(def);
    const claim = claims.find((c) => c.goalId === def.id);
    return {
      id: def.id as string,
      title: def.title,
      icon: def.icon,
      unit: def.unit,
      description: def.description,
      target,
      progress,
      pct: Math.round(goalProgressPct(progress, target) * 100),
      met: progress >= target,
      reward: goalReward(def, level),
      claimedAt: claim?.claimedAt ?? null,
      claimedBy: claim?.claimedBy ?? [],
    };
  });
}

/** منح خبرة لعضو (يُنشئ ملفه إن لم يكن موجوداً — كي لا تضيع حصته). */
async function grantXp(ctx: MutationCtx, userId: Id<"users">, amount: number) {
  if (amount <= 0) return;
  const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  const now = Date.now();
  if (profile) {
    await ctx.db.patch(profile._id, { xp: profile.xp + amount, updatedAt: now });
    return;
  }
  await ctx.db.insert("profiles", {
    userId,
    xp: amount,
    gamesPlayed: 0,
    gamesWon: 0,
    bestScore: 0,
    bestStreak: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    badges: [],
    updatedAt: now,
  });
}

async function treasuryOf(ctx: MutationCtx, clanId: Id<"clans">) {
  const existing = await ctx.db.query("clanTreasury").withIndex("by_clan", (q) => q.eq("clanId", clanId)).first();
  if (existing) return existing;
  const id = await ctx.db.insert("clanTreasury", { clanId, coins: 0, upgrades: [], updatedAt: Date.now() });
  return await ctx.db.get(id);
}

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ المساهمات — تُحدَّث تزايدياً بعد كل جولة (بلا أي مسح ثقيل)
// ═══════════════════════════════════════════════════════════════════════

export const tickContribution = internalMutation({
  args: {
    clanId: v.id("clans"),
    userId: v.id("users"),
    rounds: v.number(),
    wins: v.number(),
    perfect: v.number(),
    points: v.number(),
  },
  handler: async (ctx, { clanId, userId, rounds, wins, perfect, points }) => {
    const clan = await ctx.db.get(clanId);
    if (!clan) return { points: 0, power: null as number | null, level: null as number | null };
    if (clan.frozen) return { points: 0, power: clan.power ?? 0, level: clan.clanLevel ?? 1 };
    await healMemberLink(ctx, clanId, userId);

    const now = Date.now();
    const week = weekKey(now);
    const existing = await ctx.db
      .query("clanContributions")
      .withIndex("by_user_week", (q) => q.eq("userId", userId).eq("weekKey", week))
      .first();

    // ميزة رتبة العشيرة تُضاف فعلاً لنقاط الأعضاء
    const boost = 1 + clanPerks(clan.clanLevel ?? 1).warPointsPct / 100;
    const finalPoints = Math.round(Math.max(0, points) * boost);

    if (existing && existing.clanId === clanId) {
      await ctx.db.patch(existing._id, {
        rounds: existing.rounds + rounds,
        wins: existing.wins + wins,
        perfect: existing.perfect + perfect,
        points: existing.points + finalPoints,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("clanContributions", {
        clanId,
        userId,
        weekKey: week,
        rounds,
        wins,
        perfect,
        points: finalPoints,
        updatedAt: now,
      });
    }

    // تحديث قوة العشيرة دورياً فقط (كتابات مقيّدة)
    const stale = now - (clan.powerUpdatedAt ?? 0) > POWER_REFRESH_MS;
    if (!stale) return { points: finalPoints, power: clan.power ?? 0, level: clan.clanLevel ?? 1 };

    const report = await computePowerForClan(ctx, clan);
    await ctx.db.patch(clanId, { power: report.power, clanLevel: report.level, powerUpdatedAt: now });
    return { points: finalPoints, power: report.power, level: report.level };
  },
});

/** تحديث قوة العشيرة يدوياً (لعضو) — بفترة تهدئة تمنع الإغراق. */
export const refreshClanPower = mutation({
  args: { clanId: v.id("clans") },
  handler: async (ctx, { clanId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) throw new Error("غير مصرح");
    await healMemberLink(ctx, clanId, userId);

    const now = Date.now();
    const cooldown = 60_000;
    if (now - (clan.powerUpdatedAt ?? 0) < cooldown) {
      return { ok: true, changed: false, message: "القوة محدَّثة للتو — لا حاجة لإعادة الحساب" };
    }

    const report = await computePowerForClan(ctx, clan);
    const before = clan.clanLevel ?? 1;
    await ctx.db.patch(clanId, { power: report.power, clanLevel: report.level, powerUpdatedAt: now });

    if (report.level > before) {
      await ctx.db.insert("aiDecisionLog", {
        system: "owner",
        actorName: "نكسس العشائر",
        action: "clan_level_up",
        targetId: String(clanId),
        targetName: clan.name,
        detail: `ارتفعت عشيرة «${clan.name}» إلى رتبة ${report.rank.icon} ${report.rank.name} بقوة ${report.power} — الميزة الجديدة: ${report.rank.perk}`,
        severity: "low",
        createdAt: now,
      });
    }

    return {
      ok: true,
      changed: true,
      power: report.power,
      level: report.level,
      rankName: report.rank.name,
      message: `قوة العشيرة ${report.power} · رتبة ${report.rank.icon} ${report.rank.name}`,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ لوحة عشيرتي — القوة والأهداف والمساهمات والرقابة في استعلام واحد
// ═══════════════════════════════════════════════════════════════════════

export const getClanDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const clan = await findClanOf(ctx, userId);
    if (!clan) return null;

    const now = Date.now();
    const week = weekKey(now);

    // ترتيب العشيرة بين العشائر (قراءة مقيّدة بالفهرس)
    const byPower = await ctx.db
      .query("clans")
      .withIndex("by_power", (q) => q.gte("power", 0))
      .order("desc")
      .take(100);
    const myRank = byPower.findIndex((c) => c._id === clan._id) + 1;

    const [contributions, goals, modRows, powerReport] = await Promise.all([
      loadContributions(ctx, clan._id, week),
      goalsState(ctx, clan, week),
      ctx.db.query("clanModeration").withIndex("by_clan", (q) => q.eq("clanId", clan._id)).order("desc").take(10),
      computePowerForClan(ctx, clan),
    ]);

    const named = await Promise.all(
      contributions.map(async (r) => {
        const u = await ctx.db.get(r.userId);
        return {
          userId: String(r.userId),
          name: u?.name ?? "لاعب",
          rounds: r.rounds,
          wins: r.wins,
          perfect: r.perfect,
          points: r.points,
        };
      }),
    );
    const sorted = sortContributors(named);
    const totalWeight = sorted.reduce((s, r) => s + contributionWeight(r), 0);
    const shares = splitReward(1000, sorted.map(contributionWeight));

    const isLeader = clan.ownerId === userId;
    return {
      clan: {
        id: String(clan._id),
        name: clan.name,
        emoji: clan.emoji,
        isLeader,
        memberCount: clan.members.length,
        pointsThisWeek: clan.pointsThisWeek,
        totalPoints: clan.totalPoints,
        frozen: clan.frozen ?? false,
        note: clan.note ?? null,
        weekEndsAt: clan.weeklyResetAt + WEEK_MS,
      },
      power: {
        value: clan.power ?? powerReport.power,
        level: clan.clanLevel ?? powerReport.level,
        rankName: powerReport.rank.name,
        rankIcon: powerReport.rank.icon,
        perk: powerReport.rank.perk,
        perks: clanPerks(clan.clanLevel ?? powerReport.level),
        avgTier: powerReport.avgTier,
        topTier: powerReport.topTier,
        champion: powerReport.champion
          ? { name: powerReport.champion.name, power: powerReport.champion.power, tierScore: powerReport.champion.tierScore }
          : null,
        silentMembers: powerReport.silentMembers,
        updatedAt: clan.powerUpdatedAt ?? null,
      },
      standing:
        myRank > 0
          ? describeClanStanding(myRank, byPower.length, clan.power ?? powerReport.power)
          : "لم تُحتسب قوتكم بعد — اضغط «حدّث القوة»",
      goals,
      contributions: sorted.map((row, i) => ({
        ...row,
        weight: contributionWeight(row),
        sharePct: totalWeight > 0 ? Math.round((contributionWeight(row) / totalWeight) * 100) : 0,
        explain: explainShare(row, shares[i], 1000),
      })),
      moderation: isLeader
        ? modRows.map((m) => ({
            id: String(m._id),
            userName: m.userName,
            kind: m.kind,
            verdict: m.verdict,
            reason: m.reason,
            preview: m.preview,
            at: m.at,
          }))
        : [],
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ استلام الهدف — توزيع عادل حقيقي على المساهمين
// ═══════════════════════════════════════════════════════════════════════

export const claimClanGoal = mutation({
  args: { clanId: v.id("clans"), goalId: v.string() },
  handler: async (ctx, { clanId, goalId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const clan = await ctx.db.get(clanId);
    if (!clan || !clan.members.includes(userId)) throw new Error("غير مصرح");
    if (clan.frozen) throw new Error("العشيرة مُجمَّدة بقرار الإدارة — المكافآت موقوفة مؤقتاً");

    const def = CLAN_GOALS.find((g) => g.id === goalId);
    if (!def) throw new Error("هدف غير معروف");

    const now = Date.now();
    const week = weekKey(now);
    const target = goalTarget(def, clan.members.length);

    const rows = await loadContributions(ctx, clanId, week);
    const progress =
      def.id === "rounds"
        ? rows.reduce((s, r) => s + r.rounds, 0)
        : def.id === "wins"
          ? rows.reduce((s, r) => s + r.wins, 0)
          : def.id === "perfect"
            ? rows.reduce((s, r) => s + r.perfect, 0)
            : rows.reduce((s, r) => s + r.points, 0);
    if (progress < target) {
      throw new Error(`الهدف لم يكتمل: ${progress}/${target} ${def.unit}`);
    }

    const claimed = await ctx.db
      .query("clanGoals")
      .withIndex("by_clan_week", (q) => q.eq("clanId", clanId).eq("weekKey", week))
      .take(10);
    if (claimed.some((c) => c.goalId === def.id && c.claimedAt)) {
      throw new Error("استُلمت مكافأة هذا الهدف هذا الأسبوع بالفعل");
    }

    const reward = goalReward(def, clan.clanLevel ?? 1);
    const contributors = sortContributors(
      await Promise.all(
        rows.map(async (r) => ({
          userId: String(r.userId),
          name: (await ctx.db.get(r.userId))?.name ?? "لاعب",
          rounds: r.rounds,
          wins: r.wins,
          perfect: r.perfect,
          points: r.points,
        })),
      ),
    );
    if (contributors.length === 0) throw new Error("لا مساهمات هذا الأسبوع");

    const weights = contributors.map(contributionWeight);
    const xpPot = reward; // كل عملة خزينة = خبرة تُوزَّع بعدل
    const shares = splitReward(xpPot, weights);

    const claimedBy: { userId: Id<"users">; name: string; amount: number; weight: number }[] = [];
    for (let i = 0; i < contributors.length; i += 1) {
      const c = contributors[i];
      await grantXp(ctx, c.userId as Id<"users">, shares[i]);
      claimedBy.push({ userId: c.userId as Id<"users">, name: c.name, amount: shares[i], weight: weights[i] });
    }

    const treasury = await treasuryOf(ctx, clanId);
    if (treasury) {
      await ctx.db.patch(treasury._id, { coins: treasury.coins + reward, updatedAt: now });
    }

    const existingRow = claimed.find((c) => c.goalId === def.id);
    if (existingRow) {
      await ctx.db.patch(existingRow._id, { claimedAt: now, claimedBy, progress, updatedAt: now });
    } else {
      await ctx.db.insert("clanGoals", {
        clanId,
        weekKey: week,
        goalId: def.id,
        target,
        reward,
        progress,
        claimedAt: now,
        claimedBy,
        updatedAt: now,
      });
    }

    const me = await ctx.db.get(userId);
    await ctx.db.insert("clanMessages", {
      clanId,
      senderId: userId,
      senderName: "نظام العشيرة",
      content: `🎉 أُنجز هدف «${def.icon} ${def.title}» (${progress}/${target}) — وُزّعت مكافأة ${reward} على المساهمين بعدل، وأُضيفت ${reward} عملة لخزينة العشيرة.`,
      createdAt: now,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: `عشيرة ${clan.name}`,
      action: "clan_goal_claimed",
      targetId: String(clanId),
      targetName: clan.name,
      detail: `استُلم هدف «${def.title}» بمكافأة ${reward} — وزّعها ${me?.name ?? "عضو"} على ${contributors.length} مساهماً بالعدل`,
      severity: "low",
      createdAt: now,
    });

    return {
      ok: true,
      message: `وُزّعت ${reward} خبرة على ${contributors.length} مساهماً + ${reward} عملة للخزينة`,
      payouts: contributors.map((c, i) => ({ name: c.name, amount: shares[i], explain: explainShare(c, shares[i], xpPot) })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ رقابة الدردشة — قرار مُفسَّر + سجل للقائد والعرش
// ═══════════════════════════════════════════════════════════════════════

/** يُستدعى من clans.sendClanMessage — يحمي الدردشة ويُفسّر كل قرار. */
export async function guardClanMessage(
  ctx: MutationCtx,
  input: { clanId: Id<"clans">; userId: Id<"users">; userName: string; text: string },
) {
  const now = Date.now();
  const recent = await ctx.db
    .query("clanMessages")
    .withIndex("by_clan", (q) => q.eq("clanId", input.clanId))
    .order("desc")
    .take(MOD_MESSAGE_SCAN);

  const mine = recent.filter((m) => m.senderId === input.userId);
  const timestamps = mine.map((m) => m.createdAt);
  const repeatCount = mine.filter((m) => m.content.trim() === input.text.trim()).length;

  const weekAgo = now - WEEK_MS;
  const flags = await ctx.db
    .query("clanModeration")
    .withIndex("by_user", (q) => q.eq("userId", input.userId).gte("at", weekAgo))
    .take(STRIKE_SCAN);

  // 🧠 سياسة وحدة الرقابة في سقف الذكاء الموحّد تُطبَّق فعلاً هنا:
  //    رفع المالك حساسية «الحارس» ⇒ حجب أبكر · معدل إرسال أقل · تحمّل أقل.
  const policy = await readUnitPolicy(ctx, "guardian");
  const guardianOn = await unitEnabled(ctx, "guardian");
  const raw = scoreClanMessage({
    text: input.text,
    recentTimestamps: timestamps,
    strikes: flags.length,
    repeatCount,
    now,
    limits: { rateLimit: policy.rateLimitPerMinute, strikesBeforeMute: policy.strikeTolerance },
  });
  // إن عطّل المالك وحدة الحارس: تبقى حماية الخطوط الحمراء (تطاول/فيضان) فقط
  const decision = guardianOn
    ? reviseByPolicy(raw, policy)
    : raw.verdict === "ok"
      ? raw
      : { ...raw, reasons: [...raw.reasons, "وحدة الحارس معطّلة — تُطبَّق الخطوط الحمراء فقط"] };

  if (decision.verdict !== "ok") {
    await ctx.db.insert("clanModeration", {
      clanId: input.clanId,
      userId: input.userId,
      userName: input.userName,
      kind: classifyViolation(decision.reasons),
      verdict: decision.verdict,
      reason: decision.reasons.join(" · "),
      preview: input.text.slice(0, 80),
      at: now,
    });

    if (decision.verdict === "flag") {
      await ctx.db.insert("aiDecisionLog", {
        system: "moderation",
        actorName: "رقابة العشائر",
        action: "clan_message_blocked",
        targetId: String(input.userId),
        targetName: input.userName,
        detail: `رُفضت رسالة في عشيرة — السبب: ${decision.reasons.join(" · ")} · النص: «${input.text.slice(0, 60)}»`,
        severity: decision.score >= 6 ? "high" : "medium",
        createdAt: now,
      });
    }
  }

  return decision;
}

// ═══════════════════════════════════════════════════════════════════════
// 5️⃣ أدوات العرش — قيادة كاملة للعشائر
// ═══════════════════════════════════════════════════════════════════════

async function requireOwnerCtx(ctx: MutationCtx) {
  const me = await getCurrentUser(ctx);
  if (me === null || !isOwnerUser(me)) throw new Error("غير مصرح — هذه الصلاحية للحاكم السيادي فقط");
  return me;
}

export const getClanPulse = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (me === null || !isOwnerUser(me)) return null;

    const now = Date.now();
    const clans = await ctx.db
      .query("clans")
      .withIndex("by_power", (q) => q.gte("power", 0))
      .order("desc")
      .take(CLAN_SCAN);

    const flags = await ctx.db.query("clanModeration").withIndex("by_created").order("desc").take(50);

    const pulse = computeClanPulse(
      clans.map((c) => ({
        power: c.power ?? 0,
        level: c.clanLevel ?? 1,
        memberCount: c.members.length,
        pointsThisWeek: c.pointsThisWeek,
        frozen: c.frozen ?? false,
      })),
      flags.map((f) => ({ kind: f.kind, at: f.at })),
      now,
    );

    const clanName = new Map(clans.map((c) => [String(c._id), c]));
    return {
      pulse,
      clans: clans.slice(0, 25).map((c) => ({
        id: String(c._id),
        name: c.name,
        emoji: c.emoji,
        power: c.power ?? 0,
        level: c.clanLevel ?? 1,
        rankName: clanRankFor(c.power ?? 0).name,
        rankIcon: clanRankFor(c.power ?? 0).icon,
        memberCount: c.members.length,
        pointsThisWeek: c.pointsThisWeek,
        totalPoints: c.totalPoints,
        frozen: c.frozen ?? false,
        note: c.note ?? null,
        powerUpdatedAt: c.powerUpdatedAt ?? null,
      })),
      recentFlags: flags.slice(0, 20).map((f) => ({
        id: String(f._id),
        clanName: clanName.get(String(f.clanId))?.name ?? "عشيرة محلولة",
        userName: f.userName,
        kind: f.kind,
        verdict: f.verdict,
        reason: f.reason,
        preview: f.preview,
        at: f.at,
      })),
    };
  },
});

const ownerActionResult = v.object({ ok: v.boolean(), message: v.string() });

export const ownerFreezeClan = mutation({
  args: { clanId: v.id("clans"), frozen: v.boolean(), note: v.optional(v.string()) },
  returns: ownerActionResult,
  handler: async (ctx, { clanId, frozen, note }) => {
    const me = await requireOwnerCtx(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return { ok: false, message: "العشيرة غير موجودة" };
    await ctx.db.patch(clanId, {
      frozen,
      note: note?.trim().slice(0, 160) || clan.note,
    });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: frozen ? "clan_freeze" : "clan_unfreeze",
      detail: frozen
        ? `تجميد عشيرة «${clan.name}» (${clan.members.length} عضواً) — المزايا والمكافآت موقوفة`
        : `رُفع التجميد عن عشيرة «${clan.name}» — عادت المزايا والمكافآت`,
      at: Date.now(),
    });
    return { ok: true, message: frozen ? `جُمّدت «${clan.name}»` : `رُفع التجميد عن «${clan.name}»` };
  },
});

export const ownerRenameClan = mutation({
  args: { clanId: v.id("clans"), name: v.string(), emoji: v.optional(v.string()) },
  returns: ownerActionResult,
  handler: async (ctx, { clanId, name, emoji }) => {
    const me = await requireOwnerCtx(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return { ok: false, message: "العشيرة غير موجودة" };
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (clean.length < 3) return { ok: false, message: "الاسم قصير جداً" };
    const trimmedEmoji = emoji && emoji.trim() ? [...emoji.trim()][0] : clan.emoji;
    await ctx.db.patch(clanId, { name: clean, emoji: trimmedEmoji });
    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "clan_rename",
      detail: `إعادة تسمية عشيرة «${clan.name}» إلى «${clean}»`,
      at: Date.now(),
    });
    return { ok: true, message: `صارت «${clean}»` };
  },
});

export const ownerResetClanWeek = mutation({
  args: { clanId: v.id("clans"), resetPower: v.optional(v.boolean()) },
  returns: ownerActionResult,
  handler: async (ctx, { clanId, resetPower }) => {
    const me = await requireOwnerCtx(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return { ok: false, message: "العشيرة غير موجودة" };
    const now = Date.now();
    const week = weekKey(now);

    const rows = await ctx.db
      .query("clanContributions")
      .withIndex("by_clan_week", (q) => q.eq("clanId", clanId).eq("weekKey", week))
      .take(40);
    for (const r of rows) await ctx.db.delete(r._id);

    const claims = await ctx.db
      .query("clanGoals")
      .withIndex("by_clan_week", (q) => q.eq("clanId", clanId).eq("weekKey", week))
      .take(10);
    for (const c of claims) await ctx.db.delete(c._id);

    await ctx.db.patch(clanId, {
      pointsThisWeek: 0,
      weeklyResetAt: now,
      ...(resetPower ? { power: 0, clanLevel: 1, powerUpdatedAt: 0 } : {}),
    });

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "clan_week_reset",
      detail: `تصفير أسبوع عشيرة «${clan.name}»${resetPower ? " مع قوتها" : ""} — ${rows.length} مساهمة و${claims.length} هدف`,
      at: now,
    });
    return { ok: true, message: `صُفّر أسبوع «${clan.name}» — ${rows.length} مساهمة أُزيلت` };
  },
});

export const ownerDissolveClan = mutation({
  args: { clanId: v.id("clans"), reason: v.optional(v.string()) },
  returns: ownerActionResult,
  handler: async (ctx, { clanId, reason }) => {
    const me = await requireOwnerCtx(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return { ok: false, message: "العشيرة غير موجودة" };

    const messages = await ctx.db
      .query("clanMessages")
      .withIndex("by_clan", (q) => q.eq("clanId", clanId))
      .order("desc")
      .take(300);
    for (const m of messages) await ctx.db.delete(m._id);
    await ctx.db.delete(clanId);

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "clan_dissolve",
      detail: `حُلّت عشيرة «${clan.name}» (${clan.members.length} عضواً) — السبب: ${reason?.trim().slice(0, 120) || "قرار العرش"}`,
      at: Date.now(),
    });
    return { ok: true, message: `حُلّت «${clan.name}» وأُزيل ${messages.length} رسالة` };
  },
});

export const ownerSetClanNote = mutation({
  args: { clanId: v.id("clans"), note: v.string() },
  returns: ownerActionResult,
  handler: async (ctx, { clanId, note }) => {
    await requireOwnerCtx(ctx);
    const clan = await ctx.db.get(clanId);
    if (!clan) return { ok: false, message: "العشيرة غير موجودة" };
    await ctx.db.patch(clanId, { note: note.trim().slice(0, 160) || undefined });
    return { ok: true, message: note.trim() ? "وصلت رسالة العرش إلى العشيرة" : "أُزيلت رسالة العرش" };
  },
});

/** فحص حيّ لقواعد العشائر (يُستخدم للتحقق وللعرض في الواجهة). */
export const clanNexusInfo = query({
  args: {},
  handler: async () => ({
    ranks: CLAN_RANKS.map((r) => ({ level: r.level, name: r.name, icon: r.icon, min: r.min, perk: r.perk })),
    goals: CLAN_GOALS.map((g) => ({
      id: g.id as string,
      title: g.title,
      icon: g.icon,
      base: g.base,
      perMember: g.perMember,
      reward: g.reward,
    })),
    maxPower: MAX_CLAN_POWER,
  }),
});
