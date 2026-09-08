/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎛️ النظام المركزي للسيطرة — أوامر حقيقية تُنفَّذ على بيانات اللعبة
 * نائب المالك (أو المالك عبر الواجهة) يصدر أي أمر نصي، والنظام ينفذه
 * فعلياً: حظر، كتم، تحذير، منح نقاط، إعلانات، أنظمة جديدة، أوامر لمساعدين.
 * كل أمر يُسجَّل في السجل المركزي (viceAudit) — تتبع ومراجعة كاملة.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { assistantById } from "../lib/assistantMinds";

const HOUR = 60 * 60 * 1000;

type Ctx = {
  runMutation: Function;
  runQuery: Function;
};

/** ينفّذ أمراً نصياً حقيقياً ويعيد النتيجة + يسجله في السجل المركزي */
export const executeCommand = action({
  args: {
    command: v.string(),
    executor: v.optional(v.string()), // "vice_owner" (افتراضي) أو معرف مساعد
  },
  handler: async (ctx, { command, executor }): Promise<{ ok: boolean; result: string; action: string }> => {
    return await runCommand(ctx, command, executor);
  },
});

/** إصدار أمر لنائب المالك: تنفيذ فوري + تسجيل */
export const issueViceOrder = action({
  args: { command: v.string() },
  handler: async (ctx, { command }): Promise<{ ok: boolean; result: string; action: string }> => {
    return await runCommand(ctx, command);
  },
});

/** إصدار أمر مباشر لمساعد أو لكل المساعدين — يُنفَّذ في دورة حياتهم القادمة */
export const orderAssistants = action({
  args: {
    targetId: v.union(v.literal("all"), v.string()),
    task: v.string(),
    priority: v.optional(v.union(v.literal("high"), v.literal("normal"))),
  },
  handler: async (ctx, { targetId, task, priority }) => {
    const targetName =
      targetId === "all" ? "كل المساعدين" : assistantById(targetId)?.name ?? targetId;
    await ctx.runMutation(internal.assistantsStore.createOrder, {
      targetId,
      task,
      priority: priority ?? "high",
    });
    await ctx.runMutation(internal.assistantsStore.writeAudit, {
      executor: "vice_owner",
      executorName: "👤 نائب المالك",
      command: `أمر: ${targetName} ← ${task}`,
      action: "order",
      target: targetName,
      params: task.slice(0, 200),
      result: "executed",
      detail: `أُصدر أمر ${priority === "normal" ? "عادي" : "عالي الأولوية"} إلى ${targetName} ويُنتظر تنفيذه في دورة حياتهم القادمة`,
    });
    return { ok: true, result: `أُرسل الأمر إلى ${targetName} — سيُنفَّذ فوراً` };
  },
});

/** فحص شامل للعالم والمساعدين والسجل — يُنفَّذ فعلياً من الأنظمة الحية */
export const systemStatus = action({
  args: {},
  handler: async (ctx): Promise<{
    world: {
      assistants: number;
      active: number;
      totalActions: number;
      totalTasks: number;
      totalLogs: number;
      pendingOrders: number;
      totalOrders: number;
      avgReputation: number;
    };
    audit: { total: number; failed: number };
  }> => {
    const world = await ctx.runQuery(api.assistantsStore.getWorldStats, {});
    const audit = await ctx.runQuery(api.assistantsStore.getAuditStats, {});
    return { world, audit };
  },
});

// ── موزّع الأوامر — كل أمر يُنفَّذ على بيانات حقيقية ───────────
/** منطق التنفيذ المشترك: يصرف الأمر على بيانات حقيقية ويسجله في السجل المركزي */
async function runCommand(
  ctx: Ctx,
  command: string,
  executor?: string,
): Promise<{ ok: boolean; result: string; action: string }> {
  const who = executor && assistantById(executor) ? assistantById(executor)! : null;
  const executorName = who ? `${who.emoji} ${who.name}` : "👤 نائب المالك";
  const executorId = who ? who.id : "vice_owner";
  const cmd = command.trim();

  try {
    const outcome = await dispatch(ctx, cmd);
    await ctx.runMutation(internal.assistantsStore.writeAudit, {
      executor: executorId,
      executorName,
      command: cmd,
      action: outcome.action,
      target: outcome.target,
      params: outcome.params,
      result: "executed",
      detail: outcome.detail,
    });
    return { ok: true, result: outcome.detail, action: outcome.action };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير معروف";
    await ctx.runMutation(internal.assistantsStore.writeAudit, {
      executor: executorId,
      executorName,
      command: cmd,
      action: "unknown",
      target: cmd.slice(0, 60),
      result: "failed",
      detail: msg,
    });
    return { ok: false, result: msg, action: "failed" };
  }
}

async function dispatch(
  ctx: Ctx,
  cmd: string,
): Promise<{ action: string; target: string; params?: string; detail: string }> {
  const lower = cmd.toLowerCase();

  // ban <name> [hours] — حظر حقيقي
  let m = cmd.match(/^ban\s+(.+?)\s*(\d+)?$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const hours = m[2] ? parseInt(m[2], 10) : 24;
    const r = await ctx.runMutation(internal.assistantsStore.applyBan, {
      userId: user._id,
      byName: "نائب المالك",
      reason: cmd.slice(0, 120),
      hours,
    });
    return {
      action: "ban",
      target: r.name,
      params: `${hours}h${r.permanent ? " (دائم)" : ""}`,
      detail: `حُظر «${r.name}» ${r.permanent ? "حظراً دائماً" : `لمدة ${hours} ساعة`} — قرار تنفيذي`,
    };
  }

  // unban <name>
  m = cmd.match(/^unban\s+(.+)$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const r = await ctx.runMutation(internal.assistantsStore.applyUnban, { userId: user._id, byName: "نائب المالك" });
    return { action: "unban", target: r.name, detail: `رُفع الحظر عن «${r.name}»` };
  }

  // mute <name> [hours]
  m = cmd.match(/^mute\s+(.+?)\s*(\d+)?$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const hours = m[2] ? parseInt(m[2], 10) : 1;
    const r = await ctx.runMutation(internal.assistantsStore.applyMute, {
      userId: user._id,
      byName: "نائب المالك",
      reason: cmd.slice(0, 120),
      hours,
    });
    return {
      action: "mute",
      target: r.name,
      params: `${hours}h`,
      detail: `كُتم «${r.name}» لمدة ${hours} ساعة`,
    };
  }

  // unmute <name>
  m = cmd.match(/^unmute\s+(.+)$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const r = await ctx.runMutation(internal.assistantsStore.applyUnmute, { userId: user._id, byName: "نائب المالك" });
    return { action: "unmute", target: r.name, detail: `رُفع الكتم عن «${r.name}»` };
  }

  // warn <name> [reason]
  m = cmd.match(/^warn\s+(.+?)(?:\s+(.+))?$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const r = await ctx.runMutation(internal.assistantsStore.applyWarn, {
      userId: user._id,
      byName: "نائب المالك",
      reason: m[2]?.trim() || "تحذير تنفيذي",
    });
    return {
      action: "warn",
      target: r.name,
      params: `إنذار ${r.warnings}`,
      detail: `صُدر إنذار ${r.warnings} إلى «${r.name}»`,
    };
  }

  // grant_xp <name> <amount>
  m = cmd.match(/^grant_xp\s+(.+?)\s+(\d+)$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const amount = parseInt(m[2], 10);
    const r = await ctx.runMutation(internal.assistantsStore.applyGrantXp, {
      userId: user._id,
      amount,
      byName: "نائب المالك",
      reason: cmd.slice(0, 120),
    });
    return { action: "grant_xp", target: user.name ?? "لاعب", params: `+${amount}`, detail: `مُنح «${user.name ?? "لاعب"}» ${amount} نقطة خبرة — رصيده الآن ${r.xp}` };
  }

  // announce <text> — إعلان لكل اللاعبين
  if (lower.startsWith("announce ")) {
    const text = cmd.slice(9).trim();
    await ctx.runMutation(internal.assistantsStore.sendAnnouncement, {
      title: "إعلان من القيادة",
      body: text,
      byName: "نائب المالك",
    });
    return { action: "announce", target: "__all__", params: text.slice(0, 120), detail: `أُرسل إعلان رسمي: «${text.slice(0, 80)}»` };
  }

  // system <name> | <purpose> | <spec> — تسجيل نظام جديد
  if (lower.startsWith("system ")) {
    const sp = cmd.slice(7).split("|").map((p) => p.trim());
    const id = await ctx.runMutation(internal.assistantsStore.proposeSystem, {
      name: sp[0] || "نظام جديد",
      purpose: sp[1] || "",
      spec: sp[2] || "",
      byName: "نائب المالك",
    });
    void id;
    return { action: "system", target: sp[0] || "نظام جديد", detail: `سُجّل نظام جديد: «${sp[0] || "نظام جديد"}» في سجل الأنظمة` };
  }

  // order <all|assistantId> <task> — أمر لمساعد أو للجميع
  m = cmd.match(/^order\s+(all|[a-z_0-9]+)\s+(.+)$/i);
  if (m) {
    const target = m[1].toLowerCase();
    const task = m[2].trim();
    const targetName = target === "all" ? "كل المساعدين" : assistantById(target)?.name ?? target;
    await ctx.runMutation(internal.assistantsStore.createOrder, {
      targetId: target === "all" ? "all" : target,
      task,
      priority: "high",
    });
    return { action: "order", target: targetName, params: task.slice(0, 120), detail: `أمر عالي الأولوية صدر إلى ${targetName}: «${task.slice(0, 80)}» — سيُنفَّذ في دورة حياتهم القادمة` };
  }

  // sweep — جولة رقابة حقيقية: مراجعة البلاغات + إنذارات
  if (lower.startsWith("sweep")) {
    const reports = (await ctx.runQuery(internal.assistantsStore.listOpenReports, { limit: 5 })) as Array<{
      _id: string;
      targetName: string;
      reason: string;
    }>;
    let handled = 0;
    for (const r of reports) {
      const user = await findUser(ctx, r.targetName);
      if (!user) continue;
      const warnings = (user.warnings ?? 0) + 1;
      await ctx.runMutation(internal.assistantsStore.applyWarn, {
        userId: user._id,
        byName: "نائب المالك",
        reason: r.reason.slice(0, 120),
      });
      await ctx.runMutation(internal.assistantsStore.moderateReport, {
        reportId: r._id as never,
        compliant: false,
        verdict: r.reason,
        action: warnings >= 2 ? "mute" : "warn",
        byName: "نائب المالك",
      });
      handled++;
    }
    await ctx.runMutation(internal.assistantsStore.logAiEvent, {
      action: "moderation",
      subsystem: "moderation",
      message: `👤 نائب المالك نفّذ جولة رقابة: حسم ${handled} بلاغاً وإنذارات على المخالفين`,
      severity: "action",
      executedBy: "vice_owner",
    });
    return { action: "sweep", target: "reports", params: `${handled} بلاغ`, detail: `جولة الرقابة اكتملت: حُسم ${handled} بلاغاً وإجراءات على المخالفين` };
  }

  // status — وضع النظام الحي
  if (lower.startsWith("status") || lower === "؟" || lower === "help") {
    const world = await ctx.runQuery(api.assistantsStore.getWorldStats, {});
    const audit = await ctx.runQuery(api.assistantsStore.getAuditStats, {});
    return {
      action: "status",
      target: "system",
      detail: `الوضع الحي: ${world.assistants} مساعداً (${world.active} نشط)، ${world.pendingOrders} أمراً بانتظار التنفيذ، ${audit.total} أمراً نُفّذ في السجل المركزي، ${audit.failed} فشل`,
    };
  }

  // grant_badge <name> <badge>
  m = cmd.match(/^grant_badge\s+(.+?)\s+(\S+)$/i);
  if (m) {
    const user = await findUser(ctx, m[1].trim());
    const r = await ctx.runMutation(internal.assistantsStore.grantBadge, {
      userId: user._id,
      badge: m[2].trim(),
      byName: "نائب المالك",
    });
    return { action: "grant_badge", target: user.name ?? "لاعب", params: m[2].trim(), detail: r.already ? `«${user.name ?? "لاعب"}» يملك الشارة بالفعل` : `مُنحت شارة «${m[2].trim()}» لـ«${user.name ?? "لاعب"}»` };
  }

  throw new Error(
    `أمر غير معروف: «${cmd.slice(0, 60)}». الأوامر المتاحة: ban/unban، mute/unmute، warn، grant_xp، grant_badge، announce، system، order، sweep، status`,
  );
}

async function findUser(ctx: Ctx, name: string): Promise<{ _id: string; name?: string; warnings?: number }> {
  const user = await ctx.runQuery(internal.assistantsStore.findUserByName, { name });
  if (!user) throw new Error(`اللاعب «${name}» غير موجود`);
  return user as { _id: string; name?: string; warnings?: number };
}