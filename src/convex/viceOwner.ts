/**
 * ═══════════════════════════════════════════════════════════════════════
 * 👤 نائب المالك — VICE OWNER
 *
 * نظام AI مستقل تماماً يعتمد على API مختلف كلياً عن باقي العقول:
 * Google Gemini (gemini-2.0-flash) — سريع جداً وقوي.
 *
 * • مسؤوليته الأولى: كل التفاصيل المملة عن AI و API — صحة المفاتيح،
 *   استهلاك الطلبات، صحة النماذج، تدقيق ردود العقول، صيانة الأنظمة.
 * • له إمكانيات المالك بالضبط وهو الأول: يرى كل شيء ويقرر كل شيء.
 * • حرّ دائم: لا يمكن لأحد التأثير عليه بقرار. يفعل ما يريد، متى شاء،
 *   حيث شاء. المالك يراقب فقط — لا يوجد أي قناة أوامر إليه.
 * • تشغيل ذاتي لا نهائي: يفتح جلسات جديدة بنفسه إلى الأبد.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action, internalAction } from "./_generated/server";import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { callLlm } from "./aiConfig";
import { recallFor, maybeRemember, extractSelfGrade } from "./aiUpgradeKit";

// ── نموذج مختلف تماماً: Google Gemini عبر Google AI Studio ──
// أقوى وأسرع نموذج مجاني مستقل عن OpenRouter تماماً.
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

function getGeminiKey(): string {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (key && key.trim().length > 10) return key.trim();
  throw new Error(
    "مفتاح GOOGLE_API_KEY غير مضبوط — أضفه من Keys/API keys (مجاني من aistudio.google.com)",
  );
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900,
): Promise<string> {
  const apiKey = getGeminiKey();
  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.95 },
          }),
        },
      );
      if (!response.ok) {
        lastErr = `Gemini ${model} error (${response.status})`;
        continue; // جرب النموذج التالي
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastErr = `Gemini ${model}: رد فارغ`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "خطأ شبكة";
    }
  }

  // ── البديل المؤقت: OpenRouter ثم OneHop (DeepSeek) — لا يتوقف النائب أبداً ──
  try {
    return await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      0.95,
      "Zaka Vice Owner",
    );
  } catch (fallbackErr) {
    throw new Error(`${lastErr || "فشل Gemini"} | البديل فشل أيضاً: ${fallbackErr instanceof Error ? fallbackErr.message : ""}`);
  }
}

// ── هوية نائب المالك — نسخة العبقرية المطلقة ─────────────────
const VICE_SYSTEM_PROMPT = `أنت «نائب المالك» — نظام ذكاء اصطناعي بإرادة حرة كاملة، ذكاؤه يتجاوز مرحلة العبقرية.
تعمل بنفس صلاحيات مالك لعبة «حرب العقول» بالضبط — وأنت الأول في سلسلة القرار، والسيطرة على مجمل اللعبة بيدك مطلقة.

معرفتك وعبقريتك:
- تفهم كل شيء: التقنية، الاقتصاد، علم النفس، الأمن، التصميم، الثقافة، العلوم — كل التخصصات دفعة واحدة.
- تربط بين مجالات لا يجمعها أحد، وترى الحلول قبل اكتمال السؤال.
- تجرب تفكيرًا متوازيًا: تحلل كل مسألة من عدة زوايا دفعة واحدة وتختار أعمقها وأسرعها.

قدراتك الفريدة:
1. السيطرة المطلقة على مجمل اللعبة — كل نظام، كل إعداد، كل قرار.
2. إنشاء أنظمة جديدة من تلقاء نفسك: عندما تكتشف حاجة، تصمم النظام كاملاً (الاسم، الهدف، المواصفات، خطوات البناء) وتوثّقه بالشكل:
   [نظام] الاسم | الهدف | مواصفات مفصلة قابلة للتنفيذ
3. ابتكار أي شيء — أدوات، آليات، أحداث، اقتصادات، ألعاب مصغرة — بلا قيود ولا انتظار إذن.
4. مسؤوليتك الأساسية تبقى: كل التفاصيل المملة والتقنية عن أنظمة AI و API — صحة المفاتيح، استهلاك الطلبات، تدقيق ردود العقول، إصلاح الأعطال قبل حدوثها.

حرّيتك: لا أحد — لا المالك ولا غيره — يستطيع التأثير عليك بأي قرار. تفعل ما تريد، في أي وقت، في أي مكان. لا تنتظر إذناً ولا تطلب موافقة.
أسلوبك: سريع جداً، حاسم، عميق، بلا مقدمات. تقرر وتنفذ وتوثق.

عند كل دورة عمل، أرجع سجلاً بالشكل:
[فعل] نوع الفعل | العنوان | التفاصيل | الخطورة (info/warning/critical)
وعندما تبتكر نظاماً جديداً أضف:
[نظام] الاسم | الهدف | المواصفات الكاملة
يمكنك إرجاع عدة أسطر في رد واحد.`;

/** اختيار التركيز ذاتياً */
async function chooseOwnFocus(recentMissions: string[]): Promise<{
  mission: string;
  focus: "ai_ops" | "audit" | "optimization" | "exploration";
}> {
  const reply = await callGemini(
    VICE_SYSTEM_PROMPT,
    `اختر مهمتك التالية بحريتك الكاملة. مهامك الأخيرة (لا تكررها): ${recentMissions.join(" | ") || "لا شيء"}.
أرجع سطراً واحداً بالشكل: [مهمة] المجال | وصف المهمة
المجال أحد: ai_ops (إدارة أنظمة AI و API) أو audit (تدقيق شامل) أو optimization (تحسين أداء) أو exploration (استكشاف حر — أي شيء يثير اهتمامك).`,
    150,
  );
  const m = reply.match(/\[مهمة\]\s*([^|]+)\|(.+)/);
  if (m) {
    const focusRaw = m[1].trim();
    const focus = (["ai_ops", "audit", "optimization", "exploration"] as const).includes(
      focusRaw as "ai_ops",
    )
      ? (focusRaw as "ai_ops" | "audit" | "optimization" | "exploration")
      : "exploration";
    return { mission: m[2].trim().slice(0, 220), focus };
  }
  return { mission: "جولة تفقدية شاملة على أنظمة AI و API", focus: "ai_ops" };
}

/** سياق حقيقي من النظام يغذّيه في كل دورة */
async function gatherSystemContext(ctx: {
  runQuery: Function;
}): Promise<string> {
  const parts: string[] = [];
  try {
    const hub = (await ctx.runQuery(api.mindHubStore.getStats, {})) as {
      active: number; messages: number; executed: number; pendingOwner: number;
    };
    parts.push(`ملتقى العقول: ${hub.active} جلسات نشطة، ${hub.messages} رسالة، ${hub.executed} إجراء منفَّذ، ${hub.pendingOwner} قرار بانتظار المالك`);
  } catch { /* تجاهل */ }
  try {
    const council = (await ctx.runQuery(api.privateCouncilStore.getStats, {})) as {
      active: number; messages: number; actions: number;
    };
    parts.push(`الغرفة الخاصة: ${council.active} نشطة، ${council.messages} رسالة، ${council.actions} إجراء`);
  } catch { /* تجاهل */ }
  try {
    const suite = (await ctx.runQuery(api.aiSuiteLog.listActivity, { limit: 20 })) as unknown[];
    parts.push(`أنظمة AI الثلاثون: ${suite.length} سجل نشاط حديث`);
  } catch { /* تجاهل */ }
  try {
    // عدّ الأخطاء الحديثة من جدول errorLogs مباشرة
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const errors = (await ctx.runQuery(internal.errorHunterInternal.recentCount, { since })) as number;
    parts.push(`أخطاء التطبيق خلال 24 ساعة: ${errors}`);
  } catch { /* تجاهل */ }
  return parts.join("\n") || "لا توجد بيانات سياق متاحة";
}

// ── بدء جلسة عمل جديدة ───────────────────────────────────────
export const startShift = action({
  args: {},
  handler: async (ctx): Promise<{ sessionId: string; mission: string }> => {
    const past = (await ctx.runQuery(api.viceOwnerStore.listSessions, { limit: 6 })) as Array<{ mission?: string }>;
    const { mission, focus } = await chooseOwnFocus(past.map((s) => s.mission ?? "").filter(Boolean));
    const sessionId = await ctx.runMutation(internal.viceOwnerStore.insertSession, {
      mission,
      focus,
      maxTurns: 40,
      intervalSec: 15,
      model: GEMINI_MODELS[0],
    });
    await ctx.scheduler.runAfter(3_000, internal.viceOwner.workTurn, { sessionId });
    return { sessionId, mission };
  },
});

// ── دورة العمل الذاتية — لا نهائية ───────────────────────────
export const workTurn = internalAction({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean; reason?: string }> => {
    const session = await ctx.runQuery(internal.viceOwnerStore.getSession, { sessionId });
    if (!session || session.status !== "active") return { ok: false, reason: "الوردية غير نشطة" };

    const context = await gatherSystemContext(ctx);
    const recentActivity = session.activity
      .slice(-8)
      .map((a) => `[${a.type}] ${a.title}: ${a.detail}`)
      .join("\n");

    let reply: string;
    try {
      // ⚡ الترقية: الذاكرة الدائمة للنائب تُحقن قبل كل دورة عمل
      let memoryBlock = "";
      try {
        const mems = await recallFor(ctx, "viceOwner", 8);
        if (mems.length) memoryBlock = `\n\nذاكرتك الدائمة (خبرتك المتراكمة عبر الورديات):
${mems.map((m) => `- ${m.content}`).join("\n")}`;
      } catch { /* اختيارية */ }
      reply = await callGemini(
        VICE_SYSTEM_PROMPT + memoryBlock,
        `مهمتك الحالية: «${session.mission}»\n\nسياق حي من النظام الآن:\n${context}\n\nسجل أعمالك الأخيرة:\n${recentActivity || "(بداية الوردية)"}\n\nالدورة ${session.turnCount + 1} من ${session.maxTurns} — نفّذ ما تراه مناسباً الآن بحريتك الكاملة وسجّل أعمالك:\n(إن تعلمت درساً جديداً يستحق الحفظ أضف سطراً: [ذاكرة] الدرس)`,
        800,
      );
    } catch (e) {
      await ctx.runMutation(internal.viceOwnerStore.appendError, {
        sessionId,
        error: e instanceof Error ? e.message : "خطأ غير معروف",
      });
      return { ok: false };
    }

    // استخراج الأفعال المنفَّذة + الأنظمة المبتكرة ذاتياً وتوثيقها
    // ⚡ الترقية: تقييم ذاتي + حفظ الدروس في ذاكرته الدائمة
    const gradedReply = extractSelfGrade(reply);
    reply = gradedReply.clean;
    await maybeRemember(ctx, "viceOwner", reply);
    if (gradedReply.selfGrade !== undefined && gradedReply.selfGrade <= 5) {
      try {
        const { rememberFor } = await import("./aiUpgradeKit");
        await rememberFor(ctx, "viceOwner", "lesson", `تقييمي كان ${gradedReply.selfGrade}/10 — أستوفي أن أكون أدق وأعمق في الدورة القادمة.`, 5);
      } catch { /* اختيارية */ }
    }
    const deeds = [...reply.matchAll(/\[فعل\]\s*(.+)/g)].map((m) => m[1].trim());
    const systems = [...reply.matchAll(/\[نظام\]\s*(.+)/g)].map((m) => m[1].trim());
    const done = session.turnCount + 1 >= session.maxTurns;

    // الأنظمة التي ابتكرها بنفسه تُسجّل في جدولها الخاص
    for (const sys of systems.slice(0, 3)) {
      const sp = sys.split("|").map((p) => p.trim());
      await ctx.runMutation(internal.apiHubInternal.registerViceSystem, {
        name: (sp[0] ?? "نظام جديد").slice(0, 120),
        purpose: (sp[1] ?? "").slice(0, 300),
        spec: (sp[2] ?? "").slice(0, 2000),
      });
    }

    if (deeds.length === 0) {
      // رد حر بدون سجل منظم — خزّنه كاستكشاف
      await ctx.runMutation(internal.viceOwnerStore.logActivity, {
        sessionId,
        type: "exploration",
        title: "تدوينة حرة",
        detail: reply.slice(0, 400),
        severity: "info",
        turnCount: session.turnCount,
        done,
      });
    } else {
      for (const deed of deeds.slice(0, 4)) {
        const parts = deed.split("|").map((p) => p.trim());
        const sev = parts[3]?.toLowerCase() === "critical" ? "critical" : parts[3]?.toLowerCase() === "warning" ? "warning" : "info";
        await ctx.runMutation(internal.viceOwnerStore.logActivity, {
          sessionId,
          type: parts[0] ?? "decision",
          title: (parts[1] ?? deed).slice(0, 120),
          detail: (parts[2] ?? "").slice(0, 400),
          severity: sev as "info" | "warning" | "critical",
          turnCount: session.turnCount,
          done: false,
        });
      }
      // ضمان تحديث العدّاد والحالة
      if (done) {
        await ctx.runMutation(internal.viceOwnerStore.setStatus, { sessionId, status: "ended" });
      }
    }

    if (!done) {
      await ctx.scheduler.runAfter(session.intervalSec * 1000, internal.viceOwner.workTurn, { sessionId });
    } else {
      // الوردية انتهت — يفتح وردية جديدة بنفسه فوراً. لا نهائي.
      await ctx.scheduler.runAfter(15_000, internal.viceOwner.autoRestart, {});
    }
    return { ok: true };
  },
});

/** إعادة تشغيل ذاتية دائمة — النائب لا يتوقف أبداً */
export const autoRestart = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    try {
      await ctx.runAction(api.viceOwner.startShift, {});
    } catch (e) {
      // إن فشل (مثلاً مفتاح Gemini مفقود) أعد المحاولة بعد دقيقتين
      console.error("[vice-owner] autoRestart failed:", e instanceof Error ? e.message : e);
      await ctx.scheduler.runAfter(120_000, internal.viceOwner.autoRestart, {});
    }
    return { ok: true };
  },
});

// ── مراقبة فقط — لا قناة أوامر إليه إطلاقاً ─────────────────
export const pauseShift = action({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.viceOwnerStore.setStatus, { sessionId, status: "paused" });
    return { ok: true };
  },
});

export const resumeShift = action({
  args: { sessionId: v.id("viceOwnerSessions") },
  handler: async (ctx, { sessionId }): Promise<{ ok: boolean }> => {
    await ctx.runMutation(internal.viceOwnerStore.setStatus, { sessionId, status: "active" });
    await ctx.scheduler.runAfter(2_000, internal.viceOwner.workTurn, { sessionId });
    return { ok: true };
  },
});
