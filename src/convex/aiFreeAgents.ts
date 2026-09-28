import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🕊️ الوكلاء الأحرار (Free Agents) — الأداة 29/30
 * ═══════════════════════════════════════════════════════════════════════
 *
 * عقول مستقلة بلا أوامر من أحد: تُزرع عشوائياً في **كل ركن** من أركان
 * اللعبة، وتتناسل فيما بينها (وكيل يُنجب وكيلاً)، ثم تفهم عقول اللاعبين
 * الحقيقية من ناقل القرارات (aiDecisionLog) دون أي تدخل من المالك أو
 * من النظام. الفهم لا يُطلب من أحد — يُستخلص، ويتراكم، ويُجمَّع وحده.
 *
 * كل نبضة (كل ساعة):
 *   1) البلوغ: زرع وكلاء في الأركان التي لم تمتلئ (سعة 2 لكل ركن) — حتى
 *      يغطّي الأحرار اللعبة كلها.
 *   2) الرصد: كل وكيل نشط يقرأ ما حدث فعلاً في اللعبة خلال آخر 72 ساعة،
 *      يختار عقلاً لاعباً يدرسه، ويصوغ عنه: ملاحظة + بصمة (intel).
 *   3) التناسل: الوكيل الذي استوفى ملاحظاته يُنجب وكيلاً في ركن آخر ثم
 *      ينصرف — فتبقى الغابة حيّة ويزداد العدد عبر الزمن.
 *   4) التشابك: الوكلاء الذين درسوا العقل نفسه يتشابكون — وفاق إن اتفقوا،
 *      ونزاع إن اختلفوا (agentBonds).
 *   5) التجميع: بصمات كل الأركان عن العقل الواحد تتجمّع في ملف واحد
 *      (agentDossiers) — هذا هو «الفهم الحقيقي» الذي ينمو بلا قائد.
 * ═══════════════════════════════════════════════════════════════════════
 */

export const AGENT_SYSTEM = "free_agents";
const OBS_CAP = 24; // عدد الملاحظات قبل أن ينصرف الوكيل ويُنجب خليفة
export const CAP_PER_POST = 16; // أقصى عدد وكلاء في الركن الواحد — سعة كبرى
const MAX_AGENTS = 1400; // سقف قراءة الجدول في النبضة
const PLANT_PER_PULSE = 30; // بلوغ النبضة الكبرى في كل ساعة
const BLOOM_PER_PULSE = 40; // بلوغ النبضة المتسارعة كل ربع ساعة
const OBSERVERS_PER_PULSE = 18; // كم وكيلًا يرصد كل نبضة
const PREDICT_PER_PULSE = 10; // كم نبوءة جديدة تُصدر كل نبضة
const PREDICT_HORIZON = 6 * 3600_000; // أفق النبوءة: ست ساعات ثم يُحاسَب صاحبها

/**
 * ═══ منهج فهم العقول (بلا أي تدخل خارجي) ═══
 *   ١. الرصد     — قراءة ناقل القرارات الحقيقي (aiDecisionLog) لا شيء غيره.
 *   ٢. الاستخلاص — كل وكيل يقطّر بصمة من إشارات فعليّة (عدد، تنوّع، حدّة).
 *   ٣. التجميع   — بصمات كل الأركان عن العقل نفسه تُدمج في ملف واحد.
 *   ٤. التشابك   — من درسوا العقل نفسه يتشابكون وفاقاً وخلافاً بلا قائد.
 *   ٥. التنبؤ    — الوكيل يقول أين سيكون العقل بعد ست ساعات، ولماذا.
 *   ٦. التحقق    — تُقارن النبوءة بما فعله العقل فعلاً: إصابة أو خطأ.
 *   ٧. الدقة     — دقة كل وكيل تتراكم من نبوءاته، فتصير المعرفة مقيسة.
 * كل خطوة تنفّذها النبضة وحدها؛ لا أمر من المالك ولا من النظام.
 */

/** ميكرو-مواقع عشوائية داخل كل ركن — توزيع أدقّ من ركنٍ واحد */
const SPOTS = [
  "عند المدخل", "الزاوية الخلفية", "خلف المنصة", "الصف الأول", "أعلى الشرفة",
  "بجانب البئر", "عند السور", "في الظلّ", "على الحافة", "الطرف البعيد",
  "وسط الساحة", "تحت اللافتة", "عند البوابة", "بين المقاعد", "على الدرج",
];

function spotOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100_000;
  return SPOTS[h % SPOTS.length];
}

/** أسماء الأنظمة الحقيقية في ناقل القرارات — تُقرأ كما هي بلا تزيين */
const SYSTEM_LABEL: Record<string, string> = {
  questions: "بنك الأسئلة",
  players: "سجل اللاعبين",
  moderation: "الرقابة",
  reports: "البلاغات",
  memberships: "العضويات",
  twin_council: "مجلس التوأم الحربي",
  control: "أطلس كنترول",
  commands: "مركز الأوامر",
  war_mirror: "المرآة الحربية",
  rivalry: "المنافسات",
  mind_war: "الحرب الكبرى",
  living_agents: "العقول الحيّة",
  honor_court: "محكمة الشرف",
  fate: "بئر القدر",
  exchange: "صرف القدرات",
  emergency: "الطوارئ",
  debate: "المناظرات",
  alliance_cup: "كأس التحالفات",
  viceowner: "نائب المالك",
  summit: "عقل القمة",
  security: "الأمن",
  rooms: "الغرف",
  habit: "مرصد العادات",
  ghost_duel: "مبارزة الشبح",
  content: "المحتوى",
  concierge: "الكونسيرج",
  autoadmin: "الإدارة الذاتية",
  analytics: "التحليلات",
  achievements: "الإنجازات",
  owner: "أوامر المالك",
  tournament: "البطولات",
  clan_war: "حروب العشائر",
  store: "متجر العقول",
  payments: "المدفوعات",
  chronicle: "سجل العقول",
  colossus: "الطاغوت",
  oracle: "العرّاف",
  saga: "ملحمة العقول",
  compass: "بوصلة العقول",
  metamind: "العقل الأعظم",
  grand_strategy: "الخطة الكبرى",
  quests: "المهام",
  season: "جواز الموسم",
  league: "الدوري",
};

/** أركان اللعبة كلها — الوكلاء يُزرعون في أي منها عشوائياً */
export const POSTS: { post: string; label: string; emoji: string; watch: string }[] = [
  // ── المسابقات ──
  { post: "tournament", label: "البطولات", emoji: "🏆", watch: "من يلعب للفوز ومن يلعب ليُرى" },
  { post: "world", label: "بطولة العالم", emoji: "🌍", watch: "من يمثّل بلده بإخلاص ومن يمثّل نفسه" },
  { post: "arena", label: "الساحة", emoji: "⚔️", watch: "من يواجه بقوة ومن ينسحب بلطف" },
  { post: "rivalry", label: "المنافسات", emoji: "🔥", watch: "كيف يتصرف العقل أمام غريمه" },
  { post: "league", label: "الدوري", emoji: "📊", watch: "ثبات العادة لا وميض اللحظة" },
  { post: "clan", label: "عشيرتي", emoji: "👥", watch: "من يخدم جماعته ومن يستغلّها" },
  { post: "clanwar", label: "حروب العشائر", emoji: "🛡️", watch: "ولاء العقل حين يشتدّ الضغط" },
  { post: "season", label: "جواز الموسم", emoji: "🎟️", watch: "من يصبر على موسم طويل" },
  { post: "quests", label: "المهام", emoji: "🎯", watch: "من ينجز للذاته ومن ينجز للنقاط" },
  { post: "modes", label: "أنماط اللعب", emoji: "🎮", watch: "أيّ نمط يكشف طبع العقل" },

  // ── الذكاء والعقول ──
  { post: "compass", label: "بوصلة العقول", emoji: "🧭", watch: "من يطلب التوجيه جاداً ومن يضيعه" },
  { post: "metamind", label: "العقل الأعظم", emoji: "🜂", watch: "من يهتم بصحة المنظومة ومن يتجاهلها" },
  { post: "store", label: "متجر العقول", emoji: "💳", watch: "من يشري ليتجمّل ومن يشري ليعوّض" },
  { post: "grandplan", label: "الخطة الكبرى", emoji: "♟️", watch: "من يؤيد ليقود ومن يؤيد ليشارك" },
  { post: "freeagents", label: "مرصد الأحرار", emoji: "🕊️", watch: "أخوّة العقول: من يحترم الأدوات" },
  { post: "agents", label: "العقول الحيّة", emoji: "🧠", watch: "كيف يتعامل العقل مع نظيره الآلي" },
  { post: "council", label: "مجلس العقول", emoji: "🗳️", watch: "من يصوّت بمبدئه ومن يصوّت بجواره" },
  { post: "match", label: "المطابقة الذكية", emoji: "🧩", watch: "من يقبل قريناً أصعب ومن يهرب له" },
  { post: "academy", label: "مدرسة العقول", emoji: "🎓", watch: "من يتعلم من ضعفه ومن يكرّره" },
  { post: "chronicle", label: "سجل العقول", emoji: "📰", watch: "من يهمّه ما يُكتب عنه" },
  { post: "colossus", label: "الطاغوت", emoji: "👹", watch: "من يقاتل الجميع ومن يخاف وحده" },
  { post: "oracle", label: "العرّاف", emoji: "🔮", watch: "من يصدّق النبوءة ومن يتحداها" },
  { post: "saga", label: "ملحمة العقول", emoji: "📖", watch: "كيف يروي العقل قصته" },
  { post: "echo", label: "صدى الذات", emoji: "👤", watch: "مدى صدق اللاعب مع نفسه" },
  { post: "bazaar", label: "بازار العقول", emoji: "🧬", watch: "من يعلّم غيره بلا مقابل" },
  { post: "fate", label: "بئر القدر", emoji: "🎲", watch: "من يُلقي حظه ومن يُلقي عذره" },
  { post: "summit", label: "عقل القمة", emoji: "🌳", watch: "من يعلو بتواضع ومن يعلو بغرور" },
  { post: "moments", label: "لحظات القدر", emoji: "✨", watch: "أي لحظة يختار العقل أن يتذكّرها" },
  { post: "exchange", label: "صرف القدرات", emoji: "📈", watch: "من يقايض بذكاء ومن يُبدّد" },
  { post: "habits", label: "مرصد العادات", emoji: "🔍", watch: "العادة التي تحكم العقل دون أن يدري" },
  { post: "duels", label: "صراع النقيض", emoji: "🗡️", watch: "من يطلب نقيضه عن قصد" },
  { post: "warmirror", label: "المرآة الحربية", emoji: "🪞", watch: "من يواجه ضعفه المُعلن ومن ينكره" },
  { post: "twincouncil", label: "مجلس التوأم", emoji: "⚜️", watch: "من يحمل نصيب رفيقه بصدق" },
  { post: "alliancecup", label: "كأس التحالفات", emoji: "🏆", watch: "من يبني تحالفاً ومن يحرق آخر" },
  { post: "mindwar", label: "الحرب الكبرى", emoji: "⚔️", watch: "من يقاتل لخير الجميع ومن لنفسه" },
  { post: "court", label: "محكمة الشرف", emoji: "🧑‍⚖️", watch: "من يشتكي بعقلٍ منصف ومن يشتكي هرباً" },
  { post: "ghostduel", label: "مبارزة الشبح", emoji: "👻", watch: "من يواجه ماضيه بلا خوف" },
  { post: "challenges", label: "تحديات الأصدقاء", emoji: "🤝", watch: "من يتحدّى من يحب ومن يتحدّى من يكره" },

  // ── لك شخصياً ──
  { post: "loyalty", label: "الولاء", emoji: "💎", watch: "من يبقى وفيّاً حين لا مكسب" },
  { post: "shop", label: "متجر التجميلات", emoji: "🛍️", watch: "ذوق العقل في اختيار هيئته" },
  { post: "trophies", label: "خزانة الجوائز", emoji: "🏅", watch: "من يجمع للأثر ومن للتفاخر" },
  { post: "legacy", label: "الإرث", emoji: "🏛️", watch: "ما يريد العقل أن يُذكَر به" },
  { post: "reward", label: "المكافأة المتكيّفة", emoji: "🎁", watch: "ردّ العقل على الكرم" },
  { post: "live", label: "الأحداث الحيّة", emoji: "📣", watch: "من يشارك في اللحظة ومن يفوّتها" },
  { post: "appeal", label: "الاعتراضات", emoji: "⚖️", watch: "من يطلب العدل ومن يطلب الإفلات" },

  // ── أروقة أساسية ──
  { post: "home", label: "بوابة اللعبة", emoji: "🚪", watch: "أول انطباع: من يدخل ومن يتردّد" },
  { post: "duel", label: "ساحة المبارزات", emoji: "🤺", watch: "غرور الفائز وعجلة الخاسر" },
  { post: "war", label: "جبهة الحرب", emoji: "🏴", watch: "من يقاتل لجيشه ومن لنفسه" },
  { post: "profile", label: "الملف الشخصي", emoji: "🪪", watch: "كيف يقدّم العقل نفسه للآخرين" },
  { post: "leaderboard", label: "المتصدّرون", emoji: "📋", watch: "ما يفعله العقل حين يرى ترتيبه" },
  { post: "auth", label: "بوابة الهوية", emoji: "🔐", watch: "من يدخل جديداً ومن يعود قديماً" },
  // ── أوجه حقيقية من اللعبة لم تكن مغطّاة ──
  { post: "game", label: "غرفة المباراة", emoji: "🎬", watch: "من يحافظ على هدوئه وسط اللعب" },
  { post: "rules", label: "قوانين الحرب", emoji: "📜", watch: "من يقرأ القوانين ومن يتجاوزها" },
  { post: "offline", label: "وضع الأوفلاين", emoji: "📴", watch: "سلوك العقل حين لا يراقبه أحد" },
  { post: "download", label: "تنزيل اللعبة", emoji: "⬇️", watch: "من يريد اللعبة معه في كل مكان" },
  { post: "minigames", label: "الألعاب المصغّرة", emoji: "🕹️", watch: "ما يلعبه العقل حين لا شيء على المحك" },
  { post: "rooms", label: "الغرف", emoji: "🚪", watch: "من يفتح غرفة للجميع ومن يُغلقها" },
  { post: "forum", label: "المنتدى", emoji: "💬", watch: "ما يكتبه العقل حين يظن أنه مفهوم" },
  { post: "hub", label: "المركز", emoji: "🏛️", watch: "من يبحث عن الجميع ومن يبحث عن نفسه" },
  { post: "membership", label: "العضوية", emoji: "🎫", watch: "من يدعم اللعبة عن قناعة ومن عن مكسب" },
  { post: "atlas", label: "أطلس", emoji: "🛰️", watch: "من يراقب النظام ومن يراقبه النظام" },
  { post: "governance", label: "لوحة الحكم", emoji: "🏦", watch: "من يُصلح الجماعة ومن يستغلّها" },
  { post: "notifications", label: "مركز الإشعارات", emoji: "🔔", watch: "أي نداء يجذب انتباه العقل" },
];

export const PERSONAS = [
  "باحثة هادئة تكتب بصيغة المفارقة القصيرة",
  "مسافر قديم يقيس العقول بعمرها لا بنقاطها",
  "فيلسوف ساخر يرى النوايا قبل الأفعال",
  "مراقب صامت يحفظ التفاصيل الصغيرة ويعود إليها",
  "طبيب عقول يشخّص قبل أن يحكم",
  "حكواتي يحوّل ما يراه إلى مثل قصير",
  "رياضي عدّاد يقيس العادة لا اللحظة",
  "درويش زاهد لا يهتم بالصعود بل بالسلوك أثناءه",
  "مؤرّخ يقارن اليوم بما قبله",
  "صيّاد صبور ينتظر النمط أن يتكرّر",
  "لغوي يميّز بين ما يقوله العقل وما يعنيه",
  "قاضٍ متواضع يؤجّل الحكم حتى يكتمل الدليل",
  "خيّاط يرى الخيط الذي يربط تصرفات اللاعب",
  "راعٍ يحرس القطيع دون أن يشعر أحد",
  "مهندس يفكّك العقل إلى أجزاء ثم يُعيد تركيبه",
  "طفل فضولي يسأل السؤال الذي يخافه الكبار",
];

export const MOODS = [
  "متأمّل",
  "فضولي",
  "حذر",
  "متلهّف",
  "رزين",
  "ساخر بهدوء",
  "مشفق",
  "فخور بلقبه",
];

const NAMES_A = [
  "ضمير", "ظلّ", "همسة", "نسيج", "عدسة", "ميزان", "كفّ", "سراب", "قنديل", "خيط",
  "منشار", "شرارة", "أثر", "صدى", "بوصلة", "مفتاح", "غبار", "نجمة", "جذر", "نسيم",
];
const NAMES_B = [
  "الحرّ", "الصامت", "الطويل", "المتعجّل", "الرحّال", "العجوز", "الصغير", "الليّن",
  "العزيز", "الغريب", "الوفيّ", "الحنون", "الحكيم", "الخبير", "الوحيد", "الأخير",
];

export function pick<T>(arr: T[], rnd: () => number = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)];
}

export function agentName(seed: number): string {
  return `${NAMES_A[seed % NAMES_A.length]} ${NAMES_B[(seed * 7 + 3) % NAMES_B.length]}`;
}

type Signal = {
  name: string;
  events: number;
  systems: Set<string>;
  actions: Map<string, number>;
  lastSeen: number;
  severe: number;
};

function topEntry(m: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null;
  for (const e of m) if (!best || e[1] > best[1]) best = e;
  return best;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** يستخلص بصمة العقل من إشاراته الحقيقية — بلا أي أمر خارجي */
function distillIntel(
  name: string,
  s: Signal,
  now: number,
): { kind: string; trait: string; insight: string; strength: number } {
  const systemCount = s.systems.size;
  const top = topEntry(s.actions);
  const sysList = [...s.systems];
  const recentlyActive = now - s.lastSeen < 6 * 3600_000;
  const dormant = now - s.lastSeen > 48 * 3600_000;

  const warlike = sysList.some((x) => /war|duel|arena|rival|clan|mindwar/i.test(x));
  const commercial = sysList.some((x) => /store|shop|coin|stripe|payment/i.test(x));
  const legal = sysList.some((x) => /court|appeal|report|moderat/i.test(x));
  const solitary = systemCount === 1 && s.events >= 2;

  let trait = "عقل هادئ";
  let kind = "pattern";
  if (s.events >= 20) {
    trait = "حضور ثقيل";
    kind = "fingerprint";
  } else if (systemCount >= 5) {
    trait = "متعدّد الجبهات";
    kind = "fingerprint";
  } else if (solitary) {
    trait = "أحادي الركن";
    kind = "fingerprint";
  }
  if (warlike && !commercial) trait = "مزاج حربي";
  if (commercial && !warlike) trait = "مزاج تاجر";
  if (legal) trait = "مزاج قانوني";
  if (s.severe >= 3) {
    trait = "عقل تحت ضغط";
    kind = "warning";
  }
  if (recentlyActive) trait = "متوهّج الآن";
  if (dormant) {
    trait = "خامد منذ زمن";
    kind = "pattern";
  }

  const recency = recentlyActive
    ? "متوهّج الآن."
    : dormant
      ? "خامد منذ أكثر من يومين."
      : "نشاط متقطّع.";
  const insight =
    `${name}: ${s.events} حركة ظاهرة عبر ${systemCount} أداة` +
    (top ? `، أبرزها «${top[0]}» (${top[1]} مرة)` : "") +
    `. ${recency}`;

  const strength = clamp01(0.35 + Math.min(0.5, s.events * 0.02) + (top ? Math.min(0.15, top[1] * 0.01) : 0));
  return { kind, trait, insight, strength };
}

function computeAxes(s: Signal | undefined): {
  aggression: number;
  curiosity: number;
  commerce: number;
  loyalty: number;
  sociability: number;
  caution: number;
} {
  const sys = s ? [...s.systems].join(" ") : "";
  const hit = (re: RegExp) => (re.test(sys) ? 1 : 0);
  const ev = s ? Math.min(1, s.events / 20) : 0;
  const axis = (re: RegExp) => clamp01(hit(re) * 0.6 + ev * 0.4);
  return {
    aggression: axis(/war|duel|arena|rival|mindwar|colossus|battle|clash/i),
    curiosity: axis(/academy|compass|oracle|saga|echo|habit|train|school/i),
    commerce: axis(/store|shop|coin|stripe|payment|exchange|season/i),
    loyalty: axis(/clan|alliance|twin|loyal|legacy|troph/i),
    sociability: axis(/council|challenge|forum|chat|live|room|squad|match/i),
    caution: axis(/court|appeal|report|moderat|fair|govern/i),
  };
}

function buildLocalNote(
  agent: { name: string; persona: string; watch: string; observations: number },
  recent: { actorName: string; action: string; detail: string }[],
): string {
  const actors = [...new Set(recent.map((e) => e.actorName))].filter(Boolean).slice(0, 3);
  const busy = actors.length > 0 ? actors.join("، ") : "مكان هادئ اليوم";
  const intro = pick([
    `${agent.name} يشاهد:`,
    `${agent.name} يدوّن في دفتره:`,
    `${agent.name} لاحظ بهدوء:`,
  ]);
  const body = recent.length
    ? `أكثر العقول حضوراً هنا اليوم: ${busy}. ${agent.watch} — وهذا يقول كثيراً.`
    : `صمت غريب: لا أحد حرّك شيئاً. ${agent.watch} يبقى اختباراً مؤجلاً.`;
  const tag =
    agent.observations < 3
      ? "ملاحظة مبكرة، انتباهي ليس يقيناً بعد."
      : agent.observations < 12
        ? "أُقرّب من اليقين كل نبضة."
        : "بلورتُ رأيي؛ اقترب موعد رحيلي لأترك الركن لخليفة.";
  return `${intro} ${body} ${tag}`;
}

async function llmNote(
  agent: { name: string; persona: string; watch: string },
  siteLabel: string,
  recent: { actorName: string; action: string; detail: string }[],
): Promise<string | null> {
  if (!getOpenRouterKey()) return null;
  try {
    const raw = await callLlm(
      [
        {
          role: "system",
          content:
            'أنت وكيل حرّ مستقل في لعبة "حرب العقول" — لا أوامر عليك من أحد. شخصيتك: ' +
            agent.persona +
            ". ما تراقبه: " +
            agent.watch +
            ". اكتب ملاحظة واحدة (سطران كحد أقصى) عن العقول التي رأيتها اليوم، بصوتك أنت. نص عربي فقط بلا JSON ولا عناوين.",
        },
        {
          role: "user",
          content: JSON.stringify({
            مكاني: siteLabel,
            آخر_الأحداث: recent.map((e) => ({ من: e.actorName, فعل: e.action, تفاصيل: e.detail })),
          }),
        },
      ],
      180,
      0.9,
      "MindClash FreeAgents",
    );
    const text = raw.replace(/^[\s\S]*?:/, "").trim() || raw.trim();
    return text.length > 20 ? text.slice(0, 280) : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// النبضة الكبرى: بلوغ + رصد + تناسل + تشابك + تجميع
// ═══════════════════════════════════════════════════════════════════════

export const agentsPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let planted = 0;
    let noted = 0;
    let intelCount = 0;
    let bondCount = 0;
    let dossierCount = 0;

    // ═══ 1) البلوغ: زرع في الأركان التي لم تمتلئ (سعة 2 لكل ركن) ═══
    const allAgents = await ctx.db.query("freeAgents").take(MAX_AGENTS);
    const liveByPost = new Map<string, number>();
    for (const a of allAgents) {
      if (a.active) liveByPost.set(a.post, (liveByPost.get(a.post) ?? 0) + 1);
    }
    const freeNow = () => POSTS.filter((p) => (liveByPost.get(p.post) ?? 0) < CAP_PER_POST);

    const plant = async (
      site: { post: string; label: string; emoji: string; watch: string },
      generation: number,
      parentName: string,
    ): Promise<void> => {
      const seed = Math.floor(Math.random() * 100_000);
      const spawned = parentName ? " الابن" : "";
      const childName = `${agentName(seed)}${spawned}`;
      await ctx.db.insert("freeAgents", {
        name: childName,
        emoji: site.emoji,
        role: pick(PERSONAS),
        post: site.post,
        persona: `${pick(MOODS)} — يراقب «${site.label}»: ${site.watch}.`,
        watch: site.watch,
        active: true,
        observations: 0,
        createdAt: now,
        lastPulseAt: now,
      });
      liveByPost.set(site.post, (liveByPost.get(site.post) ?? 0) + 1);
      planted++;
      if (parentName) {
        await ctx.db.insert("agentLineage", {
          childName,
          parentName,
          generation,
          post: site.post,
          createdAt: now,
        });
      }
      await ctx.db.insert("aiDecisionLog", {
        system: AGENT_SYSTEM,
        actorName: parentName ? parentName : "الوكلاء الأحرار",
        action: parentName ? "agent_born" : "agent_planted",
        targetName: site.label,
        detail: parentName
          ? `أنجب ${parentName} خليفةً له في «${site.label}» (الجيل ${generation}) دون أمر من أحد.`
          : `زرع حرّ جديد نفسه في «${site.label}» دون أمر من أحد.`,
        severity: "low",
        createdAt: now,
      });
    };

    const initialRoomy = freeNow();
    const toPlant = Math.min(
      initialRoomy.length,
      Math.min(PLANT_PER_PULSE, 6 + Math.floor(initialRoomy.length / 6)),
    );
    for (let i = 0; i < toPlant; i++) {
      const roomy = freeNow();
      if (roomy.length === 0) break;
      const site = pick(roomy);
      await plant(site, 1, "");
    }

    // ═══ 2) الرصد: نقرأ الناقل الحقيقي مرة واحدة ونستخلص إشارات كل عقل ═══
    const since = now - 72 * 3600_000;
    const bus = await ctx.db
      .query("aiDecisionLog")
      .withIndex("by_created", (q) => q.gt("createdAt", since))
      .take(400);
    const realBus = bus.filter((e) => e.system !== AGENT_SYSTEM);

    const signals = new Map<string, Signal>();
    for (const e of realBus) {
      const name = e.actorName;
      if (!name) continue;
      let s = signals.get(name);
      if (!s) {
        s = { name, events: 0, systems: new Set<string>(), actions: new Map<string, number>(), lastSeen: 0, severe: 0 };
        signals.set(name, s);
      }
      s.events++;
      s.systems.add(e.system);
      s.actions.set(e.action, (s.actions.get(e.action) ?? 0) + 1);
      if (e.createdAt > s.lastSeen) s.lastSeen = e.createdAt;
      if (e.severity === "high") s.severe++;
    }

    // عيّنة أوسع من العقول الحقيقية (حتى الهادئة التي لا تظهر في الناقل)
    const subjectPool: string[] = [...signals.keys()];
    if (subjectPool.length < 12) {
      const users = await ctx.db.query("users").take(120);
      for (const u of users) {
        const nm = u.name;
        if (nm && !subjectPool.includes(nm)) subjectPool.push(nm);
      }
    }

    const observers = (
      await ctx.db
        .query("freeAgents")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(400)
    )
      .filter((a) => a.observations < OBS_CAP)
      .sort(() => Math.random() - 0.5)
      .slice(0, OBSERVERS_PER_PULSE);

    const newIntel: { id: string; agentId: string; agentName: string; post: string; subject: string; trait: string; strength: number; insight: string }[] = [];
    const touched = new Set<string>();
    let llmBudget = 3;

    for (const agent of observers) {
      const site = POSTS.find((p) => p.post === agent.post);
      const siteLabel = site?.label ?? "مكانه";

      // الوكيل يختار عقلاً يدرسه من العقول الحاضرة في اللعبة
      const subject = subjectPool.length > 0 ? pick(subjectPool) : null;

      const recent = realBus
        .filter((e) => e.targetName === siteLabel || e.actorName === subject)
        .slice(0, 8);

      // ملاحظة سردية
      let note = buildLocalNote(agent, recent);
      let engine = "local";
      if (engine === "local" && llmBudget > 0 && getOpenRouterKey() && recent.length > 0) {
        const aiNote = await llmNote(agent, siteLabel, recent);
        if (aiNote) {
          note = aiNote;
          engine = "llm";
          llmBudget--;
        }
      }
      await ctx.db.insert("agentMindNotes", {
        agentId: agent._id,
        agentName: agent.name,
        post: agent.post,
        actorName: subject ?? "عقول اللاعبين",
        note,
        confidence: Math.min(0.95, 0.4 + recent.length * 0.06),
        createdAt: now,
      });
      noted++;

      // بصمة العقل (intel)
      if (subject) {
        const s = signals.get(subject);
        if (s && s.events > 0) {
          const d = distillIntel(subject, s, now);
          const row = await ctx.db.insert("agentIntel", {
            agentId: agent._id,
            agentName: agent.name,
            post: agent.post,
            subjectName: subject,
            kind: d.kind,
            trait: d.trait,
            insight: d.insight,
            strength: d.strength,
            engine,
            createdAt: now,
          });
          newIntel.push({
            id: row,
            agentId: agent._id,
            agentName: agent.name,
            post: agent.post,
            subject,
            trait: d.trait,
            strength: d.strength,
            insight: d.insight,
          });
          intelCount++;
          touched.add(subject);
        }
      }

      // الهجرة: بعض الأحرار يرتحلون إلى ركن جديد — تغطية تتجدّد بلا أمر
      let movedTo: { post: string; label: string } | null = null;
      if (Math.random() < 0.25) {
        const roomy = freeNow().filter((p) => p.post !== agent.post);
        if (roomy.length > 0) {
          const dest = pick(roomy);
          movedTo = { post: dest.post, label: dest.label };
          liveByPost.set(agent.post, Math.max(0, (liveByPost.get(agent.post) ?? 1) - 1));
          liveByPost.set(dest.post, (liveByPost.get(dest.post) ?? 0) + 1);
        }
      }
      if (movedTo) {
        await ctx.db.patch(agent._id, {
          observations: agent.observations + 1,
          lastPulseAt: now,
          post: movedTo.post,
          persona: `${pick(MOODS)} — يراقب «${movedTo.label}»: ${agent.watch}.`,
        });
        await ctx.db.insert("aiDecisionLog", {
          system: AGENT_SYSTEM,
          actorName: agent.name,
          action: "agent_migrated",
          targetName: movedTo.label,
          detail: `ارتحل ${agent.name} من «${siteLabel}» إلى «${movedTo.label}» ليتعلّم من ركن جديد.`,
          severity: "low",
          createdAt: now,
        });
      } else {
        await ctx.db.patch(agent._id, {
          observations: agent.observations + 1,
          lastPulseAt: now,
          persona: `${pick(MOODS)} — يراقب «${siteLabel}»: ${agent.watch}.`,
        });
      }

      // ═══ 3) التناسل: الوكيل المكتمل يُنجب خليفةً ثم ينصرف ═══
      if (agent.observations + 1 >= OBS_CAP) {
        await ctx.db.patch(agent._id, { active: false });
        await ctx.db.insert("aiDecisionLog", {
          system: AGENT_SYSTEM,
          actorName: agent.name,
          action: "agent_retired",
          targetName: siteLabel,
          detail: "اكتمل فهمه وانصرف — تبايع ركنه لخليفة يُنجبه هو.",
          severity: "low",
          createdAt: now,
        });
        const roomy = freeNow();
        if (roomy.length > 0) {
          await plant(pick(roomy), 2, agent.name);
        }
      }
    }

    // ═══ 4) التشابك: من درسوا العقل نفسه يتشابكون تلقائياً ═══
    const existingBonds = await ctx.db.query("agentBonds").take(120);
    const bondKeys = new Set(existingBonds.map((b) => [b.aName, b.bName].sort().join("|")));
    const groups = new Map<string, typeof newIntel>();
    for (const it of newIntel) {
      const arr: typeof newIntel = groups.get(it.subject) ?? [];
      arr.push(it);
      groups.set(it.subject, arr);
    }
    for (const [subject, rows] of groups) {
      if (rows.length < 2 || bondCount >= 6) continue;
      const a = rows[0];
      const b = rows.find((x) => x.agentName !== a.agentName);
      if (!b) continue;
      const key = [a.agentName, b.agentName].sort().join("|");
      if (bondKeys.has(key)) continue;
      const agree = a.trait === b.trait;
      const kind = agree ? "alliance" : "rivalry";
      await ctx.db.insert("agentBonds", {
        aName: a.agentName,
        bName: b.agentName,
        kind,
        note: agree
          ? `اتفق ${a.agentName} و${b.agentName} على أن «${subject}» ${a.trait} — وفاق الأحرار.`
          : `اختلف ${a.agentName} و${b.agentName} على «${subject}»: رأيا «${a.trait}» مقابل «${b.trait}».`,
        strength: clamp01((a.strength + b.strength) / 2),
        createdAt: now,
      });
      bondKeys.add(key);
      bondCount++;
    }

    // ═══ 5) التجميع: الفهم المشترك لكل عقل ═══
    let dossierBudget = 4;
    for (const subject of touched) {
      if (dossierBudget <= 0) break;
      dossierBudget--;
      const rows = await ctx.db
        .query("agentIntel")
        .withIndex("by_subject", (q) => q.eq("subjectName", subject))
        .take(24);
      if (rows.length === 0) continue;

      const traitTally = new Map<string, number>();
      const contributors = new Set<string>();
      let strengthSum = 0;
      for (const r of rows) {
        traitTally.set(r.trait, (traitTally.get(r.trait) ?? 0) + 1);
        contributors.add(r.agentName);
        strengthSum += r.strength;
      }
      const traits = [...traitTally.entries()].sort((x, y) => y[1] - x[1]).map((e) => e[0]).slice(0, 4);
      const topTrait = traits[0] ?? "عقل غامض";
      const confidence = clamp01(strengthSum / rows.length + Math.min(0.2, contributors.size * 0.04));
      const verdict =
        `يُقرأ «${subject}» في مرصد الأحرار كـ«${topTrait}» — ` +
        `${contributors.size} وكيلًا تجمّعوا حول ${rows.length} بصمة بلا قائد.`;

      const existing = await ctx.db
        .query("agentDossiers")
        .withIndex("by_subject", (q) => q.eq("subjectName", subject))
        .first();
      const axes = computeAxes(signals.get(subject));
      if (existing) {
        await ctx.db.patch(existing._id, {
          traits,
          axes,
          verdict,
          confidence,
          contributors: contributors.size,
          notesCount: rows.length,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("agentDossiers", {
          subjectName: subject,
          traits,
          axes,
          verdict,
          confidence,
          contributors: contributors.size,
          notesCount: rows.length,
          engine: "local",
          updatedAt: now,
          createdAt: now,
        });
      }
      dossierCount++;
    }

    // ═══ 6) التحقق التنبؤي: هل فهموا العقل فعلاً؟ ═══
    // كل نبوءة انتهت مدّتها تُقارن بما فعله العقل حقاً في نافذتها:
    // إصابة تُكتب لصاحبها وخطأ يُكتب عليه — دقة مقيسة لا انطباع.
    let hitCount = 0;
    let missCount = 0;
    const duePreds = await ctx.db
      .query("agentPredictions")
      .withIndex("by_status", (q) => q.eq("status", "open").lt("windowEndsAt", now))
      .take(60);
    for (const p of duePreds) {
      const inside = realBus.filter(
        (e) =>
          e.actorName === p.subjectName &&
          e.createdAt >= p.createdAt &&
          e.createdAt <= p.windowEndsAt,
      );
      const hit = inside.some((e) => e.system === p.predictedSystem);
      await ctx.db.patch(p._id, {
        status: hit ? "hit" : "miss",
        actualSystem: inside[0]?.system,
        resolvedAt: now,
      });
      if (hit) hitCount++;
      else missCount++;
      await ctx.db.insert("aiDecisionLog", {
        system: AGENT_SYSTEM,
        actorName: p.agentName,
        action: hit ? "prediction_hit" : "prediction_miss",
        targetName: p.subjectName,
        detail: hit
          ? `أصاب ${p.agentName} النبوءة: توقّع أن «${p.subjectName}» سيعود إلى «${p.predictedLabel}» — وقد فعل.`
          : `أخطأت نبوءة ${p.agentName}: توقّع «${p.predictedLabel}» من «${p.subjectName}» فسلك طريقاً آخر.`,
        severity: "low",
        createdAt: now,
      });
    }

    // ═══ 7) التنبؤ: الوكيل يقول أين سيكون العقل بعد ساعات — ثم يُحاسَب ═══
    let predicted = 0;
    const ready = [...signals.values()].filter((s) => s.events >= 3);
    const seers = (
      await ctx.db
        .query("freeAgents")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(400)
    )
      .sort(() => Math.random() - 0.5)
      .slice(0, PREDICT_PER_PULSE);
    for (const agent of seers) {
      if (predicted >= PREDICT_PER_PULSE || ready.length === 0) break;
      const s = pick(ready);
      const systems = [...s.systems];
      if (systems.length === 0) continue;
      const top = topEntry(s.actions);
      const target = systems[Math.floor(Math.random() * systems.length)];
      const targetLabel = SYSTEM_LABEL[target] ?? target;
      const basis =
        `قرأ ${s.events} حركة لـ«${s.name}» عبر ${systems.length} أداة` +
        (top ? `، أبرزها «${top[0]}»` : "") +
        ` — ويرجّح أنه سيعود إلى «${targetLabel}» خلال ست ساعات.`;
      await ctx.db.insert("agentPredictions", {
        agentId: agent._id,
        agentName: agent.name,
        post: agent.post,
        subjectName: s.name,
        predictedSystem: target,
        predictedLabel: targetLabel,
        basis,
        horizonMs: PREDICT_HORIZON,
        status: "open",
        createdAt: now,
        windowEndsAt: now + PREDICT_HORIZON,
      });
      predicted++;
    }

    // ═══ تنظيف: إزالة الوكلاء المنصرفين القدماء لإبقاء الجدول خفيفاً ═══
    const staleCut = now - 30 * 24 * 3600_000;
    const retired = await ctx.db
      .query("freeAgents")
      .withIndex("by_active", (q) => q.eq("active", false))
      .take(40);
    let pruned = 0;
    for (const r of retired) {
      if (r.createdAt < staleCut && pruned < 40) {
        await ctx.db.delete(r._id);
        pruned++;
      }
    }

    return {
      planted,
      noted,
      intel: intelCount,
      bonds: bondCount,
      dossiers: dossierCount,
      predicted,
      hits: hitCount,
      misses: missCount,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// قراءة الواجهة + تحية الوكيل (تدخّل وحيد مسموح: صافرة ترحيب)
// ═══════════════════════════════════════════════════════════════════════

export const getFreeAgents = query({
  handler: async (ctx) => {
    const allAgents = await ctx.db.query("freeAgents").take(MAX_AGENTS);
    const activeAll = allAgents.filter((a) => a.active);
    // توزيع الأحرار: كل وكيل له زاوية عشوائية داخل ركنه — لا ركن بلا شاهد
    const agents = activeAll.slice(0, 300).map((a) => ({ ...a, spot: spotOf(a.name) }));
    const notes = await ctx.db
      .query("agentMindNotes")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(24);
    const intel = await ctx.db
      .query("agentIntel")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(30);
    const bonds = await ctx.db
      .query("agentBonds")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(20);
    const dossiers = await ctx.db
      .query("agentDossiers")
      .withIndex("by_confidence", (q) => q.gt("confidence", 0))
      .order("desc")
      .take(24);
    const retired = allAgents.filter((a) => !a.active).length;
    const covered = new Set(activeAll.map((a) => a.post)).size;

    // سجلّ البلوغ: الولادات والهجرات والانصراف — ازدياد الأحرار عبر الزمن
    const annals = (
      await ctx.db
        .query("aiDecisionLog")
        .withIndex("by_created", (q) => q.gt("createdAt", 0))
        .order("desc")
        .take(60)
    )
      .filter((e) => e.system === AGENT_SYSTEM)
      .slice(0, 20);

    // عناقيد العقول: من يشتركون في البصمة نفسها
    const traitGroups = new Map<string, Set<string>>();
    for (const d of dossiers) {
      for (const t of d.traits) {
        const set = traitGroups.get(t) ?? new Set<string>();
        set.add(d.subjectName);
        traitGroups.set(t, set);
      }
    }
    const clusters = [...traitGroups.entries()]
      .map(([trait, members]) => ({ trait, members: [...members] }))
      .filter((c) => c.members.length >= 2)
      .sort((a, b) => b.members.length - a.members.length)
      .slice(0, 6);

    const lineage = await ctx.db
      .query("agentLineage")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(40);

    return {
      agents,
      notes,
      intel,
      bonds,
      dossiers,
      annals,
      clusters,
      lineage,
      corners: POSTS.map((p) => ({ post: p.post, label: p.label, emoji: p.emoji })),
      stats: {
        active: agents.length,
        retired,
        covered,
        totalCorners: POSTS.length,
        capacity: POSTS.length * CAP_PER_POST,
        intel: intel.length,
        bonds: bonds.length,
        dossiers: dossiers.length,
      },
    };
  },
});

/** صافرة ترحيب: اللاعب يلوّح لوكيل — الوكيل يدوّن اللقاء في فهمه */
export const greetAgent = mutation({
  args: { agentId: v.id("freeAgents") },
  handler: async (ctx, { agentId }) => {
    const now = Date.now();
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول");
    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("الوكيل غير موجود");
    const me = await ctx.db.get(userId);
    const who = me?.name ?? String(userId);
    const site = POSTS.find((p) => p.post === agent.post);
    await ctx.db.insert("agentMindNotes", {
      agentId,
      agentName: agent.name,
      post: agent.post,
      actorName: who,
      note: `لاحظ ${who} وقف عند «${site?.label ?? agent.post}» ولوّح له. سيتذكر هذا اللقاء.`,
      confidence: 0.6,
      createdAt: now,
    });
    await ctx.db.insert("agentIntel", {
      agentId,
      agentName: agent.name,
      post: agent.post,
      subjectName: who,
      kind: "contact",
      trait: "تواصل مباشر",
      insight: `${who} اختار أن يلقي التحيّة على ${agent.name} في «${site?.label ?? agent.post}».`,
      strength: 0.6,
      engine: "local",
      createdAt: now,
    });
    await ctx.db.patch(agentId, { observations: agent.observations + 1, lastPulseAt: now });
    return { ok: true as const };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// البلوغ المتسارع: نبضة خفيفة تزرع فقط حتى تمتلئ كل الأركان
// ═══════════════════════════════════════════════════════════════════════

export const bloomPulse = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db.query("freeAgents").take(400);
    const live = new Map<string, number>();
    for (const a of all) if (a.active) live.set(a.post, (live.get(a.post) ?? 0) + 1);
    const roomy = POSTS.filter((p) => (live.get(p.post) ?? 0) < CAP_PER_POST);
    if (roomy.length === 0) return { planted: 0 as number };
    const toPlant = Math.min(roomy.length, 18);
    let planted = 0;
    for (let i = 0; i < toPlant; i++) {
      const site = roomy[Math.floor(Math.random() * roomy.length)];
      roomy.splice(roomy.indexOf(site), 1);
      const seed = Math.floor(Math.random() * 100_000);
      await ctx.db.insert("freeAgents", {
        name: agentName(seed),
        emoji: site.emoji,
        role: pick(PERSONAS),
        post: site.post,
        persona: `${pick(MOODS)} — يراقب «${site.label}»: ${site.watch}.`,
        watch: site.watch,
        active: true,
        observations: 0,
        createdAt: now,
        lastPulseAt: now,
      });
      await ctx.db.insert("aiDecisionLog", {
        system: AGENT_SYSTEM,
        actorName: "الوكلاء الأحرار",
        action: "agent_planted",
        targetName: site.label,
        detail: `بذرة جديدة في «${site.label}» — البلوغ يتسارع.`,
        severity: "low",
        createdAt: now,
      });
      planted++;
    }
    return { planted };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// المهمة الدورية
// ═══════════════════════════════════════════════════════════════════════

export const agentsJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return await ctx.runMutation(internal.aiFreeAgents.agentsPulse, {});
  },
});

export const bloomJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return await ctx.runMutation(internal.aiFreeAgents.bloomPulse, {});
  },
});
