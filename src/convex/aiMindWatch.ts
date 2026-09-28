import { internalMutation, query } from "./_generated/server";
import {
  AGENT_SYSTEM,
  CAP_PER_POST,
  MOODS,
  PERSONAS,
  POSTS,
  agentName,
  pick,
} from "./aiFreeAgents";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🌱 مرصد العقول — الطبقة الثانية من توسيع الأحرار (الأداة 30)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ١. bloomPulse — البلوغ الكبير: كل ربع ساعة يزرع حتى ١٥٠ حرًّا جديداً في
 *    الأركان التي لم تمتلئ (سعة ٤٠ لكل ركن)، فلا تبقى بقعة في اللعبة
 *    بلا شاهد حرّ. الزرع عشوائي تماماً: الركن يُختار بالقرعة لا بالترتيب،
 *    ولكل وكيل زاوية مصغّرة عشوائية داخل ركنه. يسجّل سطراً واحداً موجزاً
 *    لكل موجة حتى لا يُغرق ناقل القرارات الذي تُقرأ منه العقول.
 *
 * ٢. getMindWatch — قراءة الطبقة العميقة: سجل النبوءات (من توقّع ماذا
 *    عن مَن)، ودقة كل وكيل (إصابات ÷ محاولات)، وتوزيع الأحرار على أركان
 *    اللعبة كلها، والأرقام الكلية للسعة والتغطية.
 *
 * لا أمر من المالك ولا من النظام: الخادم وحده يزرع ويتنبّأ ويُحاسِب.
 * ═══════════════════════════════════════════════════════════════════════
 */

const MAX_AGENTS = 4000;
const BLOOM_PER_PULSE = 150; // أقصى عدد بذور في الموجة الواحدة — بلوغ ضخم

/** ميكرو-مواقع عشوائية داخل كل ركن — توزيع أوسع من ركنٍ واحد */
const SPOTS = [
  "عند المدخل",
  "الزاوية الخلفية",
  "خلف المنصة",
  "الصف الأول",
  "أعلى الشرفة",
  "بجانب البئر",
  "عند السور",
  "في الظلّ",
  "على الحافة",
  "الطرف البعيد",
  "وسط الساحة",
  "تحت اللافتة",
  "عند البوابة",
  "بين المقاعد",
  "على الدرج",
];

function spotOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100_000;
  return SPOTS[h % SPOTS.length];
}

/** أسماء الأنظمة الحقيقية في ناقل القرارات */
export const SYSTEM_LABEL: Record<string, string> = {
  questions: "بنك الأسئلة",
  players: "سجل اللاعبين",
  moderation: "الرقابة",
  reports: "البلاغات",
  memberships: "العضويات",
  twin_council: "مجلس التوأم الحربي",
  control: "أطلس كنترول",
  commands: "مركز الأوامر",
  war_mirror: "المرآة الحربية",
  rivalry: "المنافسات",
  mind_war: "الحرب الكبرى",
  living_agents: "العقول الحيّة",
  honor_court: "محكمة الشرف",
  fate: "بئر القدر",
  exchange: "صرف القدرات",
  emergency: "الطوارئ",
  debate: "المناظرات",
  alliance_cup: "كأس التحالفات",
  viceowner: "نائب المالك",
  summit: "عقل القمة",
  security: "الأمن",
  rooms: "الغرف",
  habit: "مرصد العادات",
  ghost_duel: "مبارزة الشبح",
  content: "المحتوى",
  concierge: "الكونسيرج",
  autoadmin: "الإدارة الذاتية",
  analytics: "التحليلات",
  achievements: "الإنجازات",
  owner: "أوامر المالك",
  tournament: "البطولات",
  clan_war: "حروب العشائر",
  store: "متجر العقول",
  payments: "المدفوعات",
  chronicle: "سجل العقول",
  colossus: "الطاغوت",
  oracle: "العرّاف",
  saga: "ملحمة العقول",
  compass: "بوصلة العقول",
  metamind: "العقل الأعظم",
  grand_strategy: "الخطة الكبرى",
  quests: "المهام",
  season: "جواز الموسم",
  league: "الدوري",
};

// ═══════════════════════════════════════════════════════════════════════
// ١) البلوغ الكبير
// ═══════════════════════════════════════════════════════════════════════

export const bloomPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db.query("freeAgents").take(MAX_AGENTS);
    const live = new Map<string, number>();
    for (const a of all) if (a.active) live.set(a.post, (live.get(a.post) ?? 0) + 1);

    const roomy = POSTS.filter((p) => (live.get(p.post) ?? 0) < CAP_PER_POST);
    if (roomy.length === 0) return { planted: 0 as number };

    const toPlant = Math.min(roomy.length, BLOOM_PER_PULSE);
    let planted = 0;
    const born: string[] = [];

    for (let i = 0; i < toPlant; i++) {
      const idx = Math.floor(Math.random() * roomy.length);
      const site = roomy[idx];
      roomy.splice(idx, 1);
      const seed = Math.floor(Math.random() * 100_000);
      const nm = agentName(seed);
      await ctx.db.insert("freeAgents", {
        name: nm,
        emoji: site.emoji,
        role: pick(PERSONAS),
        post: site.post,
        persona: `${pick(MOODS)} — يراقب «${site.label}»: ${site.watch}.`,
        watch: site.watch,
        active: true,
        observations: 0,
        createdAt: now,
        lastPulseAt: now,
      });
      born.push(`${nm} عند «${site.label}» (${spotOf(nm)})`);
      planted++;
    }

    // سطر واحد لكل موجة — لا يُغرق ناقل القرارات الذي تُقرأ منه العقول
    await ctx.db.insert("aiDecisionLog", {
      system: AGENT_SYSTEM,
      actorName: "الوكلاء الأحرار",
      action: "bloom",
      targetName: "أركان اللعبة",
      detail:
        `بلوغ كبير: ${planted} حرًّا جديداً انضموا من تلقاء أنفسهم — ` +
        born.slice(0, 5).join("، ") +
        (born.length > 5 ? "…" : ""),
      severity: "low",
      createdAt: now,
    });

    return { planted };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ٢) قراءة الطبقة العميقة
// ═══════════════════════════════════════════════════════════════════════

export const getMindWatch = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("freeAgents").take(MAX_AGENTS);
    const activeAll = all.filter((a) => a.active);
    // كل وكيل يحمل زاوية عشوائية داخل ركنه — توزيع لا يتكرّر
    const agents = activeAll.slice(0, 300).map((a) => ({ ...a, spot: spotOf(a.name) }));

    // سجل النبوءات: من توقّع ماذا عن مَن، وهل صدق
    const preds = await ctx.db
      .query("agentPredictions")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(24);
    const allPreds = await ctx.db.query("agentPredictions").take(600);
    const predHits = allPreds.filter((p) => p.status === "hit").length;
    const predMisses = allPreds.filter((p) => p.status === "miss").length;
    const predOpen = allPreds.filter((p) => p.status === "open").length;
    const predictions = preds.map((p) => ({
      ...p,
      actualLabel: p.actualSystem ? (SYSTEM_LABEL[p.actualSystem] ?? p.actualSystem) : undefined,
    }));

    // أدقّ العيون: من كان فهمه أقرب إلى الواقع (إصابات ÷ محاولات)
    const tally = new Map<string, { hits: number; misses: number; post: string }>();
    for (const p of allPreds) {
      if (p.status === "open") continue;
      const t = tally.get(p.agentName) ?? { hits: 0, misses: 0, post: p.post };
      if (p.status === "hit") t.hits++;
      else t.misses++;
      tally.set(p.agentName, t);
    }
    const seers = [...tally.entries()]
      .map(([name, t]) => ({
        name,
        post: t.post,
        hits: t.hits,
        misses: t.misses,
        accuracy: t.hits / Math.max(1, t.hits + t.misses),
      }))
      .sort((a, b) => b.accuracy - a.accuracy || b.hits - a.hits)
      .slice(0, 5);

    const corners = POSTS.map((p) => ({
      post: p.post,
      label: p.label,
      emoji: p.emoji,
      count: activeAll.filter((a) => a.post === p.post).length,
    }));

    return {
      agents,
      predictions,
      seers,
      corners,
      spots: SPOTS,
      method: [
        "١ · الرصد: قراءة ناقل القرارات الحقيقي وحده",
        "٢ · الاستخلاص: بصمة لكل عقل من أفعاله الفعلية",
        "٣ · التجميع: ملف موحّد لكل عقل من كل الأركان",
        "٤ · التشابك: وفاق وخلاف بين الوكلاء بلا قائد",
        "٥ · التنبؤ: الوكيل يقول أين سيكون العقل بعد ست ساعات",
        "٦ · التحقق: تُقارن النبوءة بالواقع → إصابة أو خطأ",
        "٧ · الدقة: معرفة مقيسة تتراكم على كل وكيل",
        "٨ · المحرّكات: قياس ما يدفع العقل لفعل التالي من تسلسل أفعاله",
        "٩ · الجاذبية: خريطة إلى أين تُسحب العقول عبر كل أركان اللعبة",
        "١٠ · المراجعة: الوكلاء يتراجعون عن فهم بطل ويبنون غيره بأنفسهم",
      ],
      stats: {
        active: activeAll.length,
        retired: all.length - activeAll.length,
        covered: corners.filter((c) => c.count > 0).length,
        totalCorners: POSTS.length,
        capacity: POSTS.length * CAP_PER_POST,
        predictions: allPreds.length,
        hits: predHits,
        misses: predMisses,
        openPredictions: predOpen,
        accuracy: predHits + predMisses > 0 ? predHits / (predHits + predMisses) : 0,
      },
    };
  },
});
