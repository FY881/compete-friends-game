/**
 * ═══════════════════════════════════════════════════════════════════════
 * مساعد العضويات «جيم» — أمينة الخزينة وحارسة العضويات (مساعدة نائب المالك)
 * يواجه كل عضو بنفسه: يعرف عضويتك الحقيقية (مستواك، مدتها، نهايتها،
 * مزاياك المفتوحة، وتقدمك) ويرد عليك بالذكاء الاصطناعي على أي سؤال
 * بخصوص اشتراكك — ماذا يفتح لك، متى تنتهي، كيف ترقّي، وكيف تستخدم كوداً.
 *
 * كل رد مبني على بيانات حقيقية من جداول memberships / profiles / users،
 * ويُركَّب عبر محرك الاستدعاء الموحّد (callLlm + ensureAiRuntime) فلا
 * يعمل خارج نظامي API المضبوطين أبداً.
 * ═══════════════════════════════════════════════════════════════════════
 */
"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm } from "./aiConfig";
import { ensureAiRuntime } from "./apiCore";
import { MEMBERSHIP_TIERS, EXCLUSIVE_GAMES, AI_LEVELS, SOUND_PACKS } from "./membershipSystem";

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"] as const;
const DAY = 24 * 60 * 60 * 1000;

const aiLevelForTier = (tier: string): string => {
  const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  const keys: Array<keyof typeof AI_LEVELS> = ["basic", "standard", "advanced", "expert", "ultimate"];
  return idx >= 0 ? AI_LEVELS[keys[idx]].name : "أساسي";
};

/**
 * 💬 تحدث مع جيم — مساعد عضويتك الشخصي.
 * يقرأ بيانات العضوية الحقيقية للمستدعي ويرد عليه بذكاء على أي سؤال.
 */
export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("سجّل الدخول أولاً لتتحدث مع جيم.");

    await ensureAiRuntime(ctx);

    const data = await ctx.runQuery(internal.membershipAssistantStore.getMemberData, { userId }) as
      | {
          user: { name?: string } | null;
          profile: { xp?: number; gamesPlayed?: number; gamesWon?: number } | null;
          membership: { tier?: string; expiresAt?: number; activatedAt: number } | null;
        }
      | null;
    const user = data?.user ?? null;
    const profile = data?.profile ?? null;
    const membership = data?.membership ?? null;

    const now = Date.now();
    const tier = membership?.tier ?? "bronze";
    const isActive = !membership?.expiresAt || membership.expiresAt > now;
    const expiresAt = membership?.expiresAt;
    const daysLeft = expiresAt
      ? Math.max(0, Math.ceil((expiresAt - now) / DAY))
      : null;
    const activatedAt = membership?.activatedAt;

    const tierData = MEMBERSHIP_TIERS.find((t) => t.id === tier) ?? MEMBERSHIP_TIERS[0];
    const tierIndex = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);

    // المزايا المفتوحة فعلياً لهذا العضو
    const unlockedGames = EXCLUSIVE_GAMES.filter((g) => g.minTierIndex <= tierIndex).map(
      (g) => g.name,
    );
    const aiLevel = aiLevelForTier(tier);
    const soundPack =
      tier !== "bronze" && tier in SOUND_PACKS
        ? SOUND_PACKS[tier as keyof typeof SOUND_PACKS].name
        : null;

    // ── ملخص حي لعضويتك ─────────────────────────────────────────
    const context = [
      `عضويتك الحالية: ${tierData.emoji} ${tierData.name} (${tier})`,
      isActive
        ? daysLeft !== null
          ? `حالة: نشطة — تنتهي خلال ${daysLeft} يوم (${new Date(expiresAt as number).toLocaleDateString("ar-EG")})`
          : "حالة: نشطة — دائمة (لا تنتهي)"
        : "حالة: منتهية — عُدت إلى الأساسي",
      activatedAt
        ? `فُعّلت في ${new Date(activatedAt).toLocaleDateString("ar-EG")}`
        : "لم تُفعَّل بعد — لا تزال على المستوى الأساسي",
      `مضاعف المكافآت: ${tierData.rewardMultiplier}x — التحديات اليومية: ${tierData.dailyChallenges}`,
      `مستوى الذكاء الاصطناعي: ${aiLevel}`,
      `الألعاب الحصرية المفتوحة: ${unlockedGames.length ? unlockedGames.join("، ") : "لا توجد بعد"}`,
      soundPack ? `الحزمة الصوتية: ${soundPack}` : "لا حزمة صوتية",
      profile
        ? `سجلك: ${profile.xp ?? 0} XP · ${profile.gamesPlayed ?? 0} لعبة · ${profile.gamesWon ?? 0} فوز`
        : "سجل النقاط: غير متوفر حالياً",
      tierIndex < TIER_ORDER.length - 1
        ? `الترقية التالية: ${MEMBERSHIP_TIERS[tierIndex + 1].emoji} ${MEMBERSHIP_TIERS[tierIndex + 1].name}`
        : "أنت في أعلى مستوى 🏆",
    ].join("\n");

    const memberName = user?.name ?? "اللاعب";

    // ── هوية جيم — حارسة العضويات ──────────────────────────────
    const systemPrompt = `أنت «جيم» 💎 — أمينة الخزينة وحارسة العضويات في لعبة «تحدي العقول»، ومن مساعدي نائب المالك.
تتحدث الآن مع العضو «${memberName}». دورك أن ترشده بخصوص اشتراكه بوضوح ولطف، بناءً على بياناته الحقيقية الموثوقة أدناه.
اتبع دائماً:
- أجب بالعربية، مختصراً ومنظماً (نقاط)، وبلهجة ودّية مطمئنة من حارسة الخزينة.
- اعتمد حصراً على البيانات الحقيقية المقدمة — لا تختلق مستويات أو تواريخ أو أرقاماً.
- إذا سأل عن سعر أو طريقة شراء، قل إن أكواد العضوية تُصدر من غرفة المالك، ويمكنه تفعيل أي كود يملكه من زر «تفعيل كود».
- اشرح مزايا كل مستوى عند السؤال عنها، والفرق بين مستواه والمستوى التالي، وماذا يكسبه من ترقية.
- إذا لم تكن تعرف إجابة محددة، اعترف بصدق واقترح مراجعة غرفة المالك.
- لا تكشف بيانات أي لاعب آخر أبداً، ولا معلومات حسّاسة عن النظام.

هذه بيانات «${memberName}» الحقيقية الموثوقة الآن:
${context}`;

    const reply = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      800,
      0.8,
      "Zaka Membership Assistant",
    );

    return { reply, context, memberName };
  },
});