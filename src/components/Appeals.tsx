import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Scale, Send, CheckCircle2, XCircle, ShieldQuestion, ShieldCheck } from "lucide-react";

/**
 * 🛡️ لوحة الاعتراضات — للمالك في غرفة المالك:
 * اعتراضات اللاعبين المعلّقة مع قرار: تأكيد العقوبة أو رفعها عنهم.
 */

const TYPE_LABEL: Record<string, string> = { warn: "تحذير", mute: "كتم", ban: "حظر" };

export function AppealsPanel() {
  const appeals = useQuery(api.appeals.getPendingAppeals, {});
  const decide = useMutation(api.appeals.decideAppeal);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (appealId: string, decision: "upheld" | "overturned") => {
    setBusy(appealId);
    try {
      await decide({
        appealId: appealId as never,
        decision,
        note: decision === "overturned" ? "رُفعت العقوبة بعد مراجعة الاعتراض" : "العقوبة مؤكدة بعد المراجعة",
      });
      toast.success(decision === "overturned" ? "تم رفع العقوبة عن اللاعب." : "تم تأكيد العقوبة.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل القرار.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldQuestion className="size-5" />
        </span>
        <div>
          <h3 className="text-base font-bold">الاعتراضات المعلّقة</h3>
          <p className="text-[11px] text-muted-foreground">
            اعتراضات اللاعبين المعاقبين — القرار العادل يبني ثقة المجتمع
          </p>
        </div>
        <Badge variant="outline" className="ms-auto rounded-full">{appeals?.length ?? 0} معلّق</Badge>
      </div>

      {appeals === undefined || appeals === null ? (
        <p className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : appeals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا اعتراضات معلّقة — كل شيء حُسم بعدالة ✨
        </p>
      ) : (
        <div className="space-y-2">
          {appeals.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{a.userName}</span>
                <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                  يعترض على: {TYPE_LABEL[a.punishmentType] ?? a.punishmentType}
                </Badge>
                <span className="ms-auto text-[10px] text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">سبب العقوبة الأصلي: {a.punishmentReason}</p>
              <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed">{a.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl text-xs text-emerald-600"
                  onClick={() => act(a.id, "overturned")}
                  disabled={busy === a.id}
                >
                  {busy === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  قبول — رفع العقوبة
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 rounded-xl text-xs text-rose-600"
                  onClick={() => act(a.id, "upheld")}
                  disabled={busy === a.id}
                >
                  <XCircle className="size-3.5" /> رفض — تأكيد العقوبة
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** مركز العدالة الكامل — يُخفى ذاتياً إن لم يكن لدى اللاعب أي عقوبة أو سجل اعتراض */
export function JusticeSection() {
  const status = useQuery(api.appeals.getMyAppealStatus, {});
  if (status === undefined) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-center text-sm text-muted-foreground">
        جارٍ فحص سجلّك العدلي…
      </div>
    );
  }
  if (status === null || (!status.canPunished && status.history.length === 0)) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-center">
        <ShieldCheck className="mx-auto size-6 text-emerald-500" />
        <p className="mt-2 text-sm font-bold">سجلّك نظيف — لا عقوبات قائمة ولا اعتراضات</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          إن عُوقبت يوماً وترى العقوبة ظالمة، سيظهر نموذج الاعتراض هنا تلقائياً.
        </p>
      </div>
    );
  }
  return <AppealForm />;
}

/** نموذج اللاعب — يظهر في صفحة اللعب لمن عوقب */
export function AppealForm() {
  const status = useQuery(api.appeals.getMyAppealStatus, {});
  const submit = useMutation(api.appeals.submitAppeal);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === undefined || status === null || (!status.canPunished && status.history.length === 0)) return null;

  const send = async () => {
    setBusy(true);
    try {
      await submit({
        punishmentType: (status!.punishmentType ?? "warn") as "warn" | "mute" | "ban",
        message,
      });
      toast.success("وصل اعتراضك للمالك — سيُراجع بعدالة.");
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإرسال.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <Scale className="size-4 text-amber-600" />
        <h4 className="text-sm font-bold">لديك حق الاعتراض</h4>
      </div>
      {status!.canPunished && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          عقوبتك الحالية: {TYPE_LABEL[status!.punishmentType ?? "warn"]}
          {status!.punishmentReason ? ` — ${status!.punishmentReason}` : ""}
        </p>
      )}

      {status!.pending ? (
        <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">⏳ اعتراضك قيد المراجعة — انتظر قرار المالك.</p>
      ) : !status!.canSubmit ? (
        <p className="mt-2 text-[11px] text-muted-foreground">يمكنك الاعتراض مرة أخرى بعد {status!.cooldownHours} ساعة.</p>
      ) : (
        <>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب اعتراضك بوضوح — لماذا تعتقد أن العقوبة غير عادلة؟"
            rows={3}
            className="mt-2 rounded-xl bg-background"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className={cn("text-[10px]", message.length > 600 ? "text-rose-600" : "text-muted-foreground")}>
              {message.length}/600
            </span>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={send} disabled={busy || message.trim().length < 10}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} إرسال الاعتراض
            </Button>
          </div>
        </>
      )}

      {status!.history.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-2">
          {status!.history.map((h) => (
            <div key={h.id} className="flex items-center gap-2 text-[11px]">
              {h.status === "overturned" ? (
                <Badge className="rounded-full bg-emerald-500/15 px-1.5 text-[9px] text-emerald-600">قُبل ✅</Badge>
              ) : h.status === "upheld" ? (
                <Badge className="rounded-full bg-rose-500/15 px-1.5 text-[9px] text-rose-600">رُفض ❌</Badge>
              ) : (
                <Badge variant="outline" className="rounded-full px-1.5 text-[9px]">قيد المراجعة</Badge>
              )}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{h.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
