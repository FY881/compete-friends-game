import { Component, useEffect, type ReactNode } from "react";
import { usePremiumTheme } from "@/hooks/use-premium-theme";

/**
 * PremiumThemeProvider — يقرأ عضوية المستخدم الحالية ويطبق «الثيم البريميمي»
 * على مستوى التطبيق كله:
 * 1) يضع سمة data-premium-tier على جذر المستند فيُفعَّل التلوين المتدرّج
 *    والتوهّج المطابق لمستوى العضوية عبر CSS.
 * 2) يرسم طبقة إضاءة محيطية باهتة خلف الصفحة بذات لون المستوى.
 * لا يغيّر أي تخطيط ولا يقيّد أي محتوى — فقط يرفع مستوى الإحساس البصري.
 *
 * 🛡 v8.0 — أصبح «آمن الفشل» (fail-safe):
 * قراءة العضوية ميزة تجميلية، فلا يجوز أن تُسقط التطبيق كله إن تعذّر
 * الوصول للخادم (حصة منتهية / انقطاع / خطأ خادم). القراءة محصورة الآن
 * داخل حاجز أخطاء صغير: إن فشلت، يُستمر بالثيم الأساسي وتُعرض الواجهة
 * كاملة كما هي. (هذا كان مسار الانهيار الظاهر في تقارير الأخطاء.)
 */

/** 🛡 حاجز أخطاء محلي: فشل الثيم لا يُسقط الشجرة — يُستمر بلا ثيم بريميوم. */
class PremiumTierBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      "[PremiumTheme] تعذّرت قراءة العضوية — يُستمر بالثيم الأساسي:",
      error.message.slice(0, 140),
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** يقرأ العضوية ويطبّق السمة فقط — لا يرسم شيئاً مرئياً. */
function PremiumTierProbe() {
  const { tier } = usePremiumTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-premium-tier", tier);
    return () => {
      document.documentElement.removeAttribute("data-premium-tier");
    };
  }, [tier]);

  return null;
}

export function PremiumThemeProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="premium-ambient" />
      <PremiumTierBoundary>
        <PremiumTierProbe />
      </PremiumTierBoundary>
      {children}
    </>
  );
}
