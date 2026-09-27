import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🜂 العقل الأعظم (MetaMind) — الأداة 27: وعي فوق المنظومة كلها
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 26 أداة تكتب كل قرارها في ناقل واحد حقيقي (aiDecisionLog) —
 * العقل الأعظم يقرأ هذا الناقل ويفعل ما لا تفعله أي أداة:
 * **يشخّص المنظومة نفسها** كما يفحص الطبيب مريضاً:
 *
 *   1) 🩺 مؤشرات صحة كل أداة (من أفعال حقيقية لا آراء):
 *        النشاط: هل تعمل أم صامتة؟
 *        العدالة: هل أحكامها تُنقض كثيراً في المحكمة؟ (ظلم متكرر = عطل)
 *        التوازن: هل قوتها مضاعفة بغير انضباط؟
 *        الصمت المقلق: أداة كتبت أمس وغابت اليوم؟
 *   2) 📊 درجة حياة المنظومة (0-100): من توزيع النشاط عبر الأدوات —
 *        منظومة بثلاث أدوات تعمل و22 صامتة ليست منظومة حية.
 *   3) 🫀 نبضات دورية: كل 6 ساعات لقطة معلنة بالذكاء أو محلياً.
 *   4) 📜 التشريح اليومي: بيان صادر عن «وعي المشروع» — ما سيم
 *        وما ظلم وما خفا وأين يجب أن تُعلن الحرب على الخمول.
 * ═══════════════════════════════════════════════════════════════════════
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const PULSE_INTERVAL = 6 * HOUR;
const METAMIND_SYSTEM = "meta_mind";
const TOOL_SYSTEMS = [
  "rivalry",
  "war_mirror",
  "twin_council",
  "alliance_cup",
  "mind_war",
  "honor_court",
  "ghost_duel",
  "fate",
  "exchange",
  "habit",
  "mentor",
] as const;

type ToolHealth = {
  system: string;
  label: string;
  events7d: number;
  events24h: number;
  silenceHours: number; // منذ آخر حدث (999 = لا شيء أبداً)
  unjustCount: number; // أحكام نُقضت في المحكمة خلال أسبوع
  health: "alive" | "weak" | "silent" | "suspicious";
};

type MetaSnapshot = {
  totalEvents: number;
  activeTools: number;
  totalTools: number;
  lifeScore: number;
  unjustTotal: number;
  healthByTool: ToolHealth[];
};

const TOOL_LABELS: Record<string, string> = {
  rivalry: "صراع النقيض",
  war_mirror: "المرآة الحربية",
  twin_council: "مجلس التوأم الحربي",
  alliance_cup: "كأس التحالفات",
  mind_war: "الحرب الكبرى",
  honor_court: "محكمة الشرف",
  ghost_duel: "مبارزة الشبح",
  fate: "بئر القدر",
  exchange: "صرف القدرات",
  habit: "مرصد العادات",
  mentor: "بازار العقول",
};

// ═══════════════════════════════════════════════════════════════════════
// 1) نبض المنظومة — القراءة التشخيصية من aiDecisionLog الحقيقي
// ═══════════════════════════════════════════════════════════════════════

async function diagnose(ctx: QueryCtx | MutationCtx): Promise<MetaSnapshot> {
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const dayAgo = now - DAY;

  // قراءة الناقل الحقيقي — آخر 1000 حدث
  const events = await ctx.db
    .query("aiDecisionLog")
    .withIndex("by_created", (q) => q.gt("createdAt", weekAgo))
    .take(1000);

  const perTool = new Map<string, { count7: number; count24: number; last: number }>();
  for (const s of TOOL_SYSTEMS) perTool.set(s, { count7: 0, count24: 0, last: 0 });
  let totalEvents = 0;

  for (const e of events) {
    const tool = perTool.get(e.system);
    if (!tool) continue;
    totalEvents += 1;
    tool.count7 += 1;
    if (e.createdAt >= dayAgo) tool.count24 += 1;
    tool.last = Math.max(tool.last, e.createdAt);
  }

  // العدالة: أحكام المحكمة المنقوضة — تُحسب على أدوات الأحكام
  const courtCases = await ctx.db.query("courtCases").take(120);
  const unjustByDomain = new Map<string, number>();
  for (const c of courtCases) {
    if (c.status === "judged" && c.overturned === true) {
      unjustByDomain.set(c.domain, (unjustByDomain.get(c.domain) ?? 0) + 1);
    }
  }
  const domainToSystem: Record<string, string> = {
    rivalry: "rivalry",
    mirror: "war_mirror",
    council: "twin_council",
  };

  const healthByTool: ToolHealth[] = TOOL_SYSTEMS.map((system) => {
    const t = perTool.get(system)!;
    const silenceHours = t.last > 0 ? Math.round((now - t.last) / HOUR) : 999;
    const unjust =
      [...unjustByDomain.entries()]
        .filter(([d]) => domainToSystem[d] === system)
        .reduce((s, [, n]) => s + n, 0);

    let health: ToolHealth["health"];
    if (t.count7 === 0) health = "silent";
    else if (silenceHours >= 48) health = "suspicious"; // كانت حية وغابت
    else if (unjust >= 3) health = "suspicious"; // ظلم متكرر
    else if (t.count7 < 4) health = "weak";
    else health = "alive";

    return {
      system,
      label: TOOL_LABELS[system] ?? system,
      events7d: t.count7,
      events24h: t.count24,
      silenceHours,
      unjustCount: unjust,
      health,
    };
  });

  const activeTools = healthByTool.filter((t) => t.health === "alive").length;
  const lifeScore = Math.round((activeTools / TOOL_SYSTEMS.length) * 100);

  return {
    totalEvents,
    activeTools,
    totalTools: TOOL_SYSTEMS.length,
    lifeScore,
    unjustTotal: [...unjustByDomain.values()].reduce((s, n) => s + n, 0),
    healthByTool,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 2) قراءة الواجهة
// ═══════════════════════════════════════════════════════════════════════

export const getMetaPulse = query({
  handler: async (ctx): Promise<{ snapshot: MetaSnapshot; pulse: Doc<"metaMindPulses"> | null }> => {
    const snapshot = await diagnose(ctx);
    const pulse = (
      await ctx.db
        .query("metaMindPulses")
        .withIndex("by_created", (q) => q.gt("createdAt", 0))
        .order("desc")
        .take(1)
    )[0];
    return { snapshot, pulse: pulse ?? null };
  },
});

export const getMetaHistory = query({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("metaMindPulses")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(10);
    return rows;
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) النبضة الدورية + التشريح اليومي
// ═══════════════════════════════════════════════════════════════════════

function localNarration(s: MetaSnapshot): string {
  const silent = s.healthByTool.filter((t) => t.health === "silent").map((t) => t.label);
  const suspicious = s.healthByTool.filter((t) => t.health === "suspicious").map((t) => t.label);
  const stars = s.healthByTool.filter((t) => t.health === "alive").sort((a, b) => b.events7d - a.events7d).slice(0, 3);

  const parts: string[] = [];
  parts.push(
    s.lifeScore >= 70
      ? `🜂 المنظومة تنبض بصحة ${s.lifeScore}% — ${s.activeTools} من ${s.totalTools} أدوات نشطة.`
      : s.lifeScore >= 40
        ? `🜂 المنظومة متعبة: صحة ${s.lifeScore}% — ${s.activeTools} فقط من ${s.totalTools} أدوات تنبض.`
        : `🜂 إنذار: صحة المنظومة ${s.lifeScore}% فقط — معظم الأدوات صامتة، الحرب تحتاج إحياء.`,
  );
  if (stars.length > 0) parts.push(`أكثر الأدوات نبضاً: ${stars.map((t) => `${t.label} (${t.events7d})`).join("، ")}.`);
  if (suspicious.length > 0) parts.push(`صمت مقلق أو ظلم متكرر في: ${suspicious.join("، ")}.`);
  if (silent.length > 0 && silent.length <= 4) parts.push(`أدوات بلا أي نبضة هذا الأسبوع: ${silent.join("، ")}.`);
  if (s.unjustTotal > 0) parts.push(`المحكمة نقضت ${s.unjustTotal} حكماً هذا الأسبوع — العدالة تعمل.`);
  return parts.join(" ");
}

export const metaPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const snapshot = await diagnose(ctx);

    // نبضة جديدة فقط إذا مرّت 6 ساعات عن الأخيرة
    const last = (
      await ctx.db
        .query("metaMindPulses")
        .withIndex("by_created", (q) => q.gt("createdAt", 0))
        .order("desc")
        .take(1)
    )[0];
    if (last && now - last.createdAt < PULSE_INTERVAL - 5 * 60_000) {
      return { skipped: true as const };
    }

    let narration = localNarration(snapshot);
    let engine = "local";
    if (getOpenRouterKey()) {
      try {
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت الوعي الأعظم لمنظومة حرب عقول — لا تصف، بل شخّص. اكتب نبضة من 3-4 أسطر: صحة المنظومة بالأرقام، الأداة المريضة (نشاطها/عدالتها)، وتوصية واحدة صادمة وواضحة لمالك اللعبة. صوتك هادئ مهيب، بلا مجاملات.",
            },
            {
              role: "user",
              content: JSON.stringify({
                صحة_المنظومة: snapshot.lifeScore,
                أدوات_نشطة: `${snapshot.activeTools}/${snapshot.totalTools}`,
                أحداث_الأسبوع: snapshot.totalEvents,
                نقض_المحكمة: snapshot.unjustTotal,
                صحة_الأدوات: snapshot.healthByTool.map((t) => ({
                  الأداة: t.label,
                  أحداث: t.events7d,
                  صمت_ساعات: t.silenceHours === 999 ? "أبداً" : t.silenceHours,
                  ظلم: t.unjustCount,
                  الحالة: t.health,
                })),
              }),
            },
          ],
          320,
          0.7,
          "MindClash MetaMind Pulse",
        );
        const clean = raw.trim().slice(0, 520);
        if (clean.length > 60) {
          narration = clean;
          engine = "llm";
        }
      } catch {
        /* التشخيص المحلي كافٍ */
      }
    }

    await ctx.db.insert("metaMindPulses", {
      lifeScore: snapshot.lifeScore,
      activeTools: snapshot.activeTools,
      totalTools: snapshot.totalTools,
      totalEvents: snapshot.totalEvents,
      unjustTotal: snapshot.unjustTotal,
      narration,
      engine,
      healthJson: JSON.stringify(snapshot.healthByTool),
      createdAt: now,
    });

    // التشريح اليومي: أعلن الحالة في aiDecisionLog
    if (!last || now - last.createdAt >= DAY) {
      await ctx.db.insert("aiDecisionLog", {
        system: METAMIND_SYSTEM,
        actorName: "العقل الأعظم",
        action: "daily_diagnosis",
        targetName: "المنظومة",
        detail: `${narration.slice(0, 220)}`,
        severity: snapshot.lifeScore >= 60 ? "low" : snapshot.lifeScore >= 40 ? "medium" : "high",
        createdAt: now,
      });
    }

    return { skipped: false as const, lifeScore: snapshot.lifeScore, engine };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) تشريح فوري عند الطلب (زر الواجهة — يفرض نبضة جديدة)
// ═══════════════════════════════════════════════════════════════════════

export const forceDiagnosis = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me || me.role !== "admin") throw new Error("تشريح العقل الأعظم للمالك فقط");

    const snapshot = await diagnose(ctx);
    let narration = localNarration(snapshot);
    let engine = "local";
    if (getOpenRouterKey()) {
      try {
        await ensureMetaRuntime(ctx);
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت الوعي الأعظم لمنظومة حرب عقول. اطلب منك المالك تشريحاً فورياً — اكتب 4 أسطر صادمة: أين تنبض المنظومة، أين تُحتضر، أين يظهر الظلم المتكرر، وما الأمر الذي يجب أن ينفذه المالك اليوم. بلا مجاملات إطلاقاً.",
            },
            {
              role: "user",
              content: JSON.stringify({
                صحة_المنظومة: snapshot.lifeScore,
                أدوات_نشطة: `${snapshot.activeTools}/${snapshot.totalTools}`,
                أحداث_الأسبوع: snapshot.totalEvents,
                نقض_المحكمة: snapshot.unjustTotal,
                صحة_الأدوات: snapshot.healthByTool.map((t) => ({
                  الأداة: t.label,
                  أحداث: t.events7d,
                  صمت_ساعات: t.silenceHours === 999 ? "أبداً" : t.silenceHours,
                  ظلم: t.unjustCount,
                  الحالة: t.health,
                })),
              }),
            },
          ],
          340,
          0.7,
          "MindClash MetaMind Diagnosis",
        );
        const clean = raw.trim().slice(0, 540);
        if (clean.length > 60) {
          narration = clean;
          engine = "llm";
        }
      } catch {
        /* المحلي يكفي */
      }
    }

    await ctx.db.insert("metaMindPulses", {
      lifeScore: snapshot.lifeScore,
      activeTools: snapshot.activeTools,
      totalTools: snapshot.totalTools,
      totalEvents: snapshot.totalEvents,
      unjustTotal: snapshot.unjustTotal,
      narration,
      engine,
      healthJson: JSON.stringify(snapshot.healthByTool),
      createdAt: Date.now(),
    });
    await ctx.db.insert("aiDecisionLog", {
      system: METAMIND_SYSTEM,
      actorName: "العقل الأعظم",
      action: "forced_diagnosis",
      targetId: String(userId),
      targetName: me.name ?? "المالك",
      detail: `تشريح فوري: صحة ${snapshot.lifeScore}% — ${narration.slice(0, 180)}`,
      severity: "medium",
      createdAt: Date.now(),
    });
    return { ok: true as const, narration, engine, lifeScore: snapshot.lifeScore };
  },
});

// ضمان أن runtime الذكاء جاهز (نفس نمط الأدوات السابقة)
async function ensureMetaRuntime(ctx: unknown): Promise<void> {
  const { ensureAiRuntime } = await import("./apiCore");
  await ensureAiRuntime(ctx);
}

// ═══════════════════════════════════════════════════════════════════════
// 5) المهمة الدورية
// ═══════════════════════════════════════════════════════════════════════

export const metaJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiMeta.metaPulse, {})) as unknown;
  },
});
