import { internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";
import { DEFAULT_LIVE_RULES, resolveLiveRules, ruleSurfaceFor, RULE_MODULE_KEYS } from "./evolutionRules";

async function readModules(ctx: any) {
  return await ctx.db
    .query("evolutionModules")
    .withIndex("by_key", (q: any) => q.gte("key", ""))
    .collect();
}

/**
 * ⚖️ القوانين الحيّة التي تقرأها مسارات اللعب الحقيقية.
 * التسجيل، الخبرة، والمكافأة اليومية تستدعي هذا فعلاً — فأي تعديل يوافق عليه
 * المالك يغيّر نتائج اللاعبين الحقيقيين، لا جدولاً معزولاً.
 */
export const getLiveRules = internalQuery({
  args: {},
  handler: async (ctx) => {
    return resolveLiveRules(await readModules(ctx));
  },
});

/**
 * لوحة القوانين الحيّة لغرفة المالك: القيم الفعلية الآن، أي وحدة أثّرت عليها،
 * وأي قيمة رُفضت (خارج الحدود أو غير رقمية) ولم تصل للعبة إطلاقاً.
 */
export const liveRules = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const deputy = await ctx.db
      .query("siteRoles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) return null;

    const modules = await readModules(ctx);
    const resolved = resolveLiveRules(modules);
    const surfaces = RULE_MODULE_KEYS.map((key) => {
      const row = modules.find((m: any) => m.key === key);
      return {
        key,
        exists: Boolean(row),
        active: row?.status === "active",
        version: row?.version ?? 0,
        config: row?.config ?? "{}",
        fieldCount: ruleSurfaceFor(key)?.length ?? 0,
      };
    });
    return { ...resolved, surfaces, defaults: DEFAULT_LIVE_RULES };
  },
});
