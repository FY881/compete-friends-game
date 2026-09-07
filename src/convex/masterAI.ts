// «قوة السيطرة» — أوامر المالك · نائب المالك · الأنظمة الحرة
// كلها تمر من هنا، وتُسجَّل في aiLogs كعملية PsiCommand
// النائب يقرأ الأوامر عبر apiHubStore.pendingCommands ويُنفّذها ذاتياً.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/** يرسل أمراً مباشراً لنسخة نائب المالك الحية (أو كل النسخ).
 * النائب يقرأ الأوامر من apiHubStore.pendingCommands ويُنفّذها خلال دورته القادمة.
 */
export const issueViceCommand = action({
  args: {
    command: v.string(),
    targetSystem: v.optional(v.string()),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const started = Date.now();
    await ctx.runMutation(internal.apiHubStore.pushCommand, {
      command: args.command,
      targetSystem: args.targetSystem ?? "all",
      payload: args.payload ?? "",
      issuedBy: "owner",
    });
    try {
      await ctx.runMutation(internal.aiGuardianStore.logGuardianEvent, {
        ok: true,
        message: `PsiCommand أُرسل إلى ${args.targetSystem ?? "all"}: ${args.command.slice(0, 120)}`,
        severity: "info",
      });
    } catch {
      /* السجل اختياري */
    }
    return {
      ok: true,
      message: `أُرسل الأمر إلى نائب المالك (${Math.round(Date.now() - started)}ms) — سينفّذه خلال دورته القادمة.`,
    };
  },
});
