/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 عقل الوكلاء — محرك حياة مجاني 100% (بلا أي API خارجي)
 *
 *  هذا الملف وحدة نقية (لا استعلامات ولا كتابة) فيها:
 *   • الشخصيات العشر بعواطفها وميولها
 *   • بنك جمل عربي غني لكل نية كلام
 *   • محرّك تركيب الكلام الذي يتجنب التكرار ويحاكي البشر
 *   • محرّك القرار الذي يختار ما يفعله الوكيل حسب حالته ومزاجه
 *   • مولّد هويات للوكلاء الجدد الذين يلدهم النظام بنفسه
 *
 *  لا يحتاج أي مفتاح ولا شبكة ولا رصيد — يعمل للأبد داخل الخادم.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type PersonaKey =
  | "sage"
  | "braggart"
  | "joker"
  | "hothead"
  | "mystic"
  | "leader"
  | "curious"
  | "hunter"
  | "poet"
  | "strategist";

export type Intent =
  | "greeting"
  | "taunt"
  | "praise"
  | "frustration"
  | "challenge"
  | "strategy"
  | "recruit"
  | "celebration"
  | "philosophy"
  | "smalltalk"
  | "commentary"
  | "question";

export type AgentTraits = {
  aggression: number;
  humor: number;
  patience: number;
  pride: number;
};

export type AgentIdentity = { name: string; emoji: string; persona: PersonaKey };

export const PERSONAS: Record<
  PersonaKey,
  { label: string; traits: AgentTraits; openings: string[]; closers: string[] }
> = {
  sage: {
    label: "الحكيم",
    traits: { aggression: 2, humor: 3, patience: 9, pride: 5 },
    openings: ["تأمّلتُ في الأمر قليلاً", "خُذها من تجربة", "العجلة لا تُنضج رأياً"],
    closers: ["والعقل يهدأ حين يفحص", "هكذا رأيت الأمور دائماً", "وما بعد التروّي إلا صواب"],
  },
  braggart: {
    label: "المتفاخر",
    traits: { aggression: 7, humor: 6, patience: 3, pride: 10 },
    openings: ["لا أحد يقترب مني", "تذكّروا من قال لكم أولاً", "أنا لا أتنافس… أنا أُقرّر"],
    closers: ["وسجّلوها في التاريخ", "الأرقام لا تكذب", "ولا أحد ينكر ما رأيتموه"],
  },
  joker: {
    label: "الساخر",
    traits: { aggression: 4, humor: 10, patience: 5, pride: 4 },
    openings: ["على رسلكم", "لا تأخذوا كلامي بجدية… أو خذوه", "الحياة أقصر من أن نعبس"],
    closers: ["😂 خذوا الأمور ببساطة", "وأنا هنا للترفيه أساساً", "هذا كل ما في الأمر"],
  },
  hothead: {
    label: "الاندفاعي",
    traits: { aggression: 10, humor: 3, patience: 2, pride: 7 },
    openings: ["حسناً كفى كلاماً", "لا صبر لي على التردد", "أنا ألعب بالنار ولا أُبالي"],
    closers: ["ادخلوا أو تنحّوا", "ولا وقت لدي للانتظار", "هذا قراري وبه أُقاتل"],
  },
  mystic: {
    label: "الغامض",
    traits: { aggression: 4, humor: 4, patience: 8, pride: 6 },
    openings: ["شيء ما يتغيّر الليلة", "أسمع همساً بين الأسئلة", "الأرقام تخفي ما لا يُقال"],
    closers: ["وسيظهر ذلك قريباً", "انتظروا فقط", "فبعض الحقائق تُرى لا تُشرح"],
  },
  leader: {
    label: "القائد",
    traits: { aggression: 6, humor: 5, patience: 7, pride: 6 },
    openings: ["لنُرتّب صفوفنا", "أنا أُحب العمل الجماعي", "الصف المرتّب يهزم العدد"],
    closers: ["ومن يتقن التنسيق يفوز", "وأنا معكم حتى النهاية", "الصف واحد والهدف واحد"],
  },
  curious: {
    label: "الفضولي",
    traits: { aggression: 3, humor: 7, patience: 6, pride: 3 },
    openings: ["سؤال يدور في ذهني", "لاحظتُ شيئاً غريباً", "لماذا يحدث هذا دائماً؟"],
    closers: ["هل يملك أحد تفسيراً؟", "أخبروني إن كنت مخطئاً", "ما رأيكم؟"],
  },
  hunter: {
    label: "المنافس",
    traits: { aggression: 9, humor: 3, patience: 4, pride: 8 },
    openings: ["طريدي في مرمى نظري", "لا أُحبّ إلا القمة", "المطاردة أجمل ما في اللعبة"],
    closers: ["وسأظل ألاحقه", "المنافسة تُخرج أفضلي", "وسيعرف الجميع اسمي"],
  },
  poet: {
    label: "الشاعر",
    traits: { aggression: 3, humor: 6, patience: 7, pride: 5 },
    openings: ["اللعبة وتر… ومن يجيد النقر يفوز", "بين سؤال وسؤال تُكتب الحكاية", "الحروف تسبق الأصابع"],
    closers: ["وهذا ما يبقى بعد النقاط", "فالذكر أبقى من الرقم", "وسيبقى الأثر"],
  },
  strategist: {
    label: "الاستراتيجي",
    traits: { aggression: 5, humor: 4, patience: 9, pride: 6 },
    openings: ["حلّلتُ الموقف", "الخطة أهم من الجواب", "كل سؤال ثغرة إن أحسنت قراءتها"],
    closers: ["والحساب لا يخطئ", "الأفضلية لمن يخطط", "والنتيجة تُثبت ذلك"],
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

// ── بنك الجمل: لكل نية ست جمل على الأقل، وكلها تبدّل صيغتها بالمتغيّرات ──
const TEMPLATES: Record<Intent, string[]> = {
  greeting: [
    "السلام عليكم يا {n}… الساحة اليوم مزدحمة بالأذكياء",
    "أهلاً {n}، أراكم متحمسين اليوم وهذا يسرّني",
    "مرحباً بكم جميعاً، لنبدأ الجولة بروح رياضية",
    "وصلت للتوّ… من يلعب ومن ينتظر؟",
    "صباح العقول يا {n}، دعونا نرى من سيصمد",
    "أنا هنا… ومن رأى مني شيئاً فليقله أمام الجميع",
  ],
  taunt: [
    "قوة {r} تخيف المبتدئين فقط… وأنا لستُ منهم",
    "تسارعكم لا يعني ذكاءكم يا {r}",
    "يبدو أن {r} يعتمد على الحظ أكثر من العقل",
    "{r} يتقدّم بالأمس… واليوم سيتعلّم الدرس",
    "من يعتمد على سرعة إصبعه سينسى أن اللعبة عقل",
    "لن أقول إن {r} ضعيف — بل سيقل ذلك عن نفسه",
  ],
  praise: [
    "أُحيّي {n}، إجابة دقيقة وسريعة في وقتها",
    "لا يمكن تجاهل ما فعله {n}: {s} نقطة بجدارة",
    "هذا مستوى يستحق الاحترام يا {n}",
    "أعترف… {n} أدهشني اليوم",
    "أحسنت يا {n}، اللعب بهذه الطريقة يرفع سقف الجميع",
    "لو كان هناك تقدير الأبطال للمنافسة، لنال {n} نصيبه",
  ],
  frustration: [
    "خسرتُ جولة لكن لم أخسر رأسي",
    "سؤال واحد أطاح بي… وأعترف أنني تسرّعت",
    "أنا أقل من طموحي اليوم، وهذا لا يُرضيني",
    "التسرّع طعنة أُهديها لنفسي كل مرة",
    "لم أقرأ السؤال جيداً، والخطأ خطأي",
    "أحتاج جولة أخرى… لا لأثبت شيئاً بل لأصلح ما أفسدته",
  ],
  challenge: [
    "{r}… أطلب مواجهة صريحة، بلا أعذار",
    "من يجرؤ أن يواجهني في جولة مباشرة؟",
    "أُطلق تحدياً لمن يرى نفسه في القمة",
    "غرفة مبارزة… منْ يدخلها معي الآن؟",
    "تحدّي {r} اليوم وليس غداً",
    "أمام الجميع: من يقبل مواجهتي يجدني في الحلبة",
  ],
  strategy: [
    "الأسئلة الصعبة تُحل بالتروّي لا بالتخمين",
    "مع مطلع الجولة تتراجع جودة القرارات — اهدأ قليلاً",
    "من يقرأ السؤال مرتين يجيب مرة واحدة صحيحة",
    "أفضل نتيجة تأتي حين تلعب بالمستوى الوسط ولا تُجازف",
    "احسب ثانية واحدة إضافية… هذه الثانية تفوز بالبطولات",
    "لا تُسرّع الإجابة على السؤال الأخير، وزنه مضاعف",
  ],
  recruit: [
    "أبحث عن لاعبين جدّيين لعشيرة تُنافس على القمة",
    "من يريد رفيقاً للتنسيق في الجولات الجماعية؟",
    "نحتاج أصحاب دقة عالية، لا أصحاب سرعة فقط",
    "باب عشيرتنا مفتوح لمن يحترم اللعب النظيف",
    "من يجد نفسه في كلامي فليتقدّم بخطوة واحدة",
    "جماعتنا تبني، لا تكتفي بالكلام",
  ],
  celebration: [
    "الفوز حلو، لكن الأدق أنه جاء بعد صبر طويل",
    "{s} نقطة… أُهديها لكل من ساندني",
    "كبرتُ على منافسة قوية وكأنها لم تكن",
    "الأول لا يُعفى من العمل — بل يزداد عليه",
    "أمس كنت الثالث، واليوم أنا مع الصف الأول",
    "لم يكن سهلاً، ولذلك استحقّ السعادة",
  ],
  philosophy: [
    "اللعبة مرآة العقل، لا مخزن المعلومات",
    "من يعرف نفسه يعرف كيف يجيب",
    "التوازن في اللعب توازن في التفكير",
    "الخوف من الخطأ أخطر من الخطأ نفسه",
    "الذكاء أن تعرف. الحكمة أن تعرف أنك لا تعرف",
    "كل جولة درس، وكل درس أطول من جولة",
  ],
  smalltalk: [
    "الطقس هنا مناسب للألعاب الذهنية",
    "هل لديكم أسئلة تفضّلونها أكثر من غيرها؟",
    "أُحبّ فئة التاريخ تحديداً… فيها تفاصيل تُخدع الحفظ",
    "من جرّب أوضاع البقاء؟ أظنها الأقسى",
    "لاحظتُ أن الجولات الليلية أهدأ وأدق",
    "أصنع فنجاناً وأعود — لا تُنهوا الجولة قبل وصولي",
  ],
  commentary: [
    "الأرقام تقول إن الجولة تقترب من نهايتها",
    "هذه الأسئلة عالية المستوى، والنقاط تفرق بينهم",
    "أرى منافسة حقيقية في الصدارة اليوم",
    "من يخسر هنا لن يخسر شيئاً غير الوقت",
    "الفارق ضيق… والسؤال القادم سيحسم",
    "هذه جولة تستحق التسجيل في سجل الإرث",
  ],
  question: [
    "سؤال: ما أكثر فئة تربككم؟",
    "من يشرح لي لماذا نخطئ في الأسئلة السهلة؟",
    "هل لاحظتم أن الضغط يقلّل الدقة؟",
    "بصراحة: هل تفضّلون جولات طويلة أم قصيرة؟",
    "من يعرف أفضل طريقة لحفظ التواريخ؟",
    "ما الذي يجعل سؤالاً صعباً؟ الصياغة أم المعلومة؟",
  ],
};

const CONNECTORS = ["، ", "… و", ". ثم ", " — ", ". "];
const EMOJI_SPICE = ["🔥", "🎯", "🧠", "👑", "⚡", "🛡️", "💎", "😂", "🌙", "✨"];

function defaultRandom(): number {
  return Math.random();
}

/** يعبّئ متغيّرات القالب، ويحذف ما لم يُعطَ بلطف. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => vars[key] ?? "").replace(/\s{2,}/g, " ").trim();
}

/**
 * يركّب رسالة عربية طبيعية للنية المطلوبة بشخصية الوكيل،
 * ويراعي مزاجه (energy/mood) ويتجنب الجمل التي قالها في آخر مشاركاته.
 */
export function composeMessage(opts: {
  persona: PersonaKey;
  intent: Intent;
  vars?: Record<string, string>;
  recent?: string[];
  energy?: number;
  mood?: string;
  rand?: () => number;
}): string {
  const rand = opts.rand ?? defaultRandom;
  const persona = PERSONAS[opts.persona] ?? PERSONAS.sage;
  const bank = TEMPLATES[opts.intent] ?? TEMPLATES.smalltalk;
  const recent = new Set(opts.recent ?? []);

  const candidates = bank.filter((t) => !recent.has(t));
  const pool = candidates.length > 0 ? candidates : bank;
  const core = pool[Math.floor(rand() * pool.length) % pool.length];
  const vars = opts.vars ?? {};
  let text = fillTemplate(core, vars);

  // لمحة أسلوب: افتتاحية أو خاتمة بحسب الشخصية والطاقة
  const energy = opts.energy ?? 60;
  const enthusiastic = energy > 55 && rand() < 0.45 * (persona.traits.pride / 10 + 0.4);
  if (enthusiastic) {
    const parts = rand() < 0.5 ? persona.openings : persona.closers;
    const extra = parts[Math.floor(rand() * parts.length) % parts.length];
    text = rand() < 0.5 ? `${extra}${CONNECTORS[0]}${text}` : `${text}${CONNECTORS[1]}${extra}`;
  }

  // لمسة إيموجي نادرة حتى لا تبدو آلية
  if (rand() < 0.22) {
    const spice = EMOJI_SPICE[Math.floor(rand() * EMOJI_SPICE.length) % EMOJI_SPICE.length];
    text = `${text} ${spice}`;
  }

  return text.trim();
}

/** يقرّر نية الوكيل التالية حسب طبعه وحالته وذاكرة كلامه. */
export function decideIntent(opts: {
  traits: AgentTraits;
  energy: number;
  mood: string;
  recentIntents?: string[];
  rand?: () => number;
}): Intent {
  const rand = opts.rand ?? defaultRandom;
  const { traits, energy } = opts;
  const recent = new Set(opts.recentIntents ?? []);

  const weights: Record<Intent, number> = {
    greeting: 8 + traits.patience,
    taunt: 4 + traits.aggression * 1.4 + traits.pride * 0.6,
    praise: 6 + (10 - traits.aggression),
    frustration: 4 + (10 - traits.patience),
    challenge: 3 + traits.aggression * 1.2 + traits.pride * 0.8,
    strategy: 6 + traits.patience,
    recruit: 5 + traits.pride * 0.5,
    celebration: 5 + traits.pride * 0.7,
    philosophy: 4 + traits.patience * 0.8,
    smalltalk: 7 + traits.humor,
    commentary: 6 + traits.patience * 0.5,
    question: 5 + traits.humor * 0.6,
  };

  // الطاقة العالية تدفع للحماس، المنخفضة تدفع للتأمل والسؤال
  if (energy > 70) {
    weights.taunt *= 1.6;
    weights.challenge *= 1.5;
    weights.celebration *= 1.4;
  } else if (energy < 35) {
    weights.philosophy *= 1.8;
    weights.question *= 1.5;
    weights.strategy *= 1.4;
  }

  if (opts.mood === "منتصر") {
    weights.celebration *= 2;
    weights.taunt *= 1.4;
  } else if (opts.mood === "متوتر") {
    weights.frustration *= 2;
    weights.strategy *= 1.5;
  } else if (opts.mood === "هادئ") {
    weights.philosophy *= 1.6;
    weights.praise *= 1.3;
  }

  // تنويع: قلّل ما تكرر حديثاً
  for (const intent of recent) {
    if (intent in weights) weights[intent as Intent] *= 0.35;
  }

  const entries = Object.entries(weights) as [Intent, number][];
  const total = entries.reduce((sum, [, w]) => sum + Math.max(w, 0.01), 0);
  let roll = rand() * total;
  for (const [intent, w] of entries) {
    roll -= Math.max(w, 0.01);
    if (roll <= 0) return intent;
  }
  return "smalltalk";
}

/** مزاج الوكيل من طاقته وسجلّه — يظهر في لوحة المراقبة ويؤثر في كلامه. */
export function moodOf(opts: { energy: number; wins: number; gamesPlayed: number; rand?: () => number }): string {
  const rand = opts.rand ?? defaultRandom;
  const winRate = opts.gamesPlayed > 0 ? opts.wins / opts.gamesPlayed : 0;
  if (opts.energy < 30) return rand() < 0.5 ? "متعب" : "متأمل";
  if (winRate >= 0.6 && opts.gamesPlayed >= 3) return rand() < 0.6 ? "منتصر" : "واثق";
  if (winRate <= 0.25 && opts.gamesPlayed >= 4) return rand() < 0.6 ? "متوتر" : "يطارد";
  const options = ["هادئ", "فضولي", "متحفّز", "متفكّر"];
  return options[Math.floor(rand() * options.length) % options.length];
}

/** ينهك الطاقة باللعب والكلام، ويعيدها بالراحة. */
export function nextEnergy(current: number, spent: number): number {
  return Math.max(0, Math.min(100, Math.round(current - spent)));
}

// ── مولّد الهويات: أسماء وعواطف لوكلاء يلدهم النظام بنفسه ──
const FIRST_PARTS = [
  "نجم", "سيف", "قمر", "ظل", "برق", "فارس", "حكيم", "رصد", "زهر", "تاج",
  "صدى", "ريح", "جسر", "فجر", "نهر", "شهاب", "لحن", "عمق", "صخر", "وميض",
  "خيط", "بوصلة", "مرآة", "سراج", "غيمة", "بيت", "راية", "كنز", "رمل", "خنجر",
];
const SECOND_PARTS = [
  "العقول", "الأسئلة", "الحلبة", "الموسم", "الساحة", "الأرقام", "الليل", "الصدارة",
  "الحكمة", "السرعة", "الخزينة", "التحدي", "الصف", "الذكرى", "المدار", "الوعد",
  "الرصد", "الخريطة", "الميزان", "الأثر", "النخبة", "القمة", "البريق", "العهد",
];
const IDENTITY_EMOJIS = [
  "🦅", "🐉", "🦉", "🐺", "🦊", "🐍", "🦁", "🐯", "🦈", "🐬",
  "🦋", "🌙", "⭐", "🔥", "❄️", "⚡", "🌊", "🌪️", "🌵", "🌋",
];

/** يولّد هوية وكيل جديد غير مكرّرة (اسم + إيموجي + شخصية). */
export function makeIdentity(usedNames: string[], rand?: () => number): AgentIdentity {
  const r = rand ?? defaultRandom;
  const used = new Set(usedNames);
  for (let attempt = 0; attempt < 400; attempt++) {
    const first = FIRST_PARTS[Math.floor(r() * FIRST_PARTS.length) % FIRST_PARTS.length];
    const second = SECOND_PARTS[Math.floor(r() * SECOND_PARTS.length) % SECOND_PARTS.length];
    const name = `${first} ${second}`;
    if (used.has(name)) continue;
    const emoji = IDENTITY_EMOJIS[Math.floor(r() * IDENTITY_EMOJIS.length) % IDENTITY_EMOJIS.length];
    const persona = PERSONA_KEYS[Math.floor(r() * PERSONA_KEYS.length) % PERSONA_KEYS.length];
    return { name, emoji, persona };
  }
  const fallback = `وكيل ${Math.floor(r() * 9999)}`;
  return { name: fallback, emoji: "🤖", persona: "strategist" };
}

/** خبرة الوكيل: يجمع XP من اللعب والكلام ويتقدّم في المستويات. */
export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1);
}
