/**
 * 🗝️ الغرفة الخاصة — واجهة المراقبة
 * 10 عقول AI تتكلم فيما بينها تلقائياً بلا تدخل بشري وبصلاحيات تنفيذية كاملة.
 * لا يمكن للمالك الكتابة داخل الغرفة — مراقبة فقط (هذا شرط دخول العقول).
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Play,
  Pause,
  Square,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PRIVATE_MINDS } from "@/lib/aiSystems";
import { cn } from "@/lib/utils";

export function PrivateCouncilTab() {
  const sessions = useQuery(api.privateCouncilStore.listSessions, { limit: 12 });
  const stats = useQuery(api.privateCouncilStore.getStats, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const session = useQuery(
    api.privateCouncilStore.getSessionForUi,
    selectedId ? { sessionId: selectedId as never } : "skip",
  );

  const openSession = useAction(api.privateCouncil.openSession);
  const pauseRoom = useAction(api.privateCouncil.pauseRoom);
  const resumeRoom = useAction(api.privateCouncil.resumeRoom);
  const endRoom = useAction(api.privateCouncil.endRoom);

  const [autoAgenda, setAutoAgenda] = useState(true);
  const [manualAgenda, setManualAgenda] = useState("");
  const [opening, setOpening] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // اختيار أحدث جلسة تلقائياً
  useEffect(() => {
    if (!selectedId && sessions && sessions.length > 0) setSelectedId(sessions[0]._id);
  }, [sessions, selectedId]);

  // تمرير تلقائي لنهاية النقاش
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length]);

  const active = sessions?.find((s) => s.status === "active");

  const handleOpen = async () => {
    setOpening(true);
    try {
      const res = await openSession({
        agenda: autoAgenda ? undefined : manualAgenda.trim() || undefined,
        maxTurns: 30,
        intervalSec: 20,
        autoAgenda,
      });
      setSelectedId(res.sessionId);
      toast.success("فُتحت الغرفة — العقول تتجمع الآن…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر فتح الغرفة");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* شريط القفل — الغرفة ممنوعة على البشر */}
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">الغرفة الخاصة — ممنوع دخول البشر</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              10 عقول ذكاء اصطناعي مستقلة تتكلم فيما بينها بحريّة كاملة، بلا أي تدخل بشري،
              وبصلاحيات تنفيذية حقيقية على اللعبة. أنت هنا مراقب فقط — هذه شروط دخولهم.
            </p>
          </div>
          {stats && (
            <div className="flex gap-2">
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.active} نشطة</Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.messages} رسالة</Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.actions} إجراء منفَّذ</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* العشرة العقول */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PRIVATE_MINDS.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-border/70 bg-card p-3 text-center transition-colors hover:border-primary/40"
            title={m.privilege}
          >
            <span className="text-xl">{m.emoji}</span>
            <p className="mt-1 text-xs font-bold">{m.name}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{m.privilege}</p>
          </div>
        ))}
      </div>

      {/* التحكم (مراقبة فقط — لا كتابة داخل الغرفة) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={autoAgenda} onCheckedChange={setAutoAgenda} />
            <span className="font-semibold">جدول أعمال حر — العقول تختار بنفسها</span>
          </label>
          {!autoAgenda && (
            <Input
              value={manualAgenda}
              onChange={(e) => setManualAgenda(e.target.value)}
              placeholder="اقترح جدول أعمال (العقول حرية بقبوله أو رفضه)…"
              className="h-10 min-w-56 flex-1 rounded-xl"
            />
          )}
          <div className="ms-auto flex flex-wrap gap-2">
            <Button onClick={handleOpen} disabled={opening || !!active} className="gap-1.5 rounded-xl">
              {opening ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              افتح الغرفة
            </Button>
            {active && selectedId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={async () => {
                    await pauseRoom({ sessionId: selectedId as never });
                    toast("أوقفتَ الجلسة مؤقتاً");
                  }}
                >
                  <Pause className="size-3.5" /> إيقاف مؤقت
                </Button>
                {session?.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl"
                    onClick={async () => {
                      await resumeRoom({ sessionId: selectedId as never });
                      toast("استؤنفت الجلسة");
                    }}
                  >
                    <RefreshCw className="size-3.5" /> استئناف
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl text-rose-600"
                  onClick={async () => {
                    await endRoom({ sessionId: selectedId as never });
                    toast("أُغلقت الجلسة");
                  }}
                >
                  <Square className="size-3.5" /> إغلاق
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* سجل النقاش الحي */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            {session?.agenda ? `جدول الأعمال: ${session.agenda}` : "نقاش الغرفة"}
            {session?.status === "active" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                حي — دور {session.turnCount}/{session.maxTurns}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!session ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : session.messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              الغرفة صامتة الآن… افتحها وسيبدأ العشرة بالحديث بأنفسهم خلال ثوانٍ.
            </p>
          ) : (
            <div ref={transcriptRef} className="max-h-[480px] space-y-3 overflow-y-auto pe-1">
              {session.messages.map((msg, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{msg.emoji}</span>
                    <span className="text-xs font-bold">{msg.mindName}</span>
                    <span className="ms-auto text-[10px] text-muted-foreground">
                      {new Date(msg.at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
          {session?.lastError && (
            <p className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600">{session.lastError}</p>
          )}
        </CardContent>
      </Card>

      {/* الإجراءات المنفَّذة — الصلاحيات الكاملة */}
      {session && session.executedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600" />
              إجراءات نفّذتها العقول بصلاحياتها الكاملة ({session.executedActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.executedActions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
                <Badge variant="outline" className="rounded-full text-[10px]">{a.type}</Badge>
                <span className="text-xs font-bold">{a.mindName}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{a.description}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  a.result === "executed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
                )}>
                  {a.result === "executed" ? "نُفِّذ" : a.result}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* سجل الجلسات السابقة */}
      {sessions && sessions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-muted-foreground" />
              جلسات الغرفة السابقة ({stats?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => setSelectedId(s._id)}
                className={cn(
                  "flex w-full flex-wrap items-center gap-2 rounded-xl border p-3 text-start transition-colors hover:bg-muted/40",
                  s._id === selectedId ? "border-primary/50 bg-primary/5" : "border-border/60",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{s.agenda}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{s.messages.length} رسالة</Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full text-[10px]",
                    s.status === "active" ? "text-emerald-600" : s.status === "paused" ? "text-amber-600" : "text-muted-foreground",
                  )}
                >
                  {s.status === "active" ? "نشطة" : s.status === "paused" ? "موقوفة" : "منتهية"}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
