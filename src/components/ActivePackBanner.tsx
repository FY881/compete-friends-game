/**
 * شارة الحزمة الموسمية النشطة — حدث محدود الوقت بأسئلة مولّدة بالـ AI.
 * تظهر في أعلى صفحة اللعب مع عدّاد الوقت المتبقي وعدد أسئلة الحزمة.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Sparkles, Clock3 } from "lucide-react";

function remainingLabel(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return "انتهت";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `متبقي ${days} يوم و${hours} ساعة`;
  return `متبقي ${hours} ساعة`;
}

export function ActivePackBanner() {
  const pack = useQuery(api.questionPacks.getActivePack);
  if (!pack) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-violet-500/25 bg-gradient-to-l from-violet-500/12 via-violet-500/6 to-transparent px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">
          حزمة «{pack.name}» — أسئلة حصرية بالذكاء الاصطناعي
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          {remainingLabel(pack.endsAt)} · {pack.questionCount} سؤال حصري يدخل جولاتك تلقائياً
        </p>
      </div>
      {pack.description && (
        <span className="hidden max-w-48 truncate rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-600 sm:block">
          {pack.description}
        </span>
      )}
    </div>
  );
}
