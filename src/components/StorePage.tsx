/**
 * ═══════════════════════════════════════════════════════════════════
 * المتجر الضخم — واجهة مستخدم بريميوم
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Sound } from "@/lib/sounds";
import {
  Store,
  Search,
  Coins,
  ShoppingBag,
  Check,
  Lock,
  Star,
  Sparkles,
  Crown,
  Gem,
  Loader2,
  X,
  Zap,
  Heart,
  Trophy,
  Shield,
  Headphones,
} from "lucide-react";

const RARITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  common: { label: "عادي", color: "text-gray-400 bg-gray-500/10", icon: <Star className="size-3" /> },
  rare: { label: "نادر", color: "text-blue-400 bg-blue-500/10", icon: <Gem className="size-3" /> },
  epic: { label: "ملحمي", color: "text-purple-400 bg-purple-500/10", icon: <Crown className="size-3" /> },
  legendary: { label: "أسطوري", color: "text-amber-400 bg-amber-500/10", icon: <Sparkles className="size-3" /> },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  avatars: <span className="text-lg">👤</span>,
  frames: <span className="text-lg">🖼️</span>,
  effects: <span className="text-lg">✨</span>,
  badges: <span className="text-lg">🏅</span>,
  sounds: <span className="text-lg">🎵</span>,
  themes: <span className="text-lg">🎨</span>,
  powerups: <span className="text-lg">⚡</span>,
  gifts: <span className="text-lg">🎁</span>,
};

function ItemCard({
  item,
  owned,
  userCoins,
  onPurchase,
  purchasing,
}: {
  item: { id: string; category: string; name: string; icon: string; price: number; rarity: string; description: string };
  owned: boolean;
  userCoins: number;
  onPurchase: (id: string) => void;
  purchasing: string | null;
}) {
  const rarity = RARITY_CONFIG[item.rarity] ?? RARITY_CONFIG.common;
  const canAfford = userCoins >= item.price;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all",
          owned
            ? "border-green-500/30 bg-green-500/5"
            : canAfford
              ? "hover:border-primary/40 hover:shadow-md cursor-pointer"
              : "opacity-60",
        )}
      >
        <CardContent className="p-4">
          {/* Rarity badge */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className={cn("text-[9px] gap-1", rarity.color)}>
              {rarity.icon}
              {rarity.label}
            </Badge>
            {owned && (
              <Badge variant="outline" className="text-[9px] gap-1 text-green-400 bg-green-500/10">
                <Check className="size-2.5" />
                مملوك
              </Badge>
            )}
          </div>

          {/* Icon */}
          <div className="text-center my-3">
            <span className="text-4xl">{item.icon}</span>
          </div>

          {/* Info */}
          <h3 className="text-sm font-bold text-center">{item.name}</h3>
          <p className="text-[10px] text-muted-foreground text-center mt-0.5">{item.description}</p>

          {/* Price + Action */}
          <div className="mt-3">
            {owned ? (
              <Button variant="outline" className="w-full rounded-xl text-xs" disabled>
                <Check className="size-3 ml-1" />
                تفعيل
              </Button>
            ) : (
              <Button
                className="w-full rounded-xl text-xs"
                disabled={!canAfford || purchasing === item.id}
                onClick={() => {
                  Sound.click();
                  onPurchase(item.id);
                }}
                variant={canAfford ? "default" : "outline"}
              >
                {purchasing === item.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : canAfford ? (
                  <>
                    <Coins className="size-3 ml-1" />
                    {item.price} عملة
                  </>
                ) : (
                  <>
                    <Lock className="size-3 ml-1" />
                    {item.price} عملة
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>

        {/* Category color bar */}
        <div
          className={cn(
            "h-0.5",
            item.rarity === "legendary" && "bg-gradient-to-r from-amber-500 to-yellow-500",
            item.rarity === "epic" && "bg-gradient-to-r from-purple-500 to-violet-500",
            item.rarity === "rare" && "bg-gradient-to-r from-blue-500 to-cyan-500",
            item.rarity === "common" && "bg-gradient-to-r from-gray-500 to-gray-400",
          )}
        />
      </Card>
    </motion.div>
  );
}

export default function StorePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const categories = useQuery(api.store.getStoreSections);
  const items = useQuery(api.store.getStoreItems, { category: selectedCategory ?? undefined });
  const userCoins = useQuery(api.store.getBalances);
  const purchases = useQuery(api.store.getOwnedItems);
  const purchaseItem = useMutation(api.store.purchaseItem);

  const ownedIds = new Set(purchases ?? []);

  const filteredItems =
    items?.filter(
      (item) =>
        !searchQuery ||
        item.name.includes(searchQuery) ||
        item.description.includes(searchQuery),
    ) ?? [];

  const handlePurchase = async (itemId: string) => {
    setPurchasing(itemId);
    try {
      await purchaseItem({ itemId });
      Sound.victory();
    } catch {
      Sound.error();
    } finally {
      setPurchasing(null);
    }
  };

  if (categories === undefined || items === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-primary" />
          <h2 className="text-lg font-bold">المتجر</h2>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Coins className="size-3 text-amber-500" />
          <span className="font-bold">{(userCoins as any)?.coins ?? 0}</span>
          <span className="text-muted-foreground">عملة</span>
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في المتجر..."
          className="h-10 rounded-xl pr-10 text-sm"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => {
            Sound.click();
            setSelectedCategory(null);
          }}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-white/5 text-muted-foreground hover:text-foreground",
          )}
        >
          <ShoppingBag className="size-3" />
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              Sound.click();
              setSelectedCategory(cat.id);
            }}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-muted-foreground hover:text-foreground",
            )}
          >
            {CATEGORY_ICONS[cat.id] ?? <span>{cat.icon}</span>}
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategory ?? "all"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              owned={ownedIds.has(item.id)}
              userCoins={(userCoins as any)?.coins ?? 0}
              onPurchase={handlePurchase}
              purchasing={purchasing}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredItems.length === 0 && (
        <div className="text-center py-8">
          <Store className="mx-auto size-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد عناصر</p>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center text-[10px] text-muted-foreground pt-2 border-t border-border/50">
        <p>اربح العملات باللعب والفوز في التحديات — 1 عملة لكل 10 نقاط خبرة</p>
      </div>
    </div>
  );
}
