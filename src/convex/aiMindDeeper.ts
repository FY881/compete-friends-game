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
 * ثم تُبنى على هذه القواعد **نبوءات نموذجية** أدقّ من التخمين، فتُقيَّد في
 * نفس سجل النبوءات ويحاسبها الواقع لاحقاً في نبضة الأحرار.
 *
 * لا أمر من المالك ولا من النظام ولا استبيان للاعب: كل هذا مستخرج من
 * أفعال وقعت فعلاً، والخادم وحده يقرأ ويستنتج ويتنبّأ.
 * ═══════════════════════════════════════════════════════════════════════
 */

const LOOKBACK = 7 * 24 * 3600_000; // نافذة القراءة: أسبوع
const MAX_GAP = 6 * 3600_000; // أقصى فاصل يُحسب انتقالاً واحداً
const MAX_RULES = 24; // قواعد تُكتب في النبضة الواحدة
const MAX_MODELED = 12; // نبوءات نموذجية تُصدر في النبضة الواحدة
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

    // ── ٢) قياس الانتقالات: من أين إلى أين، وكم مرة ──
    const rules = new Map<
      string,
      { subject: string; from: string; total: number; dest: Map<string, { hits: number; lagSum: number }> }
    >();
    for (const [subject, evs] of byActor) {
      if (evs.length < 3) continue;
      const arr = evs.slice().sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const cur = arr[i];
        const gap = cur.createdAt - prev.createdAt;
        if (gap <= 0 || gap > MAX_GAP || prev.system === cur.system) continue;
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
      }
    }

    const candidates: Candidate[] = [];
    for (const r of rules.values()) {
      if (r.total < 3) continue;
      const dests = [...r.dest.entries()]
        .sort((a, b) => b[1].hits - a[1].hits)
        .slice(0, 2);
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

    // ── ٣) كتابة القواعد (تحديث أو إنشاء) ──
    let written = 0;
    for (const c of candidates) {
      if (written >= MAX_RULES) break;
      const existing = await ctx.db
        .query("mindTriggers")
        .withIndex("by_pair", (q) =>
          q.eq("subjectName", c.subject).eq("fromSystem", c.from).eq("toSystem", c.to),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          hits: c.hits,
          total: c.total,
          confidence: c.confidence,
          avgLagMs: c.avgLagMs,
          updatedAt: now,
        });
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
          updatedAt: now,
          createdAt: now,
        });
      }
      written++;
    }

    // ── ٤) نبوءات نموذجية مبنية على المحرّكات المقيسة ──
    const openPreds = await ctx.db
      .query("agentPredictions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(120);
    const busy = new Set(openPreds.map((p) => p.subjectName));
    const pool = await ctx.db
      .query("freeAgents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(300);

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

    await ctx.db.insert("aiDecisionLog", {
      system: AGENT_SYSTEM,
      actorName: "الوكلاء الأحرار",
      action: "mind_models",
      targetName: "محرّكات العقل",
      detail: `استُخرجت ${written} قاعدة سلوكية من تسلسل الأفعال الحقيقي، وبُني عليها ${modeled} نبوءة نموذجية — بلا سؤال لأحد.`,
      severity: "low",
      createdAt: now,
    });

    return { rules: written, modeled, subjects: byActor.size };
  },
});

/**
 * قراءة محرّكات العقل: قواعد كل عقل ونبضات نواياه المتوقّعة
 */
export const getMindDeeper = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("mindTriggers").take(300);
    const ranked = [...all].sort(
      (a, b) => b.confidence * b.hits - a.confidence * a.hits,
    );
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

    return {
      triggers,
      intents,
      stats: {
        rules: all.length,
        subjects: bySubject.size,
        strongest: triggers[0]?.confidence ?? 0,
        avgConfidence:
          all.length > 0 ? all.reduce((s, t) => s + t.confidence, 0) / all.length : 0,
      },
    };
  },
});
