import { BrainCircuit, Loader2, Mail, ShieldCheck, Sparkles, UserRound, Zap } from "lucide-react";
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

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  /**
   * «العب فوراً باسمك فقط» — الطريقة الأسرع للدخول:
   * اسم واحد → هوية ضيف فورية → ساحة اللعب. لا بريد، لا كلمة مرور، لا رمز.
   * إذا أراد اللاعب لاحقاً حفظ تقدمه على كل أجهزته، يسجّل بحساب بريد
   * في أي وقت وترتبط هويته تلقائياً (Convex Auth linking).
   */
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
                <CardTitle className="text-2xl">مرحباً بك في تحدّي العقول</CardTitle>
                <CardDescription className="leading-relaxed">
                  اكتب اسمك واضغط زراً واحداً — وادخل ساحة التحدي فوراً، بلا بريد
                  ولا كلمة مرور ولا انتظار.
                </CardDescription>
              </CardHeader>

              <CardContent>
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
                      اسمك يُحفظ على جهازك فقط. تريد حفظ تقدمك على كل أجهزتك؟
                      سجّل بريدك لاحقاً في أي وقت وستُربط هويتك تلقائياً.
                    </p>
                  </div>
                </form>

                {error && (
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                )}

                {/* ── فاصل ────────────────────────────────────────── */}
                <div className="relative mt-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">أو</span>
                  </div>
                </div>

                {/* ── البريد: خيار الحساب الكامل ───────────────────── */}
                <div className="mt-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Mail className="size-3.5" />
                    سجّل بحساب بريد لحفظ تقدمك أينما كنت
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
            لعب سريع للضيوف · حساب كامل بالبريد لمن يريد حفظ تقدمه
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
