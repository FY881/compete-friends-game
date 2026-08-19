/** Default number of questions per round. */
export const QUESTION_COUNT = 5;

/** Available question-count options for the host. */
export const QUESTION_COUNT_OPTIONS = [3, 5, 7, 10] as const;

/** Answer window in milliseconds (15 seconds default). */
export const ANSWER_MS = 15_000;

/** 3-2-1 countdown before the first question. */
export const COUNTDOWN_MS = 3_000;

/** Available time-per-question options (ms). */
export const TIME_OPTIONS = [5_000, 10_000, 15_000, 20_000, 30_000] as const;

/** Number of lifelines (50/50 + second chance) available per game. */
// AI Hint configuration
export const AI_HINTS_PER_GAME = 1; // each player gets 1 AI hint per game
export const AI_HINT_TIMEOUT_MS = 10000; // 10 seconds to read the hint

export const LIFELINES_PER_GAME = 1;

/** Format a millisecond duration into an Arabic-friendly label. */
export function formatTimeOption(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} ثانية`;
  const min = sec / 60;
  return `${min} ${min === 1 ? "دقيقة" : "دقائق"}`;
}


// Game Modes (15+)
export const GAME_MODES = {
  CLASSIC: 'classic',        // Original quiz mode
  SPEED: 'speed',            // Faster questions, less time
  SURVIVAL: 'survival',      // 3 lives, no second chances
  TOURNAMENT: 'tournament',  // Bracket-style elimination
  TEAM: 'team',              // 2v2 or 3v3 team play
  DAILY: 'daily',            // Daily challenge mode
  ENDLESS: 'endless',        // Keep going until wrong
  RANKED: 'ranked',          // Competitive ranking mode
  PRACTICE: 'practice',      // No scoring, learn mode
  BLITZ: 'blitz',            // 60-second rapid fire
  EXPERT: 'expert',          // Hard questions only
  MIXED: 'mixed',            // Random difficulty mix
  THEMED: 'themed',          // Single category focus
  HEAD_TO_HEAD: 'h2h',       // 1v1 duel mode
  BATTLE_ROYALE: 'br',       // Last player standing
} as const;


// XP System (5 levels)
export const XP_SYSTEM = {
  LEVEL_1: { xp: 0, title: 'مبتدئ', badge: '🌟' },
  LEVEL_2: { xp: 500, title: 'متوسط', badge: '⚡' },
  LEVEL_3: { xp: 1500, title: 'متقدم', badge: '🔥' },
  LEVEL_4: { xp: 5000, title: 'خبير', badge: '💎' },
  LEVEL_5: { xp: 15000, title: 'أسطوري', badge: '👑' },
} as const;


// Achievement System (25+)
export const ACHIEVEMENTS = [
  { id: 'first_win', name: 'أول فوز', desc: 'فاز في أول مباراة', icon: '🏆' },
  { id: 'streak_5', name: 'سلسلة 5', desc: '5 إجابات صحيحة متتالية', icon: '🔥' },
  { id: 'streak_10', name: 'سلسلة 10', desc: '10 إجابات صحيحة متتالية', icon: '⚡' },
  { id: 'streak_25', name: 'سلسلة 25', desc: '25 إجابة صحيحة متتالية', icon: '💎' },
  { id: 'speed_demon', name: 'شيطان السرعة', desc: 'أجاب في أقل من 3 ثوانٍ', icon: '💨' },
  { id: 'perfectionist', name: 'المثالي', desc: 'أجاب صحيح على جميع الأسئلة', icon: '✨' },
  { id: 'daily_7', name: 'أسبوعي', desc: 'لعب 7 أيام متتالية', icon: '📅' },
  { id: 'daily_30', name: 'شهري', desc: 'لعب 30 يوم', icon: '🗓️' },
  { id: 'social_butterfly', name: 'فراشة اجتماعية', desc: 'لعب مع 10 أصدقاء', icon: '🦋' },
  { id: 'knowledge_king', name: 'ملك المعرفة', desc: 'أجاب على 100 سؤال', icon: '👑' },
  { id: 'category_master', name: 'خبير الفئات', desc: 'أجاب في 10 فئات مختلفة', icon: '📚' },
  { id: 'ai_whisperer', name: 'خبير AI', desc: 'استخدم 50 تلميح AI', icon: '🤖' },
  { id: 'lucky_guess', name: 'خمن المحظوظ', desc: 'خمن الإجابة الصحيحة 5 مرات', icon: '🍀' },
  { id: 'comeback_king', name: 'ملك العودة', desc: 'فاز بعد التأخر', icon: '🔄' },
  { id: 'night_owl', name: 'بومة الليل', desc: 'لعب بعد منتصف الليل', icon: '🦉' },
  { id: 'early_bird', name: 'بكر الصباح', desc: 'لعب قبل 7 صباحاً', icon: '🐦' },
  { id: 'weekend_warrior', name: 'محارب عطلة', desc: 'لعب في عطلة نهاية الأسبوع', icon: '⚔️' },
  { id: 'marathon', name: 'ماراثون', desc: 'لعب 5 مباريات متتالية', icon: '🏃' },
  { id: 'perfect_streak', name: 'سلسلة مثالية', desc: 'أجاب على 20 سؤال متتالي بدون خطأ', icon: '💯' },
  { id: 'first_to_answer', name: 'الأسرع', desc: 'كان أول من يجيب 5 مرات', icon: '🥇' },
  { id: 'double_trouble', name: 'ضعف المشاكل', desc: 'فاز في مباراتين في يوم واحد', icon: '✌️' },
  { id: 'golden_touch', name: 'اللمسة الذهبية', desc: 'أجاب على سؤال ذهبي', icon: '✨' },
  { id: 'lifeline_master', name: 'خبير المساعدات', desc: 'استخدم جميع المساعدات', icon: '🛡️' },
  { id: 'download_champ', name: 'بطل التنزيل', desc: 'حمّل التطبيق', icon: '📱' },
  { id: 'feedback_hero', name: 'بطل الملاحظات', desc: 'أرسل 10 ملاحظات', icon: '💬' },
] as const;


// Notification System (5 types)
export const NOTIFICATION_TYPES = {
  GAME_INVITE: 'game_invite',
  DAILY_CHALLENGE: 'daily_challenge',
  ACHIEVEMENT_UNLOCK: 'achievement_unlock',
  LEVEL_UP: 'level_up',
  FRIEND_JOINED: 'friend_joined',
} as const;
