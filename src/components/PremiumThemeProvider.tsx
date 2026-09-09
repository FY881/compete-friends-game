import { useEffect, type ReactNode } from "react";
import { usePremiumTheme } from "@/hooks/use-premium-theme";

/**
 * PremiumThemeProvider — يقرأ عضوية المستخدم الحالية ويطبق «الثيم البريميمي»
 * على مستوى التطبيق كله:
 * 1) يضع سمة data-premium-tier على جذر المستند فيُفعَّل التلوين المتدرّج
 *    والتوهّج المطابق لمستوى العضوية عبر CSS.
 * 2) يرسم طبقة إضاءة محيطية باهتة خلف الصفحة بذات لون المستوى.
 * لا يغيّر أي تخطيط ولا يقيّد أي محتوى — فقط يرفع مستوى الإحساس البصري.
 */
export function PremiumThemeProvider({ children }: { children: ReactNode }) {
  const { tier } = usePremiumTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-premium-tier", tier);
    return () => {
      document.documentElement.removeAttribute("data-premium-tier");
    };
  }, [tier]);

  return (
    <>
      <div aria-hidden className="premium-ambient" />
      {children}
    </>
  );
}