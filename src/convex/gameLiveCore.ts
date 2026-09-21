/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 v15.0 — نواة غرفة اللعب الحيّة (منطق نقي، قابل للاختبار)
 *
 * ما وجدتُه في `src/pages/Game.tsx`: تعليق في أعلى الملف يعلن أربع ميزات:
 *   «Real-time performance analysis · AI difficulty adjustment ·
 *    Smart scoring optimization · Player behavior prediction»
 * وبالفحص: **ثلاث منها لم تكن موجودة أبداً** — لا دالة ولا حقل ولا استعلام.
 * والأسئلة كلها تُختار مرة واحدة قبل بدء الجولة (`questionIds` ثابت)، فالغرفة
 * لا تتكيّف مع أداء أحد.
 *
 * هذا الملف يجعل الثلاثة **حقيقة رياضية** لا وعداً في تعليق:
 *   ① تحليل أداء حيّ — من إجابات اللاعبين الحقيقية لحظة بلحظة.
 *   ② توقّع سلوك — احتمال إصابة السؤال القادم وزمنه، مع درجة ثقة من العيّنة.
 *   ③ ضبط صعوبة تكيّفي — قرار مكتوب (سهل/متوسط/صعب + نسبة الصعب) يُطبَّق فعلاً
 *      على الأسئلة **التي لم يصلها أحد بعد**، بلا لمس أي إجابة مسجّلة.
 *
 * (والميزة الرابعة — «تحسين التسجيل الذكي» — موجودة فعلاً وتعمل في
 *  `games.submitAnswer`: نقاط الصعوبة + مكافأة السرعة + السلسلة + أول إصابة
 *  + السؤال الذهبي + نصف نقاط الإعادة. فلم أُعد بناءها، بل صحّحتُ التعليق
 *  الكاذب ليشير إليها بدل أن يدّعي ما ليس في الملف.)
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface LiveAnswerInput {
  correct: boolean;
  elapsedMs: number;
}

export interface LivePlayerInput {
  userId: string;
  name: string;
  score: number;
  streak: number;
  answers: (LiveAnswerInput | null)[];
}

export interface LivePlayerRow {
  userId: string;
  name: string;
  score: number;
  streak: number;
  answered: number;
  correct: number;
  wrong: number;
  accuracy: number; // 0-100
  avgMs: number;
  fastestMs: number; // 0 إن لم يجب بعد
  recent: ("hit" | "miss")[]; // آخر ٥ إجابات
  momentum: number; // -100..100 — اتجاه الأداء القريب مقابل الإجمالي
  rank: number; // 1 = الأعلى نقاطاً
  speedRank: number; // 1 = الأسرع (0 إن لا قياس)
}

/** أقل عدد إجابات جماعية يُعتدّ به قبل تغيير الصعوبة */
export const ADAPTIVE_MIN_SAMPLE = 3;

function safeAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

/**
 * تحليل الأداء الحيّ — كل رقم مشتقّ من إجابات مسجّلة فعلاً،
 * ولا يُحتسب سؤال لم يُجب عنه (لا صفر ولا تخمين).
 */
export function buildLiveRows(players: LivePlayerInput[]): LivePlayerRow[] {
  const base = players.map((p) => {
    const answered = p.answers.filter((a): a is LiveAnswerInput => a !== null && a !== undefined);
    const correct = answered.filter((a) => a.correct).length;
    const wrong = answered.length - correct;
    const times = answered.map((a) => Math.max(0, a.elapsedMs));
    const recent = answered.slice(-5).map((a) => (a.correct ? ("hit" as const) : ("miss" as const)));
    const recentHits = recent.filter((r) => r === "hit").length;
    const accuracy = answered.length > 0 ? Math.round((correct / answered.length) * 1000) / 10 : 0;
    const recentAccuracy = recent.length > 0 ? (recentHits / recent.length) * 100 : accuracy;
    return {
      userId: p.userId,
      name: p.name,
      score: Math.max(0, Math.floor(p.score)),
      streak: Math.max(0, Math.floor(p.streak)),
      answered: answered.length,
      correct,
      wrong,
      accuracy,
      avgMs: safeAvg(times),
      fastestMs: times.length > 0 ? Math.min(...times) : 0,
      recent,
      momentum: answered.length > 0 ? Math.round(recentAccuracy - accuracy) : 0,
      rank: 0,
      speedRank: 0,
    };
  });

  const byScore = [...base].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  byScore.forEach((row, i) => {
    row.rank = i + 1;
  });

  const measured = base.filter((r) => r.avgMs > 0).sort((a, b) => a.avgMs - b.avgMs);
  measured.forEach((row, i) => {
    row.speedRank = i + 1;
  });

  return base.sort((a, b) => a.rank - b.rank);
}

export interface NextOutcome {
  probability: number; // 0-100 — احتمال إصابة السؤال القادم
  expectedMs: number; // زمن متوقّع بالمللي ثانية (0 إن لا قياس)
  confidence: number; // 0-100 — من حجم العيّنة الحقيقي فقط
  label: string;
}

/**
 * توقّع السلوك — تنعيم لابلاس: نبدأ من ٥٠٪ ثم تتحرك مع كل إجابة حقيقية،
 * فلا يعطي لاعباً بسؤال واحد «١٠٠٪» ولا يعاقب من لم يُجب بعد.
 */
export function predictNext(row: LivePlayerRow): NextOutcome {
  const priorStrength = 4;
  const probability =
    Math.round(((row.correct + priorStrength / 2) / (row.answered + priorStrength)) * 1000) / 10;

  // السلسلة الساخنة/الباردة تُحرّك الزمن المتوقّع قليلاً — لا أكثر
  const swing = row.momentum > 15 ? -0.06 : row.momentum < -15 ? 0.08 : 0;
  const expectedMs = row.avgMs > 0 ? Math.max(0, Math.round(row.avgMs * (1 + swing))) : 0;
  const confidence = Math.min(100, Math.round((row.answered / 8) * 100));

  const label =
    row.answered === 0
      ? "لم يُقَس بعد"
      : probability >= 75
        ? "مرشّح للإصابة"
        : probability >= 50
          ? "متوازن"
          : "منطقة خطر";

  return { probability, expectedMs, confidence, label };
}

export type LiveDifficulty = "easy" | "medium" | "hard";

export interface DifficultyCall {
  difficulty: LiveDifficulty;
  hardRatio: number;
  roomAccuracy: number;
  sample: number;
  reason: string;
}

/**
 * ضبط الصعوبة — دقّة الغرفة الحقيقية تختار التوزيع القادم.
 * أقل من `ADAPTIVE_MIN_SAMPLE` إجابات ⇒ لا نغامر: نُبقي التوزيع الافتراضي ونقول لماذا.
 */
export function recommendDifficulty(rows: LivePlayerRow[]): DifficultyCall {
  const sample = rows.reduce((s, r) => s + r.answered, 0);
  const correct = rows.reduce((s, r) => s + r.correct, 0);

  if (sample < ADAPTIVE_MIN_SAMPLE) {
    return {
      difficulty: "medium",
      hardRatio: 0.2,
      roomAccuracy: sample > 0 ? Math.round((correct / sample) * 1000) / 10 : 0,
      sample,
      reason: `العيّنة ${sample} إجابة فقط (الحد ${ADAPTIVE_MIN_SAMPLE}) — نبقي التوزيع الافتراضي حتى تتضح الصورة.`,
    };
  }

  const roomAccuracy = Math.round((correct / sample) * 1000) / 10;
  if (roomAccuracy >= 78) {
    return {
      difficulty: "hard",
      hardRatio: 0.5,
      roomAccuracy,
      sample,
      reason: `الغرفة أصابت ${roomAccuracy}٪ من ${sample} إجابة — نرفع الأسئلة الصعبة إلى النصف.`,
    };
  }
  if (roomAccuracy >= 60) {
    return {
      difficulty: "hard",
      hardRatio: 0.32,
      roomAccuracy,
      sample,
      reason: `الغرفة أصابت ${roomAccuracy}٪ — نرفع الصعبة إلى الثلث تقريباً.`,
    };
  }
  if (roomAccuracy >= 42) {
    return {
      difficulty: "medium",
      hardRatio: 0.2,
      roomAccuracy,
      sample,
      reason: `الغرفة أصابت ${roomAccuracy}٪ — التوزيع المتوازن مناسب كما هو.`,
    };
  }
  return {
    difficulty: "easy",
    hardRatio: 0.1,
    roomAccuracy,
    sample,
    reason: `الغرفة أصابت ${roomAccuracy}٪ فقط — نخفّف الأسئلة الصعبة ليبقى التحدي ممكناً.`,
  };
}

export interface TailPlan {
  /** أول سؤال لم يصل إليه أحد (آمن للتغيير) */
  tailStart: number;
  /** كم سؤالاً متبقياً يمكن تغييره */
  tailCount: number;
  shouldRetune: boolean;
  why: string;
}

/**
 * خطة الذيل: نُغيّر الأسئلة **التي لم يصلها أحد بعد فقط**.
 * الإجابات المسجّلة محفوظة بالفهرس، فتغيير سؤال مُجاب عنه سيُفسدها — لذلك ممنوع.
 */
export function planTail(totalQuestions: number, currentIndex: number): TailPlan {
  const tailStart = Math.max(0, Math.floor(currentIndex) + 1);
  const tailCount = Math.max(0, Math.floor(totalQuestions) - tailStart);
  if (tailCount < 2) {
    return {
      tailStart,
      tailCount,
      shouldRetune: false,
      why: "لا أسئلة كافية متبقية للتعديل (أقل من سؤالين).",
    };
  }
  return {
    tailStart,
    tailCount,
    shouldRetune: true,
    why: `يمكن تعديل ${tailCount} سؤالاً لم يصلها أحد بعد.`,
  };
}

/** هل يستحق التعديل أن يُنفَّذ فعلاً؟ (يمنع التبديل العبثي مع كل سؤال) */
export function worthRetuning(prev: { difficulty: LiveDifficulty; hardRatio: number } | null, next: DifficultyCall): boolean {
  if (!prev) return true;
  if (prev.difficulty !== next.difficulty) return true;
  return Math.abs(prev.hardRatio - next.hardRatio) >= 0.1;
}
