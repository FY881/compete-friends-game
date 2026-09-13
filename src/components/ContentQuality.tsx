import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Library, Search, Zap, AlertTriangle, TrendingUp, Ban } from "lucide-react";

/**
 * 📚 لوحة جودة المحتوى — ترفع بنك الأسئلة من "قائمة" إلى "محرك":
 *  - درجة صحة لكل فئة محسوبة من دقة اللعب الحقيقية
 *  - تنبيهات فورية: أسئلة مكسورة (سهلة جداً/قاسية جداً) مع إصلاح بضغطة
 *  - بحث وفلترة سريعة
 */

const FLAG_STYLE: Record<string, { label: string; cls: string }> = {
  too_easy: { label: "سهل جداً", cls: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  too_hard: { label: "قاسٍ جداً", cls: "border-rose-500/40 bg-rose-500/10 text-rose-600" },
  unplayed: { label: "لم يُلعب", cls: "border-border bg-muted/40 text-muted-foreground" },
  none: { label: "سليم", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
};

export function ContentQuality() {
  const quality = useQuery(api.owner.getQuestionQuality, {});
  const toggle = useMutation(api.owner.toggleQuestion);
  const [query, setQuery] = useState("");
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!quality) return null;
    const byCategory = new Map<string, { asked: number; correct: number; count: number; flagged: number }>();
    let broken = 0, unplayed = 0, disabled = 0;
    for (const q of quality) {
      const c = byCategory.get(q.category) ?? { asked: 0, correct: 0, count: 0, flagged: 0 };
      c.asked += q.timesAsked;
      c.correct += q.timesCorrect;
      c.count += 1;
      if (q.flag === "too_easy" || q.flag === "too_hard") { c.flagged += 1; broken += 1; }
      if (q.flag === "unplayed") unplayed += 1;
      if (q.disabled) disabled += 1;
      byCategory.set(q.category, c);
    }
    const cats = [...byCategory.entries()]
      .map(([category, c]) => {
        const rate = c.asked > 0 ? Math.round((c.correct / c.asked) * 100) : null;
        const health =
          rate === null ? 60
          : rate >= 95 ? 45
          : rate <= 15 ? 40
          : Math.max(20, 100 - Math.abs(rate - 65) * 2);
        return { category, rate, health: Math.round(health), count: c.count, flagged: c.flagged };
      })
      .sort((a, b) => a.health - b.health);
    return { cats, broken, unplayed, disabled, total: quality.length };
  }, [quality]);

  const filtered = useMemo(() => {
    if (!quality) return [];
    const q = query.trim().toLowerCase();
    return quality
      .filter((r) => (q === "" || r.question.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)))
      .filter((r) => !onlyFlags || r.flag === "too_easy" || r.flag === "too_hard")
      .slice(0, 40);
  }, [quality, query, onlyFlags]);

  const disable = async (id: string, currentlyDisabled: boolean) => {
    setBusy(id);
    try {
      await toggle({ questionId: id });
      toast.success(currentlyDisabled ? "تم تفعيل السؤال." : "تم تعطيل السؤال — لن يظهر في الجولات.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعديل.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Library className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold">لوحة جودة المحتوى</h3>
            <p className="text-[11px] text-muted-foreground">
              صحة كل فئة من دقة اللعب الفعلية — أصلح الأسئلة المكسورة بضغطة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="rounded-full bg-rose-500/15 text-rose-600">
            <AlertTriangle className="size-3" /> {summary?.broken ?? 0} مكسور
          </Badge>
          <Badge variant="outline" className="rounded-full">{summary?.total ?? 0} سؤالاً</Badge>
        </div>
      </div>

      {/* صحة الفئات */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(summary?.cats ?? []).map((c) => (
          <div key={c.category} className="rounded-2xl border border-border/70 bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold">{c.category}</span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-[10px]",
                  c.health >= 70 ? "border-emerald-500/40 text-emerald-600"
                  : c.health >= 50 ? "border-amber-500/40 text-amber-600"
                  : "border-rose-500/40 text-rose-600",
                )}
              >
                صحة {c.health}
              </Badge>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all",
                  c.health >= 70 ? "bg-emerald-500" : c.health >= 50 ? "bg-amber-500" : "bg-rose-500")}
                style={{ width: `${c.health}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {c.rate === null ? "لا بيانات لعب بعد" : `دقة ${c.rate}%`} · {c.count} سؤالاً
              {c.flagged > 0 && ` · ${c.flagged} يحتاج مراجعة`}
            </p>
          </div>
        ))}
      </div>

      {/* الإصلاح السريع */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Zap className="size-4 text-amber-500" /> الإصلاح السريع
            <Button
              size="sm"
              variant={onlyFlags ? "default" : "outline"}
              className="ms-auto rounded-xl text-xs"
              onClick={() => setOnlyFlags((v) => !v)}
            >
              <TrendingUp className="size-3.5" /> المكسورة فقط
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الأسئلة…"
              className="h-10 rounded-xl ps-9"
            />
          </div>
          {quality === undefined ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ تحليل البنك…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا نتائج — البنك سليم ✨</p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto pe-1">
              {filtered.map((r) => {
                const f = FLAG_STYLE[r.flag];
                return (
                  <div key={r.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                    r.flag === "too_easy" && "border-amber-500/30 bg-amber-500/5",
                    r.flag === "too_hard" && "border-rose-500/30 bg-rose-500/5",
                    r.flag === "none" && "border-border/50 bg-muted/20",
                    r.flag === "unplayed" && "border-border/50")}>
                    <Badge variant="outline" className={cn("rounded-full text-[9px]", f.cls)}>{f.label}</Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{r.question}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.timesAsked > 0 ? `${r.successRate}% من ${r.timesAsked}` : "—"}
                    </span>
                    <Button
                      size="sm"
                      variant={r.disabled ? "outline" : "ghost"}
                      className="gap-1 rounded-lg text-[10px]"
                      onClick={() => disable(r.id, r.disabled)}
                      disabled={busy === r.id}
                    >
                      {busy === r.id ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />}
                      {r.disabled ? "تفعيل" : "تعطيل"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
