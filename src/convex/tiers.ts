import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏅 مستويات العضوية — الأساس المشترك الموحّد
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ملف نقي بلا أي اعتماديات (عدا مشترك `convex/values`) يستعمله المخطط
 * وكل وحدات العضوية معاً — فلا تتكرر قوائم المستويات في مكانين ولا
 * تتعارض تسمية («أسطوري» تسمى هنا `exclusive`، والاسم العربي ثابت).
 */

export const tierValidator = v.union(
  v.literal("bronze"),
  v.literal("silver"),
  v.literal("gold"),
  v.literal("diamond"),
  v.literal("exclusive"),
);

export type Tier = "bronze" | "silver" | "gold" | "diamond" | "exclusive";

/** الترتيب من الأدنى إلى الأعلى — الأساس في كل مقارنات الترقية. */
export const TIER_ORDER: readonly Tier[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
  "exclusive",
] as const;

export const DAY = 24 * 60 * 60 * 1000;

export interface TierMeta {
  name: string;
  nameEn: string;
  emoji: string;
  accent: string;
  /** لون التدرّج في الواجهة */
  gradient: string;
  tagline: string;
  description: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  bronze: {
    name: "برونزي",
    nameEn: "Bronze",
    emoji: "🥉",
    accent: "#a16207",
    gradient: "from-amber-700/20 to-amber-900/10",
    tagline: "انطلاقة كل لاعب",
    description: "كل أساسيات اللعبة: الجولات، التحديات اليومية، وساحة الأوفلاين.",
  },
  silver: {
    name: "فضي",
    nameEn: "Silver",
    emoji: "🥈",
    accent: "#64748b",
    gradient: "from-slate-500/20 to-slate-700/10",
    tagline: "لمعة اللاعب المنتظم",
    description: "مضاعف مكافآت + غرفة خاصة + شارة وإطار فضي + تلميحات يومية.",
  },
  gold: {
    name: "ذهبي",
    nameEn: "Gold",
    emoji: "🥇",
    accent: "#ca8a04",
    gradient: "from-yellow-500/20 to-amber-600/10",
    tagline: "امتيازات جادة",
    description: "أوضاع حصرية + حزمة صوتية + إنشاء فرقة + أولوية في المطابقة + AI متقدم.",
  },
  diamond: {
    name: "ماسي",
    nameEn: "Diamond",
    emoji: "💎",
    accent: "#2563eb",
    gradient: "from-blue-500/20 to-cyan-500/10",
    tagline: "لقب المحترفين",
    description: "مضاعف كبير + أسئلة النخبة + مؤثرات متحركة + دعم أولوية + مرافئ AI.",
  },
  exclusive: {
    name: "أسطوري",
    nameEn: "Exclusive",
    emoji: "👑",
    accent: "#7c3aed",
    gradient: "from-violet-500/20 to-fuchsia-500/10",
    tagline: "القمة بلا سقف",
    description: "كل شيء بلا حدود: أسئلة أسطورية، ساحات خاصة، حصص غير محدودة، ومشاركة الامتيازات.",
  },
};

export function tierIndex(tier: Tier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}

export function tierLabel(tier: Tier): string {
  return `${TIER_META[tier].emoji} ${TIER_META[tier].name}`;
}

/** يعيد المستوى الأعلى من الاثنين (يُستخدم في تراكم الترقيات المؤقتة). */
export function higherTier(a: Tier, b: Tier): Tier {
  return tierIndex(a) >= tierIndex(b) ? a : b;
}

/** هل المستوى `tier` يبلغ حدّ `required` أو يتجاوزه؟ */
export function meetsTier(tier: Tier, required: Tier): boolean {
  return tierIndex(tier) >= tierIndex(required);
}

/** المستوى التالي في السلم (أو null إن كان في القمة). */
export function nextTier(tier: Tier): Tier | null {
  const i = tierIndex(tier);
  return i >= TIER_ORDER.length - 1 ? null : TIER_ORDER[i + 1];
}
