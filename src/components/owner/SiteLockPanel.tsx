import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Lock, LockOpen, Loader2, ShieldAlert } from "lucide-react";

/**
 * موجّة 2.2 — وضع الحماية الشاملة: قفل اللعبة بالكامل بضغطة واحدة.
 * يظهر بانر تحذيري في لوحة القيادة مع مفتاح تشغيل/إيقاف ورسالة مخصّصة.
 */
export function SiteLockPanel({ locked }: { locked: boolean }) {
  const updateSettings = useMutation(api.owner.updateSettings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await updateSettings({
        siteLocked: !locked,
        ...(message.trim() ? { siteLockMessage: message.trim() } : {}),
      });
      toast.success(!locked ? "تم قفل اللعبة — اللاعبون سيرون رسالة الحماية." : "تم فتح اللعبة مجدداً.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التغيير");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-3",
        locked ? "border-rose-500/40 bg-rose-500/10" : "border-border/50 bg-muted/20",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          locked ? "bg-rose-500/15 text-rose-600" : "bg-emerald-500/10 text-emerald-600",
        )}
      >
        {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-bold", locked && "text-rose-700")}>
          {locked ? "اللعبة مقفلة — وضع الحماية مُفعّل" : "وضع الحماية: اللعبة مفتوحة"}
        </p>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="رسالة مخصّصة للاعبين أثناء القفل…"
          className="mt-1 w-full rounded-lg border border-border/50 bg-background px-2 py-1 text-[11px] outline-none focus:border-primary/40"
        />
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
          locked
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "bg-rose-500 text-white hover:bg-rose-600",
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldAlert className="size-3.5" />}
        {locked ? "فتح اللعبة" : "قفل اللعبة"}
      </button>
    </div>
  );
}