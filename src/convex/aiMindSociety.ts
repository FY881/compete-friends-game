import { internalMutation, query } from "./_generated/server";
import { AGENT_SYSTEM } from "./aiFreeAgents";
import { SYSTEM_LABEL } from "./aiMindWatch";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🫂 مجتمع العقول — الطبقة الرابعة من توسيع الأحرار (الأداة 30)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ثلاثة أسئلة يقيسها الخادم من الأفعال الحقيقية وحدها، بلا سؤال لأحد:
 *
 *   ١. إيقاع كل عقل — متى يكون حاضراً فعلاً؟ تُبنى ساعةً بساعة، فيُعرف
 *      من هو عقل ليل ومن عقل صباح، وأين قمّة حضوره.
 *   ٢. الرفقة — من يجالس من فعلاً؟ كل لقاء في الركن نفسه خلال عشرين دقيقة
 *      يُحسب، فتبزغ دوائر الرفقة بلا أن يعرّف أحد نفسه.
 *   ٣. الجرّ الاجتماعي — من يتحرّك بعده غيره؟ كل فعل يتبعه فعل عقل آخر في
 *      الركن نفسه خلال ربع ساعة يُحسب، فيُعرف من يجذب ومن يُجذب.
 *
 * لا أمر من المالك ولا من النظام ولا استبيان للاعب: قراءة صامتة لمسارات
 * وقعت فعلاً، والخادم وحده يحسب ويستنتج.
 * ═══════════════════════════════════════════════════════════════════════
 */

const LOOKBACK = 14 * 24 * 3600_000; // نافذة القراءة: أسبوعان
const CO_WINDOW = 20 * 60_000; // نافذة الرفقة
const LEAD_WINDOW = 15 * 60_000; // نافذة الجرّ الاجتماعي
const MAX_INNER = 12; // سقف المقارنات داخل النافذة الواحدة
const MAX_RHYTHMS = 24;
const MAX_CIRCLES = 18;
const MAX_INFLUENCE = 24;
const TZ_OFFSET = 3; // توقيت المنطقة (UTC+3)

function hourOf(t: number): number {
  return (Math.floor(t / 3600_000) + TZ_OFFSET) % 24;
}

function chronotypeOf(peakHour: number): string {
  if (peakHour < 6 || peakHour >= 22) return "ليل";
  if (peakHour < 12) return "صباح";
  if (peakHour < 17) return "نهار";
  return "مساء";
}

export const societyPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const bus = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gt("createdAt", now - LOOKBACK))
      .take(900);
    const real = bus.filter((e) => e.system !== AGENT_SYSTEM && e.actorName);

    // ── ١) إيقاع كل عقل ──
    const rhythmic = new Map<string, number[]>();
    for (const e of real) {
      const arr: number[] = rhythmic.get(e.actorName) ?? new Array<number>(24).fill(0);
      arr[hourOf(e.createdAt)]++;
      rhythmic.set(e.actorName, arr);
    }

    const rhythmRows = [...rhythmic.entries()]
      .map(([subjectName, hours]) => {
        const samples = hours.reduce((s, n) => s + n, 0);
        let peakHour = 0;
        for (let h = 1; h < 24; h++) if (hours[h] > hours[peakHour]) peakHour = h;
        const night =
          hours[0] + hours[1] + hours[2] + hours[3] + hours[4] + hours[5] + hours[22] + hours[23];
        return {
          subjectName,
          hours,
          samples,
          peakHour,
          nightShare: samples > 0 ? night / samples : 0,
        };
      })
      .filter((r) => r.samples >= 4)
      .sort((a, b) => b.samples - a.samples)
      .slice(0, MAX_RHYTHMS);

    let rhythms = 0;
    for (const r of rhythmRows) {
      const existing = await ctx.db
        .query("mindRhythms")
        .withIndex("by_subject", (q) => q.eq("subjectName", r.subjectName))
        .first();
      const chronotype = chronotypeOf(r.peakHour);
      if (existing) {
        await ctx.db.patch(existing._id, {
          hours: r.hours,
          samples: r.samples,
          peakHour: r.peakHour,
          chronotype,
          nightShare: r.nightShare,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("mindRhythms", {
          subjectName: r.subjectName,
          hours: r.hours,
          samples: r.samples,
          peakHour: r.peakHour,
          chronotype,
          nightShare: r.nightShare,
          updatedAt: now,
          createdAt: now,
        });
      }
      rhythms++;
    }

    // ── ٢) الرفقة: من حضر مع من في الركن نفسه ──
    const bySystem = new Map<string, { subject: string; t: number }[]>();
    for (const e of real) {
      const arr = bySystem.get(e.system) ?? [];
      arr.push({ subject: e.actorName, t: e.createdAt });
      bySystem.set(e.system, arr);
    }

    const circles = new Map<string, { a: string; b: string; system: string; encounters: number }>();
    for (const [system, evs] of bySystem) {
      const arr = evs.slice().sort((x, y) => x.t - y.t);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length && j - i <= MAX_INNER; j++) {
          if (arr[j].t - arr[i].t > CO_WINDOW) break;
          if (arr[j].subject === arr[i].subject) continue;
          const [a, b] =
            arr[i].subject < arr[j].subject
              ? [arr[i].subject, arr[j].subject]
              : [arr[j].subject, arr[i].subject];
          const key = `${a}|${b}|${system}`;
          const c = circles.get(key) ?? { a, b, system, encounters: 0 };
          c.encounters++;
          circles.set(key, c);
        }
      }
    }

    const presence = new Map<string, number>(); // subject|system -> حضوره
    for (const [system, evs] of bySystem) {
      for (const e of evs) {
        const k = `${e.subject}|${system}`;
        presence.set(k, (presence.get(k) ?? 0) + 1);
      }
    }

    const circleRows = [...circles.values()]
      .map((c) => {
        const pa = presence.get(`${c.a}|${c.system}`) ?? 1;
        const pb = presence.get(`${c.b}|${c.system}`) ?? 1;
        return {
          ...c,
          strength: c.encounters / Math.max(1, Math.min(pa, pb)),
        };
      })
      .sort((x, y) => y.strength * y.encounters - x.strength * x.encounters)
      .slice(0, MAX_CIRCLES);

    let circleCount = 0;
    for (const c of circleRows) {
      const existing = await ctx.db
        .query("mindCircles")
        .withIndex("by_pair", (q) =>
          q.eq("aName", c.a).eq("bName", c.b).eq("system", c.system),
        )
        .first();
      const systemLabel = SYSTEM_LABEL[c.system] ?? c.system;
      if (existing) {
        await ctx.db.patch(existing._id, {
          encounters: c.encounters,
          strength: c.strength,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("mindCircles", {
          aName: c.a,
          bName: c.b,
          system: c.system,
          systemLabel,
          encounters: c.encounters,
          strength: c.strength,
          updatedAt: now,
          createdAt: now,
        });
      }
      circleCount++;
    }

    // ── ٣) الجرّ الاجتماعي: من يتحرّك بعده غيره ──
    const leads = new Map<string, number>();
    const follows = new Map<string, number>();
    const leadSystem = new Map<string, Map<string, number>>();

    for (const [system, evs] of bySystem) {
      const arr = evs.slice().sort((x, y) => x.t - y.t);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length && j - i <= MAX_INNER; j++) {
          if (arr[j].t - arr[i].t > LEAD_WINDOW) break;
          if (arr[j].subject === arr[i].subject) continue;
          leads.set(arr[i].subject, (leads.get(arr[i].subject) ?? 0) + 1);
          follows.set(arr[j].subject, (follows.get(arr[j].subject) ?? 0) + 1);
          const sm = leadSystem.get(arr[i].subject) ?? new Map<string, number>();
          sm.set(system, (sm.get(system) ?? 0) + 1);
          leadSystem.set(arr[i].subject, sm);
        }
      }
    }

    const influenceRows = [...new Set([...leads.keys(), ...follows.keys()])]
      .map((name) => {
        const l = leads.get(name) ?? 0;
        const f = follows.get(name) ?? 0;
        const sm = leadSystem.get(name);
        let topSystem = "";
        let best = 0;
        if (sm) for (const [sys, n] of sm) if (n > best) { best = n; topSystem = sys; }
        return { name, leads: l, follows: f, pull: l + f > 0 ? l / (l + f) : 0, topSystem };
      })
      .filter((r) => r.leads + r.follows >= 3)
      .sort((a, b) => b.leads - a.leads || b.pull - a.pull)
      .slice(0, MAX_INFLUENCE);

    let influenced = 0;
    for (const r of influenceRows) {
      const existing = await ctx.db
        .query("mindInfluence")
        .withIndex("by_name", (q) => q.eq("name", r.name))
        .first();
      const topSystemLabel = r.topSystem ? (SYSTEM_LABEL[r.topSystem] ?? r.topSystem) : "";
      if (existing) {
        await ctx.db.patch(existing._id, {
          leads: r.leads,
          follows: r.follows,
          pull: r.pull,
          topSystem: r.topSystem,
          topSystemLabel,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("mindInfluence", {
          name: r.name,
          leads: r.leads,
          follows: r.follows,
          pull: r.pull,
          topSystem: r.topSystem,
          topSystemLabel,
          updatedAt: now,
          createdAt: now,
        });
      }
      influenced++;
    }

    await ctx.db.insert("aiDecisionLog", {
      system: AGENT_SYSTEM,
      actorName: "الوكلاء الأحرار",
      action: "mind_society",
      targetName: "مجتمع العقول",
      detail:
        `قيس إيقاع ${rhythms} عقلًا، وبزغت ${circleCount} دائرة رفقة، ورُسمت خريطة جرّ لـ${influenced} عقلًا — ` +
        `قراءة صامتة من الأفعال وحدها، بلا سؤال لأحد.`,
      severity: "low",
      createdAt: now,
    });

    return { rhythms, circles: circleCount, influenced };
  },
});

/**
 * قراءة مجتمع العقول: الإيقاع، دوائر الرفقة، ومن يجرّ الآخرين
 */
export const getMindSociety = query({
  handler: async (ctx) => {
    const allRhythms = await ctx.db.query("mindRhythms").take(200);
    const rhythms = [...allRhythms].sort((a, b) => b.samples - a.samples).slice(0, 6);

    const allCircles = await ctx.db.query("mindCircles").take(200);
    const circles = [...allCircles]
      .sort((a, b) => b.strength * b.encounters - a.strength * a.encounters)
      .slice(0, 8);

    const allInfluence = await ctx.db.query("mindInfluence").take(200);
    const influence = [...allInfluence].sort((a, b) => b.leads - a.leads).slice(0, 8);

    return {
      rhythms,
      circles,
      influence,
      stats: {
        rhythms: allRhythms.length,
        circles: allCircles.length,
        influencers: allInfluence.filter((r) => r.pull >= 0.6 && r.leads >= 3).length,
        nightOwls: allRhythms.filter((r) => r.chronotype === "ليل").length,
        avgPull:
          allInfluence.length > 0
            ? allInfluence.reduce((s, r) => s + r.pull, 0) / allInfluence.length
            : 0,
      },
    };
  },
});
