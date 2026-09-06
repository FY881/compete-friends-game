/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚡ حزمة الترقية الشاملة — تُمنح لكل AI في اللعبة (80+ عقل ونظام)
 *
 * الميزات الخمس الممنوحة لكل ذكاء:
 *  1. 🧠 ذاكرة دائمة متعددة الأنواع (دروس/تفضيلات/حقائق/أسلوب) مع أهمية
 *     وعدّاد استخدام — كل عقل يبني خبرته الخاصة عبر الزمن
 *  2. 🎯 تقييم ذاتي بعد كل رد (جودة 1-10) — العقل يصحح نفسه
 *  3. ⭐ تقييم المالك لكل عقل (1-5 نجوم مع تعليق) — يغذي الاقتراحات
 *  4. 💡 اقتراحات استباقية من العقول للمالك — يكتشفون الفرص بأنفسهم
 *  5. 🎚️ نبرة تكيّفية + 🏷️ وسم الثقة — يعدّلون أسلوبهم حسب السياق
 *     ويعلنون مدى تأكدهم من كل جواب
 * ═══════════════════════════════════════════════════════════════════════
 */
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ── 1. الذاكرة الدائمة ──────────────────────────────────────
export const remember = mutation({
  args: {
    agentId: v.string(),
    kind: v.union(v.literal("lesson"), v.literal("preference"), v.literal("fact"), v.literal("style")),
    content: v.string(),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // منع التكرار: إذا نفس المحتوى موجود، ارفع أهميته وحدث زمن آخر استخدام
    const existing = await ctx.db
      .query("aiMemories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const dup = existing.find((m) => m.content === args.content.trim());
    if (dup) {
      await ctx.db.patch(dup._id, {
        importance: Math.min(10, dup.importance + 1),
        lastUsedAt: Date.now(),
        useCount: dup.useCount + 1,
      });
      return dup._id;
    }
    return await ctx.db.insert("aiMemories", {
      agentId: args.agentId,
      kind: args.kind,
      content: args.content.trim().slice(0, 500),
      importance: Math.min(10, Math.max(1, args.importance ?? 5)),
      createdAt: Date.now(),
      useCount: 0,
    });
  },
});

/** استرجاع أهم ذكريات العقل — تُحقن في سياق أي استدعاء AI */
export const recall = query({
  args: { agentId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const mems = await ctx.db
      .query("aiMemories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return mems
      .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 8);
  },
});

/** حفظ ذكرى — نسخة داخلية تُستدعى من ملفات Node runtime */
export const rememberInternal = internalMutation({
  args: {
    agentId: v.string(),
    kind: v.union(v.literal("lesson"), v.literal("preference"), v.literal("fact"), v.literal("style")),
    content: v.string(),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiMemories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    const dup = existing.find((m) => m.content === args.content.trim());
    if (dup) {
      await ctx.db.patch(dup._id, {
        importance: Math.min(10, dup.importance + 1),
        lastUsedAt: Date.now(),
        useCount: dup.useCount + 1,
      });
      return dup._id;
    }
    return await ctx.db.insert("aiMemories", {
      agentId: args.agentId,
      kind: args.kind,
      content: args.content.trim().slice(0, 500),
      importance: Math.min(10, Math.max(1, args.importance ?? 5)),
      createdAt: Date.now(),
      useCount: 0,
    });
  },
});

export const recallInternal = internalQuery({
  args: { agentId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const mems = await ctx.db
      .query("aiMemories")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return mems
      .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 8);
  },
});

export const forget = mutation({
  args: { memoryId: v.id("aiMemories") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.memoryId);
  },
});

/** تعزيز استخدام ذكرى عند الاستفادة منها */
export const touchMemory = internalMutation({
  args: { memoryId: v.id("aiMemories") },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.memoryId);
    if (!m) return;
    await ctx.db.patch(args.memoryId, { lastUsedAt: Date.now(), useCount: m.useCount + 1 });
  },
});

// ── 2. التقييم الذاتي + 3. تقييم المالك ─────────────────────
export const rateOwner = mutation({
  args: {
    agentId: v.string(),
    sessionId: v.optional(v.string()),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiFeedback", {
      agentId: args.agentId,
      sessionId: args.sessionId,
      rating: Math.min(5, Math.max(1, Math.round(args.rating))),
      comment: args.comment?.slice(0, 300),
      createdAt: Date.now(),
    });
  },
});

export const getAgentRating = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("aiFeedback")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    if (all.length === 0) return { average: 0, count: 0, lastComment: null };
    const average = all.reduce((s, r) => s + r.rating, 0) / all.length;
    const withComment = [...all].reverse().find((r) => r.comment);
    return { average: Math.round(average * 10) / 10, count: all.length, lastComment: withComment?.comment ?? null };
  },
});

/** تقييمات كل العقول دفعة واحدة — للوحة الترقية */
export const getAllRatings = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("aiFeedback").collect();
    const byAgent = new Map<string, { sum: number; count: number }>();
    for (const r of all) {
      const cur = byAgent.get(r.agentId) ?? { sum: 0, count: 0 };
      byAgent.set(r.agentId, { sum: cur.sum + r.rating, count: cur.count + 1 });
    }
    return [...byAgent.entries()]
      .map(([agentId, { sum, count }]) => ({ agentId, average: Math.round((sum / count) * 10) / 10, count }))
      .sort((a, b) => b.average - a.average);
  },
});

// ── 4. الاقتراحات الاستباقية ────────────────────────────────
export const suggest = mutation({
  args: {
    agentId: v.string(),
    agentName: v.string(),
    title: v.string(),
    detail: v.string(),
    impact: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    // منع التكرار المزعج: لا يقترح نفس الشيء مرتين مفتوحتين
    const open = await ctx.db
      .query("aiSuggestions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    if (open.some((s) => s.agentId === args.agentId && s.title === args.title.trim())) return null;
    return await ctx.db.insert("aiSuggestions", {
      agentId: args.agentId,
      agentName: args.agentName,
      title: args.title.trim().slice(0, 150),
      detail: args.detail.trim().slice(0, 800),
      impact: args.impact,
      category: args.category.slice(0, 50),
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const listSuggestions = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("accepted"), v.literal("dismissed"))) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("aiSuggestions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(50);
    }
    return await ctx.db.query("aiSuggestions").order("desc").take(50);
  },
});

export const decideSuggestion = mutation({
  args: { suggestionId: v.id("aiSuggestions"), decision: v.union(v.literal("accepted"), v.literal("dismissed")) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.suggestionId, { status: args.decision });
  },
});

// ── لوحة الترقية: إحصائيات كل العقول ────────────────────────
export const getUpgradeStats = query({
  args: {},
  handler: async (ctx) => {
    const memories = await ctx.db.query("aiMemories").collect();
    const feedback = await ctx.db.query("aiFeedback").collect();
    const suggestions = await ctx.db.query("aiSuggestions").collect();
    const agentsWithMemory = new Set(memories.map((m) => m.agentId));
    const rated = feedback.reduce((s, r) => s + r.rating, 0);
    return {
      totalMemories: memories.length,
      agentsWithMemory: agentsWithMemory.size,
      totalRatings: feedback.length,
      averageRating: feedback.length ? Math.round((rated / feedback.length) * 10) / 10 : 0,
      openSuggestions: suggestions.filter((s) => s.status === "open").length,
      acceptedSuggestions: suggestions.filter((s) => s.status === "accepted").length,
    };
  },
});
