/**
 * ⚔️ لوحة سيادة التحدّيات (v11.0) — غرفة المالك
 *
 * كل تحدٍّ منشور من غرفة خاصة أو من ملتقى العقول يظهر هنا بحالته الحقيقية:
 * كم لعبه، كم نال مكافأته، وكم خبرة دُفعت فعلاً. وللمالك إغلاق أو إعادة فتح
 * أي تحدٍّ بقرار مُسجَّل في سجل التدقيق ويُبلَّغ صاحبه.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Ban, Loader2, RotateCcw, Swords, Trophy, Users, Zap } from "lucide-react";

export function ChallengesNexusPanel() {
  const pulse = useQuery(api.challenges.challengePulse, {});
  const [filter, setFilter] = useState("all");
  const list = useQuery(api.challenges.ownerListChallenges, { filter });
  const setStatus = useMutation(api.challenges.ownerSetChallengeStatus);
  const [busy, setBusy] = useState<string | null>(null);

  if (pulse === undefined || list === undefined) {
    return <div className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>;
  }
  if (pulse === null) {
    return <div className="p-6 text-center text-sm text-muted-foreground">هذه اللوحة للمالك فقط.</div>;
  }

  const act = async (id: string, status: "open" | "closed", title: string) => {
    const reason = status === "closed" ? window.prompt(`سبب إغلاق «${title}» (اختياري):`) ?? "" : "";
    setBusy(id);
    try {
      await setStatus({ challengeId: id as never, status, reason });
      toast.success(status === "closed" ? "أُغلق التحدّي وأُبلغ صاحبه" : "أُعيد فتح التحدّي بمهلة جديدة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "تحدّيات منشورة", value: pulse.total, icon: <Swords className="size-4" /> },
          { label: "فعّالة الآن", value: pulse.open, icon: <Zap className="size-4" />, tone: "text-emerald-600" },
          { label: "محاولات لعب", value: pulse.plays, icon: <Users className="size-4" /> },
          { label: "نالوا مكافأتهم", value: pulse.rewarded, icon: <Trophy className="size-4" />, tone: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label} className="border-border/70">
            <CardContent className="flex items-center gap-2 p-3">
              <span className={cn("flex size-8 items-center justify-center rounded-xl bg-muted", s.tone)}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-black tabular-nums">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-[11px]">
          <span className="font-bold">الخبرة المدفوعة فعلاً: <span className="tabular-nums text-primary">{pulse.xpGranted} XP</span></span>
          <span className="text-muted-foreground">إتمامات ناجحة: <span className="tabular-nums">{pulse.completions}</span></span>
          <span className="text-muted-foreground">من غرف: <span className="tabular-nums">{pulse.bySource.room ?? 0}</span></span>
          <span className="text-muted-foreground">من الملتقى: <span className="tabular-nums">{pulse.bySource.forum ?? 0}</span></span>
          <span className="text-muted-foreground">منتهية: <span className="tabular-nums">{pulse.expired}</span> · مغلقة: <span className="tabular-nums">{pulse.closed}</span></span>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "all", label: "الكل" },
          { id: "open", label: "فعّالة" },
          { id: "room", label: "غرف" },
          { id: "forum", label: "ملتقى" },
          { id: "expired", label: "منتهية" },
          { id: "closed", label: "مغلقة" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              filter === f.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Swords className="size-4 text-primary" /> سجل التحدّيات
            <span className="ms-auto text-[10px] font-normal text-muted-foreground">{list.length} صفّ</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">لا تحدّيات بهذا التصنيف.</p>}
          {list.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
              <Badge variant="outline" className="rounded-full font-mono text-[9px]">{c.code}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{c.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  <span>{c.source === "room" ? "🏛️ غرفة" : "🧠 ملتقى"}</span>
                  <span>· {c.questionCount} أسئلة · {c.difficulty}</span>
                  <span>· مكافأة {c.rewardXp} خبرة{c.rewardCoins > 0 ? ` + ${c.rewardCoins} عملة` : ""}</span>
                  <span>· {c.plays} محاولة · {c.rewarded} مكافأة</span>
                  <span>· دُفع {c.xpGranted} XP</span>
                  <span>· {c.remaining}</span>
                  <span>· {c.createdByName}</span>
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-[9px]",
                  c.status === "open" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border/70 text-muted-foreground",
                )}
              >
                {c.status === "open" ? "فعّال" : c.status === "expired" ? "منتهٍ" : "مغلق"}
              </Badge>
              {c.status === "open" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === c.id}
                  className="h-7 rounded-lg border-rose-500/40 px-2 text-[10px] text-rose-600 hover:bg-rose-500/10"
                  onClick={() => void act(c.id, "closed", c.title)}
                >
                  {busy === c.id ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />} إغلاق
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === c.id}
                  className="h-7 rounded-lg px-2 text-[10px]"
                  onClick={() => void act(c.id, "open", c.title)}
                >
                  {busy === c.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />} إعادة فتح
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        المكافآت تُحسب على الخادم من نتيجتك الحقيقية: المكافأة المُعلنة × مضاعف الصعوبة × دقتك، ولا تُدفع لمن دون
        عتبة النجاح، ولا تُدفع مرتين لنفس اللاعب. وكل إغلاق/إعادة فتح يُسجَّل في سجل التدقيق.
      </p>
    </div>
  );
}
