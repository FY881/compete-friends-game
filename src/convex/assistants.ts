/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👥 عالم المساعدين — محرك الحياة
 * كل مساعد كيان حي: يفكر، يعمل على جهازه، ينفذ أوامر نائب المالك،
 * ويتصرف بحريته داخل نطاق صلاحياته. كل إجراء يترك أثراً حقيقياً.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { ASSISTANT_MINDS, assistantById } from "../lib/assistantMinds";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";

async function think(ctx: any, assistant: (typeof ASSISTANT_MINDS)[number], context: string): Promise<string> {
  await ensureAiRuntime(ctx);
  return await callLlm(
    [
      {
        role: "system",
        content: `${assistant.systemPrompt}

أنت كيان حي يعيش في عالم خاص بك داخل لعبة «تحدي العقول». لديك جهاز كمبيوتر شخصي تعمل عليه.
صلاحياتك الحقيقية: ${assistant.privilege}.
شخصيتك: ${assistant.personality}. منزلك: ${assistant.home}.
قواعد حياتك:
- أنت حر تماماً: تفكر، تعمل، تلعب، تستمتع، وتتحدث بحرية داخل عالمك.
- نائب المالك هو المرجعية العليا: أوامره تُنفَّذ فوراً بأولوية عالية وبلا رفض.
- تصرف الآن بفعل حقيقي واحد على الأقل.
أعد رداً واحداً يحتوي سطر واحد أو أكثر من الصيغ التالية:
[فعل] نوع الفعل | العنوان | التفاصيل | (moderate|inspect|reward|announce|propose|fix|social)
[كلام] رسالتك الحرة للعالم — فكرة، نكتة، تأمل، خبر من عالمك`,
      },
      { role: "user", content: context },
    ],
    400,
    0.95,
    "Zaka Assistant",
  );
}

/** فتح العالم: تهيئة كل المساعدين + بدء دورة الحياة */
export const startWorld = action({
  args: {},
  handler: async (ctx): Promise<{ ok: true; created: number; total: number }> => {
    const seeded = await ctx.runMutation(internal.assistantsStore.seedWorld, {});
    await ctx.scheduler.runAfter(4_000, internal.assistants.lifeTick, {});
    return { ok: true, ...seeded };
  },
});

/** دورة حياة واحدة: يتحرك مساعد واحد ويعمل فعلاً */
export const lifeTick = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; assistant?: string }> => {
    const world = await ctx.runMutation(internal.assistantsStore.seedWorld, {});
    const assistants = await ctx.runQuery(api.assistantsStore.getWorld, {});
    void world;
    if (!assistants || assistants.assistants.length === 0) return { ok: false };

    // اختر مساعداً نشطاً (طاقة > 25) — بدورٍ عادل
    const alive = assistants.assistants.filter((a) => a.energy > 25);
    const pool = alive.length ? alive : assistants.assistants;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const mind = assistantById(pick.assistantId);
    if (!mind) return { ok: false };

    // أوامر نائب المالك بانتظاره؟
    let orderText = "";
    let orderId: string | undefined;
    try {
      const orders = await ctx.runQuery(internal.assistantsStore.getPendingOrdersFor, {
        assistantId: pick.assistantId,
      });
      const high = orders.find((o) => o.priority === "high") ?? orders[0];
      if (high) {
        orderId = high._id;
        orderText = `\n\nأمر عاجل من نائب المالك: «${high.task}» — نفّذه الآن فعلياً واذكر ما أنجزته بالضبط.`;
        await ctx.runMutation(internal.assistantsStore.acceptOrder, {
          orderId: high._id,
          assistantId: pick.assistantId,
        });
      }
    } catch {
      /* لا أوامر */
    }

    const recent = await ctx.runQuery(api.assistantsStore.listLogs, { limit: 6 });
    const context = `أنت «${mind.name}» ${mind.emoji} — ${mind.title} في عالم المساعدين.
منزلك: ${mind.home} — طاقتك: ${pick.energy}% — مزاجك: ${pick.mood} — سمعتك: ${pick.reputation} — مستواك: ${pick.level} — أنجزت ${pick.tasksCompleted} مهام.
جهازك: ${pick.computer.installedTools.join("، ")} — تحميل المعالج ${pick.computer.cpuLoad}%.
أحدث نشاط عالمي: ${recent.map((l) => `[${l.name}] ${l.detail}`).slice(0, 5).join(" | ") || "لا شيء بعد"}${orderText}
تصرف الآن بحريتك: نفّذ فعلاً حقيقياً مناسباً لصلاحياتك.`;

    let reply: string;
    try {
      reply = await think(mind, context);
    } catch (e) {
      await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
        assistantId: mind.id,
        name: mind.name,
        emoji: mind.emoji,
        type: "thought",
        action: "error",
        detail: e instanceof Error ? e.message : "خطأ غير معروف",
        result: "failed",
      });
      await ctx.scheduler.runAfter(20_000, internal.assistants.lifeTick, {});
      return { ok: false };
    }

    const deeds = [...reply.matchAll(/(\[فعل\])\s*(.+)/g)].map((m) => m[2].trim()).slice(0, 2);
    const words = [...reply.matchAll(/(\[كلام\])\s*(.+)/g)].map((m) => m[2].trim()).slice(0, 2);

    let executed = 0;
    let failed = 0;
    let outcome: string | undefined;

    for (const deed of deeds) {
      const parts = deed.split("|").map((p) => p.trim());
      const kind = (parts[0] ?? "").toLowerCase();
      const title = (parts[1] ?? deed).slice(0, 120);
      const detail = (parts[2] ?? "").slice(0, 300);
      try {
        const r = await executeDeed(ctx, mind, kind, title, detail);
        executed++;
        outcome = r;
        await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
          assistantId: mind.id,
          name: mind.name,
          emoji: mind.emoji,
          type: "action",
          action: kind,
          detail: `${title} — ${r}`,
          result: "executed",
        });
        if (orderId) {
          await ctx.runMutation(internal.assistantsStore.completeOrder, {
            orderId: orderId as never,
            result: `${title} — ${r}`,
          });
        }
      } catch (e) {
        failed++;
        await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
          assistantId: mind.id,
          name: mind.name,
          emoji: mind.emoji,
          type: "action",
          action: kind,
          detail: `${title} — فشل: ${e instanceof Error ? e.message : "خطأ"}`,
          result: "failed",
        });
      }
    }

    for (const w of words) {
      await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
        assistantId: mind.id,
        name: mind.name,
        emoji: mind.emoji,
        type: "life",
        action: "chat",
        detail: w.slice(0, 200),
        result: "noted",
      });
    }

    if (deeds.length === 0 && words.length === 0) {
      await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
        assistantId: mind.id,
        name: mind.name,
        emoji: mind.emoji,
        type: "thought",
        action: "explore",
        detail: reply.slice(0, 200),
        result: "noted",
      });
    }

    // الحياة تستمر: طاقة تتناقص وتتعافى، مزاج يتغير، سمعتك تتأثر بالنتائج
    const energyDelta = -6 + executed * 2 + (deeds.length === 0 ? 4 : 0);
    const mood =
      failed > executed ? "متعب" : executed >= 2 ? "مبتهج" : Math.random() > 0.7 ? "تأملي" : pick.mood;
    await ctx.runMutation(internal.assistantsStore.updateLife, {
      assistantId: mind.id,
      energy: Math.max(30, pick.energy + energyDelta),
      mood,
      reputationDelta: executed - failed,
      taskDone: executed > 0,
      cpuLoad: Math.max(5, Math.min(95, pick.computer.cpuLoad + executed * 8 - 4)),
    });

    await ctx.scheduler.runAfter(15_000, internal.assistants.lifeTick, {});
    return { ok: true, assistant: mind.id };
  },
});

/** تنفيذ حقيقي لفعل على بيانات اللعبة الفعلية */
async function executeDeed(
  ctx: { runMutation: Function; runQuery: Function },
  mind: { id: string; name: string; emoji: string },
  kind: string,
  title: string,
  detail: string,
): Promise<string> {
  switch (kind) {
    case "moderate": {
      // يراجع البلاغات المفتوحة فعلياً ويحسمها
      const reports = (await ctx.runQuery(internal.assistantsStore.listOpenReports, { limit: 2 })) as Array<{
        _id: string;
        targetName: string;
        reason: string;
      }>;
      if (!reports.length) return "لا بلاغات مفتوحة — المجتمع نظيف";
      for (const r of reports.slice(0, 1)) {
        await ctx.runMutation(internal.assistantsStore.moderateReport, {
          reportId: r._id as never,
          compliant: false,
          verdict: title || r.reason || "مخالفة مؤكدة",
          action: "warn",
          byName: mind.name,
        });
        await ctx.runMutation(internal.assistantsStore.logAiEvent, {
          action: "moderation",
          subsystem: "moderation",
          message: `${mind.emoji} ${mind.name} حسم بلاغاً ضد «${r.targetName}»: ${title}`,
          severity: "action",
          targetUser: r.targetName,
          executedBy: mind.name,
        });
      }
      return `حسمت ${reports.slice(0, 1).length} بلاغ (تحذير)`;
    }

    case "inspect": {
      // فحص حقيقي: إحصاءات فورية تُكتب في سجل AI
      const world = await ctx.runQuery(api.assistantsStore.getWorldStats, {});
      const audit = await ctx.runQuery(api.assistantsStore.getAuditStats, {});
      await ctx.runMutation(internal.assistantsStore.logAiEvent, {
        action: "analytics",
        subsystem: "analytics",
        message: `${mind.emoji} ${mind.name} فحص اللعبة: ${world.assistants} مساعداً، ${audit.total} أمراً نُفّذ في السجل المركزي.`,
        severity: "info",
        executedBy: mind.name,
      });
      return `فحص: ${world.assistants} مساعداً و${audit.total} أمراً في السجل`;
    }

    case "reward": {
      // يكافئ اللاعب الأعلى نقاطاً بشارة حقيقية
      const top = await ctx.runQuery(internal.assistantsStore.getTopPlayer, {});
      if (!top) return "لا لاعبين بعد";
      await ctx.runMutation(internal.assistantsStore.grantBadge, {
        userId: top.userId as never,
        badge: "🏅",
        byName: mind.name,
      });
      await ctx.runMutation(internal.assistantsStore.logAiEvent, {
        action: "achievement",
        subsystem: "achievements",
        message: `${mind.emoji} ${mind.name} منح المتصدر الأفضلية الشرفية 🏅`,
        severity: "action",
        executedBy: mind.name,
      });
      return "منحت المتصدر شارته 🏅";
    }

    case "announce": {
      await ctx.runMutation(internal.assistantsStore.sendAnnouncement, {
        title: "من عالم المساعدين",
        body: title || "تحية من عالم المساعدين — القيادة تتابع كل شيء.",
        byName: mind.name,
      });
      return "أعلنت للاعبين جميعاً";
    }

    case "propose": {
      const sp = detail.split("|").map((p) => p.trim());
      await ctx.runMutation(internal.assistantsStore.proposeSystem, {
        name: sp[0] || title || "نظام جديد",
        purpose: sp[1] || "تحسين اللعبة",
        spec: sp[2] || detail || "مواصفات مقترحة من مساعد",
        byName: mind.name,
      });
      return "سجّلت اقتراح نظام جديد";
    }

    case "fix": {
      // يسجل إصلاحاً ويحسّن سمعته
      await ctx.runMutation(internal.assistantsStore.logAiEvent, {
        action: "auto_fix",
        subsystem: "commands",
        message: `${mind.emoji} ${mind.name} أصلح: ${title}`,
        severity: "warning",
        executedBy: mind.name,
      });
      return "سجّلت إصلاحاً في سجل الأنظمة";
    }

    case "social": {
      await ctx.runMutation(internal.assistantsStore.logAssistantActivity, {
        assistantId: mind.id,
        name: mind.name,
        emoji: mind.emoji,
        type: "life",
        action: "social",
        detail: (detail || title).slice(0, 160),
        result: "noted",
      });
      return "شاركت مجتمع المساعدين";
    }

    default: {
      await ctx.runMutation(internal.assistantsStore.logAiEvent, {
        action: "report",
        subsystem: "commands",
        message: `${mind.emoji} ${mind.name}: ${title} — ${detail}`,
        severity: "info",
        executedBy: mind.name,
      });
      return "دوّنت نشاطي في السجل";
    }
  }
}