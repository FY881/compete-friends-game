import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Crown,
  Fingerprint,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowLeft,
  Scan,
} from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════
// Premium Owner Login — Full Page with Animations
// ═══════════════════════════════════════════════════════════════════

export default function OwnerPremiumLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"welcome" | "password" | "verifying" | "success">("welcome");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);
  const verifyPassword = useMutation(api.playerControl.verifyOwnerPassword);
  const ownerIdStatus = useQuery(api.owner.getOwnerIdStatus);

  // Generate floating particles on mount
  useEffect(() => {
    const p = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3,
      size: Math.random() * 4 + 2,
    }));
    setParticles(p);
  }, []);

  const handleVerify = async () => {
    if (!password.trim()) {
      setError("أدخل كلمة المرور");
      return;
    }
    setBusy(true);
    setError(null);
    setStep("verifying");

    try {
      await verifyPassword({ password: password.trim() });
      setStep("success");
      toast.success("تم التحقق بنجاح! مرحباً بك يا مالك 👑");
      setTimeout(() => {
        navigate("/owner");
      }, 1500);
    } catch (err) {
      setStep("password");
      setError(err instanceof Error ? err.message : "كلمة المرور خاطئة");
      toast.error("كلمة المرور غير صحيحة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated Background Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-primary/10"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `owner-float-particle ${3 + p.delay}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
        {/* Gradient Orbs */}
        <div className="absolute -top-32 -right-32 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 size-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/3 blur-3xl" />
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate("/play")}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          العودة للعبة
        </button>

        {/* Login Card */}
        <div className="overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-2xl shadow-primary/5 backdrop-blur-xl">
          {/* Header with animated shield */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-8 pt-10 pb-8 text-center">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }} />

            {/* Shield Icon with Glow */}
            <div className="relative mx-auto mb-5">
              <div className="relative mx-auto flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/25">
                <ShieldCheck className="size-10 text-primary-foreground" />
                {/* Pulse rings */}
                <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" style={{ animationDuration: "3s" }} />
              </div>
              {/* Crown badge */}
              <div className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30">
                <Crown className="size-4 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">غرفة المالك</h1>
            <p className="mt-2 text-sm text-muted-foreground">لوحة التحكم المتقدمة — حرب العقول</p>

            {/* Owner ID Badge */}
            {ownerIdStatus?.active && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge variant="outline" className="gap-1.5 rounded-full border-primary/30 bg-primary/10 text-[11px] text-primary">
                  <Fingerprint className="size-3" />
                  معرّف المالك: {ownerIdStatus.id}
                </Badge>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="px-8 pb-8 pt-6">
            {/* Step: Welcome */}
            {step === "welcome" && (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="text-lg font-bold">مرحباً بك يا مالك 👑</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    للدخول إلى لوحة التحكم المتقدمة، يرجى التحقق من هويتك
                  </p>
                </div>

                {/* Security Features */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Shield, label: "حماية متقدمة", color: "text-primary" },
                    { icon: Lock, label: "تشفير كامل", color: "text-emerald-600" },
                    { icon: Fingerprint, label: "معرّف فريد", color: "text-amber-600" },
                    { icon: Zap, label: "دخول فوري", color: "text-blue-600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                      <item.icon className={cn("size-4", item.color)} />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setStep("password")}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary/90 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                >
                  <Key className="me-2 size-5" />
                  التحقق والدخول
                </Button>
              </div>
            )}

            {/* Step: Password */}
            {step === "password" && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <Scan className="size-6 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold">أدخل كلمة المرور</h2>
                  <p className="mt-1 text-sm text-muted-foreground">كلمة المرور الخاصة بغرفة المالك</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      className="h-12 rounded-xl ps-11 text-center text-lg tracking-widest"
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      autoFocus
                    />
                    <Lock className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute end-1 top-1/2 size-8 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                    <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                    <p className="text-xs text-rose-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setStep("welcome"); setPassword(""); setError(null); }}
                    className="h-12 flex-1 rounded-xl"
                  >
                    رجوع
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={busy || !password.trim()}
                    className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/90 font-bold shadow-lg shadow-primary/20"
                  >
                    {busy ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="me-2 size-5" />
                        تحقق
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Verifying */}
            {step === "verifying" && (
              <div className="flex flex-col items-center py-8">
                <div className="relative mb-6">
                  <div className="size-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                  <ShieldCheck className="absolute inset-0 m-auto size-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold">جارٍ التحقق...</h3>
                <p className="mt-2 text-sm text-muted-foreground">التحقق من هوية المالك</p>
              </div>
            )}

            {/* Step: Success */}
            {step === "success" && (
              <div className="flex flex-col items-center py-8">
                <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="size-10 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-emerald-600">تم التحقق بنجاح!</h3>
                <p className="mt-2 text-sm text-muted-foreground">مرحباً بك في لوحة التحكم</p>
                <div className="mt-4 flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-xs text-primary">جارٍ التحويل...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground/50">
          حرب العقول — نظام التحكم الآمن v2.0
        </p>
      </div>

      {/* Float particle animation */}
      <style>{`
        @keyframes owner-float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-40px) translateX(-5px); opacity: 0.3; }
          75% { transform: translateY(-20px) translateX(15px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
