/**
 * AI Transparency Mode — الصراحة المطلقة
 * يتحدث مع المالك لتطوير اللعبة أكثر
 */
import { useState, useRef, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bot,
  Send,
  Loader2,
  Key,
  Eye,
  EyeOff,
  Lightbulb,
  TrendingUp,
  Shield,
  MessageCircle,
  Sparkles,
} from "lucide-react";

interface Message {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

const SUGGESTIONS = [
  "ما هي أبرز مشاكل اللعبة حالياً؟",
  "كيف أحسّن تجربة المستخدم؟",
  "اقترح أفكاراً لألعاب جديدة",
  "حلّل نقاط القوة والضعف في اللعبة",
  "كيف أزيد عدد اللاعبين النشطين؟",
  "ما هي الميزات الأكثر أهمية حالياً؟",
  "كيف أجعل اللعبة أكثر متعة؟",
  "اقترح تحسينات للنظام التعليمي",
];

export function AiTransparencyTab() {
  const settings = useQuery(api.owner.getSettings);
  const updateSettings = useMutation(api.owner.updateSettings);
  const apiKey = settings?.openrouterApiKey ?? "";
  const [localKey, setLocalKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "مرحباً! أنا ذكاء AI — مساعدك الشخصي لتطوير اللعبة.\n\nهذا وضع الصراحة المطلقة: أخبرني عن أي شيء تحتاجه لتطوير اللعبة. لا أخفي شيئاً عنك! 🌟",
      timestamp: new Date().toLocaleTimeString("ar"),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useAction(api.openRouter.aiTransparencyChat);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const saveKey = async () => {
    await updateSettings({ openrouterApiKey: localKey || apiKey });
    toast.success("تم حفظ مفتاح API");
  };

  const sendMessage = async (text: string) => {
    if (!apiKey) { toast.error("أدخل مفتاح API أولاً"); return; }
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("ar"),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await chat({
        apiKey,
        message: text,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
      });
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          content: res.reply,
          timestamp: new Date().toLocaleTimeString("ar"),
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "خطأ غير معروف";
      toast.error(msg);
      setMessages(prev => [
        ...prev,
        { role: "ai", content: `⚠️ عذراً، حدث خطأ: ${msg}`, timestamp: new Date().toLocaleTimeString("ar") },
      ]);
    } finally {
      setLoading(false);
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
            <div className="relative flex-1">                <Input
                  type={showKey ? "text" : "password"}
                  value={localKey || apiKey}
                  onChange={(e) => setLocalKey(e.target.value)}
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
              <Sparkles className="size-3.5" /> حفظ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <Lightbulb className="mx-auto size-5 text-emerald-500" />
            <p className="mt-2 text-xs font-bold">نصائح حقيقية</p>
            <p className="text-[10px] text-muted-foreground">نصائح مخصصة لتحسين اللعبة</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto size-5 text-primary" />
            <p className="mt-2 text-xs font-bold">تحليل عميق</p>
            <p className="text-[10px] text-muted-foreground">تحليل شامل لحالة اللعبة</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <Shield className="mx-auto size-5 text-amber-500" />
            <p className="mt-2 text-xs font-bold">صراحة مطلقة</p>
            <p className="text-[10px] text-muted-foreground">لا أخفي شيئاً عنك أبداً</p>
          </CardContent>
        </Card>
      </div>

      {/* Chat */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="size-4 text-primary" />
            محادثة مع ذكاء AI
            <Badge variant="outline" className="mr-auto text-[10px]">
              <Bot className="size-3" /> الصراحة المطلقة
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-80 space-y-3 overflow-auto rounded-2xl border border-border/40 bg-muted/20 p-4"
          >
            {messages.map((msg, i) => (
              <div
                key={`${i}-${msg.timestamp}`}
                className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-background border border-border/60 shadow-sm rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="mt-1 text-[9px] opacity-60">{msg.timestamp}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background px-4 py-2.5 shadow-sm rounded-bl-md">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">يفكر...</span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage(s)}
                disabled={loading || !apiKey}
                className="rounded-full border border-border/60 bg-background px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="اسأل عن أي شيء في تطوير اللعبة..."
              disabled={loading || !apiKey}
              className="rounded-xl"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !apiKey || !input.trim()}
              size="icon"
              className="shrink-0 rounded-xl"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
