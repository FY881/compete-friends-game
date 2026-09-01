/**
 * ═══════════════════════════════════════════════════════════════════
 * واجهة العضويات الموسّعة — بطاقات + ألعاب حصرية + صوتيات + أنيمشن
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
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
  ChevronRight,
  Award,
  Gem,
  Swords,
  Eye,
  Calendar,
  TrendingUp,
  Volume2,
  VolumeX,
  Key,
  BarChart3,
  Flame,
} from "lucide-react";

// ─── Tier Visual Config ───────────────────────────────────────
const TIERS = [
  {
    id: "bronze", name: "برونزي", nameEn: "Bronze", emoji: "🥉",
    price: "مجاني", challenges: 5, multiplier: "1x",
    gradient: "from-gray-400 to-gray-600",
    ring: "ring-gray-400/30", glow: "",
    cardBg: "bg-gradient-to-br from-gray-900/80 to-gray-800/80",
    border: "border-gray-500/20", text: "text-gray-300",
    description: "الوصول الكامل للعبة الأساسية",
    features: [
      { icon: Gamepad2, label: "1 لعبة (سباق الذكاء)", active: true },
      { icon: Zap, label: "مضاعف 1x", active: false },
      { icon: Target, label: "5 تحدي يومي", active: true },
      { icon: MessageCircle, label: "الغرف العامة فقط", active: true },
      { icon: Brain, label: "AI أساسي", active: true },
      { icon: Gift, label: "استلام هدايا فقط", active: false },
      { icon: Palette, label: "بدون تأثيرات بصرية", active: false },
      { icon: Users, label: "بدون عصابة", active: false },
      { icon: Shield, label: "بدون شارة توثيق", active: false },
      { icon: Headphones, label: "بدون مؤثرات صوتية", active: false },
    ],
    exclusiveGames: [{ name: "سباق الذكاء", icon: "⚡", desc: "تحدي سريع لسرعة البديهة" }],
    soundPack: null,
    aiLevel: "أساسي",
  },
  {
    id: "silver", name: "فضي", nameEn: "Silver", emoji: "🥈",
    price: "رموز سرية", challenges: 8, multiplier: "1.25x",
    gradient: "from-slate-300 to-slate-500",
    ring: "ring-slate-400/30", glow: "shadow-slate-400/20",
    cardBg: "bg-gradient-to-br from-slate-800/80 to-slate-700/80",
    border: "border-slate-400/30", text: "text-slate-200",
    description: "فتح اللعبة الثانية + شارة فضية + AI أفضل",
    features: [
      { icon: Gamepad2, label: "2 لعبة (+ عصر الألغاز)", active: true },
      { icon: Zap, label: "مضاعف 1.25x", active: true },
      { icon: Target, label: "8 تحدي يومي", active: true },
      { icon: MessageCircle, label: "عام + خاصة (1)", active: true },
      { icon: Brain, label: "AI قياسي", active: true },
      { icon: Gift, label: "3 هدايا يومياً", active: true },
      { icon: Shield, label: "شارة فضية", active: true },
      { icon: Star, label: "إطار اسم فضي", active: true },
      { icon: Headphones, label: "مؤثرات دخول فضي", active: true },
      { icon: Clock, label: "100 عملة يومياً", active: true },
    ],
    exclusiveGames: [
      { name: "سباق الذكاء", icon: "⚡", desc: "تحدي سريع" },
      { name: "عصر الألغاز", icon: "🧩", desc: "ألغاز متعددة" },
    ],
    soundPack: { entry: "صوت دخول أنيق", victory: "صوت نجاح مميز", levelUp: "صوت ترقية" },
    aiLevel: "قياسي",
  },
  {
    id: "gold", name: "ذهبي", nameEn: "Gold", emoji: "🥇",
    price: "رموز سرية", challenges: 12, multiplier: "1.5x",
    gradient: "from-yellow-400 to-amber-600",
    ring: "ring-yellow-500/30", glow: "shadow-yellow-500/25",
    cardBg: "bg-gradient-to-br from-yellow-950/40 to-amber-950/40",
    border: "border-yellow-500/30", text: "text-yellow-200",
    description: "غرفة خاصة + AI متقدم + مؤثرات + تحديات حصرية",
    features: [
      { icon: Gamepad2, label: "3 ألعاب (+ تحدي الأبطال)", active: true },
      { icon: Zap, label: "مضاعف 1.5x", active: true },
      { icon: Target, label: "12 تحدي يومي", active: true },
      { icon: MessageCircle, label: "كل الغرف + 3 خاصة", active: true },
      { icon: Brain, label: "AI متقدم + تحديات مخصصة", active: true },
      { icon: Gift, label: "8 هدايا + هدية يومية", active: true },
      { icon: Shield, label: "شارة ذهبية متوهجة", active: true },
      { icon: Headphones, label: "حزمة صوتية ذهبية", active: true },
      { icon: Users, label: "إنشاء عصابة", active: true },
      { icon: Trophy, label: "تحديات حصرية", active: true },
      { icon: Palette, label: "تأثيرات بصرية خفيفة", active: true },
      { icon: Calendar, label: "يوم حصري أسبوعي", active: true },
    ],
    exclusiveGames: [
      { name: "سباق الذكاء", icon: "⚡", desc: "تحدي سريع" },
      { name: "عصر الألغاز", icon: "🧩", desc: "ألغاز متعددة" },
      { name: "تحدي الأبطال", icon: "⚔️", desc: "تحديات عميقة" },
    ],
    soundPack: { entry: "صوت دخول فخم", victory: "صوت نجاح ذهبي", levelUp: "صوت ترقية ذهبية" },
    aiLevel: "متقدم",
  },
  {
    id: "diamond", name: "ماسي", nameEn: "Diamond", emoji: "💎",
    price: "رموز سرية", challenges: 20, multiplier: "1.75x",
    gradient: "from-blue-400 to-cyan-500",
    ring: "ring-blue-500/30", glow: "shadow-blue-500/25",
    cardBg: "bg-gradient-to-br from-blue-950/40 to-cyan-950/40",
    border: "border-blue-500/30", text: "text-blue-200",
    description: "كل الألعاب + AI خبير + تأثيرات متحركة + غرف متقدمة",
    features: [
      { icon: Gamepad2, label: "4 ألعاب (+ اندفاع الماس)", active: true },
      { icon: Zap, label: "مضاعف 1.75x", active: true },
      { icon: Target, label: "20 تحدي يومي", active: true },
      { icon: MessageCircle, label: "غرف غير محدودة", active: true },
      { icon: Brain, label: "AI خبير + تنبؤات + أنماط", active: true },
      { icon: Gift, label: "15 هدايا + هدايا نادرة", active: true },
      { icon: Shield, label: "شارة ماسية متحركة", active: true },
      { icon: Headphones, label: "حزمة صوتية فاخرة", active: true },
      { icon: Users, label: "إدارة عصابات", active: true },
      { icon: Trophy, label: "تحديات حصرية + مكافآت", active: true },
      { icon: Palette, label: "تأثيرات بصرية متقدمة", active: true },
      { icon: Calendar, label: "يوم حصري مزدوج", active: true },
      { icon: TrendingUp, label: "وصول مبكر للأحداث", active: true },
    ],
    exclusiveGames: [
      { name: "سباق الذكاء", icon: "⚡", desc: "تحدي سريع" },
      { name: "عصر الألغاز", icon: "🧩", desc: "ألغاز متعددة" },
      { name: "تحدي الأبطال", icon: "⚔️", desc: "تحديات عميقة" },
      { name: "اندفاع الماس", icon: "💎", desc: "تحدي الماسي" },
    ],
    soundPack: { entry: "صوت دخول كريستالي", victory: "صوت نجاح ماسي", levelUp: "صوت ترقية ماسية" },
    aiLevel: "خبير",
  },
  {
    id: "exclusive", name: "أسطوري", nameEn: "Exclusive", emoji: "👑",
    price: "رموز سرية", challenges: 30, multiplier: "2x",
    gradient: "from-purple-400 to-violet-600",
    ring: "ring-purple-500/30", glow: "shadow-purple-500/25",
    cardBg: "bg-gradient-to-br from-purple-950/40 to-violet-950/40",
    border: "border-purple-500/30", text: "text-purple-200",
    description: "أقصى صلاحيات + ساحة الأساطير + AI احترافي + كل المميزات",
    features: [
      { icon: Gamepad2, label: "5 ألعاب (+ ساحة الأساطير)", active: true },
      { icon: Zap, label: "مضاعف 2x", active: true },
      { icon: Target, label: "30 تحدي يومي", active: true },
      { icon: MessageCircle, label: "غرف مخصصة بالكامل", active: true },
      { icon: Brain, label: "AI احترافي + أهداف شخصية", active: true },
      { icon: Gift, label: "50 هدايا + هدايا أسطورية", active: true },
      { icon: Shield, label: "شارة أسطورية متحركة", active: true },
      { icon: Headphones, label: "حزمة صوتية حصرية كاملة", active: true },
      { icon: Users, label: "إدارة عصابات متقدمة", active: true },
      { icon: Trophy, label: "كل التحديات الحصرية", active: true },
      { icon: Palette, label: "تأثيرات بصرية استثنائية", active: true },
      { icon: Calendar, label: "4 أيام حصرية أسبوعياً", active: true },
      { icon: Crown, label: "أولوية في كل شيء", active: true },
      { icon: Gem, label: "تصويت على أحداث مستقبلية", active: true },
      { icon: Flame, label: "مظهر خاص في الترتيبات", active: true },
    ],
    exclusiveGames: [
      { name: "سباق الذكاء", icon: "⚡", desc: "تحدي سريع" },
      { name: "عصر الألغاز", icon: "🧩", desc: "ألغاز متعددة" },
      { name: "تحدي الأبطال", icon: "⚔️", desc: "تحديات عميقة" },
      { name: "اندفاع الماس", icon: "💎", desc: "تحدي الماسي" },
      { name: "ساحة الأساطير", icon: "👑", desc: "التحدي الأقصى" },
    ],
    soundPack: { entry: "صوت دخول أسطوري ملحمي", victory: "صوت نجouth ملحمي", levelUp: "صوت ترقية استثنائي" },
    aiLevel: "احترافي",
  },
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
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center rounded-full font-bold",
        sizeClasses[size],
        tier === "exclusive" && "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30",
        tier === "diamond" && "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30",
        tier === "gold" && "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30",
        tier === "silver" && "bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30",
        tier === "bronze" && "bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/30",
      )}
    >
      <span>{tierData.emoji}</span>
      <span>{tierData.name}</span>
    </motion.span>
  );
}

// ─── Sound Pack Display ───────────────────────────────────────
function SoundPackCard({ pack, tier }: { pack: Record<string, string>; tier: string }) {
  const [playing, setPlaying] = useState<string | null>(null);

  const handlePlay = (key: string) => {
    sounds.click();
    setPlaying(key);
    setTimeout(() => setPlaying(null), 1000);
  };

  return (
    <div className="space-y-2">
      {Object.entries(pack).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handlePlay(key)}
          >
            {playing === key ? (
              <Volume2 className="size-3.5 animate-pulse text-green-400" />
            ) : (
              <VolumeX className="size-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Exclusive Games Display ──────────────────────────────────
function ExclusiveGamesList({ games, currentTier }: { games: Array<{ name: string; icon: string; desc: string }>; currentTier: string }) {
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);

  return (
    <div className="space-y-2">
      {TIERS.map((tierData) => {
        const tierIndex = TIER_ORDER.indexOf(tierData.id);
        const isLocked = tierIndex > currentTierIndex;
        const tierGames = TIERS.find((t) => t.id === tierData.id)?.exclusiveGames ?? [];

        if (tierGames.length === 0) return null;

        return (
          <div key={tierData.id} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>{tierData.emoji}</span>
              <span className={isLocked ? "text-muted-foreground" : "text-foreground"}>
                {tierData.name}
              </span>
              {isLocked && <Lock className="size-3 text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {tierGames.map((game, idx) => (
                <motion.div
                  key={`${tierData.id}-${idx}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs",
                    isLocked
                      ? "bg-white/3 text-muted-foreground"
                      : "bg-white/5 text-foreground",
                  )}
                >
                  <span className="text-base">{game.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{game.name}</div>
                    <div className="text-[10px] text-muted-foreground">{game.desc}</div>
                  </div>
                  {!isLocked && <Check className="size-3.5 text-green-400" />}
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Level Display ─────────────────────────────────────────
function AiLevelCard({ tier }: { tier: string }) {
  const aiLevels: Record<string, { name: string; icon: string; capabilities: string[] }> = {
    bronze: { name: "أساسي", icon: "🤖", capabilities: ["تحليل أساسي", "نصائح عامة"] },
    silver: { name: "قياسي", icon: "🤖", capabilities: ["تحليل أساسي", "تتبع أداء", "توصيات"] },
    gold: { name: "متقدم", icon: "🧠", capabilities: ["تحليل أعمق", "تحديات مخصصة", "نقاط ضعف"] },
    diamond: { name: "خبير", icon: "🧠", capabilities: ["تنبؤات", "اكتشاف أنماط", "تحديات متقدمة"] },
    exclusive: { name: "احترافي", icon: "🧠‍", capabilities: ["تحليل احترافي", "أهداف شخصية", "متابعة يومية", "تحديات مولدة"] },
  };

  const level = aiLevels[tier] ?? aiLevels.bronze;

  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{level.icon}</span>
        <span className="text-sm font-bold">AI {level.name}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {level.capabilities.map((cap) => (
          <span key={cap} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function MembershipShowcase() {
  const [activeTab, setActiveTab] = useState<"tiers" | "games" | "sounds" | "ai">("tiers");
  const [showActivate, setShowActivate] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState("");

  const membership = useQuery(api.membershipSystem.getMyMembership);
  const redeemCode = useMutation(api.memberships.redeemCode);
  const exclusiveGames = useQuery(api.membershipSystem.getExclusiveGames);
  const [activating, setActivating] = useState(false);

  const currentTier = membership?.tier ?? "bronze";
  const currentTierData = TIERS.find((t) => t.id === currentTier);

  const handleActivate = async () => {
    if (!activationCode.trim()) return;
    setActivating(true);
    try {
      await redeemCode({ code: activationCode.trim() });
      sounds.victory();
      setShowActivate(false);
      setActivationCode("");
    } catch (error) {
      sounds.error();
    } finally {
      setActivating(false);
    }
  };

  if (membership === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Current Membership Status ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4",
          currentTierData?.cardBg,
          currentTierData?.border,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.span
              className="text-3xl"
              animate={currentTier === "exclusive" ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {currentTierData?.emoji}
            </motion.span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">عضويتك الحالية</span>
                <TierBadge tier={currentTier} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{currentTierData?.description}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => { sounds.click(); setShowActivate(true); }}
          >
            <Key className="size-3.5 ml-1" />
            تفعيل كود
          </Button>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">مضاعف</div>
            <div className="text-sm font-bold">{currentTierData?.multiplier}</div>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">تحديات يومية</div>
            <div className="text-sm font-bold">{currentTierData?.challenges}</div>
          </div>
          <div className="rounded-lg bg-white/5 px-3 py-1.5 text-center">
            <div className="text-[10px] text-muted-foreground">AI</div>
            <div className="text-sm font-bold">{currentTierData?.aiLevel}</div>
          </div>
        </div>
      </motion.div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1.5 rounded-xl bg-white/5 p-1">
        {[
          { id: "tiers" as const, label: "المستويات", icon: Crown },
          { id: "games" as const, label: "الألعاب", icon: Gamepad2 },
          { id: "sounds" as const, label: "الصوتيات", icon: Headphones },
          { id: "ai" as const, label: "الذكاء", icon: Brain },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { sounds.click(); setActiveTab(tab.id); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "tiers" && (
          <motion.div
            key="tiers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {TIERS.map((tierData, index) => {
              const isCurrent = tierData.id === currentTier;
              const isLocked = TIER_ORDER.indexOf(tierData.id) > TIER_ORDER.indexOf(currentTier);

              return (
                <motion.div
                  key={tierData.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border transition-all",
                    tierData.cardBg,
                    tierData.border,
                    isCurrent && "ring-2 ring-primary/50",
                    isLocked && "opacity-70",
                  )}
                  onClick={() => { sounds.click(); setSelectedTier(tierData.id); }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{tierData.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{tierData.name}</span>
                          {isCurrent && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary"
                            >
                              الحالي
                            </motion.span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{tierData.nameEn}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground">{tierData.price}</div>
                      <div className="text-sm font-bold">{tierData.multiplier}</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="px-4 pb-3">
                    <p className="mb-2 text-xs text-muted-foreground">{tierData.description}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {tierData.features.map((feature, fIdx) => (
                        <div
                          key={fIdx}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]",
                            feature.active ? "text-foreground" : "text-muted-foreground/60",
                          )}
                        >
                          {feature.active ? (
                            <Check className="size-3 shrink-0 text-green-400" />
                          ) : (
                            <Lock className="size-3 shrink-0 text-muted-foreground/40" />
                          )}
                          <span className="truncate">{feature.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gradient accent */}
                  <div className={cn("h-1 bg-gradient-to-r", tierData.gradient)} />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {activeTab === "games" && (
          <motion.div
            key="games"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <ExclusiveGamesList games={[]} currentTier={currentTier} />
          </motion.div>
        )}

        {activeTab === "sounds" && (
          <motion.div
            key="sounds"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {TIERS.filter((t) => t.soundPack).map((tierData) => {
              const isAvailable = TIER_ORDER.indexOf(tierData.id) <= TIER_ORDER.indexOf(currentTier);
              return (
                <div
                  key={tierData.id}
                  className={cn(
                    "rounded-xl border p-3",
                    tierData.cardBg,
                    tierData.border,
                    !isAvailable && "opacity-50",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{tierData.emoji}</span>
                    <span className="text-sm font-bold">حزمة صوتية {tierData.name}</span>
                    {!isAvailable && <Lock className="size-3 text-muted-foreground" />}
                  </div>
                  {isAvailable && tierData.soundPack && (
                    <SoundPackCard pack={tierData.soundPack as Record<string, string>} tier={tierData.id} />
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="text-center mb-2">
              <Brain className="mx-auto size-8 text-primary mb-1" />
              <p className="text-sm font-bold">الذكاء الاصطناعي الشخصي</p>
              <p className="text-xs text-muted-foreground">كلما ارتفع مستواك، زاد ذكاء AI المساعد الخاص بك</p>
            </div>
            {TIERS.map((tierData) => {
              const isAvailable = TIER_ORDER.indexOf(tierData.id) <= TIER_ORDER.indexOf(currentTier);
              return (
                <div key={tierData.id} className={cn(!isAvailable && "opacity-50")}>
                  <AiLevelCard tier={tierData.id} />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Exclusive Challenges ── */}
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Trophy className="size-4 text-yellow-500" />
          التحديات الحصرية
        </h3>
      </div>

      {/* ── Activation Dialog ── */}
      <AnimatePresence>
        {showActivate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowActivate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border/60 bg-background p-6"
            >
              <h3 className="text-lg font-bold text-center mb-4">🎯 تفعيل عضوية</h3>
              <Input
                placeholder="أدخل كود العضوية..."
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                className="rounded-xl text-center font-mono mb-4"
                dir="ltr"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setShowActivate(false)}
                >
                  إلغاء
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={handleActivate}
                  disabled={!activationCode.trim() || activating}
                >
                  {activating ? <Loader2 className="size-4 animate-spin" /> : "تفعيل"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
