import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/lib/sounds";
import {
  Crown,
  Zap,
  Gift,
  Check,
  Lock,
  Loader2,
  Sparkles,
  Gamepad2,
  MessageCircle,
  Brain,
  Headphones,
  Palette,
  Users,
  Target,
  Clock,
  Shield,
  Star,
  Trophy,
  ChevronLeft,
  Award,
  Gem,
} from "lucide-react";

// ─── Tier Visual Config ───────────────────────────────────────
const TIERS = [
  { id: "bronze", name: "برونزي", nameEn: "Bronze", emoji: "🥉", price: "مجاني", challenges: 5, multiplier: "1x", gradient: "from-gray-400 to-gray-500", ring: "ring-gray-400", glow: "", description: "الوصول الكامل للعبة الأساسية", features: [
    { icon: Gamepad2, label: "1 لعبة", active: true },
    { icon: Zap, label: "مضاعف 1x", active: false },
    { icon: Target, label: "5 تحدي يومي", active: true },
    { icon: MessageCircle, label: "الغرف العامة", active: true },
    { icon: Brain, label: "AI أساسي", active: true },
    { icon: Gift, label: "هدايا مستلمة فقط", active: false },
    { icon: Palette, label: "بدون تأثيرات", active: false },
    { icon: Users, label: "بدون عصابة", active: false },
  ]},
  { id: "silver", name: "فضي", nameEn: "Silver", emoji: "🥈", price: "رموز سرية", challenges: 8, multiplier: "1.25x", gradient: "from-slate-400 to-slate-500", ring: "ring-slate-400", glow: "shadow-slate-400/20", description: "زيادة التحديات + لعبة الثانية + شارة فضية", features: [
    { icon: Gamepad2, label: "2 لعبة", active: true },
    { icon: Zap, label: "مضاعف 1.25x", active: true },
    { icon: Target, label: "8 تحدي يومي", active: true },
    { icon: MessageCircle, label: "عام + خاصة", active: true },
    { icon: Brain, label: "AI قياسي", active: true },
    { icon: Gift, label: "3 هدايا/يوم", active: true },
    { icon: Shield, label: "شارة فضية", active: true },
    { icon: Star, label: "إطار اسم", active: true },
  ]},
  { id: "gold", name: "ذهبي", nameEn: "Gold", emoji: "🥇", price: "رموز سرية", challenges: 12, multiplier: "1.5x", gradient: "from-yellow-500 to-amber-500", ring: "ring-yellow-500", glow: "shadow-yellow-500/30", description: "غرفة خاصة + AI متقدم + شارة ذهبية متوهجة", features: [
    { icon: Gamepad2, label: "3 ألعاب", active: true },
    { icon: Zap, label: "مضاعف 1.5x", active: true },
    { icon: Target, label: "12 تحدي يومي", active: true },
    { icon: MessageCircle, label: "كل الغرف + 3 خاصة", active: true },
    { icon: Brain, label: "AI متقدم", active: true },
    { icon: Gift, label: "8 هدايا + يومية", active: true },
    { icon: Shield, label: "شارة ذهبية متوهجة", active: true },
    { icon: Headphones, label: "مؤثرات صوتية", active: true },
  ]},
  { id: "diamond", name: "ماسي", nameEn: "Diamond", emoji: "💎", price: "رموز سرية", challenges: 20, multiplier: "1.75x", gradient: "from-blue-500 to-cyan-500", ring: "ring-blue-500", glow: "shadow-blue-500/30", description: "جميع الألعاب + AI خبير + تأثيرات متحركة", features: [
    { icon: Gamepad2, label: "كل الألعاب", active: true },
    { icon: Zap, label: "مضاعف 1.75x", active: true },
    { icon: Target, label: "20 تحدي يومي", active: true },
    { icon: MessageCircle, label: "غرف غير محدودة", active: true },
    { icon: Brain, label: "AI خبير", active: true },
    { icon: Gift, label: "15 هدايا + نادرة", active: true },
    { icon: Shield, label: "شارة ماسية متحركة", active: true },
    { icon: Headphones, label: "حزمة صوتية فاخرة", active: true },
  ]},
  { id: "exclusive", name: "أسطوري", nameEn: "Exclusive", emoji: "👑", price: "رموز سرية", challenges: 30, multiplier: "2x", gradient: "from-purple-500 to-violet-600", ring: "ring-purple-500", glow: "shadow-purple-500/30", description: "أقصى صلاحيات + AI احترافي + تأثيرات استثنائية", features: [
    { icon: Gamepad2, label: "كل الألعاب + حصرية", active: true },
    { icon: Zap, label: "مضاعف 2x", active: true },
    { icon: Target, label: "30 تحدي يومي", active: true },
    { icon: MessageCircle, label: "غرف مخصصة بالكامل", active: true },
    { icon: Brain, label: "AI احترافي", active: true },
    { icon: Gift, label: "50 هدايا + أسطورية", active: true },
    { icon: Shield, label: "شارة أسطورية متحركة", active: true },
    { icon: Headphones, label: "حزمة صوتية حصرية", active: true },
  ]},
];

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

// ─── Tier Badge Component ─────────────────────────────────────
function TierBadge({ tier, size = "md" }: { tier: string; size?: "sm" | "md" | "lg" }) {
  const tierData = TIERS.find((t) => t.id === tier);
  if (!tierData) return null;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
    md: "text-xs px-2 py-1 gap-1",
    lg: "text-sm px-3 py-1.5 gap-1.5",
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center rounded-full font-bold",
        sizeClasses[size],
        tier === "exclusive" && "bg-gradient-to-r from-purple-500/20 to-violet-600/20 text-purple-700 border border-purple-500/30",
        tier === "diamond" && "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-700 border border-blue-500/30",
        tier === "gold" && "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-700 border border-yellow-500/30",
        tier === "silver" && "bg-slate-500/10 text-slate-600 border border-slate-400/30",
        tier === "bronze" && "bg-gray-500/10 text-gray-600 border border-gray-400/30",
      )}
    >
      <span>{tierData.emoji}</span>
      <span>{tierData.name}</span>
      {tier === "exclusive" && <Crown className="size-3" />}
      {tier === "diamond" && <Gem className="size-3" />}
    </motion.div>
  );
}

// ─── Animated Tier Card ───────────────────────────────────────
function TierCard({
  tier,
  isCurrent,
  onSelect,
}: {
  tier: (typeof TIERS)[number];
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isCurrent
          ? cn("ring-2 ring-offset-2 ring-offset-background", tier.ring)
          : "border-border/60",
        tier.glow && `shadow-lg ${tier.glow}`,
        isHovered && "shadow-xl",
      )}
    >
      {/* Gradient header with animation */}
      <div className={cn("relative bg-gradient-to-r p-5 text-white overflow-hidden", tier.gradient)}>
        {/* Animated background particles */}
        {tier.id === "exclusive" && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute size-1 rounded-full bg-white/30"
                initial={{ x: Math.random() * 200, y: -10 }}
                animate={{
                  y: [0, 200],
                  x: [Math.random() * 200, Math.random() * 200],
                  opacity: [0.8, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        )}
        {tier.id === "diamond" && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute size-1.5 rotate-45 bg-white/20"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 200, opacity: [0, 0.6, 0] }}
                transition={{
                  duration: 2.5 + Math.random(),
                  repeat: Infinity,
                  delay: Math.random() * 3,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative flex items-center gap-3">
          <motion.span
            className="text-3xl"
            animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {tier.emoji}
          </motion.span>
          <div>
            <h3 className="text-lg font-bold">{tier.name}</h3>
            <p className="text-xs opacity-80">{tier.price}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <p className="mb-3 text-xs text-muted-foreground">{tier.description}</p>

        {/* Quick stats */}
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className={cn("text-lg font-bold", `text-${tier.id === "exclusive" ? "purple" : tier.id === "diamond" ? "blue" : tier.id === "gold" ? "yellow" : tier.id === "silver" ? "slate" : "gray"}-600`)}>
              {tier.challenges}
            </p>
            <p className="text-[10px] text-muted-foreground">تحدي</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className={cn("text-lg font-bold", `text-${tier.id === "exclusive" ? "purple" : tier.id === "diamond" ? "blue" : tier.id === "gold" ? "yellow" : tier.id === "silver" ? "slate" : "gray"}-600`)}>
              {tier.multiplier}
            </p>
            <p className="text-[10px] text-muted-foreground">مضاعف</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className={cn("text-lg font-bold", `text-${tier.id === "exclusive" ? "purple" : tier.id === "diamond" ? "blue" : tier.id === "gold" ? "yellow" : tier.id === "silver" ? "slate" : "gray"}-600`)}>
              {tier.features.filter((f) => f.active).length}
            </p>
            <p className="text-[10px] text-muted-foreground">ميزة</p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-1.5">
          {tier.features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 rounded-lg px-2 py-1"
              >
                <Icon className={cn("size-3.5 shrink-0", feat.active ? "text-foreground" : "text-muted-foreground/50")} />
                <span className={cn("text-[11px]", feat.active ? "text-foreground" : "text-muted-foreground/50 line-through")}>
                  {feat.label}
                </span>
                {feat.active && <Check className="size-3 shrink-0 ml-auto text-emerald-500" />}
              </motion.div>
            );
          })}
        </div>

        {/* Action */}
        <div className="mt-4">
          {isCurrent ? (
            <Button variant="outline" className="w-full gap-1.5 rounded-xl text-xs" disabled>
              <Crown className="size-3" /> عضويتك الحالية
            </Button>
          ) : tier.id === "bronze" ? (
            <Button variant="outline" className="w-full gap-1.5 rounded-xl text-xs" disabled>
              للجميع
            </Button>
          ) : (
            <Button
              className={cn("w-full gap-1.5 rounded-xl text-xs text-white bg-gradient-to-r", tier.gradient)}
              onClick={() => {
                sounds.click();
                onSelect();
              }}
            >
              <Lock className="size-3" /> تفعيل بالكود
            </Button>
          )}
        </div>
      </CardContent>
    </motion.div>
  );
}

// ─── Exclusive Challenges ─────────────────────────────────────
function ExclusiveChallenges({ tier }: { tier: string }) {
  const challenges = useQuery(api.membershipSystem.getExclusiveChallenges, { tier });
  if (!challenges || challenges.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/60">
        <CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
            <Target className="size-4 text-primary" />
            تحديات حصرية لعضويتك
          </h3>
          <div className="space-y-2">
            {challenges.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Target className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{ch.name}</p>
                  <p className="text-[10px] text-muted-foreground">{ch.description}</p>
                </div>
                <Badge variant="outline" className="rounded-full text-[9px]">+{ch.reward} XP</Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Showcase ────────────────────────────────────────────
export function MembershipShowcase() {
  const myMembership = useQuery(api.membershipSystem.getMyMembership);
  const redeemCode = useMutation(api.memberships.redeemCode);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const currentTier = myMembership?.tier ?? "bronze";

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      await redeemCode({ code: code.trim() });
      setCode("");
      setRedeemTarget(null);
      setShowSuccess(true);
      sounds.victory();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      sounds.error();
      console.error(error);
    } finally {
      setRedeeming(false);
    }
  };

  if (myMembership === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Animation */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="rounded-3xl bg-gradient-to-br from-yellow-500 to-amber-600 p-8 text-center text-white shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Trophy className="mx-auto size-16" />
              </motion.div>
              <h3 className="mt-4 text-2xl font-bold">تم التفعيل بنجاح!</h3>
              <p className="mt-2 text-sm opacity-80">مرحباً بك في عضويتك الجديدة</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-xl font-bold">عضويات حرب العقول</h2>
        <p className="mt-1 text-xs text-muted-foreground">اختر مستواك واستمتع بمميزات حصرية</p>
      </motion.div>

      {/* Current Status */}
      {myMembership && currentTier !== "bronze" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className={cn("border", TIERS.find((t) => t.id === currentTier)?.ring)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TIERS.find((t) => t.id === currentTier)?.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold">عضويتك: {TIERS.find((t) => t.id === currentTier)?.name}</p>
                  {myMembership.expiresAt && (
                    <p className="text-[10px] text-muted-foreground">
                      <Clock className="inline size-3" /> تنتهي {new Date(myMembership.expiresAt).toLocaleDateString("ar")}
                    </p>
                  )}
                </div>
                {currentTier === "exclusive" && (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Crown className="size-6 text-purple-500" />
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Code Redemption */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="أدخل كود العضوية…"
                className="h-10 rounded-xl text-center font-mono text-sm tracking-widest"
                dir="ltr"
              />
              <Button onClick={handleRedeem} disabled={!code.trim() || redeeming} className="gap-1.5 rounded-xl">
                {redeeming ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                تفعيل
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tier Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier, i) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isCurrent={currentTier === tier.id}
            onSelect={() => setRedeemTarget(tier.id)}
          />
        ))}
      </div>

      {/* Exclusive Challenges */}
      {currentTier !== "bronze" && currentTier !== "silver" && (
        <ExclusiveChallenges tier={currentTier} />
      )}

      {/* Redemption Dialog */}
      <AnimatePresence>
        {redeemTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Card className="mx-4 w-full max-w-sm">
                <CardContent className="p-6">
                  <h3 className="text-center text-lg font-bold mb-4">
                    تفعيل {TIERS.find((t) => t.id === redeemTarget)?.name}
                  </h3>
                  <div className="space-y-3">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="أدخل الكود…"
                      className="h-11 rounded-xl text-center font-mono tracking-widest"
                      dir="ltr"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setRedeemTarget(null)}>
                        إلغاء
                      </Button>
                      <Button className="flex-1 rounded-xl gap-1.5" onClick={handleRedeem} disabled={!code.trim() || redeeming}>
                        {redeeming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        تفعيل
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
