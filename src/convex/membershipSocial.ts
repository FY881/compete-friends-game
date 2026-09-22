import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🤝 اجتماعيات العضوية — مشاركة الامتيازات + مهام العضوية
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ميزتان جديدتان تربطان العضوية بالمحرّك الاجتماعي للعبة:
 *
 *  1) مشاركة الامتيازات: العضو المميّز يرفع صديقاً (أو عضو فرقته) إلى
 *     مستواه **مؤقتاً** بعدد مقاعد يحدّده امتيازه `perkShareSlots`.
 *     المشاركة تُنشئ ترقية مؤقتة حقيقية، وسحبها يُنهيها فوراً.
 *
 *  2) مهام العضوية: أهداف مشتقّة من إحصاءاتك الحقيقية (جولات/فوز/سلاسل)
 *     تمنحك **دفعات ترقية مؤقتة** — طريق مجاني واقعي للمستويات الأعلى.
 *     عدد المهام المفتوحة ينمو مع امتياز `questSlotsBonus`.
 */

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

// ── أنواع صريحة للعائد: تُوحّد شكل الحالة (مسجّل/غير مسجّل) فلا يتغيّر النوع ──
interface ShareRow {
  id: string;
  beneficiaryName: string;
  tier: Tier;
  expiresAt: number;
  expired: boolean;
  note: string | null;
}
interface IncomingShare {
  id: string;
  ownerName: string;
  tier: Tier;
  expiresAt: number;
  note: string | null;
}
interface MySharesResult {
  isSignedIn: boolean;
  slots: number;
  used: number;
  shareTier: Tier;
  canShare: boolean;
  shares: ShareRow[];
}
interface QuestRow {
  id: string;
  title: string;
  description: string;
  metric: string;
  value: number;
  target: number;
  percent: number;
  rewardTier: Tier;
  rewardHours: number;
  unlocked: boolean;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}
interface QuestsResult {
  isSignedIn: boolean;
  unlocked: number;
  total: number;
  currentTier: Tier;
  quests: QuestRow[];
}

async function findUserByName(ctx: any, name: string) {
  const clean = name.trim();
  if (!clean) return null;
  return await ctx.db
    .query("users")
    .filter((q: any) => q.eq(q.field("name"), clean))
    .first();
}

// ═══════════════════════════════════════════════════════════════════════
// 🤝 مشاركة الامتيازات
// ═══════════════════════════════════════════════════════════════════════

/** مقاعدي: كم مقعداً أملك، ومن يستفيد منها الآن. */
export const getMyShares = query({
  args: {},
  handler: async (ctx): Promise<MySharesResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { isSignedIn: false, slots: 0, used: 0, shares: [], canShare: false, shareTier: "bronze" };
    }
    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);
    const slots = ents.perkShareSlots;

    const rows = await ctx.db
      .query("perkShares")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId).eq("active", true))
      .collect();

    const now = Date.now();
    return {
      isSignedIn: true,
      slots,
      used: rows.filter((r) => r.expiresAt > now).length,
      shareTier: resolved.tier,
      canShare: slots > 0 && tierIndex(resolved.tier) > 0,
      shares: rows.map((r) => ({
        id: String(r._id),
        beneficiaryName: r.beneficiaryName,
        tier: r.tier,
        expiresAt: r.expiresAt,
        expired: r.expiresAt <= now,
        note: r.note ?? null,
      })),
    };
  },
});

/** مشاركات واردَة إليّ — من يرفع مستواي الآن. */
export const getSharedWithMe = query({
  args: {},
  handler: async (ctx): Promise<IncomingShare[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("perkShares")
      .withIndex("by_beneficiary", (q) => q.eq("beneficiaryId", userId).eq("active", true))
      .collect();
    const now = Date.now();
    return rows
      .filter((r) => r.expiresAt > now)
      .map((r) => ({
        id: String(r._id),
        ownerName: r.ownerName,
        tier: r.tier as Tier,
        expiresAt: r.expiresAt,
        note: r.note ?? null,
      }));
  },
});

/**
 * منح مقعد مشاركة لصديق — بقيود حقيقية:
 *   • يجب أن تملك مقاعد (perkShareSlots) ومستوى فوق البرونزي.
 *   • لا تتجاوز المقاعد النشطة.
 *   • المدة بين ١ و٣٠ يوماً.
 *   • لا تشارك مع نفسك، ولا مع من يملك مستوى أعلى أصلاً (بلا فائدة).
 */
export const shareWithName = mutation({
  args: {
    beneficiaryName: v.string(),
    days: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { beneficiaryName, days, note }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");

    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);

    if (tierIndex(resolved.tier) === 0) {
      throw new Error("مشاركة الامتيازات تبدأ من المستوى الفضي — ارفع عضويتك أولاً.");
    }
    if (ents.perkShareSlots <= 0) {
      throw new Error(
        `مستواك (${TIER_META[resolved.tier].name}) لا يمنح مقاعد مشاركة. الفضي يمنح 0، الذهبي 1، الماسي 2، الأسطوري 5.`,
      );
    }

    const clampedDays = Math.max(1, Math.min(30, Math.floor(days)));
    const now = Date.now();

    const active = await ctx.db
      .query("perkShares")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId).eq("active", true))
      .collect();
    const activeNow = active.filter((s) => s.expiresAt > now);
    if (activeNow.length >= ents.perkShareSlots) {
      throw new Error(
        `استهلكت كل مقاعدك (${activeNow.length}/${ents.perkShareSlots}). اسحب مقعداً أو ارفع مستواك للمزيد.`,
      );
    }

    const beneficiary = await findUserByName(ctx, beneficiaryName);
    if (!beneficiary) throw new Error(`لا يوجد لاعب باسم «${beneficiaryName}».`);
    if (String(beneficiary._id) === String(userId)) throw new Error("لا يمكنك مشاركة الامتياز مع نفسك.");

    const already = activeNow.find((s) => String(s.beneficiaryId) === String(beneficiary._id));
    if (already) throw new Error(`«${beneficiary.name ?? beneficiaryName}» يستفيد من مقعدك بالفعل.`);

    const theirResolved = await resolveMembership(ctx, beneficiary._id);
    if (tierIndex(theirResolved.tier) >= tierIndex(resolved.tier)) {
      throw new Error(
        `«${beneficiary.name ?? beneficiaryName}» في مستوى ${TIER_META[theirResolved.tier].name} — لا يحتاج هذه المشاركة.`,
      );
    }

    const expiresAt = now + clampedDays * DAY;
    const me = (await ctx.db.get(userId)) as { name?: string } | null;
    const ownerName = me?.name ?? "عضو";

    const boostId = await ctx.db.insert("membershipBoosts", {
      userId: beneficiary._id,
      tier: resolved.tier,
      source: "share",
      label: `مشاركة امتياز من ${ownerName}`,
      startedAt: now,
      expiresAt,
      note: note ?? `${clampedDays} أيام`,
    });

    await ctx.db.insert("perkShares", {
      ownerId: userId,
      ownerName,
      beneficiaryId: beneficiary._id,
      beneficiaryName: beneficiary.name ?? beneficiaryName,
      tier: resolved.tier,
      startedAt: now,
      expiresAt,
      active: true,
      note,
      boostId,
    });

    await logEvent(ctx, {
      userId: beneficiary._id,
      actorName: ownerName,
      kind: "share",
      tier: resolved.tier,
      detail: `منح «${beneficiary.name ?? beneficiaryName}» امتياز ${TIER_META[resolved.tier].name} لمدة ${clampedDays} يوم`,
      days: clampedDays,
      expiresAt,
    });

    // إشعار حقيقي للطرف الآخر
    await ctx.runMutation(internal.notify.push, {
      userId: beneficiary._id,
      title: `${TIER_META[resolved.tier].emoji} حصلت على امتياز من ${ownerName}!`,
      body: `رفعك إلى مستوى ${TIER_META[resolved.tier].name} لمدة ${clampedDays} يوم. استمتع بالمزايا!`,
      type: "info",
      category: "membership",
      priority: "important",
    });

    return {
      ok: true,
      tier: resolved.tier,
      expiresAt,
      days: clampedDays,
      message: `منحت ${beneficiary.name ?? beneficiaryName} امتياز ${TIER_META[resolved.tier].name} لمدة ${clampedDays} يوم`,
      remainingSlots: Math.max(0, ents.perkShareSlots - activeNow.length - 1),
    };
  },
});

/** سحب مقعد — يُنهي الترقية المؤقتة للطرف الآخر فوراً. */
export const revokeShare = mutation({
  args: { shareId: v.id("perkShares") },
  handler: async (ctx, { shareId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");

    const share = await ctx.db.get(shareId);
    if (!share) throw new Error("المشاركة غير موجودة.");
    if (String(share.ownerId) !== String(userId)) throw new Error("لا تملك صلاحية سحب هذه المشاركة.");
    if (!share.active) return { ok: true, alreadyInactive: true };

    const now = Date.now();
    await ctx.db.patch(shareId, { active: false, expiresAt: now });

    // إنهاء الترقية المؤقتة المرتبطة فوراً
    if (share.boostId) {
      const boost = await ctx.db.get(share.boostId);
      if (boost) await ctx.db.patch(share.boostId, { expiresAt: now });
    }

    const me = (await ctx.db.get(userId)) as { name?: string } | null;
    await logEvent(ctx, {
      userId: share.beneficiaryId,
      actorName: me?.name ?? "عضو",
      kind: "share",
      tier: share.tier,
      detail: `سحب مشاركة الامتياز من «${share.beneficiaryName}»`,
    });

    return { ok: true, beneficiaryName: share.beneficiaryName };
  },
});

/** ترقية مؤقتة يمنحها المالك/NPC لأي لاعب — تُستخدم في الأحداث. */
export const grantBoostByOwner = mutation({
  args: {
    targetName: v.string(),
    tier: v.union(
      v.literal("bronze"),
      v.literal("silver"),
      v.literal("gold"),
      v.literal("diamond"),
      v.literal("exclusive"),
    ),
    hours: v.number(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { targetName, tier, hours, label }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");
    const me = (await ctx.db.get(userId)) as { role?: string; email?: string; name?: string } | null;
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) {
      throw new Error("غرفة المالك فقط.");
    }

    const target = await findUserByName(ctx, targetName);
    if (!target) throw new Error(`لا يوجد لاعب باسم «${targetName}».`);

    const clampedHours = Math.max(1, Math.min(24 * 90, Math.floor(hours)));
    const now = Date.now();
    const expiresAt = now + clampedHours * 60 * 60 * 1000;

    await ctx.db.insert("membershipBoosts", {
      userId: target._id,
      tier,
      source: "owner",
      label: label ?? `منحة من ${me.name ?? "المالك"}`,
      startedAt: now,
      expiresAt,
      note: `${clampedHours} ساعة`,
    });

    await logEvent(ctx, {
      userId: target._id,
      actorName: me.name ?? "المالك",
      kind: "boost",
      tier,
      detail: `منح «${target.name ?? targetName}» ${TIER_META[tier].name} مؤقتاً ${clampedHours} ساعة`,
      expiresAt,
    });

    await ctx.runMutation(internal.notify.push, {
      userId: target._id,
      title: `${TIER_META[tier].emoji} ترقية مؤقتة من الإدارة`,
      body: `حصلت على مستوى ${TIER_META[tier].name} لمدة ${clampedHours} ساعة.`,
      type: "info",
      category: "membership",
      priority: "important",
    });

    return { ok: true, tier, expiresAt, hours: clampedHours };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🎯 مهام العضوية — أهداف حقيقية تُمنح دفعات ترقية
// ═══════════════════════════════════════════════════════════════════════

type QuestMetric = "gamesPlayed" | "gamesWon" | "correctAnswers" | "bestStreak" | "dailyStreak" | "xp";

interface MembershipQuest {
  id: string;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  rewardTier: Tier;
  rewardHours: number;
}

/** مهام مرتّبة تصاعدياً — عدد المفتوح منها ينمو مع questSlotsBonus. */
export const MEMBERSHIP_QUESTS: readonly MembershipQuest[] = [
  { id: "m_q1", title: "الخطوات الأولى", description: "أكمل ٥ جولات كاملة", metric: "gamesPlayed", target: 5, rewardTier: "silver", rewardHours: 24 },
  { id: "m_q2", title: "أول انتصارات", description: "اربح ٥ جولات", metric: "gamesWon", target: 5, rewardTier: "silver", rewardHours: 24 },
  { id: "m_q3", title: "قنّاص الإجابات", description: "٥٠ إجابة صحيحة", metric: "correctAnswers", target: 50, rewardTier: "silver", rewardHours: 48 },
  { id: "m_q4", title: "لاعب مواظب", description: "أكمل ٢٥ جولة", metric: "gamesPlayed", target: 25, rewardTier: "gold", rewardHours: 24 },
  { id: "m_q5", title: "سلسلة الحماس", description: "٧ أيام دخول متتالية", metric: "dailyStreak", target: 7, rewardTier: "gold", rewardHours: 48 },
  { id: "m_q6", title: "صولة ذهبية", description: "اربح ٢٥ جولة", metric: "gamesWon", target: 25, rewardTier: "gold", rewardHours: 72 },
  { id: "m_q7", title: "عقل ماسي", description: "أفضل سلسلة ١٥ إجابة", metric: "bestStreak", target: 15, rewardTier: "diamond", rewardHours: 48 },
  { id: "m_q8", title: "خبير معرفة", description: "اجمع ١٠٠٠٠ نقطة خبرة", metric: "xp", target: 10000, rewardTier: "diamond", rewardHours: 72 },
  { id: "m_q9", title: "أسطورة الحضور", description: "٣٠ يوماً متتالياً", metric: "dailyStreak", target: 30, rewardTier: "exclusive", rewardHours: 48 },
  { id: "m_q10", title: "سيّد الحرب الذهنية", description: "اربح ١٠٠ جولة", metric: "gamesWon", target: 100, rewardTier: "exclusive", rewardHours: 96 },
] as const;

const BASE_QUESTS = 3;

async function profileOf(ctx: any, userId: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

export const getMembershipQuests = query({
  args: {},
  handler: async (ctx): Promise<QuestsResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { isSignedIn: false, unlocked: 0, total: MEMBERSHIP_QUESTS.length, currentTier: "bronze", quests: [] };
    }

    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);
    const unlocked = Math.min(MEMBERSHIP_QUESTS.length, BASE_QUESTS + ents.questSlotsBonus);

    const profile = await profileOf(ctx, userId);
    const stats: Record<QuestMetric, number> = {
      gamesPlayed: profile?.gamesPlayed ?? 0,
      gamesWon: profile?.gamesWon ?? 0,
      correctAnswers: profile?.correctAnswers ?? 0,
      bestStreak: profile?.bestStreak ?? 0,
      dailyStreak: profile?.dailyStreak ?? 0,
      xp: profile?.xp ?? 0,
    };

    const claims = await ctx.db
      .query("membershipQuestClaims")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const claimed = new Set(claims.map((c) => c.questId));

    return {
      isSignedIn: true,
      unlocked,
      total: MEMBERSHIP_QUESTS.length,
      currentTier: resolved.tier,
      quests: MEMBERSHIP_QUESTS.map((q, i) => {
        const value = Math.min(stats[q.metric], q.target);
        const done = stats[q.metric] >= q.target;
        return {
          id: q.id,
          title: q.title,
          description: q.description,
          metric: q.metric,
          value,
          target: q.target,
          percent: Math.round((value / q.target) * 100),
          rewardTier: q.rewardTier,
          rewardHours: q.rewardHours,
          unlocked: i < unlocked,
          completed: done,
          claimed: claimed.has(q.id),
          claimable: done && !claimed.has(q.id) && i < unlocked,
        };
      }),
    };
  },
});

/** استلام مكافأة مهمة — يُتحقق من الإحصاءات على الخادم مجدداً. */
export const claimMembershipQuest = mutation({
  args: { questId: v.string() },
  handler: async (ctx, { questId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً.");

    const quest = MEMBERSHIP_QUESTS.find((q) => q.id === questId);
    if (!quest) throw new Error("مهمة غير معروفة.");

    const resolved = await resolveMembership(ctx, userId);
    const ents = entitlementsOf(resolved.tier);
    const unlocked = Math.min(MEMBERSHIP_QUESTS.length, BASE_QUESTS + ents.questSlotsBonus);
    const order = MEMBERSHIP_QUESTS.findIndex((q) => q.id === questId);
    if (order >= unlocked) {
      throw new Error(
        `هذه المهمة مقفلة — مستواك يفتح ${unlocked} مهام فقط. ارفع عضويتك لفتح المزيد.`,
      );
    }

    const already = await ctx.db
      .query("membershipQuestClaims")
      .withIndex("by_user_quest", (q) => q.eq("userId", userId).eq("questId", questId))
      .first();
    if (already) throw new Error("استلمت مكافأة هذه المهمة بالفعل.");

    const profile = await profileOf(ctx, userId);
    const value: number = profile?.[quest.metric] ?? 0;
    if (value < quest.target) {
      throw new Error(
        `لم تُكمل المهمة بعد — ${value}/${quest.target}. أكملها ثم عد.`,
      );
    }

    const now = Date.now();
    // 🔒 مكافأة مُخمَّدة: لا ترفع لمستوى تخسر معه شيئاً، والمدة محدودة.
    const hours = quest.rewardHours;
    const expiresAt = now + hours * 60 * 60 * 1000;

    const user = (await ctx.db.get(userId)) as { name?: string } | null;

    await ctx.db.insert("membershipQuestClaims", {
      userId,
      questId,
      at: now,
      tier: quest.rewardTier,
      hours,
    });

    await ctx.db.insert("membershipBoosts", {
      userId,
      tier: quest.rewardTier,
      source: "quest",
      label: `مكافأة مهمة: ${quest.title}`,
      startedAt: now,
      expiresAt,
      note: `${hours} ساعة`,
    });

    await logEvent(ctx, {
      userId,
      actorName: user?.name ?? "لاعب",
      kind: "quest",
      tier: quest.rewardTier,
      detail: `أكمل مهمة «${quest.title}» وحصل على ${TIER_META[quest.rewardTier].name} لمدة ${hours} ساعة`,
      expiresAt,
    });

    await ctx.runMutation(internal.notify.push, {
      userId,
      title: `🎯 أنجزت مهمة «${quest.title}»`,
      body: `مكافأتك: مستوى ${TIER_META[quest.rewardTier].name} لمدة ${hours} ساعة.`,
      type: "info",
      category: "membership",
      priority: "important",
    });

    return {
      ok: true,
      tier: quest.rewardTier,
      hours,
      expiresAt,
      message: `استلمت ${TIER_META[quest.rewardTier].name} لمدة ${hours} ساعة`,
    };
  },
});
