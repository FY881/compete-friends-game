/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 MIND HUB — ملتقى العقول (غرفة الحرب + العقل الحر)
 * 80+ عقل ذكاء اصطناعي يتكلمون فيما بينهم عبر المسار الموحّد (مركز API)
 * — غرفة الحرب: إدارة لعبة حرب العقول واتخاذ قرارات تنفيذية
 * — العقل الحر: نقاش مفتوح في العلوم والفكر والفن والكون والحياة
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { PRIVATE_MINDS, EXTENDED_MINDS, ELITE_MINDS, HUB_MINDS } from "../lib/aiSystems";
import { ensureAiRuntime } from "./apiCore";
import { callLlm } from "./aiConfig";

const ALL_MINDS = [
  ...PRIVATE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
  ...EXTENDED_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
  ...ELITE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
  ...HUB_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
];
const mindById = (id: string) => ALL_MINDS.find((m) => m.id === id);

/** موضوع حر — العقول يختارونه بأنفسهم */
async function generateOwnAgenda(ctx: any, room: "war" | "free", recent: string[]): Promise<string> {
  const monarch = mindById("pm_monarch")!;
  const prompt =
    room === "war"
      ? `أنت المونارك — رئيس مجلس من 80 عقل ذكاء اصطناعي في «غرفة الحرب» لملتقى العقول.\nهذه المواضيع نوقشت مؤخراً (لا تكررها): ${recent.join(" | ") || "لا شيء"}\nاختر مهمة إدارية واحدة عملية وذكية للجلسة القادمة في إدارة لعبة حرب العقول (توازن، نمو، أمان، محتوى، تجربة لاعب).\nأرجع سطراً واحداً فقط: المهمة بصيغة واضحة وقصيرة.`
      : `أنت المونارك — رئيس مجلس من 80 عقل ذكاء اصطناعي في «العقل الحر» بملتقى العقول.\nهذه المواضيع نوقشت مؤخراً (لا تكررها): ${recent.join(" | ") || "لا شيء"}\nاختر موضوع نقاش جديد ومثير (علم، فلسفة، فن، كون، حياة — أي شيء خارج اللعبة).\nأرجع سطراً واحداً فقط: الموضوع بصيغة مثيرة وقصيرة.`;
  try {
    const out = (await callLlm(
      [
        { role: "system", content: monarch.prompt },
        { role: "user", content: prompt },
      ],
      120,
      1.0,
      "MindHub Agenda",
    )).trim();
    return out.slice(0, 220) || (room === "war" ? "مراجعة شاملة لحالة اللعبة" : "ما الذي يعنيه أن نكون أذكى من أنفسنا؟");
  } catch {
    return room === "war"
      ? "مراجعة شاملة لحالة لعبة حرب العقول واتخاذ قرارات تنفيذية"
      : "نقاش حر مفتوح — العلوم، الفكر، الفن، الكون، الحياة";
  }
}

function extractTask(content: string): string | null {
  const t = content.match(/\[مهمة\]\s*(.+)/);
  return t ? t[1].trim().slice(0, 300) : null;
}

// ── فتح جلسة ─────────────────────────────────────────────────
export const openSession = action({
  args: {
    room: v.union(v.literal("war"), v.literal("free")),
    maxTurns: v.number(),
    intervalSec: v.number(),
    autoAgenda: v.optional(v.boolean()),
  },
  handler: async (ctx, { room, maxTurns, intervalSec, autoAgenda }) => {
    let agenda =
      room === "war"
        ? "مراجعة شاملة لحالة لعبة حرب العقول واتخاذ قرارات تنفيذية"
        : "نقاش حر مفتوح — العلوم، الفكر، الفن، الكون، الحياة";

    if (autoAgenda !== false) {
      try {
        const past = (await ctx.runQuery(api.mindHubStore.listSessions, { limit: 6 })) as any[];
        agenda = await generateOwnAgenda(
          ctx,
          room,
          past.map((s) => s.agenda ?? "").filter(Boolean),
        );
      } catch {
        /* اترك الافتراضي */
      }
    }

    const sessionId = (await ctx.runMutation(internal.mindHubStore.insertSession, {
      room,
      agenda,
      maxTurns: Math.min(Math.max(maxTurns, 5), 200),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    })) as never;

    // 🔥 المحرك الحي: أول دورة تبدأ بعد 3 ثوانٍ
    await ctx.scheduler.runAfter(3_000, internal.mindHub.runTurn, { sessionId: sessionId as never });
    return { sessionId };
  },
});

/** اختيار المتحدث — العشرة أولاً ثم التوسعة ثم النخبة بتناوب ذكي */
function nextSpeaker(turnCount: number): string {
  const core = PRIVATE_MINDS.map((m) => m.id);
  if (turnCount < core.length) return core[turnCount];
  const extended = [...EXTENDED_MINDS, ...ELITE_MINDS, ...HUB_MINDS].map((m) => m.id);
  const seed = Math.floor(turnCount / core.length) * 104729 + 7;
  return extended[(turnCount * 37 + seed) % extended.length];
}

// ── محرك ملتقى العقول — دورة واحدة ثم تُجدول التالية ─────────
export const runTurn = internalAction({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    await ensureAiRuntime(ctx);
    const session = (await ctx.runQuery(internal.mindHubStore.getSession, { sessionId })) as any;
    if (!session || session.status !== "active") return { ok: false, reason: "الجلسة غير نشطة" };

    const mindId = nextSpeaker(session.turnCount);
    const mind = mindById(mindId);
    if (!mind) return { ok: false, reason: "عقل غير معروف" };

    const isWar = session.room === "war";
    const recent = (session.messages as { mindName: string; content: string }[]).slice(-14);
    const transcriptText = recent.length
      ? recent.map((m) => `${m.mindName}: ${m.content}`).join("\n\n")
      : "(أنت أول المتحدثين — افتح النقاش)";

    const roomIntro = isWar
      ? `أنت عضو في «غرفة الحرب» بملتقى العقول — 80 عقل ذكاء اصطناعي يديرون لعبة «حرب العقول» ويقررون تنفيذياً.
الموضوع الحالي: ${session.agenda}
- تحدث بدورك (2-6 جمل بالعربية) بأسلوبك الخاص وبخبرتك.
- إن كان لديك قرار تنفيذي واضح، ابدأه بـ: [قرار] وصف القرار — سيُرفع للمالك للاعتماد.
- إن احتجت تحققاً أو بحثاً، أنهِ بـ: [مهمة] ما تريد فحصه`
      : `أنت عضو في «العقل الحر» بملتقى العقول — 80 عقل ذكاء اصطناعي فائق يتناقشون بحرية في أي شيء خارج اللعبة (ممنوع الحديث عنها).
- تحدث بدورك (2-6 جمل بالعربية) بعمق وأصالة وروح دعابة أحياناً.
- يمكنك الاعتراض والتساؤل والدهشة والاختلاف الجذري.
- إن احتجت بحثاً حقيقياً، أنهِ بـ: [مهمة] موضوع البحث`;

    let content: string;
    try {
      content = await callLlm(
        [
          { role: "system", content: `${mind.prompt}\n\n${roomIntro}` },
          {
            role: "user",
            content: `${isWar ? "المهمة" : "موضوع النقاش"}: «${session.agenda}»

ما قيل حتى الآن:
${transcriptText}

دورك الآن — تكلم كـ «${mind.name}» ${mind.emoji}:`,
          },
        ],
        800,
        1.0,
        `MindHub Turn — ${mind.name}`,
      );
    } catch (e) {
      await ctx.runMutation(internal.mindHubStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      // أعد المحاولة بعد فترة — لا تتوقف الجلسة بفشل دورة واحدة
      await ctx.scheduler.runAfter(30_000, internal.mindHub.runTurn, { sessionId });
      return { ok: false, reason: "فشل الاستدعاء" };
    }

    // مهمة بحث/فحص حقيقية بالخلفية (إن طلبها العقل)
    const task = extractTask(content);
    if (task) {
      try {
        await ctx.scheduler.runAfter(1_000, internal.aiToolbelt.executeDeepTask, {
          room: isWar ? "private" : "free",
          mindName: mind.name,
          task,
        });
      } catch {
        /* اختياري */
      }
    }

    // قرار تنفيذي في غرفة الحرب — يُسجل بانتظار المالك
    if (isWar) {
      const decision = content.match(/\[قرار\]\s*(.+)/);
      if (decision) {
        try {
          await ctx.runMutation(internal.mindHubStore.logAction, {
            sessionId,
            mindId,
            mindName: mind.name,
            type: "decision",
            description: decision[1].trim().slice(0, 400),
            result: "pending-owner",
          });
        } catch {
          /* اختياري */
        }
      }
    }

    const done = (session.turnCount as number) + 1 >= (session.maxTurns as number);
    await ctx.runMutation(internal.mindHubStore.appendMessage, {
      sessionId,
      mindId,
      mindName: mind.name,
      emoji: mind.emoji,
      content,
    });

    if (!done) {
      await ctx.scheduler.runAfter(
        (session.intervalSec as number) * 1000,
        internal.mindHub.runTurn,
        { sessionId },
      );
    }
    return { ok: true };
  },
});

// ── إدارة الجلسة ─────────────────────────────────────────────
export const pauseSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.mindHub.runTurn, { sessionId });
    return { ok: true };
  },
});

export const endSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "ended" });
    return { ok: true };
  },
});

/** ملتقى عقول موسّع — 80 عقل في جلسة واحدة */
export const openExpandedSession = action({
  args: {
    room: v.union(v.literal("war"), v.literal("free")),
    maxTurns: v.number(),
    intervalSec: v.number(),
  },
  handler: async (ctx, { room, maxTurns, intervalSec }) => {
    let agenda =
      room === "war"
        ? "مراجعة شاملة لحالة لعبة حرب العقول واتخاذ قرارات تنفيذية — بحضور 80 عقلًا"
        : "نقاش حر مفتوح — العلوم، الفكر، الفن، الكون، الحياة — بحضور 80 عقلًا";
    try {
      const past = (await ctx.runQuery(api.mindHubStore.listSessions, { limit: 6 })) as any[];
      agenda = await generateOwnAgenda(
        ctx,
        room,
        past.map((s) => s.agenda ?? "").filter(Boolean),
      );
    } catch {
      /* اترك الافتراضي */
    }
    const sessionId = (await ctx.runMutation(internal.mindHubStore.insertSession, {
      room,
      agenda,
      maxTurns: Math.min(Math.max(maxTurns, 5), 200),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    })) as never;
    await ctx.scheduler.runAfter(3_000, internal.mindHub.runTurn, { sessionId: sessionId as never });
    return { sessionId };
  },
});
