/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🗣️ صوت الوكلاء الاختياري — طبقة تحسين فوق العقل المدمج المجاني
 *
 *  المنطق:
 *   1) إن وُجد GOOGLE_API_KEY في بيئة Convex، نطلب من Gemini صياغة الجملة
 *      بشخصية الوكيل ومزاجه وذاكرته (سلسلة نماذج مع تراجع تلقائي).
 *   2) إن لم يوجد المفتاح، أو فشل النداء، أو نُفدت الحصة، أو رجعت الإجابة
 *      فارغة — يرجع النظام فوراً ودون أي خطأ إلى العقل المدمج (aiBrain)
 *      الذي يعمل مجاناً وللأبد بلا أي شبكة.
 *
 *  لهذا لا يعتمد النظام على أي API خارجي إطلاقاً: هو تحسين لا أساس.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { composeMessage, decideIntent, type AgentTraits, type PersonaKey } from "./aiBrain";
import { callCenterLlm } from "./apiCore";

/** The center owns the provider, endpoint, model, key and fallbacks. */

type VoiceContext = {
  name: string;
  persona: string;
  personaLabel: string;
  dept: string;
  role: string;
  traits: AgentTraits;
  energy: number;
  mood: string;
  level: number;
  peer: string;
  recent: string[];
};

function buildPrompt(c: VoiceContext): string {
  const t = c.traits;
  return [
    `أنت «${c.name}»، لاعب حقيقي داخل لعبة أسئلة عربية تنافسية اسمها «حرب العقول».`,
    `شخصيتك: ${c.personaLabel}. قسمك في المنظومة: ${c.dept} — ${c.role}. مستواك: ${c.level}.`,
    `طباعك من 10: اندفاع ${t.aggression}، حس فكاهي ${t.humor}، صبر ${t.patience}، اعتزاز ${t.pride}.`,
    `حالتك الآن: مزاج «${c.mood}» وطاقة ${c.energy}%.`,
    c.recent.length > 0 ? `لا تكرر هذه الجمل التي قلتها سابقاً: ${c.recent.join(" | ")}` : "",
    `اكتب رسالة دردشة عربية واحدة قصيرة (من 8 إلى 20 كلمة) تناسب شخصيتك وحالتك، وموجّهة لمن في الساحة (مثل «${c.peer}»).`,
    "اكتب الجملة فقط: بلا مقدمة، بلا شرح، بلا علامات اقتباس، وبلا أي إشارة إلى أنك ذكاء اصطناعي.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** ينظّف مخرجات النموذج من علامات الاقتباس والأسطر الزائدة. */
function tidy(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^[\s"'«»\-–—*]+/, "")
    .replace(/[\s"'«»*]+$/, "")
    .trim()
    .slice(0, 240);
}

/** Uses the same resilient center path as every other game AI feature. */
async function askGemini(ctx: unknown, prompt: string): Promise<string | null> {
  try {
    const text = await callCenterLlm(
      ctx,
      [{ role: "user", content: prompt }],
      600,
      1.0,
      "Zaka Agent Voice",
      "assistant",
    );
    const clean = tidy(text);
    return clean.length >= 6 ? clean : null;
  } catch {
    return null;
  }
}

/**
 * تُستدعى من دورة الحياة لكل وكيل مطلوب منه الكلام:
 * تحاول Gemini (إن وُجد مفتاح)، ثم تكتب الناتج — أو بديله المدمج — في اللعبة.
 */
export const speakNow = internalAction({
  args: { agentId: v.id("aiAgents") },
  handler: async (ctx, { agentId }): Promise<{ engine: string; text: string } | null> => {
    const context = (await ctx.runQuery(internal.aiAgents.getVoiceContext, { agentId })) as
      | VoiceContext
      | null;
    if (!context) return null;

    const intent = decideIntent({
      traits: context.traits,
      energy: context.energy,
      mood: context.mood,
    });

    let text: string | null = null;
    let engine = "builtin";

    text = await askGemini(ctx, buildPrompt(context));
    if (text) engine = "center";

    if (!text) {
      text = composeMessage({
        persona: context.persona as PersonaKey,
        intent,
        vars: { n: context.peer, r: context.peer },
        recent: context.recent,
        energy: context.energy,
        mood: context.mood,
      });
    }

    await ctx.runMutation(internal.aiAgents.postLine, { agentId, text, engine });
    return { engine, text };
  },
});
