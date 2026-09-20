import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUser } from "./users";
import { isOwnerUser } from "./owner";
import {
  FACULTY_KEYS,
  FACULTY_META,
  MAX_TIER_SCORE,
  MIND_RANKS,
  MAX_GRANT_AMOUNT,
  clampSnapshot,
  computeMindPulse,
  describePosition,
  rankPosition,
  snapshotSignature,
} from "./mindCore";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 نكسس العقول (Mind Nexus) — الجسر بين عقل اللاعب الحقيقي وعالم اللعبة
 *
 * المشكلة التي يحلّها: «العقل المتطور» يُبنى في المحرك المحلي من إجابات
 * حقيقية، لكنه كان محصوراً في متصفح واحد — بلا ترتيب، بلا منافسة، وبلا
 * قدرة للمالك على رؤيته أو التأثير فيه.
 *
 * هذا النظام يجعله حقيقياً على مستوى اللعبة:
 *   • مزامنة لقطة العقل (مقيّدة ومحسوبة على الخادم — لا ثقة بالعميل)
 *   • لوحة صدارة العقول ⇒ منافسة فعلية بين الأصدقاء
 *   • نبضة المالك ⇒ الصحة الذهنية للمجتمع في صورة واحدة
 *   • منح/تجميد/تصفير من العرش ⇒ تغيير حقيقي في عقل اللاعب عند أول دخول
 *
 * كل الاستعلامات مقيّدة بـ take() — صفر collect غير محدود (حماية استخدام).
 * ═══════════════════════════════════════════════════════════════════════
 */

/** سقف المسح عند حساب الترتيب (قراءة مقيّدة). */
const RANK_SCAN = 200;
/** سقف المسح لنبضة المالك. */
const PULSE_SCAN = 300;
/** أقصى عدد منح يُقرأ للاعب الواحد. */
const GRANT_SCAN = 20;
/** لا نُحدّث «حضور» اللاعب إلا كل ٦ ساعات (كتابات مقيّدة). */
const PRESENCE_INTERVAL = 6 * 60 * 60 * 1000;

const facultyValidator = v.object({
  logic: v.number(),
  knowledge: v.number(),
  speed: v.number(),
  memory: v.number(),
  focus: v.number(),
  intuition: v.number(),
});

const grantValidator = v.object({
  id: v.string(),
  kind: v.string(),
  faculty: v.string(),
  amount: v.number(),
  reason: v.string(),
  actorName: v.string(),
  at: v.number(),
});

const profileReturn = v.object({
  name: v.string(),
  avatar: v.union(v.string(), v.null()),
  tierScore: v.number(),
  rankLevel: v.number(),
  rankName: v.string(),
  rankIcon: v.string(),
  identityTitle: v.string(),
  identityIcon: v.string(),
  faculties: facultyValidator,
  equipped: v.array(v.string()),
  unlocked: v.array(v.string()),
  mastery: v.array(v.object({ category: v.string(), score: v.number(), tier: v.number() })),
  sessions: v.number(),
  frozen: v.boolean(),
  note: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

/** يحوّل صف الخادم إلى شكل واحد يفهمه كل المشاهدين. */
function toProfileReturn(row: {
  name: string;
  avatar?: string | undefined;
  tierScore: number;
  rankLevel: number;
  identityTitle: string;
  identityIcon: string;
  faculties: Record<string, number>;
  equipped: string[];
  unlocked: string[];
  mastery: { category: string; score: number; tier: number }[];
  sessions: number;
  frozen: boolean;
  note?: string | undefined;
  updatedAt: number;
}) {
  const rank = MIND_RANKS.find((r) => r.level === row.rankLevel) ?? MIND_RANKS[0];
  return {
    name: row.name,
    avatar: row.avatar ?? null,
    tierScore: row.tierScore,
    rankLevel: row.rankLevel,
    rankName: rank.name,
    rankIcon: rank.icon,
    identityTitle: row.identityTitle,
    identityIcon: row.identityIcon,
    faculties: {
      logic: row.faculties.logic ?? 0,
      knowledge: row.faculties.knowledge ?? 0,
      speed: row.faculties.speed ?? 0,
      memory: row.faculties.memory ?? 0,
      focus: row.faculties.focus ?? 0,
      intuition: row.faculties.intuition ?? 0,
    },
    equipped: row.equipped,
    unlocked: row.unlocked,
    mastery: row.mastery,
    sessions: row.sessions,
    frozen: row.frozen,
    note: row.note ?? null,
    updatedAt: row.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ المزامنة — عقل اللاعب يصبح حقيقة على مستوى اللعبة
// ═══════════════════════════════════════════════════════════════════════

export const syncMyMind = mutation({
  args: {
    name: v.string(),
    avatar: v.optional(v.string()),
    faculties: facultyValidator,
    equipped: v.array(v.string()),
    unlocked: v.array(v.string()),
    mastery: v.array(v.object({ category: v.string(), score: v.number(), tier: v.number() })),
    identityTitle: v.string(),
    identityIcon: v.string(),
    sessions: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.union(v.literal("synced"), v.literal("unchanged"), v.literal("frozen"), v.literal("unauthenticated")),
    tierScore: v.number(),
    rankLevel: v.number(),
    grants: v.array(grantValidator),
    note: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return {
        ok: false,
        reason: "unauthenticated" as const,
        tierScore: 0,
        rankLevel: 1,
        grants: [],
        note: null,
      };
    }

    const snapshot = clampSnapshot({
      ...args,
      name: args.name.trim().length > 0 ? args.name : (user.name ?? "لاعب"),
    });
    const signature = snapshotSignature(snapshot);
    const existing = await ctx.db
      .query("mindProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const grants = await ctx.db
      .query("mindGrants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(GRANT_SCAN);

    const grantPayload = grants.map((g) => ({
      id: String(g._id),
      kind: g.kind,
      faculty: g.faculty,
      amount: g.amount,
      reason: g.reason,
      actorName: g.actorName,
      at: g.at,
    }));

    // 🛑 قرار العرش بالتجميد: عقوبة حقيقية — لا يُقبل أي تقدّم جديد
    if (existing?.frozen) {
      return {
        ok: false,
        reason: "frozen" as const,
        tierScore: existing.tierScore,
        rankLevel: existing.rankLevel,
        grants: grantPayload,
        note: existing.note ?? null,
      };
    }

    const now = Date.now();
    const fields = {
      name: snapshot.name,
      avatar: snapshot.avatar ?? undefined,
      tierScore: snapshot.tierScore,
      rankLevel: snapshot.rankLevel,
      identityTitle: snapshot.identityTitle,
      identityIcon: snapshot.identityIcon,
      faculties: snapshot.faculties,
      equipped: snapshot.equipped,
      unlocked: snapshot.unlocked,
      mastery: snapshot.mastery,
      sessions: snapshot.sessions,
      signature,
      updatedAt: now,
    };

    if (!existing) {
      await ctx.db.insert("mindProfiles", {
        userId: user._id,
        frozen: false,
        ...fields,
      });
      return {
        ok: true,
        reason: "synced" as const,
        tierScore: snapshot.tierScore,
        rankLevel: snapshot.rankLevel,
        grants: grantPayload,
        note: null,
      };
    }

    // بلا تغيير حقيقي ⇒ نكتفي بتحديث الحضور كل ٦ ساعات (توفير كتابات)
    if (existing.signature === signature && now - existing.updatedAt < PRESENCE_INTERVAL) {
      return {
        ok: true,
        reason: "unchanged" as const,
        tierScore: existing.tierScore,
        rankLevel: existing.rankLevel,
        grants: grantPayload,
        note: existing.note ?? null,
      };
    }

    await ctx.db.patch(existing._id, fields);
    return {
      ok: true,
      reason: "synced" as const,
      tierScore: snapshot.tierScore,
      rankLevel: snapshot.rankLevel,
      grants: grantPayload,
      note: existing.note ?? null,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ عقلي — اللقطة + المنح + موقعي بين العقول
// ═══════════════════════════════════════════════════════════════════════

export const getMyMind = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      profile: v.union(v.null(), profileReturn),
      grants: v.array(grantValidator),
      position: v.object({
        rank: v.number(),
        total: v.number(),
        ahead: v.number(),
        ceilingReached: v.boolean(),
      }),
      description: v.string(),
      maxTierScore: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const row = await ctx.db
      .query("mindProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const grants = await ctx.db
      .query("mindGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(GRANT_SCAN);

    // قراءة مقيّدة: أقوى ٢٠٠ عقل فقط ⇒ الترتيب حدّ أدنى معلن بصدق
    const top = await ctx.db.query("mindProfiles").withIndex("by_rank").order("desc").take(RANK_SCAN);
    const myScore = row?.tierScore ?? 0;
    const position = rankPosition(
      myScore,
      top.map((r) => r.tierScore),
      top.length,
      RANK_SCAN,
    );

    return {
      profile: row ? toProfileReturn(row) : null,
      grants: grants.map((g) => ({
        id: String(g._id),
        kind: g.kind,
        faculty: g.faculty,
        amount: g.amount,
        reason: g.reason,
        actorName: g.actorName,
        at: g.at,
      })),
      position,
      description: describePosition(position),
      maxTierScore: MAX_TIER_SCORE,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ لوحة صدارة العقول — منافسة حقيقية بين الأصدقاء
// ═══════════════════════════════════════════════════════════════════════

export const getMindLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.union(
    v.null(),
    v.object({
      rows: v.array(
        v.object({
          rank: v.number(),
          userId: v.string(),
          name: v.string(),
          avatar: v.union(v.string(), v.null()),
          tierScore: v.number(),
          rankLevel: v.number(),
          rankName: v.string(),
          rankIcon: v.string(),
          identityTitle: v.string(),
          identityIcon: v.string(),
          sessions: v.number(),
          isMe: v.boolean(),
        }),
      ),
      total: v.number(),
      myRank: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const size = Math.max(3, Math.min(50, Math.floor(limit ?? 20)));
    const top = await ctx.db.query("mindProfiles").withIndex("by_rank").order("desc").take(RANK_SCAN);
    const myIndex = top.findIndex((r) => r.userId === userId);

    return {
      rows: top.slice(0, size).map((r, i) => {
        const rank = MIND_RANKS.find((m) => m.level === r.rankLevel) ?? MIND_RANKS[0];
        return {
          rank: i + 1,
          userId: String(r.userId),
          name: r.name,
          avatar: r.avatar ?? null,
          tierScore: r.tierScore,
          rankLevel: r.rankLevel,
          rankName: rank.name,
          rankIcon: rank.icon,
          identityTitle: r.identityTitle,
          identityIcon: r.identityIcon,
          sessions: r.sessions,
          isMe: r.userId === userId,
        };
      }),
      total: top.length,
      myRank: myIndex >= 0 ? myIndex + 1 : null,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ نبضة العقول — للمالك: الصحة الذهنية للمجتمع في صورة واحدة
// ═══════════════════════════════════════════════════════════════════════

export const getMindPulse = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      pulse: v.object({
        total: v.number(),
        active24h: v.number(),
        frozen: v.number(),
        avgTier: v.number(),
        topTier: v.number(),
        rankBuckets: v.array(
          v.object({
            level: v.number(),
            name: v.string(),
            icon: v.string(),
            tone: v.string(),
            count: v.number(),
          }),
        ),
        facultyLeaders: v.array(
          v.object({ key: v.string(), name: v.string(), icon: v.string(), count: v.number() }),
        ),
        dominantFaculty: v.union(
          v.null(),
          v.object({ key: v.string(), name: v.string(), icon: v.string() }),
        ),
        empty: v.boolean(),
      }),
      topMinds: v.array(
        v.object({
          userId: v.string(),
          name: v.string(),
          avatar: v.union(v.string(), v.null()),
          tierScore: v.number(),
          rankLevel: v.number(),
          rankName: v.string(),
          rankIcon: v.string(),
          identityTitle: v.string(),
          identityIcon: v.string(),
          frozen: v.boolean(),
          sessions: v.number(),
          updatedAt: v.number(),
        }),
      ),
      recentGrants: v.array(
        v.object({
          id: v.string(),
          targetName: v.string(),
          kind: v.string(),
          faculty: v.string(),
          amount: v.number(),
          reason: v.string(),
          actorName: v.string(),
          at: v.number(),
          applied: v.boolean(),
        }),
      ),
      facultyTotals: v.array(v.object({ key: v.string(), name: v.string(), icon: v.string(), xp: v.number() })),
    }),
  ),
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (me === null || !isOwnerUser(me)) return null;

    const rows = await ctx.db.query("mindProfiles").withIndex("by_rank").order("desc").take(PULSE_SCAN);
    const now = Date.now();
    const dayAgo = now - 86_400_000;

    const pulse = computeMindPulse(
      rows.map((r) => ({
        tierScore: r.tierScore,
        rankLevel: r.rankLevel,
        faculties: r.faculties,
        updatedAt: r.updatedAt,
        frozen: r.frozen,
        synced24h: r.updatedAt >= dayAgo,
      })),
    );

    const facultyTotals = FACULTY_KEYS.map((k) => ({
      key: k as string,
      name: FACULTY_META[k].name,
      icon: FACULTY_META[k].icon,
      xp: rows.reduce((sum, r) => sum + (r.faculties[k] ?? 0), 0),
    }));

    const recent = await ctx.db.query("mindGrants").withIndex("by_created").order("desc").take(20);
    const targetIds = Array.from(new Set(recent.map((g) => g.userId)));
    const targets = await Promise.all(targetIds.map((id) => ctx.db.get(id)));
    const nameOf = new Map(targetIds.map((id, i) => [String(id), targets[i]?.name ?? "لاعب"]));

    return {
      pulse,
      topMinds: rows.slice(0, 12).map((r) => {
        const rank = MIND_RANKS.find((m) => m.level === r.rankLevel) ?? MIND_RANKS[0];
        return {
          userId: String(r.userId),
          name: r.name,
          avatar: r.avatar ?? null,
          tierScore: r.tierScore,
          rankLevel: r.rankLevel,
          rankName: rank.name,
          rankIcon: rank.icon,
          identityTitle: r.identityTitle,
          identityIcon: r.identityIcon,
          frozen: r.frozen,
          sessions: r.sessions,
          updatedAt: r.updatedAt,
        };
      }),
      recentGrants: recent.map((g) => {
        const target = rows.find((r) => String(r.userId) === String(g.userId));
        return {
          id: String(g._id),
          targetName: nameOf.get(String(g.userId)) ?? "لاعب",
          kind: g.kind,
          faculty: g.faculty,
          amount: g.amount,
          reason: g.reason,
          actorName: g.actorName,
          at: g.at,
          applied: target ? target.updatedAt > g.at : false,
        };
      }),
      facultyTotals,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5️⃣ أدوات العرش — منح وتجميد وتصفير (تغيير حقيقي، لا محاكاة)
// ═══════════════════════════════════════════════════════════════════════

async function requireOwnerCtx(ctx: MutationCtx) {
  const me = await getCurrentUser(ctx);
  if (me === null || !isOwnerUser(me)) throw new Error("غير مصرح — هذه الصلاحية للحاكم السيادي فقط");
  return me;
}

const ownerGrantReturn = v.object({
  ok: v.boolean(),
  message: v.string(),
  grantId: v.union(v.string(), v.null()),
});

export const ownerGrantMind = mutation({
  args: {
    userId: v.id("users"),
    faculty: v.string(),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  returns: ownerGrantReturn,
  handler: async (ctx, { userId, faculty, amount, reason }) => {
    const me = await requireOwnerCtx(ctx);
    const target = await ctx.db.get(userId);
    if (target === null) return { ok: false, message: "اللاعب غير موجود", grantId: null };

    const clamped = Math.max(-MAX_GRANT_AMOUNT, Math.min(MAX_GRANT_AMOUNT, Math.round(amount)));
    const valid =
      faculty === "all" || (FACULTY_KEYS as string[]).includes(faculty) ? faculty : "logic";
    const label = valid === "all" ? "كل القوى" : valid;

    const grantId = await ctx.db.insert("mindGrants", {
      userId,
      kind: "xp",
      faculty: valid,
      amount: clamped,
      reason: reason?.trim().slice(0, 120) || "منحة من العرش",
      actorName: me.name ?? "الحاكم السيادي",
      at: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "mind_grant",
      targetId: userId,
      detail: `منح ${clamped > 0 ? "+" : ""}${clamped} خبرة إلى «${label}» لعقل ${target.name ?? "لاعب"} — تُطبَّق عند أول مزامنة`,
      at: Date.now(),
    });

    return {
      ok: true,
      message: `أُدرجت المنحة — ستُطبَّق على عقل اللاعب عند أول دخول (${clamped > 0 ? "+" : ""}${clamped} إلى ${label})`,
      grantId: String(grantId),
    };
  },
});

export const ownerFreezeMind = mutation({
  args: {
    userId: v.id("users"),
    frozen: v.boolean(),
    note: v.optional(v.string()),
  },
  returns: ownerGrantReturn,
  handler: async (ctx, { userId, frozen, note }) => {
    const me = await requireOwnerCtx(ctx);
    const row = await ctx.db
      .query("mindProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row === null) return { ok: false, message: "لا يوجد عقل مسجَّل لهذا اللاعب بعد", grantId: null };

    await ctx.db.patch(row._id, {
      frozen,
      note: note?.trim().slice(0, 160) || row.note,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: frozen ? "mind_freeze" : "mind_unfreeze",
      targetId: userId,
      detail: frozen
        ? `تجميد تطوّر عقل ${row.name} — لا يُقبل أي تقدّم جديد حتى يُرفع التجميد`
        : `رُفع التجميد عن عقل ${row.name} — عاد التقدّم طبيعياً`,
      at: Date.now(),
    });

    return {
      ok: true,
      message: frozen ? `جُمّد عقل ${row.name} — عقوبة سارية فعلاً` : `رُفع التجميد عن ${row.name}`,
      grantId: null,
    };
  },
});

export const ownerResetMind = mutation({
  args: { userId: v.id("users"), reason: v.optional(v.string()) },
  returns: ownerGrantReturn,
  handler: async (ctx, { userId, reason }) => {
    const me = await requireOwnerCtx(ctx);
    const target = await ctx.db.get(userId);
    if (target === null) return { ok: false, message: "اللاعب غير موجود", grantId: null };

    const grantId = await ctx.db.insert("mindGrants", {
      userId,
      kind: "reset",
      faculty: "all",
      amount: 0,
      reason: reason?.trim().slice(0, 120) || "قرار العرش بتصفير العقل",
      actorName: me.name ?? "الحاكم السيادي",
      at: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      actorId: me._id,
      actorName: me.name ?? "المالك",
      actorRole: "owner",
      action: "mind_reset",
      targetId: userId,
      detail: `قرار بتصفير عقل ${target.name ?? "لاعب"} — يُنفَّذ على جهازه عند أول دخول`,
      at: Date.now(),
    });

    return {
      ok: true,
      message: `صدر قرار التصفير — يُنفَّذ على عقل اللاعب عند أول مزامنة`,
      grantId: String(grantId),
    };
  },
});

/** يُستخدم للتحقق الداخلي أن الأدوات تعمل بالقيم الصحيحة (اختبارات الإدارة). */
export const mindNexusInfo = query({
  args: {},
  returns: v.object({
    ranks: v.array(v.object({ level: v.number(), name: v.string(), icon: v.string(), min: v.number() })),
    faculties: v.array(v.string()),
    maxTierScore: v.number(),
  }),
  handler: async () => ({
    ranks: MIND_RANKS.map((r) => ({ level: r.level, name: r.name, icon: r.icon, min: r.min })),
    faculties: FACULTY_KEYS as string[],
    maxTierScore: MAX_TIER_SCORE,
  }),
});
