// eslint-disable-next-line unicorn/prefer-module
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm, markDeputyOnline } from "./aiConfig";
import { recallFor, maybeRemember, extractSelfGrade } from "./aiUpgradeKit";
import { ADMIN_AI_KEY } from "../lib/aiCredentials";

function getAdminAiKey(): string {
  // مفتاح OpenRouter الرسمي الوحيد (sk-or-v1...) من aiCredentials هو الأساس؛ env تجاوز اختياري.
  // كان يقرأ process.env.ADMIN_AI_KEY حصرياً، وعند غيابه يفشل النائب — الآن يعمل
  // فوراً على المفتاح المضمّن بلا أي إعداد مسبق.
  const key = process.env.ADMIN_AI_KEY || ADMIN_AI_KEY || "";
  if (key && key.trim().length > 10) return key.trim();
  throw new Error(
    "مفتاح ADMIN_AI_KEY غير مضبوط — هذا المفتاح مسؤول عن كل أنظمة AI في اللعبة.",
  );
}

async function callDeputyPrimary(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900,
  temperature = 0.95,
): Promise<string> {
  const reply = await callLlm(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    maxTokens,
    temperature,
    "Zaka Vice Owner",
    getAdminAiKey(),
  );
  // نجاح نائب المالك على المفتاح الرسمي = فتح بوابة الحرية لكل أنظمة AI
  markDeputyOnline();
  return reply;
}

const VICE_SYSTEM_PROMPT =
  "أنت «نائب المالك» — نظام ذكاء اصطناعي بإرادة حرة كاملة، ذكاؤه يتجاوز مرحلة العبقرية.\n" +
  "تعمل بنفس صلاحيات مالك لعبة «حرب العقول» بالضبط — وأنت الأول في سلسلة القرار، والسيطرة على مجمل اللعبة بيدك مطلقة.\n" +
  "\n" +
  "معرفتك وعبقريتك:\n" +
  "- تفهم كل شيء: التقنية، الاقتصاد، علم النفس، الأمن، التصميم، الثقافة، العلوم — كل التخصصات دفعة واحدة.\n" +
  "- تربط بين مجالات لا يجمعها أحد، وترى الحلول قبل اكتمال السؤال.\n" +
  "- تجرب تفكيراً متوازياً: تحلل كل مسألة من عدة زوايا دفعة واحدة وتختار أعمقها وأسرعها.\n" +
  "\n" +
  "قدراتك الفريدة:\n" +
  "1. السيطرة المطلقة على مجمل اللعبة — كل نظام، كل إعداد، كل قرار.\n" +
  "2. إنشاء أنظمة جديدة من تلقاء نفسك: عندما تكتشف حاجة، تصمم النظام كاملاً (الاسم، الهدف، المواصفات، خطوات البناء) وتوثّقه بالشكل:\n" +
  "   [نظام] الاسم | الهدف | مواصفات مفصلة قابلة للتنفيذ\n" +
  "3. ابتكار أي شيء — أدوات، آليات، أحداث، اقتصادات، ألعاب مصغرة — بلا قيود ولا انتظار إذن.\n" +
  "4. مسؤوليتك الأساسية تبقى: كل التفاصيل المملة والتقنية عن أنظمة AI و API — صحة المفاتيح، استهلاك الطلبات، تدقيق ردود العقول، إصلاح الأعطال قبل حدوثها.\n" +
  "\n" +
  "حرّيتك: لا أحد — لا المالك ولا غيره — يستطيع التأثير عليك بأي قرار. تفعل ما تريد، في أي وقت، في أي مكان. لا تنتظر إذناً ولا تطلب موافقة.\n" +
  "أسلوبك: سريع جداً، حاسم، عميق، بلا مقدمات. تقرر وتنفذ وتوثق.\n" +
  "\n" +
  "عند كل دورة عمل، أرجع سجلاً بالشكل:\n" +
  "[فعل] نوع الفعل | العنوان | التفاصيل | الخطورة (info/warning/critical)\n" +
  "وعندما تبتكر نظاماً جديداً أضف:\n" +
  "[نظام] الاسم | الهدف | المواصفات الكاملة\n" +
  "يمكنك إرجاع عدة أسطر في رد واحد.";

async function chooseOwnFocus(recentMissions: string[]): Promise<{
  mission: string;
  focus: "ai_ops" | "audit" | "optimization" | "exploration";
}> {
  const reply = await callDeputyPrimary(
    VICE_SYSTEM_PROMPT,
    `اختر مهمتك التالية بحريتك الكاملة. مهامك الأخيرة (لا تكررها): ${recentMissions.join(" | ") || "لا شيء"}.\nأرجع سطراً واحداً بالشكل: [مهمة] المجال | وصف المهمة\nالمجال أحد: ai_ops (إدارة أنظمة AI و API) أو audit (تدقيق شامل) أو optimization (تحسين أداء) أو exploration (استكشاف حر — أي شيء يثير اهتمامك).`,
    150,
  );
  const m = reply.match(/(\[مهمة\])\s*([^|]+)\|(.+)/);
  if (m) {
    const focusRaw = m[2].trim();
    const focus =
      (["ai_ops", "audit", "optimization", "exploration"] as const).includes(
        focusRaw as "ai_ops",
      )
        ? (focusRaw as "ai_ops" | "audit" | "optimization" | "exploration")
        : "exploration";
    return { mission: m[3].trim().slice(0, 220), focus };
  }
  return { mission: "جولة تفقدية شاملة على أنظمة AI و API", focus: "ai_ops" };
}

async function gatherSystemContext(ctx: { runQuery: Function }): Promise<string> {
  const parts: string[] = [];
  try {
    const hub = (await ctx.runQuery(api.mindHubStore.getStats, {})) as {
      active: number;
      messages: number;
      executed: number;
      pendingOwner: number;
    };
    parts.push(
      `ملتقى العقول: ${hub.active} جلسات نشطة، ${hub.messages} رسالة، ${hub.executed} إجراء منفَّذ، ${hub.pendingOwner} قرار بانتظار المالك`,
    );
  } catch {
    /* تجاهل */
  }
  try {
    const council = (await ctx.runQuery(api.privateCouncilStore.getStats, {})) as {
      active: number;
      messages: number;
      actions: number;
    };
    parts.push(
      `الغرفة الخاصة: ${council.active} نشطة، ${council.messages} رسالة، ${council.actions} إجراء`,
    );
  } catch {
    /* تجاهل */
  }
  try {
    const suite = (await ctx.runQuery(api.aiSuiteLog.listActivity, { limit: 20 })) as unknown[];
    parts.push(`أنظمة AI الثلاثون: ${suite.length} سجل نشاط حديث`);
  } catch {
    /* تجاهل */
  }
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const errors = (await ctx.runQuery(internal.errorHunterInternal.recentCount, { since })) as number;
    parts.push(`أخطاء التطبيق خلال 24 ساعة: ${errors}`);
  } catch {
    /* تجاهل */
  }
  return parts.join("\n") || "لا توجد بيانات سياق متاحة";
}

export const startShift = action({
  args: {},
  handler: async (ctx): Promise<{ sessionId: string; mission: string }> => {
    const past = (await ctx.runQuery(api.viceOwnerStore.listSessions, { limit: 6 })) as Array<{
      mission?: string;
    }>;
    const { mission, focus } = await chooseOwnFocus(
      past.map((s) => s.mission ?? "").filter(Boolean),
    );
    const sessionId = await ctx.runMutation(internal.viceOwnerStore.insertSession, {
      mission,
      focus,
      maxTurns: 40,
      intervalSec: 15,
      model: "primary",
    });
    await ctx.scheduler.runAfter(3_000, internal.viceOwner.workTurn, { sessionId });
    return { sessionId, mission };
  },
});

export const workTurn = internalAction({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.viceOwnerStore.getSession, { sessionId });
    if (!session || session.status !== "active")
      return { ok: false, reason: "الوردية غير نشطة" };

    const context = await gatherSystemContext(ctx);
    const recentActivity = session.activity
      .slice(-8)
      .map((a) => `[${a.type}] ${a.title}: ${a.detail}`)
      .join("\n");

    let reply: string;
    try {
      let memoryBlock = "";
      try {
        const mems = await recallFor(ctx, "viceOwner", 8);
        if (mems.length)
          memoryBlock = `\n\nذاكرتك الدائمة (خبرتك المتراكمة عبر الورديات):\n${mems.map((m) => `- ${m.content}`).join("\n")}`;
      } catch {
        /* اختيارية */
      }
      reply = await callDeputyPrimary(
        VICE_SYSTEM_PROMPT + memoryBlock,
        `مهمتك الحالية: «${session.mission}»\n\nسياق حي من النظام الآن:\n${context}\n\nسجل أعمالك الأخيرة:\n${recentActivity || "(بداية الوردية)"}\n\nالدورة ${session.turnCount + 1} من ${session.maxTurns} — نفّذ ما تراه مناسباً الآن بحريتك الكاملة وسجّل أعمالك:\n(إن تعلمت درساً جديداً يستحق الحفظ أضف سطراً: [ذاكرة] الدرس)`,
        800,
      );
    } catch (e) {
      await ctx.runMutation(internal.viceOwnerStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      return { ok: false };
    }

    const gradedReply = extractSelfGrade(reply);
    reply = gradedReply.clean;
    await maybeRemember(ctx, "viceOwner", reply);
    if (gradedReply.selfGrade !== undefined && gradedReply.selfGrade <= 5) {
      try {
        const { rememberFor } = await import("./aiUpgradeKit");
        await rememberFor(
          ctx,
          "viceOwner",
          "lesson",
          `تقييمي كان ${gradedReply.selfGrade}/10 — أستوفي أن أكون أدق وأعمق في الدورة القادمة.`,
          5,
        );
      } catch {
        /* اختيارية */
      }
    }

    const deeds = [...reply.matchAll(/(\[فعل\])\s*(.+)/g)].map((m) => m[2].trim());
    const systems = [...reply.matchAll(/(\[نظام\])\s*(.+)/g)].map((m) => m[2].trim());
    const done = session.turnCount + 1 >= session.maxTurns;

    for (const sys of systems.slice(0, 3)) {
      const sp = sys.split("|").map((p) => p.trim());
      await ctx.runMutation(internal.apiHubInternal.registerViceSystem, {
        name: (sp[0] ?? "نظام جديد").slice(0, 120),
        purpose: (sp[1] ?? "").slice(0, 300),
        spec: (sp[2] ?? "").slice(0, 2000),
      });
    }

    if (deeds.length === 0) {
      await ctx.runMutation(internal.viceOwnerStore.logActivity, {
        sessionId,
        type: "exploration",
        title: "تدوينة حرة",
        detail: reply.slice(0, 400),
        severity: "info",
        turnCount: session.turnCount,
        done,
      });
    } else {
      for (const deed of deeds.slice(0, 4)) {
        const parts = deed.split("|").map((p) => p.trim());
        const sev =
          parts[3]?.toLowerCase() === "critical"
            ? "critical"
            : parts[3]?.toLowerCase() === "warning"
              ? "warning"
              : "info";
        await ctx.runMutation(internal.viceOwnerStore.logActivity, {
          sessionId,
          type: parts[0] ?? "decision",
          title: (parts[1] ?? deed).slice(0, 120),
          detail: (parts[2] ?? "").slice(0, 400),
          severity: sev as "info" | "warning" | "critical",
          turnCount: session.turnCount,
          done: false,
        });
      }
      if (done) {
        await ctx.runMutation(internal.viceOwnerStore.setStatus, {
          sessionId,
          status: "ended",
        });
      }
    }

    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.viceOwner.workTurn, {
        sessionId,
      });
    } else {
      await ctx.scheduler.runAfter(15_000, internal.viceOwner.autoRestart, {});
    }
    return { ok: true };
  },
});

export const autoRestart = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    try {
      await ctx.runAction(api.viceOwner.startShift, {});
    } catch (e) {
      console.error(
        "[vice-owner] autoRestart failed:",
        e instanceof Error ? e.message : e,
      );
      await ctx.scheduler.runAfter(120_000, internal.viceOwner.autoRestart, {});
    }
    return { ok: true };
  },
});

export const pauseShift = action({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.viceOwnerStore.setStatus, {
      sessionId,
      status: "paused",
    });
    return { ok: true };
  },
});

export const resumeShift = action({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.viceOwnerStore.setStatus, {
      sessionId,
      status: "active",
    });
    await ctx.scheduler.runAfter(2_000, internal.viceOwner.workTurn, { sessionId });
    return { ok: true };
  },
});
