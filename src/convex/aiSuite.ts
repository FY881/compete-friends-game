"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { AI_SYSTEMS } from "../lib/aiSystems";
import { upgradedLlm, rememberFor } from "./aiUpgradeKit";

const SYSTEMS = AI_SYSTEMS;

type LlmMessage = Array<{ role: string; content: string }>;

async function callOpenRouter(
  messages: LlmMessage,
  maxTokens = 2048,
  temperature = 0.7,
): Promise<string> {
  return await callLlm(messages, maxTokens, temperature, "Zaka AI Suite", "sk-J3x07DW6NCnFG2DBReSsHJVTJhlCgnwYy3DSkL8M68WlVPHn");
}

export const aiSuite = {
  systems: SYSTEMS.slice(0, 5).map((s) => ({ id: s.id, name: s.name, status: "active" as const })),
  askSystem: action({
    args: {
      systemId: v.string(),
      prompt: v.string(),
      history: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
    },
    handler: async (_ctx, { systemId, prompt, history }) => {
      const sys = SYSTEMS.find((s) => s.id === systemId);
      if (!sys) throw new Error("نظام AI غير موجود");
      const { reply, selfGrade, confidence } = await upgradedLlm(
        _ctx,
        `aiSuite:${systemId}`,
        sys.systemPrompt,
        [...(history ?? []).slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })), { role: "user", content: prompt }],
        2500,
        0.7,
      );
      if (prompt.length > 20) {
        await rememberFor(_ctx, `aiSuite:${systemId}`, "fact", `سُئل عن: ${prompt.slice(0, 200)}`, 4);
      }
      return { reply, system: sys.name, selfGrade, confidence };
    },
  }),
};

async function query<T>(_: { runQuery: Function }): Promise<T[]> {
  return [];
}
