/**
 * 🧩 عدة الترقية — دمج بسيط: أي نظام AI يمرّر استدعاءه عبر هنا
 * فيحصل تلقائياً على الميزات الخمس دون تعديل بنيته.
 */
"use node";

import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { api, internal } from "./_generated/api";

type Ctx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runQuery: (ref: any, args?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runMutation: (ref: any, args?: any) => Promise<any>;
};

/** حفظ ذكرى من أي نظام — آمنة ولا تعطّل العقل أبداً */
export async function rememberFor(
  ctx: Ctx,
  agentId: string,
  kind: "lesson" | "preference" | "fact" | "style",
  content: string,
  importance?: number,
): Promise<void> {
  try {
    await ctx.runMutation(internal.aiEnhancements.rememberInternal, {
      agentId,
      kind,
      content,
      importance,
    });
  } catch {
    // الذاكرة اختيارية — لا تعطّل العقل أبداً
  }
}

/** استخراج التقييم الذاتي ووسم الثقة من رد العقل وتنظيفه للعرض */
export function extractSelfGrade(
  reply: string,
): { clean: string; selfGrade?: number; confidence?: string } {
  let clean = reply;
  let selfGrade: number | undefined;
  let confidence: string | undefined;

  const gradeMatch = clean.match(/\[تقييم:\s*(\d{1,2})\s*\/\s*10\]/);
  if (gradeMatch) {
    selfGrade = Math.min(10, Math.max(1, parseInt(gradeMatch[1], 10)));
    clean = clean.replace(gradeMatch[0], "").trim();
  }
  const confMatch = clean.match(/\[ثقة:\s*(منخفضة|متوسطة|عالية)\]/);
  if (confMatch) {
    confidence = confMatch[1];
    clean = clean.replace(confMatch[0], "").trim();
  }
  return { clean, selfGrade, confidence };
}

/**
 * استخراج اقتراح استباقي من رد العقل إن وضعه بصيغة [اقتراح] العنوان | التفاصيل
 * ويحفظه تلقائياً للمالك في لوحة الترقية.
 */
export async function maybeSaveSuggestion(
  ctx: Ctx,
  agentId: string,
  agentName: string,
  reply: string,
): Promise<void> {
  const m = reply.match(/\[اقتراح\]\s*([^\n|]+)\|([^\n]+)/);
  if (!m) return;
  try {
    await ctx.runMutation(api.aiEnhancements.suggest, {
      agentId,
      agentName,
      title: m[1].trim(),
      detail: m[2].trim(),
      impact: /مهم|جوهري|جذر|كبير/.test(m[2]) ? "high" : /متوسط/.test(m[2]) ? "medium" : "low",
      category: "proactive",
    });
  } catch {
    // تجاهل — الاقتراحات اختيارية
  }
}

/** استرجاع ذكريات عقل — للاستخدام المباشر (مثل نائب المالك) */
export async function recallFor(ctx: Ctx, agentId: string, limit = 8): Promise<Array<{ kind: string; content: string }>> {
  try {
    return (await ctx.runQuery(internal.aiEnhancements.recallInternal, { agentId, limit })) as Array<{
      kind: string;
      content: string;
    }>;
  } catch {
    return [];
  }
}

/** حفظ درس من رد العقل إن وضعه بصيغة [ذاكرة] ... — التعلم الذاتي */
export async function maybeRemember(ctx: Ctx, agentId: string, reply: string): Promise<void> {
  const m = reply.match(/\[ذاكرة\]\s*(.+)/);
  if (!m) return;
  await rememberFor(ctx, agentId, "lesson", m[1].trim().slice(0, 500), 6);
}

/** استدعاء موحّد مع الترقية الكاملة: ذاكرة قبل + تقييم/اقتراح/تنظيف بعد */
export async function upgradedLlm(
  ctx: Ctx,
  agentId: string,
  baseSystemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 900,
  temperature = 0.9,
): Promise<{ reply: string; selfGrade?: number; confidence?: string }> {
  // ذاكرة العقل تُحقن في برومبت النظام
  let memoryBlock = "";
  try {
    const mems = (await ctx.runQuery(internal.aiEnhancements.recallInternal, {
      agentId,
      limit: 8,
    })) as Array<{ kind: string; content: string }>;
    if (mems && mems.length > 0) {
      memoryBlock = `\n\n🧠 ذاكرتك الدائمة (خبرتك المتراكمة — استعن بها وتعلّم منها):\n${mems
        .map((m) => `- ${m.content}`)
        .join("\n")}`;
    }
  } catch {
    // بلا ذاكرة — نكمل عادي
  }

  const upgradeBlock = `\n\n🎯 أنهِ ردك دائماً بسطر تقييم ذاتي بالضبط: [تقييم: X/10] (X من 1 إلى 10)\n🏷️ إن لم تكن متأكداً من جوابك أضف وسم: [ثقة: منخفضة] أو [ثقة: متوسطة] أو [ثقة: عالية]\n💡 إذا لمحت فرصة تحسين حقيقية للعبة أو للنظام أضف سطراً بصيغة: [اقتراح] العنوان | التفاصيل\n🧠 إذا تعلمت درساً جديداً يستحق الحفظ أضف سطراً: [ذاكرة] الدرس الذي تعلمته\n🎚️ كيّف نبرتك مع سياق الحديث (رسمي/ودّي/حازم).`;

  const upgraded = [
    { role: "system", content: baseSystemPrompt + memoryBlock + upgradeBlock },
    ...messages.filter((m) => m.role !== "system"),
  ];

  await ensureAiRuntime(ctx); // حقن النظامين المضبوطين من مركز API قبل كل استدعاء
  const raw = await callLlm(upgraded, maxTokens, temperature, `Zaka Upgraded AI (${agentId})`);
  const { clean, selfGrade, confidence } = extractSelfGrade(raw);
  await maybeSaveSuggestion(ctx, agentId, agentId, raw);
  await maybeRemember(ctx, agentId, raw);
  return { reply: clean, selfGrade, confidence };
}
