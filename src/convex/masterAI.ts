// «قوة السيطرة» — أوامر المالك · نائب المالك · الأنظمة الحرة
// كلها تمر من هنا، وتُسجَّل في aiLogs كعملية PsiCommand
// النائب يقرأ الأوامر عبر apiHubStore.pendingCommands ويُنفّذها ذاتياً.
import { LOGGER } from "./aiIntelligence";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const SYSTEM_LABEL = "PsiCommand";

type Args = {
  command: string;
  targetSystem?: string;
  payload?: string;
  clearAfter?: boolean;
};

async function logCommand(
  ctx: { runMutation: (m: any, args: any) => Promise<any> },
  args: Args,
  executedBy = "owner",
) {
  await ctx.runMutation(internal.aiLogs.insert, {
    action: "command",
    subsystem: "commands",
    message: `PsiCommand → ${args.targetSystem ?? "all"}: ${args.command}`,
    severity: "action",
    executedBy,
    data: JSON.stringify({ command: args.command, targetSystem: args.targetSystem, payload: args.payload }),
  });
}

/** يرسل أمراً مباشراً لنسخة نائب المالك الحية (أو كل النسخ).
 * النائب يقرأ الأوامر من apiHubStore.pendingCommands ويُنفّذها خلال دورته القادمة.
 * هذا هو المسار الوحيد “الحر” غير المُقيَّد — لا يؤكد المالك، لا ينتظر.
 */
export const issueViceCommand = action({
  args: {
    command: v.string(),
    targetSystem: v.optional(v.string()),
    payload: v.optional(v.string()),
    clearAfter: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const enteredAt = Date.now();
    await logCommand(ctx, args as Args, "owner");

    await ctx.runMutation(internal.apiHubStore.pushCommand, {
      command: args.command,
      targetSystem: args.targetSystem ?? "all",
      payload: args.payload ?? "",
      issuedBy: "owner",
    });

    if (args.clearAfter !== false) {
      await ctx.runMutation(internal.apiHubStore.markExecuted, {
        id: (await ctx.runQuery(internal.apiHubStore.pendingCommands, { targetSystem: args.targetSystem ?? "all" }))?.[0]?._id as never,
      }),
      void 0; // نية التصفير بعد الإرسال، لا تعطل المسار
    }

    return {
      ok: true,
      message:
        `PsiCommand أُرسل: “${args.command}” → ${args.targetSystem ?? "all"} (${Math.round(Date.now() - enteredAt)}ms). النائب يقرأه ويُنفّذها خلال دورته القادمة بدون أي تأكيد منك.`,
    };
  },
});
