// 🧠 AI Suite — 30 نظام AI حر يعتمد على OpenRouter API المجاني
// + مجالس العقول: نقاشات تلقائية حية بين الأنظمة مع تدخل المالك أولاً بأول.
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/convex/questions";
import { AI_SYSTEMS } from "@/lib/aiSystems";
import {
  Bot,
  BrainCircuit,
  Circle,
  Crown,
  Gavel,
  Layers,
  Loader2,
  Pause,
  Play,
  Search,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "نقاش حي", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40" },
  paused: { label: "موقوف مؤقتاً", className: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  ended: { label: "انتهى", className: "bg-slate-500/15 text-slate-500 border-slate-500/40" },
};

export function AiSuiteTab() {
  const [activeSystem, setActiveSystem] = useState("free");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── المجلس ──
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string[]>(["mentor", "strategist", "security", "economist", "community"]);
  const [turns, setTurns] = useState(8);
  const [intervalSec, setIntervalSec] = useState(15);
  const [creating, setCreating] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [ownerMsg, setOwnerMsg] = useState("");
  const [intervening, setIntervening] = useState(false);
  const [freeMode, setFreeMode] = useState(true); // الوضع الحر: مواضيع مفتوحة + متحدثون كثر

  const askSystem = useAction(api.aiSuite.askSystem);
  const generateQuestions = useAction(api.aiSuite.generateAndStageQuestions);
  const pauseCouncil = useAction(api.aiCouncil.pauseCouncil);
  const resumeCouncil = useAction(api.aiCouncil.resumeCouncil);
  const endCouncil = useAction(api.aiCouncil.endCouncil);
  const intervene = useAction(api.aiCouncil.intervene);

  const sessions = useQuery(api.aiCouncilStore.listSessions, { limit: 15 });
  const activeSession = useQuery(
    api.aiCouncilStore.getSessionForUi,
    activeSessionId ? { sessionId: activeSessionId as never } : "skip",
  );
  const stats = useQuery(api.aiCouncilStore.getStats, {});
  const activity = useQuery(api.aiSuiteLog.listActivity, { limit: 10 });

  const current = activeSession ?? sessions?.[0] ?? null;

  const system = AI_SYSTEMS.find((s) => s.id === activeSystem) ?? AI_SYSTEMS[AI_SYSTEMS.length - 1];

  const toggleParticipant = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 8 ? prev : [...prev, id],
    );
  };

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const result = await askSystem({ systemId: activeSystem, prompt });
      setReply(result.reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في الاتصال بالـ AI");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCouncil = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      setActiveSessionId(String(Date.now()));
      toast.success("انعقد المجلس — النقاش بدأ تلقائياً");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء المجلس");
    } finally {
      setCreating(false);
    }
  };

  const handleIntervene = async () => {
    if (!current || !ownerMsg.trim()) return;
    setIntervening(true);
    try {
      await intervene({ sessionId: current._id, message: ownerMsg });
      setOwnerMsg("");
      toast.success("تدخلك وصل للمجلس");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التدخل");
    } finally {
      setIntervening(false);
    }
  };

  const handleGenQuestions = async () => {
    setBusy(true);
    try {
      const result = await generateQuestions({
        category: activeSystem === "free" ? "عام" : qCategoryFor(activeSystem),
        difficulty: "medium",
        count: 5,
      });
      setReply(result.staged.map((q, i) => `${i + 1}. ${q.question}\n   ✅ ${q.options[q.correctIndex]}`).join("\n"));
      toast.success(`تم توليد ${result.staged.length} أسئلة`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في توليد الأسئلة");
    } finally {
      setBusy(false);
    }
  };

  // فئة أسئلة تناسب طبيعة النظام المختار
  const qCategoryFor = (systemId: string): string => {
    const map: Record<string, string> = {
      qa: "عام", questiongen: "عام", translator: "لغة", tutor: "علوم",
      researcher: "تاريخ", coder: "تكنولوجيا", gamedesigner: "منطق", legal: "منوعات",
    };
    return map[systemId] ?? "عام";
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <BrainCircuit className="size-5 text-primary" />
            مجموعة أنظمة AI — 30 نظاماً حراً بـ API
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أنظمة ذكية تتكلم مع بعضها تلقائياً في نقاشات حية، وتستشار في أي شيء.
          </p>
        </div>
        {stats && (
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="gap-1.5">
              <Layers className="size-3" /> {stats.total} مجلس
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600">
              <Circle className="size-3 fill-emerald-500 text-emerald-500" /> {stats.active} نشط
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Users className="size-3" /> {stats.messages} رسالة
            </Badge>
          </div>
        )}
      </div>

      {/* ═══════════════ 🏛️ مجلس العقول — النقاش التلقائي ═══════════════ */}
      <Card className="border-primary/30 shadow-lg shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            مجلس العقول — نقاش تلقائي حي بين الأنظمة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* الموضوع */}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="اكتب موضوع النقاش… (أي شيء: تطوير اللعبة، فكرة موسم، سؤال حر)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-w-56 flex-1"
            />
            <Select value={String(turns)} onValueChange={(v) => setTurns(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 8, 12, 16, 24, 40].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} دور نقاش</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(intervalSec)} onValueChange={(v) => setIntervalSec(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 25, 40, 60].map((n) => (
                  <SelectItem key={n} value={String(n)}>كل {n} ثانية</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الوضع الحر */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold">الوضع الحر</p>
              <p className="text-xs text-muted-foreground">
                النقاش يفتح أبقاعاً أوسع ويسمح بمزج أكثر بين الأنظمة.
              </p>
            </div>
            <Switch checked={freeMode} onCheckedChange={setFreeMode} />
          </div>

          {/* المشاركون */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              المشاركون ({selected.length}/8) — اضغط لإضافة أو إزالة:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AI_SYSTEMS.map((s) => {
                const isSel = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleParticipant(s.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      isSel
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {s.emoji} {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreateCouncil} disabled={creating || !topic.trim() || selected.length < 2}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              انعقد المجلس
            </Button>
            {current && current.status === "active" && (
              <Button variant="outline" onClick={async () => { try { await pauseCouncil({ sessionId: current._id }); } catch {} }}>
                <Pause className="size-4" /> إيقاف مؤقت
              </Button>
            )}
            {current && current.status === "paused" && (
              <Button variant="outline" onClick={async () => { try { await resumeCouncil({ sessionId: current._id }); } catch {} }}>
                <Play className="size-4" /> استئناف
              </Button>
            )}
            {current && current.status !== "ended" && (
              <Button variant="destructive" onClick={async () => { try { await endCouncil({ sessionId: current._id }); } catch {} }}>
                <Square className="size-4" /> إنهاء
              </Button>
            )}
          </div>

          {/* المحادثة الحية */}
          {current && (
            <div className="rounded-xl border border-border/70">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <p className="text-sm font-semibold">«{current.topic}»</p>
                <Badge variant="outline" className={STATUS_META[current.status]?.className}>
                  {STATUS_META[current.status]?.label ?? current.status}
                </Badge>
              </div>
              <div className="max-h-96 space-y-3 overflow-y-auto p-3">
                {current.messages.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {current.lastError ?? "المجلس قائم — أول رد يصل خلال ثوانٍ…"}
                  </p>
                )}
                {current.messages.map((m, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base">
                      {m.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-primary">{m.systemName}</p>
                      <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* تدخل المالك */}
              {current.status === "active" && (
                <div className="flex gap-2 border-t border-border/60 p-3">
                  <Input
                    placeholder="تدخل المالك — قل رأيك وسيجيب المجلس فوراً…"
                    value={ownerMsg}
                    onChange={(e) => setOwnerMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIntervene()}
                    className="flex-1"
                  />
                  <Button onClick={handleIntervene} disabled={intervening || !ownerMsg.trim()} size="sm">
                    {intervening ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
                    تدخّل
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* المجالس السابقة */}
          {sessions && sessions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">المجالس الأخيرة:</p>
              <div className="flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => setActiveSessionId(s._id)}
                    className={cn(
                      "max-w-64 truncate rounded-lg border px-2.5 py-1 text-xs transition-colors hover:bg-muted",
                      activeSessionId === s._id ? "border-primary bg-primary/5" : "border-border",
                    )}
                    title={s.topic}
                  >
                    {s.topic} · {s.messages.length} رسالة
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════ استشارة نظام واحد ═══════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">استشارة نظام واحد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {AI_SYSTEMS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSystem(s.id)}
                title={s.desc}
                className={cn(
                  "rounded-xl border p-2.5 text-center transition-colors hover:bg-muted/60",
                  activeSystem === s.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border",
                )}
              >
                <span className="block text-lg">{s.emoji}</span>
                <span className="mt-1 block text-[11px] font-semibold leading-tight">{s.name}</span>
              </button>
            ))}
          </div>
          <Textarea
            placeholder={`اسأل «${system.name}»… ${system.desc}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAsk} disabled={busy || !prompt.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              إرسال
            </Button>
            <Button variant="outline" onClick={handleGenQuestions} disabled={busy}>
              <Search className="size-4" /> توليد 5 أسئلة
            </Button>
          </div>
          {reply && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {reply}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════ سجل النشاط ═══════════════ */}
      {activity && activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">سجل النشاط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a._id} className="flex items-start gap-3 rounded-lg border border-border/60 p-2.5">
                  <Badge variant="outline" className="shrink-0">{a.systemName}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
