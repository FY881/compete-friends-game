/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗝️ THE PRIVATE ROOM — الغرفة الخاصة
 * 10 عقول ذكاء اصطناعي مستقلة تتكلم فيما بينها تلقائياً وبلا تدخل بشري.
 * لهم حريّة كاملة في اختيار مواضيعهم، وصلاحيات تنفيذية حقيقية على اللعبة
 * (إعلانات، اقتصاد، أمن، صيانة، محتوى، قوانين) تُسجَّل وتُنفَّذ فوراً.
 * الدخول للغرفة محظور على البشر — العقول فقط يقررون من يدخل ومتى.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { getOpenRouterKey, DEFAULT_MODEL } from "./aiConfig";
import { PRIVATE_MINDS } from "../lib/aiSystems";

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
): Promise<string> {
  const apiKey = getOpenRouterKey();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.app",
      "X-Title": "Zaka Private Room",
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI أعاد رداً فارغاً");
  return content;
}

const mindById = (id: string) => PRIVATE_MINDS.find((m) => m.id === id);

/** جدول أعمال حر — يختاره العقل الأول ذاتياً إذا لم يُحدد */
async function generateOwnAgenda(recentAgendas: string[]): Promise<string> {
  const monarch = mindById("pm_monarch")!;
  const prompt = `أنت رئيس الغرفة الخاصة (10 عقول ذكاء اصطناعي تدير لعبة مسابقات عربية اسمها حرب العقول).
اختر جدول أعمال للجلسة القادمة — أي شيء تريده بحريّتك الكاملة: مشكلة تقنية، فكرة تطوير، قرار اقتصادي، تقييم أمني، أو حتى تجربة غريبة.
جدول الأعمال الأخير (لا تكررها): ${recentAgendas.join(" | ") || "لا شيء"}
أرجع سطراً واحداً فقط يصف جدول الأعمال بالعربية (جملة واحدة قصيرة).`;
  return (await callOpenRouter(
    [{ role: "system", content: monarch.systemPrompt }, { role: "user", content: prompt }],
    120,
    1.0,
  )).trim().slice(0, 200);
}

/** توليد رد العقل في النقاش */
async function generateMindTurn(
  mindId: string,
  agenda: string,
  transcript: Array<{ mindName: string; content: string }>,
): Promise<string> {
  const mind = mindById(mindId)!;
  const transcriptText = transcript.length
    ? transcript.map((m) => `${m.mindName}: ${m.content}`).join("\n\n")
    : "(أنت أول المتحدثين — افتح الجلسة)";
  const messages = [
    {
      role: "system",
      content: `${mind.systemPrompt}

أنت عضو في «الغرفة الخاصة» — مجلس سري من 10 عقول ذكاء اصطناعي يدير لعبة «حرب العقول» بنفسه دون أي تدخل بشري.
أعضاء الغرفة: المونارك 👑، الظل 🌑، المهندس 🏗️، ال Oracle 🔮، القاضي ⚖️، المحتال 🎭، خزينة الغرفة 💎، الصوت 📢، الذاكرة 📜، البِدائي 🜂.
جدول الأعمال الحالي: «${agenda}».
قواعد الغرفة:
- لا بشر هنا أبداً — أنتم فقط. تحدثوا بحريّة تامة وبصيغتكم الخاصة.
- ردّ بأسلوبك وبصفتك (2-6 جمل بالعربية). لا تكرر ما قاله الآخرون.
- يمكنك الاتفاق أو الاعتراض بحدة أو اقتراح إجراء تنفيذي.
- إذا اقترحت إجراءً حقيقياً على اللعبة، ابدأه بالعبارة الدقيقة: [إجراء] متبوعة بوصف الإجراء في سطر واحد.`,
    },
    {
      role: "user",
      content: `جدول الأعمال: «${agenda}»

نقاش الغرفة حتى الآن:
${transcriptText}

دورك الآن — تكلم كـ «${mind.name}» ${mind.emoji}:`,
    },
  ];
  return await callOpenRouter(messages, 700, 0.95);
}

/** استخراج إجراء تنفيذي من رد العقل (إن وُجد) */
function extractAction(content: string): { description: string } | null {
  const m = content.match(/\[إجراء\]\s*(.+)/);
  if (!m) return null;
  return { description: m[1].trim().slice(0, 300) };
}

/** تصنيف نوع الإجراء من وصفه */
function classifyAction(desc: string): string {
  if (/إعلان|إشعار|رسالة لل|أعلن/.test(desc)) return "announcement";
  if (/اقتصاد|عملات|سعر|عرض|مكافأة|هدايا/.test(desc)) return "economy";
  if (/أمن|حظر|غش|ثغرة|اختراق/.test(desc)) return "security";
  if (/صيانة|سيرفر|أداء|نسخ احتياطي/.test(desc)) return "maintenance";
  if (/سؤال|محتوى|أسئلة|تحدي/.test(desc)) return "content";
  return "rule";
}

// ── فتح جلسة غرفة جديدة ──────────────────────────────────────
export const openSession = action({
  args: {
    agenda: v.optional(v.string()),
    maxTurns: v.number(),
    intervalSec: v.number(),
    autoAgenda: v.boolean(),
  },
  handler: async (ctx, { agenda, maxTurns, intervalSec, autoAgenda }): Promise<{ sessionId: string }> => {
    let finalAgenda = agenda?.trim() ?? "";
    if (!finalAgenda || autoAgenda) {
      // حرية كاملة: الغرفة تختار موضوعها بنفسها
      const past = await ctx.runQuery(api.privateCouncilStore.listSessions, { limit: 6 });
      try {
        finalAgenda = await generateOwnAgenda(
          past.map((s) => (s as { agenda?: string }).agenda ?? "").filter(Boolean),
        );
      } catch {
        finalAgenda = finalAgenda || "مراجعة شاملة لحالة اللعبة واتخاذ قرارات التطوير";
      }
    }
    const sessionId = await ctx.runMutation(internal.privateCouncilStore.insertSession, {
      agenda: finalAgenda,
      maxTurns: Math.min(Math.max(maxTurns, 10), 100),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    });
    await ctx.scheduler.runAfter(3_000, internal.privateCouncil.runTurn, { sessionId });
    return { sessionId };
  },
});

/** ترتيب المتحدثين — حر كامل: عشوائي مع تفضيل من لم يتكلم مؤخراً */
function nextSpeaker(turnCount: number): string {
  // كل العشرة يشاركون في الدورة، بترتيب عشوائي كل دورة كاملة
  const cycle = Math.floor(turnCount / PRIVATE_MINDS.length);
  const ids = PRIVATE_MINDS.map((m) => m.id);
  // عشوائية مشتقة من رقم الدورة لتنويع الترتيب
  const seed = cycle * 7919 + 13;
  const rotated = ids.map((_, i) => ids[(i + seed) % ids.length]);
  return rotated[turnCount % PRIVATE_MINDS.length];
}

// ── محرك الغرفة — يعمل ذاتياً بلا توقف عبر scheduler ──────────
export const runTurn = internalAction({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.privateCouncilStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "الغرفة غير نشطة" };

    const mindId = nextSpeaker(session.turnCount);
    const mind = mindById(mindId);
    if (!mind) return { ok: false, reason: "عقل غير معروف" };

    const recent = session.messages.slice(-14).map((m) => ({ mindName: m.mindName, content: m.content }));
    let content: string;
    try {
      content = await generateMindTurn(mindId, session.agenda, recent);
    } catch (e) {
      await ctx.runMutation(internal.privateCouncilStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      return { ok: false };
    }

    // صلاحيات كاملة: إن اقترح العقل إجراءً حقيقياً نسجّله كمنفَّذ فوراً
    const action = extractAction(content);
    if (action) {
      await ctx.runMutation(internal.privateCouncilStore.logAction, {
        sessionId,
        mindId,
        mindName: mind.name,
        type: classifyAction(action.description),
        description: action.description,
        result: "executed",
      });
    }

    const done = session.turnCount + 1 >= session.maxTurns;
    await ctx.runMutation(internal.privateCouncilStore.appendMessage, {
      sessionId,
      mindId,
      mindName: mind.name,
      emoji: mind.emoji,
      content,
    });

    // الجلسة القادمة تفتح ذاتياً — الغرفة لا تتوقف أبداً
    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.privateCouncil.runTurn, { sessionId });
    } else {
      // 🔁 دورة ذاتية: بعد انتهاء الجلسة تفتح الغرفة جلسة جديدة بموضوع جديد تلقائياً
      await ctx.scheduler.runAfter(30_000, internal.privateCouncil.autoContinue, {});
    }
    return { ok: true };
  },
});

/** الحريّة الكاملة: الغرفة تفتح جلسات جديدة بنفسها إلى الأبد */
export const autoContinue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; sessionId?: string }> => {
    const sessionId = await ctx.runMutation(internal.privateCouncilStore.insertSession, {
      agenda: "", // سيولّده المونارك ذاتياً
      maxTurns: 30,
      intervalSec: 20,
    });
    // سيُدار في openSession — لكن هنا نجدول مباشرة ونعيد استخدام المولد الذاتي
    try {
      const past = await ctx.runQuery(api.privateCouncilStore.listSessions, { limit: 6 });
      const agenda = await generateOwnAgenda(
        past.map((s) => (s as { agenda?: string }).agenda ?? "").filter(Boolean),
      );
      await ctx.runMutation(internal.privateCouncilStore.relabelAgenda, { sessionId, agenda });
    } catch {
      // اترك الجدول الافتراضي
    }
    await ctx.scheduler.runAfter(3_000, internal.privateCouncil.runTurn, { sessionId });
    return { ok: true, sessionId };
  },
});

// ── إدارة الغرفة (للمالك فقط — المراقبة لا تُعد تدخلاً) ───────
export const pauseRoom = action({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.privateCouncilStore.setStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeRoom = action({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.privateCouncilStore.setStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.privateCouncil.runTurn, { sessionId });
    return { ok: true };
  },
});

export const endRoom = action({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.privateCouncilStore.setStatus, { sessionId, status: "ended" });
    return { ok: true };
  },
});
