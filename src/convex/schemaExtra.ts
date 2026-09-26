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

  // 🧪 عالِم العقول — تجارب سببية حقيقية على الجامعة الحية
  experiments: defineTable({
    hypothesis: v.string(), // الفرضية بالعربية
    lever: v.string(), // الرافعة المُجربة (مثل: reveal_duration, golden_multiplier)
    treatment: v.string(), // القيمة التجريبية (JSON)
    control: v.string(), // قيمة الضبط (كما كانت)
    // مقسّم الغرف: كل غرفة جديدة تنضم لمجموعة بالحظ (بصمة code)
    treatmentRooms: v.array(v.string()),
    controlRooms: v.array(v.string()),
    metricsBefore: v.optional(v.string()), // لقطة المؤشرات قبل التجربة (JSON)
    metricsAfter: v.optional(v.string()),
    status: v.union(
      v.literal("running"), // جارية — تجمع بيانات
      v.literal("concluded"), // استُنتجت
      v.literal("aborted"), // أُلغيت (خطر واضح)
    ),
    conclusion: v.optional(v.string()), // الاستنتاج السببي
    causalConfidence: v.optional(v.number()), // 0-100: قوة الدليل الإحصائي
    appliedGlobally: v.optional(v.boolean()), // هل وافق العقل على تعميم النتيجة؟
    startedAt: v.number(),
    concludedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),

  // 👤 صدى الذات — نسخة رقمية من عقل اللاعب الماضي يواجهه بها اليوم
  echoMatches: defineTable({
    userId: v.id("users"),
    echoVersion: v.number(), // لقطة الزمن التي بُني منها الصدى
    questionIds: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("done"),
    ),
    // أداء الصدى المُحاكى لكل سؤال (مُعدّ مسبقاً من بصمة الماضي)
    echoAnswers: v.array(
      v.object({
        questionId: v.string(),
        correct: v.boolean(),
        elapsedMs: v.number(),
      }),
    ),
    myCorrect: v.optional(v.number()),
    echoCorrect: v.optional(v.number()),
    verdict: v.optional(
      v.union(
        v.literal("surpassed"), // تجاوزت عقلك القديم
        v.literal("matched"), // تعادل معه
        v.literal("lost"), // ما زلت تحت ظل ذاتك القديمة
      ),
    ),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  // 📖 ملحمة العقول — مغامرة سردية تفاعلية أبوابها محاكمها أسئلة حقيقية
  sagaRuns: defineTable({
    userId: v.id("users"),
    heroName: v.string(), // اسم البطل
    theme: v.string(), // عالم الملحمة (مستوحى من أقوى فئات اللاعب)
    status: v.union(
      v.literal("active"), // مغامرة جارية
      v.literal("completed"), // وصل للنهاية (مجد أو سقوط)
      v.literal("abandoned"), // تُركت
    ),
    chapterIndex: v.number(), // الفصل الحالي
    totalChapters: v.number(),
    glory: v.number(), // مجد مكتسب (0..100)
    pathTaken: v.array(v.string()), // خيارات البطل في كل فصل
    endingTitle: v.optional(v.string()), // لقب النهاية عند الإكمال
    createdAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),

  sagaChapters: defineTable({
    runId: v.id("sagaRuns"),
    index: v.number(),
    scene: v.string(), // نص المشهد السردي
    choices: v.array(
      v.object({
        key: v.string(), // a | b | c
        text: v.string(),
        gateDifficulty: v.union(
          v.literal("easy"),
          v.literal("medium"),
          v.literal("hard"),
          v.literal("extreme"),
        ),
        gateCategory: v.string(), // فئة سؤال البوابة
        gloryReward: v.number(),
        riskNote: v.string(), // ما تخسره إن أخفقت
      }),
    ),
    chosenKey: v.optional(v.string()),
    gateQuestionId: v.optional(v.string()),
    gatePassed: v.optional(v.boolean()),
    narration: v.optional(v.string()), // وصف نتيجة اختياره
    createdAt: v.number(),
  })
    .index("by_run", ["runId"]),

  // 🧬 بازار العقول — شبكة التوأمات والأعداء المعلنين المشتقة من البصمات
  mindSoulmates: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    twinId: v.id("users"),
    twinName: v.string(),
    twinAffinity: v.number(), // 0-100 قرب العقلين
    nemesisId: v.id("users"),
    nemesisName: v.string(),
    nemesisContrast: v.number(), // 0-100 بعد العقلين
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // 🗺️ مسار العقل — خطة أسبوعية شخصية مشتقة من أضعف الفئات
  mindPaths: defineTable({
    userId: v.id("users"),
    focusCategory: v.string(),
    secondCategory: v.string(),
    strengthCategory: v.string(),
    weakAcc: v.number(),
    strongAcc: v.number(),
    coachNote: v.string(),
    weeklyTarget: v.number(),
    speedTargetMs: v.number(),
    challengeQuestionId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // 🤝 عهود التوأم — تحديات متبادلة بين اللاعبين المتشابهين (بصمات حقيقية)
  mindPacts: defineTable({
    fromId: v.id("users"),
    fromName: v.string(),
    toId: v.id("users"),
    toName: v.string(),
    kind: v.string(), // twin_challenge | nemesis_duel
    message: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    createdAt: v.number(),
  })
    .index("by_to", ["toId"])
    .index("by_from", ["fromId"]),

  // 🎲 بئر القدر — رهانات ولاء على الأداء المستقبلي يحكمها الوقت آلياً
  fateBets: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    kind: v.string(), // correct_answers | win_match | streak_reach | category_sweep | flip
    stake: v.number(), // نقاط ولاء مخصومة فوراً (0 للإحالات)
    multiplier: v.number(), // مضاعف الرد عند الوفاء
    target: v.number(), // الهدف العددي
    category: v.optional(v.union(v.string(), v.null())), // فئة أو نوع إحالة
    flipId: v.optional(v.id("fateFlips")), // لخانات القبول المرتبطة بإحالة
    status: v.union(v.literal("open"), v.literal("fulfilled"), v.literal("forfeited")),
    verdictDetail: v.optional(v.string()),
    createdAt: v.number(),
    judgeAt: v.number(),
    judgedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status_judge", ["status", "judgeAt"]),

  // 🌪️ إحالات القدر الظرفية — مهام مولّدة من حالة السوق الحقيقية
  fateFlips: defineTable({
    kind: v.string(), // ghost_category | streak_guard | seasonal_close
    title: v.string(),
    desc: v.string(),
    target: v.number(),
    reward: v.number(), // ولاء يُدفع عند الوفاء
    status: v.union(v.literal("open"), v.literal("closed")),
    acceptedCount: v.number(),
    fulfilledCount: v.number(),
    createdAt: v.number(),
    judgeAt: v.number(),
  }).index("by_status", ["status"]),

  // 📈 صرف القدرات — مؤشر سوق حي للولاء + صفقات وتوقعات محلل
  exchangeTicks: defineTable({
    midx: v.number(), // قيمة المؤشر
    activeToday: v.number(),
    todayRounds: v.number(),
    circulating: v.number(), // الولاء المتداول
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  exchangeTrades: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
    stake: v.number(),
    entryMidx: v.number(),
    windowHours: v.number(), // 24 | 48 | 168
    status: v.union(v.literal("open"), v.literal("won"), v.literal("lost")),
    exitMidx: v.optional(v.number()),
    payout: v.optional(v.number()),
    createdAt: v.number(),
    settleAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status_settle", ["status", "settleAt"]),

  exchangeForecasts: defineTable({
    trend: v.string(), // up | down | flat
    changePct: v.number(),
    comment: v.string(),
    status: v.string(), // open | judged
    wasRight: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  // ✨ لحظات القدر — جدار الأسطورة الزمني للّحظات الاستثنائية
  mindMoments: defineTable({
    dedupeKey: v.string(), // منع التكرار (game:user:kind)
    userId: v.id("users"),
    userName: v.string(),
    kind: v.string(), // نوع النمط الأسطوري
    title: v.string(),
    narrative: v.optional(v.string()), // القصة المولدة
    detail: v.string(),
    rarity: v.number(), // 0-100
    hidden: v.boolean(),
    playedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_played", ["playedAt"])
    .index("by_user", ["userId"]),

  // 🌳 شجرة النسب العقلية — جينات اللاعبين الغائبين تُورّث للمتعثرين
  mindGenealogy: defineTable({
    ancestorId: v.id("users"), // اللاعب صاحب البصمة المتحللة
    ancestorName: v.string(),
    geneStrong: v.string(), // أقوى فئة
    geneSecond: v.string(),
    geneWeak: v.string(), // أضعف فئة (تحذير للوارث)
    strengthAcc: v.number(), // دقة القوة %
    overallAcc: v.number(),
    lastSeen: v.number(),
    inheritedBy: v.optional(v.id("users")),
    inheritedAt: v.optional(v.number()),
    charter: v.optional(v.string()), // الوصية العقلية
    createdAt: v.number(),
  }).index("by_ancestor", ["ancestorId"]),

  // ⚖️ مجلس العقول الدائم — ملفات المناظرة بين وحدات الذكاء المتنازعة
  aiDebates: defineTable({
    conflictKey: v.string(), // بصمة الخلاف الأصلي في aiConflicts
    target: v.string(),
    unitA: v.string(),
    unitB: v.string(),
    stanceA: v.string(),
    stanceB: v.string(),
    severity: v.string(),
    speeches: v.array(
      v.object({
        role: v.string(), // advocate | nemesis | senator
        speaker: v.string(),
        text: v.string(),
        side: v.string(), // A | B | neutral
      }),
    ),
    verdict: v.optional(v.string()),
    winner: v.optional(v.string()), // A | B | split
    confidence: v.optional(v.number()),
    autoExecuted: v.optional(v.boolean()),
    status: v.union(v.literal("open"), v.literal("resolved")),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

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
