import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Hourglass,
  Sparkles,
  Scroll,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 🔮 عرّاف العقول — نبوءات علنية تُحاسب آلياً.
 * كل نبوءة: ادعاء صريح + أرقام البناء + مهلة حكم + نتيجة تحقق أو تكذيب.
 * نسبة الدقة التراكمية معروضة للجميع — العرّاف لا يهرب من المساءلة.
 */

const KIND_LABEL: Record<string, string> = {
  weekly_champion: "نبوءة البطولة",
  upset: "نبوءة الانقلاب",
  dark_horse: "الحصان الأسود",
  colossus_fate: "نبوءة الطاغوت",
};

function timeLeft(ms: number): string {
  if (ms <= 0) return "الحكم بات قريباً…";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `الحكم بعد ${days} يوم و${hours} ساعة`;
  return `الحكم بعد ${hours} ساعة`;
}

export function OracleCard() {
  const data = useQuery(api.aiOracle.getProphecies, { limit: 5 });
  const prophesyNow = useAction(api.aiOracle.prophesyNow);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const summon = async () => {
    setBusy(true);
    try {
      const result = await prophesyNow({});
      if (result.created === 0) {
        toast.info("العرّاف يتأمل… لا ظروف كافية لنبوءة جديدة الآن.");
      } else {
        toast.success(`🔮 صدرت ${result.created} نبوءات جديدة — راجعها أدناه`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر استدعاء العرّاف.");
    } finally {
      setBusy(false);
    }
  };

  if (data === undefined) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> العرّاف يحدّق في النجوم…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl" className="overflow-hidden border-violet-500/25 bg-gradient-to-b from-violet-500/[0.05] to-transparent">
      <CardContent className="p-0">
        {/* الترويسة */}
        <div className="flex items-center gap-2.5 border-b border-violet-500/20 bg-violet-500/[0.07] px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15">
            <Eye className="size-4.5 text-violet-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">عرّاف العقول</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              نبوءات علنية تُحاسب آلياً — لا مخرجات ولا تفسيرات مرنة
            </p>
          </div>
          {data.accuracy !== null && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded-full font-mono text-[10px]",
                data.accuracy >= 60
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : data.accuracy >= 40
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-700",
              )}
            >
              دقة العرّاف {data.accuracy}% ({data.totalSettled})
            </Badge>
          )}
        </div>

        <div className="p-4">
          {/* النبوءات المفتوحة */}
          {data.open.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-5 text-center">
              <Scroll className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs font-bold">لا نبوءات مفتوحة حالياً</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                يصدر العرّاف نبوءاته دورياً من بيانات اللعب الحقيقية
              </p>
              <Button
                size="sm"
                onClick={summon}
                disabled={busy}
                className="mt-3 h-8 gap-1.5 rounded-xl bg-violet-600 text-xs text-white hover:bg-violet-700"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                استدعِ العرّاف الآن
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.open.map((p, i) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl border border-violet-500/30 bg-violet-500/[0.04] p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full border-violet-500/40 bg-violet-500/10 text-[9px] text-violet-700">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </Badge>
                    <Badge variant="outline" className="rounded-full font-mono text-[9px]">
                      ثقة {p.confidence}%
                    </Badge>
                    <span className="ms-auto flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Hourglass className="size-2.5" />
                      {timeLeft(p.windowEnd - Date.now())}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-foreground">
                    «{p.claim}»
                  </p>
                  <p className="mt-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    📎 أساس النبوءة: {p.dataBasis}
                  </p>
                </motion.div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={summon}
                disabled={busy}
                className="w-full h-8 gap-1.5 rounded-xl text-xs"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                نبوءات إضافية
              </Button>
            </div>
          )}

          {/* سجل الحكم */}
          {data.past.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="flex w-full items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
              >
                سجل الحكم ({data.past.length})
              </button>
              {showPast && (
                <div className="mt-2 space-y-1.5">
                  {data.past.map((p) => (
                    <div
                      key={p._id}
                      className={cn(
                        "rounded-lg border px-3 py-2",
                        p.status === "fulfilled"
                          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                          : "border-rose-500/30 bg-rose-500/[0.06]",
                      )}
                    >
                      <p className="flex items-center gap-1.5 text-[11px] font-bold">
                        {p.status === "fulfilled" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-rose-600" />
                        )}
                        {p.status === "fulfilled" ? "تحققت" : "كُذّبت"}
                        <span className="font-normal text-muted-foreground">
                          — {KIND_LABEL[p.kind] ?? p.kind}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                        «{p.claim}»
                      </p>
                      {p.verdictDetail && (
                        <p className="mt-1 text-[9px] italic text-muted-foreground">{p.verdictDetail}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
