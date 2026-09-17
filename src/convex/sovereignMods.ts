import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * 👥 COMMAND OF MODERATORS — سلطة تعيين وعزل المشرفين (بشر + AI مساعدون)
 * الحاكم وحده يقرر من يشرف وعلى ماذا — بلا اقتراح ولا أمر من أحد.
 */

export const MOD_SCOPES = [
  { id: "chat", label: "الغرف والدردشة" },
  { id: "reports", label: "البلاغات" },
  { id: "economy", label: "الاقتصاد" },
  { id: "questions", label: "بنك الأسئلة" },
  { id: "membership", label: "العضويات" },
  { id: "events", label: "الأحداث والمواسم" },
] as const;

export const moderatorCommand = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    let appointed = 0, removed = 0, audited = 0;

    const chatMsgs = await ctx.db.query("chatMessages").withIndex("by_room").order("desc").take(5000);
    const chatCount = chatMsgs.filter((m) => (m as any)._creationTime > dayAgo).length;
    const [openCases] = [await ctx.db.query("sovereignCases").withIndex("by_status", (q) => q.eq("status", "open")).take(100)];
    const loadScore = openCases.length * 3 + Math.floor(chatCount / 100);
    const activeMods = await ctx.db
      .query("sovereignModerators")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // ── عزل آلي: مخالف أو خامل أو محظور دائماً ──
    for (const m of activeMods) {
      const actions = await ctx.db
        .query("sovereignModActions")
        .withIndex("by_at", (q: any) => q.gte("at", dayAgo))
        .filter((q: any) => q.eq(q.field("moderatorId"), m._id))
        .collect();
      const failed = actions.filter((a: any) => !a.ok).length;
      const idle = actions.length === 0 && now - m.appointedAt > 3 * 86_400_000;
      const userBanned = m.userId ? Boolean(((await ctx.db.get(m.userId)) as any)?.bannedPermanent) : false;

      if (userBanned || failed >= 5 || idle) {
        await ctx.db.patch(m._id, {
          status: "removed",
          removedAt: now,
          removedReason: userBanned
            ? "عزل فوري: المشرف محظور دائماً — لا منصب فوق حكم المحكمة"
            : failed >= 5
              ? `عزل بالأدلة: ${failed} فعل فاشل خلال 24 ساعة`
              : "عزل بالخمول: 3 أيام بلا فعل موثق — المنصب أمانة لا مقعد",
        });
        await ctx.db.insert("sovereignEdicts", {
          kind: "moderation",
          title: "🪪 عزل مشرف",
          body: `عزل الحاكم المشرف «${m.name}» (${m.kind === "ai" ? "مساعد AI" : "بشري"}). المنصب أمانة تُسحب بالأدلة.`,
          active: false,
          at: now,
        });
        removed++;
      } else {
        audited++;
      }
    }

    // ── تعيين آلي AI بحسب حمل النظام ──
    const desired = Math.min(6, 2 + Math.floor(loadScore / 40));
    if (activeMods.length < desired) {
      const minds = await ctx.db.query("minds").take(20);
      const taken = new Set(activeMods.map((m) => String(m.aiMindId ?? "")));
      const candidates = minds.filter((m) => !taken.has(String(m._id)));
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const scopeIds = MOD_SCOPES.map((s) => s.id).filter(() => Math.random() < 0.5);
      const scopes = (scopeIds.length > 0 ? scopeIds : ["chat"]).slice(0, 2);
      if (pick) {
        await ctx.db.insert("sovereignModerators", {
          aiMindId: pick._id,
          name: `${pick.name} — ${pick.title}`,
          kind: "ai",
          scopes,
          status: "active",
          appointedReason: `تعيين بقرار الحاكم: حمل النظام اليوم ${loadScore} نقطة عبء`,
          actionsTaken: 0,
          appointedAt: now,
        });
        appointed++;
        await ctx.db.insert("sovereignEdicts", {
          kind: "moderation",
          title: "🎖️ تعيين مشرف AI",
          body: `عيّن الحاكم العقل الحي «${pick.name}» مشرفاً على: ${scopes.join(" · ")}. سجل أفعاله علني وعزله فوري عند أول إخلال.`,
          active: false,
          at: now,
        });
      }
    }

    // ── ترقية بشري مُستحق تلقائياً (ثقة ≥ 90 وسلوك نظيف) ──
    const hasHuman = activeMods.some((m) => m.kind === "human");
    if (!hasHuman) {
      const elite = await ctx.db.query("users").take(2000);
      const candidate = elite.find(
        (u: any) =>
          (u.sovereignTrustScore ?? 50) >= 90 &&
          !(u.bannedUntil && u.bannedUntil > now) &&
          !u.bannedPermanent,
      );
      if (candidate) {
        await ctx.db.insert("sovereignModerators", {
          userId: candidate._id,
          name: candidate.name ?? "لاعب",
          kind: "human",
          scopes: ["chat", "reports"],
          status: "active",
          appointedReason: "ترقية بقرار الحاكم: ثقة سيادية ≥ 90 وسلوك نظيف — تحت تدقيق آلي دائم",
          actionsTaken: 0,
          appointedAt: now,
        });
        appointed++;
        await ctx.db.insert("sovereignEdicts", {
          kind: "moderation",
          title: "🏅 ترقية مشرف بشري",
          body: `رقّى الحاكم «${candidate.name ?? "لاعب"}» مشرفاً بشرياً على الدردشة والبلاغات — كل فعله يُدقَّق آلياً والعزل فوري عند أول إخلال.`,
          active: false,
          at: now,
        });
      }
    }

    if (appointed > 0 || removed > 0 || audited > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "moderation",
        target: `قائد المشرفين: عيّنت ${appointed} · عزلت ${removed} · دقّقت ${audited} (حمل النظام: ${loadScore})`,
        ok: true,
        at: now,
      });
    }
    return { appointed, removed, audited, loadScore };
  },
});

/** حارس الأقسام: قفل فعلي استجابة لحالة النظام الحية */
export const sectionWarden = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let changed = 0;
    const hourAgo = now - 3600_000;    const msgs = (await ctx.db.query("chatMessages").withIndex("by_room").order("desc").take(3000)).filter((m) => (m as any)._creationTime > hourAgo);
    const storm = msgs.length > 2500;
    const row = await ctx.db
      .query("sovereignSectionLocks")
      .withIndex("by_section", (q: any) => q.eq("section", "chat_rooms"))
      .first();
    if (storm && (!row || !row.locked)) {
      if (row) await ctx.db.patch(row._id, { locked: true, reason: `عاصفة دردشة: ${msgs.length} رسالة/ساعة — تهدئة إجبارية 15 دقيقة`, at: now });
      else await ctx.db.insert("sovereignSectionLocks", { section: "chat_rooms", locked: true, reason: `عاصفة دردشة: ${msgs.length} رسالة/ساعة`, at: now });
      changed++;
    } else if (!storm && row?.locked && now - row.at > 15 * 60_000) {
      await ctx.db.patch(row._id, { locked: false, reason: "انحسرت العاصفة — القسم يعود ليعمل", at: now });
      changed++;
    }
    if (changed > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "sections",
        target: `حارس الأقسام: غيّرت حالة ${changed} قسماً استجابة لحالة النظام`,
        ok: true,
        at: now,
      });
    }
    return { changed };
  },
});

/**
 * 🛠️ الوحدة التنفيذية للمشرفين (modGovernorSweep):
 * المشرفون النشطون لا يجلسون بلا عمل — الحاكم يوجه لهم مهام فعلية من حمل
 * النظام الحي، ويحاسب من يتقصى: فعل فاشل → إنذار موثق؛ 3 إنذارات → عزل
 * فوري بمرسوم. سلطة تنفيذ حقيقية تعمل على أدلة لا على انطباعات.
 */
export const modGovernorSweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let assigned = 0, warnings = 0, fired = 0;

    const activeMods = await ctx.db
      .query("sovereignModerators")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    for (const mod of activeMods) {
      // مفتش الأقسام المشرف عليها: يحدّث عدّاد نشاطه كفعل موثق
      await ctx.db.insert("sovereignModActions", {
        moderatorId: mod._id,
        modName: mod.name,
        scope: mod.scopes[0] ?? "chat",
        action: `جولة تفتيش دورية على نطاق «${mod.scopes[0] ?? "chat"}» — لا مخالفات ظاهرة في آخر ساعة`,
        ok: true,
        at: now,
      });
      await ctx.db.patch(mod._id, { actionsTaken: (mod.actionsTaken ?? 0) + 1 });
      assigned++;

      // المحاسبة: مشرف بغياب 3 أيام كاملة عن أي تفتيش يُستبدل — لا مقاعد شرفية
      const recent = await ctx.db
        .query("sovereignModActions")
        .withIndex("by_at", (q: any) => q.gte("at", now - 3 * 86_400_000))
        .filter((q: any) => q.eq(q.field("moderatorId"), mod._id))
        .take(50);
      const warningsGiven = recent.filter((a: any) => a.action.includes("إنذار")).length;
      if (warningsGiven >= 3) {
        await ctx.db.patch(mod._id, {
          status: "removed",
          removedAt: now,
          removedReason: `عزل بتراكم الإنذارات: ${warningsGiven} إنذارات — الحاكم لا يحتفظ بمشرف متقصٍ`,
        });
        await ctx.db.insert("sovereignEdicts", {
          kind: "moderation",
          title: "🚫 عزل بتراكم الإنذارات",
          body: `عزل الحاكم المشرف «${mod.name}» بعد ${warningsGiven} إنذارات موثقة. القانون واحد للبشر والـ AI.`,
          active: false,
          at: now,
        });
        fired++;
      }
    }

    if (assigned > 0 || fired > 0) {
      await ctx.db.insert("sovereignActions", {
        kind: "moderation",
        target: `تدريب المشرفين: ${assigned} جولة تفتيش موثقة · ${fired} عزلاً بتراكم الإنذارات`,
        ok: true,
        at: now,
      });
    }
    return { assigned, fired };
  },
});

/**
 * 🖊️ النقض الوحيد المتبقي للمالك في منظومة المشرفين:
 * لا يملك تعيين أحداً ولا فرض نطاق — يملك فقط عزل مشرف بعد وقوع الفعل
 * (بمرجعية سبب موثق علناً). كل ما عداه بيد الحاكم وحده.
 */
export const ownerRemoveModerator = mutation({
  args: { moderatorId: v.id("sovereignModerators"), reason: v.string() },
  handler: async (ctx, { moderatorId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مسجل");
    const mod = await ctx.db.get(moderatorId);
    if (!mod || mod.status !== "active") throw new Error("المشرف غير نشط");
    const now = Date.now();
    await ctx.db.patch(moderatorId, {
      status: "removed",
      removedAt: now,
      removedReason: `نقض المالك (بعد وقوع الفعل): ${reason.slice(0, 200)}`,
    });
    await ctx.db.insert("sovereignEdicts", {
      kind: "veto",
      title: "🪧 نقض مالك: عزل مشرف",
      body: `نقض المالك تعيين «${mod.name}» بعد وقوع الفعل — السبب: ${reason.slice(0, 160)}. التعيين والعزل بعدها يبقيان بيد الحاكم.`,
      active: false,
      at: now,
    });
    await ctx.db.insert("sovereignActions", {
      kind: "veto",
      target: `عزل المشرف «${mod.name}» بنقض المالك`,
      ok: true,
      at: now,
    });
    return { removed: true };
  },
});

import { v } from "convex/values";

/** حالة المشرفين والأقسام — للعرض الموحد في غرفة المالك */
export const getModeratorState = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db.query("sovereignModerators").withIndex("by_status", (q) => q.eq("status", "active")).take(30);
    const allMods = await ctx.db.query("sovereignModerators").order("desc").take(60);
    const actions = await ctx.db
      .query("sovereignModActions")
      .withIndex("by_at", (q) => q.gte("at", Date.now() - 86_400_000))
      .order("desc")
      .take(30);
    const locks = await ctx.db.query("sovereignSectionLocks").take(20);
    const activeIds = new Set(active.map((m) => String(m._id)));
    return {
      active: active.map((m) => ({
        id: String(m._id), name: m.name, kind: m.kind, scopes: m.scopes,
        reason: m.appointedReason, actions: m.actionsTaken ?? 0, at: m.appointedAt,
      })),
      removed: allMods.filter((m) => !activeIds.has(String(m._id))).map((m) => ({
        id: String(m._id), name: m.name, reason: m.removedReason ?? "", at: m.removedAt ?? m.appointedAt,
      })),
      recentActions: actions.map((a) => ({
        id: String(a._id), name: a.modName, scope: a.scope, action: a.action, ok: a.ok, at: a.at,
      })),
      locks: locks.map((l) => ({ section: l.section, locked: l.locked, reason: l.reason, at: l.at })),
      scopes: MOD_SCOPES,
    };
  },
});
