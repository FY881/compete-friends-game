import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserCheck, Star, Loader2 } from "lucide-react";

/**
 * موجّة 6.2 — لوحة العُرفاء: كل من يتولى إشراف غرفة، وعدد إجراءاته
 * من سجلّ القرارات الموحّد — ليظل المالك مسيطراً على التفويض.
 */
export function ModeratorsBoard() {
  const rooms = useQuery(api.owner.getLiveGames) as unknown as
    | { length: number }
    | undefined;

  void rooms; // الغرف تُدار في مكان آخر؛ التركيز على سجلّ الإجراءات

  const decisions = useQuery(api.council.getDecisionsFiltered, { limit: 150 });

  const mods = useMemo(() => {
    const rows = (decisions ?? []).filter(
      (d) => d.action === "room_moderator_warn" || d.action === "room_moderator_mute",
    );
    const byActor = new Map<string, { warns: number; mutes: number; lastAt: number }>();
    for (const d of rows) {
      const cur = byActor.get(d.actorName) ?? { warns: 0, mutes: 0, lastAt: 0 };
      if (d.action === "room_moderator_warn") cur.warns++;
      else cur.mutes++;
      cur.lastAt = Math.max(cur.lastAt, d.createdAt);
      byActor.set(d.actorName, cur);
    }
    return [...byActor.entries()].sort((a, b) => b[1].warns + b[1].mutes - (a[1].warns + a[1].mutes));
  }, [decisions]);

  if (decisions === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <UserCheck className="size-4 text-primary" />
            العُرفاء — مشرفو الغرف
          </h3>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {mods.length} عريف نشِط
          </Badge>
        </div>

        {mods.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            لا إجراءات عُرفة بعد — العُرفاء يُعيَّنون من داخل كل غرفة بواسطة مالكها ⭐
          </p>
        ) : (
          <div className="space-y-1.5">
            {mods.map(([actor, s]) => (
              <div key={actor} className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Star className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{actor.replace("عريف: ", "")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.warns} تحذير · {s.mutes} كتم
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-bold",
                    s.warns + s.mutes > 10 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700",
                  )}
                >
                  {s.warns + s.mutes > 10 ? "نشاط مرتفع — راقب" : "متعاون"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
