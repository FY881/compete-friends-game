import { describe, expect, it } from "vitest";
import {
  applyPollVote,
  pollIsOpen,
  pollRemaining,
  pollTallies,
  validatePollChoices,
  type PollOption,
} from "../convex/roomCore";

const HOUR = 60 * 60 * 1000;
const now = 1_700_000_000_000;

const options: PollOption[] = [
  { id: "o1", label: "منطق", votes: 3 },
  { id: "o2", label: "ذاكرة", votes: 1 },
  { id: "o3", label: "سرعة", votes: 0 },
];

describe("حالة الاستطلاع", () => {
  it("يحترم الإغلاق اليدوي والانتهاء بالزمن", () => {
    expect(pollIsOpen({ closed: false, expiresAt: now + HOUR }, now)).toBe(true);
    expect(pollIsOpen({ closed: true, expiresAt: now + HOUR }, now)).toBe(false);
    expect(pollIsOpen({ closed: false, expiresAt: now - 1 }, now)).toBe(false);
    expect(pollIsOpen({ closed: false, expiresAt: 0 }, now)).toBe(true);
  });

  it("يصف المدة بلغة واضحة", () => {
    expect(pollRemaining({ closed: true, expiresAt: now + HOUR }, now)).toBe("أُغلق");
    expect(pollRemaining({ closed: false, expiresAt: 0 }, now)).toBe("بلا انتهاء");
    expect(pollRemaining({ closed: false, expiresAt: now - 5 }, now)).toBe("انتهى");
    expect(pollRemaining({ closed: false, expiresAt: now + 50 * HOUR }, now)).toContain("يوم");
    expect(pollRemaining({ closed: false, expiresAt: now + 3 * HOUR }, now)).toContain("ساعة");
    expect(pollRemaining({ closed: false, expiresAt: now + 90_000 }, now)).toContain("دقيقة");
  });
});

describe("نسب التصويت", () => {
  it("تحسب النسب من المجموع الحقيقي", () => {
    const t = pollTallies(options);
    expect(t.map((x) => x.percent)).toEqual([75, 25, 0]);
    expect(t[0].votes).toBe(3);
  });

  it("لا تنهار عند صفر أصوات", () => {
    const t = pollTallies([{ id: "o1", label: "أ", votes: 0 }]);
    expect(t[0].percent).toBe(0);
  });
});

describe("قواعد الاختيار", () => {
  const single = { multi: false, maxChoices: 1, options };
  const multi = { multi: true, maxChoices: 2, options };

  it("يرفض الفراغ والخيارات المجهولة", () => {
    expect(validatePollChoices(single, []).ok).toBe(false);
    expect(validatePollChoices(single, ["ghost"]).ok).toBe(false);
  });

  it("الفردي يقبل خياراً واحداً فقط والجماعي يقيّد العدد", () => {
    expect(validatePollChoices(single, ["o1"]).ok).toBe(true);
    expect(validatePollChoices(single, ["o1", "o2"]).ok).toBe(false);
    expect(validatePollChoices(multi, ["o1", "o2"]).ok).toBe(true);
    expect(validatePollChoices(multi, ["o1", "o2", "o3"]).ok).toBe(false);
  });

  it("ينظّف التكرار ويهمل المجهول بلا كسر", () => {
    const res = validatePollChoices(multi, ["o1", "o1", "ghost", "o2"]);
    expect(res.ok).toBe(true);
    expect(res.choices).toEqual(["o1", "o2"]);
  });
});

describe("تطبيق الصوت بفرق التغيير", () => {
  it("الصوت الجديد يزيد خياره وحده", () => {
    const res = applyPollVote(options, [], ["o1"]);
    expect(res.options.map((o) => o.votes)).toEqual([4, 1, 0]);
    expect(res.totalVotes).toBe(5);
    expect(res.isNewVote).toBe(true);
  });

  it("تغيير الرأي ينقل الصوت ولا يضاعفه", () => {
    const res = applyPollVote(options, ["o1"], ["o2"]);
    expect(res.options.map((o) => o.votes)).toEqual([2, 2, 0]);
    expect(res.totalVotes).toBe(4);
    expect(res.isNewVote).toBe(false);
  });

  it("إعادة التصويت بنفس الخيار لا تغيّر شيئاً", () => {
    const res = applyPollVote(options, ["o1"], ["o1"]);
    expect(res.options.map((o) => o.votes)).toEqual([3, 1, 0]);
    expect(res.totalVotes).toBe(4);
  });

  it("التصويت المتعدد يضيف ويحذف بدقة", () => {
    const added = applyPollVote(options, ["o1"], ["o1", "o3"]);
    expect(added.options.map((o) => o.votes)).toEqual([3, 1, 1]);
    const removed = applyPollVote(added.options, ["o1", "o3"], ["o1"]);
    expect(removed.options.map((o) => o.votes)).toEqual([3, 1, 0]);
  });

  it("لا يُنزل العدّاد تحت الصفر أبداً", () => {
    const res = applyPollVote(options, ["o3"], ["o1"]);
    expect(res.options.find((o) => o.id === "o3")?.votes).toBe(0);
    expect(res.totalVotes).toBeGreaterThanOrEqual(0);
  });
});
