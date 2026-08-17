import {
  BrainCircuit,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

/** نفس المفتاح المستخدم في صفحة اللعب — الاسم يُحفظ محلياً على الجهاز. */
const NICKNAME_KEY = "mindclash.nickname";

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/play",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const setDisplayName = useMutation(api.profile.setDisplayName);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickName, setQuickName] = useState(() => {
    try {
      return localStorage.getItem(NICKNAME_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // ── الحساب الذكي (اسم دخول + رمز سري — بدون بريد) ──────────────
  const [accountMode, setAccountMode] = useState<"signUp" | "signIn">("signIn");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  /** «العب فوراً باسمك فقط» — الأسرع: اسم واحد → هوية ضيف فورية. */
  const handleQuickPlay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const name = quickName.trim();
      if (name) {
        try {
          localStorage.setItem(NICKNAME_KEY, name);
        } catch {
          // تجاهل فشل التخزين — الدخول يعمل على أي حال
        }
      }
      await signIn("anonymous");
      // احفظ الاسم على الحساب نفسه حتى يظهر في ملفك وترتيب النخبة
      // على أي جهاز — بدون بريد إطلاقاً.
      try {
        await setDisplayName({ name: name.trim() });
      } catch {
        // الاسم يبقى محفوظاً محلياً حتى لو تأخر التزامن — الدخول نجح.
      }
      navigate(redirect);
    } catch (signInError) {
      console.error("Quick play sign-in error:", signInError);
      setError(
        `تعذّر الدخول السريع: ${
          signInError instanceof Error ? signInError.message : "خطأ غير معروف"
        }`,
      );
      setIsLoading(false);
    }
  };

  /**
   * «حسابك بدون بريد» — الطريقة الذكية:
   * اسم دخول فريد + رمز سري = حسابك على أي جهاز، بدون بريد نهائياً.
   * نفس الاسم والرمز يفتحان حسابك من أي هاتف أو جهاز.
   */
  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("flow", accountMode);
      formData.set("username", accountUsername.trim());
      formData.set("password", accountPassword);
      await signIn("password", formData);
      try {
        localStorage.setItem(NICKNAME_KEY, accountUsername.trim());
      } catch {
        // تجاهل
      }
      navigate(redirect);
    } catch (accountError) {
      console.error("Account sign-in error:", accountError);
      const message =
        accountError instanceof Error ? accountError.message : "";
      if (accountMode === "signIn") {
        setError(
          message.includes("no account")
            ? "لا يوجد حساب بهذا الاسم — جرّب «حساب جديد» أولاً، أو تأكد من اسم الدخول."
            : "الرمز السري غير صحيح، أو لا يوجد حساب بهذا الاسم.",
        );
      } else {
        setError(
          message.includes("already exists")
            ? "هذا الاسم محجوز بالفعل — اختر اسماً آخر أو سجّل الدخول."
            : "تعذّر إنشاء الحساب: " + (message || "حاول اسماً آخر."),
        );
      }
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "تعذّر إرسال رمز التحقق، حاول مرة أخرى.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("رمز التحقق غير صحيح، حاول مجدداً.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Anonymous sign in error:", error);
      setError(
        `تعذّر الدخول كضيف: ${
          error instanceof Error ? error.message : "خطأ غير معروف"
        }`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen flex-col overflow-hidden bg-background"
    >
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 10%, color-mix(in oklab, var(--primary) 12%, transparent) 0, transparent 45%), radial-gradient(circle at 8% 90%, color-mix(in oklab, #f59e0b 8%, transparent) 0, transparent 40%)",
        }}
      />

      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border shadow-xl shadow-primary/5">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <BrainCircuit className="size-7" />
                </div>
                <CardTitle className="text-2xl">مرحباً بك في نباهة</CardTitle>
                <CardDescription className="leading-relaxed">
                  اختر الطريقة الأسرع لك — كلها بدون بريد إلكتروني.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* ── الدخول السريع بالاسم فقط ─────────────────────── */}
                <form onSubmit={handleQuickPlay}>
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Zap className="size-4" />
                      <p className="text-sm font-bold">العب فوراً باسمك فقط</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <UserRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          placeholder="مثال: الصقر الجريء"
                          maxLength={24}
                          className="pr-9"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading || quickName.trim().length === 0}
                        className="gap-1.5"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowLeft className="h-4 w-4" />
                        )}
                        ابدأ
                      </Button>
                    </div>
                    <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                      أسرع طريق: اكتب اسماً واضغط زراً واحداً. تريد نفس اسمك على
                      كل الأجهزة؟ استخدم الحساب الذكي بالأسفل.
                    </p>
                  </div>
                </form>

                {/* ── الحساب الذكي: اسم دخول + رمز سري، بدون بريد ──── */}
                <form onSubmit={handleAccountSubmit}>
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 text-amber-600">
                      <LockKeyhole className="size-4" />
                      <p className="text-sm font-bold">
                        الحساب الذكي — بلا بريد نهائياً
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <UserRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={accountUsername}
                          onChange={(e) => setAccountUsername(e.target.value)}
                          placeholder="اسم الدخول (فريد)"
                          maxLength={24}
                          className="pr-9"
                          disabled={isLoading}
                          required
                          autoComplete="username"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          placeholder="الرمز السري (6 خانات فأكثر)"
                          type="password"
                          className="pr-9"
                          disabled={isLoading}
                          required
                          autoComplete={
                            accountMode === "signIn"
                              ? "current-password"
                              : "new-password"
                          }
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={
                          isLoading ||
                          accountUsername.trim().length < 3 ||
                          accountPassword.length < 6
                        }
                        className="gap-1.5"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowLeft className="h-4 w-4" />
                        )}
                        {accountMode === "signIn" ? "دخول" : "إنشاء"}
                      </Button>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                        نفس الاسم والرمز يفتحان حسابك من أي جهاز — بدون بريد.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1 text-xs"
                        onClick={() =>
                          setAccountMode((mode) =>
                            mode === "signIn" ? "signUp" : "signIn",
                          )
                        }
                        disabled={isLoading}
                      >
                        {accountMode === "signIn"
                          ? "حساب جديد؟"
                          : "لديك حساب؟ سجّل الدخول"}
                      </Button>
                    </div>
                  </div>
                </form>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                {/* ── فاصل ────────────────────────────────────────── */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">أو</span>
                  </div>
                </div>

                {/* ── البريد: خيار احتياطي ثانوي ───────────────────── */}
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Mail className="size-3.5" />
                    خيار إضافي: تسجيل بالبريد
                  </p>
                  <form onSubmit={handleEmailSubmit} className="mt-2.5">
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pr-9"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading}
                        aria-label="إرسال رمز التحقق"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </form>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full gap-1.5 text-xs text-muted-foreground"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="size-3.5" />
                    الدخول كضيف بدون اسم
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="mt-4 text-center">
                <CardTitle className="text-2xl">تحقّق من بريدك</CardTitle>
                <CardDescription className="leading-relaxed">
                  أرسلنا رمزاً من 6 أرقام إلى {step.email}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-center text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    لم يصلك الرمز؟{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setStep("signIn")}
                    >
                      حاول مجدداً
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جارٍ التحقق…
                      </>
                    ) : (
                      <>
                        تأكيد الرمز
                        <ArrowLeft className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    استخدام بريد مختلف
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="border-t bg-muted/60 px-6 py-4 text-center text-xs text-muted-foreground">
            <Sparkles className="mx-auto mb-1 size-3.5 text-primary" />
            لعب فوري بالاسم · حساب ذكي بلا بريد · خيار البريد للطوارئ
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
