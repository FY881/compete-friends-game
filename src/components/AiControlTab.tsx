/**
 * AI Control Mode — وضع التحكم الكامل بالذكاء الاصطناعي
 * المالك يتحكم في كل شيء بالأوامر
 */
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Send,
  Zap,
  Database,
  Settings,
  Users,
  Trophy,
  MessageSquare,
  BarChart3,
  Loader2,
  Check,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

const QUICK_COMMANDS = [
  { icon: Database, label: "توليد أسئلة جديدة", command: "ولّد 10 أسئلة جديدة متنوعة" },
  { icon: Settings, label: "تحسين الصعوبة", command: "حسّن مستوى صعوبة الأسئلة بناءً على أداء اللاعبين" },
  { icon: Users, label: "تحليل اللاعبين", command: "حلّل أداء جميع اللاعبين النشطين" },
  { icon: Trophy, label: "إنشاء تحدي خاص", command: "أنشئ تحدياً خاصاً بكلمات سريعة" },
  { icon: BarChart3, label: "تقرير الأداء", command: " أعطني تقريراً شاملاً عن حالة اللعبة" },
  { icon: Zap, label: "تنظيف البيانات", command: "نظّف البيانات القديمة والغرف المنتهية" },
  { icon: MessageSquare, label: "رسالة للاعبين", command: "أرسل رسالة ترحيب لجميع اللاعبين النشطين" },
];

interface AiAction {
  action: string;
  description: string;
  message: string;
  parameters: Record<string, unknown>;
}

export function AiControlTab() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem("openrouter_api_key") ?? ""; } catch { return ""; }
  });
  const [showKey, setShowKey] = useState(false);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAction | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const aiControl = useAction(api.openRouter.aiControlCommand);

  const saveKey = () => {
    try { localStorage.setItem("openrouter_api_key", apiKey); } catch { /* ok */ }
    toast.success("تم حفظ مفتاح API");
  };

  const runCommand = async (cmd: string) => {
    if (!apiKey) { toast.error("أدخل مفتاح API أولاً"); return; }
    if (!cmd.trim()) return;
    setLoading(true);
    try {
      const res = await aiControl({
        apiKey,
        command: cmd,
        gameState: JSON.stringify({ timestamp: new Date().toISOString(), source: "owner_control" }),
      });
      setResult(res);
      setLogs(prev => [`[${new Date().toLocaleTimeString("ar")}] الأمر: ${cmd}`, ...prev.slice(0, 49)]);
      toast.success(`✅ ${res.description}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ غير معروف";
      toast.error(`❌ ${msg}`);
      setLogs(prev => [`[خطأ] ${msg}`, ...prev.slice(0, 49)]);
    } finally {
      setLoading(false);
      setCommand("");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* API Key */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="size-4 text-primary" />
            مفتاح OpenRouter API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button onClick={saveKey} size="sm" className="rounded-xl">
              <Check className="size-3.5" /> حفظ
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            احصل على المفتاح من <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary underline">openrouter.ai/keys</a>
          </p>
        </CardContent>
      </Card>

      {/* Quick Commands */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-amber-500" />
            أوامر سريعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_COMMANDS.map((qc) => {
              const Icon = qc.icon;
              return (
                <button
                  key={qc.command}
                  type="button"
                  onClick={() => runCommand(qc.command)}
                  disabled={loading || !apiKey}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-background p-3 text-start text-xs transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  {qc.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Command */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            أمر مخصص
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && runCommand(command)}
              placeholder="اكتب أمراً لأي شيء في اللعبة..."
              disabled={loading || !apiKey}
              className="rounded-xl"
            />
            <Button
              onClick={() => runCommand(command)}
              disabled={loading || !apiKey || !command.trim()}
              size="icon"
              className="shrink-0 rounded-xl"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Response */}
      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-emerald-500" />
              نتيجة AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full text-[10px]">{result.action}</Badge>
              <span className="text-xs font-medium">{result.description}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-muted-foreground" />
              سجل النشاط
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 space-y-1 overflow-auto rounded-xl bg-muted/30 p-3">
              {logs.map((log, i) => (
                <p key={`${i}-${log.slice(0, 20)}`} className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {log}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
