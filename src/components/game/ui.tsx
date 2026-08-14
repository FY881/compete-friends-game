import { useEffect, useState } from "react";
import { toast } from "sonner";

export function avatarColor(name: string, index = 0): string {
  const colors = [
    "bg-teal-600",
    "bg-amber-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-emerald-600",
    "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return colors[(hash + index) % colors.length];
}

export function GameAvatar({
  name,
  index = 0,
  className = "",
}: {
  name: string;
  index?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(
        name,
        index,
      )} ${className}`}
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}

/** A clock that ticks every `intervalMs` so countdowns stay smooth. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} — تم النسخ`);
  } catch {
    toast.error("تعذّر النسخ، انسخها يدوياً");
  }
}
