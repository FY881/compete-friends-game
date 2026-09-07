"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { AI_SYSTEMS } from "../lib/aiSystems";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

/** استشارة نظام AI واحد من الـ 30 */
export const askSystem = action({
  args: {
    systemId: v.string(),
    prompt: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, { systemId, prompt, history }) => {
    const sys = AI_SYSTEMS.find((s) => s.id === systemId);
    if (!sys) throw new Error("نظام AI غير موجود");
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `aiSuite:${systemId}`,
      sys.systemPrompt,
      [
        ...(history ?? []).slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: prompt },
      ],
      2500,
      0.7,
    );
    if (prompt.length > 20) {
      await rememberFor(ctx, `aiSuite:${systemId}`, "fact", `سُئل عن: ${prompt.slice(0, 200)}`, 4);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).runMutation("aiSuiteLog:insertActivity", {
        systemId,
        systemName: sys.name,
        summary: prompt.slice(0, 120),
      });
    } catch {
      // السجل اختياري
    }
    return { reply, system: sys.name, selfGrade, confidence };
  },
});

/** توليد أسئلة جديدة بنظام مولّد الأسئلة وإدراجها بانتظار مراجعة المالك */
export const generateAndStageQuestions = action({
  args: {
    category: v.string(),
    difficulty: v.optional(v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))),
    count: v.optional(v.number()),
  },
  handler: async (ctx, { category, difficulty, count }) => {
    const n = Math.min(Math.max(count ?? 5, 1), 10);
    const gen = AI_SYSTEMS.find((s) => s.id === "questiongen");
    if (!gen) throw new Error("نظام التوليد غير موجود");
    const { reply } = await upgradedLlm(
      ctx,
      "aiSuite:questiongen",
      gen.systemPrompt,
      [
        {
          role: "user",
          content: `أرجع ${n} أسئلة مسابقة بالعربية في فئة «${category}» بصعوبة «${difficulty ?? "medium"}». JSON فقط، بدون أي نص آخر، بصيغة: [{"question":"...","options":["أ","ب","ج","د"],"correctIndex":0}]`,
        },
      ],
      2500,
      0.6,
    );
    let parsed: Array<{ question: string; options: string[]; correctIndex: number }> = [];
    try {
      const match = reply.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = [];
    }
    const staged = parsed
      .filter((q) => q.question && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => ({
        qid: `ai-${Math.random().toString(36).slice(2, 8)}`,
        category,
        difficulty: (difficulty ?? "medium") as "easy" | "medium" | "hard",
        question: String(q.question),
        options: q.options.map(String),
        correctIndex: Number(q.correctIndex) || 0,
      }));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx as any).runMutation("aiQuestions:insertBatch", { questions: staged });
    } catch {
      // الإدراج اختياري — النتيجة تُعرض في الواجهة دائماً
    }
    return { staged };
  },
});
