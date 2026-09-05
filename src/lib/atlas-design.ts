/**
 * حرب العقول — نظام التصميم المتكامل (War of Minds Design System)
 *
 * هوية بريميوم فاخرة: كحلي عميق × ذهبي ملكي × بنفسجي سيطرة.
 * كل مكوّنات لوحة تحكم حرب العقول تشتق ألوانها من هنا — مصدر واحد متسق، متوافق مع
 * نظام Tailwind/shadcn الحالي في الوضعين الداكن والفاتح.
 */
export const ATLAS_NAME = "لوحة تحكم حرب العقول";
export const ATLAS_TAGLINE = "مركز السيطرة الكامل على حرب العقول";
export const ATLAS_VERSION = "2.0.0";
export const ATLAS_GAME = "حرب العقول";

/**
 * لوحة الألوان الأساسية:
 * - void    كحلي الفضاء العميق (الخلفيات)
 * - panel   لوح داكن مرتفع (الكروت)
 * - royal   البنفسجي الملكي (اللون السيادي / primary)
 * - gold    الذهبي الملكي (الفخامة والتمييز)
 * - cyan    السماوي (المؤشرات الحية)
 * - crimson القرمزي (الطوارئ)
 * - emerald الزمردي (النجاح/الصحة)
 */
export const ATLAS_COLORS = {
  void: "#070b16",
  panel: "#0e1428",
  royal: "#7c6cf6",
  royalDeep: "#5b4bd4",
  gold: "#d4af37",
  goldBright: "#f0cd6a",
  cyan: "#38bdf8",
  crimson: "#f43f5e",
  emerald: "#34d399",
  amber: "#f59e0b",
  slate: "#94a3b8",
} as const;

/** تنبيهات ملونة حسب الخطورة — نفس رمزية إشعارات المنظومة. */
export const ATLAS_SEVERITY = {
  info: { label: "معلومة", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  blue: { label: "للمتابعة", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  orange: { label: "مخالفة متوسطة", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  red: { label: "عاجل/خطير", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  purple: { label: "مراجعة عليا", color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
} as const;

export type AtlasSeverityKey = keyof typeof ATLAS_SEVERITY;

/** تنسيق الأرقام الكبيرة: 12,400 → 12.4K */
export function atlasCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** تنسيق التاريخ العربي القصير */
export function atlasTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** تنسيق المدة بالدقائق */
export function atlasMinutes(ms: number): string {
  if (ms < 60_000) return "الآن";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

/** تنسيق الحجم بالبايت → ميغابايت */
export function atlasMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

