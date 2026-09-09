import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  CalendarClock,
} from "lucide-react";

const PRIORITY_TONE: Record<string, { label: string; cls: string }> = {
  low: { label: "عادي", cls: "bg-sky-500/10 text-sky-700" },
  medium: { label: "مهم", cls: "bg-amber-500/10 text-amber-700" },
  high: { label: "عاجل", cls: "bg-rose-500/10 text-rose-700" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

export function AnnouncementCenter() {
  const announcements = useQuery(api.announcements.list);
  const createAnn = useMutation(api.announcements.create);
  const setActive = useMutation(api.announcements.setActive);
  const remove = useMutation(api.announcements.remove);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() && !body.trim()) {
      toast.error("أدخل عنواناً أو نصاً للإعلان");
      return;
    }
    setBusy(true);
    try {
      const startMs = startsAt ? new Date(startsAt).getTime() : undefined;
      const endMs = expiresAt ? new Date(expiresAt).getTime() : undefined;
      if (startMs && endMs && endMs <= startMs) {
        toast.error("تاريخ النهاية يجب أن يكون بعد البداية");
        setBusy(false);
        return;
      }
      await createAnn({ title: title.trim(), body: body.trim(), priority, startsAt: startMs, expiresAt: endMs });
      toast.success(
        startMs && startMs > Date.now()
          ? "تم إنشاء الإعلان — سيظهر في موعده المحدد"
          : "تم إنشاء الإعلان — وهو ظاهر الآن للجميع",
      );
      setTitle("");
      setBody("");
      setStartsAt("");
      setExpiresAt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إنشاء الإعلان");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold">مركز الإعلانات</p>
            <p className="text-[11px] text-muted-foreground">
              أنشئ أي عدد من الإعلانات — الأحدث/الأعلى أولوية يظهر للجميع تلقائياً.
            </p>
          </div>
        </div>

        {/* Composer */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان الإعلان (اختياري)"
            className="h-9 rounded-lg text-xs"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="نص الإعلان — مثال: 🎉 جولة نهاية الأسبوع، ربح مضاعف!"
            rows={2}
            className="rounded-lg text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-40">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <CalendarClock className="size-3" /> يبدأ (اختياري)
              </span>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="h-8 rounded-lg text-[11px]"
              />
            </label>
            <label className="flex-1 min-w-40">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <CalendarClock className="size-3" /> ينتهي (اختياري)
              </span>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-8 rounded-lg text-[11px]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    priority === p ? PRIORITY_TONE[p].cls : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {PRIORITY_TONE[p].label}
                </button>
              ))}
            </div>
            <Button onClick={submit} disabled={busy} size="sm" className="gap-1.5 rounded-lg">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              إضافة
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {announcements == null ? (
            <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : announcements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
              لا توجد إعلانات — أضف أول إعلان لتظهر للجميع.
            </p>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                  a.visible ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/20",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.title && <p className="text-xs font-bold">{a.title}</p>}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", PRIORITY_TONE[a.priority].cls)}>
                      {PRIORITY_TONE[a.priority].label}
                    </span>
                    {a.visible ? (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">ظاهر</span>
                    ) : (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">مخفي</span>
                    )}
                  </div>
                  {a.body && <p className="mt-1 text-[11px] text-muted-foreground">{a.body}</p>}
                  <p className="mt-1.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                    <CalendarClock className="size-3" /> {timeAgo(a.createdAt)}
                    {a.startsAt && a.startsAt > Date.now() && (
                      <span className="text-sky-600">— يبدأ {new Date(a.startsAt).toLocaleString()}</span>
                    )}
                    {a.startsAt && a.startsAt <= Date.now() && (
                      <span>— بدأ {new Date(a.startsAt).toLocaleDateString()}</span>
                    )}
                    {a.expiresAt && (
                      <span className={cn(a.expiresAt < Date.now() && "text-rose-600")}>
                        — ينتهي {new Date(a.expiresAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setActive({ id: a.id as never, active: !a.active });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "خطأ");
                      }
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    title={a.active ? "إخفاء" : "إظهار"}
                  >
                    {a.active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await remove({ id: a.id as never });
                        toast.success("تم حذف الإعلان");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "خطأ");
                      }
                    }}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                    title="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}