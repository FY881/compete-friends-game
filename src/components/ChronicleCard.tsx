import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Newspaper, Loader2, Archive, ChevronDown, Sparkles } from "lucide-react";

/**
 * 📰 سجل العقول — جريدة الموقع الأسبوعية المولّدة من بيانات اللعب الحقيقية.
 * تُعرض في صفحة اللعب: العنوان الرئيسي، الافتتاحية، وأقسام العدد، والأرشيف.
 */

export function ChronicleCard() {
  const issue = useQuery(api.aiChronicle.getLatestIssue, {});
  const archive = useQuery(api.aiChronicle.getArchive, { limit: 6 });
  const generateNow = useAction(api.aiChronicle.generateNow);
  const [busy, setBusy] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const result = await generateNow({});
      toast.success(
        `📰 صدر العدد بنجاح (${result.engine === "llm" ? "صياغة ذكية" : "صياغة محلية"}) — افتح الجريدة أدناه.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر توليد الإصدار.");
    } finally {
      setBusy(false);
    }
  };

  if (issue === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> الجريدة قيد الطباعة…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl" className="overflow-hidden border-amber-500/25 bg-gradient-to-b from-amber-500/[0.04] to-transparent">
      <CardContent className="p-0">
        {/* شريط العنوان */}
        <div className="flex items-center gap-2.5 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15">
            <Newspaper className="size-4.5 text-amber-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">سجل العقول</p>
            <p className="text-[10px] text-muted-foreground">
              جريدة الموقع الأسبوعية — من أرشيف اللعب الحقيقي
            </p>
          </div>
          {issue && (
            <Badge variant="outline" className="shrink-0 rounded-full font-mono text-[10px]">
              {issue.edition}
            </Badge>
          )}
        </div>

        {!issue ? (
          <div className="p-6 text-center">
            <p className="text-sm font-bold">لم يصدر عدد بعد</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              يصدر العدد تلقائياً كل أسبوع من بيانات الجولات الحقيقية —
              ويمكن للمالك إصدار عدد فوري الآن.
            </p>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={busy}
              className="mt-3 h-8 gap-1.5 rounded-xl bg-amber-600 text-xs text-white hover:bg-amber-700"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Newspaper className="size-3.5" />}
              إصدار العدد الآن
            </Button>
          </div>
        ) : (
          <div className="p-4">
            {/* العنوان الرئيسي */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-center text-lg font-black leading-snug text-foreground">
                {issue.headline}
              </h3>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                {new Date(issue.weekStart).toLocaleDateString("ar", { day: "numeric", month: "long" })}
                {" — "}
                {new Date(issue.weekEnd).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
                {issue.engine === "llm" && (
                  <span className="ms-1 inline-flex items-center gap-0.5 text-amber-600">
                    <Sparkles className="inline size-2.5" /> صياغة ذكية
                  </span>
                )}
              </p>
              <p className="mt-3 rounded-xl bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-foreground">
                {issue.intro}
              </p>
            </motion.div>

            {/* الأقسام */}
            <div className="mt-3 space-y-2.5">
              {issue.sections.map((s, i) => (
                <motion.div
                  key={`${s.key}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-border/60 bg-card p-3"
                >
                  <p className="flex items-center gap-1.5 text-xs font-black text-amber-700">
                    <span>{s.emoji}</span> {s.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.body}</p>
                </motion.div>
              ))}
            </div>

            {/* الأرشيف */}
            {archive && archive.length > 1 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowArchive((v) => !v)}
                  className="flex w-full items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <Archive className="size-3" />
                  الأرشيف ({archive.length} أعداد)
                  <ChevronDown className={`size-3 transition-transform ${showArchive ? "rotate-180" : ""}`} />
                </button>
                {showArchive && (
                  <div className="mt-2 space-y-1.5">
                    {archive.slice(1).map((a) => (
                      <div
                        key={a.edition}
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5"
                      >
                        <span className="font-mono text-[10px] font-bold text-amber-700">{a.edition}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{a.headline}</span>
                        <span className="ms-auto shrink-0 text-[9px] text-muted-foreground">
                          {new Date(a.publishedAt).toLocaleDateString("ar", { day: "numeric", month: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
