import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧩 جداول الطبقات البريميوم
 *
 *  1. notificationTiers      — طبقات الإشعارات الذكية لكل لاعب (مقاطعة/تأجيل/سقف/ملخص)
 *  2. deferredNotifications  — طابور التأجيل: إشعارات انتظرت اللحظة المناسبة ولم تُلغَ
 *  3. profileCustomization   — التخصيص العميق للملف (ثيم، نمط بطاقة، نبذة، شارات مثبتة، خصوصية)
 *
 * تُدمَج في مخطط اللعبة عبر `...premiumTables` في schema.ts.
 * ═══════════════════════════════════════════════════════════════════════
 */
export const premiumTables = {
  // ═══ طبقات الإشعارات الذكية ═══
  notificationTiers: defineTable({
    userId: v.id("users"),
    // أدنى أولوية تُقاطع اللاعب فوراً؛ ما دونها يُؤجّل إلى الملخص اليومي
    minPriority: v.string(), // normal | important | critical
    // هل تُؤجَّل إشعارات ساعات الهدوء بدل إسقاطها؟
    quietDefer: v.boolean(),
    // سقف الإشعارات الفورية في الساعة (الحرجة تتجاوزه دائماً)
    maxPerHour: v.number(),
    // ساعة إرسال الملخص اليومي (0-23 بتوقيت الجهاز عند القراءة)
    digestHour: v.number(),
    lastDigestAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ═══ طابور التأجيل الذكي ═══
  deferredNotifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.string(), // info | warning | ban | update | system
    category: v.optional(v.string()),
    priority: v.string(), // critical | important | normal
    actionUrl: v.optional(v.string()),
    reason: v.string(), // quiet_hours | below_threshold | rate_limited
    createdAt: v.number(),
    deliverAfter: v.number(), // لا يُسلَّم قبل هذا الوقت
  })
    .index("by_user", ["userId"])
    .index("by_deliver", ["deliverAfter"]),

  // ═══ التخصيص العميق للملف الشخصي ═══
  profileCustomization: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()), // نبذة قصيرة (حتى 160 حرفاً)
    themeKey: v.string(), // مفتاح الثيم من كتالوج الثيمات
    cardStyle: v.string(), // royal | neon | minimal | midnight | aurora
    pinnedBadges: v.array(v.string()), // حتى 3 شارات مثبتة الظهور
    showStats: v.boolean(), // إظهار الإحصاءات للآخرين
    allowChallenges: v.boolean(), // السماح للآخرين بتحدّيه
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
