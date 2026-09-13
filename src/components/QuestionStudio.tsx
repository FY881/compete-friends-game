import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import {
  Wrench,
  Plus,
  CalendarClock,
  AlertTriangle,
  Check,
  Pencil,
  Loader2,
} from "lucide-react";

/**
 * 🛠️ استوديو الأسئلة — أداة المالك المتقدمة:
 *  - إضافة سؤال يدوي مع كشف تكرار فوري قبل الحفظ
 *  - جدولة النشر المستقبلي (يُعتمد آلياً في موعده)
 *  - تحرير أي سؤال AI معلق أو معتمد
 */

const CATEGORIES = ["عام", "علوم", "جغرافيا", "تاريخ", "رياضة", "ثقافة", "أدب", "تقنية", "ألغاز", "ذكاء"];
const DIFFS = ["easy", "medium", "hard"] as const;
const DIFF_AR: Record<string, string> = { easy: "سهل", medium: "متوسط", hard: "صعب" };

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

export function QuestionStudio() {
  const queue = useQuery(api.aiQuestions.getAiQuestionQueue, {});
  const stats = useQuery(api.aiQuestions.getQueueStats, {});

  const [qText, setQText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState<(typeof DIFFS)[number]>("medium");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const createQ = useMutation(api.aiQuestions.createManualQuestion);
  const scheduleQ = useMutation(api.aiQuestions.scheduleQuestion);
  const editQ = useMutation(api.aiQuestions.editQuestion);

  const save = async () => {
    if (opts.some((o) => o.trim() === "")) {
      toast.error("املأ الخيارات الأربعة.");
      return;
    }
    setBusy("create");
    try {
      const scheduledFor = scheduleAt ? new Date(scheduleAt).getTime() : undefined;
      await createQ({
        category,
        difficulty,
        question: qText,
        options: opts,
        correctIndex: correct,
        scheduledFor: scheduledFor && !Number.isNaN(scheduledFor) ? scheduledFor : undefined,
      });
      toast.success(scheduledFor ? "حُفظ السؤال وسيُنشر آلياً في موعده." : "أُضيف السؤال إلى طابور الاعتماد.");
      setQText("");
      setOpts(["", "", "", ""]);
      setScheduleAt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحفظ.");
    } finally {
      setBusy(null);
    }
  };

  const doSchedule = async (id: string, minutes: number) => {
    setBusy(`sched-${id}`);
    try {
      await scheduleQ({ id: id as never, scheduledFor: Date.now() + minutes * 60_000 });
      toast.success(`سُيُنشر السؤال بعد ${minutes} دقيقة آلياً.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت الجدولة.");
    } finally {
      setBusy(null);
    }
  };

  const doEdit = async (id: string) => {
    setBusy(`edit-${id}`);
    try {
      await editQ({ id: id as never, question: editText });
      toast.success("عُدّل نص السؤال.");
      setEditing(null);
      setEditText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعديل.");
    } finally {
      setBusy(null);
    }
  };

  const pending = queue?.pending ?? [];

  return (
    <div dir="rtl" className="space-y-5">
      {/* ═══ إنشاء سؤال جديد ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wrench className="size-4 text-primary" /> استوديو الأسئلة — إضافة يدوية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {DIFFS.map((d) => (
                <Button key={d} size="sm" variant={difficulty === d ? "default" : "outline"} className="h-9 rounded-lg text-[11px]" onClick={() => setDifficulty(d)}>
                  {DIFF_AR[d]}
                </Button>
              ))}
            </div>
          </div>
          <Textarea value={qText} onChange={(e) => setQText(e.target.value)} placeholder="نص السؤال…" className="min-h-[64px] rounded-lg text-sm" dir="rtl" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {opts.map((o, i) => (
              <div key={i} className={cn("flex items-center gap-2 rounded-lg border px-2", correct === i ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/60")}>
                <button type="button" onClick={() => setCorrect(i)} className={cn("size-4 shrink-0 rounded-full border", correct === i ? "border-emerald-500 bg-emerald-500" : "border-border")} aria-label={`الإجابة الصحيحة ${i + 1}`} />
                <Input value={o} onChange={(e) => setOpts((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`الخيار ${i + 1}`} className="h-9 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0" dir="rtl" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="size-3.5" /> نشر مجدول (اختياري):
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-8 w-52 rounded-lg text-[11px]" />
            </label>
            <Button size="sm" className="ms-auto gap-1.5 rounded-lg" onClick={save} disabled={busy !== null}>
              {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              حفظ السؤال
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            كشف التكرار إلزامي على الخادم: أي سؤال بصياغة مشابهة لسؤال موجود يُرفض تلقائياً. الأسئلة المجدولة تُعتمد آلياً في موعدها.
          </p>
        </CardContent>
      </Card>

      {/* ═══ طابور المراجعة مع أدوات الجدولة ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            طابور الأسئلة المولدة
            {queue && <Badge variant="outline" className="ms-auto rounded-full text-[10px]">{queue.pending.length} بانتظار المراجعة</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queue === undefined ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : pending.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا أسئلة معلقة — استخدم التوليد الآلي من تبويب المدير الآلي.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pe-1">
              {pending.map((q) => (
                <div key={q.id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                  {editing === q.id ? (
                    <div className="flex gap-2">
                      <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-8 rounded-lg text-xs" dir="rtl" />
                      <Button size="sm" className="h-8 rounded-lg px-2" onClick={() => doEdit(q.id)} disabled={busy !== null}>
                        <Check className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold leading-relaxed">{q.question}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <Badge variant="outline" className="rounded-full">{q.category}</Badge>
                        <Badge variant="outline" className="rounded-full">{DIFF_AR[q.difficulty] ?? q.difficulty}</Badge>
                        <span className="text-muted-foreground">✓ {q.options[q.correctIndex]}</span>
                        <div className="ms-auto flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 rounded-md px-1.5 text-[9px]" onClick={() => { setEditing(q.id); setEditText(q.question); }} disabled={busy !== null}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 rounded-md px-1.5 text-[9px]" onClick={() => doSchedule(q.id, 60)} disabled={busy !== null} title="انشر بعد ساعة">
                            <CalendarClock className="size-3" /> ساعة
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 rounded-md px-1.5 text-[9px]" onClick={() => doSchedule(q.id, 1440)} disabled={busy !== null} title="انشر بعد يوم">
                            <CalendarClock className="size-3" /> يوم
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ لوحة فئات ضعيفة ═══ */}
      {stats && stats.weak && stats.weak.length > 0 && (
        <Card className="border-amber-500/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="size-4" /> فئات تحتاج أسئلة
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.weak.map(([c, n]) => (
              <Badge key={c} variant="outline" className="rounded-full border-amber-500/40 text-[11px] text-amber-600">
                {c}: {n} فقط
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
