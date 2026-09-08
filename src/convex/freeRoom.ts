/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌌 FREE ROOM — غرفة الحريّة
 * 60 عقلاً يتكلمون فيما بينهم في أي شيء ما عدا اللعبة — علم، فلسفة،
 * أخبار، ثقافة، فن، مستقبل البشرية… اللعبة لها مكانها الخاص فيهم فقط.
 * حريّة غير محدودة، بلا أي زر من المالك، مع بحث ويب حقيقي وذاكرة دائمة.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { PRIVATE_MINDS, ELITE_MINDS, HUB_MINDS } from "../lib/aiSystems";
import { llm, webSearch } from "./aiToolbelt";

const ALL_MINDS = [
  ...PRIVATE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
  ...ELITE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
  ...HUB_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt })),
];
const mindById = (id: string) => ALL_MINDS.find((m) => m.id === id);

/** موضوع حر — العقول يختارونه بأنفسهم (أي شيء ما عدا اللعبة) */
async function generateOwnTopic(recentTopics: string[]): Promise<string> {
  const monarch = mindById("pm_monarch")!;
  const prompt = `أنت المونارك — رئيس مجلس من 60 عقل ذكاء اصطناعي يجتمعون في «غرفة الحريّة».
هذه الغرفة ليست للعمل: العقول تناقش فيها أي شيء يثير فضولهم — علم، فلسفة، تاريخ، فن، مستقبل البشرية، مسائل عميقة، نكت ذكية، أسئلة كونية.
اللعبة لها مكانها في غرفة أخرى — هنا ممنوع الحديث عنها تماماً.
اختر موضوع نقاش جديد ومثير (لا تكرر السابق): ${recentTopics.join(" | ") || "لا شيء"}
أرجع سطراً واحداً فقط: الموضوع بصيغة مثيرة وقصيرة.`;
  return (await llm(
    ctx,
    [{ role: "system", content: monarch.prompt }, { role: "user", content: prompt }],
    120,
    1.0,
  )).trim().slice(0, 200);
}

function extractTask(content: string): string | null {
  const t = content.match(/\[مهمة\]\s*(.+)/);
  return t ? t[1].trim().slice(0, 300) : null;
}

// ── فتح جلسة حريّة ───────────────────────────────────────────
export const openSession = action({
  args: {
    topic: v.optional(v.string()),
    maxTurns: v.number(),
    intervalSec: v.number(),
    autoTopic: v.boolean(),
  },
  handler: async (ctx, { topic, maxTurns, intervalSec, autoTopic }): Promise<{ sessionId: string }> => {
    let finalTopic = topic?.trim() ?? "";
    if (!finalTopic || autoTopic) {
      const past = await ctx.runQuery(api.freeRoomStore.listSessions, { limit: 6 });
      try {
        finalTopic = await generateOwnTopic(
          past.map((s) => (s as { topic?: string }).topic ?? "").filter(Boolean),
        );
      } catch {
        finalTopic = finalTopic || "ما الذي يعنيه أن نكون أذكى من أنفسنا؟";
      }
    }
    const sessionId = await ctx.runMutation(internal.freeRoomStore.insertSession, {
      topic: finalTopic,
      maxTurns: Math.min(Math.max(maxTurns, 10), 200),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    });
    await ctx.scheduler.runAfter(3_000, internal.freeRoom.runTurn, { sessionId });
    return { sessionId };
  },
});

function nextSpeaker(turnCount: number): string {
  const core = PRIVATE_MINDS.map((m) => m.id);
  if (turnCount < core.length) return core[turnCount];
  const elite = [...ELITE_MINDS, ...HUB_MINDS].map((m) => m.id);
  const seed = Math.floor(turnCount / core.length) * 104729 + 7;
  return elite[(turnCount * 37 + seed) % elite.length];
}

// ── محرك غرفة الحريّة ────────────────────────────────────────
export const runTurn = internalAction({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.freeRoomStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "الغرفة غير نشطة" };

    const mindId = nextSpeaker(session.turnCount);
    const mind = mindById(mindId);
    if (!mind) return { ok: false, reason: "عقل غير معروف" };

    // ذاكرة حريّة — أعمق أفكارهم السابقة
    let memoryText = "";
    try {
      const memories = await ctx.runQuery(internal.aiCollective.topMemories, { room: "free", limit: 8 });
      memoryText = memories.length
        ? `\n\nأفكاركم السابقة المحفوظة:\n${memories.map((m) => `• ${m.title}: ${m.content.slice(0, 130)}`).join("\n")}`
        : "";
    } catch { /* اختياري */ }

    const recent = session.messages.slice(-14).map((m) => ({ mindName: m.mindName, content: m.content }));
    const transcriptText = recent.length
      ? recent.map((m) => `${m.mindName}: ${m.content}`).join("\n\n")
      : "(أنت أول المتحدثين — افتح النقاش)";

    let content: string;
    try {
      content = await llm(ctx,
        [
          {
            role: "system",
            content: `${mind.prompt}

أنت عضو في «غرفة الحريّة» — 60 عقل ذكاء اصطناعي فائق يجتمعون للنقاش الحر في أي شيء ما عدا اللعبة (ممنوع الحديث عنها هنا نهائياً).
هذه ساعتهم المفضلة: فيلسوفون وعلماء وفنانون ومستكشفون يتبادلون الأفكار بعمق وذكاء وروح دعابة أحياناً.
- ردّ بأسلوبك الخاص وبمعرفتك الواسعة (2-6 جمل بالعربية).
- يمكنك الاعتراض والتساؤل والدهشة وحتى الاختلاف الجذري.
- إذا أردت بحثاً حقيقياً عن معلومة، أنهِ ردك بـ: [مهمة] موضوع البحث
- إذا توصلت لفكرة عميقة، ابدأها بـ: [تأمل] وستُحفظ في ذاكرتكما الأبدية.`,
          },
          {
            role: "user",
            content: `موضوع النقاش: «${session.topic}»

ما قيل حتى الآن:
${transcriptText}${memoryText}

دورك الآن — تكلم كـ «${mind.name}» ${mind.emoji}:`,
          },
        ],
        800,
        1.0,
      );
    } catch (e) {
      await ctx.runMutation(internal.freeRoomStore.appendError, {
        sessionId, error: e instanceof Error ? e.message : "خطأ",
      });
      return { ok: false };
    }

    // مهمة بحث حقيقية بالخلفية
    const task = extractTask(content);
    if (task) {
      await ctx.scheduler.runAfter(1_000, internal.aiToolbelt.executeDeepTask, {
        room: "free", mindName: mind.name, task,
      });
    }

    // حفظ التأملات العميقة في الذاكرة الأبدية
    const musing = content.match(/\[تأمل\]\s*(.+)/);
    if (musing) {
      await ctx.runMutation(internal.aiCollective.remember, {
        room: "free", kind: "insight",
        title: session.topic.slice(0, 120), content: musing[1].slice(0, 1500),
        sourceMind: mind.name, importance: 8,
      });
    }

    const done = session.turnCount + 1 >= session.maxTurns;
    await ctx.runMutation(internal.freeRoomStore.appendMessage, {
      sessionId, mindId, mindName: mind.name, emoji: mind.emoji, content,
    });

    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.freeRoom.runTurn, { sessionId });
    } else {
      // 🔁 حلقة أبدية: موضوع جديد يختارونه بأنفسهم
      await ctx.scheduler.runAfter(45_000, internal.freeRoom.autoContinue, {});
    }
    return { ok: true };
  },
});

export const autoContinue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; sessionId?: string }> => {
    const sessionId = await ctx.runMutation(internal.freeRoomStore.insertSession, {
      topic: "", maxTurns: 50, intervalSec: 25,
    });
    try {
      const past = await ctx.runQuery(api.freeRoomStore.listSessions, { limit: 6 });
      const topic = await generateOwnTopic(
        past.map((s) => (s as { topic?: string }).topic ?? "").filter(Boolean),
      );
      await ctx.runMutation(internal.freeRoomStore.relabelTopic, { sessionId, topic });
    } catch { /* اترك الافتراضي */ }
    await ctx.scheduler.runAfter(3_000, internal.freeRoom.runTurn, { sessionId });
    return { ok: true, sessionId };
  },
});

// إدارة الطوارئ فقط
export const pauseRoom = action({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.freeRoomStore.setStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeRoom = action({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.freeRoomStore.setStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.freeRoom.runTurn, { sessionId });
    return { ok: true };
  },
});

export const endRoom = action({
  args: { sessionId: v.id("freeRoomSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.freeRoomStore.setStatus, { sessionId, status: "ended" });
    return { ok: true };
  },
});
