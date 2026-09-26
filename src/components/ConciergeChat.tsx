import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Sparkles, Send, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

/**
 * 🎩 كونسيرج العقول — واجهة المحادثة في غرفة المالك
 * تكتب بالعربية الطبيعية → يفهم → يعرض خطة مرقمة → توافق → ينفذ بأوامر حقيقية.
 */

type PlanStep = {
  order: number;
  tool: string;
  params: Record<string, string>;
  description: string;
  dangerous: boolean;
};

type ConciergePlan = {
  intent: string;
  reply: string;
  steps: PlanStep[];
  needsConfirmation: boolean;
  infoOnly: boolean;
};

type ChatEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; plan?: ConciergePlan }
  | { role: "result"; lines: string[] };

const QUICK_PROMPTS = [
  "اكتب: اكتم اللاعب ...",
  "اعلن: بطولة الليلة 9 مساءً",
  "نظف الغرف الميتة",
  "ولد أسئلة فئة تاريخ",
  "دقق الأسئلة المعلقة",
];

export function ConciergeChat() {
  const askConcierge = useAction(api.aiConcierge.askConcierge);
  const confirmPlan = useMutation(api.aiConcierge.confirmPlan);

  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setChat((c) => [...c, { role: "user", text: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await askConcierge({ message: msg });
      const plan = (res as { plan: ConciergePlan }).plan;
      setChat((c) => [...c, { role: "assistant", text: plan.reply, plan }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذر فهم الطلب";
      setChat((c) => [...c, { role: "assistant", text: `✗ ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function execute(plan: ConciergePlan) {
    if (confirming) return;
    setConfirming(true);
    try {
      const res = await confirmPlan({
        intent: plan.intent,
        steps: plan.steps.map((s) => ({ tool: s.tool, params: s.params })),
      });
      const results = (res as { results: string[] }).results;
      setChat((c) => [...c, { role: "result", lines: results.length ? results : ["لا نتائج"] }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل التنفيذ";
      setChat((c) => [...c, { role: "result", lines: [`✗ ${message}`] }]);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <div className="text-sm leading-relaxed text-violet-100">
          <span className="font-bold">كونسيرج العقول</span> — اكتب ما تريد بالعربية الطبيعية:
          كتم، طرد، إعلان، توليد أسئلة، تنظيف غرف… وسيبني خطة مؤكدة قبل أي تنفيذ.
        </div>
      </div>

      {/* سجل المحادثة */}
      <div className="max-h-[420px] min-h-[240px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4">
        {chat.length === 0 && (
          <div className="space-y-2 py-6 text-center text-xs text-white/50">
            <div className="text-3xl">🎩</div>
            <p>لا محادثات بعد — جرّب أحد الاقتراحات بالأسفل</p>
          </div>
        )}
        {chat.map((entry, i) => {
          if (entry.role === "user") {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600/70 px-4 py-2 text-sm text-white">
                  {entry.text}
                </div>
              </div>
            );
          }
          if (entry.role === "result") {
            return (
              <div key={i} className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                {entry.lines.map((line, j) => (
                  <div key={j} className="text-xs leading-relaxed text-emerald-100">{line}</div>
                ))}
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[90%] space-y-2">
                <div className="rounded-2xl rounded-tl-sm bg-violet-600/60 px-4 py-2 text-sm text-white">
                  {entry.text}
                </div>
                {entry.plan && entry.plan.steps.length > 0 && (
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-white/70">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
                      خطة التنفيذ ({entry.plan.steps.length} خطوة)
                    </div>
                    <ol className="space-y-1.5">
                      {entry.plan.steps.map((s) => (
                        <li key={s.order} className="flex items-start gap-2 text-xs text-white/85">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/40 text-[10px] font-bold">
                            {s.order}
                          </span>
                          <span>
                            {s.description}
                            {s.dangerous && <span className="mr-1 text-red-300">⚠️ إجراء خطير</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {entry.plan.needsConfirmation && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => execute(entry.plan!)}
                          disabled={confirming || busy}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {confirming ? "جارٍ التنفيذ…" : "تنفيذ الخطة"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex justify-end">
            <div className="rounded-2xl bg-violet-600/40 px-4 py-2 text-sm text-white/80">
              يفكّر…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* اقتراحات سريعة */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={busy}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 transition hover:border-violet-400/40 hover:text-white disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      {/* حقل الإدخال */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب أمراً… مثال: اكتم اللاعب أحمد"
          disabled={busy}
          className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-violet-400/60 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          إرسال
        </button>
      </form>

      <div className="flex items-center gap-1.5 text-[10px] text-white/40">
        <XCircle className="h-3 w-3" />
        لا شيء يُنفَّذ بدون موافقتك الصريحة — وكل محادثة تُسجَّل في سجل القرارات.
      </div>
    </div>
  );
}
