import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 🎙️ شريط المعلّق الأسطوري — بث حيّ أثناء المباراة.
 * يعرض أحدث سرد للمباراة أولاً بأول مع أنيميشن، وتاريخ اللحظات قابل للفتح.
 */

const KIND_STYLE: Record<string, string> = {
  match_intro: "border-primary/40 bg-primary/10 text-primary",
  question_start: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  reveal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  streak_alert: "border-orange-500/40 bg-orange-500/10 text-orange-700",
  comeback_alert: "border-violet-500/40 bg-violet-500/10 text-violet-700",
  finale: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700",
};

export function CasterBar({ code }: { code: string }) {
  const narrative = useQuery(api.aiCaster.getRoomNarrative, { code, limit: 4 });
  const [expanded, setExpanded] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState(false);

  const latest = narrative?.[narrative.length - 1] ?? null;

  // وميض «جديد» عند وصول سرد لم نره
  useEffect(() => {
    if (latest && !seenIds.current.has(latest.id)) {
      const isNew = seenIds.current.size > 0;
      seenIds.current.add(latest.id);
      if (isNew) {
        setFresh(true);
        const t = setTimeout(() => setFresh(false), 4000);
        return () => clearTimeout(t);
      }
      seenIds.current.add(latest.id);
    }
  }, [latest?.id]);

  if (narrative === undefined || narrative.length === 0) return null;

  return (
    <div dir="rtl" className="mb-3">
      <AnimatePresence mode="wait">
        {latest && (
          <motion.div
            key={latest.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "relative rounded-2xl border p-3 shadow-sm backdrop-blur-sm transition-shadow",
              KIND_STYLE[latest.kind] ?? "border-border bg-card",
              fresh && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-start gap-2.5">
              <motion.span
                animate={fresh ? { rotate: [0, -12, 10, 0] } : {}}
                transition={{ duration: 0.6 }}
                className="mt-0.5 shrink-0"
              >
                <Mic className="size-4" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black opacity-70">{latest.label}</p>
                <p className="mt-0.5 text-xs font-bold leading-relaxed">{latest.text}</p>
              </div>
              {latest.engine === "llm" && (
                <span title="سرد ذكي">
                  <Sparkles className="size-3 shrink-0 opacity-50" />
                </span>
              )}
            </div>

            {narrative.length > 1 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 text-[10px] font-bold opacity-60 hover:opacity-100"
              >
                {expanded ? "إخفاء السابق ▲" : `لحظات سابقة (${narrative.length - 1}) ▼`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {expanded &&
        [...narrative]
          .reverse()
          .slice(1)
          .map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "mt-1.5 rounded-xl border p-2.5 opacity-80",
                KIND_STYLE[n.kind] ?? "border-border bg-card",
              )}
            >
              <p className="text-[9px] font-black opacity-60">{n.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed">{n.text}</p>
            </motion.div>
          ))}
    </div>
  );
}
