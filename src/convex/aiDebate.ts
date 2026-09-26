import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ⚖️ مجلس العقول الدائم (Standing Council of Minds)
 *
 * الأداة التي تُحوّل خلافات الذكاء من «إشعار معلّق» إلى **مناظرة حية**.
 *
 * المشكلة: وحدات AI العشر تتضارب (الحارس يريد كتماً والمُنسّق يريد تهدئة،
 * المدقق يرفض أسئلة والمولّد يريد تعبئة…) — الخلافات تُكتشف في aiConflicts
 * وتنتظر قرار المالك. لكن المالك لا يستطيع البقاء 24 ساعة.
 *
 * الحل: عندما يُكتشف خلاف، يُفتح **ملف مناظرة** في المجلس:
 *  1) ⚔️ طرفا النزاع يعرضان موقفيهما (من بيانات الوحدتين الحقيقية)
 *  2) 🗣️ ثلاثة وزراء AI يتحاجلون: المحامي (يدافع عن الطرف الأقوى حجية)،
 *     النقيض (هاجم أضعف الحجتين)، السيناتور (محايد يوازن بالبيانات)
 *  3) 📜 الحكم: قرار موزون + نسبة ثقة + توصية للمالك — يُنفَّذ آلياً إن
 *     كانت الثقة عالية، ويُرفع للمالك إن كانت حرجة.
 *
 * النتيجة: الخلافات تُحل بالحوار المُحكم بدل أن تتراكم صامتة.
 */

const DAY = 24 * 3600_000;
const HIGH_CONFIDENCE = 75; // فوقها يُنفَّذ الحكم آلياً

// ── 1) رصد خلاف مفتوح وفتح ملف مناظرة ───────────────────────────────────

export const openDebateForConflict = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const conflicts = await ctx.db
      .query("aiConflicts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(10);
    if (conflicts.length === 0) return { opened: 0 };

    // ملف مناظرة نشط لكل خلاف؟ لا تكرار
    const activeDebates = await ctx.db
      .query("aiDebates")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(50);
    const takenKeys = new Set(activeDebates.map((d) => d.conflictKey));

    let opened = 0;
    for (const c of conflicts) {
      if (takenKeys.has(c.key)) continue;
      await ctx.db.insert("aiDebates", {
        conflictKey: c.key,
        target: c.target,
        unitA: c.unitA,
        unitB: c.unitB,
        stanceA: c.summaryA,
        stanceB: c.summaryB,
        severity: c.severity,
        speeches: [],
        status: "open",
        createdAt: now,
      });
      opened += 1;
    }
    return { opened };
  },
});

// ── 2) المناظرة الحية: الوزراء الثلاثة (action بذكاء حقيقي) ──────────────

type Speech = { role: string; speaker: string; text: string; side?: "A" | "B" | "neutral" };

export const runDebate = internalAction({
  handler: async (ctx: ActionCtx, { debateId }: { debateId: any }) => {
    const doc = (await ctx.runQuery("aiDebate:getDebateInternal" as any, { id: String(debateId) })) as {
      _id: string;
      target: string;
      unitA: string;
      unitB: string;
      stanceA: string;
      stanceB: string;
      severity: string;
    } | null;
    if (!doc) return { skipped: true as const };

    await ensureAiRuntime(ctx as never);

    const speeches: Speech[] = [];
    const llmOn = getOpenRouterKey();

    const baseCtx = `النزاع حول: «${doc.target}»\nالطرف ${doc.unitA}: ${doc.stanceA}\nالطرف ${doc.unitB}: ${doc.stanceB}\nالخطورة: ${doc.severity}`;

    if (llmOn) {
      // المحامي: يدافع عن الطرف A
      try {
        const advocate = await callLlm(
          [
            { role: "system", content: "أنت المحامي في مجلس عقول — تدافع بحجة واحدة قوية ومقتضبة عن الطرف الأول في نزاع بين وحدتي ذكاء لإدارة لعبة أسئلة. سطر واحد، بيانات قبل عاطفة." },
            { role: "user", content: baseCtx },
          ],
          120, 0.7, "MindClash Debate Advocate",
        );
        speeches.push({ role: "advocate", speaker: "المحامي", text: advocate.trim().slice(0, 200), side: "A" });
      } catch { /* يكمل بلا هذا الوزير */ }

      // النقيض: يهاجم أضعف حجة
      try {
        const nemesis = await callLlm(
          [
            { role: "system", content: "أنت النقيض في مجلس عقول — مهمتك مهاجمة أضعف حجة في النزاع بغضون سطر واحد حاد وموجز. لا محاباة، هجوم تحليلي صريح." },
            { role: "user", content: baseCtx },
          ],
          120, 0.8, "MindClash Debate Nemesis",
        );
        speeches.push({ role: "nemesis", speaker: "النقيض", text: nemesis.trim().slice(0, 200), side: "B" });
      } catch { /* يكمل */ }

      // السيناتور: يوازن ويحكم
      try {
        const senator = await callLlm(
          [
            { role: "system", content: "أنت السيناتور المحايد في مجلس عقول — تصدر حكماً موزوناً في سطرين: قرار واضح + مبرر رقمي. اختر طرفاً أو حل وسط، لكن لا تتردد." },
            { role: "user", content: baseCtx + "\n\nالمناظرة حتى الآن: " + speeches.map((s) => `${s.speaker}: ${s.text}`).join(" | ") },
          ],
          200, 0.5, "MindClash Debate Senator",
        );
        speeches.push({ role: "senator", speaker: "السيناتور", text: senator.trim().slice(0, 300), side: "neutral" });
      } catch { /* يكمل */ }
    }

    // البديل المحلي: خطاب مولّد من البيانات نفسها بلا LLM
    if (speeches.length === 0) {
      speeches.push(
        { role: "advocate", speaker: "المحامي", text: `موقف ${doc.unitA} مبنياً على مؤشرات أقوى: ${doc.stanceA}`, side: "A" },
        { role: "nemesis", speaker: "النقيض", text: `لكن خطر ${doc.unitB} حقيقي: ${doc.stanceB} — تجاهله مكلف.`, side: "B" },
        { role: "senator", speaker: "السيناتور", text: `الحكم المؤقت: تُرجَّح قراءة ${doc.unitA} إلا إذا تكررت إشارات ${doc.unitB} في 48 ساعة.`, side: "neutral" },
      );
    }

    // استخراج الحكم ودرجة الثقة
    const senatorText = speeches.find((s) => s.role === "senator")?.text ?? "";
    const lower = senatorText.toLowerCase();
    let verdict = senatorText || `ترجيح ${doc.unitA}`;
    let confidence = 60;
    let winner: "A" | "B" | "split" = "A";
    if (/حل وسط|توازن|خطوة تدريجية|مرحلة/.test(senatorText)) { winner = "split"; confidence = 70; }
    else if (new RegExp(doc.unitB.split(/\s+/)[0] ?? "", "i").test(lower)) { winner = "B"; confidence = 68; }
    if (/بثقة عالية|واضح|بلا تردد/.test(lower)) confidence += 12;
    if (doc.severity === "critical") confidence -= 10;
    confidence = Math.max(30, Math.min(95, confidence));

    await ctx.runMutation("aiDebate:closeDebate" as any, {
      debateId: String(debateId),
      speeches,
      verdict,
      winner,
      confidence,
    });
    return { done: true as const, confidence };
  },
});

export const getDebateInternal = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db.query("aiDebates").take(200);
    return rows.find((r) => r._id === id) ?? null;
  },
});

export const closeDebate = internalMutation({
  args: {
    debateId: v.string(),
    speeches: v.array(v.object({ role: v.string(), speaker: v.string(), text: v.string(), side: v.optional(v.string()) })),
    verdict: v.string(),
    winner: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, { debateId, speeches, verdict, winner, confidence }) => {
    const now = Date.now();
    const rows = await ctx.db.query("aiDebates").take(200);
    const doc = rows.find((r) => r._id === debateId);
    if (!doc) return;

    const autoExecute = confidence >= HIGH_CONFIDENCE;
    await ctx.db.patch(doc._id, {
      speeches: speeches.map((s) => ({ ...s, side: s.side ?? "neutral" })),
      verdict,
      winner,
      confidence,
      status: "resolved",
      autoExecuted: autoExecute,
      resolvedAt: now,
    });

    // أغلق الخلاف الأصلي
    const conflicts = await ctx.db
      .query("aiConflicts")
      .withIndex("by_key", (q) => q.eq("key", doc.conflictKey))
      .take(1);
    if (conflicts[0]) {
      await ctx.db.patch(conflicts[0]._id, {
        status: "resolved",
        winner: winner === "A" ? doc.unitA : winner === "B" ? doc.unitB : "وسط",
        resolution: verdict,
        resolvedBy: autoExecute ? "مجلس العقول (آلي)" : "مجلس العقول (للمراجعة)",
        resolvedAt: now,
      });
    }

    await ctx.db.insert("aiDecisionLog", {
      system: "debate",
      actorName: "مجلس العقول",
      action: "debate_resolved",
      targetName: doc.target,
      detail: `${autoExecute ? "نُفِّذ آلياً" : "بانتظار المالك"} (ثقة ${confidence}%): ${verdict.slice(0, 120)}`,
      severity: doc.severity === "critical" ? "high" : doc.severity === "warning" ? "medium" : "low",
      createdAt: now,
    });
  },
});

// ── 3) المهمة الدورية: افتح ملفات لكل خلاف معلّق ثم حاورها ───────────────

export const debateJob = internalMutation({
  handler: async (ctx) => {
    const { opened } = (await ctx.runMutation(internal.aiDebate.openDebateForConflict, {})) as { opened: number };
    // المناظرات تُشغَّل كأفعال مؤجلة — ملف واحد لكل مرة لتفادي ضغط الـ LLM
    const openDebates = await ctx.db
      .query("aiDebates")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(1);
    if (openDebates[0]) {
      await ctx.scheduler.runAfter(0, internal.aiDebate.runDebateAction, { debateId: openDebates[0]._id });
    }
    return { opened, debating: openDebates.length };
  },
});

export const runDebateAction = internalAction({
  handler: async (ctx: ActionCtx, { debateId }: { debateId: any }): Promise<unknown> => {
    return ctx.runAction(internal.aiDebate.runDebate, { debateId });
  },
});

// ── 4) قراءات الواجهة ────────────────────────────────────────────────────

export const getDebates = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("aiDebates").take(30);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getStats = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("aiDebates").take(200);
    const resolved = rows.filter((r) => r.status === "resolved");
    const auto = resolved.filter((r) => r.autoExecuted);
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      resolved: resolved.length,
      autoExecuted: auto.length,
      avgConfidence:
        resolved.length > 0
          ? Math.round(resolved.reduce((s, r) => s + (r.confidence ?? 0), 0) / resolved.length)
          : null,
    };
  },
});

// ── 5) قرار المالك: تجاوز حكم المجلس ─────────────────────────────────────

export const ownerOverride = mutation({
  args: { debateId: v.id("aiDebates"), decision: v.string() },
  handler: async (ctx, { debateId, decision }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    const doc = await ctx.db.get(debateId);
    if (!doc) throw new Error("ملف غير موجود");

    await ctx.db.insert("aiDecisionLog", {
      system: "debate",
      actorName: me.name ?? "المالك",
      action: "debate_override",
      targetName: doc.target,
      detail: decision.slice(0, 200),
      severity: "medium",
      createdAt: Date.now(),
    });
    return { recorded: true as const };
  },
});
