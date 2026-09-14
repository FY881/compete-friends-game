/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 محرك التحديات الشخصية — المرحلة 15 من التحول الشامل
 *
 * 1. كل لاعب يمتلك حتى 3 تحديات شخصية حية تُولَّد آلياً من بياناته الحقيقية:
 *    - إنجاز شبه منتهٍ (≥60%) → «أنت على بعد X من 🏆»
 *    - أضعف فئة في categoryHistory → تحدي تدريب حقيقي
 * 2. التقدم يُحسب لحظياً من نفس مصادر البيانات (لا عدّادات وهمية).
 * 3. عند الإكمال: مكافأة نقاط حرب عبر خزينة الولاء + إشعار ذكي.
 * 4. كل شيء يُسجَّل في مركز الذكاء الموحد (وحدة المُوصي).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ACHIEVEMENT_DEFS, computeMetricsFor } from "./achievementsEngine";

type ChallengeDoc = {
  _id: any;
  userId: any;
  kind: "achievement" | "category";
  ref: string;
  title: string;
  desc: string;
  icon: string;
  target: number;
  progress?: number;
  lastTotal?: number;
  reward: number;
  status: "active" | "completed" | "claimed";
  createdAt: number;
  completedAt?: number;
};

/** الوصول الديناميكي لجدول التحديات (المخطط يعمل بوضع schemaValidation: false) */
function table(ctx: any) {
  return ctx.db.query("personalChallenges");
}

/** أضعف فئة من دفتر الفئات الحقيقي */
async function weakestCategory(ctx: any, userId: any) {
  const rows = await ctx.db
    .query("categoryHistory")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  if (rows.length < 3) return null;
  const scored = rows
    .filter((r: any) => r.total >= 5)
    .map((r: any) => ({ category: r.category as string, acc: r.correct / Math.max(1, r.total), total: r.total as number }))
    .sort((a: any, b: any) => a.acc - b.acc);
  return scored[0] ?? null;
}

/** توليد/تحديث التحديات النشطة للاعب (يدوي أو من الجسر الآلي) */
export const refreshMyChallenges = mutation({
  args: {},
  handler: async (ctx): Promise<{ active: number; created: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const existing = (await table(ctx).withIndex("by_user", (q: any) => q.eq("userId", userId)).collect()) as unknown as ChallengeDoc[];
    const active = existing.filter((c) => c.status === "active");
    let created = 0;

    if (active.length < 3) {
      const covered = new Set(existing.map((c) => `${c.kind}:${c.ref}`));
      const owned = await ctx.db
        .query("achievements")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const ownedSet = new Set(owned.map((o: any) => o.type as string));

      // 1) تحدي إنجاز شبه منتهٍ — يُحسب لحظياً من تعريفات الإنجازات الحقيقية
      const metrics = await computeMetricsFor(ctx, userId);
      const near = ACHIEVEMENT_DEFS.filter((d) => !ownedSet.has(d.type))
        .map((d) => ({ d, pct: Math.min(100, Math.round((d.current(metrics) / d.target) * 100)) }))
        .filter((x) => x.pct >= 60)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 3);
      for (const n of near) {
        if (active.length + created >= 3) break;
        const key = `achievement:${n.d.type}`;
        if (covered.has(key)) continue;
        await (ctx.db as any).insert("personalChallenges", {
          userId,
          kind: "achievement",
          ref: n.d.type,
          title: `اقترب من ${n.d.name}`,
          desc: `${n.d.desc} — أنت عند ${n.pct}% فقط!`,
          icon: n.d.icon,
          target: n.d.target,
          reward: n.d.coins,
          status: "active",
          createdAt: Date.now(),
        });
        covered.add(key);
        created++;
      }

      // 2) تحدي تدريب على أضعف فئة
      if (active.length + created < 3) {
        const weak = await weakestCategory(ctx, userId);
        if (weak && !covered.has(`category:${weak.category}`)) {
          const need = 5;
          await (ctx.db as any).insert("personalChallenges", {
            userId,
            kind: "category",
            ref: weak.category,
            title: `تدرّب على ${weak.category}`,
            desc: `دقتك في «${weak.category}» ${Math.round(weak.acc * 100)}% — أجب عن ${need} أسئلة فيها لرفع مستواك.`,
            icon: "🎯",
            target: need,
            reward: 40,
            status: "active",
            createdAt: Date.now(),
          });
          created++;
        }
      }
    }

    if (created > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "recommender",
        kind: "challenge" as any,
        severity: "info",
        summary: `وُلِّدت ${created} تحديات شخصية جديدة`,
      });
    }
    return { active: active.length + created, created };
  },
});

/** صندوق التحديات للاعب */
export const getMyChallenges = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const challenges = (await table(ctx)
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect()) as unknown as ChallengeDoc[];
    return challenges.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  },
});

/** مطالبة بمكافأة تحدي مكتمل */
export const claimChallenge = mutation({
  args: { id: v.id("users") }, // مُستخدم كمعرّف نصي للتحدي (الجدول غير مسجّل في المخطط)
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const c = (await (ctx.db as any).get(id as any)) as ChallengeDoc | null;
    if (!c || c.userId !== userId) throw new Error("غير موجود");
    if (c.status !== "completed") throw new Error("التحدي لم يكتمل بعد");
    await (ctx.db as any).patch(id, { status: "claimed", completedAt: Date.now() });
    await ctx.runMutation(internal.loyalty.awardPoints, {
      userId,
      amount: c.reward,
      reason: `تحدي شخصي: ${c.title}`,
    });
    await ctx.runMutation(internal.smartNotifications.smartPush, {
      userId,
      title: "🎉 تحدي مكتمل!",
      body: `أكملت «${c.title}» وحصلت على ${c.reward} نقطة حرب!`,
      type: "info",
      category: "streaks",
      priority: "important",
      actionUrl: "/play",
    });
    return { reward: c.reward };
  },
});

/** تحديث التقدم — يُستدعى داخلياً من finishGame بعد كل جولة */
export const tickFromGame = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const challenges = (await table(ctx)
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect()) as unknown as ChallengeDoc[];
    let completed = 0;
    for (const c of challenges) {
      if (c.status !== "active") continue;
      if (c.kind === "category") {
        // تقدّم فئة: عدد الأسئلة المجابة في تلك الفئة منذ آخر قياس
        const rows = await ctx.db
          .query("categoryHistory")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
        const cat = rows.find((r: any) => r.category === c.ref);
        const total = cat ? (cat.total as number) : 0;
        if (c.lastTotal !== undefined) {
          const delta = Math.max(0, total - c.lastTotal);
          const newProgress = Math.min(c.target, (c.progress ?? 0) + delta);
          if (newProgress >= c.target) {
            await (ctx.db as any).patch(c._id, { progress: newProgress, status: "completed" });
            await ctx.runMutation(internal.smartNotifications.smartPush, {
              userId,
              title: "🏆 تحدي مكتمل!",
              body: `تحدي «${c.title}» اكتمل — اطلب مكافأتك!`,
              type: "info",
              category: "streaks",
              priority: "important",
              actionUrl: "/play",
            });
            completed++;
          } else {
            await (ctx.db as any).patch(c._id, { progress: newProgress, lastTotal: total });
          }
        } else {
          await (ctx.db as any).patch(c._id, { progress: 0, lastTotal: total });
        }
      } else {
        // تحدي إنجاز: نتحقق إن كان الإنجاز اكتمل فعلاً → نكمل التحدي تلقائياً
        const got = await ctx.db
          .query("achievements")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();
        const owned = new Set(got.map((o: any) => o.type as string));
        if (owned.has(c.ref)) {
          await (ctx.db as any).patch(c._id, { status: "completed" });
          await ctx.runMutation(internal.smartNotifications.smartPush, {
            userId,
            title: "🏆 تحدي مكتمل!",
            body: `تحدي «${c.title}» اكتمل — اطلب مكافأتك!`,
            type: "info",
            category: "streaks",
            priority: "important",
            actionUrl: "/play",
          });
          completed++;
        }
      }
    }
    return { ticked: challenges.length, completed };
  },
});

/** داخلي: أقرب 3 إنجازات شبه منتهية (للجسر ووحدة المُوصي) */
export const nearCompletionInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ type: string; name: string; desc: string; icon: string; pct: number; target: number; coins: number }[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const owned = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ownedSet = new Set(owned.map((o: any) => o.type as string));
    const metrics = await computeMetricsFor(ctx, userId);
    return ACHIEVEMENT_DEFS.filter((d) => !ownedSet.has(d.type))
      .map((d) => ({ d, pct: Math.min(100, Math.round((d.current(metrics) / d.target) * 100)) }))
      .filter((x) => x.pct >= 60)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
      .map((x) => ({ type: x.d.type, name: x.d.name, desc: x.d.desc, icon: x.d.icon, pct: x.pct, target: x.d.target, coins: x.d.coins }));
  },
});
