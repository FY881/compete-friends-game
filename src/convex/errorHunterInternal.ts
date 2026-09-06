// قراءات داخلية لصياد الأخطاء — يستخدمها نائب المالك في تدقيقه
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const recentCount = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("errorLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", args.since))
      .collect();
    return rows.reduce((s, r) => s + (r.count ?? 1), 0);
  },
});
