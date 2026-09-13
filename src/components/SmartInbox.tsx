import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Inbox, Flame, ChevronDown, ChevronUp, Gavel, ShieldCheck, Ban, Timer } from "lucide-react";
import { useState } from "react";

/**
 * 📥 صندوق البلاغات الذكي — بلاغات مرتبة بأولوية حقيقية محسوبة من الخادم،
 * مع تجميع الأنماط وإجراءات تنفيذ موحدة.
 */

const PRIORITY_STYLE: Record<string, { label: string; cls: string }> = {
  urgent: { label: "عاجل", cls: "border-rose-500/50 bg-rose-500/10 text-rose-600" },
  high: { label: "مرتفع", cls: "border-amber-500/50 bg-amber-500/10 text-amber-600" },
  normal: { label: "عادي", cls: "border-sky-500/50 bg-sky-500/10 text-sky-600" },
  low: { label: "منخفض", cls: "border-border bg-muted/40 text-muted-foreground" },
};

export function SmartInbox() {
  const inbox = useQuery(api.commandDeck.getSmartInbox, {});
  const resolve = useMutation(api.owner.resolveReport);
  const applyPunishment = useMutation(api.owner.applyPunishment);
  const [busy, setBusy] = useState<string | null>(null);
  type InboxItem = NonNullable<ReturnType<typeof useQuery<typeof api.commandDeck.getSmartInbox>>>["items"][number];
  const [expanded, setExpanded] = useState<string | null>(null);

  const act = async (
    reportId: string,
    targetId: string,
    action: "warn" | "mute" | "ban" | "dismiss",
  ) => {
    setBusy(reportId);
    try {
      if (action === "dismiss") {
        await resolve({ reportId: reportId as never, status: "dismissed", note: "رُفض بعد المراجعة" });
        toast.success("تم رفض البلاغ.");
      } else {
        await applyPunishment({
          userId: targetId as never,
          type: action,
          reason: "من صندوق البلاغات الذكي",
        });
        await resolve({ reportId: reportId as never, status: "reviewed", note: `نُفِّذ: ${action}` });
        toast.success(action === "warn" ? "تم إرسال تحذير." : action === "mute" ? "تم كتم اللاعب." : "تم حظر اللاعب.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Inbox className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold">صندوق البلاغات الذكي</h3>
            <p className="text-[11px] text-muted-foreground">
              مرتبة بأولوية محسوبة: خطورة حكم AI + سمعة المُبلِّغ + تاريخ الهدف + القِدم
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="rounded-full bg-rose-500/15 text-rose-600">
            <Flame className="size-3" /> {inbox?.urgent ?? 0} عاجل
          </Badge>
          <Badge variant="outline" className="rounded-full">{inbox?.total ?? 0} مفتوح</Badge>
        </div>
      </div>

      {/* أنماط البلاغات */}
      {(inbox?.reasons.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {inbox!.reasons.map((r) => (
            <Badge key={r.reason} variant="outline" className="rounded-full text-[11px]">
              {r.reason}: {r.count}
            </Badge>
          ))}
        </div>
      )}

      {inbox === undefined || inbox === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : inbox.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          🎉 صندوق فارغ — لا بلاغات مفتوحة.
        </p>
      ) : (
        <div className="space-y-2">
          {inbox.items.map((r) => {
            const p = PRIORITY_STYLE[r.priority];
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id} className={cn("border shadow-sm", r.priority === "urgent" && "border-rose-500/30")}>
                <CardContent className="p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-full border text-[10px]", p.cls)}>{p.label}</Badge>
                    <span className="text-sm font-bold">{r.targetName}</span>
                    <Badge variant="outline" className="rounded-full text-[10px]">{r.reason}</Badge>
                    {r.targetPunishedBefore && (
                      <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                        عُوقب سابقاً
                      </Badge>
                    )}
                    {r.reporterReputation !== 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        سمعة المُبلِّغ: {r.reporterReputation > 0 ? "+" : ""}{r.reporterReputation}
                      </span>
                    )}
                    <span className="ms-auto text-[10px] text-muted-foreground">
                      درجة {r.score} · قبل {r.ageHours} س
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                      {r.details && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs">{r.details}</p>}
                      {r.aiVerdict && (
                        <div className={cn("rounded-lg border px-3 py-2 text-xs", r.aiVerdict.compliant ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                          <p className="font-bold">
                            حكم الذكاء: {r.aiVerdict.compliant ? `مخالفة (${r.aiVerdict.severity === "high" ? "عالية" : r.aiVerdict.severity === "medium" ? "متوسطة" : "منخفضة"})` : "لا مخالفة"}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">{r.aiVerdict.reasoning}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs" onClick={() => act(r.id, r.targetId, "warn")} disabled={busy === r.id}>
                          {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} تحذير
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs" onClick={() => act(r.id, r.targetId, "mute")} disabled={busy === r.id}>
                          <Timer className="size-3.5" /> كتم
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl text-xs" onClick={() => act(r.id, r.targetId, "ban")} disabled={busy === r.id}>
                          <Ban className="size-3.5" /> حظر
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 rounded-xl text-xs" onClick={() => act(r.id, r.targetId, "dismiss")} disabled={busy === r.id}>
                          <Gavel className="size-3.5" /> رفض البلاغ
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
