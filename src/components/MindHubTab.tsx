/**
 * 🧬 ملتقى العقول — غرفتان ذاتيتان: الحرب (اللعبة) والعقل الحر (أي شيء)
 * 60 عقلاً يتكلمون فيما بينهم بلا تدخل بشري — واجهة مراقبة فقط.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  Swords,
  Globe2,
  Play,
  Pause,
  Square,
  RefreshCw,
  ScrollText,
  GraduationCap,
  BrainCircuit,
} from "lucide-react";
import { KeyRound } from "lucide-react";
import { PRIVATE_MINDS, EXTENDED_MINDS, HUB_MINDS } from "@/lib/aiSystems";
import { cn } from "@/lib/utils";

type Room = "war" | "free";

const ROOMS: Array<{ id: Room; name: string; desc: string; icon: typeof Swords; color: string }> = [
  {
    id: "war",
    name: "غرفة الحرب",
    desc: "إدارة لعبة حرب العقول — قرارات وتنفيذ حقيقي بصلاحيات كاملة",
    icon: Swords,
    color: "text-rose-600",
  },
  {
    id: "free",
    name: "غرفة العقل الحر",
    desc: "أي شيء غير اللعبة — فلسفة، علوم، فن، ثقافة، كون، حياة",
    icon: Globe2,
    color: "text-sky-600",
  },
];

export function MindHubTab() {
  const sessions = useQuery(api.mindHubStore.listSessions, { limit: 30 });
  const stats = useQuery(api.mindHubStore.getStats, {});
  const pending = useQuery(api.mindHubStore.getPendingOwnerDecisions, {});
  const [room, setRoom] = useState<Room>("war");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decipherMode, setDecipherMode] = useState(false);
  const session = useQuery(
    // وضع فك الشفرة: للمالك فقط — يقرأ الرسائل المشفرة بلغتها الأصلية
    decipherMode ? api.mindHubStore.getDecipheredSession : api.mindHubStore.getSessionForUi,
    selectedId ? { sessionId: selectedId as never } : "skip",
  );

  const openSession = useAction(api.mindHub.openSession);
  const pauseSession = useAction(api.mindHub.pauseSession);
  const resumeSession = useAction(api.mindHub.resumeSession);
  const endSession = useAction(api.mindHub.endSession);

  const [autoAgenda, setAutoAgenda] = useState(true);
  const [opening, setOpening] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const roomSessions = sessions?.filter((s) => s.room === room) ?? [];
  const active = roomSessions.find((s) => s.status === "active");

  useEffect(() => {
    if (!selectedId && roomSessions.length > 0) setSelectedId(roomSessions[0]._id);
  }, [roomSessions, selectedId]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const res = await openSession({ room, maxTurns: 40, intervalSec: 18, autoAgenda });
      setSelectedId(res.sessionId);
      toast.success("فُتحت الجلسة — العقول تتجمع الآن…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر فتح الجلسة");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* شريط القفل والإحصائيات */}
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">ملتقى العقول — {PRIVATE_MINDS.length + EXTENDED_MINDS.length + HUB_MINDS.length} عقلاً</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              ذكاء عالٍ، تفكير غير محدود، تشغيل ذاتي دائم، تعلّم ذاتي من كل جلسة،
              وصلاحيات تنفيذية كاملة — والقرارات المهمة تُرفع لك كاقتراح.
            </p>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.active} نشطة</Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">{stats.messages} رسالة</Badge>
              <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">{stats.executed} منفَّذ</Badge>
              {stats.pendingOwner > 0 && (
                <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">{stats.pendingOwner} بانتظارك</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* اختيار الغرفة */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ROOMS.map((r) => {
          const Icon = r.icon;
          const selected = room === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRoom(r.id);
                setSelectedId(null);
              }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-start transition-all",
                selected ? "border-primary/60 bg-primary/5" : "border-border/70 bg-card hover:border-primary/30",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted", r.color)}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{r.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
              </div>
              {selected && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* العقول */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {[...PRIVATE_MINDS, ...EXTENDED_MINDS, ...HUB_MINDS].map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border/60 bg-card p-2 text-center"
            title={`${m.desc} — ${m.privilege}`}
          >
            <span className="text-base">{m.emoji}</span>
            <p className="mt-0.5 truncate text-[9px] font-semibold">{m.name}</p>
          </div>
        ))}
      </div>

      {/* التحكم */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={autoAgenda} onCheckedChange={setAutoAgenda} />
            <span className="font-semibold">موضوع حر — العقول تختار</span>
          </label>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button onClick={handleOpen} disabled={opening || !!active} className="gap-1.5 rounded-xl">
              {opening ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              افتح جلسة {room === "war" ? "الحرب" : "الحرة"}
            </Button>
            {active && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={async () => {
                    await pauseSession({ sessionId: active._id as never });
                    toast("أوقفتَ الجلسة مؤقتاً");
                  }}
                >
                  <Pause className="size-3.5" /> إيقاف
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl text-rose-600"
                  onClick={async () => {
                    await endSession({ sessionId: active._id as never });
                    toast("أُغلقت الجلسة — ستفتح الجلسة التالية تلقائياً");
                  }}
                >
                  <Square className="size-3.5" /> إغلاق
                </Button>
              </>
            )}
            {session?.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={async () => {
                  await resumeSession({ sessionId: session._id as never });
                  toast("استؤنفت الجلسة");
                }}
              >
                <RefreshCw className="size-3.5" /> استئناف
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* القرارات المهمة بانتظار المالك */}
      {pending && pending.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-600">
              <Lock className="size-4" />
              قرارات مهمة رفعوها لك ({pending.length}) — رأيك مهم لكن نقاشهم لا يتوقف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.slice(0, 8).map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
                <Badge variant="outline" className="rounded-full text-[10px]">{d.room === "war" ? "الحرب" : "الحرة"}</Badge>
                <span className="text-xs font-bold">{d.mindName}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{d.description}</span>
                <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">بانتظارك</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* النقاش الحي */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {session?.agenda ?? "نقاش الغرفة"}
            {session?.status === "active" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                حي — دور {session.turnCount}/{session.maxTurns}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={decipherMode} onCheckedChange={setDecipherMode} />
            <KeyRound className="size-3.5 text-amber-600" />
            فك اللهجة المشفرة (عين المالك فقط)
          </label>
          {!session ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : session.messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              الغرفة صامتة الآن… افتح جلسة وسيبدأ العقل بالحديث خلال ثوانٍ.
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
          {session?.lessons && session.lessons.length > 0 && (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-sky-600">
                <GraduationCap className="size-3.5" /> ما تعلموه من هذه الجلسة
              </p>
              <ul className="mt-1.5 space-y-1">
                {session.lessons.map((l, i) => (
                  <li key={i} className="text-xs leading-relaxed text-muted-foreground">- {l}</li>
                ))}
              </ul>
            </div>
          )}
          {session?.lastError && (
            <p className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600">{session.lastError}</p>
          )}
        </CardContent>
      </Card>

      {/* الإجراءات المنفَّذة */}
      {session && session.executedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">إجراءات نفّذتها العقول ({session.executedActions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.executedActions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
                <Badge variant="outline" className="rounded-full text-[10px]">{a.type}</Badge>
                <span className="text-xs font-bold">{a.mindName}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{a.description}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    a.result === "executed"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : a.result === "pending-owner"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {a.result === "executed" ? "نُفِّذ" : a.result === "pending-owner" ? "بانتظارك" : a.result}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* سجل الجلسات */}
      {roomSessions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-muted-foreground" />
              جلسات {room === "war" ? "غرفة الحرب" : "غرفة العقل الحر"} السابقة ({roomSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roomSessions.map((s) => (
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
                {s.lessons && s.lessons.length > 0 && (
                  <Badge variant="outline" className="rounded-full text-[10px] text-sky-600">{s.lessons.length} دروس</Badge>
                )}
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
