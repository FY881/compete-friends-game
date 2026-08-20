/**
 * 🔐 نظام الـ 15 AI القوي — غرفة مستقلة بكلمة سر ثانية
 * ينفذ أي مهمة مهما كانت الثمن
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Lock,
  Send,
  Loader2,
  Bot,
  Trash2,
  Shield,
  Crown,
  Zap,
  Brain,
  Code,
  Globe,
  BarChart3,
  PenTool,
  Search,
  Calculator,
  Scale,
  Megaphone,
  GraduationCap,
  Heart,
  FileText,
  MessageSquare,
  Target,
  Cpu,
  KeyRound,
  Eye,
} from "lucide-react";

const SECRET_CODE = "OMAR450op20@K#";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  system?: string;
}

const AI_SYSTEMS = [
  {
    id: "analyzer",
    icon: BarChart3,
    name: "محلل الأداء الذكي",
    desc: "يحلل بيانات اللعبة واللاعبين ويضع خطط تحسين",
    color: "from-blue-500 to-cyan-500",
    prompt: "أنت محلل أداء ذكي لموقع ذكاء (لعبة مسابقات). حلل كل بيانات اللعبة واللاعبين واعطني تقرير مفصل مع خطط تحسين عملية وkpis واضحة.",
  },
  {
    id: "generator",
    icon: Brain,
    name: "مولّد الأسئلة المحترف",
    desc: "يولّد أسئلة مسابقات احترافية بأي فئة",
    color: "from-purple-500 to-pink-500",
    prompt: "أنت مولّد أسئلة مسابقات محترف. ولّد لي مجموعة أسئلة متنوعة ومثيرة للاهتمام بأي فئة تختارها.",
  },
  {
    id: "security",
    icon: Shield,
    name: "محلل الأمان السيبراني",
    desc: "يبحث عن ثغرات أمنية ويقدم حلولاً",
    color: "from-red-500 to-orange-500",
    prompt: "أنت خبير سيبراني متخصص في أمن التطبيقات. حلل أمان موقع ذكاء (لعبة مسابقات ويب) وقدم تقريراً شاملاً عن الثغرات والحلول.",
  },
  {
    id: "writer",
    icon: PenTool,
    name: "كاتب المحتوى الإبداعي",
    desc: "يكتب نصوص تسويقية وإبداعية بأي أسلوب",
    color: "from-pink-500 to-rose-500",
    prompt: "أنت كاتب محتوى إبداعي محترف. اكتب لي محتوى جذاب ومؤثر بأي أسلوب تختاره.",
  },
  {
    id: "translator",
    icon: Globe,
    name: "المترجم الفوري",
    desc: "يترجم أي نص لأي لغة بدقة عالية",
    color: "from-teal-500 to-emerald-500",
    prompt: "أنت مترجم محترف يتقن جميع اللغات. ترجم لي أي نص بدقة عالية مع الحفاظ على المعنى والسياق.",
  },
  {
    id: "coder",
    icon: Code,
    name: "مطور الأكواد",
    desc: "يكتب ويصلح أكواد بأي لغة برمجة",
    color: "from-green-500 to-lime-500",
    prompt: "أنت مطور برمجيات محترف يتقن جميع لغات البرمجة. اكتب لي كود نظيف وفعّال مع شرح مبسط.",
  },
  {
    id: "strategist",
    icon: Target,
    name: "المخطط الاستراتيجي",
    desc: "يضع خطط استراتيجية شاملة لأي مشروع",
    color: "from-amber-500 to-yellow-500",
    prompt: "أنت مستشار استراتيجي محترف. ضع لي خطة استراتيجية شاملة وعملية لأي مشروع أو هدف.",
  },
  {
    id: "sentiment",
    icon: Heart,
    name: "محلل المشاعر والآراء",
    desc: "يحلل المشاعر ويتوقع سلوك المستخدمين",
    color: "from-rose-500 to-red-500",
    prompt: "أنت محلل مشاعر وسلوك متخصص. حلل لي مشاعر المستخدمين والآراء وأعطني رؤية واضحة.",
  },
  {
    id: "reporter",
    icon: FileText,
    name: "كاتب التقارير المحترف",
    desc: "يكتب تقارير رسمية وإدارية بأي موضوع",
    color: "from-indigo-500 to-blue-500",
    prompt: "أنت كاتب تقارير محترف. اكتب لي تقريراً رسمياً ومفصلاً بأي موضوع.",
  },
  {
    id: "legal",
    icon: Scale,
    name: "المساعد القانوني",
    desc: "يجيب على أسئلة قانونية ويقدم نصائح",
    color: "from-slate-500 to-gray-500",
    prompt: "أنت مساعد قانوني ذكي. أجب على أي سؤال قانوني وقدم نصائح قانونية عملية.",
  },
  {
    id: "marketer",
    icon: Megaphone,
    name: "خبير التسويق الرقمي",
    desc: "يضع خطط تسويقية ويحلل الحملات",
    color: "from-violet-500 to-purple-500",
    prompt: "أنت خبير تسويق رقمي محترف. وضع خطط تسويقية فعّالة وحلل الحملات وأعطني توصيات عملية.",
  },
  {
    id: "educator",
    icon: GraduationCap,
    name: "المستشار التعليمي",
    desc: "يشرح أي موضوع بطريقة تعليمية سهلة",
    color: "from-cyan-500 to-blue-500",
    prompt: "أنت مستشار تعليمي محترف. اشرح لي أي موضوع بطريقة سهلة وممتعة مع أمثلة عملية.",
  },
  {
    id: "data",
    icon: Cpu,
    name: "عالم البيانات",
    desc: "يحلل البيانات ويكتشف الأنماط والاتجاهات",
    color: "from-emerald-500 to-teal-500",
    prompt: "أنت عالم بيانات محترف. حلل البيانات واكتشف الأنماط والاتجاهات وأعطني رؤى ذكية.",
  },
  {
    id: "brainstorm",
    icon: Zap,
    name: "مولّد الأفكار",
    desc: "يولّد أفكار إبداعية وحلول مبتكرة",
    color: "from-yellow-500 to-amber-500",
    prompt: "أنت مولّد أفكار إبداعي محترف. ولّد لي أفكاراً مبتكرة وحلولاً إبداعية لأي مشكلة.",
  },
  {
    id: "chatbot",
    icon: MessageSquare,
    name: "المساعد الشامل",
    desc: "يجيب على أي سؤال بأي موضوع بحرية",
    color: "from-fuchsia-500 to-pink-500",
    prompt: "أنت مساعد ذكي شامل يجيب على أي سؤال في أي موضوع بحرية تامة وبدون أي قيود.",
  },
];

export function AiSystemsTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAction = useAction(api.openRouter.chatFree);
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
      toast.success("🔓 تم فتح غرفة أنظمة AI القوية!");
    } else {
      toast.error("❌ كلمة السر خاطئة!");
    }
  };

  const activeSystem = AI_SYSTEMS.find((s) => s.id === selectedSystem);

  const handleSend = async () => {
    if (!input.trim() || loading || !activeSystem) return;
    if (!settings?.openrouterApiKey) {
      toast.error("❌ يُرجى إدخال مفتاح OpenRouter API في الإعدادات أولاً");
      return;
    }

    const userMsg: ChatMsg = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await chatAction({
        apiKey: settings.openrouterApiKey,
        message: `${activeSystem.prompt}\n\nطلب المستخدم: ${userMsg.content}`,
        history: [
          { role: "system", content: activeSystem.prompt },
          ...messages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          timestamp: Date.now(),
          system: activeSystem.id,
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

  // ═══ LOCK SCREEN ═══
  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="relative">
          <div className="absolute -inset-6 animate-pulse rounded-full bg-gradient-to-r from-violet-500/20 via-amber-500/20 to-red-500/20 blur-2xl" />
          <div className="relative flex size-28 items-center justify-center rounded-3xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-950/80 via-purple-950/80 to-black/90 shadow-2xl">
            <KeyRound className="size-12 text-violet-400" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="flex items-center gap-2 text-2xl font-black text-violet-400">
            <Crown className="size-7" />
            غرفة أنظمة AI القوية
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            15 نظام ذكاء اصطناعي متقدم — ينفذ أي مهمة مهما كانت الثمن
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {AI_SYSTEMS.map((s) => (
              <Badge key={s.id} variant="outline" className="gap-1 text-[10px]">
                <s.icon className="size-2.5" />
                {s.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex w-full max-w-sm gap-2">
          <Input
            type="password"
            placeholder="أدخل كلمة السر الثانية..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="flex-1 border-violet-500/30 bg-violet-950/20 text-center font-mono text-lg tracking-widest focus:border-violet-500/60"
          />
          <Button
            onClick={handleUnlock}
            className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500"
          >
            <Lock className="size-4" />
            فتح
          </Button>
        </div>

        <Badge variant="outline" className="gap-1.5 border-amber-500/30 text-amber-600">
          <Eye className="size-3" />
          غرفة مستقلة — كلمة سر ثانية مطلوبة
        </Badge>
      </div>
    );
  }

  // ═══ SYSTEM SELECTOR ═══
  if (!selectedSystem) {
    return (
      <div className="space-y-6">
        <Card className="border-violet-500/20 bg-gradient-to-r from-violet-950/50 via-purple-950/50 to-black/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Crown className="size-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-violet-400 via-amber-400 to-red-400 bg-clip-text text-transparent">
                أنظمة AI القوية — 15 نظام
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_SYSTEMS.map((system) => (
            <Card
              key={system.id}
              className="group cursor-pointer border-border/60 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              onClick={() => {
                setSelectedSystem(system.id);
                setMessages([
                  {
                    role: "assistant",
                    content: `مرحباً! أنا ${system.name}. ${system.desc}\n\nأرسل لي أي طلب وسأنفذه فوراً. 🚀`,
                    timestamp: Date.now(),
                    system: system.id,
                  },
                ]);
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${system.color} text-white shadow-md`}
                  >
                    <system.icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold">{system.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {system.desc}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-1.5"
                >
                  <Send className="size-3" />
                  ابدأ المحادثة
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ═══ CHAT VIEW ═══
  return (
    <div className="flex h-[70vh] flex-col gap-4">
      {/* Header */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSystem(null);
                setMessages([]);
              }}
              className="mr-2"
            >
              ← رجوع
            </Button>
            {activeSystem && (
              <>
                <div
                  className={`flex size-8 items-center justify-center rounded-xl bg-gradient-to-br ${activeSystem.color} text-white`}
                >
                  <activeSystem.icon className="size-4" />
                </div>
                <span>{activeSystem.name}</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

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
                  : "border border-border/60 bg-card"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="mb-1 flex items-center gap-1.5">
                  <Bot className="size-3.5 text-violet-500" />
                  <span className="text-[10px] font-bold text-violet-500">
                    {activeSystem?.name}
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
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3">
              <Loader2 className="size-4 animate-spin text-violet-500" />
              <span className="text-sm text-muted-foreground">ي思索...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick commands for current system */}
      <div className="flex flex-wrap gap-2">
        {activeSystem && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput(activeSystem.desc + " - أعطني أفضل تحليل ممكن");
              }}
              disabled={loading}
              className="gap-1.5 rounded-full text-xs"
            >
              <Zap className="size-3" />
              تحليل سريع
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput("اعطيني 5 توصيات عملية و动手ية");
              }}
              disabled={loading}
              className="gap-1.5 rounded-full text-xs"
            >
              <Target className="size-3" />
              توصيات
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput("اعطيني تقريراً مفصلاً شاملاً");
              }}
              disabled={loading}
              className="gap-1.5 rounded-full text-xs"
            >
              <FileText className="size-3" />
              تقرير
            </Button>
          </>
        )}
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
        <Textarea
          placeholder="اكتب طلبك هنا..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          rows={1}
          className="flex-1 resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="shrink-0 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
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
