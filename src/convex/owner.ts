import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getCurrentUser } from "./users";
import { levelFromXp } from "./gameConfig";
import { QUESTION_BANK } from "./questions";
import {
  APK_BYTES,
  APK_FILE_NAME,
  APK_SHA256,
  BUILD_ID,
  CURRENT_VERSION,
} from "./apkRelease";

// ---------------------------------------------------------------------------
// Owner identity — the permanent owner email. Sign in with this email to open
// the owner room. Server-side checks below make it impossible to forge.
// ---------------------------------------------------------------------------

export const OWNER_EMAIL = "omw70op@gmail.com";

export const CHEAT_PENALTY_POINTS = 150;
export const CHEAT_BAN_MS = 24 * 60 * 60 * 1000; // 24h temp ban for repeated cheating

/** Built-in laws shown on /rules — the owner can edit/seed these. */
export const DEFAULT_RULES: {
  title: string;
  category: "essential" | "prohibited" | "punishment";
  description: string;
  severity: "low" | "medium" | "high";
  order: number;
  active: boolean;
}[] = [
  {
    title: "الاحترام أولاً",
    category: "essential",
    description: "تعامل مع كل لاعب باحترام. الإساءة أو التنمر أو السخرية بأي شكل مرفوضة تماماً.",
    severity: "medium",
    order: 1,
    active: true,
  },
  {
    title: "أسماء وألفاظ نظيفة",
    category: "essential",
    description: "أسماء اللاعبين وكل ما يُكتب في الموقع يجب أن يكون لائقاً وخالياً من البذاءة.",
    severity: "medium",
    order: 2,
    active: true,
  },
  {
    title: "اللعب النزيه",
    category: "essential",
    description: "المنافسة تعتمد على معلوماتك فقط. أي وسيلة خارجية للحصول على الإجابات تُعتبر غشاً.",
    severity: "high",
    order: 3,
    active: true,
  },
  {
    title: "الغش عبر الإنترنت",
    category: "prohibited",
    description: "الخروج من نافذة اللعب أثناء السؤال للبحث عن الإجابة، أو استخدام أي أداة ذكاء اصطناعي أو محرك بحث. يرصد النظام مغادرة النافذة تلقائياً ويطبّق العقوبة فوراً.",
    severity: "high",
    order: 4,
    active: true,
  },
  {
    title: "الإساءة والتنمر",
    category: "prohibited",
    description: "إهانة اللاعبين، التهديد، السب، أو التحريض ضد أي شخص أو مجموعة.",
    severity: "high",
    order: 5,
    active: true,
  },
  {
    title: "المحتوى غير اللائق",
    category: "prohibited",
    description: "ممنوع المحتوى الجنسي، العنصري، الطائفي، أو الذي يمس الأديان والمقدسات.",
    severity: "high",
    order: 6,
    active: true,
  },
  {
    title: "الإزعاج والتخريب",
    category: "prohibited",
    description: "السبام، الرسائل المتكررة، انتحال شخصية الإدارة أو المالك، أو محاولة تعطيل الجولات.",
    severity: "medium",
    order: 7,
    active: true,
  },
  {
    title: "مخالفة بسيطة = تحذير",
    category: "punishment",
    description: "أول مخالفة بسيطة (كلمة غير لائقة، سلوك مزعج) → تحذير رسمي يُسجَّل في الملف.",
    severity: "low",
    order: 8,
    active: true,
  },
  {
    title: "مخالفة متكررة = كتم أو خصم",
    category: "punishment",
    description: "تكرار المخالفات → كتم مؤقت، أو خصم نقاط، أو إلغاء نتيجة الجولة.",
    severity: "medium",
    order: 9,
    active: true,
  },
  {
    title: "مخالفة خطيرة = حظر",
    category: "punishment",
    description: "الغش المتكرر، التهديد، العنصرية أو انتحال شخصية الإدارة → حظر مؤقت أو دائم مع منع الدخول نهائياً عند التكرار.",
    severity: "high",
    order: 10,
    active: true,
  },
];

type DbCtx = { db: QueryCtx["db"] | MutationCtx["db"] };
type WriteCtx = { db: MutationCtx["db"] };
type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

export function isOwnerUser(
  user: { email?: string | null | undefined } | null | undefined,
): boolean {
  return isOwnerEmail(user?.email ?? null);
}

export function isStaffUser(
  user: {
    email?: string | null | undefined;
    role?: string | null | undefined;
  } | null | undefined,
): boolean {
  return isOwnerUser(user) || user?.role === "admin";
}

/** Throws unless the signed-in user is the owner. */
async function requireOwner(ctx: MutationCtx): Promise<AuthedUser> {
  const user = await getCurrentUser(ctx);
  if (user === null || !isOwnerUser(user)) {
    throw new Error("غير مصرح — هذه الصلاحية للمالك فقط");
  }
  return user;
}

/** Throws unless the signed-in user is staff (owner or an admin). */
async function requireStaff(ctx: MutationCtx): Promise<AuthedUser> {
  const user = await getCurrentUser(ctx);
  if (user === null || !isStaffUser(user)) {
    throw new Error("غير مصرح — صلاحية المشرفين مطلوبة");
  }
  return user;
}

/** True if the user is currently banned (temp expiry or permanent). */
export function isUserBanned(user: {
  bannedUntil?: number | null | undefined;
  bannedPermanent?: boolean | null | undefined;
}): { banned: boolean; reason: string | null } {
  if (user.bannedPermanent) {
    return { banned: true, reason: user.bannedPermanent ? "حظر دائم" : null };
  }
  if (user.bannedUntil && user.bannedUntil > Date.now()) {
    return { banned: true, reason: "حظر مؤقت" };
  }
  return { banned: false, reason: null };
}

// ---------------------------------------------------------------------------
// Settings store (JSON values in the `settings` table)
// ---------------------------------------------------------------------------

export type ModSettings = {
  aiEnabled: boolean;
  aiAutoApply: boolean;
  aiAdminEnabled: boolean; // the autonomous AI administrator (15-min sweep)
  aiModel: string;
  announcement: string;
  announcementActive: boolean;
  antiCheatEnabled: boolean;
  disabledQuestions: string[];
  siteUrl: string; // official web app URL — needed by the Android APK for downloads
  openrouterApiKey: string; // OpenRouter API key for AI features
  telegramBotToken: string; // Telegram bot token for remote control
  telegramChatId: string; // Telegram chat ID for notifications
};

export const DEFAULT_SETTINGS: ModSettings = {
  aiEnabled: true,
  aiAutoApply: true, // the AI guardian applies punishments automatically
  aiAdminEnabled: true, // autonomous sweep every 15 minutes
  aiModel: "openrouter/free",
  announcement: "",
  announcementActive: false,
  antiCheatEnabled: true,
  disabledQuestions: [],
  siteUrl: "",
  openrouterApiKey: "", // لا مفتاح مشفّر — تُدار المفاتيح من مركز API (نظامان فقط)
  telegramBotToken: "",
  telegramChatId: "",
};

/** Force any stale/broken model name to the working default */
function forceGoodModel(model: string): string {
  if (!model || model === "openrouter/auto" || model.includes(":free") || model.includes("qwen") || model.includes("deepseek") || model.includes("meta-llama") || model.includes("mistralai") || model.includes("google/gemma")) {
    return "openrouter/free";
  }
  return model;
}

export async function getSettingsData(
  ctx: DbCtx,
): Promise<ModSettings> {
  const rows = await ctx.db.query("settings").collect();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const read = <T>(key: keyof ModSettings, fallback: T): T => {
    const raw = map.get(key as string);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };
  // هل النظامان مُفعّلان في مركز API؟ (مؤشر قدرة — لا يُكشف أي مفتاح)
  const apiCenterReady = ["apiSystemA", "apiSystemB"].some((k) => {
    try {
      const raw = map.get(k);
      return raw ? Boolean((JSON.parse(raw) as { apiKey?: string })?.apiKey) : false;
    } catch {
      return false;
    }
  });
  return {
    aiEnabled: read("aiEnabled", DEFAULT_SETTINGS.aiEnabled),
    aiAutoApply: read("aiAutoApply", DEFAULT_SETTINGS.aiAutoApply),
    aiAdminEnabled: read("aiAdminEnabled", DEFAULT_SETTINGS.aiAdminEnabled),
    aiModel: forceGoodModel(read("aiModel", DEFAULT_SETTINGS.aiModel)),
    announcement: read("announcement", DEFAULT_SETTINGS.announcement),
    announcementActive: read("announcementActive", DEFAULT_SETTINGS.announcementActive),
    antiCheatEnabled: read("antiCheatEnabled", DEFAULT_SETTINGS.antiCheatEnabled),
    disabledQuestions: read("disabledQuestions", DEFAULT_SETTINGS.disabledQuestions),
    siteUrl: read("siteUrl", DEFAULT_SETTINGS.siteUrl),
    // مؤشر أن أحد نظامي مركز API مفعّل — المفتاح الحقيقي يُدار في مركز API فقط
    openrouterApiKey: apiCenterReady ? "CONFIGURED-VIA-API-CENTER" : "",
    telegramBotToken: read("telegramBotToken", ""),
    telegramChatId: read("telegramChatId", ""),
  };
}

export async function setSetting(
  ctx: WriteCtx,
  key: string,
  value: unknown,
): Promise<void> {
  // Guard: never save a broken model name
  if (key === "aiModel" && typeof value === "string") {
    value = forceGoodModel(value);
  }
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  const json = JSON.stringify(value);
  if (existing) {
    await ctx.db.patch(existing._id, { value: json });
  } else {
    await ctx.db.insert("settings", { key, value: json });
  }
}

async function logModeration(
  ctx: MutationCtx,
  entry: {
    actorType: "ai" | "owner" | "system";
    actorName: string;
    action: string;
    targetId?: Id<"users">;
    targetName: string;
    reason: string;
    severity: "low" | "medium" | "high";
    gameCode?: string;
  },
): Promise<void> {
  await ctx.db.insert("moderationLogs", {
    actorType: entry.actorType,
    actorName: entry.actorName,
    action: entry.action,
    targetId: entry.targetId,
    targetName: entry.targetName,
    reason: entry.reason,
    severity: entry.severity,
    gameCode: entry.gameCode,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Public info shown on the landing/play pages: announcement + rules count. */
export const getPublicInfo = query({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettingsData(ctx);
    const rulesCount = await ctx.db.query("rules").collect();

    // مركز الإعلانات المركزي: إن وُجد إعلان ظاهر نُفضّله، وإلا نعود للإعلان القديم في الإعدادات.
    const now = Date.now();
    const activeRows = await ctx.db.query("announcements").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const topAnnouncement = activeRows
      .filter((a) => (a.startsAt ?? 0) <= now && (a.expiresAt ?? Infinity) >= now)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    return {
      announcement:
        topAnnouncement?.body?.trim() ||
        (settings.announcementActive ? settings.announcement : ""),
      announcementTitle: topAnnouncement?.title ?? null,
      rulesCount: rulesCount.filter((r) => r.active).length,
    };
  },
});

/** Access level of the signed-in user: owner / staff (admin) / player. */
export const getAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { isOwner: false, isStaff: false, role: null };
    const user = await ctx.db.get(userId);
    return {
      isOwner: isOwnerUser(user),
      isStaff: isStaffUser(user),
      role: user?.role ?? null,
    };
  },
});

export const getOwnerIdStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { active: false, id: null, loginCount: 0, lastLogin: null };
    const user = await ctx.db.get(userId);
    if (!user) return { active: false, id: null, loginCount: 0, lastLogin: null };
    return {
      active: isOwnerUser(user),
      id: user._id.toString().slice(-6).toUpperCase(),
      loginCount: 1,
      lastLogin: null,
    };
  },
});

export type ModLogEntry = {
  id: string;
  actorType: "ai" | "owner" | "system";
  actorName: string;
  action: string;
  targetId: string | null;
  targetName: string;
  reason: string;
  severity: "low" | "medium" | "high";
  gameCode: string | null;
  createdAt: number;
};

export type DashboardAdvisor = {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "off";
  summary: string;
  tab: string;
};

export type DashboardData = {
  userCount: number;
  gameCount: number;
  openReports: number;
  bannedUsers: number;
  totalPunishments: number;
  aiEnabled: boolean;
  aiAutoApply: boolean;
  antiCheatEnabled: boolean;
  recentActivity: ModLogEntry[];
  // ── موجّة 1.1: صحة اللعبة + لوحة المستشارين ──
  healthScore: number; // 0-100
  healthLabel: string;
  healthAlerts: string[];
  advisors: DashboardAdvisor[];
  suggestions: string[];
  aiDecisionsToday: number;
};

export const getDashboard = query({
  args: {},
  handler: async (ctx): Promise<DashboardData | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const [users, games, reports, logs] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("games").collect(),
      ctx.db.query("reports").withIndex("by_status", (q) => q.eq("status", "open")).collect(),
      ctx.db
        .query("moderationLogs")
        .withIndex("by_created", (q) => q.gte("createdAt", 0))
        .order("desc")
        .take(12),
    ]);
    const settings = await getSettingsData(ctx);

    const bannedUsers = users.filter((u) => isUserBanned(u).banned).length;
    const totalPunishments = await ctx.db.query("moderationLogs").collect();

    // ── صحة اللعبة: درجة مركّبة 0-100 من مؤشرات قابلة للقياس ──
    const now = Date.now();
    const openReports = reports.length;
    const banRatio = users.length ? bannedUsers / users.length : 0;
    // مؤشر نشاط المجتمع: متوسط ألعاب لكل لاعب + نشاطات حديثة
    const activitySignal = users.length
      ? Math.min(games.length / Math.max(users.length, 1), 1)
      : 0.4;

    let score = 0;
    score += settings.aiEnabled ? 12 : 0;
    score += settings.aiAutoApply ? 8 : 0;
    score += settings.antiCheatEnabled ? 10 : 0;
    // نشاط مجتمعي (ألعاب لكل لاعب + وجود نشاطات حديثة)
    score += Math.round(30 * Math.min(0.35 + activitySignal * 0.35, 1));
    // بلاغات مفتوحة: خصم تدريجي
    score -= Math.min(openReports * 3, 18);
    // نسبة الحظر: خصم إن تجاوزت حداً صحياً
    if (banRatio > 0.15) score -= 12;
    else if (banRatio > 0.08) score -= 5;
    // عقوبات كثيرة = مجتمع مريض
    if (totalPunishments.length > 200) score -= 6;

    const healthScore = Math.max(0, Math.min(100, score));
    const healthLabel =
      healthScore >= 80 ? "ممتازة" : healthScore >= 60 ? "جيدة" : healthScore >= 40 ? "متوسطة" : "حرجة";

    const healthAlerts: string[] = [];
    if (openReports > 5) healthAlerts.push(`${openReports} بلاغ مفتوح بانتظار المراجعة`);
    if (banRatio > 0.15) healthAlerts.push("نسبة الحظر مرتفعة — راجع سلم العقوبات");
    if (!settings.aiEnabled) healthAlerts.push("الرقابة الذكية متوقفة");
    if (games.length === 0) healthAlerts.push("لا توجد ألعاب بعد — أطلق أول تحدٍّ لجذب الأصدقاء");

    // ── لوحة المستشارين: سطر واحد لكل مساعد يعكس حالته الحقيقية ──
    const advisors: DashboardAdvisor[] = [
      {
        id: "moderation",
        name: "الرقابة الذكية",
        role: "شرطة الميدان",
        status: settings.aiEnabled ? "active" : "off",
        summary: settings.aiEnabled
          ? openReports > 0
            ? `${openReports} بلاغ مفتوح — توصي بالمراجعة`
            : "تراقب الرسائل والسلوك باستمرار"
          : "متوقفة — فعّلها من مركز الذكاء",
        tab: "ai",
      },
      {
        id: "autoadmin",
        name: "المدير الآلي",
        role: "نائب المالك التنفيذي",
        status: settings.aiAdminEnabled ? "active" : "off",
        summary: settings.aiAdminEnabled
          ? "ينفّذ جولة تلقائية كل 15 دقيقة"
          : "متوقف — فعّله من الإدارة الآلية",
        tab: "aiadmin",
      },
      {
        id: "gem",
        name: "حارسة الخزينة جيم",
        role: "راعية العضويات",
        status: "active",
        summary: "تحرس العضويات وتجيب لاعبيك عنها",
        tab: "memberships",
      },
      {
        id: "questions",
        name: "مولّد الأسئلة AI",
        role: "محتوى بلا توقف",
        status: settings.aiEnabled ? "idle" : "off",
        summary: "يولّد أسئلة جديدة تنتظر موافقتك",
        tab: "questions",
      },
    ];

    const suggestions: string[] = [];
    if (openReports > 5) suggestions.push("أغلق البلاغات المفتوحة لرفع درجة الصحة");
    if (!settings.aiEnabled) suggestions.push("فعّل الرقابة الذكية لحماية المجتمع آلياً");
    if (games.length === 0) suggestions.push("أطلق «تحدي اليوم» أو مكافأة موسمية لجذب اللاعبين");
    if (banRatio > 0.15) suggestions.push("راجع قوانين العقوبات — قد تكون العقوبات قاسية على المجتمع");
    if (suggestions.length === 0) suggestions.push("كل شيء تحت السيطرة — واصل الإطلاق، وفكّر في بطولة أسبوعية");

    // عدد قرارات الذكاء اليوم (للشفافية)
    const decisionsToday = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 24 * 60 * 60 * 1000))
      .collect();

    return {
      userCount: users.length,
      gameCount: games.length,
      openReports,
      bannedUsers,
      totalPunishments: totalPunishments.length,
      aiEnabled: settings.aiEnabled,
      aiAutoApply: settings.aiAutoApply,
      antiCheatEnabled: settings.antiCheatEnabled,
      recentActivity: logs.map((l) => ({
        id: l._id,
        actorType: l.actorType,
        actorName: l.actorName,
        action: l.action,
        targetId: l.targetId ?? null,
        targetName: l.targetName,
        reason: l.reason,
        severity: l.severity,
        gameCode: l.gameCode ?? null,
        createdAt: l.createdAt,
      })),
      healthScore,
      healthLabel,
      healthAlerts,
      advisors,
      suggestions,
      aiDecisionsToday: decisionsToday.length,
    };
  },
});

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  role: string | null;
  isOwner: boolean;
  warnings: number;
  mutedUntil: number | null;
  bannedUntil: number | null;
  bannedPermanent: boolean;
  banReason: string | null;
  cheatStrikes: number;
  xp: number;
  level: number;
  gamesPlayed: number;
  gamesWon: number;
  badgeCount: number;
};

export const listUsers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }): Promise<UserRow[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const query = search?.trim().toLowerCase() ?? "";
    const users = await ctx.db.query("users").take(200);
    const profiles = await Promise.all(
      users.map((u) =>
        ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .first(),
      ),
    );

    return users
      .map((u, i) => {
        const p = profiles[i];
        const xp = p?.xp ?? 0;
        return {
          id: u._id,
          name: u.name ?? "لاعب مجهول",
          email: u.email ?? null,
          image: u.image ?? null,
          role: u.role ?? null,
          isOwner: isOwnerUser(u),
          warnings: u.warnings ?? 0,
          mutedUntil: u.mutedUntil ?? null,
          bannedUntil: u.bannedUntil ?? null,
          bannedPermanent: u.bannedPermanent ?? false,
          banReason: u.banReason ?? null,
          cheatStrikes: u.cheatStrikes ?? 0,
          xp,
          level: levelFromXp(xp),
          gamesPlayed: p?.gamesPlayed ?? 0,
          gamesWon: p?.gamesWon ?? 0,
          badgeCount: p?.badges.length ?? 0,
        };
      })
      .filter(
        (u) =>
          query === "" ||
          u.name.toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query),
      );
  },
});

export type ReportRow = {
  id: string;
  reporterName: string;
  reporterReputation: number;
  targetId: string;
  targetName: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "dismissed";
  aiVerdict: {
    compliant: boolean;
    violation: string | null;
    severity: "low" | "medium" | "high";
    suggestedAction: "none" | "warn" | "mute" | "ban";
    suggestedDurationMs: number | null;
    reasoning: string;
  } | null;
  createdAt: number;
};

export const getReports = query({
  args: {},
  handler: async (ctx): Promise<ReportRow[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(60);
    // سمعة المُبلِّغ — تُقرأ من ملف المستخدم المُبلِّغ
    const reporters = await Promise.all(reports.map((r) => ctx.db.get(r.reporterId)));
    return reports.map((r, i) => ({
      id: r._id,
      reporterName: r.reporterName,
      reporterReputation: reporters[i]?.reporterReputation ?? 0,
      targetId: r.targetId,
      targetName: r.targetName,
      reason: r.reason,
      details: r.details ?? null,
      status: r.status,
      aiVerdict: r.aiVerdict
        ? {
            compliant: r.aiVerdict.compliant,
            violation: r.aiVerdict.violation ?? null,
            severity: r.aiVerdict.severity,
            suggestedAction: r.aiVerdict.suggestedAction,
            suggestedDurationMs: r.aiVerdict.suggestedDurationMs ?? null,
            reasoning: r.aiVerdict.reasoning,
          }
        : null,
      createdAt: r.createdAt,
    }));
  },
});

export type RuleRow = {
  id: string;
  title: string;
  category: "essential" | "prohibited" | "punishment";
  description: string;
  severity: "low" | "medium" | "high";
  order: number;
  active: boolean;
};

/** Public rules — the site laws & prohibitions shown on /rules. */
export const getRules = query({
  args: {},
  handler: async (ctx): Promise<RuleRow[]> => {
    const rules = await ctx.db.query("rules").collect();
    return rules
      .filter((r) => r.active)
      .sort((a, b) => a.order - b.order)
      .map((r) => ({
        id: r._id,
        title: r.title,
        category: r.category,
        description: r.description,
        severity: r.severity,
        order: r.order,
        active: r.active,
      }));
  },
});

export type SettingsData = ModSettings & {
  rulesCount: number;
  aiKeyConfigured: boolean;
};

export const getSettings = query({
  args: {},
  handler: async (ctx): Promise<SettingsData | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;
    const settings = await getSettingsData(ctx);
    const rules = await ctx.db.query("rules").collect();
    // النظامان المضبوطان في مركز API (Settings) — وليس أي متغير بيئة قديم
    const sysA = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", "apiSystemA"))
      .first();
    const sysB = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", "apiSystemB"))
      .first();
    return {
      ...settings,
      rulesCount: rules.filter((r) => r.active).length,
      aiKeyConfigured: Boolean(sysA || sysB),
    };
  },
});

/** Reports from the autonomous AI administrator (latest first). */
export const getAdminReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const rows = await ctx.db
      .query("adminReports")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 20, 50));

    return rows.map((r) => ({
      id: r._id,
      summary: r.summary,
      stats: r.stats,
      issues: r.issues,
      createdAt: r.createdAt,
    }));
  },
});

// ---------------------------------------------------------------------------
// APK download health — clients report failed downloads so the auto-admin
// sweep can diagnose & fix them, and the owner sees everything in one panel.
// ---------------------------------------------------------------------------

/**
 * Any player can report a failed APK download. The client sends what it
 * actually received (size/hash) so the owner room & the AI admin can tell
 * exactly why the file was rejected (stale cache, truncated transfer, …).
 */
export const reportDownloadIssue = mutation({
  args: {
    url: v.string(),
    error: v.string(),
    receivedSize: v.optional(v.number()),
    receivedHash: v.optional(v.string()),
    expectedSize: v.optional(v.number()),
    expectedHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false };
    const user = await ctx.db.get(userId);
    if (!user) return { ok: false };

    // Rate-limit: max 5 reports per user per hour.
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = await ctx.db
      .query("downloadReports")
      .withIndex("by_created", (q) => q.gte("createdAt", hourAgo))
      .collect();
    const mine = recent.filter((r) => r.userId === userId).length;
    if (mine >= 5) return { ok: false };

    await ctx.db.insert("downloadReports", {
      userId,
      userName: user.name ?? "لاعب",
      url: args.url.slice(0, 500),
      receivedSize: args.receivedSize,
      receivedHash: args.receivedHash,
      expectedSize: args.expectedSize,
      expectedHash: args.expectedHash,
      error: args.error.slice(0, 300),
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Owner-only view: official APK values + recent failure reports. */
export const getDownloadHealth = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const rows = await ctx.db
      .query("downloadReports")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 15, 50));

    return {
      official: {
        fileName: APK_FILE_NAME,
        sha256: APK_SHA256,
        bytes: APK_BYTES,
        version: CURRENT_VERSION,
        buildId: BUILD_ID,
      },
      reports: rows.map((r) => ({
        id: r._id,
        userName: r.userName,
        url: r.url,
        receivedSize: r.receivedSize ?? null,
        receivedHash: r.receivedHash ?? null,
        expectedSize: r.expectedSize ?? null,
        expectedHash: r.expectedHash ?? null,
        error: r.error,
        userAgent: r.userAgent ?? null,
        createdAt: r.createdAt,
      })),
    };
  },
});

export const getModerationLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<ModLogEntry[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const logs = await ctx.db
      .query("moderationLogs")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
    return logs.map((l) => ({
      id: l._id,
      actorType: l.actorType,
      actorName: l.actorName,
      action: l.action,
      targetId: l.targetId ?? null,
      targetName: l.targetName,
      reason: l.reason,
      severity: l.severity,
      gameCode: l.gameCode ?? null,
      createdAt: l.createdAt,
    }));
  },
});

export type LiveGame = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  phase: "countdown" | "answering" | "revealing";
  hostName: string;
  hostId: string;
  playerCount: number;
  players: { id: string; name: string }[];
  questionCount: number;
  currentQuestionIndex: number;
  createdAt: number;
};

export const getLiveGames = query({
  args: {},
  handler: async (ctx): Promise<LiveGame[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const games = await ctx.db.query("games").collect();
    const rows: LiveGame[] = [];
    for (const g of games) {
      if (g.status === "finished") continue;
      const host = await ctx.db.get(g.hostId);
      const players = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q) => q.eq("gameId", g._id))
        .collect();
      rows.push({
        id: g._id,
        code: g.code,
        status: g.status,
        phase: g.phase,
        hostName: host?.name ?? "مجهول",
        hostId: g.hostId,
        playerCount: players.length,
        players: players.map((p) => ({ id: p.userId, name: p.name })),
        questionCount: g.questionIds.length,
        currentQuestionIndex: g.currentQuestionIndex,
        createdAt: g.createdAt,
      });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** جولة منتهية (من أرشيف gameHistory الدائم — لا يُحذف مع تنظيف الغرف). */
export type FinishedGameRow = {
  id: string;
  code: string;
  playerCount: number;
  questionCount: number;
  playedAt: number;
  players: {
    name: string;
    score: number;
    rank: number;
    correctCount: number;
    won: boolean;
    xpEarned: number;
  }[];
};

/** أرشيف الجولات المنتهية — لكل جولة النتائج النهائية وترتيب اللاعبين. */
export const getFinishedGames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<FinishedGameRow[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const games = await ctx.db.query("games").collect();
    const finished = games.filter((g) => g.status === "finished");
    const rows: FinishedGameRow[] = [];

    for (const g of finished) {
      const history = await ctx.db
        .query("gameHistory")
        .withIndex("by_game", (q) => q.eq("gameId", g._id))
        .collect();
      if (history.length === 0) continue; // لا أرشيف بعد (جولة لم تُسجَّل نتائجها)

      const players = await Promise.all(
        history.map(async (h) => {
          const u = await ctx.db.get(h.userId);
          return {
            name: u?.name ?? "لاعب",
            score: h.score,
            rank: h.rank,
            correctCount: h.correctCount,
            won: h.won,
            xpEarned: h.xpEarned,
          };
        }),
      );
      rows.push({
        id: g._id,
        code: g.code,
        playerCount: history.length,
        questionCount: g.questionIds.length,
        playedAt: Math.max(...history.map((h) => h.playedAt)),
        players: players.sort((a, b) => a.rank - b.rank),
      });
    }

    rows.sort((a, b) => b.playedAt - a.playedAt);
    return rows.slice(0, limit ?? 20);
  },
});

export type QuestionRow = {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  disabled: boolean;
};

export const getQuestionBank = query({
  args: {},
  handler: async (ctx): Promise<QuestionRow[] | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;

    const settings = await getSettingsData(ctx);
    const disabled = new Set(settings.disabledQuestions);
    return QUESTION_BANK.map((q) => ({
      id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      question: q.question,
      disabled: disabled.has(q.id),
    }));
  },
});

/** The signed-in player's discipline status (warnings / mute / ban). */
export const getMyDiscipline = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      warnings: user.warnings ?? 0,
      mutedUntil: user.mutedUntil ?? null,
      bannedUntil: user.bannedUntil ?? null,
      bannedPermanent: user.bannedPermanent ?? false,
      banReason: user.banReason ?? null,
      cheatStrikes: user.cheatStrikes ?? 0,
      isOwner: isOwnerUser(user),
      isStaff: isStaffUser(user),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations — user management & punishments
// ---------------------------------------------------------------------------

/** Grant or revoke the moderator (admin) permission. Owner only. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user")) },
  handler: async (ctx, { userId, role }) => {
    const actor = await requireOwner(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("المستخدم غير موجود");
    if (isOwnerUser(target)) throw new Error("لا يمكن تغيير صلاحية المالك");

    await ctx.db.patch(userId, { role });
    await logModeration(ctx, {
      actorType: "owner",
      actorName: actor.name ?? "المالك",
      action: role === "admin" ? "grant_admin" : "revoke_admin",
      targetId: userId,
      targetName: target.name ?? "مجهول",
      reason: role === "admin" ? "منح صلاحية مشرف" : "سحب صلاحية المشرف",
      severity: "low",
    });
  },
});

/**
 * Apply a punishment manually (owner or admin):
 *  warn → formal warning, mute → temp mute, ban → temp or permanent ban.
 */
export const applyPunishment = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("warn"), v.literal("mute"), v.literal("ban")),
    durationMs: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, { userId, type, durationMs, reason }) => {
    const actor = await requireStaff(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("المستخدم غير موجود");
    if (isOwnerUser(target)) throw new Error("لا يمكن معاقبة المالك");

    const now = Date.now();
    if (type === "warn") {
      await ctx.db.patch(userId, {
        warnings: (target.warnings ?? 0) + 1,
        lastWarningAt: now,
      });
      await logModeration(ctx, {
        actorType: "owner",
        actorName: actor.name ?? "الإدارة",
        action: "warn",
        targetId: userId,
        targetName: target.name ?? "مجهول",
        reason,
        severity: "low",
      });
    } else if (type === "mute") {
      const ms = Math.min(durationMs ?? 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000);
      await ctx.db.patch(userId, { mutedUntil: now + ms });
      await logModeration(ctx, {
        actorType: "owner",
        actorName: actor.name ?? "الإدارة",
        action: "mute",
        targetId: userId,
        targetName: target.name ?? "مجهول",
        reason,
        severity: "medium",
      });
    } else {
      const permanent = durationMs == null || durationMs <= 0;
      await ctx.db.patch(userId, {
        bannedUntil: permanent ? undefined : now + durationMs,
        bannedPermanent: permanent || undefined,
        banReason: reason,
      });
      await logModeration(ctx, {
        actorType: "owner",
        actorName: actor.name ?? "الإدارة",
        action: permanent ? "ban_permanent" : "ban",
        targetId: userId,
        targetName: target.name ?? "مجهول",
        reason,
        severity: "high",
      });
    }
  },
});

/** Lift a user's punishments (warnings, mute, ban). */
export const pardonUser = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, { userId, reason }) => {
    const actor = await requireStaff(ctx);
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("المستخدم غير موجود");

    await ctx.db.patch(userId, {
      warnings: 0,
      mutedUntil: undefined,
      bannedUntil: undefined,
      bannedPermanent: undefined,
      banReason: undefined,
      cheatStrikes: 0,
    });
    await logModeration(ctx, {
      actorType: "owner",
      actorName: actor.name ?? "الإدارة",
      action: "pardon",
      targetId: userId,
      targetName: target.name ?? "مجهول",
      reason,
      severity: "low",
    });
  },
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Any signed-in player can report another player for breaking the laws. */
export const submitReport = mutation({
  args: {
    targetId: v.id("users"),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { targetId, reason, details }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    if (userId === targetId) throw new Error("لا يمكنك الإبلاغ عن نفسك");

    const me = await ctx.db.get(userId);
    const target = await ctx.db.get(targetId);
    if (!target) throw new Error("اللاعب غير موجود");

    const reportId = await ctx.db.insert("reports", {
      reporterId: userId,
      reporterName: me?.name ?? "لاعب",
      targetId,
      targetName: target.name ?? "لاعب",
      reason,
      details: details ?? undefined,
      status: "open",
      createdAt: Date.now(),
    });

    // If AI moderation is on, schedule an automatic review.
    const settings = await getSettingsData(ctx);
    if (settings.aiEnabled) {
      await ctx.scheduler.runAfter(0, internal.moderation.handleReport, { reportId });
    }
    return { ok: true };
  },
});

/** Owner/admin marks a report as reviewed (action taken) or dismissed. */
export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { reportId, status, note }) => {
    const actor = await requireStaff(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("البلاغ غير موجود");
    await ctx.db.patch(reportId, { status });
    if (note) {
      await logModeration(ctx, {
        actorType: "owner",
        actorName: actor.name ?? "الإدارة",
        action: status === "reviewed" ? "report_reviewed" : "report_dismissed",
        targetId: report.targetId,
        targetName: report.targetName,
        reason: note,
        severity: status === "reviewed" ? "medium" : "low",
      });
    }

    // ── نظام سمعة المُبلِّغ: بلاغ صحيح يرفع السمعة، كيدي يخفضها ──
    const reporter = await ctx.db.get(report.reporterId);
    if (reporter) {
      if (status === "reviewed") {
        await ctx.db.patch(report.reporterId, {
          reporterReputation: Math.min((reporter.reporterReputation ?? 0) + 1, 100),
          validReports: (reporter.validReports ?? 0) + 1,
        });
      } else if (status === "dismissed") {
        await ctx.db.patch(report.reporterId, {
          reporterReputation: Math.max((reporter.reporterReputation ?? 0) - 2, -100),
          invalidReports: (reporter.invalidReports ?? 0) + 1,
        });
      }
    }

    // سجلّ القرار الموحّد (مجلس العقول)
    await ctx.db.insert("aiDecisionLog", {
      system: "reports",
      actorName: actor.name ?? "الإدارة",
      action: status === "reviewed" ? "report_valid" : "report_dismissed",
      targetId: report.reporterId,
      targetName: report.reporterName,
      detail:
        status === "reviewed"
          ? `بلاغ صحيح: ${report.reason}`
          : `بلاغ غير صحيح على ${report.targetName}: ${report.reason}`,
      severity: status === "reviewed" ? "medium" : "low",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Rules (the site laws)
// ---------------------------------------------------------------------------

/** Seed the built-in laws if the rules table is empty (owner only). */
export const seedDefaultRules = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const existing = await ctx.db.query("rules").collect();
    if (existing.length > 0) {
      throw new Error("القوانين موجودة بالفعل");
    }
    for (const rule of DEFAULT_RULES) {
      await ctx.db.insert("rules", rule);
    }
  },
});

export const saveRule = mutation({
  args: {
    id: v.optional(v.id("rules")),
    title: v.string(),
    category: v.union(
      v.literal("essential"),
      v.literal("prohibited"),
      v.literal("punishment"),
    ),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("القانون غير موجود");
      await ctx.db.patch(args.id, {
        title: args.title,
        category: args.category,
        description: args.description,
        severity: args.severity,
        order: args.order,
        active: true,
      });
    } else {
      await ctx.db.insert("rules", { ...args, active: true });
    }
  },
});

export const deleteRule = mutation({
  args: { id: v.id("rules") },
  handler: async (ctx, { id }) => {
    await requireOwner(ctx);
    await ctx.db.delete(id);
  },
});

// ---------------------------------------------------------------------------
// Owner settings (AI moderation, announcement, anti-cheat, question bank)
// ---------------------------------------------------------------------------

export const updateSettings = mutation({
  args: {
    aiEnabled: v.optional(v.boolean()),
    aiAutoApply: v.optional(v.boolean()),
    aiAdminEnabled: v.optional(v.boolean()),
    aiModel: v.optional(v.string()),
    announcement: v.optional(v.string()),
    announcementActive: v.optional(v.boolean()),
    antiCheatEnabled: v.optional(v.boolean()),
    disabledQuestions: v.optional(v.array(v.string())),
    siteUrl: v.optional(v.string()),
    openrouterApiKey: v.optional(v.string()),
    telegramBotToken: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
    aiModelVersion: v.optional(v.string()),
    aiLastHealthCheck: v.optional(v.number()),
    aiTotalFixes: v.optional(v.number()),
  },
  handler: async (ctx, patch) => {
    await requireOwner(ctx);
    const current = await getSettingsData(ctx);
    const next: ModSettings = { ...current, ...patch };
    await Promise.all(
      (Object.keys(next) as (keyof ModSettings)[]).map((key) =>
        setSetting(ctx, key as string, next[key]),
      ),
    );
  },
});

/** Toggle a question on/off in the live bank (owner only). */
export const toggleQuestion = mutation({
  args: { questionId: v.string() },
  handler: async (ctx, { questionId }) => {
    await requireOwner(ctx);
    const settings = await getSettingsData(ctx);
    const set = new Set(settings.disabledQuestions);
    if (set.has(questionId)) set.delete(questionId);
    else set.add(questionId);
    await setSetting(ctx, "disabledQuestions", [...set]);
  },
});

// ---------------------------------------------------------------------------
// Live game control (owner only)
// ---------------------------------------------------------------------------

/** Force-abort a live game: everyone gets their earned XP and it finalizes. */
export const abortGame = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await requireOwner(ctx);
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!game) throw new Error("الغرفة غير موجودة");
    if (game.status === "finished") throw new Error("الغرفة انتهت بالفعل");

    await ctx.db.patch(game._id, { status: "finished" });
    await ctx.scheduler.runAfter(0, internal.games.finishGame, { gameId: game._id });
  },
});

/** Kick a player from a room (waiting: removed; playing: score zeroed). */
export const kickPlayer = mutation({
  args: { code: v.string(), userId: v.id("users") },
  handler: async (ctx, { code, userId }) => {
    const actor = await requireOwner(ctx);
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!game) throw new Error("الغرفة غير موجودة");

    const player = await ctx.db
      .query("gamePlayers")
      .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", game._id))
      .first();
    if (!player) throw new Error("اللاعب ليس في هذه الغرفة");
    if (game.hostId === userId) throw new Error("لا يمكن طرد المالك");

    if (game.status === "waiting") {
      await ctx.db.delete(player._id);
    } else {
      await ctx.db.patch(player._id, {
        score: 0,
        answers: Array.from({ length: game.questionIds.length }, () => null),
      });
    }
    const target = await ctx.db.get(userId);
    await logModeration(ctx, {
      actorType: "owner",
      actorName: actor.name ?? "المالك",
      action: "kick",
      targetId: userId,
      targetName: target?.name ?? "لاعب",
      reason: `طرد من غرفة ${game.code}`,
      severity: "medium",
      gameCode: game.code,
    });
  },
});

// ---------------------------------------------------------------------------
// Automatic anti-cheat: leaving the game window during a question is treated
// as using the internet to look up answers → automatic escalating punishments.
// ---------------------------------------------------------------------------

export const recordCheat = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const settings = await getSettingsData(ctx);
    if (!settings.antiCheatEnabled) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    if (isUserBanned(user).banned) return null;

    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!game || game.status !== "playing" || game.phase !== "answering") return null;

    const player = await ctx.db
      .query("gamePlayers")
      .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("gameId", game._id))
      .first();
    if (!player) return null;
    if (player.answers[game.currentQuestionIndex]) return null; // already answered

    const strike = (user.cheatStrikes ?? 0) + 1;
    const name = user.name ?? "لاعب";
    const now = Date.now();
    await ctx.db.patch(userId, { cheatStrikes: strike });

    // Escalating ladder:
    // 1st → warning, 2nd → score penalty, 3rd → forfeit + 24h ban,
    // 4th → 7-day ban, 5th+ → permanent ban.
    if (strike === 1) {
      await ctx.db.patch(userId, {
        warnings: (user.warnings ?? 0) + 1,
        lastWarningAt: now,
      });
      await logModeration(ctx, {
        actorType: "system",
        actorName: "الرقيب الآلي",
        action: "cheat_warn",
        targetId: userId,
        targetName: name,
        reason: "مغادرة نافذة اللعب أثناء سؤال (اشتباه بحث عن الإجابة)",
        severity: "low",
        gameCode: game.code,
      });
      return { strike, action: "warn" as const, message: "تحذير تلقائي: غادرت نافذة اللعب أثناء السؤال." };
    }

    if (strike === 2) {
      await ctx.db.patch(player._id, {
        score: Math.max(0, player.score - CHEAT_PENALTY_POINTS),
      });
      await logModeration(ctx, {
        actorType: "system",
        actorName: "الرقيب الآلي",
        action: "cheat_penalty",
        targetId: userId,
        targetName: name,
        reason: `خصم ${CHEAT_PENALTY_POINTS} نقطة — مغادرة نافذة اللعب أثناء سؤال`,
        severity: "medium",
        gameCode: game.code,
      });
      return {
        strike,
        action: "penalty" as const,
        message: `عقوبة تلقائية: خصم ${CHEAT_PENALTY_POINTS} نقطة من نتيجتك.`,
      };
    }

    if (strike === 3) {
      await ctx.db.patch(player._id, {
        score: 0,
        answers: Array.from({ length: game.questionIds.length }, () => null),
      });
      await ctx.db.patch(userId, {
        bannedUntil: now + CHEAT_BAN_MS,
        banReason: "غش متكرر — الخروج من النافذة أثناء الأسئلة",
      });
      await logModeration(ctx, {
        actorType: "system",
        actorName: "الرقيب الآلي",
        action: "cheat_ban",
        targetId: userId,
        targetName: name,
        reason: "حظر 24 ساعة وإلغاء نتيجة الجولة — غش متكرر",
        severity: "high",
        gameCode: game.code,
      });
      return {
        strike,
        action: "ban" as const,
        message: "عقوبة تلقائية: إلغاء نتيجتك وحظر حسابك 24 ساعة (غش متكرر).",
      };
    }

    if (strike === 4) {
      await ctx.db.patch(userId, {
        bannedUntil: now + 7 * 24 * 60 * 60 * 1000,
        banReason: "غش متكرر — الخروج من النافذة أثناء الأسئلة",
      });
      await logModeration(ctx, {
        actorType: "system",
        actorName: "الرقيب الآلي",
        action: "cheat_ban",
        targetId: userId,
        targetName: name,
        reason: "حظر 7 أيام — غش متكرر",
        severity: "high",
        gameCode: game.code,
      });
      return {
        strike,
        action: "ban" as const,
        message: "عقوبة تلقائية: حظر حسابك 7 أيام (غش متكرر).",
      };
    }

    await ctx.db.patch(userId, { bannedPermanent: true, banReason: "غش متكرر جداً" });
    await logModeration(ctx, {
      actorType: "system",
      actorName: "الرقيب الآلي",
      action: "cheat_ban_permanent",
      targetId: userId,
      targetName: name,
      reason: "حظر دائم — غش متكرر جداً",
      severity: "high",
      gameCode: game.code,
    });
    return {
      strike,
      action: "ban_permanent" as const,
      message: "عقوبة تلقائية: حظر دائم بسبب الغش المتكرر.",
    };
  },
});

// ---------------------------------------------------------------------------
// Client error reporting — تُلتقط أخطاء المتصفح/التطبيق تلقائياً وتصل إلى
// غرفة المالك، فلا يتكرر أي خطأ غامض (شاشة بيضاء/تعطل) دون أثر يمكن رؤيته.

/** A public, deduped sink for client-side runtime errors (fire-and-forget). */
export const reportClientError = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    url: v.optional(v.string()),
    route: v.optional(v.string()),
  },
  handler: async (ctx, { message, stack, url, route }) => {
    const clean = message.trim().slice(0, 500);
    if (!clean) return;
    const key = `${clean.slice(0, 200)}|${(stack ?? "").slice(0, 150)}`;
    const now = Date.now();
    const existing = await ctx.db
      .query("clientErrors")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: Math.min((existing.count ?? 1) + 1, 1000),
        lastSeen: now,
        stack: stack?.slice(0, 2000) ?? existing.stack,
        url: url?.slice(0, 500) ?? existing.url,
        route: route?.slice(0, 200) ?? existing.route,
      });
    } else {
      await ctx.db.insert("clientErrors", {
        key,
        message: clean,
        stack: stack?.slice(0, 2000),
        url: url?.slice(0, 500),
        route: route?.slice(0, 200),
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }
  },
});

/** Recent client errors, newest first — owner/admin only. */
export const listClientErrors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await ctx.db.get(userId);
    if (!isStaffUser(me)) return null;
    return await ctx.db
      .query("clientErrors")
      .withIndex("by_last", (q) => q.gte("lastSeen", 0))
      .order("desc")
      .take(20);
  },
});
