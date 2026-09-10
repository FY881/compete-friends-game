/**
 * موجّة 11 — لوحة الحلبة العالمية
 * انضم لطابور المبارزات، شاهد تصنيفك ودرعك، وتابع لوحة صدارة الحلبة.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Swords, Trophy, Timer, ChevronRight, CalendarDays, Gift, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function ArenaPanel() {
  const navigate = useNavigate();
  const myRating = useQuery(api.arena.getMyRating);
  const ladder = useQuery(api.arena.getLadder, { limit: 8 });
  const activeDuel = useQuery(api.arena.getMyActiveDuel);
  const joinQueue = useMutation(api.arena.joinQueue);
  const leaveQueue = useMutation(api.arena.leaveQueue);

  // موجّة 12 — مواسم الحلبة
  const seasonData = useQuery(api.arenaSeasons.getCurrentSeason);
  const seasonLadder = useQuery(api.arenaSeasons.getSeasonLadder, { limit: 5 });
  const seasonRewards = useQuery(api.arenaSeasons.getMySeasonRewards);
  const claimReward = useMutation(api.arenaSeasons.claimSeasonReward);

  const [searching, setSearching] = useState(false);

  // وجود مبارزة نشطة → انتقل إليها تلقائياً
  useEffect(() => {
    if (activeDuel?.gameCode) {
      toast.success("⚔️ وُجد خصم! انتقال إلى المبارزة…");
      navigate(`/game/${activeDuel.gameCode}`);
    }
  }, [activeDuel?.gameCode, navigate]);

  if (myRating === undefined || ladder === undefined) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border/80 bg-card p-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleJoin = async () => {
    setSearching(true);
    try {
      const res = await joinQueue({});
      if ("matched" in res && res.matched && res.code) {
        toast.success("⚔️ وُجد خصم! انطلاق المبارزة…");
        navigate(`/game/${res.code}`);
      } else {
        toast("🔎 تم إدخالك طابور الحلبة — في انتظار خصم…");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الانضمام");
    } finally {
      setSearching(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveQueue({});
      toast("تمت إزالتك من الطابور");
    } catch {
      /* تجاهل */
    }
  };

  const winRate =
    myRating && myRating.wins + myRating.losses + myRating.draws > 0
      ? Math.round((myRating.wins / (myRating.wins + myRating.losses + myRating.draws)) * 100)
      : 0;

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-blue-500/5 to-violet-500/5 p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Swords className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">الحلبة العالمية ⚔️</h2>
            <p className="text-xs text-muted-foreground">
              مبارزات 1v1 بتزويد فوري — تُحسم في 5 أسئلة وتحدّد تصنيفك
            </p>
          </div>
        </div>

        {/* بطاقة تصنيفي */}
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground">تصنيفك</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-blue-600">
              {myRating ? myRating.rating : 1000}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {myRating && (
                <Badge className="rounded-full bg-blue-500/10 text-[11px] text-blue-700">
                  {myRating.tier.emoji} {myRating.tier.name}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full text-[10px]">
                {myRating?.wins ?? 0} فوز · {myRating?.losses ?? 0} خسارة · {winRate}%
              </Badge>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2">
            {myRating?.inQueue ? (
              <>
                <Button
                  disabled
                  className="gap-2 rounded-xl bg-amber-500/90 text-white"
                >
                  <Timer className="size-4 animate-pulse" />
                  في انتظار خصم…
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={handleLeave}>
                  إلغاء البحث
                </Button>
              </>
            ) : (
              <Button
                onClick={handleJoin}
                disabled={searching}
                className="gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700"
              >
                {searching ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}
                {searching ? "يبحث عن خصم…" : "ابحث عن خصم ⚔️"}
              </Button>
            )}
          </div>
        </div>

        {/* لوحة الصدارة */}
        {ladder.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Trophy className="size-3.5" /> نخبة الحلبة
            </p>
            <ul className="space-y-1.5">
              {ladder.map((p, i) => (
                <li
                  key={p.userId}
                  className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5"
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {p.tier.emoji} {p.tier.name}
                  </Badge>
                  <span className="text-sm font-black tabular-nums text-blue-600">{p.rating}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ChevronRight className="size-3 rotate-180" />
          كسب مبارزة ضد أقوى منك يرفع تصنيفك كثيراً — والخسارة من أضعف منك تخفضه بحدّة.
        </p>
      </div>

      {/* ── موجّة 12: موسم الحلبة الحالي ── */}
      {seasonData?.season && (
        <div className="mt-5 rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <CalendarDays className="size-5" />
            </span>
            <div className="flex-1">
              <h3 className="text-base font-bold">{seasonData.season.name} 🗓️</h3>
              <p className="text-xs text-muted-foreground">
                تصنيف موسمي منفصل — ينتهي الموسم بعد{" "}
                {Math.max(1, Math.ceil((seasonData.season.endAt - Date.now()) / 86400000))} يوم
              </p>
            </div>
          </div>

          {seasonData.me ? (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-card p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">ترتيبك الموسمي</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums text-amber-600">
                  #{seasonData.me.rank ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">نقاط الموسم</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums">{seasonData.me.rating}</p>
              </div>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {seasonData.me.tier.emoji} {seasonData.me.tier.name}
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {seasonData.me.wins} فوز موسمي
              </Badge>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-card p-4 text-sm text-muted-foreground">
              لم تخض مبارزة موسمية بعد — كل مبارزة حلبة تُحتسب تلقائياً في الموسم.
            </p>
          )}

          {seasonLadder && seasonLadder.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {seasonLadder.map((p) => (
                <li key={p.userId} className="flex items-center gap-3 rounded-xl bg-card px-4 py-2">
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : `#${p.rank}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                  <span className="text-sm font-black tabular-nums text-amber-600">{p.rating}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── موجّة 12: مكافآت المواسم المنتهية ── */}
      {seasonRewards && seasonRewards.length > 0 && (
        <div className="mt-5 rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Gift className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold">مكافآت المواسم المنتهية 🎁</h3>
              <p className="text-xs text-muted-foreground">استلم جائزة ترتيبك النهائي قبل فوات الأوان</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {seasonRewards.map((r) => (
              <li
                key={r.seasonNumber}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-4 py-3"
              >
                <span className="min-w-0 flex-1 text-sm font-bold">
                  {r.seasonName} — المرتبة #{r.rank || "—"}
                </span>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {r.rewardTier}
                </Badge>
                {r.claimed ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> تم الاستلام
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={async () => {
                      try {
                        const res = await claimReward({ seasonNumber: r.seasonNumber });
                        toast.success(`🎁 استلمت مكافأتك: ${res.rewardTier} — المرتبة #${res.rank}`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر الاستلام");
                      }
                    }}
                  >
                    استلم المكافأة
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
