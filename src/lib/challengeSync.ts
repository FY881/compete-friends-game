import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { normalizeCode } from "@/convex/challengeCore";
import { grantCoins } from "@/lib/localEngine";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ v11.0 — جسر التحدّيات (غرفة / ملتقى ⇄ الساحة ⇄ محفظتك)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * يحوّل كود التحدّي إلى تجربة كاملة:
 *   ١) يقرأ التحدّي الحقيقي من الخادم (عدد الأسئلة · الصعوبة · المكافأة المُعلنة).
 *   ٢) يرسل نتيجتك بعد الجولة، والخادم هو من يحسب المكافأة ويتحقق من النتيجة.
 *   ٣) يضيف العملات إلى محفظتك المحلية **مرة واحدة فقط** وعندما يؤكّد الخادم
 *      أنه دفع لك فعلاً — فلا مكافأة مزدوجة ولا وعد كاذب.
 *   ٤) إن انقطع الاتصال، تُحفظ النتيجة في قائمة انتظار صغيرة وتُرسل عند أول
 *      اتصال تالٍ — فلا يضيع جهد اللاعب بسبب الشبكة.
 *
 * أوفلاين-أولاً: بلا تسجيل دخول تبقى اللعبة تعمل، ويُخبر اللاعب بصدق أن
 * مكافأة التحدّي تحتاج تسجيلاً.
 * ═══════════════════════════════════════════════════════════════════════
 */

const PENDING_KEY = "mindclash.challenge.pending";
const PAID_KEY = "mindclash.challenge.paid";
const PENDING_LIMIT = 5;

export interface ChallengeInfo {
  code: string;
  source: string;
  title: string;
  note: string;
  difficulty: string;
  difficultyLabel: string;
  difficultyEmoji: string;
  seconds: number;
  questionCount: number;
  rewardXp: number;
  rewardCoins: number;
  createdByName: string;
  status: string;
  playable: boolean;
  remaining: string;
  plays: number;
  completions: number;
  rewardedCount: number;
  participants: number;
  board: { userId: string; userName: string; correct: number; total: number; score: number; createdAt: number }[];
  myRank: number;
  mine: { played: boolean; rewarded: boolean; attempts: number; bestScore: number; label: string } | null;
  roomId: string | null;
}

export interface ChallengeSubmitResult {
  ok: boolean;
  passed: boolean;
  rewardedNow: boolean;
  alreadyRewarded: boolean;
  xpAwarded: number;
  coinsAwarded: number;
  coinsTo: string;
  grade: { tier: string; label: string; emoji: string; passed: boolean; ratio: number };
  note: string;
  bestScore: number;
}

export interface ChallengeSubmitOutcome {
  status: "paid" | "no-reward" | "already" | "queued" | "unauthenticated" | "failed";
  message: string;
  result: ChallengeSubmitResult | null;
  coinsGranted: number;
}

// ─── تخزين محلي بسيط ───────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين ممتلئ — لا نُسقط اللعب */
  }
}

export interface PendingRun {
  code: string;
  correct: number;
  total: number;
  score: number;
  durationMs: number;
  at: number;
}

function readPending(): PendingRun[] {
  const rows = readJson<PendingRun[]>(PENDING_KEY, []);
  return Array.isArray(rows) ? rows.filter((r) => typeof r?.code === "string").slice(0, PENDING_LIMIT) : [];
}

function pushPending(run: PendingRun): void {
  const rows = readPending().filter((r) => r.code !== run.code);
  writeJson(PENDING_KEY, [run, ...rows].slice(0, PENDING_LIMIT));
}

function dropPending(code: string): void {
  writeJson(
    PENDING_KEY,
    readPending().filter((r) => r.code !== code),
  );
}

function readPaid(): string[] {
  const rows = readJson<string[]>(PAID_KEY, []);
  return Array.isArray(rows) ? rows.filter((x): x is string => typeof x === "string") : [];
}

/** يضمن أن العملات المحلية تُمنح مرة واحدة فقط لكل كود تحدٍّ. */
function payLocalCoins(code: string, amount: number): number {
  if (amount <= 0) return 0;
  const paid = readPaid();
  if (paid.includes(code)) return 0;
  const granted = grantCoins(amount);
  writeJson(PAID_KEY, [...paid, code].slice(-60));
  return granted;
}

// ─── الخطاف ────────────────────────────────────────────────────────────

export function useChallenge(rawCode: string | null | undefined) {
  const code = useMemo(() => normalizeCode(rawCode ?? "") || null, [rawCode]);
  const info = useQuery(api.challenges.getChallenge, code ? { code } : "skip");
  const submit = useMutation(api.challenges.submitChallengeRun);
  const { isAuthenticated } = useConvexAuth();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ChallengeSubmitOutcome | null>(null);

  const challenge = (info ?? null) as ChallengeInfo | null;
  const loading = code !== null && info === undefined;

  const send = useCallback(
    async (pending: PendingRun): Promise<ChallengeSubmitOutcome> => {
      try {
        const res = (await submit({
          code: pending.code,
          correct: pending.correct,
          total: pending.total,
          score: pending.score,
          durationMs: pending.durationMs,
        })) as ChallengeSubmitResult;
        dropPending(pending.code);
        const coinsGranted = res.rewardedNow ? payLocalCoins(pending.code, res.coinsAwarded) : 0;
        const status: ChallengeSubmitOutcome["status"] = res.rewardedNow
          ? "paid"
          : res.alreadyRewarded
            ? "already"
            : "no-reward";
        return { status, message: res.note, result: res, coinsGranted };
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر إرسال النتيجة";
        // أخطاء القواعد (تحدٍّ منتهٍ · نتيجة غير مطابقة) لا تُعاد محاولتها
        const permanent = /انتهت|أُغلق|يطابق|غير موجود/.test(message);
        if (permanent) {
          dropPending(pending.code);
          return { status: "failed", message, result: null, coinsGranted: 0 };
        }
        pushPending(pending);
        return { status: "queued", message: "انقطع الاتصال — حُفظت نتيجتك وستُحتسب عند عودة الشبكة", result: null, coinsGranted: 0 };
      }
    },
    [submit],
  );

  /** يُنفَّذ بعد كل جولة تحدٍّ — مصدر الحقيقة للمكافأة هو الخادم. */
  const submitRun = useCallback(
    async (run: { correct: number; total: number; score: number; durationMs: number }) => {
      if (!code) return { status: "failed" as const, message: "لا يوجد تحدٍّ فعّال", result: null, coinsGranted: 0 };
      if (!isAuthenticated) {
        const queued: PendingRun = { code, ...run, at: Date.now() };
        pushPending(queued);
        const res: ChallengeSubmitOutcome = {
          status: "unauthenticated",
          message: "نتيجتك محفوظة محلياً — سجّل الدخول لتُحتسب مكافأة التحدّي",
          result: null,
          coinsGranted: 0,
        };
        setOutcome(res);
        return res;
      }
      setBusy(true);
      const res = await send({ code, ...run, at: Date.now() });
      setBusy(false);
      setOutcome(res);
      return res;
    },
    [code, isAuthenticated, send],
  );

  // إعادة إرسال أي نتيجة معلّقة عند أول دخول موثّق
  useEffect(() => {
    if (!isAuthenticated) return;
    const queued = readPending();
    if (queued.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const row of queued) {
        if (cancelled) return;
        const res = await send(row);
        if (res.status === "queued") return; // ما زالت الشبكة معطوبة
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, send]);

  return {
    code,
    challenge,
    loading,
    busy,
    outcome,
    submitRun,
    /** نسبة تقدّم المكافأة المُعلنة مقابل أفضل نتيجة سجّلها اللاعب */
    myState: challenge?.mine ?? null,
  };
}
