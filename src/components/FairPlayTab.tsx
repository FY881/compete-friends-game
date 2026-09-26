import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Scale,
  ShieldAlert,
  Check,
  Clock,
  UserX,
  FileSearch,
  Loader2,
  Gavel,
} from "lucide-react";

/**
 * ⚖️ لوحة الحكم الآلي واللعب النظيف — سجل الأحداث المشبوهة في الموقع
 *    + 🕵️ محقّق العقول: تحقيق جنائي رقمي كامل بالذكاء الاصطناعي.
 */

const VERDICT_STYLE: Record<
  string,
  { label: string; emoji: string; cls: string }
> = {
  innocent: {
    label: "بريء — سلوك بشري طبيعي",
    emoji: "🕊️",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  suspicious: {
    label: "مشتبه به — يحتاج مراقبة",
    emoji: "👁️",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  },
  guilty: {
    label: "مذنب — أدلة قاطعة",
    emoji: "⛔",
    cls: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  },
  inconclusive: {
    label: "أدلة غير كافية",
    emoji: "🫥",
    cls: "border-border bg-muted/40 text-muted-foreground",
  },
};

export function FairPlayTab() {
  const events = useQuery(api.fairPlay.getFairPlayLog, { limit: 60 });
  const resolve = useMutation(api.fairPlay.resolveFairPlayEvent);
  const investigate = useAction(api.aiDetective.openInvestigation);
  const cases = useQuery(api.aiDetective.getCases, { limit: 8 });

  const [investigating, setInvestigating] = useState<string | null>(null);

  const KIND_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
    impossible_speed: { label: "إجابة مستحيلة السرعة", emoji: "⚡", color: "text-rose-600" },
    perfect_repeat: { label: "دقة كاملة متكررة", emoji: "🎯", color: "text-amber-600" },
    pattern_anomaly: { label: "شذوذ في الأنماط", emoji: "📈", color: "text-violet-600" },
  };

  const unresolved = (events ?? []).filter((e) => !e.resolved);

  /** فتح تحقيق جنائي كامل للاعب المرتبط بالحدث. */
  const startInvestigation = async (
    suspectId: string,
    suspectName: string,
    eventIds: Id<"fairPlayLog">[],
  ) => {
    if (investigating) return;
    setInvestigating(suspectName);
    try {
      const result = await investigate({
        suspectId: suspectId as Id<"users">,
        suspectName,
        eventIds,
      });
      const verdictLabel = VERDICT_STYLE[result.verdict]?.label ?? result.verdict;
      toast.success(
        `🔬 اكتمل التحقيق: ${verdictLabel} (ثقة ${result.confidence}%)${result.usedAi ? " — بتحليل ذكي" : " — حكم محلي فقط"}`,
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر فتح التحقيق.");
    } finally {
      setInvestigating(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-gradient-to-l from-rose-500/10 via-card to-rose-500/10 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15">
          <Scale className="size-5 text-rose-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">الحكم الآلي واللعب النظيف</p>
          <p className="text-[11px] text-muted-foreground">
            كشف تلقائي للغش: إجابات مستحيلة السرعة، دقة متكررة إحصائياً مستحيلة، وشذوذ الأنماط
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-black text-rose-600">{unresolved.length}</p>
          <p className="text-[10px] text-muted-foreground">حدث قيد المراجعة</p>
        </div>
      </div>

      <div className="space-y-2">
        {events === undefined ? (
          <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <ShieldAlert className="mx-auto size-8 text-emerald-600" />
            <p className="mt-3 text-sm font-bold">لا أحداث مشبوهة — اللعب نظيف ✨</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              يظهر هنا تلقائياً أي نمط غش محتمل يكتشفه الحكم الآلي
            </p>
          </div>
        ) : (
          events.map((e) => {
            const meta = KIND_LABEL[e.kind] ?? { label: e.kind, emoji: "❓", color: "" };
            const suspectEvents = unresolved
              .filter((u) => u.userId === e.userId)
              .map((u) => u._id);
            return (
              <div
                key={e._id}
                className={cn(
                  "rounded-xl border p-3",
                  e.resolved ? "border-border/40 bg-muted/10 opacity-60" : "border-rose-500/30 bg-rose-500/5",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-black", meta.color)}>{meta.label}</p>
                    <p className="mt-0.5 text-[11px] text-foreground">{e.detail}</p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <UserX className="size-3" /> {e.userName}
                      {e.gameCode && <span>· غرفة {e.gameCode}</span>}
                      <Clock className="size-3" />
                      {new Date(e.at).toLocaleString("ar", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "numeric",
                      })}
                    </p>
                  </div>
                  {!e.resolved && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={investigating !== null}
                        onClick={() => startInvestigation(e.userId, e.userName, suspectEvents)}
                        className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                        title="افتح ملف تحقيق جنائي كامل لهذا اللاعب بالذكاء الاصطناعي"
                      >
                        {investigating === e.userName ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <FileSearch className="size-3" />
                        )}
                        تحقيق AI
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await resolve({ eventId: e._id });
                            toast.success("حُسم الحدث — سلوك مقبول");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "فشل الحسم");
                          }
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                      >
                        <Check className="inline size-3" /> حسم
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🕵️ ملفات التحقيق السابقة */}
      {cases !== undefined && cases !== null && cases.length > 0 && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <Gavel className="size-3.5 text-violet-600" />
            ملفات تحقيقات محقّق العقول
          </p>
          {cases.map((c) => {
            const style = VERDICT_STYLE[c.verdict ?? "inconclusive"];
            return (
              <div key={c._id} className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black">🕵️ {c.suspectName}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                      style.cls,
                    )}
                  >
                    {style.emoji} {style.label}
                    {c.confidence !== null ? ` · ثقة ${c.confidence}%` : ""}
                  </span>
                  {c.status === "open" && (
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                      قيد التحليل…
                    </span>
                  )}
                  <span className="ms-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {new Date(c.createdAt).toLocaleString("ar", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "numeric",
                    })}
                    {c.model && c.model !== "local-fallback" && (
                      <span className="ms-1 text-violet-600">· تحليل ذكي</span>
                    )}
                  </span>
                </div>

                {c.summary && (
                  <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-foreground">
                    {c.summary}
                  </p>
                )}

                {c.evidenceBullets.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    {c.evidenceBullets.map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                )}

                {c.recommendedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.recommendedActions.map((a, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        3 أحداث غير محسومة خلال 24 ساعة تسجّل مخالفة غش تلقائياً على اللاعب — وتظهر في لوحة إدارة اللاعبين. التحقيق لا يعاقب آلياً أبداً: يُصدر حكماً وتوصيات والقرار النهائي بيد الإدارة.
      </p>
    </div>
  );
}
