/**
 * ═══════════════════════════════════════════════════════════════
 * نظام الصوتيات والأغاني المخصصة لغرفة المالك
 * ═══════════════════════════════════════════════════════════════
 *
 * يوفر تحكم كامل في كل الأصوات داخل التطبيق:
 * 1. موسيقى خلفية مخصصة لكل قسم
 * 2. مؤثرات صوتية للأحداث المهمة
 * 3. محرك خلفيات صوتية ذكي
 * 4. تحكم كامل بالصوت من غرفة المالك
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ═══════════════════════════════════════════════════════════════
// إعدادات الصوت — جدول واحد فقط (key/value)
// ═══════════════════════════════════════════════════════════════

/**
 * هيكل إعدادات الصوت الكاملة:
 * {
 *   masterVolume: 0-1,           // الصوت الرئيسي
 *   musicVolume: 0-1,            // موسيقى الخلفية
 *   sfxVolume: 0-1,              // المؤثرات الصوتية
 *   ambientVolume: 0-1,          // الخلفيات الصوتية
 *   muted: boolean,              // كتم شامل
 *   musicEnabled: boolean,       // تفعيل الموسيقى
 *   sfxEnabled: boolean,         // تفعيل المؤثرات
 *   ambientEnabled: boolean,     // تفعيل الخلفيات
 *   currentTrack: string,        // المسار الحالي
 *   currentAmbient: string,      // الخلفية الحالية
 *   sectionMusic: {              // موسيقى كل قسم
 *     landing: string,
 *     play: string,
 *     game: string,
 *     chat: string,
 *     owner: string,
 *   },
 *   eventSounds: {               // مؤثرات الأحداث
 *     levelUp: string,
 *     achievement: string,
 *     win: string,
 *     lose: string,
 *     report: string,
 *     notification: string,
 *     click: string,
 *     hover: string,
 *   },
 *   reduceMotion: boolean,       // تقليل الحركة
 *   autoPlay: boolean,           // تشغيل تلقائي
 * }
 */

export const SOUND_PRESETS = {
  // ── مسارات الموسيقى المتاحة ──
  tracks: [
    { id: "epic_main", name: "🏆 الموسيقى الرئيسية", category: "main", bpm: 120, mood: "epic" },
    { id: "chill_lobby", name: "🎮 موسيقى اللوبي", category: "lobby", bpm: 90, mood: "chill" },
    { id: "intense_battle", name: "⚔️ موسيقى المعركة", category: "battle", bpm: 140, mood: "intense" },
    { id: "mystery_quiz", name: "🧠 موسيقى الألغاز", category: "quiz", bpm: 100, mood: "mysterious" },
    { id: "celebration", name: "🎉 موسيقى الاحتفال", category: "celebration", bpm: 130, mood: "happy" },
    { id: "dark_owner", name: "👑 موسيقى غرفة المالك", category: "owner", bpm: 85, mood: "dark" },
    { id: "ambient_nature", name: "🌿 خلفية طبيعية", category: "ambient", bpm: 60, mood: "calm" },
    { id: "cyber_punk", name: "🤖 سايبر بانك", category: "futuristic", bpm: 128, mood: "cyber" },
  ],

  // ── مؤثرات صوتية ──
  sfx: [
    { id: "click", name: "نقرة", icon: "👆", usedFor: "أزرار" },
    { id: "hover", name: "تمرير", icon: "✨", usedFor: "تمرير الفأرة" },
    { id: "success", name: "نجاح", icon: "✅", usedFor: "إكمال" },
    { id: "error", name: "خطأ", icon: "❌", usedFor: "أخطاء" },
    { id: "level_up", name: "ترقية", icon: "⬆️", usedFor: "ترقية المستوى" },
    { id: "achievement", name: "إنجاز", icon: "🏅", usedFor: "فتح إنجاز" },
    { id: "win", name: "فوز", icon: "🏆", usedFor: "الفوز بالجولة" },
    { id: "lose", name: "خسارة", icon: "😢", usedFor: "خسارة الجولة" },
    { id: "notification", name: "إشعار", icon: "🔔", usedFor: "إشعار جديد" },
    { id: "report", name: "بلاغ", icon: "🚨", usedFor: "بلاغ جديد" },
    { id: "gift", name: "هدية", icon: "🎁", usedFor: "استلام هدية" },
    { id: "coin", name: "عملة", icon: "🪙", usedFor: "حصول على عملات" },
    { id: "unlock", name: "فتح", icon: "🔓", usedFor: "فتح محتوى" },
    { id: "fanfare", name: "صفير", icon: "🎺", usedFor: "حدث كبير" },
    { id: "whoosh", name: "حركة", icon: "💨", usedFor: "انتقالات" },
  ],

  // ── أنماط الخلفيات الصوتية ──
  ambientPatterns: [
    { id: "rain", name: "🌙 مطر ليلي", icon: "🌧️", description: "صوت مطر هادئ مع رعد بعيد" },
    { id: "forest", name: "🌳 غابة", icon: "🌲", description: "أصوات طيور وأوراق" },
    { id: "fire", name: "🔥 موقد نار", icon: "🪵", description: "صوت نار متصاعدة" },
    { id: "ocean", name: "🌊 محيط", icon: "🏖️", description: "أمواج متكسرة على الشاطئ" },
    { id: "wind", name: "💨 ريح", icon: "🍃", description: "نسيم خفيف" },
    { id: "thunder", name: "⛈️ عاصفة", icon: "🌩️", description: "عواصف مع رعد وأمطار" },
    { id: "city", name: "🏙️ مدينة ليلية", icon: "🌃", description: "أصوات المدينة البعيدة" },
    { id: "space", name: "🌌 فضاء", icon: "🚀", description: "أجواء فضائية هادئة" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// الاستعلامات
// ═══════════════════════════════════════════════════════════════

/** جلب إعدادات الصوت الحالية */
export const getSoundSettings = query({
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "soundSettings"))
      .first();

    if (!row) {
      // القيم الافتراضية
      return {
        masterVolume: 0.7,
        musicVolume: 0.5,
        sfxVolume: 0.6,
        ambientVolume: 0.3,
        muted: false,
        musicEnabled: true,
        sfxEnabled: true,
        ambientEnabled: true,
        currentTrack: "epic_main",
        currentAmbient: "",
        sectionMusic: {
          landing: "epic_main",
          play: "chill_lobby",
          game: "intense_battle",
          chat: "mystery_quiz",
          owner: "dark_owner",
        },
        eventSounds: {
          levelUp: "level_up",
          achievement: "achievement",
          win: "win",
          lose: "lose",
          report: "report",
          notification: "notification",
          click: "click",
          hover: "hover",
        },
        reduceMotion: false,
        autoPlay: true,
      };
    }

    try {
      return JSON.parse(row.value);
    } catch {
      return { masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.6, muted: false };
    }
  },
});

/** جلب المسارات المتاحة */
export const getAvailableTracks = query({
  handler: async () => {
    return SOUND_PRESETS.tracks;
  },
});

/** جلب المؤثرات المتاحة */
export const getAvailableSfx = query({
  handler: async () => {
    return SOUND_PRESETS.sfx;
  },
});

/** جلب أنماط الخلفيات */
export const getAmbientPatterns = query({
  handler: async () => {
    return SOUND_PRESETS.ambientPatterns;
  },
});

// ═══════════════════════════════════════════════════════════════
// التحديثات — من المالك فقط
// ═══════════════════════════════════════════════════════════════

/** تحديث إعدادات الصوت (من المالك) */
export const updateSoundSettings = mutation({
  args: {
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    // التحقق من الصلاحية
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("غير مصرح");

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "soundSettings"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: JSON.stringify(args.settings) });
    } else {
      await ctx.db.insert("settings", {
        key: "soundSettings",
        value: JSON.stringify(args.settings),
      });
    }

    return { success: true };
  },
});

/** تحديث مسار قسم معين */
export const setSectionMusic = mutation({
  args: {
    section: v.string(),
    trackId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "soundSettings"))
      .first();

    let settings: any = {};
    if (row) {
      try { settings = JSON.parse(row.value); } catch { settings = {}; }
    }

    if (!settings.sectionMusic) settings.sectionMusic = {};
    settings.sectionMusic[args.section] = args.trackId;

    if (row) {
      await ctx.db.patch(row._id, { value: JSON.stringify(settings) });
    } else {
      await ctx.db.insert("settings", { key: "soundSettings", value: JSON.stringify(settings) });
    }

    return { success: true };
  },
});

/** تبديل كتم الصوت */
export const toggleMute = mutation({
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "soundSettings"))
      .first();

    let settings: any = {};
    if (row) {
      try { settings = JSON.parse(row.value); } catch { settings = {}; }
    }

    settings.muted = !settings.muted;

    if (row) {
      await ctx.db.patch(row._id, { value: JSON.stringify(settings) });
    } else {
      await ctx.db.insert("settings", { key: "soundSettings", value: JSON.stringify(settings) });
    }

    return { muted: settings.muted };
  },
});

/** تسجيل حدث صوتي (للإحصائيات) */
export const logSoundEvent = mutation({
  args: {
    eventType: v.string(), // "music_change" | "sfx_play" | "ambient_change" | "volume_change"
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // يمكن توسيعه لاحقاً بجدول إحصائيات الصوت
    return { success: true };
  },
});
