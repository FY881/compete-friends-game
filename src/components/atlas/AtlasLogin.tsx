import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Fingerprint,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router";
import {
  ATLAS_NAME,
  ATLAS_TAGLINE,
  ATLAS_COLORS,
  ATLAS_VERSION,
} from "@/lib/atlas-design";

/**
 * بوابة دخول أطلس كنترول — التجربة الأولى للتطبيق.
 * نفس تحقق المالك الرسمي على الخادم (playerControl.verifyOwnerPassword)
 * — بلا أي تجاوز، مع تسجيل الجلسة في سجل الأمان.
 */
export default function AtlasLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stars, setStars] = useState<Array<{ x: number; y: number; d: number; s: number; i: number }>>([]);
  const verifyPassword = useMutation(api.playerControl.verifyOwnerPassword);
  const recordSession = useMutation(api.atlas.atlasSessionLogin);
  const ownerIdStatus = useQuery(api.owner.getOwnerIdStatus);

  useEffect(() => {
    setStars(
      Array.from({ length: 26 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        d: Math.random() * 4,
        s: Math.random() * 2.5 + 1,
        i,
      })),
    );
  }, []);

  const handleVerify = async () => {
    if (!password.trim()) {
      setError("أدخل كلمة مرور المالك");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyPassword({ password: password.trim() });
      try {
        await recordSession({});
      } catch {
        // تسجيل الجلسة لا يعيق الدخول
      }
      toast.success("مرحباً بك في لوحة تحكم حرب العقول 👑");
      navigate("/atlas", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحقق");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b16] p-5"
    >
      {/* توهجات الخلفية */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(closest-side, #5b4bd4, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-52 left-1/4 h-[420px] w-[520px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(closest-side, #d4af37, transparent)" }}
      />
      {/* نجوم */}
      <div className="pointer-events-none absolute inset-0">
        {stars.map((st) => (
          <span
            key={st.i}
            className="absolute rounded-full bg-white animate-war-pulse"
            style={{
              left: `${st.x}%`,
              top: `${st.y}%`,
              width: st.s,
              height: st.s,
              opacity: 0.5,
              animationDelay: `${st.d}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* الشعار */}
        <div className="flex flex-col items-center text-center">
          <div
            className="animate-war-float relative flex size-24 items-center justify-center rounded-[28px] border shadow-2xl"
            style={{
              borderColor: "rgba(212,175,55,0.35)",
              background: "linear-gradient(160deg, #131a33 0%, #0a0f1f 100%)",
              boxShadow: "0 0 60px rgba(124,108,246,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <img
              src="/icons/atlas-icon-192.png"
              alt={ATLAS_NAME}
              className="size-20 rounded-2xl object-contain"
              draggable={false}
            />
          </div>
          <h1
            className="mt-6 text-4xl font-black tracking-tight"
            style={{
              background: "linear-gradient(120deg, #f0cd6a 0%, #d4af37 45%, #8b7cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {ATLAS_NAME}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-400">{ATLAS_TAGLINE}</p>
          {ownerIdStatus?.active && (
            <div
              className="mt-4 flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold"
              style={{ borderColor: "rgba(212,175,55,0.4)", color: "#f0cd6a" }}
            >
              <Fingerprint className="size-3.5" />
              هوية المالك موثّقة · ID {ownerIdStatus.id}
            </div>
          )}
        </div>

        {/* البطاقة */}
        <div
          className="mt-8 rounded-3xl border p-7 shadow-2xl"
          style={{
            borderColor: "rgba(148,163,184,0.14)",
            background: "linear-gradient(170deg, rgba(19,26,51,0.92) 0%, rgba(10,15,31,0.96) 100%)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(124,108,246,0.14)" }}
            >
              <Lock className="size-5" style={{ color: ATLAS_COLORS.royal }} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">دخول المالك</h2>
              <p className="text-xs text-slate-400">صلاحية كاملة — للمالك الرسمي فقط</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label htmlFor="atlas-pass" className="text-xs font-bold text-slate-300">
              كلمة مرور المالك
            </Label>
            <div className="relative">
              <Input
                id="atlas-pass"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && !busy && handleVerify()}
                placeholder="••••••••••"
                disabled={busy}
                autoFocus
                className="h-12 rounded-xl border-slate-700/60 bg-slate-950/60 pe-11 text-base text-white placeholder:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#7c6cf6]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                aria-label={showPassword ? "إخفاء" : "إظهار"}
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: "rgba(244,63,94,0.35)", background: "rgba(244,63,94,0.08)" }}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
              <p className="text-xs font-semibold leading-relaxed text-rose-300">{error}</p>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={busy}
            className="mt-6 h-12 w-full gap-2 rounded-xl text-base font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
            style={{
              background: "linear-gradient(120deg, #7c6cf6 0%, #5b4bd4 100%)",
              boxShadow: "0 8px 28px rgba(124,108,246,0.35)",
            }}
          >
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                جارٍ التحقق من الهوية…
              </>
            ) : (
              <>
                <Shield className="size-5" />
                افتح مركز السيطرة
              </>
            )}
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-500">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            التحقق مشفّر بالكامل عبر الخادم — كل جلسة تُسجَّل في سجل الأمان
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-slate-300"
          >
            <ArrowLeft className="size-3.5" />
            اللعبة
          </button>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <Globe className="size-3" />
            {ATLAS_NAME} v{ATLAS_VERSION}
          </span>
        </div>
      </div>
    </div>
  );
}
