/**
 * ═══════════════════════════════════════════════════════════════════════
 * مركز التقدم — منطق مشترك نقي (خادم + عميل + اختبارات)
 * ═══════════════════════════════════════════════════════════════════════
 * كل التعريفات والحسابات هنا نقية (بدون I/O) حتى يمكن اختبارها
 * ومشاركتها بين Convex وواجهة اللاعب وملفات الاختبار بأمان.
 */

// ─── أدوات التاريخ ───────────────────────────────────────────────────────

/** مفتاح اليوم: YYYY-MM-DD (UTC). */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** مفتاح الأسبوع: سنة + رقم الأسبوع (ISO). */
export function weekKey(ts: number): string {
  const date = new Date(ts);
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** بداية اليوم (بالمللي ثانية) لمفتاح يوم. */
export function startOfDayTs(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getTime();
}

// ─── أنواع البيانات المشتركة ─────────────────────────────────────────────

export type QuestKind = "daily" | "weekly";

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardXp: number;
}

/** البيانات التي نحتاجها لحساب تقدم المهمة من سجلات اللعب الحقيقية. */
export interface QuestInput {
  gamesToday: number;
  winsToday: number;
  correctToday: number;
  dailyChallengeDoneToday: boolean;
  games7d: number;
  wins7d: number;
  correct7d: number;
  xp7d: number;
  perfectGame7d: boolean;
}

// ─── المهام اليومية (4) ───────────────────────────────────────────────────

export const DAILY_QUESTS: QuestDef[] = [
  { id: "d_play", title: "لاعب نشط", description: "العب جولة واحدة اليوم", icon: "🎮", target: 1, rewardXp: 30 },
  { id: "d_correct", title: "دقة عالية", description: "أجب عن 8 أسئلة بشكل صحيح اليوم", icon: "🎯", target: 8, rewardXp: 40 },
  { id: "d_win", title: "انتصار اليوم", description: "اربح جولة واحدة اليوم", icon: "🏆", target: 1, rewardXp: 35 },
  { id: "d_challenge", title: "تحدي اليوم", description: "أكمل تحدي اليوم (الأسئلة اليومية)", icon: "📅", target: 1, rewardXp: 25 },
];

// ─── المهام الأسبوعية (4) ─────────────────────────────────────────────────

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: "w_games", title: "مدمن تحدي", description: "العب 5 جولات هذا الأسبوع", icon: "⚔️", target: 5, rewardXp: 80 },
  { id: "w_wins", title: "سيد الحلبة", description: "اربح 3 جولات هذا الأسبوع", icon: "👑", target: 3, rewardXp: 100 },
  { id: "w_xp", title: "جامع الخبرة", description: "اجمع 300 نقطة خبرة هذا الأسبوع", icon: "⚡", target: 300, rewardXp: 120 },
  { id: "w_perfect", title: "الكمال", description: "أنهِ جولة بلا أي خطأ هذا الأسبوع", icon: "💯", target: 1, rewardXp: 90 },
];

// ─── المعالم (XP) ─────────────────────────────────────────────────────────

export interface MilestoneDef {
  id: string;
  xp: number;
  rewardXp: number;
  title: string;
  icon: string;
}

export const MILESTONES: MilestoneDef[] = [
  { id: "m_500", xp: 500, rewardXp: 40, title: "بداية الطريق", icon: "🌱" },
  { id: "m_1000", xp: 1_000, rewardXp: 60, title: "ألف نقطة", icon: "🌟" },
  { id: "m_2500", xp: 2_500, rewardXp: 100, title: "عقل متقد", icon: "🔥" },
  { id: "m_5000", xp: 5_000, rewardXp: 150, title: "خماسي الآلاف", icon: "💎" },
  { id: "m_10000", xp: 10_000, rewardXp: 250, title: "عشرة آلاف", icon: "👑" },
  { id: "m_25000", xp: 25_000, rewardXp: 400, title: "أسطورة صاعدة", icon: "🚀" },
  { id: "m_50000", xp: 50_000, rewardXp: 600, title: "نصف مئة ألف", icon: "🏆" },
  { id: "m_100000", xp: 100_000, rewardXp: 1000, title: "مئة ألف", icon: "💠" },
  { id: "m_250000", xp: 250_000, rewardXp: 2000, title: "ربع مليون", icon: "🌌" },
  { id: "m_500000", xp: 500_000, rewardXp: 3500, title: "نصف مليون", icon: "🪐" },
  { id: "m_1000000", xp: 1_000_000, rewardXp: 5000, title: "المليون", icon: "♾️" },
];

// ─── الألقاب (12) ─────────────────────────────────────────────────────────

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const TITLES: TitleDef[] = [
  { id: "t_rookie", name: "وافد جديد", description: "العب أول جولة لك", icon: "🐣", rarity: "common" },
  { id: "t_winner", name: "أول فوز", description: "اربح أول جولة", icon: "🥉", rarity: "common" },
  { id: "t_ten_games", name: "عشر معارك", description: "العب 10 جولات", icon: "⚔️", rarity: "common" },
  { id: "t_accurate", name: "عين ثاقبة", description: "حقّق دقة 70% أو أكثر", icon: "🎯", rarity: "rare" },
  { id: "t_sharp", name: "سلسلة حادة", description: "حقّق سلسلة 5 إجابات صحيحة", icon: "🔥", rarity: "rare" },
  { id: "t_fast", name: "برق", description: "أجب صحيحاً خلال 3 ثوانٍ", icon: "⚡", rarity: "rare" },
  { id: "t_scholar", name: "موسوعة", description: "أجب صحيحاً عن 100 سؤال", icon: "📚", rarity: "epic" },
  { id: "t_level10", name: "عبقري ناشئ", description: "صل إلى المستوى 10", icon: "💡", rarity: "epic" },
  { id: "t_perfect", name: "كامل", description: "أنهِ جولة بلا أي خطأ", icon: "💯", rarity: "epic" },
  { id: "t_daily7", name: "مواظب", description: "سلسلة يومية من 7 أيام", icon: "🗓️", rarity: "epic" },
  { id: "t_level25", name: "حكيم", description: "صل إلى المستوى 25", icon: "🧙", rarity: "legendary" },
  { id: "t_legend", name: "أسطورة", description: "صل إلى المستوى 50", icon: "👑", rarity: "legendary" },
];

export const TITLE_RARITY_LABEL: Record<TitleDef["rarity"], string> = {
  common: "عادي",
  rare: "نادر",
  epic: "ملحمي",
  legendary: "أسطوري",
};

/** بيانات اللاعب المطلوبة لفحص شروط الألقاب. */
export interface TitleCheckInput {
  gamesPlayed: number;
  gamesWon: number;
  accuracy: number; // 0-100
  bestStreak: number;
  fastestAnswerMs: number | null;
  correctAnswers: number;
  level: number;
  perfectGames: number;
  dailyStreak: number;
}

/** هل اللقب مفتوح؟ */
export function isTitleUnlocked(titleId: string, s: TitleCheckInput): boolean {
  switch (titleId) {
    case "t_rookie": return s.gamesPlayed >= 1;
    case "t_winner": return s.gamesWon >= 1;
    case "t_ten_games": return s.gamesPlayed >= 10;
    case "t_accurate": return s.accuracy >= 70;
    case "t_sharp": return s.bestStreak >= 5;
    case "t_fast": return s.fastestAnswerMs != null && s.fastestAnswerMs <= 3000;
    case "t_scholar": return s.correctAnswers >= 100;
    case "t_level10": return s.level >= 10;
    case "t_perfect": return s.perfectGames >= 1;
    case "t_daily7": return s.dailyStreak >= 7;
    case "t_level25": return s.level >= 25;
    case "t_legend": return s.level >= 50;
    default: return false;
  }
}

// ─── حساب تقدم المهام ─────────────────────────────────────────────────────

export interface QuestProgress {
  quest: QuestDef;
  progress: number;
  completed: boolean;
}

/** تقدم المهام اليومية من بيانات حقيقية. */
export function computeDailyQuestProgress(input: QuestInput): QuestProgress[] {
  const values: Record<string, number> = {
    d_play: input.gamesToday,
    d_correct: Math.min(input.correctToday, DAILY_QUESTS[1].target),
    d_win: input.winsToday,
    d_challenge: input.dailyChallengeDoneToday ? 1 : 0,
  };
  return DAILY_QUESTS.map((quest) => {
    const progress = Math.min(values[quest.id] ?? 0, quest.target);
    return { quest, progress, completed: progress >= quest.target };
  });
}

/** تقدم المهام الأسبوعية من بيانات حقيقية. */
export function computeWeeklyQuestProgress(input: QuestInput): QuestProgress[] {
  const values: Record<string, number> = {
    w_games: input.games7d,
    w_wins: input.wins7d,
    w_xp: Math.min(input.xp7d, WEEKLY_QUESTS[2].target),
    w_perfect: input.perfectGame7d ? 1 : 0,
  };
  return WEEKLY_QUESTS.map((quest) => {
    const progress = Math.min(values[quest.id] ?? 0, quest.target);
    return { quest, progress, completed: progress >= quest.target };
  });
}

/** المعالم القابلة للمطالبة (وصلت لـ XP لكن لم تُستلم بعد). */
export function claimableMilestones(totalXp: number, claimedIds: Set<string>): MilestoneDef[] {
  return MILESTONES.filter((m) => totalXp >= m.xp && !claimedIds.has(m.id));
}

// ─── أكواد الدعوة ─────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** توليد كود دعوة من اسم اللاعب (8 أحرف). */
export function generateReferralCode(name: string): string {
  const base = (name || "PLAYER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  let code = (base || "GAME").padEnd(4, "X").slice(0, 4);
  const now = Date.now().toString(36).toUpperCase();
  for (let i = 0; i < 4; i++) {
    const seed = now.charCodeAt(i % now.length) + i * 7;
    code += CODE_ALPHABET[seed % CODE_ALPHABET.length];
  }
  return code;
}

/** تطبيع كود الإدخال: حروف كبيرة + بدون مسافات. */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** مكافآت الدعوة. */
export const REFERRAL_REWARD_INVITER_XP = 40;
export const REFERRAL_REWARD_REDEEMER_XP = 25;

// ─── إعدادات اللاعب ───────────────────────────────────────────────────────

export type MotionLevel = "full" | "reduced" | "off";
export type ThemePreference = "system" | "light" | "dark";

export interface PlayerSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  motionLevel: MotionLevel;
  notificationsEnabled: boolean;
  theme: ThemePreference;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  soundEnabled: true,
  musicEnabled: true,
  motionLevel: "full",
  notificationsEnabled: true,
  theme: "system",
};