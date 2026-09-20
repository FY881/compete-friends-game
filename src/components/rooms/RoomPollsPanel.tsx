/**
 * 🗳️ استطلاعات الغرفة (v11.0) — نظام حقيقي داخل الغرفة الخاصة
 *
 * كل رقم هنا من الخادم: عدد الأصوات، النسب، حالتك، وهل انتهى الوقت.
 * وصوتك يُسجَّل مرة واحدة، وتغييره يستبدله (لا صوت مزدوج).
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BarChart3, Check, Loader2, Lock, Plus, Vote } from "lucide-react";

export function RoomPollsPanel({ roomId }: { roomId: string }) {
  const data = useQuery(api.roomPolls.getRoomPolls, { roomId: roomId as never });
  const create = useMutation(api.roomPolls.createRoomPoll);
  const vote = useMutation(api.roomPolls.voteRoomPoll);
  const close = useMutation(api.roomPolls.closeRoomPoll);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const [multi, setMulti] = useState(false);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState<string | null>(null);

  if (data === undefined) {
    return <p className="p-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>;
  }

  const doVote = async (pollId: string, choice: string, isMulti: boolean, current: string[]) => {
    const next = isMulti
      ? current.includes(choice)
        ? current.filter((c) => c !== choice)
        : [...current, choice]
      : [choice];
    if (next.length === 0) {
      toast.error("اختر خياراً واحداً على الأقل");
      return;
    }
    setBusy(pollId);
    try {
      const res = await vote({ pollId: pollId as never, choices: next });
      toast.success(res.changed ? "سُجّل صوتك" : "حُدّث صوتك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التصويت");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {data.canManage && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <BarChart3 className="size-3.5 text-primary" /> استطلاع جديد
          </p>
          <Input
            placeholder="السؤال (مثال: ما نمط الحرب المفضّل لديكم؟)"
            value={question}
            maxLength={140}
            onChange={(e) => setQuestion(e.target.value)}
            className="rounded-xl"
          />
          <Input
            placeholder="الخيارات مفصولة بفاصلة — خيار أول, خيار ثانٍ, خيار ثالث"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            className="rounded-xl"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              يسمح بأكثر من خيار
            </label>
            <label className="flex items-center gap-1.5">
              المدة (ساعات، ٠ = بلا انتهاء)
              <Input
                type="number"
                min={0}
                max={720}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="h-7 w-20 rounded-lg text-[11px]"
              />
            </label>
            <Button
              size="sm"
              className="ms-auto rounded-xl"
              disabled={busy === "create"}
              onClick={async () => {
                setBusy("create");
                try {
                  const res = await create({
                    roomId: roomId as never,
                    question,
                    options: options.split(",").map((s) => s.trim()).filter(Boolean),
                    multi,
                    hours,
                  });
                  toast.success(`أُنشئ الاستطلاع بـ ${res.options} خيارات`);
                  setQuestion("");
                  setOptions("");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              أنشئ
            </Button>
          </div>
        </div>
      )}

      {data.polls.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">لا استطلاعات في هذه الغرفة بعد.</p>}

      {data.polls.map((poll) => {
        const voted = poll.myChoices.length > 0;
        return (
          <div key={poll.id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold">{poll.question}</p>
                <p className="text-[10px] text-muted-foreground">
                  {poll.createdByName} · {poll.totalVotes} صوت · {poll.multi ? `اختيار متعدد (حتى ${poll.maxChoices})` : "اختيار واحد"} · {poll.remaining}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {voted && (
                  <Badge variant="outline" className="rounded-full border-emerald-500/40 text-[9px] text-emerald-700 dark:text-emerald-400">
                    صوّتت
                  </Badge>
                )}
                <Badge variant="outline" className={cn("rounded-full text-[9px]", poll.open ? "" : "text-muted-foreground")}>
                  {poll.open ? "مفتوح" : "مغلق"}
                </Badge>
                {data.canManage && poll.open && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 rounded-lg px-2 text-[10px]"
                    disabled={busy === poll.id}
                    onClick={async () => {
                      setBusy(poll.id);
                      try {
                        await close({ pollId: poll.id as never });
                        toast.success("أُغلق الاستطلاع");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر الإغلاق");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Lock className="size-3" /> إغلاق
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {poll.options.map((opt) => {
                const mine = poll.myChoices.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!poll.open}
                    onClick={() => void doVote(poll.id, opt.id, poll.multi, poll.myChoices)}
                    className={cn(
                      "relative flex w-full items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1.5 text-start text-[11px] transition-colors",
                      mine ? "border-primary/50" : "border-border/60",
                      poll.open ? "hover:border-primary/40" : "opacity-70",
                    )}
                  >
                    <span
                      className={cn("absolute inset-y-0 start-0 z-0", mine ? "bg-primary/15" : "bg-muted/40")}
                      style={{ width: `${opt.percent}%` }}
                    />
                    <span className="z-10 flex-1 font-semibold">
                      {mine && <Check className="me-1 inline size-3 text-primary" />}
                      {opt.label}
                    </span>
                    <span className="z-10 shrink-0 tabular-nums text-muted-foreground">
                      {opt.votes} · {opt.percent}%
                    </span>
                  </button>
                );
              })}
            </div>

            {poll.open ? (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Vote className="size-3" /> {voted ? "اضغط خياراً آخر لتغيير صوتك" : "اضغط خيارك للتصويت"}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">انتهى التصويت على هذا الاستطلاع — النتائج نهائية.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
