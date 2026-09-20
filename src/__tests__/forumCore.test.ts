import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMITS,
  DEFAULT_SECTIONS,
  FORUM_RANKS,
  cleanBody,
  forumPulse,
  hotScore,
  isHighlightWorthy,
  karmaOf,
  matchSearch,
  moderatorFor,
  nextRank,
  postKind,
  qualityScore,
  rankFromKarma,
  rankPosts,
  sectionBySlug,
  trendingTags,
  validatePost,
  withinHourlyLimit,
  type PostLike,
} from "../convex/forumCore";

const now = Date.now();
const HOUR = 60 * 60 * 1000;

function post(over: Partial<PostLike>): PostLike {
  return {
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    body: "نص منشور عادي بطول معقول للاختبار",
    tags: [],
    kind: "discussion",
    createdAt: now,
    lastActivityAt: now,
    acceptedCommentId: null,
    status: "open",
    ...over,
  };
}

describe("الأقسام وأنواع المنشورات", () => {
  it("الأقسام معرّفة بمعرّفات فريدة وترتيب صاعد", () => {
    const slugs = DEFAULT_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const orders = DEFAULT_SECTIONS.map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(sectionBySlug("council")?.minTierRank).toBe(2);
    expect(sectionBySlug("غير-موجود")).toBeUndefined();
  });

  it("أنواع المنشورات تحدد متطلباتها فعلياً", () => {
    expect(postKind("poll").needsPoll).toBe(true);
    expect(postKind("challenge").needsChallenge).toBe(true);
    expect(postKind("question").answerable).toBe(true);
    expect(postKind("announcement").minTierRank).toBe(3);
    expect(postKind("نوع-غريب").id).toBe("discussion");
  });
});

describe("تحقق النشر", () => {
  it("يرفض العنوان القصير والنص القصير", () => {
    expect(validatePost({ kind: "discussion", title: "س", body: "نص طويل بما يكفي للتجاوز" }, 0, now).ok).toBe(false);
    const shortBody = validatePost({ kind: "discussion", title: "عنوان صالح للاختبار", body: "قصير" }, 0, now);
    expect(shortBody.ok).toBe(false);
    expect(shortBody.reason).toContain("قصير");
  });

  it("المنشور الصالح يُنظَّف ويُقبل مع وسوم", () => {
    const res = validatePost(
      { kind: "discussion", title: "  كيف  نطور  اللعبة؟  ", body: "نص كافٍ للاختبار هنا فعلاً", tags: ["#تطوير", "أفكار"] },
      0,
      now,
    );
    expect(res.ok).toBe(true);
    expect(res.title).toBe("كيف نطور اللعبة؟");
    expect(res.tags).toEqual(["تطوير", "أفكار"]);
  });

  it("الاستطلاع يحتاج خيارين على الأقل وبحد أقصى ستة", () => {
    const one = validatePost({ kind: "poll", title: "أفضل وضع لعب؟", body: "نص كافٍ للاستطلاع", pollOptions: ["خيار"] }, 0, now);
    expect(one.ok).toBe(false);
    const many = validatePost(
      { kind: "poll", title: "أفضل وضع لعب؟", body: "نص كافٍ للاستطلاع", pollOptions: ["1", "2", "3", "4", "5", "6", "7"] },
      0,
      now,
    );
    expect(many.ok).toBe(false);
    const good = validatePost(
      { kind: "poll", title: "أفضل وضع لعب؟", body: "نص كافٍ للاستطلاع", pollOptions: ["سرعة", "دقة", "منطق"], pollHours: 24 },
      0,
      now,
    );
    expect(good.ok).toBe(true);
    expect(good.poll?.options).toHaveLength(3);
    expect(good.poll?.endsAt).toBeGreaterThan(now);
    const dup = validatePost({ kind: "poll", title: "أفضل وضع؟", body: "نص كافٍ للاستطلاع", pollOptions: ["نفس", "نفس"] }, 0, now);
    expect(dup.ok).toBe(false);
  });

  it("التحدي يأخذ إعداداته الافتراضية ويحدّ المكافأة", () => {
    const res = validatePost(
      { kind: "challenge", title: "تحدي المنطق الأسبوعي", body: "انضم للتحدي واكسب", challengeReward: 9999, challengeQuestions: 200 },
      0,
      now,
    );
    expect(res.ok).toBe(true);
    expect(res.challenge).toEqual({ difficulty: "medium", reward: 500, questionCount: 40 });
  });

  it("الإعلان يحتاج رتبة عالية، والقسم يقبل أنواعه فقط (تحقق الرتبة)", () => {
    const low = validatePost({ kind: "announcement", title: "إعلان مهم جداً", body: "نص إعلان كافٍ للاختبار" }, 0, now);
    expect(low.ok).toBe(false);
    const high = validatePost({ kind: "announcement", title: "إعلان مهم جداً", body: "نص إعلان كافٍ للاختبار" }, 3, now);
    expect(high.ok).toBe(true);
  });
});

describe("الجودة والإبراز التلقائي", () => {
  it("التصويتات والتعليقات وطول النص ترفع الجودة", () => {
    const weak = qualityScore(post({ upvotes: 0 }));
    const strong = qualityScore(post({ upvotes: 12, commentCount: 6, body: "ا".repeat(500), tags: ["منطق", "علم"] }));
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
  });

  it("المحتوى السيئ يُخفَّض، والمنشور المخفي لا يُبرز", () => {
    const bad = qualityScore(post({ downvotes: 10 }));
    expect(bad).toBeLessThan(30);
    expect(isHighlightWorthy(post({ upvotes: 20, commentCount: 8 }), DEFAULT_LIMITS.autoHighlightScore)).toBe(true);
    expect(isHighlightWorthy(post({ upvotes: 20, status: "hidden" }), DEFAULT_LIMITS.autoHighlightScore)).toBe(false);
  });

  it("الإجابة المقبولة ترفع الجودة والقيمة", () => {
    const without = qualityScore(post({ upvotes: 4, commentCount: 3, kind: "question" }));
    const withAnswer = qualityScore(post({ upvotes: 4, commentCount: 3, kind: "question", acceptedCommentId: "c1" }));
    expect(withAnswer).toBeGreaterThan(without);
  });
});

describe("الترتيب الذكي", () => {
  const posts = [
    post({ upvotes: 30, commentCount: 2, lastActivityAt: now - 200 * HOUR, kind: "discussion" }),
    post({ upvotes: 2, commentCount: 20, lastActivityAt: now - HOUR, kind: "discussion" }),
    post({ upvotes: 10, commentCount: 5, lastActivityAt: now - 2 * HOUR, kind: "question", acceptedCommentId: null }),
    post({ upvotes: 1, commentCount: 0, lastActivityAt: now - 3 * HOUR, kind: "question", acceptedCommentId: "c9", status: "answered" }),
  ];

  it("الترتيب بالأحدث يعتمد آخر نشاط", () => {
    const ranked = rankPosts(posts, "new", now);
    expect(ranked[0].lastActivityAt).toBe(now - HOUR);
  });

  it("الترتيب بالأعلى يعتمد صافي التصويت", () => {
    expect(rankPosts(posts, "top", now)[0].upvotes).toBe(30);
  });

  it("الأكثر قيمة يعتمد الجودة لا الحداثة", () => {
    const ranked = rankPosts(posts, "value", now);
    expect(qualityScore(ranked[0])).toBeGreaterThanOrEqual(qualityScore(ranked[ranked.length - 1]));
  });

  it("بلا إجابة يعرض الاستفسارات غير المحلولة فقط وبلا مخفي", () => {
    const ranked = rankPosts([...posts, post({ kind: "question", acceptedCommentId: null, status: "hidden" })], "unanswered", now);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].acceptedCommentId).toBeNull();
  });

  it("المحتوى المخفي يُستبعد من كل الأنماط، والتلاشي الزمني يخفض السخونة", () => {
    const hidden = post({ upvotes: 999, status: "hidden" });
    expect(rankPosts([hidden], "hot", now)).toHaveLength(0);
    const fresh = hotScore(post({ upvotes: 5, lastActivityAt: now }), now);
    const stale = hotScore(post({ upvotes: 5, lastActivityAt: now - 48 * HOUR }), now);
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("البحث والوسوم والسمعة", () => {
  it("البحث متعدد الكلمات يشترط كل الكلمات", () => {
    const target = { title: "تطوير نظام الأسئلة", body: "أفكار لتحسين الجودة", tags: ["تطوير"] };
    expect(matchSearch(target, "تطوير الأسئلة")).toBe(true);
    expect(matchSearch(target, "تطوير الرياضيات")).toBe(false);
    expect(matchSearch(target, "")).toBe(true);
  });

  it("الوسوم الرائجة تُرجَّح بالتفاعل والحداثة", () => {
    const tags = trendingTags(
      [
        { tags: ["منطق"], upvotes: 20, commentCount: 10, lastActivityAt: now },
        { tags: ["فن"], upvotes: 0, commentCount: 0, lastActivityAt: now - 6 * 24 * HOUR },
      ],
      now,
    );
    expect(tags[0].tag).toBe("منطق");
    expect(tags[0].weight).toBeGreaterThan(tags[1].weight);
  });

  it("السمعة تتراكم من النشر والتعليق والتصويتات والإجابات", () => {
    const karma = karmaOf({ posts: 2, comments: 5, upvotesReceived: 10, acceptedAnswers: 1 });
    expect(karma).toBe(2 * 3 + 5 * 2 + 10 * 5 + 15);
    expect(rankFromKarma(0).id).toBe(FORUM_RANKS[0].id);
    expect(rankFromKarma(5000).id).toBe(FORUM_RANKS[FORUM_RANKS.length - 1].id);
    const { next, remaining } = nextRank(0);
    expect(next?.id).toBe(FORUM_RANKS[1].id);
    expect(remaining).toBe(FORUM_RANKS[1].min);
  });

  it("صلاحية الإشراف تشمل كل الأقسام أو أقساماً محددة فقط", () => {
    const mods = [{ userId: "m1", sections: ["*"], canPin: true, canLock: false, canHide: false }];
    const scoped = [{ userId: "m2", sections: ["ideas"], canPin: false, canLock: true, canHide: false }];
    expect(moderatorFor(mods, "m1", "general")?.canPin).toBe(true);
    expect(moderatorFor(mods, "m3", "general")).toBeNull();
    expect(moderatorFor(scoped, "m2", "ideas")?.canLock).toBe(true);
    expect(moderatorFor(scoped, "m2", "general")).toBeNull();
    expect(moderatorFor(scoped, null, "ideas")).toBeNull();
  });

  it("حد النشر في الساعة يُطبَّق", () => {
    expect(withinHourlyLimit(0, 5)).toBe(true);
    expect(withinHourlyLimit(4, 5)).toBe(true);
    expect(withinHourlyLimit(5, 5)).toBe(false);
    expect(withinHourlyLimit(99, 0)).toBe(false);
  });

  it("تنقية النص تحذف الأسطر الزائدة وتحدّ الطول", () => {
    expect(cleanBody("سطر\n\n\n\n\nسطر", 100)).toBe("سطر\n\n\nسطر");
    expect(cleanBody("ا".repeat(500), 50)).toHaveLength(50);
  });
});

describe("نبضة الملتقى للمالك", () => {
  it("ملتقى مزدهر يخرج بتقييم مرتفع", () => {
    const pulse = forumPulse({ posts24h: 20, comments24h: 40, openReports: 0, hidden24h: 0, activeAuthors24h: 10, unansweredQuestions: 1 });
    expect(pulse.score).toBeGreaterThanOrEqual(85);
    expect(pulse.tone).toBe("emerald");
  });

  it("ملتقى ميت أو مليء بالمخالفات يخرج بتحذير مع أسبابه", () => {
    const pulse = forumPulse({ posts24h: 0, comments24h: 0, openReports: 4, hidden24h: 5, activeAuthors24h: 0, unansweredQuestions: 9 });
    expect(pulse.score).toBeLessThan(50);
    expect(pulse.tone).toBe("rose");
    expect(pulse.reasons.join(" ")).toContain("بلاغ");
  });

  it("كاتب واحد يستحوذ على النشر يُرصد", () => {
    const pulse = forumPulse({ posts24h: 6, comments24h: 10, openReports: 0, hidden24h: 0, activeAuthors24h: 1, unansweredQuestions: 0 });
    expect(pulse.reasons.join(" ")).toContain("كاتب واحد");
  });
});
