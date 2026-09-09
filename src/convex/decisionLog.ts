/**
 * ═══════════════════════════════════════════════════════════════════════
 * سجلّ القرارات الموحّد (مجلس العقول)
 *
 * ناقل شفاف واحد يُسجّل فيه كل قرار تصدره أنظمة الذكاء والرقابة والإدارة
 * والمولّدات — من أي ملف (باستثناء moderationLogs التاريخي) — ليتمكن
 * المالك من تتبّع «لماذا فعل النظام ماذا» من مكان واحد.
 *
 * يكتب عبر `log` (internal mutation) من أي نظام، ويقرأ عبر `getRecent`
 * (استعلام مشرف) في لوحة القيادة وتبويب الشفافية.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";

export type DecisionSystem =
  | "moderation"
  | "autoadmin"
  | "viceowner"
  | "gem"
  | "questions"
  | "reports"
  | "owner";

/** سجّل قراراً في الناقل الموحّد (يُستدعى داخلياً من أي نظام). */
export const log = internalMutation({
  args: {
    system: v.string(),
    actorName: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    detail: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiDecisionLog", {
      system: args.system,
      actorName: args.actorName,
      action: args.action,
      targetId: args.targetId,
      targetName: args.targetName,
      detail: args.detail,
      severity: args.severity,
      createdAt: Date.now(),
    });
  },
});

export type DecisionLogEntry = {
  id: string;
  system: string;
  actorName: string;
  action: string;
  targetId: string | null;
  targetName: string | null;
  detail: string;
  severity: "low" | "medium" | "high";
  createdAt: number;
};

/** آخر القرارات الموحّدة (للوحة القيادة / الشفافية). */
export const getRecent = query({
  args: { limit: v.optional(v.number()), system: v.optional(v.string()) },
  handler: async (ctx, { limit, system }): Promise<DecisionLogEntry[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const take = Math.min(Math.max(limit ?? 40, 1), 100);
    const q = system
      ? ctx.db
          .query("aiDecisionLog")
          .withIndex("by_created", (q) => q.gte("createdAt", 0))
          .filter((r) => r.eq(r.field("system"), system))
          .order("desc")
          .take(take)
      : ctx.db
          .query("aiDecisionLog")
          .withIndex("by_created", (q) => q.gte("createdAt", 0))
          .order("desc")
          .take(take);

    const rows = await q;
    return rows.map((r) => ({
      id: r._id,
      system: r.system,
      actorName: r.actorName,
      action: r.action,
      targetId: r.targetId ?? null,
      targetName: r.targetName ?? null,
      detail: r.detail,
      severity: r.severity,
      createdAt: r.createdAt,
    }));
  },
});