/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 المهام اليومية — لوحة المهام الدوارة (الإصدار 3.0، المرحلة 4)
 *
 *  - 3 مهام يومية تُختار ثابتاً لكل لاعب في اليوم (بذرة من userId+اليوم)
 *  - تُحتسب تلقائياً من أفعال اللعب الحقيقية (جولة، فوز، دقة، سلسلة)
 *  - كل مهمة مكتملة تُطالب بنقاط ولاء تُودَع في محفظة اللاعب
 *  - جدول dailyQuests يضمن المطالبة مرة واحدة لكل مهمة/يوم
 *  - مكافأة عودة: أول دخول بعد غياب 3+ أيام يمنح مكافأة ترحيبية
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

type QuestKind = "rounds" | "wins" | "perfect" | "score" | "streak";

type QuestDef = {
  kind: QuestKind;
  target: number;
  title: string;
  emoji: string;
  reward: number; // نقاط ولاء
};

/** كل المهام الممكنة */
const QUEST_POOL: QuestDef[] = [
  { kind: "rounds", target: 3, title: "العب 3 جولات", emoji: "🎮", reward: 30 },
  { kind: "rounds", target: 5, title: "العب 5 جولات", emoji: "🕹️", reward: 45 },
  { kind: "wins", target: 2, title: "اربح جولتين", emoji: "🥇", reward: 40 },
  { kind: "perfect", target: 1, title: "أنهِ جولة بدقة كاملة", emoji: "🎯", reward: 50 },
  { kind: "score", target: 500, title: "اجمع 500 نقطة اليوم", emoji: "💯", reward: 35 },
  { kind: "wins", target: 1, title: "اربح جولة واحدة على الأقل", emoji: "⚔️", reward: 25 },
];

function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** بذرة ثابتة لاختيار 3 مهام لكل لاعب في اليوم */
function pickQuests(userId: string, day: string): QuestDef[] {
  let seed = 0;
  const s = userId + day;
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  const picked: QuestDef[] = [];
  const used = new Set<number>();
  let n = seed;
  while (picked.length < 3) {
    n = (n * 1103515245 + 12345) >>> 0;
    const idx = n % QUEST_POOL.length;
    if (used.has(idx)) continue;
    used.add(idx);
    picked.push(QUEST_POOL[idx]);
  }
  return picked;
}

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات
// ─────────────────────────────────────────────────────────────────────────

/** مهامي اليوم + تقدمي الحي + مكافأة العودة */
export const getMyQuests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const now = Date.now();
    const today = dayKey(now);

    // تقدّم اليوم الحقيقي من سجل الجولات
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", dayStart.getTime()))
      .collect();
    const mine = history.filter((g: any) => g.userId === userId);

    const progress = {
      rounds: mine.length,
      wins: mine.filter((g: any) => g.won).length,
      perfect: mine.filter((g: any) => (g.correctCount ?? 0) > 0 && g.correctCount === g.questionCount).length,
      score: mine.reduce((s: number, g: any) => s + (g.score ?? 0), 0),
    };

    const claimed = await ctx.db
      .query("dailyQuests")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", today))
      .collect();
    const claimedKinds = new Set(claimed.map((c) => c.kind));

    // مكافأة العودة: آخر جولة قبل 3+ أيام
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const daysAway = profile?.lastPlayedDay
      ? Math.floor((now - new Date(profile.lastPlayedDay).getTime()) / (24 * 3600_000))
      : 0;
    const comebackAvailable = daysAway >= 3;

    return {
      quests: pickQuests(String(userId), today).map((q) => ({
        ...q,
        progress: (progress as any)[q.kind] ?? 0,
        done: (progress as any)[q.kind] >= q.target,
        claimed: claimedKinds.has(q.kind),
      })),
      comebackAvailable,
      daysAway,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الإجراءات
// ─────────────────────────────────────────────────────────────────────────

/** المطالبة بمكافأة مهمة مكتملة — مرة واحدة لكل مهمة/يوم */
export const claimQuest = mutation({
  args: { kind: v.string() },
  handler: async (ctx, { kind }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const now = Date.now();
    const today = dayKey(now);
    const def = QUEST_POOL.find((q) => q.kind === kind);
    if (!def) throw new Error("المهمة غير موجودة");

    const already = await ctx.db
      .query("dailyQuests")
      .withIndex("by_user_day_kind", (q) => q.eq("userId", userId).eq("day", today).eq("kind", kind))
      .first();
    if (already) throw new Error("طالبت بهذه المهمة بالفعل اليوم");

    // تحقق حقيقي من التقدم
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", dayStart.getTime()))
      .collect();
    const mine = history.filter((g: any) => g.userId === userId);
    const progress: Record<string, number> = {
      rounds: mine.length,
      wins: mine.filter((g: any) => g.won).length,
      perfect: mine.filter((g: any) => (g.correctCount ?? 0) > 0 && g.correctCount === g.questionCount).length,
      score: mine.reduce((s: number, g: any) => s + (g.score ?? 0), 0),
    };
    if ((progress[kind] ?? 0) < def.target) {
      throw new Error("لم تكمل المهمة بعد — واصل اللعب!");
    }

    await ctx.db.insert("dailyQuests", { userId, day: today, kind, claimedAt: now });
    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId,
      amount: def.reward,
      reason: `🎯 مكافأة المهمة: ${def.title}`,
    });
    return { ok: true as const, reward: def.reward };
  },
});

/** مكافأة العودة — للاعب غاب 3+ أيام */
export const claimComeback = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const now = Date.now();
    const today = dayKey(now);

    const already = await ctx.db
      .query("dailyQuests")
      .withIndex("by_user_day_kind", (q) => q.eq("userId", userId).eq("day", today).eq("kind", "comeback"))
      .first();
    if (already) throw new Error("طالبت بمكافأة العودة اليوم بالفعل");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const daysAway = profile?.lastPlayedDay
      ? Math.floor((now - new Date(profile.lastPlayedDay).getTime()) / (24 * 3600_000))
      : 0;
    if (daysAway < 3) throw new Error("مكافأة العودة متاحة بعد غياب 3 أيام أو أكثر");

    await ctx.db.insert("dailyQuests", { userId, day: today, kind: "comeback", claimedAt: now });
    const reward = 100;
    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId,
      amount: reward,
      reason: "🎁 مكافأة العودة — اشتقناك!",
    });
    return { ok: true as const, reward };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// التنظيف الآلي
// ─────────────────────────────────────────────────────────────────────────

/** دورة يومية: احذف مطالبات الأيام الأقدم من 7 أيام */
export const cleanupOldQuests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 3600_000;
    const old = await ctx.db
      .query("dailyQuests")
      .withIndex("by_claimed", (q) => q.lt("claimedAt", cutoff))
      .collect();
    for (const row of old) {
      await ctx.db.delete(row._id);
    }
    return { deleted: old.length };
  },
});
