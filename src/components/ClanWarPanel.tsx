import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Swords, Coins, Loader2, Trophy } from "lucide-react";

/**
 * ⚔️ لوحة حرب العشيرة — المواجهة الأسبوعية الحية + الخزينة والترقيات.
 */
export function ClanWarPanel() {
  const clan = useQuery(api.clans.getMyClan);
  const war = useQuery(api.clanWars.getMyWar);
  const treasury = useQuery(api.clanWars.getMyTreasury);
  const buyUpgrade = useMutation(api.clanWars.buyClanUpgrade);

  if (!clan) return null;

  const buy = async (key: string) => {
    try {
      const r = await buyUpgrade({ key });
      toast.success(`اشترت العشيرة ${r.name} 🎉`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الشراء");
    }
  };

  const total = (war?.hasWar ? (war.myPoints ?? 0) + (war.rivalPoints ?? 0) : 0) || 1;
  const myShare = war?.hasWar ? Math.round(((war.myPoints ?? 0) / total) * 100) : 50;
  const winning = war?.hasWar ? (war.myPoints ?? 0) >= (war.rivalPoints ?? 0) : false;

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-l from-orange-500/10 via-card to-red-500/10 shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
          <Swords className="size-5 text-orange-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">حرب العشائر الأسبوعية</p>
          <p className="text-[11px] text-muted-foreground">
            {clan.name} · قسم {war?.division ?? "برونز"} — انتهاء الأسبوع:{" "}
            {war?.hasWar && war.weekEndsAt
              ? new Date(war.weekEndsAt).toLocaleDateString("ar", { weekday: "long" })
              : "قريباً"}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-orange-500/20 p-4 pt-3">
        {war?.hasWar ? (
          <>
            {/* Live war scoreboard */}
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
              <div className="flex items-center justify-between text-sm font-black">
                <span className={cn(winning ? "text-emerald-600" : "text-muted-foreground")}>
                  {clan.emoji} {clan.name}
                </span>
                <span className="text-xs text-muted-foreground">ضد</span>
                <span className={cn(!winning ? "text-emerald-600" : "text-muted-foreground")}>
                  {war.rivalName}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-2xl font-black">
                <span className={winning ? "text-emerald-600" : "text-foreground"}>{war.myPoints}</span>
                <span className="text-xs text-muted-foreground">نقاط الحرب</span>
                <span className={!winning ? "text-emerald-600" : "text-foreground"}>{war.rivalPoints}</span>
              </div>
              {/* progress bar */}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-red-500/20">
                <div
                  className={cn("h-full rounded-full transition-all", winning ? "bg-emerald-500" : "bg-orange-500")}
                  style={{ width: `${myShare}%` }}
                />
              </div>
              <p className="mt-2 text-center text-[10px] font-bold text-muted-foreground">
                {winning ? "🔥 عشيرتك متقدمة — واصلوا اللعب!" : "⚔️ متأخرون — كل جولة تصنع الفرق!"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              نقاط الحرب تُحتسب تلقائياً من جولات الأعضاء: مشاركة +5، فوز +15، دقة كاملة +10، ولكل 100 نقطة +1
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
            <Trophy className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 text-xs font-bold">لا مواجهة بعد هذا الأسبوع</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              المطابقة الآلية تقابل عشيرتك بخصم متقارب خلال أقرب ساعة
            </p>
          </div>
        )}

        {/* Treasury + upgrades */}
        {treasury && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-black">
                <Coins className="size-4 text-amber-600" /> خزينة الحرب
              </p>
              <p className="text-sm font-black text-amber-600">{treasury.coins} 🪙</p>
            </div>
            {treasury.isOwner && (
              <div className="mt-2 space-y-1.5">
                {(
                  [
                    { key: "banner", label: "🚩 الراية المذهّبة", cost: 200 },
                    { key: "hall", label: "🏛️ قاعة الحرب الكبرى", cost: 400 },
                    { key: "morale", label: "🥁 طبل المعنويات (+10% نقاط)", cost: 350 },
                  ] as const
                ).map((u) => {
                  const owned = treasury.upgrades.some((x) => x.key === u.key);
                  return (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => buy(u.key)}
                      disabled={owned || treasury.coins < u.cost}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold transition",
                        owned
                          ? "bg-emerald-500/10 text-emerald-700"
                          : treasury.coins >= u.cost
                            ? "bg-amber-500 text-white hover:bg-amber-600"
                            : "cursor-not-allowed bg-muted text-muted-foreground",
                      )}
                    >
                      <span>{owned ? `${u.label} — مملوكة ✓` : u.label}</span>
                      {!owned && <span>{u.cost} 🪙</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
