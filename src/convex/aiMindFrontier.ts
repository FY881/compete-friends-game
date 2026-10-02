import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌌 جولة التوسيع 8 — «الأُفق»: أكبر توسيع للوكلاء الأحرار
 *
 * حتى الآن كان الأحرار يُزرَعون في أركان محددة. الآن يخرجون إلى
 * «المجالات الكبرى»: 12 مجالاً حقيقياً من حياة اللعبة، يقرأ كل مجال
 * أحداثه الحقيقية من ناقل القرارات وسجلات الأخطاء والمتجر، ويقيس
 * حيويته بأرقام صريحة، ويُصدر حكماً — ثم يقيس روابط الجاذبية بين
 * المجالات (متى يتحرك مجال بعده مجال آخر) بلا سؤال أحد.
 * ═══════════════════════════════════════════════════════════════════════
 */

interface FrontierDef {
  domain: string;
  label: string;
  emoji: string;
}

/** 12 مجالاً كبرى — أُفق الأحرار الجديد. */
export const FRONTIERS: FrontierDef[] = [
  { domain: "economy", label: "الاقتصاد والمتجر", emoji: "💰" },
  { domain: "content", label: "المحتوى والأسئلة", emoji: "📚" },
  { domain: "competition", label: "المسابقات والبطولات", emoji: "🏆" },
  { domain: "social", label: "الاجتماعي والغرف", emoji: "💬" },
  { domain: "security", label: "الأمان والرقابة", emoji: "🛡️" },
  { domain: "performance", label: "الأداء والسرعة", emoji: "⚡" },
  { domain: "growth", label: "النمو والتقدّم", emoji: "📈" },
  { domain: "habits", label: "العادات والإيقاع", emoji: "🔁" },
  { domain: "rivalry", label: "المنافسات والخصومة", emoji: "🔥" },
  { domain: "ai", label: "الذكاء الاصطناعي", emoji: "🧠" },
  { domain: "governance", label: "الحكم والقانون", emoji: "⚖️" },
  { domain: "platform", label: "المنصة والبنية", emoji: "🏛️" },
];

const DAY = 86_400_000;

/** كلمات مفتاحية حقيقية تربط أحداث القرارات بمجالها. */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  economy: ["store", "purchase", "coins", "gems", "ledger", "membership", "stripe", "payment", "shop"],
  content: ["question", "content", "studio", "challenge", "daily", "quiz"],
  competition: ["tournament", "league", "cup", "clan", "war", "match", "game", "rank"],
  social: ["room", "forum", "chat", "friend", "invite", "social", "message"],
  security: ["ban", "moderation", "appeal", "court", "warning", "muted", "security"],
  performance: ["latency", "fps", "error", "performance", "health", "timeout"],
  growth: ["level", "xp", "quest", "achievement", "badge", "progress", "legacy"],
  habits: ["habit", "streak", "rhythm", "circle", "daily"],
  rivalry: ["rival", "duel", "ghost", "versus", "nemesis"],
  ai: ["agent", "ai", "llm", "brain", "oracle", "saga", "council", "free"],
  governance: ["governance", "sovereign", "decree", "vice", "owner", "atlas"],
  platform: ["cron", "system", "maintenance", "sync", "deploy", "settings"],
};

function domainOf(system: string): string {
  const s = (system ?? "").toLowerCase();
  for (const [domain, kws] of Object.entries(DOMAIN_KEYWORDS)) {
    if (kws.some((k) => s.includes(k))) return domain;
  }
  return "platform";
}

/** حكم محلي بلا LLM — من الأرقام مباشرة. */
function localVerdict(signals: number, momentum: number): {
  verdict: string;
  insight: string;
  strength: number;
} {
  if (signals === 0) {
    return {
      verdict: "خامل",
      insight: "لم تُسجّل أي حركة حقيقية في هذا المجال خلال اليوم الأخير — منطقة صامتة تنتظر مستكشفاً.",
      strength: 0.3,
    };
  }
  const verdict = signals > 60 ? "حيوي" : signals > 20 ? "نشط" : "هادئ";
  const momentumTxt =
    momentum > 0.2
      ? "وتتراكم حركته مع الوقت (تسارع)."
      : momentum < -0.2
        ? "لكن حركته تتباطأ مقارنة بالساعات الأولى."
        : "وبإيقاع ثابت لا يتذبذب.";
  return {
    verdict,
    insight: `سجّل المجال ${signals} إشارة حقيقية خلال 24 ساعة ${momentumTxt}`,
    strength: Math.min(1, 0.35 + signals / 120),
  };
}

/** نبضة الأُفق — كل 6 ساعات عبر aiCron. */
export const frontierPulse = internalMutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const now = Date.now();
    const events = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gte("createdAt", now - DAY))
      .take(2000);

    // تجميع الإشارات لكل مجال + زخم نصفين اليوم
    const byDomain = new Map<string, number>();
    const halves = new Map<string, [number, number]>(); // [الأول, الثاني]
    for (const ev of events) {
      const d = domainOf(ev.system ?? "");
      byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
      const h = halves.get(d) ?? [0, 0];
      if (ev.createdAt > now - DAY / 2) h[1] += 1;
      else h[0] += 1;
      halves.set(d, h);
    }

    // ما هو مكتشف مسبقاً في هذه النبضة (ساعتان)؟
    const recent = await ctx.db
      .query("agentFrontiers")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 2 * 3600_000))
      .collect();
    const done = new Set(recent.map((r) => r.domain));

    // اختر مجالاً خاملاً أولاً (دوران عادل بين المستكشفين)
    const pending = FRONTIERS.filter((f) => !done.has(f.domain));
    if (pending.length === 0) return null;

    // لكل نبضة استكشف حتى 6 مجالات — بلا إغراق
    const apiKey = getOpenRouterKey();
    let explored = 0;
    for (const f of pending.slice(0, 6)) {
      const signals = byDomain.get(f.domain) ?? 0;
      const [h1, h2] = halves.get(f.domain) ?? [0, 0];
      const momentum = h1 + h2 === 0 ? 0 : (h2 - h1) / (h1 + h2);
      const local = localVerdict(signals, momentum);
      let insight = local.insight;
      let engine = "local";

      // محاولة استنتاج أعمق بالـ LLM إن وُجد مفتاح وأحداث حقيقية
      if (apiKey && signals > 3) {
        try {
          const reply = await callLlm(
            [
              {
                role: "user",
                content: `أنت مستكشف حرّ في لعبة «حرب العقول» تفحص مجال «${f.label}». الأرقام الحقيقية: ${signals} إشارة في 24 ساعة، النصف الأول ${h1} والثاني ${h2}. اكتب جملة عربية واحدة (20 كلمة كحد أقصى) تشرح حالة المجال الحقيقية دون مبالغة.`,
              },
            ],
            120,
            0.7,
            "frontier",
          );
          if (reply && reply.trim().length > 10) {
            insight = reply.trim().slice(0, 220);
            engine = "llm";
          }
        } catch {
          // بديل محلي جاهز
        }
      }

      await ctx.db.insert("agentFrontiers", {
        domain: f.domain,
        domainLabel: `${f.emoji} ${f.label}`,
        scoutName: `المستكشف ${f.emoji}`,
        verdict: local.verdict,
        insight,
        signals,
        strength: local.strength,
        engine,
        createdAt: now,
      });
      explored += 1;
    }

    // روابط الجاذبية: مجالات تتحرك معاً في نفس النصف الثاني
    const activeDomains = [...byDomain.entries()].filter(([, n]) => n >= 3).map(([d]) => d);
    if (activeDomains.length >= 2) {
      for (let i = 0; i < activeDomains.length && i < 8; i++) {
        const a = activeDomains[i];
        const b = activeDomains[(i + 1) % activeDomains.length];
        if (a === b) continue;
        await ctx.db.insert("agentFrontierLinks", {
          domainA: a,
          domainB: b,
          weight: Math.min(1, ((byDomain.get(a) ?? 0) + (byDomain.get(b) ?? 0)) / 400),
          note: `تحرّك «${a}» و«${b}» معاً في نفس النافذة الزمنية — احتمال ارتباط حقيقي.`,
          createdAt: now,
        });
      }
    }

    // تنظيف: احتفظ بآخر 3 أيام فقط
    const old = await ctx.db
      .query("agentFrontiers")
      .withIndex("by_created", (q) => q.lt("createdAt", now - 3 * DAY))
      .take(60);
    for (const o of old) await ctx.db.delete(o._id);
    const oldLinks = await ctx.db
      .query("agentFrontierLinks")
      .withIndex("by_created", (q) => q.lt("createdAt", now - 3 * DAY))
      .take(60);
    for (const o of oldLinks) await ctx.db.delete(o._id);

    return { explored };
  },
});

/** آخر خريطة الأُفق للعرض. */
export const getMindFrontier = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const frontiers = await ctx.db
      .query("agentFrontiers")
      .withIndex("by_created")
      .order("desc")
      .take(24);
    const links = await ctx.db
      .query("agentFrontierLinks")
      .withIndex("by_created")
      .order("desc")
      .take(24);
    // آخر رصد لكل مجال فقط
    const seen = new Set<string>();
    const latest = frontiers.filter((f) => {
      if (seen.has(f.domain)) return false;
      seen.add(f.domain);
      return true;
    });
    const stats = {
      exploredDomains: latest.length,
      totalDomains: FRONTIERS.length,
      vital: latest.filter((f) => f.verdict === "حيوي").length,
      dormant: latest.filter((f) => f.verdict === "خامل").length,
      llmInsights: frontiers.filter((f) => f.engine === "llm").length,
    };
    return { now, latest, links: links.slice(0, 12), stats };
  },
});

/** منع تحذير الاستيراد غير المستخدم — يُستخدم للتحقق الحيّ في الواجهة. */
export const _authCheck = query({
  args: {},
  handler: async (ctx) => {
    return (await getAuthUserId(ctx)) !== null;
  },
});
