"use node";

import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { AI_SYSTEMS, ELITE_MINDS } from "../lib/aiSystems";

export const aiCouncilStore = {
  getStats: query(() => ({ active: 0, messages: 0, actions: 0 })),
};

export const aiCouncil = {
  systems: query(() => AI_SYSTEMS.slice(0, 5).map((s) => ({ id: s.id, name: s.name, status: "active" as const }))),
  eliteMinds: query(() => ELITE_MINDS.map((m) => ({ id: m.id, name: m.name }))),
  startDeliberation: action({
    args: { topic: v.string() },
    handler: async () => ({ ok: true }),
  }),
};
