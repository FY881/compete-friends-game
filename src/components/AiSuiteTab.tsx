// 🧠 AI Suite — 30 نظام AI حر يعتمد على OpenRouter API المجاني
// كل نظام له شخصية مستقلة، مع اجتماع مجلس الذكاء وتوليد أسئلة وسجل نشاط.
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/convex/questions";
import { Bot, BrainCircuit, Gavel, Loader2, Search, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AiSuiteTab() {
  const [activeSystem, setActiveSystem] = useState("free");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [topic, setTopic] = useState("");
  const [councilResults, setCouncilResults] = useState<{ system: string; reply: string }[] | null>(null);
  const [councilBusy, setCouncilBusy] = useState(false);

  const [qCategory, setQCategory] = useState<string>(CATEGORIES[0] ?? "عام");
  const [qDifficulty, setQDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [qCount, setQCount] = useState(5);
  const [qResult, setQResult] = useState<string | null>(null);
  const [qBusy, setQBusy] = useState(false);

  const askSystem = useAction(api.aiSuite.askSystem);
  const councilMeeting = useAction(api.aiSuite.councilMeeting);
  const generateQuestions = useAction(api.aiSuite.generateAndStageQuestions);
  const activity = useQuery(api.aiSuiteLog.listActivity, { limit: 30 });

  const system: { id: string; name: string; desc: string } = {
    id: "free",
    name: "العقل الحر",
    desc: "AI بدون قيود لأي مهمة",
  };

  const systems = [
    { id: "strategist", name: "المحلل الاستراتيجي", desc: "خطط نمو وتطوير", icon: Gavel },
    { id: "security", name: "خبير الأمن السيبراني", desc: "فحص الثغرات", icon: Bot },
    { id: "behavior", name: "محلل سلوك اللاعبين", desc: "رصد الشذوذ والغش", icon: Users },
    { id: "economist", name: "مستشار الاقتصاد", desc: "موازنة العملات والمتجر", icon: Sparkles },
    { id: "moderator", name: "الرقابي المساعد", desc: "تقييم الرسائل والبلاغات", icon: BrainCircuit },
    { id: "free", name: "العقل الحر", desc: "AI بدون قيود لأي مهمة", icon: Bot },
  ] as const;

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

  const handleCouncil = async () => {
    if (!topic.trim()) return;
    setCouncilBusy(true);
    try {
      const result = await councilMeeting({ topic });
      setCouncilResults(result.results);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في الاتصال بالـ AI");
    } finally {
      setCouncilBusy(false);
    }
  };

  const handleGenQuestions = async () => {
    setQBusy(true);
    try {
      const result = await generateQuestions({ category: qCategory, difficulty: qDifficulty, count: qCount });
      setQResult(
        result.staged.map((q, i) => `${i + 1}. ${q.question}\n   ✅ ${q.options[q.correctIndex]}`).join("\n"),
      );
      toast.success(`تم توليد ${result.staged.length} سؤالاً`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ في توليد الأسئلة");
    } finally {
      setQBusy(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <BrainCircuit className="size-5 text-primary" />
          مجموعة أنظمة AI — 30 نظاماً حراً بـ API
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          كل نظام له شخصية وسياق مستقل. اختر نظاماً، اكتب طلبك، واحصل على رد فوري.
        </p>
      </div>

      {/* اختيار النظام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">اختر نظاماً</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {systems.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSystem(s.id)}
                className={cn(
                  "rounded-xl border p-3 text-start transition-colors hover:bg-muted/60",
                  activeSystem === s.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <s.icon className="size-4 text-primary" />
                  <span className="text-sm font-semibold">{s.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            + 24 نظاماً إضافياً متاحاً عبر الواجهة البرمجية للأنظمة الداخلية.
          </p>
        </CardContent>
      </Card>

      {/* استشارة نظام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">استشارة {system.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="اكتب طلبك هنا…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
          <Button onClick={handleAsk} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            إرسال
          </Button>
          {reply && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {reply}
            </div>
          )}
        </CardContent>
      </Card>

      {/* مجلس الذكاء */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مجلس الذكاء — اجتماع 6 أنظمة على موضوع واحد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="موضوع الاجتماع…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <Button onClick={handleCouncil} disabled={councilBusy || !topic.trim()}>
              {councilBusy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
              انعقاد
            </Button>
          </div>
          {councilResults && (
            <div className="space-y-3">
              {councilResults.map((r, i) => (
                <div key={i} className="rounded-xl border border-border/70 p-3">
                  <Badge variant="outline" className="mb-2">{r.system}</Badge>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.reply}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* توليد الأسئلة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مولّد الأسئلة الذكي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={qCategory} onValueChange={setQCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={qDifficulty} onValueChange={(v) => setQDifficulty(v as "easy" | "medium" | "hard")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">سهلة</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="hard">صعبة</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={10}
              value={qCount}
              onChange={(e) => setQCount(Number(e.target.value) || 5)}
              className="w-24"
            />
            <Button onClick={handleGenQuestions} disabled={qBusy}>
              {qBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              توليد
            </Button>
          </div>
          {qResult && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {qResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل النشاط */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل النشاط</CardTitle>
        </CardHeader>
        <CardContent>
          {!activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
