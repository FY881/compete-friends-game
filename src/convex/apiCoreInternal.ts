// ═══════════════════════════ small helper: internal read of stored systems ══
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const readStored = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.value);
      return parsed && typeof parsed === "object" && parsed.apiKey ? parsed : null;
    } catch {
      return null;
    }
  },
});