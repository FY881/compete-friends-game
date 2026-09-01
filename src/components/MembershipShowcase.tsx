import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  TrendingUp,
  Clock,
  Shield,
  Star,
} from "lucide-react";

// ─── Tier Color Config ────────────────────────────────────────
const TIER_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; badge: string }> = {
  bronze: { bg: "from-gray-400 to-gray-500", border: "border-gray-500/30", text: "text-gray-600", glow: "", badge: "bg-gray-500/10 text-gray-600" },
  silver: { bg: "from-slate-400 to-slate-500", border: "border-slate-400/30", text: "text-slate-600", glow: "shadow-slate-500/20", badge: "bg-slate-500/10 text-slate-600" },
  gold: { bg: "from-yellow-500 to-amber-500", border: "border-yellow-500/30", text: "text-yellow-600", glow: "shadow-yellow-500/30", badge: "bg-yellow-500/10 text-yellow-600" },
  diamond: { bg: "from-blue-500 to-cyan-500", border: "border-blue-500/30", text: "text-blue-600", glow: "shadow-blue-500/30", badge: "bg-blue-500/10 text-blue-600" },
  exclusive: { bg: "from-purple-500 to-violet-600", border: "border-purple-500/30", text: "text-purple-600", glow: "shadow-purple-500/30", badge: "bg-purple-500/10 text-purple-600" },
};

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];

// ─── Static Tier Data for Display ─────────────────────────────
const TIERS = [
  { id: "bronze", name: "برونزي", emoji: "🥉", price: "مجاني", challenges: 5, multiplier: "1x", description: "الوصول الكامل للعبة الأساسية", features: [
    { icon: Gamepad2, label: "1 لعبة", active: true },
    { icon: Zap, label: "مضاعف 1x", active: false },
    { icon: Target, label: "5 تحدي يومي", active: true },
    { icon: MessageCircle, label: "الغرف العامة", active: true },
    { icon: Brain, label: "AI أساسي", active: true },
    { icon: Gift, label: "هدايا مستلمة فقط", active: false },
    { icon: Palette, label: "بدون تأثيرات", active: false },
    { icon: Users, label: "بدون عصابة", active: false },
  ]},
  { id: "silver", name: "فضي", emoji: "🥈", price: "رموز سرية", challenges: 8, multiplier: "1.25x", description: "زيادة التحديات + لعبة الثانية", features: [
    { icon: Gamepad2, label: "2 لعبة", active: true },
    { icon: Zap, label: "مضاعف 1.25x", active: true },
    { icon: Target, label: "8 تحدي يومي", active: true },
    { icon: MessageCircle, label: "عام + خاصة", active: true },
    { icon: Brain, label: "AI قياسي", active: true },
    { icon: Gift, label: "3 هدايا/يوم", active: true },
    { icon: Shield, label: "شارة فضية", active: true },
    { icon: Palette, label: "إطار اسم", active: true },
  ]},
  { id: "gold", name: "ذهبي", emoji: "🥇", price: "رموز سرية", challenges: 12, multiplier: "1.5x", description: "غرفة خاصة + AI متقدم + شارة ذهبية", features: [
    { icon: Gamepad2, label: "3 ألعاب", active: true },
    { icon: Zap, label: "مضاعف 1.5x", active: true },
    { icon: Target, label: "12 تحدي يومي", active: true },
    { icon: MessageCircle, label: "كل الغرف + 3 خاصة", active: true },
    { icon: Brain, label: "AI متقدم", active: true },
    { icon: Gift, label: "8 هدايا + هدية يومية", active: true },
    { icon: Shield, label: "شارة ذهبية متوهجة", active: true },
    { icon: Headphones, label: "مؤثرات صوتية", active: true },
  ]},
  { id: "diamond", name: "ماسي", emoji: "💎", price: "رموز سرية", challenges: 20, multiplier: "1.75x", description: "جميع الألعاب + AI خبير + تأثيرات متحركة", features: [
    { icon: Gamepad2, label: "كل الألعاب", active: true },
    { icon: Zap, label: "مضاعف 1.75x", active: true },
    { icon: Target, label: "20 تحدي يومي", active: true },
    { icon: MessageCircle, label: "غرف غير محدودة", active: true },
    { icon: Brain, label: "AI خبير", active: true },
    { icon: Gift, label: "15 هدايا + هدايا نادرة", active: true },
    { icon: Shield, label: "شارة ماسية متحركة", active: true },
    { icon: Headphones, label: "حزمة صوتية فاخرة", active: true },
  ]},
  { id: "exclusive", name: "أسطوري", emoji: "👑", price: "رموز سرية", challenges: 30, multiplier: "2x", description: "أقصى صلاحيات + AI احترافي + تأثيرات استثنائية", features: [
    { icon: Gamepad2, label: "كل الألعاب + حصرية", active: true },
    { icon: Zap, label: "مضاعف 2x", active: true },
    { icon: Target, label: "30 تحدي يومي", active: true },
    { icon: MessageCircle, label: "غرف مخصصة بالكامل", active: true },
    { icon: Brain, label: "AI احترافي", active: true },
    { icon: Gift, label: "50 هدايا + هدايا أسطورية", active: true },
    { icon: Shield, label: "شارة أسطورية متحركة", active: true },
    { icon: Headphones, label: "حزمة صوتية حصرية", active: true },
  ]},
];

// ─── Tier Card ────────────────────────────────────────────────
function TierCard({
  tier,
  isCurrent,
  onRedeem,
}: {
  tier: (typeof TIERS)[number];
  isCurrent: boolean;
  onRedeem: () => void;
}) {
  const config = TIER_CONFIG[tier.id];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border transition-all duration-500",
      isCurrent ? cn("ring-2 ring-offset-2 ring-offset-background", config.border) : "border-border/60",
      config.glow && `shadow-lg ${config.glow}`,
    )}>
      {/* Gradient header */}
      <div className={cn("relative bg-gradient-to-r p-5 text-white", config.bg)}>
        {isCurrent && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-white/20 text-white text-[10px] gap-1">
              <Crown className="size-2.5" /> الحالي
            </Badge>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-3xl">{tier.emoji}</span>
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
            <p className={cn("text-lg font-bold", config.text)}>{tier.challenges}</p>
            <p className="text-[10px] text-muted-foreground">تحدي</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className={cn("text-lg font-bold", config.text)}>{tier.multiplier}</p>
            <p className="text-[10px] text-muted-foreground">مضاعف</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className={cn("text-lg font-bold", config.text)}>
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
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1">
                <Icon className={cn("size-3.5 shrink-0", feat.active ? config.text : "text-muted-foreground/50")} />
                <span className={cn("text-[11px]", feat.active ? "text-foreground" : "text-muted-foreground/50 line-through")}>
                  {feat.label}
                </span>
                {feat.active && <Check className={cn("size-3 shrink-0 ml-auto", config.text)} />}
              </div>
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
              className={cn("w-full gap-1.5 rounded-xl text-xs text-white bg-gradient-to-r", config.bg)}
              onClick={onRedeem}
            >
              <Lock className="size-3" /> تفعيل بالكود
            </Button>
          )}
        </div>
      </CardContent>
    </div>
  );
}

// ─── Exclusive Challenges ─────────────────────────────────────
function ExclusiveChallenges({ tier }: { tier: string }) {
  const challenges = useQuery(api.membershipSystem.getExclusiveChallenges, { tier });
  if (!challenges || challenges.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
          <Target className="size-4 text-primary" />
          تحديات حصرية لعضويتك
        </h3>
        <div className="space-y-2">
          {challenges.map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-colors hover:bg-muted/30">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Target className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{ch.name}</p>
                <p className="text-[10px] text-muted-foreground">{ch.description}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[9px]">+{ch.reward} XP</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Showcase ────────────────────────────────────────────
export function MembershipShowcase() {
  const myMembership = useQuery(api.membershipSystem.getMyMembership);
  const redeemCode = useMutation(api.memberships.redeemCode);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<string | null>(null);

  const currentTier = myMembership?.tier ?? "bronze";

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      await redeemCode({ code: code.trim() });
      setCode("");
      setRedeemTarget(null);
    } catch (error) {
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
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold">عضويات حرب العقول</h2>
        <p className="mt-1 text-xs text-muted-foreground">اختر مستواك واستمتع بمميزات حصرية</p>
      </div>

      {/* Current Status */}
      {myMembership && currentTier !== "bronze" && (
        <Card className={cn("border", TIER_CONFIG[currentTier]?.border)}>
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
              {currentTier === "exclusive" && <Crown className="size-6 text-purple-500 animate-pulse" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code Redemption */}
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

      {/* Tier Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isCurrent={currentTier === tier.id}
            onRedeem={() => setRedeemTarget(tier.id)}
          />
        ))}
      </div>

      {/* Exclusive Challenges */}
      {currentTier !== "bronze" && currentTier !== "silver" && (
        <ExclusiveChallenges tier={currentTier} />
      )}

      {/* Redemption Dialog */}
      {redeemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
        </div>
      )}
    </div>
  );
}
