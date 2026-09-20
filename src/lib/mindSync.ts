import { useCallback, useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  FACULTY_KEYS,
  clampSnapshot,
  mergeGrants,
  rankForTier,
  rankProgress,
  shouldSyncMind,
  snapshotSignature,
  type FacultyKey,
  type MindGrant,
} from "@/convex/mindCore";
import {
  domainMastery,
  grantFacultyXp,
  masteryTierIndex,
  mindIdentity,
  readMind,
  resetEvolvedMind,
  unlockedSpecializations,
  useEvolvedMind,
  type MindState,
} from "@/lib/evolvedMind";
import { readSave } from "@/lib/localEngine";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧬 جسر العقول — من متصفحك إلى عالم اللعبة (وعكسياً)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * هذا الملف هو ما يجعل «العقل المتطور» حقيقياً على مستوى اللعبة:
 *
 *   ١) رفع (Push): بعد كل جولة تُرفع لقطة عقلك إلى الخادم — فيظهر ترتيبك
 *      بين الأصدقاء، ويصير للمالك صورة حيّة عن المجتمع.
 *   ٢) سحب (Pull): قرارات العرش (منحة خبرة · قرار تصفير) تُطبَّق فعلاً على
 *      عقلك في هذا الجهاز — مرة واحدة بالضبط، ببصمة تمنع التكرار.
 *
 * ثلاث قواعد ملزمة:
 *   • أوفلاين-أولاً: بلا تسجيل دخول أو بلا شبكة ⇒ اللعبة تعمل كما هي.
 *   • صفر كتابة زائدة: بصمة العقل تمنع إرسال ما لم يتغيّر فعلاً.
 *   • لا ثقة بأرقام العميل: الخادم يعيد الحساب بنفسه (mindCore).
 * ═══════════════════════════════════════════════════════════════════════
 */

const SIGNATURE_KEY = "mindclash.mindsync.signature";
const APPLIED_KEY = "mindclash.mindsync.applied";
const APPLIED_LIMIT = 60;

/** نتيجة الرفع — للعرض في الواجهة بصدق (لا «تم» وهمية). */
export interface PushResult {
  status: "unauthenticated" | "skipped" | "synced" | "unchanged" | "frozen" | "failed";
  tierScore: number;
  grantsApplied: number;
  resetApplied: boolean;
  message: string;
}

type SyncFn = (args: {
  name: string;
  avatar?: string;
  faculties: Record<FacultyKey, number>;
  equipped: string[];
  unlocked: string[];
  mastery: { category: string; score: number; tier: number }[];
  identityTitle: string;
  identityIcon: string;
  sessions: number;
}) => Promise<{
  ok: boolean;
  reason: "synced" | "unchanged" | "frozen" | "unauthenticated";
  tierScore: number;
  grants: MindGrant[];
}>;

function readStore(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* التخزين ممتلئ — لا نُسقط المزامنة */
  }
}

function readApplied(): string[] {
  const raw = readStore(APPLIED_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** أرصدة القوى المنحوتة في العقل المحلي (نموذج موحّد). */
export function localFaculties(mind?: MindState): Record<FacultyKey, number> {
  const s = mind ?? readMind();
  const out = {} as Record<FacultyKey, number>;
  for (const k of FACULTY_KEYS) out[k] = s.faculty[k] ?? 0;
  return out;
}

/** أفضل ٨ مجالات إتقاناً — ما يُخزَّن ويُقارَن (بحجم مقيّد). */
export function topMastery(
  categories: Record<string, { answered: number; correct: number }> | undefined,
): { category: string; score: number; tier: number }[] {
  if (!categories) return [];
  return Object.entries(categories)
    .map(([category, c]) => {
      const score = domainMastery(c);
      return { category, score, tier: masteryTierIndex(score) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/** يبني حمولة المزامنة من الحالة المحلية الحقيقية (مقيّدة على العميل أيضاً). */
export function buildMindPayload(
  mind: MindState,
  name: string,
  avatar: string | null,
  categories: Record<string, { answered: number; correct: number }> | undefined,
) {
  const identity = mindIdentity(mind);
  const snapshot = clampSnapshot({
    name,
    avatar,
    faculties: localFaculties(mind),
    equipped: mind.equipped,
    unlocked: unlockedSpecializations(mind).map((d) => d.id),
    mastery: topMastery(categories),
    identityTitle: identity.title,
    identityIcon: identity.icon,
    sessions: mind.totalSessions,
  });
  return { snapshot, signature: snapshotSignature(snapshot) };
}

/** بصمة العقل المحلي — تُستخدم لتقرير هل يستحق الرفع. */
export function localMindSignature(mind: MindState): string {
  return snapshotSignature(
    clampSnapshot({ faculties: localFaculties(mind), sessions: mind.totalSessions }),
  );
}

/**
 * يدفع لقطة العقل إلى الخادم، ويطبّق قرارات العرش العائدة.
 * @returns نتيجة صريحة — لا وعود كاذبة.
 */
export async function pushMindSnapshot(
  syncFn: SyncFn,
  mind: MindState,
  name: string,
  avatar: string | null,
  categories: Record<string, { answered: number; correct: number }> | undefined,
  force = false,
): Promise<PushResult> {
  const { snapshot, signature } = buildMindPayload(mind, name, avatar, categories);
  const last = readStore(SIGNATURE_KEY);

  if (!force && !shouldSyncMind(last, signature)) {
    return {
      status: "skipped",
      tierScore: snapshot.tierScore,
      grantsApplied: 0,
      resetApplied: false,
      message: "لم يتغيّر عقلك — لم نُرسل شيئاً",
    };
  }

  let res: Awaited<ReturnType<SyncFn>>;
  try {
    res = await syncFn({ ...snapshot, avatar: snapshot.avatar ?? undefined });
  } catch {
    return {
      status: "failed",
      tierScore: snapshot.tierScore,
      grantsApplied: 0,
      resetApplied: false,
      message: "تعذّر الوصول للخادم — تقدّمك محفوظ محلياً ولن يضيع",
    };
  }

  if (res.reason === "unauthenticated") {
    return {
      status: "unauthenticated",
      tierScore: res.tierScore,
      grantsApplied: 0,
      resetApplied: false,
      message: "تقدّمك محلي — سجّل الدخول ليدخل عقلك لوحة الصدارة",
    };
  }

  if (res.reason === "frozen") {
    return {
      status: "frozen",
      tierScore: res.tierScore,
      grantsApplied: 0,
      resetApplied: false,
      message: "عقلك مُجمَّد بقرار من الإدارة — التقدّم متوقف حتى يُرفع التجميد",
    };
  }

  writeStore(SIGNATURE_KEY, signature);

  // سحب قرارات العرش وتطبيقها على العقل الحقيقي في هذا الجهاز
  const merged = mergeGrants(localFaculties(mind), res.grants as MindGrant[], readApplied());
  if (merged.applications.length > 0) {
    if (merged.resetRequested) resetEvolvedMind();
    for (const app of merged.applications) {
      if (app.kind !== "xp" || app.amount === 0) continue;
      if (app.faculty === "all") {
        for (const k of FACULTY_KEYS) grantFacultyXp(k, app.amount);
      } else {
        grantFacultyXp(app.faculty, app.amount);
      }
    }
    writeStore(APPLIED_KEY, JSON.stringify(merged.applied.slice(-APPLIED_LIMIT)));
  }

  return {
    status: res.reason === "synced" ? "synced" : "unchanged",
    tierScore: res.tierScore,
    grantsApplied: merged.applications.filter((a) => a.kind === "xp").length,
    resetApplied: merged.resetRequested,
    message:
      merged.resetRequested
        ? "نُفِّذ قرار العرش بتصفير العقل"
        : merged.applications.length > 0
          ? `استُلمت ${merged.applications.length} منحة من العرش وطُبِّقت على عقلك`
          : "عقلك مُزامَن مع عالم اللعبة",
  };
}

/**
 * الخطاف الكامل: يزامن تلقائياً عند الدخول وعند تغيّر العقل،
 * ويعيد حالة الخادم الحيّة (ترتيبك + لوحة الصدارة).
 */
export function useMindSync(mode: string) {
  const { isAuthenticated } = useConvexAuth();
  const syncFn = useMutation(api.minds.syncMyMind);
  const cloud = useQuery(api.minds.getMyMind);
  const leaderboard = useQuery(api.minds.getMindLeaderboard, { limit: 12 });
  const mind = useEvolvedMind();
  const firstSync = useRef(true);

  const push = useCallback(
    async (force = false): Promise<PushResult> => {
      if (!isAuthenticated) {
        return {
          status: "unauthenticated",
          tierScore: 0,
          grantsApplied: 0,
          resetApplied: false,
          message: "سجّل الدخول ليدخل عقلك لوحة الصدارة",
        };
      }
      const save = readSave();
      return pushMindSnapshot(
        syncFn as unknown as SyncFn,
        mind,
        save.profile.name || "لاعب",
        save.profile.avatar || null,
        save.stats.categories,
        force,
      );
    },
    [isAuthenticated, syncFn, mind],
  );

  const signature = localMindSignature(mind);

  // رفعة واحدة عند الدخول (لتجلب قرارات العرش)، ثم كلما تغيّر العقل فعلاً
  useEffect(() => {
    if (!isAuthenticated) return;
    const force = firstSync.current;
    firstSync.current = false;
    void push(force);
  }, [isAuthenticated, signature, mode, push]);

  return {
    cloud,
    leaderboard,
    push,
    /** رتبة اللاعب في السحابة (null قبل أول مزامنة) */
    rank: cloud?.profile ? rankForTier(cloud.profile.tierScore) : null,
    rankProgress: cloud?.profile ? rankProgress(cloud.profile.tierScore) : 0,
  };
}
