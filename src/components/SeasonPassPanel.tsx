/**
 * موجّة 13 — تذكرة الموسم 2.0 (واجهة اللاعب)
 * مسار 30 مستوى بشريط تقدم أفقي، جوائز تُستلم بضغطة، وإطارات موسم حصرية.
 */

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ticket, Gift, Trophy, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

const FRAME_INFO: Record<string, { label: string; emoji: string; cls: string }> = {
  frame_season_1: { label: "إطار الموسم البرونزي", emoji: "🥉", cls: "border-amber-600/50 bg-amber-600/10 text-amber-700" },
  frame_season_2: { label: "إطار الموسم الفضي", emoji: "🥈", cls: "border-slate-400/50 bg-slate-400/10 text-slate-600" },
  frame_season_3: { label: "إطار الموسم الذهبي", emoji: "👑", cls: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700" },
};

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

export function SeasonPassPanel() {
  const pass = useQuery(api.seasonPass.getMyPass);
  const board = useQuery(api.seasonPass.getPassLeaderboard, { limit: 5 });
  const claimTier = useMutation(api.seasonPass.claimTier);

  if (pass === undefined || pass === null) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border/80 bg-card p-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const pct = Math.min(100, Math.round((pass.intoTier / pass.pointsForTier) * 100));

  const handleClaim = async (tier: number) => {
    try {
      const res = await claimTier({ tier });
      toast.success(
        `🎁 مستوى ${tier}: +${res.loyalty} ولاء · +${res.xp} خبرة${res.frame ? " · إطار موسمي جديد!" : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستلام");
    }
  };

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/5 via-violet-500/5 to-indigo-500/5 p-6">
        {/* الترويسة */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-600">
              <Ticket className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">تذكرة الموسم {pass.seasonNumber} 🎫</h2>
              <p className="text-xs text-muted-foreground">
                العب الجولات — 10% من خبرتك تتحول نقاط تذكرة تلقائياً
              </p>
            </div>
          </div>
          {pass.claimable > 0 && (
            <Badge className="animate-pulse rounded-full bg-fuchsia-600 text-[11px] text-white">
              <Gift className="size-3" /> {pass.claimable} جائزة تنتظرك
            </Badge>
          )}
        </div>

        {/* التقدم */}
        <div className="mt-5 rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-xl font-black text-fuchsia-600">
                {pass.currentTier}
              </span>
              <div>
                <p className="text-sm font-bold">المستوى {pass.currentTier} من 30</p>
                <p className="text-[11px] text-muted-foreground">
                  {fmt(pass.pointsForTier - pass.intoTier)} نقطة للمستوى التالي
                </p>
              </div>
            </div>
            {/* الإطارات الموسمية المملوكة */}
            <div className="flex gap-1.5">
              {pass.frames.map((f: string) => {
                const info = FRAME_INFO[f];
                return info ? (
                  <Badge key={f} variant="outline" className={`rounded-full text-[10px] ${info.cls}`}>
                    {info.emoji} {info.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* مسار الجوائز */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {pass.tiers.map((t) => {
            const milestone = t.tier % 10 === 0;
            return (
              <div
                key={t.tier}
                className={`flex w-28 shrink-0 flex-col items-center rounded-2xl border p-3 text-center ${
                  t.claimed
                    ? "border-border/40 bg-muted/20 opacity-50"
                    : t.unlocked
                      ? milestone
                        ? "border-yellow-500/50 bg-yellow-500/5 shadow-sm"
                        : "border-fuchsia-500/40 bg-fuchsia-500/5"
                      : "border-border/40 bg-card opacity-40"
                }`}
              >
                <span className="text-xs font-black text-muted-foreground">م{t.tier}</span>
                {milestone && <span className="text-xl">{t.tier === 30 ? "👑" : t.tier === 20 ? "🥈" : "🥉"}</span>}
                <span className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                  <Sparkles className="size-2.5" /> {t.reward.loyalty}
                </span>
                <span className="text-[10px] text-muted-foreground">+{t.reward.xp} خبرة</span>
                {t.claimed ? (
                  <span className="mt-2 text-[10px] font-bold text-muted-foreground">✓ استُلمت</span>
                ) : t.unlocked ? (
                  <Button
                    size="sm"
                    className="mt-2 h-6 rounded-full bg-fuchsia-600 px-2.5 text-[10px] text-white hover:bg-fuchsia-700"
                    onClick={() => handleClaim(t.tier)}
                  >
                    استلم 🎁
                  </Button>
                ) : (
                  <span className="mt-2 text-[10px] text-muted-foreground">🔒</span>
                )}
              </div>
            );
          })}
        </div>

        {/* لوحة الصدارة */}
        {board && board.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Trophy className="size-3.5" /> أسرع تقدماً هذا الموسم
            </p>
            <ul className="space-y-1.5">
              {board.map((p, i) => (
                <li key={p.userId} className="flex items-center gap-3 rounded-xl bg-card px-4 py-2">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  {p.tier >= 30 && <Crown className="size-3.5 text-yellow-500" />}
                  <Badge variant="outline" className="rounded-full text-[10px]">م{p.tier}</Badge>
                  <span className="text-sm font-black tabular-nums text-fuchsia-600">
                    {fmt(p.passPoints)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
