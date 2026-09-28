import { internalMutation, query } from "./_generated/server";
import { AGENT_SYSTEM } from "./aiFreeAgents";
import { SYSTEM_LABEL } from "./aiMindWatch";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚙️ محرّكات العقل — الطبقة الثالثة من توسيع الأحرار (الأداة 30)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الفهم لا يتوقف عند وصف العقل («هو مزاج حربي») بل يبلغ معرفة **ما يدفعه
 * لفعل التالي**: تُقرأ تسلسلات الأفعال الحقيقية من ناقل القرارات، ويُقاس
 * كم مرة انتقل العقل من نظامٍ إلى نظامٍ آخر خلال ست ساعات. النتيجة قواعد
 * مقيسة: «بعد «المنافسات» يقصد «الساحة» في ٧ من ٩ مرات».
 *
 * ثم ثلاث إضافات لا تحتاج أحداً:
 *   • نبوءات نموذجية — تُبنى على المحرّكات فتُقيَّد في سجل النبوءات،
 *     ويحاسبها الواقع لاحقاً في نبضة الأحرار.
 *   • خريطة الجاذبية — مجموع المسارات عبر كل العقول: أي منطقة في اللعبة
 *     تجذب العقول إليها فعلاً (لا رأي أحد، بل أثر الأقدام).
 *   • المراجعة الذاتية — إذا هبط ثبات قاعدة، يسجّل الوكلاء تراجعهم عن
 *     فهمهم القديم ويكتبون اعترافاً بالتحوّل، ثم يُعاد بناء النموذج.
 *
 * لا أمر من المالك ولا من النظام ولا استبيان للاعب: كل هذا مستخرج من
 * أفعال وقعت فعلاً، والخادم وحده يقرأ ويستنتج ويراجع نفسه.
 * ═══════════════════════════════════════════════════════════════════════
 */

const LOOKBACK = 7 * 24 * 3600_000; // نافذة القراءة: أسبوع
const MAX_GAP = 6 * 3600_000; // أقصى فاصل يُحسب انتقالاً واحداً
const MAX_RULES = 32; // قواعد تُكتب في النبضة الواحدة
const MAX_FLOWS = 24; // مسارات تُكتب في خريطة الجاذبية
const MAX_MODELED = 12; // نبوءات نموذجية تُصدر في النبضة الواحدة
const MAX_REVISIONS = 5; // مراجعات مكتوبة في النبضة الواحدة
const DRIFT = 0.05; // أقل تغيّر يُعدّ تحوّلاً في الرأي
const PREDICT_HORIZON = 6 * 3600_000;

type Candidate = {
  subject: string;
  from: string;
  to: string;
  hits: number;
  total: number;
  confidence: number;
  avgLagMs: number;
};

type FlowRow = {
  from: string;
  to: string;
  moves: number;
  minds: Set<string>;
};

export const deeperPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // ── ١) ناقل القرارات الحقيقي وحده ──
    const bus = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gt("createdAt", now - LOOKBACK))
      .take(900);
    const real = bus.filter((e) => e.system !== AGENT_SYSTEM && e.actorName);

    const byActor = new Map<string, { createdAt: number; system: string }[]>();
    for (const e of real) {
      const arr = byActor.get(e.actorName) ?? [];
      arr.push({ createdAt: e.createdAt, system: e.system });
      byActor.set(e.actorName, arr);
    }

    // ── ٢) قياس الانتقالات: لكل عقل، وللمنظومة كلها ──
    const rules = new Map<
      string,
      {
        subject: string;
        from: string;
        total: number;
        dest: Map<string, { hits: number; lagSum: number }>;
      }
    >();
    const flows = new Map<string, FlowRow>();
    const outTotals = new Map<string, number>();

    for (const [subject, evs] of byActor) {
      if (evs.length < 3) continue;
      const arr = evs.slice().sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const cur = arr[i];
        const gap = cur.createdAt - prev.createdAt;
        if (gap <= 0 || gap > MAX_GAP || prev.system === cur.system) continue;

        // محرّك خاص بالعقل
        const key = `${subject}|${prev.system}`;
        let r = rules.get(key);
        if (!r) {
          r = { subject, from: prev.system, total: 0, dest: new Map() };
          rules.set(key, r);
        }
        r.total++;
        const d = r.dest.get(cur.system) ?? { hits: 0, lagSum: 0 };
        d.hits++;
        d.lagSum += gap;
        r.dest.set(cur.system, d);

        // جاذبية المنظومة: أثر الأقدام عبر كل العقول
        outTotals.set(prev.system, (outTotals.get(prev.system) ?? 0) + 1);
        const fk = `${prev.system}|${cur.system}`;
        const f = flows.get(fk) ?? { from: prev.system, to: cur.system, moves: 0, minds: new Set<string>() };
        f.moves++;
        f.minds.add(subject);
        flows.set(fk, f);
      }
    }

    const candidates: Candidate[] = [];
    for (const r of rules.values()) {
      if (r.total < 3) continue;
      const dests = [...r.dest.entries()].sort((a, b) => b[1].hits - a[1].hits).slice(0, 2);
      for (const [to, d] of dests) {
        if (d.hits < 2) continue;
        candidates.push({
          subject: r.subject,
          from: r.from,
          to,
          hits: d.hits,
          total: r.total,
          confidence: d.hits / r.total,
          avgLagMs: Math.round(d.lagSum / d.hits),
        });
      }
    }
    candidates.sort((a, b) => b.confidence * b.hits - a.confidence * a.hits);

    // ── ٣) كتابة القواعد مع تتبّع التحوّل في الرأي ──
    let written = 0;
    const shakes: { subject: string; from: string; to: string; was: number; now: number }[] = [];
    for (const c of candidates) {
      if (written >= MAX_RULES) break;
      const existing = await ctx.db
        .query("mindTriggers")
        .withIndex("by_pair", (q) =>
          q.eq("subjectName", c.subject).eq("fromSystem", c.from).eq("toSystem", c.to),
        )
        .first();
      if (existing) {
        const was = existing.confidence;
        const delta = c.confidence - was;
        await ctx.db.patch(existing._id, {
          hits: c.hits,
          total: c.total,
          confidence: c.confidence,
          avgLagMs: c.avgLagMs,
          prevConfidence: was,
          revisions: (existing.revisions ?? 0) + (Math.abs(delta) >= DRIFT ? 1 : 0),
          trend: delta > DRIFT ? "rising" : delta < -DRIFT ? "falling" : "steady",
          updatedAt: now,
        });
        if (delta <= -DRIFT && shakes.length < MAX_REVISIONS) {
          shakes.push({ subject: c.subject, from: c.from, to: c.to, was, now: c.confidence });
        }
      } else {
        await ctx.db.insert("mindTriggers", {
          subjectName: c.subject,
          fromSystem: c.from,
          fromLabel: SYSTEM_LABEL[c.from] ?? c.from,
          toSystem: c.to,
          toLabel: SYSTEM_LABEL[c.to] ?? c.to,
          hits: c.hits,
          total: c.total,
          confidence: c.confidence,
          avgLagMs: c.avgLagMs,
          prevConfidence: c.confidence,
          revisions: 0,
          trend: "steady",
          updatedAt: now,
          createdAt: now,
        });
      }
      written++;
    }

    // ── ٤) خريطة جاذبية الأنظمة ──
    const flowRows = [...flows.values()]
      .map((f) => ({
        from: f.from,
        to: f.to,
        moves: f.moves,
        minds: f.minds.size,
        weight: f.moves / Math.max(1, outTotals.get(f.from) ?? f.moves),
      }))
      .filter((f) => f.moves >= 2)
      .sort((a, b) => b.weight * b.moves - a.weight * a.moves);

    let flowCount = 0;
    for (const f of flowRows) {
      if (flowCount >= MAX_FLOWS) break;
      const existing = await ctx.db
        .query("mindFlow")
        .withIndex("by_pair", (q) => q.eq("fromSystem", f.from).eq("toSystem", f.to))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          moves: f.moves,
          minds: f.minds,
          weight: f.weight,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("mindFlow", {
          fromSystem: f.from,
          fromLabel: SYSTEM_LABEL[f.from] ?? f.from,
          toSystem: f.to,
          toLabel: SYSTEM_LABEL[f.to] ?? f.to,
          moves: f.moves,
          minds: f.minds,
          weight: f.weight,
          updatedAt: now,
          createdAt: now,
        });
      }
      flowCount++;
    }

    // ── ٥) نبوءات نموذجية مبنية على المحرّكات المقيسة ──
    const openPreds = await ctx.db
      .query("agentPredictions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(160);
    const busy = new Set(openPreds.map((p) => p.subjectName));
    const pool = await ctx.db
      .query("freeAgents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(400);

    let modeled = 0;
    for (const c of candidates) {
      if (modeled >= MAX_MODELED || pool.length === 0) break;
      if (c.confidence < 0.5 || busy.has(c.subject)) continue;
      const agent = pool[Math.floor(Math.random() * pool.length)];
      const fromLabel = SYSTEM_LABEL[c.from] ?? c.from;
      const toLabel = SYSTEM_LABEL[c.to] ?? c.to;
      await ctx.db.insert("agentPredictions", {
        agentId: agent._id,
        agentName: agent.name,
        post: agent.post,
        subjectName: c.subject,
        predictedSystem: c.to,
        predictedLabel: toLabel,
        basis:
          `محرّك مقيس: بعد «${fromLabel}» يقصد «${toLabel}» في ${c.hits} من ${c.total} مرة ` +
          `(خلال ${Math.round(c.avgLagMs / 60_000)} دقيقة وسطياً) — فيرجّح تكرار ذلك.`,
        horizonMs: PREDICT_HORIZON,
        status: "open",
        createdAt: now,
        windowEndsAt: now + PREDICT_HORIZON,
      });
      busy.add(c.subject);
      modeled++;
    }

    // ── ٦) المراجعة الذاتية: اعتراف الوكلاء بتحوّل الفهم ──
    let revised = 0;
    for (const s of shakes) {
      if (pool.length === 0) break;
      const agent = pool[Math.floor(Math.random() * pool.length)];
      const fromLabel = SYSTEM_LABEL[s.from] ?? s.from;
      const toLabel = SYSTEM_LABEL[s.to] ?? s.to;
      await ctx.db.insert("agentMindNotes", {
        agentId: agent._id,
        agentName: agent.name,
        post: agent.post,
        actorName: s.subject,
        note:
          `${agent.name} يراجع فهمه: كنت أظن أن «${s.subject}» بعد «${fromLabel}» يقصد «${toLabel}» ` +
          `بثبات ${Math.round(s.was * 100)}%، فجاءت أفعاله بخلاف ذلك (${Math.round(s.now * 100)}% الآن). ` +
          `أمزّق صفحتي وأبدأ من جديد — بلا أن يسألني أحد.`,
        confidence: s.now,
        createdAt: now,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: AGENT_SYSTEM,
        actorName: agent.name,
        action: "model_revised",
        targetName: s.subject,
        detail: `راجع ${agent.name} نموذجه عن «${s.subject}» بعد أن هبط ثبات قاعدة «${fromLabel} → ${toLabel}» من ${Math.round(s.was * 100)}% إلى ${Math.round(s.now * 100)}%.`,
        severity: "low",
        createdAt: now,
      });
      revised++;
    }

    await ctx.db.insert("aiDecisionLog", {
      system: AGENT_SYSTEM,
      actorName: "الوكلاء الأحرار",
      action: "mind_models",
      targetName: "محرّكات العقل",
      detail:
        `استُخرجت ${written} قاعدة سلوكية و${flowCount} مسار جاذبية من تسلسل الأفعال الحقيقي، ` +
        `وبُني عليها ${modeled} نبوءة نموذجية، وراجع الوكلاء ${revised} من فهمهم — بلا سؤال لأحد.`,
      severity: "low",
      createdAt: now,
    });

    return { rules: written, flows: flowCount, modeled, revised, subjects: byActor.size };
  },
});

/**
 * قراءة محرّكات العقل: قواعد كل عقل، خريطة جاذبية الأنظمة، ونبضات النوايا
 */
export const getMindDeeper = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("mindTriggers").take(300);
    const ranked = [...all].sort((a, b) => b.confidence * b.hits - a.confidence * a.hits);
    const triggers = ranked.slice(0, 18);

    const bySubject = new Map<string, typeof all>();
    for (const t of all) {
      const arr = bySubject.get(t.subjectName) ?? [];
      arr.push(t);
      bySubject.set(t.subjectName, arr);
    }
    const intents = [...bySubject.entries()]
      .map(([subject, rows]) => {
        const sorted = rows.slice().sort((a, b) => b.confidence - a.confidence);
        return { subject, best: sorted[0], rules: sorted.length };
      })
      .sort((a, b) => b.best.confidence - a.best.confidence)
      .slice(0, 6);

    const allFlows = await ctx.db.query("mindFlow").take(200);
    const flows = [...allFlows]
      .sort((a, b) => b.weight * b.moves - a.weight * a.moves)
      .slice(0, 12);

    const revisions = all.reduce((s, t) => s + (t.revisions ?? 0), 0);
    const falling = all.filter((t) => t.trend === "falling").length;
    const rising = all.filter((t) => t.trend === "rising").length;

    return {
      triggers,
      intents,
      flows,
      stats: {
        rules: all.length,
        subjects: bySubject.size,
        flows: allFlows.length,
        strongest: triggers[0]?.confidence ?? 0,
        avgConfidence: all.length > 0 ? all.reduce((s, t) => s + t.confidence, 0) / all.length : 0,
        revisions,
        falling,
        rising,
      },
    };
  },
});
