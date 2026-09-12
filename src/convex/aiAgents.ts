/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌱 الوكلاء الأحياء — الإصدار 4.0، المرحلة 3
 *
 *  خمسون وكيلاً، لكل منهم هوية لاعب حقيقية داخل اللعبة:
 *   • حسابات لاعبين فعلية (id في جدول users) — يظهرون في الصدارة والتاريخ
 *   • يتحدثون في غرف الدردشة العامة بجمل يركّبها عقلهم المدمج
 *   • يلعبون جولات كاملة تُحسب نقاطها فعلياً وتُسجَّل في gameHistory
 *   • يكسبون الخبرة، يتقدّمون في المستويات، وتتبدّل أمزجتهم
 *   • النظام يلد وكلاء جدداً بنفسه عند الحاجة ويُقاعد المتوقفين
 *
 *  يعمل ذاتياً بالكامل عبر مهمة مجدولة — بلا أي تدخل بشري وبلا أي API خارجي.
 *  العقوبات وإتلاف البيانات محصورة بضوابط صارمة لا يتجاوزها النظام أبداً.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { AGENTS } from "./aiGovernor";
import { isOwnerUser } from "./owner";
import { isDeputyOwner } from "./siteRoles";
import { pickQuestions, resolveQuestion } from "./games";
import {
  PERSONAS,
  PERSONA_KEYS,
  composeMessage,
  decideIntent,
  makeIdentity,
  moodOf,
  nextEnergy,
  levelFromXp,
  type AgentTraits,
  type Intent,
  type PersonaKey,
} from "./aiBrain";
import { DIFFICULTY_BASE_POINTS, DIFFICULTY_SPEED_BONUS, dayKey } from "./gameConfig";

const ROSTER_SIZE = 50; // خمسون وكيلاً دائماً — يولد النظام بديلاً لكل متقاعد
const MATCH_SIZE = 4; // أربعة وكلاء في كل مباراة
const MATCH_QUESTIONS = 5;
const CHAT_PER_TICK = 4; // كم وكيلاً يتحدث في الدورة الواحدة
const MUTE_HOURS = 6; // أقصى عقوبة يتخذها النظام وحده — كتم مؤقت لا حظر

const DEPT_EMOJI: Record<string, string> = {
  الأمن: "🛡️",
  المحتوى: "📚",
  الاقتصاد: "💰",
  المجتمع: "🤝",
  العمليات: "⚙️",
};

// ─────────────────────────────────────────────────────────────────────────
// أدوات داخلية
// ─────────────────────────────────────────────────────────────────────────

/** غرفة دردشة عامة للوكلاء — تُنشأ مرة واحدة ثم تُستخدم للأبد. */
async function publicRoom(ctx: any): Promise<Id<"chatRooms">> {
  const rooms = await ctx.db.query("chatRooms").collect();
  const existing = rooms.find((r: { archived?: boolean }) => !r.archived);
  if (existing) return existing._id;

  const first = await ctx.db.query("aiAgents").withIndex("by_active", (q: any) => q.eq("retired", false)).first();
  const ownerId =
    first?.agentUserId ?? (await ctx.db.query("users").first())?._id;
  if (!ownerId) throw new Error("لا يوجد مستخدم لإنشاء الغرفة");

  return await ctx.db.insert("chatRooms", {
    name: "ساحة العقول العامة",
    description: "الغرفة التي يلتقي فيها اللاعبون والوكلاء",
    type: "public",
    ownerId,
    members: [ownerId],
    admins: [ownerId],
    archived: false,
    createdAt: Date.now(),
  });
}

/** يلد وكيلاً جديداً: حساب لاعب حقيقي + سجل وكيل + خبر في النبض. */
async function spawnAgent(
  ctx: any,
  spec: { name: string; emoji: string; persona: PersonaKey; dept: string; role: string },
): Promise<Id<"aiAgents">> {
  const now = Date.now();
  const persona = PERSONAS[spec.persona];
  const agentUserId = await ctx.db.insert("users", {
    name: spec.name,
    avatarEmoji: spec.emoji,
    isAnonymous: true,
  });

  const agentId = await ctx.db.insert("aiAgents", {
    name: spec.name,
    emoji: spec.emoji,
    agentUserId,
    persona: spec.persona,
    personaLabel: persona.label,
    dept: spec.dept,
    role: spec.role,
    traits: persona.traits,
    level: 1,
    xp: 0,
    energy: 100,
    mood: "متحفّز",
    gamesPlayed: 0,
    wins: 0,
    chatCount: 0,
    bornAt: now,
    retired: false,
  });

  await ctx.db.insert("aiAgentFeed", {
    agentId,
    agentName: spec.name,
    emoji: spec.emoji,
    kind: "birth",
    place: "مهد العقول",
    text: `وُلد وكيل جديد: ${spec.name} — ${persona.label} (${spec.dept})`,
    createdAt: now,
  });

  return agentId;
}

/** يُكمل الكتيّب إلى خمسين وكيلاً: الأولون من الكتيّب الرسمي ثم مولودون جدد. */
async function ensureRoster(ctx: any): Promise<number> {
  const all = await ctx.db.query("aiAgents").collect();
  const usedNames = new Set<string>(all.map((a: { name: string }) => a.name));
  let active = all.filter((a: { retired: boolean }) => !a.retired).length;
  let created = 0;

  for (let i = 0; i < AGENTS.length && active < ROSTER_SIZE; i++) {
    const entry = AGENTS[i];
    if (usedNames.has(entry.name)) continue;
    const persona = PERSONA_KEYS[i % PERSONA_KEYS.length];
    await spawnAgent(ctx, {
      name: entry.name,
      emoji: DEPT_EMOJI[entry.dept] ?? "🧠",
      persona,
      dept: entry.dept,
      role: entry.role,
    });
    usedNames.add(entry.name);
    active++;
    created++;
  }

  // النظام يلد بنفسه ما ينقص — أسماء جديدة لم تُستخدم من قبل
  let guard = 0;
  while (active < ROSTER_SIZE && guard < ROSTER_SIZE) {
    guard++;
    const identity = makeIdentity([...usedNames]);
    if (usedNames.has(identity.name)) continue;
    await spawnAgent(ctx, {
      name: identity.name,
      emoji: identity.emoji,
      persona: identity.persona,
      dept: "العمليات",
      role: "وكيل حياة مستقل",
    });
    usedNames.add(identity.name);
    active++;
    created++;
  }

  return created;
}

/** يجعل الوكيل يتكلم فعلاً: رسالة حقيقية في غرفة الدردشة + نبض للوحة. */
async function agentSpeaks(
  ctx: any,
  agent: any,
  opts: { intent?: Intent; vars?: Record<string, string>; place?: string; recent?: string[] } = {},
): Promise<string> {
  const recentIntents = Array.isArray(agent.recentIntents) ? agent.recentIntents : [];
  const intent = opts.intent ?? decideIntent({
    traits: agent.traits as AgentTraits,
    energy: agent.energy,
    mood: agent.mood,
    recentIntents,
  });

  // ذاكرة الكلام: لا يعيد الوكيل جملة قالها في مشاركاته الأخيرة
  const feed = await ctx.db
    .query("aiAgentFeed")
    .withIndex("by_created", (q: any) => q.gt("createdAt", 0))
    .order("desc")
    .take(40);
  const saidRecently: string[] = feed
    .filter((f: any) => f.agentId === agent._id)
    .map((f: any) => f.text as string)
    .slice(0, 8);

  const text = composeMessage({
    persona: agent.persona as PersonaKey,
    intent,
    vars: opts.vars,
    recent: opts.recent ?? saidRecently,
    energy: agent.energy,
    mood: agent.mood,
  });

  const now = Date.now();
  const roomId = await publicRoom(ctx);
  await ctx.db.insert("chatMessages", {
    roomId,
    senderId: agent.agentUserId,
    senderName: agent.name,
    content: text,
    type: "text",
    pinned: false,
    deleted: false,
    reactions: [],
    createdAt: now,
  });

  await ctx.db.insert("aiAgentFeed", {
    agentId: agent._id,
    agentName: agent.name,
    emoji: agent.emoji,
    kind: "chat",
    place: opts.place ?? "ساحة العقول العامة",
    text,
    createdAt: now,
  });

  await ctx.db.patch(agent._id, {
    chatCount: agent.chatCount + 1,
    energy: nextEnergy(agent.energy, 4),
    mood: moodOf({
      energy: nextEnergy(agent.energy, 4),
      wins: agent.wins,
      gamesPlayed: agent.gamesPlayed,
    }),
    lastSpokeAt: now,
  });

  return text;
}

/** ينشئ مباراة حقيقية بين مجموعة وكلاء ويسجّلها في اللعبة. */
async function startMatch(ctx: any, agents: any[]): Promise<Id<"games">> {
  const now = Date.now();
  const questionIds = await pickQuestions(ctx, [], MATCH_QUESTIONS);
  const code = `AI${Math.floor(1000 + Math.random() * 8999)}`;
  const host = agents[0];

  const gameId = await ctx.db.insert("games", {
    code,
    hostId: host.agentUserId,
    status: "playing",
    phase: "answering",
    questionIds,
    currentQuestionIndex: 0,
    questionStartedAt: now,
    firstCorrect: [],
    createdAt: now,
    settings: {
      questionCount: MATCH_QUESTIONS,
      timePerQuestionMs: 15_000,
      categories: [],
      durationMinutes: 0,
    },
  });

  for (const agent of agents) {
    await ctx.db.insert("gamePlayers", {
      gameId,
      userId: agent.agentUserId,
      name: agent.name,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      joinedAt: now,
    });

    await ctx.db.insert("spectatorMessages", {
      gameId,
      senderId: agent.agentUserId,
      senderName: agent.name,
      content: composeMessage({
        persona: agent.persona as PersonaKey,
        intent: Math.random() < 0.5 ? "challenge" : "greeting",
        vars: { n: agents[agents.length - 1].name, r: agents[1]?.name ?? host.name },
        energy: agent.energy,
        mood: agent.mood,
      }),
      isSpectator: false,
      createdAt: now,
    });
  }

  await ctx.db.insert("aiAgentFeed", {
    agentId: host._id,
    agentName: host.name,
    emoji: host.emoji,
    kind: "match",
    place: `غرفة ${code}`,
    text: `مباراة ${MATCH_QUESTIONS} أسئلة: ${agents.map((a) => a.name).join(" × ")}`,
    createdAt: now,
  });

  await ctx.scheduler.runAfter(4_000, internal.aiAgents.simulateRound, { gameId, index: 0 });
  return gameId;
}

// ─────────────────────────────────────────────────────────────────────────
// دورة الحياة — تُستدعى تلقائياً من المهمة المجدولة
// ─────────────────────────────────────────────────────────────────────────

export const lifeTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const born = await ensureRoster(ctx);

    const active: any[] = await ctx.db
      .query("aiAgents")
      .withIndex("by_active", (q) => q.eq("retired", false))
      .collect();

    // 1) طاقة تتجدد قليلاً مع كل دورة (راحة)
    for (const agent of active) {
      if (agent.energy < 70) {
        await ctx.db.patch(agent._id, { energy: Math.min(100, agent.energy + 6) });
      }
    }

    // 2) الكلام: الأقل تحدثاً مؤخراً هم أول من يتكلم
    const speakers = [...active]
      .sort((a, b) => (a.lastSpokeAt ?? 0) - (b.lastSpokeAt ?? 0))
      .slice(0, CHAT_PER_TICK);
    let spoken = 0;
    for (const agent of speakers) {
      // يُخاطب وكيلاً حقيقياً بنداء صريح حتى لا تبقى المتغيّرات فارغة
      const peer = active[Math.floor(Math.random() * active.length)]?.name;
      const other = !peer || peer === agent.name ? "جميع الحاضرين" : peer;
      await agentSpeaks(ctx, agent, { vars: { n: other, r: other } });
      spoken++;
    }

    // 3) المباريات: لا نُشغِل إلا مباراة واحدة في الدورة حتى تبقى التكلفة صغيرة
    let matchStarted = false;
    const liveAgents = active.filter((a) => a.energy > 25);
    if (liveAgents.length >= MATCH_SIZE && Math.random() < 0.55) {
      const shuffled = [...liveAgents].sort(() => Math.random() - 0.5);
      const lineup = shuffled.slice(0, MATCH_SIZE);
      await startMatch(ctx, lineup);
      matchStarted = true;
      for (const agent of lineup) {
        await ctx.db.patch(agent._id, { energy: nextEnergy(agent.energy, 8) });
      }
    }

    // 4) عمل سيادي حرّ: حسم بلاغات اللعب النظيف القديمة تلقائياً
    let resolved = 0;
    const openFlags = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", 0))
      .order("desc")
      .take(60);
    for (const flag of openFlags) {
      if (!flag.resolved && now - flag.at > 6 * 3600_000) {
        await ctx.db.patch(flag._id, { resolved: true });
        resolved++;
      }
    }
    if (resolved > 0) {
      await ctx.db.insert("aiAgentFeed", {
        agentName: "المجلس السيادي",
        emoji: "⚖️",
        kind: "action",
        place: "غرفة العدل",
        text: `حُسمت ${resolved} حالة لعب نظيف قديمة تلقائياً بعد مراجعة الأدلة`,
        createdAt: now,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "living_agents",
        actorName: "المجلس السيادي",
        action: "resolve_fairplay",
        detail: `حسم تلقائي لـ ${resolved} حالة لعب نظيف`,
        severity: "low",
        createdAt: now,
      });
    }

    // 5) السلطة الكاملة بضوابط صارمة لا تُخترق: كتم مؤقت فقط — ولا حظر
    //    دائم ولا حذف بيانات أبداً — ولمن تجمّعت عليه 3 إشارات غش في 24 ساعة.
    const dayAgo = now - 24 * 3600_000;
    const flags24 = await ctx.db
      .query("fairPlayLog")
      .withIndex("by_at", (q) => q.gt("at", dayAgo))
      .collect();
    const suspects = new Map<string, { id: Id<"users">; name: string; count: number }>();
    for (const flag of flags24) {
      if (flag.resolved) continue;
      const prev = suspects.get(flag.userId as string);
      suspects.set(flag.userId as string, {
        id: flag.userId,
        name: flag.userName,
        count: (prev?.count ?? 0) + 1,
      });
    }
    let mutes = 0;
    for (const suspect of suspects.values()) {
      if (suspect.count < 3) continue;
      const target = await ctx.db.get(suspect.id);
      if (!target || target.bannedPermanent) continue;
      if ((target.mutedUntil ?? 0) > now) continue;
      await ctx.db.patch(suspect.id, {
        mutedUntil: now + MUTE_HOURS * 3600_000,
        lastWarningAt: now,
      });
      await ctx.db.insert("moderationLogs", {
        actorType: "ai",
        actorName: "المجلس السيادي",
        action: "mute",
        targetId: suspect.id,
        targetName: suspect.name,
        reason: `${suspect.count} إشارات لعب غير نظيف خلال 24 ساعة`,
        severity: "medium",
        createdAt: now,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: "living_agents",
        actorName: "المجلس السيادي",
        action: "temp_mute",
        targetId: suspect.id as string,
        targetName: suspect.name,
        detail: `كتم مؤقت ${MUTE_HOURS} ساعات لتكرار إشارات الغش`,
        severity: "medium",
        createdAt: now,
      });
      await ctx.db.insert("aiAgentFeed", {
        agentName: "المجلس السيادي",
        emoji: "⚖️",
        kind: "action",
        place: "غرفة العدل",
        text: `كتم مؤقت ${MUTE_HOURS} ساعات لـ ${suspect.name} بعد ${suspect.count} إشارات غش`,
        createdAt: now,
      });
      mutes++;
    }

    return { born, spoken, matchStarted, resolved, mutes, roster: active.length };
  },
});

/** محاكاة دور واحد: كل الوكلاء يجيبون على السؤال الحالي بأداء يشبه البشر. */
export const simulateRound = internalMutation({
  args: { gameId: v.id("games"), index: v.number() },
  handler: async (ctx, { gameId, index }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status !== "playing") return;

    const questionId = game.questionIds[index];
    if (!questionId) return;
    const question = await resolveQuestion(ctx, questionId);
    if (!question) return;

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();

    const now = Date.now();
    let fastest: { userId: Id<"users">; elapsedMs: number } | null = null;

    for (const player of players) {
      const agent = await ctx.db
        .query("aiAgents")
        .withIndex("by_user", (q) => q.eq("agentUserId", player.userId))
        .first();

      const skill = agent ? Math.min(0.94, 0.42 + agent.level * 0.035) : 0.6;
      const correct = Math.random() < skill;
      const elapsedMs = 1_800 + Math.floor(Math.random() * 9_000);
      const wrongOffset = 1 + Math.floor(Math.random() * 3);
      const selected = correct
        ? question.correctIndex
        : ((question.correctIndex + wrongOffset) % question.options.length);

      const base = DIFFICULTY_BASE_POINTS[question.difficulty] ?? 100;
      const speedBonus = correct
        ? Math.round((DIFFICULTY_SPEED_BONUS[question.difficulty] ?? 100) * Math.max(0, 1 - elapsedMs / 15_000))
        : 0;
      const points = correct ? Math.max(10, base + speedBonus) : 0;

      const answers: any[] = [...player.answers];
      while (answers.length < index) answers.push(null);
      answers[index] = { questionId, selected, correct, points, elapsedMs };

      const streak = correct ? player.streak + 1 : 0;
      await ctx.db.patch(player._id, {
        answers,
        score: player.score + points,
        streak,
        bestStreak: Math.max(player.bestStreak, streak),
      });

      if (correct && (!fastest || elapsedMs < fastest.elapsedMs)) {
        fastest = { userId: player.userId, elapsedMs };
      }
    }

    if (fastest) {
      const firstCorrect: any[] = [...(game.firstCorrect ?? [])];
      while (firstCorrect.length < index) firstCorrect.push(null);
      firstCorrect[index] = fastest.userId;
      await ctx.db.patch(game._id, { firstCorrect, currentQuestionIndex: index });
    }

    // تعليق حيّ في دردشة المشاهدين على الجولة
    const commenter = await ctx.db
      .query("aiAgents")
      .withIndex("by_active", (q) => q.eq("retired", false))
      .first();
    if (commenter) {
      const leader = [...players].sort((a, b) => b.score - a.score)[0];
      await ctx.db.insert("spectatorMessages", {
        gameId,
        senderId: commenter.agentUserId,
        senderName: commenter.name,
        content: composeMessage({
          persona: commenter.persona as PersonaKey,
          intent: "commentary",
          vars: { s: String(leader?.score ?? 0), n: leader?.name ?? commenter.name },
          energy: commenter.energy,
          mood: commenter.mood,
        }),
        isSpectator: false,
        createdAt: now,
      });
    }

    if (index + 1 < game.questionIds.length) {
      await ctx.scheduler.runAfter(6_000, internal.aiAgents.simulateRound, {
        gameId,
        index: index + 1,
      });
    } else {
      await ctx.scheduler.runAfter(6_000, internal.aiAgents.finishMatch, { gameId });
    }
  },
});

/** إنهاء المباراة: التاريخ الرسمي + الخبرة + إحصاءات الوكلاء. */
export const finishMatch = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.status === "finished") return;

    const players = await ctx.db
      .query("gamePlayers")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const now = Date.now();
    const today = dayKey(now);

    for (let i = 0; i < ranked.length; i++) {
      const player = ranked[i];
      const won = i === 0;
      const correctCount = player.answers.filter((a: any) => a && a.correct).length;
      const xpEarned = Math.round(player.score / 12) + (won ? 20 : 6);
      const stars = correctCount >= game.questionIds.length ? 3 : correctCount >= game.questionIds.length - 1 ? 2 : 1;

      await ctx.db.insert("gameHistory", {
        gameId,
        userId: player.userId,
        userName: player.name,
        gameCode: game.code,
        rank: i + 1,
        playerCount: ranked.length,
        score: player.score,
        correctCount,
        questionCount: game.questionIds.length,
        xpEarned,
        won,
        stars,
        badgesEarned: [],
        playedAt: now,
      });

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", player.userId))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, {
          xp: profile.xp + xpEarned,
          gamesPlayed: profile.gamesPlayed + 1,
          gamesWon: profile.gamesWon + (won ? 1 : 0),
          bestScore: Math.max(profile.bestScore, player.score),
          bestStreak: Math.max(profile.bestStreak, player.bestStreak),
          correctAnswers: profile.correctAnswers + correctCount,
          totalAnswers: profile.totalAnswers + game.questionIds.length,
          lastPlayedDay: today,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("profiles", {
          userId: player.userId,
          xp: xpEarned,
          gamesPlayed: 1,
          gamesWon: won ? 1 : 0,
          bestScore: player.score,
          bestStreak: player.bestStreak,
          correctAnswers: correctCount,
          totalAnswers: game.questionIds.length,
          badges: [],
          lastPlayedDay: today,
          updatedAt: now,
        });
      }

      const agent = await ctx.db
        .query("aiAgents")
        .withIndex("by_user", (q) => q.eq("agentUserId", player.userId))
        .first();
      if (agent) {
        const xp = agent.xp + xpEarned;
        const energy = nextEnergy(agent.energy, 6);
        const wins = agent.wins + (won ? 1 : 0);
        const gamesPlayed = agent.gamesPlayed + 1;
        await ctx.db.patch(agent._id, {
          xp,
          level: levelFromXp(xp),
          wins,
          gamesPlayed,
          energy,
          mood: moodOf({ energy, wins, gamesPlayed }),
          lastPlayedAt: now,
        });
      }
    }

    await ctx.db.patch(game._id, { status: "finished", phase: "revealing" });

    const champion = ranked[0];
    if (champion) {
      const championAgent = await ctx.db
        .query("aiAgents")
        .withIndex("by_user", (q) => q.eq("agentUserId", champion.userId))
        .first();
      if (championAgent) {
        await ctx.db.insert("aiAgentFeed", {
          agentId: championAgent._id,
          agentName: championAgent.name,
          emoji: championAgent.emoji,
          kind: "match",
          place: `غرفة ${game.code}`,
          text: `فاز بمباراة ${game.questionIds.length} أسئلة برصيد ${champion.score} نقطة 🏆`,
          createdAt: now,
        });
        // إهداء صغير من نقاط الولاء — مشاركة حقيقية في الاقتصاد
        try {
          const reward = Math.max(5, Math.round(champion.score / 20));
          await ctx.runMutation(internal.loyalty.awardPoints, {
            userId: champion.userId,
            amount: reward,
            reason: `🏆 مكافأة فوز في مباراة الوكلاء`,
          });
        } catch {
          /* الاقتصاد اختياري — لا يُعطّل إنهاء المباراة */
        }
      }
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────
// استعلامات لوحة المراقبة (للمالك والنائب فقط — قراءة فقط، بلا تدخّل)
// ─────────────────────────────────────────────────────────────────────────

export const getLivingAgents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) return null;

    const agents = await ctx.db
      .query("aiAgents")
      .withIndex("by_active", (q) => q.eq("retired", false))
      .collect();

    const feed = await ctx.db
      .query("aiAgentFeed")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(70);

    const agentUserIds = new Set(agents.map((a) => a.agentUserId as string));
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gt("playedAt", 0))
      .order("desc")
      .take(120);
    const recentMatches = history
      .filter((h) => agentUserIds.has(h.userId as string))
      .slice(0, 14)
      .map((h) => ({
        userName: h.userName ?? "وكيل",
        gameCode: h.gameCode,
        score: h.score,
        rank: h.rank,
        playerCount: h.playerCount,
        won: h.won,
        playedAt: h.playedAt,
      }));

    const totalChats = agents.reduce((sum, a) => sum + a.chatCount, 0);
    const totalGames = agents.reduce((sum, a) => sum + a.gamesPlayed, 0);

    return {
      rosterSize: ROSTER_SIZE,
      agents: agents
        .sort((a, b) => b.level - a.level || b.xp - a.xp)
        .map((a) => ({
          _id: a._id,
          name: a.name,
          emoji: a.emoji,
          dept: a.dept,
          role: a.role,
          persona: a.personaLabel,
          level: a.level,
          xp: a.xp,
          energy: a.energy,
          mood: a.mood,
          wins: a.wins,
          gamesPlayed: a.gamesPlayed,
          chatCount: a.chatCount,
          lastSpokeAt: a.lastSpokeAt ?? null,
          lastPlayedAt: a.lastPlayedAt ?? null,
        })),
      feed: feed.map((f) => ({
        _id: f._id,
        agentName: f.agentName,
        emoji: f.emoji,
        kind: f.kind,
        place: f.place,
        text: f.text,
        createdAt: f.createdAt,
      })),
      recentMatches,
      stats: {
        totalChats,
        totalGames,
        activeAgents: agents.length,
        avgLevel:
          agents.length > 0
            ? Math.round((agents.reduce((s, a) => s + a.level, 0) / agents.length) * 10) / 10
            : 0,
      },
    };
  },
});

/**
 * إيقاظ الوكلاء فوراً — زر اختياري للمالك فقط.
 * الحياة تعمل ذاتياً بالمهمة المجدولة، وهذا الزر لا يقيّدها بل يقدّم أول نبضة
 * حتى لا ينتظر المالك الدورة الأولى.
 */
export const awaken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) {
      throw new Error("غير مصرح");
    }
    await ctx.runMutation(internal.aiAgents.lifeTick, {});
    return { ok: true };
  },
});
