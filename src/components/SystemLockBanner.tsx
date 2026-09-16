import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Lock, Clock } from "lucide-react";

/**
 * 🔒 شريط الأقفال الطارئة — يُظهر للاعب الحقيقة كاملة.
 *
 *  غرفة المالك تُقفل نظاماً (ساحة/دردشة/اقتصاد/موقع) فينعكس القرار فوراً هنا،
 *  مع السبب المكتوب وموعد الفتح التلقائي — فلا يوجد زر لا يعمل بلا تفسير.
 */
export function SystemLockBanner() {
  const locks = useQuery(api.systemLocks.getLockStatus);
  if (!locks) return null;

  const rows: { label: string; icon: string; state: { locked: boolean; until: number | null; reason: string } }[] = [
    { label: "الساحة والمبارزات", icon: "⚔️", state: locks.arena },
    { label: "الدردشة والمجتمع", icon: "💬", state: locks.chat },
    { label: "الاقتصاد والمتجر", icon: "💰", state: locks.economy },
    { label: "الموقع بالكامل", icon: "🚧", state: locks.site },
  ].filter((r) => r.state.locked);

  if (rows.length === 0) return null;

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

  return (
    <div dir="rtl" className="border-b border-amber-500/30 bg-gradient-to-l from-amber-500/15 via-amber-500/10 to-amber-500/15 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
          <Lock className="size-4" /> إجراء إداري مؤقت
        </span>
        {rows.map((r) => (
          <span key={r.label} className="flex items-center gap-1.5 text-xs text-amber-800/90 dark:text-amber-200/90">
            <span>{r.icon}</span>
            <span className="font-semibold">{r.label} مقفلة</span>
            {r.state.reason && <span className="opacity-80">— {r.state.reason}</span>}
            {r.state.until && (
              <span className="flex items-center gap-1 opacity-80">
                <Clock className="size-3" /> تُفتح {fmt(r.state.until)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
