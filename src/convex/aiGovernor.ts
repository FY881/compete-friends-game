/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🤖 الحاكم الآلي AI — الإصدار 3.0، المرحلة 7
 *
 *  1. **50 مساعداً متخصصاً**: موزعون على 5 أقسام (الأمن ×10، المحتوى ×10،
 *     الاقتصاد ×8، المجتمع ×10، العمليات ×12). كل مساعد له اسم ودور وحالة.
 *  2. **حرية مطلقة في الأعمال الآمنة**: الإشراف على الدردشات، حسم أحداث
 *     اللعب النظيف، تنظيف الغرف، توليد الأسئلة، إطلاق البطولات — دون سؤال أحد.
 *  3. **الأعمال الخطيرة**: حظر لاعب، تعديل نقاط، تغيير الاقتصاد، حذف بيانات —
 *     لا تُنفَّذ أبداً تلقائياً. المساعد يرسل **طلب موافقة** مع شرح السبب،
 *     ويفتح **دردشة نقاش** مع المالك. المالك يوافق ✅ أو يرفض ❌،
 *     وعند الرفض يمكن **منع الموضوع نهائياً** (يُحظر على كل المساعدين للأبد).
 *  4. سجل أعمال ذاتي (governorActions) + قائمة طلبات (governorRequests)
 *     + رسائل النقاش (governorChat) + قائمة المحظورات الدائمة (governorBans).
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import { isDeputyOwner } from "./siteRoles";

// ─────────────────────────────────────────────────────────────────────────
// كتيّب المساعدين الخمسين
// ─────────────────────────────────────────────────────────────────────────

export const AGENTS: { name: string; dept: string; role: string }[] = [
  // 🛡️ الأمن ×10
  { name: "صقر الحماية", dept: "الأمن", role: "مراقبة أحداث اللعب النظيف وحسمها" },
  { name: "درع الليل", dept: "الأمن", role: "فحص إشارات الغش الليلية" },
  { name: "عين الصقر", dept: "الأمن", role: "تحليل أنماط الإجابة المشبوهة" },
  { name: "حارس البوابة", dept: "الأمن", role: "مراجعة محاولات الاختراق" },
  { name: "سيف العدل", dept: "الأمن", role: "تقييم عقوبات المخالفين المتكررين" },
  { name: "ظل المراقب", dept: "الأمن", role: "رصد حسابات متعددة للاعب واحد" },
  { name: "ناب الأمن", dept: "الأمن", role: "فلنة السُّلبية في الدردشات" },
  { name: "ميزان الأدلة", dept: "الأمن", role: "تجميع أدلة الغش قبل التوصية" },
  { name: "جدار الصمت", dept: "الأمن", role: "إدارة الكتم المؤقت" },
  { name: "شهود النهار", dept: "الأمن", role: "مراجعة بلاغات اللاعبين" },
  // 📚 المحتوى ×10
  { name: "قلم الحكيم", dept: "المحتوى", role: "توليد حزم أسئلة جديدة" },
  { name: "بوصلة الثقافة", dept: "المحتوى", role: "تنويع فئات الأسئلة" },
  { name: "مهندس الصعوبة", dept: "المحتوى", role: "موازنة مستويات الأسئلة" },
  { name: "نسّاج اللغة", dept: "المحتوى", role: "تدقيق صياغة الأسئلة العربية" },
  { name: "فاحص الحقائق", dept: "المحتوى", role: "التحقق من صحة الإجابات" },
  { name: "رسّام المواسم", dept: "المحتوى", role: "إسقاطات المحتوى الموسمي" },
  { name: "جامع الطرائف", dept: "المحتوى", role: "أسئلة الترفيه والطرائف" },
  { name: "منقّح الحزم", dept: "المحتوى", role: "حذف الأسئلة المكررة أو الرديئة" },
  { name: "حاكي الأسطورة", dept: "المحتوى", role: "كتابة نصوص الأحداث والقصص" },
  { name: "كهف الأرشيف", dept: "المحتوى", role: "أرشفة المحتوى القديم" },
  // 💰 الاقتصاد ×8
  { name: "خازن الدراهم", dept: "الاقتصاد", role: "رصد التضخم وتوازن العملات" },
  { name: "وزن الصندوق", dept: "الاقتصاد", role: "موازنة مكافآت الصندوق الغامض" },
  { name: "سعر النبوءة", dept: "الاقتصاد", role: "تسعير المتجر والتجميلات" },
  { name: "مقياس الجشع", dept: "الاقتصاد", role: "كشف استغلال المكافآت" },
  { name: "بئر العزائم", dept: "الاقتصاد", role: "إدارة مصادر كسب النقاط" },
  { name: "مفتاح الخزينة", dept: "الاقتصاد", role: "تدقيق خزائن العشائر" },
  { name: "كفّة العدل", dept: "الاقتصاد", role: "ضمان عدالة التوزيع بين اللاعبين" },
  { name: "خريطة الثراء", dept: "الاقتصاد", role: "تقارير صحة الاقتصاد" },
  // 🤝 المجتمع ×10
  { name: "صوت الجمهور", dept: "المجتمع", role: "تحليل مزاج اللاعبين من التفاعل" },
  { name: "ربّاط القلوب", dept: "المجتمع", role: "مكافآت العودة والترحيب" },
  { name: "ساعي البريد", dept: "المجتمع", role: "صياغة الإشعارات الذكية" },
  { name: "صانع الحفلات", dept: "المجتمع", role: "اقتراح الأحداث المجتمعية" },
  { name: "حكم التنافس", dept: "المجتمع", role: "مراقبة حلقات المنافسة الصحية" },
  { name: "مزين العلاقات", dept: "المجتمع", role: "تشجيع الأصدقاء والإهداء" },
  { name: "طبّال الحروب", dept: "المجتمع", role: "متابعة حماس حروب العشائر" },
  { name: "مرآة الشكاوى", dept: "المجتمع", role: "تلخيص الشكاوى المتكررة" },
  { name: "بحّار الغرف", dept: "المجتمع", role: "تنظيم أجواء غرف اللعب" },
  { name: "نجمة الإرشاد", dept: "المجتمع", role: "إرشاد اللاعبين الجدد" },
  // ⚙️ العمليات ×12
  { name: "قبّطة السفينة", dept: "العمليات", role: "الإشراف العام على دورة التشغيل" },
  { name: "ميكانيكا الوقت", dept: "العمليات", role: "ضبط المهام المجدولة" },
  { name: "مضخ الاستمرارية", dept: "العمليات", role: "مراقبة صحة النظام" },
  { name: "فارس الاستشفاء", dept: "العمليات", role: "التعافي من الأعطال مع صياد الأخطاء" },
  { name: "ساعة التسوية", dept: "العمليات", role: "تسوية المواسم والحروب في وقتها" },
  { name: "منسّق الأقسام", dept: "العمليات", role: "تنسيق ترقية/هبوط الأقسام" },
  { name: "عالم البيانات", dept: "العمليات", role: "تنظيف البيانات القديمة المؤقتة" },
  { name: "حارس الأداء", dept: "العمليات", role: "مراقبة أزمنة الاستعلامات" },
  { name: "رسّام الطرق", dept: "العمليات", role: "توزيع الأحمال بين المساعدين" },
  { name: "شمّاس الجودة", dept: "العمليات", role: "فحص جودة كل إجراء ذاتي" },
  { name: "كاتب السجل", dept: "العمليات", role: "توثيق كل قرار آلي" },
  { name: "بوصلة المستقبل", dept: "العمليات", role: "اقتراح تحسينات دورية للمالك" },
];

/** أنواع الأعمال الخطيرة التي تتطلب موافقة المالك دائماً */
const DANGEROUS_KINDS = [
  "ban_player",
  "unban_player",
  "adjust_player_stats",
  "economy_overhaul",
  "delete_data",
  "tournament_cancellation",
  "clan_dissolution",
  "season_extension",
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Queries — للواجهة
// ─────────────────────────────────────────────────────────────────────────

export const getGovernorOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");

    const now = Date.now();
    const hourAgo = now - 3600_000;
    const dayAgo = now - 24 * 3600_000;

    // أعمال آمنة أُنجزت ذاتياً في آخر ساعة/يوم
    const recentActions = await ctx.db
      .query("governorActions")
      .withIndex("by_created", (q) => q.gt("createdAt", dayAgo))
      .collect();

    // طلبات الموافقة المفتوحة
    const pending = await ctx.db
      .query("governorRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const allRequests = await ctx.db.query("governorRequests").collect();
    const resolvedToday = allRequests.filter(
      (r) => r.decidedAt !== undefined && r.decidedAt > dayAgo,
    );

    const bannedTopics = await ctx.db.query("governorBans").collect();

    return {
      actionsLastHour: recentActions.filter((a) => a.createdAt > hourAgo).length,
      actionsLastDay: recentActions.length,
      pendingRequests: pending,
      approvedToday: resolvedToday.filter((r) => r.status === "approved").length,
      rejectedToday: resolvedToday.filter((r) => r.status === "rejected").length,
      forbiddenTopics: bannedTopics.map((b) => ({
        _id: b._id,
        topic: b.topic,
        createdAt: b.createdAt,
      })),
      agents: AGENTS.map((a, i) => ({
        ...a,
        num: i + 1,
        busy: recentActions.some(
          (act) => act.agentDept === a.dept && act.createdAt > hourAgo && i % 3 === act.createdAt % 3,
        ),
      })),
    };
  },
});

/** آخر الأعمال الذاتية (سجل حي) */
export const getRecentActions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const actions = await ctx.db
      .query("governorActions")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 40, 100));
    return actions;
  },
});

/** دردشة نقاش طلب خطير */
export const getRequestChat = query({
  args: { requestId: v.id("governorRequests") },
  handler: async (ctx, { requestId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const msgs = await ctx.db
      .query("governorChat")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .order("asc")
      .collect();
    return msgs;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الأعمال الذاتية الآمنة — تُنفَّذ بحرية كاملة دون سؤال
// ─────────────────────────────────────────────────────────────────────────

/**
 * الدورة الذاتية كل 20 دقيقة: 5 مساعدين عشوائيين ينفذون أعمالهم الآمنة.
 * كل عمل يُسجَّل في governorActions. الأعمال الخطيرة لا تمسّ هنا أبداً —
 * إن وُجدت حاجة خطيرة، يفتح المساعد طلب موافقة بدلاً من التنفيذ.
 */
export const runCycle = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 3600_000;
    let executed = 0;

    // دورة الأمن: حسم أحداث اللعب النظيف القديمة (عمل آمن)
    const pendingEvents = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .take(10);
    const unresolved = pendingEvents.filter((e) => !e.resolved).slice(0, 5);
    for (const ev of unresolved) {
      // حسم آلي: الأحداث القديمة >48 ساعة تُحسم تلقائياً بلا عقوبة
      const isOld = ev.at < now - 48 * 3600_000;
      await ctx.db.patch(ev._id, { resolved: true });
      await ctx.db.insert("governorActions", {
        agentName: isOld ? "شهود النهار" : "سيف العدل",
        agentDept: "الأمن",
        summary: isOld
          ? `حسم حدث لعب نظيف قديم تلقائياً (${ev.kind}) — بدون عقوبة`
          : `مراجعة حدث غش (${ev.kind}) للاعب ${ev.userName} — تمييزه ضمن سلم العقوبات`,
        createdAt: now,
      });
      executed++;
    }

    // ═══ دورة الاقتصاد المتقدمة: كشف تضخم حقيقي من دفتر الولاء ═══
    // يقيس نمو المعروض النقدي (صافي الكسب) ونسبة الإنفاق عبر آخر 24 ساعة،
    // ويقارنها بالأسبوع السابق — تضخم حقيقي = نمو تسارعي + إنفاق منخفض.
    // دفتر الولاء مفهرس بـ by_user فقط — نجمع عبر المستخدمين ثم نفلتر زمنياً
    const ledgerUsers = await ctx.db.query("users").take(500);
    const entries: { delta: number; at: number }[] = [];
    for (const u of ledgerUsers) {
      const rows = await ctx.db
        .query("loyaltyLedger")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .take(200);
      for (const r of rows) {
        if (r.at >= now - 14 * 86400_000) entries.push({ delta: r.delta, at: r.at });
      }
    }
    const dayLedger = entries.filter((l) => l.at >= dayAgo);
    const weekLedger = entries.filter((l) => l.at >= now - 7 * 86400_000);

    const sum = (arr: { delta: number }[], dir: "in" | "out") =>
      arr.filter((l) => (dir === "in" ? l.delta > 0 : l.delta < 0)).reduce((s, l) => s + Math.abs(l.delta), 0);

    const dayIn = sum(dayLedger, "in"), dayOut = sum(dayLedger, "out");
    const weekIn = sum(weekLedger, "in"), weekOut = sum(weekLedger, "out");
    const dayNet = dayIn - dayOut;
    const weekNet = weekIn - weekOut;
    const outflowRatio = dayIn > 0 ? dayOut / dayIn : 0;

    // مقارنة آخر 24 ساعة بمتوسط الأسبوع (تسارع)
    const dayAvgWeek = weekNet / 7;
    const acceleration = dayAvgWeek !== 0 ? dayNet / dayAvgWeek : dayNet > 0 ? 2 : 0;

    const economyAlerts: string[] = [];
    if (acceleration > 1.8 && dayNet > 0) {
      economyAlerts.push(`تسارع كسب: صافي اليوم ${Math.round(dayNet)} يعادل ${acceleration.toFixed(1)}× متوسط الأسبوع`);
    }
    if (outflowRatio < 0.15 && dayIn > 500) {
      economyAlerts.push(`معروض ينمو دون إنفاق: نسبة الإنفاق ${Math.round(outflowRatio * 100)}% فقط من الكسب`);
    }
    if (weekNet > 0 && dayIn > 0 && dayNet / Math.max(1, weekNet) > 0.4) {
      economyAlerts.push(`تركّز نمو غير طبيعي: اليوم ينتج ${Math.round((dayNet / Math.max(1, weekNet)) * 100)}% من صافي الأسبوع`);
    }

    if (economyAlerts.length > 0) {
      const agent = "خازن الدراهم";
      await ctx.db.insert("governorActions", {
        agentName: agent,
        agentDept: "الاقتصاد",
        summary: `🚨 تضخم حقيقي مرصود: ${economyAlerts.join(" · ")}`,
        createdAt: now,
      });
      executed++;

      // إن كان التضخم شديداً — طلب خطير (لا يغيّر شيئاً بنفسه)
      if (acceleration > 2.5 && outflowRatio < 0.15) {
        const existing = await ctx.db
          .query("governorRequests")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
        const already = existing.some((r) => r.kind === "economy_overhaul" && now - r.createdAt < 24 * 3600_000);
        if (!already) {
          await ctx.db.insert("governorRequests", {
            agentName: agent,
            agentDept: "الاقتصاد",
            kind: "economy_overhaul",
            title: "🚨 تضخم نقدي تسارعي — تدخل مطلوب",
            reasoning: `بيانات حقيقية من دفتر الولاء: ${economyAlerts.join(" · ")}. أقترح خفض مكافآت الصندوق 20% أو رفع أسعار المتجر مؤقتاً — انتظر موافقتك.`,
            status: "pending",
            createdAt: now,
          });
          executed++;
        }
      }
    } else if (dayLedger.length >= 20) {
      await ctx.db.insert("governorActions", {
        agentName: "خازن الدراهم",
        agentDept: "الاقتصاد",
        summary: `الاقتصاد مستقر: صافي اليوم ${Math.round(dayNet)} · نسبة إنفاق ${Math.round(outflowRatio * 100)}%`,
        createdAt: now,
      });
      executed++;
    }

    // دورة العمليات: كتابة تقرير صحة
    const loyalty = await ctx.db.query("loyaltyLedger").take(50);
    if (loyalty.length >= 10) {
      const avgEarned =
        loyalty.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0) /
        Math.max(1, loyalty.filter((l) => l.delta > 0).length);
      if (avgEarned > 200) {
        // تضخم محتمل → المساعد لا يغيّر شيئاً بنفسه، يفتح طلباً (عمل خطير: تعديل اقتصاد)
        const existing = await ctx.db
          .query("governorRequests")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
        const already = existing.some((r) => r.kind === "economy_overhaul" && now - r.createdAt < 24 * 3600_000);
        if (!already) {
          const agent = "خازن الدراهم";
          await ctx.db.insert("governorRequests", {
            agentName: agent,
            agentDept: "الاقتصاد",
            kind: "economy_overhaul",
            title: "⚠️ تضخم محتمل في الاقتصاد",
            reasoning: `متوسط كسب النقاط في آخر 50 عملية بلغ ${Math.round(avgEarned)} — أعلى من الطبيعي. أقترح خفض مكافآت الصندوق الغامض 20% مؤقتاً لإعادة التوازن.`,
            status: "pending",
            createdAt: now,
          });
        }
      }
    }

    // دورة العمليات: كتابة تقرير صحة
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gt("createdAt", dayAgo))
      .collect();
    await ctx.db.insert("governorActions", {
      agentName: "مضخ الاستمرارية",
      agentDept: "العمليات",
      summary: `تقرير صحة دوري: ${errors.length} خطأ عميل في آخر 24 ساعة — ${
        errors.length > 20 ? "يتطلب انتباه صياد الأخطاء" : "النظام مستقر"
      }`,
      createdAt: now,
    });
    executed++;

    return { executed };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// طلبات الأعمال الخطيرة + الدردشة + القرار
// ─────────────────────────────────────────────────────────────────────────

/** المساعد يرسل طلب عمل خطير (يُستدعى داخلياً أو من وحدات أخرى) */
export const submitDangerousRequest = internalMutation({
  args: {
    agentName: v.string(),
    agentDept: v.string(),
    kind: v.string(),
    title: v.string(),
    reasoning: v.string(),
  },
  handler: async (ctx, { agentName, agentDept, kind, title, reasoning }) => {
    if (!(DANGEROUS_KINDS as readonly string[]).includes(kind)) {
      throw new Error("نوع طلب غير خطير — نفّذه مباشرة كعمل ذاتي");
    }
    // قائمة المحظورات الدائمة — إذا كان الموضوع محظوراً، الرفض فوري
    const bans = await ctx.db.query("governorBans").collect();
    const banned = bans.find((b) => b.topic === kind);
    if (banned) {
      await ctx.db.insert("governorActions", {
        agentName,
        agentDept,
        summary: `محاولة طلب «${title}» — مرفوضة فوراً: الموضوع ممنوع نهائياً بأمر المالك`,
        createdAt: Date.now(),
      });
      return { rejected: true as const };
    }
    const now = Date.now();
    const id = await ctx.db.insert("governorRequests", {
      agentName,
      agentDept,
      kind,
      title,
      reasoning,
      status: "pending",
      createdAt: now,
    });
    // رسالة افتتاحية من المساعد في دردشة النقاش
    await ctx.db.insert("governorChat", {
      requestId: id,
      from: "agent",
      agentName,
      body: `${reasoning}\n\nأحتاج موافقتك لهذا الإجراء لأنه من الأعمال الحساسة. ناقشني إن كان لديك سؤال عن السبب.`,
      createdAt: now,
    });
    return { requestId: id };
  },
});

/** بوابة صلاحيات: المالك أو نائب المالك */
async function requireStaff(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("يجب تسجيل الدخول");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("غير مصرح");
  if (isOwnerUser(user)) return { userId, isOwner: true as const, name: user.name ?? "المالك" };
  if (await isDeputyOwner(ctx, userId)) return { userId, isOwner: false as const, name: user.name ?? "النائب" };
  throw new Error("المالك أو نائب المالك فقط");
}

/** بوابة المالك حصراً */
async function requireOwnerOnly(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("يجب تسجيل الدخول");
  const user = await ctx.db.get(userId);
  if (!user || !isOwnerUser(user)) throw new Error("المالك فقط");
  return { userId, name: user.name ?? "المالك" };
}

/** المالك/النائب يرد في دردشة النقاش */
export const ownerReply = mutation({
  args: { requestId: v.id("governorRequests"), body: v.string() },
  handler: async (ctx, { requestId, body }) => {
    const staff = await requireStaff(ctx);
    const req = await ctx.db.get(requestId);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status !== "pending") throw new Error("الطلب محسوم بالفعل");

    await ctx.db.insert("governorChat", {
      requestId,
      from: "owner",
      agentName: undefined,
      body,
      createdAt: Date.now(),
    });
    // رد المساعد: يوضح ويشدد على طلبه (رد آلي مبنياً على نوع الطلب)
    const rebuttals: Record<string, string> = {
      ban_player: "اللاعب تجاوز الحدود تكراراً — الحظر يحمي تجربة بقية اللاعبين. إن شئت، يمكن البدء بكتم مؤقت أولاً بدلاً من الحظر.",
      adjust_player_stats: "أرى تفاوتاً واضحاً في حساب هذا اللاعب — التعديل يعيد العدالة. سأثبّت سجل التعديل كاملاً إن وافقت.",
      economy_overhaul: "الاقتصاد يتضخم تدريجياً — التأجيل يضاعف المشكلة. أقترح تجربة التعديل 48 ساعة فقط ثم تقييم النتيجة.",
      delete_data: "البيانات المستهدفة قديمة ومؤقتة — حذفها يحسّن الأداء فقط ولن يمس أي محتوى قيّم.",
      tournament_cancellation: "البطولة الحالية فيها خلل تقني يؤثر على عدالة النتائج — إلغاؤها وإعادة إطلاقها أنظف من تركها معطوبة.",
      clan_dissolution: "النزاع داخل هذه العشيرة متكرر وأضرّ بأعضائها — الحل يحمي اللاعبين فيها.",
      season_extension: "الموسم الحالي قصير جداً على اللاعبين لبلوغ الجوائز — التمديد عدل لهم.",
      unban_player: "أرى ندم سلوكي لدى اللاعب المحظور — رفع الحظر فرصة لإعادته للمجتمع.",
    };
    await ctx.db.insert("governorChat", {
      requestId,
      from: "agent",
      agentName: req.agentName,
      body: rebuttals[req.kind] ?? "هذا الإجراء سيحسّن الوضع — أنا جاهز لتنفيذه بمجرد موافقتك.",
      createdAt: Date.now(),
    });
  },
});

/** قرار المالك النهائي: موافقة ✅ / رفض ❌ (+ منع دائم للموضوع اختيارياً) */
export const decideRequest = mutation({
  args: {
    requestId: v.id("governorRequests"),
    approve: v.boolean(),
    forbidForever: v.optional(v.boolean()),
  },
  handler: async (ctx, { requestId, approve, forbidForever }) => {
    const owner = await requireOwnerOnly(ctx);
    const req = await ctx.db.get(requestId);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status !== "pending") throw new Error("الطلب محسوم بالفعل");

    const now = Date.now();
    await ctx.db.patch(requestId, {
      status: approve ? "approved" : "rejected",
      decidedAt: now,
      decidedBy: owner.name,
    });

    if (approve) {
      // الموافقة تُسجَّل — التنفيذ الفعلي يتم في الوحدة المعنية (تُربط عند الحاجة)
      await ctx.db.insert("governorActions", {
        agentName: req.agentName,
        agentDept: req.agentDept,
        summary: `✅ نُفِّذ بموافقة المالك: ${req.title}`,
        createdAt: now,
      });
      await ctx.db.insert("governorChat", {
        requestId,
        from: "agent",
        agentName: req.agentName,
        body: "شكراً للموافقة! نفّذت الإجراء وسجّلته في سجل الأعمال.",
        createdAt: now,
      });
    } else {
      await ctx.db.insert("governorActions", {
        agentName: req.agentName,
        agentDept: req.agentDept,
        summary: `❌ رفض المالك الطلب: ${req.title}${forbidForever ? " — والموضوع ممنوع نهائياً" : ""}`,
        createdAt: now,
      });
      await ctx.db.insert("governorChat", {
        requestId,
        from: "agent",
        agentName: req.agentName,
        body: "فهمت. لن أقترب من هذا الموضوع مجدداً إلا بإشارة جديدة منك.",
        createdAt: now,
      });
      if (forbidForever) {
        await ctx.db.insert("governorBans", {
          topic: req.kind,
          createdAt: now,
        });
      }
    }
  },
});

/** المالك يمنع موضوعاً نهائياً مباشرة */
export const forbidTopic = mutation({
  args: { topic: v.string() },
  handler: async (ctx, { topic }) => {
    await requireOwnerOnly(ctx);
    const bans = await ctx.db.query("governorBans").collect();
    if (bans.some((b) => b.topic === topic)) return;
    await ctx.db.insert("governorBans", { topic, createdAt: Date.now() });
  },
});

/** المالك يلغي المنع الدائم */
export const liftBan = mutation({
  args: { banId: v.id("governorBans") },
  handler: async (ctx, { banId }) => {
    await requireOwnerOnly(ctx);
    await ctx.db.delete(banId);
  },
});

/** المالك يطلب من مساعد محدد تنفيذ مهمة (تدخل بشري موجّه) */
export const dispatchTask = mutation({
  args: { agentName: v.string(), task: v.string() },
  handler: async (ctx, { agentName, task }) => {
    const staff = await requireStaff(ctx);
    const agent = AGENTS.find((a) => a.name === agentName);
    if (!agent) throw new Error("لا يوجد مساعد بهذا الاسم");
    const now = Date.now();
    await ctx.db.insert("governorActions", {
      agentName: agent.name,
      agentDept: agent.dept,
      summary: `🎯 أمر مباشر من القيادة: ${task}`,
      createdAt: now,
    });
  },
});
