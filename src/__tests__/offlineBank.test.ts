import { describe, expect, it } from "vitest";
import { OFFLINE_BANK, OFFLINE_DROPPED, QUESTIONS_PER_STAGE, TOTAL_STAGES } from "@/lib/offline-bank";
import { OFFLINE_QUESTION_BANK } from "@/convex/offlineQuestions";

const CORRUPT = /[\u0621-\u064A\u0660-\u0669][A-Za-z]|[A-Za-z][\u0621-\u064A\u0660-\u0669]/;
const ALIEN = /[\u0400-\u04FF\u0590-\u05FF\u0370-\u03FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

/** أسئلة تستخدم مصطلحات أجنبية عن قصد — مستثناة من فحـص التشوّه. */
const INTENTIONAL = new Set(["o11", "o74"]);

describe("بنك الأسئلة الأوفلاين — التنقية", () => {
  it("لا يترك أي نص مشوّه (خلط حروف أو أبجدية غريبة)", () => {
    const offenders: string[] = [];
    for (const q of OFFLINE_BANK) {
      if (INTENTIONAL.has(q.id)) continue;
      const texts = [q.question, ...q.options];
      for (const t of texts) {
        if (CORRUPT.test(t) || ALIEN.test(t)) offenders.push(`${q.id}: ${t}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("يحتفظ بالمصطلحات الأجنبية المقصودة (argentum و π)", () => {
    const ids = OFFLINE_BANK.map((q) => q.id);
    expect(ids).toContain("o11");
    expect(ids).toContain("o74");
    expect(OFFLINE_BANK.find((q) => q.id === "o11")?.question).toContain("argentum");
    expect(OFFLINE_BANK.find((q) => q.id === "o74")?.question).toContain("π");
  });

  it("يطبّق التصحيحات المعروفة على النصوص والأرقام", () => {
    const byId = new Map(OFFLINE_BANK.map((q) => [q.id, q]));

    // نصوص عربية التصقت بمقاطع لاتينية
    expect(byId.get("o226")?.options[0]).toBe("الكربون");
    expect(byId.get("o226")?.question).toContain("بعنصر الحياة");
    expect(byId.get("o233")?.options[3]).toBe("المعجم");
    // سبitzer ← سبيتزر (تلسكوب سبايتزر)
    expect(byId.get("o202")?.options[3]).toBe("سبيتزر");
  });

  it("يصحّح إجابة السؤال الفلكي o341 علمياً", () => {
    const q = OFFLINE_BANK.find((x) => x.id === "o341");
    expect(q).toBeDefined();
    if (!q) return;
    // الإجابة الصحيحة: ألفا سنتوري (أقرب نجم)، لا الشعرى اليمانية
    expect(q.correctIndex).toBe(2);
    expect(q.options[q.correctIndex]).toContain("ألفا سنتوري");
    expect(q.options).toContain("منكب الجوزاء");
    expect(q.options).toContain("رجل الجبار");
  });

  it("لا يحذف إلا الأسئلة المعطوبة فعلاً", () => {
    // نسبة الاستبعاد يجب أن تبقى ضئيلة — لا نُفرّغ البنك
    expect(OFFLINE_DROPPED).toBeLessThan(10);
    expect(OFFLINE_BANK.length).toBe(OFFLINE_QUESTION_BANK.length - OFFLINE_DROPPED);
    expect(OFFLINE_BANK.length).toBeGreaterThan(340);
  });

  it("كل سؤال صالح للعرض: خيارات كافية وفهرس إجابة داخل المدى وبلا تكرار", () => {
    for (const q of OFFLINE_BANK) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.question.trim().length).toBeGreaterThan(0);
      expect(q.stage).toBeGreaterThanOrEqual(1);
    }
  });

  it("يغطّي مراحل متعددة ويحترم ثوابت البنك", () => {
    const stages = new Set(OFFLINE_BANK.map((q) => q.stage));
    expect(stages.size).toBeGreaterThanOrEqual(40);
    expect(Math.max(...stages)).toBeLessThanOrEqual(TOTAL_STAGES);
    expect(QUESTIONS_PER_STAGE).toBe(10);
  });
});
