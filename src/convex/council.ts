/**
 * ═══════════════════════════════════════════════════════════════════════
 * مجلس العقول — لوحة صحة الأنظمة الموحّدة
 *
 * يجمع كل أنظمة الذكاء في جدول واحد حي: حالة التفعيل من الإعدادات،
 * النشاط الفعلي من سجلّ القرارات الموحّد (آخر 7 أيام)، آخر قرار،
 * ومؤشر صحة محسوب من نشاط واقعي لا من افتراضات.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser, getSettingsData } from "./owner";

export type CouncilSystemRow = {
  id: string;
  name: string;
  role: string;
  enabled: boolean;
  decisions7d: number;
  lastDecisionAt: number | null;
  health: "healthy" | "idle" | "off";
};

const COUNCIL_SYSTEMS: { id: string; name: string; role: string; enabledKey: string | null }[] = [
  { id: "moderation", name: "الرقابة الذكية", role: "شرطة الميدان — تحليل البلاغات والرسائل", enabledKey: "aiEnabled" },
  { id: "autoadmin", name: "المدير الآلي", role: "نائب المالك التنفيذي — جولة كل 15 دقيقة", enabledKey: "aiAdminEnabled" },
  { id: "reports", name: "نظام البلاغات", role: "طابور البلاغات وسمعة المُبلِّغين", enabledKey: null },
  { id: "questions", name: "مولّد الأسئلة AI", role: "توليد واعتماد أسئلة البنك الحي", enabledKey: "aiEnabled" },
  { id: "gem", name: "حارسة الخزينة جيم", role: "راعية العضويات ومساعدة اللاعبين", enabledKey: null },
  { id: "viceowner", name: "نائب المالك", role: "مجلس المساعدين التنفيذي", enabledKey: null },
];

export const getHealthBoard = query({
  args: {},
  handler: async (ctx): Promise<{
    systems: CouncilSystemRow[];
    totalDecisions7d: number;
    generatedAt: number;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const settings = await getSettingsData(ctx);
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const decisions = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .collect();

    const countBy = new Map<string, number>();
    const lastBy = new Map<string, number>();
    for (const d of decisions) {
      countBy.set(d.system, (countBy.get(d.system) ?? 0) + 1);
      const prev = lastBy.get(d.system) ?? 0;
      if (d.createdAt > prev) lastBy.set(d.system, d.createdAt);
    }

    const settingsMap = settings as unknown as Record<string, boolean>;

    const systems = COUNCIL_SYSTEMS.map((s) => {
      const enabled = s.enabledKey ? Boolean(settingsMap[s.enabledKey]) : true;
      const decisions7d = countBy.get(s.id) ?? 0;
      const lastDecisionAt = lastBy.get(s.id) ?? null;
      const health: CouncilSystemRow["health"] = !enabled ? "off" : decisions7d > 0 ? "healthy" : "idle";
      return { id: s.id, name: s.name, role: s.role, enabled, decisions7d, lastDecisionAt, health };
    });

    return {
      systems,
      totalDecisions7d: decisions.length,
      generatedAt: Date.now(),
    };
  },
});

/** فلترة سجلّ القرارات — للشفافية (نظام + خطورة + مدة). */
export const getDecisionsFiltered = query({
  args: {
    system: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { system, severity, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const take = Math.min(Math.max(limit ?? 60, 1), 150);
    let rows = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(take * 3);

    if (system) rows = rows.filter((r) => r.system === system);
    if (severity) rows = rows.filter((r) => r.severity === severity);
    rows = rows.slice(0, take);

    return rows.map((r) => ({
      id: r._id,
      system: r.system,
      actorName: r.actorName,
      action: r.action,
      targetName: r.targetName ?? null,
      detail: r.detail,
      severity: r.severity,
      createdAt: r.createdAt,
    }));
  },
});