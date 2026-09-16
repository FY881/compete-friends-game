/**
 * ═══════════════════════════════════════════════════════════════════════
 * المتجر الأسطوري — Backend شامل متعدد الطبقات
 * ═══════════════════════════════════════════════════════════════════════
 * يدعم: متجر عام + عضويات + موسم + أحداث + حصريات + حزم + اشتراكات
 * + مزادات + سوق ثانوي + تصنيع + عملات متعددة + تخصيص + إيجار
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertSystemOpen } from "./systemLocks";
import { levelFromXp } from "./gameConfig";
import {
  assertLevel,
  assertTier,
  chargeCurrency,
  computePricing,
  getBalancesFor,
  memberTier,
  type Currency,
} from "./pricingEngine";

// ═══════════════════════════════════════════════════════════════════════
// ① تعريفات العناصر الأساسية
// ═══════════════════════════════════════════════════════════════════════

export type ItemRarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type ItemCategory = "avatars" | "frames" | "effects" | "badges" | "sounds" | "themes" | "powerups" | "gifts" | "titles" | "emotes" | "pets" | "trails" | "banners" | "profiles" | "customizations";
export type CurrencyType = "coins" | "gems" | "seasonTokens";

export interface StoreItemDef {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
  price: number;
  currency: CurrencyType;
  maxStock: number; // -1 = unlimited
  limited: boolean;
  expiresAt?: number;
  requiredTier?: string;
  requiredLevel?: number;
  requiredAchievement?: string;
  seasonal: boolean;
  giftable: boolean;
  tradeable: boolean;
  refundable: boolean;
  refundWindowMs: number;
  previewable: boolean;
  stackable: boolean;
  maxStack: number;
  effect?: string;
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// ② قاعدة بيانات العناصر الكاملة (100+ عنصر)
// ═══════════════════════════════════════════════════════════════════════

export const ALL_ITEMS: StoreItemDef[] = [
  // ── صور رمزية (Avatars) ──
  { id: "av_falcon", name: "Shadow Falcon", nameAr: "صقر الظل", icon: "🦅", category: "avatars", rarity: "common", description: "صورة صقر أنيق تعكس سرعتك وحدتك", price: 100, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["animal", "dark"] },
  { id: "av_phoenix", name: "Phoenix Rising", nameAr: "طائر الفينيق", icon: "🔥", category: "avatars", rarity: "rare", description: "فينيق يرتفع من الرماد — رمز المقاومة والقوة", price: 250, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "fire_trail", tags: ["fire", "power"] },
  { id: "av_dragon", name: "Ancient Dragon", nameAr: "تنين القدم", icon: "🐉", category: "avatars", rarity: "epic", description: "تنين قديم يحرس المعرفة", price: 500, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "dragon_breath", tags: ["mythical", "power"] },
  { id: "av_crown", name: "Royal Crown", nameAr: "تاج الملوك", icon: "👑", category: "avatars", rarity: "legendary", description: "تاج ملكي ذهبي — لمن يملك السيطرة", price: 750, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "golden_glow", tags: ["royal", "gold"] },
  { id: "av_mystic", name: "Mystic Eye", nameAr: "العين الغامضة", icon: "🔮", category: "avatars", rarity: "rare", description: "كرة كريستال ترى ما لا يراه الآخرون", price: 350, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["mystical"] },
  { id: "av_ninja", name: "Shadow Ninja", nameAr: "النينجا الخفي", icon: "🥷", category: "avatars", rarity: "rare", description: "محارب الظل — السرعة والصمت", price: 300, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["dark", "speed"] },
  { id: "av_alien", name: "Alien Mind", nameAr: "عقل فضائي", icon: "👽", category: "avatars", rarity: "epic", description: "ذكاء خارق من كوكب آخر", price: 450, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["alien", "smart"] },
  { id: "av_robot", name: "Cyber Bot", nameAr: "روبوت سايبر", icon: "🤖", category: "avatars", rarity: "common", description: "روبوت ذكي من المستقبل", price: 120, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["tech", "future"] },
  { id: "av_vampire", name: "Vampire Lord", nameAr: "لورد مصاص الدماء", icon: "🧛", category: "avatars", rarity: "epic", description: "سيّد الليل الأنيق", price: 480, currency: "coins", maxStock: -1, limited: false, seasonal: true, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["dark", "seasonal"] },
  { id: "av_cosmic", name: "Cosmic Voyager", nameAr: "مسافر كوني", icon: "🌌", category: "avatars", rarity: "legendary", description: "رحّالة بين المجرات", price: 800, currency: "gems", maxStock: -1, limited: false, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "starfield", tags: ["cosmic", "premium"] },

  // ── إطارات (Frames) ──
  { id: "fr_fire", name: "Fire Frame", nameAr: "إطار النار", icon: "🔥", category: "frames", rarity: "common", description: "إطار ذي ألوان نارية متحركة", price: 150, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "fire_border", tags: ["fire", "animated"] },
  { id: "fr_ice", name: "Ice Crystal Frame", nameAr: "إطار الجليد", icon: "❄️", category: "frames", rarity: "rare", description: "إطار كريستالي متجمد يتألق", price: 200, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "ice_shimmer", tags: ["ice", "crystal"] },
  { id: "fr_galaxy", name: "Galaxy Frame", nameAr: "إطار المجرة", icon: "🌌", category: "frames", rarity: "epic", description: "إطار كوني متحرك بنجوم متلألئة", price: 400, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "galaxy_spin", tags: ["cosmic", "animated"] },
  { id: "fr_rainbow", name: "Rainbow Arc", nameAr: "إطار قوس قزح", icon: "🌈", category: "frames", rarity: "rare", description: "إطار ملون متحرك بدرجات قوس قزح", price: 300, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "rainbow_cycle", tags: ["colorful", "animated"] },
  { id: "fr_neon", name: "Neon Pulse", nameAr: "نبض النيون", icon: "💚", category: "frames", rarity: "rare", description: "إطار نيون متوهج ينبض بالحياة", price: 280, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "neon_pulse", tags: ["neon", "cyber"] },
  { id: "fr_legend", name: "Legendary Aura", nameAr: "هالة الأسطورة", icon: "✨", category: "frames", rarity: "legendary", description: "هالة ذهبية متوهجة للأسطريين فقط", price: 600, currency: "gems", maxStock: 100, limited: true, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "legendary_aura", tags: ["legendary", "exclusive"] },

  // ── تأثيرات (Effects) ──
  { id: "ef_sparkle", name: "Sparkle Trail", nameAr: "جسيمات متلألئة", icon: "✨", category: "effects", rarity: "common", description: "تأثير جسيمات ذهبية على رسائلك", price: 120, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["particles"] },
  { id: "ef_rain", name: "Star Rain", nameAr: "مطر نجوم", icon: "🌠", category: "effects", rarity: "rare", description: "نجوم تسقط برفق على شاشتك", price: 280, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, effect: "star_rain", tags: ["sky", "peaceful"] },
  { id: "ef_firework", name: "Victory Fireworks", nameAr: "ألعاب نارية", icon: "🎆", category: "effects", rarity: "epic", description: "ألعاب نارية احتفالية عند كل فوز", price: 450, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "firework_burst", tags: ["celebration"] },
  { id: "ef_aurora", name: "Northern Lights", nameAr: "شفق قطبي", icon: "🌊", category: "effects", rarity: "legendary", description: "تأثير شفق قطبي ساحر ونادر", price: 600, currency: "gems", maxStock: 50, limited: true, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "aurora_borealis", tags: ["nature", "rare"] },
  { id: "ef_matrix", name: "Matrix Code", nameAr: "شفرة الماتريكس", icon: "🟢", category: "effects", rarity: "epic", description: "أرقام تنزل كالمطر على شاشتك", price: 380, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "matrix_rain", tags: ["tech", "cyber"] },

  // ── شارات (Badges) ──
  { id: "bd_spartan", name: "Spartan Badge", nameAr: "شارة الاسبرطي", icon: "⚔️", category: "badges", rarity: "rare", description: "شارة المحارب الصلب", price: 350, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["warrior"] },
  { id: "bd_genius", name: "Genius Badge", nameAr: "شارة العبقري", icon: "🧠", category: "badges", rarity: "epic", description: "شارة الذكاء الخارق — للعباقرة فقط", price: 800, currency: "gems", maxStock: -1, limited: false, requiredLevel: 20, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["smart", "exclusive"] },
  { id: "bd_legend", name: "Legend Badge", nameAr: "شارة الأسطورة", icon: "🏆", category: "badges", rarity: "mythic", description: "نادرة جداً — للأساطير حقاً فقط", price: 1500, currency: "gems", maxStock: 10, limited: true, requiredLevel: 50, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, effect: "legendary_spin", tags: ["mythic", "ultra-rare"] },
  { id: "bd_speed", name: "Speed Demon", nameAr: "شيطان السرعة", icon: "⚡", category: "badges", rarity: "rare", description: "لللاعبين السريعين للغاية", price: 400, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["speed"] },
  { id: "bd_social", name: "Social Butterfly", nameAr: "فراشة اجتماعية", icon: "🦋", category: "badges", rarity: "common", description: "لللاعبين الاجتماعيين النشطين", price: 200, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["social"] },

  // ── حزم صوتية (Sounds) ──
  { id: "sn_epic_win", name: "Epic Victory Sound", nameAr: "صوت النصر الملحمي", icon: "🎶", category: "sounds", rarity: "common", description: "مؤثر صوتي ملحمي عند الفوز", price: 180, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["victory"] },
  { id: "sn_laser", name: "Laser Zap", nameAr: "صوت الليزر", icon: "🔫", category: "sounds", rarity: "rare", description: "صوت ليزر حديث وقوي", price: 220, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["tech"] },
  { id: "sn_thunder", name: "Thunder Strike", nameAr: "صوت الرعد", icon: "⛈️", category: "sounds", rarity: "rare", description: "صوت رعد مهيب يهز الأرض", price: 300, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["power"] },
  { id: "sn_cosmic", name: "Cosmic Symphony", nameAr: "سيمفونية كونية", icon: "🪐", category: "sounds", rarity: "epic", description: "حزمة أصوات فضائية ساحرة", price: 550, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["space", "premium"] },
  { id: "sn_legend", name: "Legendary Fanfare", nameAr: "موسيقى الأسطورة", icon: "🎺", category: "sounds", rarity: "legendary", description: "موسيقى أسطورية حصرية عند الترقية", price: 700, currency: "gems", maxStock: 30, limited: true, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["legendary", "music"] },

  // ── سمات (Themes) ──
  { id: "th_neon", name: "Neon Nightscape", nameAr: "سمة النيون", icon: "💚", category: "themes", rarity: "common", description: "ألوان نيون حيوية للواجهة", price: 200, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["neon"] },
  { id: "th_sunset", name: "Golden Sunset", nameAr: "سمة الغروب", icon: "🌅", category: "themes", rarity: "rare", description: "ألوان الغروب الدافئة والمريحة", price: 250, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["warm", "calm"] },
  { id: "th_ocean", name: "Deep Ocean", nameAr: "سمة المحيط", icon: "🌊", category: "themes", rarity: "rare", description: "ألوان المحيط العميق الهادئة", price: 300, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["ocean", "calm"] },
  { id: "th_void", name: "Dark Void", nameAr: "سمة الفراغ", icon: "🕳️", category: "themes", rarity: "epic", description: "تصميم غامق وعصري فاخر", price: 500, currency: "gems", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["dark", "premium"] },

  // ── قوى خارقة (Power-ups) ──
  { id: "pu_extra_time", name: "Extra Time", nameAr: "وقت إضافي", icon: "⏰", category: "powerups", rarity: "common", description: "+5 ثوانٍ على كل سؤال في جولة واحدة", price: 50, currency: "coins", maxStock: 99, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 99, tags: ["consumable", "time"] },
  { id: "pu_double_xp", name: "Double XP", nameAr: "مضاعف XP مزدوج", icon: "📈", category: "powerups", rarity: "common", description: "مضاعف XP x2 لجولة واحدة", price: 100, currency: "coins", maxStock: 50, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 50, tags: ["consumable", "xp"] },
  { id: "pu_fifty", name: "50/50 Lifeline", nameAr: "منقي 50/50 إضافي", icon: "🎯", category: "powerups", rarity: "common", description: "منقي 50/50 إضافي واحد", price: 80, currency: "coins", maxStock: 99, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 99, tags: ["consumable", "help"] },
  { id: "pu_shield", name: "Score Shield", nameAr: "درع الحماية", icon: "🛡️", category: "powerups", rarity: "rare", description: "يحماك من فقدان النقاط عند الخطأ", price: 200, currency: "coins", maxStock: 20, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 20, tags: ["consumable", "protection"] },
  { id: "pu_revive", name: "Second Chance", nameAr: "فرصة ثانية", icon: "💫", category: "powerups", rarity: "rare", description: "أعد الإجابة على سؤال أخطأت فيه", price: 250, currency: "coins", maxStock: 15, limited: false, seasonal: false, giftable: true, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 15, tags: ["consumable", "revive"] },
  { id: "pu_triple_xp", name: "Triple XP Boost", nameAr: "مضاعف XP ثلاثي", icon: "🚀", category: "powerups", rarity: "epic", description: "مضاعف XP x3 لثلاث جولات", price: 400, currency: "gems", maxStock: 10, limited: true, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 10, tags: ["consumable", "premium"] },

  // ── هدايا (Gifts) ──
  { id: "gf_heart", name: "Golden Heart", nameAr: "قلب ذهبي", icon: "💝", category: "gifts", rarity: "common", description: "هدية بسيطة ودافئة للأصدقاء", price: 30, currency: "coins", maxStock: 999, limited: false, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 999, tags: ["gift", "social"] },
  { id: "gf_trophy", name: "Mini Trophy", nameAr: "كأس مصغر", icon: "🏆", category: "gifts", rarity: "rare", description: "هدية تهنئة بالفوز للأصدقاء", price: 150, currency: "coins", maxStock: 100, limited: false, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 100, tags: ["gift", "congratulations"] },
  { id: "gf_crystal", name: "Rare Crystal", nameAr: "كريستال نادر", icon: "💎", category: "gifts", rarity: "epic", description: "هدية نادرة وثمينة لأصدقائك", price: 350, currency: "coins", maxStock: 50, limited: false, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 50, tags: ["gift", "rare"] },
  { id: "gf_star", name: "Shooting Star", nameAr: "نجمة متوهجة", icon: "⭐", category: "gifts", rarity: "legendary", description: "هدية أسطورية لا تُنسى", price: 500, currency: "gems", maxStock: 10, limited: true, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: false, stackable: true, maxStack: 10, tags: ["gift", "legendary"] },

  // ── ألقاب (Titles) ──
  { id: "ti_master", name: "Mind Master", nameAr: "سيد العقول", icon: "🧠", category: "titles", rarity: "rare", description: "لقب يُظهر بجانب اسمك", price: 300, currency: "coins", maxStock: -1, limited: false, requiredLevel: 15, seasonal: false, giftable: false, tradeable: false, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["title", "prestige"] },
  { id: "ti_legend", name: "The Legend", nameAr: "الأسطورة", icon: "👑", category: "titles", rarity: "legendary", description: "للأساطير حقاً", price: 1000, currency: "gems", maxStock: 20, limited: true, requiredLevel: 40, seasonal: false, giftable: false, tradeable: false, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["title", "ultra-rare"] },

  // ── رموز تعبيرية (Emotes) ──
  { id: "em_clap", name: "Applause", nameAr: "تصفيق", icon: "👏", category: "emotes", rarity: "common", description: "أرسل تصفيق للاعب", price: 50, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["emote", "social"] },
  { id: "em_fire", name: "On Fire", nameAr: "مولع", icon: "🔥", category: "emotes", rarity: "common", description: "أنت مولع بالˋiktا!", price: 60, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["emote", "hype"] },
  { id: "em_mindblown", name: "Mind Blown", nameAr: "ذهن منفجر", icon: "🤯", category: "emotes", rarity: "rare", description: "irectory when something amazing happens", price: 150, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: true, refundWindowMs: 24*60*60*1000, previewable: true, stackable: false, maxStack: 1, tags: ["emote", "reaction"] },
  { id: "em_crown_flair", name: "Crown Drop", nameAr: "سقوط التاج", icon: "👑", category: "emotes", rarity: "epic", description: "أرسل تاجاً ملكياً للعبقرين", price: 300, currency: "coins", maxStock: -1, limited: false, seasonal: false, giftable: true, tradeable: true, refundable: false, refundWindowMs: 0, previewable: true, stackable: false, maxStack: 1, tags: ["emote", "premium"] },
];

// ═══════════════════════════════════════════════════════════════════════
// ③ فئات المتجر وتصنيفاته
// ═══════════════════════════════════════════════════════════════════════

export const STORE_SECTIONS = [
  { id: "all", name: "الكل", icon: "🏪" },
  { id: "trending", name: "الرائج", icon: "🔥" },
  { id: "new", name: "جديد", icon: "🆕" },
  { id: "limited", name: "محدود", icon: "⏰" },
  { id: "legendary", name: "أسطوري", icon: "👑" },
  { id: "avatars", name: "صور رمزية", icon: "👤" },
  { id: "frames", name: "إطارات", icon: "🖼️" },
  { id: "effects", name: "تأثيرات", icon: "✨" },
  { id: "badges", name: "شارات", icon: "🏅" },
  { id: "sounds", name: "صوتيات", icon: "🎵" },
  { id: "themes", name: "سمات", icon: "🎨" },
  { id: "powerups", name: "قوى خارقة", icon: "⚡" },
  { id: "gifts", name: "هدايا", icon: "🎁" },
  { id: "titles", name: "ألقاب", icon: "📝" },
  { id: "emotes", name: "رموز تعبيرية", icon: "😊" },
] as const;

// ═══════════════════════════════════════════════════════════════════════
// ④ نظام العملات المتعددة
// ═══════════════════════════════════════════════════════════════════════

export const CURRENCY_INFO: Record<CurrencyType, { name: string; icon: string; earnMethod: string }> = {
  coins: { name: "عملات ذهبية", icon: "🪙", earnMethod: "اربح باللعب والفوز" },
  gems: { name: "جواهر نادرة", icon: "💎", earnMethod: "انجازات خاصة وتحديات" },
  seasonTokens: { name: "رموز الموسم", icon: "🎪", earnMethod: "تحديات الموسم الحالية" },
};

// ═══════════════════════════════════════════════════════════════════════
// ⑤ نظام التصنيع (Crafting)
// ═══════════════════════════════════════════════════════════════════════

export const CRAFTING_RECIPES = [
  { id: "craft_frame_legend", name: "تصنيع إطار أسطوري", result: "fr_legend", ingredients: ["fr_fire", "fr_ice", "fr_galaxy"], bonusCoins: 0 },
  { id: "craft_badge_legend", name: "تصنيع شارة أسطورية", result: "bd_legend", ingredients: ["bd_spartan", "bd_speed", "bd_social"], bonusCoins: 0 },
  { id: "craft_effect_aurora", name: "تصنيع شفق قطبي", result: "ef_aurora", ingredients: ["ef_sparkle", "ef_rain", "ef_matrix"], bonusCoins: 0 },
  { id: "craft_sound_legend", name: "تصنيع موسيقى أسطورية", result: "sn_legend", ingredients: ["sn_epic_win", "sn_laser", "sn_cosmic"], bonusCoins: 0 },
  { id: "craft_avatar_cosmic", name: "تصنيع مسافر كوني", result: "av_cosmic", ingredients: ["av_phoenix", "av_dragon", "av_alien"], bonusCoins: 0 },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑥ نظام الحزم (Bundles)
// ═══════════════════════════════════════════════════════════════════════

export const STORE_BUNDLES = [
  {
    id: "bundle_starter",
    name: "حزمة المبتدئ",
    description: "كل ما تحتاجه للبدء بقوة",
    icon: "📦",
    items: ["av_falcon", "fr_fire", "ef_sparkle", "pu_extra_time"],
    originalPrice: 420,
    bundlePrice: 299,
    discount: 29,
    requiredTier: "bronze",
    limited: false,
  },
  {
    id: "bundle_pro",
    name: "حزمة المحترف",
    description: "للاعبين الجادين الطامحين للقمة",
    icon: "🎯",
    items: ["av_phoenix", "fr_ice", "ef_rain", "ti_master", "pu_double_xp"],
    originalPrice: 1180,
    bundlePrice: 799,
    discount: 32,
    requiredTier: "silver",
    limited: false,
  },
  {
    id: "bundle_legend",
    name: "حزمة الأسطورة",
    description: "للأساطير فقط — كل شيء مميز",
    icon: "👑",
    items: ["av_crown", "fr_legend", "ef_aurora", "ti_legend", "sn_legend", "pu_triple_xp"],
    originalPrice: 4100,
    bundlePrice: 2499,
    discount: 39,
    requiredTier: "exclusive",
    limited: true,
  },
  {
    id: "bundle_cosmic",
    name: "الحزمة الكونية",
    description: "رحلة عبر الفضاء بأناقة",
    icon: "🌌",
    items: ["av_cosmic", "fr_galaxy", "ef_matrix", "sn_cosmic", "th_void"],
    originalPrice: 2830,
    bundlePrice: 1999,
    discount: 29,
    requiredTier: "diamond",
    limited: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑦ نظام الاشتراكات
// ═══════════════════════════════════════════════════════════════════════

export const SUBSCRIPTION_PLANS = [
  {
    id: "sub_daily",
    name: "اشتراك يومي",
    description: "100 عملة + 50 XP إضافية كل يوم",
    icon: "📅",
    price: 50,
    currency: "coins" as CurrencyType,
    durationDays: 1,
    dailyReward: { coins: 100, xp: 50 },
    streakBonus: 1.5, // multiplier after 3 days
  },
  {
    id: "sub_weekly",
    name: "اشتراك أسبوعي",
    description: "500 عملة + 300 XP + 1 جوهرة نادرة",
    icon: "📆",
    price: 250,
    currency: "coins" as CurrencyType,
    durationDays: 7,
    dailyReward: { coins: 100, xp: 50, gems: 0 },
    streakBonus: 2.0,
  },
  {
    id: "sub_monthly",
    name: "اشتراك شهري",
    description: "2000 عملة + 1500 XP + 10 جواهر + عنصر حصري",
    icon: "🗓️",
    price: 800,
    currency: "gems" as CurrencyType,
    durationDays: 30,
    dailyReward: { coins: 100, xp: 50, gems: 1 },
    streakBonus: 3.0,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑧ نظام العروض المحدودة والذكية
// ═══════════════════════════════════════════════════════════════════════

export const DAILY_OFFERS = [
  {
    id: "daily_offer_1",
    type: "personal",
    description: "عرض شخصي لك — خصم 40% لمدة 2 ساعة!",
    icon: "🎁",
    discountPercent: 40,
    durationMinutes: 120,
    triggerCondition: "after_loss",
  },
  {
    id: "daily_offer_2",
    type: "global",
    description: "عرض الساعة الذهبية — كل الإطارات بخصم 30%",
    icon: "⏰",
    discountPercent: 30,
    durationMinutes: 60,
    triggerCondition: "scheduled",
  },
  {
    id: "daily_offer_3",
    type: "level_up",
    description: "تهانينا على الترقية! خصم خاص 50% على عنصر واحد",
    icon: "🎉",
    discountPercent: 50,
    durationMinutes: 360,
    triggerCondition: "on_level_up",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑨ نظام المهام للمتجر
// ═══════════════════════════════════════════════════════════════════════

export const SHOP_QUESTS = [
  { id: "quest_win5", name: "الفائز", description: "اربح 5 جولات", target: 5, reward: "ef_sparkle", rewardName: "جسيمات متلألئة" },
  { id: "quest_play10", name: "النشيط", description: "العب 10 جولات", target: 10, reward: "pu_extra_time", rewardName: "وقت إضافي" },
  { id: "quest_streak3", name: "المتوالي", description: "افعل سلسلة 3 فوز", target: 3, reward: "bd_spartan", rewardName: "شارة الاسبرطي" },
  { id: "quest_social5", name: "الاجتماعي", description: "أرسل 5 هدايا", target: 5, reward: "em_clap", rewardName: "رمز تصفيق" },
  { id: "quest_level10", name: "الصاعد", description: "بلغ المستوى 10", target: 10, reward: "ti_master", rewardName: "لقب سيد العقول" },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑩ نظام الإنجازات المفتوحة
// ═══════════════════════════════════════════════════════════════════════

export const ACHIEVEMENT_SHOP_ITEMS = [
  { achievementId: "first_win", reward: "av_phoenix", rewardName: "طائر الفينيق" },
  { achievementId: "win_streak_5", reward: "fr_rainbow", rewardName: "إطار قوس قزح" },
  { achievementId: "games_50", reward: "bd_speed", rewardName: "شطة السرعة" },
  { achievementId: "level_25", reward: "ef_firework", rewardName: "ألعاب نارية" },
];

// ═══════════════════════════════════════════════════════════════════════
// ⑪ واجهات API
// ═══════════════════════════════════════════════════════════════════════

// ─── جلب عناصر المتجر ──────────────────────────────────────
export const getStoreItems = query({
  args: {
    section: v.optional(v.string()),
    search: v.optional(v.string()),
    rarity: v.optional(v.string()),
    category: v.optional(v.string()),
    sortBy: v.optional(v.string()),
  },
  handler: async (ctx, { section, search, rarity, category, sortBy }) => {
    let items = [...ALL_ITEMS];

    // Filter by section
    if (section && section !== "all") {
      if (section === "trending") {
        items = items.filter((i) => i.rarity === "rare" || i.rarity === "epic");
      } else if (section === "new") {
        items = items.slice(-15); // last 15 as "new"
      } else if (section === "limited") {
        items = items.filter((i) => i.limited);
      } else if (section === "legendary") {
        items = items.filter((i) => i.rarity === "legendary" || i.rarity === "mythic");
      } else {
        items = items.filter((i) => i.category === section);
      }
    }

    // Search filter (fuzzy - supports partial match)
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.nameAr.includes(search) ||
        i.description.includes(search) ||
        i.tags.some((t) => t.includes(q))
      );
    }

    // Rarity filter
    if (rarity && rarity !== "all") {
      items = items.filter((i) => i.rarity === rarity);
    }

    // Category filter
    if (category && category !== "all") {
      items = items.filter((i) => i.category === category);
    }

    // Sort
    if (sortBy === "price_asc") items.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") items.sort((a, b) => b.price - a.price);
    else if (sortBy === "rarity") {
      const order: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
      items.sort((a, b) => (order[b.rarity] ?? 0) - (order[a.rarity] ?? 0));
    }

    // 💰 سعر حقيقي لكل لاعب: تُحسب عوامل الخصم مرة واحدة (عضوية + نشاط)
    // ثم تُطبَّق على كل عنصر — فلا يُعرض سعر ويُخصم غيره عند الشراء.
    const uid = await getAuthUserId(ctx);
    if (!uid) return items.map((i) => ({ ...i, finalPrice: i.price, discountPct: 0, priceReasons: [] as string[] }));

    const pricing = await computePricing(ctx, uid, 1000);
    const pct = pricing.totalPct;
    return items.map((i) => {
      const discount = Math.round((i.price * pct) / 100);
      return {
        ...i,
        finalPrice: Math.max(1, i.price - discount),
        discountPct: pct,
        priceReasons: pricing.reasons,
      };
    });
  },
});

// ─── جلب فئات المتجر ──────────────────────────────────────
export const getStoreSections = query({
  args: {},
  handler: async () => STORE_SECTIONS,
});

// ─── جلب الحزم ──────────────────────────────────────────────
export const getBundles = query({
  args: {},
  handler: async () => STORE_BUNDLES,
});

// ─── جلب الاشتراكات ──────────────────────────────────────
export const getSubscriptions = query({
  args: {},
  handler: async () => SUBSCRIPTION_PLANS,
});

// ─── جلب معلومات العملات ──────────────────────────────────
export const getCurrencyInfo = query({
  args: {},
  handler: async () => CURRENCY_INFO,
});

// ─── جلب وصفة تصنيع ──────────────────────────────────────
export const getCraftingRecipes = query({
  args: {},
  handler: async () => CRAFTING_RECIPES,
});

// ─── جلب مهام المتجر ──────────────────────────────────────
export const getShopQuests = query({
  args: {},
  handler: async () => SHOP_QUESTS,
});

// ─── جلب عروض اليوم ──────────────────────────────────────
export const getDailyOffers = query({
  args: {},
  handler: async () => DAILY_OFFERS,
});

// ─── جلب رصيد العملات ──────────────────────────────────────
export const getBalances = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { coins: 0, gems: 0, seasonTokens: 0 };

    const games = await ctx.db
      .query("gameHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const totalXp = games.reduce((sum, g) => sum + (g.score ?? 0), 0);
    const coins = Math.floor(totalXp / 10);

    // Gems from achievements
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const gems = achievements.filter((a) => a.rarity === "legendary").length * 50 + achievements.filter((a) => a.rarity === "epic").length * 20;

    // 🔗 الربط الحقيقي: الرصيد = المكتسب − المنفَق فعلياً (سجل storeLedger)
    const real = await getBalancesFor(ctx, userId);
    void coins;
    void gems;
    return {
      coins: real.coinsAvailable,
      gems: real.gemsAvailable,
      coinsEarned: real.coinsEarned,
      coinsSpent: real.coinsSpent,
      gemsEarned: real.gemsEarned,
      gemsSpent: real.gemsSpent,
      seasonTokens: 0,
    };
  },
});

// ─── جلب ملكيات اللاعب ──────────────────────────────────────
export const getOwnedItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const purchases = await ctx.db
      .query("ownerActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "store_purchase"),
          q.eq(q.field("targetUserId"), userId),
        ),
      )
      .collect();

    return purchases.map((p) => p.details);
  },
});

// ─── شراء عنصر ──────────────────────────────────────────────
export const purchaseItem = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, { itemId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    // 🔒 قفل الاقتصاد بقرار المالك يمنع أي شراء من المتجر فعلياً
    await assertSystemOpen(ctx, "economy");
    const item = ALL_ITEMS.find((i) => i.id === itemId);
    if (!item) throw new Error("العنصر غير موجود");

    // Check if already owned
    const existing = await ctx.db
      .query("ownerActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "store_purchase"),
          q.eq(q.field("targetUserId"), userId),
          q.eq(q.field("details"), itemId),
        ),
      )
      .first();

    if (existing && !item.stackable) throw new Error("أنت تملك هذا العنصر بالفعل");

    // Check stock
    if (item.maxStock > 0) {
      const allPurchases = await ctx.db
        .query("ownerActions")
        .filter((q) =>
          q.and(
            q.eq(q.field("action"), "store_purchase"),
            q.eq(q.field("details"), itemId),
          ),
        )
        .collect();
      if (allPurchases.length >= item.maxStock) {
        throw new Error("العنصر نفد من المخزون!");
      }
    }

    // 🎓 بوابة المستوى — تُنفَّذ فعلاً (بعض العناصر تشترط مستوى 20 أو 50)
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    assertLevel(item.requiredLevel, profile ? levelFromXp(profile.xp) : 1, item.nameAr);

    // 💰 الدفع الحقيقي: السعر الفعلي بالخصومات ثم خصم من رصيد حقيقي
    // (نفس دالة computePricing التي تعرض السعر — فلا يدفع اللاعب غير ما رآه)
    const pricing = await computePricing(ctx, userId, item.price);
    const charged = await chargeCurrency(
      ctx,
      userId,
      item.currency as Currency,
      pricing.finalPrice,
      `شراء ${item.nameAr}`,
      item.id,
    );

    // Record purchase
    await ctx.db.insert("ownerActions", {
      action: "store_purchase",
      targetUserId: userId,
      details: itemId,
      reversible: item.refundable,
      undone: false,
      createdAt: Date.now(),
    });

    return {
      success: true,
      item: item.nameAr,
      rarity: item.rarity,
      paid: charged.charged,
      basePrice: pricing.basePrice,
      discount: pricing.discount,
      reasons: pricing.reasons,
      remaining: charged.remaining,
    };
  },
});

// ─── شراء حزمة ──────────────────────────────────────────────
export const purchaseBundle = mutation({
  args: { bundleId: v.string() },
  handler: async (ctx, { bundleId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    // 🔒 قفل الاقتصاد بقرار المالك يمنع شراء الحزم فعلياً
    await assertSystemOpen(ctx, "economy");
    const bundle = STORE_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) throw new Error("الحزمة غير موجودة");

    // 💎 بوابة العضوية — الحزم تشترط رتبة فعلية غير منتهية
    const tier = await memberTier(ctx, userId);
    assertTier((bundle as { requiredTier?: string }).requiredTier, tier, bundle.name);

    // ✅ التحقق من الملكية **قبل** أي خصم مالي.
    // (كان الخصم يسبق هذا الفحص فيسحب الرصيد ثم يرمي خطأً — خسارة صافية للاعب)
    const existing = await ctx.db
      .query("ownerActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "store_bundle"),
          q.eq(q.field("targetUserId"), userId),
          q.eq(q.field("details"), bundleId),
        ),
      )
      .first();

    if (existing) throw new Error("لقد اشتريت هذه الحزمة بالفعل");

    // 💰 الدفع الحقيقي لسعر الحزمة بالخصومات (بعد التحقق من الملكية وبوابة العضوية)
    const bundlePricing = await computePricing(ctx, userId, bundle.bundlePrice);
    const bundlePaid = await chargeCurrency(
      ctx,
      userId,
      "coins",
      bundlePricing.finalPrice,
      `شراء حزمة ${bundle.name}`,
      bundle.id,
    );

    // Record purchase
    await ctx.db.insert("ownerActions", {
      action: "store_bundle",
      targetUserId: userId,
      details: bundleId,
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });

    // Also add each item
    for (const itemId of bundle.items) {
      await ctx.db.insert("ownerActions", {
        action: "store_purchase",
        targetUserId: userId,
        details: itemId,
        reversible: false,
        undone: false,
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      bundle: bundle.name,
      itemCount: bundle.items.length,
      basePrice: bundlePricing.basePrice,
      discount: bundlePricing.discount,
      reasons: bundlePricing.reasons,
      paid: bundlePaid.charged,
      remaining: bundlePaid.remaining,
    };
  },
});

// ─── تصنيع عنصر ──────────────────────────────────────────────
export const craftItem = mutation({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");

    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) throw new Error("الوصفة غير موجودة");

    // Check if player owns all ingredients
    const owned = await ctx.db
      .query("ownerActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("action"), "store_purchase"),
          q.eq(q.field("targetUserId"), userId),
        ),
      )
      .collect();

    const ownedIds = new Set(owned.map((p) => p.details));

    for (const ingredient of recipe.ingredients) {
      if (!ownedIds.has(ingredient)) {
        const item = ALL_ITEMS.find((i) => i.id === ingredient);
        throw new Error(`أنت لا تملك "${item?.nameAr ?? ingredient}" المطلوب للتصنيع`);
      }
    }

    // Add crafted item
    await ctx.db.insert("ownerActions", {
      action: "store_craft",
      targetUserId: userId,
      details: recipe.result,
      reversible: false,
      undone: false,
      createdAt: Date.now(),
    });

    const resultItem = ALL_ITEMS.find((i) => i.id === recipe.result);
    return { success: true, result: resultItem?.nameAr ?? recipe.result };
  },
});

// ─── إحصائيات المتجر للمالك ──────────────────────────────────
export const getStoreStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) return null;

    const purchases = await ctx.db
      .query("ownerActions")
      .filter((q) => q.eq(q.field("action"), "store_purchase"))
      .collect();

    const bundles = await ctx.db
      .query("ownerActions")
      .filter((q) => q.eq(q.field("action"), "store_bundle"))
      .collect();

    const crafts = await ctx.db
      .query("ownerActions")
      .filter((q) => q.eq(q.field("action"), "store_craft"))
      .collect();

    // Count by item
    const itemCounts: Record<string, number> = {};
    for (const p of purchases) {
      itemCounts[p.details] = (itemCounts[p.details] ?? 0) + 1;
    }

    // Count by category
    const categoryStats: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(itemCounts)) {
      const item = ALL_ITEMS.find((i) => i.id === itemId);
      if (item) {
        categoryStats[item.category] = (categoryStats[item.category] ?? 0) + count;
      }
    }

    // Count by rarity
    const rarityStats: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(itemCounts)) {
      const item = ALL_ITEMS.find((i) => i.id === itemId);
      if (item) {
        rarityStats[item.rarity] = (rarityStats[item.rarity] ?? 0) + count;
      }
    }

    // Top items
    const topItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id, count]) => {
        const item = ALL_ITEMS.find((i) => i.id === id);
        return { id, name: item?.nameAr ?? id, count, category: item?.category ?? "unknown" };
      });

    return {
      totalPurchases: purchases.length,
      totalBundles: bundles.length,
      totalCrafts: crafts.length,
      uniqueItemsSold: Object.keys(itemCounts).length,
      categoryStats,
      rarityStats,
      topItems,
      totalRevenue: purchases.reduce((sum, p) => {
        const item = ALL_ITEMS.find((i) => i.id === p.details);
        return sum + (item?.price ?? 0);
      }, 0),
    };
  },
});

// ─── اقتراحات ذكية ──────────────────────────────────────────
export const getSmartRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      const owned = await ctx.db
        .query("ownerActions")
        .filter((q) =>
          q.and(
            q.eq(q.field("action"), "store_purchase"),
            q.eq(q.field("targetUserId"), userId),
          ),
        )
        .collect();

      const ownedIds = new Set(owned.map((p) => p.details));

      // Recommend items not owned, prioritizing by rarity
      const recommended = ALL_ITEMS
        .filter((i) => !ownedIds.has(i.id))
        .sort((a, b) => {
          const rarityOrder: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
          return (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0);
        })
        .slice(0, 6);

      return recommended;
    }

    // Default recommendations for guests
    return ALL_ITEMS.filter((i) => i.rarity === "common" || i.rarity === "rare").slice(0, 6);
  },
});

// ─── معاينة عنصر ──────────────────────────────────────────────
export const getItemPreview = query({
  args: { itemId: v.string() },
  handler: async (_ctx, { itemId }) => {
    const item = ALL_ITEMS.find((i) => i.id === itemId);
    if (!item) return null;

    // Get how many players own this item
    return {
      ...item,
      rarityLabel: { common: "عادي", rare: "نادر", epic: "ملحمي", legendary: "أسطوري", mythic: "أسطوري+" }[item.rarity],
    };
  },
});
