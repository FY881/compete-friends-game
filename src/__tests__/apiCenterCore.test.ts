import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUARD,
  MAX_MODEL_CANDIDATES,
  decideCall,
  detectPresetId,
  estimateTokens,
  extractJson,
  matchTaskFromLabel,
  modelCandidates,
  normalizeChatUrl,
  normalizeModelsUrl,
  promptFingerprint,
  sanitizeGuard,
  speedScore,
  stripThinking,
  type GuardSnapshot,
} from "../convex/apiCenterCore";

const snapshot = (over: Partial<GuardSnapshot> = {}): GuardSnapshot => ({
  minuteCalls: 0,
  dayCalls: 0,
  dayTokens: 0,
  circuitOpen: false,
  circuitOpenedAt: null,
  failures: 0,
  ...over,
});

describe("تطبيع الرابط — يقبل ما يكتبه المالك حرفياً", () => {
  it("يحوّل رابط MiniMax المجرّد إلى نقطة اتصال صحيحة", () => {
    expect(normalizeChatUrl("api.minimax.io/v1", "minimax")).toBe(
      "https://api.minimax.io/v1/chat/completions",
    );
  });

  it("يضيف المخطط ويزيل الشرطة الأخيرة", () => {
    expect(normalizeChatUrl("api.minimax.io/v1/", "minimax")).toBe(
      "https://api.minimax.io/v1/chat/completions",
    );
  });

  it("لا يلمس رابطاً كاملاً", () => {
    const full = "https://api.minimax.io/v1/chat/completions";
    expect(normalizeChatUrl(full, "minimax")).toBe(full);
  });

  it("يبني النماذج من نفس الأساس", () => {
    expect(normalizeModelsUrl("api.minimax.io/v1", "minimax")).toBe("https://api.minimax.io/v1/models");
  });

  it("يضيف /v1 لمزوّد بلا مسار", () => {
    expect(normalizeChatUrl("https://api.example.com", "generic")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("يحترم مساراً مخصّصاً غير v1", () => {
    expect(normalizeChatUrl("https://proxy.test/openai", "generic")).toBe(
      "https://proxy.test/openai/chat/completions",
    );
  });
});

describe("اكتشاف المزوّد من الرابط", () => {
  it("يتعرّف على MiniMax مهما كتب المالك", () => {
    expect(detectPresetId("api.minimax.io/v1")).toBe("minimax");
    expect(detectPresetId("https://api.minimax.io/v1")).toBe("minimax");
  });

  it("يتعرّف على OpenRouter وOpenAI", () => {
    expect(detectPresetId("https://openrouter.ai/api/v1")).toBe("openrouter");
    expect(detectPresetId("https://api.openai.com/v1")).toBe("openai");
  });

  it("أي مزوّد مستقبلي يسقط على المخصّص ويعمل", () => {
    expect(detectPresetId("https://new-provider.example/v1")).toBe("generic");
  });
});

describe("ربط الاسم الداخلي بوحدة AI — الجسر الذي يجعل كل اللعبة مرتبطة", () => {
  it("يعرف الأسماء الحقيقية المستخدمة في الكود", () => {
    expect(matchTaskFromLabel("Zaka Moderation")).toBe("moderation");
    expect(matchTaskFromLabel("Zaka Manual Moderation")).toBe("manual-moderation");
    expect(matchTaskFromLabel("Zaka Help Desk")).toBe("help-desk");
    expect(matchTaskFromLabel("MindClash Question Generator")).toBe("questions");
    expect(matchTaskFromLabel("MindClash Pack Generator")).toBe("packs");
    expect(matchTaskFromLabel("MindClash Report Analysis")).toBe("reports");
    expect(matchTaskFromLabel("MindClash What-If Simulator")).toBe("simulator");
    expect(matchTaskFromLabel("AI Commentator")).toBe("commentary");
    expect(matchTaskFromLabel("AI Guardian")).toBe("guardian");
    expect(matchTaskFromLabel("Zaka - Quiz Game")).toBe("quiz");
    expect(matchTaskFromLabel("Zaka Membership Assistant")).toBe("membership-assistant");
    expect(matchTaskFromLabel("Zaka Vice Owner")).toBe("vice-owner");
    expect(matchTaskFromLabel("Zaka Upgraded AI (agent-42)")).toBe("upgraded-ai");
    expect(matchTaskFromLabel("Zaka Toolbelt")).toBe("toolbelt");
  });

  it("الأخصّ يسبق الأعمّ (الرقابة اليدوية ليست الرقابة)", () => {
    expect(matchTaskFromLabel("Zaka Manual Moderation")).not.toBe("moderation");
    expect(matchTaskFromLabel("MindClash Pack Generator")).not.toBe("questions");
  });

  it("أي وحدة جديدة تُوجَّه تلقائياً ولا تتعطّل", () => {
    expect(matchTaskFromLabel("وحدة لم تُسمَّ بعد")).toBe("other");
    expect(matchTaskFromLabel("")).toBe("other");
  });
});

describe("بصمة الطلب — أساس الذاكرة", () => {
  const msgs = [{ role: "user", content: "ما هي عاصمة مصر؟" }];

  it("حتمية: نفس المدخلات تعطي نفس البصمة", () => {
    expect(promptFingerprint(msgs, "MiniMax-M2", 0.7)).toBe(
      promptFingerprint(msgs, "MiniMax-M2", 0.7),
    );
  });

  it("حسّاسة: أي تغيير يغيّر البصمة", () => {
    const base = promptFingerprint(msgs, "MiniMax-M2", 0.7);
    expect(promptFingerprint(msgs, "MiniMax-M2", 0.8)).not.toBe(base);
    expect(promptFingerprint(msgs, "MiniMax-M3", 0.7)).not.toBe(base);
    expect(promptFingerprint([{ role: "user", content: "سؤال آخر" }], "MiniMax-M2", 0.7)).not.toBe(base);
    expect(promptFingerprint([{ role: "system", content: "دور" }, ...msgs], "MiniMax-M2", 0.7)).not.toBe(base);
  });
});

describe("قرار الحماية — الترتيب مقصود", () => {
  it("الذاكرة تسبق كل شيء (أرخص نتيجة)", () => {
    const d = decideCall({
      guard: DEFAULT_GUARD,
      snapshot: snapshot({ circuitOpen: true, circuitOpenedAt: Date.now() }),
      cacheReply: "ردّ محفوظ",
      cacheAllowed: true,
      now: Date.now(),
    });
    expect(d.outcome).toBe("cache");
  });

  it("لا تُستخدم الذاكرة لوحدة لا تسمح بها", () => {
    const d = decideCall({
      guard: DEFAULT_GUARD,
      snapshot: snapshot(),
      cacheReply: "ردّ محفوظ",
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("proceed");
  });

  it("الحماية المعطّلة تمرّر كل شيء", () => {
    const d = decideCall({
      guard: { ...DEFAULT_GUARD, enabled: false },
      snapshot: snapshot({ dayCalls: 999999, minuteCalls: 999999 }),
      cacheReply: null,
      cacheAllowed: false,
      now: 1000,
    });
    expect(d.outcome).toBe("proceed");
  });

  it("سقف الاستدعاءات اليومي يمنع", () => {
    const d = decideCall({
      guard: { ...DEFAULT_GUARD, dailyCallCap: 100 },
      snapshot: snapshot({ dayCalls: 100 }),
      cacheReply: null,
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("block");
    if (d.outcome === "block") expect(d.reason).toContain("اليومي");
  });

  it("سقف التوكنات اليومي يمنع", () => {
    const d = decideCall({
      guard: { ...DEFAULT_GUARD, dailyTokenCap: 5000 },
      snapshot: snapshot({ dayTokens: 5001 }),
      cacheReply: null,
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("block");
  });

  it("حدّ الدقيقة يمنع", () => {
    const d = decideCall({
      guard: { ...DEFAULT_GUARD, perMinuteCap: 20 },
      snapshot: snapshot({ minuteCalls: 20 }),
      cacheReply: null,
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("block");
    if (d.outcome === "block") expect(d.reason).toContain("الدقيقة");
  });

  it("القاطع المفتوح يمنع داخل التبريد، ويسمح بعده (نصف مفتوح)", () => {
    const guard = { ...DEFAULT_GUARD, circuitEnabled: true, cooldownMs: 60_000 };
    const now = 1_000_000;
    const open = snapshot({ circuitOpen: true, circuitOpenedAt: now - 10_000, failures: 5 });
    const blocked = decideCall({ guard, snapshot: open, cacheReply: null, cacheAllowed: false, now });
    expect(blocked.outcome).toBe("block");

    const stillOpen = decideCall({
      guard,
      snapshot: open,
      cacheReply: null,
      cacheAllowed: false,
      now: now + 61_000,
    });
    expect(stillOpen.outcome).toBe("proceed");
  });

  it("القاطع المعطّل لا يمنع أبداً", () => {
    const d = decideCall({
      guard: { ...DEFAULT_GUARD, circuitEnabled: false },
      snapshot: snapshot({ circuitOpen: true, circuitOpenedAt: Date.now(), failures: 99 }),
      cacheReply: null,
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("proceed");
  });

  it("بلا سقوف (الافتراضي) كل شيء يمر — لا يتحطّم شيء عند التركيب", () => {
    const d = decideCall({
      guard: DEFAULT_GUARD,
      snapshot: snapshot({ dayCalls: 100000, minuteCalls: 500 }),
      cacheReply: null,
      cacheAllowed: false,
      now: Date.now(),
    });
    expect(d.outcome).toBe("proceed");
  });
});

describe("تنقية إعدادات الحماية", () => {
  it("ترفض القيم السالبة والغير رقمية", () => {
    const g = sanitizeGuard({ dailyCallCap: -5, perMinuteCap: Number.NaN, failureThreshold: 0 });
    expect(g.dailyCallCap).toBe(DEFAULT_GUARD.dailyCallCap);
    expect(g.perMinuteCap).toBe(DEFAULT_GUARD.perMinuteCap);
    expect(g.failureThreshold).toBe(1);
  });

  it("تفرض حداً أدنى للتبريد", () => {
    expect(sanitizeGuard({ cooldownMs: 10 }).cooldownMs).toBe(1000);
  });

  it("الإعداد الفارغ يعطي الافتراضي", () => {
    expect(sanitizeGuard(null)).toEqual(DEFAULT_GUARD);
  });
});

describe("سلسلة النماذج", () => {
  it("التفضيل أولاً ثم قالب المزوّد", () => {
    const chain = modelCandidates("minimax", [], "MiniMax-M3");
    expect(chain[0]).toBe("MiniMax-M3");
    expect(chain).toContain("MiniMax-M2.7-highspeed");
  });

  it("بلا تفضيل: الأسرع أولاً", () => {
    expect(modelCandidates("minimax", [], null)[0]).toContain("highspeed");
  });

  it("تحترم سقف عدد النماذج", () => {
    expect(modelCandidates("minimax", ["a", "b", "c", "d", "e"], null).length).toBeLessThanOrEqual(
      MAX_MODEL_CANDIDATES,
    );
  });

  it("بلا تكرار", () => {
    const chain = modelCandidates("minimax", ["MiniMax-M2"], "MiniMax-M2");
    expect(new Set(chain).size).toBe(chain.length);
  });

  it("مزوّد مخصّص بلا قالب يعتمد على المُكتشَف", () => {
    const chain = modelCandidates("generic", ["my-model-fast"], null);
    expect(chain[0]).toBe("my-model-fast");
  });

  it("ترتيب السرعة يفضّل highspeed على النماذج الثقيلة", () => {
    expect(speedScore("MiniMax-M2.5-highspeed")).toBeGreaterThan(speedScore("MiniMax-M2.5"));
    expect(speedScore("MiniMax-M2.5-highspeed")).toBeGreaterThan(speedScore("MiniMax-M3"));
  });
});

describe("تنظيف ردّ النموذج", () => {
  it("يحذف كتلة التفكير", () => {
    expect(stripThinking("<think>أفكر…</think>الجواب النهائي")).toBe("الجواب النهائي");
    expect(stripThinking("<thinking>خطوات</thinking> نعم")).toBe("نعم");
  });

  it("لا يلمس نصاً عادياً", () => {
    expect(stripThinking("لا تفكير هنا")).toBe("لا تفكير هنا");
  });

  it("يستخرج JSON من داخل كتلة كود أو نص", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('إذاً النتيجة: {"a":1} انتهى')).toBe('{"a":1}');
    expect(extractJson("لا شيء")).toBe("لا شيء");
  });

  it("نصّ فيه <think> قبل JSON لا يكسر التحليل", () => {
    expect(extractJson('<think>أفكر</think>{"ok":true}')).toBe('{"ok":true}');
  });
});

describe("تقدير التوكنات", () => {
  it("لا يُنتج صفراً لنصّ غير فارغ ويحترم الفراغ", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("ا")).toBeGreaterThan(0);
    expect(estimateTokens("x".repeat(300))).toBe(100);
  });
});
