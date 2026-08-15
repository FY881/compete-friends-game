import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Account display name — «العب فوراً باسمك فقط» + «الحساب الذكي».
//
// Both quick-play and the smart account flow let a player pick a nickname
// without touching email. This mutation persists that name on the account so
// the profile page and the global leaderboard show the real name instead of
// «لاعب مجهول», on every device.
// ---------------------------------------------------------------------------

export const setDisplayName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");

    const clean = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (clean.length < 2) throw new Error("الاسم قصير جداً — 2 أحرف على الأقل");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("الحساب غير موجود");
    if (user.name === clean) return { ok: true };

    await ctx.db.patch(userId, { name: clean });
    return { ok: true };
  },
});
