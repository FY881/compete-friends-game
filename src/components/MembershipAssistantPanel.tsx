/**
 * ═══════════════════════════════════════════════════════════════════════
 * 💎 «جيم» — مساعد العضويات الشخصي لكل لاعب (مساعدة نائب المالك)
 * لوحة محادثة تواجه العضو بنفسه: يسأل عن عضويتك ويرد عليك بالذكاء
 * الاصطناعي بناءً على بياناتك الحقيقية (المستوى، المدة، المزايا...).
 * ═══════════════════════════════════════════════════════════════════════
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import { Gem, Send, Loader2, Sparkles, ShieldCheck, KeyRound, Crown, Trash2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const QUICK_PROMPTS = [
  { icon: Gem, label: "ما مستوى عضويتي؟", text: "ما مستواي الحالي وماذا يفتح لي من مزايا؟" },
  { icon: Crown, label: "كيف أرقّي؟", text: "ما الفرق بين مستواي والمستوى التالي، وكيف أصل إليه؟" },
  { icon: KeyRound, label: "متى تنتهي عضويتي؟", text: "متى تنتهي عضويتي؟ وهل هناك أيام متبقية؟" },
  { icon: Sparkles, label: "مزاياي المفتوحة", text: "أي ألعاب حصرية ومزايا مفتوحة لديّ الآن؟" },
];

const WELCOME =
  "أهلاً بك 👋 أنا «جيم» 💎 — أمينة الخزينة وحارسة العضويات، ومن مساعدي نائب المالك.\n\n" +
  "أعرف عضويتك الحقيقية وأستطيع مساعدتك في أي سؤال:\n" +
  "• ما مستواك الحالي ومتى تنتهي عضويتك\n" +
  "• مزاياك المفتوحة والألعاب الحصرية المتاحة لك\n" +
  "• الفرق بين مستواك والمستوى التالي وكيف تصل إليه\n" +
  "• كيف تفعّل كود العضوية\n\n" +
  "اكتب سؤالك أو اختر أحد الأسئلة أدناه 👇";

export function MembershipAssistantPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME, timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chat = useAction(api.membershipAssistant.chat);
  const membership = useQuery(api.membershipSystem.getMyMembership);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: Date.now() }]);
    setInput("");
    setLoading(true);
    try {
      const result = await chat({ message: text });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, timestamp: Date.now() },
      ]);
      sounds.victory();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر الاتصال بجيم.";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}`, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([{ role: "assistant", content: WELCOME, timestamp: Date.now() }]);
    sounds.click();
  };

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.05] to-transparent">
      <CardContent className="space-y-3 p-4">
        {/* الرأس */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">
            💎
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              جيم — مساعد عضويتك
              <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">
                <ShieldCheck className="size-3" />
                من مساعدي نائب المالك
              </Badge>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              حارسة العضويات ترشدك بخصوص اشتراكك — كل رد مبني على عضويتك الحقيقية.
            </p>
          </div>
          {membership && (
            <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
              {membership.tierData?.emoji} {membership.tierData?.name}
            </Badge>
          )}
        </div>

        {/* أسئلة سريعة */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <Button
              key={q.label}
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-full text-[11px]"
              onClick={() => { sounds.click(); handleSend(q.text); }}
              disabled={loading}
            >
              <q.icon className="size-3" />
              {q.label}
            </Button>
          ))}
        </div>

        {/* الرسائل */}
        <div className="max-h-72 min-h-40 space-y-2.5 overflow-y-auto rounded-2xl border border-border/60 bg-background/60 p-3">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-emerald-500/20 bg-emerald-500/[0.06]",
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-xs">💎</span>
                      <span className="text-[10px] font-bold text-emerald-600">جيم</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                  <p className="mt-1 text-right text-[9px] opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
                <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                <span className="text-xs text-emerald-700">جيم تفكّر في عضويتك...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* الإدخال */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleClear}
            disabled={loading}
            title="مسح المحادثة"
          >
            <Trash2 className="size-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="اسأل جيم عن عضويتك... مثل: متى تنتهي عضويتي؟"
            disabled={loading}
            className="h-10 flex-1 rounded-xl text-xs"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="h-10 shrink-0 gap-1.5 rounded-xl"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            أرسل
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          أسئلة عن الحصول على عضويات أو أكواد جديدة تُجاب في غرفة المالك.
        </p>
      </CardContent>
    </Card>
  );
}