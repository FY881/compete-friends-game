// سجل نشاط أنظمة AI Suite — queries/mutations (لا يمكن أن تكون في ملف "use node")
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiSuiteActivity")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 60);
  },
});

export const insertActivity = internalMutation({
  args: { systemId: v.string(), systemName: v.string(), summary: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiSuiteActivity", {
      systemId: args.systemId,
      systemName: args.systemName,
      summary: args.summary,
      createdAt: Date.now(),
    });
  },
});
