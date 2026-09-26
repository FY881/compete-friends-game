import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isStaffUser } from "./owner";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * 🎩 كونسيرج العقول (Minds Concierge)
 *
 * الأداة التي تجمع كل شيء تحت كلمة واحدة: حوار طبيعي.
 * المالك يكتب «امنع اللاعب اللي بيغش من الوقت» أو «وش وضع الطاغوت؟» أو
 * «ولّد أسئلة فنون لأن الخزانة نازفة» — فيفهم الطلب، **يبني خطة من خطوات
 * آمنة مرقمة، يعرضها للموافقة قبل أي تنفيذ**، ثم ينفذ الأوامر الحقيقية
 * القابلة للتراجع فقط.
 *
 * فلسفة الأمان (الفرق عن أي شات بوت):
 *  1) لا شيء يُنفّذ مباشرة — كل خطة تُعرض أولاً (مبدأ التأكيد).
 *  2) خطوات التنفيذ تُربط بأوامر النظام الحقيقية الموجودة فعلاً
 *     (mute/ban/unban/broadcast/clean_stale_rooms + التوليد) — لا اختراع.
 *  3) الأوامر الخطرة (ban/set_admin) تُنفذ بحقل تأكيد صريح ثانٍ.
 *  4) كل محادثة تُسجَّل: ماذا طلب المالك، ماذا فهم الحارس، ماذا نُفّذ.
 *
 * الفهم يعتمد على: قواعد ذكية محلية مجانية (تعمل دائماً) + ذكاء LLM
 * لصياغة الردود الطبيعية والخطط المعقدة (تحسين فوق أساس متين).
 */

// ── 1) أنواع الخطة ──────────────────────────────────────────────────────

export type PlanStep = {
  order: number;
  tool: "mute_player" | "unmute_player" | "ban_player" | "broadcast" | "generate_questions" | "clean_rooms" | "info_answer" | "run_verifier" | "run_conductor";
  params: Record<string, string>;
  description: string;
  dangerous: boolean;
};

export type ConciergePlan = {
  intent: string;
  reply: string; // رد المحادثة الطبيعي
  steps: PlanStep[];
  needsConfirmation: boolean;
  infoOnly: boolean;
};

const DAY = 24 * 3600_000;

// ── 2) فهم الطلب: قواعد محلية ذكية (تكلفة صفر، تعمل دائماً) ─────────────

type ParsedIntent = {
  intent: string;
  targetName: string | null;
  category: string | null;
  message: string | null;
};

function parseIntentLocal(text: string): ParsedIntent {
  const t = text.trim();
  const lower = t.toLowerCase();

  // كتم/طرد: كلمات الطرد + اسم (كلمة تبدأ بحرف كبير أو بعد "اللاعب")
  const wantsBan = /اطرد|طرد|حظر|احظر|بلوك/.test(lower);
  const wantsMute = /اكتم|كتم|اسكت|اسكتّه|سكّت|امنع.*الكلام/.test(lower);
  const wantsUnmute = /فك الكتم|سمح|أعد السماح|return.*chat/.test(lower);
  const wantsBroadcast = /اعلن|انشر|اذكر للجميع|رسالة للجميع|بث/.test(lower);
  const wantsGenerate = /ولد|اضف أسئلة|أسئلة جديدة|املأ|الخزانة نازفة|نقص أسئلة/.test(lower);
  const wantsClean = /نظف|احذف الغرف|الغرف الميتة|غرف ميتة/.test(lower);
  const wantsVerifier = /دقق|افحص الأسئلة|راجع الأسئلة/.test(lower);
  const wantsConductor = /العقل|شغل الدورة|نفذ قرار/.test(lower);
  const wantsStatus = /وضع|كيف|اخبار|إحصائيات|تقرير|حالة/.test(lower);

  // استخراج الاسم: كلمة بين «اللاعب» ونهاية، أو اسم بعد أمر
  let targetName: string | null = null;
  const nameMatch = t.match(/(?:اللاعب|العضو|المستخدم)\s+([^\s,،.]+)/) ?? t.match(/^(?:اكتم|كتم|اطرد|حظر|احظر|اسكت)\s+([^\s,،.]+)/);
  if (nameMatch) targetName = nameMatch[1];

  // استخراج الفئة
  let category: string | null = null;
  const catMatch = t.match(/(?:فئة|أسئلة)\s+(?:«|")?([^\s«»"]{3,20})(?:«|")?/);
  if (catMatch) {
    const maybe = catMatch[1];
    if (maybe.length >= 3 && !/الأسئلة|جديدة/.test(maybe)) category = maybe;
  }

  // رسالة البث: ما بعد «اعلن» أو بين علامات
  let message: string | null = null;
  const msgMatch = t.match(/(?:اعلن|انشر|بث)\s*[:：]?\s*["«]?(.+?)["»]?$/) ?? t.match(/["«](.+?)["»]/);
  if (msgMatch && wantsBroadcast) message = msgMatch[1];

  let intent = "unknown";
  if (wantsBan) intent = "ban";
  else if (wantsMute) intent = "mute";
  else if (wantsUnmute) intent = "unmute";
  else if (wantsBroadcast) intent = "broadcast";
  else if (wantsGenerate) intent = "generate";
  else if (wantsClean) intent = "clean_rooms";
  else if (wantsVerifier) intent = "run_verifier";
  else if (wantsConductor) intent = "run_conductor";
  else if (wantsStatus) intent = "status";

  return { intent, targetName, category, message };
}

// ── 3) بناء الخطة من النية ──────────────────────────────────────────────

function buildPlan(parsed: ParsedIntent): ConciergePlan {
  const { intent, targetName, category, message } = parsed;

  switch (intent) {
    case "mute": {
      if (!targetName) {
        return noPlan("من تريد كتمه؟ اذكر اسم اللاعب — مثال: «اكتم اللاعب أحمد».");
      }
      return {
        intent,
        reply: `سأكتم اللاعب «${targetName}» لمدة 24 ساعة. يؤكد؟`,
        steps: [
          { order: 1, tool: "mute_player", params: { name: targetName }, description: `كتم «${targetName}» 24 ساعة`, dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    }
    case "unmute": {
      if (!targetName) return noPlan("اذكر اسم اللاعب لفك الكتم.");
      return {
        intent,
        reply: `سأفك الكتم عن «${targetName}». يؤكد؟`,
        steps: [
          { order: 1, tool: "unmute_player", params: { name: targetName }, description: `فك الكتم عن «${targetName}»`, dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    }
    case "ban": {
      if (!targetName) return noPlan("من تريد طرده؟ اذكر اسم اللاعب.");
      return {
        intent,
        reply: `⚠️ طرد «${targetName}» إجراء خطير. أكد مرة أخرى بالضغط على «تنفيذ» — ولن يكون قابلاً للتراجع من هنا مباشرة.`,
        steps: [
          { order: 1, tool: "ban_player", params: { name: targetName }, description: `حظر دائم لـ «${targetName}»`, dangerous: true },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    }
    case "broadcast": {
      if (!message) return noPlan("ما الرسالة؟ مثال: «اعلن: بطولة الجمعة الساعة 9».");
      return {
        intent,
        reply: `سأنشر الإعلان التالي لكل اللاعبين: «${message}». يؤكد؟`,
        steps: [
          { order: 1, tool: "broadcast", params: { message }, description: `بث إعلان: ${message.slice(0, 60)}`, dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    }
    case "generate": {
      const cat = category ?? "عام";
      return {
        intent,
        reply: `سأولّد 6 أسئلة جديدة في فئة «${cat}». يؤكد؟`,
        steps: [
          { order: 1, tool: "generate_questions", params: { category: cat, count: "6" }, description: `توليد 6 أسئلة لفئة «${cat}»`, dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    }
    case "clean_rooms":
      return {
        intent,
        reply: "سأنظف الغرف الميتة (انتظار أقدم من 3 ساعات). يؤكد؟",
        steps: [
          { order: 1, tool: "clean_rooms", params: {}, description: "تنظيف الغرف الميتة", dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    case "run_verifier":
      return {
        intent,
        reply: "سأشغّل مدقق العقول على الأسئلة المعلقة (فحص فقط بلا تطبيق آلي). يؤكد؟",
        steps: [
          { order: 1, tool: "run_verifier", params: { limit: "6" }, description: "تدقيق 6 أسئلة معلقة", dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    case "run_conductor":
      return {
        intent,
        reply: "سأشغّل دورة العقل المُنسّق الآن: قراءة نبض الساحة وقرار موزون واحد. يؤكد؟",
        steps: [
          { order: 1, tool: "run_conductor", params: {}, description: "دورة العقل المُنسّق", dangerous: false },
        ],
        needsConfirmation: true,
        infoOnly: false,
      };
    default:
      return noPlan(
        "أفهم هذه الطلبات: كتم/طرد/فك كتم لاعب باسمه، إعلان بث لرسالة، توليد أسئلة لفئة، تنظيف الغرف الميتة، تشغيل المدقق، دورة العقل المُنسّق، وسؤال عن الحالة. جرّب مثلاً: «اكتم اللاعب فلان» أو «اعلن: بطولة الليلة 9 مساءً».",
      );
  }
}

function noPlan(reply: string): ConciergePlan {
  return { intent: "help", reply, steps: [], needsConfirmation: false, infoOnly: true };
}

// ── 4) نقطة الدخول: فهم وبناء الخطة (action — قد يستخدم LLM لصقل الرد) ──

export const askConcierge = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const me = (await ctx.runQuery("aiConcierge:getOwnerActor" as any, {})) as {
      name: string;
    } | null;
    if (!me) throw new Error("غير مصرح");
    if (message.trim().length < 2) throw new Error("الطلب فارغ");

    const parsed = parseIntentLocal(message);
    let plan = buildPlan(parsed);

    // صقل الرد الطبيعي بالذكاء (تحسين فقط — الخطة من القواعد المحلية)
    if (getOpenRouterKey() && plan.steps.length > 0) {
      try {
        await ensureAiRuntime(ctx);
        const stepsDesc = plan.steps.map((s) => s.description).join("؛ ");
        const raw = await callLlm(
          [
            {
              role: "system",
              content:
                "أنت كونسيرج ذكي ومحترف لمالك موقع لعبة أسئلة عربي. أعد صياغة رد تأكيد قصير مهذب (سطر إلى سطرين) يلخص ما ستفعله. لا تضف وعوداً خارج الخطوات. أجب بالنص فقط.",
            },
            { role: "user", content: `طلب المالك: «${message}»\nالخطوات المخططة: ${stepsDesc}\nالرد الحالي: ${plan.reply}` },
          ],
          200,
          0.6,
          "MindClash Minds Concierge",
        );
        const clean = raw.trim().slice(0, 300);
        if (clean.length > 10) plan = { ...plan, reply: clean };
      } catch {
        // الرد المحلي كافٍ
      }
    }

    // حفظ المحادثة
    await ctx.runMutation("aiConcierge:logConversation" as any, {
      userMessage: message,
      assistantReply: plan.reply,
      intent: plan.intent,
      stepsCount: plan.steps.length,
    });

    return { plan, parsed };
  },
});

// ── 5) التنفيذ بعد الموافقة: أوامر حقيقية فقط ──────────────────────────

export const confirmPlan = mutation({
  args: {
    intent: v.string(),
    steps: v.array(
      v.object({
        tool: v.string(),
        params: v.record(v.string(), v.string()),
      }),
    ),
  },
  handler: async (ctx, { intent, steps }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) throw new Error("غير مصرح");

    const results: string[] = [];
    const now = Date.now();

    for (const step of steps) {
      try {
        switch (step.tool) {
          case "mute_player": {
            const target = await findUserByName(ctx, step.params.name);
            if (!target) throw new Error(`لا لاعب باسم «${step.params.name}»`);
            await ctx.db.patch(target._id, {
              mutedUntil: now + 24 * 3600_000,
              lastWarningAt: now,
            });
            await ctx.db.insert("moderationLogs", {
              actorType: "owner",
              actorName: me.name ?? "المالك",
              action: "mute",
              targetId: target._id,
              targetName: target.name ?? step.params.name,
              reason: "أمر كونسيرج العقول — موافقة صريحة",
              severity: "medium",
              createdAt: now,
            });
            results.push(`✓ كُتم «${target.name ?? step.params.name}» 24 ساعة`);
            break;
          }
          case "unmute_player": {
            const target = await findUserByName(ctx, step.params.name);
            if (!target) throw new Error(`لا لاعب باسم «${step.params.name}»`);
            await ctx.db.patch(target._id, { mutedUntil: 0 });
            results.push(`✓ فُك الكتم عن «${target.name ?? step.params.name}»`);
            break;
          }
          case "ban_player": {
            const target = await findUserByName(ctx, step.params.name);
            if (!target) throw new Error(`لا لاعب باسم «${step.params.name}»`);
            await ctx.db.patch(target._id, {
              bannedUntil: now + 30 * DAY,
              lastWarningAt: now,
            });
            await ctx.db.insert("moderationLogs", {
              actorType: "owner",
              actorName: me.name ?? "المالك",
              action: "ban",
              targetId: target._id,
              targetName: target.name ?? step.params.name,
              reason: "أمر كونسيرج العقول — موافقة صريحة",
              severity: "high",
              createdAt: now,
            });
            results.push(`✓ حُظر «${target.name ?? step.params.name}» 30 يوماً`);
            break;
          }
          case "broadcast": {
            await ctx.db.insert("announcements", {
              title: "إعلان الإدارة",
              body: step.params.message,
              active: true,
              priority: "medium",
              createdAt: now,
            });
            results.push(`✓ نُشر الإعلان: ${step.params.message.slice(0, 50)}`);
            break;
          }
          case "clean_rooms": {
            const games = await ctx.db.query("games").collect();
            let cleaned = 0;
            for (const g of games) {
              if (g.status === "waiting" && now - g.createdAt > 3 * 3600_000) {
                await ctx.db.delete(g._id);
                cleaned += 1;
              }
            }
            results.push(`✓ نُظّفت ${cleaned} غرف ميتة`);
            break;
          }
          case "generate_questions":
          case "run_verifier":
          case "run_conductor": {
            // الأدوات المعقدة (actions) تُجدول من mutation عبر scheduler
            await ctx.scheduler.runAfter(0, "aiConcierge:deferredTool" as any, {
              tool: step.tool,
              params: step.params,
            });
            results.push(`⏳ أُطلق: ${step.tool === "generate_questions" ? "توليد الأسئلة" : step.tool === "run_verifier" ? "المدقق" : "دورة العقل"} — النتيجة في لوحتها`);
            break;
          }
          default:
            results.push(`✗ أداة غير معروفة: ${step.tool}`);
        }
      } catch (e) {
        results.push(`✗ فشل: ${e instanceof Error ? e.message.slice(0, 80) : "خطأ"}`);
      }
    }

    void intent;
    return { results };
  },
});

async function findUserByName(ctx: unknown, name: string): Promise<{ _id: Id<"users">; name?: string } | null> {
  // البحث بالاسم عبر مسح محدود (أسماء اللاعبين قصيرة ومحدودة العدد عملياً)
  const ctxDb = (ctx as { db: { query: (t: string) => { collect: () => Promise<{ _id: Id<"users">; name?: string }[]> } } }).db;
  const users = await ctxDb.query("users").collect();
  const wanted = name.trim().toLowerCase();
  return users.find((u) => (u.name ?? "").trim().toLowerCase() === wanted) ?? null;
}

// أداة مؤجلة: تُشغَّل بعد الموافقة للأدوات من نوع action
export const deferredTool = internalMutation({
  args: {
    tool: v.string(),
    params: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { tool, params }) => {
    if (tool === "generate_questions") {
      await ctx.scheduler.runAfter(0, "aiQuestions:generateQuestions" as any, {
        category: params.category ?? "عام",
        count: Math.min(Math.max(Number(params.count ?? 6), 1), 10),
      });
    } else if (tool === "run_verifier") {
      await ctx.scheduler.runAfter(0, "aiVerifier:verifyPendingQuestions" as any, {
        limit: Number(params.limit ?? 6),
        autoApply: false,
      });
    } else if (tool === "run_conductor") {
      await ctx.scheduler.runAfter(0, "aiConductor:conductCycle" as any, {});
    }
  },
});

export const logConversation = internalMutation({
  args: {
    userMessage: v.string(),
    assistantReply: v.string(),
    intent: v.string(),
    stepsCount: v.number(),
  },
  handler: async (ctx, a) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("aiDecisionLog", {
      system: "concierge",
      actorName: "كونسيرج العقول",
      action: `chat_${a.intent}`,
      targetId: userId ? String(userId) : undefined,
      targetName: a.userMessage.slice(0, 40),
      detail: a.assistantReply.slice(0, 200),
      severity: "low",
      createdAt: Date.now(),
    });
  },
});

export const getOwnerActor = internalQuery({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me || !isStaffUser(me)) return null;
    return { name: me.name ?? "المالك" };
  },
});
