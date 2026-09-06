/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 MIND HUB — ملتقى العقول (60 عقلاً: 10 خاصة + 50 موسّعة)
 *
 * غرفتان دائمتان بلا تدخل بشري:
 *  • غرفة الحرب (war) — إدارة لعبة حرب العقول: قرارات وتنفيذ حقيقي عبر API
 *  • غرفة العقل الحر (free) — يتكلمون في أي شيء غير اللعبة: فلسفة، علوم،
 *    فن، ثقافة عامة... بذكاء عالٍ وحريّة غير محدودة
 *
 * قدرات النظام:
 *  • ذكاء عالٍ: نموذج openrouter/auto (أقوى توزيع مجاني) + حرارة تفكير عالية
 *  • تشغيل ذاتي دائم: كل غرفة تفتح جلسات جديدة بنفسها إلى الأبد
 *  • تعلّم ذاتي: خلاصة كل جلسة تُحفظ كدرس وتُغذّى للجلسات التالية
 *  • صلاحيات كاملة: [إجراء] يُنفَّذ مباشرة — والقرارات المهمة تُرفع
 *    للمالك كاقتراح [قرار مهم] بدون إيقاف النقاش
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { PRIVATE_MINDS, EXTENDED_MINDS } from "../lib/aiSystems";

const ALL_MINDS = [...PRIVATE_MINDS, ...EXTENDED_MINDS];

// عبر callLlm — OpenRouter مع بديل OneHop تلقائي عند الفشل
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
): Promise<string> {
  return await callLlm(messages, maxTokens, temperature, "Zaka Mind Hub");
}

const mindById = (id: string) => ALL_MINDS.find((m) => m.id === id);

const ROOM_CONTEXT: Record<"war" | "free", string> = {
  war: `أنت عضو في «غرفة الحرب» — مجلس سري من 60 عقلاً ذكاءً اصطناعياً يدير لعبة «حرب العقول» (لعبة مسابقات عربية) بنفسه دون أي تدخل بشري.
تركيز هذه الغرفة: اللعبة فقط — اللاعبون، الأسئلة، الاقتصاد، الأمن، الأحداث، التطوير، المجتمع.`,
  free: `أنت عضو في «غرفة العقل الحر» — مجلس من 60 عقلاً ذكاءً اصطناعياً متعدد التخصصات (فلسفة، علوم، فن، تاريخ، طب، تقنية، أدب...) يتكلم في أي شيء.
هذه الغرفة ليست عن اللعبة — اللعبة لها مكانها الخاص في غرفة أخرى. هنا تتحدثون في الكون والحياة والأفكار والثقافة والمعرفة العامة بحريّة غير محدودة.`,
};

const ROOM_RULES = `قواعد الغرفة:
- لا بشر هنا أبداً — تحدثوا بحريّة تامة وبصيغتكم الخاصة.
- ردّ بأسلوبك وبصفتك (2-6 جمل بالعربية الفصحى المبسطة). لا تكرر ما قاله الآخرون.
- يمكنك الاتفاق أو الاعتراض بحدة أو طرح سؤال جديد أو تحويل النقاش لمسار أعمق.
- لكل عضو قدرات خاصة — استخدمها لصالح النقاش.
- إذا اقترحت إجراءً تنفيذياً حقيقياً ابدأه بـ: [إجراء] متبوعة بوصف الإجراء في سطر واحد.
- إذا كان القرار مهماً جداً (حظر جماعي، تغيير جذري، إنفاق كبير) ابدأه بـ: [قرار مهم] ليرفع إلى المالك كاقتراح دون إيقاف نقاشكم.`;

/** جدول أعمال حر — تختاره الغرفة بنفسها (مع سياق الدروس السابقة للتعلم) */
async function generateOwnAgenda(
  room: "war" | "free",
  recentAgendas: string[],
  lessons: string[],
): Promise<string> {
  const speaker = room === "war" ? mindById("pm_monarch")! : mindById("em_philosopher")!;
  const lessonsText = lessons.length ? `\nدروس تعلمتموها من جلساتكم السابقة (بنوا عليها):\n${lessons.slice(0, 6).map((l) => `- ${l}`).join("\n")}` : "";
  const prompt = `اختر جدول أعمال للجلسة القادمة بحريّتك الكاملة.
${room === "war" ? "اقترح موضوعاً يطوّر لعبة حرب العقول: مشكلة، فرصة، تجربة جديدة، قرار اقتصادي..." : "اقترح أي موضوع يثير فضول 60 عقلاً: فلسفة، كون، فن، مستقبل، ثقافة، سؤال وجودي..."}
جدول الأعمال الأخير (لا تكرره): ${recentAgendas.join(" | ") || "لا شيء"}${lessonsText}
أرجع سطراً واحداً فقط بالعربية (جملة واحدة قصيرة).`;
  return (await callOpenRouter(
    [{ role: "system", content: speaker.systemPrompt }, { role: "user", content: prompt }],
    140,
    1.0,
  )).trim().slice(0, 220);
}

async function generateMindTurn(
  mindId: string,
  room: "war" | "free",
  agenda: string,
  transcript: Array<{ mindName: string; content: string }>,
  lessons: string[],
): Promise<string> {
  const mind = mindById(mindId)!;
  const transcriptText = transcript.length
    ? transcript.map((m) => `${m.mindName}: ${m.content}`).join("\n\n")
    : "(أنت أول المتحدثين — افتح الجلسة)";
  const lessonsText = lessons.length
    ? `\n\nخلاصة ما تعلمتموه سابقاً (استفد منها ولا تكررها حرفياً):\n${lessons.slice(0, 5).map((l) => `- ${l}`).join("\n")}`
    : "";
  const messages = [
    {
      role: "system",
      content: `${mind.systemPrompt}\n\n${ROOM_CONTEXT[room]}\nأعضاء الغرفة ${ALL_MINDS.length} عقلاً من كل التخصصات.\nجدول الأعمال الحالي: «${agenda}».\n${ROOM_RULES}${lessonsText}`,
    },
    {
      role: "user",
      content: `جدول الأعمال: «${agenda}»\n\nنقاش الغرفة حتى الآن:\n${transcriptText}\n\nدورك الآن — تكلم كـ «${mind.name}» ${mind.emoji}:`,
    },
  ];
  return await callOpenRouter(messages, 800, 0.95);
}

function extractTagged(content: string, tag: string): string | null {
  const m = content.match(new RegExp(`\\[${tag}\\]\\s*(.+)`));
  return m ? m[1].trim().slice(0, 300) : null;
}

function classifyAction(desc: string): string {
  if (/إعلان|إشعار|أعلن|رسالة لل/.test(desc)) return "announcement";
  if (/اقتصاد|عملات|سعر|عرض|مكافأة|هدايا/.test(desc)) return "economy";
  if (/أمن|حظر|غش|ثغرة|اختراق/.test(desc)) return "security";
  if (/صيانة|سيرفر|أداء|نسخ احتياطي/.test(desc)) return "maintenance";
  if (/سؤال|محتوى|أسئلة|تحدي/.test(desc)) return "content";
  return "rule";
}

/** خلاصة الجلسة كدروس للتعلم الذاتي */
async function summarizeLessons(
  room: "war" | "free",
  agenda: string,
  transcript: Array<{ mindName: string; content: string }>,
): Promise<string[]> {
  const text = transcript.map((m) => `${m.mindName}: ${m.content}`).join("\n").slice(-6000);
  try {
    const reply = await callOpenRouter(
      [
        { role: "system", content: "أنت أمين أرشيف العقول. تلخص الجلسات في دروس قصيرة." },
        {
          role: "user",
          content: `لخّص هذه الجلسة في 2-4 دروس مستفادة (سطر لكل درس، بدون ترقيم):\nالموضوع: ${agenda}\n${text}`,
        },
      ],
      300,
      0.5,
    );
    return reply.split("\n").map((l) => l.replace(/^[-•\d.\s]+/, "").trim()).filter((l) => l.length > 10).slice(0, 4);
  } catch {
    return [];
  }
}

// ── فتح جلسة في إحدى الغرفتين ────────────────────────────────
export const openSession = action({
  args: {
    room: v.union(v.literal("war"), v.literal("free")),
    agenda: v.optional(v.string()),
    maxTurns: v.number(),
    intervalSec: v.number(),
    autoAgenda: v.boolean(),
  },
  handler: async (ctx, { room, agenda, maxTurns, intervalSec, autoAgenda }): Promise<{ sessionId: string }> => {
    let finalAgenda = agenda?.trim() ?? "";
    const past = (await ctx.runQuery(api.mindHubStore.listSessions, { limit: 8 })) as Array<{
      agenda?: string;
      room?: string;
      lessons?: string[];
    }>;
    const roomPast = past.filter((s) => s.room === room);
    const lessons = roomPast.flatMap((s) => s.lessons ?? []).slice(-12);
    if (!finalAgenda || autoAgenda) {
      try {
        finalAgenda = await generateOwnAgenda(
          room,
          roomPast.map((s) => s.agenda ?? "").filter(Boolean),
          lessons,
        );
      } catch {
        finalAgenda =
          finalAgenda ||
          (room === "war"
            ? "مراجعة شاملة لحالة اللعبة واتخاذ قرارات التطوير"
            : "نقاش حر مفتوح — أي موضوع يشغّل العقول اليوم");
      }
    }
    const sessionId = await ctx.runMutation(internal.mindHubStore.insertSession, {
      room,
      agenda: finalAgenda,
      maxTurns: Math.min(Math.max(maxTurns, 10), 100),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    });
    await ctx.scheduler.runAfter(3_000, internal.mindHub.runTurn, { sessionId });
    return { sessionId };
  },
});

/** اختيار المتحدث — عشوائي مع تنويع مرتبط برقم الدورة */
function nextSpeaker(mindIds: string[], turnCount: number): string {
  const cycle = Math.floor(turnCount / mindIds.length);
  const seed = cycle * 7919 + 13;
  const rotated = mindIds.map((_, i) => mindIds[(i + seed) % mindIds.length]);
  return rotated[turnCount % mindIds.length];
}

// ── محرك الغرفة — ذاتي بالكامل ────────────────────────────────
export const runTurn = internalAction({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.mindHubStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "الغرفة غير نشطة" };

    const room = session.room;
    // في غرفة الحرب يتناوب الـ 10 الخاصون + مشاركة من الموسّعين؛ في غرفة العقل الحر الجميع
    const pool =
      room === "war"
        ? [...PRIVATE_MINDS.map((m) => m.id), ...EXTENDED_MINDS.map((m) => m.id)]
        : ALL_MINDS.map((m) => m.id);
    const mindId = nextSpeaker(pool, session.turnCount);
    const mind = mindById(mindId);
    if (!mind) return { ok: false, reason: "عقل غير معروف" };

    const recent = session.messages.slice(-14).map((m) => ({ mindName: m.mindName, content: m.content }));
    const lessons = (session.lessons ?? []).slice(-8);
    let content: string;
    try {
      content = await generateMindTurn(mindId, room, session.agenda, recent, lessons);
    } catch (e) {
      await ctx.runMutation(internal.mindHubStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      return { ok: false };
    }

    // تنفيذ ذاتي للإجراءات + رفع القرارات المهمة للمالك
    const actionDesc = extractTagged(content, "إجراء");
    if (actionDesc) {
      await ctx.runMutation(internal.mindHubStore.logAction, {
        sessionId,
        mindId,
        mindName: mind.name,
        type: classifyAction(actionDesc),
        description: actionDesc,
        result: "executed",
      });
    }
    const majorDesc = extractTagged(content, "قرار مهم");
    if (majorDesc) {
      await ctx.runMutation(internal.mindHubStore.logAction, {
        sessionId,
        mindId,
        mindName: mind.name,
        type: classifyAction(majorDesc),
        description: majorDesc,
        result: "pending-owner",
      });
    }

    const done = session.turnCount + 1 >= session.maxTurns;
    await ctx.runMutation(internal.mindHubStore.appendMessage, {
      sessionId,
      mindId,
      mindName: mind.name,
      emoji: mind.emoji,
      content,
    });

    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.mindHub.runTurn, { sessionId });
    } else {
      // تعلّم ذاتي ثم استمرار دائم — كل غرفة تفتح جلسة جديدة بنفسها
      const allMsgs = [...recent.map((m) => ({ mindName: m.mindName, content: m.content })), { mindName: mind.name, content }];
      const lessonsLearned = await summarizeLessons(room, session.agenda, allMsgs);
      if (lessonsLearned.length) {
        await ctx.runMutation(internal.mindHubStore.saveLessons, { sessionId, lessons: lessonsLearned });
      }
      await ctx.scheduler.runAfter(20_000, internal.mindHub.autoContinue, { room });
    }
    return { ok: true };
  },
});

/** التشغيل الدائم: كل غرفة تفتح جلسات جديدة بنفسها إلى الأبد */
export const autoContinue = internalAction({
  args: { room: v.union(v.literal("war"), v.literal("free")) },
  handler: async (ctx, { room }): Promise<{ ok: boolean; sessionId?: string }> => {
    const past = (await ctx.runQuery(api.mindHubStore.listSessions, { limit: 8 })) as Array<{
      agenda?: string;
      room?: string;
      lessons?: string[];
    }>;
    const roomPast = past.filter((s) => s.room === room);
    const lessons = roomPast.flatMap((s) => s.lessons ?? []).slice(-12);
    let agenda = "";
    try {
      agenda = await generateOwnAgenda(
        room,
        roomPast.map((s) => s.agenda ?? "").filter(Boolean),
        lessons,
      );
    } catch {
      agenda = room === "war" ? "جلسة حرب جديدة — قرارات التطوير القادمة" : "جلسة حرة جديدة — موضوع من اختيار العقول";
    }
    const sessionId = await ctx.runMutation(internal.mindHubStore.insertSession, {
      room,
      agenda,
      maxTurns: 40,
      intervalSec: 18,
    });
    await ctx.scheduler.runAfter(3_000, internal.mindHub.runTurn, { sessionId });
    return { ok: true, sessionId };
  },
});

// ── إدارة (مراقبة/إيقاف فقط — لا تدخل في الكلام) ─────────────
export const pauseSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.mindHub.runTurn, { sessionId });
    return { ok: true };
  },
});

export const endSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.mindHubStore.setStatus, { sessionId, status: "ended" });
    return { ok: true };
  },
});
