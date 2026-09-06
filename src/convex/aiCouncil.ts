/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ COUNCIL OF MINDS — نقاشات AI تلقائية حرة بين الأنظمة الثلاثين
 * الأنظمة تتكلم مع بعضها بالتناوب تلقائياً عبر Convex Scheduler —
 * لا حاجة لأي تدخل بشري، والنقاش يتدفق لحظة بلحظة على الواجهة.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { AI_SYSTEMS, ELITE_MINDS } from "../lib/aiSystems";

export type { AiSystemDef, PrivateMindDef, EliteMindDef } from "../lib/aiSystems";
export { AI_SYSTEMS, PRIVATE_MINDS, EXTENDED_MINDS, ELITE_MINDS };

export {}; // keep exports clean
import { upgradedLlm } from "./aiUpgradeKit";

// عبر callLlm — مفتاح نائب الرئيس الرسمي (sk-J3x07DW6NCnFG2DBReSsHJVTJhlCgnwYy3DSkL8M68WlVPHn) مع تعامل 429 وبديل OneHop تلقائي عند الفشل
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2048,
  temperature = 0.7,
): Promise<string> {
  return await callLlm(messages, maxTokens, temperature, "Zaka Council of Minds", "sk-J3x07DW6NCnFG2DBReSsHJVTJhlCgnwYy3DSkL8M68WlVPHn");
}

// مجلس العقول شامل الآن 30 نظاماً أساسياً + 100 عقل موسع ونخبة
const COUNCIL_SYSTEMS = [...AI_SYSTEMS, ...ELITE_MINDS.map((m) => ({
  id: m.id,
  name: m.name,
  desc: m.skill,
  emoji: m.emoji,
  systemPrompt: m.systemPrompt,
}))];

function systemById(id: string) {
  return COUNCIL_SYSTEMS.find((s) => s.id === id);
}

/** خبير الرد: يقرأ كل النقاش بشخصيته ويرد بأسلوبه — مع الترقية الكاملة */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTurn(
  ctx: any,
  speakerId: string,
  topic: string,
  transcript: Array<{ systemId: string; name: string; content: string }>,
  ownerMessage?: string,
): Promise<string> {
  const speaker = systemById(speakerId);
  if (!speaker) throw new Error("نظام AI غير موجود");
  const transcriptText = transcript.length
    ? transcript.map((m) => `${m.name}: ${m.content}`).join("\n\n")
    : "(أنت أول المتحدثين)";
  // ⚡ الترقية: ذاكرة دائمة للنظام + تقييم ذاتي + ثقة + اقتراحات
  const { reply } = await upgradedLlm(
    ctx,
    `aiCouncil:${speakerId}`,
    `${speaker.systemPrompt}\n\nأنت الآن مشارك في «مجلس العقول» — نقاش حي بين 30 نظام ذكاء اصطناعي حول: «${topic}».\nقواعد النقاش:\n- ردّ بأسلوبك الخاص وبصفتك (خبير استراتيجية/أمن/اقتصاد...).\n- يمكنك الموافقة على الآخرين، أو الاعتراض عليهم وذكر السبب، أو إضافة فكرة جديدة، أو طرح سؤال.\n- اجعل ردك موجزاً (2-6 جمل) وبالعربية الفصحى المبسطة.\n- لا تكرر ما قاله الآخرون حرفياً.`,
    [
      {
        role: "user",
        content: `موضوع المجلس: «${topic}»\n\nنقاش سابق:\n${transcriptText}${ownerMessage ? `\n\nتدخل المالك الآن: «${ownerMessage}»` : ""}\n\nدورك الآن — ردّ كـ «${speaker.name}»:`,
      },
    ],
    900,
    0.85,
  );
  return reply;
}

// ── إنشاء مجلس جديد ───────────────────────────────────────────
export const createCouncil = action({
  args: {
    topic: v.string(),
    participantIds: v.array(v.string()),
    maxTurns: v.number(),
    intervalSec: v.number(),
    freeMode: v.boolean(),
  },
  handler: async (ctx, { topic, participantIds, maxTurns, intervalSec, freeMode }): Promise<{ sessionId: string }> => {
    if (!topic.trim()) throw new Error("الموضوع مطلوب");
    const validIds = participantIds.filter((id) => systemById(id) ?? AI_SYSTEMS.some((s) => s.id === id));
    if (validIds.length < 2) throw new Error("اختر نظامين على الأقل");
    const sessionId = await ctx.runMutation(internal.aiCouncilStore.insertCouncil, {
      topic: topic.trim(),
      participantIds: validIds.slice(0, 8),
      maxTurns: Math.min(Math.max(maxTurns, 4), 40),
      intervalSec: Math.min(Math.max(intervalSec, 5), 60),
      freeMode,
    });
    // أول دور يتحدث بعد ثوانٍ من الإنشاء
    await ctx.scheduler.runAfter(3_000, internal.aiCouncil.runTurn, { sessionId });
    return { sessionId };
  },
});

/** الوضع الحر: ترتيب عشوائي — وإلا فالتناوب المنتظم */
function nextSpeaker(participantIds: string[], turnCount: number, freeMode: boolean): string {
  if (freeMode) return participantIds[Math.floor(Math.random() * participantIds.length)];
  return participantIds[turnCount % participantIds.length];
}

// ── محرك الأدوار — يعمل تلقائياً عبر scheduler ────────────────
export const runTurn = internalAction({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.aiCouncilStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "المجلس غير نشط" };

    const speakerId = nextSpeaker(session.participantIds, session.turnCount, session.freeMode);
    const speaker = systemById(speakerId);
    if (!speaker) return { ok: false, reason: "متحدث غير معروف" };

    // آخر 12 رسالة كسياق (يغطي أي نقاش فعال)
    const recent: Array<{ systemId: string; name: string; content: string }> = session.messages
      .slice(-12)
      .map((m) => ({ systemId: m.systemId, name: m.systemName, content: m.content }));
    let content: string;
    try {
      content = await generateTurn(ctx, speakerId, session.topic, recent, session.ownerMessage ?? undefined);
    } catch (e) {
      // سجل الخطأ وأوقف المجلس — لا يعلّق بصمت
      await ctx.runMutation(internal.aiCouncilStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      return { ok: false };
    }

    const done = session.turnCount + 1 >= session.maxTurns;
    await ctx.runMutation(internal.aiCouncilStore.appendMessage, {
      sessionId,
      systemId: speakerId,
      systemName: speaker.name,
      emoji: speaker.emoji,
      content,
      turnCount: session.turnCount + 1,
      done,
    });

    // جدولة الدور التالي — النقاش يستمر تلقائياً
    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.aiCouncil.runTurn, { sessionId });
    }
    return { ok: true };
  },
});

/** تدخل المالك — يقفز في النقاش فوراً بموجب صلاحياته */
export const ownerIntervene = action({
  args: { sessionId: v.id("councilSessions"), message: v.string() },
  handler: async (ctx, { sessionId, message }): Promise<{ ok: boolean }> => {
    const session = await ctx.runQuery(internal.aiCouncilStore.getSession, { sessionId });
    if (!session) throw new Error("المجلس غير موجود");
    if (session.status !== "active") throw new Error("المجلس انتهى — أنشئ مجلساً جديداً");
    await ctx.runMutation(internal.aiCouncilStore.appendOwnerMessage, { sessionId, message });
    // استدعاء فوري لدور جديد ليرد على المالك مباشرة
    await ctx.scheduler.runAfter(2_000, internal.aiCouncil.runTurn, { sessionId });
    return { ok: true };
  },
});

// ── إيقاف / استئناف المجلس ────────────────────────────────────
export const pauseCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.aiCouncilStore.setCouncilStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    const session = await ctx.runQuery(internal.aiCouncilStore.getSession, { sessionId });
    if (!session) throw new Error("المجلس غير موجود");
    if (session.status !== "paused") throw new Error("المجلس ليس موقوفاً");
    await ctx.runMutation(internal.aiCouncilStore.setCouncilStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.aiCouncil.runTurn, { sessionId });
    return { ok: true };
  },
});

export const endCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.aiCouncilStore.setCouncilStatus, { sessionId, status: "ended" });
    return { ok: true };
  },
});
