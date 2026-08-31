import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ALL_FEATURES, FEATURE_CATEGORIES, type FeatureCategory } from "@/lib/features";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  silver: "bg-gray-400/10 text-gray-300 border-gray-400/20",
  gold: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  diamond: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  exclusive: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const TIER_LABELS: Record<string, string> = {
  bronze: "عادي",
  silver: "فضي",
  gold: "ذهبي",
  diamond: "ماسي",
  exclusive: "حصري",
};

export function FeaturesShowcase() {
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | "all">("all");

  const filtered =
    selectedCategory === "all"
      ? ALL_FEATURES
      : ALL_FEATURES.filter((f) => f.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">⚡ 50 ميزة قوية</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          جميع ميزات حرب العقول المتكاملة
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          الكل ({ALL_FEATURES.length})
        </button>
        {FEATURE_CATEGORIES.map((cat) => {
          const count = ALL_FEATURES.filter((f) => f.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                selectedCategory === cat.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الميزات", value: ALL_FEATURES.length, color: "text-primary" },
          { label: "莱莉بت", value: ALL_FEATURES.filter((f) => f.enabled).length, color: "text-green-400" },
          { label: "نظام الذكاء", value: ALL_FEATURES.filter((f) => f.category === "ai").length, color: "text-cyan-400" },
          { label: "الاقتصاد", value: ALL_FEATURES.filter((f) => f.category === "economy").length, color: "text-yellow-400" },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((feature, i) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="bg-card/40 border-border/40 hover:border-primary/30 transition-all hover:shadow-md group">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold truncate">{feature.name}</h3>
                        {feature.tier && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 ${TIER_COLORS[feature.tier]}`}
                          >
                            {TIER_LABELS[feature.tier]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                    <div className={`shrink-0 w-2 h-2 rounded-full ${feature.enabled ? "bg-green-400" : "bg-red-400"}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default FeaturesShowcase;
