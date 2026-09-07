"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

/** فتح جلسة في ملتقى العقول (غرفة الحرب أو العقل الحر) */
export const openSession = action({
  args: {
    room: v.union(v.literal("war"), v.literal("free")),
    maxTurns: v.number(),
    intervalSec: v.number(),
    autoAgenda: v.optional(v.boolean()),
  },
  handler: async (ctx, { room, maxTurns, intervalSec }) => {
    const agendas = {
      war: "مراجعة شاملة لحالة لعبة حرب العقول واتخاذ قرارات تنفيذية",
      free: "نقاش حر مفتوح — العلوم، الفكر، الفن، الكون، الحياة",
    } as const;
    const sessionId = await ctx.runMutation("mindHubStore:insertSession" as never, {
      room,
      agenda: agendas[room],
      maxTurns,
      intervalSec,
    } as never);
    return { sessionId };
  },
});

export const pauseSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("mindHubStore:setStatus" as never, { sessionId, status: "paused" } as never);
    return { ok: true };
  },
});

export const resumeSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("mindHubStore:setStatus" as never, { sessionId, status: "active" } as never);
    return { ok: true };
  },
});

export const endSession = action({
  args: { sessionId: v.id("mindHubSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("mindHubStore:setStatus" as never, { sessionId, status: "ended" } as never);
    return { ok: true };
  },
});
