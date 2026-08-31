import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Crown, Star, Gem, Shield, Sparkles, Zap, Trophy,
  MessageSquare, Gift, Gamepad2, CheckCircle2,
} from "lucide-react";

const TIERS = [
  {
    id: "bronze",
    name: "برونزي",
    icon: "🥉",
    gradient: "from-amber-600 to-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    textColor: "text-amber-700 dark:text-amber-300",
    dailyGames: 10,
    xpMultiplier: "1x",
    features: ["وصول لـ 80 لعبة", "تحدي يومي", "غرف دردشة عامة"],
  },
  {
    id: "silver",
    name: "فضي",
    icon: "🥈",
    gradient: "from-gray-400 to-gray-600",
    bg: "bg-gray-50 dark:bg-gray-950/30",
    border: "border-gray-300 dark:border-gray-700",
    textColor: "text-gray-600 dark:text-gray-300",
    dailyGames: 20,
    xpMultiplier: "1.5x",
    features: ["كل مميزات البرونزي", "تحديات متقدمة", "هدايا شهرية", " badges حصرية"],
  },
  {
    id: "gold",
    name: "ذهبي",
    icon: "🥇",
    gradient: "from-yellow-500 to-yellow-700",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-300 dark:border-yellow-700",
    textColor: "text-yellow-600 dark:text-yellow-300",
    dailyGames: 30,
    xpMultiplier: "2x",
    features: ["كل مميزات الفضي", "لعب حصرية", "إشعارات مخصصة", "أولوية في المطابقة"],
  },
  {
    id: "diamond",
    name: "ماسي",
    icon: "💎",
    gradient: "from-blue-500 to-purple-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-300 dark:border-blue-700",
    textColor: "text-blue-600 dark:text-blue-300",
    dailyGames: 50,
    xpMultiplier: "3x",
    features: ["كل مميزات الذهبي", "غرف VIP حصرية", "هدايا ماسية", "ملف شخصي مميز"],
  },
  {
    id: "legendary",
    name: "أسطوري",
    icon: "👑",
    gradient: "from-purple-500 to-pink-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-300 dark:border-purple-700",
    textColor: "text-purple-600 dark:text-purple-300",
    dailyGames: 999,
    xpMultiplier: "5x",
    features: ["كل مميزات الماسي", "وصول مطلق", "تخصيص كامل", "شخصية مخصصة", "دعم VIP"],
  },
];

export function MembershipCard() {
  const currentTier = "bronze"; // Default tier for display
  const currentIdx = 0;
  const current = TIERS[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Crown className="size-5 text-yellow-500" />
        <h2 className="text-lg font-bold">العضوية</h2>
        <Badge variant="secondary" className={`${current.textColor} ${current.bg} border ${current.border}`}>
          {current.icon} {current.name}
        </Badge>
      </div>

      {/* Current tier highlight */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border ${current.border} ${current.bg} p-5 mb-4`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{current.icon}</span>
          <div>
            <p className="text-lg font-bold">عضوية {current.name}</p>
            <p className="text-xs text-muted-foreground">
              {current.dailyGames === 999 ? "بدون حد" : `${current.dailyGames} تحدي يومي`} ·
              مضاعفة {current.xpMultiplier}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {current.features.map((f, i) => (
            <Badge key={i} variant="outline" className="text-[10px] gap-1">
              <CheckCircle2 className="size-2.5" /> {f}
            </Badge>
          ))}
        </div>
      </motion.div>

      {/* All tiers */}
      <div className="grid grid-cols-1 gap-2">
        {TIERS.map((tier, idx) => {
          const isActive = tier.id === currentTier;
          const isLocked = idx > currentIdx;
          return (
            <div
              key={tier.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                isActive
                  ? `${tier.border} ${tier.bg} shadow-sm`
                  : isLocked
                    ? "border-dashed opacity-50"
                    : "border-border/60 bg-card"
              }`}
            >
              <span className="text-2xl">{tier.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{tier.name}</p>
                  {isActive && (
                    <Badge variant="secondary" className="text-[9px]">الحالي</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {tier.dailyGames === 999 ? "غير محدود" : `${tier.dailyGames} تحدي يومي`} ·
                  XP {tier.xpMultiplier}
                </p>
              </div>
              {isLocked && (
                <div className="text-xs text-muted-foreground">🔒</div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-3">
        استخدم كود عضوية من غرفة المالك للترقية
      </p>
    </div>
  );
}
