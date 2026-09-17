import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sound } from "@/lib/sounds";
import { Sparkles } from "lucide-react";

const MODE_META: Record<string, { emoji: string; label: string }> = {
  quiz_rush: { emoji: "⚡", label: "سباق الذكاء" },
  puzzle_masters: { emoji: "🧩", label: "عصر الألغاز" },
  champion_battle: { emoji: "🏆", label: "تحدي الأبطال" },
  diamond_rush: { emoji: "💎", label: "اندفاع الماس" },
  legend_arena: { emoji: "👑", label: "ساحة الأساطير" },
};

export function SmartGateway() {
  const gateway = useQuery(api.mindSpecializations.getSmartGateway);
  const navigate = useNavigate();

  if (!gateway) return null;

  const meta = MODE_META[gateway.recommendedMode] ?? MODE_META.quiz_rush;
  const isNew = gateway.playerKind === "brand_new";

  const handleStart = () => {
    Sound.click();
    navigate("/play#modes");
    // تمرير سلس إلى قسم الأنماط
    setTimeout(() => {
      document.getElementById("modes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-l from-primary/10 via-background to-background p-5 shadow-sm"
    >
      <div className="pointer-events-none absolute -left-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-3xl">
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" />
            بوابتك الذكية — الحاكم الذكي رشح لك
          </p>
          <h3 className="mt-0.5 text-lg font-black tracking-tight">{gateway.headline}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{gateway.sub}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2">
          <Button
            onClick={handleStart}
            className="gap-2 rounded-xl font-bold"
            size="sm"
          >
            {isNew ? "ابدأ أول جولة" : `العب ${meta.label}`}
          </Button>
          {!isNew && (
            <p className="text-center text-[10px] text-muted-foreground">
              {gateway.roundsThisWeek} جولة هذا الأسبوع
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
