/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 نواة العقول المشتركة — منطق نقي بلا أي اعتماديات
 *
 * هذه اللبنة هي «العقد» بين ثلاثة عوالم:
 *   • المحرك المحلي (العقل المتطور الذي يبنيه اللعب)
 *   • خادم Convex (سجل العقول الحي + لوحة الصدارة)
 *   • غرفة المالك (نبضة العقول + أدوات المنح الحقيقية)
 *
 * سبب وجودها: نفس القواعد (الرتب، التقييد، البصمة، دمج المنح، النبضة)
 * تُستخدم في الخادم والواجهة معاً — فلا تتباعد النسخ ولا تكذب الأرقام.
 * بلا أي import ⇒ تُختبر وحدها ويمكن استيرادها من أي مكان.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ القوى العقلية الست — المفاتيح المشتركة
// ═══════════════════════════════════════════════════════════════════════

export type FacultyKey = "logic" | "knowledge" | "speed" | "memory" | "focus" | "intuition";

export const FACULTY_KEYS: FacultyKey[] = [
  "logic",
  "knowledge",
  "speed",
  "memory",
  "focus",
  "intuition",
];

export const FACULTY_META: Record<FacultyKey, { name: string; icon: string; feeds: string }> = {
  logic: { name: "المنطق", icon: "🧩", feeds: "خبرة أكثر من كل مستوى" },
  knowledge: { name: "المعرفة", icon: "📚", feeds: "عملات أكثر من كل مستوى" },
  speed: { name: "السرعة", icon: "⚡", feeds: "ثوانٍ إضافية على عدّاد السؤال" },
  memory: { name: "الذاكرة", icon: "🗂️", feeds: "تخفيض دقة الخصم" },
  focus: { name: "التركيز", icon: "🎯", feeds: "دروع تحمي سلسلتك من الانكسار" },
  intuition: { name: "الحدس", icon: "🔮", feeds: "خبرة وعملات في المجالات الجديدة" },
};

/** أقصى رصيد خبرة لكل قوة (يُقبل من العميل) — 4250 هو عتبة المستوى ١٢ */
export const FACULTY_XP_CAP = 6000;

/**
 * عتبات XP لكل مستوى (الفهرس 0 = المستوى 1) — أقصى مستوى 12.
 * هذه هي نفس الأرقام التي يعمل بها المحرك المحلي (مصدر حقيقة واحد).
 */
export const FACULTY_THRESHOLDS = [0, 45, 120, 240, 410, 650, 970, 1380, 1900, 2540, 3320, 4250];

/** مستوى القوة من رصيد خبرتها. */
export function facultyLevelFromXp(xp: number): number {
  const v = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let level = 1;
  for (let i = 0; i < FACULTY_THRESHOLDS.length; i += 1) if (v >= FACULTY_THRESHOLDS[i]) level = i + 1;
  return level;
}

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ سلّم رتب العقول — ترتيب واحد يفهمه الخادم والواجهة والمالك
// ═══════════════════════════════════════════════════════════════════════

export interface MindRank {
  /** رقم الرتبة 1..8 */
  level: number;
  /** أقل مجموع مستويات يفتح الرتبة */
  min: number;
  name: string;
  icon: string;
  tone: string;
}

/**
 * مجموع القوى = مجموع **المستويات المكتسبة** فوق المستوى الأول لكل قوة.
 * لاعب جديد = 0 (لا يبدأ في منتصف السلّم)، والقمة = 6 × 11 = 66
 * (أي بلوغ المستوى ١٢ في كل القوى الست).
 */
export const MAX_TIER_SCORE = FACULTY_KEYS.length * (FACULTY_THRESHOLDS.length - 1);

/** عتبات سلّم الرتب — كل عتبة مضمونة الوصول داخل سقف 66. */
export const MIND_RANKS: MindRank[] = [
  { level: 1, min: 0, name: "عقل ناشئ", icon: "🌱", tone: "slate" },
  { level: 2, min: 6, name: "مفكّر صاعد", icon: "🧠", tone: "sky" },
  { level: 3, min: 13, name: "محلّل", icon: "🧩", tone: "teal" },
  { level: 4, min: 22, name: "استراتيجي", icon: "♟️", tone: "indigo" },
  { level: 5, min: 32, name: "عبقري", icon: "💡", tone: "violet" },
  { level: 6, min: 43, name: "حكيم العقول", icon: "🦉", tone: "amber" },
  { level: 7, min: 54, name: "سيّد الحكمة", icon: "👑", tone: "yellow" },
  { level: 8, min: 64, name: "أسطورة العقول", icon: "🌟", tone: "rose" },
];

/** رتبة مجموع معيّن — الأعلى الذي تحققه. */
export function rankForTier(tierScore: number): MindRank {
  const score = Number.isFinite(tierScore) ? Math.max(0, tierScore) : 0;
  let out = MIND_RANKS[0];
  for (const r of MIND_RANKS) if (score >= r.min) out = r;
  return out;
}

/** الرتبة التالية والمسافة المتبقية إليها (null عند القمة). */
export function nextRank(tierScore: number): { rank: MindRank; remaining: number } | null {
  const score = Number.isFinite(tierScore) ? tierScore : 0;
  const up = MIND_RANKS.find((r) => r.min > score);
  if (!up) return null;
  return { rank: up, remaining: Math.max(0, up.min - score) };
}

/** تقدّم داخل الرتبة الحالية (0..1) — لعرض شريط التقدّم بصدق. */
export function rankProgress(tierScore: number): number {
  const score = Math.max(0, Math.min(MAX_TIER_SCORE, Number.isFinite(tierScore) ? tierScore : 0));
  const cur = rankForTier(score);
  const up = MIND_RANKS.find((r) => r.min > score);
  if (!up) return 1;
  const span = up.min - cur.min;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (score - cur.min) / span));
}

/** فهرس الرتبة (1..8) — يُخزَّن في السجل لترتيب سريع. */
export function rankLevelFor(tierScore: number): number {
  return rankForTier(tierScore).level;
}

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ لقطة العقل — ما يُخزَّن ويُقارَن (مقيّدة دائماً، لا ثقة بالعميل)
// ═══════════════════════════════════════════════════════════════════════

export interface MasteryEntry {
  category: string;
  score: number;
  tier: number;
}

export interface MindSnapshot {
  name: string;
  avatar: string | null;
  tierScore: number;
  rankLevel: number;
  identityTitle: string;
  identityIcon: string;
  faculties: Record<FacultyKey, number>;
  equipped: string[];
  unlocked: string[];
  mastery: MasteryEntry[];
  sessions: number;
}

/** أقصى ما يُخزَّن من تفاصيل (يحمي حجم المستند واستهلاك القراءة). */
export const MAX_EQUIPPED_SAVED = 8;
export const MAX_UNLOCKED_SAVED = 24;
export const MAX_MASTERY_SAVED = 8;
export const MAX_SESSIONS_SAVED = 100_000;

/** تنظيف النصوص: يتجاهل حروف التحكم (لا يسمح بتلويث السجل) ويحد الطول. */
const cleanText = (s: unknown, max: number, fallback: string): string => {
  if (typeof s !== "string") return fallback;
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  out = out.trim();
  return out.length === 0 ? fallback : out.slice(0, max);
};

const clampNum = (n: unknown, min: number, max: number, fallback = 0): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
};

/** ينظّف أي لقطة قادمة من العميل — كل رقم وكل نص مقيّد بحدّه. */
export function clampSnapshot(raw: unknown): MindSnapshot {
  const r = (raw ?? {}) as Partial<MindSnapshot>;
  const srcFaculty = (r.faculties ?? {}) as Record<string, unknown>;
  const faculties = {} as Record<FacultyKey, number>;
  for (const k of FACULTY_KEYS) {
    faculties[k] = clampNum(srcFaculty[k], 0, FACULTY_XP_CAP);
  }

  const tierScore = computeTierFromXp(faculties);

  const equipped = dedupeStrings(r.equipped, MAX_EQUIPPED_SAVED);
  const unlocked = dedupeStrings(r.unlocked, MAX_UNLOCKED_SAVED);

  const mastery: MasteryEntry[] = [];
  const rawMastery = Array.isArray(r.mastery) ? r.mastery : [];
  for (const m of rawMastery) {
    if (!m || typeof m !== "object") continue;
    const cat = cleanText((m as MasteryEntry).category, 48, "");
    if (!cat) continue;
    mastery.push({
      category: cat,
      score: clampNum((m as MasteryEntry).score, 0, 100),
      tier: clampNum((m as MasteryEntry).tier, 0, 4),
    });
    if (mastery.length >= MAX_MASTERY_SAVED) break;
  }

  return {
    name: cleanText(r.name, 40, "لاعب"),
    avatar: typeof r.avatar === "string" && r.avatar.trim() ? r.avatar.trim().slice(0, 8) : null,
    tierScore,
    rankLevel: rankLevelFor(tierScore),
    identityTitle: cleanText(r.identityTitle, 32, "عقل ناشئ"),
    identityIcon: cleanText(r.identityIcon, 8, "🌱"),
    faculties,
    equipped,
    unlocked,
    mastery,
    sessions: clampNum(r.sessions, 0, MAX_SESSIONS_SAVED),
  };
}

function dedupeStrings(list: unknown, max: number): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, 40);
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * مجموع القوى (المستويات المكتسبة) — يُحسب **دائماً** من أرصدة الخبرة على
 * الخادم، فلا يمكن للعميل أن ينفخ ترتيبه برقم مرسل. المستوى الأول لا يُحتسب
 * (كي يبدأ اللاعب الجديد من صفر لا من منتصف السلّم).
 */
export function computeTierFromXp(faculties: Record<FacultyKey, number>): number {
  let total = 0;
  for (const k of FACULTY_KEYS) total += Math.max(0, facultyLevelFromXp(faculties[k] ?? 0) - 1);
  return total;
}

/** أقوى قوة في اللقطة — تُستخدم للعرض والتحليل. */
export function dominantFaculty(
  faculties: Record<FacultyKey, number>,
): { key: FacultyKey; name: string; icon: string } {
  let best: FacultyKey = "logic";
  let bestXp = -1;
  for (const k of FACULTY_KEYS) {
    const xp = faculties[k] ?? 0;
    if (xp > bestXp) {
      bestXp = xp;
      best = k;
    }
  }
  const meta = FACULTY_META[best];
  return { key: best, name: meta.name, icon: meta.icon };
}

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ بصمة العقل — تمنع الكتابة الزائدة على الخادم (حماية حصة حقيقية)
// ═══════════════════════════════════════════════════════════════════════

/**
 * بصمة مستقرة: إن لم تتغيّر، فمزامنة الخادم بلا فائدة ⇒ نتخطاها.
 * تُبنى من الحقائق التي تُهمّ الترتيب فقط (لا وقت ولا جولات عابرة).
 */
export function snapshotSignature(s: {
  tierScore: number;
  sessions: number;
  faculties: Record<FacultyKey, number>;
  equipped: string[];
  unlocked: string[];
  mastery: MasteryEntry[];
}): string {
  const xp = FACULTY_KEYS.map((k) => Math.round(s.faculties[k] ?? 0)).join(".");
  const eq = [...s.equipped].sort().join(",");
  const mastery = s.mastery
    .map((m) => `${m.category}:${Math.round(m.score)}`)
    .sort()
    .join(",");
  return `${s.tierScore}|${s.sessions}|${xp}|${eq}|${s.unlocked.length}|${mastery}`;
}

/** هل تستحق اللقطة أن تُرفع إلى الخادم؟ */
export function shouldSyncMind(lastSignature: string | null, next: string): boolean {
  return !lastSignature || lastSignature !== next;
}

// ═══════════════════════════════════════════════════════════════════════
// 5️⃣ منح المالك — القوة الحقيقية تصبح تغييراً حقيقياً في عقل اللاعب
// ═══════════════════════════════════════════════════════════════════════

/** نوع قرار العرش: منحة خبرة، أو تصفير كامل لعقل اللاعب. */
export type GrantKind = "xp" | "reset";

export interface MindGrant {
  id: string;
  kind: string; // GrantKind
  faculty: string; // FacultyKey أو "all"
  amount: number;
  reason: string;
  actorName: string;
  at: number;
}

export interface GrantApplication {
  id: string;
  kind: GrantKind;
  faculty: FacultyKey | "all";
  amount: number;
  reason: string;
  actorName: string;
  at: number;
}

export interface MergeGrantsResult {
  /** المنح التي يجب تطبيقها على المحرك المحلي الآن */
  applications: GrantApplication[];
  /** أرصدة القوى بعد الإضافة */
  faculties: Record<FacultyKey, number>;
  /** بصمات المنح المُستهلكة (تُحفظ محلياً فلا تُطبَّق مرتين) */
  applied: string[];
  /** قرار تصفير صادر من العرش — ينفّذه المحرك المحلي عند أول مزامنة */
  resetRequested: boolean;
}

export const MAX_GRANT_AMOUNT = 3000;

/**
 * يدمج منح المالك غير المُطبَّقة بعد على أرصدة اللاعب.
 * كل منحة تُطبَّق **مرة واحدة** بالضبط (بصمتها المحفوظة محلياً).
 */
export function mergeGrants(
  faculties: Record<FacultyKey, number>,
  grants: readonly MindGrant[],
  applied: readonly string[],
): MergeGrantsResult {
  const seen = new Set(applied);
  const next: Record<FacultyKey, number> = { ...faculties };
  const applications: GrantApplication[] = [];
  const consumed = [...applied];
  let resetRequested = false;

  for (const g of grants) {
    if (!g || typeof g.id !== "string" || seen.has(g.id)) continue;
    const amount = clampNum(g.amount, -MAX_GRANT_AMOUNT, MAX_GRANT_AMOUNT);
    const kind: GrantKind = g.kind === "reset" ? "reset" : "xp";
    const target: FacultyKey | "all" =
      g.faculty === "all" ? "all" : (FACULTY_KEYS as string[]).includes(g.faculty)
        ? (g.faculty as FacultyKey)
        : "logic";

    if (kind === "reset") {
      resetRequested = true;
      for (const k of FACULTY_KEYS) next[k] = 0;
    } else if (amount !== 0) {
      if (target === "all") {
        for (const k of FACULTY_KEYS) next[k] = clampFacultyXp((next[k] ?? 0) + amount);
      } else {
        next[target] = clampFacultyXp((next[target] ?? 0) + amount);
      }
    }

    seen.add(g.id);
    consumed.push(g.id);
    applications.push({
      id: g.id,
      kind,
      faculty: target,
      amount,
      reason: cleanText(g.reason, 120, "منحة من العرش"),
      actorName: cleanText(g.actorName, 40, "الحاكم"),
      at: clampNum(g.at, 0, Number.MAX_SAFE_INTEGER),
    });
  }

  return { applications, faculties: next, applied: consumed, resetRequested };
}

export function clampFacultyXp(xp: number): number {
  return Math.max(0, Math.min(FACULTY_XP_CAP, Math.round(xp)));
}

// ═══════════════════════════════════════════════════════════════════════
// 6️⃣ نبضة العقول — صورة المالك الحيّة عن كل العقول في اللعبة
// ═══════════════════════════════════════════════════════════════════════

export interface MindPulseRow {
  tierScore: number;
  rankLevel: number;
  faculties: Record<FacultyKey, number>;
  updatedAt: number;
  frozen?: boolean | undefined;
  synced24h?: boolean | undefined;
}

export interface MindPulse {
  total: number;
  active24h: number;
  frozen: number;
  avgTier: number;
  topTier: number;
  /** توزيع اللاعبين على رتب العقول */
  rankBuckets: { level: number; name: string; icon: string; tone: string; count: number }[];
  /** أي قوة يتصدّرها أكبر عدد من اللاعبين — يكشف هوية مجتمعك الذهنية */
  facultyLeaders: { key: FacultyKey; name: string; icon: string; count: number }[];
  /** القوة المهيمنة على المجتمع كله */
  dominantFaculty: { key: FacultyKey; name: string; icon: string } | null;
  empty: boolean;
}

export function computeMindPulse(rows: readonly MindPulseRow[]): MindPulse {
  const buckets = MIND_RANKS.map((r) => ({ ...r, count: 0 }));
  const leaders = FACULTY_KEYS.map((k) => ({
    key: k,
    name: FACULTY_META[k].name,
    icon: FACULTY_META[k].icon,
    count: 0,
  }));

  if (rows.length === 0) {
    return {
      total: 0,
      active24h: 0,
      frozen: 0,
      avgTier: 0,
      topTier: 0,
      rankBuckets: buckets.map(({ level, name, icon, tone, count }) => ({ level, name, icon, tone, count })),
      facultyLeaders: leaders,
      dominantFaculty: null,
      empty: true,
    };
  }

  let sum = 0;
  let top = 0;
  let active = 0;
  let frozen = 0;
  const xpTotals = {} as Record<FacultyKey, number>;
  for (const k of FACULTY_KEYS) xpTotals[k] = 0;

  for (const row of rows) {
    const tier = Math.max(0, Math.min(MAX_TIER_SCORE, row.tierScore ?? 0));
    sum += tier;
    if (tier > top) top = tier;
    if (row.frozen) frozen += 1;
    if (row.synced24h) active += 1;

    const bucket = buckets.find((b) => b.level === rankLevelFor(tier));
    if (bucket) bucket.count += 1;

    let bestKey: FacultyKey = "logic";
    let bestXp = -1;
    for (const k of FACULTY_KEYS) {
      const xp = row.faculties?.[k] ?? 0;
      xpTotals[k] += xp;
      if (xp > bestXp) {
        bestXp = xp;
        bestKey = k;
      }
    }
    const lead = leaders.find((l) => l.key === bestKey);
    if (lead) lead.count += 1;
  }

  let dominant: FacultyKey | null = null;
  let dominantXp = -1;
  for (const k of FACULTY_KEYS) {
    if (xpTotals[k] > dominantXp) {
      dominantXp = xpTotals[k];
      dominant = k;
    }
  }

  return {
    total: rows.length,
    active24h: active,
    frozen,
    avgTier: Math.round((sum / rows.length) * 10) / 10,
    topTier: top,
    rankBuckets: buckets.map(({ level, name, icon, tone, count }) => ({ level, name, icon, tone, count })),
    facultyLeaders: leaders,
    dominantFaculty:
      dominant && dominantXp > 0
        ? { key: dominant, name: FACULTY_META[dominant].name, icon: FACULTY_META[dominant].icon }
        : null,
    empty: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 7️⃣ ترتيب اللاعب — موقعه الحقيقي بين العقول
// ═══════════════════════════════════════════════════════════════════════

export interface RankPosition {
  rank: number;
  total: number;
  /** عدد من هم أقوى منه (سقف الاستعلام) */
  ahead: number;
  /** أعلى من رتبتك إن وُجد */
  ceilingReached: boolean;
}

/**
 * يبني موقع اللاعب من قائمة مرتبة تنازلياً (استعلام مقيّد بـ take).
 * `ceilingReached` يعني أن القائمة وصلت سقفها ⇒ الرتبة حدّ أدنى لا نهائي.
 */
export function rankPosition(
  myTierScore: number,
  orderedAhead: readonly number[],
  total: number,
  ceiling: number,
): RankPosition {
  const ahead = orderedAhead.filter((s) => s > myTierScore).length;
  const ceilingReached = orderedAhead.length >= ceiling && orderedAhead.every((s) => s > myTierScore);
  return {
    rank: ahead + 1,
    total,
    ahead,
    ceilingReached,
  };
}

/** وصف مختصر لموقع اللاعب — جملة واحدة يفهمها اللاعب فوراً. */
export function describePosition(p: RankPosition): string {
  if (p.total <= 1) return "أنت أول عقل في هذا السجل — العرش فارغ بانتظار منافس";
  const rank = p.rank;
  if (rank === 1) return `أنت في القمة بين ${p.total} عقلاً 🥇`;
  const pct = Math.max(1, Math.round(((p.total - rank) / Math.max(1, p.total - 1)) * 100));
  return `ترتيبك ${rank} من ${p.total} — تسبق ${pct}% من العقول`;
}
