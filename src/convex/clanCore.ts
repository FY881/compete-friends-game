/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ نواة العشائر الفكرية — منطق نقي بلا أي اعتماديات
 *
 * العشيرة في «حرب العقول» ليست دردشة: هي **قوة ذهنية جماعية** تُبنى من
 * عقول أعضائها الحقيقية (نظام القوى الست في نكسس العقول)، تعمل بأهداف
 * أسبوعية مشتركة، وتتقاسم مكافآتها **بعدل** بحسب مساهمة كل عضو فعلاً.
 *
 * هذه اللبنة هي مصدر الحقيقة الواحد للخادم وغرفة الملك والواجهة:
 *   • سلّم رتب العشائر (٨ رتب) ومزاياها الحقيقية
 *   • حساب القوة الذهنية من عقول الأعضاء
 *   • أهداف أسبوعية تتوسّع مع حجم العشيرة (عدل لا تحيّز للأكبر)
 *   • توزيع المكافأة (٣٠٪ بالتساوي + ٧٠٪ بحسب المساهمة) بلا هللة ضائعة
 *   • رقابة الدردشة: فيضان · تكرار · إزعاج · تطاول — بقرار مُفسَّر
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// 1️⃣ سلّم رتب العشائر
// ═══════════════════════════════════════════════════════════════════════

export interface ClanRank {
  level: number;
  min: number;
  name: string;
  icon: string;
  /** ميزة حقيقية تُطبَّق في الحسابات (لا زخرفة) */
  perk: string;
}

/**
 * القوة الذهنية = لكل عضو: (مجموع قواه × 10) + عمق تدريبه (حتى 60).
 * عضو مكتمل القوى (66) بعمق كامل ⇒ ٧٢٠. والعشيرة الكاملة (٢٠ عضواً) ⇒ ١٤٤٠٠.
 * فالسلّم مصمَّم ليُقطع على مدى أسابيع، لا في يوم.
 */
export const CLAN_RANKS: ClanRank[] = [
  { level: 1, min: 0, name: "تجمّع", icon: "🪨", perk: "لا مزايا بعد — ابنوا قوتكم الذهنية" },
  { level: 2, min: 400, name: "حلقة", icon: "🔗", perk: "+5% نقاط حرب لكل عضو" },
  { level: 3, min: 1000, name: "كتيبة", icon: "🛡️", perk: "+8% نقاط حرب" },
  { level: 4, min: 2000, name: "فرقة", icon: "⚔️", perk: "+12% نقاط حرب" },
  { level: 5, min: 3500, name: "فيلق", icon: "🏰", perk: "+16% نقاط حرب · خصم 5% على ترقيات الخزينة" },
  { level: 6, min: 5500, name: "مجلس العقول", icon: "🧠", perk: "+20% نقاط حرب · مكافآت أهداف أكبر" },
  { level: 7, min: 8000, name: "إمبراطورية", icon: "👑", perk: "+25% نقاط حرب · خصم 10% على الترقيات" },
  { level: 8, min: 11000, name: "أسطورة العقول", icon: "🌟", perk: "+30% نقاط حرب · مكانة دائمة في السجل" },
];

export const MAX_CLAN_POWER = 14_400;

/** أقصى قوة يساهم بها عضو واحد (مجموع القوى 66 + عمق التدريب). */
export const MAX_MEMBER_POWER = 720;

/** أقصى عمق تدريب يُحتسب للعضو — يمنع تضخّم القوة بجولات لا نهائية. */
export const MAX_DEPTH_BONUS = 60;

export function clanRankFor(power: number): ClanRank {
  const p = Number.isFinite(power) ? Math.max(0, power) : 0;
  let out = CLAN_RANKS[0];
  for (const r of CLAN_RANKS) if (p >= r.min) out = r;
  return out;
}

export function nextClanRank(power: number): { rank: ClanRank; remaining: number } | null {
  const p = Number.isFinite(power) ? Math.max(0, power) : 0;
  const up = CLAN_RANKS.find((r) => r.min > p);
  return up ? { rank: up, remaining: up.min - p } : null;
}

export function clanRankProgress(power: number): number {
  const p = Math.max(0, Math.min(MAX_CLAN_POWER, Number.isFinite(power) ? power : 0));
  const cur = clanRankFor(p);
  const up = CLAN_RANKS.find((r) => r.min > p);
  if (!up) return 1;
  const span = up.min - cur.min;
  return span <= 0 ? 1 : Math.max(0, Math.min(1, (p - cur.min) / span));
}

export interface ClanPerks {
  warPointsPct: number;
  goalRewardPct: number;
  treasuryDiscountPct: number;
}

/** مزايا الرتب بأرقام حقيقية تُضاف للحسابات (تُقرأ في clans/clanWars). */
export function clanPerks(level: number): ClanPerks {
  const lv = Math.max(1, Math.min(CLAN_RANKS.length, Math.round(level || 1)));
  return {
    warPointsPct: [0, 0, 5, 8, 12, 16, 20, 25, 30][lv] ?? 0,
    goalRewardPct: lv >= 6 ? 15 : lv >= 4 ? 8 : 0,
    treasuryDiscountPct: lv >= 7 ? 10 : lv >= 5 ? 5 : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 2️⃣ القوة الذهنية للعشيرة — من عقول أعضائها فعلاً
// ═══════════════════════════════════════════════════════════════════════

export interface ClanMemberMind {
  userId: string;
  name: string;
  tierScore: number;
  sessions: number;
}

export interface ClanMemberPower extends ClanMemberMind {
  /** قوة العضو = مجموع قواه ×10 + عمق تدريبه */
  power: number;
}

export interface ClanPowerReport {
  power: number;
  memberCount: number;
  avgTier: number;
  topTier: number;
  level: number;
  rank: ClanRank;
  perks: ClanPerks;
  members: ClanMemberPower[];
  /** أقوى عضو — يُعرض كحامل راية العشيرة */
  champion: ClanMemberPower | null;
  /** أعضاء بلا عقل مسجَّل بعد (يجب توجيههم للعب) */
  silentMembers: number;
}

/** قوة عضو واحد — قاعدة واحدة صريحة يفهمها اللاعب. */
export function memberPower(m: { tierScore: number; sessions: number }): number {
  const tier = Math.max(0, Math.min(100, Number.isFinite(m.tierScore) ? m.tierScore : 0));
  const depth = Math.min(MAX_DEPTH_BONUS, Math.max(0, Math.floor((m.sessions ?? 0) / 10) * 5));
  return Math.round(tier * 10 + depth);
}

/** تقرير قوة العشيرة كاملاً من عقول أعضائها. */
export function computeClanPower(members: readonly ClanMemberMind[]): ClanPowerReport {
  const rows: ClanMemberPower[] = members.map((m) => ({ ...m, power: memberPower(m) }));
  const power = rows.reduce((sum, r) => sum + r.power, 0);
  const level = clanRankFor(power).level;
  const sorted = [...rows].sort((a, b) => b.power - a.power);
  return {
    power,
    memberCount: rows.length,
    avgTier: rows.length ? Math.round((rows.reduce((s, r) => s + r.tierScore, 0) / rows.length) * 10) / 10 : 0,
    topTier: rows.reduce((max, r) => Math.max(max, r.tierScore), 0),
    level,
    rank: clanRankFor(power),
    perks: clanPerks(level),
    members: sorted,
    champion: sorted[0] ?? null,
    silentMembers: rows.filter((r) => r.sessions <= 0).length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 3️⃣ الأهداف الأسبوعية المشتركة — تتوسّع مع الحجم (عدل لا تحيّز)
// ═══════════════════════════════════════════════════════════════════════

export type ClanGoalId = "rounds" | "wins" | "perfect" | "points";

export interface ClanGoalDef {
  id: ClanGoalId;
  title: string;
  icon: string;
  unit: string;
  /** أقل هدف لعشيرة فردية */
  base: number;
  /** ما يُضاف لكل عضو إضافي (كي لا تظلم العشائر الصغيرة) */
  perMember: number;
  /** مكافأة الخزينة الأساسية (تُضاعف بمزايا الرتبة) */
  reward: number;
  description: string;
}

export const CLAN_GOALS: ClanGoalDef[] = [
  {
    id: "rounds",
    title: "النشاط الجماعي",
    icon: "🎯",
    unit: "جولة",
    base: 20,
    perMember: 4,
    reward: 300,
    description: "جولات يلعبها أعضاء العشيرة معاً هذا الأسبوع",
  },
  {
    id: "wins",
    title: "الانتصارات",
    icon: "🏆",
    unit: "فوز",
    base: 8,
    perMember: 2,
    reward: 500,
    description: "عدد الجولات التي خرج فيها العضو منتصراً",
  },
  {
    id: "perfect",
    title: "الدقة الكاملة",
    icon: "💎",
    unit: "جولة مثالية",
    base: 2,
    perMember: 1,
    reward: 800,
    description: "جولات بلا خطأ واحد — تُحتسب للجميع",
  },
  {
    id: "points",
    title: "حصاد نقاط الحرب",
    icon: "⚔️",
    unit: "نقطة",
    base: 150,
    perMember: 40,
    reward: 700,
    description: "مجموع نقاط الحرب التي جمعتها العشيرة هذا الأسبوع",
  },
];

/**
 * هدف الأسبوع = الأساس + (عدد الأعضاء − ١) × نصيب العضو.
 * هكذا لا تُنصف عشيرة كبيرة ولا تُعاقَب عشيرة صغيرة.
 */
export function goalTarget(def: ClanGoalDef, memberCount: number): number {
  const n = Math.max(1, Math.floor(memberCount || 1));
  return def.base + def.perMember * (n - 1);
}

/** مكافأة الهدف بعد مزايا الرتبة — رقم حقيقي يُصرف للخزينة. */
export function goalReward(def: ClanGoalDef, level: number): number {
  const pct = clanPerks(level).goalRewardPct;
  return Math.round(def.reward * (1 + pct / 100));
}

export function goalProgressPct(progress: number, target: number): number {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, (Number.isFinite(progress) ? progress : 0) / target));
}

// ═══════════════════════════════════════════════════════════════════════
// 4️⃣ التوزيع العادل — ٣٠٪ بالتساوي + ٧٠٪ بحسب المساهمة
// ═══════════════════════════════════════════════════════════════════════

export const FAIR_EQUAL_SHARE_PCT = 30;

/**
 * يوزّع مكافأة العشيرة على المساهمين:
 *   • ٣٠٪ بالتساوي لمن ساهم ولو مرة (المشاركة نفسها لها قيمة)
 *   • ٧٠٪ بالتناسب مع حجم المساهمة
 * والمجموع يساوي المكافأة بالضبط — لا هللة تضيع ولا تزيد.
 * أعضاء بمساهمة صفر يأخذون صفراً (لا مكافأة على الغياب).
 */
export function splitReward(total: number, contributions: readonly number[]): number[] {
  const n = contributions.length;
  if (n === 0) return [];
  const pot = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const sanitized = contributions.map((c) => Math.max(0, Number.isFinite(c) ? c : 0));
  const pool = sanitized.reduce((s, c) => s + c, 0);
  if (pool <= 0 || pot === 0) return sanitized.map(() => 0);

  const activeIdx = sanitized.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  const equalPart = (pot * FAIR_EQUAL_SHARE_PCT) / 100;
  const meritPart = pot - equalPart;
  const equalEach = equalPart / activeIdx.length;

  const exact = sanitized.map((c) => (c > 0 ? equalEach + (meritPart * c) / pool : 0));
  const floors = exact.map((v) => Math.floor(v));
  let remainder = pot - floors.reduce((s, v) => s + v, 0);

  // نوزّع الباقي على أصحاب أكبر كسور (الأعلى مساهمة عند التعادل)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v), merit: sanitized[i] }))
    .filter((o) => exact[o.i] > 0)
    .sort((a, b) => b.frac - a.frac || b.merit - a.merit || a.i - b.i);
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    floors[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }

  return floors;
}

/** ترتيب المساهمين بعدل — النقاط أولاً ثم الدقة. */
export interface ContributionRow {
  userId: string;
  name: string;
  rounds: number;
  wins: number;
  perfect: number;
  points: number;
}

export function sortContributors(rows: readonly ContributionRow[]): ContributionRow[] {
  return [...rows].sort((a, b) => b.points - a.points || b.wins - a.wins || b.rounds - a.rounds);
}

/** وزن المساهمة المستخدم في التوزيع = نقاط الحرب + وزن للجولات المثالية. */
export function contributionWeight(row: ContributionRow): number {
  return Math.max(0, row.points) + row.perfect * 15 + row.wins * 5;
}

/** ملخّص نصي عادل لكل عضو — يوضح لماذا أخذ هذه الحصة بالضبط. */
export function explainShare(row: ContributionRow, share: number, total: number): string {
  if (share <= 0) return "لا مساهمة هذا الأسبوع — المكافأة تُمنح للمشاركين فقط";
  const pct = total > 0 ? Math.round((share / total) * 100) : 0;
  return `${pct}% من المكافأة · ${row.rounds} جولة · ${row.wins} فوز · ${row.perfect} مثالية · ${row.points} نقطة حرب`;
}

// ═══════════════════════════════════════════════════════════════════════
// 5️⃣ رقابة الدردشة الذكية — قرار مُفسَّر لا حجب أعمى
// ═══════════════════════════════════════════════════════════════════════

export type ModVerdict = "ok" | "warn" | "mute" | "flag";

export interface ModDecision {
  verdict: ModVerdict;
  score: number;
  reasons: string[];
  /** نص عربي صريح يُعرض للاعب */
  message: string;
}

/** بصمات التطاول (عربي + إنجليزي) — فحص محلي فوري بلا استدعاء خارجي. */
const ABUSE_PATTERNS = [
  "كلب",
  "حمار",
  "غبي",
  "أحمق",
  "احمق",
  "تافه",
  "خرا",
  "قذر",
  "لعنة",
  "يلعن",
  "idiot",
  "stupid",
  "moron",
  "loser",
  "trash",
];

const LINK_PATTERN = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|discord\.gg\/)/i;

export const RATE_WINDOW_MS = 60_000;
export const RATE_LIMIT = 8;
export const STRIKES_BEFORE_MUTE = 2;

export interface ModInput {
  text: string;
  /** أوقات آخر رسائل المرسل (ms) */
  recentTimestamps: readonly number[];
  /** عدد مخالفات العضو هذا الأسبوع */
  strikes: number;
  /** آخر نص أرسله العضو مرتين متتاليتين */
  repeatCount?: number;
  now?: number;
  /**
   * حدود تُقرأ من سياسة وحدة الرقابة في سقف الذكاء الموحّد.
   * بلا تمريرها تبقى الحدود الافتراضية (٨ رسائل/دقيقة · تحمّل مخالفتين)
   * فتبقى الحساسية ٥ مطابقة تماماً للسلوك المعروف.
   */
  limits?: { rateLimit?: number; strikesBeforeMute?: number } | undefined;
}

/**
 * يقرّر مصير الرسالة في العشيرة: تمرّ، أو تمرّ بتحذير، أو تُرفض، أو تُرفع للملك.
 * كل قرار مصحوب **بالسبب** — اللاعب يعرف لماذا، والمالك يرى في سجله.
 */
export function scoreClanMessage(input: ModInput): ModDecision {
  const now = input.now ?? Date.now();
  const text = (input.text ?? "").trim();
  const reasons: string[] = [];
  let score = 0;
  let hard = false;

  if (text.length === 0) {
    return { verdict: "mute", score: 10, reasons: ["رسالة فارغة"], message: "الرسالة فارغة." };
  }

  // تطاول صريح ⇒ رفض فوري ورفع للمالك
  const lower = text.toLowerCase();
  const abuse = ABUSE_PATTERNS.find((p) => lower.includes(p));
  if (abuse) {
    score += 6;
    hard = true;
    reasons.push(`ألفاظ مسيئة («${abuse}»)`);
  }

  // روابط خارجية/دعوات ⇒ تحذير
  if (LINK_PATTERN.test(text)) {
    score += 3;
    reasons.push("روابط خارجية أو دعوات");
  }

  // فيضان: أكثر من الحد داخل دقيقة ⇒ رفض (الحد يأتي من حساسية وحدة الرقابة)
  const rateLimit = Math.max(2, Math.min(40, input.limits?.rateLimit ?? RATE_LIMIT));
  const strikeTolerance = Math.max(0, Math.min(6, input.limits?.strikesBeforeMute ?? STRIKES_BEFORE_MUTE));
  const inWindow = input.recentTimestamps.filter((t) => now - t < RATE_WINDOW_MS).length;
  if (inWindow >= rateLimit) {
    score += 5;
    hard = true;
    reasons.push(`إرسال سريع (${inWindow + 1} رسالة في دقيقة · الحد ${rateLimit})`);
  }

  // تكرار نفس النص ⇒ إزعاج
  if ((input.repeatCount ?? 0) >= 3) {
    score += 3;
    reasons.push("تكرار نفس الرسالة");
  }

  // صراخ: أحرف لاتينية كبيرة أو رمز مكرر بلا داعٍ
  const latin = text.replace(/[^A-Za-z]/g, "");
  if (latin.length >= 12 && latin.replace(/[^A-Z]/g, "").length / latin.length >= 0.7) {
    score += 2;
    reasons.push("كتابة بحروف كبيرة (صراخ)");
  }
  if (/(.)\1{7,}/u.test(text)) {
    score += 2;
    reasons.push("تكرار حرف واحد بإفراط");
  }

  const strikes = Math.max(0, Math.floor(input.strikes || 0));
  if (reasons.length === 0) {
    return { verdict: "ok", score: 0, reasons: [], message: "رسالة سليمة." };
  }

  // السلوك المتكرر يصعّد العقوبة: البصمة الثالثة ⇒ منع مؤقت
  if (!hard && strikes >= strikeTolerance) {
    hard = true;
    reasons.push(`سبق التنبيه ${strikes} مرة هذا الأسبوع`);
  }

  if (hard) {
    return {
      verdict: "flag",
      score,
      reasons,
      message: `رُفضت رسالتك: ${reasons.join(" · ")}. أُبلغت الإدارة بالتفاصيل.`,
    };
  }
  return {
    verdict: "warn",
    score,
    reasons,
    message: `تنبيه: ${reasons.join(" · ")}. الرسالة مرّت، لكن كرّرها فتُرفض.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 6️⃣ نبضة العشائر — عين العرش على المجتمع المنظَّم
// ═══════════════════════════════════════════════════════════════════════

export interface ClanPulseRow {
  power: number;
  level: number;
  memberCount: number;
  pointsThisWeek: number;
  frozen?: boolean | undefined;
}

export interface ClanModFlag {
  kind: string;
  at: number;
}

export interface ClanPulse {
  totalClans: number;
  totalMembers: number;
  avgPower: number;
  topPower: number;
  frozen: number;
  /** توزيع العشائر على رتب القوة */
  rankBuckets: { level: number; name: string; icon: string; count: number }[];
  /** أعلى العشائر حرباً هذا الأسبوع */
  warLeaderPoints: number;
  /** مخالفات آخر ٢٤ ساعة */
  flags24h: number;
  /** نوع المخالفة الأكثر شيوعاً */
  topViolation: { kind: string; label: string; count: number } | null;
  empty: boolean;
}

const MOD_LABELS: Record<string, string> = {
  abuse: "تطاول وألفاظ",
  link: "روابط ودعوات",
  flood: "فيضان رسائل",
  repeat: "تكرار وإزعاج",
  caps: "صراخ",
  empty: "رسائل فارغة",
};

/** يحوّل أسباب الرفض إلى تصنيف موحّد للتحليل. */
export function classifyViolation(reasons: readonly string[]): string {
  const r = reasons.join(" ");
  if (r.includes("مسيئة")) return "abuse";
  if (r.includes("روابط")) return "link";
  if (r.includes("سريع")) return "flood";
  if (r.includes("تكرار")) return "repeat";
  if (r.includes("كبيرة") || r.includes("إفراط")) return "caps";
  if (r.includes("فارغة")) return "empty";
  return "other";
}

export function violationLabel(kind: string): string {
  return MOD_LABELS[kind] ?? "مخالفة أخرى";
}

export function computeClanPulse(
  rows: readonly ClanPulseRow[],
  flags: readonly ClanModFlag[],
  now = Date.now(),
): ClanPulse {
  const buckets = CLAN_RANKS.map((r) => ({ level: r.level, name: r.name, icon: r.icon, count: 0 }));
  if (rows.length === 0) {
    return {
      totalClans: 0,
      totalMembers: 0,
      avgPower: 0,
      topPower: 0,
      frozen: 0,
      rankBuckets: buckets,
      warLeaderPoints: 0,
      flags24h: flags.filter((f) => now - f.at < 86_400_000).length,
      topViolation: null,
      empty: true,
    };
  }

  let sumPower = 0;
  let members = 0;
  let top = 0;
  let frozen = 0;
  let warTop = 0;
  for (const row of rows) {
    const power = Math.max(0, Number.isFinite(row.power) ? row.power : 0);
    sumPower += power;
    members += Math.max(0, row.memberCount || 0);
    if (power > top) top = power;
    if (row.frozen) frozen += 1;
    if (row.pointsThisWeek > warTop) warTop = row.pointsThisWeek;
    const b = buckets.find((x) => x.level === clanRankFor(power).level);
    if (b) b.count += 1;
  }

  const recent = flags.filter((f) => now - f.at < 86_400_000);
  const counts = new Map<string, number>();
  for (const f of recent) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  let topKind: { kind: string; count: number } | null = null;
  for (const [kind, count] of counts) {
    if (!topKind || count > topKind.count) topKind = { kind, count };
  }

  return {
    totalClans: rows.length,
    totalMembers: members,
    avgPower: Math.round(sumPower / rows.length),
    topPower: top,
    frozen,
    rankBuckets: buckets,
    warLeaderPoints: warTop,
    flags24h: recent.length,
    topViolation: topKind ? { ...topKind, label: violationLabel(topKind.kind) } : null,
    empty: false,
  };
}

/** جملة واحدة تصف مكانة العشيرة — تُعرض للقائد والأعضاء. */
export function describeClanStanding(rank: number, total: number, power: number): string {
  if (total <= 1) return "عشيرتكم الأولى في السجل — ابنوا قوتكم قبل أن يأتي المنافس";
  if (rank === 1) return `عشيرتكم الأقوى بين ${total} عشيرة بقوة ${power} 🥇`;
  const pct = Math.max(1, Math.round(((total - rank) / Math.max(1, total - 1)) * 100));
  return `ترتيبكم ${rank} من ${total} عشيرة — تسبقون ${pct}% منها`;
}
