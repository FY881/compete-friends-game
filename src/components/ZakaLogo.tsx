import { cn } from "@/lib/utils";

/**
 * ذكاء Logo — Unique AI-powered brain icon
 * A distinctive logo that represents intelligence and AI
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
      {/* Background circle */}
      <circle cx="16" cy="16" r="15" fill="currentColor" fillOpacity="0.1" />
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      
      {/* Brain shape - left hemisphere */}
      <path
        d="M16 8C13 8 10 10 10 13C10 14.5 10.5 15.8 11.5 16.8C10.5 17.5 10 18.5 10 19.5C10 21.5 12 23 14 23C14.5 23 15 22.9 15.5 22.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Brain shape - right hemisphere */}
      <path
        d="M16 8C19 8 22 10 22 13C22 14.5 21.5 15.8 20.5 16.8C21.5 17.5 22 18.5 22 19.5C22 21.5 20 23 18 23C17.5 23 17 22.9 16.5 22.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Neural connections */}
      <circle cx="13" cy="12" r="1.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="16" cy="16" r="2" fill="currentColor" fillOpacity="0.8" />
      <circle cx="13" cy="20" r="1.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="19" cy="20" r="1.5" fill="currentColor" fillOpacity="0.6" />
      
      {/* AI sparkle */}
      <path
        d="M16 6L16.5 7.5L18 7L17 8L18 9L16.5 8.5L16 10L15.5 8.5L14 9L15 8L14 7L15.5 7.5L16 6Z"
        fill="currentColor"
      />
    </svg>
  );
}
