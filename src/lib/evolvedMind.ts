/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 العقل المتطور (Evolved Mind) — العمود الفقري للتقدّم الشخصي
 * ═══════════════════════════════════════════════════════════════════════
 *
 * هذا النظام لا يعرض أرقاماً وهمية: **كل قيمة هنا مشتقّة من إجابات
 * حقيقية** سجّلها اللاعب (صواب/خطأ، صعوبة السؤال، زمن الإجابة، سلاسله،
 * وحقوله المعرفية). ومن هذه القيم تُبنى:
 *
 *   • ست قوى عقلية (منطق · معرفة · سرعة · ذاكرة · تركيز · حدس) لكل منها
 *     ١٢ مستوى، تكبر من سلوك اللعب نفسه لا من عدّاد وهمي.
 *   • عشر تخصصات تُفتح بشروط قوى حقيقية، ويُجهّز منها **٣ كحد أقصى**
 *     (اختيار حقيقي) — ولكل تخصص تأثير مقيس داخل اللعب.
 *   • إتقان لكل مجال معرفي بعتبات (دارس → أستاذ) بمكافآت تُصرف مرة واحدة.
 *
 * التأثيرات ليست زخرفة: تُطبَّق فعلاً داخل الجولة وفي تسوية النتيجة
 * (خبرة، عملات، ثوانٍ إضافية، دروع سلسلة، إضعاف دقة الخصم).
 *
 * الوحدة مستقلة تماماً: لا تستورد محرك اللعبة (لتفادي أي دورة استيراد)
 * وتُحفظ في localStorage وتُبثّ عبر useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";
import type { OfflineQuestion } from "@/lib/offline-bank";
import {
  FACULTY_THRESHOLDS as CORE_FACULTY_THRESHOLDS,
  facultyLevelFromXp as coreFacultyLevel,
} from "@/convex/mindCore";

// ═══════════════════════════════════════════════════════════════════════
// القوى العقلية الست
// ═══════════════════════════════════════════════════════════════════════

export type FacultyId = "logic" | "knowledge" | "speed" | "memory" | "focus" | "intuition";

export interface FacultyDef {
  id: FacultyId;
  name: string;
  icon: string;
  /** ما يغذّي هذه القوة فعلاً — مكتوب للاعب بصراحة */
  source: string;
  /** ما تمنحه هذه القوة تلقائياً كل مستوى */
  passive: string;
  bar: string;
  text: string;
}

export const FACULTIES: FacultyDef[] = [
  {
    id: "logic",
    name: "المنطق",
    icon: "🧩",
    source: "الإجابات الصحيحة على الأسئلة الصعبة والمتوسطة",
    passive: "+1.5% خبرة لكل مستوى (حتى +15%)",
    bar: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "knowledge",
    name: "المعرفة",
    icon: "📚",
    source: "كل إجابة صحيحة جديدة في أي مجال",
    passive: "+2% عملات لكل مستوى (حتى +25%)",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "speed",
    name: "السرعة",
    icon: "⚡",
    source: "الإجابة السريعة قبل انتهاء الوقت",
    passive: "+1 ثانية لكل مستويين (حتى +4 ثوانٍ)",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "memory",
    name: "الذاكرة",
    icon: "🗂️",
    source: "تجاوز سؤال أخطأت فيه سابقاً — والتعلم من الخطأ",
    passive: "تخفيض دقة الخصم 1% لكل مستوى (حتى 8%)",
    bar: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "focus",
    name: "التركيز",
    icon: "🎯",
    source: "السلاسل الطويلة والجولات بلا خطأ",
    passive: "درع سلسلة عند المستوى 5، وآخر عند المستوى 9",
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "intuition",
    name: "الحدس",
    icon: "🔮",
    source: "الإصابة الصحيحة في مجالات لم تتدرب عليها بعد",
    passive: "+1% خبرة و+1% عملات لكل مستوى (حتى +10% لكلٍّ)",
    bar: "bg-fuchsia-500",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
  },
];

export const FACULTY_MAP = new Map(FACULTIES.map((f) => [f.id, f]));

/**
 * عتبات XP لكل مستوى (الفهرس 0 = المستوى 1) — أقصى مستوى 12.
 * المصدر الوحيد هو `mindCore` (نواة العقول المشتركة) حتى لا تتباعد أرقام
 * المحرك المحلي عن أرقام الخادم وغرفة المالك أبداً.
 */
export const FACULTY_THRESHOLDS = CORE_FACULTY_THRESHOLDS;
export const MAX_FACULTY_LEVEL = FACULTY_THRESHOLDS.length;

/** مستوى القوة من رصيد خبرتها. */
export const facultyLevel = coreFacultyLevel;

export interface FacultyProgress {
  level: number;
  into: number;
  needed: number;
  progress: number;
  maxed: boolean;
}

/** تقدّم القوة نحو مستواها القادم (لعرض الشريط بدقة). */
export function facultyProgress(xp: number): FacultyProgress {
  const level = facultyLevel(xp);
  if (level >= MAX_FACULTY_LEVEL) {
    return { level, into: 0, needed: 0, progress: 1, maxed: true };
  }
  const base = FACULTY_THRESHOLDS[level - 1];
  const next = FACULTY_THRESHOLDS[level];
  const into = Math.max(0, xp - base);
  const needed = next - base;
  return { level, into, needed, progress: needed > 0 ? Math.min(1, into / needed) : 0, maxed: false };
}

// ═══════════════════════════════════════════════════════════════════════
// التأثيرات — أرقام حقيقية تُطبَّق داخل اللعب
// ═══════════════════════════════════════════════════════════════════════

export interface MindEffect {
  /** نسبة زيادة الخبرة المكتسبة في الجولة */
  xpPct: number;
  /** نسبة زيادة العملات المكتسبة في الجولة */
  coinsPct: number;
  /** ثوانٍ إضافية على عدّاد كل سؤال */
  timeSec: number;
  /** تخفيض دقة الخصم في المواجهات (سالب) */
  rivalAccuracy: number;
  /** عدد مرات حماية السلسلة من الانكسار في الجولة */
  streakShields: number;
}

export const ZERO_EFFECT: MindEffect = {
  xpPct: 0,
  coinsPct: 0,
  timeSec: 0,
  rivalAccuracy: 0,
  streakShields: 0,
};

/** يجمع عدة تأثيرات في تأثير واحد (بالجمع الخطي). */
export function combineEffects(effects: readonly MindEffect[]): MindEffect {
  return effects.reduce<MindEffect>(
    (acc, e) => ({
      xpPct: acc.xpPct + e.xpPct,
      coinsPct: acc.coinsPct + e.coinsPct,
      timeSec: acc.timeSec + e.timeSec,
      rivalAccuracy: round2(acc.rivalAccuracy + e.rivalAccuracy),
      streakShields: acc.streakShields + e.streakShields,
    }),
    { ...ZERO_EFFECT },
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** التأثير السلبي التلقائي لقوة عقلية بحسب مستواها. */
export function facultyPassive(id: FacultyId, level: number): MindEffect {
  const over = Math.max(0, level - 1);
  switch (id) {
    case "logic":
      return { ...ZERO_EFFECT, xpPct: Math.min(15, over * 1.5) };
    case "knowledge":
      return { ...ZERO_EFFECT, coinsPct: Math.min(25, over * 2) };
    case "speed":
      return { ...ZERO_EFFECT, timeSec: Math.min(4, Math.floor(over / 2)) };
    case "memory":
      return { ...ZERO_EFFECT, rivalAccuracy: -Math.min(0.08, round2(over * 0.01)) };
    case "focus":
      return { ...ZERO_EFFECT, streakShields: (level >= 5 ? 1 : 0) + (level >= 9 ? 1 : 0) };
    case "intuition":
      return {
        ...ZERO_EFFECT,
        xpPct: Math.min(10, over),
        coinsPct: Math.min(10, over),
      };
    default:
      return { ...ZERO_EFFECT };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// التخصصات — شروط حقيقية وتأثيرات ملموسة
// ═══════════════════════════════════════════════════════════════════════

export interface SpecializationDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** شروط الفتح: مستوى أدنى في قوى محددة */
  requires: { faculty: FacultyId; level: number }[];
  effect: MindEffect;
  tier: "برونزي" | "فضي" | "ذهبي" | "أسطوري";
}

/** الحد الأقصى للتخصصات المجهّزة في الوقت نفسه — اختيار حقيقي. */
export const MAX_EQUIPPED = 3;

export const SPECIALIZATIONS: SpecializationDef[] = [
  {
    id: "sp_orator",
    name: "خطيب الحلبة",
    icon: "🎙️",
    description: "حضور ثابت في كل نزال يضاعف عائد جولاتك.",
    requires: [{ faculty: "focus", level: 3 }, { faculty: "logic", level: 3 }],
    effect: { ...ZERO_EFFECT, xpPct: 5, coinsPct: 5 },
    tier: "برونزي",
  },
  {
    id: "sp_archivist",
    name: "أمين الأرشيف",
    icon: "🗃️",
    description: "لا تفوتك حقيقة مرّت عليك — خبرتك تتراكم أسرع.",
    requires: [{ faculty: "memory", level: 4 }],
    effect: { ...ZERO_EFFECT, xpPct: 8 },
    tier: "فضي",
  },
  {
    id: "sp_lightning",
    name: "برق البديهة",
    icon: "⚡",
    description: "تسبق العدّاد قبل أن يلاحقك، وتكسب أكثر في كل جولة.",
    requires: [{ faculty: "speed", level: 5 }],
    effect: { ...ZERO_EFFECT, timeSec: 2, coinsPct: 10 },
    tier: "فضي",
  },
  {
    id: "sp_juggernaut",
    name: "عبقرية الحصار",
    icon: "🛡️",
    description: "حضورك يربك خصمك قبل السؤال الأول.",
    requires: [{ faculty: "logic", level: 6 }],
    effect: { ...ZERO_EFFECT, rivalAccuracy: -0.06, xpPct: 4 },
    tier: "فضي",
  },
  {
    id: "sp_guardian",
    name: "حارس السلسلة",
    icon: "🔥",
    description: "خطأ واحد لن يكسر سلسلتك بعد اليوم.",
    requires: [{ faculty: "focus", level: 6 }],
    effect: { ...ZERO_EFFECT, streakShields: 1, coinsPct: 8 },
    tier: "ذهبي",
  },
  {
    id: "sp_oracle",
    name: "العرّاف",
    icon: "🔮",
    description: "حدسك في المجهول صار مصدر دخل حقيقي.",
    requires: [{ faculty: "intuition", level: 6 }],
    effect: { ...ZERO_EFFECT, xpPct: 10, coinsPct: 10 },
    tier: "ذهبي",
  },
  {
    id: "sp_scholar",
    name: "العلّامة",
    icon: "🎓",
    description: "معرفتك تحوّل كل إجابة إلى ذهب.",
    requires: [{ faculty: "knowledge", level: 7 }],
    effect: { ...ZERO_EFFECT, coinsPct: 15, xpPct: 5 },
    tier: "ذهبي",
  },
  {
    id: "sp_tactician",
    name: "المناور",
    icon: "♟️",
    description: "تقرأ خصمك وتقصّ من دقّته، ووقتك أوسع من وقته.",
    requires: [{ faculty: "logic", level: 8 }, { faculty: "focus", level: 5 }],
    effect: { ...ZERO_EFFECT, rivalAccuracy: -0.08, timeSec: 2 },
    tier: "ذهبي",
  },
  {
    id: "sp_monarch",
    name: "عاهل العقول",
    icon: "👑",
    description: "توازن كامل في القوى الست — عائد مضاعف في كل مسار.",
    requires: [
      { faculty: "logic", level: 5 },
      { faculty: "knowledge", level: 5 },
      { faculty: "speed", level: 5 },
      { faculty: "memory", level: 5 },
      { faculty: "focus", level: 5 },
      { faculty: "intuition", level: 5 },
    ],
    effect: { ...ZERO_EFFECT, xpPct: 12, coinsPct: 12, streakShields: 1 },
    tier: "أسطوري",
  },
  {
    id: "sp_transcendent",
    name: "العقل المتجاوز",
    icon: "🌌",
    description: "قمة المسار: كل القوى في ذروتها — لا شيء يوقفك.",
    requires: [
      { faculty: "logic", level: 8 },
      { faculty: "knowledge", level: 8 },
      { faculty: "speed", level: 8 },
      { faculty: "memory", level: 8 },
      { faculty: "focus", level: 8 },
      { faculty: "intuition", level: 8 },
    ],
    effect: { ...ZERO_EFFECT, xpPct: 20, coinsPct: 20, timeSec: 3, rivalAccuracy: -0.1, streakShields: 1 },
    tier: "أسطوري",
  },
];

export const SPEC_MAP = new Map(SPECIALIZATIONS.map((s) => [s.id, s]));

// ═══════════════════════════════════════════════════════════════════════
// إتقان المجالات المعرفية
// ═══════════════════════════════════════════════════════════════════════

export interface MasteryTier {
  name: string;
  icon: string;
  min: number;
  reward: number;
}

export const MASTERY_TIERS: MasteryTier[] = [
  { name: "وافد", icon: "🌱", min: 0, reward: 0 },
  { name: "دارس", icon: "📗", min: 25, reward: 60 },
  { name: "متمكّن", icon: "📘", min: 45, reward: 180 },
  { name: "خبير", icon: "📕", min: 65, reward: 450 },
  { name: "أستاذ", icon: "🎓", min: 85, reward: 1000 },
];

/** أقل عدد إجابات قبل أن يُحتسب الإتقان (كي لا يُضخَّم من إجابتين). */
export const MASTERY_MIN_ANSWERS = 5;

/**
 * درجة الإتقان 0-100 = الدقة مضروبة في وزن يتصاعد بحجم التدريب.
 * الدقة هي الأساس (لا حظّ عابر)، والحجم يفتح الطريق نحو «أستاذ».
 * لا تُحتسب قبل ٥ إجابات.
 *
 * أمثلة تحقّق التوازن:
 *   • ١٠٠٪ دقة في ٥ إجابات  ⇒ ٦٧ (متمكّن)
 *   • ١٠٠٪ دقة في ٣٠ إجابة ⇒ ١٠٠ (أستاذ)
 *   • ٥٠٪ دقة في ٣٠ إجابة ⇒ ٥٠ (متمكّن — لا يبلغ الخبير بلا دقة)
 */
export function domainMastery(c: { answered: number; correct: number } | undefined): number {
  if (!c || c.answered < MASTERY_MIN_ANSWERS) return 0;
  const acc = c.correct / c.answered;
  const volume = Math.min(1, c.answered / 30);
  return Math.round(acc * (60 + 40 * volume));
}

/** فهرس رتبة الإتقان (0-4). */
export function masteryTierIndex(mastery: number): number {
  let idx = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i += 1) {
    if (mastery >= MASTERY_TIERS[i].min) idx = i;
  }
  return idx;
}

// ═══════════════════════════════════════════════════════════════════════
// الحالة والتخزين
// ═══════════════════════════════════════════════════════════════════════

export interface RecallRecord {
  /** مرات الخطأ في هذا السؤال */
  w: number;
  /** مرات الصواب في هذا السؤال */
  r: number;
}

export interface MindState {
  /** رصيد خبرة كل قوة عقلية */
  faculty: Record<FacultyId, number>;
  /** التخصصات المجهّزة (٣ كحد أقصى) */
  equipped: string[];
  /** أعلى رتبة إتقان صُرفت مكافأتها لكل مجال */
  domainTiers: Record<string, number>;
  /** ذاكرة الأسئلة: لتغذية قوة «الذاكرة» بالتعلّم من الخطأ */
  recalls: Record<string, RecallRecord>;
  /** سجل آخر الجولات (شفافية: ماذا بنت كل جولة) */
  log: { at: number; mode: string; gained: number; specs: string[] }[];
  totalSessions: number;
}

const STORAGE_KEY = "mindclash.evolvedmind.v1";
/** سقف ذاكرة الأسئلة — يمنع تضخّم التخزين المحلي. */
const RECALL_LIMIT = 400;

function emptyFaculty(): Record<FacultyId, number> {
  return { logic: 0, knowledge: 0, speed: 0, memory: 0, focus: 0, intuition: 0 };
}

function emptyState(): MindState {
  return { faculty: emptyFaculty(), equipped: [], domainTiers: {}, recalls: {}, log: [], totalSessions: 0 };
}

function load(): MindState {
  if (typeof localStorage === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<MindState>;
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      faculty: { ...base.faculty, ...(parsed.faculty ?? {}) },
      equipped: (parsed.equipped ?? []).filter((id) => SPEC_MAP.has(id)).slice(0, MAX_EQUIPPED),
      domainTiers: parsed.domainTiers ?? {},
      recalls: parsed.recalls ?? {},
      log: parsed.log ?? [],
    };
  } catch {
    return emptyState();
  }
}

let state: MindState = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* التخزين ممتلئ — العقل يعمل على أي حال */
  }
}

function commit(next: MindState): void {
  state = next;
  persist();
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* مستمع معطوب لا يُسقط النظام */
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): MindState => state;

/** يربط أي مكوّن بحالة العقل المتطور (تفاعلية كاملة). */
export function useEvolvedMind(): MindState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** قراءة الحالة خارج React (للمحرك والاختبارات). */
export function readMind(): MindState {
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
// الحسابات المشتقّة
// ═══════════════════════════════════════════════════════════════════════

/** مستويات القوى الست من الحالة. */
export function facultyLevels(s: MindState): Record<FacultyId, number> {
  const out = emptyFaculty();
  for (const f of FACULTIES) out[f.id] = facultyLevel(s.faculty[f.id] ?? 0);
  return out;
}

/** مجموع مستويات القوى — مقياس واحد لتطوّر عقلك. */
export function mindTierScore(s: MindState): number {
  const lv = facultyLevels(s);
  return FACULTIES.reduce((sum, f) => sum + lv[f.id], 0);
}

/** هل التخصص مفتوح فعلاً؟ */
export function isSpecUnlocked(def: SpecializationDef, s: MindState): boolean {
  const lv = facultyLevels(s);
  return def.requires.every((r) => lv[r.faculty] >= r.level);
}

/** التخصصات المفتوحة. */
export function unlockedSpecializations(s: MindState): SpecializationDef[] {
  return SPECIALIZATIONS.filter((def) => isSpecUnlocked(def, s));
}

/** التخصصات المجهّزة فعلاً (مع تجاهل أي تخصص غير مفتوح). */
export function equippedSpecializations(s: MindState): SpecializationDef[] {
  const open = new Set(unlockedSpecializations(s).map((d) => d.id));
  return s.equipped.map((id) => SPEC_MAP.get(id)).filter((d): d is SpecializationDef => !!d && open.has(d.id));
}

/**
 * مجموع تأثيرات العقل: سلبيات القوى + تأثيرات التخصصات المجهّزة.
 * هذا هو الرقم الذي يغيّر اللعب فعلاً.
 */
export function mindEffect(s: MindState): MindEffect {
  const lv = facultyLevels(s);
  const parts: MindEffect[] = FACULTIES.map((f) => facultyPassive(f.id, lv[f.id]));
  for (const spec of equippedSpecializations(s)) parts.push(spec.effect);
  const total = combineEffects(parts);
  // حدود عليا واقعية تمنع كسر التوازن
  return {
    xpPct: Math.min(60, total.xpPct),
    coinsPct: Math.min(70, total.coinsPct),
    timeSec: Math.min(8, total.timeSec),
    rivalAccuracy: Math.max(-0.25, total.rivalAccuracy),
    streakShields: Math.min(3, total.streakShields),
  };
}

export interface MindIdentity {
  title: string;
  icon: string;
  description: string;
  top: { def: FacultyDef; level: number } | null;
}

/** هوية عقل اللاعب — مشتقّة من أقوى قوة لديه فعلاً. */
export function mindIdentity(s: MindState): MindIdentity {
  const lv = facultyLevels(s);
  let top: { def: FacultyDef; level: number } | null = null;
  for (const def of FACULTIES) {
    const level = lv[def.id];
    if (!top || level > top.level) top = { def, level };
  }
  if (!top || top.level <= 1) {
    return { title: "عقل ناشئ", icon: "🌱", description: "ابدأ جولاتك ليكتسب عقلك ملامحه", top };
  }
  const titles: Record<FacultyId, { title: string; icon: string; description: string }> = {
    logic: { title: "عقل تحليلي", icon: "🧩", description: "تفكيك المسائل الصعبة هو سلاحك الأول" },
    knowledge: { title: "عقل موسوعي", icon: "📚", description: "رصيدك المعرفي هو مصدر قوّتك" },
    speed: { title: "عقل خاطف", icon: "⚡", description: "تسبق السؤال قبل أن يكتمل" },
    memory: { title: "عقل حافظ", icon: "🗂️", description: "لا يعود إليك خطأ مرتين" },
    focus: { title: "عقل راسخ", icon: "🎯", description: "سلاسلك الطويلة هي توقيعك" },
    intuition: { title: "عقل حدسي", icon: "🔮", description: "تصيب في المجهول قبل أن تتعلّمه" },
  };
  const t = titles[top.def.id];
  return { ...t, top };
}

// ═══════════════════════════════════════════════════════════════════════
// تسجيل جولة حقيقية — هنا يُبنى العقل فعلاً
// ═══════════════════════════════════════════════════════════════════════

export interface MindSessionInput {
  mode: string;
  questions: readonly OfflineQuestion[];
  /** الفهرس المُختار لكل سؤال، أو -1 لانتهاء الوقت */
  answers: readonly number[];
  /** زمن الإجابة بالمللي ثانية لكل سؤال (اختياري — يغذّي قوة السرعة) */
  timesMs?: readonly number[];
  /** مدة عدّاد الجولة بالثواني */
  timerSeconds: number;
  bestStreak: number;
  perfect: boolean;
  /** إحصاءات المجالات بعد الجولة (مصدر الإتقان) */
  domains: Record<string, { answered: number; correct: number }>;
}

export interface FacultyGain {
  id: FacultyId;
  name: string;
  icon: string;
  gained: number;
  level: number;
  leveledUp: boolean;
}

export interface MasteryUp {
  category: string;
  tier: number;
  tierName: string;
  tierIcon: string;
  reward: number;
}

export interface MindSessionReport {
  gains: FacultyGain[];
  totalGained: number;
  masteryUps: MasteryUp[];
  masteryCoins: number;
  unlockedSpecs: SpecializationDef[];
  identity: MindIdentity;
}

/**
 * يحسب زيادات القوى من أحداث الجولة الحقيقية.
 * كل زيادة لها سبب صريح — لا أرقام عشوائية.
 */
export function facultyGainsForSession(
  input: Pick<MindSessionInput, "questions" | "answers" | "timesMs" | "timerSeconds" | "bestStreak" | "perfect">,
  recalls: Record<string, RecallRecord>,
): Record<FacultyId, number> {
  const g = emptyFaculty();
  const { questions, answers, timesMs, timerSeconds } = input;

  questions.forEach((q, i) => {
    const picked = answers[i];
    const answered = picked !== undefined && picked >= 0;
    if (!answered) return;
    const correct = q.correctIndex === picked;
    const rec = recalls[q.id];
    const priorWrong = rec?.w ?? 0;
    const priorRight = rec?.r ?? 0;
    const ms = timesMs?.[i];

    if (correct) {
      // المعرفة: كل حقيقة جديدة، وأثقل للصعب
      g.knowledge += 3 + (q.difficulty === "hard" ? 2 : q.difficulty === "medium" ? 1 : 0);
      // المنطق: يبنيه التفكير في الأسئلة الصعبة والمتوسطة
      g.logic += q.difficulty === "hard" ? 5 : q.difficulty === "medium" ? 3 : 2;
      // الذاكرة: استرجاع ما أخطأت فيه سابقاً أثقل بأضعاف (تثبيت المعرفة)
      g.memory += priorWrong > 0 ? 8 : 3;
      // الحدس: إصابة في مجال لم تتدرب عليه بعد
      if (priorWrong + priorRight < 3) g.intuition += 4;
      // السرعة: تُقاس بالزمن الحقيقي مقابل مدة العدّاد
      if (typeof ms === "number" && ms >= 0) {
        const ratio = ms / Math.max(1000, timerSeconds * 1000);
        g.speed += Math.max(0, Math.round(6 - ratio * 8));
      }
    } else {
      // الخطأ يعلّم — لكن بقدر أقل (بلا مبالغة)
      g.memory += 3;
      g.logic += 1;
    }
  });

  // مكافأة المراجعة: إجابات على أسئلة مرّت عليك سابقاً تُثبّت الذاكرة
  const revisited = questions.filter((q, i) => {
    const picked = answers[i];
    return picked !== undefined && picked >= 0 && recalls[q.id] !== undefined;
  }).length;
  if (revisited > 0) g.memory += Math.min(12, revisited * 2);

  // التركيز: يُبنى من الإتقان لا من الإجابة الواحدة
  if (input.bestStreak >= 5) g.focus += Math.min(20, Math.round(input.bestStreak * 1.5));
  if (input.perfect) g.focus += 15;

  return g;
}

/** الرتبة العليا لكل مجال (لمقارنة ما قبل/بعد الجولة). */
function tierSnapshot(domains: Record<string, { answered: number; correct: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cat, c] of Object.entries(domains)) out[cat] = masteryTierIndex(domainMastery(c));
  return out;
}

/**
 * يسجّل جولة كاملة: يبني القوى، يرقّي المستويات، يفتح التخصصات،
 * ويمنح مكافآت الإتقان مرة واحدة. يعيد تقريراً شفافاً للواجهة.
 */
export function recordMindSession(input: MindSessionInput): MindSessionReport {
  const before = facultyLevels(state);
  const gains = facultyGainsForSession(input, state.recalls);
  const totalGained = FACULTIES.reduce((sum, f) => sum + (gains[f.id] ?? 0), 0);

  // بناء القوى الجديدة + رصد الترقيات
  const faculty = { ...state.faculty };
  const report: FacultyGain[] = FACULTIES.map((f) => {
    const gained = gains[f.id] ?? 0;
    const prevXp = faculty[f.id] ?? 0;
    const nextXp = prevXp + gained;
    faculty[f.id] = nextXp;
    return {
      id: f.id,
      name: f.name,
      icon: f.icon,
      gained,
      level: facultyLevel(nextXp),
      leveledUp: facultyLevel(nextXp) > before[f.id],
    };
  });

  // ذاكرة الأسئلة: تحديث مع سقف ثابت يمنع التضخّم
  const recalls: Record<string, RecallRecord> = { ...state.recalls };
  input.questions.forEach((q, i) => {
    const picked = input.answers[i];
    if (picked === undefined || picked < 0) return;
    const cur = recalls[q.id] ?? { w: 0, r: 0 };
    const correct = q.correctIndex === picked;
    recalls[q.id] = { w: cur.w + (correct ? 0 : 1), r: cur.r + (correct ? 1 : 0) };
  });
  const keys = Object.keys(recalls);
  if (keys.length > RECALL_LIMIT) {
    for (const k of keys.slice(0, keys.length - RECALL_LIMIT)) delete recalls[k];
  }

  // الإتقان: نمنح مكافأة الرتبة الجديدة مرة واحدة فقط
  const domainTiers = { ...state.domainTiers };
  const nowTiers = tierSnapshot(input.domains);
  const masteryUps: MasteryUp[] = [];
  let masteryCoins = 0;
  for (const [cat, tier] of Object.entries(nowTiers)) {
    const prev = domainTiers[cat] ?? 0;
    if (tier <= prev) continue;
    domainTiers[cat] = tier;
    for (let t = prev + 1; t <= tier; t += 1) {
      const meta = MASTERY_TIERS[t];
      if (!meta) continue;
      masteryUps.push({ category: cat, tier: t, tierName: meta.name, tierIcon: meta.icon, reward: meta.reward });
      masteryCoins += meta.reward;
    }
  }

  const next: MindState = {
    ...state,
    faculty,
    recalls,
    domainTiers,
    totalSessions: state.totalSessions + 1,
    log: [
      { at: Date.now(), mode: input.mode, gained: totalGained, specs: [] },
      ...state.log,
    ].slice(0, 20),
  };

  const unlockedSpecs = unlockedSpecializations(next).filter(
    (def) => !unlockedSpecializations(state).some((old) => old.id === def.id),
  );

  // تخصيص تلقائي ذكي: إن كان لدى اللاعب مقعد فارغ، نشغّل أقوى تخصص مفتوح
  if (next.equipped.length < MAX_EQUIPPED && unlockedSpecs.length > 0) {
    const slots = MAX_EQUIPPED - next.equipped.length;
    const candidates = unlockedSpecs
      .slice()
      .sort((a, b) => effectWeight(b.effect) - effectWeight(a.effect))
      .slice(0, slots)
      .map((d) => d.id);
    next.equipped = [...next.equipped, ...candidates];
  }

  commit(next);

  return {
    gains: report.filter((r) => r.gained > 0),
    totalGained,
    masteryUps,
    masteryCoins,
    unlockedSpecs,
    identity: mindIdentity(next),
  };
}

/** وزن تقريبي للتأثير — للترتيب عند التخصيص التلقائي. */
function effectWeight(e: MindEffect): number {
  return e.xpPct + e.coinsPct + e.timeSec * 2 + Math.abs(e.rivalAccuracy) * 100 + e.streakShields * 5;
}

// ═══════════════════════════════════════════════════════════════════════
// إدارة التجهيز
// ═══════════════════════════════════════════════════════════════════════

export type EquipResult = "ok" | "not_unlocked" | "full" | "unknown";

/** يجهّز تخصصاً (٣ كحد أقصى) — وكل تخصص له تأثير حقيقي. */
export function equipSpecialization(id: string): EquipResult {
  const def = SPEC_MAP.get(id);
  if (!def) return "unknown";
  if (!isSpecUnlocked(def, state)) return "not_unlocked";
  if (state.equipped.includes(id)) return "ok";
  if (state.equipped.length >= MAX_EQUIPPED) return "full";
  commit({ ...state, equipped: [...state.equipped, id] });
  return "ok";
}

/** يزيل تخصصاً من التجهيز. */
export function unequipSpecialization(id: string): void {
  if (!state.equipped.includes(id)) return;
  commit({ ...state, equipped: state.equipped.filter((x) => x !== id) });
}

/** يبدّل مقعداً بمقعد آخر في نقرة واحدة (تجربة جهيز سريعة). */
export function swapSpecialization(slot: number, id: string): EquipResult {
  const def = SPEC_MAP.get(id);
  if (!def) return "unknown";
  if (!isSpecUnlocked(def, state)) return "not_unlocked";
  const equipped = [...state.equipped];
  if (slot < 0 || slot >= MAX_EQUIPPED) return equipSpecialization(id);
  if (equipped.includes(id)) return "ok";
  equipped[slot] = id;
  commit({ ...state, equipped: equipped.slice(0, MAX_EQUIPPED) });
  return "ok";
}

/**
 * منح رصيد قوة عقلية مباشرة.
 * تُستخدمها أدوات الإدارة (غرفة المالك) والاختبارات لإعداد حالات دقيقة.
 */
export function grantFacultyXp(id: FacultyId, amount: number): void {
  const cur = state.faculty[id] ?? 0;
  commit({ ...state, faculty: { ...state.faculty, [id]: Math.max(0, cur + amount) } });
}

/** يصفّر العقل المتطور بالكامل (للتصفير الشامل والاختبارات). */
export function resetEvolvedMind(): void {
  commit(emptyState());
}

/** وصف مختصر لتأثير (للعرض على بطاقة التخصص). */
export function describeEffect(e: MindEffect): string[] {
  const out: string[] = [];
  if (e.xpPct) out.push(`+${round(e.xpPct)}% خبرة`);
  if (e.coinsPct) out.push(`+${round(e.coinsPct)}% عملات`);
  if (e.timeSec) out.push(`+${round(e.timeSec)} ثانية لكل سؤال`);
  if (e.rivalAccuracy) out.push(`دقة الخصم ${round(e.rivalAccuracy * 100)}%`);
  if (e.streakShields) out.push(`${e.streakShields} درع سلسلة`);
  return out;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
