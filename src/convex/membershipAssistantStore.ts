// ═══════════════════════════════════════════════════════════════════════
// مساعد العضويات «جيم» — قراءات (خارج runtime الـ Node)
// ═══════════════════════════════════════════════════════════════════════
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// قراءة بيانات العضو الحقيقية (المستخدم + الملف + العضوية) — تُستدعى من
// action مساعد العضويات عبر internal (الـ actions لا تنقل auth للـ queries)
export const getMemberData = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return { user, profile, membership };
  },
});