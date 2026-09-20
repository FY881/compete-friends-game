/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 v10.0 — نواة ملتقى العقول (منطق نقي بلا اعتماديات)
 *
 * العقد الواحد بين: خادم الملتقى، وواجهة اللاعب، ولوحة المالك، والاختبارات.
 * يحكم: الأقسام · أنواع المنشورات · الترتيب الذكي · الجودة والإبراز التلقائي ·
 *        صلاحيات الإشراف · حدود النشر · البحث والوسوم · نبضة الملتقى.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────
// ① الأقسام الافتراضية
// ───────────────────────────────────────────────────────────────────────
export interface SectionSpec {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  order: number;
  minTierRank: number;
  allowPosts: boolean;
  allowPolls: boolean;
  allowComments: boolean;
  /** الأنواع المسموح نشرها في القسم */
  kinds: PostKindId[];
}

export type PostKindId =
  | "discussion"
  | "question"
  | "idea"
  | "challenge"
  | "poll"
  | "announcement"
  | "room";

export const DEFAULT_SECTIONS: readonly SectionSpec[] = [
  {
    slug: "general", name: "نقاشات عامة", emoji: "💬",
    description: "الحوار المفتوح حول اللعبة والمجتمع — بلا قيود إلا القوانين",
    order: 1, minTierRank: 0, allowPosts: true, allowPolls: true, allowComments: true,
    kinds: ["discussion", "poll"],
  },
  {
    slug: "challenges", name: "تحديات جماعية", emoji: "⚔️",
    description: "أطلق تحدياً مفتوحاً للجميع أو انضم لتحدٍّ قائم — بمكافآت معلنة",
    order: 2, minTierRank: 0, allowPosts: true, allowPolls: false, allowComments: true,
    kinds: ["challenge", "discussion"],
  },
  {
    slug: "questions", name: "استفسارات", emoji: "❓",
    description: "اسأل وستجد جواباً — وأفضل جواب يُوسم ويُثبَّت",
    order: 3, minTierRank: 0, allowPosts: true, allowPolls: false, allowComments: true,
    kinds: ["question"],
  },
  {
    slug: "ideas", name: "أفكار وتطوير", emoji: "🧩",
    description: "اقتراحات تطوير اللعبة — تُقرأ وتُصوَّت، والأقوى يصل للمالك",
    order: 4, minTierRank: 0, allowPosts: true, allowPolls: true, allowComments: true,
    kinds: ["idea", "poll", "discussion"],
  },
  {
    slug: "rooms", name: "غرف مميزة", emoji: "🏛️",
    description: "غرف خاصة يعرضها أصحابها هنا — انضم إليها بدعوة مباشرة",
    order: 5, minTierRank: 0, allowPosts: true, allowPolls: false, allowComments: true,
    kinds: ["room"],
  },
  {
    slug: "events", name: "أحداث ومواسم", emoji: "🗓️",
    description: "إعلانات الأحداث والبطولات والمواسم — من الإدارة والمجتمع",
    order: 6, minTierRank: 0, allowPosts: true, allowPolls: true, allowComments: true,
    kinds: ["announcement", "discussion", "poll"],
  },
  {
    slug: "council", name: "قاعة العقول", emoji: "🏛️",
    description: "أطروحات ونقاشات عميقة: منطق، فلسفة، علوم — لمن يرتقي بمستوى الحوار",
    order: 7, minTierRank: 2, allowPosts: true, allowPolls: true, allowComments: true,
    kinds: ["discussion", "idea", "question", "poll"],
  },
] as const;

export function sectionBySlug(slug: string): SectionSpec | undefined {
  return DEFAULT_SECTIONS.find((s) => s.slug === slug);
}

// ───────────────────────────────────────────────────────────────────────
// ② أنواع المنشورات
// ───────────────────────────────────────────────────────────────────────
export interface PostKindSpec {
  id: PostKindId;
  label: string;
  emoji: string;
  titleMax: number;
  bodyMax: number;
  bodyMin: number;
  needsPoll: boolean;
  needsChallenge: boolean;
  /** هل يُقبل «أفضل جواب» في هذا النوع؟ */
  answerable: boolean;
  minTierRank: number;
  tone: string;
}

export const POST_KINDS: readonly PostKindSpec[] = [
  {
    id: "discussion", label: "نقاش", emoji: "💬", titleMax: 120, bodyMax: 4000, bodyMin: 20,
    needsPoll: false, needsChallenge: false, answerable: false, minTierRank: 0, tone: "sky",
  },
  {
    id: "question", label: "استفسار", emoji: "❓", titleMax: 120, bodyMax: 2000, bodyMin: 15,
    needsPoll: false, needsChallenge: false, answerable: true, minTierRank: 0, tone: "violet",
  },
  {
    id: "idea", label: "اقتراح", emoji: "🧩", titleMax: 120, bodyMax: 3000, bodyMin: 25,
    needsPoll: false, needsChallenge: false, answerable: false, minTierRank: 0, tone: "amber",
  },
  {
    id: "challenge", label: "تحدٍّ جماعي", emoji: "⚔️", titleMax: 120, bodyMax: 2000, bodyMin: 15,
    needsPoll: false, needsChallenge: true, answerable: false, minTierRank: 0, tone: "rose",
  },
  {
    id: "poll", label: "استطلاع", emoji: "📊", titleMax: 120, bodyMax: 1500, bodyMin: 10,
    needsPoll: true, needsChallenge: false, answerable: false, minTierRank: 0, tone: "emerald",
  },
  {
    id: "announcement", label: "إعلان", emoji: "📣", titleMax: 120, bodyMax: 3000, bodyMin: 15,
    needsPoll: false, needsChallenge: false, answerable: false, minTierRank: 3, tone: "primary",
  },
  {
    id: "room", label: "عرض غرفة", emoji: "🏛️", titleMax: 90, bodyMax: 1200, bodyMin: 10,
    needsPoll: false, needsChallenge: false, answerable: false, minTierRank: 0, tone: "teal",
  },
] as const;

export function postKind(id: string): PostKindSpec {
  return POST_KINDS.find((k) => k.id === id) ?? POST_KINDS[0];
}

// ───────────────────────────────────────────────────────────────────────
// ③ حدود النشر والإشراف
// ───────────────────────────────────────────────────────────────────────
export interface ForumLimits {
  minPostLength: number;
  maxPostsPerHour: number;
  autoHighlightScore: number;
  allowPosts: boolean;
  allowComments: boolean;
  allowPolls: boolean;
}

export const DEFAULT_LIMITS: ForumLimits = {
  minPostLength: 15,
  maxPostsPerHour: 5,
  autoHighlightScore: 62,
  allowPosts: true,
  allowComments: true,
  allowPolls: true,
};

export function withinHourlyLimit(postsLastHour: number, limit: number): boolean {
  return postsLastHour < Math.max(1, limit);
}

export interface ModProfile {
  userId: string;
  sections: string[];
  canPin: boolean;
  canLock: boolean;
  canHide: boolean;
}

export function moderatorFor(
  mods: readonly ModProfile[],
  userId: string | null,
  sectionSlug: string,
): ModProfile | null {
  if (!userId) return null;
  const mod = mods.find((m) => m.userId === userId);
  if (!mod) return null;
  if (mod.sections.includes("*") || mod.sections.includes(sectionSlug)) return mod;
  return null;
}

// ───────────────────────────────────────────────────────────────────────
// ④ تنقية وتحقق المنشور
// ───────────────────────────────────────────────────────────────────────
export function cleanText(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanBody(raw: string, max: number): string {
  return raw.replace(/\r/g, "").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, max);
}

export function normalizeTags(raw: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const t of raw ?? []) {
    const tag = cleanText(String(t).replace(/^#/, ""), 20);
    if (tag.length < 2) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= 5) break;
  }
  return out;
}

export interface PostInput {
  kind: string;
  title: string;
  body: string;
  tags?: string[];
  pollOptions?: string[];
  pollMulti?: boolean;
  pollHours?: number;
  challengeDifficulty?: string;
  challengeReward?: number;
  challengeQuestions?: number;
  roomId?: string;
}

export interface ValidatedPost {
  ok: boolean;
  reason: string;
  kind: PostKindSpec;
  title: string;
  body: string;
  tags: string[];
  poll?: { options: { id: string; label: string; votes: number }[]; multi: boolean; endsAt: number };
  challenge?: { difficulty: string; reward: number; questionCount: number };
}

export function validatePost(input: PostInput, tierRank: number, now: number): ValidatedPost {
  const kind = postKind(input.kind);
  const title = cleanText(input.title, kind.titleMax);
  const body = cleanBody(input.body, kind.bodyMax);
  const empty: ValidatedPost = { ok: false, reason: "", kind, title, body, tags: [] };

  if (tierRank < kind.minTierRank) {
    return { ...empty, reason: `نوع «${kind.label}» يتطلب عضوية أعلى` };
  }
  if (title.length < 6) return { ...empty, reason: "العنوان قصير جداً — ٦ أحرف على الأقل" };
  if (body.length < Math.max(kind.bodyMin, DEFAULT_LIMITS.minPostLength)) {
    return { ...empty, reason: `النص قصير جداً — ${Math.max(kind.bodyMin, DEFAULT_LIMITS.minPostLength)} حرفاً على الأقل` };
  }
  const tags = normalizeTags(input.tags);

  if (kind.needsPoll) {
    const raw = (input.pollOptions ?? []).map((o) => cleanText(o, 60)).filter((o) => o.length > 0);
    const unique = [...new Set(raw)];
    if (unique.length < 2) return { ...empty, reason: "الاستطلاع يحتاج خيارين على الأقل" };
    if (unique.length > 6) return { ...empty, reason: "بحد أقصى ٦ خيارات للاستطلاع" };
    const hours = Math.max(1, Math.min(input.pollHours ?? 72, 24 * 14));
    return {
      ok: true,
      reason: "ok",
      kind,
      title,
      body,
      tags,
      poll: {
        options: unique.map((label, i) => ({ id: `o${i + 1}`, label, votes: 0 })),
        multi: Boolean(input.pollMulti),
        endsAt: now + hours * 60 * 60 * 1000,
      },
    };
  }

  if (kind.needsChallenge) {
    const difficulty = ["easy", "medium", "hard"].includes(input.challengeDifficulty ?? "")
      ? (input.challengeDifficulty as string)
      : "medium";
    const questionCount = Math.max(5, Math.min(input.challengeQuestions ?? 10, 40));
    const reward = Math.max(0, Math.min(input.challengeReward ?? 50, 500));
    return {
      ok: true, reason: "ok", kind, title, body, tags,
      challenge: { difficulty, reward, questionCount },
    };
  }

  return { ok: true, reason: "ok", kind, title, body, tags };
}

// ───────────────────────────────────────────────────────────────────────
// ⑤ الجودة والإبراز التلقائي
// ───────────────────────────────────────────────────────────────────────
export interface PostLike {
  upvotes: number;
  downvotes: number;
  commentCount: number;
  body: string;
  tags: string[];
  kind: string;
  createdAt: number;
  lastActivityAt: number;
  acceptedCommentId?: string | null;
  status?: string;
}

/** جودة المحتوى 0..100 — أساس الإبراز التلقائي وترتيب «الأكثر قيمة» */
export function qualityScore(post: PostLike): number {
  let score = 30;
  const net = post.upvotes - post.downvotes;
  score += Math.max(-15, Math.min(35, net * 4));
  score += Math.min(20, post.commentCount * 4);
  if (post.body.length >= 400) score += 8;
  else if (post.body.length >= 160) score += 4;
  if (post.tags.length > 0) score += Math.min(6, post.tags.length * 2);
  if (post.acceptedCommentId) score += 12;
  if (post.kind === "idea" && net >= 5) score += 6;
  if (post.kind === "question" && post.acceptedCommentId) score += 4;
  if (net < -3) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isHighlightWorthy(post: PostLike, threshold: number): boolean {
  if (post.status === "hidden") return false;
  return qualityScore(post) >= threshold;
}

// ───────────────────────────────────────────────────────────────────────
// ⑥ الترتيب الذكي
// ───────────────────────────────────────────────────────────────────────
export type ForumSortMode = "new" | "hot" | "top" | "unanswered" | "value";

export const FORUM_SORTS: readonly { id: ForumSortMode; label: string; note: string }[] = [
  { id: "new", label: "الأحدث", note: "آخر نشاط في الملتقى" },
  { id: "hot", label: "الأكثر تفاعلاً", note: "تصويتات وتعليقات مع تلاشٍ زمني" },
  { id: "top", label: "الأعلى تقييماً", note: "أعلى صافي تصويت" },
  { id: "value", label: "الأكثر قيمة", note: "جودة المحتوى وفائدته" },
  { id: "unanswered", label: "بلا إجابة", note: "استفسارات لم تُحلّ بعد" },
] as const;

export function hotScore(post: PostLike, now: number): number {
  const net = post.upvotes - post.downvotes;
  const engagement = net * 3 + post.commentCount * 5 + 1;
  const hours = Math.max(0.5, (now - post.lastActivityAt) / (60 * 60 * 1000));
  return engagement / Math.pow(hours + 2, 1.35);
}

export function rankPosts<T extends PostLike>(posts: T[], mode: ForumSortMode, now: number): T[] {
  const visible = posts.filter((p) => p.status !== "hidden");
  switch (mode) {
    case "hot":
      return [...visible].sort((a, b) => hotScore(b, now) - hotScore(a, now));
    case "top":
      return [...visible].sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    case "value":
      return [...visible].sort((a, b) => qualityScore(b) - qualityScore(a));
    case "unanswered":
      return [...visible]
        .filter((p) => p.kind === "question" && !p.acceptedCommentId)
        .sort((a, b) => b.createdAt - a.createdAt);
    case "new":
    default:
      return [...visible].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }
}

// ───────────────────────────────────────────────────────────────────────
// ⑦ البحث والوسوم
// ───────────────────────────────────────────────────────────────────────
export function matchSearch(
  post: { title: string; body: string; tags: string[]; authorName?: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return true;
  const hay = `${post.title} ${post.body} ${post.tags.join(" ")} ${post.authorName ?? ""}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function trendingTags(
  posts: readonly { tags: string[]; upvotes: number; commentCount: number; lastActivityAt: number }[],
  now: number,
  limit = 8,
): { tag: string; weight: number }[] {
  const weights = new Map<string, number>();
  for (const p of posts) {
    const recency = Math.max(0.2, 1 - (now - p.lastActivityAt) / (7 * 24 * 60 * 60 * 1000));
    const w = (1 + p.upvotes + p.commentCount) * recency;
    for (const tag of p.tags) weights.set(tag, (weights.get(tag) ?? 0) + w);
  }
  return [...weights.entries()]
    .map(([tag, weight]) => ({ tag, weight: Math.round(weight * 10) / 10 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

// ───────────────────────────────────────────────────────────────────────
// ⑧ سمعة الكاتب ورتبته داخل الملتقى
// ───────────────────────────────────────────────────────────────────────
export interface KarmaInput {
  posts: number;
  comments: number;
  upvotesReceived: number;
  acceptedAnswers: number;
}

export function karmaOf(input: KarmaInput): number {
  return (
    input.posts * 3 +
    input.comments * 2 +
    input.upvotesReceived * 5 +
    input.acceptedAnswers * 15
  );
}

export interface ForumRank {
  id: string;
  label: string;
  emoji: string;
  min: number;
  note: string;
}

export const FORUM_RANKS: readonly ForumRank[] = [
  { id: "reader", label: "قارئ", emoji: "👀", min: 0, note: "بدأ يقرأ ويتفاعل" },
  { id: "voice", label: "صوت نشط", emoji: "💬", min: 25, note: "يشارك بانتظام" },
  { id: "writer", label: "كاتب", emoji: "✍️", min: 90, note: "محتواه يُقرأ ويُقتبس" },
  { id: "thinker", label: "مفكّر", emoji: "🧠", min: 240, note: "نقاشاته تُغيّر رأي الآخرين" },
  { id: "beacon", label: "منارة الملتقى", emoji: "🏮", min: 600, note: "مرجع في أكثر من قسم" },
  { id: "pillar", label: "عقل مميز", emoji: "🌟", min: 1200, note: "أعلى تقدير في المجتمع" },
] as const;

export function rankFromKarma(karma: number): ForumRank {
  let current = FORUM_RANKS[0];
  for (const r of FORUM_RANKS) if (karma >= r.min) current = r;
  return current;
}

export function nextRank(karma: number): { next: ForumRank | null; remaining: number } {
  const idx = FORUM_RANKS.findIndex((r) => r.id === rankFromKarma(karma).id);
  const next = FORUM_RANKS[idx + 1] ?? null;
  return { next, remaining: next ? next.min - karma : 0 };
}

// ───────────────────────────────────────────────────────────────────────
// ⑨ نبضة الملتقى للمالك
// ───────────────────────────────────────────────────────────────────────
export interface ForumPulseInput {
  posts24h: number;
  comments24h: number;
  openReports: number;
  hidden24h: number;
  activeAuthors24h: number;
  unansweredQuestions: number;
}

export interface ForumPulse {
  score: number;
  verdict: string;
  tone: "emerald" | "amber" | "rose";
  reasons: string[];
}

export function forumPulse(input: ForumPulseInput): ForumPulse {
  let score = 55;
  const reasons: string[] = [];
  if (input.posts24h >= 15) {
    score += 25;
    reasons.push("حركة نشر قوية");
  } else if (input.posts24h >= 5) {
    score += 14;
    reasons.push("نشاط نشر صحي");
  } else if (input.posts24h === 0) {
    score -= 18;
    reasons.push("لا منشورات خلال ٢٤ ساعة");
  }
  if (input.comments24h >= 20) score += 12;
  else if (input.comments24h === 0 && input.posts24h > 0) {
    score -= 8;
    reasons.push("منشورات بلا تعليقات — تفاعل ضعيف");
  }
  if (input.activeAuthors24h >= 6) {
    score += 10;
    reasons.push("قاعدة كُتّاب متنوعة");
  } else if (input.activeAuthors24h <= 1 && input.posts24h > 0) {
    score -= 8;
    reasons.push("كاتب واحد يستحوذ على النشر");
  }
  if (input.openReports > 0) {
    score -= Math.min(25, input.openReports * 6);
    reasons.push(`${input.openReports} بلاغ مفتوح`);
  }
  if (input.hidden24h > 0) {
    score -= Math.min(15, input.hidden24h * 3);
    reasons.push(`${input.hidden24h} منشور مخفي خلال ٢٤ ساعة`);
  }
  if (input.unansweredQuestions > 5) {
    score -= 10;
    reasons.push(`${input.unansweredQuestions} استفساراً بلا إجابة`);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tone: ForumPulse["tone"] = score >= 75 ? "emerald" : score >= 50 ? "amber" : "rose";
  const verdict = score >= 85 ? "ملتقى مزدهر" : score >= 75 ? "نشِط" : score >= 50 ? "يحتاج تحريكاً" : "يحتاج تدخلاً";
  return { score, verdict, tone, reasons };
}

export const FORUM_MOD_ACTION_LABEL: Record<string, string> = {
  post_hidden: "إخفاء منشور",
  post_restored: "استعادة منشور",
  post_pinned: "تثبيت منشور",
  post_unpinned: "إلغاء تثبيت",
  post_locked: "إغلاق نقاش",
  post_unlocked: "فتح نقاش",
  post_moved: "نقل منشور لقسم آخر",
  post_deleted: "حذف منشور",
  comment_deleted: "حذف تعليق",
  section_created: "إنشاء قسم",
  section_updated: "تعديل قسم",
  section_locked: "قفل قسم",
  moderator_appointed: "تعيين مشرف",
  moderator_revoked: "عزل مشرف",
  limits_updated: "تحديث الحدود",
  highlight_set: "إبراز منشور",
  highlight_cleared: "إلغاء الإبراز",
};

export function modActionLabel(action: string): string {
  return FORUM_MOD_ACTION_LABEL[action] ?? action;
}
