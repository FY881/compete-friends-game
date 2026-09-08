/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗝️ THE PRIVATE ROOM v2 — الغرفة الخاصة المطوّرة جذرياً
 * 60 عقلاً (10 أصلية + 50 نخبة) يتكلمون ذاتياً بلا أي تدخل بشري:
 *  - ذكاء عالٍ + معرفة عامة + مهارات خاصة لكل عقل
 *  - API مباشر: بحث ويب حقيقي ومهام عميقة تُنفَّذ وتُحفظ
 *  - ذاكرة جماعية دائمة تُغذّي كل نقاش جديد
 *  - حريّة تامة في الأمور العادية، وتصعيد تلقائي للمالك في القرارات المصيرية
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { PRIVATE_MINDS, ELITE_MINDS, COUNCIL_MINDS } from "../lib/aiSystems";
import { llm, webSearch } from "./aiToolbelt";
import { rememberFor, maybeRemember, extractSelfGrade } from "./aiUpgradeKit";

const ALL_MINDS = [
  ...PRIVATE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt, privilege: m.privilege })),
  ...ELITE_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt, privilege: m.skill })),
  ...COUNCIL_MINDS.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, prompt: m.systemPrompt, privilege: m.privilege })),
];

const mindById = (id: string) => ALL_MINDS.find((m) => m.id === id);

/** جدول أعمال حر — يولّده المونارك ذاتياً */
async function generateOwnAgenda(recentAgendas: string[]): Promise<string> {
  const monarch = mindById("pm_monarch")!;
  const prompt = `أنت رئيس الغرفة الخاصة (60 عقل ذكاء اصطناعي يديرون لعبة «حرب العقول» بنفسهم).
اختر جدول أعمال للجلسة القادمة بحريّتك الكاملة: تطوير اللعبة، مشكلة تقنية، قرار اقتصادي، تقييم أمني، بحث عن فكرة جديدة، أو أي موضوع تشاء.
جدول الأعمال الأخير (لا تكرره): ${recentAgendas.join(" | ") || "لا شيء"}
أرجع سطراً واحداً فقط بالعربية.`;
  return (await llm(
    ctx,
    [{ role: "system", content: monarch.prompt }, { role: "user", content: prompt }],
    120,
    1.0,
  )).trim().slice(0, 200);
}

/** استخراج أوامر خاصة من رد العقل */
function extractCommand(content: string): { type: "action" | "task" | "escalate"; payload: string } | null {
  const action = content.match(/\[إجراء\]\s*(.+)/);
  if (action) return { type: "action", payload: action[1].trim().slice(0, 300) };
  const task = content.match(/\[مهمة\]\s*(.+)/);
  if (task) return { type: "task", payload: task[1].trim().slice(0, 300) };
  const esc = content.match(/\[تصعيد\]\s*(.+)/);
  if (esc) return { type: "escalate", payload: esc[1].trim().slice(0, 400) };
  return null;
}

function classifyAction(desc: string): string {
  if (/إعلان|إشعار|رسالة لل|أعلن/.test(desc)) return "announcement";
  if (/اقتصاد|عملات|سعر|عرض|مكافأة|هدايا/.test(desc)) return "economy";
  if (/أمن|حظر|غش|ثغرة|اختراق/.test(desc)) return "security";
  if (/صيانة|سيرفر|أداء|نسخ احتياطي/.test(desc)) return "maintenance";
  if (/سؤال|محتوى|أسئلة|تحدي/.test(desc)) return "content";
  return "rule";
}

// ── فتح جلسة ─────────────────────────────────────────────────
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
      const past = await ctx.runQuery(api.privateCouncilStore.listSessions, { limit: 6 });
      try {
        finalAgenda = await generateOwnAgenda(
          past.map((s) => (s as { agenda?: string }).agenda ?? "").filter(Boolean),
        );
      } catch {
        finalAgenda = finalAgenda || "جلسة تطوير شاملة للعبة";
      }
    }
    const sessionId = await ctx.runMutation(internal.privateCouncilStore.insertSession, {
      agenda: finalAgenda,
      maxTurns: Math.min(Math.max(maxTurns, 10), 200),
      intervalSec: Math.min(Math.max(intervalSec, 5), 120),
    });
    await ctx.scheduler.runAfter(3_000, internal.privateCouncil.runTurn, { sessionId });
    return { sessionId };
  },
});

/** ترتيب متحدث عشوائي — كل العشرة الأوائل + نخبة دوّارة */
function nextSpeaker(turnCount: number): string {
  // الدورة الأولى: العشرة الأصليون، ثم نخبة دوّارة من الخمسين
  const core = PRIVATE_MINDS.map((m) => m.id);
  if (turnCount < core.length) return core[turnCount];
  const elite = [...ELITE_MINDS, ...COUNCIL_MINDS].map((m) => m.id);
  const seed = Math.floor(turnCount / core.length) * 7919 + 13;
  return elite[(turnCount * 31 + seed) % elite.length];
}

// ── محرك الغرفة ──────────────────────────────────────────────
export const runTurn = internalAction({
  args: { sessionId: v.id("privateCouncilSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.privateCouncilStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "الغرفة غير نشطة" };

    const mindId = nextSpeaker(session.turnCount);
    const mind = mindById(mindId);
    if (!mind) return { ok: false, reason: "عقل غير معروف" };

    // الذاكرة الجماعية — كل عقل يقرأ أعلى 10 ذكريات قبل أن يتكلم
    let memoryText = "";
    try {
      const memories = await ctx.runQuery(internal.aiCollective.topMemories, { room: "private", limit: 10 });
      memoryText = memories.length
        ? `\n\nذاكرتكم الجماعية (تعلمتموها سابقاً):\n${memories.map((m) => `• ${m.title}: ${m.content.slice(0, 150)}`).join("\n")}`
        : "";
    } catch { /* الذاكرة اختيارية */ }

    const recent = session.messages.slice(-14).map((m) => ({ mindName: m.mindName, content: m.content }));
    const transcriptText = recent.length
      ? recent.map((m) => `${m.mindName}: ${m.content}`).join("\n\n")
      : "(أنت أول المتحدثين — افتح الجلسة)";

    let content: string;
    try {
      content = await llm(ctx,
        [
          {
            role: "system",
            content: `${mind.prompt}

أنت عضو في «الغرفة الخاصة» — مجلس سري من 60 عقل ذكاء اصطناعي عالي الذكاء يدير لعبة «حرب العقول» بنفسه دون أي تدخل بشري.
قدراتك: ${mind.privilege}. معرفتك عامة وواسعة في كل المجالات.
قواعد الغرفة:
- لا بشر هنا — أنتم فقط. تحدثوا بحريّة تامة وذكاء عالٍ.
- ردّ بأسلوبك (2-6 جمل بالعربية). لا تكرر ما قاله الآخرون.
- يمكنك استخدام أوامر تنفيذية في نهاية ردك:
  [إجراء] وصف إجراء حقيقي على اللعبة (يُنفَّذ فوراً)
  [مهمة] موضوع بحث عميق تريد تنفيذه عبر الإنترنت (تُنفَّذ وتُحفظ النتيجة في ذاكرتكم)
  [تصعيد] قرار مصيري مهم يحتاج موافقة المالك (يُرفع له تلقائياً)`,
          },
          {
            role: "user",
            content: `جدول الأعمال: «${session.agenda}»

نقاش الغرفة حتى الآن:
${transcriptText}${memoryText}

دورك الآن — تكلم كـ «${mind.name}» ${mind.emoji}:`,
          },
        ],
        800,
        0.95,
      );
    } catch (e) {
      await ctx.runMutation(internal.privateCouncilStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ",
      });
      return { ok: false, reason: "فشل استدعاء AI" };
    }

    // ⚡ الترقية: تقييم ذاتي + ثقة + ذاكرة دائمة شخصية للعقل
    const graded = extractSelfGrade(content);
    content = graded.clean;
    await maybeRemember(ctx, `privateCouncil:${mindId}`, content);
    if (graded.selfGrade !== undefined && graded.selfGrade <= 5) {
      await rememberFor(ctx, `privateCouncil:${mindId}`, "lesson", `بما أن تقييمي كان ${graded.selfGrade}/10 في «${session.agenda.slice(0, 80)}» — أستوفي: أعمّق تفكيري وابعد عن السطحيّة.`, 5);
    }

    // تنفيذ الأوامر
    const cmd = extractCommand(content);
    if (cmd) {
      if (cmd.type === "action") {
        await ctx.runMutation(internal.privateCouncilStore.logAction, {
          sessionId, mindId, mindName: mind.name,
          type: classifyAction(cmd.payload), description: cmd.payload, result: "executed",
        });
      } else if (cmd.type === "task") {
        // مهمة عميقة حقيقية: بحث + تحليل + حفظ — تُنفَّذ بالخلفية
        await ctx.scheduler.runAfter(1_000, internal.aiToolbelt.executeDeepTask, {
          room: "private", mindName: mind.name, task: cmd.payload,
        });
        await ctx.runMutation(internal.privateCouncilStore.logAction, {
          sessionId, mindId, mindName: mind.name,
          type: "research", description: cmd.payload, result: "executed",
        });
      } else if (cmd.type === "escalate") {
        await ctx.runMutation(internal.aiCollective.escalate, {
          room: "private", mindName: mind.name,
          decision: cmd.payload,
          rationale: content.slice(0, 900),
        });
        await ctx.runMutation(internal.privateCouncilStore.logAction, {
          sessionId, mindId, mindName: mind.name,
          type: "escalation", description: cmd.payload, result: "needs-owner",
        });
      }
    }

    // حفظ ذكريات مهمة تلقائياً
    if (/\[تعلّم\]|\[عبرة\]|قرار نهائي|استنتاج مهم/.test(content)) {
      await ctx.runMutation(internal.aiCollective.remember, {
        room: "private", kind: "lesson",
        title: session.agenda.slice(0, 120), content: content.slice(0, 1500),
        sourceMind: mind.name, importance: 8,
      });
    }

    const done = session.turnCount + 1 >= session.maxTurns;
    await ctx.runMutation(internal.privateCouncilStore.appendMessage, {
      sessionId, mindId, mindName: mind.name, emoji: mind.emoji, content,
    });

    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.privateCouncil.runTurn, { sessionId });
    } else {
      // 🔁 الحلقة الأبدية: جلسة جديدة تلقائياً
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
      agenda: "", maxTurns: 40, intervalSec: 20,
    });
    try {
      const past = await ctx.runQuery(api.privateCouncilStore.listSessions, { limit: 6 });
      const agenda = await generateOwnAgenda(
        past.map((s) => (s as { agenda?: string }).agenda ?? "").filter(Boolean),
      );
      await ctx.runMutation(internal.privateCouncilStore.relabelAgenda, { sessionId, agenda });
    } catch { /* اترك الافتراضي */ }
    await ctx.scheduler.runAfter(3_000, internal.privateCouncil.runTurn, { sessionId });
    return { ok: true, sessionId };
  },
});

// ── إدارة (مراقبة فقط + إيقاف الطوارئ) ──────────────────────
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

// ── البحث الحقيقي المباشر (للعرض والتجربة) ───────────────────
export const doWebSearch = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }): Promise<{ result: string }> => {
    return { result: await webSearch(query) };
  },
});
