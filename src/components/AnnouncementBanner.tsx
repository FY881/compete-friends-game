import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Megaphone, X, Lock } from "lucide-react";

const DISMISS_KEY = "mindclash.announcement.dismissed";

export function AnnouncementBanner() {
  const info = useQuery(api.owner.getPublicInfo);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  // ── وضع الحماية (موجة 2.2): بانر قفل يحجب الإعلانات العادية ──
  if (info?.siteLocked) {
    return (
      <div
        dir="rtl"
        className="relative z-40 flex items-center justify-center gap-3 border-b border-rose-500/30 bg-gradient-to-l from-rose-500/20 via-rose-500/10 to-rose-500/20 px-10 py-3 text-center"
      >
        <Lock className="size-4 shrink-0 animate-pulse text-rose-600" />
        <p className="text-sm font-bold text-rose-700">
          {info.siteLockMessage || "اللعبة تحت الصيانة حالياً — عد قريباً!"}
        </p>
      </div>
    );
  }

  if (!info?.announcement) return null;
  if (dismissed === info.announcement) return null;

  return (
    <div
      dir="rtl"
      className="relative z-30 flex items-center justify-center gap-3 border-b border-amber-500/25 bg-gradient-to-l from-amber-500/15 via-amber-500/10 to-amber-500/15 px-10 py-2.5 text-center"
    >
      <Megaphone className="size-4 shrink-0 text-amber-600" />
      <p className="text-sm font-semibold text-foreground">{info.announcement}</p>
      <button
        type="button"
        aria-label="إغلاق الإعلان"
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => {
          setDismissed(info.announcement);
          try {
            localStorage.setItem(DISMISS_KEY, info.announcement);
          } catch {
            // ignore
          }
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
