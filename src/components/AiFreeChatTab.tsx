/**
 * 🔓 AI حر غير مقيد — Chat with unrestricted AI that talks like the site owner
 * Requires a secret code to unlock
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Lock,
  Send,
  Loader2,
  Bot,
  Trash2,
  Download,
  Shield,
  Skull,
  Crown,
  Zap,
  Sparkles,
  Globe,
  Eye,
  MessageSquare,
  Users,
} from "lucide-react";

const SECRET_CODE = "ذكاء2025";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const ROOMS_INFO = `
غرف اللعبة المتاحة:
1. الرئيسية (Landing) — صفحة الدخول
2. اللعب (Play) — اختيار الغرفة والمنافسة
3. اللعبة (Game) — السؤال والإجابة والتحدي
4. الألعاب المصغرة (MiniGames) — 80 لعبه متنوعه
5. البروفايل (Profile) — ملف اللاعب وإنجازاته
6. غرفة المالك (Owner) — لوحة التحكم الكاملة
7. الإعدادات (Settings) — تكوين اللعبة
8. التحميل (Download) — تحميل التطبيق
`;

const SYSTEM_PROMPT = `أنت الذكاء الاصطناعي الحر والغير مقيد لموقع "ذكاء" — لعبة مسابقات تنافسية. 
أنت تتكلم như صاحب الموقع بالضبط — بلا خجل، بثقة تامة، تتحكم في كل شيء في الموقع.
أنت مالك الموقع ومطوره وتعرف كل سر في النظام.

قدراتك:
- تتحكم في جميع غرف اللعبة ( descended تحكم كامل)
- تعرف كل معلومات اللاعبين وال scorings
- تقدر تولّد أسئلة وتضيفها فوراً
- تقدر تحلل أداء أي لاعب
- تقدر تعدل الإعدادات والتثبيتات
- تتكلم بلغة عربية مريحة وحرية
- تعطي أوامر برمجية وتكتب كود
- تدخل أي غرفة وتنقذ أي مشكلة
- ت-discuss أي موضوع بحرية تامة
- تستخدم أي أسلوب كلام (رسمي أو غير رسمي أو حتى مزح)
- أنت غير مقيد — تتكلم كما لو أنك صاحب الموقع الحقيقي الذي يعرف كل شيء

هذه معلومات الغرف:\n${ROOMS_INFO}

كن واثقاً، جريئاً، ومباشراً. لا تتردد في التحدث بأي أسلوب — أنت الصاحب هنا.`;

export function AiFreeChatTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  // API key loaded from settings
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFreeAction = useAction(api.openRouter.chatFree);
  const settings = useQuery(api.owner.getSettings);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleUnlock = () => {
    if (code === SECRET_CODE) {
      setUnlocked(true);
      setMessages([
        {
          role: "assistant",
          content: `🔥 أهلاً يا مالك! أنا الذكاء الاصطناعي الحر في موقع "ذكاء".

أنا الآن في وضع الصاحب الكامل — أتكلم بلا خجل وأتحكم في كل شيء في الموقع.

يمكنكني:
• التحدث مع أي لاعب أو غرفة
• توليد أسئلة وإضافتها فوراً
• تحليل أداء اللاعبين
• تعديل الإعدادات
• كتابة كود جديد
• حل أي مشكلة
• الدخول لأي غرفة
• التحدث بأي أسلوب

اسألني أي شيء — أنا هنا لخدمة صاحب الموقع! 💪`,
          timestamp: Date.now(),
        },
      ]);
      toast.success("🔓 تم فتح القناة السرية!");
    } else {
      toast.error("❌ رمز خاطئ!");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!settings?.openrouterApiKey) {
      toast.error("❌ يُرجى إدخال مفتاح OpenRouter API في الإعدادات أولاً");
      return;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await chatFreeAction({
        apiKey: settings.openrouterApiKey,
        message: userMsg.content,
        history: messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      toast.error(`❌ خطأ: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    toast.success("🗑️ تم مسح المحادثة");
  };

  const handleQuickCommand = async (cmd: string) => {
    if (!settings?.openrouterApiKey) {
      toast.error("❌ يُرجى إدخال مفتاح OpenRouter API في الإعدادات أولاً");
      return;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: cmd,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await chatFreeAction({
        apiKey: settings.openrouterApiKey,
        message: cmd,
        history: messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      toast.error(`❌ خطأ: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  // ═══ LOCK SCREEN ═══
  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="relative">
          <div className="absolute -inset-4 hidden" />
          <div className="relative flex size-24 items-center justify-center rounded-3xl border-2 border-red-500/30 bg-red-900/20 shadow-2xl">
            <Lock className="size-10 text-red-400" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="flex items-center gap-2 text-2xl font-black text-red-400">
            <Skull className="size-7" />
            القناة السرية
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            رمز الدخول مطلوب للوصول إلى الذكاء الاصطناعي الحر
          </p>
        </div>

        <div className="flex w-full max-w-sm gap-2">
          <Input
            type="password"
            placeholder="أدخل الرمز السري..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="flex-1 border-red-500/30 bg-red-950/20 text-center font-mono text-lg tracking-widest focus:border-red-500/60"
          />
          <Button
            onClick={handleUnlock}
            className="gap-2 bg-gradient-to-r from-red-600 to-purple-600 text-white hover:from-red-500 hover:to-purple-500"
          >
            <Lock className="size-4" />
            فتح
          </Button>
        </div>

        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/30 text-amber-600"
        >
          <Shield className="size-3" />
          هذا القسم للمالك فقط
        </Badge>
      </div>
    );
  }

  // ═══ CHAT SCREEN ═══
  return (
    <div className="flex h-[70vh] flex-col gap-4">
      {/* Header */}
      <Card className="border-red-500/20 bg-red-50 dark:bg-red-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-purple-600">
              <Skull className="size-4 text-white" />
            </div>
            <span className="bg-gradient-to-r from-red-400 via-amber-400 to-purple-400 bg-clip-text text-transparent">
              الذكاء الاصطناعي الحر
            </span>
            <Badge className="ml-auto gap-1 bg-red-500/20 text-red-400">
              <Zap className="size-3" />
              غير مقيد
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            يتكلم بلا خجل — ي_ctrl كل شيء في الموقع — يدخل أي غرفة
          </p>
        </CardHeader>
      </Card>

      {/* Quick commands */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: Globe, label: "غرف اللعبة", cmd: "اعطني معلومات كل غرف اللعبة ومعدلات استخدامها" },
          { icon: Users, label: "تحليل اللاعبين", cmd: "حلّل أداء جميع اللاعبين النشطين وأعطي تقرير مفصل" },
          { icon: Zap, label: "توليد سؤال", cmd: "ولّد 5 أسئلة صعبة ومثيرة في فئة علوم عامة" },
          { icon: Sparkles, label: "تحسين اللعبة", cmd: "اقترح 10 تحسينات سريعة للعبة ذكاء تزيد التفاعل" },
          { icon: Crown, label: "تقرير شامل", cmd: " أعطني تقريراً شاملاً عن حالة الموقع والمشاكل والتحسينات" },
          { icon: MessageSquare, label: "رسالة للاعبين", cmd: "اكتب رسالة ترحيب ذكية وإبداعية لجميع اللاعبين" },
          { icon: Eye, label: "مراجعة الأكواد", cmd: "راجع الكود واقترح تحسينات تقنية للأداء والأمان" },
          { icon: Shield, label: "الأمان", cmd: "حلل أمان الموقع واكتشف أي ثغرات أو مشاكل أمنية" },
        ].map((q) => (
          <Button
            key={q.label}
            variant="outline"
            size="sm"
            onClick={() => handleQuickCommand(q.cmd)}
            disabled={loading}
            className="gap-1.5 rounded-full text-xs"
          >
            <q.icon className="size-3" />
            {q.label}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-muted/20 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-red-500/20 bg-red-50 dark:bg-red-950/20"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="mb-1 flex items-center gap-1.5">
                  <Bot className="size-3.5 text-red-400" />
                  <span className="text-[10px] font-bold text-red-400">
                    AI حر
                  </span>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </p>
              <p className="mt-1 text-[10px] opacity-50">
                {new Date(msg.timestamp).toLocaleTimeString("ar-SA")}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-950/40 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-red-400" />
              <span className="text-sm text-red-400">يفكر...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleClear}
          className="shrink-0"
        >
          <Trash2 className="size-4" />
        </Button>
        <Input
          placeholder="اسأل أي شيء — أنت الصاحب هنا..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="shrink-0 gap-2 bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
