"use node";

import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { AI_SYSTEMS } from "../lib/aiSystems";

export const mindHubStore = {
  listSessions: query({
    args: { limit: v.number() },
    handler: async () => [],
  }),
  getStats: query({
    args: {},
    handler: async () => ({ active: 0, messages: 0, executed: 0, pendingOwner: 0 }),
  }),
  getPendingOwnerDecisions: query({
    args: {},
    handler: async () => [],
  }),
  getSession: query({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => null,
  }),
  getSessionForUi: query({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => null,
  }),
  getDecipheredSession: query({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => null,
  }),
};

export const mindHub = {
  openSession: action({
    args: { room: v.union(v.literal("war"), v.literal("free")), maxTurns: v.number(), intervalSec: v.number(), autoAgenda: v.boolean() },
    handler: async () => ({ sessionId: "0" as unknown as any }),
  }),
  pauseSession: mutation({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => {},
  }),
  resumeSession: mutation({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => {},
  }),
  endSession: mutation({
    args: { sessionId: v.id("mindHubSessions") },
    handler: async () => {},
  }),
};
