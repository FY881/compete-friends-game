/**
 * 👀 واجهة المشجع — شاهد المبارزة حياً وعلّق في دردشة المشجعين.
 * تُعرض تلقائياً لمن يزور غرفة مبارزة بدأت وهو ليس لاعباً فيها.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, Loader2, Send, Swords, Users } from "lucide-react";
import { CasterBar } from "./CasterBar";

const HEARTBEAT_MS = 30_000;

export function SpectatorStage({ code }: { code: string }) {
  const view = useQuery(api.spectate.getSpectatorView, { code });
  const chat = useQuery(api.spectate.getSpectatorChat, { code });
  const joinAsSpectator = useMutation(api.spectate.joinAsSpectator);
  const sendSpectatorMessage = useMutation(api.spectate.sendSpectatorMessage);
  const heartbeat = useMutation(api.spectate.heartbeat);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // انضم تلقائياً عند فتح الصفحة
  useEffect(() => {
    if (joined) return;
    joinAsSpectator({ code })
      .then(() => setJoined(true))
      .catch(() => setJoined(true)); // حتى لو فشل (غرفة منتهية) لا نكرر المحاولة
  }, [code, joined, joinAsSpectator]);

  // نبض الحضور كل 30 ثانية
  useEffect(() => {
    if (!joined) return;
    const t = setInterval(() => {
      heartbeat({ code }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [code, joined, heartbeat]);

  // تمرير الدردشة لأسفل تلقائياً
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.length]);

  if (view === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (view === null) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        المبارزة غير موجودة.
      </div>
    );
  }

  const currentQ = view.questions[view.questions.length - 1];
  const revealed = currentQ != null && currentQ.correctIndex !== null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await sendSpectatorMessage({ code, content });
      setMessage("");
    } catch {
      // تجاهل — الرسائل اختيارية
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 🎙️ بث المعلق الأسطوري — اللحظات تُروى أولاً بأول */}
      <CasterBar code={code} />

      {/* شريط المشاهدة */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/25 bg-gradient-to-l from-sky-500/10 to-transparent px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
          <Eye className="size-4" />
        </span>
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm font-bold">
            وضع المشجع — مبارزة حية
            {view.arenaDuel && (
              <Badge variant="secondary" className="rounded-full text-[10px]">
                <Swords className="size-2.5 me-1" /> حلبة
              </Badge>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3" />
            {view.spectatorCount} مشاهد الآن
            {view.spectatorNames.length > 0 && ` · ${view.spectatorNames.slice(0, 3).join("، ")}`}
          </p>
        </div>
        <Badge variant="outline" className="rounded-full font-mono text-xs">
          سؤال {Math.min(view.currentQuestionIndex + 1, view.questionCount)} / {view.questionCount}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* العمود الرئيسي: النتائج + السؤال المكشوف */}
        <div className="space-y-4">
          {/* لوحة النتائج الحية */}
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">النتائج الحية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {view.players.map((p, i) => (
                <div
                  key={p.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5",
                    i === 0 ? "bg-amber-500/10" : "bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 text-center font-mono text-sm font-bold",
                      i === 0 && "text-amber-500",
                      i === 1 && "text-zinc-400",
                      i === 2 && "text-orange-400",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  {p.answeredCurrent && view.status === "playing" && (
                    <Badge variant="secondary" className="rounded-full text-[9px]">
                      أجاب ✓
                    </Badge>
                  )}
                  {p.streak >= 3 && (
                    <Badge variant="outline" className="rounded-full text-[9px] text-orange-500">
                      🔥 {p.streak}
                    </Badge>
                  )}
                  <span className="font-mono text-lg font-bold tabular-nums">{p.score}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* السؤال الحالي — مكشوف بعد الكشف فقط */}
          {currentQ && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  السؤال {currentQ.index + 1}
                  {revealed && (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      كُشف
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-semibold leading-relaxed">{currentQ.question}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {currentQ.options.map((opt, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        revealed && i === currentQ.correctIndex
                          ? "border-emerald-500/40 bg-emerald-500/10 font-bold text-emerald-600"
                          : "border-border/60 bg-muted/30 text-muted-foreground",
                      )}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
                {!revealed && (
                  <p className="pt-1 text-center text-[11px] text-muted-foreground">
                    الإجابة الصحيحة تظهر بعد انتهاء الوقت…
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* دردشة المشجعين */}
        <Card className="flex flex-col border-border/80 shadow-sm lg:h-[480px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">💬 دردشة المشجعين</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="min-h-40 flex-1 space-y-1.5 overflow-y-auto pe-1">
              {chat?.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  كن أول من يشجّع! اكتب رسالتك…
                </p>
              )}
              {chat?.map((m) => (
                <div key={m.id} className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <p className="text-[10px] font-bold text-primary">{m.senderName}</p>
                  <p className="break-words text-xs leading-relaxed">{m.content}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSend} className="flex gap-1.5">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="شجّع هنا…"
                maxLength={200}
                className="h-9 rounded-xl text-xs"
              />
              <Button type="submit" size="icon" className="size-9 shrink-0 rounded-xl" disabled={sending || !message.trim()}>
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
