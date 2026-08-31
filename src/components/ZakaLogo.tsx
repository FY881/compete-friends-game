import { cn } from "@/lib/utils";

/**
 * حرب العقول — War of Minds Logo
 * Premium brain + lightning icon for competitive intelligence
 */
export function ZakaLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      {/* Background gradient circle */}
      <defs>
        <linearGradient id="warGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#warGrad)" />
      <circle cx="16" cy="16" r="13.5" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />

      {/* Brain shape - left hemisphere */}
      <path
        d="M16 8C13.5 8 10.5 10 10.5 13C10.5 14.5 11 15.8 12 16.8C11 17.5 10.5 18.5 10.5 19.5C10.5 21.5 12.5 23 14.5 23C15 23 15.5 22.9 15.8 22.7"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      {/* Brain shape - right hemisphere */}
      <path
        d="M16 8C18.5 8 21.5 10 21.5 13C21.5 14.5 21 15.8 20 16.8C21 17.5 21.5 18.5 21.5 19.5C21.5 21.5 19.5 23 17.5 23C17 23 16.5 22.9 16.2 22.7"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      {/* Center line */}
      <line x1="16" y1="9" x2="16" y2="22" stroke="white" strokeWidth="0.5" strokeOpacity="0.3" />

      {/* Neural nodes */}
      <circle cx="13.5" cy="12" r="1.2" fill="white" fillOpacity="0.8" />
      <circle cx="18.5" cy="12" r="1.2" fill="white" fillOpacity="0.8" />
      <circle cx="16" cy="16" r="1.8" fill="white" fillOpacity="0.9" />
      <circle cx="13.5" cy="20" r="1.2" fill="white" fillOpacity="0.8" />
      <circle cx="18.5" cy="20" r="1.2" fill="white" fillOpacity="0.8" />

      {/* Lightning bolt — "War" symbol */}
      <path
        d="M17.5 5L15 10L17 10L14.5 16"
        stroke="#F59E0B"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
