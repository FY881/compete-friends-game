/**
 * ═══════════════════════════════════════════════════════════════════════
 * 📦 حزم الأسئلة الموسمية — أحداث محدودة الوقت
 *
 *  - يديرها الذكاء الاصطناعي آلياً: دورة كل 6 ساعات تُنهي المنتهية وتُطلق
 *    حزمة جديدة من تناوب موسمي، وتولّد أسئلتها بالـ AI وتعتمدها تلقائياً
 *  - الأسئلة المعتمدة لحزمة تحمل تصنيفها الخاص (pack:slug) فتدخل الجولات
 *    عبر محرك الفئات العادي — واللاعب يراها مميزة بشارة الحدث
 *  - المالك يمكنه أيضاً إنشاء/إنهاء حزمة يدوياً
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

/** تناوب الحزم الموسمية — تُطلق بالترتيب تلقائياً */
const PACK_ROTATION: { name: string; theme: string; description: string }[] = [
  { name: "أسبوع الرياضة", theme: "رياضة عالمية وعربية: كرة القدم، الأولمبياد، أرقام قياسية", description: "كل ما يخص الملاعب والأرقام والنجوم" },
  { name: "باقة رمضان", theme: "رمضان: عبادات، سيرة، أمثال رمضانية، تقاليد الشرق", description: "أجواء الشهر الفضيل بأسئلة مميزة" },
  { name: "مهرجان الأفلام", theme: "السينما العالمية والعربية: أفلام كلاسيكية، مخرجون، اقتباسات شهيرة", description: "عشاق الشاشة الكبيرة، هذه باقتكم" },
  { name: "عوالم العلوم", theme: "علوم: فضاء، فيزياء، اكتشافات، مخبريات ممتعة", description: "أسئلة تشعل الفضول العلمي" },
  { name: "لغة الضاد", theme: "لغة عربية: نحو، بلاغة، أمثال، عجائب المعجم", description: "تحدي للعقول اللامعة في العربية" },
  { name: "التاريخ العظيم", theme: "تاريخ: حضارات قديمة، معارك مشهورة، شخصيات غيّرت العالم", description: "رحلة عبر الزمن بسؤال واحد" },
];

const PACK_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // أسبوع لكل حزمة
const PACK_QUESTIONS_PER_BATCH = 8;

// ─────────────────────────────────────────────────────────────────────────
// الدورة الآلية — يُستدعى من crons كل 6 ساعات
// ─────────────────────────────────────────────────────────────────────────

/** أنهِ الحزم المنتهية وأطلق التالية من التناوب. */
export const managePacks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1) أنهِ المنتهية
    const active = await ctx.db
      .query("questionPacks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const p of active) {
      if (p.endsAt <= now) {
        await ctx.db.patch(p._id, { status: "ended" });
        await ctx.db.insert("aiDecisionLog", {
          system: "questions",
          actorName: "مدير الحزم الآلي",
          action: "pack_ended",
          detail: `انتهت حزمة «${p.name}»`,
          severity: "low",
          createdAt: now,
        });
      }
    }

    // 2) أطلق التالية إن لم توجد حزمة نشطة
    const stillActive = await ctx.db
      .query("questionPacks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    if (stillActive.some((p) => p.endsAt > now)) return { action: "none" as const };

    const totalPacks = await ctx.db.query("questionPacks").collect();
    const def = PACK_ROTATION[totalPacks.length % PACK_ROTATION.length];
    const slug = `pack-${totalPacks.length + 1}-${def.theme.slice(0, 8).replace(/\s+/g, "")}`;

    await ctx.db.insert("questionPacks", {
      slug,
      name: def.name,
      description: def.description,
      theme: def.theme,
      status: "active",
      startsAt: now,
      endsAt: now + PACK_DURATION_MS,
      createdAt: now,
    });

    // 🔔 إشعار عام بانطلاق الحزمة
    await ctx.runMutation(internal.notify.push, {
      userId: "__all__",
      title: "📦 حزمة أسئلة جديدة!",
      body: `حزمة «${def.name}» متاحة لمدة أسبوع — ${def.description}`,
      type: "update",
      actionUrl: "/play",
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: "مدير الحزم الآلي",
      action: "pack_started",
      detail: `أطلق حزمة «${def.name}» (${slug}) — ستولّد أسئلتها بالـ AI`,
      severity: "low",
      createdAt: now,
    });

    // جدّول توليد الأسئلة بالـ AI فوراً
    await ctx.scheduler.runAfter(0, internal.questionPacks.generatePackQuestions, {
      slug,
      theme: def.theme,
    });

    return { action: "created" as const, slug };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// توليد أسئلة الحزمة بالـ AI واعتمادها تلقائياً
// ─────────────────────────────────────────────────────────────────────────

export const generatePackQuestions = internalAction({
  args: { slug: v.string(), theme: v.string() },
  handler: async (ctx, { slug, theme }) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) return { created: 0, reason: "no-api-key" as const };
    await ensureAiRuntime(ctx);

    const systemPrompt = `أنت مولّد أسئلة ثقافية للعبة "حرب العقول". أنشئ ${PACK_QUESTIONS_PER_BATCH} أسئلة في موضوع: "${theme}" باللغة العربية الفصحى.
لكل سؤال: نص واضح + 4 خيارات (خيار واحد صحيح) + مؤشر الإجابة الصحيحة (0-3) + مستوى صعوبة من (easy|medium|hard).
أعطِ إجابة بصيغة JSON مصفوفة حصرية دون أي نص آخر:
[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"difficulty":"medium"}]`;

    const content = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `أنشئ ${PACK_QUESTIONS_PER_BATCH} أسئلة عن: ${theme}` },
      ],
      1200,
      0.85,
      "MindClash Pack Generator",
    );

    // استخرج المصفوفة
    let raw: Record<string, unknown>[] = [];
    try {
      const m = content.match(/\[[\s\S]*\]/);
      if (m) raw = JSON.parse(m[0]) as Record<string, unknown>[];
    } catch {
      return { created: 0, reason: "parse-error" as const };
    }

    const questions = raw
      .filter((q) => {
        const s = String(q.question ?? "");
        const opts = Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [];
        return s.length > 5 && opts.length >= 4;
      })
      .slice(0, PACK_QUESTIONS_PER_BATCH)
      .map((q, i) => {
        const opts = (q.options as unknown[]).map(String).slice(0, 4);
        const correctIndex = typeof q.correctIndex === "number" ? Math.min(q.correctIndex, opts.length - 1) : 0;
        const difficulty = ["easy", "medium", "hard"].includes(String(q.difficulty))
          ? (String(q.difficulty) as "easy" | "medium" | "hard")
          : "medium";
        return {
          qid: `pack_${slug}_${Date.now()}_${i}`,
          category: `pack:${slug}`,
          difficulty,
          question: String(q.question),
          options: opts,
          correctIndex,
        };
      });

    if (questions.length === 0) return { created: 0, reason: "empty" as const };

    // أدخلها معتمدة مباشرة (توليد آلي موثوق بإعادة صياغة صارمة)
    await ctx.runMutation(internal.questionPacks.insertApprovedBatch, { questions });

    return { created: questions.length };
  },
});

export const insertApprovedBatch = internalMutation({
  args: {
    questions: v.array(
      v.object({
        qid: v.string(),
        category: v.string(),
        difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
        question: v.string(),
        options: v.array(v.string()),
        correctIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, { questions }) => {
    for (const q of questions) {
      const exists = await ctx.db
        .query("aiQuestions")
        .withIndex("by_qid", (x) => x.eq("qid", q.qid))
        .first();
      if (exists) continue;
      await ctx.db.insert("aiQuestions", {
        qid: q.qid,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        status: "approved",
        createdAt: Date.now(),
      });
    }
    return { inserted: questions.length };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات — الحزمة النشطة + قائمة الحزم للمالك
// ─────────────────────────────────────────────────────────────────────────

/** الحزمة النشطة الآن (أو null) — تظهر كشارة حدث في صفحة اللعب. */
export const getActivePack = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("questionPacks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const p = active.find((x) => x.endsAt > now);
    if (!p) return null;
    const questionCount = await ctx.db
      .query("aiQuestions")
      .withIndex("by_category_status", (q) => q.eq("category", `pack:${p.slug}`).eq("status", "approved"))
      .collect();
    return {
      slug: p.slug,
      name: p.name,
      description: p.description,
      endsAt: p.endsAt,
      questionCount: questionCount.length,
    };
  },
});

/** كل الحزم — للمالك فقط (تبويب المحتوى). */
export const listPacks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    const packs = await ctx.db.query("questionPacks").order("desc").take(20);
    return packs.map((p) => ({
      _id: p._id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      status: p.status,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────
// إدارة يدوية — للمالك
// ─────────────────────────────────────────────────────────────────────────

/** أنشئ حزمة مخصصة فوراً (يُلغي أي حزمة نشطة). */
export const createPackManually = mutation({
  args: { name: v.string(), theme: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { name, theme, days }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح — للطاقم فقط");
    if (name.trim().length < 2) throw new Error("اسم الحزمة قصير جداً");

    const now = Date.now();
    // أنهِ النشطة
    const active = await ctx.db
      .query("questionPacks")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    for (const p of active) await ctx.db.patch(p._id, { status: "ended" });

    const duration = Math.min(Math.max(days ?? 7, 1), 30) * 24 * 60 * 60 * 1000;
    const slug = `pack-manual-${now}`;
    await ctx.db.insert("questionPacks", {
      slug,
      name: name.trim().slice(0, 40),
      description: `حزمة مخصصة: ${theme.slice(0, 60)}`,
      theme,
      status: "active",
      startsAt: now,
      endsAt: now + duration,
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.questionPacks.generatePackQuestions, {
      slug,
      theme,
    });

    await ctx.db.insert("aiDecisionLog", {
      system: "questions",
      actorName: me.name ?? "المالك",
      action: "pack_manual_created",
      detail: `أنشأ حزمة «${name}» يدوياً (${duration / 86400000} يوم)`,
      severity: "low",
      createdAt: now,
    });

    return { slug };
  },
});

/** أنهِ حزمة نشطة فوراً. */
export const endPack = mutation({
  args: { packId: v.id("questionPacks") },
  handler: async (ctx, { packId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح — للطاقم فقط");
    await ctx.db.patch(packId, { status: "ended" });
    return { ok: true };
  },
});
