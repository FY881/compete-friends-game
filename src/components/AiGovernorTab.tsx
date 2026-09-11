import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Check, X, Ban, Loader2, ShieldCheck, Brain, Radio,
} from "lucide-react";

/**
 * 🤖 الحاكم الآلي — 50 مساعداً بسيطرة شبه ذاتية
 * الأعمال الآمنة تُنفَّذ ذاتياً — الخطيرة تُرسَل هنا كطلب مع دردشة نقاش
 * وأزرار قبول/رفض، مع إمكانية المنع الدائم للموضوع.
 */

const DEPT_STYLE: Record<string, string> = {
  "الأمن": "bg-rose-500/10 text-rose-600",
  "المحتوى": "bg-amber-500/10 text-amber-600",
  "الاقتصاد": "bg-emerald-500/10 text-emerald-600",
  "المجتمع": "bg-sky-500/10 text-sky-600",
  "العمليات": "bg-violet-500/10 text-violet-600",
};

/** دردشة نقاش طلب محدد */
function RequestChat({ requestId }: { requestId: string }) {
  const chat = useQuery(api.aiGovernor.getRequestChat, { requestId: requestId as never });
  if (!chat) {
    return (
      <div className="mt-4 flex justify-center rounded-xl border border-border/60 bg-background py-6">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-background p-3">
      {chat.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">افتح النقاش بمراسلة المساعد…</p>
      )}
      {chat.map((m) => (
        <div
          key={m._id}
          className={cn(
            "rounded-xl px-3 py-2 text-sm leading-relaxed",
            m.from === "agent" ? "bg-violet-500/10 text-violet-900 dark:text-violet-200" : "bg-primary/10 text-primary",
          )}
        >
          <span className="mb-0.5 block text-[10px] font-bold opacity-70">
            {m.from === "agent" ? `🤖 ${m.agentName ?? "المساعد"}` : "👑 أنت"}
          </span>
          {m.body}
        </div>
      ))}
    </div>
  );
}

export function AiGovernorTab() {
  const overview = useQuery(api.aiGovernor.getGovernorOverview, {});
  const actions = useQuery(api.aiGovernor.getRecentActions, { limit: 30 });
  const ownerReply = useMutation(api.aiGovernor.ownerReply);
  const decide = useMutation(api.aiGovernor.decideRequest);
  const dispatchTask = useMutation(api.aiGovernor.dispatchTask);

  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [task, setTask] = useState("");

  if (!overview) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeRequest = overview.pendingRequests[0];

  const handleDecide = async (approve: boolean, forbidForever = false) => {
    if (!activeRequest) return;
    setBusy(approve ? "approve" : "reject");
    try {
      await decide({ requestId: activeRequest._id, approve, forbidForever });
      toast.success(approve ? "✅ تمت الموافقة والتنفيذ" : "❌ تم الرفض");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحسم");
    } finally {
      setBusy(null);
    }
  };

  const handleReply = async () => {
    if (!activeRequest || !reply.trim()) return;
    setBusy("reply");
    try {
      await ownerReply({ requestId: activeRequest._id, body: reply.trim() });
      setReply("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setBusy(null);
    }
  };

  const handleDispatch = async () => {
    if (!task.trim()) return;
    setBusy("dispatch");
    try {
      // أمر مباشر لقبّطة السفينة (المشرف العام على المساعدين)
      await dispatchTask({ agentName: "قبّطة السفينة", task: task.trim() });
      toast.success("🎯 وصل الأمر للمساعدين");
      setTask("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إرسال الأمر");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* نظرة عامة */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "أعمال ذاتية (24س)", value: overview.actionsLastDay, icon: Bot, tone: "text-emerald-600" },
          { label: "طلبات معلّقة", value: overview.pendingRequests.length, icon: Brain, tone: "text-amber-600" },
          { label: "موافقات اليوم", value: overview.approvedToday, icon: Check, tone: "text-emerald-600" },
          { label: "مواضيع ممنوعة", value: overview.forbiddenTopics.length, icon: Ban, tone: "text-rose-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <c.icon className={cn("size-4", c.tone)} />
            <p className="mt-2 text-2xl font-bold tabular-nums">{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* طلب خطير معلق + دردشة النقاش */}
      {activeRequest && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <Brain className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{activeRequest.title}</p>
              <p className="text-[11px] text-muted-foreground">
                من المساعد «{activeRequest.agentName}» · قسم {activeRequest.agentDept}
              </p>
            </div>
          </div>

          {/* دردشة النقاش */}
          <RequestChat requestId={activeRequest._id} />

          <div className="mt-3 flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
              placeholder="اسأل المساعد عن سبب طلبه…"
              className="h-10 flex-1 rounded-xl border border-border/70 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={busy === "reply"}
              className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "reply" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDecide(true)}
              disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              موافقة وتنفيذ
            </button>
            <button
              type="button"
              onClick={() => handleDecide(false)}
              disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-2.5 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              رفض
            </button>
            <button
              type="button"
              onClick={() => handleDecide(false, true)}
              disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-5 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Ban className="size-4" />
              رفض + منع نهائي للموضوع
            </button>
          </div>
        </div>
      )}

      {/* أمر مباشر */}
      <div className="flex gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <Radio className="mt-3 size-4 shrink-0 text-primary" />
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDispatch()}
          placeholder="أمر مباشر للمساعدين: مثال «راجعوا بلاغات اليوم» أو «كثّفوا مراقبة الحلبة»"
          className="h-11 flex-1 rounded-xl border border-border/70 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={handleDispatch}
          disabled={busy === "dispatch" || !task.trim()}
          className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "dispatch" ? "…" : "إرسال"}
        </button>
      </div>

      {/* الكتيبة */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4 text-primary" />
          كتيبة المساعدين ({overview.agents.length})
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {overview.agents.map((a: { num: number; name: string; dept: string; role: string; busy: boolean }) => (
            <div
              key={a.num}
              className={cn(
                "rounded-xl border border-border/60 bg-card p-3 transition-shadow hover:shadow-md",
                a.busy && "border-emerald-500/40 bg-emerald-500/5",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">#{a.num}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", DEPT_STYLE[a.dept] ?? "bg-muted")}>
                  {a.dept}
                </span>
                {a.busy && <span className="ms-auto size-1.5 animate-pulse rounded-full bg-emerald-500" />}
              </div>
              <p className="mt-1.5 text-sm font-bold">{a.name}</p>
              <p className="text-[10px] leading-relaxed text-muted-foreground">{a.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* المواضيع الممنوعة */}
      {overview.forbiddenTopics.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-sm font-bold text-rose-600">🚫 مواضيع ممنوعة نهائياً (بأمرك)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {overview.forbiddenTopics.map((t: { _id: string; topic: string }) => (
              <span key={t._id} className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600">
                {t.topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* سجل الأعمال الذاتية */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Bot className="size-4 text-emerald-600" />
          سجل الأعمال الذاتية (تنفيذ حر — دون استئذان)
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-2xl border border-border/60 bg-muted/30 p-3">
          {actions?.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              الدورة الأولى تبدأ خلال 20 دقيقة من نشر النظام…
            </p>
          )}
          {actions?.map((a: { _id: string; agentName: string; agentDept: string; summary: string; createdAt: number }) => (
            <div key={a._id} className="flex items-start gap-2 rounded-xl bg-card px-3 py-2 text-xs">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold", DEPT_STYLE[a.agentDept] ?? "bg-muted")}>
                {a.agentName}
              </span>
              <span className="flex-1 leading-relaxed">{a.summary}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(a.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
