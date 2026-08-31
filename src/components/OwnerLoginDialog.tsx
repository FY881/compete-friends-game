import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router";

// ═══════════════════════════════════════════════════════════════
// نافذة تسجيل دخول المالك بكلمة المرور
// ═══════════════════════════════════════════════════════════════

export function OwnerLoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const verifyPassword = useMutation(api.playerControl.verifyOwnerPassword);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!password.trim()) {
      toast.error("أدخل كلمة المرور");
      return;
    }
    setBusy(true);
    try {
      await verifyPassword({ password: password.trim() });
      toast.success("تم تسجيل الدخول بنجاح! مرحباً بك يا مالك 👑");
      onOpenChange(false);
      navigate("/owner");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "كلمة المرور خاطئة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            دخول المالك
          </DialogTitle>
          <DialogDescription>
            أدخل كلمة مرور المالك للوصول إلى لوحة التحكم
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">كلمة المرور</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة مرور المالك"
                className="h-10 rounded-xl ps-10"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute start-1 top-1/2 size-8 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-700">
                هذا الدخول يمنحك صلاحيات المالك الكاملة. استخدمه فقط عندما
                تحتاج إلى التحكم في اللعبة.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button
            onClick={handleLogin}
            disabled={busy}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Key className="size-4" />
            )}
            دخول
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// إدارة كلمة مرور المالك (داخل غرفة المالك)
// ═══════════════════════════════════════════════════════════════

export function OwnerPasswordManager() {
  const status = useQuery(api.playerControl.getOwnerPasswordStatus);
  const setOwnerPassword = useMutation(api.playerControl.setOwnerPassword);
  const deleteOwnerPassword = useMutation(api.playerControl.deleteOwnerPassword);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    if (!password.trim()) {
      toast.error("أدخل كلمة المرور");
      return;
    }
    if (password.length < 4) {
      toast.error("كلمة المرور قصيرة جداً (4 أحرف على الأقل)");
      return;
    }
    setBusy(true);
    try {
      await setOwnerPassword({ password: password.trim(), active: true });
      toast.success("تم تفعيل كلمة مرور المالك بنجاح");
      setPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ في الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (active: boolean) => {
    if (!status?.exists) return;
    setBusy(true);
    try {
      await setOwnerPassword({ password: password || "OMAR450op20@K#", active });
      toast.success(active ? "تم تفعيل كلمة المرور" : "تم تعطيل كلمة المرور");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteOwnerPassword();
      toast.success("تم حذف كلمة المرور نهائياً");
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ في الحذف");
    } finally {
      setBusy(false);
    }
  };

  if (status === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lock className="size-4 text-primary" />
            كلمة مرور المالك
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status.exists ? (
            <>
              <p className="text-xs text-muted-foreground">
                لم يتم تعيين كلمة مرور بعد. أضف كلمة مرور للدخول السريع.
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="h-10 rounded-xl ps-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute start-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={busy || !password.trim()}
                  className="gap-1.5 rounded-xl"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
                  تعيين كلمة المرور
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={status.active ? "border-emerald-500/50 text-emerald-600" : "border-muted-foreground/30 text-muted-foreground"}
                  >
                    {status.active ? "🟢 نشطة" : "🔴 معطّلة"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    كلمة المرور {status.active ? "نشطة" : "معطّلة"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={status.active}
                    onCheckedChange={handleToggle}
                    disabled={busy}
                  />
                </div>
              </div>

              <Separator className="my-2" />

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">تعديل كلمة المرور:</p>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="كلمة مرور جديدة (اتركها فارغة للاحتفاظ بالحالية)"
                    className="h-10 rounded-xl ps-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute start-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={busy || !password.trim()}
                    className="gap-1.5"
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={busy}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-4" />
                    حذف نهائياً
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* نافذة تأكيد الحذف */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="size-4" />
              حذف كلمة المرور نهائياً
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف كلمة المرور؟ لن تتمكن من استخدام الدخول السريع بعد ذلك.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={busy}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
              className="gap-1.5"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              حذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-px bg-border ${className ?? ""}`} />;
}
