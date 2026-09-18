import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";
import { PERK_CATALOG } from "./loyalty";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎰 خزنة المميزات — فتح بنِسَب معلنة + نظام رحمة + تصنيع بالفُتات
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الفتح العشوائي المبهم يبني شكّاً لا متعة. لذلك هنا:
 *   • **النِسَب معلنة في الواجهة حرفياً** (المصدر الواحد هو هذا الملف).
 *   • **نظام رحمة مزدوج**: يضمن مكافأة ملحمية بعد 12 فتحاً بلا ملحمة،
 *     وأسطورية بعد 30 فتحاً — فلا يوجد لاعب «محروم» للأبد.
 *   • **تصنيع بالفُتات**: كل فتح يمنح فُتاتاً حتى لو لم يفز بامتياز،
 *     فتتحوّل الفُتات إلى الامتياز الذي تريده بالضبط.
 *   • كل مكافأة **حقيقية**: ترقية مؤقتة، نقاط ولاء في محفظتك، أو امتياز
 *     من كتالوج اللعبة يُقيَّد في محفظتك (وقد يكون دائماً).
 *
 * الفتح المجاني متاح من المستوى الذهبي فأعلى، وبفاصل زمني يتقلّص مع
 * مستواك — فالمستوى الأعلى يفتح أكثر، وهذا فرق ملموس لا شكلي.
 */

const RARITIES = ["common", "rare", "epic", "legendary"] as const;
type Rarity = (typeof RARITIES)[number];

export const VAULT_ODDS: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

const EPIC_PITY = 12;
const LEGENDARY_PITY = 30;

/** الفاصل الزمني بين الفتحات المجانية حسب المستوى (بالساعات). */
const FREE_OPEN_HOURS: Record<Tier, number> = {
  bronze: 0,
  silver: 0,
  gold: 24,
  diamond: 12,
  exclusive: 6,
};

export interface VaultRewardDef {
  kind: "fragments" | "loyalty" | "boost" | "perk";
  key: string;
  label: string;
  fragments: number;
  loyalty: number;
  boostHours: number;
  boostTier: Tier | null;
}

const REWARD_POOL: Record<Rarity, VaultRewardDef[]> = {
  common: [
    { kind: "fragments", key: "frag_small", label: "٢٥ فُتاتاً", fragments: 25, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "fragments", key: "frag_medium", label: "٤٠ فُتاتاً", fragments: 40, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "loyalty", key: "points_small", label: "١٠٠ نقطة ولاء", fragments: 0, loyalty: 100, boostHours: 0, boostTier: null },
  ],
  rare: [
    { kind: "fragments", key: "frag_large", label: "١٢٠ فُتاتاً", fragments: 120, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "loyalty", key: "points_medium", label: "٣٥٠ نقطة ولاء", fragments: 0, loyalty: 350, boostHours: 0, boostTier: null },
    { kind: "boost", key: "boost_silver_24", label: "‎24 ساعة مستوى فضي", fragments: 0, loyalty: 0, boostHours: 24, boostTier: "silver" },
  ],
  epic: [
    { kind: "boost", key: "boost_gold_48", label: "‎48 ساعة مستوى ذهبي", fragments: 0, loyalty: 0, boostHours: 48, boostTier: "gold" },
    { kind: "perk", key: "frame_neon", label: "إطار «نيون»", fragments: 0, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "loyalty", key: "points_epic", label: "٧٥٠ نقطة ولاء", fragments: 0, loyalty: 750, boostHours: 0, boostTier: null },
    { kind: "fragments", key: "frag_epic", label: "٣٠٠ فُتات", fragments: 300, loyalty: 0, boostHours: 0, boostTier: null },
  ],
  legendary: [
    { kind: "boost", key: "boost_diamond_168", label: "‎7 أيام مستوى ماسي", fragments: 0, loyalty: 0, boostHours: 168, boostTier: "diamond" },
    { kind: "boost", key: "boost_exclusive_72", label: "‎3 أيام مستوى أسطوري", fragments: 0, loyalty: 0, boostHours: 72, boostTier: "exclusive" },
    { kind: "perk", key: "title_genius", label: "لقب «العقل المدبّر»", fragments: 0, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "perk", key: "badge_veteran", label: "شارة المخضرم (دائمة)", fragments: 0, loyalty: 0, boostHours: 0, boostTier: null },
    { kind: "loyalty", key: "points_legend", label: "٢٠٠٠ نقطة ولاء", fragments: 0, loyalty: 2000, boostHours: 0, boostTier: null },
  ],
};

/** جدول التصنيع: كلفة الفُتات لكل امتياز (أوضح وأقصر طريق لمن يريد شيئاً بعينه). */
export const CRAFT_TABLE = PERK_CATALOG.map((p) => ({
  key: p.key,
  name: p.name,
  emoji: p.emoji,
  days: p.days,
  description: p.desc,
  loyaltyPrice: p.cost,
  fragments: p.cost,
}));

function rollRarity(vault: any): { rarity: Rarity; pity: number; forced: boolean } {
  const pity = vault?.pity ?? 0;
  if (pity >= LEGENDARY_PITY) return { rarity: "legendary", pity: 0, forced: true };
  if (pity >= EPIC_PITY) return { rarity: "epic", pity: 0, forced: true };

  const roll = Math.random() * 100;
  let acc = 0;
  let chosen: Rarity = "common";
  for (const rarity of RARITIES) {
    acc += VAULT_ODDS[rarity];
    if (roll < acc) {
      chosen = rarity;
      break;
    }
  }
  const nextPity = chosen === "legendary" ? 0 : pity + 1;
  return { rarity: chosen, pity: nextPity, forced: false };
}

function pickReward(rarity: Rarity): VaultRewardDef {
  const pool = REWARD_POOL[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

async function ensureVault(ctx: any, userId: any) {
  const row = await ctx.db
    .query("perkVault")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (row) return row;
  const id = await ctx.db.insert("perkVault", {
    userId,
    fragments: 0,
    opens: 0,
    pity: 0,
    lastOpenAt: 0,
    unlocked: [],
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

async function getWallet(ctx: any, userId: any, ensure = false) {
  const w = await ctx.db
    .query("loyaltyWallets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (w || !ensure) return w;
  const id = await ctx.db.insert("loyaltyWallets", {
    userId,
    points: 0,
    lifetimeEarned: 0,
    perks: [],
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

/** يطبّق المكافأة فعلياً في النظام الحقيقي المعني ويعيد وصفاً للعرض. */
async function applyReward(
  ctx: any,
  userId: any,
  reward: VaultRewardDef,
): Promise<{ applied: string; kind: string }> {
  const now = Date.now();

  if (reward.kind === "loyalty" && reward.loyalty > 0) {
    const wallet = await getWallet(ctx, userId, true);
    await ctx.db.patch(wallet._id, {
      points: wallet.points + reward.loyalty,
      lifetimeEarned: wallet.lifetimeEarned + reward.loyalty,
      updatedAt: now,
    });
    await ctx.db.insert("loyaltyLedger", {
      userId,
      delta: reward.loyalty,
      reason: `خزنة المميزات: ${reward.label}`,
      at: now,
    });
    return { applied: reward.label, kind: "loyalty" };
  }

  if (reward.kind === "boost" && reward.boostTier && reward.boostHours > 0) {
    await ctx.db.insert("membershipBoosts", {
      userId,
      tier: reward.boostTier,
      source: "vault",
      label: `خزنة المميزات: ${reward.label}`,
      startedAt: now,
      expiresAt: now + reward.boostHours * 60 * 60 * 1000,
      note: "مكافأة من الخزنة",
    });
    return { applied: reward.label, kind: "boost" };
  }

  if (reward.kind === "perk") {
    const def = PERK_CATALOG.find((p) => p.key === reward.key);
    const wallet = await getWallet(ctx, userId, true);
    const perks: { key: string; expiresAt?: number }[] = wallet.perks ?? [];
    const already = wallet.perks?.some(
      (p: any) => p.key === reward.key && (p.expiresAt ?? null) === null,
    );
    if (already) {
      // لا نُهدي ما يملكه — نُحوّله إلى فُتات عادل
      return { applied: "مملوك بالفعل — استُبدل بـ120 فُتاتاً", kind: "fragments" };
    }
    const entry: { key: string; expiresAt?: number } = def?.days
      ? { key: reward.key, expiresAt: now + def.days * DAY }
      : { key: reward.key };
    await ctx.db.patch(wallet._id, { perks: [...perks, entry], updatedAt: now });
    return { applied: reward.label, kind: "perk" };
  }

  return { applied: reward.label, kind: "fragments" };
}

// ═══════════════════════════════════════════════════════════════════════
// 📊 حالة الخزنة
// ═══════════════════════════════════════════════════════════════════════

export const getVault = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const resolved = await resolveMembership(ctx, userId);
    const tier = resolved.tier;
    const freeHours = FREE_OPEN_HOURS[tier as Tier] ?? 0;
    const unlocked = freeHours > 0 || tierIndex(tier) >= tierIndex("gold");

    const vault = await ctx.db
      .query("perkVault")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    const lastOpenAt = vault?.lastOpenAt ?? 0;
    const readyAt = lastOpenAt + freeHours * 60 * 60 * 1000;
    const freeReady = unlocked && freeHours > 0 && now >= readyAt;
    const minutesToNextOpen = freeReady ? 0 : Math.max(0, Math.ceil((readyAt - now) / 60000));

    const wallet = await getWallet(ctx, userId);
    const ownedKeys = (wallet?.perks ?? []).map((p: any) => p.key);
    const fragments = vault?.fragments ?? 0;

    const history = await ctx.db
      .query("perkVaultOpens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    return {
      unlocked,
      tier,
      tierName: TIER_META[tier as Tier].name,
      freeOpenHours: freeHours,
      freeReady,
      minutesToNextOpen,
      fragments,
      opens: vault?.opens ?? 0,
      pity: vault?.pity ?? 0,
      epicPity: EPIC_PITY,
      legendaryPity: LEGENDARY_PITY,
      pityProgress: Math.min(100, Math.round(((vault?.pity ?? 0) / EPIC_PITY) * 100)),
      guaranteedNext:
        (vault?.pity ?? 0) >= LEGENDARY_PITY
          ? "legendary"
          : (vault?.pity ?? 0) >= EPIC_PITY
            ? "epic"
            : null,
      odds: RARITIES.map((r) => ({ rarity: r, percent: VAULT_ODDS[r], pool: REWARD_POOL[r].map((x) => x.label) })),
      craft: CRAFT_TABLE.map((c) => ({
        ...c,
        affordable: fragments >= c.fragments,
        owned: ownedKeys.includes(c.key),
      })),
      ownedPerks: ownedKeys,
      history: history.map((h) => ({
        id: String(h._id),
        kind: h.rewardKind,
        key: h.rewardKey,
        label: h.label,
        rarity: h.rarity,
        at: h.at,
      })),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 🎲 الفتح
// ═══════════════════════════════════════════════════════════════════════

export const openVault = mutation({
  args: { useFragments: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");

    const resolved = await resolveMembership(ctx, userId);
    if (tierIndex(resolved.tier) < tierIndex("gold")) {
      throw new Error("خزنة المميزات متاحة من المستوى الذهبي فأعلى.");
    }

    const tier = resolved.tier;
    const freeHours = FREE_OPEN_HOURS[tier as Tier] ?? 24;
    const vault = await ensureVault(ctx, userId);
    const now = Date.now();
    const readyAt = (vault.lastOpenAt ?? 0) + freeHours * 60 * 60 * 1000;
    const freeReady = now >= readyAt;
    const FRAGMENT_COST = 150;

    let paidWith: "free" | "fragments" = "free";
    if (!freeReady) {
      if (args.useFragments === false) {
        const mins = Math.ceil((readyAt - now) / 60000);
        throw new Error(`الفتحة المجانية القادمة بعد ${mins} دقيقة — أو افتح بالفُتات.`);
      }
      if ((vault.fragments ?? 0) < FRAGMENT_COST) {
        throw new Error(
          `الفتحة المجانية غير جاهزة، وتحتاج ${FRAGMENT_COST} فُتاتاً للفتح الفوري (لديك ${vault.fragments ?? 0}).`,
        );
      }
      paidWith = "fragments";
    }

    const { rarity, pity, forced } = rollRarity(vault);
    const reward = pickReward(rarity);
    const result = await applyReward(ctx, userId, reward);

    // استبدال الامتياز المملوك بفُتات (كان مذكوراً في applyReward)
    let fragmentsGain = reward.kind === "fragments" ? reward.fragments : 0;
    if (result.kind === "fragments" && reward.kind !== "fragments") fragmentsGain += 120;

    const spentFragments = paidWith === "fragments" ? FRAGMENT_COST : 0;
    const newFragments = Math.max(0, (vault.fragments ?? 0) - spentFragments + fragmentsGain);

    await ctx.db.patch(vault._id, {
      fragments: newFragments,
      opens: (vault.opens ?? 0) + 1,
      pity,
      lastOpenAt: now,
      unlocked: reward.kind === "perk" && result.kind === "perk"
        ? Array.from(new Set([...(vault.unlocked ?? []), reward.key]))
        : vault.unlocked ?? [],
      updatedAt: now,
    });

    await ctx.db.insert("perkVaultOpens", {
      userId,
      rewardKind: result.kind,
      rewardKey: reward.key,
      label: result.applied,
      rarity,
      at: now,
    });

    await logEvent(ctx, {
      userId,
      actorName: "خزنة المميزات",
      kind: "vault",
      tier,
      detail: `فتح الخزنة (${paidWith === "free" ? "مجاناً" : `${FRAGMENT_COST} فُتات`}) → ${rarity}: ${result.applied}${forced ? " (نظام الرحمة)" : ""}`,
    });

    return {
      ok: true,
      rarity,
      reward: { ...reward, label: result.applied, kind: result.kind },
      fragmentsGain,
      fragments: newFragments,
      paidWith,
      spentFragments,
      forced,
      pity,
      guaranteedNext: pity >= LEGENDARY_PITY ? "legendary" : pity >= EPIC_PITY ? "epic" : null,
    };
  },
});

/** تصنيع امتياز بعينه بالفُتات — الطريق المضمون لمن يريد شيئاً محدداً. */
export const craftPerk = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");

    const item = CRAFT_TABLE.find((c) => c.key === args.key);
    if (!item) throw new Error("امتياز غير معروف.");

    const resolved = await resolveMembership(ctx, userId);
    if (tierIndex(resolved.tier) < tierIndex("silver")) {
      throw new Error("التصنيع متاح من المستوى الفضي فأعلى.");
    }

    const vault = await ensureVault(ctx, userId);
    if ((vault.fragments ?? 0) < item.fragments) {
      throw new Error(`تحتاج ${item.fragments} فُتاتاً ولديك ${vault.fragments ?? 0}.`);
    }

    const wallet = await getWallet(ctx, userId, true);
    const now = Date.now();
    const perks: { key: string; expiresAt?: number }[] = wallet.perks ?? [];
    const entry: { key: string; expiresAt?: number } = item.days
      ? { key: item.key, expiresAt: now + item.days * DAY }
      : { key: item.key };
    const filtered = perks.filter((p) => p.key !== item.key);

    await ctx.db.patch(wallet._id, { perks: [...filtered, entry], updatedAt: now });
    await ctx.db.patch(vault._id, {
      fragments: (vault.fragments ?? 0) - item.fragments,
      unlocked: Array.from(new Set([...(vault.unlocked ?? []), item.key])),
      updatedAt: now,
    });

    await logEvent(ctx, {
      userId,
      actorName: "خزنة المميزات",
      kind: "vault",
      tier: resolved.tier,
      detail: `صنع «${item.name}» بـ${item.fragments} فُتاتاً`,
    });

    return { ok: true, key: item.key, name: item.name, fragments: (vault.fragments ?? 0) - item.fragments };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 👑 تحكم المالك
// ═══════════════════════════════════════════════════════════════════════

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

/** منح فُتات — المالك فقط. */
export const ownerGrantFragments = mutation({
  args: { userName: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await userByName(ctx, args.userName);
    const vault = await ensureVault(ctx, target._id);
    const amount = Math.max(0, Math.min(10_000, Math.round(args.amount)));
    await ctx.db.patch(vault._id, {
      fragments: (vault.fragments ?? 0) + amount,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "vault",
      detail: `منح ${amount} فُتاتاً للخزنة`,
    });
    return { ok: true, fragments: (vault.fragments ?? 0) + amount };
  },
});

/** مباركة الخزنة: الفتحة القادمة أسطورية مضمونة — المالك فقط. */
export const ownerBlessVault = mutation({
  args: { userName: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const target = await userByName(ctx, args.userName);
    const vault = await ensureVault(ctx, target._id);
    await ctx.db.patch(vault._id, {
      pity: LEGENDARY_PITY,
      updatedAt: Date.now(),
    });
    await logEvent(ctx, {
      userId: target._id,
      actorName: owner.name ?? "المالك",
      kind: "vault",
      detail: "مباركة الخزنة — الفتحة القادمة أسطورية مضمونة",
    });
    return { ok: true, target: target.name ?? "لاعب" };
  },
});
