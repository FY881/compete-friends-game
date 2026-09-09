import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * مستوى «التميّز البصري» الذي يفتحه مستوى العضوية الحالي:
 * - bronze    : العادي (لا تأثيرات إضافية)
 * - silver    : لمعة فضّية لطيفة
 * - gold      : توهّج ذهبي + حد متحرك
 * - diamond   : متدرّج متحرك + لمعان سطحي
 * - exclusive : توهّج نبضي أسطوري كامل
 */
export type PremiumThemeTier =
  | "bronze"
  | "silver"
  | "gold"
  | "diamond"
  | "exclusive";

const TIER_ORDER: PremiumThemeTier[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
  "exclusive",
];

const TIER_LABELS: Record<PremiumThemeTier, string> = {
  bronze: "برونزي",
  silver: "فضّي",
  gold: "ذهبي",
  diamond: "ماسي",
  exclusive: "أسطوري",
};

export interface PremiumTheme {
  /** مستوى العضوية المحسوب (bronze افتراضياً) */
  tier: PremiumThemeTier;
  /** مؤشر الترتيب (0–4) لسهولة المقارنات */
  tierIndex: number;
  /** هل العضو يملك ثيم بريميوم فعلياً (فوق البرونزي)؟ */
  isPremium: boolean;
  /** هل لديه مستوى التمييز الأعلى المتاح؟ */
  label: string;
  /** وصف ما يفتحه هذا المستوى */
  description: string;
  /** قائمة التأثيرات المفعّلة في هذا المستوى */
  effects: string[];
}

const TIER_DESCRIPTIONS: Record<PremiumThemeTier, string> = {
  bronze: "التصميم الأساسي للنظام — نظيف وواضح.",
  silver: "لمعة فضّية خفيفة على البطاقات والحدود.",
  gold: "توهّج ذهبي دافئ + حد متحرّك فاخر.",
  diamond: "متدرّج أزرق متحرك + لمعان سطحي متلألئ.",
  exclusive: "أقصى تميّز: توهّج نبضي أسطوري وتدرّجات غنية.",
};

const TIER_EFFECTS: Record<PremiumThemeTier, string[]> = {
  bronze: [],
  silver: ["لمعة فضّية على البطاقات"],
  gold: ["توهّج ذهبي", "حد متحرّك فاخر"],
  diamond: ["متدرّج أزرق متحرك", "لمعان سطحي متلألئ", "توهّج أزرق"],
  exclusive: [
    "توهّج نبضي أسطوري",
    "تدرّجات غنية بنفسجي/وردي",
    "كامل التأثيرات السابقة",
  ],
};

/** يقرأ عضوية المستخدم الحالية ويعيد إعدادات الثيم البريميمي المرتبطة بها. */
export function usePremiumTheme(): PremiumTheme {
  const membership = useQuery(api.membershipSystem.getMyMembership);

  let tier: PremiumThemeTier = "bronze";
  if (membership?.tier && TIER_ORDER.includes(membership.tier as PremiumThemeTier)) {
    tier = membership.tier as PremiumThemeTier;
  }

  const tierIndex = TIER_ORDER.indexOf(tier);
  const isPremium = tierIndex > 0;

  return {
    tier,
    tierIndex,
    isPremium,
    label: TIER_LABELS[tier],
    description: TIER_DESCRIPTIONS[tier],
    effects: TIER_EFFECTS[tier],
  };
}