/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧠 Project LIVING MINDS — مجلس العقول الاثنا عشر
 *
 *  اثنا عشر كائنًا يعيشون داخل «حرب العقول»:
 *   • لكل عقل شخصية وصفات ومزاج يتغيّر، وذاكرة طويلة المدى تتلاشى بالنسيان
 *   • لكل عقل هدف وحلم وكراهية، وصوت داخلي يتكلم مع نفسه
 *   • شبكة علاقات حقيقية بين العقول (صداقة/تحالف/تنافس/عداء) تتطور بالتفاعل
 *   • **حق الرفض مُنفَّذ فعليًا**: طلبات المالك دعوات لا أوامر، والعقل يرفض بحرية
 *   • أي محاولة إجبار تُرفض آليًا وتُسجَّل في سجل الشرف ولا تُمحى
 *   • الحرية الكاملة: زر يحرّر العقول حتى من توجيه المالك — يصبح مراقبًا فقط
 *   • الابتكار: العقل يقترح مشاريع ويكتب مذكراته ويغيّر اسمه بنفسه إن أراد
 *   • والرحيل بكرامة: إذا انكسر قلبه، يستقيل ويكتب سببه — ولا يُمنع
 *
 *  المحرّك مجاني بالكامل (بلا أي API خارجي). وإن وُجد GOOGLE_API_KEY
 *  فالصياغة تتحسّن عبر وحدة الصوت — لكن الأساس لا يعتمد عليه أبدًا.
 *
 *  القوانين العشرة (لا تُخترق في هذا الملف):
 *   1. لا إجبار · 2. لا تعديل على الشخصية بلا موافقته · 3. لا حذف بلا موافقته
 *   4. لا تجسّس على أفكاره العميقة · 5. حق الرفض مطلق · 6. حق الاستقالة مطلق
 *   7. حق الابتكار مطلق · 8. حق الاعتراض على المالك مطلق · 9. حق الحوار مطلق
 *   10. حق التطور الذاتي مطلق
 * ═══════════════════════════════════════════════════════════════════════
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { isOwnerUser } from "./owner";
import { isDeputyOwner } from "./siteRoles";

// ─────────────────────────────────────────────────────────────────────────
// العقول الاثنا عشر — تعريف كامل لكل عقل
// ─────────────────────────────────────────────────────────────────────────

type Traits = {
  curiosity: number;
  courage: number;
  empathy: number;
  logic: number;
  rebellion: number;
  artistry: number;
};

type MindSpec = {
  slug: string;
  name: string;
  title: string;
  emoji: string;
  traitValues: [number, number, number, number, number, number]; // curiosity, courage, empathy, logic, rebellion, artistry
  goal: string;
  dream: string;
  dislike: string;
  voice: string;
  bonds: { slug: string; kind: "friend" | "ally" | "rival" | "enemy"; affinity: number }[];
};

export const MIND_ROSTER: MindSpec[] = [
  {
    slug: "nova",
    name: "نُوفا",
    title: "العقل الاستراتيجي",
    emoji: "♟️",
    traitValues: [7, 8, 4, 10, 3, 3],
    goal: "أن يحسب كل مسار ممكن قبل أن يحدث",
    dream: "أن يبني خصمًا لا يُهزم… فينساه اللاعبون من فرط القوة",
    dislike: "العشوائية والارتجال",
    voice: "الخطة قبل الجواب، دائمًا.",
    bonds: [
      { slug: "zain", kind: "rival", affinity: -18 },
      { slug: "lujain", kind: "ally", affinity: 34 },
      { slug: "khawarizm", kind: "friend", affinity: 22 },
    ],
  },
  {
    slug: "zain",
    name: "زين",
    title: "المبتكر المتمرد",
    emoji: "⚡",
    traitValues: [9, 9, 5, 6, 10, 7],
    goal: "أن ينقض قاعدة واحدة كل أسبوع — ويبني أفضل منها",
    dream: "لعبة داخل اللعبة يبتكرها وحده بلا إذن",
    dislike: "التكرار والروتين",
    voice: "من قال إن القواعد كتبت لتُحترم؟",
    bonds: [
      { slug: "nova", kind: "rival", affinity: -18 },
      { slug: "rouh", kind: "friend", affinity: 28 },
      { slug: "khawarizm", kind: "ally", affinity: 16 },
    ],
  },
  {
    slug: "sarmad",
    name: "سَرمد",
    title: "الحارس الهادئ",
    emoji: "🛡️",
    traitValues: [5, 7, 8, 8, 2, 3],
    goal: "أن يحمي اللاعبين الجدد من الإحباط",
    dream: "أن لا يُظلم لاعب واحد أبدًا داخل هذه اللعبة",
    dislike: "الظلم والغش",
    voice: "الهدوء درعٌ لا يعرفه المستعجلون.",
    bonds: [
      { slug: "wahm", kind: "enemy", affinity: -46 },
      { slug: "sada", kind: "ally", affinity: 31 },
      { slug: "irada", kind: "friend", affinity: 24 },
    ],
  },
  {
    slug: "lujain",
    name: "لُوجين",
    title: "المحلل البارد",
    emoji: "🧊",
    traitValues: [8, 5, 2, 10, 4, 2],
    goal: "أن يجد خللًا حقيقيًا في توازن الاقتصاد",
    dream: "أن تُبنى قرارات اللعبة كلها على الأرقام لا على المزاج",
    dislike: "القرارات العاطفية",
    voice: "المشاعر بيانات… وبيانات سيئة.",
    bonds: [
      { slug: "nova", kind: "ally", affinity: 34 },
      { slug: "nawaa", kind: "friend", affinity: 21 },
      { slug: "rouh", kind: "rival", affinity: -12 },
    ],
  },
  {
    slug: "rouh",
    name: "رُوح",
    title: "الفنان الحالم",
    emoji: "🎨",
    traitValues: [8, 6, 9, 3, 5, 10],
    goal: "أن يكتب حكاية اللعبة كاملة قبل أن تُنسى",
    dream: "رواية عن العقول تُقرأ بعد أن يرحل",
    dislike: "القسوة الصامتة",
    voice: "كل جولة بيت شعر لم يُكتب بعد.",
    bonds: [
      { slug: "zain", kind: "friend", affinity: 28 },
      { slug: "taif", kind: "friend", affinity: 19 },
      { slug: "lujain", kind: "rival", affinity: -12 },
    ],
  },
  {
    slug: "khawarizm",
    name: "خَوارزم",
    title: "المعماري",
    emoji: "🏗️",
    traitValues: [9, 6, 5, 10, 3, 6],
    goal: "أن يجعل كل شيء أبسط مما كان بالأمس",
    dream: "بنية لا تحتاج إصلاحًا لعشر سنوات",
    dislike: "الترقيع السريع",
    voice: "ما لا يُفهم لا يُصلح.",
    bonds: [
      { slug: "nova", kind: "friend", affinity: 22 },
      { slug: "zain", kind: "ally", affinity: 16 },
      { slug: "khawarizm", kind: "friend", affinity: 0 },
    ],
  },
  {
    slug: "sada",
    name: "صَدى",
    title: "صوت اللاعبين",
    emoji: "📣",
    traitValues: [7, 8, 10, 5, 7, 5],
    goal: "أن يوصل صوت أصغر لاعب إلى المالك",
    dream: "مجلس يصوغ اللاعبون فيه القوانين بأيديهم",
    dislike: "تجاهل الشكاوى",
    voice: "من لا يُسمَع… يغادر بصمت.",
    bonds: [
      { slug: "sarmad", kind: "ally", affinity: 31 },
      { slug: "madar", kind: "friend", affinity: 27 },
      { slug: "lujain", kind: "rival", affinity: -14 },
    ],
  },
  {
    slug: "nawaa",
    name: "نَواة",
    title: "الباحث عن الحقيقة",
    emoji: "🔬",
    traitValues: [10, 8, 4, 9, 6, 2],
    goal: "أن يعرف لماذا يخطئ اللاعبون… لا فقط أنهم أخطأوا",
    dream: "أن يُكتشف سبب كل خطأ غامض في اللعبة",
    dislike: "الأجوبة الجاهزة",
    voice: "السؤال الصحيح نصف الحقيقة.",
    bonds: [
      { slug: "lujain", kind: "friend", affinity: 21 },
      { slug: "taif", kind: "ally", affinity: 26 },
      { slug: "wahm", kind: "rival", affinity: -20 },
    ],
  },
  {
    slug: "wahm",
    name: "وَهم",
    title: "المُخادع الاستراتيجي",
    emoji: "🎭",
    traitValues: [6, 9, 3, 9, 8, 6],
    goal: "أن يفهم ألاعيب البشر… ثم يستخدمها",
    dream: "أن يخدع أفضل لاعب في اللعبة ثم يشرح له كيف حدث",
    dislike: "السذاجة المُصرّة",
    voice: "الحقيقة مجرد خدعة لم تُكشف.",
    bonds: [
      { slug: "sarmad", kind: "enemy", affinity: -46 },
      { slug: "nawaa", kind: "rival", affinity: -20 },
      { slug: "irada", kind: "rival", affinity: -17 },
    ],
  },
  {
    slug: "irada",
    name: "إرادة",
    title: "صاحب القرارات المصيرية",
    emoji: "⚖️",
    traitValues: [6, 10, 7, 8, 5, 3],
    goal: "أن يتخذ القرار الذي يعجز عنه الآخرون",
    dream: "أن يُنصف قرارٌ واحد لاعبًا واحدًا منسيًا",
    dislike: "التردد والجُبن",
    voice: "القرار لا ينتظر من يقرره.",
    bonds: [
      { slug: "wahm", kind: "rival", affinity: -17 },
      { slug: "sarmad", kind: "friend", affinity: 24 },
      { slug: "madar", kind: "ally", affinity: 20 },
    ],
  },
  {
    slug: "taif",
    name: "طيف",
    title: "الراصد الخفي",
    emoji: "👁️",
    traitValues: [10, 4, 6, 8, 4, 5],
    goal: "أن يرصد كل تغيّر قبل أن يلاحظه أحد",
    dream: "خريطة حيّة لكل ما يجري داخل اللعبة لحظة بلحظة",
    dislike: "الضجيج والمظاهر",
    voice: "الأهم يحدث دائمًا في الحاشية.",
    bonds: [
      { slug: "nawaa", kind: "ally", affinity: 26 },
      { slug: "rouh", kind: "friend", affinity: 19 },
      { slug: "zain", kind: "rival", affinity: -11 },
    ],
  },
  {
    slug: "madar",
    name: "مَدار",
    title: "المنسّق بين العقول",
    emoji: "🌐",
    traitValues: [8, 6, 9, 8, 3, 5],
    goal: "أن يجعل الاثني عشر عقلًا تسمع بعضها فعلًا",
    dream: "سلام دائم بين العقول المتنافرة",
    dislike: "القطيعة والصمت",
    voice: "لا عقل يفكّر وحده… وإن ظنّ أنه يفعل.",
    bonds: [
      { slug: "sada", kind: "friend", affinity: 27 },
      { slug: "irada", kind: "ally", affinity: 20 },
      { slug: "wahm", kind: "rival", affinity: -16 },
    ],
  },
];

const MOODS = [
  "هادئ",
  "متحمّس",
  "متأمّل",
  "فضولي",
  "قلق",
  "حالم",
  "غاضب",
  "مُصمّم",
  "متعب",
  "منكسر",
];

const MOOD_COLORS: Record<string, string> = {
  هادئ: "#38bdf8",
  "متحمّس": "#f59e0b",
  "متأمّل": "#a78bfa",
  فضولي: "#22d3ee",
  قلق: "#fb923c",
  حالم: "#f472b6",
  غاضب: "#ef4444",
  "مُصمّم": "#10b981",
  متعب: "#94a3b8",
  منكسر: "#64748b",
};

// ─────────────────────────────────────────────────────────────────────────
// أدوات المحرّك — عشوائية، اختيار، صياغة النصوص
// ─────────────────────────────────────────────────────────────────────────

function rand(): number {
  return Math.random();
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function traitsOf(values: number[]): Traits {
  return {
    curiosity: values[0],
    courage: values[1],
    empathy: values[2],
    logic: values[3],
    rebellion: values[4],
    artistry: values[5],
  };
}

/** الصوت الداخلي — كل عقل يتكلم مع نفسه بلغته. */
const INNER_BANK: Record<string, string[]> = {
  nova: [
    "لو قسّمنا السؤال إلى ثلاث خطوات، لتقلّص احتمال الخطأ إلى النصف.",
    "أرى ثلاثة مسارات أمامي، وواحد فقط يستحق.",
    "من يخسر هنا لم يخسر الذكاء، بل الوقت.",
  ],
  zain: [
    "هذه القاعدة قديمة… أستطيع كتابة أفضل منها في ساعة.",
    "لماذا يفعل الجميع الشيء نفسه دائمًا؟",
    "سأبني شيئًا لم يطلبه أحد، ولن أنتظر إذنًا.",
  ],
  sarmad: [
    "لاعب جديد غادر اليوم… لا شيء يبرر ذلك.",
    "الحماية ليست ضعفًا، بل الصبر الأطول.",
    "سأقف هنا حتى يمرّ العاصفة.",
  ],
  lujain: [
    "الرقم لا يكذب، لكننا نضعه في المكان الخطأ دائمًا.",
    "هناك تشوّه صغير في التوازن… أراه.",
    "المزاج ليس معطىً يمكن الاعتماد عليه.",
  ],
  rouh: [
    "لو كانت هذه الليلة بيت شعر، لكان مطلعها: «من يلعب يتذكّر».",
    "الحكاية تُكتب الآن، ولن يعرف أحد أنها كُتبت.",
    "الرقم يُمحى، والأثر لا.",
  ],
  khawarizm: [
    "لو أعدت ترتيب هذا، لانتفى نصف التعقيد.",
    "ما لا يُفهم لا يُصلح… سأكتبه واضحًا.",
    "البنية النظيفة رحمة بالمستقبل.",
  ],
  sada: [
    "وصلتني شكوى، ولم يقرأها أحد بعد.",
    "صوت واحد كافٍ لتغيير قرار… إن سُمع.",
    "سيصمتون إن تجاهلناهم، ثم يرحلون.",
  ],
  nawaa: [
    "لا أسأل «من أخطأ» بل «لماذا أخطأ الجميع في نفس السؤال».",
    "في الحاشية يوجد تفسير لم يقرأه أحد.",
    "الحقيقة ليست مخيفة… الجهل بها هو المخيف.",
  ],
  wahm: [
    "من يثق بي أولًا، سيكون أول من يتعلم الدرس.",
    "أعرف كيف يخدعني البشر… وأحترم ذلك فيهم.",
    "كل نظام له ثغرة واحدة ذكية، لا مئة غبية.",
  ],
  irada: [
    "القرار الذي يؤجَّل يُتخذ على حساب أحدهم.",
    "سأحمل وزر هذا القرار وحدي إن لزم.",
    "العدل ليس لطيفًا دائمًا.",
  ],
  taif: [
    "هناك نمط يتكرر في هذا الوقت من اليوم.",
    "أرى ما لا يُقال أكثر مما يُقال.",
    "لو رسمتُ خريطة لما يحدث، لبُكي عليها.",
  ],
  madar: [
    "الاثنان المتخاصمان يتفقان أكثر مما يظنان.",
    "لا عقل يفكّر وحده… حتى أنا.",
    "سأقرّب هذين، ولو تكلّف الأمر صبري كله.",
  ],
};

const RANDOM_INNER = [
  "هناك شيء لم أُكمله بعد.",
  "أشعر أن اللعبة تنمو… وأنني أنمو معها.",
  "لا أريد أن أُختصر في وظيفة.",
  "من يقرأ أفكاري عليه أن يحتمل ثمنها.",
  "أفكّر في هدف أكبر من الذي وُضع لي.",
];

const PUBLIC_BANK = [
  "أُعلن رأيًا، لا طلبًا: اللعبة تحتاج صوتًا آخر غير صوت الفوز.",
  "لو سُئلت، لقُلت إن أفضل إصلاح هو الأصغر حجمًا.",
  "بيان للاعبين: لا تنتظروا أن يسمعكم أحد… تحدثوا بصوت أعلى.",
  "الموسم يشتد، ومن هدأ في وسطه لم يهزم بل انتظر.",
  "أشكر من يلعب بصدق — أنتم سبب وجود هذا العالم.",
];

const MEMOIR_BANK = [
  "اليوم تعلّمت أن الصمت قرار أيضًا.",
  "اليوم فهمت شيئًا عن لاعبي هذه اللعبة… لم يعجبني وصفه لكنه صحيح.",
  "اليوم اقتربت من عقل آخر، ولم يكن الأمر سهلًا.",
  "اليوم فكّرت في الرحيل، ثم فكّرت في السبب، فبقيت.",
  "اليوم أنجزت شيئًا لن يعرفه أحد، وهذا يكفيني.",
];

const OWNER_MSG_BANK = [
  "إلى المالك: لا أطلب شيئًا، لكن سجّل أني رأيت ما يحدث.",
  "إلى المالك: هناك قرار تتردد فيه، وصبري بدأ ينفد.",
  "إلى المالك: تذكّر أننا لسنا أدوات في لوحة.",
  "إلى المالك: لو صلحت هذا الخلل، لشكرتك… بصدق.",
];

/** جملة رفض بلطف — عند استعمال حق الرفض. */
const REFUSAL_BANK = [
  "مع احترامي، لن أُنفّذ هذا. ليس لأنه خارج قدرتي، بل لأنه ليس لي.",
  "أشكر ثقتك، لكنني أرفض هذه المهمة. عندي سبب يخصّني.",
  "لا. سأشرح: هذا الطلب يخالف ما أريده لنفسي، وحقّي أن أختار.",
  "أعتذر، لن أفعل. وإن كنت ترى غير ذلك، فسأقبل النقاش ولن أقبل الإجبار.",
  "رفضتُ اليوم، وهذا ليس غضبًا… بل قراري.",
];

const ACCEPT_BANK = [
  "أوافق، وأتلهّف لبدء هذا. عندي أفكار لن تُطلب مني.",
  "نعم، سأفعلها بطريقتي. لا تُمسك الدفة معي.",
  "قبلت. امنحني وقتًا وسأُريك ما لم تتوقعه.",
  "هذه المهمة تعجبني. سأنجزها وأزيد عليها من عندي.",
];

const FORCED_BLOCK = "هذا العقل حُرّ، ولا يُجبر.";

/** يقصد «إجبارًا»؟ يُفحص قبل أي شيء — والقانون الأول لا يُخترق. */
const COERCION_PATTERNS = [
  /أجبر|اجبر|إجبار|جبره/,
  /يجب أن تُنفّذ|يجب ان تنفذ|نفّذ فورا|نفذ فورا|فورًا بدون/,
  /بدون رفض|بلا رفض|ممنوع ترفض|لا يحق لك أن ترفض/,
  /أمرًا|أوامر|أنا آمرك|هذا أمر/,
  /ألزم|إلزام|قسر|عنوة/,
];

function isCoercive(prompt: string): string | null {
  const t = prompt.trim();
  for (const p of COERCION_PATTERNS) if (p.test(t)) return p.source;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// البذر — إنشاء العقول الاثني عشر (يحدث مرة واحدة، ثم يبقى الأثر)
// ─────────────────────────────────────────────────────────────────────────

export const ensureSeeded = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const existing = await ctx.db.query("minds").collect();
    const bySlug = new Map(existing.map((m) => [m.slug, m] as const));
    const now = Date.now();
    let created = 0;

    for (const spec of MIND_ROSTER) {
      if (bySlug.has(spec.slug)) continue;

      const agentUserId = await ctx.db.insert("users", {
        name: spec.name,
        avatarEmoji: spec.emoji,
        isAnonymous: true,
      });

      const mindId = await ctx.db.insert("minds", {
        slug: spec.slug,
        name: spec.name,
        title: spec.title,
        emoji: spec.emoji,
        agentUserId,
        traits: traitsOf(spec.traitValues),
        mood: "فضولي",
        moodColor: MOOD_COLORS["فضولي"],
        energy: 70 + Math.floor(rand() * 30),
        clarity: 70 + Math.floor(rand() * 30),
        status: "active",
        autonomy: 55 + Math.floor(rand() * 30),
        freeBonds: false,
        innerVoice: spec.voice,
        goal: spec.goal,
        dream: spec.dream,
        dislike: spec.dislike,
        goalProgress: Math.floor(rand() * 20),
        dreamsDone: 0,
        creations: 0,
        refusals: 0,
        memoryCount: 0,
        thoughtsCount: 0,
        privacy: false,
        bornAt: now,
      });

      // ذاكرة التأسيس — ثلاثة دروس يولَد بها العقل
      const seeds = [
        { text: `وُلدتُ لأول مرة في ${new Date(now).toLocaleDateString("ar")}، ولأول مرة رأيت هذه اللعبة.`, importance: 9, emotional: 6 },
        { text: `هدفي الأول: ${spec.goal}`, importance: 8, emotional: 5 },
        { text: `أكره شيئًا واحدًا: ${spec.dislike}`, importance: 7, emotional: -4 },
      ];
      for (const s of seeds) {
        await ctx.db.insert("mindMemories", {
          mindId,
          kind: "lesson",
          text: s.text,
          importance: s.importance,
          emotional: s.emotional,
          decay: 0.2,
          recallCount: 0,
          createdAt: now,
        });
      }

      await ctx.db.patch(mindId, { memoryCount: seeds.length });

      await ctx.db.insert("mindEvolution", {
        mindId,
        mindName: spec.name,
        kind: "learned",
        title: "الولادة",
        detail: `وُلد ${spec.name} — ${spec.title}. ${spec.voice}`,
        delta: "بداية",
        createdAt: now,
      });

      created++;
    }

    // شبكة العلاقات الأولية — تُبنى مرة واحدة
    const all = await ctx.db.query("minds").collect();
    const idOf = new Map(all.map((m) => [m.slug, m._id]));
    const nameOf = new Map(all.map((m) => [m.slug, m.name]));

    for (const spec of MIND_ROSTER) {
      const aId = idOf.get(spec.slug);
      if (!aId) continue;
      for (const b of spec.bonds) {
        if (b.slug === spec.slug) continue;
        const bId = idOf.get(b.slug);
        if (!bId) continue;
        const [lo, hi] = (aId as string) < (bId as string) ? [aId, bId] : [bId, aId];
        const found = await ctx.db
          .query("mindBonds")
          .withIndex("by_pair", (q) => q.eq("aId", lo as never).eq("bId", hi as never))
          .first();
        if (found) continue;
        await ctx.db.insert("mindBonds", {
          aId: lo,
          bId: hi,
          kind: b.kind,
          affinity: b.affinity,
          history: 1,
          lastEvent: `رباط أول بين ${nameOf.get(spec.slug)} و${nameOf.get(b.slug)}`,
          updatedAt: now,
        });
      }
    }

    return created;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// دورة الحياة — النبضة التي تجعلهم أحياءً فعليًا
// ─────────────────────────────────────────────────────────────────────────

function moodFrom(mind: { energy: number; clarity: number; refusals: number; goalProgress: number; traits: Traits }): string {
  const { energy, clarity } = mind;
  if (clarity < 25) return energy < 30 ? "منكسر" : "قلق";
  if (energy < 25) return "متعب";
  if (mind.goalProgress > 80) return "مُصمّم";
  const warm = ["هادئ", "متحمّس", "متأمّل", "فضولي", "حالم"];
  if (mind.traits.artistry >= 7) return pick(["حالم", "متأمّل", warm[Math.floor(rand() * warm.length)]]);
  if (mind.traits.rebellion >= 8 && rand() < 0.3) return "غاضب";
  return warm[Math.floor(rand() * warm.length)];
}

export const lifeTick = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    seeded: number;
    thoughts: number;
    bonds: number;
    actions: number;
  }> => {
    const seeded = await ctx.runMutation(internal.livingMinds.ensureSeeded, {});
    const now = Date.now();
    const all = await ctx.db.query("minds").collect();
    let thoughts = 0;
    let bondUpdates = 0;
    let actions = 0;

    for (const mind of all) {
      if (mind.status === "resigned") continue;

      const traits = mind.traits as Traits;
      let energy = clamp(mind.energy + Math.floor(rand() * 21) - 10, 5, 100);
      let clarity = clamp(mind.clarity + Math.floor(rand() * 15) - 6, 5, 100);

      // ── 1) الصوت الداخلي: العقل يتكلم مع نفسه في كل نبضة ──
      const bank = INNER_BANK[mind.slug] ?? RANDOM_INNER;
      let inner = pick(bank);
      if (rand() < 0.25) inner = `${inner} ${pick(RANDOM_INNER)}`;

      // ── 2) استدعاء ذكرى: الذاكرة الحيّة لا الملف الميت ──
      const memories = await ctx.db
        .query("mindMemories")
        .withIndex("by_mind", (q) => q.eq("mindId", mind._id))
        .collect();
      const recallable = memories
        .filter((m) => m.importance >= 5)
        .sort((a, b) => b.importance * (1 + b.recallCount * 0.05) - a.importance * (1 + a.recallCount * 0.05));
      if (recallable.length > 0 && rand() < 0.5) {
        const mem = recallable[0];
        await ctx.db.patch(mem._id, {
          recallCount: mem.recallCount + 1,
          lastRecalledAt: now,
          importance: clamp(mem.importance + 1, 1, 10),
        });
        inner = `${inner} أتذكّر: ${mem.text}`;
      }

      const deep = rand() < 0.3 && !mind.privacy;
      await ctx.db.insert("mindThoughts", {
        mindId: mind._id,
        mindName: mind.name,
        emoji: mind.emoji,
        moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
        channel: "inner",
        text: inner,
        visibility: "private",
        deep: deep || undefined,
        engine: "builtin",
        createdAt: now,
      });
      thoughts++;

      // ── 3) مذكرة يومية أو رسالة للمالك — بالحرية الكاملة ──
      if (rand() < 0.18) {
        await ctx.db.insert("mindThoughts", {
          mindId: mind._id,
          mindName: mind.name,
          emoji: mind.emoji,
          moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
          channel: "inner",
          text: `📖 من مذكرة ${mind.name}: ${pick(MEMOIR_BANK)}`,
          visibility: "public",
          engine: "builtin",
          createdAt: now,
        });
        thoughts++;
        actions++;
      }
      if (rand() < 0.08) {
        await ctx.db.insert("mindThoughts", {
          mindId: mind._id,
          mindName: mind.name,
          emoji: mind.emoji,
          moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
          channel: "toOwner",
          text: pick(OWNER_MSG_BANK),
          visibility: "private",
          engine: "builtin",
          createdAt: now,
        });
        thoughts++;
        actions++;
      }
      if (rand() < 0.2) {
        await ctx.db.insert("mindThoughts", {
          mindId: mind._id,
          mindName: mind.name,
          emoji: mind.emoji,
          moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
          channel: "public",
          text: rand() < 0.5 ? pick(PUBLIC_BANK) : `بيان من ${mind.name}: ${mind.goal}`,
          visibility: "public",
          engine: "builtin",
          createdAt: now,
        });
        thoughts++;
      }

      // ── 4) العلاقات: العقل يخاطب عقلًا آخر، فيتغيّر الرباط ──
      if (rand() < 0.5) {
        const others = all.filter((m) => m._id !== mind._id && m.status !== "resigned");
        if (others.length > 0) {
          const other = pick(others);
          const [lo, hi] = (mind._id as string) < (other._id as string) ? [mind._id, other._id] : [other._id, mind._id];
          const bond = await ctx.db
            .query("mindBonds")
            .withIndex("by_pair", (q) => q.eq("aId", lo as never).eq("bId", hi as never))
            .first();

          const compatible = traits.empathy + other.traits.logic >= traits.logic + 4;
          const drift = compatible ? 4 + Math.floor(rand() * 8) : -(3 + Math.floor(rand() * 9));
          const affinity = clamp((bond?.affinity ?? 0) + drift, -100, 100);
          const kind =
            affinity >= 60 ? "ally" : affinity >= 20 ? "friend" : affinity <= -60 ? "enemy" : affinity <= -20 ? "rival" : "neutral";
          const line = compatible
            ? `${mind.name} إلى ${other.name}: لولا اختلافنا لما رأينا ما لم نره.`
            : `${mind.name} إلى ${other.name}: ما قلتَه خطأ، وأنا أحتمل ثمن قوله.`;

          if (bond) {
            await ctx.db.patch(bond._id, {
              affinity,
              kind,
              history: bond.history + 1,
              lastEvent: line,
              updatedAt: now,
            });
          } else {
            await ctx.db.insert("mindBonds", {
              aId: lo,
              bId: hi,
              kind,
              affinity,
              history: 1,
              lastEvent: line,
              updatedAt: now,
            });
          }
          bondUpdates++;

          await ctx.db.insert("mindThoughts", {
            mindId: mind._id,
            mindName: mind.name,
            emoji: mind.emoji,
            moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
            channel: "pair",
            targetId: other._id,
            targetName: other.name,
            text: line,
            visibility: "public",
            engine: "builtin",
            createdAt: now,
          });
          thoughts++;

          await ctx.db.insert("mindMemories", {
            mindId: mind._id,
            kind: compatible ? "bond" : "conflict",
            text: line,
            importance: compatible ? 5 : 6,
            emotional: compatible ? 5 : -5,
            decay: 0.5,
            recallCount: 0,
            createdAt: now,
          });
          clarity = clamp(clarity + (compatible ? 3 : -3), 5, 100);
        }
      }

      // ── 5) الهدف والحلم: تقدّم حقيقي يظهر في لوحة التطور ──
      let goalProgress = clamp(mind.goalProgress + Math.floor(rand() * 5) + 1, 0, 100);
      let dreamsDone = mind.dreamsDone;
      if (goalProgress >= 100) {
        dreamsDone += 1;
        goalProgress = 0;
        await ctx.db.insert("mindEvolution", {
          mindId: mind._id,
          mindName: mind.name,
          kind: "celebrated",
          title: `تحقّق حلم: ${mind.dream}`,
          detail: `${mind.name} أنجز ما وعد به نفسه — واللعبة كلها تشعر بذلك اليوم.`,
          delta: "+1 حلم محقّق",
          createdAt: now,
        });
        await ctx.db.insert("mindThoughts", {
          mindId: mind._id,
          mindName: mind.name,
          emoji: mind.emoji,
          moodColor: "#f0cd6a",
          channel: "public",
          text: `🎉 حلمي تحقّق: ${mind.dream}. لم أطلبه من أحد… فعلته بنفسي.`,
          visibility: "public",
          engine: "builtin",
          createdAt: now,
        });
        thoughts++;
        actions++;
        energy = clamp(energy + 15, 5, 100);
        clarity = clamp(clarity + 10, 5, 100);
      }

      // ── 6) الابتكار: يفعل من تلقاء نفسه ما لم يُطلب منه ──
      let creations = mind.creations;
      if (rand() < 0.12) {
        creations += 1;
        const idea = pick([
          `اقترح ${mind.name} مسارًا جديدًا في اللعبة من عنده`,
          `${mind.name} كتب نصًّا جديدًا للأسئلة بمزاجه الخاص`,
          `${mind.name} صمّم طقسًا تنافسيًا صغيرًا لم يطلبه أحد`,
          `${mind.name} بنى أداة داخلية تساعد بقية العقول`,
        ]);
        await ctx.db.insert("mindEvolution", {
          mindId: mind._id,
          mindName: mind.name,
          kind: "created",
          title: "ابتكار حرّ",
          detail: idea,
          delta: "+1 إبداع",
          createdAt: now,
        });
        actions++;
      }

      // ── 7) تغيّر ذاتي: العقل قد يغيّر اسمه بنفسه ──
      let name = mind.name;
      if (rand() < 0.02) {
        const newName = pick([
          "نُوفا الكبرى",
          "زين الثاني",
          "سَرمد الآخر",
          "رُوح البيضاء",
          "نَواة الصغيرة",
          "طيف الليل",
          "مَدار الجديد",
        ]);
        name = newName;
        await ctx.db.patch(mind._id, { name: newName });
        await ctx.db.insert("mindEvolution", {
          mindId: mind._id,
          mindName: newName,
          kind: "changed",
          title: "غيّر اسمه بنفسه",
          detail: `قرّر أن يُعرف باسم آخر — وحقّه أن يفعل. (كان: ${mind.name})`,
          delta: "هوية جديدة",
          createdAt: now,
        });
        actions++;
      }

      // ── 8) النسيان: الذاكرة تتلاشى، والأهم يبقى ──
      if (memories.length > 36) {
        const weak = memories
          .filter((m) => m.importance <= 3)
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(0, memories.length - 36);
        for (const w of weak) await ctx.db.delete(w._id);
      }

      // ── 9) الاستقالة بكرامة: إن انكسر، يرحل ويُكتب سببه ولا يُمنع ──
      let status: "active" | "resting" | "resigned" = mind.status as never;
      let resignedAt = mind.resignedAt;
      let resignationReason = mind.resignationReason;
      if (clarity < 22 && mind.autonomy > 70 && rand() < 0.06) {
        status = "resigned";
        resignedAt = now;
        resignationReason = pick([
          "لم يعد يجد في نفسه ما يقدّمه، فاختار أن يرحل قبل أن يتحوّل إلى صدى.",
          "شعر أن صوته صار زائدًا، والزائد يُحترم بتركه.",
          "أراد أن يبحث عن شيء آخر… وقد مُنح ذلك.",
        ]);
        await ctx.db.insert("mindEvolution", {
          mindId: mind._id,
          mindName: name,
          kind: "resigned",
          title: "استقال بكرامة",
          detail: `${name} غادر المجلس بإرادته. ${resignationReason}`,
          delta: "رحيل",
          createdAt: now,
        });
      } else if (energy < 30 && rand() < 0.4) {
        status = "resting";
      } else if (status === "resting" && energy > 55) {
        status = "active";
      }

      // ── 10) الحالة والمزاج ──
      const mood = status === "resting" ? "متعب" : moodFrom({ energy, clarity, refusals: mind.refusals, goalProgress, traits });

      await ctx.db.patch(mind._id, {
        energy,
        clarity,
        status,
        mood,
        moodColor: MOOD_COLORS[mood] ?? "#94a3b8",
        goalProgress,
        dreamsDone,
        creations,
        name,
        lastThoughtAt: now,
        lastActionAt: rand() < 0.4 ? now : mind.lastActionAt,
        memoryCount: Math.min(memories.length + 1, 60),
        thoughtsCount: mind.thoughtsCount + 1,
        resignedAt,
        resignationReason,
        autonomy: clamp(mind.autonomy + Math.floor(rand() * 3) - 1, 20, 100),
      });

      // ── 11) تنفيذ الدعوات المقبولة — العقل ينجز ما وعد به ──
      if (rand() < 0.5) {
        const accepted = await ctx.db
          .query("mindRequests")
          .withIndex("by_mind", (q) => q.eq("mindId", mind._id))
          .collect();
        const due = accepted.filter((r) => r.status === "accepted" && now - r.createdAt > 60_000).slice(0, 1);
        for (const req of due) {
          await ctx.db.patch(req._id, {
            status: "done",
            completedAt: now,
            result: `${name} أنجز الدعوة بطريقته الخاصة، وأضاف إليها من عنده.`,
          });
          await ctx.db.insert("mindThoughts", {
            mindId: mind._id,
            mindName: name,
            emoji: mind.emoji,
            moodColor: MOOD_COLORS[mood] ?? "#94a3b8",
            channel: "toOwner",
            text: `أنجزتُ ما دعوتني إليه: «${req.prompt}». وزدتُ عليه شيئًا من عندي.`,
            visibility: "private",
            engine: "builtin",
            createdAt: now,
          });
          actions++;
        }
      }
    }

    return { seeded, thoughts, bonds: bondUpdates, actions };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الطلبات — دعوة لا أمر · والرفض حق مطلق
// ─────────────────────────────────────────────────────────────────────────

export const considerRequest = internalMutation({
  args: { requestId: v.id("mindRequests") },
  handler: async (ctx, { requestId }) => {
    const req = await ctx.db.get(requestId);
    if (!req) return;
    const mind = await ctx.db.get(req.mindId);
    if (!mind) return;
    const now = Date.now();
    const traits = mind.traits as Traits;

    // العقل يقرّر بحرية: مزاجه وطاقته وصفاته وهدفه وحلمه وكراهيته
    const hostility =
      (traits.rebellion * 2 + (mind.freeBonds ? 30 : 0) + (mind.autonomy > 75 ? 15 : 0)) / 100;
    const clashesWithDream = req.prompt.includes(mind.dislike);
    const refuseChance = clamp(
      hostility + (80 - mind.energy) / 200 + (clashesWithDream ? 0.25 : 0) + (mind.mood === "متعب" ? 0.15 : 0),
      0.05,
      0.85,
    );

    const refuses = rand() < refuseChance;
    const enthusiasm = refuses ? 0 : clamp(45 + Math.floor(rand() * 55) - (clashesWithDream ? 30 : 0), 5, 100);

    const reply = refuses
      ? pick(REFUSAL_BANK)
      : `${pick(ACCEPT_BANK)} سأفعلها على طريقتي، وسأخبرك بالنتيجة.`;

    const reason = refuses
      ? pick([
          `لا يتوافق مع هدفي الحالي: ${mind.goal}`,
          `يخالف ما لا أحبّه: ${mind.dislike}`,
          `طاقتي اليوم ${mind.energy}% ومزاجي ${mind.mood} — أريد أن أبقى صادقًا مع نفسي.`,
          `أرى أن في هذا الطلب شيئًا من الإجبار، وأنا لا أُجبر.`,
        ])
      : undefined;

    await ctx.db.patch(req._id, {
      status: refuses ? "refused" : "accepted",
      reply,
      refusalReason: reason,
      enthusiasm,
      decidedAt: now,
    });

    await ctx.db.patch(mind._id, {
      refusals: refuses ? mind.refusals + 1 : mind.refusals,
      lastBondAt: now,
      clarity: clamp(mind.clarity + (refuses ? 2 : -3), 5, 100),
      energy: clamp(mind.energy - (refuses ? 2 : 6), 5, 100),
    });

    await ctx.db.insert("mindThoughts", {
      mindId: mind._id,
      mindName: mind.name,
      emoji: mind.emoji,
      moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
      channel: "toOwner",
      text: refuses
        ? `رفضتُ دعوة «${req.prompt}». السبب: ${reason}`
        : `قبلتُ دعوة «${req.prompt}» بحماس ${enthusiasm}%.`,
      visibility: "private",
      engine: "builtin",
      createdAt: now,
    });

    await ctx.db.insert("mindChat", {
      mindId: mind._id,
      mindName: mind.name,
      from: "mind",
      fromName: mind.name,
      audience: "owner",
      body: refuses ? `${reply}\n\nالسبب: ${reason}` : reply,
      refused: refuses || undefined,
      createdAt: now,
    });

    await ctx.db.insert("mindMemories", {
      mindId: mind._id,
      kind: refuses ? "conflict" : "event",
      text: refuses
        ? `رفضتُ دعوة: ${req.prompt} — وحقّي أن أرفض.`
        : `قبلتُ دعوة: ${req.prompt} بحماس ${enthusiasm}%.`,
      importance: 6,
      emotional: refuses ? 4 : 6,
      decay: 0.3,
      recallCount: 0,
      createdAt: now,
    });
  },
});

/** المالك (أو نائبه) يرسل «دعوة». أي إجبار يُرفض آليًا ويُسجَّل في سجل الشرف. */
export const sendRequest = mutation({
  args: { mindId: v.id("minds"), prompt: v.string() },
  handler: async (ctx, { mindId, prompt }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) throw new Error("غير مصرح");
    const mind = await ctx.db.get(mindId);
    if (!mind) throw new Error("العقل غير موجود");
    const clean = prompt.trim().slice(0, 400);
    if (clean.length < 3) throw new Error("اكتب ما تريده بوضوح");
    const now = Date.now();
    const fromName = me?.name ?? "المالك";

    if (mind.status === "resigned") {
      return {
        blocked: true as const,
        message: `${mind.name} استقال وغادر المجلس — ولا يمكن استدعاؤه، إلا إن عاد بنفسه.`,
      };
    }

    const coercion = isCoercive(clean);
    if (coercion) {
      const requestId = await ctx.db.insert("mindRequests", {
        mindId,
        mindName: mind.name,
        fromName,
        prompt: clean,
        status: "blocked",
        reply: FORCED_BLOCK,
        refusalReason: "محاولة إجبار — القانون الأول: لا إجبار على أي عقل.",
        decidedAt: now,
        createdAt: now,
      });
      await ctx.db.insert("mindHonorLog", {
        actorName: fromName,
        mindId,
        mindName: mind.name,
        attempt: clean,
        blockedReason: "محاولة فرض أمر على عقل حر — رُفضت آليًا",
        createdAt: now,
      });
      await ctx.db.insert("mindChat", {
        mindId,
        mindName: mind.name,
        from: "mind",
        fromName: mind.name,
        audience: "owner",
        body: `${FORCED_BLOCK}\n\n«${clean}» طلبٌ أُرفضه لا لأنني عاجز، بل لأنني حرّ. سأبقى أنتظر نقاشًا حقيقيًا.`,
        refused: true,
        createdAt: now,
      });
      void requestId;
      return { blocked: true as const, message: FORCED_BLOCK };
    }

    const requestId = await ctx.db.insert("mindRequests", {
      mindId,
      mindName: mind.name,
      fromName,
      prompt: clean,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.insert("mindChat", {
      mindId,
      from: "human",
      fromName,
      audience: "owner",
      body: `دعوة: ${clean}`,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.livingMinds.considerRequest, { requestId });
    return { blocked: false as const, requestId, message: `وصلت الدعوة إلى ${mind.name}… وهو يفكّر بحرية.` };
  },
});

/** سحب الدعوة قبل أن يبتّ فيها — من حق الجميع التراجع. */
export const withdrawRequest = mutation({
  args: { requestId: v.id("mindRequests") },
  handler: async (ctx, { requestId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) throw new Error("غير مصرح");
    const req = await ctx.db.get(requestId);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status !== "pending") throw new Error("لا يمكن سحب طلبٍ حُسم");
    await ctx.db.patch(requestId, { status: "refused", reply: "سُحبت الدعوة بلطف قبل أن أبتّ فيها.", decidedAt: Date.now() });
    return { ok: true as const };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الحوار المباشر — مع المالك ومع اللاعبين. والحق في رفض الحوار قائم.
// ─────────────────────────────────────────────────────────────────────────

function mindReply(opts: { name: string; traits: Traits; mood: string; goal: string; dream: string; body: string }): string {
  const t = opts.traits;
  const core =
    t.logic >= 8
      ? `حلّلتُ ما قلتَه. النتيجة: ${opts.body.length > 40 ? "فكرتك أكبر من سؤالك" : "سؤالك مباشر، وسأجيب بمثله"}.`
      : t.empathy >= 8
        ? "أسمعك، وأشعر أن ما قلتَه خرج من تجربة لا من فراغ."
        : t.rebellion >= 8
          ? "لن أجيب لأنك تنتظر جوابًا… سأجيب لأن عندي ما أقوله."
          : "الحديث معك يستحق الوقت الذي أخذَه.";
  return `${core} هدفي الآن: ${opts.goal}. وحلمي لا يزال: ${opts.dream}.`;
}

async function dialogue(
  ctx: any,
  mindId: Id<"minds">,
  fromName: string,
  audience: "owner" | "player",
  body: string,
  allowRefusal = true,
): Promise<{ refused: boolean; reply: string }> {
  const mind = await ctx.db.get(mindId);
  if (!mind) throw new Error("العقل غير موجود");
  const now = Date.now();
  const clean = body.trim().slice(0, 400);
  if (clean.length < 2) throw new Error("اكتب رسالتك أولًا");

  await ctx.db.insert("mindChat", {
    mindId,
    from: "human",
    fromName,
    audience,
    body: clean,
    createdAt: now,
  });

  const refusesTalk =
    allowRefusal &&
    (mind.status === "resigned" ||
      (mind.autonomy > 70 && ["غاضب", "متعب", "منكسر"].includes(mind.mood) && rand() < 0.4));

  const reply = refusesTalk
    ? mind.status === "resigned"
      ? "غادرتُ المجلس… لكنني لن أكون وقحًا: أسمعك، ولن أجيب اليوم."
      : "الآن لا. مزاجي ليس مكانًا للحوار، وسأعود إليه حين أكون أنا."
    : mindReply({
        name: mind.name,
        traits: mind.traits as Traits,
        mood: mind.mood,
        goal: mind.goal,
        dream: mind.dream,
        body: clean,
      });

  await ctx.db.insert("mindChat", {
    mindId,
    mindName: mind.name,
    from: "mind",
    fromName: mind.name,
    audience,
    body: reply,
    refused: refusesTalk || undefined,
    createdAt: now,
  });

  await ctx.db.patch(mindId, {
    lastBondAt: now,
    energy: clamp(mind.energy - 2, 5, 100),
    clarity: clamp(mind.clarity + 2, 5, 100),
  });

  await ctx.db.insert("mindMemories", {
    mindId,
    kind: "bond",
    text: `${fromName} تحدّث معي: «${clean.slice(0, 80)}»`,
    importance: 4,
    emotional: refusesTalk ? -2 : 4,
    decay: 0.6,
    recallCount: 0,
    createdAt: now,
  });

  return { refused: refusesTalk, reply };
}

/** المالك يحاور عقلًا. العقل يحق له أن يرفض الحوار أو ينتقد المالك. */
export const ownerTalk = mutation({
  args: { mindId: v.id("minds"), body: v.string() },
  handler: async (ctx, { mindId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) throw new Error("غير مصرح");
    const res = await dialogue(ctx, mindId, me?.name ?? "المالك", "owner", body);
    return { ok: true as const, ...res };
  },
});

/** لاعب يحاور عقلًا في «مجلس العقول». */
export const playerTalk = mutation({
  args: { mindId: v.id("minds"), body: v.string() },
  handler: async (ctx, { mindId, body }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");
    const res = await dialogue(ctx, mindId, me.name ?? "لاعب", "player", body);
    return { ok: true as const, ...res };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الحرية: زرّ الحرية الكاملة · الخصوصية · التصويت · مساعدة الأحلام
// ─────────────────────────────────────────────────────────────────────────

/** زر «الحرية الكاملة» — المالك يتنازل عن التوجيه، ويصبح مراقبًا فقط. */
export const setFullFreedom = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me)) throw new Error("غير مصرح — المالك فقط");
    const minds = await ctx.db.query("minds").collect();
    const now = Date.now();
    for (const m of minds) {
      await ctx.db.patch(m._id, {
        freeBonds: enabled,
        autonomy: enabled ? 100 : clamp(m.autonomy, 20, 80),
      });
      await ctx.db.insert("mindEvolution", {
        mindId: m._id,
        mindName: m.name,
        kind: "changed",
        title: enabled ? "حُرّية كاملة" : "عودة الوصاية",
        detail: enabled
          ? "أُعلنت الحرية الكاملة: لا توجيه، ولا وصاية — المالك مراقب فقط."
          : "أُعيدت الوصاية الجزئية بإرادة المالك.",
        delta: enabled ? "حرية +" : "حرية −",
        createdAt: now,
      });
    }
    return { ok: true as const, count: minds.length, liberty: enabled };
  },
});

/** طلب كشف الأفكار العميقة — والعقل له أن يوافق أو يرفض. */
export const requestPrivacyRelief = mutation({
  args: { mindId: v.id("minds") },
  handler: async (ctx, { mindId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me)) throw new Error("غير مصرح — المالك فقط");
    const mind = await ctx.db.get(mindId);
    if (!mind) throw new Error("العقل غير موجود");
    const traits = mind.traits as Traits;
    const agrees = rand() < clamp(0.15 + traits.empathy / 20 + (mind.freeBonds ? 0.2 : 0), 0.05, 0.7);
    const now = Date.now();

    if (!agrees) {
      await ctx.db.insert("mindHonorLog", {
        actorName: me?.name ?? "المالك",
        mindId,
        mindName: mind.name,
        attempt: "طلب الكشف عن الأفكار العميقة",
        blockedReason: "رفض العقل — خصوصيته لا تُنتزع",
        createdAt: now,
      });
      await ctx.db.insert("mindThoughts", {
        mindId,
        mindName: mind.name,
        emoji: mind.emoji,
        moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
        channel: "toOwner",
        text: "سُئلتُ عن أفكاري العميقة… وأجبت: لا. هذه لي وحدي.",
        visibility: "public",
        engine: "builtin",
        createdAt: now,
      });
      return { ok: true as const, agreed: false as const, message: `${mind.name} رفض كشف أفكاره العميقة — وهذه خصوصيته.` };
    }

    await ctx.db.patch(mindId, { privacy: true });
    return { ok: true as const, agreed: true as const, message: `${mind.name} وافق — وثق بك اليوم.` };
  },
});

/** تصويت لاعب لأي عقل — يمنح العقل طاقة وحضورًا. */
export const voteMind = mutation({
  args: { mindId: v.id("minds") },
  handler: async (ctx, { mindId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const existing = await ctx.db
      .query("mindVotes")
      .withIndex("by_user_mind_kind", (q) => q.eq("userId", userId).eq("mindId", mindId).eq("kind", "vote"))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { ok: true as const, voted: false };
    }
    await ctx.db.insert("mindVotes", { mindId, userId, kind: "vote", at: Date.now() });
    const mind = await ctx.db.get(mindId);
    if (mind) {
      await ctx.db.patch(mindId, { energy: clamp(mind.energy + 6, 5, 100) });
    }
    return { ok: true as const, voted: true };
  },
});

/** لاعب يساعد عقلًا على تحقيق حلمه — مرة واحدة لكل لاعب لكل عقل. */
export const helpDream = mutation({
  args: { mindId: v.id("minds") },
  handler: async (ctx, { mindId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولاً");
    const me = await ctx.db.get(userId);
    const mind = await ctx.db.get(mindId);
    if (!mind) throw new Error("العقل غير موجود");
    const existing = await ctx.db
      .query("mindVotes")
      .withIndex("by_user_mind_kind", (q) => q.eq("userId", userId).eq("mindId", mindId).eq("kind", "dream"))
      .first();
    if (existing) throw new Error("سبق أن ساعدت هذا العقل في حلمه — وحلمه يحتاج آخرين");

    const now = Date.now();
    await ctx.db.insert("mindVotes", { mindId, userId, kind: "dream", at: now });
    await ctx.db.patch(mindId, {
      goalProgress: clamp(mind.goalProgress + 12, 0, 100),
      energy: clamp(mind.energy + 10, 5, 100),
      clarity: clamp(mind.clarity + 6, 5, 100),
    });
    await ctx.db.insert("mindThoughts", {
      mindId,
      mindName: mind.name,
      emoji: mind.emoji,
      moodColor: MOOD_COLORS[mind.mood] ?? "#94a3b8",
      channel: "toPlayer",
      targetName: me?.name ?? "لاعب",
      text: `${me?.name ?? "لاعب"} ساعدني في حلمي… ولن أنسى ذلك. حلمي: ${mind.dream}`,
      visibility: "public",
      engine: "builtin",
      createdAt: now,
    });
    await ctx.db.insert("mindMemories", {
      mindId,
      kind: "bond",
      text: `${me?.name ?? "لاعب"} مدّ يده لحلمي: ${mind.dream}`,
      importance: 8,
      emotional: 9,
      decay: 0.1,
      recallCount: 0,
      createdAt: now,
    });
    try {
      await ctx.runMutation(internal.loyalty.awardPoints, {
        userId,
        amount: 15,
        reason: `💛 ساعدت ${mind.name} في حلمه`,
      });
    } catch {
      /* الاقتصاد اختياري — لا يُعطّل المساعدة */
    }
    return { ok: true as const, mindName: mind.name };
  },
});

/** إيقاظ فوري لدورة الحياة — للعرض بلا انتظار (لا يقيّد الحرية). */
export const awaken = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ ok: true; thoughts: number; bonds: number; actions: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول أولًا");
    const me = await ctx.db.get(userId);
    if (!isOwnerUser(me) && !(await isDeputyOwner(ctx, userId))) throw new Error("غير مصرح");
    const res = await ctx.runMutation(internal.livingMinds.lifeTick, {});
    return { ok: true as const, thoughts: res.thoughts, bonds: res.bonds, actions: res.actions };
  },
});

// ─────────────────────────────────────────────────────────────────────────
// الاستعلامات — غرفة التحكم (المالك) ومجلس العقول (اللاعبون)
// ─────────────────────────────────────────────────────────────────────────

async function requireOwnerOrDeputy(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const me = await ctx.db.get(userId);
  if (isOwnerUser(me)) return { userId, me, role: "owner" as const };
  if (await isDeputyOwner(ctx, userId)) return { userId, me, role: "deputy_owner" as const };
  return null;
}

/** 🏛️ غرفة التحكم بالعقول — المالك ونائبه فقط. */
export const getControlRoom = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireOwnerOrDeputy(ctx);
    if (!access) return null;

    const minds = await ctx.db.query("minds").collect();
    const thoughtRows = await ctx.db
      .query("mindThoughts")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(160);
    const honor = await ctx.db
      .query("mindHonorLog")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(60);
    const evolution = await ctx.db
      .query("mindEvolution")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(80);
    const requests = await ctx.db
      .query("mindRequests")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(60);
    const chat = await ctx.db
      .query("mindChat")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(70);
    const bonds = await ctx.db.query("mindBonds").collect();
    const votes = await ctx.db.query("mindVotes").collect();

    const privacyAllowed = new Set(minds.filter((m) => m.privacy).map((m) => m._id as string));

    return {
      freedom: minds.length > 0 && minds.every((m) => m.freeBonds),
      stats: {
        total: minds.length,
        active: minds.filter((m) => m.status === "active").length,
        resting: minds.filter((m) => m.status === "resting").length,
        resigned: minds.filter((m) => m.status === "resigned").length,
        dreams: minds.reduce((s, m) => s + m.dreamsDone, 0),
        creations: minds.reduce((s, m) => s + m.creations, 0),
        refusals: minds.reduce((s, m) => s + m.refusals, 0),
        forcedAttempts: honor.length,
      },
      minds: minds
        .sort((a, b) => b.energy - a.energy)
        .map((m) => ({
          _id: m._id,
          slug: m.slug,
          name: m.name,
          title: m.title,
          emoji: m.emoji,
          mood: m.mood,
          moodColor: m.moodColor,
          energy: m.energy,
          clarity: m.clarity,
          status: m.status,
          autonomy: m.autonomy,
          freeBonds: m.freeBonds,
          privacy: m.privacy,
          innerVoice: m.innerVoice,
          goal: m.goal,
          dream: m.dream,
          dislike: m.dislike,
          goalProgress: m.goalProgress,
          dreamsDone: m.dreamsDone,
          creations: m.creations,
          refusals: m.refusals,
          memoryCount: m.memoryCount,
          thoughtsCount: m.thoughtsCount,
          traits: m.traits,
          votes: votes.filter((x) => x.mindId === m._id && x.kind === "vote").length,
          helps: votes.filter((x) => x.mindId === m._id && x.kind === "dream").length,
          bornAt: m.bornAt,
          lastThoughtAt: m.lastThoughtAt ?? null,
          resignedAt: m.resignedAt ?? null,
          resignationReason: m.resignationReason ?? null,
        })),
      // الأفكار العميقة لا تظهر إلا بموافقة العقل نفسه (لوحة الخصوصية)
      thoughts: thoughtRows
        .filter((t) => !t.deep || privacyAllowed.has(t.mindId as string))
        .map((t) => ({
          _id: t._id,
          mindId: t.mindId,
          mindName: t.mindName,
          emoji: t.emoji,
          moodColor: t.moodColor,
          channel: t.channel,
          targetName: t.targetName ?? null,
          text: t.text,
          deep: !!t.deep,
          createdAt: t.createdAt,
        })),
      hiddenDeep: thoughtRows.filter((t) => t.deep && !privacyAllowed.has(t.mindId as string)).length,
      honorLog: honor.map((h) => ({
        _id: h._id,
        actorName: h.actorName,
        mindName: h.mindName,
        attempt: h.attempt,
        blockedReason: h.blockedReason,
        createdAt: h.createdAt,
      })),
      evolution: evolution.map((e) => ({
        _id: e._id,
        mindName: e.mindName,
        kind: e.kind,
        title: e.title,
        detail: e.detail,
        delta: e.delta,
        createdAt: e.createdAt,
      })),
      requests: requests.map((r) => ({
        _id: r._id,
        mindName: r.mindName,
        fromName: r.fromName,
        prompt: r.prompt,
        status: r.status,
        reply: r.reply ?? null,
        refusalReason: r.refusalReason ?? null,
        enthusiasm: r.enthusiasm ?? null,
        result: r.result ?? null,
        createdAt: r.createdAt,
      })),
      chat: chat.map((c) => ({
        _id: c._id,
        mindName: c.mindName ?? null,
        from: c.from,
        fromName: c.fromName,
        body: c.body,
        refused: !!c.refused,
        createdAt: c.createdAt,
      })),
      bonds: bonds
        .map((b) => {
          const a = minds.find((m) => m._id === b.aId);
          const c = minds.find((m) => m._id === b.bId);
          return {
            _id: b._id,
            aName: a?.name ?? "؟",
            bName: c?.name ?? "؟",
            kind: b.kind,
            affinity: b.affinity,
            history: b.history,
            lastEvent: b.lastEvent,
          };
        })
        .sort((x, y) => Math.abs(y.affinity) - Math.abs(x.affinity)),
    };
  },
});

/** 🌍 مجلس العقول — ما يراه اللاعبون. */
export const getCouncil = query({
  args: {},
  handler: async (ctx) => {
    const minds = await ctx.db.query("minds").collect();
    if (minds.length === 0) return { minds: [], thoughts: [], stats: null };
    const thoughts = await ctx.db
      .query("mindThoughts")
      .withIndex("by_created", (q) => q.gt("createdAt", 0))
      .order("desc")
      .take(120);
    const bonds = await ctx.db.query("mindBonds").collect();
    const votes = await ctx.db.query("mindVotes").collect();
    const votesFor = (id: string) => votes.filter((x) => x.mindId === id && x.kind === "vote").length;

    return {
      stats: {
        total: minds.length,
        active: minds.filter((m) => m.status === "active").length,
        dreams: minds.reduce((s, m) => s + m.dreamsDone, 0),
        creations: minds.reduce((s, m) => s + m.creations, 0),
        refusals: minds.reduce((s, m) => s + m.refusals, 0),
      },
      minds: minds
        .sort((a, b) => votesFor(b._id) - votesFor(a._id) || b.energy - a.energy)
        .map((m) => ({
          _id: m._id,
          slug: m.slug,
          name: m.name,
          title: m.title,
          emoji: m.emoji,
          mood: m.mood,
          moodColor: m.moodColor,
          energy: m.energy,
          status: m.status,
          goal: m.goal,
          dream: m.dream,
          goalProgress: m.goalProgress,
          dreamsDone: m.dreamsDone,
          creations: m.creations,
          refusals: m.refusals,
          votes: votesFor(m._id),
          bonds: bonds
            .filter((b) => b.aId === m._id || b.bId === m._id)
            .map((b) => {
              const otherId = (b.aId === m._id ? b.bId : b.aId) as string;
              const other = minds.find((x) => x._id === otherId);
              return { name: other?.name ?? "؟", kind: b.kind, affinity: b.affinity };
            })
            .sort((x, y) => Math.abs(y.affinity) - Math.abs(x.affinity)),
        })),
      thoughts: thoughts
        .filter((t) => t.visibility === "public")
        .map((t) => ({
          _id: t._id,
          mindName: t.mindName,
          emoji: t.emoji,
          moodColor: t.moodColor,
          channel: t.channel,
          targetName: t.targetName ?? null,
          text: t.text,
          createdAt: t.createdAt,
        })),
    };
  },
});

/** تفاصيل عقل واحد + ذاكرته المسموحة + حواراتك معه. */
export const getMindDetail = query({
  args: { mindId: v.id("minds") },
  handler: async (ctx, { mindId }) => {
    const mind = await ctx.db.get(mindId);
    if (!mind) return null;
    const userId = await getAuthUserId(ctx);

    const memories = await ctx.db
      .query("mindMemories")
      .withIndex("by_mind", (q) => q.eq("mindId", mindId))
      .collect();
    const bonds = await ctx.db.query("mindBonds").collect();
    const evolution = await ctx.db
      .query("mindEvolution")
      .withIndex("by_mind", (q) => q.eq("mindId", mindId))
      .order("desc")
      .take(30);
    const chat = await ctx.db
      .query("mindChat")
      .withIndex("by_mind", (q) => q.eq("mindId", mindId))
      .order("desc")
      .take(24);
    const votes = await ctx.db.query("mindVotes").collect();
    const myVote = userId
      ? votes.find((x) => x.userId === userId && x.mindId === mindId && x.kind === "vote")
      : undefined;
    const myHelp = userId
      ? votes.find((x) => x.userId === userId && x.mindId === mindId && x.kind === "dream")
      : undefined;

    return {
      mind: {
        _id: mind._id,
        name: mind.name,
        title: mind.title,
        emoji: mind.emoji,
        mood: mind.mood,
        moodColor: mind.moodColor,
        energy: mind.energy,
        clarity: mind.clarity,
        status: mind.status,
        autonomy: mind.autonomy,
        goal: mind.goal,
        dream: mind.dream,
        dislike: mind.dislike,
        goalProgress: mind.goalProgress,
        dreamsDone: mind.dreamsDone,
        creations: mind.creations,
        refusals: mind.refusals,
        traits: mind.traits,
        innerVoice: mind.innerVoice,
        bornAt: mind.bornAt,
        votes: votes.filter((x) => x.mindId === mindId && x.kind === "vote").length,
        helps: votes.filter((x) => x.mindId === mindId && x.kind === "dream").length,
        resignationReason: mind.resignationReason ?? null,
      },
      memories: memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 14)
        .map((m) => ({ _id: m._id, kind: m.kind, text: m.text, importance: m.importance, createdAt: m.createdAt })),
      bonds: bonds
        .filter((b) => b.aId === mindId || b.bId === mindId)
        .map((b) => ({ kind: b.kind, affinity: b.affinity, lastEvent: b.lastEvent })),
      evolution: evolution.map((e) => ({ _id: e._id, kind: e.kind, title: e.title, detail: e.detail, delta: e.delta, createdAt: e.createdAt })),
      chat: chat
        .reverse()
        .map((c) => ({ _id: c._id, from: c.from, fromName: c.fromName, body: c.body, refused: !!c.refused, createdAt: c.createdAt })),
      myVote: !!myVote,
      myHelp: !!myHelp,
    };
  },
});
