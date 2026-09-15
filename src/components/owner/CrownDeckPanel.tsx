import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Radio,
  MessageSquareHeart,
  FlaskConical,
  Gauge,
  Radar,
  Landmark,
  Users,
  ScrollText,
  Megaphone,
  Lock,
  BrainCircuit,
  Search,
  Vote,
  Database,
  Target,
  MessagesSquare,
  Plane,
  TrendingUp,
  ClipboardList,
  Infinity as InfinityIcon,
} from "lucide-react";

/**
 * 👑 غرفة المالك v5.0 «العرش» — اللوحة الكاملة (المراحل أ ب ج د — 20 وظيفة)
 * كل بطاقة مربوطة بدالة Convex حقيقية في crownDeck.ts
 */

const sevColor: Record<string, string> = {
  ok: "text-emerald-600 border-emerald-500/30 bg-emerald-500/10",
  warn: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  critical: "text-rose-600 border-rose-500/30 bg-rose-500/10",
};

const voteColor: Record<string, string> = {
  "نعم": "border-emerald-500/40 text-emerald-600",
  "لا": "border-rose-500/40 text-rose-600",
  "امتناع": "border-slate-400/40 text-muted-foreground",
};

function fmtAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "الآن";
  if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} د`;
  if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} س`;
  return `قبل ${Math.floor(diff / 86_400_000)} ي`;
}

// ═══════════════════════════════════════════════════════════════════════
// المرحلة أ (1–5)
// ═══════════════════════════════════════════════════════════════════════

export function CrownDeckPanel() {
  const pulse = useQuery(api.crownDeck.getPulse360);
  const healthCard = useQuery(api.crownDeck.getDailyHealthCard);
  const radar = useQuery(api.crownDeck.getRiskRadar);
  const trends = useQuery(api.crownDeck.getWeeklyTrends);
  const decisions = useQuery(api.crownDeck.getDecisionLedger);
  const broadcastLog = useQuery(api.crownDeck.getBroadcastLog);
  const locks = useQuery(api.crownDeck.getEmergencyLocks);
  const council = useQuery(api.crownDeck.getCouncilHistory);

  const [question, setQuestion] = useState("");
  const askAdvisor = useAction(api.crownDeck.askAdvisor);
  const [advice, setAdvice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const [decision, setDecision] = useState("");
  const [domain, setDomain] = useState("economy");
  const simulate = useAction(api.crownDeck.simulateDecision);
  const [simulation, setSimulation] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  const [bankerQ, setBankerQ] = useState("");
  const askBanker = useAction(api.crownDeck.askRoyalBanker);
  const [bankerA, setBankerA] = useState<string | null>(null);
  const [banking, setBanking] = useState(false);

  const [topic, setTopic] = useState("");
  const runCouncil = useAction(api.crownDeck.runCouncilSession);
  const [session, setSession] = useState<any>(null);
  const [counciling, setCounciling] = useState(false);

  const [ideaGen, setIdeaGen] = useState(false);
  const [ideas, setIdeas] = useState<string | null>(null);
  const brainstorm = useAction(api.crownDeck.brainstormEvents);

  const [digestTxt, setDigestTxt] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const summarize = useAction(api.crownDeck.summarizeComplaints);

  const [aiText, setAiText] = useState("");
  const [aiSystem, setAiSystem] = useState("all");
  const searchAiLog = useQuery(api.crownDeck.searchIntelligenceLog, { system: aiSystem, text: aiText || undefined, limit: 40 });

  const logDecision = useMutation(api.crownDeck.logDecision);
  const broadcast = useMutation(api.crownDeck.broadcast);
  const setLock = useMutation(api.crownDeck.setEmergencyLock);
  const incidentToTask = useMutation(api.crownDeck.incidentToTask);

  // لوحة اللاعبين الاستقصائية (7)
  const [playerQ, setPlayerQ] = useState("");
  const foundPlayers = useQuery(api.commandDeck.searchPlayers, playerQ.trim() ? { search: playerQ.trim(), limit: 5 } : "skip");
  const [chosenId, setChosenId] = useState<any>(null);
  const dossier = useQuery(api.crownDeck.getInvestigativePanel, chosenId ? { userId: chosenId } : "skip");
  const replay = useQuery(api.crownDeck.getIncidentReplay, {});
  const selfRank = useQuery(api.crownDeck.getSurgerySelfRank);

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

  const handleBanker = async () => {
    if (!bankerQ.trim()) return;
    setBanking(true);
    setBankerA(null);
    try {
      const res = await askBanker({ question: bankerQ.trim() });
      if (res?.answer) setBankerA(res.answer);
      else toast.error(res?.reason || "تعذّر الحصول على إجابة");
    } catch {
      toast.error("فشل الاتصال بمصرفي المملكة");
    } finally {
      setBanking(false);
    }
  };

  const handleCouncil = async () => {
    if (!topic.trim()) return;
    setCounciling(true);
    setSession(null);
    try {
      const res = await runCouncil({ topic: topic.trim() });
      if (res?.session) {
        setSession(res.session);
        toast.success("انعقد مجلس العقول وسُجّلت الجلسة");
      } else toast.error(res?.reason || "تعذّر انعقاد المجلس");
    } catch {
      toast.error("فشل انعقاد المجلس");
    } finally {
      setCounciling(false);
    }
  };

  const handleBrainstorm = async () => {
    setIdeaGen(true);
    setIdeas(null);
    try {
      const res = await brainstorm({});
      if (res?.ideas) setIdeas(res.ideas);
      else toast.error(res?.reason || "تعذّر توليد الأفكار");
    } catch {
      toast.error("فشل مختبر الأحداث");
    } finally {
      setIdeaGen(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    setDigestTxt(null);
    try {
      const res = await summarize({});
      if (res?.summary) setDigestTxt(res.summary);
      else toast.error(res?.reason || "لا شكاوى أو لا مفتاح");
    } catch {
      toast.error("فشل تلخيص الشكاوى");
    } finally {
      setSummarizing(false);
    }
  };

  const handleLogDecision = async () => {
    const el = document.getElementById("decTitle") as HTMLInputElement | null;
    const el2 = document.getElementById("decWhy") as HTMLInputElement | null;
    const el3 = document.getElementById("decExp") as HTMLInputElement | null;
    if (!el?.value.trim() || !el2?.value.trim() || !el3?.value.trim()) {
      toast.error("املأ العنوان والسبب والتوقع");
      return;
    }
    try {
      await logDecision({ title: el.value.trim(), why: el2.value.trim(), expected: el3.value.trim() });
      toast.success("سُجّل القرار — سيُقاس أثره تلقائياً بعد 7 أيام");
      el.value = ""; el2.value = ""; el3.value = "";
    } catch {
      toast.error("تعذّر تسجيل القرار");
    }
  };

  const handleBroadcast = async () => {
    const t = document.getElementById("bcTitle") as HTMLInputElement | null;
    const b = document.getElementById("bcBody") as HTMLInputElement | null;
    const aud = document.getElementById("bcAud") as HTMLSelectElement | null;
    if (!t?.value.trim() || !b?.value.trim() || !aud?.value) {
      toast.error("املأ العنوان والنص واختر الجمهور");
      return;
    }
    try {
      const res = await broadcast({
        title: t.value.trim(),
        body: b.value.trim(),
        audience: aud.value as any,
        kind: "update",
      });
      toast.success(`وصل الإذاعة إلى: ${res?.audienceLabel} (${res?.delivered})`);
      t.value = ""; b.value = "";
    } catch {
      toast.error("تعذّر الإرسال");
    }
  };

  const handleLock = async (system: string, locked: boolean) => {
    const reason = prompt(locked ? "سبب القفل (مطلوب):" : "سبب رفع القفل:") ?? "";
    if (locked && !reason.trim()) return toast.error("سبب القفل مطلوب");
    try {
      await setLock({ system: system as any, locked, reason: reason.trim() || "—" });
      toast.success(locked ? "تم التجميد" : "تم الفتح");
    } catch {
      toast.error("تعذّر تنفيذ القفل");
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* ═══ 1) مركز القيادة الحي 360° ═══ */}
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 4) بطاقة الصحة اليومية ═══ */}
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
                      <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 18) الاتجاهات الأسبوعية ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              اتجاهات الأسبوع
              {trends && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full text-[10px]",
                    trends.direction === "نمو" ? "border-emerald-500/40 text-emerald-600" : trends.direction === "تراجع" ? "border-rose-500/40 text-rose-600" : "border-slate-400/40 text-muted-foreground",
                  )}
                >
                  {trends.direction}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trends === undefined ? (
              <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
            ) : trends === null ? (
              <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
            ) : (
              <>
                <div className="flex h-28 items-end gap-1.5">
                  {trends.days.map((d: any) => {
                    const maxR = Math.max(1, ...trends.days.map((x: any) => x.rounds));
                    return (
                      <div key={d.day} className="flex flex-1 flex-col items-center gap-0.5">
                        <span className="text-[9px] tabular-nums text-muted-foreground">{d.rounds}</span>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary/80"
                          style={{ height: `${Math.max(4, (d.rounds / maxR) * 72)}px` }}
                        />
                        <span className="text-[8px] text-muted-foreground">{d.day.slice(8)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">💡 {trends.insight}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 5) رادار المخاطر التنبؤي ═══ */}
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 2) المستشار AI ═══ */}
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

        {/* ═══ 3) محاكي القرارات ═══ */}
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

        {/* ═══ 10) مصرفي المملكة AI ═══ */}
        <Card className="border-amber-500/20 bg-amber-500/[0.03] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4 text-amber-600" />
              مصرفي المملكة AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={bankerQ}
              onChange={(e) => setBankerQ(e.target.value)}
              placeholder="«هل هناك تضخم؟» · «أين تتسرب العملات؟»"
              rows={2}
              className="rounded-xl text-sm"
            />
            <Button onClick={handleBanker} disabled={banking || !bankerQ.trim()} className="gap-1.5 rounded-xl text-xs">
              {banking ? <Loader2 className="size-3.5 animate-spin" /> : <Landmark className="size-3.5" />}
              اسأل المصرفي
            </Button>
            {bankerA && (
              <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed">
                {bankerA}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 6) لوحة اللاعبين الاستقصائية ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              لوحة اللاعبين الاستقصائية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={playerQ}
                onChange={(e) => setPlayerQ(e.target.value)}
                placeholder="ابحث بالاسم أو البريد…"
                className="rounded-xl ps-9 text-sm"
              />
            </div>
            {foundPlayers && foundPlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {foundPlayers.map((p: any) => (
                  <button
                    key={String(p.id)}
                    onClick={() => setChosenId(p.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      String(chosenId) === String(p.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {p.name} · م{p.level}
                  </button>
                ))}
              </div>
            )}
            {dossier === undefined && chosenId ? (
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
            ) : dossier ? (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-bold">{dossier.identity.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>XP: {dossier.profile.xp}</span>
                  <span>جولات: {dossier.profile.gamesPlayed}</span>
                  <span>انذارات: {dossier.profile.warnings}</span>
                  <span>ضربات غش: {dossier.profile.cheatStrikes}</span>
                </div>
                <p className={cn("text-[11px] font-semibold", dossier.activity.trendPct >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  نشاط الأسبوع: {dossier.activity.roundsWeek} جولة ({dossier.activity.trendPct >= 0 ? "+" : ""}{dossier.activity.trendPct}%)
                </p>
                {dossier.punishments.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">آخر عقوبة: {dossier.punishments[0]?.action} — {dossier.punishments[0]?.reason}</p>
                )}
              </div>
            ) : (
              <p className="text-center text-[11px] text-muted-foreground">اختر لاعباً لعرض ملفه الكامل</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 7) مسجل القرارات الموثّق ═══ */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ScrollText className="size-4 text-primary" />
            مسجل القرارات الموثّق — توقع ثم قِس الأثر بعد 7 أيام
            {decisions && <Badge variant="outline" className="rounded-full text-[10px]">{decisions.length} قرار</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input id="decTitle" placeholder="عنوان القرار" className="rounded-xl text-sm" />
            <Input id="decWhy" placeholder="لماذا الآن؟" className="rounded-xl text-sm" />
            <Input id="decExp" placeholder="ماذا تتوقع أن يحدث؟" className="rounded-xl text-sm" />
          </div>
          <Button onClick={handleLogDecision} className="gap-1.5 rounded-xl text-xs">
            <ScrollText className="size-3.5" />
            سجّل القرار
          </Button>
          {decisions && decisions.length > 0 && (
            <div className="space-y-1.5">
              {decisions.slice(0, 5).map((d: any) => (
                <div key={d._id} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold">{d.title}</p>
                    {d.measured ? (
                      <Badge variant="outline" className={cn("rounded-full text-[9px]", d.verdict?.includes("✅") ? "border-emerald-500/40 text-emerald-600" : d.verdict?.includes("⚠️") ? "border-rose-500/40 text-rose-600" : "border-slate-400/40")}>{d.verdict?.slice(0, 60)}</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full text-[9px] border-slate-400/40 text-muted-foreground">بانتظار القياس ({fmtAgo(d.createdAt)})</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">التوقع: {d.expected}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 8) وحدة الإذاعة ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-primary" />
              وحدة الإذاعة المستهدفة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input id="bcTitle" placeholder="عنوان الإذاعة" className="rounded-xl text-sm" />
            <Input id="bcBody" placeholder="نص الإذاعة" className="rounded-xl text-sm" />
            <select
              id="bcAud"
              defaultValue="all"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">الجميع</option>
              <option value="active">النشطون (آخر 7 أيام)</option>
              <option value="dormant">النائمون (+14 يوماً)</option>
              <option value="tier:gold">عضوية ذهبية</option>
              <option value="tier:diamond">عضوية ماسية</option>
              <option value="tier:exclusive">عضوية حصرية</option>
            </select>
            <Button onClick={handleBroadcast} className="w-full gap-1.5 rounded-xl text-xs">
              <Megaphone className="size-3.5" />
              أرسل الإذاعة
            </Button>
            {broadcastLog && broadcastLog.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                آخر إذاعة: {broadcastLog[0].title} → {broadcastLog[0].audienceLabel} ({broadcastLog[0].delivered})
              </p>
            )}
          </CardContent>
        </Card>

        {/* ═══ 9) قفل الطوارئ الشامل ═══ */}
        <Card className={cn("border-border/80 shadow-sm", locks?.site?.locked && "border-rose-500/40")}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-rose-600" />
              قفل الطوارئ الشامل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locks === undefined ? (
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
            ) : locks === null ? (
              <p className="text-center text-xs text-muted-foreground">غير مصرح</p>
            ) : (
              (["site", "arena", "chat", "economy"] as const).map((sys) => {
                const st = (locks as any)[sys];
                const locked = st?.locked;
                return (
                  <div key={sys} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">
                        {sys === "site" ? "الموقع كله" : sys === "arena" ? "الساحة" : sys === "chat" ? "الدردشة" : "الاقتصاد"}
                      </p>
                      {locked && <p className="truncate text-[10px] text-rose-600">{st.reason}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {locked ? (
                        <Badge variant="outline" className="rounded-full border-rose-500/40 text-[9px] text-rose-600">مقفول</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-emerald-500/40 text-[9px] text-emerald-600">حر</Badge>
                      )}
                      <Button size="sm" variant={locked ? "outline" : "destructive"} className="h-7 rounded-lg text-[10px]" onClick={() => handleLock(sys, !locked)}>
                        {locked ? "افتح" : "جمّد"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 11) غرفة اجتماعات العقول ═══ */}
      <Card className="border-violet-500/20 bg-violet-500/[0.03] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="size-4 text-violet-600" />
            غرفة اجتماعات العقول — وحدات AI تناقش وتصوّت
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="موضوع الجلسة: «هل نضاعف مكافآت نهاية الأسبوع؟»"
              className="min-w-56 flex-1 rounded-xl text-sm"
            />
            <Button onClick={handleCouncil} disabled={counciling || !topic.trim()} className="gap-1.5 rounded-xl text-xs">
              {counciling ? <Loader2 className="size-3.5 animate-spin" /> : <Vote className="size-3.5" />}
              انعقد المجلس
            </Button>
          </div>
          {session && (
            <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3">
              {session.speeches.map((sp: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <Badge variant="outline" className={cn("shrink-0 rounded-full text-[9px]", voteColor[sp.vote])}>{sp.vote}</Badge>
                  <p className="min-w-0"><span className="font-bold">{sp.unitName}:</span> <span className="text-muted-foreground">{sp.stance}</span></p>
                </div>
              ))}
              <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
                التوصية: {session.recommendation} ({session.yesVotes} نعم / {session.noVotes} لا)
              </p>
            </div>
          )}
          {council && council.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              آخر جلسة محفوظة: {council[0].topic} — التوصية: {String(council[0].recommendation).slice(0, 60)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 12) سجل الذكاء الموحد ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Database className="size-4 text-primary" />
              سجل الذكاء الموحد
              {searchAiLog && <Badge variant="outline" className="rounded-full text-[10px]">{searchAiLog.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="ابحث في قرارات الـ AI…"
                className="flex-1 rounded-xl text-sm"
              />
              <Select value={aiSystem} onValueChange={setAiSystem}>
                <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنظمة</SelectItem>
                  <SelectItem value="moderation">الرقابة</SelectItem>
                  <SelectItem value="antiCheat">الحاكم الآلي</SelectItem>
                  <SelectItem value="errorHunter">صياد الأخطاء</SelectItem>
                  <SelectItem value="owner">الملك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {searchAiLog === undefined ? (
                <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
              ) : searchAiLog === null ? (
                <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
              ) : searchAiLog.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">لا نتائج</p>
              ) : (
                searchAiLog.map((r: any) => (
                  <div key={r._id} className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                    <span className="font-semibold">{r.system}</span> · {r.action} — <span className="text-muted-foreground">{String(r.detail).slice(0, 80)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══ 13) محلل السلوك الجمعي ═══ */}
        <CollectiveBehaviorCard />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 14) مختبر الأحداث AI ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" />
              مختبر الأحداث AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleBrainstorm} disabled={ideaGen} className="gap-1.5 rounded-xl text-xs">
              {ideaGen ? <Loader2 className="size-3.5 animate-spin" /> : <Target className="size-3.5" />}
              ولّد أفكار أحداث من البيانات الحية
            </Button>
            {ideas && (
              <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed">
                {ideas}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 15) مترجم الشكاوى الذكي ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="size-4 text-primary" />
              مترجم الشكاوى الذكي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleSummarize} disabled={summarizing} className="gap-1.5 rounded-xl text-xs">
              {summarizing ? <Loader2 className="size-3.5 animate-spin" /> : <MessagesSquare className="size-3.5" />}
              لخّص البلاغات والاعتراضات الآن
            </Button>
            {digestTxt && (
              <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[13px] leading-relaxed">
                {digestTxt}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ═══ 16) مسجّل الرحلات ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Plane className="size-4 text-primary" />
              مسجّل الرحلات — آخر الحوادث خطوة بخطوة
              {replay && <Badge variant="outline" className="rounded-full text-[10px]">{replay.total}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto">
            {replay === undefined ? (
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
            ) : replay === null ? (
              <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
            ) : replay.timeline.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">لا حوادث بعد</p>
            ) : (
              replay.timeline.map((t: any) => (
                <div key={t.id} className="rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("rounded-full text-[9px]", t.autoHealed ? "border-emerald-500/40 text-emerald-600" : "border-rose-500/40 text-rose-600")}>
                      {t.autoHealed ? "شُفي" : "نشط"}
                    </Badge>
                    <span className="font-semibold">{t.route}</span>
                    <span className="ms-auto text-[9px] text-muted-foreground">{fmtAgo(t.at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-muted-foreground">{t.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ═══ 17) درج الجراحة الذاتي + 19) حوادث←مهام ═══ */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" />
              درج الجراحة الذاتي — تحويل الحوادث إلى مهام
              {selfRank && <Badge variant="outline" className="rounded-full text-[10px]">{selfRank.siteLocked ? "الموقع مقفول" : "الموقع حر"}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto">
            {selfRank === undefined ? (
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
            ) : selfRank === null ? (
              <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
            ) : (
              selfRank.queue.errors?.slice(0, 10).map((e: any) => (
                <div key={e.id ?? e._id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{String(e.message ?? e.title ?? "").slice(0, 70)}</p>
                    <p className="text-[9px] text-muted-foreground">تأثير: {e.impact ?? "—"} · ثقة: {e.confidence ?? "—"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 rounded-lg text-[9px]"
                    onClick={async () => {
                      try {
                        await incidentToTask({ errorId: e.id ?? e._id });
                        toast.success("تحولت الحادثة إلى مهمة");
                      } catch {
                        toast.error("تعذّر التحويل");
                      }
                    }}
                  >
                    ← مهمة
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ 20) الذاكرة الخالدة ═══ */}
      <Card className="border-amber-500/20 bg-amber-500/[0.03] shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <InfinityIcon className="size-5 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">الذاكرة الخالدة للعرش</p>
            <p className="text-[10px] text-muted-foreground">لقطة أسبوعية كاملة (قرارات، إذاعات، مجالس، نشاط) تُؤرشف آلياً كل يوم — لا تُمس أبداً.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-amber-500/40 text-[10px] text-amber-600">تُلتقط آلياً</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 13) محلل السلوك الجمعي — مكون منفصل ليستخدم useQuery الخاص به
// ═══════════════════════════════════════════════════════════════════════

function CollectiveBehaviorCard() {
  const behavior = useQuery(api.crownDeck.getCollectiveBehavior);
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4 text-primary" />
          محلل السلوك الجمعي
          {behavior && behavior.patterns.length > 0 && (
            <Badge variant="outline" className="rounded-full text-[10px]">{behavior.patterns.length} نمط</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {behavior === undefined ? (
          <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
        ) : behavior === null ? (
          <p className="py-3 text-center text-xs text-muted-foreground">غير مصرح</p>
        ) : behavior.patterns.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">لا أنماط بعد — عيّنة {behavior.sampleSize} جولة</p>
        ) : (
          behavior.patterns.map((p: any, i: number) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border px-3 py-2",
                p.severity === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-sky-500/30 bg-sky-500/5",
              )}
            >
              <p className="text-xs font-bold">{p.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{p.detail}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
