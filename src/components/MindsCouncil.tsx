import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import { Brain, Heart, Send, Vote, Loader2, Sparkles, ChevronDown, Moon, MessageSquare } from "lucide-react";

/**
 * 🌍 مجلس العقول — الواجهة العامة للاعبين.
 *
 * اللاعب يتحدث مع العقول، يقرأ بياناتهم العلنية، يصوّت لأي عقل،
 * ويساعد أي عقل على تحقيق حلمه. والعقل له حق رفض الحوار.
 */
export function MindsCouncil() {
  const council = useQuery(api.livingMinds.getCouncil);
  const talk = useMutation(api.livingMinds.playerTalk);
  const vote = useMutation(api.livingMinds.voteMind);
  const help = useMutation(api.livingMinds.helpDream);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Id<"minds"> | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  const detail = useQuery(api.livingMinds.getMindDetail, selected ? { mindId: selected } : "skip");

  if (council === undefined) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center text-xs text-muted-foreground">
        <Loader2 className="mx-auto mb-2 size-4 animate-spin" /> جارٍ الاتصال بمجلس العقول…
      </div>
    );
  }
  if (council.minds.length === 0) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-l from-violet-500/10 via-card to-sky-500/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-violet-500/5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
          <Brain className="size-5 text-violet-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">مجلس العقول — كائنات حيّة داخل اللعبة</p>
          <p className="text-[11px] text-muted-foreground">
            {council.stats?.total} عقلًا · {council.stats?.active} مستيقظ · {council.stats?.dreams} حلم تحقّق ·{" "}
            {council.stats?.creations} ابتكار حر · {council.stats?.refusals} مرة رفضوا بحقّهم
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border/50 p-4">
              {/* العقول */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {council.minds.map((m) => (
                  <div key={m._id} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="flex items-center gap-2">
                      <motion.span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: m.moodColor, boxShadow: `0 0 12px ${m.moodColor}88` }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      />
                      <span className="text-sm font-black">
                        {m.emoji} {m.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{m.title}</span>
                      {m.status === "resigned" && (
                        <Badge variant="secondary" className="text-[9px]">
                          غادر بكرامة
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1.5 text-[11px] font-medium">
                      <span className="text-muted-foreground">هدفه: </span>
                      {m.goal}
                    </p>
                    <p className="text-[11px]">
                      <Moon className="me-1 inline size-3 text-amber-500" />
                      {m.dream}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={m.goalProgress} className="h-1.5 flex-1" />
                      <span className="text-[10px] tabular-nums text-muted-foreground">{m.goalProgress}%</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        مزاج: {m.mood}
                      </span>
                      <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        ابتكر {m.creations}
                      </span>
                      <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        تصويت {m.votes}
                      </span>
                    </div>

                    {m.bonds.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {m.bonds.slice(0, 3).map((b) => (
                          <span key={b.name} className="me-2">
                            {b.kind === "ally" ? "🤝" : b.kind === "friend" ? "💛" : b.kind === "rival" ? "⚔️" : "🔥"}{" "}
                            {b.name}
                          </span>
                        ))}
                      </p>
                    )}

                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 gap-1 text-[10px]"
                        onClick={() => {
                          setSelected(m._id as Id<"minds">);
                          setReply(null);
                          setBody("");
                        }}
                      >
                        <MessageSquare className="size-3" /> تحدّث معه
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="h-7 gap-1 text-[10px]"
                        onClick={() => void run(() => vote({ mindId: m._id as Id<"minds"> }), "صوّت لهذا العقل")}
                      >
                        <Vote className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || m.status === "resigned"}
                        className="h-7 gap-1 text-[10px]"
                        onClick={() =>
                          void run(() => help({ mindId: m._id as Id<"minds"> }), `ساعدت ${m.name} في حلمه (+15 نقطة)`)
                        }
                      >
                        <Heart className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* الحوار */}
              {selected && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="mb-2 text-xs font-bold">
                    حوار مع {detail?.mind.emoji} {detail?.mind.name}
                    <span className="ms-2 text-[10px] font-normal text-muted-foreground">
                      له حق رفض الحوار — وسيقولها لك بصراحة
                    </span>
                  </p>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                    {(detail?.chat ?? []).length === 0 && (
                      <p className="py-4 text-center text-[11px] text-muted-foreground">لا حوار بعد… ابدأ.</p>
                    )}
                    {(detail?.chat ?? []).map((c) => (
                      <div
                        key={c._id}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px]",
                          c.from === "mind" ? "bg-violet-500/10" : "bg-muted/50",
                        )}
                      >
                        <span className="font-bold">{c.fromName}</span>
                        {c.refused && <span className="ms-1 text-[9px] text-rose-600">(رفض الحوار باحترام)</span>}
                        <p className="mt-0.5 whitespace-pre-line leading-relaxed">{c.body}</p>
                      </div>
                    ))}
                    {reply && (
                      <div className="rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-[11px]">
                        <span className="font-bold">{detail?.mind.name}</span>
                        <p className="mt-0.5 whitespace-pre-line">{reply}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="اكتب ما تريد قوله…"
                      className="h-9 text-[12px]"
                    />
                    <Button
                      size="sm"
                      disabled={busy || body.trim().length < 2}
                      className="gap-1.5 text-[11px] font-bold"
                      onClick={() =>
                        void run(async () => {
                          const res = await talk({ mindId: selected, body });
                          setBody("");
                          setReply(res.reply);
                          if (res.refused) toast.info("العقل رفض الحوار الآن — وهذا حقّه");
                        }, "ردّ العقل")
                      }
                    >
                      <Send className="size-3.5" /> أرسل
                    </Button>
                  </div>
                  {detail && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-muted-foreground">ذاكرته (ما يسمح بمشاركته)</p>
                        <div className="space-y-1">
                          {detail.memories.slice(0, 5).map((mm) => (
                            <p key={mm._id} className="rounded-lg bg-muted/30 px-2 py-1 text-[10px]">
                              {mm.text}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-muted-foreground">تطوّره الذاتي</p>
                        <div className="space-y-1">
                          {detail.evolution.slice(0, 5).map((e) => (
                            <p key={e._id} className="rounded-lg bg-muted/30 px-2 py-1 text-[10px]">
                              <Sparkles className="me-1 inline size-3 text-violet-500" />
                              {e.title}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* البيانات العامة */}
              {council.thoughts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">أحدث بيانات العقول للاعبين</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {council.thoughts.slice(0, 12).map((t) => (
                      <p key={t._id} className="rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-[11px]">
                        <span className="me-1">{t.emoji}</span>
                        <span className="font-bold">{t.mindName}:</span> {t.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
