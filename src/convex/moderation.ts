import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getSettingsData, isStaffUser } from "./owner";
import { getOpenRouterKey, DEFAULT_MODEL } from "./aiConfig";

// ---------------------------------------------------------------------------
// AI moderation agent — "رقيب العقول".
// The AI is given permission to enforce the site laws: it reviews user content
// and reports, decides whether a violation happened, and (when the owner turns
// on auto-apply) automatically applies the matching punishment. Every decision
// is logged and the owner can override anything. It runs through OpenRouter.
// ---------------------------------------------------------------------------

export type AiVerdict = {
  compliant: boolean;
  violation: string | null;
  severity: "low" | "medium" | "high";
  suggestedAction: "none" | "warn" | "mute" | "ban";
  suggestedDurationMs: number | null;
  reasoning: string;
};

const RULES_SUMMARY = `
قوانين الموقع (ذكاء):
1. احترام الآخرين — ممنوع الإساءة أو التنمر أو السخرية من أي لاعب.
2. الأسماء والكلمات النظيفة — ممنوع الأسماء المسيئة أو البذيئة أو العنصرية أو الدينية الهجومية.
3. ممنوع الغش — الخروج من نافذة اللعب أثناء السؤال (للبحث عن الإجابة) أو استخدام أدوات خارجية.
4. ممنوع الإزعاج — السبام، الرسائل المتكررة، محاولة تخريب الجولات.
5. ممنوع المحتوى الجنسي أو التهديدات أو مشاركة معلومات شخصية للآخرين.
6. ممنوع انتحال شخصية الإدارة أو المالك.
`;

const OUTPUT_CONTRACT = `
ردّ بترجيع JSON فقط بالشكل التالي (بدون أي نص آخر):
{
  "compliant": true|false,
  "violation": "وصف قصير للمخالفة أو null إن لم توجد",
  "severity": "low" | "medium" | "high",
  "suggestedAction": "none" | "warn" | "mute" | "ban",
  "suggestedDurationMs": عدد الملي ثانية أو null,
  "reasoning": "شرح موجز بالعربية لقرارك"
}
قواعد القرار:
- لا مخالفة → compliant:true, suggestedAction:"none".
- مخالفة بسيطة (كلمة مسيئة خفيفة) → warn.
- مخالفة متوسطة (إساءة متكررة أو اسم مسيء) → mute مع مدة من 6 إلى 24 ساعة.
- مخالفة خطيرة (تهديد، عنصرية، غش متكرر، انتحال شخصية الإدارة) → ban مع مدة من 24 ساعة إلى 7 أيام.
`;

type RulesText = string[];

const MODERATION_SYSTEM_PROMPT = (rulesText: RulesText) =>      `أنت "رقيب العقول"، ذكاء اصطناعي مكلّف بمراقبة قوانين لعبة "ذكاء" وتطبيقها تلقائياً. كن حازماً وعادلاً ولا تتساهل مع المخالفات الواضحة.\n\n${RULES_SUMMARY}\n\nالقوانين المفعّلة حالياً في الموقع:\n${rulesText.length > 0 ? rulesText.map((r) => `- ${r}`).join("\n") : "(لا قوانين إضافية)"}\n\n${OUTPUT_CONTRACT}`;

/** Robust JSON extraction from an LLM reply (it may wrap JSON in fences). */
export function parseVerdict(raw: string): AiVerdict {
  let text = raw.trim();
  // Strip markdown fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("الرد لم يحتوِ على JSON");
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<AiVerdict>;
  const severity =
    parsed.severity === "high" || parsed.severity === "medium" ? parsed.severity : "low";
  const actionType =
    parsed.suggestedAction === "warn" ||
    parsed.suggestedAction === "mute" ||
    parsed.suggestedAction === "ban"
      ? parsed.suggestedAction
      : "none";
  return {
    compliant: parsed.compliant !== false,
    violation: typeof parsed.violation === "string" ? parsed.violation : null,
    severity,
    suggestedAction: actionType,
    suggestedDurationMs:
      typeof parsed.suggestedDurationMs === "number" && parsed.suggestedDurationMs > 0
        ? Math.min(parsed.suggestedDurationMs, 30 * 24 * 60 * 60 * 1000)
        : null,
    reasoning:
      typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
        ? parsed.reasoning
        : "لا يوجد شرح",
  };
}

export async function callOpenRouter(
  apiKey: string,
  model: string,
  rulesText: RulesText,
  userContent: string,
): Promise<AiVerdict> {
  const messages = [
    { role: "system", content: MODERATION_SYSTEM_PROMPT(rulesText) },
    {
      role: "user",
      content: `قيّم المحتوى التالي وفق قوانين الموقع:\n\n${userContent}`,
    },
  ];
  return await parseOpenRouterVerdict(apiKey, model, messages);
}

async function parseOpenRouterVerdict(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<AiVerdict> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://zaka.freebuff.app",
      "X-Title": "Zaka - Quiz Game",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter فشل: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter لم يُرجع رداً");
  return parseVerdict(text);
}

// ---------------------------------------------------------------------------
// Internal helpers (used by the scheduler-driven auto-review)
// ---------------------------------------------------------------------------

export const getReportForReview = internalQuery({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    return await ctx.db.get(reportId);
  },
});

export const getActiveRulesText = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rules = await ctx.db.query("rules").collect();
    return rules
      .filter((r) => r.active)
      .sort((a, b) => a.order - b.order)
      .map((r) => `${r.title}: ${r.description}`);
  },
});

/**
 * Records the AI's decision on a report. If auto-apply is on and a violation
 * was found, it applies the suggested punishment automatically.
 */
export const recordAiReview = internalMutation({
  args: {
    reportId: v.id("reports"),
    verdict: v.optional(
      v.object({
        compliant: v.boolean(),
        violation: v.optional(v.string()),
        severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        suggestedAction: v.union(
          v.literal("none"),
          v.literal("warn"),
          v.literal("mute"),
          v.literal("ban"),
        ),
        suggestedDurationMs: v.optional(v.number()),
        reasoning: v.string(),
      }),
    ),
    error: v.optional(v.string()),
    autoApply: v.boolean(),
  },
  handler: async (ctx, { reportId, verdict, error, autoApply }) => {
    const report = await ctx.db.get(reportId);
    if (!report) return;

    if (error) {
      await ctx.db.insert("moderationLogs", {
        actorType: "ai",
        actorName: "رقيب العقول",
        action: "ai_error",
        targetId: report.targetId,
        targetName: report.targetName,
        reason: `تعذر فحص البلاغ: ${error}`,
        severity: "low",
        createdAt: Date.now(),
      });
      return;
    }

    if (!verdict) return;

    await ctx.db.patch(reportId, {
      aiVerdict: {
        compliant: verdict.compliant,
        violation: verdict.violation ?? undefined,
        severity: verdict.severity,
        suggestedAction: verdict.suggestedAction,
        suggestedDurationMs: verdict.suggestedDurationMs ?? undefined,
        reasoning: verdict.reasoning,
      },
      status: verdict.compliant ? "dismissed" : "reviewed",
    });

    await ctx.db.insert("moderationLogs", {
      actorType: "ai",
      actorName: "رقيب العقول",
      action: "ai_review",
      targetId: report.targetId,
      targetName: report.targetName,
      reason: `بلاغ: ${report.reason} — ${verdict.compliant ? "مطابق للقوانين" : `مخالفة: ${verdict.violation ?? verdict.reasoning}`}`,
      severity: verdict.severity,
      createdAt: Date.now(),
    });

    if (!autoApply || verdict.compliant || verdict.suggestedAction === "none") {
      return;
    }

    const target = await ctx.db.get(report.targetId);
    if (!target) return;

    const now = Date.now();
    const defaultMute = 6 * 60 * 60 * 1000;
    const defaultBan = 24 * 60 * 60 * 1000;

    if (verdict.suggestedAction === "warn") {
      await ctx.db.patch(report.targetId, {
        warnings: (target.warnings ?? 0) + 1,
        lastWarningAt: now,
      });
    } else if (verdict.suggestedAction === "mute") {
      await ctx.db.patch(report.targetId, {
        mutedUntil: now + (verdict.suggestedDurationMs ?? defaultMute),
      });
    } else if (verdict.suggestedAction === "ban") {
      const duration = verdict.suggestedDurationMs ?? defaultBan;
      await ctx.db.patch(report.targetId, {
        bannedUntil: now + duration,
        banReason: `عقوبة تلقائية: ${verdict.violation ?? "مخالفة القوانين"}`,
      });
    }

    await ctx.db.insert("moderationLogs", {
      actorType: "ai",
      actorName: "رقيب العقول",
      action:
        verdict.suggestedAction === "warn"
          ? "ai_warn"
          : verdict.suggestedAction === "mute"
            ? "ai_mute"
            : "ai_ban",
      targetId: report.targetId,
      targetName: target.name ?? "لاعب",
      reason: `تطبيق تلقائي: ${verdict.violation ?? verdict.reasoning}`,
      severity: verdict.severity,
      createdAt: Date.now(),
    });
  },
});

/** Scheduler entry: review a newly submitted report with the AI. */
export const handleReport = internalAction({
  args: { reportId: v.id("reports") },
  handler: async (ctx, { reportId }) => {
    try {
      const [report, settings, rulesText] = await Promise.all([
        ctx.runQuery(internal.moderation.getReportForReview, { reportId }),
        ctx.runQuery(internal.moderation.getModSettingsForReview, {}),
        ctx.runQuery(internal.moderation.getActiveRulesText, {}),
      ]);
      if (!report) return;
      if (!settings.aiEnabled) return;

      const apiKey = getOpenRouterKey();
      if (!apiKey) {
        await ctx.runMutation(internal.moderation.recordAiReview, {
          reportId,
          error: "مفتاح OpenRouter غير مضبوط في الإعدادات",
          autoApply: false,
        });
        return;
      }

      const content = [
        `اللاعب المُبلَّغ عنه: ${report.targetName}`,
        `سبب البلاغ: ${report.reason}`,
        report.details ? `التفاصيل: ${report.details}` : null,
        `مُقدِّم البلاغ: ${report.reporterName}`,
      ]
        .filter(Boolean)
        .join("\n");

      const verdict = await callOpenRouter(
        apiKey,
        DEFAULT_MODEL,
        rulesText,
        content,
      );
      await ctx.runMutation(internal.moderation.recordAiReview, {
        reportId,
        verdict: {
          compliant: verdict.compliant,
          violation: verdict.violation ?? undefined,
          severity: verdict.severity,
          suggestedAction: verdict.suggestedAction,
          suggestedDurationMs: verdict.suggestedDurationMs ?? undefined,
          reasoning: verdict.reasoning,
        },
        autoApply: settings.aiAutoApply,
      });
    } catch (error) {
      await ctx.runMutation(internal.moderation.recordAiReview, {
        reportId,
        error: error instanceof Error ? error.message : "خطأ غير معروف",
        autoApply: false,
      });
    }
  },
});

export const getModSettingsForReview = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getSettingsData(ctx);
  },
});

// ---------------------------------------------------------------------------
// Manual AI scan — the owner can review any content with one click.
// ---------------------------------------------------------------------------

export const aiModerateContent = action({
  args: {
    content: v.string(),
    context: v.optional(v.string()),
  },
  handler: async (ctx, { content, context }) => {
    const settings = await ctx.runQuery(
      internal.moderation.getModSettingsForReview,
      {},
    );
    const rulesText = await ctx.runQuery(
      internal.moderation.getActiveRulesText,
      {},
    );

    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error(
        "مفتاح OpenRouter غير مضبوط — أضِفه في تبويب المفاتيح (OPENROUTER_API_KEY)",
      );
    }

    const userContent = [context ? `السياق: ${context}` : null, content]
      .filter(Boolean)
      .join("\n");

    // Re-run with the actual active rules for the manual scan.
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zaka.freebuff.app",
        "X-Title": "Zaka - Quiz Game",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MODERATION_SYSTEM_PROMPT(rulesText) },
          {
            role: "user",
            content: `قيّم المحتوى التالي وفق قوانين الموقع:\n\n${userContent}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenRouter فشل: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenRouter لم يُرجع رداً");
    return parseVerdict(text);
  },
});

// ---------------------------------------------------------------------------
// AI help-desk — «المساعد الذكي» in the owner room.
// The owner (or an admin) asks how to manage the site and the AI answers with
// concrete steps and ready-to-use code snippets through the same OpenRouter key.
// ---------------------------------------------------------------------------

const HELP_DESK_SYSTEM_PROMPT = `
أنت "المساعد الذكي" للعبة «ذكاء» — لعبة تحديات تنافسية بين الأصدقاء.
المنصة: React + Vite + Tailwind + Convex (قاعدة بيانات و Backend) + Convex Auth،
والذكاء الاصطناعي يعمل عبر OpenRouter (OPENROUTER_API_KEY).

لديك صلاحيات المالك/المشرف في غرفة المالك: إدارة المستخدمين والعقوبات والبلاغات،
القوانين، الرقيب الآلي (فحص البلاغات تلقائياً وتطبيق العقوبات)، المدير الآلي
(فحص دوري كل 15 دقيقة)، بنك الأسئلة، الإعلانات، ومكافحة الغش.

أجب بالعربية بوضوح وبخطوات عملية قابلة للتنفيذ فوراً. إذا طُلب حل برمجي
فاكتب الكود جاهزاً (TypeScript/Convex) داخل كتلة \`\`\`. كن مختصراً ومحدداً:
المشكلة، السبب المحتمل، الخطوات، ثم الكود إن لزم. إن كانت المشكلة خارج
نطاقك (مثل خطأ في استضافة أندرويد) فاشرح السبب الأرجح والحل الأنسب.
`;

/** Ask the site-management AI for a fix/guide. Owner and admins only. */
export const aiHelpDesk = action({
  args: { question: v.string() },
  handler: async (ctx, { question }): Promise<{ answer: string }> => {
    const staff = await ctx.runQuery(internal.moderation.getStaffForHelp, {});
    if (!staff) {
      throw new Error("غير مصرح — هذه الميزة للمالك والمشرفين فقط");
    }

    const settings = await ctx.runQuery(
      internal.moderation.getModSettingsForReview,
      {},
    );
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error(
        "مفتاح OpenRouter غير مضبوط — أضِفه في تبويب المفاتيح (OPENROUTER_API_KEY)",
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zaka.freebuff.app",
        "X-Title": "Zaka - Quiz Game",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: HELP_DESK_SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenRouter فشل: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenRouter لم يُرجع رداً");
    return { answer: text };
  },
});

export const getStaffForHelp = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!me) return null;
    return isStaffUser(me) ? { name: me.name ?? "المشرف" } : null;
  },
});


// AI Moderation System
// 1. Real-time chat filtering (toxicity detection)
// 2. Behavior pattern analysis (cheating detection)
// 3. Anomaly detection (unusual activity)
// 4. Automated warnings (escalating penalties)
// 5. Community health scoring
// 6. Player reputation system
// 7. Content quality assessment
// 8. Report priority scoring
// 9. False positive reduction
// 10. Human review queue optimization
