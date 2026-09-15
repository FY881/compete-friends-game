import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Radio, MessageSquareHeart, FlaskConical, Gauge, Radar } from "lucide-react";

/**
 * 👑 غرفة المالك v5.0 «العرش» — لوحة المرحلة أ
 * مركز القيادة 360° + المستشار AI + محاكي القرارات + بطاقة الصحة + رادار المخاطر
 */

const sevColor: Record<string, string> = {
  ok: "text-emerald-600 border-emerald-500/30 bg-emerald-500/10",
  warn: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  critical: "text-rose-600 border-rose-500/30 bg-rose-500/10",
};

export function CrownDeckPanel() {
  const pulse = useQuery(api.crownDeck.getPulse360);
  const healthCard = useQuery(api.crownDeck.getDailyHealthCard);
  const radar = useQuery(api.crownDeck.getRiskRadar);

  const [question, setQuestion] = useState("");
  const askAdvisor = useAction(api.crownDeck.askAdvisor);
  const [advice, setAdvice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const [decision, setDecision] = useState("");
  const [domain, setDomain] = useState("economy");
  const simulate = useAction(api.crownDeck.simulateDecision);
  const [simulation, setSimulation] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAdvice(null);
    try {
      const res = await askAdvisor({ question: question.trim() });
      if (res?.answer) setAdvice(res.answer);
      else toast.error(res?.reason || "تعذّر الحصول على إجابة");
    } catch {
      toast.error("فشل الاتصال بالمستشار");
    } finally {
      setAsking(false);
    }
  };

  const handleSimulate = async () => {
    if (!decision.trim()) return;
    setSimulating(true);
    setSimulation(null);
    try {
      const res = await simulate({ decision: decision.trim(), domain } as any);
      if (res?.simulation) setSimulation(res.simulation);
      else toast.error(res?.reason || "تعذّرت المحاكاة");
    } catch {
      toast.error("فشل تشغيل المحاكاة");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* ═══ مركز القيادة الحي 360° ═══ */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Radio className="size-4 text-primary" />
            مركز القيادة الحي 360°
            {pulse && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-[10px]",
                  pulse.overall === "critical"
                    ? "border-rose-500/40 text-rose-600"
                    : pulse.overall === "warn"
                      ? "border-amber-500/40 text-amber-600"
                      : "border-emerald-500/40 text-emerald-600",
                )}
              >
                {pulse.overall === "critical" ? "حالة حرجة" : pulse.overall === "warn" ? "تنبيهات" : "كل شيء سليم"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pulse === undefined ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : pulse === null ? (
            <p className="py-4 text-center text-xs text-muted-foreground">غير مصرح</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pulse.systems.map((s: any) => (
                  <div key={s.id} className={cn("rounded-xl border px-3 py-2.5", sevColor[s.severity])}>
                    <p className="text-xs font-bold">{s.name}</p>
                    <p className="mt-0.5 text-[11px] opacity-80">{s.value}</p>
                  </div>
                ))}
              </div>
              {pulse.alerts.length > 0 && (
                <div className="space-y-1">
                  {pulse.alerts.map((a: any, i: number) => (
                    <p
                      key={i}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-[11px] font-semibold",
                        a.severity === "critical" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      ⚠️ {a.text}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ بطاقة الصحة اليومية ═══ */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-primary" />
            بطاقة الصحة اليومية
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthCard === undefined ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : healthCard === null ? (
            <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              <div
                className={cn(
                  "flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 text-center",
                  healthCard.score >= 85
                    ? "border-emerald-500/50 text-emerald-600"
                    : healthCard.score >= 70
                      ? "border-sky-500/50 text-sky-600"
                      : healthCard.score >= 50
                        ? "border-amber-500/50 text-amber-600"
                        : "border-rose-500/50 text-rose-600",
                )}
              >
                <span className="text-2xl font-black leading-none">{healthCard.score}</span>
                <span className="text-[9px] text-muted-foreground">من 100</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-bold">{healthCard.verdict}</p>
                {healthCard.reasons.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا خصوم اليوم — كل المؤشرات نظيفة ✨</p>
                ) : (
                  healthCard.reasons.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {r}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ رادار المخاطر التنبؤي ═══ */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Radar className="size-4 text-primary" />
            رادار المخاطر التنبؤي
            {radar && radar.signals.length > 0 && (
              <Badge variant="outline" className="rounded-full border-rose-500/40 text-[10px] text-rose-600">
                {radar.signals.length} إشارة
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {radar === undefined ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : radar === null || radar.signals.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">لا أنماط خطر مرصودة — الأفق صافٍ 🌤️</p>
          ) : (
            radar.signals.map((s: any, i: number) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  s.level === "high"
                    ? "border-rose-500/30 bg-rose-500/5"
                    : s.level === "medium"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-sky-500/30 bg-sky-500/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[9px]",
                      s.level === "high"
                        ? "border-rose-500/40 text-rose-600"
                        : s.level === "medium"
                          ? "border-amber-500/40 text-amber-600"
                          : "border-sky-500/40 text-sky-600",
                    )}
                  >
                    {s.level === "high" ? "خطر مرتفع" : s.level === "medium" ? "متوسط" : "ملاحظة"}
                  </Badge>
                  <p className="text-xs font-bold">{s.title}</p>
                  <span className="ms-auto text-[9px] text-muted-foreground">{s.window}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ═══ المستشار AI ═══ */}
      <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareHeart className="size-4 text-primary" />
            المستشار AI للمالك
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="اسأل عن أي شيء في اللعبة: «هل الاقتصاد متضخم؟» · «ما أولوية اليوم؟»"
            rows={2}
            className="rounded-xl text-sm"
          />
          <Button onClick={handleAsk} disabled={asking || !question.trim()} className="gap-1.5 rounded-xl text-xs">
            {asking ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquareHeart className="size-3.5" />}
            اسأل المستشار
          </Button>
          {advice && (
            <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed">
              {advice}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ محاكي القرارات ═══ */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4 text-primary" />
            محاكي القرارات — جرّب قبل أن تنفّذ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="h-10 w-44 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="economy">الاقتصاد</SelectItem>
                <SelectItem value="matching">المطابقة</SelectItem>
                <SelectItem value="community">المجتمع</SelectItem>
                <SelectItem value="content">المحتوى</SelectItem>
                <SelectItem value="membership">العضويات</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="مثال: مضاعفة مكافآت جولات نهاية الأسبوع"
              rows={2}
              className="min-w-56 flex-1 rounded-xl text-sm"
            />
          </div>
          <Button onClick={handleSimulate} disabled={simulating || !decision.trim()} className="gap-1.5 rounded-xl text-xs">
            {simulating ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
            شغّل المحاكاة
          </Button>
          {simulation && (
            <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed">
              {simulation}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
