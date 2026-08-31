/**
 * PlayerSocialFeatures — user-facing panels for membership, reports, and gifts.
 * Shown on /play and /profile so every feature that lives in the owner room
 * also has a polished entry point for regular players.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Gift,
  KeyRound,
  Loader2,
  ShieldAlert,
  Sparkles,
  Star,
  Zap,
  Send,
  X,
  Check,
  MessageSquareWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

/* ═══════════════════════════════════════════════════════════════════
 * MEMBERSHIP TIER CONFIG (mirrors memberships.ts MEMBERSHIP_TIERS)
 * ═══════════════════════════════════════════════════════════════════ */
const TIERS = [
  { id: "bronze", name: "برونزي", emoji: "🥉", color: "from-amber-600 to-amber-400", bg: "bg-amber-500/10", border: "border-amber-400/40", benefits: ["مزايا أساسية", "صورة رمزية إضافية"] },
  { id: "silver", name: "فضي", emoji: "🥈", color: "from-slate-500 to-slate-300", bg: "bg-slate-500/10", border: "border-slate-400/40", benefits: ["كل مزايا البرونزي", "تلميحات يومية", "تمييز في القائمة"] },
  { id: "gold", name: "ذهبي", emoji: "🥇", color: "from-yellow-600 to-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-400/40", benefits: ["XP مضاعف 1.5x", "10 تلميحات يومية", "تحديات خاصة"] },
  { id: "diamond", name: "ماسي", emoji: "💎", color: "from-blue-600 to-cyan-400", bg: "bg-blue-500/10", border: "border-blue-400/40", benefits: ["XP مضاعف 2x", "20 تلميحات يومية", "شارة خاصة"] },
  { id: "exclusive", name: "أسطوري", emoji: "👑", color: "from-purple-600 to-pink-400", bg: "bg-purple-500/10", border: "border-purple-400/40", benefits: ["XP مضاعف 3x", "تلميحات غير محدودة", "ملف فخري حصري"] },
] as const;

const tierMap = Object.fromEntries(TIERS.map((t) => [t.id, t]));

/* ═══════════════════════════════════════════════════════════════════
 * REPORT REASONS
 * ═══════════════════════════════════════════════════════════════════ */
const REPORT_REASONS = [
  "غش أو تلاعب",
  "إساءة أو سبام",
  "محتوى غير لائق",
  "اسم مسيء",
  "سلوك ضار",
  "إزعاج متكرر",
  "أخرى",
] as const;

/* ═══════════════════════════════════════════════════════════════════
 * 1 — MEMBERSHIP CARD + CODE REDEMPTION
 * ═══════════════════════════════════════════════════════════════════ */
export function MembershipPanel() {
  const myMembership = useQuery(api.memberships.getMyMembership);
  const redeemCode = useMutation(api.memberships.redeemCode);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemCode({ code: code.trim() });
      toast.success(`تم تفعيل العضوية بنجاح! 🎉`);
      setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "الكود غير صالح أو مستخدم بالفعل");
    } finally {
      setRedeeming(false);
    }
  };

  const currentTier = myMembership ? tierMap[myMembership.tier] : null;

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
          <Crown className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold">عضويتي</p>
          <p className="text-xs text-muted-foreground">ترقِ عضويتك بكود سري</p>
        </div>
      </div>

      {myMembership && currentTier ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-4 rounded-2xl border ${currentTier.border} ${currentTier.bg} p-4`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentTier.emoji}</span>
            <div>
              <p className="font-bold">{currentTier.name}</p>
              <p className="text-xs text-muted-foreground">
                {myMembership.expiresAt
                  ? `صالحة حتى ${new Date(myMembership.expiresAt).toLocaleDateString("ar")}`
                  : "عضوية دائمة"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {currentTier.benefits.map((b) => (
              <Badge key={b} variant="secondary" className="text-[10px]">
                <Check className="size-2.5 me-1" />
                {b}
              </Badge>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">لم يتم تفعيل أي عضوية بعد</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">أدخل كوداً سرياً من المالك للترقية</p>
        </div>
      )}

      {/* Code Redemption */}
      <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <KeyRound className="size-3" />
          أدخل كود العضوية
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
            placeholder="XXXX-XXXX-XXXX"
            className="h-9 text-center text-sm font-bold tracking-widest"
            maxLength={20}
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          />
          <Button
            size="sm"
            onClick={handleRedeem}
            disabled={!code.trim() || redeeming}
            className="shrink-0 gap-1"
          >
            {redeeming ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            تفعيل
          </Button>
        </div>
      </div>

      {/* Tier Overview */}
      <div className="mt-4 grid grid-cols-5 gap-1.5">
        {TIERS.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl p-2 text-center transition-all ${
              myMembership?.tier === t.id
                ? `${t.bg} ${t.border} border-2 shadow-sm`
                : "border border-border/40 bg-muted/20"
            }`}
          >
            <span className="text-xl">{t.emoji}</span>
            <p className="mt-0.5 text-[10px] font-bold">{t.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 2 — REPORT PLAYER DIALOG
 * ═══════════════════════════════════════════════════════════════════ */
export function ReportPlayerDialog({
  open,
  onOpenChange,
  targetUserId,
  targetName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetName: string;
}) {
  const submitReport = useMutation(api.owner.submitReport);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("اختر سبب البلاغ");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        targetId: targetUserId as any,
        reason: reason + (details ? ` — ${details}` : ""),
        details: details || undefined,
      });
      toast.success("تم إرسال البلاغ بنجاح — شكراً للمساعدة في الحفاظ على مجتمع آمن 🛡️");
      onOpenChange(false);
      setReason("");
      setDetails("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إرسال البلاغ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-rose-500" />
            الإبلاغ عن {targetName}
          </DialogTitle>
          <DialogDescription>
            سنراجع البلاغ خلال دقائق — جميع البلاغات سرية ومحمية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground">سبب البلاغ:</p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  reason === r
                    ? "border-rose-400 bg-rose-500/10 text-rose-600"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:border-border"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="تفاصيل إضافية (اختياري)..."
            className="mt-2 w-full rounded-xl border border-border/60 bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="gap-1.5"
          >
            {submitting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            إرسال البلاغ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 3 — GIFTS PANEL (received gifts for users)
 * ═══════════════════════════════════════════════════════════════════ */
export function GiftsPanel() {
  const myGifts = useQuery(api.gifts.getReceivedGifts);
  const claimGift = useMutation(api.gifts.claimGift);

  const handleClaim = async (giftId: string) => {
    try {
      const result = await claimGift({ giftId: giftId as any });
      toast.success(`تم استلام الهدية بنجاح! 🎁`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل استلام الهدية");
    }
  };

  const unclaimed = myGifts?.filter((g: any) => !g.claimed) ?? [];
  const claimed = myGifts?.filter((g: any) => g.claimed) ?? [];
  const totalUnclaimed = unclaimed.length;

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600">
          <Gift className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold">هداياي</p>
          <p className="text-xs text-muted-foreground">
            {totalUnclaimed > 0 ? `${totalUnclaimed} هدية بانتظار الاستلام` : "لا توجد هدايا جديدة"}
          </p>
        </div>
      </div>

      {myGifts === undefined ? (
        <div className="mt-4 flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : unclaimed.length === 0 && claimed.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <span className="text-3xl">🎁</span>
          <p className="mt-2 text-xs text-muted-foreground">لا توجد هدايا بعد</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            يمكنك استلام هدايا من الأصدقاء أو من الإدارة
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {unclaimed.map((gift: any) => (
            <motion.div
              key={gift._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-xl border border-pink-400/30 bg-pink-500/5 p-3"
            >
              <span className="text-2xl">🎁</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">هدية من {gift.senderName}</p>
                {gift.message && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                    "{gift.message}"
                  </p>
                )}
                {gift.xpAmount && (
                  <p className="mt-0.5 text-[10px] text-primary font-semibold">+{gift.xpAmount} XP</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => handleClaim(gift._id)}
                className="shrink-0 gap-1 bg-pink-600 hover:bg-pink-700"
              >
                <Gift className="size-3" />
                استلام
              </Button>
            </motion.div>
          ))}
          {claimed.length > 0 && (
            <p className="pt-2 text-center text-[10px] text-muted-foreground/60">
              تم استلام {claimed.length} هدية سابقاً
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * 4 — QUICK REPORT BUTTON (standalone)
 * ═══════════════════════════════════════════════════════════════════ */
export function ReportButton({
  targetUserId,
  targetName,
  variant = "ghost",
  size = "sm",
}: {
  targetUserId: string;
  targetName: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className="gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
        onClick={() => setOpen(true)}
      >
        <MessageSquareWarning className="size-3.5" />
        إبلاغ
      </Button>
      <ReportPlayerDialog
        open={open}
        onOpenChange={setOpen}
        targetUserId={targetUserId}
        targetName={targetName}
      />
    </>
  );
}
