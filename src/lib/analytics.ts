/**
 * ═══════════════════════════════════════════════════════════════════════
 * التحليلات الشخصية — منطق مشترك نقي
 * ═══════════════════════════════════════════════════════════════════════
 * تجميع الإجابات حسب التصنيف/الصعوبة + منحنى النشاط + رؤى ذكية بالعربية.
 * كل شيء هنا نقي (بدون I/O) ليكون قابلاً للاختبار والمشاركة.
 */
import { dayKey } from "./progression";

// ─── تجميع الإجابات ──────────────────────────────────────────────────────

export interface AnswerSample {
  category: string;
  difficulty: string;
  wasCorrect: boolean;
}

export interface GroupRow {
  key: string;
  total: number;
  correct: number;
  accuracy: number; // 0-100
}

/** تجميع عينات إجابات حسب مفتاح ثم ترتيب تنازلي حسب العدد. */
export function groupAnswers(
  samples: AnswerSample[],
  keyOf: (s: AnswerSample) => string,
): GroupRow[] {
  const acc = new Map<string, { total: number; correct: number }>();
  for (const s of samples) {
    const key = keyOf(s);
    const cur = acc.get(key) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (s.wasCorrect) cur.correct += 1;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([key, v]) => ({
      key,
      total: v.total,
      correct: v.correct,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** توزيع الإتقان حسب التصنيف. */
export function categoryBreakdown(samples: AnswerSample[]): GroupRow[] {
  return groupAnswers(samples, (s) => s.category);
}

export const DIFFICULTY_ORDER = ["easy", "medium", "hard"] as const;
export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

/** توزيع الإتقان حسب الصعوبة (بترتيب ثابت). */
export function difficultyBreakdown(samples: AnswerSample[]): GroupRow[] {
  const rows = groupAnswers(samples, (s) => s.difficulty);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return DIFFICULTY_ORDER.map((d) => byKey.get(d)).filter(
    (r): r is GroupRow => Boolean(r && r.total > 0),
  );
}

// ─── منحنى النشاط (آخر N أيام) ───────────────────────────────────────────

export interface GameSample {
  playedAt: number;
  correctCount: number;
  xpEarned: number;
}

export interface DayActivity {
  day: string; // YYYY-MM-DD
  games: number;
  correct: number;
  xp: number;
}

/** توزيع سجلات اللعب على آخر N أيام (بما فيها الأيام الخالية). */
export function buildActivityTrend(
  samples: GameSample[],
  days = 7,
  now = Date.now(),
): DayActivity[] {
  const cells: DayActivity[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * 24 * 60 * 60 * 1000;
    cells.push({ day: dayKey(ts), games: 0, correct: 0, xp: 0 });
  }
  const index = new Map(cells.map((c, i) => [c.day, i]));
  for (const s of samples) {
    const i = index.get(dayKey(s.playedAt));
    if (i === undefined) continue;
    cells[i].games += 1;
    cells[i].correct += s.correctCount ?? 0;
    cells[i].xp += s.xpEarned ?? 0;
  }
  return cells;
}

// ─── رؤى ذكية بالعربية ───────────────────────────────────────────────────

export interface InsightInput {
  answered: number;
  accuracy: number; // 0-100
  totalGames: number;
  wins: number;
  bestStreak: number;
  categories: GroupRow[];
}

export const DAY_NAME: Record<string, string> = {
  Mon: "الإثنين",
  Tue: "الثلاثاء",
  Wed: "الأربعاء",
  Thu: "الخميس",
  Fri: "الجمعة",
  Sat: "السبت",
  Sun: "الأحد",
};

export function dayDisplay(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  const name = d.toUTCString().slice(0, 3);
  return DAY_NAME[name] ?? day.slice(5);
}

/** توليد ملاحظات عربية مبنية على بيانات حقيقية (قواعد واضحة وقابلة للاختبار). */
export function buildInsights(input: InsightInput): string[] {
  const out: string[] = [];
  if (input.answered === 0) {
    out.push(
      "لم تجب عن أي سؤال بعد — العب أول جولة لتظهر تحليلاتك الكاملة هنا 📊",
    );
  } else {
    if (input.accuracy >= 75) {
      out.push(
        `دقتك الإجمالية ${input.accuracy}% — مستوى ممتاز! جرب وضع «الخبير» لتحدٍّ أقوى 🚀`,
      );
    } else if (input.accuracy < 45 && input.answered >= 10) {
      out.push(
        `دقتك ${input.accuracy}% — ابدأ بوضع «التدريب» واقرأ تفسير كل إجابة بتركيز قبل التسريع 🎯`,
      );
    } else if (input.answered >= 5) {
      out.push(
        `دقتك ${input.accuracy}% — استمر بالجولات القصيرة المنتظمة فهي الأسرع للتحسن 📈`,
      );
    }

    const weakest = [...input.categories]
      .filter((c) => c.total >= 5)
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    if (weakest) {
      out.push(
        `أضعف تصنيفاتك حالياً «${weakest.key}» بدقة ${weakest.accuracy}% — ركّز عليه في جولات «المصمّمة» لتقويته 💪`,
      );
    }
    const strongest = [...input.categories]
      .filter((c) => c.total >= 3)
      .sort((a, b) => b.accuracy - a.accuracy)[0];
    if (strongest && weakest && strongest.key !== weakest.key) {
      out.push(
        `نقطة قوتك «${strongest.key}» بدقة ${strongest.accuracy}% — استخدمها لرفع سلسلتك في الجولات القصيرة ⚡`,
      );
    }
  }

  if (input.bestStreak >= 5) {
    out.push(
      `أفضل سلسلة لديك ${input.bestStreak} — أنت في حالة تركيز رائعة، حافظ على الوتيرة 🔥`,
    );
  } else if (input.totalGames >= 3) {
    out.push(
      "حاول تجاوز 5 إجابات متتالية في جولة واحدة لرفع سلسلتك القصوى وتقوية تركيزك 🧠",
    );
  }

  const winRate =
    input.totalGames > 0 ? Math.round((input.wins / input.totalGames) * 100) : 0;
  if (input.totalGames >= 5) {
    if (winRate >= 60) {
      out.push(`نسبة فوزك ${winRate}% — أداء تصاعدي ممتاز بين المنافسين 🏆`);
    } else if (winRate < 30) {
      out.push(
        `نسبة فوزك ${winRate}% — ركّز على الدقة أكثر من السرعة حتى ترتفع 🔁`,
      );
    }
  }
  return out.slice(0, 5);
}
