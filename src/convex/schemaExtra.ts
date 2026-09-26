import { defineTable } from "convex/server";
import { v } from "convex/values";
import { sovereignTables } from "./schemaAppend";
import { governanceTables } from "./schemaGovernance";
import { roomForumTables } from "./schemaRooms";
import { miniGameTables } from "./schemaMiniGames";
import { gameLiveTables } from "./schemaGameLive";
import { tierValidator } from "./tiers";
import { apiCenterTables } from "./schemaApiCenter";

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

  // ═══ سجل إنفاق المتجر — يجعل أرصدة coins/gems قابلة للإنفاق فعلاً ═══
  // (قبل هذا الجدول كانت الأسعار معروضة ولا تُخصم من أي رصيد أبداً)
  storeLedger: defineTable({
    userId: v.id("users"),
    currency: v.string(), // coins | gems
    amount: v.number(), // موجب = خصم
    reason: v.string(),
    itemId: v.optional(v.string()),
    at: v.number(),
  }).index("by_user", ["userId"]),

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

  // ═══════════════════════════════════════════════════════════════════════
  // ║ 🏅 العضويات 3.0 — الترقيات المؤقتة والاقتصاد والعروض والمشاركة      ║
  // ║ كل جدول هنا يخدم ميزة حقيقية قابلة للتطبيق، لا عرضاً شكلياً.        ║
  // ═══════════════════════════════════════════════════════════════════════

  // ║ الترقيات المؤقتة: قسيمة/تجربة/مهمة/مشاركة ترفع المستوى الفعّال ║
  // ║ لمدة محدودة، ثم يعود النظام تلقائياً للمستوى المدفوع.           ║
  membershipBoosts: defineTable({
    userId: v.id("users"),
    tier: tierValidator,
    source: v.string(), // promo | trial | quest | share | gift | owner
    label: v.string(),
    startedAt: v.number(),
    expiresAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_expiry", ["expiresAt"]),

  // ║ سجل أحداث العضوية الموسّع — كل عملية لها أثر دائم قابل للتدقيق ║
  // ║ (لا يمسّ membershipLogs القديم حتى لا نغيّر اتحاد قيمه)          ║
  membershipEvents: defineTable({
    userId: v.optional(v.id("users")),
    actorName: v.string(),
    kind: v.string(), // purchase | promo | trial | share | quest | boost | upgrade | renew
    tier: v.optional(tierValidator),
    detail: v.string(),
    points: v.optional(v.number()),
    days: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_user", ["userId", "at"])
    .index("by_at", ["at"]),

  // ║ قسائم ترويجية حقيقية بقيود مُنفَّذة (سقف استخدام/سقف لكل لاعب/انتهاء) ║
  promoCodes: defineTable({
    code: v.string(),
    tier: tierValidator,
    days: v.number(),
    maxUses: v.number(),
    usedCount: v.number(),
    perUserLimit: v.number(),
    minTier: v.optional(tierValidator), // أقل مستوى مؤهّل للاستبدال
    maxTier: v.optional(tierValidator), // أعلى مستوى مؤهّل (لمنع الاستغلال)
    expiresAt: v.optional(v.number()),
    active: v.boolean(),
    note: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["active"]),

  promoRedemptions: defineTable({
    promoId: v.id("promoCodes"),
    userId: v.id("users"),
    tier: tierValidator,
    days: v.number(),
    at: v.number(),
  })
    .index("by_promo_user", ["promoId", "userId"])
    .index("by_user", ["userId"]),

  // ║ التجارب المجانية — مرة واحدة لكل مستوى، وتُسجَّل للأبد ║
  membershipTrials: defineTable({
    userId: v.id("users"),
    tier: tierValidator,
    startedAt: v.number(),
    expiresAt: v.number(),
    source: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tier", ["userId", "tier"]),

  // ║ مشاركة الامتيازات: عضو مميّز يمنح صديقاً/عضو فرقته مستوى فعّالاً ║
  // ║ لمدة محدودة — بعدد مقاعد يحدّده امتياز perkShareSlots.          ║
  perkShares: defineTable({
    ownerId: v.id("users"),
    ownerName: v.string(),
    beneficiaryId: v.id("users"),
    beneficiaryName: v.string(),
    tier: tierValidator,
    startedAt: v.number(),
    expiresAt: v.number(),
    active: v.boolean(),
    note: v.optional(v.string()),
    // ربط مباشر بالترقية المؤقتة — يتيح إلغاء المنح فوراً عند سحب المشاركة
    boostId: v.optional(v.id("membershipBoosts")),
  })
    .index("by_owner", ["ownerId", "active"])
    .index("by_beneficiary", ["beneficiaryId", "active"]),

  // ║ مهام العضوية: تقدّم مشتق من الإحصاءات الحقيقية + استلام دفعة ترقية ║
  membershipQuestClaims: defineTable({
    userId: v.id("users"),
    questId: v.string(),
    at: v.number(),
    tier: tierValidator,
    hours: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_quest", ["userId", "questId"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ║ 🏅 العضويات 4.0 — فرق ومقاعد · رتب شرفية · تجديد واسترداد · خزنة     ║
  // ║ أربعة أنظمة حقيقية تربط العضوية بالمجتمع والاقتصاد وطويلة الأمد.     ║
  // ═══════════════════════════════════════════════════════════════════════

  // ║ فرق العضوية: عضو مميّز يفتح فرقة بكود، ويُمنح أعضاؤها مستوى مشتقاً  ║
  // ║ (درجة واحدة دون مستوى القائد) كترقية مؤقتة حقيقية قابلة للسحب.      ║
  memberSquads: defineTable({
    ownerId: v.id("users"),
    ownerName: v.string(),
    name: v.string(),
    emoji: v.string(),
    code: v.string(),
    seatTier: tierValidator,
    seatsTotal: v.number(),
    open: v.boolean(),
    autoAccept: v.boolean(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    disbandedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_code", ["code"]),

  squadSeats: defineTable({
    squadId: v.id("memberSquads"),
    userId: v.id("users"),
    userName: v.string(),
    role: v.string(), // leader | member
    status: v.string(), // pending | active | declined | left | kicked
    requestedAt: v.number(),
    joinedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    // ربط مباشر بالترقية المؤقتة — الطرد يُلغي المنح فوراً
    boostId: v.optional(v.id("membershipBoosts")),
    note: v.optional(v.string()),
  })
    .index("by_squad", ["squadId", "status"])
    .index("by_user", ["userId", "status"])
    .index("by_user_squad", ["userId", "squadId"]),

  // ║ الرتب الشرفية: مسار طويل الأمد يُحتسب من أيام العضوية الفعلية     ║
  // ║ ومستواها، ويُترجم إلى مكافآت **دائمة** لا تنتهي بانتهاء العضوية.    ║
  membershipPrestige: defineTable({
    userId: v.id("users"),
    points: v.number(),
    level: v.number(),
    membershipDays: v.number(),
    highestTier: tierValidator,
    streak: v.number(), // أسابيع متتالية بعضوية مدفوعة
    claimedLevels: v.array(v.number()),
    lastAccrualAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_points", ["points"]),

  // ║ التجديد والاسترداد: تفضيلات التجديد + رصيد الأيام المدخرة       ║
  renewalPrefs: defineTable({
    userId: v.id("users"),
    autoRenew: v.boolean(),
    payWithLoyalty: v.boolean(),
    keepTierOnExpiry: v.boolean(), // فترة سماح تحفظ المستوى بعد الانتهاء
    graceDays: v.number(),
    remindersOn: v.boolean(),
    lastReminderAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  membershipCredits: defineTable({
    userId: v.id("users"),
    bankedDays: v.number(),
    lifetimeBanked: v.number(),
    lifetimeUsed: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  renewalOffers: defineTable({
    userId: v.id("users"),
    tier: tierValidator,
    days: v.number(),
    discountPct: v.number(),
    extraDays: v.number(),
    reason: v.string(), // winback | streak | grace | owner
    expiresAt: v.number(),
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "used"])
    .index("by_expiry", ["expiresAt"]),

  // ║ خزنة المميزات: فتح بنظام حظّ عادل (pity) + تصنيع بالفُتات        ║
  perkVault: defineTable({
    userId: v.id("users"),
    fragments: v.number(),
    opens: v.number(),
    pity: v.number(), // عدّاد الرحمة: يضمن مكافأة نادرة بعد عدد فتحات
    lastOpenAt: v.number(),
    unlocked: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  perkVaultOpens: defineTable({
    userId: v.id("users"),
    rewardKind: v.string(), // perk | fragments | boost | loyalty
    rewardKey: v.string(),
    label: v.string(),
    rarity: v.string(), // common | rare | epic | legendary
    at: v.number(),
  }).index("by_user", ["userId", "at"]),

  // ⏱️ مركز التحكم بمهام AI المجدولة — حالة كل مهمة يتحكم بها المالك فوراً
  // بلا إعادة نشر: مفعّلة؟ كل كم؟ آخر تشغيل؟ كم مرة؟ آخر خطأ؟
  aiCronJobs: defineTable({
    key: v.string(), // معرّف المهمة (ثابت في الكود)
    enabled: v.boolean(),
    intervalMinutes: v.number(),
    lastRunAt: v.number(),
    lastDurationMs: v.number(),
    lastStatus: v.string(), // never | ok | error
    lastResult: v.string(),
    runCount: v.number(),
    errorCount: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // 🧠 v16.0 — مركز API: مصفوفة التوجيه + الحدود + الاستهلاك اليومي
  ...apiCenterTables,

  // 👑 الحاكم السيادي — عقوبات ومراسيم بمفعول فعلي
  ...sovereignTables,

  // ⚖️小路 ومجلس الحاكم — pathway تشريعي تنفيذي غير قابل للالتفاف
  ...governanceTables,

  // 🏛️ v10.0 — الغرف الخاصة المتقدمة + ملتقى العقول
  ...roomForumTables,
  // 🎮 v14.0 — الألعاب المصغّرة: نتائج حقيقية + سقف خبرة يومي
  ...miniGameTables,
  // 🎯 v15.0 — الغرفة الحيّة: سجل تعديلات الصعوبة التكيّفية
  ...gameLiveTables,

  // 🧠 العقل المُنسّق — القرارات التنفيذية الموزونة عبر كل أدوات العقول
  conductorDecisions: defineTable({
    cycle: v.number(), // رقم الدورة (تتصاعد)
    pulse: v.string(), // نبض الأدوات وقت القرار (JSON مفاتيح الأدوات وقيمها)
    decision: v.union(
      v.literal("sharpen_colossus"), // اشدد فخاخ الطاغوت
      v.literal("ease_questions"), // خفف صعوبة الترسانة
      v.literal("generate_questions"), // املأ فئة نازفة
      v.literal("boost_training"), // أطلق تدريباً جماعياً مُعلناً
      v.literal("investigate"), // افتح تحقيقاً للمشتبه الأعلى
      v.literal("narrate_hype"), // أطلق معلقاً على أقوى لحظة
      v.literal("prophecy"), // أجبر العرّاف على نبوءة جديدة
      v.literal("hold"), // لا شيء — كل شيء متوازن
    ),
    reason: v.string(), // المبرر المعلن
    confidence: v.number(),
    status: v.union(
      v.literal("executed"),
      v.literal("skipped"),
    ),
    outcome: v.optional(
      v.union(
        v.literal("good"), // المؤشرات تحسنت بعده
        v.literal("bad"), // المؤشرات تدهورت
        v.literal("neutral"), // بلا أثر واضح
        v.literal("pending"), // لم يُقيَّم بعد
      ),
    ),
    engine: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_cycle", ["cycle"])
    .index("by_created", ["createdAt"]),

  // 🔮 عرّاف العقول — نبوءات علنية شجاعة تُحاسب آلياً على دقتها
  oracleProphecies: defineTable({
    kind: v.union(
      v.literal("weekly_champion"), // من سيصدر لوحة الصدارة نهاية الأسبوع
      v.literal("upset"), // لاعب صاعد سيفاجئ متصدراً
      v.literal("accuracy_drop"), // دقة الفئة ستنهار هذا الأسبوع
      v.literal("colossus_fate"), // مصير الطاغوت: هزيمة أو نجاة
      v.literal("dark_horse"), // الحصان الأسود في الترتيب
    ),
    subjectId: v.optional(v.id("users")), // اللاعب موضوع النبوءة
    subjectName: v.string(),
    claim: v.string(), // نص النبوءة الصريح
    confidence: v.number(), // 0-100 جسارة العرّاف
    stake: v.number(), // نقاط ولاء يخاطر بها
    dataBasis: v.string(), // الأرقام التي بنى عليها (شفافية كاملة)
    status: v.union(
      v.literal("open"), // بانتظار الحكم الزمن
      v.literal("fulfilled"), // تحققت ✅
      v.literal("falsified"), // كُذّبت ❌
      v.literal("void"), // ظروف حالت دون الحكم
    ),
    verdictDetail: v.optional(v.string()),
    windowStart: v.number(),
    windowEnd: v.number(), // موعد الحكم
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_window", ["windowEnd"])
    .index("by_subject", ["subjectId"]),

  // 👹 الطاغوت — عدو جماعي حي يتعلم من دقة المجتمع ويتكيف أسبوعياً
  colossusSeasons: defineTable({
    season: v.number(), // رقم الموسم (أسبوع زمني)
    name: v.string(), // اسم الطاغوت المولّد
    persona: v.string(), // شخصية الطاغوت (تُقرأ في الواجهة)
    taunt: v.string(), // استفزازه الافتتاحي
    hp: v.number(), // نقاط حياته = دقة المجتمع المتوقعة × عدد الأسئلة
    questionIds: v.array(v.string()), // ترسانة الأسئلة المختارة تكيفياً
    weaknesses: v.array(v.string()), // فئات ضعفه (مكافأة مضاعفة عليها)
    status: v.union(
      v.literal("active"),
      v.literal("defeated"), // هُزم هذا الأسبوع
      v.literal("escaped"), // نجا من هزيمة المجتمع
    ),
    defeatedBy: v.optional(v.number()), // عدد الهزائم
    solversCount: v.optional(v.number()),
    createdAt: v.number(),
    endsAt: v.number(),
  })
    .index("by_season", ["season"])
    .index("by_status", ["status"]),

  colossusStrikes: defineTable({
    season: v.number(),
    userId: v.id("users"),
    userName: v.string(),
    questionIndex: v.number(),
    correct: v.boolean(),
    elapsedMs: v.number(),
    damage: v.number(), // الضرر المسلّط
    createdAt: v.number(),
  })
    .index("by_season", ["season"])
    .index("by_user_season", ["userId", "season"]),

  // 📰 سجل العقول — جريدة الموقع الذكية التي تُروى بالبيانات الحقيقية
  chronicleIssues: defineTable({
    edition: v.string(), // مفتاح الإصدار YYYY-Www
    weekStart: v.number(),
    weekEnd: v.number(),
    status: v.union(
      v.literal("draft"), // تحت التوليد
      v.literal("published"), // منشورة للجميع
    ),
    headline: v.string(), // العنوان الرئيسي
    intro: v.string(), // افتتاحية المحرر
    sections: v.array(
      v.object({
        key: v.string(), // بطل الأسبوع | معركة الأسبوع | صعود العقول | رقم الأسبوع | كشف الأقنعة
        title: v.string(),
        body: v.string(),
        emoji: v.string(),
      }),
    ),
    engine: v.optional(v.string()), // llm | local
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_edition", ["edition"])
    .index("by_published", ["publishedAt"]),

  // 🎙️ المعلق الأسطوري — لحظات المباراة المروية بالذكاء الاصطناعي
  casterNarrative: defineTable({
    gameId: v.id("games"),
    code: v.string(),
    momentKind: v.union(
      v.literal("match_intro"), // افتتاحية المباراة
      v.literal("question_start"), // لحظة إطلاق سؤال
      v.literal("reveal"), // كشف الإجابة: البطل/المفاجأة/الخلاصة
      v.literal("streak_alert"), // سلسلة نارية
      v.literal("comeback_alert"), // عودة من الغفير
      v.literal("finale"), // قصة النهاية الختامية
    ),
    atQuestionIndex: v.number(),
    text: v.string(), // السرد الدرامي المولّد
    stats: v.optional(v.string()), // سياق الأرقام المُغذي للسرد
    engine: v.optional(v.string()), // llm | local — مصدر السرد
    createdAt: v.number(),
  })
    .index("by_game", ["gameId", "createdAt"])
    .index("by_code", ["code", "createdAt"]),
};
