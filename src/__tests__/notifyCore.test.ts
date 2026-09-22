import { describe, expect, it } from "vitest";
import {
  NOTIF_CATEGORIES,
  NOTIF_LIMITS,
  PRIORITY_RANK,
  decideDelivery,
  inRange,
  isAccountNotice,
  isCritical,
  isInQuietHours,
  isNotifCategory,
  normalizeCategory,
  priorityOf,
  quietEndsAt,
  resolvedRank,
  survivesQueue,
  type DeliveryInput,
} from "@/convex/notifyCore";

/** مدخلات افتراضية نظيفة: لاعب بلا قيود، منتصف النهار. */
const base = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
  type: "info",
  category: "duels",
  muted: false,
  quietHours: undefined,
  quietDefer: true,
  minPriority: "normal",
  maxPerHour: 12,
  nowHour: 14,
  recentCount: 0,
  ...over,
});

describe("تصنيف الفئات", () => {
  it("يعرف الفئات الحقيقية ويرفض غيرها", () => {
    for (const c of NOTIF_CATEGORIES) expect(isNotifCategory(c)).toBe(true);
    expect(isNotifCategory("drops")).toBe(false);
    expect(isNotifCategory(undefined)).toBe(false);
    expect(isNotifCategory(7)).toBe(false);
  });

  it("يُسند أي فئة مجهولة إلى system — لا إشعار بلا تصنيف", () => {
    expect(normalizeCategory("market")).toBe("system");
    expect(normalizeCategory(undefined)).toBe("system");
    expect(normalizeCategory("economy")).toBe("economy");
  });
});

describe("الأولوية", () => {
  it("التحذير والحظر عاجلان", () => {
    expect(priorityOf({ type: "warning" })).toBe(2);
    expect(priorityOf({ type: "ban" })).toBe(2);
  });

  it("المبارزات والسلاسل والتحديثات مهمة", () => {
    expect(priorityOf({ type: "info", category: "duels" })).toBe(1);
    expect(priorityOf({ type: "info", category: "streaks" })).toBe(1);
    expect(priorityOf({ type: "update" })).toBe(1);
  });

  it("الأولوية الصريحة تتقدّم على المشتقّة", () => {
    expect(resolvedRank({ type: "info", category: "social", priority: "critical" })).toBe(2);
    expect(resolvedRank({ type: "info", category: "social" })).toBe(0);
    // أولوية غير معروفة تُتجاهل ولا تُفسد الحساب
    expect(resolvedRank({ type: "info", category: "duels", priority: "urgent" })).toBe(1);
  });

  it("العقوبة حرجة دائماً — لا تتجاوزها أولوية عادية", () => {
    expect(isCritical({ type: "ban", priority: "normal" })).toBe(true);
    expect(isCritical({ type: "info", priority: "critical" })).toBe(true);
    expect(isCritical({ type: "info", priority: "normal" })).toBe(false);
  });
});

describe("ساعات الهدوء", () => {
  it("نطاق نهاري عادي", () => {
    const q = { from: 9, to: 17 };
    expect(isInQuietHours(8, q)).toBe(false);
    expect(isInQuietHours(9, q)).toBe(true);
    expect(isInQuietHours(16, q)).toBe(true);
    expect(isInQuietHours(17, q)).toBe(false); // النهاية حصرية
  });

  it("نطاق عابر لمنتصف الليل (22 → 7)", () => {
    const q = { from: 22, to: 7 };
    expect(isInQuietHours(23, q)).toBe(true);
    expect(isInQuietHours(3, q)).toBe(true);
    expect(isInQuietHours(6, q)).toBe(true);
    expect(isInQuietHours(7, q)).toBe(false);
    expect(isInQuietHours(12, q)).toBe(false);
  });

  it("نطاق فارغ (from === to) = لا هدوء إطلاقاً", () => {
    expect(isInQuietHours(3, { from: 5, to: 5 })).toBe(false);
  });

  it("بلا نطاق = لا هدوء", () => {
    expect(isInQuietHours(3, undefined)).toBe(false);
  });

  it("ينتهي الهدوء في الساعة المحددة، وإن مرّت اليوم فغداً", () => {
    const at10 = new Date(2026, 8, 22, 10, 30, 0, 0).getTime();
    const end = quietEndsAt(at10, { from: 22, to: 7 });
    const endDate = new Date(end);
    expect(endDate.getDate()).toBe(23); // العاشرة صباحاً بعد السابعة ⇒ غداً
    expect(endDate.getHours()).toBe(7);
    expect(endDate.getMinutes()).toBe(0);
  });
});

describe("قرار التسليم — الأولوية بين القواعد", () => {
  it("لاعب بلا قيود: تسليم فوري", () => {
    const d = decideDelivery(base());
    expect(d.action).toBe("deliver");
    expect(d.reason).toBe("delivered");
  });

  it("الكتم الصريح يُسقط الإشعار — ولا يُخزَّن شيء", () => {
    const d = decideDelivery(base({ muted: true }));
    expect(d.action).toBe("drop");
    expect(d.reason).toBe("category_muted");
  });

  it("العقوبة تتجاوز الكتم والهدوء — شأن قانوني على الحساب", () => {
    const muted = decideDelivery(base({ type: "ban", muted: true }));
    expect(muted.action).toBe("deliver");
    expect(muted.reason).toBe("account_notice");

    const quiet = decideDelivery(
      base({ type: "ban", quietHours: { from: 22, to: 7 }, nowHour: 3 }),
    );
    expect(quiet.action).toBe("deliver");
    expect(quiet.reason).toBe("account_notice");
  });

  it("الحرج يتجاوز ساعات الهدوء والسقف", () => {
    const d = decideDelivery(
      base({
        priority: "critical",
        quietHours: { from: 22, to: 7 },
        nowHour: 2,
        maxPerHour: 1,
        recentCount: 99,
      }),
    );
    expect(d.action).toBe("deliver");
    expect(d.reason).toBe("critical");
  });

  it("الهدوء يُؤجّل (لا يُسقط) ما دام التأجيل مفعّلاً", () => {
    const d = decideDelivery(base({ quietHours: { from: 22, to: 7 }, nowHour: 23 }));
    expect(d.action).toBe("defer");
    expect(d.reason).toBe("quiet_hours");
  });

  it("إن ألغى اللاعب التأجيل فالهدوء يُسقط الإشعار", () => {
    const d = decideDelivery(
      base({ quietHours: { from: 22, to: 7 }, nowHour: 23, quietDefer: false }),
    );
    expect(d.action).toBe("drop");
    expect(d.reason).toBe("quiet_hours");
  });

  it("ما دون أدنى أولوية يُؤجَّل للملخص", () => {
    const d = decideDelivery(base({ category: "social", minPriority: "important" }));
    expect(d.action).toBe("defer");
    expect(d.reason).toBe("below_threshold");
  });

  it("المهم يمرّ من عتبة important", () => {
    const d = decideDelivery(base({ category: "duels", minPriority: "important" }));
    expect(d.action).toBe("deliver");
  });

  it("السقف الساعي يُؤجّل الزائد", () => {
    const d = decideDelivery(base({ maxPerHour: 3, recentCount: 3 }));
    expect(d.action).toBe("defer");
    expect(d.reason).toBe("rate_limited");
  });

  it("سقف صفر يعني إلغاء الحد الساعي", () => {
    const over = decideDelivery(base({ maxPerHour: 0, recentCount: 500 }));
    expect(over.action).toBe("deliver");
  });

  it("كل قرار يحمل تفسيراً عربياً غير فارغ", () => {
    const cases: DeliveryInput[] = [
      base(),
      base({ muted: true }),
      base({ type: "ban", muted: true }),
      base({ quietHours: { from: 0, to: 24 }, nowHour: 3 }),
      base({ minPriority: "critical" }),
      base({ maxPerHour: 1, recentCount: 5 }),
    ];
    for (const c of cases) {
      const d = decideDelivery(c);
      expect(d.explain.length).toBeGreaterThan(5);
      expect(d.explain).not.toContain("undefined");
    }
  });

  it("الحتمية: نفس المدخلات ⇒ نفس القرار دائماً", () => {
    const input = base({ minPriority: "important", recentCount: 4, maxPerHour: 5 });
    const first = decideDelivery(input);
    for (let i = 0; i < 20; i++) expect(decideDelivery(input)).toEqual(first);
  });

  it("الرتابة: رفع الأولوية لا يهبط بالقرار من تسليم إلى تأجيل", () => {
    const low = decideDelivery(base({ category: "social", minPriority: "normal" }));
    const high = decideDelivery(
      base({ category: "social", minPriority: "normal", priority: "important" }),
    );
    expect(low.action).toBe("deliver");
    expect(high.action).toBe("deliver");
    expect(PRIORITY_RANK.critical).toBeGreaterThan(PRIORITY_RANK.important);
    expect(PRIORITY_RANK.important).toBeGreaterThan(PRIORITY_RANK.normal);
  });
});

describe("حراسة الطابور", () => {
  it("الكتم يسري حتى على الإشعارات المنتظرة في الطابور", () => {
    expect(survivesQueue({ type: "info", category: "duels", muted: true })).toBe(false);
    expect(survivesQueue({ type: "info", category: "duels", muted: false })).toBe(true);
  });

  it("إشعار العقوبة لا يسقط من الطابور أبداً", () => {
    expect(survivesQueue({ type: "ban", category: "system", muted: true })).toBe(true);
  });

  it("isAccountNotice صريحة ولا تعتمد على الفئة", () => {
    expect(isAccountNotice({ type: "ban" })).toBe(true);
    expect(isAccountNotice({ type: "warning" })).toBe(false);
  });
});

describe("الحدود المسموحة", () => {
  it("يقبل القيم داخل المدى ويرفض الخارجة", () => {
    expect(inRange(12, NOTIF_LIMITS.maxPerHour)).toBe(true);
    expect(inRange(0, NOTIF_LIMITS.maxPerHour)).toBe(true);
    expect(inRange(61, NOTIF_LIMITS.maxPerHour)).toBe(false);
    expect(inRange(23, NOTIF_LIMITS.digestHour)).toBe(true);
    expect(inRange(24, NOTIF_LIMITS.digestHour)).toBe(false);
    expect(inRange(NaN, NOTIF_LIMITS.digestHour)).toBe(false);
  });
});
