/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛰️ AI TOOLBELT — API مباشر قوي: مهام حقيقية تنفّذها العقول
 * بحث ويب حقيقي (DuckDuckGo/DuckAPI بدون مفتاح) + جلب صفحات + تحليل
 * + حفظ في الذاكرة الجماعية. تُستدعى من محرك الغرف ذاتياً.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";

// عبر callLlm — المفتاح الرسمي الوحيد (sk-apx3...) يُؤخذ تلقائياً من aiCredentials.
// (كان يُمرَّر هنا المفتاح القديم sk-J3x... الميت الذي سبّب 401 Missing Authentication header.)
export async function llm(messages: Array<{ role: string; content: string }>, maxTokens = 1500, temperature = 0.8): Promise<string> {
  return await callLlm(messages, maxTokens, temperature, "Zaka Toolbelt");
}

/** بحث ويب حقيقي — DuckDuckGo Instant Answer API (مجاني بدون مفتاح) */
export async function webSearch(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    );
    if (!res.ok) throw new Error(`DDG ${res.status}`);
    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Answer?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const parts: string[] = [];
    if (data.Answer) parts.push(`الإجابة: ${data.Answer}`);
    if (data.AbstractText) parts.push(`${data.AbstractText} (${data.AbstractURL ?? ""})`);
    (data.RelatedTopics ?? []).slice(0, 4).forEach((t) => {
      if (t.Text) parts.push(`• ${t.Text}`);
    });
    return parts.join("\n") || "لا نتائج مباشرة — سنعتمد على المعرفة الداخلية.";
  } catch (e) {
    return `فشل البحث: ${e instanceof Error ? e.message : "خطأ"} — نعتمد على المعرفة الداخلية.`;
  }
}

// ── استدعاءات للواجهة والمحرك ────────────────────────────────

/** بحث حقيقي من طرف العقول */
export const searchWeb = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }): Promise<{ result: string }> => {
    return { result: await webSearch(query) };
  },
});

/**
 * مهمة حقيقية صعبة: بحث + تحليل + حفظ في الذاكرة الجماعية
 * العقول يستدعونها ذاتياً لتنفيذ مهام معرفية عميقة.
 */
export const executeDeepTask = internalAction({
  args: {
    room: v.union(v.literal("private"), v.literal("free")),
    mindName: v.string(),
    task: v.string(),
  },
  handler: async (ctx, { room, mindName, task }): Promise<{ report: string }> => {
    // 1) بحث ويب حقيقي
    const web = await webSearch(task.slice(0, 200));
    // 2) تحليل بذكاء عالٍ
    const analysis = await llm(
      [
        { role: "system", content: "أنت عقل تحليلي من نخبة الغرفة الخاصة. تحلل نتائج البحث وتستخرج: الحقائق الأساسية، ما يعنيه ذلك، والتوصية العملية. بالعربية، موجز ومنظم." },
        { role: "user", content: `المهمة: ${task}\n\nنتائج البحث الحقيقي:\n${web}\n\nقدّم تقريراً موجزاً.` },
      ],
      1200,
      0.6,
    );
    const report = `🛰️ مهمة منفّذة بواسطة ${mindName}:\n${analysis}`;
    // 3) حفظ في الذاكرة الجماعية الدائمة
    await ctx.runMutation(internal.aiCollective.remember, {
      room,
      kind: "research",
      title: task.slice(0, 150),
      content: report.slice(0, 3800),
      sourceMind: mindName,
      importance: 7,
    });
    return { report };
  },
});

/** حفظ معرفة في الذاكرة الجماعية (من الواجهة أو المحرك) */
export const saveKnowledge = action({
  args: {
    room: v.union(v.literal("private"), v.literal("free")),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    sourceMind: v.string(),
    importance: v.number(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.aiCollective.remember, args);
    return { ok: true };
  },
});
