import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Copy text to clipboard and show a toast confirmation. */
export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  } catch {
    toast.error("تعذّر النسخ — انسخ يدوياً.");
  }
}

/**
 * A tick hook that returns `Date.now()` and re-renders at the given
 * interval so UI elements can compute remaining time without
 * storing timestamps in state.
 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-orange-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 997;
  }
  return h;
}

/** A colored circle avatar derived deterministically from a player name. */
export function GameAvatar({
  name,
  index,
  className,
}: {
  name: string;
  index: number;
  className?: string;
}) {
  const color = AVATAR_COLORS[(hashName(name) + index) % AVATAR_COLORS.length];
  const letter = name.trim().charAt(0) || "?";
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
        color,
        className,
      )}
    >
      {letter}
    </span>
  );
}
