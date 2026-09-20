// ملف مؤقت للتشخيص العميق — يُحذف بعد الفحص
import { internalMutation } from "./_generated/server";

export const probe = internalMutation({
  args: {},
  handler: async (ctx) => {
    const units = await ctx.db.query("aiHubUnits").take(60);
    const jobs = await ctx.db.query("aiCronJobs").take(60);
    const agents = await ctx.db.query("aiAgents").take(60);
    const settings = await ctx.db.query("settings").take(200);
    const pauseSettings = settings.filter((s) => s.key.includes("pause") || s.key.includes("ai") || s.key.includes("hub"));
    const events = await ctx.db.query("aiHubEvents").order("desc").take(5);
    const decisions = await ctx.db.query("aiDecisionLog").order("desc").take(3);
    const feed = await ctx.db.query("aiAgentFeed").order("desc").take(3);
    const conflicts = await ctx.db.query("aiConflicts").take(10);
    const cronTable = await ctx.db.query("aiCronJobs").withIndex("by_key", (q) => q.eq("key", "agents_life")).first();

    return {
      units: {
        count: units.length,
        rows: units.map((u) => ({ unit: u.unit, enabled: u.enabled, sens: u.sensitivity, events: u.eventCount ?? 0, last: u.lastEventAt ?? 0 })),
      },
      jobs: {
        count: jobs.length,
        rows: jobs.map((j) => ({ key: j.key, enabled: j.enabled, interval: j.intervalMinutes, last: j.lastRunAt, status: j.lastStatus, runs: j.runCount, errors: j.errorCount, result: j.lastResult.slice(0, 60) })),
      },
      agents: {
        count: agents.length,
        rows: agents.slice(0, 10).map((a) => ({ name: a.name, retired: a.retired, energy: a.energy, games: a.gamesPlayed, chat: a.chatCount, lastSpoke: a.lastSpokeAt ?? 0 })),
      },
      agentsLifeJob: cronTable ? { enabled: cronTable.enabled, last: cronTable.lastRunAt, status: cronTable.lastStatus } : null,
      settings: pauseSettings.map((s) => ({ key: s.key, value: s.value.slice(0, 80) })),
      events: events.map((e) => ({ unit: e.unit, kind: e.kind, summary: e.summary.slice(0, 70), at: e.at })),
      decisions: decisions.map((d) => ({ system: d.system, action: d.action.slice(0, 50), actor: d.actorName, at: d.createdAt })),
      feed: feed.map((f) => ({ agent: f.agentName, kind: f.kind, text: f.text.slice(0, 50), at: f.createdAt })),
      conflicts: conflicts.map((c) => ({ a: c.unitA, b: c.unitB, status: c.status })),
      now: Date.now(),
    };
  },
});
