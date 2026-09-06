/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 AI SUITE — 30 نظام AI حر يعتمد بالكامل على OpenRouter API (مجاني)
 * كل نظام له شخصية وسياق مستقل، والردود تُحفظ لذاكرة دائمة قابلة للاستعراض.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { AI_SYSTEMS } from "../lib/aiSystems";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

// جميع الأنظمة المسجّلة للعب: 30 نظام أساسي + 100 عقل موسع ونخبة
// مصدر واحد مشترك في src/lib/aiSystems.ts
const SYSTEMS = AI_SYSTEMS;

const ELITE_SYSTEM_IDS = ELITE_MINDS.map((m) => m.id);

// عبر callLlm — مفتاح نائب الرئيس الرسمي (sk-...) مع تعامل 429 وبديل OneHop تلقائي عند الفشل
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2048,
  temperature = 0.7,
): Promise<string> {
  return await callLlm(messages, maxTokens, temperature, "Zaka AI Suite", "sk-J3x07DW6NCnFG2DBReSsHJVTJhlCgnwYy3DSkL8M68WlVPHn");
}

// ملاحظة: القائمة المشتركة للـ 30 نظاماً موجودة في src/lib/aiSystems.ts وتُستخدم من هنا وللواجهة

// ── استدعاء أي نظام من الواجهة ──────────────────────────────
export const askSystem = action({
  args: {
    systemId: v.string(),
    prompt: v.string(),
    history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, { systemId, prompt, history }) => {
    const sys = SYSTEMS.find((s) => s.id === systemId);
    if (!sys) throw new Error("نظام AI غير موجود");
    // ⚡ الترقية: ذاكرة دائمة + تقييم ذاتي + ثقة + اقتراحات + نبرة
    const { reply, selfGrade, confidence } = await upgradedLlm(
      ctx,
      `aiSuite:${systemId}`,
      sys.systemPrompt,
      [
        ...(history ?? []).slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        { role: "user", content: prompt },
      ],
      2500,
      0.7,
    );
    // حفظ كل نقاش مهم في ذاكرة النظام الدائمة
    if (prompt.length > 20) {
      await rememberFor(ctx, `aiSuite:${systemId}`, "fact", `سُئل عن: ${prompt.slice(0, 200)}`, 4);
    }
    return { reply, system: sys.name, selfGrade, confidence };
  },
});

// ── توليد أسئلة وحفظها في بنك AI الموجود ────────────────────
export const generateAndStageQuestions = action({
  args: {
    category: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    count: v.number(),
  },
  handler: async (ctx, { category, difficulty, count }) => {
    const sys = SYSTEMS.find((s) => s.id === "questiongen")!;
    const diffLabel = difficulty === "easy" ? "سهلة" : difficulty === "medium" ? "متوسطة" : "صعبة";
    const prompt = `ولّد ${count} أسئلة بالعربية في فئة "${category}" بمستوى ${diffLabel}. أرجع JSON array فقط بالشكل: [{"question":"...","options":["أ","ب","ج","د"],"correctIndex":0}]`;
    const reply = await callOpenRouter(
      [{ role: "system", content: sys.systemPrompt }, { role: "user", content: prompt }],
      3000,
      0.8,
    );
    const jsonMatch = reply.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI لم يُرجع JSON صالحاً — حاول مرة أخرى");
    const parsed = JSON.parse(jsonMatch[0]) as Array<{ question: string; options: string[]; correctIndex: number }>;
    const staged = parsed.map((q, i) => ({
      qid: `suite_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      difficulty,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      status: "pending" as const,
      createdAt: Date.now(),
    }));
    return { staged };
  },
});
