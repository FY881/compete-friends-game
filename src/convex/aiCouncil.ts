"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

/** إنشاء جلسة مجلس عقول — تُدار الجلسة الفعلية في aiCouncilStore و crons */
export const pauseCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("aiCouncilStore:setCouncilStatus" as never, {
      sessionId,
      status: "paused",
    } as never);
    return { ok: true };
  },
});

export const resumeCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("aiCouncilStore:setCouncilStatus" as never, {
      sessionId,
      status: "active",
    } as never);
    return { ok: true };
  },
});

export const endCouncil = action({
  args: { sessionId: v.id("councilSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.runMutation("aiCouncilStore:setCouncilStatus" as never, {
      sessionId,
      status: "ended",
    } as never);
    return { ok: true };
  },
});

/** تدخل المالك — تُحقن الرسالة في النقاش الجاري */
export const intervene = action({
  args: { sessionId: v.id("councilSessions"), message: v.string() },
  handler: async (ctx, { sessionId, message }) => {
    await ctx.runMutation("aiCouncilStore:appendOwnerMessage" as never, {
      sessionId,
      message,
    } as never);
    return { ok: true };
  },
});
