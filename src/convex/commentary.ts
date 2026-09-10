/**
 * ═══════════════════════════════════════════════════════════════════
 * موجّة 15 — الإصدار 3.0 «المنصة الذكية» — الجزء الأول
 *
 * المعلّق الذكي للبطولات (AI Tournament Commentator):
 * رسائل تعليق حيّة تُولَّد بالذكاء الاصطناعي أثناء البطولات النشطة
 * وعند تتويج الفائزين — تجعل المنصة تبدو حيّة. كل تعليق يُحفظ في
 * جدول `commentary` مع تقييم ذاتي في سجل القرارات الموحّد.
 *
 * الدورة:
 *  cron كل 30 دقيقة → manageCommentary → يُولّد تعليقاً عن أحدث
 *  بطولة نشطة (تقدّم الصدارة، مفاجآت الترتيب) — بلا أي تدخل بشري.
 * ═══════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { isStaffUser } from "./owner";
import type { Id } from "./_generated/dataModel";

// ── الاستعلامات (للاعبين) ─────────────────────────────────────────────

/** آخر تعليقات المعلّق — تظهر في لوحة البطولات بشكل حيّ. */
export const getLatestCommentary = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 5, 1), 20);
    const rows = await ctx.db
      .query("commentary")
      .withIndex("by_created")
      .order("desc")
      .take(take);
    return rows.map((r) => ({
      _id: r._id,
      text: r.text,
      mood: r.mood,
      createdAt: r.createdAt,
    }));
  },
});

// ── المناطق الداخلية (تُدار بالـcron والمسؤول) ────────────────────────

/** لقطة صدارة أحدث بطولة نشطة (داخلية). */
export const latestTournamentSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db.query("tournaments").collect();
    const active = all
      .filter((t) => t.status === "active" && t.endsAt > now)
      .sort((a, b) => b.startsAt - a.startsAt)[0];
    if (!active) return null;

    const players = await ctx.db
      .query("gameHistory")
      .withIndex("by_user")
      .collect();

    // مجموع أفضل الجولات لكل لاعب داخل نافذة البطولة (نفس منطق البطولات)
    const scoreByUser = new Map<string, number>();
    for (const g of players) {
      if (g.playedAt < active.startsAt || g.playedAt > active.endsAt) continue;
      const cur = scoreByUser.get(g.userId) ?? 0;
      scoreByUser.set(g.userId, Math.max(cur, g.score ?? 0));
    }
    const ranked = [...scoreByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const names: string[] = [];
    for (const [uid, score] of ranked) {
      const u = await ctx.db.get(uid as Id<"users">);
      names.push(`${u?.name ?? "لاعب"}: ${score} نقطة`);
    }
    return {
      name: active.name,
      participants: ranked.length,
      ranked: names.join(" | "),
      entriesCount: all.filter(
        (t) => t.status === "active" && t.endsAt > now,
      ).length,
    };
  },
});

/** توليد تعليق جديد (داخلية — يستدعها الـcron ونائب المالك). */
export const generateCommentary = internalMutation({
  args: { trigger: v.string() },
  handler: async (ctx, { trigger }) => {
    const snapshot = await ctx.runQuery(internal.commentary.latestTournamentSnapshot, {});
    if (!snapshot) return { ok: false, reason: "لا بطولة نشطة" };

    const moodPool = ["hype", "dramatic", "analytical", "cheerful"] as const;
    const mood = moodPool[Math.floor(Math.random() * moodPool.length)];

    await ensureAiRuntime(ctx);
    const reply = await callLlm(
      [
        {
          role: "system",
          content:
            'أنت "معلّق حرب العقول" — معلّق رياضي عربي حماسي يعلّق على بطولات لعبة أسئلة تنافسية.\n' +
            "اكتب تعليقاً قصيراً جداً (جملة إلى جملتين) بالعربية فقط، حماسي وحيوي.\n" +
            "استخدم لقطة الصدارة الحقيقية كما هي — ممنوع اختلاق أسماء أو أرقام غير موجودة.\n" +
            'اختم بإيموجي واحد مناسب. أعد النص فقط دون مقدمات.',
        },
        {
          role: "user",
          content:
            `البطولة: ${snapshot.name}\nعدد المشاركين: ${snapshot.participants}\n` +
            `الصدارة الآن: ${snapshot.ranked || "لا توجد نتائج بعد"}\n` +
            `مناسبة التعليق: ${trigger}\nالمزاج المطلوب: ${mood}`,
        },
      ],
      220,
      1.0,
      "AI Commentator",
    );

    const text = reply.trim().slice(0, 500);
    if (!text) return { ok: false, reason: "رد فارغ من المزوّد" };

    await ctx.db.insert("commentary", {
      text,
      mood,
      tournamentName: snapshot.name,
      trigger,
      createdAt: Date.now(),
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "owner",
      actorName: "المعلّق الذكي",
      action: "commentary_generated",
      detail: `تعليق جديد على «${snapshot.name}» (${trigger})`,
      severity: "low",
      createdAt: Date.now(),
    });

    return { ok: true, text };
  },
});

/** مدير التعليق — يُشغَّل بالـcron كل 30 دقيقة عند وجود بطولة نشطة. */
export const manageCommentary = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ skipped?: boolean; ok?: boolean; text?: string; reason?: string }> => {
    // لا تبالغ: 6 تعليقات على الأكثر في الساعة
    const recent = await ctx.db
      .query("commentary")
      .withIndex("by_created")
      .order("desc")
      .take(12);
    const last = recent[0];
    if (last && Date.now() - last.createdAt < 25 * 60 * 1000) {
      return { skipped: true };
    }
    return await ctx.runMutation(internal.commentary.generateCommentary, {
      trigger: "تحديث دوري للبطولة النشطة",
    });
  },
});

/** توليد يدوي فوري — للمسؤولين (المالك والعُرفاء ونائب المالك) فقط. */
export const requestCommentary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");
    return { allowed: true };
  },
});
