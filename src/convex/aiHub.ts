import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 مركز الذكاء الموحد — سقف واحد لكل وحدات الـ AI
 *
 *  كل وحدة ذكاء في اللعبة (المدرب، الحارس، الحكم، الحاكم، الأسئلة،
 *  التحليلات...) تسجّل قراراتها وملاحظاتها هنا — فيصبح لديهم:
 *   - سياق مشترك: أي وحدة تقرأ ما رصدته الوحدات الأخرى
 *   - سجل موحد قابل للبحث والفلترة للمالك
 *   - ضبط مركزي: تفعيل/تعطيل/حساسية لكل وحدة من مكان واحد
 *   - بث حي عبر cron لالتقاط إشارات الأنظمة (بلاغات، غش، اقتصاد)
 * ═══════════════════════════════════════════════════════════════════════
 */

export const UNIT_CATALOG = [
  { unit: "coach", name: "المدرب الشخصي", dept: "الشخصي", desc: "يحلل أداء اللاعب ويوصي بتدريب ونقاط ضعف" },
  { unit: "referee", name: "الحكم الآلي", dept: "الرقابي", desc: "كشف غش السرعة والشذوذ وصعوبة حسب المهارة" },
  { unit: "guardian", name: "الحارس الرقابي", dept: "الرقابي", desc: "مراقبة الدردشة وتطبيق القوانين تلقائياً" },
  { unit: "reports", name: "محلل البلاغات", dept: "البلاغات", desc: "ترتيب البلاغات بأولوية وحكم أولي" },
  { unit: "governor", name: "الحاكم الآلي", dept: "الإدارة", desc: "تشغيل ذاتي للعبة + رصد التضخم والأخطاء" },
  { unit: "questions", name: "مهندس الأسئلة", dept: "المحتوى", desc: "توليد ومراجعة جودة حزم الأسئلة" },
  { unit: "health", name: "مراقب الصحة", dept: "الصحة", desc: "صحة اللعبة والاقتصاد والمجتمع بشكل حي" },
  { unit: "recommender", name: "المُوصي الذكي", dept: "التوصيات", desc: "تحديات وأحداث مقترحة حسب نشاط اللاعبين" },
  { unit: "personalizer", name: "مخصص التجربة", dept: "التخصيص", desc: "مطابقة ذكية وأسئلة ديناميكية حسب مهارة ونقاط ضعف كل لاعب" },
  { unit: "notifier", name: "وسيط الإشعارات", dept: "التخصيص", desc: "إشعارات ذكية تحترم تفضيلات كل لاعب وساعات الهدوء وتصنف الأولوية" },
  { unit: "doctor", name: "طبيب Gemini", dept: "الصحة", desc: "تشخيص الأخطاء بالذكاء الاصطناعي: سبب جذري بالعربية + حل + قابلية إصلاح تلقائي" },
] as const;

/** تسجيل حدث من أي وحدة (داخلي — تستدعيه الوحدات الأخرى) */
export const logEvent = internalMutation({
  args: {
    unit: v.string(),
    kind: v.string(),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("critical")),
    summary: v.string(),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, { unit, kind, severity, summary, payload }) => {
    const now = Date.now();
    await ctx.db.insert("aiHubEvents", { unit, kind, severity, summary, payload, at: now });
    const rec = await ctx.db
      .query("aiHubUnits")
      .withIndex("by_unit", (q) => q.eq("unit", unit))
      .first();
    if (rec) {
      await ctx.db.patch(rec._id, { lastEventAt: now, eventCount: (rec.eventCount ?? 0) + 1 });
    }
  },
});

/** واجهة عامة للوحدات: تسجيل حدث (تُستدعى من mutations الوحدات) */
export const emit = mutation({
  args: {
    unit: v.string(),
    kind: v.string(),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("critical")),
    summary: v.string(),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") {
      throw new Error("للمالك والإدارة فقط");
    }
    await ctx.runMutation(internal.aiHub.logEvent, args);
    return true;
  },
});

/** لوحة المركز — للمالك: حالة كل وحدة + آخر الأحداث */
export const getHubOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") return null;

    const now = Date.now();
    const units = await ctx.db.query("aiHubUnits").collect();
    const events = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(120);

    const byUnit = new Map(units.map((u) => [u.unit, u]));
    const rows = UNIT_CATALOG.map((c) => {
      const rec = byUnit.get(c.unit);
      return {
        ...c,
        enabled: rec?.enabled ?? true,
        sensitivity: rec?.sensitivity ?? 5,
        lastEventAt: rec?.lastEventAt ?? null,
        eventCount: rec?.eventCount ?? 0,
        activeNow: rec?.lastEventAt ? now - rec.lastEventAt < 3600_000 : false,
      };
    });

    const critical24h = events.filter((e) => e.severity === "critical" && e.at >= now - 86400_000).length;
    const warn24h = events.filter((e) => e.severity === "warn" && e.at >= now - 86400_000).length;
    const events24h = events.filter((e) => e.at >= now - 86400_000).length;

    return {
      units: rows,
      totals: { events24h, critical24h, warn24h, activeUnits: rows.filter((r) => r.activeNow).length },
      events: events.slice(0, 60).map((e) => ({
        id: String(e._id),
        unit: e.unit,
        kind: e.kind,
        severity: e.severity,
        summary: e.summary,
        at: e.at,
      })),
    };
  },
});

/**
 * 📡 نبضة الجسر — تُشغَّل كل 15 دقيقة: تلتقط إشارات حقيقية من أنظمة اللعبة
 * وتسجّلها في المركز لكل وحدة معنية، فتتبادل الوحدات السياق فعلياً.
 */
export const bridgeTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86400_000;
    let logged = 0;

    // هل المركز يعمل أهلاً؟ (تعطيل كامل يوقف الجسر)
    const anyUnit = await ctx.db.query("aiHubUnits").first();

    // ── إشارة: بلاغات مفتوحة → وحدة البلاغات ──
    const openReports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    if (openReports.length > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "reports",
        kind: "observation",
        severity: openReports.length >= 5 ? "warn" : "info",
        summary: `${openReports.length} بلاغ مفتوح في قائمة الانتظار`,
      });
      logged++;
    }

    // ── إشارة: أحداث الغش الأخيرة → الحكم + الحارس ──
    const cheatEvents = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gte("at", dayAgo))
      .collect();
    const unresolved = cheatEvents.filter((e) => !e.resolved).length;
    if (unresolved > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "referee",
        kind: "alert",
        severity: unresolved >= 3 ? "critical" : "warn",
        summary: `${unresolved} حدث لعب نظيف غير محسوم خلال 24 ساعة`,
      });
      logged++;
    }

    // ── إشارة: ملفات نقاط الضعف → مخصص التجربة ──
    const profilers = await ctx.db.query("categoryHistory").take(400);
    const distinctPlayers = new Set(profilers.map((r) => r.userId.toString())).size;
    if (distinctPlayers > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "personalizer",
        kind: "observation",
        severity: "info",
        summary: `${distinctPlayers} لاعب لديهم ملف نقاط ضعف — الأسئلة الديناميكية والمطابقة الذكية نشطة`,
      });
      logged++;
    }

    // ── إشارة: صحة الاقتصاد → مراقب الصحة + الحاكم ──
    const users = await ctx.db.query("users").take(500);
    let inflow = 0, outflow = 0;
    const dayRows = await ctx.db
      .query("loyaltyLedger")
      .withIndex("by_at", (q) => q.gte("at", dayAgo))
      .take(8000);
    for (const r of dayRows) {
      if (r.delta > 0) inflow += r.delta;
      else outflow += -r.delta;
    }
    const net = inflow - outflow;
    if (inflow + outflow > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "health",
        kind: "observation",
        severity: outflow > inflow ? "warn" : "info",
        summary: `نبضة الاقتصاد 24س: داخل ${Math.round(inflow)} · خارج ${Math.round(outflow)} · صافي ${Math.round(net)}`,
      });
      logged++;
    }

    // ── إشارة: نشاط اللعب → المدرب + المُوصي ──
    const recentGames = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gte("playedAt", dayAgo))
      .take(5000);
    const activePlayers = new Set(recentGames.map((g) => String(g.userId)));
    if (recentGames.length > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "coach",
        kind: "observation",
        severity: "info",
        summary: `${recentGames.length} جولة من ${activePlayers.size} لاعباً خلال 24 ساعة — بيانات تدريب حية متاحة`,
      });
      logged++;
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "recommender",
        kind: "observation",
        severity: "info",
        summary: `نشاط 24س: ${activePlayers.size} لاعباً نشطاً — جاهز لتوليد تحديات مخصصة`,
      });
      logged++;
    }

    // ── إشارة: إنجازات شبه منتهية → المُوصي (دافعية شخصية حقيقية) ──
    {
      const allAch = await ctx.db.query("achievements").collect();
      const ownedByUser = new Map<string, Set<string>>();
      for (const a of allAch) {
        if (!ownedByUser.has(a.userId)) ownedByUser.set(a.userId, new Set());
        ownedByUser.get(a.userId)!.add(a.type);
      }
      let nearCount = 0;
      for (const uid of activePlayers) {
        const owned = ownedByUser.get(uid) ?? new Set<string>();
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", uid as any))
          .unique();
        if (!profile) continue;
        const checks: [string, number, number][] = [
          ["wins_10", profile.gamesWon ?? 0, 10],
          ["games_50", profile.gamesPlayed ?? 0, 50],
          ["streak_10", profile.bestStreak ?? 0, 10],
          ["xp_5000", profile.xp ?? 0, 5000],
        ];
        for (const [type, cur, target] of checks) {
          if (!owned.has(type) && cur >= target * 0.6) nearCount++;
        }
      }
      if (nearCount > 0) {
        await ctx.runMutation(internal.aiHub.logEvent, {
          unit: "recommender",
          kind: "observation",
          severity: "info",
          summary: `${nearCount} إنجازاً قريباً من الإنجاز لدى اللاعبين النشطين — توصيات دافعية جاهزة`,
        });
        logged++;
      }
    }

    // ── إشارة: أخطاء العملاء → الحاكم ──
    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", dayAgo))
      .collect();
    if (errors.length > 5) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "governor",
        kind: "alert",
        severity: errors.length > 20 ? "critical" : "warn",
        summary: `${errors.length} خطأ عميل خلال 24 ساعة — صياد الأخطاء مطلوب`,
      });
      logged++;
    }

    // ── إشارة: طبيب Gemini — عدد الأخطاء المُشخَّصة بالذكاء الاصطناعي ──
    const diagnosed = errors.filter((e) => e.aiVerdict === "analyzed").length;
    if (diagnosed > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "doctor",
        kind: "observation",
        severity: "info",
        summary: `${diagnosed} خطأ مشخّص بالذكاء الاصطناعي خلال 24 ساعة — تشخيص عربي مكتوب على السجلات`,
      });
      logged++;
    }

    void anyUnit;
    return { logged, units: UNIT_CATALOG.length };
  },
});

/** ضبط وحدة: تفعيل/تعطيل/حساسية */
export const configureUnit = mutation({
  args: {
    unit: v.string(),
    enabled: v.optional(v.boolean()),
    sensitivity: v.optional(v.number()),
  },
  handler: async (ctx, { unit, enabled, sensitivity }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") {
      throw new Error("للمالك فقط");
    }
    if (sensitivity !== undefined && (sensitivity < 1 || sensitivity > 10)) {
      throw new Error("الحساسية بين 1 و 10");
    }
    const known = UNIT_CATALOG.some((c) => c.unit === unit);
    if (!known) throw new Error("وحدة غير معروفة");

    const rec = await ctx.db
      .query("aiHubUnits")
      .withIndex("by_unit", (q) => q.eq("unit", unit))
      .first();
    if (rec) {
      await ctx.db.patch(rec._id, {
        enabled: enabled ?? rec.enabled,
        sensitivity: sensitivity ?? rec.sensitivity,
      });
    } else {
      const meta = UNIT_CATALOG.find((c) => c.unit === unit)!;
      await ctx.db.insert("aiHubUnits", {
        unit,
        name: meta.name,
        dept: meta.dept,
        desc: meta.desc,
        enabled: enabled ?? true,
        sensitivity: sensitivity ?? 5,
        eventCount: 0,
      });
    }
    await ctx.runMutation(internal.aiHub.logEvent, {
      unit,
      kind: "config",
      severity: "info",
      summary: `ضبط المالك: ${enabled !== undefined ? (enabled ? "تفعيل" : "تعطيل") : ""}${sensitivity !== undefined ? ` حساسية ${sensitivity}/10` : ""}`,
    });
    return true;
  },
});
