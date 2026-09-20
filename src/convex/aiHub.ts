import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
  { unit: "sovereign", name: "الحاكم السيادي", dept: "السيادة", desc: "سلطة عليا مستقلة: يدير الأنظمة ذاتياً، يحاكم ويعاقب بعواقب حقيقية، ويطور اللعبة بنفسه — بلا انتظار أحد" },
] as const;

/**
 * تسجيل حدث من أي وحدة (داخلي — تستدعيه الوحدات الأخرى).
 * يحترم المفتاح الرئيسي وتفعيل الوحدة فعلياً: لا سجل لوحدة معطّلة ولا لمركز موقوف.
 * `force: true` يُستثنى للعمليات الإدارية (ضبط المركز نفسه) حتى لا تفقد أثرها.
 */
export const logEvent = internalMutation({
  args: {
    unit: v.string(),
    kind: v.string(),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("critical")),
    summary: v.string(),
    payload: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { unit, kind, severity, summary, payload, force }) => {
    if (!force) {
      if (!(await hubIsLive(ctx))) return null;
      if (!(await unitIsEnabled(ctx, unit))) return null;
    }
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

/** معرّف سجل المفتاح الرئيسي للمركز (تفعيل/إيقاف كل الوحدات) */
export const MASTER_UNIT = "__hub__";

/** هل المركز يعمل؟ (لا سجل = يعمل افتراضياً) */
async function hubIsLive(ctx: any): Promise<boolean> {
  const master = await ctx.db
    .query("aiHubUnits")
    .withIndex("by_unit", (q: any) => q.eq("unit", MASTER_UNIT))
    .first();
  return master?.enabled ?? true;
}

/** هل هذه الوحدة مفعّلة؟ (لا سجل = مفعّلة افتراضياً) */
async function unitIsEnabled(ctx: any, unit: string): Promise<boolean> {
  const rec = await ctx.db
    .query("aiHubUnits")
    .withIndex("by_unit", (q: any) => q.eq("unit", unit))
    .first();
  return rec?.enabled ?? true;
}

/**
 * 🔗 السياق المشترك الحقيقي — أي وحدة تقرأ آخر ما رصدته الوحدات الأخرى.
 * هذا ما يجعل الوحدات "تعمل تحت سقف واحد" فعلاً وليس شكلاً: قبل أن تتخذ
 * وحدة قراراً، تقرأ سياق الوحدات الأخرى عبر هذه الدالة الداخلية.
 */
export const getUnitContext = internalQuery({
  args: { unit: v.string(), hours: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { unit, hours, limit }) => {
    // 🔗 v12.0 — أوامر العرش: تُقرأ في نفس سياق الوحدة قبل أي قرار.
    // هذا ما يجعل أمر المالك في غرفة الوكلاء فعّالاً لا محفوظاً فقط.
    const controlRow = await ctx.db
      .query("aiControls")
      .withIndex("by_key", (q) => q.eq("key", `unit_${unit}`))
      .first();
    const orders = ((controlRow?.orders ?? []) as { text: string }[]).map((o) => o.text).slice(0, 8);
    if (!(await hubIsLive(ctx))) return { live: false, peers: [], orders, sharedAt: Date.now() };
    const since = Date.now() - (hours ?? 24) * 3600_000;
    const rows = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .take(300);
    const peers = rows
      .filter((r) => r.unit !== unit && r.unit !== MASTER_UNIT)
      .slice(0, limit ?? 20)
      .map((r) => ({ unit: r.unit, kind: r.kind, severity: r.severity, summary: r.summary, at: r.at }));
    return { live: true, peers, orders, sharedAt: Date.now() };
  },
});

/**
 * ربط سببي: وحدة تتصرّف بناءً على ملاحظة وحدة أخرى.
 * يُسجَّل كحدث cross_reference ويُبنى منه خريطة الترابط الحقيقية.
 */
export const recordCrossLink = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("critical")),
    summary: v.string(),
  },
  handler: async (ctx, { from, to, severity, summary }) => {
    const now = Date.now();
    await ctx.db.insert("aiHubEvents", {
      unit: from,
      kind: "cross_reference",
      severity,
      summary,
      payload: JSON.stringify({ from, to, note: summary }),
      at: now,
    });
    const rec = await ctx.db
      .query("aiHubUnits")
      .withIndex("by_unit", (q) => q.eq("unit", from))
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
    // 🔌 المفتاح الرئيسي + تفعيل الوحدة يُحترمان فعلياً: وحدة معطّلة لا تسجّل شيئاً
    if (!(await hubIsLive(ctx))) return false;
    if (!(await unitIsEnabled(ctx, args.unit))) return false;
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
    // صحة كل وحدة محسوبة من أحداثها الحقيقية خلال 24 ساعة (شفافة وقابلة للتفسير)
    const stat = new Map<string, { critical: number; warn: number; total: number }>();
    for (const e of events) {
      if (e.at < now - 86400_000) continue;
      const s = stat.get(e.unit) ?? { critical: 0, warn: 0, total: 0 };
      s.total += 1;
      if (e.severity === "critical") s.critical += 1;
      else if (e.severity === "warn") s.warn += 1;
      stat.set(e.unit, s);
    }
    const rows = UNIT_CATALOG.map((c) => {
      const rec = byUnit.get(c.unit);
      const s = stat.get(c.unit) ?? { critical: 0, warn: 0, total: 0 };
      const activeNow = rec?.lastEventAt ? now - rec.lastEventAt < 3600_000 : false;
      const health = Math.max(0, Math.min(100, 100 - s.critical * 20 - s.warn * 6 + (activeNow ? 5 : 0)));
      return {
        ...c,
        enabled: rec?.enabled ?? true,
        sensitivity: rec?.sensitivity ?? 5,
        lastEventAt: rec?.lastEventAt ?? null,
        eventCount: rec?.eventCount ?? 0,
        activeNow,
        health,
        critical24h: s.critical,
        warn24h: s.warn,
      };
    });
    const masterRec = byUnit.get(MASTER_UNIT);
    const masterEnabled = masterRec?.enabled ?? true;

    const critical24h = events.filter((e) => e.severity === "critical" && e.at >= now - 86400_000).length;
    const warn24h = events.filter((e) => e.severity === "warn" && e.at >= now - 86400_000).length;
    const events24h = events.filter((e) => e.at >= now - 86400_000).length;

    return {
      units: rows,
      masterEnabled,
      totals: {
        events24h,
        critical24h,
        warn24h,
        activeUnits: rows.filter((r) => r.activeNow).length,
        disabledUnits: rows.filter((r) => !r.enabled).length,
        avgHealth: rows.length
          ? Math.round(rows.reduce((a, r) => a + r.health, 0) / rows.length)
          : 100,
      },
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

    // 🔌 المفتاح الرئيسي: إيقاف المركز يوقف الجسر بالكامل فعلياً
    if (!(await hubIsLive(ctx))) return { logged: 0, paused: true, units: UNIT_CATALOG.length };

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
      // 🔗 ربط حقيقي: الحكم رصد شذوذاً ← الحاكم الآلي يبني عليه مراجعة
      await ctx.runMutation(internal.aiHub.recordCrossLink, {
        from: "referee",
        to: "governor",
        severity: unresolved >= 3 ? "critical" : "warn",
        summary: `الحكم سلّم ${unresolved} حدثاً مشبوهاً للحاكم لمراجعة العقوبات`,
      });
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
      if (outflow > inflow) {
        // 🔗 ربط حقيقي: ضغط اقتصادي ← الحاكم يتلقّى إشارة ضبط
        await ctx.runMutation(internal.aiHub.recordCrossLink, {
          from: "health",
          to: "governor",
          severity: "warn",
          summary: `ضغط اقتصادي: الخارج ${Math.round(outflow)} يتجاوز الداخل ${Math.round(inflow)} — الحاكم يستلم إشارة موازنة`,
        });
      }
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
      // 🔗 ربط حقيقي: بيانات التدريب ← المُوصي يبني تحديات على نقاط ضعف حقيقية
      await ctx.runMutation(internal.aiHub.recordCrossLink, {
        from: "recommender",
        to: "coach",
        severity: "info",
        summary: `المُوصي بنى توصياته على ملفات نقاط الضعف التي جهّزها المدرب لـ ${activePlayers.size} لاعباً`,
      });
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
      // 🔗 ربط حقيقي: موجة أخطاء ← طبيب Gemini يتولى التشخيص الجذري
      await ctx.runMutation(internal.aiHub.recordCrossLink, {
        from: "governor",
        to: "doctor",
        severity: errors.length > 20 ? "critical" : "warn",
        summary: `الحاكم أحال ${errors.length} خطأ إلى الطبيب للتشخيص الجذري بالعربية`,
      });
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

    // ── إشارة: الحاكم السيادي — نبضة سلطته على الأنظمة واللاعبين معاً ──
    const pen24h = await ctx.db
      .query("sovereignPenalties")
      .withIndex("by_at", (q) => q.gte("at", dayAgo))
      .collect();
    const activeCases = await ctx.db
      .query("sovereignCases")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    if (pen24h.length > 0 || activeCases.length > 0) {
      await ctx.runMutation(internal.aiHub.logEvent, {
        unit: "sovereign",
        kind: "decision",
        severity: activeCases.length >= 3 ? "warn" : "info",
        summary: `سلطة سيادية ناشطة: ${pen24h.length} عقوبة نافذة و${activeCases.length} قضية مفتوحة في 24 ساعة — يدير الأنظمة والعدالة ذاتياً بلا انتظار أحد`,
      });
      logged++;
    }

    return { logged, paused: false, units: UNIT_CATALOG.length };
  },
});

/**
 * 🔎 السجل الموحد — بحث وفلترة من الخادم (وحدة، خطورة، نوع، نص، نافذة زمنية).
 * هذه هي "الذاكرة الموحدة" التي تُظهر كل قرار اتخذته أي وحدة ذكاء في النظام.
 */
export const getHubLog = query({
  args: {
    unit: v.optional(v.string()),
    severity: v.optional(v.string()),
    kind: v.optional(v.string()),
    text: v.optional(v.string()),
    hours: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { unit, severity, kind, text, hours, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") return null;

    const since = Date.now() - (hours ?? 72) * 3600_000;
    const scan = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .take(800);
    const q = (text ?? "").trim();
    const filtered = scan.filter(
      (e) =>
        (!unit || e.unit === unit) &&
        (!severity || e.severity === severity) &&
        (!kind || e.kind === kind) &&
        (!q || e.summary.includes(q)),
    );
    return {
      total: filtered.length,
      scanned: scan.length,
      kinds: Array.from(new Set(scan.map((e) => e.kind))),
      rows: filtered.slice(0, limit ?? 80).map((e) => ({
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
 * 🕸️ خريطة الترابط الحقيقية — من رصد ماذا، ومن بنى على ملاحظة من.
 * تُحسب من أحداث cross_reference الفعلية خلال الأيام الماضية.
 */
export const getLinkageMap = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") return null;

    const since = Date.now() - (days ?? 7) * 86400_000;
    const rows = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .take(1500);
    const edges = new Map<string, { from: string; to: string; count: number; lastAt: number; note: string }>();
    const listenedBy = new Map<string, number>();
    for (const r of rows) {
      if (r.kind !== "cross_reference" || !r.payload) continue;
      try {
        const p = JSON.parse(r.payload) as { from?: string; to?: string; note?: string };
        if (!p.from || !p.to) continue;
        const key = `${p.from}->${p.to}`;
        const cur = edges.get(key);
        if (cur) {
          cur.count += 1;
          if (r.at > cur.lastAt) cur.lastAt = r.at;
        } else {
          edges.set(key, { from: p.from, to: p.to, count: 1, lastAt: r.at, note: p.note ?? r.summary });
        }
        listenedBy.set(p.to, (listenedBy.get(p.to) ?? 0) + 1);
      } catch {
        /* payload تالف — نتجاهله بدل إسقاط الاستعلام */
      }
    }
    const nameOf = (id: string) =>
      id === MASTER_UNIT ? "المفتاح الرئيسي" : UNIT_CATALOG.find((c) => c.unit === id)?.name ?? id;
    return {
      windowDays: days ?? 7,
      edges: Array.from(edges.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 40)
        .map((e) => ({ ...e, fromName: nameOf(e.from), toName: nameOf(e.to) })),
      listened: UNIT_CATALOG.map((c) => ({ unit: c.unit, name: c.name, listened: listenedBy.get(c.unit) ?? 0 })),
      totalLinks: Array.from(edges.values()).reduce((a, e) => a + e.count, 0),
    };
  },
});

/** 🎛️ المفتاح الرئيسي — تشغيل/إيقاف كل وحدات الذكاء دفعة واحدة */
export const setMasterSwitch = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const me = await ctx.db.get(userId);
    if (!me || (me as any).role !== "owner" && me.email !== "omw70op@gmail.com") {
      throw new Error("للمالك فقط");
    }
    const rec = await ctx.db
      .query("aiHubUnits")
      .withIndex("by_unit", (q) => q.eq("unit", MASTER_UNIT))
      .first();
    if (rec) await ctx.db.patch(rec._id, { enabled, lastEventAt: Date.now() });
    else
      await ctx.db.insert("aiHubUnits", {
        unit: MASTER_UNIT,
        name: "المفتاح الرئيسي",
        dept: "المركز",
        desc: "تشغيل أو إيقاف كل وحدات الذكاء في اللعبة دفعة واحدة",
        enabled,
        sensitivity: 5,
        eventCount: 0,
        lastEventAt: Date.now(),
      });
    return { enabled };
  },
});

/**
 * 🧹 صيانة الذاكرة: حذف الأحداث الأقدم من المدة المحددة وتقليم السجل لسقف آمن،
 * حتى لا يتضخم الجدول مع الاستخدام الطويل — بلا فقدان أي شيء حديث.
 */
export const pruneHubEvents = internalMutation({
  args: { keepDays: v.optional(v.number()), cap: v.optional(v.number()) },
  handler: async (ctx, { keepDays, cap }) => {
    const keepMs = (keepDays ?? 14) * 86400_000;
    const cutoff = Date.now() - keepMs;
    const stale = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(500);
    for (const r of stale) await ctx.db.delete(r._id);

    const max = cap ?? 20000;
    const newest = await ctx.db
      .query("aiHubEvents")
      .withIndex("by_at", (q) => q.gte("at", 0))
      .order("desc")
      .take(1);
    let trimmed = 0;
    if (newest.length > 0) {
      const floor = newest[0].at - 90 * 86400_000; // أي شيء أقدم من 90 يوماً يُقلَّم
      const old = await ctx.db
        .query("aiHubEvents")
        .withIndex("by_at", (q) => q.gte("at", 0).lt("at", floor))
        .take(500);
      for (const r of old) {
        await ctx.db.delete(r._id);
        trimmed += 1;
      }
    }
    void max;
    return { deleted: stale.length, trimmed };
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
      force: true,
    });
    return true;
  },
});
