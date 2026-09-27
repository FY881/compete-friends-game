import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🕊️ الوكلاء الأحرار (Free Agents) — الأداة 29
 * ═══════════════════════════════════════════════════════════════════════
 *
 * عقول مستقلة بلا أوامر من أحد: تُزرع عشوائياً في ركنات اللعبة كلها،
 * تلاحظ السلوك الحقيقي للاعبين من ناقل القرارات (aiDecisionLog)، ثم تكتب
 * ملاحظات صغيرة متواضعة عن عقولها. لا تدخل مباشر من المالك ولا من النظام —
 * فقط مراقبة صامتة تتراكم حتى تُكوّن فهم الأحرار لعقول اللعبة.
 *
 * كل نبضة (كل 6 ساعات):
 *   1) تزرع 1-2 وكلاء جدداً في أماكن لم يُزرع بها أحد بعد.
 *   2) كل وكيل نشط يقرأ آخر أحداث موقعه ويكتب ملاحظة واحدة (ذكاء أو محلي).
 *   3) الوكيل الذي راكم 12 ملاحظة «يرتح» (يتوقف مؤقتاً) — تبايع مكانه.
 * ═══════════════════════════════════════════════════════════════════════
 */

const AGENT_SYSTEM = "free_agents";

const POSTS: { post: string; label: string; watch: string }[] = [
  { post: "home", label: "بوابة اللعبة", watch: "أول انطباع: من يدخل ومن يغادر ومن يقف متردداً" },
  { post: "duel", label: "ساحة المبارزات", watch: "غرور الفائزين وعجلة الخاسرين للانتقام" },
  { post: "war", label: "جبهة الحرب", watch: "من يقاتل لخير جيشه ومن يقاتل لنفسه فقط" },
  { post: "store", label: "المتجر", watch: "من يشتري ليجمل ومن يشتري ليعوّض ضعفاً" },
  { post: "court", label: "محكمة العدالة", watch: "من يشتكي بعقلٍ منصف ومن يشتكي ليهرب من الهزيمة" },
  { post: "compass", label: "بوصلة العقول", watch: "من يطلب التوجيه جاداً ومن يطلب التوجيه ليضيع الوقت" },
  { post: "meta", label: "العقل الأعظم", watch: "من يهتم بصحة الأدوات ومن يتجاهل الساعة" },
  { post: "grand", label: "خيمة الخطة الكبرى", watch: "من يؤيد الخطط لقيادتها ومن يؤيدها ليشارك حقاً" },
  { post: "agents", label: "غرفة الوكلاء", watch: "أخوّة الأنظمة: من يحترم الأدوات الأخرى ومن يتصرف وحده" },
];

const PERSONAS = [
  "باحثة هادئة تكتب بصيغة المفارقة القصيرة",
  "مسافر قديم يقيس العقول بعمرها لا بنقاطها",
  "فيلسوف ساخر يرى النوايا قبل الأفعال",
  "مراقب صامت يحفظ التفاصيل الصغيرة ويعود إليها",
  "طبيب عقول يشخّص قبل أن يحكم",
  "حكواتي يحوّل ما يراه إلى مثل قصير",
  "رياضي عدّاد يقيس العادة لا اللحظة",
  "درويش زاهد لا يهتم بالصعود بل بالسلوك أثناءه",
];

const EMOJIS = ["🕊️", "🦉", "🐇", "🦊", "🐢", "🦋", "🪶", "🐙", "🦉", "🐺", "🦉", "🕊️"];
const NAMES_A = ["ضمير", "ظلّ", "همسة", "نسيج", "عدسة", "ميزان", "كفّ", "سراب", "قنديل", "خيط", "منشار", "شرارة"];
const NAMES_B = ["الحرّ", "الصامت", "الطويل", "المتعجّل", "الرحّال", "العجوز", "الصغير", "الليّن", "العزيز", "الغريب", "الوفيّ", "الحنون"];

function pick<T>(arr: T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function agentName(seed: number): string {
  return `${NAMES_A[seed % NAMES_A.length]} ${NAMES_B[(seed * 7 + 3) % NAMES_B.length]}`;
}

// ═══════════════════════════════════════════════════════════════════════
// النبضة: زرع + ملاحظة
// ═══════════════════════════════════════════════════════════════════════

export const agentsPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const seeded: number[] = [];
    const noted: number[] = [];

    // 1) زرع 1-2 وكلاء جدداً في مواقع غير مشغولة
    const existing = await ctx.db.query("freeAgents").collect();
    const occupied = new Set(existing.filter((a) => a.active).map((a) => a.post));
    const free = POSTS.filter((p) => !occupied.has(p.post));
    const toPlant = Math.min(free.length, 1 + (Math.random() < 0.4 ? 1 : 0));
    for (let i = 0; i < toPlant; i++) {
      const site = pick(free);
      free.splice(free.indexOf(site), 1);
      const seed = Math.floor(Math.random() * 10_000);
      await ctx.db.insert("freeAgents", {
        name: `${agentName(seed)}${i > 0 ? ` ${EMOJIS[seed % EMOJIS.length]}` : ""}`,
        emoji: EMOJIS[seed % EMOJIS.length],
        role: pick(PERSONAS),
        post: site.post,
        persona: `يتفرّج على «${site.label}» — ${site.watch}.`,
        watch: site.watch,
        active: true,
        observations: 0,
        createdAt: now,
        lastPulseAt: now,
      });
      seeded.push(seed);

      await ctx.db.insert("aiDecisionLog", {
        system: AGENT_SYSTEM,
        actorName: "الوكلاء الأحرار",
        action: "agent_planted",
        targetName: site.label,
        detail: `زرع حرّ جديد في «${site.label}» دون أمر من أحد.`,
        severity: "low",
        createdAt: now,
      });
    }

    // 2) كل وكيل نشط يكتب ملاحظة (بحد أقصى 3 وكلاء لكل نبضة — رفاهية الحصة)
    const agents = (await ctx.db.query("freeAgents").withIndex("by_active", (q) => q.eq("active", true)).take(20))
      .filter((a) => a.observations < 12)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    for (const agent of agents) {
      const site = POSTS.find((p) => p.post === agent.post);
      // آخر أحداث الناقل المرتبطة بموقع الوكيل تقريبياً — الوكيل يقرأ ما يصل إليه
      const dayAgo = now - 24 * 3600_000;
      const events = await ctx.db
        .query("aiDecisionLog")
        .withIndex("by_created", (q) => q.gt("createdAt", dayAgo))
        .take(400);
      const recent = events
        .filter((e) => e.system !== AGENT_SYSTEM && e.targetName === site?.label)
        .slice(0, 8);

      const localNote = buildLocalNote(agent, recent);
      let note = localNote;
      let engine = "local";
      if (getOpenRouterKey() && recent.length > 0) {
        const aiNote = await llmNote(agent, site?.label ?? "مكانه", recent);
        if (aiNote) {
          note = aiNote;
          engine = "llm";
        }
      }

      await ctx.db.insert("agentMindNotes", {
        agentId: agent._id,
        agentName: agent.name,
        post: agent.post,
        actorName: "عقول اللاعبين",
        note,
        confidence: Math.min(0.95, 0.4 + recent.length * 0.06),
        createdAt: now,
      });
      await ctx.db.patch(agent._id, { observations: agent.observations + 1, lastPulseAt: now });
      noted.push(1);

      // الوكيل المكتمل يرتاح — يترك مكانه لغيره
      if (agent.observations + 1 >= 12) {
        await ctx.db.patch(agent._id, { active: false });
        await ctx.db.insert("aiDecisionLog", {
          system: AGENT_SYSTEM,
          actorName: agent.name,
          action: "agent_retired",
          targetName: site?.label ?? "مكانه",
          detail: "اكتملت ملاحظاته وانصرف — تبايع مكانه لوكيل جديد.",
          severity: "low",
          createdAt: now,
        });
      }

      if (engine === "llm") {
        await ctx.db.insert("aiDecisionLog", {
          system: AGENT_SYSTEM,
          actorName: agent.name,
          action: "note_written",
          targetName: site?.label ?? "مكانه",
          detail: note.slice(0, 200),
          severity: "low",
          createdAt: now,
        });
      }
    }

    return { planted: seeded.length, notes: noted.length };
  },
});

function buildLocalNote(
  agent: { name: string; persona: string; watch: string; observations: number },
  recent: { actorName: string; action: string; detail: string }[],
): string {
  const actors = [...new Set(recent.map((e) => e.actorName))].filter(Boolean).slice(0, 3);
  const busy = actors.length > 0 ? actors.join("، ") : "مكان هادئ اليوم";
  const intro = pick([
    `${agent.name} يشاهد:`,
    `${agent.name} يدوّن في دفتره:`,
    `${agent.name} لاحظ بهدوء:`,
  ]);
  const body = recent.length
    ? `أكثر العقول حضوراً هنا اليوم: ${busy}. ${agent.watch} — وهذا يقول كثيراً.`
    : `صمت غريب: لا أحد حرّك شيئاً هنا. ${agent.watch} يبقى اختباراً مؤجلاً.`;
  const tag = agent.observations < 3 ? "ملاحظة مبكرة، انتباهي ليس يقيناً بعد." : "أُقرّب من اليقين كل يوم.";
  return `${intro} ${body} ${tag}`;
}

async function llmNote(
  agent: { name: string; persona: string; watch: string },
  siteLabel: string,
  recent: { actorName: string; action: string; detail: string }[],
): Promise<string | null> {
  if (!getOpenRouterKey()) return null;
  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            'أنت وكيل حر مستقل في لعبة "حرب العقول" — لا أوامر عليك من أحد. شخصيتك: ' +
            agent.persona +
            ". ما تراقبه: " +
            agent.watch +
            ". اكتب ملاحظة واحدة (سطران كحد أقصى) عن العقول التي رأيتها اليوم، بصوتك أنت. نص عربي فقط بلا JSON ولا عناوين.",
        },
        {
          role: "user",
          content: JSON.stringify({
            مكاني: siteLabel,
            آخر_الأحداث: recent.map((e) => ({ من: e.actorName, فعل: e.action, تفاصيل: e.detail })),
          }),
        },
      ],
      180,
      0.9,
      "MindClash FreeAgents",
    );
    const text = raw.replace(/^[\s\S]*?:/, "").trim() || raw.trim();
    return text.length > 20 ? text.slice(0, 280) : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// قراءة الواجهة + تحية الوكيل (تدخّل وحيد مسموح: صافرة ترحيب)
// ═══════════════════════════════════════════════════════════════════════

export const getFreeAgents = query({
  handler: async (ctx) => {
    const agents = await ctx.db
      .query("freeAgents")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(30);
    const notes = await ctx.db
      .query("agentMindNotes")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(30);
    const retired = (await ctx.db.query("freeAgents").collect()).filter((a) => !a.active).length;
    return { agents, notes, retired, posts: POSTS.map((p) => p.post) };
  },
});

/** صافرة ترحيب: اللاعب يسجّل أنه رأى وكيل الكساء — الوكيل يحتفظ بذلك في ذاكرته */
export const greetAgent = mutation({
  args: { agentId: v.id("freeAgents") },
  handler: async (ctx, { agentId }) => {
    const now = Date.now();
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("الوكيل غير موجود");
    const me = await ctx.db.get(userId);
    const notes = await ctx.db
      .query("agentMindNotes")
      .withIndex("by_agent", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(3);
    await ctx.db.insert("agentMindNotes", {
      agentId,
      agentName: agent.name,
      post: agent.post,
      actorName: me?.name ?? String(userId),
      note: `لاحظ ${me?.name ?? "زائر"} وقف عند ركنه ولوح له. سيتذكر هذا.`,
      confidence: 0.6,
      createdAt: now,
    });
    await ctx.db.patch(agentId, { observations: agent.observations + 1 });
    return { ok: true as const };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// المهمة الدورية
// ═══════════════════════════════════════════════════════════════════════

export const agentsJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return await ctx.runMutation(internal.aiFreeAgents.agentsPulse, {});
  },
});
